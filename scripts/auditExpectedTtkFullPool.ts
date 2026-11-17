import { filterBuilderExpertVariants, getModsForWeapon, getUnmodeledDamageEffectLines, type ModEntry } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import { countPolarityChanges, fitsWithinCapacity } from "../src/domain/logic/capacityCalc";
import {
    assignModsToSlots,
    debugScoreBuild,
    debugScoreExpectedEncounter,
    optimizeBuild,
    type TargetProfileOverride,
} from "../src/domain/logic/buildOptimizer";
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

function better(
    candidate: { timeToKillSeconds: number | null; damagePerSecond: number },
    incumbent: { timeToKillSeconds: number | null; damagePerSecond: number },
): boolean {
    if (candidate.timeToKillSeconds !== null) {
        if (incumbent.timeToKillSeconds === null) return true;
        return candidate.timeToKillSeconds < incumbent.timeToKillSeconds - 1e-9 ||
            (Math.abs(candidate.timeToKillSeconds - incumbent.timeToKillSeconds) <= 1e-9 &&
                candidate.damagePerSecond > incumbent.damagePerSecond + 1e-8);
    }
    return incumbent.timeToKillSeconds === null &&
        candidate.damagePerSecond > incumbent.damagePerSecond + 1e-8;
}

const weaponName = option("weapon", "Braton Prime");
const attackName = option("attack", "");
const faction = option("faction", "Grineer");
const stateMode = option("state", "initial") as ConditionalState["mode"];
if (!["initial", "fullyStacked", "realistic", "custom"].includes(stateMode)) {
    throw new Error(`Unsupported --state value: ${stateMode}`);
}
const target: TargetProfileOverride = {
    description: "Full-catalog exact one-mod neighborhood audit",
    health: numericOption("health", 100000),
    shields: numericOption("shields", 0),
    overguard: numericOption("overguard", 0),
    armor: numericOption("armor", 3000),
};
const slotCount = Math.max(1, Math.min(8, Math.floor(numericOption("slots", 8))));
const formaLimit = Math.max(0, Math.min(slotCount, Math.floor(numericOption("forma", 3))));
const weapon = getWeaponCatalog().find((entry) => entry.name === weaponName);
if (!weapon) throw new Error(`Weapon not found: ${weaponName}`);

const attackIndex = attackName ? weapon.attacks.findIndex((attack) => attack.name === attackName) : 0;
if (attackIndex < 0) throw new Error(`Attack not found: ${weaponName} / ${attackName}`);
const attack = weapon.attacks[attackIndex] ?? null;
const scoringWeapon = attack ? withSelectedAttack(weapon, attackIndex) : weapon;
const conditionalState: ConditionalState = { mode: stateMode };
const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon));
const familyHasStandard = new Set<string>();
for (const mod of candidates) {
    if (
        mod.hasDamageEffect && !mod.isAura && !isFlawedVariant(mod.path) &&
        getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0 &&
        (!mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === faction.toLowerCase())
    ) familyHasStandard.add(variantFamily(mod.path));
}
const eligibleCandidates = candidates.filter((mod) => {
    if (!mod.hasDamageEffect || mod.isAura) return false;
    if (isFlawedVariant(mod.path) && familyHasStandard.has(variantFamily(mod.path))) return false;
    if (mod.effect.targetFaction && mod.effect.targetFaction.toLowerCase() !== faction.toLowerCase()) return false;
    return getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0;
});

const defaultPolarities = Array.from({ length: slotCount }, (_, index) => weapon.polarities[index] ?? "");
const capacityConfig = {
    weaponRank: weapon.canOverLevel ? 40 : 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: weapon.canOverLevel,
};
const optimizerOptions = {
    targetFaction: faction,
    targetProfileOverride: target,
    conditionalState,
    buildForAttack: attack,
    capacityConfig,
    slotPolarities: defaultPolarities,
    defaultSlotPolarities: defaultPolarities,
    allowCatalyst: true,
    allowForma: true,
    maxFormaCount: formaLimit,
    optimizeExilus: false,
    optimizeArcane: false,
};

const optimized = optimizeBuild(weapon, candidates, "timeToKill", slotCount, optimizerOptions);
if (!optimized.capacityValid) throw new Error("Optimizer returned an illegal baseline build");

const scoreBuild = (mods: (ModEntry | null)[], ranks: number[]) => debugScoreExpectedEncounter(
    scoringWeapon,
    mods.map((mod, index) => mod
        ? mod.effectsByRank[ranks[index] ?? mod.fusionLimit] ?? mod.effect
        : null),
    faction,
    target,
    conditionalState,
);
const proxyScoreBuild = (mods: (ModEntry | null)[], ranks: number[]) => debugScoreBuild(
    scoringWeapon,
    mods.map((mod, index) => mod
        ? mod.effectsByRank[ranks[index] ?? mod.fusionLimit] ?? mod.effect
        : null),
    "scaling",
    faction,
    undefined,
    target,
    conditionalState,
);

const baseline = scoreBuild(optimized.slots, optimized.slotRanks);
let best = {
    mods: optimized.slots,
    ranks: optimized.slotRanks,
    polarities: optimized.slotPolarities,
    score: baseline,
    change: null as null | { kind: "add" | "remove" | "replace"; slot: number; name?: string },
};
let legalNeighborhoodCount = 0;
let exactScoreCount = 0;
const seen = new Set<string>();
const neighborAudit: Array<{
    mods: Array<{ name: string; rank: number }>;
    score: { timeToKillSeconds: number | null; damagePerSecond: number };
    proxyScore: number;
    change: { kind: "add" | "remove" | "replace"; slot: number; name?: string };
}> = [];

const baselineEntries = optimized.slots.flatMap((mod, index) => mod
    ? [{ mod, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
    : []);
const consider = (
    entries: Array<{ mod: ModEntry; rank: number }>,
    change: { kind: "add" | "remove" | "replace"; slot: number; name?: string },
) => {
    const selected = entries.map((entry) => entry.mod);
    const ranks = entries.map((entry) => entry.rank);
    if (selected.some((mod, index) => selected.some((other, otherIndex) =>
        otherIndex < index && (other.uniqueName === mod.uniqueName || other.incompatibilityGroup === mod.incompatibilityGroup),
    ))) return;

    const placement = assignModsToSlots(selected, ranks, defaultPolarities, slotCount, true, formaLimit);
    const placedCount = placement.slotMods.filter(Boolean).length;
    if (placedCount !== selected.length) return;
    const formaUsed = countPolarityChanges(defaultPolarities, placement.resultPolarities);
    if (formaUsed > formaLimit) return;
    if (!fitsWithinCapacity(capacityConfig, placement.resultPolarities, placement.slotMods, placement.slotRanks)) return;

    const signature = placement.slotMods.map((mod, index) => mod
        ? `${mod.uniqueName}@${placement.slotRanks[index]}`
        : "_").join("|");
    if (seen.has(signature)) return;
    seen.add(signature);

    legalNeighborhoodCount++;
    const score = scoreBuild(placement.slotMods, placement.slotRanks);
    const proxyScore = proxyScoreBuild(placement.slotMods, placement.slotRanks);
    exactScoreCount++;
    neighborAudit.push({
        mods: formatBuild(placement.slotMods, placement.slotRanks),
        score,
        proxyScore,
        change,
    });
    if (better(score, best.score)) {
        best = {
            mods: placement.slotMods,
            ranks: placement.slotRanks,
            polarities: placement.resultPolarities,
            score,
            change,
        };
    }
};

for (let index = 0; index < baselineEntries.length; index++) {
    consider(
        baselineEntries.filter((_, entryIndex) => entryIndex !== index),
        { kind: "remove", slot: index },
    );
    for (const candidate of eligibleCandidates) {
        if (candidate.uniqueName === baselineEntries[index].mod.uniqueName) continue;
        consider(
            baselineEntries.map((entry, entryIndex) => entryIndex === index
                ? { mod: candidate, rank: candidate.fusionLimit }
                : entry),
            { kind: "replace", slot: index, name: candidate.name },
        );
    }
}

if (baselineEntries.length < slotCount) {
    for (const candidate of eligibleCandidates) {
        if (baselineEntries.some((entry) => entry.mod.uniqueName === candidate.uniqueName)) continue;
        consider(
            [...baselineEntries, { mod: candidate, rank: candidate.fusionLimit }],
            { kind: "add", slot: baselineEntries.length, name: candidate.name },
        );
    }
}

const scoreSummary = (score: { timeToKillSeconds: number | null; damagePerSecond: number }) => ({
    ttkSeconds: score.timeToKillSeconds,
    damagePerSecond: score.damagePerSecond,
});
function formatBuild(mods: (ModEntry | null)[], ranks: number[]) {
    return mods.flatMap((mod, index) => mod
        ? [{ name: mod.name, rank: ranks[index] ?? mod.fusionLimit }]
        : []);
}
const baselineForma = countPolarityChanges(defaultPolarities, optimized.slotPolarities);
const bestForma = countPolarityChanges(defaultPolarities, best.polarities);

console.log(JSON.stringify({
    weapon: weapon.name,
    attack: attack?.name ?? "weapon default",
    faction,
    target,
    state: stateMode,
    slotCount,
    formaLimit,
    candidatePool: candidates.length,
    eligibleFullPoolCandidates: eligibleCandidates.length,
    optimizerBuild: formatBuild(optimized.slots, optimized.slotRanks),
    optimizer: scoreSummary(baseline),
    optimizerFormaUsed: baselineForma,
    exactLegalOneModNeighbors: legalNeighborhoodCount,
    exactScoresComputed: exactScoreCount,
    bestOneModNeighbor: formatBuild(best.mods, best.ranks),
    bestNeighbor: scoreSummary(best.score),
    bestNeighborFormaUsed: bestForma,
    change: best.change,
    improvement: better(best.score, baseline),
    topExactNeighbors: [...neighborAudit]
        .sort((left, right) => better(left.score, right.score) ? -1 : better(right.score, left.score) ? 1 : 0)
        .slice(0, 10)
        .map(({ mods, score, proxyScore, change }) => ({ mods, score: scoreSummary(score), proxyScore, change })),
    topProxyNeighbors: [...neighborAudit]
        .sort((left, right) => right.proxyScore - left.proxyScore)
        .slice(0, 15)
        .map(({ mods, score, proxyScore, change }) => ({ mods, score: scoreSummary(score), proxyScore, change })),
    blazeProposals: neighborAudit
        .filter((entry) => entry.change.name === "Blaze")
        .sort((left, right) => right.proxyScore - left.proxyScore)
        .map(({ mods, score, proxyScore, change }) => ({ mods, score: scoreSummary(score), proxyScore, change })),
    springLoadedChamberProposals: neighborAudit
        .filter((entry) => entry.change.name === "Spring-Loaded Chamber")
        .sort((left, right) => right.proxyScore - left.proxyScore)
        .map(({ score, proxyScore, change }) => ({ score: scoreSummary(score), proxyScore, change })),
}, null, 2));

