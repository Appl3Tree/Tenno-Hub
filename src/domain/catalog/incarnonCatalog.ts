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

function normalize(value: string) {
    return String(value ?? "").trim().toLowerCase();
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

function buildOptionModel(option: RawIncarnonOption): IncarnonOptionModel {
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
        const line = rawLine.trim();
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

        const scope = scopeForLine(line, allNotes);
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
        if (/increase base damage by [+-]?\d+(?:\.\d+)?/i.test(statsLine) && !trigger && !/^with\b/i.test(statsLine)) {
            const match = statsLine.match(/increase base damage by ([+-]?\d+(?:\.\d+)?)/i);
            addAdjustment({ baseDamageFlat: Number(match?.[1] ?? 0) });
        } else if (/increase base critical chance by [+-]?\d+(?:\.\d+)?%/i.test(statsLine)) {
            const match = statsLine.match(/increase base critical chance by ([+-]?\d+(?:\.\d+)?)%/i);
            addAdjustment({ critChanceFlat: parsePercent(match?.[1] ?? "0") });
        } else if (/increase base critical damage multiplier by [+-]?\d+(?:\.\d+)?x/i.test(statsLine)) {
            const match = statsLine.match(/increase base critical damage multiplier by ([+-]?\d+(?:\.\d+)?)x/i);
            addAdjustment({ critMultiplierFlat: Number(match?.[1] ?? 0) });
        } else if (/increase base status chance by [+-]?\d+(?:\.\d+)?%/i.test(statsLine)) {
            const match = statsLine.match(/increase base status chance by ([+-]?\d+(?:\.\d+)?)%/i);
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
    tiers: record.tiers
        .filter((tier): tier is RawIncarnonTier & { tier: IncarnonTier } => tier.tier >= 1 && tier.tier <= 5)
        .map((tier) => ({
            tier: tier.tier,
            options: tier.options.map((option) => {
                const currentOption = withCurrentPatchDescription(record.weaponName, option);
                return {
                    ...currentOption,
                    model: buildOptionModel(currentOption),
                };
            }),
        })),
}));

/**
 * The generated Wiki snapshot predates PC Hotfix 44.1.3's Crimson Overture
 * ammo-efficiency changes. Keep the correction at the catalog boundary so
 * both the displayed trait and parsed conditional model use the current rules.
 * Source: https://www.warframe.com/en/patch-notes/pc/44-1-3
 */
function withCurrentPatchDescription(weaponName: string, option: RawIncarnonOption): RawIncarnonOption {
    if (option.id !== "tier-2-crimson-overture") return option;

    const name = normalize(weaponName);
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
    if (!record) {
        return { record, appliedOptions: [], weapon, activeEffects: [] };
    }
    const selectedTierIds = Object.values(config.selectedOptionsByTier ?? {}).filter(Boolean);
    if (!selectedTierIds.length) {
        return { record, appliedOptions: [], weapon, activeEffects: [] };
    }

    const selectedScope = activeScopeForSelectedAttack(weapon, selectedAttackIdx);
    const appliedOptions: IncarnonOption[] = [];
    let nextWeapon: WeaponEntry = { ...weapon, attacks: weapon.attacks.map((attack) => ({ ...attack, damage: { ...attack.damage } })) };
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
            if (adjustment.scope === "normal" && adjustment.magazineSizeFlat) {
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
