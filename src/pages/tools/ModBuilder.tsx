Warning: truncated output (original token count: 122297)
Total output lines: 6747

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
import { filterBuilderExpertVariants, getModsForWeapon, getStancesForWeapon, getUnmodeledDamageEffectLines, sortBuilderModsForDisplay, type ModEntry, type ModEffect, emptyEffect } from "../../domain/catalog/modCatalog";
import { getUnmodeledScoringEffectLines } from "../../domain/catalog/modEffectUtils";
import { ENEMY_PROFILES, getEnemyProfile } from "../../domain/catalog/enemyProfiles";
import { getArcanesForWeapon, type ArcaneEntry } from "../../domain/catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../../domain/logic/arcaneEffects";
import { avgHitDamageMultiplier, calculateBuild, calculateBuildForExpectedEncounter, calculateMeleeAverageDps, DEFAULT_CONDITIONAL_STATE, estimateConditionalStackFactor, estimateConditionalUptime, estimateNonCriticalNoStatusHitGroupProbability, type ConditionalState, type MeleeAverageDpsParameters } from "../../domain/logic/damageCalc";
import { getWikiMeleeStanceCombo, WIKI_MELEE_STANCE_SOURCE_URL, WIKI_MELEE_STANCE_VERIFIED_AT, type WikiMeleeStanceCombo } from "../../domain/catalog/meleeStanceCombos";
import { optimizeBuild, explainBuild, getFactionFocusOptions, getTargetProfileAssumptions, normalizeOptimizeGoal, scoreOptimizerResultForConfiguration, type OptimizeGoal, type BuildReasoning, type LegacyOptimizeGoal, type TargetProfileOverride } from "../../domain/logic/buildOptimizer";
import { STATUS_DAMAGE_TYPES, type StatusDamageType } from "../../domain/logic/damageRuleset";
import { EXIMUS_BASE_OVERGUARD, applyEximusHealthBaseAdjustment, applyEximusShieldBaseAdjustment, applySteelPathStatMultiplier, enemyStatLevelMultiplier, getSteelPathEnemyLevel, scaleEnemyOverguard, scaleEnemyStat, type EnemyScalingFaction } from "../../domain/logic/enemyScaling";
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
    impact:      "Stagger (6s; 5 stacks max): repeat procs lengthen the stagger; Ospreys, bosses, and Tenno are immune to it. On heavy, Mercy-eligible units, each stack adds 8 percentage points to the Mercy health threshold (up to +40% / 80% total; Corpus/Eximus with all Shields removed can reach 100%). The panel reports only the mean-field bonus; it does not identify eligible or immune enemies or simulate Mercy outcomes, and the optimizer does not score this utility.",
    puncture:    "Weakened (10s; normally 5 stacks): the target's attacks deal 40% less damage at 1 stack, then 10 percentage points less per added stack (80% at 5). Subsequent weapon hits against it gain +5 percentage points Critical Chance per stack (up to +25%), additive after mods; Area-of-Effect damage and Warframe abilities do not get this bonus. The status panel displays the expected enemy-damage reduction, but no enemy attacks or defensive outcome are simulated and the optimizer does not score it. The crit bonus is omitted only for attacks explicitly marked as AoE, so unclassified rows may be uncertain. Overguarded VIPs cap at 3 stacks; that target-specific limit is not configured.",
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
function describeLastShotMagazineInactiveReason(reason: string): string {
    switch (reason) {
        case "base-magazine-under-six":
            return "the weapon's base magazine capacity is below 6";
        case "continuous-weapon":
            return "Synth Charge does not affect continuous attacks in this model";
        case "unmodeled-reload-grenade":
            return "the Catabolyst reload-grenade exception is not modeled";
        case "incarnon-attack":
            return "Synth Charge does not affect Incarnon attacks";
        case "exalted-weapon":
            return "Synth Charge does not affect Exalted weapons";
        case "infinite-ammo":
            return "the selected condition assumes the magazine never empties";
        case "one-attack-per-magazine":
            return "this attack consumes the whole magazine in one attack";
        default:
            return "the selected attack does not meet the modeled requirements";
    }
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

type MeleeDpsInputState = WikiMeleeStanceCombo;

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
        meleeStanceCombo: (WikiMeleeStanceCombo & { sourceUrl: string; verifiedAt: string }) | null;
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
    meleeDpsInputs?: MeleeDpsInputState | null,
): BuildMathBreakdown {
    const totals = sumEffects(effects);
    const result = calculateBuild(weapon, effects, targetFaction, {
        conditionalState,
        statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
        statusStackCaps: targetProfileOverride?.statusStackCaps,
        includeTimedConditionalHitStackDetails: true,
    });
    const stats = result.modded;
    const meleeDpsBaseline = usesMeleeDamageModel(weapon.category) &&
        meleeDpsInputs != null
        ? calculateBuild(weapon, effects, targetFaction, {
            conditionalState: { mode: "initial" },
            statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            targetStatusState: "initial",
        }).modded
        : null;
    const meleeAverageDps = meleeDpsBaseline && meleeDpsInputs
        ? calculateMeleeAverageDps(meleeDpsBaseline, {
            totalDamageMultiplier: meleeDpsInputs.totalDamageMultiplier,
            totalSlashProcMultiplier: meleeDpsInputs.totalSlashProcMultiplier,
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
    const selectedAttackDamageMultiplier = stats.slamAttackDamageMultiplier * stats.meleeAttackComboDamageMultiplier;
    const moddedBaseDamageForQuantization = moddedBaseDamage * selectedAttackDamageMultiplier;
    const quantScale = (moddedBaseDamageForQuantization / 32) * (stats.directDamagePerStatusMultiplier || 1);
    const fireRateBonus = usesMeleeDamageModel(weapon.category) ? totals.attackSpeedBonus : totals.fireRateBonus;
    const quantizedShotDamage = stats.totalDamage * stats.damageWeightedMultishot;
    const avgHitMultiplier = quantizedShotDamage > 0 ? stats.averageShotDamage / quantizedShotDamage : 1;
    const hasConditionalBonuses = effects.some(effect => (effect?.conditionalEffects?.length ?? 0) > 0);
    const damageUnit = actionUnitLabel(weapon.category);
    const avgDamageLabel = averageDamageLabel(weapon.category);
    const rateLabel = actionRateLabel(weapon.category);
    const conditionalEntries = effects.flatMap((effect) => effect?.conditionalEffects ?? []);
    let timedStackTraceIndex = 0;
    const unconditionalEffects = effects.map((effect) => effect ? { ...effect, conditionalEffects: [] } : effect);
    const baselineConditionalStats = calculateBuild(weapon, unconditionalEffects, targetFaction, { conditionalState }).modded;
    const baselineRateForConditionals = baselineConditionalStats.fireRate;
    const baseMagazineForConditionals = baselineConditionalStats.magazineSize;
    const qualifyingHitGroupProbability = estimateNonCriticalNoStatusHitGroupProbability(
        stats.critChance,
        stats.statusChance,
        stats.multishot,
    );
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
        const timedStackModel = conditional.trigger === "onNonCriticalNoStatusHit"
            ? stats.timedConditionalDamageStacks[timedStackTraceIndex++]
            : undefined;
        const conditionalQualifyingGroupProbability = timedStackModel?.qualifyingHitGroupProbability ?? qualifyingHitGroupProbability;
        const uptime = estimateConditionalUptime(conditional, baselineRateForConditionals, baseMagazineForConditionals, conditionalState);
        const stackFactor = estimateConditionalStackFactor(
            conditional,
            baselineRateForConditionals,
            baseMagazineForConditionals,
            conditionalState,
            {
                qualifyingHitGroupProbability: conditionalQualifyingGroupProbability,
                qualifyingHitRatePerSecond: stats.fireRate * conditionalQualifyingGroupProbability,
            },
        );
        const combinedFactor = uptime * stackFactor;
        const statsApplied = Object.entries(conditional.stats)
            .filter(([, value]) => typeof value === "number" && value !== 0)
            .map(([key, value]) => `${key} ${fmt((value as number) * 100, 2)}%`)
            .join(", ");
        const triggerLabel = conditional.trigger.replace(/([A-Z])/g, " $1").toLowerCase();
        const triggerModel = conditional.trigger === "onNonCriticalNoStatusHit"
            ? ` qualifying group chance ${fmt(conditionalQualifyingGroupProbability * 100, 5)}% from ${fmt(stats.critChance * 100, 2)}% crit, ${fmt(stats.statusChance * 100, 2)}% status, and ${fmt(stats.multishot, 3)} multishot; the steady-state estimate uses Poisson arrivals at ${fmt(stats.fireRate * conditionalQualifyingGroupProbability, 5)}/s and one-stack decay per full duration without a trigger. The finite encounter starts at ${timedStackModel?.initialStacks ?? 0} stacks and advances one qualifying attack group at a time. The model treats crit/status rolls as independent per projectile and averages fractional multishot as one extra-projectile chance. Target status immunities and forced weapon procs are applied; DoT ticks and externally applied statuses are excluded.`
            : "";
        return `Conditional ${index + 1}: trigger ${triggerLabel}, duration ${fmt(conditional.durationSeconds, 2)}s, max stacks ${conditional.maxStacks}, aiming ${conditional.requiresAiming ? "yes" : "no"}, uptime ${fmt(uptime, 4)}, stack factor ${fmt(stackFactor, 4)}, combined factor ${fmt(combinedFactor, 4)}, stats [${statsApplied || "none"}]${triggerModel}`;
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
                ...(stats.slamAttackDamageMultiplier > 1
                    ? [`Selected slam damage multiplier = ×${fmt(stats.slamAttackDamageMultiplier, 5)} (multiplicative Slam Damage category)`]
                    : []),
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
                ...(selectedAttackDamageMultiplier !== 1
                    ? [`Selected attack damage multipliers = Slam Damage ${fmt(stats.slamAttackDamageMultiplier, 5)} × heavy-attack combo ${fmt(stats.meleeAttackComboDamageMultiplier, 5)} = ${fmt(selectedAttackDamageMultiplier, 5)}; quantization base = ${fmt(moddedBaseDamage, 5)} × ${fmt(selectedAttackDamageMultiplier, 5)} = ${fmt(moddedBaseDamageForQuantization, 5)}`]
                    : []),
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
                `Scale = direct-hit modded base damage, including selected attack multipliers, ÷ 32 = (${fmt(moddedBaseDamage, 5)} × ${fmt(selectedAttackDamageMultiplier, 5)} × ${fmt(stats.directDamagePerStatusMultiplier, 5)}) ÷ 32 = ${fmt(quantScale, 5)}`,
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
                `Average hit damage multiplier = expected direct damage ÷ quantized damage per ${damageUnit} = ${fmt(stats.averageShotDamage, 5)} ÷ ${fmt(quantizedShotDamage, 5)} = ${fmt(avgHitMultiplier, 6)}`,
                `Average crit multiplier cross-check = 1 + crit chance × (crit multiplier - 1) = 1 + ${fmt(stats.critChance, 5)} × (${fmt(stats.critMultiplier, 5)} - 1) = ${fmt(1 + stats.critChance * (stats.critMultiplier - 1), 6)}`,
                `Average direct damage per ${damageUnit} = quantized damage ${fmt(quantizedShotDamage, 5)} × average hit damage multiplier ${fmt(avgHitMultiplier, 6)} = ${fmt(stats.averageShotDamage, 5)}`,
                ...(stats.firstShotMagazineDamageBonus > 0
                    ? [
                        `First ammo-consuming shot after reload = ${fmt(stats.averageShotDamage, 5)} × ${fmt(stats.firstShotMagazineDamageMultiplier, 6)} = ${fmt(stats.averageShotDamage * stats.firstShotMagazineDamageMultiplier, 5)}`,
                        `Average magazine damage multiplier = 1 + first-shot bonus ${fmt(stats.firstShotMagazineDamageBonus, 5)} ÷ ${fmt(stats.shotsPerMag, 5)} shots = ${fmt(stats.magazineAverageDamageMultiplier, 6)}`,
                    ]
                    : []),
                ...(stats.lastShotMagazineRequestedDamageBonus > 0
                    ? stats.lastShotMagazineInactiveReason
                        ? [`Final-shot magazine bonus is inactive because ${describeLastShotMagazineInactiveReason(stats.lastShotMagazineInactiveReason)}.`]
                        : [
                            `Final ammo-consuming shot, one-hit bonus = ${fmt(stats.averageShotDamage, 5)} × ${fmt(stats.lastShotMagazineDamageMultiplier, 6)} = ${fmt(stats.averageShotDamage * stats.lastShotMagazineDamageMultiplier, 5)}`,
                            `The final-shot bonus is distributed over ${fmt(stats.damageWeightedMultishot, 5)} expected projectiles because only one hit receives it.`,
                        ]
                    : []),
                ...(stats.firstShotMagazineDamageBonus > 0 || stats.lastShotMagazineDamageBonus > 0
                    ? [
                        `Average magazine damage multiplier = 1 + (first-shot bonus ${fmt(stats.firstShotMagazineDamageBonus, 5)} + one-hit final-shot bonus ${fmt(stats.lastShotMagazineDamageMultiplier - 1, 5)}) ÷ ${fmt(stats.shotsPerMag, 5)} attacks = ${fmt(stats.magazineAverageDamageMultiplier, 6)}`,
                    ]
                    : []),
                ...fireRateExplanation,
                `Burst DPS = ${avgDamageLabel} ${fmt(stats.averageShotDamage, 5)} × fresh-mag attack rate ${fmt(stats.burstFireRate, 5)} × fresh-mag ramp ${fmt(stats.freshMagazineDamageMultiplier, 6)} × average magazine damage ${fmt(stats.magazineAverageDamageMultiplier, 6)} = ${fmt(result.burstDPS, 5)}`,
                ignoresReloadAndMagazine
                    ? `Sustained DPS = average damage ${fmt(stats.averageShotDamage, 5)} × fire rate ${fmt(stats.fireRate, 5)} × sustained ramp ${fmt(stats.sustainedDamageMultiplier, 6)} because reload/magazine are ignored = ${fmt(result.sustainedDPS, 5)}`
                    : `Sustained DPS = average damage ${fmt(stats.averageShotDamage, 5)} × fire rate ${fmt(stats.fireRate, 5)} × magazine duty cycle ${fmt(stats.magazineDutyCycle, 6)} × sustained ramp ${fmt(stats.sustainedDamageMultiplier, 6)} × average magazine damage ${fmt(stats.magazineAverageDamageMultiplier, 6)} = ${fmt(result.sustainedDPS, 5)}`,
                ...damageRampLines,
                ...(usesMeleeDamageModel(weapon.category)
                    ? meleeAverageDps && meleeDpsInputs
                        ? [
                            `Wiki ${meleeDpsInputs.comboType} combo damage multiplier = direct ${fmt(meleeDpsInputs.totalDamageMultiplier, 5)} + forced Slash ${fmt(meleeDpsInputs.totalSlashProcMultiplier, 5)} = ${fmt(meleeDpsInputs.totalDamageMultiplier + meleeDpsInputs.totalSlashProcMultiplier, 5)} (${meleeDpsInputs.comboName})`,
                            `Stance average combo damage = combined Wiki multiplier ${fmt(meleeDpsInputs.totalDamageMultiplier + meleeDpsInputs.totalSlashProcMultiplier, 5)} × initial-state quantized damage ${fmt(meleeDpsBaseline?.totalDamage ?? 0, 5)} × expected hit damage multiplier ${fmt(meleeAverageDps.expectedHitDamageMultiplier, 6)} = ${fmt(meleeAverageDps.averageHit, 5)}`,
                            `Stance average DPS = average hit ${fmt(meleeAverageDps.averageHit, 5)} × modded attack speed ${fmt(meleeDpsBaseline?.fireRate ?? 0, 5)} ÷ base combo length ${fmt(meleeDpsInputs.baseComboLengthSeconds, 5)}s = ${fmt(meleeAverageDps.averageDps, 5)}`,
                            `Data: Warframe Wiki Stance comparison table, checked ${WIKI_MELEE_STANCE_VERIFIED_AT}. Combo timing is approximate; the Wiki warns its comparison formula omits combo physical-damage bonuses. The estimate also excludes status history, target defenses, and follow-through.`,
                        ]
                        : ["Stance average DPS is unavailable because the selected stance has no timed Neutral combo in the Wiki reference table."]
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
    meleeDpsInputs: MeleeDpsInputState | null;
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
        meleeDpsInputs != null
        ? calculateBuild(calcWeapon, effects, targetFaction ?? "", {
            conditionalState: { mode: "initial" },
            statusImmuneTypes: targetProfileOverride?.statusImmuneTypes,
            statusStackCaps: targetProfileOverride?.statusStackCaps,
            targetStatusState: "initial",
        }).modded
        : null;
    const meleeAverageDps = meleeDpsBaseline && meleeDpsInputs
        ? calculateMeleeAverageDps(meleeDpsBaseline, {
            totalDamageMultiplier: meleeDpsInputs.totalDamageMultiplier,
            totalSlashProcMultiplier: meleeDpsInputs.totalSlashProcMultiplier,
            baseComboLengthSeconds: meleeDpsInputs.baseComboLengthSeconds,
        })
        : null;
    const calculatedWithMeleeDps = {
        ...calculated,
        meleeAverageDps: meleeAverageDps && meleeDpsInputs
            ? {
                totalDamageMultiplier: meleeDpsInputs.totalDamageMultiplier,
                totalSlashProcMultiplier: meleeDpsInputs.totalSlashProcMultiplier,
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
            meleeStanceCombo: usesMeleeDamageModel(weapon.category) && meleeDpsInputs
                ? {
                    ...meleeDpsInputs,
                    sourceUrl: WIKI_MELEE_STANCE_SOURCE_URL,
                    verifiedAt: WIKI_MELEE_STANCE_VERIFIED_AT,
                }
                : null,
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
        return sortBuilderModsForDisplay(compatMods.filter(m => {
            if (isExilusSlot && !m.isExilus) return false;
            if (usedGroups.has(m.incompatibilityGroup) && m.incompatibilityGroup !== mod?.incompatibilityGroup) return false;
            if (onlyOwned && ownedUniqueNames.size > 0 && !ownedUniqueNames.has(m.uniqueName)) return false;
            if (q && !getBuilderDisplayModName(m).toLowerCase().includes(q) && !m.statsLabel.toLowerCase().includes(q)) return false;
            return true;
        }));
    }, [compatMods, usedGroups, mod, query, onlyOwned, ownedUniqueNames, isExilusSlot]);
    const currentStatsLabel = mod ? (mod.statsTextByRank[rank] ?? mod.statsLabel) : "";
    const currentUnmodeledDamageLines = mod ? getUnmodeledDamageEffectLines(mod, rank) : [];

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
                                {currentUnmodeledDamageLines.length > 0 && (
                                    <div
                                        className="mt-1 text-[9px] leading-tight text-amber-300"
                                        title={currentUnmodeledDamageLines.join(" · ")}
                                    >
                                        Damage effect not modeled; excluded from automatic optimization
                                    </div>
                                )}
                                {showDetails && (
                                    <div className="wf-popover pointer-events-none absolute left-0 top-full z-[70] mt-2 w-64 rounded-lg border px-3 py-2">
                                        <div className="text-xs font-semibold leading-tight text-slate-100">{getBuilderDisplayModName(mod)}</div>
                                        <div className="mt-1 text-[11px] leading-relaxed text-slate-300">{currentStatsLabel}</div>
                                        {currentUnmodeledDamageLines.length > 0 && <div className="mt-1 text-[10px] leading-relaxed text-amber-300">Not included: {currentUnmodeledDamageLines.join(" · ")}</div>}
                                        {!mod.hasDamageEffect && !mod.isBuiltIn && currentUnmodeledDamageLines.length === 0 && <div className="mt-1 text-[10px] leading-relaxed text-amber-300">No parsed damage effect; automatic optimization excludes this mod.</div>}
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
                                    effDrain < 0 ? "text-green-300 bg-green-950/40"…62297 tokens truncated…${phantasmaBeamDamageRampNote}` : ""}`,
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
                                                                {activeIncarnonHasExpectedHitProcs && (
                                                                    <div className="sm:col-span-2">
                                                                        <span className="text-slate-500">Stochastic Incarnon effect:</span> damage uses its probability-weighted mean; individual per-shot proc streaks are not simulated.
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
                                                                                    ? `· heavy-attack combo ${fmt(activeTargetAttackSequence.comboMultiplierAtStart, 0)}× → ${fmt(activeTargetAttackSequence.comboMultiplierAtKill, 0)}× `
                                                                                    : ""}
                                                                                {activeMetrics?.modded.shatteringImpactBaseArmorPerHit
                                                                                    ? `· base Armor after Shattering Impact ${fmt(activeTargetAttackSequence.remainingArmorAfterBaseStrip, 0)} (before percentage strips) `
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
                                                                                · {fmt(activeTargetEncounter.damagePerSecond)} damage/s · direct {fmt(activeTargetEncounter.directDamageByPool.health + activeTargetEncounter.directDamageByPool.shields + activeTargetEncounter.directDamageByPool.overguard)} + status {fmt(activeTargetEncounter.statusDamageByPool.health + activeTargetEncounter.statusDamageByPool.shields + activeTargetEncounter.statusDamageByPool.overguard)} damage{(encounterTargetMetrics?.modded.shatteringImpactBaseArmorPerHit ?? 0) > 0 ? ` · remaining base-stripped Armor ${fmt(activeTargetEncounter.remainingArmorAfterBaseStrip, 0)}` : ""}
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
                                                            <p className="text-[10px] text-slate-500">The selected-state one-hit estimate uses minimum attack-ramp damage when the selected weapon has a ramp. The direct-hit sequence starts cold and advances its ramp per attack; for selected heavy attacks it also applies combo consumption, supported Heavy Attack Efficiency, and 40 points/s Initial Combo recovery. It does not model attack-generated combo, Tennokai, stance sequences, or heavy-attack wind-up. The finite encounter keeps the starting combo tier, starts with no weapon-generated status stacks, and advances supported timed damage stacks such as Overwhelming Attrition as qualifying attack groups occur. It processes expected attacks and scheduled DoT ticks in event order, updating Heat/Corrosive armor strip, Viral/Magnetic/Cold/Puncture/Tau state and proc eligibility as target pools deplete. Condition Overload uses weapon statuses active before each hit plus the user-entered external-status count. Fractional proc applications remain mean-field estimates; the selected 0.1 s enemy Shield Gate applies to direct hits while status ticks ignore it, and shield regeneration, attenuation, projectile travel, neighbor status histories, chain geometry, Gas radius growth, and melee stance hit timing remain unsupported.</p>
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
                                        ...(stats.lastShotMagazineRequestedDamageBonus > 0
                                            ? [{
                                                label: "Final shot",
                                                value: stats.lastShotMagazineInactiveReason
                                                    ? "Inactive"
                                                    : fmt(stats.averageShotDamage * stats.lastShotMagazineDamageMultiplier),
                                                sub: stats.lastShotMagazineInactiveReason
                                                    ? "Synth Charge requirement"
                                                    : "one hit in a fresh magazine",
                                                tooltip: stats.lastShotMagazineInactiveReason
                                                    ? `Synth Charge is inactive because ${describeLastShotMagazineInactiveReason(stats.lastShotMagazineInactiveReason)}.`
                                                    : `Synth Charge adds its bonus to one hit on the final ammo-consuming attack. This value spreads that hit's bonus across the expected projectiles for the attack.`,
                                            }]
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
                                        ...(stats.shatteringImpactBaseArmorPerHit > 0 ? [{ label: "Shattering Impact", value: `-${fmt(stats.shatteringImpactBaseArmorPerHit, 0)}`, sub: "base Armor / Impact hit", tooltip: "Permanently removes this much base Armor per melee hit with nonzero quantized Impact damage. It does not require an Impact status proc; level scaling applies, then percentage Heat/Corrosive strips." }] : []),
                                        { label: "Magnetic Shield", value: fmt(stats.magneticShieldDamageBonus * 100, 0) + "%", sub: "shield damage", tooltip: "Extra damage dealt to shields and overguard from Magnetic stacks." },
                                        { label: "Radiation Ally Dmg", value: fmt(stats.radiationAllyDamageBonus * 100, 0) + "%", sub: "friendly fire bonus", tooltip: "Damage amplification enemies receive from allies while affected by Radiation." },
                                        { label: "Cold Slow", value: fmt(stats.coldSlow * 100, 0) + "%", sub: "move/attack slow", tooltip: "Movement and attack speed slow applied by Cold stacks." },
                                        { label: "Cold Crit Damage", value: fmt(stats.coldCritDamageBonus * 100, 0) + "%", sub: "crit damage bonus", tooltip: "Bonus crit damage applied from maxed Cold freeze effects." },
                                        { label: "Puncture Dmg Down", value: fmt(stats.punctureEnemyDamageReduction * 100, 0) + "%", sub: "enemy damage reduction", tooltip: "How much enemy outgoing damage is reduced by Puncture stacks." },
                                        { label: "Puncture Crit", value: fmt(stats.punctureCritChanceBonus * 100, 0) + "%", sub: "crit chance bonus", tooltip: "Flat +5% critical chance per Puncture stack (up to +25%) for subsequent weapon hits. The bonus is omitted for attacks explicitly marked as area damage; the current weapon source does not classify every attack." },
                                        { label: "Impact Mercy", value: fmt(stats.impactMercyThresholdBonus * 100, 0) + "%", sub: "mercy threshold", tooltip: "Expected additional Mercy health-threshold bonus from Impact stacks (+8 percentage points each, up to +40%). Applies to heavy Mercy-eligible units only; target eligibility and Mercy outcomes are not modeled." },
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

