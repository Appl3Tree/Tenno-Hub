import { performance } from "node:perf_hooks";
import { getArcanesForWeapon, type ArcaneEntry } from "../src/domain/catalog/arcaneCatalog";
import { filterBuilderExpertVariants, getModsForWeapon } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack, type WeaponEntry } from "../src/domain/catalog/weaponCatalog";
import { countPolarityChanges, effectiveDrain, totalModCapacity } from "../src/domain/logic/capacityCalc";
import { optimizeBuild, type OptimizeGoal, type OptimizeResult } from "../src/domain/logic/buildOptimizer";
import { debugScoreBuild, type ConditionalState } from "../src/domain/logic/buildOptimizerCore";
import { getArcaneEffectAtRank } from "../src/domain/logic/arcaneEffects";
import type { ModEffect } from "../src/domain/catalog/modCatalog";

interface BenchmarkCase {
    weaponName: string;
    attackName?: string;
    category: string;
    goal: OptimizeGoal;
    targetFaction: string;
    warframeMaxEnergy?: number;
    warframeEnergyPercent?: number;
}

interface BenchmarkRun {
    elapsedMs: number;
    score: number;
    legal: boolean;
    capacityValid: boolean;
    capacityUsed: number;
    formaCount: number;
    selectedMods: string[];
    selectedArcane: string | null;
    selectedArcaneRank: number;
    arcaneBestOnFinalMods: boolean | null;
    arcaneGapPctOnFinalMods: number | null;
    slotPolarities: string[];
    uniqueNamesValid: boolean;
    incompatibilityGroupsValid: boolean;
    exilusMod: string | null;
    exilusRank: number;
    exilusPolarity: string;
    slotDetails: Array<{
        slot: number;
        mod: string | null;
        rank: number | null;
        modPolarity: string;
        slotPolarity: string;
        drain: number;
    }>;
}

const parsedRuns = Number(process.argv.find((arg) => arg.startsWith("--runs="))?.slice(7) ?? 5);
const RUNS = Number.isFinite(parsedRuns) ? Math.max(1, Math.min(20, Math.floor(parsedRuns))) : 5;
const optimizeArcane = !process.argv.includes("--no-arcane");
const optimizeExilus = !process.argv.includes("--no-exilus");
const verifyArcaneSelection = process.argv.includes("--verify-arcane-selection");
const conditionalState: ConditionalState = { mode: "initial" };
const allCases: BenchmarkCase[] = [
    { weaponName: "Braton Prime", category: "rifle", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Cedo", category: "shotgun", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Cedo", attackName: "Glaive Radial Attack", category: "shotgun glaive explosion", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Phantasma Prime", attackName: "Plasma Bomb Explosion", category: "shotgun charged alternate fire", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Laetum", category: "secondary", goal: "burst", targetFaction: "Corpus" },
    { weaponName: "Cinta", category: "bow", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Kuva Hek", category: "progenitor shotgun", goal: "scaling", targetFaction: "Grineer" },
    { weaponName: "Torid", category: "Incarnon base mode", goal: "scaling", targetFaction: "Corpus" },
    { weaponName: "Broken War", category: "melee (attack-rate proxy)", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Corvas Prime", category: "archgun", goal: "burst", targetFaction: "Corpus" },
    { weaponName: "Verglas Prime", category: "companion weapon", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Phantasma Prime", attackName: "Beam", category: "shotgun continuous beam", goal: "scaling", targetFaction: "Grineer" },
    { weaponName: "Rubico Prime", category: "sniper rifle", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Epitaph", attackName: "Charged Shot", category: "secondary charged projectile", goal: "burst", targetFaction: "Corpus" },
    { weaponName: "Acrid", category: "forced-proc toxin secondary", goal: "scaling", targetFaction: "Corpus" },
    { weaponName: "Hystrix Prime", attackName: "Fire Quill", category: "forced-proc selectable-element secondary", goal: "scaling", targetFaction: "Grineer" },
    { weaponName: "Nukor", category: "persistent unique-status secondary", goal: "burst", targetFaction: "Corpus" },
    { weaponName: "Nataruk", attackName: "Perfect Shot", category: "precision bow", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Gram Prime", attackName: "Heavy Slam Attack", category: "melee heavy-attack proxy", goal: "burst", targetFaction: "Grineer" },
    { weaponName: "Braton Prime", category: "energy-gated Primary Overcharge", goal: "burst", targetFaction: "Grineer", warframeMaxEnergy: 1000, warframeEnergyPercent: 100 },
];
const requestedWeapon = process.argv.find((arg) => arg.startsWith("--weapon="))?.slice(9).trim().toLowerCase();
const requestedAttack = process.argv.find((arg) => arg.startsWith("--attack="))?.slice(9).trim().toLowerCase();
const cases = allCases.filter((benchmarkCase) =>
    (!requestedWeapon || benchmarkCase.weaponName.toLowerCase() === requestedWeapon)
    && (!requestedAttack || (benchmarkCase.attackName ?? "").toLowerCase() === requestedAttack),
);

if (cases.length === 0) {
    throw new Error(`No benchmark case matches weapon: ${requestedWeapon}`);
}

function getWeapon(name: string, catalog: WeaponEntry[]): WeaponEntry | undefined {
    const normalized = name.trim().toLowerCase();
    return catalog.find((weapon) => weapon.name.trim().toLowerCase() === normalized);
}

function calculateResultScore(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
    result: OptimizeResult,
    goal: OptimizeGoal,
    targetFaction: string,
    warframeMaxEnergy?: number,
    warframeEnergyPercent?: number,
): number {
    return calculateScoreWithArcane(
        weapon,
        selectedAttackIdx,
        result,
        goal,
        targetFaction,
        result.arcane,
        result.arcaneRank,
        warframeMaxEnergy,
        warframeEnergyPercent,
    );
}

function calculateScoreWithArcane(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
    result: OptimizeResult,
    goal: OptimizeGoal,
    targetFaction: string,
    arcane: ArcaneEntry | null,
    arcaneRank: number,
    warframeMaxEnergy?: number,
    warframeEnergyPercent?: number,
): number {
    const effects: (ModEffect | null)[] = result.slots.map((mod, index) => {
        if (!mod) return null;
        const rank = result.slotRanks[index] ?? mod.fusionLimit;
        return mod.effectsByRank[rank] ?? mod.effect;
    });
    if (result.exilusMod) {
        effects.push(result.exilusMod.effectsByRank[result.exilusRank] ?? result.exilusMod.effect);
    }
    const arcaneEffect = arcane
        ? getArcaneEffectAtRank(arcane, arcaneRank, undefined, true, { warframeMaxEnergy, warframeEnergyPercent })
        : null;
    return debugScoreBuild(withSelectedAttack(weapon, selectedAttackIdx), effects, goal, targetFaction, arcaneEffect, undefined, conditionalState);
}

function auditArcaneSelectionOnFinalMods(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
    result: OptimizeResult,
    goal: OptimizeGoal,
    targetFaction: string,
    arcaneCandidates: ArcaneEntry[],
    warframeMaxEnergy?: number,
    warframeEnergyPercent?: number,
): { isBest: boolean; gapPct: number } {
    const selectedScore = calculateResultScore(weapon, selectedAttackIdx, result, goal, targetFaction, warframeMaxEnergy, warframeEnergyPercent);
    let bestScore = calculateScoreWithArcane(weapon, selectedAttackIdx, result, goal, targetFaction, null, 0, warframeMaxEnergy, warframeEnergyPercent);
    for (const arcane of arcaneCandidates) {
        for (let rank = 0; rank <= arcane.maxRank; rank++) {
            const effect = getArcaneEffectAtRank(arcane, rank, undefined, true, { warframeMaxEnergy, warframeEnergyPercent });
            if (!effect) continue;
            bestScore = Math.max(
                bestScore,
                calculateScoreWithArcane(weapon, selectedAttackIdx, result, goal, targetFaction, arcane, rank, warframeMaxEnergy, warframeEnergyPercent),
            );
        }
    }
    const gap = Math.max(0, bestScore - selectedScore);
    return {
        isBest: gap <= Math.max(1e-8, Math.abs(bestScore) * 1e-10),
        gapPct: bestScore > 0 ? (gap / bestScore) * 100 : 0,
    };
}

function countFormaChanges(weapon: WeaponEntry, result: OptimizeResult): number {
    const defaultPolarities = [...weapon.polarities];
    while (defaultPolarities.length < result.slotPolarities.length) defaultPolarities.push("");
    if (result.exilusMod) defaultPolarities.push("");
    const currentPolarities = [...result.slotPolarities];
    if (result.exilusMod) currentPolarities.push(result.exilusPolarity);
    return countPolarityChanges(defaultPolarities, currentPolarities);
}

function percentile(values: number[], quantile: number): number {
    const ordered = [...values].sort((left, right) => left - right);
    return ordered[Math.max(0, Math.ceil(quantile * ordered.length) - 1)] ?? 0;
}

const catalog = getWeaponCatalog();
const report = [];

for (const [caseIndex, benchmarkCase] of cases.entries()) {
    process.stderr.write(`[${caseIndex + 1}/${cases.length}] ${benchmarkCase.weaponName}${benchmarkCase.attackName ? ` / ${benchmarkCase.attackName}` : ""} (${RUNS} runs)\n`);
    const weapon = getWeapon(benchmarkCase.weaponName, catalog);
    if (!weapon) {
        report.push({ ...benchmarkCase, status: "missing from supported weapon catalog" });
        continue;
    }

    // Match ModBuilder's candidate pool, including its duplicate expert-path filtering.
    const availableMods = filterBuilderExpertVariants(getModsForWeapon(weapon));
    const arcaneCandidates = getArcanesForWeapon(weapon);
    const selectedAttackIdx = benchmarkCase.attackName
        ? weapon.attacks.findIndex((attack) => attack.name === benchmarkCase.attackName)
        : 0;
    if (selectedAttackIdx < 0) {
        throw new Error(`Attack ${benchmarkCase.attackName} was not found on ${benchmarkCase.weaponName}`);
    }
    const selectedAttack = weapon.attacks[selectedAttackIdx] ?? null;
    const buildForAttack = weapon.attacks.length > 1 ? selectedAttack : null;
    const runs: BenchmarkRun[] = [];
    for (let runIndex = 0; runIndex < RUNS; runIndex++) {
        const startedAt = performance.now();
        const result = optimizeBuild(weapon, availableMods, benchmarkCase.goal, 8, {
            targetFaction: benchmarkCase.targetFaction,
            warframeMaxEnergy: benchmarkCase.warframeMaxEnergy,
            warframeEnergyPercent: benchmarkCase.warframeEnergyPercent,
            conditionalState,
            allowNonMaxRank: false,
            allowCatalyst: true,
            allowForma: true,
            maxFormaCount: 3,
            capacityConfig: {
                weaponRank: weapon.canOverLevel ? 40 : 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon.canOverLevel,
            },
            slotPolarities: weapon.polarities,
            defaultSlotPolarities: weapon.polarities,
            optimizeExilus,
            optimizeArcane,
            arcaneCandidates,
            buildForAttack,
        });
        const elapsedMs = performance.now() - startedAt;
        const capacityUsed = result.slots.reduce((sum, mod, index) => sum + (mod
            ? effectiveDrain(mod, result.slotPolarities[index] ?? "", result.slotRanks[index] ?? mod.fusionLimit)
            : 0), 0) + (result.exilusMod
            ? effectiveDrain(result.exilusMod, result.exilusPolarity, result.exilusRank)
            : 0);
        const arcaneAudit = verifyArcaneSelection && optimizeArcane
            ? auditArcaneSelectionOnFinalMods(
                weapon,
                selectedAttackIdx,
                result,
                benchmarkCase.goal,
                benchmarkCase.targetFaction,
                arcaneCandidates,
                benchmarkCase.warframeMaxEnergy,
                benchmarkCase.warframeEnergyPercent,
            )
            : null;
        runs.push({
            elapsedMs,
            score: calculateResultScore(
                weapon,
                selectedAttackIdx,
                result,
                benchmarkCase.goal,
                benchmarkCase.targetFaction,
                benchmarkCase.warframeMaxEnergy,
                benchmarkCase.warframeEnergyPercent,
            ),
            legal: result.capacityValid
                && countFormaChanges(weapon, result) <= 3
                && new Set(result.slots.flatMap((mod) => mod ? [mod.uniqueName] : [])).size
                    === result.slots.filter(Boolean).length
                && new Set(result.slots.flatMap((mod) => mod ? [mod.incompatibilityGroup] : [])).size
                    === result.slots.filter(Boolean).length,
            capacityValid: result.capacityValid,
            capacityUsed,
            formaCount: countFormaChanges(weapon, result),
            selectedMods: result.slots.flatMap((mod, index) => mod
                ? [`${mod.name} R${result.slotRanks[index] ?? mod.fusionLimit}`]
                : []),
            selectedArcane: result.arcane?.name ?? null,
            selectedArcaneRank: result.arcaneRank,
            arcaneBestOnFinalMods: arcaneAudit?.isBest ?? null,
            arcaneGapPctOnFinalMods: arcaneAudit?.gapPct ?? null,
            slotPolarities: [...result.slotPolarities],
            uniqueNamesValid: new Set(result.slots.flatMap((mod) => mod ? [mod.uniqueName] : [])).size
                === result.slots.filter(Boolean).length,
            incompatibilityGroupsValid: new Set(result.slots.flatMap((mod) => mod ? [mod.incompatibilityGroup] : [])).size
                === result.slots.filter(Boolean).length,
            exilusMod: result.exilusMod?.name ?? null,
            exilusRank: result.exilusRank,
            exilusPolarity: result.exilusPolarity,
            slotDetails: result.slots.map((mod, index) => ({
                slot: index + 1,
                mod: mod?.name ?? null,
                rank: mod ? result.slotRanks[index] ?? mod.fusionLimit : null,
                modPolarity: mod?.polarity ?? "",
                slotPolarity: result.slotPolarities[index] ?? "",
                drain: mod ? effectiveDrain(mod, result.slotPolarities[index] ?? "", result.slotRanks[index] ?? mod.fusionLimit) : 0,
            })),
        });
    }

    const elapsed = runs.map((run) => run.elapsedMs);
    report.push({
        ...benchmarkCase,
        status: "ok",
        selectedAttack: selectedAttack?.name ?? "Normal attack",
        defaultSlotPolarities: weapon.polarities,
        candidateModCount: availableMods.length,
        candidateArcaneCount: arcaneCandidates.length,
        runs: RUNS,
        medianMs: percentile(elapsed, 0.5),
        p95Ms: percentile(elapsed, 0.95),
        minMs: Math.min(...elapsed),
        maxMs: Math.max(...elapsed),
        allLegal: runs.every((run) => run.legal),
        formaCount: runs[0]?.formaCount ?? 0,
        scoreRange: [Math.min(...runs.map((run) => run.score)), Math.max(...runs.map((run) => run.score))],
        stableBuild: runs.every((run) => run.selectedMods.join("|") === runs[0]?.selectedMods.join("|")),
        stableArcaneSelection: runs.every((run) =>
            run.selectedArcane === runs[0]?.selectedArcane && run.selectedArcaneRank === runs[0]?.selectedArcaneRank
        ),
        finalBuildArcaneAudit: verifyArcaneSelection && optimizeArcane ? {
            allRunsChooseBestArcaneForReturnedMods: runs.every((run) => run.arcaneBestOnFinalMods === true),
            worstGapPct: Math.max(0, ...runs.map((run) => run.arcaneGapPctOnFinalMods ?? 0)),
        } : undefined,
        selectedArcane: runs[0]?.selectedArcane ?? null,
        selectedArcaneRank: runs[0]?.selectedArcaneRank ?? 0,
        selectedMods: runs[0]?.selectedMods ?? [],
        legality: runs[0] ? {
            capacityValid: runs[0].capacityValid,
            capacityUsed: runs[0].capacityUsed,
            capacityAvailable: totalModCapacity({
                weaponRank: weapon.canOverLevel ? 40 : 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon.canOverLevel,
            }),
            formaCount: runs[0].formaCount,
            formaWithinLimit: runs[0].formaCount <= 3,
            uniqueNamesValid: runs[0].uniqueNamesValid,
            incompatibilityGroupsValid: runs[0].incompatibilityGroupsValid,
            exilusMod: runs[0].exilusMod,
            exilusRank: runs[0].exilusRank,
            exilusPolarity: runs[0].exilusPolarity,
            slotDetails: runs[0].slotDetails,
            slotPolarities: runs[0].slotPolarities,
        } : undefined,
    });
    process.stderr.write(
        `  median ${percentile(elapsed, 0.5).toFixed(1)} ms, p95 ${percentile(elapsed, 0.95).toFixed(1)} ms, ${runs[0]?.formaCount ?? 0} Forma, legal=${runs.every((run) => run.legal)}\n`,
    );
}

console.log(JSON.stringify({
    environment: {
        platform: process.platform,
        architecture: process.arch,
        node: process.version,
        logicalCpuCount: Number(process.env.NUMBER_OF_PROCESSORS) || undefined,
    },
    assumptions: {
        conditionalState: "initial",
        catalyst: true,
        formaLimit: 3,
        masteryRank: 30,
        optimizeExilus,
        optimizeArcane,
        targetStats: "faction presets; custom enemy profiles not supplied",
        selectedAttack: "named attack when supplied by the case; otherwise index 0, matching Mod Builder's default selection",
        candidateMods: "catalog candidates after Mod Builder duplicate expert-path filtering; no profile-owned custom Rivens",
        repetitions: RUNS,
    },
    cases: report,
}, null, 2));
