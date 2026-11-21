import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
    filterBuilderExpertVariants,
    getModsForWeapon,
    getUnmodeledDamageEffectLines,
    type ModEntry,
} from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, getWeaponDisplayName, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import {
    countPolarityChanges,
    effectiveDrain,
    fitsWithinCapacity,
    type CapacityConfig,
} from "../src/domain/logic/capacityCalc";
import {
    assignModsToSlots,
    debugEvaluateFixedWindowDps,
    FIXED_WINDOW_DPS_SECONDS,
} from "../src/domain/logic/buildOptimizerCore";
import { optimizeBuild, type TargetProfileOverride } from "../src/domain/logic/buildOptimizer";
import type { ConditionalState } from "../src/domain/logic/damageCalc";

function option(name: string, fallback: string): string {
    const prefix = `--${name}=`;
    return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function numericOption(name: string, fallback: number): number {
    const value = Number(option(name, String(fallback)));
    if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} must be a non-negative number`);
    return value;
}

function variantFamily(path: string): string {
    return path
        .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
        .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function isFlawedVariant(path: string): boolean {
    return /\/beginner\//i.test(path) || /Beginner$/i.test(path);
}

function formatBuild(mods: (ModEntry | null)[], ranks: number[]) {
    return mods.flatMap((mod, index) => mod
        ? [{ name: mod.name, rank: ranks[index] ?? mod.fusionLimit }]
        : []);
}

const weaponName = option("weapon", "Tazicor");
const attackName = option("attack", "Normal Attack");
const targetFaction = option("faction", "Grineer");
const stateMode = option("state", "realistic") as ConditionalState["mode"];
if (!["initial", "fullyStacked", "realistic", "custom"].includes(stateMode)) {
    throw new Error(`Unsupported --state value: ${stateMode}`);
}
const target: TargetProfileOverride = {
    description: "Fixed-window full-pool one-mod neighborhood audit",
    health: numericOption("health", 100_000),
    shields: numericOption("shields", 0),
    overguard: numericOption("overguard", 0),
    armor: numericOption("armor", 3_000),
};
const slotCount = Math.max(1, Math.min(8, Math.floor(numericOption("slots", 8))));
const formaLimit = Math.max(0, Math.min(slotCount, Math.floor(numericOption("forma", 3))));
const requestedRuns = Math.floor(numericOption("runs", 3));
if (requestedRuns < 1) throw new Error("--runs must be at least 1");
const baselineFile = process.argv.find((argument) => argument.startsWith("--baseline-file="))?.slice("--baseline-file=".length);
const capturedBaseline = baselineFile
    ? JSON.parse(await readFile(resolve(baselineFile), "utf8")) as {
        weaponName?: string;
        attackName?: string;
        underframeMods?: Array<{ name: string; rank: number }>;
        mods?: Array<{ name: string; rank: number }>;
    }
    : null;
const capturedBaselineRequests = capturedBaseline?.underframeMods ?? capturedBaseline?.mods ?? null;
if (capturedBaseline && !Array.isArray(capturedBaselineRequests)) {
    throw new Error("--baseline-file must contain an object with an underframeMods or mods array");
}
if (capturedBaseline?.weaponName && capturedBaseline.weaponName.toLowerCase() !== weaponName.toLowerCase()) {
    throw new Error(`Captured baseline weapon ${capturedBaseline.weaponName} does not match ${weaponName}`);
}
if (capturedBaseline?.attackName && capturedBaseline.attackName.toLowerCase() !== attackName.toLowerCase()) {
    throw new Error(`Captured baseline attack ${capturedBaseline.attackName} does not match ${attackName}`);
}

const catalog = getWeaponCatalog();
const normalizedWeaponName = weaponName.trim().toLowerCase();
const catalogWeapon = catalog.find((entry) => getWeaponDisplayName(entry).toLowerCase() === normalizedWeaponName) ??
    catalog.find((entry) => entry.name.toLowerCase() === normalizedWeaponName);
if (!catalogWeapon) throw new Error(`Weapon missing from catalog: ${weaponName}`);
const attackIndex = catalogWeapon.attacks.findIndex((attack) => attack.name.toLowerCase() === attackName.toLowerCase());
if (attackIndex < 0) throw new Error(`Attack missing from catalog: ${weaponName} / ${attackName}`);
const weapon = withSelectedAttack(catalogWeapon, attackIndex);
const attack = weapon.attacks[attackIndex];
if (!attack) throw new Error(`Selected attack missing: ${weaponName} / ${attackName}`);

const candidatePool = filterBuilderExpertVariants(getModsForWeapon(weapon));
const standardFamilies = new Set<string>();
for (const mod of candidatePool) {
    if (
        mod.hasDamageEffect && !mod.isAura && !isFlawedVariant(mod.path) &&
        getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0 &&
        (!mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === targetFaction.toLowerCase())
    ) standardFamilies.add(variantFamily(mod.path));
}
const eligibleCandidates = candidatePool.filter((mod) => {
    if (!mod.hasDamageEffect || mod.isAura) return false;
    if (isFlawedVariant(mod.path) && standardFamilies.has(variantFamily(mod.path))) return false;
    if (mod.effect.targetFaction && mod.effect.targetFaction.toLowerCase() !== targetFaction.toLowerCase()) return false;
    return getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0;
});

const conditionalState: ConditionalState = { mode: stateMode };
const defaultPolarities = Array.from({ length: slotCount }, (_, index) => weapon.polarities[index] ?? "");
const capacityConfig: CapacityConfig = {
    weaponRank: weapon.canOverLevel ? 40 : 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: weapon.canOverLevel,
};
const optimizerOptions = {
    targetFaction,
    targetProfileOverride: target,
    conditionalState,
    buildForAttack: attack,
    capacityConfig,
    slotPolarities: defaultPolarities,
    defaultSlotPolarities: defaultPolarities,
    allowCatalyst: true,
    allowForma: true,
    maxFormaCount: formaLimit,
    optimizeArcane: false,
    arcaneCandidates: [],
    optimizeExilus: false,
};

const runs = Array.from({ length: requestedRuns }, () => {
    const startedAt = performance.now();
    const result = optimizeBuild(weapon, candidatePool, "windowDps", slotCount, optimizerOptions);
    const durationMs = performance.now() - startedAt;
    const formaCount = countPolarityChanges(weapon.polarities, result.slotPolarities);
    const capacityUsed = result.slots.reduce((total, mod, index) => mod
        ? total + effectiveDrain(mod, result.slotPolarities[index] ?? "", result.slotRanks[index] ?? mod.fusionLimit)
        : total, 0);
    if (!result.capacityValid || formaCount > formaLimit) {
        throw new Error("Optimizer returned an illegal baseline build");
    }
    return {
        result,
        durationMs,
        buildSignature: formatBuild(result.slots, result.slotRanks)
            .map(({ name, rank }) => `${name} R${rank}`)
            .join(" | "),
        capacity: { used: capacityUsed, limit: 60, legal: result.capacityValid, formaCount },
        score: {
            damagePerSecond: result.windowDpsScore ?? 0,
            damageInWindow: result.windowDpsDamage ?? 0,
            timeToKillSeconds: result.encounterTimeToKillSeconds ?? null,
            candidatesEvaluated: result.encounterCandidatesEvaluated ?? null,
            refined: result.encounterRefined ?? false,
        },
    };
});

const firstRun = runs[0];
if (!firstRun) throw new Error("Optimizer produced no baseline run");
if (runs.some((run) => run.buildSignature !== firstRun.buildSignature)) {
    throw new Error("Optimizer mod list changed between repeated runs");
}
if (runs.some((run) => Math.abs(run.score.damagePerSecond - firstRun.score.damagePerSecond) > 1e-8)) {
    throw new Error("Optimizer score changed between repeated runs");
}

const optimizerBaselineEntries = firstRun.result.slots.flatMap((mod, index) => mod
    ? [{ mod, rank: firstRun.result.slotRanks[index] ?? mod.fusionLimit }]
    : []);
const baselineEntries = capturedBaselineRequests
    ? capturedBaselineRequests.map(({ name, rank }) => {
        const mod = candidatePool.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
        if (!mod) throw new Error(`Captured baseline mod missing from compatible candidate pool: ${name}`);
        if (!Number.isInteger(rank) || rank < 0 || rank > mod.fusionLimit) {
            throw new Error(`Captured baseline rank is invalid for ${name}: ${rank}/${mod.fusionLimit}`);
        }
        return { mod, rank };
    })
    : optimizerBaselineEntries;
if (baselineEntries.length > slotCount) throw new Error("Captured baseline has more mods than available slots");
const baselinePlacement = assignModsToSlots(
    baselineEntries.map((entry) => entry.mod),
    baselineEntries.map((entry) => entry.rank),
    defaultPolarities,
    slotCount,
    true,
    formaLimit,
);
if (baselinePlacement.slotMods.filter(Boolean).length !== baselineEntries.length) {
    throw new Error("Captured baseline could not be assigned to the configured slots and Forma limit");
}
const baselineFormaCount = countPolarityChanges(defaultPolarities, baselinePlacement.resultPolarities);
const baselineCapacityUsed = baselinePlacement.slotMods.reduce((total, mod, index) => mod
    ? total + effectiveDrain(mod, baselinePlacement.resultPolarities[index] ?? "", baselinePlacement.slotRanks[index] ?? mod.fusionLimit)
    : total, 0);
const baselineModsUnique = new Set(baselineEntries.map(({ mod }) => (mod.uniqueName ?? mod.name).toLowerCase())).size === baselineEntries.length;
const baselineIncompatibilityGroups = baselineEntries.map(({ mod }) => mod.incompatibilityGroup).filter((group): group is string => !!group);
const baselineNoIncompatibilityConflict = new Set(baselineIncompatibilityGroups).size === baselineIncompatibilityGroups.length;
const baselineLegal = fitsWithinCapacity(
    capacityConfig,
    baselinePlacement.resultPolarities,
    baselinePlacement.slotMods,
    baselinePlacement.slotRanks,
) && baselineFormaCount <= formaLimit && baselineModsUnique && baselineNoIncompatibilityConflict;
const baselineScore = debugEvaluateFixedWindowDps(
    weapon,
    baselinePlacement.slotMods.map((mod, index) => mod
        ? mod.effectsByRank[baselinePlacement.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
        : null),
    targetFaction,
    target,
    conditionalState,
);
if (!capturedBaseline && Math.abs(baselineScore.damagePerSecond - firstRun.score.damagePerSecond) > 1e-6) {
    throw new Error("Independent fixed-window scorer did not reproduce the optimizer's reported score");
}

const seen = new Set<string>();
const neighbors: Array<{
    mods: Array<{ name: string; rank: number }>;
    damagePerSecond: number;
    damageInWindow: number;
    timeToKillSeconds: number | null;
    change: { kind: "add" | "remove" | "replace"; outgoing?: string; incoming?: string };
}> = [];
let consideredLegalNeighbors = 0;

function consider(
    entries: Array<{ mod: ModEntry; rank: number }>,
    change: { kind: "add" | "remove" | "replace"; outgoing?: string; incoming?: string },
): void {
    const selected = entries.map((entry) => entry.mod);
    const ranks = entries.map((entry) => entry.rank);
    if (selected.some((mod, index) => selected.some((other, otherIndex) =>
        otherIndex < index && (other.uniqueName === mod.uniqueName || other.incompatibilityGroup === mod.incompatibilityGroup),
    ))) return;

    const placement = assignModsToSlots(selected, ranks, defaultPolarities, slotCount, true, formaLimit);
    if (placement.slotMods.filter(Boolean).length !== selected.length) return;
    if (countPolarityChanges(defaultPolarities, placement.resultPolarities) > formaLimit) return;
    if (!fitsWithinCapacity(capacityConfig, placement.resultPolarities, placement.slotMods, placement.slotRanks)) return;

    const signature = placement.slotMods.map((mod, index) => mod
        ? `${mod.uniqueName}@${placement.slotRanks[index]}`
        : "_").join("|");
    if (seen.has(signature)) return;
    seen.add(signature);

    const score = debugEvaluateFixedWindowDps(
        weapon,
        placement.slotMods.map((mod, index) => mod
            ? mod.effectsByRank[placement.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null),
        targetFaction,
        target,
        conditionalState,
    );
    consideredLegalNeighbors++;
    neighbors.push({
        mods: formatBuild(placement.slotMods, placement.slotRanks),
        damagePerSecond: score.damagePerSecond,
        damageInWindow: score.damageInWindow,
        timeToKillSeconds: score.timeToKillSeconds,
        change,
    });
}

for (let index = 0; index < baselineEntries.length; index++) {
    const outgoing = baselineEntries[index]?.mod.name;
    consider(baselineEntries.filter((_, entryIndex) => entryIndex !== index), { kind: "remove", outgoing });
    for (const candidate of eligibleCandidates) {
        if (candidate.uniqueName === baselineEntries[index]?.mod.uniqueName) continue;
        consider(
            baselineEntries.map((entry, entryIndex) => entryIndex === index
                ? { mod: candidate, rank: candidate.fusionLimit }
                : entry),
            { kind: "replace", outgoing, incoming: candidate.name },
        );
    }
}
if (baselineEntries.length < slotCount) {
    for (const candidate of eligibleCandidates) {
        if (baselineEntries.some((entry) => entry.mod.uniqueName === candidate.uniqueName)) continue;
        consider(
            [...baselineEntries, { mod: candidate, rank: candidate.fusionLimit }],
            { kind: "add", incoming: candidate.name },
        );
    }
}

neighbors.sort((left, right) => right.damagePerSecond - left.damagePerSecond);
const bestNeighbor = neighbors[0] ?? null;
const improvement = !!bestNeighbor && bestNeighbor.damagePerSecond > baselineScore.damagePerSecond + 1e-8;

console.log(JSON.stringify({
    method: {
        objective: `deterministic applied single-target damage divided by ${FIXED_WINDOW_DPS_SECONDS}s`,
        scoringWindow: `[0, ${FIXED_WINDOW_DPS_SECONDS}s)`,
        oneModNeighborhood: "One max-rank mod addition, removal, or replacement; only legal unique-mod/incompatibility and capacity assignments within the configured Forma limit are scored.",
        modelBoundary: "Tenno-Hub's deterministic target encounter; it is not Underframe's private simulator or live-game validation. Companion precepts, targeting, range, and multi-target behavior are outside this weapon-only score.",
        optimizerRuns: requestedRuns,
    },
    fixture: {
        weapon: weapon.name,
        category: weapon.category,
        attack: attack.name,
        faction: targetFaction,
        target,
        state: stateMode,
        slots: slotCount,
        catalyst: true,
        formaLimit,
    },
    candidatePool: candidatePool.length,
    eligibleFullPoolCandidates: eligibleCandidates.length,
    baseline: {
        source: baselineFile ?? "tennoHubOptimizer",
        requestedMods: capturedBaselineRequests ?? null,
        mods: formatBuild(baselinePlacement.slotMods, baselinePlacement.slotRanks),
        capacity: {
            used: baselineCapacityUsed,
            limit: 60,
            legal: baselineLegal,
            formaCount: baselineFormaCount,
        },
        score: baselineScore,
        runs: runs.map(({ durationMs, score }) => ({ durationMs: Number(durationMs.toFixed(1)), score })),
        deterministic: true,
        refined: firstRun.score.refined,
        optimizerCandidatesEvaluated: firstRun.score.candidatesEvaluated,
    },
    tennoHubOptimizerBaseline: capturedBaseline ? {
        mods: formatBuild(firstRun.result.slots, firstRun.result.slotRanks),
        capacity: firstRun.capacity,
        score: firstRun.score,
        runs: runs.map(({ durationMs }) => Number(durationMs.toFixed(1))),
    } : null,
    exactLegalOneModNeighbors: consideredLegalNeighbors,
    exactScoresComputed: neighbors.length,
    bestOneModNeighbor: bestNeighbor ? {
        damagePerSecond: bestNeighbor.damagePerSecond,
        damageInWindow: bestNeighbor.damageInWindow,
        timeToKillSeconds: bestNeighbor.timeToKillSeconds,
        change: bestNeighbor.change,
    } : null,
    improvesBaseline: improvement,
    topExactNeighbors: neighbors.slice(0, 10).map((neighbor) => ({
        damagePerSecond: neighbor.damagePerSecond,
        damageInWindow: neighbor.damageInWindow,
        timeToKillSeconds: neighbor.timeToKillSeconds,
        change: neighbor.change,
    })),
}, null, 2));
