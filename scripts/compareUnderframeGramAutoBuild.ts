import { filterBuilderExpertVariants, getModsForWeapon, getStancesForWeapon } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import {
    assignModsToSlots,
    debugEvaluateExpectedEncounter,
} from "../src/domain/logic/buildOptimizerCore";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";
import type { ConditionalState } from "../src/domain/logic/damageCalc";
import {
    countPolarityChanges,
    effectiveDrain,
    fitsWithinCapacity,
    totalModCapacity,
    type CapacityConfig,
} from "../src/domain/logic/capacityCalc";

const WEAPON_NAME = "Gram Prime";
const ATTACK_NAME = "Normal Attack";
const FACTION = "Grineer";
const TARGET = {
    description: "Grineer custom target: 100,000 Health / 3,000 Armor",
    health: 100_000,
    shields: 0,
    overguard: 0,
    armor: 3_000,
    toxinBypassesShields: true,
};
const CONDITIONAL_STATE: ConditionalState = { mode: "initial" };
const MAX_FORMA = 3;
const CAPACITY_CONFIG: CapacityConfig = {
    weaponRank: 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: false,
};
const CAPTURED_MODS = [
    { name: "Volcanic Edge", rank: 3 },
    { name: "Galvanized Steel", rank: 10 },
    { name: "Primed Smite Grineer", rank: 10 },
    { name: "Primed Pressure Point", rank: 10 },
    { name: "Berserker Fury", rank: 5 },
    { name: "Galvanized Elementalist", rank: 10 },
    { name: "Molten Impact", rank: 5 },
    { name: "Condition Overload", rank: 5 },
];

const catalogWeapon = getWeaponCatalog().find((entry) => entry.name === WEAPON_NAME);
if (!catalogWeapon) throw new Error("Weapon missing from catalog: " + WEAPON_NAME);
const attackIndex = catalogWeapon.attacks.findIndex((attack) => attack.name === ATTACK_NAME);
if (attackIndex < 0) throw new Error("Gram Prime Normal Attack is missing from the catalog.");
const weapon = withSelectedAttack(catalogWeapon, attackIndex);
const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon));
const stance = getStancesForWeapon(weapon).find((entry) => entry.name === "Rending Crane");
if (!stance) throw new Error("Rending Crane was not found in the stance catalog.");
const stanceSlot = {
    mod: stance,
    rank: stance.fusionLimit,
    polarity: weapon.stancePolarity ?? stance.polarity ?? "",
};

function resolveMods(requests: typeof CAPTURED_MODS) {
    return requests.map(({ name, rank }) => {
        const variants = candidates.filter((entry) => entry.name.toLowerCase() === name.toLowerCase());
        const mod = variants.find((entry) => !/\/(Beginner|Intermediate|Expert)\//i.test(entry.path)
            && !/(Beginner|Intermediate|Expert)$/i.test(entry.path)) ?? variants[0];
        if (!mod) throw new Error("Compatible mod missing: " + name);
        if (rank < 0 || rank > mod.fusionLimit) throw new Error("Invalid rank for " + name + ": " + rank);
        return { mod, rank, effect: mod.effectsByRank[rank] ?? mod.effect };
    });
}

function evaluateCapturedBuild(name: string, requests: typeof CAPTURED_MODS) {
    const resolved = resolveMods(requests);
    const placement = assignModsToSlots(
        resolved.map(({ mod }) => mod),
        resolved.map(({ rank }) => rank),
        weapon.polarities,
        weapon.baseSlotCount,
        true,
        MAX_FORMA,
    );
    const usedCapacity = placement.slotMods.reduce((sum, mod, index) => mod
        ? sum + effectiveDrain(mod, placement.resultPolarities[index] ?? "", placement.slotRanks[index])
        : sum, 0) + effectiveDrain(stanceSlot.mod, stanceSlot.polarity, stanceSlot.rank);
    const formaCount = countPolarityChanges(weapon.polarities, placement.resultPolarities);
    const legal = fitsWithinCapacity(
        CAPACITY_CONFIG,
        placement.resultPolarities,
        placement.slotMods,
        placement.slotRanks,
        [stanceSlot],
    ) && formaCount <= MAX_FORMA;
    const encounter = debugEvaluateExpectedEncounter(
        weapon,
        resolved.map(({ effect }) => effect),
        FACTION,
        TARGET,
        CONDITIONAL_STATE,
    );
    return {
        name,
        mods: resolved.map(({ mod, rank }) => mod.name + " R" + rank),
        capacity: {
            legal,
            used: usedCapacity,
            available: totalModCapacity(CAPACITY_CONFIG),
            forma: formaCount,
            formaLimit: MAX_FORMA,
        },
        commonModel: {
            objective: "finite Expected TTK",
            expectedTtkSeconds: encounter.timeToKillSeconds,
            expectedDamagePerSecond: encounter.damagePerSecond,
            attacks: encounter.encounter?.attacks ?? null,
        },
    };
}

const captured = evaluateCapturedBuild("Underframe Auto Build capture after Auto Polarize", CAPTURED_MODS);
const optimized = optimizeBuild(weapon, candidates, "timeToKill", weapon.baseSlotCount, {
    targetFaction: FACTION,
    targetProfileOverride: TARGET,
    conditionalState: CONDITIONAL_STATE,
    allowNonMaxRank: false,
    allowCatalyst: true,
    allowForma: true,
    maxFormaCount: MAX_FORMA,
    capacityConfig: CAPACITY_CONFIG,
    slotPolarities: weapon.polarities,
    defaultSlotPolarities: weapon.polarities,
    optimizeArcane: false,
    optimizeExilus: false,
    buildForAttack: weapon.attacks[attackIndex],
    extraCapacitySlots: [stanceSlot],
});
const optimizedMods = optimized.slots.flatMap((mod, index) => mod
    ? [{ mod, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
    : []);
const optimizedUsedCapacity = optimizedMods.reduce((sum, { mod, rank }, index) =>
    sum + effectiveDrain(mod, optimized.slotPolarities[index] ?? "", rank), 0)
    + effectiveDrain(stanceSlot.mod, stanceSlot.polarity, stanceSlot.rank);
const optimizedFormaCount = countPolarityChanges(weapon.polarities, optimized.slotPolarities);
const optimizedLegal = optimized.capacityValid && fitsWithinCapacity(
    CAPACITY_CONFIG,
    optimized.slotPolarities,
    optimized.slots,
    optimized.slotRanks,
    [stanceSlot],
) && optimizedFormaCount <= MAX_FORMA;
const optimizedEncounter = debugEvaluateExpectedEncounter(
    weapon,
    optimized.slots.map((mod, index) => mod
        ? mod.effectsByRank[optimized.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
        : null),
    FACTION,
    TARGET,
    CONDITIONAL_STATE,
);
const optimizerBuild = {
    name: "Tenno-Hub Expected TTK optimizer",
    mods: optimizedMods.map(({ mod, rank }) => mod.name + " R" + rank),
    capacity: {
        legal: optimizedLegal,
        used: optimizedUsedCapacity,
        available: totalModCapacity(CAPACITY_CONFIG),
        forma: optimizedFormaCount,
        formaLimit: MAX_FORMA,
    },
    commonModel: {
        objective: "finite Expected TTK",
        expectedTtkSeconds: optimizedEncounter.timeToKillSeconds,
        expectedDamagePerSecond: optimizedEncounter.damagePerSecond,
        attacks: optimizedEncounter.encounter?.attacks ?? null,
    },
};

console.log(JSON.stringify({
    method: {
        weapon: WEAPON_NAME,
        attack: ATTACK_NAME,
        faction: FACTION,
        target: TARGET,
        conditionalState: CONDITIONAL_STATE.mode,
        objective: "finite Expected TTK",
        stance: "Rending Crane counted for capacity only; Lashing Tempest hit timing is not simulated",
        arcane: null,
        exilus: null,
        catalyst: true,
        maximumForma: MAX_FORMA,
        nativeUnderframeOutput: {
            simulationSeconds: 5,
            calculation: "standard Calculate DPS after Auto Build and manual Auto Polarize",
            averageDamagePerShotRaw: 15880,
            averageDamagePerShotDot: 9120,
            averageDps: 49816,
            timeToKillSeconds: 2.01,
        },
        note: "Both fixed lists are scored by Tenno-Hub's finite Expected TTK evaluator. This does not make Underframe's native simulator or Auto Build objective equivalent.",
    },
    underframeAutoBuild: captured,
    tennoHubOptimizer: {
        ...optimizerBuild,
        refinementCandidates: optimized.encounterCandidatesEvaluated,
        refined: optimized.encounterRefined,
    },
}, null, 2));

