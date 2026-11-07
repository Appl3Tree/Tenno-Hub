import React, { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTrackerStore } from "../store/store";
import MODS_RAW from "../data/_generated/mods-lean.auto.json";
import ALL_RAW from "../data/_generated/warframe-items-all-lean.auto.json";
import MOD_LOCATIONS_RAW from "../../external/warframe-drop-data/raw/modLocations.json";
import { WorkspaceFilterGroup, WorkspacePillButton } from "../components/workspace/WorkspaceChrome";
import {
  getHighestOwnedArcaneRank,
  getHighestOwnedArcaneRankWithFallback,
  hasOwnedArcane,
} from "../domain/logic/arcaneInventory";
import {
  CollectionActiveFilterSummary,
  CollectionChipRail,
  CollectionFilterDisclosure,
  CollectionRefineGroup,
  CollectionRefineBand,
  CollectionScrollSurface,
  type CollectionActiveFilter,
} from "../components/collection/CollectionLedgerShell";
import { CollectionCatalogToolbar } from "../components/collection/CollectionCatalogToolbar";
import { useCollectionVirtualWindow } from "../components/collection/useCollectionVirtualWindow";
import { getEntityImageUrl } from "../utils/entityImage";
import { GroupedSourceList } from "../components/sources/GroupedSourceList";
import { buildCatalogSourceEntries } from "../components/sources/catalogSourceEntries";

type TagFilterState = "include" | "exclude";
type OwnershipFilter = "all" | "owned" | "unowned";
type ModSortKey = "az" | "release-newest" | "release-oldest" | "rarity-asc" | "rarity-desc" | "rank-asc" | "rank-desc";

type ArcaneCategory =
  | "all"
  | "warframe"
  | "operator"
  | "amps"
  | "tektolyst"
  | "primary"
  | "secondary"
  | "melee"
  | "kitguns"
  | "zaws";

type ArcaneFilterCategory = Exclude<ArcaneCategory, "all">;

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
  fusionLimit?: number;
  levelStats?: { stats: string[] }[];
  drops?: AllModDrop[];
  releaseDate?: string;
  description?: string;
  imageName?: string;
  wikiaThumbnail?: string;
}

interface ModUpgrade {
  UpgradeType?: string;
  Value?: number;
  DisplayAsPercent?: number;
  LocKeyWordScript?: Record<string, number[] | string | unknown>;
}

interface ModData {
  FusionLimit?: string;
  ItemCompatibility?: string;
  Upgrades?: ModUpgrade[];
  ExtraUpgrades?: ModUpgrade[];
}

interface ModEntry {
  path: string;
  name: string;
  categories?: string[];
  data?: ModData;
}

type EnemyDrop = {
  enemyName: string;
  rarity: string;
  chance: number;
  enemyModDropChance: number;
};

type ModLocationEntry = { modName: string; enemies: EnemyDrop[] };
type DropKind = "syndicate" | "enemy" | "mission" | "relic" | "other";

const EMPTY_COUNTS: Record<string, number> = {};
const EMPTY_ARCANE_RANKS: Record<string, Record<string, number>> = {};
const EMPTY_ARCANE_RANK_COUNTS: Record<string, Record<string, number>> = {};
const EMPTY_ARCANE_UNKNOWN_RANK_COUNTS: Record<string, number> = {};

function formatArcaneRankCounts(rankCounts: Record<string, number> | undefined, unknownCount = 0): string {
  const parts = Object.entries(rankCounts ?? {})
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([rank, count]) => "R" + rank + " × " + count)
  if (unknownCount > 0) parts.push("Unknown rank × " + unknownCount);
  return parts.join(" · ");
}
const MODDESC_RAW: Record<string, { Ranks?: Record<string, string>[] }> = {};
const MODDESC = MODDESC_RAW;
const VANILLA_DATE = "2012-10-25";
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

const ARCANE_CATEGORIES: { key: ArcaneCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "warframe", label: "Warframe" },
  { key: "operator", label: "Operator" },
  { key: "amps", label: "Amps" },
  { key: "tektolyst", label: "Tektolyst Artifacts" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "melee", label: "Melee" },
  { key: "kitguns", label: "Kitguns" },
  { key: "zaws", label: "Zaws" },
];

const UPGRADE_TYPE_LABELS: Record<string, string> = {
  AVATAR_ABILITY_STRENGTH: "Ability Strength",
  AVATAR_ABILITY_DURATION: "Ability Duration",
  AVATAR_ABILITY_RANGE: "Ability Range",
  AVATAR_ABILITY_EFFICIENCY: "Ability Efficiency",
  AVATAR_MAX_HEALTH: "Health",
  AVATAR_MAX_SHIELDS: "Shield Capacity",
  AVATAR_ARMOR: "Armor",
  AVATAR_MAX_POWER: "Energy Max",
  AVATAR_POWER_REGEN: "Energy Regen",
  AVATAR_SPRINT_BOOST: "Sprint Speed",
  WEAPON_DAMAGE_AMOUNT: "Damage",
  WEAPON_FIRE_RATE: "Fire Rate",
  WEAPON_CRITICAL_CHANCE: "Critical Chance",
  WEAPON_CRITICAL_DAMAGE: "Critical Damage",
  WEAPON_STATUS_CHANCE: "Status Chance",
  WEAPON_STATUS_DURATION: "Status Duration",
  WEAPON_RELOAD_SPEED: "Reload Speed",
  WEAPON_MULTISHOT: "Multishot",
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
};

const RARITY_ORDER: Record<string, number> = { COMMON: 0, UNCOMMON: 1, RARE: 2, LEGENDARY: 3 };
const SYNDICATE_ORGS = new Set([
  "Arbiters of Hexis",
  "Cephalon Suda",
  "New Loka",
  "Perrin Sequence",
  "Red Veil",
  "Steel Meridian",
  "Ostron",
  "Solaris United",
  "The Quills",
  "Vox Solaris",
  "Entrati",
  "Necraloid",
  "The Holdfasts",
  "Cavia",
]);

const _statusImgs = import.meta.glob<string>("../assets/statuses/*.png", {
  eager: true,
  import: "default",
});
const STATUS_IMG: Record<string, string> = {};
for (const [path, url] of Object.entries(_statusImgs)) {
  const name = path.split("/").pop()!.replace(".png", "").toLowerCase();
  STATUS_IMG[name] = url;
}

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

const ALL_ARCANES_BY_PATH: Record<string, AllModEntry> = {};
const ALL_ARCANES_BY_NAME: Record<string, AllModEntry> = {};
for (const item of ALL_RAW as AllModEntry[]) {
  if (item.category !== "Arcanes" || !item.uniqueName) continue;
  ALL_ARCANES_BY_PATH[item.uniqueName] = item;
  if (item.name) ALL_ARCANES_BY_NAME[item.name] = item;
}

const modLocationLookup = new Map<string, EnemyDrop[]>();
const rawLocations = (MOD_LOCATIONS_RAW as { modLocations?: ModLocationEntry[] }).modLocations;
if (Array.isArray(rawLocations)) {
  for (const entry of rawLocations) {
    if (entry.modName && Array.isArray(entry.enemies)) {
      modLocationLookup.set(normalize(entry.modName), entry.enemies);
    }
  }
}

const ALL_ENTRIES: ModEntry[] = Object.entries(MODS_RAW as Record<string, unknown>)
  .map(([path, value]) => ({ path, ...(value as Record<string, unknown>) }) as ModEntry)
  .filter((entry) => entry.name && typeof entry.name === "string");

const ARCANE_ENTRIES: ModEntry[] = ALL_ENTRIES.filter(
  (entry) =>
    entry.categories?.[0] === "arcane" ||
    (entry.categories?.[0] === "mod" &&
      entry.data?.ItemCompatibility === "/Lotus/Powersuits/Operator/OperatorSuit"),
);

function modKey(path: string) {
  return `mods:${path}`;
}

function normalize(value: string) {
  return value.toLowerCase();
}

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

function decodeMaxRank(qa: string | undefined): number {
  switch (qa) {
    case "QA_NONE":
      return 0;
    case "QA_LOW":
      return 3;
    case "QA_MEDIUM":
    case "QA_HIGH":
      return 5;
    case "QA_VERY_HIGH":
      return 10;
    default:
      return 5;
  }
}

function labelForUpgradeType(type: string | undefined) {
  if (!type) return "Effect";
  return (
    UPGRADE_TYPE_LABELS[type] ??
    type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function rarityRank(rarity: string | undefined) {
  return RARITY_ORDER[rarity?.toUpperCase() ?? ""] ?? -1;
}

function rarityColor(rarity: string | undefined) {
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

function rarityBg(rarity: string | undefined) {
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

function humanizeVarName(key: string) {
  return key
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function extractScriptLevels(upgrade: ModUpgrade): number[] | null {
  const script = upgrade.LocKeyWordScript;
  if (!script) return null;
  for (const [key, value] of Object.entries(script)) {
    if (key.startsWith("_") && key.endsWith("Levels") && Array.isArray(value) && value.length > 0) {
      return value as number[];
    }
  }
  return null;
}

function renderStatString(stat: string): React.ReactNode {
  const cleaned = stat
    .replace(/<LINE_SEPARATOR>/g, " · ")
    .replace(/<LOWER_IS_BETTER>/g, "")
    .replace(/<[A-Z_]+_SECONDARY_COLOR>/g, "")
    .replace(/<\/[A-Z_]+_SECONDARY_COLOR>/g, "")
    .replace(/<(?!DT_)[A-Z_]+>/g, "");

  const parts = cleaned.split(/(<DT_[A-Z_]+>|\|[A-Z_0-9]+\||\n)/);
  if (parts.length === 1) return <>{cleaned}</>;

  const nodes: React.ReactNode[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === "\n") {
      nodes.push(<br key={index} />);
      continue;
    }
    if (part.startsWith("<DT_") && part.endsWith(">")) {
      const key = part.slice(1, -1).toLowerCase();
      const imgName = DT_TO_IMG[key];
      const imgUrl = imgName ? STATUS_IMG[imgName] : null;
      if (imgUrl) {
        nodes.push(
          <img
            key={index}
            src={imgUrl}
            alt={key.replace("dt_", "").replace("_color", "")}
            title={key.replace("dt_", "").replace(/_color$/, "").replace(/_/g, " ")}
            className="mx-0.5 inline h-3.5 w-3.5 -mt-0.5 object-contain"
          />,
        );
      }
      continue;
    }
    if (part.startsWith("|") && part.endsWith("|")) {
      const label = part.slice(1, -1).toLowerCase().replace(/_/g, " ");
      nodes.push(
        <span
          key={index}
          className="mx-0.5 inline-flex items-center rounded border border-slate-600/50 bg-slate-700/60 px-1 py-0 text-[10px] font-mono text-slate-400"
          title="Exact value scales with Warframe stats and mods"
        >
          {label}
        </span>,
      );
      continue;
    }
    if (part) nodes.push(<span key={index}>{part}</span>);
  }

  return <>{nodes}</>;
}

function wikiUrl(name: string) {
  const slug = name.trim().replace(/\s+/g, "_");
  return `https://wiki.warframe.com/w/${encodeURIComponent(slug)}`;
}

function enemyWikiUrl(name: string) {
  const slug = name.trim().replace(/\s+/g, "_");
  return `https://wiki.warframe.com/w/${encodeURIComponent(slug)}#Farming_Locations`;
}

function WikiLink({ name }: { name: string }) {
  return (
    <a
      href={wikiUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${name} on Warframe Wiki`}
      onClick={(event) => event.stopPropagation()}
      className="shrink-0 text-slate-600 transition-colors hover:text-slate-300"
      aria-label={`${name} wiki`}
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

function classifyDrop(location: string): DropKind {
  if (location.includes("Relic")) return "relic";
  if (/^[A-Z][a-zA-Z ]+\/[A-Z]/.test(location) || location.startsWith("Duviri/")) return "mission";
  const commaIndex = location.indexOf(", ");
  if (commaIndex > 0) {
    const org = location.slice(0, commaIndex);
    for (const syndicate of SYNDICATE_ORGS) {
      if (org.startsWith(syndicate)) return "syndicate";
    }
  }
  if (!location.includes("/") && !location.includes(", ")) return "enemy";
  return "other";
}

function DropRow({ drop }: { drop: AllModDrop }) {
  const kind = classifyDrop(drop.location);
  const rarityClass =
    drop.rarity === "Common"
      ? "text-slate-400"
      : drop.rarity === "Uncommon"
        ? "text-blue-300"
        : drop.rarity === "Rare"
          ? "text-amber-300"
          : "text-rose-300";

  const wikiIcon = (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );

  if (kind === "syndicate") {
    const commaIndex = drop.location.indexOf(", ");
    const syndicateName = commaIndex > 0 ? drop.location.slice(0, commaIndex) : drop.location;
    const rankLabel = commaIndex > 0 ? drop.location.slice(commaIndex + 2) : "";
    return (
      <div className="flex items-center gap-2 rounded border border-indigo-800/30 bg-indigo-950/20 px-2 py-1.5 text-xs">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-indigo-400">Purchase</span>
        <a
          href={wikiUrl(syndicateName)}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-slate-300 transition-colors hover:text-indigo-300 hover:underline"
        >
          {syndicateName}
        </a>
        {rankLabel ? <span className="shrink-0 text-[11px] text-slate-500">{rankLabel}</span> : null}
        <a
          href={wikiUrl(syndicateName)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-slate-600 transition-colors hover:text-slate-300"
        >
          {wikiIcon}
        </a>
      </div>
    );
  }

  if (kind === "enemy") {
    return (
      <div className="flex items-center gap-2 rounded border border-slate-800/50 bg-slate-900/50 px-2 py-1.5 text-xs">
        <a
          href={enemyWikiUrl(drop.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-slate-300 transition-colors hover:text-cyan-300 hover:underline"
        >
          {drop.location}
        </a>
        <span className={["shrink-0 text-[11px] font-semibold", rarityClass].join(" ")}>{drop.rarity}</span>
        <span className="shrink-0 font-mono text-[11px] text-slate-500">{formatDropPercent(drop.chance)}</span>
        <a
          href={enemyWikiUrl(drop.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-slate-600 transition-colors hover:text-slate-300"
        >
          {wikiIcon}
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded border border-slate-800/50 bg-slate-900/50 px-2 py-1.5 text-xs">
      <span className="min-w-0 flex-1 truncate text-slate-300">{drop.location}</span>
      <span className={["shrink-0 text-[11px] font-semibold", rarityClass].join(" ")}>{drop.rarity}</span>
      <span className="shrink-0 font-mono text-[11px] text-slate-500">{formatDropPercent(drop.chance)}</span>
    </div>
  );
}

function DropsSection({ drops, name }: { drops: AllModDrop[]; name: string }) {
  if (drops.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        No drop data available.
        <a
          href={`${wikiUrl(name)}#Acquisition`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-slate-600 transition-colors hover:text-slate-300"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Wiki
        </a>
      </div>
    );
  }

  const sorted = [...drops].sort((left, right) => {
    const leftSyndicate = classifyDrop(left.location) === "syndicate";
    const rightSyndicate = classifyDrop(right.location) === "syndicate";
    if (leftSyndicate !== rightSyndicate) return leftSyndicate ? -1 : 1;
    return right.chance - left.chance;
  });

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Acquisition <span className="normal-case font-normal text-slate-600">({drops.length})</span>
      </div>
      <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
        {sorted.map((drop, index) => (
          <DropRow key={`${drop.location}-${index}`} drop={drop} />
        ))}
      </div>
    </div>
  );
}

function CatalogAcquisitionSection({ catalogId, fallbackDrops, name }: { catalogId?: string; fallbackDrops: AllModDrop[]; name: string }) {
  const entries = buildCatalogSourceEntries(catalogId);
  if (entries.length > 0) {
    return <GroupedSourceList entries={entries} maxHeightClassName="max-h-72" />;
  }
  return <DropsSection drops={fallbackDrops} name={name} />;
}

function classifyArcaneCategory(entry: ModEntry): ArcaneCategory | null {
  const compat = entry.data?.ItemCompatibility ?? "";
  if (compat.includes("PlayerPowerSuit")) return "warframe";
  if (compat.includes("OperatorSuit")) return "operator";
  if (compat.includes("OperatorAmplifier") || compat.includes("OperatorAmpWeapon")) return "amps";
  if (compat.includes("LotusAntiqueWeapon") || compat.includes("Antiques/Lotus")) return "tektolyst";
  if (compat.includes("LotusModularWeapon") || compat.includes("Ostron/Melee")) return "zaws";
  if (compat.includes("LotusBulletWeapon")) return "kitguns";
  if (
    compat.includes("LotusLongGun") ||
    compat.includes("LotusShotgun") ||
    compat.includes("LotusLongBow") ||
    compat.includes("LotusBow")
  ) {
    return "primary";
  }
  if (compat.includes("LotusPistol") || compat.includes("LotusAkimbo")) return "secondary";
  if (compat.includes("PlayerMeleeWeapon")) return "melee";
  return null;
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

function countTriStateFilters<T extends string>(filters: Partial<Record<T, TagFilterState>>) {
  return Object.keys(filters).length;
}

function matchesOwnershipFilter(totalOwned: number, filter: OwnershipFilter) {
  if (filter === "owned") return totalOwned > 0;
  if (filter === "unowned") return totalOwned === 0;
  return true;
}

function SubPill({ label, active, onClick }: { label: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      className={[
        "whitespace-nowrap rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-slate-500 bg-slate-700 text-slate-100"
          : "border-slate-700 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200",
      ].join(" ")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function FilterTagPill({
  label,
  state,
  onClick,
}: {
  label: ReactNode;
  state?: TagFilterState;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "whitespace-nowrap rounded-md border px-2.5 py-1 text-xs transition-colors",
        state === "include"
          ? "border-slate-100 bg-slate-100 text-slate-900"
          : state === "exclude"
            ? "border-rose-800/70 bg-rose-950/30 text-rose-200"
            : "border-slate-700 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200",
      ].join(" ")}
      onClick={onClick}
    >
      <span className={state === "exclude" ? "line-through decoration-rose-300/70" : undefined}>{label}</span>
    </button>
  );
}

function OwnershipPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <WorkspacePillButton label={label} active={active} onClick={onClick} />;
}

function CatalogControlBand({
  query,
  onQueryChange,
  sortValue,
  onSortChange,
  onClearDetail,
  rowCount,
  activeFilterCount,
  filtersExpanded,
  onToggleFilters,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
  onClearDetail: () => void;
  rowCount: number;
  activeFilterCount: number;
  filtersExpanded: boolean;
  onToggleFilters: () => void;
}) {
  return <CollectionCatalogToolbar
    searchLabel="Search arcane catalog"
    searchPlaceholder="Search arcanes..."
    query={query}
    onQueryChange={onQueryChange}
    sortLabel="Sort arcane catalog"
    sortValue={sortValue}
    onSortChange={onSortChange}
    sortOptions={MOD_SORT_OPTIONS}
    rowCount={rowCount}
    activeFilterCount={activeFilterCount}
    filtersExpanded={filtersExpanded}
    onToggleFilters={onToggleFilters}
    filterPanelId="arcanes-advanced-filters"
    onClearDetail={onClearDetail}
  />;
}

function ArcaneDetail({ entry, onClose }: { entry: ModEntry; onClose: () => void }) {
  const arcaneRanks = useTrackerStore((state) => state.state.inventory.arcaneRanks ?? EMPTY_ARCANE_RANKS);
  const arcaneRankCounts = useTrackerStore((state) => state.state.inventory.arcaneRankCounts ?? EMPTY_ARCANE_RANK_COUNTS);
  const arcaneUnknownRankCounts = useTrackerStore((state) => state.state.inventory.arcaneUnknownRankCounts ?? EMPTY_ARCANE_UNKNOWN_RANK_COUNTS);
  const setArcaneRankCount = useTrackerStore((state) => state.setArcaneRankCount);
  const addGoalCatalog = useTrackerStore((state) => state.addGoalCatalog);
  const rankCounts = arcaneRanks[entry.path] ?? {};
  const unknownRankCopies = arcaneUnknownRankCounts[entry.path] ?? 0;
  const data = entry.data;
  const maxRank = decodeMaxRank(data?.FusionLimit);
  const highestOwnedRank = getHighestOwnedArcaneRank(rankCounts);
  const exactOwnedCopies = formatArcaneRankCounts(arcaneRankCounts[entry.path], arcaneUnknownRankCounts[entry.path] ?? 0);
  const upgrades = (data?.Upgrades ?? []).concat(data?.ExtraUpgrades ?? []);
  const allEntry = ALL_ARCANES_BY_PATH[entry.path] ?? ALL_ARCANES_BY_NAME[entry.name];
  const allDrops = allEntry?.drops ?? [];
  const legacyDrops = modLocationLookup.get(normalize(entry.name)) ?? [];
  const drops: AllModDrop[] = allDrops.length > 0
    ? allDrops
    : legacyDrops.map((drop) => ({
        chance: drop.chance,
        location: drop.enemyName,
        rarity: drop.rarity,
        type: entry.name,
      }));
  const imageUrl = getEntityImageUrl(allEntry);

  const modDesc = MODDESC[entry.path];
  const descRanks = modDesc?.Ranks;
  type EffectRow = { label: string; values: string[] };
  const effectRows: EffectRow[] = [];
  const hasAllJsonLevelStats = (allEntry?.levelStats?.length ?? 0) > 0;

  if (descRanks && descRanks.length > 0) {
    const varNames = Object.keys(descRanks[0]);
    for (const varName of varNames) {
      const values = descRanks.map((rank) => rank[varName] ?? "");
      if (values.every((value) => value === "")) continue;
      effectRows.push({ label: humanizeVarName(varName), values });
    }
  } else if (upgrades.length > 0 && !hasAllJsonLevelStats) {
    for (const upgrade of upgrades.slice(0, 4)) {
      const type = upgrade.UpgradeType;
      const isNoneType = !type || type === "NONE";
      if (isNoneType) {
        const levels = extractScriptLevels(upgrade);
        if (levels && levels.length > 0) {
          const fmt = (value: number) =>
            upgrade.DisplayAsPercent
              ? `${Math.round(value * 100 * 10) / 10}%`
              : String(Math.round(value * 100) / 100);
          effectRows.push({ label: "Effect", values: levels.map(fmt) });
        }
      } else {
        const value = upgrade.Value;
        if (value === undefined || value === null) continue;
        const label = labelForUpgradeType(type);
        const fmt = (raw: number) =>
          upgrade.DisplayAsPercent
            ? `${raw >= 0 ? "+" : ""}${Math.round(raw * 100 * 10) / 10}%`
            : `${raw >= 0 ? "+" : ""}${Math.round(raw * 100) / 100}`;
        effectRows.push({
          label,
          values: Array.from({ length: maxRank + 1 }, (_, rank) => fmt(value * (rank + 1))),
        });
      }
    }
  }

  const levelStats = effectRows.length === 0 ? (allEntry?.levelStats ?? []).slice(0, maxRank + 1) : [];
  const rarityRaw = allEntry?.rarity ?? "";
  const rarity = rarityRaw.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-base font-bold text-slate-100">{entry.name}</span>
            <WikiLink name={entry.name} />
            <button
              className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-950/35"
              onClick={() => addGoalCatalog(modKey(entry.path), 1, "arcane")}
            >
              Add Goal
            </button>
            <span className="text-xs text-slate-400">Max Rank: {maxRank}</span>
            {rarityRaw ? (
              <span className={["rounded-full border px-2 py-0.5 text-xs font-semibold", rarityColor(rarity), rarityBg(rarity)].join(" ")}>
                {rarityRaw.charAt(0).toUpperCase() + rarityRaw.slice(1).toLowerCase()}
              </span>
            ) : null}
            {allEntry?.type ? (
              <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
                {allEntry.type}
              </span>
            ) : null}
          </div>
          <button
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Collection</span>
              <span className={["text-xs font-semibold", highestOwnedRank !== null || unknownRankCopies > 0 ? "text-emerald-400" : "text-slate-400"].join(" ")}>
                {unknownRankCopies > 0
                  ? highestOwnedRank !== null ? `Known through R${highestOwnedRank}; ${unknownRankCopies} rank unknown` : `${unknownRankCopies} owned; rank unknown`
                  : highestOwnedRank !== null ? `Owned up to R${highestOwnedRank}` : "Not owned"}
              </span>
            </div>
            {exactOwnedCopies ? (
              <p className="mb-2 text-xs text-slate-400" aria-label={"Owned arcane copies by rank: " + exactOwnedCopies}>
                Copies by rank: {exactOwnedCopies}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: maxRank + 1 }, (_, rank) => {
                const isSelected = highestOwnedRank === rank;
                return (
                  <button
                    key={rank}
                    className={[
                      "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                      isSelected
                        ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-200"
                        : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70",
                    ].join(" ")}
                    onClick={() => setArcaneRankCount(entry.path, rank, isSelected ? 0 : 1)}
                  >
                    Rank {rank}
                  </button>
                );
              })}
              <button
                className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-slate-700 hover:text-slate-200"
                onClick={() => setArcaneRankCount(entry.path, 0, 0)}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={entry.name}
                    className="h-full min-h-[260px] w-full object-contain p-6"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-slate-500">
                    No artwork available for this arcane.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {effectRows.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Effects per Rank</div>
                  {effectRows.map((row, index) => (
                    <div key={index} className="mb-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
                      <div className="mb-1.5 text-xs font-medium text-slate-300">{row.label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {row.values.map((value, rank) => (
                          <div key={rank} className="text-center">
                            <div className="mb-0.5 text-[9px] text-slate-600">R{rank}</div>
                            <div
                              className={[
                                "rounded border px-1.5 py-0.5 text-[11px] font-mono",
                                rank === row.values.length - 1
                                  ? "border-cyan-800/60 bg-cyan-950/40 text-cyan-300"
                                  : "border-slate-700 bg-slate-900 text-slate-300",
                              ].join(" ")}
                            >
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : levelStats.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Effects per Rank</div>
                  <div className="space-y-1">
                    {levelStats.map((level, rank) => (
                      <div
                        key={rank}
                        className={[
                          "flex items-start gap-2 rounded px-2 py-1.5 text-xs",
                          rank === levelStats.length - 1 ? "border border-cyan-800/40 bg-cyan-950/30" : "bg-slate-800/50",
                        ].join(" ")}
                      >
                        <span className="w-5 shrink-0 font-mono text-slate-500">R{rank}</span>
                        <span className="text-slate-200">
                          {level.stats.map((stat, index) => (
                            <span key={index}>
                              {index > 0 ? "  ·  " : null}
                              {renderStatString(stat)}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs italic text-slate-500">No effect data available.</div>
              )}
            </div>

            <div>
              <CatalogAcquisitionSection catalogId={allEntry?.catalogId ?? `items:${entry.path}`} fallbackDrops={drops} name={entry.name} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArcanesPage() {
  const counts = useTrackerStore((state) => state.state.inventory.counts ?? EMPTY_COUNTS);
  const arcaneRanksMap = useTrackerStore((state) => state.state.inventory.arcaneRanks ?? EMPTY_ARCANE_RANKS);
  const arcaneRankCountsMap = useTrackerStore((state) => state.state.inventory.arcaneRankCounts ?? EMPTY_ARCANE_RANK_COUNTS);
  const arcaneUnknownRankCountsMap = useTrackerStore((state) => state.state.inventory.arcaneUnknownRankCounts ?? EMPTY_ARCANE_UNKNOWN_RANK_COUNTS);
  const setArcaneRankCount = useTrackerStore((state) => state.setArcaneRankCount);
  const addGoalCatalog = useTrackerStore((state) => state.addGoalCatalog);

  const [categoryFilters, setCategoryFilters] = useState<Partial<Record<ArcaneFilterCategory, TagFilterState>>>({});
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ModSortKey>("az");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedArcane, setSelectedArcane] = useState<ModEntry | null>(null);

  const { included: includedCategories, excluded: excludedCategories } = useMemo(
    () => splitTagFilterState(categoryFilters),
    [categoryFilters],
  );

  const filteredArcanes = useMemo(() => {
    const q = normalize(query.trim());
    let list = ARCANE_ENTRIES.filter((entry) => {
      const category = classifyArcaneCategory(entry) as ArcaneFilterCategory;
      if (includedCategories.length > 0 && !includedCategories.includes(category)) return false;
      if (excludedCategories.includes(category)) return false;
      return true;
    });

    if (q) list = list.filter((entry) => normalize(entry.name).includes(q));

    list = list.filter((entry) => {
      const fallbackCount = Number(counts[modKey(entry.path)] ?? counts[entry.path] ?? 0);
      const isOwned = hasOwnedArcane(arcaneRanksMap[entry.path], fallbackCount);
      return matchesOwnershipFilter(isOwned ? 1 : 0, ownershipFilter);
    });

    list.sort((left, right) => {
      if (sortKey === "release-newest" || sortKey === "release-oldest") {
        const leftRelease = getSortableReleaseDate(ALL_ARCANES_BY_NAME[left.name]?.releaseDate, sortKey === "release-oldest" ? "oldest" : "newest");
        const rightRelease = getSortableReleaseDate(ALL_ARCANES_BY_NAME[right.name]?.releaseDate, sortKey === "release-oldest" ? "oldest" : "newest");
        if (leftRelease !== rightRelease) {
          return sortKey === "release-newest" ? (rightRelease > leftRelease ? 1 : -1) : (leftRelease > rightRelease ? 1 : -1);
        }
      }
      if (sortKey === "rarity-asc" || sortKey === "rarity-desc") {
        const leftRarity = rarityRank(ALL_ARCANES_BY_NAME[left.name]?.rarity?.toUpperCase());
        const rightRarity = rarityRank(ALL_ARCANES_BY_NAME[right.name]?.rarity?.toUpperCase());
        if (leftRarity !== rightRarity) return sortKey === "rarity-asc" ? leftRarity - rightRarity : rightRarity - leftRarity;
      }
      if (sortKey === "rank-asc" || sortKey === "rank-desc") {
        const leftRank = ALL_ARCANES_BY_NAME[left.name]?.fusionLimit ?? 0;
        const rightRank = ALL_ARCANES_BY_NAME[right.name]?.fusionLimit ?? 0;
        if (leftRank !== rightRank) return sortKey === "rank-asc" ? leftRank - rightRank : rightRank - leftRank;
      }
      return left.name.localeCompare(right.name);
    });

    return list;
  }, [arcaneRanksMap, counts, excludedCategories, includedCategories, ownershipFilter, query, sortKey]);

  const {
    scrollportRef,
    contentRef,
    rowsAnchorRef,
    windowState,
    recompute,
    resetScroll,
  } = useCollectionVirtualWindow(filteredArcanes.length, LEDGER_ROW_HEIGHT, LEDGER_OVERSCAN);
  const activeFilterCount = countTriStateFilters(categoryFilters) + (ownershipFilter !== "all" ? 1 : 0);
  const arcaneBrowseGridTemplate = "minmax(260px,1.5fr) 120px 456px 40px";
  const clearFilters = () => {
    setCategoryFilters({});
    setOwnershipFilter("all");
  };

  useEffect(() => {
    resetScroll();
  }, [categoryFilters, ownershipFilter, query, sortKey, resetScroll]);

  const activeFilters: CollectionActiveFilter[] = [];
  for (const [key, state] of Object.entries(categoryFilters) as Array<[ArcaneFilterCategory, TagFilterState]>) {
    const label = ARCANE_CATEGORIES.find((entry) => entry.key === key)?.label ?? key;
    activeFilters.push({
      id: `category-${key}`,
      label: `Category: ${label} ${state === "include" ? "included" : "excluded"}`,
      onRemove: () => setCategoryFilters((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      }),
    });
  }
  if (ownershipFilter !== "all") {
    activeFilters.push({ id: "ownership", label: ownershipFilter === "owned" ? "Owned" : "Unowned", onRemove: () => setOwnershipFilter("all") });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedArcane ? <ArcaneDetail entry={selectedArcane} onClose={() => setSelectedArcane(null)} /> : null}

      <CollectionScrollSurface
        scrollportRef={scrollportRef}
        contentRef={contentRef}
        onScroll={recompute}
        ariaLabel="Arcanes catalog and results"
        className="bg-[color:var(--wf-bg-canvas)]"
      >
        <section aria-labelledby="arcanes-page-title">
          <h1 id="arcanes-page-title" className="px-3 py-1 text-lg font-semibold text-[color:var(--wf-text-strong)]">Arcanes</h1>
          <div>
            <div className="sticky top-0 z-30 bg-[color:var(--wf-surface-1)]/95 shadow-sm backdrop-blur">
          <CatalogControlBand
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              setSelectedArcane(null);
            }}
            sortValue={sortKey}
            onSortChange={(value) => setSortKey(value as ModSortKey)}
            onClearDetail={() => setSelectedArcane(null)}
            rowCount={filteredArcanes.length}
            activeFilterCount={activeFilterCount}
            filtersExpanded={filtersExpanded}
            onToggleFilters={() => setFiltersExpanded((open) => !open)}
          />
            </div>

          <CollectionActiveFilterSummary filters={activeFilters} onClear={clearFilters} />
          <CollectionFilterDisclosure id="arcanes-advanced-filters" expanded={filtersExpanded}>
            <div className="grid gap-4">
              <CollectionRefineGroup label="Ownership">
                <WorkspaceFilterGroup className="gap-2">
                  <OwnershipPill label="All" active={ownershipFilter === "all"} onClick={() => setOwnershipFilter("all")} />
                  <OwnershipPill label="Owned" active={ownershipFilter === "owned"} onClick={() => setOwnershipFilter("owned")} />
                  <OwnershipPill label="Unowned" active={ownershipFilter === "unowned"} onClick={() => setOwnershipFilter("unowned")} />
                </WorkspaceFilterGroup>
              </CollectionRefineGroup>
              <CollectionRefineBand title="Scope" className="gap-1.5">
              <CollectionChipRail>
                    <SubPill label="All" active={Object.keys(categoryFilters).length === 0} onClick={() => setCategoryFilters({})} />
                    {ARCANE_CATEGORIES.filter((entry) => entry.key !== "all").map((entry) => (
                      <FilterTagPill
                        key={entry.key}
                        label={entry.label}
                        state={categoryFilters[entry.key as ArcaneFilterCategory]}
                        onClick={() => {
                          const key = entry.key as ArcaneFilterCategory;
                          setCategoryFilters((current) => {
                            const nextState = cycleTagFilterState(current[key]);
                            const next = { ...current };
                            if (!nextState) delete next[key];
                            else next[key] = nextState;
                            return next;
                          });
                          setSelectedArcane(null);
                        }}
                      />
                    ))}
              </CollectionChipRail>
              </CollectionRefineBand>
            </div>
          </CollectionFilterDisclosure>

            {filteredArcanes.length === 0 ? (
              <div className="flex items-center justify-center border-t border-dashed border-slate-800 bg-slate-950/30 p-8 text-sm text-slate-400">
                No arcanes match the current filters.
              </div>
            ) : (
              <div className="border-t border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-bg-canvas)]">
                <div className="min-w-[980px]">
                  <div
                    className="sticky top-36 z-20 grid gap-2 border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)] backdrop-blur sm:top-44 lg:top-28"
                    style={{ gridTemplateColumns: arcaneBrowseGridTemplate }}
                  >
                    <div>Item</div>
                    <div>Release</div>
                    <div>Highest Owned Rank</div>
                    <div />
                  </div>
                  <div ref={rowsAnchorRef} className="relative" style={{ height: filteredArcanes.length * LEDGER_ROW_HEIGHT }}>
                    <div
                      className="absolute left-0 right-0 px-4 py-2"
                      style={{ transform: `translateY(${windowState.start * LEDGER_ROW_HEIGHT}px)` }}
                    >
                      {filteredArcanes.slice(windowState.start, windowState.end).map((entry) => {
                        const isSelected = selectedArcane?.path === entry.path;
                        const rankCounts = arcaneRanksMap[entry.path] ?? {};
                        const exactOwnedCopies = formatArcaneRankCounts(
                          arcaneRankCountsMap[entry.path],
                          arcaneUnknownRankCountsMap[entry.path] ?? 0,
                        );
                        const fallbackCount = Number(counts[modKey(entry.path)] ?? counts[entry.path] ?? 0);
                        const unknownRankCopies = arcaneUnknownRankCountsMap[entry.path] ?? 0;
                        const highestOwnedRank = unknownRankCopies > 0
                          ? getHighestOwnedArcaneRank(rankCounts)
                          : getHighestOwnedArcaneRankWithFallback(rankCounts, fallbackCount);
                        return (
                          <div key={entry.path} className="mb-1 grid min-h-[52px] items-center gap-2" style={{ gridTemplateColumns: arcaneBrowseGridTemplate }}>
                            <button
                              className={[
                                "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                                isSelected
                                  ? "border-slate-500 bg-slate-700 text-slate-100"
                                  : "border-slate-800/50 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-100",
                              ].join(" ")}
                              onClick={() => setSelectedArcane(isSelected ? null : entry)}
                            >
                              <span className="truncate font-medium">{entry.name}</span>
                              {highestOwnedRank !== null || unknownRankCopies > 0 ? (
                                <span
                                  title={unknownRankCopies > 0 ? "Some copies have unknown rank; displayed rank is the known minimum." : undefined}
                                  className="shrink-0 rounded-full border border-emerald-800/60 bg-emerald-950/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                                >
                                  {unknownRankCopies > 0 ? highestOwnedRank !== null ? `≥R${highestOwnedRank}` : "Rank ?" : `R${highestOwnedRank}`}
                                </span>
                              ) : null}
                              {exactOwnedCopies ? (
                                <span className="max-w-[180px] truncate text-[10px] text-slate-400" title={exactOwnedCopies}>
                                  {exactOwnedCopies}
                                </span>
                              ) : null}
                            </button>
                            <div className="px-2 text-sm text-slate-300">
                              {formatReleaseDate(ALL_ARCANES_BY_NAME[entry.name]?.releaseDate) ?? "—"}
                            </div>
                            <div className="flex items-center gap-1.5 overflow-x-auto pr-1" onClick={(event) => event.stopPropagation()}>
                              {Array.from({ length: decodeMaxRank(entry.data?.FusionLimit) + 1 }, (_, rank) => rank).map((rank) => {
                                const isSelected = highestOwnedRank === rank;
                                return (
                                  <button
                                    key={rank}
                                    className={[
                                      "w-[68px] shrink-0 rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors",
                                      isSelected
                                        ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-200"
                                        : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70",
                                    ].join(" ")}
                                    onClick={() => setArcaneRankCount(entry.path, rank, isSelected ? 0 : 1)}
                                  >
                                    <span className="block text-[10px] uppercase tracking-[0.14em] text-slate-500">
                                      R{rank}
                                    </span>
                                  </button>
                                );
                              })}
                              <button
                                className="shrink-0 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-2 text-[11px] font-semibold text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                onClick={() => setArcaneRankCount(entry.path, 0, 0)}
                              >
                                Clear
                              </button>
                            </div>
                            <div className="flex justify-center gap-2">
                              <button
                                className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-950/35"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addGoalCatalog(modKey(entry.path), 1, "arcane");
                                }}
                                title="Add this arcane to your goals"
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
        </section>
      </CollectionScrollSurface>
    </div>
  );
}
