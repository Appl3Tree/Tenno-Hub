import { performance } from "node:perf_hooks";
import { filterBuilderExpertVariants, getModsForWeapon, getStancesForWeapon, getUnmodeledDamageEffectLines } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import { countPolarityChanges, effectiveDrain, fitsWithinCapacity, totalModCapacity } from "../src/domain/logic/capacityCalc";
import {
    assignModsToSlots,
    debugScoreExpectedEncounter,
    optimizeBuild,
    type TargetProfileOverride,
} from "../src/domain/logic/buildOptimizer";
import type { ConditionalState } from "../src/domain/logic/damageCalc";

const weapon = getWeaponCatalog().find((entry) => entry.name === "Gram Prime");
if (!weapon) throw new Error("Gram Prime was not found in the weapon catalog");
const attackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
const attack = weapon.attacks[attackIndex];
if (attackIndex < 0 || !attack) throw new Error("Gram Prime Normal Attack was not found");
const stance = getStancesForWeapon(weapon).find((entry) => entry.name === "Rending Crane");
if (!stance) throw new Error("Rending Crane was not found in the stance catalog");

const faction = "Grineer";
const target: TargetProfileOverride = {
    description: "Family-aware slot replacement full-pool audit",
    health: 100_000,
    shields: 0,
    overguard: 0,
    armor: 3_000,
};
const conditionalState: ConditionalState = { mode: "initial" };
const slotCount = weapon.baseSlotCount;
const maxFormaCount = 3;
const defaultPolarities = Array.from({ length: slotCount }, (_, index) => weapon.polarities[index] ?? "");
const capacityConfig = {
    weaponRank: 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: weapon.canOverLevel,
};
const stanceSlot = {
    mod: stance,
    rank: stance.fusionLimit,
    polarity: weapon.stancePolarity ?? stance.polarity ?? "",
};
const options = {
    targetFaction: faction,
    targetProfileOverride: target,
    conditionalState,
    capacityConfig,
    slotPolarities: defaultPolarities,
    defaultSlotPolarities: defaultPolarities,
    allowCatalyst: true,
    allowForma: true,
    maxFormaCount,
    optimizeArcane: false,
    optimizeExilus: false,
    buildForAttack: attack,
    extraCapacitySlots: [stanceSlot],
};
const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon));
const variantFamily = (path: string) => path
    .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
    .replace(/(Beginner|Intermediate|Expert)$/g, "");
const isFlawedVariant = (path: string) => /\/beginner\//i.test(path) || /Beginner$/i.test(path);
const familyHasStandard = new Set<string>();
for (const mod of candidates) {
    if (
        mod.hasDamageEffect && !mod.isAura && !isFlawedVariant(mod.path) &&
        getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0 &&
        (!mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === faction.toLowerCase())
    ) familyHasStandard.add(variantFamily(mod.path));
}
const eligibleCandidates = candidates.filter((mod) => {
    if (!mod.hasDamageEffect || mod.isAura || getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length !== 0) return false;
    if (mod.effect.targetFaction && mod.effect.targetFaction.toLowerCase() !== faction.toLowerCase()) return false;
    return !isFlawedVariant(mod.path) || !familyHasStandard.has(variantFamily(mod.path));
});

function scoreEffects(mods: Array<typeof candidates[number] | null>, ranks: number[]): ReturnType<typeof debugScoreExpectedEncounter> {
    const effects = mods.map((mod, index) => mod
        ? mod.effectsByRank[ranks[index] ?? mod.fusionLimit] ?? mod.effect
        : null);
    return debugScoreExpectedEncounter(
        withSelectedAttack(weapon, attackIndex),
        effects,
        faction,
        target,
        conditionalState,
    );
}

function compareScore(
    left: ReturnType<typeof debugScoreExpectedEncounter>,
    right: ReturnType<typeof debugScoreExpectedEncounter>,
): boolean {
    if (left.timeToKillSeconds !== null) {
        if (right.timeToKillSeconds === null) return true;
        return left.timeToKillSeconds < right.timeToKillSeconds - 1e-9 ||
            (Math.abs(left.timeToKillSeconds - right.timeToKillSeconds) <= 1e-9 &&
                left.damagePerSecond > right.damagePerSecond + 1e-8);
    }
    return right.timeToKillSeconds === null && left.damagePerSecond > right.damagePerSecond + 1e-8;
}

const runs = [];
let finalResult: ReturnType<typeof optimizeBuild> | null = null;
for (let index = 0; index < 3; index++) {
    const startedAt = performance.now();
    const result = optimizeBuild(weapon, candidates, "timeToKill", slotCount, options);
    const elapsedMs = performance.now() - startedAt;
    const score = scoreEffects(result.slots, result.slotRanks);
    const formaCount = countPolarityChanges(defaultPolarities, result.slotPolarities);
    const capacityUsed = result.slots.reduce((sum, mod, slot) => sum + (mod
        ? effectiveDrain(mod, result.slotPolarities[slot] ?? "", result.slotRanks[slot] ?? mod.fusionLimit)
        : 0), 0) + effectiveDrain(stanceSlot.mod, stanceSlot.polarity, stanceSlot.rank);
    runs.push({
        elapsedMs,
        timeToKillSeconds: score.timeToKillSeconds,
        damagePerSecond: score.damagePerSecond,
        capacityValid: result.capacityValid,
        capacityUsed,
        totalCapacity: totalModCapacity(capacityConfig),
        formaCount,
        candidateEvaluations: result.encounterCandidatesEvaluated ?? null,
        selectedMods: result.slots.flatMap((mod, slot) => mod
            ? [`${mod.name} R${result.slotRanks[slot] ?? mod.fusionLimit}`]
            : []),
    });
    finalResult = result;
}
if (!finalResult) throw new Error("Optimizer produced no run");
if (runs.some((run) => run.selectedMods.join("|") !== runs[0]?.selectedMods.join("|"))) {
    throw new Error("Optimizer build changed across the three runs");
}

const baselineEntries = finalResult.slots.flatMap((mod, index) => mod
    ? [{ mod, rank: finalResult.slotRanks[index] ?? mod.fusionLimit }]
    : []);
const baselineScore = scoreEffects(finalResult.slots, finalResult.slotRanks);
let legalNeighbors = 0;
let exactScores = 0;
let bestScore = baselineScore;
let bestChange: { kind: "remove" | "replace"; outgoing?: string; incoming?: string } | null = null;
const seen = new Set<string>();

function scoreNeighbor(
    entries: Array<{ mod: typeof candidates[number]; rank: number }>,
    change: { kind: "remove" | "replace"; outgoing?: string; incoming?: string },
): void {
    const selected = entries.map((entry) => entry.mod);
    const ranks = entries.map((entry) => entry.rank);
    if (selected.some((mod, index) => selected.some((other, otherIndex) =>
        otherIndex < index && (other.uniqueName === mod.uniqueName || other.incompatibilityGroup === mod.incompatibilityGroup),
    ))) return;

    const placement = assignModsToSlots(selected, ranks, defaultPolarities, slotCount, true, maxFormaCount);
    if (placement.slotMods.filter(Boolean).length !== selected.length) return;
    if (countPolarityChanges(defaultPolarities, placement.resultPolarities) > maxFormaCount) return;
    if (!fitsWithinCapacity(capacityConfig, placement.resultPolarities, placement.slotMods, placement.slotRanks, [stanceSlot])) return;

    const signature = placement.slotMods.map((mod, index) => mod
        ? `${mod.uniqueName}@${placement.slotRanks[index]}`
        : "_").join("|");
    if (seen.has(signature)) return;
    seen.add(signature);
    legalNeighbors++;
    exactScores++;
    const score = scoreEffects(placement.slotMods, placement.slotRanks);
    if (compareScore(score, bestScore)) {
        bestScore = score;
        bestChange = change;
    }
}

for (let index = 0; index < baselineEntries.length; index++) {
    scoreNeighbor(
        baselineEntries.filter((_, entryIndex) => entryIndex !== index),
        { kind: "remove", outgoing: baselineEntries[index]?.mod.name },
    );
    for (const candidate of eligibleCandidates) {
        if (candidate.uniqueName === baselineEntries[index]?.mod.uniqueName) continue;
        scoreNeighbor(
            baselineEntries.map((entry, entryIndex) => entryIndex === index
                ? { mod: candidate, rank: candidate.fusionLimit }
                : entry),
            { kind: "replace", outgoing: baselineEntries[index]?.mod.name, incoming: candidate.name },
        );
    }
}
if (bestChange !== null) throw new Error("The optimized Gram build has an improving exact legal one-mod neighbor");

console.log(JSON.stringify({
    fixture: {
        weapon: weapon.name,
        attack: attack.name,
        stance: stance.name,
        faction,
        target,
        conditionalState,
        slots: slotCount,
        catalyst: true,
        maxForma: maxFormaCount,
    },
    candidatePool: candidates.length,
    eligibleFullPoolCandidates: eligibleCandidates.length,
    runs,
    medianMs: [...runs.map((run) => run.elapsedMs)].sort((left, right) => left - right)[1],
    maxMs: Math.max(...runs.map((run) => run.elapsedMs)),
    stableBuild: true,
    exactLegalOneModNeighbors: legalNeighbors,
    exactScores,
    baseline: {
        timeToKillSeconds: baselineScore.timeToKillSeconds,
        damagePerSecond: baselineScore.damagePerSecond,
    },
    bestOneModNeighbor: {
        timeToKillSeconds: bestScore.timeToKillSeconds,
        damagePerSecond: bestScore.damagePerSecond,
        change: bestChange,
        improvesBaseline: bestChange !== null,
    },
}, null, 2));

