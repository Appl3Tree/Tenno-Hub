// src/domain/catalog/weaponCatalog.ts
// Weapon data catalog built from All.json for the mod builder.

import ALL_RAW from "../../data/_generated/warframe-items-all-lean.auto.json";
import OVERFRAME_ITEMS_RAW from "../../../external/overframe-gg/items.json";
import { ITEMS_CATALOG } from "./itemsCatalog";

const ALL = ALL_RAW as Record<string, unknown>[];
const OVERFRAME_ITEMS = OVERFRAME_ITEMS_RAW as Record<string, Record<string, unknown>>;

export type WeaponCategory = "Primary" | "Secondary" | "Melee" | "Arch-Gun" | "Arch-Melee" | "Companion";
export type ModCompatName = "Rifle" | "Sniper" | "Shotgun" | "Pistol" | "Bow" | "Melee" | "Archgun" | "Archmelee";
export type IntrinsicDamagePerStatusMode = "additiveBase" | "multiplicativeBase";

// WFCD's weapon feed currently labels both Perigale variants as "Rifle", but
// they are sniper rifles and accept the sniper-specific mod family.
const PRIMARY_SNIPER_MOD_COMPAT_OVERRIDES = new Set([
    "/Lotus/Weapons/Tenno/LongGuns/TnQuadSniper/TnQuadSniper",
    "/Lotus/Weapons/Tenno/LongGuns/PrimePerigale/PrimePerigaleSniper",
]);

const PERIGALE_GALE_FORCE_UNIQUE_NAMES = new Set([
    "/Lotus/Weapons/Tenno/LongGuns/TnQuadSniper/TnQuadSniper",
    "/Lotus/Weapons/Tenno/LongGuns/PrimePerigale/PrimePerigaleSniper",
]);

export interface WeaponDamageRampRule {
    /** Minimum damage factor before the weapon has ramped up. */
    minimumDamageMultiplier: number;
    /** Time spent firing before the beam reaches full damage. */
    rampToFullSeconds: number;
    /** Continuous idle time before damage begins to decay. */
    idleBeforeDecaySeconds: number;
    /** Time spent idle after the delay before returning to minimum damage. */
    decayToMinimumSeconds: number;
}

export interface WeaponDamage {
    total: number;
    impact: number;
    puncture: number;
    slash: number;
    heat: number;
    cold: number;
    electricity: number;
    toxin: number;
    blast: number;
    radiation: number;
    gas: number;
    magnetic: number;
    viral: number;
    corrosive: number;
    void: number;
    tau: number;
    true: number;
}

export interface WeaponAttack {
    name: string;
    speed: number;
    /** Verified weapon passive bonus per unique active status, for direct hits only. */
    intrinsicDamagePerStatusBonus?: number;
    /** How the attack-specific passive stacks with ordinary base-damage bonuses. */
    intrinsicDamagePerStatusMode?: IntrinsicDamagePerStatusMode;
    /** True when the source catalog identifies this damage instance as area damage. */
    isAreaDamage?: boolean;
    /** Per-attack trigger, when a weapon has distinct fire-mode attacks. */
    trigger?: string;
    /** Burst timing metadata for this attack, where verified. */
    burstCount?: number;
    burstDelay?: number;
    /** Base projectiles/hits per trigger for this attack, when it differs from the weapon default. */
    multishot?: number;
    /** Ammo consumed by one trigger/attack event when it differs by firing mode. */
    ammoCostPerShot?: number;
    /** Verified fixed ammo consumption rate for an ammo-charged attack. */
    chargeAmmoPerSecond?: number;
    /** Ammo cost represented by the attack row's unscaled base damage. */
    chargeDamageBaseAmmoCost?: number;
    /** Verified time-based damage behavior for this named attack. */
    damageRamp?: WeaponDamageRampRule;
    /** Forced status effects per projectile/hit, independent of status chance and damage weights. */
    forcedProcs?: WeaponForcedProcs;
    /** Guaranteed non-damage status types that count as unique Galvanized/CO states. */
    uniqueStatusProcs?: readonly WeaponUniqueStatusType[];
    /** Expected status counts from forced rolls with a weighted or uniform outcome. */
    forcedProcDistributions?: readonly WeaponForcedProcDistribution[];
    critChance: number;    // 0–1
    critMultiplier: number;
    statusChance: number;  // 0–1
    chargeTime?: number;
    damage: WeaponDamage;
    damageTotal: number;
}

export interface WeaponEntry {
    uniqueName: string;
    name: string;
    category: WeaponCategory;
    /** Internal weapon type as reported by WFCD (e.g. "Rifle", "Shotgun", "Bow", "Sword", "Melee") */
    weaponType: string;
    /** Which mod compat group accepts mods for this weapon */
    modCompat: ModCompatName;
    damage: WeaponDamage;
    critChance: number;
    critMultiplier: number;
    statusChance: number;
    fireRate: number;
    magazineSize: number;
    ammoCostPerShot: number;
    hasExplicitMagazineSize: boolean;
    reloadTime: number;
    multishot: number;
    trigger: string;
    chargeTime: number | null;
    /** Burst metadata for weapons whose source catalogs expose shot count and effective base rate. */
    burstCount?: number;
    burstCycleRate?: number;
    burstDelay?: number;
    polarities: string[];
    canOverLevel: boolean;
    baseSlotCount: number;
    /**
     * Legacy upstream Riven factor (`omegaAttenuation`). Since Hotfix 44.1.3
     * the current roll formula uses one shared 1.20 factor; retain this field
     * only for catalog compatibility and Riven eligibility metadata.
     */
    disposition: number;
    /** All named attacks from the WFCD data */
    attacks: WeaponAttack[];
    /** Forced status effects shared by all attacks unless an attack overrides them. */
    forcedProcs?: WeaponForcedProcs;
    /** Unique non-damage statuses from the default/selected attack. */
    uniqueStatusProcs?: readonly WeaponUniqueStatusType[];
    /** Forced status outcome distributions shared by all attacks unless an attack overrides them. */
    forcedProcDistributions?: readonly WeaponForcedProcDistribution[];
    /** Intrinsic direct-hit bonus per unique status on the selected attack. */
    intrinsicDamagePerStatusBonus?: number;
    /** Stacking order for the selected attack's intrinsic per-status damage bonus. */
    intrinsicDamagePerStatusMode?: IntrinsicDamagePerStatusMode;
    /** True when this entry comes from WFCD's exalted weapon data. */
    isExalted?: boolean;
    /** Optional melee stance polarity. */
    stancePolarity?: string;
    /** Optional melee stance family, e.g. "Swords" or "Tonfas". */
    stanceClass?: string;
    /** All supported melee stance families for the weapon. */
    stanceClasses?: string[];
    /** Hidden compatibility tags inferred from the source data. */
    tags: string[];
    /** True for progenitor weapons that can carry a Valence Bonus (Kuva/Tenet/Coda). */
    isProgenitorWeapon?: boolean;
    /** True for Perigale variants with the Gale Force ammo-efficiency passive. */
    hasGaleForceAmmoPassive?: boolean;
    /** Selected attack context carried into calculator/optimizer scoring. */
    selectedAttackName?: string;
    /** True when the selected attack is part of the weapon's Incarnon form. */
    selectedAttackIsIncarnon?: boolean;
    /** True when the selected attack's source row is explicitly marked as area damage. */
    selectedAttackIsAreaDamage?: boolean;
    /** True when the selected melee attack is excluded from Condition Overload's bonus. */
    selectedAttackIgnoresConditionOverload?: boolean;
    /** True when the selected attack's damage is multiplied by the active melee combo tier. */
    selectedAttackUsesMeleeComboMultiplier?: boolean;
    /** Selected attack's fixed ammo charge rate, where verified. */
    selectedAttackChargeAmmoPerSecond?: number;
    /** Ammo cost represented by the selected attack row's base damage. */
    selectedAttackChargeDamageBaseAmmoCost?: number;
    /** Time-based damage behavior carried from the selected attack row. */
    selectedAttackDamageRamp?: WeaponDamageRampRule;
}

export type WeaponForcedProcType = Exclude<keyof WeaponDamage, "total" | "true">;
export type WeaponForcedProcs = Partial<Record<WeaponForcedProcType, number>>;
export type WeaponUniqueStatusType = "microwave";
export interface WeaponForcedProcDistribution {
    /** Guaranteed rolls per hit/projectile before multishot. */
    count: number;
    /** Damage-weighted uses normal proc weights; uniform divides equally across `types`. */
    mode: "damageWeighted" | "uniform";
    types?: readonly WeaponForcedProcType[];
}

export function isGroundMeleeCategory(category: WeaponCategory): boolean {
    return category === "Melee";
}

export {
    clampMeleeComboMultiplier,
    getInitialMeleeComboMultiplier,
    getMeleeComboRules,
    selectedAttackUsesIncarnonForm,
    usesMeleeDamageModel,
    withSelectedAttack,
    type MeleeComboRules,
} from "./weaponRules";

export function supportsStanceMods(category: WeaponCategory): boolean {
    return category === "Melee";
}

export function supportsStanceLikeMods(weapon: Pick<WeaponEntry, "category" | "tags"> | null | undefined): boolean {
    if (!weapon) return false;
    return weapon.category === "Melee" || (weapon.category === "Companion" && weapon.tags.includes("BEAST_WEAPON"));
}

/** Kuva/Tenet/Coda weapons can rank to 40 */
function isOverLevelWeapon(name: string, uniqueName: string): boolean {
    const n = name.toLowerCase();
    const u = uniqueName.toLowerCase();
    return n.startsWith("kuva ") || n.startsWith("tenet ") || n.startsWith("coda ") || n.startsWith("dual coda ") ||
           u.includes("/kuva/") || u.includes("/tenet/") || u.includes("/infestedlich/") || u.includes("parvos");
}

function isProgenitorWeapon(name: string, uniqueName: string): boolean {
    const n = name.toLowerCase();
    const u = uniqueName.toLowerCase();
    return n.startsWith("kuva ") || n.startsWith("tenet ") || n.startsWith("coda ") || n.startsWith("dual coda ") ||
        u.includes("/kuva/") || u.includes("/tenet/") || u.includes("/infestedlich/");
}

/**
 * Extract the canonical charge time for a Charge trigger weapon.
 * Prefers the "best" charged attack (lowest charge time with actual damage),
 * which represents the most efficient DPS shot (e.g. Nataruk Perfect Shot at 0.7s).
 * Falls back to any attack with a charge_time, then to null.
 */
function resolveChargeTime(trigger: string, attacks: unknown[]): number | null {
    if (trigger !== "Charge") return null;
    if (!Array.isArray(attacks) || attacks.length === 0) return null;

    // Collect all attacks that have a numeric charge_time
    const withCT = attacks
        .filter((attack): attack is { charge_time: number } => {
            if (typeof attack !== "object" || attack === null) return false;
            return typeof (attack as Record<string, unknown>).charge_time === "number";
        })
        .map((attack) => attack.charge_time);

    if (withCT.length === 0) return null;

    // Use the minimum charge time — this represents the fastest viable charged shot
    // (e.g. Nataruk's Perfect Shot at 0.7s vs Charged Shot at 1.0s)
    return Math.min(...withCT);
}

interface BurstRuleOverride {
    count: number;
    delay: number;
}

/**
 * Current Wiki-confirmed exceptions for attacks absent or stale in source snapshots.
 * Checked 2026-11-10 against the weapon pages and https://wiki.warframe.com/w/Fire_Rate.
 * WFCD effective-rate snapshots disagree for Perigale Prime, Harpak, and Paracyst;
 * the current Wiki burst count/delay/cycle values are used for those attacks.
 */
const BURST_RULE_OVERRIDES: Readonly<Record<string, BurstRuleOverride>> = Object.freeze({
    "/Lotus/Weapons/Tenno/LongGuns/PrimePerigale/PrimePerigaleSniper|normal attack": { count: 4, delay: 0.04 },
    "/Lotus/Weapons/Grineer/LongGuns/GrnHarpoonGun/GrnHarpoonGun|normal attack": { count: 3, delay: 0.1 },
    "/Lotus/Weapons/Grineer/LongGuns/GrnFourBarrelRifle/GrnFourBarrelRifleWeapon|burst-fire": { count: 4, delay: 0 },
    "/Lotus/Weapons/Grineer/KuvaLich/LongGuns/Quartakk/KuvaQuartakk|burst-fire while aiming": { count: 4, delay: 0 },
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|normal attack": { count: 3, delay: 0.05 },
    "/Lotus/Weapons/Thanotech/ThanoPistol/ThanotechPistol|primary-fire": { count: 2, delay: 0 },
    "/Lotus/Weapons/Thanotech/ThanoPistol/ThanotechPistol|radial attack": { count: 2, delay: 0 },
});

const ATTACK_TRIGGER_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
    "/Lotus/Weapons/Grineer/LongGuns/GrnHarpoonGun/GrnHarpoonGun|harpoon": "Semi",
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon": "Charge",
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon contact": "Charge",
    // The Torid's Genesis Incarnon form is a held beam, although its base
    // grenade launcher is semi-auto. Cannonade requires every firing form to
    // be semi-auto, so the base trigger alone is insufficient here.
    "/Lotus/Weapons/ClanTech/Bio/BioWeapon|incarnon form": "Held",
    "/Lotus/Weapons/Thanotech/ThanoPistol/ThanotechPistol|lock-on mode": "Special",
    "/Lotus/Weapons/Thanotech/ThanoPistol/ThanotechPistol|lock-on radial attack": "Special",
});

const ATTACK_CHARGE_TIME_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon": 0.25,
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon contact": 0.25,
});

const VERIFIED_WEAPON_RELOAD_TIME_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({
    // WFCD reports 0.05s for Nataruk, but the current Wiki notes that its real
    // reload time is 0.6s. Bow cadence uses this value after each arrow.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Nataruk
    "/Lotus/Weapons/Tenno/Bows/Omicrus/OmicrusPlayerWep": 0.6,
});

const VERIFIED_ATTACK_AMMO_COST_OVERRIDES: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
    // Current Wiki weapon tables list 0.5 ammo per beam tick and 2 ammo for
    // each alternate-fire launch (the impact, explosion, and bomblet rows are
    // separate representations of that same launch in this catalog).
    // Verified 2026-11-11: https://wiki.warframe.com/w/Phantasma
    // https://wiki.warframe.com/w/Phantasma_Prime
    "/Lotus/Weapons/Tenno/LongGuns/RevenantShotgun/RevenantShotgun": Object.freeze({
        "beam": 0.5,
        "plasma bomb impact": 2,
        "plasma bomb explosion": 2,
        "cluster bombs impact": 2,
        "cluster bombs explosion": 2,
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimePhantasma/PhantasmaPrimeShotgun": Object.freeze({
        "beam": 0.5,
        "plasma bomb impact": 2,
        "plasma bomb explosion": 2,
        "cluster bombs impact": 2,
        "cluster bombs explosion": 2,
    }),
});

const PHANTASMA_BEAM_DAMAGE_RAMP: WeaponDamageRampRule = Object.freeze({
    minimumDamageMultiplier: 0.15,
    rampToFullSeconds: 0.6,
    idleBeforeDecaySeconds: 0.8,
    decayToMinimumSeconds: 2,
});

const VERIFIED_ATTACK_DAMAGE_RAMP_OVERRIDES: Readonly<Record<string, Readonly<Record<string, WeaponDamageRampRule>>>> = Object.freeze({
    // Both Beam rows share the Wiki-documented 15%→100% ramp and 0.8s/2s
    // idle decay. The alternate-fire damage rows do not use this rule.
    // Verified 2026-11-11: https://wiki.warframe.com/w/Phantasma
    // https://wiki.warframe.com/w/Phantasma_Prime
    "/Lotus/Weapons/Tenno/LongGuns/RevenantShotgun/RevenantShotgun": Object.freeze({
        "beam": PHANTASMA_BEAM_DAMAGE_RAMP,
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimePhantasma/PhantasmaPrimeShotgun": Object.freeze({
        "beam": PHANTASMA_BEAM_DAMAGE_RAMP,
    }),
});

const VERIFIED_ATTACK_AMMO_CHARGE_RULES: Readonly<Record<string, Readonly<Record<string, {
    ammoPerSecond: number;
    damageBaseAmmoCost: number;
}>>>> = Object.freeze({
    // These Wiki damage rows represent the ordinary two-ammo launch. Damage
    // scales with charged ammo up to the magazine at 11 ammo/sec; fire-rate
    // mods do not change the charge rate.
    // Verified 2026-11-11: https://wiki.warframe.com/w/Phantasma
    // https://wiki.warframe.com/w/Phantasma_Prime
    "/Lotus/Weapons/Tenno/LongGuns/RevenantShotgun/RevenantShotgun": Object.freeze({
        "plasma bomb impact": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
        "plasma bomb explosion": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
        "cluster bombs impact": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
        "cluster bombs explosion": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimePhantasma/PhantasmaPrimeShotgun": Object.freeze({
        "plasma bomb impact": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
        "plasma bomb explosion": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
        "cluster bombs impact": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
        "cluster bombs explosion": { ammoPerSecond: 11, damageBaseAmmoCost: 2 },
    }),
});

function resolveAttackTrigger(uniqueName: string, attackName: string, attackIndex: number, weaponTrigger: string): string {
    const normalizedName = attackName.trim().toLowerCase();
    const override = ATTACK_TRIGGER_OVERRIDES[`${uniqueName}|${normalizedName}`];
    if (override) return override;
    if (/full[- ]auto/i.test(attackName)) return "Auto";

    const modes = weaponTrigger.split(/[/|]/).map((mode) => mode.trim()).filter(Boolean);
    if (modes.length > 1) return modes[Math.min(attackIndex, modes.length - 1)];
    return weaponTrigger;
}

function resolveBurstBehavior(uniqueName: string): { count: number; delay?: number } | undefined {
    const item = OVERFRAME_ITEMS[uniqueName];
    const data = item?.data as Record<string, unknown> | undefined;
    const behaviors = Array.isArray(data?.Behaviors) ? data.Behaviors as Record<string, unknown>[] : [];
    const burstBehavior = behaviors.find((behavior) =>
        String(behavior["state:Type"] ?? "").endsWith("WeaponBurstStateBehavior"),
    );
    const state = burstBehavior?.["state:WeaponBurstStateBehavior"] as Record<string, unknown> | undefined;
    const count = Number(state?.NumShots ?? state?.BurstCount);
    const delay = Number(state?.BurstDelay);
    if (!Number.isInteger(count) || count <= 1) return undefined;
    return {
        count,
        ...(Number.isFinite(delay) && delay >= 0 ? { delay } : {}),
    };
}

function deriveBurstDelay(burstCount: number | undefined, effectiveFireRate: number, burstCycleRate: number): number | undefined {
    if (!burstCount || burstCount <= 1 || effectiveFireRate <= 0 || burstCycleRate <= 0) return undefined;
    const delay = (burstCount / effectiveFireRate - 1 / burstCycleRate) / (burstCount - 1);
    // Catalog fire rates are rounded to two or more decimals. A tiny negative
    // residual is consistent with a simultaneous burst whose true delay is zero.
    return delay >= -0.001 ? Math.max(0, delay) : undefined;
}

function resolveAttackBurstRule(
    uniqueName: string,
    attackName: string,
    attackTrigger: string,
    effectiveFireRate: number,
    cycleRate: number,
): BurstRuleOverride | undefined {
    const normalizedAttackName = attackName.trim().toLowerCase();
    const override = BURST_RULE_OVERRIDES[`${uniqueName}|${normalizedAttackName}`];
    if (override) return override;
    if (/^lock-on\b/i.test(attackName)) return undefined;

    const isBurstAttack = attackTrigger.toLowerCase() === "burst" || /\bburst\b/i.test(attackName);
    if (!isBurstAttack) return undefined;

    const behavior = resolveBurstBehavior(uniqueName);
    const count = behavior?.count;
    const delay = deriveBurstDelay(count, effectiveFireRate, cycleRate);
    return count !== undefined && delay !== undefined ? { count, delay } : undefined;
}

function inferCompanionWeaponFamily(item: Record<string, unknown>): { weaponType: string; modCompat: ModCompatName } {
    const name = String(item.name ?? "").toLowerCase();
    const uniqueName = String(item.uniqueName ?? "").toLowerCase();
    const description = String(item.description ?? "").toLowerCase();

    if (
        uniqueName.includes("meleeweapon") ||
        description.includes("melee attack") ||
        description.includes("melee attacks")
    ) {
        return { weaponType: "Melee", modCompat: "Melee" };
    }
    if (uniqueName.includes("glaive") || description.includes("glaive")) {
        return { weaponType: "Melee", modCompat: "Melee" };
    }
    if (uniqueName.includes("shotgun") || description.includes("shotgun")) {
        return { weaponType: "Shotgun", modCompat: "Shotgun" };
    }
    if (uniqueName.includes("railgun") || description.includes("sniper")) {
        return { weaponType: "Sniper", modCompat: "Sniper" };
    }
    if (
        uniqueName.includes("pistol") ||
        description.includes("pistol") ||
        name.includes("burst laser")
    ) {
        return { weaponType: "Pistol", modCompat: "Pistol" };
    }
    if (description.includes("bow")) {
        return { weaponType: "Bow", modCompat: "Bow" };
    }
    return { weaponType: "Rifle", modCompat: "Rifle" };
}

function resolveCategory(item: Record<string, unknown>, exaltedCategory?: WeaponCategory | null): WeaponCategory | null {
    if (exaltedCategory) return exaltedCategory;
    const rawCategory = String(item.category ?? "");
    const rawType = String(item.type ?? "");
    const productCategory = String(item.productCategory ?? "");
    const uniqueName = String(item.uniqueName ?? "").toLowerCase();

    if (rawType === "Companion Weapon" || productCategory === "SentinelWeapons" || uniqueName.includes("/sentinelweapons/")) {
        return "Companion";
    }
    if (
        rawCategory === "Primary" ||
        rawCategory === "Secondary" ||
        rawCategory === "Melee" ||
        rawCategory === "Arch-Gun" ||
        rawCategory === "Arch-Melee"
    ) {
        return rawCategory as WeaponCategory;
    }
    return null;
}

function resolveWeaponFamily(category: WeaponCategory, item: Record<string, unknown>): { weaponType: string; modCompat: ModCompatName } {
    if (category === "Companion") return inferCompanionWeaponFamily(item);
    const weaponType = String(item.type ?? "");
    if (category === "Arch-Gun") return { weaponType: weaponType || "Arch-Gun", modCompat: "Archgun" };
    if (category === "Arch-Melee") return { weaponType: weaponType || "Arch-Melee", modCompat: "Archmelee" };
    if (category === "Secondary") return { weaponType: weaponType || "Pistol", modCompat: "Pistol" };
    if (category === "Melee") return { weaponType: weaponType || "Melee", modCompat: "Melee" };
    if (category === "Primary" && PRIMARY_SNIPER_MOD_COMPAT_OVERRIDES.has(String(item.uniqueName ?? ""))) {
        return { weaponType: "Sniper", modCompat: "Sniper" };
    }
    const t = (weaponType ?? "").toLowerCase();
    if (t === "shotgun") return { weaponType: "Shotgun", modCompat: "Shotgun" };
    if (t === "bow") return { weaponType: "Bow", modCompat: "Bow" };
    if (t === "sniper") return { weaponType: "Sniper", modCompat: "Sniper" };
    return { weaponType: weaponType || "Rifle", modCompat: "Rifle" };
}

function classifyExaltedWeapon(item: Record<string, unknown>): {
    category: WeaponCategory;
    weaponType: string;
    modCompat: ModCompatName;
} | null {
    const name = String(item.name ?? "");
    const lower = name.toLowerCase();

    const explicit: Record<string, { category: WeaponCategory; weaponType: string; modCompat: ModCompatName }> = {
        "artemis bow":           { category: "Primary",   weaponType: "Bow",      modCompat: "Bow" },
        "artemis bow prime":     { category: "Primary",   weaponType: "Bow",      modCompat: "Bow" },
        "neutralizer":           { category: "Primary",   weaponType: "Sniper",   modCompat: "Sniper" },
        "balefire charger":      { category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "balefire charger prime":{ category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "noctua":                { category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "dex pixia":             { category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "dex pixia prime":       { category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "regulators":            { category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "regulators prime":      { category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "glory":                 { category: "Secondary", weaponType: "Pistol",   modCompat: "Pistol" },
        "arquebex":              { category: "Arch-Gun",  weaponType: "Arch-Gun",  modCompat: "Archgun" },
        "ironbride":             { category: "Arch-Melee", weaponType: "Arch-Melee", modCompat: "Archmelee" },
        "exalted blade":         { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "exalted prime blade":   { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "exalted umbra blade":   { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "desert wind":           { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "desert wind prime":     { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "diwata":                { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "diwata prime":          { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "iron staff":            { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "iron staff prime":      { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "garuda talons":         { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "garuda prime talons":   { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "landslide fists":       { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "landslide fists prime": { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "shadow claws":          { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "shadow claws prime":    { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "shadow clones":         { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "shadow clones prime":   { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "shattered lash":        { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "shattered lash prime":  { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "valkyr talons":         { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "valkyr prime talons":   { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "whipclaw":              { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
        "whipclaw prime":        { category: "Melee",     weaponType: "Melee",    modCompat: "Melee" },
    };
    if (explicit[lower]) return explicit[lower];

    if ("stancePolarity" in item || "slamAttack" in item || "heavyAttackDamage" in item) {
        return { category: "Melee", weaponType: "Melee", modCompat: "Melee" };
    }

    const description = String(item.description ?? "").toLowerCase();
    if (description.includes("bow")) {
        return { category: "Primary", weaponType: "Bow", modCompat: "Bow" };
    }
    if (description.includes("sniper")) {
        return { category: "Primary", weaponType: "Sniper", modCompat: "Sniper" };
    }
    if (description.includes("pistol") || description.includes("tome")) {
        return { category: "Secondary", weaponType: "Pistol", modCompat: "Pistol" };
    }
    if (description.includes("blade") || description.includes("sword") || description.includes("melee")) {
        return { category: "Melee", weaponType: "Melee", modCompat: "Melee" };
    }
    return null;
}

function inferWeaponTags(item: Record<string, unknown>, isExalted: boolean): string[] {
    const tags = new Set<string>();
    const name = String(item.name ?? "").toLowerCase();
    const uniqueName = String(item.uniqueName ?? "").toLowerCase();
    const trigger = String(item.trigger ?? "").toLowerCase();
    const description = String(item.description ?? "").toLowerCase();
    const type = String(item.type ?? "").toLowerCase();
    const itemsRaw = ITEMS_CATALOG.byKey[String(item.uniqueName ?? "")]?.raw as
        | {
            data?: {
                CompatibilityTags?: unknown[];
                WeaponTypes?: Array<{ CompatibilityTags?: unknown[] }>;
            };
        }
        | undefined;

    if (isExalted) tags.add("POWER_WEAPON");
    for (const tag of itemsRaw?.data?.CompatibilityTags ?? []) {
        const normalized = String(tag ?? "").trim();
        if (normalized) tags.add(normalized);
    }
    for (const variant of itemsRaw?.data?.WeaponTypes ?? []) {
        for (const tag of variant?.CompatibilityTags ?? []) {
            const normalized = String(tag ?? "").trim();
            if (normalized) tags.add(normalized);
        }
    }
    if (trigger.includes("semi")) tags.add("SEMI_AUTO");
    if (description.includes("beam") || description.includes("continuous")) tags.add("BEAM");
    if (description.includes("projectile") || type.includes("bow") || uniqueName.includes("/bows/")) tags.add("PROJECTILE");
    if (name === "nataruk" || uniqueName.includes("omicrus")) tags.add("OMICRUS");
    if (uniqueName.includes("crossbow") || name.includes("attica") || name.includes("zhuge")) tags.add("CROSSBOW");
    if (name.includes("attica")) tags.add("ATTICA");
    if (name.includes("zhuge")) tags.add("ZHUGE");
    if (name.includes("daikyu")) tags.add("DAIKYU");
    if (uniqueName.includes("grnbow") || name.includes("bramma")) tags.add("GRNBOW");
    if (uniqueName.includes("crpbow")) tags.add("CRPBOW");
    if (name.includes("proboscis cernos")) tags.add("INFBOW");
    if (name.includes("mutalist cernos")) tags.add("INFCERNOS");

    return [...tags];
}

const STANCE_TAG_MAP: Record<string, string> = {
    ASSAULT_SAW_STANCE: "Assault Saw",
    BLADESAW_STANCE: "Assault Saw",
    BLADE_AND_WHIP_STANCE: "Blade And Whip",
    CLAWS_STANCE: "Claws",
    CLAWS_STANCE_STANCE: "Claws",
    DAGGERS_STANCE: "Daggers",
    DUAL_DAGGERS_STANCE: "Dual Daggers",
    DUAL_KATANAS_STANCE: "Dual Nikanas",
    DUAL_NIKANAS_STANCE: "Dual Nikanas",
    DUAL_SWORDS_STANCE: "Dual Swords",
    FIST_STANCE: "Fists",
    FISTS_STANCE: "Fists",
    GLAIVES_STANCE: "Glaives",
    GUNBLADE_STANCE: "Gunblade",
    HAMMERS_STANCE: "Hammers",
    "HEAVY SCYTHE_STANCE": "Heavy Scythe",
    HEAVY_BLADE_STANCE: "Heavy Blade",
    LONG_KATANA_STANCE: "Two-Handed Nikana",
    MACHETES_STANCE: "Machetes",
    NIKANAS_STANCE: "Nikanas",
    NUNCHAKU_STANCE: "Nunchaku",
    POLEARMS_STANCE: "Polearms",
    RAPIER_STANCE: "Rapiers",
    RAPIERS_STANCE: "Rapiers",
    SCYTHES_STANCE: "Scythes",
    SPARRING_STANCE: "Sparring",
    STAVES_STANCE: "Staves",
    STAFF_STANCE: "Staves",
    SWORDS_STANCE: "Swords",
    SWORDS_AND_SHIELD_STANCE: "Sword And Shield",
    SWORD_AND_SHIELD_STANCE: "Sword And Shield",
    TONFA_STANCE: "Tonfas",
    TONFAS_STANCE: "Tonfas",
    TWO_HANDED_NIKANA_STANCE: "Two-Handed Nikana",
    WARFAN_STANCE: "Warfans",
    WARFANS_STANCE: "Warfans",
    WHIPS_STANCE: "Whips",
};

function inferStanceClassesFromItems(uniqueName: string): string[] {
    const raw = ITEMS_CATALOG.byKey[uniqueName]?.raw as
        | {
            data?: {
                CompatibilityTags?: string[];
                WeaponTypes?: Array<{ CompatibilityTags?: string[] }>;
            };
        }
        | undefined;
    if (!raw?.data) return [];

    const tags = new Set<string>();
    for (const tag of raw.data.CompatibilityTags ?? []) tags.add(String(tag));
    for (const variant of raw.data.WeaponTypes ?? []) {
        for (const tag of variant?.CompatibilityTags ?? []) tags.add(String(tag));
    }

    const classes = new Set<string>();
    for (const tag of tags) {
        const mapped = STANCE_TAG_MAP[tag];
        if (mapped) classes.add(mapped);
    }
    return [...classes];
}

function mapArtifactSlotToPolarity(slot: unknown): string {
    switch (String(slot ?? "").trim()) {
        case "AP_ATTACK":
            return "madurai";
        case "AP_DEFENSE":
            return "vazarin";
        case "AP_TACTIC":
            return "naramon";
        case "AP_POWER":
            return "zenurik";
        case "AP_PRECEPT":
        case "AP_PENJAGA":
            return "penjaga";
        default:
            return "";
    }
}

function inferMainPolaritiesFromItems(uniqueName: string): string[] {
    const raw = ITEMS_CATALOG.byKey[uniqueName]?.raw as
        | {
            data?: {
                ArtifactSlots?: unknown[];
            };
        }
        | undefined;
    const artifactSlots = Array.isArray(raw?.data?.ArtifactSlots) ? raw.data.ArtifactSlots : [];
    if (artifactSlots.length === 0) return [];

    return artifactSlots
        .slice(0, 8)
        .map(mapArtifactSlotToPolarity)
        .filter((polarity): polarity is string => polarity.length > 0);
}

function inferArtifactSlotPolarity(uniqueName: string, index: number): string {
    const raw = ITEMS_CATALOG.byKey[uniqueName]?.raw as
        | {
            data?: {
                ArtifactSlots?: unknown[];
            };
        }
        | undefined;
    const artifactSlots = Array.isArray(raw?.data?.ArtifactSlots) ? raw.data.ArtifactSlots : [];
    return mapArtifactSlotToPolarity(artifactSlots[index]);
}

function inferStanceClassFallback(item: Record<string, unknown>, isExalted: boolean): string | undefined {
    if (isExalted || typeof item.stancePolarity !== "string") return undefined;
    const uniqueName = String(item.uniqueName ?? "").toLowerCase();
    const name = String(item.name ?? "").toLowerCase();
    const description = String(item.description ?? "").toLowerCase();

    if (
        uniqueName.includes("greatsword") ||
        uniqueName.includes("stalkertwo") ||
        description.includes("heavy blade") ||
        description.includes("great sword")
    ) {
        return "Heavy Blade";
    }

    const directMap: Array<[string, string]> = [
        ["/longsword/", "Swords"],
        ["/greatsword/", "Heavy Blade"],
        ["/glaives/", "Glaives"],
        ["/tonfa/", "Tonfas"],
        ["/staff/", "Staves"],
        ["/scythe/", "Scythes"],
        ["/fist/", "Fists"],
        ["/swordsandboards/", "Sword And Shield"],
        ["/hammer/", "Hammers"],
        ["/machete/", "Machetes"],
        ["/whip/", "Whips"],
        ["rapier", "Rapiers"],
        ["/polearm/", "Polearms"],
        ["/polearms/", "Polearms"],
        ["/saw/", "Assault Saw"],
        ["/gunblade/", "Gunblade"],
        ["/nunchaku/", "Nunchaku"],
        ["/nikana/", "Nikanas"],
        ["/dualnikana/", "Dual Nikanas"],
        ["/warfan/", "Warfans"],
        ["/sparring/", "Sparring"],
        ["/dagger/", "Daggers"],
        ["/claws/", "Claws"],
    ];
    for (const [needle, stance] of directMap) {
        if (uniqueName.includes(needle)) return stance;
    }

    if (uniqueName.includes("/swords/")) {
        if (name.includes("&") || description.includes("two separate weapons")) return "Dual Swords";
        if (description.includes("sai blades") || name.includes("okina")) return "Dual Daggers";
        if (description.includes("great katana") || name.includes("pennant")) return "Two-Handed Nikana";
        if (description.includes("rapier")) return "Rapiers";
        return "Swords";
    }

    if (description.includes("shield")) return "Sword And Shield";
    if (description.includes("dagger")) return name.startsWith("dual ") || name.includes("okina") ? "Dual Daggers" : "Daggers";
    if (description.includes("dual")) return "Dual Swords";
    return undefined;
}

function inferStanceClasses(item: Record<string, unknown>, isExalted: boolean): string[] {
    if (isExalted) return [];
    const uniqueName = String(item.uniqueName ?? "");
    const raw = ITEMS_CATALOG.byKey[uniqueName]?.raw as { data?: { CompatibilityTags?: unknown[] } } | undefined;
    const compatibilityTags = raw?.data?.CompatibilityTags?.map((tag) => String(tag ?? "")) ?? [];
    if (uniqueName.includes("/BeastWeapons/") || compatibilityTags.includes("BEAST_WEAPON")) {
        return ["Claws"];
    }
    const fromItems = inferStanceClassesFromItems(uniqueName);
    if (fromItems.length > 0) return fromItems;
    if (typeof item.stancePolarity !== "string") return [];
    const fallback = inferStanceClassFallback(item, isExalted);
    return fallback ? [fallback] : [];
}

let _cache: WeaponEntry[] | null = null;

function n(v: unknown): number {
    const x = Number(v);
    return isFinite(x) ? x : 0;
}

const FORCED_PROC_TYPES: WeaponForcedProcType[] = [
    "impact", "puncture", "slash", "heat", "cold", "electricity", "toxin", "blast",
    "radiation", "gas", "magnetic", "viral", "corrosive", "void", "tau",
];

/** Wiki-verified weapon statuses that count for Galvanized/Condition Overload bonuses. */
const VERIFIED_ATTACK_UNIQUE_STATUS_OVERRIDES: Readonly<Record<
    string,
    Readonly<Record<string, readonly WeaponUniqueStatusType[]>>
>> = Object.freeze({
    // Both beams apply the infinite-duration Microwave status on touched enemies.
    // It is a unique CO/Galvanized state, not a damage-type proc.
    // Verified 2026-11-12:
    // https://wiki.warframe.com/w/Nukor
    // https://wiki.warframe.com/w/Kuva_Nukor
    // https://wiki.warframe.com/w/Galvanized_Shot
    "/Lotus/Weapons/Grineer/Pistols/GrineerMicrowavegun/GrnMicrowavePistol": Object.freeze({
        "normal attack": Object.freeze(["microwave"] as const),
    }),
    "/Lotus/Weapons/Grineer/KuvaLich/Secondaries/Nukor/KuvaNukor": Object.freeze({
        "normal attack": Object.freeze(["microwave"] as const),
    }),
});

/** Current Wiki-verified intrinsic direct-damage bonuses scoped to weapon attacks. */
const VERIFIED_ATTACK_DAMAGE_PER_STATUS_OVERRIDES: Readonly<Record<
    string,
    Readonly<Record<string, { bonus: number; mode: IntrinsicDamagePerStatusMode }>>
>> = Object.freeze({
    // Cedo and Cedo Prime add 60% per unique status on primary fire. Their direct
    // glaive hit multiplies ordinary base-damage bonuses, while the radial attack
    // does not receive the passive.
    // Verified 2026-11-11: https://wiki.warframe.com/w/Cedo
    // https://wiki.warframe.com/w/Cedo_Prime
    "/Lotus/Weapons/Tenno/LongGuns/TnAlchemistShotgun/TnAlchemistShotgun": Object.freeze({
        "normal attack": Object.freeze({ bonus: 0.6, mode: "additiveBase" }),
        "alt-fire glaive": Object.freeze({ bonus: 0.6, mode: "multiplicativeBase" }),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeCedo/PrimeCedoWeapon": Object.freeze({
        "normal attack": Object.freeze({ bonus: 0.6, mode: "additiveBase" }),
        "alt-fire glaive": Object.freeze({ bonus: 0.6, mode: "multiplicativeBase" }),
    }),
});

/** Current Wiki-verified weapon attack proc rules absent from the WFCD export. */
const VERIFIED_ATTACK_FORCED_PROC_OVERRIDES: Readonly<Record<
    string,
    Readonly<Record<string, WeaponForcedProcs>>
>> = Object.freeze({
    // Acrid always applies a Toxin proc on a direct needle hit. The four
    // Hystrix quill rows force their selected element without adding that
    // element to the weapon's damage composition.
    // Verified 2026-11-12:
    // https://wiki.warframe.com/w/Acrid
    // https://wiki.warframe.com/w/Hystrix
    // https://wiki.warframe.com/w/Hystrix_Prime
    "/Lotus/Weapons/ClanTech/Bio/AcidDartPistol": Object.freeze({
        "normal attack": Object.freeze({ toxin: 1 }),
    }),
    "/Lotus/Weapons/Tenno/Pistols/QuillDartgun/QuillDartGunWeapon": Object.freeze({
        "poison quill": Object.freeze({ toxin: 1 }),
        "fire quill": Object.freeze({ heat: 1 }),
        "electric quill": Object.freeze({ electricity: 1 }),
        "ice quill": Object.freeze({ cold: 1 }),
    }),
    "/Lotus/Weapons/Tenno/Pistols/PrimeHystrix/PrimeHystrixWeapon": Object.freeze({
        "poison quill": Object.freeze({ toxin: 1 }),
        "fire quill": Object.freeze({ heat: 1 }),
        "electric quill": Object.freeze({ electricity: 1 }),
        "ice quill": Object.freeze({ cold: 1 }),
    }),
    // Glaive Prime applies forced Impact + Slash on throws and recall explosions;
    // its bounce explosions do not receive this override.
    // Verified 2026-11-11: https://wiki.warframe.com/w/Glaive_Prime
    "/Lotus/Weapons/Tenno/Melee/Glaives/PrimeGlaive/PrimeGlaiveWeapon": Object.freeze({
        "throw": Object.freeze({ impact: 1, slash: 1 }),
        "charged throw": Object.freeze({ impact: 1, slash: 1 }),
        "throw recall explosion": Object.freeze({ impact: 1, slash: 1 }),
        "charged throw recall explosion": Object.freeze({ impact: 1, slash: 1 }),
    }),
    // Both Pathocyst variants force Impact + Viral only on recall explosions;
    // their bounce explosions remain ordinary status rolls.
    // Verified 2026-11-11:
    // https://wiki.warframe.com/w/Pathocyst
    // https://wiki.warframe.com/w/Coda_Pathocyst
    "/Lotus/Weapons/Infested/Melee/InfBoomerang/InfBoomerangWeapon": Object.freeze({
        "throw recall explosion": Object.freeze({ impact: 1, viral: 1 }),
        "charged throw recall explosion": Object.freeze({ impact: 1, viral: 1 }),
    }),
    "/Lotus/Weapons/Infested/InfestedLich/Melee/CodaPathocyst/CodaPathocyst": Object.freeze({
        "throw recall explosion": Object.freeze({ impact: 1, viral: 1 }),
        "charged throw recall explosion": Object.freeze({ impact: 1, viral: 1 }),
    }),
    // Phantasma's plasma-bomb impact and explosion, plus seeking-bomblet
    // explosions, each apply one forced Impact proc. The beam has no forced
    // status proc; bomblet impact forces Stagger, which is not a damage status.
    // Verified 2026-11-11:
    // https://wiki.warframe.com/w/Phantasma
    // https://wiki.warframe.com/w/Phantasma_Prime
    "/Lotus/Weapons/Tenno/LongGuns/RevenantShotgun/RevenantShotgun": Object.freeze({
        "plasma bomb impact": Object.freeze({ impact: 1 }),
        "plasma bomb explosion": Object.freeze({ impact: 1 }),
        "cluster bombs explosion": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimePhantasma/PhantasmaPrimeShotgun": Object.freeze({
        "plasma bomb impact": Object.freeze({ impact: 1 }),
        "plasma bomb explosion": Object.freeze({ impact: 1 }),
        "cluster bombs explosion": Object.freeze({ impact: 1 }),
    }),
    // Nataruk's Quick Shot forces Impact; Charged and Perfect shots use ordinary
    // status rolls. Verified 2026-11-12: https://wiki.warframe.com/w/Nataruk
    "/Lotus/Weapons/Tenno/Bows/Omicrus/OmicrusPlayerWep": Object.freeze({
        "quick shot": Object.freeze({ impact: 1 }),
    }),
    // Daikyu and Daikyu Prime charge attacks force Impact. The Prime's Quick
    // Shot also carries it; no forced proc is inferred for any other mode.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Daikyu
    // https://wiki.warframe.com/w/Daikyu_Prime
    "/Lotus/Weapons/Tenno/Bows/AsymetricalBow/AsymetricalBow": Object.freeze({
        "charged shot": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Tenno/Bows/PrimeDaikyu/PrimeDaikyuBow": Object.freeze({
        "quick shot": Object.freeze({ impact: 1 }),
        "charged shot": Object.freeze({ impact: 1 }),
    }),
    // Acceltra direct rocket impacts force Impact; the separate AoE explosion
    // does not. Verified 2026-11-12:
    // https://wiki.warframe.com/w/Acceltra
    // https://wiki.warframe.com/w/Acceltra_Prime
    "/Lotus/Weapons/Tenno/LongGuns/SapientPrimary/SapientPrimaryWeapon": Object.freeze({
        "rocket impact": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeAcceltra/PrimeAcceltraWeapon": Object.freeze({
        "rocket impact": Object.freeze({ impact: 1 }),
    }),
    // Astilla slugs force Impact on the direct hit; the glass explosion is a
    // separate status instance without a forced damage-status proc.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Astilla and
    // https://wiki.warframe.com/w/Astilla_Prime
    "/Lotus/Weapons/Tenno/LongGuns/TnGlassShotgun/TnGlassShotgunGun": Object.freeze({
        "slug impact": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeAstilla/AstillaPrimeWeapon": Object.freeze({
        "slug impact": Object.freeze({ impact: 1 }),
    }),
    // Kuva Chakkhurr's direct hit and explosion each force their own Impact
    // application; Kuva Ogris forces Impact on the direct rocket only.
    // Verified 2026-11-12:
    // https://wiki.warframe.com/w/Kuva_Chakkhurr
    // https://wiki.warframe.com/w/Kuva_Ogris
    "/Lotus/Weapons/Grineer/LongGuns/GrnKuvaLichRifle/GrnKuvaLichRifleWeapon": Object.freeze({
        "normal attack": Object.freeze({ impact: 1 }),
        "explosion": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Grineer/KuvaLich/LongGuns/Ogris/KuvaOgris": Object.freeze({
        "rocket impact": Object.freeze({ impact: 1 }),
    }),
    // Afentis Prime's primary hit forces Impact and its radial hit forces Heat;
    // its spear throw only forces Knockdown, which is not a damage status.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Afentis_Prime
    "/Lotus/Weapons/Tenno/LongGuns/PrimeAfentis/PrimeAfentisWeapon": Object.freeze({
        "semi": Object.freeze({ impact: 1 }),
        "radial attack": Object.freeze({ heat: 1 }),
    }),
    // Corinth's alternate-fire projectile directly forces Impact; the radial
    // explosion forces Knockdown only. Verified 2026-11-12:
    // https://wiki.warframe.com/w/Corinth
    // https://wiki.warframe.com/w/Corinth_Prime
    "/Lotus/Weapons/Tenno/LongGuns/TnHeavyShotgun/TnHeavyShotgunGun": Object.freeze({
        "air burst projectile": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeCorinth/PrimeCorinth": Object.freeze({
        "air burst projectile": Object.freeze({ impact: 1 }),
    }),
    // The Javlok's thrown spear direct impact and explosion both force Impact;
    // the primary projectile/explosion do not. Knockdown/Stagger are utility
    // effects and are intentionally excluded from the damage-proc model.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Javlok
    "/Lotus/Weapons/Grineer/LongGuns/GrnFlameSpear/GrnFlameSpear": Object.freeze({
        "spear throw impact": Object.freeze({ impact: 1 }),
        "spear throw explosion": Object.freeze({ impact: 1 }),
    }),
    // Epitaph variants force Impact on direct hits, while uncharged AoE forces
    // Cold. Prime charged shots additionally force Cold.
    // Verified 2026-11-12:
    // https://wiki.warframe.com/w/Epitaph
    // https://wiki.warframe.com/w/Epitaph_Prime
    "/Lotus/Weapons/Tenno/Pistols/TnWraitheSidearm/TnWraitheSidearmWeapon": Object.freeze({
        "charged shot": Object.freeze({ impact: 1 }),
        "uncharged direct hit": Object.freeze({ impact: 1 }),
        "uncharged aoe": Object.freeze({ cold: 1 }),
    }),
    "/Lotus/Weapons/Tenno/Pistols/PrimeEpitaph/PrimeEpitaphSidearmWeapon": Object.freeze({
        "charged shot": Object.freeze({ impact: 1, cold: 1 }),
        "uncharged direct hit": Object.freeze({ impact: 1 }),
        "uncharged aoe": Object.freeze({ cold: 1 }),
    }),
    // Both Lenz variants force Impact on the arrow and Cold on the initial
    // explosion; the delayed Blast collapse is a separate unforced instance.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Lenz and
    // https://wiki.warframe.com/w/Prisma_Lenz
    "/Lotus/Weapons/Corpus/Bow/Longbow/CrpBow": Object.freeze({
        "charged shot": Object.freeze({ impact: 1 }),
        "initial blast": Object.freeze({ cold: 1 }),
    }),
    "/Lotus/Weapons/Corpus/Bow/Longbow/PrismaLenz/PrismaLenzWeapon": Object.freeze({
        "charged shot": Object.freeze({ impact: 1 }),
        "initial blast": Object.freeze({ cold: 1 }),
    }),
    // Zakti variants force Impact on the dart only; their delayed Gas cloud
    // separately rolls ordinary status and its stagger is not a damage proc.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Zakti and
    // https://wiki.warframe.com/w/Zakti_Prime
    "/Lotus/Weapons/Tenno/Pistols/TnGuandoPistol/TnGuandoPistolGun": Object.freeze({
        "dart impact": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Tenno/Pistols/PrimeZakti/PrimeZaktiPistol": Object.freeze({
        "normal attack": Object.freeze({ impact: 1 }),
    }),
    // Tenet Spirex's direct slug hit forces Impact; its distinct explosion
    // does not. Verified 2026-11-12: https://wiki.warframe.com/w/Tenet_Spirex
    "/Lotus/Weapons/Corpus/Pistols/CrpIgniterPistol/CrpIgniterPistol": Object.freeze({
        "slug impact": Object.freeze({ impact: 1 }),
    }),
    // Nagantaka's semi-auto and magazine-burst bolts force Impact on both
    // variants. Verified 2026-11-12:
    // https://wiki.warframe.com/w/Nagantaka
    // https://wiki.warframe.com/w/Nagantaka_Prime
    "/Lotus/Weapons/Tenno/LongGuns/GarudaCrossbow/GarudaCrossbow": Object.freeze({
        "semi-auto": Object.freeze({ impact: 1 }),
        "burst shot": Object.freeze({ impact: 1 }),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeNagantaka/PrimeNagantakaWeapon": Object.freeze({
        "semi-auto": Object.freeze({ impact: 1 }),
        "burst shot": Object.freeze({ impact: 1 }),
    }),
    // Zymos' initial projectile forces Impact. Its distance-gated homing-spore
    // behavior (>7 m from the headshot target) is not represented as unconditional.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Zymos
    "/Lotus/Weapons/Infested/Pistols/InfUzi/InfUziWeapon": Object.freeze({
        "normal attack": Object.freeze({ impact: 1 }),
    }),
});

/** Current Wiki-verified forced-proc rolls whose outcome is randomly selected. */
const VERIFIED_ATTACK_FORCED_PROC_DISTRIBUTION_OVERRIDES: Readonly<Record<
    string,
    Readonly<Record<string, readonly WeaponForcedProcDistribution[]>>
>> = Object.freeze({
    // Each Cedo Alt-Fire Glaive explosion applies two guaranteed rolls:
    // one normal damage-weighted proc and one uniform Heat/Cold/Electricity/Toxin proc.
    // Direct hits have ordinary status chance only. Verified 2026-11-11:
    // https://wiki.warframe.com/w/Cedo
    "/Lotus/Weapons/Tenno/LongGuns/TnAlchemistShotgun/TnAlchemistShotgun": Object.freeze({
        "glaive radial attack": Object.freeze([
            Object.freeze({ count: 1, mode: "damageWeighted" } satisfies WeaponForcedProcDistribution),
            Object.freeze({
                count: 1,
                mode: "uniform",
                types: Object.freeze(["heat", "cold", "electricity", "toxin"]),
            } satisfies WeaponForcedProcDistribution),
        ]),
    }),
});

/** Current Wiki-verified base multishot for attack rows whose fire modes differ. */
const VERIFIED_ATTACK_MULTISHOT_OVERRIDES: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
    // Cedo's primary attack has six pellets, while each alternate-fire glaive
    // attack starts with one projectile; multishot mods can create extra glaives.
    // Verified 2026-11-11: https://wiki.warframe.com/w/Cedo
    "/Lotus/Weapons/Tenno/LongGuns/TnAlchemistShotgun/TnAlchemistShotgun": Object.freeze({
        "alt-fire glaive": 1,
        "glaive radial attack": 1,
    }),
    // The held Beam uses six innate beams; each charged alternate-fire damage
    // row has its own projectile count, including five seeking-bomblet impacts.
    // Verified 2026-11-11:
    // https://wiki.warframe.com/w/Phantasma
    // https://wiki.warframe.com/w/Phantasma_Prime
    "/Lotus/Weapons/Tenno/LongGuns/RevenantShotgun/RevenantShotgun": Object.freeze({
        "plasma bomb impact": 1,
        "plasma bomb explosion": 1,
        "cluster bombs impact": 5,
        "cluster bombs explosion": 1,
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimePhantasma/PhantasmaPrimeShotgun": Object.freeze({
        "plasma bomb impact": 1,
        "plasma bomb explosion": 1,
        "cluster bombs impact": 5,
        "cluster bombs explosion": 1,
    }),
    // Corinth buckshot uses six pellets, but each alternate-fire row is one
    // projectile. Without attack-scoped values the weapon-level pellet count
    // incorrectly multiplies Air Burst damage and forced Impact.
    // Verified 2026-11-12: https://wiki.warframe.com/w/Corinth and
    // https://wiki.warframe.com/w/Corinth_Prime
    "/Lotus/Weapons/Tenno/LongGuns/TnHeavyShotgun/TnHeavyShotgunGun": Object.freeze({
        "air burst projectile": 1,
        "air burst explosion": 1,
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeCorinth/PrimeCorinth": Object.freeze({
        "air burst projectile": 1,
        "air burst explosion": 1,
    }),
});

function parseForcedProcs(input: unknown): WeaponForcedProcs | undefined {
    if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
    const record = input as Record<string, unknown>;
    const forcedProcs: WeaponForcedProcs = {};
    for (const type of FORCED_PROC_TYPES) {
        const count = Math.max(0, n(record[type]));
        if (count > 0) forcedProcs[type] = count;
    }
    return Object.keys(forcedProcs).length > 0 ? forcedProcs : undefined;
}

function parseDamageRecord(input: unknown): WeaponDamage {
    const ad = (input as Record<string, number> | undefined) ?? {};
    const dmgKeys = ["impact","puncture","slash","heat","cold","electricity",
        "toxin","blast","radiation","gas","magnetic","viral","corrosive","void","tau","true"] as const;
    const out: WeaponDamage = {
        total: 0, impact: 0, puncture: 0, slash: 0, heat: 0, cold: 0,
        electricity: 0, toxin: 0, blast: 0, radiation: 0, gas: 0,
        magnetic: 0, viral: 0, corrosive: 0, void: 0, tau: 0, true: 0,
    };
    for (const k of dmgKeys) out[k] = n(ad[k]);
    out.total = dmgKeys.reduce((s, k) => s + out[k], 0) || n(ad.total);
    return out;
}

function mapOverframeDamageType(rawType: string): keyof WeaponDamage | null {
    switch (rawType) {
        case "DT_IMPACT": return "impact";
        case "DT_PUNCTURE": return "puncture";
        case "DT_SLASH": return "slash";
        case "DT_FIRE": return "heat";
        case "DT_FREEZE": return "cold";
        case "DT_ELECTRICITY": return "electricity";
        case "DT_POISON": return "toxin";
        case "DT_EXPLOSION": return "blast";
        case "DT_RADIATION": return "radiation";
        case "DT_GAS": return "gas";
        case "DT_MAGNETIC": return "magnetic";
        case "DT_VIRAL": return "viral";
        case "DT_CORROSIVE": return "corrosive";
        case "DT_VOID": return "void";
        case "DT_TAU": return "tau";
        case "DT_TRUE": return "true";
        default: return null;
    }
}

function parseOverframeAttackDamage(attackData: Record<string, unknown> | undefined): WeaponDamage {
    const out: WeaponDamage = {
        total: 0, impact: 0, puncture: 0, slash: 0, heat: 0, cold: 0,
        electricity: 0, toxin: 0, blast: 0, radiation: 0, gas: 0,
        magnetic: 0, viral: 0, corrosive: 0, void: 0, tau: 0, true: 0,
    };
    if (!attackData) return out;

    const amount = n(attackData.Amount);
    const explicitPairs: Array<[string, keyof WeaponDamage]> = [
        ["DT_IMPACT", "impact"],
        ["DT_PUNCTURE", "puncture"],
        ["DT_SLASH", "slash"],
        ["DT_FIRE", "heat"],
        ["DT_FREEZE", "cold"],
        ["DT_ELECTRICITY", "electricity"],
        ["DT_POISON", "toxin"],
        ["DT_EXPLOSION", "blast"],
        ["DT_RADIATION", "radiation"],
        ["DT_GAS", "gas"],
        ["DT_MAGNETIC", "magnetic"],
        ["DT_VIRAL", "viral"],
        ["DT_CORROSIVE", "corrosive"],
        ["DT_VOID", "void"],
        ["DT_TAU", "tau"],
        ["DT_TRUE", "true"],
    ];

    let assigned = 0;
    for (const [rawKey, key] of explicitPairs) {
        const ratio = n(attackData[rawKey]);
        if (ratio <= 0) continue;
        out[key] = amount * ratio;
        assigned += out[key];
    }

    if (assigned <= 0) {
        const singleKey = mapOverframeDamageType(String(attackData.Type ?? ""));
        if (singleKey) {
            out[singleKey] = amount;
            assigned = amount;
        }
    }

    out.total = assigned;
    return out;
}

function buildOverframeBeastWeaponEntry(uniqueName: string): WeaponEntry | null {
    const item = OVERFRAME_ITEMS[uniqueName];
    if (!item) return null;

    const name = String(item.name ?? "");
    if (!name) return null;
    const data = (item.data as Record<string, unknown> | undefined) ?? {};
    const tags = (data.CompatibilityTags as unknown[] | undefined)?.map((tag) => String(tag ?? "")) ?? [];
    if (!tags.includes("BEAST_WEAPON")) return null;

    const behavior = Array.isArray(data.Behaviors) ? (data.Behaviors[0] as Record<string, unknown> | undefined) : undefined;
    const impactBehavior = (behavior?.["impact:WeaponImpactBehavior"] as Record<string, unknown> | undefined) ?? {};
    const stateBehavior = (behavior?.["state:WeaponMeleeStateBehavior"] as Record<string, unknown> | undefined) ?? {};
    const attackData = (impactBehavior.AttackData as Record<string, unknown> | undefined) ?? {};
    const damage = parseOverframeAttackDamage(attackData);
    if (damage.total <= 0) return null;

    const rawFireRate = n(stateBehavior.fireRate);
    const normalizedFireRate = rawFireRate > 10 ? rawFireRate / 60 : (rawFireRate || 1);
    const pseudoItem = {
        ...item,
        uniqueName,
        description: String(item.description ?? ""),
        trigger: "Auto",
        type: "Companion Weapon",
    };
    const stanceClasses = inferStanceClasses(pseudoItem, false);

    return {
        uniqueName,
        name,
        category: "Companion",
        weaponType: "Melee",
        modCompat: "Melee",
        damage,
        critChance: n(impactBehavior.criticalHitChance),
        critMultiplier: n(impactBehavior.criticalHitDamageMultiplier) || 1.5,
        statusChance: n(attackData.ProcChance),
        fireRate: normalizedFireRate,
        magazineSize: 1,
        ammoCostPerShot: 1,
        hasExplicitMagazineSize: false,
        reloadTime: 0,
        multishot: 1,
        trigger: "Auto",
        chargeTime: null,
        polarities: inferMainPolaritiesFromItems(uniqueName),
        canOverLevel: false,
        baseSlotCount: 8,
        disposition: 1,
        attacks: [],
        isExalted: false,
        stancePolarity: inferArtifactSlotPolarity(uniqueName, 8),
        stanceClass: stanceClasses[0],
        stanceClasses,
        tags: inferWeaponTags(pseudoItem, false),
        isProgenitorWeapon: false,
    };
}

export function getWeaponCatalog(): WeaponEntry[] {
    if (_cache) return _cache;

    const entries: WeaponEntry[] = [];
    const seenUniqueNames = new Set<string>();

    for (const item of ALL) {
        const exaltedType = String(item.type ?? "") === "Exalted Weapon";
        const exaltedClass = exaltedType ? classifyExaltedWeapon(item) : null;
        const cat = resolveCategory(item, exaltedClass?.category ?? null);
        if (!cat) continue;
        if (!item.name) continue;
        // Must have some damage or be masterable to count as a real weapon
        if (!item.masterable && !item.wikiaUrl) continue;

        const family = exaltedClass ?? resolveWeaponFamily(cat, item);
        const weaponType = family.weaponType;
        const trigger    = String(item.trigger ?? "Auto");
        const name = String(item.name);
        const uniqueName = String(item.uniqueName ?? "");
        const rawAttacks = Array.isArray(item.attacks) ? item.attacks as Record<string, unknown>[] : [];

        // Parse named attacks — only keep those with distinct names (skip unnamed / single attacks)
        const parsedAttacks: WeaponAttack[] = rawAttacks
            .filter(a => typeof a.name === "string" && a.name.length > 0 && typeof a.damage === "object" && a.damage)
            .map(a => {
                const attackDmg = parseDamageRecord(a.damage);
                const attackName = String(a.name).trim().toLowerCase();
                const intrinsicPerStatus = VERIFIED_ATTACK_DAMAGE_PER_STATUS_OVERRIDES[uniqueName]?.[attackName];
                const ammoChargeRule = VERIFIED_ATTACK_AMMO_CHARGE_RULES[uniqueName]?.[attackName];
                const damageRamp = VERIFIED_ATTACK_DAMAGE_RAMP_OVERRIDES[uniqueName]?.[attackName];
                return {
                    name: String(a.name),
                    speed:          n(a.speed) || 1,
                    intrinsicDamagePerStatusBonus: intrinsicPerStatus?.bonus ?? 0,
                    intrinsicDamagePerStatusMode: intrinsicPerStatus?.mode ?? "additiveBase",
                    isAreaDamage: String(a.shot_type ?? "").trim().toLowerCase() === "aoe",
                    critChance:    n(a.crit_chance) / 100,
                    critMultiplier: n(a.crit_mult) || 1.5,
                    statusChance:  n(a.status_chance) / 100,
                    multishot: VERIFIED_ATTACK_MULTISHOT_OVERRIDES[uniqueName]?.[attackName]
                        ?? (n(a.multishot) > 0 ? n(a.multishot) : undefined),
                    ammoCostPerShot: VERIFIED_ATTACK_AMMO_COST_OVERRIDES[uniqueName]?.[attackName]
                        ?? (typeof a.ammo_cost === "number" ? a.ammo_cost : undefined),
                    chargeAmmoPerSecond: ammoChargeRule?.ammoPerSecond,
                    chargeDamageBaseAmmoCost: ammoChargeRule?.damageBaseAmmoCost,
                    damageRamp,
                    chargeTime:    typeof a.charge_time === "number" ? a.charge_time : undefined,
                    forcedProcs: VERIFIED_ATTACK_FORCED_PROC_OVERRIDES[uniqueName]?.[attackName]
                        ?? parseForcedProcs(a.forcedProcs),
                    uniqueStatusProcs: VERIFIED_ATTACK_UNIQUE_STATUS_OVERRIDES[uniqueName]?.[attackName],
                    forcedProcDistributions: VERIFIED_ATTACK_FORCED_PROC_DISTRIBUTION_OVERRIDES[uniqueName]?.[attackName],
                    damage: attackDmg,
                    damageTotal: attackDmg.total,
                };
            });
        const dmg = parseDamageRecord(item.damage ?? parsedAttacks[0]?.damage);
        if (!dmg.total && parsedAttacks.length === 0) continue;

        const hasExplicitMagazineSize = Object.prototype.hasOwnProperty.call(item, "magazineSize");
        const rawPolarities = Array.isArray(item.polarities)
            ? (item.polarities as unknown[]).map(p => String(p))
            : inferMainPolaritiesFromItems(uniqueName);

        const stanceClasses = inferStanceClasses(item, exaltedType);
        const fireRate = n(item.fireRate) || 1;
        const attacks = parsedAttacks.map((attack, attackIndex) => {
            const attackTrigger = resolveAttackTrigger(uniqueName, attack.name, attackIndex, trigger);
            const burst = resolveAttackBurstRule(
                uniqueName,
                attack.name,
                attackTrigger,
                fireRate,
                attack.speed,
            );
            const normalizedAttackName = attack.name.trim().toLowerCase();
            const chargeTime = ATTACK_CHARGE_TIME_OVERRIDES[`${uniqueName}|${normalizedAttackName}`]
                ?? attack.chargeTime;
            return {
                ...attack,
                trigger: burst ? "Burst" : attackTrigger,
                chargeTime,
                ...(burst ? { burstCount: burst.count, burstDelay: burst.delay } : {}),
            };
        });
        const firstAttack = attacks[0];
        const baseAmmoCostPerShot = firstAttack?.ammoCostPerShot ?? Math.max(0.0001, n(item.ammoCost) || 1);
        const burstCount = firstAttack?.burstCount;
        const burstCycleRate = burstCount !== undefined ? firstAttack.speed : undefined;
        const burstDelay = firstAttack?.burstDelay;
        const entry = {
            uniqueName,
            name,
            category: cat,
            weaponType,
            modCompat: family.modCompat,
            damage: dmg,
            critChance:    n(item.criticalChance),
            critMultiplier: n(item.criticalMultiplier) || 1.5,
            statusChance:  n(item.procChance) || n(item.statusChance),
            fireRate,
            // Missing magazine data defaults to a one-shot magazine. Bow shot
            // cadence is modeled separately from the magazine duty cycle.
            magazineSize:  n(item.magazineSize) || 1,
            ammoCostPerShot: baseAmmoCostPerShot,
            hasExplicitMagazineSize,
            reloadTime:    VERIFIED_WEAPON_RELOAD_TIME_OVERRIDES[uniqueName] ?? n(item.reloadTime),
            multishot:     n(item.multishot) || 1,
            trigger,
            chargeTime:    resolveChargeTime(trigger, rawAttacks),
            burstCount: burstDelay === undefined ? undefined : burstCount,
            burstCycleRate: burstDelay === undefined ? undefined : burstCycleRate,
            burstDelay,
            polarities:    rawPolarities,
            canOverLevel:  isOverLevelWeapon(name, uniqueName),
            baseSlotCount: 8,
            disposition:   Number(item.omegaAttenuation ?? 1.0),
            attacks,
            uniqueStatusProcs: firstAttack?.uniqueStatusProcs,
            intrinsicDamagePerStatusBonus: firstAttack?.intrinsicDamagePerStatusBonus ?? 0,
            intrinsicDamagePerStatusMode: firstAttack?.intrinsicDamagePerStatusMode ?? "additiveBase",
            forcedProcs: parseForcedProcs(item.forcedProcs),
            isExalted:     exaltedType,
            stancePolarity: typeof item.stancePolarity === "string" ? String(item.stancePolarity) : undefined,
            stanceClass: stanceClasses[0],
            stanceClasses,
            tags: inferWeaponTags(item, exaltedType),
            isProgenitorWeapon: isProgenitorWeapon(name, uniqueName),
            ...(PERIGALE_GALE_FORCE_UNIQUE_NAMES.has(uniqueName) ? { hasGaleForceAmmoPassive: true } : {}),
        };
        entries.push(entry);
        seenUniqueNames.add(uniqueName);
    }

    for (const [uniqueName] of Object.entries(OVERFRAME_ITEMS)) {
        if (seenUniqueNames.has(uniqueName)) continue;
        if (!uniqueName.includes("/BeastWeapons/")) continue;
        const fallback = buildOverframeBeastWeaponEntry(uniqueName);
        if (!fallback) continue;
        entries.push(fallback);
        seenUniqueNames.add(uniqueName);
    }

    // Some Prime melee records have a stance polarity but no exact stance-family
    // metadata. Reuse the paired non-Prime weapon's family when available.
    const meleeByName = new Map<string, WeaponEntry>();
    for (const weapon of entries) {
        if (weapon.category === "Melee") meleeByName.set(weapon.name.toLowerCase(), weapon);
    }
    for (const weapon of entries) {
        if (weapon.category !== "Melee" || weapon.stanceClasses?.length || weapon.stanceClass) continue;
        const primeName = weapon.name.match(/^(.*?)\s+Prime$/i);
        if (!primeName) continue;
        const baseName = primeName[1].trim();

        const baseWeapon = meleeByName.get(baseName.toLowerCase());
        if (!baseWeapon) continue;
        const stanceClasses = baseWeapon.stanceClasses?.length
            ? [...baseWeapon.stanceClasses]
            : baseWeapon.stanceClass
                ? [baseWeapon.stanceClass]
                : [];
        if (stanceClasses.length === 0) continue;

        weapon.stanceClasses = stanceClasses;
        weapon.stanceClass = stanceClasses[0];
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    _cache = entries;
    return entries;
}

export function getWeaponsByCategory(cat: WeaponCategory): WeaponEntry[] {
    return getWeaponCatalog().filter(w => w.category === cat);
}
