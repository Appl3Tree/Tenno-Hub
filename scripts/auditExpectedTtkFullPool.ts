import { filterBuilderExpertVariants, getModsForWeapon, getUnmodeledDamageEffectLines, type ModEntry } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, getWeaponDisplayName, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import { getArcanesForWeapon } from "../src/domain/catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../src/domain/logic/arcaneEffects";
import { getUnmodeledScoringEffectLines } from "../src/domain/catalog/modEffectUtils";
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
const weapon = getWeaponCatalog().find((entry) =>
    entry.name === weaponName || getWeaponDisplayName(entry) === weaponName,
);
if (!weapon) throw new Error(`Weapon not found: ${weaponName}`);

const attackIndex = attackName ? weapon.attacks.findIndex((attack) => attack.name === attackName) : 0;
if (attackIndex < 0) throw new Error(`Attack not found: ${weaponName} / ${attackName}`);
const attack = weapon.attacks[attackIndex] ?? null;
const scoringWeapon = attack ? withSelectedAttack(weapon, attackIndex) : weapon;
const conditionalState: ConditionalState = { mode: stateMode };
const arcaneName = option("arcane", "").trim();
const jointArcane = option("joint-arcane", "false").toLowerCase() === "true";
if (jointArcane && arcaneName) throw new Error("Use --joint-arcane=true or --arcane=<name>, not both");
const hasWarframeArmor = process.argv.some((argument) => argument.startsWith("--warframe-armor="));
const warframeArmor = numericOption("warframe-armor", 0);
const warframeMaxEnergy = numericOption("warframe-max-energy", 1_000);
const warframeEnergyPercent = Math.min(100, numericOption("warframe-energy-percent", 100));
const energyContext = jointArcane ? { warframeMaxEnergy, warframeEnergyPercent } : undefined;
const arcane = arcaneName
    ? getArcanesForWeapon(weapon).find((entry) => entry.name.toLowerCase() === arcaneName.toLowerCase()) ?? null
    : null;
if (arcaneName && !arcane) throw new Error("Arcane not found for weapon: " + arcaneName);
const arcaneCandidates = jointArcane ? getArcanesForWeapon(weapon) : arcane ? [arcane] : [];
if (jointArcane && arcaneCandidates.length === 0) {
    throw new Error(`No compatible Arcanes exist for ${getWeaponDisplayName(weapon)}`);
}
if (arcaneCandidates.some((candidate) => candidate.armorScaledWeaponDamage) && !hasWarframeArmor) {
    throw new Error("--warframe-armor is required when eligible Arcanes scale with Warframe Armor");
}
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
    optimizeArcane: jointArcane || !!arcane,
    arcaneCandidates,
    warframeArmor: arcaneCandidates.length > 0 ? warframeArmor : undefined,
    ...(energyContext ?? {}),
};

const optimizerStartedAt = performance.now();
const optimized = optimizeBuild(weapon, candidates, "timeToKill", slotCount, optimizerOptions);
const optimizerElapsedMs = performance.now() - optimizerStartedAt;
if (!optimized.capacityValid) throw new Error("Optimizer returned an illegal baseline build");
const optimizerArcaneEffect = optimized.arcane
    ? getArcaneEffectAtRank(optimized.arcane, optimized.arcaneRank, warframeArmor, jointArcane, energyContext)
    : null;
if (optimized.arcane && !optimizerArcaneEffect) throw new Error("Could not resolve the optimized Arcane effect");

const arcaneRankOptions = jointArcane
    ? arcaneCandidates.flatMap((candidate) =>
        Array.from({ length: candidate.maxRank + 1 }, (_, rank) => ({
            arcane: candidate,
            rank,
            effect: getArcaneEffectAtRank(candidate, rank, warframeArmor, true, energyContext),
        })).filter((option): option is typeof option & { effect: NonNullable<typeof option.effect> } =>
            !!option.effect && Object.keys(option.effect).length > 0 &&
            getUnmodeledScoringEffectLines(option.effect).length === 0,
        ),
    )
    : [];
let exactArcaneScoreCount = 0;
const scoreBuild = (mods: (ModEntry | null)[], ranks: number[]) => {
    const effects = mods.map((mod, index) => mod
        ? mod.effectsByRank[ranks[index] ?? mod.fusionLimit] ?? mod.effect
        : null);
    if (!jointArcane) {
        return {
            score: debugScoreExpectedEncounter(scoringWeapon, effects, faction, target, conditionalState, optimizerArcaneEffect),
            arcane: optimized.arcane,
            rank: optimized.arcaneRank,
            effect: optimizerArcaneEffect,
        };
    }

    let best = {
        score: debugScoreExpectedEncounter(scoringWeapon, effects, faction, target, conditionalState, null),
        arcane: null as typeof optimized.arcane,
        rank: 0,
        effect: null as typeof optimizerArcaneEffect,
    };
    exactArcaneScoreCount++;
    for (const option of arcaneRankOptions) {
        const score = debugScoreExpectedEncounter(scoringWeapon, effects, faction, target, conditionalState, option.effect);
        exactArcaneScoreCount++;
        if (better(score, best.score)) best = { score, arcane: option.arcane, rank: option.rank, effect: option.effect };
    }
    return best;
};
const proxyScoreBuild = (mods: (ModEntry | null)[], ranks: number[], arcaneEffect: typeof optimizerArcaneEffect) => debugScoreBuild(
    scoringWeapon,
    mods.map((mod, index) => mod
        ? mod.effectsByRank[ranks[index] ?? mod.fusionLimit] ?? mod.effect
        : null),
    "scaling",
    faction,
    arcaneEffect,
    target,
    conditionalState,
);

const baselineEvaluation = scoreBuild(optimized.slots, optimized.slotRanks);
const baseline = baselineEvaluation.score;
let best = {
    mods: optimized.slots,
    ranks: optimized.slotRanks,
    polarities: optimized.slotPolarities,
    score: baseline,
    arcane: baselineEvaluation.arcane,
    arcaneRank: baselineEvaluation.rank,
    change: null as null | { kind: "add" | "remove" | "replace"; slot: number; name?: string },
};
let legalNeighborhoodCount = 0;
let exactScoreCount = 0;
const seen = new Set<string>();
const neighborAudit: Array<{
    mods: Array<{ name: string; rank: number }>;
    score: { timeToKillSeconds: number | null; damagePerSecond: number };
    arcane: { name: string; rank: number } | null;
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
    const evaluation = scoreBuild(placement.slotMods, placement.slotRanks);
    const score = evaluation.score;
    const proxyScore = proxyScoreBuild(placement.slotMods, placement.slotRanks, evaluation.effect);
    exactScoreCount++;
    neighborAudit.push({
        mods: formatBuild(placement.slotMods, placement.slotRanks),
        score,
        arcane: evaluation.arcane ? { name: evaluation.arcane.name, rank: evaluation.rank } : null,
        proxyScore,
        change,
    });
    if (better(score, best.score)) {
        best = {
            mods: placement.slotMods,
            ranks: placement.slotRanks,
            polarities: placement.resultPolarities,
            score,
            arcane: evaluation.arcane,
            arcaneRank: evaluation.rank,
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
    weapon: getWeaponDisplayName(weapon),
    attack: attack?.name ?? "weapon default",
    faction,
    target,
    state: stateMode,
    slotCount,
    formaLimit,
    jointArcane,
    arcane: baselineEvaluation.arcane
        ? { name: baselineEvaluation.arcane.name, rank: baselineEvaluation.rank, warframeArmor }
        : null,
    arcaneCandidates: jointArcane ? arcaneCandidates.length : arcane ? 1 : 0,
    modeledArcaneRanks: jointArcane ? arcaneRankOptions.length : 0,
    warframeArmor: jointArcane ? warframeArmor : undefined,
    warframeMaxEnergy: jointArcane ? warframeMaxEnergy : undefined,
    warframeEnergyPercent: jointArcane ? warframeEnergyPercent : undefined,
    candidatePool: candidates.length,
    eligibleFullPoolCandidates: eligibleCandidates.length,
    optimizerBuild: formatBuild(optimized.slots, optimized.slotRanks),
    optimizer: scoreSummary(baseline),
    optimizerFormaUsed: baselineForma,
    optimizerElapsedMs: Number(optimizerElapsedMs.toFixed(1)),
    exactLegalOneModNeighbors: legalNeighborhoodCount,
    exactScoresComputed: exactScoreCount,
    exactArcaneScoresComputed: exactArcaneScoreCount,
    bestOneModNeighbor: formatBuild(best.mods, best.ranks),
    bestNeighborArcane: best.arcane ? { name: best.arcane.name, rank: best.arcaneRank } : null,
    bestNeighbor: scoreSummary(best.score),
    bestNeighborFormaUsed: bestForma,
    change: best.change,
    improvement: better(best.score, baseline),
    topExactNeighbors: [...neighborAudit]
        .sort((left, right) => better(left.score, right.score) ? -1 : better(right.score, left.score) ? 1 : 0)
        .slice(0, 10)
        .map(({ mods, score, arcane, proxyScore, change }) => ({ mods, score: scoreSummary(score), arcane, proxyScore, change })),
    topProxyNeighbors: [...neighborAudit]
        .sort((left, right) => right.proxyScore - left.proxyScore)
        .slice(0, 15)
        .map(({ mods, score, arcane, proxyScore, change }) => ({ mods, score: scoreSummary(score), arcane, proxyScore, change })),
    blazeProposals: neighborAudit
        .filter((entry) => entry.change.name === "Blaze")
        .sort((left, right) => right.proxyScore - left.proxyScore)
        .map(({ mods, score, arcane, proxyScore, change }) => ({ mods, score: scoreSummary(score), arcane, proxyScore, change })),
    springLoadedChamberProposals: neighborAudit
        .filter((entry) => entry.change.name === "Spring-Loaded Chamber")
        .sort((left, right) => right.proxyScore - left.proxyScore)
        .map(({ score, arcane, proxyScore, change }) => ({ score: scoreSummary(score), arcane, proxyScore, change })),
}, null, 2));

