import type { WeaponDamage, WeaponEntry } from "../catalog/weaponCatalog";
import { withSelectedAttack } from "../catalog/weaponRules";
import type { ModEffect } from "../catalog/modCatalog";
import { calculateBuild, type DamageCalculationOptions } from "./damageCalc";

export type StaticDischargeStartingOrder = "spinThenOverhead" | "overheadThenSpin";

export const STATIC_DISCHARGE_PULSE_INTERVAL_SECONDS = 0.2;
export const DEFAULT_STATIC_DISCHARGE_FIRST_ANIMATION_SECONDS = 0.8;
export const MAX_STATIC_DISCHARGE_FIRST_ANIMATION_SECONDS = 5;

export function normalizeStaticDischargeFirstAnimationSeconds(value: number | undefined): number {
    if (!Number.isFinite(value)) return DEFAULT_STATIC_DISCHARGE_FIRST_ANIMATION_SECONDS;
    const clamped = Math.max(0, Math.min(MAX_STATIC_DISCHARGE_FIRST_ANIMATION_SECONDS, value ?? 0));
    return Math.round((clamped + Number.EPSILON) * 20) / 20;
}

export interface StaticDischargeCycleInput {
    weapon: WeaponEntry;
    mods: readonly (ModEffect | null)[];
    startingOrder: StaticDischargeStartingOrder;
    firstAnimationSeconds: number;
    targetFaction?: string;
    damageOptions?: DamageCalculationOptions;
}

export interface StaticDischargeCycleResult {
    supported: boolean;
    limitation: string | null;
    startingOrder: StaticDischargeStartingOrder;
    firstAnimationSeconds: number;
    pulseCount: number;
    rankDamageFraction: number;
    pulseDamageCoefficient: number;
    followUpDamageCoefficient: number;
    expectedDirectHeavyHitDamage: number;
    expectedPulseDamage: number;
    expectedFollowUpDamage: number;
    windUpDamage: number;
    expectedCycleDamageBeforeTargetDefenses: number;
}

const PROVA_NAMES = new Set(["prova", "prova vandal"]);

function emptyStaticDischargeResult(
    input: StaticDischargeCycleInput,
    limitation: string,
): StaticDischargeCycleResult {
    return {
        supported: false,
        limitation,
        startingOrder: input.startingOrder,
        firstAnimationSeconds: normalizeStaticDischargeFirstAnimationSeconds(input.firstAnimationSeconds),
        pulseCount: 0,
        rankDamageFraction: 0,
        pulseDamageCoefficient: 0,
        followUpDamageCoefficient: 0,
        expectedDirectHeavyHitDamage: 0,
        expectedPulseDamage: 0,
        expectedFollowUpDamage: 0,
        windUpDamage: 0,
        expectedCycleDamageBeforeTargetDefenses: 0,
    };
}

function electricityOnlyDamage(baseWeaponDamage: number): WeaponDamage {
    return {
        total: baseWeaponDamage,
        impact: 0,
        puncture: 0,
        slash: 0,
        heat: 0,
        cold: 0,
        electricity: baseWeaponDamage,
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
}

/**
 * Estimate one manual Static Discharge sequence on a single selected target.
 * The rank fraction scales the Wiki's spin/overhead event coefficients; the
 * animation duration and first tick at 0.2s are explicit user/model assumptions.
 */
export function calculateStaticDischargeCycle(input: StaticDischargeCycleInput): StaticDischargeCycleResult {
    if (!PROVA_NAMES.has(input.weapon.name.trim().toLowerCase())) {
        return emptyStaticDischargeResult(input, "Static Discharge is supported only on Prova and Prova Vandal.");
    }
    const heavyAttackIndex = input.weapon.attacks.findIndex((attack) => /^heavy attack$/i.test(attack.name.trim()));
    if (heavyAttackIndex < 0) {
        return emptyStaticDischargeResult(input, "This weapon profile has no catalogued Heavy Attack row.");
    }
    const rankDamageFraction = input.mods.reduce(
        (sum, effect) => sum + (effect?.staticDischargeDamagePerWeaponDamage ?? 0),
        0,
    );
    if (rankDamageFraction <= 0) {
        return emptyStaticDischargeResult(input, "Equip Static Discharge to score this cycle.");
    }

    const firstAnimationSeconds = normalizeStaticDischargeFirstAnimationSeconds(input.firstAnimationSeconds);
    const pulseCount = Math.floor((firstAnimationSeconds + 1e-9) / STATIC_DISCHARGE_PULSE_INTERVAL_SECONDS);
    const pulseDamageCoefficient = input.startingOrder === "spinThenOverhead" ? 0.24 : 0.8;
    const followUpDamageCoefficient = input.startingOrder === "spinThenOverhead" ? 8 : 2.4;
    const heavyWeapon = withSelectedAttack(input.weapon, heavyAttackIndex);
    const options = input.damageOptions ?? {};
    const targetFaction = input.targetFaction ?? "";
    const effects = [...input.mods];
    const expectedDirectHeavyHitDamage = calculateBuild(heavyWeapon, effects, targetFaction, options).modded.averageShotDamage;
    const baseWeaponDamage = Math.max(0, input.weapon.damage.total);
    const expectedPulseDamage = calculateBuild({
        ...heavyWeapon,
        damage: electricityOnlyDamage(baseWeaponDamage * rankDamageFraction * pulseDamageCoefficient),
    }, effects, targetFaction, options).modded.averageShotDamage;
    const expectedFollowUpDamage = calculateBuild({
        ...heavyWeapon,
        damage: electricityOnlyDamage(baseWeaponDamage * rankDamageFraction * followUpDamageCoefficient),
    }, effects, targetFaction, options).modded.averageShotDamage;
    // Wiki note: one 1-damage Electricity hit occurs at wind-up. This literal
    // point is included; proc application and its later status ticks are not.
    const windUpDamage = 1;

    return {
        supported: true,
        limitation: null,
        startingOrder: input.startingOrder,
        firstAnimationSeconds,
        pulseCount,
        rankDamageFraction,
        pulseDamageCoefficient,
        followUpDamageCoefficient,
        expectedDirectHeavyHitDamage,
        expectedPulseDamage,
        expectedFollowUpDamage,
        windUpDamage,
        expectedCycleDamageBeforeTargetDefenses:
            2 * expectedDirectHeavyHitDamage + pulseCount * expectedPulseDamage + expectedFollowUpDamage + windUpDamage,
    };
}

