import { emptyEffect, getModsForWeapon, filterBuilderExpertVariants, type ModEffect } from "../src/domain/catalog/modCatalog";
import {
    assignModsToSlots,
    debugScoreBuild,
    getTargetProfileAssumptions,
    minimizePolaritiesByCapacity,
    type OptimizeGoal,
} from "../src/domain/logic/buildOptimizerCore";
import { calculateBuild, type ConditionalState } from "../src/domain/logic/damageCalc";
import { getWeaponCatalog, type WeaponEntry } from "../src/domain/catalog/weaponCatalog";
import { getArcanesForWeapon } from "../src/domain/catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../src/domain/logic/arcaneEffects";
import { countPolarityChanges, effectiveDrain, fitsWithinCapacity, type CapacityConfig } from "../src/domain/logic/capacityCalc";
import { simulateExpectedWeaponEncounter } from "../src/domain/logic/targetDamage";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";
import type { StatusDamageType } from "../src/domain/logic/damageRuleset";

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
let SELECTED_BUILDS = process.argv.includes("--fresh-underframe")
    ? [BENCHMARK_BUILDS[0], FRESH_UNDERFRAME_BUILD]
    : BENCHMARK_BUILDS;

const WEAPON_NAME = "Braton Prime";
const GOAL: OptimizeGoal = "burst";
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
const targetOverride = {
    ...TARGET,
};
const primaryOvercharge = process.argv.includes("--primary-overcharge")
    ? getArcanesForWeapon(weapon).find((arcane) => arcane.name === "Primary Overcharge") ?? null
    : null;
const primaryOverchargeContext = primaryOvercharge
    ? { warframeMaxEnergy: 1000, warframeEnergyPercent: 100 }
    : undefined;
const primaryOverchargeEffect = primaryOvercharge
    ? getArcaneEffectAtRank(primaryOvercharge, primaryOvercharge.maxRank, undefined, false, primaryOverchargeContext)
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
        optimizeArcane: !!primaryOvercharge,
        arcaneCandidates: primaryOvercharge ? [primaryOvercharge] : [],
        ...primaryOverchargeContext,
        optimizeExilus: false,
        buildForAttack: weapon.attacks[0] ?? null,
    });
    const optimizedMods = optimized.slots.flatMap((mod, index) => mod
        ? [{ name: mod.name, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
        : []);
    SELECTED_BUILDS = process.argv.includes("--fresh-underframe")
        ? [{ name: `Tenno-Hub optimizer (${CONDITIONAL_STATE.mode})`, mods: optimizedMods }, FRESH_UNDERFRAME_BUILD]
        : [{ name: `Tenno-Hub optimizer (${CONDITIONAL_STATE.mode})`, mods: optimizedMods }];
}
const target = getTargetProfileAssumptions(FACTION, targetOverride);
const reports = SELECTED_BUILDS.map((build) => {
    const { effects, mods } = makeEffects(build, weapon);
    const calculatedEffects = primaryOverchargeEffect
        ? [...effects, { ...emptyEffect(), ...primaryOverchargeEffect, conditionalEffects: [...(primaryOverchargeEffect.conditionalEffects ?? [])] }]
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
    const metrics = calculateBuild(weapon, calculatedEffects, FACTION, {
        conditionalState: CONDITIONAL_STATE,
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
        factionDamageBonus,
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
                const applications = metrics.modded.averageProcsPerShot *
                    (metrics.modded.procChanceByType[type as keyof typeof metrics.modded.procChanceByType] ?? 0);
                return applications > 0 ? [[type, damage / applications]] : [];
            }),
        ),
        statusProcWeightsByType: metrics.modded.damageBreakdown,
        statusRollsPerAttack: metrics.modded.multishot * metrics.modded.statusChance,
        forcedStatusApplicationsPerAttackByType: metrics.modded.unfilteredExtraProcsPerShot as Partial<Record<StatusDamageType, number>>,
        statusImmuneTypes: target.statusImmuneTypes,
        statusStackCaps: target.statusStackCaps,
        blastStackHitDamagePerProc: metrics.modded.blastStackHitDamagePerProc,
        directDamagePerStatusBonus: metrics.modded.directDamagePerStatusBonus,
        totalDamageBonus: metrics.modded.totalDamageBonus,
    });

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
        arcane: primaryOvercharge
            ? { name: primaryOvercharge.name, rank: primaryOvercharge.maxRank, multishotBonus: primaryOverchargeEffect?.multishotBonus ?? 0 }
            : null,
        commonOptimizerScore: debugScoreBuild(weapon, effects, GOAL, FACTION, primaryOverchargeEffect, targetOverride, CONDITIONAL_STATE),
        arsenalTotalPerAttack: metrics.modded.arsenalDamage,
        burstDpsBeforeTargetPools: metrics.burstDPS,
        sustainedDpsBeforeTargetPools: metrics.sustainedDPS,
        meanFiniteEncounter: {
            attacks: encounter.attacks,
            timeToKillSeconds: encounter.timeToKillSeconds,
            damagePerSecond: encounter.damagePerSecond,
            directDamage: encounter.directDamageByPool,
            statusDamage: encounter.statusDamageByPool,
        },
    };
});

console.log(JSON.stringify({
    methodology: {
        target: "Level-100 Heavy Gunner current pools copied from the Tenno-Hub planner comparison: 83,818 Health, 2,700 Armor, no Shields or Overguard.",
        objective: `Both fixed builds are evaluated with Tenno-Hub's same ${CONDITIONAL_STATE.mode}-state Burst score and finite expected encounter simulator; this does not equate the Underframe stochastic DPS number with Tenno-Hub's proxy score.`,
        assumptions: [
            primaryOvercharge
                ? "Braton Prime normal attack; both lists receive Primary Overcharge R5 at the 350% multishot cap (1,000 Max Energy, 100% current Energy), with no Exilus, external buffs, or headshots."
                : "Braton Prime normal attack; no arcane, Exilus, external buffs, headshots, or non-initial conditional stacks.",
            "No explicit status immunities; the model removes Magnetic as a dead effect for a shieldless target.",
            "Three-forma feasibility is recomputed against the weapon's default polarities and 60 capacity.",
            "Fractional procs, Electricity/Gas group histories, cross-source Heat inheritance, shield gates, animation timing, and random TTK distributions remain approximations or omitted.",
        ],
        buildCapture: process.argv.includes("--fresh-underframe")
            ? `The current Underframe eight-mod Auto Build result was captured in the in-app browser on 2026-11-12. Its native result used a five-second Luck Averaged run with Galvanized Chamber, Galvanized Aptitude, and Primary Overcharge controls at their displayed maximums; ${primaryOvercharge ? "Primary Overcharge is replayed at its 350% rank-5 cap using 1,000 Max Energy and 100% current Energy." : "Primary Overcharge is omitted from the common-model replay; pass --primary-overcharge to compare its cap-equivalent assumption."}`
            : "Tenno-Hub seven-mod optimizer result and Underframe eight-mod Auto Build output were captured in the in-app browser on 2026-11-11.",
    },
    builds: reports,
}, null, 2));

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
