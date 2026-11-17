import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { filterBuilderExpertVariants, getModsForWeapon, getUnmodeledDamageEffectLines, type ModEntry } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack } from "../src/domain/catalog/weaponCatalog";
import { countPolarityChanges, fitsWithinCapacity } from "../src/domain/logic/capacityCalc";
import {
    assignModsToSlots,
    debugScoreExpectedEncounter,
    optimizeBuild,
    type TargetProfileOverride,
} from "../src/domain/logic/buildOptimizer";
import type { ConditionalState } from "../src/domain/logic/damageCalc";

type Fixture = { category: string; weapon: string; attack: string; selection: "fixed" | "seeded" };
type ScoredBuild = { timeToKillSeconds: number | null; damagePerSecond: number };
type PlacedBuild = {
    mods: (ModEntry | null)[];
    ranks: number[];
    polarities: string[];

    removed: string[];
    added: string[];
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
    return /\/beginner\//i.test(path) || /Beginner$/i.test(path);
}

function variantFamily(path: string): string {
    return path
        .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
        .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function better(candidate: ScoredBuild, incumbent: ScoredBuild): boolean {
    if (candidate.timeToKillSeconds !== null) {
        if (incumbent.timeToKillSeconds === null) return true;
        return candidate.timeToKillSeconds < incumbent.timeToKillSeconds - 1e-9 ||
            (Math.abs(candidate.timeToKillSeconds - incumbent.timeToKillSeconds) <= 1e-9 &&
                candidate.damagePerSecond > incumbent.damagePerSecond + 1e-8);
    }
    return incumbent.timeToKillSeconds === null &&
        candidate.damagePerSecond > incumbent.damagePerSecond + 1e-8;
}

function formatBuild(mods: (ModEntry | null)[], ranks: number[]) {
    return mods.flatMap((mod, index) => mod
        ? [{ name: mod.name, rank: ranks[index] ?? mod.fusionLimit }]
        : []);
}

function runCorpus(): void {
    const seed = integerOption("seed", 20261117, 0xffffffff);
    const sampleCount = integerOption("samples", 1024, 100000);
    if (sampleCount < 1) throw new Error("--samples must be at least 1");
    const corpusRunner = resolve("scripts/auditExpectedTtkCorpus.ts");
    const listed = spawnSync(process.execPath, [
        "--import", "tsx/esm", corpusRunner, `--seed=${seed}`, "--dry-run",
    ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (listed.error) throw listed.error;
    if (listed.status !== 0) throw new Error(`Fixture listing failed: ${listed.stderr}`);
    const corpus = JSON.parse(listed.stdout) as {
        seed: number;
        randomGenerator: string;
        assumptions: Record<string, unknown>;
        fixtures: Fixture[];
    };

    const results = [];
    const pairRunner = resolve("scripts/auditExpectedTtkPairSample.ts");
    for (const [index, fixture] of corpus.fixtures.entries()) {
        const fixtureSeed = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
        const child = spawnSync(process.execPath, [
            "--import", "tsx/esm", pairRunner, "--worker",
            `--weapon=${fixture.weapon}`,
            `--attack=${fixture.attack}`,
            `--samples=${sampleCount}`,
            `--seed=${fixtureSeed}`,
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
            `legal moves from ${result.rawProposalsExamined} raw tuples; best ${result.bestSampledTtkSeconds}s`,
        );
    }

    console.log(JSON.stringify({
        seed,
        randomGenerator: "Mulberry32; fixture seeds are base seed plus Math.imul(index + 1, 0x9e3779b9), uint32",
        sampleMethod: "Uniform sampling without replacement over outgoing-pair × incoming-full-catalog-pair tuples; incompatible or illegal tuples are rejected, yielding a uniform legal-pair sample",
        samplesPerFixture: sampleCount,
        assumptions: {
            faction: "Grineer",
            target: { health: 100000, shields: 0, overguard: 0, armor: 3000 },
            state: "realistic",
            mainSlots: 8,
            catalyst: true,
            masteryRank: 30,
            formaLimit: 3,
            incomingRanks: "maximum rank",
            arcaneOptimization: false,
            exilusOptimization: false,
            moves: "replace exactly two installed mods with two distinct eligible full-catalog mods; reassign slots and allow up to three Forma",
            score: "exact finite Expected TTK",
        },
        fixtureCount: corpus.fixtures.length,
        fixtures: corpus.fixtures,
        results,
    }, null, 2));
}

function runFixture(): void {
    const weaponName = option("weapon", "");
    const attackName = option("attack", "");
    const faction = "Grineer";
    const stateMode: ConditionalState["mode"] = "realistic";
    const seed = integerOption("seed", 0, 0xffffffff);
    const sampleCount = integerOption("samples", 1024, 100000);
    if (sampleCount < 1) throw new Error("--samples must be at least 1");
    const target: TargetProfileOverride = {
        description: "Seeded full-pool legal two-mod replacement sample",
        health: 100000,
        shields: 0,
        overguard: 0,
        armor: 3000,
    };
    const slotCount = 8;
    const formaLimit = 3;
    const weapon = getWeaponCatalog().find((entry) => entry.name === weaponName);
    if (!weapon) throw new Error(`Weapon not found: ${weaponName}`);
    const attackIndex = weapon.attacks.findIndex((attack) => attack.name === attackName);
    if (attackIndex < 0) throw new Error(`Attack not found: ${weaponName} / ${attackName}`);
    const attack = weapon.attacks[attackIndex] ?? null;
    const scoringWeapon = withSelectedAttack(weapon, attackIndex);
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
    const startedAt = performance.now();
    const optimized = optimizeBuild(weapon, candidates, "timeToKill", slotCount, optimizerOptions);
    const optimizerElapsedMs = Math.round((performance.now() - startedAt) * 10) / 10;
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
    const baseline = scoreBuild(optimized.slots, optimized.slotRanks);
    const baselineEntries = optimized.slots.flatMap((mod, index) => mod
        ? [{ mod, rank: optimized.slotRanks[index] ?? mod.fusionLimit }]
        : []);
    const random = mulberry32(seed);
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
    const sampledPairs: PlacedBuild[] = [];
    const seenRawProposals = new Set<string>();
    const seenBuilds = new Set<string>();
    let rawProposalsExamined = 0;

    // Randomly order the raw two-out/two-in tuples and accept legal results.
    // This is a uniform sample without replacement over legal tuples, without
    // enumerating and scoring the whole neighborhood.
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
        const uniqueNames = new Set(selected.map((mod) => mod.uniqueName));
        if (uniqueNames.size !== selected.length) continue;
        const incompatibilityGroups = selected.flatMap((mod) => mod.incompatibilityGroup
            ? [mod.incompatibilityGroup]
            : []);
        if (new Set(incompatibilityGroups).size !== incompatibilityGroups.length) continue;

        const selectedRanks = [
            ...retained.map(({ rank }) => rank),
            left.fusionLimit,
            right.fusionLimit,
        ];
        const assigned = assignModsToSlots(selected, selectedRanks, defaultPolarities, slotCount, true, formaLimit);
        if (assigned.slotMods.filter(Boolean).length !== selected.length) continue;
        const formaUsed = countPolarityChanges(defaultPolarities, assigned.resultPolarities);
        if (formaUsed > formaLimit) continue;
        if (!fitsWithinCapacity(capacityConfig, assigned.resultPolarities, assigned.slotMods, assigned.slotRanks)) continue;

        const signature = assigned.slotMods.map((mod, index) => mod
            ? `${mod.uniqueName}@${assigned.slotRanks[index]}`
            : "_").join("|");
        if (seenBuilds.has(signature)) continue;
        seenBuilds.add(signature);
        sampledPairs.push({
            mods: assigned.slotMods,
            ranks: assigned.slotRanks,
            polarities: assigned.resultPolarities,
            removed: [baselineEntries[leftOut]?.mod.name ?? "", baselineEntries[rightOut]?.mod.name ?? ""],
            added: [left.name, right.name],
        });
    }

    if (sampledPairs.length === 0) throw new Error("No legal two-mod replacement candidates were generated");
    const scored = sampledPairs.map((proposal) => ({ ...proposal, score: scoreBuild(proposal.mods, proposal.ranks) }));
    const improvements = scored.filter(({ score }) => better(score!, baseline)).sort((left, right) =>
        better(left.score!, right.score!) ? -1 : better(right.score!, left.score!) ? 1 : 0,
    );
    const best = [...scored].sort((left, right) =>
        better(left.score!, right.score!) ? -1 : better(right.score!, left.score!) ? 1 : 0,
    )[0]!;

    console.log(JSON.stringify({
        weapon: weapon.name,
        attack: attack.name,
        seed,
        candidatePool: candidates.length,
        eligibleFullPoolCandidates: eligibleCandidates.length,
        optimizerBuild: formatBuild(optimized.slots, optimized.slotRanks),
        optimizerTtkSeconds: baseline.timeToKillSeconds,
        optimizerDps: baseline.damagePerSecond,
        optimizerFormaUsed: countPolarityChanges(defaultPolarities, optimized.slotPolarities),
        optimizerElapsedMs,
        rawProposalUniverse,
        rawProposalsExamined,
        rawProposalCoveragePercent: Math.round((rawProposalsExamined / rawProposalUniverse) * 100000) / 1000,
        requestedSample: sampleCount,
        sampledLegalPairs: sampledPairs.length,
        legalAcceptanceRatePercent: Math.round((sampledPairs.length / rawProposalsExamined) * 100000) / 1000,
        improvementsFound: improvements.length,
        bestSampledTtkSeconds: best.score?.timeToKillSeconds ?? null,
        bestSampledDps: best.score?.damagePerSecond ?? null,
        bestSampledRemovedMods: best.removed,
        bestSampledAddedMods: best.added,
        topImprovements: improvements.slice(0, 10).map((entry) => ({
            removedMods: entry.removed,
            addedMods: entry.added,
            ttkSeconds: entry.score?.timeToKillSeconds ?? null,
            dps: entry.score?.damagePerSecond ?? null,
            formaUsed: countPolarityChanges(defaultPolarities, entry.polarities),
        })),
    }, null, 2));
}

if (process.argv.includes("--worker")) runFixture();
else runCorpus();
