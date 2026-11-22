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

// The upstream item type and internal path call Buzlok a sniper, but the
// current Wiki classifies it as a Rifle and places it in the assault-rifle
// compatibility branch. It must not receive sniper-only mods such as Charged
// Chamber or Target Acquired.
const PRIMARY_RIFLE_MOD_COMPAT_OVERRIDES = new Set([
    "/Lotus/Weapons/Grineer/LongGuns/GrnGorgSniperRifle/GrnGorgSniperRifle",
]);

// The Coda variant inherits Bubonico's shotgun class, although WFCD's weapon
// row labels it as a rifle. Keep its available mod family aligned with the
// current weapon class listed by the Warframe Wiki.
const PRIMARY_SHOTGUN_MOD_COMPAT_OVERRIDES = new Set([
    "/Lotus/Weapons/Infested/InfestedLich/LongGuns/CodaBubonico/CodaBubonicoCannon",
]);

// Sirocco is an Amp, not a rifle. The upstream All.json snapshot also includes
// a stale Primary-profile row, which would otherwise enter the generic weapon
// planner without its Amp-specific damage and upgrade rules.
const UNSUPPORTED_AMP_WEAPON_UNIQUE_NAMES = new Set([
    "/Lotus/Weapons/Operator/Pistols/DrifterPistol/DrifterPistolPlayerWeapon",
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

export interface WeaponAutoSpoolCadenceRule {
    /** Number of consecutive shots before the weapon reaches its listed rate. */
    roundsToFullRate: number;
    /** Fire-rate fraction at spool start, before per-shot increments. */
    startingRateFraction: number;
    /** Fire-rate fraction added after each subsequent shot. */
    rateIncreasePerShotFraction: number;
    /** Current Wiki page documenting this weapon's spool cadence. */
    sourceUrl: string;
}

export interface WeaponAutoSpoolShotSequenceRule {
    /** Maximum innate pellets/projectiles once the weapon is fully spooled. */
    maxProjectiles: number;
    /** Innate projectiles added by each consecutive shot, before the maximum. */
    projectilesAddedPerShot: number;
    /** Ammo cost at the maximum projectile count. */
    ammoCostAtMaximumProjectiles: number;
    /** Rounded Wiki ammo-cost display used for steady full-spool magazine counts. */
    fullySpooledMagazineAmmoCost?: number;
    /** Minimum ammo cost for a shot, including the one-pellet profile. */
    minimumAmmoCostPerShot: number;
    /** Current Wiki page documenting this projectile/ammo sequence. */
    sourceUrl: string;
}

export interface WeaponAutoSpoolTimingLimitation {
    /** Current Wiki page confirming the Auto-Spool behavior and this boundary. */
    sourceUrl: string;
    /** Why this attack cannot yet receive a finite encounter timing estimate. */
    reason: string;
}

export interface WeaponAttackModelLimitation {
    /** Current Wiki page documenting the attack behavior that is not represented. */
    sourceUrl: string;
    /** Why this attack cannot be treated as a standard single-target damage row. */
    reason: string;
}

export interface WeaponAttackScoreBoundaryNote {
    /** Current Wiki page documenting the modeled scoring boundary. */
    sourceUrl: string;
    /** What this single-target score includes and leaves out. */
    reason: string;
}

export type WeaponAttackFalloffScaleBy = "weaponRange" | "projectileSpeed" | "blastRadius";

export interface WeaponAttackDamageFalloff {
    /** Distance where damage first begins to decrease. */
    startDistanceMeters: number;
    /** Distance where the minimum damage multiplier is reached. */
    endDistanceMeters: number;
    /** Remaining fraction of the pre-falloff damage at and beyond the end distance. */
    minimumDamageMultiplier: number;
    /** Only source-listed stats that extend this attack's falloff distances. */
    scaleBy: readonly WeaponAttackFalloffScaleBy[];
    sourceUrl: string;
}

export type WeaponAttackMaximumRangeBehavior = "hardHitCap" | "informational";

export interface WeaponAttackLingeringDamageRule {
    /** Attack row whose damage values describe the linked component event. */
    componentAttackName: string;
    /** Delay from the triggering attack to the first linked component event. */
    firstTickDelaySeconds: number;
    /** Time between linked component events when there is more than one. */
    tickIntervalSeconds: number;
    /** Number of linked component events produced by one triggering attack. */
    tickCount: number;
    /** Whether the linked component also affects the directly struck target. */
    attachedToDirectTarget: boolean;
    /** Whether linked events from separate triggering attacks stack. */
    stacks: boolean;
    sourceUrl: string;
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
    /** True = area hit, false = direct hit, undefined = no source/Wiki classification. */
    isAreaDamage?: boolean;
    /** Per-attack trigger, when a weapon has distinct fire-mode attacks. */
    trigger?: string;
    /** Burst timing metadata for this attack, where verified. */
    burstCount?: number;
    burstDelay?: number;
    /** Base projectiles/hits per trigger for this attack, when it differs from the weapon default. */
    multishot?: number;
    /** This attack component ignores the weapon's multishot stat and all multishot modifiers. */
    multishotLocked?: boolean;
    /** Ammo consumed by one trigger/attack event when it differs by firing mode. */
    ammoCostPerShot?: number;
    /** Source-backed limit of an attack-row ammo-cost approximation. */
    ammoCostModelNote?: string;
    /** Verified fixed ammo consumption rate for an ammo-charged attack. */
    chargeAmmoPerSecond?: number;
    /** Ammo cost represented by the attack row's unscaled base damage. */
    chargeDamageBaseAmmoCost?: number;
    /** Verified time-based damage behavior for this named attack. */
    damageRamp?: WeaponDamageRampRule;
    /** Wiki-sourced Fire Rate ramp for Auto-Spool attack rows. */
    autoSpoolCadence?: WeaponAutoSpoolCadenceRule;
    /** Wiki-sourced per-shot projectile and ammo ramp for Auto-Spool attack rows. */
    autoSpoolShotSequence?: WeaponAutoSpoolShotSequenceRule;
    /** Explicit finite-timing boundary for Wiki-confirmed Auto-Spool rows without a complete supported cadence. */
    autoSpoolTimingLimitation?: WeaponAutoSpoolTimingLimitation;
    /** Source-backed reason the attack's damage and score cannot be represented by the standard attack-row model. */
    modelLimitation?: WeaponAttackModelLimitation;
    /** Source-backed boundary shown while keeping a useful single-target score available. */
    scoreBoundaryNote?: WeaponAttackScoreBoundaryNote;
    /** Wiki-listed falloff for this attack. AoE profiles measure target offset from the explosion center. */
    damageFalloff?: WeaponAttackDamageFalloff;
    /** Wiki-listed maximum hit range and how the planner treats targets beyond it. */
    maximumRangeMeters?: number;
    maximumRangeBehavior?: WeaponAttackMaximumRangeBehavior;
    maximumRangeSourceUrl?: string;
    /** A separately catalogued damage component linked to each projectile from this attack. */
    lingeringDamageRule?: WeaponAttackLingeringDamageRule;
    /** This row damages the target directly struck by its attached projectile, while retaining AoE rules elsewhere. */
    appliesToAttachedTarget?: boolean;
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
    /** Upstream identity for a selectable profile that derives from another catalog item. */
    sourceUniqueName?: string;
    name: string;
    /** Context label for entries with distinct source-backed equipment profiles. */
    variantLabel?: string;
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
    /** Applied Kuva/Tenet/Coda base-damage valence bonus, used by source-specific effects. */
    valenceBonusPct?: number;
    /** True for Perigale variants with the Gale Force ammo-efficiency passive. */
    hasGaleForceAmmoPassive?: boolean;
    /** Selected attack context carried into calculator/optimizer scoring. */
    selectedAttackName?: string;
    /** Source-listed falloff profile carried from the selected attack row. */
    selectedAttackDamageFalloff?: WeaponAttackDamageFalloff;
    /** Source-listed range limit carried from the selected attack row. */
    selectedAttackMaximumRangeMeters?: number;
    selectedAttackMaximumRangeBehavior?: WeaponAttackMaximumRangeBehavior;
    selectedAttackMaximumRangeSourceUrl?: string;
    /** True when the selected attack is part of the weapon's Incarnon form. */
    selectedAttackIsIncarnon?: boolean;
    /** Wiki-listed total ammo loaded by one fully charged ranged Incarnon form. */
    selectedAttackIncarnonAmmoCapacity?: number;
    /** Wiki page for the selected Incarnon mode's finite ammo capacity. */
    selectedAttackIncarnonAmmoCapacitySourceUrl?: string;
    /** Disclosure for source-backed attack-row ammo-cost approximations. */
    selectedAttackAmmoCostModelNote?: string;
    /** True = area hit, false = direct hit, undefined = no source/Wiki classification. */
    selectedAttackIsAreaDamage?: boolean;
    /** True when the selected melee attack is excluded from Condition Overload's bonus. */
    selectedAttackIgnoresConditionOverload?: boolean;
    /** True when the selected attack's damage is multiplied by the active melee combo tier. */
    selectedAttackUsesMeleeComboMultiplier?: boolean;
    /** True when selected-attack heavy-only critical chance bonuses apply to this row. */
    selectedAttackUsesHeavyAttackCritChance?: boolean;
    /** True when the selected catalog row is a slam attack affected by Slam Damage mods. */
    selectedAttackUsesSlamDamageBonus?: boolean;
    /** True when the selected catalog row is an ordinary slide attack. */
    selectedAttackIsSlideAttack?: boolean;
    /** Wiki-defined base critical multiplier when the player is sliding at impact with Furax Kinetic Killer selected. */
    selectedAttackSlideCritMultiplierOverride?: number;
    /** Base Status Chance percentage points from the selected attack's current Critical Chance, for source-backed Incarnon perks. */
    selectedAttackBaseStatusChancePerCriticalChance?: number;
    /** Cap on the selected attack's dynamic base Status Chance bonus. */
    selectedAttackBaseStatusChancePerCriticalChanceCap?: number;
    /** Selected attack's fixed ammo charge rate, where verified. */
    selectedAttackChargeAmmoPerSecond?: number;
    /** Ammo cost represented by the selected attack row's base damage. */
    selectedAttackChargeDamageBaseAmmoCost?: number;
    /** Time-based damage behavior carried from the selected attack row. */
    selectedAttackDamageRamp?: WeaponDamageRampRule;
    /** Fire Rate ramp carried from the selected Auto-Spool attack row. */
    selectedAttackAutoSpoolCadence?: WeaponAutoSpoolCadenceRule;
    /** Per-shot projectile and ammo ramp carried from the selected attack row. */
    selectedAttackAutoSpoolShotSequence?: WeaponAutoSpoolShotSequenceRule;
    /** Why finite attack timing is unavailable for this selected Auto-Spool row. */
    selectedAttackAutoSpoolTimingLimitation?: WeaponAutoSpoolTimingLimitation;
    /** Source-backed reason the selected attack cannot be represented by the standard damage model. */
    selectedAttackModelLimitation?: WeaponAttackModelLimitation;
    /** True when the selected attack's projectile count is fixed and ignores multishot modifiers. */
    selectedAttackMultishotLocked?: boolean;
    /** Linked damage component emitted by each selected attack projectile. */
    selectedAttackLingeringDamageRule?: WeaponAttackLingeringDamageRule;
    /** True when an AoE component also directly affects the attached projectile's target. */
    selectedAttackAppliesToAttachedTarget?: boolean;
}

export function getWeaponDisplayName(weapon: Pick<WeaponEntry, "name" | "variantLabel">): string {
    return weapon.variantLabel ? `${weapon.name} (${weapon.variantLabel})` : weapon.name;
}

export type WeaponForcedProcType = Exclude<keyof WeaponDamage, "total" | "true">;
export type WeaponForcedProcs = Partial<Record<WeaponForcedProcType, number>>;
/** Non-damage-type statuses that may count as a unique Condition Overload/Galvanized state. */
export type WeaponUniqueStatusType = "microwave" | "lifted" | "knockdown";
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
    // Both Vasto Genesis forms use the Wiki-listed six-shot, 0.1s burst.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Vasto_Incarnon_Genesis
    "/Lotus/Weapons/Tenno/Pistol/RevolverPistol|incarnon form": { count: 6, delay: 0.1 },
    "/Lotus/Weapons/Tenno/Pistols/PrimeVasto/PrimeVastoPistol|incarnon form": { count: 6, delay: 0.1 },
});

const ATTACK_TRIGGER_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
    "/Lotus/Weapons/Grineer/LongGuns/GrnHarpoonGun/GrnHarpoonGun|harpoon": "Semi",
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon": "Charge",
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon contact": "Charge",
    // Shell Rush speeds the sourced charged alt-fire modes; component rows
    // represent one release and share that charge trigger.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Shell_Rush
    // https://wiki.warframe.com/w/Larkspur
    // https://wiki.warframe.com/w/Larkspur_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun|alt-fire projectile impact": "Charge",
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun|explosion": "Charge",
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon|alt-fire projectile impact": "Charge",
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon|explosion": "Charge",
    // The Mausolon charged laser and blast are two damage components of one
    // fully charged alt-fire in both selectable equipment profiles.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Mausolon
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun|charged shot laser": "Charge",
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun|charged shot explosion": "Charge",
    // The Torid's Genesis Incarnon form is a held beam, although its base
    // grenade launcher is semi-auto. Cannonade requires every firing form to
    // be semi-auto, so the base trigger alone is insufficient here.
    "/Lotus/Weapons/ClanTech/Bio/BioWeapon|incarnon form": "Held",
    // The Incarnon attack tables classify both Vasto variants as Burst.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Vasto_Incarnon_Genesis
    "/Lotus/Weapons/Tenno/Pistol/RevolverPistol|incarnon form": "Burst",
    "/Lotus/Weapons/Tenno/Pistols/PrimeVasto/PrimeVastoPistol|incarnon form": "Burst",
    "/Lotus/Weapons/Thanotech/ThanoPistol/ThanotechPistol|lock-on mode": "Special",
    "/Lotus/Weapons/Thanotech/ThanoPistol/ThanotechPistol|lock-on radial attack": "Special",
});

const autoSpoolCadence = (
    roundsToFullRate: number,
    startingRateFraction: number,
    rateIncreasePerShotFraction: number,
    sourceUrl: string,
): WeaponAutoSpoolCadenceRule => Object.freeze({
    roundsToFullRate,
    startingRateFraction,
    rateIncreasePerShotFraction,
    sourceUrl,
});

const autoSpoolShotSequence = (
    maxProjectiles: number,
    projectilesAddedPerShot: number,
    ammoCostAtMaximumProjectiles: number,
    minimumAmmoCostPerShot: number,
    sourceUrl: string,
    fullySpooledMagazineAmmoCost?: number,
): WeaponAutoSpoolShotSequenceRule => Object.freeze({
    maxProjectiles,
    projectilesAddedPerShot,
    ammoCostAtMaximumProjectiles,
    minimumAmmoCostPerShot,
    sourceUrl,
    ...(fullySpooledMagazineAmmoCost === undefined ? {} : { fullySpooledMagazineAmmoCost }),
});

const autoSpoolTimingLimitation = (
    sourceUrl: string,
    reason: string,
): WeaponAutoSpoolTimingLimitation => Object.freeze({ sourceUrl, reason });

/**
 * The upstream item snapshot labels several Auto-Spool weapons as plain Auto.
 * These attack-specific Wiki records restore their trigger and rate-only spool
 * cadence. The Coda Bubonico's Wiki trigger remains Auto; its separate cadence
 * rule models the primary-fire rate ramp without relabeling that trigger.
 */
const VERIFIED_ATTACK_AUTO_SPOOL_OVERRIDES: Readonly<Record<
    string,
    Readonly<Record<string, WeaponAutoSpoolCadenceRule>>
>> = Object.freeze({
    "/Lotus/Weapons/Tenno/Rifle/HeavyRifle": Object.freeze({
        "fully spooled": autoSpoolCadence(9, 0.20, 0.10667, "https://wiki.warframe.com/w/Gorgon"),
    }),
    "/Lotus/Weapons/Grineer/LongGuns/WraithGorgon/WraithGorgon": Object.freeze({
        "fully spooled": autoSpoolCadence(6, 0.20, 0.16, "https://wiki.warframe.com/w/Gorgon_Wraith"),
    }),
    "/Lotus/Weapons/Grineer/LongGuns/VoidTraderGorgon/VTGorgon": Object.freeze({
        "fully spooled": autoSpoolCadence(7, 0.20, 0.1333, "https://wiki.warframe.com/w/Prisma_Gorgon"),
    }),
    "/Lotus/Weapons/Tenno/Rifle/TennoAR": Object.freeze({
        "fully spooled": autoSpoolCadence(6, 0.25, 0.15, "https://wiki.warframe.com/w/Soma"),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeSoma/PrimeSomaRifle": Object.freeze({
        "fully spooled": autoSpoolCadence(4, 0.25, 0.30, "https://wiki.warframe.com/w/Soma_Prime"),
    }),
    "/Lotus/Weapons/ClanTech/Energy/CrpHeavyRifle": Object.freeze({
        "fully spooled": autoSpoolCadence(5, 0.10, 0.225, "https://wiki.warframe.com/w/Supra"),
    }),
    "/Lotus/Weapons/Corpus/LongGuns/Machinegun/SupraVandal": Object.freeze({
        "fully spooled": autoSpoolCadence(4, 0.40, 0.20, "https://wiki.warframe.com/w/Supra_Vandal"),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/TnBardRifle/TnBardRifle": Object.freeze({
        "fully spooled": autoSpoolCadence(9, 0.40, 0.075, "https://wiki.warframe.com/w/Tenora"),
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeTenora/TenoraPrimeWeapon": Object.freeze({
        "fully spooled": autoSpoolCadence(9, 0.40, 0.075, "https://wiki.warframe.com/w/Tenora_Prime"),
    }),
    "/Lotus/Weapons/Tenno/Pistols/SomaSidearm/AkimboSomaPistols": Object.freeze({
        "fully spooled": autoSpoolCadence(6, 0.25, 0.15, "https://wiki.warframe.com/w/Aksomati"),
    }),
    "/Lotus/Weapons/Corpus/Pistols/CorpusMinigun/CorpusMinigun": Object.freeze({
        "normal attack": autoSpoolCadence(6, 0.60, 0.08, "https://wiki.warframe.com/w/Cestra"),
    }),
    "/Lotus/Weapons/Syndicates/PerrinSequence/Pistols/PSDualCestra": Object.freeze({
        "normal attack": autoSpoolCadence(5, 0.60, 0.08, "https://wiki.warframe.com/w/Secura_Dual_Cestra"),
    }),
    "/Lotus/Weapons/Infested/InfestedLich/LongGuns/CodaBubonico/CodaBubonicoCannon": Object.freeze({
        "auto": autoSpoolCadence(7, 0.30, 0.1167, "https://wiki.warframe.com/w/Coda_Bubonico"),
    }),
    "/Lotus/Weapons/Grineer/Pistols/GrnKohmPistol/GrnKohmPistol": Object.freeze({
        "fully spooled": autoSpoolCadence(4, 0.20, 0.32, "https://wiki.warframe.com/w/Kohmak"),
    }),
    "/Lotus/Weapons/Grineer/Pistols/GrnDWUniques/GrnTwinKohmaks": Object.freeze({
        "fully spooled": autoSpoolCadence(11, 0.20, 0.08, "https://wiki.warframe.com/w/Twin_Kohmak"),
    }),
    "/Lotus/Weapons/Grineer/KuvaLich/LongGuns/Kohm/KuvaKohm": Object.freeze({
        "fully spooled": autoSpoolCadence(5, 0.20, 0.20, "https://wiki.warframe.com/w/Kuva_Kohm"),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/RepurposedGrineerAntiAircraftGun/ArchGRNAAGun": Object.freeze({
        "projectile impact": autoSpoolCadence(4, 0.40, 0.20, "https://wiki.warframe.com/w/Grattler"),
        "explosion": autoSpoolCadence(4, 0.40, 0.20, "https://wiki.warframe.com/w/Grattler"),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/ArchLongRifle/ArchLongRifle": Object.freeze({
        "normal attack": autoSpoolCadence(11, 0.50, 0.05, "https://wiki.warframe.com/w/Phaedra"),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/FoldingMachineGun/ArchMachineGunVandal": Object.freeze({
        "normal attack": autoSpoolCadence(16, 0.5333, 0.0311, "https://wiki.warframe.com/w/Imperator_Vandal"),
    }),
});

/**
 * Wiki-confirmed Auto-Spool rows that deliberately remain unavailable to the
 * finite encounter until their full attack cadence can be represented. This
 * prevents the target optimizer from treating a fully-spooled Arsenal rate as
 * an immediate first-shot rate. Single-Pellet rows remain available as the
 * separate unspooled attack profile supplied by the Wiki.
 */
const VERIFIED_ATTACK_AUTO_SPOOL_TIMING_LIMITATIONS: Readonly<Record<
    string,
    Readonly<Record<string, WeaponAutoSpoolTimingLimitation>>
>> = Object.freeze({
    "/Lotus/Weapons/Grineer/LongGuns/GrnSpark/GrnSparkRifle": Object.freeze({
        "fully spooled": autoSpoolTimingLimitation(
            "https://wiki.warframe.com/w/Kohm",
            "The Wiki documents the pellet and ammo ramp but does not give the starting fire-rate fraction and per-shot increments needed to model the full finite sequence.",
        ),
    }),
    "/Lotus/Weapons/Tenno/Pistols/PrimeAksomati/PrimeAksomati": Object.freeze({
        "fully spooled": autoSpoolTimingLimitation(
            "https://wiki.warframe.com/w/Aksomati_Prime",
            "The Wiki confirms an 11-round spool-up but does not give the starting rate and per-shot increments needed for finite timing.",
        ),
    }),
    "/Lotus/Types/Sentinels/SentinelWeapons/DethMachineRifle": Object.freeze({
        "normal attack": autoSpoolTimingLimitation(
            "https://wiki.warframe.com/w/Deth_Machine_Rifle",
            "The Wiki confirms Auto-Spool behavior but does not give the starting rate and per-shot increments needed for finite timing.",
        ),
    }),
    "/Lotus/Types/Sentinels/SentinelWeapons/PrimeDethMachineRifle": Object.freeze({
        "normal attack": autoSpoolTimingLimitation(
            "https://wiki.warframe.com/w/Deth_Machine_Rifle_Prime",
            "The Wiki confirms Auto-Spool behavior but does not give the starting rate and per-shot increments needed for finite timing.",
        ),
    }),
});

function getAutoSpoolCadence(uniqueName: string, attackName: string): WeaponAutoSpoolCadenceRule | undefined {
    return VERIFIED_ATTACK_AUTO_SPOOL_OVERRIDES[uniqueName]?.[attackName.trim().toLowerCase()];
}

const VERIFIED_ATTACK_AUTO_SPOOL_SHOT_SEQUENCE_OVERRIDES: Readonly<Record<
    string,
    Readonly<Record<string, WeaponAutoSpoolShotSequenceRule>>
>> = Object.freeze({
    // These Fully Spooled rows add one pellet per consecutive shot. Each Wiki
    // page gives the one-pellet and fully-spooled ammo costs; intermediate
    // costs are inferred by linear scaling with a one-ammo floor. That model
    // reproduces the Wiki's 25-shot and 49-shot Kohmak-family magazine notes.
    // Kuva Kohm's fresh-magazine count remains model-derived; its Wiki page
    // gives the fully-spooled magazine count instead.
    // https://wiki.warframe.com/w/Kohmak
    // https://wiki.warframe.com/w/Twin_Kohmak
    "/Lotus/Weapons/Grineer/Pistols/GrnKohmPistol/GrnKohmPistol": Object.freeze({
        "fully spooled": autoSpoolShotSequence(5, 1, 5 / 3, 1, "https://wiki.warframe.com/w/Kohmak", 1.67),
    }),
    "/Lotus/Weapons/Grineer/Pistols/GrnDWUniques/GrnTwinKohmaks": Object.freeze({
        "fully spooled": autoSpoolShotSequence(5, 1, 5 / 3, 1, "https://wiki.warframe.com/w/Twin_Kohmak", 1.67),
    }),
    "/Lotus/Weapons/Grineer/KuvaLich/LongGuns/Kohm/KuvaKohm": Object.freeze({
        "fully spooled": autoSpoolShotSequence(12, 1, 4, 1, "https://wiki.warframe.com/w/Kuva_Kohm"),
    }),
});

function getAutoSpoolShotSequence(
    uniqueName: string,
    attackName: string,
): WeaponAutoSpoolShotSequenceRule | undefined {
    return VERIFIED_ATTACK_AUTO_SPOOL_SHOT_SEQUENCE_OVERRIDES[uniqueName]?.[attackName.trim().toLowerCase()];
}

function getAutoSpoolTimingLimitation(uniqueName: string, attackName: string): WeaponAutoSpoolTimingLimitation | undefined {
    return VERIFIED_ATTACK_AUTO_SPOOL_TIMING_LIMITATIONS[uniqueName]?.[attackName.trim().toLowerCase()];
}

const ATTACK_CHARGE_TIME_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon": 0.25,
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle|infested harpoon contact": 0.25,
    // Larkspur's charged grenade impact and its linked explosion are one
    // release; both carry the Wiki-listed 0.5s charge time.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Larkspur
    // https://wiki.warframe.com/w/Larkspur_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun|alt-fire projectile impact": 0.5,
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun|explosion": 0.5,
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon|alt-fire projectile impact": 0.5,
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon|explosion": 0.5,
    // Both Mausolon equipment profiles share the charged 0.8s release time.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Mausolon
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun|charged shot laser": 0.8,
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun|charged shot explosion": 0.8,
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
    // Larkspur consumes 0.5 ammo per beam tick and 10 ammo for each charged
    // projectile release. Atmosphere profiles use the same costs; their
    // different reload time and damage are attached to the profile clone.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Larkspur
    // https://wiki.warframe.com/w/Larkspur_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun": Object.freeze({
        "normal attack": 0.5,
        "alt-fire projectile impact": 10,
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon": Object.freeze({
        "normal attack": 0.5,
        "alt-fire projectile impact": 10,
    }),
    // The Onos' fully charged Heat release spends 50 Incarnon rounds after
    // the charge-beam ticks. These two attack rows are separate direct/radial
    // representations of that one release; the earlier one-round-per-tick
    // charge damage remains a separate selected attack row.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Onos
    "/Lotus/Weapons/Thanotech/EntratiWristGun/EntratiWristGunWeapon": Object.freeze({
        "incarnon form charge attack": 50,
        "incarnon form charge radial attack": 50,
    }),
});

const VERIFIED_ATTACK_AMMO_COST_MODEL_NOTES: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
    // Each completed Onos Heat release consumes 50 Incarnon rounds after its
    // charge-beam ticks; the selected-row model excludes the pre-release beam
    // ticks and charge timing. Verified 2026-11-15: https://wiki.warframe.com/w/Onos
    "/Lotus/Weapons/Thanotech/EntratiWristGun/EntratiWristGunWeapon": Object.freeze({
        "incarnon form charge attack": "Each completed Heat release consumes 50 rounds after charge-beam ticks; the pre-release ticks and charge timing are not simulated.",
        "incarnon form charge radial attack": "Each completed Heat release consumes 50 rounds after charge-beam ticks; the pre-release ticks and charge timing are not simulated.",
    }),
});

const PHANTASMA_BEAM_DAMAGE_RAMP: WeaponDamageRampRule = Object.freeze({
    minimumDamageMultiplier: 0.15,
    rampToFullSeconds: 0.6,
    idleBeforeDecaySeconds: 0.8,
    decayToMinimumSeconds: 2,
});

const LARKSPUR_BEAM_DAMAGE_RAMP: WeaponDamageRampRule = Object.freeze({
    minimumDamageMultiplier: 0.2,
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
    // Larkspur's continuous primary beam ramps from 20% to 100% over 0.6s,
    // then begins decaying after 0.8s idle and returns to 20% over 2s. This
    // source rule applies to both selectable equipment profiles.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Larkspur
    // https://wiki.warframe.com/w/Larkspur_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun": Object.freeze({
        "normal attack": LARKSPUR_BEAM_DAMAGE_RAMP,
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon": Object.freeze({
        "normal attack": LARKSPUR_BEAM_DAMAGE_RAMP,
    }),
});

const VERIFIED_ATTACK_DAMAGE_FALLOFF_OVERRIDES: Readonly<
    Record<string, Readonly<Record<string, WeaponAttackDamageFalloff>>>
> = Object.freeze({
    // Mausolon's Archwing page lists separate direct and radial falloff. The
    // Atmosphere variant has no direct Auto falloff and a smaller radial minimum.
    // Radial distance is from the explosion center to the target.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Mausolon
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun": Object.freeze({
        "auto": Object.freeze({
            startDistanceMeters: 1400,
            endDistanceMeters: 2800,
            minimumDamageMultiplier: 0,
            scaleBy: Object.freeze(["weaponRange", "projectileSpeed"] as const),
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
        }),
        "auto radial attack": Object.freeze({
            startDistanceMeters: 0,
            endDistanceMeters: 1.8,
            minimumDamageMultiplier: 0.9,
            scaleBy: Object.freeze(["blastRadius"] as const),
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
        }),
        "charged shot explosion": Object.freeze({
            startDistanceMeters: 0,
            endDistanceMeters: 8,
            minimumDamageMultiplier: 0.6,
            scaleBy: Object.freeze(["blastRadius"] as const),
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
        }),
    }),
    // Both Larkspur equipment profiles list the charged explosion's 100% to
    // 40% falloff over its 9.6m radius. The selected component-row model uses
    // this curve for radial distance from the explosion center.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Larkspur
    // https://wiki.warframe.com/w/Larkspur_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun": Object.freeze({
        "explosion": Object.freeze({
            startDistanceMeters: 0,
            endDistanceMeters: 9.6,
            minimumDamageMultiplier: 0.4,
            scaleBy: Object.freeze(["blastRadius"] as const),
            sourceUrl: "https://wiki.warframe.com/w/Larkspur",
        }),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon": Object.freeze({
        "explosion": Object.freeze({
            startDistanceMeters: 0,
            endDistanceMeters: 9.6,
            minimumDamageMultiplier: 0.4,
            scaleBy: Object.freeze(["blastRadius"] as const),
            sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime",
        }),
    }),
    // The Wiki lists 100%→26.67% falloff between 10m and 25m, with the
    // distance range affected by Projectile Speed.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Vaykor_Hek
    "/Lotus/Weapons/Syndicates/SteelMeridian/LongGuns/SMHek": Object.freeze({
        "normal attack": Object.freeze({
            startDistanceMeters: 10,
            endDistanceMeters: 25,
            minimumDamageMultiplier: 0.2666666667,
            scaleBy: Object.freeze(["projectileSpeed"] as const),
            sourceUrl: "https://wiki.warframe.com/w/Vaykor_Hek",
        }),
    }),
});

const VERIFIED_ATTACK_MAXIMUM_RANGE_OVERRIDES: Readonly<
    Record<string, Readonly<Record<string, {
        meters: number;
        sourceUrl: string;
        behavior?: WeaponAttackMaximumRangeBehavior;
    }>>>
> = Object.freeze({
    // Archwing Auto's listed 300m Range conflicts with its 1,400–2,800m
    // falloff curve, so that row remains informational. Its charged laser has
    // no direct-falloff conflict and uses the listed 300m as a hit cap.
    // Atmosphere Auto and Charged Shot Laser both list 300m, are hit-scan, and
    // have no direct falloff; use the Wiki's Range/Hitscan definitions as caps.
    // Sources: https://wiki.warframe.com/w/Mausolon
    // https://wiki.warframe.com/w/Range
    // https://wiki.warframe.com/w/Hitscan
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun": Object.freeze({
        "auto": Object.freeze({
            meters: 300,
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
            behavior: "informational",
        }),
        "charged shot laser": Object.freeze({
            meters: 300,
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
            behavior: "hardHitCap",
        }),
    }),
    // The attack tables list 160m / 180m Normal Attack ranges in Archwing.
    // Atmospheric ranges are set on the separate cloned profiles below.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Larkspur
    // https://wiki.warframe.com/w/Larkspur_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun": Object.freeze({
        "normal attack": Object.freeze({ meters: 160, sourceUrl: "https://wiki.warframe.com/w/Larkspur" }),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon": Object.freeze({
        "normal attack": Object.freeze({ meters: 180, sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime" }),
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
    if (category === "Primary" && PRIMARY_RIFLE_MOD_COMPAT_OVERRIDES.has(String(item.uniqueName ?? ""))) {
        return { weaponType: "Rifle", modCompat: "Rifle" };
    }
    if (category === "Primary" && PRIMARY_SNIPER_MOD_COMPAT_OVERRIDES.has(String(item.uniqueName ?? ""))) {
        return { weaponType: "Sniper", modCompat: "Sniper" };
    }
    if (category === "Primary" && PRIMARY_SHOTGUN_MOD_COMPAT_OVERRIDES.has(String(item.uniqueName ?? ""))) {
        return { weaponType: "Shotgun", modCompat: "Shotgun" };
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

/** Wiki-confirmed direct/radial attack rows missing their area marker in the source export. */
const VERIFIED_ATTACK_AREA_DAMAGE_OVERRIDES: Readonly<
    Record<string, Readonly<Record<string, boolean>>>
> = Object.freeze({
    // These Hound weapons have only standard melee attacks, with no slam,
    // slide, or radial attack mode. Their normal attack is direct contact.
    // Verified 2026-11-15:
    // https://wiki.warframe.com/w/Akaten
    // https://wiki.warframe.com/w/Batoten
    // https://wiki.warframe.com/w/Lacerten
    // https://wiki.warframe.com/w/Update_30
    "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetMeleeWeaponPS": Object.freeze({
        "normal attack": false,
    }),
    "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetMeleeWeaponIP": Object.freeze({
        "normal attack": false,
    }),
    "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetMeleeWeaponIS": Object.freeze({
        "normal attack": false,
    }),
    // The max-zoom shot adds a 3.5 m Viral explosion. The feed omits shot_type
    // on this named radial attack, so keep its explosion separate from the
    // direct projectile hit for status bonuses that only affect direct damage.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Komorex
    "/Lotus/Weapons/Corpus/LongGuns/CrpSentAmlgSniper/CrpSentAmlgSniper": Object.freeze({
        "3.5x zoom radial attack": true,
    }),
    // The Verdilac energy wave explodes at its 1.3 s lifetime for a small
    // radial Electricity hit. The source row has no shot_type marker.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Verdilac
    "/Lotus/Weapons/Archon/Melee/Whip/ArchonWhipPlayerWep": Object.freeze({
        "energy wave": false,
        "energy wave explosion": true,
    }),
    // Alternox's alternate-fire sphere pulses on nearby enemies once per
    // second within 6 m. The pulse row omits shot_type; contact and the final
    // explosion are separate source rows.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Alternox
    "/Lotus/Weapons/Tenno/LongGuns/GyreRifle/GyreRifleWeapon": Object.freeze({
        "alt-fire damage over time": true,
    }),
    // Alternox Prime uses the same 6 m pulse behavior as the base weapon.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Alternox_Prime
    "/Lotus/Weapons/Tenno/LongGuns/PrimeAlternox/PrimeAlternoxWeapon": Object.freeze({
        "alt-fire damage over time": true,
    }),
    // Azima's deployed magazine turret detonates with a small-radius Blast hit
    // when its ammunition expires. The row is separate from the turret bullets.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Azima
    "/Lotus/Weapons/Tenno/Pistols/SundialGun/SundialPistol": Object.freeze({
        "turret expiry": true,
    }),
    // When a player shoots a Quanta cube it detonates in a 6 m radius. Keep
    // that area hit distinct from the cube's direct contact row.
    // Verified 2026-11-15:
    // https://wiki.warframe.com/w/Quanta
    // https://wiki.warframe.com/w/Quanta_Vandal
    // https://wiki.warframe.com/w/Tenet_Quanta
    "/Lotus/Weapons/Corpus/LongGuns/CrpShockRifle/CrpShockRifle": Object.freeze({
        "cube (shot by player)": true,
    }),
    "/Lotus/Weapons/Corpus/LongGuns/CrpShockRifle/QuantaVandal": Object.freeze({
        "cube (shot by player)": true,
    }),
    "/Lotus/Weapons/Corpus/BoardExec/Primary/CrpBEQuanta/CrpBEQuanta": Object.freeze({
        "cube (shot by player)": true,
    }),
    // The deployed disc aura deals Heat damage to enemies within 4 m. Its
    // impact remains direct and its separate explosion is already source-tagged.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Zenistar
    "/Lotus/Weapons/Tenno/Melee/SunDialAxe/SundialAxeWeapon": Object.freeze({
        "attacks while disc deployed": false,
        "disc impact": false,
        "disc aura": true,
    }),
    // These grenade rows are the projectile's direct contact. Their separate
    // radial/bounce rows are source-tagged AoE.
    // Verified 2026-11-15:
    // https://wiki.warframe.com/w/Cortege
    // https://wiki.warframe.com/w/Trumna
    // https://wiki.warframe.com/w/Trumna_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchGun/ThanoTechArchGun": Object.freeze({
        "grenade impact": false,
    }),
    "/Lotus/Weapons/Thanotech/ThanoRifle/ThanotechRifle": Object.freeze({
        "grenade impact": false,
    }),
    "/Lotus/Weapons/Tenno/LongGuns/PrimeTrumna/PrimeTrumnaWeapon": Object.freeze({
        "grenade impact": false,
    }),
    // The Hind semi-auto row is one bullet per trigger, as its Wiki fire-mode
    // description confirms; the row omits the hit-scan shot_type value.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Hind
    "/Lotus/Weapons/Grineer/LongGuns/BurstRifle/GrnBurstRifle": Object.freeze({
        "semi-auto mode": false,
    }),
    // Morgha's charged projectile's direct hit is separate from its following
    // explosion row.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Morgha
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechGrenadeLaunch/ThanoTechGrenadeLauncher": Object.freeze({
        "charged shot": false,
    }),
    // Nepheri fireballs are direct projectiles with infinite body punch-through.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Nepheri
    "/Lotus/Weapons/Archon/Melee/DualDaggers/ArchonDualDaggersPlayerWep": Object.freeze({
        "fireballs": false,
    }),
    // Orvius deals three single-target Hover Attack ticks before its separate
    // 4 m throw explosion.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Orvius
    "/Lotus/Weapons/Tenno/Melee/Glaives/TeshinGlaive/TnTeshinGlaiveWep": Object.freeze({
        "hover attack": false,
    }),
    // Pandero Prime's alternate fire is a burst of the same direct bullets.
    // Verified 2026-11-15:
    // https://wiki.warframe.com/w/Pandero_Prime
    // https://wiki.warframe.com/w/Alternate_Fire
    "/Lotus/Weapons/Tenno/Pistols/PrimePandero/PanderoPrimeWeapon": Object.freeze({
        "alt-fire": false,
    }),
    // The Paracyst harpoon's contact hit is direct; its damage-over-time effect
    // is separate from the contact row.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Paracyst
    "/Lotus/Weapons/Infested/LongGuns/QuantaFullyInfested/InfQuantaRifle": Object.freeze({
        "infested harpoon contact": false,
    }),
    // Shattered Lash's thrust and sweep are melee contact hits, not radial
    // explosions; the separate Mass Vitrify shatter is ability damage.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Shattered_Lash_%28Weapon%29
    "/Lotus/Powersuits/Glass/GaraShankWeapon": Object.freeze({
        "damage": false,
        "arcing damage": false,
    }),
    "/Lotus/Powersuits/Glass/GaraShankWeaponPrime": Object.freeze({
        "damage": false,
        "arcing damage": false,
    }),
    // The Stormpath slide hit is a melee contact attack; its separate 14 m
    // vortex pulls and staggers but is not an additional damage event.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Telos_Boltace
    "/Lotus/Weapons/Syndicates/ArbitersOfHexis/Melee/AHBoltace": Object.freeze({
        "stormpath slide attack": false,
    }),
    // Zaw component attack rows are direct melee strikes across their weapon
    // classes; their source records omit shot_type.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Zaw
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipOne": Object.freeze({ "balla strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/TipOne": Object.freeze({ "balla strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipFour": Object.freeze({ "cyath strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/TipFour": Object.freeze({ "cyath strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipFive": Object.freeze({ "dehtat strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/TipFive": Object.freeze({ "dehtat strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee02/Tip/TipEleven": Object.freeze({ "dokrahm strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipSix": Object.freeze({ "kronsh strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/TipSix": Object.freeze({ "kronsh strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipThree": Object.freeze({ "mewan strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/TipThree": Object.freeze({ "mewan strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipTwo": Object.freeze({ "ooltha strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/TipTwo": Object.freeze({ "ooltha strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMeleeInfested/Tips/PvPVariantInfestedTipTwo": Object.freeze({ "plague keewar strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMeleeInfested/Tips/InfestedTipTwo": Object.freeze({ "plague keewar strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMeleeInfested/Tips/PvPVariantInfestedTipOne": Object.freeze({ "plague kripath strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMeleeInfested/Tips/InfestedTipOne": Object.freeze({ "plague kripath strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee02/Tip/TipTen": Object.freeze({ "rabvee strike": false }),
    "/Lotus/Weapons/Ostron/Melee/ModularMelee02/Tip/TipNine": Object.freeze({ "sepfahn strike": false }),
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

/** Wiki-backed Torid cloud sequence. The first tick is explicitly bounded at +1s. */
const VERIFIED_ATTACK_LINGERING_DAMAGE_OVERRIDES: Readonly<Record<
    string,
    Readonly<Record<string, WeaponAttackLingeringDamageRule>>
>> = Object.freeze({
    // One direct Torid hit attaches a ten-second cloud to the struck enemy.
    // The Torid and Damage over Time Wiki pages specify ten ticks, one second
    // apart, with a one-second delay: +1s through +10s. Multiple clouds stack.
    // Area coverage and damage to other targets are deliberately not scored.
    // Verified 2026-11-17: https://wiki.warframe.com/w/Torid
    // https://wiki.warframe.com/w/Damage_over_Time#Weapons
    "/Lotus/Weapons/ClanTech/Bio/BioWeapon": Object.freeze({
        "grenade impact": Object.freeze({
            componentAttackName: "Poison Cloud",
            firstTickDelaySeconds: 1,
            tickIntervalSeconds: 1,
            tickCount: 10,
            attachedToDirectTarget: true,
            stacks: true,
            sourceUrl: "https://wiki.warframe.com/w/Torid",
        }),
    }),
    // Larkspur alt-fire's direct projectile impact and explosion are two
    // components of the same charged grenade release. Score one immediate
    // explosion against the directly struck target; other targets/area
    // coverage remain outside this single-target model.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Larkspur
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun": Object.freeze({
        "alt-fire projectile impact": Object.freeze({
            componentAttackName: "Explosion",
            firstTickDelaySeconds: 0,
            tickIntervalSeconds: 1,
            tickCount: 1,
            attachedToDirectTarget: true,
            stacks: true,
            sourceUrl: "https://wiki.warframe.com/w/Larkspur",
        }),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon": Object.freeze({
        "alt-fire projectile impact": Object.freeze({
            componentAttackName: "Explosion",
            firstTickDelaySeconds: 0,
            tickIntervalSeconds: 1,
            tickCount: 1,
            attachedToDirectTarget: true,
            stacks: true,
            sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime",
        }),
    }),
    // Mausolon's primary shot also creates one immediate radial hit on the
    // directly struck enemy. The component is separately catalogued and must
    // share the shot's modded damage/status profile while keeping its own AoE
    // classification and fixed one-hit projectile count.
    // Verified 2026-11-20: https://wiki.warframe.com/w/Mausolon
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun": Object.freeze({
        "auto": Object.freeze({
            componentAttackName: "Auto Radial Attack",
            firstTickDelaySeconds: 0,
            tickIntervalSeconds: 1,
            tickCount: 1,
            attachedToDirectTarget: true,
            stacks: true,
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
        }),
        // Charged Shot Laser and Explosion are components of one charged
        // alt-fire release in both the Archwing and Atmosphere profiles.
        "charged shot laser": Object.freeze({
            componentAttackName: "Charged Shot Explosion",
            firstTickDelaySeconds: 0,
            tickIntervalSeconds: 1,
            tickCount: 1,
            attachedToDirectTarget: true,
            stacks: true,
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
        }),
    }),
});

const VERIFIED_ATTACK_ATTACHED_TARGET_OVERRIDES: Readonly<Record<string, readonly string[]>> = Object.freeze({
    // The cloud attaches to the directly struck target; retain AoE classification
    // for radius and status rules while modeling that target's damage separately.
    "/Lotus/Weapons/ClanTech/Bio/BioWeapon": Object.freeze(["poison cloud"]),
});

/** Current Wiki-confirmed weapon modes whose event structure is outside the single-target damage model. */
const VERIFIED_ATTACK_MODEL_LIMITATIONS: Readonly<Record<
    string,
    Readonly<Record<string, WeaponAttackModelLimitation>>
>> = Object.freeze({
    // Larkspur's explosion is the linked component of its charged Alt-Fire.
    // Select the projectile impact row to score its full single-target release.
    // Verified 2026-11-21: https://wiki.warframe.com/w/Larkspur
    // https://wiki.warframe.com/w/Larkspur_Prime
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun": Object.freeze({
        "explosion": {
            sourceUrl: "https://wiki.warframe.com/w/Larkspur",
            reason: "This is the linked explosion component of Larkspur's charged Alt-Fire. Select Alt-Fire Projectile Impact to score the full single-target release.",
        },
        "alt-fire projectile impact": {
            sourceUrl: "https://wiki.warframe.com/w/Larkspur",
            reason: "Larkspur's charged projectile forces Knockdown, which can increase status-count damage bonuses on susceptible targets. The planner does not model Knockdown eligibility or its active window, so this attack remains reference-only and cannot be scored or Auto Optimized.",
        },
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon": Object.freeze({
        "explosion": {
            sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime",
            reason: "This is the linked explosion component of Larkspur Prime's charged Alt-Fire. Select Alt-Fire Projectile Impact to score the full single-target release.",
        },
        "alt-fire projectile impact": {
            sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime",
            reason: "Larkspur Prime's charged projectile forces Knockdown, which can increase status-count damage bonuses on susceptible targets. The planner does not model Knockdown eligibility or its active window, so this attack remains reference-only and cannot be scored or Auto Optimized. The Wiki page says its data is under active revision.",
        },
    }),
    // Alt-Fire launches a mite that can latch onto multiple enemies and apply
    // Impact/Magnetic damage and statuses over ten seconds. The Mercy-finisher
    // branch and delayed multi-target tick history cannot be represented by the
    // standard attack-row calculator or optimizer.
    // Verified 2026-11-17: https://wiki.warframe.com/w/Coda_Bassocyst
    "/Lotus/Weapons/Infested/InfestedLich/LongGuns/1999InfShotgun/1999InfShotgunWeapon": Object.freeze({
        "alt-fire": Object.freeze({
            sourceUrl: "https://wiki.warframe.com/w/Coda_Bassocyst",
            reason: "Alt-Fire launches a mite that can latch onto up to six enemies and applies Impact/Magnetic damage and status effects each second for 10 seconds; the Mercy-finisher branch and delayed multi-target tick history are not represented by the calculator.",
        }),
    }),
    "/Lotus/Weapons/ClanTech/Bio/BioWeapon": Object.freeze({
        "poison cloud": Object.freeze({
            sourceUrl: "https://wiki.warframe.com/w/Torid",
            reason: "Poison Cloud is a component of each Torid Grenade Impact, not a separate firing mode. Select Grenade Impact to evaluate the bounded single-target impact-plus-cloud sequence.",
        }),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun": Object.freeze({
        "auto radial attack": Object.freeze({
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
            reason: "Auto Radial Attack is a component of every Mausolon Auto shot, not an independent firing mode. Select Auto to score the bounded direct-hit-plus-radial sequence against one struck target.",
        }),
        "charged shot laser": Object.freeze({
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
            reason: "Charged Shot Laser and its linked explosion are components of one release. Mausolon's alternate fire also requires five primary-fire kills to charge, and more kills after each use; the planner does not track that history, so Auto Optimize cannot score a repeatable charged-shot cadence.",
        }),
        "charged shot explosion": Object.freeze({
            sourceUrl: "https://wiki.warframe.com/w/Mausolon",
            reason: "Charged Shot Explosion is a linked blast component of Mausolon's charged release, which also requires five primary-fire kills to charge and more kills after each use. Select Charged Shot Laser for a per-shot preview; Auto Optimize cannot score a repeatable charged-shot cadence.",
        }),
    }),
});

const VERIFIED_ATTACK_SCORE_BOUNDARY_NOTES: Readonly<
    Record<string, Readonly<Record<string, WeaponAttackScoreBoundaryNote>>>
> = Object.freeze({
    "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun": Object.freeze({
        "normal attack": Object.freeze({
            sourceUrl: "https://wiki.warframe.com/w/Larkspur",
            reason: "The score includes the documented 20%→100% beam damage ramp, but models only the directly hit target. Chained hits on up to three nearby enemies and automatic target-lock acquisition are not scored. The attack table lists 160m in Archwing, while the overview describes a 320m beam with a 160m lock-on limit; range is informational and misses are not modeled.",
        }),
    }),
    "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon": Object.freeze({
        "normal attack": Object.freeze({
            sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime",
            reason: "The score includes the documented 20%→100% beam damage ramp, but models only the directly hit target. Chained hits on up to three nearby enemies and automatic target-lock acquisition are not scored. The attack table lists 180m in Archwing while the overview says 320m; the page is under active revision and range is informational.",
        }),
    }),
});

/** Current Wiki-verified base multishot for attack rows whose fire modes differ. */
const VERIFIED_ATTACK_MULTISHOT_OVERRIDES: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
    // The upstream snapshot exposes the fully-spooled pellet count as the
    // weapon-level multishot value (and has stale values for Kohm/Kuva Kohm).
    // The Wiki lists one pellet for the Single Pellet row and 12/5 for each
    // Fully Spooled row. Keep attack-mode values explicit so both the
    // calculator and optimizer use the selected mode's actual pellet count.
    // Verified 2026-11-16:
    // https://wiki.warframe.com/w/Kohm
    // https://wiki.warframe.com/w/Kuva_Kohm
    // https://wiki.warframe.com/w/Kohmak
    // https://wiki.warframe.com/w/Twin_Kohmak
    "/Lotus/Weapons/Grineer/LongGuns/GrnSpark/GrnSparkRifle": Object.freeze({
        "single pellet": 1,
        "fully spooled": 12,
    }),
    "/Lotus/Weapons/Grineer/KuvaLich/LongGuns/Kohm/KuvaKohm": Object.freeze({
        "single pellet": 1,
        "fully spooled": 12,
    }),
    "/Lotus/Weapons/Grineer/Pistols/GrnKohmPistol/GrnKohmPistol": Object.freeze({
        "single pellet": 1,
        "fully spooled": 5,
    }),
    "/Lotus/Weapons/Grineer/Pistols/GrnDWUniques/GrnTwinKohmaks": Object.freeze({
        "single pellet": 1,
        "fully spooled": 5,
    }),
    // Vasto Incarnon attacks fire six pellets per each of six burst rounds.
    // Verified 2026-11-15: https://wiki.warframe.com/w/Vasto_Incarnon_Genesis
    "/Lotus/Weapons/Tenno/Pistol/RevolverPistol": Object.freeze({
        "incarnon form": 6,
    }),
    "/Lotus/Weapons/Tenno/Pistols/PrimeVasto/PrimeVastoPistol": Object.freeze({
        "incarnon form": 6,
    }),
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

/** Wiki-confirmed attack components that do not inherit multishot modifiers. */
const VERIFIED_ATTACK_MULTISHOT_LOCKED_OVERRIDES: Readonly<Record<string, readonly string[]>> = Object.freeze({
    // Primary-fire explosions do not receive multishot mods. The radial hit is
    // emitted once per Auto shot even when the direct projectile count rises.
    // Verified 2026-11-20: https://wiki.warframe.com/w/Mausolon
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun": Object.freeze([
        "auto radial attack",
    ]),
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
        if (UNSUPPORTED_AMP_WEAPON_UNIQUE_NAMES.has(String(item.uniqueName ?? ""))) continue;
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
                const ammoCostModelNote = VERIFIED_ATTACK_AMMO_COST_MODEL_NOTES[uniqueName]?.[attackName];
                const damageRamp = VERIFIED_ATTACK_DAMAGE_RAMP_OVERRIDES[uniqueName]?.[attackName];
                const damageFalloff = VERIFIED_ATTACK_DAMAGE_FALLOFF_OVERRIDES[uniqueName]?.[attackName];
                const maximumRange = VERIFIED_ATTACK_MAXIMUM_RANGE_OVERRIDES[uniqueName]?.[attackName];
                const modelLimitation = VERIFIED_ATTACK_MODEL_LIMITATIONS[uniqueName]?.[attackName];
                const scoreBoundaryNote = VERIFIED_ATTACK_SCORE_BOUNDARY_NOTES[uniqueName]?.[attackName];
                const lingeringDamageRule = VERIFIED_ATTACK_LINGERING_DAMAGE_OVERRIDES[uniqueName]?.[attackName];
                const appliesToAttachedTarget = VERIFIED_ATTACK_ATTACHED_TARGET_OVERRIDES[uniqueName]?.includes(attackName) ?? false;
                const sourceShotType = String(a.shot_type ?? "").trim().toLowerCase();
                const verifiedAreaClassification = VERIFIED_ATTACK_AREA_DAMAGE_OVERRIDES[uniqueName]?.[attackName];
                // On ordinary melee and Arch-Melee entries, "Normal Attack"
                // is the per-target weapon strike; cleaving multiple targets
                // does not turn it into a radial damage event for the Wiki's
                // direct-vs-AoE bonus rules. Explicit source and weapon-row
                // classifications above still take precedence.
                // Sources: https://wiki.warframe.com/w/Melee
                // https://wiki.warframe.com/w/Hit_Mechanic
                // https://wiki.warframe.com/w/Damage/Puncture_Damage
                const isOrdinaryMeleeNormalAttack =
                    (cat === "Melee" || cat === "Arch-Melee") && attackName === "normal attack";
                return {
                    name: String(a.name),
                    speed:          n(a.speed) || 1,
                    intrinsicDamagePerStatusBonus: intrinsicPerStatus?.bonus ?? 0,
                    intrinsicDamagePerStatusMode: intrinsicPerStatus?.mode ?? "additiveBase",
                    isAreaDamage: sourceShotType
                        ? sourceShotType === "aoe"
                        : verifiedAreaClassification ?? (isOrdinaryMeleeNormalAttack ? false : undefined),
                    critChance:    n(a.crit_chance) / 100,
                    critMultiplier: n(a.crit_mult) || 1.5,
                    statusChance:  n(a.status_chance) / 100,
                    multishot: VERIFIED_ATTACK_MULTISHOT_OVERRIDES[uniqueName]?.[attackName]
                        ?? (n(a.multishot) > 0 ? n(a.multishot) : undefined),
                    multishotLocked: VERIFIED_ATTACK_MULTISHOT_LOCKED_OVERRIDES[uniqueName]?.includes(attackName) ?? false,
                    ammoCostPerShot: VERIFIED_ATTACK_AMMO_COST_OVERRIDES[uniqueName]?.[attackName]
                        ?? (typeof a.ammo_cost === "number" ? a.ammo_cost : undefined),
                    ammoCostModelNote,
                    chargeAmmoPerSecond: ammoChargeRule?.ammoPerSecond,
                    chargeDamageBaseAmmoCost: ammoChargeRule?.damageBaseAmmoCost,
                    damageRamp,
                    ...(damageFalloff ? { damageFalloff } : {}),
                    ...(maximumRange ? {
                        maximumRangeMeters: maximumRange.meters,
                        maximumRangeBehavior: maximumRange.behavior,
                        maximumRangeSourceUrl: maximumRange.sourceUrl,
                    } : {}),
                    ...(modelLimitation ? { modelLimitation } : {}),
                    ...(scoreBoundaryNote ? { scoreBoundaryNote } : {}),
                    ...(lingeringDamageRule ? { lingeringDamageRule } : {}),
                    ...(appliesToAttachedTarget ? { appliesToAttachedTarget } : {}),
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
            const autoSpoolCadence = getAutoSpoolCadence(uniqueName, attack.name);
            const autoSpoolShotSequence = getAutoSpoolShotSequence(uniqueName, attack.name);
            const autoSpoolTimingLimitation = getAutoSpoolTimingLimitation(uniqueName, attack.name);
            const resolvedAttackTrigger = resolveAttackTrigger(uniqueName, attack.name, attackIndex, trigger);
            const isCodaBubonicoAutoAttack = uniqueName === "/Lotus/Weapons/Infested/InfestedLich/LongGuns/CodaBubonico/CodaBubonicoCannon" &&
                attack.name.trim().toLowerCase() === "auto";
            const attackTrigger = isCodaBubonicoAutoAttack
                ? resolvedAttackTrigger
                : autoSpoolCadence || autoSpoolShotSequence || autoSpoolTimingLimitation
                    ? "Auto-Spool"
                    : resolvedAttackTrigger;
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
                ...(autoSpoolCadence ? { autoSpoolCadence } : {}),
                ...(autoSpoolShotSequence ? { autoSpoolShotSequence } : {}),
                ...(autoSpoolTimingLimitation ? { autoSpoolTimingLimitation } : {}),
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
            trigger: firstAttack?.trigger === "Auto-Spool" ? "Auto-Spool" : trigger,
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

    // WFCD's Arch-Gun row represents Mausolon's Archwing profile. The Wiki
    // documents a distinct Heavy Weapon profile for atmospheric deployment.
    // Keep both selectable so the planner never silently substitutes one
    // context's damage values for the other.
    const mausolon = entries.find((entry) => entry.uniqueName ===
        "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun");
    if (mausolon) {
        mausolon.variantLabel = "Archwing";
        const atmosphereDamageByAttack: Readonly<Record<string, Partial<WeaponDamage>>> = {
            "Auto": { total: 180, impact: 35, puncture: 70, heat: 75 },
            "Auto Radial Attack": { total: 72, heat: 72 },
            "Charged Shot Laser": { total: 1500, impact: 150, puncture: 600, heat: 750 },
            "Charged Shot Explosion": { total: 4500, heat: 4500 },
        };
        const atmosphereDamage: WeaponDamage = {
            ...mausolon.damage,
            total: 180,
            impact: 35,
            puncture: 70,
            heat: 75,
        };
        entries.push({
            ...mausolon,
            uniqueName: `${mausolon.uniqueName}::Atmosphere`,
            sourceUniqueName: mausolon.uniqueName,
            variantLabel: "Atmosphere",
            damage: atmosphereDamage,
            attacks: mausolon.attacks.map((attack) => {
                const attackName = attack.name.trim().toLowerCase();
                const atmosphereFalloff = attackName === "auto radial attack" && attack.damageFalloff
                    ? { ...attack.damageFalloff, minimumDamageMultiplier: 0.8 }
                    : undefined;
                const damageFalloff = attackName === "auto" || attackName === "charged shot explosion"
                    ? undefined
                    : atmosphereFalloff ?? attack.damageFalloff;
                const damageOverride = atmosphereDamageByAttack[attack.name];
                if (!damageOverride) return { ...attack, damage: { ...attack.damage }, damageFalloff };
                const damage = { ...attack.damage, ...damageOverride };
                const damageTotal = [
                    damage.impact, damage.puncture, damage.slash, damage.heat, damage.cold,
                    damage.electricity, damage.toxin, damage.blast, damage.radiation,
                    damage.gas, damage.magnetic, damage.viral, damage.corrosive,
                    damage.void, damage.tau, damage.true,
                ].reduce((sum, value) => sum + value, 0);
                const maximumRangeBehavior = attackName === "auto"
                    ? "hardHitCap"
                    : attack.maximumRangeBehavior;
                return {
                    ...attack,
                    damage: { ...damage, total: damageTotal },
                    damageTotal,
                    damageFalloff,
                    ...(maximumRangeBehavior ? { maximumRangeBehavior } : {}),
                };
            }),
        });
    }

    // WFCD contains only the Archwing Larkspur rows. The Wiki gives each
    // Larkspur a separate deployed Heavy Weapon (Atmosphere) profile, so expose
    // that profile without replacing the Archwing damage, charge cadence, or
    // falloff data. Atmospheric rows keep the same Archgun mod family.
    const larkspurProfiles = [
        {
            uniqueName: "/Lotus/Weapons/Tenno/Archwing/Primary/TnShieldframeArchGun/TnShieldFrameArchGun",
            normalAttackRangeMeters: 40,
            chargedAttackRangeMeters: 100,
            sourceUrl: "https://wiki.warframe.com/w/Larkspur",
            normalAttackNote: "This score includes the documented 20%→100% beam damage ramp, but models only the directly hit target. Chained hits on up to three nearby enemies and automatic target-lock acquisition are not scored. The Wiki lists 40m for this Atmosphere profile; range is informational and out-of-range misses are not modeled.",
        },
        {
            uniqueName: "/Lotus/Weapons/Tenno/Archwing/Primary/PrimeLarkspur/PrimeLarkspurWeapon",
            normalAttackRangeMeters: 50,
            chargedAttackRangeMeters: 100,
            sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime",
            normalAttackNote: "This score includes the documented 20%→100% beam damage ramp, but models only the directly hit target. Chained hits on up to three nearby enemies and automatic target-lock acquisition are not scored. The Wiki table lists 50m for Atmosphere, while its overview says 40m; range is informational and out-of-range misses are not modeled. The Wiki page says its data is under active revision.",
        },
    ] as const;
    for (const profile of larkspurProfiles) {
        const larkspur = entries.find((entry) => entry.uniqueName === profile.uniqueName);
        if (!larkspur) continue;
        larkspur.variantLabel = "Archwing";
        const atmosphereDamageByAttack: Readonly<Record<string, Partial<WeaponDamage>>> = {
            "Normal Attack": { impact: 20, radiation: 160 },
            "Alt-Fire Projectile Impact": { impact: 280, blast: 360, radiation: 200 },
            "Explosion": { blast: 800, radiation: 800 },
        };
        const atmosphereDamage: WeaponDamage = {
            ...larkspur.damage,
            total: 180,
            impact: 20,
            radiation: 160,
        };
        const isPrime = larkspur.name === "Larkspur Prime";
        entries.push({
            ...larkspur,
            uniqueName: `${larkspur.uniqueName}::Atmosphere`,
            sourceUniqueName: larkspur.uniqueName,
            variantLabel: "Atmosphere",
            reloadTime: 2.5,
            damage: atmosphereDamage,
            attacks: larkspur.attacks.map((attack) => {
                const attackName = attack.name.trim().toLowerCase();
                const damageOverride = atmosphereDamageByAttack[attack.name];
                let damage = { ...attack.damage };
                let damageTotal = attack.damageTotal;
                if (damageOverride) {
                    damage = { ...damage, ...damageOverride };
                    damageTotal = [
                        damage.impact, damage.puncture, damage.slash, damage.heat, damage.cold,
                        damage.electricity, damage.toxin, damage.blast, damage.radiation,
                        damage.gas, damage.magnetic, damage.viral, damage.corrosive,
                        damage.void, damage.tau, damage.true,
                    ].reduce((sum, value) => sum + value, 0);
                    damage.total = damageTotal;
                }
                const maximumRangeMeters = attackName === "normal attack"
                    ? profile.normalAttackRangeMeters
                    : attackName === "alt-fire projectile impact"
                        ? profile.chargedAttackRangeMeters
                        : attack.maximumRangeMeters;
                const maximumRangeSourceUrl = attackName === "normal attack" || attackName === "alt-fire projectile impact"
                    ? profile.sourceUrl
                    : attack.maximumRangeSourceUrl;
                const forcedProcs = isPrime && attackName === "alt-fire projectile impact"
                    ? { ...(attack.forcedProcs ?? {}), impact: 1 }
                    : attack.forcedProcs;
                const scoreBoundaryNote = attackName === "normal attack"
                    ? { sourceUrl: profile.sourceUrl, reason: profile.normalAttackNote }
                    : attack.scoreBoundaryNote;
                return {
                    ...attack,
                    damage,
                    damageTotal,
                    ...(maximumRangeMeters !== undefined ? { maximumRangeMeters } : {}),
                    ...(maximumRangeSourceUrl ? { maximumRangeSourceUrl } : {}),
                    ...(forcedProcs ? { forcedProcs } : {}),
                    ...(scoreBoundaryNote ? { scoreBoundaryNote } : {}),
                };
            }),
        });
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

    entries.sort((a, b) => a.name.localeCompare(b.name) || (a.variantLabel ?? "").localeCompare(b.variantLabel ?? ""));
    _cache = entries;
    return entries;
}

export function getWeaponsByCategory(cat: WeaponCategory): WeaponEntry[] {
    return getWeaponCatalog().filter(w => w.category === cat);
}
