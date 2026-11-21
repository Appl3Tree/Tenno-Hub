import { filterBuilderExpertVariants, getModsForWeapon, type ModEntry } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog } from "../src/domain/catalog/weaponCatalog";
import { withSelectedAttack } from "../src/domain/catalog/weaponRules";
import {
    assignModsToSlots,
    debugEvaluateExpectedEncounter,
    debugScoreBuild,
    minimizePolaritiesByCapacity,
} from "../src/domain/logic/buildOptimizerCore";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";
import { countPolarityChanges, effectiveDrain, fitsWithinCapacity } from "../src/domain/logic/capacityCalc";
import type { ConditionalState } from "../src/domain/logic/damageCalc";
import { calculateBuildForExpectedEncounter } from "../src/domain/logic/damageCalc";

const WEAPON_NAME = "Broken War";
const FACTION = "Grineer";
const GOAL = "timeToKill" as const;
const TARGET = {
    description: "Grineer custom target: 100,000 Health / 3,000 Armor",
    health: 100_000,
    shields: 0,
    overguard: 0,
    armor: 3_000,
    toxinBypassesShields: true,
};
const INITIAL: ConditionalState = { mode: "initial" };
const REALISTIC: ConditionalState = { mode: "realistic" };
const MAX_FORMA = 3;
const CAPACITY_CONFIG = {
    weaponRank: 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: false,
};
const UNDERFRAME_MODS = [
    { name: "Primed Fever Strike", rank: 10 },
    { name: "Primed Pressure Point", rank: 10 },
    { name: "Voltaic Strike", rank: 3 },
    { name: "Galvanized Steel", rank: 10 },
    { name: "Condition Overload", rank: 5 },
    { name: "Berserker Fury", rank: 5 },
    { name: "Primed Smite Grineer", rank: 10 },
    { name: "Volcanic Edge", rank: 3 },
];

const catalogWeapon = getWeaponCatalog().find((entry) => entry.name.toLowerCase() === WEAPON_NAME.toLowerCase());
if (!catalogWeapon) throw new Error("Weapon missing from catalog: " + WEAPON_NAME);
const weapon = withSelectedAttack(catalogWeapon, 0);
if (weapon.attacks[0]?.name !== "Normal Attack") throw new Error("Broken War Normal Attack row changed.");
const pool = filterBuilderExpertVariants(getModsForWeapon(weapon));

function resolveBuild(requests: Array<{ name: string; rank: number }>) {
    const entries = requests.map(({ name, rank }) => {
        const variants = pool.filter((entry) => entry.name.toLowerCase() === name.toLowerCase());
        const mod = variants.find((entry) => !/\/(Beginner|Intermediate|Expert)\//i.test(entry.path)
            && !/(Beginner|Intermediate|Expert)$/i.test(entry.path)) ?? variants[0];
        if (!mod) throw new Error("Compatible mod missing: " + name);
        if (rank < 0 || rank > mod.fusionLimit) throw new Error("Invalid rank: " + name + " R" + rank);
        return { mod, rank };
    });
    return {
        entries,
        effects: entries.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
    };
}

function capacityPlan(entries: Array<{ mod: ModEntry; rank: number }>) {
    const slotCount = weapon.baseSlotCount;
    const defaults = [...weapon.polarities];
    while (defaults.length < slotCount) defaults.push("");
    const assigned = assignModsToSlots(entries.map(({ mod }) => mod), entries.map(({ rank }) => rank), defaults, slotCount, true);
    const polarityPlan = minimizePolaritiesByCapacity(
        defaults,
        assigned.slotMods,
        assigned.slotRanks,
        CAPACITY_CONFIG,
        [],
        undefined,
        MAX_FORMA,
    );
    const usedCapacity = assigned.slotMods.reduce((sum, mod, index) => mod
        ? sum + effectiveDrain(mod, polarityPlan.mainPolarities[index] ?? "", assigned.slotRanks[index])
        : sum, 0);
    const formaCount = countPolarityChanges(weapon.polarities, polarityPlan.mainPolarities);
    const uniqueNames = entries.map(({ mod }) => (mod.uniqueName ?? mod.name).toLowerCase());
    const incompatibilityGroups = entries.map(({ mod }) => mod.incompatibilityGroup).filter((group): group is string => !!group);
    const legal = fitsWithinCapacity(CAPACITY_CONFIG, polarityPlan.mainPolarities, assigned.slotMods, assigned.slotRanks)
        && formaCount <= MAX_FORMA
        && new Set(uniqueNames).size === uniqueNames.length
        && new Set(incompatibilityGroups).size === incompatibilityGroups.length;
    return { legal, usedCapacity, formaCount, polarities: polarityPlan.mainPolarities };
}

function score(
    requests: Array<{ name: string; rank: number }>,
    state: ConditionalState,
    recordedCapacityPlan?: ReturnType<typeof capacityPlan>,
) {
    const { effects, entries } = resolveBuild(requests);
    const encounter = debugEvaluateExpectedEncounter(weapon, effects, FACTION, TARGET, state);
    const calculated = calculateBuildForExpectedEncounter(weapon, effects, FACTION, {
        conditionalState: state,
    });
    return {
        mods: entries.map(({ mod, rank }) => mod.name + " R" + rank),
        legalUnderTennoHubCapacityPlan: recordedCapacityPlan ?? capacityPlan(entries),
        fastScreeningProxyScore: debugScoreBuild(weapon, effects, GOAL, FACTION, null, TARGET, state),
        modelStats: {
            baseDamage: weapon.damage,
            baseFireRate: weapon.fireRate,
            baseCritChance: weapon.critChance,
            baseStatusChance: weapon.statusChance,
            totalDamageBonus: calculated.modded.totalDamageBonus,
            damageByTypeBeforeTarget: calculated.modded.damageBreakdownBeforePerStatus,
            totalDamageBeforeTarget: calculated.modded.totalDamage,
            averageShotDamageBeforeTarget: calculated.modded.averageShotDamage,
            fireRate: calculated.modded.fireRate,
            multishot: calculated.modded.multishot,
            statusChance: calculated.modded.statusChance,
            statusRollsPerAttack: calculated.modded.multishot * calculated.modded.statusChance,
            procChanceByType: calculated.modded.procChanceByType,
            averageProcsPerShot: calculated.modded.averageProcsPerShot,
            meleeComboMultiplier: calculated.modded.meleeComboMultiplier,
        },
        expectedEncounter: {
            finiteExpectedTTK: encounter.timeToKillSeconds,
            expectedEncounterDPS: encounter.damagePerSecond,
            attacks: encounter.encounter?.attacks ?? null,
        },
    };
}

const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon));
const optimized = optimizeBuild(weapon, candidates, GOAL, weapon.baseSlotCount, {
    targetFaction: FACTION,
    targetProfileOverride: TARGET,
    conditionalState: REALISTIC,
    allowNonMaxRank: false,
    allowCatalyst: true,
    allowForma: true,
    maxFormaCount: MAX_FORMA,
    capacityConfig: CAPACITY_CONFIG,
    slotPolarities: weapon.polarities,
    defaultSlotPolarities: weapon.polarities,
    optimizeArcane: false,
    arcaneCandidates: [],
    optimizeExilus: false,
    buildForAttack: weapon.attacks[0] ?? null,
});
const optimizedMods = optimized.slots.flatMap((mod, index) => mod
    ? [{ name: mod.name, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
    : []);
const optimizedUsedCapacity = optimized.slots.reduce((sum, mod, index) => mod
    ? sum + effectiveDrain(mod, optimized.slotPolarities[index] ?? "", optimized.slotRanks[index])
    : sum, 0);
const optimizedFormaCount = countPolarityChanges(weapon.polarities, optimized.slotPolarities);
const optimizedCapacityPlan = {
    legal: optimized.capacityValid && optimizedFormaCount <= MAX_FORMA,
    usedCapacity: optimizedUsedCapacity,
    formaCount: optimizedFormaCount,
    polarities: optimized.slotPolarities,
};

console.log(JSON.stringify({
    method: {
        weapon: WEAPON_NAME,
        category: weapon.category,
        attack: weapon.attacks[0]?.name ?? "base attack",
        underframeStanceCombo: "Lone Vengeance (Forward)",
        underframeInitialCombo: 0,
        faction: FACTION,
        target: TARGET,
        objective: "Expected TTK",
        underframeAutoBuildObjective: "Luck Averaged was enabled, but Underframe's internal Auto Build ranking function was not independently confirmed to be finite Expected TTK. The paired builds are rescored with the same Tenno-Hub Expected TTK model; this does not establish native search-objective parity.",
        constraints: "Eight normal slots, Catalyst, max-rank mods, up to three Forma, Exilus off, Arcanes off, no external buffs/statuses, no headshots, zero initial combo, Realistic state in the shared model.",
        modelBoundary: "Both lists are rescored with Tenno-Hub's single-target finite Expected TTK engine. The melee row is a generic Normal Attack: this scorer does not simulate Underframe's Lone Vengeance stance hit sequence or evolve combo from attack to attack. Underframe's native calculator uses a separate simulator, so its DPS/TTK is recorded as UI evidence and not directly compared to the shared-model scores.",
    },
    underframe: {
        runs: 1,
        selectedModsIdenticalAcrossRuns: null,
        mods: UNDERFRAME_MODS.map(({ name, rank }) => `${name} R${rank}`),
        observedCapacityAfterAutoPolarize: "5 / 60",
        observedFormaCountAfterAutoPolarize: 2,
        selectedStanceCombo: "Lone Vengeance (Forward)",
        initialCombo: 0,
        nativeStandardNormalAttackResult: "57,385 DPS / 1.74 s (one five-second sample)",
        nativeLuckAveragedNormalAttackResult: "45,286 DPS / 2.30 s (one five-second sample)",
        fixedBuild: {
            initialState: score(UNDERFRAME_MODS, INITIAL),
            realisticState: score(UNDERFRAME_MODS, REALISTIC),
        },
    },
    tennoHubOptimizer: {
        mods: optimizedMods.map(({ name, rank }) => `${name} R${rank}`),
        capacityValid: optimized.capacityValid,
        usedCapacity: optimizedUsedCapacity,
        formaCount: optimizedFormaCount,
        candidatesEvaluated: optimized.encounterCandidatesEvaluated,
        refined: optimized.encounterRefined,
        evaluation: score(optimizedMods, REALISTIC, optimizedCapacityPlan),
    },
}, null, 2));
