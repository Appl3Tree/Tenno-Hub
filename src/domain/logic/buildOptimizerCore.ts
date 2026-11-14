// src/domain/logic/buildOptimizer.ts
// Build optimizer: beam search for mod selection + polarity-aware slot assignment.
//
// Phase 1 — Beam search: finds the best ordered set of mods, checking capacity with
//            the real slot polarities (not neutral) so polarity-matching mods
//            correctly count as cheaper.
// Phase 2 — Slot assignment: preserves elemental order and uses minimum-drain
//            placement, with capacity constraints included during candidate search.

import type { WeaponEntry, WeaponAttack } from "../catalog/weaponCatalog";
import { withSelectedAttack } from "../catalog/weaponRules";
import type { ModEntry, ModEffect } from "../catalog/modCatalog";
import { emptyEffect } from "../catalog/modEffectUtils";
import type { ArcaneEntry } from "../catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "./arcaneEffects";
import {
    calculateBuild,
    calculateBuildForExpectedEncounter,
    avgHitDamageMultiplier,
    DEFAULT_CONDITIONAL_STATE,
    type ConditionalState,
} from "./damageCalc";
import { effectiveDrain, fitsWithinCapacity, totalModCapacity, type CapacityConfig } from "./capacityCalc";
import {
    DAMAGE_TYPES,
    STATUS_DAMAGE_TYPES,
    STATUS_EFFECT_RULES,
    factionDamageTypeModifier,
    enemyArmorDamageMultiplier,
    type DamageType,
    type StatusDamageType,
} from "./damageRuleset";
import {
    effectiveDamageProgressMultiplier,
    simulateExpectedWeaponEncounter,
    type ExpectedWeaponEncounterResult,
} from "./targetDamage";

export type OptimizeGoal = "burst" | "scaling" | "timeToKill";
export type LegacyOptimizeGoal = OptimizeGoal | "damage" | "crit" | "status";

export function normalizeOptimizeGoal(goal: LegacyOptimizeGoal | null | undefined): OptimizeGoal {
    switch (goal) {
        case "damage":
        case "burst":
        case "crit":
        case "status":
            return "burst";
        case "scaling":
            return goal;
        case "timeToKill":
            return goal;
        default:
            return "burst";
    }
}

export interface OptimizerOptions {
    ownedModUniqueNames?: Set<string>;
    ownedModMaxRankByUniqueName?: Record<string, number>;
    ownedArcaneUniqueNames?: Set<string>;
    ownedArcaneMaxRankByUniqueName?: Record<string, number>;
    excludedModUniqueNames?: Set<string>;
    allowNonMaxRank?: boolean;
    targetFaction?: string;
    /** Optional current-level target stats for the finite expected-value target encounter score. */
    targetProfileOverride?: TargetProfileOverride;
    conditionalState?: ConditionalState;
    /** If set, enforce capacity constraint using this config. */
    capacityConfig?: CapacityConfig;
    /** Slot polarities for the 8 main slots (used for both capacity and assignment). */
    slotPolarities?: string[];
    /** Starting physical slot polarities; Forma changes are counted relative to these slots. */
    defaultSlotPolarities?: string[];
    /**
     * If true, optimizer assumes a Catalyst is installed (doubles capacity) regardless
     * of capacityConfig.hasCatalyst. Also marks the result as needing a catalyst.
     */
    allowCatalyst?: boolean;
    /**
     * If true, optimizer is free to assign any polarity to any slot (simulating forma).
     * It will pick the polarity that minimises drain for each placed mod.
     * The returned slotPolarities reflect the optimal polarities to use.
     */
    allowForma?: boolean;
    /** Maximum additional slot polarity changes from defaultSlotPolarities this optimization may use. */
    maxFormaCount?: number;
    /**
     * If true, also try adding an exilus mod to the exilus slot.
     * The returned result will include exilusMod / exilusRank if one was selected.
     */
    optimizeExilus?: boolean;
    exilusPolarity?: string;
    /**
     * If provided, score builds against this specific attack rather than the weapon base.
     * Pass weapon.attacks[selectedAttackIdx] here.
     */
    buildForAttack?: WeaponAttack | null;
    /**
     * If true, also try all available arcanes and select the best one.
     * Requires the weapon category to be known (from weapon.category).
     */
    optimizeArcane?: boolean;
    /** Compatible arcane candidates supplied by the catalog-facing adapter. */
    arcaneCandidates?: ArcaneEntry[];
    /** Explicit Warframe armor for armor-scaling weapon arcanes. */
    warframeArmor?: number;
    /** Explicit Warframe maximum Energy for energy-scaling weapon arcanes. */
    warframeMaxEnergy?: number;
    /** Current Energy as a percentage of the Warframe's maximum (0–100). */
    warframeEnergyPercent?: number;
    /** Mods that are always present for capacity accounting, e.g. melee stance. */
    extraCapacitySlots?: Array<{
        mod: ModEntry;
        rank: number;
        polarity: string;
    }>;
    /** Effects already present and locked into the build. */
    preEquippedEffects?: (ModEffect | null)[];
    /** Filled main slots that should remain untouched during optimization. */
    lockedSlots?: (ModEntry | null)[];
    lockedSlotRanks?: (number | undefined)[];
    /** Filled main slot positions whose polarities must remain unchanged. */
    lockedSlotMask?: boolean[];
    /** Incompatibility groups already present and locked into the build. */
    lockedIncompatibilityGroups?: Set<string>;
    /** Unique mod names already present and locked into the build. */
    lockedUniqueNames?: Set<string>;
}

export interface OptimizeResult {
    mods: ModEntry[];
    ranks: number[];
    /** Full 8-slot array (null = empty slot), in polarity-aware placement order. */
    slots: (ModEntry | null)[];
    slotRanks: number[];
    /** Optimal polarities per slot (reflects forma if allowForma was set). */
    slotPolarities: string[];
    /** Whether a catalyst is needed for this build. */
    needsCatalyst: boolean;
    /** Whether the final main, stance, and Exilus slots fit the configured capacity. */
    capacityValid: boolean;
    /** Exilus mod selected (if optimizeExilus was true). */
    exilusMod: ModEntry | null;
    exilusRank: number;
    exilusPolarity: string;
    /** Arcane selected (if optimizeArcane was true). */
    arcane: ArcaneEntry | null;
    arcaneRank: number;
    /** Finite expected-encounter DPS used by the Expected TTK objective. */
    encounterScore?: number;
    /** Encounter time to kill, or null when the simulation cap is reached first. */
    encounterTimeToKillSeconds?: number | null;
    /** True when the finite-encounter pass improved the proxy-screened build. */
    encounterRefined?: boolean;
    /** Number of local replacement candidates evaluated by the finite encounter. */
    encounterCandidatesEvaluated?: number;
}

function resultUsesAnyNonMaxed(result: OptimizeResult): boolean {
    if (result.exilusMod && result.exilusRank < result.exilusMod.fusionLimit) return true;
    return result.slots.some((mod, index) => !!mod && (result.slotRanks[index] ?? mod.fusionLimit) < mod.fusionLimit);
}

function scoreOptimizeResult(
    weapon: WeaponEntry,
    result: OptimizeResult,
    goal: OptimizeGoal,
    targetFaction: string,
    buildForAttack?: WeaponAttack | null,
    conditionalState?: ConditionalState,
    targetProfileOverride?: TargetProfileOverride,
    preEquippedEffects: (ModEffect | null)[] = [],
    warframeArmor?: number,
    warframeMaxEnergy?: number,
    warframeEnergyPercent?: number,
): number {
    const scoringWeapon = makeWeaponForAttack(weapon, buildForAttack);
    const effects: (ModEffect | null)[] = result.slots.map((mod, index) => {
        if (!mod) return null;
        const rank = result.slotRanks[index] ?? mod.fusionLimit;
        return mod.effectsByRank[rank] ?? mod.effect;
    });
    if (result.exilusMod) {
        effects.push(result.exilusMod.effectsByRank[result.exilusRank] ?? result.exilusMod.effect);
    }
    const arcaneEffect = result.arcane
        ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, warframeArmor, true, { warframeMaxEnergy, warframeEnergyPercent })
        : null;
    return scoreEffects(scoringWeapon, [...preEquippedEffects, ...effects], goal, targetFaction, arcaneEffect, targetProfileOverride, conditionalState);
}

const PROC_DAMAGE_KEYS = STATUS_DAMAGE_TYPES;
const TARGET_PROFILE_CACHE = new Map<string, TargetProfile>();
const TARGET_STATUS_IMMUNITY_CACHE = new WeakMap<TargetProfile, ReadonlySet<StatusDamageType>>();
const EMPTY_STATUS_IMMUNITIES: ReadonlySet<StatusDamageType> = new Set();
const NORMALIZED_ARCANE_EFFECT_CACHE = new WeakMap<object, ModEffect>();

export const CANONICAL_FACTIONS = [
    "Grineer",
    "Kuva Grineer",
    "Corpus",
    "Corpus Amalgam",
    "Infested",
    "Infested Deimos",
    "Orokin",
    "Sentient",
    "Narmer",
    "The Murmur",
    "Zariman",
    "Scaldra (1999)",
    "Techrot (1999)",
    "Anarchs",
] as const;

interface TargetProfile {
    armor: number;
    health?: number;
    shields?: number;
    overguard?: number;
    healthShare: number;
    shieldShare: number;
    overguardShare?: number;
    hasOverguard: boolean;
    crowdControlImmune: boolean;
    grouped: boolean;
    effectiveHealth: number;
    toxinBypassesShields?: boolean;
    statusImmuneTypes?: ReadonlySet<typeof PROC_DAMAGE_KEYS[number]>;
    statusStackCaps?: Partial<Record<StatusDamageType, number>>;
}

export interface TargetProfileOverride {
    /** User-facing note for nonstandard target scaling applied before scoring. */
    description?: string;
    armor?: number;
    health?: number;
    shields?: number;
    overguard?: number;
    healthShare?: number;
    shieldShare?: number;
    hasOverguard?: boolean;
    crowdControlImmune?: boolean;
    grouped?: boolean;
    effectiveHealth?: number;
    /** Disable Toxin's normal Shield bypass for exceptions such as Hounds and Treasurers. */
    toxinBypassesShields?: boolean;
    /** Enemy Shield Gate behavior assumed for each direct attack in the finite encounter. */
    enemyShieldGateHitMode?: "body" | "weakspot" | "blockedArea";
    /** Additional same-profile enemies assumed to be inside active Electric/Gas clouds. */
    nearbyEnemyCount?: number;
    /** Additional same-profile enemies assumed to be inside Blast's 5m radial. */
    nearbyBlastEnemyCount?: number;
    statusImmuneTypes?: Iterable<typeof PROC_DAMAGE_KEYS[number]>;
    statusStackCaps?: Partial<Record<StatusDamageType, number>>;
}

export interface TargetProfileAssumptions {
    armor: number;
    health: number;
    shields: number;
    overguard: number;
    effectiveHealth: number;
    healthShare: number;
    shieldShare: number;
    overguardShare: number;
    toxinBypassesShields: boolean;
    statusImmuneTypes: Array<typeof PROC_DAMAGE_KEYS[number]>;
    statusStackCaps: Partial<Record<StatusDamageType, number>>;
    grouped: boolean;
    crowdControlImmune: boolean;
}

interface OptimizerScoringTargetContext {
    initialTarget: TargetProfile;
    target: TargetProfile;
    statusImmuneTypes: ReadonlySet<StatusDamageType>;
    statusStackCaps: Partial<Record<StatusDamageType, number>>;
    pools: TargetProfileAssumptions;
    poolTotal: number;
    shares: { health: number; shields: number; overguard: number };
    healthTypeMultipliers: Record<DamageType, number>;
}

interface CachedOverrideScoringContext {
    signature: string;
    context: OptimizerScoringTargetContext;
}

const DEFAULT_TARGET_SCORING_CONTEXT_CACHE = new WeakMap<TargetProfile, OptimizerScoringTargetContext>();
const OVERRIDE_TARGET_SCORING_CONTEXT_CACHE = new WeakMap<object, Map<string, CachedOverrideScoringContext>>();

function factionSignature(faction: string): string {
    return PROC_DAMAGE_KEYS
        .map((key) => `${key}:${factionDamageTypeModifier(faction, key)}`)
        .join("|");
}

export interface FactionFocusOption {
    label: string;
    value: string;
}

export function getFactionFocusOptions(): FactionFocusOption[] {
    const grouped = new Map<string, string[]>();
    for (const faction of CANONICAL_FACTIONS) {
        const signature = factionSignature(faction);
        if (!grouped.has(signature)) grouped.set(signature, []);
        grouped.get(signature)!.push(faction);
    }
    return [...grouped.values()].map((group) => ({
        label: group.join(" / "),
        value: group[0],
    }));
}

function applyTargetProfileOverride(base: TargetProfile, override?: TargetProfileOverride | null): TargetProfile {
    if (!override) return base;
    const target = {
        ...base,
        ...override,
        statusImmuneTypes: override.statusImmuneTypes
            ? new Set(override.statusImmuneTypes)
            : base.statusImmuneTypes,
    };
    if (override.health !== undefined || override.shields !== undefined || override.overguard !== undefined) {
        const health = Math.max(0, target.health ?? base.effectiveHealth * base.healthShare);
        const shields = Math.max(0, target.shields ?? base.effectiveHealth * base.shieldShare);
        const overguard = Math.max(0, target.overguard ?? base.effectiveHealth * (base.overguardShare ?? 0));
        const effectiveHealth = health + shields + overguard;
        return {
            ...target,
            healthShare: effectiveHealth > 0 ? health / effectiveHealth : 0,
            shieldShare: effectiveHealth > 0 ? shields / effectiveHealth : 0,
            overguardShare: effectiveHealth > 0 ? overguard / effectiveHealth : 0,
            hasOverguard: overguard > 0,
            crowdControlImmune: override.crowdControlImmune ?? (overguard > 0),
            effectiveHealth,
        };
    }
    return target;
}

function getTargetProfile(targetFaction: string, override?: TargetProfileOverride | null): TargetProfile {
    const cacheKey = targetFaction.toLowerCase();
    if (!override) {
        const cached = TARGET_PROFILE_CACHE.get(cacheKey);
        if (cached) return cached;
    }
    let base: TargetProfile;
    switch (cacheKey) {
        case "grineer":
            base = {
                armor: 2700,
                healthShare: 1,
                shieldShare: 0,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 25000,
            };
            break;
        case "corpus":
            base = {
                armor: 0,
                healthShare: 0.4,
                shieldShare: 0.6,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 18000,
            };
            break;
        case "corpus amalgam":
            base = {
                armor: 450,
                healthShare: 0.7,
                shieldShare: 0.3,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 20000,
            };
            break;
        case "infested":
            base = {
                armor: 0,
                healthShare: 1,
                shieldShare: 0,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: true,
                effectiveHealth: 16000,
            };
            break;
        case "infested deimos":
        case "deimos infested":
            base = {
                armor: 400,
                healthShare: 1,
                shieldShare: 0,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: true,
                effectiveHealth: 18000,
            };
            break;
        case "orokin":
            base = {
                armor: 1200,
                healthShare: 0.85,
                shieldShare: 0.15,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 22000,
            };
            break;
        case "the murmur":
            base = {
                armor: 600,
                healthShare: 1,
                shieldShare: 0,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 20000,
            };
            break;
        case "zariman":
            base = {
                armor: 800,
                healthShare: 0.8,
                shieldShare: 0.2,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 23000,
            };
            break;
        case "kuva grineer":
            base = {
                armor: 3200,
                healthShare: 1,
                shieldShare: 0,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 28000,
            };
            break;
        case "sentient":
            base = {
                armor: 900,
                healthShare: 0.85,
                shieldShare: 0.15,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 24000,
            };
            break;
        case "narmer":
            base = {
                armor: 700,
                healthShare: 0.7,
                shieldShare: 0.3,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 22000,
            };
            break;
        case "techrot":
        case "techrot (1999)":
            base = {
                armor: 0,
                healthShare: 0.85,
                shieldShare: 0.15,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: true,
                effectiveHealth: 18500,
            };
            break;
        case "scaldra":
        case "scaldra (1999)":
            base = {
                armor: 2200,
                healthShare: 1,
                shieldShare: 0,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 24000,
            };
            break;
        case "anarchs":
            base = {
                armor: 500,
                healthShare: 0.85,
                shieldShare: 0.15,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 21000,
            };
            break;
        // Default (no faction selected): balanced target derived from median/average stats
        // across 13 main factions (Grineer, Corpus, Corpus Amalgam, Infested ×2, Orokin,
        // Murmur, Zariman, Sentient, Narmer, Techrot, Scaldra, Anarchs).
        //   armor        median = 600  (avoids Grineer 2700 skew; still rewards armor-strip value)
        //   healthShare  avg/median ≈ 0.85  (most enemies are health-primary)
        //   shieldShare  avg/median ≈ 0.15  (small but present shield component)
        //   effectiveHP  avg ≈ 20 900, median = 21 000
        //   grouped      false  (≈77% of factions are single-target)
        // Faction damage modifiers are neutral (no per-type bonuses), rewarding
        // broadly applicable damage types over narrow faction counters.
        default:
            base = {
                armor: 600,
                healthShare: 0.85,
                shieldShare: 0.15,
                hasOverguard: false,
                crowdControlImmune: false,
                grouped: false,
                effectiveHealth: 21000,
            };
            break;
    }
    const target = applyTargetProfileOverride(base, override);
    if (!override) TARGET_PROFILE_CACHE.set(cacheKey, target);
    return target;
}

function getScoringStatusImmunities(target: TargetProfile): ReadonlySet<StatusDamageType> {
    const statusImmuneTypes = target.statusImmuneTypes ?? EMPTY_STATUS_IMMUNITIES;
    const needsMagneticImmunity = target.shieldShare <= 0 && !target.hasOverguard && !statusImmuneTypes.has("magnetic");
    const needsOverguardRadiationImmunity = target.hasOverguard && !statusImmuneTypes.has("radiation");
    if (!needsMagneticImmunity && !needsOverguardRadiationImmunity) {
        return statusImmuneTypes;
    }
    const cached = TARGET_STATUS_IMMUNITY_CACHE.get(target);
    if (cached) return cached;
    const withTargetRules = new Set(statusImmuneTypes);
    if (needsMagneticImmunity) withTargetRules.add("magnetic");
    if (needsOverguardRadiationImmunity) withTargetRules.add("radiation");
    TARGET_STATUS_IMMUNITY_CACHE.set(target, withTargetRules);
    return withTargetRules;
}

function getTargetStatusStackCaps(target: TargetProfile): Partial<Record<StatusDamageType, number>> {
    if (!target.hasOverguard) return target.statusStackCaps ?? {};
    const requestedColdCap = target.statusStackCaps?.cold;
    const coldCap = Number.isFinite(requestedColdCap) && (requestedColdCap ?? 0) >= 0
        ? Math.min(4, requestedColdCap ?? 4)
        : 4;
    return { ...target.statusStackCaps, cold: coldCap };
}

function normalizeArcaneEffect(effect: Partial<ModEffect>): ModEffect {
    const cached = NORMALIZED_ARCANE_EFFECT_CACHE.get(effect);
    if (cached) return cached;
    const normalized = {
        ...emptyEffect(),
        ...effect,
        conditionalEffects: [...(effect.conditionalEffects ?? [])],
    };
    NORMALIZED_ARCANE_EFFECT_CACHE.set(effect, normalized);
    return normalized;
}

/** Exact model inputs used by optimizer scoring; faction presets are synthetic estimates, not named enemies. */
export function getTargetProfileAssumptions(
    targetFaction: string,
    override?: TargetProfileOverride | null,
): TargetProfileAssumptions {
    const target = getTargetProfile(targetFaction, override);
    const effectiveHealth = Math.max(0, target.effectiveHealth);
    const overguardShare = target.overguardShare ?? 0;
    return {
        armor: Math.max(0, target.armor),
        health: Math.max(0, target.health ?? effectiveHealth * target.healthShare),
        shields: Math.max(0, target.shields ?? effectiveHealth * target.shieldShare),
        overguard: Math.max(0, target.overguard ?? effectiveHealth * overguardShare),
        effectiveHealth,
        healthShare: target.healthShare,
        shieldShare: target.shieldShare,
        overguardShare,
        toxinBypassesShields: target.toxinBypassesShields !== false,
        statusImmuneTypes: [...getScoringStatusImmunities(target)],
        statusStackCaps: getTargetStatusStackCaps(target),
        grouped: target.grouped,
        crowdControlImmune: target.crowdControlImmune,
    };
}

function getStableTargetOverrideSignature(override: TargetProfileOverride): string | null {
    const immuneTypes = override.statusImmuneTypes;
    // The common UI representation is an array or Set. Avoid consuming arbitrary
    // one-shot iterables merely to build a cache key.
    if (immuneTypes && !Array.isArray(immuneTypes) && !(immuneTypes instanceof Set)) return null;
    return JSON.stringify({
        ...override,
        statusImmuneTypes: immuneTypes ? [...immuneTypes].sort() : undefined,
    });
}

function createOptimizerScoringTargetContext(
    targetFaction: string,
    targetProfileOverride: TargetProfileOverride | null | undefined,
): OptimizerScoringTargetContext {
    const initialTarget = getTargetProfile(targetFaction, targetProfileOverride);
    const statusImmuneTypes = getScoringStatusImmunities(initialTarget);
    const target = statusImmuneTypes === initialTarget.statusImmuneTypes ||
        (!initialTarget.statusImmuneTypes && statusImmuneTypes === EMPTY_STATUS_IMMUNITIES)
        ? initialTarget
        : { ...initialTarget, statusImmuneTypes };
    const statusStackCaps = getTargetStatusStackCaps(initialTarget);
    const pools = getTargetProfileAssumptions(targetFaction, targetProfileOverride);
    const poolTotal = pools.health + pools.shields + pools.overguard;
    const shares = {
        health: poolTotal > 0 ? pools.health / poolTotal : 0,
        shields: poolTotal > 0 ? pools.shields / poolTotal : 0,
        overguard: poolTotal > 0 ? pools.overguard / poolTotal : 0,
    };
    const healthTypeMultipliers = Object.fromEntries(DAMAGE_TYPES.map((type) => [
        type,
        type === "true" ? 1 : Math.max(0, 1 + factionDamageTypeModifier(targetFaction, type)),
    ])) as Record<DamageType, number>;
    return {
        initialTarget,
        target,
        statusImmuneTypes,
        statusStackCaps,
        pools,
        poolTotal,
        shares,
        healthTypeMultipliers,
    };
}

function getOptimizerScoringTargetContext(
    targetFaction: string,
    targetProfileOverride?: TargetProfileOverride | null,
): OptimizerScoringTargetContext {
    if (!targetProfileOverride) {
        const target = getTargetProfile(targetFaction);
        const cached = DEFAULT_TARGET_SCORING_CONTEXT_CACHE.get(target);
        if (cached) return cached;
        const context = createOptimizerScoringTargetContext(targetFaction, null);
        DEFAULT_TARGET_SCORING_CONTEXT_CACHE.set(target, context);
        return context;
    }

    const signature = getStableTargetOverrideSignature(targetProfileOverride);
    if (signature === null) return createOptimizerScoringTargetContext(targetFaction, targetProfileOverride);
    let contextsByFaction = OVERRIDE_TARGET_SCORING_CONTEXT_CACHE.get(targetProfileOverride);
    if (!contextsByFaction) {
        contextsByFaction = new Map();
        OVERRIDE_TARGET_SCORING_CONTEXT_CACHE.set(targetProfileOverride, contextsByFaction);
    }
    const factionKey = targetFaction.toLowerCase();
    const cached = contextsByFaction.get(factionKey);
    if (cached?.signature === signature) return cached.context;
    const context = createOptimizerScoringTargetContext(targetFaction, targetProfileOverride);
    contextsByFaction.set(factionKey, { signature, context });
    return context;
}

function statusCanAffectTarget(
    statusType: DamageType,
    target: TargetProfile,
): boolean {
    if (statusType === "true") return false;
    if (target.statusImmuneTypes?.has(statusType)) return false;
    // Magnetic's effect only exists when shields or Overguard are present, so shieldless
    // targets without Overguard treat it as a dead status for scoring and conditionals.
    if (statusType === "magnetic" && target.shieldShare <= 0 && !target.hasOverguard) return false;
    return true;
}

function expectedStacksAffectingTarget(
    expectedStacksByType: Partial<Record<DamageType, number>>,
    target: TargetProfile,
    statusType: DamageType,
): number {
    if (!statusCanAffectTarget(statusType, target)) return 0;
    const stacks = expectedStacksByType[statusType] ?? 0;
    if (statusType === "cold" && target.hasOverguard) return Math.min(4, stacks);
    return stacks;
}

function normalizeNearbyEnemyCount(value?: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(20, Math.floor(value ?? 0))) : 0;
}

function poissonProbabilityAtLeast(mean: number, threshold: number): number {
    if (threshold <= 0) return 1;
    if (mean <= 0) return 0;
    if (mean >= threshold + 8 * Math.sqrt(mean)) return 1;

    let probability = Math.exp(-mean);
    if (probability <= 0) return 0;
    let cumulative = probability;
    for (let count = 1; count < threshold; count++) {
        probability *= mean / count;
        cumulative += probability;
    }
    return Math.max(0, Math.min(1, 1 - cumulative));
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function makeWeaponForAttack(weapon: WeaponEntry, atk: WeaponAttack | null | undefined): WeaponEntry {
    if (!atk) return weapon;
    const selectedAttackIdx = weapon.attacks.findIndex((attack) => attack === atk);
    return selectedAttackIdx >= 0 ? withSelectedAttack(weapon, selectedAttackIdx) : weapon;
}

function scoreEffects(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    goal: OptimizeGoal,
    targetFaction: string,
    arcaneEffect?: Partial<ModEffect> | null,
    targetProfileOverride?: TargetProfileOverride | null,
    conditionalState?: ConditionalState,
): number {
    const scoringTarget = getOptimizerScoringTargetContext(targetFaction, targetProfileOverride);
    const { target, statusImmuneTypes, statusStackCaps } = scoringTarget;
    const damageOptions = {
        statusImmuneTypes,
        statusStackCaps,
        conditionalState,
        includeDoTTickDetails: false,
    };
    const normalizedArcaneEffect = arcaneEffect
        ? normalizeArcaneEffect(arcaneEffect)
        : null;
    const initialEffects = normalizedArcaneEffect ? [...effects, normalizedArcaneEffect] : effects;
    const conditionalsCanBeActive = (conditionalState?.mode ?? DEFAULT_CONDITIONAL_STATE.mode) !== "initial";
    let hasStatusGatedConditional = false;
    if (conditionalsCanBeActive) {
        for (const effect of initialEffects) {
            if (!effect?.conditionalEffects?.some((conditional) => !!conditional.requiredStatusType)) continue;
            hasStatusGatedConditional = true;
            break;
        }
    }
    let allEffects = initialEffects;
    // Initial-state scoring disables all triggered conditionals in calculateBuild,
    // so resolving whether their required status is reachable cannot change the
    // result. Avoid the extra preview calculation on this hot path.
    if (hasStatusGatedConditional && conditionalsCanBeActive) {
        const ungatedEffects = initialEffects.map((effect) => {
            if (!effect?.conditionalEffects?.length) return effect;
            return {
                ...effect,
                conditionalEffects: effect.conditionalEffects.filter((conditional) => !conditional.requiredStatusType),
            };
        });
        const preview = calculateBuild(weapon, ungatedEffects, targetFaction, damageOptions);
        allEffects = initialEffects.map((effect) => {
            if (!effect?.conditionalEffects?.length) return effect;
            return {
                ...effect,
                conditionalEffects: effect.conditionalEffects.filter((conditional) =>
                    !conditional.requiredStatusType ||
                    expectedStacksAffectingTarget(
                        preview.modded.expectedStacksByType,
                        target,
                        conditional.requiredStatusType,
                    ) >= 0.25,
                ),
            };
        });
    }
    const { modded } = calculateBuild(weapon, allEffects, targetFaction, damageOptions);

    let factionDamageBonus = 0;
    for (const effect of allEffects) {
        if (!effect) continue;
        if (targetFaction && effect.targetFaction && effect.targetFaction.toLowerCase() === targetFaction.toLowerCase()) {
            factionDamageBonus += effect.factionDamageBonus ?? 0;
        }
    }

    const { pools, poolTotal, shares, healthTypeMultipliers } = scoringTarget;
    if (poolTotal <= 0) return 0;
    const factionMultiplier = Math.max(0, 1 + factionDamageBonus);
    const magneticMultiplier = Math.max(0, 1 + modded.magneticShieldDamageBonus);
    const viralMultiplier = Math.max(0, 1 + modded.viralHealthDamageBonus);
    const armorMultiplier = enemyArmorDamageMultiplier(pools.armor *
        (1 - modded.heatArmorStrip) * (1 - modded.corrosiveArmorStrip));
    const critMultiplier = avgHitDamageMultiplier(
        Math.max(0, modded.critChance + modded.punctureCritChanceBonus),
        Math.max(0, modded.critMultiplier + modded.coldCritDamageBonus),
        modded.nonCriticalHitDamageProcs,
    );
    const objectiveAttackRate = goal === "burst" ? modded.burstFireRate : modded.fireRate;
    const burstAttackRate = modded.damageWeightedMultishot * critMultiplier * objectiveAttackRate;
    // Ramp-adjusted Burst and Sustained DPS have different damage multipliers;
    // use the independent magazine duty cycle instead of dividing those values.
    const sustainedDutyCycle = modded.fireRate > 0 ? modded.magazineDutyCycle : 0;
    const damageRampMultiplier = (goal === "burst"
        ? modded.freshMagazineDamageMultiplier
        : modded.sustainedDamageMultiplier) * modded.magazineAverageDamageMultiplier;
    const attackRate = goal === "burst" ? burstAttackRate : burstAttackRate * sustainedDutyCycle;
    const dotDutyCycle = goal === "burst"
        ? (modded.fireRate > 0 ? modded.burstFireRate / modded.fireRate : 0)
        : sustainedDutyCycle;
    const nearbyEnemyCount = normalizeNearbyEnemyCount(targetProfileOverride?.nearbyEnemyCount);
    let score = 0;

    const getPoolProgress = (type: DamageType, slashBleed: boolean, includeFactionMod: boolean): number => {
        const healthTypeMultiplier = type === "true" || slashBleed
            ? 1
            : healthTypeMultipliers[type];
        const factionDamageMultiplier = includeFactionMod ? factionMultiplier : 1;
        const healthMultiplier = healthTypeMultiplier * viralMultiplier * factionDamageMultiplier *
            (slashBleed || type === "true" ? 1 : armorMultiplier);
        const shieldMultiplier = factionDamageMultiplier * magneticMultiplier;
        const overguardMultiplier = factionDamageMultiplier * magneticMultiplier * (type === "void" ? 1.5 : 1);
        const bypassedPools = type === "true" || (type === "toxin" && pools.toxinBypassesShields)
            ? ["shields"] as const
            : [];
        return effectiveDamageProgressMultiplier(
            shares,
            { health: healthMultiplier, shields: shieldMultiplier, overguard: overguardMultiplier },
            bypassedPools,
        );
    };

    for (const type of DAMAGE_TYPES) {
        const directDamageRate = (modded.damageBreakdown[type] ?? 0) * attackRate * damageRampMultiplier;
        if (directDamageRate > 0) score += directDamageRate * getPoolProgress(type, false, true);
        const dotDamageRate = (modded.dotDpsByType[type as StatusDamageType] ?? 0) * dotDutyCycle * damageRampMultiplier;
        if (dotDamageRate > 0) {
            const areaTargetCount = type === "electricity" || type === "gas"
                ? 1 + nearbyEnemyCount
                : 1;
            score += dotDamageRate * getPoolProgress(type, type === "slash", false) * areaTargetCount;
        }
    }

    // For one target, reaching cap pays the same individual stack damage as
    // natural expiry. The 3×H cap blast affects nearby enemies and is excluded
    // from this single-target objective score.
    let blastDamageRate = modded.blastExpectedExpiryDamagePerShot * objectiveAttackRate;
    if (goal !== "burst") blastDamageRate *= sustainedDutyCycle;
    blastDamageRate *= damageRampMultiplier;
    if (blastDamageRate > 0) score += blastDamageRate * getPoolProgress("blast", false, false);

    // Approximate cap-triggered Blast radial value against explicitly selected
    // nearby targets. Poisson arrivals estimate the chance that enough stacks
    // arrive within the scaled fuse; on-kill detonations and neighbor state are
    // left to the finite encounter/known modeling boundary.
    const nearbyBlastEnemyCount = normalizeNearbyEnemyCount(targetProfileOverride?.nearbyBlastEnemyCount);
    const blastProcRate = Math.max(0, modded.procRatePerSecondByType.blast ?? 0) * dotDutyCycle;
    const blastStackCap = Math.max(1, Math.floor(statusStackCaps.blast ?? STATUS_EFFECT_RULES.blast.maxStacks ?? 10));
    const blastFuseSeconds = Math.max(0, STATUS_EFFECT_RULES.blast.detonationDelaySeconds ?? 1.5) * modded.statusDurationMultiplier;
    if (nearbyBlastEnemyCount > 0 && blastProcRate > 0 && modded.blastStackHitDamagePerProc > 0) {
        const capProbability = poissonProbabilityAtLeast(
            blastProcRate * blastFuseSeconds,
            blastStackCap - 1,
        );
        const radialDamageRate = blastProcRate * capProbability *
            modded.blastStackHitDamagePerProc *
            (STATUS_EFFECT_RULES.blast.stackCapDetonationMultiplier ?? 3) *
            nearbyBlastEnemyCount * damageRampMultiplier;
        if (radialDamageRate > 0) score += radialDamageRate * getPoolProgress("blast", false, false);
    }

    return Number.isFinite(score) ? score : 0;
}
function scoreSlots(
    weapon: WeaponEntry,
    slots: (ModEntry | null)[],
    ranks: (number | undefined)[],
    goal: OptimizeGoal,
    targetFaction: string,
    arcaneEffect?: Partial<ModEffect> | null,
    baseEffects: (ModEffect | null)[] = [],
    conditionalState?: ConditionalState,
    targetProfileOverride?: TargetProfileOverride,
    effectsScratch?: (ModEffect | null)[],
): number {
    const effects = effectsScratch ?? [];
    effects.length = 0;
    for (const effect of baseEffects) effects.push(effect);
    for (let i = 0; i < slots.length; i++) {
        const m = slots[i];
        if (!m) {
            effects.push(null);
            continue;
        }
        const r = ranks[i] ?? m.fusionLimit;
        effects.push(m.effectsByRank[r] ?? m.effect);
    }
    return scoreEffects(weapon, effects, goal, targetFaction, arcaneEffect, targetProfileOverride, conditionalState);
}

export function debugScoreBuild(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    goal: OptimizeGoal,
    targetFaction: string,
    arcaneEffect?: Partial<ModEffect> | null,
    targetProfileOverride?: TargetProfileOverride | null,
    conditionalState?: ConditionalState,
): number {
    return scoreEffects(weapon, effects, goal, targetFaction, arcaneEffect, targetProfileOverride, conditionalState);
}

export function debugScoreExpectedEncounter(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    targetFaction = "",
    targetProfileOverride?: TargetProfileOverride,
    conditionalState?: ConditionalState,
    arcaneEffect?: Partial<ModEffect> | null,
): { damagePerSecond: number; timeToKillSeconds: number | null } {
    const result = debugEvaluateExpectedEncounter(
        weapon,
        effects,
        targetFaction,
        targetProfileOverride,
        conditionalState,
        arcaneEffect,
    );
    return { damagePerSecond: result.damagePerSecond, timeToKillSeconds: result.timeToKillSeconds };
}

/** Full finite-encounter output from the same path used by Expected TTK optimization. */
export function debugEvaluateExpectedEncounter(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    targetFaction = "",
    targetProfileOverride?: TargetProfileOverride,
    conditionalState?: ConditionalState,
    arcaneEffect?: Partial<ModEffect> | null,
): {
    damagePerSecond: number;
    timeToKillSeconds: number | null;
    encounter: ExpectedWeaponEncounterResult | null;
} {
    const encounterEffects = arcaneEffect
        ? [...effects, normalizeArcaneEffect(arcaneEffect)]
        : effects;
    const result = expectedEncounterScoreForEffects(
        weapon,
        encounterEffects,
        targetFaction,
        targetProfileOverride,
        conditionalState,
    );
    return {
        damagePerSecond: result.score,
        timeToKillSeconds: result.timeToKillSeconds,
        encounter: result.encounter,
    };
}

// ── Capacity ──────────────────────────────────────────────────────────────────

function fitsCapacity(
    slots: (ModEntry | null)[],
    ranks: (number | undefined)[],
    cfg: CapacityConfig,
    pols: string[],
    extraCapacitySlots: OptimizerOptions["extraCapacitySlots"] = [],
): boolean {
    return fitsWithinCapacity(cfg, pols, slots, ranks, extraCapacitySlots);
}

function fitsReassignableCapacity(
    mods: ModEntry[],
    ranks: number[],
    slotCount: number,
    opts: OptimizerOptions,
): boolean {
    if (!opts.capacityConfig) return true;
    const defaults = [...(opts.defaultSlotPolarities ?? opts.slotPolarities ?? [])];
    while (defaults.length < slotCount) defaults.push("");
    const assignment = assignModsToSlots(mods, ranks, defaults, slotCount, true);
    const polarities = minimizePolaritiesByCapacity(
        defaults,
        assignment.slotMods,
        assignment.slotRanks,
        opts.capacityConfig,
        opts.extraCapacitySlots ?? [],
        undefined,
        opts.maxFormaCount,
        opts.lockedSlotMask ?? [],
    ).mainPolarities;
    return fitsCapacity(
        assignment.slotMods,
        assignment.slotRanks,
        opts.capacityConfig,
        polarities,
        opts.extraCapacitySlots,
    );
}

// ── Optimal polarity for a mod in a slot ─────────────────────────────────────
// When allowForma is true, we can set any polarity. The cheapest is always
// to match the mod's own polarity (halves drain). For auras we want matching too.

function bestPolarity(mod: ModEntry): string {
    return mod.polarity ?? "";
}

// ── Candidate list ────────────────────────────────────────────────────────────

interface Candidate { mod: ModEntry; rank: number; groupBit?: bigint; }

function normalizeOptimizerVariantPath(path: string): string {
    return path
        .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
        .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function getOptimizerVariantTier(path: string): "flawed" | "standard" {
    return /\/beginner\//i.test(path) || /Beginner$/i.test(path) ? "flawed" : "standard";
}

function buildCandidates(allMods: ModEntry[], opts: OptimizerOptions): Candidate[] {
    const { ownedModUniqueNames, ownedModMaxRankByUniqueName, excludedModUniqueNames, allowNonMaxRank, targetFaction = "", lockedIncompatibilityGroups, lockedUniqueNames } = opts;
    const familyHasStandard = new Set<string>();
    for (const mod of allMods) {
        if (!mod.hasDamageEffect) continue;
        if (mod.isAura) continue;
        if (excludedModUniqueNames?.has(mod.uniqueName)) continue;
        if (ownedModUniqueNames && !ownedModUniqueNames.has(mod.uniqueName)) continue;
        if (lockedIncompatibilityGroups?.has(mod.incompatibilityGroup)) continue;
        if (lockedUniqueNames?.has(mod.uniqueName)) continue;
        if (mod.effect.targetFaction && !targetFaction) continue;
        if (mod.effect.targetFaction &&
            mod.effect.targetFaction.toLowerCase() !== targetFaction.toLowerCase()) continue;
        if (getOptimizerVariantTier(mod.path) !== "standard") continue;
        familyHasStandard.add(normalizeOptimizerVariantPath(mod.path));
    }
    const out: Candidate[] = [];
    for (const mod of allMods) {
        // A zero-effect parse is not a neutral optimizer choice: it means the
        // catalog effect is unsupported, so scoring it would silently omit stats.
        if (!mod.hasDamageEffect) continue;
        if (mod.isAura) continue; // auras go in the aura slot, not regular slots
        if (excludedModUniqueNames?.has(mod.uniqueName)) continue;
        if (ownedModUniqueNames && !ownedModUniqueNames.has(mod.uniqueName)) continue;
        if (lockedIncompatibilityGroups?.has(mod.incompatibilityGroup)) continue;
        if (lockedUniqueNames?.has(mod.uniqueName)) continue;
        if (mod.effect.targetFaction && !targetFaction) continue;
        if (mod.effect.targetFaction &&
            mod.effect.targetFaction.toLowerCase() !== targetFaction.toLowerCase()) continue;
        const familyKey = normalizeOptimizerVariantPath(mod.path);
        if (getOptimizerVariantTier(mod.path) === "flawed" && familyHasStandard.has(familyKey)) continue;
        const maxAllowedRank = Math.max(
            0,
            Math.min(
                mod.fusionLimit,
                ownedModMaxRankByUniqueName?.[mod.uniqueName] ?? mod.fusionLimit,
            ),
        );
        if (allowNonMaxRank) {
            for (let r = maxAllowedRank; r >= 0; r--) out.push({ mod, rank: r });
        } else {
            out.push({ mod, rank: maxAllowedRank });
        }
    }
    return out;
}

// ── Polarity-aware slot assignment ────────────────────────────────────────────
// For each mod (sorted by savings potential: largest drain difference wins first pick),
// assign it to the unoccupied slot with the minimum effective drain.
// If allowForma, every slot can take any polarity — we just set the slot polarity
// to match the mod's own polarity for minimum cost.

function assignModsToSlotsWithinFormaLimit(
    mods: ModEntry[],
    ranks: number[],
    slotPolarities: string[],
    slotCount: number,
    allowForma: boolean,
    maxFormaCount?: number,
): { slotMods: (ModEntry | null)[]; slotRanks: number[]; resultPolarities: string[] } {
    const slotMods:    (ModEntry | null)[] = Array(slotCount).fill(null);
    const slotRanks:   number[]            = Array(slotCount).fill(0);
    const resultPols:  string[]            = [...slotPolarities];
    while (resultPols.length < slotCount) resultPols.push("");
    const emptyResult = { slotMods, slotRanks, resultPolarities: resultPols };
    if (mods.length > slotCount || slotCount <= 0) return emptyResult;

    // Elemental mods keep their relative order because it determines combinations.
    // Other mods are interchangeable for damage, so the assignment may reorder them
    // to find a legal low-drain arrangement across the actual slot polarities.
    const elementalIndices: number[] = [];
    const otherIndices: number[] = [];
    for (let index = 0; index < mods.length; index++) {
        const rank = ranks[index] ?? mods[index].fusionLimit;
        const effect = mods[index].effectsByRank[rank] ?? mods[index].effect;
        if (hasPrimaryElementContribution(effect)) elementalIndices.push(index);
        else otherIndices.push(index);
    }
    if (otherIndices.length >= 31) return emptyResult;

    const allOtherMask = (1 << otherIndices.length) - 1;
    const maskWidth = allOtherMask + 1;
    const requestedFormaCount = Number.isFinite(maxFormaCount) ? Math.floor(maxFormaCount!) : slotCount;
    const formaLimit = allowForma ? Math.max(0, Math.min(slotCount, requestedFormaCount)) : 0;
    const formaWidth = formaLimit + 1;
    const stateCount = (slotCount + 1) * (elementalIndices.length + 1) * maskWidth * formaWidth;
    const visited = new Uint8Array(stateCount);
    const drainCost = new Float64Array(stateCount);
    const choiceKind = new Uint8Array(stateCount);
    const choiceModIndex = new Int16Array(stateCount);
    choiceKind.fill(255);
    choiceModIndex.fill(-1);
    const otherBitByModIndex = new Int16Array(mods.length);
    otherBitByModIndex.fill(-1);
    otherIndices.forEach((modIndex, bitIndex) => { otherBitByModIndex[modIndex] = bitIndex; });

    const slotBaseDrainCost = Array.from({ length: mods.length }, () => new Float64Array(slotCount));
    const slotFormaDrainCost = Array.from({ length: mods.length }, () => new Float64Array(slotCount));
    const slotCanForma = Array.from({ length: mods.length }, () => new Uint8Array(slotCount));
    for (let modIndex = 0; modIndex < mods.length; modIndex++) {
        const mod = mods[modIndex];
        const rank = ranks[modIndex] ?? mod.fusionLimit;
        for (let slot = 0; slot < slotCount; slot++) {
            const basePolarity = resultPols[slot] ?? "";
            slotBaseDrainCost[modIndex][slot] = effectiveDrain(mod, basePolarity, rank);
            const targetPolarity = mod.polarity ?? "";
            if (allowForma && targetPolarity && targetPolarity !== basePolarity) {
                slotCanForma[modIndex][slot] = 1;
                slotFormaDrainCost[modIndex][slot] = effectiveDrain(mod, targetPolarity, rank);
            }
        }
    }

    const stateKey = (slotIndex: number, elementIndex: number, otherMask: number, formsRemaining: number) =>
        ((slotIndex * (elementalIndices.length + 1) + elementIndex) * maskWidth + otherMask) * formaWidth + formsRemaining;

    const findPlacement = (slotIndex: number, elementIndex: number, otherMask: number, formsRemaining: number): boolean => {
        const key = stateKey(slotIndex, elementIndex, otherMask, formsRemaining);
        if (visited[key]) return Number.isFinite(drainCost[key]);
        visited[key] = 1;
        drainCost[key] = Number.POSITIVE_INFINITY;

        if (elementIndex >= elementalIndices.length && otherMask === allOtherMask) {
            drainCost[key] = 0;
            return true;
        }
        const remainingMods = elementalIndices.length - elementIndex + otherIndices.length - popCount(otherMask);
        if (slotIndex >= slotCount || remainingMods > slotCount - slotIndex) return false;

        const consider = (
            modIndex: number,
            nextElementIndex: number,
            nextOtherMask: number,
            kind: number,
            usesForma: boolean,
        ) => {
            const nextFormsRemaining = formsRemaining - (usesForma ? 1 : 0);
            if (nextFormsRemaining < 0 || !findPlacement(slotIndex + 1, nextElementIndex, nextOtherMask, nextFormsRemaining)) return;
            const tailKey = stateKey(slotIndex + 1, nextElementIndex, nextOtherMask, nextFormsRemaining);
            const slotDrain = usesForma ? slotFormaDrainCost[modIndex][slotIndex] : slotBaseDrainCost[modIndex][slotIndex];
            const nextDrainCost = drainCost[tailKey] + slotDrain;
            if (nextDrainCost < drainCost[key] - 1e-9) {
                drainCost[key] = nextDrainCost;
                choiceKind[key] = kind;
                choiceModIndex[key] = modIndex;
            }
        };

        // Preserve the old branch order on exact drain ties; among those options,
        // baseline polarity is considered before adding a Forma to a slot.
        if (findPlacement(slotIndex + 1, elementIndex, otherMask, formsRemaining)) {
            const skippedKey = stateKey(slotIndex + 1, elementIndex, otherMask, formsRemaining);
            drainCost[key] = drainCost[skippedKey];
            choiceKind[key] = 0;
        }
        if (elementIndex < elementalIndices.length) {
            const modIndex = elementalIndices[elementIndex];
            consider(modIndex, elementIndex + 1, otherMask, 1, false);
            if (slotCanForma[modIndex][slotIndex]) consider(modIndex, elementIndex + 1, otherMask, 2, true);
        }
        for (let otherIndex = 0; otherIndex < otherIndices.length; otherIndex++) {
            const bit = 1 << otherIndex;
            if ((otherMask & bit) !== 0) continue;
            const modIndex = otherIndices[otherIndex];
            consider(modIndex, elementIndex, otherMask | bit, 3, false);
            if (slotCanForma[modIndex][slotIndex]) consider(modIndex, elementIndex, otherMask | bit, 4, true);
        }
        return Number.isFinite(drainCost[key]);
    };

    if (!findPlacement(0, 0, 0, formaLimit)) return emptyResult;
    let slot = 0;
    let elementIndex = 0;
    let otherMask = 0;
    let formsRemaining = formaLimit;
    while (elementIndex < elementalIndices.length || otherMask !== allOtherMask) {
        const key = stateKey(slot, elementIndex, otherMask, formsRemaining);
        const kind = choiceKind[key];
        if (kind === 0) {
            slot++;
            continue;
        }
        const modIndex = choiceModIndex[key];
        const mod = mods[modIndex];
        slotMods[slot] = mod;
        slotRanks[slot] = ranks[modIndex] ?? mod.fusionLimit;
        const usesForma = kind === 2 || kind === 4;
        if (usesForma) {
            resultPols[slot] = mod.polarity ?? resultPols[slot] ?? "";
            formsRemaining--;
        }
        if (kind === 1 || kind === 2) elementIndex++;
        else otherMask |= 1 << otherBitByModIndex[modIndex];
        slot++;
    }

    return emptyResult;
}

export function assignModsToSlots(
    mods: ModEntry[],
    ranks: number[],
    slotPolarities: string[],
    slotCount: number,
    allowForma: boolean,
    maxFormaCount?: number,
): { slotMods: (ModEntry | null)[]; slotRanks: number[]; resultPolarities: string[] } {
    if (allowForma && maxFormaCount !== undefined) {
        return assignModsToSlotsWithinFormaLimit(mods, ranks, slotPolarities, slotCount, allowForma, maxFormaCount);
    }

    const slotMods: (ModEntry | null)[] = Array(slotCount).fill(null);
    const slotRanks: number[] = Array(slotCount).fill(0);
    const resultPolarities: string[] = [...slotPolarities];
    while (resultPolarities.length < slotCount) resultPolarities.push("");
    const emptyResult = { slotMods, slotRanks, resultPolarities };
    if (mods.length > slotCount || slotCount <= 0) return emptyResult;

    const elementalIndices: number[] = [];
    const otherIndices: number[] = [];
    for (let index = 0; index < mods.length; index++) {
        const rank = ranks[index] ?? mods[index].fusionLimit;
        const effect = mods[index].effectsByRank[rank] ?? mods[index].effect;
        if (hasPrimaryElementContribution(effect)) elementalIndices.push(index);
        else otherIndices.push(index);
    }
    if (otherIndices.length >= 31) return emptyResult;

    const allOtherMask = (1 << otherIndices.length) - 1;
    const maskWidth = allOtherMask + 1;
    const stateCount = (slotCount + 1) * (elementalIndices.length + 1) * maskWidth;
    const visited = new Uint8Array(stateCount);
    const formaCost = new Int16Array(stateCount);
    const drainCost = new Float64Array(stateCount);
    const choiceKind = new Uint8Array(stateCount);
    const choiceModIndex = new Int16Array(stateCount);
    const otherBitByModIndex = new Int16Array(mods.length);
    otherBitByModIndex.fill(-1);
    otherIndices.forEach((modIndex, bitIndex) => { otherBitByModIndex[modIndex] = bitIndex; });

    const slotFormaCost = Array.from({ length: mods.length }, () => new Int16Array(slotCount));
    const slotDrainCost = Array.from({ length: mods.length }, () => new Int16Array(slotCount));
    for (let modIndex = 0; modIndex < mods.length; modIndex++) {
        const mod = mods[modIndex];
        const rank = ranks[modIndex] ?? mod.fusionLimit;
        for (let slot = 0; slot < slotCount; slot++) {
            const basePolarity = resultPolarities[slot] ?? "";
            const assignedPolarity = allowForma && mod.polarity ? mod.polarity : basePolarity;
            slotFormaCost[modIndex][slot] = allowForma && assignedPolarity !== basePolarity ? 1 : 0;
            slotDrainCost[modIndex][slot] = effectiveDrain(mod, assignedPolarity, rank);
        }
    }

    const stateKey = (slotIndex: number, elementIndex: number, otherMask: number) =>
        (slotIndex * (elementalIndices.length + 1) + elementIndex) * maskWidth + otherMask;
    const findPlacement = (slotIndex: number, elementIndex: number, otherMask: number): boolean => {
        const key = stateKey(slotIndex, elementIndex, otherMask);
        if (visited[key]) return formaCost[key] >= 0;
        visited[key] = 1;
        formaCost[key] = -1;
        drainCost[key] = Number.POSITIVE_INFINITY;
        choiceModIndex[key] = -1;
        if (elementIndex >= elementalIndices.length && otherMask === allOtherMask) {
            formaCost[key] = 0;
            drainCost[key] = 0;
            return true;
        }
        const remainingMods = elementalIndices.length - elementIndex + otherIndices.length - popCount(otherMask);
        if (slotIndex >= slotCount || remainingMods > slotCount - slotIndex) return false;

        const consider = (modIndex: number, nextElementIndex: number, nextOtherMask: number, kind: number) => {
            if (!findPlacement(slotIndex + 1, nextElementIndex, nextOtherMask)) return;
            const tailKey = stateKey(slotIndex + 1, nextElementIndex, nextOtherMask);
            const nextFormaCost = formaCost[tailKey] + slotFormaCost[modIndex][slotIndex];
            const nextDrainCost = drainCost[tailKey] + slotDrainCost[modIndex][slotIndex];
            if (formaCost[key] < 0 || nextFormaCost < formaCost[key]
                || (nextFormaCost === formaCost[key] && nextDrainCost < drainCost[key])) {
                formaCost[key] = nextFormaCost;
                drainCost[key] = nextDrainCost;
                choiceKind[key] = kind;
                choiceModIndex[key] = modIndex;
            }
        };

        if (findPlacement(slotIndex + 1, elementIndex, otherMask)) {
            const skippedKey = stateKey(slotIndex + 1, elementIndex, otherMask);
            formaCost[key] = formaCost[skippedKey];
            drainCost[key] = drainCost[skippedKey];
            choiceKind[key] = 0;
        }
        if (elementIndex < elementalIndices.length) consider(elementalIndices[elementIndex], elementIndex + 1, otherMask, 1);
        for (let otherIndex = 0; otherIndex < otherIndices.length; otherIndex++) {
            const bit = 1 << otherIndex;
            if ((otherMask & bit) !== 0) continue;
            consider(otherIndices[otherIndex], elementIndex, otherMask | bit, 2);
        }
        return formaCost[key] >= 0;
    };

    if (!findPlacement(0, 0, 0)) return emptyResult;
    let slot = 0;
    let elementIndex = 0;
    let otherMask = 0;
    while (elementIndex < elementalIndices.length || otherMask !== allOtherMask) {
        const key = stateKey(slot, elementIndex, otherMask);
        const kind = choiceKind[key];
        if (kind === 0) { slot++; continue; }
        const modIndex = choiceModIndex[key];
        const mod = mods[modIndex];
        slotMods[slot] = mod;
        slotRanks[slot] = ranks[modIndex] ?? mod.fusionLimit;
        if (allowForma && mod.polarity) resultPolarities[slot] = mod.polarity;
        if (kind === 1) elementIndex++;
        else otherMask |= 1 << otherBitByModIndex[modIndex];
        slot++;
    }
    return emptyResult;
}

function popCount(value: number): number {
    let remaining = value;
    let count = 0;
    while (remaining !== 0) {
        remaining &= remaining - 1;
        count++;
    }
    return count;
}

export function minimizePolaritiesByCapacity(
    baseMainPolarities: string[],
    slotMods: (ModEntry | null)[],
    slotRanks: number[],
    capacityConfig?: CapacityConfig,
    extraCapacitySlots: Array<{ mod: ModEntry; rank: number; polarity: string }> = [],
    exilus?: { mod: ModEntry | null; rank: number; basePolarity: string },
    maxAdditionalPolarities?: number,
    lockedSlotMask: boolean[] = [],
): { mainPolarities: string[]; exilusPolarity: string } {
    const mainPolarities = [...baseMainPolarities];
    while (mainPolarities.length < slotMods.length) mainPolarities.push("");
    let exilusPolarity = exilus?.basePolarity ?? "";

    // Forma changes a specific slot. A polarity already present in another slot
    // cannot be moved for free, so capacity planning must preserve slot positions.
    if (!capacityConfig) return { mainPolarities, exilusPolarity };

    type FormaCandidate = {
        kind: "main" | "exilus";
        index: number;
        polarity: string;
        savings: number;
    };
    const candidates: FormaCandidate[] = [];
    for (let index = 0; index < slotMods.length; index++) {
        const mod = slotMods[index];
        const targetPolarity = mod?.polarity ?? "";
        if (!mod || !targetPolarity || lockedSlotMask[index] || targetPolarity === mainPolarities[index]) continue;
        const rank = slotRanks[index] ?? mod.fusionLimit;
        const savings = effectiveDrain(mod, mainPolarities[index], rank) - effectiveDrain(mod, targetPolarity, rank);
        if (savings > 0) candidates.push({ kind: "main", index, polarity: targetPolarity, savings });
    }
    if (exilus?.mod && exilus.mod.polarity && exilus.mod.polarity !== exilusPolarity) {
        const savings = effectiveDrain(exilus.mod, exilusPolarity, exilus.rank)
            - effectiveDrain(exilus.mod, exilus.mod.polarity, exilus.rank);
        if (savings > 0) candidates.push({ kind: "exilus", index: -1, polarity: exilus.mod.polarity, savings });
    }
    candidates.sort((left, right) => right.savings - left.savings);

    const capacitySlots = exilus?.mod
        ? [...extraCapacitySlots, { mod: exilus.mod, rank: exilus.rank, polarity: exilusPolarity }]
        : extraCapacitySlots;
    let usedCapacity = 0;
    for (let index = 0; index < slotMods.length; index++) {
        const mod = slotMods[index];
        if (!mod) continue;
        usedCapacity += effectiveDrain(mod, mainPolarities[index] ?? "", slotRanks[index] ?? mod.fusionLimit);
    }
    for (const slot of capacitySlots) {
        usedCapacity += effectiveDrain(slot.mod, slot.polarity, slot.rank);
    }
    const availableCapacity = totalModCapacity(capacityConfig);
    const formaLimit = Math.max(0, Math.min(candidates.length, maxAdditionalPolarities ?? candidates.length));
    let formsUsed = 0;
    for (const candidate of candidates) {
        if (usedCapacity <= availableCapacity || formsUsed >= formaLimit) break;
        usedCapacity -= candidate.savings;
        if (candidate.kind === "main") mainPolarities[candidate.index] = candidate.polarity;
        else exilusPolarity = candidate.polarity;
        formsUsed++;
    }

    return { mainPolarities, exilusPolarity };
}

function getCapacityAwarePolarities(
    slotMods: (ModEntry | null)[],
    slotRanks: number[],
    slotCount: number,
    opts: OptimizerOptions,
    exilus?: { mod: ModEntry | null; rank: number; basePolarity: string },
): { mainPolarities: string[]; exilusPolarity: string } {
    const paddedDefaults = [...(opts.defaultSlotPolarities ?? opts.slotPolarities ?? [])];
    while (paddedDefaults.length < slotCount) paddedDefaults.push("");
    if (!opts.allowForma) {
        const mainPolarities = [...(opts.slotPolarities ?? [])];
        while (mainPolarities.length < slotCount) mainPolarities.push("");
        return { mainPolarities, exilusPolarity: exilus?.basePolarity ?? (opts.exilusPolarity ?? "") };
    }
    return minimizePolaritiesByCapacity(
        paddedDefaults,
        slotMods,
        slotRanks,
        opts.capacityConfig,
        opts.extraCapacitySlots ?? [],
        exilus,
        opts.maxFormaCount,
        opts.lockedSlotMask ?? [],
    );
}

// ── Beam search ───────────────────────────────────────────────────────────────
// Scores each candidate set using the REAL slot polarities (or optimal forma
// polarities if allowForma is set) — this avoids over-conservative capacity
// rejection that was killing builds with polarity-matched mods.

// The optimizer needs enough search breadth to preserve synergistic element packages
// such as Viral + faction damage + status support, even when their partial builds look
// weaker than crit/heat-heavy shells early in the search.
const BEAM_WIDTH = 512;
const BEAM_WIDTH_PER_FILLED_COUNT = 128;
const BEAM_WIDTH_PER_THEME = 48;
const COMBO_REFINE_SHORTLIST = 10;
const COMBO_REFINE_MAX_SWAPS = 3;

interface BeamState {
    mods: (ModEntry | null)[];
    ranks: (number | undefined)[];
    usedGroupMask: bigint;
    score: number;
    filledCount: number;
    /** Running capacity before Forma reductions, including fixed extra slots. */
    capacityUsed: number;
    /** Descending per-slot capacity savings available by changing polarity. */
    formaSavings: number[];
    /** With Forma, compact slot search can stop filling once the first slot is left empty. */
    closed?: boolean;
}

function hasPrimaryElementContribution(effect: ModEffect): boolean {
    const hasDirectElement = (effect.heatBonus ?? 0) > 0 ||
        (effect.coldBonus ?? 0) > 0 ||
        (effect.electricityBonus ?? 0) > 0 ||
        (effect.toxinBonus ?? 0) > 0;
    if (hasDirectElement) return true;
    return (effect.conditionalEffects ?? []).some((conditional) =>
        (conditional.stats.heatBonus ?? 0) > 0 ||
        (conditional.stats.coldBonus ?? 0) > 0 ||
        (conditional.stats.electricityBonus ?? 0) > 0 ||
        (conditional.stats.toxinBonus ?? 0) > 0,
    );
}

export function getBeamStateSignature(
    mods: (ModEntry | null)[],
    ranks: (number | undefined)[],
    allowForma: boolean,
): string {
    const elementOrder: string[] = [];
    const orderIndependentMods: string[] = [];
    const placedMods: string[] = [];

    for (let index = 0; index < mods.length; index++) {
        const mod = mods[index];
        if (!mod) {
            if (!allowForma) placedMods.push("_");
            continue;
        }

        const rank = ranks[index] ?? mod.fusionLimit;
        const token = `${mod.uniqueName}@${rank}`;
        const effect = mod.effectsByRank[rank] ?? mod.effect;
        const directElement = (effect.heatBonus ?? 0) > 0 ||
            (effect.coldBonus ?? 0) > 0 ||
            (effect.electricityBonus ?? 0) > 0 ||
            (effect.toxinBonus ?? 0) > 0;
        const conditionalElement = (effect.conditionalEffects ?? []).some((conditional) =>
            (conditional.stats.heatBonus ?? 0) > 0 ||
            (conditional.stats.coldBonus ?? 0) > 0 ||
            (conditional.stats.electricityBonus ?? 0) > 0 ||
            (conditional.stats.toxinBonus ?? 0) > 0,
        );

        if (directElement || conditionalElement) elementOrder.push(token);
        if (!directElement && !conditionalElement) orderIndependentMods.push(token);
        if (!allowForma) placedMods.push(token);
    }

    // Without Forma, slot placement can change whether a build fits capacity, so keep
    // physical positions. With Forma, non-element mods can be freely reassigned; only
    // the direct and conditional elemental sequences affect damage composition.
    if (!allowForma) return placedMods.join("|");
    return [
        `elements:${elementOrder.join(">")}`,
        `other:${orderIndependentMods.sort().join("|")}`,
    ].join(";");
}

function beamStateSignature(state: BeamState, allowForma: boolean): string {
    return getBeamStateSignature(state.mods, state.ranks, allowForma);
}

function beamThemeSignature(state: BeamState): string {
    const tags = new Set<string>();
    for (let index = 0; index < state.mods.length; index++) {
        const mod = state.mods[index];
        if (!mod) continue;
        const rank = state.ranks[index] ?? mod.fusionLimit;
        const effect = mod.effectsByRank[rank] ?? mod.effect;
        if ((effect.coldBonus ?? 0) > 0) tags.add("cold");
        if ((effect.heatBonus ?? 0) > 0) tags.add("heat");
        if ((effect.toxinBonus ?? 0) > 0) tags.add("toxin");
        if ((effect.electricityBonus ?? 0) > 0) tags.add("electricity");
        if ((effect.viralBonus ?? 0) > 0) tags.add("viral");
        if ((effect.corrosiveBonus ?? 0) > 0) tags.add("corrosive");
        if ((effect.radiationBonus ?? 0) > 0) tags.add("radiation");
        if ((effect.gasBonus ?? 0) > 0) tags.add("gas");
        if ((effect.magneticBonus ?? 0) > 0) tags.add("magnetic");
        if ((effect.blastBonus ?? 0) > 0) tags.add("blast");
        if ((effect.factionDamageBonus ?? 0) > 0 && effect.targetFaction) tags.add(`faction:${effect.targetFaction.toLowerCase()}`);
        if ((effect.directDamagePerStatusBonus ?? 0) > 0) tags.add("per-status");
        if ((effect.conditionOverloadDamagePerStatusBonus ?? 0) > 0) tags.add("per-status");
        if ((effect.critChanceBonus ?? 0) > 0 || (effect.critMultBonus ?? 0) > 0) tags.add("crit");
    }
    return [...tags].sort().join("|");
}

function beamSearch(
    weapon: WeaponEntry,
    candidates: Candidate[],
    goal: OptimizeGoal,
    slotCount: number,
    opts: OptimizerOptions,
): { mods: ModEntry[]; ranks: number[]; expectedEncounterSeeds: Array<{ mods: ModEntry[]; ranks: number[] }> } {
    const {
        capacityConfig,
        targetFaction = "",
        allowForma = false,
        extraCapacitySlots = [],
        preEquippedEffects = [],
        lockedSlots = [],
        lockedSlotRanks = [],
    } = opts;
    const compactFormaSearch = allowForma && !lockedSlots.some(Boolean);
    const compactCapacityCache = new Map<string, boolean>();
    const defaultPolarities = [...(opts.defaultSlotPolarities ?? opts.slotPolarities ?? [])];
    while (defaultPolarities.length < slotCount) defaultPolarities.push("");
    const availableForma = Math.max(0, opts.maxFormaCount ?? slotCount);
    const incompatibilityGroupBits = new Map<string, bigint>();
    let nextIncompatibilityGroupBit = 0n;
    const getIncompatibilityGroupBit = (group: string): bigint => {
        let bit = incompatibilityGroupBits.get(group);
        if (bit === undefined) {
            bit = 1n << nextIncompatibilityGroupBit;
            nextIncompatibilityGroupBit++;
            incompatibilityGroupBits.set(group, bit);
        }
        return bit;
    };
    for (const mod of lockedSlots) {
        if (mod) getIncompatibilityGroupBit(mod.incompatibilityGroup);
    }
    for (const candidate of candidates) {
        candidate.groupBit = getIncompatibilityGroupBit(candidate.mod.incompatibilityGroup);
    }
    let lockedGroupMask = 0n;
    for (const mod of lockedSlots) {
        if (mod) lockedGroupMask |= getIncompatibilityGroupBit(mod.incompatibilityGroup);
    }
    const capacityLimit = capacityConfig ? totalModCapacity(capacityConfig) : Number.POSITIVE_INFINITY;
    const fixedExtraCapacity = capacityConfig
        ? extraCapacitySlots.reduce((total, extra) => total + effectiveDrain(extra.mod, extra.polarity, extra.rank), 0)
        : 0;
    const scoreEffectsScratch: (ModEffect | null)[] = [];

    const insertFormaSaving = (savings: number[], saving: number): number[] => {
        let insertAt = 0;
        while (insertAt < savings.length && savings[insertAt] >= saving) insertAt++;
        return [...savings.slice(0, insertAt), saving, ...savings.slice(insertAt)];
    };

    let initialCapacityUsed = fixedExtraCapacity;
    const initialFormaSavings: number[] = [];
    if (capacityConfig && allowForma) {
        for (let index = 0; index < lockedSlots.length; index++) {
            const mod = lockedSlots[index];
            if (!mod) continue;
            const rank = lockedSlotRanks[index] ?? mod.fusionLimit;
            const basePolarity = defaultPolarities[index] ?? "";
            initialCapacityUsed += effectiveDrain(mod, basePolarity, rank);
            const targetPolarity = mod.polarity ?? "";
            if (!targetPolarity || targetPolarity === basePolarity || opts.lockedSlotMask?.[index]) continue;
            const saving = effectiveDrain(mod, basePolarity, rank) - effectiveDrain(mod, targetPolarity, rank);
            if (saving > 0) initialFormaSavings.push(saving);
        }
        initialFormaSavings.sort((left, right) => right - left);
    }

    const fitsWithForma = (capacityUsed: number, formaSavings: number[]): boolean => {
        if (!capacityConfig) return true;
        if (capacityUsed <= capacityLimit) return true;
        let reducedCapacity = capacityUsed;
        for (let index = 0; index < Math.min(availableForma, formaSavings.length); index++) {
            reducedCapacity -= formaSavings[index];
            if (reducedCapacity <= capacityLimit) return true;
        }
        return false;
    };

    // Capacity checking for compact Forma states reassigns non-element mods across
    // physical slots while preserving the sequence of all element-bearing mods.
    const nonFormaPolarities = [...(opts.slotPolarities ?? [])];
    while (nonFormaPolarities.length < slotCount) nonFormaPolarities.push("");

    let beam: BeamState[] = [{
        mods:      [...Array(slotCount).fill(null)].map((_, i) => lockedSlots[i] ?? null),
        ranks:     [...Array(slotCount).fill(undefined)].map((_, i) => lockedSlotRanks[i]),
        usedGroupMask: lockedGroupMask,
        score:     scoreSlots(
            weapon,
            [...Array(slotCount).fill(null)].map((_, i) => lockedSlots[i] ?? null),
            [...Array(slotCount).fill(undefined)].map((_, i) => lockedSlotRanks[i]),
            goal,
            targetFaction,
            undefined,
            preEquippedEffects,
            opts.conditionalState,
            opts.targetProfileOverride,
            scoreEffectsScratch,
        ),
        filledCount: lockedSlots.filter(Boolean).length,
        capacityUsed: initialCapacityUsed,
        formaSavings: initialFormaSavings,
        closed: false,
    }];

    for (let slotIdx = 0; slotIdx < slotCount; slotIdx++) {
        if (lockedSlots[slotIdx]) continue;
        const nextStates: BeamState[] = [];

        for (const state of beam) {
            if (state.closed) {
                nextStates.push(state);
                continue;
            }

            // Forma search reassigns selected mods to final physical slots later. Keep
            // one compact ordering for each selected set and preserve only elemental
            // ordering permutations, instead of scoring every non-element slot shuffle.
            nextStates.push(compactFormaSearch ? { ...state, closed: true } : state);

            if (compactFormaSearch && state.mods.slice(0, slotIdx).some((mod) => !mod)) continue;

            // The nearest preceding order-independent mod is shared by every candidate
            // considered for this state. Resolve it once instead of allocating and
            // scanning a reversed slice for each non-element candidate.
            let lastOrderIndependentName: string | undefined;
            if (compactFormaSearch) {
                for (let index = slotIdx - 1; index >= 0; index--) {
                    const existing = state.mods[index];
                    if (!existing) continue;
                    const existingRank = state.ranks[index] ?? existing.fusionLimit;
                    if (!hasPrimaryElementContribution(existing.effectsByRank[existingRank] ?? existing.effect)) {
                        lastOrderIndependentName = existing.uniqueName;
                        break;
                    }
                }
            }

            for (const { mod, rank, groupBit } of candidates) {
                const candidateGroupBit = groupBit!;
                if ((state.usedGroupMask & candidateGroupBit) !== 0n) continue;

                const candidateEffect = mod.effectsByRank[rank] ?? mod.effect;
                if (compactFormaSearch && !hasPrimaryElementContribution(candidateEffect)) {
                    if (lastOrderIndependentName && lastOrderIndependentName.localeCompare(mod.uniqueName) > 0) continue;
                }

                const newMods  = [...state.mods];
                const newRanks = [...state.ranks];
                newMods[slotIdx]  = mod;
                newRanks[slotIdx] = rank;

                let capacityUsed = state.capacityUsed;
                let formaSavings = state.formaSavings;
                if (capacityConfig) {
                    if (allowForma) {
                        const basePolarity = defaultPolarities[slotIdx] ?? "";
                        capacityUsed += effectiveDrain(mod, basePolarity, rank);
                        const targetPolarity = mod.polarity ?? "";
                        if (targetPolarity && targetPolarity !== basePolarity && !opts.lockedSlotMask?.[slotIdx]) {
                            const saving = effectiveDrain(mod, basePolarity, rank) - effectiveDrain(mod, targetPolarity, rank);
                            if (saving > 0) formaSavings = insertFormaSaving(state.formaSavings, saving);
                        }
                    }
                    let fits = allowForma
                        ? fitsWithForma(capacityUsed, formaSavings)
                        : fitsCapacity(newMods, newRanks, capacityConfig, nonFormaPolarities, extraCapacitySlots);
                    if (compactFormaSearch) {
                        if (!fits) {
                            const signature = getBeamStateSignature(newMods, newRanks, true);
                            let reassignedFits = compactCapacityCache.get(signature);
                            if (reassignedFits === undefined) {
                                const selectedMods = newMods.flatMap((selectedMod) => selectedMod ? [selectedMod] : []);
                                const selectedRanks = newMods.flatMap((selectedMod, index) => selectedMod ? [newRanks[index] ?? selectedMod.fusionLimit] : []);
                                reassignedFits = fitsReassignableCapacity(selectedMods, selectedRanks, slotCount, opts);
                                compactCapacityCache.set(signature, reassignedFits);
                            }
                            fits ||= reassignedFits;
                        }
                    }
                    if (!fits) continue;
                }

                nextStates.push({
                    mods: newMods,
                    ranks: newRanks,
                    usedGroupMask: state.usedGroupMask | candidateGroupBit,
                    score: Number.NaN,
                    filledCount: state.filledCount + 1,
                    capacityUsed,
                    formaSavings,
                    closed: false,
                });
            }
        }

        const deduped = new Map<string, BeamState>();
        for (const candidate of nextStates) {
            const signature = `${beamStateSignature(candidate, allowForma)};state:${candidate.closed ? "closed" : "open"}`;
            if (deduped.has(signature)) continue;
            if (!Number.isFinite(candidate.score)) {
                candidate.score = scoreSlots(
                    weapon,
                    candidate.mods,
                    candidate.ranks,
                    goal,
                    targetFaction,
                    undefined,
                    preEquippedEffects,
                    opts.conditionalState,
                    opts.targetProfileOverride,
                    scoreEffectsScratch,
                );
            }
            deduped.set(signature, candidate);
        }

        const byFilledCount = new Map<number, BeamState[]>();
        for (const candidate of deduped.values()) {
            if (!byFilledCount.has(candidate.filledCount)) byFilledCount.set(candidate.filledCount, []);
            byFilledCount.get(candidate.filledCount)!.push(candidate);
        }

        const diversified: BeamState[] = [];
        for (const states of byFilledCount.values()) {
            states.sort((a, b) => b.score - a.score);
            diversified.push(...states.slice(0, BEAM_WIDTH_PER_FILLED_COUNT));
        }

        const byTheme = new Map<string, BeamState[]>();
        for (const candidate of deduped.values()) {
            const signature = beamThemeSignature(candidate);
            if (!byTheme.has(signature)) byTheme.set(signature, []);
            byTheme.get(signature)!.push(candidate);
        }
        for (const states of byTheme.values()) {
            states.sort((a, b) => b.score - a.score);
            diversified.push(...states.slice(0, BEAM_WIDTH_PER_THEME));
        }

        diversified.sort((a, b) => b.score - a.score);
        beam = diversified.slice(0, BEAM_WIDTH);
    }

    const best = beam[0];
    const resultMods: ModEntry[] = [];
    const resultRanks: number[] = [];
    for (let i = 0; i < slotCount; i++) {
        const m = best.mods[i];
        if (m) { resultMods.push(m); resultRanks.push(best.ranks[i] ?? m.fusionLimit); }
    }
    const expectedEncounterSeeds: Array<{ mods: ModEntry[]; ranks: number[] }> = [];
    if (goal === "timeToKill" && !lockedSlots.some(Boolean) && beam.length > 1) {
        const maxFilledCount = Math.max(...beam.map((state) => state.filledCount));
        const finalists = beam.filter((state) => state.filledCount === maxFilledCount);
        const seenBuilds = new Set<string>();
        const seenThemes = new Set<string>();
        const takeFinalist = (state: BeamState) => {
            const mods = state.mods.flatMap((mod) => mod ? [mod] : []);
            const ranks = state.mods.flatMap((mod, index) => mod ? [state.ranks[index] ?? mod.fusionLimit] : []);
            const signature = getBeamStateSignature(mods, ranks, true);
            if (seenBuilds.has(signature)) return;
            seenBuilds.add(signature);
            expectedEncounterSeeds.push({ mods, ranks });
        };
        // The beam already keeps high-scoring states from distinct effect themes.
        // Preserve that diversity for the exact encounter pass before filling any
        // remaining seed slots with the best unique proxy states.
        for (const state of finalists) {
            const theme = beamThemeSignature(state);
            if (seenThemes.has(theme)) continue;
            seenThemes.add(theme);
            takeFinalist(state);
            if (expectedEncounterSeeds.length >= 12) break;
        }
        if (expectedEncounterSeeds.length < 12) {
            for (const state of finalists) {
                takeFinalist(state);
                if (expectedEncounterSeeds.length >= 12) break;
            }
        }
    }
    return { mods: resultMods, ranks: resultRanks, expectedEncounterSeeds };
}

function refineBuildSet(
    weapon: WeaponEntry,
    selectedMods: ModEntry[],
    selectedRanks: number[],
    candidates: Candidate[],
    goal: OptimizeGoal,
    opts: OptimizerOptions,
    extraEffects: (ModEffect | null)[] = [],
    arcaneEffect?: Partial<ModEffect> | null,
): { mods: ModEntry[]; ranks: number[] } {
    const {
        slotPolarities = [],
        targetFaction = "",
        allowForma = false,
        capacityConfig,
        preEquippedEffects = [],
    } = opts;

    let mods = [...selectedMods];
    let ranks = [...selectedRanks];
    const padded = [...slotPolarities];
    while (padded.length < mods.length) padded.push("");

    const scoreCache = new Map<string, number>();
    const scoreCurrent = (modsToScore: ModEntry[], ranksToScore: number[]) => {
        const key = getBeamStateSignature(modsToScore, ranksToScore, true);
        const cached = scoreCache.get(key);
        if (cached !== undefined) return cached;
        const effects = modsToScore.map((mod, index) => mod.effectsByRank[ranksToScore[index]] ?? mod.effect);
        const score = scoreEffects(weapon, [...preEquippedEffects, ...effects, ...extraEffects], goal, targetFaction, arcaneEffect, opts.targetProfileOverride, opts.conditionalState);
        scoreCache.set(key, score);
        return score;
    };

    let improved = true;
    while (improved) {
        improved = false;
        let bestScore = scoreCurrent(mods, ranks);
        let bestMods = mods;
        let bestRanks = ranks;

        const presentGroups = new Set(mods.map(mod => mod.incompatibilityGroup));
        const presentNames = new Set(mods.map(mod => mod.uniqueName));

        for (let replaceIdx = 0; replaceIdx < mods.length; replaceIdx++) {
            const replaced = mods[replaceIdx];
            const baseGroups = new Set(presentGroups);
            baseGroups.delete(replaced.incompatibilityGroup);
            const baseNames = new Set(presentNames);
            baseNames.delete(replaced.uniqueName);

            for (const candidate of candidates) {
                if (baseGroups.has(candidate.mod.incompatibilityGroup)) continue;
                if (baseNames.has(candidate.mod.uniqueName)) continue;

                const trialMods = [...mods];
                const trialRanks = [...ranks];
                trialMods[replaceIdx] = candidate.mod;
                trialRanks[replaceIdx] = candidate.rank;

                const { slotMods, slotRanks, resultPolarities } = assignModsToSlots(
                    trialMods,
                    trialRanks,
                    padded,
                    trialMods.length,
                    allowForma,
                );

                const capPolarities = allowForma
                    ? getCapacityAwarePolarities(slotMods, slotRanks, trialMods.length, opts).mainPolarities
                    : resultPolarities;
                if (capacityConfig && !fitsCapacity(slotMods, slotRanks, capacityConfig, capPolarities, opts.extraCapacitySlots)) continue;

                const compactMods = slotMods.filter((mod): mod is ModEntry => !!mod);
                const compactRanks = slotMods.flatMap((mod, index) => (mod ? [slotRanks[index]] : []));
                const trialScore = scoreCurrent(compactMods, compactRanks);
                if (trialScore > bestScore) {
                    bestScore = trialScore;
                    bestMods = compactMods;
                    bestRanks = compactRanks;
                    improved = true;
                }
            }
        }

        mods = bestMods;
        ranks = bestRanks;
    }

    return { mods, ranks };
}

function fillEmptySlots(
    weapon: WeaponEntry,
    selectedMods: ModEntry[],
    selectedRanks: number[],
    candidates: Candidate[],
    goal: OptimizeGoal,
    slotCount: number,
    opts: OptimizerOptions,
    extraEffects: (ModEffect | null)[] = [],
    arcaneEffect?: Partial<ModEffect> | null,
): { mods: ModEntry[]; ranks: number[] } {
    const {
        slotPolarities = [],
        targetFaction = "",
        allowForma = false,
        capacityConfig,
        preEquippedEffects = [],
    } = opts;

    let mods = [...selectedMods];
    let ranks = [...selectedRanks];
    const padded = [...slotPolarities];
    while (padded.length < slotCount) padded.push("");

    const scoreCache = new Map<string, number>();
    const scoreCurrent = (modsToScore: ModEntry[], ranksToScore: number[]) => {
        const key = getBeamStateSignature(modsToScore, ranksToScore, true);
        const cached = scoreCache.get(key);
        if (cached !== undefined) return cached;
        const effects = modsToScore.map((mod, index) => mod.effectsByRank[ranksToScore[index]] ?? mod.effect);
        const score = scoreEffects(weapon, [...preEquippedEffects, ...effects, ...extraEffects], goal, targetFaction, arcaneEffect, opts.targetProfileOverride, opts.conditionalState);
        scoreCache.set(key, score);
        return score;
    };

    let improved = true;
    while (improved && mods.length < slotCount) {
        improved = false;
        const presentGroups = new Set(mods.map(mod => mod.incompatibilityGroup));
        const presentNames = new Set(mods.map(mod => mod.uniqueName));
        const baseScore = scoreCurrent(mods, ranks);
        let bestScore = baseScore;
        let bestMods = mods;
        let bestRanks = ranks;

        for (const candidate of candidates) {
            if (presentGroups.has(candidate.mod.incompatibilityGroup)) continue;
            if (presentNames.has(candidate.mod.uniqueName)) continue;

            const trialMods = [...mods, candidate.mod];
            const trialRanks = [...ranks, candidate.rank];
            const { slotMods, slotRanks, resultPolarities } = assignModsToSlots(
                trialMods,
                trialRanks,
                padded,
                slotCount,
                allowForma,
            );

            const capPolarities = allowForma
                ? getCapacityAwarePolarities(slotMods, slotRanks, slotCount, opts).mainPolarities
                : resultPolarities;
            if (capacityConfig && !fitsCapacity(slotMods, slotRanks, capacityConfig, capPolarities, opts.extraCapacitySlots)) continue;

            const compactMods = slotMods.filter((mod): mod is ModEntry => !!mod);
            const compactRanks = slotMods.flatMap((mod, index) => (mod ? [slotRanks[index]] : []));
            const trialScore = scoreCurrent(compactMods, compactRanks);
            if (trialScore > bestScore) {
                bestScore = trialScore;
                bestMods = compactMods;
                bestRanks = compactRanks;
                improved = true;
            }
        }

        mods = bestMods;
        ranks = bestRanks;
    }

    return { mods, ranks };
}

const ENCOUNTER_REFINE_CANDIDATE_LIMIT = 24;
const ENCOUNTER_REFINE_PROXY_SHORTLIST = 12;
const ENCOUNTER_REFINE_ELEMENT_TRANSITION_LIMIT = 12;
const ENCOUNTER_REFINE_PASSES = 2;
const ARCANE_MOD_JOINT_REFINE_PASSES = 3;

const ENCOUNTER_PRIMARY_ELEMENT_COMBINATIONS: Record<string, string> = {
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

/**
 * Coarse output-family key for refinement diversity. The score still comes from
 * calculateBuild/finite encounter; this key only keeps distinct elemental paths
 * from being discarded by the sustained-damage proxy shortlist.
 */
function expectedEncounterElementTheme(
    weapon: WeaponEntry,
    slots: (ModEntry | null)[],
    ranks: number[],
): string {
    const primaryElements: string[] = [];
    const directCombinedElements = new Set<string>();
    const addPrimary = (type: string) => {
        if (!primaryElements.includes(type)) primaryElements.push(type);
    };
    const addEffectElements = (effect: Partial<ModEffect>) => {
        if ((effect.heatBonus ?? 0) > 0) addPrimary("heat");
        if ((effect.coldBonus ?? 0) > 0) addPrimary("cold");
        if ((effect.electricityBonus ?? 0) > 0) addPrimary("electricity");
        if ((effect.toxinBonus ?? 0) > 0) addPrimary("toxin");
        if ((effect.blastBonus ?? 0) > 0) directCombinedElements.add("blast");
        if ((effect.gasBonus ?? 0) > 0) directCombinedElements.add("gas");
        if ((effect.magneticBonus ?? 0) > 0) directCombinedElements.add("magnetic");
        if ((effect.viralBonus ?? 0) > 0) directCombinedElements.add("viral");
        if ((effect.corrosiveBonus ?? 0) > 0) directCombinedElements.add("corrosive");
        if ((effect.radiationBonus ?? 0) > 0) directCombinedElements.add("radiation");
    };

    for (let index = 0; index < slots.length; index++) {
        const mod = slots[index];
        if (!mod) continue;
        const rank = ranks[index] ?? mod.fusionLimit;
        const effect = mod.effectsByRank[rank] ?? mod.effect;
        addEffectElements(effect);
        for (const conditional of effect.conditionalEffects ?? []) addEffectElements(conditional.stats);
    }
    // Damage Calculation appends innate primary elements after slotted elements.
    if (weapon.damage.heat > 0) addPrimary("heat");
    if (weapon.damage.cold > 0) addPrimary("cold");
    if (weapon.damage.electricity > 0) addPrimary("electricity");
    if (weapon.damage.toxin > 0) addPrimary("toxin");

    const combined = new Set<string>(directCombinedElements);
    for (let index = 0; index < primaryElements.length;) {
        const current = primaryElements[index];
        const next = primaryElements[index + 1];
        const result = next
            ? ENCOUNTER_PRIMARY_ELEMENT_COMBINATIONS[`${current}+${next}`]
            : undefined;
        if (result) {
            combined.add(result);
            index += 2;
        } else {
            combined.add(current);
            index++;
        }
    }
    return [...combined].sort().join("+");
}

function expectedEncounterElementTransition(
    incoming: ModEntry,
    incomingRank: number,
    outgoing: ModEntry | null,
    outgoingRank: number | undefined,
): string {
    if (!outgoing) return "";
    const getSinglePrimaryType = (mod: ModEntry, rank: number | undefined): string => {
        const effect = mod.effectsByRank[rank ?? mod.fusionLimit] ?? mod.effect;
        const types = ["heat", "cold", "electricity", "toxin"].filter((type) =>
            (effect[`${type}Bonus` as keyof ModEffect] as number | undefined ?? 0) > 0,
        );
        return types.length === 1 ? types[0] : "";
    };
    const incomingType = getSinglePrimaryType(incoming, incomingRank);
    const outgoingType = getSinglePrimaryType(outgoing, outgoingRank);
    return incomingType && outgoingType ? `${incomingType}>${outgoingType}` : "";
}

function expectedEncounterScoreForEffects(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    targetFaction: string,
    targetProfileOverride: TargetProfileOverride | undefined,
    conditionalState: ConditionalState | undefined,
): { score: number; timeToKillSeconds: number | null; encounter: ExpectedWeaponEncounterResult | null } {
    const target = getOptimizerScoringTargetContext(targetFaction, targetProfileOverride);
    if (target.poolTotal <= 0) return { score: 0, timeToKillSeconds: null, encounter: null };

    const encounterBuild = calculateBuildForExpectedEncounter(weapon, effects, targetFaction, {
        statusImmuneTypes: target.statusImmuneTypes,
        statusStackCaps: target.statusStackCaps,
        conditionalState,
        targetStatusState: "initial",
    });
    const stats = encounterBuild.modded;
    const factionDamageBonus = effects.reduce((sum, effect) =>
        effect?.targetFaction?.toLowerCase() === targetFaction.toLowerCase()
            ? sum + (effect.factionDamageBonus ?? 0)
            : sum,
    0);
    const dotDamagePerApplicationByType = Object.fromEntries(
        Object.entries(stats.dotDamagePerShotByType).flatMap(([rawType, damagePerAttack]) => {
            const type = rawType as StatusDamageType;
            const applications = stats.averageProcsPerShot * (stats.procChanceByType[type] ?? 0);
            return applications > 0 ? [[type, damagePerAttack / applications]] : [];
        }),
    ) as Partial<Record<StatusDamageType, number>>;

    const encounter = simulateExpectedWeaponEncounter({
        damageByType: stats.damageBreakdownBeforePerStatus,
        rawDamageByType: stats.rawDamageBreakdownBeforePerStatus,
        baseDamageTotal: stats.baseDamageTotal,
        health: target.pools.health,
        shields: target.pools.shields,
        overguard: target.pools.overguard,
        maxShields: target.pools.shields,
        maxOverguard: target.pools.overguard,
        armor: target.pools.armor,
        faction: targetFaction,
        factionDamageBonus,
        toxinBypassesShields: target.pools.toxinBypassesShields,
        enemyShieldGateHitMode: targetProfileOverride?.enemyShieldGateHitMode,
        damageRampRule: weapon.selectedAttackDamageRamp,
        critChance: stats.critChance,
        critMultiplier: stats.critMultiplier,
        nonCriticalHitDamageProcs: stats.nonCriticalHitDamageProcs,
        expectedProjectiles: stats.multishot,
        expectedDamageMultiplier: stats.damageWeightedMultishot,
        attackIntervalSeconds: 1 / Math.max(0.0001, stats.fireRate),
        shotsPerMagazine: stats.shotsPerMag,
        infiniteAmmoActive: stats.infiniteAmmoActive,
        firstShotMagazineDamageBonus: stats.firstShotMagazineDamageBonus,
        reloadDurationSeconds: weapon.weaponType.trim().toLowerCase() === "bow" ? 0 : stats.reloadTime,
        ...getEncounterBurstTiming(weapon, stats.fireRate),
        statusDurationMultiplier: stats.statusDurationMultiplier,
        dotDamagePerAttackByType: stats.dotDamagePerShotByType,
        dotDamagePerApplicationByType,
        heatDotTickDamagePerProc: stats.dotTickDamagePerProcBeforeConditionOverloadByType.heat,
        heatDotAccumulatorDamagePerTick: stats.dotTickAccumulatorDamageByType.heat,
        dotSeedDamagePerApplicationByType: stats.dotDamagePerApplicationSeedByType,
        dotAccumulatorDamagePerApplicationByType: stats.dotDamagePerApplicationAccumulatorByType,
        statusProcWeightsByType: stats.damageBreakdownBeforePerStatus,
        statusRollsPerAttack: stats.multishot * stats.statusChance,
        forcedStatusApplicationsPerAttackByType: stats.unfilteredExtraProcsPerShot as Partial<Record<StatusDamageType, number>>,
        statusImmuneTypes: target.statusImmuneTypes,
        statusStackCaps: target.statusStackCaps,
        blastStackHitDamagePerProc: stats.blastStackHitDamagePerProcBeforeConditionOverload,
        nearbyBlastEnemyCount: targetProfileOverride?.nearbyBlastEnemyCount,
        nearbyElectricGasEnemyCount: targetProfileOverride?.nearbyEnemyCount,
        magneticBreakElectricSourceMultiplier: stats.magneticBreakElectricSourceMultiplier,
        directDamagePerStatusBonus: stats.directDamagePerStatusBonus,
        conditionOverloadDamagePerStatusBonus: stats.conditionOverloadApplies
            ? stats.conditionOverloadDamagePerStatusBonus
            : 0,
        externalConditionOverloadStatusTypeCount: conditionalState?.externalStatusTypeCount,
        uniqueStatusProcsPerAttack: weapon.uniqueStatusProcs,
        intrinsicDamagePerStatusBonus: stats.intrinsicDamagePerStatusBonus,
        intrinsicDamagePerStatusMode: stats.intrinsicDamagePerStatusMode,
        totalDamageBonus: stats.totalDamageBonus,
        timedConditionalDamageStacks: stats.timedConditionalDamageStacks,
    });

    return {
        // Expected TTK minimizes this finite encounter's DPS denominator when a
        // kill occurs. If the 600s / 20,000-attack safety bound is reached first,
        // expected damage per second remains a useful, explicit fallback.
        score: Number.isFinite(encounter.damagePerSecond) ? encounter.damagePerSecond : 0,
        timeToKillSeconds: encounter.timeToKillSeconds,
        encounter,
    };
}

function isExpectedEncounterBetter(
    candidate: { score: number; timeToKillSeconds: number | null },
    incumbent: { score: number; timeToKillSeconds: number | null },
): boolean {
    if (candidate.timeToKillSeconds !== null) {
        if (incumbent.timeToKillSeconds === null) return true;
        return candidate.timeToKillSeconds < incumbent.timeToKillSeconds - 1e-9;
    }
    if (incumbent.timeToKillSeconds !== null) return false;
    return candidate.score > incumbent.score + Math.max(1e-9, Math.abs(incumbent.score) * 1e-12);
}

/** Monotonic scalar used only when the UI compares alternate weapon configurations. */
export function rankExpectedEncounter(
    timeToKillSeconds: number | null | undefined,
    damagePerSecond: number,
): number {
    if (timeToKillSeconds !== null && timeToKillSeconds !== undefined && Number.isFinite(timeToKillSeconds)) {
        // A kill inside the finite simulation window outranks an encounter that
        // reaches the safety cap. Among kills, shorter TTK always ranks higher.
        return 2 + 1 / (1 + Math.max(0, timeToKillSeconds));
    }
    const nonNegativeDps = Math.max(0, Number.isFinite(damagePerSecond) ? damagePerSecond : 0);
    return nonNegativeDps / (1 + nonNegativeDps);
}

function getEncounterBurstTiming(weapon: WeaponEntry, effectiveFireRate: number): {
    burstCount?: number;
    burstCycleRate?: number;
    burstDelaySeconds?: number;
} {
    const burstCount = weapon.burstCount;
    const burstCycleRate = weapon.burstCycleRate;
    const burstDelay = weapon.burstDelay;
    if (
        weapon.trigger.toLowerCase() !== "burst" ||
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

function refineBuildByExpectedEncounter(
    weapon: WeaponEntry,
    initialSlots: (ModEntry | null)[],
    initialRanks: number[],
    initialPolarities: string[],
    candidates: Candidate[],
    goal: OptimizeGoal,
    opts: OptimizerOptions,
    extraEffects: (ModEffect | null)[],
    arcaneEffect: Partial<ModEffect> | null,
    capacitySlots: Array<{ mod: ModEntry; rank: number; polarity: string }>,
    expectedEncounterSeeds: Array<{ mods: ModEntry[]; ranks: number[] }> = [],
): {
    slots: (ModEntry | null)[];
    ranks: number[];
    polarities: string[];
    score: number;
    timeToKillSeconds: number | null;
    candidatesEvaluated: number;
    refined: boolean;
} {
    const {
        targetFaction = "",
        preEquippedEffects = [],
        slotPolarities = [],
        defaultSlotPolarities = slotPolarities,
        allowForma = false,
        capacityConfig,
        lockedSlots = [],
    } = opts;
    let slots = [...initialSlots];
    let ranks = [...initialRanks];
    let polarities = [...initialPolarities];
    const assignmentPolarities = allowForma ? [...defaultSlotPolarities] : [...slotPolarities];
    while (assignmentPolarities.length < slots.length) assignmentPolarities.push("");
    const defaultPolarities = [...defaultSlotPolarities];
    while (defaultPolarities.length < slots.length) defaultPolarities.push("");

    const makeEffects = (mods: (ModEntry | null)[], modRanks: number[]) => [
        ...preEquippedEffects,
        ...mods.map((mod, index) => mod
            ? mod.effectsByRank[modRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null),
        ...extraEffects,
        ...(arcaneEffect ? [normalizeArcaneEffect(arcaneEffect)] : []),
    ];
    const exactCache = new Map<string, { score: number; timeToKillSeconds: number | null }>();
    const exactScore = (mods: (ModEntry | null)[], modRanks: number[]) => {
        const key = getBeamStateSignature(mods.filter((mod): mod is ModEntry => !!mod), mods.flatMap((mod, index) => mod ? [modRanks[index]] : []), true);
        const cached = exactCache.get(key);
        if (cached) return cached;
        const evaluated = expectedEncounterScoreForEffects(
            weapon,
            makeEffects(mods, modRanks),
            targetFaction,
            opts.targetProfileOverride,
            opts.conditionalState,
        );
        exactCache.set(key, evaluated);
        return evaluated;
    };

    let current = exactScore(slots, ranks);
    let candidatesEvaluated = 1;
    let refined = false;
    if (lockedSlots.some(Boolean)) {
        return { slots, ranks, polarities, ...current, candidatesEvaluated, refined };
    }
    // TTK is the sole objective comparator, with no secondary DPS tie-break
    // between builds that kill at the same instant. A time-zero kill is the
    // lower bound, so no replacement can improve it.
    if (current.timeToKillSeconds !== null && current.timeToKillSeconds <= 1e-9) {
        return { slots, ranks, polarities, ...current, candidatesEvaluated, refined };
    }

    const seedAssignments = new Set<string>();
    for (const seed of expectedEncounterSeeds) {
        const assigned = assignModsToSlots(
            seed.mods,
            seed.ranks,
            assignmentPolarities,
            slots.length,
            allowForma,
            opts.maxFormaCount,
        );
        const seedPolarities = allowForma
            ? minimizePolaritiesByCapacity(
                defaultPolarities,
                assigned.slotMods,
                assigned.slotRanks,
                capacityConfig,
                capacitySlots,
                undefined,
                opts.maxFormaCount,
                opts.lockedSlotMask ?? [],
            ).mainPolarities
            : assigned.resultPolarities;
        if (capacityConfig && !fitsCapacity(
            assigned.slotMods,
            assigned.slotRanks,
            capacityConfig,
            seedPolarities,
            capacitySlots,
        )) continue;
        const signature = getBeamStateSignature(
            assigned.slotMods.filter((mod): mod is ModEntry => !!mod),
            assigned.slotMods.flatMap((mod, index) => mod ? [assigned.slotRanks[index]] : []),
            true,
        );
        if (seedAssignments.has(signature)) continue;
        seedAssignments.add(signature);
        const evaluated = exactScore(assigned.slotMods, assigned.slotRanks);
        candidatesEvaluated++;
        if (isExpectedEncounterBetter(evaluated, current)) {
            slots = [...assigned.slotMods];
            ranks = [...assigned.slotRanks];
            polarities = seedPolarities;
            current = evaluated;
            refined = true;
        }
    }

    for (let pass = 0; pass < ENCOUNTER_REFINE_PASSES; pass++) {
        const proposals = new Map<string, {
            slots: (ModEntry | null)[];
            ranks: number[];
            polarities: string[];
            proxyScore: number;
            elementTheme: string;
            elementTransition: string;
        }>();
        const existing = slots.flatMap((mod, index) => mod ? [{ mod, rank: ranks[index] ?? mod.fusionLimit, index }] : []);

        for (const candidate of candidates) {
            for (let replacedIndex = -1; replacedIndex < existing.length; replacedIndex++) {
                const replaced = replacedIndex >= 0 ? existing[replacedIndex] : null;
                const baseMods = existing.filter((entry) => entry !== replaced).map((entry) => entry.mod);
                const baseRanks = existing.filter((entry) => entry !== replaced).map((entry) => entry.rank);
                if (baseMods.some((mod) => mod.uniqueName === candidate.mod.uniqueName ||
                    mod.incompatibilityGroup === candidate.mod.incompatibilityGroup)) continue;
                if (replaced && replaced.mod.uniqueName === candidate.mod.uniqueName && replaced.rank === candidate.rank) continue;

                // A replacement occupies the removed mod's source slot. Appending
                // it would reorder primary-element contributions and can make the
                // encounter scorer evaluate a different combination than the UI's
                // slot order. New mods still append to the current ordered build.
                const trialMods = replaced
                    ? existing.map((entry) => entry === replaced ? candidate.mod : entry.mod)
                    : [...baseMods, candidate.mod];
                const trialRanks = replaced
                    ? existing.map((entry) => entry === replaced ? candidate.rank : entry.rank)
                    : [...baseRanks, candidate.rank];
                const assigned = assignModsToSlots(
                    trialMods,
                    trialRanks,
                    assignmentPolarities,
                    slots.length,
                    allowForma,
                    opts.maxFormaCount,
                );
                const trialPolarities = allowForma
                    ? minimizePolaritiesByCapacity(
                        defaultPolarities,
                        assigned.slotMods,
                        assigned.slotRanks,
                        capacityConfig,
                        capacitySlots,
                        undefined,
                        opts.maxFormaCount,
                        opts.lockedSlotMask ?? [],
                    ).mainPolarities
                    : assigned.resultPolarities;
                if (capacityConfig && !fitsCapacity(
                    assigned.slotMods,
                    assigned.slotRanks,
                    capacityConfig,
                    trialPolarities,
                    capacitySlots,
                )) continue;

                const signature = getBeamStateSignature(assigned.slotMods.filter((mod): mod is ModEntry => !!mod), assigned.slotMods.flatMap((mod, index) => mod ? [assigned.slotRanks[index]] : []), true);
                if (proposals.has(signature)) continue;
                proposals.set(signature, {
                    slots: assigned.slotMods,
                    ranks: assigned.slotRanks,
                    polarities: trialPolarities,
                    proxyScore: scoreSlots(
                        weapon,
                        assigned.slotMods,
                        assigned.slotRanks,
                        goal === "timeToKill" ? "scaling" : goal,
                        targetFaction,
                        arcaneEffect,
                        [...preEquippedEffects, ...extraEffects],
                        opts.conditionalState,
                        opts.targetProfileOverride,
                    ),
                    elementTheme: expectedEncounterElementTheme(weapon, assigned.slotMods, assigned.slotRanks),
                    elementTransition: expectedEncounterElementTransition(
                        candidate.mod,
                        candidate.rank,
                        replaced?.mod ?? null,
                        replaced?.rank,
                    ),
                });
            }
        }

        const sortedProposals = [...proposals.values()]
            .sort((left, right) => right.proxyScore - left.proxyScore);
        const shortlist = sortedProposals.slice(0, ENCOUNTER_REFINE_PROXY_SHORTLIST);
        const shortlistedSignatures = new Set(shortlist.map((proposal) => proposal.elementTheme));
        const shortlistedTransitions = new Set<string>();
        for (const proposal of sortedProposals) {
            if (shortlist.length >= ENCOUNTER_REFINE_PROXY_SHORTLIST + ENCOUNTER_REFINE_ELEMENT_TRANSITION_LIMIT) break;
            if (!proposal.elementTransition || shortlistedTransitions.has(proposal.elementTransition)) continue;
            shortlistedTransitions.add(proposal.elementTransition);
            shortlist.push(proposal);
        }
        for (const proposal of sortedProposals) {
            if (shortlist.length >= ENCOUNTER_REFINE_CANDIDATE_LIMIT) break;
            if (!proposal.elementTheme || shortlistedSignatures.has(proposal.elementTheme)) continue;
            shortlistedSignatures.add(proposal.elementTheme);
            shortlist.push(proposal);
        }
        if (shortlist.length < ENCOUNTER_REFINE_CANDIDATE_LIMIT) {
            const shortlistedProposals = new Set(shortlist);
            for (const proposal of sortedProposals) {
                if (shortlist.length >= ENCOUNTER_REFINE_CANDIDATE_LIMIT) break;
                if (shortlistedProposals.has(proposal)) continue;
                shortlist.push(proposal);
            }
        }
        if (!shortlist.length) break;

        let best = current;
        let bestProposal: typeof shortlist[number] | null = null;
        for (const proposal of shortlist) {
            const evaluated = exactScore(proposal.slots, proposal.ranks);
            candidatesEvaluated++;
            if (isExpectedEncounterBetter(evaluated, best)) {
                best = evaluated;
                bestProposal = proposal;
            }
        }
        if (!bestProposal) break;
        slots = [...bestProposal.slots];
        ranks = [...bestProposal.ranks];
        polarities = [...bestProposal.polarities];
        current = best;
        refined = true;
    }

    return { slots, ranks, polarities, ...current, candidatesEvaluated, refined };
}

function chooseIndexCombos(length: number, pick: number): number[][] {
    if (pick <= 0 || pick > length) return [];
    const results: number[][] = [];
    const current: number[] = [];
    const walk = (start: number) => {
        if (current.length === pick) {
            results.push([...current]);
            return;
        }
        for (let index = start; index < length; index++) {
            current.push(index);
            walk(index + 1);
            current.pop();
        }
    };
    walk(0);
    return results;
}

function chooseCandidateCombos(candidates: Candidate[], pick: number): Candidate[][] {
    if (pick <= 0 || pick > candidates.length) return [];
    const results: Candidate[][] = [];
    const current: Candidate[] = [];
    const walk = (start: number) => {
        if (current.length === pick) {
            results.push([...current]);
            return;
        }
        for (let index = start; index < candidates.length; index++) {
            current.push(candidates[index]);
            walk(index + 1);
            current.pop();
        }
    };
    walk(0);
    return results;
}

function comboRefineBuildSet(
    weapon: WeaponEntry,
    selectedMods: ModEntry[],
    selectedRanks: number[],
    candidates: Candidate[],
    goal: OptimizeGoal,
    opts: OptimizerOptions,
    extraEffects: (ModEffect | null)[] = [],
    arcaneEffect?: Partial<ModEffect> | null,
): { mods: ModEntry[]; ranks: number[] } {
    const {
        slotPolarities = [],
        targetFaction = "",
        allowForma = false,
        capacityConfig,
        preEquippedEffects = [],
    } = opts;

    if (selectedMods.length === 0 || candidates.length === 0) {
        return { mods: selectedMods, ranks: selectedRanks };
    }

    const padded = [...slotPolarities];
    while (padded.length < Math.max(selectedMods.length, 8)) padded.push("");

    const scoreCache = new Map<string, number>();
    const scoreCurrent = (modsToScore: ModEntry[], ranksToScore: number[]) => {
        const key = getBeamStateSignature(modsToScore, ranksToScore, true);
        const cached = scoreCache.get(key);
        if (cached !== undefined) return cached;
        const effects = modsToScore.map((mod, index) => mod.effectsByRank[ranksToScore[index]] ?? mod.effect);
        const score = scoreEffects(weapon, [...preEquippedEffects, ...effects, ...extraEffects], goal, targetFaction, arcaneEffect, opts.targetProfileOverride, opts.conditionalState);
        scoreCache.set(key, score);
        return score;
    };

    let mods = [...selectedMods];
    let ranks = [...selectedRanks];

    let improved = true;
    while (improved) {
        improved = false;
        const currentScore = scoreCurrent(mods, ranks);
        const presentNames = new Set(mods.map((mod) => mod.uniqueName));

        const shortlist = candidates
            .filter(({ mod }) => !presentNames.has(mod.uniqueName))
            .map((candidate) => {
                let bestReplacementScore = -Infinity;
                for (let replaceIndex = 0; replaceIndex < mods.length; replaceIndex++) {
                    const trialMods = [...mods];
                    const trialRanks = [...ranks];
                    trialMods[replaceIndex] = candidate.mod;
                    trialRanks[replaceIndex] = candidate.rank;
                    const { slotMods, slotRanks, resultPolarities } = assignModsToSlots(
                        trialMods,
                        trialRanks,
                        padded,
                        Math.max(mods.length, trialMods.length),
                        allowForma,
                    );
                    const capPolarities = allowForma
                        ? getCapacityAwarePolarities(slotMods, slotRanks, Math.max(mods.length, trialMods.length), opts).mainPolarities
                        : resultPolarities;
                    if (capacityConfig && !fitsCapacity(slotMods, slotRanks, capacityConfig, capPolarities, opts.extraCapacitySlots)) {
                        continue;
                    }
                    const compactMods = slotMods.filter((mod): mod is ModEntry => !!mod);
                    const compactRanks = slotMods.flatMap((mod, index) => (mod ? [slotRanks[index]] : []));
                    bestReplacementScore = Math.max(bestReplacementScore, scoreCurrent(compactMods, compactRanks));
                }
                return { candidate, candidateScore: bestReplacementScore };
            })
            .filter((entry) => Number.isFinite(entry.candidateScore))
            .sort((a, b) => b.candidateScore - a.candidateScore)
            .slice(0, COMBO_REFINE_SHORTLIST)
            .map((entry) => entry.candidate);

        if (!shortlist.length) break;

        let bestScore = currentScore;
        let bestMods = mods;
        let bestRanks = ranks;

        for (let swapCount = 1; swapCount <= Math.min(COMBO_REFINE_MAX_SWAPS, mods.length, shortlist.length); swapCount++) {
            const removeCombos = chooseIndexCombos(mods.length, swapCount);
            const addCombos = chooseCandidateCombos(shortlist, swapCount);

            for (const removeIndexes of removeCombos) {
                const removeSet = new Set(removeIndexes);
                const keptMods = mods.filter((_, index) => !removeSet.has(index));
                const keptRanks = ranks.filter((_, index) => !removeSet.has(index));
                const keptNames = new Set(keptMods.map((mod) => mod.uniqueName));
                const keptGroups = new Set(keptMods.map((mod) => mod.incompatibilityGroup));

                for (const addCombo of addCombos) {
                    let valid = true;
                    const trialMods = [...keptMods];
                    const trialRanks = [...keptRanks];
                    const localNames = new Set(keptNames);
                    const localGroups = new Set(keptGroups);

                    for (const candidate of addCombo) {
                        if (localNames.has(candidate.mod.uniqueName) || localGroups.has(candidate.mod.incompatibilityGroup)) {
                            valid = false;
                            break;
                        }
                        localNames.add(candidate.mod.uniqueName);
                        localGroups.add(candidate.mod.incompatibilityGroup);
                        trialMods.push(candidate.mod);
                        trialRanks.push(candidate.rank);
                    }
                    if (!valid) continue;

                    const { slotMods, slotRanks, resultPolarities } = assignModsToSlots(
                        trialMods,
                        trialRanks,
                        padded,
                        Math.max(mods.length, trialMods.length),
                        allowForma,
                    );

                    const capPolarities = allowForma
                        ? getCapacityAwarePolarities(slotMods, slotRanks, Math.max(mods.length, trialMods.length), opts).mainPolarities
                        : resultPolarities;
                    if (capacityConfig && !fitsCapacity(slotMods, slotRanks, capacityConfig, capPolarities, opts.extraCapacitySlots)) continue;

                    const compactMods = slotMods.filter((mod): mod is ModEntry => !!mod);
                    const compactRanks = slotMods.flatMap((mod, index) => (mod ? [slotRanks[index]] : []));
                    const trialScore = scoreCurrent(compactMods, compactRanks);
                    if (trialScore > bestScore + 1e-9) {
                        bestScore = trialScore;
                        bestMods = compactMods;
                        bestRanks = compactRanks;
                    }
                }
            }
        }

        if (bestScore > currentScore + 1e-9) {
            mods = bestMods;
            ranks = bestRanks;
            improved = true;
        }
    }

    return { mods, ranks };
}

// ── Exilus optimization ───────────────────────────────────────────────────────

function optimizeExilusSlot(
    weapon: WeaponEntry,
    allMods: ModEntry[],
    mainSlots: (ModEntry | null)[],
    mainSlotRanks: number[],
    mainSlotPolarities: string[],
    mainBuildEffects: (import("../catalog/modCatalog").ModEffect | null)[],
    goal: OptimizeGoal,
    targetFaction: string,
    exilusPolarity: string,
    opts: OptimizerOptions,
): { mod: ModEntry | null; rank: number; polarity: string } {
    const eligibleExilus = allMods.filter(m =>
        m.hasDamageEffect &&
        m.isExilus &&
        !m.isAura &&
        !(opts.excludedModUniqueNames?.has(m.uniqueName)) &&
        (!opts.ownedModUniqueNames || opts.ownedModUniqueNames.has(m.uniqueName))
    );
    if (!eligibleExilus.length) return { mod: null, rank: 0, polarity: exilusPolarity };

    const baseScore = scoreEffects(weapon, mainBuildEffects, goal, targetFaction, null, opts.targetProfileOverride, opts.conditionalState);
    let bestImprovingMod: ModEntry | null = null;
    let bestImprovingRank = 0;
    let bestImprovingPolarity = exilusPolarity;
    let bestImprovingScore = baseScore;

    for (const mod of eligibleExilus) {
        const minRank = opts.allowNonMaxRank ? 0 : mod.fusionLimit;
        for (let r = mod.fusionLimit; r >= minRank; r--) {
            const candidatePolarity = opts.allowForma ? bestPolarity(mod) : exilusPolarity;
            if (opts.capacityConfig) {
                const capSlots = mainSlots;
                const capRanks = mainSlotRanks;
                const cappedPolarities = opts.allowForma
                    ? getCapacityAwarePolarities(
                        mainSlots,
                        mainSlotRanks,
                        mainSlots.length,
                        opts,
                        { mod, rank: r, basePolarity: exilusPolarity },
                    )
                    : { mainPolarities: [...mainSlotPolarities], exilusPolarity: candidatePolarity };
                const capPols = cappedPolarities.mainPolarities;
                const capExtraSlots = [
                    ...(opts.extraCapacitySlots ?? []),
                    { mod, rank: r, polarity: cappedPolarities.exilusPolarity },
                ];
                if (!fitsCapacity(capSlots, capRanks, opts.capacityConfig, capPols, capExtraSlots)) continue;
            }
            const e = mod.effectsByRank[r] ?? mod.effect;
            const s = scoreEffects(weapon, [...mainBuildEffects, e], goal, targetFaction, null, opts.targetProfileOverride, opts.conditionalState);
            if (s > bestImprovingScore + 1e-9) {
                bestImprovingScore = s;
                bestImprovingMod = mod;
                bestImprovingRank = r;
                bestImprovingPolarity = candidatePolarity;
            }

        }
    }
    return { mod: bestImprovingMod, rank: bestImprovingRank, polarity: bestImprovingPolarity };
}

// ── Arcane optimization ───────────────────────────────────────────────────────

function optimizeArcaneSlot(
    weapon: WeaponEntry,
    mainBuildEffects: (ModEffect | null)[],
    goal: OptimizeGoal,
    targetFaction: string,
    opts: OptimizerOptions,
): { arcane: ArcaneEntry | null; rank: number } {
    const arcanes = (opts.arcaneCandidates ?? []).filter(arc =>
        !opts.ownedArcaneUniqueNames || opts.ownedArcaneUniqueNames.has(arc.uniqueName)
    );
    if (!arcanes.length) return { arcane: null, rank: 0 };

    let bestEncounter = goal === "timeToKill"
        ? expectedEncounterScoreForEffects(
            weapon,
            mainBuildEffects,
            targetFaction,
            opts.targetProfileOverride,
            opts.conditionalState,
        )
        : null;
    if (bestEncounter?.timeToKillSeconds !== null && bestEncounter?.timeToKillSeconds !== undefined &&
        bestEncounter.timeToKillSeconds <= 1e-9) {
        return { arcane: null, rank: 0 };
    }
    const baseScore = goal === "timeToKill"
        ? 0
        : scoreEffects(weapon, mainBuildEffects, goal, targetFaction, null, opts.targetProfileOverride, opts.conditionalState);
    let bestArcane: ArcaneEntry | null = null;
    let bestRank = 0;
    let bestScore = baseScore;

    const ttkCandidates: Array<{ arcane: ArcaneEntry; rank: number; effect: Partial<ModEffect> }> = [];
    if (goal === "timeToKill") {
        // Without an inventory restriction, evaluate every candidate rank:
        // parsed rank tables may not scale uniformly. When the caller requires
        // an owned Arcane, inventory records only the highest owned rank, so
        // keep the selected rank fixed to that known equipable copy.
        for (const arc of arcanes) {
            const ownedMaxRank = opts.ownedArcaneMaxRankByUniqueName?.[arc.uniqueName];
            const rankCap = ownedMaxRank == null ? arc.maxRank : Math.min(arc.maxRank, ownedMaxRank);
            const ranks = opts.ownedArcaneUniqueNames
                ? [rankCap]
                : Array.from({ length: rankCap + 1 }, (_, index) => rankCap - index);
            for (const rank of ranks) {
                const effect = getArcaneEffectAtRank(arc, rank, opts.warframeArmor, true, {
                    warframeMaxEnergy: opts.warframeMaxEnergy,
                    warframeEnergyPercent: opts.warframeEnergyPercent,
                });
                if (!effect || !Object.keys(effect).length) continue;
                ttkCandidates.push({ arcane: arc, rank, effect });
            }
        }
    }

    for (const arc of arcanes) {
        if (goal === "timeToKill") continue;
        const ownedMaxRank = opts.ownedArcaneMaxRankByUniqueName?.[arc.uniqueName];
        const rankCap = ownedMaxRank == null ? arc.maxRank : Math.min(arc.maxRank, ownedMaxRank);
        for (let rank = rankCap; rank >= 0; rank--) {
            const e = getArcaneEffectAtRank(arc, rank, opts.warframeArmor, true, {
                warframeMaxEnergy: opts.warframeMaxEnergy,
                warframeEnergyPercent: opts.warframeEnergyPercent,
            });
            if (!e || !Object.keys(e).length) continue;
            const s = scoreEffects(weapon, mainBuildEffects, goal, targetFaction, e, opts.targetProfileOverride, opts.conditionalState);
            // An arcane slot is optional. Keep it empty when its parsed effect
            // is unsupported or inactive under the selected conditional state;
            // equality used to select the last zero-value candidate at rank 0.
            const scoreTolerance = Math.max(1e-9, Math.abs(bestScore) * 1e-12);
            if (s > bestScore + scoreTolerance) { bestScore = s; bestArcane = arc; bestRank = rank; }
        }
    }
    for (const candidate of ttkCandidates) {
        const evaluated = expectedEncounterScoreForEffects(
            weapon,
            [...mainBuildEffects, normalizeArcaneEffect(candidate.effect)],
            targetFaction,
            opts.targetProfileOverride,
            opts.conditionalState,
        );
        if (bestEncounter && isExpectedEncounterBetter(evaluated, bestEncounter)) {
            bestEncounter = evaluated;
            bestArcane = candidate.arcane;
            bestRank = candidate.rank;
        }
    }
    return { arcane: bestArcane, rank: bestRank };
}

// ── Public API ────────────────────────────────────────────────────────────────

function optimizeBuildInternal(
    weapon: WeaponEntry,
    availableMods: ModEntry[] | null,
    goal: OptimizeGoal,
    slotCount: number,
    opts: OptimizerOptions = {},
): OptimizeResult {
    if (!availableMods) availableMods = [];

    const {
        slotPolarities = [],
        defaultSlotPolarities = slotPolarities,
        targetFaction = "",
        allowCatalyst = false,
        allowForma = false,
        optimizeExilus = false,
        exilusPolarity = "",
        optimizeArcane = false,
        buildForAttack = null,
        lockedSlots = [],
        lockedSlotRanks = [],
        preEquippedEffects = [],
    } = opts;

    // Score against the selected attack if specified
    const scoringWeapon = makeWeaponForAttack(weapon, buildForAttack);

    // Resolve effective capacity config
    let capCfg = opts.capacityConfig;
    if (capCfg && allowCatalyst && !capCfg.hasCatalyst) {
        capCfg = { ...capCfg, hasCatalyst: true };
    }

    // Effective options used inside beam search
    const effectiveOpts: OptimizerOptions = { ...opts, capacityConfig: capCfg };

    const candidates = buildCandidates(availableMods, effectiveOpts);
    const hasLockedMainSlots = lockedSlots.some(Boolean);

    // Phase 1: Beam search — find best set of mods
    const initial = beamSearch(scoringWeapon, candidates, goal, slotCount, effectiveOpts);
    let mods = initial.mods;
    let ranks = initial.ranks;
    if (!hasLockedMainSlots && goal !== "timeToKill") {
        ({ mods, ranks } = refineBuildSet(
            scoringWeapon,
            initial.mods,
            initial.ranks,
            candidates,
            goal,
            effectiveOpts,
        ));
        ({ mods, ranks } = comboRefineBuildSet(
            scoringWeapon,
            mods,
            ranks,
            candidates,
            goal,
            effectiveOpts,
        ));
    }

    // Phase 2: Assign mods to slots with polarity awareness
    const padded = [...slotPolarities];
    while (padded.length < slotCount) padded.push("");
    const paddedDefaults = [...defaultSlotPolarities];
    while (paddedDefaults.length < slotCount) paddedDefaults.push("");
    const assignmentPolarities = allowForma ? paddedDefaults : padded;

    const assigned = hasLockedMainSlots
        ? {
            slotMods: [...Array(slotCount).fill(null)].map((_, i) => lockedSlots[i] ?? null),
            slotRanks: [...Array(slotCount).fill(0)].map((_, i) => lockedSlots[i] ? (lockedSlotRanks[i] ?? lockedSlots[i]!.fusionLimit) : 0),
            resultPolarities: [...assignmentPolarities],
        }
        : assignModsToSlots(mods, ranks, assignmentPolarities, slotCount, allowForma, effectiveOpts.maxFormaCount);
    const slotMods = assigned.slotMods;
    const slotRanks = assigned.slotRanks;
    const resultPolarities = assigned.resultPolarities;
    if (hasLockedMainSlots) {
        const unlockedMods = mods.flatMap((mod, index) => (mod && !lockedSlots[index] ? [mod] : []));
        const unlockedRanks = mods.flatMap((mod, index) => (mod && !lockedSlots[index] ? [ranks[index]] : []));
        for (let i = 0; i < slotCount; i++) {
            if (lockedSlots[i]) continue;
            const nextMod = unlockedMods.shift() ?? null;
            const nextRank = unlockedRanks.shift() ?? 0;
            slotMods[i] = nextMod;
            slotRanks[i] = nextMod ? nextRank : 0;
        }
    }
    let finalPolarities = allowForma
        ? minimizePolaritiesByCapacity(
            paddedDefaults,
            slotMods,
            slotRanks,
            capCfg,
            effectiveOpts.extraCapacitySlots ?? [],
            undefined,
            effectiveOpts.maxFormaCount,
            effectiveOpts.lockedSlotMask ?? [],
        ).mainPolarities
        : resultPolarities;

    // Capacity constrained candidate search makes post-selection mod removal unnecessary.

    // Phase 4: Exilus slot optimization
    const mainEffects = slotMods.map((m, i) => {
        if (!m) return null;
        const r = slotRanks[i] ?? m.fusionLimit;
        return m.effectsByRank[r] ?? m.effect;
    });

    let exilusMod: ModEntry | null = null;
    let exilusRank = 0;
    let finalExilusPolarity = exilusPolarity;
    if (optimizeExilus) {
        const ex = optimizeExilusSlot(
            scoringWeapon, availableMods, slotMods, slotRanks, finalPolarities, mainEffects, goal, targetFaction, exilusPolarity, effectiveOpts
        );
        exilusMod = ex.mod;
        exilusRank = ex.rank;
        finalExilusPolarity = ex.polarity;
    }

    const contextualCapacitySlots = exilusMod
        ? [
            ...(effectiveOpts.extraCapacitySlots ?? []),
            { mod: exilusMod, rank: exilusRank, polarity: finalExilusPolarity },
        ]
        : (effectiveOpts.extraCapacitySlots ?? []);

    // Exilus selection checks capacity together with all main and stance slots.

    // Phase 5: Arcane optimization
    let arcane: ArcaneEntry | null = null;
    let arcaneRank = 0;
    if (optimizeArcane && goal !== "timeToKill") {
        const allEffects = exilusMod
            ? [...preEquippedEffects, ...mainEffects, exilusMod.effectsByRank[exilusRank] ?? exilusMod.effect]
            : [...preEquippedEffects, ...mainEffects];
        const arc = optimizeArcaneSlot(scoringWeapon, allEffects, goal, targetFaction, effectiveOpts);
        arcane = arc.arcane;
        arcaneRank = arc.rank;
    }
    // Expected TTK needs the exact finite encounter to rank Arcanes. Defer
    // that expensive sweep until after mod refinement so it runs on the final
    // candidate list instead of repeating it on proxy-stage builds.

    const contextualExtraEffects: (ModEffect | null)[] = [];
    if (exilusMod) contextualExtraEffects.push(exilusMod.effectsByRank[exilusRank] ?? exilusMod.effect);
    let contextualArcaneEffect = arcane
        ? getArcaneEffectAtRank(arcane, arcaneRank, effectiveOpts.warframeArmor, true, {
            warframeMaxEnergy: effectiveOpts.warframeMaxEnergy,
            warframeEnergyPercent: effectiveOpts.warframeEnergyPercent,
        })
        : null;

    if (!hasLockedMainSlots) {
        if (goal !== "timeToKill") {
            const refinedWithContext = refineBuildSet(
                scoringWeapon,
                slotMods.filter((m): m is ModEntry => !!m),
                slotMods.flatMap((m, i) => (m ? [slotRanks[i]] : [])),
                candidates,
                goal,
                { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
                contextualExtraEffects,
                contextualArcaneEffect,
            );
            const filledWithContext = fillEmptySlots(
                scoringWeapon,
                refinedWithContext.mods,
                refinedWithContext.ranks,
                candidates,
                goal,
                slotCount,
                { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
                contextualExtraEffects,
                contextualArcaneEffect,
            );
            const comboRefinedWithContext = comboRefineBuildSet(
                scoringWeapon,
                filledWithContext.mods,
                filledWithContext.ranks,
                candidates,
                goal,
                { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
                contextualExtraEffects,
                contextualArcaneEffect,
            );
            mods = comboRefinedWithContext.mods;
            ranks = comboRefinedWithContext.ranks;
        }
    } else {
        mods = slotMods.filter((m, i): m is ModEntry => !!m && !lockedSlots[i]);
        ranks = slotMods.flatMap((m, i) => (m && !lockedSlots[i] ? [slotRanks[i]] : []));
    }

    const reassigned = hasLockedMainSlots
        ? {
            slotMods: [...slotMods],
            slotRanks: [...slotRanks],
            resultPolarities: [...resultPolarities],
        }
        : assignModsToSlots(mods, ranks, assignmentPolarities, slotCount, allowForma, effectiveOpts.maxFormaCount);
    const minimizedFinalPolarities = allowForma
        ? minimizePolaritiesByCapacity(
            paddedDefaults,
            reassigned.slotMods,
            reassigned.slotRanks,
            capCfg,
            effectiveOpts.extraCapacitySlots ?? [],
            exilusMod ? { mod: exilusMod, rank: exilusRank, basePolarity: exilusPolarity } : undefined,
            effectiveOpts.maxFormaCount,
            effectiveOpts.lockedSlotMask ?? [],
        )
        : { mainPolarities: reassigned.resultPolarities, exilusPolarity: finalExilusPolarity };
    const reassignedPolarities = minimizedFinalPolarities.mainPolarities;
    if (allowForma && exilusMod) {
        finalExilusPolarity = minimizedFinalPolarities.exilusPolarity;
    }
    for (let i = 0; i < slotCount; i++) {
        slotMods[i] = reassigned.slotMods[i];
        slotRanks[i] = reassigned.slotRanks[i];
        finalPolarities[i] = reassignedPolarities[i];
    }

    // Final assignment preserves the selected mod order and uses the same capacity-aware rules.

    const scoreFinalMainSlots = (trialSlots: (ModEntry | null)[], trialRanks: number[]) =>
        scoreSlots(
            scoringWeapon,
            trialSlots,
            trialRanks,
            goal,
            targetFaction,
            contextualArcaneEffect,
            contextualExtraEffects,
            effectiveOpts.conditionalState,
            effectiveOpts.targetProfileOverride,
        );

    let greedyImproved = goal !== "timeToKill";
    while (greedyImproved && slotMods.some((mod) => !mod)) {
        greedyImproved = false;
        const baseScore = scoreFinalMainSlots(slotMods, slotRanks);
        let bestCandidate: {
            slotIndex: number;
            mod: ModEntry;
            rank: number;
            score: number;
            polarities: string[];
            exilusPolarity: string;
        } | null = null;

        const presentGroups = new Set(slotMods.filter((mod): mod is ModEntry => !!mod).map((mod) => mod.incompatibilityGroup));
        const presentNames = new Set(slotMods.filter((mod): mod is ModEntry => !!mod).map((mod) => mod.uniqueName));
        const emptyIndexes = slotMods.flatMap((mod, index) => (mod ? [] : [index]));

        for (const candidate of candidates) {
            if (presentGroups.has(candidate.mod.incompatibilityGroup)) continue;
            if (presentNames.has(candidate.mod.uniqueName)) continue;

            for (const slotIndex of emptyIndexes) {
                const trialSlots = [...slotMods];
                const trialRanks = [...slotRanks];
                trialSlots[slotIndex] = candidate.mod;
                trialRanks[slotIndex] = candidate.rank;

                let trialPolarities = [...finalPolarities];
                let trialExilusPolarity = finalExilusPolarity;
                if (allowForma) {
                    const minimized = minimizePolaritiesByCapacity(
                        paddedDefaults,
                        trialSlots,
                        trialRanks,
                        capCfg,
                        effectiveOpts.extraCapacitySlots ?? [],
                        exilusMod ? { mod: exilusMod, rank: exilusRank, basePolarity: exilusPolarity } : undefined,
                        effectiveOpts.maxFormaCount,
                        effectiveOpts.lockedSlotMask ?? [],
                    );
                    trialPolarities = minimized.mainPolarities;
                    trialExilusPolarity = exilusMod ? minimized.exilusPolarity : "";
                }

                const trialExtraCapacitySlots = exilusMod
                    ? [
                        ...(effectiveOpts.extraCapacitySlots ?? []),
                        { mod: exilusMod, rank: exilusRank, polarity: trialExilusPolarity },
                    ]
                    : (effectiveOpts.extraCapacitySlots ?? []);

                if (capCfg && !fitsCapacity(trialSlots, trialRanks, capCfg, trialPolarities, trialExtraCapacitySlots)) continue;

                const trialScore = scoreFinalMainSlots(trialSlots, trialRanks);
                if (trialScore <= baseScore + 1e-9) continue;

                if (!bestCandidate || trialScore > bestCandidate.score + 1e-9) {
                    bestCandidate = {
                        slotIndex,
                        mod: candidate.mod,
                        rank: candidate.rank,
                        score: trialScore,
                        polarities: trialPolarities,
                        exilusPolarity: trialExilusPolarity,
                    };
                }
            }
        }

        if (bestCandidate) {
            slotMods[bestCandidate.slotIndex] = bestCandidate.mod;
            slotRanks[bestCandidate.slotIndex] = bestCandidate.rank;
            finalPolarities = bestCandidate.polarities;
            finalExilusPolarity = exilusMod ? bestCandidate.exilusPolarity : "";
            greedyImproved = true;
        }
    }

    const effectsForCurrentSlots = () => [
        ...preEquippedEffects,
        ...slotMods.map((mod, index) => mod
            ? mod.effectsByRank[slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null),
        ...contextualExtraEffects,
    ];
    const setArcane = (selection: { arcane: ArcaneEntry | null; rank: number }) => {
        arcane = selection.arcane;
        arcaneRank = selection.rank;
        contextualArcaneEffect = arcane
            ? getArcaneEffectAtRank(arcane, arcaneRank, effectiveOpts.warframeArmor, true, {
                warframeMaxEnergy: effectiveOpts.warframeMaxEnergy,
                warframeEnergyPercent: effectiveOpts.warframeEnergyPercent,
            })
            : null;
    };
    const refineCurrentSlotsWithArcane = () => {
        const refined = refineBuildSet(
            scoringWeapon,
            slotMods.filter((mod): mod is ModEntry => !!mod),
            slotMods.flatMap((mod, index) => mod ? [slotRanks[index]] : []),
            candidates,
            goal,
            { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
            contextualExtraEffects,
            contextualArcaneEffect,
        );
        const filled = fillEmptySlots(
            scoringWeapon,
            refined.mods,
            refined.ranks,
            candidates,
            goal,
            slotCount,
            { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
            contextualExtraEffects,
            contextualArcaneEffect,
        );
        const comboRefined = comboRefineBuildSet(
            scoringWeapon,
            filled.mods,
            filled.ranks,
            candidates,
            goal,
            { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
            contextualExtraEffects,
            contextualArcaneEffect,
        );
        mods = comboRefined.mods;
        ranks = comboRefined.ranks;
        const reassignedMods = assignModsToSlots(
            mods,
            ranks,
            assignmentPolarities,
            slotCount,
            allowForma,
            effectiveOpts.maxFormaCount,
        );
        const minimized = allowForma
            ? minimizePolaritiesByCapacity(
                paddedDefaults,
                reassignedMods.slotMods,
                reassignedMods.slotRanks,
                capCfg,
                effectiveOpts.extraCapacitySlots ?? [],
                exilusMod ? { mod: exilusMod, rank: exilusRank, basePolarity: exilusPolarity } : undefined,
                effectiveOpts.maxFormaCount,
                effectiveOpts.lockedSlotMask ?? [],
            )
            : { mainPolarities: reassignedMods.resultPolarities, exilusPolarity: finalExilusPolarity };
        for (let index = 0; index < slotCount; index++) {
            slotMods[index] = reassignedMods.slotMods[index];
            slotRanks[index] = reassignedMods.slotRanks[index];
            finalPolarities[index] = minimized.mainPolarities[index] ?? "";
        }
        if (allowForma && exilusMod) finalExilusPolarity = minimized.exilusPolarity;
    };

    // For proxy objectives, Arcane choice and mod refinement use the same score
    // function. Reconcile them after slot placement and the final empty-slot pass.
    if (goal !== "timeToKill" && optimizeArcane && !hasLockedMainSlots) {
        for (let pass = 0; pass < ARCANE_MOD_JOINT_REFINE_PASSES; pass++) {
            const selectedArcane = optimizeArcaneSlot(
                scoringWeapon,
                effectsForCurrentSlots(),
                goal,
                targetFaction,
                effectiveOpts,
            );
            const arcaneChanged = selectedArcane.arcane?.uniqueName !== arcane?.uniqueName ||
                selectedArcane.rank !== arcaneRank;
            setArcane(selectedArcane);
            if (!arcaneChanged) break;
            refineCurrentSlotsWithArcane();
        }
        // The last legal refinement can expose a better Arcane. The bounded
        // loop ends with the best Arcane for the exact mod list being returned.
        setArcane(optimizeArcaneSlot(
            scoringWeapon,
            effectsForCurrentSlots(),
            goal,
            targetFaction,
            effectiveOpts,
        ));
    }

    let encounterScore: number | undefined;
    let encounterTimeToKillSeconds: number | null | undefined;
    let encounterRefined: boolean | undefined;
    let encounterCandidatesEvaluated: number | undefined;
    if (goal === "timeToKill") {
        const encounterRefinement = refineBuildByExpectedEncounter(
            scoringWeapon,
            slotMods,
            slotRanks,
            finalPolarities,
            candidates,
            goal,
            { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
            contextualExtraEffects,
            contextualArcaneEffect,
            contextualCapacitySlots,
            initial.expectedEncounterSeeds,
        );
        for (let index = 0; index < slotCount; index++) {
            slotMods[index] = encounterRefinement.slots[index] ?? null;
            slotRanks[index] = slotMods[index] ? encounterRefinement.ranks[index] ?? slotMods[index]!.fusionLimit : 0;
        }
        finalPolarities = encounterRefinement.polarities;
        encounterScore = encounterRefinement.score;
        encounterTimeToKillSeconds = encounterRefinement.timeToKillSeconds;
        encounterRefined = encounterRefinement.refined;
        encounterCandidatesEvaluated = encounterRefinement.candidatesEvaluated;
    }

    // Alternate the exact finite-encounter Arcane choice with legal one-mod
    // refinement. An Arcane can change which replacement is best, and that
    // replacement can in turn change the best Arcane.
    if (goal === "timeToKill" && optimizeArcane && !hasLockedMainSlots) {
        for (let pass = 0; pass < ARCANE_MOD_JOINT_REFINE_PASSES; pass++) {
            const selectedArcane = optimizeArcaneSlot(
                scoringWeapon,
                effectsForCurrentSlots(),
                goal,
                targetFaction,
                effectiveOpts,
            );
            const arcaneChanged = selectedArcane.arcane?.uniqueName !== arcane?.uniqueName ||
                selectedArcane.rank !== arcaneRank;
            setArcane(selectedArcane);
            if (!arcaneChanged) break;

            const encounterRefinement = refineBuildByExpectedEncounter(
                scoringWeapon,
                slotMods,
                slotRanks,
                finalPolarities,
                candidates,
                goal,
                { ...effectiveOpts, extraCapacitySlots: contextualCapacitySlots },
                contextualExtraEffects,
                contextualArcaneEffect,
                contextualCapacitySlots,
                initial.expectedEncounterSeeds,
            );
            for (let index = 0; index < slotCount; index++) {
                slotMods[index] = encounterRefinement.slots[index] ?? null;
                slotRanks[index] = slotMods[index]
                    ? encounterRefinement.ranks[index] ?? slotMods[index]!.fusionLimit
                    : 0;
            }
            finalPolarities = encounterRefinement.polarities;
            encounterScore = encounterRefinement.score;
            encounterTimeToKillSeconds = encounterRefinement.timeToKillSeconds;
            encounterRefined = encounterRefined || encounterRefinement.refined;
            encounterCandidatesEvaluated = (encounterCandidatesEvaluated ?? 0) + encounterRefinement.candidatesEvaluated;
        }

        // Recheck after the bounded loop because its last mod replacement may
        // have changed the best Arcane. Keep the Arcane optimal for the reported
        // list even if the search reaches its pass limit before a fixed point.
        setArcane(optimizeArcaneSlot(
            scoringWeapon,
            effectsForCurrentSlots(),
            goal,
            targetFaction,
            effectiveOpts,
        ));
        // A time-zero kill is already the objective's lower bound; when no
        // Arcane was selected, the earlier exact score is still the final one.
        if (!(arcane === null && encounterTimeToKillSeconds !== null &&
            encounterTimeToKillSeconds !== undefined && encounterTimeToKillSeconds <= 1e-9)) {
            const finalEncounterEffects = contextualArcaneEffect
                ? [...effectsForCurrentSlots(), normalizeArcaneEffect(contextualArcaneEffect)]
                : effectsForCurrentSlots();
            const finalEncounter = expectedEncounterScoreForEffects(
                scoringWeapon,
                finalEncounterEffects,
                targetFaction,
                effectiveOpts.targetProfileOverride,
                effectiveOpts.conditionalState,
            );
            encounterScore = finalEncounter.score;
            encounterTimeToKillSeconds = finalEncounter.timeToKillSeconds;
            encounterCandidatesEvaluated = (encounterCandidatesEvaluated ?? 0) + 1;
        }
    }

    const originalCapCfg = opts.capacityConfig;
    const finalCapacitySlots = exilusMod
        ? [
            ...(effectiveOpts.extraCapacitySlots ?? []),
            { mod: exilusMod, rank: exilusRank, polarity: finalExilusPolarity },
        ]
        : (effectiveOpts.extraCapacitySlots ?? []);
    const capacityValid =
        !capCfg || fitsCapacity(slotMods, slotRanks, capCfg, finalPolarities, finalCapacitySlots);
    const needsCatalyst =
        !!(
            allowCatalyst &&
            originalCapCfg &&
            !originalCapCfg.hasCatalyst &&
            !fitsCapacity(slotMods, slotRanks, originalCapCfg, finalPolarities, finalCapacitySlots) &&
            fitsCapacity(slotMods, slotRanks, { ...originalCapCfg, hasCatalyst: true }, finalPolarities, finalCapacitySlots)
        );

    return {
        mods: slotMods.filter((m): m is ModEntry => m !== null),
        ranks: slotRanks.filter((_, i) => slotMods[i] !== null),
        slots: slotMods,
        slotRanks,
        slotPolarities: finalPolarities,
        needsCatalyst,
        capacityValid,
        exilusMod,
        exilusRank,
        exilusPolarity: exilusMod ? finalExilusPolarity : "",
        arcane,
        arcaneRank,
        ...(goal === "timeToKill"
            ? {
                encounterScore,
                encounterTimeToKillSeconds,
                encounterRefined,
                encounterCandidatesEvaluated,
            }
            : {}),
    };
}

export function optimizeBuildCore(
    weapon: WeaponEntry,
    availableMods: ModEntry[] | null,
    goal: OptimizeGoal,
    slotCount: number,
    opts: OptimizerOptions = {},
): OptimizeResult {
    const maxOnlyOpts: OptimizerOptions = { ...opts, allowNonMaxRank: false };
    const maxOnlyResult = optimizeBuildInternal(weapon, availableMods, goal, slotCount, maxOnlyOpts);

    if (!opts.allowNonMaxRank) return maxOnlyResult;

    const nonMaxResult = optimizeBuildInternal(weapon, availableMods, goal, slotCount, opts);
    if (!resultUsesAnyNonMaxed(nonMaxResult)) return maxOnlyResult;

    const scoreOptions = [
        opts.targetFaction ?? "",
        opts.buildForAttack,
        opts.conditionalState,
        opts.targetProfileOverride,
        opts.preEquippedEffects,
        opts.warframeArmor,
        opts.warframeMaxEnergy,
        opts.warframeEnergyPercent,
    ] as const;
    if (goal === "timeToKill" && maxOnlyResult.encounterScore !== undefined && nonMaxResult.encounterScore !== undefined) {
        return isExpectedEncounterBetter(
            {
                score: nonMaxResult.encounterScore,
                timeToKillSeconds: nonMaxResult.encounterTimeToKillSeconds ?? null,
            },
            {
                score: maxOnlyResult.encounterScore,
                timeToKillSeconds: maxOnlyResult.encounterTimeToKillSeconds ?? null,
            },
        ) ? nonMaxResult : maxOnlyResult;
    }
    const baseScore = scoreOptimizeResult(weapon, maxOnlyResult, goal, ...scoreOptions);
    const nonMaxScore = scoreOptimizeResult(weapon, nonMaxResult, goal, ...scoreOptions);
    return nonMaxScore > baseScore ? nonMaxResult : maxOnlyResult;
}

// ── Build reasoning ───────────────────────────────────────────────────────────

export interface BuildReasoningStep {
    modName: string;
    rank: number;
    maxRank: number;
    why: string;
    statBefore: number;
    statAfter: number;
    delta: number;
    pctGain: number;
}

export interface BuildReasoning {
    goal: OptimizeGoal;
    targetFaction: string;
    steps: BuildReasoningStep[];
    arcaneStep?: {
        name: string;
        rank?: number;
        statBefore: number;
        statAfter: number;
        delta: number;
        pctGain: number;
        why: string;
    };
    summary: string;
    winningEdge: string;
    comparisonNote: string;
}

export interface BuildExplanationOptions {
    /** Effects fixed outside the optimized main slots, such as Incarnon or Exilus. */
    baseEffects?: (ModEffect | null)[];
    /** The selected arcane's optimizer-facing effect. */
    arcaneEffect?: Partial<ModEffect> | null;
    arcaneName?: string;
    arcaneRank?: number;
    objectiveEncounter?: {
        damagePerSecond: number;
        timeToKillSeconds: number | null;
        refined: boolean;
        candidatesEvaluated: number;
    };
}

function goalLabel(goal: OptimizeGoal): string {
    switch (goal) {
        case "burst": return "Burst DPS";
        case "scaling": return "Sustained DPS";
        case "timeToKill": return "Expected TTK";
    }
}

export function explainBuild(
    weapon: WeaponEntry,
    chosenMods: ModEntry[],
    chosenRanks: number[],
    goal: OptimizeGoal,
    targetFaction = "",
    buildForAttack?: WeaponAttack | null,
    conditionalState?: ConditionalState,
    targetProfileOverride?: TargetProfileOverride,
    explanationOptions: BuildExplanationOptions = {},
): BuildReasoning {
    const scoringWeapon = makeWeaponForAttack(weapon, buildForAttack);
    const slotCount = chosenMods.length;
    const fullSlots: (ModEntry | null)[] = [...chosenMods];
    const fullRanks: (number | undefined)[] = chosenMods.map((mod, index) => chosenRanks[index] ?? mod.fusionLimit);
    const scoreSlotsForExplanation = (
        mods: (ModEntry | null)[],
        ranks: (number | undefined)[],
        arcaneEffect: Partial<ModEffect> | null | undefined = explanationOptions.arcaneEffect,
    ) => scoreSlots(
        scoringWeapon,
        mods,
        ranks,
        goal,
        targetFaction,
        arcaneEffect,
        explanationOptions.baseEffects ?? [],
        conditionalState,
        targetProfileOverride,
    );
    const fullScore = scoreSlotsForExplanation(fullSlots, fullRanks);
    const baseScore = scoreSlotsForExplanation(
        Array(slotCount).fill(null),
        Array(slotCount).fill(undefined),
    );
    const steps: BuildReasoningStep[] = chosenMods.map((mod, index) => {
        const withoutSlots = [...fullSlots];
        const withoutRanks = [...fullRanks];
        withoutSlots[index] = null;
        withoutRanks[index] = undefined;
        const scoreWithout = scoreSlotsForExplanation(withoutSlots, withoutRanks);
        const delta = fullScore - scoreWithout;
        const pctGain = scoreWithout > 0 ? (delta / scoreWithout) * 100 : 0;
        const rank = chosenRanks[index] ?? mod.fusionLimit;
        const e    = mod.effectsByRank[rank] ?? mod.effect;
        const parts: string[] = [];
        if (e.damageBonus > 0)       parts.push(`+${(e.damageBonus * 100).toFixed(0)}% dmg`);
        if (e.critChanceBonus > 0)   parts.push(`+${(e.critChanceBonus * 100).toFixed(0)}% cc`);
        if (e.critMultBonus > 0)     parts.push(`+${(e.critMultBonus * 100).toFixed(0)}% cd`);
        if (e.statusChanceBonus > 0) parts.push(`+${(e.statusChanceBonus * 100).toFixed(0)}% sc`);
        if (e.multishotBonus > 0)    parts.push(`+${(e.multishotBonus * 100).toFixed(0)}% ms`);
        if (e.fireRateBonus > 0)     parts.push(`+${(e.fireRateBonus * 100).toFixed(0)}% fr`);
        if (e.statusDamageBonus > 0) parts.push(`+${(e.statusDamageBonus * 100).toFixed(0)}% status damage`);
        if (e.statusDurationBonus > 0) parts.push(`+${(e.statusDurationBonus * 100).toFixed(0)}% status duration`);
        if (e.punchThrough > 0)      parts.push(`+${e.punchThrough.toFixed(1)} punch-through`);
        const eleSum = e.heatBonus + e.coldBonus + e.electricityBonus + e.toxinBonus + e.magneticBonus + e.radiationBonus;
        if (eleSum > 0)              parts.push(`+${(eleSum * 100).toFixed(0)}% elem`);
        if (e.factionDamageBonus > 0) parts.push(`×${(1 + e.factionDamageBonus).toFixed(2)} ${e.targetFaction}`);
        const rankNote = rank < mod.fusionLimit ? ` (rank ${rank}/${mod.fusionLimit})` : "";
        const effectSummary = parts.length > 0 ? parts.join(", ") : "Effect not summarized by the active model";
        const contribution = delta >= 0
            ? `Keeping it adds ${pctGain >= 0 ? "+" : ""}${pctGain.toFixed(1)}% to ${goalLabel(goal)} versus the same build without it.`
            : `Keeping it lowers ${goalLabel(goal)} by ${Math.abs(pctGain).toFixed(1)}% versus the same build without it.`;

        return {
            modName: mod.name, rank, maxRank: mod.fusionLimit,
            why: `${effectSummary}${rankNote}. ${contribution}`,
            statBefore: scoreWithout, statAfter: fullScore, delta, pctGain,
        };
    });

    const arcaneStep = explanationOptions.arcaneEffect
        ? (() => {
            const scoreWithoutArcane = scoreSlotsForExplanation(fullSlots, fullRanks, null);
            const delta = fullScore - scoreWithoutArcane;
            const pctGain = scoreWithoutArcane > 0 ? (delta / scoreWithoutArcane) * 100 : 0;
            const contribution = delta >= 0
                ? `Keeping it adds ${pctGain >= 0 ? "+" : ""}${pctGain.toFixed(1)}% to ${goalLabel(goal)} versus the same build without it.`
                : `Keeping it lowers ${goalLabel(goal)} by ${Math.abs(pctGain).toFixed(1)}% versus the same build without it.`;
            return {
                name: explanationOptions.arcaneName ?? "Selected arcane",
                rank: explanationOptions.arcaneRank,
                statBefore: scoreWithoutArcane,
                statAfter: fullScore,
                delta,
                pctGain,
                why: `${explanationOptions.arcaneRank === undefined ? "" : `Rank ${explanationOptions.arcaneRank}. `}${contribution}`,
            };
        })()
        : undefined;

    const totalGain  = baseScore > 0 ? ((fullScore - baseScore) / baseScore) * 100 : 0;
    const totalMultiplier = baseScore > 0 ? fullScore / baseScore : 0;
    const strongestContributions = [...steps]
        .filter((step) => step.delta > 0)
        .sort((left, right) => right.delta - left.delta)
        .slice(0, 3);
    const winningEdge = strongestContributions.length > 0
        ? `Largest leave-one-out gains: ${strongestContributions.map((step) => `${step.modName} (+${step.pctGain.toFixed(1)}%)`).join(", ")}. These margins overlap and are not additive.`
        : "No selected mod has a positive leave-one-out gain in this score and target model.";
    const targetLabel = targetFaction ? `vs ${targetFaction}` : "against the balanced target estimate";
    const nearbyEnemyCount = normalizeNearbyEnemyCount(targetProfileOverride?.nearbyEnemyCount);
    const targetDetail = targetProfileOverride
        ? ` using the entered current-level pool and status assumptions${nearbyEnemyCount > 0 ? ` plus ${nearbyEnemyCount} same-profile nearby target${nearbyEnemyCount === 1 ? "" : "s"} for Electric/Gas status damage` : ""}`
        : "";
    const scoreLabel = goal === "timeToKill" ? "Screening proxy score" : "Selected build score";
    const encounterSummary = goal === "timeToKill" && explanationOptions.objectiveEncounter
        ? explanationOptions.objectiveEncounter.timeToKillSeconds === null
            ? ` Finite expected encounter reached its safety cap; fallback damage rate ${explanationOptions.objectiveEncounter.damagePerSecond.toFixed(1)}/s.`
            : ` Finite expected encounter TTK ${explanationOptions.objectiveEncounter.timeToKillSeconds.toFixed(2)}s at ${explanationOptions.objectiveEncounter.damagePerSecond.toFixed(1)} damage/s.`
        : "";
    const summary    = `${goalLabel(goal)} ${targetLabel}${targetDetail}. ${scoreLabel}: ${fullScore.toFixed(1)}${baseScore > 0 ? ` (${totalMultiplier.toFixed(1)}x unmodded; ${totalGain >= 0 ? "+" : ""}${totalGain.toFixed(1)}%)` : ""}.${encounterSummary}`;
    const encounterSearchNote = !explanationOptions.objectiveEncounter || explanationOptions.objectiveEncounter.candidatesEvaluated <= 1
        ? " Locked slots kept the returned build fixed, so no replacement search was run."
        : explanationOptions.objectiveEncounter.refined
            ? " Finite-encounter refinement improved the screening build."
            : " No finite-encounter candidate improved the screening build.";

    return {
        goal,
        targetFaction,
        steps,
        arcaneStep,
        summary,
        winningEdge,
        comparisonNote: goal === "timeToKill"
            ? `Beam search and per-mod rows use a fast sustained-damage proxy; the finite-encounter pass first scores up to 12 effect-diverse legal beam finalists, then tests up to two passes of ${ENCOUNTER_REFINE_CANDIDATE_LIMIT} legal one-mod replacements. Each pass reserves ${ENCOUNTER_REFINE_PROXY_SHORTLIST} places for proxy leaders and uses the remaining places for distinct single-element substitutions and elemental output families before filling by proxy score. When Arcane optimization is enabled, every supplied candidate Arcane rank up to its owned-rank cap is evaluated against the finite encounter, alternating Arcane choice and legal mod refinement for up to ${ARCANE_MOD_JOINT_REFINE_PASSES} passes.${encounterSearchNote} A kill within 600 seconds outranks a capped encounter; shorter TTK wins between kills, and damage per second ranks builds when neither kills within the cap. Fractional status rolls remain mean-field estimates; this bounded search does not prove global optimality or random TTK.`
            : `Each row re-scores the complete build with one mod removed. These effects overlap when mods interact; scores use the current optimizer model. When Arcane optimization is enabled, Arcane choice and legal mod refinement alternate for up to ${ARCANE_MOD_JOINT_REFINE_PASSES} passes, then the Arcane is rechecked against the returned list. This bounded search and its leave-one-out rows do not prove a global optimum.`,
    };
}
