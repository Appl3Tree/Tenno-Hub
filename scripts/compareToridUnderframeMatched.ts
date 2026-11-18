import { filterBuilderExpertVariants, getModsForWeapon, type ModEntry } from "../src/domain/catalog/modCatalog";
import { getArcanesForWeapon } from "../src/domain/catalog/arcaneCatalog";
import { getWeaponCatalog } from "../src/domain/catalog/weaponCatalog";
import { withSelectedAttack } from "../src/domain/catalog/weaponRules";
import { getArcaneEffectAtRank } from "../src/domain/logic/arcaneEffects";
import {
    debugEvaluateExpectedEncounter,
    debugScoreBuild,
} from "../src/domain/logic/buildOptimizerCore";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";
import { countPolarityChanges, effectiveDrain } from "../src/domain/logic/capacityCalc";
import type { ConditionalState } from "../src/domain/logic/damageCalc";

const WEAPON_NAME = "Torid";
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
    { name: "Malignant Force", rank: 3 },
    { name: "Vile Acceleration", rank: 5 },
    { name: "Hammer Shot", rank: 3 },
    { name: "Primed Bane of Corpus", rank: 10 },
    { name: "Rifle Aptitude", rank: 5 },
    { name: "Rifle Elementalist", rank: 5 },
    { name: "Continuous Misery", rank: 3 },
    { name: "Speed Trigger", rank: 5 },
];

function resolveBuild(requests: Array<{ name: string; rank: number }>, pool: ModEntry[]) {
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

const catalogWeapon = getWeaponCatalog().find((entry) => entry.name.toLowerCase() === WEAPON_NAME.toLowerCase());
if (!catalogWeapon) throw new Error("Weapon missing from catalog: " + WEAPON_NAME);
const weapon = withSelectedAttack(catalogWeapon, 0);
const pool = filterBuilderExpertVariants(getModsForWeapon(weapon));
const primaryBulwark = getArcanesForWeapon(weapon).find((arcane) => arcane.name === "Primary Bulwark");
if (!primaryBulwark) throw new Error("Primary Bulwark missing from weapon arcane pool.");
const bulwarkEffect = getArcaneEffectAtRank(primaryBulwark, primaryBulwark.maxRank, 1_500, false);

function score(requests: Array<{ name: string; rank: number }>, state: ConditionalState) {
    const { effects, entries } = resolveBuild(requests, pool);
    const result = debugEvaluateExpectedEncounter(weapon, effects, FACTION, TARGET, state, bulwarkEffect);
    return {
        mods: entries.map(({ mod, rank }) => mod.name + " R" + rank),
        finiteExpectedTTK: result.timeToKillSeconds,
        expectedEncounterDPS: result.damagePerSecond,
        attacks: result.encounter?.attacks ?? null,
        objectiveScore: debugScoreBuild(weapon, effects, GOAL, FACTION, bulwarkEffect, TARGET, state),
    };
}

const fixedInitial = score(UNDERFRAME_MODS, INITIAL);
const fixedRealistic = score(UNDERFRAME_MODS, REALISTIC);
const optimized = optimizeBuild(weapon, pool, GOAL, weapon.baseSlotCount, {
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
    optimizeArcane: true,
    arcaneCandidates: [primaryBulwark],
    warframeArmor: 1_500,
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
const optimizedEvaluation = score(optimizedMods, REALISTIC);

console.log(JSON.stringify({
    method: {
        weapon: WEAPON_NAME,
        attack: weapon.attacks[0]?.name ?? "base attack",
        faction: FACTION,
        target: TARGET,
        objective: "Expected TTK",
        underframeExternalCondition: "Primary Bulwark slider 500/500; mapped to Primary Bulwark R5 (+500% damage) with 1,500 Warframe Armor.",
        underframeMode: "Grenade Impact (Combined), configured as Grenade Impact + Poison Cloud at a 1:1 ratio; five-second Luck Averaged DPS, Accurate Ammo on.",
        modelBoundary: "Tenno-Hub scores its Wiki-backed single-target linked cloud sequence; Underframe's custom component mode is not assumed to use an identical cloud timeline or stochastic model.",
    },
    underframeFixedBuild: {
        legalOnUnderframe: "UI showed 2 / 60 remaining capacity and 3 Forma.",
        initialState: fixedInitial,
        realisticState: fixedRealistic,
    },
    tennoHubOptimizer: {
        mods: optimizedMods.map((entry) => entry.name + " R" + entry.rank),
        capacityValid: optimized.capacityValid,
        formaCount: optimizedFormaCount,
        usedCapacity: optimizedUsedCapacity,
        objectiveScore: optimizedEvaluation.objectiveScore,
        candidatesEvaluated: optimized.encounterCandidatesEvaluated,
        refined: optimized.encounterRefined,
        expectedEncounter: optimizedEvaluation,
    },
}, null, 2));




