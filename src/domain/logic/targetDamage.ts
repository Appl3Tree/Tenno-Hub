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
    MAGNETIC_BREAK_ELECTRIC_DAMAGE_PER_STACK,
    MAGNETIC_BREAK_ELECTRIC_DURATION_SECONDS,
    quantizeDamageContribution,
    type DamageType,
    type StatusDamageType,
} from "./damageRuleset";
import type { WeaponDamageRampRule, WeaponUniqueStatusType } from "../catalog/weaponCatalog";
import {
    getHeavyAttackRetainedComboPoints,
    INITIAL_COMBO_REGEN_POINTS_PER_SECOND,
} from "../catalog/weaponRules";
import { advanceDamageRampMultiplier, getInitialDamageRampMultiplier } from "./weaponDamageRamp";

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
    /** Expected critical multiplier after any supported target-state bonuses. */
    expectedCritMultiplier?: number;
    /** Base post-mod critical chance/multiplier for encounter status-state updates. */
    critChance?: number;
    critMultiplier?: number;
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
    const armor = finiteNonNegative(input.armor);
    const projectileCount = finiteNonNegative(input.expectedProjectiles ?? 1);
    const expectedDamageMultiplier = finiteNonNegative(input.expectedDamageMultiplier ?? projectileCount);
    const critMultiplier = finiteNonNegative(input.expectedCritMultiplier ?? 1);
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

    const expectedScale = expectedDamageMultiplier * critMultiplier;
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
    /** Reload time added after a full magazine, before the next attack interval. */
    reloadDurationSeconds?: number;
    /** Number of damage events in each burst, when this attack has burst metadata. */
    burstCount?: number;
    /** Delay between shots inside a burst, after fire-rate modifiers. */
    burstDelaySeconds?: number;
    /** Burst-start frequency, after fire-rate modifiers. */
    burstCycleRate?: number;
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
    /** Reload time after each full magazine. */
    reloadDurationSeconds?: number;
    /** Number of damage events in each burst, when this attack has burst metadata. */
    burstCount?: number;
    /** Delay between shots inside a burst, after fire-rate modifiers. */
    burstDelaySeconds?: number;
    /** Burst-start frequency, after fire-rate modifiers. */
    burstCycleRate?: number;
    /** Hit behavior during the short enemy Shield Gate. Defaults to an ordinary body hit. */
    enemyShieldGateHitMode?: "body" | "weakspot" | "blockedArea";
    /** Status duration multiplier used when resolving the build's DoT totals. */
    statusDurationMultiplier?: number;
    /** Maximum pool values for effects based on the target's starting defenses. */
    maxShields?: number;
    maxOverguard?: number;
    /** Additional same-profile enemies assumed inside Blast's 5m cap/death radial. */
    nearbyBlastEnemyCount?: number;
    /** Additional same-profile enemies assumed inside active Electricity/Gas radii. */
    nearbyElectricGasEnemyCount?: number;
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
    /** Expected ordinary status applications per attack when dynamic proc weights are unavailable. */
    expectedStatusApplicationsPerAttackByType?: Partial<Record<StatusDamageType, number>>;
    /** Quantized final damage weights used to recalculate proc weighting as pools change. */
    statusProcWeightsByType?: Partial<Record<StatusDamageType, number>>;
    /** Expected ordinary status rolls per attack (multishot × status chance). */
    statusRollsPerAttack?: number;
    /** Forced and status-triggered applications, independent of ordinary proc weighting. */
    forcedStatusApplicationsPerAttackByType?: Partial<Record<StatusDamageType, number>>;
    /** Target status immunities and encounter-specific stack caps. */
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
    /** Guaranteed unique non-damage statuses applied by each attack, such as Nukor's Microwave. */
    uniqueStatusProcsPerAttack?: readonly WeaponUniqueStatusType[];
    /** Weapon passive's per-status direct-hit bonus, if any. */
    intrinsicDamagePerStatusBonus?: number;
    /** Whether the weapon passive adds to or multiplies the ordinary base-damage bracket. */
    intrinsicDamagePerStatusMode?: "additiveBase" | "multiplicativeBase";
    /** Existing additive base Damage bracket before per-status bonuses. */
    totalDamageBonus?: number;
    /** Hard stops keep malformed profiles from running unbounded simulations. */
    maxDurationSeconds?: number;
    maxAttacks?: number;
}

export interface ExpectedWeaponEncounterResult {
    attacks: number;
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
    totalDamage: number;
    damagePerAttack: number;
    damagePerSecond: number;
}

interface ScheduledStatusTick {
    time: number;
    sequence: number;
    type: StatusDamageType | "coldFreezeEnd";
    damage: number;
    /** Heat stacks share one refreshable tick stream; resolve its damage when the tick lands. */
    dynamicHeat?: boolean;
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
 * stack tick events are reduced with oldest-stack replacement. Cross-source
 * Heat, neighbor status/position histories, Gas radius membership, attenuation,
 * and TTK distributions are not simulated. Enemy Shield Gates reduce direct
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
    const maximumShields = finiteNonNegative(input.maxShields ?? remainingPools.shields);
    const maximumOverguard = finiteNonNegative(input.maxOverguard ?? remainingPools.overguard);
    const directDamageByPool = zeroPools();
    const statusDamageByPool = zeroPools();
    const blastCollateralDamageByPool = zeroPools();
    const electricGasCollateralDamageByPool = zeroPools();
    const electricGasCollateralEnemyCount = Number.isFinite(input.nearbyElectricGasEnemyCount)
        ? Math.max(0, Math.min(20, Math.floor(input.nearbyElectricGasEnemyCount ?? 0)))
        : 0;
    const electricGasCollateralTargets = Array.from({ length: electricGasCollateralEnemyCount }, () => ({
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
    const reloadDuration = finiteNonNegative(input.reloadDurationSeconds ?? 0);
    const shotsPerMagazine = Number.isFinite(input.shotsPerMagazine)
        ? Math.max(1, Math.floor(input.shotsPerMagazine ?? 1))
        : Number.MAX_SAFE_INTEGER;
    const maxDurationSeconds = Number.isFinite(input.maxDurationSeconds)
        ? Math.max(0, input.maxDurationSeconds ?? 0)
        : 600;
    const maxAttacks = Number.isFinite(input.maxAttacks)
        ? Math.max(0, Math.floor(input.maxAttacks ?? 0))
        : 20_000;
    const ticks: ScheduledStatusTick[] = [];
    const groupedElectricTicks = new Map<number, ScheduledStatusTick>();
    const statusImmuneTypes = new Set(input.statusImmuneTypes ?? []);
    const statusStackQueues = new Map<StatusDamageType, ExpectedStatusStackQueue>();
    const activeUniqueStatusTypes = new Set<WeaponUniqueStatusType>();
    const blastStackEntries: ExpectedBlastStackEntry[] = [];
    const cancelledTickSequences = new Set<number>();
    const heatArmorStripState: { current: HeatArmorStripState | null } = { current: null };
    const heatDotState: { current: HeatDotState | null } = { current: null };
    let coldFreezeUntil: number | null = null;
    let enemyShieldGateUntil = Number.NEGATIVE_INFINITY;
    let nextTickSequence = 0;
    let attackIndex = 0;
    let attacks = 0;
    let now = 0;
    let killed = allPoolsEmpty(remainingPools);
    let primaryKilledAt = killed ? 0 : null;
    const durationMultiplier = Math.max(0, finiteNonNegative(input.statusDurationMultiplier ?? 1));
    let previousRampAttackTime: number | null = null;
    let activeDamageRampMultiplier = getInitialDamageRampMultiplier(input.damageRampRule);

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
    const ordinaryStatusChanceMultiplier = (): number =>
        1 + Math.min(1, Math.min(10, stackCount("tau")) * 0.1);
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

    const expectedStatusApplicationsForCurrentPools = () => {
        const ordinaryApplications: Partial<Record<StatusDamageType, number>> = {};
        const forcedApplications: Partial<Record<StatusDamageType, number>> = {};
        const applications: Partial<Record<StatusDamageType, number>> = {};
        const presenceProbabilities: Partial<Record<StatusDamageType, number>> = {};
        const canReweight = input.statusProcWeightsByType !== undefined && input.statusRollsPerAttack !== undefined;
        const immuneTypes = new Set(statusImmuneTypes);
        // Enemy Overguard blocks Radiation's confusion effect, while Magnetic
        // has no defensive effect once both Overguard and Shields are gone.
        if (remainingPools.overguard > 0) immuneTypes.add("radiation");
        if (remainingPools.overguard <= 0 && remainingPools.shields <= 0) immuneTypes.add("magnetic");
        if (canReweight) {
            const totalWeight = STATUS_DAMAGE_TYPES.reduce((sum, type) => {
                if (immuneTypes.has(type)) return sum;
                return sum + finiteNonNegative(input.statusProcWeightsByType?.[type] ?? 0);
            }, 0);
            const rolls = finiteNonNegative(input.statusRollsPerAttack ?? 0);
            if (totalWeight > 0 && rolls > 0) {
                const tauVulnerability = ordinaryStatusChanceMultiplier();
                for (const type of STATUS_DAMAGE_TYPES) {
                    if (immuneTypes.has(type)) continue;
                    const weight = finiteNonNegative(input.statusProcWeightsByType?.[type] ?? 0);
                    if (weight > 0) {
                        const typeMultiplier = type === "tau" ? 1 : tauVulnerability;
                        ordinaryApplications[type] = rolls * weight / totalWeight * typeMultiplier;
                    }
                }
            }
        } else {
            const expectedApplications = input.expectedStatusApplicationsPerAttackByType;
            const tauVulnerability = ordinaryStatusChanceMultiplier();
            for (const [rawType, rawCount] of Object.entries(expectedApplications ?? {}) as Array<[StatusDamageType, number]>) {
                if (immuneTypes.has(rawType)) continue;
                const typeMultiplier = rawType === "tau" ? 1 : tauVulnerability;
                ordinaryApplications[rawType] = finiteNonNegative(rawCount) * typeMultiplier;
            }
        }

        for (const [type, rawApplications] of Object.entries(input.forcedStatusApplicationsPerAttackByType ?? {}) as Array<[StatusDamageType, number]>) {
            if (immuneTypes.has(type)) continue;
            const count = finiteNonNegative(rawApplications);
            if (count > 0) forcedApplications[type] = count;
        }

        for (const type of STATUS_DAMAGE_TYPES) {
            if (immuneTypes.has(type)) continue;
            const ordinary = finiteNonNegative(ordinaryApplications[type] ?? 0);
            const forced = finiteNonNegative(forcedApplications[type] ?? 0);
            const total = ordinary + forced;
            if (total <= 0) continue;
            applications[type] = total;
            // Ordinary rolls use a Poisson mean-field; forced/status-triggered
            // applications are independent and use their expected count as a
            // bounded event probability. This keeps their source separate from
            // ordinary status chance and preserves fractional Cedo effects.
            const ordinaryPresence = probabilityAtLeastOnePoissonArrival(ordinary);
            const forcedPresence = Math.min(1, forced);
            presenceProbabilities[type] = 1 - (1 - ordinaryPresence) * (1 - forcedPresence);
        }
        return { applications, ordinaryApplications, forcedApplications, presenceProbabilities };
    };

    const applyExpectedStatusApplications = (
        attackTime: number,
        applicationsByType: Partial<Record<StatusDamageType, number>>,
        presenceProbabilitiesByType: Partial<Record<StatusDamageType, number>> = {},
        attackDamageRampMultiplier = 1,
        conditionOverloadDamageMultiplier = 1,
        gasCloudGroup?: GasCloudTickGroup,
    ) => {
        for (const [type, rawApplications] of Object.entries(applicationsByType) as Array<[StatusDamageType, number]>) {
            const applications = finiteNonNegative(rawApplications);
            const presenceProbability = clampProbability(
                presenceProbabilitiesByType[type] ?? probabilityAtLeastOnePoissonArrival(applications),
            );
            const duration = STATUS_EFFECT_RULES[type].durationSeconds * durationMultiplier;
            if (applications <= 0 || (type !== "blast" && duration <= 0) || statusImmuneTypes.has(type)) continue;
            if (type === "cold" && coldFreezeUntil !== null && attackTime < coldFreezeUntil - 1e-9) continue;
            if (type === "radiation" && remainingPools.overguard > 0) continue;
            if (type === "magnetic" && remainingPools.overguard <= 0 && remainingPools.shields <= 0) continue;

            let cap = STATUS_EFFECT_RULES[type].maxStacks ?? Number.POSITIVE_INFINITY;
            const targetCap = input.statusStackCaps?.[type];
            if (Number.isFinite(targetCap) && (targetCap ?? 0) >= 0) cap = Math.min(cap, targetCap ?? cap);
            if (type === "cold" && remainingPools.overguard > 0) cap = Math.min(cap, 4);

            let queue = statusStackQueues.get(type);
            if (type === "heat") {
                const previousHeatState = heatArmorStripState.current;
                const canRefresh = previousHeatState !== null &&
                    attackTime < previousHeatState.lastAppliedAt + duration - 1e-9;
                heatArmorStripState.current = {
                    firstAppliedAt: canRefresh ? previousHeatState.firstAppliedAt : attackTime,
                    lastAppliedAt: attackTime,
                    activeWeight: Math.min(1, (canRefresh ? previousHeatState.activeWeight : 0) + applications),
                };
                if (queue) {
                    for (let index = queue.head; index < queue.entries.length; index++) {
                        queue.entries[index].expiresAt = attackTime + duration;
                    }
                }
            }
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
            const hasDynamicStatusApplications = input.statusProcWeightsByType !== undefined && input.statusRollsPerAttack !== undefined;
            const hasBlastHitDamage = input.blastStackHitDamagePerProc !== undefined;
            if (type === "blast" && (input.expectedStatusApplicationsPerAttackByType?.blast !== undefined || hasDynamicStatusApplications || hasBlastHitDamage)) {
                const legacyExpiryDamagePerStack = finiteNonNegative(input.blastDamagePerAttack ?? 0) * attackDamageRampMultiplier / applications;
                const hitDamagePerStack = hasBlastHitDamage
                    ? finiteNonNegative(input.blastStackHitDamagePerProc ?? 0) *
                        conditionOverloadDamageMultiplier * attackDamageRampMultiplier
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
            } else {
                addedStacks = Math.min(applications, Math.max(0, cap - queue.totalStacks));
            }
            if (addedStacks <= 0) {
                if (type === "gas" && gasCloudGroup) updateGasCloudActiveStacks(gasCloudGroup, 0);
                continue;
            }
            queue.entries.push({
                expiresAt: attackTime + duration,
                stacks: addedStacks,
                presenceProbability,
                ...(type === "gas" && gasCloudGroup ? { gasCloud: gasCloudGroup } : {}),
            });
            addStatusPresence(queue, presenceProbability);
            queue.totalStacks += addedStacks;
            statusApplicationsByType[type] = (statusApplicationsByType[type] ?? 0) + addedStacks;

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
                const perApplicationDamage = finiteNonNegative(input.dotDamagePerApplicationByType?.heat ?? 0);
                const tickCount = countStatusDamageTicks("heat", duration);
                const seedTickDamage = finiteNonNegative(input.heatDotTickDamagePerProc ??
                    (tickCount > 0 ? perApplicationDamage / tickCount : 0)) *
                    conditionOverloadDamageMultiplier * attackDamageRampMultiplier;
                const accumulatorTickDamage = finiteNonNegative(input.heatDotAccumulatorDamagePerTick ?? 0);
                if ((seedTickDamage > 0 || accumulatorTickDamage > 0) && tickCount > 0) {
                    const previousHeatDot = heatDotState.current;
                    const remainsActive = previousHeatDot !== null && attackTime <= previousHeatDot.expiresAt + 1e-9;
                    const nextTickAt = remainsActive ? previousHeatDot.nextTickAt : attackTime + 1;
                    heatDotState.current = {
                        expiresAt: attackTime + duration,
                        nextTickAt,
                        tickDamage: (remainsActive ? previousHeatDot.tickDamage : 0) +
                            seedTickDamage * addedStacks,
                        accumulatorDamage: accumulatorTickDamage,
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

    const scheduleMagneticBreakProc = (time: number, pool: "overguard" | "shields") => {
        if (statusImmuneTypes.has("electricity") || durationMultiplier <= 0) return;
        const magneticStacks = stackCount("magnetic");
        if (magneticStacks <= 0) return;
        const poolMaximum = pool === "overguard" ? maximumOverguard : maximumShields;
        const sourceMultiplier = finiteNonNegative(input.magneticBreakElectricSourceMultiplier ?? 1);
        const totalDamage = poolMaximum * MAGNETIC_BREAK_ELECTRIC_DAMAGE_PER_STACK * magneticStacks *
            sourceMultiplier * durationMultiplier;
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

    const currentStatusModifiers = (time: number) => {
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
        const weaponStatusTypeCount = [...statusStackQueues.values()].reduce(
            (count, queue) => count + expectedStatusPresence(queue),
            0,
        );
        const externalConditionOverloadStatusTypeCount = Math.max(
            0,
            Math.min(16, Math.floor(finiteNonNegative(input.externalConditionOverloadStatusTypeCount ?? 0))),
        );
        const activeStatusTypeCount = Math.min(
            16,
            weaponStatusTypeCount + activeUniqueStatusTypes.size + externalConditionOverloadStatusTypeCount,
        );
        const directDamageStatusTypeCount = [...statusStackQueues.entries()].reduce(
            (count, [type, queue]) => count + (type === "tau" ? 0 : expectedStatusPresence(queue)),
            0,
        ) + activeUniqueStatusTypes.size;
        const damageBracket = Math.max(0.0001, 1 + finiteSigned(input.totalDamageBonus ?? 0));
        const conditionOverloadDamagePerStatusBonus =
            finiteNonNegative(input.conditionOverloadDamagePerStatusBonus ?? 0);
        const conditionOverloadDamageBracket = damageBracket +
            conditionOverloadDamagePerStatusBonus * Math.min(16, activeStatusTypeCount);
        const conditionOverloadDamageMultiplier = conditionOverloadDamageBracket / damageBracket;
        const directDamagePerStatusWeight =
            finiteNonNegative(input.directDamagePerStatusBonus ?? 0) * directDamageStatusTypeCount;
        const intrinsicDamagePerStatusWeight =
            finiteNonNegative(input.intrinsicDamagePerStatusBonus ?? 0) * directDamageStatusTypeCount;
        const damageBracketWithIntrinsicBonus = input.intrinsicDamagePerStatusMode === "multiplicativeBase"
            ? conditionOverloadDamageBracket * (1 + intrinsicDamagePerStatusWeight)
            : conditionOverloadDamageBracket + intrinsicDamagePerStatusWeight;
        const directDamagePerStatusMultiplier =
            (damageBracketWithIntrinsicBonus + directDamagePerStatusWeight) /
            conditionOverloadDamageBracket;
        const critMultiplier = input.critChance !== undefined && input.critMultiplier !== undefined
            ? expectedCritMultiplier(input.critChance + punctureCritBonus, input.critMultiplier + coldCritBonus)
            : finiteNonNegative(input.expectedCritMultiplier ?? 1);
        return {
            armor: finiteNonNegative(input.armor) * (1 - corrosiveStrip) * (1 - heatArmorStrip),
            viralHealthDamageBonus: finiteNonNegative(input.viralHealthDamageBonus ?? 0) + viralBonus,
            magneticDefenseDamageBonus: finiteNonNegative(input.magneticDefenseDamageBonus ?? 0) + magneticBonus,
            expectedCritMultiplier: critMultiplier,
            conditionOverloadDamageMultiplier,
            directDamagePerStatusMultiplier,
        };
    };

    const nextAttackTime = (index: number): number => attackEventTime(index, {
        attackIntervalSeconds: attackInterval,
        shotsPerMagazine,
        reloadDurationSeconds: reloadDuration,
        burstCount: input.burstCount,
        burstDelaySeconds: input.burstDelaySeconds,
        burstCycleRate: input.burstCycleRate,
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
                ) * applications * attackDamageRampMultiplier
                : perApplicationDamage !== undefined
                    ? finiteNonNegative(perApplicationDamage) * applications *
                        conditionOverloadDamageMultiplier * attackDamageRampMultiplier
                    : finiteNonNegative(totalDamage) * conditionOverloadDamageMultiplier * attackDamageRampMultiplier;
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
        const blastDamage = finiteNonNegative(input.blastDamagePerAttack ?? 0) * attackDamageRampMultiplier;
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

    while ((!killed && attacks < maxAttacks) || ticks.length > 0) {
        while (ticks[0] && cancelledTickSequences.delete(ticks[0].sequence)) heapPop(ticks);
        const attackTime = !killed && attacks < maxAttacks
            ? nextAttackTime(attackIndex)
            : Number.POSITIVE_INFINITY;
        const nextTick = ticks[0];
        const nextTickTime = nextTick?.time ?? Number.POSITIVE_INFINITY;
        const attackComesFirst = attackTime <= nextTickTime + 1e-9;
        if (attackComesFirst) {
            if (!Number.isFinite(attackTime) || attackTime > maxDurationSeconds + 1e-9 || attackInterval <= 0) break;
            now = attackTime;
            expireStatusStacks(now);
            const attackDamageRampMultiplier = rampMultiplierForAttack(attackTime, attackIndex);
            const statusModifiers = currentStatusModifiers(now);
            const conditionOverloadDamageMultiplier = statusModifiers.conditionOverloadDamageMultiplier ?? 1;
            const directDamagePerStatusMultiplier = statusModifiers.directDamagePerStatusMultiplier ?? 1;
            const combinedDamageMultiplier = conditionOverloadDamageMultiplier * directDamagePerStatusMultiplier;
            const canRequantizeDynamicPerStatusDamage =
                input.rawDamageByType !== undefined && Number.isFinite(input.baseDamageTotal);
            const damageBracket = Math.max(0.0001, 1 + finiteSigned(input.totalDamageBonus ?? 0));
            const dynamicQuantizationBase = finiteNonNegative(input.baseDamageTotal ?? 0) *
                damageBracket * combinedDamageMultiplier;
            const damageByType = Object.fromEntries(DAMAGE_TYPES.map((type) => [
                type,
                canRequantizeDynamicPerStatusDamage
                    ? quantizeDamageContribution(
                        finiteSigned(input.rawDamageByType?.[type] ?? 0) * combinedDamageMultiplier,
                        dynamicQuantizationBase,
                    )
                    : finiteNonNegative(input.damageByType[type] ?? 0) * combinedDamageMultiplier,
            ])) as Partial<Record<DamageType, number>>;
            const poolsBeforeAttack = { ...remainingPools };
            const result = calculateDirectDamageToInitialPools({
                ...input,
                ...statusModifiers,
                damageByType,
                damageRampMultiplier: attackDamageRampMultiplier,
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
            if (poolsBeforeAttack.overguard > 0 && remainingPools.overguard <= Number.EPSILON) {
                scheduleMagneticBreakProc(attackTime, "overguard");
            }
            if (poolsBeforeAttack.shields > 0 && remainingPools.shields <= Number.EPSILON) {
                enemyShieldGateUntil = attackTime + ENEMY_SHIELD_GATE_DURATION_SECONDS;
                scheduleMagneticBreakProc(attackTime, "shields");
            }
            attacks++;
            attackIndex++;
            const attackStatusState = expectedStatusApplicationsForCurrentPools();
            const gasCloudGroup = scheduleAttackDots(
                attackTime,
                attackStatusState.applications,
                attackDamageRampMultiplier,
                conditionOverloadDamageMultiplier,
            );
            applyExpectedStatusApplications(
                attackTime,
                attackStatusState.applications,
                attackStatusState.presenceProbabilities,
                attackDamageRampMultiplier,
                conditionOverloadDamageMultiplier,
                gasCloudGroup,
            );
            for (const uniqueStatus of input.uniqueStatusProcsPerAttack ?? []) {
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
            if ((tick.type === "electricity" || tick.type === "gas") && electricGasCollateralTargets.length > 0) {
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
            }
            if (poolsBeforeTick.overguard > 0 && remainingPools.overguard <= Number.EPSILON) {
                scheduleMagneticBreakProc(now, "overguard");
            }
            if (poolsBeforeTick.shields > 0 && remainingPools.shields <= Number.EPSILON) {
                enemyShieldGateUntil = now + ENEMY_SHIELD_GATE_DURATION_SECONDS;
                scheduleMagneticBreakProc(now, "shields");
            }
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
    const evaluatedDurationSeconds = primaryKilledAt ?? maxDurationSeconds;
    const rateDuration = evaluatedDurationSeconds > 0
        ? evaluatedDurationSeconds
        : attacks > 0 ? attackInterval : 0;
    return {
        attacks,
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
    const attackInterval = finiteNonNegative(input.attackIntervalSeconds);
    const reloadDuration = finiteNonNegative(input.reloadDurationSeconds ?? 0);
    const shotsPerMagazine = Number.isFinite(input.shotsPerMagazine)
        ? Math.max(1, Math.floor(input.shotsPerMagazine ?? 1))
        : Number.MAX_SAFE_INTEGER;

    if (input.damageRampRule || input.heavyAttackCombo) {
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
        const maxRampAttacks = 100_000;
        for (let index = 0; index < maxRampAttacks; index++) {
            const attackTime = attackEventTime(index, {
                attackIntervalSeconds: attackInterval,
                shotsPerMagazine,
                reloadDurationSeconds: reloadDuration,
                burstCount: input.burstCount,
                burstDelaySeconds: input.burstDelaySeconds,
                burstCycleRate: input.burstCycleRate,
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
            let currentComboMultiplier = combo?.startingMultiplier ?? 1;
            let expectedCritMultiplier = input.expectedCritMultiplier;
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
                expectedCritMultiplier = 1 + currentCritChance * (combo.critDamageMultiplier - 1);
            }
            const result = calculateDirectDamageToInitialPools({
                ...input,
                damageByType,
                expectedCritMultiplier,
                damageRampMultiplier: rampMultiplier,
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
                });
        return {
            attacksToKill,
            timeToKillSeconds: Number.isFinite(timeToKillSeconds) ? timeToKillSeconds : null,
            damageByPool: { ...damageByPool },
            remainingPools: { ...remainingPools },
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
        return index * timing.attackIntervalSeconds +
            Math.floor(index / timing.shotsPerMagazine) * timing.reloadDurationSeconds;
    }

    const triggerIndex = Math.floor(index / burstCount);
    const shotInBurst = index % burstCount;
    const triggersPerMagazine = Math.max(1, Math.floor(timing.shotsPerMagazine));
    const reloadCycles = Math.floor(triggerIndex / triggersPerMagazine);
    const triggerInMagazine = triggerIndex % triggersPerMagazine;
    const burstCycleSeconds = 1 / burstCycleRate + (burstCount - 1) * burstDelay;
    return reloadCycles * (triggersPerMagazine * burstCycleSeconds + timing.reloadDurationSeconds) +
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

function clampProbability(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function scaleStatusStacks(stacks: number, first: number, additional: number, cap: number): number {
    if (stacks <= 0) return 0;
    if (stacks <= 1) return first * stacks;
    return Math.min(cap, first + additional * (stacks - 1));
}

function expectedCritMultiplier(critChance: number, critMultiplier: number): number {
    if (critChance <= 0) return 1;
    return 1 + critChance * (critMultiplier - 1);
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
    const statusExpiration = state.lastAppliedAt + 6 * statusDurationMultiplier;
    if (time <= statusExpiration + 1e-9) return stripAtExpiration * state.activeWeight;

    const recoveryStepSeconds = 1.5 * statusDurationMultiplier;
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
