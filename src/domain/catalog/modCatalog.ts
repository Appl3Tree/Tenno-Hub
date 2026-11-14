// src/domain/catalog/modCatalog.ts
// Parses weapon mod data from All.json into structured ModEntry objects.
//
// Compat hierarchy:
//   Rifle        → all Rifle + Assault Rifle + PRIMARY (universal primary) mods
//   Sniper       → all Sniper + Rifle + Assault Rifle + PRIMARY mods
//   Shotgun      → all Shotgun + PRIMARY mods
//   Bow          → all Bow + PRIMARY mods
//   Pistol       → all Pistol mods
//   Melee        → all Melee mods
//
// Additionally, weapon-specific augments (e.g. compatName "Hek") are surfaced
// when the selected weapon's name matches the compat name.

import { emptyEffect } from "./modEffectUtils";
export { emptyEffect, getUnmodeledDamageEffectLines } from "./modEffectUtils";
import ALL_RAW from "../../data/_generated/warframe-items-all-lean.auto.json";
import MODS_RAW from "../../data/_generated/mods-lean.auto.json";
import OVERFRAME_MODS_RAW from "../../../external/overframe-gg/mods.json";
import { ITEMS_CATALOG } from "./itemsCatalog";
import {
    supportsStanceLikeMods,
    type ModCompatName,
    type WeaponEntry,
    type WeaponForcedProcDistribution,
    type WeaponForcedProcType,
} from "./weaponCatalog";

const ALL = ALL_RAW as Record<string, unknown>[];
const MODS_META = MODS_RAW as Record<string, {
    name?: string;
    path?: string;
    parent?: string;
    parents?: string[];
    data?: {
        CompatibilityTags?: string[];
        IncompatibilityTags?: string[];
        ItemCompatibility?: string;
    };
}>;
const OVERFRAME_MODS = OVERFRAME_MODS_RAW as Record<string, {
    name?: string;
    path?: string;
    data?: {
        ArtifactPolarity?: string;
        ItemCompatibility?: string;
    };
}>;

// Maps raw WFCD compatName → internal bucket key
const COMPAT_MAP: Record<string, string> = {
    "Rifle":          "Rifle",
    "Assault Rifle":  "Rifle",   // AR mods work on all rifles
    "Shotgun":        "Shotgun",
    "Pistol":         "Pistol",
    "Bow":            "Bow",
    "Sniper":         "Sniper",
    "Sniper Rifle":   "Sniper",
    "PRIMARY":        "Primary", // universal primary mods (Vigilante set, Hunter Munitions…)
    "Melee":          "Melee",
    "Archgun":        "Archgun",
    "Archmelee":      "Archmelee",
};

export interface ModEffect {
    damageBonus: number;
    /** Multiplicative weapon damage bonus for the first ammo-consuming shot after each magazine reload. */
    firstShotMagazineDamageBonus: number;
    /** Bonus damage on one hit of the final ammo-consuming shot in each eligible magazine. */
    lastShotMagazineDamageBonus: number;
    /** Permanent base armor removed by Shattering Impact on each qualifying melee hit. */
    shatteringImpactBaseArmorPerHit: number;
    impactBonus: number;
    punctureBonus: number;
    slashBonus: number;
    /** Additive base-damage bonus that applies only to a selected heavy attack. */
    heavyAttackDamageBonus: number;
    /** Multiplicative Slam Damage bonus for eligible named slam attacks. */
    slamAttackDamageBonus: number;
    heatBonus: number;
    coldBonus: number;
    electricityBonus: number;
    toxinBonus: number;
    blastBonus: number;
    gasBonus: number;
    magneticBonus: number;
    viralBonus: number;
    corrosiveBonus: number;
    radiationBonus: number;
    voidBonus: number;
    tauBonus: number;
    trueBonus: number;
    critChanceBonus: number;
    /** Additive critical chance that applies only to selected slide attacks. */
    slideAttackCritChanceBonus: number;
    /** Independent damage procs that trigger on a non-critical hit. `damageBonus` is additive, so 20 means 21x damage when triggered. */
    nonCriticalHitDamageProcs?: NonCriticalHitDamageProc[];
    /** Critical chance per combo tier above 1x (e.g. Blood Rush). */
    comboCritChanceBonus: number;
    finalCritChanceBonus: number;
    critMultBonus: number;
    finalCritMultiplierBonus: number;
    statusChanceBonus: number;
    /** Status chance per combo tier above 1x (e.g. Weeping Wounds). */
    comboStatusChanceBonus: number;
    multishotBonus: number;
    /** Unique damage bonus applied only to projectiles beyond the weapon's base multishot. */
    multishotDamageBonus: number;
    fireRateBonus: number;
    magazineBonus: number;
    reloadSpeedBonus: number;
    attackSpeedBonus: number;
    statusDurationBonus: number;
    statusDamageBonus: number;
    projectileSpeedBonus: number;
    accuracyBonus: number;
    blastRadiusBonus: number;
    beamRangeBonus: number;
    punchThrough: number;
    rangeBonus: number;
    headshotMultiplierBonus: number;
    weakPointDamageBonus: number;
    weakPointCritChanceBonus: number;
    comboDurationBonus: number;
    initialComboBonus: number;
    comboCountChanceBonus: number;
    heavyAttackEfficiencyBonus: number;
    heavyAttackWindUpBonus: number;
    lifeStealBonus: number;
    ammoEfficiencyBonus: number;
    directDamagePerStatusBonus: number;
    /** Condition Overload's additive melee Damage-bracket bonus per active status type. */
    conditionOverloadDamagePerStatusBonus: number;
    /** Extra proc rolls that only activate on a selected heavy attack at a combo threshold. */
    meleeComboTriggeredProcDistributions?: readonly (WeaponForcedProcDistribution & {
        minimumComboMultiplier: number;
    })[];
    perHitCritChanceBonus: number;
    nextMagazineStatusChancePerShot: number;
    nextMagazineMultishotPerShot: number;
    nextMagazineMaxStacks: number;
    finalStatusChanceBonus: number;
    /** Chance for an Impact status proc to also apply Magnetic. */
    impactStatusAppliesMagneticChance: number;
    /** Chance for an Impact status proc to also apply Slash. */
    impactStatusAppliesSlashChance: number;
    /** If impact-status conversion doubles below a given fire-rate threshold. */
    impactStatusExtraProcLowFireRateThreshold: number;
    /** Multiplier applied to impact-status conversion chance below the threshold. */
    impactStatusExtraProcLowFireRateMultiplier: number;
    /** Chance for a critical hit to also apply Slash. */
    critAppliesSlashChance: number;
    /** Separate per-hit chance to add a status proc, independent of damage weighting and scaled by Status Chance bonuses. */
    independentStatusProcChanceByType?: Partial<Record<WeaponForcedProcType, number>>;
    /**
     * AoE elemental status spread chance (0–1). On Electricity proc, spreads all elemental
     * melee status effects to enemies within aoeElementalStatusSpreadRadius metres.
     * (Melee Influence arcane mechanic.)
     */
    aoeElementalStatusSpreadChance: number;
    /** Radius in metres for aoeElementalStatusSpreadChance. */
    aoeElementalStatusSpreadRadius: number;
    conditionalEffects: ConditionalEffect[];
    /** Faction damage multiplier as a bonus fraction, e.g. 0.3 = ×1.3. 0 if not a faction mod. */
    factionDamageBonus: number;
    /** Which faction this mod targets, e.g. "Grineer". Empty string if not a faction mod. */
    targetFaction: string;
}

export interface NonCriticalHitDamageProc {
    chance: number;
    damageBonus: number;
}

const AMANATA_PRESSURE_PATH = "/Lotus/Weapons/Tenno/Melee/Polearms/Naginata/ShrineMaidenNaginataAugment";
const SHATTERING_IMPACT_PATH = "/Lotus/Upgrades/Mods/Melee/WeaponMeleeArmorShatterMod";
const MAIMING_STRIKE_PATH = "/Lotus/Upgrades/Mods/Melee/Event/SlideAttackCritChanceMod";
const PROTOTYPE_SHOCK_COILS_PATH = "/Lotus/Upgrades/Mods/Pistol/Event/Nightwave/NightwaveLasGooPistolAugmentMod";
const NAPALM_GRENADES_PATH = "/Lotus/Upgrades/Mods/Rifle/GrenadeLauncherProjectileMod";
const AMANATA_PRESSURE_STATUS_TYPES: readonly WeaponForcedProcType[] = [
    "impact", "puncture", "slash", "heat", "cold", "electricity", "toxin",
    "blast", "radiation", "gas", "magnetic", "viral", "corrosive",
];

export type ConditionalTrigger =
    | "onAbilityCast"
    | "whileAiming"
    | "whileAirborne"
    | "whileAimGliding"
    | "whileInvisible"
    | "onReload"
    | "onReloadFromEmpty"
    | "onKill"
    | "onHeadshot"
    | "onHeadshotKill"
    | "onHit"
    | "onNonCriticalNoStatusHit"
    | "onPunchThroughHit"
    | "onWeakPointHit"
    | "onWeakPointKill"
    | "onMeleeKill"
    | "onKillOrAssist"
    | "onConsecutiveThrow";

export interface ConditionalEffect {
    trigger: ConditionalTrigger;
    durationSeconds: number;
    requiresAiming: boolean;
    maxStacks: number;
    requiredStatusType?: "impact" | "puncture" | "slash" | "heat" | "cold" | "electricity" | "toxin" | "blast" | "radiation" | "gas" | "magnetic" | "viral" | "corrosive" | "void" | "tau" | "true";
    stats: Partial<Pick<
        ModEffect,
        | "damageBonus"
        | "critChanceBonus"
        | "finalCritChanceBonus"
        | "critMultBonus"
        | "finalCritMultiplierBonus"
        | "statusChanceBonus"
        | "finalStatusChanceBonus"
        | "multishotBonus"
        | "multishotDamageBonus"
        | "fireRateBonus"
        | "attackSpeedBonus"
        | "magazineBonus"
        | "reloadSpeedBonus"
        | "projectileSpeedBonus"
        | "beamRangeBonus"
        | "accuracyBonus"
        | "statusDamageBonus"
        | "punchThrough"
        | "headshotMultiplierBonus"
        | "weakPointDamageBonus"
        | "blastBonus"
        | "heatBonus"
        | "coldBonus"
        | "electricityBonus"
        | "toxinBonus"
        | "radiationBonus"
        | "magneticBonus"
        | "gasBonus"
        | "viralBonus"
        | "corrosiveBonus"
        | "voidBonus"
        | "tauBonus"
        | "trueBonus"
        | "ammoEfficiencyBonus"
        | "directDamagePerStatusBonus"
        | "initialComboBonus"
    >>;
}

export interface ModEntry {
    uniqueName: string;
    path: string;
    name: string;
    compatBucket: string;
    rawCompatName: string;
    polarity: string;
    rarity: string;
    drain: number;
    baseDrain: number;
    fusionLimit: number;
    statsLabel: string;
    /** Raw display text for each rank index 0..fusionLimit */
    statsTextByRank: string[];
    /** Source stat lines that none of the known effect parsers recognized, by rank. */
    unparsedStatsByRank?: string[][];
    /** Effects at each rank index 0..fusionLimit */
    effectsByRank: ModEffect[];
    /** Max-rank effect (= effectsByRank[fusionLimit]) */
    effect: ModEffect;
    hasDamageEffect: boolean;
    isAura: boolean;
    isExilus: boolean;
    isStance: boolean;
    incompatibilityGroup: string;
    compatibilityTags: string[];
    incompatibilityTags: string[];
    triggerRestriction?: string;
    itemCompatibilityPath?: string;
    /** PvPMods-path records enter PvE build pools only with a recorded PvE source. */
    isPveEligible?: boolean;
    isBuiltIn?: boolean;
}

// ---- Stat string parser ----

function stripColorTags(s: string): string {
    return s.replace(/<[^>]+>/g, "").trim();
}

function extractPercent(s: string): number | null {
    const m = s.match(/^([+-]?\d+(?:\.\d+)?)\s*%/);
    return m ? parseFloat(m[1]) / 100 : null;
}

function stripParens(s: string): string {
    return s.replace(/\s*\(.*\)$/, "").trim();
}

function normalizeStatDescriptor(rest: string): string {
    return rest
        .replace(/\bfor\s+\d+(?:\.\d+)?s\b\.?/ig, "")
        .replace(/\bstacks?\s+up\s+to\s+\d+x\b\.?/ig, "")
        .replace(/\s+/g, " ")
        .replace(/\s+\.\s*/g, " ")
        .trim();
}

const CONDITIONAL_STAT_KEYS: (keyof ConditionalEffect["stats"])[] = [
    "damageBonus", "critChanceBonus", "finalCritChanceBonus", "critMultBonus",
    "finalCritMultiplierBonus", "statusChanceBonus", "finalStatusChanceBonus",
    "multishotBonus", "multishotDamageBonus", "fireRateBonus", "attackSpeedBonus", "magazineBonus",
    "reloadSpeedBonus", "projectileSpeedBonus", "beamRangeBonus", "accuracyBonus",
    "statusDamageBonus", "punchThrough", "headshotMultiplierBonus", "weakPointDamageBonus",
    "blastBonus", "heatBonus", "coldBonus", "electricityBonus", "toxinBonus",
    "radiationBonus", "magneticBonus", "gasBonus", "viralBonus", "corrosiveBonus",
    "voidBonus", "tauBonus", "trueBonus", "ammoEfficiencyBonus", "directDamagePerStatusBonus", "initialComboBonus",
];

function extractConditionalStats(stats: Partial<ModEffect>): ConditionalEffect["stats"] {
    const extracted: ConditionalEffect["stats"] = {};
    for (const key of CONDITIONAL_STAT_KEYS) {
        const value = stats[key];
        if (typeof value === "number" && value !== 0) extracted[key] = value;
    }
    return extracted;
}

function explodeStatLines(raw: string): string[] {
    const clean = stripColorTags(raw).replace(/\\n/g, "\n");
    const lines = clean
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);

    const out: string[] = [];
    let currentTriggerPrefix = "";
    for (const line of lines) {
        if (/^On [^:]+:\s*$/i.test(line)) {
            currentTriggerPrefix = line;
            continue;
        }
        if (/^On [^:]+:/i.test(line)) {
            currentTriggerPrefix = line.replace(/^((On [^:]+:)).*$/i, "$1");
        }
        const contextualLine =
            currentTriggerPrefix && !/^On [^:]+:/i.test(line)
                ? `${currentTriggerPrefix} ${line}`
                : line;
        const triggerPrefixMatch = contextualLine.match(/^((?:On [^:]+:)\s*)(.+)$/i);
        const triggerPrefix = triggerPrefixMatch?.[1] ?? "";
        const triggerBody = triggerPrefixMatch?.[2] ?? contextualLine;
        const trailerMatch = line.match(/(\s+for\s+\d+(?:\.\d+)?s(?:\.\s*Stacks up to \d+x\.?)?|\.\s*Stacks up to \d+x\.?)$/i);
        const trailer = trailerMatch ? trailerMatch[1] : "";
        const base = trailer ? triggerBody.slice(0, -trailer.length).trim() : triggerBody;
        const parts = base.split(/\s+and\s+(?=[+-]?\d)/i).map(part => part.trim()).filter(Boolean);
        if (parts.length > 1) {
            for (const part of parts) out.push(`${triggerPrefix}${trailer ? `${part}${trailer}` : part}`.trim());
            continue;
        }
        out.push(`${triggerPrefix}${triggerBody}`.trim());
    }
    return out;
}

function parseTriggeredStatLine(raw: string): Partial<ModEffect> {
    const clean = stripColorTags(raw).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
    const match = clean.match(/^(On Ability Cast|On Reload From Empty|On Reload|On Headshot Kill|On Headshot|On Weak Point Kill|On Weak Point Hit|On Weak Point hits? with Primary Fire|On Melee Kill|On Kill or Assist|On Consecutive throw|On Hit|On Kill):\s*(.+)$/i);
    if (!match) return {};

    const triggerRaw = match[1].toLowerCase();
    const body = match[2].trim();
    const durationMatch = body.match(/\bfor\s+(\d+(?:\.\d+)?)s\b/i);
    const durationSeconds = durationMatch ? parseFloat(durationMatch[1]) : 0;
    const stackMatch = body.match(/\bstacks?\s+up\s+to\s+(\d+)x\b/i);
    const maxStacks = stackMatch ? Math.max(1, Number(stackMatch[1])) : 1;
    const requiresAiming = /\bwhen aiming\b|\bwhile aiming\b/i.test(body);
    const bodyForParsing = body
        .replace(/\bstacks?\s+up\s+to\s+\d+x\b\.?/ig, " ")
        .replace(/\s+for\s+\d+(?:\.\d+)?s\b\.?/ig, " ")
        .replace(/\s+(?:when|while)\s+aiming\b\.?/ig, " ")
        .replace(/[.]\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim();
    // These weapon augments apply one percentage to named damage types and
    // Status Chance; the generic parser cannot split this compound value.
    const compoundMatch = bodyForParsing.match(
        /^([+-]?\d+(?:\.\d+)?)%\s+(Gas|Viral and Magnetic) Damage and Status Chance$/i,
    );
    const compoundBonus = compoundMatch ? Number(compoundMatch[1]) / 100 : 0;
    const compoundStats: Partial<ModEffect> = compoundMatch
        ? compoundMatch[2].toLowerCase() === "gas"
            ? { gasBonus: compoundBonus, statusChanceBonus: compoundBonus }
            : { viralBonus: compoundBonus, magneticBonus: compoundBonus, statusChanceBonus: compoundBonus }
        : {};
    const stats = {
        ...parseStatLine(bodyForParsing, { applyStackMultiplier: false }),
        ...parseFlatNumericLine(bodyForParsing),
        ...compoundStats,
    };
    const extractedStats = extractConditionalStats(stats);
    if (Object.keys(extractedStats).length === 0) return {};

    let trigger: ConditionalTrigger | null = null;
    if (triggerRaw === "on ability cast") trigger = "onAbilityCast";
    else if (triggerRaw === "on reload") trigger = "onReload";
    else if (triggerRaw === "on reload from empty") trigger = "onReloadFromEmpty";
    else if (triggerRaw === "on kill") trigger = "onKill";
    else if (triggerRaw === "on headshot") trigger = "onHeadshot";
    else if (triggerRaw === "on headshot kill") trigger = "onHeadshotKill";
    else if (triggerRaw === "on hit") trigger = "onHit";
    else if (triggerRaw === "on weak point hit" || triggerRaw === "on weak point hits with primary fire") trigger = "onWeakPointHit";
    else if (triggerRaw === "on weak point kill") trigger = "onWeakPointKill";
    else if (triggerRaw === "on melee kill") trigger = "onMeleeKill";
    else if (triggerRaw === "on kill or assist") trigger = "onKillOrAssist";
    else if (triggerRaw === "on consecutive throw") trigger = "onConsecutiveThrow";
    if (!trigger) return {};

    return {
        conditionalEffects: [
            {
                trigger,
                durationSeconds,
                requiresAiming,
                maxStacks,
                stats: extractedStats,
            },
        ],
    };
}

function parseRampingLine(raw: string): Partial<ModEffect> {
    const clean = stripColorTags(raw).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();

    let match = clean.match(/^Each hit increases Critical Chance by ([+-]?\d+(?:\.\d+)?)%\.\s*Resets upon reloading or holstering\.?$/i);
    if (match) {
        return { perHitCritChanceBonus: parseFloat(match[1]) / 100 };
    }

    match = clean.match(/^On Reload:\s*Next Magazine has Status Chance and Multishot increased by ([+-]?\d+(?:\.\d+)?)% per shot landed with current Magazine\.\s*Max (\d+) stacks\.?$/i);
    if (match) {
        return {
            nextMagazineStatusChancePerShot: parseFloat(match[1]) / 100,
            nextMagazineMultishotPerShot: parseFloat(match[1]) / 100,
            nextMagazineMaxStacks: Number(match[2]),
        };
    }

    return {};
}

function parseComboScaledLine(raw: string): Partial<ModEffect> {
    const clean = stripColorTags(raw).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
    const match = clean.match(/^\+?(\d+(?:\.\d+)?)%\s*(Critical Chance|Status Chance)\s+(?:stacks with|per)\s+Combo Multiplier\.?$/i);
    if (!match) return {};
    const bonusPerTier = Number(match[1]) / 100;
    return match[2].toLowerCase() === "critical chance"
        ? { comboCritChanceBonus: bonusPerTier }
        : { comboStatusChanceBonus: bonusPerTier };
}

function parseStatLine(raw: string, options?: { applyStackMultiplier?: boolean }): Partial<ModEffect> {
    const clean = stripColorTags(raw);
    const stateCondition = clean.match(/\s+(while aim gliding|while airborne|while invisible|while aiming|when aiming)\s*\.?$/i);
    if (stateCondition?.index !== undefined) {
        const baseStats = parseStatLine(clean.slice(0, stateCondition.index).trim(), options);
        const conditionalStats = extractConditionalStats(baseStats);
        if (Object.keys(conditionalStats).length === 0) return {};
        const condition = stateCondition[1].toLowerCase();
        const trigger: ConditionalTrigger = condition === "while airborne"
            ? "whileAirborne"
            : condition === "while aim gliding"
                ? "whileAimGliding"
                : condition === "while invisible"
                    ? "whileInvisible"
                : "whileAiming";
        return {
            conditionalEffects: [{
                trigger,
                durationSeconds: 0,
                requiresAiming: false,
                maxStacks: 1,
                stats: conditionalStats,
            }],
        };
    }
    if (/^On [^:]+:/i.test(clean)) return {};
    // Skip activation-based conditions the optimizer can't model (e.g. "Hold Wall Latch for 2s
    // to gain +X%"). The "to gain" pattern uniquely identifies these; real passive stats never
    // use that phrasing.
    if (/\bto\s+gain\b/i.test(clean)) return {};
    // Skip continuation lines of multi-part activation conditions that arrive as a separate
    // stat string starting with "and +N" (e.g. " and +50% Status Chance for 20s.").
    // Processed "A and B" splits from explodeStatLines never start with "and".
    if (/^\s*and\s+[+-]?\d/i.test(clean)) return {};
    const stackMatch = clean.match(/stacks?\s+up\s+to\s+(\d+)x/i);
    const stackMult = options?.applyStackMultiplier === false
        ? 1
        : (stackMatch ? Math.max(1, Number(stackMatch[1])) : 1);
    const withoutPrefix = clean.replace(/^[^+-\d]*([+-]?\d)/, "$1");
    const value = extractPercent(withoutPrefix);
    // Entropy Burst and Napalm Grenades publish their additive final Status
    // Chance as percentage points without a % sign (+20 means +0.20 chance).
    const flatFinalStatusChance = withoutPrefix.match(/^([+-]?\d+(?:\.\d+)?)\s+Final Status Chance\.?$/i);
    if (value === null && !flatFinalStatusChance) return {};

    const scaled = (value ?? Number(flatFinalStatusChance![1]) / 100) * stackMult;
    const rest = flatFinalStatusChance
        ? "final status chance"
        : normalizeStatDescriptor(
            stripParens(withoutPrefix.replace(/^[+-]?\d+(?:\.\d+)?%\s*/, "").trim()).toLowerCase()
        );

    if (rest === "damage" || rest === "melee damage") return { damageBonus: scaled };
    if (rest === "critical chance and damage") {
        return { critChanceBonus: scaled, critMultBonus: scaled };
    }
    if (/^bonus damage on final shot\.?\s*requires magazine \d+ or higher\.?$/.test(rest)) {
        return { lastShotMagazineDamageBonus: scaled };
    }
    if (rest === "melee damage on heavy attack") return { heavyAttackDamageBonus: scaled };
    if (rest === "slam attack damage") return { slamAttackDamageBonus: scaled };
    if (rest === "damage on first shot in magazine") return { firstShotMagazineDamageBonus: scaled };
    if (rest === "melee damage per status type affecting the target") {
        return { conditionOverloadDamagePerStatusBonus: scaled };
    }
    if (rest === "direct damage per status type affecting the target") return { directDamagePerStatusBonus: scaled };
    if (rest === "critical chance") return { critChanceBonus: scaled };
    if (rest === "critical damage" || rest === "critical multiplier") return { critMultBonus: scaled };
    if (rest === "status chance") return { statusChanceBonus: scaled };
    if (rest === "multishot") return { multishotBonus: scaled };
    if (rest === "ammo efficiency") return { ammoEfficiencyBonus: scaled };
    if (rest.startsWith("fire rate") || rest.startsWith("fire/charge rate")) return { fireRateBonus: scaled };
    if (rest === "attack speed") return { attackSpeedBonus: scaled };
    if (rest === "magazine capacity" || rest === "clip size") return { magazineBonus: scaled };
    if (rest === "reload speed") return { reloadSpeedBonus: scaled };
    if (rest === "status duration") return { statusDurationBonus: scaled };
    if (rest === "status damage") return { statusDamageBonus: scaled };
    if (rest === "projectile speed") return { projectileSpeedBonus: scaled };
    if (rest === "accuracy") return { accuracyBonus: scaled };
    if (rest === "blast radius" || rest === "blast range") return { blastRadiusBonus: scaled };
    if (rest === "beam range") return { beamRangeBonus: scaled };
    if (rest === "heavy attack efficiency") return { heavyAttackEfficiencyBonus: scaled };
    if (rest === "heavy attack wind up speed") return { heavyAttackWindUpBonus: scaled };
    if (rest === "combo count chance" || rest === "additional combo count chance") return { comboCountChanceBonus: scaled };
    if (rest === "final status chance") return { finalStatusChanceBonus: scaled };
    if (rest.includes("headshot multiplier")) return { headshotMultiplierBonus: scaled };
    if (rest.includes("weak point damage")) return { weakPointDamageBonus: scaled };
    if (rest.includes("weak point critical chance")) return { weakPointCritChanceBonus: scaled };
    if (rest.includes("life steal")) return { lifeStealBonus: scaled };
    if (rest === "heat") return { heatBonus: scaled };
    if (rest === "cold") return { coldBonus: scaled };
    if (rest === "electricity") return { electricityBonus: scaled };
    if (rest === "toxin") return { toxinBonus: scaled };
    if (rest === "blast") return { blastBonus: scaled };
    if (rest === "gas") return { gasBonus: scaled };
    if (rest === "magnetic") return { magneticBonus: scaled };
    if (rest === "viral") return { viralBonus: scaled };
    if (rest === "corrosive") return { corrosiveBonus: scaled };
    if (rest === "radiation") return { radiationBonus: scaled };
    if (rest === "void") return { voidBonus: scaled };
    if (rest === "tau") return { tauBonus: scaled };
    if (rest === "true") return { trueBonus: scaled };
    if (rest === "impact") return { impactBonus: scaled };
    if (rest === "puncture") return { punctureBonus: scaled };
    if (rest === "slash") return { slashBonus: scaled };
    return {};
}

function parseConditionalStatusLine(raw: string): Partial<ModEffect> {
    const clean = stripColorTags(raw).replace(/\\n/g, " ").trim();

    let match = clean.match(/^Impact Status Effects have (\d+(?:\.\d+)?)% chance to apply a Magnetic Status Effect(?: \(x(\d+(?:\.\d+)?) when Fire Rate is below (\d+(?:\.\d+)?)\))?$/i);
    if (match) {
        return {
            impactStatusAppliesMagneticChance: parseFloat(match[1]) / 100,
            impactStatusExtraProcLowFireRateMultiplier: match[2] ? parseFloat(match[2]) : 1,
            impactStatusExtraProcLowFireRateThreshold: match[3] ? parseFloat(match[3]) : 0,
        };
    }

    match = clean.match(/^Impact Status Effects have (\d+(?:\.\d+)?)% chance to apply a Slash Status Effect(?: \(x(\d+(?:\.\d+)?) when Fire Rate is below (\d+(?:\.\d+)?)\))?$/i);
    if (match) {
        return {
            impactStatusAppliesSlashChance: parseFloat(match[1]) / 100,
            impactStatusExtraProcLowFireRateMultiplier: match[2] ? parseFloat(match[2]) : 1,
            impactStatusExtraProcLowFireRateThreshold: match[3] ? parseFloat(match[3]) : 0,
        };
    }

    match = clean.match(/^(\d+(?:\.\d+)?)% Chance to apply a Magnetic status effect when inflicting an Impact status effect$/i);
    if (match) {
        return {
            impactStatusAppliesMagneticChance: parseFloat(match[1]) / 100,
            impactStatusExtraProcLowFireRateMultiplier: 1,
            impactStatusExtraProcLowFireRateThreshold: 0,
        };
    }

    match = clean.match(/^\+?(\d+(?:\.\d+)?)% chance to apply .* on Critical$/i);
    if (match && /slash/i.test(clean)) {
        return { critAppliesSlashChance: parseFloat(match[1]) / 100 };
    }

    return {};
}

function parseFlatNumericLine(raw: string): Partial<ModEffect> {
    const clean = stripColorTags(raw).replace(/\\n/g, " ").trim();
    if (/^On [^:]+:/i.test(clean)) return {};
    let match = clean.match(/^\+?(\d+(?:\.\d+)?)\s*Punch Through$/i);
    if (match) return { punchThrough: parseFloat(match[1]) };

    match = clean.match(/^\+?(\d+(?:\.\d+)?)m\s*Beam Range$/i);
    if (match) return { beamRangeBonus: parseFloat(match[1]) / 12 };

    match = clean.match(/^\+?(\d+(?:\.\d+)?)\s*Range$/i);
    if (match) return { rangeBonus: parseFloat(match[1]) };

    match = clean.match(/^\+?(\d+(?:\.\d+)?)m\s*Beam Range$/i);
    if (match) return { beamRangeBonus: parseFloat(match[1]) / 12 };

    match = clean.match(/^\+?(\d+(?:\.\d+)?)s\s*Combo Duration$/i);
    if (match) return { comboDurationBonus: parseFloat(match[1]) };

    match = clean.match(/^\+?(\d+(?:\.\d+)?)\s*Initial Combo$/i);
    if (match) return { initialComboBonus: parseFloat(match[1]) };

    match = clean.match(/^Restores (\d+(?:\.\d+)?) Health per Status Type affecting the target$/i);
    if (match) return { lifeStealBonus: parseFloat(match[1]) / 100 };

    return {};
}

/** Parse faction damage lines like "x1.3 Damage to Grineer" → factionDamageBonus=0.3, targetFaction="Grineer" */
function parseFactionLine(raw: string): Partial<ModEffect> {
    const clean = stripColorTags(raw).trim();
    if (/^On [^:]+:/i.test(clean)) return {};
    const m = clean.match(/^x([\d.]+)\s+Damage\s+to\s+(.+)$/i);
    if (!m) return {};
    const multiplier = parseFloat(m[1]);
    if (!isFinite(multiplier) || multiplier <= 0) return {};
    return {
        factionDamageBonus: multiplier - 1,   // store as bonus fraction (e.g. 1.3 → 0.3)
        targetFaction: m[2].trim(),
    };
}

function mergeEffect(base: ModEffect, partial: Partial<ModEffect>): ModEffect {
    const out = { ...base };
    for (const k of Object.keys(partial) as (keyof ModEffect)[]) {
        if (k === "targetFaction") {
            // Keep the non-empty faction name
            const v = partial[k];
            if (v) out[k] = v;
        } else if (k === "independentStatusProcChanceByType") {
            const merged = { ...(out.independentStatusProcChanceByType ?? {}) };
            for (const [type, chance] of Object.entries(partial.independentStatusProcChanceByType ?? {}) as Array<[WeaponForcedProcType, number]>) {
                merged[type] = (merged[type] ?? 0) + chance;
            }
            out.independentStatusProcChanceByType = merged;
        } else if (k === "conditionalEffects") {
            out.conditionalEffects = [...(out.conditionalEffects ?? []), ...((partial.conditionalEffects ?? []) as ConditionalEffect[])];
        } else if (k === "impactStatusExtraProcLowFireRateThreshold" || k === "impactStatusExtraProcLowFireRateMultiplier") {
            (out[k] as number) = Math.max(((out[k] as number) ?? 0), ((partial[k] as number) ?? 0));
        } else {
            (out[k] as number) = ((out[k] as number) ?? 0) + ((partial[k] as number) ?? 0);
        }
    }
    return out;
}

function hasDamageEffect(e: ModEffect): boolean {
    return Object.entries(e).some(([k, v]) => {
        if (k === "targetFaction" || v == null || v === false) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "number") return Number.isFinite(v) && v !== 0;
        if (typeof v === "string") return v.length > 0;
        if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
        return Boolean(v);
    });
}

/** Detect trigger restriction from mod name (e.g. "Semi-Rifle Cannonade" → "Semi") */
function detectTriggerRestriction(name: string): string | undefined {
    if (/^semi-/i.test(name)) return "Semi";
    return undefined;
}

function matchesTriggerRestriction(weapon: WeaponEntry, restriction: string): boolean {
    if (restriction.toLowerCase() !== "semi") return weapon.trigger === restriction;

    const declaredModes = weapon.trigger.split(/[/|]/).map((mode) => mode.trim()).filter(Boolean);
    const attackModes = weapon.attacks.map((attack) => attack.trigger ?? weapon.trigger);
    const allModes = [...declaredModes, ...attackModes.flatMap((mode) => mode.split(/[/|]/).map((part) => part.trim()))]
        .filter(Boolean);
    return allModes.length > 0 && allModes.every((mode) => mode.toLowerCase() === restriction.toLowerCase());
}

interface ModCaches {
    /** Generic weapon-class mods, keyed by bucket (Rifle, Shotgun, Pistol, Bow, Sniper, Primary, Melee, Archgun, Archmelee) */
    byBucket: Map<string, ModEntry[]>;
    /**
     * Weapon-specific augments, keyed by the rawCompatName (weapon name).
     * e.g. "Hek" → [Scattered Justice, …]
     */
    byWeaponName: Map<string, ModEntry[]>;
    byStanceCompat: Map<string, ModEntry[]>;
    byFixedStanceWeapon: Map<string, ModEntry[]>;
}

let _caches: ModCaches | null = null;
let _modsMetaByPath: Map<string, {
    path: string;
    parent: string;
    parents: string[];
    compatibilityTags: string[];
    incompatibilityTags: string[];
    itemCompatibilityPath?: string;
}> | null = null;

const HIDDEN_INTERNAL_MOD_PATHS = new Set([
    "/Lotus/Upgrades/Mods/Melee/WeaponMeleeDamageOnHeavyKillMod",
]);

export function isHiddenModPath(path: string): boolean {
    return HIDDEN_INTERNAL_MOD_PATHS.has(path);
}

function isTrainingVariant(uniqueName: string): boolean {
    return /\/(beginner|intermediate|expert)\//i.test(uniqueName)
        || /(?:beginner|intermediate|expert)$/i.test(uniqueName);
}

/**
 * Some catalog paths expose a training variant and its standard counterpart
 * under different canonical parents. The game still treats those cards as
 * incompatible variants of one mod, so normalize their optimizer group using
 * their shared display identity and equipment bucket.
 */
export function normalizeTrainingVariantGroups(pool: ModEntry[]): ModEntry[] {
    const familyKey = (mod: ModEntry) => `${mod.compatBucket.toLowerCase()}||${mod.name.trim().toLowerCase()}`;
    const parentByGroup = new Map(pool.map((mod) => [mod.incompatibilityGroup, mod.incompatibilityGroup]));
    const find = (group: string): string => {
        const parent = parentByGroup.get(group) ?? group;
        if (parent === group) return group;
        const root = find(parent);
        parentByGroup.set(group, root);
        return root;
    };
    const union = (left: string, right: string) => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parentByGroup.set(rightRoot, leftRoot);
    };

    for (const trainingMod of pool) {
        if (!isTrainingVariant(trainingMod.path)) continue;
        const family = familyKey(trainingMod);
        for (const counterpart of pool) {
            if (familyKey(counterpart) !== family || isTrainingVariant(counterpart.path)) continue;
            union(trainingMod.incompatibilityGroup, counterpart.incompatibilityGroup);
        }
    }

    if ([...parentByGroup].every(([group, parent]) => group === parent)) return pool;
    return pool.map((mod) => ({ ...mod, incompatibilityGroup: find(mod.incompatibilityGroup) }));
}

function isPveEligibleMod(path: string, drops: unknown): boolean {
    if (!path.includes("/PvPMods/")) return true;

    // The item export stores both PvP-only and PvE-usable Conclave-origin mods
    // under PvPMods (for example Tactical Reload). Admit these records only if
    // the source data explicitly lists a non-Conclave acquisition location.
    // Missing/incomplete source lists fail closed until PvE eligibility is verified.
    return Array.isArray(drops) && drops.some((drop) => {
        if (!drop || typeof drop !== "object") return false;
        const location = (drop as { location?: unknown }).location;
        return typeof location === "string" && !/\bConclave\b/i.test(location);
    });
}

function normalizeVariantPath(path: string): string {
    return path
        .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
        .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function getVariantTier(path: string): "flawed" | "standard" | "expert" {
    if (/\/beginner\//i.test(path) || /Beginner$/i.test(path)) return "flawed";
    if (/\/expert\//i.test(path) || /Expert$/i.test(path)) return "expert";
    return "standard";
}

function getOptimizerVariantFamily(path: string): "flawed" | "standard" {
    return getVariantTier(path) === "flawed" ? "flawed" : "standard";
}

/**
 * Returns the expected canonical fusionLimit for a mod based on its name.
 * This mirrors the real card progression more closely than blindly preferring
 * the highest fusionLimit from All.json, which can otherwise pick expert
 * training variants (165%) over the actual standard mod (90%).
 */
function expectedFusionLimit(name: string): number {
    if (/^(Primed|Galvanized|Amalgam|Archon)\b/i.test(name)) return 10;
    if (/^Umbral\b/i.test(name)) return 10;
    if (/\b(Cannonade|Aptitude|Chamber|Acceleration|Barrage)\b/i.test(name)) return 10;
    if (/^Serration$/i.test(name)) return 10;
    return 5;
}

function dedupScore(item: Record<string, unknown>): number {
    const uniqueName = String(item.uniqueName ?? "");
    const name = String(item.name ?? "");
    const fl = Number(item.fusionLimit ?? 0);
    const trainingPenalty = isTrainingVariant(uniqueName) ? 1000 : 0;
    const expectedPenalty = Math.abs(fl - expectedFusionLimit(name)) * 10;
    return -trainingPenalty - expectedPenalty + fl;
}

function genericDedupKey(name: string, bucket: string, path: string): string {
    return `${name}||${bucket}||${getOptimizerVariantFamily(path)}||${normalizeVariantPath(path)}`;
}

function augmentDedupKey(name: string, rawCompat: string, path: string): string {
    return `${name}||${rawCompat}||${getOptimizerVariantFamily(path)}||${normalizeVariantPath(path)}`;
}

function getModsMetaByPath() {
    if (_modsMetaByPath) return _modsMetaByPath;
    const map = new Map<string, {
        path: string;
        parent: string;
        parents: string[];
        compatibilityTags: string[];
        incompatibilityTags: string[];
        itemCompatibilityPath?: string;
    }>();
    for (const value of Object.values(MODS_META)) {
        if (!value?.path) continue;
        map.set(value.path, {
            path: value.path,
            parent: value.parent ?? "",
            parents: Array.isArray(value.parents) ? value.parents : [],
            compatibilityTags: Array.isArray(value.data?.CompatibilityTags) ? value.data!.CompatibilityTags! : [],
            incompatibilityTags: Array.isArray(value.data?.IncompatibilityTags) ? value.data!.IncompatibilityTags! : [],
            itemCompatibilityPath: typeof value.data?.ItemCompatibility === "string" ? value.data.ItemCompatibility : undefined,
        });
    }
    _modsMetaByPath = map;
    return map;
}

function mapArtifactPolarityTag(tag: string | undefined): string {
    switch (tag) {
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

function resolveCanonicalParent(path: string): string {
    const meta = getModsMetaByPath().get(path);
    if (!meta) return path;
    const skip = new Set([
        "/Lotus/Types/Game/LotusArtifactUpgrades/BaseArtifactUpgrade",
        "/Lotus/Types/Game/LotusArtifactUpgrade",
    ]);
    const firstSpecificParent = meta.parents.find(parent => !skip.has(parent));
    return firstSpecificParent ?? meta.path;
}

function resolveIncompatibilityGroup(path: string): string {
    return normalizeVariantPath(resolveCanonicalParent(path));
}

function matchesHiddenTags(weapon: WeaponEntry, mod: ModEntry): boolean {
    const weaponTags = new Set(weapon.tags ?? []);
    for (const tag of mod.compatibilityTags) {
        if (!weaponTags.has(tag)) return false;
    }
    for (const tag of mod.incompatibilityTags) {
        if (weaponTags.has(tag)) return false;
    }
    return true;
}

/**
 * Training variants share the standard card's item restrictions, but the
 * generated item feed omits those restrictions on several Beginner,
 * Intermediate, and Expert records. Copy missing compatibility metadata from
 * the same-name standard card so a flawed variant cannot bypass the standard
 * card's compatibility rules.
 */
function inheritTrainingVariantCompatibility(byBucket: Map<string, ModEntry[]>): void {
    for (const mods of byBucket.values()) {
        const standardByName = new Map(
            mods
                .filter((mod) => !isTrainingVariant(mod.path))
                .map((mod) => [mod.name.trim().toLowerCase(), mod]),
        );
        for (const mod of mods) {
            if (!isTrainingVariant(mod.path)) continue;
            const standard = standardByName.get(mod.name.trim().toLowerCase());
            if (!standard) continue;

            mod.compatibilityTags = [...new Set([...mod.compatibilityTags, ...standard.compatibilityTags])];
            mod.incompatibilityTags = [...new Set([...mod.incompatibilityTags, ...standard.incompatibilityTags])];
            mod.itemCompatibilityPath ??= standard.itemCompatibilityPath;
        }
    }
}

/**
 * WFCD's weapon feed includes some weapons whose full ancestry is missing from
 * our lean items catalog. For those records, preserve the broad native class
 * restrictions carried by a mod's ItemCompatibility path instead of silently
 * dropping every standard mod in that family. Keep specialized subclasses
 * (such as assault-rifle-only mods) opt-in through explicit weapon tags.
 */
function matchesKnownWeaponFamilyPath(weapon: WeaponEntry, itemCompatibilityPath: string): boolean {
    switch (itemCompatibilityPath) {
        case "/Lotus/Weapons/Tenno/Rifle/LotusRifle":
            // Sniper and bow pools intentionally inherit ordinary rifle mods.
            return weapon.modCompat === "Rifle" || weapon.modCompat === "Sniper" || weapon.modCompat === "Bow";
        case "/Lotus/Weapons/Tenno/LotusLongGun":
            return weapon.category === "Primary";
        case "/Lotus/Weapons/Tenno/Shotgun/LotusShotgun":
            return weapon.category === "Primary" && weapon.modCompat === "Shotgun";
        case "/Lotus/Weapons/Tenno/Bows/LotusBow":
            return weapon.category === "Primary" && weapon.modCompat === "Bow";
        case "/Lotus/Weapons/Tenno/Rifle/LotusSniperRifle":
            return weapon.category === "Primary" && weapon.modCompat === "Sniper";
        case "/Lotus/Weapons/Tenno/Rifle/LotusAssaultRifle":
            return weapon.tags.includes("ASSAULT_RIFLE");
        case "/Lotus/Weapons/Tenno/Pistol/LotusPistol":
            return weapon.category === "Secondary" && weapon.modCompat === "Pistol";
        case "/Lotus/Types/Game/LotusWeapon":
            return weapon.category !== "Companion";
        default:
            return false;
    }
}

function weaponMatchesItemCompatibility(weapon: WeaponEntry, itemCompatibilityPath: string | undefined): boolean {
    if (!itemCompatibilityPath) return true;
    if (weapon.uniqueName === itemCompatibilityPath) return true;
    // WFCD's weapon records do not necessarily appear in the curated item
    // ancestry catalog. Generic player-melee compatibility still applies to
    // ordinary melee weapons when that ancestry is unavailable.
    if (
        itemCompatibilityPath === "/Lotus/Weapons/Tenno/Melee/PlayerMeleeWeapon" &&
        weapon.modCompat === "Melee" &&
        !weapon.tags.includes("BEAST_WEAPON")
    ) return true;
    const raw = ITEMS_CATALOG.byKey[weapon.uniqueName]?.raw as
        | {
            parent?: string;
            parents?: string[];
        }
        | undefined;
    if (!raw || (!raw.parent && !(raw.parents ?? []).length)) {
        return matchesKnownWeaponFamilyPath(weapon, itemCompatibilityPath);
    }
    if (raw?.parent === itemCompatibilityPath) return true;
    if ((raw?.parents ?? []).includes(itemCompatibilityPath)) return true;
    // Exalted weapons are catalogued under their Warframe power rather than
    // the normal weapon tree, but they use the mod class of their weapon type.
    return weapon.isExalted === true && matchesKnownWeaponFamilyPath(weapon, itemCompatibilityPath);
}

function beastCompatKeysForWeapon(weapon: WeaponEntry): string[] {
    if (!weapon.tags.includes("BEAST_WEAPON")) return [];
    const keys = ["Claws"];
    if (weapon.tags.includes("KAVAT_WEAPON")) keys.push("Kavat Claws");
    if (weapon.tags.includes("KUBROW_WEAPON")) keys.push("Kubrow Claws");
    if (weapon.tags.includes("HELMINTH_WEAPON")) keys.push("Helminth Claws");
    return keys;
}

function isBuiltInMeleeTree(meta: {
    path: string;
    parent: string;
    itemCompatibilityPath?: string;
}): boolean {
    if (meta.parent !== "/Lotus/Types/LotusMeleeTree/LotusMeleeTree") return false;
    if (!meta.itemCompatibilityPath) return false;
    if (meta.itemCompatibilityPath === "/Lotus/Weapons/Tenno/Melee/PlayerMeleeWeapon") return false;
    if (meta.path.startsWith("/Lotus/Types/Friendly/Pets/BeastWeapons/Stances/")) return false;
    return true;
}

function buildSyntheticBuiltInStance(meta: {
    path: string;
    parent: string;
    compatibilityTags: string[];
    incompatibilityTags: string[];
    itemCompatibilityPath?: string;
}): ModEntry | null {
    if (!isBuiltInMeleeTree(meta)) return null;

    const overframe = OVERFRAME_MODS[meta.path];
    const itemCompatibilityPath = overframe?.data?.ItemCompatibility ?? meta.itemCompatibilityPath;
    const name = overframe?.name ?? MODS_META[meta.path]?.name ?? "";
    if (!itemCompatibilityPath || !name) return null;

    return {
        uniqueName: meta.path,
        path: meta.path,
        name,
        compatBucket: "Stance",
        rawCompatName: name,
        polarity: mapArtifactPolarityTag(overframe?.data?.ArtifactPolarity),
        rarity: "",
        drain: 1,
        baseDrain: -2,
        fusionLimit: 3,
        statsLabel: "Built-in stance",
        statsTextByRank: ["Built-in stance"],
        effectsByRank: [emptyEffect()],
        effect: emptyEffect(),
        hasDamageEffect: false,
        isAura: false,
        isExilus: false,
        isStance: true,
        incompatibilityGroup: resolveIncompatibilityGroup(meta.path),
        compatibilityTags: meta.compatibilityTags,
        incompatibilityTags: meta.incompatibilityTags,
        triggerRestriction: undefined,
        itemCompatibilityPath,
        isBuiltIn: true,
    };
}

const MANUAL_BUILT_IN_STANCES: Array<{
    uniqueName: string;
    path: string;
    name: string;
    polarity: string;
    itemCompatibilityPath: string;
}> = [
    {
        uniqueName: "/Lotus/Weapons/Tenno/Melee/MeleeTrees/FairySwordMeleeTree",
        path: "/Lotus/Weapons/Tenno/Melee/MeleeTrees/FairySwordMeleeTree",
        name: "Razorwing",
        polarity: "zenurik",
        itemCompatibilityPath: "/Lotus/Powersuits/Fairy/BaseFlightSword",
    },
];

function buildManualBuiltInStance(meta: {
    uniqueName: string;
    path: string;
    name: string;
    polarity: string;
    itemCompatibilityPath: string;
}): ModEntry {
    return {
        uniqueName: meta.uniqueName,
        path: meta.path,
        name: meta.name,
        compatBucket: "Stance",
        rawCompatName: meta.name,
        polarity: meta.polarity,
        rarity: "",
        drain: 1,
        baseDrain: -2,
        fusionLimit: 3,
        statsLabel: "Built-in stance",
        statsTextByRank: ["Built-in stance"],
        effectsByRank: [emptyEffect()],
        effect: emptyEffect(),
        hasDamageEffect: false,
        isAura: false,
        isExilus: false,
        isStance: true,
        incompatibilityGroup: resolveIncompatibilityGroup(meta.path),
        compatibilityTags: [],
        incompatibilityTags: [],
        triggerRestriction: undefined,
        itemCompatibilityPath: meta.itemCompatibilityPath,
        isBuiltIn: true,
    };
}

function buildCaches(): ModCaches {
    // Deduplicate: keep the entry whose fusionLimit best matches the expected
    // canonical rank for that mod name. This prevents legacy fl=10 entries from
    // overriding real fl=5 standard mods (e.g. "Shotgun Barrage" 165% vs 90%).
    const bestGeneric = new Map<string, { item: Record<string, unknown>; fl: number; score: number }>();
    const bestAugment = new Map<string, { item: Record<string, unknown>; fl: number; score: number }>();

    for (const item of ALL) {
        if (item.category !== "Mods") continue;
        const rawCompat = String(item.compatName ?? "");
        const name = String(item.name ?? "");
        const fl = Number(item.fusionLimit ?? 0);
        const score = dedupScore(item);
        const isStance = String(item.type ?? "") === "Stance Mod" || String(item.type ?? "") === "Posture Mod";

        const bucket = COMPAT_MAP[rawCompat];
        if (bucket) {
            // Generic weapon-class mod
            const key = genericDedupKey(name, bucket, String(item.uniqueName ?? ""));
            const cur = bestGeneric.get(key);
            if (!cur || score > cur.score || (score === cur.score && fl > cur.fl)) {
                bestGeneric.set(key, { item, fl, score });
            }
        } else if (rawCompat && rawCompat.length >= 2 && rawCompat.length <= 30) {
            // Potential weapon-specific augment (compat name looks like a weapon name)
            // Stance mods also flow through here so they can be indexed by their stance family.
            // Exclude known non-weapon compats
            const skip = new Set(["ANY", "AURA", "BEAST", "COMPANION", "Archgun",
                "Archmelee", "Archwing", "Railjack", "Parazon", "Tome",
                "Assault Saw", "Gunblade", "Bayonet"]);
            if (isStance || (!skip.has(rawCompat) && !/^\s*[A-Z]+\s*$/.test(rawCompat))) {
                const key = augmentDedupKey(name, rawCompat, String(item.uniqueName ?? ""));
                const cur = bestAugment.get(key);
                const augScore = dedupScore(item);
                if (!cur || augScore > cur.score || (augScore === cur.score && fl > cur.fl)) {
                    bestAugment.set(key, { item: { ...item, _rawCompat: rawCompat }, fl, score: augScore });
                }
            }
        }
    }

    function parseEntry(item: Record<string, unknown>, bucket: string, rawCompat: string): ModEntry | null {
        const path = String(item.uniqueName ?? "");
        if (isHiddenModPath(path)) return null;
        const levelStats = item.levelStats as Array<{ stats: string[] }> | undefined;
        const fl = Number(item.fusionLimit ?? 0);
        const rawBaseDrain = Number(item.baseDrain ?? 2);
        const drain = rawBaseDrain + fl;
        const isAura = rawCompat === "AURA" || rawBaseDrain < 0;
        const isStance = String(item.type ?? "") === "Stance Mod" || String(item.type ?? "") === "Posture Mod";
        if ((!levelStats || levelStats.length === 0) && !isStance) return null;
        // Use the shared utility flag for weapon exilus mods, plus WFCD's native flag for Warframe exilus.
        const isWeaponUtility = !!item.isUtility && !isAura &&
            (bucket === "Rifle" || bucket === "Shotgun" || bucket === "Pistol" ||
             bucket === "Bow" || bucket === "Sniper" || bucket === "Primary" ||
             bucket === "Melee" || bucket === "Archgun" || bucket === "Archmelee" || bucket === "Augment");
        const isExilus = !!item.isExilus || isWeaponUtility;

        // Build effects at every rank 0..fusionLimit
        const parsedLevelStats = levelStats ?? [];
        const unparsedStatsByRank: string[][] = [];
        const effectsByRank: ModEffect[] = parsedLevelStats.map(ls => {
            let e = emptyEffect();
            const unparsedStats = new Set<string>();
            for (const rawStat of (ls.stats ?? [])) {
                for (const s of explodeStatLines(rawStat)) {
                    const parsedEffects = [
                        parseRampingLine(s),
                        parseComboScaledLine(s),
                        parseTriggeredStatLine(s),
                        parseStatLine(s),
                        parseFlatNumericLine(s),
                        parseConditionalStatusLine(s),
                        parseFactionLine(s),
                    ];
                    let recognized = false;
                    for (const partial of parsedEffects) {
                        if (Object.keys(partial).length > 0) recognized = true;
                        e = mergeEffect(e, partial);
                    }
                    if (!recognized) unparsedStats.add(s);
                }
            }
            unparsedStatsByRank.push([...unparsedStats]);
            return e;
        });
        if (path === SHATTERING_IMPACT_PATH) {
            parsedLevelStats.forEach((levelStat, rank) => {
                for (const rawStat of levelStat.stats ?? []) {
                    const text = stripColorTags(rawStat).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
                    const match = text.match(/^Impact Damage reduces enemy Armor by (\d+)\.?$/i);
                    if (!match || !effectsByRank[rank]) continue;
                    effectsByRank[rank].shatteringImpactBaseArmorPerHit = Number(match[1]);
                    unparsedStatsByRank[rank] = (unparsedStatsByRank[rank] ?? []).filter((line) =>
                        !/^Impact Damage reduces enemy Armor by \d+\.?$/i.test(line),
                    );
                    break;
                }
            });
        }
        if (path === MAIMING_STRIKE_PATH) {
            // Current Maiming Strike notes include normal and aerial slide
            // attacks plus heavy attacks initiated while sliding. This catalog
            // currently exposes the Telos Boltace Stormpath Slide Attack row.
            // https://wiki.warframe.com/w/Maiming_Strike
            parsedLevelStats.forEach((levelStat, rank) => {
                for (const rawStat of levelStat.stats ?? []) {
                    const text = stripColorTags(rawStat).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
                    const match = text.match(/^\+?(\d+(?:\.\d+)?)% Critical Chance for Slide Attack\.?$/i);
                    if (!match || !effectsByRank[rank]) continue;
                    effectsByRank[rank].slideAttackCritChanceBonus = Number(match[1]) / 100;
                    unparsedStatsByRank[rank] = (unparsedStatsByRank[rank] ?? []).filter((line) =>
                        stripColorTags(line).replace(/\\n/g, " ").replace(/\s+/g, " ").trim() !== text,
                    );
                    break;
                }
            });
        }
        if (path === NAPALM_GRENADES_PATH) {
            // The current Penta augment also converts its explosion to Heat and
            // leaves a damaging ground patch; those weapon-specific effects are
            // not represented by the selected attack rows. Keep its parsed flat
            // status bonus available for manual builds, but block auto-selection.
            // https://wiki.warframe.com/w/Napalm_Grenades
            for (let rank = 0; rank < unparsedStatsByRank.length; rank++) {
                unparsedStatsByRank[rank].push(
                    "Penta explosion damage conversion and lingering fire patch are not modeled.",
                );
            }
        }
        // The upstream plain-text export omits Hunter Munitions' linked Slash
        // type, leaving "chance to apply on Critical". The current Wiki confirms
        // that this independent chance applies Slash; recover the percentage
        // from each rank while scoping the repair to this exact catalog record.
        if (path.toLowerCase().endsWith("/primaryhuntermunitionsmod")) {
            parsedLevelStats.forEach((levelStat, rank) => {
                for (const rawStat of levelStat.stats ?? []) {
                    const text = stripColorTags(rawStat).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
                    const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*%\s*chance to apply\s+(?:slash\s+)?on critical\b/i);
                    if (match && effectsByRank[rank]) {
                        effectsByRank[rank].critAppliesSlashChance = Number(match[1]) / 100;
                        unparsedStatsByRank[rank] = (unparsedStatsByRank[rank] ?? []).filter((line) =>
                            !/chance to apply\s+(?:slash\s+)?on critical\b/i.test(line),
                        );
                        break;
                    }
                }
            });
        }
        if (path === PROTOTYPE_SHOCK_COILS_PATH) {
            parsedLevelStats.forEach((levelStat, rank) => {
                for (const rawStat of levelStat.stats ?? []) {
                    const text = stripColorTags(rawStat).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
                    const match = text.match(/^Adds \+?(\d+(?:\.\d+)?)% Electric damage, and shots have a (\d+(?:\.\d+)?)% base chance to apply extra Electric status independent of modded damage types\.?$/i);
                    if (!match || !effectsByRank[rank]) continue;
                    effectsByRank[rank].electricityBonus = Number(match[1]) / 100;
                    effectsByRank[rank].independentStatusProcChanceByType = { electricity: Number(match[2]) / 100 };
                    unparsedStatsByRank[rank] = (unparsedStatsByRank[rank] ?? []).filter((line) =>
                        stripColorTags(line).replace(/\\n/g, " ").replace(/\s+/g, " ").trim() !== text,
                    );
                    break;
                }
            });
        }
        if (effectsByRank.length === 0) effectsByRank.push(emptyEffect());
        // Pad up to fusionLimit if levelStats has fewer entries
        while (effectsByRank.length <= fl) {
            effectsByRank.push(effectsByRank[effectsByRank.length - 1] ?? emptyEffect());
        }
        if (path === AMANATA_PRESSURE_PATH) {
            // Verified 2026-11-13: the Wiki excludes Void/Tau from Amanata Pressure's
            // random status pool. PC Hotfix 44.1.4 fixed Heavy Slam coverage and
            // multi-enemy hits. The current DPS/finite-encounter model holds combo static.
            // https://wiki.warframe.com/w/Amanata_Pressure
            // https://www.warframe.com/en/patch-notes/pc/44-1-4
            const procDistribution = {
                minimumComboMultiplier: 8,
                count: 1,
                mode: "uniform" as const,
                types: AMANATA_PRESSURE_STATUS_TYPES,
            };
            for (const rankEffect of effectsByRank) {
                rankEffect.meleeComboTriggeredProcDistributions = [procDistribution];
            }
        }
        const effect = effectsByRank[fl] ?? emptyEffect();

        const statsTextByRank = parsedLevelStats.map(ls =>
            (ls.stats ?? [])
                .map(s => stripColorTags(s).replace(/\\n/g, " ").trim())
                .filter(Boolean)
                .join("  ·  ")
        );
        // Keep the repaired damage type visible everywhere the source stat is
        // presented, including the picker and equipped-mod summary.
        if (path.toLowerCase().endsWith("/primaryhuntermunitionsmod")) {
            for (let rank = 0; rank < statsTextByRank.length; rank++) {
                statsTextByRank[rank] = statsTextByRank[rank].replace(
                    /chance to apply\s+on Critical\b/i,
                    "chance to apply Slash on Critical",
                );
            }
        }
        if (statsTextByRank.length === 0) {
            for (let i = 0; i <= fl; i++) statsTextByRank.push("Stance Mod");
        }
        const statsLabel = statsTextByRank[fl] ?? statsTextByRank[statsTextByRank.length - 1] ?? (isStance ? "Stance Mod" : "");

        const name = String(item.name ?? "");
        const meta = getModsMetaByPath().get(path);

        return {
            uniqueName: String(item.uniqueName ?? ""),
            path,
            name,
            compatBucket: bucket,
            rawCompatName: rawCompat,
            polarity: String(item.polarity ?? ""),
            rarity: String(item.rarity ?? ""),
            drain,
            baseDrain: rawBaseDrain,
            fusionLimit: fl,
            statsLabel,
            statsTextByRank,
            unparsedStatsByRank,
            effectsByRank,
            effect,
            hasDamageEffect: hasDamageEffect(effect),
            isAura,
            isExilus,
            isStance,
            incompatibilityGroup: resolveIncompatibilityGroup(path),
            compatibilityTags: meta?.compatibilityTags ?? [],
            incompatibilityTags: meta?.incompatibilityTags ?? [],
            triggerRestriction: detectTriggerRestriction(name),
            itemCompatibilityPath: meta?.itemCompatibilityPath,
            isPveEligible: isPveEligibleMod(path, item.drops),
        };
    }

    const byBucket = new Map<string, ModEntry[]>();
    const byWeaponName = new Map<string, ModEntry[]>();
    const byStanceCompat = new Map<string, ModEntry[]>();
    const byFixedStanceWeapon = new Map<string, ModEntry[]>();

    for (const { item } of bestGeneric.values()) {
        const rawCompat = String(item.compatName ?? "");
        const bucket = COMPAT_MAP[rawCompat];
        if (!bucket) continue;
        const entry = parseEntry(item, bucket, rawCompat);
        if (!entry) continue;
        if (!byBucket.has(bucket)) byBucket.set(bucket, []);
        byBucket.get(bucket)!.push(entry);
    }

    for (const { item } of bestAugment.values()) {
        const rawCompat = String((item._rawCompat as string | undefined) ?? item.compatName ?? "");
        const isStance = String(item.type ?? "") === "Stance Mod" || String(item.type ?? "") === "Posture Mod";
        const entry = parseEntry(item, isStance ? "Stance" : "Augment", rawCompat);
        if (!entry) continue;
        if (isStance) {
            if (!byStanceCompat.has(rawCompat)) byStanceCompat.set(rawCompat, []);
            byStanceCompat.get(rawCompat)!.push(entry);
            continue;
        }
        if (!byWeaponName.has(rawCompat)) byWeaponName.set(rawCompat, []);
        byWeaponName.get(rawCompat)!.push(entry);
    }

    for (const meta of getModsMetaByPath().values()) {
        const entry = buildSyntheticBuiltInStance(meta);
        if (!entry?.itemCompatibilityPath) continue;
        if (!byFixedStanceWeapon.has(entry.itemCompatibilityPath)) byFixedStanceWeapon.set(entry.itemCompatibilityPath, []);
        const existing = byFixedStanceWeapon.get(entry.itemCompatibilityPath)!;
        if (existing.some((mod) => mod.uniqueName === entry.uniqueName)) continue;
        existing.push(entry);
    }

    for (const manual of MANUAL_BUILT_IN_STANCES) {
        if (!byFixedStanceWeapon.has(manual.itemCompatibilityPath)) byFixedStanceWeapon.set(manual.itemCompatibilityPath, []);
        const existing = byFixedStanceWeapon.get(manual.itemCompatibilityPath)!;
        if (existing.some((mod) => mod.uniqueName === manual.uniqueName)) continue;
        existing.push(buildManualBuiltInStance(manual));
    }

    inheritTrainingVariantCompatibility(byBucket);
    inheritTrainingVariantCompatibility(byWeaponName);

    // Sort each list alphabetically
    for (const list of byBucket.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    for (const list of byWeaponName.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    for (const list of byStanceCompat.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    for (const list of byFixedStanceWeapon.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    return { byBucket, byWeaponName, byStanceCompat, byFixedStanceWeapon };
}

function getCaches(): ModCaches {
    if (!_caches) _caches = buildCaches();
    return _caches;
}

// ---- Public API ----

/**
 * Returns the buckets to search for a given weapon modCompat, in priority order.
 * e.g. "Sniper" weapons also accept Rifle and Primary mods.
 */
function bucketsForCompat(compat: ModCompatName): string[] {
    switch (compat) {
        case "Sniper":   return ["Sniper", "Rifle", "Primary"];
        case "Rifle":    return ["Rifle", "Primary"];
        case "Shotgun":  return ["Shotgun", "Primary"];
        // Bows accept Bow-specific mods, all Rifle mods, and universal Primary mods
        case "Bow":      return ["Bow", "Rifle", "Primary"];
        case "Pistol":   return ["Pistol"];
        case "Melee":    return ["Melee"];
        case "Archgun":  return ["Archgun"];
        case "Archmelee":return ["Archmelee"];
    }
}

/**
 * Get all mods compatible with a weapon's modCompat category (no trigger filtering,
 * no weapon-specific augments).  Useful for generic mod browsing.
 */
export function getModsForCompat(compat: ModCompatName): ModEntry[] {
    const { byBucket } = getCaches();
    const seen = new Set<string>();
    const out: ModEntry[] = [];
    for (const bucket of bucketsForCompat(compat)) {
        for (const m of byBucket.get(bucket) ?? []) {
            if (!seen.has(m.uniqueName)) { seen.add(m.uniqueName); out.push(m); }
        }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all mods valid for a specific weapon instance:
 * - Generic compat mods for the weapon's class
 * - Trigger-restriction filtering (e.g. Cannonade only on Semi weapons)
 * - Weapon-specific augments (e.g. Scattered Justice on Hek/Vaykor Hek)
 */
export function getModsForWeapon(weapon: WeaponEntry): ModEntry[] {
    const { byWeaponName } = getCaches();
    const beastCompatKeys = beastCompatKeysForWeapon(weapon);
    const baseMods = beastCompatKeys.length > 0
        ? beastCompatKeys.flatMap((key) => byWeaponName.get(key) ?? [])
        : getModsForCompat(weapon.modCompat);

    // Apply trigger restriction
    const seen = new Set<string>();
    const filtered = baseMods.filter(m =>
        (!seen.has(m.uniqueName) ? (seen.add(m.uniqueName), true) : false) &&
        m.isPveEligible !== false &&
        weaponMatchesItemCompatibility(weapon, m.itemCompatibilityPath) &&
        (!m.triggerRestriction || matchesTriggerRestriction(weapon, m.triggerRestriction)) &&
        matchesHiddenTags(weapon, m)
    );

    // Add weapon-specific augments where compat name is a substring of weapon name
    // (handles "Hek" matching both "Hek" and "Vaykor Hek")
    const weaponNameLower = weapon.name.toLowerCase();
    const augments: ModEntry[] = [];
    const augSeen = new Set(filtered.map(m => m.uniqueName));

    for (const [compatKey, mods] of byWeaponName.entries()) {
        const compatLower = compatKey.toLowerCase();
        // Only match when the weapon's name CONTAINS the compat name — not the reverse.
        // e.g. "Vaykor Hek" correctly sees "Hek" augments because "vaykor hek".includes("hek").
        // The reverse `compatLower.includes(weaponNameLower)` was wrong: it caused "Soma" to see
        // "Soma Prime"-exclusive mods because "soma prime".includes("soma") is true.
        if (weaponNameLower.includes(compatLower)) {
            for (const m of mods) {
                if (m.isPveEligible === false) continue;
                if (!weaponMatchesItemCompatibility(weapon, m.itemCompatibilityPath)) continue;
                if (!augSeen.has(m.uniqueName) && matchesHiddenTags(weapon, m)) {
                    augSeen.add(m.uniqueName);
                    augments.push(m);
                }
            }
        }
    }

    const out = [...filtered];
    if (augments.length > 0) out.push(...augments.sort((a, b) => a.name.localeCompare(b.name)));
    return normalizeTrainingVariantGroups(out);
}

/**
 * The Mod Builder presents only one version of an expert-path mod when the same
 * mod is also available through a non-expert path. Keep this filtering in the
 * catalog layer so UI optimization and offline benchmark pools stay identical.
 */
export function filterBuilderExpertVariants(pool: ModEntry[]): ModEntry[] {
    const isExpertPath = (path: string): boolean => /\/expert\//i.test(path) || /Expert$/i.test(path);
    return pool.filter((entry) =>
        !isExpertPath(entry.path) || !pool.some((candidate) =>
            candidate.name === entry.name && !isExpertPath(candidate.path),
        ),
    );
}

/**
 * Keep regular mods ahead of their Flawed versions in builder-facing lists.
 * This is a display-only copy; optimizer candidate order and catalog data stay unchanged.
 */
export function sortBuilderModsForDisplay(pool: ModEntry[]): ModEntry[] {
    const isFlawed = (path: string) => /\/beginner\//i.test(path) || /Beginner$/i.test(path);

    return [...pool].sort((left, right) => {
        const baseNameOrder = left.name.localeCompare(right.name);
        if (baseNameOrder !== 0) return baseNameOrder;

        const flawedOrder = Number(isFlawed(left.path)) - Number(isFlawed(right.path));
        return flawedOrder || left.name.localeCompare(right.name);
    });
}

export function getStancesForWeapon(weapon: WeaponEntry): ModEntry[] {
    if (!supportsStanceLikeMods(weapon)) return [];
    const { byStanceCompat, byFixedStanceWeapon } = getCaches();
    const fixedStances = [...byFixedStanceWeapon.entries()]
        .filter(([itemCompatibilityPath]) => weaponMatchesItemCompatibility(weapon, itemCompatibilityPath))
        .flatMap(([, mods]) => mods)
        .filter((mod) => mod.isPveEligible !== false && weaponMatchesItemCompatibility(weapon, mod.itemCompatibilityPath) && matchesHiddenTags(weapon, mod));
    if (fixedStances.length > 0) {
        return normalizeTrainingVariantGroups(fixedStances.sort((a, b) => a.name.localeCompare(b.name)));
    }
    const stanceClasses = weapon.stanceClasses?.length
        ? weapon.stanceClasses
        : weapon.stanceClass
            ? [weapon.stanceClass]
            : [];
    if (stanceClasses.length === 0) return [];

    const seen = new Set<string>();
    const out: ModEntry[] = [];
    for (const stanceClass of stanceClasses) {
        for (const mod of byStanceCompat.get(stanceClass) ?? []) {
            if (mod.isPveEligible === false) continue;
            if (weapon.tags.includes("BEAST_WEAPON")) {
                if (!mod.path.includes("/BeastWeapons/Stances/")) continue;
                if (!weaponMatchesItemCompatibility(weapon, mod.itemCompatibilityPath)) continue;
            }
            if (seen.has(mod.uniqueName)) continue;
            seen.add(mod.uniqueName);
            out.push(mod);
        }
    }
    return normalizeTrainingVariantGroups(out.sort((a, b) => a.name.localeCompare(b.name)));
}
