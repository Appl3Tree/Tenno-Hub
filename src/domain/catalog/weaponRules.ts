import type { WeaponCategory, WeaponEntry } from "./weaponCatalog";

export interface MeleeComboRules {
    /** Combo points required to advance one multiplier tier. */
    pointsPerTier: number;
    /** Maximum multiplier tier available to this weapon. */
    maxMultiplier: number;
}

/** Initial Combo points rebuild after a Heavy Attack at this Wiki-listed rate. */
export const INITIAL_COMBO_REGEN_POINTS_PER_SECOND = 40;

export function usesMeleeDamageModel(category: WeaponCategory): boolean {
    return category === "Melee" || category === "Arch-Melee";
}

/** Current weapon-specific exceptions to the standard 20-point, 12x combo ladder. */
export function getMeleeComboRules(weapon: Pick<WeaponEntry, "category" | "name">): MeleeComboRules {
    if (!usesMeleeDamageModel(weapon.category)) return { pointsPerTier: 20, maxMultiplier: 1 };

    const name = weapon.name.trim().toLowerCase();
    if (name === "venka prime") return { pointsPerTier: 20, maxMultiplier: 13 };
    if (name === "dex nikana") return { pointsPerTier: 11, maxMultiplier: 11 };
    return { pointsPerTier: 20, maxMultiplier: 12 };
}

/** Wiki-listed weapon passives that supply Initial Combo before any mods. */
export function getMeleeInnateInitialComboPoints(weapon: Pick<WeaponEntry, "category" | "name">): number {
    if (!usesMeleeDamageModel(weapon.category)) return 0;

    switch (weapon.name.trim().toLowerCase()) {
        case "synoid heliocor":
        case "furax wraith":
            return 20;
        case "fragor prime":
            return 30;
        default:
            return 0;
    }
}

/**
 * Returns the minimum combo points represented by an entered multiplier tier.
 * The 1x tier has no points above its base value.
 */
export function getMeleeComboPointsAtTier(
    weapon: Pick<WeaponEntry, "category" | "name">,
    multiplier: number,
): number {
    const rules = getMeleeComboRules(weapon);
    const tier = clampMeleeComboMultiplier(weapon, multiplier);
    return Math.max(0, (tier - 1) * rules.pointsPerTier);
}

/**
 * Current Heavy Attack Efficiency retains this share of the combo counter,
 * capped at 90%. The caller supplies the percentage as a fraction.
 */
export function getHeavyAttackRetainedComboPoints(comboPoints: number, efficiency: number): number {
    const currentPoints = Number.isFinite(comboPoints) ? Math.max(0, comboPoints) : 0;
    const retainedFraction = Number.isFinite(efficiency)
        ? Math.max(0, Math.min(0.9, efficiency))
        : 0;
    return currentPoints * retainedFraction;
}

export function clampMeleeComboMultiplier(
    weapon: Pick<WeaponEntry, "category" | "name">,
    multiplier: number,
): number {
    const cap = getMeleeComboRules(weapon).maxMultiplier;
    return Number.isFinite(multiplier) ? Math.max(1, Math.min(cap, Math.round(multiplier))) : 1;
}

export function getInitialMeleeComboMultiplier(
    weapon: Pick<WeaponEntry, "category" | "name">,
    initialComboPoints: number,
): number {
    const rules = getMeleeComboRules(weapon);
    if (rules.maxMultiplier <= 1 || !Number.isFinite(initialComboPoints)) return 1;
    return Math.min(
        rules.maxMultiplier,
        1 + Math.floor(Math.max(0, initialComboPoints) / rules.pointsPerTier),
    );
}

function isNamedIncarnonAttack(name: string | undefined): boolean {
    return /incarnon/i.test(String(name ?? ""));
}

export function selectedAttackUsesIncarnonForm(weapon: WeaponEntry, selectedAttackIdx: number): boolean {
    const selectedAttack = weapon.attacks[selectedAttackIdx] ?? weapon.attacks[0];
    if (!selectedAttack) return false;
    if (isNamedIncarnonAttack(selectedAttack.name)) return true;

    const firstIncarnonIdx = weapon.attacks.findIndex((attack) => isNamedIncarnonAttack(attack.name));
    if (firstIncarnonIdx < 0) return false;

    const selectedName = String(selectedAttack.name ?? "").toLowerCase();
    if (/^normal\b/.test(selectedName) || /\buntransformed\b/.test(selectedName)) return false;

    // WFCD sometimes emits supplementary Incarnon-mode attacks without the word
    // "Incarnon" in the name. They follow the explicit Incarnon attack in the list.
    return selectedAttackIdx >= firstIncarnonIdx;
}

export function withSelectedAttack(weapon: WeaponEntry, selectedAttackIdx: number): WeaponEntry {
    const attack = weapon.attacks[selectedAttackIdx];
    if (!attack) return weapon;

    const trigger = attack.trigger ?? weapon.trigger;
    const attackName = attack.name.trim().toLowerCase();
    const isGlaive = /\/glaives?\//i.test(weapon.uniqueName) || /\bglaive\b/i.test(weapon.weaponType);
    const ignoresConditionOverload =
        /\bslam\b/.test(attackName) ||
        attack.isAreaDamage === true ||
        /\b(?:radial|explosion)\b/.test(attackName) ||
        (isGlaive && /\b(?:charged|heavy)\s+throw\b/.test(attackName));
    const usesMeleeComboMultiplier =
        (weapon.category === "Melee" || weapon.category === "Arch-Melee") &&
        (/\bheavy\b/.test(attackName) || (isGlaive && /^charged throw\b/.test(attackName)));
    const useBurstModel =
        trigger.toLowerCase() === "burst" &&
        attack.burstCount !== undefined &&
        attack.burstDelay !== undefined;

    return {
        ...weapon,
        damage: attack.damage,
        critChance: attack.critChance,
        critMultiplier: attack.critMultiplier,
        statusChance: attack.statusChance,
        multishot: attack.multishot ?? weapon.multishot,
        fireRate: useBurstModel ? weapon.fireRate : (attack.speed || weapon.fireRate),
        trigger,
        chargeTime: attack.chargeTime ?? null,
        ammoCostPerShot: attack.ammoCostPerShot ?? weapon.ammoCostPerShot,
        burstCount: useBurstModel ? attack.burstCount : undefined,
        burstDelay: useBurstModel ? attack.burstDelay : undefined,
        burstCycleRate: useBurstModel ? attack.speed : undefined,
        forcedProcs: attack.forcedProcs ?? weapon.forcedProcs,
        uniqueStatusProcs: attack.uniqueStatusProcs,
        forcedProcDistributions: attack.forcedProcDistributions ?? weapon.forcedProcDistributions,
        intrinsicDamagePerStatusBonus: attack.intrinsicDamagePerStatusBonus ?? 0,
        intrinsicDamagePerStatusMode: attack.intrinsicDamagePerStatusMode ?? "additiveBase",
        selectedAttackName: attack.name,
        selectedAttackIsIncarnon: selectedAttackUsesIncarnonForm(weapon, selectedAttackIdx),
        selectedAttackIsAreaDamage: attack.isAreaDamage === true,
        selectedAttackIgnoresConditionOverload: ignoresConditionOverload,
        selectedAttackUsesMeleeComboMultiplier: usesMeleeComboMultiplier,
        selectedAttackUsesSlamDamageBonus: /\bslam attack\b/.test(attackName),
        selectedAttackChargeAmmoPerSecond: attack.chargeAmmoPerSecond,
        selectedAttackChargeDamageBaseAmmoCost: attack.chargeDamageBaseAmmoCost,
        selectedAttackDamageRamp: attack.damageRamp,
    };
}
