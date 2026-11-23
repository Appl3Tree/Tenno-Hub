import { readFile } from "node:fs/promises";
import { filterBuilderExpertVariants, getModsForWeapon } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, getWeaponDisplayName } from "../src/domain/catalog/weaponCatalog";
import type { WeaponEntry } from "../src/domain/catalog/weaponCatalog";
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
import { calculateBuild, type ConditionalState } from "../src/domain/logic/damageCalc";

interface ModRequest {
    name: string;
    rank: number;
}

interface Fixture {
    weaponName: string;
    attackName?: string;
    /** Run only when explicitly selected because its native readout used a non-default target/state. */
    readoutOnly?: boolean;
    distanceMeters?: number;
    distanceSource?: string;
    underframeObservedCapacityAfterAutoPolarize: string;
    underframeMods: ModRequest[];
    underframeAutoBuildSliderState?: Record<string, number>;
    underframeAutoBuildDisposition?: string;
    underframeNativeTargetPools?: Record<string, string | number>;
    underframeNativeReadout?: Record<string, unknown>;
    underframeNativeCombinedModeReadout?: Record<string, unknown>;
    underframeNativeCombinedHighHealthReadout?: Record<string, unknown>;
    underframeNativeCombinedUnarmoredHighHealthReadout?: Record<string, unknown>;
    underframeDistanceModeTransitionAndScoreProbe?: Record<string, unknown>;
    underframeObservedAutoStats?: Record<string, unknown>;
}

const MAUSOLON_CAPTURE = JSON.parse(await readFile(
    new URL("./fixtures/underframeMausolonAutoBuild.json", import.meta.url),
    "utf8",
)) as Fixture;

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
    {
        weaponName: "Braton Prime",
        attackName: "Normal Attack",
        readoutOnly: true,
        underframeObservedCapacityAfterAutoPolarize: "0/60; 3 Forma",
        underframeMods: [
            { name: "Malignant Force", rank: 3 },
            { name: "High Voltage", rank: 3 },
            { name: "Rime Rounds", rank: 3 },
            { name: "Galvanized Chamber", rank: 10 },
            { name: "Vile Acceleration", rank: 5 },
            { name: "Galvanized Aptitude", rank: 10 },
            { name: "Vital Sense", rank: 5 },
            { name: "Primed Bane of Grineer", rank: 10 },
        ],
        underframeNativeTargetPools: {
            health: 2_000_000,
            shields: 0,
            overguard: 0,
            armor: 3_000,
        },
        underframeNativeReadout: {
            capturedAt: "2026-11-23",
            visibleConditionals: { "Galvanized Chamber": "5/5", "Galvanized Aptitude": "2/2" },
            accurateAmmo: true,
            externalStatuses: [],
            standardDps: [62_939, 72_957, 67_203, 70_336, 68_479, 71_209],
            standardTtk: ">5s",
            luckAveraged: {
                repeatedSamples: 3,
                dps: 67_699,
                rawAverageDamagePerShot: 3_929,
                dotAverageDamagePerShot: 600,
                ttk: "?",
            },
            weaponStats: { attackSpeed: 18.2, magazine: 75, reloadSeconds: 2.15, multishot: 3.3 },
        },
    },
    MAUSOLON_CAPTURE,
];

function stringOption(name: string, fallback: string): string {
    return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

function numericOption(name: string, fallback: number): number {
    const value = Number(stringOption(name, String(fallback)));
    if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} must be a non-negative number`);
    return value;
}

const requestedWeapon = process.argv.find((arg) => arg.startsWith("--weapon="))?.slice(9)?.trim().toLowerCase();
const TARGET_FACTION = stringOption("faction", "Grineer");
const defaultHealth = requestedWeapon === "braton prime" ? 2_000_000 : 100_000;
const TARGET = {
    description: `${TARGET_FACTION} custom target: ${numericOption("health", defaultHealth).toLocaleString()} Health / ${numericOption("armor", 3_000).toLocaleString()} Armor`,
    health: numericOption("health", defaultHealth),
    shields: numericOption("shields", 0),
    overguard: numericOption("overguard", 0),
    armor: numericOption("armor", 3_000),
    toxinBypassesShields: true,
};
const defaultConditionalState = requestedWeapon === "braton prime" ? "custom" : "realistic";
const conditionalStateMode = stringOption("state", defaultConditionalState);
const conditionalStateModes: readonly ConditionalState["mode"][] = ["initial", "realistic", "fullyStacked", "custom"];
if (!conditionalStateModes.includes(conditionalStateMode as ConditionalState["mode"])) {
    throw new Error(`Unsupported --state=${conditionalStateMode}; choose initial, realistic, fullyStacked, or custom.`);
}
const defaultExternalStacks = requestedWeapon === "braton prime" ? 5 : 0;
const requestedExternalStacks = numericOption("stacks", defaultExternalStacks);
if (!Number.isInteger(requestedExternalStacks) || requestedExternalStacks < 0) {
    throw new Error("--stacks must be a non-negative integer");
}
const CONDITIONAL_STATE: ConditionalState = {
    mode: conditionalStateMode as ConditionalState["mode"],
    ...(conditionalStateMode === "custom" ? { externalStacks: requestedExternalStacks } : {}),
};
const MAX_FORMA = 3;
const CAPACITY_CONFIG: CapacityConfig = {
    weaponRank: 30,
    hasCatalyst: true,
    masteryRank: 30,
    canOverLevel: false,
};
const requestedRuns = Number(process.argv.find((arg) => arg.startsWith("--runs="))?.slice(7) ?? 3);
const RUNS = Number.isInteger(requestedRuns) && requestedRuns > 0 ? requestedRuns : 3;
const requestedDistanceValue = process.argv.find((arg) => arg.startsWith("--distance="))?.slice(11);
const requestedDistanceMeters = requestedDistanceValue === undefined ? undefined : Number(requestedDistanceValue);
if (requestedDistanceMeters !== undefined && (!Number.isFinite(requestedDistanceMeters) || requestedDistanceMeters < 0)) {
    throw new Error("--distance must be a non-negative number");
}

function getWeapon(name: string, attackName = "Normal Attack") {
    const catalog = getWeaponCatalog();
    const normalizedName = name.trim().toLowerCase();
    const catalogWeapon = catalog.find((entry) => getWeaponDisplayName(entry).toLowerCase() === normalizedName) ??
        catalog.find((entry) => entry.name.toLowerCase() === normalizedName);
    if (!catalogWeapon) throw new Error(`Weapon missing from catalog: ${name}`);
    const attackIndex = catalogWeapon.attacks.findIndex((attack) => attack.name.toLowerCase() === attackName.toLowerCase());
    const attack = catalogWeapon.attacks[attackIndex];
    if (!attack) throw new Error(`Attack missing from catalog: ${name} / ${attackName}`);
    return { weapon: withSelectedAttack(catalogWeapon, attackIndex), attack };
}

const fixturesToRun = requestedWeapon
    ? FIXTURES.filter((fixture) => getWeaponDisplayName(getWeapon(fixture.weaponName, fixture.attackName).weapon)
        .toLowerCase() === requestedWeapon || fixture.weaponName.toLowerCase() === requestedWeapon)
    : FIXTURES.filter((fixture) => !fixture.readoutOnly);
if (requestedWeapon && fixturesToRun.length === 0) throw new Error(`No captured fixture matches --weapon=${requestedWeapon}`);

function getMod(name: string, rank: number, compatibleMods: ReturnType<typeof getModsForWeapon>) {
    const variants = compatibleMods.filter((entry) => entry.name.toLowerCase() === name.toLowerCase());
    const mod = variants.find((entry) => !/\/(Beginner|Intermediate|Expert)\//i.test(entry.path)
        && !/(Beginner|Intermediate|Expert)$/i.test(entry.path)) ?? variants[0];
    if (!mod) throw new Error(`Compatible mod missing: ${name}`);
    if (rank < 0 || rank > mod.fusionLimit) throw new Error(`Invalid rank for ${name}: ${rank}/${mod.fusionLimit}`);
    return mod;
}

function evaluateFixedBuild(
    weapon: WeaponEntry,
    fixture: Fixture,
    compatibleMods: ReturnType<typeof getModsForWeapon>,
    conditionalState: ConditionalState,
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
        conditionalState,
    );
    const statPass = calculateBuild(weapon, effects, TARGET_FACTION, {
        conditionalState,
        targetStatusState: "initial",
    }).modded;
    const dotDamagePerAttack = Object.values(statPass.dotDamagePerShotByType)
        .reduce((total, damage) => total + (damage ?? 0), 0);
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
        unmitigatedStatPass: {
            baseDamageTotal: statPass.baseDamageTotal,
            totalDamageBonus: statPass.totalDamageBonus,
            factionDamageBonus: statPass.factionDamageBonus,
            damageWeightedMultishot: statPass.damageWeightedMultishot,
            directDamagePerStatusBonus: statPass.directDamagePerStatusBonus,
            expectedHitDamageMultiplier: statPass.expectedHitDamageMultiplier,
            critChance: statPass.critChance,
            critMultiplier: statPass.critMultiplier,
            rawDamageByTypeBeforePerStatus: statPass.rawDamageBreakdownBeforePerStatus,
            directDamageByTypeBeforeDefense: statPass.damageBreakdownBeforePerStatus,
            averageDirectDamagePerAttack: statPass.averageShotDamage,
            averageDotDamagePerAttack: dotDamagePerAttack,
            averageProcsPerAttack: statPass.averageProcsPerShot,
            fireRate: statPass.fireRate,
            magazineSize: statPass.magazineSize,
            reloadTimeSeconds: statPass.reloadTime,
            note: "Weapon-stat arithmetic before target armor and finite-window hit simulation; not the applied-health score.",
        },
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
    const { weapon, attack } = getWeapon(fixture.weaponName, fixture.attackName);
    const distanceMeters = requestedDistanceMeters ?? fixture.distanceMeters;
    const hasDistanceSensitiveAttackModel = weapon.selectedAttackDamageFalloff !== undefined ||
        Number.isFinite(weapon.selectedAttackMaximumRangeMeters);
    if (hasDistanceSensitiveAttackModel && distanceMeters === undefined) {
        throw new Error(`A captured or explicit --distance is required for ${weapon.name} / ${attack.name}`);
    }
    const conditionalState: ConditionalState = distanceMeters === undefined
        ? CONDITIONAL_STATE
        : {
            ...CONDITIONAL_STATE,
            targetDistanceMeters: distanceMeters,
            attackFalloffDistanceMeters: distanceMeters,
        };
    const modelPredictsOutOfRangeMiss = distanceMeters !== undefined &&
        weapon.selectedAttackMaximumRangeBehavior === "hardHitCap" &&
        Number.isFinite(weapon.selectedAttackMaximumRangeMeters) &&
        distanceMeters > (weapon.selectedAttackMaximumRangeMeters ?? 0);
    const compatibleMods = filterBuilderExpertVariants(getModsForWeapon(weapon));
    const fixedBuild = evaluateFixedBuild(weapon, fixture, compatibleMods, conditionalState);
    const optimizerRuns = modelPredictsOutOfRangeMiss ? [] : Array.from({ length: RUNS }, () => {
        const startedAt = performance.now();
        const result = optimizeBuild(weapon, compatibleMods, "windowDps", weapon.baseSlotCount, {
            targetFaction: TARGET_FACTION,
            targetProfileOverride: TARGET,
            conditionalState,
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
            buildForAttack: attack,
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
        weapon: getWeaponDisplayName(weapon),
        category: weapon.category,
        attack: attack.name,
        distanceModel: {
            distanceMeters: distanceMeters ?? null,
            source: requestedDistanceMeters !== undefined
                ? "CLI --distance override"
                : fixture.distanceMeters !== undefined
                    ? fixture.distanceSource ?? "captured fixture"
                    : "not recorded",
            targetDistanceApplied: distanceMeters !== undefined,
            attackRangeDistanceApplied: distanceMeters !== undefined && hasDistanceSensitiveAttackModel,
            falloffProfile: weapon.selectedAttackDamageFalloff ?? null,
            maximumRangeMeters: weapon.selectedAttackMaximumRangeMeters ?? null,
            maximumRangeBehavior: weapon.selectedAttackMaximumRangeBehavior ?? null,
            maximumRangeSourceUrl: weapon.selectedAttackMaximumRangeSourceUrl ?? null,
            modelPredictsOutOfRangeMiss,
            optimizerDisposition: modelPredictsOutOfRangeMiss
                ? "Skipped because the selected source-backed profile predicts no hit at this distance."
                : distanceMeters !== undefined
                    ? "Scored with the recorded distance inputs."
                    : "No distance was recorded; this selected attack has no source-backed falloff or hit-range limit.",
        },
        underframeObservedCapacityAfterAutoPolarize: fixture.underframeObservedCapacityAfterAutoPolarize,
        underframeAutoBuildSliderState: fixture.underframeAutoBuildSliderState ?? null,
        underframeAutoBuildDisposition: fixture.underframeAutoBuildDisposition ?? null,
        underframeNativeTargetPools: fixture.underframeNativeTargetPools ?? null,
        underframeNativeReadout: fixture.underframeNativeReadout ?? null,
        underframeNativeCombinedModeReadout: fixture.underframeNativeCombinedModeReadout ?? null,
        underframeNativeCombinedHighHealthReadout: fixture.underframeNativeCombinedHighHealthReadout ?? null,
        underframeNativeCombinedUnarmoredHighHealthReadout: fixture.underframeNativeCombinedUnarmoredHighHealthReadout ?? null,
        underframeDistanceModeTransitionAndScoreProbe: fixture.underframeDistanceModeTransitionAndScoreProbe ?? null,
        underframeObservedAutoStats: fixture.underframeObservedAutoStats ?? null,
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
        repeatability: optimizerRuns.length === 0 ? null : {
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
        conditionalState: {
            mode: CONDITIONAL_STATE.mode,
            externalStacks: CONDITIONAL_STATE.mode === "custom" ? CONDITIONAL_STATE.externalStacks ?? 0 : null,
        },
        distanceOverrideMeters: requestedDistanceMeters ?? null,
        distanceBehavior: "CLI --distance overrides a captured fixture distance and is applied to target-distance conditions and selected-attack falloff/range. A selected attack with a source-backed falloff or range limit cannot be scored without an explicit distance; an out-of-range hard miss is reported and its optimizer run is skipped.",
        constraints: "Eight normal slots, max-rank mods, Catalyst, up to three Forma, no Exilus or Arcanes.",
        modelBoundary: "All scored captured and optimized lists use Tenno-Hub's same deterministic finite encounter engine. It clips overkill and damage after the single target dies and does not reset the target. Event-triggered stack history and expiry are not simulated: Fully Stacked starts each trigger at its maximum, nonzero Custom starts at the entered maintained stack count for the entire score, and other states do not assume prior trigger stacks. It excludes neighboring targets and melee stance/combo history. The optimizer is skipped when an explicit distance exceeds a selected profile's source-backed hard-hit cap. This is not Underframe's seeded stochastic simulator or live-game validation.",
        optimizerRunsPerFixture: RUNS,
        selectedFixtureFilter: requestedWeapon ?? null,
    },
    fixtures: fixturesToRun.map(runFixture),
}, null, 2));
