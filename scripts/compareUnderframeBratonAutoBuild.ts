import { filterBuilderExpertVariants, getModsForWeapon } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import {
    assignModsToSlots,
    debugEvaluateExpectedEncounter,
    debugScoreBuild,
    minimizePolaritiesByCapacity,
} from "../src/domain/logic/buildOptimizerCore";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";
import {
    countPolarityChanges,
    effectiveDrain,
    fitsWithinCapacity,
    type CapacityConfig,
} from "../src/domain/logic/capacityCalc";
import type { ConditionalState } from "../src/domain/logic/damageCalc";

const WEAPON_NAME = "Braton Prime";
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
const CONDITIONAL_STATE: ConditionalState = { mode: "realistic" };
const MAX_FORMA = 3;
const CAPACITY_CONFIG: CapacityConfig = {
    weaponRank: 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: false,
};

const UNDERFRAME_AUTOBUILD = [
    { name: "Malignant Force", rank: 3 },
    { name: "High Voltage", rank: 3 },
    { name: "Rime Rounds", rank: 3 },
    { name: "Galvanized Chamber", rank: 10 },
    { name: "Vile Acceleration", rank: 5 },
    { name: "Galvanized Aptitude", rank: 10 },
    { name: "Vital Sense", rank: 5 },
    { name: "Primed Bane of Grineer", rank: 10 },
];

const catalogWeapon = getWeaponCatalog().find((entry) => entry.name === WEAPON_NAME);
if (!catalogWeapon) throw new Error(`Weapon missing from catalog: ${WEAPON_NAME}`);
const attackIndex = catalogWeapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
if (attackIndex < 0) throw new Error("Braton Prime Normal Attack is missing from the catalog.");
const weapon = withSelectedAttack(catalogWeapon, attackIndex);
const compatibleMods = filterBuilderExpertVariants(getModsForWeapon(weapon));

function resolveBuild(requests: typeof UNDERFRAME_AUTOBUILD) {
    return requests.map(({ name, rank }) => {
        const variants = compatibleMods.filter((entry) => entry.name.toLowerCase() === name.toLowerCase());
        const mod = variants.find((entry) => !/\/(Beginner|Intermediate|Expert)\//i.test(entry.path)
            && !/(Beginner|Intermediate|Expert)$/i.test(entry.path)) ?? variants[0];
        if (!mod) throw new Error(`Compatible mod missing: ${name}`);
        if (rank < 0 || rank > mod.fusionLimit) throw new Error(`Invalid rank: ${name} R${rank}`);
        return { mod, rank, effect: mod.effectsByRank[rank] ?? mod.effect };
    });
}

function evaluateBuild(name: string, requests: typeof UNDERFRAME_AUTOBUILD) {
    const resolved = resolveBuild(requests);
    const assignment = assignModsToSlots(
        resolved.map(({ mod }) => mod),
        resolved.map(({ rank }) => rank),
        weapon.polarities,
        weapon.baseSlotCount,
        true,
    );
    const polarities = minimizePolaritiesByCapacity(
        weapon.polarities,
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
    const formaCount = countPolarityChanges(weapon.polarities, polarities);
    const legal = fitsWithinCapacity(CAPACITY_CONFIG, polarities, assignment.slotMods, assignment.slotRanks)
        && formaCount <= MAX_FORMA;
    const effects = resolved.map(({ effect }) => effect);
    const encounter = debugEvaluateExpectedEncounter(
        weapon,
        effects,
        FACTION,
        TARGET,
        CONDITIONAL_STATE,
    );

    return {
        name,
        mods: resolved.map(({ mod, rank }) => `${mod.name} R${rank}`),
        capacity: { legal, used: usedCapacity, available: 60, forma: formaCount, formaLimit: MAX_FORMA },
        commonModel: {
            objective: GOAL,
            finiteExpectedTtkSeconds: encounter.timeToKillSeconds,
            expectedDamagePerSecond: encounter.damagePerSecond,
            attacks: encounter.encounter?.attacks ?? null,
            screeningScore: debugScoreBuild(weapon, effects, GOAL, FACTION, null, TARGET, CONDITIONAL_STATE),
        },
    };
}

const capturedBuild = evaluateBuild("Underframe Auto Build capture", UNDERFRAME_AUTOBUILD);
const optimized = optimizeBuild(weapon, compatibleMods, GOAL, weapon.baseSlotCount, {
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
});
const optimizedMods = optimized.slots.flatMap((mod, index) => mod
    ? [{ name: mod.name, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
    : []);
const optimizedBuild = evaluateBuild("Tenno-Hub Expected TTK optimizer", optimizedMods);

console.log(JSON.stringify({
    method: {
        weapon: WEAPON_NAME,
        attack: "Normal Attack",
        faction: FACTION,
        target: TARGET,
        conditionalState: CONDITIONAL_STATE.mode,
        objective: GOAL,
        arcane: null,
        exilus: null,
        catalyst: true,
        maximumForma: MAX_FORMA,
        sharedEvaluator: "Both fixed lists are scored by Tenno-Hub's finite Expected TTK model. This does not make the native Underframe Auto Build objective or DPS simulator equivalent.",
    },
    underframeAutoBuild: capturedBuild,
    tennoHubOptimizer: {
        ...optimizedBuild,
        refinementCandidates: optimized.encounterCandidatesEvaluated,
        refined: optimized.encounterRefined,
    },
}, null, 2));
