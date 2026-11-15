import INCARNON_RAW from "../../data/_generated/incarnon-evolutions.auto.json";
import { selectedAttackUsesIncarnonForm, type WeaponAttack, type WeaponDamage, type WeaponEntry } from "./weaponCatalog";
import { emptyEffect, type ConditionalEffect, type ModEffect, type NonCriticalHitDamageProc } from "./modCatalog";

export type IncarnonTier = 1 | 2 | 3 | 4 | 5;
export type IncarnonAttackScope = "all" | "normal" | "incarnon";

type RawIncarnonOption = {
    id: string;
    name: string;
    descriptionLines: string[];
    notes: string[];
};

type RawIncarnonTier = {
    tier: number;
    options: RawIncarnonOption[];
};

type RawIncarnonRecord = {
    weaponName: string;
    familyName: string;
    sourcePage: string;
    kind: "genesis" | "native";
    tiers: RawIncarnonTier[];
};

type ScopedWeaponAdjustment = {
    scope: IncarnonAttackScope;
    baseDamageFlat?: number;
    critChanceFlat?: number;
    critMultiplierFlat?: number;
    slideCritMultiplierOverride?: number;
    statusChanceFlat?: number;
    magazineSizeFlat?: number;
};

type ScopedEffect = {
    scope: IncarnonAttackScope;
    effect: ModEffect;
};

export interface IncarnonOptionModel {
    adjustments: ScopedWeaponAdjustment[];
    effects: ScopedEffect[];
    unsupportedLines: string[];
    modeledLineCount: number;
}

export interface IncarnonOption {
    id: string;
    name: string;
    descriptionLines: string[];
    notes: string[];
    model: IncarnonOptionModel;
}

export interface IncarnonTierEntry {
    tier: IncarnonTier;
    options: IncarnonOption[];
}

export interface IncarnonWeaponRecord {
    weaponName: string;
    familyName: string;
    sourcePage: string;
    kind: "genesis" | "native";
    /** Wiki-listed maximum separate ammunition for one fully charged ranged form. */
    incarnonAmmoCapacity?: number;
    wikiUrl: string;
    tiers: IncarnonTierEntry[];
}

export interface IncarnonBuildConfig {
    unlockedTier: number;
    selectedOptionsByTier: Partial<Record<IncarnonTier, string>>;
}

export type IncarnonCandidateConfig = IncarnonBuildConfig;

export interface IncarnonScoredCandidate {
    signature: string;
    score: number;
    path?: Partial<Record<IncarnonTier, string>>;
}

export interface ResolvedIncarnonState {
    record: IncarnonWeaponRecord | null;
    appliedOptions: IncarnonOption[];
    weapon: WeaponEntry;
    activeEffects: ModEffect[];
}

const RAW_RECORDS = INCARNON_RAW as RawIncarnonRecord[];

/**
 * Current Wiki maximum ammunition for one full ranged Incarnon transformation.
 * The generated evolution snapshot can omit Evolution I for Genesis variants,
 * and some native records lag behind the current Wiki (Laetum was 216, not
 * the snapshot's older 220). Values are rounds/charges as documented by each
 * record's Wiki page; the page URL is exposed with the resolved record.
 */
const WIKI_INCARNON_AMMO_CAPACITY_BY_FAMILY: Readonly<Record<string, number>> = Object.freeze({
    Angstrum: 120,
    Atomos: 21,
    Ballistica: 18,
    Boar: 150,
    Boltor: 160,
    Braton: 200,
    Bronco: 20,
    Burston: 600,
    Cestra: 150,
    Dera: 50,
    Despair: 20,
    Dread: 20,
    "Dual Toxocyst": 270,
    Felarx: 60,
    Furis: 280,
    Gammacor: 15,
    Gorgon: 20,
    Kunai: 20,
    Laetum: 216,
    Lato: 24,
    Latron: 40,
    Lex: 20,
    Miter: 20,
    Onos: 350,
    Paris: 20,
    Phenmor: 408,
    Sicarus: 120,
    Soma: 200,
    Stug: 120,
    Strun: 40,
    Sybaris: 200,
    Torid: 170,
    Vasto: 24,
    Vectis: 45,
    Zylok: 12,
});

/** Newer Genesis records whose evolution snapshot is not in the bundled feed yet. */
const WIKI_INCARNON_FAMILY_BY_WEAPON_NAME: Readonly<Record<string, string>> = Object.freeze({
    Ballistica: "Ballistica",
    "Ballistica Prime": "Ballistica",
    "Rakta Ballistica": "Ballistica",
    Stug: "Stug",
    Vectis: "Vectis",
    "Vectis Prime": "Vectis",
});

function normalize(value: string) {
    return String(value ?? "").trim().toLowerCase();
}

function parseIncarnonAmmoCapacity(record: RawIncarnonRecord): number | undefined {
    const wikiCapacity = WIKI_INCARNON_AMMO_CAPACITY_BY_FAMILY[record.familyName];
    if (wikiCapacity !== undefined) return wikiCapacity;

    const formOption = record.tiers
        .find((tier) => tier.tier === 1)?.options
        .find((option) => option.id === "tier-1-incarnon-form" || /^incarnon form$/i.test(option.name));
    if (!formOption) return undefined;

    const capacities = [...formOption.descriptionLines, ...formOption.notes]
        // Only parse the explicit separate Incarnon-magazine sentence. Some
        // forms also describe their burst count as a maximum, which is not ammo.
        .flatMap((line) => [...line.matchAll(/separate\s+["“]?magazine["”]?.*?maximum of\s+([\d,]+)(?:\s+rounds?)?\b/gi)])
        .map((match) => Number(match[1].replaceAll(",", "")))
        .filter((value) => Number.isSafeInteger(value) && value > 0);
    const distinctCapacities = [...new Set(capacities)];
    return distinctCapacities.length === 1 ? distinctCapacities[0] : undefined;
}

function wikiUrlForSourcePage(sourcePage: string) {
    const page = sourcePage
        .replace(/\s*-\s*WARFRAME Wiki(?:\.html)?$/i, "")
        .trim()
        .replace(/\s+/g, "_");
    return `https://wiki.warframe.com/w/${encodeURIComponent(page)}`;
}

function wikiUrlForPage(page: string) {
    return `https://wiki.warframe.com/w/${encodeURIComponent(page.replace(/\s+/g, "_"))}`;
}

function wikiAmmoCapacityForWeapon(weapon: WeaponEntry, record: IncarnonWeaponRecord | null) {
    if (record?.incarnonAmmoCapacity !== undefined) return record.incarnonAmmoCapacity;
    const familyName = WIKI_INCARNON_FAMILY_BY_WEAPON_NAME[weapon.name];
    return familyName ? WIKI_INCARNON_AMMO_CAPACITY_BY_FAMILY[familyName] : undefined;
}

function wikiAmmoCapacitySourceForWeapon(weapon: WeaponEntry, record: IncarnonWeaponRecord | null) {
    if (record) return record.wikiUrl;
    const familyName = WIKI_INCARNON_FAMILY_BY_WEAPON_NAME[weapon.name];
    return familyName ? wikiUrlForPage(`${familyName} Incarnon Genesis`) : undefined;
}

function variantLabelMatchesWeapon(weaponName: string, rawLabel: string) {
    const name = normalize(weaponName).replace(/[‐‑‒–—]/g, "-");
    const labels = normalize(rawLabel).replace(/[‐‑‒–—]/g, "-").split("/").map((value) => value.trim());
    return labels.some((label) => {
        if (name === label) return true;
        const variantToken = name.match(/(?:^|[\s-])(prime|mk1|prisma|telos|vandal|wraith|rakta|sancti|synoid|carmine|kuva|tenet|mutalist|secura|suda|vaykor)(?=$|[\s-])/i)?.[1];
        return Boolean(variantToken && label === variantToken.toLowerCase());
    });
}

function resolveVariantStatLine(line: string, weaponName: string): string | null {
    let unresolvedVariant = false;
    const resolved = line.replace(
        /[+-]?\d+(?:\.\d+)?(?:%|x)?\s*\([^)]*\)(?:\s*\/\s*[+-]?\d+(?:\.\d+)?(?:%|x)?\s*\([^)]*\))+/gi,
        (variantGroup) => {
            const values = [...variantGroup.matchAll(/([+-]?\d+(?:\.\d+)?(?:%|x)?)\s*\(([^)]+)\)/gi)];
            const selected = values.find((match) => variantLabelMatchesWeapon(weaponName, match[2]));
            if (!selected) {
                unresolvedVariant = true;
                return variantGroup;
            }
            return selected[1];
        },
    );
    return unresolvedVariant ? null : resolved;
}

function normalizeLegacyIncarnonStatLine(line: string) {
    return line
        .replace(/^Increase Damage by ([+-]?\d+(?:\.\d+)?)(\.)?$/i, "Increase Base Damage by $1$2")
        .replace(/^Increase Critical Chance by ([+-]?\d+(?:\.\d+)?%)(\.)?$/i, "Increase Base Critical Chance by $1$2")
        .replace(/^Increase Status Chance by ([+-]?\d+(?:\.\d+)?%)(\.)?$/i, "Increase Base Status Chance by $1$2")
        .replace(/^Increase Critical Damage Multiplier by ([+-]?\d+(?:\.\d+)?)(x?)(\.)?$/i, (_line, value: string, suffix: string, punctuation: string) => `Increase Base Critical Damage Multiplier by ${value}${suffix || "x"}${punctuation ?? ""}`)
        .replace(/^Increase Magazine Capacity by ([+-]?\d+(?:\.\d+)?)(\.)?$/i, "Increase Base Magazine Capacity by $1$2");
}

function statFamily(value: string) {
    const text = normalize(value);
    if (/multishot/.test(text)) return "multishot";
    if (/magazine/.test(text)) return "magazine";
    if (/critical damage|critical multiplier/.test(text)) return "critical-multiplier";
    if (/critical chance/.test(text)) return "critical-chance";
    if (/status chance/.test(text)) return "status-chance";
    if (/damage/.test(text)) return "damage";
    if (/projectile speed/.test(text)) return "projectile-speed";
    if (/fire rate/.test(text)) return "fire-rate";
    if (/reload speed/.test(text)) return "reload-speed";
    if (/accuracy/.test(text)) return "accuracy";
    if (/punch through/.test(text)) return "punch-through";
    return null;
}

function notesForStatLine(line: string, descriptionLines: string[], notes: string[]) {
    const family = statFamily(line);
    return notes.filter((note) => {
        const noteFamily = statFamily(note);
        if (noteFamily) return noteFamily === family;
        return descriptionLines.length === 1;
    });
}

function isIncarnonAttack(attack: Pick<WeaponAttack, "name">) {
    return /incarnon/i.test(String(attack.name ?? ""));
}

function attackMatchesScope(attack: Pick<WeaponAttack, "name">, scope: IncarnonAttackScope) {
    if (scope === "all") return true;
    const incarnon = isIncarnonAttack(attack);
    return scope === "incarnon" ? incarnon : !incarnon;
}

function cloneDamage(damage: WeaponDamage): WeaponDamage {
    return { ...damage };
}

function positiveDamageKeys(damage: WeaponDamage) {
    return (Object.keys(damage) as Array<keyof WeaponDamage>).filter((key) => key !== "total" && (damage[key] ?? 0) > 0);
}

function applyBaseDamageFlat(damage: WeaponDamage, amount: number): WeaponDamage {
    if (!amount) return damage;
    const keys = positiveDamageKeys(damage);
    if (!keys.length) return damage;
    const total = keys.reduce((sum, key) => sum + (damage[key] ?? 0), 0);
    if (total <= 0) return damage;

    const next = cloneDamage(damage);
    for (const key of keys) {
        const share = (damage[key] ?? 0) / total;
        next[key] = (next[key] ?? 0) + amount * share;
    }
    next.total = (next.total ?? total) + amount;
    return next;
}

function scopeForLine(line: string, notes: string[]): IncarnonAttackScope {
    const text = normalize(`${line} ${notes.join(" ")}`);
    if (
        text.includes("only affects incarnon form") ||
        text.includes("affects only incarnon form") ||
        /for incarnon form\b/.test(text)
    ) {
        return "incarnon";
    }
    if (
        text.includes("does not affect incarnon form") ||
        text.includes("does not apply to incarnon form") ||
        text.includes("only affects untransformed") ||
        text.includes("affects untransformed") ||
        text.includes("only untransformed")
    ) {
        return "normal";
    }
    return "all";
}

function triggerFromLine(line: string): ConditionalEffect["trigger"] | null {
    const normalized = normalize(line);
    if (normalized.startsWith("on hit that is neither critical nor applies a status effect:")) return "onNonCriticalNoStatusHit";
    if (normalized.startsWith("on reload from empty:")) return "onReloadFromEmpty";
    if (normalized.startsWith("on reload:")) return "onReload";
    if (normalized.startsWith("on headshot kill:")) return "onHeadshotKill";
    if (normalized.startsWith("on weakpoint kill:")) return "onWeakPointKill";
    if (normalized.startsWith("on consecutive weakpoint hits:")) return "onWeakPointHit";
    if (normalized.startsWith("on weakpoint hits:")) return "onWeakPointHit";
    if (normalized.startsWith("on weakpoint hit:")) return "onWeakPointHit";
    if (normalized.startsWith("on punch through hit:")) return "onPunchThroughHit";
    if (normalized.startsWith("on kill:")) return "onKill";
    if (normalized.startsWith("on 2 headshots within 2 seconds:")) return "onHeadshot";
    if (normalized.startsWith("on headshot:")) return "onHeadshot";
    return null;
}

function durationFromLine(line: string) {
    const match = line.match(/\bfor\s+(\d+(?:\.\d+)?)\s*seconds?\b/i);
    return match ? Number(match[1]) : 0;
}

function maxStacksFromLine(line: string) {
    const match = line.match(/\bstacks?\s+up\s+to\s+(\d+)(?:x)?\b/i);
    return match ? Number(match[1]) : 1;
}

type NumericModEffectKey = {
    [Key in keyof ModEffect]-?: ModEffect[Key] extends number ? Key : never;
}[keyof ModEffect];

function addNumericEffectValue(effect: ModEffect, key: NumericModEffectKey, amount: number) {
    const numericEffect = effect as unknown as Record<NumericModEffectKey, number>;
    numericEffect[key] += amount;
}

function pushEffect(target: ScopedEffect[], scope: IncarnonAttackScope, patch: Partial<ModEffect>) {
    if (!Object.keys(patch).length) return;
    const existing = target.find((entry) => entry.scope === scope);
    if (existing) {
        for (const key of Object.keys(patch) as Array<keyof ModEffect>) {
            const value = patch[key];
            if (typeof value === "number") {
                addNumericEffectValue(existing.effect, key as NumericModEffectKey, value);
            } else if (key === "conditionalEffects" && Array.isArray(value)) {
                existing.effect.conditionalEffects.push(...(value as ConditionalEffect[]));
            } else if (key === "nonCriticalHitDamageProcs" && Array.isArray(value)) {
                existing.effect.nonCriticalHitDamageProcs ??= [];
                existing.effect.nonCriticalHitDamageProcs.push(...(value as NonCriticalHitDamageProc[]));
            } else if (key === "targetFaction" && typeof value === "string") {
                existing.effect.targetFaction = value;
            }
        }
        return;
    }
    const effect = emptyEffect();
    Object.assign(effect, patch);
    target.push({ scope, effect });
}

function pushAdjustment(target: ScopedWeaponAdjustment[], scope: IncarnonAttackScope, patch: Omit<ScopedWeaponAdjustment, "scope">) {
    if (!Object.keys(patch).length) return;
    const existing = target.find((entry) => entry.scope === scope);
    if (existing) {
        existing.baseDamageFlat = (existing.baseDamageFlat ?? 0) + (patch.baseDamageFlat ?? 0);
        existing.critChanceFlat = (existing.critChanceFlat ?? 0) + (patch.critChanceFlat ?? 0);
        existing.critMultiplierFlat = (existing.critMultiplierFlat ?? 0) + (patch.critMultiplierFlat ?? 0);
        existing.slideCritMultiplierOverride = patch.slideCritMultiplierOverride ?? existing.slideCritMultiplierOverride;
        existing.statusChanceFlat = (existing.statusChanceFlat ?? 0) + (patch.statusChanceFlat ?? 0);
        existing.magazineSizeFlat = (existing.magazineSizeFlat ?? 0) + (patch.magazineSizeFlat ?? 0);
        return;
    }
    target.push({ scope, ...patch });
}

function conditionalPatch(trigger: ConditionalEffect["trigger"], durationSeconds: number, maxStacks: number, stats: ConditionalEffect["stats"]): Partial<ModEffect> {
    return {
        conditionalEffects: [{
            trigger,
            durationSeconds,
            requiresAiming: false,
            maxStacks,
            stats,
        }],
    };
}

function parsePercent(value: string) {
    return Number(value) / 100;
}

function parseCritMultiplierPercent(value: string) {
    return Number(value) / 100;
}

function buildOptionModel(option: RawIncarnonOption, weaponName: string): IncarnonOptionModel {
    const adjustments: ScopedWeaponAdjustment[] = [];
    const effects: ScopedEffect[] = [];
    const unsupportedLines: string[] = [];
    let modeledLineCount = 0;

    const allNotes = option.notes ?? [];

    const descriptionLines = (option.descriptionLines ?? []).flatMap((rawLine) => {
        const line = rawLine.trim();
        if (/^(?:on|with|while|when)\b/i.test(line)) return [line];
        return line.split(/\.\s+(?=[A-Z+])/).map((part) => part.trim()).filter(Boolean);
    });

    for (const rawLine of descriptionLines) {
        const sourceLine = rawLine.trim();
        const variantResolvedLine = resolveVariantStatLine(sourceLine, weaponName);
        if (variantResolvedLine === null) {
            unsupportedLines.push(sourceLine);
            continue;
        }
        const line = normalizeLegacyIncarnonStatLine(variantResolvedLine);
        if (!line) continue;

        if (
            option.id === "tier-5-overwhelming-attrition" &&
            /^when the buff times out, one stack is lost and the buff duration resets\.?$/i.test(line)
        ) {
            modeledLineCount += 1;
            continue;
        }

        const trigger = triggerFromLine(line);

        // Condition clauses that do not map to a supported optimizer trigger
        // must not leak their numeric bonus into the unconditional build.
        if (/^(?:with|while|when)\b/i.test(line) || (/^on\b/i.test(line) && !trigger)) {
            unsupportedLines.push(line);
            continue;
        }

        const effectMentions = line.match(/\b(?:damage|critical chance|critical damage|fire rate|reload speed|ammo efficiency|multishot|status chance|accuracy|projectile speed|punch through|magazine capacity|combo count chance)\b/gi) ?? [];
        if (trigger && effectMentions.length > 1) {
            // This parser resolves one stat family per description clause. If a
            // triggered line mixes effects, do not apply only the recognized
            // fragment while silently dropping the rest.
            unsupportedLines.push(line);
            continue;
        }

        const scope = scopeForLine(line, notesForStatLine(line, descriptionLines, allNotes));
        const statsLine = trigger ? line.replace(/^On [^:]+:\s*/i, "") : line;
        const additiveNoteText = normalize(`${statsLine} ${allNotes.join(" ")}`);

        const addStaticEffect = (patch: Partial<ModEffect>) => {
            pushEffect(effects, scope, patch);
            modeledLineCount += 1;
        };
        const addConditionalEffect = (stats: ConditionalEffect["stats"]) => {
            if (!trigger) {
                unsupportedLines.push(line);
                return;
            }
            addStaticEffect(conditionalPatch(trigger, durationFromLine(line), maxStacksFromLine(line), stats));
        };
        const addTriggeredOrStaticEffect = (stats: ConditionalEffect["stats"]) => {
            if (trigger) addConditionalEffect(stats);
            else addStaticEffect(stats);
        };
        const addAdjustment = (patch: Omit<ScopedWeaponAdjustment, "scope">) => {
            if (trigger) {
                // Flat weapon-stat adjustments are not represented as
                // conditional effects, so never turn a triggered bonus into a
                // permanent evolution adjustment.
                unsupportedLines.push(line);
                return;
            }
            pushAdjustment(adjustments, scope, patch);
            modeledLineCount += 1;
        };

        const nonCriticalHitDamageMatch = statsLine.match(/([\d.]+)%\s*chance to deal\s*\+?([\d.]+)%\s*damage on non-critical hits/i);
        if (nonCriticalHitDamageMatch) {
            addStaticEffect({
                nonCriticalHitDamageProcs: [{
                    chance: parsePercent(nonCriticalHitDamageMatch[1]),
                    damageBonus: parsePercent(nonCriticalHitDamageMatch[2]),
                }],
            });
            continue;
        }
        const directDamagePerStatusMatch = statsLine.match(/([+-]?[\d.]+)%\s*direct damage per status type affecting the target/i);
        if (directDamagePerStatusMatch) {
            addTriggeredOrStaticEffect({ directDamagePerStatusBonus: parsePercent(directDamagePerStatusMatch[1]) });
            continue;
        }
        if (
            /^affects both (?:forms|modes)\.?$/i.test(line) ||
            /^(?:damage bonus is )?(?:additive|multiplicative) to base damage (?:sources|bonuses)\b/i.test(line)
        ) {
            modeledLineCount += 1;
            continue;
        }
        let matched = true;
        const multishotDamageMatch = statsLine.match(/multishot consumes ammo[^.]*?\+([\d.]+)%\s*damage/i);
        if (multishotDamageMatch) {
            addTriggeredOrStaticEffect({ multishotDamageBonus: parsePercent(multishotDamageMatch[1]) });
        }
        const baseDamageMatch = statsLine.match(/increase (?:base )?damage by ([+-]?\d+(?:\.\d+)?)(?!\s*%)/i);
        if (baseDamageMatch && !trigger && !/^with\b/i.test(statsLine)) {
            const match = baseDamageMatch;
            addAdjustment({ baseDamageFlat: Number(match?.[1] ?? 0) });
        } else if (/increase (?:base )?critical damage multiplier to [\d.]+x on slide attacks?/i.test(statsLine)) {
            const match = statsLine.match(/increase (?:base )?critical damage multiplier to ([\d.]+)x on slide attacks?/i);
            addAdjustment({ slideCritMultiplierOverride: Number(match?.[1] ?? 0) });
        } else if (/increase (?:base )?critical chance by [+-]?\d+(?:\.\d+)?%/i.test(statsLine)) {
            const match = statsLine.match(/increase (?:base )?critical chance by ([+-]?\d+(?:\.\d+)?)%/i);
            addAdjustment({ critChanceFlat: parsePercent(match?.[1] ?? "0") });
        } else if (/increase (?:base )?critical damage multiplier by [+-]?\d+(?:\.\d+)?x/i.test(statsLine)) {
            const match = statsLine.match(/increase (?:base )?critical damage multiplier by ([+-]?\d+(?:\.\d+)?)x/i);
            addAdjustment({ critMultiplierFlat: Number(match?.[1] ?? 0) });
        } else if (/increase (?:base )?status chance by [+-]?\d+(?:\.\d+)?%/i.test(statsLine)) {
            const match = statsLine.match(/increase (?:base )?status chance by ([+-]?\d+(?:\.\d+)?)%/i);
            addAdjustment({ statusChanceFlat: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*damage\b/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*damage\b/i);
            addTriggeredOrStaticEffect({ damageBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*fire rate/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*fire rate/i);
            addTriggeredOrStaticEffect({ fireRateBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*projectile speed/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*projectile speed/i);
            addTriggeredOrStaticEffect({ projectileSpeedBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*reload speed/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*reload speed/i);
            addTriggeredOrStaticEffect({ reloadSpeedBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*accuracy/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*accuracy/i);
            addTriggeredOrStaticEffect({ accuracyBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*multishot/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*multishot/i);
            addTriggeredOrStaticEffect({ multishotBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*ammo efficiency/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*ammo efficiency/i);
            addTriggeredOrStaticEffect({ ammoEfficiencyBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?\s*punch through/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)\s*punch through/i);
            addTriggeredOrStaticEffect({ punchThrough: Number(match?.[1] ?? 0) });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*magazine capacity/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*magazine capacity/i);
            addTriggeredOrStaticEffect({ magazineBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?\s*magazine capacity/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)\s*magazine capacity/i);
            addAdjustment({ magazineSizeFlat: Number(match?.[1] ?? 0) });
        } else if (/increase (?:base )?magazine capacity by [+-]?\d+(?:\.\d+)?/i.test(statsLine)) {
            const match = statsLine.match(/increase (?:base )?magazine capacity by ([+-]?\d+(?:\.\d+)?)/i);
            addAdjustment({ magazineSizeFlat: Number(match?.[1] ?? 0) });
        } else if (/increase base magazine capacity by [+-]?\d+(?:\.\d+)?/i.test(statsLine)) {
            const match = statsLine.match(/increase base magazine capacity by ([+-]?\d+(?:\.\d+)?)/i);
            addAdjustment({ magazineSizeFlat: Number(match?.[1] ?? 0) });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*headshot damage/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*headshot damage/i);
            addTriggeredOrStaticEffect({ headshotMultiplierBonus: parsePercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*critical damage/i.test(statsLine) && /flat value|added after mods/i.test(additiveNoteText)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*critical damage/i);
            addTriggeredOrStaticEffect({ finalCritMultiplierBonus: parseCritMultiplierPercent(match?.[1] ?? "0") });
        } else if (/[+-]?\d+(?:\.\d+)?%\s*critical chance/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*critical chance/i);
            const value = parsePercent(match?.[1] ?? "0");
            if (/flat value|added after mods/i.test(additiveNoteText)) {
                addTriggeredOrStaticEffect({ finalCritChanceBonus: value });
            } else {
                addTriggeredOrStaticEffect({ critChanceBonus: value });
            }
        } else if (/[+-]?\d+(?:\.\d+)?%\s*status chance/i.test(statsLine)) {
            const match = statsLine.match(/([+-]?\d+(?:\.\d+)?)%\s*status chance/i);
            const value = parsePercent(match?.[1] ?? "0");
            if (/flat value|added after mods|added last/i.test(additiveNoteText)) {
                addTriggeredOrStaticEffect({ finalStatusChanceBonus: value });
            } else {
                addTriggeredOrStaticEffect({ statusChanceBonus: value });
            }
        } else {
            matched = Boolean(multishotDamageMatch);
        }

        if (!matched) unsupportedLines.push(line);
    }

    return {
        adjustments,
        effects,
        unsupportedLines,
        modeledLineCount,
    };
}

const RECORDS: IncarnonWeaponRecord[] = RAW_RECORDS.map((record) => ({
    weaponName: record.weaponName,
    familyName: record.familyName,
    sourcePage: record.sourcePage,
    kind: record.kind,
    incarnonAmmoCapacity: parseIncarnonAmmoCapacity(record),
    wikiUrl: wikiUrlForSourcePage(record.sourcePage),
    tiers: record.tiers
        .filter((tier): tier is RawIncarnonTier & { tier: IncarnonTier } => tier.tier >= 1 && tier.tier <= 5)
        .map((tier) => ({
            tier: tier.tier,
            options: tier.options.map((option) => {
                const currentOption = withCurrentPatchDescription(record.weaponName, option);
                const resolvedOption = {
                    ...currentOption,
                    descriptionLines: currentOption.descriptionLines.map((line) => {
                        const variantResolved = resolveVariantStatLine(line, record.weaponName);
                        return normalizeLegacyIncarnonStatLine(variantResolved ?? line);
                    }),
                };
                return {
                    ...resolvedOption,
                    model: buildOptionModel(resolvedOption, record.weaponName),
                };
            }),
        })),
}));

/**
 * Keep generated evolution text aligned with the current Wiki when its table
 * variable substitution has stale wording or unresolved values. Reviewed
 * 2026-11-15 against the Torid, Burston, Gorgon, Latron, and Sicarus pages.
 * https://wiki.warframe.com/w/Torid_Incarnon_Genesis
 * https://wiki.warframe.com/w/Burston_Incarnon_Genesis
 * https://wiki.warframe.com/w/Gorgon_Incarnon_Genesis
 * https://wiki.warframe.com/w/Latron_Incarnon_Genesis
 * https://wiki.warframe.com/w/Sicarus
 * https://wiki.warframe.com/w/Update_37
 * Legacy stat wording is normalized according to https://wiki.warframe.com/w/Update_36.
 */
function withCurrentPatchDescription(weaponName: string, option: RawIncarnonOption): RawIncarnonOption {
    const name = normalize(weaponName);
    if (
        ["furax", "furax wraith", "mk1-furax"].includes(name) &&
        option.id === "tier-4-kinetic-killer"
    ) {
        return {
            ...option,
            descriptionLines: ["Increase Base Critical Damage Multiplier to 4x on Slide Attacks."],
            notes: ["Applies to any attack that makes contact while the player is sliding, including Heavy Attacks and Heavy Slams."],
        };
    }
    if (name === "torid") {
        const currentToridDescriptions: Record<string, Pick<RawIncarnonOption, "descriptionLines" | "notes">> = {
            "tier-2-final-fusillade": {
                descriptionLines: [
                    "Increase Base Damage by +51.",
                    "+3 Multishot on last shot in magazine.",
                ],
                notes: [],
            },
            "tier-2-plentiful-mayhem": {
                descriptionLines: [
                    "Increase Base Damage by +31.",
                    "Multishot consumes ammo directly from Capacity and increases Damage by +60%.",
                ],
                notes: [
                    "Damage bonus from multishot consuming ammo is multiplicative to base damage bonuses like Serration.",
                    "Affects both modes. In the case of Incarnon Form, it pools directly from its magazine.",
                    "Damage bonus from multishot consuming ammo only applies to projectiles generated by multishot.",
                    "In the Incarnon Form, instead of increasing the damage of additional projectiles created by multishot, all multishot bonuses are increased by 60%.",
                ],
            },
            "tier-3-extended-volley": {
                descriptionLines: ["Increase Base Magazine Capacity by +9."],
                notes: ["Does not apply to Incarnon Form's Magazine."],
            },
            "tier-4-commodore-s-fortune": {
                descriptionLines: ["Increase Base Critical Chance by +20%."],
                notes: [],
            },
            "tier-4-survivor-s-edge": {
                descriptionLines: [
                    "Increase Base Critical Chance by +15%.",
                    "Increase Base Status Chance by +15%.",
                ],
                notes: [],
            },
            "tier-4-elemental-balance": {
                descriptionLines: ["Increase Base Status Chance by +34%."],
                notes: [],
            },
        };
        const toridCorrection = currentToridDescriptions[option.id];
        if (toridCorrection) return { ...option, ...toridCorrection };
    }

    const normalizedName = name;
    const currentWikiStatCorrections: Record<string, Record<string, Pick<RawIncarnonOption, "descriptionLines" | "notes">>> = {
        burston: {
            "tier-2-forceful-finality": {
                descriptionLines: ["Increase Base Damage by +42.", "+5 Base Multishot on final magazine burst."],
                notes: [
                    "The multishot bonus is added before mods, so multishot bonuses increase it.",
                    "The multishot bonus does not affect the Incarnon Form.",
                ],
            },
            "tier-2-fortress-salvo": {
                descriptionLines: ["Increase Base Damage by +42.", "With Armor Over 450: +2 Punch Through."],
                notes: [],
            },
            "tier-3-extended-volley": {
                descriptionLines: ["Increase Base Magazine Capacity by +21."],
                notes: ["Does not apply to Incarnon Form's Magazine."],
            },
            "tier-4-absolute-valor": {
                descriptionLines: ["Increase Base Critical Chance by +22%."],
                notes: [],
            },
        },
        "burston prime": {
            "tier-2-forceful-finality": {
                descriptionLines: ["Increase Base Damage by +42.", "+5 Base Multishot on final magazine burst."],
                notes: [
                    "The multishot bonus is added before mods, so multishot bonuses increase it.",
                    "The multishot bonus does not affect the Incarnon Form.",
                ],
            },
            "tier-2-fortress-salvo": {
                descriptionLines: ["Increase Base Damage by +42.", "With Armor Over 450: +2 Punch Through."],
                notes: [],
            },
            "tier-3-extended-volley": {
                descriptionLines: ["Increase Base Magazine Capacity by +21."],
                notes: ["Does not apply to Incarnon Form's Magazine."],
            },
            "tier-4-absolute-valor": {
                descriptionLines: ["Increase Base Critical Chance by +22%."],
                notes: [],
            },
        },
        gorgon: {
            "tier-2-hunter-s-mantra": { descriptionLines: ["Increase Base Damage by +10.", "With Channeled Ability Active: +3 Punch Through, +40% Accuracy."], notes: [] },
            "tier-2-hoplite-s-virtue": { descriptionLines: ["Increase Base Damage by +10.", "On Shield Break: Increase Base Damage by +13 for 8 seconds."], notes: ["Shield break refers to the player's shields, not the enemy's."] },
        },
        "gorgon wraith": {
            "tier-2-hunter-s-mantra": { descriptionLines: ["Increase Base Damage by +5.", "With Channeled Ability Active: +3 Punch Through, +40% Accuracy."], notes: [] },
            "tier-2-hoplite-s-virtue": { descriptionLines: ["Increase Base Damage by +5.", "On Shield Break: Increase Base Damage by +8 for 8 seconds."], notes: ["Shield break refers to the player's shields, not the enemy's."] },
        },
        "prisma gorgon": {
            "tier-2-hunter-s-mantra": { descriptionLines: ["Increase Base Damage by +5.", "With Channeled Ability Active: +3 Punch Through, +40% Accuracy."], notes: [] },
            "tier-2-hoplite-s-virtue": { descriptionLines: ["Increase Base Damage by +5.", "On Shield Break: Increase Base Damage by +8 for 8 seconds."], notes: ["Shield break refers to the player's shields, not the enemy's."] },
        },
        latron: {
            "tier-2-riddled-target": { descriptionLines: ["Increase Base Damage by +48.", "On Puncture Status Effect: +25% Multishot for 8 seconds. Stacks up to 4x."], notes: ["The multishot bonus stacks additively with mods such as Split Chamber."] },
            "tier-2-swift-punishment": { descriptionLines: ["Increase Base Damage by +48.", "With Sprint Speed 1.2 or Higher: +30% Direct Damage per Status Type affecting the target."], notes: ["The effect only requires 1.1 or higher sprint speed."] },
            "tier-3-extended-volley": { descriptionLines: ["Increase Base Magazine Capacity by +15."], notes: ["Does not apply to Incarnon Form's Magazine."] },
            "tier-4-critical-parallel": { descriptionLines: ["Increase Base Critical Chance by +30%.", "Increase Base Critical Damage Multiplier by +0.6x."], notes: [] },
        },
        "latron wraith": {
            "tier-2-riddled-target": { descriptionLines: ["Increase Base Damage by +12.", "On Puncture Status Effect: +25% Multishot for 8 seconds. Stacks up to 4x."], notes: ["The multishot bonus stacks additively with mods such as Split Chamber."] },
            "tier-2-swift-punishment": { descriptionLines: ["Increase Base Damage by +12.", "With Sprint Speed 1.2 or Higher: +30% Direct Damage per Status Type affecting the target."], notes: ["The effect only requires 1.1 or higher sprint speed."] },
            "tier-3-extended-volley": { descriptionLines: ["Increase Base Magazine Capacity by +15."], notes: ["Does not apply to Incarnon Form's Magazine."] },
            "tier-4-critical-parallel": { descriptionLines: ["Increase Base Critical Chance by +24%.", "Increase Base Critical Damage Multiplier by +0.2x."], notes: [] },
        },
        "latron prime": {
            "tier-2-riddled-target": { descriptionLines: ["Increase Base Damage by +6.", "On Puncture Status Effect: +25% Multishot for 8 seconds. Stacks up to 4x."], notes: ["The multishot bonus stacks additively with mods such as Split Chamber."] },
            "tier-2-swift-punishment": { descriptionLines: ["Increase Base Damage by +6.", "With Sprint Speed 1.2 or Higher: +30% Direct Damage per Status Type affecting the target."], notes: ["The effect only requires 1.1 or higher sprint speed."] },
            "tier-3-extended-volley": { descriptionLines: ["Increase Base Magazine Capacity by +15."], notes: ["Does not apply to Incarnon Form's Magazine."] },
            "tier-4-critical-parallel": { descriptionLines: ["Increase Base Critical Chance by +24%.", "Increase Base Critical Damage Multiplier by +0.2x."], notes: [] },
        },
        sicarus: {
            "tier-4-survivor-s-edge": {
                descriptionLines: ["Increase Base Critical Chance by +12%.", "Increase Base Status Chance by +12%."],
                notes: [],
            },
        },
        "sicarus prime": {
            "tier-4-survivor-s-edge": {
                descriptionLines: ["Increase Base Critical Chance by +9%.", "Increase Base Status Chance by +9%."],
                notes: [],
            },
        },
    };
    const currentWikiCorrection = currentWikiStatCorrections[normalizedName]?.[option.id];
    if (currentWikiCorrection) return { ...option, ...currentWikiCorrection };

    if (option.id !== "tier-2-crimson-overture") return option;

    if (["boltor", "boltor prime", "telos boltor"].includes(name)) {
        return {
            ...option,
            descriptionLines: [
                ...(name === "boltor" ? ["Increase Base Damage by +12."] : []),
                "On Kill: Increase Damage by +2 for 5 seconds. Stacks up to 3x.",
                "On Kill: +25% Ammo Efficiency for 5 seconds. Stacks up to 3x.",
                "At maximum stacks this adds +6 base damage per projectile in base form and +18 per projectile in Incarnon form.",
            ],
        };
    }
    if (["dera", "dera vandal"].includes(name)) {
        return {
            ...option,
            descriptionLines: [
                `Increase Base Damage by +${name === "dera" ? 8 : 6}.`,
                "On Kill: +25% Ammo Efficiency for 5 seconds. Stacks up to 3x.",
            ],
        };
    }
    return option;
}

const RECORDS_BY_NAME = new Map(RECORDS.map((record) => [normalize(record.weaponName), record]));

export function getIncarnonRecordForWeapon(weapon: WeaponEntry | string | null | undefined): IncarnonWeaponRecord | null {
    const name = typeof weapon === "string" ? weapon : weapon?.name;
    if (!name) return null;
    return RECORDS_BY_NAME.get(normalize(name)) ?? null;
}

export function getDefaultIncarnonUnlockedTier(record: IncarnonWeaponRecord | null) {
    if (!record) return 0;
    return record.kind === "native" ? 5 : 0;
}

export function getDefaultIncarnonSelections(record: IncarnonWeaponRecord | null): Partial<Record<IncarnonTier, string>> {
    if (!record) return {};
    return Object.fromEntries(
        record.tiers
            .filter((tier) => tier.options.length > 0)
            .map((tier) => [tier.tier, tier.options[0].id]),
    ) as Partial<Record<IncarnonTier, string>>;
}

function highestSelectedIncarnonTier(selectedOptionsByTier: Partial<Record<IncarnonTier, string>>): number {
    return ([1, 2, 3, 4, 5] as const).reduce(
        (highest, tier) => selectedOptionsByTier[tier] ? tier : highest,
        0,
    );
}

/**
 * Builds legal evolution-path candidates for the UI optimizer. When a user has
 * selected any tiers, path search changes only those tiers; when none are
 * selected, it searches every available tier. Non-searched selections persist.
 */
export function buildIncarnonCandidateConfigs(
    record: IncarnonWeaponRecord | null,
    selectedOptionsByTier: Partial<Record<IncarnonTier, string>>,
    optimizeSelections: boolean,
): IncarnonCandidateConfig[] {
    const selected = { ...selectedOptionsByTier };
    const current = {
        unlockedTier: highestSelectedIncarnonTier(selected),
        selectedOptionsByTier: selected,
    };
    if (!record || !optimizeSelections) return [current];

    const selectedTiers = record.tiers.filter((tier) => Boolean(selected[tier.tier]));
    const tiersToOptimize = selectedTiers.length > 0 ? selectedTiers : record.tiers;
    const optionTiers = tiersToOptimize.filter((tier) => tier.options.length > 0);
    if (optionTiers.length === 0) return [current];

    const candidates: IncarnonCandidateConfig[] = [];
    const walk = (index: number, path: Partial<Record<IncarnonTier, string>>) => {
        if (index >= optionTiers.length) {
            candidates.push({
                unlockedTier: highestSelectedIncarnonTier(path),
                selectedOptionsByTier: { ...path },
            });
            return;
        }

        const tier = optionTiers[index];
        for (const option of tier.options) {
            path[tier.tier] = option.id;
            walk(index + 1, path);
        }
    };
    walk(0, selected);
    return candidates;
}

/** Selects a small, stable, score-ranked, path-diverse shortlist for full optimizer refinement. */
export function selectIncarnonSearchShortlist<T extends IncarnonScoredCandidate>(
    candidates: readonly T[],
    baselineSignatures: readonly string[],
    limit: number,
): T[] {
    const maximum = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
    if (maximum === 0) return [];

    const excluded = new Set(baselineSignatures);
    const seen = new Set<string>();
    const ranked = [...candidates]
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((left, right) => right.score - left.score);
    const uniqueRanked: T[] = [];
    for (const candidate of ranked) {
        if (excluded.has(candidate.signature) || seen.has(candidate.signature)) continue;
        seen.add(candidate.signature);
        uniqueRanked.push(candidate);
    }

    const pathDistance = (left: T, right: T) => {
        const tiers = new Set([
            ...Object.keys(left.path ?? {}),
            ...Object.keys(right.path ?? {}),
        ]);
        let distance = 0;
        for (const tier of tiers) {
            if (left.path?.[Number(tier) as IncarnonTier] !== right.path?.[Number(tier) as IncarnonTier]) distance += 1;
        }
        return distance;
    };
    const shortlist: T[] = [];
    while (shortlist.length < maximum && shortlist.length < uniqueRanked.length) {
        const remaining = uniqueRanked.filter((candidate) => !shortlist.includes(candidate));
        if (shortlist.length === 0) {
            shortlist.push(remaining[0]);
            continue;
        }

        // Score units differ between DPS and finite-TTK goals; rank the diversity pool by percentile.
        const diversityPoolSize = Math.min(
            remaining.length,
            Math.max(3, Math.ceil(remaining.length * 0.1)),
        );
        const nearBest = remaining.slice(0, diversityPoolSize);
        const diverseCandidates = nearBest.filter((candidate) => candidate.path && shortlist.some((selected) => selected.path));
        if (diverseCandidates.length === 0) {
            shortlist.push(remaining[0]);
            continue;
        }

        diverseCandidates.sort((left, right) => {
            const leftDistance = Math.min(...shortlist.map((selected) => pathDistance(left, selected)));
            const rightDistance = Math.min(...shortlist.map((selected) => pathDistance(right, selected)));
            return rightDistance - leftDistance || right.score - left.score;
        });
        shortlist.push(diverseCandidates[0]);
    }
    return shortlist;
}

function applyScopedAdjustmentToAttack(attack: WeaponAttack, adjustment: ScopedWeaponAdjustment) {
    let next: WeaponAttack = { ...attack };
    if (adjustment.baseDamageFlat) {
        const damage = applyBaseDamageFlat(next.damage, adjustment.baseDamageFlat);
        next = { ...next, damage, damageTotal: damage.total };
    }
    if (adjustment.critChanceFlat) next = { ...next, critChance: next.critChance + adjustment.critChanceFlat };
    if (adjustment.critMultiplierFlat) next = { ...next, critMultiplier: next.critMultiplier + adjustment.critMultiplierFlat };
    if (adjustment.statusChanceFlat) next = { ...next, statusChance: next.statusChance + adjustment.statusChanceFlat };
    return next;
}

function syncWeaponTopLevelFromAttack(weapon: WeaponEntry, attacks: WeaponAttack[]) {
    const first = attacks[0];
    if (!first) return weapon;
    return {
        ...weapon,
        attacks,
        damage: first.damage,
        critChance: first.critChance,
        critMultiplier: first.critMultiplier,
        statusChance: first.statusChance,
        magazineSize: weapon.magazineSize,
    };
}

function activeScopeForSelectedAttack(weapon: WeaponEntry, selectedAttackIdx: number): IncarnonAttackScope {
    return selectedAttackUsesIncarnonForm(weapon, selectedAttackIdx) ? "incarnon" : "normal";
}

export function resolveIncarnonState(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
    config: IncarnonBuildConfig,
): ResolvedIncarnonState {
    const record = getIncarnonRecordForWeapon(weapon);
    const selectedScope = activeScopeForSelectedAttack(weapon, selectedAttackIdx);
    const baseWeapon: WeaponEntry = {
        ...weapon,
        selectedAttackSlideCritMultiplierOverride: undefined,
        selectedAttackIncarnonAmmoCapacity: selectedScope === "incarnon"
            ? wikiAmmoCapacityForWeapon(weapon, record)
            : undefined,
        selectedAttackIncarnonAmmoCapacitySourceUrl: selectedScope === "incarnon"
            ? wikiAmmoCapacitySourceForWeapon(weapon, record)
            : undefined,
    };
    if (!record) {
        return { record, appliedOptions: [], weapon: baseWeapon, activeEffects: [] };
    }
    const selectedTierIds = Object.values(config.selectedOptionsByTier ?? {}).filter(Boolean);
    if (!selectedTierIds.length) {
        return { record, appliedOptions: [], weapon: baseWeapon, activeEffects: [] };
    }

    const appliedOptions: IncarnonOption[] = [];
    let nextWeapon: WeaponEntry = { ...baseWeapon, attacks: weapon.attacks.map((attack) => ({ ...attack, damage: { ...attack.damage } })) };
    const activeEffects: ModEffect[] = [];

    for (const tier of record.tiers) {
        const selectedId = config.selectedOptionsByTier[tier.tier];
        if (!selectedId) continue;
        const option = tier.options.find((entry) => entry.id === selectedId);
        if (!option) continue;
        appliedOptions.push(option);

        let attacks = nextWeapon.attacks.map((attack) => ({ ...attack, damage: { ...attack.damage } }));
        for (const adjustment of option.model.adjustments) {
            attacks = attacks.map((attack) =>
                attackMatchesScope(attack, adjustment.scope) ? applyScopedAdjustmentToAttack(attack, adjustment) : attack,
            );
            if (
                adjustment.slideCritMultiplierOverride !== undefined &&
                (adjustment.scope === "all" || adjustment.scope === selectedScope)
            ) {
                nextWeapon = {
                    ...nextWeapon,
                    selectedAttackSlideCritMultiplierOverride: adjustment.slideCritMultiplierOverride,
                };
            }
            if (adjustment.scope === "normal" && selectedScope === "normal" && adjustment.magazineSizeFlat) {
                nextWeapon = { ...nextWeapon, magazineSize: nextWeapon.magazineSize + adjustment.magazineSizeFlat };
            }
        }
        nextWeapon = syncWeaponTopLevelFromAttack(nextWeapon, attacks);

        for (const scopedEffect of option.model.effects) {
            if (scopedEffect.scope !== "all" && scopedEffect.scope !== selectedScope) continue;
            activeEffects.push(scopedEffect.effect);
        }
    }

    return { record, appliedOptions, weapon: nextWeapon, activeEffects };
}
