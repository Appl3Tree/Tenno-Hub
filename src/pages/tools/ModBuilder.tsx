// src/pages/tools/ModBuilder.tsx
// Weapon Mod Builder — complete implementation with:
//   polarity icons · mod rank selection · exilus slot · arcane slots ×2
//   riven mod (user-defined stats) · forma counter · multi-attack display
//   beam-search optimizer · owned/excluded/faction/capacity toggles
//   build save+compare · build reasoning · status effect tooltips

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    getWeaponCatalog,
    clampMeleeComboMultiplier,
    getMeleeComboRules,
    isGroundMeleeCategory,
    supportsStanceLikeMods,
    usesMeleeDamageModel,
    withSelectedAttack,
    type WeaponCategory,
    type WeaponEntry,
} from "../../domain/catalog/weaponCatalog";
import {
    buildIncarnonCandidateConfigs,
    getIncarnonRecordForWeapon,
    resolveIncarnonState,
    selectIncarnonSearchShortlist,
    type IncarnonCandidateConfig,
    type IncarnonTier,
} from "../../domain/catalog/incarnonCatalog";
import { filterBuilderExpertVariants, getModsForWeapon, getStancesForWeapon, type ModEntry, type ModEffect, emptyEffect } from "../../domain/catalog/modCatalog";
import { ENEMY_PROFILES, getEnemyProfile } from "../../domain/catalog/enemyProfiles";
import { getArcanesForWeapon, type ArcaneEntry } from "../../domain/catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../../domain/logic/arcaneEffects";
import { avgCritMultiplier, calculateBuild, calculateMeleeAverageDps, DEFAULT_CONDITIONAL_STATE, estimateConditionalStackFactor, estimateConditionalUptime, type ConditionalState, type MeleeAverageDpsParameters } from "../../domain/logic/damageCalc";
import { optimizeBuild, explainBuild, getFactionFocusOptions, getTargetProfileAssumptions, normalizeOptimizeGoal, scoreOptimizerResultForConfiguration, type OptimizeGoal, type BuildReasoning, type LegacyOptimizeGoal, type TargetProfileOverride } from "../../domain/logic/buildOptimizer";
import { STATUS_DAMAGE_TYPES, type StatusDamageType } from "../../domain/logic/damageRuleset";
import { EXIMUS_BASE_OVERGUARD, applyEximusHealthBaseAdjustment, applyEximusShieldBaseAdjustment, applySteelPathStatMultiplier, getSteelPathEnemyLevel, scaleEnemyOverguard, scaleEnemyStat, type EnemyScalingFaction } from "../../domain/logic/enemyScaling";
import { calculateDirectDamageToInitialPools, simulateDirectAttackSequence, simulateExpectedWeaponEncounter, type DirectTargetDamageInput } from "../../domain/logic/targetDamage";
import { buildCustomRivenEntry, customRivenSupportsWeapon, type CustomRivenRecord } from "../../domain/rivens";
import {
    computeCapacity, countPolarityChanges, effectiveDrain,
    maxWeaponRank, type CapacityConfig,
} from "../../domain/logic/capacityCalc";
import { useTrackerStore } from "../../store/store";
import { getHighestOwnedArcaneRankWithFallback, hasOwnedArcane } from "../../domain/logic/arcaneInventory";
import type { SavedBuild, SavedBuildPlannerConfig, SavedBuildTargetConfig } from "../../domain/models/userState";
import { WorkspacePanel, WorkspaceSegmented, WorkspaceSegmentedButton } from "../../components/workspace/WorkspaceChrome";

// ── Polarity icons ────────────────────────────────────────────────────────────

const _polImgs = import.meta.glob<string>("../../assets/polarities/*.svg", {
    eager: true, query: "?url", import: "default",
});
const _polSvgRaw = import.meta.glob<string>("../../assets/polarities/*.svg", {
    eager: true, query: "?raw", import: "default",
});

// ── Status/damage-type icons ──────────────────────────────────────────────────

const _statusImgs = import.meta.glob<string>("../../assets/statuses/*.png", {
    eager: true, query: "?url", import: "default",
});
const _STATUS_FILE_MAP: Record<string, string> = {
    slash:       "SlashSymbol",
    impact:      "ImpactSymbol",
    puncture:    "PunctureSymbol",
    heat:        "HeatSymbol",
    cold:        "ColdSymbol",
    electricity: "ElectricitySymbol",
    toxin:       "ToxinSymbol",
    blast:       "BlastSymbol",
    radiation:   "RadiationSymbol",
    gas:         "GasSymbol",
    magnetic:    "MagneticSymbol",
    viral:       "ViralSymbol",
    corrosive:   "CorrosiveSymbol",
    void:        "VoidSymbol",
};
const DAMAGE_TYPE_ICON: Record<string, string> = {};
for (const [path, url] of Object.entries(_statusImgs)) {
    const base = path.split("/").pop()!.replace(".png", "");
    for (const [dmgType, file] of Object.entries(_STATUS_FILE_MAP)) {
        if (base === file) DAMAGE_TYPE_ICON[dmgType] = url as string;
    }
}
const COMBINED_ELEMENT_PARENTS: Record<string, [string, string]> = {
    blast:     ["heat", "cold"],
    radiation: ["heat", "electricity"],
    gas:       ["heat", "toxin"],
    magnetic:  ["cold", "electricity"],
    viral:     ["cold", "toxin"],
    corrosive: ["electricity", "toxin"],
};

function effectiveBurstTiming(weapon: WeaponEntry | null | undefined, effectiveFireRate: number) {
    const burstCount = weapon?.burstCount;
    const burstCycleRate = weapon?.burstCycleRate;
    const burstDelay = weapon?.burstDelay;
    if (
        weapon?.trigger.toLowerCase() !== "burst" ||
        !Number.isFinite(burstCount) || !Number.isFinite(burstCycleRate) ||
        !Number.isFinite(burstDelay) || (burstCount ?? 0) <= 1 ||
        (burstCycleRate ?? 0) <= 0 || (burstDelay ?? 0) < 0 || effectiveFireRate <= 0
    ) return {};

    const count = burstCount as number;
    const cycleRate = burstCycleRate as number;
    const delay = burstDelay as number;
    const baseEffectiveRate = count / (1 / cycleRate + (count - 1) * delay);
    const rateScale = effectiveFireRate / baseEffectiveRate;
    return {
        burstCount: count,
        burstCycleRate: cycleRate * rateScale,
        burstDelaySeconds: delay / rateScale,
    };
}
const POL_IMG: Record<string, string> = {};
const POL_SVG_RAW: Record<string, string> = {};
for (const [p, url] of Object.entries(_polImgs)) {
    POL_IMG[p.split("/").pop()!.replace(".svg", "").toLowerCase()] = url as string;
}
for (const [p, svg] of Object.entries(_polSvgRaw)) {
    POL_SVG_RAW[p.split("/").pop()!.replace(".svg", "").toLowerCase()] = svg as string;
}
const POL_FILE: Record<string, string> = {
    madurai: "madurai_pol", naramon: "naramon_pol", vazarin: "vazarin_pol",
    zenurik: "zenurik_pol", unairu:  "unairu_pol",  penjaga: "penjaga_pol",
    umbra:   "umbra_pol",   any:     "any_pol",
};
function PolarityIcon({ polarity, className = "w-4 h-4" }: { polarity: string; className?: string }) {
    const src = POL_IMG[POL_FILE[polarity] ?? ""] ?? null;
    if (!src) return <span className="text-slate-600 text-[10px]">○</span>;
    return <img src={src} alt={polarity} className={className} style={{ filter: "brightness(0) invert(1) opacity(0.65)" }} />;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_COUNT = 8;
const INCARNON_TIER_ORDER: IncarnonTier[] = [1, 2, 3, 4, 5];
const INCARNON_TIER_LABELS: Record<IncarnonTier, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
};
const INCARNON_PATH_REFINEMENT_LIMIT = 2;
const WEAPON_FILTER_OPTIONS: Array<{ value: WeaponCategory | "All"; label: string; compactLabel?: string }> = [
    { value: "All", label: "All Weapons", compactLabel: "All" },
    { value: "Primary", label: "Primary" },
    { value: "Secondary", label: "Secondary" },
    { value: "Melee", label: "Melee" },
    { value: "Arch-Gun", label: "Arch Gun" },
    { value: "Arch-Melee", label: "Arch Melee" },
    { value: "Companion", label: "Companion" },
];
const GOAL_OPTIONS: { key: OptimizeGoal; label: string; desc: string }[] = [
    {
        key: "burst",
        label: "Burst DPS",
        desc: "Ranks builds by immediate damage output for the selected attack and target assumptions.",
    },
    {
        key: "scaling",
        label: "Sustained DPS",
        desc: "Ranks builds by damage across repeated attacks and reload cycles for the selected target assumptions.",
    },
    {
        key: "timeToKill",
        label: "Expected TTK",
        desc: "Ranks legal builds by finite expected time to kill; kills within 600 seconds rank first, and if both reach the simulation cap, expected damage per second breaks the tie.",
    },
];
const FACTIONS = getFactionFocusOptions();
const ENEMY_SCALING_FACTIONS: Array<{ label: string; value: EnemyScalingFaction }> = [
    { label: "Grineer", value: "grineer" },
    { label: "Corpus", value: "corpus" },
    { label: "Infested", value: "infested" },
    { label: "Corrupted / Orokin", value: "corrupted" },
    { label: "Murmur", value: "murmur" },
    { label: "Sentient", value: "sentient" },
    { label: "Anarchs", value: "anarchs" },
    { label: "Unaffiliated", value: "unaffiliated" },
    { label: "Techrot", value: "techrot" },
];
const VALENCE_ELEMENTS = [
    { key: "impact", label: "Impact" },
    { key: "heat", label: "Heat" },
    { key: "cold", label: "Cold" },
    { key: "electricity", label: "Electricity" },
    { key: "toxin", label: "Toxin" },
    { key: "magnetic", label: "Magnetic" },
    { key: "radiation", label: "Radiation" },
] as const;
type ValenceElement = typeof VALENCE_ELEMENTS[number]["key"];
const POLARITY_OPTS = [
    { key: "",        label: "None"    },
    { key: "madurai", label: "Madurai" },
    { key: "naramon", label: "Naramon" },
    { key: "vazarin", label: "Vazarin" },
    { key: "zenurik", label: "Zenurik" },
    { key: "unairu",  label: "Unairu"  },
    { key: "penjaga", label: "Penjaga" },
    { key: "umbra",   label: "Umbra"   },
];
const STATUS_TIPS: Record<string, string> = {
    impact:      "Knockback (5 stacks max): Staggers enemy, increases Parazon mercy kill threshold by 8% per stack (max +40%). Enemy only.",
    puncture:    "Weakened (5 stacks max): 1st stack −40% enemy damage. Each subsequent stack −10% more, max −80%. Also grants +5% enemy Crit Chance threshold per stack (max +25%).",
    slash:       "Bleed: Deals 35% base damage/sec over 6s, ignoring armor. Each proc is independent — multiple stacks deal multiple simultaneous DoTs.",
    heat:        "Ignite: Deals 50% base damage/sec as Heat DoT over 6s after a 1s delay and gradually strips up to 50% armor over 2s. Panic duration depends on enemy type (about 4s for humanoids, 3s for most Infested, and 2s for MOAs/Chargers); Ospreys, bosses, Tenno, and enemies with active Overguard are immune to the crowd control. Applying Heat again reapplies panic, and breaking Overguard triggers it even without a new Heat proc. This target-dependent utility is not included in the optimizer score.",
    cold:        "Freeze (10 stacks max): −50% movement/fire/attack speed. Each extra stack adds −5% slow (max −90% at 9 stacks). At 10 stacks: enemy freezes solid for 3s, shields stop recharging, +1.0 crit multiplier bonus.",
    electricity: "Tesla Chain: Deals 50% base damage/sec as Electricity to enemies within 3m. Stuns primary target for 3s.",
    toxin:       "Poison: Deals 50% base damage/sec as Toxin DoT over 6s. Bypasses shields — damage goes directly to health.",
    blast:       "Detonate (10 stacks max): Each stack explodes after 1.5s for 30% base damage. At 10 stacks or on death: explosion hits all enemies within 5m for 300% × stacks. Removed the old 'inaccuracy' effect.",
    corrosive:   "Corrosion (10 stacks max): Removes 26% armor on first stack, then 6% per additional stack — max 80% armor stripped at 10 stacks. Lasts 8s per stack.",
    gas:         "Gas Cloud: Deals 50% base damage/sec as Gas DoT in a 3m radius (up to 6m at 10 stacks). Stacks increase radius by 0.3m each.",
    magnetic:    "Disrupt (10 stacks max): Amplifies damage to Shields/Overguard by 100% (first stack), +25% each subsequent stack (max +325%). Stops shield regen. On shield break: deals Electricity damage equal to 3% of max shields per stack.",
    radiation:   "Confusion (10 stacks max): Enemy attacks closest ally, receives +100% friendly-fire damage (first stack), +50% per additional stack (max +550% at 10). Lasts 12s per stack.",
    viral:       "Virus (10 stacks max): Amplifies damage to health by 100% (first stack), +25% each subsequent stack (max +325%). Lasts 6s per stack.",
    void:        "Bullet Attract: Void effects can create a bullet attractor effect on the target.",
    tau:         "Status Vulnerability: Tau effects increase the target's vulnerability to status.",
    true:        "True Damage: Direct damage that bypasses normal mitigation rules.",
};
const BASIC_STAT_TOOLTIPS: Record<string, string> = {
    attackSpeed: "Modifies how fast the attack animation plays. Actual attacks per second vary by weapon type and stance.",
    fireRate: "Maximum number of discrete attack events or damage instances performed per second.",
    magazine: "The number of uses available before a reload or refill is required. Weapons without an explicit magazine are shown here as infinite.",
    reload: "The time spent replenishing the weapon's available uses, determined by its reload animation speed and any reload speed modifiers.",
    multishot: "The number of damage instances created by a single attack input without consuming additional ammo or uses. Each instance rolls crit and status independently.",
    burstDps: "Burst DPS is a Tenno Hub derived stat: expected damage per second under continuous firing with no reload downtime.",
    sustainedDps: "Sustained DPS is a Tenno Hub derived stat: expected damage per second after accounting for reload downtime where applicable.",
    criticalChance: "Chance that an attack becomes a critical hit. At 50%, about half of hits crit. At 100%, every hit is at least a yellow crit. Above 100%, the extra amount becomes a chance for a stronger crit tier: 125% means every hit is yellow and 25% become orange; 250% means every hit is orange and 50% become red.",
    criticalDamage: "Damage multiplier used when a hit crits. A yellow crit uses the listed multiplier, so 2.0x means double damage and 3.0x means triple. Orange and red crits are stronger tiers: orange uses 1 + 2 × (crit multiplier - 1), and red uses 1 + 3 × (crit multiplier - 1).",
    statusChance: "The probability that each hit inflicts a status effect. Values over 100% can apply multiple status effects in one hit.",
    totalDamage: "Unquantized Arsenal Total Damage after damage construction and multishot, before crit weighting. Modeled unique damage bonuses on generated projectiles are included; quantized per-projectile direct damage is shown separately.",
};

function describeMultishot(multishot: number) {
    const guaranteed = Math.floor(multishot);
    const extraChance = Math.max(0, multishot - guaranteed);
    if (multishot <= 1) return `This attack currently creates ${multishot.toFixed(2)} damage instances on average, so there are no additional guaranteed instances beyond the base hit.`;
    if (extraChance <= 0.0001) return `This attack currently creates ${guaranteed} damage instances every time. Each instance rolls critical hits and status independently.`;
    return `This attack currently creates ${guaranteed} guaranteed damage instance${guaranteed === 1 ? "" : "s"} with a ${(extraChance * 100).toFixed(1)}% chance to create one more. Each instance rolls critical hits and status independently.`;
}

function describeStatusChance(statusChance: number) {
    if (statusChance < 1) {
        return `Each damage instance currently has a ${(statusChance * 100).toFixed(1)}% chance to apply a status effect.`;
    }
    const guaranteed = Math.floor(statusChance);
    const extraChance = statusChance - guaranteed;
    if (extraChance <= 0.0001) {
        return `Each damage instance currently applies ${guaranteed} guaranteed status effect${guaranteed === 1 ? "" : "s"}.`;
    }
    return `Each damage instance currently applies ${guaranteed} guaranteed status effect${guaranteed === 1 ? "" : "s"} with a ${(extraChance * 100).toFixed(1)}% chance to apply one additional status effect.`;
}

function describeCritChance(critChance: number) {
    if (critChance < 1) {
        return `Each damage instance currently has a ${(critChance * 100).toFixed(1)}% chance to be a yellow crit and a ${((1 - critChance) * 100).toFixed(1)}% chance to stay non-critical.`;
    }
    if (critChance < 2) {
        return `Every damage instance is currently at least a yellow crit, with a ${((critChance - 1) * 100).toFixed(1)}% chance to upgrade to an orange crit.`;
    }
    if (critChance < 3) {
        return `Every damage instance is currently at least an orange crit, with a ${((critChance - 2) * 100).toFixed(1)}% chance to upgrade to a red crit.`;
    }
    return `Every damage instance is currently at least a red crit, with a ${((critChance - Math.floor(critChance)) * 100).toFixed(1)}% chance to upgrade to the next crit tier.`;
}

function describeCritMultiplier(critChance: number, critMultiplier: number) {
    const yellow = critMultiplier;
    const orange = 1 + 2 * (critMultiplier - 1);
    const red = 1 + 3 * (critMultiplier - 1);
    if (critChance < 1) {
        return `A yellow crit currently deals ${yellow.toFixed(2)}x normal damage. Because crit chance is below 100%, only some hits receive that multiplier.`;
    }
    if (critChance < 2) {
        return `A yellow crit currently deals ${yellow.toFixed(2)}x normal damage. Since every hit is at least yellow, that is your baseline crit multiplier, and upgraded orange crits deal ${orange.toFixed(2)}x damage.`;
    }
    return `Orange crits currently deal ${orange.toFixed(2)}x normal damage, and red crits deal ${red.toFixed(2)}x.`;
}
const EMPTY_SAVED_BUILDS: SavedBuild[] = [];
const EMPTY_COUNTS: Record<string, number> = {};
const EMPTY_MOD_RANKS: Record<string, number> = {};
const EMPTY_ARCANE_RANKS: Record<string, Record<string, number>> = {};
const EMPTY_CUSTOM_RIVENS: CustomRivenRecord[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, d = 0) {
    return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function displayMagazineValue(weapon: WeaponEntry, magazineSize: number) {
    return weapon.hasExplicitMagazineSize ? String(magazineSize) : "∞";
}

function usesHitTerminology(category: WeaponCategory) {
    return usesMeleeDamageModel(category);
}

function averageDamageLabel(category: WeaponCategory) {
    return usesHitTerminology(category) ? "Avg Hit" : "Avg Shot";
}

function actionUnitLabel(category: WeaponCategory) {
    return usesHitTerminology(category) ? "hit" : "shot";
}

function actionRateLabel(category: WeaponCategory) {
    return usesHitTerminology(category) ? "Attack Speed" : "Fire Rate";
}

function normalizeBuilderModPath(path: string): string {
    return path
        .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
        .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function isBuilderBeginnerPath(path: string): boolean {
    return /\/beginner\//i.test(path) || /Beginner$/i.test(path);
}

function isBuilderExpertPath(path: string): boolean {
    return /\/expert\//i.test(path) || /Expert$/i.test(path);
}

function getBuilderModVariantTier(entry: ModEntry): "flawed" | "standard" | "expert" {
    if (isBuilderBeginnerPath(entry.path)) return "flawed";
    if (isBuilderExpertPath(entry.path)) return "expert";
    return normalizeBuilderModPath(entry.path) !== entry.path && /Intermediate/.test(entry.path) ? "standard" : "standard";
}

function getBuilderDisplayModName(entry: ModEntry): string {
    return getBuilderModVariantTier(entry) === "flawed" ? `${entry.name} (Flawed)` : entry.name;
}

function normalizeArcaneDisplayText(value: string | null | undefined) {
    if (!value) return value ?? "";
    const parts = value
        .split(/\s+\|\s+|\s+·\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) return value;

    const baseParts = parts.filter((part) => !/^(On |While |Gain |If |Enemies|Kill|When|Deals)/i.test(part));
    const cleaned = parts
        .map((part) => {
            if (!/^(On |While |Gain |If |Enemies|Kill|When|Deals)/i.test(part)) return part;
            let next = part;
            for (const base of baseParts) {
                if (next.toLowerCase() === base.toLowerCase()) continue;
                next = next
                    .replace(new RegExp(`(?:\\s*[|·]\\s*)?${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/\s+\.\s*$/g, ".")
                    .trim();
            }
            return next;
        })
        .filter(Boolean);

    const seen = new Set<string>();
    const deduped = cleaned.filter((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return deduped.join(" | ");
}

function svgPolarityIconMarkup(polarity: string | null | undefined, x: number, y: number, size = 16) {
    const normalized = (polarity ?? "").toLowerCase();
    const raw = POL_SVG_RAW[POL_FILE[normalized] ?? ""] ?? null;
    if (!raw) return `<text x="${x}" y="${y + size - 2}" class="slotMeta">○</text>`;
    const inner = raw
        .replace(/<\?xml[\s\S]*?\?>/g, "")
        .replace(/<svg[^>]*>/i, "")
        .replace(/<\/svg>\s*$/i, "")
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
        .replace(/<defs[\s\S]*?<\/defs>/gi, "")
        .replace(/<defs[^>]\/>/gi, "")
        .replace(/<sodipodi:namedview[\s\S]*?\/>/gi, "")
        .replace(/\s+[a-zA-Z_][\w.-]*:[\w.-]+="[^"]*"/g, "")
        .replace(/\s+[a-zA-Z_][\w.-]*:[\w.-]+='[^']*'/g, "")
        .replace(/<\/?[a-zA-Z_][\w.-]*:[\w.-]+[^>]*>/g, "")
        .replace(/fill:#000000/gi, "fill:#cbd5e1")
        .replace(/stroke:#000000/gi, "stroke:#cbd5e1");
    const scale = size / 50;
    return `<g transform="translate(${x}, ${y}) scale(${scale})" opacity="0.78">${inner}</g>`;
}

interface BuildMathSection {
    title: string;
    lines: string[];
}

interface BuildMathBreakdown {
    sections: BuildMathSection[];
}

interface MeleeDpsInputState {
    averageComboDamageMultiplier: number | null;
    baseComboLengthSeconds: number | null;
}

function parsePositivePlannerInput(value: string, max: number): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(max, parsed);
}

function readPositivePlannerInput(value: number | undefined, max: number): number | null {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) return null;
    return Math.min(max, value ?? max);
}

function readWarframeArmor(value: number | undefined): number | undefined {
    if (!Number.isFinite(value) || (value ?? -1) < 0) return undefined;
    return Math.floor(Math.min(10_000, value ?? 0));
}

function parseWarframeArmorInput(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.floor(Math.min(10_000, parsed))
        : undefined;
}

function parseWarframeMaxEnergyInput(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.floor(Math.min(10_000, parsed))
        : undefined;
}

function parseWarframeEnergyPercentInput(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.min(100, parsed)
        : undefined;
}

interface BuildExportPayload {
    exportedAt: string;
    source: string;
    weapon: {
        name: string;
        uniqueName: string;
        category: WeaponCategory;
        selectedAttack: string | null;
    };
    assumptions: {
        goal: LegacyOptimizeGoal;
        targetFaction: string | null;
        targetProfileOverride?: TargetProfileOverride;
        weaponRank: number;
        masteryRank: number;
        hasCatalyst: boolean;
        formaCount: number;
        valenceBonusPct?: number;
        valenceElement?: string | null;
        optimizeValenceElement?: boolean;
        incarnonUnlockedTier?: number;
        incarnonSelectedOptionsByTier?: Partial<Record<IncarnonTier, string>>;
        optimizeIncarnonSelections?: boolean;
        includeArcaneStats: boolean;
        warframeArmor?: number;
        warframeMaxEnergy?: number;
        warframeEnergyPercent?: number;
        selectedAttackIdx: number;
        meleeAverageComboDamageMultiplier?: number | null;
        meleeBaseComboLengthSeconds?: number | null;
    };
    optimizer: {
        mode: OptimizeMode;
        options: {
            respectCapacity: boolean;
            allowNonMaxRank: boolean;
            ownedOnly: boolean;
            factionFocus: boolean;
            allowCatalyst: boolean;
            allowForma: boolean;
            maxFormaAllowed: number;
            optimizeExilus: boolean;
            optimizeArcane: boolean;
            conditionalState?: ConditionalState;
        };
        pools: {
            compatibleMods: number;
            compatibleArcanes: number;
            ownedMods?: Array<{
                name: string;
                uniqueName: string;
                ownedMaxRank: number;
            }>;
            ownedArcanes?: Array<{
                name: string;
                uniqueName: string;
                ownedMaxRank: number;
            }>;
            excludedMods?: Array<{
                name: string;
                uniqueName: string;
            }>;
        };
    };
    build: {
        stance: {
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            slotPolarity: string;
            statsLabel: string | null;
        };
        slots: Array<{
            slot: number;
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            slotPolarity: string;
            modPolarity: string | null;
            statsLabel: string | null;
        }>;
        exilus: {
            enabled: boolean;
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            slotPolarity: string;
            statsLabel: string | null;
        };
        arcane: {
            mod: string | null;
            uniqueName: string | null;
            rank: number;
            statsLabel: string | null;
        };
    };
    calculated: (ReturnType<typeof calculateBuild> & {
        meleeAverageDps?: (MeleeAverageDpsParameters & { averageHit: number; averageDps: number }) | null;
    }) | null;
    math: BuildMathBreakdown | null;
}

function escapeSvgText(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function wrapSvgText(value: string, maxChars: number) {
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars) {
            current = next;
            continue;
        }
        if (current) lines.push(current);
        if (word.length <= maxChars) {
            current = word;
            continue;
        }
        const chunks = word.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [word];
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1] ?? "";
    }
    if (current) lines.push(current);
    return lines;
}

function goalLabelForShare(goal: LegacyOptimizeGoal) {
    return GOAL_OPTIONS.find((option) => option.key === normalizeOptimizeGoal(goal))?.label ?? goal;
}

function renderSvgParagraph(lines: string[], x: number, y: number, lineHeight: number, className: string) {
    const escaped = lines.map((line) => escapeSvgText(line));
    return `<text x="${x}" y="${y}" class="${className}">${escaped
        .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`)
        .join("")}</text>`;
}

function renderBuildShareSvg(payload: BuildExportPayload) {
    const width = 1440;
    const isMelee = isGroundMeleeCategory(payload.weapon.category);
    const stats = payload.calculated?.modded ?? null;
    const burstDps = payload.calculated?.burstDPS ?? 0;
    const sustainedDps = payload.calculated?.sustainedDPS ?? 0;
    const attackLabel = payload.weapon.selectedAttack ?? "Default Attack";
    const factionLabel = payload.assumptions.targetFaction ?? "General Use";
    const goalLabel = goalLabelForShare(payload.assumptions.goal);
    const weaponSubtitle = `${payload.weapon.category} • ${attackLabel}`;
    const avgDamageStatLabel = averageDamageLabel(payload.weapon.category);
    const rateStatLabel = actionRateLabel(payload.weapon.category);
    const summaryStats = [
        ["Burst DPS", fmt(burstDps)],
        ["Sustain DPS", fmt(sustainedDps)],
        [avgDamageStatLabel, fmt(stats?.averageShotDamage ?? 0)],
        ["Quantized Direct", fmt(stats?.totalDamage ?? 0)],
        ["Arsenal Total", fmt(stats?.arsenalDamage ?? 0)],
        ["Crit Chance", `${fmt((stats?.critChance ?? 0) * 100, 1)}%`],
        ["Crit Mult", `${fmt(stats?.critMultiplier ?? 0, 2)}x`],
        ["Status", `${fmt((stats?.statusChance ?? 0) * 100, 1)}%`],
        ["Multishot", `${fmt(stats?.multishot ?? 0, 2)}x`],
        [rateStatLabel, `${fmt(stats?.fireRate ?? 0, 2)}/s`],
        ["Magazine", stats ? fmt(stats.magazineSize, 0) : "0"],
        ["Shots / Mag", stats ? (stats.infiniteAmmoActive ? "∞" : fmt(stats.shotsPerMag, 0)) : "0"],
        ["Reload", stats?.infiniteAmmoActive ? "None" : `${fmt(stats?.reloadTime ?? 0, 2)}s`],
        ["DoT DPS", fmt(stats?.dotDps ?? 0)],
        ...(payload.calculated?.meleeAverageDps
            ? [["Stance Avg DPS", fmt(payload.calculated.meleeAverageDps.averageDps)]]
            : []),
    ];
    const damageRows = stats
        ? Object.entries(stats.rawDamageBreakdown)
              .filter(([, value]) => value > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
        : [];
    const slotCardWidth = 206;
    const slotGap = 16;
    const slotTopY = 258;
    const leftPanelX = 72;
    const slotCards = payload.build.slots.map((slot) => {
        const titleLines = wrapSvgText(slot.mod ?? `Empty Slot ${slot.slot}`, 20);
        const bodyLines = wrapSvgText(slot.statsLabel ?? "Open slot", 27);
        const height = 128 + Math.max(0, titleLines.length - 1) * 18 + bodyLines.length * 15;
        return {
            title: slot.mod ?? `Empty Slot ${slot.slot}`,
            subtitle: slot.mod ? `Rank ${slot.rank}` : "No mod equipped",
            body: slot.statsLabel ?? "Open slot",
            accent: slot.mod ? "#60a5fa" : "#475569",
            slotLabel: `Slot ${slot.slot}`,
            polarity: slot.slotPolarity,
            titleLines,
            bodyLines,
            height,
        };
    });
    const slotRows = [slotCards.slice(0, 4), slotCards.slice(4, 8)];
    const slotRowHeights = slotRows.map((row) => Math.max(...row.map((card) => card.height)));
    const slotRowYs = slotRowHeights.reduce<number[]>((ys, _, index) => {
        if (index === 0) return [slotTopY];
        return [...ys, ys[index - 1] + slotRowHeights[index - 1] + 22];
    }, []);
    const slotBlocks = slotRows
        .map((row, rowIndex) =>
            row
                .map((slot, colIndex) => {
                    const x = leftPanelX + colIndex * (slotCardWidth + slotGap);
                    const y = slotRowYs[rowIndex];
                    return `
                      <g transform="translate(${x}, ${y})">
                        <rect width="${slotCardWidth}" height="${slotRowHeights[rowIndex]}" rx="18" fill="#091120" fill-opacity="0.76" stroke="${slot.accent}" stroke-opacity="0.35" />
                        <rect x="16" y="18" width="${slotCardWidth - 32}" height="10" rx="5" fill="${slot.accent}" fill-opacity="0.22" />
                        <text x="16" y="45" class="slotEyebrow">${escapeSvgText(slot.slotLabel)}</text>
                        ${svgPolarityIconMarkup(slot.polarity, slotCardWidth - 32, 26, 16)}
                        ${renderSvgParagraph(slot.titleLines, 16, 67, 18, "slotTitle")}
                        <text x="16" y="${85 + Math.max(0, slot.titleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(slot.subtitle)}</text>
                        ${renderSvgParagraph(slot.bodyLines, 16, 105 + Math.max(0, slot.titleLines.length - 1) * 18, 15, "slotBody")}
                      </g>
                    `;
                })
                .join(""),
        )
        .join("");
    const modGridBottom = slotRowYs[slotRowYs.length - 1] + slotRowHeights[slotRowHeights.length - 1];
    const stanceTitleLines = wrapSvgText(payload.build.stance.mod ?? "No Stance", 28);
    const stanceBodyLines = wrapSvgText(payload.build.stance.statsLabel ?? "No stance mod equipped", 34);
    const stanceHeight = 96 + Math.max(0, stanceTitleLines.length - 1) * 18 + stanceBodyLines.length * 17;
    const exilusTitleLines = wrapSvgText(payload.build.exilus.mod ?? "No Exilus", 28);
    const exilusBodyLines = wrapSvgText(payload.build.exilus.statsLabel ?? "No exilus mod equipped", 34);
    const exilusHeight = 96 + Math.max(0, exilusTitleLines.length - 1) * 18 + exilusBodyLines.length * 17;
    const arcaneTitleLines = wrapSvgText(payload.build.arcane.mod ?? "No Arcane", 28);
    const arcaneBodyLines = wrapSvgText(payload.build.arcane.statsLabel ?? "No arcane equipped", 34);
    const arcaneHeight = 96 + Math.max(0, arcaneTitleLines.length - 1) * 18 + arcaneBodyLines.length * 17;
    const rightRailX = leftPanelX + 4 * (slotCardWidth + slotGap) + 34;
    const rightRailWidth = 398;
    const arcaneY = isMelee ? 234 : slotRowYs[0] + Math.max(0, (slotRowHeights[0] - arcaneHeight) / 2);
    const exilusY = isMelee ? modGridBottom + 28 : slotRowYs[1] + Math.max(0, (slotRowHeights[1] - exilusHeight) / 2);
    const specialRowHeight = Math.max(stanceHeight, exilusHeight);
    const topSectionBottom = Math.max(
        modGridBottom,
        arcaneY + arcaneHeight,
        exilusY + exilusHeight,
        isMelee ? exilusY + specialRowHeight : 0,
    );
    const bottomSectionY = topSectionBottom + 54;
    const performanceTitleY = bottomSectionY + 4;
    const statGridY = bottomSectionY + 28;
    const damageMixTopY = statGridY + 350;

    const defs = `
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#08101f" />
          <stop offset="55%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1a1230" />
        </linearGradient>
        <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#111c33" stop-opacity="0.94" />
          <stop offset="100%" stop-color="#091120" stop-opacity="0.98" />
        </linearGradient>
        <linearGradient id="hero" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#fb923c" stop-opacity="0.22" />
          <stop offset="45%" stop-color="#60a5fa" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.18" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#020617" flood-opacity="0.45" />
        </filter>
        <style>
          .eyebrow { fill: #fdba74; font: 700 18px Inter, system-ui, sans-serif; letter-spacing: 0.32em; text-transform: uppercase; }
          .title { fill: #f8fafc; font: 800 48px Inter, system-ui, sans-serif; }
          .subtitle { fill: #cbd5e1; font: 500 21px Inter, system-ui, sans-serif; }
          .chip { fill: #e2e8f0; font: 700 18px Inter, system-ui, sans-serif; }
          .chipMuted { fill: #94a3b8; font: 600 15px Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
          .section { fill: #94a3b8; font: 700 15px Inter, system-ui, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; }
          .slotTitle { fill: #f8fafc; font: 700 16px Inter, system-ui, sans-serif; }
          .slotMeta { fill: #94a3b8; font: 600 12px Inter, system-ui, sans-serif; }
          .slotBody { fill: #cbd5e1; font: 500 11px Inter, system-ui, sans-serif; }
          .slotEyebrow { fill: #64748b; font: 700 10px Inter, system-ui, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; }
          .statLabel { fill: #94a3b8; font: 600 13px Inter, system-ui, sans-serif; letter-spacing: 0.05em; text-transform: uppercase; }
          .statValue { fill: #f8fafc; font: 800 24px Inter, system-ui, sans-serif; }
          .damageLabel { fill: #cbd5e1; font: 600 16px Inter, system-ui, sans-serif; }
          .damageValue { fill: #f8fafc; font: 700 18px Inter, system-ui, sans-serif; }
          .footer { fill: #64748b; font: 500 13px Inter, system-ui, sans-serif; }
        </style>
      </defs>
    `;

    const statBlocks = summaryStats
        .map(([label, value], index) => {
            const col = index % 4;
            const x = 72 + col * 322;
            const y = statGridY + Math.floor(index / 4) * 108;
            return `
              <g transform="translate(${x}, ${y})">
                <rect width="290" height="86" rx="18" fill="#08101f" fill-opacity="0.82" stroke="#334155" stroke-opacity="0.7" />
                <text x="18" y="30" class="statLabel">${escapeSvgText(label)}</text>
                <text x="18" y="62" class="statValue">${escapeSvgText(value)}</text>
              </g>
            `;
        })
        .join("");

    const damageBlocks = damageRows
        .map(([key, value], index) => {
            const y = damageMixTopY + 24 + index * 46;
            const pct = stats && stats.totalDamage > 0 ? `${fmt((value / stats.totalDamage) * 100, 1)}%` : "0%";
            return `
              <g transform="translate(72, ${y})">
                <rect width="576" height="34" rx="17" fill="#08101f" fill-opacity="0.75" />
                <text x="18" y="23" class="damageLabel">${escapeSvgText(key.charAt(0).toUpperCase() + key.slice(1))}</text>
                <text x="432" y="23" text-anchor="end" class="damageLabel">${escapeSvgText(pct)}</text>
                <text x="558" y="23" text-anchor="end" class="damageValue">${escapeSvgText(fmt(value, 1))}</text>
              </g>
            `;
        })
        .join("");
    const specialCardWidth = 428;
    const exilusBlock = `
      <g transform="translate(${isMelee ? leftPanelX + specialCardWidth + slotGap : rightRailX}, ${exilusY})">
        <rect width="${isMelee ? specialCardWidth : rightRailWidth}" height="${exilusHeight}" rx="22" fill="#091120" fill-opacity="0.76" stroke="${payload.build.exilus.mod ? "#f59e0b" : "#475569"}" stroke-opacity="0.35" />
        <text x="26" y="26" class="slotEyebrow">Exilus</text>
        ${svgPolarityIconMarkup(payload.build.exilus.slotPolarity, (isMelee ? specialCardWidth : rightRailWidth) - 34, 18, 18)}
        ${renderSvgParagraph(exilusTitleLines, 26, 54, 18, "slotTitle")}
        <text x="26" y="${78 + Math.max(0, exilusTitleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(
            payload.build.exilus.mod ? `Exilus • Rank ${payload.build.exilus.rank}` : "Exilus slot",
        )}</text>
        ${renderSvgParagraph(exilusBodyLines, 26, 102 + Math.max(0, exilusTitleLines.length - 1) * 18, 17, "slotBody")}
      </g>
    `;
    const stanceBlock = isMelee ? `
      <g transform="translate(72, ${exilusY})">
        <rect width="${specialCardWidth}" height="${stanceHeight}" rx="22" fill="#091120" fill-opacity="0.76" stroke="${payload.build.stance.mod ? "#f472b6" : "#475569"}" stroke-opacity="0.35" />
        <text x="26" y="26" class="slotEyebrow">Stance</text>
        ${svgPolarityIconMarkup(payload.build.stance.slotPolarity, specialCardWidth - 34, 18, 18)}
        ${renderSvgParagraph(stanceTitleLines, 26, 54, 18, "slotTitle")}
        <text x="26" y="${78 + Math.max(0, stanceTitleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(
            payload.build.stance.mod ? `Stance • Rank ${payload.build.stance.rank}` : "Stance slot",
        )}</text>
        ${renderSvgParagraph(stanceBodyLines, 26, 102 + Math.max(0, stanceTitleLines.length - 1) * 18, 17, "slotBody")}
      </g>
    ` : "";
    const arcaneBlock = `
      <g transform="translate(${rightRailX}, ${arcaneY})">
        <rect width="${rightRailWidth}" height="${arcaneHeight}" rx="22" fill="#091120" fill-opacity="0.76" stroke="${payload.build.arcane.mod ? "#c084fc" : "#475569"}" stroke-opacity="0.35" />
        <text x="26" y="26" class="slotEyebrow">Arcane</text>
        ${renderSvgParagraph(arcaneTitleLines, 26, 54, 18, "slotTitle")}
        <text x="26" y="${78 + Math.max(0, arcaneTitleLines.length - 1) * 18}" class="slotMeta">${escapeSvgText(
            payload.build.arcane.mod ? `Arcane • Rank ${payload.build.arcane.rank}` : "Arcane slot",
        )}</text>
        ${renderSvgParagraph(arcaneBodyLines, 26, 102 + Math.max(0, arcaneTitleLines.length - 1) * 18, 17, "slotBody")}
      </g>
    `;
    const bottomPanelHeight = 540;
    const footerY = Math.max(bottomSectionY + bottomPanelHeight + 26, damageMixTopY + 24 + damageRows.length * 46 + 54, 1088);
    const height = footerY + 40;
    const titleChipStartX = Math.min(760, 92 + payload.weapon.name.length * 26);
    const titleChipY = 110;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${defs}
        <rect width="${width}" height="${height}" fill="url(#bg)" />
        <circle cx="1200" cy="120" r="240" fill="#0ea5e9" fill-opacity="0.08" />
        <circle cx="180" cy="980" r="220" fill="#f97316" fill-opacity="0.10" />
        <rect x="38" y="38" width="${width - 76}" height="${height - 76}" rx="34" fill="url(#panel)" stroke="#334155" stroke-opacity="0.85" filter="url(#shadow)" />
        <rect x="56" y="56" width="${width - 112}" height="156" rx="28" fill="url(#hero)" />
        <rect x="56" y="${bottomSectionY - 20}" width="${width - 112}" height="${footerY - (bottomSectionY - 20) - 26}" rx="28" fill="#0a1324" fill-opacity="0.72" stroke="#1e293b" stroke-opacity="0.55" />

        <text x="84" y="100" class="eyebrow">Arsenal Modding</text>
        <text x="84" y="150" class="title">${escapeSvgText(payload.weapon.name)}</text>
        <text x="84" y="184" class="subtitle">${escapeSvgText(weaponSubtitle)}</text>
        <g transform="translate(${titleChipStartX}, ${titleChipY})">
          <rect width="126" height="34" rx="17" fill="#0f172a" fill-opacity="0.78" stroke="#475569" stroke-opacity="0.65" />
          <text x="63" y="22" text-anchor="middle" class="chip">${escapeSvgText(`${payload.assumptions.formaCount} Forma`)}</text>
        </g>
        ${
            payload.assumptions.hasCatalyst
                ? `<g transform="translate(${titleChipStartX + 138}, ${titleChipY})">
          <rect width="128" height="34" rx="17" fill="#451a03" fill-opacity="0.35" stroke="#f59e0b" stroke-opacity="0.6" />
          <text x="64" y="22" text-anchor="middle" class="chip">Catalyst</text>
        </g>`
                : ""
        }

        <g transform="translate(920, 94)">
          <rect width="170" height="40" rx="20" fill="#0f172a" fill-opacity="0.78" stroke="#fb923c" stroke-opacity="0.45" />
          <text x="85" y="26" text-anchor="middle" class="chip">${escapeSvgText(goalLabel)}</text>
        </g>
        <g transform="translate(1106, 94)">
          <rect width="214" height="40" rx="20" fill="#0f172a" fill-opacity="0.78" stroke="#60a5fa" stroke-opacity="0.45" />
          <text x="107" y="18" text-anchor="middle" class="chipMuted">Target</text>
          <text x="107" y="32" text-anchor="middle" class="chip">${escapeSvgText(factionLabel)}</text>
        </g>

        <text x="72" y="234" class="section">Mods</text>
        ${slotBlocks}
        ${stanceBlock}
        ${exilusBlock}
        ${arcaneBlock}

        <text x="72" y="${performanceTitleY}" class="section">Performance</text>
        ${statBlocks}

        <text x="72" y="${damageMixTopY}" class="section">Damage Mix</text>
        ${damageBlocks || `<text x="72" y="${damageMixTopY + 44}" class="slotBody">No damage data available for this build snapshot.</text>`}

        <text x="72" y="${footerY}" class="footer">Generated by Tenno Hub • ${escapeSvgText(new Date(payload.exportedAt).toLocaleString("en-US"))}</text>
      </svg>
    `.trim();
}

async function generateBuildShareImage(payload: BuildExportPayload) {
    const svg = renderBuildShareSvg(payload);
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Unable to render build share image."));
            img.src = svgUrl;
        });
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Unable to create image canvas.");
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("Unable to export build image.");
        return blob;
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

function applyValenceToDamage(
    damage: WeaponEntry["damage"],
    bonusPct: number,
    element: ValenceElement,
) {
    if (bonusPct <= 0 || damage.total <= 0) return damage;
    const bonus = damage.total * bonusPct;
    return {
        ...damage,
        [element]: damage[element] + bonus,
        total: damage.total + bonus,
    };
}

function applyValenceToWeapon(
    weapon: WeaponEntry,
    bonusPct: number,
    element: ValenceElement,
): WeaponEntry {
    if (!weapon.isProgenitorWeapon || bonusPct <= 0) return weapon;
    return {
        ...weapon,
        damage: applyValenceToDamage(weapon.damage, bonusPct, element),
        attacks: weapon.attacks.map((attack) => {
            const damage = applyValenceToDamage(attack.damage, bonusPct, element);
            return { ...attack, damage, damageTotal: damage.total };
        }),
    };
}

function makeSelectedAttackWeapon(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
): WeaponEntry {
    return withSelectedAttack(weapon, selectedAttackIdx);
}

function applyWeaponConfig(
    weapon: WeaponEntry,
    selectedAttackIdx: number,
    buildCfg: BuildCfg,
) {
    const withValence = applyValenceToWeapon(weapon, buildCfg.valenceBonusPct, buildCfg.valenceElement);
    const incarnon = resolveIncarnonState(withValence, selectedAttackIdx, {
        unlockedTier: buildCfg.incarnonUnlockedTier,
        selectedOptionsByTier: buildCfg.incarnonSelectedOptionsByTier,
    });
    return {
        weaponWithIntrinsicOptions: incarnon.weapon,
        selectedWeapon: makeSelectedAttackWeapon(incarnon.weapon, selectedAttackIdx),
        activeIncarnonEffects: incarnon.activeEffects,
        incarnonRecord: incarnon.record,
        appliedIncarnonOptions: incarnon.appliedOptions,
    };
}

function getSelectedIncarnonTierCount(selectedOptionsByTier: Partial<Record<IncarnonTier, string>>) {
    return INCARNON_TIER_ORDER.filter((tier) => Boolean(selectedOptionsByTier[tier])).length;
}

function getHighestSelectedIncarnonTier(selectedOptionsByTier: Partial<Record<IncarnonTier, string>>) {
    return INCARNON_TIER_ORDER.reduce((highest, tier) => (
        selectedOptionsByTier[tier] ? tier : highest
    ), 0);
}

function sumEffects(effects: (ModEffect | null)[]) {
    return effects.reduce((acc, effect) => {
        if (!effect) return acc;
        acc.damageBonus += effect.damageBonus ?? 0;
        acc.conditionOverloadDamagePerStatusBonus += effect.conditionOverloadDamagePerStatusBonus ?? 0;
        acc.impactBonus += effect.impactBonus ?? 0;
        acc.punctureBonus += effect.punctureBonus ?? 0;
        acc.slashBonus += effect.slashBonus ?? 0;
        acc.heatBonus += effect.heatBonus ?? 0;
        acc.coldBonus += effect.coldBonus ?? 0;
        acc.electricityBonus += effect.electricityBonus ?? 0;
        acc.toxinBonus += effect.toxinBonus ?? 0;
        acc.blastBonus += effect.blastBonus ?? 0;
        acc.gasBonus += effect.gasBonus ?? 0;
        acc.magneticBonus += effect.magneticBonus ?? 0;
        acc.radiationBonus += effect.radiationBonus ?? 0;
        acc.viralBonus += effect.viralBonus ?? 0;
        acc.corrosiveBonus += effect.corrosiveBonus ?? 0;
        acc.voidBonus += effect.voidBonus ?? 0;
        acc.tauBonus += effect.tauBonus ?? 0;
        acc.trueBonus += effect.trueBonus ?? 0;
        acc.critChanceBonus += effect.critChanceBonus ?? 0;
        acc.comboCritChanceBonus += effect.comboCritChanceBonus ?? 0;
        acc.finalCritChanceBonus += effect.finalCritChanceBonus ?? 0;
        acc.critMultBonus += effect.critMultBonus ?? 0;
        acc.finalCritMultiplierBonus += effect.finalCritMultiplierBonus ?? 0;
        acc.statusChanceBonus += effect.statusChanceBonus ?? 0;
        acc.comboStatusChanceBonus += effect.comboStatusChanceBonus ?? 0;
        acc.finalStatusChanceBonus += effect.finalStatusChanceBonus ?? 0;
        acc.multishotBonus += effect.multishotBonus ?? 0;
        acc.multishotDamageBonus += effect.multishotDamageBonus ?? 0;
        acc.fireRateBonus += effect.fireRateBonus ?? 0;
        acc.attackSpeedBonus += effect.attackSpeedBonus ?? 0;
        acc.magazineBonus += effect.magazineBonus ?? 0;
        acc.reloadSpeedBonus += effect.reloadSpeedBonus ?? 0;
        acc.statusDamageBonus += effect.statusDamageBonus ?? 0;
        acc.statusDurationBonus += effect.statusDurationBonus ?? 0;
        if (effect.targetFaction) acc.factionDamageBonus += effect.factionDamageBonus ?? 0;
        return acc;
    }, {
        damageBonus: 0,
        conditionOverloadDamagePerStatusBonus: 0,
        impactBonus: 0,
        punctureBonus: 0,
        slashBonus: 0,
        heatBonus: 0,
        coldBonus: 0,
        electricityBonus: 0,
        toxinBonus: 0,
        blastBonus: 0,
        gasBonus: 0,
        magneticBonus: 0,
        radiationBonus: 0,
        viralBonus: 0,
        corrosiveBonus: 0,
        voidBonus: 0,
        tauBonus: 0,
        trueBonus: 0,
        critChanceBonus: 0,
        comboCritChanceBonus: 0,
        finalCritChanceBonus: 0,
        critMultBonus: 0,
        finalCritMultiplierBonus: 0,
        statusChanceBonus: 0,
        comboStatusChanceBonus: 0,
        finalStatusChanceBonus: 0,
        multishotBonus: 0,
        multishotDamageBonus: 0,
        fireRateBonus: 0,
        attackSpeedBonus: 0,
        magazineBonus: 0,
        reloadSpeedBonus: 0,
        statusDamageBonus: 0,
        statusDurationBonus: 0,
        factionDamageBonus: 0,
    });
}

function getOwnedModRank(
    path: string,
    maxRank: number,
    counts: Record<string, number>,
    modRanks: Record<string, number>,
) {
    const owned = Number(counts[`mods:${path}`] ?? counts[path] ?? 0);
    if (owned <= 0) return 0;
    return Math.max(0, Math.min(maxRank, Number(modRanks[path] ?? maxRank)));
}

const BUILD_MATH_PRIMARY_ELEMENTS = ["heat", "cold", "electricity", "toxin"] as const;
const BUILD_MATH_COMBINED_ELEMENTS: Record<string, string> = {
    "cold+electricity": "magnetic",
    "electricity+cold": "magnetic",
    "heat+cold": "blast",
    "cold+heat": "blast",
    "heat+electricity": "radiation",
    "electricity+heat": "radiation",
    "heat+toxin": "gas",
    "toxin+heat": "gas",
    "cold+toxin": "viral",
    "toxin+cold": "viral",
    "electricity+toxin": "corrosive",
    "toxin+electricity": "corrosive",
};

function roundQuantizedValue(value: number, quantum: number) {
    if (quantum <= 0) return value;
    return Math.round(value / quantum) * quantum;
}

function buildCombinedRawBreakdown(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
) {
    const totals = sumEffects(effects);
    const baseDamage = weapon.damage.total;
    const moddedBaseDamage = baseDamage * (1 + totals.damageBonus);
    const physicalRaw = {
        impact: weapon.damage.impact * (1 + totals.impactBonus) * (1 + totals.damageBonus),
        puncture: weapon.damage.puncture * (1 + totals.punctureBonus) * (1 + totals.damageBonus),
        slash: weapon.damage.slash * (1 + totals.slashBonus) * (1 + totals.damageBonus),
    };
    const queue: Array<{ type: string; value: number; order: number }> = [];
    effects.forEach((effect, index) => {
        if (!effect) return;
        for (const [entryIndex, key] of BUILD_MATH_PRIMARY_ELEMENTS.entries()) {
            const bonus = effect[`${key}Bonus` as const];
            if (bonus) queue.push({ type: key, value: baseDamage * bonus * (1 + totals.damageBonus), order: (index * 10) + entryIndex });
        }
    });
    let order = effects.length * 10;
    for (const key of ["magnetic", "radiation", "viral", "corrosive", "gas", "blast", "void", "tau", "true"] as const) {
        const bonus = totals[`${key}Bonus` as const];
        if (bonus) queue.push({ type: key, value: baseDamage * bonus * (1 + totals.damageBonus), order: order++ });
    }

    const merged = new Map<string, { value: number; order: number }>();
    for (const entry of queue) {
        const existing = merged.get(entry.type);
        if (existing) {
            existing.value += entry.value;
            existing.order = Math.min(existing.order, entry.order);
        } else {
            merged.set(entry.type, { value: entry.value, order: entry.order });
        }
    }

    const ordered = [...merged.entries()]
        .map(([type, meta]) => ({ type, value: meta.value, order: meta.order }))
        .sort((a, b) => a.order - b.order);

    const combined: Record<string, number> = {
        impact: physicalRaw.impact,
        puncture: physicalRaw.puncture,
        slash: physicalRaw.slash,
        heat: 0,
        cold: 0,
        electricity: 0,
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

    let index = 0;
    while (index < ordered.length) {
        const current = ordered[index];
        const next = ordered[index + 1];
        if (next) {
            const combo = BUILD_MATH_COMBINED_ELEMENTS[`${current.type}+${next.type}`];
            if (combo) {
                combined[combo] += current.value + next.value;
                index += 2;
                continue;
            }
        }
        combined[current.type] += current.value;
        index += 1;
    }

    return { moddedBaseDamage, physicalRaw, orderedElementQueue: ordered, combined };
}

function capitalizeDamageType(value: string) {
    return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatSourceList(values: string[]) {
    const unique = [...new Set(values.filter(Boolean))];
    if (unique.length === 0) return "this build";
    if (unique.length === 1) return unique[0];
    if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
    return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function sanitizeDamageSourceLabel(value: string) {
    return value
        .replace(/\s*\(slot \d+\)$/i, "")
        .replace(/\s*\(exilus\)$/i, "")
        .replace(/\s*\(arcane\)$/i, "")
        .replace(/\s*\(stance\)$/i, "")
        .replace(/\s*\(built-in\)$/i, "");
}

function buildDamageTypeSourceDescriptions(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    sourceLabels: string[],
) {
    const totals = sumEffects(effects);
    const baseDamage = weapon.damage.total;
    const descriptions: Record<string, string> = {};
    const primaryEntries: Array<{ type: string; value: number; order: number; sources: string[] }> = [];

    effects.forEach((effect, index) => {
        if (!effect) return;
        const sourceLabel = sanitizeDamageSourceLabel(sourceLabels[index] ?? "this build");
        for (const [entryIndex, key] of BUILD_MATH_PRIMARY_ELEMENTS.entries()) {
            const bonus = effect[`${key}Bonus` as const];
            if (bonus) {
                primaryEntries.push({
                    type: key,
                    value: baseDamage * bonus * (1 + totals.damageBonus),
                    order: (index * 10) + entryIndex,
                    sources: [sourceLabel],
                });
            }
        }
        for (const key of ["magnetic", "radiation", "viral", "corrosive", "gas", "blast", "void", "tau", "true"] as const) {
            const bonus = effect[`${key}Bonus` as const];
            if (!bonus) continue;
            descriptions[key] = `${capitalizeDamageType(key)} is added directly by ${sourceLabel}.`;
        }
    });

    const collapsed = [...primaryEntries.reduce((map, entry) => {
        const existing = map.get(entry.type);
        if (existing) {
            existing.value += entry.value;
            existing.order = Math.min(existing.order, entry.order);
            existing.sources.push(...entry.sources);
        } else {
            map.set(entry.type, { ...entry, sources: [...entry.sources] });
        }
        return map;
    }, new Map<string, { type: string; value: number; order: number; sources: string[] }>()).values()].sort((a, b) => a.order - b.order);

    let index = 0;
    while (index < collapsed.length) {
        const current = collapsed[index];
        const next = collapsed[index + 1];
        if (next) {
            const combo = BUILD_MATH_COMBINED_ELEMENTS[`${current.type}+${next.type}`];
            if (combo) {
                descriptions[combo] = `${capitalizeDamageType(combo)} comes from ${capitalizeDamageType(current.type)} provided by ${formatSourceList(current.sources)} combining with ${capitalizeDamageType(next.type)} provided by ${formatSourceList(next.sources)}.`;
                index += 2;
                continue;
            }
        }
        descriptions[current.type] = `${capitalizeDamageType(current.type)} is provided by ${formatSourceList(current.sources)}.`;
        index += 1;
    }

    for (const key of ["impact", "puncture", "slash"] as const) {
        if (weapon.damage[key] > 0) descriptions[key] = `${capitalizeDamageType(key)} comes from the weapon's base physical damage.`;
    }

    return descriptions;
}

function buildMathBreakdown(
    weapon: WeaponEntry,
    effects: (ModEffect | null)[],
    targetFaction = "",
    conditionalState: ConditionalState = DEFAULT_CONDITIONAL_STATE,
    targetProfileOverride?: TargetProfileOverride,
    meleeDpsInputs?: MeleeDpsInputState,
): BuildMathBreakdown {
    const totals = sumEffects(effects);
    const result = calculateBuild(weapon, effects, targetFaction, {
        conditionalState,
        statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
        statusStackCaps: targetProfileOverride?.statusStackCaps,
    });
    const stats = result.modded;
    const meleeDpsBaseline = usesMeleeDamageModel(weapon.category) &&
        meleeDpsInputs?.averageComboDamageMultiplier != null &&
        meleeDpsInputs.baseComboLengthSeconds != null
        ? calculateBuild(weapon, effects, targetFaction, {
            conditionalState: { mode: "initial" },
            statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            targetStatusState: "initial",
        }).modded
        : null;
    const meleeAverageDps = meleeDpsBaseline && meleeDpsInputs?.averageComboDamageMultiplier != null && meleeDpsInputs.baseComboLengthSeconds != null
        ? calculateMeleeAverageDps(meleeDpsBaseline, {
            averageComboDamageMultiplier: meleeDpsInputs.averageComboDamageMultiplier,
            baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
        })
        : null;
    const ignoresReloadAndMagazine = !!weapon.isExalted || !!weapon.selectedAttackIsIncarnon;
    const baseDamage = weapon.damage.total;
    const baseDamageMultiplier = 1 + totals.damageBonus;
    const conditionOverloadDamageBracket = 1 + totals.damageBonus +
        (stats.conditionOverloadApplies
            ? stats.conditionOverloadDamagePerStatusBonus * stats.conditionOverloadStatusTypes
            : 0);
    const moddedBaseDamageBeforeConditionOverload = baseDamage * baseDamageMultiplier;
    const moddedBaseDamage = moddedBaseDamageBeforeConditionOverload * stats.conditionOverloadDamageMultiplier;
    const quantScale = (moddedBaseDamage / 32) * (stats.directDamagePerStatusMultiplier || 1);
    const fireRateBonus = usesMeleeDamageModel(weapon.category) ? totals.attackSpeedBonus : totals.fireRateBonus;
    const quantizedShotDamage = stats.totalDamage * stats.damageWeightedMultishot;
    const avgCritMultiplier = quantizedShotDamage > 0 ? stats.averageShotDamage / quantizedShotDamage : 1;
    const hasConditionalBonuses = effects.some(effect => (effect?.conditionalEffects?.length ?? 0) > 0);
    const damageUnit = actionUnitLabel(weapon.category);
    const avgDamageLabel = averageDamageLabel(weapon.category);
    const rateLabel = actionRateLabel(weapon.category);
    const conditionalEntries = effects.flatMap((effect) => effect?.conditionalEffects ?? []);
    const baselineRateForConditionals = calculateBuild(weapon, [], targetFaction, { conditionalState }).modded.fireRate;
    const baseMagazineForConditionals = Math.max(1, Math.round(weapon.magazineSize || 1));
    const rawBreakdown = buildCombinedRawBreakdown(weapon, effects);
    const nonZeroRawEntries = Object.entries(stats.rawDamageBreakdown).filter(([, value]) => value > 0);
    const quantizedLines = nonZeroRawEntries.map(([type, rawValue]) => {
        const ratio = quantScale > 0 ? rawValue / quantScale : 0;
        const roundedUnits = Math.round(ratio);
        const quantized = roundQuantizedValue(rawValue, quantScale);
        return `${type}: raw ${fmt(rawValue, 5)} ÷ scale ${fmt(quantScale, 5)} = ${fmt(ratio, 5)} → round ${roundedUnits} → ${fmt(quantized, 5)}`;
    });
    const procLines = Object.entries(stats.procChanceByType)
        .filter(([, value]) => (value ?? 0) > 0)
        .map(([type, value]) => {
            const damageValue = stats.damageBreakdown[type as keyof typeof stats.damageBreakdown] ?? 0;
            const share = stats.totalDamage > 0 ? damageValue / stats.totalDamage : 0;
            return `${type}: quantized damage ${fmt(damageValue, 5)} ÷ total ${fmt(stats.totalDamage, 5)} = ${fmt(share, 5)} → proc weight ${fmt((value ?? 0) * 100, 3)}%`;
        });
    const dotTypeLines = Object.entries(stats.dotDamagePerShotByType)
        .filter(([, value]) => (value ?? 0) > 0)
        .map(([type, value]) => `${type}: DoT per ${damageUnit} ${fmt(value ?? 0, 5)} | DoT DPS ${fmt(stats.dotDpsByType[type as keyof typeof stats.dotDpsByType] ?? 0, 5)}`);
    const damageRampLines = weapon.selectedAttackDamageRamp ? [
        `Verified attack ramp: ${fmt(weapon.selectedAttackDamageRamp.minimumDamageMultiplier * 100, 1)}% → 100% over ${fmt(weapon.selectedAttackDamageRamp.rampToFullSeconds, 3)}s; decay begins after ${fmt(weapon.selectedAttackDamageRamp.idleBeforeDecaySeconds, 3)}s idle and reaches minimum over ${fmt(weapon.selectedAttackDamageRamp.decayToMinimumSeconds, 3)}s.`,
        `Fresh-magazine average ramp multiplier = ${fmt(stats.freshMagazineDamageMultiplier, 6)}; steady repeating-cycle multiplier = ${fmt(stats.sustainedDamageMultiplier, 6)}. Ramp scales direct damage. Per-attack DoT/Blast seed scaling is a model assumption because the Wiki does not specify seed inheritance separately; status chance and proc weights stay unchanged.`,
    ] : [];
    const conditionalLines = conditionalEntries.map((conditional, index) => {
        const uptime = estimateConditionalUptime(conditional, baselineRateForConditionals, baseMagazineForConditionals, conditionalState);
        const stackFactor = estimateConditionalStackFactor(conditional, baselineRateForConditionals, baseMagazineForConditionals, conditionalState);
        const combinedFactor = uptime * stackFactor;
        const statsApplied = Object.entries(conditional.stats)
            .filter(([, value]) => typeof value === "number" && value !== 0)
            .map(([key, value]) => `${key} ${fmt((value as number) * 100, 2)}%`)
            .join(", ");
        const triggerLabel = conditional.trigger.replace(/([A-Z])/g, " $1").toLowerCase();
        return `Conditional ${index + 1}: trigger ${triggerLabel}, duration ${fmt(conditional.durationSeconds, 2)}s, max stacks ${conditional.maxStacks}, aiming ${conditional.requiresAiming ? "yes" : "no"}, uptime ${fmt(uptime, 4)}, stack factor ${fmt(stackFactor, 4)}, combined factor ${fmt(combinedFactor, 4)}, stats [${statsApplied || "none"}]`;
    });
    const customTargetLines = targetProfileOverride ? [
        `Custom current-level target pools = Health ${fmt(targetProfileOverride.health ?? 0, 0)}, Shields ${fmt(targetProfileOverride.shields ?? 0, 0)}, Overguard ${fmt(targetProfileOverride.overguard ?? 0, 0)}, Armor ${fmt(targetProfileOverride.armor ?? 0, 0)}`,
        ...(targetProfileOverride.description ? [targetProfileOverride.description] : []),
        `Additional same-profile enemies inside active Electric/Gas status radii = ${Math.max(0, Math.min(20, Math.floor(targetProfileOverride.nearbyEnemyCount ?? 0)))}`,
        `Additional same-profile enemies inside Blast's 5m radial = ${Math.max(0, Math.min(20, Math.floor(targetProfileOverride.nearbyBlastEnemyCount ?? 0)))}`,
        "Optimizer scoring multiplies Electric/Gas status damage by their configured count and estimates Blast cap-radial damage from Poisson proc arrivals during the scaled fuse. It assumes same-profile defenses and exposure; direct attacks, on-kill radial chains, neighbor statuses, and changing neighbor pools remain outside the score.",
        `Toxin bypasses Shields = ${targetProfileOverride.toxinBypassesShields === false ? "no" : "yes"}`,
        `Enemy Shield Gate hit mode = ${targetProfileOverride.enemyShieldGateHitMode ?? "body"}`,
        `Target status immunities = ${[...(targetProfileOverride.statusImmuneTypes ?? [])].join(", ") || "none"}`,
        `Target status stack caps = ${Object.entries(targetProfileOverride.statusStackCaps ?? {}).map(([type, cap]) => `${type} ${cap}`).join(", ") || "standard"}`,
        "The optimizer uses a fast expected pool-progress score, not the finite encounter. Blast cap-radial collateral uses a Poisson stack-arrival estimate; on-kill detonations, neighbor status histories, pool depletion, gates, boss attenuation, and random outcomes are not simulated in its score.",
    ] : [];
    const fireRateExplanation = (() => {
        if (weapon.weaponType.trim().toLowerCase() === "bow") {
            const baseChargeTime = weapon.trigger === "Charge" ? Math.max(0, weapon.chargeTime ?? 0) : 0;
            const moddedChargeTime = baseChargeTime / Math.max(0.1, 1 + fireRateBonus);
            return [
                `Modded bow charge time = ${fmt(baseChargeTime, 5)} ÷ (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(moddedChargeTime, 5)}s`,
                ignoresReloadAndMagazine
                    ? `Effective bow rate = 1 ÷ modded charge time (reload ignored) = ${fmt(stats.fireRate, 5)}/s`
                    : `Effective bow rate = 1 ÷ (modded charge time ${fmt(moddedChargeTime, 5)}s + modded reload ${fmt(stats.reloadTime, 5)}s) = ${fmt(stats.fireRate, 5)}/s`,
                baseChargeTime > 0
                    ? `Fresh bow shot rate excludes post-shot reload = 1 ÷ modded charge time = ${fmt(stats.burstFireRate, 5)}/s`
                    : `Fresh uncharged bow shot rate uses reload delay = ${fmt(stats.burstFireRate, 5)}/s`,
                "Bow repeating rate already includes post-shot reload, so magazine duty cycle stays at 1 and does not count that delay twice.",
            ];
        }
        if (weapon.trigger === "Charge" && weapon.chargeTime) {
            return [
                `Modded charge time = ${fmt(weapon.chargeTime, 5)} ÷ (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(weapon.chargeTime / Math.max(0.0001, 1 + fireRateBonus), 5)}`,
                `Effective fire rate (Charge) = 1 ÷ (modded charge time + 1 ÷ modded fire rate) = ${fmt(stats.fireRate, 5)}`,
            ];
        }
        return [`${rateLabel} = ${fmt(weapon.fireRate, 5)} × (1 + ${fmt(fireRateBonus * 100, 3)}%) = ${fmt(stats.fireRate, 5)}`];
    })();
    const sections: BuildMathSection[] = [
        {
            title: "Inputs",
            lines: [
                `Weapon base damage total = ${fmt(baseDamage, 5)}`,
                `Base damage split = impact ${fmt(weapon.damage.impact, 5)}, puncture ${fmt(weapon.damage.puncture, 5)}, slash ${fmt(weapon.damage.slash, 5)}, heat ${fmt(weapon.damage.heat, 5)}, cold ${fmt(weapon.damage.cold, 5)}, electricity ${fmt(weapon.damage.electricity, 5)}, toxin ${fmt(weapon.damage.toxin, 5)}, blast ${fmt(weapon.damage.blast, 5)}, radiation ${fmt(weapon.damage.radiation, 5)}, gas ${fmt(weapon.damage.gas, 5)}, magnetic ${fmt(weapon.damage.magnetic, 5)}, viral ${fmt(weapon.damage.viral, 5)}, corrosive ${fmt(weapon.damage.corrosive, 5)}, void ${fmt(weapon.damage.void, 5)}, tau ${fmt(weapon.damage.tau, 5)}, true ${fmt(weapon.damage.true, 5)}`,
                `Base crit chance = ${fmt(weapon.critChance * 100, 5)}% | base crit multiplier = ${fmt(weapon.critMultiplier, 5)} | base status chance = ${fmt(weapon.statusChance * 100, 5)}%`,
                `${rateLabel} base = ${fmt(weapon.fireRate, 5)} | magazine base = ${displayMagazineValue(weapon, weapon.magazineSize)} | reload base = ${fmt(weapon.reloadTime, 5)}s | multishot base = ${fmt(weapon.multishot, 5)}`,
                `Conditional effects scenario = ${conditionalState.mode}${conditionalState.mode === "custom" ? ` (${conditionalState.externalStacks ?? 0} maintained stacks per effect)` : ""}`,
                ...(weapon.hasGaleForceAmmoPassive ? [
                    `Gale Force = ${stats.infiniteAmmoActive ? "assumed continuously maintained" : "not active"}; headshot/kill trigger and four-second refresh timing are not simulated.${stats.infiniteAmmoActive ? " Infinite ammo prevents reloads, and first-shot Chamber bonuses are already spent." : " Select Fully stacked or Custom with at least one maintained stack to model the active buff."}`,
                ] : []),
                targetFaction ? `Target faction used for damage modifiers = ${targetFaction}` : "No target faction damage modifier selected",
                ...(usesMeleeDamageModel(weapon.category)
                    ? [
                        "Melee combo multiplier = " + fmt(stats.meleeComboMultiplier, 0) + "x (explicit scenario input)",
                        ...(weapon.selectedAttackUsesMeleeComboMultiplier
                            ? [
                                "Selected heavy-attack combo damage multiplier = ×" + fmt(stats.meleeAttackComboDamageMultiplier, 0) + " (assumed active for each scored hit)",
                                "Estimated combo before this heavy attack = " + fmt(stats.meleeComboPointsBeforeHeavyAttack, 1) + " points; capped Heavy Attack Efficiency = " + fmt(stats.heavyAttackEfficiency * 100, 1) + "%.",
                                "After one heavy attack, estimated retained combo = " + fmt(stats.meleeComboPointsAfterHeavyAttack, 1) + " points (" + fmt(stats.meleeComboMultiplierAfterHeavyAttack, 0) + "× tier). The direct-hit TTK steps repeated Heavy Attacks and restores Initial Combo at 40 points/s; it excludes attack-generated combo. DPS, finite status encounter, and optimizer scoring still hold the starting tier.",
                            ]
                            : []),
                    ]
                    : []),
                ...customTargetLines,
            ],
        },
        {
            title: "Base Stats",
            lines: [
                `Base damage multiplier bracket = 1 + additive damage bonuses = 1 + ${fmt(totals.damageBonus, 5)} = ${fmt(baseDamageMultiplier, 5)}`,
                `Crit chance = base ${fmt(weapon.critChance, 5)} × (1 + additive crit ${fmt(totals.critChanceBonus, 5)}) + final crit ${fmt(totals.finalCritChanceBonus, 5)} = ${fmt(stats.critChance, 5)} (${fmt(stats.critChance * 100, 3)}%)`,
                `Crit multiplier = quantized base ${fmt(stats.quantizedBaseCritMultiplier, 7)} × (1 + additive crit mult ${fmt(totals.critMultBonus, 5)}) + final crit mult ${fmt(totals.finalCritMultiplierBonus, 5)} = ${fmt(stats.critMultiplier, 7)}`,
                `Status chance = base ${fmt(weapon.statusChance, 5)} × (1 + additive status ${fmt(totals.statusChanceBonus, 5)}) + final status ${fmt(totals.finalStatusChanceBonus, 5)} = ${fmt(stats.statusChance, 5)} (${fmt(stats.statusChance * 100, 3)}%)`,
                `Multishot = base ${fmt(weapon.multishot, 5)} × (1 + additive multishot ${fmt(totals.multishotBonus, 5)}) = ${fmt(stats.multishot, 5)}`,
                ...(usesMeleeDamageModel(weapon.category)
                    ? ["Combo-scaled bonuses = " + fmt(totals.comboCritChanceBonus * Math.max(0, stats.meleeComboMultiplier - 1) * 100, 3) + "% crit chance; " + fmt(totals.comboStatusChanceBonus * Math.max(0, stats.meleeComboMultiplier - 1) * 100, 3) + "% status chance"]
                    : []),
                ...(hasConditionalBonuses ? ["Conditional/ramping effects use the selected state and documented realistic trigger estimates where applicable."] : []),
            ],
        },
        {
            title: "Damage Bonuses",
            lines: [
                `Damage bonus = ${fmt(totals.damageBonus * 100, 3)}% | impact bonus = ${fmt(totals.impactBonus * 100, 3)}% | puncture bonus = ${fmt(totals.punctureBonus * 100, 3)}% | slash bonus = ${fmt(totals.slashBonus * 100, 3)}%`,
                `Primary element bonuses = heat ${fmt(totals.heatBonus * 100, 3)}%, cold ${fmt(totals.coldBonus * 100, 3)}%, electricity ${fmt(totals.electricityBonus * 100, 3)}%, toxin ${fmt(totals.toxinBonus * 100, 3)}%`,
                `Advanced element bonuses = magnetic ${fmt(totals.magneticBonus * 100, 3)}%, radiation ${fmt(totals.radiationBonus * 100, 3)}%, viral ${fmt(totals.viralBonus * 100, 3)}%, corrosive ${fmt(totals.corrosiveBonus * 100, 3)}%, void ${fmt(totals.voidBonus * 100, 3)}%, tau ${fmt(totals.tauBonus * 100, 3)}%, true ${fmt(totals.trueBonus * 100, 3)}%`,
                `Status damage bonus = ${fmt(totals.statusDamageBonus * 100, 3)}% | status duration bonus = ${fmt(totals.statusDurationBonus * 100, 3)}% | faction damage bonus tracked here = ${fmt(totals.factionDamageBonus * 100, 3)}% | mod direct damage per status = ${fmt(stats.directDamagePerStatusBonus * 100, 3)}% | intrinsic direct damage per status = ${fmt(stats.intrinsicDamagePerStatusBonus * 100, 3)}% (${stats.intrinsicDamagePerStatusMode})`,
                `Condition Overload = ${fmt(stats.conditionOverloadDamagePerStatusBonus * 100, 3)}% additive base damage per active type × ${fmt(stats.conditionOverloadStatusTypes, 3)} expected types (including ${conditionalState.externalStatusTypeCount ?? 0} externally maintained); multiplier ${fmt(stats.conditionOverloadDamageMultiplier, 5)}.`,
            ],
        },
        {
            title: "Damage Construction",
            lines: [
                `Modded base damage = base total ${fmt(baseDamage, 5)} × damage bracket ${fmt(baseDamageMultiplier, 5)} = ${fmt(moddedBaseDamageBeforeConditionOverload, 5)}; Condition Overload adds ${fmt(moddedBaseDamage - moddedBaseDamageBeforeConditionOverload, 5)} = ${fmt(moddedBaseDamage, 5)}`,
                ...(totals.conditionOverloadDamagePerStatusBonus > 0 && !stats.conditionOverloadApplies
                    ? ["Condition Overload is disabled for this selected source-marked area, slam, or glaive heavy-throw attack."]
                    : []),
                `Physical raw values before quantization = impact ${fmt(rawBreakdown.physicalRaw.impact, 5)}, puncture ${fmt(rawBreakdown.physicalRaw.puncture, 5)}, slash ${fmt(rawBreakdown.physicalRaw.slash, 5)}`,
                `Element queue before combination = ${rawBreakdown.orderedElementQueue.map((entry) => `${entry.type} ${fmt(entry.value, 5)} (order ${entry.order})`).join(" | ") || "none"}`,
                `Combined base damage breakdown before Condition Overload and direct-only per-status bonuses = ${nonZeroRawEntries.map(([type, value]) => `${type} ${fmt(value, 5)}`).join(", ") || "none"}`,
                stats.directDamagePerStatusMultiplier !== 1
                    ? stats.intrinsicDamagePerStatusMode === "multiplicativeBase"
                        ? `Direct-hit-only per-status multiplier = (Condition Overload bracket ${fmt(conditionOverloadDamageBracket, 5)} × (1 + intrinsic ${fmt(stats.intrinsicDamagePerStatusBonus, 5)} × ${fmt(stats.directDamageStatusTypes, 3)} types) + mod per-status ${fmt(stats.directDamagePerStatusBonus, 5)} × ${fmt(stats.directDamageStatusTypes, 3)}) ÷ Condition Overload bracket = ${fmt(stats.directDamagePerStatusMultiplier, 5)}`
                        : `Direct-hit-only per-status multiplier = (Condition Overload bracket ${fmt(conditionOverloadDamageBracket, 5)} + ((mod ${fmt(stats.directDamagePerStatusBonus, 5)} + intrinsic ${fmt(stats.intrinsicDamagePerStatusBonus, 5)}) × ${fmt(stats.directDamageStatusTypes, 3)} types)) ÷ Condition Overload bracket = ${fmt(stats.directDamagePerStatusMultiplier, 5)}`
                    : "No direct-damage per-status multiplier applied",
            ],
        },
        {
            title: "Quantization",
            lines: [
                `Scale = direct-hit modded base damage ÷ 32 = (${fmt(moddedBaseDamage, 5)} × ${fmt(stats.directDamagePerStatusMultiplier, 5)}) ÷ 32 = ${fmt(quantScale, 5)}`,
                `Per-type quantization follows Round(raw ÷ scale) × scale`,
                ...quantizedLines,
                `Quantized final breakdown = ${Object.entries(stats.damageBreakdown).filter(([, value]) => (value as number) > 0).map(([type, value]) => `${type} ${fmt(value as number, 5)}`).join(", ") || "none"}`,
                `Quantized total direct damage = ${fmt(stats.totalDamage, 5)}`,
                targetFaction ? `Faction mod multiplier tracked after quantization = ×${fmt(1 + totals.factionDamageBonus, 5)} (${targetFaction})` : "No faction-mod multiplier tracked in this build",
            ],
        },
        {
            title: "Crit and DPS",
            lines: [
                `Arsenal Total Damage = unquantized damage construction × damage-weighted multishot = ${fmt(stats.arsenalDamage, 5)}`,
                `Expected projectile count = ${fmt(stats.multishot, 5)} per ${damageUnit}; damage-weighted multiplier = ${fmt(stats.damageWeightedMultishot, 5)} (unique extra-projectile damage bonus ${fmt(stats.multishotDamageBonus * 100, 3)}%)`,
                `Quantized direct damage per ${damageUnit} = ${fmt(stats.totalDamage, 5)} × damage-weighted multiplier ${fmt(stats.damageWeightedMultishot, 5)} = ${fmt(quantizedShotDamage, 5)}`,
                `Average crit multiplier = expected direct damage ÷ quantized damage per ${damageUnit} = ${fmt(stats.averageShotDamage, 5)} ÷ ${fmt(quantizedShotDamage, 5)} = ${fmt(avgCritMultiplier, 6)}`,
                `Average crit multiplier cross-check = 1 + crit chance × (crit multiplier - 1) = 1 + ${fmt(stats.critChance, 5)} × (${fmt(stats.critMultiplier, 5)} - 1) = ${fmt(1 + stats.critChance * (stats.critMultiplier - 1), 6)}`,
                `Average direct damage per ${damageUnit} = quantized damage ${fmt(quantizedShotDamage, 5)} × average crit multiplier ${fmt(avgCritMultiplier, 6)} = ${fmt(stats.averageShotDamage, 5)}`,
                ...(stats.firstShotMagazineDamageBonus > 0
                    ? [
                        `First ammo-consuming shot after reload = ${fmt(stats.averageShotDamage, 5)} × ${fmt(stats.firstShotMagazineDamageMultiplier, 6)} = ${fmt(stats.averageShotDamage * stats.firstShotMagazineDamageMultiplier, 5)}`,
                        `Average magazine damage multiplier = 1 + first-shot bonus ${fmt(stats.firstShotMagazineDamageBonus, 5)} ÷ ${fmt(stats.shotsPerMag, 5)} shots = ${fmt(stats.magazineAverageDamageMultiplier, 6)}`,
                    ]
                    : []),
                ...fireRateExplanation,
                `Burst DPS = ${avgDamageLabel} ${fmt(stats.averageShotDamage, 5)} × fresh-mag attack rate ${fmt(stats.burstFireRate, 5)} × fresh-mag ramp ${fmt(stats.freshMagazineDamageMultiplier, 6)} × average magazine damage ${fmt(stats.magazineAverageDamageMultiplier, 6)} = ${fmt(result.burstDPS, 5)}`,
                ignoresReloadAndMagazine
                    ? `Sustained DPS = average damage ${fmt(stats.averageShotDamage, 5)} × fire rate ${fmt(stats.fireRate, 5)} × sustained ramp ${fmt(stats.sustainedDamageMultiplier, 6)} because reload/magazine are ignored = ${fmt(result.sustainedDPS, 5)}`
                    : `Sustained DPS = average damage ${fmt(stats.averageShotDamage, 5)} × fire rate ${fmt(stats.fireRate, 5)} × magazine duty cycle ${fmt(stats.magazineDutyCycle, 6)} × sustained ramp ${fmt(stats.sustainedDamageMultiplier, 6)} × average magazine damage ${fmt(stats.magazineAverageDamageMultiplier, 6)} = ${fmt(result.sustainedDPS, 5)}`,
                ...damageRampLines,
                ...(usesMeleeDamageModel(weapon.category)
                    ? meleeAverageDps && meleeDpsInputs?.averageComboDamageMultiplier != null && meleeDpsInputs.baseComboLengthSeconds != null
                        ? [
                            `Stance average hit = average combo damage multiplier ${fmt(meleeDpsInputs.averageComboDamageMultiplier, 5)} × initial-state quantized damage ${fmt(meleeDpsBaseline?.totalDamage ?? 0, 5)} × expected crit multiplier ${fmt(meleeAverageDps.expectedCritMultiplier, 6)} = ${fmt(meleeAverageDps.averageHit, 5)}`,
                            `Stance average DPS = average hit ${fmt(meleeAverageDps.averageHit, 5)} × modded attack speed ${fmt(meleeDpsBaseline?.fireRate ?? 0, 5)} ÷ base combo length ${fmt(meleeDpsInputs.baseComboLengthSeconds, 5)}s = ${fmt(meleeAverageDps.averageDps, 5)}`,
                            "Stance DPS inputs are user-entered from the stance reference table. The estimate excludes status effects, target defenses, and follow-through.",
                        ]
                        : ["Stance average DPS is unavailable until average combo damage multiplier and base combo length are entered from the selected stance's reference data."]
                    : []),
                ...(!usesMeleeDamageModel(weapon.category) && !weapon.isExalted ? [
                    `Ordinary ammo efficiency = ${fmt(stats.ammoEfficiencyBonus * 100, 3)}% after additive bonuses and the 75% cap${weapon.selectedAttackIsIncarnon ? " (ignored in transformed Incarnon form)" : ""}${stats.infiniteAmmoActive ? "; Gale Force is modeled separately as maintained infinite ammo" : ""}`,
                    ...(weapon.selectedAttackChargeAmmoPerSecond && weapon.selectedAttackChargeDamageBaseAmmoCost ? [
                        `Charged attack damage = Wiki row damage × (${fmt(stats.ammoCostPerShot, 5)} ammo ÷ ${fmt(weapon.selectedAttackChargeDamageBaseAmmoCost, 5)}-ammo baseline) = ${fmt(stats.totalDamage, 5)}; charge time = ${fmt(stats.ammoCostPerShot, 5)} ÷ ${fmt(weapon.selectedAttackChargeAmmoPerSecond, 5)} ammo/s = ${fmt(stats.chargeTimeSeconds ?? 0, 5)}s.`,
                    ] : []),
                    stats.infiniteAmmoActive
                        ? "Shots per magazine = unbounded while the Gale Force buff is assumed active; no reload interruption is modeled."
                        : stats.ammoEfficiencyBonus > 0
                        ? `Shots per magazine = ceil(${fmt(stats.magazineSize, 5)} ÷ (${fmt(stats.ammoCostPerShot, 5)} × (1 - ${fmt(stats.ammoEfficiencyBonus, 5)}))) = ${fmt(stats.shotsPerMag, 5)}; ammo-efficiency fractional remainder is carried into the next shot.`
                        : `Shots per magazine = ${fmt(stats.magazineSize, 5)} ÷ (${fmt(stats.ammoCostPerShot, 5)} × (1 - ${fmt(stats.ammoEfficiencyBonus, 5)})) = ${fmt(stats.shotsPerMag, 5)}`,
                ] : []),
            ],
        },
        {
            title: "Status and DoT",
            lines: [
                `Average procs per ${damageUnit} = ordinary rolls (multishot ${fmt(stats.multishot, 5)} × status chance ${fmt(stats.statusChance, 5)}, with Tau's ${fmt(stats.tauStatusVulnerability * 100, 3)}% vulnerability applied to non-Tau effects) + forced/status-triggered extra procs = ${fmt(stats.averageProcsPerShot, 5)}`,
                ...procLines,
                `Expected stacks by type = ${Object.entries(stats.expectedStacksByType).filter(([, value]) => (value ?? 0) > 0).map(([type, value]) => `${type} ${fmt(value ?? 0, 5)}`).join(", ") || "none"}`,
                `DoT per ${damageUnit} total = ${fmt(stats.dotDamagePerShot, 5)}`,
                `Steady-state DoT DPS estimate = expected status seed damage per second plus grouped-tick accumulator contribution = ${fmt(stats.dotDps, 5)}`,
                ...dotTypeLines,
                `Derived status effects = Viral health bonus ${fmt(stats.viralHealthDamageBonus * 100, 5)}%, Heat armor strip ${fmt(stats.heatArmorStrip * 100, 5)}%, Corrosive armor strip ${fmt(stats.corrosiveArmorStrip * 100, 5)}%, Magnetic shield bonus ${fmt(stats.magneticShieldDamageBonus * 100, 5)}%, Radiation ally damage bonus ${fmt(stats.radiationAllyDamageBonus * 100, 5)}%, Cold slow ${fmt(stats.coldSlow * 100, 5)}%, Cold crit bonus ${fmt(stats.coldCritDamageBonus, 5)}, Puncture enemy damage reduction ${fmt(stats.punctureEnemyDamageReduction * 100, 5)}%, Puncture crit chance bonus ${fmt(stats.punctureCritChanceBonus * 100, 5)}%, Impact mercy threshold bonus ${fmt(stats.impactMercyThresholdBonus * 100, 5)}%, Tau status vulnerability ${fmt(stats.tauStatusVulnerability * 100, 5)}%`,
            ],
        },
        ...(conditionalLines.length ? [{
            title: "Conditional Assumptions",
            lines: conditionalLines,
        }] : []),
    ];

    return { sections };
}

function buildExportPayload(args: {
    weapon: WeaponEntry | null;
    selectedAttackIdx: number;
    meleeDpsInputs: MeleeDpsInputState;
    goal: OptimizeGoal;
    conditionalState: ConditionalState;
    targetFaction: string | null;
    targetProfileOverride?: TargetProfileOverride;
    buildCfg: BuildCfg;
    includeArcaneStats: boolean;
    slots: (ModEntry | null)[];
    ranks: number[];
    slotPols: string[];
    stanceMod: ModEntry | null;
    stanceRank: number;
    stancePol: string;
    formaCount: number;
    exilusEnabled: boolean;
    exilusMod: ModEntry | null;
    exilusRank: number;
    exilusPol: string;
    arcane: ArcaneEntry | null;
    arcaneRank: number;
    warframeArmor?: number;
    warframeMaxEnergy?: number;
    warframeEnergyPercent?: number;
    optimizeMode: OptimizeMode;
    respectCap: boolean;
    allowNonMax: boolean;
    onlyOwned: boolean;
    factionOn: boolean;
    allowCatalyst: boolean;
    allowForma: boolean;
    maxFormaAllowed: number;
    optExilus: boolean;
    optArcane: boolean;
    compatMods: ModEntry[];
    weaponArcanes: ArcaneEntry[];
    ownedSet: Set<string>;
    ownedModMaxRankByUniqueName: Record<string, number>;
    ownedArcaneUniqueNames: Set<string>;
    ownedArcaneMaxRankByUniqueName: Record<string, number>;
    excluded: Set<string>;
}): BuildExportPayload | null {
    const {
        weapon, selectedAttackIdx, goal, conditionalState, targetFaction, targetProfileOverride, meleeDpsInputs, buildCfg, includeArcaneStats,
        slots, ranks, slotPols, stanceMod, stanceRank, stancePol, formaCount, exilusEnabled, exilusMod, exilusRank, exilusPol, arcane, arcaneRank,
        warframeArmor, warframeMaxEnergy, warframeEnergyPercent,
        optimizeMode, respectCap, allowNonMax, onlyOwned, factionOn, allowCatalyst, allowForma, maxFormaAllowed, optExilus, optArcane,
        compatMods, weaponArcanes, ownedSet, ownedModMaxRankByUniqueName, ownedArcaneUniqueNames, ownedArcaneMaxRankByUniqueName, excluded,
    } = args;
    if (!weapon) return null;

    const weaponState = applyWeaponConfig(weapon, selectedAttackIdx, buildCfg);
    const selectedAttack = weaponState.weaponWithIntrinsicOptions.attacks.length > 1
        ? weaponState.weaponWithIntrinsicOptions.attacks[selectedAttackIdx] ?? null
        : null;
    const calcWeapon = weaponState.selectedWeapon;

    const effects: (ModEffect | null)[] = [
        ...weaponState.activeIncarnonEffects,
        ...slots.map((m, i) => {
        if (!m) return null;
        const r = ranks[i] ?? m.fusionLimit;
        return m.effectsByRank[r] ?? m.effect;
        }),
    ];
    if (exilusEnabled && exilusMod) {
        effects.push(exilusMod.effectsByRank[exilusRank] ?? exilusMod.effect);
    }
    if (includeArcaneStats && arcane) {
        const ae = getArcaneEffectAtRank(arcane, arcaneRank, warframeArmor, true, { warframeMaxEnergy, warframeEnergyPercent });
        if (ae) effects.push({
            ...emptyEffect(),
            ...ae,
            conditionalEffects: [...(ae.conditionalEffects ?? [])],
        });
    }

    const calculated = calculateBuild(calcWeapon, effects, targetFaction ?? "", {
        conditionalState,
        statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
        statusStackCaps: targetProfileOverride?.statusStackCaps,
    });
    const meleeDpsBaseline = usesMeleeDamageModel(weapon.category) &&
        meleeDpsInputs.averageComboDamageMultiplier != null &&
        meleeDpsInputs.baseComboLengthSeconds != null
        ? calculateBuild(calcWeapon, effects, targetFaction ?? "", {
            conditionalState: { mode: "initial" },
            statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            targetStatusState: "initial",
        }).modded
        : null;
    const meleeAverageDps = meleeDpsBaseline && meleeDpsInputs.averageComboDamageMultiplier != null && meleeDpsInputs.baseComboLengthSeconds != null
        ? calculateMeleeAverageDps(meleeDpsBaseline, {
            averageComboDamageMultiplier: meleeDpsInputs.averageComboDamageMultiplier,
            baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
        })
        : null;
    const calculatedWithMeleeDps = {
        ...calculated,
        meleeAverageDps: meleeAverageDps && meleeDpsInputs.averageComboDamageMultiplier != null && meleeDpsInputs.baseComboLengthSeconds != null
            ? {
                averageComboDamageMultiplier: meleeDpsInputs.averageComboDamageMultiplier,
                baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
                averageHit: meleeAverageDps.averageHit,
                averageDps: meleeAverageDps.averageDps,
            }
            : null,
    };
    const math = buildMathBreakdown(calcWeapon, effects, targetFaction ?? "", conditionalState, targetProfileOverride ?? undefined, meleeDpsInputs);
    const ownedModsForExport = onlyOwned
        ? compatMods
            .filter((mod) => ownedSet.has(mod.uniqueName))
            .map((mod) => ({
                name: mod.name,
                uniqueName: mod.uniqueName,
                ownedMaxRank: ownedModMaxRankByUniqueName[mod.uniqueName] ?? mod.fusionLimit,
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.uniqueName.localeCompare(b.uniqueName))
        : undefined;
    const ownedArcanesForExport = onlyOwned
        ? weaponArcanes
            .filter((arcane) => ownedArcaneUniqueNames.has(arcane.uniqueName))
            .map((arcane) => ({
                name: arcane.name,
                uniqueName: arcane.uniqueName,
                ownedMaxRank: ownedArcaneMaxRankByUniqueName[arcane.uniqueName] ?? arcane.maxRank,
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.uniqueName.localeCompare(b.uniqueName))
        : undefined;
    const excludedModsForExport = excluded.size > 0
        ? compatMods
            .filter((mod) => excluded.has(mod.uniqueName))
            .map((mod) => ({
                name: mod.name,
                uniqueName: mod.uniqueName,
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.uniqueName.localeCompare(b.uniqueName))
        : undefined;

    return {
        exportedAt: new Date().toISOString(),
        source: "tenno-hub/mod-builder",
        weapon: {
            name: weapon.name,
            uniqueName: weapon.uniqueName,
            category: weapon.category,
            selectedAttack: selectedAttack?.name ?? null,
        },
        assumptions: {
            goal,
            targetFaction,
            targetProfileOverride,
            weaponRank: buildCfg.weaponRank,
            masteryRank: buildCfg.masteryRank,
            hasCatalyst: buildCfg.hasCatalyst,
            formaCount,
            valenceBonusPct: weapon.isProgenitorWeapon ? buildCfg.valenceBonusPct : undefined,
            valenceElement: weapon.isProgenitorWeapon ? buildCfg.valenceElement : null,
            optimizeValenceElement: weapon.isProgenitorWeapon ? buildCfg.optimizeValenceElement : undefined,
            incarnonUnlockedTier: weaponState.incarnonRecord ? getHighestSelectedIncarnonTier(buildCfg.incarnonSelectedOptionsByTier) : undefined,
            incarnonSelectedOptionsByTier: weaponState.incarnonRecord ? buildCfg.incarnonSelectedOptionsByTier : undefined,
            optimizeIncarnonSelections: weaponState.incarnonRecord ? buildCfg.optimizeIncarnonSelections : undefined,
            includeArcaneStats,
            warframeArmor,
            warframeMaxEnergy,
            warframeEnergyPercent,
            selectedAttackIdx,
            meleeAverageComboDamageMultiplier: usesMeleeDamageModel(weapon.category)
                ? meleeDpsInputs.averageComboDamageMultiplier
                : undefined,
            meleeBaseComboLengthSeconds: usesMeleeDamageModel(weapon.category)
                ? meleeDpsInputs.baseComboLengthSeconds
                : undefined,
        },
        optimizer: {
            mode: optimizeMode,
            options: {
                respectCapacity: respectCap,
                allowNonMaxRank: allowNonMax,
                ownedOnly: onlyOwned,
                factionFocus: factionOn,
                allowCatalyst,
                allowForma,
                maxFormaAllowed,
                optimizeExilus: optExilus,
                optimizeArcane: optArcane,
                conditionalState,
            },
            pools: {
                compatibleMods: compatMods.length,
                compatibleArcanes: weaponArcanes.length,
                ownedMods: ownedModsForExport,
                ownedArcanes: ownedArcanesForExport,
                excludedMods: excludedModsForExport,
            },
        },
        build: {
            stance: {
                mod: stanceMod?.name ?? null,
                uniqueName: stanceMod?.uniqueName ?? null,
                rank: stanceMod ? stanceRank : 0,
                slotPolarity: stancePol,
                statsLabel: stanceMod ? (stanceMod.statsTextByRank[stanceRank] ?? stanceMod.statsLabel) : null,
            },
            slots: slots.map((m, i) => ({
                slot: i + 1,
                mod: m?.name ?? null,
                uniqueName: m?.uniqueName ?? null,
                rank: m ? (ranks[i] ?? m.fusionLimit) : 0,
                slotPolarity: slotPols[i] ?? "",
                modPolarity: m?.polarity ?? null,
                statsLabel: m ? (m.statsTextByRank[ranks[i] ?? m.fusionLimit] ?? m.statsLabel) : null,
            })),
            exilus: {
                enabled: exilusEnabled,
                mod: exilusMod?.name ?? null,
                uniqueName: exilusMod?.uniqueName ?? null,
                rank: exilusMod ? exilusRank : 0,
                slotPolarity: exilusPol,
                statsLabel: exilusMod ? (exilusMod.statsTextByRank[exilusRank] ?? exilusMod.statsLabel) : null,
            },
            arcane: {
                mod: arcane?.name ?? null,
                uniqueName: arcane?.uniqueName ?? null,
                rank: arcane ? arcaneRank : 0,
                statsLabel: arcane ? (arcane.statsByRank[arcaneRank] ?? arcane.statsLabel) : null,
            },
        },
        calculated: calculatedWithMeleeDps,
        math,
    };
}

// ── Polarity picker ───────────────────────────────────────────────────────────

function PolarityPicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen(v => !v)}
                className="flex items-center justify-center w-6 h-6 rounded border border-slate-700/60 hover:border-slate-500 transition-colors"
                title="Change slot polarity">
                {value ? <PolarityIcon polarity={value} className="w-3.5 h-3.5" /> : <span className="text-slate-600 text-xs">○</span>}
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 mt-1 w-32 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    {POLARITY_OPTS.map(o => (
                        <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
                            className={["w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors",
                                o.key === value ? "bg-slate-700/60 text-slate-100" : "text-slate-300 hover:bg-slate-800"].join(" ")}>
                            <span className="w-5 flex items-center justify-center">
                                {o.key ? <PolarityIcon polarity={o.key} className="w-3.5 h-3.5" /> : <span className="text-slate-600">○</span>}
                            </span>
                            <span>{o.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function shouldAutoInstallCatalyst(
    cfg: CapacityConfig,
    slotPols: string[],
    slots: (ModEntry | null)[],
    ranks: number[],
    extraCapacitySlots: Array<{ mod: ModEntry; rank: number; polarity: string }> = [],
): boolean {
    if (cfg.hasCatalyst) return false;
    const slotCfgs = slotPols.map(polarity => ({ polarity }));
    const extraCfgs = extraCapacitySlots.map(slot => ({ polarity: slot.polarity }));
    const extraMods = extraCapacitySlots.map(slot => slot.mod);
    const extraRanks = extraCapacitySlots.map(slot => slot.rank);
    const uncatalyzed = computeCapacity(cfg, [...extraCfgs, ...slotCfgs], [...extraMods, ...slots], [...extraRanks, ...ranks]);
    if (!uncatalyzed.overCapacity) return false;
    const catalyzed = computeCapacity({ ...cfg, hasCatalyst: true }, [...extraCfgs, ...slotCfgs], [...extraMods, ...slots], [...extraRanks, ...ranks]);
    return !catalyzed.overCapacity;
}

// ── Stat Badge ────────────────────────────────────────────────────────────────

function StatBadge({ label, value, sub, highlight, tooltip, icon }: {
    label: string; value: string; sub?: string; highlight?: boolean; tooltip?: string; icon?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className={["rounded-lg border px-3 py-2 relative select-none",
            highlight ? "border-amber-700/50 bg-amber-950/20" : "border-slate-700/60 bg-slate-900/50",
            tooltip ? "cursor-help" : ""].join(" ")}
            onMouseEnter={() => tooltip && setShow(true)}
            onMouseLeave={() => setShow(false)}>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                {icon && <img src={icon} alt="" className="w-3.5 h-3.5 shrink-0" />}
                {label}{tooltip && <span className="text-slate-700 text-[8px]">?</span>}
            </div>
            <div className={["text-sm font-semibold mt-0.5", highlight ? "text-amber-300" : "text-slate-100"].join(" ")}>{value}</div>
            {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
            {show && tooltip && (
                <div className="absolute bottom-full left-0 mb-1.5 z-50 w-60 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] text-slate-300 shadow-xl leading-relaxed pointer-events-none whitespace-pre-line">
                    {tooltip}
                </div>
            )}
        </div>
    );
}

function GoalChip({ label, desc, active, onClick }: {
    label: string; desc: string; active: boolean; onClick: () => void;
}) {
    const [show, setShow] = useState(false);
    return (
        <div
            className="relative"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            <button
                onClick={onClick}
                className={[
                    "rounded-full px-2.5 py-1 text-[11px] border transition-colors",
                    active ? "bg-slate-100 text-slate-900 border-slate-100" : "bg-slate-950/40 text-slate-300 border-slate-700 hover:bg-slate-900",
                ].join(" ")}
            >
                {label}
            </button>
            {show && (
                <div className="absolute right-0 top-full z-[80] mt-2 w-64 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-300 shadow-xl">
                    {desc}
                </div>
            )}
        </div>
    );
}

function CapBar({ used, total, over }: { used: number; total: number; over: boolean }) {
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    return (
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className={["h-full rounded-full transition-all",
                over ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-blue-500"].join(" ")}
                style={{ width: `${pct}%` }} />
        </div>
    );
}

// ── Mod Slot ──────────────────────────────────────────────────────────────────

interface SlotProps {
    index: number; label?: string;
    mod: ModEntry | null; rank: number; slotPolarity: string;
    compatMods: ModEntry[]; usedGroups: Set<string>;
    ownedUniqueNames: Set<string>; onlyOwned: boolean; isExilusSlot?: boolean;
    excluded: Set<string>;
    onChange: (i: number, m: ModEntry | null) => void;
    onRankChange: (i: number, r: number) => void;
    onPolarityChange: (i: number, p: string) => void;
    onToggleExclude: (uniqueName: string) => void;
    effDrain: number;
    compactEmpty?: boolean;
    locked?: boolean;
    draggable?: boolean;
    isDragOver?: boolean;
    onDragStartSlot?: () => void;
    onDragEndSlot?: () => void;
    onDragOverSlot?: () => void;
    onDropSlot?: () => void;
}

function ModSlot({ index, label, mod, rank, slotPolarity, compatMods, usedGroups,
    ownedUniqueNames, onlyOwned, isExilusSlot, excluded, onChange, onRankChange, onPolarityChange, onToggleExclude, effDrain, compactEmpty, locked,
    draggable, isDragOver, onDragStartSlot, onDragEndSlot, onDragOverSlot, onDropSlot }: SlotProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [showDetails, setShowDetails] = useState(false);
    const [sliderActive, setSliderActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return compatMods.filter(m => {
            if (isExilusSlot && !m.isExilus) return false;
            if (usedGroups.has(m.incompatibilityGroup) && m.incompatibilityGroup !== mod?.incompatibilityGroup) return false;
            if (onlyOwned && ownedUniqueNames.size > 0 && !ownedUniqueNames.has(m.uniqueName)) return false;
            if (q && !getBuilderDisplayModName(m).toLowerCase().includes(q) && !m.statsLabel.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [compatMods, usedGroups, mod, query, onlyOwned, ownedUniqueNames, isExilusSlot]);
    const currentStatsLabel = mod ? (mod.statsTextByRank[rank] ?? mod.statsLabel) : "";

    const polMatch    = !!(mod && slotPolarity && slotPolarity === mod.polarity);
    const polMismatch = !!(mod && slotPolarity && slotPolarity !== mod.polarity && slotPolarity !== "");

    return (
        <div className={["relative min-w-0", compactEmpty ? "" : "h-full"].join(" ")} ref={panelRef}>
            <div className={[(compactEmpty && !mod ? "overflow-hidden " : "") + (compactEmpty ? "" : "h-full ") + "rounded-xl border transition-colors",
                isDragOver ? "border-sky-400/80 bg-sky-950/20" :
                mod
                    ? polMismatch ? "border-amber-700/40 bg-slate-900/60"
                                  : "border-slate-600 bg-slate-900/60 hover:border-slate-500"
                    : isExilusSlot ? "border-dashed border-slate-600/50 bg-slate-950/30 hover:border-slate-500"
                                   : "border-dashed border-slate-700/60 bg-slate-950/20 hover:border-slate-600"].join(" ")}
                draggable={draggable && !!mod && !sliderActive}
                onDragStart={(e) => {
                    if (!draggable || !mod || sliderActive) {
                        e.preventDefault();
                        return;
                    }
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `${label ?? "slot"}-${index}`);
                    onDragStartSlot?.();
                }}
                onDragEnd={() => onDragEndSlot?.()}
                onDragOver={(e) => {
                    if (!onDragOverSlot) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    onDragOverSlot();
                }}
                onDrop={(e) => {
                    if (!onDropSlot) return;
                    e.preventDefault();
                    onDropSlot();
                }}>

                <div className={["p-3 flex items-start gap-2 select-none", locked ? "cursor-default" : "cursor-pointer", mod ? "min-h-[112px]" : compactEmpty ? "min-h-[84px]" : "min-h-[112px]"].join(" ")}
                    onClick={() => { if (locked) return; setOpen(x => !x); setQuery(""); }}>
                    {mod ? (
                        <>
                            <div
                                className="relative flex-1 min-w-0"
                                onMouseEnter={() => setShowDetails(true)}
                                onMouseLeave={() => setShowDetails(false)}
                            >
                                <div className="flex min-w-0 items-center gap-1">
                                    {label && <span className="shrink-0 text-[8px] uppercase tracking-wide text-slate-600">{label}</span>}
                                    <span
                                        className="min-w-0 flex-1 text-xs font-semibold leading-tight text-slate-100"
                                        style={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {getBuilderDisplayModName(mod)}
                                    </span>
                                    {mod.compatBucket === "Riven" && <span className="text-[9px] px-1 rounded border border-yellow-700/50 bg-yellow-950/30 text-yellow-400">RIVEN</span>}
                                    {mod.effect.targetFaction && <span className="text-[9px] px-1 rounded border border-orange-700/50 bg-orange-950/30 text-orange-400">{mod.effect.targetFaction}</span>}
                                </div>
                                <div
                                    className="mt-1 text-[10px] leading-tight text-slate-400"
                                    style={{
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {currentStatsLabel}
                                    {rank < mod.fusionLimit && <span className="text-slate-600 ml-1">@{rank}/{mod.fusionLimit}</span>}
                                </div>
                                {showDetails && (
                                    <div className="wf-popover pointer-events-none absolute left-0 top-full z-[70] mt-2 w-64 rounded-lg border px-3 py-2">
                                        <div className="text-xs font-semibold leading-tight text-slate-100">{getBuilderDisplayModName(mod)}</div>
                                        <div className="mt-1 text-[11px] leading-relaxed text-slate-300">{currentStatsLabel}</div>
                                        {!mod.hasDamageEffect && !mod.isBuiltIn && <div className="mt-1 text-[10px] leading-relaxed text-amber-300">Effect not modeled; automatic optimization excludes this mod.</div>}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                {!locked && (
                                    <button className="text-slate-600 hover:text-slate-300 text-xs"
                                        onClick={e => { e.stopPropagation(); onChange(index, null); }}>✕</button>
                                )}
                                {locked && <span className="text-[9px] uppercase tracking-wide text-slate-600">Fixed</span>}
                                <span className={["text-[9px] font-mono font-bold px-1 py-0.5 rounded",
                                    effDrain < 0 ? "text-green-300 bg-green-950/40" :
                                    polMatch    ? "text-green-400 bg-green-950/30" :
                                    polMismatch ? "text-amber-400 bg-amber-950/30" : "text-slate-400 bg-slate-800/60"].join(" ")}>
                                    {effDrain < 0 ? `+${Math.abs(effDrain)}` : effDrain}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className={["flex items-center gap-1.5 text-slate-600 text-xs w-full justify-center text-center",
                            compactEmpty ? "py-2" : label ? "py-6" : "py-3"].join(" ")}>
                            <span>+</span><span>{label ? `Add ${label}` : "Add Mod"}</span>
                        </div>
                    )}
                </div>

                {/* Rank slider */}
                {mod && mod.fusionLimit > 0 && (
                    <div
                        className="grid grid-cols-[34px_minmax(0,1fr)_46px] items-center gap-2 px-3 pb-2 pt-1"
                        onClick={e => e.stopPropagation()}
                    >
                        <span className="text-[9px] text-slate-600">Rank</span>
                        <div className="min-w-0 px-2">
                            <input
                                type="range"
                                min={0}
                                max={mod.fusionLimit}
                                value={rank}
                                onPointerDown={() => setSliderActive(true)}
                                onMouseDown={() => setSliderActive(true)}
                                onPointerUp={() => setSliderActive(false)}
                                onMouseUp={() => setSliderActive(false)}
                                onTouchEnd={() => setSliderActive(false)}
                                onBlur={() => setSliderActive(false)}
                                onDragStart={e => e.preventDefault()}
                                onChange={e => onRankChange(index, +e.target.value)}
                                className="block w-full min-w-0 h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-300 [&::-webkit-slider-thumb]:bg-slate-100 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-blue-300 [&::-moz-range-thumb]:bg-slate-100"
                            />
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 text-right">{rank}/{mod.fusionLimit}</span>
                    </div>
                )}

                {/* Slot polarity */}
                {(!compactEmpty || mod) && (
                <div className="flex items-center gap-1.5 px-3 pb-2.5 border-t border-slate-800/40 pt-1.5"
                    onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] text-slate-600 uppercase tracking-wide">Slot</span>
                    <PolarityPicker value={slotPolarity} onChange={p => onPolarityChange(index, p)} />
                    {mod?.polarity && (
                        <div className="ml-auto flex items-center gap-1">
                            <span className="text-[9px] text-slate-600">mod</span>
                            <PolarityIcon polarity={mod.polarity} className="w-3 h-3" />
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Mod picker dropdown */}
            {open && !locked && (
                <div className="absolute z-50 mt-1 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="p-2 border-b border-slate-800">
                        <input ref={inputRef} type="text" placeholder="Search mods…" value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                        {mod && (
                            <button className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-800/50"
                                onClick={() => { onChange(index, null); setOpen(false); setQuery(""); }}>
                                Clear slot
                            </button>
                        )}
                        {filtered.length === 0 && <div className="px-3 py-4 text-xs text-slate-500 text-center">No matching mods</div>}
                        {filtered.map(m => {
                            const eff      = effectiveDrain(m, slotPolarity);
                            const match    = !!(slotPolarity && slotPolarity === m.polarity);
                            const mismatch = !!(slotPolarity && slotPolarity !== m.polarity && slotPolarity !== "");
                            const owned    = ownedUniqueNames.size === 0 || ownedUniqueNames.has(m.uniqueName);
                            return (
                                <button key={m.uniqueName}
                                    className={["w-full px-3 py-2 text-left hover:bg-slate-800/50 transition-colors",
                                        m.uniqueName === mod?.uniqueName ? "bg-slate-800/30" : "",
                                        !owned ? "opacity-50" : ""].join(" ")}
                                    onClick={() => { onChange(index, m); setOpen(false); setQuery(""); }}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="shrink-0 w-4">
                                            {m.polarity ? <PolarityIcon polarity={m.polarity} className="w-3.5 h-3.5" /> : <span className="text-slate-700 text-xs">○</span>}
                                        </span>
                                        <span className="text-xs font-medium text-slate-200 flex-1 truncate">{getBuilderDisplayModName(m)}</span>
                                        {!owned && <span className="text-[9px] text-slate-600 shrink-0">(unowned)</span>}
                                        {m.effect.targetFaction && <span className="text-[9px] px-1 rounded border border-orange-700/50 bg-orange-950/30 text-orange-400 shrink-0">{m.effect.targetFaction}</span>}
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); onToggleExclude(m.uniqueName); }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onToggleExclude(m.uniqueName);
                                                }
                                            }}
                                            className={["text-[9px] px-1.5 py-0.5 rounded border shrink-0 transition-colors",
                                                excluded.has(m.uniqueName)
                                                    ? "border-red-700/60 bg-red-950/30 text-red-300"
                                                    : "border-slate-700 text-slate-500 hover:border-red-700/60 hover:text-red-300"].join(" ")}
                                            title={excluded.has(m.uniqueName) ? "Remove from exclusions" : "Exclude from optimizer"}
                                        >
                                            {excluded.has(m.uniqueName) ? "Excluded" : "Exclude"}
                                        </span>
                                        <span className={["text-[9px] font-mono font-bold shrink-0 px-1 rounded",
                                            match ? "text-green-400 bg-green-950/30" : mismatch ? "text-amber-400 bg-amber-950/30" : "text-slate-500"].join(" ")}>
                                            {eff < 0 ? `+${Math.abs(eff)}` : eff}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 pl-5">
                                        {m.statsLabel || "—"}
                                        <span className="text-slate-700 ml-1">{m.rarity}</span>
                                        {!m.hasDamageEffect && !m.isBuiltIn && <span className="ml-1 text-amber-500">Effect not modeled</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Arcane Slot ───────────────────────────────────────────────────────────────

function ArcaneSlot({ label, arcane, rank, onChange, onRankChange, availableArcanes }: {
    label: string;
    arcane: ArcaneEntry | null;
    rank: number;
    onChange: (a: ArcaneEntry | null) => void;
    onRankChange: (r: number) => void;
    availableArcanes: ArcaneEntry[];
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [showDetails, setShowDetails] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return availableArcanes.filter(a => !q || a.name.toLowerCase().includes(q));
    }, [availableArcanes, query]);

    // Current stats at rank
    const statAtRank = arcane ? normalizeArcaneDisplayText(arcane.statsByRank[rank] ?? arcane.statsLabel) : null;

    return (
        <div className="relative" ref={panelRef}>
            <div className={["rounded-xl border transition-colors",
                arcane ? "border-slate-600 bg-slate-900/60 hover:border-slate-500"
                       : "border-dashed border-slate-700/60 bg-slate-950/20 hover:border-slate-600"].join(" ")}>
                <div className="p-3 flex items-start gap-2 min-h-[84px] cursor-pointer select-none"
                    onClick={() => { setOpen(x => !x); setQuery(""); }}>
                    {arcane ? (
                        <>
                            <div
                                className="relative flex-1 min-w-0"
                                onMouseEnter={() => setShowDetails(true)}
                                onMouseLeave={() => setShowDetails(false)}
                            >
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] uppercase tracking-wide text-violet-400/60">{label}</span>
                                    <span className="text-xs font-semibold text-slate-100 truncate">{arcane.name}</span>
                                    <span className="text-[9px] px-1 rounded border border-violet-700/50 bg-violet-950/30 text-violet-400 shrink-0">{arcane.rarity}</span>
                                </div>
                                <div
                                    className="mt-0.5 text-[10px] leading-tight text-slate-400"
                                    style={{
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {statAtRank}
                                    {rank < arcane.maxRank && <span className="text-slate-600 ml-1">@{rank}/{arcane.maxRank}</span>}
                                </div>
                                {showDetails && (
                                    <div className="wf-popover pointer-events-none absolute left-0 top-full z-[70] mt-2 w-64 rounded-lg border px-3 py-2">
                                        <div className="text-xs font-semibold leading-tight text-slate-100">{arcane.name}</div>
                                        <div className="mt-1 text-[11px] leading-relaxed text-slate-300">{statAtRank}</div>
                                    </div>
                                )}
                            </div>
                            <button className="text-slate-600 hover:text-slate-300 text-xs shrink-0"
                                onClick={e => { e.stopPropagation(); onChange(null); }}>✕</button>
                        </>
                    ) : (
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs w-full">
                            <span className="text-[8px] uppercase tracking-wide text-violet-400/40 mr-1">{label}</span>
                            <span>+</span><span>Add Arcane</span>
                        </div>
                    )}
                </div>

                {/* Rank slider */}
                {arcane && (
                    <div
                        className="grid grid-cols-[34px_minmax(0,1fr)_46px] items-center gap-2 px-3 pb-2 pt-1 border-t border-slate-800/40"
                        onClick={e => e.stopPropagation()}
                    >
                        <span className="text-[9px] text-slate-600">Rank</span>
                        <div className="min-w-0 px-2">
                            <input
                                type="range"
                                min={0}
                                max={arcane.maxRank}
                                value={rank}
                                onChange={e => onRankChange(+e.target.value)}
                                className="block w-full min-w-0 h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-violet-300 [&::-webkit-slider-thumb]:bg-slate-100 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-violet-300 [&::-moz-range-thumb]:bg-slate-100"
                            />
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 text-right">{rank}/{arcane.maxRank}</span>
                    </div>
                )}
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="p-2 border-b border-slate-800">
                        <input ref={inputRef} type="text" placeholder="Search arcanes…" value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                        {arcane && <button className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-800/50"
                            onClick={() => { onChange(null); setOpen(false); }}>Clear slot</button>}
                        {filtered.length === 0 && <div className="px-3 py-4 text-xs text-slate-500 text-center">No arcanes found</div>}
                        {filtered.map(a => (
                            <button key={a.uniqueName}
                                className={["w-full px-3 py-2 text-left hover:bg-slate-800/50 transition-colors",
                                    a.name === arcane?.name ? "bg-slate-800/30" : ""].join(" ")}
                                onClick={() => { onChange(a); onRankChange(a.maxRank); setOpen(false); setQuery(""); }}>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-slate-200 flex-1 truncate">{a.name}</span>
                                    <span className="text-[9px] px-1 rounded border border-violet-700/50 bg-violet-950/30 text-violet-400 shrink-0">{a.rarity}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{a.statsLabel}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Weapon Selector ───────────────────────────────────────────────────────────

function WeaponSelector({ selected, onSelect }: { selected: WeaponEntry | null; onSelect: (w: WeaponEntry) => void }) {
    const [query, setQuery] = useState("");
    const [cat, setCat] = useState<WeaponCategory | "All">("All");
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open]);
    const weapons  = useMemo(() => getWeaponCatalog(), []);
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        const matches = weapons.filter((weapon) => {
            if (cat !== "All" && weapon.category !== cat) return false;
            if (!q) return true;

            const haystacks = [
                weapon.name,
                weapon.category,
                weapon.weaponType,
            ].map((value) => value.toLowerCase());
            return haystacks.some((value) => value.includes(q));
        });

        const ranked = matches.sort((a, b) => {
            if (!q) return a.name.localeCompare(b.name);
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aStarts = aName.startsWith(q) ? 1 : 0;
            const bStarts = bName.startsWith(q) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            const aWord = aName.split(/\s+/).some((part) => part.startsWith(q)) ? 1 : 0;
            const bWord = bName.split(/\s+/).some((part) => part.startsWith(q)) ? 1 : 0;
            if (aWord !== bWord) return bWord - aWord;

            const aIdx = aName.indexOf(q);
            const bIdx = bName.indexOf(q);
            if (aIdx !== bIdx) return aIdx - bIdx;

            return a.name.localeCompare(b.name);
        });

        return ranked.slice(0, 120);
    }, [weapons, query, cat]);
    const activeFilterLabel = WEAPON_FILTER_OPTIONS.find((option) => option.value === cat)?.label ?? "All Weapons";

    return (
        <div className="relative" ref={panelRef}>
            <button ref={triggerRef} aria-haspopup="dialog" aria-expanded={open} aria-controls="wf-weapon-selector-panel" onClick={() => setOpen(x => !x)}
                className={["w-full rounded-2xl border px-3 py-3 text-left transition-all",
                    selected
                        ? "border-slate-600 bg-slate-900/70 shadow-[0_18px_50px_rgba(2,6,23,0.28)] hover:border-slate-500"
                        : "border-dashed border-slate-700 bg-slate-950/30 hover:border-slate-600 hover:bg-slate-950/40",
                    open ? "border-slate-500 shadow-[0_22px_60px_rgba(15,23,42,0.42)]" : "",
                ].join(" ")}>
                {selected ? (
                    <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-100">{selected.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                <span>{selected.category}</span>
                                <span className="text-slate-700">/</span>
                                <span>{selected.weaponType}</span>
                                {selected.canOverLevel && (
                                    <span className="rounded-full border border-[color:var(--wf-warning)] bg-[color:var(--wf-warning-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wf-warning)]">
                                        Rank 40
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className="text-xs text-slate-500 transition-transform">{open ? "▴" : "▾"}</span>
                    </div>
                ) : <span className="text-sm text-slate-500">Select a weapon…</span>}
            </button>
            {open && (
                <div id="wf-weapon-selector-panel" role="dialog" aria-label="Choose a weapon" className="wf-popover absolute z-50 mt-2 w-full overflow-hidden rounded-[22px] border backdrop-blur-xl">
                    <div className="border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] p-3">
                        <input ref={inputRef} type="text" placeholder="Search weapons, categories, or weapon types…" value={query}
                            aria-label="Search weapons"
                            onChange={e => setQuery(e.target.value)}
                            className="w-full rounded-2xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10" />
                        <div className="-mx-1 mt-3 overflow-x-auto pb-1">
                            <div role="group" aria-label="Weapon category" className="flex min-w-max gap-2 px-1">
                            {WEAPON_FILTER_OPTIONS.map((option) => (
                                <button key={option.value} aria-pressed={cat === option.value} onClick={() => setCat(option.value)}
                                    className={[
                                        "shrink-0 rounded-2xl border px-4 py-2.5 text-center text-[12px] font-semibold leading-none transition-all",
                                        cat === option.value
                                            ? "border-slate-100 bg-slate-100 text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.08)]"
                                            : "border-slate-700/80 bg-slate-900/55 text-slate-300 hover:border-slate-500 hover:bg-slate-900",
                                    ].join(" ")}>
                                    <span className="block whitespace-nowrap">{option.label}</span>
                                </button>
                            ))}
                        </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                            <span>{activeFilterLabel}</span>
                            <span>{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                        {filtered.length === 0 && (
                            <div className="px-4 py-8 text-center">
                                <div className="text-sm font-medium text-slate-300">No weapons matched that search.</div>
                                <div className="mt-1 text-xs text-slate-500">Try a broader name, change the filter, or search by weapon type.</div>
                            </div>
                        )}
                        {filtered.map(w => (
                            <button key={w.uniqueName}
                                className={["w-full px-4 py-3 text-left transition-colors hover:bg-slate-900/80",
                                    w.name === selected?.name ? "bg-slate-900/70" : ""].join(" ")}
                                onClick={() => { onSelect(w); setOpen(false); setQuery(""); triggerRef.current?.focus(); }}>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-slate-100">{w.name}</span>
                                            {w.attacks.length > 1 && <span className="rounded-full border border-blue-700/40 bg-blue-950/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-300">{w.attacks.length} atk</span>}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                            <span>{w.weaponType}</span>
                                            <span className="text-slate-700">/</span>
                                            <span>{fmt(w.damage.total)} dmg</span>
                                            <span className="text-slate-700">/</span>
                                            <span>{fmt(w.critChance * 100, 1)}% cc</span>
                                            <span className="text-slate-700">/</span>
                                            <span>{fmt(w.statusChance * 100, 1)}% sc</span>
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-slate-700/70 bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-400">
                                        {w.category}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Exclusion List ────────────────────────────────────────────────────────────

function ExclusionList({ allMods, excluded, onToggle }: {
    allMods: ModEntry[]; excluded: Set<string>; onToggle: (uniqueName: string) => void;
}) {
    const [query, setQuery] = useState("");
    const filteredAll = useMemo(() => {
        const q = query.toLowerCase();
        return allMods.filter(m => !q || getBuilderDisplayModName(m).toLowerCase().includes(q)).slice(0, 60);
    }, [allMods, query]);

    return (
        <WorkspacePanel className="space-y-3 p-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Excluded Mods</div>
                <span className="text-[10px] text-slate-600">{excluded.size} excluded · Excluded mods are never used by the optimizer</span>
            </div>
            <input type="text" placeholder="Search to add/remove exclusions…" value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
            {excluded.size > 0 && (
                <div>
                    <div className="text-[10px] text-slate-600 mb-1.5 uppercase tracking-wide">Currently excluded</div>
                    <div className="flex flex-wrap gap-1.5">
                        {[...excluded]
                            .map(uniqueName => allMods.find(mod => mod.uniqueName === uniqueName) ?? null)
                            .filter((mod): mod is ModEntry => !!mod)
                            .filter(mod => !query || getBuilderDisplayModName(mod).toLowerCase().includes(query.toLowerCase()))
                            .map(mod => (
                            <button key={mod.uniqueName} onClick={() => onToggle(mod.uniqueName)}
                                className="rounded-full px-2.5 py-0.5 text-[10px] border border-red-700/60 bg-red-950/30 text-red-300 hover:bg-red-900/40 transition-colors">
                                ✕ {getBuilderDisplayModName(mod)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {filteredAll.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                    {filteredAll.map(m => (
                        <button key={m.uniqueName} onClick={() => onToggle(m.uniqueName)}
                            className={["w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-800/50",
                                excluded.has(m.uniqueName) ? "text-red-300 bg-red-950/10" : "text-slate-300"].join(" ")}>
                            <span className="w-4 shrink-0 text-center">{excluded.has(m.uniqueName) ? "✕" : "+"}</span>
                            {m.polarity && <PolarityIcon polarity={m.polarity} className="w-3 h-3 opacity-50 shrink-0" />}
                            <span className="flex-1 truncate">{getBuilderDisplayModName(m)}</span>
                            <span className="text-slate-600 ml-auto shrink-0 truncate max-w-[120px]">{m.statsLabel.slice(0, 24)}</span>
                        </button>
                    ))}
                </div>
            )}
            {!query && excluded.size === 0 && (
                <div className="text-[11px] text-slate-600 text-center py-1">Search above to exclude mods from the optimizer.</div>
            )}
        </WorkspacePanel>
    );
}

// ── Saved Builds ──────────────────────────────────────────────────────────────

function SavedBuildsPanel({ weapon, availableMods, currentSlots, currentRanks, currentPolarities, currentCfg,
    stanceMod, stanceRank, stancePol, exilusMod, exilusPol, arcane1, arcane1Rank, hasExilus,
    targetFaction, conditionalState, targetProfileOverride, plannerConfig, onLoad }: {
    weapon: WeaponEntry | null;
    availableMods: ModEntry[];
    currentSlots: (ModEntry | null)[]; currentRanks: number[]; currentPolarities: string[];
    currentCfg: BuildCfg;
    stanceMod: ModEntry | null; stanceRank: number; stancePol: string;
    exilusMod: ModEntry | null; exilusPol: string;
    arcane1: ArcaneEntry | null; arcane1Rank: number;
    hasExilus: boolean;
    targetFaction: string;
    conditionalState: ConditionalState;
    targetProfileOverride?: TargetProfileOverride;
    plannerConfig: SavedBuildPlannerConfig;
    onLoad: (b: SavedBuild) => void;
}) {
    const savedBuilds  = useTrackerStore(s => s.state.modBuilder?.savedBuilds ?? EMPTY_SAVED_BUILDS);
    const saveModBuild = useTrackerStore(s => s.saveModBuild);
    const deleteBuild  = useTrackerStore(s => s.deleteModBuild);
    const allMods      = useMemo(() => availableMods, [availableMods]);
    const panelArcanes = useMemo(() => weapon ? getArcanesForWeapon(weapon) : [], [weapon]);
    const [saveName, setSaveName] = useState("");
    const [saving, setSaving]     = useState(false);
    const [comparing, setComparing] = useState<Set<string>>(new Set());

    function handleSave() {
        if (!weapon || !saveName.trim()) return;
        saveModBuild({
            id: uid(), name: saveName.trim(),
            weaponUniqueName: weapon.uniqueName, weaponName: weapon.name,
            slotModUniqueNames: currentSlots.map(m => m?.uniqueName ?? ""),
            slotRanks: [...currentRanks],
            stanceModUniqueName: stanceMod?.uniqueName,
            stanceRank,
            stancePol,
            slotPolarities: [...currentPolarities],
            weaponRank: currentCfg.weaponRank, hasCatalyst: currentCfg.hasCatalyst,
            valenceBonusPct: weapon.isProgenitorWeapon ? currentCfg.valenceBonusPct : undefined,
            valenceElement: weapon.isProgenitorWeapon ? currentCfg.valenceElement : undefined,
            optimizeValenceElement: weapon.isProgenitorWeapon ? currentCfg.optimizeValenceElement : undefined,
            incarnonUnlockedTier: getIncarnonRecordForWeapon(weapon) ? getHighestSelectedIncarnonTier(currentCfg.incarnonSelectedOptionsByTier) : undefined,
            incarnonSelectedOptionsByTier: getIncarnonRecordForWeapon(weapon) ? currentCfg.incarnonSelectedOptionsByTier : undefined,
            optimizeIncarnonSelections: getIncarnonRecordForWeapon(weapon) ? currentCfg.optimizeIncarnonSelections : undefined,
            hasExilus,
            exilusModUniqueName: exilusMod?.uniqueName,
            exilusPol,
            arcane1UniqueName: arcane1?.uniqueName, arcane1Rank,
            plannerConfig,
            createdAt: new Date().toISOString(),
        });
        setSaveName(""); setSaving(false);
    }

    const thisWeapon = savedBuilds.filter(b => weapon && b.weaponUniqueName === weapon.uniqueName);
    const others     = savedBuilds.filter(b => !weapon || b.weaponUniqueName !== weapon.uniqueName);
    const comparedBuilds = thisWeapon.filter(b => comparing.has(b.id));

    function toggleCompare(id: string) {
        setComparing(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function buildSavedBuildEffects(build: SavedBuild): (ModEffect | null)[] {
        const effects: (ModEffect | null)[] = [];
        for (let i = 0; i < build.slotModUniqueNames.length; i++) {
            const uniqueName = build.slotModUniqueNames[i];
            if (!uniqueName) continue;
            const mod = allMods.find(m => m.uniqueName === uniqueName) ?? null;
            if (!mod) continue;
            const rank = build.slotRanks?.[i] ?? mod.fusionLimit;
            effects.push(mod.effectsByRank[rank] ?? mod.effect);
        }
        if (build.stanceModUniqueName) {
            const mod = allMods.find(m => m.uniqueName === build.stanceModUniqueName) ?? null;
            if (mod) {
                const rank = build.stanceRank ?? mod.fusionLimit;
                effects.push(mod.effectsByRank[rank] ?? mod.effect);
            }
        }
        if (build.hasExilus && build.exilusModUniqueName) {
            const mod = allMods.find(m => m.uniqueName === build.exilusModUniqueName) ?? null;
            if (mod) {
                const rank = build.exilusRank ?? mod.fusionLimit;
                effects.push(mod.effectsByRank[rank] ?? mod.effect);
            }
        }
        if (build.arcane1UniqueName) {
            const arcane = panelArcanes.find(a => a.uniqueName === build.arcane1UniqueName) ?? null;
            if (arcane) {
                const rank = build.arcane1Rank ?? arcane.maxRank;
                const ae = getArcaneEffectAtRank(arcane, rank, build.plannerConfig?.warframeArmor, true, {
                    warframeMaxEnergy: build.plannerConfig?.warframeMaxEnergy,
                    warframeEnergyPercent: build.plannerConfig?.warframeEnergyPercent,
                });
                if (ae) effects.push({
                    ...emptyEffect(),
                    ...ae,
                    conditionalEffects: [...(ae.conditionalEffects ?? [])],
                });
            }
        }
        return effects;
    }

    function buildCfgFromSavedBuild(build: SavedBuild): BuildCfg {
        const selectedOptionsByTier = build.incarnonSelectedOptionsByTier ?? currentCfg.incarnonSelectedOptionsByTier;
        return {
            weaponRank: build.weaponRank,
            hasCatalyst: build.hasCatalyst,
            masteryRank: currentCfg.masteryRank,
            valenceBonusPct: build.valenceBonusPct ?? currentCfg.valenceBonusPct,
            valenceElement: (build.valenceElement as ValenceElement | undefined) ?? currentCfg.valenceElement,
            optimizeValenceElement: build.optimizeValenceElement ?? false,
            incarnonUnlockedTier: getHighestSelectedIncarnonTier(selectedOptionsByTier) || build.incarnonUnlockedTier || currentCfg.incarnonUnlockedTier,
            incarnonSelectedOptionsByTier: selectedOptionsByTier,
            optimizeIncarnonSelections: build.optimizeIncarnonSelections ?? false,
        };
    }

    function comparisonRows(stats: ReturnType<typeof calculateBuild>) {
        const category = weapon?.category ?? "Primary";
        const avgDamageLabel = averageDamageLabel(category);
        const rateLabel = actionRateLabel(category);
        const rows: Array<[string, string]> = [
            ["Burst DPS", fmt(stats.burstDPS)],
            ["Sustained DPS", fmt(stats.sustainedDPS)],
            [avgDamageLabel, fmt(stats.modded.averageShotDamage)],
            ["Arsenal Total", fmt(stats.modded.arsenalDamage)],
            ["Crit Chance", `${fmt(stats.modded.critChance * 100, 1)}%`],
            ["Crit Mult", `${fmt(stats.modded.critMultiplier, 2)}x`],
            ["Crit Tier", `${fmt(stats.modded.averageCritTier, 2)}x`],
            ["Status", `${fmt(stats.modded.statusChance * 100, 1)}%`],
            ["Multishot", fmt(stats.modded.multishot, 2)],
            [rateLabel, fmt(stats.modded.fireRate, 2)],
            ["Avg Procs", fmt(stats.modded.averageProcsPerShot, 2)],
            ["DoT DPS", fmt(stats.modded.dotDps)],
        ];
        for (const [key, value] of Object.entries(stats.modded.rawDamageBreakdown)) {
            if ((value ?? 0) > 0) rows.push([key[0].toUpperCase() + key.slice(1), fmt(value ?? 0, 1)]);
        }
        return rows;
    }

    return (
        <WorkspacePanel className="space-y-3 p-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Saved Builds</div>
                {weapon && <button onClick={() => setSaving(v => !v)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">{saving ? "Cancel" : "+ Save current"}</button>}
            </div>
            {saving && (
                <div className="flex gap-2">
                    <input type="text" placeholder="Build name…" value={saveName} onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
                    <button onClick={handleSave} disabled={!saveName.trim()}
                        className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">Save</button>
                </div>
            )}
            {comparedBuilds.length > 1 && weapon && (
                <div className="rounded-xl border border-blue-900/40 bg-blue-950/10 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-blue-300 mb-2">Side-by-side comparison</div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${comparedBuilds.length}, minmax(0, 1fr))` }}>
                        {comparedBuilds.map(b => {
                            const buildCfg = buildCfgFromSavedBuild(b);
                            const weaponState = applyWeaponConfig(weapon, 0, buildCfg);
                            const stats = calculateBuild(
                                weaponState.selectedWeapon,
                                [...weaponState.activeIncarnonEffects, ...buildSavedBuildEffects(b)],
                                targetFaction,
                                { conditionalState, statusImmuneTypes: targetProfileOverride?.statusImmuneTypes, statusStackCaps: targetProfileOverride?.statusStackCaps },
                            );
                            return (
                                <div key={b.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                                    <div className="text-xs font-semibold text-slate-100">{b.name}</div>
                                    <div className="space-y-1">
                                        {comparisonRows(stats).map(([lbl, val]) => (
                                            <div key={lbl} className="flex justify-between gap-2 text-[11px]">
                                                <span className="text-slate-500">{lbl}</span>
                                                <span className="font-mono text-slate-200 text-right">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {savedBuilds.length === 0 && <div className="text-[11px] text-slate-600 text-center py-2">No saved builds yet.</div>}
            {thisWeapon.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">This weapon</div>
                    {thisWeapon.map(b => {
                        const stats = weapon ? (() => {
                            const buildCfg = buildCfgFromSavedBuild(b);
                            const weaponState = applyWeaponConfig(weapon, 0, buildCfg);
                            return calculateBuild(
                                weaponState.selectedWeapon,
                                [...weaponState.activeIncarnonEffects, ...buildSavedBuildEffects(b)],
                                targetFaction,
                                { conditionalState, statusImmuneTypes: targetProfileOverride?.statusImmuneTypes, statusStackCaps: targetProfileOverride?.statusStackCaps },
                            );
                        })() : null;
                        return (
                            <div key={b.id} className={["rounded-lg border px-3 py-2",
                                comparing.has(b.id) ? "border-blue-700/50 bg-blue-950/10" : "border-slate-800 bg-slate-900/40"].join(" ")}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-200 truncate">{b.name}</div>
                                        <div className="text-[10px] text-slate-500">
                                            {b.slotModUniqueNames.filter(Boolean).length} mods · Rank {b.weaponRank}
                                            {b.hasCatalyst ? " · ◈" : ""}
                                            {b.hasExilus ? " · Exilus" : ""}
                                            {b.arcane1UniqueName ? " · Arcane" : ""}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => toggleCompare(b.id)}
                                            className={["text-[10px] px-2 py-1 rounded border transition-colors",
                                                comparing.has(b.id) ? "border-blue-600 bg-blue-900/40 text-blue-300" : "border-slate-700 text-slate-400 hover:text-slate-200"].join(" ")}>
                                            {comparing.has(b.id) ? "Selected" : "Compare"}
                                        </button>
                                        <button onClick={() => onLoad(b)} className="text-[10px] px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">Load</button>
                                        <button onClick={() => deleteBuild(b.id)} className="text-[10px] text-slate-700 hover:text-red-400 transition-colors px-1">✕</button>
                                    </div>
                                </div>
                                {comparing.has(b.id) && stats && (
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-slate-800/60">
                                        {comparisonRows(stats).slice(0, 12).map(([lbl, val]) => (
                                            <div key={lbl} className="flex items-center justify-between gap-2 text-[10px]">
                                                <div className="text-slate-600">{lbl}</div>
                                                <div className="font-mono text-blue-300 text-right">{val}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {others.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Other weapons</div>
                    {others.map(b => (
                        <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200 truncate">{b.name}</div>
                                <div className="text-[10px] text-slate-500">{b.weaponName} · {b.slotModUniqueNames.filter(Boolean).length} mods</div>
                            </div>
                            <button onClick={() => deleteBuild(b.id)} className="text-[10px] text-slate-700 hover:text-red-400 transition-colors px-1 shrink-0">✕</button>
                        </div>
                    ))}
                </div>
            )}
        </WorkspacePanel>
    );
}

// ── Owned Mods ────────────────────────────────────────────────────────────────

function OwnedModsPanel({ availableMods }: { availableMods: ModEntry[] }) {
    const inventoryCounts = useTrackerStore(s => s.state.inventory.counts ?? EMPTY_COUNTS);
    const inventoryModRanks = useTrackerStore(s => s.state.inventory.modRanks ?? EMPTY_MOD_RANKS);
    const setCount = useTrackerStore(s => s.setCount);
    const setModRank = useTrackerStore(s => s.setModRank);
    const [query, setQuery] = useState("");
    const allMods = useMemo(() => availableMods.filter(m => m.compatBucket !== "Riven"), [availableMods]);
    const ownedCountForMod = (path: string) => inventoryCounts[`mods:${path}`] ?? inventoryCounts[path] ?? 0;
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return allMods.filter(m => !q || getBuilderDisplayModName(m).toLowerCase().includes(q));
    }, [allMods, query]);

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Owned Mods</div>
                <div className="flex gap-3 text-[10px]">
                    <button onClick={() => allMods.forEach(m => { setCount(`mods:${m.path}`, 1); setModRank(m.path, m.fusionLimit); })} className="text-slate-400 hover:text-slate-200">All</button>
                    <button onClick={() => allMods.forEach(m => { setCount(`mods:${m.path}`, 0); setModRank(m.path, 0); })} className="text-slate-400 hover:text-slate-200">None</button>
                    <span className="text-slate-600">{allMods.filter(m => Number(ownedCountForMod(m.path)) > 0).length}/{allMods.length} owned</span>
                </div>
            </div>
            <input type="text" placeholder="Filter mods…" value={query} onChange={e => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                {filtered.map(m => (
                    <label key={m.uniqueName} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/40 cursor-pointer">
                        <input type="checkbox" checked={Number(ownedCountForMod(m.path)) > 0}
                            onChange={() => {
                                const nextOwned = Number(ownedCountForMod(m.path)) > 0 ? 0 : 1;
                                setCount(`mods:${m.path}`, nextOwned);
                                setModRank(m.path, nextOwned > 0 ? m.fusionLimit : 0);
                            }}
                            className="accent-blue-500 shrink-0" />
                        <span className="shrink-0">
                            {m.polarity ? <PolarityIcon polarity={m.polarity} className="w-3.5 h-3.5 opacity-60" /> : <span className="text-slate-700 text-xs">○</span>}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-200 truncate">{getBuilderDisplayModName(m)}</div>
                            {m.statsLabel && <div className="text-[10px] text-slate-500 truncate">{m.statsLabel}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.preventDefault()}>
                            <button
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                disabled={Number(ownedCountForMod(m.path)) <= 0 || getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) <= 0}
                                onClick={() => setModRank(m.path, Math.max(0, getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) - 1))}
                            >−</button>
                            <span className={["w-8 text-center text-[10px] font-mono", Number(ownedCountForMod(m.path)) > 0 ? "text-emerald-400" : "text-slate-600"].join(" ")}>
                                R{getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks)}
                            </span>
                            <button
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                disabled={Number(ownedCountForMod(m.path)) <= 0 || getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) >= m.fusionLimit}
                                onClick={() => setModRank(m.path, Math.min(m.fusionLimit, getOwnedModRank(m.path, m.fusionLimit, inventoryCounts, inventoryModRanks) + 1))}
                            >+</button>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}

function OwnedArcanesPanel({ weapon }: { weapon: WeaponEntry | null }) {
    const inventoryArcaneRanks = useTrackerStore(s => s.state.inventory.arcaneRanks ?? EMPTY_ARCANE_RANKS);
    const inventoryCounts = useTrackerStore(s => s.state.inventory.counts ?? EMPTY_COUNTS);
    const setArcaneRankCount = useTrackerStore(s => s.setArcaneRankCount);
    const [query, setQuery] = useState("");
    const allArcanes = useMemo(() => weapon ? getArcanesForWeapon(weapon) : [], [weapon]);
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return allArcanes.filter(a => !q || a.name.toLowerCase().includes(q));
    }, [allArcanes, query]);

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Owned Arcanes</div>
                <div className="text-[10px] text-slate-500">Shared with Mods &amp; Arcanes inventory</div>
            </div>
            <input type="text" placeholder="Filter arcanes…" value={query} onChange={e => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500" />
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                {filtered.map(arcane => {
                    const rankCounts = inventoryArcaneRanks[arcane.uniqueName] ?? {};
                    const fallbackCount = Number(inventoryCounts[`mods:${arcane.uniqueName}`] ?? inventoryCounts[arcane.uniqueName] ?? 0);
                    const highestOwnedRank = getHighestOwnedArcaneRankWithFallback(rankCounts, fallbackCount);
                    return (
                        <div key={arcane.uniqueName} className="px-3 py-3 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-200 truncate">{arcane.name}</div>
                                    <div className="text-[10px] text-slate-500">{highestOwnedRank === null ? "Not owned" : `Highest owned rank: R${highestOwnedRank}`}</div>
                                </div>
                                <div className="shrink-0 text-[10px] text-slate-500">{arcane.rarity}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Array.from({ length: arcane.maxRank + 1 }, (_, rank) => {
                                    const isSelected = highestOwnedRank === rank;
                                    return (
                                        <button
                                            key={rank}
                                            className={[
                                                "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                                                isSelected
                                                    ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-200"
                                                    : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60",
                                            ].join(" ")}
                                            onClick={() => setArcaneRankCount(arcane.uniqueName, rank, isSelected ? 0 : 1)}
                                        >
                                            R{rank}
                                        </button>
                                    );
                                })}
                                <button
                                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                    onClick={() => setArcaneRankCount(arcane.uniqueName, 0, 0)}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface BuildCfg {
    weaponRank: number;
    hasCatalyst: boolean;
    masteryRank: number;
    valenceBonusPct: number;
    valenceElement: ValenceElement;
    optimizeValenceElement: boolean;
    incarnonUnlockedTier: number;
    incarnonSelectedOptionsByTier: Partial<Record<IncarnonTier, string>>;
    optimizeIncarnonSelections: boolean;
}

type DragSlotKind = "main" | "exilus";
type OptimizeMode = "optimize" | "fill";

interface DragSlotRef {
    kind: DragSlotKind;
    index: number;
}

function maxOptimizerFormaForWeapon(weapon: WeaponEntry | null) {
    if (!weapon) return 9;
    return supportsStanceLikeMods(weapon) ? 10 : 9;
}

export default function ModBuilder() {
    const masteryRank      = useTrackerStore(s => s.state.player.masteryRank) ?? 0;
    const inventoryArcaneRanks = useTrackerStore(s => s.state.inventory.arcaneRanks ?? EMPTY_ARCANE_RANKS);
    const inventoryCounts = useTrackerStore(s => s.state.inventory.counts ?? EMPTY_COUNTS);
    const inventoryModRanks = useTrackerStore(s => s.state.inventory.modRanks ?? EMPTY_MOD_RANKS);
    const inventoryCustomRivens = useTrackerStore(s => s.state.inventory.customRivens ?? EMPTY_CUSTOM_RIVENS);

    const [weapon, setWeapon]          = useState<WeaponEntry | null>(null);
    const [slots, setSlots]            = useState<(ModEntry | null)[]>(Array(SLOT_COUNT).fill(null));
    const [ranks, setRanks]            = useState<number[]>(Array(SLOT_COUNT).fill(0));
    const [slotPols, setSlotPols]      = useState<string[]>(Array(SLOT_COUNT).fill(""));
    const [stanceMod, setStanceMod]    = useState<ModEntry | null>(null);
    const [stanceRank, setStanceRank]  = useState(0);
    const [stancePol, setStancePol]    = useState("");
    // Exilus
    const [hasExilus, setHasExilus]    = useState(false);
    const [exilusMod, setExilusMod]    = useState<ModEntry | null>(null);
    const [exilusRank, setExilusRank]  = useState(0);
    const [exilusPol, setExilusPol]    = useState("");
    // Arcanes — weapons only have 1 arcane slot
    const [arcane1, setArcane1]        = useState<ArcaneEntry | null>(null);
    const [arcane1Rank, setArcane1Rank]= useState(0);
    const [includeArcaneStats, setIncludeArcaneStats] = useState(true);
    const [warframeArmorInput, setWarframeArmorInput] = useState("");
    const warframeArmor = parseWarframeArmorInput(warframeArmorInput);
    const [warframeMaxEnergyInput, setWarframeMaxEnergyInput] = useState("");
    const [warframeEnergyPercentInput, setWarframeEnergyPercentInput] = useState("");
    const warframeMaxEnergy = parseWarframeMaxEnergyInput(warframeMaxEnergyInput);
    const warframeEnergyPercent = parseWarframeEnergyPercentInput(warframeEnergyPercentInput);
    const arcaneEnergyContext = useMemo(() => ({ warframeMaxEnergy, warframeEnergyPercent }), [warframeMaxEnergy, warframeEnergyPercent]);
    // Attack mode selection
    const [selectedAttackIdx, setSelectedAttackIdx] = useState(0);
    // Excluded
    const [excluded, setExcluded]      = useState<Set<string>>(new Set());
    // Build config
    const [buildCfg, setBuildCfg]      = useState<BuildCfg>({
        weaponRank: 30,
        hasCatalyst: false,
        masteryRank,
        valenceBonusPct: 0.25,
        valenceElement: "heat",
        optimizeValenceElement: false,
        incarnonUnlockedTier: 0,
        incarnonSelectedOptionsByTier: {},
        optimizeIncarnonSelections: false,
    });
    // Optimizer
    const [goal, setGoal]              = useState<OptimizeGoal>("burst");
    const [conditionalMode, setConditionalMode] = useState<ConditionalState["mode"]>("realistic");
    const [externalConditionalStacks, setExternalConditionalStacks] = useState(1);
    const [externalStatusTypeCount, setExternalStatusTypeCount] = useState(0);
    const [meleeComboMultiplier, setMeleeComboMultiplier] = useState(1);
    const [phantasmaChargeAmmo, setPhantasmaChargeAmmo] = useState(2);
    const [meleeDpsInputs, setMeleeDpsInputs] = useState<MeleeDpsInputState>({
        averageComboDamageMultiplier: null,
        baseComboLengthSeconds: null,
    });
    const meleeDpsModelNote = weapon && usesMeleeDamageModel(weapon.category)
        ? "Default burst and sustained DPS remain attack-rate estimates. The combo scenario scales Blood Rush, Weeping Wounds, and selected heavy-attack damage. The stats panel projects one-hit Heavy Attack Efficiency retention. Direct-hit TTK steps repeated Heavy Attacks and restores Initial Combo at 40 points/s; it still excludes attack-generated combo, Tennokai, stance sequences, and heavy-attack wind-up. DPS, finite status encounter, and optimizer scoring hold the entered tier across each scored hit. Optional stance-average DPS uses user-entered average combo damage and base combo length; it excludes status effects, target defenses, and follow-through."
        : "";
    const maxMeleeComboMultiplier = weapon ? getMeleeComboRules(weapon).maxMultiplier : 12;
    useEffect(() => {
        if (weapon) setMeleeComboMultiplier((current) => clampMeleeComboMultiplier(weapon, current));
    }, [weapon]);
    const conditionalState = useMemo<ConditionalState>(() => ({
        mode: conditionalMode,
        externalStacks: conditionalMode === "custom" ? externalConditionalStacks : undefined,
        externalStatusTypeCount,
        meleeComboMultiplier,
        phantasmaChargeAmmo,
    }), [conditionalMode, externalConditionalStacks, externalStatusTypeCount, meleeComboMultiplier, phantasmaChargeAmmo]);
    const respectCap = true;
    const [allowNonMax, setAllowNonMax]  = useState(false);
    const [onlyOwned, setOnlyOwned]      = useState(false);
    const [factionOn, setFactionOn]      = useState(false);
    const [faction, setFaction]          = useState("Grineer");
    const [selectedEnemyProfileId, setSelectedEnemyProfileId] = useState("");
    const [useCustomTargetStats, setUseCustomTargetStats] = useState(false);
    const [nearbyEnemyCount, setNearbyEnemyCount] = useState(0);
    const [nearbyBlastEnemyCount, setNearbyBlastEnemyCount] = useState(0);
    const [isEximus, setIsEximus] = useState(false);
    const [bossBlastStackCap, setBossBlastStackCap] = useState(false);
    const [isSteelPath, setIsSteelPath] = useState(false);
    const [customTargetStats, setCustomTargetStats] = useState({ armor: 2700, health: 25000, shields: 0, overguard: 0 });
    const [scaleCustomTargetByLevel, setScaleCustomTargetByLevel] = useState(false);
    const [enemyScalingFaction, setEnemyScalingFaction] = useState<EnemyScalingFaction>("grineer");
    const [enemyBaseLevel, setEnemyBaseLevel] = useState(1);
    const [enemyCurrentLevel, setEnemyCurrentLevel] = useState(30);
    const [customToxinBypassesShields, setCustomToxinBypassesShields] = useState(true);
    const [enemyShieldGateHitMode, setEnemyShieldGateHitMode] = useState<"body" | "weakspot" | "blockedArea">("body");
    const [targetStatusImmunities, setTargetStatusImmunities] = useState<StatusDamageType[]>([]);
    const selectEnemyProfile = useCallback((profileId: string) => {
        const profile = getEnemyProfile(profileId);
        setSelectedEnemyProfileId(profile?.id ?? "");
        setIsEximus(false);
        setBossBlastStackCap(false);
        if (!profile) {
            setUseCustomTargetStats(false);
            return;
        }
        setFactionOn(true);
        setFaction(profile.faction);
        setUseCustomTargetStats(true);
        setCustomTargetStats({
            health: profile.health,
            shields: profile.shields,
            armor: profile.armor,
            overguard: profile.overguard,
        });
        setScaleCustomTargetByLevel(true);
        setEnemyScalingFaction(profile.scalingFaction);
        setEnemyBaseLevel(profile.baseLevel);
        setEnemyCurrentLevel(Math.max(30, profile.baseLevel));
        setCustomToxinBypassesShields(profile.toxinBypassesShields);
        setEnemyShieldGateHitMode("body");
        setTargetStatusImmunities([]);
    }, []);
    const resolvedCustomTargetStats = useMemo(() => {
        const effectiveLevel = getSteelPathEnemyLevel(enemyCurrentLevel, isSteelPath);
        if (!scaleCustomTargetByLevel) {
            return {
                ...customTargetStats,
                overguard: isEximus
                    ? scaleEnemyOverguard(EXIMUS_BASE_OVERGUARD, effectiveLevel)
                    : customTargetStats.overguard,
            };
        }
        const baseHealth = isEximus
            ? applyEximusHealthBaseAdjustment(
                customTargetStats.health,
                effectiveLevel,
                customTargetStats.shields > 0 || customTargetStats.armor > 0,
            )
            : customTargetStats.health;
        const baseShields = isEximus
            ? applyEximusShieldBaseAdjustment(customTargetStats.shields, effectiveLevel)
            : customTargetStats.shields;
        const health = scaleEnemyStat("health", baseHealth, enemyScalingFaction, enemyBaseLevel, effectiveLevel);
        const shields = scaleEnemyStat("shield", baseShields, enemyScalingFaction, enemyBaseLevel, effectiveLevel);
        return {
            health: applySteelPathStatMultiplier("health", health, isSteelPath),
            shields: applySteelPathStatMultiplier("shield", shields, isSteelPath),
            armor: scaleEnemyStat("armor", customTargetStats.armor, enemyScalingFaction, enemyBaseLevel, effectiveLevel),
            overguard: scaleEnemyOverguard(isEximus ? EXIMUS_BASE_OVERGUARD : customTargetStats.overguard, effectiveLevel),
        };
    }, [customTargetStats, scaleCustomTargetByLevel, enemyScalingFaction, enemyBaseLevel, enemyCurrentLevel, isEximus, isSteelPath]);
    const targetProfileOverride = useMemo<TargetProfileOverride | undefined>(() => {
        if (!useCustomTargetStats) return undefined;
        const hasActiveOverguard = resolvedCustomTargetStats.overguard > 0;
        return {
            ...resolvedCustomTargetStats,
            description: isSteelPath
                ? `Steel Path: mission level ${enemyCurrentLevel} becomes ${getSteelPathEnemyLevel(enemyCurrentLevel, true)}; Health and Shields ×2.5, with no separate Armor multiplier.`
                : undefined,
            hasOverguard: hasActiveOverguard,
            crowdControlImmune: hasActiveOverguard,
            toxinBypassesShields: customToxinBypassesShields,
            enemyShieldGateHitMode,
            nearbyEnemyCount,
            nearbyBlastEnemyCount,
            // Radiation immunity and the four-stack Cold cap are conditional on
            // Overguard remaining; the encounter simulator applies them per event.
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps: bossBlastStackCap ? { blast: 4 } : undefined,
        };
    }, [useCustomTargetStats, resolvedCustomTargetStats, customToxinBypassesShields, enemyShieldGateHitMode, nearbyEnemyCount, nearbyBlastEnemyCount, targetStatusImmunities, bossBlastStackCap, isSteelPath, enemyCurrentLevel]);
    const [allowCatalyst, setAllowCatalyst] = useState(false);
    const [allowForma, setAllowForma]    = useState(false);
    const [maxFormaAllowed, setMaxFormaAllowed] = useState(9);
    const [optExilus, setOptExilus]      = useState(false);
    const [optArcane, setOptArcane]      = useState(false);
    const [showOptimizeOptions, setShowOptimizeOptions] = useState(false);
    // UI
    const [infoTab, setInfoTab]        = useState<"stats"|"why">("stats");
    const [reasoning, setReasoning]    = useState<BuildReasoning | null>(null);
    const [reasoningMath, setReasoningMath] = useState<BuildMathBreakdown | null>(null);
    const [reasoningContextAtOptimization, setReasoningContextAtOptimization] = useState<string | null>(null);
    const currentReasoningContextKey = useMemo(() => JSON.stringify({
        goal,
        conditionalState,
        selectedAttackIdx,
        targetFaction: factionOn ? faction : "",
        targetProfileOverride,
    }), [goal, conditionalState, selectedAttackIdx, factionOn, faction, targetProfileOverride]);
    const displayedReasoning = reasoningContextAtOptimization === currentReasoningContextKey ? reasoning : null;
    useEffect(() => {
        setReasoningMath(null);
    }, [meleeDpsInputs]);
    const [showMathWindow, setShowMathWindow] = useState(false);
    const [tab, setTab]                = useState<"build"|"saves"|"owned"|"ownedArcanes"|"exclude">("build");
    const [optimizing, setOptimizing]  = useState(false);
    const [optimizerProgress, setOptimizerProgress] = useState<string | null>(null);
    const [optimizerNotice, setOptimizerNotice] = useState<string | null>(null);
    const optimizerWorkerRef = useRef<Worker | null>(null);
    const pendingWorkerRejectRef = useRef<((reason?: unknown) => void) | null>(null);
    const optimizerRequestIdRef = useRef(0);
    const optimizerCancelledRef = useRef(false);
    const optimizerApplyingRef = useRef(false);
    const cancelOptimization = useCallback(() => {
        if (optimizerApplyingRef.current || (!optimizerWorkerRef.current && !optimizing)) return;
        optimizerCancelledRef.current = true;
        optimizerWorkerRef.current?.terminate();
        optimizerWorkerRef.current = null;
        pendingWorkerRejectRef.current?.(new Error("Optimization cancelled."));
        pendingWorkerRejectRef.current = null;
        setOptimizerProgress(null);
        setOptimizerNotice("Optimization cancelled.");
        setOptimizing(false);
    }, [optimizing]);
    const [copiedExport, setCopiedExport] = useState(false);
    const [sharingBuildImage, setSharingBuildImage] = useState(false);
    const [sharedBuildImage, setSharedBuildImage] = useState(false);
    const [draggedSlot, setDraggedSlot] = useState<DragSlotRef | null>(null);
    const [dragOverSlot, setDragOverSlot] = useState<DragSlotRef | null>(null);
    const [optimizeMode, setOptimizeMode] = useState<OptimizeMode>("optimize");
    const [incarnonPickerTier, setIncarnonPickerTier] = useState<IncarnonTier | null>(null);
    const incarnonDialogRef = useRef<HTMLDivElement | null>(null);
    const mathDialogRef = useRef<HTMLDivElement | null>(null);
    const savedPlannerConfig = useMemo<SavedBuildPlannerConfig>(() => {
        const target: SavedBuildTargetConfig = {
            enabled: factionOn,
            faction,
            enemyProfileId: selectedEnemyProfileId || undefined,
            isEximus,
            bossBlastStackCap,
            isSteelPath,
            useCustomStats: useCustomTargetStats,
            baseStats: { ...customTargetStats },
            scaleByLevel: scaleCustomTargetByLevel,
            scalingFaction: enemyScalingFaction,
            baseLevel: enemyBaseLevel,
            currentLevel: enemyCurrentLevel,
            toxinBypassesShields: customToxinBypassesShields,
            enemyShieldGateHitMode,
            nearbyEnemyCount,
            nearbyBlastEnemyCount,
            statusImmunities: [...targetStatusImmunities],
        };
        return {
            goal,
            conditionalMode,
            externalConditionalStacks,
            externalStatusTypeCount,
            meleeComboMultiplier,
            phantasmaChargeAmmo,
            meleeAverageComboDamageMultiplier: meleeDpsInputs.averageComboDamageMultiplier ?? undefined,
            meleeBaseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds ?? undefined,
            warframeArmor,
            warframeMaxEnergy,
            warframeEnergyPercent,
            attackIndex: selectedAttackIdx,
            attackName: weapon?.attacks[selectedAttackIdx]?.name,
            target,
            optimizerOptions: {
                allowNonMax,
                onlyOwned,
                allowCatalyst,
                allowForma,
                maxFormaAllowed,
                optimizeExilus: optExilus,
                optimizeArcane: optArcane,
                excludedModUniqueNames: [...excluded],
            },
        };
    }, [
        allowCatalyst,
        allowForma,
        allowNonMax,
        conditionalMode,
        customTargetStats,
        customToxinBypassesShields,
        enemyShieldGateHitMode,
        nearbyEnemyCount,
        nearbyBlastEnemyCount,
        enemyBaseLevel,
        enemyCurrentLevel,
        enemyScalingFaction,
        isEximus,
        bossBlastStackCap,
        isSteelPath,
        excluded,
        externalConditionalStacks,
        externalStatusTypeCount,
        meleeComboMultiplier,
        phantasmaChargeAmmo,
        meleeDpsInputs,
        warframeArmor,
        warframeMaxEnergy,
        warframeEnergyPercent,
        faction,
        factionOn,
        goal,
        maxFormaAllowed,
        optArcane,
        optExilus,
        onlyOwned,
        scaleCustomTargetByLevel,
        selectedAttackIdx,
        selectedEnemyProfileId,
        targetStatusImmunities,
        useCustomTargetStats,
        weapon,
    ]);

    useEffect(() => () => {
        optimizerCancelledRef.current = true;
        optimizerWorkerRef.current?.terminate();
        optimizerWorkerRef.current = null;
        pendingWorkerRejectRef.current?.(new Error("Build optimizer was closed."));
    }, []);

    useEffect(() => {
        setBuildCfg((prev) => {
            if (prev.masteryRank === masteryRank) return prev;
            return { ...prev, masteryRank };
        });
    }, [masteryRank]);

    useEffect(() => {
        const maxForWeapon = maxOptimizerFormaForWeapon(weapon);
        setMaxFormaAllowed((prev) => Math.min(Math.max(1, prev), maxForWeapon));
    }, [weapon]);

    function setIncarnonTierSelection(tier: IncarnonTier, optionId: string) {
        setBuildCfg((prev) => {
            const nextSelections = {
                ...prev.incarnonSelectedOptionsByTier,
                [tier]: optionId,
            };
            return {
                ...prev,
                incarnonUnlockedTier: getHighestSelectedIncarnonTier(nextSelections),
                incarnonSelectedOptionsByTier: nextSelections,
            };
        });
        setIncarnonPickerTier(null);
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    function clearIncarnonTierSelection(tier: IncarnonTier) {
        setBuildCfg((prev) => {
            const nextSelections = { ...prev.incarnonSelectedOptionsByTier };
            delete nextSelections[tier];
            return {
                ...prev,
                incarnonUnlockedTier: getHighestSelectedIncarnonTier(nextSelections),
                incarnonSelectedOptionsByTier: nextSelections,
                optimizeIncarnonSelections: getSelectedIncarnonTierCount(nextSelections) > 0 ? prev.optimizeIncarnonSelections : false,
            };
        });
        setIncarnonPickerTier(null);
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    function resetBuildForWeapon(w: WeaponEntry, opts?: { resetConfig?: boolean }) {
        setSlots(Array(SLOT_COUNT).fill(null));
        setRanks(Array(SLOT_COUNT).fill(0));
        const pols = Array(SLOT_COUNT).fill("") as string[];
        w.polarities.forEach((p, i) => { if (i < SLOT_COUNT) pols[i] = p; });
        setSlotPols(pols);
        const builtInStance = getStancesForWeapon(w).find((mod) => mod.isBuiltIn) ?? null;
        setStanceMod(builtInStance); setStanceRank(builtInStance ? builtInStance.fusionLimit : 0); setStancePol(w.stancePolarity ?? "");
        setExilusMod(null); setExilusRank(0); setExilusPol(""); setHasExilus(false);
        setArcane1(null); setArcane1Rank(0);
        setSelectedAttackIdx(0);
        setPhantasmaChargeAmmo(2);
        setMeleeDpsInputs({ averageComboDamageMultiplier: null, baseComboLengthSeconds: null });
        setIncarnonPickerTier(null);
        setShowMathWindow(false);
        if (opts?.resetConfig) {
            setBuildCfg(p => ({
                ...p,
                weaponRank: 30,
                hasCatalyst: false,
                valenceBonusPct: 0.25,
                valenceElement: "heat",
                optimizeValenceElement: false,
                incarnonUnlockedTier: 0,
                incarnonSelectedOptionsByTier: {},
                optimizeIncarnonSelections: false,
            }));
        }
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    function handleSelectWeapon(w: WeaponEntry) {
        setWeapon(w);
        resetBuildForWeapon(w, { resetConfig: true });
    }

    const compatMods   = useMemo(() => {
        if (!weapon) return [];
        const baseMods = getModsForWeapon(weapon);
        const customRivens = inventoryCustomRivens
            .filter((riven: CustomRivenRecord) => !riven.importStatus || riven.importStatus === "ready")
            .filter((riven: CustomRivenRecord) => customRivenSupportsWeapon(riven, weapon))
            .map((riven: CustomRivenRecord) => buildCustomRivenEntry(riven));
        return [...filterBuilderExpertVariants(baseMods), ...customRivens];
    }, [weapon, inventoryCustomRivens]);
    const stanceMods   = useMemo(() => {
        if (!weapon) return [];
        const mods = getStancesForWeapon(weapon);
        return filterBuilderExpertVariants(mods);
    }, [weapon]);
    const fixedStanceMod = useMemo(() => {
        if (!weapon) return null;
        return stanceMods.find((mod) => mod.isBuiltIn) ?? null;
    }, [weapon, stanceMods]);
    const weaponArcanes = useMemo(() => weapon ? getArcanesForWeapon(weapon) : [], [weapon]);
    const hasEnergyScaledArcanes = weaponArcanes.some((entry) => !!entry.energyScaledMultishot);
    const selectedArcaneEnergyEffect = arcane1?.energyScaledMultishot
        ? getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, false, arcaneEnergyContext)
        : null;
    const warframeEnergyArcanePanel = hasEnergyScaledArcanes ? (
        <div className="mt-2 space-y-1.5 rounded-lg border border-violet-900/50 bg-violet-950/15 p-2">
            <div className="text-[10px] font-semibold text-slate-300">Warframe Energy · Primary Overcharge</div>
            <div className="grid grid-cols-2 gap-2">
                <label className="block text-[9px] text-slate-400">
                    Max Energy
                    <input
                        id="warframe-max-energy-input"
                        aria-label="Warframe Maximum Energy for Primary Overcharge"
                        type="number"
                        min={0}
                        max={10000}
                        step={1}
                        value={warframeMaxEnergyInput}
                        onChange={(event) => setWarframeMaxEnergyInput(event.target.value)}
                        placeholder="Max energy"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                    />
                </label>
                <label className="block text-[9px] text-slate-400">
                    Current Energy (%)
                    <input
                        id="warframe-energy-percent-input"
                        aria-label="Current Warframe Energy percent for Primary Overcharge"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={warframeEnergyPercentInput}
                        onChange={(event) => setWarframeEnergyPercentInput(event.target.value)}
                        placeholder="0–100"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                    />
                </label>
            </div>
            <p className="text-[9px] leading-relaxed text-slate-500">At 90% current Energy, Primary Overcharge adds 35% of Max Energy as Multishot, up to its rank cap. This is a static scenario; energy use and regeneration during an encounter are not simulated. Both values are saved with this planner build.</p>
            {(arcane1?.energyScaledMultishot || optArcane) && (warframeMaxEnergy === undefined || warframeEnergyPercent === undefined) && (
                <p role="status" className="text-[9px] leading-relaxed text-amber-300">Energy-dependent Arcane bonuses are not calculated or considered by Auto Optimize until both values are entered.</p>
            )}
            {selectedArcaneEnergyEffect && (
                <p className="text-[9px] text-violet-300">Selected rank bonus: +{(((selectedArcaneEnergyEffect.multishotBonus ?? 0) * 100).toFixed(1))}% Multishot.</p>
            )}
        </div>
    ) : null;
    const incarnonRecord = useMemo(() => getIncarnonRecordForWeapon(weapon), [weapon]);
    const selectedIncarnonTierCount = useMemo(
        () => getSelectedIncarnonTierCount(buildCfg.incarnonSelectedOptionsByTier),
        [buildCfg.incarnonSelectedOptionsByTier],
    );
    const activeIncarnonTier = useMemo(
        () => incarnonPickerTier ? incarnonRecord?.tiers.find((tier) => tier.tier === incarnonPickerTier) ?? null : null,
        [incarnonPickerTier, incarnonRecord],
    );
    useEffect(() => {
        if (!activeIncarnonTier && !showMathWindow) return;

        const dialog = showMathWindow ? mathDialogRef.current : incarnonDialogRef.current;
        if (!dialog) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        dialog.focus();

        function onKeyDown(event: KeyboardEvent) {
            const activeModal = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
            if (activeModal !== dialog) return;

            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                if (showMathWindow) setShowMathWindow(false);
                else setIncarnonPickerTier(null);
                return;
            }
            if (event.key !== "Tab") return;

            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            } else if (!dialog.contains(document.activeElement)) {
                event.preventDefault();
                first?.focus();
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.documentElement.style.overflow = previousOverflow;
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [activeIncarnonTier, showMathWindow]);
    useEffect(() => {
        if (!incarnonPickerTier) return;
        if (!incarnonRecord?.tiers.some((tier) => tier.tier === incarnonPickerTier)) {
            setIncarnonPickerTier(null);
        }
    }, [incarnonPickerTier, incarnonRecord]);
    const trackableMods = useMemo(() => {
        const seen = new Set<string>();
        const out: ModEntry[] = [];
        for (const mod of [...compatMods, ...stanceMods]) {
            if (seen.has(mod.uniqueName)) continue;
            seen.add(mod.uniqueName);
            out.push(mod);
        }
        return out;
    }, [compatMods, stanceMods]);
    const ownedSet     = useMemo(() => new Set(
        trackableMods
            .filter(mod => mod.compatBucket === "Riven" || Number(inventoryCounts[`mods:${mod.path}`] ?? inventoryCounts[mod.path] ?? 0) > 0)
            .map(mod => mod.uniqueName)
    ), [trackableMods, inventoryCounts]);
    const ownedModMaxRankByUniqueName = useMemo(() => {
        const out: Record<string, number> = {};
        for (const mod of trackableMods) {
            if (mod.compatBucket === "Riven") {
                out[mod.uniqueName] = mod.fusionLimit;
                continue;
            }
            if (Number(inventoryCounts[`mods:${mod.path}`] ?? inventoryCounts[mod.path] ?? 0) <= 0) continue;
            out[mod.uniqueName] = getOwnedModRank(mod.path, mod.fusionLimit, inventoryCounts, inventoryModRanks);
        }
        return out;
    }, [trackableMods, inventoryCounts, inventoryModRanks]);
    const ownedArcaneUniqueNames = useMemo(() => {
        const set = new Set<string>();
        for (const arcane of weaponArcanes) {
            const totalByCounts = Number(inventoryCounts[`mods:${arcane.uniqueName}`] ?? inventoryCounts[arcane.uniqueName] ?? 0);
            if (hasOwnedArcane(inventoryArcaneRanks[arcane.uniqueName], totalByCounts)) {
                set.add(arcane.uniqueName);
            }
        }
        return set;
    }, [weaponArcanes, inventoryArcaneRanks, inventoryCounts]);
    const ownedArcaneMaxRankByUniqueName = useMemo(() => {
        const out: Record<string, number> = {};
        for (const arcane of weaponArcanes) {
            const rankCounts = inventoryArcaneRanks[arcane.uniqueName] ?? {};
            const fallbackCount = Number(inventoryCounts[`mods:${arcane.uniqueName}`] ?? inventoryCounts[arcane.uniqueName] ?? 0);
            const highestOwnedRank = getHighestOwnedArcaneRankWithFallback(rankCounts, fallbackCount);
            if (highestOwnedRank !== null) {
                out[arcane.uniqueName] = Math.min(arcane.maxRank, highestOwnedRank);
            }
        }
        return out;
    }, [weaponArcanes, inventoryArcaneRanks, inventoryCounts]);
    const usedGroups   = useMemo(() => {
        const s = new Set(slots.filter(Boolean).map(m => m!.incompatibilityGroup));
        if (stanceMod) s.add(stanceMod.incompatibilityGroup);
        if (exilusMod) s.add(exilusMod.incompatibilityGroup);
        return s;
    }, [slots, stanceMod, exilusMod]);
    const maxOptimizerForma = useMemo(() => maxOptimizerFormaForWeapon(weapon), [weapon]);
    const optimizerInputSignature = useMemo(() => JSON.stringify({
        weapon: weapon?.uniqueName,
        attack: selectedAttackIdx,
        goal,
        conditionalState,
        factionOn,
        faction,
        buildCfg,
        slots: slots.map((mod) => mod?.uniqueName ?? null),
        ranks,
        slotPols,
        stance: [stanceMod?.uniqueName, stanceRank, stancePol],
        exilus: [hasExilus, exilusMod?.uniqueName, exilusRank, exilusPol],
        arcane: [arcane1?.uniqueName, arcane1Rank, includeArcaneStats],
        warframeArmor,
        warframeMaxEnergy,
        warframeEnergyPercent,
        mode: optimizeMode,
        options: [allowNonMax, onlyOwned, allowCatalyst, allowForma, maxFormaAllowed, optExilus, optArcane],
        targetProfileOverride,
        owned: onlyOwned ? [...ownedSet].sort() : [],
        ownedRanks: onlyOwned ? ownedModMaxRankByUniqueName : {},
        ownedArcanes: onlyOwned ? [...ownedArcaneUniqueNames].sort() : [],
        ownedArcaneRanks: onlyOwned ? ownedArcaneMaxRankByUniqueName : {},
        excluded: [...excluded].sort(),
        candidates: compatMods.map((mod) => [mod.uniqueName, mod.effect]),
    }), [
        weapon, selectedAttackIdx, goal, conditionalState, factionOn, faction, targetProfileOverride, buildCfg,
        slots, ranks, slotPols, stanceMod, stanceRank, stancePol, hasExilus, exilusMod, exilusRank, exilusPol,
        arcane1, arcane1Rank, includeArcaneStats, optimizeMode, allowNonMax, onlyOwned, allowCatalyst,
        warframeArmor, warframeMaxEnergy, warframeEnergyPercent,
        allowForma, maxFormaAllowed, optExilus, optArcane, ownedSet, ownedModMaxRankByUniqueName,
        ownedArcaneUniqueNames, ownedArcaneMaxRankByUniqueName, excluded, compatMods,
    ]);
    const optimizerInputSignatureRef = useRef(optimizerInputSignature);
    useEffect(() => {
        if (
            optimizing &&
            !optimizerApplyingRef.current &&
            optimizerInputSignatureRef.current !== optimizerInputSignature
        ) cancelOptimization();
        optimizerInputSignatureRef.current = optimizerInputSignature;
    }, [optimizerInputSignature, optimizing, cancelOptimization]);

    // Forma count: count slots whose current polarity differs from weapon default
    const formaCount = useMemo(() => {
        if (!weapon) return 0;
        const defaultMainPolarities = [...weapon.polarities];
        while (defaultMainPolarities.length < SLOT_COUNT) defaultMainPolarities.push("");
        const includesStance = supportsStanceLikeMods(weapon);
        const includesExilus = hasExilus || !!exilusMod;
        const defaults = [
            ...defaultMainPolarities,
            ...(includesStance ? [weapon.stancePolarity ?? ""] : []),
            ...(includesExilus ? [""] : []),
        ];
        const current = [
            ...slotPols,
            ...(includesStance ? [stancePol] : []),
            ...(includesExilus ? [exilusPol] : []),
        ];
        return countPolarityChanges(defaults, current);
    }, [weapon, slotPols, stancePol, exilusPol, hasExilus, exilusMod]);

    const currentBuildExport = useMemo(() => buildExportPayload({
        weapon,
        selectedAttackIdx,
        meleeDpsInputs,
        goal,
        conditionalState,
        targetFaction: factionOn ? faction : null,
        targetProfileOverride,
        buildCfg,
        includeArcaneStats,
        slots,
        ranks,
        slotPols,
        stanceMod,
        stanceRank,
        stancePol,
        formaCount,
        exilusEnabled: hasExilus,
        exilusMod,
        exilusRank,
        exilusPol,
        arcane: arcane1,
        arcaneRank: arcane1Rank,
        warframeArmor,
        warframeMaxEnergy,
        warframeEnergyPercent,
        optimizeMode,
        respectCap,
        allowNonMax,
        onlyOwned,
        factionOn,
        allowCatalyst,
        allowForma,
        maxFormaAllowed,
        optExilus,
        optArcane,
        compatMods,
        weaponArcanes,
        ownedSet,
        ownedModMaxRankByUniqueName,
        ownedArcaneUniqueNames,
        ownedArcaneMaxRankByUniqueName,
        excluded,
    }), [
        weapon, selectedAttackIdx, goal, conditionalState, factionOn, faction, targetProfileOverride, meleeDpsInputs, buildCfg, includeArcaneStats, warframeArmor, warframeMaxEnergy, warframeEnergyPercent,
        slots, ranks, slotPols, stanceMod, stanceRank, stancePol, formaCount, hasExilus, exilusMod, exilusRank, exilusPol, arcane1, arcane1Rank,
        optimizeMode, respectCap, allowNonMax, onlyOwned, allowCatalyst, allowForma, maxFormaAllowed, optExilus, optArcane,
        compatMods, weaponArcanes, ownedSet, ownedModMaxRankByUniqueName, ownedArcaneUniqueNames, ownedArcaneMaxRankByUniqueName, excluded,
    ]);

    const activeWeaponState = useMemo(() => {
        if (!weapon) return null;
        return applyWeaponConfig(weapon, selectedAttackIdx, buildCfg);
    }, [weapon, selectedAttackIdx, buildCfg]);
    const activeCalcWeapon = activeWeaponState?.selectedWeapon ?? null;
    const phantasmaAltFireModelNote = activeCalcWeapon &&
        (activeCalcWeapon.name === "Phantasma" || activeCalcWeapon.name === "Phantasma Prime") &&
        /^(plasma bomb|cluster bombs)/i.test(activeCalcWeapon.selectedAttackName ?? "")
        ? "The selected row scales linearly from its Wiki baseline at 2 ammo using the chosen charge amount; the charge rate is fixed at 11 ammo/sec and is unaffected by fire-rate mods. Each row represents one part of the attack. Magazine-depletion charge-cost changes and the incremental-charge damage bug are not simulated, and the bomb plus five bomblets, projectile travel, and falloff are not combined. Treat these as single-row proxies."
        : "";
    const activeIncarnonUnsupportedLines = useMemo(
        () => activeWeaponState?.appliedIncarnonOptions.flatMap((option) =>
            option.model.unsupportedLines.map((line) => `${option.name}: ${line}`),
        ) ?? [],
        [activeWeaponState],
    );
    const displayedMath = (reasoningContextAtOptimization === currentReasoningContextKey ? reasoningMath : null) ?? currentBuildExport?.math ?? null;
    async function handleCopyBuildExport() {
        if (!currentBuildExport) return;
        const json = JSON.stringify(currentBuildExport, null, 2);
        await navigator.clipboard.writeText(json);
        setCopiedExport(true);
        setTimeout(() => setCopiedExport(false), 2000);
    }

    async function handleShareBuildImage() {
        if (!currentBuildExport || sharingBuildImage) return;
        setSharingBuildImage(true);
        try {
            const blob = await generateBuildShareImage(currentBuildExport);
            const safeWeapon = currentBuildExport.weapon.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
            const safeAttack = (currentBuildExport.weapon.selectedAttack ?? "build")
                .replace(/[^a-z0-9]+/gi, "-")
                .replace(/^-+|-+$/g, "")
                .toLowerCase();
            const fileName = `${safeWeapon || "weapon"}-${safeAttack || "build"}-build.png`;
            const file = new File([blob], fileName, { type: "image/png" });
            const nav = navigator as Navigator & {
                canShare?: (data?: ShareData) => boolean;
            };

            if (nav.share && nav.canShare?.({ files: [file] })) {
                await nav.share({
                    files: [file],
                });
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }

            setSharedBuildImage(true);
            setTimeout(() => setSharedBuildImage(false), 2200);
        } catch (error) {
            console.error(error);
        } finally {
            setSharingBuildImage(false);
        }
    }

    function handleSlotChange(i: number, mod: ModEntry | null) {
        setSlots(p => { const n = [...p]; n[i] = mod; return n; });
        setRanks(p => { const n = [...p]; n[i] = mod ? mod.fusionLimit : 0; return n; });
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }

    useEffect(() => {
        if (!weapon || !fixedStanceMod) return;
        if (stanceMod?.uniqueName === fixedStanceMod.uniqueName && stanceRank === fixedStanceMod.fusionLimit) return;
        setStanceMod(fixedStanceMod);
        setStanceRank(fixedStanceMod.fusionLimit);
    }, [weapon, fixedStanceMod, stanceMod, stanceRank]);
    function handleRankChange(i: number, r: number) {
        setRanks(p => { const n = [...p]; n[i] = r; return n; });
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }
    function handlePolChange(i: number, p: string)  {
        setSlotPols(p2 => { const n = [...p2]; n[i] = p; return n; });
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }
    function handleExilusChange(_: number, m: ModEntry | null) {
        setExilusMod(m); setExilusRank(m ? m.fusionLimit : 0);
        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
    }
    function getSlotMod(ref: DragSlotRef | null): ModEntry | null {
        if (!ref) return null;
        return ref.kind === "main" ? slots[ref.index] : exilusMod;
    }
    function getSlotRank(ref: DragSlotRef | null): number {
        if (!ref) return 0;
        return ref.kind === "main" ? (ranks[ref.index] ?? 0) : exilusRank;
    }
    function canPlaceModInSlot(mod: ModEntry | null, kind: DragSlotKind): boolean {
        if (!mod) return true;
        return kind === "main" ? true : !!mod.isExilus;
    }
    function canSwapSlots(source: DragSlotRef | null, target: DragSlotRef | null): boolean {
        if (!source || !target) return false;
        if (source.kind === target.kind && source.index === target.index) return false;
        const sourceMod = getSlotMod(source);
        if (!sourceMod) return false;
        const targetMod = getSlotMod(target);
        return canPlaceModInSlot(sourceMod, target.kind) && canPlaceModInSlot(targetMod, source.kind);
    }
    function handleDropSwap(target: DragSlotRef) {
        if (!draggedSlot || !canSwapSlots(draggedSlot, target)) {
            setDragOverSlot(null);
            setDraggedSlot(null);
            return;
        }

        const source = draggedSlot;
        const sourceMod = getSlotMod(source);
        const targetMod = getSlotMod(target);
        const sourceRank = getSlotRank(source);
        const targetRank = getSlotRank(target);

        if (source.kind === "main" && target.kind === "main") {
            setSlots((prev) => {
                const next = [...prev];
                next[source.index] = targetMod;
                next[target.index] = sourceMod;
                return next;
            });
            setRanks((prev) => {
                const next = [...prev];
                next[source.index] = targetMod ? targetRank : 0;
                next[target.index] = sourceMod ? sourceRank : 0;
                return next;
            });
        } else if (source.kind === "main" && target.kind === "exilus") {
            setSlots((prev) => {
                const next = [...prev];
                next[source.index] = targetMod;
                return next;
            });
            setRanks((prev) => {
                const next = [...prev];
                next[source.index] = targetMod ? targetRank : 0;
                return next;
            });
            setExilusMod(sourceMod);
            setExilusRank(sourceMod ? sourceRank : 0);
        } else if (source.kind === "exilus" && target.kind === "main") {
            setSlots((prev) => {
                const next = [...prev];
                next[target.index] = sourceMod;
                return next;
            });
            setRanks((prev) => {
                const next = [...prev];
                next[target.index] = sourceMod ? sourceRank : 0;
                return next;
            });
            setExilusMod(targetMod);
            setExilusRank(targetMod ? targetRank : 0);
        } else {
            setExilusMod(targetMod);
            setExilusRank(targetMod ? targetRank : 0);
        }

        setReasoning(null);
        setReasoningMath(null);
        setShowMathWindow(false);
        setDragOverSlot(null);
        setDraggedSlot(null);
    }
    function toggleExclude(uniqueName: string) {
        setExcluded(previous => {
            const next = new Set(previous);
            if (next.has(uniqueName)) next.delete(uniqueName);
            else next.add(uniqueName);
            return next;
        });
    }

    const capacityCfg: CapacityConfig = {
        weaponRank: buildCfg.weaponRank, hasCatalyst: buildCfg.hasCatalyst,
        masteryRank: buildCfg.masteryRank, canOverLevel: weapon?.canOverLevel ?? false,
    };

    const allSlotsForCap = useMemo(() => {
        const s = [...slots];
        if (weapon && supportsStanceLikeMods(weapon) && stanceMod) s.unshift(stanceMod);
        if (hasExilus) s.push(exilusMod);
        return s;
    }, [slots, stanceMod, exilusMod, hasExilus, weapon]);
    const allPolsForCap  = useMemo(() => {
        const p = [...slotPols];
        if (weapon && supportsStanceLikeMods(weapon) && stanceMod) p.unshift(stancePol);
        if (hasExilus) p.push(exilusPol);
        return p;
    }, [slotPols, stancePol, exilusPol, hasExilus, weapon, stanceMod]);
    const allRanksForCap = useMemo(() => {
        const r = [...ranks];
        if (weapon && supportsStanceLikeMods(weapon) && stanceMod) r.unshift(stanceRank);
        if (hasExilus) r.push(exilusRank);
        return r;
    }, [ranks, stanceMod, stanceRank, exilusRank, hasExilus, weapon]);
    const activeBuildEffects = useMemo(() => {
        const effects: (ModEffect | null)[] = [
            ...(activeWeaponState?.activeIncarnonEffects ?? []),
            ...allSlotsForCap.map((mod, i) => {
            if (!mod) return null;
            const r = allRanksForCap[i] ?? mod.fusionLimit;
            return mod.effectsByRank[r] ?? mod.effect;
            }),
        ];
        if (includeArcaneStats && arcane1) {
            const ae = getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, true, arcaneEnergyContext);
            if (ae) effects.push({
                ...emptyEffect(),
                ...ae,
                conditionalEffects: [...(ae.conditionalEffects ?? [])],
            });
        }
        return effects;
    }, [activeWeaponState, allSlotsForCap, allRanksForCap, includeArcaneStats, arcane1, arcane1Rank, warframeArmor, arcaneEnergyContext]);
    const activeBuildEffectSourceLabels = useMemo(() => {
        const labels = [
            ...(activeWeaponState?.activeIncarnonEffects ?? []).map((_, index) => `selected Incarnon evolution ${index + 1}`),
            ...allSlotsForCap.map((mod, i) => {
                if (!mod) return `slot ${i + 1}`;
                if (i < SLOT_COUNT) return `${getBuilderDisplayModName(mod)} (slot ${i + 1})`;
                return `${getBuilderDisplayModName(mod)} (exilus)`;
            }),
        ];
        if (includeArcaneStats && arcane1) labels.push(`${arcane1.name} (arcane)`);
        return labels;
    }, [activeWeaponState, allSlotsForCap, includeArcaneStats, arcane1]);
    const activeTargetAssumptions = useMemo(
        () => getTargetProfileAssumptions(factionOn ? faction : "", targetProfileOverride),
        [factionOn, faction, targetProfileOverride],
    );
    const activeMetrics = useMemo(
        () => activeCalcWeapon ? calculateBuild(activeCalcWeapon, activeBuildEffects, factionOn ? faction : "", {
            conditionalState,
            statusImmuneTypes: activeTargetAssumptions.statusImmuneTypes,
            statusStackCaps: activeTargetAssumptions.statusStackCaps,
        }) : null,
        [activeCalcWeapon, activeBuildEffects, factionOn, faction, conditionalState, activeTargetAssumptions],
    );
    const phantasmaBeamDamageRampNote = activeCalcWeapon?.selectedAttackDamageRamp && activeMetrics
        ? `Damage ramps from ${fmt(activeCalcWeapon.selectedAttackDamageRamp.minimumDamageMultiplier * 100, 0)}% to 100% over ${fmt(activeCalcWeapon.selectedAttackDamageRamp.rampToFullSeconds, 2)}s. It starts decaying after ${fmt(activeCalcWeapon.selectedAttackDamageRamp.idleBeforeDecaySeconds, 2)}s idle and reaches the minimum over ${fmt(activeCalcWeapon.selectedAttackDamageRamp.decayToMinimumSeconds, 2)}s. Burst DPS averages the fresh magazine at ${fmt(activeMetrics.modded.freshMagazineDamageMultiplier * 100, 1)}%; sustained DPS uses the repeating-magazine level at ${fmt(activeMetrics.modded.sustainedDamageMultiplier * 100, 1)}%. The initial one-hit target estimate uses the minimum; sequence and finite-encounter estimates advance it per attack. The encounter applies the ramp to per-attack DoT/Blast seeds as an assumption; the Wiki does not specify seed inheritance separately.`
        : "";
    const initialTargetMetrics = useMemo(
        () => activeCalcWeapon ? calculateBuild(activeCalcWeapon, activeBuildEffects, factionOn ? faction : "", {
            conditionalState: { mode: "initial" },
            statusImmuneTypes: activeTargetAssumptions.statusImmuneTypes,
            statusStackCaps: activeTargetAssumptions.statusStackCaps,
            targetStatusState: "initial",
        }) : null,
        [activeCalcWeapon, activeBuildEffects, factionOn, faction, activeTargetAssumptions],
    );
    const meleeAverageDps = useMemo(() => {
        if (
            !weapon || !usesMeleeDamageModel(weapon.category) || !initialTargetMetrics ||
            meleeDpsInputs.averageComboDamageMultiplier == null || meleeDpsInputs.baseComboLengthSeconds == null
        ) return null;
        return calculateMeleeAverageDps(initialTargetMetrics.modded, {
            averageComboDamageMultiplier: meleeDpsInputs.averageComboDamageMultiplier,
            baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
        });
    }, [weapon, initialTargetMetrics, meleeDpsInputs]);
    const encounterTargetMetrics = useMemo(
        () => activeCalcWeapon ? calculateBuild(activeCalcWeapon, activeBuildEffects, factionOn ? faction : "", {
            conditionalState,
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            targetStatusState: "initial",
        }) : null,
        [activeCalcWeapon, activeBuildEffects, factionOn, faction, conditionalState, targetStatusImmunities, targetProfileOverride],
    );
    const activeProcMixLabel = activeMetrics
        ? Object.entries(activeMetrics.modded.procChanceByType)
            .filter(([, chance]) => (chance ?? 0) > 0)
            .map(([type, chance]) => `${type[0].toUpperCase()}${type.slice(1)} ${fmt((chance ?? 0) * 100, 1)}%`)
            .join(" · ") || "No eligible status procs"
        : "—";
    const selectedEnemyProfile = useMemo(
        () => getEnemyProfile(selectedEnemyProfileId),
        [selectedEnemyProfileId],
    );
    const activeTargetAttackInput = useMemo<DirectTargetDamageInput | null>(() => {
        if (!activeMetrics) return null;
        const stats = activeMetrics.modded;
        const factionDamageBonus = factionOn
            ? activeBuildEffects.reduce((sum, effect) =>
                sum + (effect?.targetFaction?.toLowerCase() === faction.toLowerCase()
                    ? effect.factionDamageBonus ?? 0
                    : 0), 0)
            : 0;
        const combinedArmorStrip = 1 - ((1 - stats.heatArmorStrip) * (1 - stats.corrosiveArmorStrip));
        return {
            damageByType: stats.damageBreakdownBeforePerStatus,
            health: activeTargetAssumptions.health,
            shields: activeTargetAssumptions.shields,
            overguard: activeTargetAssumptions.overguard,
            armor: activeTargetAssumptions.armor * Math.max(0, 1 - combinedArmorStrip),
            faction: factionOn ? faction : "",
            factionDamageBonus,
            viralHealthDamageBonus: stats.viralHealthDamageBonus,
            magneticDefenseDamageBonus: stats.magneticShieldDamageBonus,
            toxinBypassesShields: activeTargetAssumptions.toxinBypassesShields,
            damageRampRule: activeCalcWeapon?.selectedAttackDamageRamp,
            expectedCritMultiplier: avgCritMultiplier(
                stats.critChance + stats.punctureCritChanceBonus,
                stats.critMultiplier + stats.coldCritDamageBonus,
            ),
            expectedProjectiles: stats.multishot,
            expectedDamageMultiplier: stats.damageWeightedMultishot,
        };
    }, [activeMetrics, activeBuildEffects, activeTargetAssumptions, activeCalcWeapon, factionOn, faction]);
    const activeTargetAttackDamage = useMemo(() => {
        if (!activeTargetAttackInput || !activeMetrics) return null;
        const stats = activeMetrics.modded;
        return calculateDirectDamageToInitialPools({
            ...activeTargetAttackInput,
            damageRampMultiplier: stats.firstAttackDamageMultiplier * stats.firstShotMagazineDamageMultiplier,
        });
    }, [activeTargetAttackInput, activeMetrics]);
    const activeTargetAttackSequence = useMemo(() => {
        if (!activeTargetAttackInput || !activeMetrics) return null;
        const stats = activeMetrics.modded;
        return simulateDirectAttackSequence({
            ...activeTargetAttackInput,
            enemyShieldGateHitMode: targetProfileOverride?.enemyShieldGateHitMode,
            attackIntervalSeconds: 1 / Math.max(0.0001, stats.fireRate),
            shotsPerMagazine: stats.shotsPerMag,
            infiniteAmmoActive: stats.infiniteAmmoActive,
            firstShotMagazineDamageBonus: stats.firstShotMagazineDamageBonus,
            reloadDurationSeconds: activeCalcWeapon?.weaponType.trim().toLowerCase() === "bow" ? 0 : stats.reloadTime,
            critChance: stats.critChance + stats.punctureCritChanceBonus,
            critMultiplier: stats.critMultiplier + stats.coldCritDamageBonus,
            ...(activeCalcWeapon?.selectedAttackUsesMeleeComboMultiplier && activeCalcWeapon
                ? {
                    heavyAttackCombo: {
                        startingPoints: stats.meleeComboPointsBeforeHeavyAttack,
                        startingMultiplier: stats.meleeComboMultiplier,
                        pointsPerTier: getMeleeComboRules(activeCalcWeapon).pointsPerTier,
                        maxMultiplier: getMeleeComboRules(activeCalcWeapon).maxMultiplier,
                        heavyAttackEfficiency: stats.heavyAttackEfficiency,
                        initialComboPoints: stats.meleeInitialComboPoints,
                        startingCritChance: stats.critChance + stats.punctureCritChanceBonus,
                        critChancePerTier: stats.comboCritChancePerTier,
                        critDamageMultiplier: stats.critMultiplier + stats.coldCritDamageBonus,
                    },
                }
                : {}),
            ...effectiveBurstTiming(activeCalcWeapon, stats.fireRate),
        });
    }, [activeTargetAttackInput, activeMetrics, activeCalcWeapon, targetProfileOverride]);
    const activeTargetEncounter = useMemo(() => {
        if (!encounterTargetMetrics) return null;
        const stats = encounterTargetMetrics.modded;
        const factionDamageBonus = factionOn
            ? activeBuildEffects.reduce((sum, effect) =>
                sum + (effect?.targetFaction?.toLowerCase() === faction.toLowerCase()
                    ? effect.factionDamageBonus ?? 0
                    : 0), 0)
            : 0;
        return simulateExpectedWeaponEncounter({
            damageByType: stats.damageBreakdownBeforePerStatus,
            rawDamageByType: stats.rawDamageBreakdownBeforePerStatus,
            baseDamageTotal: stats.baseDamageTotal,
            health: activeTargetAssumptions.health,
            shields: activeTargetAssumptions.shields,
            overguard: activeTargetAssumptions.overguard,
            maxShields: activeTargetAssumptions.shields,
            maxOverguard: activeTargetAssumptions.overguard,
            armor: activeTargetAssumptions.armor,
            faction: factionOn ? faction : "",
            factionDamageBonus,
            toxinBypassesShields: activeTargetAssumptions.toxinBypassesShields,
            enemyShieldGateHitMode: targetProfileOverride?.enemyShieldGateHitMode,
            damageRampRule: activeCalcWeapon?.selectedAttackDamageRamp,
            critChance: stats.critChance,
            critMultiplier: stats.critMultiplier,
            expectedProjectiles: stats.multishot,
            expectedDamageMultiplier: stats.damageWeightedMultishot,
            attackIntervalSeconds: 1 / Math.max(0.0001, stats.fireRate),
            shotsPerMagazine: stats.shotsPerMag,
            infiniteAmmoActive: stats.infiniteAmmoActive,
            firstShotMagazineDamageBonus: stats.firstShotMagazineDamageBonus,
            reloadDurationSeconds: activeCalcWeapon?.weaponType.trim().toLowerCase() === "bow" ? 0 : stats.reloadTime,
            ...effectiveBurstTiming(activeCalcWeapon, stats.fireRate),
            statusDurationMultiplier: stats.statusDurationMultiplier,
            dotDamagePerAttackByType: stats.dotDamagePerShotByType,
            dotDamagePerApplicationByType: Object.fromEntries(
                Object.entries(stats.dotDamagePerShotByType).flatMap(([rawType, damagePerAttack]) => {
                    const type = rawType as StatusDamageType;
                    const applications = stats.averageProcsPerShot * (stats.procChanceByType[type] ?? 0);
                    return applications > 0 ? [[type, damagePerAttack / applications]] : [];
                }),
            ) as Partial<Record<StatusDamageType, number>>,
            heatDotTickDamagePerProc: stats.dotTickDamagePerProcBeforeConditionOverloadByType.heat,
            heatDotAccumulatorDamagePerTick: stats.dotTickAccumulatorDamageByType.heat,
            dotSeedDamagePerApplicationByType: stats.dotDamagePerApplicationSeedByType,
            dotAccumulatorDamagePerApplicationByType: stats.dotDamagePerApplicationAccumulatorByType,
            statusProcWeightsByType: stats.damageBreakdownBeforePerStatus,
            statusRollsPerAttack: stats.multishot * stats.statusChance,
            forcedStatusApplicationsPerAttackByType: stats.unfilteredExtraProcsPerShot as Partial<Record<StatusDamageType, number>>,
            statusImmuneTypes: targetStatusImmunities,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            blastStackHitDamagePerProc: stats.blastStackHitDamagePerProcBeforeConditionOverload,
            nearbyBlastEnemyCount: targetProfileOverride?.nearbyBlastEnemyCount,
            nearbyElectricGasEnemyCount: targetProfileOverride?.nearbyEnemyCount,
            magneticBreakElectricSourceMultiplier: stats.magneticBreakElectricSourceMultiplier,
            directDamagePerStatusBonus: stats.directDamagePerStatusBonus,
            conditionOverloadDamagePerStatusBonus: stats.conditionOverloadApplies
                ? stats.conditionOverloadDamagePerStatusBonus
                : 0,
            externalConditionOverloadStatusTypeCount: externalStatusTypeCount,
            uniqueStatusProcsPerAttack: activeCalcWeapon?.uniqueStatusProcs,
            intrinsicDamagePerStatusBonus: stats.intrinsicDamagePerStatusBonus,
            intrinsicDamagePerStatusMode: stats.intrinsicDamagePerStatusMode,
            totalDamageBonus: stats.totalDamageBonus,
        });
    }, [encounterTargetMetrics, activeCalcWeapon, factionOn, activeBuildEffects, faction, activeTargetAssumptions, targetStatusImmunities, targetProfileOverride, externalStatusTypeCount]);
    const activeEncounterStatusSummary = activeTargetEncounter
        ? Object.entries(activeTargetEncounter.statusApplicationsByType)
            .filter(([, count]) => (count ?? 0) >= 0.01)
            .map(([type, count]) => `${type[0].toUpperCase()}${type.slice(1)} ${fmt(count ?? 0, 1)}`)
            .join(" · ") || "None"
        : "—";
    const activeTargetSummary = selectedEnemyProfile
        ? `${selectedEnemyProfile.name} · level ${getSteelPathEnemyLevel(enemyCurrentLevel, isSteelPath)}${isSteelPath ? " Steel Path" : ""}${nearbyEnemyCount > 0 ? ` · +${nearbyEnemyCount} Electric/Gas` : ""}${nearbyBlastEnemyCount > 0 ? ` · +${nearbyBlastEnemyCount} Blast` : ""}`
        : targetProfileOverride
        ? `${scaleCustomTargetByLevel ? `Custom target · level ${getSteelPathEnemyLevel(enemyCurrentLevel, isSteelPath)}${isSteelPath ? " Steel Path" : ""}` : "Custom current-level target pools"}${factionOn ? ` · ${faction} damage modifiers` : ""}${nearbyEnemyCount > 0 ? ` · +${nearbyEnemyCount} Electric/Gas` : ""}${nearbyBlastEnemyCount > 0 ? ` · +${nearbyBlastEnemyCount} Blast` : ""}`
        : factionOn
            ? `${faction} synthetic faction estimate`
            : "Balanced synthetic target estimate";
    const activeDamageTypeSources = useMemo(
        () => activeCalcWeapon ? buildDamageTypeSourceDescriptions(activeCalcWeapon, activeBuildEffects, activeBuildEffectSourceLabels) : {},
        [activeCalcWeapon, activeBuildEffects, activeBuildEffectSourceLabels],
    );

    const capacity = useMemo(() => {
        if (!weapon) return null;
        return computeCapacity(capacityCfg, allPolsForCap.map(p => ({ polarity: p })), allSlotsForCap, allRanksForCap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weapon, allSlotsForCap, allPolsForCap, allRanksForCap, buildCfg]);
    const displayedCapacity = useMemo(() => {
        if (!capacity) return null;
        const total = capacity.totalCapacity + capacity.auraGrant;
        const remaining = capacity.remainingCapacity;
        const used = total - remaining;
        return { total, used, remaining, over: capacity.overCapacity };
    }, [capacity]);

    async function handleOptimize() {
        if (!weapon) return;
        if (onlyOwned && ownedSet.size === 0) return;
        if (useCustomTargetStats && customTargetStats.health + customTargetStats.shields + customTargetStats.overguard <= 0) {
            setOptimizerNotice("Enter a positive Health, Shields, or Overguard value for the custom target.");
            return;
        }
        optimizerCancelledRef.current = false;
        optimizerApplyingRef.current = false;
        optimizerInputSignatureRef.current = optimizerInputSignature;
        setOptimizerNotice(null);
        setOptimizerProgress("Preparing optimizer…");
        setOptimizing(true);
        await new Promise(r => setTimeout(r, 10));
        try {
            if (optimizerCancelledRef.current) return;
            const worker = new Worker(new URL("../../workers/buildOptimizer.worker.ts", import.meta.url), { type: "module" });
            optimizerWorkerRef.current = worker;
            const optimizeInWorker = (
                candidateWeapon: WeaponEntry,
                candidateMods: ModEntry[],
                candidateGoal: OptimizeGoal,
                slotCount: number,
                options: Parameters<typeof optimizeBuild>[4],
            ) => new Promise<ReturnType<typeof optimizeBuild>>((resolve, reject) => {
                const id = ++optimizerRequestIdRef.current;
                pendingWorkerRejectRef.current = reject;
                worker.onmessage = (event: MessageEvent<{ id: number; result?: ReturnType<typeof optimizeBuild>; error?: string }>) => {
                    if (event.data.id !== id) return;
                    pendingWorkerRejectRef.current = null;
                    if (event.data.error) reject(new Error(event.data.error));
                    else if (event.data.result) resolve(event.data.result);
                    else reject(new Error("The optimizer worker returned no result."));
                };
                worker.onerror = (event) => {
                    pendingWorkerRejectRef.current = null;
                    reject(new Error(event.message || "The optimizer worker failed."));
                };
                worker.postMessage({
                    id,
                    weapon: candidateWeapon,
                    availableMods: candidateMods,
                    goal: candidateGoal,
                    slotCount,
                    options,
                });
            });
            const fillMode = optimizeMode === "fill";
            const optimizeArcaneForRun = optArcane && (!fillMode || !arcane1);
            const lockedMainSlots = fillMode ? [...slots] : Array(SLOT_COUNT).fill(null);
            const lockedMainRanks = fillMode ? [...ranks] : Array(SLOT_COUNT).fill(undefined);
            const lockedSlotMask = fillMode ? slots.map((mod) => !!mod) : Array(SLOT_COUNT).fill(false);
            const lockedExternalEffects: ModEffect[] = [];
            let lockedArcaneEffect: ModEffect | null = null;
            if (fillMode && hasExilus && exilusMod) {
                lockedExternalEffects.push(exilusMod.effectsByRank[exilusRank] ?? exilusMod.effect);
            }
            if (includeArcaneStats && arcane1 && !optimizeArcaneForRun) {
                const resolved = getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, true, arcaneEnergyContext);
                if (resolved) {
                    lockedArcaneEffect = {
                        ...emptyEffect(),
                        ...resolved,
                        conditionalEffects: [...(resolved.conditionalEffects ?? [])],
                    };
                    lockedExternalEffects.push(lockedArcaneEffect);
                }
            }
            const lockedIncompatibilityGroups = fillMode
                ? new Set(slots.filter((mod): mod is ModEntry => !!mod).map((mod) => mod.incompatibilityGroup))
                : undefined;
            const lockedUniqueNames = fillMode
                ? new Set(slots.filter((mod): mod is ModEntry => !!mod).map((mod) => mod.uniqueName))
                : undefined;
            const availableFormaBudget = allowForma
                ? Math.max(0, maxFormaAllowed - formaCount)
                : maxFormaAllowed;
            let optimizerStanceMod = stanceMod;
            let optimizerStanceRank = stanceRank;
            if (supportsStanceLikeMods(weapon)) {
                if (!fillMode || !stanceMod) {
                    const candidateStances = onlyOwned
                        ? stanceMods.filter(mod => ownedSet.has(mod.uniqueName))
                        : stanceMods;
                    const bestStance = candidateStances.reduce<ModEntry | null>((best, current) => {
                        if (!stancePol) return best;
                        if (!best) return current;
                        const bestDrain = effectiveDrain(best, stancePol, best.fusionLimit);
                        const currentDrain = effectiveDrain(current, stancePol, current.fusionLimit);
                        return currentDrain < bestDrain ? current : best;
                    }, null);
                    optimizerStanceMod = bestStance;
                    optimizerStanceRank = bestStance
                        ? Math.min(bestStance.fusionLimit, ownedModMaxRankByUniqueName[bestStance.uniqueName] ?? bestStance.fusionLimit)
                        : 0;
                }
            }

            const scoreOptimizerResult = (
                candidateWeapon: WeaponEntry,
                candidateAttackIdx: number,
                candidateResult: ReturnType<typeof optimizeBuild>,
                preEquippedEffects: ModEffect[],
                useFiniteEncounterResult = true,
            ) => {
                return scoreOptimizerResultForConfiguration({
                    weapon: candidateWeapon,
                    result: candidateResult,
                    goal,
                    targetFaction: factionOn ? faction : "",
                    selectedAttackIdx: candidateAttackIdx,
                    targetProfileOverride,
                    conditionalState,
                    preEquippedEffects,
                    includeExilus: optExilus,
                    warframeArmor,
                    warframeMaxEnergy,
                    warframeEnergyPercent,
                    useFiniteEncounterResult,
                });
            };

            const runOptimizeForConfig = async (
                valenceElement: ValenceElement,
                incarnonCandidate: IncarnonCandidateConfig,
            ) => {
                const candidateCfg: BuildCfg = {
                    ...buildCfg,
                    valenceElement,
                    incarnonUnlockedTier: incarnonCandidate.unlockedTier,
                    incarnonSelectedOptionsByTier: incarnonCandidate.selectedOptionsByTier,
                };
                const weaponState = applyWeaponConfig(weapon, selectedAttackIdx, candidateCfg);
                const weaponForOpt = weaponState.weaponWithIntrinsicOptions;
                const atk = weaponForOpt.attacks.length > 1 ? weaponForOpt.attacks[selectedAttackIdx] : null;

                // If allowCatalyst, override capacityCfg to hasCatalyst:true
                const capForOpt = capacityCfg;

                const result = await optimizeInWorker(weaponForOpt, compatMods, goal, SLOT_COUNT, {
                    ownedModUniqueNames:    onlyOwned ? ownedSet : undefined,
                    ownedModMaxRankByUniqueName: onlyOwned ? ownedModMaxRankByUniqueName : undefined,
                    ownedArcaneUniqueNames: onlyOwned ? ownedArcaneUniqueNames : undefined,
                    ownedArcaneMaxRankByUniqueName: onlyOwned ? ownedArcaneMaxRankByUniqueName : undefined,
                    excludedModUniqueNames: excluded.size > 0 ? excluded : undefined,
                    allowNonMaxRank:  allowNonMax,
                    targetFaction:    factionOn ? faction : "",
                    targetProfileOverride,
                    capacityConfig:   capForOpt,
                    slotPolarities:   slotPols,
                    defaultSlotPolarities: slotPols,
                    allowCatalyst,
                    allowForma,
                    maxFormaCount: allowForma ? availableFormaBudget : undefined,
                    optimizeExilus:   fillMode ? (optExilus && hasExilus && !exilusMod ? true : optExilus && !hasExilus) : optExilus,
                    exilusPolarity:   exilusPol,
                    optimizeArcane:   optimizeArcaneForRun,
                    arcaneCandidates: optimizeArcaneForRun ? getArcanesForWeapon(weaponForOpt) : [],
                    warframeArmor,
                    warframeMaxEnergy,
                    warframeEnergyPercent,
                    buildForAttack:   atk,
                    conditionalState,
                    extraCapacitySlots: supportsStanceLikeMods(weapon) && optimizerStanceMod
                        ? [{ mod: optimizerStanceMod, rank: optimizerStanceRank, polarity: stancePol }]
                        : undefined,
                    preEquippedEffects: [...weaponState.activeIncarnonEffects, ...lockedExternalEffects],
                    lockedSlots: fillMode ? lockedMainSlots : undefined,
                    lockedSlotRanks: fillMode ? lockedMainRanks : undefined,
                    lockedSlotMask: fillMode ? lockedSlotMask : undefined,
                    lockedIncompatibilityGroups,
                    lockedUniqueNames,
                });

                const appliedResult = result;
                const appliedCatalyst = buildCfg.hasCatalyst || result.needsCatalyst;
                const baseExtraCapacitySlots = supportsStanceLikeMods(weapon) && optimizerStanceMod
                    ? [{ mod: optimizerStanceMod, rank: optimizerStanceRank, polarity: stancePol }]
                    : undefined;

                return {
                    weaponForOpt,
                    atk,
                    appliedResult,
                    appliedCatalyst,
                    baseExtraCapacitySlots,
                    score: scoreOptimizerResult(weaponForOpt, selectedAttackIdx, appliedResult, [
                        ...weaponState.activeIncarnonEffects,
                        ...lockedExternalEffects,
                    ]),
                    valenceElement,
                    incarnonSelectedOptionsByTier: incarnonCandidate.selectedOptionsByTier,
                };
            };

            const valenceElementsToTry = weapon.isProgenitorWeapon && buildCfg.valenceBonusPct > 0 && buildCfg.optimizeValenceElement && buildCfg.weaponRank >= 40
                ? VALENCE_ELEMENTS.map((entry) => entry.key)
                : [buildCfg.valenceElement];
            const incarnonCandidates = buildIncarnonCandidateConfigs(
                incarnonRecord,
                buildCfg.incarnonSelectedOptionsByTier,
                buildCfg.optimizeIncarnonSelections,
            );
            const currentIncarnonCandidate: IncarnonCandidateConfig = {
                unlockedTier: getHighestSelectedIncarnonTier(buildCfg.incarnonSelectedOptionsByTier),
                selectedOptionsByTier: { ...buildCfg.incarnonSelectedOptionsByTier },
            };
            const configSignature = (valenceElement: ValenceElement, candidate: IncarnonCandidateConfig) =>
                `${valenceElement}|${Object.entries(candidate.selectedOptionsByTier)
                    .sort(([left], [right]) => Number(left) - Number(right))
                    .map(([tier, option]) => `${tier}:${option}`)
                    .join("|")}`;
            const baselineRuns: Array<Awaited<ReturnType<typeof runOptimizeForConfig>>> = [];
            let evaluatedConfigs = 0;
            for (const candidateElement of valenceElementsToTry) {
                if (optimizerCancelledRef.current) return;
                setOptimizerProgress(`Evaluating baseline configuration ${evaluatedConfigs + 1} of ${valenceElementsToTry.length}…`);
                baselineRuns.push(await runOptimizeForConfig(candidateElement, currentIncarnonCandidate));
                evaluatedConfigs += 1;
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            let bestRun = baselineRuns.reduce<Awaited<ReturnType<typeof runOptimizeForConfig>> | null>(
                (best, run) => !best || run.score > best.score ? run : best,
                null,
            );
            if (!bestRun) {
                setOptimizerNotice("No legal build fits the current capacity and locked-slot settings.");
                setOptimizerProgress(null);
                return;
            }

            if (buildCfg.optimizeIncarnonSelections && incarnonCandidates.length > 0) {
                setOptimizerProgress(`Screening ${incarnonCandidates.length * baselineRuns.length} Incarnon paths against the baseline builds…`);
                await new Promise((resolve) => setTimeout(resolve, 0));
                const screenedCandidates: Array<{
                    signature: string;
                    valenceElement: ValenceElement;
                    incarnonCandidate: IncarnonCandidateConfig;
                    score: number;
                }> = [];

                for (const baselineRun of baselineRuns) {
                    for (const incarnonCandidate of incarnonCandidates) {
                        if (optimizerCancelledRef.current) return;
                        if (configSignature(baselineRun.valenceElement, incarnonCandidate) === configSignature(
                            baselineRun.valenceElement,
                            { unlockedTier: getHighestSelectedIncarnonTier(baselineRun.incarnonSelectedOptionsByTier), selectedOptionsByTier: baselineRun.incarnonSelectedOptionsByTier },
                        )) continue;

                        const candidateCfg: BuildCfg = {
                            ...buildCfg,
                            valenceElement: baselineRun.valenceElement,
                            incarnonUnlockedTier: incarnonCandidate.unlockedTier,
                            incarnonSelectedOptionsByTier: incarnonCandidate.selectedOptionsByTier,
                        };
                        const candidateWeaponState = applyWeaponConfig(weapon, selectedAttackIdx, candidateCfg);
                        screenedCandidates.push({
                            signature: configSignature(baselineRun.valenceElement, incarnonCandidate),
                            valenceElement: baselineRun.valenceElement,
                            incarnonCandidate,
                            score: scoreOptimizerResult(
                                candidateWeaponState.weaponWithIntrinsicOptions,
                                selectedAttackIdx,
                                baselineRun.appliedResult,
                                [...candidateWeaponState.activeIncarnonEffects, ...lockedExternalEffects],
                                false,
                            ),
                        });
                    }
                }

                const baselineSignatures = baselineRuns.map((run) => configSignature(
                    run.valenceElement,
                    {
                        unlockedTier: getHighestSelectedIncarnonTier(run.incarnonSelectedOptionsByTier),
                        selectedOptionsByTier: run.incarnonSelectedOptionsByTier,
                    },
                ));
                const selectedForRefinement = selectIncarnonSearchShortlist(
                    screenedCandidates,
                    baselineSignatures,
                    INCARNON_PATH_REFINEMENT_LIMIT,
                );

                for (const candidate of selectedForRefinement) {
                    if (optimizerCancelledRef.current) return;
                    setOptimizerProgress(`Refining evolution path ${evaluatedConfigs + 1} of ${baselineRuns.length + selectedForRefinement.length}…`);
                    const run = await runOptimizeForConfig(candidate.valenceElement, candidate.incarnonCandidate);
                    if (run.score > bestRun.score) bestRun = run;
                    evaluatedConfigs += 1;
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }
            if (optimizerCancelledRef.current) return;
            if (!bestRun || !bestRun.appliedResult.capacityValid) {
                setOptimizerNotice("No legal build fits the current capacity and locked-slot settings.");
                setOptimizerProgress(null);
                return;
            }
            optimizerApplyingRef.current = true;
            const { weaponForOpt, atk, appliedResult, appliedCatalyst, baseExtraCapacitySlots, valenceElement, incarnonSelectedOptionsByTier } = bestRun;
            if (baseExtraCapacitySlots?.[0]) {
                setStanceMod(baseExtraCapacitySlots[0].mod);
                setStanceRank(baseExtraCapacitySlots[0].rank);
            }
            if (weapon.isProgenitorWeapon && valenceElement !== buildCfg.valenceElement) {
                setBuildCfg(p => ({ ...p, valenceElement }));
            }
            if (incarnonRecord) {
                setBuildCfg(p => ({ ...p, incarnonSelectedOptionsByTier }));
            }

            // Apply exilus mod if optimized
            if (optExilus) {
                setHasExilus(true);
                setExilusMod(appliedResult.exilusMod);
                setExilusRank(appliedResult.exilusMod ? appliedResult.exilusRank : 0);
            } else if (!fillMode || !exilusMod) {
                setHasExilus(false);
                setExilusMod(null);
                setExilusRank(0);
                setExilusPol("");
            }

            const finalSlotsForCap = [...appliedResult.slots, ...(optExilus ? [appliedResult.exilusMod] : [])];
            const finalRanksForCap = [...appliedResult.slotRanks, ...(optExilus ? [appliedResult.exilusMod ? appliedResult.exilusRank : 0] : [])];
            const finalPolsForCap  = [...appliedResult.slotPolarities, ...(optExilus ? [appliedResult.exilusPolarity] : [])];

            if (
                appliedCatalyst ||
                appliedResult.needsCatalyst ||
                (allowCatalyst && shouldAutoInstallCatalyst(capacityCfg, finalPolsForCap, finalSlotsForCap, finalRanksForCap, baseExtraCapacitySlots ?? []))
            ) {
                setBuildCfg(p => ({ ...p, hasCatalyst: true }));
            }

            // The optimizer starts from the polarities already installed on this
            // build. Apply its result directly so a re-optimization never erases
            // existing Forma or silently spends beyond the remaining budget.
            const slotPolsToApply = [...appliedResult.slotPolarities];
            const stancePolToApply = stancePol;
            const exilusPolToApply = appliedResult.exilusMod ? appliedResult.exilusPolarity : exilusPol;

            // Apply mod slots. In fill mode, occupied user slots stay authoritative.
            const nextSlots = (fillMode
                ? appliedResult.slots.map((mod, i) => (lockedSlotMask[i] ? slots[i] : mod))
                : [...appliedResult.slots]) as (ModEntry | null)[];
            const nextRanks = (fillMode
                ? appliedResult.slotRanks.map((rank, i) => (lockedSlotMask[i] ? (ranks[i] ?? 0) : rank))
                : [...appliedResult.slotRanks]) as number[];
            setSlots(nextSlots);
            setRanks(nextRanks);

            // Apply polarity changes from forma optimizer
            if (allowForma) {
                setSlotPols([...slotPolsToApply]);
                setStancePol(stancePolToApply);
                setExilusPol(exilusPolToApply);
            }

            // Apply arcane if optimized
            if (optimizeArcaneForRun && appliedResult.arcane) {
                setArcane1(appliedResult.arcane);
                setArcane1Rank(appliedResult.arcaneRank);
            }

            const optimizedWeaponState = applyWeaponConfig(weapon, selectedAttackIdx, {
                ...buildCfg,
                valenceElement,
                incarnonSelectedOptionsByTier,
            });
            const mathEffects: (ModEffect | null)[] = [
                ...optimizedWeaponState.activeIncarnonEffects,
                ...appliedResult.slots.map((m, i) => {
                if (!m) return null;
                const r = appliedResult.slotRanks[i] ?? m.fusionLimit;
                return m.effectsByRank[r] ?? m.effect;
                }),
            ];
            if (optExilus && appliedResult.exilusMod) {
                mathEffects.push(appliedResult.exilusMod.effectsByRank[appliedResult.exilusRank] ?? appliedResult.exilusMod.effect);
            }
            if (includeArcaneStats && optArcane && appliedResult.arcane) {
                const ae = getArcaneEffectAtRank(appliedResult.arcane, appliedResult.arcaneRank, warframeArmor, true, arcaneEnergyContext);
                if (ae) mathEffects.push({
                    ...emptyEffect(),
                    ...ae,
                    conditionalEffects: [...(ae.conditionalEffects ?? [])],
                });
            }
            const explanationBaseEffects: (ModEffect | null)[] = [
                ...optimizedWeaponState.activeIncarnonEffects,
                ...lockedExternalEffects.filter((effect) => effect !== lockedArcaneEffect),
            ];
            if (optExilus && appliedResult.exilusMod) {
                explanationBaseEffects.push(appliedResult.exilusMod.effectsByRank[appliedResult.exilusRank] ?? appliedResult.exilusMod.effect);
            }
            const explanationArcaneEntry = optimizeArcaneForRun ? appliedResult.arcane : includeArcaneStats ? arcane1 : null;
            const explanationArcaneRank = optimizeArcaneForRun ? appliedResult.arcaneRank : arcane1Rank;
            const explanationArcane = explanationArcaneEntry
                ? getArcaneEffectAtRank(explanationArcaneEntry, explanationArcaneRank, warframeArmor, true, arcaneEnergyContext)
                : null;
            setReasoning(explainBuild(
                weaponForOpt,
                appliedResult.mods,
                appliedResult.ranks,
                goal,
                factionOn ? faction : "",
                atk,
                conditionalState,
                targetProfileOverride,
                {
                    baseEffects: explanationBaseEffects,
                    arcaneEffect: explanationArcane,
                    arcaneName: explanationArcaneEntry?.name,
                    arcaneRank: explanationArcaneEntry ? explanationArcaneRank : undefined,
                    objectiveEncounter: goal === "timeToKill" && appliedResult.encounterScore !== undefined
                        ? {
                            damagePerSecond: appliedResult.encounterScore,
                            timeToKillSeconds: appliedResult.encounterTimeToKillSeconds ?? null,
                            refined: appliedResult.encounterRefined ?? false,
                            candidatesEvaluated: appliedResult.encounterCandidatesEvaluated ?? 0,
                        }
                        : undefined,
                },
            ));
            setReasoningContextAtOptimization(currentReasoningContextKey);
            const mathWeapon = makeSelectedAttackWeapon(weaponForOpt, selectedAttackIdx);
            setReasoningMath(buildMathBreakdown(mathWeapon, mathEffects, factionOn ? faction : "", conditionalState, targetProfileOverride, meleeDpsInputs));
            setOptimizerProgress(null);
        } catch (error) {
            if (!optimizerCancelledRef.current) {
                setOptimizerNotice(error instanceof Error ? error.message : String(error));
                setOptimizerProgress(null);
            }
        } finally {
            optimizerApplyingRef.current = false;
            optimizerWorkerRef.current?.terminate();
            optimizerWorkerRef.current = null;
            pendingWorkerRejectRef.current = null;
            setOptimizing(false);
        }
    }

    function handleLoadBuild(build: SavedBuild) {
        if (!weapon) return;
        const mods = build.slotModUniqueNames.map(un => compatMods.find(m => m.uniqueName === un) ?? null);
        const ns   = [...mods, ...Array(SLOT_COUNT).fill(null)].slice(0, SLOT_COUNT) as (ModEntry | null)[];
        setSlots(ns);
        setRanks(ns.map((m, i) => m ? (build.slotRanks?.[i] ?? m.fusionLimit) : 0));
        setSlotPols([...build.slotPolarities, ...Array(SLOT_COUNT).fill("")].slice(0, SLOT_COUNT));
            setBuildCfg(p => ({
                ...p,
            weaponRank: build.weaponRank,
            hasCatalyst: build.hasCatalyst,
            valenceBonusPct: build.valenceBonusPct ?? p.valenceBonusPct,
            valenceElement: (build.valenceElement as ValenceElement | undefined) ?? p.valenceElement,
            optimizeValenceElement: build.optimizeValenceElement ?? false,
            incarnonUnlockedTier: build.incarnonSelectedOptionsByTier
                ? getHighestSelectedIncarnonTier(build.incarnonSelectedOptionsByTier)
                : (build.incarnonUnlockedTier ?? p.incarnonUnlockedTier),
            incarnonSelectedOptionsByTier: build.incarnonSelectedOptionsByTier ?? p.incarnonSelectedOptionsByTier,
            optimizeIncarnonSelections: build.optimizeIncarnonSelections ?? false,
        }));
        if (build.stanceModUniqueName) {
            const sm = stanceMods.find(m => m.uniqueName === build.stanceModUniqueName) ?? null;
            setStanceMod(sm);
            setStanceRank(sm ? (build.stanceRank ?? sm.fusionLimit) : 0);
        } else {
            setStanceMod(null);
            setStanceRank(0);
        }
        setStancePol(build.stancePol ?? weapon.stancePolarity ?? "");
        setHasExilus(build.hasExilus ?? false);
        if (build.exilusModUniqueName) {
            const em = compatMods.find(m => m.uniqueName === build.exilusModUniqueName) ?? null;
            setExilusMod(em); setExilusRank(em ? (build.exilusRank ?? em.fusionLimit) : 0);
        }
        setExilusPol(build.exilusPol ?? "");
        if (build.arcane1UniqueName) {
            const a = weaponArcanes.find(a => a.uniqueName === build.arcane1UniqueName) ?? null;
            setArcane1(a); setArcane1Rank(build.arcane1Rank ?? 0);
        }
        const plannerConfig = build.plannerConfig;
        // Older or imported builds without planner settings must not inherit a
        // stale external status assumption from the previously loaded build.
        setExternalStatusTypeCount(0);
        setWarframeArmorInput(readWarframeArmor(build.plannerConfig?.warframeArmor)?.toString() ?? "");
        setWarframeMaxEnergyInput(parseWarframeMaxEnergyInput(build.plannerConfig?.warframeMaxEnergy?.toString() ?? "")?.toString() ?? "");
        setWarframeEnergyPercentInput(parseWarframeEnergyPercentInput(build.plannerConfig?.warframeEnergyPercent?.toString() ?? "")?.toString() ?? "");
        if (plannerConfig) {
            if (plannerConfig.goal === "burst" || plannerConfig.goal === "scaling" || plannerConfig.goal === "timeToKill") setGoal(plannerConfig.goal);
            const conditionalModes: ConditionalState["mode"][] = ["initial", "realistic", "fullyStacked", "custom"];
            if (plannerConfig.conditionalMode && conditionalModes.includes(plannerConfig.conditionalMode)) {
                setConditionalMode(plannerConfig.conditionalMode);
            }
            if (Number.isFinite(plannerConfig.externalConditionalStacks)) {
                setExternalConditionalStacks(Math.max(0, Math.min(20, plannerConfig.externalConditionalStacks ?? 1)));
            }
            setExternalStatusTypeCount(Number.isFinite(plannerConfig.externalStatusTypeCount)
                ? Math.max(0, Math.min(16, Math.floor(plannerConfig.externalStatusTypeCount ?? 0)))
                : 0);
            setMeleeComboMultiplier(Number.isFinite(plannerConfig.meleeComboMultiplier)
                ? clampMeleeComboMultiplier(weapon, plannerConfig.meleeComboMultiplier ?? 1)
                : 1);
            setPhantasmaChargeAmmo(Number.isFinite(plannerConfig.phantasmaChargeAmmo)
                ? Math.max(2, Math.min(50, Math.round(plannerConfig.phantasmaChargeAmmo ?? 2)))
                : 2);
            setMeleeDpsInputs({
                averageComboDamageMultiplier: readPositivePlannerInput(plannerConfig.meleeAverageComboDamageMultiplier, 50),
                baseComboLengthSeconds: readPositivePlannerInput(plannerConfig.meleeBaseComboLengthSeconds, 60),
            });
            const attackIndexByName = plannerConfig.attackName
                ? weapon.attacks.findIndex((attack) => attack.name === plannerConfig.attackName)
                : -1;
            const storedAttackIndex = plannerConfig.attackIndex;
            setSelectedAttackIdx(attackIndexByName >= 0
                ? attackIndexByName
                : Number.isInteger(storedAttackIndex) && (storedAttackIndex ?? -1) >= 0 && (storedAttackIndex ?? 0) < weapon.attacks.length
                    ? storedAttackIndex ?? 0
                    : 0);

            const target = plannerConfig.target;
            setFactionOn(target?.enabled ?? false);
            setFaction(target?.faction || "Grineer");
            setSelectedEnemyProfileId(target?.enemyProfileId && getEnemyProfile(target.enemyProfileId)
                ? target.enemyProfileId
                : "");
            setUseCustomTargetStats(target?.useCustomStats ?? false);
            setIsEximus(target?.isEximus ?? false);
            setBossBlastStackCap(target?.bossBlastStackCap ?? false);
            setIsSteelPath(target?.isSteelPath ?? false);
            if (target?.baseStats) {
                const safeStat = (value: number, fallback: number) =>
                    Number.isFinite(value) ? Math.max(0, Math.min(1_000_000_000, value)) : fallback;
                setCustomTargetStats({
                    health: safeStat(target.baseStats.health, 25000),
                    shields: safeStat(target.baseStats.shields, 0),
                    overguard: safeStat(target.baseStats.overguard, 0),
                    armor: safeStat(target.baseStats.armor, 2700),
                });
            }
            setScaleCustomTargetByLevel(target?.scaleByLevel ?? false);
            const scalingFactions: EnemyScalingFaction[] = [
                "grineer", "corpus", "infested", "corrupted", "murmur", "sentient", "anarchs", "unaffiliated", "techrot",
            ];
            setEnemyScalingFaction(scalingFactions.includes(target?.scalingFaction as EnemyScalingFaction)
                ? target!.scalingFaction as EnemyScalingFaction
                : "grineer");
            const safeLevel = (value: number, fallback: number) =>
                Number.isFinite(value) ? Math.max(1, Math.min(9999, Math.floor(value))) : fallback;
            setEnemyBaseLevel(safeLevel(target?.baseLevel ?? 1, 1));
            setEnemyCurrentLevel(safeLevel(target?.currentLevel ?? 30, 30));
            setCustomToxinBypassesShields(target?.toxinBypassesShields ?? true);
            setEnemyShieldGateHitMode(target?.enemyShieldGateHitMode === "weakspot" || target?.enemyShieldGateHitMode === "blockedArea"
                ? target.enemyShieldGateHitMode
                : "body");
            setNearbyEnemyCount(Number.isFinite(target?.nearbyEnemyCount)
                ? Math.max(0, Math.min(20, Math.floor(target?.nearbyEnemyCount ?? 0)))
                : 0);
            setNearbyBlastEnemyCount(Number.isFinite(target?.nearbyBlastEnemyCount)
                ? Math.max(0, Math.min(20, Math.floor(target?.nearbyBlastEnemyCount ?? 0)))
                : 0);
            setTargetStatusImmunities((target?.statusImmunities ?? [])
                .filter((type): type is StatusDamageType =>
                    (STATUS_DAMAGE_TYPES as readonly string[]).includes(type)));

            const options = plannerConfig.optimizerOptions;
            if (options) {
                setAllowNonMax(options.allowNonMax ?? false);
                setOnlyOwned(options.onlyOwned ?? false);
                setAllowCatalyst(options.allowCatalyst ?? false);
                setAllowForma(options.allowForma ?? false);
                setMaxFormaAllowed(Number.isInteger(options.maxFormaAllowed)
                    ? Math.max(1, Math.min(maxOptimizerFormaForWeapon(weapon), options.maxFormaAllowed ?? 1))
                    : maxOptimizerFormaForWeapon(weapon));
                setOptExilus(options.optimizeExilus ?? false);
                setOptArcane(options.optimizeArcane ?? false);
                setExcluded(new Set((options.excludedModUniqueNames ?? []).filter((name) => typeof name === "string")));
            }
        } else {
            // Old saved builds have no target snapshot. Do not accidentally apply
            // whichever experimental target happened to be selected at load time.
            setFactionOn(false);
            setSelectedEnemyProfileId("");
            setUseCustomTargetStats(false);
            setIsEximus(false);
            setBossBlastStackCap(false);
            setNearbyEnemyCount(0);
            setNearbyBlastEnemyCount(0);
            setTargetStatusImmunities([]);
        }
        setTab("build");
    }

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <WorkspaceSegmented className="flex-wrap">
                {(["build","saves","owned","ownedArcanes","exclude"] as const).map(t => (
                    <WorkspaceSegmentedButton key={t} onClick={() => (weapon || t === "build") && setTab(t)}
                        active={tab === t}
                        disabled={!weapon && t !== "build"}
                        className={["rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors",
                            tab === t ? "border-slate-100 bg-slate-100 text-slate-900" : "border-slate-700 bg-slate-950/40 text-slate-400 hover:bg-slate-900",
                            !weapon && t !== "build" ? "opacity-40 cursor-not-allowed" : ""].join(" ")}>
                        {t === "build" ? "Build" : t === "saves" ? "Saved Builds" : t === "owned" ? "Owned Mods" : t === "ownedArcanes" ? "Owned Arcanes" : `Excluded${excluded.size ? ` (${excluded.size})` : ""}`}
                    </WorkspaceSegmentedButton>
                ))}
            </WorkspaceSegmented>

            {weapon && tab === "owned"   && <OwnedModsPanel availableMods={trackableMods} />}
            {weapon && tab === "ownedArcanes" && <OwnedArcanesPanel weapon={weapon} />}
            {weapon && tab === "saves"   && <SavedBuildsPanel weapon={weapon} availableMods={compatMods} currentSlots={slots} currentRanks={ranks}
                currentPolarities={slotPols} currentCfg={buildCfg}
                stanceMod={stanceMod} stanceRank={stanceRank} stancePol={stancePol}
                exilusMod={exilusMod} exilusPol={exilusPol}
                arcane1={arcane1} arcane1Rank={arcane1Rank}
                targetFaction={factionOn ? faction : ""} conditionalState={conditionalState} targetProfileOverride={targetProfileOverride}
                plannerConfig={savedPlannerConfig}
                hasExilus={hasExilus} onLoad={handleLoadBuild} />}
            {weapon && tab === "exclude" && <ExclusionList allMods={compatMods} excluded={excluded} onToggle={toggleExclude} />}

            {tab === "build" && (
                <>
                            <div className="rounded-[28px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] shadow-[var(--wf-shadow-panel)] overflow-visible">
                                <div className="border-b border-slate-800/80 bg-slate-950/70 px-4 py-3">
                                    <div className="flex flex-wrap items-start gap-3 justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--wf-warning)]">Arsenal Modding</div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                    <div className="w-[360px] max-w-full">
                                                        <WeaponSelector selected={weapon} onSelect={handleSelectWeapon} />
                                                    </div>
                                                    {weapon && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuildCfg(p => ({ ...p, hasCatalyst: !p.hasCatalyst }))}
                                                            className={[
                                                                "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide transition-colors",
                                                                buildCfg.hasCatalyst
                                                                    ? "border-amber-700/60 bg-amber-950/30 text-amber-300"
                                                                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-slate-100",
                                                            ].join(" ")}
                                                            title="Marks whether this weapon already has an Orokin Catalyst installed."
                                                        >
                                                            Catalyst
                                                        </button>
                                                    )}
                                                {weapon && formaCount > 0 && (
                                                    <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-300">
                                                        {formaCount} forma
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 justify-end">
                                            <div className="flex flex-wrap gap-1.5">
                                                {GOAL_OPTIONS.map(g => (
                                                    <GoalChip
                                                        key={g.key}
                                                        label={g.label}
                                                        desc={g.desc}
                                                        active={goal === g.key}
                                                        onClick={() => setGoal(g.key)}
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => setShowOptimizeOptions(v => !v)}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
                                            >
                                                Options {showOptimizeOptions ? "▴" : "▾"}
                                            </button>
                                            <div className="flex items-stretch overflow-hidden rounded-xl border border-amber-600/60 bg-amber-950/30">
                                                <button onClick={optimizing ? cancelOptimization : handleOptimize} disabled={!optimizing && !weapon}
                                                    className={[
                                                        "px-4 py-2 text-sm transition-colors font-semibold disabled:opacity-50",
                                                        optimizing ? "text-rose-300 hover:bg-rose-950/50" : "text-amber-300 hover:bg-amber-900/40",
                                                    ].join(" ")}>
                                                    {optimizing ? "Cancel Optimization" : optimizeMode === "fill" ? "Fill & Optimize" : "Optimize Build"}
                                                </button>
                                                <div className="relative w-10 border-l border-amber-600/40">
                                                    <select
                                                        value={optimizeMode}
                                                        onChange={(e) => setOptimizeMode(e.target.value as OptimizeMode)}
                                                        disabled={optimizing}
                                                        className="h-full w-full appearance-none bg-transparent text-transparent outline-none"
                                                        aria-label="Optimization mode"
                                                    >
                                                        <option value="optimize" className="bg-slate-950 text-slate-100">Optimize</option>
                                                        <option value="fill" className="bg-slate-950 text-slate-100">Fill & Optimize</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-full items-center justify-center text-amber-200">
                                                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                                            <path d="M5 6.5L8 3.5L11 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                            <path d="M5 9.5L8 12.5L11 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleCopyBuildExport}
                                                disabled={!currentBuildExport}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                                            >
                                                {copiedExport ? "Copied Build JSON" : "Copy Build JSON"}
                                            </button>
                                            <button
                                                onClick={handleShareBuildImage}
                                                disabled={!currentBuildExport || sharingBuildImage}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                                            >
                                                {sharingBuildImage ? "Generating Image…" : sharedBuildImage ? "Shared Build Image" : "Share Build Image"}
                                            </button>
                                            <button
                                                onClick={() => weapon && resetBuildForWeapon(weapon)}
                                                disabled={!weapon}
                                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                                            >
                                                Reset Build
                                            </button>
                                        </div>
                                    </div>
                                    {(optimizerProgress || optimizerNotice) && (
                                        <div className="mt-2 text-right text-[11px]" role={optimizerNotice ? "alert" : "status"}>
                                            {optimizerNotice
                                                ? <span className="text-amber-300">{optimizerNotice}</span>
                                                : <span className="text-slate-400">{optimizerProgress}</span>}
                                        </div>
                                    )}
                                    {showOptimizeOptions && (
                                        <div className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-950/30 p-3">
                                            <p className="mb-2 text-[11px] text-slate-400">Capacity is enforced for every optimized build. Catalyst and Forma are included only when their options are enabled.</p>
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <label htmlFor="conditional-state" className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conditional effects</label>
                                                <select
                                                    id="conditional-state"
                                                    value={conditionalMode}
                                                    onChange={(event) => setConditionalMode(event.target.value as ConditionalState["mode"])}
                                                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                >
                                                    <option value="initial">Initial state</option>
                                                    <option value="realistic">Realistic ramp-up estimate</option>
                                                    <option value="fullyStacked">Fully stacked scenario</option>
                                                    <option value="custom">External stacks</option>
                                                </select>
                                                {conditionalMode === "custom" && (
                                                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span>Maintained stacks per effect</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={10}
                                                            step={1}
                                                            value={externalConditionalStacks}
                                                            onChange={(event) => setExternalConditionalStacks(Math.max(0, Math.min(10, Math.floor(Number(event.target.value) || 0))))}
                                                            className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                        />
                                                    </label>
                                                )}
                                                <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                                    <span title="Count additional distinct statuses already maintained on the target by allies, abilities, hidden effects, or other sources. Includes Tau; capped at 16 total with weapon-generated types.">External Condition Overload types</span>
                                                    <input
                                                        aria-label="Externally maintained status types for Condition Overload"
                                                        type="number"
                                                        min={0}
                                                        max={16}
                                                        step={1}
                                                        value={externalStatusTypeCount}
                                                        onChange={(event) => setExternalStatusTypeCount(Math.max(0, Math.min(16, Math.floor(Number(event.target.value) || 0))))}
                                                        className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                    />
                                                </label>
                                                {weapon && usesMeleeDamageModel(weapon.category) && (
                                                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span>Melee combo tier</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={maxMeleeComboMultiplier}
                                                            step={1}
                                                            value={meleeComboMultiplier}
                                                            onChange={(event) => setMeleeComboMultiplier(clampMeleeComboMultiplier(weapon, Number(event.target.value) || 1))}
                                                            className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none"
                                                        />
                                                    </label>
                                                )}
                                                <span className="text-[10px] text-slate-500">
                                                    {conditionalMode === "realistic"
                                                        ? "Realistic uses modeled trigger assumptions; ability casts, airborne states, aim-gliding, and invisibility default to zero uptime. Fully stacked or external-stack scenarios can activate them."
                                                        : conditionalMode === "initial"
                                                            ? "No conditional trigger effects are active."
                                                            : conditionalMode === "fullyStacked"
                                                                ? "Assumes every modeled trigger is active at its maximum stacks."
                                                                : "Applies this maintained stack count to each conditional effect."}
                                                </span>
                                            </div>
                                            {weapon?.hasGaleForceAmmoPassive && (
                                                <p className="mb-3 text-[10px] text-slate-400">
                                                    Gale Force provides Infinite Ammo for 4 seconds after a headshot kill or four headshots in one burst. Its trigger and refresh timing are not simulated. Perigale assumes it is maintained only in Fully stacked or Custom with at least one stack; while active, the build has no reloads or further first-shot Chamber bonus.
                                                </p>
                                            )}
                                            {weapon && usesMeleeDamageModel(weapon.category) && (
                                                <p className="mb-3 text-[10px] text-slate-500">Combo tier is an explicit scenario input (1× by default). Initial state uses static Initial Combo mods and supported weapon passives, and ignores this field. Conditional Initial Combo bonuses apply when their selected state is active. Realistic kill-triggered bonuses use shared 60% uptime and 70% stack-cap estimates, not a target-specific kill history. Selected heavy attacks multiply damage by the active tier. The stats panel estimates points retained after one attack using equipped Heavy Attack Efficiency (capped at 90%). Direct-hit TTK then steps combo after each heavy hit and rebuilds Initial Combo at 40 points/s. It does not model combo generated by hits, Tennokai, stance sequences, heavy-attack wind-up, or enemies hit per swing. DPS, the finite status encounter, and optimizer scores hold the starting tier.</p>
                                            )}
                                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                                {([
                                                    { label: "Allow Non-Maxed", active: allowNonMax, set: setAllowNonMax, desc: "Try lower-ranked mods so more fit within capacity." },
                                                    { label: "Owned Only", active: onlyOwned, set: setOnlyOwned, desc: "Only use mods you have marked as owned." },
                                                    { label: "Faction Focus", active: factionOn, set: (active: boolean) => { setFactionOn(active); if (!active) { setUseCustomTargetStats(false); setSelectedEnemyProfileId(""); setIsEximus(false); setBossBlastStackCap(false); setIsSteelPath(false); setNearbyEnemyCount(0); setNearbyBlastEnemyCount(0); } }, desc: "Apply the selected faction's damage-type modifiers. Choose a sourced enemy profile or enter custom target stats; faction-only pool mixes remain estimates." },
                                                    { label: "Allow Catalyst", active: allowCatalyst, set: setAllowCatalyst, desc: "Assume Orokin Catalyst installed if needed." },
                                                    { label: "Allow Forma", active: allowForma, set: setAllowForma, desc: "Reassign slot polarities to reduce drain." },
                                                    { label: "Optimize Exilus", active: optExilus, set: setOptExilus, desc: "Include the exilus slot in optimization." },
                                                    { label: "Optimize Arcane", active: optArcane, set: setOptArcane, desc: "Choose the best arcane for the build." },
                                                    ...(weapon?.isProgenitorWeapon ? [{
                                                        label: "Optimize Valence Element",
                                                        active: buildCfg.optimizeValenceElement,
                                                        set: (next: boolean) => setBuildCfg(p => ({ ...p, optimizeValenceElement: next })),
                                                        desc: buildCfg.weaponRank >= 40
                                                            ? "Allow the optimizer to choose the best valence element for this max-rank progenitor weapon."
                                                            : "Available once the progenitor weapon reaches rank 40.",
                                                    }] as const : []),
                                                ] as const).map(t => (
                                                    t.label === "Allow Forma" ? (
                                                        <div
                                                            key={t.label}
                                                            title={t.desc}
                                                            onClick={() => t.set(!t.active)}
                                                            className={[
                                                                "cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
                                                                t.active ? "border-sky-700/60 bg-sky-950/20 text-sky-300" : "border-slate-700 bg-slate-900/40 text-slate-500 hover:border-slate-600 hover:text-slate-300",
                                                            ].join(" ")}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        t.set(!t.active);
                                                                    }}
                                                                    className="flex min-w-0 items-center gap-1.5 text-left"
                                                                >
                                                                    <span className={["w-3 h-3 rounded-full border flex items-center justify-center shrink-0",
                                                                        t.active ? "border-sky-400 bg-sky-400" : "border-slate-600"].join(" ")}>
                                                                        {t.active && <span className="text-slate-900 text-[8px]">&#10003;</span>}
                                                                    </span>
                                                                    <span className="font-semibold">{t.label}</span>
                                                                </button>
                                                                {t.active && (
                                                                    <label
                                                                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-sky-200/85"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <span>Max:</span>
                                                                        <select
                                                                            value={maxFormaAllowed}
                                                                            onChange={(e) => setMaxFormaAllowed(Math.max(1, Math.min(maxOptimizerForma, Number(e.target.value) || 1)))}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="rounded-md border border-sky-700/60 bg-slate-950/85 px-2 py-1 text-[11px] font-semibold text-slate-100 outline-none transition-colors focus:border-sky-500"
                                                                        >
                                                                            {Array.from({ length: maxOptimizerForma }, (_, index) => index + 1).map((count) => (
                                                                                <option key={count} value={count}>
                                                                                    {count}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button key={t.label} onClick={() => t.set(!t.active)} title={t.desc}
                                                            disabled={t.label === "Optimize Valence Element" && buildCfg.weaponRank < 40}
                                                            className={["rounded-lg border px-2.5 py-1.5 text-[11px] text-left transition-colors",
                                                                t.active ? "border-sky-700/60 bg-sky-950/20 text-sky-300" : "border-slate-700 bg-slate-900/40 text-slate-500 hover:border-slate-600 hover:text-slate-300",
                                                                t.label === "Optimize Valence Element" && buildCfg.weaponRank < 40 ? "opacity-50 cursor-not-allowed" : "",
                                                            ].join(" ")}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={["w-3 h-3 rounded-full border flex items-center justify-center shrink-0",
                                                                    t.active ? "border-sky-400 bg-sky-400" : "border-slate-600"].join(" ")}>
                                                                    {t.active && <span className="text-slate-900 text-[8px]">&#10003;</span>}
                                                                </span>
                                                                <span className="font-semibold">{t.label}</span>
                                                            </div>
                                                        </button>
                                                    )
                                                ))}
                                            </div>
                                            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                                    <div>
                                                        <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Weapon Rank</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type="range" min={0} max={maxWeaponRank(weapon?.canOverLevel ?? false)} value={buildCfg.weaponRank}
                                                                onChange={e => setBuildCfg(p => ({ ...p, weaponRank: +e.target.value }))} className="flex-1 accent-sky-500" />
                                                            <span className="text-sm font-mono text-slate-200 w-7 text-right">{buildCfg.weaponRank}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Mastery Rank</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type="range" min={0} max={40} value={buildCfg.masteryRank}
                                                                onChange={e => setBuildCfg(p => ({ ...p, masteryRank: +e.target.value }))} className="flex-1 accent-sky-500" />
                                                            <span className="text-sm font-mono text-slate-200 w-7 text-right">{buildCfg.masteryRank}</span>
                                                        </div>
                                                    </div>
                                                    {weapon?.isProgenitorWeapon && (
                                                        <>
                                                            <div>
                                                                <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Valence Bonus</label>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="range"
                                                                        min={0}
                                                                        max={60}
                                                                        step={1}
                                                                        value={Math.round(buildCfg.valenceBonusPct * 100)}
                                                                        onChange={e => setBuildCfg(p => ({ ...p, valenceBonusPct: Math.max(0, Math.min(0.6, +e.target.value / 100)) }))}
                                                                        className="flex-1 accent-sky-500"
                                                                    />
                                                                    <span className="text-sm font-mono text-slate-200 w-12 text-right">{Math.round(buildCfg.valenceBonusPct * 100)}%</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">Valence Element</label>
                                                                <select
                                                                    value={buildCfg.valenceElement}
                                                                    onChange={e => setBuildCfg(p => ({ ...p, valenceElement: e.target.value as ValenceElement }))}
                                                                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                                                >
                                                                    {VALENCE_ELEMENTS.map(option => (
                                                                        <option key={option.key} value={option.key}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </>
                                                    )}
                                                    {incarnonRecord && (
                                                        <div className="md:col-span-3">
                                                            <div className="rounded-[1.35rem] border border-[color:var(--wf-border-accent)] bg-[color:var(--wf-surface-2)] px-4 py-3 shadow-[var(--wf-shadow-panel)]">
                                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                                    <div>
                                                                        <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--wf-accent-text)]">Incarnon Evolution Path</div>
                                                                        <div className="mt-1 text-xs text-slate-400">
                                                                            Choose a path; only modeled effects change stats or optimizer scores. Unmodeled lines are marked in each perk.
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                                                                        {INCARNON_TIER_ORDER.map((tierNumber) => {
                                                                            const tier = incarnonRecord.tiers.find((entry) => entry.tier === tierNumber) ?? null;
                                                                            const selectedOptionId = buildCfg.incarnonSelectedOptionsByTier[tierNumber];
                                                                            const selectedOption = tier?.options.find((option) => option.id === selectedOptionId) ?? null;

                                                                            if (!tier) {
                                                                                return (
                                                                                    <span
                                                                                        key={tierNumber}
                                                                                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950/40 text-sm font-semibold tracking-[0.14em] text-slate-600"
                                                                                    >
                                                                                        {INCARNON_TIER_LABELS[tierNumber]}
                                                                                    </span>
                                                                                );
                                                                            }

                                                                            return (
                                                                                <button
                                                                                    key={tierNumber}
                                                                                    type="button"
                                                                                    onClick={() => setIncarnonPickerTier(tierNumber)}
                                                                                    title={selectedOption?.name ?? `Choose Evolution ${INCARNON_TIER_LABELS[tierNumber]}`}
                                                                                    className="group flex items-center gap-2"
                                                                                >
                                                                                    <span
                                                                                        className={[
                                                                                            "relative flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold tracking-[0.14em] transition-all duration-200",
                                                                                            selectedOption
                                                                                                ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)] shadow-[0_0_0_1px_var(--wf-selection-border)]"
                                                                                                : "border-[color:var(--wf-border-accent)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] group-hover:border-[color:var(--wf-selection-border)] group-hover:text-[color:var(--wf-accent-text)]",
                                                                                        ].join(" ")}
                                                                                    >
                                                                                        <span className="absolute inset-[5px] rounded-full border border-white/5" />
                                                                                        <span className="relative">{INCARNON_TIER_LABELS[tierNumber]}</span>
                                                                                    </span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                        <div className="ml-1 rounded-full border border-[color:var(--wf-border-accent)] bg-[color:var(--wf-surface-soft)] px-3 py-1 text-[11px] text-[color:var(--wf-accent-text)]">
                                                                            {selectedIncarnonTierCount > 0
                                                                                ? `${selectedIncarnonTierCount} evolution${selectedIncarnonTierCount === 1 ? "" : "s"} active · refine up to 2 paths`
                                                                                : buildCfg.optimizeIncarnonSelections
                                                                                    ? "Search all tiers · refine up to 2 paths"
                                                                                : "No evolutions selected"}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setBuildCfg((p) => ({ ...p, optimizeIncarnonSelections: !p.optimizeIncarnonSelections }))}
                                                                            className={[
                                                                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                                                                                buildCfg.optimizeIncarnonSelections
                                                                                    ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]"
                                                                                    : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-info)]",
                                                                            ].join(" ")}
                                                                            title={selectedIncarnonTierCount > 0
                                                                                ? "Score combinations for the selected Incarnon tiers against the current optimized build, then fully optimize up to two promising alternate paths. This shortlist is heuristic, not an exhaustive joint mod-and-evolution search."
                                                                                : "Score all available Incarnon paths against the current optimized build, then fully optimize up to two promising alternate paths. This shortlist is heuristic, not an exhaustive joint mod-and-evolution search."}
                                                                        >
                                                                            Optimize Incarnon Path
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-h-[34px] flex items-center justify-start lg:justify-end">
                                                    {factionOn && (
                                                        <div className="w-full space-y-2">
                                                            <label className="block space-y-1 text-[10px] text-slate-400">
                                                                <span className="block">Named enemy target</span>
                                                                <select
                                                                    aria-label="Named enemy target"
                                                                    value={selectedEnemyProfileId}
                                                                    onChange={(event) => selectEnemyProfile(event.target.value)}
                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                                                                >
                                                                    <option value="">Use faction estimate or custom stats</option>
                                                                    {ENEMY_PROFILES.map((profile) => (
                                                                        <option key={profile.id} value={profile.id}>
                                                                            {profile.name} · {profile.faction} · base level {profile.baseLevel}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {FACTIONS.map(f => (
                                                                    <button key={f.value} onClick={() => { setFaction(f.value); setSelectedEnemyProfileId(""); }}
                                                                        className={["rounded-full px-2.5 py-1 text-[10px] border transition-colors",
                                                                            faction === f.value ? "bg-[color:var(--wf-warning-soft)] border-[color:var(--wf-warning)] text-[color:var(--wf-warning)]" : "border-slate-700 text-slate-400 hover:border-slate-600"].join(" ")}>
                                                                        {f.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
                                                                <input type="checkbox" checked={useCustomTargetStats} onChange={(event) => { setUseCustomTargetStats(event.target.checked); setSelectedEnemyProfileId(""); if (!event.target.checked) { setIsEximus(false); setBossBlastStackCap(false); setIsSteelPath(false); setNearbyEnemyCount(0); setNearbyBlastEnemyCount(0); } }} />
                                                                Use custom target stats
                                                            </label>
                                                            {useCustomTargetStats && (
                                                                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                                                                    {selectedEnemyProfile && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-400">
                                                                            {selectedEnemyProfile.notes}{" "}
                                                                            <a href={selectedEnemyProfile.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        The finite expected-value encounter tracks Heat's armor-strip timeline, duration-scaled Blast fuses/caps, and Viral, Corrosive, Magnetic, Cold, and Puncture effects between attacks. Direct hits apply the 0.1 s enemy Shield Gate using the selected hit mode; scheduled status ticks remain ungated. Blast radial and scheduled Electricity/Gas ticks to configured same-profile nearby targets are reported separately from primary TTK; Gas ticks continue after the host dies. Neighbor status histories, position changes, and chained deaths are not simulated; fractional proc rolls, shield regeneration, boss attenuation, and random outcomes remain approximations. The optimizer uses a separate fast scoring proxy.
                                                                    </p>
                                                                    <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
                                                                        <label htmlFor="planner-nearby-enemies" className="text-[10px] text-slate-400">
                                                                            Additional nearby enemies in Electric/Gas range
                                                                        </label>
                                                                        <input
                                                                            id="planner-nearby-enemies"
                                                                            aria-label="Additional nearby enemies in Electric/Gas range"
                                                                            type="number"
                                                                            min={0}
                                                                            max={20}
                                                                            step={1}
                                                                            value={nearbyEnemyCount}
                                                                            onChange={(event) => setNearbyEnemyCount(Math.max(0, Math.min(20, Math.floor(Number(event.target.value) || 0))))}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        The optimizer scales Electric/Gas tick value by this count. The finite encounter also sends scheduled Electricity/Gas ticks through these same-profile neighbors' defenses and reports collateral separately from primary TTK. Enemies are assumed to remain in range; it does not add neighbor statuses, direct hits, chain geometry, or Gas radius growth. Set 0 for single-target scoring.
                                                                    </p>
                                                                    <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
                                                                        <label htmlFor="planner-nearby-blast-enemies" className="text-[10px] text-slate-400">
                                                                            Additional nearby enemies in Blast's 5 m radius
                                                                        </label>
                                                                        <input
                                                                            id="planner-nearby-blast-enemies"
                                                                            aria-label="Additional nearby enemies in Blast's 5 m radius"
                                                                            type="number"
                                                                            min={0}
                                                                            max={20}
                                                                            step={1}
                                                                            value={nearbyBlastEnemyCount}
                                                                            onChange={(event) => setNearbyBlastEnemyCount(Math.max(0, Math.min(20, Math.floor(Number(event.target.value) || 0))))}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        Optimizer estimates Blast's cap-triggered radial value (10 stacks, or the configured four-stack boss cap) from Poisson proc arrivals during the fuse. The finite encounter reports cap and on-death radial hits to these same-profile targets separately; they do not change the primary target's TTK. Neighbor status histories and chained deaths are not simulated. Set 0 to ignore Blast collateral.
                                                                    </p>
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={bossBlastStackCap}
                                                                            onChange={(event) => setBossBlastStackCap(event.target.checked)}
                                                                        />
                                                                        Apply boss Blast cap (4 stacks)
                                                                    </label>
                                                                    {bossBlastStackCap && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-500">
                                                                            Current Damage/Calculation rules use a four-stack Blast detonation threshold for bosses. This sets only that threshold; boss attenuation and other boss-specific defenses are not modeled. <a href="https://wiki.warframe.com/w/Damage/Calculation" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isEximus}
                                                                            onChange={(event) => {
                                                                                setIsEximus(event.target.checked);
                                                                                if (event.target.checked) setScaleCustomTargetByLevel(true);
                                                                            }}
                                                                        />
                                                                        Model a standard Eximus target
                                                                    </label>
                                                                    {isEximus && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-500">
                                                                            Uses current Eximus Health/Shield adjustments, standard Armor scaling, and level-scaled base Overguard {EXIMUS_BASE_OVERGUARD}. Active Overguard blocks Radiation procs and caps Cold at four stacks; Blast keeps its normal ten-stack detonation threshold. Special Eximus, squad, and boss modifiers remain unsupported. <a href="https://wiki.warframe.com/w/Overguard" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSteelPath}
                                                                            disabled={!scaleCustomTargetByLevel}
                                                                            onChange={(event) => setIsSteelPath(event.target.checked)}
                                                                        />
                                                                        Apply Steel Path modifiers (+100 levels, 2.5× Health/Shields)
                                                                    </label>
                                                                    {isSteelPath && (
                                                                        <p className="text-[10px] leading-relaxed text-slate-500">
                                                                            Uses the entered current mission level plus 100, then applies 2.5× Health and Shields. Armor uses the resulting level curve without a separate Steel Path multiplier. Archwing, Railjack, Duviri, squad scaling, and special-unit exceptions are not modeled. <a href="https://wiki.warframe.com/w/Steel_Path" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </p>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={scaleCustomTargetByLevel}
                                                                            disabled={isEximus}
                                                                            onChange={(event) => { setScaleCustomTargetByLevel(event.target.checked); setSelectedEnemyProfileId(""); if (!event.target.checked) setIsSteelPath(false); }}
                                                                        />
                                                                        Scale entered base stats to an enemy level
                                                                    </label>
                                                                    {scaleCustomTargetByLevel && (
                                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                            <label className="space-y-1 text-[10px] text-slate-400">
                                                                                <span className="block">Scaling family</span>
                                                                                <select
                                                                                    value={enemyScalingFaction}
                                                                                    onChange={(event) => { setEnemyScalingFaction(event.target.value as EnemyScalingFaction); setSelectedEnemyProfileId(""); }}
                                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                                                                                >
                                                                                    {ENEMY_SCALING_FACTIONS.map((entry) => (
                                                                                        <option key={entry.value} value={entry.value}>{entry.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </label>
                                                                            {([
                                                                                ["Base level", enemyBaseLevel, setEnemyBaseLevel],
                                                                                ["Current level", enemyCurrentLevel, setEnemyCurrentLevel],
                                                                            ] as const).map(([label, value, setter]) => (
                                                                                <label key={label} className="space-y-1 text-[10px] text-slate-400">
                                                                                    <span className="block">{label}</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        max={9999}
                                                                                        step={1}
                                                                                        value={value}
                                                                                        onChange={(event) => { setter(Math.max(1, Math.min(9999, Math.floor(Number(event.target.value) || 1)))); setSelectedEnemyProfileId(""); }}
                                                                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
                                                                                    />
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <p className="text-[10px] leading-relaxed text-slate-500">
                                                                        {scaleCustomTargetByLevel
                                                                            ? "Enter base Health, Shields, and Armor. Standard faction level curves and the separate Overguard curve produce current values. Eximus adjustments apply only when selected; Steel Path can be added above."
                                                                            : "Enter current Health, Shields, Overguard, and Armor values."}
                                                                    </p>
                                                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                        {(["health", "shields", "overguard", "armor"] as const).map((key) => (
                                                                            <label key={key} className="space-y-1 text-[10px] text-slate-400">
                                                                                <span className="block">{scaleCustomTargetByLevel ? "Base " : "Current "}{key === "shields" ? "Shields" : key[0].toUpperCase() + key.slice(1)}</span>
                                                                                <input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    max={1000000000}
                                                                                    step={key === "armor" ? 1 : 100}
                                                                                    value={isEximus && key === "overguard" ? EXIMUS_BASE_OVERGUARD : customTargetStats[key]}
                                                                                    disabled={isEximus && key === "overguard"}
                                                                                    onChange={(event) => {
                                                                                        setCustomTargetStats((current) => ({
                                                                                            ...current,
                                                                                            [key]: Math.max(0, Math.min(1000000000, Number(event.target.value) || 0)),
                                                                                        }));
                                                                                        setSelectedEnemyProfileId("");
                                                                                    }}
                                                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                                                                                />
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                    {scaleCustomTargetByLevel && (
                                                                        <div className="font-mono text-[10px] text-slate-500">
                                                                            Scaled current values: Health {Math.round(resolvedCustomTargetStats.health)}, Shields {Math.round(resolvedCustomTargetStats.shields)}, Overguard {Math.round(resolvedCustomTargetStats.overguard)}, Armor {Math.round(resolvedCustomTargetStats.armor)}
                                                                        </div>
                                                                    )}
                                                                    <label className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={customToxinBypassesShields}
                                                                            onChange={(event) => { setCustomToxinBypassesShields(event.target.checked); setSelectedEnemyProfileId(""); }}
                                                                        />
                                                                        Toxin bypasses Shields (turn off for Hounds or Treasurers)
                                                                    </label>
                                                                    <label className="block space-y-1 text-[10px] text-slate-400">
                                                                        <span>Hit behavior during enemy Shield Gate</span>
                                                                        <select
                                                                            aria-label="Hit behavior during enemy Shield Gate"
                                                                            value={enemyShieldGateHitMode}
                                                                            onChange={(event) => setEnemyShieldGateHitMode(event.target.value as typeof enemyShieldGateHitMode)}
                                                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                                                                        >
                                                                            <option value="body">Body hit: 5% direct Health damage</option>
                                                                            <option value="weakspot">Weakspot: bypass gate</option>
                                                                            <option value="blockedArea">Slam/AoE: direct hit blocked</option>
                                                                        </select>
                                                                        <span className="block leading-relaxed text-slate-500">
                                                                            Enemy Gates last 0.1 s after Shields break. This selection applies to each direct attack in the finite encounter and direct-hit sequence; status ticks stay ungated. Shield regeneration and weapon-specific weakspot eligibility are not inferred. <a href="https://wiki.warframe.com/w/Shield#Shield_Gating" target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">Wiki source</a>
                                                                        </span>
                                                                    </label>
                                                                    <div>
                                                                        <div className="mb-1 text-[10px] text-slate-500">Status immunities</div>
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                                            {STATUS_DAMAGE_TYPES.map((type) => (
                                                                                <label key={type} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={targetStatusImmunities.includes(type)}
                                                                                        onChange={(event) => {
                                                                                            setTargetStatusImmunities((current) => event.target.checked
                                                                                                ? [...new Set([...current, type])]
                                                                                                : current.filter((value) => value !== type));
                                                                                            setSelectedEnemyProfileId("");
                                                                                        }}
                                                                                    />
                                                                                    {type[0].toUpperCase() + type.slice(1)}
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {weapon ? (
                                <div className="grid xl:grid-cols-[280px_minmax(0,1fr)] gap-4 p-4">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 overflow-hidden">
                                        <div className="border-b border-slate-800/70 px-4 py-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--wf-warning)]">Capacity</div>
                                                {displayedCapacity && (
                                                    <div className="font-mono text-lg">
                                                        <span className={displayedCapacity.over ? "text-red-400" : "text-[color:var(--wf-warning)]"}>{displayedCapacity.used}</span>
                                                        <span className="text-slate-600">/</span>
                                                        <span className="text-slate-200">{displayedCapacity.total}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {displayedCapacity && (
                                                <>
                                                    <div className="mt-2">
                                                        <CapBar used={displayedCapacity.used} total={displayedCapacity.total} over={displayedCapacity.over} />
                                                    </div>
                                                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                                                        <span>{displayedCapacity.remaining >= 0 ? `${displayedCapacity.remaining} remaining` : `${Math.abs(displayedCapacity.remaining)} over`}</span>
                                                        <span>{buildCfg.hasCatalyst ? "Catalyzed" : "Uncatalyzed"} · MR {buildCfg.masteryRank}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {activeMetrics && (
                                            <div className="space-y-4 px-4 py-4">
                                                {weapon.attacks.length > 1 && (
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Attack Mode</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {weapon.attacks.map((atk, i) => (
                                                                <button
                                                                    key={atk.name}
                                                                    onClick={() => setSelectedAttackIdx(i)}
                                                                    className={[
                                                                        "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                                                                        selectedAttackIdx === i
                                                                            ? "border-sky-400/60 bg-sky-950/40 text-sky-200"
                                                                            : "border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-500",
                                                                    ].join(" ")}
                                                                >
                                                                    {atk.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex gap-1.5">
                                                    {([
                                                        ["stats", "Weapon Stats"],
                                                        ["why", "Why This Build"],
                                                    ] as const).map(([key, label]) => (
                                                        <button
                                                            key={key}
                                                            onClick={() => setInfoTab(key)}
                                                            className={[
                                                                "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                                                                infoTab === key
                                                                    ? "border-sky-400/60 bg-sky-950/40 text-sky-200"
                                                                    : "border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-500",
                                                            ].join(" ")}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowMathWindow(true)}
                                                        className={[
                                                            "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                                                            showMathWindow
                                                                ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]"
                                                                : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text)] hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-info)]",
                                                        ].join(" ")}
                                                    >
                                                        Open Math
                                                    </button>
                                                </div>

                                                {infoTab === "stats" && (
                                                    <>
                                                        {phantasmaAltFireModelNote && (
                                                            <div className="space-y-2 rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                                                                <div role="note">
                                                                    <span className="font-semibold">Phantasma alt-fire estimate:</span> {phantasmaAltFireModelNote}
                                                                </div>
                                                                <label className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-semibold">Charge ammo per attack</span>
                                                                    <input
                                                                        aria-label="Phantasma charge ammo per attack"
                                                                        type="number"
                                                                        min={2}
                                                                        max={Math.max(2, Math.floor(activeMetrics?.modded.magazineSize ?? activeCalcWeapon?.magazineSize ?? 2))}
                                                                        step={1}
                                                                        value={Math.min(phantasmaChargeAmmo, Math.max(2, Math.floor(activeMetrics?.modded.magazineSize ?? activeCalcWeapon?.magazineSize ?? 2)))}
                                                                        onChange={(event) => {
                                                                            const maxAmmo = Math.max(2, Math.floor(activeMetrics?.modded.magazineSize ?? activeCalcWeapon?.magazineSize ?? 2));
                                                                            const nextAmmo = Number(event.target.value);
                                                                            setPhantasmaChargeAmmo(Number.isFinite(nextAmmo)
                                                                                ? Math.max(2, Math.min(maxAmmo, Math.round(nextAmmo)))
                                                                                : 2);
                                                                        }}
                                                                        className="w-20 rounded border border-amber-800/70 bg-slate-950 px-2 py-1 text-xs text-amber-100"
                                                                    />
                                                                    <span>
                                                                        {fmt(activeMetrics?.modded.chargeTimeSeconds ?? 0, 3)} s at 11 ammo/s · {fmt(activeMetrics?.modded.totalDamage ?? 0)} selected-row damage
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        )}
                                                        {phantasmaBeamDamageRampNote && (
                                                            <div role="note" className="rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                                                                <span className="font-semibold">Phantasma Beam ramp:</span> {phantasmaBeamDamageRampNote}
                                                            </div>
                                                        )}
                                                        {meleeDpsModelNote && (
                                                            <div role="note" className="rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                                                                <span className="font-semibold">Melee DPS estimate:</span> {meleeDpsModelNote}
                                                            </div>
                                                        )}
                                                {weapon && usesMeleeDamageModel(weapon.category) && (
                                                    <div className="rounded-md border border-slate-700/70 bg-slate-900/40 px-3 py-3 space-y-2">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Stance-average DPS inputs</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <label className="space-y-1 text-[10px] text-slate-400">
                                                                <span className="block">Average combo damage multiplier</span>
                                                                <input
                                                                    type="number"
                                                                    min={0.01}
                                                                    max={50}
                                                                    step={0.01}
                                                                    inputMode="decimal"
                                                                    aria-label="Average combo damage multiplier"
                                                                    value={meleeDpsInputs.averageComboDamageMultiplier ?? ""}
                                                                    onChange={(event) => setMeleeDpsInputs((previous) => ({
                                                                        ...previous,
                                                                        averageComboDamageMultiplier: parsePositivePlannerInput(event.target.value, 50),
                                                                    }))}
                                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                                />
                                                            </label>
                                                            <label className="space-y-1 text-[10px] text-slate-400">
                                                                <span className="block">Base combo length (seconds)</span>
                                                                <input
                                                                    type="number"
                                                                    min={0.01}
                                                                    max={60}
                                                                    step={0.01}
                                                                    inputMode="decimal"
                                                                    aria-label="Base combo length in seconds"
                                                                    value={meleeDpsInputs.baseComboLengthSeconds ?? ""}
                                                                    onChange={(event) => setMeleeDpsInputs((previous) => ({
                                                                        ...previous,
                                                                        baseComboLengthSeconds: parsePositivePlannerInput(event.target.value, 60),
                                                                    }))}
                                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                                                                />
                                                            </label>
                                                        </div>
                                                        {meleeAverageDps ? (
                                                            <p className="text-[11px] text-sky-200">
                                                                {stanceMod?.name ?? "Selected stance"}: {fmt(meleeAverageDps.averageHit)} average combo hit · {fmt(meleeAverageDps.averageDps)} stance-average DPS
                                                            </p>
                                                        ) : (
                                                            <p className="text-[10px] leading-relaxed text-slate-500">
                                                                Enter both values from the current stance reference table. No stance values are inferred or prefilled.
                                                            </p>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setMeleeDpsInputs({ averageComboDamageMultiplier: null, baseComboLengthSeconds: null })}
                                                            disabled={meleeDpsInputs.averageComboDamageMultiplier == null && meleeDpsInputs.baseComboLengthSeconds == null}
                                                            className="text-[10px] text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200 disabled:opacity-40"
                                                        >
                                                            Clear stance inputs
                                                        </button>
                                                    </div>
                                                )}
                                                        <div>
                                                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">Primary</div>
                                                            <div className="space-y-1.5 text-sm">
                                                                {[
                                                                    {
                                                                        label: usesHitTerminology(weapon.category) ? "Attack Speed" : "Fire Rate",
                                                                        value: `${activeMetrics.modded.fireRate.toFixed(2)}`,
                                                                        tooltip: `${usesHitTerminology(weapon.category) ? BASIC_STAT_TOOLTIPS.attackSpeed : BASIC_STAT_TOOLTIPS.fireRate}\n\nAt the current value, this build performs about ${activeMetrics.modded.fireRate.toFixed(2)} ${usesHitTerminology(weapon.category) ? "attacks" : "attack events"} per second.`,
                                                                    },
                                                                    {
                                                                        label: "Magazine",
                                                                        value: displayMagazineValue(weapon, activeMetrics.modded.magazineSize),
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.magazine}\n\nThe current effective value is ${displayMagazineValue(weapon, activeMetrics.modded.magazineSize)}.`,
                                                                    },
                                                                    {
                                                                        label: "Reload",
                                                                        value: `${activeMetrics.modded.reloadTime.toFixed(2)}s`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.reload}\n\nThe current effective reload time is ${activeMetrics.modded.reloadTime.toFixed(2)}s.`,
                                                                    },
                                                                    {
                                                                        label: "Multishot",
                                                                        value: `${activeMetrics.modded.multishot.toFixed(2)}`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.multishot}\n\n${describeMultishot(activeMetrics.modded.multishot)}`,
                                                                    },
                                                                    {
                                                                        label: "Burst DPS",
                                                                        value: fmt(activeMetrics.burstDPS),
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.burstDps}\n\nAt the current values, burst DPS is ${fmt(activeMetrics.burstDPS)}.${weapon.weaponType.trim().toLowerCase() === "bow" ? "\n\nCharged bow shots use charge cadence and exclude the post-shot reload; uncharged shots use the reload delay." : ""}${meleeDpsModelNote ? `\n\n${meleeDpsModelNote}` : ""}${phantasmaAltFireModelNote ? `\n\n${phantasmaAltFireModelNote}` : ""}${phantasmaBeamDamageRampNote ? `\n\n${phantasmaBeamDamageRampNote}` : ""}`,
                                                                    },
                                                                    {
                                                                        label: "Sustained DPS",
                                                                        value: fmt(activeMetrics.sustainedDPS),
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.sustainedDps}\n\nAt the current values, sustained DPS is ${fmt(activeMetrics.sustainedDPS)}.${meleeDpsModelNote ? `\n\n${meleeDpsModelNote}` : ""}${phantasmaAltFireModelNote ? `\n\n${phantasmaAltFireModelNote}` : ""}${phantasmaBeamDamageRampNote ? `\n\n${phantasmaBeamDamageRampNote}` : ""}`,
                                                                    },
                                                                ].map((row) => (
                                                                    <InlineStatRow
                                                                        key={row.label}
                                                                        label={row.label}
                                                                        value={row.value}
                                                                        tooltip={row.tooltip}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">Damage</div>
                                                            <div className="space-y-1.5 text-sm">
                                                                {[
                                                                    {
                                                                        label: "Critical Chance",
                                                                        value: `${fmt(activeMetrics.modded.critChance * 100, 1)}%`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.criticalChance}\n\n${describeCritChance(activeMetrics.modded.critChance)}`,
                                                                    },
                                                                    {
                                                                        label: "Critical Damage",
                                                                        value: `${activeMetrics.modded.critMultiplier.toFixed(1)}x`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.criticalDamage}\n\n${describeCritMultiplier(activeMetrics.modded.critChance, activeMetrics.modded.critMultiplier)}`,
                                                                    },
                                                                    {
                                                                        label: "Status",
                                                                        value: `${fmt(activeMetrics.modded.statusChance * 100, 1)}%`,
                                                                        tooltip: `${BASIC_STAT_TOOLTIPS.statusChance}\n\n${describeStatusChance(activeMetrics.modded.statusChance)}`,
                                                                    },
                                                                ].map((row) => (
                                                                    <InlineStatRow
                                                                        key={row.label}
                                                                        label={row.label}
                                                                        value={row.value}
                                                                        tooltip={row.tooltip}
                                                                    />
                                                                ))}
                                                                {Object.entries(activeMetrics.modded.rawDamageBreakdown)
                                                                    .filter(([, value]) => value > 0)
                                                                    .sort((a, b) => b[1] - a[1])
                                                                    .map(([type, value]) => {
                                                                        const quantizedValue = activeMetrics.modded.damageBreakdown[type as keyof typeof activeMetrics.modded.damageBreakdown] ?? 0;
                                                                        const damageShare = activeMetrics.modded.totalDamage > 0 ? quantizedValue / activeMetrics.modded.totalDamage : 0;
                                                                        const actualProcChance = damageShare * activeMetrics.modded.statusChance;
                                                                        const tooltip = [
                                                                            STATUS_TIPS[type] ?? `${capitalizeDamageType(type)} status effect.`,
                                                                            `Actual proc chance: ${fmt(actualProcChance * 100, 1)}% (${fmt(activeMetrics.modded.statusChance * 100, 1)}% status chance × ${fmt(damageShare * 100, 1)}% damage share). ${activeDamageTypeSources[type] ?? `${capitalizeDamageType(type)} is present in the current damage mix.`}`,
                                                                        ].join("\n\n");
                                                                        const dmgIcon = DAMAGE_TYPE_ICON[type];
                                                                        const parents = COMBINED_ELEMENT_PARENTS[type];
                                                                        const dmgLabel = (
                                                                            <span className="flex items-center gap-1">
                                                                                {dmgIcon && <img src={dmgIcon} alt={type} className="w-4 h-4 shrink-0" />}
                                                                                <span>{capitalizeDamageType(type)}</span>
                                                                                {parents && (
                                                                                    <span className="flex items-center gap-0.5 text-slate-500 opacity-70">
                                                                                        <span>(</span>
                                                                                        {DAMAGE_TYPE_ICON[parents[0]] && <img src={DAMAGE_TYPE_ICON[parents[0]]} alt={parents[0]} className="w-3.5 h-3.5" />}
                                                                                        <span>+</span>
                                                                                        {DAMAGE_TYPE_ICON[parents[1]] && <img src={DAMAGE_TYPE_ICON[parents[1]]} alt={parents[1]} className="w-3.5 h-3.5" />}
                                                                                        <span>)</span>
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        );
                                                                        return (
                                                                            <InlineStatRow
                                                                                key={type}
                                                                                label={dmgLabel}
                                                                                value={fmt(value, 1)}
                                                                                sub={fmt(actualProcChance * 100, 1) + "%"}
                                                                                tooltip={tooltip}
                                                                                labelClassName={[
                                                                                    "capitalize",
                                                                                    type === "viral" ? "text-lime-300" :
                                                                                    type === "heat" ? "text-[color:var(--wf-warning)]" :
                                                                                    type === "cold" ? "text-[color:var(--wf-info)]" :
                                                                                    type === "electricity" ? "text-violet-300" :
                                                                                    type === "toxin" ? "text-emerald-300" :
                                                                                    type === "slash" ? "text-red-300" :
                                                                                    type === "puncture" ? "text-yellow-100" :
                                                                                    type === "impact" ? "text-blue-300" :
                                                                                    "text-sky-200/80",
                                                                                ].join(" ")}
                                                                            />
                                                                        );
                                                                    })}
                                                                <div className="pt-1 text-base">
                                                                    <InlineStatRow
                                                                        label="Arsenal Total"
                                                                        value={fmt(activeMetrics.modded.arsenalDamage, 1)}
                                                                        tooltip={BASIC_STAT_TOOLTIPS.totalDamage}
                                                                        labelClassName="text-sky-100"
                                                                    />
                                                                </div>
                                                                {activeCalcWeapon?.selectedAttackUsesMeleeComboMultiplier && (
                                                                    <div role="note" className="mt-2 rounded-md border border-slate-700/70 bg-slate-900/40 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                                                                        <div className="font-semibold text-slate-200">After one Heavy Attack</div>
                                                                        <div>
                                                                            {fmt(activeMetrics.modded.meleeComboPointsBeforeHeavyAttack, 1)} combo points × {fmt(activeMetrics.modded.heavyAttackEfficiency * 100, 1)}% efficiency = {fmt(activeMetrics.modded.meleeComboPointsAfterHeavyAttack, 1)} retained points ({fmt(activeMetrics.modded.meleeComboMultiplierAfterHeavyAttack, 0)}× tier).
                                                                        </div>
                                                                        <div className="text-slate-500">Uses the minimum points for the entered tier unless Initial Combo supplies the active tier. The direct-hit TTK applies retention and 40 points/s Initial Combo recovery; it excludes combo gained by the attack. DPS, finite status encounter, and optimizer scoring still hold the starting tier.</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {infoTab === "why" && (
                                                    <div className="space-y-3">
                                                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-3 space-y-2">
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Score assumptions</div>
                                                            <div className="grid gap-x-4 gap-y-1.5 text-[10px] text-slate-400 sm:grid-cols-2">
                                                                <div><span className="text-slate-500">Objective:</span> {GOAL_OPTIONS.find((option) => option.key === goal)?.label ?? goal}</div>
                                                                <div><span className="text-slate-500">Target:</span> {activeTargetSummary}</div>
                                                                <div><span className="text-slate-500">Attack:</span> {weapon.attacks[selectedAttackIdx]?.name ?? "Normal attack"}</div>
                                                                {activeWeaponState?.appliedIncarnonOptions.length ? (
                                                                    <div className="sm:col-span-2">
                                                                        <span className="text-slate-500">Incarnon path:</span> {activeWeaponState.appliedIncarnonOptions.map((option) => option.name).join(" · ")} · modeled effects only
                                                                    </div>
                                                                ) : null}
                                                                {activeIncarnonUnsupportedLines.length > 0 && (
                                                                    <div className="sm:col-span-2 text-amber-200">
                                                                        <span className="font-semibold">Incarnon effects excluded from this score:</span> {activeIncarnonUnsupportedLines.join(" · ")}
                                                                    </div>
                                                                )}
                                                                <div><span className="text-slate-500">Conditional state:</span> {conditionalState.mode}</div>
                                                                {externalStatusTypeCount > 0 && (
                                                                    <div><span className="text-slate-500">Condition Overload status assumption:</span> {externalStatusTypeCount} additional distinct types maintained throughout the encounter (maximum 16 total)</div>
                                                                )}
                                                                {usesMeleeDamageModel(weapon.category) && (
                                                                    <div><span className="text-slate-500">Melee combo:</span> {fmt(activeMetrics?.modded.meleeComboMultiplier ?? 1, 0)}× for combo-scaled mods</div>
                                                                )}
                                                                {activeMetrics && (
                                                                    <>
                                                                        <div><span className="text-slate-500">Selected-state fresh-target crit:</span> {fmt((activeMetrics?.modded.critChance ?? 0) * 100, 1)}% at {fmt(activeMetrics?.modded.critMultiplier ?? 1, 2)}× · expected tier {fmt(activeMetrics?.modded.averageCritTier ?? 0, 2)}</div>
                                                                        <div><span className="text-slate-500">Selected-state direct/attack:</span> {fmt(activeMetrics?.modded.averageShotDamage ?? 0)} mean damage before target pools</div>
                                                                        {activeTargetAttackDamage && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Selected-state damage to initial pools:</span>{" "}
                                                                                {fmt(activeTargetAttackDamage.totalDamage)} capped mean damage/attack · {activeTargetAttackDamage.activePool}{" "}
                                                                                (Overguard {fmt(activeTargetAttackDamage.damageByPool.overguard)}, Shields {fmt(activeTargetAttackDamage.damageByPool.shields)}, Health {fmt(activeTargetAttackDamage.damageByPool.health)})
                                                                            </div>
                                                                        )}
                                                                        {activeTargetAttackSequence && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Selected-state direct-hit sequence:</span>{" "}
                                                                                {activeTargetAttackSequence.attacksToKill === null
                                                                                    ? "not killable with the current direct-hit damage"
                                                                                    : `${fmt(activeTargetAttackSequence.attacksToKill, 0)} attacks · ${fmt(activeTargetAttackSequence.timeToKillSeconds ?? 0, 2)}s from first attack`}{" "}
                                                                                {activeTargetAttackSequence.comboMultiplierAtStart !== undefined && activeTargetAttackSequence.comboMultiplierAtKill !== undefined
                                                                                    ? `· heavy-attack combo ${fmt(activeTargetAttackSequence.comboMultiplierAtStart, 0)}× → ${fmt(activeTargetAttackSequence.comboMultiplierAtKill, 0)}× · `
                                                                                    : ""}
                                                                                (mean damage per attack, ordered pool depletion, static target defenses; applies the selected enemy Shield Gate mode after Shields break, but excludes status ticks and shield regeneration)
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Expected finite encounter:</span>{" "}
                                                                                {activeTargetEncounter.timeToKillSeconds === null
                                                                                    ? "not defeated within " + fmt(activeTargetEncounter.evaluatedDurationSeconds, 1) + "s / " + fmt(activeTargetEncounter.attacks, 0) + " attacks"
                                                                                    : fmt(activeTargetEncounter.timeToKillSeconds, 2) + "s · " + fmt(activeTargetEncounter.attacks, 0) + " attacks"}{" "}
                                                                                · {fmt(activeTargetEncounter.damagePerSecond)} damage/s · direct {fmt(activeTargetEncounter.directDamageByPool.health + activeTargetEncounter.directDamageByPool.shields + activeTargetEncounter.directDamageByPool.overguard)} + status {fmt(activeTargetEncounter.statusDamageByPool.health + activeTargetEncounter.statusDamageByPool.shields + activeTargetEncounter.statusDamageByPool.overguard)} damage
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && activeTargetEncounter.blastCollateralEnemyCount > 0 && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Blast radial collateral:</span>{" "}
                                                                                {fmt(activeTargetEncounter.blastCollateralDamageByPool.health + activeTargetEncounter.blastCollateralDamageByPool.shields + activeTargetEncounter.blastCollateralDamageByPool.overguard)} aggregate damage across {activeTargetEncounter.blastCollateralEnemyCount} configured nearby target{activeTargetEncounter.blastCollateralEnemyCount === 1 ? "" : "s"}. This is reported separately and does not change the primary target's TTK.
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && activeTargetEncounter.electricGasCollateralEnemyCount > 0 && (
                                                                            <div className="sm:col-span-2">
                                                                                <span className="text-slate-500">Electricity/Gas collateral:</span>{" "}
                                                                                {fmt(activeTargetEncounter.electricGasCollateralDamageByPool.health + activeTargetEncounter.electricGasCollateralDamageByPool.shields + activeTargetEncounter.electricGasCollateralDamageByPool.overguard)} aggregate scheduled tick damage across {activeTargetEncounter.electricGasCollateralEnemyCount} configured nearby target{activeTargetEncounter.electricGasCollateralEnemyCount === 1 ? "" : "s"}. Gas ticks continue after the primary target dies; collateral does not change its TTK.
                                                                            </div>
                                                                        )}
                                                                        {activeTargetEncounter && (
                                                                            <div className="sm:col-span-2"><span className="text-slate-500">Expected status applications in encounter:</span> {activeEncounterStatusSummary}</div>
                                                                        )}
                                                                        <div><span className="text-slate-500">Burst / sustained:</span> {fmt(activeMetrics.burstDPS)} / {fmt(activeMetrics.sustainedDPS)} DPS before target pools</div>
                                                                        <div><span className="text-slate-500">DoT:</span> {fmt(activeMetrics.modded.dotDps)} DPS steady-state estimate</div>
                                                                        <div className="sm:col-span-2"><span className="text-slate-500">Proc mix after immunity:</span> {activeProcMixLabel}</div>
                                                                    </>
                                                                )}
                                                                <div className="sm:col-span-2"><span className="text-slate-500">Modeled pools:</span> Health {fmt(activeTargetAssumptions.health, 0)} ({fmt(activeTargetAssumptions.healthShare * 100, 1)}%) · Shields {fmt(activeTargetAssumptions.shields, 0)} ({fmt(activeTargetAssumptions.shieldShare * 100, 1)}%) · Overguard {fmt(activeTargetAssumptions.overguard, 0)} ({fmt(activeTargetAssumptions.overguardShare * 100, 1)}%) · Armor {fmt(activeTargetAssumptions.armor, 0)} · Total {fmt(activeTargetAssumptions.effectiveHealth, 0)}</div>
                                                                <div className="sm:col-span-2"><span className="text-slate-500">Status immunities:</span> {activeTargetAssumptions.statusImmuneTypes.map((type) => `${type[0].toUpperCase()}${type.slice(1)}`).join(", ") || "None"} · Stack caps {Object.entries(activeTargetAssumptions.statusStackCaps).map(([type, cap]) => `${type} ${cap}`).join(", ") || "standard"} · Toxin shield bypass {activeTargetAssumptions.toxinBypassesShields ? "enabled" : "disabled"} · {activeTargetAssumptions.grouped ? "grouped target estimate" : "single target estimate"}{activeTargetAssumptions.crowdControlImmune ? " · CC immune" : ""}</div>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500">The selected-state one-hit estimate uses minimum attack-ramp damage when the selected weapon has a ramp. The direct-hit sequence starts cold and advances its ramp per attack; for selected heavy attacks it also applies combo consumption, supported Heavy Attack Efficiency, and 40 points/s Initial Combo recovery. It does not model attack-generated combo, Tennokai, stance sequences, or heavy-attack wind-up. The finite encounter keeps the starting combo tier and starts with no weapon-generated status stacks, then applies the selected conditional-state estimate and processes expected attacks and scheduled DoT ticks in event order. It updates Heat/Corrosive armor strip, Viral/Magnetic/Cold/Puncture/Tau state and proc eligibility as target pools deplete. Condition Overload uses weapon statuses active before each hit plus the user-entered external-status count. Fractional proc applications remain mean-field estimates; the selected 0.1 s enemy Shield Gate applies to direct hits while status ticks ignore it, and shield regeneration, attenuation, projectile travel, neighbor status histories, chain geometry, Gas radius growth, and melee stance hit timing remain unsupported.</p>
                                                        </div>
                                                        {displayedReasoning ? (
                                                            <>
                                                                <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 px-3 py-2.5 space-y-1">
                                                                    <div className="text-[10px] uppercase tracking-wide text-sky-300">Why this build won in the selected model</div>
                                                                    <p className="text-[11px] text-slate-300">{displayedReasoning.summary}</p>
                                                                    <p className="text-[10px] text-slate-400">{displayedReasoning.winningEdge}</p>
                                                                    <p className="text-[10px] text-slate-500">{displayedReasoning.comparisonNote}</p>
                                                                </div>
                                                                {displayedReasoning.arcaneStep && (
                                                                    <div className="rounded-lg bg-violet-950/20 border border-violet-900/40 px-3 py-2">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-xs font-semibold text-violet-200">Arcane · {displayedReasoning.arcaneStep.name}</span>
                                                                            <span className={`text-[10px] font-mono shrink-0 ${displayedReasoning.arcaneStep.delta >= 0 ? "text-green-400" : "text-rose-400"}`}>
                                                                                {displayedReasoning.arcaneStep.delta >= 0 ? "+" : ""}{displayedReasoning.arcaneStep.pctGain.toFixed(1)}%
                                                                            </span>
                                                                        </div>
                                                                        <p className="mt-1 text-[10px] text-slate-500">{displayedReasoning.arcaneStep.why} This is a separate leave-one-out score change; it overlaps with mod synergies.</p>
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1.5">
                                                                    {displayedReasoning.steps.map((step, i) => (
                                                                        <div key={i} className="rounded-lg bg-slate-900/50 border border-slate-800/50 px-3 py-2">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className="text-xs font-semibold text-slate-200">{step.modName}</span>
                                                                                <span className={`text-[10px] font-mono shrink-0 ${step.delta >= 0 ? "text-green-400" : "text-rose-400"}`}>
                                                                                    {step.delta >= 0 ? "+" : ""}{step.pctGain.toFixed(1)}%
                                                                                </span>
                                                                            </div>
                                                                            <p className="mt-1 text-[10px] text-slate-500">{step.why}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        ) : reasoning ? (
                                                            <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-3 text-[11px] text-amber-200/80">
                                                                Planner assumptions changed since this build was optimized. Run the optimizer again to refresh its score and explanation.
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-3 py-3 text-[11px] text-slate-500">
                                                                Run the optimizer to generate or refresh build reasoning for the current settings.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mod Configuration</div>
                                                <div className="text-sm text-slate-300">
                                                    {supportsStanceLikeMods(weapon)
                                                        ? "8 standard slots, plus stance/exilus/arcane support."
                                                        : "8 standard slots, plus exilus/arcane support where the weapon type allows it."}
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-slate-500">{slots.filter(Boolean).length}/{SLOT_COUNT} slots filled</div>
                                        </div>

                                        <div className="space-y-3">
                                            {supportsStanceLikeMods(weapon) ? (
                                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3">
                                                            <div className="hidden 2xl:block" />
                                                            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 2xl:col-start-2">
                                                                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                                                                    <span>Stance</span>
                                                                    <PolarityPicker value={stancePol} onChange={setStancePol} />
                                                                </div>
                                                                {stanceMods.length > 0 ? (
                                                                    <ModSlot index={0} label="Stance" mod={stanceMod} rank={stanceRank}
                                                                        slotPolarity={stancePol} compatMods={stanceMods}
                                                                        usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                        excluded={excluded}
                                                                        locked={!!fixedStanceMod}
                                                                        onChange={(_, m) => { setStanceMod(m); setStanceRank(m ? m.fusionLimit : 0); }}
                                                                        onRankChange={(_, r) => setStanceRank(r)}
                                                                        onPolarityChange={(_, p) => setStancePol(p)}
                                                                        onToggleExclude={toggleExclude}
                                                                        effDrain={stanceMod ? effectiveDrain(stanceMod, stancePol, stanceRank) : 0}
                                                                        compactEmpty={true} />
                                                                ) : (
                                                                    <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-[11px] text-slate-600">
                                                                        No stance slot available.
                                                                    </div>
                                                                )}
                                                                {fixedStanceMod && (
                                                                    <div className="mt-2 text-[10px] text-slate-500">
                                                                        This exalted weapon uses a permanent built-in stance.
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 2xl:col-start-3">
                                                                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                                                                    <span>Exilus</span>
                                                                    <button onClick={() => { setHasExilus(v => !v); if (hasExilus) { setExilusMod(null); setExilusRank(0); } }}
                                                                        className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] text-slate-300">
                                                                        {hasExilus ? "Installed" : "Unlock"}
                                                                    </button>
                                                                </div>
                                                                {hasExilus ? (
                                                                    <ModSlot index={0} label="Exilus" mod={exilusMod} rank={exilusRank}
                                                                        slotPolarity={exilusPol} compatMods={compatMods}
                                                                        usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                        isExilusSlot={true}
                                                                        excluded={excluded}
                                                                        onChange={handleExilusChange}
                                                                        onRankChange={(_, r) => setExilusRank(r)}
                                                                        onPolarityChange={(_, p) => setExilusPol(p)}
                                                                        onToggleExclude={toggleExclude}
                                                                    effDrain={exilusMod ? effectiveDrain(exilusMod, exilusPol, exilusRank) : 0}
                                                                    compactEmpty={true}
                                                                    draggable={!!exilusMod}
                                                                    isDragOver={dragOverSlot?.kind === "exilus"}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "exilus", index: 0 })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "exilus", index: 0 }) ? { kind: "exilus", index: 0 } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "exilus", index: 0 })} />
                                                                ) : (
                                                                    <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-[11px] text-slate-600">
                                                                        Requires an Exilus Adapter.
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="hidden 2xl:block" />
                                                        </div>
                                                        <div className="grid auto-rows-[minmax(216px,auto)] grid-cols-2 2xl:grid-cols-4 gap-3">
                                                            {slots.map((mod, i) => (
                                                                <ModSlot key={i} index={i} mod={mod} rank={ranks[i] ?? 0}
                                                                    slotPolarity={slotPols[i] ?? ""} compatMods={compatMods}
                                                                    usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                    excluded={excluded}
                                                                    onChange={handleSlotChange} onRankChange={handleRankChange}
                                                                    onPolarityChange={handlePolChange}
                                                                    onToggleExclude={toggleExclude}
                                                                    effDrain={mod ? effectiveDrain(mod, slotPols[i] ?? "", ranks[i]) : 0}
                                                                    draggable={!!mod}
                                                                    isDragOver={dragOverSlot?.kind === "main" && dragOverSlot.index === i}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "main", index: i })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "main", index: i }) ? { kind: "main", index: i } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "main", index: i })} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 self-start">
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Arcane</div>
                                                            {arcane1 && (
                                                                <button
                                                                    onClick={() => setIncludeArcaneStats(v => !v)}
                                                                    className={[
                                                                        "rounded-full border px-2 py-0.5 text-[9px] transition-colors",
                                                                        includeArcaneStats
                                                                            ? "border-violet-700/60 bg-violet-950/30 text-violet-300"
                                                                            : "border-slate-700 text-slate-500",
                                                                    ].join(" ")}
                                                                >
                                                                    {includeArcaneStats ? "Stats On" : "Stats Off"}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <ArcaneSlot label="Arcane Enhancement" arcane={arcane1} rank={arcane1Rank}
                                                            onChange={setArcane1} onRankChange={setArcane1Rank}
                                                            availableArcanes={weaponArcanes} />
                                                        {weaponArcanes.some((arcane) => !!arcane.armorScaledWeaponDamage) && (
                                                            <div className="mt-2 space-y-1.5 rounded-lg border border-violet-900/50 bg-violet-950/15 p-2">
                                                                <label htmlFor="warframe-armor-input" className="block text-[10px] font-semibold text-slate-300">Warframe Armor · Primary Bulwark</label>
                                                                <input
                                                                    id="warframe-armor-input"
                                                                    aria-label="Warframe Armor for Primary Bulwark"
                                                                    type="number"
                                                                    min={0}
                                                                    max={10000}
                                                                    step={1}
                                                                    value={warframeArmorInput}
                                                                    onChange={(event) => setWarframeArmorInput(event.target.value)}
                                                                    placeholder="Enter armor to model Bulwark"
                                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                                                                />
                                                                <p className="text-[9px] leading-relaxed text-slate-500">Damage scales from armor above 1,000 and caps at 1,500. The value is saved with this planner build.</p>
                                                                {(arcane1?.armorScaledWeaponDamage || optArcane) && warframeArmor === undefined && (
                                                                    <p role="status" className="text-[9px] leading-relaxed text-amber-300">Primary Bulwark is not calculated or considered by Auto Optimize until Warframe Armor is entered.</p>
                                                                )}
                                                                {arcane1?.armorScaledWeaponDamage && warframeArmor !== undefined && (
                                                                    <p className="text-[9px] text-violet-300">Selected rank bonus: +{(((getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor)?.damageBonus ?? 0) * 100).toFixed(1))}% base weapon damage.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                        {warframeEnergyArcanePanel}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                                                    <div className="space-y-3">
                                                        <div className="grid auto-rows-[minmax(216px,auto)] grid-cols-2 2xl:grid-cols-4 gap-3">
                                                            {slots.map((mod, i) => (
                                                                <ModSlot key={i} index={i} mod={mod} rank={ranks[i] ?? 0}
                                                                    slotPolarity={slotPols[i] ?? ""} compatMods={compatMods}
                                                                    usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                    excluded={excluded}
                                                                    onChange={handleSlotChange} onRankChange={handleRankChange}
                                                                    onPolarityChange={handlePolChange}
                                                                    onToggleExclude={toggleExclude}
                                                                    effDrain={mod ? effectiveDrain(mod, slotPols[i] ?? "", ranks[i]) : 0}
                                                                    draggable={!!mod}
                                                                    isDragOver={dragOverSlot?.kind === "main" && dragOverSlot.index === i}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "main", index: i })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "main", index: i }) ? { kind: "main", index: i } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "main", index: i })} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex min-h-[435px] flex-col justify-center gap-3">
                                                        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <div className="text-[10px] uppercase tracking-wide text-slate-500">Arcane</div>
                                                                {arcane1 && (
                                                                    <button
                                                                        onClick={() => setIncludeArcaneStats(v => !v)}
                                                                        className={[
                                                                            "rounded-full border px-2 py-0.5 text-[9px] transition-colors",
                                                                            includeArcaneStats
                                                                                ? "border-violet-700/60 bg-violet-950/30 text-violet-300"
                                                                                : "border-slate-700 text-slate-500",
                                                                        ].join(" ")}
                                                                    >
                                                                        {includeArcaneStats ? "Stats On" : "Stats Off"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <ArcaneSlot label="Arcane Enhancement" arcane={arcane1} rank={arcane1Rank}
                                                                onChange={setArcane1} onRankChange={setArcane1Rank}
                                                                availableArcanes={weaponArcanes} />
                                                            {weaponArcanes.some((arcane) => !!arcane.armorScaledWeaponDamage) && (
                                                                <div className="mt-2 space-y-1.5 rounded-lg border border-violet-900/50 bg-violet-950/15 p-2">
                                                                    <label htmlFor="warframe-armor-input" className="block text-[10px] font-semibold text-slate-300">Warframe Armor · Primary Bulwark</label>
                                                                    <input
                                                                        id="warframe-armor-input"
                                                                        aria-label="Warframe Armor for Primary Bulwark"
                                                                        type="number"
                                                                        min={0}
                                                                        max={10000}
                                                                        step={1}
                                                                        value={warframeArmorInput}
                                                                        onChange={(event) => setWarframeArmorInput(event.target.value)}
                                                                        placeholder="Enter armor to model Bulwark"
                                                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                                                                    />
                                                                    <p className="text-[9px] leading-relaxed text-slate-500">Damage scales from armor above 1,000 and caps at 1,500. The value is saved with this planner build.</p>
                                                                    {(arcane1?.armorScaledWeaponDamage || optArcane) && warframeArmor === undefined && (
                                                                        <p role="status" className="text-[9px] leading-relaxed text-amber-300">Primary Bulwark is not calculated or considered by Auto Optimize until Warframe Armor is entered.</p>
                                                                    )}
                                                                    {arcane1?.armorScaledWeaponDamage && warframeArmor !== undefined && (
                                                                        <p className="text-[9px] text-violet-300">Selected rank bonus: +{(((getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor)?.damageBonus ?? 0) * 100).toFixed(1))}% base weapon damage.</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {warframeEnergyArcanePanel}
                                                        </div>
                                                        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
                                                            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                                                                <span>Exilus</span>
                                                                <button onClick={() => { setHasExilus(v => !v); if (hasExilus) { setExilusMod(null); setExilusRank(0); } }}
                                                                    className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] text-slate-300">
                                                                    {hasExilus ? "Installed" : "Unlock"}
                                                                </button>
                                                            </div>
                                                            {hasExilus ? (
                                                                <ModSlot index={0} label="Exilus" mod={exilusMod} rank={exilusRank}
                                                                    slotPolarity={exilusPol} compatMods={compatMods}
                                                                    usedGroups={usedGroups} ownedUniqueNames={ownedSet} onlyOwned={false}
                                                                    isExilusSlot={true}
                                                                    excluded={excluded}
                                                                    onChange={handleExilusChange}
                                                                    onRankChange={(_, r) => setExilusRank(r)}
                                                                    onPolarityChange={(_, p) => setExilusPol(p)}
                                                                    onToggleExclude={toggleExclude}
                                                                    effDrain={exilusMod ? effectiveDrain(exilusMod, exilusPol, exilusRank) : 0}
                                                                    compactEmpty={true}
                                                                    draggable={!!exilusMod}
                                                                    isDragOver={dragOverSlot?.kind === "exilus"}
                                                                    onDragStartSlot={() => setDraggedSlot({ kind: "exilus", index: 0 })}
                                                                    onDragEndSlot={() => { setDraggedSlot(null); setDragOverSlot(null); }}
                                                                    onDragOverSlot={() => setDragOverSlot(canSwapSlots(draggedSlot, { kind: "exilus", index: 0 }) ? { kind: "exilus", index: 0 } : null)}
                                                                    onDropSlot={() => handleDropSwap({ kind: "exilus", index: 0 })} />
                                                            ) : (
                                                                <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-[11px] text-slate-600">
                                                                    Requires an Exilus Adapter.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="text-[10px] text-slate-500">
                                                Rivens are configured by selecting a Riven from any standard mod slot.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ) : (
                                    <div className="p-6 text-center text-slate-500 text-sm">
                                        Choose a weapon from the Arsenal header to start building.
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                                    <div className="text-sm font-semibold mb-3">Advanced Analysis</div>
                                    {(() => {
                                if (!weapon) return null;

                                // Build the full mod effects list (slots + exilus + arcane)
                                const buildEffects = allSlotsForCap.map((mod, i) => {
                                    if (!mod) return null;
                                    const r = allRanksForCap[i] ?? mod.fusionLimit;
                                    return mod.effectsByRank[r] ?? mod.effect;
                                });
                                const buildEffectSourceLabels = allSlotsForCap.map((mod, i) => {
                                    if (!mod) return `slot ${i + 1}`;
                                    if (i < SLOT_COUNT) return `${getBuilderDisplayModName(mod)} (slot ${i + 1})`;
                                    return `${getBuilderDisplayModName(mod)} (exilus)`;
                                });
                                if (includeArcaneStats && arcane1) {
                                    const ae = getArcaneEffectAtRank(arcane1, arcane1Rank, warframeArmor, true, arcaneEnergyContext);
                                    if (ae) buildEffects.push({
                                        ...emptyEffect(),
                                        ...ae,
                                        conditionalEffects: [...(ae.conditionalEffects ?? [])],
                                    });
                                    buildEffectSourceLabels.push(`${arcane1.name} (arcane)`);
                                }

                                // Helper: compute metrics for any attack (or base weapon)
                                const calcForAttack = (atkIdx: number) => {
                                    const attackWeapon = makeSelectedAttackWeapon(weapon, atkIdx);
                                    return calculateBuild(attackWeapon, buildEffects, factionOn ? faction : "", {
                                        conditionalState,
                                        statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
                                        statusStackCaps: targetProfileOverride?.statusStackCaps,
                                    });
                                };
                                // Damage type rows for a given damage object
                                const dmgRows = (d: Record<string, number>) => [
                                    { k: "impact",      l: "Impact",   v: d.impact },
                                    { k: "puncture",    l: "Punct",    v: d.puncture },
                                    { k: "slash",       l: "Slash",    v: d.slash },
                                    { k: "heat",        l: "Heat",     v: d.heat },
                                    { k: "cold",        l: "Cold",     v: d.cold },
                                    { k: "electricity", l: "Elec",     v: d.electricity },
                                    { k: "toxin",       l: "Toxin",    v: d.toxin },
                                    { k: "blast",       l: "Blast",    v: d.blast },
                                    { k: "radiation",   l: "Rad",      v: d.radiation },
                                    { k: "gas",         l: "Gas",      v: d.gas },
                                    { k: "magnetic",    l: "Mag",      v: d.magnetic },
                                    { k: "viral",       l: "Viral",    v: d.viral },
                                    { k: "corrosive",   l: "Corr",     v: d.corrosive },
                                    { k: "void",        l: "Void",     v: d.void },
                                    { k: "tau",         l: "Tau",      v: d.tau },
                                    { k: "true",        l: "True",     v: d.true },
                                ].filter(e => e.v > 0);

                                // Render stats for a single attack
                                const renderAttackStats = (atkIdx: number, label?: string) => {
                                    const result = calcForAttack(atkIdx);
                                    const stats  = result.modded;
                                    const atk    = weapon.attacks[atkIdx];
                                    const damageUnit = actionUnitLabel(weapon.category);
                                    const damageUnitLabel = damageUnit[0].toUpperCase() + damageUnit.slice(1);
                                    const avgDamageLabel = averageDamageLabel(weapon.category);
                                    const rateLabel = actionRateLabel(weapon.category);
                                    const dmgSrc = stats.rawDamageBreakdown;
                                    const procChanceRows = dmgRows(stats.procChanceByType as Record<string, number>);
                                    const procRateRows = dmgRows(stats.procRatePerSecondByType as Record<string, number>);
                                    const stackRows = dmgRows(stats.expectedStacksByType as Record<string, number>);
                                    const dotShotRows = dmgRows(stats.dotDamagePerShotByType as Record<string, number>);
                                    const dotDpsRows = dmgRows(stats.dotDpsByType as Record<string, number>);
                                    const extraProcRows = dmgRows(stats.extraProcsPerShot as Record<string, number>);
                                    const forcedProcRows = dmgRows(stats.forcedProcsPerShot as Record<string, number>);
                                    const forcedProcCounts = new Map(forcedProcRows.map((row) => [row.k, row.v]));
                                    const bonusProcRows = extraProcRows
                                        .map((row) => ({ ...row, v: Math.max(0, row.v - (forcedProcCounts.get(row.k) ?? 0)) }))
                                        .filter((row) => row.v > 0);
                                    const allMetricBadges = [
                                        { label: "Direct Damage", value: fmt(stats.totalDamage), sub: "post-quantization", tooltip: "Final direct damage after damage construction and Warframe's damage quantization step, before crit and multishot." },
                                        { label: "Arsenal Total", value: fmt(stats.arsenalDamage), sub: `per ${damageUnit}, no crit`, tooltip: `Unquantized Arsenal Total Damage after multishot for one ${damageUnit}, before crit weighting. Target modifiers and mission rounding are not included.` },
                                        { label: avgDamageLabel, value: fmt(stats.averageShotDamage), sub: "crit-weighted", tooltip: `Expected damage per ${damageUnit} after weighting in crit chance and crit multiplier.` },
                                        ...(stats.firstShotMagazineDamageBonus > 0
                                            ? [{ label: "First shot", value: fmt(stats.averageShotDamage * stats.firstShotMagazineDamageMultiplier), sub: "after reload", tooltip: `Expected direct damage for the first ammo-consuming shot in a fresh magazine, including first-shot Chamber mods and crit weighting. Later shots use the ordinary per-${damageUnit} damage above.` }]
                                            : []),
                                        { label: "Burst DPS", value: fmt(result.burstDPS), sub: "fresh magazine", tooltip: "Damage per second while attacking through a fresh magazine without reload downtime. Verified attack ramps are averaged across that magazine." },
                                        { label: "Sustained DPS", value: fmt(result.sustainedDPS), sub: stats.infiniteAmmoActive ? "Gale Force maintained" : "with reload", tooltip: stats.infiniteAmmoActive ? "Damage per second assumes Gale Force stays active, so no reload downtime or recurring first-shot Chamber bonus is applied." : "Damage per second including reload downtime and the stable attack-ramp level across repeated magazines when applicable." },
                                        { label: `DoT / ${damageUnitLabel}`, value: fmt(stats.dotDamagePerShot), sub: "full-life estimate", tooltip: `Expected status damage-over-time contributed by one ${damageUnit} if the target survives for every proc's full duration. This is not damage delivered before a target dies.` },
                                        { label: "DoT DPS", value: fmt(stats.dotDps), sub: "steady-state estimate", tooltip: "Estimated DoT damage per second against a target that survives long enough for status stacks to reach steady state. Ramp-enabled attacks assume fully warmed damage for this long-run estimate; the expected encounter scales each proc seed by its attack-time ramp." },
                                        {
                                            label: "Crit Chance",
                                            value: fmt(stats.critChance * 100, 1) + "%",
                                            highlight: stats.critChance >= 1,
                                            sub: stats.critChance > 1 ? (stats.critChance >= 2 ? "orange guaranteed" : "yellow guaranteed") : undefined,
                                            tooltip:
                                                stats.critChance >= 2
                                                    ? `Guaranteed orange crits. ${fmt((stats.critChance - Math.floor(stats.critChance)) * 100, 0)}% chance for red crit per ${damageUnit}.`
                                                    : stats.critChance >= 1
                                                        ? `Guaranteed yellow crits. ${fmt((stats.critChance - 1) * 100, 0)}% chance for orange crit per ${damageUnit}.`
                                                        : undefined,
                                        },
                                        { label: "Crit Multiplier", value: stats.critMultiplier.toFixed(2) + "x", sub: "yellow crit", tooltip: "Damage multiplier applied when a standard yellow crit occurs." },
                                        { label: "Avg Crit Tier", value: stats.averageCritTier.toFixed(2) + "x", sub: "expected crit level", tooltip: "Expected crit level per hit. 0.55x means you average 0.55 crit tiers per hit, such as roughly a 55% chance to land a yellow crit." },
                                        {
                                            label: "Status Chance",
                                            value: fmt(stats.statusChance * 100, 1) + "%",
                                            tooltip: `Chance per pellet/projectile to trigger a status effect. Over 100% = multiple procs per ${damageUnit}.`,
                                        },
                                        {
                                            label: "Multishot",
                                            value: stats.multishot.toFixed(2) + "x",
                                            tooltip: usesHitTerminology(weapon.category) ? "Additional hit instances created by the attack. Each hit rolls status independently." : "Projectiles per trigger pull. Each pellet rolls status independently.",
                                        },
                                        {
                                            label: rateLabel,
                                            value: stats.fireRate.toFixed(3) + "/s",
                                            tooltip: stats.chargeTimeSeconds !== null
                                                ? `Charge time = ${stats.ammoCostPerShot.toFixed(2)} ammo ÷ ${(weapon.selectedAttackChargeAmmoPerSecond ?? 0).toFixed(2)} ammo/s = ${stats.chargeTimeSeconds.toFixed(3)}s. Effective rate is capped by both this fixed charge time and the weapon's fire-rate cadence; fire-rate mods do not change the ammo charge rate.`
                                                : weapon.weaponType.trim().toLowerCase() === "bow"
                                                    ? "Bow repeating rate uses 1 ÷ (modded charge time + modded reload time); an uncharged shot uses zero charge time. Fire-rate mods speed the charge and reload-speed mods shorten the post-shot delay. Charged-shot Burst DPS excludes that post-shot reload."
                                                    : atk?.chargeTime != null
                                                    ? `Effective rate = 1 / (${atk.chargeTime.toFixed(2)}s charge + ${(1 / weapon.fireRate).toFixed(2)}s delay). Fire rate mods also speed up charge time.`
                                                : usesHitTerminology(weapon.category) ? "Attacks per second." : "Shots per second.",
                                        },
                                        { label: "Magazine", value: displayMagazineValue(weapon, stats.magazineSize), tooltip: usesHitTerminology(weapon.category) ? "Melee weapons do not use magazines, so this stays at the weapon's effective default value." : "Rounds available before reloading." },
                                        ...(!usesHitTerminology(weapon.category) && !weapon.isExalted ? [{ label: "Ammo Efficiency", value: fmt(stats.ammoEfficiencyBonus * 100, 1) + "%", tooltip: "Ordinary additive ammo-efficiency bonuses, capped at 75%. Fractional ammo is accumulated between shots; transformed Incarnon attacks ignore ammo efficiency. Perigale's Gale Force is modeled separately as infinite ammo when assumed maintained." }] : []),
                                        ...(weapon.hasGaleForceAmmoPassive ? [{
                                            label: "Gale Force",
                                            value: stats.infiniteAmmoActive ? "Active" : "Inactive",
                                            sub: stats.infiniteAmmoActive ? "infinite ammo assumed" : "scenario assumption",
                                            tooltip: "Gale Force's headshot/kill trigger and 4-second refresh timing are not simulated. Fully stacked or Custom with at least one maintained stack assumes it stays active; then reloads and first-shot Chamber bonuses are disabled.",
                                        }] : []),
                                        {
                                            label: weapon.weaponType.trim().toLowerCase() === "bow" ? "Shots / Cycle" : "Shots / Mag",
                                            value: stats.infiniteAmmoActive ? "∞" : fmt(stats.shotsPerMag, 2),
                                            sub: stats.infiniteAmmoActive ? "while Gale Force is maintained" : weapon.weaponType.trim().toLowerCase() === "bow" ? "per arrow cycle" : "before reload",
                                            tooltip: weapon.weaponType.trim().toLowerCase() === "bow"
                                                ? "Bow attacks fire one arrow per charge/reload cycle. The repeating bow rate already includes this cycle, so it is not counted again as magazine downtime."
                                                : stats.infiniteAmmoActive
                                                    ? "Gale Force is assumed maintained, so ammo does not run out and no reload occurs."
                                                : usesHitTerminology(weapon.category)
                                                    ? "Effective attack count before any reload-like interruption. For melee this is mostly a placeholder value."
                                                    : "Number of trigger pulls available before reloading.",
                                        },
                                        { label: "Reload", value: stats.infiniteAmmoActive ? "None" : stats.reloadTime.toFixed(2) + "s", tooltip: stats.infiniteAmmoActive ? "No reload occurs while Gale Force's infinite-ammo buff is assumed maintained." : usesHitTerminology(weapon.category) ? "Melee weapons do not reload, so this should normally remain at 0." : "Time needed to refill the magazine." },
                                        {
                                            label: `Avg Procs/${damageUnitLabel}`,
                                            value: fmt(stats.averageProcsPerShot, 2),
                                            tooltip: `Expected status applications per ${damageUnit}. Base ordinary rolls are Multishot × Status Chance; active Tau vulnerability increases other status effects, and forced/status-triggered applications are added separately.`,
                                        },
                                        ...(atk?.uniqueStatusProcs?.length ? [{
                                            label: "Unique Status",
                                            value: atk.uniqueStatusProcs.join(", "),
                                            sub: "Galvanized / CO count",
                                            tooltip: "This guaranteed non-damage status adds one unique type for Galvanized direct-damage and Condition Overload effects. The finite encounter applies it after the first hit; special enemy immunity exceptions are not modeled.",
                                        }] : []),
                                    ];
                                    const statusEffectBadges = [
                                        { label: "Viral Health", value: fmt(stats.viralHealthDamageBonus * 100, 0) + "%", sub: "health damage", tooltip: "Extra damage dealt to health from current Viral stacks." },
                                        { label: "Heat Armor Strip", value: fmt(stats.heatArmorStrip * 100, 0) + "%", sub: "armor removed", tooltip: "Armor removed by Heat status effects." },
                                        { label: "Corrosive Strip", value: fmt(stats.corrosiveArmorStrip * 100, 0) + "%", sub: "armor removed", tooltip: "Armor removed by Corrosive status stacks." },
                                        { label: "Magnetic Shield", value: fmt(stats.magneticShieldDamageBonus * 100, 0) + "%", sub: "shield damage", tooltip: "Extra damage dealt to shields and overguard from Magnetic stacks." },
                                        { label: "Radiation Ally Dmg", value: fmt(stats.radiationAllyDamageBonus * 100, 0) + "%", sub: "friendly fire bonus", tooltip: "Damage amplification enemies receive from allies while affected by Radiation." },
                                        { label: "Cold Slow", value: fmt(stats.coldSlow * 100, 0) + "%", sub: "move/attack slow", tooltip: "Movement and attack speed slow applied by Cold stacks." },
                                        { label: "Cold Crit Damage", value: fmt(stats.coldCritDamageBonus * 100, 0) + "%", sub: "crit damage bonus", tooltip: "Bonus crit damage applied from maxed Cold freeze effects." },
                                        { label: "Puncture Dmg Down", value: fmt(stats.punctureEnemyDamageReduction * 100, 0) + "%", sub: "enemy damage reduction", tooltip: "How much enemy outgoing damage is reduced by Puncture stacks." },
                                        { label: "Puncture Crit", value: fmt(stats.punctureCritChanceBonus * 100, 0) + "%", sub: "crit chance bonus", tooltip: "Flat +5% critical chance per Puncture stack (up to +25%) for subsequent weapon hits. The bonus is omitted for attacks explicitly marked as area damage; the current weapon source does not classify every attack." },
                                        { label: "Impact Mercy", value: fmt(stats.impactMercyThresholdBonus * 100, 0) + "%", sub: "mercy threshold", tooltip: "Mercy threshold increase contributed by Impact stacks." },
                                        { label: `Blast / ${damageUnitLabel}`, value: fmt(stats.blastExpectedExpiryDamagePerShot), sub: "stack expiry damage", tooltip: `Expected damage from Blast stacks that expire naturally after one ${damageUnit}. Cap detonation is calculated in the finite encounter.` },
                                        { label: "Gas Radius", value: fmt(stats.gasCloudRadius, 2) + "m", sub: "cloud radius", tooltip: "Effective radius of the Gas cloud from current Gas stacks." },
                                        { label: "Tau Vulnerability", value: fmt(stats.tauStatusVulnerability * 100, 0) + "%", sub: "status vulnerability", tooltip: "+10% received Status Chance per Tau stack, up to +100%. The finite encounter applies active stacks to later ordinary status rolls; Tau and forced procs are not amplified." },
                                    ];
                                    const renderBadgeSection = (
                                        title: string,
                                        items: Array<{ label: string; value: string; sub?: string; tooltip?: string; highlight?: boolean; icon?: string }>,
                                        subtitle?: string,
                                    ) => {
                                        if (!items.length) return null;
                                        return (
                                            <div className="pt-2 border-t border-slate-800/50">
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
                                                    {title}
                                                    {subtitle ? <span className="normal-case font-normal text-slate-600 ml-1">{subtitle}</span> : null}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                                    {items.map((item) => (
                                                        <StatBadge
                                                            key={item.label}
                                                            label={item.label}
                                                            value={item.value}
                                                            sub={item.sub}
                                                            tooltip={item.tooltip}
                                                            highlight={item.highlight}
                                                            icon={item.icon}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <div key={atkIdx} className={weapon.attacks.length > 1 ? "border border-slate-800/60 rounded-xl p-3 space-y-3" : "space-y-3"}>
                                            {label && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-slate-300">{label}</span>
                                                {stats.chargeTimeSeconds !== null ? (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-700/40 bg-blue-950/30 text-blue-400">
                                                        {stats.chargeTimeSeconds.toFixed(2)}s charge
                                                    </span>
                                                ) : atk?.chargeTime != null && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-700/40 bg-blue-950/30 text-blue-400">
                                                            {atk.chargeTime.toFixed(1)}s charge
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {renderBadgeSection("All Stats", allMetricBadges)}

                                            {/* Damage type breakdown */}
                                            {(() => {
                                                const rows = dmgRows(dmgSrc);
                                                if (!rows.length) return null;
                                                const total = rows.reduce((s, r) => s + r.v, 0);
                                                return (
                                                    <div className="pt-2 border-t border-slate-800/50">
                                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
                                                            Damage Types
                                                            <span className="normal-case font-normal text-slate-600 ml-1">(hover for status effect)</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {rows.map(e => (
                                                                <StatBadge key={e.k} label={e.l}
                                                                    value={fmt(e.v, 1)}
                                                                    sub={fmt((stats.procChanceByType[e.k as keyof typeof stats.procChanceByType] ?? (e.v / total)) * 100, 0) + "%"}
                                                                    tooltip={STATUS_TIPS[e.k]}
                                                                    icon={DAMAGE_TYPE_ICON[e.k]} />
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-slate-600 mt-1.5">
                                                            Proc distribution uses the modded damage mix. Hover each type to see its status effect.
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {renderBadgeSection(
                                                "Proc Chance By Type",
                                                procChanceRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v * 100, 1) + "%",
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection(
                                                "Proc Rate By Type",
                                                procRateRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v, 2) + "/s",
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection(
                                                "Expected Stacks By Type",
                                                stackRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v, 2),
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection(
                                                "DoT By Type",
                                                dotDpsRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v),
                                                    sub: `${fmt(dotShotRows.find((entry) => entry.k === row.k)?.v ?? 0)} / ${damageUnit}`,
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                                "(value = DPS)",
                                            )}

                                            {renderBadgeSection(
                                                "Forced Procs By Type",
                                                forcedProcRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v, 2),
                                                    sub: `forced per ${damageUnit}`,
                                                    tooltip: `Expected forced ${row.l} proc count per attack after multishot. Forced rolls do not use status chance; some weapon rules select outcomes by modded damage weights while others use a uniform distribution.`,
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection(
                                                "Additional Procs By Type",
                                                bonusProcRows.map((row) => ({
                                                    label: row.l,
                                                    value: fmt(row.v, 2),
                                                    sub: `additional per ${damageUnit}`,
                                                    tooltip: STATUS_TIPS[row.k],
                                                    icon: DAMAGE_TYPE_ICON[row.k],
                                                })),
                                            )}

                                            {renderBadgeSection("Status Effects", statusEffectBadges)}

                                            {/* Crit tier warning */}
                                            {stats.critChance > 1 && (
                                                <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-400/80">
                                                    {stats.critChance >= 2
                                                        ? `${fmt(stats.critChance * 100, 1)}% crit — guaranteed orange crits (${fmt((stats.critChance - Math.floor(stats.critChance)) * 100, 0)}% red per ${damageUnit})`
                                                        : `${fmt(stats.critChance * 100, 1)}% crit — guaranteed yellow crits (${fmt((stats.critChance - 1) * 100, 0)}% orange per ${damageUnit})`}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-slate-600">
                                                Average crit tier: <span className="font-mono text-slate-300">{stats.averageCritTier.toFixed(2)}x</span>{" "}
                                                <span className="text-slate-500">expected crit level per {damageUnit}</span>
                                            </div>
                                        </div>
                                    );
                                };

                                const hasMultipleAttacks = weapon.attacks.length > 1;
                                const firstShotChamberMods = [...new Set(allSlotsForCap
                                    .filter((mod): mod is ModEntry => !!mod && [
                                        "Charged Chamber",
                                        "Primed Chamber",
                                        "Primed Charged Chamber",
                                    ].includes(mod.name))
                                    .map((mod) => mod.name))];

                                return (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="text-sm font-semibold flex items-center gap-2">
                                                Calculated Stats
                                                {factionOn && <span className="text-xs font-normal text-orange-400">vs {faction}</span>}
                                                {includeArcaneStats && arcane1 && arcane1.baseBonus && (
                                                    <span className="text-xs font-normal text-violet-400">+ {arcane1.name} (perm)</span>
                                                )}
                                            </div>
                                            {hasMultipleAttacks && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Optimize for</span>
                                                    {weapon.attacks.map((atk, i) => (
                                                        <button key={i}
                                                            onClick={() => setSelectedAttackIdx(i)}
                                                            className={["rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                                                                selectedAttackIdx === i
                                                                    ? "bg-slate-100 text-slate-900 border-slate-100"
                                                                    : "border-slate-700 text-slate-400 hover:border-slate-500"].join(" ")}>
                                                            {atk.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {firstShotChamberMods.length > 0 && (
                                            <div role="note" className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300/90">
                                                {activeMetrics?.modded.infiniteAmmoActive
                                                    ? `${firstShotChamberMods.join(", ")} are excluded while Gale Force is assumed maintained: its infinite-ammo state prevents a magazine reload, so the first-shot bonus has already been spent.`
                                                    : `${firstShotChamberMods.join(", ")} apply to the first shot in each magazine; per-magazine DPS and first-shot / finite-encounter damage include the bonus.${weapon.hasGaleForceAmmoPassive ? " Gale Force trigger/refresh timing is not modeled; its maintained state is available in Fully stacked and Custom scenarios." : ""}`}
                                            </div>
                                        )}

                                        {renderAttackStats(
                                            hasMultipleAttacks ? selectedAttackIdx : 0,
                                            hasMultipleAttacks ? weapon.attacks[selectedAttackIdx]?.name : undefined,
                                        )}
                                    </div>
                                );
                            })()}
                                </div>
                            </div>

                            {activeIncarnonTier && (
                                <div className="wf-modal-backdrop wf-dialog-frame fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
                                    <div ref={incarnonDialogRef} className="wf-dialog relative max-h-full w-full max-w-5xl overflow-y-auto rounded-[2rem] border" role="dialog" aria-modal="true" aria-labelledby="incarnon-evolution-title" tabIndex={-1}>
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                                        <div className="px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-[0.35em] text-[color:var(--wf-accent-text)]">
                                                        Evolution {INCARNON_TIER_LABELS[activeIncarnonTier.tier]}
                                                    </div>
                                                    <h3 id="incarnon-evolution-title" className="mt-2 text-2xl font-semibold text-[color:var(--wf-text-strong)] sm:text-[2rem]">
                                                        {activeIncarnonTier.tier === 1 ? "Review Incarnon evolution" : "Choose an Incarnon perk"}
                                                    </h3>
                                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wf-text-muted)]">
                                                        {activeIncarnonTier.tier === 1
                                                            ? "Evolution I is the Incarnon-form baseline. Review what it changes, then enable or remove it for this build."
                                                            : "Pick the upgrade that should shape this build. The optimizer can branch across enabled tiers later if you turn path optimization on."}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIncarnonPickerTier(null)}
                                                    className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-accent-text)]"
                                                >
                                                    Close
                                                </button>
                                            </div>

                                            <div className={["mt-8 grid gap-4", activeIncarnonTier.options.length > 1 ? "lg:grid-cols-3" : ""].join(" ")}>
                                                {activeIncarnonTier.options.map((option, index) => {
                                                    const selected = buildCfg.incarnonSelectedOptionsByTier[activeIncarnonTier.tier] === option.id;
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            type="button"
                                                            onClick={() => setIncarnonTierSelection(activeIncarnonTier.tier, option.id)}
                                                            className={[
                                                                "group relative overflow-hidden rounded-[1.6rem] border p-5 text-left transition-all duration-200",
                                                                selected
                                                                    ? "border-cyan-300/70 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_36px_rgba(34,211,238,0.18),inset_0_0_24px_rgba(34,211,238,0.14)]"
                                                                    : "border-slate-800/90 bg-slate-950/55 hover:border-cyan-300/35 hover:bg-slate-900/80",
                                                            ].join(" ")}
                                                        >
                                                            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent opacity-80" />
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--wf-accent-text)]">Perk {index + 1}</div>
                                                                    <div className="mt-3 text-lg font-semibold text-[color:var(--wf-text-strong)]">{option.name}</div>
                                                                </div>
                                                                <span
                                                                    className={[
                                                                        "flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold transition-all",
                                                                        selected
                                                                            ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)] shadow-[0_0_0_1px_var(--wf-selection-border)]"
                                                                            : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] group-hover:border-[color:var(--wf-border-accent)] group-hover:text-[color:var(--wf-accent-text)]",
                                                                    ].join(" ")}
                                                                >
                                                                    {INCARNON_TIER_LABELS[activeIncarnonTier.tier]}
                                                                </span>
                                                            </div>
                                                            <div className="mt-5 space-y-2">
                                                                {option.descriptionLines.map((line, lineIndex) => (
                                                                    <div key={`${option.id}-line-${lineIndex}`} className="text-sm leading-6 text-slate-200/92">
                                                                        {line}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {option.notes.length > 0 && (
                                                                <div className="mt-5 border-t border-[color:var(--wf-border-subtle)] pt-4 text-xs leading-5 text-[color:var(--wf-text-muted)]">
                                                                    {option.notes.join(" ")}
                                                                </div>
                                                            )}
                                                            {option.model.unsupportedLines.length > 0 && (
                                                                <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-950/20 px-3 py-2.5 text-xs leading-5 text-amber-100">
                                                                    <div className="font-semibold">Not included in stats or optimizer scoring</div>
                                                                    <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-100/80">
                                                                        {option.model.unsupportedLines.map((line, lineIndex) => (
                                                                            <li key={`${option.id}-unsupported-${lineIndex}`}>{line}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-400/10 pt-5">
                                                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                                                    {buildCfg.incarnonSelectedOptionsByTier[activeIncarnonTier.tier]
                                                        ? "Current tier is active"
                                                        : "Tier is currently inactive"}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {buildCfg.incarnonSelectedOptionsByTier[activeIncarnonTier.tier] && (
                                                        <button
                                                            type="button"
                                                            onClick={() => clearIncarnonTierSelection(activeIncarnonTier.tier)}
                                                            className="rounded-full border border-rose-400/25 bg-rose-950/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-rose-200 transition-colors hover:border-rose-300/40 hover:text-rose-100"
                                                        >
                                                            Remove Evolution
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setIncarnonPickerTier(null)}
                                                        className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-accent-text)]"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showMathWindow && (
                                <div
                                    className="wf-modal-backdrop wf-dialog-frame fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
                                    onClick={() => setShowMathWindow(false)}
                                >
                                    <div
                                        ref={mathDialogRef}
                                        className="wf-dialog relative w-full max-w-6xl overflow-hidden rounded-[2rem] border"
                                        role="dialog"
                                        aria-modal="true"
                                        aria-labelledby="mod-builder-math-title"
                                        tabIndex={-1}
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                                        <div className="max-h-[88vh] overflow-y-auto px-6 pb-6 pt-6 sm:px-8 sm:pt-8">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-[0.35em] text-[color:var(--wf-accent-text)]">
                                                        Detailed Build Math
                                                    </div>
                                                    <h3 id="mod-builder-math-title" className="mt-2 text-2xl font-semibold text-[color:var(--wf-text-strong)] sm:text-[2rem]">
                                                        Full calculation trace
                                                    </h3>
                                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300/80">
                                                        This window shows the calculator inputs, intermediate values, and final outputs for the current build. It is intentionally verbose so you can inspect each bracket, quantization step, proc weight, DoT term, and conditional assumption without the inline panel getting bloated.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMathWindow(false)}
                                                    className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-accent)] hover:text-[color:var(--wf-info)]"
                                                >
                                                    Close
                                                </button>
                                            </div>

                                            {displayedMath ? (
                                                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                                                    {displayedMath.sections.map((section) => (
                                                        <div key={section.title} className="overflow-hidden rounded-[1.5rem] border border-slate-800/90 bg-slate-950/55">
                                                            <div className="border-b border-cyan-400/10 bg-cyan-400/5 px-5 py-4">
                                                                <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--wf-info)]">{section.title}</div>
                                                            </div>
                                                            <div className="space-y-2 px-5 py-4">
                                                                {section.lines.map((line, idx) => (
                                                                    <div key={idx} className="rounded-xl border border-slate-800/70 bg-slate-950/50 px-3 py-2 text-[11px] leading-5 text-slate-300 break-words">
                                                                        <span className="font-mono">{line}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-8 rounded-[1.5rem] border border-slate-800/90 bg-slate-950/55 px-5 py-5 text-sm text-slate-400">
                                                    No math snapshot is available yet for this build state.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                </>
            )}
        </div>
    );
}

function InlineStatRow({ label, value, sub, tooltip, labelClassName }: {
    label: React.ReactNode;
    value: string;
    sub?: string;
    tooltip?: string;
    labelClassName?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div
            className={["relative flex items-center justify-between gap-3", tooltip ? "cursor-help" : ""].join(" ")}
            onMouseEnter={() => tooltip && setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            <span className={["flex items-center gap-1", labelClassName ?? "text-sky-200/85"].join(" ")}>
                {label}
                {tooltip && <span className="text-slate-700 text-[8px]">?</span>}
            </span>
            <div className="text-right">
                <div className="font-mono text-yellow-200">{value}</div>
                {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
            </div>
            {show && tooltip && (
                <div className="absolute bottom-full left-0 mb-1.5 z-50 w-60 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] text-slate-300 shadow-xl leading-relaxed pointer-events-none whitespace-pre-line">
                    {tooltip}
                </div>
            )}
        </div>
    );
}
