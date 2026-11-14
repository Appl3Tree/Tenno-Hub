// src/domain/logic/damageCalc.ts
// Damage + status calculations for the mod builder / optimizer.

import type { IntrinsicDamagePerStatusMode, WeaponEntry, WeaponForcedProcType } from "../catalog/weaponCatalog";
import {
    clampMeleeComboMultiplier,
    getHeavyAttackRetainedComboPoints,
    getMeleeComboPointsAtTier,
    getMeleeInnateInitialComboPoints,
    getInitialMeleeComboMultiplier,
    usesMeleeDamageModel,
} from "../catalog/weaponRules";
import type { ConditionalEffect, ModEffect, NonCriticalHitDamageProc } from "../catalog/modCatalog";
import {
    DAMAGE_TYPES,
    STATUS_DAMAGE_TYPES,
    STATUS_EFFECT_RULES,
    blastStackExpiryDamage,
    countFiniteEncounterStatusTicks,
    countStatusDamageTicks,
    probabilityAtLeastOneStatusProc,
    quantizeBaseCriticalDamageMultiplier,
    quantizeDamageContribution,
    statusDotTickDamage,
    type DamageType,
    type StatusDamageType,
} from "./damageRuleset";
import { calculateDamageRampMultipliers } from "./weaponDamageRamp";

type DamageKey = DamageType;

const DAMAGE_KEYS: DamageKey[] = [...DAMAGE_TYPES];

const PRIMARY_ELEMENTS: DamageKey[] = ["heat", "cold", "electricity", "toxin"];

const COMBINED_ELEMENTS: Record<string, DamageKey> = {
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

function isBowWeapon(weapon: WeaponEntry): boolean {
    return weapon.weaponType.trim().toLowerCase() === "bow";
}

function moddedChargeTimeSeconds(weapon: WeaponEntry, rateBonus: number): number {
    if (weapon.trigger !== "Charge" || weapon.chargeTime === null || weapon.chargeTime <= 0) return 0;
    return weapon.chargeTime / Math.max(0.1, 1 + rateBonus);
}

function effectiveFireRate(
    weapon: WeaponEntry,
    rateBonus: number,
    ammoCostPerShot = weapon.ammoCostPerShot,
    reloadTime = weapon.reloadTime,
    includeBowReload = true,
): number {
    const rateScale = 1 + rateBonus;
    const rawFireRate = Math.max(0.05, weapon.fireRate * rateScale);
    if (
        weapon.selectedAttackChargeAmmoPerSecond !== undefined &&
        weapon.selectedAttackChargeAmmoPerSecond > 0 &&
        weapon.selectedAttackChargeDamageBaseAmmoCost !== undefined
    ) {
        const ammoChargeTime = Math.max(0.0001, ammoCostPerShot) / weapon.selectedAttackChargeAmmoPerSecond;
        return 1 / Math.max(1 / rawFireRate, ammoChargeTime);
    }
    if (
        weapon.trigger.toLowerCase() === "burst" &&
        weapon.burstCount !== undefined &&
        weapon.burstCycleRate !== undefined &&
        weapon.burstDelay !== undefined
    ) {
        const burstCycleRate = Math.max(0.05, weapon.burstCycleRate * rateScale);
        const burstDelay = weapon.burstDelay / Math.max(1, rateScale);
        return weapon.burstCount / (
            1 / burstCycleRate + (weapon.burstCount - 1) * burstDelay
        );
    }
    if (isBowWeapon(weapon)) {
        // Bow fire rate is charge time plus the post-shot reload delay.
        // Modes that ignore reload use charge cadence alone.
        const chargeTime = moddedChargeTimeSeconds(weapon, rateBonus);
        const firingCycle = chargeTime + (includeBowReload ? Math.max(0, reloadTime) : 0);
        return firingCycle > 0 ? 1 / Math.max(0.05, firingCycle) : rawFireRate;
    }
    if (weapon.trigger === "Charge" && weapon.chargeTime !== null && weapon.chargeTime > 0) {
        const moddedChargeTime = moddedChargeTimeSeconds(weapon, rateBonus);
        return 1 / (moddedChargeTime + 1 / Math.max(0.0001, rawFireRate));
    }
    // Auto, Semi, Duplex, and Held use modded fire rate. Other unmodeled trigger
    // details remain approximations until the catalog carries per-mode mechanics.
    return rawFireRate;
}

function effectiveBurstFireRate(
    weapon: WeaponEntry,
    rateBonus: number,
    reloadTime: number,
    includeBowReload: boolean,
    effectiveRate: number,
): number {
    if (!isBowWeapon(weapon)) return effectiveRate;
    const chargeTime = moddedChargeTimeSeconds(weapon, rateBonus);
    if (chargeTime > 0) return 1 / Math.max(0.05, chargeTime);
    return includeBowReload && reloadTime > 0
        ? 1 / Math.max(0.05, reloadTime)
        : Math.max(0.05, weapon.fireRate * (1 + rateBonus));
}

export interface ModdedWeaponStats {
    rawDamageBreakdown: Record<DamageKey, number>;
    /** Raw channel contributions before dynamic Condition Overload/direct per-status bonuses. */
    rawDamageBreakdownBeforePerStatus: Record<DamageKey, number>;
    /** Unmodded, charge- and active-combo-adjusted base damage used as the Damage 3.0 quantization scale. */
    baseDamageTotal: number;
    arsenalDamage: number;
    /**
     * Sum of all additive damage bonuses applied to base damage (e.g. Serration, Pressure Point,
     * conditional bonuses). Used by the optimizer to correctly apply Condition Overload and
     * Galvanized Aptitude as additive within this bracket rather than as a separate multiplier.
     */
    totalDamageBonus: number;
    averageShotDamage: number;
    /** Additive multiplicative bonus for the first ammo-consuming shot after each magazine reload. */
    firstShotMagazineDamageBonus: number;
    firstShotMagazineDamageMultiplier: number;
    /** Average direct damage multiplier over a magazine after first-shot-only bonuses. */
    magazineAverageDamageMultiplier: number;
    quantizedBaseCritMultiplier: number;
    critChance: number;
    critMultiplier: number;
    nonCriticalHitDamageProcs?: NonCriticalHitDamageProc[];
    averageCritTier: number;
    meleeComboMultiplier: number;
    /** Combo multiplier applied to this selected heavy melee attack, or 1 for other attacks. */
    meleeAttackComboDamageMultiplier: number;
    /** Critical chance added per active combo tier by combo-scaled effects. */
    comboCritChancePerTier: number;
    /** Initial Combo points available to rebuild after Heavy Attacks. */
    meleeInitialComboPoints: number;
    /** Modded Heavy Attack Efficiency after the current 90% game cap. */
    heavyAttackEfficiency: number;
    /** Combo points represented by the active tier before a selected heavy attack. */
    meleeComboPointsBeforeHeavyAttack: number;
    /** Estimated points retained by Heavy Attack Efficiency after one selected heavy attack. */
    meleeComboPointsAfterHeavyAttack: number;
    /** Combo tier derived from the estimated post-heavy retained points. */
    meleeComboMultiplierAfterHeavyAttack: number;
    statusChance: number;
    statusDurationMultiplier: number;
    /** Effective repeating attack rate, including charge and reload cadence where applicable. */
    fireRate: number;
    /** Fresh-magazine rate; charged bows exclude the post-shot reload interval. */
    burstFireRate: number;
    magazineSize: number;
    ammoCostPerShot: number;
    /** Charge duration implied by selected ammo amount and fixed weapon charge rate. */
    chargeTimeSeconds: number | null;
    reloadTime: number;
    /** Attack-timed multipliers for weapons whose damage ramps while firing. */
    firstAttackDamageMultiplier: number;
    freshMagazineDamageMultiplier: number;
    sustainedDamageMultiplier: number;
    /** Magazine firing-time share of a repeating fire/reload cycle. */
    magazineDutyCycle: number;
    /** Additive ammo efficiency after the ordinary 75% upper cap. Transformed Incarnons ignore it. */
    ammoEfficiencyBonus: number;
    /** True when the selected scenario assumes Perigale's Gale Force infinite-ammo buff is maintained. */
    infiniteAmmoActive: boolean;
    /** Expected projectile count used for independent crit/status rolls. */
    multishot: number;
    /** Expected damage multiplier after unique bonuses to extra projectiles. */
    damageWeightedMultishot: number;
    /** Additive unique bonus applied only to projectiles beyond base multishot. */
    multishotDamageBonus: number;
    shotsPerMag: number;
    damageBreakdown: Record<DamageKey, number>;
    totalDamage: number;
    procChanceByType: Partial<Record<DamageKey, number>>;
    averageProcsPerShot: number;
    forcedProcsPerShot: Partial<Record<DamageKey, number>>;
    extraProcsPerShot: Partial<Record<DamageKey, number>>;
    /** Forced/status-triggered applications before target immunities are applied. */
    unfilteredExtraProcsPerShot: Partial<Record<DamageKey, number>>;
    procRatePerSecondByType: Partial<Record<DamageKey, number>>;
    expectedStacksByType: Partial<Record<DamageKey, number>>;
    dotDamagePerShot: number;
    dotDps: number;
    dotDamagePerShotByType: Partial<Record<DamageKey, number>>;
    dotDpsByType: Partial<Record<DamageKey, number>>;
    /** Per-proc DoT tick contribution before the grouped +1 accumulator. */
    dotTickDamagePerProcByType: Partial<Record<DamageKey, number>>;
    /** Proc-seed tick before the steady-state Condition Overload mean-field bonus. */
    dotTickDamagePerProcBeforeConditionOverloadByType: Partial<Record<DamageKey, number>>;
    /** Group accumulator contribution for each active consolidated DoT tick. */
    dotTickAccumulatorDamageByType: Partial<Record<DamageKey, number>>;
    /** Full-lifetime seed damage from one DoT application before Condition Overload. */
    dotDamagePerApplicationSeedByType: Partial<Record<DamageKey, number>>;
    /** Full-lifetime grouped accumulator share per DoT application, never scaled by Condition Overload. */
    dotDamagePerApplicationAccumulatorByType: Partial<Record<DamageKey, number>>;
    viralHealthDamageBonus: number;
    heatArmorStrip: number;
    corrosiveArmorStrip: number;
    magneticShieldDamageBonus: number;
    /** Source-side multiplier for the forced Electricity DoT from Magnetic breaking a defense pool. */
    magneticBreakElectricSourceMultiplier: number;
    radiationAllyDamageBonus: number;
    coldSlow: number;
    coldCritDamageBonus: number;
    punctureEnemyDamageReduction: number;
    punctureCritChanceBonus: number;
    impactMercyThresholdBonus: number;
    /** Recorded pre-target-defense hit damage (H) for one Blast stack. */
    blastStackHitDamagePerProc: number;
    /** Blast's recorded H without the steady-state Condition Overload mean-field bonus. */
    blastStackHitDamagePerProcBeforeConditionOverload: number;
    /** Expected individual stack-expiry damage contributed by one attack. */
    blastExpectedExpiryDamagePerShot: number;
    /** Individual stack-expiry damage for one Blast proc. */
    blastExpiryDamagePerProc: number;
    gasCloudRadius: number;
    tauStatusVulnerability: number;
    /** AoE elemental status spread chance (0–1). Melee Influence-type arcane effect. */
    aoeElementalStatusSpreadChance: number;
    aoeElementalStatusSpreadRadius: number;
    directDamagePerStatusBonus: number;
    conditionOverloadDamagePerStatusBonus: number;
    conditionOverloadApplies: boolean;
    /** Fractional expected active weapon-generated status types for Condition Overload. */
    conditionOverloadStatusTypes: number;
    conditionOverloadDamageMultiplier: number;
    intrinsicDamagePerStatusBonus: number;
    intrinsicDamagePerStatusMode: IntrinsicDamagePerStatusMode;
    /** Fractional expected count of unique active status types in the steady-state mean-field model. */
    directDamageStatusTypes: number;
    directDamagePerStatusMultiplier: number;
    /** Quantized base damage before dynamic Condition Overload and direct-hit per-status bonuses. */
    damageBreakdownBeforePerStatus: Record<DamageKey, number>;
}

const AIMING_UPTIME_ASSUMPTION = 0.75;
const ON_KILL_UPTIME_ASSUMPTION = 0.6;
const ON_HEADSHOT_UPTIME_ASSUMPTION = 0.55;
const ON_HEADSHOT_KILL_UPTIME_ASSUMPTION = 0.35;
const ON_HIT_UPTIME_ASSUMPTION = 0.85;
const WEAK_POINT_HIT_UPTIME_ASSUMPTION = 0.55;
const HIT_RATE_ASSUMPTION = 0.75;
const WEAK_POINT_HIT_RATE_ASSUMPTION = 0.45;
function probabilityAtLeastOnePoissonArrival(expectedArrivals: number): number {
    const mean = Math.max(0, expectedArrivals);
    if (mean <= 0) return 0;
    if (mean >= 20) return 1;
    return -Math.expm1(-mean);
}

export interface DamageMetrics {
    modded: ModdedWeaponStats;
    burstDPS: number;
    sustainedDPS: number;
}

export interface MeleeAverageDpsParameters {
    /** Stance-table average combo damage multiplier, entered by the user. */
    averageComboDamageMultiplier: number;
    /** Stance-table base combo length in seconds, entered by the user. */
    baseComboLengthSeconds: number;
}

export interface MeleeAverageDpsResult {
    averageHit: number;
    averageDps: number;
    expectedHitDamageMultiplier: number;
}

export interface DamageCalculationOptions {
    /** Status effects the selected enemy cannot receive. Immune proc weights are removed and the rest renormalized. */
    statusImmuneTypes?: Iterable<StatusDamageType>;
    /** Target-specific stack limits, such as the four Cold stacks accepted by active Overguard. */
    statusStackCaps?: Partial<Record<StatusDamageType, number>>;
    /** State used for conditional mod effects. Defaults to the documented realistic approximation. */
    conditionalState?: ConditionalState;
    /** Assumed statuses already active on the target. Default models a steady-state encounter. */
    targetStatusState?: "initial" | "steadyState";
    /** Skip per-attack DoT details in the optimizer hot path; steady-state DoT DPS is retained. */
    includeDoTTickDetails?: boolean;
}

export interface ConditionalState {
    mode: "initial" | "realistic" | "fullyStacked" | "custom";
    /** Externally maintained stacks to assume for every conditional effect in custom mode. */
    externalStacks?: number;
    /** Distinct additional status types already maintained on the target for Condition Overload (including Tau). */
    externalStatusTypeCount?: number;
    /** User-entered melee combo tier; selected heavy attacks use it, but post-attack combo consumption/rebuild is not simulated. */
    meleeComboMultiplier?: number;
    /** User-selected ammo consumed by one Phantasma charged alternate-fire attack. */
    phantasmaChargeAmmo?: number;
}

export const DEFAULT_CONDITIONAL_STATE: Readonly<ConditionalState> = Object.freeze({ mode: "realistic" });

function emptyBreakdown(): Record<DamageKey, number> {
    return {
        impact: 0, puncture: 0, slash: 0,
        heat: 0, cold: 0, electricity: 0, toxin: 0,
        blast: 0, radiation: 0, gas: 0, magnetic: 0, viral: 0, corrosive: 0,
        void: 0, tau: 0, true: 0,
    };
}

export function avgCritMultiplier(critChance: number, critMult: number): number {
    if (critChance <= 0) return 1;
    return 1 + critChance * (critMult - 1);
}

/** Expected per-hit multiplier across critical tiers and independent noncritical-hit proc events. */
export function avgHitDamageMultiplier(
    critChance: number,
    critMult: number,
    nonCriticalHitDamageProcs: readonly NonCriticalHitDamageProc[] = [],
): number {
    const normalizedCritChance = Math.max(0, Number.isFinite(critChance) ? critChance : 0);
    const critDamage = avgCritMultiplier(normalizedCritChance, critMult);
    const nonCriticalChance = Math.max(0, 1 - Math.min(1, normalizedCritChance));
    const expectedProcMultiplier = nonCriticalHitDamageProcs.reduce((multiplier, proc) => {
        const chance = Math.max(0, Math.min(1, Number.isFinite(proc.chance) ? proc.chance : 0));
        const bonus = Math.max(0, Number.isFinite(proc.damageBonus) ? proc.damageBonus : 0);
        return multiplier * (1 + chance * bonus);
    }, 1);
    return critDamage + nonCriticalChance * (expectedProcMultiplier - 1);
}

/**
 * Wiki stance-comparison DPS formula using the build's quantized, pre-target hit
 * damage and expected per-hit damage multiplier. Stance values are explicit inputs because
 * this project does not yet have a coverage-verified stance timing catalog.
 */
export function calculateMeleeAverageDps(
    stats: Pick<ModdedWeaponStats, "totalDamage" | "critChance" | "critMultiplier" | "fireRate" | "nonCriticalHitDamageProcs">,
    parameters: MeleeAverageDpsParameters,
): MeleeAverageDpsResult | null {
    const values = [
        stats.totalDamage,
        stats.critChance,
        stats.critMultiplier,
        stats.fireRate,
        parameters.averageComboDamageMultiplier,
        parameters.baseComboLengthSeconds,
    ];
    if (
        !values.every(Number.isFinite) ||
        stats.totalDamage < 0 || stats.critChance < 0 || stats.critMultiplier < 0 || stats.fireRate < 0 ||
        parameters.averageComboDamageMultiplier <= 0 || parameters.baseComboLengthSeconds <= 0
    ) return null;

    const expectedHitDamageMultiplier = avgHitDamageMultiplier(
        stats.critChance,
        stats.critMultiplier,
        stats.nonCriticalHitDamageProcs,
    );
    const averageHit =
        parameters.averageComboDamageMultiplier *
        stats.totalDamage *
        expectedHitDamageMultiplier;
    return {
        averageHit,
        averageDps: averageHit * stats.fireRate / parameters.baseComboLengthSeconds,
        expectedHitDamageMultiplier,
    };
}

function collapsePrimaryElements(entries: Array<{ type: DamageKey; value: number; order: number }>) {
    const merged = new Map<DamageKey, { value: number; order: number }>();
    for (const entry of entries) {
        const existing = merged.get(entry.type);
        if (existing) {
            existing.value += entry.value;
            existing.order = Math.min(existing.order, entry.order);
        } else {
            merged.set(entry.type, { value: entry.value, order: entry.order });
        }
    }
    return [...merged.entries()]
        .map(([type, meta]) => ({ type, value: meta.value, order: meta.order }))
        .sort((a, b) => a.order - b.order);
}

function combineElementQueue(queue: Array<{ type: DamageKey; value: number; order: number }>) {
    const out = emptyBreakdown();
    const collapsed = collapsePrimaryElements(queue);
    let i = 0;
    while (i < collapsed.length) {
        const current = collapsed[i];
        const next = collapsed[i + 1];
        if (next) {
            const combo = COMBINED_ELEMENTS[`${current.type}+${next.type}`];
            if (combo) {
                out[combo] += current.value + next.value;
                i += 2;
                continue;
            }
        }
        out[current.type] += current.value;
        i += 1;
    }
    return out;
}

function totalDamageOf(breakdown: Record<DamageKey, number>) {
    return DAMAGE_KEYS.reduce((sum, key) => sum + breakdown[key], 0);
}

function scaleForStacks(stacks: number, first: number, additional: number, cap: number): number {
    if (stacks <= 0) return 0;
    if (stacks <= 1) return first * stacks;
    return Math.min(cap, first + additional * (stacks - 1));
}

function scaleLinearCap(stacks: number, perStack: number, cap: number): number {
    if (stacks <= 0) return 0;
    return Math.min(cap, stacks * perStack);
}

export function estimateConditionalUptime(
    conditional: ConditionalEffect,
    fireRate: number,
    magazineSize: number,
    state: ConditionalState = DEFAULT_CONDITIONAL_STATE,
): number {
    if (state.mode === "initial") return 0;
    if (state.mode === "fullyStacked") return 1;
    if (state.mode === "custom") return Math.max(0, state.externalStacks ?? 0) > 0 ? 1 : 0;

    let uptime = 0;
    switch (conditional.trigger) {
        case "onAbilityCast":
            // Ability choice and cast cadence depend on the user's frame/build;
            // do not invent a general combat uptime for a weapon-only planner.
            uptime = 0;
            break;
        case "whileAiming":
            uptime = AIMING_UPTIME_ASSUMPTION;
            break;
        case "whileAirborne":
            // No general airborne uptime is documented or reasonable to assume.
            // The user can activate it with a fully stacked or custom state.
            uptime = 0;
            break;
        case "whileAimGliding":
            // Aim Glide is a short, movement-specific state; do not equate it
            // with ordinary ADS or assume a general encounter uptime.
            uptime = 0;
            break;
        case "whileInvisible":
            // Invisibility is Warframe- and encounter-dependent, so realistic
            // weapon scenarios need an explicit custom/fully-stacked state.
            uptime = 0;
            break;
        case "onReload":
        case "onReloadFromEmpty": {
            const magTime = magazineSize / Math.max(0.0001, fireRate);
            uptime = conditional.durationSeconds > 0 ? Math.min(1, conditional.durationSeconds / Math.max(0.0001, magTime)) : 1;
            break;
        }
        case "onKill":
            uptime = ON_KILL_UPTIME_ASSUMPTION;
            break;
        case "onHeadshot":
            uptime = ON_HEADSHOT_UPTIME_ASSUMPTION;
            break;
        case "onHeadshotKill":
            uptime = ON_HEADSHOT_KILL_UPTIME_ASSUMPTION;
            break;
        case "onHit":
            uptime = ON_HIT_UPTIME_ASSUMPTION;
            break;
        case "onPunchThroughHit":
            uptime = ON_HIT_UPTIME_ASSUMPTION * 0.45;
            break;
        case "onWeakPointHit":
            uptime = WEAK_POINT_HIT_UPTIME_ASSUMPTION;
            break;
        case "onWeakPointKill":
            uptime = ON_HEADSHOT_KILL_UPTIME_ASSUMPTION * 0.9;
            break;
        case "onMeleeKill":
        case "onKillOrAssist":
            uptime = ON_KILL_UPTIME_ASSUMPTION;
            break;
        case "onConsecutiveThrow":
            uptime = 0.45;
            break;
    }
    if (conditional.requiresAiming) uptime *= AIMING_UPTIME_ASSUMPTION;
    return Math.max(0, Math.min(1, uptime));
}

function estimateConditionalStackFactor(
    conditional: ConditionalEffect,
    fireRate: number,
    _magazineSize: number,
    state: ConditionalState = DEFAULT_CONDITIONAL_STATE,
): number {
    if (state.mode === "initial") return 0;
    if (state.mode === "fullyStacked") return Math.max(1, conditional.maxStacks ?? 1);
    if (state.mode === "custom") {
        return Math.max(0, Math.min(conditional.maxStacks ?? 1, state.externalStacks ?? 0));
    }
    if ((conditional.maxStacks ?? 1) <= 1) return 1;

    switch (conditional.trigger) {
        case "onKill":
        case "onMeleeKill":
        case "onKillOrAssist":
            return Math.max(1, conditional.maxStacks * 0.7);
        case "onHeadshotKill":
        case "onWeakPointKill":
            return Math.max(1, conditional.maxStacks * 0.5);
        case "onHit":
        case "onConsecutiveThrow": {
            const expected = fireRate * Math.max(0.25, conditional.durationSeconds || 0.25) * HIT_RATE_ASSUMPTION;
            return Math.max(1, Math.min(conditional.maxStacks, expected * 0.85));
        }
        case "onWeakPointHit": {
            const expected = fireRate * Math.max(0.25, conditional.durationSeconds || 0.25) * WEAK_POINT_HIT_RATE_ASSUMPTION;
            return Math.max(1, Math.min(conditional.maxStacks, expected * 0.8));
        }
        default:
            return 1;
    }
}

export { estimateConditionalStackFactor };

export function calculateBuild(
    weapon: WeaponEntry,
    mods: (ModEffect | null)[],
    targetFaction = "",
    options: DamageCalculationOptions = {},
): DamageMetrics {
    const statusImmuneTypes = options.statusImmuneTypes instanceof Set
        ? options.statusImmuneTypes
        : new Set(options.statusImmuneTypes ?? []);
    const conditionalState = options.conditionalState ?? DEFAULT_CONDITIONAL_STATE;
    const infiniteAmmoActive = !!weapon.hasGaleForceAmmoPassive && (
        conditionalState.mode === "fullyStacked" ||
        (conditionalState.mode === "custom" && (conditionalState.externalStacks ?? 0) > 0)
    );
    const ignoresReloadAndMagazine = !!weapon.isExalted || !!weapon.selectedAttackIsIncarnon;
    const supportsAmmoEfficiency = !usesMeleeDamageModel(weapon.category) && !weapon.isExalted && !weapon.selectedAttackIsIncarnon;
    let damageBonus = 0;
    let firstShotMagazineDamageBonus = 0;
    let impactBonus = 0;
    let punctureBonus = 0;
    let slashBonus = 0;
    let critChanceBonus = 0;
    let comboCritChanceBonus = 0;
    let finalCritChanceBonus = 0;
    let critMultBonus = 0;
    let finalCritMultiplierBonus = 0;
    const nonCriticalHitDamageProcs: NonCriticalHitDamageProc[] = [];
    let statusChanceBonus = 0;
    let comboStatusChanceBonus = 0;
    let finalStatusChanceBonus = 0;
    let multishotBonus = 0;
    let multishotDamageBonus = 0;
    let fireRateBonus = 0;
    let magazineBonus = 0;
    let reloadSpeedBonus = 0;
    let ammoEfficiencyBonus = 0;
    let attackSpeedBonus = 0;
    let gasBonus = 0;
    let perHitCritChanceBonus = 0;
    let nextMagazineStatusChancePerShot = 0;
    let nextMagazineMultishotPerShot = 0;
    let nextMagazineMaxStacks = 0;
    let factionDamageBonus = 0;
    let impactStatusAppliesMagneticChance = 0;
    let impactStatusAppliesSlashChance = 0;
    let impactStatusExtraProcLowFireRateThreshold = 0;
    let impactStatusExtraProcLowFireRateMultiplier = 1;
    let critAppliesSlashChance = 0;
    let aoeElementalStatusSpreadChance = 0;
    let aoeElementalStatusSpreadRadius = 0;
    let directDamagePerStatusBonus = 0;
    let conditionOverloadDamagePerStatusBonus = 0;
    const conditionalEffects: Array<{
        effect: ConditionalEffect;
        sourceModIndex: number;
        sourceEffectIndex: number;
    }> = [];

    const orderedPrimaryElementBonuses: Array<{ type: DamageKey; value: number; order: number }> = [];
    const conditionalPrimaryElementBonuses: Array<{ type: DamageKey; value: number; order: number }> = [];
    const directBonusBreakdown = emptyBreakdown();
    let statusDamageBonus = 0;
    const targetFactionKey = targetFaction.toLowerCase();

    for (let index = 0; index < mods.length; index++) {
        const e = mods[index];
        if (!e) continue;
        damageBonus += e.damageBonus ?? 0;
        firstShotMagazineDamageBonus += e.firstShotMagazineDamageBonus ?? 0;
        impactBonus += e.impactBonus ?? 0;
        punctureBonus += e.punctureBonus ?? 0;
        slashBonus += e.slashBonus ?? 0;
        critChanceBonus += e.critChanceBonus ?? 0;
        nonCriticalHitDamageProcs.push(...(e.nonCriticalHitDamageProcs ?? []));
        comboCritChanceBonus += e.comboCritChanceBonus ?? 0;
        finalCritChanceBonus += e.finalCritChanceBonus ?? 0;
        critMultBonus += e.critMultBonus ?? 0;
        finalCritMultiplierBonus += e.finalCritMultiplierBonus ?? 0;
        statusChanceBonus += e.statusChanceBonus ?? 0;
        comboStatusChanceBonus += e.comboStatusChanceBonus ?? 0;
        finalStatusChanceBonus += e.finalStatusChanceBonus ?? 0;
        multishotBonus += e.multishotBonus ?? 0;
        multishotDamageBonus += e.multishotDamageBonus ?? 0;
        fireRateBonus += e.fireRateBonus ?? 0;
        if (!ignoresReloadAndMagazine) {
            magazineBonus += e.magazineBonus ?? 0;
            reloadSpeedBonus += e.reloadSpeedBonus ?? 0;
        }
        if (supportsAmmoEfficiency) {
            ammoEfficiencyBonus += e.ammoEfficiencyBonus ?? 0;
        }
        attackSpeedBonus += e.attackSpeedBonus ?? 0;
        gasBonus += e.gasBonus ?? 0;
        perHitCritChanceBonus += e.perHitCritChanceBonus ?? 0;
        nextMagazineStatusChancePerShot += e.nextMagazineStatusChancePerShot ?? 0;
        nextMagazineMultishotPerShot += e.nextMagazineMultishotPerShot ?? 0;
        nextMagazineMaxStacks = Math.max(nextMagazineMaxStacks, e.nextMagazineMaxStacks ?? 0);
        impactStatusAppliesMagneticChance += e.impactStatusAppliesMagneticChance ?? 0;
        impactStatusAppliesSlashChance += e.impactStatusAppliesSlashChance ?? 0;
        impactStatusExtraProcLowFireRateThreshold = Math.max(impactStatusExtraProcLowFireRateThreshold, e.impactStatusExtraProcLowFireRateThreshold ?? 0);
        impactStatusExtraProcLowFireRateMultiplier = Math.max(impactStatusExtraProcLowFireRateMultiplier, e.impactStatusExtraProcLowFireRateMultiplier || 1);
        critAppliesSlashChance += e.critAppliesSlashChance ?? 0;
        aoeElementalStatusSpreadChance = Math.max(aoeElementalStatusSpreadChance, e.aoeElementalStatusSpreadChance ?? 0);
        aoeElementalStatusSpreadRadius = Math.max(aoeElementalStatusSpreadRadius, e.aoeElementalStatusSpreadRadius ?? 0);
        directDamagePerStatusBonus += e.directDamagePerStatusBonus ?? 0;
        conditionOverloadDamagePerStatusBonus += e.conditionOverloadDamagePerStatusBonus ?? 0;
        statusDamageBonus += e.statusDamageBonus ?? 0;
        const sourceConditionals = e.conditionalEffects;
        if (sourceConditionals) {
            for (let sourceEffectIndex = 0; sourceEffectIndex < sourceConditionals.length; sourceEffectIndex++) {
                conditionalEffects.push({
                    effect: sourceConditionals[sourceEffectIndex],
                    sourceModIndex: index,
                    sourceEffectIndex,
                });
            }
        }

        if (targetFactionKey && e.targetFaction && e.targetFaction.toLowerCase() === targetFactionKey) {
            factionDamageBonus += e.factionDamageBonus ?? 0;
        }

        const elementOrder = index * 1000;
        const heatBonus = e.heatBonus ?? 0;
        const coldBonus = e.coldBonus ?? 0;
        const electricityBonus = e.electricityBonus ?? 0;
        const toxinBonus = e.toxinBonus ?? 0;
        if (heatBonus > 0) orderedPrimaryElementBonuses.push({ type: "heat", value: heatBonus, order: elementOrder });
        if (coldBonus > 0) orderedPrimaryElementBonuses.push({ type: "cold", value: coldBonus, order: elementOrder + 1 });
        if (electricityBonus > 0) orderedPrimaryElementBonuses.push({ type: "electricity", value: electricityBonus, order: elementOrder + 2 });
        if (toxinBonus > 0) orderedPrimaryElementBonuses.push({ type: "toxin", value: toxinBonus, order: elementOrder + 3 });

        directBonusBreakdown.blast += e.blastBonus ?? 0;
        directBonusBreakdown.gas += e.gasBonus ?? 0;
        directBonusBreakdown.magnetic += e.magneticBonus ?? 0;
        directBonusBreakdown.radiation += e.radiationBonus ?? 0;
        directBonusBreakdown.viral += e.viralBonus ?? 0;
        directBonusBreakdown.corrosive += e.corrosiveBonus ?? 0;
        directBonusBreakdown.void += e.voidBonus ?? 0;
        directBonusBreakdown.tau += e.tauBonus ?? 0;
        directBonusBreakdown.true += e.trueBonus ?? 0;
    }

    const baseFireRateBonus = usesMeleeDamageModel(weapon.category) ? attackSpeedBonus : fireRateBonus;
    const baselineReloadTime = ignoresReloadAndMagazine
        ? weapon.reloadTime
        : weapon.reloadTime / (1 + reloadSpeedBonus);
    const includeBowReload = !ignoresReloadAndMagazine;
    const baselineRawFireRate = effectiveFireRate(
        weapon,
        baseFireRateBonus,
        weapon.ammoCostPerShot,
        baselineReloadTime,
        includeBowReload,
    );
    const baselineMagazineSize = Math.max(1, Math.round(weapon.magazineSize * (1 + magazineBonus)));
    let conditionalDamageBonus = 0;
    let conditionalCritChanceBonus = 0;
    let conditionalFinalCritChanceBonus = 0;
    let conditionalCritMultBonus = 0;
    let conditionalFinalCritMultiplierBonus = 0;
    let conditionalStatusChanceBonus = 0;
    let conditionalStatusDamageBonus = 0;
    let conditionalMultishotBonus = 0;
    let conditionalMultishotDamageBonus = 0;
    let conditionalFireRateBonus = 0;
    let conditionalAttackSpeedBonus = 0;
    let conditionalReloadSpeedBonus = 0;
    let conditionalAmmoEfficiencyBonus = 0;
    let conditionalDirectDamagePerStatusBonus = 0;
    let conditionalInitialComboBonus = 0;
    const conditionalDirectBonusBreakdown = emptyBreakdown();
    for (const { effect: conditional, sourceModIndex, sourceEffectIndex } of conditionalEffects) {
        const factor =
            estimateConditionalUptime(conditional, baselineRawFireRate, baselineMagazineSize, conditionalState) *
            estimateConditionalStackFactor(conditional, baselineRawFireRate, baselineMagazineSize, conditionalState);
        conditionalDamageBonus += (conditional.stats.damageBonus ?? 0) * factor;
        conditionalCritChanceBonus += (conditional.stats.critChanceBonus ?? 0) * factor;
        conditionalFinalCritChanceBonus += (conditional.stats.finalCritChanceBonus ?? 0) * factor;
        conditionalCritMultBonus += (conditional.stats.critMultBonus ?? 0) * factor;
        conditionalFinalCritMultiplierBonus += (conditional.stats.finalCritMultiplierBonus ?? 0) * factor;
        conditionalStatusChanceBonus += (conditional.stats.statusChanceBonus ?? 0) * factor;
        conditionalStatusDamageBonus += (conditional.stats.statusDamageBonus ?? 0) * factor;
        conditionalMultishotBonus += (conditional.stats.multishotBonus ?? 0) * factor;
        conditionalMultishotDamageBonus += (conditional.stats.multishotDamageBonus ?? 0) * factor;
        conditionalFireRateBonus += (conditional.stats.fireRateBonus ?? 0) * factor;
        conditionalAttackSpeedBonus += (conditional.stats.attackSpeedBonus ?? 0) * factor;
        if (supportsAmmoEfficiency) {
            conditionalAmmoEfficiencyBonus += (conditional.stats.ammoEfficiencyBonus ?? 0) * factor;
        }
        conditionalDirectDamagePerStatusBonus += (conditional.stats.directDamagePerStatusBonus ?? 0) * factor;
        conditionalInitialComboBonus += (conditional.stats.initialComboBonus ?? 0) * factor;
        if (!ignoresReloadAndMagazine) {
            conditionalReloadSpeedBonus += (conditional.stats.reloadSpeedBonus ?? 0) * factor;
        }
        conditionalDirectBonusBreakdown.blast += (conditional.stats.blastBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.gas += (conditional.stats.gasBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.magnetic += (conditional.stats.magneticBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.radiation += (conditional.stats.radiationBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.viral += (conditional.stats.viralBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.corrosive += (conditional.stats.corrosiveBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.void += (conditional.stats.voidBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.tau += (conditional.stats.tauBonus ?? 0) * factor;
        conditionalDirectBonusBreakdown.true += (conditional.stats.trueBonus ?? 0) * factor;
        const conditionalElementOrder = (sourceModIndex * 1000) + 100 + (sourceEffectIndex * 4);
        const conditionalHeat = conditional.stats.heatBonus ?? 0;
        const conditionalCold = conditional.stats.coldBonus ?? 0;
        const conditionalElectricity = conditional.stats.electricityBonus ?? 0;
        const conditionalToxin = conditional.stats.toxinBonus ?? 0;
        if (conditionalHeat > 0) conditionalPrimaryElementBonuses.push({ type: "heat", value: conditionalHeat * factor, order: conditionalElementOrder });
        if (conditionalCold > 0) conditionalPrimaryElementBonuses.push({ type: "cold", value: conditionalCold * factor, order: conditionalElementOrder + 1 });
        if (conditionalElectricity > 0) conditionalPrimaryElementBonuses.push({ type: "electricity", value: conditionalElectricity * factor, order: conditionalElementOrder + 2 });
        if (conditionalToxin > 0) conditionalPrimaryElementBonuses.push({ type: "toxin", value: conditionalToxin * factor, order: conditionalElementOrder + 3 });
    }

    damageBonus += conditionalDamageBonus;
    critChanceBonus += conditionalCritChanceBonus;
    finalCritChanceBonus += conditionalFinalCritChanceBonus;
    critMultBonus += conditionalCritMultBonus;
    finalCritMultiplierBonus += conditionalFinalCritMultiplierBonus;
    statusChanceBonus += conditionalStatusChanceBonus;
    multishotBonus += conditionalMultishotBonus;
    multishotDamageBonus += conditionalMultishotDamageBonus;
    fireRateBonus += conditionalFireRateBonus;
    attackSpeedBonus += conditionalAttackSpeedBonus;
    reloadSpeedBonus += conditionalReloadSpeedBonus;
    ammoEfficiencyBonus = Math.min(0.75, ammoEfficiencyBonus + conditionalAmmoEfficiencyBonus);
    directDamagePerStatusBonus += conditionalDirectDamagePerStatusBonus;
    statusDamageBonus += conditionalStatusDamageBonus;
    const statusDamageMultiplier = 1 + statusDamageBonus;

    const projectedMultishot = weapon.multishot * (1 + multishotBonus);
    const expectedHitsPerMag = baselineMagazineSize * projectedMultishot * HIT_RATE_ASSUMPTION;
    if (perHitCritChanceBonus > 0) {
        critChanceBonus += perHitCritChanceBonus * Math.max(0, expectedHitsPerMag - 1) / 2;
    }
    if (nextMagazineMaxStacks > 0) {
        const nextMagStacks = Math.min(nextMagazineMaxStacks, baselineMagazineSize * projectedMultishot * HIT_RATE_ASSUMPTION);
        statusChanceBonus += nextMagazineStatusChancePerShot * nextMagStacks * 0.5;
        multishotBonus += nextMagazineMultishotPerShot * nextMagStacks * 0.5;
    }

    const baseDamageMultiplier = 1 + damageBonus;
    const chargeDamageBaseAmmoCost = weapon.selectedAttackChargeDamageBaseAmmoCost;
    const chargeAmmoPerShot = chargeDamageBaseAmmoCost !== undefined
        ? Math.min(
            Math.max(chargeDamageBaseAmmoCost, Math.round(weapon.magazineSize * (1 + magazineBonus))),
            Math.max(
                chargeDamageBaseAmmoCost,
                Math.round(Number.isFinite(conditionalState.phantasmaChargeAmmo)
                    ? conditionalState.phantasmaChargeAmmo ?? chargeDamageBaseAmmoCost
                    : weapon.ammoCostPerShot ?? chargeDamageBaseAmmoCost),
            ),
        )
        : Math.max(0.0001, weapon.ammoCostPerShot ?? 1);
    const chargeDamageScale = chargeDamageBaseAmmoCost !== undefined
        ? chargeAmmoPerShot / Math.max(0.0001, chargeDamageBaseAmmoCost)
        : 1;
    const weaponBaseDamage = Object.fromEntries(
        DAMAGE_KEYS.map((key) => [key, weapon.damage[key] * chargeDamageScale]),
    ) as Record<DamageKey, number>;
    const baseDamageTotal = Math.max(0, totalDamageOf(weaponBaseDamage));
    let totalBase = Math.max(0, baseDamageTotal * baseDamageMultiplier);

    const rawBreakdown = emptyBreakdown();
    rawBreakdown.impact = weaponBaseDamage.impact * baseDamageMultiplier * (1 + impactBonus);
    rawBreakdown.puncture = weaponBaseDamage.puncture * baseDamageMultiplier * (1 + punctureBonus);
    rawBreakdown.slash = weaponBaseDamage.slash * baseDamageMultiplier * (1 + slashBonus);

    const moddedElementEntries = [...orderedPrimaryElementBonuses, ...conditionalPrimaryElementBonuses];
    const lastModdedElementOrder = moddedElementEntries.reduce(
        (latest, entry) => Math.max(latest, entry.order),
        -1,
    );
    const innateElementOrder = lastModdedElementOrder + 1;
    const innateQueue: Array<{ type: DamageKey; value: number; order: number }> = [];
    PRIMARY_ELEMENTS.forEach((type, idx) => {
        const baseValue = weaponBaseDamage[type];
        if (baseValue > 0) innateQueue.push({ type, value: baseValue * baseDamageMultiplier, order: innateElementOrder + idx });
    });

    const moddedElementQueue = moddedElementEntries.map(entry => ({
        ...entry,
        value: totalBase * entry.value,
    }));
    const combinedPrimaries = combineElementQueue([...moddedElementQueue, ...innateQueue]);
    for (const key of DAMAGE_KEYS) rawBreakdown[key] += combinedPrimaries[key];

    rawBreakdown.blast += weaponBaseDamage.blast * baseDamageMultiplier;
    rawBreakdown.radiation += weaponBaseDamage.radiation * baseDamageMultiplier;
    rawBreakdown.gas += weaponBaseDamage.gas * baseDamageMultiplier;
    rawBreakdown.magnetic += weaponBaseDamage.magnetic * baseDamageMultiplier;
    rawBreakdown.viral += weaponBaseDamage.viral * baseDamageMultiplier;
    rawBreakdown.corrosive += weaponBaseDamage.corrosive * baseDamageMultiplier;
    rawBreakdown.void += weaponBaseDamage.void * baseDamageMultiplier;
    rawBreakdown.tau += weaponBaseDamage.tau * baseDamageMultiplier;
    rawBreakdown.true += weaponBaseDamage.true * baseDamageMultiplier;

    for (const key of ["blast", "gas", "magnetic", "radiation", "viral", "corrosive", "void", "tau", "true"] as const) {
        rawBreakdown[key] += totalBase * (directBonusBreakdown[key] + conditionalDirectBonusBreakdown[key]);
    }

    const initialComboCount = usesMeleeDamageModel(weapon.category)
        ? getMeleeInnateInitialComboPoints(weapon) +
            mods.reduce((sum, effect) => sum + (effect?.initialComboBonus ?? 0), 0) +
            conditionalInitialComboBonus
        : 0;
    const initialComboMultiplier = getInitialMeleeComboMultiplier(weapon, initialComboCount);
    const requestedComboMultiplier = Number.isFinite(conditionalState.meleeComboMultiplier)
        ? clampMeleeComboMultiplier(weapon, conditionalState.meleeComboMultiplier ?? 1)
        : 1;
    const meleeComboMultiplier = usesMeleeDamageModel(weapon.category)
        ? conditionalState.mode === "initial"
            ? initialComboMultiplier
            : Math.max(initialComboMultiplier, requestedComboMultiplier)
        : 1;
    const heavyAttackEfficiency = usesMeleeDamageModel(weapon.category)
        ? Math.max(0, Math.min(0.9, mods.reduce((sum, effect) => sum + (effect?.heavyAttackEfficiencyBonus ?? 0), 0)))
        : 0;
    const meleeComboPointsBeforeHeavyAttack = usesMeleeDamageModel(weapon.category)
        ? initialComboMultiplier >= requestedComboMultiplier
            ? initialComboCount
            : getMeleeComboPointsAtTier(weapon, meleeComboMultiplier)
        : 0;
    const meleeComboPointsAfterHeavyAttack = getHeavyAttackRetainedComboPoints(
        meleeComboPointsBeforeHeavyAttack,
        heavyAttackEfficiency,
    );
    const meleeComboMultiplierAfterHeavyAttack = usesMeleeDamageModel(weapon.category)
        ? getInitialMeleeComboMultiplier(weapon, meleeComboPointsAfterHeavyAttack)
        : 1;
    const meleeAttackComboDamageMultiplier = weapon.selectedAttackUsesMeleeComboMultiplier === true
        ? meleeComboMultiplier
        : 1;
    const comboCritChancePerTier = usesMeleeDamageModel(weapon.category)
        ? weapon.critChance * comboCritChanceBonus
        : 0;
    if (meleeAttackComboDamageMultiplier !== 1) {
        // Named heavy-attack rows already contain the weapon-class heavy attack
        // multiplier. The active combo tier is a further multiplier after the
        // attack's Damage 3.0 composition, so scale channels and their base
        // quantization scale without changing status weights.
        for (const key of DAMAGE_KEYS) rawBreakdown[key] *= meleeAttackComboDamageMultiplier;
        totalBase *= meleeAttackComboDamageMultiplier;
    }

    const moddedMultishot = weapon.multishot * (1 + multishotBonus);
    const extraProjectiles = Math.max(0, moddedMultishot - weapon.multishot);
    const damageWeightedMultishot = moddedMultishot + extraProjectiles * multishotDamageBonus;
    const procSeedDamageRatio = moddedMultishot > 0 ? damageWeightedMultishot / moddedMultishot : 1;
    const comboTiersAboveBase = Math.max(0, meleeComboMultiplier - 1);
    const critChance = weapon.critChance * (1 + critChanceBonus + comboCritChanceBonus * comboTiersAboveBase) + finalCritChanceBonus;
    const quantizedBaseCritMultiplier = quantizeBaseCriticalDamageMultiplier(weapon.critMultiplier);
    const critMultiplier = quantizedBaseCritMultiplier * (1 + critMultBonus) + finalCritMultiplierBonus;
    const averageCritTier = Math.max(0, critChance);
    const statusChance = weapon.statusChance * (1 + statusChanceBonus + comboStatusChanceBonus * comboTiersAboveBase) + finalStatusChanceBonus;

    const magazineSize = ignoresReloadAndMagazine
        ? Math.max(1, weapon.magazineSize)
        : Math.max(1, Math.round(weapon.magazineSize * (1 + magazineBonus)));
    const reloadTime = ignoresReloadAndMagazine
        ? weapon.reloadTime
        : weapon.reloadTime / (1 + reloadSpeedBonus);
    const rateBonus = usesMeleeDamageModel(weapon.category) ? attackSpeedBonus : fireRateBonus;
    const fireRate = effectiveFireRate(weapon, rateBonus, chargeAmmoPerShot, reloadTime, includeBowReload);
    const burstFireRate = effectiveBurstFireRate(weapon, rateBonus, reloadTime, includeBowReload, fireRate);
    const bowIncludesReloadInFireRate = isBowWeapon(weapon) && includeBowReload;
    const ammoCostPerShot = chargeAmmoPerShot;
    const unroundedShotsPerMag = magazineSize / (ammoCostPerShot * (1 - ammoEfficiencyBonus));
    // Ammo-efficiency remainders accumulate, and the Wiki treats a remaining
    // fraction below one ammo as the next shot. Preserve the historical
    // magazine/cost ratio without efficiency; round up only when efficiency
    // introduces a fractional-ammo remainder.
    const calculatedShotsPerMag = ammoEfficiencyBonus > 0
        ? Math.max(1, Math.ceil(unroundedShotsPerMag - 1e-9))
        : unroundedShotsPerMag;
    const shotsPerMag = infiniteAmmoActive ? Number.MAX_SAFE_INTEGER : calculatedShotsPerMag;
    const activeFirstShotMagazineDamageBonus = ignoresReloadAndMagazine || infiniteAmmoActive
        ? 0
        : Math.max(0, firstShotMagazineDamageBonus);
    const firstShotMagazineDamageMultiplier = 1 + activeFirstShotMagazineDamageBonus;
    const magazineAverageDamageMultiplier = shotsPerMag > 0
        ? 1 + activeFirstShotMagazineDamageBonus / shotsPerMag
        : 1;
    const damageRampMultipliers = calculateDamageRampMultipliers(
        weapon.selectedAttackDamageRamp,
        shotsPerMag,
        fireRate,
        reloadTime,
        ignoresReloadAndMagazine || infiniteAmmoActive,
    );
    const magazineDuration = infiniteAmmoActive ? 0 : shotsPerMag / Math.max(0.0001, fireRate);
    const magazineDutyCycle = ignoresReloadAndMagazine || infiniteAmmoActive || reloadTime <= 0 || bowIncludesReloadInFireRate
        ? 1
        : magazineDuration / (magazineDuration + reloadTime);

    const procWeightBreakdown = emptyBreakdown();
    for (const key of DAMAGE_KEYS) {
        procWeightBreakdown[key] = quantizeDamageContribution(rawBreakdown[key], totalBase);
    }

    const procChanceByType: Partial<Record<DamageKey, number>> = {};
    const statusDamageWeightTotal = STATUS_DAMAGE_TYPES.reduce((sum, key) => {
        return statusImmuneTypes.has(key) ? sum : sum + procWeightBreakdown[key];
    }, 0);
    if (statusDamageWeightTotal > 0) {
        for (const key of STATUS_DAMAGE_TYPES) {
            if (statusImmuneTypes.has(key)) continue;
            if (procWeightBreakdown[key] > 0) procChanceByType[key] = procWeightBreakdown[key] / statusDamageWeightTotal;
        }
    }
    const baseProcChanceByType = { ...procChanceByType };
    const baseProcsPerShot = statusDamageWeightTotal > 0 ? moddedMultishot * statusChance : 0;
    const impactProcChance = procChanceByType.impact ?? 0;
    const lowFireRateApplies =
        impactStatusExtraProcLowFireRateThreshold > 0 &&
        fireRate < impactStatusExtraProcLowFireRateThreshold;
    const impactStatusMultiplier = lowFireRateApplies
        ? impactStatusExtraProcLowFireRateMultiplier
        : 1;
    const forcedProcsPerShot: Partial<Record<DamageKey, number>> = {};
    const extraProcsPerShot: Partial<Record<DamageKey, number>> = {};
    const unfilteredExtraProcsPerShot: Partial<Record<DamageKey, number>> = {};
    const addExtraProc = (key: DamageKey, value: number) => {
        if (value <= 0) return;
        unfilteredExtraProcsPerShot[key] = (unfilteredExtraProcsPerShot[key] ?? 0) + value;
        if (key !== "true" && statusImmuneTypes.has(key)) return;
        extraProcsPerShot[key] = (extraProcsPerShot[key] ?? 0) + value;
    };
    for (const [type, countPerHit] of Object.entries(weapon.forcedProcs ?? {}) as Array<[WeaponForcedProcType, number]>) {
        if (!Number.isFinite(countPerHit)) continue;
        const countPerShot = Math.max(0, moddedMultishot) * Math.max(0, countPerHit);
        if (countPerShot <= 0 || statusImmuneTypes.has(type)) continue;
        forcedProcsPerShot[type] = countPerShot;
        addExtraProc(type, countPerShot);
    }
    const addExpectedForcedProc = (type: WeaponForcedProcType, countPerShot: number) => {
        if (countPerShot <= 0) return;
        if (!statusImmuneTypes.has(type)) {
            forcedProcsPerShot[type] = (forcedProcsPerShot[type] ?? 0) + countPerShot;
        }
        addExtraProc(type, countPerShot);
    };
    const comboTriggeredProcDistributions = weapon.selectedAttackUsesMeleeComboMultiplier
        ? mods.flatMap((effect) => (effect?.meleeComboTriggeredProcDistributions ?? [])
            .filter((distribution) => meleeComboMultiplier >= distribution.minimumComboMultiplier))
        : [];
    for (const distribution of [...(weapon.forcedProcDistributions ?? []), ...comboTriggeredProcDistributions]) {
        const countPerShot = Math.max(0, moddedMultishot) * Math.max(0, distribution.count);
        if (!Number.isFinite(countPerShot) || countPerShot <= 0) continue;
        if (distribution.mode === "damageWeighted") {
            // A weighted forced roll is independent of ordinary status chance,
            // but uses the same post-quantization, target-eligible damage mix.
            for (const type of STATUS_DAMAGE_TYPES) {
                addExpectedForcedProc(type, countPerShot * (baseProcChanceByType[type] ?? 0));
            }
            continue;
        }
        const types = [...new Set(distribution.types ?? [])];
        if (types.length === 0) continue;
        const expectedPerType = countPerShot / types.length;
        for (const type of types) addExpectedForcedProc(type, expectedPerType);
    }
    // Mods such as Internal Bleeding and Hemorrhage trigger from Impact status
    // applications, including forced procs that do not depend on status chance.
    // Forced distribution rolls are included in forcedProcsPerShot above.
    const impactProcsPerShot = baseProcsPerShot * impactProcChance + (forcedProcsPerShot.impact ?? 0);
    addExtraProc("magnetic", impactProcsPerShot * impactStatusAppliesMagneticChance * impactStatusMultiplier);
    addExtraProc("slash", impactProcsPerShot * impactStatusAppliesSlashChance * impactStatusMultiplier);
    addExtraProc("slash", moddedMultishot * Math.min(1, critChance) * critAppliesSlashChance);

    const statusDurationMultiplier = Math.max(0, 1 + mods.reduce((sum, effect) => sum + (effect?.statusDurationBonus ?? 0), 0));
    const expectedStacksForRate = (type: StatusDamageType, ratePerSecond: number): number => {
        if (options.targetStatusState === "initial" || statusImmuneTypes.has(type)) return 0;
        const rule = STATUS_EFFECT_RULES[type];
        const stacks = Math.max(0, ratePerSecond) * rule.durationSeconds * statusDurationMultiplier;
        const targetCap = options.statusStackCaps?.[type];
        const cap = Number.isFinite(targetCap) && (targetCap ?? 0) >= 0
            ? Math.min(rule.maxStacks ?? Number.POSITIVE_INFINITY, targetCap ?? Number.POSITIVE_INFINITY)
            : rule.maxStacks;
        return cap === null ? stacks : Math.min(cap ?? Number.POSITIVE_INFINITY, stacks);
    };
    // Tau stacks affect later ordinary rolls for every other status type. Their
    // own expected rate is computed first and remains independent of that bonus.
    const tauProcRatePerSecond = (
        baseProcsPerShot * (baseProcChanceByType.tau ?? 0) + (extraProcsPerShot.tau ?? 0)
    ) * fireRate;
    const expectedTauStacks = expectedStacksForRate("tau", tauProcRatePerSecond);
    const tauStatusChanceMultiplier = 1 + scaleLinearCap(expectedTauStacks, 0.1, 1.0);
    const procCountsPerShotByType: Partial<Record<DamageKey, number>> = {};
    for (const type of STATUS_DAMAGE_TYPES) {
        const ordinaryMultiplier = type === "tau" ? 1 : tauStatusChanceMultiplier;
        const ordinaryProcs = baseProcsPerShot * (baseProcChanceByType[type] ?? 0) * ordinaryMultiplier;
        const total = ordinaryProcs + (extraProcsPerShot[type] ?? 0);
        if (total > 0) procCountsPerShotByType[type] = total;
    }
    const averageProcsPerShot = Object.values(procCountsPerShotByType).reduce((sum, value) => sum + (value ?? 0), 0);
    if (averageProcsPerShot > 0) {
        for (const key of DAMAGE_KEYS) delete procChanceByType[key];
        for (const [type, count] of Object.entries(procCountsPerShotByType) as Array<[DamageKey, number]>) {
            procChanceByType[type] = count / averageProcsPerShot;
        }
    }
    const procRatePerSecondByType: Partial<Record<DamageKey, number>> = {};
    for (const [type, perShot] of Object.entries(procCountsPerShotByType) as Array<[DamageKey, number]>) {
        procRatePerSecondByType[type] = perShot * fireRate;
    }

    const expectedStacksByType: Partial<Record<DamageKey, number>> = {};
    let directDamageStatusTypes = 0;
    let conditionOverloadStatusTypes = 0;
    for (const type of STATUS_DAMAGE_TYPES) {
        const rate = procRatePerSecondByType[type] ?? 0;
        const expectedStackCount = expectedStacksForRate(type, rate);
        expectedStacksByType[type] = expectedStackCount;
        const targetCap = options.statusStackCaps?.[type];
        if (
            options.targetStatusState !== "initial" &&
            !statusImmuneTypes.has(type) &&
            !(Number.isFinite(targetCap) && (targetCap ?? 0) <= 0)
        ) {
            const presence = probabilityAtLeastOnePoissonArrival(
                Math.max(0, rate) * STATUS_EFFECT_RULES[type].durationSeconds * statusDurationMultiplier,
            );
            conditionOverloadStatusTypes += presence;
            // The pre-existing direct-hit per-status effect retains its current
            // sourced type set. Condition Overload also counts Tau, which was
            // inadvertently omitted from that older direct-only tally.
            if (type !== "tau") directDamageStatusTypes += presence;
        }
    }
    const uniqueWeaponStatusTypeCount = options.targetStatusState === "initial"
        ? 0
        : new Set(weapon.uniqueStatusProcs ?? []).size;
    conditionOverloadStatusTypes = Math.min(16, conditionOverloadStatusTypes + uniqueWeaponStatusTypeCount);
    directDamageStatusTypes = Math.min(16, directDamageStatusTypes + uniqueWeaponStatusTypeCount);
    const conditionOverloadApplies =
        conditionOverloadDamagePerStatusBonus > 0 &&
        weapon.category === "Melee" &&
        weapon.selectedAttackIgnoresConditionOverload !== true;
    const appliedConditionOverloadBonus = conditionOverloadApplies
        ? conditionOverloadDamagePerStatusBonus
        : 0;
    const externalStatusTypeCount = Number.isFinite(options.conditionalState?.externalStatusTypeCount)
        ? Math.max(0, Math.min(16, Math.floor(options.conditionalState?.externalStatusTypeCount ?? 0)))
        : 0;
    conditionOverloadStatusTypes = Math.min(16, conditionOverloadStatusTypes + externalStatusTypeCount);
    const damageBracket = Math.max(0.0001, 1 + damageBonus);
    const conditionOverloadDamageBracket =
        damageBracket + appliedConditionOverloadBonus * conditionOverloadStatusTypes;
    const conditionOverloadDamageMultiplier = conditionOverloadDamageBracket / damageBracket;
    const conditionOverloadTotalBase = Math.max(0, totalBase * conditionOverloadDamageMultiplier);

    const critAverageMultiplier = avgHitDamageMultiplier(critChance, critMultiplier, nonCriticalHitDamageProcs);
    // The first faction multiplier belongs in each stored proc seed. The second
    // is applied with the remaining DoT multipliers after the accumulator and status coefficient.
    const dotSeedPerProcBeforeConditionOverload =
        Math.fround(
            Math.fround(Math.fround(totalBase * Math.max(0, 1 + factionDamageBonus)) * critAverageMultiplier) *
            procSeedDamageRatio,
        );
    const dotSeedPerProc =
        Math.fround(
            Math.fround(Math.fround(conditionOverloadTotalBase * Math.max(0, 1 + factionDamageBonus)) * critAverageMultiplier) *
            procSeedDamageRatio,
        );
    const dotRemainingMultiplier = (elementalBonus: number) => Math.fround(
        Math.fround(
            Math.fround(Math.max(0, statusDamageMultiplier)) *
            Math.fround(Math.max(0, 1 + elementalBonus)),
        ) * Math.fround(Math.max(0, 1 + factionDamageBonus)),
    );

    const totalPrimaryElementBonus = (type: "heat" | "cold" | "electricity" | "toxin") => {
        const modBonus = mods.reduce((sum, effect) => {
            if (!effect) return sum;
            switch (type) {
                case "heat": return sum + (effect.heatBonus ?? 0);
                case "cold": return sum + (effect.coldBonus ?? 0);
                case "electricity": return sum + (effect.electricityBonus ?? 0);
                case "toxin": return sum + (effect.toxinBonus ?? 0);
            }
        }, 0);
        return modBonus + conditionalPrimaryElementBonuses.reduce(
            (sum, entry) => sum + (entry.type === type ? entry.value : 0),
            0,
        );
    };
    // Magnetic's forced Electricity proc on Shield/Overguard break receives
    // Status Damage and faction bonuses twice, plus ordinary Electricity mods.
    // It is based on the target's broken pool maximum, not the weapon's damage
    // bracket, so generic base-damage and Condition Overload bonuses do not apply.
    const magneticBreakElectricSourceMultiplier = options.includeDoTTickDetails === false
        ? 1
        : Math.pow(Math.max(0, statusDamageMultiplier), 2) *
            Math.max(0, 1 + totalPrimaryElementBonus("electricity")) *
            Math.pow(Math.max(0, 1 + factionDamageBonus), 2);
    const dotConfig: Partial<Record<StatusDamageType, { elementalBonus: number }>> = {
        slash: { elementalBonus: 0 },
        electricity: { elementalBonus: totalPrimaryElementBonus("electricity") },
        heat: { elementalBonus: totalPrimaryElementBonus("heat") },
        toxin: { elementalBonus: totalPrimaryElementBonus("toxin") },
        gas: { elementalBonus: gasBonus + conditionalDirectBonusBreakdown.gas },
    };

    const dotDamagePerShotByType: Partial<Record<DamageKey, number>> = {};
    const dotDpsByType: Partial<Record<DamageKey, number>> = {};
    const dotTickDamagePerProcByType: Partial<Record<DamageKey, number>> = {};
    const dotTickDamagePerProcBeforeConditionOverloadByType: Partial<Record<DamageKey, number>> = {};
    const dotTickAccumulatorDamageByType: Partial<Record<DamageKey, number>> = {};
    const dotDamagePerApplicationSeedByType: Partial<Record<DamageKey, number>> = {};
    const dotDamagePerApplicationAccumulatorByType: Partial<Record<DamageKey, number>> = {};
    let dotDamagePerShot = 0;
    let dotDps = 0;
    const independentDotStacks = new Set<StatusDamageType>(["slash", "toxin"]);
    for (const [key, config] of Object.entries(dotConfig) as Array<[StatusDamageType, { elementalBonus: number }]>) {
        const expectedProcsPerShotForType = averageProcsPerShot * (procChanceByType[key] ?? 0);
        if (expectedProcsPerShotForType <= 0) continue;
        const rule = STATUS_EFFECT_RULES[key];
        const duration = rule.durationSeconds * statusDurationMultiplier;
        if (duration <= 0) continue;
        const includePerAttackDotEstimate = options.includeDoTTickDetails !== false;
        const tickCount = includePerAttackDotEstimate ? countStatusDamageTicks(key, duration) : 0;
        const remainingMultiplier = dotRemainingMultiplier(config.elementalBonus);
        const procRate = procRatePerSecondByType[key] ?? 0;

        if (includePerAttackDotEstimate && tickCount > 0) {
            const baseProcProbability = probabilityAtLeastOneStatusProc(
                statusChance * (key === "tau" ? 1 : tauStatusChanceMultiplier),
                moddedMultishot,
                baseProcChanceByType[key] ?? 0,
            );
            // Some weapon-specific forced-proc rules are conditional/dependent. Their
            // expected count is known, but occurrence probability is an explicit approximation.
            const forcedProcProbability = Math.min(1, extraProcsPerShot[key] ?? 0);
            const probabilityOfAnyProc = 1 - (1 - baseProcProbability) * (1 - forcedProcProbability);
            const seedSumFromAttack = expectedProcsPerShotForType * dotSeedPerProc;
            const seedSumBeforeConditionOverload = expectedProcsPerShotForType * dotSeedPerProcBeforeConditionOverload;
            const seedTickDamageBeforeConditionOverload = statusDotTickDamage(
                dotSeedPerProcBeforeConditionOverload,
                key,
                remainingMultiplier,
                0,
            );

            // Keep the independent seed and consolidated +1 tick accumulator
            // separate so the encounter simulator can refresh Heat stacks
            // without duplicating the accumulator once per proc.
            dotTickDamagePerProcByType[key] = statusDotTickDamage(
                dotSeedPerProc,
                key,
                remainingMultiplier,
                0,
            );
            dotTickDamagePerProcBeforeConditionOverloadByType[key] = seedTickDamageBeforeConditionOverload;
            dotTickAccumulatorDamageByType[key] = statusDotTickDamage(
                0,
                key,
                remainingMultiplier,
                1,
            );

            const perShotTicks = independentDotStacks.has(key)
                ? expectedProcsPerShotForType * statusDotTickDamage(
                    dotSeedPerProc,
                    key,
                    remainingMultiplier,
                )
                : statusDotTickDamage(
                    seedSumFromAttack,
                    key,
                    remainingMultiplier,
                    probabilityOfAnyProc,
                );
            const perShotDamage = perShotTicks * tickCount;
            dotDamagePerShotByType[key] = perShotDamage;
            dotDamagePerShot += perShotDamage;

            const perShotTicksBeforeConditionOverload = independentDotStacks.has(key)
                ? expectedProcsPerShotForType * statusDotTickDamage(
                    dotSeedPerProcBeforeConditionOverload,
                    key,
                    remainingMultiplier,
                )
                : statusDotTickDamage(
                    seedSumBeforeConditionOverload,
                    key,
                    remainingMultiplier,
                    probabilityOfAnyProc,
                );
            const seedDamagePerApplication = seedTickDamageBeforeConditionOverload * tickCount;
            const accumulatorDamagePerShot = Math.max(
                0,
                perShotTicksBeforeConditionOverload * tickCount -
                    expectedProcsPerShotForType * seedDamagePerApplication,
            );
            dotDamagePerApplicationSeedByType[key] = seedDamagePerApplication;
            dotDamagePerApplicationAccumulatorByType[key] =
                accumulatorDamagePerShot / expectedProcsPerShotForType;
        }

        // At steady state, every independent Slash/Toxin stack contributes one
        // tick per second. Heat/Electricity/Gas combine active seeds into one tick
        // group, so the accumulator's +1 is added once per active pulse group.
        const activeStackExpectation = procRate * duration;
        const probabilityOfActiveTickGroup = 1 - Math.exp(-activeStackExpectation);
        const cappedActiveStackExpectation = rule.maxStacks === null
            ? activeStackExpectation
            : Math.min(rule.maxStacks, activeStackExpectation);
        const steadyStateTickDamage = independentDotStacks.has(key)
            ? procRate * duration * statusDotTickDamage(
                dotSeedPerProc,
                key,
                remainingMultiplier,
            )
            : statusDotTickDamage(
                cappedActiveStackExpectation * dotSeedPerProc,
                key,
                remainingMultiplier,
                probabilityOfActiveTickGroup,
            );
        // Chamber bonuses increase the status seed from the first ammo-consuming
        // hit in each magazine too, so steady-state DoT must use the same
        // magazine-average multiplier as direct damage.
        dotDpsByType[key] = steadyStateTickDamage * magazineAverageDamageMultiplier;
        dotDps += dotDpsByType[key] ?? 0;
    }

    // Status presence is a Poisson mean-field, avoiding a hard threshold on fractional stacks.
    const directDamagePerStatusWeight = directDamagePerStatusBonus * directDamageStatusTypes;
    const intrinsicDamagePerStatusBonus = Math.max(0, weapon.intrinsicDamagePerStatusBonus ?? 0);
    const intrinsicDamagePerStatusMode = weapon.intrinsicDamagePerStatusMode ?? "additiveBase";
    const intrinsicDamagePerStatusWeight = intrinsicDamagePerStatusBonus * directDamageStatusTypes;
    const damageBracketWithIntrinsicBonus = intrinsicDamagePerStatusMode === "multiplicativeBase"
        ? conditionOverloadDamageBracket * (1 + intrinsicDamagePerStatusWeight)
        : conditionOverloadDamageBracket + intrinsicDamagePerStatusWeight;
    const combinedPerStatusDamageMultiplier =
        (damageBracketWithIntrinsicBonus + directDamagePerStatusWeight) / damageBracket;
    const directDamagePerStatusMultiplier =
        combinedPerStatusDamageMultiplier / conditionOverloadDamageMultiplier;

    const directRawBreakdown = emptyBreakdown();
    for (const key of DAMAGE_KEYS) {
        directRawBreakdown[key] = rawBreakdown[key] * combinedPerStatusDamageMultiplier;
    }

    const damageBreakdownBeforePerStatus = emptyBreakdown();
    for (const key of DAMAGE_KEYS) {
        damageBreakdownBeforePerStatus[key] = quantizeDamageContribution(rawBreakdown[key], totalBase);
    }
    const damageBreakdown = emptyBreakdown();
    for (const key of DAMAGE_KEYS) {
        damageBreakdown[key] = quantizeDamageContribution(directRawBreakdown[key], conditionOverloadTotalBase * directDamagePerStatusMultiplier);
    }

    const totalDamage = totalDamageOf(damageBreakdown);
    const arsenalDamage = totalDamageOf(directRawBreakdown) * damageWeightedMultishot;
    const averageShotDamage = totalDamage * damageWeightedMultishot * avgHitDamageMultiplier(
        critChance,
        critMultiplier,
        nonCriticalHitDamageProcs,
    );

    const coldStacks = expectedStacksByType.cold ?? 0;
    const heatStacks = expectedStacksByType.heat ?? 0;
    const viralStacks = expectedStacksByType.viral ?? 0;
    const corrosiveStacks = expectedStacksByType.corrosive ?? 0;
    const magneticStacks = expectedStacksByType.magnetic ?? 0;
    const punctureStacks = expectedStacksByType.puncture ?? 0;
    const impactStacks = expectedStacksByType.impact ?? 0;
    const gasStacks = expectedStacksByType.gas ?? 0;
    const radiationStacks = expectedStacksByType.radiation ?? 0;
    const tauStacks = expectedStacksByType.tau ?? 0;

    const coldSlow = coldStacks >= 10 ? 1 : scaleForStacks(Math.min(coldStacks, 9), 0.5, 0.05, 0.9);
    // Wiki: +0.1 on first proc, +0.05 per subsequent proc, max +0.45 at 9 stacks (before freeze).
    // At 10 stacks the enemy freezes and the bonus jumps to +1.0 flat.
    const coldCritDamageBonus =
        coldStacks >= 10
            ? 1.0
            : scaleForStacks(Math.min(coldStacks, 9), 0.1, 0.05, 0.45);
    const viralHealthDamageBonus = scaleForStacks(viralStacks, 1.0, 0.25, 3.25);
    const heatArmorStrip = Math.min(0.5, 0.5 * Math.min(1, heatStacks));
    const corrosiveArmorStrip = scaleForStacks(corrosiveStacks, 0.26, 0.06, 0.8);
    const magneticShieldDamageBonus = scaleForStacks(magneticStacks, 1.0, 0.25, 3.25);
    const radiationAllyDamageBonus = scaleForStacks(radiationStacks, 1.0, 0.5, 5.5);
    const punctureEnemyDamageReduction = scaleForStacks(punctureStacks, 0.4, 0.1, 0.8);
    // Puncture's flat received-critical-chance bonus excludes area damage. The
    // weapon catalog marks attacks as area damage only when the source attack row
    // explicitly identifies them as AoE; unknown classifications keep the
    // single-target weapon-hit behavior and remain an audit limitation.
    const punctureCritChanceBonus = weapon.selectedAttackIsAreaDamage
        ? 0
        : scaleLinearCap(punctureStacks, 0.05, 0.25);
    const impactMercyThresholdBonus = scaleLinearCap(impactStacks, 0.08, 0.4);
    const expectedBlastProcsPerShot = averageProcsPerShot * (procChanceByType.blast ?? 0);
    // Blast records a per-stack hit value H. Current Damage/Calculation
    // applies modded base damage, expected crit, double faction, and Status
    // Damage; physical/elemental bonuses only affect whether the proc occurs.
    const blastStackHitDamagePerProc = Math.fround(
        Math.fround(
            Math.fround(dotSeedPerProc) * Math.fround(Math.max(0, statusDamageMultiplier)),
        ) * Math.fround(Math.max(0, 1 + factionDamageBonus)),
    );
    const blastStackHitDamagePerProcBeforeConditionOverload = Math.fround(
        Math.fround(
            Math.fround(dotSeedPerProcBeforeConditionOverload) * Math.fround(Math.max(0, statusDamageMultiplier)),
        ) * Math.fround(Math.max(0, 1 + factionDamageBonus)),
    );
    const blastExpiryDamagePerProc = blastStackExpiryDamage(blastStackHitDamagePerProc);
    const blastExpectedExpiryDamagePerShot = blastExpiryDamagePerProc * expectedBlastProcsPerShot;
    const gasCloudRadius =
        gasStacks <= 0
            ? 0
            : Math.min(6, 3 + Math.max(0, Math.min(10, gasStacks) - 1) * 0.3);
    const tauStatusVulnerability = scaleLinearCap(tauStacks, 0.1, 1.0);

    const modded: ModdedWeaponStats = {
        rawDamageBreakdown: directRawBreakdown,
        rawDamageBreakdownBeforePerStatus: rawBreakdown,
        baseDamageTotal: baseDamageTotal * meleeAttackComboDamageMultiplier,
        arsenalDamage,
        totalDamageBonus: damageBonus,
        averageShotDamage,
        firstShotMagazineDamageBonus: activeFirstShotMagazineDamageBonus,
        firstShotMagazineDamageMultiplier,
        magazineAverageDamageMultiplier,
        quantizedBaseCritMultiplier,
        critChance,
        critMultiplier,
        nonCriticalHitDamageProcs,
        averageCritTier,
        meleeComboMultiplier,
        meleeAttackComboDamageMultiplier,
        comboCritChancePerTier,
        meleeInitialComboPoints: initialComboCount,
        heavyAttackEfficiency,
        meleeComboPointsBeforeHeavyAttack,
        meleeComboPointsAfterHeavyAttack,
        meleeComboMultiplierAfterHeavyAttack,
        statusChance,
        statusDurationMultiplier,
        fireRate,
        burstFireRate,
        magazineSize,
        ammoCostPerShot,
        chargeTimeSeconds: weapon.selectedAttackChargeAmmoPerSecond
            ? ammoCostPerShot / weapon.selectedAttackChargeAmmoPerSecond
            : null,
        reloadTime,
        firstAttackDamageMultiplier: damageRampMultipliers.firstAttack,
        freshMagazineDamageMultiplier: damageRampMultipliers.freshMagazineAverage,
        sustainedDamageMultiplier: damageRampMultipliers.sustainedAverage,
        magazineDutyCycle,
        ammoEfficiencyBonus,
        infiniteAmmoActive,
        multishot: moddedMultishot,
        damageWeightedMultishot,
        multishotDamageBonus,
        shotsPerMag,
        damageBreakdown,
        totalDamage: totalDamageOf(damageBreakdown),
        procChanceByType,
        averageProcsPerShot,
        forcedProcsPerShot,
        extraProcsPerShot,
        unfilteredExtraProcsPerShot,
        procRatePerSecondByType,
        expectedStacksByType,
        dotDamagePerShot,
        dotDps,
        dotDamagePerShotByType,
        dotDpsByType,
        dotTickDamagePerProcByType,
        dotTickDamagePerProcBeforeConditionOverloadByType,
        dotTickAccumulatorDamageByType,
        dotDamagePerApplicationSeedByType,
        dotDamagePerApplicationAccumulatorByType,
        viralHealthDamageBonus,
        heatArmorStrip,
        corrosiveArmorStrip,
        magneticShieldDamageBonus,
        magneticBreakElectricSourceMultiplier,
        radiationAllyDamageBonus,
        coldSlow,
        coldCritDamageBonus,
        punctureEnemyDamageReduction,
        punctureCritChanceBonus,
        impactMercyThresholdBonus,
        blastStackHitDamagePerProc,
        blastStackHitDamagePerProcBeforeConditionOverload,
        blastExpectedExpiryDamagePerShot,
        blastExpiryDamagePerProc,
        gasCloudRadius,
        tauStatusVulnerability,
        aoeElementalStatusSpreadChance,
        aoeElementalStatusSpreadRadius,
        directDamagePerStatusBonus,
        conditionOverloadDamagePerStatusBonus,
        conditionOverloadApplies,
        conditionOverloadStatusTypes,
        conditionOverloadDamageMultiplier,
        intrinsicDamagePerStatusBonus,
        intrinsicDamagePerStatusMode,
        directDamageStatusTypes,
        directDamagePerStatusMultiplier,
        damageBreakdownBeforePerStatus,
    };

    const burstDPS = averageShotDamage * burstFireRate * damageRampMultipliers.freshMagazineAverage * magazineAverageDamageMultiplier;
    const sustainedDPS = averageShotDamage * fireRate * magazineDutyCycle * damageRampMultipliers.sustainedAverage * magazineAverageDamageMultiplier;

    return { modded, burstDPS, sustainedDPS };
}

/**
 * Finite-encounter average DPS for independent Slash/Toxin proc instances.
 * The per-proc tick damage is recovered from the calculator's already-resolved
 * DoT output, then each periodic tick is counted against the encounter horizon.
 * Proc arrivals follow an even cadence; grouped Heat/Electricity/Gas are not
 * represented by this helper because their tick accumulator consolidates seeds.
 */
export function estimateFiniteIndependentDotDps(
    modded: ModdedWeaponStats,
    type: "slash" | "toxin",
    encounterDurationSeconds: number,
): number {
    if (!Number.isFinite(encounterDurationSeconds) || encounterDurationSeconds <= 0) return 0;
    const fireRate = Math.max(0, modded.fireRate);
    const procRate = Math.max(0, modded.procRatePerSecondByType[type] ?? 0);
    if (fireRate <= 0 || procRate <= 0) return 0;

    const expectedProcsPerShot = procRate / fireRate;
    const statusDuration = STATUS_EFFECT_RULES[type].durationSeconds * modded.statusDurationMultiplier;
    const ticksPerProc = countStatusDamageTicks(type, statusDuration);
    const singleShotDotDamage = modded.dotDamagePerShotByType[type] ?? 0;
    if (expectedProcsPerShot <= 0 || ticksPerProc <= 0 || singleShotDotDamage <= 0) return 0;

    const damagePerTick = singleShotDotDamage / (expectedProcsPerShot * ticksPerProc);
    const finiteTicks = countFiniteEncounterStatusTicks(
        type,
        statusDuration,
        encounterDurationSeconds,
        fireRate,
    );
    return (damagePerTick * expectedProcsPerShot * finiteTicks) / encounterDurationSeconds;
}
