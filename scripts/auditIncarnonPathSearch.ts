import { performance } from "node:perf_hooks";
import { getArcanesForWeapon } from "../src/domain/catalog/arcaneCatalog";
import { filterBuilderExpertVariants, getModsForWeapon } from "../src/domain/catalog/modCatalog";
import {
    buildIncarnonCandidateConfigs,
    getIncarnonRecordForWeapon,
    resolveIncarnonState,
    selectIncarnonSearchShortlist,
    type IncarnonCandidateConfig,
} from "../src/domain/catalog/incarnonCatalog";
import { getWeaponCatalog } from "../src/domain/catalog/weaponCatalog";
import { countPolarityChanges } from "../src/domain/logic/capacityCalc";
import { optimizeBuild, scoreOptimizerResultForConfiguration } from "../src/domain/logic/buildOptimizer";
import type { OptimizeResult } from "../src/domain/logic/buildOptimizerCore";

const WEAPON_NAME = "Laetum";
const TARGET_FACTION = "Grineer";
const PATH_REFINEMENT_LIMIT = 2;
const TARGET = {
    health: 83_818,
    shields: 0,
    overguard: 0,
    armor: 2_700,
    healthShare: 1,
    shieldShare: 0,
    hasOverguard: false,
    crowdControlImmune: false,
    grouped: false,
};
const CANDIDATE_MOD_NAMES = new Set([
    "Barrel Diffusion",
    "Frostbite",
    "Hornet Strike",
    "Pistol Pestilence",
]);
const CANDIDATE_ARCANE_NAMES = new Set([
    "Secondary Deadhead",
    "Secondary Merciless",
]);

const weapon = getWeaponCatalog().find((entry) => entry.name === WEAPON_NAME);
if (!weapon) throw new Error(`${WEAPON_NAME} is missing from the weapon catalog`);
const record = getIncarnonRecordForWeapon(weapon);
if (!record) throw new Error(`${WEAPON_NAME} is missing its Incarnon record`);
const candidateMods = [...new Map(filterBuilderExpertVariants(getModsForWeapon(weapon))
    .filter((mod) => CANDIDATE_MOD_NAMES.has(mod.name))
    .map((mod) => [mod.name, mod])).values()];
if (candidateMods.length !== CANDIDATE_MOD_NAMES.size) {
    throw new Error(`Expected ${CANDIDATE_MOD_NAMES.size} candidate mods, found ${candidateMods.map((mod) => mod.name).join(", ")}`);
}
const candidateArcanes = getArcanesForWeapon(weapon)
    .filter((arcane) => CANDIDATE_ARCANE_NAMES.has(arcane.name));
if (candidateArcanes.length !== CANDIDATE_ARCANE_NAMES.size) {
    throw new Error(`Expected ${CANDIDATE_ARCANE_NAMES.size} candidate Arcanes, found ${candidateArcanes.map((arcane) => arcane.name).join(", ")}`);
}

const attackIndex = 0;
const buildForAttack = weapon.attacks[attackIndex] ?? null;
const candidates = buildIncarnonCandidateConfigs(record, {}, true);
const options = {
    targetFaction: TARGET_FACTION,
    targetProfileOverride: TARGET,
    conditionalState: { mode: "initial" as const },
    allowNonMaxRank: false,
    allowCatalyst: true,
    allowForma: true,
    maxFormaCount: 3,
    capacityConfig: {
        weaponRank: 30,
        hasCatalyst: true,
        masteryRank: 30,
        canOverLevel: false,
    },
    slotPolarities: weapon.polarities.slice(0, 3),
    defaultSlotPolarities: weapon.polarities.slice(0, 3),
    optimizeArcane: true,
    arcaneCandidates: candidateArcanes,
    buildForAttack,
};
const signature = (candidate: IncarnonCandidateConfig) => Object.entries(candidate.selectedOptionsByTier)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([tier, option]) => `${tier}:${option}`)
    .join("|");
const run = (candidate: IncarnonCandidateConfig) => {
    const state = resolveIncarnonState(weapon, attackIndex, candidate);
    const result = optimizeBuild(state.weapon, candidateMods, "timeToKill", 3, {
        ...options,
        preEquippedEffects: state.activeEffects,
    });
    return { state, result };
};
const formaCount = (result: OptimizeResult) => countPolarityChanges(
    weapon.polarities.slice(0, 3),
    result.slotPolarities,
);
const runScore = (
    state: ReturnType<typeof resolveIncarnonState>,
    result: OptimizeResult,
    useFiniteEncounterResult: boolean,
) => scoreOptimizerResultForConfiguration({
    weapon: state.weapon,
    selectedAttackIdx: attackIndex,
    result,
    goal: "timeToKill",
    targetFaction: TARGET_FACTION,
    targetProfileOverride: TARGET,
    conditionalState: options.conditionalState,
    preEquippedEffects: state.activeEffects,
    useFiniteEncounterResult,
});

const baselineConfig: IncarnonCandidateConfig = { unlockedTier: 0, selectedOptionsByTier: {} };
const baselineStart = performance.now();
const baseline = run(baselineConfig);
const baselineElapsedMs = performance.now() - baselineStart;
const screened = candidates.map((candidate) => {
    const state = resolveIncarnonState(weapon, attackIndex, candidate);
    return {
        signature: signature(candidate),
        path: candidate.selectedOptionsByTier,
        candidate,
        state,
        score: runScore(state, baseline.result, false),
    };
});
const shortlist = selectIncarnonSearchShortlist(screened, [], PATH_REFINEMENT_LIMIT);

const fullSweepStart = performance.now();
const fullResults = candidates.map((candidate) => {
    const startedAt = performance.now();
    const result = run(candidate);
    return {
        signature: signature(candidate),
        path: candidate.selectedOptionsByTier,
        elapsedMs: performance.now() - startedAt,
        ttkSeconds: result.result.encounterTimeToKillSeconds ?? null,
        score: runScore(result.state, result.result, true),
        capacityValid: result.result.capacityValid,
        formaCount: formaCount(result.result),
        mods: result.result.slots.flatMap((mod, index) => mod
            ? [`${mod.name} R${result.result.slotRanks[index] ?? mod.fusionLimit}`]
            : []),
        arcane: result.result.arcane ? `${result.result.arcane.name} R${result.result.arcaneRank}` : null,
    };
});
const fullSweepElapsedMs = performance.now() - fullSweepStart;
const bestFull = [...fullResults].sort((left, right) => right.score - left.score)[0];
const shortlistedFull = shortlist.map((candidate) => fullResults.find((result) => result.signature === candidate.signature)!);
const bestShortlisted = [...shortlistedFull].sort((left, right) => right.score - left.score)[0];

console.log(JSON.stringify({
    weapon: WEAPON_NAME,
    attack: buildForAttack?.name ?? "Normal Attack",
    goal: "timeToKill",
    target: { faction: TARGET_FACTION, ...TARGET },
    candidateMods: candidateMods.map((mod) => mod.name),
    candidateArcanes: candidateArcanes.map((arcane) => arcane.name),
    pathCount: candidates.length,
    baseline: {
        elapsedMs: baselineElapsedMs,
        ttkSeconds: baseline.result.encounterTimeToKillSeconds ?? null,
        score: runScore(baseline.state, baseline.result, true),
        capacityValid: baseline.result.capacityValid,
        formaCount: formaCount(baseline.result),
        mods: baseline.result.slots.flatMap((mod, index) => mod
            ? [`${mod.name} R${baseline.result.slotRanks[index] ?? mod.fusionLimit}`]
            : []),
        arcane: baseline.result.arcane ? `${baseline.result.arcane.name} R${baseline.result.arcaneRank}` : null,
    },
    selectedForRefinement: shortlist.map((candidate) => ({
        signature: candidate.signature,
        score: candidate.score,
        path: candidate.candidate.selectedOptionsByTier,
    })),
    refinedWinners: {
        fullSweep: { elapsedMs: fullSweepElapsedMs, ...bestFull },
        shortlist: bestShortlisted,
        ttkGapSeconds: bestShortlisted && bestFull?.ttkSeconds !== null && bestShortlisted.ttkSeconds !== null
            ? bestShortlisted.ttkSeconds - (bestFull?.ttkSeconds ?? 0)
            : null,
        scoreGap: bestFull && bestShortlisted ? bestFull.score - bestShortlisted.score : null,
    },
}, null, 2));
