// src/pages/Mods.tsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { useTrackerStore } from "../store/store";
import { isHiddenModPath } from "../domain/catalog/modCatalog";
import { getWeaponCatalog } from "../domain/catalog/weaponCatalog";
import { CUSTOM_RIVEN_STAT_DEFS, formatRivenStatValue, generateCustomRivenName, getCustomRivenStatDef, getCustomRivenStatDefsForWeapon, normalizeRivenWeaponFamilyKey, type CustomRivenRecord as CustomRivenInventoryRecord, type CustomRivenStatValue } from "../domain/rivens";
import { withManualReleaseDateFallback } from "../catalog/items/manualReleaseDates";
import MODS_RAW from "../data/_generated/mods-lean.auto.json";
import ALL_RAW from "../data/_generated/warframe-items-all-lean.auto.json";
import { WorkspaceAction, WorkspaceFilterGroup, WorkspacePillButton, WorkspaceSection } from "../components/workspace/WorkspaceChrome";
import {
  COLLECTION_LEDGER_SHELL_CLASS,
  CollectionChipRail,
  CollectionModeBand,
  CollectionModeButton,
  CollectionRefineBand,
  CollectionRefineGroup,
  CollectionResultsBand,
  CollectionUtilityBand,
  CollectionUtilityPanel,
} from "../components/collection/CollectionLedgerShell";
import { getEntityImageUrl } from "../utils/entityImage";
import {
  GroupedSourceList,
  classifySourceFamilyFromDropLocation,
  extractInlinePriceMeta,
  type GroupedSourceEntry,
} from "../components/sources/GroupedSourceList";
import { buildCatalogSourceEntries } from "../components/sources/catalogSourceEntries";

import MOD_LOCATIONS_RAW from "../../external/warframe-drop-data/raw/modLocations.json";

const EMPTY_CUSTOM_RIVENS: CustomRivenInventoryRecord[] = [];

// Build a lookup from All.json keyed by uniqueName — includes Mods + Arcanes
interface AllModDrop {
  chance: number;
  location: string;
  rarity: string;
  type: string;
}
interface AllModEntry {
  catalogId?: string;
  uniqueName: string;
  name: string;
  category?: string;
  compatName?: string;
  type?: string;
  rarity?: string;
  baseDrain?: number;
  fusionLimit?: number;
  isExilus?: boolean;
  isAugment?: boolean;
  isUtility?: boolean;
  isPrime?: boolean;
  imageName?: string;
  levelStats?: { stats: string[] }[];
  drops?: AllModDrop[];
  introduced?: { name: string; date?: string };
  releaseDate?: string;
  tradable?: boolean;
  transmutable?: boolean;
  description?: string;
  modSet?: string;
  modSetValues?: number[];
  polarity?: string;
  wikiaThumbnail?: string;
  wikiaUrl?: string;
}
const VANILLA_DATE = "2012-10-25";

function formatReleaseDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  if (date === VANILLA_DATE) return "Vanilla";
  return date;
}

function getSortableReleaseDate(date: string | undefined, direction: "oldest" | "newest"): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date === "0000-00-00") {
    return direction === "oldest" ? "9999-99-99" : "";
  }
  return date;
}

function formatDropPercent(chance: number): string {
  return `${chance.toFixed(2)}%`;
}

function isLegacyFocusNodePath(path: string | undefined): boolean {
  return typeof path === "string" && path.startsWith("/Lotus/Upgrades/Focus/");
}

function getSupplementalRivenWeapons() {
  const out = new Map<string, ReturnType<typeof getWeaponCatalog>[number]>();
  for (const raw of ALL_RAW as Array<Record<string, unknown>>) {
    const name = String(raw.name ?? "");
    const uniqueName = String(raw.uniqueName ?? "");
    const disposition = Number(raw.omegaAttenuation ?? 0);
    const category = String(raw.category ?? "");
    const type = String(raw.type ?? "");
    const lowerUniqueName = uniqueName.toLowerCase();

    const looksLikeKitgunChamber =
      category === "Misc" &&
      disposition > 0 &&
      (lowerUniqueName.includes("/barrel/") || lowerUniqueName.includes("/barrels/")) &&
      (lowerUniqueName.includes("/solarisunited/") || lowerUniqueName.includes("/infested/"));

    if (!looksLikeKitgunChamber || !name) continue;

    const weaponCategory =
      type.toLowerCase() === "rifle" || type.toLowerCase() === "primary"
        ? "Primary"
        : "Secondary";

    out.set(uniqueName, {
      uniqueName,
      name,
      category: weaponCategory,
      weaponType: weaponCategory === "Primary" ? "Rifle" : "Pistol",
      modCompat: weaponCategory === "Primary" ? "Rifle" : "Pistol",
      damage: {
        total: 0,
        impact: 0,
        puncture: 0,
        slash: 0,
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
      },
      critChance: 0,
      critMultiplier: 1.5,
      statusChance: 0,
      fireRate: 1,
      magazineSize: 1,
      ammoCostPerShot: 1,
      hasExplicitMagazineSize: false,
      reloadTime: 0,
      multishot: 1,
      trigger: "Auto",
      chargeTime: null,
      polarities: [],
      canOverLevel: false,
      baseSlotCount: 8,
      disposition,
      attacks: [],
      tags: [],
      isProgenitorWeapon: false,
    });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

type ModSortKey = "az" | "release-newest" | "release-oldest" | "rarity-asc" | "rarity-desc" | "rank-asc" | "rank-desc";

const ALL_MODS_BY_PATH: Record<string, AllModEntry> = {};
// Name-based fallback — used when mods.json path doesn't match All.json uniqueName
const ALL_MODS_BY_NAME: Record<string, AllModEntry> = {};
// Arcane lookup by name (arcanes use name not uniqueName as key in some contexts)
const ALL_ARCANES_BY_NAME: Record<string, AllModEntry> = {};
for (const item of ALL_RAW as AllModEntry[]) {
  const entry = withManualReleaseDateFallback(item as AllModEntry);
  if (!entry.uniqueName) continue;
  if (entry.category === "Mods") {
    const existing = ALL_MODS_BY_PATH[entry.uniqueName];
    if (!existing || (entry.levelStats && !existing.levelStats)) {
      ALL_MODS_BY_PATH[entry.uniqueName] = entry as AllModEntry;
    }
    // Name index — prefer entries with levelStats
    if (entry.name) {
      const existingByName = ALL_MODS_BY_NAME[entry.name];
      if (!existingByName || (entry.levelStats && !existingByName.levelStats)) {
        ALL_MODS_BY_NAME[entry.name] = entry as AllModEntry;
      }
    }
  } else if (entry.category === "Arcanes") {
    if (entry.name) ALL_ARCANES_BY_NAME[entry.name] = entry as AllModEntry;
    ALL_MODS_BY_PATH[entry.uniqueName] = entry as AllModEntry;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocKeyWordScript {
  [key: string]: number[] | string | unknown;
}

interface ModUpgrade {
  UpgradeType?: string;
  Value?: number;
  DisplayAsPercent?: number;
  OperationType?: string;
  LocTag?: string;
  LocKeyWordScript?: LocKeyWordScript;
}

interface ModData {
  ArtifactPolarity?: string;
  BaseDrain?: string;
  FusionLimit?: string;
  FusionLimitRange?: [number, number];
  ItemCompatibility?: string;
  Upgrades?: ModUpgrade[];
  Rarity?: string;
}

interface ModEntry {
  path: string;
  name: string;
  categories?: string[];
  parent?: string;
  data?: ModData;
  parents?: string[];
}

type OwnershipFilter = "all" | "owned" | "unowned";

const EMPTY_COUNTS: Record<string, number> = {};
const EMPTY_MOD_RANKS: Record<string, number> = {};
function modKey(path: string): string { return `mods:${path}`; }
function clampModOwnedRank(maxRank: number, raw: number | undefined): number {
  return Math.max(0, Math.min(maxRank, Number(raw ?? maxRank)));
}

type ModGroup =
  | "all"
  | "warframes"
  | "weapons"
  | "companions"
  | "archwing"
  | "necramechs"
  | "kdrives"
  | "augments"
  | "conclave"
  | "railjack"
  | "parazon"
  | "antique"
  | "rivens";

type ModSubtype =
  | "all"
  | "primary"
  | "rifle"
  | "assault-rifle"
  | "shotgun"
  | "sniper"
  | "bow"
  | "pistol"
  | "tome"
  | "melee"
  | "companion"
  | "robotic"
  | "sentinel"
  | "moa"
  | "hound"
  | "beast"
  | "beast-claws"
  | "kubrow"
  | "kavat"
  | "predasite"
  | "vulpaphyla"
  | "archwing"
  | "archgun"
  | "archmelee"
  | "warframe-augment"
  | "weapon-augment";

type ModSpecialFlag = "aura" | "stance" | "exilus";
type TagFilterState = "include" | "exclude";

type Polarity = "madurai" | "vazarin" | "naramon" | "zenurik" | "umbra" | "penjaga" | "any";

type ParazonFilter = "requiem" | "antivirus";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOD_GROUPS: { key: ModGroup; label: string }[] = [
  { key: "all", label: "All" },
  { key: "warframes", label: "Warframes" },
  { key: "weapons", label: "Weapons" },
  { key: "companions", label: "Companions" },
  { key: "archwing", label: "Archwing" },
  { key: "necramechs", label: "Necramechs" },
  { key: "kdrives", label: "K-Drives" },
  { key: "augments", label: "Augments" },
  { key: "conclave", label: "Conclave" },
  { key: "railjack", label: "Railjack" },
  { key: "parazon", label: "Parazon" },
  { key: "antique", label: "Antique" },
  { key: "rivens", label: "Rivens" },
];

const MOD_SUBTYPE_LABELS: Record<ModSubtype, string> = {
  all: "All",
  primary: "Primary",
  rifle: "Rifle",
  "assault-rifle": "Assault Rifle",
  shotgun: "Shotgun",
  sniper: "Sniper",
  bow: "Bow",
  pistol: "Pistol",
  tome: "Tome",
  melee: "Melee",
  companion: "Companion",
  robotic: "Robotic",
  sentinel: "Sentinel",
  moa: "Moa",
  hound: "Hound",
  beast: "Beast",
  "beast-claws": "Beast Claws",
  kubrow: "Kubrow",
  kavat: "Kavat",
  predasite: "Predasite",
  vulpaphyla: "Vulpaphyla",
  archwing: "Archwing",
  archgun: "Archwing Gun",
  archmelee: "Archwing Melee",
  "warframe-augment": "Warframe Augments",
  "weapon-augment": "Weapon Augments",
};

const MOD_GROUP_SUBTYPES: Partial<Record<ModGroup, ModSubtype[]>> = {
  weapons: ["primary", "rifle", "assault-rifle", "shotgun", "sniper", "bow", "pistol", "tome", "melee"],
  companions: ["companion", "robotic", "sentinel", "moa", "hound", "beast", "beast-claws", "kubrow", "kavat", "predasite", "vulpaphyla"],
  archwing: ["archwing", "archgun", "archmelee"],
  augments: ["warframe-augment", "weapon-augment"],
};

const MOD_SPECIAL_FLAG_ORDER: ModSpecialFlag[] = ["aura", "stance", "exilus"];
const MOD_SPECIAL_FLAG_LABELS: Record<ModSpecialFlag, string> = {
  aura: "Aura",
  stance: "Stance",
  exilus: "Exilus",
};

// Polarity SVG assets — use ?url so Vite returns URL strings, not React components
const _polImgs = import.meta.glob<string>("../assets/polarities/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const POL_IMG: Record<string, string> = {};
for (const [p, url] of Object.entries(_polImgs)) {
  const name = p.split("/").pop()!.replace(".svg", "").toLowerCase();
  POL_IMG[name] = url as string;
}

// Status effect PNG assets
const _statusImgs = import.meta.glob<string>("../assets/statuses/*.png", {
  eager: true,
  import: "default",
});
const STATUS_IMG: Record<string, string> = {};
for (const [p, url] of Object.entries(_statusImgs)) {
  const name = p.split("/").pop()!.replace(".png", "").toLowerCase();
  STATUS_IMG[name] = url;
}

// Map DT_ color tags → status image filenames (both bare and _COLOR variants)
const DT_TO_IMG: Record<string, string> = {
  dt_corrosive_color: "essentialcorrosiveglyph",
  dt_corrosive: "essentialcorrosiveglyph",
  dt_electricity_color: "electricmodbundleicon",
  dt_electricity: "electricmodbundleicon",
  dt_explosion_color: "essentialblastglyph",
  dt_explosion: "essentialblastglyph",
  dt_fire_color: "heatmodbundleicon",
  dt_fire: "heatmodbundleicon",
  dt_freeze_color: "coldmodbundleicon",
  dt_freeze: "coldmodbundleicon",
  dt_gas_color: "essentialgasglyph",
  dt_gas: "essentialgasglyph",
  dt_impact_color: "essentialimpactglyph",
  dt_magnetic_color: "essentialmagneticglyph",
  dt_magnetic: "essentialmagneticglyph",
  dt_poison_color: "toxinmodbundleicon",
  dt_poison: "toxinmodbundleicon",
  dt_puncture_color: "essentialpunctureglyph",
  dt_radiant_color: "essentialradiationglyph",
  dt_radiation_color: "essentialradiationglyph",
  dt_radiation: "essentialradiationglyph",
  dt_sentient_color: "essentialtauglyph",
  dt_sentient: "essentialtauglyph",
  dt_slash_color: "essentialslashglyph",
  dt_slash: "essentialslashglyph",
  dt_viral_color: "essentialviralglyph",
  dt_viral: "essentialviralglyph",
};

/** Render a description/stat string:
 *  - Replaces <DT_*> / <DT_*_COLOR> tags with inline status icons
 *  - Strips other formatting tags (<AFFINITY_SHARE>, <HEALTH>, etc.)
 *  - Renders |VAR| placeholders as a subtle "mod-scaled" badge
 */
function renderStatString(stat: string): React.ReactNode {
  const cleaned = stat
    .replace(/<LINE_SEPARATOR>/g, " · ")
    .replace(/<LOWER_IS_BETTER>/g, "")
    .replace(/<[A-Z_]+_SECONDARY_COLOR>/g, "")
    .replace(/<\/[A-Z_]+_SECONDARY_COLOR>/g, "")
    .replace(/<(?!DT_)[A-Z_]+>/g, "");

  // Split on DT_ damage type tags, |VARIABLE| tokens, and newlines
  const parts = cleaned.split(/(<DT_[A-Z_]+>|\|[A-Z_0-9]+\||\n)/);
  if (parts.length === 1) return <>{cleaned}</>;

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "\n") {
      nodes.push(<br key={i} />);
    } else if (part.startsWith("<DT_") && part.endsWith(">")) {
      const key = part.slice(1, -1).toLowerCase();
      const imgName = DT_TO_IMG[key];
      const imgUrl = imgName ? STATUS_IMG[imgName] : null;
      if (imgUrl) {
        nodes.push(
          <img
            key={i}
            src={imgUrl}
            alt={key.replace("dt_", "").replace("_color", "")}
            title={key
              .replace("dt_", "")
              .replace(/_color$/, "")
              .replace(/_/g, " ")}
            className="inline w-3.5 h-3.5 object-contain mx-0.5 -mt-0.5"
          />,
        );
      }
    } else if (part.startsWith("|") && part.endsWith("|")) {
      const label = part.slice(1, -1).toLowerCase().replace(/_/g, " ");
      nodes.push(
        <span
          key={i}
          className="inline-flex items-center rounded px-1 py-0 text-[10px] font-mono bg-slate-700/60 text-slate-400 border border-slate-600/50 mx-0.5"
          title="Exact value scales with Warframe stats and mods"
        >
          {label}
        </span>,
      );
    } else if (part) {
      nodes.push(<span key={i}>{part}</span>);
    }
  }
  return <>{nodes}</>;
}
// Helper: get polarity image URL by AP_ key
function polImg(ap: string | undefined): string | null {
  if (!ap) return null;
  const key = ap.replace("AP_", "").toLowerCase();
  // Map AP names to file names
  const fileMap: Record<string, string> = {
    attack: "madurai_pol",
    defense: "vazarin_pol",
    tactic: "naramon_pol",
    power: "zenurik_pol",
    umbra: "umbra_pol",
    ward: "unairu_pol",
    penjaga: "penjaga_pol",
    any: "any_pol",
  };
  const fname = fileMap[key];
  if (!fname) return null;
  return POL_IMG[fname] ?? null;
}


/** Convert All.json polarity name (e.g. "naramon") to AP_ format (e.g. "AP_TACTIC")
 *  so it works with polImg() and polarityLabel() */
const POLARITY_NAME_TO_AP: Record<string, string> = {
  madurai: "AP_ATTACK",
  vazarin: "AP_DEFENSE",
  naramon: "AP_TACTIC",
  zenurik: "AP_POWER",
  umbra: "AP_UMBRA",
  unairu: "AP_WARD",
  penjaga: "AP_PENJAGA",
  any: "AP_ANY",
};
function toAP(polarity: string | undefined): string | undefined {
  if (!polarity) return undefined;
  if (polarity.startsWith("AP_")) return polarity; // already in AP_ format
  return POLARITY_NAME_TO_AP[polarity.toLowerCase()];
}

const POLARITIES: { key: Polarity; label: string; ap: string }[] = [
  { key: "madurai", label: "Madurai", ap: "AP_ATTACK" },
  { key: "vazarin", label: "Vazarin", ap: "AP_DEFENSE" },
  { key: "naramon", label: "Naramon", ap: "AP_TACTIC" },
  { key: "zenurik", label: "Zenurik", ap: "AP_POWER" },
  { key: "umbra", label: "Umbra", ap: "AP_UMBRA" },
  { key: "penjaga", label: "Penjaga", ap: "AP_PENJAGA" },
  { key: "any", label: "Any", ap: "AP_ANY" },
];
const POLARITY_AP_BY_KEY: Record<Polarity, string> = Object.fromEntries(
  POLARITIES.map((entry) => [entry.key, entry.ap]),
) as Record<Polarity, string>;

// Endo + credit base costs (EBC/CrBC) by rarity — verified from Warframe wiki
// Endo:   Common=10, Uncommon/Peculiar=20, Rare/Amalgam/Riven=30, Legendary=40
// Credit: Common=483, Uncommon/Peculiar=966, Rare/Amalgam/Riven=1449, Legendary=1932
const ENDO_BASE: Record<string, number> = {
  COMMON: 10,
  UNCOMMON: 20,
  PECULIAR: 20,
  RARE: 30,
  AMALGAM: 30,
  LEGENDARY: 40,
};
const CREDIT_BASE: Record<string, number> = {
  COMMON: 483,
  UNCOMMON: 966,
  PECULIAR: 966,
  RARE: 1449,
  AMALGAM: 1449,
  LEGENDARY: 1932,
};

/** Calculate total endo cost from fromRank (exclusive) to toRank (inclusive).
 *  Formula: sum of EBC × 2^r for r from fromRank to toRank-1
 *  Which equals: EBC × 2^fromRank × (2^(toRank-fromRank) - 1)
 */
function calcEndoCost(
  rarity: string | undefined,
  fromRank: number,
  toRank: number,
): number {
  const ebc = ENDO_BASE[rarity?.toUpperCase() ?? "COMMON"] ?? 10;
  if (toRank <= fromRank) return 0;
  // Sum EBC × 2^r for r = fromRank..toRank-1
  let total = 0;
  for (let r = fromRank; r < toRank; r++) {
    total += ebc * Math.pow(2, r);
  }
  return total;
}

/** Calculate total credit cost from fromRank (exclusive) to toRank (inclusive).
 *  Same formula structure as endo but using CrBC.
 */
function calcCreditCost(
  rarity: string | undefined,
  fromRank: number,
  toRank: number,
): number {
  const crbc = CREDIT_BASE[rarity?.toUpperCase() ?? "COMMON"] ?? 483;
  if (toRank <= fromRank) return 0;
  let total = 0;
  for (let r = fromRank; r < toRank; r++) {
    total += crbc * Math.pow(2, r);
  }
  return total;
}

const UPGRADE_TYPE_LABELS: Record<string, string> = {
  WEAPON_DAMAGE_AMOUNT: "Damage",
  WEAPON_FIRE_RATE: "Fire Rate",
  WEAPON_RELOAD_SPEED: "Reload Speed",
  WEAPON_AMMO_EFFICIENCY: "Ammo Efficiency",
  WEAPON_AMMO_MAX: "Ammo Max",
  WEAPON_MULTISHOT: "Multishot",
  WEAPON_RANGE: "Range",
  WEAPON_PUNCH_THROUGH: "Punch Through",
  WEAPON_ZOOM: "Zoom",
  WEAPON_CRITICAL_CHANCE: "Critical Chance",
  WEAPON_CRITICAL_DAMAGE: "Critical Damage",
  WEAPON_STATUS_CHANCE: "Status Chance",
  WEAPON_STATUS_DURATION: "Status Duration",
  WEAPON_RECOIL: "Recoil",
  WEAPON_SPREAD: "Accuracy",
  WEAPON_DAMAGE_TYPE_FIRE: "Heat Damage",
  WEAPON_DAMAGE_TYPE_COLD: "Cold Damage",
  WEAPON_DAMAGE_TYPE_ELECTRIC: "Electric Damage",
  WEAPON_DAMAGE_TYPE_TOXIN: "Toxin Damage",
  WEAPON_DAMAGE_TYPE_BLAST: "Blast Damage",
  WEAPON_DAMAGE_TYPE_CORROSIVE: "Corrosive Damage",
  WEAPON_DAMAGE_TYPE_VIRAL: "Viral Damage",
  WEAPON_DAMAGE_TYPE_RADIATION: "Radiation Damage",
  WEAPON_DAMAGE_TYPE_MAGNETIC: "Magnetic Damage",
  WEAPON_DAMAGE_TYPE_GAS: "Gas Damage",
  WEAPON_AMMO_CONSUME_RATE: "Ammo Consumption",
  AVATAR_ABILITY_STRENGTH: "Ability Strength",
  AVATAR_ABILITY_DURATION: "Ability Duration",
  AVATAR_ABILITY_RANGE: "Ability Range",
  AVATAR_ABILITY_EFFICIENCY: "Ability Efficiency",
  AVATAR_MAX_SHIELDS: "Shield Capacity",
  AVATAR_MAX_HEALTH: "Health",
  AVATAR_MAX_POWER: "Energy Max",
  AVATAR_POWER_REGEN: "Energy Regen",
  AVATAR_ARMOR: "Armor",
  AVATAR_SPRINT_BOOST: "Sprint Speed",
  AVATAR_ABILITY_AUGMENT: "Ability Augment",
  MELEE_ATTACK_SPEED: "Attack Speed",
  MELEE_CRITICAL_CHANCE: "Critical Chance",
  MELEE_CRITICAL_DAMAGE: "Critical Damage",
  MELEE_STATUS_CHANCE: "Status Chance",
  MELEE_RANGE: "Melee Range",
  MELEE_CHANNELING_EFFICIENCY: "Channeling Efficiency",
};

function labelForUpgradeType(type: string | undefined): string {
  if (!type) return "Effect";
  return (
    UPGRADE_TYPE_LABELS[type] ??
    type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeMaxRank(qa: string | undefined): number {
  switch (qa) {
    case "QA_NONE":
      return 0;
    case "QA_LOW":
      return 3;
    case "QA_MEDIUM":
      return 5;
    case "QA_HIGH":
      return 5;
    case "QA_VERY_HIGH":
      return 10;
    default:
      return 5;
  }
}

function decodeBaseDrain(qa: string | undefined): number {
  switch (qa) {
    case "QA_NONE":
      return 0;
    case "QA_LOW":
      return 2;
    case "QA_MEDIUM":
      return 4;
    case "QA_HIGH":
      return 6;
    case "QA_VERY_HIGH":
      return 10;
    default:
      return 4;
  }
}

function formatValue(v: number, displayAsPercent: number | undefined): string {
  if (displayAsPercent) {
    const pct = Math.round(v * 100 * 10) / 10;
    return (v >= 0 ? "+" : "") + pct + "%";
  }
  return (v >= 0 ? "+" : "") + String(Math.round(v * 100) / 100);
}

function polarityLabel(ap: string | undefined): string {
  const p = POLARITIES.find((x) => x.ap === ap);
  if (p) return p.label;
  if (ap === "AP_WARD") return "Aura";
  if (ap === "AP_PRECEPT") return "Precept";
  return ap ? ap.replace("AP_", "") : "—";
}

const RARITY_ORDER: Record<string, number> = { COMMON: 0, UNCOMMON: 1, RARE: 2, LEGENDARY: 3 };

function rarityRank(rarity: string | undefined): number {
  return RARITY_ORDER[rarity?.toUpperCase() ?? ""] ?? -1;
}

function modMaxRank(e: ModEntry): number {
  const fromData = e.data?.FusionLimitRange?.[1] ?? (e.data?.FusionLimit ? Number(e.data.FusionLimit) : undefined);
  if (typeof fromData === "number" && Number.isFinite(fromData)) return fromData;
  const allEntry = ALL_MODS_BY_PATH[e.path] ?? ALL_MODS_BY_NAME[e.name];
  return allEntry?.fusionLimit ?? 0;
}

function modRarity(e: ModEntry): string | undefined {
  const fromData = e.data?.Rarity;
  if (fromData) return fromData.toUpperCase();
  const allEntry = ALL_MODS_BY_PATH[e.path] ?? ALL_MODS_BY_NAME[e.name];
  return allEntry?.rarity?.toUpperCase();
}

function isTrainingModPath(path: string): boolean {
  return /\/(beginner|intermediate|expert)\//i.test(path);
}

function isBaseTemplateModPath(path: string): boolean {
  return /Base$/i.test(path);
}

function expectedBrowseFusionLimit(name: string): number {
  if (/^(Primed|Galvanized|Amalgam|Archon)\b/i.test(name)) return 10;
  if (/^Umbral\b/i.test(name)) return 10;
  if (/\b(Cannonade|Aptitude|Chamber|Acceleration|Barrage)\b/i.test(name)) return 10;
  if (/^Serration$/i.test(name)) return 10;
  return 5;
}

function normalizeBrowseModPath(path: string): string {
  return path
    .replace(/\/(Beginner|Intermediate|Expert)\//g, "/")
    .replace(/(Beginner|Intermediate|Expert)$/g, "");
}

function isBeginnerPath(path: string): boolean {
  return /\/beginner\//i.test(path) || /Beginner$/i.test(path);
}

function isExpertPath(path: string): boolean {
  return /\/expert\//i.test(path) || /Expert$/i.test(path);
}

const TRAINING_VARIANT_TIERS = new Map<string, "flawed" | "expert">();
for (const item of ALL_RAW as AllModEntry[]) {
  if (item.category !== "Mods" || !item.name || !item.uniqueName) continue;
  const normalizedPath = normalizeBrowseModPath(item.uniqueName);
  const key = `${item.name}||${normalizedPath}`;
  const current = TRAINING_VARIANT_TIERS.get(key);
  if (current) continue;

  const family = (ALL_RAW as AllModEntry[]).filter((candidate) =>
    candidate.category === "Mods" &&
    candidate.name === item.name &&
    candidate.uniqueName &&
    normalizeBrowseModPath(candidate.uniqueName) === normalizedPath,
  );
  const hasStandard = family.some((candidate) => {
    const path = candidate.uniqueName ?? "";
    return !isBeginnerPath(path) && !isExpertPath(path);
  });
  if (!hasStandard) continue;
  if (family.some((candidate) => isBeginnerPath(candidate.uniqueName ?? ""))) {
    TRAINING_VARIANT_TIERS.set(`${item.name}||${normalizedPath}||flawed`, "flawed");
  }
  if (family.some((candidate) => isExpertPath(candidate.uniqueName ?? ""))) {
    TRAINING_VARIANT_TIERS.set(`${item.name}||${normalizedPath}||expert`, "expert");
  }
}

function getModVariantTier(entry: ModEntry): "flawed" | "standard" | "expert" {
  const normalizedPath = normalizeBrowseModPath(entry.path);
  if (isBeginnerPath(entry.path) && TRAINING_VARIANT_TIERS.has(`${entry.name}||${normalizedPath}||flawed`)) {
    return "flawed";
  }
  if (isExpertPath(entry.path) && TRAINING_VARIANT_TIERS.has(`${entry.name}||${normalizedPath}||expert`)) {
    return "expert";
  }
  return "standard";
}

function getDisplayModName(entry: ModEntry): string {
  const tier = getModVariantTier(entry);
  if (tier === "flawed") return `${entry.name} (Flawed)`;
  if (tier === "expert") return `${entry.name} (Expert)`;
  return entry.name;
}

function getBrowseCompatKey(entry: ModEntry): string {
  return (
    ALL_MODS_BY_PATH[entry.path]?.compatName ??
    ALL_MODS_BY_NAME[entry.name]?.compatName ??
    entry.data?.ItemCompatibility ??
    ""
  );
}

function getBrowseModFamilyKey(entry: ModEntry): string {
  const variantTier = getModVariantTier(entry);
  return `${entry.name}||${variantTier}||${getBrowseCompatKey(entry)}`;
}

function browseModDedupScore(entry: ModEntry): number {
  const maxRank = modMaxRank(entry);
  let score = 0;
  const tier = getModVariantTier(entry);
  if (!isTrainingModPath(entry.path)) score += 1000;
  if (tier === "standard" && /\/intermediate\//i.test(entry.path)) score -= 250;
  if (!isBaseTemplateModPath(entry.path)) score += 500;
  if (entry.data) score += 100;
  score -= Math.abs(maxRank - expectedBrowseFusionLimit(entry.name)) * 10;
  score += maxRank;
  return score;
}

function dedupeBrowseMods(entries: ModEntry[]): ModEntry[] {
  const bestByFamily = new Map<string, { entry: ModEntry; score: number; rank: number }>();
  for (const entry of entries) {
    const key = getBrowseModFamilyKey(entry);
    const score = browseModDedupScore(entry);
    const rank = modMaxRank(entry);
    const current = bestByFamily.get(key);
    if (!current || score > current.score || (score === current.score && rank > current.rank)) {
      bestByFamily.set(key, { entry, score, rank });
    }
  }
  return [...bestByFamily.values()].map((value) => value.entry);
}

function getModAvailabilityNote(entry: ModEntry): string | null {
  if (getModVariantTier(entry) === "flawed") {
    return null;
  }
  if (getModVariantTier(entry) === "expert") {
    return "This expert-tier variant exists in the game data, but it does not appear to have ever been introduced into the live game.";
  }
  return null;
}

function shouldUseLegacyNameDrops(entry: ModEntry): boolean {
  return getModVariantTier(entry) === "standard";
}

function shouldSuppressExactDrops(entry: ModEntry, allEntry: AllModEntry | undefined): boolean {
  if (getModVariantTier(entry) === "flawed") return true;
  return getModVariantTier(entry) === "expert" && !allEntry?.introduced && !allEntry?.releaseDate;
}

function getFlawedModCreditCost(rarity: string | undefined): number {
  switch ((rarity ?? "").toUpperCase()) {
    case "COMMON":
      return 10_000;
    case "UNCOMMON":
      return 20_000;
    case "RARE":
      return 30_000;
    default:
      return 20_000;
  }
}

function rarityColor(rarity: string | undefined): string {
  switch (rarity) {
    case "COMMON":
      return "text-slate-400";
    case "UNCOMMON":
      return "text-amber-400";
    case "RARE":
      return "text-orange-400";
    case "LEGENDARY":
      return "text-cyan-300";
    default:
      return "text-slate-400";
  }
}

function rarityBg(rarity: string | undefined): string {
  switch (rarity) {
    case "COMMON":
      return "bg-slate-800/60 border-slate-700";
    case "UNCOMMON":
      return "bg-amber-950/30 border-amber-800/50";
    case "RARE":
      return "bg-orange-950/30 border-orange-800/50";
    case "LEGENDARY":
      return "bg-cyan-950/30 border-cyan-800/50";
    default:
      return "bg-slate-800/60 border-slate-700";
  }
}

function normalize(s: string): string {
  return s.toLowerCase();
}

// ─── Classification ────────────────────────────────────────────────────────────

interface ModTaxonomy {
  groups: Set<ModGroup>;
  subtypes: Set<ModSubtype>;
  flags: Set<ModSpecialFlag>;
}

const MOD_TAXONOMY_CACHE = new Map<string, ModTaxonomy>();

const KNOWN_GENERIC_COMPAT = new Set([
  "WARFRAME",
  "ANY",
  "COMPANION",
  "ROBOTIC",
  "BEAST",
  "AURA",
  "PRIMARY",
  "Melee",
  "Pistol",
  "Shotgun",
  "Rifle",
  "Assault Rifle",
  "Sniper",
  "Bow",
  "K-Drive",
  "Archwing",
  "Necramech",
  "Archgun",
  "Archmelee",
  "Moa",
  "Hound",
  "Kavat",
  "Kubrow",
  "Sentinel",
  "Parazon",
  "Tome",
  "Claws",
  "Daggers",
  "Dual Daggers",
  "Thrown Melee",
  "",
]);

function hasSpecificCompat(compatName: string): boolean {
  return !!compatName && !KNOWN_GENERIC_COMPAT.has(compatName);
}

function addWeaponSubtype(subtypes: Set<ModSubtype>, compatName: string, modType: string) {
  if (modType === "Shotgun Mod") {
    subtypes.add("shotgun");
    return;
  }
  if (modType === "Secondary Mod" || modType === "Tome Mod") {
    subtypes.add(compatName === "Tome" || modType === "Tome Mod" ? "tome" : "pistol");
    return;
  }
  if (modType === "Melee Mod" || modType === "Stance Mod") {
    subtypes.add("melee");
    return;
  }
  if (modType === "Primary Mod") {
    subtypes.add("primary");
    const upperCompat = compatName.toUpperCase();
    if (upperCompat === "RIFLE") subtypes.add("rifle");
    else if (upperCompat === "ASSAULT RIFLE") subtypes.add("assault-rifle");
    else if (upperCompat === "SNIPER") subtypes.add("sniper");
    else if (upperCompat === "BOW") subtypes.add("bow");
    else if (upperCompat === "SHOTGUN") subtypes.add("shotgun");
  }
}

function classifyCompanionSubtype(compatName: string): ModSubtype[] {
  const upperCompat = compatName.toUpperCase();
  const out: ModSubtype[] = ["companion"];
  if (upperCompat === "ROBOTIC") out.push("robotic");
  if (upperCompat === "BEAST") out.push("beast");
  if (upperCompat.includes("SENTINEL")) out.push("robotic", "sentinel");
  if (upperCompat === "MOA") out.push("robotic", "moa");
  if (upperCompat === "HOUND") out.push("robotic", "hound");
  if (upperCompat === "KUBROW") out.push("beast", "kubrow");
  if (upperCompat === "KAVAT") out.push("beast", "kavat");
  if (upperCompat.includes("PREDASITE")) out.push("beast", "predasite");
  if (upperCompat.includes("VULPAPHYLA")) out.push("beast", "vulpaphyla");
  if (upperCompat === "CLAWS") out.push("beast", "beast-claws");
  return out;
}

function getModTaxonomy(entry: ModEntry): ModTaxonomy {
  const path = entry.path ?? "";
  const cached = MOD_TAXONOMY_CACHE.get(path);
  if (cached) return cached;

  const compat = entry.data?.ItemCompatibility ?? "";
  const polarity = entry.data?.ArtifactPolarity ?? "";

  const allEntry = ALL_MODS_BY_PATH[path] ?? ALL_MODS_BY_NAME[entry.name ?? ""];
  const modType = allEntry?.type ?? "";
  const compatName = allEntry?.compatName ?? "";
  const pathLower = path.toLowerCase();
  const groups = new Set<ModGroup>();
  const subtypes = new Set<ModSubtype>();
  const flags = new Set<ModSpecialFlag>();

  const isAura = compatName === "AURA" || path.includes("/Mods/Aura/") || polarity === "AP_WARD";
  const isExilus = !!allEntry?.isExilus || path.includes("OrokinChallenge");
  const isConclave = pathLower.includes("/pvp") || pathLower.includes("pvpaugment");
  const isWarframeAugment = modType === "Warframe Mod" && hasSpecificCompat(compatName);
  const isWeaponAugment =
    (modType === "Primary Mod" ||
      modType === "Shotgun Mod" ||
      modType === "Secondary Mod" ||
      modType === "Tome Mod" ||
      modType === "Melee Mod") &&
    hasSpecificCompat(compatName);
  const isStance = modType === "Stance Mod" || modType === "Posture Mod";

  if (isAura) flags.add("aura");
  if (isExilus) flags.add("exilus");
  if (isStance) flags.add("stance");

  switch (modType) {
    case "Warframe Mod":
      groups.add("warframes");
      break;
    case "Primary Mod":
    case "Shotgun Mod":
    case "Secondary Mod":
    case "Tome Mod":
    case "Melee Mod":
      groups.add("weapons");
      addWeaponSubtype(subtypes, compatName, modType);
      break;
    case "Stance Mod":
      if (compatName.toLowerCase().includes("arch")) {
        groups.add("archwing");
        subtypes.add("archmelee");
      } else {
        groups.add("weapons");
        subtypes.add("melee");
      }
      break;
    case "Posture Mod":
      groups.add("companions");
      subtypes.add("companion");
      subtypes.add("beast");
      subtypes.add("beast-claws");
      break;
    case "Companion Mod":
      groups.add("companions");
      for (const subtype of classifyCompanionSubtype(compatName)) subtypes.add(subtype);
      break;
    case "Plexus Mod":
    case "Railjack Mod":
      groups.add("railjack");
      break;
    case "Archwing Mod":
      groups.add("archwing");
      subtypes.add("archwing");
      break;
    case "Arch-Gun Mod":
      groups.add("archwing");
      subtypes.add("archgun");
      break;
    case "Arch-Melee Mod":
      groups.add("archwing");
      subtypes.add("archmelee");
      break;
    case "Necramech Mod":
      groups.add("necramechs");
      break;
    case "K-Drive Mod":
      groups.add("kdrives");
      break;
    case "Parazon Mod":
      groups.add("parazon");
      break;
    case "Tektolyst Artifact Mod":
      groups.add("antique");
      break;
  }

  if (groups.size === 0) {
    if (compat.includes("Grimoire") || path.includes("Invocation")) {
      groups.add("weapons");
      subtypes.add("tome");
    } else if (compat.includes("TnHackingDevice") || compat.includes("HackingDevice")) {
      groups.add("parazon");
    } else if (compat.includes("Antique")) {
      groups.add("antique");
    } else if (isAura || compat.includes("PlayerPowerSuit")) {
      groups.add("warframes");
    } else if (compat.includes("ArchGun")) {
      groups.add("archwing");
      subtypes.add("archgun");
    } else if (compat.includes("ArchMeleeWeapon") || compat.includes("ArchMelee")) {
      groups.add("archwing");
      subtypes.add("archmelee");
    } else if (compat.includes("BaseMechSuit")) {
      groups.add("necramechs");
    } else if (compat.includes("HoverboardSuit")) {
      groups.add("kdrives");
    } else if (compat.includes("FlightJetPack")) {
      groups.add("archwing");
      subtypes.add("archwing");
    } else if (compat.includes("SentinelPowerSuit") || compat.includes("ZanukaPet") || compat.includes("MoaPet")) {
      groups.add("companions");
      subtypes.add("companion");
      subtypes.add("robotic");
    } else if (compat.includes("CatbrowPet") || compat.includes("BeastPet") || compat.includes("KubrowPet")) {
      groups.add("companions");
      subtypes.add("companion");
      subtypes.add("beast");
    } else if (compat.includes("Railjack") || compat.includes("CrewShip")) {
      groups.add("railjack");
    } else if (compat.includes("PlayerMeleeWeapon")) {
      groups.add("weapons");
      subtypes.add("melee");
    } else if (compat.includes("LotusPistol") || compat.includes("LotusAkimbo")) {
      groups.add("weapons");
      subtypes.add("pistol");
    } else if (
      compat.includes("LotusRifle") ||
      compat.includes("LotusShotgun") ||
      compat.includes("LotusBow") ||
      compat.includes("LotusLongGun")
    ) {
      groups.add("weapons");
      subtypes.add("primary");
    } else if (compat.includes("/Lotus/Powersuits/") && !compat.includes("PlayerPowerSuit")) {
      groups.add("augments");
      subtypes.add("warframe-augment");
    } else {
      groups.add("warframes");
    }
  }

  if (isWarframeAugment) {
    groups.add("augments");
    groups.add("warframes");
    subtypes.add("warframe-augment");
  }
  if (isWeaponAugment) {
    groups.add("augments");
    groups.add("weapons");
    subtypes.add("weapon-augment");
    addWeaponSubtype(subtypes, compatName, modType);
  }
  if (isConclave) groups.add("conclave");

  const isMeleeWeaponMod = groups.has("weapons") && subtypes.has("melee");
  const canUseExilus =
    groups.has("warframes") ||
    groups.has("archwing") ||
    (groups.has("weapons") && (subtypes.has("primary") || subtypes.has("pistol") || subtypes.has("melee")));

  if (!isMeleeWeaponMod) flags.delete("stance");
  if (!canUseExilus) flags.delete("exilus");

  const taxonomy = { groups, subtypes, flags };
  MOD_TAXONOMY_CACHE.set(path, taxonomy);
  return taxonomy;
}

// ─── Data Preparation ─────────────────────────────────────────────────────────

// Build mod-location lookup by name (lowercase)
type EnemyDrop = {
  enemyName: string;
  rarity: string;
  chance: number;
  enemyModDropChance: number;
};
type ModLocationEntry = { modName: string; enemies: EnemyDrop[] };

const modLocationLookup = new Map<string, EnemyDrop[]>();
const rawLocations = (MOD_LOCATIONS_RAW as any).modLocations as
  | ModLocationEntry[]
  | undefined;
if (Array.isArray(rawLocations)) {
  for (const entry of rawLocations) {
    if (entry.modName && Array.isArray(entry.enemies)) {
      modLocationLookup.set(normalize(entry.modName), entry.enemies);
    }
  }
}

// Parse mods.json
const ALL_ENTRIES: ModEntry[] = Object.entries(MODS_RAW as Record<string, any>)
  .map(([path, val]) => ({ path, ...val }) as ModEntry)
  .filter((e) => e.name && typeof e.name === "string" && !isHiddenModPath(e.path));

// Mods (category "mod"), excluding OperatorSuit ones (those are arcanes)
const MOD_ENTRIES_BASE: ModEntry[] = ALL_ENTRIES.filter(
  (e) =>
    e.categories?.[0] === "mod" &&
    e.data?.ItemCompatibility !== "/Lotus/Powersuits/Operator/OperatorSuit",
);

// Supplement with mods from All.json that are missing from mods.json.
// This catches PvP/event/oddball mods like Air Martial that the builder can still surface.
const MODS_BASE_PATHS = new Set(MOD_ENTRIES_BASE.map((e) => e.path));
const ALL_MODS_SUPPLEMENT: ModEntry[] = (ALL_RAW as any[])
  .filter(
    (item) =>
      item.category === "Mods" &&
      item.name &&
      item.name !== "Unfused Artifact" &&
      item.type !== "Arcane" &&
      item.type !== "Focus Way" &&
      item.type !== "Mod Set Mod" &&
      !String(item.type ?? "").includes("Riven") &&
      item.compatName !== "Operator" &&
      !isLegacyFocusNodePath(String(item.uniqueName ?? "")) &&
      !isHiddenModPath(String(item.uniqueName ?? "")) &&
      !MODS_BASE_PATHS.has(item.uniqueName),
  )
  .map((item) => ({
    path: item.uniqueName as string,
    name: item.name as string,
    categories: ["mod"] as string[],
    data: undefined,
  }));

const MOD_ENTRIES: ModEntry[] = [...MOD_ENTRIES_BASE, ...ALL_MODS_SUPPLEMENT];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <WorkspaceSection title={title} subtitle={subtitle} headingLevel={1} className={className} bodyClassName={bodyClassName}>
      {children}
    </WorkspaceSection>
  );
}

function SubPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "px-2.5 py-1 rounded-md text-xs border transition-colors whitespace-nowrap",
        active
          ? "bg-slate-700 text-slate-100 border-slate-500"
          : "bg-transparent text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-200",
      ].join(" ")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function cycleTagFilterState(current?: TagFilterState): TagFilterState | undefined {
  if (current === "include") return "exclude";
  if (current === "exclude") return undefined;
  return "include";
}

function splitTagFilterState<T extends string>(filters: Partial<Record<T, TagFilterState>>) {
  const included: T[] = [];
  const excluded: T[] = [];
  for (const [key, value] of Object.entries(filters) as Array<[T, TagFilterState]>) {
    if (value === "include") included.push(key);
    if (value === "exclude") excluded.push(key);
  }
  return { included, excluded };
}

function FilterTagPill({
  label,
  state,
  onClick,
  title,
}: {
  label: ReactNode;
  state?: TagFilterState;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      title={title}
      className={[
        "px-2.5 py-1 rounded-md text-xs border transition-colors whitespace-nowrap",
        state === "include"
          ? "bg-slate-100 text-slate-900 border-slate-100"
          : state === "exclude"
            ? "bg-rose-950/30 text-rose-200 border-rose-800/70"
            : "bg-transparent text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-200",
      ].join(" ")}
      onClick={onClick}
    >
      <span className={state === "exclude" ? "line-through decoration-rose-300/70" : undefined}>
        {label}
      </span>
    </button>
  );
}

function OwnershipPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return <WorkspacePillButton label={label} active={active} onClick={onClick} />;
}

function matchesOwnershipFilter(totalOwned: number, filter: OwnershipFilter): boolean {
  if (filter === "owned") return totalOwned > 0;
  if (filter === "unowned") return totalOwned === 0;
  return true;
}

function baseLedgerShellClassName() {
  return COLLECTION_LEDGER_SHELL_CLASS;
}

function CatalogControlBand({
  query,
  onQueryChange,
  queryPlaceholder,
  ownershipFilter,
  onOwnershipChange,
  sortValue,
  onSortChange,
  sortOptions,
  onClearDetail,
  extraAction,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  queryPlaceholder: string;
  ownershipFilter: OwnershipFilter;
  onOwnershipChange: (value: OwnershipFilter) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
  sortOptions: Array<{ value: string; label: string }>;
  onClearDetail: () => void;
  extraAction?: ReactNode;
}) {
  return (
    <CollectionUtilityBand
      columnsClassName="xl:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.9fr)]"
      primary={
        <CollectionUtilityPanel>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Search Catalog
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-base text-slate-100 placeholder:text-slate-500"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={queryPlaceholder}
            />
          </label>

          <div className="mt-3 grid gap-2 lg:grid-cols-[auto_1fr] lg:items-start">
            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Ownership
            </div>
            <WorkspaceFilterGroup className="gap-2">
              <OwnershipPill label="All" active={ownershipFilter === "all"} onClick={() => onOwnershipChange("all")} />
              <OwnershipPill label="Owned" active={ownershipFilter === "owned"} onClick={() => onOwnershipChange("owned")} />
              <OwnershipPill label="Unowned" active={ownershipFilter === "unowned"} onClick={() => onOwnershipChange("unowned")} />
            </WorkspaceFilterGroup>
          </div>
        </CollectionUtilityPanel>
      }
      secondary={
        <CollectionUtilityPanel className="grid gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sort Rows
            </span>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <WorkspaceAction
              className="rounded-full border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
              onClick={onClearDetail}
            >
              Clear Detail
            </WorkspaceAction>
            {extraAction}
          </div>
        </CollectionUtilityPanel>
      }
    />
  );
}

function LedgerResultsBand({
  rowsLabel,
  filterCount,
  onResetFilters,
  extraAction,
}: {
  rowsLabel: string;
  filterCount: number;
  onResetFilters: () => void;
  extraAction?: ReactNode;
}) {
  return (
    <CollectionResultsBand
      actions={
        <WorkspaceFilterGroup className="text-xs text-slate-400">
          <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5">
            {rowsLabel}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5">
            Filters: {filterCount}
          </span>
          <WorkspaceAction
            className="rounded-full border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={filterCount === 0}
            onClick={onResetFilters}
          >
            Clear filters
          </WorkspaceAction>
          {extraAction}
        </WorkspaceFilterGroup>
      }
    />
  );
}

function makeRivenId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `riven_${Math.random().toString(36).slice(2, 10)}`;
}

function formatCustomRivenStatsLabel(stats: CustomRivenStatValue[]): string {
  return stats
    .filter((stat) => stat.value !== 0)
    .map((stat) => {
      const definition = getCustomRivenStatDef(stat.stat);
      if (!definition) return `${stat.value > 0 ? "+" : ""}${stat.value.toFixed(1)} ${stat.stat}`;
      return formatRivenStatValue(definition, stat.value);
    })
    .join("  ·  ");
}

function CustomRivenModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: CustomRivenInventoryRecord | null;
  onClose: () => void;
  onSave: (record: CustomRivenInventoryRecord) => void;
}) {
  const eligibleWeapons = useMemo(
    () => {
      const combined = new Map<string, ReturnType<typeof getWeaponCatalog>[number]>();
      for (const weapon of getWeaponCatalog().filter((entry) => !entry.isExalted && entry.disposition > 0)) {
        combined.set(weapon.uniqueName, weapon);
      }
      for (const weapon of getSupplementalRivenWeapons()) {
        if (!combined.has(weapon.uniqueName)) combined.set(weapon.uniqueName, weapon);
      }
      return [...combined.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    [],
  );
  const [weaponUniqueName, setWeaponUniqueName] = useState("");
  const [weaponQuery, setWeaponQuery] = useState("");
  const [weaponPickerOpen, setWeaponPickerOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [drain, setDrain] = useState(16);
  const [polarity, setPolarity] = useState("");
  const [polarityPickerOpen, setPolarityPickerOpen] = useState(false);
  const [stats, setStats] = useState<CustomRivenStatValue[]>([
    { stat: "damage", value: 0 },
    { stat: "criticalChance", value: 0 },
  ]);
  const [statQueries, setStatQueries] = useState(["Damage", "Critical Chance"]);
  const [openStatPickerIndex, setOpenStatPickerIndex] = useState<number | null>(null);
  const [statSigns, setStatSigns] = useState<Array<1 | -1>>([1, 1]);
  const initialId = initial?.id ?? null;
  const initialUpdatedAtIso = initial?.updatedAtIso ?? null;
  const defaultWeaponUniqueName = eligibleWeapons[0]?.uniqueName ?? "";
  const weaponPickerRef = useRef<HTMLDivElement | null>(null);
  const polarityPickerRef = useRef<HTMLDivElement | null>(null);
  const statPickerRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setWeaponUniqueName(initial.sourceWeaponUniqueName);
      setWeaponQuery(initial.sourceWeaponName);
      setWeaponPickerOpen(false);
      setPolarityPickerOpen(false);
      setName(initial.name);
      setNameDirty(true);
      setDrain(initial.drain);
      setPolarity(initial.polarity);
      setStats(
        initial.stats.length > 0
          ? initial.stats.map((stat) => ({ ...stat, stat: getCustomRivenStatDef(stat.stat)?.key ?? stat.stat }))
          : [{ stat: "damage", value: 0 }, { stat: "criticalChance", value: 0 }],
      );
      setStatQueries(
        initial.stats.length > 0
          ? initial.stats.map((stat) => getCustomRivenStatDef(stat.stat)?.label ?? stat.stat)
          : ["Damage", "Critical Chance"],
      );
      setOpenStatPickerIndex(null);
      setStatSigns(
        (initial.stats.length > 0
          ? initial.stats.map((stat) => (stat.value < 0 ? -1 : 1))
          : [1, 1]) as Array<1 | -1>,
      );
      return;
    }
    setWeaponUniqueName(defaultWeaponUniqueName);
    setWeaponQuery(eligibleWeapons.find((weapon) => weapon.uniqueName === defaultWeaponUniqueName)?.name ?? "");
    setWeaponPickerOpen(false);
    setPolarityPickerOpen(false);
    setNameDirty(false);
    setName("");
    setDrain(16);
    setPolarity("");
    setStats([
      { stat: "damage", value: 0 },
      { stat: "criticalChance", value: 0 },
    ]);
    setStatQueries(["Damage", "Critical Chance"]);
    setOpenStatPickerIndex(null);
    setStatSigns([1, 1]);
  }, [open, initialId, initialUpdatedAtIso, defaultWeaponUniqueName, eligibleWeapons]);

  const selectedWeapon = eligibleWeapons.find((weapon) => weapon.uniqueName === weaponUniqueName) ?? null;
  const filteredWeapons = useMemo(() => {
    const query = weaponQuery.trim().toLowerCase();
    if (!query) return eligibleWeapons.slice(0, 40);
    const direct = eligibleWeapons.filter((weapon) => weapon.name.toLowerCase().includes(query));
    return direct.slice(0, 40);
  }, [eligibleWeapons, weaponQuery]);
  const availableStats = getCustomRivenStatDefsForWeapon(selectedWeapon);
  const generatedName = useMemo(
    () => (selectedWeapon ? generateCustomRivenName(selectedWeapon.name, stats) : ""),
    [selectedWeapon, stats],
  );
  const saveDisabled = !selectedWeapon || !name.trim() || stats.filter((stat) => stat.value !== 0).length === 0;

  useEffect(() => {
    if (!open || !weaponPickerOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!weaponPickerRef.current?.contains(event.target as Node)) setWeaponPickerOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, weaponPickerOpen]);

  useEffect(() => {
    if (!open || !polarityPickerOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!polarityPickerRef.current?.contains(event.target as Node)) setPolarityPickerOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, polarityPickerOpen]);

  useEffect(() => {
    if (!open || openStatPickerIndex === null) return;
    const activeIndex = openStatPickerIndex;
    function handlePointerDown(event: MouseEvent) {
      const activeRef = statPickerRefs.current[activeIndex];
      if (!activeRef?.contains(event.target as Node)) setOpenStatPickerIndex(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, openStatPickerIndex]);

  useEffect(() => {
    if (!open || nameDirty || !generatedName || name === generatedName) return;
    setName(generatedName);
  }, [generatedName, name, nameDirty, open]);

  function updateStat(index: number, next: Partial<CustomRivenStatValue>) {
    setStats((prev) =>
      prev.map((stat, i) => {
        if (i !== index) return stat;
        const updated = { ...stat, ...next };
        const definition = getCustomRivenStatDef(updated.stat);
        if (definition && !definition.canBeNegative && updated.value < 0) updated.value = Math.abs(updated.value);
        return updated;
      }),
    );
  }

  function updateStatQuery(index: number, query: string) {
    setStatQueries((prev) => prev.map((entry, i) => (i === index ? query : entry)));
  }

  function updateStatSign(index: number, nextSign: 1 | -1) {
    setStatSigns((prev) => prev.map((sign, i) => (i === index ? nextSign : sign)));
    setStats((prev) =>
      prev.map((stat, i) => {
        if (i !== index) return stat;
        const definition = getCustomRivenStatDef(stat.stat);
        if (!definition || !definition.canBeNegative || definition.unit === "multiplier") return stat;
        return { ...stat, value: stat.value === 0 ? 0 : Math.abs(stat.value) * nextSign };
      }),
    );
  }

  function addStat() {
    const used = new Set(stats.map((stat) => getCustomRivenStatDef(stat.stat)?.key ?? stat.stat));
    const fallback = availableStats.find((definition) => !used.has(definition.key))?.key ?? availableStats[0]?.key ?? CUSTOM_RIVEN_STAT_DEFS[0]?.key ?? "damage";
    if (stats.length < 4) {
      setStats((prev) => [...prev, { stat: fallback, value: 0 }]);
      setStatQueries((prev) => [...prev, getCustomRivenStatDef(fallback)?.label ?? fallback]);
      setStatSigns((prev) => [...prev, 1]);
    }
  }

  function removeStat(index: number) {
    setStats((prev) => prev.filter((_, i) => i !== index));
    setStatQueries((prev) => prev.filter((_, i) => i !== index));
    setStatSigns((prev) => prev.filter((_, i) => i !== index));
    setOpenStatPickerIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  }

  function handleSave() {
    if (!selectedWeapon || !name.trim()) return;
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? makeRivenId(),
      name: name.trim(),
      sourceWeaponUniqueName: selectedWeapon.uniqueName,
      sourceWeaponName: selectedWeapon.name,
      sourceWeaponDisposition: selectedWeapon.disposition,
      familyKey: normalizeRivenWeaponFamilyKey(selectedWeapon.name),
      polarity,
      drain: Math.max(0, Math.min(18, Math.floor(drain))),
      stats: stats.filter((stat) => stat.value !== 0),
      createdAtIso: initial?.createdAtIso ?? now,
      updatedAtIso: now,
    });
  }

  function selectWeapon(nextUniqueName: string) {
    const nextWeapon = eligibleWeapons.find((weapon) => weapon.uniqueName === nextUniqueName) ?? null;
    setWeaponUniqueName(nextUniqueName);
    setWeaponQuery(nextWeapon?.name ?? "");
    setWeaponPickerOpen(false);
  }

  const selectedPolarity = POLARITIES.find((entry) => entry.key === polarity) ?? null;
  const selectedPolarityIcon = selectedPolarity ? polImg(selectedPolarity.ap) : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl rounded-2xl border border-yellow-700/40 bg-slate-950 shadow-2xl shadow-black/60">
        <div className="border-b border-yellow-800/30 bg-yellow-950/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-yellow-400/70">Owned Riven</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">{initial ? "Edit Riven" : "Add Riven"}</div>
            </div>
            <button onClick={onClose} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-slate-200">Close</button>
          </div>
        </div>
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Weapon</label>
              <div ref={weaponPickerRef} className="relative">
                <input
                  type="text"
                  value={weaponQuery}
                  onChange={(e) => {
                    setWeaponQuery(e.target.value);
                    setWeaponPickerOpen(true);
                  }}
                  onFocus={() => setWeaponPickerOpen(true)}
                  placeholder="Search weapon..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                />
                {weaponPickerOpen && (
                  <div className="wf-popover absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border p-1">
                    {filteredWeapons.length > 0 ? (
                      filteredWeapons.map((weapon) => (
                        <button
                          key={weapon.uniqueName}
                          type="button"
                          onClick={() => selectWeapon(weapon.uniqueName)}
                          className={[
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            weapon.uniqueName === weaponUniqueName
                              ? "bg-cyan-950/40 text-cyan-200"
                              : "text-slate-200 hover:bg-slate-900",
                          ].join(" ")}
                        >
                          <span className="truncate">{weapon.name}</span>
                          <span className="shrink-0 text-[11px] text-slate-500">{weapon.disposition.toFixed(2)}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-500">No matching weapons.</div>
                    )}
                  </div>
                )}
              </div>
              {selectedWeapon && (
                <div className="mt-1 text-[11px] text-slate-500">
                  Applies to weapon variants that share the {selectedWeapon.name} family. Base disposition: {selectedWeapon.disposition.toFixed(2)}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Riven Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameDirty(true);
                  }}
                  placeholder={selectedWeapon ? generatedName || `${selectedWeapon.name} Crita-Visiata` : "Weapon Prefix-CoreSuffix"}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setName(generatedName);
                    setNameDirty(false);
                  }}
                  disabled={!generatedName}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-300 hover:text-slate-100 disabled:opacity-40"
                >
                  Generate
                </button>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Generated from the entered riven stats using the weapon prefix/core/suffix naming pattern.
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_260px_220px]">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Stats</label>
              <div className="space-y-2">
                {stats.map((stat, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,190px)_40px] gap-3">
                    <div ref={(node) => { statPickerRefs.current[index] = node; }} className="relative">
                      <input
                        type="text"
                        value={statQueries[index] ?? (getCustomRivenStatDef(stat.stat)?.label ?? stat.stat)}
                        onChange={(e) => {
                          updateStatQuery(index, e.target.value);
                          setOpenStatPickerIndex(index);
                        }}
                        onFocus={() => setOpenStatPickerIndex(index)}
                        placeholder="Search stat..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600"
                      />
                      {openStatPickerIndex === index && (
                        <div className="wf-popover absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border p-1">
                          {availableStats
                            .filter((definition) => definition.label.toLowerCase().includes((statQueries[index] ?? "").trim().toLowerCase()))
                            .slice(0, 30)
                            .map((definition) => (
                              <button
                                key={definition.key}
                                type="button"
                                onClick={() => {
                                  updateStat(index, { stat: definition.key });
                                  updateStatQuery(index, definition.label);
                                  setOpenStatPickerIndex(null);
                                }}
                                className={[
                                  "flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition-colors",
                                  stat.stat === definition.key ? "bg-cyan-950/40 text-cyan-200" : "text-slate-200 hover:bg-slate-900",
                                ].join(" ")}
                              >
                                {definition.label}
                              </button>
                            ))}
                          {availableStats.filter((definition) => definition.label.toLowerCase().includes((statQueries[index] ?? "").trim().toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500">No matching stats.</div>
                          )}
                        </div>
                      )}
                    </div>
                    {(() => {
                      const definition = getCustomRivenStatDef(stat.stat);
                      const showSignToggle = Boolean(definition && definition.canBeNegative && definition.unit !== "multiplier");
                      const sign = statSigns[index] ?? (stat.value < 0 ? -1 : 1);
                      const isNegative = sign < 0;
                      return (
                        <div className="flex gap-2">
                          {showSignToggle && (
                            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                              <button
                                type="button"
                                onClick={() => updateStatSign(index, 1)}
                                className={[
                                  "px-2 py-2 text-xs transition-colors",
                                  !isNegative ? "bg-cyan-950/40 text-cyan-200" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                                ].join(" ")}
                                aria-label="Positive stat"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => updateStatSign(index, -1)}
                                className={[
                                  "border-l border-slate-700 px-2 py-2 text-xs transition-colors",
                                  isNegative ? "bg-cyan-950/40 text-cyan-200" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                                ].join(" ")}
                                aria-label="Negative stat"
                              >
                                -
                              </button>
                            </div>
                          )}
                          <input
                            type="number"
                            step={definition?.unit === "multiplier" ? "0.01" : "0.1"}
                            value={showSignToggle ? Math.abs(stat.value) : stat.value}
                            onChange={(e) => {
                              const numericValue = Number(e.target.value) || 0;
                              updateStat(index, {
                                value: showSignToggle ? numericValue * sign : numericValue,
                              });
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-right text-slate-100"
                          />
                        </div>
                      );
                    })()}
                    <button
                      onClick={() => removeStat(index)}
                      disabled={stats.length <= 1}
                      className="rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-red-300 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Enter faction stats as multipliers like <span className="font-mono text-slate-300">1.55</span> for <span className="font-mono text-slate-300">x1.55</span>. Other stats use their shown raw values like <span className="font-mono text-slate-300">120</span> for <span className="font-mono text-slate-300">+120%</span>.
              </div>
              {stats.length < 4 && (
                <button onClick={addStat} className="mt-2 text-[11px] text-blue-400 hover:text-blue-300">
                  + Add stat
                </button>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Capacity</label>
              <input
                type="number"
                min={0}
                max={18}
                value={drain}
                onChange={(e) => setDrain(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              />
              <div className="mt-3">
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Polarity</label>
                <div ref={polarityPickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setPolarityPickerOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <span className="flex items-center gap-2">
                      {selectedPolarityIcon ? (
                        <img src={selectedPolarityIcon} alt={selectedPolarity?.label ?? "Polarity"} className="h-4 w-4 object-contain pol-icon" />
                      ) : (
                        <span className="text-slate-500">○</span>
                      )}
                      <span>{selectedPolarity?.label ?? "None"}</span>
                    </span>
                    <span className="text-slate-400">{polarityPickerOpen ? "▴" : "▾"}</span>
                  </button>
                  {polarityPickerOpen && (
                    <div className="wf-popover absolute z-10 mt-2 w-full rounded-xl border p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPolarity("");
                          setPolarityPickerOpen(false);
                        }}
                        className={[
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          polarity === "" ? "bg-cyan-950/40 text-cyan-200" : "text-slate-200 hover:bg-slate-900",
                        ].join(" ")}
                      >
                        <span className="text-slate-500">○</span>
                        <span>None</span>
                      </button>
                      {POLARITIES.map((entry) => {
                        const icon = polImg(entry.ap);
                        return (
                          <button
                            key={entry.key}
                            type="button"
                            onClick={() => {
                              setPolarity(entry.key);
                              setPolarityPickerOpen(false);
                            }}
                            className={[
                              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              polarity === entry.key ? "bg-cyan-950/40 text-cyan-200" : "text-slate-200 hover:bg-slate-900",
                            ].join(" ")}
                          >
                            {icon ? (
                              <img src={icon} alt={entry.label} className="h-4 w-4 object-contain pol-icon" />
                            ) : (
                              <span className="text-slate-500">○</span>
                            )}
                            <span>{entry.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Preview</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{name.trim() || "Unnamed Riven"}</div>
              <div className="mt-1 text-[11px] text-slate-500">{selectedWeapon?.name ?? "Select a weapon"}</div>
              {generatedName && generatedName !== name.trim() && (
                <div className="mt-1 text-[11px] text-slate-500">Suggested: {generatedName}</div>
              )}
              <div className="mt-2 text-[11px] leading-relaxed text-slate-300">
                {stats.some((stat) => stat.value !== 0) ? formatCustomRivenStatsLabel(stats) : "No stats entered yet."}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            <button onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saveDisabled}
              className="rounded-lg border border-yellow-600/50 bg-yellow-700/40 px-3 py-1.5 text-xs font-semibold text-yellow-300 hover:bg-yellow-700/60 disabled:opacity-40"
            >
              {initial ? "Save Riven" : "Add Riven"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rank Cost Calculator ─────────────────────────────────────────────────────

function RankCostCalculator({
  maxRank,
  rarity,
}: {
  maxRank: number;
  rarity: string | undefined;
}) {
  const [fromRank, setFromRank] = useState(0);
  const [toRank, setToRank] = useState(maxRank);

  if (maxRank === 0) return null;

  const endoCost = calcEndoCost(rarity, fromRank, toRank);
  const creditCost = calcCreditCost(rarity, fromRank, toRank);

  const rankOptions = Array.from({ length: maxRank + 1 }, (_, i) => i);

  return (
    <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-300">
        Upgrade Cost Calculator
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-slate-400">
          From rank
          <select
            value={fromRank}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFromRank(v);
              if (toRank <= v) setToRank(Math.min(v + 1, maxRank));
            }}
            className="rounded bg-slate-800 border border-slate-600 px-1.5 py-0.5 text-slate-100"
          >
            {rankOptions.slice(0, maxRank).map((r) => (
              <option key={r} value={r}>
                R{r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-slate-400">
          to rank
          <select
            value={toRank}
            onChange={(e) => {
              const v = Number(e.target.value);
              setToRank(v);
              if (fromRank >= v) setFromRank(Math.max(0, v - 1));
            }}
            className="rounded bg-slate-800 border border-slate-600 px-1.5 py-0.5 text-slate-100"
          >
            {rankOptions.slice(1).map((r) => (
              <option key={r} value={r}>
                R{r}
              </option>
            ))}
          </select>
        </label>
      </div>
      {fromRank < toRank ? (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Endo</span>
            <span className="font-mono font-semibold text-amber-300">
              {endoCost.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Credits</span>
            <span className="font-mono font-semibold text-yellow-400">
              {creditCost.toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-500">
          Select a target rank higher than starting rank.
        </div>
      )}
    </div>
  );
}


function DropsSection({ drops, name }: { drops: AllModDrop[]; name: string }) {
  if (drops.length === 0) {
    return (
      <div className="text-xs text-slate-500 flex items-center gap-2">
        No drop data available.
        <a href={wikiUrl(name) + "#Acquisition"} target="_blank" rel="noopener noreferrer"
          className="text-slate-600 hover:text-slate-300 transition-colors flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Wiki
        </a>
      </div>
    );
  }
  const entries: GroupedSourceEntry[] = [...drops]
    .sort((a, b) => b.chance - a.chance)
    .map((drop) => ({
      id: `${drop.location}:${drop.chance}:${drop.rarity ?? ""}`,
      family: classifySourceFamilyFromDropLocation(drop.location),
      title: drop.location,
      meta: extractInlinePriceMeta(drop.location) ?? formatDropPercent(drop.chance),
      href: wikiUrl(drop.location) + "#Farming_Locations",
      badges: drop.rarity ? [{ label: drop.rarity, tone: "neutral" }] : [],
    }));
  return (
    <GroupedSourceList entries={entries} maxHeightClassName="max-h-72" />
  );
}

function CatalogAcquisitionSection({ catalogId, fallbackDrops, name }: { catalogId?: string; fallbackDrops: AllModDrop[]; name: string }) {
  const entries = buildCatalogSourceEntries(catalogId);
  if (entries.length > 0) {
    return <GroupedSourceList entries={entries} maxHeightClassName="max-h-72" />;
  }
  return <DropsSection drops={fallbackDrops} name={name} />;
}

// ─── Drop Locations (legacy — uses modLocations.json enemy data) ───────────────

/** Build a Warframe wiki URL for any item/mod/arcane name */
function wikiUrl(name: string): string {
  const slug = name.trim().replace(/\s+/g, "_");
  return `https://wiki.warframe.com/w/${encodeURIComponent(slug)}`;
}

/** Small unobtrusive wiki link icon — opens wiki in a new tab */
function WikiLink({ name }: { name: string }) {
  return (
    <a
      href={wikiUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${name} on Warframe Wiki`}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
      aria-label={`${name} wiki`}
    >
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

// ─── Mod Detail Panel ─────────────────────────────────────────────────────────

function ModModal({
  entry,
  isRiven = false,
  onClose,
}: {
  entry: ModEntry;
  isRiven?: boolean;
  onClose: () => void;
}) {
  const counts  = useTrackerStore((s) => s.state.inventory.counts ?? EMPTY_COUNTS);
  const modRanks = useTrackerStore((s) => s.state.inventory.modRanks ?? EMPTY_MOD_RANKS);
  const setCount = useTrackerStore((s) => s.setCount);
  const setModRank = useTrackerStore((s) => s.setModRank);
  const addGoalCatalog = useTrackerStore((s) => s.addGoalCatalog);
  const key = modKey(entry.path);
  const owned = counts[key] ?? 0;
  const data = entry.data;
  const allEntry = ALL_MODS_BY_PATH[entry.path] ?? ALL_MODS_BY_NAME[entry.name ?? ""];

  const maxRank = isRiven
    ? (data?.FusionLimitRange?.[1] ?? 8)
    : (allEntry?.fusionLimit ?? decodeMaxRank(data?.FusionLimit));
  const ownedRank = owned > 0 ? clampModOwnedRank(maxRank, modRanks[entry.path]) : 0;
  const baseDrain = allEntry?.baseDrain ?? decodeBaseDrain(data?.BaseDrain);
  const upgrades = data?.Upgrades ?? [];
  const polarity = data?.ArtifactPolarity ?? allEntry?.polarity;
  const rarityRaw = allEntry?.rarity ?? data?.Rarity ?? "COMMON";
  const rarity = rarityRaw.toUpperCase();
  // Clamp levelStats to maxRank+1 — All.json occasionally has more entries than fusionLimit
  const levelStats = (allEntry?.levelStats ?? []).slice(0, maxRank + 1);
  const exactDrops: AllModDrop[] = shouldSuppressExactDrops(entry, allEntry) ? [] : (allEntry?.drops ?? []);
  // Only standard variants are allowed to borrow the old name-based fallback.
  const legacyDrops = shouldUseLegacyNameDrops(entry) ? (modLocationLookup.get(normalize(entry.name)) ?? []) : [];
  const drops: AllModDrop[] = exactDrops.length > 0
    ? exactDrops
    : legacyDrops.map(d => ({ chance: d.chance, location: d.enemyName, rarity: d.rarity, type: entry.name }));
  const displayName = getDisplayModName(entry);
  const availabilityNote = getModAvailabilityNote(entry);
  const flawedPurchaseNote = getModVariantTier(entry) === "flawed"
    ? `Sold from the Mod Storage Box near Cressa Tal in Iron Wake for ${getFlawedModCreditCost(rarityRaw).toLocaleString()} Credits.`
    : null;

  const rarityLabel = rarityRaw.charAt(0).toUpperCase() + rarityRaw.slice(1).toLowerCase();
  const imageUrl = getEntityImageUrl(allEntry);

  // Determine if this is a warframe augment (compatName is a specific warframe name, not a weapon type)
  const GENERIC_COMPAT = new Set(["WARFRAME","ANY","COMPANION","ROBOTIC","BEAST","PRIMARY","Melee",
    "Pistol","Shotgun","Rifle","Assault Rifle","Sniper","Bow","K-Drive","Archwing","Necramech",
    "Archgun","Archmelee","Moa","Hound","Kavat","Kubrow","Sentinel","Parazon","Tome","AURA",
    "Claws","Daggers","Dual Daggers","Thrown Melee","Plexus Mod","Railjack Mod",""]);
  const isWarframeAugment = allEntry?.isAugment && allEntry?.compatName && !GENERIC_COMPAT.has(allEntry.compatName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">

        {/* ── Modal header ── */}
        <div className={["flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 shrink-0", rarityBg(rarity)].join(" ")}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-base font-bold text-slate-100">{displayName}</span>
            <WikiLink name={entry.name} />
            <span className={["text-xs font-semibold px-2 py-0.5 rounded-full border", rarityColor(rarity), rarityBg(rarity)].join(" ")}>
              {rarityLabel}
            </span>
            {polarity && (() => {
              const img = polImg(polarity);
              return img ? (
                <span className="rounded-full p-1 border border-slate-600 bg-slate-800 flex items-center justify-center w-6 h-6" title={polarityLabel(polarity)}>
                  <img src={img} alt={polarityLabel(polarity)} className="w-4 h-4 object-contain pol-icon" />
                </span>
              ) : (
                <span className="text-xs rounded-full px-2 py-0.5 border border-slate-600 bg-slate-800 text-slate-300">{polarityLabel(polarity)}</span>
              );
            })()}
            {maxRank > 0 && <span className="text-xs text-slate-400">Max Rank {maxRank}</span>}
            {allEntry?.isExilus    && <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-700/50    bg-sky-950/30    text-sky-300    font-semibold">EXILUS</span>}
            {allEntry?.isUtility   && <span className="text-[10px] px-1.5 py-0.5 rounded border border-green-700/50  bg-green-950/30  text-green-300  font-semibold">UTILITY</span>}
            {allEntry?.isPrime     && <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-600/50  bg-amber-950/30  text-amber-300  font-semibold">PRIME</span>}
            {isWarframeAugment     && <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-700/50 bg-purple-950/30 text-purple-300 font-semibold">AUGMENT</span>}
            {allEntry?.tradable    && <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-600    bg-slate-800    text-slate-400">Tradable</span>}
            {allEntry?.transmutable && <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-600   bg-slate-800    text-slate-400">Transmutable</span>}
          </div>
          <div className="shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {!isRiven && (
              <button
                className="rounded-lg border border-cyan-700/50 bg-cyan-950/20 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-950/35"
                onClick={() => addGoalCatalog(key, 1, "mod")}
                title="Add this mod to your goals"
              >
                Add Goal
              </button>
            )}
            <span className="text-[10px] text-slate-500 mr-1">Owned</span>
            <button
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center"
              onClick={() => setCount(key, Math.max(0, owned - 1))} title="Decrease count"
            >−</button>
            <span className={["w-7 text-center text-sm font-mono font-semibold", owned > 0 ? "text-emerald-400" : "text-slate-500"].join(" ")}>{owned}</span>
            <button
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center"
              onClick={() => {
                setCount(key, owned + 1);
                if (owned <= 0) setModRank(entry.path, maxRank);
              }} title="Increase count"
            >+</button>
            <span className="text-[10px] text-slate-500 ml-3 mr-1">Rank</span>
            <button
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center disabled:opacity-30"
              disabled={owned <= 0 || ownedRank <= 0}
              onClick={() => setModRank(entry.path, Math.max(0, ownedRank - 1))}
              title="Lower owned rank"
            >−</button>
            <span className={["w-8 text-center text-sm font-mono font-semibold", owned > 0 ? "text-emerald-400" : "text-slate-500"].join(" ")}>R{ownedRank}</span>
            <button
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center disabled:opacity-30"
              disabled={owned <= 0 || ownedRank >= maxRank}
              onClick={() => setModRank(entry.path, Math.min(maxRank, ownedRank + 1))}
              title="Raise owned rank"
            >+</button>
          </div>
          <button className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800" onClick={onClose}>Close</button>
        </div>

        {/* ── Modal body ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Description */}
          {allEntry?.description && (
            <p className="text-sm text-slate-400 leading-relaxed">{renderStatString(allEntry.description)}</p>
          )}

          {/* Meta tags row */}
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            {allEntry?.type        && <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5">{allEntry.type}</span>}
            {allEntry?.compatName  && <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5">Fits: {allEntry.compatName}</span>}
            {isWarframeAugment     && allEntry?.compatName && <span className="rounded border border-purple-900/50 bg-purple-950/20 px-2 py-0.5 text-purple-400">Augment for: {allEntry.compatName}</span>}
            {allEntry?.introduced  && <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5">Added: {allEntry.introduced.name}</span>}
            {allEntry?.releaseDate && <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5">{formatReleaseDate(allEntry.releaseDate) ?? allEntry.releaseDate}</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)] gap-5">

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={displayName}
                    className="h-full min-h-[260px] w-full object-contain p-6"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-slate-500">
                    No artwork available for this mod.
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Effects ── */}
            <div className="space-y-4">

              {/* Per-rank effects from levelStats */}
              {levelStats.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Effects per Rank</div>
                  <div className="space-y-1">
                    {levelStats.map((ls, r) => (
                      <div key={r} className={["flex items-start gap-2 rounded px-2 py-1.5 text-xs",
                        r === levelStats.length - 1 ? "bg-cyan-950/30 border border-cyan-800/40" : "bg-slate-800/50"
                      ].join(" ")}>
                        <span className="shrink-0 text-slate-500 font-mono w-5">R{r}</span>
                        <span className="text-slate-200">
                          {ls.stats.map((s, si) => (
                            <span key={si}>{si > 0 && "  ·  "}{renderStatString(s)}</span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback: raw upgrade values */}
              {levelStats.length === 0 && upgrades.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Effects</div>
                  <div className="space-y-1.5">
                    {upgrades.slice(0, 4).map((u, i) => {
                      if (!u.UpgradeType || u.Value === undefined) return null;
                      const label = labelForUpgradeType(u.UpgradeType);
                      const perRank = u.Value;
                      const maxVal = perRank * (maxRank > 0 ? maxRank + 1 : 1);
                      return (
                        <div key={i} className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs text-slate-300">{label}</span>
                            <span className="text-xs font-mono text-slate-200">
                              {formatValue(perRank, u.DisplayAsPercent)}&nbsp;/&nbsp;rank&nbsp;→&nbsp;
                              <span className="text-cyan-300 font-semibold">{formatValue(maxVal, u.DisplayAsPercent)}&nbsp;at&nbsp;R{maxRank}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Capacity cost per rank */}
              {baseDrain > 0 && maxRank > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Mod Capacity Cost</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: maxRank + 1 }, (_, r) => (
                      <div key={r} className="text-center">
                        <div className="text-[10px] text-slate-500 mb-0.5">R{r}</div>
                        <div className="w-8 text-center rounded bg-slate-800 border border-slate-600 py-1 text-xs text-slate-200 font-mono">{baseDrain + r}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upgrade cost calculator */}
              {!isRiven && <RankCostCalculator maxRank={maxRank} rarity={rarity} />}
            </div>

            {/* ── RIGHT: Acquisition ── */}
            <div>
          <div className="space-y-3">
            {flawedPurchaseNote && (
              <div className="rounded-lg border border-cyan-800/40 bg-cyan-950/20 px-3 py-2 text-xs leading-relaxed text-cyan-100">
                {flawedPurchaseNote}
              </div>
            )}
            {availabilityNote && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-200">
                {availabilityNote}
              </div>
            )}
            <CatalogAcquisitionSection catalogId={allEntry?.catalogId ?? `items:${entry.path}`} fallbackDrops={drops} name={entry.name} />
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const LEDGER_ROW_HEIGHT = 56;
const LEDGER_OVERSCAN = 8;
const MOD_SORT_OPTIONS: Array<{ value: ModSortKey; label: string }> = [
  { value: "az", label: "Name A→Z" },
  { value: "release-newest", label: "Release: Newest first" },
  { value: "release-oldest", label: "Release: Oldest first" },
  { value: "rarity-asc", label: "Rarity: Common → Legendary" },
  { value: "rarity-desc", label: "Rarity: Legendary → Common" },
  { value: "rank-asc", label: "Max Rank: Low → High" },
  { value: "rank-desc", label: "Max Rank: High → Low" },
];

function useVirtualLedgerWindow(totalRows: number, rowHeight = LEDGER_ROW_HEIGHT) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [windowState, setWindowState] = useState({ start: 0, end: 50 });

  const recompute = () => {
    const el = listRef.current;
    if (!el) return;
    const viewportHeight = el.clientHeight;
    const scrollTop = el.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - LEDGER_OVERSCAN);
    const end = Math.min(
      totalRows,
      start + Math.ceil(viewportHeight / rowHeight) + LEDGER_OVERSCAN * 2,
    );
    setWindowState((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  };

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
    requestAnimationFrame(() => recompute());
  }, [totalRows]);

  useEffect(() => {
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [totalRows]);

  return { listRef, windowState, recompute };
}

function countTriStateFilters<T extends string>(filters: Partial<Record<T, TagFilterState>>) {
  return Object.keys(filters).length;
}

function ModsPage() {
  const counts = useTrackerStore((s) => s.state.inventory.counts ?? EMPTY_COUNTS);
  const modRanksMap = useTrackerStore((s) => s.state.inventory.modRanks ?? EMPTY_MOD_RANKS);
  const customRivens = useTrackerStore((s) => s.state.inventory.customRivens ?? EMPTY_CUSTOM_RIVENS);
  const setCount = useTrackerStore((s) => s.setCount);
  const setModRank = useTrackerStore((s) => s.setModRank);
  const upsertCustomRiven = useTrackerStore((s) => s.upsertCustomRiven);
  const deleteCustomRiven = useTrackerStore((s) => s.deleteCustomRiven);

  const [modGroup, setModGroup] = useState<ModGroup>("all");
  const [modSubtypeFilters, setModSubtypeFilters] = useState<Partial<Record<Exclude<ModSubtype, "all">, TagFilterState>>>({});
  const [modSpecialFlagFilters, setModSpecialFlagFilters] = useState<Partial<Record<ModSpecialFlag, TagFilterState>>>({});
  const [modPolarityFilters, setModPolarityFilters] = useState<Partial<Record<Polarity, TagFilterState>>>({});
  const [parazonFilters, setParazonFilters] = useState<Partial<Record<ParazonFilter, TagFilterState>>>({});
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ModSortKey>("az");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [selectedMod, setSelectedMod] = useState<ModEntry | null>(null);
  const addGoalCatalog = useTrackerStore((s) => s.addGoalCatalog);
  const [editingRiven, setEditingRiven] = useState<CustomRivenInventoryRecord | null>(null);
  const [rivenModalOpen, setRivenModalOpen] = useState(false);

  const { included: includedModSubtypes, excluded: excludedModSubtypes } = useMemo(
    () => splitTagFilterState(modSubtypeFilters),
    [modSubtypeFilters],
  );
  const { included: includedModFlags, excluded: excludedModFlags } = useMemo(
    () => splitTagFilterState(modSpecialFlagFilters),
    [modSpecialFlagFilters],
  );
  const { included: includedPolarities, excluded: excludedPolarities } = useMemo(
    () => splitTagFilterState(modPolarityFilters),
    [modPolarityFilters],
  );
  const { included: includedParazonFilters, excluded: excludedParazonFilters } = useMemo(
    () => splitTagFilterState(parazonFilters),
    [parazonFilters],
  );

  const filteredCustomRivens = useMemo(() => {
    const q = normalize(query.trim());
    let list = [...customRivens];
    if (q) {
      list = list.filter((riven) =>
        normalize(`${riven.name} ${riven.sourceWeaponName} ${formatCustomRivenStatsLabel(riven.stats)}`).includes(q),
      );
    }
    if (includedPolarities.length > 0) {
      list = list.filter((riven) => !!riven.polarity && includedPolarities.includes(riven.polarity as Polarity));
    }
    if (excludedPolarities.length > 0) {
      list = list.filter((riven) => !riven.polarity || !excludedPolarities.includes(riven.polarity as Polarity));
    }
    if (ownershipFilter === "unowned") return [];
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [customRivens, excludedPolarities, includedPolarities, ownershipFilter, query]);

  const availableModSubtypeOptions = useMemo<Array<Exclude<ModSubtype, "all">>>(() => {
    const orderedSubtypes = MOD_GROUP_SUBTYPES[modGroup];
    if (!orderedSubtypes || modGroup === "rivens" || modGroup === "all") return [];
    const options = new Set<Exclude<ModSubtype, "all">>();
    for (const entry of MOD_ENTRIES) {
      const taxonomy = getModTaxonomy(entry);
      if (!taxonomy.groups.has(modGroup)) continue;
      for (const subtype of taxonomy.subtypes) {
        if (subtype !== "all") options.add(subtype);
      }
    }
    return orderedSubtypes.filter(
      (subtype): subtype is Exclude<ModSubtype, "all"> => subtype !== "all" && options.has(subtype),
    );
  }, [modGroup]);

  const availableModSpecialFlags = useMemo<ModSpecialFlag[]>(() => {
    if (modGroup === "rivens") return [];
    const options = new Set<ModSpecialFlag>();
    for (const entry of MOD_ENTRIES) {
      const taxonomy = getModTaxonomy(entry);
      if (modGroup !== "all" && !taxonomy.groups.has(modGroup)) continue;
      for (const flag of taxonomy.flags) options.add(flag);
    }
    return MOD_SPECIAL_FLAG_ORDER.filter((flag) => options.has(flag));
  }, [modGroup]);

  const filteredMods = useMemo<ModEntry[]>(() => {
    const q = normalize(query.trim());
    if (modGroup === "rivens") return [];

    let list = MOD_ENTRIES.filter((entry) => {
      const taxonomy = getModTaxonomy(entry);
      if (modGroup !== "all" && !taxonomy.groups.has(modGroup)) return false;
      if (includedModSubtypes.length > 0 && !includedModSubtypes.some((subtype) => taxonomy.subtypes.has(subtype))) return false;
      if (excludedModSubtypes.length > 0 && excludedModSubtypes.some((subtype) => taxonomy.subtypes.has(subtype))) return false;
      if (includedModFlags.length > 0 && !includedModFlags.some((flag) => taxonomy.flags.has(flag))) return false;
      if (excludedModFlags.length > 0 && excludedModFlags.some((flag) => taxonomy.flags.has(flag))) return false;
      return true;
    });

    const showPolarityFilter =
      modGroup !== "all" &&
      modGroup !== "antique" &&
      modGroup !== "parazon";
    if (showPolarityFilter && (includedPolarities.length > 0 || excludedPolarities.length > 0)) {
      const includedPolarityAps = includedPolarities.map((key) => POLARITY_AP_BY_KEY[key]);
      const excludedPolarityAps = excludedPolarities.map((key) => POLARITY_AP_BY_KEY[key]);
      list = list.filter((entry) => {
        const polarity = entry.data?.ArtifactPolarity ?? toAP(ALL_MODS_BY_PATH[entry.path]?.polarity ?? ALL_MODS_BY_NAME[entry.name]?.polarity);
        if (includedPolarityAps.length > 0 && (!polarity || !includedPolarityAps.includes(polarity))) return false;
        if (excludedPolarityAps.length > 0 && !!polarity && excludedPolarityAps.includes(polarity)) return false;
        return true;
      });
    }

    if (modGroup === "parazon") {
      list = list.filter((entry) => {
        const isRequiem = Boolean(
          entry.name.match(/Ris|Fass|Vome|Xata|Khra|Jahu|Netra|Lohk|Naeg|Mend|Vis|Kel|Xol/i) ||
            entry.path.includes("Requiem"),
        );
        const isAntivirus = entry.name.includes("Antivirus") || entry.path.includes("Antivirus");
        if (includedParazonFilters.length > 0) {
          const matchesIncluded =
            (includedParazonFilters.includes("requiem") && isRequiem) ||
            (includedParazonFilters.includes("antivirus") && isAntivirus);
          if (!matchesIncluded) return false;
        }
        if (
          (excludedParazonFilters.includes("requiem") && isRequiem) ||
          (excludedParazonFilters.includes("antivirus") && isAntivirus)
        ) {
          return false;
        }
        return true;
      });
    }

    if (q) {
      list = list.filter((entry) => {
        const displayName = getDisplayModName(entry);
        return normalize(entry.name).includes(q) || normalize(displayName).includes(q);
      });
    }

    list = list.filter((entry) => matchesOwnershipFilter(counts[modKey(entry.path)] ?? 0, ownershipFilter));
    list = dedupeBrowseMods(list);

    const deduped = new Map<string, ModEntry>();
    for (const entry of list) {
      if (!deduped.has(entry.path)) deduped.set(entry.path, entry);
    }
    list = [...deduped.values()];

    list.sort((a, b) => {
      if (sortKey === "release-newest" || sortKey === "release-oldest") {
        const aRelease = getSortableReleaseDate((ALL_MODS_BY_PATH[a.path] ?? ALL_MODS_BY_NAME[a.name])?.releaseDate, sortKey === "release-oldest" ? "oldest" : "newest");
        const bRelease = getSortableReleaseDate((ALL_MODS_BY_PATH[b.path] ?? ALL_MODS_BY_NAME[b.name])?.releaseDate, sortKey === "release-oldest" ? "oldest" : "newest");
        if (aRelease !== bRelease) return sortKey === "release-newest" ? (bRelease > aRelease ? 1 : -1) : (aRelease > bRelease ? 1 : -1);
      }
      if (sortKey === "rarity-asc" || sortKey === "rarity-desc") {
        const aRarity = rarityRank(modRarity(a));
        const bRarity = rarityRank(modRarity(b));
        if (aRarity !== bRarity) return sortKey === "rarity-asc" ? aRarity - bRarity : bRarity - aRarity;
      }
      if (sortKey === "rank-asc" || sortKey === "rank-desc") {
        const aRank = modMaxRank(a);
        const bRank = modMaxRank(b);
        if (aRank !== bRank) return sortKey === "rank-asc" ? aRank - bRank : bRank - aRank;
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [
    counts,
    excludedModFlags,
    excludedModSubtypes,
    excludedParazonFilters,
    excludedPolarities,
    includedModFlags,
    includedModSubtypes,
    includedParazonFilters,
    includedPolarities,
    modGroup,
    ownershipFilter,
    query,
    sortKey,
  ]);

  const { listRef, windowState, recompute } = useVirtualLedgerWindow(filteredMods.length);
  const showPolarityFilter =
    modGroup !== "all" &&
    modGroup !== "antique" &&
    modGroup !== "parazon";
  const showSubtypeRail = availableModSubtypeOptions.length > 0;
  const showFlagRail = modGroup === "parazon" || availableModSpecialFlags.length > 0;
  const showRefineBand = showSubtypeRail || showFlagRail || showPolarityFilter;
  const activeFilterCount =
    (modGroup !== "all" ? 1 : 0) +
    countTriStateFilters(modSubtypeFilters) +
    countTriStateFilters(modSpecialFlagFilters) +
    countTriStateFilters(modPolarityFilters) +
    countTriStateFilters(parazonFilters) +
    (ownershipFilter !== "all" ? 1 : 0);
  const modBrowseGridTemplate = "minmax(260px,1.7fr) 140px 140px 110px 120px 120px 40px";

  const resetFilters = () => {
    setModSubtypeFilters({});
    setModSpecialFlagFilters({});
    setModPolarityFilters({});
    setParazonFilters({});
    setOwnershipFilter("all");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedMod && (
        <ModModal
          entry={selectedMod}
          isRiven={modGroup === "rivens"}
          onClose={() => setSelectedMod(null)}
        />
      )}
      <CustomRivenModal
        open={rivenModalOpen}
        initial={editingRiven}
        onClose={() => {
          setRivenModalOpen(false);
          setEditingRiven(null);
        }}
        onSave={(record) => {
          upsertCustomRiven(record);
          setRivenModalOpen(false);
          setEditingRiven(null);
        }}
      />

      <Section
        title="Mods"
        subtitle="Browse mods, Rivens, set bonuses, and acquisition details from one searchable catalog."
        className="flex h-full min-h-0 flex-col md:min-h-[42rem]"
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className={baseLedgerShellClassName()}>
          <CatalogControlBand
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              setSelectedMod(null);
            }}
            queryPlaceholder="Search mods, sets, or weapon families..."
            ownershipFilter={ownershipFilter}
            onOwnershipChange={setOwnershipFilter}
            sortValue={sortKey}
            onSortChange={(value) => setSortKey(value as ModSortKey)}
            sortOptions={MOD_SORT_OPTIONS}
            onClearDetail={() => setSelectedMod(null)}
            extraAction={
              modGroup === "rivens" ? (
                <WorkspaceAction
                  onClick={() => {
                    setEditingRiven(null);
                    setRivenModalOpen(true);
                  }}
                  className="rounded-full border-yellow-700/50 bg-yellow-950/20 px-3 py-1.5 text-xs font-medium text-yellow-300 transition-colors hover:bg-yellow-950/35"
                >
                  Add Riven
                </WorkspaceAction>
              ) : undefined
            }
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <CollectionModeBand>
              <div className="contents">
                {MOD_GROUPS.map((group) => (
                  <CollectionModeButton
                    key={group.key}
                    active={modGroup === group.key}
                    onClick={() => {
                      setModGroup(group.key);
                      setModSubtypeFilters({});
                      setModSpecialFlagFilters({});
                      setModPolarityFilters({});
                      setParazonFilters({});
                      setSelectedMod(null);
                    }}
                  >
                    {group.label}
                  </CollectionModeButton>
                ))}
              </div>
            </CollectionModeBand>

            {showRefineBand ? (
              <CollectionRefineBand title={`Refine ${MOD_GROUPS.find((group) => group.key === modGroup)?.label ?? "Mods"}`}>

                  {showSubtypeRail ? (
                    <CollectionRefineGroup label="Item Type">
                      <CollectionChipRail>
                          <SubPill
                            label="All"
                            active={Object.keys(modSubtypeFilters).length === 0}
                            onClick={() => setModSubtypeFilters({})}
                          />
                          {availableModSubtypeOptions.map((subtype) => (
                            <FilterTagPill
                              key={subtype}
                              label={MOD_SUBTYPE_LABELS[subtype]}
                              state={modSubtypeFilters[subtype]}
                              onClick={() =>
                                setModSubtypeFilters((current) => {
                                  const nextState = cycleTagFilterState(current[subtype]);
                                  const next = { ...current };
                                  if (!nextState) delete next[subtype];
                                  else next[subtype] = nextState;
                                  return next;
                                })
                              }
                            />
                          ))}
                      </CollectionChipRail>
                    </CollectionRefineGroup>
                  ) : null}

                  {showFlagRail ? (
                    <CollectionRefineGroup label={modGroup === "parazon" ? "Parazon Type" : "Special Slots"}>
                      <CollectionChipRail>
                          {modGroup === "parazon" ? (
                            <>
                              <SubPill
                                label="All"
                                active={Object.keys(parazonFilters).length === 0}
                                onClick={() => setParazonFilters({})}
                              />
                              {(["requiem", "antivirus"] as const).map((filter) => (
                                <FilterTagPill
                                  key={filter}
                                  label={filter === "requiem" ? "Requiem" : "Antivirus"}
                                  state={parazonFilters[filter]}
                                  onClick={() =>
                                    setParazonFilters((current) => {
                                      const nextState = cycleTagFilterState(current[filter]);
                                      const next = { ...current };
                                      if (!nextState) delete next[filter];
                                      else next[filter] = nextState;
                                      return next;
                                    })
                                  }
                                />
                              ))}
                            </>
                          ) : (
                            <>
                              <SubPill
                                label="All"
                                active={Object.keys(modSpecialFlagFilters).length === 0}
                                onClick={() => setModSpecialFlagFilters({})}
                              />
                              {availableModSpecialFlags.map((flag) => (
                                <FilterTagPill
                                  key={flag}
                                  label={MOD_SPECIAL_FLAG_LABELS[flag]}
                                  state={modSpecialFlagFilters[flag]}
                                  onClick={() =>
                                    setModSpecialFlagFilters((current) => {
                                      const nextState = cycleTagFilterState(current[flag]);
                                      const next = { ...current };
                                      if (!nextState) delete next[flag];
                                      else next[flag] = nextState;
                                      return next;
                                    })
                                  }
                                />
                              ))}
                            </>
                          )}
                      </CollectionChipRail>
                    </CollectionRefineGroup>
                  ) : null}

                  {showPolarityFilter ? (
                    <CollectionRefineGroup label="Polarity">
                      <CollectionChipRail>
                          <SubPill
                            label="All"
                            active={Object.keys(modPolarityFilters).length === 0}
                            onClick={() => setModPolarityFilters({})}
                          />
                          {POLARITIES.map((polarity) => {
                            const icon = polImg(polarity.ap);
                            return (
                              <FilterTagPill
                                key={polarity.key}
                                title={polarity.label}
                                state={modPolarityFilters[polarity.key]}
                                onClick={() =>
                                  setModPolarityFilters((current) => {
                                    const nextState = cycleTagFilterState(current[polarity.key]);
                                    const next = { ...current };
                                    if (!nextState) delete next[polarity.key];
                                    else next[polarity.key] = nextState;
                                    return next;
                                  })
                                }
                                label={
                                  icon ? (
                                    <img src={icon} alt={polarity.label} className="h-4 w-4 object-contain pol-icon" />
                                  ) : (
                                    <span>{polarity.label}</span>
                                  )
                                }
                              />
                            );
                          })}
                      </CollectionChipRail>
                    </CollectionRefineGroup>
                  ) : null}
              </CollectionRefineBand>
            ) : null}

            <LedgerResultsBand
              rowsLabel={modGroup === "rivens" ? `Rows: ${filteredCustomRivens.length}` : `Rows: ${filteredMods.length}`}
              filterCount={activeFilterCount}
              onResetFilters={resetFilters}
            />

            {modGroup === "rivens" ? (
              filteredCustomRivens.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center border-t border-dashed border-slate-800 bg-slate-950/30 p-8 text-sm text-slate-400">
                  No owned rivens match the current filters.
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto border-t border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-bg-canvas)] p-3 pr-2">
                  <div className="space-y-2">
                    {filteredCustomRivens.map((riven) => (
                      <div key={riven.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-100">{riven.name}</span>
                            <span className="shrink-0 text-[11px] font-medium text-amber-300">Riven</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {riven.sourceWeaponName} · Disposition {riven.sourceWeaponDisposition.toFixed(2)} · Drain {riven.drain}
                          </div>
                          <div className="mt-1 text-[11px] leading-relaxed text-slate-300">
                            {formatCustomRivenStatsLabel(riven.stats)}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingRiven(riven);
                            setRivenModalOpen(true);
                          }}
                          className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCustomRiven(riven.id)}
                          className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-red-700/60 hover:text-red-300"
                        >
                          Delete
                        </button>
                        <WikiLink name={riven.sourceWeaponName} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : filteredMods.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center border-t border-dashed border-slate-800 bg-slate-950/30 p-8 text-sm text-slate-400">
                No mods match the current filters.
              </div>
            ) : (
              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-auto border-t border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-bg-canvas)]"
                onScroll={recompute}
              >
                <div className="min-w-[980px]">
                  <div
                    className="sticky top-0 z-10 grid gap-2 border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)] backdrop-blur"
                    style={{ gridTemplateColumns: modBrowseGridTemplate }}
                  >
                    <div>Item</div>
                    <div>Release</div>
                    <div>Polarity</div>
                    <div>Rarity</div>
                    <div>Count</div>
                    <div>Rank</div>
                    <div />
                  </div>
                  <div className="relative" style={{ height: filteredMods.length * LEDGER_ROW_HEIGHT }}>
                    <div
                      className="absolute left-0 right-0 px-4 py-2"
                      style={{ transform: `translateY(${windowState.start * LEDGER_ROW_HEIGHT}px)` }}
                    >
                      {filteredMods.slice(windowState.start, windowState.end).map((entry) => {
                        const isSelected = selectedMod?.path === entry.path;
                        const allEntry = ALL_MODS_BY_PATH[entry.path] ?? ALL_MODS_BY_NAME[entry.name];
                        const polarity = entry.data?.ArtifactPolarity ?? toAP(allEntry?.polarity);
                        const rarityRaw = entry.data?.Rarity ?? ALL_MODS_BY_PATH[entry.path]?.rarity ?? "";
                        const rarity = rarityRaw.toUpperCase();
                        const ownedCount = counts[modKey(entry.path)] ?? 0;
                        const maxRank = modMaxRank(entry);
                        const ownedRank = ownedCount > 0 ? clampModOwnedRank(maxRank, modRanksMap[entry.path]) : 0;
                        return (
                          <div key={entry.path} className="mb-1 grid items-center gap-2" style={{ gridTemplateColumns: modBrowseGridTemplate }}>
                            <button
                              className={[
                                "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                                isSelected
                                  ? "border-slate-500 bg-slate-700 text-slate-100"
                                  : "border-slate-800/50 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-100",
                              ].join(" ")}
                              onClick={() => setSelectedMod(isSelected ? null : entry)}
                            >
                              <span className="truncate font-medium">{getDisplayModName(entry)}</span>
                            </button>
                            <div className="px-2 text-sm text-slate-300">
                              {formatReleaseDate(allEntry?.releaseDate) ?? "—"}
                            </div>
                            <div className="px-2 text-sm text-slate-300">
                              <div className="flex items-center gap-2">
                                {polarity ? (
                                  <>
                                    {(() => {
                                      const icon = polImg(polarity);
                                      return icon ? (
                                        <img
                                          src={icon}
                                          alt={polarityLabel(polarity)}
                                          className="h-4 w-4 object-contain pol-icon opacity-70"
                                        />
                                      ) : null;
                                    })()}
                                    <span>{polarityLabel(polarity)}</span>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </div>
                            </div>
                            <div className={["px-2 text-sm font-medium", rarityColor(rarity)].join(" ")}>
                              {rarity ? rarity.charAt(0) + rarity.slice(1).toLowerCase() : "—"}
                            </div>
                            <div className="flex items-center shrink-0" onClick={(event) => event.stopPropagation()}>
                              <button
                                className="flex h-[38px] w-6 items-center justify-center rounded-l border border-r-0 border-slate-700 bg-slate-900 text-sm leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30"
                                disabled={ownedCount <= 0}
                                onClick={() => setCount(modKey(entry.path), Math.max(0, ownedCount - 1))}
                              >
                                −
                              </button>
                              <span className={["flex h-[38px] w-8 items-center justify-center border-y border-slate-700 bg-slate-900 text-sm font-mono", ownedCount > 0 ? "text-emerald-400" : "text-slate-600"].join(" ")}>
                                {ownedCount}
                              </span>
                              <button
                                className="flex h-[38px] w-6 items-center justify-center rounded-r border border-l-0 border-slate-700 bg-slate-900 text-sm leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                onClick={() => {
                                  setCount(modKey(entry.path), ownedCount + 1);
                                  if (ownedCount <= 0) setModRank(entry.path, maxRank);
                                }}
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-center shrink-0" onClick={(event) => event.stopPropagation()}>
                              <button
                                className="flex h-[38px] w-6 items-center justify-center rounded-l border border-r-0 border-slate-700 bg-slate-900 text-sm leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30"
                                disabled={ownedCount <= 0 || ownedRank <= 0}
                                onClick={() => setModRank(entry.path, Math.max(0, ownedRank - 1))}
                              >
                                −
                              </button>
                              <span className={["flex h-[38px] w-10 items-center justify-center border-y border-slate-700 bg-slate-900 text-[11px] font-mono", ownedCount > 0 ? "text-emerald-400" : "text-slate-600"].join(" ")}>
                                R{ownedRank}
                              </span>
                              <button
                                className="flex h-[38px] w-6 items-center justify-center rounded-r border border-l-0 border-slate-700 bg-slate-900 text-sm leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30"
                                disabled={ownedCount <= 0 || ownedRank >= maxRank}
                                onClick={() => setModRank(entry.path, Math.min(maxRank, ownedRank + 1))}
                              >
                                +
                              </button>
                            </div>
                            <div className="flex justify-center gap-2">
                              <button
                                className="rounded-lg border border-cyan-700/50 bg-cyan-950/20 px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-950/35"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addGoalCatalog(modKey(entry.path), 1, "mod");
                                }}
                                title="Add this mod to your goals"
                              >
                                Goal
                              </button>
                              <WikiLink name={entry.name} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

export default ModsPage;
