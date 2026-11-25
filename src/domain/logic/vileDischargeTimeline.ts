import type { ModEffect } from "../catalog/modCatalog";
import type { WeaponAttack, WeaponEntry } from "../catalog/weaponCatalog";
import { withSelectedAttack } from "../catalog/weaponRules";
import {
    calculateBuild,
    type DamageCalculationOptions,
} from "./damageCalc";
import {
    calculateDirectDamageToInitialPools,
    calculateStatusTickToTargetPools,
    type TargetDamagePool,
} from "./targetDamage";
import {
    countStatusDamageTicks,
    DAMAGE_TYPES,
    STATUS_DAMAGE_TYPES,
    STATUS_EFFECT_RULES,
    type DamageType,
    type StatusDamageType,
} from "./damageRuleset";
import { advanceDamageRampMultiplier, getInitialDamageRampMultiplier } from "./weaponDamageRamp";

export const VILE_DISCHARGE_ALT_FIRE_BASE_RATE = 2.5;
export const VILE_DISCHARGE_MAX_CYCLES = 12;
export const VILE_DISCHARGE_MAX_SIMULATED_ATTACKS = 100_000;
export const VILE_DISCHARGE_RADIUS_METERS = 6;
export const VILE_DISCHARGE_APPROXIMATE_EDGE_FALLOFF = 0.8;

export interface VileDischargeTargetProfile {
    health: number;
    shields: number;
    overguard: number;
    armor: number;
    baseArmorValue?: number;
    armorLevelMultiplier?: number;
    toxinBypassesShields?: boolean;
    /** Same-profile neighboring targets, assumed area-uniform inside 0–3m. */
    nearbyExplosionEnemyCountWithin3m?: number;
    /** Same-profile neighboring targets, assumed area-uniform in the 3–6m annulus. */
    nearbyExplosionEnemyCountFrom3To6m?: number;
}

export interface VileDischargeTimelineInput {
    weapon: WeaponEntry;
    mods: readonly (ModEffect | null)[];
    targetFaction: string;
    targetProfile: VileDischargeTargetProfile;
    damageOptions?: DamageCalculationOptions;
    cycles?: number;
}

export interface VileDischargeTimelineResult {
    supported: boolean;
    limitation: string | null;
    maximumCharge: number;
    completedDischarges: number;
    primaryAttacks: number;
    dotTicks: number;
    targetKills: number;
    elapsedSeconds: number;
    averageDamagePerSecond: number;
    damageByPool: Record<TargetDamagePool, number>;
    primaryDamage: number;
    contactDamage: number;
    explosionDamage: number;
    nearbyExplosionDamage: number;
    nearbyTargetKills: number;
    dotDamage: number;
    chargePerDischarge: number[];
    remainingCharge: number;
    notes: string[];
}

interface ScheduledDotTick {
    time: number;
    sequence: number;
    targetId: number;
    type: StatusDamageType | "heatGroup";
    applications: number;
    tickDamagePerApplication: number;
    accumulatorDamage: number;
}

interface ActiveStatusGroup {
    applications: number;
    expiresAt: number;
}

interface HeatGroupState {
    targetId: number;
    expiresAt: number;
    nextTickAt: number;
    applications: number;
    seedDamagePerTick: number;
    accumulatorDamagePerTick: number;
}

type DamageBuckets = Record<TargetDamagePool, number>;

const POOLS: TargetDamagePool[] = ["overguard", "shields", "health"];
const INDEPENDENT_DOT_TYPES = new Set<StatusDamageType>(["slash", "toxin"]);
const EMBOLIST_NAMES = new Set(["embolist"]);
const TARGET_POOL_EPSILON = 1e-6;

function finiteNonNegative(value: number | undefined): number {
    return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function sumPools(pools: Record<TargetDamagePool, number>): number {
    return POOLS.reduce((sum, pool) => sum + pools[pool], 0);
}

function targetIsDefeated(pools: Record<TargetDamagePool, number>): boolean {
    // Bypassing damage (for example Toxin) can empty Health while Shields
    // remain. That target is dead; requiring every pool to reach zero leaves
    // the timeline charging against an enemy that can no longer be hit.
    return pools.health <= TARGET_POOL_EPSILON ||
        POOLS.every((pool) => pools[pool] <= TARGET_POOL_EPSILON);
}

function emptyBuckets(): DamageBuckets {
    return { overguard: 0, shields: 0, health: 0 };
}

function normalizeCycleCount(value: number | undefined): number {
    if (!Number.isFinite(value)) return 4;
    return Math.max(1, Math.min(VILE_DISCHARGE_MAX_CYCLES, Math.floor(value ?? 4)));
}

function tickComesBefore(left: ScheduledDotTick, right: ScheduledDotTick): boolean {
    return left.time < right.time || (left.time === right.time && left.sequence < right.sequence);
}

function normalizeTargetProfile(profile: VileDischargeTargetProfile): VileDischargeTargetProfile {
    const nearbyInnerCount = Number.isFinite(profile.nearbyExplosionEnemyCountWithin3m)
        ? Math.max(0, Math.min(20, Math.floor(profile.nearbyExplosionEnemyCountWithin3m ?? 0)))
        : 0;
    const nearbyOuterCount = Number.isFinite(profile.nearbyExplosionEnemyCountFrom3To6m)
        ? Math.max(0, Math.min(20 - nearbyInnerCount, Math.floor(profile.nearbyExplosionEnemyCountFrom3To6m ?? 0)))
        : 0;
    return {
        health: finiteNonNegative(profile.health),
        shields: finiteNonNegative(profile.shields),
        overguard: finiteNonNegative(profile.overguard),
        armor: finiteNonNegative(profile.armor),
        ...(Number.isFinite(profile.baseArmorValue) ? { baseArmorValue: finiteNonNegative(profile.baseArmorValue) } : {}),
        ...(Number.isFinite(profile.armorLevelMultiplier) ? { armorLevelMultiplier: finiteNonNegative(profile.armorLevelMultiplier) } : {}),
        toxinBypassesShields: profile.toxinBypassesShields !== false,
        nearbyExplosionEnemyCountWithin3m: nearbyInnerCount,
        nearbyExplosionEnemyCountFrom3To6m: nearbyOuterCount,
    };
}

function resultWithLimitation(
    maximumCharge: number,
    limitation: string,
): VileDischargeTimelineResult {
    return {
        supported: false,
        limitation,
        maximumCharge,
        completedDischarges: 0,
        primaryAttacks: 0,
        dotTicks: 0,
        targetKills: 0,
        elapsedSeconds: 0,
        averageDamagePerSecond: 0,
        damageByPool: emptyBuckets(),
        primaryDamage: 0,
        contactDamage: 0,
        explosionDamage: 0,
        nearbyExplosionDamage: 0,
        nearbyTargetKills: 0,
        dotDamage: 0,
        chargePerDischarge: [],
        remainingCharge: 0,
        notes: [],
    };
}

function makeContactWeapon(weapon: WeaponEntry, attackIndex: number): WeaponEntry {
    const contactDamage = Object.fromEntries(DAMAGE_TYPES.map((type) => [type, 0])) as unknown as WeaponAttack["damage"];
    contactDamage.impact = 10;
    contactDamage.total = 10;
    const attacks = weapon.attacks.map((attack, index) => index === attackIndex
        ? {
            ...attack,
            name: "Vile Discharge Contact",
            damage: contactDamage,
            damageTotal: 10,
            critChance: 0,
            critMultiplier: 1,
            statusChance: 0,
            multishot: 1,
            isAreaDamage: false,
            trigger: "Semi",
            forcedProcs: undefined,
            forcedProcDistributions: undefined,
            uniqueStatusProcs: [],
        }
        : attack);
    return withSelectedAttack({ ...weapon, attacks }, attackIndex);
}

function makeContactEffects(mods: readonly (ModEffect | null)[]): (ModEffect | null)[] {
    return mods.map((effect) => effect ? {
        ...effect,
        critChanceBonus: 0,
        heavyAttackCritChanceBonus: 0,
        slideAttackCritChanceBonus: 0,
        comboCritChanceBonus: 0,
        finalCritChanceBonus: 0,
        critMultBonus: 0,
        finalCritMultiplierBonus: 0,
        weakPointCritChanceBonus: 0,
        perHitCritChanceBonus: 0,
        deadlyManeuversHeadshotCritChanceBonus: 0,
        criticalPrecisionCritChancePerHeadshot: 0,
        unseenDreadCritDamageBonus: 0,
        criticalMutationCritChanceAndDamagePerKill: 0,
        strainInfectionCritDamagePerCyst: 0,
        multishotBonus: 0,
        multishotDamageBonus: 0,
        multishotLocked: true,
        conditionalEffects: [],
        nonCriticalHitDamageProcs: [],
        critAppliesSlashChance: 0,
        impactStatusAppliesMagneticChance: 0,
        impactStatusAppliesSlashChance: 0,
        impactStatusExtraProcLowFireRateThreshold: 0,
        impactStatusExtraProcLowFireRateMultiplier: 0,
    } : null);
}

function poolDamageResult(
    damageByType: Partial<Record<DamageType, number>>,
    targetPools: Record<TargetDamagePool, number>,
    targetProfile: VileDischargeTargetProfile,
    targetFaction: string,
    options: {
        baseDamageTotal?: number;
        rawDamageByType?: Partial<Record<DamageType, number>>;
        expectedDamageMultiplier?: number;
        expectedHitDamageMultiplier?: number;
        factionDamageBonus?: number;
        armorDamageReductionMultiplier?: number;
        hitLocation?: DamageCalculationOptions["hitLocation"];
    } = {},
) {
    return calculateDirectDamageToInitialPools({
        damageByType,
        ...(options.rawDamageByType ? { rawDamageByType: options.rawDamageByType } : {}),
        ...(Number.isFinite(options.baseDamageTotal) ? { baseDamageTotal: options.baseDamageTotal } : {}),
        health: targetPools.health,
        shields: targetPools.shields,
        overguard: targetPools.overguard,
        armor: targetProfile.armor,
        ...(Number.isFinite(targetProfile.baseArmorValue) ? { baseArmorValue: targetProfile.baseArmorValue } : {}),
        ...(Number.isFinite(targetProfile.armorLevelMultiplier) ? { armorLevelMultiplier: targetProfile.armorLevelMultiplier } : {}),
        ...(Number.isFinite(options.armorDamageReductionMultiplier)
            ? { armorDamageReductionMultiplier: options.armorDamageReductionMultiplier }
            : {}),
        faction: targetFaction,
        ...(Number.isFinite(options.factionDamageBonus) ? { factionDamageBonus: options.factionDamageBonus } : {}),
        toxinBypassesShields: targetProfile.toxinBypassesShields,
        ...(Number.isFinite(options.expectedHitDamageMultiplier)
            ? { expectedHitDamageMultiplier: options.expectedHitDamageMultiplier }
            : {}),
        ...(Number.isFinite(options.expectedDamageMultiplier)
            ? { expectedDamageMultiplier: options.expectedDamageMultiplier }
            : {}),
        ...(options.hitLocation ? { hitLocation: options.hitLocation } : {}),
    });
}

/**
 * Simulates Embolist charge/discharge cycles using the selected build's direct
 * hits and expected timed DoT ticks. It releases automatically at the Vile
 * Discharge rank cap, repeats identical focused targets, carries stored charge
 * between them, and estimates configured same-profile explosion neighbors.
 */
export function calculateVileDischargeTimeline(input: VileDischargeTimelineInput): VileDischargeTimelineResult {
    const maximumCharge = input.mods.reduce(
        (maximum, effect) => Math.max(maximum, finiteNonNegative(effect?.vileDischargeMaximumDamage)),
        0,
    );
    const weaponName = input.weapon.name.trim().toLowerCase();
    if (!EMBOLIST_NAMES.has(weaponName)) {
        return resultWithLimitation(maximumCharge, "Vile Discharge is supported only on Embolist.");
    }
    const attackIndex = input.weapon.attacks.findIndex((attack) => /^normal attack$/i.test(attack.name.trim()));
    if (attackIndex < 0 || !/^normal attack$/i.test(input.weapon.selectedAttackName?.trim() ?? "")) {
        return resultWithLimitation(maximumCharge, "Select Embolist's Normal Attack to score its Vile Discharge cycle.");
    }
    if (maximumCharge <= 0) {
        return resultWithLimitation(0, "Equip Vile Discharge to score the charge-and-discharge cycle.");
    }
    if (input.weapon.selectedAttackIsAreaDamage === true || input.weapon.selectedAttackModelLimitation) {
        return resultWithLimitation(maximumCharge, "This Embolist attack profile does not support the single-target Vile Discharge event model.");
    }

    const targetProfile = normalizeTargetProfile(input.targetProfile);
    const initialPoolTotal = sumPools({
        health: targetProfile.health,
        shields: targetProfile.shields,
        overguard: targetProfile.overguard,
    });
    if (initialPoolTotal <= 0) {
        return resultWithLimitation(maximumCharge, "Select a target with a nonzero Health, Shield, or Overguard pool.");
    }

    const selectedWeapon = withSelectedAttack(input.weapon, attackIndex);
    const damageOptions: DamageCalculationOptions = {
        ...(input.damageOptions ?? {}),
        includeDoTTickDetails: true,
    };
    const primary = calculateBuild(selectedWeapon, [...input.mods], input.targetFaction, damageOptions).modded;
    if (primary.fireRate <= 0 || primary.totalDamage <= 0 || !primary.ammoGateSatisfied) {
        return resultWithLimitation(maximumCharge, "The selected Embolist build cannot produce a supported Normal Attack event.");
    }

    const contactWeapon = makeContactWeapon(input.weapon, attackIndex);
    const contactEffects = makeContactEffects(input.mods);
    const contact = calculateBuild(contactWeapon, contactEffects, input.targetFaction, {
        ...damageOptions,
        conditionalState: { mode: "initial" },
        hitLocation: { canHeadshot: false },
    }).modded;

    const targetIdState = { current: 0 };
    let targetPools = {
        overguard: targetProfile.overguard,
        shields: targetProfile.shields,
        health: targetProfile.health,
    };
    const nearbyTargetPools = Array.from({
        length: (targetProfile.nearbyExplosionEnemyCountWithin3m ?? 0) +
            (targetProfile.nearbyExplosionEnemyCountFrom3To6m ?? 0),
    }, () => ({
        overguard: targetProfile.overguard,
        shields: targetProfile.shields,
        health: targetProfile.health,
    }));
    const damageByPool = emptyBuckets();
    let primaryDamage = 0;
    let contactDamage = 0;
    let explosionDamage = 0;
    let nearbyExplosionDamage = 0;
    let nearbyTargetKills = 0;
    let dotDamage = 0;
    let charge = 0;
    let completedDischarges = 0;
    let primaryAttacks = 0;
    let dotTicks = 0;
    let targetKills = 0;
    let currentTime = 0;
    let nextPrimaryTime = Math.max(0, primary.initialAttackDelaySeconds);
    let previousPrimaryTime = nextPrimaryTime;
    let activeRampMultiplier = getInitialDamageRampMultiplier(selectedWeapon.selectedAttackDamageRamp);
    let nextAttackAfterVileLock = false;
    let reloadUntil = 0;
    let pendingDischargeAt: number | null = null;
    let lastDischargeActionEnd = 0;
    let shotIndex = 0;
    let nextSequence = 0;
    let heatGroup: HeatGroupState | null = null;
    const activeDotGroups = new Map<StatusDamageType, ActiveStatusGroup[]>();
    const chargePerDischarge: number[] = [];
    const scheduledTicks: ScheduledDotTick[] = [];

    const pushTick = (tick: ScheduledDotTick) => {
        let index = scheduledTicks.length;
        scheduledTicks.push(tick);
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (!tickComesBefore(tick, scheduledTicks[parent])) break;
            scheduledTicks[index] = scheduledTicks[parent];
            index = parent;
        }
        scheduledTicks[index] = tick;
    };
    const popTick = (): ScheduledDotTick | undefined => {
        if (scheduledTicks.length === 0) return undefined;
        const first = scheduledTicks[0];
        const last = scheduledTicks.pop()!;
        if (scheduledTicks.length > 0) {
            let index = 0;
            while (true) {
                const left = index * 2 + 1;
                if (left >= scheduledTicks.length) break;
                const right = left + 1;
                const child = right < scheduledTicks.length && tickComesBefore(scheduledTicks[right], scheduledTicks[left])
                    ? right
                    : left;
                if (!tickComesBefore(scheduledTicks[child], last)) break;
                scheduledTicks[index] = scheduledTicks[child];
                index = child;
            }
            scheduledTicks[index] = last;
        }
        return first;
    };
    const addCharge = (damageByType: Partial<Record<DamageType, number>>) => {
        const rawDamageByPool = emptyBuckets();
        for (const type of DAMAGE_TYPES) {
            const damage = finiteNonNegative(damageByType[type]);
            if (damage <= 0) continue;
            const bypassesShields = type === "true" || type === "slash" ||
                (type === "toxin" && targetProfile.toxinBypassesShields !== false);
            const pool: TargetDamagePool = targetPools.overguard > 0
                ? "overguard"
                : bypassesShields
                    ? "health"
                    : targetPools.shields > 0
                        ? "shields"
                        : "health";
            rawDamageByPool[pool] += damage;
        }
        const cappedByRemainingTargetPools = POOLS.reduce(
            (total, pool) => total + Math.min(rawDamageByPool[pool], targetPools[pool]),
            0,
        );
        charge = Math.min(maximumCharge, charge + cappedByRemainingTargetPools);
    };
    const accumulateDamage = (bucket: DamageBuckets, result: Record<TargetDamagePool, number>) => {
        for (const pool of POOLS) {
            bucket[pool] += result[pool];
            damageByPool[pool] += result[pool];
        }
    };
    const advanceTargetIfKilled = () => {
        if (!targetIsDefeated(targetPools)) return false;
        targetKills++;
        targetIdState.current++;
        targetPools = {
            overguard: targetProfile.overguard,
            shields: targetProfile.shields,
            health: targetProfile.health,
        };
        activeDotGroups.clear();
        heatGroup = null;
        return true;
    };
    const applyDirect = (
        stats: typeof primary,
        damageFactor: number,
        includeFactionMod: boolean,
        outputBucket: "primary" | "contact" | "explosion",
        damageTypes: Partial<Record<DamageType, number>> = stats.damageBreakdown,
        expectedDamageMultiplier = stats.damageWeightedMultishot + stats.singleProjectileDamageBonus,
        expectedHitDamageMultiplier = stats.expectedHitDamageMultiplier,
        useHitLocation = stats.hitLocation,
    ) => {
        const scaledDamage = Object.fromEntries(DAMAGE_TYPES.map((type) => [
            type,
            finiteNonNegative(damageTypes[type]) * damageFactor,
        ])) as Partial<Record<DamageType, number>>;
        const result = poolDamageResult(scaledDamage, targetPools, targetProfile, input.targetFaction, {
            baseDamageTotal: stats.baseDamageTotal * damageFactor,
            rawDamageByType: stats.rawDamageBreakdown,
            expectedDamageMultiplier,
            expectedHitDamageMultiplier,
            ...(includeFactionMod ? { factionDamageBonus: stats.factionDamageBonus } : {}),
            hitLocation: useHitLocation,
        });
        for (const pool of POOLS) targetPools[pool] = Math.max(0, targetPools[pool] - result.damageByPool[pool]);
        const dealt = result.totalDamage;
        if (outputBucket === "primary") primaryDamage += dealt;
        else if (outputBucket === "contact") contactDamage += dealt;
        else explosionDamage += dealt;
        accumulateDamage(emptyBuckets(), result.damageByPool);
        return result;
    };
    const processDotDamage = (
        type: StatusDamageType,
        rawTickDamage: number,
        targetId: number,
    ) => {
        if (targetId !== targetIdState.current || targetIsDefeated(targetPools)) return;
        addCharge({
            [type]: finiteNonNegative(rawTickDamage) * Math.max(0, 1 + primary.factionDamageBonus),
        });
        const dealt = calculateStatusTickToTargetPools({
            faction: input.targetFaction,
            armor: targetProfile.armor,
            toxinBypassesShields: targetProfile.toxinBypassesShields,
        }, targetPools, type, rawTickDamage);
        for (const pool of POOLS) targetPools[pool] = Math.max(0, targetPools[pool] - dealt[pool]);
        dotDamage += sumPools(dealt);
        for (const pool of POOLS) damageByPool[pool] += dealt[pool];
        dotTicks++;
        advanceTargetIfKilled();
    };
    const scheduleStatusTicks = (attackTime: number, attackDamageFactor: number) => {
        const immuneTypes = new Set(damageOptions.statusImmuneTypes ?? []);
        for (const type of STATUS_DAMAGE_TYPES) {
            if (immuneTypes.has(type)) continue;
            const rule = STATUS_EFFECT_RULES[type];
            if (rule.firstTickSeconds === null || rule.dotCoefficient === null) continue;
            const applications = finiteNonNegative(primary.averageProcsPerShot * (primary.procChanceByType[type] ?? 0));
            if (applications <= 0) continue;
            const duration = rule.durationSeconds * primary.statusDurationMultiplier;
            const tickCount = countStatusDamageTicks(type, duration);
            if (tickCount <= 0) continue;
            const seedPerApplication = finiteNonNegative(primary.dotTickDamagePerProcByType[type]) * attackDamageFactor;
            const accumulatorDamage = finiteNonNegative(primary.dotTickAccumulatorDamageByType[type]);
            const existingGroups = activeDotGroups.get(type) ?? [];
            const nowActiveGroups = existingGroups.filter((group) => group.expiresAt >= attackTime - 1e-9);
            const targetCap = damageOptions.statusStackCaps?.[type];
            const maximumStacks = Number.isFinite(targetCap)
                ? Math.max(0, Math.min(rule.maxStacks ?? Number.MAX_SAFE_INTEGER, targetCap ?? 0))
                : rule.maxStacks;
            const activeStackTotal = nowActiveGroups.reduce((sum, group) => sum + group.applications, 0);
            const cappedApplications = maximumStacks === null
                ? applications
                : Math.max(0, Math.min(applications, maximumStacks - activeStackTotal));
            if (cappedApplications <= 0) continue;
            if (type === "heat") {
                for (const group of nowActiveGroups) group.expiresAt = attackTime + duration;
            }
            nowActiveGroups.push({ applications: cappedApplications, expiresAt: attackTime + duration });
            activeDotGroups.set(type, nowActiveGroups);

            if (type === "heat") {
                if (!heatGroup || heatGroup.targetId !== targetIdState.current || heatGroup.expiresAt < attackTime - 1e-9) {
                    heatGroup = {
                        targetId: targetIdState.current,
                        expiresAt: attackTime + duration,
                        nextTickAt: attackTime + 1,
                        applications: cappedApplications,
                        seedDamagePerTick: seedPerApplication * cappedApplications,
                        accumulatorDamagePerTick: accumulatorDamage,
                    };
                    if (heatGroup.nextTickAt <= heatGroup.expiresAt + 1e-9) {
                        pushTick({
                            time: heatGroup.nextTickAt,
                            sequence: nextSequence++,
                            targetId: heatGroup.targetId,
                            type: "heatGroup",
                            applications: 0,
                            tickDamagePerApplication: 0,
                            accumulatorDamage: 0,
                        });
                    }
                } else {
                    heatGroup.expiresAt = attackTime + duration;
                    heatGroup.applications += cappedApplications;
                    heatGroup.seedDamagePerTick += seedPerApplication * cappedApplications;
                    heatGroup.accumulatorDamagePerTick = accumulatorDamage;
                }
                continue;
            }

            for (let tickIndex = 0; tickIndex < tickCount; tickIndex++) {
                pushTick({
                    time: attackTime + rule.firstTickSeconds + tickIndex,
                    sequence: nextSequence++,
                    targetId: targetIdState.current,
                    type,
                    applications: cappedApplications,
                    tickDamagePerApplication: seedPerApplication,
                    accumulatorDamage,
                });
            }
        }
    };
    const processTick = (tick: ScheduledDotTick) => {
        if (tick.targetId !== targetIdState.current || targetIsDefeated(targetPools)) return;
        if (tick.type === "heatGroup") {
            if (!heatGroup || heatGroup.targetId !== targetIdState.current ||
                currentTime > heatGroup.expiresAt + 1e-9 || currentTime < heatGroup.nextTickAt - 1e-9) return;
            const damage = heatGroup.seedDamagePerTick + heatGroup.accumulatorDamagePerTick;
            processDotDamage("heat", damage, tick.targetId);
            if (heatGroup && heatGroup.targetId === targetIdState.current && currentTime + 1 <= heatGroup.expiresAt + 1e-9) {
                heatGroup.nextTickAt = currentTime + 1;
                pushTick({
                    time: heatGroup.nextTickAt,
                    sequence: nextSequence++,
                    targetId: heatGroup.targetId,
                    type: "heatGroup",
                    applications: 0,
                    tickDamagePerApplication: 0,
                    accumulatorDamage: 0,
                });
            } else {
                heatGroup = null;
            }
            return;
        }
        const groups = (activeDotGroups.get(tick.type) ?? []).filter((group) => group.expiresAt >= currentTime - 1e-9);
        activeDotGroups.set(tick.type, groups);
        const activeApplications = groups.reduce((sum, group) => sum + group.applications, 0);
        if (activeApplications <= 0) return;
        const probabilityOfAnyActiveGroup = 1 - Math.exp(-activeApplications);
        const isIndependent = INDEPENDENT_DOT_TYPES.has(tick.type);
        const damage = tick.applications * tick.tickDamagePerApplication + tick.accumulatorDamage *
            (isIndependent ? tick.applications : probabilityOfAnyActiveGroup);
        processDotDamage(tick.type, damage, tick.targetId);
    };

    const contactDamageByType = Object.fromEntries(DAMAGE_TYPES.map((type) => [type, contact.damageBreakdown[type]])) as Partial<Record<DamageType, number>>;
    const fireRateScale = input.weapon.fireRate > 0 ? primary.fireRate / input.weapon.fireRate : 1;
    const altFireActionLockSeconds = 1 / Math.max(0.05, VILE_DISCHARGE_ALT_FIRE_BASE_RATE * fireRateScale);
    const cycles = normalizeCycleCount(input.cycles);
    const targetCycleLimitSeconds = 600;
    const innerFalloffMultiplier = 1 - VILE_DISCHARGE_APPROXIMATE_EDGE_FALLOFF * (2 / VILE_DISCHARGE_RADIUS_METERS);
    const outerAverageRadius = (2 / 3) * (VILE_DISCHARGE_RADIUS_METERS ** 3 - 3 ** 3) /
        (VILE_DISCHARGE_RADIUS_METERS ** 2 - 3 ** 2);
    const outerFalloffMultiplier = Math.max(
        0.2,
        1 - VILE_DISCHARGE_APPROXIMATE_EDGE_FALLOFF * outerAverageRadius / VILE_DISCHARGE_RADIUS_METERS,
    );
    const applyExplosionToPools = (
        pools: Record<TargetDamagePool, number>,
        storedCharge: number,
        falloffMultiplier = 1,
    ) => {
        const toxinDamage: Partial<Record<DamageType, number>> = {
            toxin: storedCharge * falloffMultiplier,
        };
        const result = poolDamageResult(toxinDamage, pools, targetProfile, input.targetFaction);
        for (const pool of POOLS) pools[pool] = Math.max(0, pools[pool] - result.damageByPool[pool]);
        return result;
    };

    const discharge = () => {
        const storedCharge = charge;
        chargePerDischarge.push(storedCharge);
        charge = 0;
        completedDischarges++;
        const dischargedTargetId = targetIdState.current;
        applyDirect(contact, 1, true, "contact", contactDamageByType, 1, 1, { canHeadshot: false });
        const contactKilledTarget = advanceTargetIfKilled();
        if (!contactKilledTarget && targetIdState.current === dischargedTargetId && !targetIsDefeated(targetPools)) {
            const result = applyExplosionToPools(targetPools, storedCharge);
            explosionDamage += result.totalDamage;
            accumulateDamage(emptyBuckets(), result.damageByPool);
            advanceTargetIfKilled();
        }
        for (let index = 0; index < nearbyTargetPools.length; index++) {
            const pools = nearbyTargetPools[index];
            const innerCount = targetProfile.nearbyExplosionEnemyCountWithin3m ?? 0;
            const falloffMultiplier = index < innerCount ? innerFalloffMultiplier : outerFalloffMultiplier;
            const result = applyExplosionToPools(pools, storedCharge, falloffMultiplier);
            nearbyExplosionDamage += result.totalDamage;
            explosionDamage += result.totalDamage;
            accumulateDamage(emptyBuckets(), result.damageByPool);
            if (targetIsDefeated(pools)) {
                nearbyTargetKills++;
                nearbyTargetPools[index] = {
                    overguard: targetProfile.overguard,
                    shields: targetProfile.shields,
                    health: targetProfile.health,
                };
            }
        }
        lastDischargeActionEnd = currentTime + altFireActionLockSeconds;
    };

    const maybeDischarge = () => {
        if (charge + 1e-9 < maximumCharge || completedDischarges >= cycles) return;
        if (currentTime < reloadUntil - 1e-9) {
            pendingDischargeAt = reloadUntil;
            return;
        }
        pendingDischargeAt = null;
        discharge();
        nextPrimaryTime = Math.max(nextPrimaryTime, currentTime + altFireActionLockSeconds);
        nextAttackAfterVileLock = true;
    };

    while (completedDischarges < cycles && primaryAttacks < VILE_DISCHARGE_MAX_SIMULATED_ATTACKS && currentTime <= targetCycleLimitSeconds) {
        const nextDotTime = scheduledTicks[0]?.time ?? Number.POSITIVE_INFINITY;
        const nextEventTime = Math.min(nextPrimaryTime, nextDotTime, pendingDischargeAt ?? Number.POSITIVE_INFINITY);
        if (!Number.isFinite(nextEventTime) || nextEventTime > targetCycleLimitSeconds) break;
        currentTime = Math.max(currentTime, nextEventTime);

        while (scheduledTicks.length > 0 && scheduledTicks[0].time <= currentTime + 1e-9) {
            processTick(popTick()!);
        }
        maybeDischarge();
        if (completedDischarges >= cycles) break;
        if (pendingDischargeAt !== null && pendingDischargeAt <= currentTime + 1e-9 && currentTime >= reloadUntil - 1e-9) {
            maybeDischarge();
            if (completedDischarges >= cycles) break;
        }

        if (nextPrimaryTime <= currentTime + 1e-9 && currentTime >= reloadUntil - 1e-9) {
            const magazineShots = Math.max(1, Math.floor(primary.finiteShotsPerMag));
            const shotInMagazine = shotIndex % magazineShots;
            const isFirstShot = shotInMagazine === 0;
            const isLastShot = shotInMagazine === magazineShots - 1;
            const magazineDamageMultiplier = (isFirstShot ? primary.firstShotMagazineDamageMultiplier : 1) *
                (isLastShot ? primary.lastShotMagazineDamageMultiplier : 1);
            let rampMultiplier = activeRampMultiplier;
            if (shotIndex > 0 && selectedWeapon.selectedAttackDamageRamp) {
                const gap = Math.max(0, nextPrimaryTime - previousPrimaryTime);
                const reloadGap = isFirstShot ? primary.reloadTime : 0;
                if (nextAttackAfterVileLock) {
                    // Alt-Fire interrupts the beam. Its lock is idle time for
                    // Embolist's 0.8s damage-ramp grace, not additional firing.
                    rampMultiplier = advanceDamageRampMultiplier(
                        selectedWeapon.selectedAttackDamageRamp,
                        rampMultiplier,
                        gap,
                        false,
                    );
                } else if (isFirstShot) {
                    rampMultiplier = advanceDamageRampMultiplier(
                        selectedWeapon.selectedAttackDamageRamp,
                        rampMultiplier,
                        reloadGap,
                        false,
                    );
                    rampMultiplier = advanceDamageRampMultiplier(
                        selectedWeapon.selectedAttackDamageRamp,
                        rampMultiplier,
                        Math.max(0, gap - reloadGap),
                        true,
                    );
                } else {
                    rampMultiplier = advanceDamageRampMultiplier(
                        selectedWeapon.selectedAttackDamageRamp,
                        rampMultiplier,
                        gap,
                        true,
                    );
                }
            }
            const damageFactor = rampMultiplier * magazineDamageMultiplier;
            const chargeMultiplier = (primary.damageWeightedMultishot + primary.singleProjectileDamageBonus) *
                primary.expectedHitDamageMultiplier * Math.max(0, 1 + primary.factionDamageBonus) * damageFactor;
            addCharge(Object.fromEntries(DAMAGE_TYPES.map((type) => [
                type,
                finiteNonNegative(primary.damageBreakdown[type]) * chargeMultiplier,
            ])) as Partial<Record<DamageType, number>>);
            applyDirect(primary, damageFactor, true, "primary");
            primaryAttacks++;
            scheduleStatusTicks(currentTime, damageFactor);
            advanceTargetIfKilled();

            previousPrimaryTime = currentTime;
            activeRampMultiplier = rampMultiplier;
            nextAttackAfterVileLock = false;
            shotIndex++;
            const interval = 1 / primary.fireRate;
            nextPrimaryTime = currentTime + interval;
            if (isLastShot && primary.reloadTime > 0) {
                reloadUntil = currentTime + primary.reloadTime;
                nextPrimaryTime += primary.reloadTime;
            }
            // Release at the cap as soon as this hit is complete, unless the
            // magazine is reloading; that case is queued at reloadUntil.
            maybeDischarge();
        }
    }

    // Resolve the already-scheduled DoT tail from the final charged cycle. No
    // additional primary shots or discharges are started during this tail.
    while (scheduledTicks.length > 0) {
        const tick = popTick()!;
        currentTime = Math.max(currentTime, tick.time);
        processTick(tick);
    }

    const totalDamage = primaryDamage + contactDamage + explosionDamage + dotDamage;
    const supported = completedDischarges === cycles;
    const elapsedSeconds = Math.max(currentTime, supported ? lastDischargeActionEnd : 0);
    return {
        supported,
        limitation: supported ? null : "The selected target and build did not reach the requested Vile Discharge cycles within the simulation limit.",
        maximumCharge,
        completedDischarges,
        primaryAttacks,
        dotTicks,
        targetKills,
        elapsedSeconds,
        averageDamagePerSecond: elapsedSeconds > 0 ? totalDamage / elapsedSeconds : 0,
        damageByPool,
        primaryDamage,
        contactDamage,
        explosionDamage,
        nearbyExplosionDamage,
        nearbyTargetKills,
        dotDamage,
        chargePerDischarge,
        remainingCharge: charge,
        notes: [
            "Releases automatically at the selected rank's charge cap; stored charge carries across identical target profiles.",
            "The primary target is centered. Neighbor counts use the planner's 0–3m and 3–6m same-profile fields; targets are assumed area-uniform within each band.",
            "The Wiki reports approximately 80% falloff at the 6m edge but does not specify the curve. Neighbor damage linearly interpolates from full center damage to 20% at 6m; Fulmination radius changes are not modeled.",
            "Overkill is capped against the remaining raw target pools before defenses as an explicit mean-field interpretation of the Wiki note.",
            "Status proc counts use deterministic expected values. Heat uses a refreshed shared tick stream; other DoT ticks follow the calculator's expected per-proc damage and timing.",
            "Enemy armor, pool-specific damage rules, status immunities, and Toxin shield bypass apply to damage received; enemy defenses and debuff amplifiers do not multiply stored charge.",
        ],
    };
}
