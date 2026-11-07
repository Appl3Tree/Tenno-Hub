import type { ModEffect, ModEntry } from "./catalog/modCatalog";
import { emptyEffect } from "./catalog/modCatalog";
import type { WeaponCategory, WeaponEntry } from "./catalog/weaponCatalog";

export type CustomRivenStatUnit = "percent" | "multiplier" | "meters" | "seconds" | "flat";

export interface CustomRivenStatDef {
    key: string;
    label: string;
    unit: CustomRivenStatUnit;
    compat: Array<WeaponCategory | "Any">;
    prefix: string;
    suffix: string;
    canBeNegative: boolean;
    isDisplayOnly?: boolean;
    aliases?: string[];
    apply(effect: ModEffect, normalizedValue: number): ModEffect;
}

export interface CustomRivenStatValue {
    stat: string;
    value: number;
}

export interface CustomRivenRecord {
    id: string;
    name: string;
    sourceWeaponUniqueName: string;
    sourceWeaponName: string;
    sourceWeaponDisposition: number;
    familyKey: string;
    polarity: string;
    drain: number;
    stats: CustomRivenStatValue[];
    createdAtIso: string;
    updatedAtIso: string;
    importSource?: "alecaframe";
    importStatus?: "ready" | "rank-unknown" | "weapon-unknown" | "unsupported-stat";
    sourceRank?: number | null;
    masteryRankRequired?: number | null;
    rerolls?: number | null;
    sourceAttributes?: Array<{ tag: string; roll: number; polarity: "positive" | "negative" }>;
}

function addPercent(
    key: keyof Pick<
        ModEffect,
        | "damageBonus"
        | "impactBonus"
        | "punctureBonus"
        | "slashBonus"
        | "heatBonus"
        | "coldBonus"
        | "electricityBonus"
        | "toxinBonus"
        | "critChanceBonus"
        | "critMultBonus"
        | "statusChanceBonus"
        | "multishotBonus"
        | "fireRateBonus"
        | "magazineBonus"
        | "reloadSpeedBonus"
        | "attackSpeedBonus"
        | "statusDurationBonus"
        | "projectileSpeedBonus"
        | "comboCountChanceBonus"
        | "heavyAttackEfficiencyBonus"
    >,
): CustomRivenStatDef["apply"] {
    return (effect, normalizedValue) => ({ ...effect, [key]: effect[key] + normalizedValue });
}

function addFlat(
    key: keyof Pick<ModEffect, "punchThrough" | "rangeBonus" | "comboDurationBonus" | "initialComboBonus">,
): CustomRivenStatDef["apply"] {
    return (effect, normalizedValue) => ({ ...effect, [key]: effect[key] + normalizedValue });
}

const noopApply: CustomRivenStatDef["apply"] = (effect) => effect;

export const CUSTOM_RIVEN_STAT_DEFS: CustomRivenStatDef[] = [
    {
        key: "additionalComboCountChance",
        label: "Additional Combo Count Chance",
        unit: "percent",
        compat: ["Melee"],
        prefix: "Laci",
        suffix: "Nus",
        canBeNegative: true,
        aliases: ["comboCountChanceBonus"],
        apply: addPercent("comboCountChanceBonus"),
    },
    {
        key: "ammoMaximum",
        label: "Ammo Maximum",
        unit: "percent",
        compat: ["Primary", "Secondary"],
        prefix: "Ampi",
        suffix: "Bin",
        canBeNegative: true,
        isDisplayOnly: true,
        apply: noopApply,
    },
    {
        key: "damageVsCorpus",
        label: "Damage to Corpus",
        unit: "multiplier",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Manti",
        suffix: "Tron",
        canBeNegative: true,
        aliases: ["factionCorpus"],
        apply: (effect, normalizedValue) => ({ ...effect, factionDamageBonus: normalizedValue - 1, targetFaction: "Corpus" }),
    },
    {
        key: "damageVsGrineer",
        label: "Damage to Grineer",
        unit: "multiplier",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Argi",
        suffix: "Con",
        canBeNegative: true,
        aliases: ["factionGrineer"],
        apply: (effect, normalizedValue) => ({ ...effect, factionDamageBonus: normalizedValue - 1, targetFaction: "Grineer" }),
    },
    {
        key: "damageVsInfested",
        label: "Damage to Infested",
        unit: "multiplier",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Pura",
        suffix: "Ada",
        canBeNegative: true,
        aliases: ["factionInfested"],
        apply: (effect, normalizedValue) => ({ ...effect, factionDamageBonus: normalizedValue - 1, targetFaction: "Infested" }),
    },
    {
        key: "coldDamage",
        label: "Cold Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Geli",
        suffix: "Do",
        canBeNegative: false,
        aliases: ["coldBonus"],
        apply: addPercent("coldBonus"),
    },
    {
        key: "comboDuration",
        label: "Combo Duration",
        unit: "seconds",
        compat: ["Melee"],
        prefix: "Tempi",
        suffix: "Nem",
        canBeNegative: true,
        aliases: ["comboDurationBonus"],
        apply: addFlat("comboDurationBonus"),
    },
    {
        key: "criticalChance",
        label: "Critical Chance",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Crita",
        suffix: "Cron",
        canBeNegative: true,
        aliases: ["critChanceBonus"],
        apply: addPercent("critChanceBonus"),
    },
    {
        key: "criticalChanceSlideAttack",
        label: "Critical Chance for Slide Attack",
        unit: "percent",
        compat: ["Melee"],
        prefix: "Pleci",
        suffix: "Nent",
        canBeNegative: true,
        isDisplayOnly: true,
        apply: noopApply,
    },
    {
        key: "criticalDamage",
        label: "Critical Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Acri",
        suffix: "Tis",
        canBeNegative: true,
        aliases: ["critMultBonus"],
        apply: addPercent("critMultBonus"),
    },
    {
        key: "damage",
        label: "Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Visi",
        suffix: "Ata",
        canBeNegative: true,
        aliases: ["damageBonus"],
        apply: addPercent("damageBonus"),
    },
    {
        key: "electricityDamage",
        label: "Electricity Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Vexi",
        suffix: "Tio",
        canBeNegative: false,
        aliases: ["electricityBonus"],
        apply: addPercent("electricityBonus"),
    },
    {
        key: "heatDamage",
        label: "Heat Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Igni",
        suffix: "Pha",
        canBeNegative: false,
        aliases: ["heatBonus"],
        apply: addPercent("heatBonus"),
    },
    {
        key: "finisherDamage",
        label: "Finisher Damage",
        unit: "percent",
        compat: ["Melee"],
        prefix: "Exi",
        suffix: "Cta",
        canBeNegative: true,
        isDisplayOnly: true,
        apply: noopApply,
    },
    {
        key: "fireRateAttackSpeed",
        label: "Fire Rate / Attack Speed",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Croni",
        suffix: "Dra",
        canBeNegative: true,
        aliases: ["fireRateBonus", "attackSpeedBonus"],
        apply: (effect, normalizedValue) => ({
            ...effect,
            fireRateBonus: effect.fireRateBonus + normalizedValue,
            attackSpeedBonus: effect.attackSpeedBonus + normalizedValue,
        }),
    },
    {
        key: "projectileSpeed",
        label: "Projectile Speed",
        unit: "percent",
        compat: ["Primary", "Secondary"],
        prefix: "Conci",
        suffix: "Nak",
        canBeNegative: true,
        aliases: ["projectileSpeedBonus"],
        apply: addPercent("projectileSpeedBonus"),
    },
    {
        key: "initialCombo",
        label: "Initial Combo",
        unit: "flat",
        compat: ["Melee"],
        prefix: "Para",
        suffix: "Um",
        canBeNegative: true,
        aliases: ["initialComboBonus"],
        apply: addFlat("initialComboBonus"),
    },
    {
        key: "impactDamage",
        label: "Impact Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Magna",
        suffix: "Ton",
        canBeNegative: true,
        aliases: ["impactBonus"],
        apply: addPercent("impactBonus"),
    },
    {
        key: "magazineCapacity",
        label: "Magazine Capacity",
        unit: "percent",
        compat: ["Primary", "Secondary"],
        prefix: "Arma",
        suffix: "Tin",
        canBeNegative: true,
        aliases: ["magazineBonus"],
        apply: addPercent("magazineBonus"),
    },
    {
        key: "heavyAttackEfficiency",
        label: "Heavy Attack Efficiency",
        unit: "percent",
        compat: ["Melee"],
        prefix: "Forti",
        suffix: "Us",
        canBeNegative: true,
        aliases: ["heavyAttackEfficiencyBonus"],
        apply: addPercent("heavyAttackEfficiencyBonus"),
    },
    {
        key: "comboEfficiency",
        label: "Combo Efficiency",
        unit: "percent",
        compat: ["Melee"],
        prefix: "Forti",
        suffix: "Us",
        canBeNegative: true,
        isDisplayOnly: true,
        apply: noopApply,
    },
    {
        key: "comboPointsOnHit",
        label: "Combo Points on Hit",
        unit: "percent",
        compat: ["Melee"],
        prefix: "",
        suffix: "",
        canBeNegative: true,
        isDisplayOnly: true,
        apply: noopApply,
    },
    {
        key: "multishot",
        label: "Multishot",
        unit: "percent",
        compat: ["Primary", "Secondary"],
        prefix: "Sati",
        suffix: "Can",
        canBeNegative: true,
        aliases: ["multishotBonus"],
        apply: addPercent("multishotBonus"),
    },
    {
        key: "toxinDamage",
        label: "Toxin Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Toxi",
        suffix: "Tox",
        canBeNegative: false,
        aliases: ["toxinBonus"],
        apply: addPercent("toxinBonus"),
    },
    {
        key: "punchThrough",
        label: "Punch Through",
        unit: "meters",
        compat: ["Primary", "Secondary"],
        prefix: "Lexi",
        suffix: "Nok",
        canBeNegative: false,
        apply: addFlat("punchThrough"),
    },
    {
        key: "punctureDamage",
        label: "Puncture Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Insi",
        suffix: "Cak",
        canBeNegative: true,
        aliases: ["punctureBonus"],
        apply: addPercent("punctureBonus"),
    },
    {
        key: "reloadSpeed",
        label: "Reload Speed",
        unit: "percent",
        compat: ["Primary", "Secondary"],
        prefix: "Feva",
        suffix: "Tak",
        canBeNegative: true,
        aliases: ["reloadSpeedBonus"],
        apply: addPercent("reloadSpeedBonus"),
    },
    {
        key: "range",
        label: "Range",
        unit: "meters",
        compat: ["Melee"],
        prefix: "Locti",
        suffix: "Tor",
        canBeNegative: true,
        aliases: ["rangeBonus"],
        apply: addFlat("rangeBonus"),
    },
    {
        key: "slashDamage",
        label: "Slash Damage",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Sci",
        suffix: "Sus",
        canBeNegative: true,
        aliases: ["slashBonus"],
        apply: addPercent("slashBonus"),
    },
    {
        key: "statusChance",
        label: "Status Chance",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Hexa",
        suffix: "Dex",
        canBeNegative: true,
        aliases: ["statusChanceBonus"],
        apply: addPercent("statusChanceBonus"),
    },
    {
        key: "statusDuration",
        label: "Status Duration",
        unit: "percent",
        compat: ["Primary", "Secondary", "Melee"],
        prefix: "Deci",
        suffix: "Des",
        canBeNegative: true,
        aliases: ["statusDurationBonus"],
        apply: addPercent("statusDurationBonus"),
    },
    {
        key: "weaponRecoil",
        label: "Weapon Recoil",
        unit: "percent",
        compat: ["Primary", "Secondary"],
        prefix: "Zeti",
        suffix: "Mag",
        canBeNegative: true,
        isDisplayOnly: true,
        apply: noopApply,
    },
    {
        key: "zoom",
        label: "Zoom",
        unit: "percent",
        compat: ["Primary", "Secondary"],
        prefix: "Hera",
        suffix: "Lis",
        canBeNegative: true,
        isDisplayOnly: true,
        apply: noopApply,
    },
];

const CUSTOM_RIVEN_STAT_DEF_BY_KEY = new Map<string, CustomRivenStatDef>();
for (const definition of CUSTOM_RIVEN_STAT_DEFS) {
    CUSTOM_RIVEN_STAT_DEF_BY_KEY.set(definition.key, definition);
    for (const alias of definition.aliases ?? []) CUSTOM_RIVEN_STAT_DEF_BY_KEY.set(alias, definition);
}

const VARIANT_PREFIXES = [
    "kuva ",
    "tenet ",
    "coda ",
    "prisma ",
    "sancti ",
    "rakta ",
    "secura ",
    "synoid ",
    "telos ",
    "vaykor ",
    "mara ",
    "mk1-",
    "mk1 ",
    "dex ",
];

const VARIANT_SUFFIXES = [
    " prime",
    " wraith",
    " vandal",
    " prisma",
    " dex",
    " sancti",
    " rakta",
    " telos",
    " synoid",
    " secura",
    " vaykor",
    " mara",
];

export function normalizeRivenWeaponFamilyKey(name: string): string {
    let normalized = name.trim().toLowerCase();
    for (const prefix of VARIANT_PREFIXES) {
        if (normalized.startsWith(prefix)) {
            normalized = normalized.slice(prefix.length);
            break;
        }
    }
    let changed = true;
    while (changed) {
        changed = false;
        for (const suffix of VARIANT_SUFFIXES) {
            if (normalized.endsWith(suffix)) {
                normalized = normalized.slice(0, -suffix.length);
                changed = true;
                break;
            }
        }
    }
    return normalized.replace(/\s+/g, " ").trim();
}

export function getCustomRivenStatDef(statKey: string): CustomRivenStatDef | null {
    return CUSTOM_RIVEN_STAT_DEF_BY_KEY.get(statKey) ?? null;
}

export function customRivenSupportsWeapon(record: CustomRivenRecord, weapon: WeaponEntry): boolean {
    if (weapon.isExalted || weapon.disposition <= 0) return false;
    return record.familyKey === normalizeRivenWeaponFamilyKey(weapon.name);
}

export function formatRivenStatValue(definition: CustomRivenStatDef, value: number): string {
    const sign = value > 0 ? "+" : "";
    if (definition.unit === "percent") return `${sign}${value.toFixed(1)}% ${definition.label}`;
    if (definition.unit === "multiplier") return `x${value.toFixed(2)} ${definition.label}`;
    if (definition.unit === "meters") return `${sign}${value.toFixed(2)}m ${definition.label}`;
    if (definition.unit === "seconds") return `${sign}${value.toFixed(2)}s ${definition.label}`;
    return `${sign}${value.toFixed(1)} ${definition.label}`;
}

export function generateCustomRivenName(weaponName: string, stats: CustomRivenStatValue[]): string {
    const ranked = stats
        .map((stat) => ({ stat, definition: getCustomRivenStatDef(stat.stat) }))
        .filter((entry): entry is { stat: CustomRivenStatValue; definition: CustomRivenStatDef } => Boolean(entry.definition) && entry.stat.value !== 0)
        .sort((a, b) => Math.abs(b.stat.value) - Math.abs(a.stat.value) || a.definition.label.localeCompare(b.definition.label));

    if (ranked.length === 0) return `${weaponName} Riven`;
    if (ranked.length === 1) {
        return `${weaponName} ${ranked[0].definition.prefix}${ranked[0].definition.suffix.toLowerCase()}`;
    }
    if (ranked.length === 2) {
        return `${weaponName} ${ranked[0].definition.prefix}${ranked[1].definition.suffix.toLowerCase()}`;
    }
    return `${weaponName} ${ranked[0].definition.prefix}-${ranked[1].definition.prefix.toLowerCase()}${ranked[ranked.length - 1].definition.suffix.toLowerCase()}`;
}

export function scaleCustomRivenStats(record: CustomRivenRecord, targetWeapon: WeaponEntry): CustomRivenStatValue[] {
    const baseDisposition = record.sourceWeaponDisposition > 0 ? record.sourceWeaponDisposition : 1;
    const ratio = targetWeapon.disposition > 0 ? targetWeapon.disposition / baseDisposition : 1;
    return record.stats.map((stat) => ({
        ...stat,
        value: (() => {
            const definition = getCustomRivenStatDef(stat.stat);
            const precision = definition?.unit === "multiplier" ? 100 : 10;
            return Math.round(stat.value * ratio * precision) / precision;
        })(),
    }));
}

export function buildCustomRivenEntry(record: CustomRivenRecord, targetWeapon: WeaponEntry): ModEntry {
    const scaledStats = scaleCustomRivenStats(record, targetWeapon).filter((stat) => stat.value !== 0);
    const effectByRank: ModEffect[] = [];
    const statsTextByRank: string[] = [];
    for (let rank = 0; rank <= 8; rank++) {
        const rankMultiplier = (rank + 1) / 9;
        let effect = emptyEffect();
        const statText: string[] = [];
        for (const stat of scaledStats) {
            const definition = getCustomRivenStatDef(stat.stat);
            if (!definition) continue;
            const precision = definition.unit === "multiplier" ? 100 : 10;
            const scaledValue = Math.round(stat.value * rankMultiplier * precision) / precision;
            const normalizedValue = definition.unit === "percent" ? scaledValue / 100 : scaledValue;
            effect = definition.apply(effect, normalizedValue);
            statText.push(formatRivenStatValue(definition, scaledValue));
        }
        effectByRank.push(effect);
        statsTextByRank.push(statText.join("  ·  "));
    }

    return {
        uniqueName: `__riven_inventory_${record.id}`,
        path: `__riven_inventory_${record.id}`,
        name: record.name,
        compatBucket: "Riven",
        rawCompatName: "Riven",
        polarity: record.polarity,
        rarity: "Legendary",
        drain: record.drain,
        baseDrain: record.drain - 8,
        fusionLimit: 8,
        statsLabel: statsTextByRank[8] ?? "",
        statsTextByRank,
        effectsByRank: effectByRank,
        effect: effectByRank[8] ?? emptyEffect(),
        hasDamageEffect: true,
        isAura: false,
        isExilus: false,
        isStance: false,
        incompatibilityGroup: "__riven__",
        compatibilityTags: [],
        incompatibilityTags: [],
    };
}

export function getCustomRivenStatDefsForWeapon(weapon: WeaponEntry | null): CustomRivenStatDef[] {
    if (!weapon) return CUSTOM_RIVEN_STAT_DEFS;
    const compatCategory: WeaponCategory =
        weapon.modCompat === "Melee" || weapon.modCompat === "Archmelee"
            ? "Melee"
            : weapon.modCompat === "Pistol"
                ? "Secondary"
                : "Primary";
    return CUSTOM_RIVEN_STAT_DEFS.filter(
        (definition) =>
            definition.compat.includes("Any") ||
            definition.compat.includes(compatCategory),
    );
}
