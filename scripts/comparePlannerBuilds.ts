import { emptyEffect, getModsForWeapon, filterBuilderExpertVariants, type ModEffect } from "../src/domain/catalog/modCatalog";
import {
    assignModsToSlots,
    debugEvaluateExpectedEncounter,
    debugScoreBuild,
    getTargetProfileAssumptions,
    minimizePolaritiesByCapacity,
    type OptimizeGoal,
} from "../src/domain/logic/buildOptimizerCore";
import { debugScoreExpectedEncounter } from "../src/domain/logic/buildOptimizer";
import { calculateBuild, type ConditionalState } from "../src/domain/logic/damageCalc";
import { getWeaponCatalog, withSelectedAttack, type WeaponEntry } from "../src/domain/catalog/weaponCatalog";
import { getArcanesForWeapon } from "../src/domain/catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../src/domain/logic/arcaneEffects";
import { countPolarityChanges, effectiveDrain, fitsWithinCapacity, type CapacityConfig } from "../src/domain/logic/capacityCalc";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";

interface NamedBuild {
    name: string;
    mods: Array<{ name: string; rank: number }>;
}

const BENCHMARK_BUILDS: NamedBuild[] = [
    {
        name: "Tenno-Hub optimizer",
        mods: [
            { name: "Malignant Force", rank: 3 },
            { name: "Primed Cryo Rounds", rank: 10 },
            { name: "Hellfire", rank: 5 },
            { name: "Heavy Caliber", rank: 10 },
            { name: "Vile Acceleration", rank: 5 },
            { name: "Vital Sense", rank: 5 },
            { name: "Split Chamber", rank: 5 },
        ],
    },
    {
        name: "Underframe Auto Build",
        mods: [
            { name: "Amalgam Serration", rank: 10 },
            { name: "Bane of Corpus", rank: 5 },
            { name: "Bane of Grineer", rank: 5 },
            { name: "Bane of Infested", rank: 5 },
            { name: "Malignant Force", rank: 3 },
            { name: "Rime Rounds", rank: 3 },
            { name: "Thermite Rounds", rank: 3 },
            { name: "Vital Sense", rank: 5 },
        ],
    },
];

const FRESH_UNDERFRAME_BUILD: NamedBuild = {
    name: "Underframe Auto Build (2026-11-12 in-app capture)",
    mods: [
        { name: "High Voltage", rank: 3 },
        { name: "Infected Clip", rank: 5 },
        { name: "Thermite Rounds", rank: 3 },
        { name: "Galvanized Chamber", rank: 10 },
        { name: "Vile Acceleration", rank: 5 },
        { name: "Galvanized Aptitude", rank: 10 },
        { name: "Vital Sense", rank: 5 },
        { name: "Radiated Reload", rank: 3 },
    ],
};
const compareSavedUnderframe = process.argv.includes("--saved-underframe");
const compareFreshUnderframe = process.argv.includes("--fresh-underframe");
const underframeComparisonBuild = compareSavedUnderframe ? BENCHMARK_BUILDS[1] : FRESH_UNDERFRAME_BUILD;
let SELECTED_BUILDS = compareSavedUnderframe
    ? [BENCHMARK_BUILDS[0], BENCHMARK_BUILDS[1]]
    : compareFreshUnderframe
        ? [BENCHMARK_BUILDS[0], FRESH_UNDERFRAME_BUILD]
    : BENCHMARK_BUILDS;
let REOPTIMIZED_BUILD: NamedBuild | null = null;
let REOPTIMIZED_RESULT: ReturnType<typeof optimizeBuild> | null = null;

const WEAPON_NAME = "Braton Prime";
const requestedGoal = process.argv.find((arg) => arg.startsWith("--goal="))?.slice(7).trim();
const GOAL: OptimizeGoal = requestedGoal === "timeToKill" || requestedGoal === "scaling"
    ? requestedGoal
    : "burst";
const FACTION = "Grineer";
const TARGET = {
    health: 83_818,
    shields: 0,
    overguard: 0,
    armor: 2_700,
    toxinBypassesShields: true,
};
const CONDITIONAL_STATE: ConditionalState = process.argv.includes("--fully-stacked")
    ? { mode: "fullyStacked" }
    : { mode: "initial" };
const CAPACITY_CONFIG: CapacityConfig = {
    weaponRank: 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: false,
};
const MAX_FORMA = 3;

function getWeapon(name: string): WeaponEntry {
    const weapon = getWeaponCatalog().find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (!weapon) throw new Error(`Weapon not found: ${name}`);
    return weapon;
}

function makeEffects(
    build: NamedBuild,
    weapon: WeaponEntry,
): { effects: ModEffect[]; mods: ReturnType<typeof getModsForWeapon> } {
    const compatible = filterBuilderExpertVariants(getModsForWeapon(weapon));
    const effects: ModEffect[] = [];
    const mods = [];
    for (const requested of build.mods) {
        const variants = compatible.filter((entry) => entry.name.toLowerCase() === requested.name.toLowerCase());
        const mod = variants.find((entry) => !/\/(Beginner|Intermediate|Expert)\//i.test(entry.path) &&
            !/(Beginner|Intermediate|Expert)$/i.test(entry.path)) ?? variants[0];
        if (!mod) throw new Error(`Compatible mod not found for ${build.name}: ${requested.name}`);
        if (requested.rank < 0 || requested.rank > mod.fusionLimit) {
            throw new Error(`Invalid rank for ${requested.name}: ${requested.rank}/${mod.fusionLimit}`);
        }
        mods.push({ mod, rank: requested.rank });
        effects.push(mod.effectsByRank[requested.rank] ?? mod.effect);
    }
    return { effects, mods };
}

const weapon = getWeapon(WEAPON_NAME);
const scoringWeapon = withSelectedAttack(weapon, weapon.attacks.length > 0 ? 0 : -1);
const targetOverride = {
    ...TARGET,
};
const primaryBulwark = process.argv.includes("--primary-bulwark")
    ? getArcanesForWeapon(weapon).find((arcane) => arcane.name === "Primary Bulwark") ?? null
    : null;
const primaryOvercharge = process.argv.includes("--primary-overcharge")
    ? getArcanesForWeapon(weapon).find((arcane) => arcane.name === "Primary Overcharge") ?? null
    : null;
if (primaryBulwark && primaryOvercharge) {
    throw new Error("Choose one benchmark Arcane: --primary-bulwark or --primary-overcharge.");
}
const primaryArcane = primaryBulwark ?? primaryOvercharge;
const primaryArcaneContext = primaryOvercharge
    ? { warframeMaxEnergy: 1000, warframeEnergyPercent: 100 }
    : undefined;
const warframeArmor = primaryBulwark ? 1_500 : undefined;
const primaryArcaneEffect = primaryArcane
    ? getArcaneEffectAtRank(primaryArcane, primaryArcane.maxRank, warframeArmor, false, primaryArcaneContext)
    : null;
if (process.argv.includes("--reoptimize")) {
    const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon));
    const optimized = optimizeBuild(weapon, candidates, GOAL, weapon.baseSlotCount, {
        targetFaction: FACTION,
        targetProfileOverride: targetOverride,
        conditionalState: CONDITIONAL_STATE,
        allowNonMaxRank: false,
        allowCatalyst: CAPACITY_CONFIG.hasCatalyst,
        allowForma: true,
        maxFormaCount: MAX_FORMA,
        capacityConfig: CAPACITY_CONFIG,
        slotPolarities: weapon.polarities,
        defaultSlotPolarities: weapon.polarities,
        optimizeArcane: !!primaryArcane,
        arcaneCandidates: primaryArcane ? [primaryArcane] : [],
        warframeArmor,
        ...primaryArcaneContext,
        optimizeExilus: false,
        buildForAttack: weapon.attacks[0] ?? null,
    });
    REOPTIMIZED_RESULT = optimized;
    const optimizedMods = optimized.slots.flatMap((mod, index) => mod
        ? [{ name: mod.name, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
        : []);
    REOPTIMIZED_BUILD = { name: `Tenno-Hub optimizer (${CONDITIONAL_STATE.mode})`, mods: optimizedMods };
    SELECTED_BUILDS = compareSavedUnderframe
        ? [REOPTIMIZED_BUILD, BENCHMARK_BUILDS[1]]
        : compareFreshUnderframe
            ? [REOPTIMIZED_BUILD, FRESH_UNDERFRAME_BUILD]
            : [REOPTIMIZED_BUILD];
}
const target = getTargetProfileAssumptions(FACTION, targetOverride);
const reports = SELECTED_BUILDS.map((build) => {
    const { effects, mods } = makeEffects(build, weapon);
    const calculatedEffects = primaryArcaneEffect
        ? [...effects, { ...emptyEffect(), ...primaryArcaneEffect, conditionalEffects: [...(primaryArcaneEffect.conditionalEffects ?? [])] }]
        : effects;
    const ranks = mods.map(({ rank }) => rank);
    const assigned = assignBuildForCapacity(mods.map(({ mod }) => mod), ranks, weapon);
    const capacityValid = fitsWithinCapacity(
        CAPACITY_CONFIG,
        assigned.polarities,
        assigned.slots,
        assigned.ranks,
    );
    const formaCount = countPolarityChanges(weapon.polarities, assigned.polarities);
    const metrics = calculateBuild(scoringWeapon, calculatedEffects, FACTION, {
        conditionalState: CONDITIONAL_STATE,
        statusImmuneTypes: target.statusImmuneTypes,
        statusStackCaps: target.statusStackCaps,
        targetStatusState: "initial",
    });
    const finiteExpectedEncounter = debugEvaluateExpectedEncounter(
        scoringWeapon,
        effects,
        FACTION,
        targetOverride,
        CONDITIONAL_STATE,
        primaryArcaneEffect,
    );
    const encounter = finiteExpectedEncounter.encounter;

    return {
        build: build.name,
        weapon: WEAPON_NAME,
        objective: GOAL,
        target: { faction: FACTION, ...TARGET },
        mods: mods.map(({ mod, rank }) => `${mod.name} R${rank}`),
        capacity: {
            valid: capacityValid,
            used: assigned.usedCapacity,
            available: 60,
            forma: formaCount,
            formaLimit: MAX_FORMA,
            legal: capacityValid && formaCount <= MAX_FORMA,
        },
        arcane: primaryArcane
            ? {
                name: primaryArcane.name,
                rank: primaryArcane.maxRank,
                damageBonus: primaryArcaneEffect?.damageBonus ?? 0,
                multishotBonus: primaryArcaneEffect?.multishotBonus ?? 0,
            }
            : null,
        commonOptimizerScore: debugScoreBuild(scoringWeapon, effects, GOAL, FACTION, primaryArcaneEffect, targetOverride, CONDITIONAL_STATE),
        ...(build === REOPTIMIZED_BUILD && REOPTIMIZED_RESULT
            ? {
                optimizerRefinement: {
                    candidatesEvaluated: REOPTIMIZED_RESULT.encounterCandidatesEvaluated,
                    refined: REOPTIMIZED_RESULT.encounterRefined,
                },
            }
            : {}),
        finiteExpectedEncounterObjective: {
            damagePerSecond: finiteExpectedEncounter.damagePerSecond,
            timeToKillSeconds: finiteExpectedEncounter.timeToKillSeconds,
        },
        arsenalTotalPerAttack: metrics.modded.arsenalDamage,
        burstDpsBeforeTargetPools: metrics.burstDPS,
        sustainedDpsBeforeTargetPools: metrics.sustainedDPS,
        meanFiniteEncounter: encounter ? {
            attacks: encounter.attacks,
            timeToKillSeconds: encounter.timeToKillSeconds,
            damagePerSecond: encounter.damagePerSecond,
            directDamage: encounter.directDamageByPool,
            statusDamage: encounter.statusDamageByPool,
        } : null,
    };
});

const swapAnalysis = process.argv.includes("--analyze-underframe-swaps")
    ? analyzeUnderframeSwapNeighborhood()
    : null;

console.log(JSON.stringify({
    methodology: {
        target: "Explicit Grineer Heavy Gunner pools: 83,818 Health, 2,700 Armor, no Shields or Overguard.",
        objective: `Both fixed builds are evaluated with Tenno-Hub's same ${CONDITIONAL_STATE.mode}-state ${GOAL} screening score and finite expected encounter. For Expected TTK, the optimizer ranks kills inside its 600-second cap ahead of capped encounters and uses damage per second only when neither build kills; this does not equate Underframe stochastic DPS with Tenno-Hub's model.`,
        assumptions: [
            primaryBulwark
                ? `Braton Prime Normal Attack; both lists receive Primary Bulwark R5 at its +500% damage cap using 1,500 Warframe Armor (the Underframe fixture displays 500/500). No target headshot multiplier, Exilus, or external buffs are supplied${CONDITIONAL_STATE.mode === "fullyStacked" ? "; Fully stacked activates supported mod conditionals such as Galvanized Scope, without adding headshot damage." : "; non-initial mod conditionals are inactive."}`
                : primaryOvercharge
                    ? `Braton Prime Normal Attack; both lists receive Primary Overcharge R5 at the 350% multishot cap (1,000 Max Energy, 100% current Energy). No target headshot multiplier, Exilus, or external buffs are supplied${CONDITIONAL_STATE.mode === "fullyStacked" ? "; Fully stacked activates supported mod conditionals such as Galvanized Scope, without adding headshot damage." : "; non-initial mod conditionals are inactive."}`
                : `Braton Prime Normal Attack; no arcane, Exilus, external buffs, or target headshot multiplier${CONDITIONAL_STATE.mode === "fullyStacked" ? "; Fully stacked activates supported mod conditionals such as Galvanized Scope, without adding headshot damage." : "; non-initial mod conditionals are inactive."}`,
            "No explicit status immunities; the model removes Magnetic as a dead effect for a shieldless target.",
            "Three-forma feasibility is recomputed against the weapon's default polarities and 60 capacity.",
            "Fractional procs, Electricity/Gas group histories, cross-source Heat inheritance, shield gates, animation timing, and random TTK distributions remain approximations or omitted.",
        ],
        buildCapture: compareSavedUnderframe
            ? `The saved Underframe Braton Prime benchmark copy was inspected in the in-app browser on 2026-11-15; it uses Amalgam Serration, three faction Banes, and Primary Bulwark at 500/500. A five-second Luck Averaged run showed 1,529 raw + 465 DoT damage per shot and 19,461 DPS. ${primaryBulwark ? "Primary Bulwark is replayed at its +500% rank-5 cap using 1,500 Warframe Armor, corresponding to the saved 500/500 value." : primaryOvercharge ? "Primary Overcharge is replayed at its 350% rank-5 cap using 1,000 Max Energy and 100% current Energy; this differs from the saved page's displayed Primary Bulwark state." : "The Primary Arcane is omitted from the common-model replay; pass --primary-bulwark to match the saved 500/500 Bulwark state."}`
            : compareFreshUnderframe
            ? `The current Underframe eight-mod Auto Build result was captured in the in-app browser on 2026-11-12. Its native result used a five-second Luck Averaged run with Galvanized Chamber, Galvanized Aptitude, and Primary Overcharge controls at their displayed maximums; ${primaryBulwark ? "Primary Bulwark is replayed at its +500% rank-5 cap using 1,500 Warframe Armor, matching the 500/500 Underframe slider." : primaryOvercharge ? "Primary Overcharge is replayed at its 350% rank-5 cap using 1,000 Max Energy and 100% current Energy." : "the selected Primary Arcane is omitted from the common-model replay; pass --primary-bulwark or --primary-overcharge to include it."}`
            : "Tenno-Hub seven-mod optimizer result and Underframe eight-mod Auto Build output were captured in the in-app browser on 2026-11-11.",
    },
    builds: reports,
    ...(swapAnalysis ? { underframeSwapNeighborhood: swapAnalysis } : {}),
}, null, 2));

function chooseCombinations<T>(values: T[], count: number): T[][] {
    if (count < 0 || count > values.length) return [];
    const result: T[][] = [];
    const current: T[] = [];
    const visit = (start: number) => {
        if (current.length === count) {
            result.push([...current]);
            return;
        }
        for (let index = start; index <= values.length - (count - current.length); index++) {
            current.push(values[index]);
            visit(index + 1);
            current.pop();
        }
    };
    visit(0);
    return result;
}

function analyzeUnderframeSwapNeighborhood() {
    if (!REOPTIMIZED_BUILD || (!compareFreshUnderframe && !compareSavedUnderframe)) {
        throw new Error("--analyze-underframe-swaps requires an Underframe snapshot flag and --reoptimize");
    }

    const underframeNames = new Set(underframeComparisonBuild.mods.map((mod) => mod.name.toLowerCase()));
    const tennoNames = new Set(REOPTIMIZED_BUILD.mods.map((mod) => mod.name.toLowerCase()));
    const tennoOnly = REOPTIMIZED_BUILD.mods.filter((mod) => !underframeNames.has(mod.name.toLowerCase()));
    const underframeOnly = underframeComparisonBuild.mods.filter((mod) => !tennoNames.has(mod.name.toLowerCase()));
    const baseline = evaluateCandidate(REOPTIMIZED_BUILD);
    const underframeBaseline = evaluateCandidate(underframeComparisonBuild);
    const depths = [];

    for (let depth = 1; depth <= Math.min(4, tennoOnly.length, underframeOnly.length); depth++) {
        const candidates = [];
        const removalSets = chooseCombinations(tennoOnly, depth);
        const additionSets = chooseCombinations(underframeOnly, depth);
        for (const removals of removalSets) {
            for (const additions of additionSets) {
                const removedNames = new Set(removals.map((mod) => mod.name.toLowerCase()));
                const replacementSlots = REOPTIMIZED_BUILD.mods
                    .map((mod, index) => ({ mod, index }))
                    .filter(({ mod }) => removedNames.has(mod.name.toLowerCase()))
                    .map(({ index }) => index);
                // Preserve the optimizer's other slot order; incoming mods follow
                // their slot order from the captured Underframe configuration.
                const nextMods = [...REOPTIMIZED_BUILD.mods];
                for (let index = 0; index < replacementSlots.length; index++) {
                    nextMods[replacementSlots[index]] = additions[index];
                }
                const candidate = {
                    name: `${depth}-mod swap: ${removals.map((mod) => mod.name).join(" + ")} → ${additions.map((mod) => mod.name).join(" + ")}`,
                    mods: nextMods,
                };
                const evaluated = evaluateCandidate(candidate);
                if (evaluated.legal) candidates.push({ ...evaluated, removed: removals.map((mod) => mod.name), added: additions.map((mod) => mod.name) });
            }
        }
        candidates.sort(compareCandidateQuality);
        const improvements = candidates.filter((candidate) => isBetterTtk(candidate.expectedTtk, baseline.expectedTtk));
        depths.push({
            changedModCount: depth,
            combinationsChecked: removalSets.length * additionSets.length,
            legalCandidates: candidates.length,
            betterThanTennoBaseline: improvements.length,
            bestLegalCandidate: candidates[0] ?? null,
            bestImprovement: improvements[0] ?? null,
        });
    }

    return {
        objective: "The same Tenno-Hub finite expected encounter used by the optimizer; candidates are legal only if capacity, unique names, incompatibility groups, and three-Forma limits pass.",
        placement: "Each selected Underframe-only mod replaces the corresponding selected Tenno-only mod slot in order; the standard capacity placer may reassign non-element slots and Forma.",
        tennoOnly: tennoOnly.map((mod) => `${mod.name} R${mod.rank}`),
        underframeOnly: underframeOnly.map((mod) => `${mod.name} R${mod.rank}`),
        tennoBaseline: baseline,
        underframeBaseline,
        depths,
    };
}

function evaluateCandidate(build: NamedBuild) {
    const { effects, mods } = makeEffects(build, weapon);
    const assigned = assignBuildForCapacity(mods.map(({ mod }) => mod), mods.map(({ rank }) => rank), weapon);
    const formaCount = countPolarityChanges(weapon.polarities, assigned.polarities);
    const uniqueNames = mods.map(({ mod }) => (mod.uniqueName ?? mod.name).toLowerCase());
    const incompatibilityGroups = mods.map(({ mod }) => mod.incompatibilityGroup).filter((group): group is string => !!group);
    const legal = fitsWithinCapacity(CAPACITY_CONFIG, assigned.polarities, assigned.slots, assigned.ranks)
        && formaCount <= MAX_FORMA
        && new Set(uniqueNames).size === uniqueNames.length
        && new Set(incompatibilityGroups).size === incompatibilityGroups.length;
    const encounter = legal
        ? debugScoreExpectedEncounter(scoringWeapon, effects, FACTION, targetOverride, CONDITIONAL_STATE, primaryArcaneEffect)
        : { damagePerSecond: 0, timeToKillSeconds: null };
    return {
        build: build.name,
        legal,
        capacityUsed: assigned.usedCapacity,
        formaCount,
        screeningProxy: debugScoreBuild(scoringWeapon, effects, GOAL, FACTION, primaryArcaneEffect, targetOverride, CONDITIONAL_STATE),
        expectedTtk: encounter.timeToKillSeconds,
        expectedDamagePerSecond: encounter.damagePerSecond,
        orderedMods: mods.map(({ mod, rank }) => `${mod.name} R${rank}`),
    };
}

function compareCandidateQuality(
    left: { expectedTtk: number | null; expectedDamagePerSecond: number },
    right: { expectedTtk: number | null; expectedDamagePerSecond: number },
): number {
    if (left.expectedTtk !== null && right.expectedTtk !== null) return left.expectedTtk - right.expectedTtk;
    if (left.expectedTtk !== null) return -1;
    if (right.expectedTtk !== null) return 1;
    return right.expectedDamagePerSecond - left.expectedDamagePerSecond;
}

function isBetterTtk(candidate: number | null, incumbent: number | null): boolean {
    if (candidate === null) return false;
    if (incumbent === null) return true;
    return candidate < incumbent - 1e-9;
}

function assignBuildForCapacity(
    mods: ReturnType<typeof getModsForWeapon>,
    ranks: number[],
    selectedWeapon: WeaponEntry,
): { slots: (typeof mods[number] | null)[]; ranks: number[]; polarities: string[]; usedCapacity: number } {
    const slotCount = selectedWeapon.baseSlotCount;
    const defaults = [...selectedWeapon.polarities];
    while (defaults.length < slotCount) defaults.push("");
    const assignment = assignModsToSlots(mods, ranks, defaults, slotCount, true);
    const polarities = minimizePolaritiesByCapacity(
        defaults,
        assignment.slotMods,
        assignment.slotRanks,
        CAPACITY_CONFIG,
        [],
        undefined,
        MAX_FORMA,
    ).mainPolarities;
    const usedCapacity = assignment.slotMods.reduce((sum, mod, index) => mod
        ? sum + effectiveDrain(mod, polarities[index] ?? "", assignment.slotRanks[index])
        : sum, 0);
    return {
        slots: assignment.slotMods,
        ranks: assignment.slotRanks,
        polarities,
        usedCapacity,
    };
}

