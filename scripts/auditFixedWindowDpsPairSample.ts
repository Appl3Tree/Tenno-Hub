import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { filterBuilderExpertVariants, getModsForWeapon, getUnmodeledDamageEffectLines, type ModEntry } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, getWeaponDisplayName, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import {
    CANONICAL_FACTIONS,
    assignModsToSlots,
    debugEvaluateFixedWindowDps,
    FIXED_WINDOW_DPS_SECONDS,
} from "../src/domain/logic/buildOptimizerCore";
import { optimizeBuild } from "../src/domain/logic/buildOptimizer";
import { countPolarityChanges, effectiveDrain, fitsWithinCapacity, totalModCapacity } from "../src/domain/logic/capacityCalc";
import type { ConditionalState } from "../src/domain/logic/damageCalc";

type Fixture = {
    category: string;
    weapon: string;
    attack: string;
    selection: "fixed" | "seeded";
    attackDistanceMeters?: number | null;
};

type ScoredBuild = {
    damagePerSecond: number;
    damageInWindow: number;
    timeToKillSeconds: number | null;
};

type PlacedBuild = {
    mods: (ModEntry | null)[];
    ranks: number[];
    polarities: string[];
    removed: string[];
    added: string[];
    score?: ScoredBuild;
};

function option(name: string, fallback: string): string {
    const prefix = `--${name}=`;
    return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function integerOption(name: string, fallback: number, maximum: number): number {
    const value = Number(option(name, String(fallback)));
    if (!Number.isInteger(value) || value < 0 || value > maximum) {
        throw new Error(`--${name} must be an integer between 0 and ${maximum}`);
    }
    return value;
}

function nonNegativeIntegerOption(name: string, fallback: number): number {
    const value = Number(option(name, String(fallback)));
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`--${name} must be a non-negative safe integer`);
    }
    return value;
}

function positiveIntegerOption(name: string, fallback: number): number {
    const value = Number(option(name, String(fallback)));
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`--${name} must be a positive safe integer`);
    }
    return value;
}

function conditionalStateOption(): ConditionalState {
    const stateMode = option("state", "realistic");
    const supportedModes: readonly ConditionalState["mode"][] = ["initial", "fullyStacked", "realistic", "custom"];
    if (!supportedModes.includes(stateMode as ConditionalState["mode"])) {
        throw new Error("--state must be initial, fullyStacked, realistic, or custom");
    }
    const mode = stateMode as ConditionalState["mode"];
    const externalStacks = nonNegativeIntegerOption("stacks", 0);
    return {
        mode,
        ...(mode === "custom" ? { externalStacks } : {}),
    };
}

function targetFactionOption(): string {
    const faction = option("faction", "Grineer").trim();
    if (!CANONICAL_FACTIONS.some((candidate) => candidate.toLowerCase() === faction.toLowerCase())) {
        throw new Error(`--faction must be one of: ${CANONICAL_FACTIONS.join(", ")}`);
    }
    return faction;
}

function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        let value = state += 0x6d2b79f5;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function isFlawedVariant(path: string): boolean {
    return /\/(?:beginner|intermediate|expert)\//i.test(path) || /(?:Beginner|Intermediate|Expert)$/i.test(path);
}

function variantFamily(path: string): string {
    return path
        .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
        .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function formatBuild(mods: (ModEntry | null)[], ranks: number[]) {
    return mods.flatMap((mod, index) => mod
        ? [{ name: mod.name, rank: ranks[index] ?? mod.fusionLimit }]
        : []);
}

function better(candidate: ScoredBuild, incumbent: ScoredBuild): boolean {
    return candidate.damagePerSecond > incumbent.damagePerSecond + 1e-8 ||
        (Math.abs(candidate.damagePerSecond - incumbent.damagePerSecond) <= 1e-8 &&
            candidate.damageInWindow > incumbent.damageInWindow + 1e-7);
}

function runCorpus(): void {
    const seed = integerOption("seed", 20261145, 0xffffffff);
    const sampleCount = integerOption("samples", 1024, 100000);
    if (sampleCount < 1) throw new Error("--samples must be at least 1");
    const conditionalState = conditionalStateOption();
    const targetFaction = targetFactionOption();
    const target = {
        health: positiveIntegerOption("health", 2_000_000),
        shields: nonNegativeIntegerOption("shields", 0),
        overguard: nonNegativeIntegerOption("overguard", 0),
        armor: nonNegativeIntegerOption("armor", 3_000),
    };
    const corpusRunner = resolve("scripts/auditFixedWindowDpsCorpus.ts");
    const listed = spawnSync(process.execPath, [
        "--import", "tsx/esm", corpusRunner, `--seed=${seed}`, "--dry-run",
    ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (listed.error) throw listed.error;
    if (listed.status !== 0) throw new Error(`Fixture listing failed: ${listed.stderr}`);
    const corpus = JSON.parse(listed.stdout) as {
        assumptions: Record<string, unknown>;
        fixtures: Fixture[];
    };

    const results = [];
    const pairRunner = resolve("scripts/auditFixedWindowDpsPairSample.ts");
    for (const [index, fixture] of corpus.fixtures.entries()) {
        const fixtureSeed = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
        const child = spawnSync(process.execPath, [
            "--import", "tsx/esm", pairRunner, "--worker",
            `--weapon=${fixture.weapon}`,
            `--attack=${fixture.attack}`,
            `--samples=${sampleCount}`,
            `--seed=${fixtureSeed}`,
            `--state=${conditionalState.mode}`,
            `--stacks=${conditionalState.externalStacks ?? 0}`,
            `--faction=${targetFaction}`,
            `--health=${target.health}`,
            `--shields=${target.shields}`,
            `--overguard=${target.overguard}`,
            `--armor=${target.armor}`,
            ...(fixture.attackDistanceMeters === undefined || fixture.attackDistanceMeters === null
                ? []
                : [`--attack-distance=${fixture.attackDistanceMeters}`]),
        ], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
        if (child.error) throw child.error;
        if (child.status !== 0) {
            throw new Error(`${fixture.weapon} / ${fixture.attack} pair sample failed (exit ${child.status}): ${child.stderr}`);
        }
        const result = JSON.parse(child.stdout);
        results.push({ category: fixture.category, selection: fixture.selection, ...result });
        console.error(
            `[${index + 1}/${corpus.fixtures.length}] ${fixture.weapon} / ${fixture.attack}: ` +
            `${result.improvementsFound} sampled pair improvements in ${result.sampledLegalPairs} ` +
            `legal moves from ${result.rawProposalsExamined} raw tuples; best ${result.bestSampledDps} DPS`,
        );
    }

    console.log(JSON.stringify({
        seed,
        randomGenerator: "Mulberry32; fixture seeds are base seed plus Math.imul(index + 1, 0x9e3779b9), uint32",
        sampleMethod: "Sample raw outgoing-pair × incoming-full-catalog-pair tuples without replacement; reject unsupported, duplicate, or illegal builds, then exact-score accepted builds",
        samplesPerFixture: sampleCount,
        assumptions: {
            ...corpus.assumptions,
            faction: targetFaction,
            target,
            conditionalState: {
                mode: conditionalState.mode,
                externalStacks: conditionalState.mode === "custom" ? conditionalState.externalStacks ?? 0 : null,
            },
            moves: "replace exactly two installed mods with two distinct eligible full-catalog mods at maximum rank; reassign slots and allow up to three Forma",
            neighborAudit: "sample exact legal two-out/two-in replacements without replacement from eligible raw tuples",
            score: "exact deterministic single-target damage applied in [0,5s), divided by five seconds",
        },
        fixtureCount: corpus.fixtures.length,
        fixtures: corpus.fixtures,
        targetProfile: { faction: targetFaction, ...target },
        totalRawProposalsExamined: results.reduce((total, result) => total + result.rawProposalsExamined, 0),
        totalSampledLegalPairs: results.reduce((total, result) => total + result.sampledLegalPairs, 0),
        totalImprovementsFound: results.reduce((total, result) => total + result.improvementsFound, 0),
        results,
    }, null, 2));
}

function runFixture(): void {
    const weaponName = option("weapon", "");
    const attackName = option("attack", "");
    const baselineFile = process.argv.find((argument) => argument.startsWith("--baseline-file="))
        ?.slice("--baseline-file=".length);
    const capturedBaseline = baselineFile
        ? JSON.parse(readFileSync(resolve(baselineFile), "utf8")) as {
            weaponName?: string;
            attackName?: string;
            underframeMods?: Array<{ name: string; rank: number }>;
            mods?: Array<{ name: string; rank: number }>;
        }
        : null;
    const capturedRequests = capturedBaseline?.underframeMods ?? capturedBaseline?.mods ?? null;
    if (capturedBaseline && !Array.isArray(capturedRequests)) {
        throw new Error("--baseline-file must contain an object with an underframeMods or mods array");
    }
    const seed = integerOption("seed", 0, 0xffffffff);
    const sampleCount = integerOption("samples", 1024, 100000);
    if (sampleCount < 1) throw new Error("--samples must be at least 1");
    const conditionalState = conditionalStateOption();
    const attackDistanceArgument = process.argv.find((argument) => argument.startsWith("--attack-distance="));
    const targetDistanceMeters = attackDistanceArgument === undefined
        ? undefined
        : Number(attackDistanceArgument.slice("--attack-distance=".length));
    if (targetDistanceMeters !== undefined && (!Number.isFinite(targetDistanceMeters) || targetDistanceMeters < 0)) {
        throw new Error("--attack-distance must be a non-negative finite number");
    }

    const faction = targetFactionOption();
    const target = {
        description: "Seeded fixed-window legal two-mod replacement sample",
        health: positiveIntegerOption("health", 2_000_000),
        shields: nonNegativeIntegerOption("shields", 0),
        overguard: nonNegativeIntegerOption("overguard", 0),
        armor: nonNegativeIntegerOption("armor", 3_000),
        toxinBypassesShields: true,
    };
    const slotCount = 8;
    const formaLimit = 3;
    const weapon = getWeaponCatalog().find((entry) =>
        entry.name === weaponName || getWeaponDisplayName(entry) === weaponName,
    );
    if (!weapon) throw new Error(`Weapon not found: ${weaponName}`);
    if (capturedBaseline?.weaponName && capturedBaseline.weaponName.toLowerCase() !== getWeaponDisplayName(weapon).toLowerCase()) {
        throw new Error(`Captured baseline weapon ${capturedBaseline.weaponName} does not match ${getWeaponDisplayName(weapon)}`);
    }
    const attackIndex = weapon.attacks.findIndex((entry) => entry.name === attackName);
    if (attackIndex < 0) throw new Error(`Attack not found: ${weaponName} / ${attackName}`);
    const attack = weapon.attacks[attackIndex];
    if (!attack) throw new Error(`Attack not found: ${weaponName} / ${attackName}`);
    if (capturedBaseline?.attackName && capturedBaseline.attackName.toLowerCase() !== attack.name.toLowerCase()) {
        throw new Error(`Captured baseline attack ${capturedBaseline.attackName} does not match ${attack.name}`);
    }
    const scoringWeapon = withSelectedAttack(weapon, attackIndex);
    if (targetDistanceMeters !== undefined) {
        conditionalState.targetDistanceMeters = targetDistanceMeters;
        conditionalState.attackFalloffDistanceMeters = targetDistanceMeters;
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
    const capacityLimit = totalModCapacity(capacityConfig);
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
    const optimizerStartedAt = performance.now();
    const optimized = optimizeBuild(scoringWeapon, candidates, "windowDps", slotCount, optimizerOptions);
    const optimizerElapsedMs = Math.round((performance.now() - optimizerStartedAt) * 10) / 10;
    if (!optimized.capacityValid || countPolarityChanges(defaultPolarities, optimized.slotPolarities) > formaLimit) {
        throw new Error("Optimizer returned an illegal baseline build");
    }

    const scoreBuild = (mods: (ModEntry | null)[], ranks: number[]): ScoredBuild => {
        const evaluation = debugEvaluateFixedWindowDps(
            scoringWeapon,
            mods.map((mod, index) => mod
                ? mod.effectsByRank[ranks[index] ?? mod.fusionLimit] ?? mod.effect
                : null),
            faction,
            target,
            conditionalState,
        );
        return {
            damagePerSecond: evaluation.damagePerSecond,
            damageInWindow: evaluation.damageInWindow,
            timeToKillSeconds: evaluation.timeToKillSeconds,
        };
    };
    const optimizerEntries = optimized.slots.flatMap((mod, index) => mod
        ? [{ mod, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
        : []);
    const baselineEntries = capturedRequests
        ? capturedRequests.map(({ name, rank }) => {
            const variants = candidates.filter((entry) => entry.name.toLowerCase() === name.toLowerCase());
            const mod = variants.find((entry) => !isFlawedVariant(entry.path)) ?? variants[0];
            if (!mod) throw new Error(`Captured baseline mod missing from compatible candidate pool: ${name}`);
            if (!Number.isInteger(rank) || rank < 0 || rank > mod.fusionLimit) {
                throw new Error(`Captured baseline rank is invalid for ${name}: ${rank}/${mod.fusionLimit}`);
            }
            return { mod, rank };
        })
        : optimizerEntries;
    if (baselineEntries.length > slotCount) throw new Error("Captured baseline has more mods than available slots");
    const baselineUnique = new Set(baselineEntries.map(({ mod }) => (mod.uniqueName ?? mod.name).toLowerCase())).size === baselineEntries.length;
    const baselineGroups = baselineEntries.map(({ mod }) => mod.incompatibilityGroup).filter((group): group is string => !!group);
    const baselineCompatible = new Set(baselineGroups).size === baselineGroups.length;
    const baselineAssignment = capturedRequests
        ? assignModsToSlots(
            baselineEntries.map(({ mod }) => mod),
            baselineEntries.map(({ rank }) => rank),
            defaultPolarities,
            slotCount,
            true,
            formaLimit,
        )
        : {
            slotMods: optimized.slots,
            slotRanks: optimized.slotRanks,
            resultPolarities: optimized.slotPolarities,
        };
    const baselineFormaUsed = countPolarityChanges(defaultPolarities, baselineAssignment.resultPolarities);
    const baselineCapacityUsed = baselineAssignment.slotMods.reduce((total, mod, index) => mod
        ? total + effectiveDrain(mod, baselineAssignment.resultPolarities[index] ?? "", baselineAssignment.slotRanks[index] ?? mod.fusionLimit)
        : total, 0);
    const baselineLegal = baselineAssignment.slotMods.filter(Boolean).length === baselineEntries.length &&
        baselineUnique && baselineCompatible && baselineFormaUsed <= formaLimit &&
        fitsWithinCapacity(capacityConfig, baselineAssignment.resultPolarities, baselineAssignment.slotMods, baselineAssignment.slotRanks);
    if (!baselineLegal) throw new Error("Comparison baseline is not legal under the configured slots and Forma limit");
    const optimizerScore = scoreBuild(optimized.slots, optimized.slotRanks);
    const baseline = capturedRequests
        ? scoreBuild(baselineAssignment.slotMods, baselineAssignment.slotRanks)
        : optimizerScore;
    if (!capturedRequests && Math.abs(optimizerScore.damagePerSecond - optimized.windowDpsScore!) > 1e-6) {
        throw new Error("Independent fixed-window scorer did not reproduce the optimizer's reported score");
    }
    const baselineNames = new Set(baselineEntries.map(({ mod }) => mod.uniqueName));
    const outgoingPairs: Array<[number, number]> = [];
    for (let left = 0; left < baselineEntries.length; left++) {
        for (let right = left + 1; right < baselineEntries.length; right++) outgoingPairs.push([left, right]);
    }
    const incomingPairs: Array<[number, number]> = [];
    for (let left = 0; left < eligibleCandidates.length; left++) {
        for (let right = left + 1; right < eligibleCandidates.length; right++) incomingPairs.push([left, right]);
    }
    const rawProposalUniverse = outgoingPairs.length * incomingPairs.length;
    const random = mulberry32(seed);
    const sampledPairs: PlacedBuild[] = [];
    const seenRawProposals = new Set<string>();
    const seenBuilds = new Set<string>();
    let rawProposalsExamined = 0;

    // Draw raw tuples without replacement; accepting each legal tuple uniformly
    // samples the valid two-out/two-in space without scoring the full neighborhood.
    while (sampledPairs.length < sampleCount && seenRawProposals.size < rawProposalUniverse) {
        const outgoingIndex = Math.floor(random() * outgoingPairs.length);
        const incomingIndex = Math.floor(random() * incomingPairs.length);
        const rawKey = `${outgoingIndex}:${incomingIndex}`;
        if (seenRawProposals.has(rawKey)) continue;
        seenRawProposals.add(rawKey);
        rawProposalsExamined++;

        const [leftOut, rightOut] = outgoingPairs[outgoingIndex] ?? [];
        const [leftIn, rightIn] = incomingPairs[incomingIndex] ?? [];
        if (leftOut === undefined || rightOut === undefined || leftIn === undefined || rightIn === undefined) continue;
        const retained = baselineEntries.filter((_, index) => index !== leftOut && index !== rightOut);
        const left = eligibleCandidates[leftIn];
        const right = eligibleCandidates[rightIn];
        if (!left || !right || baselineNames.has(left.uniqueName) || baselineNames.has(right.uniqueName)) continue;

        const selected = [...retained.map(({ mod }) => mod), left, right];
        if (new Set(selected.map((mod) => mod.uniqueName)).size !== selected.length) continue;
        const incompatibilityGroups = selected.flatMap((mod) => mod.incompatibilityGroup ? [mod.incompatibilityGroup] : []);
        if (new Set(incompatibilityGroups).size !== incompatibilityGroups.length) continue;

        const selectedRanks = [...retained.map(({ rank }) => rank), left.fusionLimit, right.fusionLimit];
        const assignment = assignModsToSlots(selected, selectedRanks, defaultPolarities, slotCount, true, formaLimit);
        if (assignment.slotMods.filter(Boolean).length !== selected.length) continue;
        if (countPolarityChanges(defaultPolarities, assignment.resultPolarities) > formaLimit) continue;
        if (!fitsWithinCapacity(capacityConfig, assignment.resultPolarities, assignment.slotMods, assignment.slotRanks)) continue;

        const signature = assignment.slotMods.map((mod, index) => mod
            ? `${mod.uniqueName}@${assignment.slotRanks[index]}`
            : "_").join("|");
        if (seenBuilds.has(signature)) continue;
        seenBuilds.add(signature);
        sampledPairs.push({
            mods: assignment.slotMods,
            ranks: assignment.slotRanks,
            polarities: assignment.resultPolarities,
            removed: [baselineEntries[leftOut]?.mod.name ?? "", baselineEntries[rightOut]?.mod.name ?? ""],
            added: [left.name, right.name],
        });
    }

    if (sampledPairs.length === 0) throw new Error("No legal two-mod replacement candidates were generated");
    const scoringStartedAt = performance.now();
    const scoredPairs = sampledPairs.map((proposal) => ({ ...proposal, score: scoreBuild(proposal.mods, proposal.ranks) }));
    const scoringElapsedMs = Math.round((performance.now() - scoringStartedAt) * 10) / 10;
    const improvements = scoredPairs.filter(({ score }) => better(score!, baseline)).sort((left, right) =>
        better(left.score!, right.score!) ? -1 : better(right.score!, left.score!) ? 1 : 0,
    );
    const best = [...scoredPairs].sort((left, right) =>
        better(left.score!, right.score!) ? -1 : better(right.score!, left.score!) ? 1 : 0,
    )[0]!;

    console.log(JSON.stringify({
        weapon: getWeaponDisplayName(scoringWeapon),
        attack: attack.name,
        selectionSeed: seed,
        targetDistanceMeters: targetDistanceMeters ?? null,
        conditionalState: {
            mode: conditionalState.mode,
            externalStacks: conditionalState.mode === "custom" ? conditionalState.externalStacks ?? 0 : null,
        },
        scoringWindowSeconds: FIXED_WINDOW_DPS_SECONDS,
        candidatePool: candidates.length,
        eligibleFullPoolCandidates: eligibleCandidates.length,
        optimizerBuild: formatBuild(optimized.slots, optimized.slotRanks),
        optimizerCapacity: {
            used: optimized.slots.reduce((total, mod, index) => mod
                ? total + effectiveDrain(mod, optimized.slotPolarities[index] ?? "", optimized.slotRanks[index] ?? mod.fusionLimit)
                : total, 0),
            limit: capacityLimit,
            formaUsed: countPolarityChanges(defaultPolarities, optimized.slotPolarities),
            legal: optimized.capacityValid,
        },
        optimizerDps: optimizerScore.damagePerSecond,
        optimizerDamageInWindow: optimizerScore.damageInWindow,
        comparisonBaseline: {
            source: baselineFile ?? "tennoHubOptimizer",
            mods: formatBuild(baselineAssignment.slotMods, baselineAssignment.slotRanks),
            damagePerSecond: baseline.damagePerSecond,
            damageInWindow: baseline.damageInWindow,
            capacity: { used: baselineCapacityUsed, limit: capacityLimit, legal: baselineLegal, formaUsed: baselineFormaUsed },
        },
        optimizerCandidatesEvaluated: optimized.encounterCandidatesEvaluated ?? null,
        optimizerElapsedMs,
        rawProposalUniverse,
        rawProposalsExamined,
        rawProposalCoveragePercent: Math.round((rawProposalsExamined / rawProposalUniverse) * 100000) / 1000,
        requestedSample: sampleCount,
        sampledLegalPairs: sampledPairs.length,
        legalAcceptanceRatePercent: Math.round((sampledPairs.length / rawProposalsExamined) * 100000) / 1000,
        scoringElapsedMs,
        improvementsFound: improvements.length,
        bestSampledDps: best.score!.damagePerSecond,
        bestSampledDamageInWindow: best.score!.damageInWindow,
        bestSampledRemovedMods: best.removed,
        bestSampledAddedMods: best.added,
        topImprovements: improvements.slice(0, 10).map((entry) => ({
            removedMods: entry.removed,
            addedMods: entry.added,
            dps: entry.score!.damagePerSecond,
            damageInWindow: entry.score!.damageInWindow,
            formaUsed: countPolarityChanges(defaultPolarities, entry.polarities),
        })),
    }, null, 2));
}

if (process.argv.includes("--worker") || process.argv.some((argument) => argument.startsWith("--baseline-file="))) runFixture();
else runCorpus();
