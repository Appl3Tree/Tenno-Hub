import { filterBuilderExpertVariants, getModsForWeapon } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog } from "../src/domain/catalog/weaponCatalog";
import { withSelectedAttack } from "../src/domain/catalog/weaponRules";
import {
    assignModsToSlots,
    debugEvaluateFixedWindowDps,
    FIXED_WINDOW_DPS_SECONDS,
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

interface ModRequest {
    name: string;
    rank: number;
}

interface Fixture {
    weaponName: string;
    underframeObservedCapacityAfterAutoPolarize: string;
    underframeMods: ModRequest[];
}

const FIXTURES: Fixture[] = [
    {
        weaponName: "Cedo",
        underframeObservedCapacityAfterAutoPolarize: "0/60; 3 Forma",
        underframeMods: [
            { name: "Primed Charged Shell", rank: 10 },
            { name: "Toxic Barrage", rank: 3 },
            { name: "Galvanized Hell", rank: 10 },
            { name: "Primed Point Blank", rank: 10 },
            { name: "Amalgam Shotgun Barrage", rank: 5 },
            { name: "Accelerated Blast", rank: 3 },
            { name: "Galvanized Savvy", rank: 10 },
            { name: "Frail Momentum", rank: 5 },
        ],
    },
    {
        weaponName: "Lex Prime",
        underframeObservedCapacityAfterAutoPolarize: "1/60; 3 Forma",
        underframeMods: [
            { name: "Ice Storm", rank: 3 },
            { name: "Pistol Pestilence", rank: 3 },
            { name: "Primed Heated Charge", rank: 10 },
            { name: "Galvanized Shot", rank: 10 },
            { name: "Galvanized Diffusion", rank: 10 },
            { name: "Anemic Agility", rank: 5 },
            { name: "Lethal Torrent", rank: 5 },
            { name: "Frostbite", rank: 3 },
        ],
    },
    {
        weaponName: "Broken War",
        underframeObservedCapacityAfterAutoPolarize: "5/60; 2 Forma",
        underframeMods: [
            { name: "Primed Fever Strike", rank: 10 },
            { name: "Primed Pressure Point", rank: 10 },
            { name: "Voltaic Strike", rank: 3 },
            { name: "Galvanized Steel", rank: 10 },
            { name: "Condition Overload", rank: 5 },
            { name: "Berserker Fury", rank: 5 },
            { name: "Primed Smite Grineer", rank: 10 },
            { name: "Volcanic Edge", rank: 3 },
        ],
    },
];

const TARGET_FACTION = "Grineer";
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
const requestedRuns = Number(process.argv.find((arg) => arg.startsWith("--runs="))?.slice(7) ?? 3);
const RUNS = Number.isInteger(requestedRuns) && requestedRuns > 0 ? requestedRuns : 3;

function getWeapon(name: string) {
    const catalogWeapon = getWeaponCatalog().find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (!catalogWeapon) throw new Error(`Weapon missing from catalog: ${name}`);
    const weapon = withSelectedAttack(catalogWeapon, 0);
    if (weapon.attacks[0]?.name !== "Normal Attack") throw new Error(`${name} Normal Attack row changed.`);
    return weapon;
}

function getMod(name: string, rank: number, compatibleMods: ReturnType<typeof getModsForWeapon>) {
    const variants = compatibleMods.filter((entry) => entry.name.toLowerCase() === name.toLowerCase());
    const mod = variants.find((entry) => !/\/(Beginner|Intermediate|Expert)\//i.test(entry.path)
        && !/(Beginner|Intermediate|Expert)$/i.test(entry.path)) ?? variants[0];
    if (!mod) throw new Error(`Compatible mod missing: ${name}`);
    if (rank < 0 || rank > mod.fusionLimit) throw new Error(`Invalid rank for ${name}: ${rank}/${mod.fusionLimit}`);
    return mod;
}

function evaluateFixedBuild(
    weapon: ReturnType<typeof getWeapon>,
    fixture: Fixture,
    compatibleMods: ReturnType<typeof getModsForWeapon>,
) {
    const mods = fixture.underframeMods.map(({ name, rank }) => getMod(name, rank, compatibleMods));
    const ranks = fixture.underframeMods.map(({ rank }) => rank);
    const assignment = assignModsToSlots(mods, ranks, weapon.polarities, weapon.baseSlotCount, true);
    const polarityPlan = minimizePolaritiesByCapacity(
        weapon.polarities,
        assignment.slotMods,
        assignment.slotRanks,
        CAPACITY_CONFIG,
        [],
        undefined,
        MAX_FORMA,
    );
    const formaCount = countPolarityChanges(weapon.polarities, polarityPlan.mainPolarities);
    const usedCapacity = assignment.slotMods.reduce((total, mod, index) => mod
        ? total + effectiveDrain(mod, polarityPlan.mainPolarities[index] ?? "", assignment.slotRanks[index])
        : total, 0);
    const uniqueNames = mods.map((mod) => (mod.uniqueName ?? mod.name).toLowerCase());
    const incompatibilityGroups = mods.map((mod) => mod.incompatibilityGroup).filter((group): group is string => !!group);
    const legal = fitsWithinCapacity(
        CAPACITY_CONFIG,
        polarityPlan.mainPolarities,
        assignment.slotMods,
        assignment.slotRanks,
    )
        && formaCount <= MAX_FORMA
        && new Set(uniqueNames).size === uniqueNames.length
        && new Set(incompatibilityGroups).size === incompatibilityGroups.length;
    const effects = assignment.slotMods.map((mod, index) => mod
        ? mod.effectsByRank[assignment.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
        : null);
    const evaluation = debugEvaluateFixedWindowDps(
        weapon,
        effects,
        TARGET_FACTION,
        TARGET,
        CONDITIONAL_STATE,
    );
    const score = {
        damagePerSecond: evaluation.damagePerSecond,
        damageInWindow: evaluation.damageInWindow,
        windowSeconds: evaluation.windowSeconds,
        timeToKillSeconds: evaluation.timeToKillSeconds,
        attacks: evaluation.encounter?.attacks ?? null,
        statusDamage: evaluation.encounter?.statusDamageByPool.health ?? 0,
    };
    return {
        mods: fixture.underframeMods.map(({ name, rank }) => `${name} R${rank}`),
        tennoHubModeledCapacity: {
            legal,
            used: usedCapacity,
            limit: 60,
            formaCount,
        },
        score,
    };
}

function runFixture(fixture: Fixture) {
    const weapon = getWeapon(fixture.weaponName);
    const compatibleMods = filterBuilderExpertVariants(getModsForWeapon(weapon));
    const fixedBuild = evaluateFixedBuild(weapon, fixture, compatibleMods);
    const optimizerRuns = Array.from({ length: RUNS }, () => {
        const startedAt = performance.now();
        const result = optimizeBuild(weapon, compatibleMods, "windowDps", weapon.baseSlotCount, {
            targetFaction: TARGET_FACTION,
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
            arcaneCandidates: [],
            optimizeExilus: false,
            buildForAttack: weapon.attacks[0] ?? null,
        });
        const durationMs = performance.now() - startedAt;
        const formaCount = countPolarityChanges(weapon.polarities, result.slotPolarities);
        const usedCapacity = result.slots.reduce((total, mod, index) => mod
            ? total + effectiveDrain(mod, result.slotPolarities[index] ?? "", result.slotRanks[index])
            : total, 0);
        const legal = result.capacityValid && formaCount <= MAX_FORMA;
        return {
            mods: result.slots.flatMap((mod, index) => mod
                ? [`${mod.name} R${result.slotRanks[index] ?? mod.fusionLimit}`]
                : []),
            capacity: {
                legal,
                used: usedCapacity,
                limit: 60,
                formaCount,
            },
            score: {
                damagePerSecond: result.windowDpsScore ?? 0,
                damageInWindow: result.windowDpsDamage ?? 0,
                windowSeconds: FIXED_WINDOW_DPS_SECONDS,
                timeToKillSeconds: result.encounterTimeToKillSeconds ?? null,
                candidatesEvaluated: result.encounterCandidatesEvaluated ?? null,
                refined: result.encounterRefined ?? false,
            },
            durationMs,
        };
    });
    const optimizerScores = optimizerRuns.map((run) => run.score.damagePerSecond);
    const uniqueBuilds = new Set(optimizerRuns.map((run) => run.mods.join(" | ")));
    const uniqueScores = new Set(optimizerScores);
    const firstRun = optimizerRuns[0];
    return {
        weapon: fixture.weaponName,
        category: weapon.category,
        attack: weapon.attacks[0]?.name ?? "base attack",
        underframeObservedCapacityAfterAutoPolarize: fixture.underframeObservedCapacityAfterAutoPolarize,
        capturedUnderframeBuild: fixedBuild,
        tennoHubWindowDps: firstRun ? {
            mods: firstRun.mods,
            capacity: firstRun.capacity,
            score: firstRun.score,
            runs: optimizerRuns.length,
            candidatesEvaluated: firstRun.score.candidatesEvaluated,
            refined: firstRun.score.refined,
            durationMs: optimizerRuns.map((run) => Number(run.durationMs.toFixed(1))),
        } : null,
        repeatability: {
            identicalModLists: uniqueBuilds.size === 1,
            identicalScores: uniqueScores.size === 1,
        },
    };
}

console.log(JSON.stringify({
    method: {
        objective: `deterministic applied single-target damage divided by ${FIXED_WINDOW_DPS_SECONDS}s`,
        scoringWindow: `[0, ${FIXED_WINDOW_DPS_SECONDS}s)`,
        targetFaction: TARGET_FACTION,
        target: TARGET,
        conditionalState: CONDITIONAL_STATE.mode,
        constraints: "Eight normal slots, max-rank mods, Catalyst, up to three Forma, no Exilus or Arcanes.",
        modelBoundary: "All captured and optimized lists use Tenno-Hub's same deterministic finite encounter engine. It clips overkill and damage after the single target dies, begins on-kill stacks at zero, and does not reset the target. It excludes neighboring targets and melee stance/combo history. This is not Underframe's seeded stochastic simulator or live-game validation.",
        optimizerRunsPerFixture: RUNS,
    },
    fixtures: FIXTURES.map(runFixture),
}, null, 2));
