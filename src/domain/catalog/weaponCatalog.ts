// src/domain/catalog/weaponCatalog.ts
// Weapon data catalog built from All.json for the mod builder.

import ALL_RAW from "../../data/_generated/warframe-items-all-lean.auto.json";
import OVERFRAME_ITEMS_RAW from "../../../external/overframe-gg/items.json";
import { ITEMS_CATALOG } from "./itemsCatalog";

const ALL = ALL_RAW as Record<string, unknown>[];
const OVERFRAME_ITEMS = OVERFRAME_ITEMS_RAW as Record<string, Record<string, unknown>>;

export type WeaponCategory = "Primary" | "Secondary" | "Melee" | "Arch-Gun" | "Arch-Melee" | "Companion";
export type ModCompatName = "Rifle" | "Sniper" | "Shotgun" | "Pistol" | "Bow" | "Melee" | "Archgun" | "Archmelee";

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
    polarities: string[];
    canOverLevel: boolean;
    baseSlotCount: number;
    /**
     * Riven disposition (omegaAttenuation in WFCD). Range 0.5–1.55.
     * Used to calculate max possible riven stat values.
     */
    disposition: number;
    /** All named attacks from the WFCD data */
    attacks: WeaponAttack[];
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
    /** Selected attack context carried into calculator/optimizer scoring. */
    selectedAttackName?: string;
    /** True when the selected attack is part of the weapon's Incarnon form. */
    selectedAttackIsIncarnon?: boolean;
}

export function isGroundMeleeCategory(category: WeaponCategory): boolean {
    return category === "Melee";
}

export function usesMeleeDamageModel(category: WeaponCategory): boolean {
    return category === "Melee" || category === "Arch-Melee";
}

export function supportsStanceMods(category: WeaponCategory): boolean {
    return category === "Melee";
}

export function supportsStanceLikeMods(weapon: Pick<WeaponEntry, "category" | "tags"> | null | undefined): boolean {
    if (!weapon) return false;
    return weapon.category === "Melee" || (weapon.category === "Companion" && weapon.tags.includes("BEAST_WEAPON"));
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

    // WFCD sometimes emits supplementary Incarnon-mode attacks like "Auto Radial Attack"
    // without the word "Incarnon" in the name. Those attacks are grouped after the first
    // explicit Incarnon-form entry in the same attack list, so treat them as Incarnon scope.
    return selectedAttackIdx >= firstIncarnonIdx;
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
        .filter((a): a is Record<string, unknown> =>
            typeof a === "object" && a !== null && typeof (a as any).charge_time === "number"
        )
        .map(a => (a as any).charge_time as number);

    if (withCT.length === 0) return null;

    // Use the minimum charge time — this represents the fastest viable charged shot
    // (e.g. Nataruk's Perfect Shot at 0.7s vs Charged Shot at 1.0s)
    return Math.min(...withCT);
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
        const rawAttacks = Array.isArray(item.attacks) ? item.attacks as Record<string, unknown>[] : [];

        // Parse named attacks — only keep those with distinct names (skip unnamed / single attacks)
        const parsedAttacks: WeaponAttack[] = rawAttacks
            .filter(a => typeof a.name === "string" && a.name.length > 0 && typeof a.damage === "object" && a.damage)
            .map(a => {
                const attackDmg = parseDamageRecord(a.damage);
                return {
                    name: String(a.name),
                    speed:          n(a.speed) || 1,
                    critChance:    n(a.crit_chance) / 100,
                    critMultiplier: n(a.crit_mult) || 1.5,
                    statusChance:  n(a.status_chance) / 100,
                    chargeTime:    typeof a.charge_time === "number" ? a.charge_time : undefined,
                    damage: attackDmg,
                    damageTotal: attackDmg.total,
                };
            });
        const dmg = parseDamageRecord(item.damage ?? parsedAttacks[0]?.damage);
        if (!dmg.total && parsedAttacks.length === 0) continue;

        const name = String(item.name);
        const uniqueName = String(item.uniqueName ?? "");
        const hasExplicitMagazineSize = Object.prototype.hasOwnProperty.call(item, "magazineSize");
        const rawPolarities = Array.isArray(item.polarities)
            ? (item.polarities as unknown[]).map(p => String(p))
            : inferMainPolaritiesFromItems(uniqueName);

        const stanceClasses = inferStanceClasses(item, exaltedType);
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
            fireRate:      n(item.fireRate) || 1,
            // Bows typically behave like single-shot magazines with effectively no reload animation
            // between shots; use 1 when the source data does not report a magazine size.
            magazineSize:  n(item.magazineSize) || 1,
            ammoCostPerShot: Math.max(0.0001, n((item as any).ammoCost) || 1),
            hasExplicitMagazineSize,
            reloadTime:    n(item.reloadTime),
            multishot:     n(item.multishot) || 1,
            trigger,
            chargeTime:    resolveChargeTime(trigger, rawAttacks),
            polarities:    rawPolarities,
            canOverLevel:  isOverLevelWeapon(name, uniqueName),
            baseSlotCount: 8,
            disposition:   Number(item.omegaAttenuation ?? 1.0),
            attacks:       parsedAttacks,
            isExalted:     exaltedType,
            stancePolarity: typeof item.stancePolarity === "string" ? String(item.stancePolarity) : undefined,
            stanceClass: stanceClasses[0],
            stanceClasses,
            tags: inferWeaponTags(item, exaltedType),
            isProgenitorWeapon: isProgenitorWeapon(name, uniqueName),
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
