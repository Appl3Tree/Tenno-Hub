import {
    DAMAGE_TYPES,
    STATUS_DAMAGE_TYPES,
    STATUS_EFFECT_RULES,
    blastStackCapDetonationDamage,
    blastStackExpiryDamage,
    countStatusDamageTicks,
    ENEMY_SHIELD_GATE_BODY_DAMAGE_MULTIPLIER,
    ENEMY_SHIELD_GATE_DURATION_SECONDS,
    enemyArmorDamageMultiplier,
    factionDamageTypeModifier,
    gasCloudOuterAnnulusCoverage,
    gasCloudRadiusFromStacks,
    normalizeElectricGasNeighborCounts,
    MAGNETIC_BREAK_ELECTRIC_DAMAGE_PER_STACK,
    MAGNETIC_BREAK_ELECTRIC_DURATION_SECONDS,
    quantizeDamageContribution,
    type DamageType,
    type StatusDamageType,
} from "./damageRuleset";
import type {
    WeaponAutoSpoolCadenceRule,
    WeaponAutoSpoolShotSequenceRule,
    WeaponDamageRampRule,
    WeaponUniqueStatusType,
    WeaponAttackLingeringDamageRule,
} from "../catalog/weaponCatalog";
import {
    getHeavyAttackRetainedComboPoints,
    INITIAL_COMBO_REGEN_POINTS_PER_SECOND,
} from "../catalog/weaponRules";
import { advanceDamageRampMultiplier, getInitialDamageRampMultiplier } from "./weaponDamageRamp";
import { getAutoSpoolShotSequenceState } from "./weaponAutoSpool";
import { avgHitDamageMultiplier } from "./damageCalc";
import type { AttachedAttackTickProfile, HitLocationDamageProfile } from "./damageCalc";
import type { TimedConditionalDamageStack } from "./damageCalc";
import type { NonCriticalHitDamageProc } from "../catalog/modCatalog";
import {
    filterExternalStatusTypesForTarget,
    isUniqueStatusType,
    type ExternalStatusType,
    unionUniqueStatusTypes,
} from "./uniqueStatusRules";

export type TargetDamagePool = "overguard" | "shields" | "health";

export interface DirectTargetDamageInput {
    /** Quantized damage for one projectile/attack before crit and multishot. */
    damageByType: Partial<Record<DamageType, number>>;
    /** Unquantized damage channels before dynamic per-status damage bonuses, when available. */
    rawDamageByType?: Partial<Record<DamageType, number>>;
    /** Unmodded, charge-adjusted base damage total for Damage 3.0 quantization. */
    baseDamageTotal?: number;
    health: number;
    shields: number;
    overguard: number;
    armor: number;
    /** Enemy's unscaled Codex/base armor before level scaling and initial armor clamps. */
    baseArmorValue?: number;
    /** Enemy armor level multiplier used to derive current armor from base armor. */
    armorLevelMultiplier?: number;
    /** Remaining armor multiplier after any already active Heat/Corrosive strips. */
    armorDamageReductionMultiplier?: number;
    /** Permanent base armor removed on each qualifying Impact melee hit. */
    shatteringImpactBaseArmorPerHit?: number;
    faction: string;
    /** Faction damage mods, applied to all damage dealt to the named faction. */
    factionDamageBonus?: number;
    /** Viral status bonus to Health damage (0–3.25). */
    viralHealthDamageBonus?: number;
    /** Magnetic status bonus to Shield/Overguard damage (0–3.25). */
    magneticDefenseDamageBonus?: number;
    toxinBypassesShields?: boolean;
    /** Selected attack's source-backed damage ramp, if one applies. */
    damageRampRule?: WeaponDamageRampRule;
    /** Per-event override used by timed attack and encounter simulations. */
    damageRampMultiplier?: number;
    /** Expected per-hit multiplier after crit tiers and supported noncritical-hit procs. */
    expectedHitDamageMultiplier?: number;
    /** Wiki-backed target hit-location profile and player's headshot-share assumption. */
    hitLocation?: HitLocationDamageProfile;
    /** Additional direct-damage fraction applied to one projectile per attack. */
    singleProjectileDamageBonus?: number;
    /** Base post-mod critical chance/multiplier for encounter status-state updates. */
    critChance?: number;
    critMultiplier?: number;
    /** Chance to upgrade a landed Primary crit by one tier. */
    critTierEnhancementChance?: number;
    nonCriticalHitDamageProcs?: readonly NonCriticalHitDamageProc[];
    expectedProjectiles?: number;
    /** Expected direct-damage multiplier per attack; defaults to expectedProjectiles. */
    expectedDamageMultiplier?: number;
}

export interface DirectTargetDamageResult {
    /** Initial defense pool(s) receiving this attack. */
    activePool: TargetDamagePool | "shields-and-health";
    damageByPool: Record<TargetDamagePool, number>;
    /** Damage before capping against the amount remaining in each active pool. */
    uncappedDamageByPool: Record<TargetDamagePool, number>;
    totalDamage: number;
}

function armorFromRemainingBase(initialScaledArmor: number, remainingBaseArmor: number, armorLevelMultiplier: number): number {
    return Math.min(
        finiteNonNegative(initialScaledArmor),
        finiteNonNegative(remainingBaseArmor) * finiteNonNegative(armorLevelMultiplier),
    );
}

/**
 * Expected direct damage from one attack against the target's *initial* pools.
 * Damage types are independent: Overguard receives the full bundle while present;
 * otherwise Toxin/True can route to Health while other types hit Shields.
 * Excess damage does not spill from an emptied pool during the same attack.
 *
 * This is a single-attack calculation, not a kill-time or shield-gate simulation.
 */
export function calculateDirectDamageToInitialPools(
    input: DirectTargetDamageInput,
): DirectTargetDamageResult {
    const health = finiteNonNegative(input.health);
    const shields = finiteNonNegative(input.shields);
    const overguard = finiteNonNegative(input.overguard);
    const armor = finiteNonNegative(input.armor) * Math.max(0, finiteNonNegative(input.armorDamageReductionMultiplier ?? 1));
    const projectileCount = finiteNonNegative(input.expectedProjectiles ?? 1);
    const expectedDamageMultiplier = finiteNonNegative(input.expectedDamageMultiplier ?? projectileCount);
    const hitDamageMultiplier = finiteNonNegative(input.expectedHitDamageMultiplier ?? (
        input.critChance !== undefined && input.critMultiplier !== undefined
            ? avgHitDamageMultiplier(
                input.critChance,
                input.critMultiplier,
                input.nonCriticalHitDamageProcs,
                input.hitLocation,
                input.critTierEnhancementChance,
            )
            : 1
    ));
    const damageRampMultiplier = finiteNonNegative(
        input.damageRampMultiplier ?? getInitialDamageRampMultiplier(input.damageRampRule),
    );
    const factionMultiplier = Math.max(0, 1 + finiteSigned(input.factionDamageBonus ?? 0));
    const viralMultiplier = Math.max(0, 1 + finiteSigned(input.viralHealthDamageBonus ?? 0));
    const magneticMultiplier = Math.max(0, 1 + finiteSigned(input.magneticDefenseDamageBonus ?? 0));
    const healthArmorMultiplier = enemyArmorDamageMultiplier(armor);
    const uncappedDamageByPool: Record<TargetDamagePool, number> = {
        overguard: 0,
        shields: 0,
        health: 0,
    };

    for (const type of DAMAGE_TYPES) {
        const baseDamage = finiteNonNegative(input.damageByType[type] ?? 0) * damageRampMultiplier;
        if (baseDamage <= 0) continue;

        if (overguard > 0) {
            const overguardTypeMultiplier = type === "void" ? 1.5 : 1;
            uncappedDamageByPool.overguard += baseDamage * overguardTypeMultiplier * magneticMultiplier * factionMultiplier;
            continue;
        }

        const bypassesShields = type === "true" || (type === "toxin" && input.toxinBypassesShields !== false);
        if (shields > 0 && !bypassesShields) {
            // Damage 3.0 faction type modifiers apply to Health. Shields remain
            // neutral to those modifiers; Magnetic status is a separate multiplier.
            uncappedDamageByPool.shields += baseDamage * magneticMultiplier * factionMultiplier;
            continue;
        }

        const typeMultiplier = type === "true"
            ? 1
            : Math.max(0, 1 + factionDamageTypeModifier(input.faction, type));
        const healthDamageBeforeCrit = baseDamage * typeMultiplier * viralMultiplier;
        const healthDamageAfterArmor = type === "true"
            ? healthDamageBeforeCrit
            : armor > 0
                ? Math.max(1, healthDamageBeforeCrit * healthArmorMultiplier)
                : healthDamageBeforeCrit;
        uncappedDamageByPool.health += healthDamageAfterArmor * factionMultiplier;
    }

    // Some source-verified mods add damage to one projectile rather than every
    // multishot projectile. Keep that one-hit contribution separate from the
    // ordinary attack multiplier, then apply the same crit/ramp/target rules.
    const expectedScale = (
        expectedDamageMultiplier + finiteNonNegative(input.singleProjectileDamageBonus ?? 0)
    ) * hitDamageMultiplier;
    for (const pool of TARGET_POOLS) {
        uncappedDamageByPool[pool] *= expectedScale;
    }

    const damageByPool = {
        overguard: Math.min(overguard, uncappedDamageByPool.overguard),
        shields: Math.min(shields, uncappedDamageByPool.shields),
        health: Math.min(health, uncappedDamageByPool.health),
    };
    const activePool: DirectTargetDamageResult["activePool"] = overguard > 0
        ? "overguard"
        : shields > 0 && uncappedDamageByPool.health > 0
            ? "shields-and-health"
            : shields > 0
                ? "shields"
                : "health";

    return {
        activePool,
        damageByPool,
        uncappedDamageByPool,
        totalDamage: damageByPool.overguard + damageByPool.shields + damageByPool.health,
    };
}

export interface DirectAttackSequenceInput extends DirectTargetDamageInput {
    /** Hit behavior during the short enemy Shield Gate. Defaults to an ordinary body hit. */
    enemyShieldGateHitMode?: "body" | "weakspot" | "blockedArea";
    /** Effective time between attack events. The first attack occurs at t=0. */
    attackIntervalSeconds: number;
    /** Number of attack events available before each reload-like interruption. */
    shotsPerMagazine?: number;
    /** Stop after this many attack events when a selected form has finite separate ammunition. */
    attackCountLimit?: number;
    /** Treat ammunition as infinite, suppress magazine reloads, and ignore first-shot magazine bonuses. */
    infiniteAmmoActive?: boolean;
    /** Multiplicative bonus for the first ammo-consuming shot in every magazine. */
    firstShotMagazineDamageBonus?: number;
    /** Last-shot bonus applied to one hit; divided across the expected projectiles in that attack. */
    lastShotMagazineDamageBonus?: number;
    /** Reload time added after a full magazine, before the next attack interval. */
    reloadDurationSeconds?: number;
    /** Number of damage events in each burst, when this attack has burst metadata. */
    burstCount?: number;
    /** Delay between shots inside a burst, after fire-rate modifiers. */
    burstDelaySeconds?: number;
    /** Burst-start frequency, after fire-rate modifiers. */
    burstCycleRate?: number;
    /** Wiki-backed Auto-Spool fire-rate cadence for this selected attack. */
    autoSpoolCadenceRule?: WeaponAutoSpoolCadenceRule;
    /** Wiki-backed per-shot projectile and ammo ramp for this selected attack. */
    autoSpoolShotSequenceRule?: WeaponAutoSpoolShotSequenceRule;
    /** Combo consumption/recovery for repeated selected Heavy Attacks. */
    heavyAttackCombo?: {
        /** Combo points available before the first hit. */
        startingPoints: number;
        /** Combo tier represented by the supplied damage and crit inputs. */
        startingMultiplier: number;
        pointsPerTier: number;
        maxMultiplier: number;
        heavyAttackEfficiency: number;
        /** Initial Combo cap that can be replenished after each Heavy Attack. */
        initialComboPoints: number;
        /** Combo-derived crit chance at the starting tier, including fixed bonuses. */
        startingCritChance: number;
        /** Added crit chance per tier from effects such as Blood Rush. */
        critChancePerTier: number;
        /** Crit multiplier at the starting tier, including fixed target-status bonuses. */
        critDamageMultiplier: number;
        /** Current Wiki rate for spent Initial Combo points. */
        initialComboRegenPerSecond?: number;
    };
}

export interface DirectAttackSequenceResult {
    /** Mean-damage attack events required to deplete all target pools, or null if impossible. */
    attacksToKill: number | null;
    /** Time from the first attack event to the killing event, or null if impossible. */
    timeToKillSeconds: number | null;
    /** Actual pool damage applied over the sequence; excess damage never spills between pools. */
    damageByPool: Record<TargetDamagePool, number>;
    remainingPools: Record<TargetDamagePool, number>;
    /** Permanent base armor remaining after Shattering Impact, before temporary Heat/Corrosive strips. */
    remainingArmorAfterBaseStrip: number;
    /** True when the target survived after a source-defined finite attack capacity was spent. */
    attackCountLimitReached: boolean;
    /** Heavy-attack combo tier at the first event, when combo consumption is modeled. */
    comboMultiplierAtStart?: number;
    /** Heavy-attack combo tier at the killing event, when combo consumption is modeled. */
    comboMultiplierAtKill?: number;
}

export interface ExpectedWeaponEncounterInput extends DirectTargetDamageInput {
    /** Effective time between trigger pulls. The first attack occurs at t=0. */
    attackIntervalSeconds: number;
    /** Number of attacks before a reload-like interruption. */
    shotsPerMagazine?: number;
    /** Stop after this many attack events when a selected form has finite separate ammunition. */
    attackCountLimit?: number;
    /** Treat ammunition as infinite, suppress magazine reloads, and ignore first-shot magazine bonuses. */
    infiniteAmmoActive?: boolean;
    /** Multiplicative bonus for the first ammo-consuming shot in every magazine. */
    firstShotMagazineDamageBonus?: number;
    /** Last-shot bonus applied to one hit; divided across the expected projectiles in that attack. */
    lastShotMagazineDamageBonus?: number;
    /** Reload time after each full magazine. */
    reloadDurationSeconds?: number;
    /** Number of damage events in each burst, when this attack has burst metadata. */
    burstCount?: number;
    /** Delay between shots inside a burst, after fire-rate modifiers. */
    burstDelaySeconds?: number;
    /** Burst-start frequency, after fire-rate modifiers. */
    burstCycleRate?: number;
    /** Wiki-backed Auto-Spool fire-rate cadence for this selected attack. */
    autoSpoolCadenceRule?: WeaponAutoSpoolCadenceRule;
    /** Wiki-backed per-shot projectile and ammo ramp for this selected attack. */
    autoSpoolShotSequenceRule?: WeaponAutoSpoolShotSequenceRule;
    /** Hit behavior during the short enemy Shield Gate. Defaults to an ordinary body hit. */
    enemyShieldGateHitMode?: "body" | "weakspot" | "blockedArea";
    /** Status duration multiplier used when resolving the build's DoT totals. */
    statusDurationMultiplier?: number;
    /** Permanent target-side Status Damage vulnerability after a Hate hit on a Heat-afflicted target. */
    targetStatusDamageVulnerabilityBonus?: number;
    /** Probability that an external Heat status is active before the first attack. */
    initialHeatStatusPresenceProbability?: number;
    /** Maximum pool values for effects based on the target's starting defenses. */
    maxShields?: number;
    maxOverguard?: number;
    /** Additional same-profile enemies assumed inside Blast's 5m cap/death radial. */
    nearbyBlastEnemyCount?: number;
    /** Additional same-profile enemies assumed inside active Electricity/Gas radii. */
    nearbyElectricGasEnemyCount?: number;
    /** Additional Gas neighbors in the 3–6m annulus; coverage is uniform by area. */
    nearbyGasOuterEnemyCount?: number;
    /** Expected full-lifetime DoT damage seeded by one attack, by status type. */
    dotDamagePerAttackByType?: Partial<Record<StatusDamageType, number>>;
    /** Expected full-lifetime DoT damage from one application, by status type. */
    dotDamagePerApplicationByType?: Partial<Record<StatusDamageType, number>>;
    /** Full-lifetime weapon-seed damage per application before Condition Overload. */
    dotSeedDamagePerApplicationByType?: Partial<Record<StatusDamageType, number>>;
    /** Full-lifetime +1 accumulator share per application; this portion is not Condition Overload-scaled. */
    dotAccumulatorDamagePerApplicationByType?: Partial<Record<StatusDamageType, number>>;
    /** Seed-only damage from one Heat application, before the grouped +1 accumulator. */
    heatDotTickDamagePerProc?: number;
    /** The +1 accumulator's per-tick damage while an expected Heat group is active. */
    heatDotAccumulatorDamagePerTick?: number;
    /** Heat seed tick when a still-active external first Heat source supplies the inherited bonuses. */
    heatDotTickDamagePerProcWhenExternallyInherited?: number;
    /** Heat +1 accumulator tick when a still-active external first Heat source supplies inherited bonuses. */
    heatDotAccumulatorDamagePerTickWhenExternallyInherited?: number;
    /** Ogris Nightwatch Napalm's six fixed Heat ticks and independent 68% Heat proc rolls. */
    nightwatchNapalm?: {
        directDamagePerProjectilePerTick: number;
        heatProcChancePerTick: number;
        heatStatusDurationSeconds: number;
        heatDotDamagePerProcPerTick: number;
        heatDotAccumulatorDamagePerTick: number;
        heatDotDamagePerProcPerTickWhenExternallyInherited?: number;
        heatDotAccumulatorDamagePerTickWhenExternallyInherited?: number;
    };
    /** Source-backed direct-damage ticks attached to each selected attack projectile. */
    attachedAttackDamageSequence?: {
        rule: WeaponAttackLingeringDamageRule;
        profile: AttachedAttackTickProfile;
    };
    /** Expected ordinary status applications per attack when dynamic proc weights are unavailable. */
    expectedStatusApplicationsPerAttackByType?: Partial<Record<StatusDamageType, number>>;
    /** Quantized final damage weights used to recalculate proc weighting as pools change. */
    statusProcWeightsByType?: Partial<Record<StatusDamageType, number>>;
    /** Expected ordinary status rolls per attack (multishot × status chance). */
    statusRollsPerAttack?: number;
    /** Forced and status-triggered applications, independent of ordinary proc weighting. */
    forcedStatusApplicationsPerAttackByType?: Partial<Record<StatusDamageType, number>>;
    /** Target status immunities and encounter-specific stack caps, including the VIP Puncture limit. */
    statusImmuneTypes?: Iterable<StatusDamageType>;
    statusStackCaps?: Partial<Record<StatusDamageType, number>>;
    /** Legacy expected single-stack expiry damage seeded by one attack. */
    blastDamagePerAttack?: number;
    /** Recorded pre-target-defense hit damage (H) for one Blast proc. */
    blastStackHitDamagePerProc?: number;
    /** Source-side multipliers for Magnetic's forced Electricity proc on pool break. */
    magneticBreakElectricSourceMultiplier?: number;
    /** Base Damage-bracket bonus for per-status effects such as Condition Overload. */
    directDamagePerStatusBonus?: number;
    /** Condition Overload's additive base Damage-bracket bonus per pre-existing status type. */
    conditionOverloadDamagePerStatusBonus?: number;
    /** Distinct additional externally maintained status types that remain active before each hit. */
    externalConditionOverloadStatusTypeCount?: number;
    /** Named external statuses assumed active before each hit throughout the encounter. */
    externalStatusTypes?: readonly ExternalStatusType[];
    /** Guaranteed unique non-damage statuses applied by each attack, such as Nukor's Microwave. */
    uniqueStatusProcsPerAttack?: readonly WeaponUniqueStatusType[];
    /** Weapon passive's per-status direct-hit bonus, if any. */
    intrinsicDamagePerStatusBonus?: number;
    /** Whether the weapon passive adds to or multiplies the ordinary base-damage bracket. */
    intrinsicDamagePerStatusMode?: "additiveBase" | "multiplicativeBase";
    /** Existing additive base Damage bracket before per-status bonuses. */
    totalDamageBonus?: number;
    /** Weapon hit-triggered additive damage stacks, advanced at attack events in order. */
    timedConditionalDamageStacks?: readonly TimedConditionalDamageStack[];
    /** Hard stops keep malformed profiles from running unbounded simulations. */
    maxDurationSeconds?: number;
    /** Stop before any event at or after this time; used for half-open fixed windows. */
    stopAtSeconds?: number;
    maxAttacks?: number;
}

export interface ExpectedWeaponEncounterResult {
    attacks: number;
    /** True when the target survived after a source-defined finite attack capacity was spent. */
    attackCountLimitReached: boolean;
    timeToKillSeconds: number | null;
    evaluatedDurationSeconds: number;
    directDamageByPool: Record<TargetDamagePool, number>;
    statusDamageByPool: Record<TargetDamagePool, number>;
    statusApplicationsByType: Partial<Record<StatusDamageType, number>>;
    /** Aggregate damage delivered to configured nearby targets by Blast radial events only. */
    blastCollateralDamageByPool: Record<TargetDamagePool, number>;
    blastCollateralEnemyCount: number;
    /** Aggregate Electricity/Gas tick damage delivered to configured nearby targets. */
    electricGasCollateralDamageByPool: Record<TargetDamagePool, number>;
    electricGasCollateralEnemyCount: number;
    remainingPools: Record<TargetDamagePool, number>;
    /** Permanent base armor remaining after Shattering Impact, before temporary Heat/Corrosive strips. */
    remainingArmorAfterBaseStrip: number;
    totalDamage: number;
    damagePerAttack: number;
    damagePerSecond: number;
}

interface ScheduledStatusTick {
    time: number;
    sequence: number;
    type: StatusDamageType | "coldFreezeEnd" | "nightwatchNapalm" | "attachedAttackDamage";
    damage: number;
    /** Heat stacks share one refreshable tick stream; resolve its damage when the tick lands. */
    dynamicHeat?: boolean;
    /** Expected overlapping blaze count for this Nightwatch Napalm tick. */
    napalmProjectiles?: number;
    /** Profile for a delayed direct-damage tick attached to an earlier attack. */
    attachedAttackDamageProfile?: AttachedAttackTickProfile;
}

interface HeatStatusApplicationOverride {
    durationSeconds: number;
    tickDamagePerProc: number;
    accumulatorDamagePerTick: number;
    tickDamagePerProcWhenExternallyInherited?: number;
    accumulatorDamagePerTickWhenExternallyInherited?: number;
}

interface HeatInheritanceState {
    expiresAt: number;
    durationSeconds: number;
    /** Probability that the original source was external and remains the inherited source. */
    externalSourceProbability: number;
}

interface GasCloudTickGroup {
    activeStacks: number;
    damagePerStackPerTick: number;
    scheduledTicks: ScheduledStatusTick[];
}

interface ExpectedBlastStackEntry {
    expiresAt: number;
    stacks: number;
    hitDamagePerStack: number;
    expiryDamagePerStack: number;
    sequence: number | null;
}

interface ExpectedStatusStackEntry {
    expiresAt: number;
    stacks: number;
    /** Probability this expected stack entry represents an active proc event. */
    presenceProbability: number;
    /** Gas stacks own independent clouds and replace the oldest stack at cap. */
    gasCloud?: GasCloudTickGroup;
}

interface ExpectedStatusStackQueue {
    entries: ExpectedStatusStackEntry[];
    head: number;
    totalStacks: number;
    logProbabilityNoneActive: number;
    guaranteedPresenceEntries: number;
}

interface TimedDamageStackState {
    stacks: number;
    nextDecayAt: number;
    probability: number;
}

interface TimedDamageStackRuntime {
    rule: TimedConditionalDamageStack;
    states: Map<string, TimedDamageStackState>;
}

function timedDamageStackStateKey(stacks: number, nextDecayAt: number): string {
    return `${stacks}:${Number.isFinite(nextDecayAt) ? nextDecayAt.toFixed(9) : "inf"}`;
}

function addTimedDamageStackState(
    states: Map<string, TimedDamageStackState>,
    state: TimedDamageStackState,
): void {
    if (state.probability <= 1e-15) return;
    const key = timedDamageStackStateKey(state.stacks, state.nextDecayAt);
    const previous = states.get(key);
    if (previous) previous.probability += state.probability;
    else states.set(key, state);
}

function createTimedDamageStackRuntime(rule: TimedConditionalDamageStack): TimedDamageStackRuntime | null {
    const maxStacks = Math.max(0, Math.floor(finiteNonNegative(rule.maxStacks)));
    const durationSeconds = finiteNonNegative(rule.durationSeconds);
    if (maxStacks <= 0 || durationSeconds <= 0 || !Number.isFinite(rule.damageBonusPerStack)) return null;
    const initialStacks = Math.max(0, Math.min(maxStacks, Math.floor(finiteNonNegative(rule.initialStacks))));
    const states = new Map<string, TimedDamageStackState>();
    addTimedDamageStackState(states, {
        stacks: initialStacks,
        nextDecayAt: initialStacks > 0 ? durationSeconds : Number.POSITIVE_INFINITY,
        probability: 1,
    });
    return { rule: { ...rule, maxStacks, durationSeconds, initialStacks }, states };
}

function advanceTimedDamageStackRuntime(runtime: TimedDamageStackRuntime, time: number): number {
    const advanced = new Map<string, TimedDamageStackState>();
    let expectedStacks = 0;
    for (const state of runtime.states.values()) {
        let stacks = state.stacks;
        let nextDecayAt = state.nextDecayAt;
        while (stacks > 0 && nextDecayAt <= time + 1e-9) {
            stacks -= 1;
            nextDecayAt += runtime.rule.durationSeconds;
        }
        if (stacks <= 0) nextDecayAt = Number.POSITIVE_INFINITY;
        const updated = { stacks, nextDecayAt, probability: state.probability };
        addTimedDamageStackState(advanced, updated);
        expectedStacks += stacks * state.probability;
    }
    runtime.states = advanced;
    return expectedStacks;
}

function recordTimedDamageStackTrigger(runtime: TimedDamageStackRuntime, time: number): void {
    const triggerProbability = Math.max(0, Math.min(1, finiteNonNegative(runtime.rule.qualifyingHitGroupProbability)));
    if (triggerProbability <= 0) return;
    const triggered = new Map<string, TimedDamageStackState>();
    for (const state of runtime.states.values()) {
        addTimedDamageStackState(triggered, { ...state, probability: state.probability * (1 - triggerProbability) });
        if (triggerProbability >= 1 || state.stacks < runtime.rule.maxStacks) {
            addTimedDamageStackState(triggered, {
                stacks: Math.min(runtime.rule.maxStacks, state.stacks + 1),
                nextDecayAt: time + runtime.rule.durationSeconds,
                probability: state.probability * triggerProbability,
            });
        }
        // A successful qualifying hit at the stack cap still refreshes its decay timer.
        else {
            addTimedDamageStackState(triggered, {
                stacks: state.stacks,
                nextDecayAt: time + runtime.rule.durationSeconds,
                probability: state.probability * triggerProbability,
            });
        }
    }
    runtime.states = triggered;
}

function addStatusPresence(queue: ExpectedStatusStackQueue, presenceProbability: number): void {
    const probability = clampProbability(presenceProbability);
    if (probability >= 1) {
        queue.guaranteedPresenceEntries++;
    } else {
        queue.logProbabilityNoneActive += Math.log1p(-probability);
    }
}

function removeStatusPresence(queue: ExpectedStatusStackQueue, presenceProbability: number): void {
    const probability = clampProbability(presenceProbability);
    if (probability >= 1) {
        queue.guaranteedPresenceEntries = Math.max(0, queue.guaranteedPresenceEntries - 1);
    } else {
        queue.logProbabilityNoneActive -= Math.log1p(-probability);
    }
}

function expectedStatusPresence(queue: ExpectedStatusStackQueue): number {
    return queue.guaranteedPresenceEntries > 0
        ? 1
        : 1 - Math.exp(queue.logProbabilityNoneActive);
}

interface HeatArmorStripState {
    firstAppliedAt: number;
    lastAppliedAt: number;
    durationSeconds: number;
    /** Mean-field probability/intensity that at least one Heat proc is active. */
    activeWeight: number;
}

interface HeatDotState {
    /** All same-source Heat stacks share and refresh this expiration time. */
    expiresAt: number;
    /** Heat ticks remain on one-second cadence while refreshed. */
    nextTickAt: number;
    /** Combined per-tick damage from the currently active Heat stacks. */
    tickDamage: number;
    /** One consolidated +1 accumulator contribution for the active tick group. */
    accumulatorDamage: number;
}

/**
 * Deterministic expected-value encounter estimate for repeated attacks and their
 * scheduled status ticks. It preserves event order and current pool depletion,
 * and can accumulate expected Viral, Corrosive, Magnetic, Cold, Puncture, and
 * Tau stacks between attacks. Tau vulnerability boosts later ordinary rolls for
 * other status types, while forced applications stay independent. Fractional
 * expected stacks are a mean-field estimate, not random rolls. Heat armor strip
 * uses its documented ramp/decay timeline; same-source Heat DoT refresh/stacking
 * is one shared tick stream. Simultaneous Electricity ticks share one pulse
 * while keeping their timers. Configured Electricity/Gas ticks deplete separate
 * same-profile pools, and Gas continues after the host dies; at Gas cap, old
 * stack tick events are reduced with oldest-stack replacement. A configured
 * initial external Heat source supplies its inherited Heat/faction bonuses to
 * later Heat DoTs while its status remains active. This uses expected-value
 * source probabilities and does not simulate the external source's damage or
 * armor-strip history, or later independent sources. Neighbor status/position
 * histories, attenuation, and TTK distributions are also not simulated;
 * outer-ring Gas exposure is an area-uniform expectation.
 * Enemy Shield Gates reduce direct
 * Health damage for a short window; scheduled status ticks remain ungated.
 */
export function simulateExpectedWeaponEncounter(
    input: ExpectedWeaponEncounterInput,
): ExpectedWeaponEncounterResult {
    const remainingPools = {
        overguard: finiteNonNegative(input.overguard),
        shields: finiteNonNegative(input.shields),
        health: finiteNonNegative(input.health),
    };
    const initialHealth = remainingPools.health;
    const initialArmor = finiteNonNegative(input.armor);
    const armorLevelMultiplier = finiteNonNegative(input.armorLevelMultiplier ?? 1);
    let remainingBaseArmor = finiteNonNegative(input.baseArmorValue ?? initialArmor);
    let armorAfterBaseStrip = initialArmor;
    const maximumShields = finiteNonNegative(input.maxShields ?? remainingPools.shields);
    const maximumOverguard = finiteNonNegative(input.maxOverguard ?? remainingPools.overguard);
    const directDamageByPool = zeroPools();
    const statusDamageByPool = zeroPools();
    const blastCollateralDamageByPool = zeroPools();
    const electricGasCollateralDamageByPool = zeroPools();
    const { innerCount: nearbyElectricGasEnemyCount, outerCount: nearbyGasOuterEnemyCount } =
        normalizeElectricGasNeighborCounts(input.nearbyElectricGasEnemyCount, input.nearbyGasOuterEnemyCount);
    const electricGasCollateralEnemyCount = nearbyElectricGasEnemyCount + nearbyGasOuterEnemyCount;
    const electricGasCollateralTargets = Array.from({ length: nearbyElectricGasEnemyCount }, () => ({
        overguard: finiteNonNegative(input.overguard),
        shields: finiteNonNegative(input.shields),
        health: finiteNonNegative(input.health),
    }));
    const gasOuterCollateralTargets = Array.from({ length: nearbyGasOuterEnemyCount }, () => ({
        overguard: finiteNonNegative(input.overguard),
        shields: finiteNonNegative(input.shields),
        health: finiteNonNegative(input.health),
    }));
    const blastCollateralEnemyCount = Number.isFinite(input.nearbyBlastEnemyCount)
        ? Math.max(0, Math.min(20, Math.floor(input.nearbyBlastEnemyCount ?? 0)))
        : 0;
    const blastCollateralTargets = Array.from({ length: blastCollateralEnemyCount }, () => ({
        overguard: finiteNonNegative(input.overguard),
        shields: finiteNonNegative(input.shields),
        health: finiteNonNegative(input.health),
    }));
    const statusApplicationsByType: Partial<Record<StatusDamageType, number>> = {};
    const attackInterval = finiteNonNegative(input.attackIntervalSeconds);
    const reloadDuration = input.infiniteAmmoActive ? 0 : finiteNonNegative(input.reloadDurationSeconds ?? 0);
    const shotsPerMagazine = input.infiniteAmmoActive
        ? Number.MAX_SAFE_INTEGER
        : Number.isFinite(input.shotsPerMagazine)
            ? Math.max(1, Math.floor(input.shotsPerMagazine ?? 1))
            : Number.MAX_SAFE_INTEGER;
    const maxDurationSeconds = Number.isFinite(input.maxDurationSeconds)
        ? Math.max(0, input.maxDurationSeconds ?? 0)
        : 600;
    const stopAtSeconds = Number.isFinite(input.stopAtSeconds)
        ? Math.min(maxDurationSeconds, Math.max(0, input.stopAtSeconds ?? 0))
        : null;
    const maxAttacks = Number.isFinite(input.maxAttacks)
        ? Math.max(0, Math.floor(input.maxAttacks ?? 0))
        : 20_000;
    const attackCountLimit = Number.isFinite(input.attackCountLimit)
        ? Math.max(0, Math.floor(input.attackCountLimit ?? 0))
        : Number.MAX_SAFE_INTEGER;
    const maxSimulatedAttacks = Math.min(maxAttacks, attackCountLimit);
    const ticks: ScheduledStatusTick[] = [];
    const groupedElectricTicks = new Map<number, ScheduledStatusTick>();
    const statusImmuneTypes = new Set(input.statusImmuneTypes ?? []);
    const statusStackQueues = new Map<StatusDamageType, ExpectedStatusStackQueue>();
    const externalStatusTypes = filterExternalStatusTypesForTarget(
        input.externalStatusTypes,
        statusImmuneTypes,
        input.statusStackCaps,
    );
    const externalStatusTypeSet = new Set(externalStatusTypes);
    const activeUniqueStatusTypes = unionUniqueStatusTypes(externalStatusTypes.filter(isUniqueStatusType));
    const blastStackEntries: ExpectedBlastStackEntry[] = [];
    const cancelledTickSequences = new Set<number>();
    const heatArmorStripState: { current: HeatArmorStripState | null } = { current: null };
    const heatDotState: { current: HeatDotState | null } = { current: null };
    const heatInheritanceState: { current: HeatInheritanceState | null } = { current: null };
    let coldFreezeUntil: number | null = null;
    let enemyShieldGateUntil = Number.NEGATIVE_INFINITY;
    let nextTickSequence = 0;
    let attackIndex = 0;
    let attacks = 0;
    let now = 0;
    let killed = allPoolsEmpty(remainingPools);
    let primaryKilledAt = killed ? 0 : null;
    const durationMultiplier = Math.max(0, finiteNonNegative(input.statusDurationMultiplier ?? 1));
    const targetStatusDamageVulnerabilityBonus = finiteNonNegative(input.targetStatusDamageVulnerabilityBonus ?? 0);
    let targetStatusDamageVulnerabilityActiveProbability = 0;
    let previousRampAttackTime: number | null = null;
    let activeDamageRampMultiplier = getInitialDamageRampMultiplier(input.damageRampRule);
    const timedDamageStacks = (input.timedConditionalDamageStacks ?? [])
        .map(createTimedDamageStackRuntime)
        .filter((runtime): runtime is TimedDamageStackRuntime => runtime !== null);

    const initialHeatPresenceProbability = clampProbability(input.initialHeatStatusPresenceProbability ?? 0);
    if (initialHeatPresenceProbability > 0 && durationMultiplier > 0) {
        const initialHeatDurationSeconds = STATUS_EFFECT_RULES.heat.durationSeconds * durationMultiplier;
        const heatQueue: ExpectedStatusStackQueue = {
            entries: [{
                expiresAt: initialHeatDurationSeconds,
                stacks: initialHeatPresenceProbability,
                presenceProbability: initialHeatPresenceProbability,
            }],
            head: 0,
            totalStacks: initialHeatPresenceProbability,
            logProbabilityNoneActive: 0,
            guaranteedPresenceEntries: 0,
        };
        addStatusPresence(heatQueue, initialHeatPresenceProbability);
        statusStackQueues.set("heat", heatQueue);
        heatInheritanceState.current = {
            expiresAt: initialHeatDurationSeconds,
            durationSeconds: initialHeatDurationSeconds,
            externalSourceProbability: initialHeatPresenceProbability,
        };
    }

    const activeStatusDamageMultiplier = (): number =>
        1 + targetStatusDamageVulnerabilityBonus * targetStatusDamageVulnerabilityActiveProbability;

    const activateTargetStatusDamageVulnerability = () => {
        if (targetStatusDamageVulnerabilityBonus <= 0) return;
        const heatQueue = statusStackQueues.get("heat");
        if (!heatQueue || heatQueue.totalStacks <= 0) return;
        const heatPresence = expectedStatusPresence(heatQueue);
        targetStatusDamageVulnerabilityActiveProbability +=
            (1 - targetStatusDamageVulnerabilityActiveProbability) * heatPresence;
        targetStatusDamageVulnerabilityActiveProbability = clampProbability(
            targetStatusDamageVulnerabilityActiveProbability,
        );
    };

    const scheduleStatusTick = (time: number, type: StatusDamageType, damage: number) => {
        if (type === "electricity") {
            // The current Wiki says simultaneous Electricity instances resolve
            // as one damage pulse per second while keeping separate timers.
            const groupedTick = groupedElectricTicks.get(time);
            if (groupedTick) {
                groupedTick.damage += damage;
                return;
            }
            const tick = { time, sequence: nextTickSequence++, type, damage } satisfies ScheduledStatusTick;
            groupedElectricTicks.set(time, tick);
            heapPush(ticks, tick);
            return;
        }
        heapPush(ticks, { time, sequence: nextTickSequence++, type, damage });
    };

    const stackCount = (type: StatusDamageType): number => statusStackQueues.get(type)?.totalStacks ?? 0;
    const expectedTauStackCount = (): number =>
        Math.min(10, stackCount("tau") + (externalStatusTypeSet.has("tau") ? 1 : 0));
    const ordinaryStatusChanceMultiplier = (): number =>
        1 + Math.min(1, expectedTauStackCount() * 0.1);
    const updateGasCloudActiveStacks = (group: GasCloudTickGroup, activeStacks: number) => {
        group.activeStacks = finiteNonNegative(activeStacks);
        for (const tick of group.scheduledTicks) {
            tick.damage = group.damagePerStackPerTick * group.activeStacks;
        }
    };

    const finishColdFreeze = (time: number) => {
        if (coldFreezeUntil === null || time < coldFreezeUntil - 1e-9) return;
        const freezeEnd = coldFreezeUntil;
        coldFreezeUntil = null;
        const queue = statusStackQueues.get("cold");
        if (!queue) return;
        // The current Wiki specifies three residual stacks after the freeze. It
        // does not specify their remaining timers, so use one fresh Cold duration.
        const residualStacks = STATUS_EFFECT_RULES.cold.residualStacksAfterFreeze ?? 3;
        if (residualStacks <= 0 || durationMultiplier <= 0) {
            statusStackQueues.delete("cold");
            return;
        }
        queue.entries = [{
            expiresAt: freezeEnd + STATUS_EFFECT_RULES.cold.durationSeconds * durationMultiplier,
            stacks: residualStacks,
            presenceProbability: 1,
        }];
        queue.head = 0;
        queue.totalStacks = residualStacks;
        queue.logProbabilityNoneActive = 0;
        queue.guaranteedPresenceEntries = 1;
    };

    const expireStatusStacks = (time: number) => {
        finishColdFreeze(time);
        for (const [type, queue] of statusStackQueues) {
            while (queue.head < queue.entries.length && queue.entries[queue.head].expiresAt <= time + 1e-9) {
                const expiredEntry = queue.entries[queue.head];
                queue.totalStacks = Math.max(0, queue.totalStacks - expiredEntry.stacks);
                removeStatusPresence(queue, expiredEntry.presenceProbability);
                queue.head++;
            }
            if (queue.head > 128 && queue.head * 2 > queue.entries.length) {
                queue.entries.splice(0, queue.head);
                queue.head = 0;
            }
            if (queue.totalStacks <= 1e-9 && queue.head === queue.entries.length) {
                statusStackQueues.delete(type);
            }
        }
        for (let index = blastStackEntries.length - 1; index >= 0; index--) {
            if (blastStackEntries[index].expiresAt <= time + 1e-9) blastStackEntries.splice(index, 1);
        }
    };

    const applyBlastCollateral = (entries: ExpectedBlastStackEntry[] = blastStackEntries) => {
        if (blastCollateralTargets.length === 0 || entries.length === 0) return;
        const recordedHitDamage = entries.reduce((sum, entry) => Math.fround(
            Math.fround(sum) + Math.fround(Math.fround(entry.stacks) * Math.fround(entry.hitDamagePerStack)),
        ), Math.fround(0));
        const radialDamage = blastStackCapDetonationDamage(recordedHitDamage);
        if (radialDamage <= 0) return;

        // Nearby targets have independent defenses and no inherited status state.
        // The recorded Blast seed already includes source-side faction/Status
        // Damage modifiers; only the victim's Blast type/armor rules apply here.
        const radialInput = {
            ...input,
            viralHealthDamageBonus: 0,
            magneticDefenseDamageBonus: 0,
        };
        for (const targetPools of blastCollateralTargets) {
            if (allPoolsEmpty(targetPools)) continue;
            const damage = applyStatusTickToPools(radialInput, targetPools, "blast", radialDamage);
            addPools(blastCollateralDamageByPool, damage);
            subtractPools(targetPools, damage);
        }
    };
    const resolveBlastDeathRadial = () => {
        applyBlastCollateral();
        for (const entry of blastStackEntries) {
            if (entry.sequence !== null) cancelledTickSequences.add(entry.sequence);
        }
        blastStackEntries.length = 0;
        statusStackQueues.delete("blast");
    };

    const projectStatusSequence = (currentProjectileCount: number, includeProjectilePresence = false, statusInput: ExpectedWeaponEncounterInput = input) => {
        const ordinaryApplications: Partial<Record<StatusDamageType, number>> = {};
        const ordinaryPresenceProbabilities: Partial<Record<StatusDamageType, number>> = {};
        const perProjectilePresence: Array<Partial<Record<StatusDamageType, number>>> = [];
        const hasCatalogStatusInputs =
            statusInput.statusProcWeightsByType !== undefined && statusInput.statusRollsPerAttack !== undefined;
        if (!hasCatalogStatusInputs || currentProjectileCount <= 0) {
            return { ordinaryApplications, ordinaryPresenceProbabilities, perProjectilePresence };
        }

        const immuneTypes = new Set(statusImmuneTypes);
        // Radiation can still be applied under Overguard; its effects remain
        // suppressed until the Overguard pool is removed. Magnetic has no
        // defensive effect once both Overguard and Shields are gone.
        if (remainingPools.overguard <= 0 && remainingPools.shields <= 0) immuneTypes.add("magnetic");
        const totalWeight = STATUS_DAMAGE_TYPES.reduce((sum, type) => {
            if (immuneTypes.has(type)) return sum;
            return sum + finiteNonNegative(statusInput.statusProcWeightsByType?.[type] ?? 0);
        }, 0);
        const rolls = finiteNonNegative(statusInput.statusRollsPerAttack ?? 0);
        if (totalWeight <= 0 || rolls <= 0) {
            return { ordinaryApplications, ordinaryPresenceProbabilities, perProjectilePresence };
        }

        const statusChancePerProjectile = rolls / currentProjectileCount;
        const wholeProjectiles = Math.floor(currentProjectileCount);
        const fractionalProjectile = currentProjectileCount - wholeProjectiles;
        const baseProjectileCount = Math.max(1, finiteNonNegative(statusInput.expectedProjectiles ?? 1));
        const forcedProjectileRatio = statusInput.autoSpoolShotSequenceRule
            ? Math.max(0, currentProjectileCount / baseProjectileCount)
            : 1;
        const forcedApplicationsPerProjectile = Object.fromEntries(
            STATUS_DAMAGE_TYPES.map((type) => [
                type,
                finiteNonNegative(statusInput.forcedStatusApplicationsPerAttackByType?.[type] ?? 0) *
                    forcedProjectileRatio / currentProjectileCount,
            ]),
        ) as Record<StatusDamageType, number>;
        const tauTargetCap = statusInput.statusStackCaps?.tau;
        const tauStackCap = Number.isFinite(tauTargetCap)
            ? Math.max(0, Math.min(STATUS_EFFECT_RULES.tau.maxStacks ?? 10, tauTargetCap ?? 0))
            : STATUS_EFFECT_RULES.tau.maxStacks ?? 10;
        let expectedTauStacks = Math.min(tauStackCap, expectedTauStackCount());
        const tauCanIncreaseBetweenProjectiles =
            !immuneTypes.has("tau") &&
            expectedTauStacks < Math.min(10, tauStackCap) &&
            statusChancePerProjectile > 0 &&
            (finiteNonNegative(statusInput.statusProcWeightsByType?.tau ?? 0) > 0 ||
                forcedApplicationsPerProjectile.tau > 0);

        if (!tauCanIncreaseBetweenProjectiles) {
            const tauVulnerability = 1 + Math.min(1, Math.min(10, expectedTauStacks) * 0.1);
            const projectilePresence = includeProjectilePresence
                ? {} as Partial<Record<StatusDamageType, number>>
                : null;
            for (const type of STATUS_DAMAGE_TYPES) {
                if (immuneTypes.has(type)) continue;
                if (includeProjectilePresence && type === "tau") continue;
                const targetCap = statusInput.statusStackCaps?.[type];
                if (Number.isFinite(targetCap) && (targetCap ?? 0) <= 0) continue;
                const weight = finiteNonNegative(statusInput.statusProcWeightsByType?.[type] ?? 0);
                if (weight <= 0) continue;

                const typeProbability = weight / totalWeight;
                const typeMultiplier = type === "tau" ? 1 : tauVulnerability;
                if (includeProjectilePresence) {
                    const perProjectileOrdinaryPresence = probabilityAtLeastOneWeightedStatusType(
                        1,
                        statusChancePerProjectile,
                        typeProbability,
                        typeMultiplier,
                    );
                    const forcedPresence = Math.min(1, forcedApplicationsPerProjectile[type]);
                    projectilePresence![type] = 1 -
                        (1 - perProjectileOrdinaryPresence) * (1 - forcedPresence);
                } else {
                    ordinaryApplications[type] = rolls * typeProbability * typeMultiplier;
                    ordinaryPresenceProbabilities[type] = probabilityAtLeastOneWeightedStatusType(
                        currentProjectileCount,
                        rolls,
                        typeProbability,
                        typeMultiplier,
                    );
                }
            }
            if (includeProjectilePresence) {
                perProjectilePresence.length = Math.ceil(currentProjectileCount);
                perProjectilePresence.fill(projectilePresence!);
            }
            return { ordinaryApplications, ordinaryPresenceProbabilities, perProjectilePresence };
        }

        // The Wiki says Tau increases Status Chance on subsequent attacks,
        // while Galvanized notes treat multishot instances as sequential hits.
        // Carry the expected Tau stack count from each projectile into the
        // next one. This is a mean-field projection, not a sampled proc history.
        for (let projectileIndex = 0; projectileIndex <= wholeProjectiles; projectileIndex++) {
            const projectileProbability = projectileIndex < wholeProjectiles ? 1 : fractionalProjectile;
            if (projectileProbability <= 0) continue;

            const tauVulnerability = 1 + Math.min(1, Math.min(10, expectedTauStacks) * 0.1);
            const projectilePresence = includeProjectilePresence
                ? {} as Partial<Record<StatusDamageType, number>>
                : null;
            for (const type of STATUS_DAMAGE_TYPES) {
                if (immuneTypes.has(type)) continue;
                if (includeProjectilePresence && type === "tau") continue;
                const targetCap = statusInput.statusStackCaps?.[type];
                if (Number.isFinite(targetCap) && (targetCap ?? 0) <= 0) continue;
                const weight = finiteNonNegative(statusInput.statusProcWeightsByType?.[type] ?? 0);
                if (weight <= 0) continue;

                const typeProbability = weight / totalWeight;
                // Tau vulnerability does not increase Tau applications or
                // forced status effects; it increases the other status types.
                const typeMultiplier = type === "tau" ? 1 : tauVulnerability;
                const projectileStatusPresence = probabilityAtLeastOneWeightedStatusType(
                    1,
                    statusChancePerProjectile,
                    typeProbability,
                    typeMultiplier,
                );
                if (includeProjectilePresence) {
                    const forcedPresence = Math.min(1, forcedApplicationsPerProjectile[type]);
                    projectilePresence![type] = 1 -
                        (1 - projectileStatusPresence) * (1 - forcedPresence);
                } else {
                    ordinaryPresenceProbabilities[type] = 1 -
                        (1 - finiteNonNegative(ordinaryPresenceProbabilities[type] ?? 0)) *
                        (1 - projectileProbability * projectileStatusPresence);
                    ordinaryApplications[type] = finiteNonNegative(ordinaryApplications[type] ?? 0) +
                        projectileProbability * statusChancePerProjectile * typeProbability * typeMultiplier;
                }
            }
            if (includeProjectilePresence) perProjectilePresence[projectileIndex] = projectilePresence!;

            // Tau procs from this projectile only affect the next projectile.
            // Fractional multishot is the final slot, so it has no later hit.
            if (projectileIndex < wholeProjectiles && !immuneTypes.has("tau")) {
                const tauWeight = finiteNonNegative(statusInput.statusProcWeightsByType?.tau ?? 0);
                const tauOrdinaryApplications = statusChancePerProjectile * tauWeight / totalWeight;
                expectedTauStacks = Math.min(
                    tauStackCap,
                    expectedTauStacks + tauOrdinaryApplications + forcedApplicationsPerProjectile.tau,
                );
            }
        }
        return { ordinaryApplications, ordinaryPresenceProbabilities, perProjectilePresence };
    };

    const expectedStatusApplicationsForCurrentPools = (currentProjectileCount: number, statusInput: ExpectedWeaponEncounterInput = input) => {
        const projection = projectStatusSequence(currentProjectileCount, false, statusInput);
        const ordinaryApplications = { ...projection.ordinaryApplications };
        const forcedApplications: Partial<Record<StatusDamageType, number>> = {};
        const applications: Partial<Record<StatusDamageType, number>> = {};
        const presenceProbabilities: Partial<Record<StatusDamageType, number>> = {};
        const canReweight = statusInput.statusProcWeightsByType !== undefined && statusInput.statusRollsPerAttack !== undefined;
        const immuneTypes = new Set(statusImmuneTypes);
        if (remainingPools.overguard <= 0 && remainingPools.shields <= 0) immuneTypes.add("magnetic");
        if (!canReweight) {
            const tauVulnerability = ordinaryStatusChanceMultiplier();
            for (const [rawType, rawCount] of Object.entries(statusInput.expectedStatusApplicationsPerAttackByType ?? {}) as Array<[StatusDamageType, number]>) {
                if (immuneTypes.has(rawType)) continue;
                const typeMultiplier = rawType === "tau" ? 1 : tauVulnerability;
                ordinaryApplications[rawType] = finiteNonNegative(rawCount) * typeMultiplier;
            }
        }

        const baseProjectileCount = Math.max(1, finiteNonNegative(statusInput.expectedProjectiles ?? 1));
        const projectileRatio = statusInput.autoSpoolShotSequenceRule
            ? Math.max(0, currentProjectileCount / baseProjectileCount)
            : 1;
        for (const [type, rawApplications] of Object.entries(statusInput.forcedStatusApplicationsPerAttackByType ?? {}) as Array<[StatusDamageType, number]>) {
            if (immuneTypes.has(type)) continue;
            const count = finiteNonNegative(rawApplications) * projectileRatio;
            if (count > 0) forcedApplications[type] = count;
        }

        for (const type of STATUS_DAMAGE_TYPES) {
            if (immuneTypes.has(type)) continue;
            const ordinary = finiteNonNegative(ordinaryApplications[type] ?? 0);
            const forced = finiteNonNegative(forcedApplications[type] ?? 0);
            const total = ordinary + forced;
            if (total <= 0) continue;
            applications[type] = total;
            // Catalog-backed ordinary procs retain per-projectile presence and
            // expected applications; legacy inputs use their explicit Poisson
            // approximation. Forced effects remain independent and bounded.
            const ordinaryPresence = canReweight
                ? finiteNonNegative(projection.ordinaryPresenceProbabilities[type] ?? 0)
                : probabilityAtLeastOnePoissonArrival(ordinary);
            const forcedPresence = Math.min(1, forced);
            presenceProbabilities[type] = 1 - (1 - ordinaryPresence) * (1 - forcedPresence);
        }
        return { applications, ordinaryApplications, forcedApplications, presenceProbabilities };
    };

    /**
     * Expected chance for one projectile to add each status type. The Wiki
     * Galvanized notes treat projectiles as sequential hits, so an earlier
     * projectile's status can increase direct damage on later projectiles in
     * the same trigger pull.
     */
    const statusPresenceByProjectile = (currentProjectileCount: number) =>
        projectStatusSequence(currentProjectileCount, true).perProjectilePresence;

    const applyExpectedStatusApplications = (
        attackTime: number,
        applicationsByType: Partial<Record<StatusDamageType, number>>,
        presenceProbabilitiesByType: Partial<Record<StatusDamageType, number>> = {},
        attackDamageRampMultiplier = 1,
        conditionOverloadDamageMultiplier = 1,
        statusDamageMultiplier = 1,
        gasCloudGroup?: GasCloudTickGroup,
        heatStatusOverride?: HeatStatusApplicationOverride,
        statusInput: ExpectedWeaponEncounterInput = input,
    ) => {
        for (const [type, rawApplications] of Object.entries(applicationsByType) as Array<[StatusDamageType, number]>) {
            const applications = finiteNonNegative(rawApplications);
            const presenceProbability = clampProbability(
                presenceProbabilitiesByType[type] ?? probabilityAtLeastOnePoissonArrival(applications),
            );
            const duration = type === "heat" && heatStatusOverride
                ? finiteNonNegative(heatStatusOverride.durationSeconds)
                : STATUS_EFFECT_RULES[type].durationSeconds * durationMultiplier;
            if (applications <= 0 || (type !== "blast" && duration <= 0) || statusImmuneTypes.has(type)) continue;
            if (type === "cold" && coldFreezeUntil !== null && attackTime < coldFreezeUntil - 1e-9) continue;
            if (type === "magnetic" && remainingPools.overguard <= 0 && remainingPools.shields <= 0) continue;

            let cap = STATUS_EFFECT_RULES[type].maxStacks ?? Number.POSITIVE_INFINITY;
            const targetCap = statusInput.statusStackCaps?.[type];
            if (Number.isFinite(targetCap) && (targetCap ?? 0) >= 0) cap = Math.min(cap, targetCap ?? cap);
            if (type === "cold" && remainingPools.overguard > 0) cap = Math.min(cap, 4);

            let queue = statusStackQueues.get(type);
            let resolvedDuration = duration;
            let externalHeatInheritanceProbability = 0;
            if (type === "heat") {
                const previousInheritanceState = heatInheritanceState.current;
                const heatWasActive = previousInheritanceState !== null &&
                    attackTime <= previousInheritanceState.expiresAt + 1e-9;
                externalHeatInheritanceProbability = heatWasActive
                    ? previousInheritanceState.externalSourceProbability
                    : 0;
                resolvedDuration = Math.max(duration, heatWasActive ? previousInheritanceState.durationSeconds : 0);
                heatInheritanceState.current = {
                    expiresAt: attackTime + resolvedDuration,
                    durationSeconds: resolvedDuration,
                    externalSourceProbability: externalHeatInheritanceProbability,
                };
                const previousHeatState = heatArmorStripState.current;
                const canRefresh = previousHeatState !== null &&
                    attackTime < previousHeatState.lastAppliedAt + previousHeatState.durationSeconds - 1e-9;
                // Heat armor reduction and the shared +1 tick accumulator only
                // exist when at least one proc is active; proc count does not
                // multiply either effect. Keep their mean-field weight as the
                // union probability of the refreshed status group.
                heatArmorStripState.current = {
                    firstAppliedAt: canRefresh ? previousHeatState.firstAppliedAt : attackTime,
                    lastAppliedAt: attackTime,
                    durationSeconds: resolvedDuration,
                    activeWeight: 1 - (1 - (canRefresh ? previousHeatState.activeWeight : 0)) *
                        (1 - presenceProbability),
                };
                if (queue) {
                    for (let index = queue.head; index < queue.entries.length; index++) {
                        queue.entries[index].expiresAt = attackTime + resolvedDuration;
                    }
                }
            }
            const applicationDuration = type === "heat" ? resolvedDuration : duration;
            if (!queue) {
                queue = {
                    entries: [],
                    head: 0,
                    totalStacks: 0,
                    logProbabilityNoneActive: 0,
                    guaranteedPresenceEntries: 0,
                };
                statusStackQueues.set(type, queue);
            }
            const hasDynamicStatusApplications = statusInput.statusProcWeightsByType !== undefined && statusInput.statusRollsPerAttack !== undefined;
            const hasBlastHitDamage = statusInput.blastStackHitDamagePerProc !== undefined;
            if (type === "blast" && (statusInput.expectedStatusApplicationsPerAttackByType?.blast !== undefined || hasDynamicStatusApplications || hasBlastHitDamage)) {
                const legacyExpiryDamagePerStack = finiteNonNegative(statusInput.blastDamagePerAttack ?? 0) *
                    attackDamageRampMultiplier * statusDamageMultiplier / applications;
                const hitDamagePerStack = hasBlastHitDamage
                    ? finiteNonNegative(statusInput.blastStackHitDamagePerProc ?? 0) *
                        conditionOverloadDamageMultiplier * attackDamageRampMultiplier * statusDamageMultiplier
                    : legacyExpiryDamagePerStack > 0
                        ? legacyExpiryDamagePerStack / (STATUS_EFFECT_RULES.blast.stackExpiryDamageCoefficient ?? 0.3)
                        : 0;
                const expiryDamagePerStack = hasBlastHitDamage
                    ? blastStackExpiryDamage(hitDamagePerStack)
                    : legacyExpiryDamagePerStack;
                let unappliedStacks = applications;
                let recordedPresenceForAttack = false;
                while (unappliedStacks > 1e-9 && hitDamagePerStack > 0 && cap > 0) {
                    const availableStacks = Math.max(0, cap - queue.totalStacks);
                    if (availableStacks <= 1e-9) {
                        statusStackQueues.delete(type);
                        queue = {
                            entries: [],
                            head: 0,
                            totalStacks: 0,
                            logProbabilityNoneActive: 0,
                            guaranteedPresenceEntries: 0,
                        };
                        statusStackQueues.set(type, queue);
                        continue;
                    }
                    const addedStacks = Math.min(unappliedStacks, availableStacks);
                    const expiresAt = attackTime + duration;
                    const sequence = expiresAt <= maxDurationSeconds + 1e-9 ? nextTickSequence++ : null;
                    const expiryDamage = Math.fround(
                        Math.fround(expiryDamagePerStack) * Math.fround(addedStacks),
                    );
                    statusApplicationsByType.blast = (statusApplicationsByType.blast ?? 0) + addedStacks;
                    if (sequence !== null) {
                        heapPush(ticks, { time: expiresAt, sequence, type, damage: expiryDamage });
                    }
                    queue.entries.push({
                        expiresAt,
                        stacks: addedStacks,
                        presenceProbability: recordedPresenceForAttack ? 0 : presenceProbability,
                    });
                    addStatusPresence(queue, recordedPresenceForAttack ? 0 : presenceProbability);
                    recordedPresenceForAttack = true;
                    queue.totalStacks += addedStacks;
                    blastStackEntries.push({
                        expiresAt,
                        stacks: addedStacks,
                        hitDamagePerStack,
                        expiryDamagePerStack,
                        sequence,
                    });
                    unappliedStacks -= addedStacks;

                    if (queue.totalStacks + 1e-9 >= cap) {
                        // The afflicted target receives each stack's normal
                        // single-target expiry payout immediately. The 3×H
                        // blast at cap is a separate neighbor-only radial hit.
                        const capTargetDamage = blastStackEntries.reduce((sum, entry) => {
                            const stackDamage = Math.fround(
                                Math.fround(entry.stacks) * Math.fround(entry.expiryDamagePerStack),
                            );
                            return Math.fround(Math.fround(sum) + stackDamage);
                        }, Math.fround(0));
                        applyBlastCollateral();
                        for (const entry of blastStackEntries) {
                            if (entry.sequence !== null) cancelledTickSequences.add(entry.sequence);
                        }
                        blastStackEntries.length = 0;
                        statusStackQueues.delete(type);
                        queue = {
                            entries: [],
                            head: 0,
                            totalStacks: 0,
                            logProbabilityNoneActive: 0,
                            guaranteedPresenceEntries: 0,
                        };
                        statusStackQueues.set(type, queue);
                        recordedPresenceForAttack = false;
                        if (attackTime <= maxDurationSeconds + 1e-9 && capTargetDamage > 0) {
                            heapPush(ticks, {
                                time: attackTime,
                                sequence: nextTickSequence++,
                                type,
                                damage: capTargetDamage,
                            });
                        }
                    } else {
                        break;
                    }
                }
                continue;
            }
            let addedStacks: number;
            if (type === "gas") {
                // A Gas stack arriving at the ten-stack cap replaces the oldest
                // still-active cloud. Reduce that cloud's remaining scheduled
                // damage by the same fractional amount removed from its stack.
                addedStacks = Math.min(applications, cap);
                let replacedStacks = Math.max(0, queue.totalStacks + addedStacks - cap);
                while (replacedStacks > 1e-9 && queue.head < queue.entries.length) {
                    const oldest = queue.entries[queue.head];
                    const removedStacks = Math.min(oldest.stacks, replacedStacks);
                    oldest.stacks -= removedStacks;
                    queue.totalStacks = Math.max(0, queue.totalStacks - removedStacks);
                    replacedStacks -= removedStacks;
                    if (oldest.gasCloud) {
                        updateGasCloudActiveStacks(oldest.gasCloud, oldest.gasCloud.activeStacks - removedStacks);
                    }
                    if (oldest.stacks <= 1e-9) {
                        removeStatusPresence(queue, oldest.presenceProbability);
                        queue.head++;
                    }
                }
                if (gasCloudGroup) updateGasCloudActiveStacks(gasCloudGroup, addedStacks);
            } else if (type === "impact" || type === "radiation") {
                // The current Wiki says new Impact/Radiation stacks replace
                // the oldest stack after their target-specific cap is reached.
                addedStacks = Math.min(applications, cap);
                let replacedStacks = Math.max(0, queue.totalStacks + addedStacks - cap);
                while (replacedStacks > 1e-9 && queue.head < queue.entries.length) {
                    const oldest = queue.entries[queue.head];
                    const removedStacks = Math.min(oldest.stacks, replacedStacks);
                    oldest.stacks -= removedStacks;
                    queue.totalStacks = Math.max(0, queue.totalStacks - removedStacks);
                    replacedStacks -= removedStacks;
                    if (oldest.stacks <= 1e-9) {
                        removeStatusPresence(queue, oldest.presenceProbability);
                        queue.head++;
                    }
                }
            } else {
                addedStacks = Math.min(applications, Math.max(0, cap - queue.totalStacks));
            }
            if (addedStacks <= 0) {
                if (type === "gas" && gasCloudGroup) updateGasCloudActiveStacks(gasCloudGroup, 0);
                continue;
            }
            queue.entries.push({
                expiresAt: attackTime + applicationDuration,
                stacks: addedStacks,
                presenceProbability,
                ...(type === "gas" && gasCloudGroup ? { gasCloud: gasCloudGroup } : {}),
            });
            addStatusPresence(queue, presenceProbability);
            queue.totalStacks += addedStacks;
            const recordedApplications = type === "impact" || type === "radiation"
                ? (cap > 0 ? applications : 0)
                : addedStacks;
            statusApplicationsByType[type] =
                (statusApplicationsByType[type] ?? 0) + recordedApplications;

            if (type === "cold" && cap >= 10 && queue.totalStacks >= 10 && coldFreezeUntil === null) {
                coldFreezeUntil = attackTime +
                    (STATUS_EFFECT_RULES.cold.freezeDurationSeconds ?? 3) * durationMultiplier;
                queue.entries = [{ expiresAt: coldFreezeUntil, stacks: 10, presenceProbability: 1 }];
                queue.head = 0;
                queue.totalStacks = 10;
                queue.logProbabilityNoneActive = 0;
                queue.guaranteedPresenceEntries = 1;
                heapPush(ticks, {
                    time: coldFreezeUntil,
                    sequence: nextTickSequence++,
                    type: "coldFreezeEnd",
                    damage: 0,
                });
            }

            // Heat is a refreshable, accumulating DoT: each new proc adds to a
            // shared damage stream and refreshes every active stack's timer.
            // Other DoTs keep their independent scheduled instances below.
            if (type === "heat") {
                const perApplicationDamage = finiteNonNegative(statusInput.dotDamagePerApplicationByType?.heat ?? 0);
                const tickCount = countStatusDamageTicks("heat", applicationDuration);
                const ordinarySeedTickDamage = finiteNonNegative(heatStatusOverride?.tickDamagePerProc ??
                    statusInput.heatDotTickDamagePerProc ?? (tickCount > 0 ? perApplicationDamage / tickCount : 0));
                const inheritedSeedTickDamage = finiteNonNegative(
                    heatStatusOverride?.tickDamagePerProcWhenExternallyInherited ??
                    statusInput.heatDotTickDamagePerProcWhenExternallyInherited ?? ordinarySeedTickDamage,
                );
                const seedTickDamage = ordinarySeedTickDamage * (1 - externalHeatInheritanceProbability) +
                    inheritedSeedTickDamage * externalHeatInheritanceProbability;
                const ordinaryAccumulatorTickDamage = finiteNonNegative(
                    heatStatusOverride?.accumulatorDamagePerTick ?? statusInput.heatDotAccumulatorDamagePerTick ?? 0,
                );
                const inheritedAccumulatorTickDamage = finiteNonNegative(
                    heatStatusOverride?.accumulatorDamagePerTickWhenExternallyInherited ??
                    statusInput.heatDotAccumulatorDamagePerTickWhenExternallyInherited ?? ordinaryAccumulatorTickDamage,
                );
                const accumulatorTickDamage = ordinaryAccumulatorTickDamage * (1 - externalHeatInheritanceProbability) +
                    inheritedAccumulatorTickDamage * externalHeatInheritanceProbability;
                const adjustedSeedTickDamage = seedTickDamage *
                    conditionOverloadDamageMultiplier * attackDamageRampMultiplier * statusDamageMultiplier;
                const adjustedAccumulatorTickDamage = accumulatorTickDamage * statusDamageMultiplier;
                if ((adjustedSeedTickDamage > 0 || adjustedAccumulatorTickDamage > 0) && tickCount > 0) {
                    const previousHeatDot = heatDotState.current;
                    const remainsActive = previousHeatDot !== null && attackTime <= previousHeatDot.expiresAt + 1e-9;
                    const nextTickAt = remainsActive ? previousHeatDot.nextTickAt : attackTime + 1;
                    heatDotState.current = {
                        expiresAt: attackTime + applicationDuration,
                        nextTickAt,
                        tickDamage: (remainsActive ? previousHeatDot.tickDamage : 0) +
                            adjustedSeedTickDamage * addedStacks,
                        accumulatorDamage: adjustedAccumulatorTickDamage,
                    };
                    if (!remainsActive && nextTickAt <= maxDurationSeconds + 1e-9) {
                        heapPush(ticks, {
                            time: nextTickAt,
                            sequence: nextTickSequence++,
                            type: "heat",
                            damage: 0,
                            dynamicHeat: true,
                        });
                    }
                }
            }
        }
    };

    const scheduleMagneticBreakProc = (
        time: number,
        pool: "overguard" | "shields",
        statusDamageMultiplier = activeStatusDamageMultiplier(),
    ) => {
        if (statusImmuneTypes.has("electricity") || durationMultiplier <= 0) return;
        const magneticStacks = stackCount("magnetic");
        if (magneticStacks <= 0) return;
        const poolMaximum = pool === "overguard" ? maximumOverguard : maximumShields;
        const sourceMultiplier = finiteNonNegative(input.magneticBreakElectricSourceMultiplier ?? 1);
        const totalDamage = poolMaximum * MAGNETIC_BREAK_ELECTRIC_DAMAGE_PER_STACK * magneticStacks *
            sourceMultiplier * durationMultiplier * statusDamageMultiplier;
        const duration = MAGNETIC_BREAK_ELECTRIC_DURATION_SECONDS * durationMultiplier;
        const tickCount = countStatusDamageTicks("electricity", duration);
        if (totalDamage <= 0 || tickCount <= 0) return;

        // The Wiki describes this as one forced Electricity proc per active
        // Magnetic stack, with total damage over the six-second duration.
        // Mean-field stacks therefore schedule fractional expected applications.
        const perTickDamage = totalDamage / tickCount;
        for (let tickIndex = 0; tickIndex < tickCount; tickIndex++) {
            const tickTime = time + tickIndex;
            if (tickTime > maxDurationSeconds + 1e-9) break;
            scheduleStatusTick(tickTime, "electricity", perTickDamage);
        }
        applyExpectedStatusApplications(time, { electricity: magneticStacks });
    };

    const currentStatusModifiers = (time: number, timedDamageBonus = 0) => {
        const viralStacks = stackCount("viral");
        const magneticStacks = stackCount("magnetic");
        const corrosiveStacks = stackCount("corrosive");
        const coldStacks = stackCount("cold");
        const punctureStacks = stackCount("puncture");
        const viralBonus = scaleStatusStacks(viralStacks, 1, 0.25, 3.25);
        const magneticBonus = scaleStatusStacks(magneticStacks, 1, 0.25, 3.25);
        const corrosiveStrip = scaleStatusStacks(corrosiveStacks, 0.26, 0.06, 0.8);
        const coldCritBonus = coldStacks >= 10
            ? 1
            : scaleStatusStacks(Math.min(coldStacks, 9), 0.1, 0.05, 0.45);
        const punctureCritBonus = Math.min(0.25, punctureStacks * 0.05);
        const heatArmorStrip = getHeatArmorStripAtTime(time, heatArmorStripState.current, durationMultiplier);
        const weaponStatusTypeCount = STATUS_DAMAGE_TYPES.reduce((count, type) => {
            const modeledPresence = statusStackQueues.get(type)
                ? expectedStatusPresence(statusStackQueues.get(type)!)
                : 0;
            return count + Math.max(modeledPresence, externalStatusTypeSet.has(type) ? 1 : 0);
        }, 0);
        const externalConditionOverloadStatusTypeCount = Math.max(
            0,
            Math.min(16, Math.floor(finiteNonNegative(input.externalConditionOverloadStatusTypeCount ?? 0))),
        );
        const activeStatusTypeCount = Math.min(
            16,
            weaponStatusTypeCount + activeUniqueStatusTypes.size + externalConditionOverloadStatusTypeCount,
        );
        const intrinsicDamageStatusTypeCount = Math.min(
            16,
            weaponStatusTypeCount + activeUniqueStatusTypes.size,
        );
        const directDamageStatusPresenceByType: Partial<Record<StatusDamageType, number>> = {};
        const directDamageStatusTypeCount = STATUS_DAMAGE_TYPES
            .filter((type) => type !== "tau")
            .reduce((count, type) => {
                const modeledPresence = statusStackQueues.get(type)
                    ? expectedStatusPresence(statusStackQueues.get(type)!)
                    : 0;
                const presence = Math.max(modeledPresence, externalStatusTypeSet.has(type) ? 1 : 0);
                directDamageStatusPresenceByType[type] = presence;
                return count + presence;
            }, 0) + activeUniqueStatusTypes.size;
        const damageBracket = Math.max(0.0001, 1 + finiteSigned(input.totalDamageBonus ?? 0) + timedDamageBonus);
        const conditionOverloadDamagePerStatusBonus =
            finiteNonNegative(input.conditionOverloadDamagePerStatusBonus ?? 0);
        const conditionOverloadDamageBracket = damageBracket +
            conditionOverloadDamagePerStatusBonus * Math.min(16, activeStatusTypeCount);
        const conditionOverloadDamageMultiplier = conditionOverloadDamageBracket / damageBracket;
        const directDamagePerStatusWeight =
            finiteNonNegative(input.directDamagePerStatusBonus ?? 0) * directDamageStatusTypeCount;
        const intrinsicDamagePerStatusWeight =
            finiteNonNegative(input.intrinsicDamagePerStatusBonus ?? 0) * intrinsicDamageStatusTypeCount;
        const damageBracketWithIntrinsicBonus = input.intrinsicDamagePerStatusMode === "multiplicativeBase"
            ? conditionOverloadDamageBracket * (1 + intrinsicDamagePerStatusWeight)
            : conditionOverloadDamageBracket + intrinsicDamagePerStatusWeight;
        const directDamagePerStatusMultiplier =
            (damageBracketWithIntrinsicBonus + directDamagePerStatusWeight) /
            conditionOverloadDamageBracket;
        const hitDamageMultiplier = input.critChance !== undefined && input.critMultiplier !== undefined
            ? avgHitDamageMultiplier(
                input.critChance + punctureCritBonus,
                input.critMultiplier + coldCritBonus,
                input.nonCriticalHitDamageProcs,
                input.hitLocation,
                input.critTierEnhancementChance,
            )
            : finiteNonNegative(input.expectedHitDamageMultiplier ?? 1);
        return {
            armor: armorAfterBaseStrip * (1 - corrosiveStrip) * (1 - heatArmorStrip),
            viralHealthDamageBonus: finiteNonNegative(input.viralHealthDamageBonus ?? 0) + viralBonus,
            magneticDefenseDamageBonus: finiteNonNegative(input.magneticDefenseDamageBonus ?? 0) + magneticBonus,
            expectedHitDamageMultiplier: hitDamageMultiplier,
            conditionOverloadDamageMultiplier,
            directDamagePerStatusMultiplier,
            directDamageStatusTypeCount,
            directDamageStatusPresenceByType,
        };
    };

    const nextAttackTime = (index: number): number => attackEventTime(index, {
        attackIntervalSeconds: attackInterval,
        shotsPerMagazine,
        reloadDurationSeconds: reloadDuration,
        burstCount: input.burstCount,
        burstDelaySeconds: input.burstDelaySeconds,
        burstCycleRate: input.burstCycleRate,
        autoSpoolCadenceRule: input.autoSpoolCadenceRule,
    });

    const rampMultiplierForAttack = (attackTime: number, index: number): number => {
        const rule = input.damageRampRule;
        if (!rule) return 1;
        if (previousRampAttackTime === null) {
            previousRampAttackTime = attackTime;
            activeDamageRampMultiplier = getInitialDamageRampMultiplier(rule);
            return activeDamageRampMultiplier;
        }

        const gap = Math.max(0, attackTime - previousRampAttackTime);
        const magazineShots = Math.max(1, Math.floor(shotsPerMagazine + 1e-9));
        if (index > 0 && index % magazineShots === 0) {
            activeDamageRampMultiplier = advanceDamageRampMultiplier(
                rule,
                activeDamageRampMultiplier,
                reloadDuration,
                false,
            );
            activeDamageRampMultiplier = advanceDamageRampMultiplier(
                rule,
                activeDamageRampMultiplier,
                Math.max(0, gap - reloadDuration),
                true,
            );
        } else {
            activeDamageRampMultiplier = advanceDamageRampMultiplier(rule, activeDamageRampMultiplier, gap, true);
        }
        previousRampAttackTime = attackTime;
        return activeDamageRampMultiplier;
    };

    const scheduleAttackDots = (
        attackTime: number,
        applicationsByType: Partial<Record<StatusDamageType, number>>,
        attackDamageRampMultiplier = 1,
        conditionOverloadDamageMultiplier = 1,
        statusDamageMultiplier = 1,
    ): GasCloudTickGroup | undefined => {
        let gasCloudGroup: GasCloudTickGroup | undefined;
        for (const [type, totalDamage] of Object.entries(input.dotDamagePerAttackByType ?? {}) as Array<[StatusDamageType, number]>) {
            // The expected encounter handles weapon Heat procs as one refreshed,
            // accumulating tick stream in applyExpectedStatusApplications(). Keep
            // the legacy one-off path only when callers supplied no Heat proc state.
            if (
                type === "heat" &&
                (input.heatDotTickDamagePerProc !== undefined || input.dotDamagePerApplicationByType?.heat !== undefined) &&
                applicationsByType.heat !== undefined
            ) continue;
            const perApplicationDamage = input.dotDamagePerApplicationByType?.[type];
            const applications = finiteNonNegative(applicationsByType[type] ?? 0);
            const seedPerApplication = input.dotSeedDamagePerApplicationByType?.[type];
            const accumulatorPerApplication = input.dotAccumulatorDamagePerApplicationByType?.[type];
            const dotDamage = seedPerApplication !== undefined
                ? (
                    finiteNonNegative(seedPerApplication) * conditionOverloadDamageMultiplier +
                    finiteNonNegative(accumulatorPerApplication ?? 0)
                ) * applications * attackDamageRampMultiplier * statusDamageMultiplier
                : perApplicationDamage !== undefined
                    ? finiteNonNegative(perApplicationDamage) * applications *
                        conditionOverloadDamageMultiplier * attackDamageRampMultiplier * statusDamageMultiplier
                    : finiteNonNegative(totalDamage) * conditionOverloadDamageMultiplier * attackDamageRampMultiplier * statusDamageMultiplier;
            if (dotDamage <= 0) continue;
            const rule = STATUS_EFFECT_RULES[type];
            const duration = rule.durationSeconds * durationMultiplier;
            const count = countStatusDamageTicks(type, duration);
            const firstTick = rule.firstTickSeconds;
            if (count <= 0 || firstTick === null) continue;
            const damagePerScheduledTick = dotDamage / count;
            const gasStackTickDamage = type === "gas" && applications > 0
                ? damagePerScheduledTick / applications
                : 0;
            const gasScheduledTicks: ScheduledStatusTick[] = [];
            for (let tickIndex = 0; tickIndex < count; tickIndex++) {
                const time = attackTime + firstTick + tickIndex;
                if (time > maxDurationSeconds + 1e-9) break;
                if (type === "gas" && applications > 0) {
                    const tick: ScheduledStatusTick = {
                        time,
                        sequence: nextTickSequence++,
                        type,
                        damage: gasStackTickDamage * applications,
                    };
                    gasScheduledTicks.push(tick);
                    heapPush(ticks, tick);
                } else {
                    scheduleStatusTick(time, type, damagePerScheduledTick);
                }
            }
            if (type === "gas" && applications > 0) {
                gasCloudGroup = {
                    activeStacks: applications,
                    damagePerStackPerTick: gasStackTickDamage,
                    scheduledTicks: gasScheduledTicks,
                };
            }
        }
        const blastDamage = finiteNonNegative(input.blastDamagePerAttack ?? 0) *
            attackDamageRampMultiplier * statusDamageMultiplier;
        const blastDelay = STATUS_EFFECT_RULES.blast.detonationDelaySeconds;
        const expectedBlastStacksProvided = input.expectedStatusApplicationsPerAttackByType?.blast !== undefined ||
            (input.statusProcWeightsByType !== undefined && input.statusRollsPerAttack !== undefined) ||
            input.blastStackHitDamagePerProc !== undefined;
        const blastFuse = (blastDelay ?? 0) * durationMultiplier;
        if (blastDamage > 0 && blastDelay !== undefined && !expectedBlastStacksProvided && attackTime + blastFuse <= maxDurationSeconds + 1e-9) {
            heapPush(ticks, {
                time: attackTime + blastFuse,
                sequence: nextTickSequence++,
                type: "blast",
                damage: blastDamage,
            });
        }
        return gasCloudGroup;
    };

    const scheduleNightwatchNapalmTicks = (attackTime: number, expectedProjectiles: number) => {
        const napalm = input.nightwatchNapalm;
        const projectiles = finiteNonNegative(expectedProjectiles);
        if (!napalm || projectiles <= 0) return;
        // The Wiki says every rocket creates one overlapping blaze per damage
        // instance, with six one-second ticks and the first tick immediately.
        for (let tickIndex = 0; tickIndex < 6; tickIndex++) {
            const time = attackTime + tickIndex;
            if (time > maxDurationSeconds + 1e-9) break;
            heapPush(ticks, {
                time,
                sequence: nextTickSequence++,
                type: "nightwatchNapalm",
                damage: finiteNonNegative(napalm.directDamagePerProjectilePerTick),
                napalmProjectiles: projectiles,
            });
        }
    };

    const scheduleAttachedAttackDamageTicks = (attackTime: number) => {
        const sequence = input.attachedAttackDamageSequence;
        if (!sequence || !sequence.rule.stacks || !sequence.rule.attachedToDirectTarget) return;
        const { firstTickDelaySeconds, tickIntervalSeconds, tickCount } = sequence.rule;
        if (
            !Number.isFinite(firstTickDelaySeconds) || firstTickDelaySeconds < 0 ||
            !Number.isFinite(tickIntervalSeconds) || tickIntervalSeconds <= 0 ||
            !Number.isFinite(tickCount) || tickCount <= 0
        ) return;
        for (let tickIndex = 0; tickIndex < tickCount; tickIndex++) {
            const time = attackTime + firstTickDelaySeconds + tickIndex * tickIntervalSeconds;
            if (time > maxDurationSeconds + 1e-9) break;
            heapPush(ticks, {
                time,
                sequence: nextTickSequence++,
                type: "attachedAttackDamage",
                damage: 0,
                attachedAttackDamageProfile: sequence.profile,
            });
        }
    };

    while ((!killed && attacks < maxSimulatedAttacks) || ticks.length > 0) {
        while (ticks[0] && cancelledTickSequences.delete(ticks[0].sequence)) heapPop(ticks);
        const attackTime = !killed && attacks < maxSimulatedAttacks
            ? nextAttackTime(attackIndex)
            : Number.POSITIVE_INFINITY;
        const nextTick = ticks[0];
        const nextTickTime = nextTick?.time ?? Number.POSITIVE_INFINITY;
        const nextEventTime = Math.min(attackTime, nextTickTime);
        if (stopAtSeconds !== null && nextEventTime >= stopAtSeconds - 1e-9) {
            now = stopAtSeconds;
            break;
        }
        const attackComesFirst = attackTime <= nextTickTime + 1e-9;
        if (attackComesFirst) {
            if (!Number.isFinite(attackTime) || attackTime > maxDurationSeconds + 1e-9 || attackInterval <= 0) break;
            now = attackTime;
            expireStatusStacks(now);
            const statusDamageMultiplierAtAttackStart = activeStatusDamageMultiplier();
            const attackDamageRampMultiplier = rampMultiplierForAttack(attackTime, attackIndex);
            const shotSequenceState = input.autoSpoolShotSequenceRule
                ? getAutoSpoolShotSequenceState(
                    input.autoSpoolShotSequenceRule,
                    attackIndex % shotsPerMagazine,
                )
                : null;
            const projectileRatio = shotSequenceState?.projectileRatio ?? 1;
            const attackExpectedProjectiles = Math.max(
                0,
                finiteNonNegative(input.expectedProjectiles ?? input.autoSpoolShotSequenceRule?.maxProjectiles ?? 1) * projectileRatio,
            );
            const attackExpectedDamageMultiplier = Math.max(
                0,
                finiteNonNegative(input.expectedDamageMultiplier ?? input.expectedProjectiles ??
                    input.autoSpoolShotSequenceRule?.maxProjectiles ?? 1) * projectileRatio,
            );
            const attackInput = shotSequenceState
                ? {
                    ...input,
                    expectedProjectiles: attackExpectedProjectiles,
                    expectedDamageMultiplier: attackExpectedDamageMultiplier,
                }
                : input;
            const firstShotMagazineDamageMultiplier = !input.infiniteAmmoActive && attackIndex % shotsPerMagazine === 0
                ? 1 + finiteNonNegative(input.firstShotMagazineDamageBonus ?? 0)
                : 1;
            const lastShotMagazineDamageMultiplier = !input.infiniteAmmoActive &&
                attackIndex % shotsPerMagazine === shotsPerMagazine - 1
                ? 1 + finiteNonNegative(input.lastShotMagazineDamageBonus ?? 0) /
                    Math.max(1, attackExpectedDamageMultiplier)
                : 1;
            const attackDamageMultiplier =
                attackDamageRampMultiplier * firstShotMagazineDamageMultiplier * lastShotMagazineDamageMultiplier;
            const timedDamageBonus = timedDamageStacks.reduce(
                (sum, runtime) => sum +
                    advanceTimedDamageStackRuntime(runtime, now) * runtime.rule.damageBonusPerStack,
                0,
            );
            const baseDamageBracket = Math.max(0.0001, 1 + finiteSigned(input.totalDamageBonus ?? 0));
            const attackDamageBracket = Math.max(0.0001, baseDamageBracket + timedDamageBonus);
            const timedDamageBracketMultiplier = attackDamageBracket / baseDamageBracket;
            const statusModifiers = currentStatusModifiers(now, timedDamageBonus);
            const conditionOverloadDamageMultiplier = statusModifiers.conditionOverloadDamageMultiplier ?? 1;
            const directDamagePerStatusMultiplier = statusModifiers.directDamagePerStatusMultiplier ?? 1;
            const combinedDamageMultiplier = conditionOverloadDamageMultiplier * directDamagePerStatusMultiplier;
            const canRequantizeDynamicPerStatusDamage =
                input.rawDamageByType !== undefined && Number.isFinite(input.baseDamageTotal);
            const dynamicQuantizationBase = finiteNonNegative(input.baseDamageTotal ?? 0) *
                attackDamageBracket * combinedDamageMultiplier;
            let damageByType = Object.fromEntries(DAMAGE_TYPES.map((type) => [
                type,
                canRequantizeDynamicPerStatusDamage
                    ? quantizeDamageContribution(
                        finiteSigned(input.rawDamageByType?.[type] ?? 0) *
                            timedDamageBracketMultiplier * combinedDamageMultiplier,
                        dynamicQuantizationBase,
                    )
                    : finiteNonNegative(input.damageByType[type] ?? 0) *
                        timedDamageBracketMultiplier * combinedDamageMultiplier,
            ])) as Partial<Record<DamageType, number>>;
            const directDamagePerStatusBonus = finiteNonNegative(input.directDamagePerStatusBonus ?? 0);
            if (
                directDamagePerStatusBonus > 0 &&
                attackExpectedProjectiles > 1 &&
                attackExpectedDamageMultiplier > 0 &&
                input.statusProcWeightsByType !== undefined &&
                input.statusRollsPerAttack !== undefined
            ) {
                const perProjectileStatusPresence = statusPresenceByProjectile(attackExpectedProjectiles);
                const baseDirectStatusTypeCount = finiteNonNegative(
                    statusModifiers.directDamageStatusTypeCount ?? 0,
                );
                const uniqueStatusesAfterFirstProjectile = unionUniqueStatusTypes(
                    activeUniqueStatusTypes,
                    input.uniqueStatusProcsPerAttack ?? [],
                );
                const additionalUniqueStatusTypes = Math.max(
                    0,
                    uniqueStatusesAfterFirstProjectile.size - activeUniqueStatusTypes.size,
                );
                const wholeProjectiles = Math.floor(attackExpectedProjectiles);
                const fractionalProjectile = attackExpectedProjectiles - wholeProjectiles;
                const damageWeightPerProjectile = attackExpectedDamageMultiplier / attackExpectedProjectiles;
                const weightedDamageByType = Object.fromEntries(
                    DAMAGE_TYPES.map((type) => [type, 0]),
                ) as Record<DamageType, number>;
                const noDirectStatusPresenceBeforeProjectile = new Map<StatusDamageType, number>();

                for (let projectileIndex = 0; projectileIndex <= wholeProjectiles; projectileIndex++) {
                    const projectileProbability = projectileIndex < wholeProjectiles
                        ? 1
                        : fractionalProjectile;
                    if (projectileProbability <= 0) continue;

                    let additionalStatusTypes = 0;
                    for (const type of STATUS_DAMAGE_TYPES) {
                        if (type === "tau") continue;
                        const initialPresence = finiteNonNegative(
                            statusModifiers.directDamageStatusPresenceByType?.[type] ?? 0,
                        );
                        const noPresence = noDirectStatusPresenceBeforeProjectile.get(type) ??
                            1 - initialPresence;
                        const presenceBeforeThisProjectile = 1 - noPresence;
                        additionalStatusTypes += Math.max(0, presenceBeforeThisProjectile - initialPresence);
                    }
                    for (const type of STATUS_DAMAGE_TYPES) {
                        if (type === "tau") continue;
                        const initialPresence = finiteNonNegative(
                            statusModifiers.directDamageStatusPresenceByType?.[type] ?? 0,
                        );
                        const noPresence = noDirectStatusPresenceBeforeProjectile.get(type) ??
                            1 - initialPresence;
                        const perProjectilePresence = finiteNonNegative(
                            perProjectileStatusPresence[projectileIndex]?.[type] ?? 0,
                        );
                        noDirectStatusPresenceBeforeProjectile.set(
                            type,
                            noPresence * (1 - projectileProbability * perProjectilePresence),
                        );
                    }
                    if (projectileIndex > 0) additionalStatusTypes += additionalUniqueStatusTypes;
                    additionalStatusTypes = Math.max(
                        0,
                        Math.min(16, baseDirectStatusTypeCount + additionalStatusTypes) - baseDirectStatusTypeCount,
                    );

                    const projectileStatusDamageMultiplier = combinedDamageMultiplier +
                        directDamagePerStatusBonus * additionalStatusTypes / attackDamageBracket;
                    const projectileQuantizationBase = finiteNonNegative(input.baseDamageTotal ?? 0) *
                        attackDamageBracket * projectileStatusDamageMultiplier;
                    for (const type of DAMAGE_TYPES) {
                        const projectileDamage = canRequantizeDynamicPerStatusDamage
                            ? quantizeDamageContribution(
                                finiteSigned(input.rawDamageByType?.[type] ?? 0) *
                                    timedDamageBracketMultiplier * projectileStatusDamageMultiplier,
                                projectileQuantizationBase,
                            )
                            : finiteNonNegative(input.damageByType[type] ?? 0) *
                                timedDamageBracketMultiplier * projectileStatusDamageMultiplier;
                        weightedDamageByType[type] += projectileDamage * projectileProbability * damageWeightPerProjectile;
                    }
                }

                damageByType = Object.fromEntries(DAMAGE_TYPES.map((type) => [
                    type,
                    weightedDamageByType[type] / attackExpectedDamageMultiplier,
                ])) as Partial<Record<DamageType, number>>;
            }
            const poolsBeforeAttack = { ...remainingPools };
            const result = calculateDirectDamageToInitialPools({
                ...attackInput,
                ...statusModifiers,
                damageByType,
                damageRampMultiplier: attackDamageMultiplier,
                health: remainingPools.health,
                shields: remainingPools.shields,
                overguard: remainingPools.overguard,
            });
            const gateActive = attackTime < enemyShieldGateUntil - 1e-9;
            const gateMode = input.enemyShieldGateHitMode ?? "body";
            const gatedHealthDamageMultiplier = !gateActive || gateMode === "weakspot"
                ? 1
                : gateMode === "blockedArea"
                    ? 0
                    : ENEMY_SHIELD_GATE_BODY_DAMAGE_MULTIPLIER;
            const appliedDirectDamage = {
                ...result.damageByPool,
                // Apply the gate before the target-health cap so a large hit
                // against a nearly defeated target does not become fractional.
                health: Math.min(
                    remainingPools.health,
                    result.uncappedDamageByPool.health * gatedHealthDamageMultiplier,
                ),
            };
            addPools(directDamageByPool, appliedDirectDamage);
            subtractPools(remainingPools, appliedDirectDamage);
            if (
                finiteNonNegative(input.shatteringImpactBaseArmorPerHit ?? 0) > 0 &&
                finiteNonNegative(damageByType.impact ?? 0) > 0
            ) {
                remainingBaseArmor = Math.max(
                    0,
                    remainingBaseArmor - finiteNonNegative(input.shatteringImpactBaseArmorPerHit ?? 0) *
                        attackExpectedProjectiles,
                );
                armorAfterBaseStrip = armorFromRemainingBase(
                    initialArmor,
                    remainingBaseArmor,
                    armorLevelMultiplier,
                );
            }
            if (poolsBeforeAttack.overguard > 0 && remainingPools.overguard <= Number.EPSILON) {
                scheduleMagneticBreakProc(attackTime, "overguard", statusDamageMultiplierAtAttackStart);
            }
            if (poolsBeforeAttack.shields > 0 && remainingPools.shields <= Number.EPSILON) {
                enemyShieldGateUntil = attackTime + ENEMY_SHIELD_GATE_DURATION_SECONDS;
                scheduleMagneticBreakProc(attackTime, "shields", statusDamageMultiplierAtAttackStart);
            }
            // The triggering Hate hit activates the permanent target debuff, but
            // its own status procs retain the multiplier that was active at hit start.
            if (sumPools(appliedDirectDamage) > 0) activateTargetStatusDamageVulnerability();
            attacks++;
            attackIndex++;
            scheduleAttachedAttackDamageTicks(attackTime);
            const attackStatusState = expectedStatusApplicationsForCurrentPools(attackExpectedProjectiles);
            const gasCloudGroup = scheduleAttackDots(
                attackTime,
                attackStatusState.applications,
                attackDamageMultiplier * timedDamageBracketMultiplier,
                conditionOverloadDamageMultiplier,
                statusDamageMultiplierAtAttackStart,
            );
            applyExpectedStatusApplications(
                attackTime,
                attackStatusState.applications,
                attackStatusState.presenceProbabilities,
                attackDamageMultiplier * timedDamageBracketMultiplier,
                conditionOverloadDamageMultiplier,
                statusDamageMultiplierAtAttackStart,
                gasCloudGroup,
            );
            scheduleNightwatchNapalmTicks(attackTime, attackExpectedProjectiles);
            for (const runtime of timedDamageStacks) {
                recordTimedDamageStackTrigger(runtime, attackTime);
            }
            for (const uniqueStatus of input.uniqueStatusProcsPerAttack ?? []) {
                if (uniqueStatus === "lifted") activeUniqueStatusTypes.delete("knockdown");
                if (uniqueStatus === "knockdown") activeUniqueStatusTypes.delete("lifted");
                activeUniqueStatusTypes.add(uniqueStatus);
            }
            killed = isEncounterTargetDefeated(initialHealth, remainingPools);
            if (killed && primaryKilledAt === null) {
                primaryKilledAt = now;
                resolveBlastDeathRadial();
            }
        } else {
            const tick = heapPop(ticks);
            if (!tick) continue;
            if (tick.type === "electricity" && groupedElectricTicks.get(tick.time) === tick) {
                groupedElectricTicks.delete(tick.time);
            }
            now = tick.time;
            // Gas clouds keep ticking on nearby enemies after their host dies.
            // Other scheduled effects stop with the primary target because the
            // current sources do not establish their corpse-persistence rules.
            if (killed && tick.type !== "gas") continue;
            if (tick.type === "coldFreezeEnd") {
                finishColdFreeze(now);
                expireStatusStacks(now);
                continue;
            }
            // Expire older stacks before resolving this event while retaining
            // stacks whose final tick lands exactly at their expiry timestamp.
            expireStatusStacks(now - 2e-9);
            const statusDamageMultiplierAtTickStart = activeStatusDamageMultiplier();
            if (tick.type === "nightwatchNapalm") {
                const napalm = input.nightwatchNapalm;
                const projectiles = finiteNonNegative(tick.napalmProjectiles ?? 0);
                if (!napalm || projectiles <= 0) continue;
                const poolsBeforeNapalmTick = { ...remainingPools };
                const directResult = calculateDirectDamageToInitialPools({
                    ...input,
                    ...currentStatusModifiers(now),
                    damageByType: { heat: tick.damage },
                    damageRampMultiplier: 1,
                    expectedProjectiles: projectiles,
                    expectedDamageMultiplier: projectiles,
                    expectedHitDamageMultiplier: 1,
                    critChance: 0,
                    critMultiplier: 1,
                    nonCriticalHitDamageProcs: [],
                    health: remainingPools.health,
                    shields: remainingPools.shields,
                    overguard: remainingPools.overguard,
                });
                const gateActive = now < enemyShieldGateUntil - 1e-9;
                const gateMode = input.enemyShieldGateHitMode ?? "body";
                const gatedHealthDamageMultiplier = !gateActive || gateMode === "weakspot"
                    ? 1
                    : gateMode === "blockedArea"
                        ? 0
                        : ENEMY_SHIELD_GATE_BODY_DAMAGE_MULTIPLIER;
                const appliedNapalmDamage = {
                    ...directResult.damageByPool,
                    health: Math.min(
                        remainingPools.health,
                        directResult.uncappedDamageByPool.health * gatedHealthDamageMultiplier,
                    ),
                };
                addPools(directDamageByPool, appliedNapalmDamage);
                subtractPools(remainingPools, appliedNapalmDamage);
                if (poolsBeforeNapalmTick.overguard > 0 && remainingPools.overguard <= Number.EPSILON) {
                    scheduleMagneticBreakProc(now, "overguard", statusDamageMultiplierAtTickStart);
                }
                if (poolsBeforeNapalmTick.shields > 0 && remainingPools.shields <= Number.EPSILON) {
                    enemyShieldGateUntil = now + ENEMY_SHIELD_GATE_DURATION_SECONDS;
                    scheduleMagneticBreakProc(now, "shields", statusDamageMultiplierAtTickStart);
                }

                const heatProcChance = clampProbability(napalm.heatProcChancePerTick);
                const wholeProjectiles = Math.floor(projectiles);
                const fractionalProjectile = projectiles - wholeProjectiles;
                const noHeatProcProbability = Math.pow(1 - heatProcChance, wholeProjectiles) *
                    (1 - fractionalProjectile * heatProcChance);
                const expectedHeatApplications = projectiles * heatProcChance;
                applyExpectedStatusApplications(
                    now,
                    { heat: expectedHeatApplications },
                    { heat: 1 - noHeatProcProbability },
                    1,
                    1,
                    statusDamageMultiplierAtTickStart,
                    undefined,
                    {
                        durationSeconds: napalm.heatStatusDurationSeconds,
                        tickDamagePerProc: napalm.heatDotDamagePerProcPerTick,
                        accumulatorDamagePerTick: napalm.heatDotAccumulatorDamagePerTick,
                        tickDamagePerProcWhenExternallyInherited:
                            napalm.heatDotDamagePerProcPerTickWhenExternallyInherited,
                        accumulatorDamagePerTickWhenExternallyInherited:
                            napalm.heatDotAccumulatorDamagePerTickWhenExternallyInherited,
                    },
                );
                killed = isEncounterTargetDefeated(initialHealth, remainingPools);
                if (killed && primaryKilledAt === null) {
                    primaryKilledAt = now;
                    resolveBlastDeathRadial();
                }
                expireStatusStacks(now);
                continue;
            }
            if (tick.type === "attachedAttackDamage") {
                const profile = tick.attachedAttackDamageProfile;
                if (!profile || killed) continue;
                const statusModifiers = currentStatusModifiers(now);
                const conditionOverloadMultiplier = profile.conditionOverloadApplies
                    ? finiteNonNegative(statusModifiers.conditionOverloadDamageMultiplier ?? 1)
                    : 1;
                const directPerStatusMultiplier = profile.directDamagePerStatusBonus > 0 ||
                    profile.intrinsicDamagePerStatusBonus > 0
                    ? finiteNonNegative(statusModifiers.directDamagePerStatusMultiplier ?? 1)
                    : 1;
                const dynamicMultiplier = conditionOverloadMultiplier * directPerStatusMultiplier;
                const damageByType = Object.fromEntries(DAMAGE_TYPES.map((type) => [
                    type,
                    finiteNonNegative(profile.damageByType[type] ?? 0) * dynamicMultiplier,
                ])) as Partial<Record<DamageType, number>>;
                const cloudInput: ExpectedWeaponEncounterInput = {
                    ...input,
                    damageByType: profile.damageByType,
                    rawDamageByType: profile.rawDamageByType,
                    baseDamageTotal: profile.baseDamageTotal,
                    expectedHitDamageMultiplier: profile.expectedHitDamageMultiplier,
                    critChance: profile.critChance,
                    critMultiplier: profile.critMultiplier,
                    critTierEnhancementChance: profile.critTierEnhancementChance,
                    nonCriticalHitDamageProcs: profile.nonCriticalHitDamageProcs,
                    hitLocation: profile.hitLocation,
                    expectedProjectiles: profile.expectedProjectiles,
                    expectedDamageMultiplier: profile.expectedDamageMultiplier,
                    singleProjectileDamageBonus: 0,
                    statusProcWeightsByType: profile.statusProcWeightsByType,
                    statusRollsPerAttack: profile.statusRollsPerAttack,
                    forcedStatusApplicationsPerAttackByType: profile.forcedStatusApplicationsPerAttackByType,
                    dotDamagePerAttackByType: profile.dotDamagePerAttackByType,
                    dotDamagePerApplicationByType: profile.dotDamagePerApplicationByType,
                    dotSeedDamagePerApplicationByType: profile.dotSeedDamagePerApplicationByType,
                    dotAccumulatorDamagePerApplicationByType: profile.dotAccumulatorDamagePerApplicationByType,
                    heatDotTickDamagePerProc: profile.heatDotTickDamagePerProc,
                    heatDotAccumulatorDamagePerTick: profile.heatDotAccumulatorDamagePerTick,
                    heatDotTickDamagePerProcWhenExternallyInherited:
                        profile.heatDotTickDamagePerProcWhenExternallyInherited,
                    heatDotAccumulatorDamagePerTickWhenExternallyInherited:
                        profile.heatDotAccumulatorDamagePerTickWhenExternallyInherited,
                    blastStackHitDamagePerProc: profile.blastStackHitDamagePerProc,
                    statusDurationMultiplier: profile.statusDurationMultiplier,
                    directDamagePerStatusBonus: profile.directDamagePerStatusBonus,
                    conditionOverloadDamagePerStatusBonus: profile.conditionOverloadDamagePerStatusBonus,
                    intrinsicDamagePerStatusBonus: profile.intrinsicDamagePerStatusBonus,
                    intrinsicDamagePerStatusMode: profile.intrinsicDamagePerStatusMode,
                    totalDamageBonus: profile.totalDamageBonus,
                    uniqueStatusProcsPerAttack: profile.uniqueStatusProcsPerAttack,
                    autoSpoolShotSequenceRule: undefined,
                };
                const poolsBeforeCloudTick = { ...remainingPools };
                const directResult = calculateDirectDamageToInitialPools({
                    ...cloudInput,
                    ...statusModifiers,
                    damageByType,
                    damageRampMultiplier: 1,
                    expectedProjectiles: profile.expectedProjectiles,
                    expectedDamageMultiplier: profile.expectedDamageMultiplier,
                    expectedHitDamageMultiplier: profile.expectedHitDamageMultiplier,
                    critChance: profile.critChance,
                    critMultiplier: profile.critMultiplier,
                    critTierEnhancementChance: profile.critTierEnhancementChance,
                    nonCriticalHitDamageProcs: profile.nonCriticalHitDamageProcs,
                    hitLocation: profile.hitLocation,
                    singleProjectileDamageBonus: 0,
                    health: remainingPools.health,
                    shields: remainingPools.shields,
                    overguard: remainingPools.overguard,
                });
                const gateActive = now < enemyShieldGateUntil - 1e-9;
                const gateMode = input.enemyShieldGateHitMode ?? "body";
                const gatedHealthDamageMultiplier = !gateActive || gateMode === "weakspot"
                    ? 1
                    : gateMode === "blockedArea"
                        ? 0
                        : ENEMY_SHIELD_GATE_BODY_DAMAGE_MULTIPLIER;
                const appliedCloudDamage = {
                    ...directResult.damageByPool,
                    health: Math.min(
                        remainingPools.health,
                        directResult.uncappedDamageByPool.health * gatedHealthDamageMultiplier,
                    ),
                };
                addPools(directDamageByPool, appliedCloudDamage);
                subtractPools(remainingPools, appliedCloudDamage);
                if (sumPools(appliedCloudDamage) > 0) activateTargetStatusDamageVulnerability();
                if (poolsBeforeCloudTick.overguard > 0 && remainingPools.overguard <= Number.EPSILON) {
                    scheduleMagneticBreakProc(now, "overguard", statusDamageMultiplierAtTickStart);
                }
                if (poolsBeforeCloudTick.shields > 0 && remainingPools.shields <= Number.EPSILON) {
                    enemyShieldGateUntil = now + ENEMY_SHIELD_GATE_DURATION_SECONDS;
                    scheduleMagneticBreakProc(now, "shields", statusDamageMultiplierAtTickStart);
                }
                const cloudStatusState = expectedStatusApplicationsForCurrentPools(
                    profile.expectedProjectiles,
                    cloudInput,
                );
                applyExpectedStatusApplications(
                    now,
                    cloudStatusState.applications,
                    cloudStatusState.presenceProbabilities,
                    1,
                    conditionOverloadMultiplier,
                    statusDamageMultiplierAtTickStart,
                    undefined,
                    undefined,
                    cloudInput,
                );
                killed = isEncounterTargetDefeated(initialHealth, remainingPools);
                if (killed && primaryKilledAt === null) {
                    primaryKilledAt = now;
                    resolveBlastDeathRadial();
                }
                expireStatusStacks(now);
                continue;
            }
            if (tick.type === "blast") {
                for (let index = blastStackEntries.length - 1; index >= 0; index--) {
                    if (blastStackEntries[index].sequence === tick.sequence) blastStackEntries.splice(index, 1);
                }
            }
            let tickDamage = tick.damage;
            if (tick.dynamicHeat) {
                const activeHeatDot = heatDotState.current;
                if (!activeHeatDot || now > activeHeatDot.expiresAt + 1e-9) {
                    heatDotState.current = null;
                    expireStatusStacks(now);
                    continue;
                }
                tickDamage = activeHeatDot.tickDamage +
                    (heatArmorStripState.current?.activeWeight ?? 0) * activeHeatDot.accumulatorDamage;
                const nextTickAt = now + 1;
                if (nextTickAt <= activeHeatDot.expiresAt + 1e-9 && nextTickAt <= maxDurationSeconds + 1e-9) {
                    activeHeatDot.nextTickAt = nextTickAt;
                    heapPush(ticks, {
                        time: nextTickAt,
                        sequence: nextTickSequence++,
                        type: "heat",
                        damage: 0,
                        dynamicHeat: true,
                    });
                } else {
                    heatDotState.current = null;
                }
            }
            const poolsBeforeTick = { ...remainingPools };
            const dealt = applyStatusTickToPools({ ...input, ...currentStatusModifiers(now) }, remainingPools, tick.type, tickDamage);
            addPools(statusDamageByPool, dealt);
            subtractPools(remainingPools, dealt);
            if ((tick.type === "electricity" || tick.type === "gas") &&
                (electricGasCollateralTargets.length > 0 || (tick.type === "gas" && gasOuterCollateralTargets.length > 0))) {
                // These area effects damage nearby enemies without transferring
                // the original target's Viral/Magnetic stack state to them.
                const collateralInput = {
                    ...input,
                    viralHealthDamageBonus: 0,
                    magneticDefenseDamageBonus: 0,
                };
                for (const targetPools of electricGasCollateralTargets) {
                    if (allPoolsEmpty(targetPools)) continue;
                    const collateralDamage = applyStatusTickToPools(
                        collateralInput,
                        targetPools,
                        tick.type,
                        tickDamage,
                    );
                    addPools(electricGasCollateralDamageByPool, collateralDamage);
                    subtractPools(targetPools, collateralDamage);
                }
                if (tick.type === "gas" && gasOuterCollateralTargets.length > 0) {
                    const outerRingCoverage = gasCloudOuterAnnulusCoverage(
                        gasCloudRadiusFromStacks(stackCount("gas")),
                    );
                    const outerRingTickDamage = tickDamage * outerRingCoverage;
                    if (outerRingTickDamage > 0) {
                        for (const targetPools of gasOuterCollateralTargets) {
                            if (allPoolsEmpty(targetPools)) continue;
                            const collateralDamage = applyStatusTickToPools(
                                collateralInput,
                                targetPools,
                                "gas",
                                outerRingTickDamage,
                            );
                            addPools(electricGasCollateralDamageByPool, collateralDamage);
                            subtractPools(targetPools, collateralDamage);
                        }
                    }
                }
            }
            if (poolsBeforeTick.overguard > 0 && remainingPools.overguard <= Number.EPSILON) {
                scheduleMagneticBreakProc(now, "overguard", statusDamageMultiplierAtTickStart);
            }
            if (poolsBeforeTick.shields > 0 && remainingPools.shields <= Number.EPSILON) {
                enemyShieldGateUntil = now + ENEMY_SHIELD_GATE_DURATION_SECONDS;
                scheduleMagneticBreakProc(now, "shields", statusDamageMultiplierAtTickStart);
            }
            // Existing status ticks were seeded when their procs were applied;
            // a triggering tick only changes damage for later procs.
            if (sumPools(dealt) > 0) activateTargetStatusDamageVulnerability();
            killed = isEncounterTargetDefeated(initialHealth, remainingPools);
            if (killed && primaryKilledAt === null) {
                primaryKilledAt = now;
                resolveBlastDeathRadial();
            }
            // Status stacks remain active for a DoT tick that lands exactly at
            // expiration, then expire before the next attack or scheduled event.
            expireStatusStacks(now);
        }
    }

    const totalDamage = sumPools(directDamageByPool) + sumPools(statusDamageByPool);
    const timeToKillSeconds = primaryKilledAt;
    const attackCountLimitReached = !killed &&
        Number.isFinite(input.attackCountLimit) &&
        attacks >= maxSimulatedAttacks &&
        attackCountLimit < maxAttacks;
    const evaluatedDurationSeconds = stopAtSeconds !== null
        ? stopAtSeconds
        : primaryKilledAt ?? (attackCountLimitReached ? now : maxDurationSeconds);
    const rateDuration = evaluatedDurationSeconds > 0
        ? evaluatedDurationSeconds
        : attacks > 0 ? attackInterval : 0;
    return {
        attacks,
        attackCountLimitReached,
        timeToKillSeconds,
        evaluatedDurationSeconds,
        directDamageByPool,
        statusDamageByPool,
        statusApplicationsByType,
        blastCollateralDamageByPool,
        blastCollateralEnemyCount,
        electricGasCollateralDamageByPool,
        electricGasCollateralEnemyCount,
        remainingPools,
        remainingArmorAfterBaseStrip: armorAfterBaseStrip,
        totalDamage,
        damagePerAttack: attacks > 0 ? totalDamage / attacks : 0,
        damagePerSecond: rateDuration > 0 ? totalDamage / rateDuration : 0,
    };
}

/**
 * Resolves repeated mean-damage attacks through Overguard, Shields, and Health.
 * Each attack uses the same clean-target damage and mitigation assumptions, so
 * statuses, armor strip ramp, attenuation, and hit variance do not evolve. It
 * applies one timed enemy Shield Gate after Shields break. It is an ordered
 * direct-hit estimate, not a full combat simulation.
 */
export function simulateDirectAttackSequence(
    input: DirectAttackSequenceInput,
): DirectAttackSequenceResult {
    const initialPools = {
        overguard: finiteNonNegative(input.overguard),
        shields: finiteNonNegative(input.shields),
        health: finiteNonNegative(input.health),
    };
    const remainingPools = { ...initialPools };
    const damageByPool: Record<TargetDamagePool, number> = { overguard: 0, shields: 0, health: 0 };
    const initialArmor = finiteNonNegative(input.armor);
    const armorLevelMultiplier = finiteNonNegative(input.armorLevelMultiplier ?? 1);
    let remainingBaseArmor = finiteNonNegative(input.baseArmorValue ?? initialArmor);
    let armorAfterBaseStrip = initialArmor;
    const attackInterval = finiteNonNegative(input.attackIntervalSeconds);
    const reloadDuration = input.infiniteAmmoActive ? 0 : finiteNonNegative(input.reloadDurationSeconds ?? 0);
    const shotsPerMagazine = input.infiniteAmmoActive
        ? Number.MAX_SAFE_INTEGER
        : Number.isFinite(input.shotsPerMagazine)
            ? Math.max(1, Math.floor(input.shotsPerMagazine ?? 1))
            : Number.MAX_SAFE_INTEGER;
    const maxRampAttacks = 100_000;
    const attackCountLimit = Number.isFinite(input.attackCountLimit)
        ? Math.max(0, Math.floor(input.attackCountLimit ?? 0))
        : maxRampAttacks;
    const maxSimulatedAttacks = Math.min(maxRampAttacks, attackCountLimit);

    const firstShotMagazineDamageBonus = input.infiniteAmmoActive
        ? 0
        : finiteNonNegative(input.firstShotMagazineDamageBonus ?? 0);
    const lastShotMagazineDamageBonus = input.infiniteAmmoActive
        ? 0
        : finiteNonNegative(input.lastShotMagazineDamageBonus ?? 0);
    if (
        input.damageRampRule ||
        input.autoSpoolShotSequenceRule ||
        input.heavyAttackCombo ||
        firstShotMagazineDamageBonus > 0 ||
        lastShotMagazineDamageBonus > 0 ||
        finiteNonNegative(input.shatteringImpactBaseArmorPerHit ?? 0) > 0 ||
        Number.isFinite(input.attackCountLimit)
    ) {
        const damageByPool = zeroPools();
        const combo = input.heavyAttackCombo;
        let rampMultiplier = input.damageRampRule ? getInitialDamageRampMultiplier(input.damageRampRule) : 1;
        let comboPoints = finiteNonNegative(combo?.startingPoints ?? 0);
        let previousAttackTime: number | null = null;
        let attacks = 0;
        let enemyShieldGateUntil = Number.NEGATIVE_INFINITY;
        const enemyShieldGateHitMode = input.enemyShieldGateHitMode ?? "body";
        let comboMultiplierAtStart: number | undefined;
        let comboMultiplierAtKill: number | undefined;
        for (let index = 0; index < maxSimulatedAttacks; index++) {
            const attackTime = attackEventTime(index, {
                attackIntervalSeconds: attackInterval,
                shotsPerMagazine,
                reloadDurationSeconds: reloadDuration,
                burstCount: input.burstCount,
                burstDelaySeconds: input.burstDelaySeconds,
                burstCycleRate: input.burstCycleRate,
                autoSpoolCadenceRule: input.autoSpoolCadenceRule,
            });
            if (!Number.isFinite(attackTime) || (index > 0 && attackInterval <= 0)) break;
            if (previousAttackTime !== null) {
                const gap = Math.max(0, attackTime - previousAttackTime);
                if (combo && comboPoints < finiteNonNegative(combo.initialComboPoints)) {
                    const regenRate = Number.isFinite(combo.initialComboRegenPerSecond)
                        ? Math.max(0, combo.initialComboRegenPerSecond ?? 0)
                        : INITIAL_COMBO_REGEN_POINTS_PER_SECOND;
                    comboPoints = Math.min(
                        finiteNonNegative(combo.initialComboPoints),
                        comboPoints + regenRate * gap,
                    );
                }
                if (input.damageRampRule) {
                    if (index % shotsPerMagazine === 0) {
                        rampMultiplier = advanceDamageRampMultiplier(
                            input.damageRampRule,
                            rampMultiplier,
                            reloadDuration,
                            false,
                        );
                        rampMultiplier = advanceDamageRampMultiplier(
                            input.damageRampRule,
                            rampMultiplier,
                            Math.max(0, gap - reloadDuration),
                            true,
                        );
                    } else {
                        rampMultiplier = advanceDamageRampMultiplier(input.damageRampRule, rampMultiplier, gap, true);
                    }
                }
            }
            previousAttackTime = attackTime;
            const shotSequenceState = input.autoSpoolShotSequenceRule
                ? getAutoSpoolShotSequenceState(
                    input.autoSpoolShotSequenceRule,
                    index % shotsPerMagazine,
                )
                : null;
            const projectileRatio = shotSequenceState?.projectileRatio ?? 1;
            const attackExpectedProjectiles = Math.max(
                0,
                finiteNonNegative(input.expectedProjectiles ?? input.autoSpoolShotSequenceRule?.maxProjectiles ?? 1) * projectileRatio,
            );
            const attackExpectedDamageMultiplier = Math.max(
                0,
                finiteNonNegative(input.expectedDamageMultiplier ?? input.expectedProjectiles ??
                    input.autoSpoolShotSequenceRule?.maxProjectiles ?? 1) * projectileRatio,
            );
            let currentComboMultiplier = combo?.startingMultiplier ?? 1;
            let expectedHitDamageMultiplier = input.expectedHitDamageMultiplier;
            let damageByType = input.damageByType;
            if (combo) {
                currentComboMultiplier = Math.min(
                    Math.max(1, combo.maxMultiplier),
                    1 + Math.floor(comboPoints / Math.max(1, combo.pointsPerTier)),
                );
                if (index === 0) comboMultiplierAtStart = currentComboMultiplier;
                const channelScale = currentComboMultiplier / Math.max(1, combo.startingMultiplier);
                if (Math.abs(channelScale - 1) > Number.EPSILON) {
                    damageByType = Object.fromEntries(
                        Object.entries(input.damageByType).map(([type, amount]) => [type, finiteNonNegative(amount) * channelScale]),
                    ) as Partial<Record<DamageType, number>>;
                }
                const startingTier = Math.max(1, combo.startingMultiplier);
                const baseCritChance = combo.startingCritChance - (startingTier - 1) * combo.critChancePerTier;
                const currentCritChance = Math.max(
                    0,
                    baseCritChance + (currentComboMultiplier - 1) * combo.critChancePerTier,
                );
                expectedHitDamageMultiplier = avgHitDamageMultiplier(
                    currentCritChance,
                    combo.critDamageMultiplier,
                    input.nonCriticalHitDamageProcs,
                    input.hitLocation,
                    input.critTierEnhancementChance,
                );
            }
            const result = calculateDirectDamageToInitialPools({
                ...input,
                armor: armorAfterBaseStrip,
                damageByType,
                expectedProjectiles: attackExpectedProjectiles,
                expectedDamageMultiplier: attackExpectedDamageMultiplier,
                expectedHitDamageMultiplier,
                damageRampMultiplier: rampMultiplier *
                    (index % shotsPerMagazine === 0 ? 1 + firstShotMagazineDamageBonus : 1) *
                    (index % shotsPerMagazine === shotsPerMagazine - 1
                        ? 1 + lastShotMagazineDamageBonus / Math.max(1, attackExpectedDamageMultiplier)
                        : 1),
                health: remainingPools.health,
                shields: remainingPools.shields,
                overguard: remainingPools.overguard,
            });
            const poolsBeforeAttack = { ...remainingPools };
            const gateActive = attackTime < enemyShieldGateUntil - 1e-9;
            const gatedHealthMultiplier = !gateActive || enemyShieldGateHitMode === "weakspot"
                ? 1
                : enemyShieldGateHitMode === "blockedArea"
                    ? 0
                    : ENEMY_SHIELD_GATE_BODY_DAMAGE_MULTIPLIER;
            const appliedDirectDamage = {
                ...result.damageByPool,
                health: Math.min(
                    remainingPools.health,
                    result.uncappedDamageByPool.health * gatedHealthMultiplier,
                ),
            };
            addPools(damageByPool, appliedDirectDamage);
            subtractPools(remainingPools, appliedDirectDamage);
            if (
                finiteNonNegative(input.shatteringImpactBaseArmorPerHit ?? 0) > 0 &&
                finiteNonNegative(damageByType.impact ?? 0) > 0
            ) {
                remainingBaseArmor = Math.max(
                    0,
                    remainingBaseArmor - finiteNonNegative(input.shatteringImpactBaseArmorPerHit ?? 0) *
                        attackExpectedProjectiles,
                );
                armorAfterBaseStrip = armorFromRemainingBase(
                    initialArmor,
                    remainingBaseArmor,
                    armorLevelMultiplier,
                );
            }
            if (poolsBeforeAttack.shields > 0 && remainingPools.shields <= Number.EPSILON) {
                enemyShieldGateUntil = attackTime + ENEMY_SHIELD_GATE_DURATION_SECONDS;
            }
            attacks++;
            if (combo) {
                comboMultiplierAtKill = currentComboMultiplier;
                comboPoints = getHeavyAttackRetainedComboPoints(comboPoints, combo.heavyAttackEfficiency);
            }
            if (allPoolsEmpty(remainingPools)) {
                return {
                    attacksToKill: attacks,
                    timeToKillSeconds: attackTime,
                    damageByPool,
                    remainingPools,
                    remainingArmorAfterBaseStrip: armorAfterBaseStrip,
                    attackCountLimitReached: false,
                    ...(comboMultiplierAtStart === undefined ? {} : { comboMultiplierAtStart }),
                    ...(comboMultiplierAtKill === undefined ? {} : { comboMultiplierAtKill }),
                };
            }
            if (sumPools(result.damageByPool) <= 0) break;
        }
        return {
            attacksToKill: null,
            timeToKillSeconds: null,
            damageByPool,
            remainingPools,
            remainingArmorAfterBaseStrip: armorAfterBaseStrip,
            attackCountLimitReached: Number.isFinite(input.attackCountLimit) &&
                attacks >= maxSimulatedAttacks &&
                attackCountLimit < maxRampAttacks,
            ...(comboMultiplierAtStart === undefined ? {} : { comboMultiplierAtStart }),
            ...(comboMultiplierAtKill === undefined ? {} : { comboMultiplierAtKill }),
        };
    }

    const phaseDamage = (overguard: number, shields: number): Record<TargetDamagePool, number> =>
        calculateDirectDamageToInitialPools({
            ...input,
            health: 1,
            shields,
            overguard,
        }).uncappedDamageByPool;
    const againstOverguard = phaseDamage(1, 0);
    const againstShields = phaseDamage(0, 1);
    const againstHealth = phaseDamage(0, 0);
    let attacks = 0;
    let killed = initialPools.overguard + initialPools.shields + initialPools.health <= 0;

    const requiredAttacks = (pool: number, damagePerAttack: number): number => {
        if (pool <= 0) return 0;
        if (damagePerAttack <= 0) return Number.POSITIVE_INFINITY;
        const quotient = pool / damagePerAttack;
        if (!Number.isFinite(quotient) || quotient > Number.MAX_SAFE_INTEGER) return Number.POSITIVE_INFINITY;
        return Math.max(1, Math.ceil(quotient - Number.EPSILON * Math.max(1, quotient) * 4));
    };
    const applyPhase = (
        phaseAttacks: number,
        perAttack: Record<TargetDamagePool, number>,
    ) => {
        for (const pool of TARGET_POOLS) {
            const applied = Math.min(remainingPools[pool], perAttack[pool] * phaseAttacks);
            remainingPools[pool] = Math.max(0, remainingPools[pool] - applied);
            damageByPool[pool] += applied;
        }
        attacks += phaseAttacks;
    };

    if (remainingPools.overguard > 0) {
        const clearAttacks = requiredAttacks(remainingPools.overguard, againstOverguard.overguard);
        if (!Number.isFinite(clearAttacks)) return sequenceResult(null);
        applyPhase(clearAttacks, { ...againstOverguard, shields: 0, health: 0 });
    }

    if (remainingPools.health > 0 && remainingPools.shields > 0) {
        const clearShieldAttacks = requiredAttacks(remainingPools.shields, againstShields.shields);
        const killHealthAttacks = requiredAttacks(remainingPools.health, againstShields.health);
        if (!Number.isFinite(clearShieldAttacks) && !Number.isFinite(killHealthAttacks)) return sequenceResult(null);

        if (killHealthAttacks <= clearShieldAttacks) {
            applyPhase(killHealthAttacks, againstShields);
            killed = true;
        } else {
            applyPhase(clearShieldAttacks, { ...againstShields, overguard: 0 });
        }
    }

    if (!killed && remainingPools.health <= 0 && remainingPools.shields > 0) {
        const clearShieldAttacks = requiredAttacks(remainingPools.shields, againstShields.shields);
        if (!Number.isFinite(clearShieldAttacks)) return sequenceResult(null);
        applyPhase(clearShieldAttacks, { ...againstShields, overguard: 0, health: 0 });
    }

    if (!killed && remainingPools.health > 0) {
        if (initialPools.shields > 0 && input.enemyShieldGateHitMode !== "weakspot" && attacks > 0) {
            const lastAttackTime = attackEventTime(attacks - 1, {
                attackIntervalSeconds: attackInterval,
                shotsPerMagazine,
                reloadDurationSeconds: reloadDuration,
                burstCount: input.burstCount,
                burstDelaySeconds: input.burstDelaySeconds,
                burstCycleRate: input.burstCycleRate,
                autoSpoolCadenceRule: input.autoSpoolCadenceRule,
            });
            const gateEndTime = lastAttackTime + ENEMY_SHIELD_GATE_DURATION_SECONDS;
            const gateDamageMultiplier = input.enemyShieldGateHitMode === "blockedArea"
                ? 0
                : ENEMY_SHIELD_GATE_BODY_DAMAGE_MULTIPLIER;
            while (remainingPools.health > 0) {
                if (attackInterval <= 0) return sequenceResult(null);
                const attackTime = attackEventTime(attacks, {
                    attackIntervalSeconds: attackInterval,
                    shotsPerMagazine,
                    reloadDurationSeconds: reloadDuration,
                    burstCount: input.burstCount,
                    burstDelaySeconds: input.burstDelaySeconds,
                    burstCycleRate: input.burstCycleRate,
                    autoSpoolCadenceRule: input.autoSpoolCadenceRule,
                });
                if (!Number.isFinite(attackTime) || attackTime >= gateEndTime - 1e-9) break;
                const appliedHealthDamage = Math.min(
                    remainingPools.health,
                    againstHealth.health * gateDamageMultiplier,
                );
                remainingPools.health -= appliedHealthDamage;
                damageByPool.health += appliedHealthDamage;
                attacks++;
            }
        }
        if (remainingPools.health <= Number.EPSILON) killed = true;
    }

    if (!killed && remainingPools.health > 0) {
        const clearHealthAttacks = requiredAttacks(remainingPools.health, againstHealth.health);
        if (!Number.isFinite(clearHealthAttacks)) return sequenceResult(null);
        applyPhase(clearHealthAttacks, { ...againstHealth, overguard: 0, shields: 0 });
        killed = true;
    }

    killed ||= remainingPools.overguard + remainingPools.shields + remainingPools.health <= 0;
    return sequenceResult(killed ? attacks : null);

    function sequenceResult(attacksToKill: number | null): DirectAttackSequenceResult {
        if (attacksToKill !== null && !Number.isSafeInteger(attacksToKill)) attacksToKill = null;
        const timeToKillSeconds = attacksToKill === null
            ? null
            : attacksToKill <= 1
                ? 0
                : attackEventTime(attacksToKill - 1, {
                    attackIntervalSeconds: attackInterval,
                    shotsPerMagazine,
                    reloadDurationSeconds: reloadDuration,
                    burstCount: input.burstCount,
                    burstDelaySeconds: input.burstDelaySeconds,
                    burstCycleRate: input.burstCycleRate,
                    autoSpoolCadenceRule: input.autoSpoolCadenceRule,
                });
        return {
            attacksToKill,
            timeToKillSeconds: Number.isFinite(timeToKillSeconds) ? timeToKillSeconds : null,
            damageByPool: { ...damageByPool },
            remainingPools: { ...remainingPools },
            remainingArmorAfterBaseStrip: armorAfterBaseStrip,
            attackCountLimitReached: attacksToKill === null &&
                Number.isFinite(input.attackCountLimit) &&
                attacks >= maxSimulatedAttacks &&
                attackCountLimit < maxRampAttacks,
        };
    }
}

function applyStatusTickToPools(
    input: ExpectedWeaponEncounterInput,
    pools: Record<TargetDamagePool, number>,
    type: StatusDamageType,
    amount: number,
): Record<TargetDamagePool, number> {
    const damage = finiteNonNegative(amount);
    const dealt = zeroPools();
    if (damage <= 0) return dealt;
    const magneticMultiplier = Math.max(0, 1 + finiteSigned(input.magneticDefenseDamageBonus ?? 0));

    if (pools.overguard > 0) {
        dealt.overguard = Math.min(pools.overguard, damage * magneticMultiplier);
        return dealt;
    }

    const toxinBypassesShields = type === "toxin" && input.toxinBypassesShields !== false;
    if (pools.shields > 0 && !toxinBypassesShields) {
        dealt.shields = Math.min(pools.shields, damage * magneticMultiplier);
        return dealt;
    }

    // Slash status uses Cinematic damage: it bypasses Armor and has no faction
    // damage-type modifier, while still hitting the target's active pool.
    const isSlashBleed = type === "slash";
    const typeMultiplier = isSlashBleed
        ? 1
        : Math.max(0, 1 + factionDamageTypeModifier(input.faction, type));
    const viralMultiplier = Math.max(0, 1 + finiteSigned(input.viralHealthDamageBonus ?? 0));
    const armorMultiplier = isSlashBleed ? 1 : enemyArmorDamageMultiplier(input.armor);
    const hasArmor = Number.isFinite(input.armor) && input.armor > 0 && !isSlashBleed;
    const healthDamage = damage * typeMultiplier * viralMultiplier;
    const mitigatedHealthDamage = hasArmor
        ? Math.max(1, healthDamage * armorMultiplier)
        : healthDamage;
    dealt.health = Math.min(pools.health, mitigatedHealthDamage);
    return dealt;
}

function zeroPools(): Record<TargetDamagePool, number> {
    return { overguard: 0, shields: 0, health: 0 };
}

function addPools(
    target: Record<TargetDamagePool, number>,
    amount: Record<TargetDamagePool, number>,
): void {
    for (const pool of TARGET_POOLS) target[pool] += amount[pool];
}

function subtractPools(
    target: Record<TargetDamagePool, number>,
    amount: Record<TargetDamagePool, number>,
): void {
    for (const pool of TARGET_POOLS) target[pool] = Math.max(0, target[pool] - amount[pool]);
}

function sumPools(pools: Record<TargetDamagePool, number>): number {
    return TARGET_POOLS.reduce((sum, pool) => sum + pools[pool], 0);
}

function allPoolsEmpty(pools: Record<TargetDamagePool, number>): boolean {
    return TARGET_POOLS.every((pool) => pools[pool] <= Number.EPSILON);
}

interface AttackEventTiming {
    attackIntervalSeconds: number;
    shotsPerMagazine: number;
    reloadDurationSeconds: number;
    burstCount?: number;
    burstDelaySeconds?: number;
    burstCycleRate?: number;
    autoSpoolCadenceRule?: WeaponAutoSpoolCadenceRule;
}

const autoSpoolIntervalRatePrefixCache = new WeakMap<WeaponAutoSpoolCadenceRule, readonly number[]>();

function getAutoSpoolIntervalRatePrefixes(rule: WeaponAutoSpoolCadenceRule): readonly number[] {
    const cached = autoSpoolIntervalRatePrefixCache.get(rule);
    if (cached) return cached;

    const roundsToFullRate = Math.max(1, Math.floor(finiteNonNegative(rule.roundsToFullRate)));
    const startingRateFraction = finiteNonNegative(rule.startingRateFraction);
    const rateIncreasePerShotFraction = finiteNonNegative(rule.rateIncreasePerShotFraction);
    const prefixes = [0];
    // The simulator emits the first hit at t=0. An interval after k previous
    // hits therefore uses the starting rate plus k Wiki-listed increments.
    for (let roundsFired = 1; roundsFired <= roundsToFullRate; roundsFired++) {
        const rateFraction = roundsFired >= roundsToFullRate
            ? 1
            : Math.min(1, startingRateFraction + roundsFired * rateIncreasePerShotFraction);
        prefixes.push(prefixes[prefixes.length - 1] + 1 / Math.max(0.05, rateFraction));
    }

    autoSpoolIntervalRatePrefixCache.set(rule, prefixes);
    return prefixes;
}

function sumAutoSpoolIntervals(
    intervalCount: number,
    baseIntervalSeconds: number,
    rule: WeaponAutoSpoolCadenceRule,
): number {
    const prefixes = getAutoSpoolIntervalRatePrefixes(rule);
    const rampIntervals = Math.min(intervalCount, prefixes.length - 1);
    const fullRateIntervals = Math.max(0, intervalCount - rampIntervals);
    return baseIntervalSeconds * (prefixes[rampIntervals] + fullRateIntervals);
}

/** Time from the first damage event to an indexed event, including burst gaps and reloads. */
function attackEventTime(index: number, timing: AttackEventTiming): number {
    if (index <= 0) return 0;
    const burstCount = Number.isFinite(timing.burstCount)
        ? Math.max(1, Math.floor(timing.burstCount ?? 1))
        : 1;
    const burstDelay = finiteNonNegative(timing.burstDelaySeconds ?? 0);
    const burstCycleRate = finiteNonNegative(timing.burstCycleRate ?? 0);
    if (burstCount <= 1 || burstCycleRate <= 0) {
        const spoolRule = timing.autoSpoolCadenceRule;
        if (spoolRule) {
            const shotsPerMagazine = Math.max(1, Math.floor(timing.shotsPerMagazine));
            const magazineIndex = Math.floor(index / shotsPerMagazine);
            const shotInMagazine = index % shotsPerMagazine;
            const magazineIntervalSeconds = sumAutoSpoolIntervals(
                shotsPerMagazine,
                timing.attackIntervalSeconds,
                spoolRule,
            );
            const currentMagazineIntervalSeconds = sumAutoSpoolIntervals(
                shotInMagazine,
                timing.attackIntervalSeconds,
                spoolRule,
            );
            return magazineIndex * (magazineIntervalSeconds + timing.reloadDurationSeconds) +
                currentMagazineIntervalSeconds;
        }
        return index * timing.attackIntervalSeconds +
            Math.floor(index / timing.shotsPerMagazine) * timing.reloadDurationSeconds;
    }

    // `shotsPerMagazine` is the effective number of fired attacks before the
    // magazine empties, including attacks granted by ammo efficiency. The
    // burst schedule groups those events into trigger pulls. Work from the
    // shot's magazine position so a four-shot burst does not multiply the
    // magazine by four before inserting a reload. This also keeps a partial
    // final burst in the same magazine when its size is not divisible by the
    // burst count.
    const shotsPerMagazine = Math.max(1, Math.floor(timing.shotsPerMagazine));
    const magazineIndex = Math.floor(index / shotsPerMagazine);
    const shotInMagazine = index % shotsPerMagazine;
    const triggersPerMagazine = Math.ceil(shotsPerMagazine / burstCount);
    const triggerInMagazine = Math.floor(shotInMagazine / burstCount);
    const shotInBurst = shotInMagazine % burstCount;
    const burstCycleSeconds = 1 / burstCycleRate + (burstCount - 1) * burstDelay;
    return magazineIndex * (triggersPerMagazine * burstCycleSeconds + timing.reloadDurationSeconds) +
        triggerInMagazine * burstCycleSeconds +
        shotInBurst * burstDelay;
}

function isEncounterTargetDefeated(
    initialHealth: number,
    pools: Record<TargetDamagePool, number>,
): boolean {
    return initialHealth > 0 ? pools.health <= Number.EPSILON : allPoolsEmpty(pools);
}

function heapPush(heap: ScheduledStatusTick[], item: ScheduledStatusTick): void {
    let index = heap.length;
    heap.push(item);
    while (index > 0) {
        const parent = (index - 1) >> 1;
        if (compareTicks(heap[parent], item) <= 0) break;
        heap[index] = heap[parent];
        index = parent;
    }
    heap[index] = item;
}

function heapPop(heap: ScheduledStatusTick[]): ScheduledStatusTick | undefined {
    if (heap.length === 0) return undefined;
    const first = heap[0];
    const last = heap.pop()!;
    if (heap.length === 0) return first;
    let index = 0;
    while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= heap.length) break;
        const child = right < heap.length && compareTicks(heap[right], heap[left]) < 0 ? right : left;
        if (compareTicks(last, heap[child]) <= 0) break;
        heap[index] = heap[child];
        index = child;
    }
    heap[index] = last;
    return first;
}

function compareTicks(left: ScheduledStatusTick, right: ScheduledStatusTick): number {
    return left.time - right.time || left.sequence - right.sequence;
}

function finiteNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function finiteSigned(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

function probabilityAtLeastOnePoissonArrival(expectedArrivals: number): number {
    const mean = finiteNonNegative(expectedArrivals);
    if (mean <= 0) return 0;
    if (mean >= 20) return 1;
    return -Math.expm1(-mean);
}

/**
 * Probability that an attack applies a selected status type at least once.
 * `statusRollsPerAttack` is projectile count × per-projectile status chance;
 * weighted type selection occurs independently for every proc roll. Fractional
 * status chance and multishot represent independent bonus-roll/projectile
 * chances, matching the current Wiki rules for [Status Chance](https://wiki.warframe.com/w/Status_Chance)
 * and [Multishot](https://wiki.warframe.com/w/Multishot).
 */
function probabilityAtLeastOneWeightedStatusType(
    projectileCountRaw: number,
    statusRollsPerAttackRaw: number,
    typeProbabilityRaw: number,
    statusChanceMultiplierRaw = 1,
): number {
    const projectileCount = finiteNonNegative(projectileCountRaw);
    const typeProbability = clampProbability(typeProbabilityRaw);
    if (projectileCount <= 0 || typeProbability <= 0) return 0;

    const statusChancePerProjectile = finiteNonNegative(statusRollsPerAttackRaw) / projectileCount *
        finiteNonNegative(statusChanceMultiplierRaw);
    if (statusChancePerProjectile <= 0) return 0;

    const wholeRolls = Math.floor(statusChancePerProjectile);
    const fractionalRoll = statusChancePerProjectile - wholeRolls;
    const noProcTypePerProjectile = Math.pow(1 - typeProbability, wholeRolls) *
        (1 - fractionalRoll * typeProbability);
    const wholeProjectiles = Math.floor(projectileCount);
    const fractionalProjectile = projectileCount - wholeProjectiles;
    const noProcTypeForWholeProjectiles = Math.pow(noProcTypePerProjectile, wholeProjectiles);
    const noProcTypeForAttack = noProcTypeForWholeProjectiles *
        (1 - fractionalProjectile * (1 - noProcTypePerProjectile));
    return clampProbability(1 - noProcTypeForAttack);
}

function clampProbability(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function scaleStatusStacks(stacks: number, first: number, additional: number, cap: number): number {
    if (stacks <= 0) return 0;
    if (stacks <= 1) return first * stacks;
    return Math.min(cap, first + additional * (stacks - 1));
}

function getHeatArmorStripAtTime(
    time: number,
    state: HeatArmorStripState | null,
    statusDurationMultiplier: number,
): number {
    if (!state || state.activeWeight <= 0 || statusDurationMultiplier <= 0) return 0;
    const rampStepSeconds = 0.5 * statusDurationMultiplier;
    const rampSteps = [0, 0.15, 0.3, 0.4, 0.5];
    const rampIndex = Math.max(0, Math.min(rampSteps.length - 1,
        Math.floor((time - state.firstAppliedAt) / rampStepSeconds + 1e-9)));
    const stripAtExpiration = rampSteps[rampIndex];
    const statusExpiration = state.lastAppliedAt + state.durationSeconds;
    if (time <= statusExpiration + 1e-9) return stripAtExpiration * state.activeWeight;

    const recoveryStepSeconds = Math.max(0.001, state.durationSeconds / 4);
    const recoverySteps = [0.5, 0.4, 0.3, 0.15, 0];
    const recoveryIndex = Math.max(0, Math.min(recoverySteps.length - 1,
        Math.floor((time - statusExpiration) / recoveryStepSeconds + 1e-9)));
    return Math.min(stripAtExpiration, recoverySteps[recoveryIndex]) * state.activeWeight;
}

export interface TargetPoolShares {
    overguard: number;
    shields: number;
    health: number;
}

export type TargetPoolMultipliers = Partial<Record<TargetDamagePool, number>>;
const TARGET_POOLS: readonly TargetDamagePool[] = ["overguard", "shields", "health"];

/**
 * Converts damage against separate defense pools into progress through the
 * normalized total target profile. A damage type may bypass pools it cannot
 * affect (for example, Toxin bypasses Shields but still has to clear Overguard).
 * This is an expected pool-time model; it does not simulate mixed-type hit order,
 * shield gates, pool overflow, or status history.
 */
export function effectiveDamageProgressMultiplier(
    shares: TargetPoolShares,
    multipliers: TargetPoolMultipliers,
    bypassedPools: readonly TargetDamagePool[] = [],
): number {
    let timePerNormalizedPool = 0;

    for (const pool of TARGET_POOLS) {
        if (bypassedPools.includes(pool)) continue;
        const share = Number.isFinite(shares[pool]) ? Math.max(0, shares[pool]) : 0;
        if (share <= 0) continue;
        const multiplier = Number.isFinite(multipliers[pool])
            ? Math.max(0, multipliers[pool] ?? 0)
            : 0;
        if (multiplier <= 0) return 0;
        timePerNormalizedPool += share / multiplier;
    }

    return timePerNormalizedPool > 0 && Number.isFinite(timePerNormalizedPool)
        ? 1 / timePerNormalizedPool
        : 0;
}
