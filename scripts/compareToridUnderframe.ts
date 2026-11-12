import { filterBuilderExpertVariants, getModsForWeapon, type ModEffect, type ModEntry } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog } from "../src/domain/catalog/weaponCatalog";
import { withSelectedAttack } from "../src/domain/catalog/weaponRules";
import { countPolarityChanges, effectiveDrain } from "../src/domain/logic/capacityCalc";
import { getTargetProfileAssumptions, debugScoreBuild, type TargetProfileOverride } from "../src/domain/logic/buildOptimizerCore";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";
import { calculateBuild, type ConditionalState } from "../src/domain/logic/damageCalc";
import { simulateExpectedWeaponEncounter } from "../src/domain/logic/targetDamage";

const WEAPON_NAME = "Torid";
const FACTION = "Corpus";
const GOAL = "scaling" as const;
const TARGET: TargetProfileOverride = {
    description: "Underframe Torid parity QA capture: level-1 Corpus Crewman pools",
    health: 7200,
    shields: 10800,
    overguard: 0,
    armor: 0,
    toxinBypassesShields: true,
};
const CONDITIONAL_STATE: ConditionalState = { mode: "initial" };
const OPTIMIZER_CONDITIONAL_STATE: ConditionalState = { mode: "realistic" };
const FORMA_LIMIT = 3;
const CATALYST = true;
const CAPACITY_CONFIG = {
    weaponRank: 30,
    hasCatalyst: CATALYST,
    masteryRank: 0,
    canOverLevel: false,
};

const UNDERFRAME_MODS = [
    { name: "Malignant Force", rank: 3 },
    { name: "Vile Acceleration", rank: 5 },
    { name: "Hammer Shot", rank: 3 },
    { name: "Primed Bane of Corpus", rank: 10 },
    { name: "Rifle Aptitude", rank: 5 },
    { name: "Rifle Elementalist", rank: 5 },
    { name: "Continuous Misery", rank: 3 },
    { name: "Speed Trigger", rank: 5 },
];
const UNDERFRAME_NATIVE_SAMPLES = [
    { averageDps: 1377, timeToKill: ">5s" as const },
    { averageDps: 1577, timeToKill: 4.57 },
    { averageDps: 2374, timeToKill: 3.03 },
    { averageDps: 2374, timeToKill: 3.03 },
    { averageDps: 1577, timeToKill: 4.57 },
];

function summarizeSamples(values: number[]) {
    const ordered = [...values].sort((left, right) => left - right);
    return {
        mean: values.reduce((sum, value) => sum + value, 0) / values.length,
        median: ordered[Math.floor(ordered.length / 2)],
        range: [ordered[0], ordered[ordered.length - 1]],
    };
}

function getMod(name: string, candidates: ModEntry[]): ModEntry {
    const variants = candidates.filter((mod) => mod.name.toLowerCase() === name.toLowerCase());
    const mod = variants.find((entry) => !/\/(Beginner|Intermediate|Expert)\//i.test(entry.path)
        && !/(Beginner|Intermediate|Expert)$/i.test(entry.path)) ?? variants[0];
    if (!mod) throw new Error(`Compatible mod missing from Torid candidate pool: ${name}`);
    return mod;
}

function resolveMods(
    entries: Array<{ name: string; rank: number }>,
    candidates: ModEntry[],
): { mods: ModEntry[]; ranks: number[]; effects: ModEffect[] } {
    const mods = entries.map(({ name }) => getMod(name, candidates));
    const ranks = entries.map(({ rank }, index) => {
        if (rank < 0 || rank > mods[index].fusionLimit) {
            throw new Error(`Invalid rank for ${mods[index].name}: ${rank}/${mods[index].fusionLimit}`);
        }
        return rank;
    });
    const effects = mods.map((mod, index) => mod.effectsByRank[ranks[index]] ?? mod.effect);
    return { mods, ranks, effects };
}

function countForma(weapon: ReturnType<typeof withSelectedAttack>, polarities: string[]): number {
    const defaults = [...weapon.polarities];
    while (defaults.length < polarities.length) defaults.push("");
    return countPolarityChanges(defaults, polarities);
}

function evaluate(
    name: string,
    entries: Array<{ name: string; rank: number }>,
    weapon: ReturnType<typeof withSelectedAttack>,
    candidates: ModEntry[],
    conditionalState: ConditionalState = CONDITIONAL_STATE,
) {
    const { mods, ranks, effects } = resolveMods(entries, candidates);
    const target = getTargetProfileAssumptions(FACTION, TARGET);
    const metrics = calculateBuild(weapon, effects, FACTION, {
        conditionalState,
        statusImmuneTypes: target.statusImmuneTypes,
        statusStackCaps: target.statusStackCaps,
        targetStatusState: "initial",
    });
    const factionDamageBonus = effects.reduce((sum, effect) =>
        sum + (effect.targetFaction?.toLowerCase() === FACTION.toLowerCase() ? effect.factionDamageBonus : 0), 0);
    const encounter = simulateExpectedWeaponEncounter({
        damageByType: metrics.modded.damageBreakdown,
        health: target.health,
        shields: target.shields,
        overguard: target.overguard,
        armor: target.armor,
        faction: FACTION,
        toxinBypassesShields: target.toxinBypassesShields,
        critChance: metrics.modded.critChance,
        critMultiplier: metrics.modded.critMultiplier,
        expectedProjectiles: metrics.modded.multishot,
        attackIntervalSeconds: 1 / Math.max(0.0001, metrics.modded.fireRate),
        shotsPerMagazine: metrics.modded.shotsPerMag,
        reloadDurationSeconds: metrics.modded.reloadTime,
        statusDurationMultiplier: metrics.modded.statusDurationMultiplier,
        dotDamagePerAttackByType: metrics.modded.dotDamagePerShotByType,
        dotDamagePerApplicationByType: Object.fromEntries(
            Object.entries(metrics.modded.dotDamagePerShotByType).flatMap(([type, damage]) => {
                const applications = metrics.modded.averageProcsPerShot
                    * (metrics.modded.procChanceByType[type as keyof typeof metrics.modded.procChanceByType] ?? 0);
                return applications > 0 ? [[type, damage / applications]] : [];
            }),
        ),
        statusProcWeightsByType: metrics.modded.damageBreakdown,
        factionDamageBonus,
        statusRollsPerAttack: metrics.modded.multishot * metrics.modded.statusChance,
        forcedStatusApplicationsPerAttackByType: metrics.modded.unfilteredExtraProcsPerShot,
        statusImmuneTypes: target.statusImmuneTypes,
        statusStackCaps: target.statusStackCaps,
        blastStackHitDamagePerProc: metrics.modded.blastStackHitDamagePerProc,
        directDamagePerStatusBonus: metrics.modded.directDamagePerStatusBonus,
        totalDamageBonus: metrics.modded.totalDamageBonus,
    });
    return {
        name,
        mods: mods.map((mod, index) => `${mod.name} R${ranks[index]}`),
        conditionalState,
        commonScalingScore: debugScoreBuild(weapon, effects, GOAL, FACTION, null, TARGET, conditionalState),
        arsenalDamagePerAttack: metrics.modded.arsenalDamage,
        burstDpsBeforeTargetPools: metrics.burstDPS,
        expectedEncounter: {
            attacks: encounter.attacks,
            timeToKillSeconds: encounter.timeToKillSeconds,
            damagePerSecond: encounter.damagePerSecond,
            directDamageByPool: encounter.directDamageByPool,
            statusDamageByPool: encounter.statusDamageByPool,
        },
    };
}

const catalogWeapon = getWeaponCatalog().find((entry) => entry.name.toLowerCase() === WEAPON_NAME.toLowerCase());
if (!catalogWeapon) throw new Error(`Weapon missing from catalog: ${WEAPON_NAME}`);
const weapon = withSelectedAttack(catalogWeapon, 0);
const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon));
const optimizerResult = optimizeBuild(weapon, candidates, GOAL, weapon.baseSlotCount, {
    targetFaction: FACTION,
    targetProfileOverride: TARGET,
    conditionalState: OPTIMIZER_CONDITIONAL_STATE,
    allowNonMaxRank: false,
    allowCatalyst: CATALYST,
    allowForma: true,
    maxFormaCount: FORMA_LIMIT,
    capacityConfig: CAPACITY_CONFIG,
    slotPolarities: weapon.polarities,
    defaultSlotPolarities: weapon.polarities,
    optimizeArcane: false,
    optimizeExilus: false,
    buildForAttack: weapon.attacks[0] ?? null,
});
const optimizerMods = optimizerResult.slots.flatMap((mod, index) => mod
    ? [{ name: mod.name, rank: optimizerResult.slotRanks[index] ?? mod.fusionLimit }]
    : []);

const underframe = evaluate("Saved Underframe Torid parity QA", UNDERFRAME_MODS, weapon, candidates);
const tennoHub = evaluate("Tenno-Hub optimized build replayed in Initial state", optimizerMods, weapon, candidates);
const optimizerBuild = evaluate(
    "Tenno-Hub Scaling optimizer build in Realistic state",
    optimizerMods,
    weapon,
    candidates,
    OPTIMIZER_CONDITIONAL_STATE,
);

console.log(JSON.stringify({
    methodology: {
        weapon: `${WEAPON_NAME}, first attack (${weapon.attacks[0]?.name ?? "base attack"})`,
        objective: `Both fixed mod lists scored as ${GOAL} with identical target and initial conditional state.`,
        optimizerConditionalState: OPTIMIZER_CONDITIONAL_STATE,
        target: { faction: FACTION, level: 1, ...TARGET },
        constraints: { catalyst: CATALYST, maxForma: FORMA_LIMIT, exilus: false, arcane: false },
        sourceCapture: "Underframe in-app browser saved build; eight listed ranks, Corpus Crewman level 1, 7200 Health, 10800 Shields, 0 Armor/Overguard, five-second simulator.",
        limits: [
            "Underframe's saved page is labeled parity QA; it is not documented as an Auto Build result.",
            "The common score and finite encounter are Tenno-Hub's expected-value model, not Underframe's stochastic output.",
            "The underlying Underframe damage engine is private, so its result cannot be reproduced outside the live UI.",
        ],
    },
    underframeSavedCapacity: { used: 58, max: 60, formaCount: 3 },
    underframe,
    tennoHub,
    optimizerResult: {
        mods: optimizerMods.map(({ name, rank }) => `${name} R${rank}`),
        score: debugScoreBuild(
            weapon,
            optimizerResult.slots.flatMap((mod, index) => {
                if (!mod) return [];
                const rank = optimizerResult.slotRanks[index] ?? mod.fusionLimit;
                return [mod.effectsByRank[rank] ?? mod.effect];
            }),
            GOAL,
            FACTION,
            null,
            TARGET,
            OPTIMIZER_CONDITIONAL_STATE,
        ),
        capacityValid: optimizerResult.capacityValid,
        usedCapacity: optimizerResult.slots.reduce((sum, mod, index) => mod
            ? sum + effectiveDrain(mod, optimizerResult.slotPolarities[index] ?? "", optimizerResult.slotRanks[index])
            : sum, 0),
        maxCapacity: 60,
        formaCount: countForma(weapon, optimizerResult.slotPolarities),
        realisticStateEvaluation: optimizerBuild,
    },
    nativeUnderframeCapture: {
        repetitions: UNDERFRAME_NATIVE_SAMPLES.length,
        simulationSeconds: 5,
        arcane: false,
        luckAverage: {
            averageDamagePerShot: { raw: 286, dot: 586 },
            averageDps: 1830,
            timeToKill: "?",
        },
        samples: UNDERFRAME_NATIVE_SAMPLES,
        averageDps: summarizeSamples(UNDERFRAME_NATIVE_SAMPLES.map((sample) => sample.averageDps)),
        timeToKillSeconds: {
            median: 4.57,
            observedRange: [3.03, ">5s"],
            rightCensoredCount: UNDERFRAME_NATIVE_SAMPLES.filter((sample) => sample.timeToKill === ">5s").length,
            note: "One run did not kill within the five-second simulation window; it is retained as a right-censored observation.",
        },
    },
}, null, 2));
