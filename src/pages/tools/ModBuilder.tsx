// src/pages/tools/ModBuilder.tsx
// Weapon Mod Builder — complete implementation with:
//   polarity icons · mod rank selection · exilus slot · arcane slots ×2
//   riven mod (user-defined stats) · forma counter · multi-attack display
//   beam-search optimizer · owned/excluded/faction/capacity toggles
//   build save+compare · build reasoning · status effect tooltips

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    getWeaponCatalog,
    getWeaponDisplayName,
    isBurstTriggerType,
    clampMeleeComboMultiplier,
    getMeleeComboRules,
    isGroundMeleeCategory,
    supportsStanceLikeMods,
    usesMeleeDamageModel,
    withSelectedAttack,
    type WeaponCategory,
    type WeaponEntry,
} from "../../domain/catalog/weaponCatalog";
import {
    buildIncarnonCandidateConfigs,
    getIncarnonRecordForWeapon,
    resolveIncarnonState,
    selectIncarnonSearchShortlist,
    type IncarnonCandidateConfig,
    type IncarnonTier,
} from "../../domain/catalog/incarnonCatalog";
import { filterBuilderExpertVariants, getModsForWeapon, getStancesForWeapon, getUnmodeledDamageEffectLines, sortBuilderModsForDisplay, type ModEntry, type ModEffect, emptyEffect, SPRING_LOADED_BROADHEAD_PATH } from "../../domain/catalog/modCatalog";
import { getUnmodeledDamageEffectSourceUrl, getUnmodeledScoringEffectLines, OVERPRESSURED_ROUNDS_MOD_PATH } from "../../domain/catalog/modEffectUtils";
import { ENEMY_PROFILES, getEnemyProfile } from "../../domain/catalog/enemyProfiles";
import { getArcanesForWeapon, type ArcaneEntry } from "../../domain/catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../../domain/logic/arcaneEffects";
import { getSentientIncisionDamageType } from "../../domain/logic/sentientIncision";
import { avgHitDamageMultiplier, calculateBuild, calculateBuildForExpectedEncounter, calculateMeleeAverageDps, DEFAULT_CONDITIONAL_STATE, estimateConditionalStackFactor, estimateConditionalUptime, estimateNonCriticalNoStatusHitGroupProbability, estimatePelletHits, hasAccuracyAffectingPelletEffect, normalizeCriticalPrecisionHeadshotProjectiles, normalizeDeadlyManeuversShotsRemaining, normalizeDreadfulKillshotCurrentHealth, normalizeOverpressuredRoundsSpreadSnapshot, normalizeStrainInfectionCystCount, withoutBurstOnlyConditionalAssumptions, type ConditionalState, type HitLocationDamageProfile, type MeleeAverageDpsParameters } from "../../domain/logic/damageCalc";
import { calculateTennokaiAttackTimeline, findSupportedTennokaiAttackPair } from "../../domain/logic/tennokaiTimeline";
import { EXTERNAL_STATUS_TYPE_OPTIONS, normalizeExternalStatusTypes, type ExternalStatusType } from "../../domain/logic/uniqueStatusRules";
import { getWikiMeleeStanceCombo, WIKI_MELEE_STANCE_SOURCE_URL, WIKI_MELEE_STANCE_VERIFIED_AT, type WikiMeleeStanceCombo } from "../../domain/catalog/meleeStanceCombos";
import { optimizeBuild, explainBuild, getFactionFocusOptions, getTargetProfileAssumptions, normalizeOptimizeGoal, scoreOptimizerResultForConfiguration, FIXED_WINDOW_DPS_SECONDS, type OptimizeGoal, type BuildReasoning, type LegacyOptimizeGoal, type TargetProfileOverride } from "../../domain/logic/buildOptimizer";
import { normalizeElectricGasNeighborCounts, STATUS_DAMAGE_TYPES, type StatusDamageType } from "../../domain/logic/damageRuleset";
import { EXIMUS_BASE_OVERGUARD, applyEximusHealthBaseAdjustment, applyEximusShieldBaseAdjustment, applySteelPathStatMultiplier, enemyStatLevelMultiplier, getSteelPathEnemyLevel, scaleEnemyOverguard, scaleEnemyStat, type EnemyScalingFaction } from "../../domain/logic/enemyScaling";
import { calculateDirectDamageToInitialPools, simulateDirectAttackSequence, simulateExpectedWeaponEncounter, type DirectTargetDamageInput } from "../../domain/logic/targetDamage";
import { buildCustomRivenEntry, customRivenSupportsWeapon, type CustomRivenRecord } from "../../domain/rivens";
import {
    computeCapacity, countPolarityChanges, effectiveDrain,
    maxWeaponRank, type CapacityConfig,
} from "../../domain/logic/capacityCalc";
import { useTrackerStore } from "../../store/store";
import { getHighestOwnedArcaneRankWithFallback, hasOwnedArcane } from "../../domain/logic/arcaneInventory";
import type { SavedBuild, SavedBuildPlannerConfig, SavedBuildTargetConfig } from "../../domain/models/userState";
import { WorkspacePanel, WorkspaceSegmented, WorkspaceSegmentedButton } from "../../components/workspace/WorkspaceChrome";

function getTargetHitLocationProfile(
    targetFaction: string,
    targetProfileOverride?: TargetProfileOverride | null,
): HitLocationDamageProfile {
    const target = getTargetProfileAssumptions(targetFaction, targetProfileOverride);
    return {
        headshotRate: target.headshotHitRate,
        headshotMultiplier: target.headshotMultiplier,
        criticalHeadshotMultiplier: target.criticalHeadshotMultiplier,
        headIsWeakPoint: target.headIsWeakPoint,
    };
}

function hasBurstOnlyConditionalAssumption(state: ConditionalState | undefined): boolean {
    return withoutBurstOnlyConditionalAssumptions(state) !== state;
}

// ── Polarity icons ────────────────────────────────────────────────────────────

const _polImgs = import.meta.glob<string>("../../assets/polarities/*.svg", {
    eager: true, query: "?url", import: "default",
});
const _polSvgRaw = import.meta.glob<string>("../../assets/polarities/*.svg", {
    eager: true, query: "?raw", import: "default",
});

// ── Status/damage-type icons ──────────────────────────────────────────────────

const _statusImgs = import.meta.glob<string>("../../assets/statuses/*.png", {
    eager: true, query: "?url", import: "default",
});
const _STATUS_FILE_MAP: Record<string, string> = {
    slash:       "SlashSymbol",
    impact:      "ImpactSymbol",
    puncture:    "PunctureSymbol",
    heat:        "HeatSymbol",
    cold:        "ColdSymbol",
    electricity: "ElectricitySymbol",
    toxin:       "ToxinSymbol",
    blast:       "BlastSymbol",
    radiation:   "RadiationSymbol",
    gas:         "GasSymbol",
    magnetic:    "MagneticSymbol",
    viral:       "ViralSymbol",
    corrosive:   "CorrosiveSymbol",
    void:        "VoidSymbol",
};
const DAMAGE_TYPE_ICON: Record<string, string> = {};
for (const [path, url] of Object.entries(_statusImgs)) {
    const base = path.split("/").pop()!.replace(".png", "");
    for (const [dmgType, file] of Object.entries(_STATUS_FILE_MAP)) {
        if (base === file) DAMAGE_TYPE_ICON[dmgType] = url as string;
    }
}
const COMBINED_ELEMENT_PARENTS: Record<string, [string, string]> = {
    blast:     ["heat", "cold"],
    radiation: ["heat", "electricity"],
    gas:       ["heat", "toxin"],
    magnetic:  ["cold", "electricity"],
    viral:     ["cold", "toxin"],
    corrosive: ["electricity", "toxin"],
};
const BEAST_CLAW_CONDITIONING_WIKI_URL: Record<"impact" | "puncture" | "slash", string> = {
    impact: "https://wiki.warframe.com/w/Brute_Conditioning",
    puncture: "https://wiki.warframe.com/w/Disabling_Conditioning",
    slash: "https://wiki.warframe.com/w/Precision_Conditioning",
};
const BEAST_CLAW_ELEMENTAL_CONVERSION_WIKI_URL: Record<"heat" | "cold" | "electricity" | "toxin", string> = {
    heat: "https://wiki.warframe.com/w/Burning_Claws",
    cold: "https://wiki.warframe.com/w/Chilling_Claws",
    electricity: "https://wiki.warframe.com/w/Shocking_Claws",
    toxin: "https://wiki.warframe.com/w/Sepsis_Claws",
};

function effectiveBurstTiming(weapon: WeaponEntry | null | undefined, effectiveFireRate: number) {
    const burstCount = weapon?.burstCount;
    const burstCycleRate = weapon?.burstCycleRate;
    const burstDelay = weapon?.burstDelay;
    if (
        !weapon || !isBurstTriggerType(weapon.trigger) ||
        !Number.isFinite(burstCount) || !Number.isFinite(burstCycleRate) ||
        !Number.isFinite(burstDelay) || (burstCount ?? 0) <= 1 ||
        (burstCycleRate ?? 0) <= 0 || (burstDelay ?? 0) < 0 || effectiveFireRate <= 0
    ) return {};

    const count = burstCount as number;
    const cycleRate = burstCycleRate as number;
    const delay = burstDelay as number;
    const baseEffectiveRate = count / (1 / cycleRate + (count - 1) * delay);
    const rateScale = effectiveFireRate / baseEffectiveRate;
    return {
        burstCount: count,
        burstCycleRate: cycleRate * rateScale,
        burstDelaySeconds: delay / rateScale,
    };
}

type BuilderTargetEncounterOptions = {
    targetAssumptions: ReturnType<typeof getTargetProfileAssumptions>;
    targetFaction: string;
    targetProfileOverride?: TargetProfileOverride | null;
    statusImmuneTypes: Iterable<StatusDamageType>;
    externalStatusTypeCount: number;
    externalStatusTypes: readonly ExternalStatusType[];
    conditionalState: ConditionalState;
};

function simulateBuilderTargetEncounter(
    weapon: WeaponEntry,
    stats: ReturnType<typeof calculateBuild>["modded"],
    options: BuilderTargetEncounterOptions,
): ReturnType<typeof simulateExpectedWeaponEncounter> {
    const {
        targetAssumptions,
        targetFaction,
        targetProfileOverride,
        statusImmuneTypes,
        externalStatusTypeCount,
        externalStatusTypes,
        conditionalState,
    } = options;
    return simulateExpectedWeaponEncounter({
        damageByType: stats.damageBreakdownBeforePerStatus,
        rawDamageByType: stats.rawDamageBreakdownBeforePerStatus,
        baseDamageTotal: stats.baseDamageTotal,
        hitLocation: stats.hitLocation,
        health: targetAssumptions.health,
        shields: targetAssumptions.shields,
        overguard: targetAssumptions.overguard,
        maxShields: targetAssumptions.shields,
        maxOverguard: targetAssumptions.overguard,
        armor: targetAssumptions.armor,
        baseArmorValue: targetProfileOverride?.armorBaseValue ?? targetAssumptions.armor,
        armorLevelMultiplier: targetProfileOverride?.armorLevelMultiplier ?? 1,
        shatteringImpactBaseArmorPerHit: stats.shatteringImpactBaseArmorPerHit,
        faction: targetFaction,
        factionDamageBonus: stats.factionDamageBonus,
        toxinBypassesShields: targetAssumptions.toxinBypassesShields,
        enemyShieldGateHitMode: targetProfileOverride?.enemyShieldGateHitMode,
        damageRampRule: weapon.selectedAttackDamageRamp,
        critChance: stats.critChance,
        critMultiplier: stats.critMultiplier,
        critTierEnhancementChance: stats.vigilanteCritTierEnhancementChance,
        nonCriticalHitDamageProcs: stats.nonCriticalHitDamageProcs,
        expectedProjectiles: stats.multishot,
        expectedDamageMultiplier: stats.damageWeightedMultishot,
        singleProjectileDamageBonus: stats.singleProjectileDamageBonus,
        initialAttackDelaySeconds: stats.initialAttackDelaySeconds,
        attackIntervalSeconds: 1 / Math.max(0.0001, stats.fireRate),
        autoSpoolCadenceRule: weapon.selectedAttackAutoSpoolCadence,
        autoSpoolShotSequenceRule: weapon.selectedAttackAutoSpoolShotSequence,
        shotsPerMagazine: stats.finiteShotsPerMag,
        attackCountLimit: !stats.ammoGateSatisfied
            ? 0
            : weapon.selectedAttackIsIncarnon && weapon.selectedAttackIncarnonAmmoCapacity !== undefined
                ? stats.finiteShotsPerMag
                : undefined,
        infiniteAmmoActive: stats.infiniteAmmoActive,
        firstShotMagazineDamageBonus: stats.firstShotMagazineDamageBonus,
        lastShotMagazineDamageBonus: stats.lastShotMagazineDamageBonus,
        reloadDurationSeconds: weapon.weaponType.trim().toLowerCase() === "bow" ? 0 : stats.reloadTimeWithoutDirectHitBuff,
        directHitReloadSpeedRule: stats.directHitReloadSpeedRule,
        ...effectiveBurstTiming(weapon, stats.fireRate),
        statusDurationMultiplier: stats.statusDurationMultiplier,
        ...(stats.nightwatchNapalm ? {
            nightwatchNapalm: {
                directDamagePerProjectilePerTick: stats.nightwatchNapalm.directDamagePerProjectilePerTick,
                heatProcChancePerTick: stats.nightwatchNapalm.heatProcChancePerTick,
                heatStatusDurationSeconds: stats.nightwatchNapalm.heatStatusDurationSeconds,
                heatDotDamagePerProcPerTick: stats.nightwatchNapalm.heatDotDamagePerProcPerTick,
                heatDotAccumulatorDamagePerTick: stats.nightwatchNapalm.heatDotAccumulatorDamagePerTick,
                heatDotDamagePerProcPerTickWhenExternallyInherited:
                    stats.nightwatchNapalm.heatDotDamagePerProcPerTickWhenExternallyInherited,
                heatDotAccumulatorDamagePerTickWhenExternallyInherited:
                    stats.nightwatchNapalm.heatDotAccumulatorDamagePerTickWhenExternallyInherited,
            },
        } : {}),
        attachedAttackDamageSequence: stats.attachedAttackDamageSequence,
        targetStatusDamageVulnerabilityBonus: stats.targetStatusDamageVulnerabilityBonus,
        initialHeatStatusPresenceProbability: conditionalState.externalHeatStatusPresenceProbability,
        dotDamagePerAttackByType: stats.dotDamagePerShotByType,
        dotDamagePerApplicationByType: Object.fromEntries(
            Object.entries(stats.dotDamagePerShotByType).flatMap(([rawType, damagePerAttack]) => {
                const type = rawType as StatusDamageType;
                const applications = stats.averageProcsPerShot * (stats.procChanceByType[type] ?? 0);
                return applications > 0 ? [[type, damagePerAttack / applications]] : [];
            }),
        ) as Partial<Record<StatusDamageType, number>>,
        heatDotTickDamagePerProc: stats.dotTickDamagePerProcBeforeConditionOverloadByType.heat,
        heatDotAccumulatorDamagePerTick: stats.dotTickAccumulatorDamageByType.heat,
        heatDotTickDamagePerProcWhenExternallyInherited:
            stats.heatDotTickDamagePerProcWhenExternallyInherited,
        heatDotAccumulatorDamagePerTickWhenExternallyInherited:
            stats.heatDotAccumulatorDamagePerTickWhenExternallyInherited,
        dotSeedDamagePerApplicationByType: stats.dotDamagePerApplicationSeedByType,
        dotAccumulatorDamagePerApplicationByType: stats.dotDamagePerApplicationAccumulatorByType,
        statusProcWeightsByType: stats.damageBreakdownBeforePerStatus,
        statusRollsPerAttack: stats.multishot * stats.statusChance,
        forcedStatusApplicationsPerAttackByType: stats.unfilteredExtraProcsPerShot as Partial<Record<StatusDamageType, number>>,
        statusImmuneTypes,
        statusStackCaps: targetProfileOverride?.statusStackCaps,
        blastStackHitDamagePerProc: stats.blastStackHitDamagePerProcBeforeConditionOverload,
        nearbyBlastEnemyCount: targetProfileOverride?.nearbyBlastEnemyCount,
        nearbyElectricGasEnemyCount: targetProfileOverride?.nearbyEnemyCount,
        nearbyGasOuterEnemyCount: targetProfileOverride?.nearbyGasOuterEnemyCount,
        magneticBreakElectricSourceMultiplier: stats.magneticBreakElectricSourceMultiplier,
        directDamagePerStatusBonus: stats.directDamagePerStatusBonus,
        conditionOverloadDamagePerStatusBonus: stats.conditionOverloadApplies
            ? stats.conditionOverloadDamagePerStatusBonus
            : 0,
        externalConditionOverloadStatusTypeCount: externalStatusTypeCount,
        externalStatusTypes,
        uniqueStatusProcsPerAttack: weapon.uniqueStatusProcs,
        intrinsicDamagePerStatusBonus: stats.intrinsicDamagePerStatusBonus,
        intrinsicDamagePerStatusMode: stats.intrinsicDamagePerStatusMode,
        totalDamageBonus: stats.totalDamageBonus,
        timedConditionalDamageStacks: stats.timedConditionalDamageStacks,
    });
}

function estimateGalvanizedPerStatusKillRate(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    targetFaction: string,
    targetProfileOverride: TargetProfileOverride | undefined,
    conditionalState: ConditionalState,
    externalStatusTypeCount: number,
    externalStatusTypes: readonly ExternalStatusType[],
    statusImmuneTypes?: Iterable<StatusDamageType>,
): number | undefined {
    const hasGalvanizedPerStatusKillEffect = effects.some((effect) =>
        effect?.conditionalEffects?.some((conditional) =>
            conditional.trigger === "onKill" && (conditional.stats.directDamagePerStatusBonus ?? 0) > 0,
        ) === true,
    );
    if (
        !hasGalvanizedPerStatusKillEffect ||
        weapon.selectedAttackIsAreaDamage === true ||
        conditionalState.mode !== "realistic"
    ) return undefined;
    if (weapon.selectedAttackAutoSpoolTimingLimitation) return 0;

    const targetAssumptions = getTargetProfileAssumptions(targetFaction, targetProfileOverride);
    if (
        targetAssumptions.overguard > 0 &&
        effects.some((effect) => (effect?.sentientIncisionDamageBonus ?? 0) > 0)
    ) return 0;
    const effectiveStatusImmunities = statusImmuneTypes ?? targetAssumptions.statusImmuneTypes;
    const finiteConditionalState = withoutBurstOnlyConditionalAssumptions(conditionalState) ?? conditionalState;
    const simulateAtKillRate = (killRate: number) => {
        const metrics = calculateBuildForExpectedEncounter(weapon, effects, targetFaction, {
            conditionalState: finiteConditionalState,
            targetHasOverguard: targetAssumptions.overguard > 0,
            statusImmuneTypes: effectiveStatusImmunities,
            statusStackCaps: targetProfileOverride?.statusStackCaps ?? targetAssumptions.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(targetFaction, targetProfileOverride),
            targetStatusState: "initial",
            expectedKillRatePerSecond: killRate,
        });
        return simulateBuilderTargetEncounter(weapon, metrics.modded, {
            targetAssumptions,
            targetFaction,
            targetProfileOverride,
            statusImmuneTypes: effectiveStatusImmunities,
            externalStatusTypeCount,
            externalStatusTypes,
            conditionalState: finiteConditionalState,
        });
    };

    const noGalvanizedStacksEncounter = simulateAtKillRate(0);
    let expectedKillRatePerSecond = noGalvanizedStacksEncounter.timeToKillSeconds &&
        noGalvanizedStacksEncounter.timeToKillSeconds > 0
        ? 1 / noGalvanizedStacksEncounter.timeToKillSeconds
        : 0;
    for (let iteration = 0; iteration < 3 && expectedKillRatePerSecond > 0; iteration++) {
        const encounter = simulateAtKillRate(expectedKillRatePerSecond);
        const nextKillRatePerSecond = encounter.timeToKillSeconds && encounter.timeToKillSeconds > 0
            ? 1 / encounter.timeToKillSeconds
            : 0;
        if (nextKillRatePerSecond <= expectedKillRatePerSecond * (1 + 1e-6)) break;
        expectedKillRatePerSecond = nextKillRatePerSecond;
    }
    return expectedKillRatePerSecond;
}
const POL_IMG: Record<string, string> = {};
const POL_SVG_RAW: Record<string, string> = {};
for (const [p, url] of Object.entries(_polImgs)) {
    POL_IMG[p.split("/").pop()!.replace(".svg", "").toLowerCase()] = url as string;
}
for (const [p, svg] of Object.entries(_polSvgRaw)) {
    POL_SVG_RAW[p.split("/").pop()!.replace(".svg", "").toLowerCase()] = svg as string;
}
const POL_FILE: Record<string, string> = {
    madurai: "madurai_pol", naramon: "naramon_pol", vazarin: "vazarin_pol",
    zenurik: "zenurik_pol", unairu:  "unairu_pol",  penjaga: "penjaga_pol",
    umbra:   "umbra_pol",   any:     "any_pol",
};
function PolarityIcon({ polarity, className = "w-4 h-4" }: { polarity: string; className?: string }) {
    const src = POL_IMG[POL_FILE[polarity] ?? ""] ?? null;
    if (!src) return <span className="text-slate-600 text-[10px]">○</span>;
    return <img src={src} alt={polarity} className={className} style={{ filter: "brightness(0) invert(1) opacity(0.65)" }} />;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_COUNT = 8;
const INCARNON_TIER_ORDER: IncarnonTier[] = [1, 2, 3, 4, 5];
const INCARNON_TIER_LABELS: Record<IncarnonTier, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
};
const INCARNON_PATH_REFINEMENT_LIMIT = 2;
const WEAPON_FILTER_OPTIONS: Array<{ value: WeaponCategory | "All"; label: string; compactLabel?: string }> = [
    { value: "All", label: "All Weapons", compactLabel: "All" },
    { value: "Primary", label: "Primary" },
    { value: "Secondary", label: "Secondary" },
    { value: "Melee", label: "Melee" },
    { value: "Arch-Gun", label: "Arch Gun" },
    { value: "Arch-Melee", label: "Arch Melee" },
    { value: "Companion", label: "Companion" },
];
const GOAL_OPTIONS: { key: OptimizeGoal; label: string; desc: string }[] = [
    {
        key: "burst",
        label: "Burst DPS",
        desc: "Ranks builds by immediate damage output for the selected attack and target assumptions.",
    },
    {
        key: "scaling",
        label: "Sustained DPS",
        desc: "Ranks builds by damage across repeated attacks and reload cycles for the selected target assumptions.",
    },
    {
        key: "timeToKill",
        label: "Expected TTK",
        desc: "Ranks legal builds by finite expected time to kill; kills within 600 seconds rank first, and if both reach the simulation cap, expected damage per second breaks the tie.",
    },
    {
        key: "windowDps",
        label: "5s Avg DPS",
        desc: "Ranks a single target by applied damage in the first five seconds divided by five. Overkill, damage after defeat, and events exactly at 5s are excluded; outcomes use deterministic mean-field estimates, not Underframe's seeded sample mean.",
    },
    {
        key: "meleeDps",
        label: "Wiki Stance DPS",
        desc: "Ranks melee builds by the selected Wiki Neutral-combo estimate in Initial state: direct combo damage plus forced Slash over approximate timing. It applies the selected faction mod, but does not score target defenses or full stance/status histories.",
    },
    {
        key: "tennokaiDps",
        label: "Tennokai Cycle DPS",
        desc: "Ranks a supported four-cycle Normal Attack / Heavy Attack or Heavy Slam sequence with ordered melee Slash applications and Bleed ticks. Direct hits and ticks deplete the selected pools, stop when a target dies, then continue against identical targets. Full-pool optimization uses a one-cycle shortlist and re-scores finalists on four cycles plus the Bleed tail. Other statuses, melee range, and numeric Heavy Attack wind-up are excluded.",
    },
];
const FACTIONS = getFactionFocusOptions();
const ENEMY_SCALING_FACTIONS: Array<{ label: string; value: EnemyScalingFaction }> = [
    { label: "Grineer", value: "grineer" },
    { label: "Corpus", value: "corpus" },
    { label: "Infested", value: "infested" },
    { label: "Corrupted / Orokin", value: "corrupted" },
    { label: "Murmur", value: "murmur" },
    { label: "Sentient", value: "sentient" },
    { label: "Anarchs", value: "anarchs" },
    { label: "Unaffiliated", value: "unaffiliated" },
    { label: "Techrot", value: "techrot" },
];
const VALENCE_ELEMENTS = [
    { key: "impact", label: "Impact" },
    { key: "heat", label: "Heat" },
    { key: "cold", label: "Cold" },
    { key: "electricity", label: "Electricity" },
    { key: "toxin", label: "Toxin" },
    { key: "magnetic", label: "Magnetic" },
    { key: "radiation", label: "Radiation" },
] as const;
type ValenceElement = typeof VALENCE_ELEMENTS[number]["key"];
const POLARITY_OPTS = [
    { key: "",        label: "None"    },
    { key: "madurai", label: "Madurai" },
    { key: "naramon", label: "Naramon" },
    { key: "vazarin", label: "Vazarin" },
    { key: "zenurik", label: "Zenurik" },
    { key: "unairu",  label: "Unairu"  },
    { key: "penjaga", label: "Penjaga" },
    { key: "umbra",   label: "Umbra"   },
];
const STATUS_TIPS: Record<string, string> = {
    impact:      "Stagger (6s; 5 stacks max): repeat procs lengthen the stagger; Ospreys, bosses, and Tenno are immune to it. On heavy, Mercy-eligible units, each stack adds 8 percentage points to the Mercy health threshold (up to +40% / 80% total; Corpus/Eximus with all Shields removed can reach 100%). The panel reports only the mean-field bonus; it does not identify eligible or immune enemies or simulate Mercy outcomes, and the optimizer does not score this utility.",
    puncture:    "Weakened (10s; normally 5 stacks): the target's attacks deal 40% less damage at 1 stack, then 10 percentage points less per added stack (80% at 5). Subsequent weapon hits against it gain +5 percentage points Critical Chance per stack (up to +25%), additive after mods; Area-of-Effect damage and Warframe abilities do not get this bonus. The status panel displays the expected enemy-damage reduction, but no enemy attacks or defensive outcome are simulated and the optimizer does not score it. The crit bonus is omitted only for attacks explicitly marked as AoE, so unclassified rows may be uncertain. Overguarded VIPs cap at 3 stacks; select the Overguarded VIP option in custom target settings to apply the Wiki-documented 3-stack cap.",
    slash:       "Bleed: Deals 35% base damage/sec over 6s, ignoring armor. Each proc is independent — multiple stacks deal multiple simultaneous DoTs.",
    heat:        "Ignite: Deals 50% base damage/sec as Heat DoT over 6s after a 1s delay and gradually strips up to 50% armor over 2s. Panic duration depends on enemy type (about 4s for humanoids, 3s for most Infested, and 2s for MOAs/Chargers); Ospreys, bosses, Tenno, and enemies with active Overguard are immune to the crowd control. Applying Heat again reapplies panic, and breaking Overguard triggers it even without a new Heat proc. This target-dependent utility is not included in the optimizer score.",
    cold:        "Freeze (10 stacks max): −50% movement/fire/attack speed. Each extra stack adds −5% slow (max −90% at 9 stacks). At 10 stacks: enemy freezes solid for 3s, shields stop recharging, +1.0 crit multiplier bonus.",
    electricity: "Tesla Chain: Deals 50% base damage/sec as Electricity to enemies within 3m. Stuns primary target for 3s.",
    toxin:       "Poison: Deals 50% base damage/sec as Toxin DoT over 6s. Bypasses shields — damage goes directly to health.",
    blast:       "Detonate (10 stacks max): Each stack explodes after 1.5s for 30% base damage. At 10 stacks or on death: explosion hits all enemies within 5m for 300% × stacks. Removed the old 'inaccuracy' effect.",
    corrosive:   "Corrosion (10 stacks max): Removes 26% armor on first stack, then 6% per additional stack — max 80% armor stripped at 10 stacks. Lasts 8s per stack.",
    gas:         "Gas Cloud: Deals 50% base damage/sec as Gas DoT in a 3m radius (up to 6m at 10 stacks). Stacks increase radius by 0.3m each.",
    magnetic:    "Disrupt (10 stacks max): Amplifies damage to Shields/Overguard by 100% (first stack), +25% each subsequent stack (max +325%). Stops shield regen. On shield break: deals Electricity damage equal to 3% of max shields per stack.",
    radiation:   "Confusion (10 stacks max): Enemy attacks closest ally, receives +100% friendly-fire damage (first stack), +50% per additional stack (max +550% at 10). Lasts 12s per stack.",
    viral:       "Virus (10 stacks max): Amplifies damage to health by 100% (first stack), +25% each subsequent stack (max +325%). Lasts 6s per stack.",
    void:        "Bullet Attract: Void effects can create a bullet attractor effect on the target.",
    tau:         "Status Vulnerability: Tau effects increase the target's vulnerability to status.",
    true:        "True Damage: Direct damage that bypasses normal mitigation rules.",
};
const BASIC_STAT_TOOLTIPS: Record<string, string> = {
    attackSpeed: "Modifies how fast the attack animation plays. Actual attacks per second vary by weapon type and stance.",
    fireRate: "Maximum number of discrete attack events or damage instances performed per second.",
    magazine: "The number of uses available before a reload or refill is required. Weapons without an explicit magazine are shown here as infinite.",
    reload: "The time spent replenishing the weapon's available uses, determined by its reload animation speed and any reload speed modifiers.",
    multishot: "The number of damage instances created by a single attack input without consuming additional ammo or uses. Each instance rolls crit and status independently.",
    burstDps: "Burst DPS is a Tenno Hub derived stat: expected damage per second under continuous firing with no reload downtime.",
    sustainedDps: "Sustained DPS is a Tenno Hub derived stat: expected damage per second after accounting for reload downtime where applicable.",
    criticalChance: "Chance that an attack becomes a critical hit. At 50%, about half of hits crit. At 100%, every hit is at least a yellow crit. Above 100%, the extra amount becomes a chance for a stronger crit tier: 125% means every hit is yellow and 25% become orange; 250% means every hit is orange and 50% become red.",
    criticalDamage: "Damage multiplier used when a hit crits. A yellow crit uses the listed multiplier, so 2.0x means double damage and 3.0x means triple. Orange and red crits are stronger tiers: orange uses 1 + 2 × (crit multiplier - 1), and red uses 1 + 3 × (crit multiplier - 1).",
    statusChance: "The probability that each hit inflicts a status effect. Values over 100% can apply multiple status effects in one hit.",
    totalDamage: "Unquantized Arsenal Total Damage after damage construction and multishot, before crit weighting. Modeled unique damage bonuses on generated projectiles are included; quantized per-projectile direct damage is shown separately.",
};

function describeMultishot(multishot: number) {
    const guaranteed = Math.floor(multishot);
    const extraChance = Math.max(0, multishot - guaranteed);
    if (multishot <= 1) return `This attack currently creates ${multishot.toFixed(2)} damage instances on average, so there are no additional guaranteed instances beyond the base hit.`;
    if (extraChance <= 0.0001) return `This attack currently creates ${guaranteed} damage instances every time. Each instance rolls critical hits and status independently.`;
    return `This attack currently creates ${guaranteed} guaranteed damage instance${guaranteed === 1 ? "" : "s"} with a ${(extraChance * 100).toFixed(1)}% chance to create one more. Each instance rolls critical hits and status independently.`;
}

function describeStatusChance(statusChance: number) {
    if (statusChance < 1) {
        return `Each damage instance currently has a ${(statusChance * 100).toFixed(1)}% chance to apply a status effect.`;
    }
    const guaranteed = Math.floor(statusChance);
    const extraChance = statusChance - guaranteed;
    if (extraChance <= 0.0001) {
        return `Each damage instance currently applies ${guaranteed} guaranteed status effect${guaranteed === 1 ? "" : "s"}.`;
    }
    return `Each damage instance currently applies ${guaranteed} guaranteed status effect${guaranteed === 1 ? "" : "s"} with a ${(extraChance * 100).toFixed(1)}% chance to apply one additional status effect.`;
}

function describeCritChance(critChance: number) {
    if (critChance < 1) {
        return `Each damage instance currently has a ${(critChance * 100).toFixed(1)}% chance to be a yellow crit and a ${((1 - critChance) * 100).toFixed(1)}% chance to stay non-critical.`;
    }
    if (critChance < 2) {
        return `Every damage instance is currently at least a yellow crit, with a ${((critChance - 1) * 100).toFixed(1)}% chance to upgrade to an orange crit.`;
    }
    if (critChance < 3) {
        return `Every damage instance is currently at least an orange crit, with a ${((critChance - 2) * 100).toFixed(1)}% chance to upgrade to a red crit.`;
    }
    return `Every damage instance is currently at least a red crit, with a ${((critChance - Math.floor(critChance)) * 100).toFixed(1)}% chance to upgrade to the next crit tier.`;
}

function describeCritMultiplier(critChance: number, critMultiplier: number) {
    const yellow = critMultiplier;
    const orange = 1 + 2 * (critMultiplier - 1);
    const red = 1 + 3 * (critMultiplier - 1);
    if (critChance < 1) {
        return `A yellow crit currently deals ${yellow.toFixed(2)}x normal damage. Because crit chance is below 100%, only some hits receive that multiplier.`;
    }
    if (critChance < 2) {
        return `A yellow crit currently deals ${yellow.toFixed(2)}x normal damage. Since every hit is at least yellow, that is your baseline crit multiplier, and upgraded orange crits deal ${orange.toFixed(2)}x damage.`;
    }
    return `Orange crits currently deal ${orange.toFixed(2)}x normal damage, and red crits deal ${red.toFixed(2)}x.`;
}
const EMPTY_SAVED_BUILDS: SavedBuild[] = [];
const EMPTY_COUNTS: Record<string, number> = {};
const EMPTY_MOD_RANKS: Record<string, number> = {};
const EMPTY_ARCANE_RANKS: Record<string, Record<string, number>> = {};
const EMPTY_CUSTOM_RIVENS: CustomRivenRecord[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, d = 0) {
    return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}
function describeLastShotMagazineInactiveReason(reason: string): string {
    switch (reason) {
        case "base-magazine-under-six":
            return "the weapon's base magazine capacity is below 6";
        case "continuous-weapon":
            return "Synth Charge does not affect continuous attacks in this model";
        case "unmodeled-reload-grenade":
            return "the Catabolyst reload-grenade exception is not modeled";
        case "incarnon-attack":
            return "Synth Charge does not affect Incarnon attacks";
        case "exalted-weapon":
            return "Synth Charge does not affect Exalted weapons";
        case "infinite-ammo":
            return "the selected condition assumes the magazine never empties";
        case "one-attack-per-magazine":
            return "this attack consumes the whole magazine in one attack";
        default:
            return "the selected attack does not meet the modeled requirements";
    }
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function displayMagazineValue(weapon: WeaponEntry, magazineSize: number) {
    return weapon.hasExplicitMagazineSize ? String(magazineSize) : "∞";
}

function usesHitTerminology(category: WeaponCategory) {
    return usesMeleeDamageModel(category);
}

function averageDamageLabel(category: WeaponCategory) {
    return usesHitTerminology(category) ? "Avg Hit" : "Avg Shot";
}

function actionUnitLabel(category: WeaponCategory) {
    return usesHitTerminology(category) ? "hit" : "shot";
}

function actionRateLabel(category: WeaponCategory) {
    return usesHitTerminology(category) ? "Attack Speed" : "Fire Rate";
}

function normalizeBuilderModPath(path: string): string {
    return path
        .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
        .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function isBuilderBeginnerPath(path: string): boolean {
    return /\/beginner\//i.test(path) || /Beginner$/i.test(path);
}

function isBuilderExpertPath(path: string): boolean {
    return /\/expert\//i.test(path) || /Expert$/i.test(path);
}

function getBuilderModVariantTier(entry: ModEntry): "flawed" | "standard" | "expert" {
    if (isBuilderBeginnerPath(entry.path)) return "flawed";
    if (isBuilderExpertPath(entry.path)) return "expert";
    return normalizeBuilderModPath(entry.path) !== entry.path && /Intermediate/.test(entry.path) ? "standard" : "standard";
}

function getBuilderDisplayModName(entry: ModEntry): string {
    return getBuilderModVariantTier(entry) === "flawed" ? `${entry.name} (Flawed)` : entry.name;
}

function normalizeArcaneDisplayText(value: string | null | undefined) {
    if (!value) return value ?? "";
    const parts = value
        .split(/\s+\|\s+|\s+·\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) return value;

    const baseParts = parts.filter((part) => !/^(On |While |Gain |If |Enemies|Kill|When|Deals)/i.test(part));
    const cleaned = parts
        .map((part) => {
            if (!/^(On |While |Gain |If |Enemies|Kill|When|Deals)/i.test(part)) return part;
            let next = part;
            for (const base of baseParts) {
                if (next.toLowerCase() === base.toLowerCase()) continue;
                next = next
                    .replace(new RegExp(`(?:\\s*[|·]\\s*)?${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/\s+\.\s*$/g, ".")
                    .trim();
            }
            return next;
        })
        .filter(Boolean);

    const seen = new Set<string>();
    const deduped = cleaned.filter((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return deduped.join(" | ");
}

function svgPolarityIconMarkup(polarity: string | null | undefined, x: number, y: number, size = 16) {
    const normalized = (polarity ?? "").toLowerCase();
    const raw = POL_SVG_RAW[POL_FILE[normalized] ?? ""] ?? null;
    if (!raw) return `<text x="${x}" y="${y + size - 2}" class="slotMeta">○</text>`;
    const inner = raw
        .replace(/<\?xml[\s\S]*?\?>/g, "")
        .replace(/<svg[^>]*>/i, "")
        .replace(/<\/svg>\s*$/i, "")
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
        .replace(/<defs[\s\S]*?<\/defs>/gi, "")
        .replace(/<defs[^>]\/>/gi, "")
        .replace(/<sodipodi:namedview[\s\S]*?\/>/gi, "")
        .replace(/\s+[a-zA-Z_][\w.-]*:[\w.-]+="[^"]*"/g, "")
        .replace(/\s+[a-zA-Z_][\w.-]*:[\w.-]+='[^']*'/g, "")
        .replace(/<\/?[a-zA-Z_][\w.-]*:[\w.-]+[^>]*>/g, "")
        .replace(/fill:#000000/gi, "fill:#cbd5e1")
        .replace(/stroke:#000000/gi, "stroke:#cbd5e1");
    const scale = size / 50;
    return `<g transform="translate(${x}, ${y}) scale(${scale})" opacity="0.78">${inner}</g>`;
}

interface BuildMathSection {
    title: string;
    lines: string[];
}

interface BuildMathBreakdown {
    sections: BuildMathSection[];
}

type MeleeDpsInputState = WikiMeleeStanceCombo;

function readWarframeArmor(value: number | undefined): number | undefined {
    if (!Number.isFinite(value) || (value ?? -1) < 0) return undefined;
    return Math.floor(Math.min(10_000, value ?? 0));
}

function parseWarframeArmorInput(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.floor(Math.min(10_000, parsed))
        : undefined;
}

function parseWarframeMaxEnergyInput(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.floor(Math.min(10_000, parsed))
        : undefined;
}

function parseWarframeEnergyPercentInput(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.min(100, parsed)
        : undefined;
}

function parseExternalHeatBonusPercentInput(value: string): number {
    if (!value.trim()) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.min(10_000, parsed)
        : 0;
}

function readExternalHeatBonusPercent(value: number | undefined): number {
    return Number.isFinite(value) && (value ?? -1) >= 0
        ? Math.min(10_000, value ?? 0)
        : 0;
}

interface BuildExportPayload {
    exportedAt: string;
    source: string;
    scoreAvailability?: {
        targetDamageAndDpsAvailable: boolean;
        reason?: string;
        sourceUrl?: string;
        sustainedDpsAvailable?: boolean;
        sustainedDpsReason?: string;
        dotDpsAvailable?: boolean;
        dotDpsReason?: string;
        finiteTargetScoringAvailable?: boolean;
        finiteTargetScoringReason?: string;
    };
    weapon: {
        name: string;
        uniqueName: string;
        category: WeaponCategory;
        selectedAttack: string | null;
    };
    assumptions: {
        goal: LegacyOptimizeGoal;
        targetFaction: string | null;
        targetProfileOverride?: TargetProfileOverride;
        weaponRank: number;
        masteryRank: number;
        hasCatalyst: boolean;
        formaCount: number;
        valenceBonusPct?: number;
        valenceElement?: string | null;
        optimizeValenceElement?: boolean;
        incarnonUnlockedTier?: number;
        incarnonSelectedOptionsByTier?: Partial<Record<IncarnonTier, string>>;
        optimizeIncarnonSelections?: boolean;
        includeArcaneStats: boolean;
        warframeArmor?: number;
        warframeMaxEnergy?: number;
        warframeEnergyPercent?: number;
        selectedAttackIdx: number;
        meleeStanceCombo: (WikiMeleeStanceCombo & { sourceUrl: string; verifiedAt: string }) | null;
    };
    optimizer: {
        mode: OptimizeMode;
        options: {
            respectCapacity: boolean;
            allowNonMaxRank: boolean;
            ownedOnly: boolean;
            factionFocus: boolean;
            allowCatalyst: boolean;
            allowForma: boolean;
            maxFormaAllowed: number;
            optimizeExilus: boolean;
            optimizeArcane: boolean;
            conditionalState?: ConditionalState;
        };
        pools: {
            compatibleMods: number;
            compatibleArcanes: number;
            ownedMods?: Array<{
                name: string;
                uniqueName: string;
                ownedMaxRank: number;
            }>;
            ownedArcanes?: Array<{
                name: string;
                uniqueName: string;
                ownedMaxRank: number;
            }>;
            excludedMods?: Array<{
                name: string;
                uniqueName: string;
            }>;
        };
    };
    build: {
        stance: {
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            slotPolarity: string;
            statsLabel: string | null;
        };
        slots: Array<{
            slot: number;
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            slotPolarity: string;
            modPolarity: string | null;
            statsLabel: string | null;
        }>;
        exilus: {
            enabled: boolean;
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            slotPolarity: string;
            statsLabel: string | null;
        };
        arcane: {
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            statsLabel: string | null;
        };
    };
    calculated: (ReturnType<typeof calculateBuild> & {
        meleeAverageDps?: (MeleeAverageDpsParameters & { averageHit: number; averageDps: number }) | null;
    }) | null;
    math: BuildMathBreakdown | null;
}

function escapeSvgText(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function wrapSvgText(value: string, maxChars: number) {
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars) {
            current = next;
            continue;
        }
        if (current) lines.push(current);
        if (word.length <= maxChars) {
            current = word;
            continue;
        }
        const chunks = word.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [word];
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1] ?? "";
    }
    if (current) lines.push(current);
    return lines;
}

function goalLabelForShare(goal: LegacyOptimizeGoal) {
    return GOAL_OPTIONS.find((option) => option.key === normalizeOptimizeGoal(goal))?.label ?? goal;
}

function renderSvgParagraph(lines: string[], x: number, y: number, lineHeight: number, className: string) {
    const escaped = lines.map((line) => escapeSvgText(line));
    return `<text x="${x}" y="${y}" class="${className}">${escaped
        .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`)
        .join("")}</text>`;
}

function renderBuildShareSvg(payload: BuildExportPayload) {
    const width = 1440;
    const isMelee = isGroundMeleeCategory(payload.weapon.category);
    const stats = payload.calculated?.modded ?? null;
    const burstDps = payload.calculated?.burstDPS ?? 0;
    const sustainedDps = payload.calculated?.sustainedDPS ?? 0;
    const scoreUnavailable = payload.scoreAvailability?.targetDamageAndDpsAvailable === false;
    const sustainedDpsUnavailable = scoreUnavailable || payload.scoreAvailability?.sustainedDpsAvailable === false;
    const dotDpsUnavailable = scoreUnavailable || payload.scoreAvailability?.dotDpsAvailable === false;
    const attackLabel = payload.weapon.selectedAttack ?? "Default Attack";
    const factionLabel = payload.assumptions.targetFaction ?? "General Use";
    const goalLabel = goalLabelForShare(payload.assumptions.goal);
    const weaponSubtitle = `${payload.weapon.category} • ${attackLabel}`;
    const avgDamageStatLabel = averageDamageLabel(payload.weapon.category);
    const rateStatLabel = actionRateLabel(payload.weapon.category);
    const summaryStats = [
        ["Burst DPS", scoreUnavailable ? "Unavailable" : fmt(burstDps)],
        ["Sustain DPS", sustainedDpsUnavailable ? "Unavailable" : fmt(sustainedDps)],
        [scoreUnavailable ? `Reference ${avgDamageStatLabel}` : avgDamageStatLabel, fmt(stats?.averageShotDamage ?? 0)],
        [scoreUnavailable ? "Reference Direct" : "Quantized Direct", fmt(stats?.totalDamage ?? 0)],
        [scoreUnavailable ? "Reference Arsenal Total" : "Arsenal Total", fmt(stats?.arsenalDamage ?? 0)],
        ["Crit Chance", `${fmt((stats?.critChance ?? 0) * 100, 1)}%`],
        ["Crit Mult", `${fmt(stats?.critMultiplier ?? 0, 2)}x`],
        ["Status", `${fmt((stats?.statusChance ?? 0) * 100, 1)}%`],
        ["Multishot", `${fmt(stats?.multishot ?? 0, 2)}x`],
        [rateStatLabel, `${fmt(stats?.fireRate ?? 0, 2)}/s`],
        ["Magazine", stats ? fmt(stats.magazineSize, 0) : "0"],
        ["Shots / Mag", stats ? (stats.infiniteAmmoActive ? "∞" : fmt(stats.shotsPerMag, 0)) : "0"],
        ["Reload", stats?.infiniteAmmoActive ? "None" : `${fmt(stats?.reloadTime ?? 0, 2)}s`],
        ["DoT DPS", dotDpsUnavailable ? "Unavailable" : fmt(stats?.dotDps ?? 0)],
        ...(payload.calculated?.meleeAverageDps
            ? [["Stance Avg DPS", scoreUnavailable ? "Unavailable" : fmt(payload.calculated.meleeAverageDps.averageDps)]]
            : []),
    ];
    const burstOnlyAssumptions = [
        (stats?.strainInfectionCritDamageBonus ?? 0) > 0
            ? `Strain Infection assumes ${stats?.strainInfectionCystsAtImpact ?? 0}/8 active cysts at impact for Burst scoring; cyst timing and uptime are not modeled.`
            : "",
        (stats?.dreadfulKillshotBonus ?? 0) > 0
            ? `Dreadful Killshot assumes ${fmt(stats?.dreadfulKillshotCurrentHealth ?? 0)} current Warframe Health for Burst scoring; health changes are not modeled.`
            : "",
        (stats?.deadlyManeuversHeadshotCritChanceBonus ?? 0) > 0
            ? `Deadly Maneuvers assumes ${stats?.deadlyManeuversShotsRemaining ?? 0} buffed shot(s) remain after a dodge; Burst averages the next two shots at the configured headshot share. Dodge and shot history are not modeled.`
            : "",
        (stats?.criticalPrecisionCritChanceBonus ?? 0) > 0
            ? `Critical Precision assumes ${stats?.criticalPrecisionHeadshotProjectiles ?? 0} prior headshot projectiles and adds +${fmt((stats?.criticalPrecisionCritChanceBonus ?? 0) * 100, 1)}% to base Critical Chance. Missed-burst decay and shot history are not modeled.`
            : "",
        (stats?.unseenDreadCritDamageBonus ?? 0) > 0
            ? `Unseen Dread assumes Dread is invisible and adds +${fmt((stats?.unseenDreadCritDamageBonus ?? 0) * 100, 0)}% Critical Damage. The three-enemy trigger and invisibility duration/history are not modeled.`
            : "",
        payload.scoreAvailability?.finiteTargetScoringAvailable === false &&
            payload.scoreAvailability.finiteTargetScoringReason?.toLowerCase().includes("overpressured rounds")
            ? "Overpressured Rounds uses a user-entered post-kill spread snapshot plus the selected rank's sourced Falloff Distance bonus for one Buckshot event in Burst only; kill timing, buff consumption, sustained/DoT DPS, and finite target scoring are unavailable."
            : "",
    ].filter(Boolean).join(" ");
    const damageRows = stats
        ? Object.entries(stats.rawDamageBreakdown)
              .filter(([, value]) => value > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
        : [];
    const slotCardWidth = 206;
    const slotGap = 16;
    const slotTopY = 258;
    const leftPanelX = 72;
    const slotCards = payload.build.slots.map((slot) => {
        const titleLines = wrapSvgText(slot.mod ?? `Empty Slot ${slot.slot}`, 20);
        const bodyLines = wrapSvgText(slot.statsLabel ?? "Open slot", 27);
        const height = 128 + Math.max(0, titleLines.length - 1) * 18 + bodyLines.length * 15;
        return {
            title: slot.mod ?? `Empty Slot ${slot.slot}`,
            subtitle: slot.mod ? `Rank ${slot.rank}` : "No mod equipped",
            body: slot.statsLabel ?? "Open slot",
            accent: slot.mod ? "#60a5fa" : "#475569",
            slotLabel: `Slot ${slot.slot}`,
            polarity: slot.slotPolarity,
            titleLines,
            bodyLines,
            height,
        };
    });
    const slotRows = [slotCards.slice(0, 4), slotCards.slice(4, 8)];
    const slotRowHeights = slotRows.map((row) => Math.max(...row.map((card) => card.height)));
    const slotRowYs = slotRowHeights.reduce<number[]>((ys, _, index) => {
        if (index === 0) return [slotTopY];
        return [...ys, ys[index - 1] + slotRowHeights[index - 1] + 22];
    }, []);
    const slotBlocks = slotRows
        .map((row, rowIndex) =>
            row
                .map((slot, colIndex) => {
                    const x = leftPanelX + colIndex * (slotCardWidth + slotGap);
                    const y = slotRowYs[rowIndex];
                    return `
                      <g transform="translate(${x}, ${y})">
                        <rect width="${slotCardWidth}" height="${slotRowHeights[rowIndex]}" rx="18" fill="#091120" fill-opacity="0.76" stroke="${slot.accent}" stroke-opacity="0.35" />
                        <rect x="16" y="18" width="${slotCardWidth - 32}" height="10" rx="5" fill="${slot.accent}" fill-opacity="0.22" />
                        <text x="16" y="45" class="slotEyebrow">${escapeSvgText(slot.slotLabel)}</text>
                        ${svgPolarityIconMarkup(slot.polarity, slotCardWidth - 32, 26, 16)}
                        ${renderSvgParagraph(slot.titleLines, 16, 67, 18, "slotTitle")}
                        <text x="16" y="${85 + Math.max(0, slot.titleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(slot.subtitle)}</text>
                        ${renderSvgParagraph(slot.bodyLines, 16, 105 + Math.max(0, slot.titleLines.length - 1) * 18, 15, "slotBody")}
                      </g>
                    `;
                })
                .join(""),
        )
        .join("");
    const modGridBottom = slotRowYs[slotRowYs.length - 1] + slotRowHeights[slotRowHeights.length - 1];
    const stanceTitleLines = wrapSvgText(payload.build.stance.mod ?? "No Stance", 28);
    const stanceBodyLines = wrapSvgText(payload.build.stance.statsLabel ?? "No stance mod equipped", 34);
    const stanceHeight = 96 + Math.max(0, stanceTitleLines.length - 1) * 18 + stanceBodyLines.length * 17;
    const exilusTitleLines = wrapSvgText(payload.build.exilus.mod ?? "No Exilus", 28);
    const exilusBodyLines = wrapSvgText(payload.build.exilus.statsLabel ?? "No exilus mod equipped", 34);
    const exilusHeight = 96 + Math.max(0, exilusTitleLines.length - 1) * 18 + exilusBodyLines.length * 17;
    const arcaneTitleLines = wrapSvgText(payload.build.arcane.mod ?? "No Arcane", 28);
    const arcaneBodyLines = wrapSvgText(payload.build.arcane.statsLabel ?? "No arcane equipped", 34);
    const arcaneHeight = 96 + Math.max(0, arcaneTitleLines.length - 1) * 18 + arcaneBodyLines.length * 17;
    const rightRailX = leftPanelX + 4 * (slotCardWidth + slotGap) + 34;
    const rightRailWidth = 398;
    const arcaneY = isMelee ? 234 : slotRowYs[0] + Math.max(0, (slotRowHeights[0] - arcaneHeight) / 2);
    const exilusY = isMelee ? modGridBottom + 28 : slotRowYs[1] + Math.max(0, (slotRowHeights[1] - exilusHeight) / 2);
    const specialRowHeight = Math.max(stanceHeight, exilusHeight);
    const topSectionBottom = Math.max(
        modGridBottom,
        arcaneY + arcaneHeight,
        exilusY + exilusHeight,
        isMelee ? exilusY + specialRowHeight : 0,
    );
    const bottomSectionY = topSectionBottom + 54;
    const performanceTitleY = bottomSectionY + 4;
    const statGridY = bottomSectionY + (scoreUnavailable ? 52 : 28);
    const damageMixTopY = statGridY + 350;

    const defs = `
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#08101f" />
          <stop offset="55%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1a1230" />
        </linearGradient>
        <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#111c33" stop-opacity="0.94" />
          <stop offset="100%" stop-color="#091120" stop-opacity="0.98" />
        </linearGradient>
        <linearGradient id="hero" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#fb923c" stop-opacity="0.22" />
          <stop offset="45%" stop-color="#60a5fa" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.18" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#020617" flood-opacity="0.45" />
        </filter>
        <style>
          .eyebrow { fill: #fdba74; font: 700 18px Inter, system-ui, sans-serif; letter-spacing: 0.32em; text-transform: uppercase; }
          .title { fill: #f8fafc; font: 800 48px Inter, system-ui, sans-serif; }
          .subtitle { fill: #cbd5e1; font: 500 21px Inter, system-ui, sans-serif; }
          .chip { fill: #e2e8f0; font: 700 18px Inter, system-ui, sans-serif; }
          .chipMuted { fill: #94a3b8; font: 600 15px Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
          .section { fill: #94a3b8; font: 700 15px Inter, system-ui, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; }
          .slotTitle { fill: #f8fafc; font: 700 16px Inter, system-ui, sans-serif; }
          .slotMeta { fill: #94a3b8; font: 600 12px Inter, system-ui, sans-serif; }
          .slotBody { fill: #cbd5e1; font: 500 11px Inter, system-ui, sans-serif; }
          .slotEyebrow { fill: #64748b; font: 700 10px Inter, system-ui, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; }
          .statLabel { fill: #94a3b8; font: 600 13px Inter, system-ui, sans-serif; letter-spacing: 0.05em; text-transform: uppercase; }
          .statValue { fill: #f8fafc; font: 800 24px Inter, system-ui, sans-serif; }
          .damageLabel { fill: #cbd5e1; font: 600 16px Inter, system-ui, sans-serif; }
          .damageValue { fill: #f8fafc; font: 700 18px Inter, system-ui, sans-serif; }
          .footer { fill: #64748b; font: 500 13px Inter, system-ui, sans-serif; }
        </style>
      </defs>
    `;

    const statBlocks = summaryStats
        .map(([label, value], index) => {
            const col = index % 4;
            const x = 72 + col * 322;
            const y = statGridY + Math.floor(index / 4) * 108;
            return `
              <g transform="translate(${x}, ${y})">
                <rect width="290" height="86" rx="18" fill="#08101f" fill-opacity="0.82" stroke="#334155" stroke-opacity="0.7" />
                <text x="18" y="30" class="statLabel">${escapeSvgText(label)}</text>
                <text x="18" y="62" class="statValue">${escapeSvgText(value)}</text>
              </g>
            `;
        })
        .join("");

    const damageBlocks = damageRows
        .map(([key, value], index) => {
            const y = damageMixTopY + 24 + index * 46;
            const pct = stats && stats.totalDamage > 0 ? `${fmt((value / stats.totalDamage) * 100, 1)}%` : "0%";
            return `
              <g transform="translate(72, ${y})">
                <rect width="576" height="34" rx="17" fill="#08101f" fill-opacity="0.75" />
                <text x="18" y="23" class="damageLabel">${escapeSvgText(key.charAt(0).toUpperCase() + key.slice(1))}</text>
                <text x="432" y="23" text-anchor="end" class="damageLabel">${escapeSvgText(pct)}</text>
                <text x="558" y="23" text-anchor="end" class="damageValue">${escapeSvgText(fmt(value, 1))}</text>
              </g>
            `;
        })
        .join("");
    const specialCardWidth = 428;
    const exilusBlock = `
      <g transform="translate(${isMelee ? leftPanelX + specialCardWidth + slotGap : rightRailX}, ${exilusY})">
        <rect width="${isMelee ? specialCardWidth : rightRailWidth}" height="${exilusHeight}" rx="22" fill="#091120" fill-opacity="0.76" stroke="${payload.build.exilus.mod ? "#f59e0b" : "#475569"}" stroke-opacity="0.35" />
        <text x="26" y="26" class="slotEyebrow">Exilus</text>
        ${svgPolarityIconMarkup(payload.build.exilus.slotPolarity, (isMelee ? specialCardWidth : rightRailWidth) - 34, 18, 18)}
        ${renderSvgParagraph(exilusTitleLines, 26, 54, 18, "slotTitle")}
        <text x="26" y="${78 + Math.max(0, exilusTitleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(
            payload.build.exilus.mod ? `Exilus • Rank ${payload.build.exilus.rank}` : "Exilus slot",
        )}</text>
        ${renderSvgParagraph(exilusBodyLines, 26, 102 + Math.max(0, exilusTitleLines.length - 1) * 18, 17, "slotBody")}
      </g>
    `;
    const stanceBlock = isMelee ? `
      <g transform="translate(72, ${exilusY})">
        <rect width="${specialCardWidth}" height="${stanceHeight}" rx="22" fill="#091120" fill-opacity="0.76" stroke="${payload.build.stance.mod ? "#f472b6" : "#475569"}" stroke-opacity="0.35" />
        <text x="26" y="26" class="slotEyebrow">Stance</text>
        ${svgPolarityIconMarkup(payload.build.stance.slotPolarity, specialCardWidth - 34, 18, 18)}
        ${renderSvgParagraph(stanceTitleLines, 26, 54, 18, "slotTitle")}
        <text x="26" y="${78 + Math.max(0, stanceTitleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(
            payload.build.stance.mod ? `Stance • Rank ${payload.build.stance.rank}` : "Stance slot",
        )}</text>
        ${renderSvgParagraph(stanceBodyLines, 26, 102 + Math.max(0, stanceTitleLines.length - 1) * 18, 17, "slotBody")}
      </g>
    ` : "";
    const arcaneBlock = `
      <g transform="translate(${rightRailX}, ${arcaneY})">
        <rect width="${rightRailWidth}" height="${arcaneHeight}" rx="22" fill="#091120" fill-opacity="0.76" stroke="${payload.build.arcane.mod ? "#c084fc" : "#475569"}" stroke-opacity="0.35" />
        <text x="26" y="26" class="slotEyebrow">Arcane</text>
        ${renderSvgParagraph(arcaneTitleLines, 26, 54, 18, "slotTitle")}
        <text x="26" y="${78 + Math.max(0, arcaneTitleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(
            payload.build.arcane.mod ? `Arcane • Rank ${payload.build.arcane.rank}` : "Arcane slot",
        )}</text>
        ${renderSvgParagraph(arcaneBodyLines, 26, 102 + Math.max(0, arcaneTitleLines.length - 1) * 18, 17, "slotBody")}
      </g>
    `;
    const bottomPanelHeight = 540;
    const footerY = Math.max(bottomSectionY + bottomPanelHeight + 26, damageMixTopY + 24 + damageRows.length * 46 + 54, 1088);
    const height = footerY + 40;
    const titleChipStartX = Math.min(760, 92 + payload.weapon.name.length * 26);
    const titleChipY = 110;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${defs}
        <rect width="${width}" height="${height}" fill="url(#bg)" />
        <circle cx="1200" cy="120" r="240" fill="#0ea5e9" fill-opacity="0.08" />
        <circle cx="180" cy="980" r="220" fill="#f97316" fill-opacity="0.10" />
        <rect x="38" y="38" width="${width - 76}" height="${height - 76}" rx="34" fill="url(#panel)" stroke="#334155" stroke-opacity="0.85" filter="url(#shadow)" />
        <rect x="56" y="56" width="${width - 112}" height="156" rx="28" fill="url(#hero)" />
        <rect x="56" y="${bottomSectionY - 20}" width="${width - 112}" height="${footerY - (bottomSectionY - 20) - 26}" rx="28" fill="#0a1324" fill-opacity="0.72" stroke="#1e293b" stroke-opacity="0.55" />

        <text x="84" y="100" class="eyebrow">Arsenal Modding</text>
        <text x="84" y="150" class="title">${escapeSvgText(payload.weapon.name)}</text>
        <text x="84" y="184" class="subtitle">${escapeSvgText(weaponSubtitle)}</text>
        <g transform="translate(${titleChipStartX}, ${titleChipY})">
          <rect width="126" height="34" rx="17" fill="#0f172a" fill-opacity="0.78" stroke="#475569" stroke-opacity="0.65" />
          <text x="63" y="22" text-anchor="middle" class="chip">${escapeSvgText(`${payload.assumptions.formaCount} Forma`)}</text>
        </g>
        ${
            payload.assumptions.hasCatalyst
                ? `<g transform="translate(${titleChipStartX + 138}, ${titleChipY})">
          <rect width="128" height="34" rx="17" fill="#451a03" fill-opacity="0.35" stroke="#f59e0b" stroke-opacity="0.6" />
          <text x="64" y="22" text-anchor="middle" class="chip">Catalyst</text>
        </g>`
                : ""
        }

        <g transform="translate(920, 94)">
          <rect width="170" height="40" rx="20" fill="#0f172a" fill-opacity="0.78" stroke="#fb923c" stroke-opacity="0.45" />
          <text x="85" y="26" text-anchor="middle" class="chip">${escapeSvgText(goalLabel)}</text>
        </g>
        <g transform="translate(1106, 94)">
          <rect width="214" height="40" rx="20" fill="#0f172a" fill-opacity="0.78" stroke="#60a5fa" stroke-opacity="0.45" />
          <text x="107" y="18" text-anchor="middle" class="chipMuted">Target</text>
          <text x="107" y="32" text-anchor="middle" class="chip">${escapeSvgText(factionLabel)}</text>
        </g>

        <text x="72" y="234" class="section">Mods</text>
        ${slotBlocks}
        ${stanceBlock}
        ${exilusBlock}
        ${arcaneBlock}

        <text x="72" y="${performanceTitleY}" class="section">${scoreUnavailable ? "Reference Stats — Scoring Unavailable" : "Performance"}</text>
        ${scoreUnavailable ? `<text x="72" y="${performanceTitleY + 22}" class="slotMeta">Per-attack values below are references only. Target damage, DPS, and TTK are unavailable for this attack model.</text>` : ""}
        ${statBlocks}

        <text x="72" y="${damageMixTopY}" class="section">${scoreUnavailable ? "Reference Damage Mix" : "Damage Mix"}</text>
        ${damageBlocks || `<text x="72" y="${damageMixTopY + 44}" class="slotBody">No damage data available for this build snapshot.</text>`}

        <text x="72" y="${footerY}" class="footer">Generated by Tenno Hub • ${escapeSvgText(new Date(payload.exportedAt).toLocaleString("en-US"))}${burstOnlyAssumptions ? ` • ${escapeSvgText(burstOnlyAssumptions)}` : ""}</text>
      </svg>
    `.trim();
}

async function generateBuildShareImage(payload: BuildExportPayload) {
    const svg = renderBuildShareSvg(payload);
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Unable to render build share image."));
            img.src = svgUrl;
        });
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Unable to create image canvas.");
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("Unable to export build image.");
        return blob;
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

function applyValenceToDamage(
    damage: WeaponEntry["damage"],
    bonusPct: number,
    element: ValenceElement,
) {
    if (bonusPct <= 0 || damage.total <= 0) return damage;
    const bonus = damage.total * bonusPct;
    return {
        ...damage,
        [element]: damage[element] + bonus,
        total: damage.total + bonus,
    };
}

function applyValenceToWeapon(
    weapon: WeaponEntry,
    bonusPct: number,
    element: ValenceElement,
): WeaponEntry {
    if (!weapon.isProgenitorWeapon || bonusPct <= 0) return weapon;
    return {
        ...weapon,
        valenceBonusPct: bonusPct,
        damage: applyValenceToDamage(weapon.damage, bonusPct, element),
        attacks: weapon.attacks.map((attack) => {
            const damage = applyValenceToDamage(attack.damage, bonusPct, element);
            return { ...attack, damage, damageTotal: damage.total };
        }),
    };
}

function makeSelectedAttackWeapon(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
): WeaponEntry {
    return withSelectedAttack(weapon, selectedAttackIdx);
}

function applyWeaponConfig(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
    buildCfg: BuildCfg,
) {
    const withValence = applyValenceToWeapon(weapon, buildCfg.valenceBonusPct, buildCfg.valenceElement);
    const incarnon = resolveIncarnonState(withValence, selectedAttackIdx, {
        unlockedTier: buildCfg.incarnonUnlockedTier,
        selectedOptionsByTier: buildCfg.incarnonSelectedOptionsByTier,
    });
    return {
        weaponWithIntrinsicOptions: incarnon.weapon,
        selectedWeapon: makeSelectedAttackWeapon(incarnon.weapon, selectedAttackIdx),
        activeIncarnonEffects: incarnon.activeEffects,
        incarnonRecord: incarnon.record,
        appliedIncarnonOptions: incarnon.appliedOptions,
    };
}

function getSelectedIncarnonTierCount(selectedOptionsByTier: Partial<Record<IncarnonTier, string>>) {
    return INCARNON_TIER_ORDER.filter((tier) => Boolean(selectedOptionsByTier[tier])).length;
}

function getHighestSelectedIncarnonTier(selectedOptionsByTier: Partial<Record<IncarnonTier, string>>) {
    return INCARNON_TIER_ORDER.reduce((highest, tier) => (
        selectedOptionsByTier[tier] ? tier : highest
    ), 0);
}

function sumEffects(effects: (ModEffect | null)[]) {
    return effects.reduce((acc, effect) => {
        if (!effect) return acc;
        acc.damageBonus += effect.damageBonus ?? 0;
        acc.sentientIncisionDamageBonus += effect.sentientIncisionDamageBonus ?? 0;
        acc.sentientSurgeMagazineRefillPerKill += effect.sentientSurgeMagazineRefillPerKill ?? 0;
        acc.conditionOverloadDamagePerStatusBonus += effect.conditionOverloadDamagePerStatusBonus ?? 0;
        acc.impactBonus += effect.impactBonus ?? 0;
        acc.punctureBonus += effect.punctureBonus ?? 0;
        acc.slashBonus += effect.slashBonus ?? 0;
        acc.heatBonus += effect.heatBonus ?? 0;
        acc.coldBonus += effect.coldBonus ?? 0;
        acc.electricityBonus += effect.electricityBonus ?? 0;
        acc.toxinBonus += effect.toxinBonus ?? 0;
        acc.blastBonus += effect.blastBonus ?? 0;
        acc.gasBonus += effect.gasBonus ?? 0;
        acc.magneticBonus += effect.magneticBonus ?? 0;
        acc.radiationBonus += effect.radiationBonus ?? 0;
        acc.viralBonus += effect.viralBonus ?? 0;
        acc.corrosiveBonus += effect.corrosiveBonus ?? 0;
        acc.voidBonus += effect.voidBonus ?? 0;
        acc.tauBonus += effect.tauBonus ?? 0;
        acc.trueBonus += effect.trueBonus ?? 0;
        acc.critChanceBonus += effect.critChanceBonus ?? 0;
        acc.comboCritChanceBonus += effect.comboCritChanceBonus ?? 0;
        acc.finalCritChanceBonus += effect.finalCritChanceBonus ?? 0;
        acc.critMultBonus += effect.critMultBonus ?? 0;
        acc.strainInfectionCritDamagePerCyst += effect.strainInfectionCritDamagePerCyst ?? 0;
        acc.dreadfulKillshotDamageAndStatusPer75Health += effect.dreadfulKillshotDamageAndStatusPer75Health ?? 0;
        acc.deadlyManeuversHeadshotCritChanceBonus += effect.deadlyManeuversHeadshotCritChanceBonus ?? 0;
        acc.criticalPrecisionCritChancePerHeadshot += effect.criticalPrecisionCritChancePerHeadshot ?? 0;
        acc.unseenDreadCritDamageBonus += effect.unseenDreadCritDamageBonus ?? 0;
        acc.finalCritMultiplierBonus += effect.finalCritMultiplierBonus ?? 0;
        acc.statusChanceBonus += effect.statusChanceBonus ?? 0;
        acc.areaDamageStatusChanceBonus += effect.areaDamageStatusChanceBonus ?? 0;
        acc.comboStatusChanceBonus += effect.comboStatusChanceBonus ?? 0;
        acc.finalStatusChanceBonus += effect.finalStatusChanceBonus ?? 0;
        acc.multishotBonus += effect.multishotBonus ?? 0;
        acc.multishotDamageBonus += effect.multishotDamageBonus ?? 0;
        acc.fireRateBonus += effect.fireRateBonus ?? 0;
        acc.chargeRateBonus += effect.chargeRateBonus ?? 0;
        acc.attackSpeedBonus += effect.attackSpeedBonus ?? 0;
        acc.magazineCapacityFlatBonus += effect.magazineCapacityFlatBonus ?? 0;
        acc.magazineBonus += effect.magazineBonus ?? 0;
        acc.reloadSpeedBonus += effect.reloadSpeedBonus ?? 0;
        acc.statusDamageBonus += effect.statusDamageBonus ?? 0;
        acc.statusDurationBonus += effect.statusDurationBonus ?? 0;
        if (effect.targetFaction) acc.factionDamageBonus += effect.factionDamageBonus ?? 0;
        return acc;
    }, {
        damageBonus: 0,
        sentientIncisionDamageBonus: 0,
        sentientSurgeMagazineRefillPerKill: 0,
        conditionOverloadDamagePerStatusBonus: 0,
        impactBonus: 0,
        punctureBonus: 0,
        slashBonus: 0,
        heatBonus: 0,
        coldBonus: 0,
        electricityBonus: 0,
        toxinBonus: 0,
        blastBonus: 0,
        gasBonus: 0,
        magneticBonus: 0,
        radiationBonus: 0,
        viralBonus: 0,
        corrosiveBonus: 0,
        voidBonus: 0,
        tauBonus: 0,
        trueBonus: 0,
        critChanceBonus: 0,
        comboCritChanceBonus: 0,
        finalCritChanceBonus: 0,
        critMultBonus: 0,
        strainInfectionCritDamagePerCyst: 0,
        dreadfulKillshotDamageAndStatusPer75Health: 0,
        deadlyManeuversHeadshotCritChanceBonus: 0,
        criticalPrecisionCritChancePerHeadshot: 0,
        unseenDreadCritDamageBonus: 0,
        finalCritMultiplierBonus: 0,
        statusChanceBonus: 0,
        areaDamageStatusChanceBonus: 0,
        comboStatusChanceBonus: 0,
        finalStatusChanceBonus: 0,
        multishotBonus: 0,
        multishotDamageBonus: 0,
        fireRateBonus: 0,
        chargeRateBonus: 0,
        attackSpeedBonus: 0,
        magazineCapacityFlatBonus: 0,
        magazineBonus: 0,
        reloadSpeedBonus: 0,
        statusDamageBonus: 0,
        statusDurationBonus: 0,
        factionDamageBonus: 0,
    });
}

function getOwnedModRank(
    path: string,
    maxRank: number,
    counts: Record<string, number>,
    modRanks: Record<string, number>,
) {
    const owned = Number(counts[`mods:${path}`] ?? counts[path] ?? 0);
    if (owned <= 0) return 0;
    return Math.max(0, Math.min(maxRank, Number(modRanks[path] ?? maxRank)));
}

const BUILD_MATH_PRIMARY_ELEMENTS = ["heat", "cold", "electricity", "toxin"] as const;
const BUILD_MATH_COMBINED_ELEMENTS: Record<string, string> = {
    "cold+electricity": "magnetic",
    "electricity+cold": "magnetic",
    "heat+cold": "blast",
    "cold+heat": "blast",
    "heat+electricity": "radiation",
    "electricity+heat": "radiation",
    "heat+toxin": "gas",
    "toxin+heat": "gas",
    "cold+toxin": "viral",
    "toxin+cold": "viral",
    "electricity+toxin": "corrosive",
    "toxin+electricity": "corrosive",
};

function roundQuantizedValue(value: number, quantum: number) {
    if (quantum <= 0) return value;
    return Math.round(value / quantum) * quantum;
}

function buildCombinedRawBreakdown(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
) {
    const totals = sumEffects(effects);
    const baseDamage = weapon.damage.total;
    const moddedBaseDamage = baseDamage * (1 + totals.damageBonus);
    const physicalDamageConversion = effects.find((effect) => effect?.physicalDamageConversion)?.physicalDamageConversion;
    const elementalDamageConversion = effects.find((effect) => effect?.elementalDamageConversion)?.elementalDamageConversion;
    const basePhysicalDamage = weapon.damage.impact + weapon.damage.puncture + weapon.damage.slash;
    const physicalBaseByType = physicalDamageConversion
        ? {
            impact: physicalDamageConversion === "impact" ? basePhysicalDamage : 0,
            puncture: physicalDamageConversion === "puncture" ? basePhysicalDamage : 0,
            slash: physicalDamageConversion === "slash" ? basePhysicalDamage : 0,
        }
        : {
            impact: weapon.damage.impact,
            puncture: weapon.damage.puncture,
            slash: weapon.damage.slash,
        };
    const physicalRaw = {
        impact: physicalBaseByType.impact * (1 + totals.impactBonus) * (1 + totals.damageBonus),
        puncture: physicalBaseByType.puncture * (1 + totals.punctureBonus) * (1 + totals.damageBonus),
        slash: physicalBaseByType.slash * (1 + totals.slashBonus) * (1 + totals.damageBonus),
    };
    const queue: Array<{ type: string; value: number; order: number }> = [];
    effects.forEach((effect, index) => {
        if (!effect) return;
        for (const [entryIndex, key] of BUILD_MATH_PRIMARY_ELEMENTS.entries()) {
            const bonus = effect[`${key}Bonus` as const];
            if (bonus) queue.push({ type: elementalDamageConversion ?? key, value: baseDamage * bonus * (1 + totals.damageBonus), order: (index * 10) + entryIndex });
        }
    });
    let order = effects.length * 10;
    for (const key of ["magnetic", "radiation", "viral", "corrosive", "gas", "blast", "void", "tau", "true"] as const) {
        const bonus = totals[`${key}Bonus` as const];
        if (bonus) queue.push({ type: key, value: baseDamage * bonus * (1 + totals.damageBonus), order: order++ });
    }

    const merged = new Map<string, { value: number; order: number }>();
    for (const entry of queue) {
        const existing = merged.get(entry.type);
        if (existing) {
            existing.value += entry.value;
            existing.order = Math.min(existing.order, entry.order);
        } else {
            merged.set(entry.type, { value: entry.value, order: entry.order });
        }
    }

    const ordered = [...merged.entries()]
        .map(([type, meta]) => ({ type, value: meta.value, order: meta.order }))
        .sort((a, b) => a.order - b.order);

    const combined: Record<string, number> = {
        impact: physicalRaw.impact,
        puncture: physicalRaw.puncture,
        slash: physicalRaw.slash,
        heat: 0,
        cold: 0,
        electricity: 0,
        toxin: 0,
        blast: 0,
        radiation: 0,
        gas: 0,
        magnetic: 0,
        viral: 0,
        corrosive: 0,
        void: 0,
        tau: 0,
        true: 0,
    };

    let index = 0;
    while (index < ordered.length) {
        const current = ordered[index];
        const next = ordered[index + 1];
        if (next) {
            const combo = BUILD_MATH_COMBINED_ELEMENTS[`${current.type}+${next.type}`];
            if (combo) {
                combined[combo] += current.value + next.value;
                index += 2;
                continue;
            }
        }
        combined[current.type] += current.value;
        index += 1;
    }

    return { moddedBaseDamage, physicalRaw, orderedElementQueue: ordered, combined };
}

function capitalizeDamageType(value: string) {
    return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatSourceList(values: string[]) {
    const unique = [...new Set(values.filter(Boolean))];
    if (unique.length === 0) return "this build";
    if (unique.length === 1) return unique[0];
    if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
    return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function sanitizeDamageSourceLabel(value: string) {
    return value
        .replace(/\s*\(slot \d+\)$/i, "")
        .replace(/\s*\(exilus\)$/i, "")
        .replace(/\s*\(arcane\)$/i, "")
        .replace(/\s*\(stance\)$/i, "")
        .replace(/\s*\(built-in\)$/i, "");
}

function buildDamageTypeSourceDescriptions(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    sourceLabels: string[],
) {
    const totals = sumEffects(effects);
    const baseDamage = weapon.damage.total;
    const descriptions: Record<string, string> = {};
    const primaryEntries: Array<{ type: string; value: number; order: number; sources: string[] }> = [];

    effects.forEach((effect, index) => {
        if (!effect) return;
        const sourceLabel = sanitizeDamageSourceLabel(sourceLabels[index] ?? "this build");
        const elementalDamageConversion = effects.find((entry) => entry?.elementalDamageConversion)?.elementalDamageConversion;
        for (const [entryIndex, key] of BUILD_MATH_PRIMARY_ELEMENTS.entries()) {
            const bonus = effect[`${key}Bonus` as const];
            if (bonus) {
                primaryEntries.push({
                    type: elementalDamageConversion ?? key,
                    value: baseDamage * bonus * (1 + totals.damageBonus),
                    order: (index * 10) + entryIndex,
                    sources: [sourceLabel],
                });
            }
        }
        for (const key of ["magnetic", "radiation", "viral", "corrosive", "gas", "blast", "void", "tau", "true"] as const) {
            const bonus = effect[`${key}Bonus` as const];
            if (!bonus) continue;
            descriptions[key] = `${capitalizeDamageType(key)} is added directly by ${sourceLabel}.`;
        }
    });

    const collapsed = [...primaryEntries.reduce((map, entry) => {
        const existing = map.get(entry.type);
        if (existing) {
            existing.value += entry.value;
            existing.order = Math.min(existing.order, entry.order);
            existing.sources.push(...entry.sources);
        } else {
            map.set(entry.type, { ...entry, sources: [...entry.sources] });
        }
        return map;
    }, new Map<string, { type: string; value: number; order: number; sources: string[] }>()).values()].sort((a, b) => a.order - b.order);

    let index = 0;
    while (index < collapsed.length) {
        const current = collapsed[index];
        const next = collapsed[index + 1];
        if (next) {
            const combo = BUILD_MATH_COMBINED_ELEMENTS[`${current.type}+${next.type}`];
            if (combo) {
                descriptions[combo] = `${capitalizeDamageType(combo)} comes from ${capitalizeDamageType(current.type)} provided by ${formatSourceList(current.sources)} combining with ${capitalizeDamageType(next.type)} provided by ${formatSourceList(next.sources)}.`;
                index += 2;
                continue;
            }
        }
        descriptions[current.type] = `${capitalizeDamageType(current.type)} is provided by ${formatSourceList(current.sources)}.`;
        index += 1;
    }

    const physicalDamageConversion = effects.find((effect) => effect?.physicalDamageConversion)?.physicalDamageConversion;
    if (physicalDamageConversion) {
        const conversionSourceIndex = effects.findIndex((effect) => Boolean(effect?.physicalDamageConversion));
        const conversionSource = sanitizeDamageSourceLabel(sourceLabels[conversionSourceIndex] ?? "the Conditioning mod");
        descriptions[physicalDamageConversion] = `Base Impact, Puncture, and Slash damage is converted to ${capitalizeDamageType(physicalDamageConversion)} by ${conversionSource}; elemental damage is unchanged.`;
    } else {
        for (const key of ["impact", "puncture", "slash"] as const) {
            if (weapon.damage[key] > 0) descriptions[key] = `${capitalizeDamageType(key)} comes from the weapon's base physical damage.`;
        }
    }

    const elementalDamageConversion = effects.find((effect) => effect?.elementalDamageConversion)?.elementalDamageConversion;
    if (elementalDamageConversion) {
        const conversionSourceIndex = effects.findIndex((effect) => Boolean(effect?.elementalDamageConversion));
        const conversionSource = sanitizeDamageSourceLabel(sourceLabels[conversionSourceIndex] ?? "the Claws conversion mod");
        descriptions[elementalDamageConversion] = `Primary elemental damage is converted to ${capitalizeDamageType(elementalDamageConversion)} by ${conversionSource}; secondary elemental damage remains separate.`;
    }

    return descriptions;
}

function buildMathBreakdown(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    targetFaction = "",
    conditionalState: ConditionalState = DEFAULT_CONDITIONAL_STATE,
    targetProfileOverride?: TargetProfileOverride,
    meleeDpsInputs?: MeleeDpsInputState | null,
    expectedKillRatePerSecond?: number,
    statusImmuneTypes?: Iterable<StatusDamageType>,
): BuildMathBreakdown {
    const totals = sumEffects(effects);
    const hasSuppressedPerStatusDirectHitBonus = weapon.selectedAttackIsAreaDamage === true && (
        effects.some((effect) => effect != null && (
            (effect.directDamagePerStatusBonus ?? 0) > 0 ||
            effect.conditionalEffects?.some((conditional) =>
                (conditional.stats.directDamagePerStatusBonus ?? 0) > 0,
            ) === true
        )) || (weapon.intrinsicDamagePerStatusBonus ?? 0) > 0
    );
    const result = calculateBuild(weapon, effects, targetFaction, {
        conditionalState,
        isEximusTarget: targetProfileOverride?.isEximusTarget,
        targetHasOverguard: getTargetProfileAssumptions(targetFaction, targetProfileOverride).overguard > 0,
        statusImmuneTypes: statusImmuneTypes ?? targetProfileOverride?.statusImmuneTypes,
        statusStackCaps: targetProfileOverride?.statusStackCaps,
        hitLocation: getTargetHitLocationProfile(targetFaction, targetProfileOverride),
        includeTimedConditionalHitStackDetails: true,
        ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
    });
    const stats = result.modded;
    const finiteConditionalState = withoutBurstOnlyConditionalAssumptions(conditionalState) ?? conditionalState;
    const finiteResult = hasBurstOnlyConditionalAssumption(conditionalState)
        ? calculateBuild(weapon, effects, targetFaction, {
            conditionalState: finiteConditionalState,
            isEximusTarget: targetProfileOverride?.isEximusTarget,
            targetHasOverguard: getTargetProfileAssumptions(targetFaction, targetProfileOverride).overguard > 0,
            statusImmuneTypes: statusImmuneTypes ?? targetProfileOverride?.statusImmuneTypes,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(targetFaction, targetProfileOverride),
            includeTimedConditionalHitStackDetails: true,
            ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
        })
        : result;
    const finiteStats = finiteResult.modded;
    const meleeDpsBaseline = usesMeleeDamageModel(weapon.category) &&
        meleeDpsInputs != null
        ? calculateBuild(weapon, effects, targetFaction, {
            conditionalState: { mode: "initial" },
            isEximusTarget: targetProfileOverride?.isEximusTarget,
            targetHasOverguard: getTargetProfileAssumptions(targetFaction, targetProfileOverride).overguard > 0,
            statusImmuneTypes: statusImmuneTypes ?? targetProfileOverride?.statusImmuneTypes,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(targetFaction, targetProfileOverride),
            targetStatusState: "initial",
        }).modded
        : null;
    const meleeAverageDps = meleeDpsBaseline && meleeDpsInputs
        ? calculateMeleeAverageDps(meleeDpsBaseline, {
            totalDamageMultiplier: meleeDpsInputs.totalDamageMultiplier,
            totalSlashProcMultiplier: meleeDpsInputs.totalSlashProcMultiplier,
            baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
        })
        : null;
    const ignoresReloadAndMagazine = !!weapon.isExalted || !!weapon.selectedAttackIsIncarnon;
    const baseDamage = weapon.damage.total;
    const baseDamageMultiplier = 1 + stats.totalDamageBonus;
    const conditionOverloadDamageBracket = 1 + stats.totalDamageBonus +
        (stats.conditionOverloadApplies
            ? stats.conditionOverloadDamagePerStatusBonus * stats.conditionOverloadStatusTypes
            : 0);
    const moddedBaseDamageBeforeConditionOverload = baseDamage * baseDamageMultiplier;
    const moddedBaseDamage = moddedBaseDamageBeforeConditionOverload * stats.conditionOverloadDamageMultiplier;
    const selectedAttackDamageMultiplier = stats.slamAttackDamageMultiplier * stats.meleeAttackComboDamageMultiplier;
    const moddedBaseDamageForQuantization = moddedBaseDamage * selectedAttackDamageMultiplier;
    const quantScale = (moddedBaseDamageForQuantization / 32) * (stats.directDamagePerStatusMultiplier || 1);
    const fireRateBonus = usesMeleeDamageModel(weapon.category) ? totals.attackSpeedBonus : totals.fireRateBonus;
    const chargeRateBonus = usesMeleeDamageModel(weapon.category) ? 0 : totals.chargeRateBonus;
    const attackDamageEquivalent = stats.damageWeightedMultishot + stats.singleProjectileDamageBonus;
    const quantizedShotDamage = stats.totalDamage * attackDamageEquivalent;
    const avgHitMultiplier = quantizedShotDamage > 0 ? stats.averageShotDamage / quantizedShotDamage : 1;
    const hasConditionalBonuses = effects.some(effect => (effect?.conditionalEffects?.length ?? 0) > 0);
    const damageUnit = actionUnitLabel(weapon.category);
    const avgDamageLabel = averageDamageLabel(weapon.category);
    const rateLabel = actionRateLabel(weapon.category);
    const conditionalEntries = effects.flatMap((effect) => effect?.conditionalEffects ?? []);
    let timedStackTraceIndex = 0;
    const unconditionalEffects = effects.map((effect) => effect ? { ...effect, conditionalEffects: [] } : effect);
    const baselineConditionalStats = calculateBuild(weapon, unconditionalEffects, targetFaction, {
        conditionalState,
        targetHasOverguard: getTargetProfileAssumptions(targetFaction, targetProfileOverride).overguard > 0,
    }).modded;
    const baselineRateForConditionals = baselineConditionalStats.fireRate;
    const baseMagazineForConditionals = baselineConditionalStats.magazineSize;
    const qualifyingHitGroupProbability = estimateNonCriticalNoStatusHitGroupProbability(
        stats.critChance,
        stats.statusChance,
        stats.multishot,
    );
    const rawBreakdown = buildCombinedRawBreakdown(weapon, effects);
    const nonZeroRawEntries = Object.entries(stats.rawDamageBreakdown).filter(([, value]) => value > 0);
    const quantizedLines = nonZeroRawEntries.map(([type, rawValue]) => {
        const ratio = quantScale > 0 ? rawValue / quantScale : 0;
        const roundedUnits = Math.round(ratio);
        const quantized = roundQuantizedValue(rawValue, quantScale);
        return `${type}: raw ${fmt(rawValue, 5)} ÷ scale ${fmt(quantScale, 5)} = ${fmt(ratio, 5)} → round ${roundedUnits} → ${fmt(quantized, 5)}`;
    });
    const procLines = Object.entries(stats.procChanceByType)
        .filter(([, value]) => (value ?? 0) > 0)
        .map(([type, value]) => {
            const damageValue = stats.damageBreakdown[type as keyof typeof stats.damageBreakdown] ?? 0;
            const share = stats.totalDamage > 0 ? damageValue / stats.totalDamage : 0;
            return `${type}: quantized damage ${fmt(damageValue, 5)} ÷ total ${fmt(stats.totalDamage, 5)} = ${fmt(share, 5)} → proc weight ${fmt((value ?? 0) * 100, 3)}%`;
        });
    const dotTypeLines = Object.entries(finiteStats.dotDamagePerShotByType)
        .filter(([, value]) => (value ?? 0) > 0)
        .map(([type, value]) => `${type}: DoT per ${damageUnit} ${fmt(value ?? 0, 5)} | DoT DPS ${fmt(finiteStats.dotDpsByType[type as keyof typeof finiteStats.dotDpsByType] ?? 0, 5)}`);
    const effectiveHeadshotRate = stats.hitLocation.canHeadshot === false
        ? 0
        : Math.max(0, Math.min(1, stats.hitLocation.headshotRate ?? 0));
    const hitLocationLines = [
        `Wiki hit-location profile = ${fmt(effectiveHeadshotRate * 100, 2)}% assumed headshots; body factor ${fmt(Math.max(0, 1 + (stats.hitLocation.bodyshotDamageBonus ?? 0)), 5)}, head location ${fmt(stats.hitLocation.headshotMultiplier ?? 1, 5)} × (1 + headshot bonus ${fmt(stats.headshotMultiplierBonus, 5)}) = ${fmt((stats.hitLocation.headshotMultiplier ?? 1) * Math.max(0, 1 + stats.headshotMultiplierBonus), 5)}, critical-headshot factor ${fmt(stats.hitLocation.criticalHeadshotMultiplier ?? 2, 5)}. Area/radial and non-firearm attacks use 0% headshots.`,
        ...(stats.deadlyManeuversHeadshotCritChanceBonus > 0
            ? [`Deadly Maneuvers Burst snapshot = ${stats.deadlyManeuversShotsRemaining} buffed shot(s) remain; rank bonus +${fmt(stats.deadlyManeuversHeadshotCritChanceBonus * 100, 0)}% applies multiplicatively after other bonuses (×${fmt(1 + stats.deadlyManeuversHeadshotCritChanceBonus, 0)}) to headshot Critical Chance. The next two shots are averaged at the configured ${fmt(effectiveHeadshotRate * 100, 2)}% headshot share. Dodge and shot history are not modeled. Wiki: https://wiki.warframe.com/w/Deadly_Maneuvers`]
            : []),
        ...(stats.criticalPrecisionCritChanceBonus > 0
            ? [`Critical Precision Burst snapshot = ${stats.criticalPrecisionHeadshotProjectiles} prior headshot projectiles × +${fmt(totals.criticalPrecisionCritChancePerHeadshot * 100, 1)}% base Critical Chance per projectile, capped at +500% = +${fmt(stats.criticalPrecisionCritChanceBonus * 100, 1)}% base Critical Chance. It adds to similar base Critical Chance mods. Missed-burst decay and shot history are not modeled. Wiki: https://wiki.warframe.com/w/Critical_Precision`]
            : []),
        ...(stats.unseenDreadCritDamageBonus > 0
            ? [`Unseen Dread Burst snapshot = Dread is invisible; +${fmt(totals.unseenDreadCritDamageBonus * 100, 0)}% Critical Damage. The three-enemy trigger and five-second duration/history are not modeled. Area coverage, finite TTK, and 5s DPS exclude this snapshot. Wiki: https://wiki.warframe.com/w/Unseen_Dread`]
            : []),
        `Status DoT seeds inherit the inducing hit's headshot multiplier; Meticulous Aim's bodyshot penalty is squared for Slash, Heat, Toxin, and Blast. Weak-point-only damage/critical bonuses remain unmodeled. Sources: https://wiki.warframe.com/w/Enemy_Body_Parts · https://wiki.warframe.com/w/Critical_Multiplier · https://wiki.warframe.com/w/Meticulous_Aim`,
    ];
    const nightwatchNapalmLines = stats.nightwatchNapalm ? [
        `Nightwatch Napalm: ${fmt(stats.nightwatchNapalm.directDamagePerProjectilePerTick, 5)} direct Heat damage per overlapping blaze tick × 6 ticks per ${damageUnit}; the first tick is immediate. Each tick rolls the Wiki's fixed ${(stats.nightwatchNapalm.heatProcChancePerTick * 100).toFixed(0)}% Heat proc chance independently of weapon Status Chance. Heat status lasts ${fmt(stats.nightwatchNapalm.heatStatusDurationSeconds, 3)}s after duration modifiers.`,
        `Napalm DPS = ${fmt(stats.nightwatchNapalm.directDamagePerSecond, 5)} direct tick damage/s + ${fmt(stats.nightwatchNapalm.heatStatusDamagePerSecond, 5)} steady-state Heat status damage/s. Assumes a stationary single target receives every blaze tick; spatial exposure, other on-tick effects (including Toxic Lash and Xata's Whisper), and crowd coverage are not modeled. Data: https://wiki.warframe.com/w/Nightwatch_Napalm`,
    ] : [];
    const attachedAttackDamageLines = stats.attachedAttackDamageSequence ? (() => {
        const { rule } = stats.attachedAttackDamageSequence;
        const eventTiming = rule.tickCount === 1
            ? `one linked component event at +${fmt(rule.firstTickDelaySeconds, 3)}s`
            : `${fmt(rule.tickCount, 0)} linked damage ticks at ${fmt(rule.tickIntervalSeconds, 3)}s intervals, first at +${fmt(rule.firstTickDelaySeconds, 3)}s`;
        const targetScope = rule.attachedToDirectTarget
            ? "The linked component also affects the directly struck target"
            : "The linked component does not affect the directly struck target";
        const stacking = rule.stacks ? "Linked events from separate attacks stack." : "Linked events from separate attacks do not stack.";
        return [
            `${rule.componentAttackName} is linked to each direct hit: ${eventTiming}. ${targetScope}. ${stacking}`,
            `Finite scoring follows this linked sequence on one target. It excludes area coverage on other targets, environmental impacts away from the struck target, movement, and multi-target overlap. Source: ${rule.sourceUrl}${rule.tickCount > 1 ? " · https://wiki.warframe.com/w/Damage_over_Time#Weapons" : ""}`,
        ];
    })() : [];
    const damageRampLines = weapon.selectedAttackDamageRamp ? [
        `Verified attack ramp: ${fmt(weapon.selectedAttackDamageRamp.minimumDamageMultiplier * 100, 1)}% → 100% over ${fmt(weapon.selectedAttackDamageRamp.rampToFullSeconds, 3)}s; decay begins after ${fmt(weapon.selectedAttackDamageRamp.idleBeforeDecaySeconds, 3)}s idle and reaches minimum over ${fmt(weapon.selectedAttackDamageRamp.decayToMinimumSeconds, 3)}s.`,
        `Fresh-magazine average ramp multiplier = ${fmt(stats.freshMagazineDamageMultiplier, 6)}; steady repeating-cycle multiplier = ${fmt(stats.sustainedDamageMultiplier, 6)}. Ramp scales direct damage. Per-attack DoT/Blast seed scaling is a model assumption because the Wiki does not specify seed inheritance separately; status chance and proc weights stay unchanged.`,
    ] : [];
    const conditionalLines = conditionalEntries.map((conditional, index) => {
        const timedStackModel = conditional.trigger === "onNonCriticalNoStatusHit"
            ? stats.timedConditionalDamageStacks[timedStackTraceIndex++]
            : undefined;
        const conditionalQualifyingGroupProbability = timedStackModel?.qualifyingHitGroupProbability ?? qualifyingHitGroupProbability;
        const killStackContext = conditional.trigger === "onKill" &&
            (conditional.stats.directDamagePerStatusBonus ?? 0) > 0 &&
            Number.isFinite(expectedKillRatePerSecond)
            ? { expectedKillRatePerSecond }
            : undefined;
        const triggerContext = {
            headshotHitRate: stats.hitLocation.canHeadshot === false ? 0 : stats.hitLocation.headshotRate ?? 0,
            isEximusTarget: targetProfileOverride?.isEximusTarget === true,
            ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
            ...(killStackContext ?? {}),
        };
        const uptime = estimateConditionalUptime(
            conditional,
            baselineRateForConditionals,
            baseMagazineForConditionals,
            conditionalState,
            triggerContext,
        );
        const stackFactor = estimateConditionalStackFactor(
            conditional,
            baselineRateForConditionals,
            baseMagazineForConditionals,
            conditionalState,
            {
                ...triggerContext,
                qualifyingHitGroupProbability: conditionalQualifyingGroupProbability,
                qualifyingHitRatePerSecond: stats.fireRate * conditionalQualifyingGroupProbability,
            },
        );
        const combinedFactor = uptime * stackFactor;
        const statsApplied = Object.entries(conditional.stats)
            .filter(([, value]) => typeof value === "number" && value !== 0)
            .map(([key, value]) => `${key} ${fmt((value as number) * 100, 2)}%`)
            .join(", ");
        const triggerLabel = conditional.trigger.replace(/([A-Z])/g, " $1").toLowerCase();
        const targetStatusModel = conditional.requiredTargetStatusType
            ? ` target status ${conditional.requiredTargetStatusType} is ${uptime > 0 ? "assumed active for this scenario" : "not active in this scenario"}; its duration and renewal are not simulated.`
            : "";
        const eximusTargetModel = conditional.requiresEximusTarget
            ? ` requires an Eximus target (currently ${triggerContext.isEximusTarget ? "selected" : "not selected"}); weak-point-only triggers are not included. Source: https://wiki.warframe.com/w/Eximus_Advantage.`
            : "";
        const triggerModel = conditional.trigger === "onNonCriticalNoStatusHit"
            ? ` qualifying group chance ${fmt(conditionalQualifyingGroupProbability * 100, 5)}% from ${fmt(stats.critChance * 100, 2)}% crit, ${fmt(stats.statusChance * 100, 2)}% status, and ${fmt(stats.multishot, 3)} multishot; the steady-state estimate uses Poisson arrivals at ${fmt(stats.fireRate * conditionalQualifyingGroupProbability, 5)}/s and one-stack decay per full duration without a trigger. The finite encounter starts at ${timedStackModel?.initialStacks ?? 0} stacks and advances one qualifying attack group at a time. The model treats crit/status rolls as independent per projectile and averages fractional multishot as one extra-projectile chance. Target status immunities and forced weapon procs are applied; DoT ticks and externally applied statuses are excluded.`
            : "";
        const killCadenceModel = killStackContext
            ? ` identical-target kill interval ${expectedKillRatePerSecond! > 0 ? fmt(1 / expectedKillRatePerSecond!, 3) + "s" : "no modeled kills"}; the Wiki timeout removes one stack and resets its timer. The estimate uses a deterministic repeating-target cycle; it does not simulate per-enemy carryover or unrelated kill sources.`
            : "";
        const headshotTriggerModel = (conditional.minimumHeadshotPellets ?? 1) > 1
            ? ` requires at least ${conditional.minimumHeadshotPellets} headshot pellets; the configured headshot share is per direct hit and does not estimate pellet overlap. Realistic leaves it inactive. Custom/Fully Stacked assumes the buff is active in this scenario; its ${fmt(conditional.durationSeconds, 2)}s expiry and refresh timing are not simulated.`
            : conditional.trigger === "onHeadshot" || conditional.trigger === "onHeadshotKill"
                ? ` Wiki headshot-trigger estimate uses the configured ${(triggerContext.headshotHitRate * 100).toFixed(1)}% share of direct hits; ${conditional.trigger === "onHeadshot" ? "hit refreshes use Poisson arrivals over the listed duration" : Number.isFinite(expectedKillRatePerSecond) ? `expected kills at ${fmt(expectedKillRatePerSecond ?? 0, 4)}/s` : "headshot-kill uptime uses the documented 35% baseline scaled by headshot share"}.`
                : "";
        return `Conditional ${index + 1}: trigger ${triggerLabel}, duration ${fmt(conditional.durationSeconds, 2)}s, max stacks ${conditional.maxStacks}, aiming ${conditional.requiresAiming ? "yes" : "no"}, uptime ${fmt(uptime, 4)}, stack factor ${fmt(stackFactor, 4)}, combined factor ${fmt(combinedFactor, 4)}, stats [${statsApplied || "none"}]${targetStatusModel}${eximusTargetModel}${triggerModel}${killCadenceModel}${headshotTriggerModel}`;
    });
    if (conditionalEntries.some((conditional) => conditional.trigger === "onOcucorTendrilKill")) {
        const ocucorTendrilCondition = conditionalEntries.find((conditional) => conditional.trigger === "onOcucorTendrilKill")!;
        const modeledTendrils = estimateConditionalUptime(
            ocucorTendrilCondition,
            baselineRateForConditionals,
            baseMagazineForConditionals,
            conditionalState,
        ) * estimateConditionalStackFactor(
            ocucorTendrilCondition,
            baselineRateForConditionals,
            baseMagazineForConditionals,
            conditionalState,
        );
        conditionalLines.push(
            "Sentient Surge stack assumption = " + fmt(modeledTendrils, 2) +
            " active tendrils; Realistic uses the disclosed 70%-of-four heuristic. Wiki tendrils reset on reload or an empty magazine, but kill cadence/reset timing are not simulated; the finite encounter holds the selected stack estimate constant.",
        );
    }
    const selectedSpringLoadedBroadheadBonus = effects.reduce(
        (sum, effect) => sum + (effect?.springLoadedBroadheadDamageBonus ?? 0),
        0,
    );
    if (selectedSpringLoadedBroadheadBonus > 0) {
        const threshold = stats.singleProjectileDamageMinDistanceMeters;
        const targetDistance = Number.isFinite(conditionalState.targetDistanceMeters)
            ? conditionalState.targetDistanceMeters ?? null
            : null;
        const rangeState = targetDistance !== null
            ? fmt(targetDistance, 2) + "m " +
                (targetDistance > threshold ? "exceeds" : "does not exceed") +
                " the " + fmt(threshold, 2) + "m rank threshold"
            : "target distance is unset";
        conditionalLines.push(
            "Spring-Loaded Broadhead = +" + fmt(selectedSpringLoadedBroadheadBonus * 100, 2) +
            "% on one hit when the target is over " + fmt(threshold, 2) +
            "m away; " + rangeState + ", so the bonus is " +
            (stats.singleProjectileDamageBonus > 0 ? "active" : "inactive") +
            ". Direct damage and proc seeds receive the one-projectile share; DoT ticks do not apply the bonus a second time.",
        );
    }
    const rangeAdvantageCondition = conditionalEntries.find((conditional) =>
        conditional.trigger === "whileNoEnemyWithinRange",
    );
    if (rangeAdvantageCondition) {
        const targetDistance = Number.isFinite(conditionalState.targetDistanceMeters)
            ? conditionalState.targetDistanceMeters ?? null
            : null;
        const minimumDistance = rangeAdvantageCondition.minimumTargetDistanceMeters ?? 0;
        const active = estimateConditionalUptime(
            rangeAdvantageCondition,
            baselineRateForConditionals,
            baseMagazineForConditionals,
            conditionalState,
        ) > 0;
        conditionalLines.push(
            `Range Advantage = +${fmt((rangeAdvantageCondition.stats.damageBonus ?? 0) * 100, 2)}% additive Damage when no modeled enemy is within ${fmt(minimumDistance, 2)}m; target distance ${targetDistance === null ? "is unset" : `${fmt(targetDistance, 2)}m ${targetDistance > minimumDistance ? "exceeds" : "does not exceed"} the threshold`}, so the bonus is ${active ? "active" : "inactive"}. This single-target scenario does not account for unmodeled nearby enemies. Wiki: https://wiki.warframe.com/w/Range_Advantage`,
        );
    }
    const protonSnapCondition = conditionalEntries.find((conditional) =>
        conditional.trigger === "whileWallLatched" && (conditional.stats.toxinBonus ?? 0) > 0,
    );
    if (conditionalEntries.some((conditional) => conditional.trigger === "whileWallLatched")) {
        conditionalLines.push(
            `Wall Latch state = ${conditionalState.mode === "fullyStacked" || (conditionalState.mode === "custom" && (conditionalState.externalStacks ?? 0) > 0) ? "assumed active" : "inactive"}; the planner does not infer movement uptime.`,
        );
    }
    if (protonSnapCondition) {
        conditionalLines.push(
            `Proton Snap activation = hold Wall Latch for ${fmt(protonSnapCondition.activationDelaySeconds ?? 2, 2)}s; rank duration ${fmt(protonSnapCondition.durationSeconds, 2)}s. The selected scenario's wall-latch state is held static; latch cadence and expiration are not simulated.`,
        );
    }
    const motusSetupCondition = conditionalEntries.find((conditional) => conditional.trigger === "afterJumpLanding");
    if (motusSetupCondition) {
        const active = estimateConditionalUptime(
            motusSetupCondition,
            baselineRateForConditionals,
            baseMagazineForConditionals,
            conditionalState,
        ) > 0;
        conditionalLines.push(
            `Motus Setup jump-landing buff = ${active ? "assumed active" : "inactive"}; this selected rank lasts ${fmt(motusSetupCondition.durationSeconds, 2)}s. Jump activation, expiration, and refresh timing are not simulated; an active state is held static for this calculation. Wiki: https://wiki.warframe.com/w/Motus_Setup`,
        );
    }
    const gasNeighborCounts = normalizeElectricGasNeighborCounts(
        targetProfileOverride?.nearbyEnemyCount,
        targetProfileOverride?.nearbyGasOuterEnemyCount,
    );
    const customTargetLines = targetProfileOverride ? [
        `Custom current-level target pools = Health ${fmt(targetProfileOverride.health ?? 0, 0)}, Shields ${fmt(targetProfileOverride.shields ?? 0, 0)}, Overguard ${fmt(targetProfileOverride.overguard ?? 0, 0)}, Armor ${fmt(targetProfileOverride.armor ?? 0, 0)}`,
        ...(targetProfileOverride.description ? [targetProfileOverride.description] : []),
        `Additional same-profile enemies inside the 3m Electric/Gas radius = ${gasNeighborCounts.innerCount}`,
        `Additional Gas neighbors in the 3–6m annulus = ${gasNeighborCounts.outerCount}`,
        `Additional same-profile enemies inside Blast's 5m radial = ${Math.max(0, Math.min(20, Math.floor(targetProfileOverride.nearbyBlastEnemyCount ?? 0)))}`,
        "Optimizer scoring uses the configured 0–3m neighbor count for Electricity/Gas and applies area-uniform 3–6m Gas coverage from the steady-state cloud radius. Blast cap-radial value uses Poisson arrivals during the scaled fuse; on-death radial value uses the primary-only score to estimate kill time and expected active Blast stacks over the shorter of that time and one fuse, with cap resets folded into the stack count. It assumes same-profile defenses and exposure; direct attacks, neighbor status histories, depleted neighbor pools, and chained deaths remain outside the score.",
        `Toxin bypasses Shields = ${targetProfileOverride.toxinBypassesShields === false ? "no" : "yes"}`,
        `Enemy Shield Gate hit mode = ${targetProfileOverride.enemyShieldGateHitMode ?? "body"}`,
        `Target status immunities = ${[...(targetProfileOverride.statusImmuneTypes ?? [])].join(", ") || "none"}`,
        `Target status stack caps = ${Object.entries(targetProfileOverride.statusStackCaps ?? {}).map(([type, cap]) => `${type} ${cap}`).join(", ") || "standard"}`,
        "The optimizer uses a fast expected pool-progress score, not the finite encounter. Blast cap and on-death radial collateral use Poisson stack-arrival estimates, with the primary target's modeled kill time kept separate from collateral. Neighbor status histories, pool depletion, gates, boss attenuation, and random outcomes are not simulated in its score.",
    ] : [];
    const fireRateExplanation = (() => {
        if (stats.fireRateLocked && !/^(?:semi|semi[- ]?auto)$/i.test(weapon.trigger.trim())
            && !(weapon.trigger === "Charge" && weapon.chargeTime)) {
            const fireRateModLockNote = "An equipped Cannonade mod locks Fire Rate to the weapon's unmodified value; positive and negative Fire Rate modifiers are ignored. Wiki: https://wiki.warframe.com/w/Cannonade_Mods";
            if (/^(?:semi|semi[- ]?auto)$/i.test(weapon.trigger.trim())) {
                return [
                    fireRateModLockNote,
                    `Semi-Auto effective fire rate = min(${fmt(Math.max(0.05, weapon.fireRate), 5)}, 10/s) = ${fmt(stats.fireRate, 5)}/s. The Wiki caps Semi-Auto weapons at 10 rounds/s and this estimate assumes perfect trigger cadence: https://wiki.warframe.com/w/Fire_Rate`,
                ];
            }
            return [fireRateModLockNote, `${rateLabel} remains at its base value of ${fmt(stats.fireRate, 5)}/s.`];
        }
        if (weapon.weaponType.trim().toLowerCase() === "bow") {
            const baseChargeTime = weapon.trigger === "Charge" ? Math.max(0, weapon.chargeTime ?? 0) : 0;
            const moddedChargeTime = baseChargeTime / Math.max(0.1, 1 + fireRateBonus);
            return [
                `Modded bow charge time = ${fmt(baseChargeTime, 5)} ÷ (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(moddedChargeTime, 5)}s`,
                ignoresReloadAndMagazine
                    ? `Effective bow rate = 1 ÷ modded charge time (reload ignored) = ${fmt(stats.fireRate, 5)}/s`
                    : `Effective bow rate = 1 ÷ (modded charge time ${fmt(moddedChargeTime, 5)}s + modded reload ${fmt(stats.reloadTime, 5)}s) = ${fmt(stats.fireRate, 5)}/s`,
                baseChargeTime > 0
                    ? `Fresh bow shot rate excludes post-shot reload = 1 ÷ modded charge time = ${fmt(stats.burstFireRate, 5)}/s`
                    : `Fresh uncharged bow shot rate uses reload delay = ${fmt(stats.burstFireRate, 5)}/s`,
                "Bow repeating rate already includes post-shot reload, so magazine duty cycle stays at 1 and does not count that delay twice.",
                ...(stats.initialAttackDelaySeconds > 0
                    ? [`Finite encounters assume the bow starts uncharged; its first attack follows the ${fmt(stats.initialAttackDelaySeconds, 5)}s modded charge.`]
                    : []),
            ];
        }
        if (weapon.selectedAttackChargeAmmoPerSecond !== undefined && weapon.selectedAttackChargeAmmoPerSecond > 0) {
            return [
                `Effective ${rateLabel.toLowerCase()} = ${fmt(stats.fireRate, 5)}/s; the selected attack charges ${fmt(stats.ammoCostPerShot, 5)} ammo at ${fmt(weapon.selectedAttackChargeAmmoPerSecond, 5)} ammo/s.`,
                `Finite encounters assume the selected attack starts uncharged; the first event follows its ${fmt(stats.initialAttackDelaySeconds, 5)}s charge. Special kill gates and per-use recharge history remain unmodeled.`,
            ];
        }
        if (/^(?:semi|semi[- ]?auto)$/i.test(weapon.trigger.trim())) {
            const moddedFireRate = Math.max(0.05, weapon.fireRate * (1 + fireRateBonus));
            return [
                `${rateLabel} before the trigger limit = ${fmt(weapon.fireRate, 5)} × (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(moddedFireRate, 5)}/s`,
                `Semi-Auto effective fire rate = min(${fmt(moddedFireRate, 5)}, 10/s) = ${fmt(stats.fireRate, 5)}/s. The WARFRAME Wiki caps Semi-Auto weapons at 10 rounds/s and this estimate assumes perfect trigger cadence: https://wiki.warframe.com/w/Fire_Rate`,
            ];
        }
        if (weapon.trigger === "Charge" && weapon.chargeTime) {
            const applicableFireRateBonus = stats.fireRateLocked ? 0 : fireRateBonus;
            const totalChargeRateBonus = applicableFireRateBonus + chargeRateBonus;
            const moddedChargeTime = weapon.chargeTime / Math.max(0.1, 1 + totalChargeRateBonus);
            const moddedPostChargeFireRate = Math.max(0.05, weapon.fireRate * (1 + applicableFireRateBonus));
            return [
                `Modded charge time = ${fmt(weapon.chargeTime, 5)}s ÷ (1 + Fire Rate ${fmt(applicableFireRateBonus * 100, 3)}% + Charge Rate ${fmt(chargeRateBonus * 100, 3)}%) = ${fmt(moddedChargeTime, 5)}s. The bonuses add for charge time; Charge Rate does not speed the post-charge firing interval. Wiki: https://wiki.warframe.com/w/Fire_Rate and https://wiki.warframe.com/w/Shell_Rush`,
                `Effective fire rate (Charge) = 1 ÷ (modded charge time ${fmt(moddedChargeTime, 5)}s + 1 ÷ modded fire rate ${fmt(moddedPostChargeFireRate, 5)}/s) = ${fmt(stats.fireRate, 5)}/s. Only source-linked rows are combined as components of the same attack; matching charge times alone do not imply a link.`,
                `Finite encounters assume the selected attack starts uncharged; its first event follows the ${fmt(stats.initialAttackDelaySeconds, 5)}s modded charge. Mausolon's separate five-kill alt-fire gate and repeat-charge history remain outside the model.`,
            ];
        }
        if (chargeRateBonus !== 0) {
            return [`Charge Rate has no effect on the selected attack because it has no sourced charge time. Wiki: https://wiki.warframe.com/w/Shell_Rush`];
        }
        if (weapon.selectedAttackAutoSpoolCadence) {
            const cadence = weapon.selectedAttackAutoSpoolCadence;
            const shotSequence = weapon.selectedAttackAutoSpoolShotSequence;
            return [
                `${rateLabel} = ${fmt(weapon.fireRate, 5)} × (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(stats.fireRate, 5)}/s at full spool. Wiki theoretical weapon comparisons use the fully spooled Arsenal rate.`,
                `Finite attack timing starts with the first hit at 0s, then applies the Wiki cadence for ${cadence.roundsToFullRate} shots: ${fmt(cadence.startingRateFraction * 100, 3)}% starting rate + ${fmt(cadence.rateIncreasePerShotFraction * 100, 4)} percentage points per shot, capped at full rate. The model assumes the spool resets after an empty magazine; spool-down between trigger releases, accuracy/recoil changes, and miss probability are not simulated. Wiki: ${cadence.sourceUrl}`,
                ...(shotSequence ? [
                    `The finite sequence starts at 1 pellet and adds ${fmt(shotSequence.projectilesAddedPerShot, 0)} per consecutive shot, to ${fmt(shotSequence.maxProjectiles, 0)}. Per-pellet Status Chance scales inversely with pellet count. The Wiki gives the starting and fully spooled ammo costs, but not every intermediate cost: this model linearly scales the exact maximum cost of ${fmt(shotSequence.ammoCostAtMaximumProjectiles, 4)} ammo by pellet count, with a ${fmt(shotSequence.minimumAmmoCostPerShot, 0)}-ammo minimum. That interpolation is an inference, and fractional ammo carries across shots. The steady profile uses the Wiki's rounded ${fmt(shotSequence.fullySpooledMagazineAmmoCost ?? shotSequence.ammoCostAtMaximumProjectiles, 2)}-ammo cost and has ${fmt(stats.shotsPerMag, 0)} attacks per magazine; the finite from-rest sequence estimates ${fmt(stats.finiteShotsPerMag, 0)} attacks. Wiki: ${shotSequence.sourceUrl}`,
                ] : []),
            ];
        }
        if (weapon.selectedAttackAutoSpoolTimingLimitation) {
            const limitation = weapon.selectedAttackAutoSpoolTimingLimitation;
            return [
                `${rateLabel} = ${fmt(weapon.fireRate, 5)} × (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(stats.fireRate, 5)}/s at full spool. Wiki theoretical weapon comparisons use the fully spooled Arsenal rate.`,
                `Finite attack timing and Expected TTK are unavailable for this Auto-Spool attack: ${limitation.reason} Wiki: ${limitation.sourceUrl}`,
            ];
        }
        return [
            `${rateLabel} = ${fmt(weapon.fireRate, 5)} × (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(stats.fireRate, 5)}`,
            ...(stats.initialAttackDelaySeconds > 0
                ? [`Finite encounters assume an uncharged start; the first event follows the ${fmt(stats.initialAttackDelaySeconds, 5)}s source-backed charge.`]
                : []),
        ];
    })();
    const sections: BuildMathSection[] = [
        {
            title: "Inputs",
            lines: [
                `Weapon base damage total = ${fmt(baseDamage, 5)}`,
                `Base damage split = impact ${fmt(weapon.damage.impact, 5)}, puncture ${fmt(weapon.damage.puncture, 5)}, slash ${fmt(weapon.damage.slash, 5)}, heat ${fmt(weapon.damage.heat, 5)}, cold ${fmt(weapon.damage.cold, 5)}, electricity ${fmt(weapon.damage.electricity, 5)}, toxin ${fmt(weapon.damage.toxin, 5)}, blast ${fmt(weapon.damage.blast, 5)}, radiation ${fmt(weapon.damage.radiation, 5)}, gas ${fmt(weapon.damage.gas, 5)}, magnetic ${fmt(weapon.damage.magnetic, 5)}, viral ${fmt(weapon.damage.viral, 5)}, corrosive ${fmt(weapon.damage.corrosive, 5)}, void ${fmt(weapon.damage.void, 5)}, tau ${fmt(weapon.damage.tau, 5)}, true ${fmt(weapon.damage.true, 5)}`,
                `Base crit chance = ${fmt(weapon.critChance * 100, 5)}% | base crit multiplier = ${fmt(weapon.critMultiplier, 5)} | base status chance = ${fmt(weapon.statusChance * 100, 5)}%`,
                `${rateLabel} base = ${fmt(weapon.fireRate, 5)} | magazine base = ${displayMagazineValue(weapon, weapon.magazineSize)} | reload base = ${fmt(weapon.reloadTime, 5)}s | multishot base = ${fmt(weapon.multishot, 5)}`,
                `Conditional effects scenario = ${conditionalState.mode}${conditionalState.mode === "custom" ? ` (${conditionalState.externalStacks ?? 0} maintained stacks per effect)` : ""}`,
                ...(totals.strainInfectionCritDamagePerCyst > 0 && weapon.category === "Melee" && !weapon.isExalted
                    ? [`Strain Infection = +${fmt(totals.strainInfectionCritDamagePerCyst * 100, 3)}% Critical Damage per active cyst × ${stats.strainInfectionCystsAtImpact}/8 cysts at impact = +${fmt(stats.strainInfectionCritDamageBonus * 100, 3)}% Critical Damage for Burst scoring, with the selected count held static inside that calculation. Cyst growth, erosion timing, and average uptime are not modeled. Scaling, sustained/stance-average DPS, direct finite TTK, Expected TTK, and 5s Avg DPS exclude this assumption. Wiki: https://wiki.warframe.com/w/Strain_Infection`]
                    : []),
                ...(totals.dreadfulKillshotDamageAndStatusPer75Health > 0 && weapon.name === "Basmu"
                    ? [`Dreadful Killshot = +${fmt(totals.dreadfulKillshotDamageAndStatusPer75Health * 100, 0)}% per 75 current Warframe Health × ${Math.floor(stats.dreadfulKillshotCurrentHealth / 75)} health steps, rounded down to 20% increments and capped at 360% = +${fmt(stats.dreadfulKillshotBonus * 100, 0)}% additive Damage and Status Chance for this Burst snapshot. Current Health is held static; health buffs and damage taken are not simulated. Scaling, sustained/stance-average DPS, direct finite TTK, Expected TTK, and 5s Avg DPS exclude this assumption. Wiki: https://wiki.warframe.com/w/Dreadful_Killshot`]
                    : []),
        ...(stats.deadlyManeuversHeadshotCritChanceBonus > 0
            ? [`Deadly Maneuvers Burst = ${stats.deadlyManeuversShotsRemaining} remaining buffed shot(s) after a dodge; +${fmt(totals.deadlyManeuversHeadshotCritChanceBonus * 100, 0)}% headshot Critical Chance is multiplicative after other bonuses (×${fmt(1 + totals.deadlyManeuversHeadshotCritChanceBonus, 0)} on each buffed shot). Burst averages the next two shots using the configured headshot share. Dodge/shot history is not modeled; finite TTK and 5s Avg DPS exclude it. Wiki: https://wiki.warframe.com/w/Deadly_Maneuvers`]
            : []),
                ...(weapon.selectedAttackSlideCritMultiplierOverride !== undefined
                    ? [`Kinetic Killer = ${conditionalState.playerSlidingAtImpact ? "active: 4x base Critical Damage while sliding at impact" : "selected but inactive: player is not assumed sliding at impact"}; the contact state is held static for each scored attack.`]
                    : []),
                ...(weapon.selectedAttackName && weapon.selectedAttackIsAreaDamage === undefined
                    ? ["Attack area type is unverified: the source row has no shot_type and no Wiki classification is cataloged. The current direct-hit-only damage and single-target assumptions are shown for this attack."]
                    : []),
                ...(weapon.hasGaleForceAmmoPassive ? [
                    `Gale Force = ${stats.infiniteAmmoActive ? "assumed continuously maintained" : "not active"}; headshot/kill trigger and four-second refresh timing are not simulated.${stats.infiniteAmmoActive ? " Infinite ammo prevents reloads, and first-shot Chamber bonuses are already spent." : " Select Fully stacked or Custom with at least one maintained stack to model the active buff."}`,
                ] : []),
                targetFaction ? `Target faction used for damage modifiers = ${targetFaction}` : "No target faction damage modifier selected",
                ...(usesMeleeDamageModel(weapon.category)
                    ? [
                        "Melee combo multiplier = " + fmt(stats.meleeComboMultiplier, 0) + "x (explicit scenario input)",
                        ...(weapon.selectedAttackUsesMeleeComboMultiplier
                            ? [
                                "Selected heavy-attack combo damage multiplier = ×" + fmt(stats.meleeAttackComboDamageMultiplier, 0) + " (assumed active for each scored hit)",
                                "Estimated combo before this heavy attack = " + fmt(stats.meleeComboPointsBeforeHeavyAttack, 1) + " points; capped Heavy Attack Efficiency = " + fmt(stats.heavyAttackEfficiency * 100, 1) + "%.",
                                "After one heavy attack, estimated retained combo = " + fmt(stats.meleeComboPointsAfterHeavyAttack, 1) + " points (" + fmt(stats.meleeComboMultiplierAfterHeavyAttack, 0) + "× tier). The direct-hit TTK steps repeated Heavy Attacks and restores Initial Combo at 40 points/s; it excludes attack-generated combo. DPS, finite status encounter, and optimizer scoring still hold the starting tier.",
                            ]
                            : []),
                    ]
                    : []),
                ...(stats.singleProjectileDamageMinDistanceMeters > 0
                    ? ["Target distance = " + (Number.isFinite(conditionalState.targetDistanceMeters)
                        ? fmt(conditionalState.targetDistanceMeters ?? 0, 2) + "m"
                        : "unset")]
                    : []),
                ...(stats.attackDamageFalloff ? [
                    stats.attackDamageFalloff.distanceMeters === null
                        ? `Attack distance is unset; the score assumes full damage (×${fmt(stats.attackDamageFalloff.damageMultiplier, 4)}) and does not evaluate a hit-range cap.`
                        : `Attack distance ${fmt(stats.attackDamageFalloff.distanceMeters, 2)}m applies a ×${fmt(stats.attackDamageFalloff.damageMultiplier, 5)} damage multiplier${stats.attackDamageFalloff.startDistanceMeters !== null && stats.attackDamageFalloff.endDistanceMeters !== null
                            ? ` across ${fmt(stats.attackDamageFalloff.startDistanceMeters, 2)}–${fmt(stats.attackDamageFalloff.endDistanceMeters, 2)}m after ×${fmt(stats.attackDamageFalloff.falloffDistanceMultiplier, 4)} falloff-range scaling`
                            : " (no direct falloff profile listed)"}.`,
                    ...(stats.attackDamageFalloff.maximumRangeMeters !== null
                        ? [stats.attackDamageFalloff.maximumRangeBehavior === "hardHitCap"
                            ? `Wiki-listed ${fmt(stats.attackDamageFalloff.maximumRangeMeters, 2)}m hit cap is enforced.${stats.attackDamageFalloff.isOutOfRangeMiss ? " The entered attack is a miss; it applies no hit or linked-component effects." : stats.attackDamageFalloff.exceedsListedMaximumRange ? " The entered distance exceeds the listed range, but this profile's range remains informational." : ""}`
                            : `Wiki-listed maximum range = ${fmt(stats.attackDamageFalloff.maximumRangeMeters, 2)}m; this calculator does not treat farther attacks as misses.${stats.attackDamageFalloff.exceedsListedMaximumRange ? " The entered distance exceeds that listed range." : ""}`]
                        : []),
                    ...(stats.attackDamageFalloff.sourceUrl ? [`Falloff source = ${stats.attackDamageFalloff.sourceUrl}`] : []),
                    ...(stats.attackDamageFalloff.maximumRangeSourceUrl ? [`Range source = ${stats.attackDamageFalloff.maximumRangeSourceUrl}`] : []),
                    ...(stats.conditionOverloadApplies || stats.directDamagePerStatusBonus > 0
                        ? ["Wiki reports that Condition Overload/Galvanized additive damage can ignore falloff in some damage-bracket combinations; this score applies falloff uniformly."]
                        : []),
                ] : []),
                ...(stats.attachedAttackDamageSequence?.profile.attackDamageFalloff ? [
                    `Linked ${stats.attachedAttackDamageSequence.rule.componentAttackName} uses ${fmt(stats.attachedAttackDamageSequence.profile.attackDamageFalloff.distanceMeters ?? 0, 2)}m blast-center offset for its attached-target event (×${fmt(stats.attachedAttackDamageSequence.profile.attackDamageFalloff.damageMultiplier, 4)} falloff).`,
                    ...(stats.attachedAttackDamageSequence.profile.attackDamageFalloff.sourceUrl
                        ? [`Linked component falloff source = ${stats.attachedAttackDamageSequence.profile.attackDamageFalloff.sourceUrl}`]
                        : []),
                ] : []),
                ...customTargetLines,
            ],
        },
        {
            title: "Base Stats",
            lines: [
                `Base damage multiplier bracket = 1 + additive damage bonuses = 1 + ${fmt(stats.totalDamageBonus, 5)} = ${fmt(baseDamageMultiplier, 5)}`,
                `Crit chance = base ${fmt(weapon.critChance, 5)} × (1 + additive crit ${fmt(totals.critChanceBonus, 5)}) + combo-scaled crit ${fmt(stats.comboCritChancePerTier, 5)} per tier × ${fmt(Math.max(0, stats.meleeComboMultiplier - 1), 0)} tiers above 1x + final crit ${fmt(totals.finalCritChanceBonus, 5)} = ${fmt(stats.critChance, 5)} (${fmt(stats.critChance * 100, 3)}%)`,
                `Crit multiplier = quantized base ${fmt(stats.quantizedBaseCritMultiplier, 7)} × (1 + additive crit mult ${fmt(totals.critMultBonus, 5)}) + final crit mult ${fmt(totals.finalCritMultiplierBonus, 5)} = ${fmt(stats.critMultiplier, 7)}`,
                ...(weapon.category === "Primary"
                    ? [`Vigilante set = ${stats.vigilanteSetModCount} distinct pieces × 5% = ${fmt(stats.vigilanteCritTierEnhancementChance * 100, 1)}% chance to raise a landed Primary crit by one tier; expected crit tier = ${fmt(stats.averageCritTier, 5)}.`]
                    : []),
                ...(usesMeleeDamageModel(weapon.category)
                    ? [`Gladiator set = ${stats.gladiatorSetModCount} distinct pieces × 10% × ${fmt(Math.max(0, stats.meleeComboMultiplier - 1), 0)} combo tiers above 1x = ${fmt(stats.gladiatorCritChancePerComboTier * Math.max(0, stats.meleeComboMultiplier - 1) * 100, 1)}% relative melee Critical Chance on base.`]
                    : []),
                ...(stats.sacrificialSetModCount > 0
                    ? [`Sacrificial set = ${stats.sacrificialSetModCount}/2 selected mods${stats.sacrificialSetModCount === 2 && weapon.category === "Melee" ? "; each mod's listed Melee Damage, Critical Chance, and Sentient Damage bonus is increased by 25%" : "; both mods must be equipped on this melee weapon to activate the set bonus"}.`]
                    : []),
                ...(stats.niraSetModCount > 0
                    ? ["Nira's Set = " + stats.niraSetModCount + "/3 distinct pieces" + (stats.niraSetSlamDamageBonus > 0 ? "; +" + fmt(stats.niraSetSlamDamageBonus * 100, 0) + "% Slam Damage, additive with Seismic Wave, on this melee slam attack" : "; bonus inactive because the selected attack is not a melee slam") + "."]
                    : []),
                ...(weapon.selectedAttackBaseStatusChancePerCriticalChance !== undefined
                    ? [`Wiseman's Regard = +${fmt(stats.statusChanceFromCritChanceBonus * 100, 3)} percentage points base Status Chance (${fmt(weapon.selectedAttackBaseStatusChancePerCriticalChance * 100, 3)}% of current ${fmt(stats.critChance * 100, 3)}% Critical Chance, capped at ${fmt((weapon.selectedAttackBaseStatusChancePerCriticalChanceCap ?? 0) * 100, 3)}%).`]
                    : []),
                `Status chance = base ${fmt(weapon.statusChance, 5)}${weapon.selectedAttackBaseStatusChancePerCriticalChance !== undefined ? ` + Wiki crit-scaled base ${fmt(stats.statusChanceFromCritChanceBonus, 5)} = ${fmt(weapon.statusChance + stats.statusChanceFromCritChanceBonus, 5)}` : ""} × (1 + additive status ${fmt(totals.statusChanceBonus, 5)} + AoE-only additive status ${fmt(weapon.selectedAttackIsAreaDamage === true ? totals.areaDamageStatusChanceBonus : 0, 5)}${usesMeleeDamageModel(weapon.category) ? ` + combo status ${fmt(totals.comboStatusChanceBonus * Math.max(0, stats.meleeComboMultiplier - 1), 5)}` : ""}) + final status ${fmt(totals.finalStatusChanceBonus, 5)} = ${fmt(stats.statusChance, 5)} (${fmt(stats.statusChance * 100, 3)}%)`,
                stats.pelletHitEstimate
                    ? `Pellet coverage estimate = ${fmt(stats.pelletHitEstimate.pelletsFired, 5)} pellets; one idealized center hit + remaining pellets × uniform solid-angle target/cone ratio. Listed spread range ${fmt(stats.pelletHitEstimate.minimumExpectedHits, 5)}–${fmt(stats.pelletHitEstimate.maximumExpectedHits, 5)} expected hits; midpoint ${fmt(stats.pelletHitEstimate.nominalSpreadDegrees, 2)}° estimate ${fmt(stats.pelletHitEstimate.nominalExpectedHits, 5)} is used for manual damage/status scoring. This is not calibrated to exact game RNG or hitbox geometry.`
                    : `Multishot = base ${fmt(weapon.multishot, 5)} × (1 + additive multishot ${fmt(totals.multishotBonus, 5)}) = ${fmt(stats.multishot, 5)}`,
                ...(usesMeleeDamageModel(weapon.category)
                    ? ["Combo-scaled bonuses = " + fmt(totals.comboCritChanceBonus * Math.max(0, stats.meleeComboMultiplier - 1) * 100, 3) + "% crit chance; " + fmt(totals.comboStatusChanceBonus * Math.max(0, stats.meleeComboMultiplier - 1) * 100, 3) + "% status chance"]
                    : []),
                ...(hasConditionalBonuses ? ["Conditional/ramping effects use the selected state and documented realistic trigger estimates where applicable."] : []),
            ],
        },
        {
            title: "Damage Bonuses",
            lines: [
                ...(totals.sentientSurgeMagazineRefillPerKill > 0
                    ? ["Sentient Surge refills " + fmt(totals.sentientSurgeMagazineRefillPerKill * 100, 0) + "% of the magazine from reserve ammo per target eliminated; this refill is displayed but excluded from the single-target score."]
                    : []),
                `Damage bonus = ${fmt(totals.damageBonus * 100, 3)}% | impact bonus = ${fmt(totals.impactBonus * 100, 3)}% | puncture bonus = ${fmt(totals.punctureBonus * 100, 3)}% | slash bonus = ${fmt(totals.slashBonus * 100, 3)}%`,
                ...(totals.sentientIncisionDamageBonus > 0
                    ? [`Sentient Incision rank bonus = ${fmt(totals.sentientIncisionDamageBonus * 100, 3)}%; target-resolved channel = ${stats.sentientIncisionDamageType ?? "unresolved"} (Slam attacks are excluded).`]
                    : []),
                ...(stats.slamAttackDamageMultiplier > 1
                    ? [`Selected slam damage multiplier = ×${fmt(stats.slamAttackDamageMultiplier, 5)} (multiplicative Slam Damage category)`]
                    : []),
                `Primary element bonuses = heat ${fmt(totals.heatBonus * 100, 3)}%, cold ${fmt(totals.coldBonus * 100, 3)}%, electricity ${fmt(totals.electricityBonus * 100, 3)}%, toxin ${fmt(totals.toxinBonus * 100, 3)}%`,
                `Advanced element bonuses = magnetic ${fmt(totals.magneticBonus * 100, 3)}%, radiation ${fmt(totals.radiationBonus * 100, 3)}%, viral ${fmt(totals.viralBonus * 100, 3)}%, corrosive ${fmt(totals.corrosiveBonus * 100, 3)}%, void ${fmt(totals.voidBonus * 100, 3)}%, tau ${fmt(totals.tauBonus * 100, 3)}%, true ${fmt(totals.trueBonus * 100, 3)}%`,
                `Status damage bonus = ${fmt(totals.statusDamageBonus * 100, 3)}% | status duration bonus = ${fmt(totals.statusDurationBonus * 100, 3)}% | faction damage bonus tracked here = ${fmt(totals.factionDamageBonus * 100, 3)}% | effective mod direct damage per status = ${fmt(stats.directDamagePerStatusBonus * 100, 3)}% | effective intrinsic direct damage per status = ${fmt(stats.intrinsicDamagePerStatusBonus * 100, 3)}% (${stats.intrinsicDamagePerStatusMode})`,
                ...(stats.targetStatusDamageVulnerabilityBonus > 0
                    ? [`Burning Hate = +${fmt(stats.targetStatusDamageVulnerabilityBonus * 100, 3)}% permanent target Status Damage vulnerability after Hate damages a Heat-afflicted enemy; finite encounter starts with ${(conditionalState.externalHeatStatusPresenceProbability ?? 0) > 0 ? "external Heat" : "no external Heat"} and activates it only after a qualifying event.`]
                    : []),
                ...((conditionalState.externalHeatStatusPresenceProbability ?? 0) > 0
                    ? [`Heat Inherit assumes the external first Heat source has +${fmt((conditionalState.externalHeatElementalDamageBonus ?? 0) * 100, 2)}% Heat and +${fmt((conditionalState.externalHeatFactionDamageBonus ?? 0) * 100, 2)}% faction damage. Later Heat procs use those inherited bonuses while retaining their own base and Status Damage; direct hits are unchanged. The external source's own damage and armor-strip history are not simulated.`]
                    : []),
                `Condition Overload = ${fmt(stats.conditionOverloadDamagePerStatusBonus * 100, 3)}% additive base damage per active type × ${fmt(stats.conditionOverloadStatusTypes, 3)} expected types (named external: ${conditionalState.externalStatusTypes?.join(", ") || "none"}; legacy unnamed: ${conditionalState.externalStatusTypeCount ?? 0}); multiplier ${fmt(stats.conditionOverloadDamageMultiplier, 5)}.`,
            ],
        },
        {
            title: "Damage Construction",
            lines: [
                `Modded base damage = base total ${fmt(baseDamage, 5)} × damage bracket ${fmt(baseDamageMultiplier, 5)} = ${fmt(moddedBaseDamageBeforeConditionOverload, 5)}; Condition Overload adds ${fmt(moddedBaseDamage - moddedBaseDamageBeforeConditionOverload, 5)} = ${fmt(moddedBaseDamage, 5)}`,
                ...(stats.sentientIncisionDamageType && stats.sentientIncisionDamageBonus > 0
                    ? [`Sentient Incision adds ${fmt(stats.baseDamageTotal * stats.sentientIncisionDamageBonus, 5)} ${capitalizeDamageType(stats.sentientIncisionDamageType)} as a separate, non-combining channel after elemental combination. It does not increase the base-damage quantization scale or the matching Status Effect DoT seed. ${targetProfileOverride?.overguard && targetProfileOverride.overguard > 0 ? "This uses the initial Overguard Corrosive snapshot; later element switching is not part of finite or sustained scores." : ""} https://wiki.warframe.com/w/Sentient_Incision`]
                    : []),
                ...(selectedAttackDamageMultiplier !== 1
                    ? [`Selected attack damage multipliers = Slam Damage ${fmt(stats.slamAttackDamageMultiplier, 5)} × heavy-attack combo ${fmt(stats.meleeAttackComboDamageMultiplier, 5)} = ${fmt(selectedAttackDamageMultiplier, 5)}; quantization base = ${fmt(moddedBaseDamage, 5)} × ${fmt(selectedAttackDamageMultiplier, 5)} = ${fmt(moddedBaseDamageForQuantization, 5)}`]
                    : []),
                ...(hasSuppressedPerStatusDirectHitBonus
                    ? ["Wiki direct-hit rule: per-status mod and weapon damage bonuses do not affect this source-marked AoE attack."]
                    : []),
                ...(totals.conditionOverloadDamagePerStatusBonus > 0 && !stats.conditionOverloadApplies
                    ? ["Condition Overload is disabled for this selected source-marked area, slam, or glaive heavy-throw attack."]
                    : []),
                `Physical raw values before quantization = impact ${fmt(rawBreakdown.physicalRaw.impact, 5)}, puncture ${fmt(rawBreakdown.physicalRaw.puncture, 5)}, slash ${fmt(rawBreakdown.physicalRaw.slash, 5)}`,
                ...(stats.physicalDamageConversion
                    ? [`Wiki Conditioning rule: base Impact + Puncture + Slash damage converts to ${capitalizeDamageType(stats.physicalDamageConversion)}; elemental damage remains unchanged. ${BEAST_CLAW_CONDITIONING_WIKI_URL[stats.physicalDamageConversion]}`]
                    : []),
                ...(stats.elementalDamageConversion
                    ? [`Wiki Beast Claws rule: primary Heat/Cold/Electricity/Toxin damage converts to ${capitalizeDamageType(stats.elementalDamageConversion)}. Radiation/Magnetic and other secondary damage stay separate; the Wiki says Momentous Bond's bonus is not converted or mixed. ${BEAST_CLAW_ELEMENTAL_CONVERSION_WIKI_URL[stats.elementalDamageConversion]}`]
                    : []),
                `Element queue before combination = ${rawBreakdown.orderedElementQueue.map((entry) => `${entry.type} ${fmt(entry.value, 5)} (order ${entry.order})`).join(" | ") || "none"}`,
                `Combined base damage breakdown before Condition Overload and direct-only per-status bonuses = ${nonZeroRawEntries.map(([type, value]) => `${type} ${fmt(value, 5)}`).join(", ") || "none"}`,
                stats.directDamagePerStatusMultiplier !== 1
                    ? stats.intrinsicDamagePerStatusMode === "multiplicativeBase"
                        ? `Direct-hit-only per-status multiplier = (Condition Overload bracket ${fmt(conditionOverloadDamageBracket, 5)} × (1 + intrinsic ${fmt(stats.intrinsicDamagePerStatusBonus, 5)} × ${fmt(stats.intrinsicDamageStatusTypes, 3)} CO-style types) + mod per-status ${fmt(stats.directDamagePerStatusBonus, 5)} × ${fmt(stats.directDamageStatusTypes, 3)} Galvanized-eligible types) ÷ Condition Overload bracket = ${fmt(stats.directDamagePerStatusMultiplier, 5)}`
                        : `Direct-hit-only per-status multiplier = (Condition Overload bracket ${fmt(conditionOverloadDamageBracket, 5)} + mod per-status ${fmt(stats.directDamagePerStatusBonus, 5)} × ${fmt(stats.directDamageStatusTypes, 3)} Galvanized-eligible types + intrinsic ${fmt(stats.intrinsicDamagePerStatusBonus, 5)} × ${fmt(stats.intrinsicDamageStatusTypes, 3)} CO-style types) ÷ Condition Overload bracket = ${fmt(stats.directDamagePerStatusMultiplier, 5)}`
                    : "No direct-damage per-status multiplier applied",
            ],
        },
        {
            title: "Quantization",
            lines: [
                `Scale = direct-hit modded base damage, including selected attack multipliers, ÷ 32 = (${fmt(moddedBaseDamage, 5)} × ${fmt(selectedAttackDamageMultiplier, 5)} × ${fmt(stats.directDamagePerStatusMultiplier, 5)}) ÷ 32 = ${fmt(quantScale, 5)}`,
                `Per-type quantization follows Round(raw ÷ scale) × scale`,
                ...quantizedLines,
                `Quantized final breakdown = ${Object.entries(stats.damageBreakdown).filter(([, value]) => (value as number) > 0).map(([type, value]) => `${type} ${fmt(value as number, 5)}`).join(", ") || "none"}`,
                `Quantized total direct damage = ${fmt(stats.totalDamage, 5)}`,
                targetFaction ? `Target-matched faction mod multiplier = ×${fmt(1 + stats.factionDamageBonus, 5)} (${targetFaction})` : "No target faction selected",
            ],
        },
        {
            title: "Crit and DPS",
            lines: [
                `Arsenal Total Damage = unquantized damage construction × attack damage equivalent (damage-weighted multishot ${fmt(stats.damageWeightedMultishot, 5)} + one-hit bonus ${fmt(stats.singleProjectileDamageBonus, 5)}) = ${fmt(stats.arsenalDamage, 5)}`,
                `${stats.pelletHitEstimate ? "Expected pellet hits" : "Expected projectile count"} = ${fmt(stats.multishot, 5)} per ${damageUnit}; damage-weighted multiplier = ${fmt(stats.damageWeightedMultishot, 5)} (unique extra-projectile damage bonus ${fmt(stats.multishotDamageBonus * 100, 3)}%)`,
                `Quantized direct damage per ${damageUnit} = ${fmt(stats.totalDamage, 5)} × attack damage equivalent ${fmt(attackDamageEquivalent, 5)} = ${fmt(quantizedShotDamage, 5)}`,
                `Status DoT seed damage share = (damage-weighted multishot ${fmt(stats.damageWeightedMultishot, 5)} + one-hit bonus ${fmt(stats.singleProjectileDamageBonus, 5)}) ÷ multishot ${fmt(stats.multishot, 5)} = ${fmt(stats.multishot > 0 ? attackDamageEquivalent / stats.multishot : 1, 6)}; Spring-Loaded Broadhead enters the seed once and is not applied again to each DoT tick.`,
                `Average hit damage multiplier = expected direct damage ÷ quantized damage per ${damageUnit} = ${fmt(stats.averageShotDamage, 5)} ÷ ${fmt(quantizedShotDamage, 5)} = ${fmt(avgHitMultiplier, 6)}`,
                ...hitLocationLines,
                `Average crit multiplier cross-check = 1 + expected crit tier × (crit multiplier - 1) = 1 + ${fmt(stats.averageCritTier, 5)} × (${fmt(stats.critMultiplier, 5)} - 1) = ${fmt(1 + stats.averageCritTier * (stats.critMultiplier - 1), 6)}`,
                `Average direct damage per ${damageUnit} = quantized damage ${fmt(quantizedShotDamage, 5)} × average hit damage multiplier ${fmt(avgHitMultiplier, 6)} = ${fmt(stats.averageShotDamage, 5)}`,
                ...(stats.firstShotMagazineDamageBonus > 0
                    ? [
                        `First ammo-consuming shot after reload = ${fmt(stats.averageShotDamage, 5)} × ${fmt(stats.firstShotMagazineDamageMultiplier, 6)} = ${fmt(stats.averageShotDamage * stats.firstShotMagazineDamageMultiplier, 5)}`,
                        `Average magazine damage multiplier = 1 + first-shot bonus ${fmt(stats.firstShotMagazineDamageBonus, 5)} ÷ ${fmt(stats.shotsPerMag, 5)} shots = ${fmt(stats.magazineAverageDamageMultiplier, 6)}`,
                    ]
                    : []),
                ...(stats.lastShotMagazineRequestedDamageBonus > 0
                    ? stats.lastShotMagazineInactiveReason
                        ? [`Final-shot magazine bonus is inactive because ${describeLastShotMagazineInactiveReason(stats.lastShotMagazineInactiveReason)}.`]
                        : [
                            `Final ammo-consuming shot, one-hit bonus = ${fmt(stats.averageShotDamage, 5)} × ${fmt(stats.lastShotMagazineDamageMultiplier, 6)} = ${fmt(stats.averageShotDamage * stats.lastShotMagazineDamageMultiplier, 5)}`,
                            `The final-shot bonus is distributed over ${fmt(stats.damageWeightedMultishot, 5)} expected projectiles because only one hit receives it.`,
                        ]
                    : []),
                ...(stats.firstShotMagazineDamageBonus > 0 || stats.lastShotMagazineDamageBonus > 0
                    ? [
                        `Average magazine damage multiplier = 1 + (first-shot bonus ${fmt(stats.firstShotMagazineDamageBonus, 5)} + one-hit final-shot bonus ${fmt(stats.lastShotMagazineDamageMultiplier - 1, 5)}) ÷ ${fmt(stats.shotsPerMag, 5)} attacks = ${fmt(stats.magazineAverageDamageMultiplier, 6)}`,
                    ]
                    : []),
                ...fireRateExplanation,
                `Burst DPS = ${avgDamageLabel} ${fmt(stats.averageShotDamage, 5)} × fresh-mag attack rate ${fmt(stats.burstFireRate, 5)} × fresh-mag ramp ${fmt(stats.freshMagazineDamageMultiplier, 6)} × average magazine damage ${fmt(stats.magazineAverageDamageMultiplier, 6)} = ${fmt(result.burstDPS, 5)}`,
                ignoresReloadAndMagazine
                    ? `Sustained DPS = average damage ${fmt(finiteStats.averageShotDamage, 5)} × fire rate ${fmt(finiteStats.fireRate, 5)} × sustained ramp ${fmt(finiteStats.sustainedDamageMultiplier, 6)} because reload/magazine are ignored = ${fmt(finiteResult.sustainedDPS, 5)}`
                    : `Sustained DPS = average damage ${fmt(finiteStats.averageShotDamage, 5)} × fire rate ${fmt(finiteStats.fireRate, 5)} × magazine duty cycle ${fmt(finiteStats.magazineDutyCycle, 6)} × sustained ramp ${fmt(finiteStats.sustainedDamageMultiplier, 6)} × average magazine damage ${fmt(finiteStats.magazineAverageDamageMultiplier, 6)} = ${fmt(finiteResult.sustainedDPS, 5)}`,
                ...damageRampLines,
                ...(usesMeleeDamageModel(weapon.category)
                    ? meleeAverageDps && meleeDpsInputs
                        ? [
                            `Wiki ${meleeDpsInputs.comboType} combo damage multiplier = direct ${fmt(meleeDpsInputs.totalDamageMultiplier, 5)} + forced Slash ${fmt(meleeDpsInputs.totalSlashProcMultiplier, 5)} = ${fmt(meleeDpsInputs.totalDamageMultiplier + meleeDpsInputs.totalSlashProcMultiplier, 5)} (${meleeDpsInputs.comboName})`,
                            `Wiki direct combo damage = direct multiplier ${fmt(meleeDpsInputs.totalDamageMultiplier, 5)} × initial-state quantized hit damage ${fmt(meleeDpsBaseline?.totalDamage ?? 0, 5)} × expected hit multiplier ${fmt(meleeAverageDps.expectedHitDamageMultiplier, 6)} = ${fmt(meleeAverageDps.directDamage, 5)}`,
                            `Wiki forced Slash DoT = one-proc Slash tick ${fmt(meleeDpsBaseline?.slashDotTickDamagePerProc ?? 0, 5)} × combo-equivalent forced hits ${fmt(meleeAverageDps.forcedSlashProcEquivalentHits, 5)} × duration-adjusted ticks ${fmt(meleeAverageDps.slashTickCount, 0)} = ${fmt(meleeAverageDps.forcedSlashDamage, 5)}`,
                            `Average combo damage = direct ${fmt(meleeAverageDps.directDamage, 5)} + forced Slash DoT ${fmt(meleeAverageDps.forcedSlashDamage, 5)} = ${fmt(meleeAverageDps.averageHit, 5)}`,
                            `Stance average DPS = average hit ${fmt(meleeAverageDps.averageHit, 5)} × modded attack speed ${fmt(meleeDpsBaseline?.fireRate ?? 0, 5)} ÷ base combo length ${fmt(meleeDpsInputs.baseComboLengthSeconds, 5)}s = ${fmt(meleeAverageDps.averageDps, 5)}`,
                            `Data: Warframe Wiki Stance comparison table, checked ${WIKI_MELEE_STANCE_VERIFIED_AT}. Forced Slash uses the current Bleed tick model; physical/elemental mods do not increase that proc. Combo timing is approximate, stance physical-damage bonuses are omitted by the Wiki table, and target defenses/full hit sequences are not simulated.`,
                        ]
                        : ["Stance average DPS is unavailable because the selected stance has no timed Neutral combo in the Wiki reference table."]
                    : []),
                ...(!usesMeleeDamageModel(weapon.category) && !weapon.isExalted ? [
                    `Ordinary ammo efficiency = ${fmt(stats.ammoEfficiencyBonus * 100, 3)}% after additive bonuses and the 75% cap${weapon.selectedAttackIsIncarnon ? " (ignored in transformed Incarnon form)" : ""}${stats.infiniteAmmoActive ? "; Gale Force is modeled separately as maintained infinite ammo" : ""}`,
                    ...(weapon.selectedAttackChargeAmmoPerSecond && weapon.selectedAttackChargeDamageBaseAmmoCost ? [
                        `Charged attack damage = Wiki row damage × (${fmt(stats.ammoCostPerShot, 5)} ammo ÷ ${fmt(weapon.selectedAttackChargeDamageBaseAmmoCost, 5)}-ammo baseline) = ${fmt(stats.totalDamage, 5)}; charge time = ${fmt(stats.ammoCostPerShot, 5)} ÷ ${fmt(weapon.selectedAttackChargeAmmoPerSecond, 5)} ammo/s = ${fmt(stats.chargeTimeSeconds ?? 0, 5)}s.`,
                    ] : []),
                    ...(weapon.selectedAttackAmmoGate ? [
                        `Loaded-ammo gate = ${fmt(weapon.selectedAttackAmmoGate.minimumMagazineAmmoToFire, 0)} rounds; current magazine ${fmt(stats.magazineSize, 0)} ${stats.ammoGateSatisfied ? "meets" : "does not meet"} the requirement. The Wiki does not specify whether ammo efficiency lowers this trigger threshold; this model keeps the gate fixed and applies efficiency only to ammo spent.`,
                    ] : []),
                    stats.infiniteAmmoActive && stats.ammoGateSatisfied
                        ? "Shots per magazine = unbounded while the Gale Force buff is assumed active; no reload interruption is modeled."
                        : weapon.selectedAttackAmmoGate
                        ? stats.ammoGateSatisfied
                            ? `Shots per magazine = floor((${fmt(stats.magazineSize, 5)} - max(${fmt(weapon.selectedAttackAmmoGate.minimumMagazineAmmoToFire, 5)}, ${fmt(stats.ammoCostPerShot, 5)} × (1 - ${fmt(stats.ammoEfficiencyBonus, 5)}))) ÷ (${fmt(stats.ammoCostPerShot, 5)} × (1 - ${fmt(stats.ammoEfficiencyBonus, 5)}))) + 1 = ${fmt(stats.shotsPerMag, 0)}.`
                            : "Shots per magazine = 0 because current magazine capacity is below the loaded-ammo gate."
                        : weapon.selectedAttackAutoSpoolShotSequence
                        ? `Fully-spooled magazine attacks = ${fmt(stats.shotsPerMag, 0)} at ${fmt(weapon.selectedAttackAutoSpoolShotSequence.fullySpooledMagazineAmmoCost ?? weapon.selectedAttackAutoSpoolShotSequence.ammoCostAtMaximumProjectiles, 2)} ammo per attack. For finite attacks from rest, the sequence estimates ${fmt(stats.finiteShotsPerMag, 0)} shots before the next modeled ammo cost exceeds ${fmt(stats.magazineSize, 5)} capacity. Intermediate costs use the exact ${fmt(weapon.selectedAttackAutoSpoolShotSequence.ammoCostAtMaximumProjectiles, 4)}-ammo full-spool endpoint, are linearly interpolated by pellet count, have a ${fmt(weapon.selectedAttackAutoSpoolShotSequence.minimumAmmoCostPerShot, 0)}-ammo minimum, and carry fractional ammo between shots. This interpolation is an inference, not a Wiki per-shot table.`
                        : stats.ammoEfficiencyBonus > 0
                        ? `Shots per magazine = ceil(${fmt(stats.magazineSize, 5)} ÷ (${fmt(stats.ammoCostPerShot, 5)} × (1 - ${fmt(stats.ammoEfficiencyBonus, 5)}))) = ${fmt(stats.shotsPerMag, 5)}; ammo-efficiency fractional remainder is carried into the next shot.`
                        : `Shots per magazine = ${fmt(stats.magazineSize, 5)} ÷ (${fmt(stats.ammoCostPerShot, 5)} × (1 - ${fmt(stats.ammoEfficiencyBonus, 5)})) = ${fmt(stats.shotsPerMag, 5)}`,
                ] : []),
            ],
        },
        {
            title: "Status and DoT",
            lines: [
                `Average procs per ${damageUnit} = ordinary rolls (multishot ${fmt(stats.multishot, 5)} × status chance ${fmt(stats.statusChance, 5)}, with Tau's ${fmt(stats.tauStatusVulnerability * 100, 3)}% vulnerability applied to non-Tau effects) + forced/status-triggered extra procs = ${fmt(stats.averageProcsPerShot, 5)}`,
                ...procLines,
                `Expected stacks by type = ${Object.entries(stats.expectedStacksByType).filter(([, value]) => (value ?? 0) > 0).map(([type, value]) => `${type} ${fmt(value ?? 0, 5)}`).join(", ") || "none"}`,
                `DoT per ${damageUnit} total = ${fmt(finiteStats.dotDamagePerShot, 5)}`,
                `Steady-state DoT DPS estimate = expected status seed damage per second plus grouped-tick accumulator contribution = ${fmt(finiteStats.dotDps, 5)}`,
                ...dotTypeLines,
                ...nightwatchNapalmLines,
                ...attachedAttackDamageLines,
                `Derived status effects = Viral health bonus ${fmt(stats.viralHealthDamageBonus * 100, 5)}%, Heat armor strip ${fmt(stats.heatArmorStrip * 100, 5)}%, Corrosive armor strip ${fmt(stats.corrosiveArmorStrip * 100, 5)}%, Magnetic shield bonus ${fmt(stats.magneticShieldDamageBonus * 100, 5)}%, Radiation ally damage bonus ${fmt(stats.radiationAllyDamageBonus * 100, 5)}%, Cold slow ${fmt(stats.coldSlow * 100, 5)}%, Cold crit bonus ${fmt(stats.coldCritDamageBonus, 5)}, Puncture enemy damage reduction ${fmt(stats.punctureEnemyDamageReduction * 100, 5)}%, Puncture crit chance bonus ${fmt(stats.punctureCritChanceBonus * 100, 5)}%, Impact mercy threshold bonus ${fmt(stats.impactMercyThresholdBonus * 100, 5)}%, Tau status vulnerability ${fmt(stats.tauStatusVulnerability * 100, 5)}%`,
            ],
        },
        ...(conditionalLines.length ? [{
            title: "Conditional Assumptions",
            lines: conditionalLines,
        }] : []),
    ];

    return { sections };
}

function buildExportPayload(args: {
    weapon: WeaponEntry | null;
    selectedAttackIdx: number;
    meleeDpsInputs: MeleeDpsInputState | null;
    goal: OptimizeGoal;
    conditionalState: ConditionalState;
    targetFaction: string | null;
    targetProfileOverride?: TargetProfileOverride;
    targetStatusImmunities: StatusDamageType[];
    buildCfg: BuildCfg;
    includeArcaneStats: boolean;
    slots: (ModEntry | null)[];
    ranks: number[];
    slotPols: string[];
    stanceMod: ModEntry | null;
    stanceRank: number;
    stancePol: string;
    formaCount: number;
    exilusEnabled: boolean;
    exilusMod: ModEntry | null;
    exilusRank: number;
    exilusPol: string;
    arcane: ArcaneEntry | null;
    arcaneRank: number;
    warframeArmor?: number;
    warframeMaxEnergy?: number;
    warframeEnergyPercent?: number;
    optimizeMode: OptimizeMode;
    respectCap: boolean;
    allowNonMax: boolean;
    onlyOwned: boolean;
    factionOn: boolean;
    allowCatalyst: boolean;
    allowForma: boolean;
    maxFormaAllowed: number;
    optExilus: boolean;
    optArcane: boolean;
    compatMods: ModEntry[];
    weaponArcanes: ArcaneEntry[];
    ownedSet: Set<string>;
    ownedModMaxRankByUniqueName: Record<string, number>;
    ownedArcaneUniqueNames: Set<string>;
    ownedArcaneMaxRankByUniqueName: Record<string, number>;
    excluded: Set<string>;
}): BuildExportPayload | null {
    const {
        weapon, selectedAttackIdx, goal, conditionalState, targetFaction, targetProfileOverride, targetStatusImmunities, meleeDpsInputs, buildCfg, includeArcaneStats,
        slots, ranks, slotPols, stanceMod, stanceRank, stancePol, formaCount, exilusEnabled, exilusMod, exilusRank, exilusPol, arcane, arcaneRank,
        warframeArmor, warframeMaxEnergy, warframeEnergyPercent,
        optimizeMode, respectCap, allowNonMax, onlyOwned, factionOn, allowCatalyst, allowForma, maxFormaAllowed, optExilus, optArcane,
        compatMods, weaponArcanes, ownedSet, ownedModMaxRankByUniqueName, ownedArcaneUniqueNames, ownedArcaneMaxRankByUniqueName, excluded,
    } = args;
    if (!weapon) return null;

    const weaponState = applyWeaponConfig(weapon, selectedAttackIdx, buildCfg);
    const selectedAttack = weaponState.weaponWithIntrinsicOptions.attacks.length > 1
        ? weaponState.weaponWithIntrinsicOptions.attacks[selectedAttackIdx] ?? null
        : null;
    const calcWeapon = weaponState.selectedWeapon;

    const effects: (ModEffect | null)[] = [
        ...weaponState.activeIncarnonEffects,
        ...slots.map((m, i) => {
        if (!m) return null;
        const r = ranks[i] ?? m.fusionLimit;
        return m.effectsByRank[r] ?? m.effect;
        }),
    ];
    if (exilusEnabled && exilusMod) {
        effects.push(exilusMod.effectsByRank[exilusRank] ?? exilusMod.effect);
    }
    if (includeArcaneStats && arcane) {
        const ae = getArcaneEffectAtRank(arcane, arcaneRank, warframeArmor, true, { warframeMaxEnergy, warframeEnergyPercent });
        if (ae) effects.push({
            ...emptyEffect(),
            ...ae,
            conditionalEffects: [...(ae.conditionalEffects ?? [])],
        });
    }

    const expectedKillRatePerSecond = estimateGalvanizedPerStatusKillRate(
        calcWeapon,
        effects,
        targetFaction ?? "",
        targetProfileOverride,
        conditionalState,
        conditionalState.externalStatusTypeCount ?? 0,
        conditionalState.externalStatusTypes ?? [],
        targetStatusImmunities,
    );

    const calculated = calculateBuild(calcWeapon, effects, targetFaction ?? "", {
        conditionalState,
        isEximusTarget: targetProfileOverride?.isEximusTarget,
        targetHasOverguard: getTargetProfileAssumptions(targetFaction ?? "", targetProfileOverride).overguard > 0,
        statusImmuneTypes: targetStatusImmunities,
        statusStackCaps: targetProfileOverride?.statusStackCaps,
        hitLocation: getTargetHitLocationProfile(targetFaction ?? "", targetProfileOverride),
        ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
    });
    const finiteCalculated = hasBurstOnlyConditionalAssumption(conditionalState)
        ? calculateBuild(calcWeapon, effects, targetFaction ?? "", {
            conditionalState: withoutBurstOnlyConditionalAssumptions(conditionalState) ?? conditionalState,
            isEximusTarget: targetProfileOverride?.isEximusTarget,
            targetHasOverguard: getTargetProfileAssumptions(targetFaction ?? "", targetProfileOverride).overguard > 0,
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(targetFaction ?? "", targetProfileOverride),
            ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
        })
        : calculated;
    const meleeDpsBaseline = usesMeleeDamageModel(weapon.category) &&
        meleeDpsInputs != null
        ? calculateBuild(calcWeapon, effects, targetFaction ?? "", {
            conditionalState: { mode: "initial" },
            isEximusTarget: targetProfileOverride?.isEximusTarget,
            targetHasOverguard: getTargetProfileAssumptions(targetFaction ?? "", targetProfileOverride).overguard > 0,
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(targetFaction ?? "", targetProfileOverride),
            targetStatusState: "initial",
        }).modded
        : null;
    const meleeAverageDps = meleeDpsBaseline && meleeDpsInputs
        ? calculateMeleeAverageDps(meleeDpsBaseline, {
            totalDamageMultiplier: meleeDpsInputs.totalDamageMultiplier,
            totalSlashProcMultiplier: meleeDpsInputs.totalSlashProcMultiplier,
            baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
        })
        : null;
    const calculatedWithMeleeDps = {
        ...calculated,
        sustainedDPS: finiteCalculated.sustainedDPS,
        modded: {
            ...calculated.modded,
            dotDamagePerShot: finiteCalculated.modded.dotDamagePerShot,
            dotDamagePerShotByType: finiteCalculated.modded.dotDamagePerShotByType,
            dotDps: finiteCalculated.modded.dotDps,
            dotDpsByType: finiteCalculated.modded.dotDpsByType,
        },
        meleeAverageDps: meleeAverageDps && meleeDpsInputs
            ? {
                totalDamageMultiplier: meleeDpsInputs.totalDamageMultiplier,
                totalSlashProcMultiplier: meleeDpsInputs.totalSlashProcMultiplier,
                baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
                directDamage: meleeAverageDps.directDamage,
                forcedSlashDamage: meleeAverageDps.forcedSlashDamage,
                forcedSlashProcEquivalentHits: meleeAverageDps.forcedSlashProcEquivalentHits,
                slashTickCount: meleeAverageDps.slashTickCount,
                averageHit: meleeAverageDps.averageHit,
                averageDps: meleeAverageDps.averageDps,
            }
            : null,
    };
    const math = buildMathBreakdown(
        calcWeapon,
        effects,
        targetFaction ?? "",
        conditionalState,
        targetProfileOverride ?? undefined,
        meleeDpsInputs,
        expectedKillRatePerSecond,
        targetStatusImmunities,
    );
    const ownedModsForExport = onlyOwned
        ? compatMods
            .filter((mod) => ownedSet.has(mod.uniqueName))
            .map((mod) => ({
                name: mod.name,
                uniqueName: mod.uniqueName,
                ownedMaxRank: ownedModMaxRankByUniqueName[mod.uniqueName] ?? mod.fusionLimit,
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.uniqueName.localeCompare(b.uniqueName))
        : undefined;
    const ownedArcanesForExport = onlyOwned
        ? weaponArcanes
            .filter((arcane) => ownedArcaneUniqueNames.has(arcane.uniqueName))
            .map((arcane) => ({
                name: arcane.name,
                uniqueName: arcane.uniqueName,
                ownedMaxRank: ownedArcaneMaxRankByUniqueName[arcane.uniqueName] ?? arcane.maxRank,
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.uniqueName.localeCompare(b.uniqueName))
        : undefined;
    const excludedModsForExport = excluded.size > 0
        ? compatMods
            .filter((mod) => excluded.has(mod.uniqueName))
            .map((mod) => ({
                name: mod.name,
                uniqueName: mod.uniqueName,
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.uniqueName.localeCompare(b.uniqueName))
        : undefined;

    return {
        exportedAt: new Date().toISOString(),
        source: "tenno-hub/mod-builder",
        weapon: {
            name: getWeaponDisplayName(weapon),
            uniqueName: weapon.uniqueName,
            category: weapon.category,
            selectedAttack: selectedAttack?.name ?? null,
        },
        assumptions: {
            goal,
            targetFaction,
            targetProfileOverride,
            weaponRank: buildCfg.weaponRank,
            masteryRank: buildCfg.masteryRank,
            hasCatalyst: buildCfg.hasCatalyst,
            formaCount,
            valenceBonusPct: weapon.isProgenitorWeapon ? buildCfg.valenceBonusPct : undefined,
            valenceElement: weapon.isProgenitorWeapon ? buildCfg.valenceElement : null,
            optimizeValenceElement: weapon.isProgenitorWeapon ? buildCfg.optimizeValenceElement : undefined,
            incarnonUnlockedTier: weaponState.incarnonRecord ? getHighestSelectedIncarnonTier(buildCfg.incarnonSelectedOptionsByTier) : undefined,
            incarnonSelectedOptionsByTier: weaponState.incarnonRecord ? buildCfg.incarnonSelectedOptionsByTier : undefined,
            optimizeIncarnonSelections: weaponState.incarnonRecord ? buildCfg.optimizeIncarnonSelections : undefined,
            includeArcaneStats,
            warframeArmor,
            warframeMaxEnergy,
            warframeEnergyPercent,
            selectedAttackIdx,
            meleeStanceCombo: usesMeleeDamageModel(weapon.category) && meleeDpsInputs
                ? {
                    ...meleeDpsInputs,
                    sourceUrl: WIKI_MELEE_STANCE_SOURCE_URL,
                    verifiedAt: WIKI_MELEE_STANCE_VERIFIED_AT,
                }
                : null,
        },
        optimizer: {
            mode: optimizeMode,
            options: {
                respectCapacity: respectCap,
                allowNonMaxRank: allowNonMax,
                ownedOnly: onlyOwned,
                factionFocus: factionOn,
                allowCatalyst,
                allowForma,
                maxFormaAllowed,
                optimizeExilus: optExilus,
                optimizeArcane: optArcane,
                conditionalState,
            },
            pools: {
                compatibleMods: compatMods.length,
                compatibleArcanes: weaponArcanes.length,
                ownedMods: ownedModsForExport,
                ownedArcanes: ownedArcanesForExport,
                excludedMods: excludedModsForExport,
            },
        },
        build: {
            stance: {
                mod: stanceMod?.name ?? null,
                uniqueName: stanceMod?.uniqueName ?? null,
                rank: stanceMod ? stanceRank : 0,
                slotPolarity: stancePol,
                statsLabel: stanceMod ? (stanceMod.statsTextByRank[stanceRank] ?? stanceMod.statsLabel) : null,
            },
            slots: slots.map((m, i) => ({
                slot: i + 1,
                mod: m?.name ?? null,
                uniqueName: m?.uniqueName ?? null,
                rank: m ? (ranks[i] ?? m.fusionLimit) : 0,
                slotPolarity: slotPols[i] ?? "",
                modPolarity: m?.polarity ?? null,
                statsLabel: m ? (m.statsTextByRank[ranks[i] ?? m.fusionLimit] ?? m.statsLabel) : null,
            })),
            exilus: {
                enabled: exilusEnabled,
                mod: exilusMod?.name ?? null,
                uniqueName: exilusMod?.uniqueName ?? null,
                rank: exilusMod ? exilusRank : 0,
                slotPolarity: exilusPol,
                statsLabel: exilusMod ? (exilusMod.statsTextByRank[exilusRank] ?? exilusMod.statsLabel) : null,
            },
            arcane: {
                mod: arcane?.name ?? null,
                uniqueName: arcane?.uniqueName ?? null,
                rank: arcane ? arcaneRank : 0,
                statsLabel: arcane ? (arcane.statsByRank[arcaneRank] ?? arcane.statsLabel) : null,
            },
        },
        calculated: calculatedWithMeleeDps,
        math,
    };
}

// ── Polarity picker ───────────────────────────────────────────────────────────

function PolarityPicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen(v => !v)}
                className="flex items-center justify-center w-6 h-6 rounded border border-slate-700/60 hover:border-slate-500 transition-colors"
                title="Change slot polarity">
                {value ? <PolarityIcon polarity={value} className="w-3.5 h-3.5" /> : <span className="text-slate-600 text-xs">○</span>}
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 mt-1 w-32 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    {POLARITY_OPTS.map(o => (
                        <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
                            className={["w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors",
                                o.key === value ? "bg-slate-700/60 text-slate-100" : "text-slate-300 hover:bg-slate-800"].join(" ")}>
                            <span className="w-5 flex items-center justify-center">
                                {o.key ? <PolarityIcon polarity={o.key} className="w-3.5 h-3.5" /> : <span className="text-slate-600">○</span>}
                            </span>
                            <span>{o.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function shouldAutoInstallCatalyst(
    cfg: CapacityConfig,
    slotPols: string[],
    slots: (ModEntry | null)[],
    ranks: number[],
    extraCapacitySlots: Array<{ mod: ModEntry; rank: number; polarity: string }> = [],
): boolean {
    if (cfg.hasCatalyst) return false;
    const slotCfgs = slotPols.map(polarity => ({ polarity }));
    const extraCfgs = extraCapacitySlots.map(slot => ({ polarity: slot.polarity }));
    const extraMods = extraCapacitySlots.map(slot => slot.mod);
    const extraRanks = extraCapacitySlots.map(slot => slot.rank);
    const uncatalyzed = computeCapacity(cfg, [...extraCfgs, ...slotCfgs], [...extraMods, ...slots], [...extraRanks, ...ranks]);
    if (!uncatalyzed.overCapacity) return false;
    const catalyzed = computeCapacity({ ...cfg, hasCatalyst: true }, [...extraCfgs, ...slotCfgs], [...extraMods, ...slots], [...extraRanks, ...ranks]);
    return !catalyzed.overCapacity;
}

// ── Stat Badge ────────────────────────────────────────────────────────────────

function StatBadge({ label, value, sub, highlight, tooltip, icon }: {
    label: string; value: string; sub?: string; highlight?: boolean; tooltip?: string; icon?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className={["rounded-lg border px-3 py-2 relative select-none",
            highlight ? "border-amber-700/50 bg-amber-950/20" : "border-slate-700/60 bg-slate-900/50",
            tooltip ? "cursor-help" : ""].join(" ")}
            onMouseEnter={() => tooltip && setShow(true)}
            onMouseLeave={() => setShow(false)}>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                {icon && <img src={icon} alt="" className="w-3.5 h-3.5 shrink-0" />}
                {label}{tooltip && <span className="text-slate-700 text-[8px]">?</span>}
            </div>
            <div className={["text-sm font-semibold mt-0.5", highlight ? "text-amber-300" : "text-slate-100"].join(" ")}>{value}</div>
            {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
            {show && tooltip && (
                <div className="absolute bottom-full left-0 mb-1.5 z-50 w-60 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] text-slate-300 shadow-xl leading-relaxed pointer-events-none whitespace-pre-line">
                    {tooltip}
                </div>
            )}
        </div>
    );
}

function GoalChip({ label, desc, active, onClick }: {
    label: string; desc: string; active: boolean; onClick: () => void;
}) {
    const [show, setShow] = useState(false);
    return (
        <div
            className="relative"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            <button
                onClick={onClick}
                className={[
                    "rounded-full px-2.5 py-1 text-[11px] border transition-colors",
                    active ? "bg-slate-100 text-slate-900 border-slate-100" : "bg-slate-950/40 text-slate-300 border-slate-700 hover:bg-slate-900",
                ].join(" ")}
            >
                {label}
            </button>
            {show && (
                <div className="absolute right-0 top-full z-[80] mt-2 w-64 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-300 shadow-xl">
                    {desc}
                </div>
            )}
        </div>
    );
}

function CapBar({ used, total, over }: { used: number; total: number; over: boolean }) {
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    return (
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className={["h-full rounded-full transition-all",
                over ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-blue-500"].join(" ")}
                style={{ width: `${pct}%` }} />
        </div>
    );
}

// ── Mod Slot ──────────────────────────────────────────────────────────────────

interface SlotProps {
    index: number; label?: string;
    headIsWeakPoint?: boolean;
    selectedAttackName?: string;
    selectedAttackTrigger?: string;
    selectedAttackIsAreaDamage?: boolean;
    targetFaction?: string;
    targetHasOverguard?: boolean;
    selectedAttackUsesSlamDamageBonus?: boolean;
    selectedWeaponName?: string;
    selectedAttackHeadshotRate?: number;
    deadlyManeuversShotsRemaining?: number;
    criticalPrecisionHeadshotProjectiles?: number;
    unseenDreadInvisibilityActive?: boolean;
    selectedGoal?: string;
    mod: ModEntry | null; rank: number; slotPolarity: string;
    compatMods: ModEntry[]; usedGroups: Set<string>;
    ownedUniqueNames: Set<string>; onlyOwned: boolean; isExilusSlot?: boolean;
    excluded: Set<string>;
    onChange: (i: number, m: ModEntry | null) => void;
    onRankChange: (i: number, r: number) => void;
    onPolarityChange: (i: number, p: string) => void;
    onToggleExclude: (uniqueName: string) => void;
    effDrain: number;
    compactEmpty?: boolean;
    locked?: boolean;
    draggable?: boolean;
    isDragOver?: boolean;
    onDragStartSlot?: () => void;
    onDragEndSlot?: () => void;
    onDragOverSlot?: () => void;
    onDropSlot?: () => void;
}

function ModSlot({ index, label, headIsWeakPoint, selectedAttackName, selectedAttackTrigger, selectedAttackIsAreaDamage, targetFaction, targetHasOverguard, selectedAttackUsesSlamDamageBonus, selectedWeaponName, selectedAttackHeadshotRate, deadlyManeuversShotsRemaining, criticalPrecisionHeadshotProjectiles, unseenDreadInvisibilityActive, selectedGoal, mod, rank, slotPolarity, compatMods, usedGroups,
    ownedUniqueNames, onlyOwned, isExilusSlot, excluded, onChange, onRankChange, onPolarityChange, onToggleExclude, effDrain, compactEmpty, locked,
    draggable, isDragOver, onDragStartSlot, onDragEndSlot, onDragOverSlot, onDropSlot }: SlotProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [showDetails, setShowDetails] = useState(false);
    const [sliderActive, setSliderActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return sortBuilderModsForDisplay(compatMods.filter(m => {
            if (isExilusSlot && !m.isExilus) return false;
            if (usedGroups.has(m.incompatibilityGroup) && m.incompatibilityGroup !== mod?.incompatibilityGroup) return false;
            if (onlyOwned && ownedUniqueNames.size > 0 && !ownedUniqueNames.has(m.uniqueName)) return false;
            if (q && !getBuilderDisplayModName(m).toLowerCase().includes(q) && !m.statsLabel.toLowerCase().includes(q)) return false;
            return true;
        }));
    }, [compatMods, usedGroups, mod, query, onlyOwned, ownedUniqueNames, isExilusSlot]);
    const currentStatsLabel = mod ? (mod.statsTextByRank[rank] ?? mod.statsLabel) : "";
    const scoringEffectContext = { headIsWeakPoint, selectedAttackName, selectedAttackTrigger, selectedAttackIsAreaDamage, targetFaction, targetHasOverguard, selectedAttackUsesSlamDamageBonus, selectedWeaponName, selectedAttackHeadshotRate, deadlyManeuversShotsRemaining, criticalPrecisionHeadshotProjectiles, unseenDreadInvisibilityActive, selectedGoal };
    const currentUnmodeledDamageLines = mod ? getUnmodeledDamageEffectLines(mod, rank, scoringEffectContext) : [];
    const currentUnmodeledDamageSourceUrl = mod ? getUnmodeledDamageEffectSourceUrl(mod) : undefined;

    const polMatch    = !!(mod && slotPolarity && slotPolarity === mod.polarity);
    const polMismatch = !!(mod && slotPolarity && slotPolarity !== mod.polarity && slotPolarity !== "");

    return (
        <div className={["relative min-w-0", compactEmpty ? "" : "h-full"].join(" ")} ref={panelRef}>
            <div className={[(compactEmpty && !mod ? "overflow-hidden " : "") + (compactEmpty ? "" : "h-full ") + "rounded-xl border transition-colors",
                isDragOver ? "border-sky-400/80 bg-sky-950/20" :
                mod
                    ? polMismatch ? "border-amber-700/40 bg-slate-900/60"
                                  : "border-slate-600 bg-slate-900/60 hover:border-slate-500"
                    : isExilusSlot ? "border-dashed border-slate-600/50 bg-slate-950/30 hover:border-slate-500"
                                   : "border-dashed border-slate-700/60 bg-slate-950/20 hover:border-slate-600"].join(" ")}
                draggable={draggable && !!mod && !sliderActive}
                onDragStart={(e) => {
                    if (!draggable || !mod || sliderActive) {
                        e.preventDefault();
                        return;
                    }
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `${label ?? "slot"}-${index}`);
                    onDragStartSlot?.();
                }}
                onDragEnd={() => onDragEndSlot?.()}
                onDragOver={(e) => {
                    if (!onDragOverSlot) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    onDragOverSlot();
                }}
                onDrop={(e) => {
                    if (!onDropSlot) return;
                    e.preventDefault();
                    onDropSlot();
                }}>

                <div className={["p-3 flex items-start gap-2 select-none", locked ? "cursor-default" : "cursor-pointer", mod ? "min-h-[112px]" : compactEmpty ? "min-h-[84px]" : "min-h-[112px]"].join(" ")}
                    onClick={() => { if (locked) return; setOpen(x => !x); setQuery(""); }}>
                    {mod ? (
                        <>
                            <div
                                className="relative flex-1 min-w-0"
                                onMouseEnter={() => setShowDetails(true)}
                                onMouseLeave={() => setShowDetails(false)}
                            >
                                <div className="flex min-w-0 items-center gap-1">
                                    {label && <span className="shrink-0 text-[8px] uppercase tracking-wide text-slate-600">{label}</span>}
                                    <span
                                        className="min-w-0 flex-1 text-xs font-semibold leading-tight text-slate-100"
                                        style={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {getBuilderDisplayModName(mod)}
                                    </span>
                                    {mod.compatBucket === "Riven" && <span className="text-[9px] px-1 rounded border border-yellow-700/50 bg-yellow-950/30 text-yellow-400">RIVEN</span>}
                                    {mod.effect.targetFaction && <span className="text-[9px] px-1 rounded border border-orange-700/50 bg-orange-950/30 text-orange-400">{mod.effect.targetFaction}</span>}
                                </div>
                                <div
                                    className="mt-1 text-[10px] leading-tight text-slate-400"
                                    style={{
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {currentStatsLabel}
                                    {rank < mod.fusionLimit && <span className="text-slate-600 ml-1">@{rank}/{mod.fusionLimit}</span>}
                                </div>
                                {currentUnmodeledDamageLines.length > 0 && (
                                    <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[9px] leading-tight text-amber-300"
                                        title={currentUnmodeledDamageLines.join(" · ")}>
                                        <span>Unscored effect; Auto Optimize skips this mod</span>
                                        {currentUnmodeledDamageSourceUrl && (
                                            <a href={currentUnmodeledDamageSourceUrl} target="_blank" rel="noreferrer"
                                                onClick={(event) => event.stopPropagation()}
                                                aria-label={`Open ${getBuilderDisplayModName(mod)} source on WARFRAME Wiki`}
                                                className="underline decoration-amber-700 underline-offset-2 hover:text-amber-200">
                                                Wiki source
                                            </a>
                                        )}
                                    </div>
                                )}
                                {showDetails && (
                                    <div className="wf-popover pointer-events-none absolute left-0 top-full z-[70] mt-2 w-64 rounded-lg border px-3 py-2">
                                        <div className="text-xs font-semibold leading-tight text-slate-100">{getBuilderDisplayModName(mod)}</div>
                                        <div className="mt-1 text-[11px] leading-relaxed text-slate-300">{currentStatsLabel}</div>
                                        {currentUnmodeledDamageLines.length > 0 && <div className="mt-1 text-[10px] leading-relaxed text-amber-300">Not included: {currentUnmodeledDamageLines.join(" · ")}</div>}
                                        {!mod.hasDamageEffect && !mod.isBuiltIn && currentUnmodeledDamageLines.length === 0 && <div className="mt-1 text-[10px] leading-relaxed text-amber-300">No parsed damage effect; automatic optimization excludes this mod.</div>}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                {!locked && (
                                    <button className="text-slate-600 hover:text-slate-300 text-xs"
                                        onClick={e => { e.stopPropagation(); onChange(index, null); }}>✕</button>
                                )}
                                {locked && <span className="text-[9px] uppercase tracking-wide text-slate-600">Fixed</span>}
                                <span className={["text-[9px] font-mono font-bold px-1 py-0.5 rounded",
                                    effDrain < 0 ? "text-green-300 bg-green-950/40" :
                                    polMatch    ? "text-green-400 bg-green-950/30" :
                                    polMismatch ? "text-amber-400 bg-amber-950/30" : "text-slate-400 bg-slate-800/60"].join(" ")}>
                                    {effDrain < 0 ? `+${Math.abs(effDrain)}` : effDrain}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className={["flex items-center gap-1.5 text-slate-600 text-xs w-full justify-center text-center",
                            compactEmpty ? "py-2" : label ? "py-6" : "py-3"].join(" ")}>
                            <span>+</span><span>{label ? `Add ${label}` : "Add Mod"}</span>
                        </div>
                    )}
                </div>

                {/* Rank slider */}
                {mod && mod.fusionLimit > 0 && (
                    <div
                        className="grid grid-cols-[34px_minmax(0,1fr)_46px] items-center gap-2 px-3 pb-2 pt-1"
                        onClick={e => e.stopPropagation()}
                    >
                        <span className="text-[9px] text-slate-600">Rank</span>
                        <div className="min-w-0 px-2">
                            <input
                                type="range"
                                min={0}
                                max={mod.fusionLimit}
                                value={rank}
                                onPointerDown={() => setSliderActive(true)}
                                onMouseDown={() => setSliderActive(true)}
                                onPointerUp={() => setSliderActive(false)}
                                onMouseUp={() => setSliderActive(false)}
                                onTouchEnd={() => setSliderActive(false)}
                                onBlur={() => setSliderActive(false)}
                                onDragStart={e => e.preventDefault()}
                                onChange={e => onRankChange(index, +e.target.value)}
                                className="block w-full min-w-0 h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-300 [&::-webkit-slider-thumb]:bg-slate-100 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-blue-300 [&::-moz-range-thumb]:bg-slate-100"
                            />
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 text-right">{rank}/{mod.fusionLimit}</span>
                    </div>
                )}

                {/* Slot polarity */}
                {(!compactEmpty || mod) && (
                <div className="flex items-center gap-1.5 px-3 pb-2.5 border-t border-slate-800/40 pt-1.5"
                    onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] text-slate-600 uppercase tracking-wide">Slot</span>
                    <PolarityPicker value={slotPolarity} onChange={p => onPolarityChange(index, p)} />
                    {mod?.polarity && (
                        <div className="ml-auto flex items-center gap-1">
                            <span className="text-[9px] text-slate-600">mod</span>
                            <PolarityIcon polarity={mod.polarity} className="w-3 h-3" />
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Mod picker dropdown */}
            {open && !locked && (
                <div className="absolute z-50 mt-1 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="p-2 border-b border-slate-800">
                        <input ref={inputRef} type="text" placeholder="Search mods…" value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                        {mod && (
                            <button className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-800/50"
                                onClick={() => { onChange(index, null); setOpen(false); setQuery(""); }}>
                                Clear slot
                            </button>
                        )}
                        {filtered.length === 0 && <div className="px-3 py-4 text-xs text-slate-500 text-center">No matching mods</div>}
                        {filtered.map(m => {
                            const eff      = effectiveDrain(m, slotPolarity);
                            const match    = !!(slotPolarity && slotPolarity === m.polarity);
                            const mismatch = !!(slotPolarity && slotPolarity !== m.polarity && slotPolarity !== "");
                            const owned    = ownedUniqueNames.size === 0 || ownedUniqueNames.has(m.uniqueName);
                            const unmodeledDamageLines = getUnmodeledDamageEffectLines(m, m.fusionLimit, scoringEffectContext);
                            return (
                                <button key={m.uniqueName}
                                    className={["w-full px-3 py-2 text-left hover:bg-slate-800/50 transition-colors",
                                        m.uniqueName === mod?.uniqueName ? "bg-slate-800/30" : "",
                                        !owned ? "opacity-50" : ""].join(" ")}
                                    onClick={() => { onChange(index, m); setOpen(false); setQuery(""); }}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="shrink-0 w-4">
                                            {m.polarity ? <PolarityIcon polarity={m.polarity} className="w-3.5 h-3.5" /> : <span className="text-slate-700 text-xs">○</span>}
                                        </span>
                                        <span className="text-xs font-medium text-slate-200 flex-1 truncate">{getBuilderDisplayModName(m)}</span>
                                        {!owned && <span className="text-[9px] text-slate-600 shrink-0">(unowned)</span>}
                                        {m.effect.targetFaction && <span className="text-[9px] px-1 rounded border border-orange-700/50 bg-orange-950/30 text-orange-400 shrink-0">{m.effect.targetFaction}</span>}
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); onToggleExclude(m.uniqueName); }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onToggleExclude(m.uniqueName);
                                                }
                                            }}
                                            className={["text-[9px] px-1.5 py-0.5 rounded border shrink-0 transition-colors",
                                                excluded.has(m.uniqueName)
                                                    ? "border-red-700/60 bg-red-950/30 text-red-300"
                                                    : "border-slate-700 text-slate-500 hover:border-red-700/60 hover:text-red-300"].join(" ")}
                                            title={excluded.has(m.uniqueName) ? "Remove from exclusions" : "Exclude from optimizer"}
                                        >
                                            {excluded.has(m.uniqueName) ? "Excluded" : "Exclude"}
                                        </span>
                                        <span className={["text-[9px] font-mono font-bold shrink-0 px-1 rounded",
                                            match ? "text-green-400 bg-green-950/30" : mismatch ? "text-amber-400 bg-amber-950/30" : "text-slate-500"].join(" ")}>
                                            {eff < 0 ? `+${Math.abs(eff)}` : eff}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 pl-5">
                                        {m.statsLabel || "—"}
                                        <span className="text-slate-700 ml-1">{m.rarity}</span>
                                        {unmodeledDamageLines.length > 0 && <span className="ml-1 text-amber-400" title={unmodeledDamageLines.join(" · ")}>Unscored effect; optimizer excludes</span>}
                                        {!m.hasDamageEffect && !m.isBuiltIn && unmodeledDamageLines.length === 0 && <span className="ml-1 text-amber-500">Effect not modeled</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Arcane Slot ───────────────────────────────────────────────────────────────

function ArcaneSlot({ label, headIsWeakPoint, arcane, rank, onChange, onRankChange, availableArcanes }: {
    label: string;
    headIsWeakPoint?: boolean;
    arcane: ArcaneEntry | null;
    rank: number;
    onChange: (a: ArcaneEntry | null) => void;
    onRankChange: (r: number) => void;
    availableArcanes: ArcaneEntry[];
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [showDetails, setShowDetails] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return availableArcanes.filter(a => !q || a.name.toLowerCase().includes(q));
    }, [availableArcanes, query]);

    // Current stats at rank
    const statAtRank = arcane ? normalizeArcaneDisplayText(arcane.statsByRank[rank] ?? arcane.statsLabel) : null;
    const unmodeledSelectedEffectLines = arcane
        ? getUnmodeledScoringEffectLines(arcane.optimizerEffectByRank[rank] ?? arcane.permanentEffectByRank[rank], { headIsWeakPoint })
        : [];

    return (
        <div className="relative" ref={panelRef}>
            <div className={["rounded-xl border transition-colors",
                arcane ? "border-slate-600 bg-slate-900/60 hover:border-slate-500"
                       : "border-dashed border-slate-700/60 bg-slate-950/20 hover:border-slate-600"].join(" ")}>
                <div className="p-3 flex items-start gap-2 min-h-[84px] cursor-pointer select-none"
                    onClick={() => { setOpen(x => !x); setQuery(""); }}>
                    {arcane ? (
                        <>
                            <div
                                className="relative flex-1 min-w-0"
                                onMouseEnter={() => setShowDetails(true)}
                                onMouseLeave={() => setShowDetails(false)}
                            >
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] uppercase tracking-wide text-violet-400/60">{label}</span>
                                    <span className="text-xs font-semibold text-slate-100 truncate">{arcane.name}</span>
                                    <span className="text-[9px] px-1 rounded border border-violet-700/50 bg-violet-950/30 text-violet-400 shrink-0">{arcane.rarity}</span>
                                </div>
                                <div
                                    className="mt-0.5 text-[10px] leading-tight text-slate-400"
                                    style={{
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {statAtRank}
                                    {rank < arcane.maxRank && <span className="text-slate-600 ml-1">@{rank}/{arcane.maxRank}</span>}
                                </div>
                                {showDetails && (
                                    <div className="wf-popover pointer-events-none absolute left-0 top-full z-[70] mt-2 w-64 rounded-lg border px-3 py-2">
                                        <div className="text-xs font-semibold leading-tight text-slate-100">{arcane.name}</div>
                                        <div className="mt-1 text-[11px] leading-relaxed text-slate-300">{statAtRank}</div>
                                    </div>
                                )}
                            </div>
                            <button className="text-slate-600 hover:text-slate-300 text-xs shrink-0"
                                onClick={e => { e.stopPropagation(); onChange(null); }}>✕</button>
                        </>
                    ) : (
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs w-full">
                            <span className="text-[8px] uppercase tracking-wide text-violet-400/40 mr-1">{label}</span>
                            <span>+</span><span>Add Arcane</span>
                        </div>
                    )}
                </div>

                {/* Rank slider */}
                {arcane && (
                    <div
                        className="grid grid-cols-[34px_minmax(0,1fr)_46px] items-center gap-2 px-3 pb-2 pt-1 border-t border-slate-800/40"
                        onClick={e => e.stopPropagation()}
                    >
                        <span className="text-[9px] text-slate-600">Rank</span>
                        <div className="min-w-0 px-2">
                            <input
                                type="range"
                                min={0}
                                max={arcane.maxRank}
                                value={rank}
                                onChange={e => onRankChange(+e.target.value)}
                                className="block w-full min-w-0 h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-violet-300 [&::-webkit-slider-thumb]:bg-slate-100 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-violet-300 [&::-moz-range-thumb]:bg-slate-100"
                            />
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 text-right">{rank}/{arcane.maxRank}</span>
                    </div>
                )}
            </div>

            {arcane && unmodeledSelectedEffectLines.length > 0 && (
                <p role="note" className="px-3 pb-2 text-[9px] leading-relaxed text-amber-300">
                    Not included in damage scoring: {unmodeledSelectedEffectLines.join(" · ")} Auto Optimize skips this Arcane for unsupported effects.
                </p>
            )}

            {open && (
                <div className="absolute z-50 mt-1 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="p-2 border-b border-slate-800">
                        <input ref={inputRef} type="text" placeholder="Search arcanes…" value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                        {arcane && <button className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-800/50"
                            onClick={() => { onChange(null); setOpen(false); }}>Clear slot</button>}
                        {filtered.length === 0 && <div className="px-3 py-4 text-xs text-slate-500 text-center">No arcanes found</div>}
                        {filtered.map(a => (
                            <button key={a.uniqueName}
                                className={["w-full px-3 py-2 text-left hover:bg-slate-800/50 transition-colors",
                                    a.name === arcane?.name ? "bg-slate-800/30" : ""].join(" ")}
                                onClick={() => { onChange(a); onRankChange(a.maxRank); setOpen(false); setQuery(""); }}>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-slate-200 flex-1 truncate">{a.name}</span>
                                    <span className="text-[9px] px-1 rounded border border-violet-700/50 bg-violet-950/30 text-violet-400 shrink-0">{a.rarity}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{a.statsLabel}</div>
                                {getUnmodeledScoringEffectLines(a.optimizerEffectByRank[a.maxRank] ?? a.permanentEffectByRank[a.maxRank], { headIsWeakPoint }).length > 0 && (
                                    <div className="text-[9px] text-amber-300 mt-0.5">
                                        Not all effects are included in scoring; Auto Optimize skips this Arcane for unsupported effects.
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Weapon Selector ───────────────────────────────────────────────────────────

function WeaponSelector({ selected, onSelect }: { selected: WeaponEntry | null; onSelect: (w: WeaponEntry) => void }) {
    const [query, setQuery] = useState("");
    const [cat, setCat] = useState<WeaponCategory | "All">("All");
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open]);
    const weapons  = useMemo(() => getWeaponCatalog(), []);
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        const matches = weapons.filter((weapon) => {
            if (cat !== "All" && weapon.category !== cat) return false;
            if (!q) return true;

            const haystacks = [
                getWeaponDisplayName(weapon),
                weapon.category,
                weapon.weaponType,
                weapon.variantLabel ?? "",
            ].map((value) => value.toLowerCase());
            return haystacks.some((value) => value.includes(q));
        });

        const ranked = matches.sort((a, b) => {
            if (!q) return a.name.localeCompare(b.name);
            const aName = getWeaponDisplayName(a).toLowerCase();
            const bName = getWeaponDisplayName(b).toLowerCase();
            const aStarts = aName.startsWith(q) ? 1 : 0;
            const bStarts = bName.startsWith(q) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            const aWord = aName.split(/\s+/).some((part) => part.startsWith(q)) ? 1 : 0;
            const bWord = bName.split(/\s+/).some((part) => part.startsWith(q)) ? 1 : 0;
            if (aWord !== bWord) return bWord - aWord;

            const aIdx = aName.indexOf(q);
            const bIdx = bName.indexOf(q);
            if (aIdx !== bIdx) return aIdx - bIdx;

            return getWeaponDisplayName(a).localeCompare(getWeaponDisplayName(b));
        });

        return ranked.slice(0, 120);
    }, [weapons, query, cat]);
    const activeFilterLabel = WEAPON_FILTER_OPTIONS.find((option) => option.value === cat)?.label ?? "All Weapons";

    return (
        <div className="relative" ref={panelRef}>
            <button ref={triggerRef} aria-haspopup="dialog" aria-expanded={open} aria-controls="wf-weapon-selector-panel" onClick={() => setOpen(x => !x)}
                className={["w-full rounded-2xl border px-3 py-3 text-left transition-all",
                    selected
                        ? "border-slate-600 bg-slate-900/70 shadow-[0_18px_50px_rgba(2,6,23,0.28)] hover:border-slate-500"
                        : "border-dashed border-slate-700 bg-slate-950/30 hover:border-slate-600 hover:bg-slate-950/40",
                    open ? "border-slate-500 shadow-[0_22px_60px_rgba(15,23,42,0.42)]" : "",
                ].join(" ")}>
                {selected ? (
                    <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-100">{getWeaponDisplayName(selected)}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                <span>{selected.category}</span>
                                <span className="text-slate-700">/</span>
                                <span>{selected.weaponType}</span>
                                {selected.canOverLevel && (
                                    <span className="rounded-full border border-[color:var(--wf-warning)] bg-[color:var(--wf-warning-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wf-warning)]">
                                        Rank 40
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className="text-xs text-slate-500 transition-transform">{open ? "▴" : "▾"}</span>
                    </div>
                ) : <span className="text-sm text-slate-500">Select a weapon…</span>}
            </button>
            {open && (
                <div id="wf-weapon-selector-panel" role="dialog" aria-label="Choose a weapon" className="wf-popover absolute z-50 mt-2 w-full overflow-hidden rounded-[22px] border backdrop-blur-xl">
                    <div className="border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] p-3">
                        <input ref={inputRef} type="text" placeholder="Search weapons, categories, or weapon types…" value={query}
                            aria-label="Search weapons"
                            onChange={e => setQuery(e.target.value)}
                            className="w-full rounded-2xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10" />
                        <div className="-mx-1 mt-3 overflow-x-auto pb-1">
                            <div role="group" aria-label="Weapon category" className="flex min-w-max gap-2 px-1">
                            {WEAPON_FILTER_OPTIONS.map((option) => (
                                <button key={option.value} aria-pressed={cat === option.value} onClick={() => setCat(option.value)}
                                    className={[
                                        "shrink-0 rounded-2xl border px-4 py-2.5 text-center text-[12px] font-semibold leading-none transition-all",
                                        cat === option.value
                                            ? "border-slate-100 bg-slate-100 text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.08)]"
                                            : "border-slate-700/80 bg-slate-900/55 text-slate-300 hover:border-slate-500 hover:bg-slate-900",
                                    ].join(" ")}>
                                    <span className="block whitespace-nowrap">{option.label}</span>
                                </button>
                            ))}
                        </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                            <span>{activeFilterLabel}</span>
                            <span>{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                        {filtered.length === 0 && (
                            <div className="px-4 py-8 text-center">
                                <div className="text-sm font-medium text-slate-300">No weapons matched that search.</div>
                                <div className="mt-1 text-xs text-slate-500">Try a broader name, change the filter, or search by weapon type.</div>
                            </div>
                        )}
                        {filtered.map(w => (
                            <button key={w.uniqueName}
                                className={["w-full px-4 py-3 text-left transition-colors hover:bg-slate-900/80",
                                    w.uniqueName === selected?.uniqueName ? "bg-slate-900/70" : ""].join(" ")}
                                onClick={() => { onSelect(w); setOpen(false); setQuery(""); triggerRef.current?.focus(); }}>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-slate-100">{getWeaponDisplayName(w)}</span>
                                            {w.attacks.length > 1 && <span className="rounded-full border border-blue-700/40 bg-blue-950/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-300">{w.attacks.length} atk</span>}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                            <span>{w.weaponType}</span>
                                            {w.variantLabel && <>
                                                <span className="text-slate-700">/</span>
                                                <span>{w.variantLabel} profile</span>
                                            </>}
                                            <span className="text-slate-700">/</span>
                                            <span>{fmt(w.damage.total)} dmg</span>
                                            <span className="text-slate-700">/</span>
                                            <span>{fmt(w.critChance * 100, 1)}% cc</span>
                                            <span className="text-slate-700">/</span>
                                            <span>{fmt(w.statusChance * 100, 1)}% sc</span>
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-slate-700/70 bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-400">
                                        {w.category}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Exclusion List ────────────────────────────────────────────────────────────

function ExclusionList({ allMods, excluded, onToggle }: {
    allMods: ModEntry[]; excluded: Set<string>; onToggle: (uniqueName: string) => void;
}) {
    const [query, setQuery] = useState("");
    const filteredAll = useMemo(() => {
        const q = query.toLowerCase();
        return allMods.filter(m => !q || getBuilderDisplayModName(m).toLowerCase().includes(q)).slice(0, 60);
    }, [allMods, query]);

    return (
        <WorkspacePanel className="space-y-3 p-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Excluded Mods</div>
                <span className="text-[10px] text-slate-600">{excluded.size} excluded · Excluded mods are never used by the optimizer</span>
            </div>
            <input type="text" placeholder="Search to add/remove exclusions…" value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
            {excluded.size > 0 && (
                <div>
                    <div className="text-[10px] text-slate-600 mb-1.5 uppercase tracking-wide">Currently excluded</div>
                    <div className="flex flex-wrap gap-1.5">
                        {[...excluded]
                            .map(uniqueName => allMods.find(mod => mod.uniqueName === uniqueName) ?? null)
                            .filter((mod): mod is ModEntry => !!mod)
                            .filter(mod => !query || getBuilderDisplayModName(mod).toLowerCase().includes(query.toLowerCase()))
                            .map(mod => (
                            <button key={mod.uniqueName} onClick={() => onToggle(mod.uniqueName)}
                                className="rounded-full px-2.5 py-0.5 text-[10px] border border-red-700/60 bg-red-950/30 text-red-300 hover:bg-red-900/40 transition-colors">
                                ✕ {getBuilderDisplayModName(mod)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {filteredAll.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                    {filteredAll.map(m => (
                        <button key={m.uniqueName} onClick={() => onToggle(m.uniqueName)}
                            className={["w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-800/50",
                                excluded.has(m.uniqueName) ? "text-red-300 bg-red-950/10" : "text-slate-300"].join(" ")}>
                            <span className="w-4 shrink-0 text-center">{excluded.has(m.uniqueName) ? "✕" : "+"}</span>
                            {m.polarity && <PolarityIcon polarity={m.polarity} className="w-3 h-3 opacity-50 shrink-0" />}
                            <span className="flex-1 truncate">{getBuilderDisplayModName(m)}</span>
                            <span className="text-slate-600 ml-auto shrink-0 truncate max-w-[120px]">{m.statsLabel.slice(0, 24)}</span>
                        </button>
                    ))}
                </div>
            )}
            {!query && excluded.size === 0 && (
                <div className="text-[11px] text-slate-600 text-center py-1">Search above to exclude mods from the optimizer.</div>
            )}
        </WorkspacePanel>
    );
}

// ── Saved Builds ──────────────────────────────────────────────────────────────

function SavedBuildsPanel({ weapon, selectedAttackIdx, scoreUnavailable, scoreUnavailableReason, targetHasOverguard, availableMods, currentSlots, currentRanks, currentPolarities, currentCfg,
    stanceMod, stanceRank, stancePol, exilusMod, exilusPol, arcane1, arcane1Rank, hasExilus,
    targetFaction, conditionalState, targetProfileOverride, plannerConfig, onLoad }: {
    weapon: WeaponEntry | null;
    selectedAttackIdx: number;
    scoreUnavailable: boolean;
    scoreUnavailableReason?: string;
    targetHasOverguard: boolean;
    availableMods: ModEntry[];
    currentSlots: (ModEntry | null)[]; currentRanks: number[]; currentPolarities: string[];
    currentCfg: BuildCfg;
    stanceMod: ModEntry | null; stanceRank: number; stancePol: string;
    exilusMod: ModEntry | null; exilusPol: string;
    arcane1: ArcaneEntry | null; arcane1Rank: number;
    hasExilus: boolean;
    targetFaction: string;
    conditionalState: ConditionalState;
    targetProfileOverride?: TargetProfileOverride;
    plannerConfig: SavedBuildPlannerConfig;
    onLoad: (b: SavedBuild) => void;
}) {
    const savedBuilds  = useTrackerStore(s => s.state.modBuilder?.savedBuilds ?? EMPTY_SAVED_BUILDS);
    const saveModBuild = useTrackerStore(s => s.saveModBuild);
    const deleteBuild  = useTrackerStore(s => s.deleteModBuild);
    const allMods      = useMemo(() => availableMods, [availableMods]);
    const panelArcanes = useMemo(() => weapon ? getArcanesForWeapon(weapon) : [], [weapon]);
    const [saveName, setSaveName] = useState("");
    const [saving, setSaving]     = useState(false);
    const [comparing, setComparing] = useState<Set<string>>(new Set());

    function handleSave() {
        if (!weapon || !saveName.trim()) return;
        saveModBuild({
            id: uid(), name: saveName.trim(),
            weaponUniqueName: weapon.uniqueName, weaponName: getWeaponDisplayName(weapon),
            slotModUniqueNames: currentSlots.map(m => m?.uniqueName ?? ""),
            slotRanks: [...currentRanks],
            stanceModUniqueName: stanceMod?.uniqueName,
            stanceRank,
            stancePol,
            slotPolarities: [...currentPolarities],
            weaponRank: currentCfg.weaponRank, hasCatalyst: currentCfg.hasCatalyst,
            valenceBonusPct: weapon.isProgenitorWeapon ? currentCfg.valenceBonusPct : undefined,
            valenceElement: weapon.isProgenitorWeapon ? currentCfg.valenceElement : undefined,
            optimizeValenceElement: weapon.isProgenitorWeapon ? currentCfg.optimizeValenceElement : undefined,
            incarnonUnlockedTier: getIncarnonRecordForWeapon(weapon) ? getHighestSelectedIncarnonTier(currentCfg.incarnonSelectedOptionsByTier) : undefined,
            incarnonSelectedOptionsByTier: getIncarnonRecordForWeapon(weapon) ? currentCfg.incarnonSelectedOptionsByTier : undefined,
            optimizeIncarnonSelections: getIncarnonRecordForWeapon(weapon) ? currentCfg.optimizeIncarnonSelections : undefined,
            hasExilus,
            exilusModUniqueName: exilusMod?.uniqueName,
            exilusPol,
            arcane1UniqueName: arcane1?.uniqueName, arcane1Rank,
            plannerConfig,
            createdAt: new Date().toISOString(),
        });
        setSaveName(""); setSaving(false);
    }

    const thisWeapon = savedBuilds.filter(b => weapon && b.weaponUniqueName === weapon.uniqueName);
    const others     = savedBuilds.filter(b => !weapon || b.weaponUniqueName !== weapon.uniqueName);
    const comparedBuilds = thisWeapon.filter(b => comparing.has(b.id));

    function toggleCompare(id: string) {
        setComparing(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function buildSavedBuildEffects(build: SavedBuild): (ModEffect | null)[] {
        const effects: (ModEffect | null)[] = [];
        for (let i = 0; i < build.slotModUniqueNames.length; i++) {
            const uniqueName = build.slotModUniqueNames[i];
            if (!uniqueName) continue;
            const mod = allMods.find(m => m.uniqueName === uniqueName) ?? null;
            if (!mod) continue;
            const rank = build.slotRanks?.[i] ?? mod.fusionLimit;
            effects.push(mod.effectsByRank[rank] ?? mod.effect);
        }
        if (build.stanceModUniqueName) {
            const mod = allMods.find(m => m.uniqueName === build.stanceModUniqueName) ?? null;
            if (mod) {
                const rank = build.stanceRank ?? mod.fusionLimit;
                effects.push(mod.effectsByRank[rank] ?? mod.effect);
            }
        }
        if (build.hasExilus && build.exilusModUniqueName) {
            const mod = allMods.find(m => m.uniqueName === build.exilusModUniqueName) ?? null;
            if (mod) {
                const rank = build.exilusRank ?? mod.fusionLimit;
                effects.push(mod.effectsByRank[rank] ?? mod.effect);
            }
        }
        if (build.arcane1UniqueName) {
            const arcane = panelArcanes.find(a => a.uniqueName === build.arcane1UniqueName) ?? null;
            if (arcane) {
                const rank = build.arcane1Rank ?? arcane.maxRank;
                const ae = getArcaneEffectAtRank(arcane, rank, build.plannerConfig?.warframeArmor, true, {
                    warframeMaxEnergy: build.plannerConfig?.warframeMaxEnergy,
                    warframeEnergyPercent: build.plannerConfig?.warframeEnergyPercent,
                });
                if (ae) effects.push({
                    ...emptyEffect(),
                    ...ae,
                    conditionalEffects: [...(ae.conditionalEffects ?? [])],
                });
            }
        }
        return effects;
    }

    function buildCfgFromSavedBuild(build: SavedBuild): BuildCfg {
        const selectedOptionsByTier = build.incarnonSelectedOptionsByTier ?? currentCfg.incarnonSelectedOptionsByTier;
        return {
            weaponRank: build.weaponRank,
            hasCatalyst: build.hasCatalyst,
            masteryRank: currentCfg.masteryRank,
            valenceBonusPct: build.valenceBonusPct ?? currentCfg.valenceBonusPct,
            valenceElement: (build.valenceElement as ValenceElement | undefined) ?? currentCfg.valenceElement,
            optimizeValenceElement: build.optimizeValenceElement ?? false,
            incarnonUnlockedTier: getHighestSelectedIncarnonTier(selectedOptionsByTier) || build.incarnonUnlockedTier || currentCfg.incarnonUnlockedTier,
            incarnonSelectedOptionsByTier: selectedOptionsByTier,
            optimizeIncarnonSelections: build.optimizeIncarnonSelections ?? false,
        };
    }

    function comparisonRows(
        stats: ReturnType<typeof calculateBuild>,
        finiteStats: ReturnType<typeof calculateBuild> = stats,
        sentientIncisionUnsupportedTarget = false,
    ) {
        const category = weapon?.category ?? "Primary";
        const avgDamageLabel = averageDamageLabel(category);
        const rateLabel = actionRateLabel(category);
        const targetDamageUnavailable = scoreUnavailable || sentientIncisionUnsupportedTarget;
        const sentientIncisionTimelineLimited = targetHasOverguard && stats.modded.sentientIncisionDamageBonus > 0;
        const sustainedUnavailable = targetDamageUnavailable || sentientIncisionTimelineLimited;
        const rows: Array<[string, string]> = [
            ["Burst DPS", targetDamageUnavailable ? "Unavailable" : fmt(stats.burstDPS)],
            ["Sustained DPS", sustainedUnavailable ? "Unavailable" : fmt(finiteStats.sustainedDPS)],
            [targetDamageUnavailable ? `Reference ${avgDamageLabel}` : avgDamageLabel, fmt(stats.modded.averageShotDamage)],
            [targetDamageUnavailable ? "Reference Arsenal Total" : "Arsenal Total", fmt(stats.modded.arsenalDamage)],
            ["Crit Chance", `${fmt(stats.modded.critChance * 100, 1)}%`],
            ["Crit Mult", `${fmt(stats.modded.critMultiplier, 2)}x`],
            ["Crit Tier", `${fmt(stats.modded.averageCritTier, 2)}x`],
            ["Status", `${fmt(stats.modded.statusChance * 100, 1)}%`],
            ["Multishot", fmt(stats.modded.multishot, 2)],
            [rateLabel, fmt(stats.modded.fireRate, 2)],
            ["Avg Procs", fmt(stats.modded.averageProcsPerShot, 2)],
            ["DoT DPS", sustainedUnavailable ? "Unavailable" : fmt(finiteStats.modded.dotDps)],
        ];
        if (stats.modded.strainInfectionCritDamageBonus > 0) {
            rows.push(["Burst cyst assumption", `${stats.modded.strainInfectionCystsAtImpact}/8 at impact`]);
        }
        if (stats.modded.dreadfulKillshotBonus > 0) {
            rows.push(["Dreadful Killshot Burst bonus", `+${fmt(stats.modded.dreadfulKillshotBonus * 100, 0)}% at ${fmt(stats.modded.dreadfulKillshotCurrentHealth)} current Health`]);
        }
        if (stats.modded.deadlyManeuversHeadshotCritChanceBonus > 0) {
            rows.push(["Deadly Maneuvers Burst snapshot", `${stats.modded.deadlyManeuversShotsRemaining} buffed shot(s), ×${fmt(1 + stats.modded.deadlyManeuversHeadshotCritChanceBonus, 0)} headshot Critical Chance`]);
        }
        if (stats.modded.criticalPrecisionCritChanceBonus > 0) {
            rows.push(["Critical Precision Burst snapshot", `${stats.modded.criticalPrecisionHeadshotProjectiles} prior headshot projectiles, +${fmt(stats.modded.criticalPrecisionCritChanceBonus * 100, 1)}% base Critical Chance`]);
        }
        if (stats.modded.unseenDreadCritDamageBonus > 0) {
            rows.push(["Unseen Dread Burst snapshot", `invisible, +${fmt(stats.modded.unseenDreadCritDamageBonus * 100, 0)}% Critical Damage`]);
        }
        for (const [key, value] of Object.entries(stats.modded.rawDamageBreakdown)) {
            if ((value ?? 0) > 0) rows.push([key[0].toUpperCase() + key.slice(1), fmt(value ?? 0, 1)]);
        }
        return rows;
    }

    function sentientIncisionModelNote(
        stats: ReturnType<typeof calculateBuild>,
        unsupportedTarget = false,
    ): string | null {
        if (unsupportedTarget) {
            return "Sentient Incision has no supported target faction or active Overguard to select its adaptive element; this build's damage scores are unavailable.";
        }
        return targetHasOverguard && stats.modded.sentientIncisionDamageBonus > 0
            ? "Burst uses the initial Corrosive snapshot. Sustained and DoT scores are unavailable because the element changes when Overguard breaks."
            : null;
    }

    return (
        <WorkspacePanel className="space-y-3 p-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Saved Builds</div>
                {weapon && <button onClick={() => setSaving(v => !v)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">{saving ? "Cancel" : "+ Save current"}</button>}
            </div>
            {scoreUnavailable && scoreUnavailableReason && (
                <p role="note" className="text-[10px] leading-relaxed text-amber-300">
                    Saved-build comparison scores are unavailable: {scoreUnavailableReason}
                </p>
            )}
            {saving && (
                <div className="flex gap-2">
                    <input type="text" placeholder="Build name…" value={saveName} onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
                    <button onClick={handleSave} disabled={!saveName.trim()}
                        className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">Save</button>
                </div>
            )}
            {comparedBuilds.length > 1 && weapon && (
                <div className="rounded-xl border border-blue-900/40 bg-blue-950/10 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-blue-300 mb-2">Side-by-side comparison</div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${comparedBuilds.length}, minmax(0, 1fr))` }}>
                        {comparedBuilds.map(b => {
                            const buildCfg = buildCfgFromSavedBuild(b);
                            const weaponState = applyWeaponConfig(weapon, selectedAttackIdx, buildCfg);
                            const effects = [...weaponState.activeIncarnonEffects, ...buildSavedBuildEffects(b)];
                            const hasSentientIncision = effects.some((effect) => (effect?.sentientIncisionDamageBonus ?? 0) > 0);
                            const sentientIncisionUnsupportedTarget = hasSentientIncision &&
                                weaponState.selectedWeapon.selectedAttackUsesSlamDamageBonus !== true &&
                                !getSentientIncisionDamageType(targetFaction, targetHasOverguard);
                            const options = { conditionalState, isEximusTarget: targetProfileOverride?.isEximusTarget, targetHasOverguard: getTargetProfileAssumptions(targetFaction, targetProfileOverride).overguard > 0, statusImmuneTypes: targetProfileOverride?.statusImmuneTypes, statusStackCaps: targetProfileOverride?.statusStackCaps, hitLocation: getTargetHitLocationProfile(targetFaction, targetProfileOverride) };
                            const stats = calculateBuild(
                                weaponState.selectedWeapon,
                                effects,
                                targetFaction,
                                options,
                            );
                            const finiteStats = hasBurstOnlyConditionalAssumption(conditionalState)
                                ? calculateBuild(weaponState.selectedWeapon, effects, targetFaction, {
                                    ...options,
                                    conditionalState: withoutBurstOnlyConditionalAssumptions(conditionalState) ?? conditionalState,
                                })
                                : stats;
                            return (
                                <div key={b.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                                    <div className="text-xs font-semibold text-slate-100">{b.name}</div>
                                    {sentientIncisionModelNote(stats, sentientIncisionUnsupportedTarget) && (
                                        <p role="note" className="text-[10px] leading-relaxed text-amber-300">{sentientIncisionModelNote(stats, sentientIncisionUnsupportedTarget)}</p>
                                    )}
                                    <div className="space-y-1">
                                        {comparisonRows(stats, finiteStats, sentientIncisionUnsupportedTarget).map(([lbl, val]) => (
                                            <div key={lbl} className="flex justify-between gap-2 text-[11px]">
                                                <span className="text-slate-500">{lbl}</span>
                                                <span className="font-mono text-slate-200 text-right">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {savedBuilds.length === 0 && <div className="text-[11px] text-slate-600 text-center py-2">No saved builds yet.</div>}
            {thisWeapon.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">This weapon</div>
                    {thisWeapon.map(b => {
                        const stats = weapon ? (() => {
                            const buildCfg = buildCfgFromSavedBuild(b);
                            const weaponState = applyWeaponConfig(weapon, selectedAttackIdx, buildCfg);
                            const effects = [...weaponState.activeIncarnonEffects, ...buildSavedBuildEffects(b)];
                            const hasSentientIncision = effects.some((effect) => (effect?.sentientIncisionDamageBonus ?? 0) > 0);
                            const sentientIncisionUnsupportedTarget = hasSentientIncision &&
                                weaponState.selectedWeapon.selectedAttackUsesSlamDamageBonus !== true &&
                                !getSentientIncisionDamageType(targetFaction, targetHasOverguard);
                            const options = { conditionalState, isEximusTarget: targetProfileOverride?.isEximusTarget, targetHasOverguard: getTargetProfileAssumptions(targetFaction, targetProfileOverride).overguard > 0, statusImmuneTypes: targetProfileOverride?.statusImmuneTypes, statusStackCaps: targetProfileOverride?.statusStackCaps, hitLocation: getTargetHitLocationProfile(targetFaction, targetProfileOverride) };
                            const result = calculateBuild(weaponState.selectedWeapon, effects, targetFaction, options);
                            const finiteResult = hasBurstOnlyConditionalAssumption(conditionalState)
                                ? calculateBuild(weaponState.selectedWeapon, effects, targetFaction, {
                                    ...options,
                                    conditionalState: withoutBurstOnlyConditionalAssumptions(conditionalState) ?? conditionalState,
                                })
                                : result;
                            return { result, finiteResult, sentientIncisionUnsupportedTarget };
                        })() : null;
                        return (
                            <div key={b.id} className={["rounded-lg border px-3 py-2",
                                comparing.has(b.id) ? "border-blue-700/50 bg-blue-950/10" : "border-slate-800 bg-slate-900/40"].join(" ")}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-200 truncate">{b.name}</div>
                                        <div className="text-[10px] text-slate-500">
                                            {b.slotModUniqueNames.filter(Boolean).length} mods · Rank {b.weaponRank}
                                            {b.hasCatalyst ? " · ◈" : ""}
                                            {b.hasExilus ? " · Exilus" : ""}
                                            {b.arcane1UniqueName ? " · Arcane" : ""}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => toggleCompare(b.id)}
                                            className={["text-[10px] px-2 py-1 rounded border transition-colors",
                                                comparing.has(b.id) ? "border-blue-600 bg-blue-900/40 text-blue-300" : "border-slate-700 text-slate-400 hover:text-slate-200"].join(" ")}>
                                            {comparing.has(b.id) ? "Selected" : "Compare"}
                                        </button>
                                        <button onClick={() => onLoad(b)} className="text-[10px] px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">Load</button>
                                        <button onClick={() => deleteBuild(b.id)} className="text-[10px] text-slate-700 hover:text-red-400 transition-colors px-1">✕</button>
                                    </div>
                                </div>
                                {comparing.has(b.id) && stats && (
                                    <>
                                        {sentientIncisionModelNote(stats.result, stats.sentientIncisionUnsupportedTarget) && (
                                            <p role="note" className="mt-2 text-[10px] leading-relaxed text-amber-300">{sentientIncisionModelNote(stats.result, stats.sentientIncisionUnsupportedTarget)}</p>
                                        )}
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-slate-800/60">
                                            {comparisonRows(stats.result, stats.finiteResult, stats.sentientIncisionUnsupportedTarget).slice(0, 12).map(([lbl, val]) => (
                                                <div key={lbl} className="flex items-center justify-between gap-2 text-[10px]">
                                                    <div className="text-slate-600">{lbl}</div>
                                                    <div className="font-mono text-blue-300 text-right">{val}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {others.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Other weapons</div>
                    {others.map(b => (
                        <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200 truncate">{b.name}</div>
                                <div className="text-[10px] text-slate-500">{b.weaponName} · {b.slotModUniqueNames.filter(Boolean).length} mods</div>
                            </div>
                            <button onClick={() => deleteBuild(b.id)} className="text-[10px] text-slate-700 hover:text-red-400 transition-colors px-1 shrink-0">✕</button>
                        </div>
                    ))}
                </div>
            )}
        </WorkspacePanel>
    );
}

// ── Owned Mods ────────────────────────────────────────────────────────────────

function OwnedModsPanel({ availableMods }: { availableMods: ModEntry[] }) {
    const inventoryCounts = useTrackerStore(s => s.state.inventory.counts ?? EMPTY_COUNTS);
    const inventoryModRanks = useTrackerStore(s => s.state.inventory.modRanks ?? EMPTY_MOD_RANKS);
    const setCount = useTrackerStore(s => s.setCount);
    const setModRank = useTrackerStore(s => s.setModRank);
    const [query, setQuery] = useState("");
    const allMods = useMemo(() => sortBuilderModsForDisplay(availableMods.filter(m => m.compatBucket !== "Riven")), [availableMods]);
    const ownedCountForMod = (path: string) => inventoryCounts[`mods:${path}`] ?? inventoryCounts[path] ?? 0;
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return allMods.filter(m => !q || getBuilderDisplayModName(m).toLowerCase().includes(q));
    }, [allMods, query]);

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Owned Mods</div>
                <div className="flex gap-3 text-[10px]">
                    <button onClick={() => allMods.forEach(m => { setCount(`mods:${m.path}`, 1); setModRank(m.path, m.fusionLimit); })} className="text-slate-400 hover:text-slate-200">All</button>
                    <button onClick={() => allMods.forEach(m => { setCount(`mods:${m.path}`, 0); setModRank(m.path, 0); })} className="text-slate-400 hover:text-slate-200">None</button>
                    <span className="text-slate-600">{allMods.filter(m => Number(ownedCountForMod(m.path)) > 0).length}/{allMods.length} owned</span>
                </div>
            </div>
            <input type="text" placeholder="Filter mods…" value={query} onChange={e => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                {filtered.map(m => (
                    <label key={m.uniqueName} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/40 cursor-pointer">
                        <input type="checkbox" checked={Number(ownedCountForMod(m.path)) > 0}
                            onChange={() => {
                                const nextOwned = Number(ownedCountForMod(m.path)) > 0 ? 0 : 1;
                                setCount(`mods:${m.path}`, nextOwned);
                                setModRank(m.path, nextOwned > 0 ? m.fusionLimit : 0);
                            }}
                            className="accent-blue-500 shrink-0" />
                        <span className="shrink-0">
                            {m.polarity ? <PolarityIcon polarity={m.polarity} className="w-3.5 h-3.5 opacity-60" /> : <span className="text-slate-700 text-xs">○</span>}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-200 truncate">{getBuilderDisplayModName(m)}</div>
                            {m.statsLabel && <div className="text-[10px] text-slate-500 truncate">{m.statsLabel}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.preventDefault()}>
                            <button
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                disabled={Number(ownedCountForMod(m.path)) <= 0 || getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) <= 0}
                                onClick={() => setModRank(m.path, Math.max(0, getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) - 1))}
                            >−</button>
                            <span className={["w-8 text-center text-[10px] font-mono", Number(ownedCountForMod(m.path)) > 0 ? "text-emerald-400" : "text-slate-600"].join(" ")}>
                                R{getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks)}
                            </span>
                            <button
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                disabled={Number(ownedCountForMod(m.path)) <= 0 || getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) >= m.fusionLimit}
                                onClick={() => setModRank(m.path, Math.min(m.fusionLimit, getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) + 1))}
                            >+</button>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}

function OwnedArcanesPanel({ weapon }: { weapon: WeaponEntry | null }) {
    const inventoryArcaneRanks = useTrackerStore(s => s.state.inventory.arcaneRanks ?? EMPTY_ARCANE_RANKS);
    const inventoryCounts = useTrackerStore(s => s.state.inventory.counts ?? EMPTY_COUNTS);
    const setArcaneRankCount = useTrackerStore(s => s.setArcaneRankCount);
    const [query, setQuery] = useState("");
    const allArcanes = useMemo(() => weapon ? getArcanesForWeapon(weapon) : [], [weapon]);
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return allArcanes.filter(a => !q || a.name.toLowerCase().includes(q));
    }, [allArcanes, query]);

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Owned Arcanes</div>
                <div className="text-[10px] text-slate-500">Shared with Mods &amp; Arcanes inventory</div>
            </div>
            <input type="text" placeholder="Filter arcanes…" value={query} onChange={e => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                {filtered.map(arcane => {
                    const rankCounts = inventoryArcaneRanks[arcane.uniqueName] ?? {};
                    const fallbackCount = Number(inventoryCounts[`mods:${arcane.uniqueName}`] ?? inventoryCounts[arcane.uniqueName] ?? 0);
                    const highestOwnedRank = getHighestOwnedArcaneRankWithFallback(rankCounts, fallbackCount);
                    return (
                        <div key={arcane.uniqueName} className="px-3 py-3 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-200 truncate">{arcane.name}</div>
                                    <div className="text-[10px] text-slate-500">{highestOwnedRank === null ? "Not owned" : `Highest owned rank: R${highestOwnedRank}`}</div>
                                </div>
                                <div className="shrink-0 text-[10px] text-slate-500">{arcane.rarity}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Array.from({ length: arcane.maxRank + 1 }, (_, rank) => {
                                    const isSelected = highestOwnedRank === rank;
                                    return (
                                        <button
                                            key={rank}
                                            className={[
                                                "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                                                isSelected
                                                    ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-200"
                                                    : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60",
                                            ].join(" ")}
                                            onClick={() => setArcaneRankCount(arcane.uniqueName, rank, isSelected ? 0 : 1)}
                                        >
                                            R{rank}
                                        </button>
                                    );
                                })}
                                <button
                                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                    onClick={() => setArcaneRankCount(arcane.uniqueName, 0, 0)}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface BuildCfg {
    weaponRank: number;
    hasCatalyst: boolean;
    masteryRank: number;
    valenceBonusPct: number;
    valenceElement: ValenceElement;
    optimizeValenceElement: boolean;
    incarnonUnlockedTier: number;
    incarnonSelectedOptionsByTier: Partial<Record<IncarnonTier, string>>;
    optimizeIncarnonSelections: boolean;
}

type DragSlotKind = "main" | "exilus";
type OptimizeMode = "optimize" | "fill";

interface DragSlotRef {
    kind: DragSlotKind;
    index: number;
}

function maxOptimizerFormaForWeapon(weapon: WeaponEntry | null) {
    if (!weapon) return 9;
    return supportsStanceLikeMods(weapon) ? 10 : 9;
}

export default function ModBuilder() {
    const masteryRank      = useTrackerStore(s => s.state.player.masteryRank) ?? 0;
    const inventoryArcaneRanks = useTrackerStore(s => s.state.inventory.arcaneRanks ?? EMPTY_ARCANE_RANKS);
    const inventoryCounts = useTrackerStore(s => s.state.inventory.counts ?? EMPTY_COUNTS);
    const inventoryModRanks = useTrackerStore(s => s.state.inventory.modRanks ?? EMPTY_MOD_RANKS);
    const inventoryCustomRivens = useTrackerStore(s => s.state.inventory.customRivens ?? EMPTY_CUSTOM_RIVENS);

    const [weapon, setWeapon]          = useState<WeaponEntry | null>(null);
    const [slots, setSlots]            = useState<(ModEntry | null)[]>(Array(SLOT_COUNT).fill(null));
    const [ranks, setRanks]            = useState<number[]>(Array(SLOT_COUNT).fill(0));
    const [slotPols, setSlotPols]      = useState<string[]>(Array(SLOT_COUNT).fill(""));
    const [stanceMod, setStanceMod]    = useState<ModEntry | null>(null);
    const [stanceRank, setStanceRank]  = useState(0);
    const [stancePol, setStancePol]    = useState("");
    const meleeDpsInputs = useMemo(() => getWikiMeleeStanceCombo(stanceMod?.name), [stanceMod?.name]);
    // Exilus
    const [hasExilus, setHasExilus]    = useState(false);
    const [exilusMod, setExilusMod]    = useState<ModEntry | null>(null);
    const [exilusRank, setExilusRank]  = useState(0);
    const [exilusPol, setExilusPol]    = useState("");
    // Arcanes — weapons only have 1 arcane slot
    const [arcane1, setArcane1]        = useState<ArcaneEntry | null>(null);
    const [arcane1Rank, setArcane1Rank]= useState(0);
    const [includeArcaneStats, setIncludeArcaneStats] = useState(true);
    const [warframeArmorInput, setWarframeArmorInput] = useState("");
    const warframeArmor = parseWarframeArmorInput(warframeArmorInput);
    const [warframeMaxEnergyInput, setWarframeMaxEnergyInput] = useState("");
    const [warframeEnergyPercentInput, setWarframeEnergyPercentInput] = useState("");
    const warframeMaxEnergy = parseWarframeMaxEnergyInput(warframeMaxEnergyInput);
    const warframeEnergyPercent = parseWarframeEnergyPercentInput(warframeEnergyPercentInput);
    const arcaneEnergyContext = useMemo(() => ({ warframeMaxEnergy, warframeEnergyPercent }), [warframeMaxEnergy, warframeEnergyPercent]);
    // Attack mode selection
    const [selectedAttackIdx, setSelectedAttackIdx] = useState(0);
    // Excluded
    const [excluded, setExcluded]      = useState<Set<string>>(new Set());
    // Build config
    const [buildCfg, setBuildCfg]      = useState<BuildCfg>({
        weaponRank: 30,
        hasCatalyst: false,
        masteryRank,
        valenceBonusPct: 0.25,
        valenceElement: "heat",
        optimizeValenceElement: false,
        incarnonUnlockedTier: 0,
        incarnonSelectedOptionsByTier: {},
        optimizeIncarnonSelections: false,
    });
    // Optimizer
    const [goal, setGoal]              = useState<OptimizeGoal>("burst");
    const meleeDpsGoalAvailable = Boolean(
        weapon &&
        usesMeleeDamageModel(weapon.category) &&
        meleeDpsInputs &&
        (!weapon.attacks.length || weapon.attacks[selectedAttackIdx]?.name.toLowerCase().includes("normal attack")),
    );
    useEffect(() => {
        if (goal === "meleeDps" && weapon && !meleeDpsGoalAvailable) setGoal("burst");
    }, [goal, weapon, meleeDpsGoalAvailable]);
    const [conditionalMode, setConditionalMode] = useState<ConditionalState["mode"]>("realistic");
    const [externalConditionalStacks, setExternalConditionalStacks] = useState(1);
    const [externalStatusTypeCount, setExternalStatusTypeCount] = useState(0);
    const [externalVigilanteSetModCount, setExternalVigilanteSetModCount] = useState(0);
    const [externalGladiatorSetModCount, setExternalGladiatorSetModCount] = useState(0);
    const [externalNiraSetModCount, setExternalNiraSetModCount] = useState(0);
    const [strainInfectionCystsAtImpact, setStrainInfectionCystsAtImpact] = useState(0);
    const [dreadfulKillshotCurrentHealth, setDreadfulKillshotCurrentHealth] = useState(0);
    const [deadlyManeuversShotsRemaining, setDeadlyManeuversShotsRemaining] = useState(0);
    const [criticalPrecisionHeadshotProjectiles, setCriticalPrecisionHeadshotProjectiles] = useState(0);
    const [unseenDreadInvisibilityActive, setUnseenDreadInvisibilityActive] = useState(false);
    const [externalStatusTypes, setExternalStatusTypes] = useState<ExternalStatusType[]>([]);
    const [externalStatusTypesOpen, setExternalStatusTypesOpen] = useState(false);
    const [targetStartsWithHeat, setTargetStartsWithHeat] = useState(false);
    const [externalHeatElementalDamageBonusPercentInput, setExternalHeatElementalDamageBonusPercentInput] = useState("0");
    const [externalHeatFactionDamageBonusPercentInput, setExternalHeatFactionDamageBonusPercentInput] = useState("0");
    const [playerSlidingAtImpact, setPlayerSlidingAtImpact] = useState(false);
    const [meleeComboMultiplier, setMeleeComboMultiplier] = useState(1);
    const [tennokaiRegularHitsBetweenHeavy, setTennokaiRegularHitsBetweenHeavy] = useState(4);
    const [phantasmaChargeAmmo, setPhantasmaChargeAmmo] = useState(2);
    const [targetDistanceMeters, setTargetDistanceMeters] = useState<number | undefined>(undefined);
    const [attackFalloffDistanceMeters, setAttackFalloffDistanceMeters] = useState<number | undefined>(undefined);
    const [targetRadiusMeters, setTargetRadiusMeters] = useState<number | undefined>(undefined);
    const [overpressuredRoundsSpreadMinimumDegrees, setOverpressuredRoundsSpreadMinimumDegrees] = useState<number | undefined>(undefined);
    const [overpressuredRoundsSpreadMaximumDegrees, setOverpressuredRoundsSpreadMaximumDegrees] = useState<number | undefined>(undefined);
    const selectedFalloffAttack = weapon?.attacks[selectedAttackIdx];
    const linkedFalloffAttack = selectedFalloffAttack?.lingeringDamageRule
        ? weapon?.attacks.find((attack) => attack.name.trim().toLowerCase() ===
            selectedFalloffAttack.lingeringDamageRule?.componentAttackName.trim().toLowerCase())
        : undefined;
    const falloffRelevantAttacks = [selectedFalloffAttack, linkedFalloffAttack].filter((attack) =>
        Boolean(attack?.damageFalloff || attack?.maximumRangeMeters !== undefined || attack?.pelletSpreadCone),
    );
    const mausolonRangeNote = weapon?.name === "Mausolon" && selectedFalloffAttack
        ? selectedFalloffAttack.name === "Auto"
            ? weapon.variantLabel === "Archwing"
                ? "Archwing Auto lists both a 300 m hit-scan range and a 1,400–2,800 m falloff curve. These Wiki values conflict; this calculator applies the falloff curve and leaves 300 m informational pending direct verification."
                : weapon.variantLabel === "Atmosphere"
                    ? "Atmosphere Auto lists a 300 m hit-scan range and no direct falloff curve. Following the Wiki Range and Hitscan definitions, this profile treats attacks beyond 300 m as misses."
                    : undefined
            : selectedFalloffAttack.name === "Charged Shot Laser"
                ? "Both Mausolon profiles list a 300 m hit-scan range for this Laser and no direct falloff curve; the planner treats attacks beyond 300 m as misses."
                : undefined
        : undefined;
    const supportsKineticKiller = Boolean(getIncarnonRecordForWeapon(weapon)?.tiers.some((tier) =>
        tier.options.some((option) => option.id === "tier-4-kinetic-killer"),
    ));
    const meleeDpsModelNote = weapon && usesMeleeDamageModel(weapon.category)
        ? "Default burst and sustained DPS remain attack-rate estimates. The combo scenario scales Blood Rush, Weeping Wounds, and selected heavy-attack damage. The stats panel projects one-hit Heavy Attack Efficiency retention. Direct-hit TTK steps repeated Heavy Attacks and restores Initial Combo at 40 points/s; it still excludes attack-generated combo, Tennokai, stance sequences, and heavy-attack wind-up. DPS, finite status encounter, and optimizer scoring hold the entered tier across each scored hit. Stance DPS uses the selected stance's Wiki Neutral combo, including its direct and forced-Slash multipliers; Wiki timings are approximate and its comparison formula omits combo physical-damage bonuses."
        : "";
    const maxMeleeComboMultiplier = weapon ? getMeleeComboRules(weapon).maxMultiplier : 12;
    useEffect(() => {
        if (weapon) setMeleeComboMultiplier((current) => clampMeleeComboMultiplier(weapon, current));
    }, [weapon]);
    const conditionalState = useMemo<ConditionalState>(() => ({
        mode: conditionalMode,
        externalStacks: conditionalMode === "custom" ? externalConditionalStacks : undefined,
        externalStatusTypeCount,
        externalVigilanteSetModCount,
        externalGladiatorSetModCount,
        externalNiraSetModCount,
        strainInfectionCystsAtImpact,
        dreadfulKillshotCurrentHealth,
        deadlyManeuversShotsRemaining,
        criticalPrecisionHeadshotProjectiles,
        unseenDreadInvisibilityActive,
        externalStatusTypes,
        externalHeatStatusPresenceProbability: targetStartsWithHeat ? 1 : 0,
        externalHeatElementalDamageBonus: parseExternalHeatBonusPercentInput(externalHeatElementalDamageBonusPercentInput) / 100,
        externalHeatFactionDamageBonus: parseExternalHeatBonusPercentInput(externalHeatFactionDamageBonusPercentInput) / 100,
        playerSlidingAtImpact: supportsKineticKiller && playerSlidingAtImpact,
        meleeComboMultiplier,
        tennokaiRegularHitsBetweenHeavy,
        phantasmaChargeAmmo,
        targetDistanceMeters,
        attackFalloffDistanceMeters,
        targetRadiusMeters,
    }), [conditionalMode, externalConditionalStacks, externalStatusTypeCount, externalVigilanteSetModCount, externalGladiatorSetModCount, externalNiraSetModCount, strainInfectionCystsAtImpact, dreadfulKillshotCurrentHealth, deadlyManeuversShotsRemaining, criticalPrecisionHeadshotProjectiles, unseenDreadInvisibilityActive, externalStatusTypes, targetStartsWithHeat, externalHeatElementalDamageBonusPercentInput, externalHeatFactionDamageBonusPercentInput, supportsKineticKiller, playerSlidingAtImpact, meleeComboMultiplier, tennokaiRegularHitsBetweenHeavy, phantasmaChargeAmmo, targetDistanceMeters, attackFalloffDistanceMeters, targetRadiusMeters]);
    const respectCap = true;
    const [allowNonMax, setAllowNonMax]  = useState(false);
    const [onlyOwned, setOnlyOwned]      = useState(false);
    const [factionOn, setFactionOn]      = useState(false);
    const [faction, setFaction]          = useState("Grineer");
    const [selectedEnemyProfileId, setSelectedEnemyProfileId] = useState("");
    const [useCustomTargetStats, setUseCustomTargetStats] = useState(false);
    const [headshotRatePercent, setHeadshotRatePercent] = useState(0);
    const [nearbyEnemyCount, setNearbyEnemyCount] = useState(0);
    const [nearbyGasOuterEnemyCount, setNearbyGasOuterEnemyCount] = useState(0);
    const [nearbyBlastEnemyCount, setNearbyBlastEnemyCount] = useState(0);
    const [isEximus, setIsEximus] = useState(false);
    const [bossBlastStackCap, setBossBlastStackCap] = useState(false);
    const [punctureVipStackCap, setPunctureVipStackCap] = useState(false);
    const [isSteelPath, setIsSteelPath] = useState(false);
    const [customTargetStats, setCustomTargetStats] = useState({ armor: 2700, health: 25000, shields: 0, overguard: 0 });
    const [scaleCustomTargetByLevel, setScaleCustomTargetByLevel] = useState(false);
    const [enemyScalingFaction, setEnemyScalingFaction] = useState<EnemyScalingFaction>("grineer");
    const [enemyBaseLevel, setEnemyBaseLevel] = useState(1);
    const [enemyCurrentLevel, setEnemyCurrentLevel] = useState(30);
    const [customToxinBypassesShields, setCustomToxinBypassesShields] = useState(true);
    const [enemyShieldGateHitMode, setEnemyShieldGateHitMode] = useState<"body" | "weakspot" | "blockedArea">("body");
    const [targetStatusImmunities, setTargetStatusImmunities] = useState<StatusDamageType[]>([]);
    const selectEnemyProfile = useCallback((profileId: string) => {
        const profile = getEnemyProfile(profileId);
        setSelectedEnemyProfileId(profile?.id ?? "");
        setIsEximus(false);
        setBossBlastStackCap(false);
        setPunctureVipStackCap(false);
        if (!profile) {
            setUseCustomTargetStats(false);
            return;
        }
        setFactionOn(true);
        setFaction(profile.faction);
        setUseCustomTargetStats(true);
        setCustomTargetStats({
            health: profile.health,
            shields: profile.shields,
            armor: profile.armor,
            overguard: profile.overguard,
        });
        setScaleCustomTargetByLevel(true);
        setEnemyScalingFaction(profile.scalingFaction);
        setEnemyBaseLevel(profile.baseLevel);
        setEnemyCurrentLevel(Math.max(30, profile.baseLevel));
        setCustomToxinBypassesShields(profile.toxinBypassesShields);
        setEnemyShieldGateHitMode("body");
        setTargetStatusImmunities([]);
    }, []);
    const resolvedCustomTargetStats = useMemo(() => {
        const effectiveLevel = getSteelPathEnemyLevel(enemyCurrentLevel, isSteelPath);
        if (!scaleCustomTargetByLevel) {
            return {
                ...customTargetStats,
                overguard: isEximus
                    ? scaleEnemyOverguard(EXIMUS_BASE_OVERGUARD, effectiveLevel)
                    : customTargetStats.overguard,
            };
        }
        const baseHealth = isEximus
            ? applyEximusHealthBaseAdjustment(
                customTargetStats.health,
                effectiveLevel,
                customTargetStats.shields > 0 || customTargetStats.armor > 0,
            )
            : customTargetStats.health;
        const baseShields = isEximus
            ? applyEximusShieldBaseAdjustment(customTargetStats.shields, effectiveLevel)
            : customTargetStats.shields;
        const health = scaleEnemyStat("health", baseHealth, enemyScalingFaction, enemyBaseLevel, effectiveLevel);
        const shields = scaleEnemyStat("shield", baseShields, enemyScalingFaction, enemyBaseLevel, effectiveLevel);
        return {
            health: applySteelPathStatMultiplier("health", health, isSteelPath),
            shields: applySteelPathStatMultiplier("shield", shields, isSteelPath),
            armor: scaleEnemyStat("armor", customTargetStats.armor, enemyScalingFaction, enemyBaseLevel, effectiveLevel),
            overguard: scaleEnemyOverguard(isEximus ? EXIMUS_BASE_OVERGUARD : customTargetStats.overguard, effectiveLevel),
        };
    }, [customTargetStats, scaleCustomTargetByLevel, enemyScalingFaction, enemyBaseLevel, enemyCurrentLevel, isEximus, isSteelPath]);
    const targetProfileOverride = useMemo<TargetProfileOverride | undefined>(() => {
        const selectedProfile = getEnemyProfile(selectedEnemyProfileId);
        if (!useCustomTargetStats) {
            if (!selectedProfile && (!factionOn || headshotRatePercent <= 0) && !isEximus) return undefined;
            return {
                headshotHitRate: factionOn ? headshotRatePercent / 100 : 0,
                isEximusTarget: isEximus,
                ...(selectedProfile ? {
                    headshotMultiplier: selectedProfile.headshotMultiplier,
                    criticalHeadshotMultiplier: selectedProfile.criticalHeadshotMultiplier,
                    headIsWeakPoint: selectedProfile.headIsWeakPoint,
                } : {}),
            };
        }
        const hasActiveOverguard = resolvedCustomTargetStats.overguard > 0;
        const statusStackCaps = {
            ...(bossBlastStackCap ? { blast: 4 } : {}),
            ...(punctureVipStackCap ? { puncture: 3 } : {}),
        };
        return {
            ...resolvedCustomTargetStats,
            headshotHitRate: factionOn ? headshotRatePercent / 100 : 0,
            isEximusTarget: isEximus,
            ...(selectedProfile ? {
                headshotMultiplier: selectedProfile.headshotMultiplier,
                criticalHeadshotMultiplier: selectedProfile.criticalHeadshotMultiplier,
                headIsWeakPoint: selectedProfile.headIsWeakPoint,
            } : {}),
            armorBaseValue: customTargetStats.armor,
            armorLevelMultiplier: scaleCustomTargetByLevel
                ? enemyStatLevelMultiplier(
                    "armor",
                    enemyScalingFaction,
                    enemyBaseLevel,
                    getSteelPathEnemyLevel(enemyCurrentLevel, isSteelPath),
                )
                : 1,
            description: isSteelPath
                ? `Steel Path: mission level ${enemyCurrentLevel} becomes ${getSteelPathEnemyLevel(enemyCurrentLevel, true)}; Health and Shields ×2.5, with no separate Armor multiplier.`
                : undefined,
            hasOverguard: hasActiveOverguard,
            crowdControlImmune: hasActiveOverguard,
            toxinBypassesShields: customToxinBypassesShields,
            enemyShieldGateHitMode,
            nearbyEnemyCount,
            nearbyGasOuterEnemyCount,
            nearbyBlastEnemyCount,
            // Cold's four-stack cap and crowd-control immunity follow active
            // Overguard; Radiation can apply but its effects remain suppressed.
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps,
        };
    }, [useCustomTargetStats, factionOn, headshotRatePercent, selectedEnemyProfileId, resolvedCustomTargetStats, customTargetStats.armor, scaleCustomTargetByLevel, enemyScalingFaction, enemyBaseLevel, customToxinBypassesShields, enemyShieldGateHitMode, nearbyEnemyCount, nearbyGasOuterEnemyCount, nearbyBlastEnemyCount, targetStatusImmunities, bossBlastStackCap, punctureVipStackCap, isSteelPath, enemyCurrentLevel, isEximus]);
    const targetHeadIsWeakPoint = getTargetProfileAssumptions(faction, targetProfileOverride).headIsWeakPoint;
    const [allowCatalyst, setAllowCatalyst] = useState(false);
    const [allowForma, setAllowForma]    = useState(false);
    const [maxFormaAllowed, setMaxFormaAllowed] = useState(9);
    const [optExilus, setOptExilus]      = useState(false);
    const [optArcane, setOptArcane]      = useState(false);
    const [showOptimizeOptions, setShowOptimizeOptions] = useState(false);
    // UI
    const [infoTab, setInfoTab]        = useState<"stats"|"why">("stats");
    const [reasoning, setReasoning]    = useState<BuildReasoning | null>(null);
    const [reasoningMath, setReasoningMath] = useState<BuildMathBreakdown | null>(null);
    const [reasoningContextAtOptimization, setReasoningContextAtOptimization] = useState<string | null>(null);
    const currentReasoningContextKey = useMemo(() => JSON.stringify({
        goal,
        conditionalState,
        selectedAttackIdx,
        targetFaction: factionOn ? faction : "",
        targetProfileOverride,
    }), [goal, conditionalState, selectedAttackIdx, factionOn, faction, targetProfileOverride]);
    const displayedReasoning = reasoningContextAtOptimization === currentReasoningContextKey ? reasoning : null;
    useEffect(() => {
        setReasoningMath(null);
    }, [meleeDpsInputs]);
    const [showMathWindow, setShowMathWindow] = useState(false);
    const [tab, setTab]                = useState<"build"|"saves"|"owned"|"ownedArcanes"|"exclude">("build");
    const [optimizing, setOptimizing]  = useState(false);
    const [optimizerProgress, setOptimizerProgress] = useState<string | null>(null);
    const [optimizerNotice, setOptimizerNotice] = useState<string | null>(null);
    const optimizerWorkerRef = useRef<Worker | null>(null);
    const pendingWorkerRejectRef = useRef<((reason?: unknown) => void) | null>(null);
    const optimizerRequestIdRef = useRef(0);
    const optimizerCancelledRef = useRef(false);
    const optimizerApplyingRef = useRef(false);
    const cancelOptimization = useCallback(() => {
        if (optimizerApplyingRef.current || (!optimizerWorkerRef.current && !optimizing)) return;
        optimizerCancelledRef.current = true;
        optimizerWorkerRef.current?.terminate();
        optimizerWorkerRef.current = null;
        pendingWorkerRejectRef.current?.(new Error("Optimization cancelled."));
        pendingWorkerRejectRef.current = null;
        setOptimizerProgress(null);
        setOptimizerNotice("Optimization cancelled.");
        setOptimizing(false);
    }, [optimizing]);
    const [copiedExport, setCopiedExport] = useState(false);
    const [sharingBuildImage, setSharingBuildImage] = useState(false);
    const [sharedBuildImage, setSharedBuildImage] = useState(false);
    const [draggedSlot, setDraggedSlot] = useState<DragSlotRef | null>(null);
    const [dragOverSlot, setDragOverSlot] = useState<DragSlotRef | null>(null);
    const [optimizeMode, setOptimizeMode] = useState<OptimizeMode>("optimize");
    const [incarnonPickerTier, setIncarnonPickerTier] = useState<IncarnonTier | null>(null);
    const incarnonDialogRef = useRef<HTMLDivElement | null>(null);
    const mathDialogRef = useRef<HTMLDivElement | null>(null);
    const savedPlannerConfig = useMemo<SavedBuildPlannerConfig>(() => {
        const gasNeighborCounts = normalizeElectricGasNeighborCounts(nearbyEnemyCount, nearbyGasOuterEnemyCount);
        const target: SavedBuildTargetConfig = {
            enabled: factionOn,
            faction,
            headshotRatePercent,
            enemyProfileId: selectedEnemyProfileId || undefined,
            isEximus,
            bossBlastStackCap,
            punctureVipStackCap,
            isSteelPath,
            useCustomStats: useCustomTargetStats,
            baseStats: { ...customTargetStats },
            scaleByLevel: scaleCustomTargetByLevel,
            scalingFaction: enemyScalingFaction,
            baseLevel: enemyBaseLevel,
            currentLevel: enemyCurrentLevel,
            toxinBypassesShields: customToxinBypassesShields,
            enemyShieldGateHitMode,
            nearbyEnemyCount: gasNeighborCounts.innerCount,
            nearbyGasOuterEnemyCount: gasNeighborCounts.outerCount,
            nearbyBlastEnemyCount,
            statusImmunities: [...targetStatusImmunities],
        };
        return {
            goal,
            conditionalMode,
            externalConditionalStacks,
            externalStatusTypeCount,
            externalVigilanteSetModCount,
            externalGladiatorSetModCount,
            externalNiraSetModCount,
            strainInfectionCystsAtImpact,
            dreadfulKillshotCurrentHealth,
            deadlyManeuversShotsRemaining,
            criticalPrecisionHeadshotProjectiles,
            unseenDreadInvisibilityActive,
            externalStatusTypes,
            targetStartsWithHeat,
            externalHeatElementalDamageBonusPercent: parseExternalHeatBonusPercentInput(
                externalHeatElementalDamageBonusPercentInput,
            ),
            externalHeatFactionDamageBonusPercent: parseExternalHeatBonusPercentInput(
                externalHeatFactionDamageBonusPercentInput,
            ),
            playerSlidingAtImpact: supportsKineticKiller && playerSlidingAtImpact,
            meleeComboMultiplier,
            tennokaiRegularHitsBetweenHeavy,
            phantasmaChargeAmmo,
            targetDistanceMeters,
            attackFalloffDistanceMeters,
            targetRadiusMeters,
            overpressuredRoundsSpreadMinimumDegrees,
            overpressuredRoundsSpreadMaximumDegrees,
            warframeArmor,
            warframeMaxEnergy,
            warframeEnergyPercent,
            attackIndex: selectedAttackIdx,
            attackName: weapon?.attacks[selectedAttackIdx]?.name,
            target,
            optimizerOptions: {
                allowNonMax,
                onlyOwned,
                allowCatalyst,
                allowForma,
                maxFormaAllowed,
                optimizeExilus: optExilus,
                optimizeArcane: optArcane,
                excludedModUniqueNames: [...excluded],
            },
        };
    }, [
        allowCatalyst,
        allowForma,
        allowNonMax,
        conditionalMode,
        customTargetStats,
        customToxinBypassesShields,
        enemyShieldGateHitMode,
        nearbyEnemyCount,
        nearbyGasOuterEnemyCount,
        nearbyBlastEnemyCount,
        enemyBaseLevel,
        enemyCurrentLevel,
        enemyScalingFaction,
        isEximus,
        bossBlastStackCap,
        punctureVipStackCap,
        isSteelPath,
        excluded,
        externalConditionalStacks,
        externalStatusTypeCount,
        externalVigilanteSetModCount,
        externalGladiatorSetModCount,
        externalNiraSetModCount,
        strainInfectionCystsAtImpact,
        dreadfulKillshotCurrentHealth,
        deadlyManeuversShotsRemaining,
        criticalPrecisionHeadshotProjectiles,
        unseenDreadInvisibilityActive,
        externalStatusTypes,
        targetStartsWithHeat,
        externalHeatElementalDamageBonusPercentInput,
        externalHeatFactionDamageBonusPercentInput,
        playerSlidingAtImpact,
        supportsKineticKiller,
        meleeComboMultiplier,
        tennokaiRegularHitsBetweenHeavy,
        phantasmaChargeAmmo,
        targetDistanceMeters,
        attackFalloffDistanceMeters,
        targetRadiusMeters,
        overpressuredRoundsSpreadMinimumDegrees,
        overpressuredRoundsSpreadMaximumDegrees,
        warframeArmor,
        warframeMaxEnergy,
        warframeEnergyPercent,
        faction,
        factionOn,
        headshotRatePercent,
        goal,
        maxFormaAllowed,
        optArcane,
        optExilus,
        onlyOwned,
        scaleCustomTargetByLevel,
        selectedAttackIdx,
        selectedEnemyProfileId,
        targetStatusImmunities,
        useCustomTargetStats,
        weapon,
    ]);

    useEffect(() => () => {
        optimizerCancelledRef.current = true;
        optimizerWorkerRef.current?.terminate();
        optimizerWorkerRef.current = null;
        pendingWorkerRejectRef.current?.(new Error("Build optimizer was closed."));
    }, []);

    useEffect(() => {
        setBuildCfg((prev) => {
            if (prev.masteryRank === masteryRank) return prev;
            return { ...prev, masteryRank };
        });
    }, [masteryRank]);

    useEffect(() => {
        const maxForWeapon = maxOptimizerFormaForWeapon(weapon);
        setMaxFormaAllowed((prev) => Math.min(Math.max(1, prev), maxForWeapon));
    }, [weapon]);

    function setIncarnonTierSelection(tier: IncarnonTier, optionId: string) {
        setBuildCfg((prev) => {
            const nextSelections = {
                ...prev.incarnonSelectedOptionsByTier,
                [tier]: optionId,
            };
            return {
                ...prev,
                incarnonUnlockedTier: getHighestSelectedIncarnonTier(nextSelections),
                incarnonSelectedOptionsByTier: nextSelections,
            };
        });
        setIncarnonPickerTier(null);
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    function clearIncarnonTierSelection(tier: IncarnonTier) {
        setBuildCfg((prev) => {
            const nextSelections = { ...prev.incarnonSelectedOptionsByTier };
            delete nextSelections[tier];
            return {
                ...prev,
                incarnonUnlockedTier: getHighestSelectedIncarnonTier(nextSelections),
                incarnonSelectedOptionsByTier: nextSelections,
                optimizeIncarnonSelections: getSelectedIncarnonTierCount(nextSelections) > 0 ? prev.optimizeIncarnonSelections : false,
            };
        });
        setIncarnonPickerTier(null);
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    function resetBuildForWeapon(w: WeaponEntry, opts?: { resetConfig?: boolean }) {
        setSlots(Array(SLOT_COUNT).fill(null));
        setRanks(Array(SLOT_COUNT).fill(0));
        const pols = Array(SLOT_COUNT).fill("") as string[];
        w.polarities.forEach((p, i) => { if (i < SLOT_COUNT) pols[i] = p; });
        setSlotPols(pols);
        const builtInStance = getStancesForWeapon(w).find((mod) => mod.isBuiltIn) ?? null;
        setStanceMod(builtInStance); setStanceRank(builtInStance ? builtInStance.fusionLimit : 0); setStancePol(w.stancePolarity ?? "");
        setExilusMod(null); setExilusRank(0); setExilusPol(""); setHasExilus(false);
        setArcane1(null); setArcane1Rank(0);
        setSelectedAttackIdx(0);
        setPhantasmaChargeAmmo(2);
        setTargetDistanceMeters(undefined);
        setAttackFalloffDistanceMeters(undefined);
        setTargetRadiusMeters(undefined);
        setIncarnonPickerTier(null);
        setShowMathWindow(false);
        if (opts?.resetConfig) {
            setBuildCfg(p => ({
                ...p,
                weaponRank: 30,
                hasCatalyst: false,
                valenceBonusPct: 0.25,
                valenceElement: "heat",
                optimizeValenceElement: false,
                incarnonUnlockedTier: 0,
                incarnonSelectedOptionsByTier: {},
                optimizeIncarnonSelections: false,
            }));
        }
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    function handleSelectWeapon(w: WeaponEntry) {
        setWeapon(w);
        resetBuildForWeapon(w, { resetConfig: true });
    }

    const compatMods   = useMemo(() => {
        if (!weapon) return [];
        const baseMods = getModsForWeapon(weapon);
        const customRivens = inventoryCustomRivens
            .filter((riven: CustomRivenRecord) => !riven.importStatus || riven.importStatus === "ready")
            .filter((riven: CustomRivenRecord) => customRivenSupportsWeapon(riven, weapon))
            .map((riven: CustomRivenRecord) => buildCustomRivenEntry(riven));
        return [...filterBuilderExpertVariants(baseMods), ...customRivens];
    }, [weapon, inventoryCustomRivens]);
    const stanceMods   = useMemo(() => {
        if (!weapon) return [];
        const mods = getStancesForWeapon(weapon);
        return filterBuilderExpertVariants(mods);
    }, [weapon]);
    const fixedStanceMod = useMemo(() => {
        if (!weapon) return null;
        return stanceMods.find((mod) => mod.isBuiltIn) ?? null;
    }, [weapon, stanceMods]);
    const weaponArcanes = useMemo(() => weapon ? getArcanesForWeapon(weapon) : [], [weapon]);
    const hasEnergyScaledArcanes = weaponArcanes.some((entry) => !!entry.energyScaledMultishot);
    const selectedArcaneEnergyEffect = arcane1?.energyScaledMultishot
        ? getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, false, arcaneEnergyContext)
        : null;
    const warframeEnergyArcanePanel = hasEnergyScaledArcanes ? (
        <div className="mt-2 space-y-1.5 rounded-lg border border-violet-900/50 bg-violet-950/15 p-2">
            <div className="text-[10px] font-semibold text-slate-300">Warframe Energy · Primary Overcharge</div>
            <div className="grid grid-cols-2 gap-2">
                <label className="block text-[9px] text-slate-400">
                    Max Energy
                    <input
                        id="warframe-max-energy-input"
                        aria-label="Warframe Maximum Energy for Primary Overcharge"
                        type="number"
                        min={0}
                        max={10000}
                        step={1}
                        value={warframeMaxEnergyInput}
                        onChange={(event) => setWarframeMaxEnergyInput(event.target.value)}
                        placeholder="Max energy"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                    />
                </label>
                <label className="block text-[9px] text-slate-400">
                    Current Energy (%)
                    <input
                        id="warframe-energy-percent-input"
                        aria-label="Current Warframe Energy percent for Primary Overcharge"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={warframeEnergyPercentInput}
                        onChange={(event) => setWarframeEnergyPercentInput(event.target.value)}
                        placeholder="0–100"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                    />
                </label>
            </div>
            <p className="text-[9px] leading-relaxed text-slate-500">At 90% current Energy, Primary Overcharge adds 35% of Max Energy as Multishot, up to its rank cap. This is a static scenario; energy use and regeneration during an encounter are not simulated. Both values are saved with this planner build.</p>
            {(arcane1?.energyScaledMultishot || optArcane) && (warframeMaxEnergy === undefined || warframeEnergyPercent === undefined) && (
                <p role="status" className="text-[9px] leading-relaxed text-amber-300">Energy-dependent Arcane bonuses are not calculated or considered by Auto Optimize until both values are entered.</p>
            )}
            {selectedArcaneEnergyEffect && (
                <p className="text-[9px] text-violet-300">Selected rank bonus: +{(((selectedArcaneEnergyEffect.multishotBonus ?? 0) * 100).toFixed(1))}% Multishot.</p>
            )}
        </div>
    ) : null;
    const incarnonRecord = useMemo(() => getIncarnonRecordForWeapon(weapon), [weapon]);
    const selectedIncarnonTierCount = useMemo(
        () => getSelectedIncarnonTierCount(buildCfg.incarnonSelectedOptionsByTier),
        [buildCfg.incarnonSelectedOptionsByTier],
    );
    const activeIncarnonTier = useMemo(
        () => incarnonPickerTier ? incarnonRecord?.tiers.find((tier) => tier.tier === incarnonPickerTier) ?? null : null,
        [incarnonPickerTier, incarnonRecord],
    );
    useEffect(() => {
        if (!activeIncarnonTier && !showMathWindow) return;

        const dialog = showMathWindow ? mathDialogRef.current : incarnonDialogRef.current;
        if (!dialog) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        dialog.focus();

        function onKeyDown(event: KeyboardEvent) {
            const activeModal = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
            if (activeModal !== dialog) return;

            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                if (showMathWindow) setShowMathWindow(false);
                else setIncarnonPickerTier(null);
                return;
            }
            if (event.key !== "Tab") return;

            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            } else if (!dialog.contains(document.activeElement)) {
                event.preventDefault();
                first?.focus();
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.documentElement.style.overflow = previousOverflow;
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [activeIncarnonTier, showMathWindow]);
    useEffect(() => {
        if (!incarnonPickerTier) return;
        if (!incarnonRecord?.tiers.some((tier) => tier.tier === incarnonPickerTier)) {
            setIncarnonPickerTier(null);
        }
    }, [incarnonPickerTier, incarnonRecord]);
    const trackableMods = useMemo(() => {
        const seen = new Set<string>();
        const out: ModEntry[] = [];
        for (const mod of [...compatMods, ...stanceMods]) {
            if (seen.has(mod.uniqueName)) continue;
            seen.add(mod.uniqueName);
            out.push(mod);
        }
        return out;
    }, [compatMods, stanceMods]);
    const ownedSet     = useMemo(() => new Set(
        trackableMods
            .filter(mod => mod.compatBucket === "Riven" || Number(inventoryCounts[`mods:${mod.path}`] ?? inventoryCounts[mod.path] ?? 0) > 0)
            .map(mod => mod.uniqueName)
    ), [trackableMods, inventoryCounts]);
    const ownedModMaxRankByUniqueName = useMemo(() => {
        const out: Record<string, number> = {};
        for (const mod of trackableMods) {
            if (mod.compatBucket === "Riven") {
                out[mod.uniqueName] = mod.fusionLimit;
                continue;
            }
            if (Number(inventoryCounts[`mods:${mod.path}`] ?? inventoryCounts[mod.path] ?? 0) <= 0) continue;
            out[mod.uniqueName] = getOwnedModRank(mod.path, mod.fusionLimit, inventoryCounts, inventoryModRanks);
        }
        return out;
    }, [trackableMods, inventoryCounts, inventoryModRanks]);
    const ownedArcaneUniqueNames = useMemo(() => {
        const set = new Set<string>();
        for (const arcane of weaponArcanes) {
            const totalByCounts = Number(inventoryCounts[`mods:${arcane.uniqueName}`] ?? inventoryCounts[arcane.uniqueName] ?? 0);
            if (hasOwnedArcane(inventoryArcaneRanks[arcane.uniqueName], totalByCounts)) {
                set.add(arcane.uniqueName);
            }
        }
        return set;
    }, [weaponArcanes, inventoryArcaneRanks, inventoryCounts]);
    const ownedArcaneMaxRankByUniqueName = useMemo(() => {
        const out: Record<string, number> = {};
        for (const arcane of weaponArcanes) {
            const rankCounts = inventoryArcaneRanks[arcane.uniqueName] ?? {};
            const fallbackCount = Number(inventoryCounts[`mods:${arcane.uniqueName}`] ?? inventoryCounts[arcane.uniqueName] ?? 0);
            const highestOwnedRank = getHighestOwnedArcaneRankWithFallback(rankCounts, fallbackCount);
            if (highestOwnedRank !== null) {
                out[arcane.uniqueName] = Math.min(arcane.maxRank, highestOwnedRank);
            }
        }
        return out;
    }, [weaponArcanes, inventoryArcaneRanks, inventoryCounts]);
    const usedGroups   = useMemo(() => {
        const s = new Set(slots.filter(Boolean).map(m => m!.incompatibilityGroup));
        if (stanceMod) s.add(stanceMod.incompatibilityGroup);
        if (exilusMod) s.add(exilusMod.incompatibilityGroup);
        return s;
    }, [slots, stanceMod, exilusMod]);
    const maxOptimizerForma = useMemo(() => maxOptimizerFormaForWeapon(weapon), [weapon]);
    const optimizerInputSignature = useMemo(() => JSON.stringify({
        weapon: weapon?.uniqueName,
        attack: selectedAttackIdx,
        goal,
        conditionalState,
        factionOn,
        faction,
        buildCfg,
        slots: slots.map((mod) => mod?.uniqueName ?? null),
        ranks,
        slotPols,
        stance: [stanceMod?.uniqueName, stanceRank, stancePol],
        exilus: [hasExilus, exilusMod?.uniqueName, exilusRank, exilusPol],
        arcane: [arcane1?.uniqueName, arcane1Rank, includeArcaneStats],
        warframeArmor,
        warframeMaxEnergy,
        warframeEnergyPercent,
        mode: optimizeMode,
        options: [allowNonMax, onlyOwned, allowCatalyst, allowForma, maxFormaAllowed, optExilus, optArcane],
        targetProfileOverride,
        owned: onlyOwned ? [...ownedSet].sort() : [],
        ownedRanks: onlyOwned ? ownedModMaxRankByUniqueName : {},
        ownedArcanes: onlyOwned ? [...ownedArcaneUniqueNames].sort() : [],
        ownedArcaneRanks: onlyOwned ? ownedArcaneMaxRankByUniqueName : {},
        excluded: [...excluded].sort(),
        candidates: compatMods.map((mod) => [mod.uniqueName, mod.effect]),
    }), [
        weapon, selectedAttackIdx, goal, conditionalState, factionOn, faction, targetProfileOverride, buildCfg,
        slots, ranks, slotPols, stanceMod, stanceRank, stancePol, hasExilus, exilusMod, exilusRank, exilusPol,
        arcane1, arcane1Rank, includeArcaneStats, optimizeMode, allowNonMax, onlyOwned, allowCatalyst,
        warframeArmor, warframeMaxEnergy, warframeEnergyPercent,
        allowForma, maxFormaAllowed, optExilus, optArcane, ownedSet, ownedModMaxRankByUniqueName,
        ownedArcaneUniqueNames, ownedArcaneMaxRankByUniqueName, excluded, compatMods,
    ]);
    const optimizerInputSignatureRef = useRef(optimizerInputSignature);
    useEffect(() => {
        if (
            optimizing &&
            !optimizerApplyingRef.current &&
            optimizerInputSignatureRef.current !== optimizerInputSignature
        ) cancelOptimization();
        optimizerInputSignatureRef.current = optimizerInputSignature;
    }, [optimizerInputSignature, optimizing, cancelOptimization]);

    // Forma count: count slots whose current polarity differs from weapon default
    const formaCount = useMemo(() => {
        if (!weapon) return 0;
        const defaultMainPolarities = [...weapon.polarities];
        while (defaultMainPolarities.length < SLOT_COUNT) defaultMainPolarities.push("");
        const includesStance = supportsStanceLikeMods(weapon);
        const includesExilus = hasExilus || !!exilusMod;
        const defaults = [
            ...defaultMainPolarities,
            ...(includesStance ? [weapon.stancePolarity ?? ""] : []),
            ...(includesExilus ? [""] : []),
        ];
        const current = [
            ...slotPols,
            ...(includesStance ? [stancePol] : []),
            ...(includesExilus ? [exilusPol] : []),
        ];
        return countPolarityChanges(defaults, current);
    }, [weapon, slotPols, stancePol, exilusPol, hasExilus, exilusMod]);

    const currentBuildExport = useMemo(() => buildExportPayload({
        weapon,
        selectedAttackIdx,
        meleeDpsInputs,
        goal,
        conditionalState,
        targetFaction: factionOn ? faction : null,
        targetProfileOverride,
        targetStatusImmunities,
        buildCfg,
        includeArcaneStats,
        slots,
        ranks,
        slotPols,
        stanceMod,
        stanceRank,
        stancePol,
        formaCount,
        exilusEnabled: hasExilus,
        exilusMod,
        exilusRank,
        exilusPol,
        arcane: arcane1,
        arcaneRank: arcane1Rank,
        warframeArmor,
        warframeMaxEnergy,
        warframeEnergyPercent,
        optimizeMode,
        respectCap,
        allowNonMax,
        onlyOwned,
        factionOn,
        allowCatalyst,
        allowForma,
        maxFormaAllowed,
        optExilus,
        optArcane,
        compatMods,
        weaponArcanes,
        ownedSet,
        ownedModMaxRankByUniqueName,
        ownedArcaneUniqueNames,
        ownedArcaneMaxRankByUniqueName,
        excluded,
    }), [
        weapon, selectedAttackIdx, goal, conditionalState, factionOn, faction, targetProfileOverride, targetStatusImmunities, meleeDpsInputs, buildCfg, includeArcaneStats, warframeArmor, warframeMaxEnergy, warframeEnergyPercent,
        slots, ranks, slotPols, stanceMod, stanceRank, stancePol, formaCount, hasExilus, exilusMod, exilusRank, exilusPol, arcane1, arcane1Rank,
        optimizeMode, respectCap, allowNonMax, onlyOwned, allowCatalyst, allowForma, maxFormaAllowed, optExilus, optArcane,
        compatMods, weaponArcanes, ownedSet, ownedModMaxRankByUniqueName, ownedArcaneUniqueNames, ownedArcaneMaxRankByUniqueName, excluded,
    ]);

    const activeWeaponState = useMemo(() => {
        if (!weapon) return null;
        return applyWeaponConfig(weapon, selectedAttackIdx, buildCfg);
    }, [weapon, selectedAttackIdx, buildCfg]);
    const activeCalcWeapon = activeWeaponState?.selectedWeapon ?? null;
    const phantasmaAltFireModelNote = activeCalcWeapon &&
        (activeCalcWeapon.name === "Phantasma" || activeCalcWeapon.name === "Phantasma Prime") &&
        /^(plasma bomb|cluster bombs)/i.test(activeCalcWeapon.selectedAttackName ?? "")
        ? "The selected row scales linearly from its Wiki baseline at 2 ammo using the chosen charge amount; the charge rate is fixed at 11 ammo/sec and is unaffected by fire-rate mods. Each row represents one part of the attack. Magazine-depletion charge-cost changes and the incremental-charge damage bug are not simulated, and the bomb plus five bomblets, projectile travel, and falloff are not combined. Treat these as single-row proxies."
        : "";
    const activeIncarnonUnsupportedLines = useMemo(
        () => activeWeaponState?.appliedIncarnonOptions.flatMap((option) =>
            option.model.unsupportedLines.map((line) => `${option.name}: ${line}`),
        ) ?? [],
        [activeWeaponState],
    );
    const activeIncarnonHasExpectedHitProcs = activeWeaponState?.activeIncarnonEffects.some(
        (effect) => (effect.nonCriticalHitDamageProcs?.length ?? 0) > 0,
    ) ?? false;
    async function handleCopyBuildExport() {
        if (!currentBuildExportWithScoreContext) return;
        const json = JSON.stringify(currentBuildExportWithScoreContext, null, 2);
        await navigator.clipboard.writeText(json);
        setCopiedExport(true);
        setTimeout(() => setCopiedExport(false), 2000);
    }

    async function handleShareBuildImage() {
        if (!currentBuildExportWithScoreContext || sharingBuildImage) return;
        setSharingBuildImage(true);
        try {
            const blob = await generateBuildShareImage(currentBuildExportWithScoreContext);
            const safeWeapon = currentBuildExportWithScoreContext.weapon.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
            const safeAttack = (currentBuildExportWithScoreContext.weapon.selectedAttack ?? "build")
                .replace(/[^a-z0-9]+/gi, "-")
                .replace(/^-+|-+$/g, "")
                .toLowerCase();
            const fileName = `${safeWeapon || "weapon"}-${safeAttack || "build"}-build.png`;
            const file = new File([blob], fileName, { type: "image/png" });
            const nav = navigator as Navigator & {
                canShare?: (data?: ShareData) => boolean;
            };

            if (nav.share && nav.canShare?.({ files: [file] })) {
                await nav.share({
                    files: [file],
                });
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }

            setSharedBuildImage(true);
            setTimeout(() => setSharedBuildImage(false), 2200);
        } catch (error) {
            console.error(error);
        } finally {
            setSharingBuildImage(false);
        }
    }

    function handleSlotChange(i: number, mod: ModEntry | null) {
        setSlots(p => { const n = [...p]; n[i] = mod; return n; });
        setRanks(p => { const n = [...p]; n[i] = mod ? mod.fusionLimit : 0; return n; });
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    useEffect(() => {
        if (!weapon || !fixedStanceMod) return;
        if (stanceMod?.uniqueName === fixedStanceMod.uniqueName && stanceRank === fixedStanceMod.fusionLimit) return;
        setStanceMod(fixedStanceMod);
        setStanceRank(fixedStanceMod.fusionLimit);
    }, [weapon, fixedStanceMod, stanceMod, stanceRank]);
    function handleRankChange(i: number, r: number) {
        setRanks(p => { const n = [...p]; n[i] = r; return n; });
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }
    function handlePolChange(i: number, p: string)  {
        setSlotPols(p2 => { const n = [...p2]; n[i] = p; return n; });
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }
    function handleExilusChange(_: number, m: ModEntry | null) {
        setExilusMod(m); setExilusRank(m ? m.fusionLimit : 0);
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }
    function getSlotMod(ref: DragSlotRef | null): ModEntry | null {
        if (!ref) return null;
        return ref.kind === "main" ? slots[ref.index] : exilusMod;
    }
    function getSlotRank(ref: DragSlotRef | null): number {
        if (!ref) return 0;
        return ref.kind === "main" ? (ranks[ref.index] ?? 0) : exilusRank;
    }
    function canPlaceModInSlot(mod: ModEntry | null, kind: DragSlotKind): boolean {
        if (!mod) return true;
        return kind === "main" ? true : !!mod.isExilus;
    }
    function canSwapSlots(source: DragSlotRef | null, target: DragSlotRef | null): boolean {
        if (!source || !target) return false;
        if (source.kind === target.kind && source.index === target.index) return false;
        const sourceMod = getSlotMod(source);
        if (!sourceMod) return false;
        const targetMod = getSlotMod(target);
        return canPlaceModInSlot(sourceMod, target.kind) && canPlaceModInSlot(targetMod, source.kind);
    }
    function handleDropSwap(target: DragSlotRef) {
        if (!draggedSlot || !canSwapSlots(draggedSlot, target)) {
            setDragOverSlot(null);
            setDraggedSlot(null);
            return;
        }

        const source = draggedSlot;
        const sourceMod = getSlotMod(source);
        const targetMod = getSlotMod(target);
        const sourceRank = getSlotRank(source);
        const targetRank = getSlotRank(target);

        if (source.kind === "main" && target.kind === "main") {
            setSlots((prev) => {
                const next = [...prev];
                next[source.index] = targetMod;
                next[target.index] = sourceMod;
                return next;
            });
            setRanks((prev) => {
                const next = [...prev];
                next[source.index] = targetMod ? targetRank : 0;
                next[target.index] = sourceMod ? sourceRank : 0;
                return next;
            });
        } else if (source.kind === "main" && target.kind === "exilus") {
            setSlots((prev) => {
                const next = [...prev];
                next[source.index] = targetMod;
                return next;
            });
            setRanks((prev) => {
                const next = [...prev];
                next[source.index] = targetMod ? targetRank : 0;
                return next;
            });
            setExilusMod(sourceMod);
            setExilusRank(sourceMod ? sourceRank : 0);
        } else if (source.kind === "exilus" && target.kind === "main") {
            setSlots((prev) => {
                const next = [...prev];
                next[target.index] = sourceMod;
                return next;
            });
            setRanks((prev) => {
                const next = [...prev];
                next[target.index] = sourceMod ? sourceRank : 0;
                return next;
            });
            setExilusMod(targetMod);
            setExilusRank(targetMod ? targetRank : 0);
        } else {
            setExilusMod(targetMod);
            setExilusRank(targetMod ? targetRank : 0);
        }

        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
        setDragOverSlot(null);
        setDraggedSlot(null);
    }
    function toggleExclude(uniqueName: string) {
        setExcluded(previous => {
            const next = new Set(previous);
            if (next.has(uniqueName)) next.delete(uniqueName);
            else next.add(uniqueName);
            return next;
        });
    }

    const capacityCfg: CapacityConfig = {
        weaponRank: buildCfg.weaponRank, hasCatalyst: buildCfg.hasCatalyst,
        masteryRank: buildCfg.masteryRank, canOverLevel: weapon?.canOverLevel ?? false,
    };

    const allSlotsForCap = useMemo(() => {
        const s = [...slots];
        if (weapon && supportsStanceLikeMods(weapon) && stanceMod) s.unshift(stanceMod);
        if (hasExilus) s.push(exilusMod);
        return s;
    }, [slots, stanceMod, exilusMod, hasExilus, weapon]);
    const allPolsForCap  = useMemo(() => {
        const p = [...slotPols];
        if (weapon && supportsStanceLikeMods(weapon) && stanceMod) p.unshift(stancePol);
        if (hasExilus) p.push(exilusPol);
        return p;
    }, [slotPols, stancePol, exilusPol, hasExilus, weapon, stanceMod]);
    const allRanksForCap = useMemo(() => {
        const r = [...ranks];
        if (weapon && supportsStanceLikeMods(weapon) && stanceMod) r.unshift(stanceRank);
        if (hasExilus) r.push(exilusRank);
        return r;
    }, [ranks, stanceMod, stanceRank, exilusRank, hasExilus, weapon]);
    const activeBuildEffects = useMemo(() => {
        const effects: (ModEffect | null)[] = [
            ...(activeWeaponState?.activeIncarnonEffects ?? []),
            ...allSlotsForCap.map((mod, i) => {
            if (!mod) return null;
            const r = allRanksForCap[i] ?? mod.fusionLimit;
            return mod.effectsByRank[r] ?? mod.effect;
            }),
        ];
        if (includeArcaneStats && arcane1) {
            const ae = getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, true, arcaneEnergyContext);
            if (ae) effects.push({
                ...emptyEffect(),
                ...ae,
                conditionalEffects: [...(ae.conditionalEffects ?? [])],
            });
        }
        return effects;
    }, [activeWeaponState, allSlotsForCap, allRanksForCap, includeArcaneStats, arcane1, arcane1Rank, warframeArmor, arcaneEnergyContext]);
    const activeAccuracyAffectingEffect = hasAccuracyAffectingPelletEffect(activeBuildEffects);
    const activeOverpressuredRoundsSelected = allSlotsForCap.some((mod) =>
        mod?.path === OVERPRESSURED_ROUNDS_MOD_PATH,
    );
    const activeOverpressuredRoundsSpreadSnapshot = useMemo(
        () => normalizeOverpressuredRoundsSpreadSnapshot(
            overpressuredRoundsSpreadMinimumDegrees,
            overpressuredRoundsSpreadMaximumDegrees,
        ),
        [overpressuredRoundsSpreadMinimumDegrees, overpressuredRoundsSpreadMaximumDegrees],
    );
    const activeOverpressuredBurstSnapshotApplies = Boolean(
        goal === "burst" &&
        activeOverpressuredRoundsSelected &&
        activeCalcWeapon?.name.toLowerCase() === "efv-5 jupiter" &&
        activeCalcWeapon.selectedAttackName?.toLowerCase() === "buckshot" &&
        activeOverpressuredRoundsSpreadSnapshot,
    );
    const activeUnsupportedSpreadModifier = allSlotsForCap.some((mod, index) => {
        if (!mod || mod.path === OVERPRESSURED_ROUNDS_MOD_PATH) return false;
        const rank = allRanksForCap[index] ?? mod.fusionLimit;
        return (mod.unparsedStatsByRank?.[rank] ?? []).some((line) => /spread|accuracy/i.test(line));
    });
    const activePelletHitEstimateEnabled = Boolean(
        activeCalcWeapon?.selectedAttackPelletSpreadCone &&
        estimatePelletHits(
            activeCalcWeapon.selectedAttackPelletSpreadCone,
            activeCalcWeapon.multishot,
            targetRadiusMeters,
            attackFalloffDistanceMeters,
        ) &&
        !activeAccuracyAffectingEffect &&
        !activeUnsupportedSpreadModifier &&
        (!activeOverpressuredRoundsSelected || activeOverpressuredBurstSnapshotApplies),
    );
    const activeTargetAssumptions = useMemo(
        () => getTargetProfileAssumptions(factionOn ? faction : "", targetProfileOverride),
        [factionOn, faction, targetProfileOverride],
    );
    const activeSentientIncisionSelected = activeBuildEffects.some((effect) =>
        (effect?.sentientIncisionDamageBonus ?? 0) > 0,
    );
    const activeSentientIncisionUnsupportedTarget = Boolean(
        activeSentientIncisionSelected &&
        activeCalcWeapon?.selectedAttackUsesSlamDamageBonus !== true &&
        !getSentientIncisionDamageType(factionOn ? faction : "", activeTargetAssumptions.overguard > 0),
    );
    const activeSentientIncisionOverguardTimelineLimit = Boolean(
        activeSentientIncisionSelected && activeCalcWeapon?.selectedAttackUsesSlamDamageBonus !== true &&
        activeTargetAssumptions.overguard > 0,
    );
    const activeAttackModelLimitationBlocksScoring = Boolean(
        activeCalcWeapon?.selectedAttackModelLimitation && !activePelletHitEstimateEnabled,
    );
    const activeFiniteAttackModelLimitationBlocksScoring = Boolean(
        activeAttackModelLimitationBlocksScoring || activeOverpressuredBurstSnapshotApplies ||
        activeSentientIncisionUnsupportedTarget || activeSentientIncisionOverguardTimelineLimit,
    );
    const pelletEstimateConditionalState = useMemo(
        () => activePelletHitEstimateEnabled
            ? {
                ...conditionalState,
                ...(activeOverpressuredBurstSnapshotApplies && activeOverpressuredRoundsSpreadSnapshot
                    ? {
                        overpressuredRoundsSpreadMinimumDegrees: activeOverpressuredRoundsSpreadSnapshot.minimumSpreadDegrees,
                        overpressuredRoundsSpreadMaximumDegrees: activeOverpressuredRoundsSpreadSnapshot.maximumSpreadDegrees,
                    }
                    : {}),
            }
            : {
                ...conditionalState,
                targetRadiusMeters: undefined,
                overpressuredRoundsSpreadMinimumDegrees: undefined,
                overpressuredRoundsSpreadMaximumDegrees: undefined,
            },
        [activePelletHitEstimateEnabled, activeOverpressuredBurstSnapshotApplies, activeOverpressuredRoundsSpreadSnapshot, conditionalState],
    );
    const finitePelletEstimateConditionalState = useMemo(
        () => withoutBurstOnlyConditionalAssumptions(pelletEstimateConditionalState) ?? pelletEstimateConditionalState,
        [pelletEstimateConditionalState],
    );
    const sentientSurgeRefillPerKill = activeBuildEffects.reduce(
        (total, effect) => total + (effect?.sentientSurgeMagazineRefillPerKill ?? 0),
        0,
    );
    const sentientSurgeActiveTendrils = conditionalMode === "initial"
        ? 0
        : conditionalMode === "fullyStacked"
            ? 4
            : conditionalMode === "custom"
                ? Math.max(0, Math.min(4, externalConditionalStacks))
                : 2.8;
    const hasActiveProtonJet = activeBuildEffects.some((effect) =>
        effect?.conditionalEffects.some((conditional) =>
            conditional.trigger === "whileWallLatched" && (conditional.stats.critChanceBonus ?? 0) > 0,
        ),
    );
    const hasActiveProtonSnap = activeBuildEffects.some((effect) =>
        effect?.conditionalEffects.some((conditional) =>
            conditional.trigger === "whileWallLatched" && (conditional.stats.toxinBonus ?? 0) > 0,
        ),
    );
    const activeProtonSnapConditional = activeBuildEffects
        .flatMap((effect) => effect?.conditionalEffects ?? [])
        .find((conditional) => conditional.trigger === "whileWallLatched" && (conditional.stats.toxinBonus ?? 0) > 0);
    const activeBuildEffectSourceLabels = useMemo(() => {
        const labels = [
            ...(activeWeaponState?.activeIncarnonEffects ?? []).map((_, index) => `selected Incarnon evolution ${index + 1}`),
            ...allSlotsForCap.map((mod, i) => {
                if (!mod) return `slot ${i + 1}`;
                if (i < SLOT_COUNT) return `${getBuilderDisplayModName(mod)} (slot ${i + 1})`;
                return `${getBuilderDisplayModName(mod)} (exilus)`;
            }),
        ];
        if (includeArcaneStats && arcane1) labels.push(`${arcane1.name} (arcane)`);
        return labels;
    }, [activeWeaponState, allSlotsForCap, includeArcaneStats, arcane1]);
    const expectedKillRatePerSecond = useMemo(
        () => activeCalcWeapon
            ? estimateGalvanizedPerStatusKillRate(
                activeCalcWeapon,
                activeBuildEffects,
                factionOn ? faction : "",
                targetProfileOverride,
                conditionalState,
                externalStatusTypeCount,
                externalStatusTypes,
                targetStatusImmunities,
            )
            : undefined,
        [activeCalcWeapon, activeBuildEffects, factionOn, faction, targetProfileOverride, conditionalState, externalStatusTypeCount, externalStatusTypes, targetStatusImmunities],
    );
    const activeMetrics = useMemo(
        () => activeCalcWeapon ? calculateBuild(activeCalcWeapon, activeBuildEffects, factionOn ? faction : "", {
            conditionalState: pelletEstimateConditionalState,
            isEximusTarget: targetProfileOverride?.isEximusTarget,
            targetHasOverguard: activeTargetAssumptions.overguard > 0,
            statusImmuneTypes: activeTargetAssumptions.statusImmuneTypes,
            statusStackCaps: activeTargetAssumptions.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(factionOn ? faction : "", targetProfileOverride),
            ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
        }) : null,
        [activeCalcWeapon, activeBuildEffects, factionOn, faction, pelletEstimateConditionalState, activeTargetAssumptions, expectedKillRatePerSecond, targetProfileOverride],
    );
    const activeBuildHasTennokai = activeBuildEffects.some((effect) => effect?.tennokaiEnabled === true);
    const tennokaiAttackPair = activeCalcWeapon ? findSupportedTennokaiAttackPair(activeCalcWeapon) : null;
    const tennokaiGoalAvailable = tennokaiAttackPair !== null;
    useEffect(() => {
        if (goal === "tennokaiDps" && weapon && !tennokaiGoalAvailable) setGoal("burst");
    }, [goal, weapon, tennokaiGoalAvailable]);
    const tennokaiTimeline = useMemo(() => {
        if (!activeCalcWeapon) return null;
        const supportedPair = findSupportedTennokaiAttackPair(activeCalcWeapon);
        const regularAttackIndex = supportedPair?.regularAttackIndex ?? activeCalcWeapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const heavyAttackIndex = supportedPair?.heavyAttackIndex ?? activeCalcWeapon.attacks.findIndex((attack) =>
            attack.name === "Heavy Attack" || attack.name === "Heavy Slam Attack",
        );
        return calculateTennokaiAttackTimeline({
            weapon: activeCalcWeapon,
            mods: activeBuildEffects,
            targetFaction: factionOn ? faction : "",
            regularAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: tennokaiRegularHitsBetweenHeavy,
            conditionalState,
            damageOptions: {
                isEximusTarget: targetProfileOverride?.isEximusTarget,
                targetHasOverguard: activeTargetAssumptions.overguard > 0,
                statusImmuneTypes: activeTargetAssumptions.statusImmuneTypes,
                statusStackCaps: activeTargetAssumptions.statusStackCaps,
                hitLocation: getTargetHitLocationProfile(factionOn ? faction : "", targetProfileOverride),
            },
            targetProfile: {
                health: activeTargetAssumptions.health,
                shields: activeTargetAssumptions.shields,
                overguard: activeTargetAssumptions.overguard,
                armor: activeTargetAssumptions.armor,
                baseArmorValue: targetProfileOverride?.armorBaseValue ?? activeTargetAssumptions.armor,
                armorLevelMultiplier: targetProfileOverride?.armorLevelMultiplier ?? 1,
                toxinBypassesShields: activeTargetAssumptions.toxinBypassesShields,
            },
            cycles: 8,
        });
    }, [activeCalcWeapon, activeBuildEffects, factionOn, faction, tennokaiRegularHitsBetweenHeavy, conditionalState, targetProfileOverride, activeTargetAssumptions]);
    const finiteMetrics = useMemo(() => {
        if (!activeCalcWeapon || !activeMetrics || (
            activeMetrics.modded.strainInfectionCritDamageBonus <= 0 &&
            activeMetrics.modded.dreadfulKillshotBonus <= 0 &&
            activeMetrics.modded.deadlyManeuversHeadshotCritChanceBonus <= 0 &&
            !activeOverpressuredBurstSnapshotApplies
        )) {
            return activeMetrics;
        }
        return calculateBuild(activeCalcWeapon, activeBuildEffects, factionOn ? faction : "", {
            conditionalState: finitePelletEstimateConditionalState,
            isEximusTarget: targetProfileOverride?.isEximusTarget,
            targetHasOverguard: activeTargetAssumptions.overguard > 0,
            statusImmuneTypes: activeTargetAssumptions.statusImmuneTypes,
            statusStackCaps: activeTargetAssumptions.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(factionOn ? faction : "", targetProfileOverride),
            ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
        });
    }, [activeCalcWeapon, activeMetrics, activeBuildEffects, factionOn, faction, finitePelletEstimateConditionalState, activeTargetAssumptions, expectedKillRatePerSecond, targetProfileOverride, activeOverpressuredBurstSnapshotApplies]);
    const activeNonSentientAttackDpsUnavailable = Boolean(
        (activeAttackModelLimitationBlocksScoring && (activeMetrics?.modded.ammoGateSatisfied ?? true)) ||
        activeMetrics?.modded.pelletHitEstimate,
    );
    const activeAttackDpsUnavailable = Boolean(activeNonSentientAttackDpsUnavailable || activeSentientIncisionUnsupportedTarget);
    const activeNonSentientSustainedDpsUnavailable = Boolean(
        activeNonSentientAttackDpsUnavailable ||
        (activeOverpressuredRoundsSelected && activeCalcWeapon?.selectedAttackName === "Buckshot"),
    );
    const activeSustainedDpsUnavailable = Boolean(
        activeNonSentientSustainedDpsUnavailable ||
        activeSentientIncisionUnsupportedTarget ||
        activeSentientIncisionOverguardTimelineLimit,
    );
    const currentBuildExportWithScoreContext = useMemo(() => {
        if (!currentBuildExport) return null;
        const calculated = currentBuildExport.calculated && activeMetrics && finiteMetrics
            ? {
                ...activeMetrics,
                sustainedDPS: finiteMetrics.sustainedDPS,
                modded: {
                    ...activeMetrics.modded,
                    dotDamagePerShot: finiteMetrics.modded.dotDamagePerShot,
                    dotDamagePerShotByType: finiteMetrics.modded.dotDamagePerShotByType,
                    dotDps: finiteMetrics.modded.dotDps,
                    dotDpsByType: finiteMetrics.modded.dotDpsByType,
                },
                meleeAverageDps: currentBuildExport.calculated.meleeAverageDps,
            }
            : currentBuildExport.calculated;
        const limitation = activeCalcWeapon?.selectedAttackModelLimitation;
        return {
            ...currentBuildExport,
            calculated,
            scoreAvailability: {
                targetDamageAndDpsAvailable: !activeAttackDpsUnavailable,
                ...(activeAttackDpsUnavailable
                    ? {
                        reason: activeSentientIncisionUnsupportedTarget
                            ? "Sentient Incision needs a supported target faction or active Overguard to choose its adaptive element."
                            : limitation?.reason ?? "This attack's selected damage effect is not modeled for the current context.",
                        ...(activeSentientIncisionUnsupportedTarget
                            ? { sourceUrl: "https://wiki.warframe.com/w/Sentient_Incision" }
                            : limitation?.sourceUrl ? { sourceUrl: limitation.sourceUrl } : {}),
                    }
                    : {}),
                sustainedDpsAvailable: !activeSustainedDpsUnavailable,
                ...(activeSustainedDpsUnavailable
                    ? {
                        sustainedDpsReason: activeOverpressuredRoundsSelected && activeCalcWeapon?.selectedAttackName === "Buckshot"
                            ? "Overpressured Rounds' next-shot and magazine effects need attack history; the manual spread and Falloff Distance snapshot is Burst-only."
                            : activeSentientIncisionUnsupportedTarget
                                ? "Sentient Incision needs a supported target faction or active Overguard to select its adaptive damage type."
                            : activeSentientIncisionOverguardTimelineLimit
                                ? "Sentient Incision selects Corrosive against the initial Overguard pool, then changes to the target faction element when Overguard breaks; that damage-type timeline is not modeled."
                            : limitation?.reason ?? "Sustained scoring is unavailable for this attack model.",
                    }
                    : {}),
                dotDpsAvailable: !activeSustainedDpsUnavailable,
                ...(activeSustainedDpsUnavailable
                    ? {
                        dotDpsReason: activeOverpressuredRoundsSelected && activeCalcWeapon?.selectedAttackName === "Buckshot"
                            ? "Overpressured Rounds' next-shot and magazine effects need attack history; the manual spread and Falloff Distance snapshot is Burst-only, and DoT DPS is unavailable."
                            : activeSentientIncisionUnsupportedTarget
                                ? "Sentient Incision needs a supported target faction or active Overguard to select its adaptive damage type; DoT DPS is unavailable."
                            : activeSentientIncisionOverguardTimelineLimit
                                ? "Sentient Incision's adaptive element changes when Overguard breaks; its sustained DoT timeline is not modeled."
                            : limitation?.reason ?? "DoT DPS is unavailable for this attack model.",
                    }
                    : {}),
                finiteTargetScoringAvailable: !activeFiniteAttackModelLimitationBlocksScoring,
                ...(activeFiniteAttackModelLimitationBlocksScoring
                    ? {
                        finiteTargetScoringReason: activeOverpressuredBurstSnapshotApplies
                            ? "The user-entered Overpressured Rounds spread and Falloff Distance snapshot applies only to manual Burst; cross-mode kill history is not simulated."
                            : activeSentientIncisionUnsupportedTarget
                                ? "Sentient Incision needs a supported target faction or active Overguard to choose its adaptive element."
                            : activeSentientIncisionOverguardTimelineLimit
                                ? "Sentient Incision changes from Corrosive to the target faction element when Overguard breaks; finite attack history is not modeled."
                            : limitation?.reason ?? "This attack does not have a supported finite target-scoring model.",
                    }
                    : {}),
            },
        };
    }, [currentBuildExport, activeMetrics, finiteMetrics, activeAttackDpsUnavailable, activeSustainedDpsUnavailable, activeOverpressuredRoundsSelected, activeFiniteAttackModelLimitationBlocksScoring, activeOverpressuredBurstSnapshotApplies, activeSentientIncisionUnsupportedTarget, activeSentientIncisionOverguardTimelineLimit, activeCalcWeapon]);
    const displayedMath = (reasoningContextAtOptimization === currentReasoningContextKey ? reasoningMath : null) ?? currentBuildExportWithScoreContext?.math ?? null;
    const attackDamageRampNote = activeCalcWeapon?.selectedAttackDamageRamp && activeMetrics
        ? `Damage ramps from ${fmt(activeCalcWeapon.selectedAttackDamageRamp.minimumDamageMultiplier * 100, 0)}% to 100% over ${fmt(activeCalcWeapon.selectedAttackDamageRamp.rampToFullSeconds, 2)}s. It starts decaying after ${fmt(activeCalcWeapon.selectedAttackDamageRamp.idleBeforeDecaySeconds, 2)}s idle and reaches the minimum over ${fmt(activeCalcWeapon.selectedAttackDamageRamp.decayToMinimumSeconds, 2)}s. Burst DPS averages the fresh magazine at ${fmt(activeMetrics.modded.freshMagazineDamageMultiplier * 100, 1)}%; sustained DPS uses the repeating-magazine level at ${fmt(activeMetrics.modded.sustainedDamageMultiplier * 100, 1)}%. The initial one-hit target estimate uses the minimum; sequence and finite-encounter estimates advance it per attack. The encounter applies the ramp to per-attack DoT/Blast seeds as an assumption; the Wiki does not specify seed inheritance separately.`
        : "";
    const initialTargetMetrics = useMemo(
        () => activeCalcWeapon ? calculateBuild(activeCalcWeapon, activeBuildEffects, factionOn ? faction : "", {
            conditionalState: { mode: "initial" },
            isEximusTarget: targetProfileOverride?.isEximusTarget,
            targetHasOverguard: activeTargetAssumptions.overguard > 0,
            statusImmuneTypes: activeTargetAssumptions.statusImmuneTypes,
            statusStackCaps: activeTargetAssumptions.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(factionOn ? faction : "", targetProfileOverride),
            targetStatusState: "initial",
        }) : null,
        [activeCalcWeapon, activeBuildEffects, factionOn, faction, activeTargetAssumptions, targetProfileOverride],
    );
    const meleeAverageDps = useMemo(() => {
        if (
            !weapon || !usesMeleeDamageModel(weapon.category) || !initialTargetMetrics ||
            !meleeDpsInputs || activeSentientIncisionOverguardTimelineLimit
        ) return null;
        return calculateMeleeAverageDps(initialTargetMetrics.modded, {
            totalDamageMultiplier: meleeDpsInputs.totalDamageMultiplier,
            totalSlashProcMultiplier: meleeDpsInputs.totalSlashProcMultiplier,
            baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
        });
    }, [weapon, initialTargetMetrics, meleeDpsInputs, activeSentientIncisionOverguardTimelineLimit]);
    const encounterTargetMetrics = useMemo(
        () => activeCalcWeapon ? calculateBuildForExpectedEncounter(activeCalcWeapon, activeBuildEffects, factionOn ? faction : "", {
            conditionalState: finitePelletEstimateConditionalState,
            targetHasOverguard: activeTargetAssumptions.overguard > 0,
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            hitLocation: getTargetHitLocationProfile(factionOn ? faction : "", targetProfileOverride),
            targetStatusState: "initial",
            ...(Number.isFinite(expectedKillRatePerSecond) ? { expectedKillRatePerSecond } : {}),
        }) : null,
        [activeCalcWeapon, activeBuildEffects, factionOn, faction, finitePelletEstimateConditionalState, activeTargetAssumptions, targetStatusImmunities, targetProfileOverride, expectedKillRatePerSecond],
    );
    const activeProcMixLabel = activeMetrics
        ? Object.entries(activeMetrics.modded.procChanceByType)
            .filter(([, chance]) => (chance ?? 0) > 0)
            .map(([type, chance]) => `${type[0].toUpperCase()}${type.slice(1)} ${fmt((chance ?? 0) * 100, 1)}%`)
            .join(" · ") || "No eligible status procs"
        : "—";
    const selectedEnemyProfile = useMemo(
        () => getEnemyProfile(selectedEnemyProfileId),
        [selectedEnemyProfileId],
    );
    const activeTargetAttackInput = useMemo<DirectTargetDamageInput | null>(() => {
        if (!activeMetrics) return null;
        const stats = activeMetrics.modded;
        const combinedArmorStrip = 1 - ((1 - stats.heatArmorStrip) * (1 - stats.corrosiveArmorStrip));
        return {
            damageByType: stats.damageBreakdownBeforePerStatus,
            health: activeTargetAssumptions.health,
            shields: activeTargetAssumptions.shields,
            overguard: activeTargetAssumptions.overguard,
            armor: activeTargetAssumptions.armor,
            armorDamageReductionMultiplier: Math.max(0, 1 - combinedArmorStrip),
            baseArmorValue: targetProfileOverride?.armorBaseValue ?? activeTargetAssumptions.armor,
            armorLevelMultiplier: targetProfileOverride?.armorLevelMultiplier ?? 1,
            shatteringImpactBaseArmorPerHit: stats.shatteringImpactBaseArmorPerHit,
            faction: factionOn ? faction : "",
            factionDamageBonus: stats.factionDamageBonus,
            viralHealthDamageBonus: stats.viralHealthDamageBonus,
            magneticDefenseDamageBonus: stats.magneticShieldDamageBonus,
            toxinBypassesShields: activeTargetAssumptions.toxinBypassesShields,
            damageRampRule: activeCalcWeapon?.selectedAttackDamageRamp,
            hitLocation: stats.hitLocation,
            expectedHitDamageMultiplier: avgHitDamageMultiplier(
                stats.critChance + stats.punctureCritChanceBonus,
                stats.critMultiplier + stats.coldCritDamageBonus,
                stats.nonCriticalHitDamageProcs,
                stats.hitLocation,
                stats.vigilanteCritTierEnhancementChance,
            ),
            critChance: stats.critChance + stats.punctureCritChanceBonus,
            critMultiplier: stats.critMultiplier + stats.coldCritDamageBonus,
            critTierEnhancementChance: stats.vigilanteCritTierEnhancementChance,
            nonCriticalHitDamageProcs: stats.nonCriticalHitDamageProcs,
            expectedProjectiles: stats.multishot,
            expectedDamageMultiplier: stats.damageWeightedMultishot,
            singleProjectileDamageBonus: stats.singleProjectileDamageBonus,
        };
    }, [activeMetrics, activeTargetAssumptions, activeCalcWeapon, factionOn, faction, targetProfileOverride]);
    const activeTargetAttackDamage = useMemo(() => {
        if (!activeTargetAttackInput || !activeMetrics || activeAttackModelLimitationBlocksScoring || !activeMetrics.modded.ammoGateSatisfied) return null;
        const stats = activeMetrics.modded;
        return calculateDirectDamageToInitialPools({
            ...activeTargetAttackInput,
            damageRampMultiplier: stats.firstAttackDamageMultiplier * stats.firstShotMagazineDamageMultiplier,
        });
    }, [activeTargetAttackInput, activeMetrics, activeAttackModelLimitationBlocksScoring]);
    const finiteTargetAttackInput = useMemo<DirectTargetDamageInput | null>(() => {
        if (!activeTargetAttackInput || !finiteMetrics) return null;
        const stats = finiteMetrics.modded;
        return {
            ...activeTargetAttackInput,
            expectedHitDamageMultiplier: avgHitDamageMultiplier(
                stats.critChance + stats.punctureCritChanceBonus,
                stats.critMultiplier + stats.coldCritDamageBonus,
                stats.nonCriticalHitDamageProcs,
                stats.hitLocation,
                stats.vigilanteCritTierEnhancementChance,
            ),
            critChance: stats.critChance + stats.punctureCritChanceBonus,
            critMultiplier: stats.critMultiplier + stats.coldCritDamageBonus,
            critTierEnhancementChance: stats.vigilanteCritTierEnhancementChance,
            nonCriticalHitDamageProcs: stats.nonCriticalHitDamageProcs,
        };
    }, [activeTargetAttackInput, finiteMetrics]);
    const activeTargetAttackSequence = useMemo(() => {
        if (
            !finiteTargetAttackInput ||
            !activeMetrics ||
            !finiteMetrics ||
            activeFiniteAttackModelLimitationBlocksScoring ||
            activeCalcWeapon?.selectedAttackAutoSpoolTimingLimitation
        ) return null;
        const stats = finiteMetrics.modded;
        return simulateDirectAttackSequence({
            ...finiteTargetAttackInput,
            enemyShieldGateHitMode: targetProfileOverride?.enemyShieldGateHitMode,
            initialAttackDelaySeconds: stats.initialAttackDelaySeconds,
            attackIntervalSeconds: 1 / Math.max(0.0001, stats.fireRate),
            autoSpoolCadenceRule: activeCalcWeapon?.selectedAttackAutoSpoolCadence,
            autoSpoolShotSequenceRule: activeCalcWeapon?.selectedAttackAutoSpoolShotSequence,
            shotsPerMagazine: stats.finiteShotsPerMag,
            attackCountLimit: !stats.ammoGateSatisfied
                ? 0
                : activeCalcWeapon?.selectedAttackIsIncarnon && activeCalcWeapon.selectedAttackIncarnonAmmoCapacity !== undefined
                    ? stats.finiteShotsPerMag
                    : undefined,
            infiniteAmmoActive: stats.infiniteAmmoActive,
            firstShotMagazineDamageBonus: stats.firstShotMagazineDamageBonus,
            lastShotMagazineDamageBonus: stats.lastShotMagazineDamageBonus,
            reloadDurationSeconds: activeCalcWeapon?.weaponType.trim().toLowerCase() === "bow" ? 0 : stats.reloadTimeWithoutDirectHitBuff,
            directHitReloadSpeedRule: stats.directHitReloadSpeedRule,
            critChance: stats.critChance + stats.punctureCritChanceBonus,
            critMultiplier: stats.critMultiplier + stats.coldCritDamageBonus,
            ...(activeCalcWeapon?.selectedAttackUsesMeleeComboMultiplier && activeCalcWeapon
                ? {
                    heavyAttackCombo: {
                        startingPoints: stats.meleeComboPointsBeforeHeavyAttack,
                        startingMultiplier: stats.meleeComboMultiplier,
                        pointsPerTier: getMeleeComboRules(activeCalcWeapon).pointsPerTier,
                        maxMultiplier: getMeleeComboRules(activeCalcWeapon).maxMultiplier,
                        heavyAttackEfficiency: stats.heavyAttackEfficiency,
                        initialComboPoints: stats.meleeInitialComboPoints,
                        startingCritChance: stats.critChance + stats.punctureCritChanceBonus,
                        critChancePerTier: stats.comboCritChancePerTier,
                        critDamageMultiplier: stats.critMultiplier + stats.coldCritDamageBonus,
                    },
                }
                : {}),
            ...effectiveBurstTiming(activeCalcWeapon, stats.fireRate),
        });
    }, [finiteTargetAttackInput, activeMetrics, finiteMetrics, activeCalcWeapon, targetProfileOverride, activeFiniteAttackModelLimitationBlocksScoring]);
    const activeTargetEncounter = useMemo(() => {
        if (
            !encounterTargetMetrics ||
            activeFiniteAttackModelLimitationBlocksScoring ||
            activeCalcWeapon?.selectedAttackAutoSpoolTimingLimitation
        ) return null;
        const stats = encounterTargetMetrics.modded;
        return simulateExpectedWeaponEncounter({
            damageByType: stats.damageBreakdownBeforePerStatus,
            rawDamageByType: stats.rawDamageBreakdownBeforePerStatus,
            baseDamageTotal: stats.baseDamageTotal,
            health: activeTargetAssumptions.health,
            shields: activeTargetAssumptions.shields,
            overguard: activeTargetAssumptions.overguard,
            maxShields: activeTargetAssumptions.shields,
            maxOverguard: activeTargetAssumptions.overguard,
            armor: activeTargetAssumptions.armor,
            baseArmorValue: targetProfileOverride?.armorBaseValue ?? activeTargetAssumptions.armor,
            armorLevelMultiplier: targetProfileOverride?.armorLevelMultiplier ?? 1,
            shatteringImpactBaseArmorPerHit: stats.shatteringImpactBaseArmorPerHit,
            faction: factionOn ? faction : "",
            factionDamageBonus: stats.factionDamageBonus,
            toxinBypassesShields: activeTargetAssumptions.toxinBypassesShields,
            enemyShieldGateHitMode: targetProfileOverride?.enemyShieldGateHitMode,
            damageRampRule: activeCalcWeapon?.selectedAttackDamageRamp,
            critChance: stats.critChance,
            critMultiplier: stats.critMultiplier,
            critTierEnhancementChance: stats.vigilanteCritTierEnhancementChance,
            nonCriticalHitDamageProcs: stats.nonCriticalHitDamageProcs,
            expectedProjectiles: stats.multishot,
            expectedDamageMultiplier: stats.damageWeightedMultishot,
            singleProjectileDamageBonus: stats.singleProjectileDamageBonus,
            initialAttackDelaySeconds: stats.initialAttackDelaySeconds,
            attackIntervalSeconds: 1 / Math.max(0.0001, stats.fireRate),
            autoSpoolCadenceRule: activeCalcWeapon?.selectedAttackAutoSpoolCadence,
            autoSpoolShotSequenceRule: activeCalcWeapon?.selectedAttackAutoSpoolShotSequence,
            shotsPerMagazine: stats.finiteShotsPerMag,
            attackCountLimit: !stats.ammoGateSatisfied
                ? 0
                : activeCalcWeapon?.selectedAttackIsIncarnon && activeCalcWeapon.selectedAttackIncarnonAmmoCapacity !== undefined
                    ? stats.finiteShotsPerMag
                    : undefined,
            infiniteAmmoActive: stats.infiniteAmmoActive,
            firstShotMagazineDamageBonus: stats.firstShotMagazineDamageBonus,
            lastShotMagazineDamageBonus: stats.lastShotMagazineDamageBonus,
            reloadDurationSeconds: activeCalcWeapon?.weaponType.trim().toLowerCase() === "bow" ? 0 : stats.reloadTimeWithoutDirectHitBuff,
            directHitReloadSpeedRule: stats.directHitReloadSpeedRule,
            ...effectiveBurstTiming(activeCalcWeapon, stats.fireRate),
            statusDurationMultiplier: stats.statusDurationMultiplier,
            ...(stats.nightwatchNapalm ? {
                nightwatchNapalm: {
                    directDamagePerProjectilePerTick: stats.nightwatchNapalm.directDamagePerProjectilePerTick,
                    heatProcChancePerTick: stats.nightwatchNapalm.heatProcChancePerTick,
                    heatStatusDurationSeconds: stats.nightwatchNapalm.heatStatusDurationSeconds,
                    heatDotDamagePerProcPerTick: stats.nightwatchNapalm.heatDotDamagePerProcPerTick,
                    heatDotAccumulatorDamagePerTick: stats.nightwatchNapalm.heatDotAccumulatorDamagePerTick,
                heatDotDamagePerProcPerTickWhenExternallyInherited:
                    stats.nightwatchNapalm.heatDotDamagePerProcPerTickWhenExternallyInherited,
                heatDotAccumulatorDamagePerTickWhenExternallyInherited:
                    stats.nightwatchNapalm.heatDotAccumulatorDamagePerTickWhenExternallyInherited,
                },
            } : {}),
            attachedAttackDamageSequence: stats.attachedAttackDamageSequence,
            targetStatusDamageVulnerabilityBonus: stats.targetStatusDamageVulnerabilityBonus,
            initialHeatStatusPresenceProbability: targetStartsWithHeat ? 1 : 0,
            dotDamagePerAttackByType: stats.dotDamagePerShotByType,
            dotDamagePerApplicationByType: Object.fromEntries(
                Object.entries(stats.dotDamagePerShotByType).flatMap(([rawType, damagePerAttack]) => {
                    const type = rawType as StatusDamageType;
                    const applications = stats.averageProcsPerShot * (stats.procChanceByType[type] ?? 0);
                    return applications > 0 ? [[type, damagePerAttack / applications]] : [];
                }),
            ) as Partial<Record<StatusDamageType, number>>,
            heatDotTickDamagePerProc: stats.dotTickDamagePerProcBeforeConditionOverloadByType.heat,
            heatDotAccumulatorDamagePerTick: stats.dotTickAccumulatorDamageByType.heat,
            heatDotTickDamagePerProcWhenExternallyInherited:
                stats.heatDotTickDamagePerProcWhenExternallyInherited,
            heatDotAccumulatorDamagePerTickWhenExternallyInherited:
                stats.heatDotAccumulatorDamagePerTickWhenExternallyInherited,
            dotSeedDamagePerApplicationByType: stats.dotDamagePerApplicationSeedByType,
            dotAccumulatorDamagePerApplicationByType: stats.dotDamagePerApplicationAccumulatorByType,
            statusProcWeightsByType: stats.damageBreakdownBeforePerStatus,
            statusRollsPerAttack: stats.multishot * stats.statusChance,
            forcedStatusApplicationsPerAttackByType: stats.unfilteredExtraProcsPerShot as Partial<Record<StatusDamageType, number>>,
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            blastStackHitDamagePerProc: stats.blastStackHitDamagePerProcBeforeConditionOverload,
            nearbyBlastEnemyCount: targetProfileOverride?.nearbyBlastEnemyCount,
            nearbyElectricGasEnemyCount: targetProfileOverride?.nearbyEnemyCount,
            nearbyGasOuterEnemyCount: targetProfileOverride?.nearbyGasOuterEnemyCount,
            magneticBreakElectricSourceMultiplier: stats.magneticBreakElectricSourceMultiplier,
            directDamagePerStatusBonus: stats.directDamagePerStatusBonus,
            conditionOverloadDamagePerStatusBonus: stats.conditionOverloadApplies
                ? stats.conditionOverloadDamagePerStatusBonus
                : 0,
            externalConditionOverloadStatusTypeCount: externalStatusTypeCount,
            externalStatusTypes,
            uniqueStatusProcsPerAttack: activeCalcWeapon?.uniqueStatusProcs,
            intrinsicDamagePerStatusBonus: stats.intrinsicDamagePerStatusBonus,
            intrinsicDamagePerStatusMode: stats.intrinsicDamagePerStatusMode,
            totalDamageBonus: stats.totalDamageBonus,
            timedConditionalDamageStacks: stats.timedConditionalDamageStacks,
        });
    }, [encounterTargetMetrics, activeCalcWeapon, factionOn, faction, activeTargetAssumptions, targetStatusImmunities, targetProfileOverride, externalStatusTypeCount, externalStatusTypes, targetStartsWithHeat, activeFiniteAttackModelLimitationBlocksScoring]);
    const activeAttackEventLabel = activeCalcWeapon && isBurstTriggerType(activeCalcWeapon.trigger) ? "rounds" : "attacks";
    const selectedAttackOutOfRange = activeMetrics?.modded.attackDamageFalloff?.isOutOfRangeMiss === true;
    const activeEncounterStatusSummary = activeTargetEncounter
        ? Object.entries(activeTargetEncounter.statusApplicationsByType)
            .filter(([, count]) => (count ?? 0) >= 0.01)
            .map(([type, count]) => `${type[0].toUpperCase()}${type.slice(1)} ${fmt(count ?? 0, 1)}`)
            .join(" · ") || "None"
        : "—";
    const activeTargetSummary = selectedEnemyProfile
        ? `${selectedEnemyProfile.name} · level ${getSteelPathEnemyLevel(enemyCurrentLevel, isSteelPath)}${isSteelPath ? " Steel Path" : ""}${punctureVipStackCap ? " · Overguarded VIP (3 Puncture stacks)" : ""}${nearbyEnemyCount > 0 ? ` · +${nearbyEnemyCount} Electric/Gas ≤3m` : ""}${nearbyGasOuterEnemyCount > 0 ? ` · +${nearbyGasOuterEnemyCount} Gas 3–6m` : ""}${nearbyBlastEnemyCount > 0 ? ` · +${nearbyBlastEnemyCount} Blast` : ""}`
        : targetProfileOverride
        ? `${scaleCustomTargetByLevel ? `Custom target · level ${getSteelPathEnemyLevel(enemyCurrentLevel, isSteelPath)}${isSteelPath ? " Steel Path" : ""}` : "Custom current-level target pools"}${factionOn ? ` · ${faction} damage modifiers` : ""}${punctureVipStackCap ? " · Overguarded VIP (3 Puncture stacks)" : ""}${nearbyEnemyCount > 0 ? ` · +${nearbyEnemyCount} Electric/Gas ≤3m` : ""}${nearbyGasOuterEnemyCount > 0 ? ` · +${nearbyGasOuterEnemyCount} Gas 3–6m` : ""}${nearbyBlastEnemyCount > 0 ? ` · +${nearbyBlastEnemyCount} Blast` : ""}`
        : factionOn
            ? `${faction} synthetic faction estimate`
            : "Balanced synthetic target estimate";
    const activeDamageTypeSources = useMemo(
        () => activeCalcWeapon ? buildDamageTypeSourceDescriptions(activeCalcWeapon, activeBuildEffects, activeBuildEffectSourceLabels) : {},
        [activeCalcWeapon, activeBuildEffects, activeBuildEffectSourceLabels],
    );

    const capacity = useMemo(() => {
        if (!weapon) return null;
        return computeCapacity(capacityCfg, allPolsForCap.map(p => ({ polarity: p })), allSlotsForCap, allRanksForCap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weapon, allSlotsForCap, allPolsForCap, allRanksForCap, buildCfg]);
    const displayedCapacity = useMemo(() => {
        if (!capacity) return null;
        const total = capacity.totalCapacity + capacity.auraGrant;
        const remaining = capacity.remainingCapacity;
        const used = total - remaining;
        return { total, used, remaining, over: capacity.overCapacity };
    }, [capacity]);

    async function handleOptimize() {
        if (!weapon) return;
        const optimizerTennokaiAttackPair = goal === "tennokaiDps"
            ? findSupportedTennokaiAttackPair(weapon)
            : null;
        if (goal === "tennokaiDps" && !optimizerTennokaiAttackPair) {
            setOptimizerNotice("Tennokai Cycle DPS needs one supported Normal Attack plus a direct Heavy Attack or centered Heavy Slam row.");
            return;
        }
        if (selectedAttackOutOfRange && goal !== "tennokaiDps") {
            setOptimizerNotice("The selected attack misses at the configured distance. Move the target inside its hit limit before optimizing.");
            return;
        }
        if (onlyOwned && ownedSet.size === 0) return;
        const selectedAttackAutoSpoolLimitation = weapon.attacks[selectedAttackIdx]?.autoSpoolTimingLimitation;
        if ((goal === "timeToKill" || goal === "windowDps") && selectedAttackAutoSpoolLimitation) {
            setOptimizerNotice(
                `${goal === "timeToKill" ? "Expected TTK" : "5s Avg DPS"} is unavailable for ${weapon.attacks[selectedAttackIdx]?.name ?? weapon.name}: ` +
                `${selectedAttackAutoSpoolLimitation.reason} Wiki: ${selectedAttackAutoSpoolLimitation.sourceUrl}`,
            );
            return;
        }
        const selectedAttackModelLimitation = weapon.attacks[selectedAttackIdx]?.modelLimitation;
        if (selectedAttackModelLimitation && goal !== "tennokaiDps") {
            setOptimizerNotice(
                `Auto Optimize is unavailable for ${weapon.attacks[selectedAttackIdx]?.name ?? weapon.name}: ` +
                `${selectedAttackModelLimitation.reason} Wiki: ${selectedAttackModelLimitation.sourceUrl}`,
            );
            return;
        }
        if (goal === "meleeDps" && (!meleeDpsGoalAvailable || !meleeDpsInputs)) {
            setOptimizerNotice("Select a melee stance with a Wiki Neutral-combo reference to optimize Wiki Stance DPS.");
            return;
        }
        if (useCustomTargetStats && customTargetStats.health + customTargetStats.shields + customTargetStats.overguard <= 0) {
            setOptimizerNotice("Enter a positive Health, Shields, or Overguard value for the custom target.");
            return;
        }
        optimizerCancelledRef.current = false;
        optimizerApplyingRef.current = false;
        optimizerInputSignatureRef.current = optimizerInputSignature;
        setOptimizerNotice(null);
        setOptimizerProgress("Preparing optimizer…");
        setOptimizing(true);
        await new Promise(r => setTimeout(r, 10));
        try {
            if (optimizerCancelledRef.current) return;
            const worker = new Worker(new URL("../../workers/buildOptimizer.worker.ts", import.meta.url), { type: "module" });
            optimizerWorkerRef.current = worker;
            const optimizeInWorker = (
                candidateWeapon: WeaponEntry,
                candidateMods: ModEntry[],
                candidateGoal: OptimizeGoal,
                slotCount: number,
                options: Parameters<typeof optimizeBuild>[4],
            ) => new Promise<ReturnType<typeof optimizeBuild>>((resolve, reject) => {
                const id = ++optimizerRequestIdRef.current;
                pendingWorkerRejectRef.current = reject;
                worker.onmessage = (event: MessageEvent<{ id: number; result?: ReturnType<typeof optimizeBuild>; error?: string }>) => {
                    if (event.data.id !== id) return;
                    pendingWorkerRejectRef.current = null;
                    if (event.data.error) reject(new Error(event.data.error));
                    else if (event.data.result) resolve(event.data.result);
                    else reject(new Error("The optimizer worker returned no result."));
                };
                worker.onerror = (event) => {
                    pendingWorkerRejectRef.current = null;
                    reject(new Error(event.message || "The optimizer worker failed."));
                };
                worker.postMessage({
                    id,
                    weapon: candidateWeapon,
                    availableMods: candidateMods,
                    goal: candidateGoal,
                    slotCount,
                    options,
                });
            });
            const fillMode = optimizeMode === "fill";
            const optimizeArcaneForRun = optArcane && (!fillMode || !arcane1);
            const lockedMainSlots = fillMode ? [...slots] : Array(SLOT_COUNT).fill(null);
            const lockedMainRanks = fillMode ? [...ranks] : Array(SLOT_COUNT).fill(undefined);
            const lockedSlotMask = fillMode ? slots.map((mod) => !!mod) : Array(SLOT_COUNT).fill(false);
            const lockedExternalEffects: ModEffect[] = [];
            let lockedArcaneEffect: ModEffect | null = null;
            if (fillMode && hasExilus && exilusMod) {
                lockedExternalEffects.push(exilusMod.effectsByRank[exilusRank] ?? exilusMod.effect);
            }
            if (includeArcaneStats && arcane1 && !optimizeArcaneForRun) {
                const resolved = getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, true, arcaneEnergyContext);
                if (resolved) {
                    lockedArcaneEffect = {
                        ...emptyEffect(),
                        ...resolved,
                        conditionalEffects: [...(resolved.conditionalEffects ?? [])],
                    };
                    lockedExternalEffects.push(lockedArcaneEffect);
                }
            }
            const lockedIncompatibilityGroups = fillMode
                ? new Set(slots.filter((mod): mod is ModEntry => !!mod).map((mod) => mod.incompatibilityGroup))
                : undefined;
            const lockedUniqueNames = fillMode
                ? new Set(slots.filter((mod): mod is ModEntry => !!mod).map((mod) => mod.uniqueName))
                : undefined;
            const availableFormaBudget = allowForma
                ? Math.max(0, maxFormaAllowed - formaCount)
                : maxFormaAllowed;
            let optimizerStanceMod = stanceMod;
            let optimizerStanceRank = stanceRank;
            const keepSelectedMeleeStance = Boolean(
                goal === "meleeDps" &&
                stanceMod &&
                (!onlyOwned || ownedSet.has(stanceMod.uniqueName)),
            );
            if (supportsStanceLikeMods(weapon)) {
                if ((!fillMode || !stanceMod) && !keepSelectedMeleeStance) {
                    const stanceCandidates = onlyOwned
                        ? stanceMods.filter(mod => ownedSet.has(mod.uniqueName))
                        : stanceMods;
                    const candidateStances = goal === "meleeDps"
                        ? stanceCandidates.filter((mod) => !!getWikiMeleeStanceCombo(mod.name))
                        : stanceCandidates;
                    const bestStance = candidateStances.reduce<ModEntry | null>((best, current) => {
                        if (!stancePol) return best;
                        if (!best) return current;
                        const bestDrain = effectiveDrain(best, stancePol, best.fusionLimit);
                        const currentDrain = effectiveDrain(current, stancePol, current.fusionLimit);
                        return currentDrain < bestDrain ? current : best;
                    }, null);
                    optimizerStanceMod = bestStance;
                    optimizerStanceRank = bestStance
                        ? Math.min(bestStance.fusionLimit, ownedModMaxRankByUniqueName[bestStance.uniqueName] ?? bestStance.fusionLimit)
                        : 0;
                }
            }
            const optimizerMeleeStanceCombo = goal === "meleeDps" && optimizerStanceMod
                ? getWikiMeleeStanceCombo(optimizerStanceMod.name) ?? undefined
                : undefined;
            if (goal === "meleeDps" && !optimizerMeleeStanceCombo) {
                setOptimizerNotice("Wiki Stance DPS requires an owned stance with a Wiki Neutral-combo reference.");
                setOptimizerProgress(null);
                return;
            }

            const scoreOptimizerResult = (
                candidateWeapon: WeaponEntry,
                candidateAttackIdx: number,
                candidateResult: ReturnType<typeof optimizeBuild>,
                preEquippedEffects: ModEffect[],
                useFiniteEncounterResult = true,
                meleeStanceCombo?: MeleeAverageDpsParameters,
            ) => {
                return scoreOptimizerResultForConfiguration({
                    weapon: candidateWeapon,
                    result: candidateResult,
                    goal,
                    targetFaction: factionOn ? faction : "",
                    selectedAttackIdx: candidateAttackIdx,
                    targetProfileOverride,
                    conditionalState,
                    preEquippedEffects,
                    includeExilus: optExilus,
                    warframeArmor,
                    warframeMaxEnergy,
                    warframeEnergyPercent,
                    useFiniteEncounterResult,
                    meleeStanceCombo,
                });
            };

            const runOptimizeForConfig = async (
                valenceElement: ValenceElement,
                incarnonCandidate: IncarnonCandidateConfig,
            ) => {
                const attackIdxForObjective = goal === "tennokaiDps"
                    ? optimizerTennokaiAttackPair!.regularAttackIndex
                    : selectedAttackIdx;
                const candidateCfg: BuildCfg = {
                    ...buildCfg,
                    valenceElement,
                    incarnonUnlockedTier: incarnonCandidate.unlockedTier,
                    incarnonSelectedOptionsByTier: incarnonCandidate.selectedOptionsByTier,
                };
                const weaponState = applyWeaponConfig(weapon, attackIdxForObjective, candidateCfg);
                const weaponForOpt = weaponState.weaponWithIntrinsicOptions;
                const atk = weaponForOpt.attacks.length > 1 ? weaponForOpt.attacks[attackIdxForObjective] : null;

                // If allowCatalyst, override capacityCfg to hasCatalyst:true
                const capForOpt = capacityCfg;

                const result = await optimizeInWorker(weaponForOpt, compatMods, goal, SLOT_COUNT, {
                    ownedModUniqueNames:    onlyOwned ? ownedSet : undefined,
                    ownedModMaxRankByUniqueName: onlyOwned ? ownedModMaxRankByUniqueName : undefined,
                    ownedArcaneUniqueNames: onlyOwned ? ownedArcaneUniqueNames : undefined,
                    ownedArcaneMaxRankByUniqueName: onlyOwned ? ownedArcaneMaxRankByUniqueName : undefined,
                    excludedModUniqueNames: excluded.size > 0 ? excluded : undefined,
                    allowNonMaxRank:  allowNonMax,
                    targetFaction:    factionOn ? faction : "",
                    targetProfileOverride,
                    capacityConfig:   capForOpt,
                    slotPolarities:   slotPols,
                    defaultSlotPolarities: slotPols,
                    allowCatalyst,
                    allowForma,
                    maxFormaCount: allowForma ? availableFormaBudget : undefined,
                    optimizeExilus:   fillMode ? (optExilus && hasExilus && !exilusMod ? true : optExilus && !hasExilus) : optExilus,
                    exilusPolarity:   exilusPol,
                    optimizeArcane:   optimizeArcaneForRun,
                    arcaneCandidates: optimizeArcaneForRun ? getArcanesForWeapon(weaponForOpt) : [],
                    warframeArmor,
                    warframeMaxEnergy,
                    warframeEnergyPercent,
                    buildForAttack:   atk,
                    conditionalState,
                    meleeStanceCombo: optimizerMeleeStanceCombo,
                    extraCapacitySlots: supportsStanceLikeMods(weapon) && optimizerStanceMod
                        ? [{ mod: optimizerStanceMod, rank: optimizerStanceRank, polarity: stancePol }]
                        : undefined,
                    preEquippedEffects: [...weaponState.activeIncarnonEffects, ...lockedExternalEffects],
                    lockedSlots: fillMode ? lockedMainSlots : undefined,
                    lockedSlotRanks: fillMode ? lockedMainRanks : undefined,
                    lockedSlotMask: fillMode ? lockedSlotMask : undefined,
                    lockedIncompatibilityGroups,
                    lockedUniqueNames,
                });

                const appliedResult = result;
                const appliedCatalyst = buildCfg.hasCatalyst || result.needsCatalyst;
                const baseExtraCapacitySlots = supportsStanceLikeMods(weapon) && optimizerStanceMod
                    ? [{ mod: optimizerStanceMod, rank: optimizerStanceRank, polarity: stancePol }]
                    : undefined;

                return {
                    weaponForOpt,
                    atk,
                    appliedResult,
                    appliedCatalyst,
                    baseExtraCapacitySlots,
                    score: scoreOptimizerResult(weaponForOpt, attackIdxForObjective, appliedResult, [
                        ...weaponState.activeIncarnonEffects,
                        ...lockedExternalEffects,
                    ], true, optimizerMeleeStanceCombo),
                    valenceElement,
                    incarnonSelectedOptionsByTier: incarnonCandidate.selectedOptionsByTier,
                };
            };

            const valenceElementsToTry = weapon.isProgenitorWeapon && buildCfg.valenceBonusPct > 0 && buildCfg.optimizeValenceElement && buildCfg.weaponRank >= 40
                ? VALENCE_ELEMENTS.map((entry) => entry.key)
                : [buildCfg.valenceElement];
            const incarnonCandidates = buildIncarnonCandidateConfigs(
                incarnonRecord,
                buildCfg.incarnonSelectedOptionsByTier,
                buildCfg.optimizeIncarnonSelections,
            );
            const currentIncarnonCandidate: IncarnonCandidateConfig = {
                unlockedTier: getHighestSelectedIncarnonTier(buildCfg.incarnonSelectedOptionsByTier),
                selectedOptionsByTier: { ...buildCfg.incarnonSelectedOptionsByTier },
            };
            const configSignature = (valenceElement: ValenceElement, candidate: IncarnonCandidateConfig) =>
                `${valenceElement}|${Object.entries(candidate.selectedOptionsByTier)
                    .sort(([left], [right]) => Number(left) - Number(right))
                    .map(([tier, option]) => `${tier}:${option}`)
                    .join("|")}`;
            const baselineRuns: Array<Awaited<ReturnType<typeof runOptimizeForConfig>>> = [];
            let evaluatedConfigs = 0;
            for (const candidateElement of valenceElementsToTry) {
                if (optimizerCancelledRef.current) return;
                setOptimizerProgress(`Evaluating baseline configuration ${evaluatedConfigs + 1} of ${valenceElementsToTry.length}…`);
                baselineRuns.push(await runOptimizeForConfig(candidateElement, currentIncarnonCandidate));
                evaluatedConfigs += 1;
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            let bestRun = baselineRuns.reduce<Awaited<ReturnType<typeof runOptimizeForConfig>> | null>(
                (best, run) => !best || run.score > best.score ? run : best,
                null,
            );
            if (!bestRun) {
                setOptimizerNotice("No legal build fits the current capacity and locked-slot settings.");
                setOptimizerProgress(null);
                return;
            }

            if (buildCfg.optimizeIncarnonSelections && incarnonCandidates.length > 0) {
                setOptimizerProgress(`Screening ${incarnonCandidates.length * baselineRuns.length} Incarnon paths against the baseline builds…`);
                await new Promise((resolve) => setTimeout(resolve, 0));
                const screenedCandidates: Array<{
                    signature: string;
                    valenceElement: ValenceElement;
                    incarnonCandidate: IncarnonCandidateConfig;
                    score: number;
                    path?: IncarnonCandidateConfig["selectedOptionsByTier"];
                }> = [];

                for (const baselineRun of baselineRuns) {
                    for (const incarnonCandidate of incarnonCandidates) {
                        if (optimizerCancelledRef.current) return;
                        if (configSignature(baselineRun.valenceElement, incarnonCandidate) === configSignature(
                            baselineRun.valenceElement,
                            { unlockedTier: getHighestSelectedIncarnonTier(baselineRun.incarnonSelectedOptionsByTier), selectedOptionsByTier: baselineRun.incarnonSelectedOptionsByTier },
                        )) continue;

                        const candidateCfg: BuildCfg = {
                            ...buildCfg,
                            valenceElement: baselineRun.valenceElement,
                            incarnonUnlockedTier: incarnonCandidate.unlockedTier,
                            incarnonSelectedOptionsByTier: incarnonCandidate.selectedOptionsByTier,
                        };
                        const candidateWeaponState = applyWeaponConfig(weapon, selectedAttackIdx, candidateCfg);
                        screenedCandidates.push({
                            signature: configSignature(baselineRun.valenceElement, incarnonCandidate),
                            valenceElement: baselineRun.valenceElement,
                            incarnonCandidate,
                            path: incarnonCandidate.selectedOptionsByTier,
                            score: scoreOptimizerResult(
                                candidateWeaponState.weaponWithIntrinsicOptions,
                                selectedAttackIdx,
                                baselineRun.appliedResult,
                                [...candidateWeaponState.activeIncarnonEffects, ...lockedExternalEffects],
                                false,
                            ),
                        });
                    }
                }

                const baselineSignatures = baselineRuns.map((run) => configSignature(
                    run.valenceElement,
                    {
                        unlockedTier: getHighestSelectedIncarnonTier(run.incarnonSelectedOptionsByTier),
                        selectedOptionsByTier: run.incarnonSelectedOptionsByTier,
                    },
                ));
                const selectedForRefinement = selectIncarnonSearchShortlist(
                    screenedCandidates,
                    baselineSignatures,
                    INCARNON_PATH_REFINEMENT_LIMIT,
                );

                for (const candidate of selectedForRefinement) {
                    if (optimizerCancelledRef.current) return;
                    setOptimizerProgress(`Refining evolution path ${evaluatedConfigs + 1} of ${baselineRuns.length + selectedForRefinement.length}…`);
                    const run = await runOptimizeForConfig(candidate.valenceElement, candidate.incarnonCandidate);
                    if (run.score > bestRun.score) bestRun = run;
                    evaluatedConfigs += 1;
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }
            if (optimizerCancelledRef.current) return;
            if (!bestRun || !bestRun.appliedResult.capacityValid) {
                setOptimizerNotice("No legal build fits the current capacity and locked-slot settings.");
                setOptimizerProgress(null);
                return;
            }
            optimizerApplyingRef.current = true;
            const { weaponForOpt, atk, appliedResult, appliedCatalyst, baseExtraCapacitySlots, valenceElement, incarnonSelectedOptionsByTier } = bestRun;
            if (baseExtraCapacitySlots?.[0]) {
                setStanceMod(baseExtraCapacitySlots[0].mod);
                setStanceRank(baseExtraCapacitySlots[0].rank);
            }
            if (weapon.isProgenitorWeapon && valenceElement !== buildCfg.valenceElement) {
                setBuildCfg(p => ({ ...p, valenceElement }));
            }
            if (incarnonRecord) {
                setBuildCfg(p => ({ ...p, incarnonSelectedOptionsByTier }));
            }

            // Apply exilus mod if optimized
            if (optExilus) {
                setHasExilus(true);
                setExilusMod(appliedResult.exilusMod);
                setExilusRank(appliedResult.exilusMod ? appliedResult.exilusRank : 0);
            } else if (!fillMode || !exilusMod) {
                setHasExilus(false);
                setExilusMod(null);
                setExilusRank(0);
                setExilusPol("");
            }

            const finalSlotsForCap = [...appliedResult.slots, ...(optExilus ? [appliedResult.exilusMod] : [])];
            const finalRanksForCap = [...appliedResult.slotRanks, ...(optExilus ? [appliedResult.exilusMod ? appliedResult.exilusRank : 0] : [])];
            const finalPolsForCap  = [...appliedResult.slotPolarities, ...(optExilus ? [appliedResult.exilusPolarity] : [])];

            if (
                appliedCatalyst ||
                appliedResult.needsCatalyst ||
                (allowCatalyst && shouldAutoInstallCatalyst(capacityCfg, finalPolsForCap, finalSlotsForCap, finalRanksForCap, baseExtraCapacitySlots ?? []))
            ) {
                setBuildCfg(p => ({ ...p, hasCatalyst: true }));
            }

            // The optimizer starts from the polarities already installed on this
            // build. Apply its result directly so a re-optimization never erases
            // existing Forma or silently spends beyond the remaining budget.
            const slotPolsToApply = [...appliedResult.slotPolarities];
            const stancePolToApply = stancePol;
            const exilusPolToApply = appliedResult.exilusMod ? appliedResult.exilusPolarity : exilusPol;

            // Apply mod slots. In fill mode, occupied user slots stay authoritative.
            const nextSlots = (fillMode
                ? appliedResult.slots.map((mod, i) => (lockedSlotMask[i] ? slots[i] : mod))
                : [...appliedResult.slots]) as (ModEntry | null)[];
            const nextRanks = (fillMode
                ? appliedResult.slotRanks.map((rank, i) => (lockedSlotMask[i] ? (ranks[i] ?? 0) : rank))
                : [...appliedResult.slotRanks]) as number[];
            setSlots(nextSlots);
            setRanks(nextRanks);

            // Apply polarity changes from forma optimizer
            if (allowForma) {
                setSlotPols([...slotPolsToApply]);
                setStancePol(stancePolToApply);
                setExilusPol(exilusPolToApply);
            }

            // Apply arcane if optimized
            if (optimizeArcaneForRun && appliedResult.arcane) {
                setArcane1(appliedResult.arcane);
                setArcane1Rank(appliedResult.arcaneRank);
            }

            const optimizedWeaponState = applyWeaponConfig(weapon, selectedAttackIdx, {
                ...buildCfg,
                valenceElement,
                incarnonSelectedOptionsByTier,
            });
            const mathEffects: (ModEffect | null)[] = [
                ...optimizedWeaponState.activeIncarnonEffects,
                ...appliedResult.slots.map((m, i) => {
                if (!m) return null;
                const r = appliedResult.slotRanks[i] ?? m.fusionLimit;
                return m.effectsByRank[r] ?? m.effect;
                }),
            ];
            if (optExilus && appliedResult.exilusMod) {
                mathEffects.push(appliedResult.exilusMod.effectsByRank[appliedResult.exilusRank] ?? appliedResult.exilusMod.effect);
            }
            if (includeArcaneStats && optArcane && appliedResult.arcane) {
                const ae = getArcaneEffectAtRank(appliedResult.arcane, appliedResult.arcaneRank, warframeArmor, true, arcaneEnergyContext);
                if (ae) mathEffects.push({
                    ...emptyEffect(),
                    ...ae,
                    conditionalEffects: [...(ae.conditionalEffects ?? [])],
                });
            }
            const explanationBaseEffects: (ModEffect | null)[] = [
                ...optimizedWeaponState.activeIncarnonEffects,
                ...lockedExternalEffects.filter((effect) => effect !== lockedArcaneEffect),
            ];
            if (optExilus && appliedResult.exilusMod) {
                explanationBaseEffects.push(appliedResult.exilusMod.effectsByRank[appliedResult.exilusRank] ?? appliedResult.exilusMod.effect);
            }
            const explanationArcaneEntry = optimizeArcaneForRun ? appliedResult.arcane : includeArcaneStats ? arcane1 : null;
            const explanationArcaneRank = optimizeArcaneForRun ? appliedResult.arcaneRank : arcane1Rank;
            const explanationArcane = explanationArcaneEntry
                ? getArcaneEffectAtRank(explanationArcaneEntry, explanationArcaneRank, warframeArmor, true, arcaneEnergyContext)
                : null;
            setReasoning(explainBuild(
                weaponForOpt,
                appliedResult.mods,
                appliedResult.ranks,
                goal,
                factionOn ? faction : "",
                atk,
                conditionalState,
                targetProfileOverride,
                {
                    baseEffects: explanationBaseEffects,
                    arcaneEffect: explanationArcane,
                    arcaneName: explanationArcaneEntry?.name,
                    arcaneRank: explanationArcaneEntry ? explanationArcaneRank : undefined,
                    meleeStanceCombo: optimizerMeleeStanceCombo,
                    objectiveEncounter: goal === "timeToKill" && appliedResult.encounterScore !== undefined
                        ? {
                            damagePerSecond: appliedResult.encounterScore,
                            timeToKillSeconds: appliedResult.encounterTimeToKillSeconds ?? null,
                            refined: appliedResult.encounterRefined ?? false,
                            candidatesEvaluated: appliedResult.encounterCandidatesEvaluated ?? 0,
                        }
                        : undefined,
                    fixedWindowObjective: goal === "windowDps" && appliedResult.windowDpsScore !== undefined
                        ? {
                            damage: appliedResult.windowDpsDamage ?? appliedResult.windowDpsScore * FIXED_WINDOW_DPS_SECONDS,
                            damagePerSecond: appliedResult.windowDpsScore,
                            windowSeconds: FIXED_WINDOW_DPS_SECONDS,
                            timeToKillSeconds: appliedResult.encounterTimeToKillSeconds ?? null,
                            refined: appliedResult.encounterRefined ?? false,
                            candidatesEvaluated: appliedResult.encounterCandidatesEvaluated ?? 0,
                        }
                        : undefined,
                },
            ));
            setReasoningContextAtOptimization(currentReasoningContextKey);
            const mathWeapon = makeSelectedAttackWeapon(weaponForOpt, selectedAttackIdx);
            const reasoningKillRate = estimateGalvanizedPerStatusKillRate(
                mathWeapon,
                mathEffects,
                factionOn ? faction : "",
                targetProfileOverride,
                conditionalState,
                externalStatusTypeCount,
                externalStatusTypes,
                targetStatusImmunities,
            );
            setReasoningMath(buildMathBreakdown(
                mathWeapon,
                mathEffects,
                factionOn ? faction : "",
                conditionalState,
                targetProfileOverride,
                meleeDpsInputs,
                reasoningKillRate,
            ));
            setOptimizerProgress(null);
        } catch (error) {
            if (!optimizerCancelledRef.current) {
                setOptimizerNotice(error instanceof Error ? error.message : String(error));
                setOptimizerProgress(null);
            }
        } finally {
            optimizerApplyingRef.current = false;
            optimizerWorkerRef.current?.terminate();
            optimizerWorkerRef.current = null;
            pendingWorkerRejectRef.current = null;
            setOptimizing(false);
        }
    }

    function handleLoadBuild(build: SavedBuild) {
        if (!weapon) return;
        const mods = build.slotModUniqueNames.map(un => compatMods.find(m => m.uniqueName === un) ?? null);
        const ns   = [...mods, ...Array(SLOT_COUNT).fill(null)].slice(0, SLOT_COUNT) as (ModEntry | null)[];
        setSlots(ns);
        setRanks(ns.map((m, i) => m ? (build.slotRanks?.[i] ?? m.fusionLimit) : 0));
        setSlotPols([...build.slotPolarities, ...Array(SLOT_COUNT).fill("")].slice(0, SLOT_COUNT));
            setBuildCfg(p => ({
                ...p,
            weaponRank: build.weaponRank,
            hasCatalyst: build.hasCatalyst,
            valenceBonusPct: build.valenceBonusPct ?? p.valenceBonusPct,
            valenceElement: (build.valenceElement as ValenceElement | undefined) ?? p.valenceElement,
            optimizeValenceElement: build.optimizeValenceElement ?? false,
            incarnonUnlockedTier: build.incarnonSelectedOptionsByTier
                ? getHighestSelectedIncarnonTier(build.incarnonSelectedOptionsByTier)
                : (build.incarnonUnlockedTier ?? p.incarnonUnlockedTier),
            incarnonSelectedOptionsByTier: build.incarnonSelectedOptionsByTier ?? p.incarnonSelectedOptionsByTier,
            optimizeIncarnonSelections: build.optimizeIncarnonSelections ?? false,
        }));
        if (build.stanceModUniqueName) {
            const sm = stanceMods.find(m => m.uniqueName === build.stanceModUniqueName) ?? null;
            setStanceMod(sm);
            setStanceRank(sm ? (build.stanceRank ?? sm.fusionLimit) : 0);
        } else {
            setStanceMod(null);
            setStanceRank(0);
        }
        setStancePol(build.stancePol ?? weapon.stancePolarity ?? "");
        setHasExilus(build.hasExilus ?? false);
        if (build.exilusModUniqueName) {
            const em = compatMods.find(m => m.uniqueName === build.exilusModUniqueName) ?? null;
            setExilusMod(em); setExilusRank(em ? (build.exilusRank ?? em.fusionLimit) : 0);
        }
        setExilusPol(build.exilusPol ?? "");
        if (build.arcane1UniqueName) {
            const a = weaponArcanes.find(a => a.uniqueName === build.arcane1UniqueName) ?? null;
            setArcane1(a); setArcane1Rank(build.arcane1Rank ?? 0);
        }
        const plannerConfig = build.plannerConfig;
        // Older or imported builds without planner settings must not inherit a
        // stale external status assumption from the previously loaded build.
        setExternalStatusTypeCount(0);
        setExternalVigilanteSetModCount(0);
        setExternalGladiatorSetModCount(0);
        setExternalNiraSetModCount(0);
        setStrainInfectionCystsAtImpact(0);
        setDreadfulKillshotCurrentHealth(0);
        setOverpressuredRoundsSpreadMinimumDegrees(undefined);
        setOverpressuredRoundsSpreadMaximumDegrees(undefined);
        setExternalStatusTypes([]);
        setExternalStatusTypesOpen(false);
        setTargetStartsWithHeat(false);
        setExternalHeatElementalDamageBonusPercentInput("0");
        setExternalHeatFactionDamageBonusPercentInput("0");
        setPlayerSlidingAtImpact(false);
        setWarframeArmorInput(readWarframeArmor(build.plannerConfig?.warframeArmor)?.toString() ?? "");
        setWarframeMaxEnergyInput(parseWarframeMaxEnergyInput(build.plannerConfig?.warframeMaxEnergy?.toString() ?? "")?.toString() ?? "");
        setWarframeEnergyPercentInput(parseWarframeEnergyPercentInput(build.plannerConfig?.warframeEnergyPercent?.toString() ?? "")?.toString() ?? "");
        if (plannerConfig) {
            if (plannerConfig.goal === "burst" || plannerConfig.goal === "scaling" || plannerConfig.goal === "timeToKill" || plannerConfig.goal === "windowDps" || plannerConfig.goal === "meleeDps" || plannerConfig.goal === "tennokaiDps") setGoal(plannerConfig.goal);
            const conditionalModes: ConditionalState["mode"][] = ["initial", "realistic", "fullyStacked", "custom"];
            if (plannerConfig.conditionalMode && conditionalModes.includes(plannerConfig.conditionalMode)) {
                setConditionalMode(plannerConfig.conditionalMode);
            }
            if (Number.isFinite(plannerConfig.externalConditionalStacks)) {
                setExternalConditionalStacks(Math.max(0, Math.min(20, plannerConfig.externalConditionalStacks ?? 1)));
            }
            setExternalStatusTypeCount(Number.isFinite(plannerConfig.externalStatusTypeCount)
                ? Math.max(0, Math.min(16, Math.floor(plannerConfig.externalStatusTypeCount ?? 0)))
                : 0);
            setExternalVigilanteSetModCount(Number.isFinite(plannerConfig.externalVigilanteSetModCount)
                ? Math.max(0, Math.min(6, Math.floor(plannerConfig.externalVigilanteSetModCount ?? 0)))
                : 0);
            setExternalGladiatorSetModCount(Number.isFinite(plannerConfig.externalGladiatorSetModCount)
                ? Math.max(0, Math.min(3, Math.floor(plannerConfig.externalGladiatorSetModCount ?? 0)))
                : 0);
            setExternalNiraSetModCount(Number.isFinite(plannerConfig.externalNiraSetModCount)
                ? Math.max(0, Math.min(2, Math.floor(plannerConfig.externalNiraSetModCount ?? 0)))
                : 0);
            setStrainInfectionCystsAtImpact(normalizeStrainInfectionCystCount(plannerConfig.strainInfectionCystsAtImpact));
            setDreadfulKillshotCurrentHealth(normalizeDreadfulKillshotCurrentHealth(plannerConfig.dreadfulKillshotCurrentHealth));
            setDeadlyManeuversShotsRemaining(normalizeDeadlyManeuversShotsRemaining(plannerConfig.deadlyManeuversShotsRemaining));
            setCriticalPrecisionHeadshotProjectiles(normalizeCriticalPrecisionHeadshotProjectiles(
                plannerConfig.criticalPrecisionHeadshotProjectiles,
            ));
            setUnseenDreadInvisibilityActive(plannerConfig.unseenDreadInvisibilityActive === true);
            const restoredExternalStatusTypes = normalizeExternalStatusTypes(plannerConfig.externalStatusTypes);
            setExternalStatusTypes(restoredExternalStatusTypes);
            setExternalStatusTypesOpen(restoredExternalStatusTypes.length > 0);
            setTargetStartsWithHeat(plannerConfig.targetStartsWithHeat === true);
            setExternalHeatElementalDamageBonusPercentInput(
                readExternalHeatBonusPercent(plannerConfig.externalHeatElementalDamageBonusPercent).toString(),
            );
            setExternalHeatFactionDamageBonusPercentInput(
                readExternalHeatBonusPercent(plannerConfig.externalHeatFactionDamageBonusPercent).toString(),
            );
            setPlayerSlidingAtImpact(plannerConfig.playerSlidingAtImpact === true && supportsKineticKiller);
            setMeleeComboMultiplier(Number.isFinite(plannerConfig.meleeComboMultiplier)
                ? clampMeleeComboMultiplier(weapon, plannerConfig.meleeComboMultiplier ?? 1)
                : 1);
            setTennokaiRegularHitsBetweenHeavy(Number.isFinite(plannerConfig.tennokaiRegularHitsBetweenHeavy)
                ? Math.max(1, Math.min(20, Math.floor(plannerConfig.tennokaiRegularHitsBetweenHeavy ?? 4)))
                : 4);
            setPhantasmaChargeAmmo(Number.isFinite(plannerConfig.phantasmaChargeAmmo)
                ? Math.max(2, Math.min(50, Math.round(plannerConfig.phantasmaChargeAmmo ?? 2)))
                : 2);
            setTargetDistanceMeters(Number.isFinite(plannerConfig.targetDistanceMeters)
                ? Math.max(0, plannerConfig.targetDistanceMeters ?? 0)
                : undefined);
            setAttackFalloffDistanceMeters(Number.isFinite(plannerConfig.attackFalloffDistanceMeters)
                ? Math.max(0, plannerConfig.attackFalloffDistanceMeters ?? 0)
                : undefined);
            setTargetRadiusMeters(Number.isFinite(plannerConfig.targetRadiusMeters)
                ? Math.max(0, plannerConfig.targetRadiusMeters ?? 0)
                : undefined);
            setOverpressuredRoundsSpreadMinimumDegrees(Number.isFinite(plannerConfig.overpressuredRoundsSpreadMinimumDegrees)
                ? Math.max(0.1, Math.min(180, plannerConfig.overpressuredRoundsSpreadMinimumDegrees ?? 0.1))
                : undefined);
            setOverpressuredRoundsSpreadMaximumDegrees(Number.isFinite(plannerConfig.overpressuredRoundsSpreadMaximumDegrees)
                ? Math.max(0.1, Math.min(180, plannerConfig.overpressuredRoundsSpreadMaximumDegrees ?? 0.1))
                : undefined);
            const attackIndexByName = plannerConfig.attackName
                ? weapon.attacks.findIndex((attack) => attack.name === plannerConfig.attackName)
                : -1;
            const storedAttackIndex = plannerConfig.attackIndex;
            setSelectedAttackIdx(attackIndexByName >= 0
                ? attackIndexByName
                : Number.isInteger(storedAttackIndex) && (storedAttackIndex ?? -1) >= 0 && (storedAttackIndex ?? 0) < weapon.attacks.length
                    ? storedAttackIndex ?? 0
                    : 0);

            const target = plannerConfig.target;
            setFactionOn(target?.enabled ?? false);
            setFaction(target?.faction || "Grineer");
            setHeadshotRatePercent(Number.isFinite(target?.headshotRatePercent)
                ? Math.max(0, Math.min(100, target?.headshotRatePercent ?? 0))
                : 0);
            setSelectedEnemyProfileId(target?.enemyProfileId && getEnemyProfile(target.enemyProfileId)
                ? target.enemyProfileId
                : "");
            setUseCustomTargetStats(target?.useCustomStats ?? false);
            setIsEximus(target?.isEximus ?? false);
            setBossBlastStackCap(target?.bossBlastStackCap ?? false);
            setPunctureVipStackCap(target?.punctureVipStackCap ?? false);
            setIsSteelPath(target?.isSteelPath ?? false);
            if (target?.baseStats) {
                const safeStat = (value: number, fallback: number) =>
                    Number.isFinite(value) ? Math.max(0, Math.min(1_000_000_000, value)) : fallback;
                setCustomTargetStats({
                    health: safeStat(target.baseStats.health, 25000),
                    shields: safeStat(target.baseStats.shields, 0),
                    overguard: safeStat(target.baseStats.overguard, 0),
                    armor: safeStat(target.baseStats.armor, 2700),
                });
            }
            setScaleCustomTargetByLevel(target?.scaleByLevel ?? false);
            const scalingFactions: EnemyScalingFaction[] = [
                "grineer", "corpus", "infested", "corrupted", "murmur", "sentient", "anarchs", "unaffiliated", "techrot",
            ];
            setEnemyScalingFaction(scalingFactions.includes(target?.scalingFaction as EnemyScalingFaction)
                ? target!.scalingFaction as EnemyScalingFaction
                : "grineer");
            const safeLevel = (value: number, fallback: number) =>
                Number.isFinite(value) ? Math.max(1, Math.min(9999, Math.floor(value))) : fallback;
            setEnemyBaseLevel(safeLevel(target?.baseLevel ?? 1, 1));
            setEnemyCurrentLevel(safeLevel(target?.currentLevel ?? 30, 30));
            setCustomToxinBypassesShields(target?.toxinBypassesShields ?? true);
            setEnemyShieldGateHitMode(target?.enemyShieldGateHitMode === "weakspot" || target?.enemyShieldGateHitMode === "blockedArea"
                ? target.enemyShieldGateHitMode
                : "body");
            const gasNeighborCounts = normalizeElectricGasNeighborCounts(
                target?.nearbyEnemyCount,
                target?.nearbyGasOuterEnemyCount,
            );
            setNearbyEnemyCount(gasNeighborCounts.innerCount);
            setNearbyGasOuterEnemyCount(gasNeighborCounts.outerCount);
            setNearbyBlastEnemyCount(Number.isFinite(target?.nearbyBlastEnemyCount)
                ? Math.max(0, Math.min(20, Math.floor(target?.nearbyBlastEnemyCount ?? 0)))
                : 0);
            setTargetStatusImmunities((target?.statusImmunities ?? [])
                .filter((type): type is StatusDamageType =>
                    (STATUS_DAMAGE_TYPES as readonly string[]).includes(type)));

            const options = plannerConfig.optimizerOptions;
            if (options) {
                setAllowNonMax(options.allowNonMax ?? false);
                setOnlyOwned(options.onlyOwned ?? false);
                setAllowCatalyst(options.allowCatalyst ?? false);
                setAllowForma(options.allowForma ?? false);
                setMaxFormaAllowed(Number.isInteger(options.maxFormaAllowed)
                    ? Math.max(1, Math.min(maxOptimizerFormaForWeapon(weapon), options.maxFormaAllowed ?? 1))
                    : maxOptimizerFormaForWeapon(weapon));
                setOptExilus(options.optimizeExilus ?? false);
                setOptArcane(options.optimizeArcane ?? false);
                setExcluded(new Set((options.excludedModUniqueNames ?? []).filter((name) => typeof name === "string")));
            }
        } else {
            // Old saved builds have no target snapshot. Do not accidentally apply
            // whichever experimental target happened to be selected at load time.
            setFactionOn(false);
            setSelectedEnemyProfileId("");
            setHeadshotRatePercent(0);
            setUseCustomTargetStats(false);
            setIsEximus(false);
            setBossBlastStackCap(false);
            setNearbyEnemyCount(0);
            setNearbyGasOuterEnemyCount(0);
            setNearbyBlastEnemyCount(0);
            setTargetStatusImmunities([]);
        }
        setTab("build");
    }

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <WorkspaceSegmented className="flex-wrap">
                {(["build","saves","owned","ownedArcanes","exclude"] as const).map(t => (
                    <WorkspaceSegmentedButton key={t} onClick={() => (weapon || t === "build") && setTab(t)}
                        active={tab === t}
                        disabled={!weapon && t !== "build"}
                        className={["rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors",
                            tab === t ? "border-slate-100 bg-slate-100 text-slate-900" : "border-slate-700 bg-slate-950/40 text-slate-400 hover:bg-slate-900",
                            !weapon && t !== "build" ? "opacity-40 cursor-not-allowed" : ""].join(" ")}>
                        {t === "build" ? "Build" : t === "saves" ? "Saved Builds" : t === "owned" ? "Owned Mods" : t === "ownedArcanes" ? "Owned Arcanes" : `Excluded${excluded.size ? ` (${excluded.size})` : ""}`}
                    </WorkspaceSegmentedButton>
                ))}
            </WorkspaceSegmented>

            {weapon && tab === "owned"   && <OwnedModsPanel key={weapon.uniqueName} availableMods={trackableMods} />}
            {weapon && tab === "ownedArcanes" && <OwnedArcanesPanel weapon={weapon} />}
            {weapon && tab === "saves"   && <SavedBuildsPanel weapon={weapon} selectedAttackIdx={selectedAttackIdx}
                scoreUnavailable={activeNonSentientAttackDpsUnavailable}
                scoreUnavailableReason={activeMetrics?.modded.pelletHitEstimate
                    ? "the comparison panel does not apply the editable target-radius and spread assumptions needed for this single-target pellet estimate."
                    : activeCalcWeapon?.selectedAttackModelLimitation?.reason}
                targetHasOverguard={activeTargetAssumptions.overguard > 0}
                availableMods={compatMods} currentSlots={slots} currentRanks={ranks}
                currentPolarities={slotPols} currentCfg={buildCfg}
                stanceMod={stanceMod} stanceRank={stanceRank} stancePol={stancePol}
                exilusMod={exilusMod} exilusPol={exilusPol}
                arcane1={arcane1} arcane1Rank={arcane1Rank}
                targetFaction={factionOn ? faction : ""} conditionalState={conditionalState} targetProfileOverride={targetProfileOverride}
                plannerConfig={savedPlannerConfig}
                hasExilus={hasExilus} onLoad={handleLoadBuild} />}
            {weapon && tab === "exclude" && <ExclusionList allMods={compatMods} excluded={excluded} onToggle={toggleExclude} />}

            {tab === "build" && (
                <>
                            <div className="rounded-[28px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] shadow-[var(--wf-shadow-panel)] overflow-visible">
                                <div className="border-b border-slate-800/80 bg-slate-950/70 px-4 py-3">
                                    <div className="flex flex-wrap items-start gap-3 justify-between">
                                        <div className="min-w-[min(100%,360px)] flex-1">
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--wf-warning)]">Arsenal Modding</div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                    <div className="w-[360px] max-w-full">
                                                        <WeaponSelector selected={weapon} onSelect={handleSelectWeapon} />
                                                    </div>
                                                    {weapon && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuildCfg(p => ({ ...p, hasCatalyst: !p.hasCatalyst }))}
                                                            className={[
                                                                "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide transition-colors",
                                                                buildCfg.hasCatalyst
                                                                    ? "border-amber-700/60 bg-amber-950/30 text-amber-300"
                                                                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-slate-100",
                                                            ].join(" ")}
                                                            title="Marks whether this weapon already has an Orokin Catalyst installed."
                                                        >
                                                            Catalyst
                                                        </button>
                                                    )}
                                                {weapon && formaCount > 0 && (
                                                    <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-300">
                                                        {formaCount} forma
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 justify-end">
                                            <div className="flex flex-wrap gap-1.5">
                                                {GOAL_OPTIONS.filter((option) =>
                                                    (option.key !== "meleeDps" || meleeDpsGoalAvailable) &&
                                                    (option.key !== "tennokaiDps" || tennokaiGoalAvailable),
                                                ).map(g => (
                                                    <GoalChip
                                                        key={g.key}
                                                        label={g.label}
                                                        desc={g.desc}
                                                        active={goal === g.key}
                                                        onClick={() => setGoal(g.key)}
                                                    />
                                                ))}
                                            </div>
                                            {(goal === "timeToKill" || goal === "windowDps") && weapon?.attacks[selectedAttackIdx]?.autoSpoolTimingLimitation && (
                                                <p role="note" className="basis-full text-right text-[10px] leading-relaxed text-amber-300">
                                                    Finite timing, Expected TTK, and 5s Avg DPS are unavailable because this attack's full per-shot spool behavior is not modeled. Steady-state stats still use the fully spooled Arsenal rate. {" "}
                                                    <a
                                                        href={weapon?.attacks[selectedAttackIdx]?.autoSpoolTimingLimitation?.sourceUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="underline underline-offset-2"
                                                    >Wiki source</a>
                                                </p>
                                            )}
                                            {weapon?.attacks[selectedAttackIdx]?.modelLimitation && (
                                                <p role="note" className="basis-full text-right text-[10px] leading-relaxed text-amber-300">
                                                    {activePelletHitEstimateEnabled && activeMetrics?.modded.pelletHitEstimate
                                                        ? `Experimental single-target estimate: ${fmt(activeMetrics.modded.pelletHitEstimate.nominalExpectedHits, 2)} expected pellet hits (${fmt(activeMetrics.modded.pelletHitEstimate.minimumExpectedHits, 2)}–${fmt(activeMetrics.modded.pelletHitEstimate.maximumExpectedHits, 2)} across the entered spread endpoints) from ${fmt(activeMetrics.modded.pelletHitEstimate.pelletsFired, 2)} pellets. ${activeOverpressuredBurstSnapshotApplies ? "The user-entered post-Rifle-kill spread snapshot and this rank's sourced Falloff Distance bonus affect one Buckshot event in manual Burst only; the prior Rifle kill, one-shot buff consumption, and repeat-fire timeline are not simulated, and finite TTK / 5s Avg DPS remain unavailable. " : "The midpoint cone drives manual damage/TTK/DPS estimates. "}Target overlap is not calibrated to gameplay. Area coverage remains unscored and Auto Optimize stays unavailable.`
                                                    : `${weapon.attacks[selectedAttackIdx].modelLimitation.reason} Component/source-row statistics below are reference values only; ${activeMetrics?.modded.ammoGateSatisfied === false ? "the magazine gate allows no release, so scored target damage and DPS are zero; finite TTK remains unavailable." : "target damage, DPS, and TTK scores are unavailable for this mode."} ${weapon.attacks[selectedAttackIdx].pelletSpreadCone
                                                            ? activeAccuracyAffectingEffect
                                                                ? "An equipped accuracy-affecting effect disables the experimental pellet estimate. "
                                                                : activeUnsupportedSpreadModifier
                                                                    ? "An equipped spread modifier with unknown numeric behavior disables the experimental pellet estimate. "
                                                                    : "Enter both attack distance and target radius to enable the experimental single-target estimate. "
                                                            : ""}Auto Optimize is unavailable for this mode.`} {" "}
                                                    <a
                                                        href={weapon.attacks[selectedAttackIdx].modelLimitation.sourceUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="underline underline-offset-2"
                                                    >Wiki source</a>
                                                </p>
                                            )}
                                            {weapon?.attacks[selectedAttackIdx]?.ammoGate && activeMetrics && (
                                                <p role={activeMetrics.modded.ammoGateSatisfied ? "note" : "alert"} className={`basis-full text-right text-[10px] leading-relaxed ${activeMetrics.modded.ammoGateSatisfied ? "text-sky-300" : "text-rose-300"}`}>
                                                    {activeMetrics.modded.ammoGateSatisfied
                                                        ? `This attack requires at least ${fmt(weapon.attacks[selectedAttackIdx].ammoGate.minimumMagazineAmmoToFire, 0)} rounds loaded. At ${fmt(activeMetrics.modded.magazineSize, 0)} rounds, it can fire ${fmt(activeMetrics.modded.shotsPerMag, 0)} times before reaching the trigger floor. `
                                                        : `This attack needs at least ${fmt(weapon.attacks[selectedAttackIdx].ammoGate.minimumMagazineAmmoToFire, 0)} rounds loaded to fire, but the current magazine holds ${fmt(activeMetrics.modded.magazineSize, 0)}. No attack is available at this capacity, so target damage and DPS scoring are zero; per-release damage stats remain theoretical. `}Ammo-efficiency effects reduce modeled ammo spent per release; the Wiki does not say whether they also lower this trigger threshold, so the planner keeps the {fmt(weapon.attacks[selectedAttackIdx].ammoGate.minimumMagazineAmmoToFire, 0)}-round gate fixed. {" "}
                                                    <a
                                                        href={weapon.attacks[selectedAttackIdx].ammoGate.sourceUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="underline underline-offset-2"
                                                    >Wiki source</a>
                                                </p>
                                            )}
                                            {weapon?.attacks[selectedAttackIdx]?.scoreBoundaryNote && (
                                                <p role="note" className="basis-full text-left text-[10px] leading-relaxed text-sky-300">
                                                    {weapon.attacks[selectedAttackIdx].scoreBoundaryNote.reason} {" "}
                                                    <a
                                                        href={weapon.attacks[selectedAttackIdx].scoreBoundaryNote.sourceUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="underline underline-offset-2"
                                                    >Wiki source</a>
                                                </p>
                                            )}
                                            <button
                                                onClick={() => setShowOptimizeOptions(v => !v)}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
                                            >
                                                Options {showOptimizeOptions ? "▴" : "▾"}
                                            </button>
                                            <div className="flex items-stretch overflow-hidden rounded-xl border border-amber-600/60 bg-amber-950/30">
                                                <button
                                                    onClick={optimizing ? cancelOptimization : handleOptimize}
                                                    disabled={!optimizing && (!weapon || !!weapon.attacks[selectedAttackIdx]?.modelLimitation || selectedAttackOutOfRange)}
                                                    className={[
                                                        "px-4 py-2 text-sm transition-colors font-semibold disabled:opacity-50",
                                                        optimizing ? "text-rose-300 hover:bg-rose-950/50" : "text-amber-300 hover:bg-amber-900/40",
                                                    ].join(" ")}>
                                                    {optimizing ? "Cancel Optimization" : optimizeMode === "fill" ? "Fill & Optimize" : "Optimize Build"}
                                                </button>
                                                <div className="relative w-10 border-l border-amber-600/40 focus-within:ring-2 focus-within:ring-amber-300/70">
                                                    <select
                                                        value={optimizeMode}
                                                        onChange={(e) => setOptimizeMode(e.target.value as OptimizeMode)}
                                                        disabled={optimizing}
                                                        className="h-full w-full appearance-none bg-transparent text-transparent opacity-0 outline-none"
                                                        aria-label="Optimization mode"
                                                    >
                                                        <option value="optimize" className="bg-slate-950 text-slate-100">Optimize</option>
                                                        <option value="fill" className="bg-slate-950 text-slate-100">Fill & Optimize</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-full items-center justify-center text-amber-200">
                                                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                                            <path d="M5 6.5L8 3.5L11 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                            <path d="M5 9.5L8 12.5L11 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleCopyBuildExport}
                                                disabled={!currentBuildExport}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                                            >
                                                {copiedExport ? "Copied Build JSON" : "Copy Build JSON"}
                                            </button>
                                            <button
                                                onClick={handleShareBuildImage}
                                                disabled={!currentBuildExport || sharingBuildImage}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                                            >
                                                {sharingBuildImage ? "Generating Image…" : sharedBuildImage ? "Shared Build Image" : "Share Build Image"}
                                            </button>
                                            <button
                                                onClick={() => weapon && resetBuildForWeapon(weapon)}
                                                disabled={!weapon}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                                            >
                                                Reset Build
                                            </button>
                                        </div>
                                    </div>
                                    {(optimizerProgress || optimizerNotice) && (
                                        <div className="mt-2 text-right text-[11px]" role={optimizerNotice ? "alert" : "status"}>
                                            {optimizerNotice
                                                ? <span className="text-amber-300">{optimizerNotice}</span>
                                                : <span className="text-slate-400">{optimizerProgress}</span>}
                                        </div>
                                    )}
                                    {weapon && (
                                        <p role="note" className="mt-2 text-right text-[10px] leading-relaxed text-amber-300">
                                            Vigilante, Gladiator, Sacrificial, Nira's Slam Damage, and Strain Infection set effects are modeled where triggered. Strain Infection uses the selected active-cyst count only for Burst at impact; its cyst timeline is not modeled, and finite or sustained scoring excludes the assumption. Sacrificial requires both selected melee mods; Nira applies only to melee slam attacks and adds to Seismic Wave. Other shared set bonuses remain excluded from damage, TTK, and Auto Optimize. Enter distinct Vigilante, Gladiator, or Nira pieces equipped on your Warframe in Optimization options; supported individual stats on selected mods still apply.
                                        </p>
                                    )}
                                    {showOptimizeOptions && (
                                        <div className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-950/30 p-3">
                                            <p className="mb-2 text-[11px] text-slate-400">Capacity is enforced for every optimized build. Catalyst and Forma are included only when their options are enabled.</p>
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <label htmlFor="conditional-state" className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conditional effects</label>
                                                <select
                                                    id="conditional-state"
                                                    value={conditionalMode}
                                                    onChange={(event) => setConditionalMode(event.target.value as ConditionalState["mode"])}
                                                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                >
                                                    <option value="initial">Initial state</option>
                                                    <option value="realistic">Realistic ramp-up estimate</option>
                                                    <option value="fullyStacked">Fully stacked scenario</option>
                                                    <option value="custom">External stacks</option>
                                                </select>
                                                {weapon?.category === "Primary" && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2">
                                                        <label className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300">
                                                            <span>Additional distinct Vigilante pieces on other gear</span>
                                                            <input
                                                                aria-label="Additional distinct Vigilante set mods on other gear"
                                                                type="number"
                                                                min={0}
                                                                max={6}
                                                                step={1}
                                                                value={externalVigilanteSetModCount}
                                                                onChange={(event) => setExternalVigilanteSetModCount(Math.max(0, Math.min(6, Math.floor(Number(event.target.value) || 0))))}
                                                                className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                            />
                                                        </label>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Each distinct set piece adds a 5% chance for a landed Primary critical hit to gain one tier, up to 30%. Count pieces equipped on other gear; do not count a duplicate mod identity of one selected in this build.</p>
                                                        <div className="mt-1 flex gap-3 text-[10px]">
                                                            <a href="https://wiki.warframe.com/w/Set_Mod" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">WARFRAME Wiki: Set Mods</a>
                                                            <a href="https://wiki.warframe.com/w/Critical_Multiplier" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Critical Multiplier</a>
                                                        </div>
                                                    </div>
                                                )}
                                                {weapon?.category === "Melee" && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2">
                                                        <label className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300">
                                                            <span>Additional distinct Gladiator pieces on your Warframe</span>
                                                            <input
                                                                aria-label="Additional Gladiator set mods on your Warframe"
                                                                type="number"
                                                                min={0}
                                                                max={3}
                                                                step={1}
                                                                value={externalGladiatorSetModCount}
                                                                onChange={(event) => setExternalGladiatorSetModCount(Math.max(0, Math.min(3, Math.floor(Number(event.target.value) || 0))))}
                                                                className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                            />
                                                        </label>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Each distinct Gladiator piece adds 10% relative melee Critical Chance per combo tier above 1x (110% per piece at 12x). Selected melee mods are counted automatically; count distinct Gladiator mods equipped on your Warframe, up to three.</p>
                                                        <div className="mt-1 flex gap-3 text-[10px]">
                                                            <a href="https://wiki.warframe.com/w/Set_Mod" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">WARFRAME Wiki: Set Mods</a>
                                                            <a href="https://wiki.warframe.com/w/Critical_Chance" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Critical Chance</a>
                                                        </div>
                                                    </div>
                                                )}
                                                {activeCalcWeapon?.category === "Melee" && !activeCalcWeapon.isExalted && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2">
                                                        <label className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300">
                                                            <span>Strain Infection active cysts at impact</span>
                                                            <input
                                                                aria-label="Strain Infection active cysts at impact"
                                                                type="number"
                                                                min={0}
                                                                max={8}
                                                                step={1}
                                                                value={strainInfectionCystsAtImpact}
                                                                onChange={(event) => setStrainInfectionCystsAtImpact(normalizeStrainInfectionCystCount(Number(event.target.value)))}
                                                                className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                            />
                                                        </label>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                                                            Assumes {strainInfectionCystsAtImpact} active cysts on the target at impact. The selected Strain Infection rank adds its listed Critical Damage per cyst to Burst scoring, with the selected count held static inside that calculation. Cyst growth, erosion timing, and average uptime are not modeled; Scaling, sustained and stance-average DPS, direct finite TTK, Expected TTK, and 5s Avg DPS ignore this assumption. Exalted melee attacks are unsupported.
                                                        </p>
                                                        <a href="https://wiki.warframe.com/w/Strain_Infection" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2">WARFRAME Wiki: Strain Infection</a>
                                                    </div>
                                                )}
                                                {activeCalcWeapon?.name === "Basmu" && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2">
                                                        <label className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300">
                                                            <span>Dreadful Killshot current Warframe Health</span>
                                                            <input
                                                                aria-label="Dreadful Killshot current Warframe Health"
                                                                type="number"
                                                                min={0}
                                                                step={1}
                                                                value={dreadfulKillshotCurrentHealth}
                                                                onChange={(event) => setDreadfulKillshotCurrentHealth(normalizeDreadfulKillshotCurrentHealth(Number(event.target.value)))}
                                                                className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                            />
                                                        </label>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                                                            Dreadful Killshot uses current Warframe Health, including bonuses. The selected rank adds its listed Damage and Status Chance per 75 Health, rounded down to 20% increments and capped at 360%. This is a static snapshot used only by Burst scoring and Burst Auto Optimize. Health buffs and damage taken are not simulated; Scaling, sustained/stance DPS, finite TTK, Expected TTK, and 5s Avg DPS ignore this input.
                                                        </p>
                                                        <a href="https://wiki.warframe.com/w/Dreadful_Killshot" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2">WARFRAME Wiki: Dreadful Killshot</a>
                                                    </div>
                                                )}
                                                {(activeCalcWeapon?.name === "Magnus" || activeCalcWeapon?.name === "Magnus Prime") &&
                                                    activeCalcWeapon.selectedAttackIsAreaDamage !== true && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2">
                                                        <label className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300">
                                                            <span>Deadly Maneuvers buffed shots remaining after dodge</span>
                                                            <input
                                                                aria-label="Deadly Maneuvers buffed shots remaining after dodge"
                                                                type="number"
                                                                min={0}
                                                                max={2}
                                                                step={1}
                                                                value={deadlyManeuversShotsRemaining}
                                                                onChange={(event) => setDeadlyManeuversShotsRemaining(normalizeDeadlyManeuversShotsRemaining(Number(event.target.value)))}
                                                                className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                            />
                                                        </label>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                                                            Enter 0–2 remaining shots after a dodge. With the augment equipped, its rank-listed +100% to +400% Critical Chance applies multiplicatively after other bonuses on headshots; Burst averages the next two shots using the configured headshot share. Dodge timing and shot history are not simulated. Scaling, sustained DPS, finite TTK, Expected TTK, and 5s Avg DPS ignore this snapshot.
                                                        </p>
                                                        <a href="https://wiki.warframe.com/w/Deadly_Maneuvers" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2">WARFRAME Wiki: Deadly Maneuvers</a>
                                                    </div>
                                                )}
                                                {activeCalcWeapon && ((activeCalcWeapon.name === "Tiberon" && activeCalcWeapon.trigger === "Burst") ||
                                                    (activeCalcWeapon.name === "Tiberon Prime" && activeCalcWeapon.selectedAttackName === "Burst")) &&
                                                    activeCalcWeapon.trigger === "Burst" && activeCalcWeapon.selectedAttackIsAreaDamage === false && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2">
                                                        <label className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300">
                                                            <span>Critical Precision prior headshot projectiles</span>
                                                            <input
                                                                aria-label="Critical Precision prior headshot projectiles"
                                                                type="number"
                                                                min={0}
                                                                max={200}
                                                                step={1}
                                                                value={criticalPrecisionHeadshotProjectiles}
                                                                onChange={(event) => setCriticalPrecisionHeadshotProjectiles(
                                                                    normalizeCriticalPrecisionHeadshotProjectiles(Number(event.target.value)),
                                                                )}
                                                                className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                            />
                                                        </label>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                                                            Enter 0–200 headshot projectiles recorded before this Burst. With Critical Precision equipped, each adds the selected rank's bonus to base Critical Chance, additively with similar mods and capped at +500%. Missed-burst decay and shot history are not simulated. Only Burst and Burst Auto Optimize use this snapshot; finite TTK and 5s DPS exclude it.
                                                        </p>
                                                        <a href="https://wiki.warframe.com/w/Critical_Precision" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2">WARFRAME Wiki: Critical Precision</a>
                                                    </div>
                                                )}
                                                {activeCalcWeapon?.name === "Dread" && activeCalcWeapon.selectedAttackIsAreaDamage === false && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2">
                                                        <label className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
                                                            <span>Assume Dread is invisible</span>
                                                            <input
                                                                aria-label="Assume Dread is invisible for Unseen Dread"
                                                                type="checkbox"
                                                                checked={unseenDreadInvisibilityActive}
                                                                onChange={(event) => setUnseenDreadInvisibilityActive(event.target.checked)}
                                                                className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
                                                            />
                                                        </label>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                                                            With Unseen Dread equipped, the selected rank adds Critical Damage while Dread is invisible. The Wiki says invisibility from any source qualifies. The 3-enemy trigger and 5-second duration/history are not simulated; this snapshot applies only to direct single-target Burst and Burst Auto Optimize. Area coverage, finite TTK, and 5s DPS exclude it.
                                                        </p>
                                                        <a href="https://wiki.warframe.com/w/Unseen_Dread" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2">WARFRAME Wiki: Unseen Dread</a>
                                                    </div>
                                                )}
                                                {activeCalcWeapon?.category === 'Melee' && activeCalcWeapon.selectedAttackUsesSlamDamageBonus === true && (
                                                    <div className='basis-full rounded-md border border-slate-700/70 bg-slate-950/40 p-2'>
                                                        <label className='flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300'>
                                                            <span>Additional distinct Nira set pieces on your Warframe</span>
                                                            <input
                                                                aria-label='Additional Nira set mods on your Warframe'
                                                                type='number'
                                                                min={0}
                                                                max={2}
                                                                step={1}
                                                                value={externalNiraSetModCount}
                                                                onChange={(event) => setExternalNiraSetModCount(Math.max(0, Math.min(2, Math.floor(Number(event.target.value) || 0))))}
                                                                className='w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500'
                                                            />
                                                        </label>
                                                        <p className='mt-1 text-[10px] leading-relaxed text-slate-500'>Each distinct Nira set piece adds 150% Slam Damage, up to three total pieces. It stacks additively with Seismic Wave and only affects melee slam attacks. Nira's Contempt is counted automatically when equipped on a compatible whip; count Nira's Anguish and Hatred worn on your Warframe.</p>
                                                        <a href='https://wiki.warframe.com/w/Nira%27s_Set' target='_blank' rel='noreferrer' className='mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2'>WARFRAME Wiki: Nira's Set</a>
                                                    </div>
                                                )}
                                                {sentientSurgeRefillPerKill > 0 && (
                                                    <p role="note" className="basis-full text-[10px] leading-relaxed text-slate-400">
                                                        Sentient Surge uses Wiki-backed rank values automatically: this scenario assumes {sentientSurgeActiveTendrils.toFixed(1)} active tendrils (four maximum). Realistic uses a 70%-of-cap estimate. Tendrils reset on reload or an empty magazine; kill cadence and reset timing are not simulated. The {Math.round(sentientSurgeRefillPerKill * 100)}% kill refill comes from reserve ammo, and extra tendril damage against other targets is outside the single-target score.{" "}
                                                        <a href="https://wiki.warframe.com/w/Sentient_Surge" target="_blank" rel="noreferrer" className="underline decoration-slate-600 underline-offset-2 hover:text-slate-200">WARFRAME Wiki: Sentient Surge</a>
                                                    </p>
                                                )}
                                                {(hasActiveProtonJet || hasActiveProtonSnap) && (
                                                    <p role="note" className="basis-full text-[10px] leading-relaxed text-slate-400">
                                                        Proton Jet and Proton Snap use Wiki-backed rank values. Realistic assumes no wall-latch uptime; Fully stacked or Custom with at least one stack assumes the effect is active. {hasActiveProtonSnap ? `Proton Snap requires a ${(activeProtonSnapConditional?.activationDelaySeconds ?? 2).toFixed(0)}-second latch and lasts ${activeProtonSnapConditional?.durationSeconds.toFixed(0) ?? "the selected-rank duration"}; this build holds that state static and does not simulate latch cadence or expiry. ` : ""}
                                                        {hasActiveProtonJet && <a href="https://wiki.warframe.com/w/Proton_Jet" target="_blank" rel="noreferrer" className="underline decoration-slate-600 underline-offset-2 hover:text-slate-200">WARFRAME Wiki: Proton Jet</a>}
                                                        {hasActiveProtonJet && hasActiveProtonSnap ? " · " : ""}
                                                        {hasActiveProtonSnap && <a href="https://wiki.warframe.com/w/Proton_Snap" target="_blank" rel="noreferrer" className="underline decoration-slate-600 underline-offset-2 hover:text-slate-200">WARFRAME Wiki: Proton Snap</a>}
                                                    </p>
                                                )}
                                                {conditionalMode === "custom" && (
                                                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span>Maintained stacks per effect</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={10}
                                                            step={1}
                                                            value={externalConditionalStacks}
                                                            onChange={(event) => setExternalConditionalStacks(Math.max(0, Math.min(10, Math.floor(Number(event.target.value) || 0))))}
                                                            className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                        />
                                                    </label>
                                                )}
                                                <details
                                                    className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 px-2 py-1.5"
                                                    open={externalStatusTypesOpen}
                                                    onToggle={(event) => {
                                                        const nextOpen = event.currentTarget.open;
                                                        setExternalStatusTypesOpen((current) => current === nextOpen ? current : nextOpen);
                                                    }}
                                                >
                                                    <summary className="cursor-pointer text-[10px] font-medium text-slate-300">
                                                        External status types ({externalStatusTypes.length} selected)
                                                    </summary>
                                                    <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                                                        Assume these named statuses are already active and maintained by allies, abilities, or other sources. Wiki rules are applied automatically: target-immune damage statuses are ignored; Tau counts for Condition Overload and Cedo-style status passives, not Galvanized bonuses; selecting external Tau assumes one maintained stack for Status Chance vulnerability; Lifted and Knockdown cannot coexist. The finite encounter carries expected Tau applications between sequential projectiles as a mean-field estimate. Tau and forced procs are not amplified, and external status stack counts beyond one are not configurable here.
                                                    </p>
                                                    <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/50 p-2">
                                                        <label className="flex items-center gap-2 text-[10px] text-slate-300">
                                                            <input
                                                                aria-label="Target starts with external Heat status"
                                                                type="checkbox"
                                                                checked={targetStartsWithHeat}
                                                                onChange={(event) => setTargetStartsWithHeat(event.target.checked)}
                                                                className="accent-sky-500"
                                                            />
                                                            <span>Target starts with Heat from an external source</span>
                                                        </label>
                                                        {targetStartsWithHeat && (
                                                            <>
                                                                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                                                                    The current Wiki describes Heat Inherit as a community mechanic and marks this section in progress. Later Heat DoT procs inherit the first source's Heat and faction bonuses; each later proc keeps its own base and Status Damage, and direct hits are unchanged. The external source's own damage and armor-strip history are not simulated; its starting Heat duration is treated as fresh. Leave both bonuses at 0% for a source with neither bonus.
                                                                </p>
                                                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                    <label className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 text-[10px] text-slate-300">
                                                                        <span>First-source Heat bonus (%)</span>
                                                                        <input
                                                                            aria-label="External first Heat source Heat bonus percent"
                                                                            type="number"
                                                                            min={0}
                                                                            max={10_000}
                                                                            step={1}
                                                                            value={externalHeatElementalDamageBonusPercentInput}
                                                                            onChange={(event) => setExternalHeatElementalDamageBonusPercentInput(event.target.value)}
                                                                            onBlur={() => setExternalHeatElementalDamageBonusPercentInput(
                                                                                parseExternalHeatBonusPercentInput(externalHeatElementalDamageBonusPercentInput).toString(),
                                                                            )}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                                        />
                                                                    </label>
                                                                    <label className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 text-[10px] text-slate-300">
                                                                        <span>First-source Faction bonus (%)</span>
                                                                        <input
                                                                            aria-label="External first Heat source Faction bonus percent"
                                                                            type="number"
                                                                            min={0}
                                                                            max={10_000}
                                                                            step={1}
                                                                            value={externalHeatFactionDamageBonusPercentInput}
                                                                            onChange={(event) => setExternalHeatFactionDamageBonusPercentInput(event.target.value)}
                                                                            onBlur={() => setExternalHeatFactionDamageBonusPercentInput(
                                                                                parseExternalHeatBonusPercentInput(externalHeatFactionDamageBonusPercentInput).toString(),
                                                                            )}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                                        />
                                                                    </label>
                                                                </div>
                                                                <a href="https://wiki.warframe.com/w/Damage/Heat_Damage" target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[10px] text-sky-400 underline underline-offset-2">
                                                                    WARFRAME Wiki: Heat Damage and Heat Inherit
                                                                </a>
                                                            </>
                                                        )}
                                                    </div>
                                                    {externalStatusTypeCount > 0 && (
                                                        <div role="note" className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-amber-300/90">
                                                            <span>This saved configuration also has {externalStatusTypeCount} unnamed legacy status type{externalStatusTypeCount === 1 ? "" : "s"}; those count for Condition Overload only and may overlap named types.</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExternalStatusTypeCount(0)}
                                                                className="text-amber-200 underline decoration-amber-600/60 underline-offset-2 hover:text-white"
                                                            >
                                                                Clear legacy count
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 xl:grid-cols-4">
                                                        {EXTERNAL_STATUS_TYPE_OPTIONS.map(({ type, label }) => (
                                                            <label key={type} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                                <input
                                                                    type="checkbox"
                                                                    aria-label={`External ${label} status active`}
                                                                    checked={externalStatusTypes.includes(type)}
                                                                    onChange={(event) => {
                                                                        setExternalStatusTypes((current) => {
                                                                            const next = new Set(current);
                                                                            if (event.target.checked) {
                                                                                if (type === "lifted") next.delete("knockdown");
                                                                                if (type === "knockdown") next.delete("lifted");
                                                                                next.add(type);
                                                                            } else {
                                                                                next.delete(type);
                                                                            }
                                                                            return normalizeExternalStatusTypes([...next]);
                                                                        });
                                                                    }}
                                                                    className="accent-sky-500"
                                                                />
                                                                <span title={type === "tau"
                                                                    ? "Counts for Condition Overload; excluded from Galvanized Aptitude, Galvanized Savvy, and Galvanized Shot status lists on the current Wiki."
                                                                    : type === "lifted"
                                                                        ? "Counts as a unique status for Condition Overload and Galvanized effects; mutually exclusive with Knockdown."
                                                                        : type === "knockdown"
                                                                            ? "Counts as a unique status for Condition Overload and Galvanized effects; mutually exclusive with Lifted."
                                                                            : undefined}>{label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <span className="mt-2 inline-flex flex-wrap gap-x-3 gap-y-1">
                                                        <a href="https://wiki.warframe.com/w/Condition_Overload" target="_blank" rel="noreferrer" className="text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-slate-300">WARFRAME Wiki: Condition Overload</a>
                                                        <a href="https://wiki.warframe.com/w/Galvanized_Aptitude" target="_blank" rel="noreferrer" className="text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-slate-300">Galvanized Aptitude</a>
                                                        <a href="https://wiki.warframe.com/w/Status_Effects" target="_blank" rel="noreferrer" className="text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-slate-300">Status Effects</a>
                                                    </span>
                                                </details>
                                                {weapon && compatMods.some((mod) =>
                                                    mod.path === SPRING_LOADED_BROADHEAD_PATH ||
                                                    mod.effectsByRank.some((effect) => effect.conditionalEffects?.some((conditional) =>
                                                        conditional.trigger === "whileNoEnemyWithinRange",
                                                    )),
                                                ) && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 px-2 py-2">
                                                        <label htmlFor="planner-target-distance" className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 text-[10px] text-slate-300">
                                                            <span>Target distance (m)</span>
                                                            <input
                                                                id="planner-target-distance"
                                                                aria-label="Target distance in meters"
                                                                type="number"
                                                                min={0}
                                                                step={0.1}
                                                                value={targetDistanceMeters ?? ""}
                                                                onChange={(event) => {
                                                                    const value = event.currentTarget.value;
                                                                    const next = value === "" ? Number.NaN : Number(value);
                                                                    setTargetDistanceMeters(Number.isFinite(next) && next >= 0 ? next : undefined);
                                                                }}
                                                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                            />
                                                            <span className="text-slate-500">meters</span>
                                                        </label>
                                                        {compatMods.some((mod) => mod.path === SPRING_LOADED_BROADHEAD_PATH) && (
                                                            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                                                                Spring-Loaded Broadhead's +40% value and rank-specific range threshold come from the Wiki automatically; the bonus applies to one projectile and its status DoT seed once. An empty distance keeps this condition inactive.
                                                            </p>
                                                        )}
                                                        {compatMods.some((mod) => mod.effectsByRank.some((effect) => effect.conditionalEffects?.some((conditional) => conditional.trigger === "whileNoEnemyWithinRange"))) && (
                                                            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                                                                Range Advantage's +50% to +300% additive Damage and 10m threshold come from the Wiki automatically. It activates only beyond 10m; the single-target scenario assumes no other nearby enemies are present. An empty distance keeps the condition inactive.
                                                            </p>
                                                        )}
                                                        {compatMods.some((mod) => mod.path === SPRING_LOADED_BROADHEAD_PATH) && (
                                                            <a href="https://wiki.warframe.com/w/Spring-Loaded_Broadhead" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-slate-300">
                                                                WARFRAME Wiki: Spring-Loaded Broadhead
                                                            </a>
                                                        )}
                                                        {compatMods.some((mod) => mod.effectsByRank.some((effect) => effect.conditionalEffects?.some((conditional) => conditional.trigger === "whileNoEnemyWithinRange"))) && (
                                                            <a href="https://wiki.warframe.com/w/Range_Advantage" target="_blank" rel="noreferrer" className="mt-1 ml-3 inline-block text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-slate-300">
                                                                WARFRAME Wiki: Range Advantage
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                                {falloffRelevantAttacks.length > 0 && (
                                                    <div className="basis-full rounded-md border border-slate-700/70 bg-slate-950/40 px-2 py-2">
                                                        <label htmlFor="planner-attack-falloff-distance" className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 text-[10px] text-slate-300">
                                                            <span>{selectedFalloffAttack?.pelletSpreadCone ? "Attack distance / falloff (m)" : "Attack distance (m)"}</span>
                                                            <input
                                                                id="planner-attack-falloff-distance"
                                                                aria-label="Attack distance in meters"
                                                                type="number"
                                                                min={0}
                                                                step={0.1}
                                                                value={attackFalloffDistanceMeters ?? ""}
                                                                onChange={(event) => {
                                                                    const value = event.currentTarget.value;
                                                                    const next = value === "" ? Number.NaN : Number(value);
                                                                    setAttackFalloffDistanceMeters(Number.isFinite(next) && next >= 0 ? next : undefined);
                                                                }}
                                                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                            />
                                                            <span className="text-slate-500">meters</span>
                                                        </label>
                                                        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                                                            Direct attacks use player-to-target distance; area falloff uses distance from the blast center. A linked component attached to a struck enemy uses 0m. Leave blank to assume full damage without evaluating a range cap. Sourced hard caps count farther attacks as misses; unresolved ranges remain informational.
                                                        </p>
                                                        {selectedFalloffAttack?.pelletSpreadCone && (
                                                            <>
                                                                <label htmlFor="planner-target-radius" className="mt-2 grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 text-[10px] text-slate-300">
                                                                    <span>Target radius (m)</span>
                                                                    <input
                                                                        id="planner-target-radius"
                                                                        aria-label="Target radius in meters"
                                                                        type="number"
                                                                        min={0.01}
                                                                        step={0.1}
                                                                        value={targetRadiusMeters ?? ""}
                                                                        onChange={(event) => {
                                                                            const value = event.currentTarget.value;
                                                                            const next = value === "" ? Number.NaN : Number(value);
                                                                            setTargetRadiusMeters(Number.isFinite(next) && next > 0 ? next : undefined);
                                                                        }}
                                                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                    />
                                                                    <span className="text-slate-500">meters</span>
                                                                </label>
                                                                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                                                                    Buckshot estimates one idealized centered pellet plus the remaining pellets sampled uniformly by solid angle inside the Wiki's {selectedFalloffAttack.pelletSpreadCone.minimumSpreadDegrees}°–{selectedFalloffAttack.pelletSpreadCone.maximumSpreadDegrees}° cone. Both radius and distance are required. Accuracy changes and other unsupported spread modifiers disable this estimate; the manual estimate is single-target and never enables Auto Optimize.
                                                                </p>
                                                                {activeOverpressuredRoundsSelected && selectedFalloffAttack.name === "Buckshot" && (
                                                                    <div className="mt-2 rounded border border-amber-900/60 bg-amber-950/20 p-2">
                                                                        <p className="text-[10px] leading-relaxed text-amber-200">
                                                                            Overpressured Rounds does not have a sourced numeric Spread Decrease. Enter the effective spread range you want to assume after a Rifle kill. The selected rank's sourced Falloff Distance bonus is applied to the entered Buckshot target distance for this same one-shot Burst snapshot. The prior kill, one-shot buff consumption, and repeat-fire timeline are not simulated. Finite TTK / 5s Avg DPS remain unavailable.
                                                                        </p>
                                                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                                                            <label className="text-[10px] text-slate-300">
                                                                                <span className="mb-1 block">Post-kill minimum spread (°)</span>
                                                                                <input
                                                                                    aria-label="Overpressured Rounds post-kill minimum spread degrees"
                                                                                    type="number"
                                                                                    min={0.1}
                                                                                    max={180}
                                                                                    step={0.1}
                                                                                    value={overpressuredRoundsSpreadMinimumDegrees ?? ""}
                                                                                    onChange={(event) => {
                                                                                        const value = event.currentTarget.value;
                                                                                        const next = value === "" ? Number.NaN : Number(value);
                                                                                        setOverpressuredRoundsSpreadMinimumDegrees(Number.isFinite(next) && next >= 0.1
                                                                                            ? Math.min(180, next)
                                                                                            : undefined);
                                                                                    }}
                                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                                />
                                                                            </label>
                                                                            <label className="text-[10px] text-slate-300">
                                                                                <span className="mb-1 block">Post-kill maximum spread (°)</span>
                                                                                <input
                                                                                    aria-label="Overpressured Rounds post-kill maximum spread degrees"
                                                                                    type="number"
                                                                                    min={0.1}
                                                                                    max={180}
                                                                                    step={0.1}
                                                                                    value={overpressuredRoundsSpreadMaximumDegrees ?? ""}
                                                                                    onChange={(event) => {
                                                                                        const value = event.currentTarget.value;
                                                                                        const next = value === "" ? Number.NaN : Number(value);
                                                                                        setOverpressuredRoundsSpreadMaximumDegrees(Number.isFinite(next) && next >= 0.1
                                                                                            ? Math.min(180, next)
                                                                                            : undefined);
                                                                                    }}
                                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                                />
                                                                            </label>
                                                                        </div>
                                                                        {overpressuredRoundsSpreadMinimumDegrees !== undefined &&
                                                                            overpressuredRoundsSpreadMaximumDegrees !== undefined &&
                                                                            overpressuredRoundsSpreadMaximumDegrees < overpressuredRoundsSpreadMinimumDegrees && (
                                                                                <p role="alert" className="mt-1 text-[10px] text-rose-300">Maximum spread must be at least the minimum spread.</p>
                                                                            )}
                                                                        <a href="https://wiki.warframe.com/w/Overpressured_Rounds" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2">WARFRAME Wiki: Overpressured Rounds</a>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {mausolonRangeNote && (
                                                            <p role="note" className="mt-1.5 text-[10px] leading-relaxed text-amber-300">
                                                                {mausolonRangeNote}
                                                            </p>
                                                        )}
                                                        {selectedAttackOutOfRange && (
                                                            <p role="status" className="mt-1.5 text-[10px] leading-relaxed text-rose-300">
                                                                This attack is a miss at the entered distance. Auto Optimize is disabled until the target is within range.
                                                            </p>
                                                        )}
                                                        {falloffRelevantAttacks.map((attack) => attack && (
                                                            <p key={attack.name} className="mt-1 text-[10px] leading-relaxed text-slate-400">
                                                                <span className="text-slate-300">{attack.name}:</span>{" "}
                                                                {attack.damageFalloff
                                                                    ? `100% damage through ${attack.damageFalloff.startDistanceMeters}m, then linear falloff to ${Math.round(attack.damageFalloff.minimumDamageMultiplier * 100)}% at ${attack.damageFalloff.endDistanceMeters}m.`
                                                                    : "No direct-damage falloff value is listed for this attack."}
                                                                {attack.maximumRangeMeters !== undefined
                                                                    ? attack.maximumRangeBehavior === "hardHitCap"
                                                                        ? ` Wiki lists a ${attack.maximumRangeMeters}m hit cap; attacks beyond it are misses.`
                                                                        : ` Wiki lists a ${attack.maximumRangeMeters}m range; this profile does not reject hits beyond it.`
                                                                    : ""}
                                                            </p>
                                                        ))}
                                                        {falloffRelevantAttacks.some((attack) => attack?.damageFalloff) &&
                                                            (activeMetrics?.modded.conditionOverloadApplies || (activeMetrics?.modded.directDamagePerStatusBonus ?? 0) > 0) && (
                                                                <p className="mt-1 text-[10px] leading-relaxed text-amber-300">
                                                                    Wiki notes that Condition Overload or Galvanized additive damage can ignore falloff in some damage-bracket combinations; this score applies falloff uniformly.
                                                                </p>
                                                            )}
                                                        {falloffRelevantAttacks.flatMap((attack) => attack?.damageFalloff?.sourceUrl
                                                            ? [attack.damageFalloff.sourceUrl]
                                                            : attack?.maximumRangeSourceUrl ? [attack.maximumRangeSourceUrl] : [],
                                                        ).filter((sourceUrl, index, sources) => sources.indexOf(sourceUrl) === index).map((sourceUrl) => (
                                                            <a key={sourceUrl} href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-sky-400 underline underline-offset-2">
                                                                WARFRAME Wiki: weapon data
                                                            </a>
                                                        ))}
                                                        {falloffRelevantAttacks.some((attack) => attack?.maximumRangeBehavior === "hardHitCap") && (
                                                            <span className="mt-1 flex gap-2 text-[10px]">
                                                                <a href="https://wiki.warframe.com/w/Range" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">
                                                                    WARFRAME Wiki: Range
                                                                </a>
                                                                <a href="https://wiki.warframe.com/w/Hitscan" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">
                                                                    Hitscan
                                                                </a>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {supportsKineticKiller && incarnonRecord && (
                                                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <input
                                                            aria-label="Player sliding at impact for Furax Kinetic Killer"
                                                            type="checkbox"
                                                            checked={playerSlidingAtImpact}
                                                            onChange={(event) => setPlayerSlidingAtImpact(event.target.checked)}
                                                            className="accent-sky-500"
                                                        />
                                                        <span title="Assume the attack makes contact while you are sliding. Requires Kinetic Killer to be selected; the app holds this condition static for scored attacks.">Sliding at impact (Kinetic Killer)</span>
                                                    </label>
                                                )}
                                                {weapon && usesMeleeDamageModel(weapon.category) && (
                                                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span>Melee combo tier</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={maxMeleeComboMultiplier}
                                                            step={1}
                                                            value={meleeComboMultiplier}
                                                            onChange={(event) => setMeleeComboMultiplier(clampMeleeComboMultiplier(weapon, Number(event.target.value) || 1))}
                                                            className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none"
                                                        />
                                                    </label>
                                                )}
                                                {weapon && usesMeleeDamageModel(weapon.category) && activeBuildHasTennokai && (
                                                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span>Normal hits before Heavy Attack</span>
                                                        <input
                                                            aria-label="Normal hits between Tennokai Heavy Attacks"
                                                            type="number"
                                                            min={1}
                                                            max={20}
                                                            step={1}
                                                            value={tennokaiRegularHitsBetweenHeavy}
                                                            onChange={(event) => setTennokaiRegularHitsBetweenHeavy(
                                                                Math.max(1, Math.min(20, Math.floor(Number(event.target.value) || 1))),
                                                            )}
                                                            className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none"
                                                        />
                                                    </label>
                                                )}
                                                <span className="text-[10px] text-slate-500">
                                                    {conditionalMode === "realistic"
                                                        ? "Realistic uses modeled trigger assumptions; ability casts, airborne states, aim-gliding, and invisibility default to zero uptime. Fully stacked or external-stack scenarios can activate them."
                                                        : conditionalMode === "initial"
                                                            ? "No conditional trigger effects are active."
                                                            : conditionalMode === "fullyStacked"
                                                                ? "Assumes every modeled trigger is active at its maximum stacks."
                                                                : "Applies this maintained stack count to each conditional effect. Fixed-window scoring holds it for the full window without simulating how stacks were earned or expired."}
                                                </span>
                                            </div>
                                            {supportsKineticKiller && incarnonRecord && (
                                                <p className="mb-3 text-[10px] text-slate-500">
                                                    Kinetic Killer sets base Critical Damage to 4× for any attack that contacts while sliding. This is a static contact-state assumption, not movement timing; Heavy Slams require sliding immediately before impact and have a narrow timing window. <a href={incarnonRecord.wikiUrl} target="_blank" rel="noreferrer" className="underline decoration-slate-700 underline-offset-2 hover:text-slate-300">WARFRAME Wiki: Furax Incarnon</a>
                                                </p>
                                            )}
                                            {weapon?.hasGaleForceAmmoPassive && (
                                                <p className="mb-3 text-[10px] text-slate-400">
                                                    Gale Force provides Infinite Ammo for 4 seconds after a headshot kill or four headshots in one burst. Its trigger and refresh timing are not simulated. Perigale assumes it is maintained only in Fully stacked or Custom with at least one stack; while active, the build has no reloads or further first-shot Chamber bonus.
                                                </p>
                                            )}
                                            {weapon && usesMeleeDamageModel(weapon.category) && (
                                                    <p className="mb-3 text-[10px] text-slate-500">Combo tier is an explicit scenario input (1× by default). Initial state uses static Initial Combo mods and supported weapon passives, and ignores this field. Conditional Initial Combo bonuses apply when their selected state is active. Kill-triggered effects without a mechanic-specific model use shared uptime/stack estimates. Selected heavy attacks multiply damage by the active tier. The stats panel estimates points retained after one attack using equipped Heavy Attack Efficiency (capped at 90%). The separate Tennokai panel shows an expected repeated Normal Attack / Heavy Attack cycle when a Tennokai mod is equipped; the Tennokai Cycle DPS objective uses a bounded four-cycle version of that timeline. Expected TTK and 5s Avg DPS still use their existing single-attack/status encounter models and do not include Tennokai history.</p>
                                            )}
                                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                                {([
                                                    { label: "Allow Non-Maxed", active: allowNonMax, set: setAllowNonMax, desc: "Try lower-ranked mods so more fit within capacity." },
                                                    { label: "Owned Only", active: onlyOwned, set: setOnlyOwned, desc: "Only use mods you have marked as owned." },
                                                    { label: "Faction Focus", active: factionOn, set: (active: boolean) => { setFactionOn(active); if (!active) { setUseCustomTargetStats(false); setSelectedEnemyProfileId(""); setIsEximus(false); setBossBlastStackCap(false); setIsSteelPath(false); setNearbyEnemyCount(0); setNearbyGasOuterEnemyCount(0); setNearbyBlastEnemyCount(0); } }, desc: "Apply the selected faction's damage-type modifiers. Choose a sourced enemy profile or enter custom target stats; faction-only pool mixes remain estimates." },
                                                    { label: "Allow Catalyst", active: allowCatalyst, set: setAllowCatalyst, desc: "Assume Orokin Catalyst installed if needed." },
                                                    { label: "Allow Forma", active: allowForma, set: setAllowForma, desc: "Reassign slot polarities to reduce drain." },
                                                    { label: "Optimize Exilus", active: optExilus, set: setOptExilus, desc: "Include the exilus slot in optimization." },
                                                    { label: "Optimize Arcane", active: optArcane, set: setOptArcane, desc: "Choose the best arcane for the build." },
                                                    ...(weapon?.isProgenitorWeapon ? [{
                                                        label: "Optimize Valence Element",
                                                        active: buildCfg.optimizeValenceElement,
                                                        set: (next: boolean) => setBuildCfg(p => ({ ...p, optimizeValenceElement: next })),
                                                        desc: buildCfg.weaponRank >= 40
                                                            ? "Allow the optimizer to choose the best valence element for this max-rank progenitor weapon."
                                                            : "Available once the progenitor weapon reaches rank 40.",
                                                    }] as const : []),
                                                ] as const).map(t => (
                                                    t.label === "Allow Forma" ? (
                                                        <div
                                                            key={t.label}
                                                            title={t.desc}
                                                            onClick={() => t.set(!t.active)}
                                                            className={[
                                                                "cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
                                                                t.active ? "border-sky-700/60 bg-sky-950/20 text-sky-300" : "border-slate-700 bg-slate-900/40 text-slate-500 hover:border-slate-600 hover:text-slate-300",
                                                            ].join(" ")}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        t.set(!t.active);
                                                                    }}
                                                                    className="flex min-w-0 items-center gap-1.5 text-left"
                                                                >
                                                                    <span className={["w-3 h-3 rounded-full border flex items-center justify-center shrink-0",
                                                                        t.active ? "border-sky-400 bg-sky-400" : "border-slate-600"].join(" ")}>
                                                                        {t.active && <span className="text-slate-900 text-[8px]">&#10003;</span>}
                                                                    </span>
                                                                    <span className="font-semibold">{t.label}</span>
                                                                </button>
                                                                {t.active && (
                                                                    <label
                                                                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-sky-200/85"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <span>Max:</span>
                                                                        <select
                                                                            value={maxFormaAllowed}
                                                                            onChange={(e) => setMaxFormaAllowed(Math.max(1, Math.min(maxOptimizerForma, Number(e.target.value) || 1)))}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="rounded-md border border-sky-700/60 bg-slate-950/85 px-2 py-1 text-[11px] font-semibold text-slate-100 outline-none transition-colors focus:border-sky-500"
                                                                        >
                                                                            {Array.from({ length: maxOptimizerForma }, (_, index) => index + 1).map((count) => (
                                                                                <option key={count} value={count}>
                                                                                    {count}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button key={t.label} onClick={() => t.set(!t.active)} title={t.desc}
                                                            disabled={t.label === "Optimize Valence Element" && buildCfg.weaponRank < 40}
                                                            className={["rounded-lg border px-2.5 py-1.5 text-[11px] text-left transition-colors",
                                                                t.active ? "border-sky-700/60 bg-sky-950/20 text-sky-300" : "border-slate-700 bg-slate-900/40 text-slate-500 hover:border-slate-600 hover:text-slate-300",
                                                                t.label === "Optimize Valence Element" && buildCfg.weaponRank < 40 ? "opacity-50 cursor-not-allowed" : "",
                                                            ].join(" ")}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={["w-3 h-3 rounded-full border flex items-center justify-center shrink-0",
                                                                    t.active ? "border-sky-400 bg-sky-400" : "border-slate-600"].join(" ")}>
                                                                    {t.active && <span className="text-slate-900 text-[8px]">&#10003;</span>}
                                                                </span>
                                                                <span className="font-semibold">{t.label}</span>
                                                            </div>
                                                        </button>
                                                    )
                                                ))}
                                            </div>
                                            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                                    <div>
                                                        <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Weapon Rank</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type="range" min={0} max={maxWeaponRank(weapon?.canOverLevel ?? false)} value={buildCfg.weaponRank}
                                                                onChange={e => setBuildCfg(p => ({ ...p, weaponRank: +e.target.value }))} className="flex-1 accent-sky-500" />
                                                            <span className="text-sm font-mono text-slate-200 w-7 text-right">{buildCfg.weaponRank}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Mastery Rank</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type="range" min={0} max={40} value={buildCfg.masteryRank}
                                                                onChange={e => setBuildCfg(p => ({ ...p, masteryRank: +e.target.value }))} className="flex-1 accent-sky-500" />
                                                            <span className="text-sm font-mono text-slate-200 w-7 text-right">{buildCfg.masteryRank}</span>
                                                        </div>
                                                    </div>
                                                    {weapon?.isProgenitorWeapon && (
                                                        <>
                                                            <div>
                                                                <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Valence Bonus</label>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="range"
                                                                        min={0}
                                                                        max={60}
                                                                        step={1}
                                                                        value={Math.round(buildCfg.valenceBonusPct * 100)}
                                                                        onChange={e => setBuildCfg(p => ({ ...p, valenceBonusPct: Math.max(0, Math.min(0.6, +e.target.value / 100)) }))}
                                                                        className="flex-1 accent-sky-500"
                                                                    />
                                                                    <span className="text-sm font-mono text-slate-200 w-12 text-right">{Math.round(buildCfg.valenceBonusPct * 100)}%</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Valence Element</label>
                                                                <select
                                                                    value={buildCfg.valenceElement}
                                                                    onChange={e => setBuildCfg(p => ({ ...p, valenceElement: e.target.value as ValenceElement }))}
                                                                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                                                >
                                                                    {VALENCE_ELEMENTS.map(option => (
                                                                        <option key={option.key} value={option.key}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </>
                                                    )}
                                                    {incarnonRecord && (
                                                        <div className="md:col-span-3">
                                                            <div className="rounded-[1.35rem] border border-[color:var(--wf-border-accent)] bg-[color:var(--wf-surface-2)] px-4 py-3 shadow-[var(--wf-shadow-panel)]">
                                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                                    <div>
                                                                        <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--wf-accent-text)]">Incarnon Evolution Path</div>
                                                                        <div className="mt-1 text-xs text-slate-400">
                                                                            Choose a path; only modeled effects change stats or optimizer scores. Unmodeled lines are marked in each perk.
                                                                        </div>
                                                                        {incarnonRecord.incarnonAmmoCapacity !== undefined && (
                                                                            <div className="mt-2 text-xs leading-relaxed text-slate-400">
                                                                                Wiki-listed Incarnon capacity: {fmt(incarnonRecord.incarnonAmmoCapacity, 0)} rounds. The encounter uses one full charge, stops firing when it is spent, and resolves status effects already applied. Reversion and charge-building are not simulated.{" "}
                                                                                <a href={incarnonRecord.wikiUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                                                                        {INCARNON_TIER_ORDER.map((tierNumber) => {
                                                                            const tier = incarnonRecord.tiers.find((entry) => entry.tier === tierNumber) ?? null;
                                                                            const selectedOptionId = buildCfg.incarnonSelectedOptionsByTier[tierNumber];
                                                                            const selectedOption = tier?.options.find((option) => option.id === selectedOptionId) ?? null;

                                                                            if (!tier) {
                                                                                return (
                                                                                    <span
                                                                                        key={tierNumber}
                                                                                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950/40 text-sm font-semibold tracking-[0.14em] text-slate-600"
                                                                                    >
                                                                                        {INCARNON_TIER_LABELS[tierNumber]}
                                                                                    </span>
                                                                                );
                                                                            }

                                                                            return (
                                                                                <button
                                                                                    key={tierNumber}
                                                                                    type="button"
                                                                                    onClick={() => setIncarnonPickerTier(tierNumber)}
                                                                                    title={selectedOption?.name ?? `Choose Evolution ${INCARNON_TIER_LABELS[tierNumber]}`}
                                                                                    className="group flex items-center gap-2"
                                                                                >
                                                                                    <span
                                                                                        className={[
                                                                                            "relative flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold tracking-[0.14em] transition-all duration-200",
                                                                                            selectedOption
                                                                                                ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)] shadow-[0_0_0_1px_var(--wf-selection-border)]"
                                                                                                : "border-[color:var(--wf-border-accent)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] group-hover:border-[color:var(--wf-selection-border)] group-hover:text-[color:var(--wf-accent-text)]",
                                                                                        ].join(" ")}
                                                                                    >
                                                                                        <span className="absolute inset-[5px] rounded-full border border-white/5" />
                                                                                        <span className="relative">{INCARNON_TIER_LABELS[tierNumber]}</span>
                                                                                    </span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                        <div className="ml-1 rounded-full border border-[color:var(--wf-border-accent)] bg-[color:var(--wf-surface-soft)] px-3 py-1 text-[11px] text-[color:var(--wf-accent-text)]">
                                                                            {selectedIncarnonTierCount > 0
                                                                                ? `${selectedIncarnonTierCount} evolution${selectedIncarnonTierCount === 1 ? "" : "s"} active · refine up to 2 paths`
                                                                                : buildCfg.optimizeIncarnonSelections
                                                                                    ? "Search all tiers · refine up to 2 paths"
                                                                                : "No evolutions selected"}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setBuildCfg((p) => ({ ...p, optimizeIncarnonSelections: !p.optimizeIncarnonSelections }))}
                                                                            className={[
                                                                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                                                                                buildCfg.optimizeIncarnonSelections
                                                                                    ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]"
                                                                                    : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-info)]",
                                                                            ].join(" ")}
                                                                            title={selectedIncarnonTierCount > 0
                                                                                ? "Score combinations for the selected Incarnon tiers against the current optimized build, then fully optimize up to two promising alternate paths. This shortlist is heuristic, not an exhaustive joint mod-and-evolution search."
                                                                                : "Score all available Incarnon paths against the current optimized build, then fully optimize up to two promising alternate paths. This shortlist is heuristic, not an exhaustive joint mod-and-evolution search."}
                                                                        >
                                                                            Optimize Incarnon Path
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-h-[34px] flex items-center justify-start lg:justify-end">
                                                    {factionOn && (
                                                        <div className="w-full space-y-2">
                                                            <label className="block space-y-1 text-[10px] text-slate-400">
                                                                <span className="block">Named enemy target</span>
                                                                <select
                                                                    aria-label="Named enemy target"
                                                                    value={selectedEnemyProfileId}
                                                                    onChange={(event) => selectEnemyProfile(event.target.value)}
                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                                                                >
                                                                    <option value="">Use faction estimate or custom stats</option>
                                                                    {ENEMY_PROFILES.map((profile) => (
                                                                        <option key={profile.id} value={profile.id}>
                                                                            {profile.name} · {profile.faction} · base level {profile.baseLevel}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {FACTIONS.map(f => (
                                                                    <button key={f.value} onClick={() => { setFaction(f.value); setSelectedEnemyProfileId(""); }}
                                                                        className={["rounded-full px-2.5 py-1 text-[10px] border transition-colors",
                                                                            faction === f.value ? "bg-[color:var(--wf-warning-soft)] border-[color:var(--wf-warning)] text-[color:var(--wf-warning)]" : "border-slate-700 text-slate-400 hover:border-slate-600"].join(" ")}>
                                                                        {f.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <label htmlFor="planner-headshot-rate" className="text-[10px] text-slate-300">
                                                                        Assumed headshot hit share
                                                                    </label>
                                                                    <span className="font-mono text-[10px] text-slate-200">{headshotRatePercent}%</span>
                                                                </div>
                                                                <input
                                                                    id="planner-headshot-rate"
                                                                    aria-label="Assumed headshot hit share"
                                                                    type="range"
                                                                    min={0}
                                                                    max={100}
                                                                    step={1}
                                                                    value={headshotRatePercent}
                                                                    onChange={(event) => setHeadshotRatePercent(Math.max(0, Math.min(100, Math.round(Number(event.target.value) || 0))))}
                                                                    className="w-full accent-sky-400"
                                                                />
                                                                <p className="text-[10px] leading-relaxed text-slate-500">
                                                                    Tenno-Hub fills the selected target's headshot multiplier and critical-headshot rule from the WARFRAME Wiki; this control is only your estimated headshot share. Area/radial attacks do not headshot. General faction values are typical estimates, while a named enemy uses its listed hit location. Weak-point damage and Critical Chance bonuses apply to the configured headshot share only when the selected profile marks its head as a weak point; non-head weakpoints are not modeled. Sources: {" "}
                                                                    <a href="https://wiki.warframe.com/w/Enemy_Body_Parts" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Enemy Body Parts</a>, {" "}
                                                                    <a href="https://wiki.warframe.com/w/Damage/Calculation" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Damage Calculation</a>, {" "}
                                                                    <a href="https://wiki.warframe.com/w/Critical_Multiplier" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Critical Multiplier</a>, {" "}
                                                                    <a href="https://wiki.warframe.com/w/Meticulous_Aim" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Meticulous Aim</a>.
                                                                </p>
                                                            </div>
                                                            <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
                                                                <input type="checkbox" checked={useCustomTargetStats} onChange={(event) => { setUseCustomTargetStats(event.target.checked); setSelectedEnemyProfileId(""); if (!event.target.checked) { setIsEximus(false); setBossBlastStackCap(false); setIsSteelPath(false); setNearbyEnemyCount(0); setNearbyGasOuterEnemyCount(0); setNearbyBlastEnemyCount(0); } }} />
                                                                Use custom target stats
                                                            </label>
                                                            {useCustomTargetStats && (
                                                                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                                                                    {selectedEnemyProfile && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-400">
                                                                            {selectedEnemyProfile.notes}{" "}
                                                                            <a href={selectedEnemyProfile.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        The finite expected-value encounter tracks Heat's armor-strip timeline, duration-scaled Blast fuses/caps, and Viral, Corrosive, Magnetic, Cold, and Puncture effects between attacks. Direct hits apply the 0.1 s enemy Shield Gate using the selected hit mode; scheduled status ticks remain ungated. Blast radial and Electricity/Gas ticks to configured same-profile neighbors are reported separately from primary TTK; Gas ticks continue after the host dies. Gas radius grows by 0.3m per active proc from its 3m base, capped at 6m. For neighbors entered in the 3–6m annulus, coverage assumes a uniform area distribution; exact positions are not simulated. Neighbor status histories, direct hits, and chained deaths are not modeled. Fractional proc rolls and random outcomes remain mean-field estimates; natural Shield regeneration, external Shield restoration, boss attenuation, and projectile travel are not modeled. The optimizer uses a separate fast scoring proxy. <a href="https://wiki.warframe.com/w/Damage/Gas_Damage" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">WARFRAME Wiki: Gas</a>
                                                                    </p>
                                                                    <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
                                                                        <label htmlFor="planner-nearby-enemies" className="text-[10px] text-slate-400">
                                                                            Additional enemies within the 3m Electricity/Gas radius
                                                                        </label>
                                                                        <input
                                                                            id="planner-nearby-enemies"
                                                                            aria-label="Additional enemies within the 3m Electricity/Gas radius"
                                                                            type="number"
                                                                            min={0}
                                                                            max={20 - nearbyGasOuterEnemyCount}
                                                                            step={1}
                                                                            value={nearbyEnemyCount}
                                                                            onChange={(event) => setNearbyEnemyCount(Math.max(0, Math.min(20 - nearbyGasOuterEnemyCount, Math.floor(Number(event.target.value) || 0))))}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        These neighbors remain inside the fixed 3m Electricity range and the base 3m Gas radius. Their positions inside that range are not modeled.
                                                                    </p>
                                                                    <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
                                                                        <label htmlFor="planner-nearby-gas-outer-enemies" className="text-[10px] text-slate-400">
                                                                            Additional Gas neighbors in the 3–6m annulus
                                                                        </label>
                                                                        <input
                                                                            id="planner-nearby-gas-outer-enemies"
                                                                            aria-label="Additional Gas neighbors in the 3–6m annulus"
                                                                            type="number"
                                                                            min={0}
                                                                            max={20 - nearbyEnemyCount}
                                                                            step={1}
                                                                            value={nearbyGasOuterEnemyCount}
                                                                            onChange={(event) => setNearbyGasOuterEnemyCount(Math.max(0, Math.min(20 - nearbyEnemyCount, Math.floor(Number(event.target.value) || 0))))}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        Gas reaches the outer ring as active stacks grow the cloud radius. Finite ticks use the current expected stack count; optimizer scoring uses its steady-state radius. Enemies in the annulus are assumed uniformly distributed by area, so partial coverage scales their expected aggregate damage.
                                                                    </p>
                                                                    <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
                                                                        <label htmlFor="planner-nearby-blast-enemies" className="text-[10px] text-slate-400">
                                                                            Additional nearby enemies in Blast's 5 m radius
                                                                        </label>
                                                                        <input
                                                                            id="planner-nearby-blast-enemies"
                                                                            aria-label="Additional nearby enemies in Blast's 5 m radius"
                                                                            type="number"
                                                                            min={0}
                                                                            max={20}
                                                                            step={1}
                                                                            value={nearbyBlastEnemyCount}
                                                                            onChange={(event) => setNearbyBlastEnemyCount(Math.max(0, Math.min(20, Math.floor(Number(event.target.value) || 0))))}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        The optimizer estimates cap-triggered radial damage from proc arrivals during the fuse and on-death radial damage from the primary target's modeled kill time and expected active stacks. Cap resets are included as an expected stack-count remainder. The finite encounter reports cap and on-death radial hits to these same-profile targets separately; collateral does not change primary TTK. Neighbor status histories and chained deaths are not simulated. <a href="https://wiki.warframe.com/w/Damage/Blast_Damage" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">WARFRAME Wiki: Blast</a>. Set 0 to ignore Blast collateral.
                                                                    </p>
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={bossBlastStackCap}
                                                                            onChange={(event) => setBossBlastStackCap(event.target.checked)}
                                                                        />
                                                                        Apply boss Blast cap (4 stacks)
                                                                    </label>
                                                                    {bossBlastStackCap && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-500">
                                                                            Current Damage/Calculation rules use a four-stack Blast detonation threshold for bosses. This sets only that threshold; boss attenuation and other boss-specific defenses are not modeled. <a href="https://wiki.warframe.com/w/Damage/Calculation" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={punctureVipStackCap}
                                                                            onChange={(event) => setPunctureVipStackCap(event.target.checked)}
                                                                        />
                                                                        Model an Overguarded VIP (Puncture cap: 3 stacks)
                                                                    </label>
                                                                    {punctureVipStackCap && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-500">
                                                                            Applies the Wiki's three-stack Puncture limit to this target and its derived Puncture critical-chance support. Select this only for a VIP enemy with Overguard; the planner does not infer VIP identity or model boss-specific attenuation. <a href="https://wiki.warframe.com/w/Overguard" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isEximus}
                                                                            onChange={(event) => {
                                                                                setIsEximus(event.target.checked);
                                                                                if (event.target.checked) setScaleCustomTargetByLevel(true);
                                                                            }}
                                                                        />
                                                                        Model a standard Eximus target
                                                                    </label>
                                                                    {isEximus && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-500">
                                                                            Uses current Eximus Health/Shield adjustments, standard Armor scaling, and level-scaled base Overguard {EXIMUS_BASE_OVERGUARD}. Radiation statuses can be applied while Overguard is active, but their effects are suppressed until the pool breaks; Cold caps at four stacks, and Blast keeps its normal ten-stack detonation threshold. Special Eximus, squad, and boss modifiers remain unsupported. <a href="https://wiki.warframe.com/w/Overguard" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSteelPath}
                                                                            disabled={!scaleCustomTargetByLevel}
                                                                            onChange={(event) => setIsSteelPath(event.target.checked)}
                                                                        />
                                                                        Apply Steel Path modifiers (+100 levels, 2.5× Health/Shields)
                                                                    </label>
                                                                    {isSteelPath && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-500">
                                                                            Uses the entered current mission level plus 100, then applies 2.5× Health and Shields. Armor uses the resulting level curve without a separate Steel Path multiplier. Archwing, Railjack, Duviri, squad scaling, and special-unit exceptions are not modeled. <a href="https://wiki.warframe.com/w/Steel_Path" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={scaleCustomTargetByLevel}
                                                                            disabled={isEximus}
                                                                            onChange={(event) => { setScaleCustomTargetByLevel(event.target.checked); setSelectedEnemyProfileId(""); if (!event.target.checked) setIsSteelPath(false); }}
                                                                        />
                                                                        Scale entered base stats to an enemy level
                                                                    </label>
                                                                    {scaleCustomTargetByLevel && (
                                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                            <label className="space-y-1 text-[10px] text-slate-400">
                                                                                <span className="block">Scaling family</span>
                                                                                <select
                                                                                    value={enemyScalingFaction}
                                                                                    onChange={(event) => { setEnemyScalingFaction(event.target.value as EnemyScalingFaction); setSelectedEnemyProfileId(""); }}
                                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                                                                                >
                                                                                    {ENEMY_SCALING_FACTIONS.map((entry) => (
                                                                                        <option key={entry.value} value={entry.value}>{entry.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </label>
                                                                            {([
                                                                                ["Base level", enemyBaseLevel, setEnemyBaseLevel],
                                                                                ["Current level", enemyCurrentLevel, setEnemyCurrentLevel],
                                                                            ] as const).map(([label, value, setter]) => (
                                                                                <label key={label} className="space-y-1 text-[10px] text-slate-400">
                                                                                    <span className="block">{label}</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        max={9999}
                                                                                        step={1}
                                                                                        value={value}
                                                                                        onChange={(event) => { setter(Math.max(1, Math.min(9999, Math.floor(Number(event.target.value) || 1)))); setSelectedEnemyProfileId(""); }}
                                                                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                                    />
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        {scaleCustomTargetByLevel
                                                                            ? "Enter base Health, Shields, and Armor. Standard faction level curves and the separate Overguard curve produce current values. Eximus adjustments apply only when selected; Steel Path can be added above."
                                                                            : "Enter current Health, Shields, Overguard, and Armor values."}
                                                                    </p>
                                                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                        {(["health", "shields", "overguard", "armor"] as const).map((key) => (
                                                                            <label key={key} className="space-y-1 text-[10px] text-slate-400">
                                                                                <span className="block">{scaleCustomTargetByLevel ? "Base " : "Current "}{key === "shields" ? "Shields" : key[0].toUpperCase() + key.slice(1)}</span>
                                                                                <input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    max={1000000000}
                                                                                    step={key === "armor" ? 1 : 100}
                                                                                    value={isEximus && key === "overguard" ? EXIMUS_BASE_OVERGUARD : customTargetStats[key]}
                                                                                    disabled={isEximus && key === "overguard"}
                                                                                    onChange={(event) => {
                                                                                        setCustomTargetStats((current) => ({
                                                                                            ...current,
                                                                                            [key]: Math.max(0, Math.min(1000000000, Number(event.target.value) || 0)),
                                                                                        }));
                                                                                        setSelectedEnemyProfileId("");
                                                                                    }}
                                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                                                                                />
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                    {scaleCustomTargetByLevel && (
                                                                        <div className="font-mono text-[10px] text-slate-500">
                                                                            Scaled current values: Health {Math.round(resolvedCustomTargetStats.health)}, Shields {Math.round(resolvedCustomTargetStats.shields)}, Overguard {Math.round(resolvedCustomTargetStats.overguard)}, Armor {Math.round(resolvedCustomTargetStats.armor)}
                                                                        </div>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={customToxinBypassesShields}
                                                                            onChange={(event) => { setCustomToxinBypassesShields(event.target.checked); setSelectedEnemyProfileId(""); }}
                                                                        />
                                                                        Toxin bypasses Shields (turn off for Hounds or Treasurers)
                                                                    </label>
                                                                    <label className="block space-y-1 text-[10px] text-slate-400">
                                                                        <span>Hit behavior during enemy Shield Gate</span>
                                                                        <select
                                                                            aria-label="Hit behavior during enemy Shield Gate"
                                                                            value={enemyShieldGateHitMode}
                                                                            onChange={(event) => setEnemyShieldGateHitMode(event.target.value as typeof enemyShieldGateHitMode)}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                                                                        >
                                                                            <option value="body">Body hit: 5% direct Health damage</option>
                                                                            <option value="weakspot">Weakspot: bypass gate</option>
                                                                            <option value="blockedArea">Slam/AoE: direct hit blocked</option>
                                                                        </select>
                                                                        <span className="block leading-relaxed text-slate-500">
                                                                            Enemy Gates last 0.1 s after Shields break. This selection applies to each direct attack in the finite encounter and direct-hit sequence; status ticks stay ungated. Shield regeneration and weapon-specific weakspot eligibility are not inferred. <a href="https://wiki.warframe.com/w/Shield#Shield_Gating" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </span>
                                                                    </label>
                                                                    <div>
                                                                        <div className="mb-1 text-[10px] text-slate-500">Status immunities</div>
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                                            {STATUS_DAMAGE_TYPES.map((type) => (
                                                                                <label key={type} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={targetStatusImmunities.includes(type)}
                                                                                        onChange={(event) => {
                                                                                            setTargetStatusImmunities((current) => event.target.checked
                                                                                                ? [...new Set([...current, type])]
                                                                                                : current.filter((value) => value !== type));
                                                                                            setSelectedEnemyProfileId("");
                                                                                        }}
                                                                                    />
                                                                                    {type[0].toUpperCase() + type.slice(1)}
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {weapon ? (
                                <div className="grid xl:grid-cols-[280px_minmax(0,1fr)] gap-4 p-4">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 overflow-hidden">
                                        <div className="border-b border-slate-800/70 px-4 py-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--wf-warning)]">Capacity</div>
                                                {displayedCapacity && (
                                                    <div className="font-mono text-lg">
                                                        <span className={displayedCapacity.over ? "text-red-400" : "text-[color:var(--wf-warning)]"}>{displayedCapacity.used}</span>
                                                        <span className="text-slate-600">/</span>
                                                        <span className="text-slate-200">{displayedCapacity.total}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {displayedCapacity && (
                                                <>
                                                    <div className="mt-2">
                                                        <CapBar used={displayedCapacity.used} total={displayedCapacity.total} over={displayedCapacity.over} />
                                                    </div>
                                                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                                                        <span>{displayedCapacity.remaining >= 0 ? `${displayedCapacity.remaining} remaining` : `${Math.abs(displayedCapacity.remaining)} over`}</span>
                                                        <span>{buildCfg.hasCatalyst ? "Catalyzed" : "Uncatalyzed"} · MR {buildCfg.masteryRank}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {activeMetrics && (
                                            <div className="space-y-4 px-4 py-4">
                                                {weapon.attacks.length > 1 && (
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Attack Mode</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {weapon.attacks.map((atk, i) => (
                                                                <button
                                                                    key={atk.name}
                                                                    onClick={() => setSelectedAttackIdx(i)}
                                                                    className={[
                                                                        "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                                                                        selectedAttackIdx === i
                                                                            ? "border-sky-400/60 bg-sky-950/40 text-sky-200"
                                                                            : "border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-500",
                                                                    ].join(" ")}
                                                                >
                                                                    {atk.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex gap-1.5">
                                                    {([
                                                        ["stats", "Weapon Stats"],
                                                        ["why", "Why This Build"],
                                                    ] as const).map(([key, label]) => (
                                                        <button
                                                            key={key}
                                                            onClick={() => setInfoTab(key)}
                                                            className={[
                                                                "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                                                                infoTab === key
                                                                    ? "border-sky-400/60 bg-sky-950/40 text-sky-200"
                                                                    : "border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-500",
                                                            ].join(" ")}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowMathWindow(true)}
                                                        className={[
                                                            "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                                                            showMathWindow
                                                                ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]"
                                                                : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text)] hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-info)]",
                                                        ].join(" ")}
                                                    >
                                                        Open Math
                                                    </button>
                                                </div>

                                                {infoTab === "stats" && (
                                                    <>
                                                        {phantasmaAltFireModelNote && (
                                                            <div className="space-y-2 rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                                                                <div role="note">
                                                                    <span className="font-semibold">Phantasma alt-fire estimate:</span> {phantasmaAltFireModelNote}
                                                                </div>
                                                                <label className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-semibold">Charge ammo per attack</span>
                                                                    <input
                                                                        aria-label="Phantasma charge ammo per attack"
                                                                        type="number"
                                                                        min={2}
                                                                        max={Math.max(2, Math.floor(activeMetrics?.modded.magazineSize ?? activeCalcWeapon?.magazineSize ?? 2))}
                                                                        step={1}
                                                                        value={Math.min(phantasmaChargeAmmo, Math.max(2, Math.floor(activeMetrics?.modded.magazineSize ?? activeCalcWeapon?.magazineSize ?? 2)))}
                                                                        onChange={(event) => {
                                                                            const maxAmmo = Math.max(2, Math.floor(activeMetrics?.modded.magazineSize ?? activeCalcWeapon?.magazineSize ?? 2));
                                                                            const nextAmmo = Number(event.target.value);
                                                                            setPhantasmaChargeAmmo(Number.isFinite(nextAmmo)
                                                                                ? Math.max(2, Math.min(maxAmmo, Math.round(nextAmmo)))
                                                                                : 2);
                                                                        }}
                                                                        className="w-20 rounded border border-amber-800/70 bg-slate-950 px-2 py-1 text-xs text-amber-100"
                                                                    />
                                                                    <span>
                                                                        {fmt(activeMetrics?.modded.chargeTimeSeconds ?? 0, 3)} s at 11 ammo/s · {fmt(activeMetrics?.modded.totalDamage ?? 0)} selected-row damage
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        )}
                                                        {attackDamageRampNote && (
                                                            <div role="note" className="rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                                                                <span className="font-semibold">Attack damage ramp:</span> {attackDamageRampNote}
                                                            </div>
                                                        )}
                                                        {meleeDpsModelNote && (
                                                            <div role="note" className="rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                                                                <span className="font-semibold">Melee DPS estimate:</span> {meleeDpsModelNote}
                                                            </div>
                                                        )}
                                                {weapon && usesMeleeDamageModel(weapon.category) && (
                                                    <div className="rounded-md border border-slate-700/70 bg-slate-900/40 px-3 py-3 space-y-2">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Wiki stance DPS estimate</div>
                                                        {meleeAverageDps ? (
                                                            <div className="space-y-1 text-[11px] text-sky-200">
                                                                <p>{meleeDpsInputs?.stanceName} · Neutral: {meleeDpsInputs?.comboName}</p>
                                                                <p>{fmt(meleeDpsInputs?.totalDamageMultiplier ?? 0, 2)}× direct + {fmt(meleeDpsInputs?.totalSlashProcMultiplier ?? 0, 2)}× forced Slash · {fmt(meleeDpsInputs?.baseComboLengthSeconds ?? 0, 2)}s approximate combo</p>
                                                                <p>{fmt(meleeAverageDps.directDamage)} direct + {fmt(meleeAverageDps.forcedSlashDamage)} forced Slash DoT = {fmt(meleeAverageDps.averageHit)} average combo damage · {fmt(meleeAverageDps.averageDps)} stance-average DPS</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] leading-relaxed text-slate-500">
                                                                {stanceMod
                                                                    ? `The Wiki has no timed Neutral combo for ${stanceMod.name}; no stance estimate is shown.`
                                                                    : "Select a stance to calculate its Wiki-backed Neutral combo estimate automatically."}
                                                            </p>
                                                        )}
                                                        <a
                                                            href={WIKI_MELEE_STANCE_SOURCE_URL}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-block text-[10px] text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
                                                        >
                                                            Warframe Wiki stance comparison · checked {WIKI_MELEE_STANCE_VERIFIED_AT}
                                                        </a>
                                                    </div>
                                                )}
                                                        <div>
                                                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">Primary</div>
                                                            <div className="space-y-1.5 text-sm">
                                                                {[
                                                                    {
                                                                        label: usesHitTerminology(weapon.category) ? "Attack Speed" : "Fire Rate",
                                                                        value: `${activeMetrics.modded.fireRate.toFixed(2)}`,
                                                                        tooltip: `${usesHitTerminology(weapon.category) ? BASIC_STAT_TOOLTIPS.attackSpeed : BASIC_STAT_TOOLTIPS.fireRate}\n\nAt the current value, this build performs about ${activeMetrics.modded.fireRate.toFixed(2)} ${usesHitTerminology(weapon.category) ? "attacks" : "attack events"} per second.`,
                                                                    },
                                                                    {
                                                                        label: "Magazine",
                                                                        value: displayMagazineValue(weapon, activeMetrics.modded.magazineSize),
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.magazine}\n\nThe current effective value is ${displayMagazineValue(weapon, activeMetrics.modded.magazineSize)}.`,
                                                                    },
                                                                    {
                                                                        label: "Reload",
                                                                        value: `${activeMetrics.modded.reloadTime.toFixed(2)}s`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.reload}\n\nThe current effective reload time is ${activeMetrics.modded.reloadTime.toFixed(2)}s.`,
                                                                    },
                                                                    {
                                                                        label: activeMetrics.modded.pelletHitEstimate ? "Expected pellet hits" : "Multishot",
                                                                        value: `${activeMetrics.modded.multishot.toFixed(2)}`,
                                                                        tooltip: activeMetrics.modded.pelletHitEstimate
                                                                            ? `Experimental centered-target estimate: ${fmt(activeMetrics.modded.pelletHitEstimate.nominalExpectedHits, 2)} expected hits from ${fmt(activeMetrics.modded.pelletHitEstimate.pelletsFired, 2)} fired pellets. Spread-endpoint range: ${fmt(activeMetrics.modded.pelletHitEstimate.minimumExpectedHits, 2)}–${fmt(activeMetrics.modded.pelletHitEstimate.maximumExpectedHits, 2)}. Assumes one idealized center pellet plus uniform solid-angle sampling for the rest.`
                                                                            : `${BASIC_STAT_TOOLTIPS.multishot}\n\n${describeMultishot(activeMetrics.modded.multishot)}`,
                                                                    },
                                                                    {
                                                                        label: "Burst DPS",
                                                                        value: activeAttackDpsUnavailable ? "Unavailable" : fmt(activeMetrics.burstDPS),
                                                                        tooltip: activeAttackDpsUnavailable
                                                                            ? "This attack is reference-only with the current inputs. Target damage and DPS are unavailable; see the attack note for supported ways to enable a bounded single-target estimate."
                                                                        : `${BASIC_STAT_TOOLTIPS.burstDps}\n\nAt the current values, burst DPS is ${fmt(activeMetrics.burstDPS)}.${activeMetrics.modded.strainInfectionCritDamageBonus > 0 ? `\n\nStrain Infection Burst scoring assumes ${activeMetrics.modded.strainInfectionCystsAtImpact}/8 active cysts at impact and keeps that count static within the calculation. Cyst timing and average uptime are not modeled.` : ""}${activeMetrics.modded.dreadfulKillshotBonus > 0 ? `\n\nDreadful Killshot Burst scoring assumes ${fmt(activeMetrics.modded.dreadfulKillshotCurrentHealth)} current Warframe Health and applies +${fmt(activeMetrics.modded.dreadfulKillshotBonus * 100, 0)}% additive Damage and Status Chance. The snapshot is held static; health buffs and damage taken are not simulated.` : ""}${activeMetrics.modded.deadlyManeuversHeadshotCritChanceBonus > 0 ? `\n\nDeadly Maneuvers assumes ${activeMetrics.modded.deadlyManeuversShotsRemaining} buffed shot(s) remain after a dodge. The listed rank bonus applies multiplicatively after other bonuses to headshot Critical Chance; Burst averages the next two shots at the configured headshot share. Dodge and shot history are not simulated.` : ""}${weapon.weaponType.trim().toLowerCase() === "bow" ? "\n\nCharged bow shots use charge cadence and exclude the post-shot reload; uncharged shots use the reload delay." : ""}${meleeDpsModelNote ? `\n\n${meleeDpsModelNote}` : ""}${phantasmaAltFireModelNote ? `\n\n${phantasmaAltFireModelNote}` : ""}${attackDamageRampNote ? `\n\n${attackDamageRampNote}` : ""}`,
                                                                    },
                                                                    {
                                                                        label: "Sustained DPS",
                                                                        value: activeSustainedDpsUnavailable ? "Unavailable" : fmt(finiteMetrics?.sustainedDPS ?? activeMetrics.sustainedDPS),
                                                                        tooltip: activeSustainedDpsUnavailable
                                                                            ? activeOverpressuredRoundsSelected && activeCalcWeapon?.selectedAttackName === "Buckshot"
                                                                                ? "Overpressured Rounds' next-shot buff and kill-based magazine restore require attack history. The manually entered post-kill spread plus sourced Falloff Distance snapshot can affect one Burst event; sustained DPS is unavailable."
                                                                                : activeSentientIncisionUnsupportedTarget
                                                                                    ? "Sentient Incision needs a supported target faction or active Overguard to resolve its adaptive damage type."
                                                                                : activeSentientIncisionOverguardTimelineLimit
                                                                                    ? "Burst uses the initial Corrosive snapshot. Sustained DPS is unavailable because the element changes when Overguard breaks."
                                                                                : "This attack is reference-only with the current inputs. Target damage and DPS are unavailable; see the attack note for supported ways to enable a bounded single-target estimate."
                                                                            : `${BASIC_STAT_TOOLTIPS.sustainedDps}\n\nAt the current values, sustained DPS is ${fmt(finiteMetrics?.sustainedDPS ?? activeMetrics.sustainedDPS)}.${activeMetrics.modded.strainInfectionCritDamageBonus > 0 ? "\n\nThe Strain Infection Burst-at-impact cyst assumption is excluded because cyst timing and uptime are not modeled." : ""}${activeMetrics.modded.dreadfulKillshotBonus > 0 ? "\n\nThe Dreadful Killshot current-Health snapshot is excluded from sustained scoring." : ""}${meleeDpsModelNote ? `\n\n${meleeDpsModelNote}` : ""}${phantasmaAltFireModelNote ? `\n\n${phantasmaAltFireModelNote}` : ""}${attackDamageRampNote ? `\n\n${attackDamageRampNote}` : ""}`,
                                                                    },
                                                                ].map((row) => (
                                                                    <InlineStatRow
                                                                        key={row.label}
                                                                        label={row.label}
                                                                        value={row.value}
                                                                        tooltip={row.tooltip}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">Damage</div>
                                                            <div className="space-y-1.5 text-sm">
                                                                {[
                                                                    {
                                                                        label: "Critical Chance",
                                                                        value: `${fmt(activeMetrics.modded.critChance * 100, 1)}%`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.criticalChance}\n\n${describeCritChance(activeMetrics.modded.critChance)}`,
                                                                    },
                                                                    {
                                                                        label: "Critical Damage",
                                                                        value: `${activeMetrics.modded.critMultiplier.toFixed(1)}x`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.criticalDamage}\n\n${describeCritMultiplier(activeMetrics.modded.critChance, activeMetrics.modded.critMultiplier)}`,
                                                                    },
                                                                    {
                                                                        label: "Status",
                                                                        value: `${fmt(activeMetrics.modded.statusChance * 100, 1)}%`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.statusChance}\n\n${describeStatusChance(activeMetrics.modded.statusChance)}`,
                                                                    },
                                                                ].map((row) => (
                                                                    <InlineStatRow
                                                                        key={row.label}
                                                                        label={row.label}
                                                                        value={row.value}
                                                                        tooltip={row.tooltip}
                                                                    />
                                                                ))}
                                                                {Object.entries(activeMetrics.modded.rawDamageBreakdown)
                                                                    .filter(([, value]) => value > 0)
                                                                    .sort((a, b) => b[1] - a[1])
                                                                    .map(([type, value]) => {
                                                                        const quantizedValue = activeMetrics.modded.damageBreakdown[type as keyof typeof activeMetrics.modded.damageBreakdown] ?? 0;
                                                                        const damageShare = activeMetrics.modded.totalDamage > 0 ? quantizedValue / activeMetrics.modded.totalDamage : 0;
                                                                        const actualProcChance = damageShare * activeMetrics.modded.statusChance;
                                                                        const tooltip = [
                                                                            STATUS_TIPS[type] ?? `${capitalizeDamageType(type)} status effect.`,
                                                                            `Actual proc chance: ${fmt(actualProcChance * 100, 1)}% (${fmt(activeMetrics.modded.statusChance * 100, 1)}% status chance × ${fmt(damageShare * 100, 1)}% damage share). ${activeDamageTypeSources[type] ?? `${capitalizeDamageType(type)} is present in the current damage mix.`}`,
                                                                        ].join("\n\n");
                                                                        const dmgIcon = DAMAGE_TYPE_ICON[type];
                                                                        const parents = COMBINED_ELEMENT_PARENTS[type];
                                                                        const dmgLabel = (
                                                                            <span className="flex items-center gap-1">
                                                                                {dmgIcon && <img src={dmgIcon} alt={type} className="w-4 h-4 shrink-0" />}
                                                                                <span>{capitalizeDamageType(type)}</span>
                                                                                {parents && (
                                                                                    <span className="flex items-center gap-0.5 text-slate-500 opacity-70">
                                                                                        <span>(</span>
                                                                                        {DAMAGE_TYPE_ICON[parents[0]] && <img src={DAMAGE_TYPE_ICON[parents[0]]} alt={parents[0]} className="w-3.5 h-3.5" />}
                                                                                        <span>+</span>
                                                                                        {DAMAGE_TYPE_ICON[parents[1]] && <img src={DAMAGE_TYPE_ICON[parents[1]]} alt={parents[1]} className="w-3.5 h-3.5" />}
                                                                                        <span>)</span>
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        );
                                                                        return (
                                                                            <InlineStatRow
                                                                                key={type}
                                                                                label={dmgLabel}
                                                                                value={fmt(value, 1)}
                                                                                sub={fmt(actualProcChance * 100, 1) + "%"}
                                                                                tooltip={tooltip}
                                                                                labelClassName={[
                                                                                    "capitalize",
                                                                                    type === "viral" ? "text-lime-300" :
                                                                                    type === "heat" ? "text-[color:var(--wf-warning)]" :
                                                                                    type === "cold" ? "text-[color:var(--wf-info)]" :
                                                                                    type === "electricity" ? "text-violet-300" :
                                                                                    type === "toxin" ? "text-emerald-300" :
                                                                                    type === "slash" ? "text-red-300" :
                                                                                    type === "puncture" ? "text-yellow-100" :
                                                                                    type === "impact" ? "text-blue-300" :
                                                                                    "text-sky-200/80",
                                                                                ].join(" ")}
                                                                            />
                                                                        );
                                                                    })}
                                                                {activeMetrics.modded.physicalDamageConversion && (
                                                                    <div role="note" className="mt-2 text-[10px] leading-relaxed text-slate-500">
                                                                        Beast Claw Conditioning converts all base physical damage to {capitalizeDamageType(activeMetrics.modded.physicalDamageConversion)}; elemental damage is unchanged.{" "}
                                                                        <a href={BEAST_CLAW_CONDITIONING_WIKI_URL[activeMetrics.modded.physicalDamageConversion]} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">WARFRAME Wiki</a>
                                                                    </div>
                                                                )}
                                                                {activeMetrics.modded.elementalDamageConversion && (
                                                                    <div role="note" className="mt-2 text-[10px] leading-relaxed text-slate-500">
                                                                        Beast Claw elemental conversion changes primary elemental damage to {capitalizeDamageType(activeMetrics.modded.elementalDamageConversion)}. Radiation/Magnetic and other secondary damage stay separate; Momentous Bond's separate bonus is not converted.{" "}
                                                                        <a href={BEAST_CLAW_ELEMENTAL_CONVERSION_WIKI_URL[activeMetrics.modded.elementalDamageConversion]} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">WARFRAME Wiki</a>
                                                                    </div>
                                                                )}
                                                                <div className="pt-1 text-base">
                                                                    <InlineStatRow
                                                                        label="Arsenal Total"
                                                                        value={fmt(activeMetrics.modded.arsenalDamage, 1)}
                                                                        tooltip={BASIC_STAT_TOOLTIPS.totalDamage}
                                                                        labelClassName="text-sky-100"
                                                                    />
                                                                </div>
                                                                {activeCalcWeapon?.selectedAttackUsesMeleeComboMultiplier && (
                                                                    <div role="note" className="mt-2 rounded-md border border-slate-700/70 bg-slate-900/40 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                                                                        <div className="font-semibold text-slate-200">After one Heavy Attack</div>
                                                                        <div>
                                                                            {fmt(activeMetrics.modded.meleeComboPointsBeforeHeavyAttack, 1)} combo points × {fmt(activeMetrics.modded.heavyAttackEfficiency * 100, 1)}% efficiency = {fmt(activeMetrics.modded.meleeComboPointsAfterHeavyAttack, 1)} retained points ({fmt(activeMetrics.modded.meleeComboMultiplierAfterHeavyAttack, 0)}× tier).
                                                                        </div>
                                                                        <div className="text-slate-500">Uses the minimum points for the entered tier unless Initial Combo supplies the active tier. The direct-hit TTK applies retention and 40 points/s Initial Combo recovery; it excludes combo gained by the attack. DPS, finite status encounter, and optimizer scoring still hold the starting tier.</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {infoTab === "why" && (
                                                    <div className="space-y-3">
                                                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-3 space-y-2">
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Score assumptions</div>
                                                            <div className="grid gap-x-4 gap-y-1.5 text-[10px] text-slate-400 sm:grid-cols-2">
                                                                <div><span className="text-slate-500">Objective:</span> {GOAL_OPTIONS.find((option) => option.key === goal)?.label ?? goal}</div>
                                                                <div><span className="text-slate-500">Target:</span> {activeTargetSummary}</div>
                                                                <div><span className="text-slate-500">Attack:</span> {weapon.attacks[selectedAttackIdx]?.name ?? "Normal attack"}</div>
                                                                {activeCalcWeapon?.selectedAttackAutoSpoolTimingLimitation && (
                                                                    <div role="note" className="sm:col-span-2 text-amber-200">
                                                                        <span className="font-semibold">Finite Auto-Spool timing unavailable:</span> {activeCalcWeapon.selectedAttackAutoSpoolTimingLimitation.reason} Expected TTK and finite attack sequences are withheld; steady-state stats continue to use the fully spooled Arsenal rate. {" "}
                                                                        <a href={activeCalcWeapon.selectedAttackAutoSpoolTimingLimitation.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Wiki source</a>
                                                                    </div>
                                                                )}
                                                                {activeCalcWeapon?.selectedAttackIsIncarnon && activeCalcWeapon.selectedAttackIncarnonAmmoCapacity !== undefined && (
                                                                    <div className="sm:col-span-2">
                                                                        <span className="text-slate-500">Incarnon ammo:</span> one full transformation, {fmt(activeCalcWeapon.selectedAttackIncarnonAmmoCapacity, 0)} rounds. The finite encounter stops at this limit; burst attacks count individual rounds, and charge-building/reversion are not simulated.{" "}
                                                                        {activeCalcWeapon.selectedAttackIncarnonAmmoCapacitySourceUrl && (
                                                                            <a href={activeCalcWeapon.selectedAttackIncarnonAmmoCapacitySourceUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {activeCalcWeapon?.selectedAttackAmmoCostModelNote && (
                                                                    <div className="sm:col-span-2"><span className="text-slate-500">Ammo-cost assumption:</span> {activeCalcWeapon.selectedAttackAmmoCostModelNote}</div>
                                                                )}
                                                                {activeWeaponState?.appliedIncarnonOptions.length ? (
                                                                    <div className="sm:col-span-2">
                                                                        <span className="text-slate-500">Incarnon path:</span> {activeWeaponState.appliedIncarnonOptions.map((option) => option.name).join(" · ")} · modeled effects only
                                                                    </div>
                                                                ) : null}
                                                                {activeIncarnonUnsupportedLines.length > 0 && (
                                                                    <div className="sm:col-span-2 text-amber-200">
                                                                        <span className="font-semibold">Incarnon effects excluded from this score:</span> {activeIncarnonUnsupportedLines.join(" · ")}
                                                                    </div>
                                                                )}
                                                                {activeIncarnonHasExpectedHitProcs && (
                                                                    <div className="sm:col-span-2">
                                                                        <span className="text-slate-500">Stochastic Incarnon effect:</span> damage uses its probability-weighted mean; individual per-shot proc streaks are not simulated.
                                                                    </div>
                                                                )}
                                                                <div><span className="text-slate-500">Conditional state:</span> {conditionalState.mode}</div>
                                                                {conditionalState.mode === "realistic" && activeCalcWeapon?.selectedAttackIsAreaDamage !== true && activeBuildEffects.some((effect) =>
                                                                    effect?.conditionalEffects?.some((conditional) =>
                                                                        conditional.trigger === "onKill" && (conditional.stats.directDamagePerStatusBonus ?? 0) > 0,
                                                                    ) === true,
                                                                ) && (
                                                                    <div className="sm:col-span-2">
                                                                        <span className="text-slate-500">Galvanized per-status kill cadence:</span>{" "}
                                                                        {expectedKillRatePerSecond && expectedKillRatePerSecond > 0
                                                                            ? `${fmt(1 / expectedKillRatePerSecond, 3)}s per repeated-target kill`
                                                                            : "unavailable for this attack/target"}; assumes repeated identical targets and a kill from the weapon with the mod. The Wiki timeout removes one stack and resets its timer; individual kill history and outside kill sources are not simulated. <a href="https://wiki.warframe.com/w/Galvanized_Mods" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">WARFRAME Wiki</a>
                                                                    </div>
                                                                )}
                                                                {(externalStatusTypeCount > 0 || externalStatusTypes.length > 0) && (
                                                                    <div><span className="text-slate-500">External status assumption:</span> {externalStatusTypes.length > 0 ? externalStatusTypes.join(" · ") + " maintained throughout the encounter" : "none named"}{externalStatusTypeCount > 0 ? ` · ${externalStatusTypeCount} legacy unnamed type(s), Condition Overload only` : ""}</div>
                                                                )}
                                                                {usesMeleeDamageModel(weapon.category) && (
                                                                    <div><span className="text-slate-500">Melee combo:</span> {fmt(activeMetrics?.modded.meleeComboMultiplier ?? 1, 0)}× for combo-scaled mods</div>
                                                                )}
                                                                {activeMetrics && (
                                                                    <>
                                                                        <div><span className="text-slate-500">Selected-state fresh-target crit:</span> {fmt((activeMetrics?.modded.critChance ?? 0) * 100, 1)}% at {fmt(activeMetrics?.modded.critMultiplier ?? 1, 2)}× · expected tier {fmt(activeMetrics?.modded.averageCritTier ?? 0, 2)}{activeMetrics.modded.strainInfectionCritDamageBonus > 0 ? ` · Burst assumes ${activeMetrics.modded.strainInfectionCystsAtImpact}/8 cysts at impact` : ""}{activeMetrics.modded.dreadfulKillshotBonus > 0 ? ` · Burst assumes Dreadful Killshot at ${fmt(activeMetrics.modded.dreadfulKillshotCurrentHealth)} Health` : ""}</div>
                                                                        {activeMetrics.modded.deadlyManeuversHeadshotCritChanceBonus > 0 && (
                                                                            <div className="sm:col-span-2"><span className="text-slate-500">Deadly Maneuvers Burst snapshot:</span> {activeMetrics.modded.deadlyManeuversShotsRemaining} buffed shot(s) remain · ×{fmt(1 + activeMetrics.modded.deadlyManeuversHeadshotCritChanceBonus, 0)} headshot Critical Chance on each buffed shot · configured headshot share {fmt((activeMetrics.modded.hitLocation.headshotRate ?? 0) * 100, 1)}%. The next two shots are averaged.</div>
                                                                        )}
                                                                        {activeMetrics.modded.criticalPrecisionCritChanceBonus > 0 && (
                                                                            <div className="sm:col-span-2"><span className="text-slate-500">Critical Precision Burst snapshot:</span> {activeMetrics.modded.criticalPrecisionHeadshotProjectiles} prior headshot projectiles · +{fmt(activeMetrics.modded.criticalPrecisionCritChanceBonus * 100, 1)}% base Critical Chance, additive with similar mods and capped at +500%. Missed-burst decay is not modeled.</div>
                                                                        )}
                                                                        {activeMetrics.modded.unseenDreadCritDamageBonus > 0 && (
                                                                            <div className="sm:col-span-2"><span className="text-slate-500">Unseen Dread Burst snapshot:</span> Dread is assumed invisible · +{fmt(activeMetrics.modded.unseenDreadCritDamageBonus * 100, 0)}% Critical Damage. The three-enemy trigger and five-second duration are not simulated.</div>
                                                                        )}
                                                                        <div><span className="text-slate-500">{activeAttackDpsUnavailable ? "Reference per-attack damage:" : "Selected-state direct/attack:"}</span> {fmt(activeMetrics?.modded.averageShotDamage ?? 0)} {activeAttackDpsUnavailable ? "mean damage, not scored" : "mean damage before target pools"}</div>
                                                                        {activeTargetAttackDamage && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Selected-state damage to initial pools:</span>{" "}
                                                                                {fmt(activeTargetAttackDamage.totalDamage)} capped mean damage/attack · {activeTargetAttackDamage.activePool}{" "}
                                                                                (Overguard {fmt(activeTargetAttackDamage.damageByPool.overguard)}, Shields {fmt(activeTargetAttackDamage.damageByPool.shields)}, Health {fmt(activeTargetAttackDamage.damageByPool.health)})
                                                                            </div>
                                                                        )}
                                                                        {activeTargetAttackSequence && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">{hasBurstOnlyConditionalAssumption(conditionalState) ? "Finite direct-hit-only sequence (Burst-only assumptions excluded):" : "Selected-state direct-hit-only sequence:"}</span>{" "}
                                                                                {activeTargetAttackSequence.attacksToKill === null
                                                                                    ? activeTargetAttackSequence.attackCountLimitReached
                                                                                        ? "not defeated within one full Incarnon magazine"
                                                                                        : "not killable with the current direct-hit damage"
                                                                                    : `${fmt(activeTargetAttackSequence.attacksToKill, 0)} ${activeAttackEventLabel} · ${fmt(activeTargetAttackSequence.timeToKillSeconds ?? 0, 2)}s from first attack`}{" "}
                                                                                {activeTargetAttackSequence.comboMultiplierAtStart !== undefined && activeTargetAttackSequence.comboMultiplierAtKill !== undefined
                                                                                    ? `· heavy-attack combo ${fmt(activeTargetAttackSequence.comboMultiplierAtStart, 0)}× → ${fmt(activeTargetAttackSequence.comboMultiplierAtKill, 0)}× `
                                                                                    : ""}
                                                                                {activeMetrics?.modded.shatteringImpactBaseArmorPerHit
                                                                                    ? `· base Armor after Shattering Impact ${fmt(activeTargetAttackSequence.remainingArmorAfterBaseStrip, 0)} (before percentage strips) `
                                                                                    : ""}
                                                                                (mean damage per attack, ordered pool depletion, static target defenses; applies the selected enemy Shield Gate mode after Shields break, but excludes status ticks and shield regeneration{activeMetrics?.modded.attachedAttackDamageSequence ? " and the linked cloud sequence" : ""}{activeMetrics.modded.strainInfectionCritDamageBonus > 0 ? "; cyst timeline and uptime are not modeled" : ""}{activeMetrics.modded.dreadfulKillshotBonus > 0 ? "; Dreadful Killshot's current-Health snapshot is excluded" : ""}{activeMetrics.modded.criticalPrecisionCritChanceBonus > 0 ? "; Critical Precision snapshot is excluded" : ""}{activeMetrics.modded.unseenDreadCritDamageBonus > 0 ? "; Unseen Dread invisibility snapshot is excluded" : ""})
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Expected finite encounter:</span>{" "}
                                                                                {activeTargetEncounter.timeToKillSeconds === null
                                                                                    ? activeTargetEncounter.attackCountLimitReached
                                                                                        ? "not defeated within one full Incarnon magazine / " + fmt(activeTargetEncounter.attacks, 0) + " " + activeAttackEventLabel
                                                                                        : "not defeated within " + fmt(activeTargetEncounter.evaluatedDurationSeconds, 1) + "s / " + fmt(activeTargetEncounter.attacks, 0) + " " + activeAttackEventLabel
                                                                                    : fmt(activeTargetEncounter.timeToKillSeconds, 2) + "s · " + fmt(activeTargetEncounter.attacks, 0) + " " + activeAttackEventLabel}{" "}
                                                                                · {fmt(activeTargetEncounter.damagePerSecond)} damage/s · direct {fmt(activeTargetEncounter.directDamageByPool.health + activeTargetEncounter.directDamageByPool.shields + activeTargetEncounter.directDamageByPool.overguard)} + status {fmt(activeTargetEncounter.statusDamageByPool.health + activeTargetEncounter.statusDamageByPool.shields + activeTargetEncounter.statusDamageByPool.overguard)} damage{(encounterTargetMetrics?.modded.shatteringImpactBaseArmorPerHit ?? 0) > 0 ? ` · remaining base-stripped Armor ${fmt(activeTargetEncounter.remainingArmorAfterBaseStrip, 0)}` : ""}
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && activeTargetEncounter.blastCollateralEnemyCount > 0 && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Blast radial collateral:</span>{" "}
                                                                                {fmt(activeTargetEncounter.blastCollateralDamageByPool.health + activeTargetEncounter.blastCollateralDamageByPool.shields + activeTargetEncounter.blastCollateralDamageByPool.overguard)} aggregate damage across {activeTargetEncounter.blastCollateralEnemyCount} configured nearby target{activeTargetEncounter.blastCollateralEnemyCount === 1 ? "" : "s"}. This is reported separately and does not change the primary target's TTK.
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && activeTargetEncounter.electricGasCollateralEnemyCount > 0 && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Electricity/Gas collateral:</span>{" "}
                                                                                {fmt(activeTargetEncounter.electricGasCollateralDamageByPool.health + activeTargetEncounter.electricGasCollateralDamageByPool.shields + activeTargetEncounter.electricGasCollateralDamageByPool.overguard)} aggregate scheduled tick damage across {activeTargetEncounter.electricGasCollateralEnemyCount} configured nearby target{activeTargetEncounter.electricGasCollateralEnemyCount === 1 ? "" : "s"}. Gas ticks continue after the primary target dies; collateral does not change its TTK.
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && (
                                                                            <div className="sm:col-span-2"><span className="text-slate-500">Expected status applications in encounter:</span> {activeEncounterStatusSummary}</div>
                                                                        )}
                                                                        {activeBuildHasTennokai && tennokaiTimeline && (
                                                                            <div className="sm:col-span-2 rounded-md border border-violet-900/50 bg-violet-950/10 p-2">
                                                                                <span className="text-violet-300">Manual Tennokai event timeline:</span>{" "}
                                                                                {tennokaiTimeline.supported ? (
                                                                                    <>
                                                                                        <p className="mt-1">
                                                                                            {tennokaiRegularHitsBetweenHeavy} Normal Attack hit(s) before each {activeCalcWeapon?.attacks.find((attack) => attack.name === "Heavy Attack") ? "Heavy Attack" : "Heavy Slam"} · {fmt(tennokaiTimeline.expectedTennokaiHeavyAttackShare * 100, 1)}% expected Tennokai rate · {fmt(tennokaiTimeline.expectedDamagePerSecondBeforeTargetDefenses)} pre-defense direct + Bleed DPS · {fmt(tennokaiTimeline.expectedDamagePerSecondAfterTargetDefenses ?? 0)} applied target DPS.
                                                                                        </p>
                                                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-300">
                                                                                            {fmt(tennokaiTimeline.expectedSlashApplications, 2)} expected Slash applications · {fmt(tennokaiTimeline.expectedBleedTicks, 2)} expected Bleed ticks · {fmt(tennokaiTimeline.expectedBleedDamageAfterTargetDefenses)} Bleed damage applied
                                                                                            {activeBuildEffects.some((effect) => (effect?.relentlessCombinationSlashComboChance ?? 0) > 0)
                                                                                                ? ` · ${fmt(tennokaiTimeline.expectedRelentlessComboPoints, 2)} expected Relentless combo points (${fmt(tennokaiTimeline.expectedRelentlessComboPointsFromSlashApplications, 2)} from applications + ${fmt(tennokaiTimeline.expectedRelentlessComboPointsFromBleedTicks, 2)} from Bleed ticks)`
                                                                                                : ""}
                                                                                            {` · ${tennokaiTimeline.expectedBleedTickTargetKills} target(s) killed by Bleed ticks · ${tennokaiTimeline.events.length} attack events over ${fmt(tennokaiTimeline.evaluationDurationSeconds, 1)}s, including the Bleed tail`}
                                                                                            {activeBuildEffects.some((effect) => (effect?.tennokaiChainedDamageBonus ?? 0) > 0)
                                                                                                ? ` · ${fmt(tennokaiTimeline.events.reduce((total, event) => total + event.activeOpportunityProbability * event.tennokaiTargetKillProbability, 0), 2)} expected Truth's Flame kill chains`
                                                                                                : ""}
                                                                                        </p>
                                                                                        {tennokaiTimeline.notes.length > 0 && (
                                                                                            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{tennokaiTimeline.notes.join(" ")}</p>
                                                                                        )}
                                                                                    </>
                                                                                ) : tennokaiTimeline.limitation}
                                                                            </div>
                                                                        )}
                                                                        <div><span className="text-slate-500">{activeMetrics.modded.attachedAttackDamageSequence ? "Direct attack burst / sustained:" : "Burst / sustained:"}</span> {activeAttackDpsUnavailable ? "Unavailable" : `${fmt(activeMetrics.burstDPS)} / ${activeSustainedDpsUnavailable ? "Unavailable" : fmt(finiteMetrics?.sustainedDPS ?? activeMetrics.sustainedDPS)} DPS before target pools`}</div>
                                                                        <div><span className="text-slate-500">DoT:</span> {activeSustainedDpsUnavailable
                                                                            ? activeOverpressuredRoundsSelected && activeCalcWeapon?.selectedAttackName === "Buckshot"
                                                                                ? "Unavailable: kill and attack history not modeled"
                                                                                : activeSentientIncisionUnsupportedTarget
                                                                                    ? "Unavailable: Sentient Incision needs a supported target faction or active Overguard"
                                                                                : activeSentientIncisionOverguardTimelineLimit
                                                                                    ? "Unavailable: adaptive element changes when Overguard breaks"
                                                                                : "Unavailable for this attack model"
                                                                            : `${fmt(finiteMetrics?.modded.dotDps ?? activeMetrics.modded.dotDps)} DPS steady-state estimate`}</div>
                                                                        <div className="sm:col-span-2"><span className="text-slate-500">Proc mix after immunity:</span> {activeProcMixLabel}</div>
                                                                        {activeSentientIncisionSelected && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Sentient Incision:</span>{" "}
                                                                                {activeCalcWeapon?.selectedAttackUsesSlamDamageBonus === true
                                                                                    ? "Slam attacks receive no augment bonus."
                                                                                    : activeSentientIncisionUnsupportedTarget
                                                                                        ? "Burst scoring is unavailable until a supported target faction or active Overguard is selected."
                                                                                        : activeMetrics?.modded.sentientIncisionDamageType
                                                                                            ? `+${fmt(activeMetrics.modded.sentientIncisionDamageBonus * 100, 0)}% isolated ${activeMetrics.modded.sentientIncisionDamageType[0].toUpperCase()}${activeMetrics.modded.sentientIncisionDamageType.slice(1)} damage; it is added after elemental combination and does not scale the matching Status Effect DoT seed.${activeSentientIncisionOverguardTimelineLimit ? " The initial Overguard snapshot uses Corrosive, but the element changes when Overguard breaks, so sustained and finite scoring are unavailable." : ""}`
                                                                                            : "The adaptive damage type is not active for this weapon context."}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                                <div className="sm:col-span-2"><span className="text-slate-500">Modeled pools:</span> Health {fmt(activeTargetAssumptions.health, 0)} ({fmt(activeTargetAssumptions.healthShare * 100, 1)}%) · Shields {fmt(activeTargetAssumptions.shields, 0)} ({fmt(activeTargetAssumptions.shieldShare * 100, 1)}%) · Overguard {fmt(activeTargetAssumptions.overguard, 0)} ({fmt(activeTargetAssumptions.overguardShare * 100, 1)}%) · Armor {fmt(activeTargetAssumptions.armor, 0)} · Total {fmt(activeTargetAssumptions.effectiveHealth, 0)}</div>
                                                                <div className="sm:col-span-2"><span className="text-slate-500">Status immunities:</span> {activeTargetAssumptions.statusImmuneTypes.map((type) => `${type[0].toUpperCase()}${type.slice(1)}`).join(", ") || "None"} · Stack caps {Object.entries(activeTargetAssumptions.statusStackCaps).map(([type, cap]) => `${type} ${cap}`).join(", ") || "standard"} · Toxin shield bypass {activeTargetAssumptions.toxinBypassesShields ? "enabled" : "disabled"} · {activeTargetAssumptions.grouped ? "grouped target estimate" : "single target estimate"}{activeTargetAssumptions.crowdControlImmune ? " · CC immune" : ""}</div>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500">The selected-state one-hit estimate uses minimum attack-ramp damage when the selected weapon has a ramp. The direct-hit sequence starts cold and advances its ramp per attack; for selected heavy attacks it also applies combo consumption, supported Heavy Attack Efficiency, and 40 points/s Initial Combo recovery. It does not model attack-generated combo, Tennokai, stance sequences, or heavy-attack wind-up. The finite encounter keeps the starting combo tier, starts with no weapon-generated status stacks, and advances supported timed damage stacks such as Overwhelming Attrition as qualifying attack groups occur. It processes expected attacks and scheduled DoT ticks in event order, updating Heat/Corrosive armor strip, Viral/Magnetic/Cold/Puncture/Tau state and proc eligibility as target pools deplete. Condition Overload uses weapon statuses active before each hit plus the user-entered external-status count. Fractional proc applications remain mean-field estimates; the selected 0.1 s enemy Shield Gate applies to direct hits while status ticks ignore it, and shield regeneration, attenuation, projectile travel, neighbor status histories, chain geometry, Gas radius growth, and melee stance hit timing remain unsupported.</p>
                                                        </div>
                                                        {displayedReasoning ? (
                                                            <>
                                                                <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 px-3 py-2.5 space-y-1">
                                                                    <div className="text-[10px] uppercase tracking-wide text-sky-300">Why this build won in the selected model</div>
                                                                    <p className="text-[11px] text-slate-300">{displayedReasoning.summary}</p>
                                                                    <p className="text-[10px] text-slate-400">{displayedReasoning.winningEdge}</p>
                                                                    <p className="text-[10px] text-slate-500">{displayedReasoning.comparisonNote}</p>
                                                                </div>
                                                                {displayedReasoning.buildHighlights.length > 0 && (
                                                                    <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-3 py-2.5">
                                                                        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Calculated build details</div>
                                                                        <ul className="space-y-1 text-[10px] text-slate-300">
                                                                            {displayedReasoning.buildHighlights.map((highlight, index) => (
                                                                                <li key={index}>{highlight}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {displayedReasoning.arcaneStep && (
                                                                    <div className="rounded-lg bg-violet-950/20 border border-violet-900/40 px-3 py-2">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-xs font-semibold text-violet-200">Arcane · {displayedReasoning.arcaneStep.name}</span>
                                                                            <span className={`text-[10px] font-mono shrink-0 ${displayedReasoning.arcaneStep.delta >= 0 ? "text-green-400" : "text-rose-400"}`}>
                                                                                {displayedReasoning.arcaneStep.delta >= 0 ? "+" : ""}{displayedReasoning.arcaneStep.pctGain.toFixed(1)}%
                                                                            </span>
                                                                        </div>
                                                                        <p className="mt-1 text-[10px] text-slate-500">{displayedReasoning.arcaneStep.why} This is a separate leave-one-out score change; it overlaps with mod synergies.</p>
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1.5">
                                                                    {displayedReasoning.steps.map((step, i) => (
                                                                        <div key={i} className="rounded-lg bg-slate-900/50 border border-slate-800/50 px-3 py-2">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className="text-xs font-semibold text-slate-200">{step.modName}</span>
                                                                                <span className={`text-[10px] font-mono shrink-0 ${step.delta >= 0 ? "text-green-400" : "text-rose-400"}`}>
                                                                                    {step.delta >= 0 ? "+" : ""}{step.pctGain.toFixed(1)}%
                                                                                </span>
                                                                            </div>
                                                                            <p className="mt-1 text-[10px] text-slate-500">{step.why}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        ) : reasoning ? (
                                                            <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-3 text-[11px] text-amber-200/80">
                                                                Planner assumptions changed since this build was optimized. Run the optimizer again to refresh its score and explanation.
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-3 py-3 text-[11px] text-slate-500">
                                                                Run the optimizer to generate or refresh build reasoning for the current settings.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mod Configuration</div>
                                                <div className="text-sm text-slate-300">
                                                    {supportsStanceLikeMods(weapon)
                                                        ? "8 standard slots, plus stance/exilus/arcane support."
                                                        : "8 standard slots, plus exilus/arcane support where the weapon type allows it."}
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-slate-500">{slots.filter(Boolean).length}/{SLOT_COUNT} slots filled</div>
                                        </div>

                                        <div className="space-y-3">
                                            {supportsStanceLikeMods(weapon) ? (
                                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3">
                                                            <div className="hidden 2xl:block" />
                                                            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 2xl:col-start-2">
                                                                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                                                                    <span>Stance</span>
                                                                    <PolarityPicker value={stancePol} onChange={setStancePol} />
                                                                </div>
                                                                {stanceMods.length > 0 ? (
                                                                    <ModSlot headIsWeakPoint={targetHeadIsWeakPoint} selectedAttackName={activeCalcWeapon?.selectedAttackName} selectedAttackTrigger={activeCalcWeapon?.trigger} selectedAttackIsAreaDamage={activeCalcWeapon?.selectedAttackIsAreaDamage} targetFaction={factionOn ? faction : ""} targetHasOverguard={activeTargetAssumptions.overguard > 0} selectedAttackUsesSlamDamageBonus={activeCalcWeapon?.selectedAttackUsesSlamDamageBonus === true} selectedWeaponName={activeCalcWeapon?.name} selectedAttackHeadshotRate={activeTargetAssumptions.headshotHitRate} deadlyManeuversShotsRemaining={deadlyManeuversShotsRemaining} criticalPrecisionHeadshotProjectiles={criticalPrecisionHeadshotProjectiles} unseenDreadInvisibilityActive={unseenDreadInvisibilityActive} selectedGoal={goal} key={`${weapon.uniqueName}:stance`} index={0} label="Stance" mod={stanceMod} rank={stanceRank}
                                                                        slotPolarity={stancePol} compatMods={stanceMods}
                                                                        usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                        excluded={excluded}
                                                                        locked={!!fixedStanceMod}
                                                                        onChange={(_, m) => { setStanceMod(m); setStanceRank(m ? m.fusionLimit : 0); }}
                                                                        onRankChange={(_, r) => setStanceRank(r)}
                                                                        onPolarityChange={(_, p) => setStancePol(p)}
                                                                        onToggleExclude={toggleExclude}
                                                                        effDrain={stanceMod ? effectiveDrain(stanceMod, stancePol, stanceRank) : 0}
                                                                        compactEmpty={true} />
                                                                ) : (
                                                                    <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-[11px] text-slate-600">
                                                                        No stance slot available.
                                                                    </div>
                                                                )}
                                                                {fixedStanceMod && (
                                                                    <div className="mt-2 text-[10px] text-slate-500">
                                                                        This exalted weapon uses a permanent built-in stance.
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 2xl:col-start-3">
                                                                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                                                                    <span>Exilus</span>
                                                                    <button onClick={() => { setHasExilus(v => !v); if (hasExilus) { setExilusMod(null); setExilusRank(0); } }}
                                                                        className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] text-slate-300">
                                                                        {hasExilus ? "Installed" : "Unlock"}
                                                                    </button>
                                                                </div>
                                                                {hasExilus ? (
                                                                    <ModSlot headIsWeakPoint={targetHeadIsWeakPoint} selectedAttackName={activeCalcWeapon?.selectedAttackName} selectedAttackTrigger={activeCalcWeapon?.trigger} selectedAttackIsAreaDamage={activeCalcWeapon?.selectedAttackIsAreaDamage} targetFaction={factionOn ? faction : ""} targetHasOverguard={activeTargetAssumptions.overguard > 0} selectedAttackUsesSlamDamageBonus={activeCalcWeapon?.selectedAttackUsesSlamDamageBonus === true} selectedWeaponName={activeCalcWeapon?.name} selectedAttackHeadshotRate={activeTargetAssumptions.headshotHitRate} deadlyManeuversShotsRemaining={deadlyManeuversShotsRemaining} criticalPrecisionHeadshotProjectiles={criticalPrecisionHeadshotProjectiles} unseenDreadInvisibilityActive={unseenDreadInvisibilityActive} selectedGoal={goal} key={`${weapon.uniqueName}:exilus`} index={0} label="Exilus" mod={exilusMod} rank={exilusRank}
                                                                        slotPolarity={exilusPol} compatMods={compatMods}
                                                                        usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                        isExilusSlot={true}
                                                                        excluded={excluded}
                                                                        onChange={handleExilusChange}
                                                                        onRankChange={(_, r) => setExilusRank(r)}
                                                                        onPolarityChange={(_, p) => setExilusPol(p)}
                                                                        onToggleExclude={toggleExclude}
                                                                    effDrain={exilusMod ? effectiveDrain(exilusMod, exilusPol, exilusRank) : 0}
                                                                    compactEmpty={true}
                                                                    draggable={!!exilusMod}
                                                                    isDragOver={dragOverSlot?.kind === "exilus"}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "exilus", index: 0 })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "exilus", index: 0 }) ? { kind: "exilus", index: 0 } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "exilus", index: 0 })} />
                                                                ) : (
                                                                    <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-[11px] text-slate-600">
                                                                        Requires an Exilus Adapter.
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="hidden 2xl:block" />
                                                        </div>
                                                        <div className="grid auto-rows-[minmax(216px,auto)] grid-cols-2 2xl:grid-cols-4 gap-3">
                                                            {slots.map((mod, i) => (
                                                                <ModSlot headIsWeakPoint={targetHeadIsWeakPoint} selectedAttackName={activeCalcWeapon?.selectedAttackName} selectedAttackTrigger={activeCalcWeapon?.trigger} selectedAttackIsAreaDamage={activeCalcWeapon?.selectedAttackIsAreaDamage} targetFaction={factionOn ? faction : ""} targetHasOverguard={activeTargetAssumptions.overguard > 0} selectedAttackUsesSlamDamageBonus={activeCalcWeapon?.selectedAttackUsesSlamDamageBonus === true} selectedWeaponName={activeCalcWeapon?.name} selectedAttackHeadshotRate={activeTargetAssumptions.headshotHitRate} deadlyManeuversShotsRemaining={deadlyManeuversShotsRemaining} criticalPrecisionHeadshotProjectiles={criticalPrecisionHeadshotProjectiles} unseenDreadInvisibilityActive={unseenDreadInvisibilityActive} selectedGoal={goal} key={`${weapon.uniqueName}:main:${i}`} index={i} mod={mod} rank={ranks[i] ?? 0}
                                                                    slotPolarity={slotPols[i] ?? ""} compatMods={compatMods}
                                                                    usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                    excluded={excluded}
                                                                    onChange={handleSlotChange} onRankChange={handleRankChange}
                                                                    onPolarityChange={handlePolChange}
                                                                    onToggleExclude={toggleExclude}
                                                                    effDrain={mod ? effectiveDrain(mod, slotPols[i] ?? "", ranks[i]) : 0}
                                                                    draggable={!!mod}
                                                                    isDragOver={dragOverSlot?.kind === "main" && dragOverSlot.index === i}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "main", index: i })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "main", index: i }) ? { kind: "main", index: i } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "main", index: i })} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 self-start">
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Arcane</div>
                                                            {arcane1 && (
                                                                <button
                                                                    onClick={() => setIncludeArcaneStats(v => !v)}
                                                                    className={[
                                                                        "rounded-full border px-2 py-0.5 text-[9px] transition-colors",
                                                                        includeArcaneStats
                                                                            ? "border-violet-700/60 bg-violet-950/30 text-violet-300"
                                                                            : "border-slate-700 text-slate-500",
                                                                    ].join(" ")}
                                                                >
                                                                    {includeArcaneStats ? "Stats On" : "Stats Off"}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <ArcaneSlot headIsWeakPoint={targetHeadIsWeakPoint} label="Arcane Enhancement" arcane={arcane1} rank={arcane1Rank}
                                                            onChange={setArcane1} onRankChange={setArcane1Rank}
                                                            availableArcanes={weaponArcanes} />
                                                        {weaponArcanes.some((arcane) => !!arcane.armorScaledWeaponDamage) && (
                                                            <div className="mt-2 space-y-1.5 rounded-lg border border-violet-900/50 bg-violet-950/15 p-2">
                                                                <label htmlFor="warframe-armor-input" className="block text-[10px] font-semibold text-slate-300">Warframe Armor · Primary Bulwark</label>
                                                                <input
                                                                    id="warframe-armor-input"
                                                                    aria-label="Warframe Armor for Primary Bulwark"
                                                                    type="number"
                                                                    min={0}
                                                                    max={10000}
                                                                    step={1}
                                                                    value={warframeArmorInput}
                                                                    onChange={(event) => setWarframeArmorInput(event.target.value)}
                                                                    placeholder="Enter armor to model Bulwark"
                                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                                                                />
                                                                <p className="text-[9px] leading-relaxed text-slate-500">Damage scales from armor above 1,000 and caps at 1,500. The value is saved with this planner build.</p>
                                                                {(arcane1?.armorScaledWeaponDamage || optArcane) && warframeArmor === undefined && (
                                                                    <p role="status" className="text-[9px] leading-relaxed text-amber-300">Primary Bulwark is not calculated or considered by Auto Optimize until Warframe Armor is entered.</p>
                                                                )}
                                                                {arcane1?.armorScaledWeaponDamage && warframeArmor !== undefined && (
                                                                    <p className="text-[9px] text-violet-300">Selected rank bonus: +{(((getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor)?.damageBonus ?? 0) * 100).toFixed(1))}% base weapon damage.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                        {warframeEnergyArcanePanel}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                                                    <div className="space-y-3">
                                                        <div className="grid auto-rows-[minmax(216px,auto)] grid-cols-2 2xl:grid-cols-4 gap-3">
                                                            {slots.map((mod, i) => (
                                                                <ModSlot headIsWeakPoint={targetHeadIsWeakPoint} selectedAttackName={activeCalcWeapon?.selectedAttackName} selectedAttackTrigger={activeCalcWeapon?.trigger} selectedAttackIsAreaDamage={activeCalcWeapon?.selectedAttackIsAreaDamage} targetFaction={factionOn ? faction : ""} targetHasOverguard={activeTargetAssumptions.overguard > 0} selectedAttackUsesSlamDamageBonus={activeCalcWeapon?.selectedAttackUsesSlamDamageBonus === true} selectedWeaponName={activeCalcWeapon?.name} selectedAttackHeadshotRate={activeTargetAssumptions.headshotHitRate} deadlyManeuversShotsRemaining={deadlyManeuversShotsRemaining} criticalPrecisionHeadshotProjectiles={criticalPrecisionHeadshotProjectiles} unseenDreadInvisibilityActive={unseenDreadInvisibilityActive} selectedGoal={goal} key={`${weapon.uniqueName}:main:${i}`} index={i} mod={mod} rank={ranks[i] ?? 0}
                                                                    slotPolarity={slotPols[i] ?? ""} compatMods={compatMods}
                                                                    usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                    excluded={excluded}
                                                                    onChange={handleSlotChange} onRankChange={handleRankChange}
                                                                    onPolarityChange={handlePolChange}
                                                                    onToggleExclude={toggleExclude}
                                                                    effDrain={mod ? effectiveDrain(mod, slotPols[i] ?? "", ranks[i]) : 0}
                                                                    draggable={!!mod}
                                                                    isDragOver={dragOverSlot?.kind === "main" && dragOverSlot.index === i}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "main", index: i })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "main", index: i }) ? { kind: "main", index: i } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "main", index: i })} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex min-h-[435px] flex-col justify-center gap-3">
                                                        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <div className="text-[10px] uppercase tracking-wide text-slate-500">Arcane</div>
                                                                {arcane1 && (
                                                                    <button
                                                                        onClick={() => setIncludeArcaneStats(v => !v)}
                                                                        className={[
                                                                            "rounded-full border px-2 py-0.5 text-[9px] transition-colors",
                                                                            includeArcaneStats
                                                                                ? "border-violet-700/60 bg-violet-950/30 text-violet-300"
                                                                                : "border-slate-700 text-slate-500",
                                                                        ].join(" ")}
                                                                    >
                                                                        {includeArcaneStats ? "Stats On" : "Stats Off"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <ArcaneSlot headIsWeakPoint={targetHeadIsWeakPoint} label="Arcane Enhancement" arcane={arcane1} rank={arcane1Rank}
                                                                onChange={setArcane1} onRankChange={setArcane1Rank}
                                                                availableArcanes={weaponArcanes} />
                                                            {weaponArcanes.some((arcane) => !!arcane.armorScaledWeaponDamage) && (
                                                                <div className="mt-2 space-y-1.5 rounded-lg border border-violet-900/50 bg-violet-950/15 p-2">
                                                                    <label htmlFor="warframe-armor-input" className="block text-[10px] font-semibold text-slate-300">Warframe Armor · Primary Bulwark</label>
                                                                    <input
                                                                        id="warframe-armor-input"
                                                                        aria-label="Warframe Armor for Primary Bulwark"
                                                                        type="number"
                                                                        min={0}
                                                                        max={10000}
                                                                        step={1}
                                                                        value={warframeArmorInput}
                                                                        onChange={(event) => setWarframeArmorInput(event.target.value)}
                                                                        placeholder="Enter armor to model Bulwark"
                                                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                                                                    />
                                                                    <p className="text-[9px] leading-relaxed text-slate-500">Damage scales from armor above 1,000 and caps at 1,500. The value is saved with this planner build.</p>
                                                                    {(arcane1?.armorScaledWeaponDamage || optArcane) && warframeArmor === undefined && (
                                                                        <p role="status" className="text-[9px] leading-relaxed text-amber-300">Primary Bulwark is not calculated or considered by Auto Optimize until Warframe Armor is entered.</p>
                                                                    )}
                                                                    {arcane1?.armorScaledWeaponDamage && warframeArmor !== undefined && (
                                                                        <p className="text-[9px] text-violet-300">Selected rank bonus: +{(((getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor)?.damageBonus ?? 0) * 100).toFixed(1))}% base weapon damage.</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {warframeEnergyArcanePanel}
                                                        </div>
                                                        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
                                                            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                                                                <span>Exilus</span>
                                                                <button onClick={() => { setHasExilus(v => !v); if (hasExilus) { setExilusMod(null); setExilusRank(0); } }}
                                                                    className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] text-slate-300">
                                                                    {hasExilus ? "Installed" : "Unlock"}
                                                                </button>
                                                            </div>
                                                            {hasExilus ? (
                                                                <ModSlot headIsWeakPoint={targetHeadIsWeakPoint} selectedAttackName={activeCalcWeapon?.selectedAttackName} selectedAttackTrigger={activeCalcWeapon?.trigger} selectedAttackIsAreaDamage={activeCalcWeapon?.selectedAttackIsAreaDamage} targetFaction={factionOn ? faction : ""} targetHasOverguard={activeTargetAssumptions.overguard > 0} selectedAttackUsesSlamDamageBonus={activeCalcWeapon?.selectedAttackUsesSlamDamageBonus === true} selectedWeaponName={activeCalcWeapon?.name} selectedAttackHeadshotRate={activeTargetAssumptions.headshotHitRate} deadlyManeuversShotsRemaining={deadlyManeuversShotsRemaining} criticalPrecisionHeadshotProjectiles={criticalPrecisionHeadshotProjectiles} unseenDreadInvisibilityActive={unseenDreadInvisibilityActive} selectedGoal={goal} key={`${weapon.uniqueName}:exilus`} index={0} label="Exilus" mod={exilusMod} rank={exilusRank}
                                                                    slotPolarity={exilusPol} compatMods={compatMods}
                                                                    usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                    isExilusSlot={true}
                                                                    excluded={excluded}
                                                                    onChange={handleExilusChange}
                                                                    onRankChange={(_, r) => setExilusRank(r)}
                                                                    onPolarityChange={(_, p) => setExilusPol(p)}
                                                                    onToggleExclude={toggleExclude}
                                                                    effDrain={exilusMod ? effectiveDrain(exilusMod, exilusPol, exilusRank) : 0}
                                                                    compactEmpty={true}
                                                                    draggable={!!exilusMod}
                                                                    isDragOver={dragOverSlot?.kind === "exilus"}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "exilus", index: 0 })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "exilus", index: 0 }) ? { kind: "exilus", index: 0 } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "exilus", index: 0 })} />
                                                            ) : (
                                                                <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-[11px] text-slate-600">
                                                                    Requires an Exilus Adapter.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="text-[10px] text-slate-500">
                                                Rivens are configured by selecting a Riven from any standard mod slot.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ) : (
                                    <div className="p-6 text-center text-slate-500 text-sm">
                                        Choose a weapon from the Arsenal header to start building.
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                                    <div className="text-sm font-semibold mb-3">Advanced Analysis</div>
                                    {(() => {
                                if (!weapon) return null;

                                // Build the full mod effects list (slots + exilus + arcane)
                                const buildEffects = allSlotsForCap.map((mod, i) => {
                                    if (!mod) return null;
                                    const r = allRanksForCap[i] ?? mod.fusionLimit;
                                    return mod.effectsByRank[r] ?? mod.effect;
                                });
                                const buildEffectSourceLabels = allSlotsForCap.map((mod, i) => {
                                    if (!mod) return `slot ${i + 1}`;
                                    if (i < SLOT_COUNT) return `${getBuilderDisplayModName(mod)} (slot ${i + 1})`;
                                    return `${getBuilderDisplayModName(mod)} (exilus)`;
                                });
                                if (includeArcaneStats && arcane1) {
                                    const ae = getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, true, arcaneEnergyContext);
                                    if (ae) buildEffects.push({
                                        ...emptyEffect(),
                                        ...ae,
                                        conditionalEffects: [...(ae.conditionalEffects ?? [])],
                                    });
                                    buildEffectSourceLabels.push(`${arcane1.name} (arcane)`);
                                }

                                // Helper: compute metrics for any attack (or base weapon)
                                const calcForAttack = (atkIdx: number) => {
                                    const attackWeapon = makeSelectedAttackWeapon(weapon, atkIdx);
                                    const options = {
                                        conditionalState,
                                        isEximusTarget: targetProfileOverride?.isEximusTarget,
                                        targetHasOverguard: getTargetProfileAssumptions(factionOn ? faction : "", targetProfileOverride).overguard > 0,
                                        statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
                                        statusStackCaps: targetProfileOverride?.statusStackCaps,
                                        hitLocation: getTargetHitLocationProfile(factionOn ? faction : "", targetProfileOverride),
                                    };
                                    const burst = calculateBuild(attackWeapon, buildEffects, factionOn ? faction : "", options);
                                    const finite = hasBurstOnlyConditionalAssumption(conditionalState)
                                        ? calculateBuild(attackWeapon, buildEffects, factionOn ? faction : "", {
                                            ...options,
                                            conditionalState: withoutBurstOnlyConditionalAssumptions(conditionalState) ?? conditionalState,
                                        })
                                        : burst;
                                    return { attackWeapon, burst, finite };
                                };
                                // Damage type rows for a given damage object
                                const dmgRows = (d: Record<string, number>) => [
                                    { k: "impact",      l: "Impact",   v: d.impact },
                                    { k: "puncture",    l: "Punct",    v: d.puncture },
                                    { k: "slash",       l: "Slash",    v: d.slash },
                                    { k: "heat",        l: "Heat",     v: d.heat },
                                    { k: "cold",        l: "Cold",     v: d.cold },
                                    { k: "electricity", l: "Elec",     v: d.electricity },
                                    { k: "toxin",       l: "Toxin",    v: d.toxin },
                                    { k: "blast",       l: "Blast",    v: d.blast },
                                    { k: "radiation",   l: "Rad",      v: d.radiation },
                                    { k: "gas",         l: "Gas",      v: d.gas },
                                    { k: "magnetic",    l: "Mag",      v: d.magnetic },
                                    { k: "viral",       l: "Viral",    v: d.viral },
                                    { k: "corrosive",   l: "Corr",     v: d.corrosive },
                                    { k: "void",        l: "Void",     v: d.void },
                                    { k: "tau",         l: "Tau",      v: d.tau },
                                    { k: "true",        l: "True",     v: d.true },
                                ].filter(e => e.v > 0);

                                // Render stats for a single attack
                                const renderAttackStats = (atkIdx: number, label?: string) => {
                                    const { attackWeapon, burst: result, finite: finiteResult } = calcForAttack(atkIdx);
                                    const stats  = result.modded;
                                    const finiteStats = finiteResult.modded;
                                    const atk    = weapon.attacks[atkIdx];
                                    const attackSentientIncisionUnsupportedTarget = Boolean(
                                        activeSentientIncisionSelected && attackWeapon.selectedAttackUsesSlamDamageBonus !== true &&
                                        !getSentientIncisionDamageType(factionOn ? faction : "", activeTargetAssumptions.overguard > 0),
                                    );
                                    const attackSentientIncisionOverguardTimelineLimit = Boolean(
                                        activeSentientIncisionSelected && attackWeapon.selectedAttackUsesSlamDamageBonus !== true &&
                                        activeTargetAssumptions.overguard > 0,
                                    );
                                    const attackDpsUnavailable = activeNonSentientAttackDpsUnavailable || attackSentientIncisionUnsupportedTarget;
                                    const attackSustainedDpsUnavailable = activeNonSentientSustainedDpsUnavailable ||
                                        attackSentientIncisionUnsupportedTarget || attackSentientIncisionOverguardTimelineLimit;
                                    const damageUnit = actionUnitLabel(weapon.category);
                                    const damageUnitLabel = damageUnit[0].toUpperCase() + damageUnit.slice(1);
                                    const avgDamageLabel = averageDamageLabel(weapon.category);
                                    const rateLabel = actionRateLabel(weapon.category);
                                    const dmgSrc = stats.rawDamageBreakdown;
                                    const procChanceRows = dmgRows(stats.procChanceByType as Record<string, number>);
                                    const procRateRows = dmgRows(stats.procRatePerSecondByType as Record<string, number>);
                                    const stackRows = dmgRows(stats.expectedStacksByType as Record<string, number>);
                                    const dotShotRows = dmgRows(finiteStats.dotDamagePerShotByType as Record<string, number>);
                                    const dotDpsRows = dmgRows(finiteStats.dotDpsByType as Record<string, number>);
                                    const extraProcRows = dmgRows(stats.extraProcsPerShot as Record<string, number>);
                                    const forcedProcRows = dmgRows(stats.forcedProcsPerShot as Record<string, number>);
                                    const forcedProcCounts = new Map(forcedProcRows.map((row) => [row.k, row.v]));
                                    const bonusProcRows = extraProcRows
                                        .map((row) => ({ ...row, v: Math.max(0, row.v - (forcedProcCounts.get(row.k) ?? 0)) }))
                                        .filter((row) => row.v > 0);
                                    const allMetricBadges = [
                                        { label: "Direct Damage", value: fmt(stats.totalDamage), sub: "post-quantization", tooltip: "Final direct damage after damage construction and Warframe's damage quantization step, before crit and multishot." },
                                        { label: "Arsenal Total", value: fmt(stats.arsenalDamage), sub: `per ${damageUnit}, no crit`, tooltip: `Unquantized Arsenal Total Damage after multishot for one ${damageUnit}, before crit weighting. Target modifiers and mission rounding are not included.` },
                                        { label: avgDamageLabel, value: fmt(stats.averageShotDamage), sub: "crit-weighted", tooltip: `Expected damage per ${damageUnit} after weighting in crit chance and crit multiplier.` },
                                        ...(stats.firstShotMagazineDamageBonus > 0
                                            ? [{ label: "First shot", value: fmt(stats.averageShotDamage * stats.firstShotMagazineDamageMultiplier), sub: "after reload", tooltip: `Expected direct damage for the first ammo-consuming shot in a fresh magazine, including first-shot Chamber mods and crit weighting. Later shots use the ordinary per-${damageUnit} damage above.` }]
                                            : []),
                                        ...(stats.lastShotMagazineRequestedDamageBonus > 0
                                            ? [{
                                                label: "Final shot",
                                                value: stats.lastShotMagazineInactiveReason
                                                    ? "Inactive"
                                                    : fmt(stats.averageShotDamage * stats.lastShotMagazineDamageMultiplier),
                                                sub: stats.lastShotMagazineInactiveReason
                                                    ? "Synth Charge requirement"
                                                    : "one hit in a fresh magazine",
                                                tooltip: stats.lastShotMagazineInactiveReason
                                                    ? `Synth Charge is inactive because ${describeLastShotMagazineInactiveReason(stats.lastShotMagazineInactiveReason)}.`
                                                    : `Synth Charge adds its bonus to one hit on the final ammo-consuming attack. This value spreads that hit's bonus across the expected projectiles for the attack.`,
                                            }]
                                            : []),
                                        { label: "Burst DPS", value: fmt(result.burstDPS), sub: "fresh magazine", tooltip: `Damage per second while attacking through a fresh magazine without reload downtime. Verified attack ramps are averaged across that magazine.${stats.strainInfectionCritDamageBonus > 0 ? ` Strain Infection assumes ${stats.strainInfectionCystsAtImpact}/8 active cysts at impact and keeps that count static within this Burst calculation; cyst timing and average uptime are not modeled.` : ""}${stats.dreadfulKillshotBonus > 0 ? ` Dreadful Killshot assumes ${fmt(stats.dreadfulKillshotCurrentHealth)} current Warframe Health, held static for this Burst calculation.` : ""}` },
                                        { label: "Sustained DPS", value: fmt(finiteResult.sustainedDPS), sub: stats.infiniteAmmoActive ? "Gale Force maintained" : "with reload", tooltip: `${stats.infiniteAmmoActive ? "Damage per second assumes Gale Force stays active, so no reload downtime or recurring first-shot Chamber bonus is applied." : "Damage per second including reload downtime and the stable attack-ramp level across repeated magazines when applicable."}${stats.strainInfectionCritDamageBonus > 0 ? " Strain Infection cysts are excluded because their timing and uptime are not modeled." : ""}${stats.dreadfulKillshotBonus > 0 ? " Dreadful Killshot's current-Health snapshot is excluded from sustained scoring." : ""}` },
                                        { label: `DoT / ${damageUnitLabel}`, value: fmt(finiteStats.dotDamagePerShot), sub: "full-life estimate", tooltip: `Expected status damage-over-time contributed by one ${damageUnit} if the target survives for every proc's full duration. This is not damage delivered before a target dies.` },
                                        { label: "DoT DPS", value: fmt(finiteStats.dotDps), sub: "steady-state estimate", tooltip: "Estimated DoT damage per second against a target that survives long enough for status stacks to reach steady state. Ramp-enabled attacks assume fully warmed damage for this long-run estimate; the expected encounter scales each proc seed by its attack-time ramp." },
                                        ...(stats.nightwatchNapalm ? [
                                            { label: "Napalm direct DPS", value: fmt(stats.nightwatchNapalm.directDamagePerSecond), sub: "six full blaze ticks", tooltip: "Pre-defense direct Heat tick DPS from six 150-base-damage ticks per projectile. Scales with base damage and Kuva Ogris valence, never crits, and assumes this target remains inside the blaze for all ticks." },
                                            { label: "Napalm Heat DoT DPS", value: fmt(stats.nightwatchNapalm.heatStatusDamagePerSecond), sub: "steady-state estimate", tooltip: "Steady-state Heat status damage from the fixed 68% proc chance on each Napalm tick, using the Napalm Heat proc's three-second duration and the current Heat, Status Damage, and faction modifiers. It excludes unrelated on-tick extra-hit effects." },
                                        ] : []),
                                        {
                                            label: "Crit Chance",
                                            value: fmt(stats.critChance * 100, 1) + "%",
                                            highlight: stats.critChance >= 1,
                                            sub: stats.critChance > 1 ? (stats.critChance >= 2 ? "orange guaranteed" : "yellow guaranteed") : undefined,
                                            tooltip:
                                                stats.critChance >= 2
                                                    ? `Guaranteed orange crits. ${fmt((stats.critChance - Math.floor(stats.critChance)) * 100, 0)}% chance for red crit per ${damageUnit}.`
                                                    : stats.critChance >= 1
                                                        ? `Guaranteed yellow crits. ${fmt((stats.critChance - 1) * 100, 0)}% chance for orange crit per ${damageUnit}.`
                                                        : undefined,
                                        },
                                        { label: "Crit Multiplier", value: stats.critMultiplier.toFixed(2) + "x", sub: "yellow crit", tooltip: "Damage multiplier applied when a standard yellow crit occurs." },
                                        { label: "Avg Crit Tier", value: stats.averageCritTier.toFixed(2) + "x", sub: "expected crit level", tooltip: `Expected crit level per hit; combo-scaled bonuses such as Gladiator are included in Critical Chance, and Vigilante adds ${fmt(stats.vigilanteCritTierEnhancementChance * 100, 1)}% chance to add one tier to a landed Primary crit. 0.55x means 0.55 expected tiers per hit.` },
                                        {
                                            label: "Status Chance",
                                            value: fmt(stats.statusChance * 100, 1) + "%",
                                            tooltip: `Chance per pellet/projectile to trigger a status effect. Over 100% = multiple procs per ${damageUnit}.`,
                                        },
                                        {
                                            label: stats.pelletHitEstimate ? "Expected pellet hits" : "Multishot",
                                            value: stats.pelletHitEstimate ? stats.multishot.toFixed(2) : stats.multishot.toFixed(2) + "x",
                                            tooltip: stats.pelletHitEstimate
                                                ? `Experimental centered-target estimate: ${fmt(stats.pelletHitEstimate.nominalExpectedHits, 2)} expected hits from ${fmt(stats.pelletHitEstimate.pelletsFired, 2)} fired pellets at ${fmt(stats.pelletHitEstimate.attackDistanceMeters, 2)}m against a ${fmt(stats.pelletHitEstimate.targetRadiusMeters, 2)}m radius. Spread-endpoint range: ${fmt(stats.pelletHitEstimate.minimumExpectedHits, 2)}–${fmt(stats.pelletHitEstimate.maximumExpectedHits, 2)}. The value shown drives the manual single-target damage/status estimate.`
                                                : usesHitTerminology(weapon.category) ? "Additional hit instances created by the attack. Each hit rolls status independently." : "Projectiles per trigger pull. Each pellet rolls status independently.",
                                        },
                                        {
                                            label: rateLabel,
                                            value: stats.fireRate.toFixed(3) + "/s",
                                            tooltip: stats.chargeTimeSeconds !== null
                                                ? `Charge time = ${stats.ammoCostPerShot.toFixed(2)} ammo ÷ ${(weapon.selectedAttackChargeAmmoPerSecond ?? 0).toFixed(2)} ammo/s = ${stats.chargeTimeSeconds.toFixed(3)}s. Effective rate is capped by both this fixed charge time and the weapon's fire-rate cadence; fire-rate mods do not change the ammo charge rate. Finite encounters assume the attack starts uncharged, so its first event follows this charge.`
                                                : weapon.weaponType.trim().toLowerCase() === "bow"
                                                    ? `Bow repeating rate uses 1 ÷ (modded charge time + modded reload time); an uncharged shot uses zero charge time. Fire-rate mods speed the charge and reload-speed mods shorten the post-shot delay. Charged-shot Burst DPS excludes that post-shot reload. Finite encounters assume an uncharged start and delay the first event by ${stats.initialAttackDelaySeconds.toFixed(3)}s.`
                                                    : atk?.chargeTime != null
                                                    ? `Effective rate = 1 / (${atk.chargeTime.toFixed(2)}s charge + ${(1 / weapon.fireRate).toFixed(2)}s delay). ${weapon.selectedAttackChargeTimeAffectedByFireRate === false ? "Fire Rate mods do not change this charge time." : "Fire Rate mods also speed up charge time."} Finite encounters assume an uncharged start and delay the first event by ${stats.initialAttackDelaySeconds.toFixed(3)}s.`
                                                : usesHitTerminology(weapon.category) ? "Attacks per second." : "Shots per second.",
                                        },
                                        { label: "Magazine", value: displayMagazineValue(weapon, stats.magazineSize), tooltip: usesHitTerminology(weapon.category) ? "Melee weapons do not use magazines, so this stays at the weapon's effective default value." : "Rounds available before reloading." },
                                        ...(!usesHitTerminology(weapon.category) && !weapon.isExalted ? [{ label: "Ammo Efficiency", value: fmt(stats.ammoEfficiencyBonus * 100, 1) + "%", tooltip: "Ordinary additive ammo-efficiency bonuses, capped at 75%. Fractional ammo is accumulated between shots; transformed Incarnon attacks ignore ammo efficiency. Perigale's Gale Force is modeled separately as infinite ammo when assumed maintained." }] : []),
                                        ...(weapon.hasGaleForceAmmoPassive ? [{
                                            label: "Gale Force",
                                            value: stats.infiniteAmmoActive ? "Active" : "Inactive",
                                            sub: stats.infiniteAmmoActive ? "infinite ammo assumed" : "scenario assumption",
                                            tooltip: "Gale Force's headshot/kill trigger and 4-second refresh timing are not simulated. Fully stacked or Custom with at least one maintained stack assumes it stays active; then reloads and first-shot Chamber bonuses are disabled.",
                                        }] : []),
                                        {
                                            label: weapon.weaponType.trim().toLowerCase() === "bow" ? "Shots / Cycle" : "Shots / Mag",
                                            value: stats.infiniteAmmoActive && stats.ammoGateSatisfied ? "∞" : fmt(stats.shotsPerMag, 2),
                                            sub: stats.infiniteAmmoActive && stats.ammoGateSatisfied ? "while Gale Force is maintained" : weapon.weaponType.trim().toLowerCase() === "bow" ? "per arrow cycle" : "before reload",
                                            tooltip: weapon.weaponType.trim().toLowerCase() === "bow"
                                                ? "Bow attacks fire one arrow per charge/reload cycle. The repeating bow rate already includes this cycle, so it is not counted again as magazine downtime."
                                                : stats.infiniteAmmoActive && stats.ammoGateSatisfied
                                                    ? "Gale Force is assumed maintained, so ammo does not run out and no reload occurs."
                                                : weapon.selectedAttackAutoSpoolShotSequence
                                                    ? `Fully-spooled attack count at constant Wiki-listed ammo cost. The finite encounter starts from rest and estimates ${fmt(stats.finiteShotsPerMag, 0)} attacks as pellets and ammo cost spool up; its intermediate ammo costs use a documented model inference.`
                                                : weapon.selectedAttackAmmoGate
                                                    ? `This attack requires ${fmt(weapon.selectedAttackAmmoGate.minimumMagazineAmmoToFire, 0)} rounds loaded at trigger time. ${stats.ammoGateSatisfied ? `${fmt(stats.shotsPerMag, 0)} releases fit before the magazine drops below that threshold.` : "The current magazine is below the trigger threshold, so no release is available."} Ammo efficiency affects ammo spent per release; the Wiki does not say whether it also lowers this threshold.`
                                                : usesHitTerminology(weapon.category)
                                                    ? "Effective attack count before any reload-like interruption. For melee this is mostly a placeholder value."
                                                    : "Number of trigger pulls available before reloading.",
                                        },
                                        { label: "Reload", value: stats.infiniteAmmoActive ? "None" : stats.reloadTime.toFixed(2) + "s", tooltip: stats.infiniteAmmoActive ? "No reload occurs while Gale Force's infinite-ammo buff is assumed maintained." : usesHitTerminology(weapon.category) ? "Melee weapons do not reload, so this should normally remain at 0." : "Time needed to refill the magazine." },
                                        {
                                            label: `Avg Procs/${damageUnitLabel}`,
                                            value: fmt(stats.averageProcsPerShot, 2),
                                            tooltip: `Expected status applications per ${damageUnit}. Base ordinary rolls are Multishot × Status Chance; active Tau vulnerability increases other status effects, and forced/status-triggered applications are added separately.`,
                                        },
                                        ...(atk?.uniqueStatusProcs?.length ? [{
                                            label: "Unique Status",
                                            value: atk.uniqueStatusProcs.join(", "),
                                            sub: "Galvanized / CO count",
                                            tooltip: "This guaranteed non-damage status adds one unique type for Galvanized direct-damage and Condition Overload effects. The finite encounter applies it after the first hit; special enemy immunity exceptions are not modeled.",
                                        }] : []),
                                    ].map((item) => {
                                        const sustainedMetric = /Sustained DPS|DoT DPS/i.test(item.label);
                                        const unavailable = (attackDpsUnavailable && /DPS/i.test(item.label)) ||
                                            (attackSustainedDpsUnavailable && sustainedMetric);
                                        if (!unavailable) return item;
                                        const timelineLimited = attackSentientIncisionOverguardTimelineLimit && sustainedMetric;
                                        return {
                                            ...item,
                                            value: "Unavailable",
                                            sub: timelineLimited ? "adaptive element changes after Overguard breaks" : "reference-only attack",
                                            tooltip: timelineLimited
                                                ? "Burst uses the initial Corrosive snapshot. Sustained and DoT DPS are unavailable because Sentient Incision changes to the target faction element when Overguard breaks."
                                                : "This attack is reference-only with the current inputs; its displayed component values are not a scored DPS result.",
                                        };
                                    });
                                    const statusEffectBadges = [
                                        { label: "Viral Health", value: fmt(stats.viralHealthDamageBonus * 100, 0) + "%", sub: "health damage", tooltip: "Extra damage dealt to health from current Viral stacks." },
                                        { label: "Heat Armor Strip", value: fmt(stats.heatArmorStrip * 100, 0) + "%", sub: "armor removed", tooltip: "Armor removed by Heat status effects." },
                                        { label: "Corrosive Strip", value: fmt(stats.corrosiveArmorStrip * 100, 0) + "%", sub: "armor removed", tooltip: "Armor removed by Corrosive status stacks." },
                                        ...(stats.shatteringImpactBaseArmorPerHit > 0 ? [{ label: "Shattering Impact", value: `-${fmt(stats.shatteringImpactBaseArmorPerHit, 0)}`, sub: "base Armor / Impact hit", tooltip: "Permanently removes this much base Armor per melee hit with nonzero quantized Impact damage. It does not require an Impact status proc; level scaling applies, then percentage Heat/Corrosive strips." }] : []),
                                        { label: "Magnetic Shield", value: fmt(stats.magneticShieldDamageBonus * 100, 0) + "%", sub: "shield damage", tooltip: "Extra damage dealt to shields and overguard from Magnetic stacks." },
                                        { label: "Radiation Ally Dmg", value: fmt(stats.radiationAllyDamageBonus * 100, 0) + "%", sub: "friendly fire bonus", tooltip: "Potential ally damage bonus from accumulated Radiation stacks. Overguard suppresses this effect until the pool breaks." },
                                        { label: "Cold Slow", value: fmt(stats.coldSlow * 100, 0) + "%", sub: "move/attack slow", tooltip: "Movement and attack speed slow applied by Cold stacks." },
                                        { label: "Cold Crit Damage", value: fmt(stats.coldCritDamageBonus * 100, 0) + "%", sub: "crit damage bonus", tooltip: "Direct hits gain 10% critical damage on the first Cold stack and 5% per additional stack through nine; freezing at ten stacks raises the bonus to 100%. Area damage receives no bonus. The current weapon source does not classify every attack as area damage." },
                                        { label: "Puncture Dmg Down", value: fmt(stats.punctureEnemyDamageReduction * 100, 0) + "%", sub: "enemy damage reduction", tooltip: "How much enemy outgoing damage is reduced by Puncture stacks." },
                                        { label: "Puncture Crit", value: fmt(stats.punctureCritChanceBonus * 100, 0) + "%", sub: "crit chance bonus", tooltip: "Flat +5% critical chance per Puncture stack (up to +25%) for subsequent weapon hits. The bonus is omitted for attacks explicitly marked as area damage; the current weapon source does not classify every attack." },
                                        { label: "Impact Mercy", value: fmt(stats.impactMercyThresholdBonus * 100, 0) + "%", sub: "mercy threshold", tooltip: "Expected additional Mercy health-threshold bonus from Impact stacks (+8 percentage points each, up to +40%). Applies to heavy Mercy-eligible units only; target eligibility and Mercy outcomes are not modeled." },
                                        { label: `Blast / ${damageUnitLabel}`, value: fmt(stats.blastExpectedExpiryDamagePerShot), sub: "stack expiry damage", tooltip: `Expected damage from Blast stacks that expire naturally after one ${damageUnit}. Cap detonation is calculated in the finite encounter.` },
                                        { label: "Gas Radius", value: fmt(stats.gasCloudRadius, 2) + "m", sub: "cloud radius", tooltip: "Effective radius of the Gas cloud from current Gas stacks." },
                                        { label: "Tau Vulnerability", value: fmt(stats.tauStatusVulnerability * 100, 0) + "%", sub: "status vulnerability", tooltip: "+10% received Status Chance per Tau stack, up to +100%. The finite encounter carries expected Tau applications between sequential projectiles as a mean-field estimate; external Tau assumes one maintained stack. Tau and forced procs are not amplified." },
                                    ];
                                    const renderBadgeSection = (
                                        title: string,
                                        items: Array<{ label: string; value: string; sub?: string; tooltip?: string; highlight?: boolean; icon?: string }>,
                                        subtitle?: string,
                                    ) => {
                                        if (!items.length) return null;
                                        return (
                                            <div className="pt-2 border-t border-slate-800/50">
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
                                                    {title}
                                                    {subtitle ? <span className="normal-case font-normal text-slate-600 ml-1">{subtitle}</span> : null}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                                    {items.map((item) => (
                                                        <StatBadge
                                                            key={item.label}
                                                            label={item.label}
                                                            value={item.value}
                                                            sub={item.sub}
                                                            tooltip={item.tooltip}
                                                            highlight={item.highlight}
                                                            icon={item.icon}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <div key={atkIdx} className={weapon.attacks.length > 1 ? "border border-slate-800/60 rounded-xl p-3 space-y-3" : "space-y-3"}>
                                            {label && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-slate-300">{label}</span>
                                                {stats.chargeTimeSeconds !== null ? (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-700/40 bg-blue-950/30 text-blue-400">
                                                        {stats.chargeTimeSeconds.toFixed(2)}s charge
                                                    </span>
                                                ) : atk?.chargeTime != null && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-700/40 bg-blue-950/30 text-blue-400">
                                                            {atk.chargeTime.toFixed(1)}s charge
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {renderBadgeSection(attackDpsUnavailable ? "Reference Stats" : "All Stats", allMetricBadges)}

                                            {/* Damage type breakdown */}
                                            {(() => {
                                                const rows = dmgRows(dmgSrc);
                                                if (!rows.length) return null;
                                                const total = rows.reduce((s, r) => s + r.v, 0);
                                                return (
                                                    <div className="pt-2 border-t border-slate-800/50">
                                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
                                                            {attackDpsUnavailable ? "Reference Damage Types" : "Damage Types"}
                                                            <span className="normal-case font-normal text-slate-600 ml-1">(hover for status effect)</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {rows.map(e => (
                                                                <StatBadge key={e.k} label={e.l}
                                                                    value={fmt(e.v, 1)}
                                                                    sub={fmt((stats.procChanceByType[e.k as keyof typeof stats.procChanceByType] ?? (e.v / total)) * 100, 0) + "%"}
                                                                    tooltip={STATUS_TIPS[e.k]}
                                                                    icon={DAMAGE_TYPE_ICON[e.k]} />
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-slate-600 mt-1.5">
                                                            Proc distribution uses the modded damage mix. Hover each type to see its status effect.
                                                        </div>
                                                        {attackSentientIncisionOverguardTimelineLimit && (
                                                            <div role="note" className="text-[9px] leading-relaxed text-amber-300 mt-1.5">
                                                                This damage mix is the initial Overguard Corrosive snapshot. Sentient Incision changes to the target faction element after Overguard breaks.
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {renderBadgeSection(
                                                "Proc Chance By Type",
                                                procChanceRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v * 100, 1) + "%",
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection(
                                                attackSustainedDpsUnavailable ? "Reference Proc Rate By Type" : "Proc Rate By Type",
                                                procRateRows.map((row) => ({
                                                    label: row.l,
                                                    value: attackSustainedDpsUnavailable ? "Unavailable" : fmt(row.v, 2) + "/s",
                                                    sub: attackSustainedDpsUnavailable ? "not a sustained score" : undefined,
                                                    tooltip: attackSentientIncisionOverguardTimelineLimit
                                                        ? "The initial Overguard Corrosive snapshot does not model the later adaptive-element change, so per-type proc rates are unavailable."
                                                        : STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                                attackSustainedDpsUnavailable ? "(rate unavailable)" : undefined,
                                            )}

                                            {renderBadgeSection(
                                                attackSustainedDpsUnavailable ? "Reference Expected Stacks By Type" : "Expected Stacks By Type",
                                                stackRows.map((row) => ({
                                                    label: row.l,
                                                    value: attackSustainedDpsUnavailable ? "Unavailable" : fmt(row.v, 2),
                                                    sub: attackSustainedDpsUnavailable ? "not a sustained score" : undefined,
                                                    tooltip: attackSentientIncisionOverguardTimelineLimit
                                                        ? "Expected stacks require a timeline that updates Sentient Incision's damage type when Overguard breaks."
                                                        : STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                                attackSustainedDpsUnavailable ? "(timeline unavailable)" : undefined,
                                            )}

                                            {renderBadgeSection(
                                                attackSustainedDpsUnavailable ? "Reference DoT By Type" : "DoT By Type",
                                                dotDpsRows.map((row) => ({
                                                    label: row.l,
                                                    value: attackSustainedDpsUnavailable ? "Unavailable" : fmt(row.v),
                                                    sub: attackSustainedDpsUnavailable
                                                        ? `${fmt(dotShotRows.find((entry) => entry.k === row.k)?.v ?? 0)} reference / ${damageUnit}`
                                                        : `${fmt(dotShotRows.find((entry) => entry.k === row.k)?.v ?? 0)} / ${damageUnit}`,
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                                attackSustainedDpsUnavailable ? "(DPS unavailable)" : "(value = DPS)",
                                            )}

                                            {renderBadgeSection(
                                                "Forced Procs By Type",
                                                forcedProcRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v, 2),
                                                    sub: `forced per ${damageUnit}`,
                                                    tooltip: `Expected forced ${row.l} proc count per attack after multishot. Forced rolls do not use status chance; some weapon rules select outcomes by modded damage weights while others use a uniform distribution.`,
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection(
                                                "Additional Procs By Type",
                                                bonusProcRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v, 2),
                                                    sub: `additional per ${damageUnit}`,
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection(activeAttackDpsUnavailable ? "Reference Status Effects" : "Status Effects", statusEffectBadges)}

                                            {/* Crit tier warning */}
                                            {stats.critChance > 1 && (
                                                <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-400/80">
                                                    {stats.critChance >= 2
                                                        ? `${fmt(stats.critChance * 100, 1)}% crit — guaranteed orange crits (${fmt((stats.critChance - Math.floor(stats.critChance)) * 100, 0)}% red per ${damageUnit})`
                                                        : `${fmt(stats.critChance * 100, 1)}% crit — guaranteed yellow crits (${fmt((stats.critChance - 1) * 100, 0)}% orange per ${damageUnit})`}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-slate-600">
                                                Average crit tier: <span className="font-mono text-slate-300">{stats.averageCritTier.toFixed(2)}x</span>{" "}
                                                <span className="text-slate-500">expected crit level per {damageUnit}</span>
                                            </div>
                                        </div>
                                    );
                                };

                                const hasMultipleAttacks = weapon.attacks.length > 1;
                                const firstShotChamberMods = [...new Set(allSlotsForCap
                                    .filter((mod): mod is ModEntry => !!mod && [
                                        "Charged Chamber",
                                        "Primed Chamber",
                                        "Primed Charged Chamber",
                                    ].includes(mod.name))
                                    .map((mod) => mod.name))];

                                return (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="text-sm font-semibold flex items-center gap-2">
                                                {activeAttackDpsUnavailable ? "Reference Stats · Scoring unavailable" : "Calculated Stats"}
                                                {factionOn && <span className="text-xs font-normal text-orange-400">vs {faction}</span>}
                                                {includeArcaneStats && arcane1 && arcane1.baseBonus && (
                                                    <span className="text-xs font-normal text-violet-400">+ {arcane1.name} (perm)</span>
                                                )}
                                            </div>
                                            {hasMultipleAttacks && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Optimize for</span>
                                                    {weapon.attacks.map((atk, i) => (
                                                        <button key={i}
                                                            onClick={() => setSelectedAttackIdx(i)}
                                                            className={["rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                                                                selectedAttackIdx === i
                                                                    ? "bg-slate-100 text-slate-900 border-slate-100"
                                                                    : "border-slate-700 text-slate-400 hover:border-slate-500"].join(" ")}>
                                                            {atk.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {firstShotChamberMods.length > 0 && (
                                            <div role="note" className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300/90">
                                                {activeMetrics?.modded.infiniteAmmoActive
                                                    ? `${firstShotChamberMods.join(", ")} are excluded while Gale Force is assumed maintained: its infinite-ammo state prevents a magazine reload, so the first-shot bonus has already been spent.`
                                                    : `${firstShotChamberMods.join(", ")} apply to the first shot in each magazine; per-magazine DPS and first-shot / finite-encounter damage include the bonus.${weapon.hasGaleForceAmmoPassive ? " Gale Force trigger/refresh timing is not modeled; its maintained state is available in Fully stacked and Custom scenarios." : ""}`}
                                            </div>
                                        )}

                                        {renderAttackStats(
                                            hasMultipleAttacks ? selectedAttackIdx : 0,
                                            hasMultipleAttacks ? weapon.attacks[selectedAttackIdx]?.name : undefined,
                                        )}
                                    </div>
                                );
                            })()}
                                </div>
                            </div>

                            {activeIncarnonTier && (
                                <div className="wf-modal-backdrop wf-dialog-frame fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
                                    <div ref={incarnonDialogRef} className="wf-dialog relative max-h-full w-full max-w-5xl overflow-y-auto rounded-[2rem] border" role="dialog" aria-modal="true" aria-labelledby="incarnon-evolution-title" tabIndex={-1}>
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                                        <div className="px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-[0.35em] text-[color:var(--wf-accent-text)]">
                                                        Evolution {INCARNON_TIER_LABELS[activeIncarnonTier.tier]}
                                                    </div>
                                                    <h3 id="incarnon-evolution-title" className="mt-2 text-2xl font-semibold text-[color:var(--wf-text-strong)] sm:text-[2rem]">
                                                        {activeIncarnonTier.tier === 1 ? "Review Incarnon evolution" : "Choose an Incarnon perk"}
                                                    </h3>
                                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wf-text-muted)]">
                                                        {activeIncarnonTier.tier === 1
                                                            ? "Evolution I is the Incarnon-form baseline. Review what it changes, then enable or remove it for this build."
                                                            : "Pick the upgrade that should shape this build. The optimizer can branch across enabled tiers later if you turn path optimization on."}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIncarnonPickerTier(null)}
                                                    className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-accent-text)]"
                                                >
                                                    Close
                                                </button>
                                            </div>

                                            <div className={["mt-8 grid gap-4", activeIncarnonTier.options.length > 1 ? "lg:grid-cols-3" : ""].join(" ")}>
                                                {activeIncarnonTier.options.map((option, index) => {
                                                    const selected = buildCfg.incarnonSelectedOptionsByTier[activeIncarnonTier.tier] === option.id;
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            type="button"
                                                            onClick={() => setIncarnonTierSelection(activeIncarnonTier.tier, option.id)}
                                                            className={[
                                                                "group relative overflow-hidden rounded-[1.6rem] border p-5 text-left transition-all duration-200",
                                                                selected
                                                                    ? "border-cyan-300/70 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_36px_rgba(34,211,238,0.18),inset_0_0_24px_rgba(34,211,238,0.14)]"
                                                                    : "border-slate-800/90 bg-slate-950/55 hover:border-cyan-300/35 hover:bg-slate-900/80",
                                                            ].join(" ")}
                                                        >
                                                            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent opacity-80" />
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--wf-accent-text)]">Perk {index + 1}</div>
                                                                    <div className="mt-3 text-lg font-semibold text-[color:var(--wf-text-strong)]">{option.name}</div>
                                                                </div>
                                                                <span
                                                                    className={[
                                                                        "flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold transition-all",
                                                                        selected
                                                                            ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)] shadow-[0_0_0_1px_var(--wf-selection-border)]"
                                                                            : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] group-hover:border-[color:var(--wf-border-accent)] group-hover:text-[color:var(--wf-accent-text)]",
                                                                    ].join(" ")}
                                                                >
                                                                    {INCARNON_TIER_LABELS[activeIncarnonTier.tier]}
                                                                </span>
                                                            </div>
                                                            <div className="mt-5 space-y-2">
                                                                {option.descriptionLines.map((line, lineIndex) => (
                                                                    <div key={`${option.id}-line-${lineIndex}`} className="text-sm leading-6 text-slate-200/92">
                                                                        {line}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {option.notes.length > 0 && (
                                                                <div className="mt-5 border-t border-[color:var(--wf-border-subtle)] pt-4 text-xs leading-5 text-[color:var(--wf-text-muted)]">
                                                                    {option.notes.join(" ")}
                                                                </div>
                                                            )}
                                                            {option.model.unsupportedLines.length > 0 && (
                                                                <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-950/20 px-3 py-2.5 text-xs leading-5 text-amber-100">
                                                                    <div className="font-semibold">Not included in stats or optimizer scoring</div>
                                                                    <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-100/80">
                                                                        {option.model.unsupportedLines.map((line, lineIndex) => (
                                                                            <li key={`${option.id}-unsupported-${lineIndex}`}>{line}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-400/10 pt-5">
                                                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                                                    {buildCfg.incarnonSelectedOptionsByTier[activeIncarnonTier.tier]
                                                        ? "Current tier is active"
                                                        : "Tier is currently inactive"}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {buildCfg.incarnonSelectedOptionsByTier[activeIncarnonTier.tier] && (
                                                        <button
                                                            type="button"
                                                            onClick={() => clearIncarnonTierSelection(activeIncarnonTier.tier)}
                                                            className="rounded-full border border-rose-400/25 bg-rose-950/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-rose-200 transition-colors hover:border-rose-300/40 hover:text-rose-100"
                                                        >
                                                            Remove Evolution
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setIncarnonPickerTier(null)}
                                                        className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-accent-text)]"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showMathWindow && (
                                <div
                                    className="wf-modal-backdrop wf-dialog-frame fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
                                    onClick={() => setShowMathWindow(false)}
                                >
                                    <div
                                        ref={mathDialogRef}
                                        className="wf-dialog relative w-full max-w-6xl overflow-hidden rounded-[2rem] border"
                                        role="dialog"
                                        aria-modal="true"
                                        aria-labelledby="mod-builder-math-title"
                                        tabIndex={-1}
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                                        <div className="max-h-[88vh] overflow-y-auto px-6 pb-6 pt-6 sm:px-8 sm:pt-8">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-[0.35em] text-[color:var(--wf-accent-text)]">
                                                        Detailed Build Math
                                                    </div>
                                                    <h3 id="mod-builder-math-title" className="mt-2 text-2xl font-semibold text-[color:var(--wf-text-strong)] sm:text-[2rem]">
                                                        Full calculation trace
                                                    </h3>
                                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300/80">
                                                        This window shows the calculator inputs, intermediate values, and final outputs for the current build. It is intentionally verbose so you can inspect each bracket, quantization step, proc weight, DoT term, and conditional assumption without the inline panel getting bloated.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMathWindow(false)}
                                                    className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-info)]"
                                                >
                                                    Close
                                                </button>
                                            </div>

                                            {activeAttackDpsUnavailable && (
                                                <div role="note" className="mt-6 rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/90">
                                                    Reference-only math: this trace retains per-attack component arithmetic for inspection, but the current attack inputs do not produce target damage, DPS, or TTK scores.
                                                    {activeCalcWeapon?.selectedAttackModelLimitation?.sourceUrl && (
                                                        <> <a href={activeCalcWeapon.selectedAttackModelLimitation.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Wiki source</a></>
                                                    )}
                                                </div>
                                            )}

                                            {displayedMath ? (
                                                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                                                    {displayedMath.sections.map((section) => (
                                                        <div key={section.title} className="overflow-hidden rounded-[1.5rem] border border-slate-800/90 bg-slate-950/55">
                                                            <div className="border-b border-cyan-400/10 bg-cyan-400/5 px-5 py-4">
                                                                <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--wf-info)]">{section.title}</div>
                                                            </div>
                                                            <div className="space-y-2 px-5 py-4">
                                                                {section.lines.map((line, idx) => (
                                                                    <div key={idx} className="rounded-xl border border-slate-800/70 bg-slate-950/50 px-3 py-2 text-[11px] leading-5 text-slate-300 break-words">
                                                                        <span className="font-mono">{line}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-8 rounded-[1.5rem] border border-slate-800/90 bg-slate-950/55 px-5 py-5 text-sm text-slate-400">
                                                    No math snapshot is available yet for this build state.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                </>
            )}
        </div>
    );
}

function InlineStatRow({ label, value, sub, tooltip, labelClassName }: {
    label: React.ReactNode;
    value: string;
    sub?: string;
    tooltip?: string;
    labelClassName?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div
            className={["relative flex items-center justify-between gap-3", tooltip ? "cursor-help" : ""].join(" ")}
            onMouseEnter={() => tooltip && setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            <span className={["flex items-center gap-1", labelClassName ?? "text-sky-200/85"].join(" ")}>
                {label}
                {tooltip && <span className="text-slate-700 text-[8px]">?</span>}
            </span>
            <div className="text-right">
                <div className="font-mono text-yellow-200">{value}</div>
                {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
            </div>
            {show && tooltip && (
                <div className="absolute bottom-full left-0 mb-1.5 z-50 w-60 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] text-slate-300 shadow-xl leading-relaxed pointer-events-none whitespace-pre-line">
                    {tooltip}
                </div>
            )}
        </div>
    );
}
