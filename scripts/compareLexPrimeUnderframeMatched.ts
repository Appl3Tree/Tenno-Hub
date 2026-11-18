Warning: truncated output (original token count: 2016)
Total output lines: 176

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

const WEAPON_NAME = "Lex Prime";
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
    { name: "Ice Storm", rank: 3 },
    { name: "Pistol Pestilence", rank: 3 },
    { name: "Primed Heated Charge", rank: 10 },
    { name: "Galvanized Shot", rank: 10 },
    { name: "Galvanized Diffusion", rank: 10 },
    { name: "Anemic Agility", rank: 5 },
    { name: "Lethal Torrent", rank: 5 },
    { name: "Frostbite", rank: 3 },
];

const catalogWeapon = getWeaponCatalog().find((entry) => entry.name.toLowerCase() === WEAPON_NAME.toLowerCase());
if (!catalogWeapon) throw new Error("Weapon missing from catalog: " + WEAPON_NAME);
const weapon = withSelectedAttack(catalogWeapon, 0);
if (weapon.attacks[0]?.name !== "Normal Attack") throw new Error("Lex Prime Normal Attack row changed.");
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
        && formaCount <= MAX_F…16 tokens truncated…
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
    return {
        mods: entries.map(({ mod, rank }) => mod.name + " R" + rank),
        legalUnderTennoHubCapacityPlan: recordedCapacityPlan ?? capacityPlan(entries),
        fastScreeningProxyScore: debugScoreBuild(weapon, effects, GOAL, FACTION, null, TARGET, state),
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
        category: "Secondary",
        attack: weapon.attacks[0]?.name ?? "base attack",
        faction: FACTION,
        target: TARGET,
        objective: "Expected TTK",
        constraints: "Eight normal slots, Catalyst, max-rank mods, up to three Forma, Exilus off, Arcanes off, no external buffs/statuses, no headshots, Realistic state.",
        modelBoundary: "Both captured Underframe and Tenno-Hub builds are scored by Tenno-Hub's same single-target finite Expected TTK model. The Expected TTK optimizer's fast screening proxy is reported separately and is not the final comparison score. Underframe's native calculator is a separate model; similar DPS/TTK values do not establish parity.",
    },
    underframe: {
        runs: 3,
        selectedModsIdenticalAcrossRuns: true,
        mods: UNDERFRAME_MODS.map(({ name, rank }) => `${name} R${rank}`),
        observedCapacityAfterAutoPolarize: "1 / 60",
        observedFormaCountAfterAutoPolarize: 3,
        repeatLuckAveragedNativeResult: "57,433 DPS / 1.75 s in all three runs",
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

