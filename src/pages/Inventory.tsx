// ===== FILE: src/pages/Inventory.tsx =====
// src/pages/Inventory.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FULL_CATALOG,
  type CatalogId,
} from "../domain/catalog/loadFullCatalog";
import { OVERLEVEL_WEAPON_PATHS } from "../domain/catalog/overLevelWeapons";
import { useTrackerStore } from "../store/store";
import {
  determineItemAvailability,
  getBlockingReasons,
} from "../domain/logic/plannerEngine";
import { deriveCompletedMap } from "../domain/logic/syndicatePrereqs";
import { getAcquisitionByCatalogId } from "../catalog/items/itemAcquisition";
import { SOURCE_INDEX } from "../catalog/sources/sourceCatalog";
import { formatSourceDisplayLabel } from "../utils/sourceLabels";
import ALL_RAW from "../data/_generated/warframe-items-all-lean.auto.json";
import ITEM_DROPS_DERIVED from "../data/_generated/item-drops-derived.byUniqueName.auto.json";
import missionRewardsJson from "../../external/warframe-drop-data/raw/missionRewards.json";
import resourceByAvatarJson from "../../external/warframe-drop-data/raw/resourceByAvatar.json";
import additionalItemByAvatarJson from "../../external/warframe-drop-data/raw/additionalItemByAvatar.json";
import miscItemsJson from "../../external/warframe-drop-data/raw/miscItems.json";
import solarisBountyRewardsJson from "../../external/warframe-drop-data/raw/solarisBountyRewards.json";
import cetusBountyRewardsJson from "../../external/warframe-drop-data/raw/cetusBountyRewards.json";
import deimosRewardsJson from "../../external/warframe-drop-data/raw/deimosRewards.json";
import entratiLabRewardsJson from "../../external/warframe-drop-data/raw/entratiLabRewards.json";
import hexRewardsJson from "../../external/warframe-drop-data/raw/hexRewards.json";
import zarimanRewardsJson from "../../external/warframe-drop-data/raw/zarimanRewards.json";
import { getRelicByKey } from "../domain/catalog/relicCatalog";
import { getPrimeAvailabilityStatus, getRelicAvailabilityStatus } from "../domain/catalog/vaultedItems";
import { useWorldStateData } from "../lib/useWorldStateData";
import { WorkspaceAction, WorkspaceHero, WorkspacePillButton, WorkspaceSection, WorkspaceSegmentedButton, WorkspaceStat } from "../components/workspace/WorkspaceChrome";
import {
  SAFE_TO_SELL_PROTECTION_META,
  buildWeaponIngredientIndex,
  getSafeToSellProtectionKeys,
  type SafeToSellProtectionKey,
  type WeaponIngredientUse,
} from "../domain/logic/safeToSell";
import {
  COLLECTION_SCROLL_CONTENT_CLASS,
  CollectionActiveFilterSummary,
  CollectionChipRail,
  CollectionFilterDisclosure,
  CollectionFiltersToggle,
  CollectionModeBand,
  CollectionModeButton,
  CollectionRefineBand,
  CollectionRefineGroup,
  CollectionScrollSurface,
  CollectionUtilityPanel,
  type CollectionActiveFilter,
} from "../components/collection/CollectionLedgerShell";
import { useCollectionVirtualWindow } from "../components/collection/useCollectionVirtualWindow";
import { getAllWikiBlueprintReferencedCatalogIds, getWikiBlueprintRequirements } from "../catalog/items/wikiBlueprintRequirements";
import { getEntityImageUrl } from "../utils/entityImage";
import { getSyndicateVendorOffer, getSyndicateVendorPrice, parseSyndicateVendorLabel } from "../catalog/sources/syndicateVendorPricing";
import { getManualReleaseDateFallback, withManualReleaseDateFallback } from "../catalog/items/manualReleaseDates";
import {
  GroupedSourceList,
  classifySourceFamilyFromCatalog,
  classifySourceFamilyFromDropLocation,
  dedupeGroupedSourceEntries,
  extractInlinePriceMeta,
  type SourceFamily,
  type GroupedSourceBadge,
  type GroupedSourceEntry,
} from "../components/sources/GroupedSourceList";

const _statusImgs = import.meta.glob<string>("../assets/statuses/*.png", { eager: true, import: "default" });
const STATUS_IMG_INV: Record<string, string> = {};
for (const [p, url] of Object.entries(_statusImgs)) {
  const name = p.split("/").pop()!.replace(".png", "").toLowerCase();
  STATUS_IMG_INV[name] = url;
}

const EXCLUDED_INVENTORY_PATHS = new Set<string>([
  "/Lotus/Powersuits/PowersuitAbilities/Helminth",
  "/Lotus/Types/Game/KubrowPet/InfestedKubrowPetPowerSuit",
  "/Lotus/Types/Items/ShipFeatureItems/AdvancedOrdisFeatureItem",
  "/Lotus/Types/Items/ShipFeatureItems/FoundryConcurrentBuildFormaFeatureItem",
  "/Lotus/Types/Items/ShipFeatureItems/MarketTierOneFeatureItem",
  "/Lotus/Types/Items/ShipFeatureItems/MarketTierTwoFeatureItem",
  "/Lotus/Types/Items/ShipFeatureItems/ShipFeatureItem",
  "/Lotus/Types/Items/Research/DataMassPlus",
  "/Lotus/Types/Items/Research/DojoColors/GenericDojoColorPigment",
]);

// ── Steel Path drop annotation ────────────────────────────────────────────────
// Builds a lookup: (planet/baseNode/rotation, roundedChance) → true
// when that chance value comes from an (Extra) / Steel Path node in missionRewards.json.
// Used to annotate warframe-items drop location strings that cannot distinguish
// Normal vs Steel Path on their own.
const STEEL_PATH_DROP_CHANCES: Map<string, Set<number>> = (() => {
  const out = new Map<string, Set<number>>();
  const root: any = (missionRewardsJson as any)?.missionRewards ?? missionRewardsJson;
  if (!root || typeof root !== "object") return out;

  for (const [planetName, planetObj] of Object.entries(root as Record<string, any>)) {
    if (!planetObj || typeof planetObj !== "object") continue;
    for (const [nodeName, nodeObj] of Object.entries(planetObj as Record<string, any>)) {
      if (!/\(Extra\)\s*$/i.test(String(nodeName))) continue; // only Steel Path nodes
      const rewards = (nodeObj as any)?.rewards;
      if (!rewards || typeof rewards !== "object") continue;

      // Strip "(Extra)" to get the base node name for matching against location strings.
      const baseNode = String(nodeName).replace(/\s*\(Extra\)\s*$/i, "").trim().toLowerCase();
      const planet = String(planetName).toLowerCase();

      for (const [rotLetter, entries] of Object.entries(rewards as Record<string, any>)) {
        if (!Array.isArray(entries)) continue;
        const rotation = String(rotLetter).toLowerCase();
        const key = `${planet}/${baseNode}/${rotation}`;
        for (const entry of entries) {
          const chance = typeof (entry as any).chance === "number" ? (entry as any).chance : 0;
          if (chance <= 0) continue;
          // missionRewards chance is in %, multiply by 100 to get same scale as Math.round(wfChance * 10000)
          const rounded = Math.round(chance * 100);
          if (!out.has(key)) out.set(key, new Set());
          out.get(key)!.add(rounded);
        }
      }
    }
  }
  return out;
})();

/** Returns true when a warframe-items drop entry corresponds to a Steel Path node. */
function isSteelPathDrop(drop: { location: string; chance: number }): boolean {
  const loc = String(drop.location ?? "");
  // Parse "Planet/Base Node (GameMode), Rotation X" → just take up to the first "("
  const beforeParen = loc.split("(")[0].trim();
  const parts = beforeParen.split("/").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (parts.length < 2) return false;

  const planet = parts[0];
  const node = parts.slice(1).join("/");

  const rotMatch = loc.match(/\bRotation\s+([ABC])\b/i);
  if (!rotMatch) return false;
  const rotation = rotMatch[1].toLowerCase();

  const key = `${planet}/${node}/${rotation}`;
  const roundedChance = Math.round(drop.chance * 10000);
  return STEEL_PATH_DROP_CHANCES.get(key)?.has(roundedChance) ?? false;
}

function isStarChartCollectionSource(sourceId: string): boolean {
  return (
    sourceId.startsWith("data:drop:node:") ||
    sourceId.startsWith("data:missionreward/") ||
    sourceId.startsWith("data:cache:")
  );
}

type InventorySourceDrop = {
  chance: number;
  location: string;
  rarity: string;
  type?: string;
};

export function normalizeCacheKey(value: string): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const dropMatch = normalized.match(/^([^/]+)\/([^,(]+)\s+\(Caches\)/i);
  if (dropMatch) {
    return `cache:${dropMatch[1].trim().toLowerCase()}/${dropMatch[2].trim().toLowerCase()}`;
  }

  const labelMatch = normalized.match(/^Caches:\s+(.+?)\s*(?:\/|-)\s*(.+)$/i);
  if (labelMatch) {
    return `cache:${labelMatch[1].trim().toLowerCase()}/${labelMatch[2].trim().toLowerCase()}`;
  }

  const nodeLikeLabelMatch = normalized.match(/^(.+?)\s+-\s+(.+?)\s+\(Caches\)(?:\s+\(Caches\))?$/i);
  if (nodeLikeLabelMatch) {
    return `cache:${nodeLikeLabelMatch[1].trim().toLowerCase()}/${nodeLikeLabelMatch[2].trim().toLowerCase()}`;
  }

  return null;
}

function normalizeEnemyKey(value: string): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const prefixedMatch = normalized.match(
    /^(?:Enemy(?:\s+Item)?\s+Drop|Resource\s+Drop\s+\(Avatar\)|Additional\s+Drop\s+\(Avatar\)|Enemy|Avatar\s+Drop):\s+(.+)$/i,
  );
  const enemyName = prefixedMatch?.[1]?.trim() ?? normalized;
  if (!enemyName) return null;

  return `enemy:${enemyName.toLowerCase()}`;
}

type NormalizedMissionNode = {
  nodeKey: string;
  rotation?: string;
  isCacheNode: boolean;
  title?: string;
};

type ParsedMissionLabel = {
  planet: string;
  node: string;
  rotation?: string;
  isCacheNode: boolean;
  title: string;
};

function rememberRicherMissionTitle(store: Map<string, string>, nodeKey: string, candidate?: string) {
  const normalizedNodeKey = String(nodeKey ?? "").trim();
  const normalizedCandidate = String(candidate ?? "").trim();
  if (!normalizedNodeKey || !normalizedCandidate) return;

  const current = store.get(normalizedNodeKey);
  if (!current || normalizedCandidate.length > current.length) {
    store.set(normalizedNodeKey, normalizedCandidate);
  }
}

function normalizeMissionNodeFromSourceId(sourceId: string): NormalizedMissionNode | null {
  const normalized = String(sourceId ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const cacheMatch = normalized.match(/^data:caches\/([^/]+)\/(.+)$/);
  if (cacheMatch) {
    return {
      nodeKey: `${cacheMatch[1]}/${cacheMatch[2]}`,
      isCacheNode: true,
    };
  }

  const nodeCacheMatch = normalized.match(/^data:node\/([^/]+)\/(.+)-caches$/);
  if (nodeCacheMatch) {
    return {
      nodeKey: `${nodeCacheMatch[1]}/${nodeCacheMatch[2]}`,
      isCacheNode: true,
    };
  }

  const missionMatch = normalized.match(/^data:missionreward\/([^/]+)\/([^/]+)(?:\/rotation([abc]))?$/);
  if (missionMatch) {
    return {
      nodeKey: `${missionMatch[1]}/${missionMatch[2]}`,
      rotation: missionMatch[3]?.toUpperCase(),
      isCacheNode: false,
    };
  }

  const embeddedMissionMatch = normalized.match(/missionreward[/:]([^/:]+)[/:]([^/:]+)(?:[/:]rotation([abc]))?$/);
  if (embeddedMissionMatch) {
    return {
      nodeKey: `${embeddedMissionMatch[1]}/${embeddedMissionMatch[2]}`,
      rotation: embeddedMissionMatch[3]?.toUpperCase(),
      isCacheNode: false,
    };
  }

  const dropNodeMatch = normalized.match(/^data:drop:node:([^:]+):(.+)$/);
  if (dropNodeMatch) {
    return {
      nodeKey: `${dropNodeMatch[1]}/${dropNodeMatch[2]}`,
      isCacheNode: false,
    };
  }

  return null;
}

function normalizeMissionNodeFromDropLocation(location: string): NormalizedMissionNode | null {
  const normalized = String(location ?? "").trim();
  if (!normalized) return null;

  const cacheMatch = normalized.match(/^([^/]+)\/([^,(]+)\s+\(Caches\)(?:,\s*Rotation\s+([ABC]))?$/i);
  if (cacheMatch) {
    return {
      nodeKey: `${cacheMatch[1].trim().toLowerCase()}/${cacheMatch[2].trim().toLowerCase()}`,
      rotation: cacheMatch[3]?.toUpperCase(),
      isCacheNode: true,
      title: `${cacheMatch[1].trim()}/${cacheMatch[2].trim()} (Caches)`,
    };
  }

  const rotationMatch = normalized.match(/,\s*Rotation\s+([ABC])\s*$/i);
  const title = rotationMatch ? normalized.slice(0, normalized.length - rotationMatch[0].length).trim() : normalized;
  const missionMatch = title.match(/^([^/]+)\/([^,(]+)(?:\s+\([^)]*\))?$/i);
  if (missionMatch) {
    return {
      nodeKey: `${missionMatch[1].trim().toLowerCase()}/${missionMatch[2].trim().toLowerCase()}`,
      rotation: rotationMatch?.[1]?.toUpperCase(),
      isCacheNode: false,
      title,
    };
  }

  return null;
}

function parseMissionLabelParts(rawLabel: string): ParsedMissionLabel | null {
  const normalized = String(rawLabel ?? "").trim();
  if (!normalized) return null;

  const label = normalized
    .replace(/^Mission Reward:\s*/i, "")
    .replace(/^Missionreward\s*-\s*/i, "")
    .trim();
  if (!label) return null;

  const technicalRotationMatch = label.match(/^(.+?)\s+-\s+(.+?)\s+-\s+Rotation\s+([ABC])$/i);
  if (technicalRotationMatch) {
    return {
      planet: technicalRotationMatch[1].trim(),
      node: technicalRotationMatch[2].trim(),
      rotation: technicalRotationMatch[3].toUpperCase(),
      isCacheNode: false,
      title: `${technicalRotationMatch[1].trim()}/${technicalRotationMatch[2].trim()}`,
    };
  }

  const slashMatch = label.match(/^([^/]+)\/(.+)$/);
  const dashMatch = label.match(/^(.+?)\s+-\s+(.+)$/);
  const planet = slashMatch?.[1] ?? dashMatch?.[1];
  const rawRest = slashMatch?.[2] ?? dashMatch?.[2];
  if (!planet || !rawRest) return null;

  const rest = rawRest.trim();
  const parenMatches = Array.from(rest.matchAll(/\(([^)]+)\)/g)).map((match) => match[1].trim());
  const rotationToken = parenMatches.find((token) => /^rotation\s+[abc]$/i.test(token));
  const rotation = rotationToken?.match(/^rotation\s+([abc])$/i)?.[1]?.toUpperCase();
  const isCacheNode = parenMatches.some((token) => /^caches$/i.test(token));
  const hasSteelPath = parenMatches.some((token) => /^steel path$/i.test(token));
  const mode = parenMatches.find((token) => !/^rotation\s+[abc]$/i.test(token) && !/^caches$/i.test(token) && !/^steel path$/i.test(token));
  const node = rest.replace(/\s*\([^)]*\)/g, "").trim();
  if (!node) return null;

  const titleSuffixes = [
    hasSteelPath ? "Steel Path" : null,
    mode ?? null,
    isCacheNode ? "Caches" : null,
  ].filter(Boolean);

  return {
    planet: planet.trim(),
    node,
    rotation,
    isCacheNode,
    title: `${planet.trim()}/${node}${titleSuffixes.length > 0 ? ` (${titleSuffixes.join(") (")})` : ""}`,
  };
}

function normalizeMissionNodeFromCatalogLabel(label: string): NormalizedMissionNode | null {
  const parsed = parseMissionLabelParts(label);
  if (!parsed) return null;

  return {
    nodeKey: `${parsed.planet.toLowerCase()}/${parsed.node.toLowerCase()}`,
    rotation: parsed.rotation,
    isCacheNode: parsed.isCacheNode,
    title: parsed.title,
  };
}

function normalizeSemanticSourceToken(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^(?:mission reward|wfitems location|transient reward):\s*/i, "")
    .replace(/\brotation\s+[abc]\b/gi, "")
    .replace(/[():,/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectSemanticSourceKeys(args: {
  family: Exclude<SourceFamily, "all">;
  title: string;
  sourceId?: string;
}): string[] {
  const title = String(args.title ?? "").trim();
  const sourceId = String(args.sourceId ?? "").trim().toLowerCase();
  const keys = new Set<string>();
  if (!title) return [];

  const push = (value?: string | null) => {
    const normalized = normalizeSemanticSourceToken(String(value ?? ""));
    if (normalized) keys.add(normalized);
  };

  push(title);

  const colonIndex = title.indexOf(": ");
  if (colonIndex > 0) {
    push(title.slice(colonIndex + 2));
  }

  const parenMatches = Array.from(title.matchAll(/\(([^)]+)\)/g));
  for (const match of parenMatches) {
    push(match[1]);
  }

  const slashModeMatch = title.match(/^[^/]+\/[^()]+\s+\(([^)]+)\)$/);
  if (slashModeMatch) {
    push(slashModeMatch[1]);
  }

  if (sourceId.startsWith("data:bounty/")) {
    push(sourceId.split("/").slice(2).join(" "));
  }

  if (sourceId.startsWith("data:transient/")) {
    push(sourceId.split("/").slice(1).join(" "));
  }

  if (sourceId.startsWith("data:wfitems:loc:")) {
    push(sourceId.replace(/^data:wfitems:loc:/, ""));
  }

  return [...keys];
}

function buildSemanticFallbackDedupeKey(args: {
  family: Exclude<SourceFamily, "all">;
  title: string;
  sourceId?: string;
}): string | null {
  const ranked = collectSemanticSourceKeys(args)
    .map((value) => normalizeSemanticSourceToken(value))
    .filter((value) => value.split(" ").length >= 3)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  const best = ranked[0];
  return best ? `${args.family}:${best}` : null;
}

type SemanticDropClusterMeta = {
  minChance: number;
  maxChance: number;
  rarities: Set<string>;
  rotations: Set<string>;
};

function normalizeActivityDomainToken(value: string): string | null {
  const normalized = normalizeSemanticSourceToken(value);
  if (!normalized) return null;
  if (normalized.includes("conclave")) return "conclave";
  if (normalized.includes("circuit")) return "circuit";
  if (normalized.includes("sortie")) return "sortie";
  if (normalized.includes("sanctuary")) return "sanctuary";
  if (normalized.includes("arbitration")) return "arbitration";
  if (normalized.includes("invasion")) return "invasion";
  return null;
}

function buildActivityDedupeKey(args: {
  title: string;
  sourceId?: string;
  normalizedNode?: NormalizedMissionNode | null;
}): string | null {
  const sourceId = String(args.sourceId ?? "").trim().toLowerCase();
  const normalizedNode = args.normalizedNode;

  if (normalizedNode) {
    return `activity:${normalizedNode.nodeKey}${normalizedNode.rotation ? `:rot${normalizedNode.rotation}` : ""}`;
  }

  if (sourceId === "data:conclave" || sourceId.startsWith("data:conclave/")) {
    return sourceId === "data:conclave"
      ? "activity:conclave"
      : `activity:${sourceId.replace(/^data:/, "")}`;
  }

  const semanticKeys = collectSemanticSourceKeys({ family: "activity", title: args.title, sourceId: args.sourceId });
  const domainToken =
    semanticKeys.map((value) => normalizeActivityDomainToken(value)).find(Boolean)
    ?? normalizeActivityDomainToken(sourceId.replace(/^data:/, "").replace(/[/:]+/g, " "));
  if (domainToken) return `activity:${domainToken}`;

  const fallback = semanticKeys[0];
  return fallback ? `activity:${fallback}` : null;
}

export function buildInventorySourceEntries(args: {
  itemName?: string | string[] | null;
  sourceIds?: string[];
  drops?: InventorySourceDrop[];
  worldState?: import("../lib/worldStateCache").WorldStateData | null;
  marketCreditsPrice?: number | null;
  marketPlatinumPrice?: number | null;
}): GroupedSourceEntry[] {
  const itemName = args.itemName ?? null;
  const sourceIds = args.sourceIds ?? [];
  const drops = args.drops ?? [];
  const worldState = args.worldState ?? null;
  const marketCreditsPrice = args.marketCreditsPrice ?? null;
  const marketPlatinumPrice = args.marketPlatinumPrice ?? null;

  const knownCacheNodes = new Set<string>();
  const knownMissionRotationKeys = new Set<string>();
  const knownMissionTitles = new Map<string, string>();
  let hasDetailedConclaveActivityDrops = false;

  for (const sourceId of sourceIds) {
    const sourceLabel = formatSourceDisplayLabel(SOURCE_INDEX[sourceId as keyof typeof SOURCE_INDEX]?.label ?? sourceId);
    const normalizedNodeFromSourceId = normalizeMissionNodeFromSourceId(sourceId);
    const normalizedNodeFromLabel = normalizeMissionNodeFromCatalogLabel(sourceLabel);
    const normalizedNode = normalizedNodeFromSourceId
      ? { ...normalizedNodeFromSourceId, title: normalizedNodeFromSourceId.title ?? normalizedNodeFromLabel?.title }
      : normalizedNodeFromLabel;
    if (!normalizedNode) continue;
    if (normalizedNode.isCacheNode) {
      knownCacheNodes.add(normalizedNode.nodeKey);
    }
    if (normalizedNode.rotation) {
      knownMissionRotationKeys.add(`mission:${normalizedNode.nodeKey}:rot${normalizedNode.rotation}`);
    }
    if (!normalizedNode.isCacheNode) {
      rememberRicherMissionTitle(knownMissionTitles, normalizedNode.nodeKey, normalizedNode.title);
    }
  }

  for (const drop of drops) {
    if (classifySourceFamilyFromDropLocation(drop.location) === "activity" && /\bconclave\b/i.test(drop.location)) {
      hasDetailedConclaveActivityDrops = true;
    }
    const normalizedNode = normalizeMissionNodeFromDropLocation(drop.location);
    if (!normalizedNode) continue;
    if (normalizedNode.isCacheNode) {
      knownCacheNodes.add(normalizedNode.nodeKey);
    }
    if (normalizedNode.rotation) {
      knownMissionRotationKeys.add(`mission:${normalizedNode.nodeKey}:rot${normalizedNode.rotation}`);
    }
    if (!normalizedNode.isCacheNode) {
      rememberRicherMissionTitle(knownMissionTitles, normalizedNode.nodeKey, normalizedNode.title);
    }
  }

  const semanticDropMetaByKey = new Map<string, SemanticDropClusterMeta>();

  const dropEntries: GroupedSourceEntry[] = drops.map((drop) => {
    const family = classifySourceFamilyFromDropLocation(drop.location);
    const badges: GroupedSourceBadge[] = [];
    const rarity = drop.rarity?.trim();
    const inlinePriceMeta = extractInlinePriceMeta(drop.location);
    let title = drop.location;
    let subtitle: string | undefined;
    let meta = inlinePriceMeta ?? (family === "vendor" ? undefined : formatDropPercent(drop.chance));
    let href = `https://wiki.warframe.com/w/${encodeURIComponent(drop.location.trim().replace(/\s+/g, "_"))}#Farming_Locations`;

    if (family === "vendor") {
      const commaIndex = drop.location.indexOf(", ");
      if (commaIndex > 0) {
        title = drop.location.slice(0, commaIndex);
        subtitle = drop.location.slice(commaIndex + 2);
        href = `https://wiki.warframe.com/w/${encodeURIComponent(title.trim().replace(/\s+/g, "_"))}`;
      }
    }

    if (family === "mission" || family === "activity") {
      const rotationMatch = drop.location.match(/,\s*Rotation\s+([ABC])\s*$/i);
      if (rotationMatch) {
        title = drop.location.slice(0, drop.location.length - rotationMatch[0].length).trim();
        badges.push({ label: `Rot ${rotationMatch[1].toUpperCase()}`, tone: "mission" });
      }
      if (family === "mission" && isSteelPathDrop(drop)) {
        badges.push({
          label: "Steel Path",
          tone: "warning",
          title: "This drop rate is from the Steel Path variant of the mission.",
        });
      }
    }

    if (family === "relic") {
      const baseName = drop.location.replace(/\s+\(.*?\)\s*$/, "").trim();
      const relicKey = baseName.replace(/\s+Relic\s*$/i, "").trim().toLowerCase();
      const relic = getRelicByKey(relicKey);
      const availability = relic ? getRelicAvailabilityStatus(relic.key, relic.isActive, worldState) : "available";
      const quality = drop.location.match(/\(([^)]+)\)$/)?.[1];
      title = baseName;
      href = `https://wiki.warframe.com/w/${encodeURIComponent(baseName.replace(/\s+/g, "_"))}`;
      if (quality) badges.push({ label: quality, tone: "relic" });
      if (availability === "vaulted") {
        badges.push({ label: "Vaulted", tone: "warning", title: "This relic is currently vaulted." });
      } else if (availability === "prime_resurgence") {
        badges.push({ label: "Prime Resurgence", tone: "relic", title: "This relic is currently offered through Prime Resurgence." });
      }
    }

    if (rarity && family !== "vendor") badges.push({ label: rarity, tone: "neutral" });
    const cacheDedupeKey = family === "cache" ? normalizeCacheKey(drop.location) : null;
    const missionDedupeKey = family === "mission"
      ? (() => {
          const normalizedNode = normalizeMissionNodeFromDropLocation(drop.location);
          return normalizedNode
            ? `mission:${normalizedNode.nodeKey}${normalizedNode.rotation ? `:rot${normalizedNode.rotation}` : ""}`
            : null;
        })()
      : null;
    const activityDedupeKey = family === "activity"
      ? buildActivityDedupeKey({
          title,
          normalizedNode: normalizeMissionNodeFromDropLocation(drop.location),
        })
      : null;
    const enemyDedupeKey = family === "enemy" ? normalizeEnemyKey(title) : null;
    const semanticFallbackDedupeKey =
      cacheDedupeKey || missionDedupeKey || activityDedupeKey || enemyDedupeKey
        ? null
        : buildSemanticFallbackDedupeKey({ family, title });

    if (family === "mission" || family === "cache" || family === "activity") {
      const rotationBadge = badges.find((badge) => /^Rot\s+[ABC]$/i.test(badge.label))?.label;
      const rarityLabel = badges.find((badge) => badge.tone === "neutral")?.label;
      for (const key of collectSemanticSourceKeys({ family, title })) {
        const existing = semanticDropMetaByKey.get(key);
        if (existing) {
          existing.minChance = Math.min(existing.minChance, drop.chance);
          existing.maxChance = Math.max(existing.maxChance, drop.chance);
          if (rarityLabel) existing.rarities.add(rarityLabel);
          if (rotationBadge) existing.rotations.add(rotationBadge);
        } else {
          semanticDropMetaByKey.set(key, {
            minChance: drop.chance,
            maxChance: drop.chance,
            rarities: new Set(rarityLabel ? [rarityLabel] : []),
            rotations: new Set(rotationBadge ? [rotationBadge] : []),
          });
        }
      }
    }

    return {
      id: `drop:${drop.location}:${drop.chance}:${drop.rarity ?? ""}`,
      family,
      dedupeKey: cacheDedupeKey ?? missionDedupeKey ?? activityDedupeKey ?? enemyDedupeKey ?? semanticFallbackDedupeKey ?? undefined,
      title,
      subtitle,
      meta,
      sortValue: Number.isFinite(drop.chance) ? drop.chance : undefined,
      href,
      badges,
    };
  });

  const catalogEntries: GroupedSourceEntry[] = sourceIds
    .filter((sourceId) => sourceId !== "data:crafting")
    .flatMap((sourceId) => {
      const label = formatSourceDisplayLabel(SOURCE_INDEX[sourceId as keyof typeof SOURCE_INDEX]?.label ?? sourceId);
      const normalizedNodeFromSourceId = normalizeMissionNodeFromSourceId(sourceId);
      const normalizedNodeFromLabel = normalizeMissionNodeFromCatalogLabel(label);
      const normalizedNode = normalizedNodeFromSourceId
        ? { ...normalizedNodeFromSourceId, title: normalizedNodeFromSourceId.title ?? normalizedNodeFromLabel?.title }
        : normalizedNodeFromLabel;
      const effectiveFamily =
        normalizedNode?.isCacheNode || (normalizedNode && knownCacheNodes.has(normalizedNode.nodeKey))
          ? "cache"
          : classifySourceFamilyFromCatalog(sourceId, label);
      if (effectiveFamily === "activity" && sourceId === "data:conclave" && hasDetailedConclaveActivityDrops) {
        return [];
      }
      const syndicateVendor = parseSyndicateVendorLabel(label);
      const vendorOffer =
        itemName && effectiveFamily === "vendor"
          ? getSyndicateVendorOffer(itemName, syndicateVendor?.vendorName ?? label.replace(/^Buy from\s+/i, "").trim())
          : null;
      const marketMeta =
        sourceId === "data:market/credits" && marketCreditsPrice && Number.isFinite(marketCreditsPrice)
          ? `${marketCreditsPrice.toLocaleString()} Credits`
          : sourceId === "data:market/platinum" && marketPlatinumPrice && Number.isFinite(marketPlatinumPrice)
            ? `${marketPlatinumPrice.toLocaleString()} Platinum`
            : null;
      const syndicateStanding =
        itemName && label.toLowerCase().startsWith("syndicate vendor:")
          ? getSyndicateVendorPrice(itemName, label)
          : null;
      const cacheDedupeKey = effectiveFamily === "cache"
        ? (normalizedNode?.nodeKey ? `cache:${normalizedNode.nodeKey}` : normalizeCacheKey(label))
        : null;
      const missionDedupeKey = effectiveFamily === "mission" && normalizedNode
        ? `mission:${normalizedNode.nodeKey}${normalizedNode.rotation ? `:rot${normalizedNode.rotation}` : ""}`
        : null;
      const enemyDedupeKey = effectiveFamily === "enemy" ? normalizeEnemyKey(label) : null;
      const semanticFallbackDedupeKey =
        cacheDedupeKey || missionDedupeKey || enemyDedupeKey
          ? null
          : buildSemanticFallbackDedupeKey({ family: effectiveFamily, title: label, sourceId });
      const enemyTitle = effectiveFamily === "enemy"
        ? label.replace(/^(?:Enemy(?:\s+Item)?\s+Drop|Resource\s+Drop\s+\(Avatar\)|Additional\s+Drop\s+\(Avatar\)|Enemy|Avatar\s+Drop):\s+/i, "").trim()
        : null;
      const missionBadges: GroupedSourceBadge[] = [];

      if (effectiveFamily === "mission" && normalizedNode?.rotation) {
        missionBadges.push({ label: `Rot ${normalizedNode.rotation}`, tone: "mission" });
      }

      const title = syndicateVendor?.vendorName
        ?? vendorOffer?.vendorName
        ?? enemyTitle
        ?? (effectiveFamily === "mission" ? knownMissionTitles.get(normalizedNode?.nodeKey ?? "") ?? normalizedNode?.title : null)
        ?? label.replace(/^Buy from\s+/i, "");
      const subtitle = syndicateVendor?.rankName
        ? `Rank ${syndicateVendor.rankNumber ?? "?"} · ${syndicateVendor.rankName}`
        : vendorOffer?.rankName
          ? `Rank ${vendorOffer.rankNumber ?? "?"} · ${vendorOffer.rankName}`
          : vendorOffer?.place && vendorOffer.place.includes(",")
            ? vendorOffer.place.split(",").slice(1).join(",").trim()
            : undefined;
      let meta = syndicateStanding != null
        ? `${syndicateStanding.toLocaleString()} Standing`
        : vendorOffer && vendorOffer.standing > 0
          ? `${vendorOffer.standing.toLocaleString()} Standing`
          : marketMeta ?? extractInlinePriceMeta(label) ?? undefined;
      const badges = [...missionBadges];
      let activityDedupeKey = effectiveFamily === "activity"
        ? buildActivityDedupeKey({ title: label, sourceId, normalizedNode })
        : null;

      if (!meta && (effectiveFamily === "mission" || effectiveFamily === "cache" || effectiveFamily === "activity")) {
        const semanticMatch = collectSemanticSourceKeys({ family: effectiveFamily, title, sourceId })
          .map((key) => semanticDropMetaByKey.get(key))
          .find(Boolean);

        if (semanticMatch) {
          meta = semanticMatch.minChance === semanticMatch.maxChance
            ? formatDropPercent(semanticMatch.maxChance)
            : `${formatDropPercent(semanticMatch.minChance)}-${formatDropPercent(semanticMatch.maxChance)}`;
          if (!badges.some((badge) => /^Rot\s+[ABC]$/i.test(badge.label)) && semanticMatch.rotations.size === 1) {
            const inferredRotation = [...semanticMatch.rotations][0];
            badges.push({ label: inferredRotation, tone: "mission" });
            if (effectiveFamily === "activity" && normalizedNode && !normalizedNode.rotation) {
              const rotationLetter = inferredRotation.match(/^Rot\s+([ABC])$/i)?.[1]?.toUpperCase();
              if (rotationLetter) {
                activityDedupeKey = `activity:${normalizedNode.nodeKey}:rot${rotationLetter}`;
              }
            }
          }
          if (!badges.some((badge) => badge.tone === "neutral") && semanticMatch.rarities.size === 1) {
            badges.push({ label: [...semanticMatch.rarities][0], tone: "neutral" });
          }
        }
      }

      return [{
        id: `catalog:${sourceId}`,
        family: effectiveFamily,
        dedupeKey: syndicateVendor?.vendorName
          ? `vendor:${syndicateVendor.vendorName}`
          : vendorOffer?.vendorName
            ? `vendor:${vendorOffer.vendorName}`
            : cacheDedupeKey ?? missionDedupeKey ?? activityDedupeKey ?? enemyDedupeKey ?? semanticFallbackDedupeKey ?? undefined,
        title,
        subtitle,
        meta,
        sortValue: undefined,
        badges,
      }];
    });

  return [...catalogEntries, ...dropEntries];
}

function getKnownMarketPrices(rawData: Record<string, unknown> | null | undefined, fallbackCredits?: number | null) {
  const regularPriceRaw = Number(rawData?.RegularPrice ?? 0);
  const premiumPriceRaw = Number(rawData?.PremiumPrice ?? 0);
  const fallbackCreditValue = Number(fallbackCredits ?? 0);

  return {
    marketCreditsPrice:
      (Number.isFinite(fallbackCreditValue) && fallbackCreditValue > 0
        ? fallbackCreditValue
        : Number.isFinite(regularPriceRaw) && regularPriceRaw > 0
          ? regularPriceRaw
          : null),
    marketPlatinumPrice:
      Number.isFinite(premiumPriceRaw) && premiumPriceRaw > 0
        ? premiumPriceRaw
        : null,
  };
}

type SortKey =
  | "az"
  | "za"
  | "type-asc"
  | "type-desc"
  | "count-desc"
  | "count-asc"
  | "owned-first"
  | "unowned-first"
  | "mastered-last"
  | "release-newest"
  | "release-oldest"
  | "mr-asc"
  | "mr-desc";

type InventoryColumnKey =
  | "item"
  | "type"
  | "release"
  | "mr"
  | "available"
  | "count"
  | "mastered"
  | "goal";

const INVENTORY_COLUMN_STORAGE_KEY = "tnh.inventory.visibleColumns";
const DEFAULT_INVENTORY_COLUMNS: InventoryColumnKey[] = [
  "item",
  "type",
  "release",
  "mr",
  "available",
  "count",
  "mastered",
  "goal",
];

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

type PrimaryTab =
  | "all"
  | "warframesVehicles"
  | "weapons"
  | "companions"
  | "safeToSell"
  | "components"
  | "resources"
  | "railjack";

type WarframesVehiclesTab = "all" | "warframes" | "archwings" | "necramechs";
type CompanionsTab =
  | "all"
  | "hound"
  | "kavat"
  | "kubrow"
  | "moa"
  | "sentinel"
  | "predasite"
  | "vulpaphyla";
type WeaponClassTab = "all" | "primary" | "secondary" | "melee" | "companion";
type TagFilterState = "include" | "exclude";

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function titleCase(s: string): string {
  if (!s) return s;
  return s
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function prettifyPathTail(path: string): string {
  const tail = String(path ?? "").split("/").filter(Boolean).pop() ?? "";
  if (!tail) return "";
  return tail
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

function getInventoryItemTypeLabel(args: {
  rawType: string;
  cls: Classification;
  label: string;
  path: string;
}): string {
  const rawType = String(args.rawType ?? "").trim();
  const label = String(args.label ?? "").trim();
  const path = String(args.path ?? "").trim();

  if (rawType && !rawType.startsWith("/Lotus/")) {
    return rawType;
  }

  if (label.toLowerCase().endsWith(" blueprint")) return "Blueprint";

  if (args.cls.groups.has("components")) {
    if (path.includes("/Weapons/WeaponParts/")) return "Weapon Part";
    if (path.includes("/WarframeRecipes/")) return "Warframe Part";
    if (path.includes("/MoaPetParts/")) return "Moa Part";
    if (path.includes("/CreaturePetParts/")) return "Pet Part";
    if (path.includes("/SentinelParts/")) return "Sentinel Part";
    if (path.includes("/Recipes/")) return "Component";
    return "Part";
  }

  if (args.cls.groups.has("resources")) return "Resource";
  if (args.cls.groups.has("railjack")) return "Railjack";

  if (args.cls.groups.has("companions")) {
    if (args.cls.companionsSub.has("hound")) return "Hound";
    if (args.cls.companionsSub.has("kavat")) return "Kavat";
    if (args.cls.companionsSub.has("kubrow")) return "Kubrow";
    if (args.cls.companionsSub.has("moa")) return "Moa";
    if (args.cls.companionsSub.has("predasite")) return "Predasite";
    if (args.cls.companionsSub.has("sentinel")) return "Sentinel";
    if (args.cls.companionsSub.has("vulpaphyla")) return "Vulpaphyla";
    return "Companion";
  }

  if (args.cls.groups.has("warframesVehicles")) {
    if (args.cls.warframesVehiclesSub.has("archwings")) return "Archwing";
    if (args.cls.warframesVehiclesSub.has("necramechs")) return "Necramech";
    if (args.cls.warframesVehiclesSub.has("warframes")) return "Warframe";
  }

  const firstWeaponClass = (["primary", "secondary", "melee", "companion"] as const).find((wc) =>
    args.cls.weaponClasses.has(wc),
  );
  if (firstWeaponClass) {
    const firstWeaponType = Array.from(args.cls.weaponTypesByClass[firstWeaponClass] ?? [])[0];
    if (firstWeaponType) return titleCase(firstWeaponType);
    return titleCase(firstWeaponClass);
  }

  return prettifyPathTail(path) || "Item";
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

function loadVisibleInventoryColumns(): InventoryColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_INVENTORY_COLUMNS;
  try {
    const raw = window.localStorage.getItem(INVENTORY_COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_INVENTORY_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_INVENTORY_COLUMNS;
    const valid = parsed.filter((value): value is InventoryColumnKey =>
      DEFAULT_INVENTORY_COLUMNS.includes(value as InventoryColumnKey),
    );
    if (!valid.includes("item")) valid.unshift("item");
    return valid.length > 0 ? valid : DEFAULT_INVENTORY_COLUMNS;
  } catch {
    return DEFAULT_INVENTORY_COLUMNS;
  }
}

function resolveRecordPath(rec: any): string {
  return String(
    rec?.path ??
      rec?.raw?.rawLotus?.uniqueName ??
      rec?.raw?.rawWfcd?.uniqueName ??
      "",
  );
}

function isModularAssemblyPartCatalogId(id: CatalogId): boolean {
  const rec: any = FULL_CATALOG.recordsById[id];
  if (!rec) return false;

  const path = resolveRecordPath(rec);
  if (!path) return false;

  return (
    path.includes("/Weapons/Ostron/Melee/ModularMelee") ||
    path.includes("/Weapons/Sentients/OperatorAmplifiers/") ||
    path.includes("/Weapons/SolarisUnited/Primary/SUModularPrimary") ||
    path.includes("/Weapons/SolarisUnited/Secondary/SUModularSecondary") ||
    path.includes("/Types/Friendly/Pets/MoaPets/MoaPetParts/") ||
    path.includes("/Types/Friendly/Pets/CreaturePets/CreaturePetParts/")
  );
}

function isModularMasteryDriverPath(path: string): boolean {
  return (
    path.includes("/Types/Friendly/Pets/MoaPets/MoaPetParts/MoaPetHead") ||
    path.includes("/Weapons/Ostron/Melee/ModularMelee/") ||
    path.includes("/Weapons/Sentients/OperatorAmplifiers/") ||
    path.includes("/Weapons/SolarisUnited/Primary/SUModularPrimary") ||
    path.includes("/Weapons/SolarisUnited/Secondary/SUModularSecondary")
  );
}

// ─── All.json item index ───────────────────────────────────────────────────

interface AllDrop {
  chance: number;
  location: string;
  rarity: string;
  type: string;
}
interface AllComponent {
  name: string;
  uniqueName?: string;
  description?: string;
  itemCount?: number;
  drops?: AllDrop[];
}
interface AllAbility {
  name: string;
  description: string;
}
interface AllItemEntry {
  uniqueName: string;
  name: string;
  category: string;
  description?: string;
  passiveDescription?: string;
  type?: string;
  imageName?: string;
  // Build
  buildPrice?: number;
  buildQuantity?: number;
  buildTime?: number;
  bpCost?: number;
  consumeOnBuild?: boolean;
  components?: AllComponent[];
  // Mastery / release
  masteryReq?: number;
  releaseDate?: string;
  introduced?: { name: string };
  vaulted?: boolean;
  vaultDate?: string;
  tradable?: boolean;
  isPrime?: boolean;
  // Warframe stats
  health?: number;
  shield?: number;
  armor?: number;
  power?: number;
  sprintSpeed?: number;
  polarities?: string[];
  aura?: string;
  abilities?: AllAbility[];
  exalted?: string[];
  // Weapon stats
  damage?: Record<string, number>;
  totalDamage?: number;
  criticalChance?: number;
  criticalMultiplier?: number;
  procChance?: number;
  fireRate?: number;
  magazineSize?: number;
  reloadTime?: number;
  accuracy?: number;
  multishot?: number;
  noise?: string;
  trigger?: string;
  slot?: number;
  disposition?: number;
  omegaAttenuation?: number;
  // Melee specific
  range?: number;
  followThrough?: number;
  comboDuration?: number;
  heavyAttackDamage?: number;
  slamAttack?: number;
  slideAttack?: number;
  stancePolarity?: string;
  // Companion stats
  stamina?: number;
  // Drops
  drops?: AllDrop[];
  // Wiki
  wikiaUrl?: string;
  wikiaThumbnail?: string;
  // Nightwave challenges
  required?: number;
  standing?: number;
}

type DerivedDropIndex = Record<string, InventorySourceDrop[]>;

const ALL_BY_UNIQUE: Record<string, AllItemEntry> = {};
const ALL_BY_NAME: Record<string, AllItemEntry> = {};
const DERIVED_DROPS_BY_UNIQUE = ITEM_DROPS_DERIVED as DerivedDropIndex;

function foldDropEvidenceDiacritics(value: string): string {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeDropEvidenceName(value: string): string {
  return foldDropEvidenceDiacritics(String(value ?? ""))
    .replace(/^\s*\d[\d,]*\s*[xX]\s*/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUniqueNamesByNormalizedNameIndex(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const raw of ALL_RAW as AllItemEntry[]) {
    if (!raw?.uniqueName || !raw?.name) continue;
    const key = normalizeDropEvidenceName(raw.name);
    if (!key) continue;
    if (!out.has(key)) out.set(key, new Set<string>());
    out.get(key)!.add(raw.uniqueName);
  }
  return out;
}

function pushFallbackDrop(
  out: Map<string, InventorySourceDrop[]>,
  uniqueNameIndex: Map<string, Set<string>>,
  itemName: string,
  drop: InventorySourceDrop,
) {
  const key = normalizeDropEvidenceName(itemName);
  if (!key) return;
  const uniqueNames = [...(uniqueNameIndex.get(key) ?? [])];
  if (uniqueNames.length !== 1) return;
  const uniqueName = uniqueNames[0];
  const existing = out.get(uniqueName) ?? [];
  if (
    existing.some((entry) =>
      entry.location === drop.location &&
      entry.chance === drop.chance &&
      (entry.rarity ?? "") === (drop.rarity ?? ""),
    )
  ) {
    return;
  }
  out.set(uniqueName, [...existing, drop]);
}

function collectRewardEntries(node: unknown): Array<{ itemName: string; rarity: string; chance: number }> {
  const out: Array<{ itemName: string; rarity: string; chance: number }> = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const itemName =
      typeof record.itemName === "string"
        ? record.itemName
        : typeof record.item === "string"
          ? record.item
          : null;
    const chance = typeof record.chance === "number" ? record.chance : null;
    if (itemName && chance != null) {
      out.push({
        itemName,
        rarity: typeof record.rarity === "string" ? record.rarity : "",
        chance,
      });
    }

    for (const nested of Object.values(record)) visit(nested);
  };

  visit(node);
  return out;
}

function buildFallbackDropsByUniqueIndex(): DerivedDropIndex {
  const out = new Map<string, InventorySourceDrop[]>();
  const uniqueNameIndex = buildUniqueNamesByNormalizedNameIndex();

  const resourceRows = (resourceByAvatarJson as any)?.resourceByAvatar ?? resourceByAvatarJson;
  if (Array.isArray(resourceRows)) {
    for (const row of resourceRows) {
      const source = typeof row?.source === "string" ? row.source.trim() : "";
      if (!source) continue;
      for (const item of Array.isArray(row?.items) ? row.items : []) {
        if (typeof item?.item !== "string" || typeof item?.chance !== "number") continue;
        pushFallbackDrop(out, uniqueNameIndex, item.item, {
          location: `Resource Drop (Avatar): ${source}`,
          chance: item.chance,
          rarity: typeof item?.rarity === "string" ? item.rarity : "",
          type: item.item,
        });
      }
    }
  }

  const additionalRows = (additionalItemByAvatarJson as any)?.additionalItemByAvatar ?? additionalItemByAvatarJson;
  if (Array.isArray(additionalRows)) {
    for (const row of additionalRows) {
      const source = typeof row?.source === "string" ? row.source.trim() : "";
      if (!source) continue;
      for (const item of Array.isArray(row?.items) ? row.items : []) {
        if (typeof item?.item !== "string" || typeof item?.chance !== "number") continue;
        pushFallbackDrop(out, uniqueNameIndex, item.item, {
          location: `Additional Drop (Avatar): ${source}`,
          chance: item.chance,
          rarity: typeof item?.rarity === "string" ? item.rarity : "",
          type: item.item,
        });
      }
    }
  }

  const miscRows = (miscItemsJson as any)?.miscItems ?? miscItemsJson;
  if (Array.isArray(miscRows)) {
    for (const row of miscRows) {
      const enemyName = typeof row?.enemyName === "string" ? row.enemyName.trim() : "";
      if (!enemyName) continue;
      for (const item of Array.isArray(row?.items) ? row.items : []) {
        if (typeof item?.itemName !== "string" || typeof item?.chance !== "number") continue;
        pushFallbackDrop(out, uniqueNameIndex, item.itemName, {
          location: `Enemy Item Drop: ${enemyName}`,
          chance: item.chance,
          rarity: typeof item?.rarity === "string" ? item.rarity : "",
          type: item.itemName,
        });
      }
    }
  }

  const bountyDatasets: Array<{ root: unknown; key: string; label: string }> = [
    { root: solarisBountyRewardsJson, key: "solarisBountyRewards", label: "Solaris Bounty" },
    { root: cetusBountyRewardsJson, key: "cetusBountyRewards", label: "Cetus Bounty" },
    { root: deimosRewardsJson, key: "deimosRewards", label: "Deimos Bounty" },
    { root: entratiLabRewardsJson, key: "entratiLabRewards", label: "Entrati Lab Bounty" },
    { root: hexRewardsJson, key: "hexRewards", label: "Hex Bounty" },
    { root: zarimanRewardsJson, key: "zarimanRewards", label: "Zariman Bounty" },
  ];
  for (const dataset of bountyDatasets) {
    const rows = (dataset.root as any)?.[dataset.key] ?? dataset.root;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const bountyLabel =
        typeof row?.bountyLevel === "string"
          ? row.bountyLevel.trim()
          : typeof row?.bountyName === "string"
            ? row.bountyName.trim()
            : typeof row?.objectiveName === "string"
              ? row.objectiveName.trim()
              : typeof row?.name === "string"
                ? row.name.trim()
                : "";
      if (!bountyLabel) continue;
      const rewards = row?.rewards;
      if (!rewards || typeof rewards !== "object") continue;
      for (const [rotation, entries] of Object.entries(rewards as Record<string, unknown>)) {
        const rewardsForRotation = collectRewardEntries(entries);
        for (const reward of rewardsForRotation) {
          pushFallbackDrop(out, uniqueNameIndex, reward.itemName, {
            location: `${dataset.label}: ${bountyLabel}, Rotation ${String(rotation).toUpperCase()}`,
            chance: reward.chance,
            rarity: reward.rarity,
            type: reward.itemName,
          });
        }
      }
    }
  }

  const missionRewardRoot = (missionRewardsJson as any)?.missionRewards ?? missionRewardsJson;
  if (missionRewardRoot && typeof missionRewardRoot === "object" && !Array.isArray(missionRewardRoot)) {
    for (const [planetName, planetObj] of Object.entries(missionRewardRoot as Record<string, any>)) {
      if (!planetObj || typeof planetObj !== "object") continue;
      for (const [nodeNameRaw, nodeObj] of Object.entries(planetObj as Record<string, any>)) {
        if (!nodeObj || typeof nodeObj !== "object") continue;
        const rewards = (nodeObj as any)?.rewards;
        if (!rewards || typeof rewards !== "object") continue;
        const gameMode = typeof (nodeObj as any)?.gameMode === "string" ? (nodeObj as any).gameMode.trim() : "";
        const nodeName = String(nodeNameRaw ?? "").replace(/\s*\(Extra\)\s*$/i, " (Steel Path)").trim();
        for (const [rotation, entries] of Object.entries(rewards as Record<string, unknown>)) {
          const rewardsForRotation = collectRewardEntries(entries);
          for (const reward of rewardsForRotation) {
            pushFallbackDrop(out, uniqueNameIndex, reward.itemName, {
              location: `${planetName}/${nodeName}${gameMode ? ` (${gameMode})` : ""}, Rotation ${String(rotation).toUpperCase()}`,
              chance: reward.chance,
              rarity: reward.rarity,
              type: reward.itemName,
            });
          }
        }
      }
    }
  }

  const finalized: DerivedDropIndex = {};
  for (const [uniqueName, drops] of out.entries()) {
    finalized[uniqueName] = [...drops].sort((a, b) => b.chance - a.chance || a.location.localeCompare(b.location));
  }
  return finalized;
}

const FALLBACK_DROPS_BY_UNIQUE = buildFallbackDropsByUniqueIndex();

for (const raw of ALL_RAW as AllItemEntry[]) {
  const entry = withManualReleaseDateFallback(raw);
  if (entry.uniqueName) {
    if (!ALL_BY_UNIQUE[entry.uniqueName]) ALL_BY_UNIQUE[entry.uniqueName] = entry;
  }
  if (entry.name && !ALL_BY_NAME[entry.name]) ALL_BY_NAME[entry.name] = entry;
}

function getAllEntry(
  uniqueName?: string,
  displayName?: string,
): AllItemEntry | null {
  if (uniqueName) {
    const e = ALL_BY_UNIQUE[uniqueName];
    if (e) return e;
  }
  if (displayName) {
    const e = ALL_BY_NAME[displayName];
    if (e) return e;
  }
  return null;
}

function resolveDropsForUniqueName(uniqueName?: string): InventorySourceDrop[] {
  if (!uniqueName) return [];
  const directDrops = getAllEntry(uniqueName)?.drops ?? [];
  if (directDrops.length > 0) return directDrops;
  const derivedDrops = DERIVED_DROPS_BY_UNIQUE[uniqueName] ?? [];
  if (derivedDrops.length > 0) return derivedDrops;
  return FALLBACK_DROPS_BY_UNIQUE[uniqueName] ?? [];
}

export function resolveComponentDrops(component: {
  uniqueName?: string;
  name: string;
  drops?: InventorySourceDrop[];
}): InventorySourceDrop[] {
  if (Array.isArray(component.drops) && component.drops.length > 0) {
    return component.drops;
  }

  return resolveDropsForUniqueName(component.uniqueName);
}

function fmtBuildTime(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(0)}h`;
  return `${(seconds / 86400).toFixed(0)}d`;
}

function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
function fmtMult(v: number): string {
  return `${v.toFixed(1)}x`;
}

const SOURCE_FAMILY_LABELS: Record<Exclude<SourceFamily, "all">, string> = {
  vendor: "Vendor",
  mission: "Mission",
  cache: "Cache",
  relic: "Relic",
  enemy: "Enemy",
  activity: "Activity",
  market: "Market",
  quest: "Quest",
  crafting: "Crafting",
  other: "Other",
};

const DISPOSITION_DOTS: Record<number, string> = {
  1: "●○○○○",
  2: "●●○○○",
  3: "●●●○○",
  4: "●●●●○",
  5: "●●●●●",
};
const POLARITY_LABELS: Record<string, string> = {
  madurai: "Madurai (V)",
  naramon: "Naramon (−)",
  vazarin: "Vazarin (D)",
  zenurik: "Zenurik (=)",
  unairu: "Unairu (⬡)",
  umbra: "Umbra (⬟)",
};

function StatBox({
  label,
  value,
  color = "text-slate-200",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-4 py-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={["text-base font-semibold leading-tight", color].join(" ")}>{value}</div>
    </div>
  );
}
function Label({
  children,
  color = "text-slate-400",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      className={[
        "mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]",
        color,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Render a description string, replacing DT_ status tags and |VAR| placeholders */

const DT_TO_IMG_INV: Record<string, string> = {
  dt_corrosive_color: "essentialcorrosiveglyph", dt_corrosive: "essentialcorrosiveglyph",
  dt_electricity_color: "electricmodbundleicon", dt_electricity: "electricmodbundleicon",
  dt_explosion_color: "essentialblastglyph",    dt_explosion: "essentialblastglyph",
  dt_fire_color: "heatmodbundleicon",            dt_fire: "heatmodbundleicon",
  dt_freeze_color: "coldmodbundleicon",          dt_freeze: "coldmodbundleicon",
  dt_gas_color: "essentialgasglyph",             dt_gas: "essentialgasglyph",
  dt_impact_color: "essentialimpactglyph",
  dt_magnetic_color: "essentialmagneticglyph",  dt_magnetic: "essentialmagneticglyph",
  dt_poison_color: "toxinmodbundleicon",         dt_poison: "toxinmodbundleicon",
  dt_puncture_color: "essentialpunctureglyph",
  dt_radiant_color: "essentialradiationglyph",
  dt_radiation_color: "essentialradiationglyph", dt_radiation: "essentialradiationglyph",
  dt_sentient_color: "essentialtauglyph",        dt_sentient: "essentialtauglyph",
  dt_slash_color: "essentialslashglyph",         dt_slash: "essentialslashglyph",
  dt_viral_color: "essentialviralglyph",         dt_viral: "essentialviralglyph",
};

function renderDesc(text: string, values?: Record<string, string | number>): React.ReactNode {
  const cleaned = text
    .replace(/\n/g, "\n")
    .replace(/<LINE_SEPARATOR>/g, " · ")
    .replace(/<LOWER_IS_BETTER>/g, "")
    .replace(/<[A-Z_]+_SECONDARY_COLOR>/g, "")
    .replace(/<\/[A-Z_]+_SECONDARY_COLOR>/g, "")
    .replace(/<(?!DT_)[A-Z_]+>/g, "");

  const parts = cleaned.split(/(<DT_[A-Z_]+>|\|[A-Z_0-9]+\|)/);
  if (parts.length === 1) return <>{cleaned}</>;

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("|") && part.endsWith("|")) {
      const varName = part.slice(1, -1);
      const resolved = values?.[varName] ?? values?.[varName.toLowerCase()];
      if (resolved !== undefined) {
        nodes.push(<span key={i} className="text-slate-100 font-semibold">{resolved}</span>);
      } else {
        const label = varName.toLowerCase().replace(/_/g, " ");
        nodes.push(
          <span
            key={i}
            className="inline-flex items-center rounded px-1 text-[10px] font-mono bg-slate-700/60 text-slate-400 border border-slate-600/50 mx-0.5"
            title="Exact value scales with Warframe stats and mods"
          >
            {label}
          </span>
        );
      }
    } else if (part.startsWith("<DT_") && part.endsWith(">")) {
      const key = part.slice(1, -1).toLowerCase();
      const imgUrl = DT_TO_IMG_INV[key] ? STATUS_IMG_INV[DT_TO_IMG_INV[key]] : null;
      if (imgUrl) {
        nodes.push(
          <img key={i} src={imgUrl}
            alt={key.replace("dt_", "").replace("_color", "")}
            title={key.replace("dt_", "").replace(/_color$/, "").replace(/_/g, " ")}
            className="inline w-3.5 h-3.5 object-contain mx-0.5 -mt-0.5"
          />
        );
      }
    } else if (part) {
      nodes.push(<span key={i}>{part}</span>);
    }
  }
  return <>{nodes}</>;
}

function wikiUrl(name: string): string {
  return `https://wiki.warframe.com/w/${encodeURIComponent(name.trim().replace(/\s+/g, "_"))}`;
}
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

function safeInt(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function TabButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <CollectionModeButton active={props.active} onClick={props.onClick}>
      {props.label}
    </CollectionModeButton>
  );
}

function SubTabButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return <WorkspaceSegmentedButton active={props.active} onClick={props.onClick} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm">{props.label}</WorkspaceSegmentedButton>;
}

function PillButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return <WorkspacePillButton label={props.label} active={props.active} onClick={props.onClick} />;
}

function SafeToSellModeButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      className={[
        "group flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
        props.active
          ? "border-cyan-700/60 bg-cyan-950/24 text-cyan-100 shadow-[0_0_0_1px_rgba(8,145,178,0.16)]"
          : "border-slate-800/80 bg-slate-950/18 text-slate-300 hover:border-slate-700 hover:bg-slate-900/55",
      ].join(" ")}
    >
      <span className="text-sm font-semibold">{props.label}</span>
      <span
        className={[
          "h-2.5 w-2.5 rounded-full transition-all duration-200",
          props.active
            ? "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.45)]"
            : "bg-slate-700 group-hover:bg-slate-500",
        ].join(" ")}
      />
    </button>
  );
}

function SafeToSellRuleChip(props: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={props.description}
      onClick={props.onClick}
      className={[
        "group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
        props.active
          ? "border-amber-700/45 bg-amber-950/18 text-amber-100 shadow-[0_0_0_1px_rgba(180,83,9,0.12)]"
          : "border-slate-800/80 bg-slate-950/16 text-slate-300 hover:border-slate-700 hover:bg-slate-900/55",
      ].join(" ")}
    >
      <span
        className={[
          "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
          props.active ? "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.45)]" : "bg-slate-700 group-hover:bg-slate-500",
        ].join(" ")}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{props.label}</span>
      </span>
      <span className={["shrink-0 text-[11px] font-medium uppercase tracking-[0.14em]", props.active ? "text-amber-200/80" : "text-slate-500 group-hover:text-slate-400"].join(" ")}>
        {props.active ? "Keep" : "Allow"}
      </span>
    </button>
  );
}

function SafeToSellStatusPill(props: {
  tone: "safe" | "protected" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    props.tone === "safe"
      ? "border-emerald-800/40 bg-emerald-950/20 text-emerald-200"
      : props.tone === "protected"
        ? "border-amber-800/40 bg-amber-950/20 text-amber-200"
        : "border-slate-800 bg-slate-900/70 text-slate-300";
  return <span className={["rounded-full border px-3 py-1.5 text-xs", toneClass].join(" ")}>{props.children}</span>;
}

function FilterTagButton(props: {
  label: ReactNode;
  state?: TagFilterState;
  onClick: () => void;
  title?: string;
}) {
  const state = props.state;
  return (
    <button
      title={props.title}
      className={[
        "rounded-full px-3 py-1.5 text-sm border transition-colors",
        state === "include"
          ? "bg-slate-100 text-slate-900 border-slate-100"
          : state === "exclude"
            ? "bg-rose-950/30 text-rose-200 border-rose-800/70"
            : "bg-slate-950/40 text-slate-200 border-slate-700 hover:bg-slate-900",
      ].join(" ")}
      onClick={props.onClick}
    >
      <span className={state === "exclude" ? "line-through decoration-rose-300/70" : undefined}>
        {props.label}
      </span>
    </button>
  );
}

type CategoryMeta = {
  main: string;
  sub: string | null;
};

function splitCategory(raw: string): CategoryMeta {
  const norm = normalize(raw ?? "");
  if (!norm) {
    return { main: "", sub: null };
  }

  const parts = norm.split("-");
  const main = parts[0] ?? "";
  const sub = parts.length > 1 ? parts.slice(1).join("-") : null;
  return { main, sub };
}

type Classification = {
  groups: Set<PrimaryTab>;

  warframesVehiclesSub: Set<Exclude<WarframesVehiclesTab, "all">>;
  companionsSub: Set<Exclude<CompanionsTab, "all">>;

  weaponClasses: Set<WeaponClassTab>;
  weaponTypesByClass: Partial<Record<WeaponClassTab, Set<string>>>;

  isResource: boolean;
  isComponent: boolean;
};

function emptyClassification(): Classification {
  return {
    groups: new Set<PrimaryTab>(),
    warframesVehiclesSub: new Set(),
    companionsSub: new Set(),
    weaponClasses: new Set(),
    weaponTypesByClass: {
      primary: new Set(),
      secondary: new Set(),
      melee: new Set(),
      companion: new Set(),
    },
    isResource: false,
    isComponent: false,
  };
}

const WEAPON_TYPE_BLOCKLIST = new Set<string>([
  "weapon",
  "weapons",
  "gun",
  "guns",
  "melee",
  "primary",
  "secondary",
  "archgun",
  "archguns",
  "tome",
  "tomes",
  "speargun",
  "spearguns",
  "kitgun",
  "kitguns",
]);

function classifyFromCategories(categories: string[]): Classification {
  const cls = emptyClassification();

  const metas = categories.map(splitCategory).filter((m) => m.main.length > 0);

  const mains = new Set<string>(metas.map((m) => m.main));

  // Warframes & Vehicles
  for (const m of metas) {
    if (m.main === "warframe" || m.main === "warframes") {
      cls.groups.add("warframesVehicles");
      cls.warframesVehiclesSub.add("warframes");
    }
    if (m.main === "archwing" || m.main === "archwings") {
      cls.groups.add("warframesVehicles");
      cls.warframesVehiclesSub.add("archwings");
    }
    if (
      m.main === "necramech" ||
      m.main === "necramechs" ||
      m.main === "mech" ||
      m.main === "mechs"
    ) {
      cls.groups.add("warframesVehicles");
      cls.warframesVehiclesSub.add("necramechs");
    }
  }

  // Companions
  for (const m of metas) {
    if ((m.main === "pet" || m.main === "pets") && m.sub) {
      const first = normalize(m.sub).split("-")[0];
      if (first === "kavat") {
        cls.groups.add("companions");
        cls.companionsSub.add("kavat");
      } else if (first === "kubrow") {
        cls.groups.add("companions");
        cls.companionsSub.add("kubrow");
      } else if (first === "moa") {
        cls.groups.add("companions");
        cls.companionsSub.add("moa");
      } else if (first === "hound") {
        cls.groups.add("companions");
        cls.companionsSub.add("hound");
      } else if (first === "sentinel") {
        cls.groups.add("companions");
        cls.companionsSub.add("sentinel");
      } else if (first === "vulpaphyla") {
        cls.groups.add("companions");
        cls.companionsSub.add("vulpaphyla");
      } else if (first === "predasite") {
        cls.groups.add("companions");
        cls.companionsSub.add("predasite");
      }
    }

    if (
      m.main === "kavat" ||
      m.main === "kubrow" ||
      m.main === "moa" ||
      m.main === "hound" ||
      m.main === "vulpaphyla" ||
      m.main === "predasite"
    ) {
      cls.groups.add("companions");
      cls.companionsSub.add(m.main as Exclude<CompanionsTab, "all">);
    }
  }

  // Resources / Components (conservative)
  for (const m of metas) {
    const main = m.main;

    if (
      main === "resource" ||
      main === "resources" ||
      main === "material" ||
      main === "materials"
    ) {
      cls.groups.add("resources");
      cls.isResource = true;
    }

    if (
      main === "component" ||
      main === "components" ||
      main === "part" ||
      main === "parts" ||
      main === "blueprint" ||
      main === "blueprints"
    ) {
      cls.groups.add("components");
      cls.isComponent = true;
    }
  }

  // Weapons: class from plain category presence
  if (mains.has("primary")) cls.weaponClasses.add("primary");
  if (mains.has("secondary")) cls.weaponClasses.add("secondary");
  if (mains.has("melee")) cls.weaponClasses.add("melee");

  if (cls.weaponClasses.size > 0) {
    cls.groups.add("weapons");
  }

  // Explicit structured weapon subtypes: `primary-*`, `secondary-*`, `melee-*`
  for (const m of metas) {
    if (m.main === "primary" || m.main === "secondary" || m.main === "melee") {
      const wc = m.main as WeaponClassTab;
      if (m.sub) {
        if (!cls.weaponTypesByClass[wc]) cls.weaponTypesByClass[wc] = new Set();
        cls.weaponTypesByClass[wc]!.add(normalize(m.sub));
      }
    }
  }

  // Add "type-like" categories based on other categories
  const otherTypeCandidates = new Set<string>();

  for (const m of metas) {
    if (m.main === "primary" || m.main === "secondary" || m.main === "melee")
      continue;
    if (m.main === "pet") continue;

    const main = m.main;
    if (!main || WEAPON_TYPE_BLOCKLIST.has(main)) continue;

    if (
      main === "warframe" ||
      main === "warframes" ||
      main === "archwing" ||
      main === "archwings" ||
      main === "necramech" ||
      main === "necramechs" ||
      main === "mech" ||
      main === "mechs" ||
      main === "resource" ||
      main === "resources" ||
      main === "material" ||
      main === "materials" ||
      main === "component" ||
      main === "components" ||
      main === "part" ||
      main === "parts" ||
      main === "blueprint" ||
      main === "blueprints" ||
      main === "kavat" ||
      main === "kubrow" ||
      main === "moa" ||
      main === "hound" ||
      main === "sentinel" ||
      main === "sentinels"
    ) {
      continue;
    }

    otherTypeCandidates.add(main);
  }

  for (const wc of cls.weaponClasses) {
    if (!cls.weaponTypesByClass[wc]) cls.weaponTypesByClass[wc] = new Set();
    for (const t of otherTypeCandidates) {
      cls.weaponTypesByClass[wc]!.add(t);
    }
  }

  // Explicit coercions
  if (mains.has("archgun") || mains.has("archguns")) {
    cls.groups.add("weapons");
    cls.weaponClasses.add("primary");
    if (!cls.weaponTypesByClass.primary)
      cls.weaponTypesByClass.primary = new Set();
    cls.weaponTypesByClass.primary!.add("archgun");
  }

  if (mains.has("speargun") || mains.has("spearguns")) {
    cls.groups.add("weapons");
    cls.weaponClasses.add("primary");
    if (!cls.weaponTypesByClass.primary)
      cls.weaponTypesByClass.primary = new Set();
    cls.weaponTypesByClass.primary!.add("speargun");
  }

  if (mains.has("tome") || mains.has("tomes")) {
    cls.groups.add("weapons");
    cls.weaponClasses.add("secondary");
    if (!cls.weaponTypesByClass.secondary)
      cls.weaponTypesByClass.secondary = new Set();
    cls.weaponTypesByClass.secondary!.add("tome");
  }

  if (mains.has("kitgun") || mains.has("kitguns")) {
    cls.groups.add("weapons");
    cls.weaponClasses.add("secondary");
    if (!cls.weaponTypesByClass.secondary)
      cls.weaponTypesByClass.secondary = new Set();
    cls.weaponTypesByClass.secondary!.add("kitgun");
  }

  return cls;
}

function getRawStringsForHeuristics(id: CatalogId, rec: any): string {
  const parts: string[] = [];

  parts.push(String(id));

  const raw: any = rec?.raw ?? {};
  const wfcd: any = raw?.rawWfcd ?? null;
  const lotus: any = raw?.rawLotus ?? null;

  // Common names in various merges
  const uniq =
    typeof wfcd?.uniqueName === "string"
      ? wfcd.uniqueName
      : typeof lotus?.uniqueName === "string"
        ? lotus.uniqueName
        : typeof raw?.uniqueName === "string"
          ? raw.uniqueName
          : "";

  const type =
    typeof wfcd?.type === "string"
      ? wfcd.type
      : typeof lotus?.type === "string"
        ? lotus.type
        : typeof raw?.type === "string"
          ? raw.type
          : "";

  const productCategory =
    typeof wfcd?.productCategory === "string"
      ? wfcd.productCategory
      : typeof lotus?.productCategory === "string"
        ? lotus.productCategory
        : "";

  const category =
    typeof wfcd?.category === "string"
      ? wfcd.category
      : typeof lotus?.category === "string"
        ? lotus.category
        : "";

  parts.push(uniq, type, productCategory, category);

  return normalize(parts.filter(Boolean).join(" | "));
}

function isCompanionLikeByRawHeuristic(h: string): boolean {
  // Be strict. Do NOT match generic words like "vulpaphyla" or "predasite" here,
  // because many non-companion items contain those words (tags, floofs, lures, glyphs).
  return (
    h.includes("/types/friendly/pets/") ||
    h.includes("catbrowpetpowersuit") ||
    h.includes("kubrowpetpowersuit") ||
    h.includes("petpowersuit") ||
    h.includes("sentinel") ||
    h.includes("moa") ||
    h.includes("hound")
  );
}

function coerceCompanionSubtypeFromHeuristic(
  catalogId: string,
  rec: any,
): Exclude<CompanionsTab, "all"> | null {
  const idh = normalize(String(catalogId));
  const name = normalize(String(rec?.displayName ?? ""));

  // Vulpaphylas: internally "InfestedCatbrowPetPowerSuit" (and BaseInfestedCatbrowPetPowerSuit)
  // The sample shows these live under: /Types/Friendly/Pets/CreaturePets/*InfestedCatbrowPetPowerSuit
  if (
    (idh.includes("/types/friendly/pets/") &&
      idh.includes("infestedcatbrowpetpowersuit")) ||
    (idh.includes("/types/friendly/pets/creaturepets/") &&
      idh.includes("catbrow") &&
      idh.includes("powersuit")) ||
    (name.includes("vulpaphyla") &&
      idh.includes("/types/friendly/pets/") &&
      idh.includes("powersuit"))
  ) {
    return "vulpaphyla";
  }

  // Predasites: internally "InfestedKubrowPetPowerSuit" (common pattern)
  if (
    (idh.includes("/types/friendly/pets/") &&
      idh.includes("infestedkubrowpetpowersuit")) ||
    (name.includes("predasite") &&
      idh.includes("/types/friendly/pets/") &&
      idh.includes("powersuit"))
  ) {
    return "predasite";
  }

  // Normal buckets (avoid name-only matches unless it’s clearly a pet powersuit)
  if (idh.includes("catbrow") && idh.includes("powersuit")) return "kavat";
  if (idh.includes("kubrow") && idh.includes("powersuit")) return "kubrow";
  if (idh.includes("moa") && idh.includes("powersuit")) return "moa";
  if (idh.includes("hound") && idh.includes("powersuit")) return "hound";
  if (idh.includes("sentinel")) return "sentinel";

  return null;
}

function isCompanionWeaponByCatalogId(catalogId: string): boolean {
  const h = normalize(String(catalogId));

  // Beast/robot/sentinel weapons stored under the Pets namespace
  if (h.includes("/types/friendly/pets/") && h.includes("/beastweapons/"))
    return true;
  if (h.includes("/types/friendly/pets/") && h.includes("/robotweapons/"))
    return true;
  if (h.includes("/types/friendly/pets/") && h.includes("/sentinelweapons/"))
    return true;

  // Sentinel weapons stored directly under /Types/Sentinels/SentinelWeapons/
  // (e.g. Artax, Deth Machine Rifle, Deconstructor)
  if (h.includes("/types/sentinels/sentinelweapons/")) return true;

  // Common naming fragments
  if (h.includes("petweapon")) return true;

  return false;
}

function isRelicProjectionItem(catalogId: CatalogId, rec: any): boolean {
  const cid = String(catalogId);
  if (/\/Types\/Game\/Projections\//i.test(cid)) return true;

  const raw = rec?.raw as any;
  const wfcdName =
    raw?.rawWfcd?.uniqueName ?? raw?.rawWfcd?.unique_name ?? null;
  const lotusName =
    raw?.rawLotus?.uniqueName ?? raw?.rawLotus?.unique_name ?? null;

  const u = String(wfcdName ?? lotusName ?? "");
  return /\/Types\/Game\/Projections\//i.test(u);
}

function relicTierFromName(displayName: string): string | null {
  const s = normalize(String(displayName ?? ""));
  if (s.startsWith("lith ")) return "lith";
  if (s.startsWith("meso ")) return "meso";
  if (s.startsWith("neo ")) return "neo";
  if (s.startsWith("axi ")) return "axi";
  return null;
}

function isBaseTemplateCompanion(catalogId: string, rec: any): boolean {
  const idh = normalize(String(catalogId));
  const name = String(rec?.displayName ?? "");
  const isAllCaps = name.length > 0 && name === name.toUpperCase();

  // Only consider pet powersuits; avoids floofs/tags/lures/glyphs etc.
  const isPetPowerSuit =
    idh.includes("/types/friendly/pets/") && idh.includes("powersuit");

  // Common base/template naming
  const looksLikeBaseById = /\/base[a-z0-9_]*powersuit$/i.test(
    String(catalogId),
  );
  const hasBaseFragment =
    idh.includes("baseinfested") ||
    idh.includes("/base") ||
    idh.includes("basepredasite");

  return (
    isPetPowerSuit && (looksLikeBaseById || (hasBaseFragment && isAllCaps))
  );
}

function isRelicProjection(catalogId: string, rec: any): boolean {
  const cid = String(catalogId);

  if (/\/Types\/Game\/Projections\//i.test(cid)) return true;

  const raw = rec?.raw as any;
  const wfcdName =
    raw?.rawWfcd?.uniqueName ?? raw?.rawWfcd?.unique_name ?? null;
  const lotusName =
    raw?.rawLotus?.uniqueName ?? raw?.rawLotus?.unique_name ?? null;

  const u = String(wfcdName ?? lotusName ?? "");
  return /\/Types\/Game\/Projections\//i.test(u);
}

function isBaseTemplateRelic(catalogId: string, rec: any): boolean {
  // Hide base placeholder relic items like "Neo Relic", "Axi Relic", etc.
  // Keep actual projections like "Axi A1 Intact" etc.
  const name = String(rec?.displayName ?? "").trim();
  if (!name) return false;

  // Only apply to actual projection relic entities (avoid hiding unrelated cosmetics/strings)
  if (!isRelicProjection(String(catalogId), rec)) return false;

  // Exact generic base names
  if (/^(Lith|Meso|Neo|Axi)\s+Relic$/i.test(name)) return true;
  if (/^Void\s+Relic$/i.test(name)) return true;

  // Defensive: some base templates are ALLCAPS and very short
  const isAllCaps = name.length > 0 && name === name.toUpperCase();
  if (isAllCaps && /relic/i.test(name) && name.length <= 12) return true;

  return false;
}

/**
 * Minimal fallback classifier:
 * If WFCD categories aren’t sufficient (common for Resources/Components),
 * also use rec.raw.type to bucket.
 */
function classifyFromRecord(catalogId: string, rec: any): Classification {
  const categories = Array.isArray(rec?.categories)
    ? (rec.categories as string[])
    : [];
  const cls = classifyFromCategories(categories);
  const pathLower = normalize(String(rec?.path ?? catalogId));

  // Companion weapons (sentinel, beast, robot) get their own "companion" weapon class tab.
  // IMPORTANT: clear all other weapon classes so they don't bleed into Primary/Secondary/Melee.
  if (isCompanionWeaponByCatalogId(catalogId)) {
    cls.groups.delete("companions");
    cls.companionsSub.clear();
    // Remove from any non-companion weapon classes
    cls.weaponClasses.clear();
    cls.weaponTypesByClass = { companion: new Set() };

    cls.groups.add("weapons");
    cls.weaponClasses.add("companion");

    return cls;
  }

  const rawType =
    typeof rec?.raw?.type === "string" ? normalize(rec.raw.type) : "";

  if (rawType === "resource") {
    cls.groups.add("resources");
    cls.isResource = true;
  }

  if (
    pathLower.includes("/railjackmiscitems/") ||
    pathLower.includes("/crewship/railjack/") ||
    pathLower.includes("/railjackresourcerecipes/")
  ) {
    cls.groups.add("railjack");
  }

  if (
    rawType === "blueprint" ||
    rawType === "component" ||
    rawType === "part"
  ) {
    cls.groups.add("components");
    cls.isComponent = true;
  }

  // WFCD sometimes encodes materials as type="Misc"
  const mains = new Set(categories.map((c) => splitCategory(c).main));
  if (!cls.isResource && rawType === "misc" && mains.has("misc")) {
    cls.groups.add("resources");
    cls.isResource = true;
  }

  // Heuristic companion detection + subtype fix-ups.
  // Needed because some companion entities have weak/empty categories (e.g. base VULPAPHYLA powersuit).
  {
    const h = getRawStringsForHeuristics(catalogId as any, rec);

    const cid = normalize(String(catalogId));
    const isPetEntity =
      cid.includes("/types/friendly/pets/") &&
      (cid.includes("powersuit") || h.includes("petpowersuit"));

    // If it is clearly a pet entity, ensure it is in Companions even if categories were empty.
    if (isPetEntity && isCompanionLikeByRawHeuristic(h)) {
      cls.groups.add("companions");
    }

    if (cls.groups.has("companions")) {
      const sub = coerceCompanionSubtypeFromHeuristic(catalogId, rec);
      if (sub) {
        // If it was previously classified as kavat via `pet-kavat`, replace it.
        cls.companionsSub.delete("kavat");
        cls.companionsSub.add(sub);
      }
    }
  }

  return cls;
}

/** Items that contribute to mastery rank when leveled */
function isMasterableItem(cls: Classification, path?: string): boolean {
  if (path && isModularAssemblyPartCatalogId(`items:${path}` as CatalogId)) {
    return isModularMasteryDriverPath(path);
  }
  return (
    cls.groups.has("warframesVehicles") ||
    cls.groups.has("weapons") ||
    cls.groups.has("companions")
  );
}

function inventorySearchAliases(row: Pick<Row, "label" | "cls">): string[] {
  const aliases: string[] = [];

  if (row.cls.isComponent && !/\sblueprint$/i.test(row.label)) {
    aliases.push(`${row.label} Blueprint`);
  }

  return aliases;
}

function inventoryRowDuplicatePenalty(row: Pick<Row, "path" | "label">): number {
  const path = row.path.toLowerCase();
  let penalty = 0;

  if (path.includes("pvpvariant")) penalty += 1000;
  if (path.includes("/storeitems/")) penalty += 700;
  if (path.includes("starterpack")) penalty += 500;
  if (path.includes("tutorial")) penalty += 500;
  if (path.includes("junctionreward")) penalty += 500;
  if (path.includes("rewarditem")) penalty += 450;
  if (path.includes("bundle")) penalty += 400;
  if (path.includes("consumable")) penalty += 300;
  if (path.includes("wounded")) penalty += 300;
  if (path.includes("/base")) penalty += 250;
  if (path.includes("free")) penalty += 150;
  if (path.includes("fixed")) penalty += 150;

  return penalty;
}

function inventoryRowSourceSpecificityScore(row: Pick<Row, "id">): number {
  const acquisition = getAcquisitionByCatalogId(row.id);
  const sources = acquisition?.sources ?? [];
  let score = 0;

  for (const source of sources) {
    if (source.startsWith("data:quest/")) score += 100;
    else if (source.startsWith("data:events/")) score += 60;
    else if (source.startsWith("data:dojo/") || source.startsWith("data:clan/")) score += 50;
    else if (source.startsWith("data:vendor/")) score += 40;
    else if (source === "data:crafting") score -= 5;
    else if (source === "data:market/platinum") score -= 3;
    else score += 1;
  }

  return score;
}

function preferInventoryRow(a: Row, b: Row): Row {
  const specificityA = inventoryRowSourceSpecificityScore(a);
  const specificityB = inventoryRowSourceSpecificityScore(b);
  if (specificityA !== specificityB) return specificityA > specificityB ? a : b;

  const penaltyA = inventoryRowDuplicatePenalty(a);
  const penaltyB = inventoryRowDuplicatePenalty(b);
  if (penaltyA !== penaltyB) return penaltyA < penaltyB ? a : b;
  if (a.path.length !== b.path.length) return a.path.length < b.path.length ? a : b;
  return String(a.id).localeCompare(String(b.id)) <= 0 ? a : b;
}

/** Resolve mastery status supporting both catalog ID keys and legacy Lotus path keys */
function checkMastered(
  mastered: Record<string, boolean>,
  overLevelMastered: Record<string, boolean>,
  catalogId: string,
  path: string,
): boolean {
  return (
    mastered[catalogId] === true ||
    mastered[path] === true ||
    overLevelMastered[catalogId] === true ||
    overLevelMastered[path] === true
  );
}

/** Returns true if the given Lotus path is an overlevel weapon. */
function isOverLevelWeaponPath(path: string): boolean {
  return OVERLEVEL_WEAPON_PATHS.has(path);
}

function isIncarnonCatalogRecord(rec: any): boolean {
  const rawPath = resolveRecordPath(rec).toLowerCase();
  const displayName = String(rec?.displayName ?? rec?.name ?? "").trim().toLowerCase();
  const tagSets = [
    rec?.tags,
    rec?.raw?.tags,
    rec?.raw?.rawWfcd?.tags,
    rec?.raw?.rawLotus?.tags,
  ];

  const hasIncarnonTag = tagSets.some((tags) =>
    Array.isArray(tags) && tags.some((tag) => String(tag).trim().toLowerCase() === "incarnon"),
  );

  if (hasIncarnonTag) return true;
  if (rawPath.includes("/incarnonadapters/")) return true;
  if (displayName.includes("incarnon genesis")) return true;

  return false;
}

function getSiblingBlueprintCatalogId(catalogId: CatalogId): CatalogId | null {
  const candidate = `${String(catalogId)}Blueprint` as CatalogId;
  if (FULL_CATALOG.recordsById[candidate]) return candidate;

  const rec: any = FULL_CATALOG.recordsById[catalogId];
  const displayName = String(rec?.displayName ?? "").trim();
  if (!displayName) return null;

  const blueprintName = normalize(`${displayName} Blueprint`);
  const hits = (FULL_CATALOG.nameIndex?.[blueprintName] ?? []) as CatalogId[];
  const itemHit = hits.find((id) => String(id).startsWith("items:"));
  return itemHit ?? hits[0] ?? null;
}

type Row = {
  id: CatalogId;
  label: string;
  value: number;
  categories: string[];
  cls: Classification;
  path: string; // raw Lotus path — used for backward-compat mastery lookup
  isMasterable: boolean;
  isOverLevel: boolean; // true for Kuva/Tenet/Coda/Paracesis weapons
  itemType: string;
  releaseDate?: string;
  masteryReq: number;
  isPrime: boolean;
  isVaulted: boolean;
};

type SellSafetyInfo = {
  protectionKeys: SafeToSellProtectionKey[];
  weaponRecipeUses: WeaponIngredientUse[];
};

function isSafeToSellSlotBearingRow(row: Row): boolean {
  if (row.cls.groups.has("components")) return false;
  if (row.cls.groups.has("resources")) return false;
  if (row.cls.groups.has("railjack")) return false;

  return (
    row.cls.groups.has("warframesVehicles") ||
    row.cls.groups.has("weapons") ||
    row.cls.groups.has("companions")
  );
}

// Stable fallback references — avoids creating new objects on every render in ?? fallbacks
// which would cause useSyncExternalStore to detect a new snapshot reference and loop.
const EMPTY_BOOL_RECORD: Record<string, boolean> = {};
const EMPTY_NUM_RECORD: Record<string, number> = {};
const EMPTY_ARRAY: never[] = [];

// 5.2 Filter mode types
type OwnershipFilter = "all" | "owned" | "unowned" | "mastered";
type AccessFilter = "all" | "available" | "partial" | "blocked";
type MrColumnFilterMode = "all" | "exists" | "equals" | "lte" | "gte";
type MasteredColumnFilter = "all" | "mastered" | "unmastered" | "na";
type ReleaseColumnFilterMode = "all" | "exists" | "before" | "after";
type VariantFilter = "prime" | "vaulted";
type SafeToSellViewMode = "all" | "safe" | "protected";

const DEFAULT_SAFE_TO_SELL_PROTECTIONS: Record<SafeToSellProtectionKey, boolean> = {
  eventItems: true,
  invasionRewards: true,
  questRewards: true,
  incarnonItems: true,
  stalkerAssassinDrops: true,
  progenitorWeapons: true,
  factionPurchases: true,
  dojoResearch: true,
  nightwaveOfferings: true,
  weaponIngredients: true,
};

export default function Inventory() {
  const worldState = useWorldStateData();
  const counts = useTrackerStore(
    (s) => s.state.inventory.counts ?? EMPTY_NUM_RECORD,
  );
  const setCount = useTrackerStore((s) => s.setCount);
  const setMastered = useTrackerStore((s) => s.setMastered);
  const setOverLevelMastered = useTrackerStore((s) => s.setOverLevelMastered);
  const mastered = useTrackerStore(
    (s) => s.state.mastery?.mastered ?? EMPTY_BOOL_RECORD,
  );
  const overLevelMastered = useTrackerStore(
    (s) => s.state.mastery?.overLevelMastered ?? EMPTY_BOOL_RECORD,
  );
  const completedPrereqs = useTrackerStore(
    (s) => s.state.prereqs?.completed ?? EMPTY_BOOL_RECORD,
  );
  const syndicates = useTrackerStore((s) => s.state.syndicates ?? EMPTY_ARRAY);
  const masteryRank = useTrackerStore(
    (s) => s.state.player?.masteryRank ?? null,
  );
  const nodeCompletedMap = useTrackerStore(
    (s) => s.state.missions?.nodeCompleted ?? EMPTY_BOOL_RECORD,
  );
  const effectiveCompletedPrereqs = useMemo(
    () => deriveCompletedMap(completedPrereqs, syndicates, masteryRank, nodeCompletedMap),
    [completedPrereqs, masteryRank, nodeCompletedMap, syndicates],
  );

  const goals = useTrackerStore((s) => s.state.goals ?? EMPTY_ARRAY);
  const addGoalItem = useTrackerStore((s) => s.addGoalItem);
  const removeGoal = useTrackerStore((s) => s.removeGoal);
  const setGoalQty = useTrackerStore((s) => s.setGoalQty);

  const goalByCatalogId = useMemo(() => {
    const map = new Map<string, any>();
    for (const g of goals ?? []) {
      if (!g) continue;
      if (g.type !== "item") continue;
      if (g.isActive === false) continue;
      map.set(String(g.catalogId), g);
    }
    return map;
  }, [goals]);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("az");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // 5.2: Additional filter state
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");
  const [showAvailableNow, setShowAvailableNow] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [variantFilters, setVariantFilters] = useState<Partial<Record<VariantFilter, TagFilterState>>>({});
  const [tableTypeFilter, setTableTypeFilter] = useState("all");
  const [tableAccessFilter, setTableAccessFilter] = useState<AccessFilter>("all");
  const [tableMrFilterMode, setTableMrFilterMode] = useState<MrColumnFilterMode>("all");
  const [tableMrFilterValue, setTableMrFilterValue] = useState("");
  const [tableMasteredFilter, setTableMasteredFilter] = useState<MasteredColumnFilter>("all");
  const [tableReleaseFilterMode, setTableReleaseFilterMode] = useState<ReleaseColumnFilterMode>("all");
  const [tableReleaseFilterValue, setTableReleaseFilterValue] = useState("");

  // 5.3: Item detail panel
  const [selectedDetailId, setSelectedDetailId] = useState<CatalogId | null>(
    null,
  );
  const detailDialogRef = useRef<HTMLDivElement | null>(null);
  const [selectedComponentKey, setSelectedComponentKey] = useState<string | null>(null);

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("all");

  const [wfVehTab, setWfVehTab] = useState<WarframesVehiclesTab>("all");
  const [companionsTab, setCompanionsTab] = useState<CompanionsTab>("all");

  const [weaponClassTab, setWeaponClassTab] = useState<WeaponClassTab>("all");
  const [weaponTypeFilters, setWeaponTypeFilters] = useState<Partial<Record<string, TagFilterState>>>({});
  const [safeToSellProtections, setSafeToSellProtections] = useState<Record<SafeToSellProtectionKey, boolean>>(
    DEFAULT_SAFE_TO_SELL_PROTECTIONS,
  );
  const [safeToSellViewMode, setSafeToSellViewMode] = useState<SafeToSellViewMode>("all");
  const [safeToSellOwnedOnly, setSafeToSellOwnedOnly] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<InventoryColumnKey[]>(() =>
    loadVisibleInventoryColumns(),
  );
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      INVENTORY_COLUMN_STORAGE_KEY,
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns]);

  useEffect(() => {
    setSelectedComponentKey(null);
  }, [selectedDetailId]);

  useEffect(() => {
    if (!selectedDetailId) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    detailDialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      const dialog = detailDialogRef.current;
      if (!dialog) return;

      const activeModal = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
      if (activeModal !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedDetailId(null);
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [selectedDetailId]);

  function selectPrimaryTab(next: PrimaryTab) {
    setPrimaryTab(next);

    setWfVehTab("all");
    setCompanionsTab("all");

    setWeaponTypeFilters({});
  }

  function selectWeaponClass(next: WeaponClassTab) {
    setWeaponClassTab(next);
    setWeaponTypeFilters({});
  }

  const columnMeta: Record<InventoryColumnKey, { label: string; width: string }> = {
    item: { label: "Item", width: "minmax(320px,1.8fr)" },
    type: { label: "Type", width: "210px" },
    release: { label: "Release", width: "170px" },
    mr: { label: "MR", width: "140px" },
    available: { label: "Access", width: "140px" },
    count: { label: "Count", width: "160px" },
    mastered: { label: "Mastered", width: "140px" },
    goal: { label: "Goal Target", width: "170px" },
  };

  function toggleColumn(column: InventoryColumnKey) {
    if (column === "item") return;
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        return current.filter((value) => value !== column);
      }
      const next = [...current, column];
      return DEFAULT_INVENTORY_COLUMNS.filter((value) => next.includes(value));
    });
  }

  function cycleSort(nextKey: SortKey, alternateKey?: SortKey) {
    setSortKey((current) => {
      if (current === nextKey && alternateKey) return alternateKey;
      return nextKey;
    });
  }

  const inventoryCatalogIds = useMemo(() => {
    const seen = new Set<string>(FULL_CATALOG.displayableInventoryItemIds as CatalogId[]);
    const supplemental: CatalogId[] = [];

    for (const id of FULL_CATALOG.displayableItemIds as CatalogId[]) {
      if (seen.has(id)) continue;
      const rec: any = FULL_CATALOG.recordsById[id];
      if (!rec?.displayName) continue;

      const cls = classifyFromRecord(String(id), rec);
      const collectionRelevant =
        cls.groups.has("warframesVehicles") ||
        cls.groups.has("companions") ||
        cls.groups.has("weapons") ||
        cls.groups.has("resources") ||
        cls.groups.has("components");

      if (!collectionRelevant) continue;

      const acq = getAcquisitionByCatalogId(id);
      const sources = Array.isArray(acq?.sources) ? acq.sources : [];
      if (!sources.some(isStarChartCollectionSource)) continue;

      seen.add(id);
      supplemental.push(id);
    }

    for (const id of getAllWikiBlueprintReferencedCatalogIds()) {
      if (seen.has(id)) continue;
      const rec: any = FULL_CATALOG.recordsById[id];
      if (!rec?.displayName) continue;

      seen.add(id);
      supplemental.push(id);
    }

    return [
      ...(FULL_CATALOG.displayableInventoryItemIds as CatalogId[]),
      ...supplemental,
    ];
  }, []);

  const rows = useMemo<Row[]>(() => {
    const q = normalize(query);

    const base: Row[] = inventoryCatalogIds
      .map((id) => {
        const rec: any = FULL_CATALOG.recordsById[id];
        if (!rec?.displayName) return null;
        const rawPath = resolveRecordPath(rec);
        const allEntry = getAllEntry(rawPath, rec.displayName);
        const isPrime =
          allEntry?.isPrime === true ||
          /\bprime\b/i.test(rec.displayName ?? "") ||
          /\bprime\b/i.test(rawPath);
        const primeAvailability = getPrimeAvailabilityStatus(String(id), worldState);
        const isVaulted = primeAvailability === "vaulted";

        const categories = rec.categories ?? [];
        const cls = classifyFromRecord(String(id), rec);

        if (EXCLUDED_INVENTORY_PATHS.has(rawPath)) {
          return null;
        }

        // Hide base/template companion records like "VULPAPHYLA" / "PREDASITE" (Base*PowerSuit).
        // Keep real companions and non-companion items that mention these words (tags, floofs, lures, glyphs).
        if (
          cls.groups.has("companions") &&
          isBaseTemplateCompanion(String(id), rec)
        ) {
          return null;
        }

        // Hide base/template relic records like "Neo Relic", "Axi Relic", etc.
        // Keep actual projection relic items like "Axi A1 Intact", etc.
        if (isBaseTemplateRelic(String(id), rec)) {
          return null;
        }

        return {
          id,
          label: rec.displayName,
          value: safeInt(counts[String(id)] ?? 0, 0),
          categories,
          cls,
          path: rawPath,
          isMasterable: isMasterableItem(cls, rawPath),
          isOverLevel: isOverLevelWeaponPath(rawPath),
          itemType: getInventoryItemTypeLabel({
            rawType:
              allEntry?.type ??
              rec.type ??
              rec?.raw?.type ??
              rec?.raw?.rawWfcd?.type ??
              rec?.raw?.rawLotus?.type ??
              "",
            cls,
            label: rec.displayName,
            path: rawPath,
          }),
          releaseDate: allEntry?.releaseDate,
          masteryReq:
            allEntry?.masteryReq ??
            rec?.masteryReq ??
            rec?.raw?.masteryReq ??
            rec?.raw?.rawWfcd?.masteryReq ??
            rec?.raw?.rawLotus?.masteryReq ??
            0,
          isPrime,
          isVaulted,
        } as Row;
      })
      .filter((r): r is Row => !!r)
      .filter((r) => {
        if (!q) return true;

        const label = normalize(r.label);
        const id = normalize(String(r.id));
        const aliases = inventorySearchAliases(r).map(normalize).join(" | ");

        // Base searchable fields
        if (label.includes(q) || id.includes(q)) return true;
        if (aliases.includes(q)) return true;

        // Also search categories (helps a lot for non-obvious items)
        const cats = Array.isArray(r.categories)
          ? r.categories.map(normalize).join(" | ")
          : "";
        if (cats.includes(q)) return true;

        // Relic keyword augmentation:
        // If it’s a relic projection, allow "relic" to match even if displayName doesn’t include it.
        const rec: any = FULL_CATALOG.recordsById[r.id];
        if (isRelicProjectionItem(r.id, rec)) {
          if ("relic".includes(q) || q.includes("relic")) return true;

          // Optional: let "axi/neo/meso/lith" match via derived tier token (even if name format changes)
          const tier = relicTierFromName(r.label);
          if (tier && tier.includes(q)) return true;
        }

        return false;
      });

    // Add Plexus as a synthetic row — it's not in the catalog but counts toward mastery
    const PLEXUS_PATH = "/Lotus/Types/Game/CrewShip/RailJack/DefaultHarness";
    const PLEXUS_ID = `items:${PLEXUS_PATH}` as CatalogId;
    const plexusReleaseDate = getManualReleaseDateFallback({
      uniqueName: PLEXUS_PATH,
      category: "Warframes",
    });
    const plexusCls: Classification = {
      groups: new Set(["warframesVehicles", "railjack"]),
      warframesVehiclesSub: new Set(["warframes"]),
      weaponClasses: new Set(),
      weaponTypesByClass: {},
      companionsSub: new Set(),
      isResource: false,
      isComponent: false,
    };
    const plexusQ = normalize(query);
    if (
      !plexusQ ||
      "plexus".includes(plexusQ) ||
      "railjack".includes(plexusQ)
    ) {
      base.push({
        id: PLEXUS_ID,
        label: "Plexus",
        value: 0,
        categories: ["warframes"],
        cls: plexusCls,
        path: PLEXUS_PATH,
        isMasterable: true,
        isOverLevel: false,
        itemType: "Plexus",
        releaseDate: plexusReleaseDate,
        masteryReq: 0,
        isPrime: false,
        isVaulted: false,
      });
    }

    base.sort((a, b) => {
      const aCount = safeInt(counts[String(a.id)] ?? 0, 0);
      const bCount = safeInt(counts[String(b.id)] ?? 0, 0);
      const aMastered = checkMastered(
        mastered,
        overLevelMastered,
        String(a.id),
        a.path,
      );
      const bMastered = checkMastered(
        mastered,
        overLevelMastered,
        String(b.id),
        b.path,
      );

      switch (sortKey) {
        case "za":
          return b.label.localeCompare(a.label);
        case "type-asc":
          if (a.itemType !== b.itemType) return a.itemType.localeCompare(b.itemType);
          break;
        case "type-desc":
          if (a.itemType !== b.itemType) return b.itemType.localeCompare(a.itemType);
          break;
        case "count-desc":
          if (aCount !== bCount) return bCount - aCount;
          break;
        case "count-asc":
          if (aCount !== bCount) return aCount - bCount;
          break;
        case "owned-first": {
          const ao = aCount > 0 ? 0 : 1,
            bo = bCount > 0 ? 0 : 1;
          if (ao !== bo) return ao - bo;
          break;
        }
        case "unowned-first": {
          const ao = aCount === 0 ? 0 : 1,
            bo = bCount === 0 ? 0 : 1;
          if (ao !== bo) return ao - bo;
          break;
        }
        case "mastered-last": {
          const am = aMastered ? 1 : 0,
            bm = bMastered ? 1 : 0;
          if (am !== bm) return am - bm;
          break;
        }
        case "release-newest": {
          const ad = getSortableReleaseDate(a.releaseDate, "newest");
          const bd = getSortableReleaseDate(b.releaseDate, "newest");
          if (ad !== bd) return bd > ad ? 1 : -1;
          break;
        }
        case "release-oldest": {
          const ad = getSortableReleaseDate(a.releaseDate, "oldest");
          const bd = getSortableReleaseDate(b.releaseDate, "oldest");
          if (ad !== bd) return ad > bd ? 1 : -1;
          break;
        }
        case "mr-asc": {
          const am = ALL_BY_UNIQUE[a.path]?.masteryReq ?? 0;
          const bm = ALL_BY_UNIQUE[b.path]?.masteryReq ?? 0;
          if (am !== bm) return am - bm;
          break;
        }
        case "mr-desc": {
          const am = ALL_BY_UNIQUE[a.path]?.masteryReq ?? 0;
          const bm = ALL_BY_UNIQUE[b.path]?.masteryReq ?? 0;
          if (am !== bm) return bm - am;
          break;
        }
        default:
          break;
      }
      return a.label.localeCompare(b.label);
    });

    const dedupedByLabel = new Map<string, Row>();
    for (const row of base) {
      const key = normalize(row.label);
      const existing = dedupedByLabel.get(key);
      if (!existing) {
        dedupedByLabel.set(key, row);
        continue;
      }
      dedupedByLabel.set(key, preferInventoryRow(existing, row));
    }

    return Array.from(dedupedByLabel.values());
  }, [counts, inventoryCatalogIds, mastered, overLevelMastered, query, sortKey, worldState]);

  const weaponIngredientIndex = useMemo(() => {
    return buildWeaponIngredientIndex({
      outputCatalogIds: inventoryCatalogIds.map((id) => String(id)),
      getRequirements: (outputCatalogId) => {
        const outputId = outputCatalogId as CatalogId;
        const requirementCatalogId = getSiblingBlueprintCatalogId(outputId) ?? outputId;
        return getWikiBlueprintRequirements(requirementCatalogId).map((requirement) => ({
          catalogId: String(requirement.catalogId),
          count: requirement.count,
        }));
      },
      isWeaponCatalogId: (catalogId) => {
        const rec: any = FULL_CATALOG.recordsById[catalogId as CatalogId];
        if (!rec) return false;
        const cls = classifyFromRecord(catalogId, rec);
        return cls.groups.has("weapons") && !cls.groups.has("components");
      },
      getDisplayName: (catalogId) => FULL_CATALOG.recordsById[catalogId as CatalogId]?.displayName ?? null,
    });
  }, [inventoryCatalogIds]);

  const sellSafetyById = useMemo(() => {
    const map = new Map<string, SellSafetyInfo>();
    const protectionMemo = new Map<string, SafeToSellProtectionKey[]>();
    const NON_INHERITABLE_SAFE_TO_SELL_KEYS = new Set<SafeToSellProtectionKey>(["weaponIngredients"]);

    const collectProtectionKeys = (catalogId: CatalogId, seen = new Set<string>()): SafeToSellProtectionKey[] => {
      const key = String(catalogId);
      if (protectionMemo.has(key)) return protectionMemo.get(key)!;
      if (seen.has(key)) return [];

      const rec: any = FULL_CATALOG.recordsById[catalogId];
      if (!rec) return [];

      const nextSeen = new Set(seen);
      nextSeen.add(key);

      const cls = classifyFromRecord(key, rec);
      const siblingBlueprintCatalogId = getSiblingBlueprintCatalogId(catalogId);
      const ownProtections = getSafeToSellProtectionKeys({
        acquisitionSources: getAcquisitionByCatalogId(catalogId)?.sources ?? [],
        isIncarnonItem: isIncarnonCatalogRecord(rec),
        isProgenitorWeapon: isOverLevelWeaponPath(resolveRecordPath(rec)),
        hasWeaponRecipeConsumers: (weaponIngredientIndex.get(key)?.length ?? 0) > 0,
        rawPath: resolveRecordPath(rec),
        displayName: String(rec?.displayName ?? ""),
      });
      const blueprintProtections =
        siblingBlueprintCatalogId && String(siblingBlueprintCatalogId) !== key
          ? collectProtectionKeys(siblingBlueprintCatalogId, nextSeen).filter((protectionKey) => !NON_INHERITABLE_SAFE_TO_SELL_KEYS.has(protectionKey))
          : [];

      const requirementCatalogId = siblingBlueprintCatalogId ?? catalogId;
      const inheritedProtections = getWikiBlueprintRequirements(requirementCatalogId).flatMap((requirement) => {
        const requirementRec: any = FULL_CATALOG.recordsById[requirement.catalogId];
        if (!requirementRec) return [];

        const requirementCls = classifyFromRecord(String(requirement.catalogId), requirementRec);
        if (requirementCls.groups.has("resources")) return [];

        return collectProtectionKeys(requirement.catalogId, nextSeen).filter((protectionKey) => !NON_INHERITABLE_SAFE_TO_SELL_KEYS.has(protectionKey));
      });

      const combined = Array.from(new Set([...ownProtections, ...blueprintProtections, ...inheritedProtections])).sort((a, b) =>
        a.localeCompare(b),
      );

      // Components should keep their own result, but fully craftable outputs should inherit
      // any sell-safety concerns from the blueprint and recipe tree.
      if (!cls.groups.has("resources")) {
        protectionMemo.set(key, combined);
      }

      return combined;
    };

    for (const row of rows) {
      const weaponRecipeUses = weaponIngredientIndex.get(String(row.id)) ?? [];
      const protectionKeys = collectProtectionKeys(row.id);

      map.set(String(row.id), {
        protectionKeys,
        weaponRecipeUses,
      });
    }

    return map;
  }, [rows, weaponIngredientIndex]);

  const safeToSellCandidateRows = useMemo(() => {
    return rows.filter(isSafeToSellSlotBearingRow);
  }, [rows]);

  const safeToSellRows = useMemo(() => {
    return safeToSellCandidateRows.filter((row) => {
      const info = sellSafetyById.get(String(row.id));
      const matchedProtections = info?.protectionKeys ?? [];
      return !matchedProtections.some((key) => safeToSellProtections[key]);
    });
  }, [safeToSellCandidateRows, safeToSellProtections, sellSafetyById]);

  const protectedFromSellRows = useMemo(() => {
    return safeToSellCandidateRows.filter((row) => {
      const info = sellSafetyById.get(String(row.id));
      const matchedProtections = info?.protectionKeys ?? [];
      return matchedProtections.some((key) => safeToSellProtections[key]);
    });
  }, [safeToSellCandidateRows, safeToSellProtections, sellSafetyById]);

  const safeToSellDisplayRows = useMemo(() => {
    let rowsForDisplay = safeToSellCandidateRows;

    if (safeToSellOwnedOnly) {
      rowsForDisplay = rowsForDisplay.filter((row) => safeInt(counts[String(row.id)] ?? 0, 0) > 0);
    }

    const allowedIds = new Set(rowsForDisplay.map((row) => String(row.id)));

    if (safeToSellViewMode === "safe") {
      return safeToSellRows.filter((row) => allowedIds.has(String(row.id)));
    }
    if (safeToSellViewMode === "protected") {
      return protectedFromSellRows.filter((row) => allowedIds.has(String(row.id)));
    }
    return rowsForDisplay;
  }, [
    counts,
    protectedFromSellRows,
    safeToSellCandidateRows,
    safeToSellOwnedOnly,
    safeToSellRows,
    safeToSellViewMode,
  ]);

  const safeToSellSafeCount = useMemo(() => {
    if (!safeToSellOwnedOnly) return safeToSellRows.length;
    return safeToSellRows.filter((row) => safeInt(counts[String(row.id)] ?? 0, 0) > 0).length;
  }, [counts, safeToSellOwnedOnly, safeToSellRows]);

  const safeToSellProtectedCount = useMemo(() => {
    if (!safeToSellOwnedOnly) return protectedFromSellRows.length;
    return protectedFromSellRows.filter((row) => safeInt(counts[String(row.id)] ?? 0, 0) > 0).length;
  }, [counts, protectedFromSellRows, safeToSellOwnedOnly]);

  const activeSafeToSellProtectionCount = useMemo(
    () =>
      (Object.keys(safeToSellProtections) as SafeToSellProtectionKey[]).filter((key) => safeToSellProtections[key]).length,
    [safeToSellProtections],
  );

  const availableCompanionTabs = useMemo(() => {
    const available = new Set<CompanionsTab>(["all"]);
    for (const row of rows) {
      if (!row.cls.groups.has("companions")) continue;
      if (row.cls.groups.has("components")) continue;
      for (const sub of row.cls.companionsSub) {
        available.add(sub);
      }
    }
    return available;
  }, [rows]);

  useEffect(() => {
    if (companionsTab !== "all" && !availableCompanionTabs.has(companionsTab)) {
      setCompanionsTab("all");
    }
  }, [companionsTab, availableCompanionTabs]);

  // 5.2: Ownership + availability filter applied after category filtering
  // (computationally expensive filters run only on already-filtered set)

  const weaponTypeOptions = useMemo(() => {
    const set = new Set<string>();
    const tabsToCheck: WeaponClassTab[] =
      weaponClassTab === "all"
        ? ["primary", "secondary", "melee"]
        : [weaponClassTab];
    for (const r of rows) {
      for (const wc of tabsToCheck) {
        if (!r.cls.weaponClasses.has(wc)) continue;
        for (const t of r.cls.weaponTypesByClass[wc] ?? []) {
          if (t && t.trim()) set.add(normalize(t));
        }
      }
    }
    const out = Array.from(set);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [rows, weaponClassTab]);

  const filtered = useMemo(() => {
    // Railjack tab — Plexus plus Railjack resources/items.
    if (primaryTab === "railjack") {
      return rows.filter((r) => r.cls.groups.has("railjack"));
    }

    if (primaryTab === "safeToSell") {
      return safeToSellDisplayRows;
    }

    // "All" tab — show warframes, weapons, companions including Plexus synthetic row
    if (primaryTab === "all") {
      return rows.filter((r) => {
        if (r.cls.groups.has("components")) return false;
        if (r.cls.groups.has("resources")) return false;
        return (
          r.cls.groups.has("warframesVehicles") ||
          r.cls.groups.has("weapons") ||
          r.cls.groups.has("companions")
        );
      });
    }

    if (primaryTab === "warframesVehicles") {
      return rows.filter((r) => {
        if (!r.cls.groups.has("warframesVehicles")) return false;
        if (r.cls.groups.has("components")) return false; // blueprints/parts go to their own tab
        if (wfVehTab === "all") return true;
        return r.cls.warframesVehiclesSub.has(wfVehTab);
      });
    }

    if (primaryTab === "companions") {
      return rows.filter((r) => {
        if (!r.cls.groups.has("companions")) return false;
        if (r.cls.groups.has("components")) return false;
        if (companionsTab === "all") return true;
        return r.cls.companionsSub.has(companionsTab);
      });
    }

    if (primaryTab === "resources") {
      // Resources: raw farming materials (Circuits, Plastids, Ferrite, etc.)
      // Some resources also carry the "components" classification in WFCD data;
      // show them here anyway — the Resources tab is their primary home.
      return rows.filter((r) => r.cls.groups.has("resources") && !r.cls.groups.has("railjack"));
    }

    if (primaryTab === "components") {
      // "Blueprints & Parts" — actual crafting recipes, parts and components
      // (Ash Neuroptics, Braton Blueprint, etc.), but NOT raw farming resources
      // which happen to have the "components" classification in WFCD.
      return rows.filter(
        (r) =>
          r.cls.groups.has("components") &&
          !r.cls.isResource &&
          !r.cls.groups.has("resources"),
      );
    }

    // Weapons — exclude blueprints/parts
    return rows.filter((r) => {
      if (!r.cls.groups.has("weapons")) return false;
      if (r.cls.groups.has("components")) return false;

      // For "all" tab, show every weapon class
      if (weaponClassTab !== "all" && !r.cls.weaponClasses.has(weaponClassTab))
        return false;

      // Type sub-filter (not applicable to companion tab or all tab)
      if (
        Object.keys(weaponTypeFilters).length > 0 &&
        weaponClassTab !== "companion" &&
        weaponClassTab !== "all"
      ) {
        const { included, excluded } = splitTagFilterState(weaponTypeFilters);
        const types = r.cls.weaponTypesByClass[weaponClassTab];
        if (!types || types.size === 0) return false;
        const normalizedTypes = Array.from(types).map((t) => normalize(t));
        if (included.length > 0 && !normalizedTypes.some((t) => included.includes(t))) return false;
        if (excluded.length > 0 && normalizedTypes.some((t) => excluded.includes(t))) return false;
      }

      return true;
    });
  }, [
    rows,
    safeToSellDisplayRows,
    primaryTab,
    wfVehTab,
    companionsTab,
    weaponClassTab,
    weaponTypeFilters,
  ]);

  // 5.2: Apply additional filters after category tab filtering
  const finalFiltered = useMemo(() => {
    let result = filtered;

    if (primaryTab !== "safeToSell") {
      // Ownership / mastery filter
      if (ownershipFilter === "owned") {
        result = result.filter((r) => safeInt(counts[String(r.id)] ?? 0, 0) > 0);
      } else if (ownershipFilter === "unowned") {
        result = result.filter(
          (r) => safeInt(counts[String(r.id)] ?? 0, 0) === 0,
        );
      } else if (ownershipFilter === "mastered") {
        result = result.filter((r) =>
          checkMastered(mastered, overLevelMastered, String(r.id), r.path),
        );
      }

      if (showAvailableNow) {
        result = result.filter((r) => {
          const requirement = r.masteryReq ?? 0;
          return requirement <= (masteryRank ?? 0);
        });
      }

      // Available only: at least one acquisition source is accessible
      if (showAvailableOnly) {
        result = result.filter((r) => {
          const avail = determineItemAvailability(
            r.id,
            effectiveCompletedPrereqs,
            masteryRank,
          );
          return avail === "available" || avail === "partial";
        });
      }
    }

    if (Object.keys(variantFilters).length > 0) {
      const { included, excluded } = splitTagFilterState(variantFilters);
      result = result.filter((r) => {
        if (included.includes("prime") && !r.isPrime) return false;
        if (included.includes("vaulted") && !r.isVaulted) return false;
        if (excluded.includes("prime") && r.isPrime) return false;
        if (excluded.includes("vaulted") && r.isVaulted) return false;
        return true;
      });
    }

    if (tableTypeFilter !== "all") {
      result = result.filter((r) => r.itemType === tableTypeFilter);
    }

    if (tableAccessFilter !== "all") {
      result = result.filter(
        (r) =>
          determineItemAvailability(r.id, effectiveCompletedPrereqs, masteryRank) ===
          tableAccessFilter,
      );
    }

    if (tableMrFilterMode !== "all") {
      const targetMr = Number(tableMrFilterValue);
      result = result.filter((r) => {
        if (tableMrFilterMode === "exists") return r.masteryReq > 0;
        if (!Number.isFinite(targetMr)) return true;
        if (tableMrFilterMode === "equals") return r.masteryReq === targetMr;
        if (tableMrFilterMode === "lte") return r.masteryReq > 0 && r.masteryReq <= targetMr;
        if (tableMrFilterMode === "gte") return r.masteryReq >= targetMr;
        return true;
      });
    }

    if (tableMasteredFilter !== "all") {
      result = result.filter((r) => {
        const masteredState = checkMastered(
          mastered,
          overLevelMastered,
          String(r.id),
          r.path,
        );
        if (tableMasteredFilter === "mastered") return r.isMasterable && masteredState;
        if (tableMasteredFilter === "unmastered") return r.isMasterable && !masteredState;
        return !r.isMasterable;
      });
    }

    if (tableReleaseFilterMode !== "all") {
      result = result.filter((r) => {
        if (tableReleaseFilterMode === "exists") return Boolean(r.releaseDate);
        if (!r.releaseDate || !tableReleaseFilterValue) return true;
        if (tableReleaseFilterMode === "before") return r.releaseDate < tableReleaseFilterValue;
        if (tableReleaseFilterMode === "after") return r.releaseDate > tableReleaseFilterValue;
        return true;
      });
    }

    return result;
  }, [
    filtered,
    primaryTab,
    ownershipFilter,
    showAvailableNow,
    showAvailableOnly,
    variantFilters,
    counts,
    mastered,
    overLevelMastered,
    effectiveCompletedPrereqs,
    masteryRank,
    tableTypeFilter,
    tableAccessFilter,
    tableMrFilterMode,
    tableMrFilterValue,
    tableMasteredFilter,
    tableReleaseFilterMode,
    tableReleaseFilterValue,
  ]);

  const visibleTableColumns = useMemo(() => {
    const ensured = visibleColumns.includes("item")
      ? visibleColumns
      : (["item", ...visibleColumns] as InventoryColumnKey[]);
    return DEFAULT_INVENTORY_COLUMNS.filter((column) => ensured.includes(column));
  }, [visibleColumns]);

  const inventoryGridTemplate = useMemo(
    () => ["48px", ...visibleTableColumns.map((column) => columnMeta[column].width)].join(" "),
    [visibleTableColumns],
  );

  const tableTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of filtered) {
      if (row.itemType) set.add(row.itemType);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [filtered]);

  const tableMrOptions = useMemo(() => {
    const set = new Set<number>();
    for (const row of filtered) {
      if (row.masteryReq > 0) set.add(row.masteryReq);
    }
    return [...set].sort((a, b) => a - b);
  }, [filtered]);

  function resetColumnFilters() {
    setTableTypeFilter("all");
    setTableAccessFilter("all");
    setTableMrFilterMode("all");
    setTableMrFilterValue("");
    setTableMasteredFilter("all");
    setTableReleaseFilterMode("all");
    setTableReleaseFilterValue("");
  }

  function toggleVariantFilter(filter: VariantFilter) {
    setVariantFilters((current) => {
      const next = { ...current };
      const nextState = cycleTagFilterState(current[filter]);
      if (!nextState) delete next[filter];
      else next[filter] = nextState;
      return next;
    });
  }

  function toggleSafeToSellProtection(filter: SafeToSellProtectionKey) {
    setSafeToSellProtections((current) => ({
      ...current,
      [filter]: !current[filter],
    }));
  }

  function clearAllFilters() {
    selectPrimaryTab("all");
    setWeaponClassTab("all");
    setOwnershipFilter("all");
    setShowAvailableNow(false);
    setShowAvailableOnly(false);
    setVariantFilters({});
    setWeaponTypeFilters({});
    setSafeToSellProtections(DEFAULT_SAFE_TO_SELL_PROTECTIONS);
    setSafeToSellViewMode("all");
    setSafeToSellOwnedOnly(false);
    resetColumnFilters();
  }

  const displayedRowIdSet = useMemo(
    () => new Set(finalFiltered.map((row) => String(row.id))),
    [finalFiltered],
  );

  const selectedDisplayedCount = useMemo(() => {
    let total = 0;
    for (const id of selectedRowIds) {
      if (displayedRowIdSet.has(id)) total += 1;
    }
    return total;
  }, [selectedRowIds, displayedRowIdSet]);

  const allDisplayedChecked =
    finalFiltered.length > 0 && finalFiltered.every((row) => selectedRowIds.has(String(row.id)));

  useEffect(() => {
    setSelectedRowIds((current) => {
      const next = new Set<string>();
      for (const id of current) {
        if (displayedRowIdSet.has(id)) next.add(id);
      }
      return next.size === current.size ? current : next;
    });
  }, [displayedRowIdSet]);

  function toggleDisplayedSelection(checked: boolean) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      for (const row of finalFiltered) {
        const id = String(row.id);
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelectedRows() {
    setSelectedRowIds(new Set());
    setActionsMenuOpen(false);
  }

  function applyToSelectedRows(run: (row: Row) => void) {
    for (const row of finalFiltered) {
      if (selectedRowIds.has(String(row.id))) run(row);
    }
    clearSelectedRows();
  }

  function applySelectedCountUpdate() {
    const input = window.prompt("Set count for selected items:", "1");
    if (input === null) return;
    const nextCount = Math.max(0, safeInt(input, 0));
    applyToSelectedRows((row) => setCount(String(row.id), nextCount));
  }

  function applySelectedGoalAdd() {
    applyToSelectedRows((row) => {
      if (!goalByCatalogId.has(String(row.id))) addGoalItem(String(row.id), 1);
    });
  }

  function applySelectedGoalRemove() {
    applyToSelectedRows((row) => {
      const goal = goalByCatalogId.get(String(row.id));
      if (goal) removeGoal(goal.id);
    });
  }

  function applySelectedMastery(marked: boolean) {
    applyToSelectedRows((row) => {
      if (!row.isMasterable) return;
      if (row.isOverLevel) {
        setOverLevelMastered(String(row.id), marked);
      } else {
        setMastered(String(row.id), marked);
      }
    });
  }

  // -------- Virtualization (manual, no deps) --------
  // Fixed row height; keep consistent with the row layout below.
  const ROW_H = 56;
  const OVERSCAN = 10;
  const {
    scrollportRef,
    contentRef,
    rowsAnchorRef,
    windowState: vw,
    recompute: recomputeWindow,
    resetScroll: resetCollectionScroll,
  } = useCollectionVirtualWindow(finalFiltered.length, ROW_H, OVERSCAN);

  useEffect(() => {
    // After filters change, reset scroll and recompute.
    resetCollectionScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    primaryTab,
    wfVehTab,
    companionsTab,
    weaponClassTab,
    weaponTypeFilters,
    safeToSellProtections,
    safeToSellViewMode,
    safeToSellOwnedOnly,
    query,
    ownershipFilter,
    showAvailableNow,
    showAvailableOnly,
    variantFilters,
    tableTypeFilter,
    tableAccessFilter,
    tableMrFilterMode,
    tableMrFilterValue,
    tableMasteredFilter,
    tableReleaseFilterMode,
    tableReleaseFilterValue,
    sortKey,
    resetCollectionScroll,
  ]);

  useEffect(() => {
    // Recompute on data length changes.
    requestAnimationFrame(() => recomputeWindow());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalFiltered.length]);

  // -----------------------------------------------

  const totalHeight = finalFiltered.length * ROW_H;
  const slice = finalFiltered.slice(vw.start, vw.end);
  const translateY = vw.start * ROW_H;

  const activeFilters: CollectionActiveFilter[] = [];
  const addTagFilter = (id: string, label: string, state: TagFilterState | undefined, onRemove: () => void) => {
    if (state) activeFilters.push({ id, label: `${label} ${state === "include" ? "included" : "excluded"}`, onRemove });
  };
  if (primaryTab !== "all") {
    const label = primaryTab === "safeToSell"
      ? "Safe to Sell"
      : primaryTab === "warframesVehicles"
        ? "Warframes & Vehicles"
        : primaryTab === "weapons"
          ? "Weapons"
          : primaryTab === "companions"
            ? "Companions"
            : primaryTab === "components"
              ? "Blueprints & Parts"
              : primaryTab === "resources"
                ? "Resources"
                : "Railjack";
    activeFilters.push({ id: "primary-category", label: `Category: ${label}`, onRemove: () => selectPrimaryTab("all") });
  }
  if (ownershipFilter !== "all") {
    const label = ownershipFilter === "mastered" ? "Mastered" : ownershipFilter === "owned" ? "Owned" : "Unowned";
    activeFilters.push({ id: "ownership", label, onRemove: () => setOwnershipFilter("all") });
  }
  if (showAvailableNow) activeFilters.push({ id: "available-now", label: `Within current MR${masteryRank === null ? "" : ` (${masteryRank})`}`, onRemove: () => setShowAvailableNow(false) });
  if (showAvailableOnly) activeFilters.push({ id: "accessible-sources", label: "Accessible sources", onRemove: () => setShowAvailableOnly(false) });
  addTagFilter("variant-prime", "Prime", variantFilters.prime, () => setVariantFilters((current) => { const next = { ...current }; delete next.prime; return next; }));
  addTagFilter("variant-vaulted", "Vaulted", variantFilters.vaulted, () => setVariantFilters((current) => { const next = { ...current }; delete next.vaulted; return next; }));
  if (primaryTab === "weapons" && weaponClassTab !== "all") {
    activeFilters.push({ id: "weapon-class", label: `Weapon class: ${titleCase(weaponClassTab)}`, onRemove: () => selectWeaponClass("all") });
  }
  if (primaryTab === "warframesVehicles" && wfVehTab !== "all") {
    const label = wfVehTab === "warframes" ? "Warframes" : wfVehTab === "archwings" ? "Archwings" : "Necramechs";
    activeFilters.push({ id: "warframe-vehicle-subcategory", label: `Type: ${label}`, onRemove: () => setWfVehTab("all") });
  }
  if (primaryTab === "companions" && companionsTab !== "all") {
    activeFilters.push({ id: "companion-subcategory", label: `Companion: ${titleCase(companionsTab)}`, onRemove: () => setCompanionsTab("all") });
  }
  if (primaryTab === "weapons") {
    for (const [type, state] of Object.entries(weaponTypeFilters) as Array<[string, TagFilterState]>) {
      addTagFilter(`weapon-type-${type}`, `Weapon type: ${titleCase(type)}`, state, () => setWeaponTypeFilters((current) => { const next = { ...current }; delete next[type]; return next; }));
    }
  }
  if (tableTypeFilter !== "all") activeFilters.push({ id: "table-type", label: `Type: ${tableTypeFilter}`, onRemove: () => setTableTypeFilter("all") });
  if (tableAccessFilter !== "all") activeFilters.push({ id: "table-access", label: `Access: ${tableAccessFilter === "available" ? "Now" : titleCase(tableAccessFilter)}`, onRemove: () => setTableAccessFilter("all") });
  if (tableMrFilterMode !== "all") {
    const mrLabel = tableMrFilterMode === "exists" ? "Has MR" : tableMrFilterMode === "equals" ? `MR = ${tableMrFilterValue || "any"}` : tableMrFilterMode === "lte" ? `MR ≤ ${tableMrFilterValue || "any"}` : `MR ≥ ${tableMrFilterValue || "any"}`;
    activeFilters.push({ id: "table-mr", label: mrLabel, onRemove: () => { setTableMrFilterMode("all"); setTableMrFilterValue(""); } });
  }
  if (tableMasteredFilter !== "all") {
    const masteredLabel = tableMasteredFilter === "mastered" ? "Mastered" : tableMasteredFilter === "unmastered" ? "Not mastered" : "Mastery N/A";
    activeFilters.push({ id: "table-mastered", label: masteredLabel, onRemove: () => setTableMasteredFilter("all") });
  }
  if (tableReleaseFilterMode !== "all") {
    const releaseLabel = tableReleaseFilterMode === "exists" ? "Release date exists" : `${tableReleaseFilterMode === "before" ? "Release before" : "Release after"} ${tableReleaseFilterValue || "any date"}`;
    activeFilters.push({ id: "table-release", label: releaseLabel, onRemove: () => { setTableReleaseFilterMode("all"); setTableReleaseFilterValue(""); } });
  }
  if (primaryTab === "safeToSell") {
    if (safeToSellViewMode !== "all") activeFilters.push({ id: "safe-view", label: safeToSellViewMode === "safe" ? "Safe only" : "Protected only", onRemove: () => setSafeToSellViewMode("all") });
    if (safeToSellOwnedOnly) activeFilters.push({ id: "safe-owned", label: "Owned inventory only", onRemove: () => setSafeToSellOwnedOnly(false) });
    for (const key of Object.keys(SAFE_TO_SELL_PROTECTION_META) as SafeToSellProtectionKey[]) {
      if (safeToSellProtections[key] !== DEFAULT_SAFE_TO_SELL_PROTECTIONS[key]) {
        activeFilters.push({
          id: `safe-rule-${key}`,
          label: `${safeToSellProtections[key] ? "Protect" : "Ignore"}: ${SAFE_TO_SELL_PROTECTION_META[key].label}`,
          onRemove: () => setSafeToSellProtections((current) => ({ ...current, [key]: DEFAULT_SAFE_TO_SELL_PROTECTIONS[key] })),
        });
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CollectionScrollSurface
        scrollportRef={scrollportRef}
        contentRef={contentRef}
        onScroll={recomputeWindow}
        ariaLabel="Inventory catalog and results"
        className="bg-[color:var(--wf-bg-canvas)]"
      >
      <section aria-labelledby="inventory-page-title">
        <h1 id="inventory-page-title" className="px-3 py-1 text-lg font-semibold text-[color:var(--wf-text-strong)]">Inventory</h1>
        <div className={COLLECTION_SCROLL_CONTENT_CLASS}>
          <div className="sticky top-0 z-30 border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)]/95 shadow-sm backdrop-blur">
            <div className="grid grid-cols-[76px_86px_minmax(0,1fr)_48px] items-center gap-1 p-1.5 sm:flex sm:gap-2 sm:p-2">
              <input
                aria-label="Search inventory items"
                className="col-span-full min-h-10 min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 sm:flex-1 sm:text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search inventory..."
              />
              <CollectionFiltersToggle
                count={activeFilters.length}
                expanded={filtersExpanded}
                onClick={() => setFiltersExpanded((open) => !open)}
                controlsId="inventory-advanced-filters"
                className="w-full gap-1 px-1.5 text-xs sm:w-auto sm:gap-2 sm:px-3 sm:text-sm"
              />
              <div className="relative hidden min-h-10 items-center gap-2 rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-2.5 sm:flex">
                <input type="checkbox" checked={allDisplayedChecked} onChange={(event) => toggleDisplayedSelection(event.target.checked)} aria-label="Select all displayed items" />
                <button
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={selectedDisplayedCount === 0}
                  onClick={() => setActionsMenuOpen((open) => !open)}
                >
                  Actions
                </button>
                <span className="whitespace-nowrap text-xs text-slate-500">{selectedDisplayedCount} checked</span>
                {actionsMenuOpen && selectedDisplayedCount > 0 && (
                  <div className="wf-popover absolute left-0 top-[calc(100%+0.5rem)] z-40 w-56 rounded-2xl border p-2 backdrop-blur">
                    <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={applySelectedGoalAdd}>Add to Goals</button>
                    <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={applySelectedGoalRemove}>Remove from Goals</button>
                    <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={applySelectedCountUpdate}>Update Count</button>
                    <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => applySelectedMastery(true)}>Mark Mastery</button>
                    <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => applySelectedMastery(false)}>Unmark Mastery</button>
                  </div>
                )}
              </div>
              <label className="sr-only" htmlFor="inventory-sort">Sort inventory</label>
              <select
                id="inventory-sort"
                aria-label="Sort inventory"
                className="col-start-2 min-h-10 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-1.5 text-[11px] text-slate-200 sm:col-auto sm:w-auto sm:px-2.5 sm:text-xs"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
              >
                <option value="az">Item A→Z</option>
                <option value="za">Item Z→A</option>
                <option value="type-asc">Type A→Z</option>
                <option value="type-desc">Type Z→A</option>
                <option value="release-newest">Release newest</option>
                <option value="release-oldest">Release oldest</option>
                <option value="mr-asc">Mastery rank low to high</option>
                <option value="mr-desc">Mastery rank high to low</option>
                <option value="count-desc">Count high to low</option>
                <option value="count-asc">Count low to high</option>
                <option value="owned-first">Owned first</option>
                <option value="unowned-first">Unowned first</option>
                <option value="mastered-last">Unmastered first</option>
              </select>
              <div className="relative hidden sm:block">
                <WorkspaceAction
                  className="min-h-10 whitespace-nowrap rounded-xl px-2.5 py-2 text-xs"
                  onClick={() => setColumnMenuOpen((open) => !open)}
                >
                  Columns
                </WorkspaceAction>
                {columnMenuOpen && (
                  <div className="wf-popover absolute right-0 top-[calc(100%+0.5rem)] z-40 w-56 rounded-2xl border p-3 backdrop-blur">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Visible Columns</div>
                    <div className="space-y-2">
                      {DEFAULT_INVENTORY_COLUMNS.map((column) => (
                        <label key={column} className="flex items-center gap-2 text-sm text-slate-300">
                          <input type="checkbox" checked={visibleTableColumns.includes(column)} disabled={column === "item"} onChange={() => toggleColumn(column)} />
                          <span>{columnMeta[column].label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span aria-label={`${finalFiltered.length.toLocaleString()} inventory rows`} className="col-start-3 justify-self-center whitespace-nowrap rounded-full border border-slate-800 bg-slate-900/80 px-1.5 py-2 text-[10px] text-slate-300 sm:col-auto sm:px-2.5 sm:text-xs">
                <span className="sm:hidden">{finalFiltered.length.toLocaleString()}</span>
                <span className="hidden sm:inline">{finalFiltered.length.toLocaleString()} rows</span>
              </span>
              <div className="relative col-start-4 sm:hidden">
                <button
                  type="button"
                  aria-expanded={moreMenuOpen}
                  aria-controls="inventory-mobile-tools"
                  aria-label="More inventory actions and columns"
                  onClick={() => setMoreMenuOpen((open) => !open)}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] text-sm font-semibold text-[color:var(--wf-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--wf-accent-primary)]"
                >
                  ···
                </button>
                {moreMenuOpen && (
                  <div id="inventory-mobile-tools" className="wf-popover absolute right-0 top-[calc(100%+0.5rem)] z-40 max-h-[min(70vh,28rem)] w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border p-3 backdrop-blur">
                    <label className="flex items-center gap-2 border-b border-slate-800 pb-3 text-sm text-slate-200">
                      <input type="checkbox" checked={allDisplayedChecked} onChange={(event) => toggleDisplayedSelection(event.target.checked)} />
                      Select all displayed items
                    </label>
                    <div className="border-b border-slate-800 py-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Actions · {selectedDisplayedCount} selected</div>
                      <button disabled={selectedDisplayedCount === 0} className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-40" onClick={applySelectedGoalAdd}>Add to Goals</button>
                      <button disabled={selectedDisplayedCount === 0} className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-40" onClick={applySelectedGoalRemove}>Remove from Goals</button>
                      <button disabled={selectedDisplayedCount === 0} className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-40" onClick={applySelectedCountUpdate}>Update Count</button>
                      <button disabled={selectedDisplayedCount === 0} className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-40" onClick={() => applySelectedMastery(true)}>Mark Mastery</button>
                      <button disabled={selectedDisplayedCount === 0} className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-40" onClick={() => applySelectedMastery(false)}>Unmark Mastery</button>
                    </div>
                    <div className="pt-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Visible Columns</div>
                      <div className="space-y-2">
                        {DEFAULT_INVENTORY_COLUMNS.map((column) => (
                          <label key={column} className="flex items-center gap-2 text-sm text-slate-300">
                            <input type="checkbox" checked={visibleTableColumns.includes(column)} disabled={column === "item"} onChange={() => toggleColumn(column)} />
                            <span>{columnMeta[column].label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          <CollectionModeBand className="overflow-x-auto" segmentedClassName="!w-max !min-w-full !flex-nowrap">
              <TabButton
                label="All"
                active={primaryTab === "all"}
                onClick={() => selectPrimaryTab("all")}
              />
              <TabButton
                label="Warframes & Vehicles"
                active={primaryTab === "warframesVehicles"}
                onClick={() => selectPrimaryTab("warframesVehicles")}
              />
              <TabButton
                label="Weapons"
                active={primaryTab === "weapons"}
                onClick={() => selectPrimaryTab("weapons")}
              />
              <TabButton
                label="Companions"
                active={primaryTab === "companions"}
                onClick={() => selectPrimaryTab("companions")}
              />
              <TabButton
                label="Blueprints & Parts"
                active={primaryTab === "components"}
                onClick={() => selectPrimaryTab("components")}
              />
              <TabButton
                label="Resources"
                active={primaryTab === "resources"}
                onClick={() => selectPrimaryTab("resources")}
              />
              <TabButton
                label="Railjack"
                active={primaryTab === "railjack"}
                onClick={() => selectPrimaryTab("railjack")}
              />
              <TabButton
                label="Safe to Sell"
                active={primaryTab === "safeToSell"}
                onClick={() => selectPrimaryTab(primaryTab === "safeToSell" ? "all" : "safeToSell")}
              />
            </CollectionModeBand>
          </div>

          <CollectionActiveFilterSummary filters={activeFilters} onClear={clearAllFilters} />

          <CollectionFilterDisclosure id="inventory-advanced-filters" expanded={filtersExpanded}>
            <CollectionUtilityPanel className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {primaryTab !== "safeToSell" ? (
                <div className="space-y-3">
                  <CollectionRefineGroup label="Ownership">
                    <div className="flex flex-wrap gap-2">
                      {(["all", "owned", "unowned"] as const).map((filter) => (
                        <PillButton key={filter} label={filter === "all" ? "All" : filter === "owned" ? "Owned" : "Unowned"} active={ownershipFilter === filter} onClick={() => setOwnershipFilter(filter)} />
                      ))}
                    </div>
                  </CollectionRefineGroup>
                  <CollectionRefineGroup label="Status & availability">
                    <div className="flex flex-wrap gap-2">
                      <PillButton label="Mastered" active={ownershipFilter === "mastered"} onClick={() => setOwnershipFilter(ownershipFilter === "mastered" ? "all" : "mastered")} />
                      <PillButton label={masteryRank === null ? "Within current MR" : `Within current MR (${masteryRank})`} active={showAvailableNow} onClick={() => { if (masteryRank !== null) setShowAvailableNow(!showAvailableNow); }} />
                      <PillButton label="Accessible sources" active={showAvailableOnly} onClick={() => setShowAvailableOnly(!showAvailableOnly)} />
                    </div>
                  </CollectionRefineGroup>
                </div>
              ) : (
                <div className="text-sm text-slate-400">Catalog review shaped by your sell rules.</div>
              )}
              <CollectionRefineGroup label="Prime & vaulted">
                <div className="flex flex-wrap gap-2">
                  <FilterTagButton label="Prime" state={variantFilters.prime} title={variantFilters.prime === "include" ? "Showing Prime items only. Click again to exclude them." : variantFilters.prime === "exclude" ? "Prime items are excluded. Click again to clear." : "Click to show Prime items only."} onClick={() => toggleVariantFilter("prime")} />
                  <FilterTagButton label="Vaulted" state={variantFilters.vaulted} title={variantFilters.vaulted === "include" ? "Showing vaulted items only. Click again to exclude them." : variantFilters.vaulted === "exclude" ? "Vaulted items are excluded. Click again to clear." : "Click to show vaulted items only."} onClick={() => toggleVariantFilter("vaulted")} />
                </div>
              </CollectionRefineGroup>
              <div className="min-w-0 xl:col-span-2">
              <CollectionRefineGroup label="Column filters">
                <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-1 text-xs text-slate-400">
                    Type
                    <select className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" value={tableTypeFilter} onChange={(event) => setTableTypeFilter(event.target.value)}>
                      <option value="all">All types</option>
                      {tableTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-slate-400">
                    Release
                    <select className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" value={tableReleaseFilterMode} onChange={(event) => setTableReleaseFilterMode(event.target.value as ReleaseColumnFilterMode)}>
                      <option value="all">All release</option>
                      <option value="exists">Has date</option>
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </select>
                    {(tableReleaseFilterMode === "before" || tableReleaseFilterMode === "after") && <input aria-label="Release date" className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" type="date" value={tableReleaseFilterValue} onChange={(event) => setTableReleaseFilterValue(event.target.value)} />}
                  </label>
                  <label className="grid gap-1 text-xs text-slate-400">
                    Access
                    <select className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" value={tableAccessFilter} onChange={(event) => setTableAccessFilter(event.target.value as AccessFilter)}>
                      <option value="all">All access</option>
                      <option value="available">Now</option>
                      <option value="partial">Partial</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-slate-400">
                    Mastery Rank
                    <select className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" value={tableMrFilterMode} onChange={(event) => setTableMrFilterMode(event.target.value as MrColumnFilterMode)}>
                      <option value="all">All MR</option>
                      <option value="exists">Has MR</option>
                      <option value="equals">Equals</option>
                      <option value="lte">At or under</option>
                      <option value="gte">At or above</option>
                    </select>
                    {tableMrFilterMode === "equals" || tableMrFilterMode === "lte" || tableMrFilterMode === "gte" ? (
                      <select aria-label="Mastery Rank value" className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" value={tableMrFilterValue} onChange={(event) => setTableMrFilterValue(event.target.value)}>
                        <option value="">Any MR</option>
                        {tableMrOptions.map((mr) => <option key={mr} value={String(mr)}>MR {mr}</option>)}
                      </select>
                    ) : null}
                  </label>
                  <label className="grid gap-1 text-xs text-slate-400">
                    Mastery State
                    <select className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" value={tableMasteredFilter} onChange={(event) => setTableMasteredFilter(event.target.value as MasteredColumnFilter)}>
                      <option value="all">All states</option>
                      <option value="mastered">Mastered</option>
                      <option value="unmastered">Not mastered</option>
                      <option value="na">N/A</option>
                    </select>
                  </label>
                </div>
              </CollectionRefineGroup>
              </div>
            </CollectionUtilityPanel>

          {primaryTab === "weapons" ? (
            <CollectionRefineBand title="Refine Weapons" className="gap-y-1.5">
              <CollectionChipRail>
                <SubTabButton
                  label="All"
                  active={weaponClassTab === "all"}
                  onClick={() => selectWeaponClass("all")}
                />
                <SubTabButton
                  label="Primary"
                  active={weaponClassTab === "primary"}
                  onClick={() => selectWeaponClass("primary")}
                />
                <SubTabButton
                  label="Secondary"
                  active={weaponClassTab === "secondary"}
                  onClick={() => selectWeaponClass("secondary")}
                />
                <SubTabButton
                  label="Melee"
                  active={weaponClassTab === "melee"}
                  onClick={() => selectWeaponClass("melee")}
                />
                <SubTabButton
                  label="Companion"
                  active={weaponClassTab === "companion"}
                  onClick={() => selectWeaponClass("companion")}
                />
              </CollectionChipRail>
              {weaponClassTab !== "companion" &&
              weaponClassTab !== "all" &&
              weaponTypeOptions.length > 0 ? (
                <CollectionRefineGroup
                  label="Weapon Type"
                  action={
                    Object.keys(weaponTypeFilters).length > 0 ? (
                      <button
                        className="text-xs text-slate-300 underline hover:text-slate-100"
                        onClick={() => setWeaponTypeFilters({})}
                      >
                        Clear type filters
                      </button>
                    ) : null
                  }
                >
                  <CollectionChipRail>
                    {weaponTypeOptions.map((t) => {
                      const state = weaponTypeFilters[t];
                      return (
                        <FilterTagButton
                          key={t}
                          label={titleCase(t)}
                          state={state}
                          title={
                            state === "include"
                              ? `Including ${titleCase(t)}. Click again to exclude it.`
                              : state === "exclude"
                                ? `Excluding ${titleCase(t)}. Click again to clear it.`
                                : `Click to include ${titleCase(t)}.`
                          }
                          onClick={() => {
                            setWeaponTypeFilters((prev) => {
                              const nextState = cycleTagFilterState(prev[t]);
                              const next = { ...prev };
                              if (!nextState) delete next[t];
                              else next[t] = nextState;
                              return next;
                            });
                          }}
                        />
                      );
                    })}
                  </CollectionChipRail>
                </CollectionRefineGroup>
              ) : null}
            </CollectionRefineBand>
          ) : primaryTab === "warframesVehicles" ? (
            <CollectionRefineBand title="Refine Warframes & Vehicles" className="gap-y-1.5">
              <CollectionChipRail>
                <SubTabButton
                  label="All"
                  active={wfVehTab === "all"}
                  onClick={() => setWfVehTab("all")}
                />
                <SubTabButton
                  label="Warframes"
                  active={wfVehTab === "warframes"}
                  onClick={() => setWfVehTab("warframes")}
                />
                <SubTabButton
                  label="Archwings"
                  active={wfVehTab === "archwings"}
                  onClick={() => setWfVehTab("archwings")}
                />
                <SubTabButton
                  label="Necramechs"
                  active={wfVehTab === "necramechs"}
                  onClick={() => setWfVehTab("necramechs")}
                />
              </CollectionChipRail>
            </CollectionRefineBand>
          ) : primaryTab === "companions" ? (
            <CollectionRefineBand title="Refine Companions" className="gap-y-1.5">
              <CollectionChipRail>
                <SubTabButton
                  label="All"
                  active={companionsTab === "all"}
                  onClick={() => setCompanionsTab("all")}
                />
                <SubTabButton
                  label="Hound"
                  active={companionsTab === "hound"}
                  onClick={() => setCompanionsTab("hound")}
                />
                <SubTabButton
                  label="Kavat"
                  active={companionsTab === "kavat"}
                  onClick={() => setCompanionsTab("kavat")}
                />
                <SubTabButton
                  label="Kubrow"
                  active={companionsTab === "kubrow"}
                  onClick={() => setCompanionsTab("kubrow")}
                />
                <SubTabButton
                  label="Predasite"
                  active={companionsTab === "predasite"}
                  onClick={() => setCompanionsTab("predasite")}
                />
                <SubTabButton
                  label="Vulpaphyla"
                  active={companionsTab === "vulpaphyla"}
                  onClick={() => setCompanionsTab("vulpaphyla")}
                />
                <SubTabButton
                  label="Moa"
                  active={companionsTab === "moa"}
                  onClick={() => setCompanionsTab("moa")}
                />
                <SubTabButton
                  label="Sentinel"
                  active={companionsTab === "sentinel"}
                  onClick={() => setCompanionsTab("sentinel")}
                />
              </CollectionChipRail>
            </CollectionRefineBand>
          ) : primaryTab === "safeToSell" ? (
            <CollectionRefineBand title="Sell Rules" className="gap-y-4">
              <div className="grid gap-6 xl:grid-cols-[18.5rem_minmax(0,1fr)] xl:gap-8">
                <div className="space-y-5 xl:border-r xl:border-slate-800/60 xl:pr-8">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">View</div>
                    <div className="space-y-2">
                      <SafeToSellModeButton
                        label="All Items"
                        active={safeToSellViewMode === "all"}
                        onClick={() => setSafeToSellViewMode("all")}
                      />
                      <SafeToSellModeButton
                        label="Safe Only"
                        active={safeToSellViewMode === "safe"}
                        onClick={() => setSafeToSellViewMode("safe")}
                      />
                      <SafeToSellModeButton
                        label="Protected Only"
                        active={safeToSellViewMode === "protected"}
                        onClick={() => setSafeToSellViewMode("protected")}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-800/60 pt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Catalog Scope</div>
                    <button
                      className={[
                        "mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                        safeToSellOwnedOnly
                          ? "border-cyan-700/60 bg-cyan-950/24 text-cyan-100 shadow-[0_0_0_1px_rgba(8,145,178,0.16)]"
                          : "border-slate-800/80 bg-slate-950/18 text-slate-300 hover:border-slate-700 hover:bg-slate-900/55",
                      ].join(" ")}
                      onClick={() => setSafeToSellOwnedOnly((value) => !value)}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{safeToSellOwnedOnly ? "Owned inventory only" : "Full catalog"}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {safeToSellOwnedOnly ? "Only rows you currently own" : "Show owned and unowned slots"}
                        </span>
                      </span>
                      <span className={["text-[11px] font-medium uppercase tracking-[0.14em]", safeToSellOwnedOnly ? "text-cyan-200/80" : "text-slate-500"].join(" ")}>
                        {safeToSellOwnedOnly ? "Owned" : "All"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Protected Sources</div>
                      <div className="h-px w-10 bg-slate-800/70" />
                    </div>
                    <SafeToSellStatusPill tone="neutral">
                      {activeSafeToSellProtectionCount} active rule{activeSafeToSellProtectionCount === 1 ? "" : "s"}
                    </SafeToSellStatusPill>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                    {(Object.keys(SAFE_TO_SELL_PROTECTION_META) as SafeToSellProtectionKey[]).map((key) => (
                      <SafeToSellRuleChip
                        key={key}
                        label={SAFE_TO_SELL_PROTECTION_META[key].label}
                        description={SAFE_TO_SELL_PROTECTION_META[key].description}
                        active={safeToSellProtections[key]}
                        onClick={() => toggleSafeToSellProtection(key)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CollectionRefineBand>
          ) : null}
          </CollectionFilterDisclosure>

          {primaryTab === "safeToSell" && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <SafeToSellStatusPill tone="safe">Safe now: {safeToSellSafeCount}</SafeToSellStatusPill>
              <SafeToSellStatusPill tone="protected">Protected: {safeToSellProtectedCount}</SafeToSellStatusPill>
              <SafeToSellStatusPill tone="neutral">Search below to check any item</SafeToSellStatusPill>
            </div>
          )}

          <div>
            <div className="min-w-max">
            {/* Header */}
            <div className="sticky top-36 z-20 border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] backdrop-blur sm:top-44 lg:top-28">
              <div
                className="grid gap-0 text-sm"
                style={{ gridTemplateColumns: inventoryGridTemplate }}
              >
                <div
                  className="flex items-center justify-center px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  title="Selection"
                  aria-label="Selection column"
                />
                {visibleTableColumns.map((column) => {
                  const sortable =
                    column === "item" ||
                    column === "type" ||
                    column === "release" ||
                    column === "mr" ||
                    column === "count";
                  const sortLabel =
                    column === "item"
                      ? sortKey === "az"
                        ? "A→Z"
                        : sortKey === "za"
                          ? "Z→A"
                          : null
                      : column === "type"
                        ? sortKey === "type-asc"
                          ? "A→Z"
                          : sortKey === "type-desc"
                            ? "Z→A"
                            : null
                        : column === "release"
                          ? sortKey === "release-newest"
                            ? "Newest"
                            : sortKey === "release-oldest"
                              ? "Oldest"
                              : null
                          : column === "mr"
                            ? sortKey === "mr-asc"
                              ? "Low→High"
                              : sortKey === "mr-desc"
                                ? "High→Low"
                                : null
                            : column === "count"
                              ? sortKey === "count-desc"
                                ? "High→Low"
                                : sortKey === "count-asc"
                                  ? "Low→High"
                                  : null
                              : null;

                  return (
                    <button
                      key={column}
                      className={[
                        "flex items-center gap-2 px-3 py-2 text-left font-semibold",
                        sortable ? "text-slate-200 hover:bg-slate-900/70" : "text-slate-300",
                        column === "mastered" ? "justify-center" : "",
                      ].join(" ")}
                      disabled={!sortable}
                      onClick={() => {
                        if (column === "item") cycleSort("az", "za");
                        else if (column === "type") cycleSort("type-asc", "type-desc");
                        else if (column === "release") cycleSort("release-newest", "release-oldest");
                        else if (column === "mr") cycleSort("mr-asc", "mr-desc");
                        else if (column === "count") cycleSort("count-desc", "count-asc");
                      }}
                    >
                      <span>{columnMeta[column].label}</span>
                      {sortLabel && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          {sortLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div
                className="hidden"
                style={{ gridTemplateColumns: inventoryGridTemplate }}
              >
                <div style={{ gridColumn: "span 2 / span 2" }}>
                  <div
                    className="grid items-center"
                    style={{ gridTemplateColumns: "48px minmax(320px,1.8fr)" }}
                  >
                    <div className="flex items-center justify-center px-2 py-2">
                      <input
                        type="checkbox"
                        checked={allDisplayedChecked}
                        onChange={(e) => toggleDisplayedSelection(e.target.checked)}
                        aria-label="Select all displayed items"
                      />
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <span className="text-xs text-slate-300">Select all</span>
                      <div className="relative">
                        <button
                          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={selectedDisplayedCount === 0}
                          onClick={() => setActionsMenuOpen((open) => !open)}
                        >
                          Actions
                        </button>
                        {actionsMenuOpen && selectedDisplayedCount > 0 && (
                          <div className="wf-popover absolute left-0 top-[calc(100%+0.5rem)] z-20 w-56 rounded-2xl border p-2 backdrop-blur">
                            <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={applySelectedGoalAdd}>Add to Goals</button>
                            <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={applySelectedGoalRemove}>Remove from Goals</button>
                            <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={applySelectedCountUpdate}>Update Count</button>
                            <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => applySelectedMastery(true)}>Mark Mastery</button>
                            <button className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => applySelectedMastery(false)}>Unmark Mastery</button>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{selectedDisplayedCount} checked</span>
                    </div>
                  </div>
                </div>
                {visibleTableColumns.filter((column) => column !== "item").map((column) => {
                  if (column === "type") {
                    return (
                      <div key={column} className="px-2 py-2">
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                          value={tableTypeFilter}
                          onChange={(e) => setTableTypeFilter(e.target.value)}
                        >
                          <option value="all">All types</option>
                          {tableTypeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  if (column === "release") {
                    return (
                      <div key={column} className="px-2 py-2 space-y-1">
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                          value={tableReleaseFilterMode}
                          onChange={(e) => setTableReleaseFilterMode(e.target.value as ReleaseColumnFilterMode)}
                        >
                          <option value="all">All release</option>
                          <option value="exists">Has date</option>
                          <option value="before">Before</option>
                          <option value="after">After</option>
                        </select>
                        {(tableReleaseFilterMode === "before" || tableReleaseFilterMode === "after") && (
                          <input
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                            type="date"
                            value={tableReleaseFilterValue}
                            onChange={(e) => setTableReleaseFilterValue(e.target.value)}
                          />
                        )}
                      </div>
                    );
                  }
                  if (column === "available") {
                    return (
                      <div key={column} className="px-2 py-2">
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                          value={tableAccessFilter}
                          onChange={(e) => setTableAccessFilter(e.target.value as AccessFilter)}
                        >
                          <option value="all">All access</option>
                          <option value="available">Now</option>
                          <option value="partial">Partial</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                    );
                  }
                  if (column === "mr") {
                    return (
                      <div key={column} className="px-2 py-2 space-y-1">
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                          value={tableMrFilterMode}
                          onChange={(e) => setTableMrFilterMode(e.target.value as MrColumnFilterMode)}
                        >
                          <option value="all">All MR</option>
                          <option value="exists">Has MR</option>
                          <option value="equals">Equals</option>
                          <option value="lte">At or under</option>
                          <option value="gte">At or above</option>
                        </select>
                        {(tableMrFilterMode === "equals" ||
                          tableMrFilterMode === "lte" ||
                          tableMrFilterMode === "gte") && (
                          <select
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                            value={tableMrFilterValue}
                            onChange={(e) => setTableMrFilterValue(e.target.value)}
                          >
                            <option value="">Any MR</option>
                            {tableMrOptions.map((mr) => (
                              <option key={mr} value={String(mr)}>
                                MR {mr}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  }
                  if (column === "mastered") {
                    return (
                      <div key={column} className="px-2 py-2">
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                          value={tableMasteredFilter}
                          onChange={(e) => setTableMasteredFilter(e.target.value as MasteredColumnFilter)}
                        >
                          <option value="all">All states</option>
                          <option value="mastered">Mastered</option>
                          <option value="unmastered">Not mastered</option>
                          <option value="na">N/A</option>
                        </select>
                      </div>
                    );
                  }

                  return <div key={column} className="px-2 py-2" />;
                })}
              </div>
            </div>

            {/* Body spacer + window */}
            <div ref={rowsAnchorRef} className="relative" style={{ height: totalHeight }}>
              <div
                className="absolute left-0 right-0"
                style={{ transform: `translateY(${translateY}px)` }}
              >
                {slice.map((r) => {
                  const goal = goalByCatalogId.get(String(r.id));
                  const goalTarget = goal ? safeInt(goal.qty ?? 1, 1) : 0;
                  const sellSafety = sellSafetyById.get(String(r.id));
                  const weaponRecipeUses = sellSafety?.weaponRecipeUses ?? [];
                  const activeSellProtections = (sellSafety?.protectionKeys ?? []).filter((key) => safeToSellProtections[key]);
                  const isSafeToSell = primaryTab === "safeToSell" ? activeSellProtections.length === 0 : false;
                  const isSelected = selectedDetailId === r.id;
                  const isChecked = selectedRowIds.has(String(r.id));
                  const isOwned = r.value > 0;
                  const isMastered =
                    r.isMasterable &&
                    checkMastered(
                      mastered,
                      overLevelMastered,
                      String(r.id),
                      r.path,
                    );
                  const rowAllE = ALL_BY_UNIQUE[r.path];
                  const availability = determineItemAvailability(
                    r.id,
                    effectiveCompletedPrereqs,
                    masteryRank,
                  );
                  const availabilityLabel =
                    availability === "available"
                      ? "Now"
                      : availability === "partial"
                        ? "Partial"
                        : "Blocked";
                  const availabilityTone =
                    availability === "available"
                      ? "text-emerald-300 border-emerald-800/50 bg-emerald-950/30"
                      : availability === "partial"
                        ? "text-amber-300 border-amber-800/50 bg-amber-950/30"
                        : "text-rose-300 border-rose-800/50 bg-rose-950/30";
                  const primeAvailability = getPrimeAvailabilityStatus(String(r.id), worldState);
                  const isVaulted = primeAvailability === "vaulted";
                  const isPrimeResurgence = primeAvailability === "prime_resurgence";
                  const hasVaultedParts =
                    !isVaulted &&
                    (rowAllE?.components?.some(
                      (comp) =>
                        comp.uniqueName &&
                        getPrimeAvailabilityStatus(`items:${comp.uniqueName}`, worldState) === "vaulted",
                    ) ??
                      false);

                  return (
                    <div
                      key={String(r.id)}
                      className={[
                        "grid border-b border-slate-800/70 items-center",
                        isSelected ? "bg-slate-900/60" : "",
                      ].join(" ")}
                      style={{ gridTemplateColumns: inventoryGridTemplate, height: ROW_H }}
                    >
                      <div className="px-2 py-2 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleRowSelection(String(r.id), e.target.checked)}
                          aria-label={`Select ${r.label}`}
                        />
                      </div>
                      {visibleTableColumns.map((column) => {
                        if (column === "item") {
                          return (
                            <div key={column} className="px-3 py-2 flex items-center gap-2 min-w-0">
                              <span
                                className={[
                                  "shrink-0 w-2 h-2 rounded-full",
                                  isMastered ? "bg-cyan-400" : isOwned ? "bg-emerald-500" : "bg-slate-700",
                                ].join(" ")}
                                title={isMastered ? "Mastered" : isOwned ? "Owned" : "Not owned"}
                              />
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <button
                                    className={[
                                      "min-w-0 truncate text-left text-sm transition-colors hover:text-cyan-300",
                                      isMastered ? "text-cyan-400/80" : isOwned ? "text-slate-100" : "text-slate-400",
                                    ].join(" ")}
                                    onClick={() => setSelectedDetailId(isSelected ? null : r.id)}
                                    title="Click for details"
                                  >
                                    {r.label}
                                  </button>
                                  {isPrimeResurgence && (
                                    <span className="shrink-0 rounded border border-violet-700/50 bg-violet-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
                                      PRIME RESURGENCE
                                    </span>
                                  )}
                                  {isVaulted && (
                                    <span className="shrink-0 rounded border border-rose-700/50 bg-rose-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                                      VAULTED
                                    </span>
                                  )}
                                  {hasVaultedParts && (
                                    <span className="shrink-0 rounded border border-orange-700/50 bg-orange-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400">
                                      VAULTED PARTS
                                    </span>
                                  )}
                                  {weaponRecipeUses.length > 0 && (
                                    <span
                                      className="shrink-0 rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
                                      title={`Used to craft ${weaponRecipeUses.map((use) => use.outputName).join(", ")}`}
                                    >
                                      WEAPON INGREDIENT
                                    </span>
                                  )}
                                  {primaryTab === "safeToSell" && (
                                    <span
                                      className={[
                                        "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                                        isSafeToSell
                                          ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-300"
                                          : "border-slate-700/60 bg-slate-900 text-slate-200",
                                      ].join(" ")}
                                      title={
                                        isSafeToSell
                                          ? "Safe to sell under the current rules."
                                          : `Protected by ${activeSellProtections.map((key) => SAFE_TO_SELL_PROTECTION_META[key].label).join(", ")}`
                                      }
                                    >
                                      {isSafeToSell ? "SAFE" : "PROTECTED"}
                                    </span>
                                  )}
                                </div>
                                {primaryTab === "safeToSell" && activeSellProtections.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {activeSellProtections.slice(0, 3).map((key) => (
                                      <span
                                        key={key}
                                        className="rounded-full border border-amber-800/40 bg-amber-950/20 px-1.5 py-0.5 text-[10px] text-amber-200"
                                      >
                                        {SAFE_TO_SELL_PROTECTION_META[key].label}
                                      </span>
                                    ))}
                                    {activeSellProtections.length > 3 && (
                                      <span className="text-[10px] text-slate-500">+{activeSellProtections.length - 3} more</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (column === "type") {
                          return (
                            <div key={column} className="px-3 py-2 text-sm text-slate-300">
                              {r.itemType || "—"}
                            </div>
                          );
                        }

                        if (column === "release") {
                          return (
                            <div key={column} className="px-3 py-2 text-sm text-slate-300">
                              {formatReleaseDate(r.releaseDate) ?? "—"}
                            </div>
                          );
                        }

                        if (column === "mr") {
                          return (
                            <div key={column} className="px-3 py-2 text-sm text-slate-300">
                              {r.masteryReq > 0 ? `MR ${r.masteryReq}` : "—"}
                            </div>
                          );
                        }

                        if (column === "available") {
                          return (
                            <div key={column} className="px-3 py-2">
                              <span className={["inline-flex rounded-full border px-2 py-1 text-xs font-semibold", availabilityTone].join(" ")}>
                                {availabilityLabel}
                              </span>
                            </div>
                          );
                        }

                        if (column === "count") {
                          return (
                            <div key={column} className="px-2 py-2 flex items-center gap-1">
                              <button
                                className="shrink-0 w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-base font-bold leading-none flex items-center justify-center"
                                onClick={() => setCount(String(r.id), Math.max(0, r.value - 1))}
                                tabIndex={-1}
                              >
                                −
                              </button>
                              <input
                                className="w-14 rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-center text-sm text-slate-100"
                                type="number"
                                min={0}
                                value={r.value}
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  setCount(String(r.id), Number.isFinite(n) ? n : 0);
                                }}
                              />
                              <button
                                className="shrink-0 w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-base font-bold leading-none flex items-center justify-center"
                                onClick={() => setCount(String(r.id), r.value + 1)}
                                tabIndex={-1}
                              >
                                +
                              </button>
                            </div>
                          );
                        }

                        if (column === "mastered") {
                          return (
                            <div key={column} className="px-2 py-2 flex items-center justify-center">
                              {r.isMasterable && (
                                <button
                                  title={isMastered ? "Marked as mastered — click to unmark" : "Click to mark as mastered"}
                                  className={[
                                    "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                                    isMastered
                                      ? "border-cyan-700 bg-cyan-900/60 text-cyan-300 hover:bg-cyan-900"
                                      : "border-slate-700 bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300",
                                  ].join(" ")}
                                  onClick={() => {
                                    if (r.path === "/Lotus/Types/Game/CrewShip/RailJack/DefaultHarness") {
                                      setOverLevelMastered(String(r.id), !isMastered);
                                    } else {
                                      setMastered(String(r.id), !isMastered);
                                    }
                                  }}
                                >
                                  {isMastered ? "✓" : "M"}
                                </button>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={column} className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                className={[
                                  "w-full rounded-lg border px-2 py-1.5 text-sm text-slate-100",
                                  goal ? "border-slate-700 bg-slate-900" : "border-slate-800 bg-slate-950/40 text-slate-400",
                                ].join(" ")}
                                type="number"
                                min={0}
                                value={goalTarget}
                                onChange={(e) => {
                                  const next = safeInt(e.target.value, 0);
                                  if (next <= 0) {
                                    if (goal) removeGoal(goal.id);
                                    return;
                                  }
                                  if (!goal) {
                                    addGoalItem(String(r.id), next);
                                    return;
                                  }
                                  setGoalQty(goal.id, next);
                                }}
                              />
                              <div className={["text-xs whitespace-nowrap", goal ? "text-emerald-400" : "text-slate-600"].join(" ")}>
                                {goal ? "On" : "Off"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            </div>

            {finalFiltered.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-400">
                No matches.
              </div>
            )}
          </div>

        </div>
      </section>
      </CollectionScrollSurface>

      {selectedDetailId
        ? (() => {
          const rec: any = FULL_CATALOG.recordsById[selectedDetailId];
          const name = rec?.displayName ?? String(selectedDetailId);
          const uniqueName = String(selectedDetailId).replace(/^[^:]+:/, "");
          const allE = getAllEntry(uniqueName, name);
          const imageUrl = getEntityImageUrl(allE);
          const sellSafety = sellSafetyById.get(String(selectedDetailId));
          const weaponRecipeUses = sellSafety?.weaponRecipeUses ?? [];
          const matchedSellProtections = sellSafety?.protectionKeys ?? [];

          const acq = getAcquisitionByCatalogId(selectedDetailId);
          const sources: string[] = Array.isArray(acq?.sources)
            ? (acq.sources as string[])
            : [];
          const recRaw = rec?.raw as Record<string, unknown> | undefined;
          const lotusData = (recRaw?.rawLotus as { data?: Record<string, unknown> } | undefined)?.data
            ?? (recRaw?.data as Record<string, unknown> | undefined)
            ?? null;
          const { marketCreditsPrice, marketPlatinumPrice } = getKnownMarketPrices(
            lotusData,
            typeof (allE as { marketCost?: unknown } | null)?.marketCost === "number"
              ? Number((allE as { marketCost?: number }).marketCost)
              : null,
          );
          const itemSourceEntries = buildInventorySourceEntries({
            itemName: name,
            sourceIds: sources,
            drops: resolveDropsForUniqueName(uniqueName),
            worldState,
            marketCreditsPrice,
            marketPlatinumPrice,
          });
          const componentModels = (allE?.components ?? []).map((comp, i) => {
            const componentKey = `${comp.uniqueName ?? comp.name}:${i}`;
            const resolvedCompDrops = resolveComponentDrops(comp);
            const compCatalogId = comp.uniqueName
              ? (`items:${comp.uniqueName}` as import("../domain/catalog/loadFullCatalog").CatalogId)
              : null;
            const compAcq = compCatalogId
              ? getAcquisitionByCatalogId(compCatalogId)
              : null;
            const compRecord = compCatalogId ? FULL_CATALOG.recordsById[compCatalogId] : null;
            const compRecordRaw = (compRecord?.raw as Record<string, unknown> | undefined) ?? null;
            const compLotusData =
              (compRecordRaw?.rawLotus as { data?: Record<string, unknown> } | undefined)?.data
              ?? (compRecordRaw?.data as Record<string, unknown> | undefined)
              ?? null;
            const { marketCreditsPrice: componentMarketCreditsPrice, marketPlatinumPrice: componentMarketPlatinumPrice } =
              getKnownMarketPrices(
                compLotusData,
                typeof (comp as { marketCost?: unknown }).marketCost === "number"
                  ? Number((comp as { marketCost?: number }).marketCost)
                  : null,
              );
            const sourceEntries = buildInventorySourceEntries({
              itemName: [comp.name, `${name} ${comp.name}`, `${name} ${comp.name} Blueprint`],
              sourceIds: compAcq?.sources ?? [],
              drops: resolvedCompDrops,
              worldState,
              marketCreditsPrice: componentMarketCreditsPrice,
              marketPlatinumPrice: componentMarketPlatinumPrice,
            });
            const dedupedEntries = dedupeGroupedSourceEntries(sourceEntries);
            const familyCounts = dedupedEntries.reduce((map, entry) => {
              map.set(entry.family, (map.get(entry.family) ?? 0) + 1);
              return map;
            }, new Map<Exclude<SourceFamily, "all">, number>());
            const familySummary = [...familyCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([family, count]) => `${SOURCE_FAMILY_LABELS[family]} ${count}`)
              .join(" · ");

            return {
              key: componentKey,
              catalogId: compCatalogId,
              component: comp,
              entries: dedupedEntries,
              acquisitionCount: dedupedEntries.length,
              familySummary,
              sourceIds: compAcq?.sources ?? [],
              hasDrops: resolvedCompDrops.length > 0,
              ownedCount: compCatalogId ? safeInt(counts[String(compCatalogId)] ?? 0, 0) : 0,
            };
          });
          const activeComponent =
            componentModels.find((component) => component.key === selectedComponentKey)
            ?? componentModels[0]
            ?? null;
          const avail = determineItemAvailability(
            selectedDetailId,
            effectiveCompletedPrereqs,
            masteryRank,
          );
          const blockingReasons =
            avail !== "available"
              ? getBlockingReasons(
                  selectedDetailId,
                  effectiveCompletedPrereqs,
                  masteryRank,
                )
              : [];
          const isOwned = safeInt(counts[String(selectedDetailId)] ?? 0, 0) > 0;
          const isMastered = checkMastered(
            mastered,
            overLevelMastered,
            String(selectedDetailId),
            resolveRecordPath(rec),
          );
          const availColor =
            avail === "available"
              ? "text-emerald-400"
              : avail === "partial"
                ? "text-amber-400"
                : "text-rose-400";
          const availLabel =
            avail === "available"
              ? "Available"
              : avail === "partial"
                ? "Partial Access"
                : "Blocked";
          const accessExplanation =
            avail === "available"
              ? "At least one acquisition path is open for your current progression."
              : avail === "partial"
                ? "Some acquisition paths are open now, but other sources are still gated by mastery rank or progression requirements."
                : "No current acquisition path is open for your present mastery rank or progression state.";

          const cat = allE?.category ?? "";
          const isWeapon = [
            "Primary",
            "Secondary",
            "Melee",
            "Arch-Gun",
            "Arch-Melee",
          ].includes(cat);
          const isFrame = cat === "Warframes" || cat === "Archwing";
          const isCompanion = cat === "Sentinels" || cat === "Pets";

          // Damage breakdown — non-zero damage types only
          const dmgTypes = allE?.damage
            ? Object.entries(allE.damage)
                .filter(
                  ([k, v]) =>
                    v > 0 &&
                    ![
                      "total",
                      "shieldDrain",
                      "healthDrain",
                      "energyDrain",
                      "cinematic",
                      "true",
                      "void",
                      "tau",
                    ].includes(k),
                )
                .sort(([, a], [, b]) => b - a)
            : [];

          return (
            <div className="wf-inventory-dialog-frame fixed inset-0 z-50">
              <div className="wf-modal-backdrop absolute inset-0 backdrop-blur-md" aria-hidden="true" onClick={() => setSelectedDetailId(null)} />
              <div
                ref={detailDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="inventory-detail-title"
                tabIndex={-1}
                className="wf-dialog relative mx-auto flex h-full w-full max-w-[1640px] flex-col overflow-hidden rounded-[28px] border"
              >
                <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-6 sm:py-6">
              <div className="space-y-5">
                <WorkspaceHero
                  eyebrow={allE?.category ?? allE?.type ?? "Inventory Dossier"}
                  title={name}
                  titleId="inventory-detail-title"
                  description=""
                  actions={
                    <>
                      <WorkspaceAction onClick={() => window.open(wikiUrl(name), "_blank", "noopener,noreferrer")}>Wiki</WorkspaceAction>
                      <WorkspaceAction onClick={() => setSelectedDetailId(null)}>Close</WorkspaceAction>
                    </>
                  }
                  stats={
                    <>
                      {(allE?.masteryReq ?? 0) > 0 ? <WorkspaceStat label="Mastery" value={`MR ${allE!.masteryReq}`} hint="Required rank" /> : null}
                      {allE?.type ? <WorkspaceStat label="Type" value={allE.type} hint={allE?.category ?? "Catalog entry"} /> : null}
                      <WorkspaceStat label="Owned" value={isOwned ? "Yes" : "No"} hint={isMastered ? "Mastered in profile" : "Not mastered yet"} />
                      <WorkspaceStat label="Access" value={availLabel} hint={avail === "available" ? "Ready to acquire or use" : "Review blockers below"} />
                    </>
                  }
                  className="overflow-hidden"
                />
                {allE?.description ? (
                  <div className="-mt-2 px-1 text-sm leading-7 text-slate-300">
                    {renderDesc(allE.description, allE.required !== undefined ? { COUNT: allE.required } : undefined)}
                    {allE?.passiveDescription ? (
                      <div className="mt-2 text-xs italic text-slate-500">
                        Passive: {renderDesc(allE.passiveDescription)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(340px,0.72fr)_minmax(0,1.28fr)]">
                <div className="space-y-5 self-start">
                <div className="overflow-hidden rounded-[32px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={name}
                      className="h-full min-h-[380px] w-full object-contain p-10"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex min-h-[380px] items-center justify-center px-6 text-center text-sm text-slate-500">
                      No artwork available for this item.
                    </div>
                  )}
                </div>
                <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status + Availability</div>
                    <WikiLink name={name} />
                  </div>
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    {allE?.isPrime && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-600/50 bg-amber-950/30 text-amber-300 font-semibold">
                        PRIME
                      </span>
                    )}
                    {allE && getPrimeAvailabilityStatus(`items:${allE.uniqueName}`, worldState) === "prime_resurgence" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-violet-700/50 bg-violet-950/30 text-violet-300 font-semibold">
                        PRIME RESURGENCE
                      </span>
                    )}
                    {allE && getPrimeAvailabilityStatus(`items:${allE.uniqueName}`, worldState) === "vaulted" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-700/50 bg-rose-950/30 text-rose-300 font-semibold">
                        VAULTED
                      </span>
                    )}
                    {allE?.tradable && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-600 bg-slate-800 text-slate-400">
                        Tradable
                      </span>
                    )}
                    {isOwned && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-700 bg-emerald-950/30 text-emerald-300">
                        Owned
                      </span>
                    )}
                    {isMastered && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-700 bg-cyan-950/30 text-cyan-300">
                        Mastered
                      </span>
                    )}
                    {weaponRecipeUses.length > 0 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded border border-amber-700 bg-amber-950/30 text-amber-300"
                        title={`Used to craft ${weaponRecipeUses.map((use) => use.outputName).join(", ")}`}
                      >
                        Weapon Ingredient
                      </span>
                    )}
                    <span
                      className={["text-xs font-semibold", availColor].join(
                        " ",
                      )}
                    >
                      {availLabel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.12fr)_380px]">

                <div className="space-y-5">
                  {/* Mastery / release / type */}
	                  <WorkspaceSection
	                    title="Overview"
	                    subtitle="Core identity, release context, and inventory-facing reference details."
	                    bodyClassName="grid grid-cols-2 gap-3"
	                  >
                    {(allE?.masteryReq ?? 0) > 0 && (
                      <StatBox
                        label="Mastery Required"
                        value={`MR ${allE!.masteryReq}`}
                      />
                    )}
                    {allE?.type && <StatBox label="Type" value={allE.type} />}
                    {allE?.releaseDate && (
                      <StatBox label="Released" value={formatReleaseDate(allE.releaseDate) ?? allE.releaseDate} />
                    )}
                    {allE?.introduced?.name && (
                      <StatBox
                        label="Introduced"
                        value={allE.introduced.name}
                      />
                    )}
                    {allE?.vaultDate && (
                      <StatBox
                        label="Vaulted"
                        value={allE.vaultDate}
                        color="text-rose-300"
                      />
                    )}
                    {isWeapon && allE?.slot !== undefined && (
                      <StatBox
                        label="Slot"
                        value={
                          allE.slot === 0
                            ? "Primary"
                            : allE.slot === 1
                              ? "Secondary"
                              : allE.slot === 2
                                ? "Melee"
                                : String(allE.slot)
                        }
                      />
                    )}
	                  </WorkspaceSection>

                  {/* Warframe stats */}
                  {(isFrame || isCompanion) && (
                    <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                      <Label>Base Stats</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {allE?.health && (
                          <StatBox label="Health" value={allE.health} />
                        )}
                        {allE?.shield && (
                          <StatBox label="Shield" value={allE.shield} />
                        )}
                        {allE?.armor && (
                          <StatBox label="Armor" value={allE.armor} />
                        )}
                        {allE?.power && (
                          <StatBox label="Energy" value={allE.power} />
                        )}
                        {allE?.sprintSpeed && (
                          <StatBox
                            label="Sprint"
                            value={allE.sprintSpeed.toFixed(2)}
                          />
                        )}
                        {allE?.stamina && (
                          <StatBox label="Stamina" value={allE.stamina} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Abilities */}
                  {isFrame && allE?.abilities && allE.abilities.length > 0 && (
                    <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                      <Label>Abilities</Label>
                      <div className="space-y-1.5">
                        {allE.abilities.map((ab, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] text-slate-600 font-mono">
                                {i + 1}
                              </span>
                              <span className="text-xs font-semibold text-slate-200">
                                {ab.name}
                              </span>
                              <WikiLink name={ab.name} />
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {renderDesc(ab.description)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Polarities */}
                  {(isFrame || isCompanion) &&
                    allE?.polarities &&
                    allE.polarities.length > 0 && (
                      <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                        <Label>Polarities</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {allE.polarities.map((p, i) => (
                            <span
                              key={i}
                              className="text-xs rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-300"
                            >
                              {POLARITY_LABELS[p] ?? p}
                            </span>
                          ))}
                          {allE.aura && (
                            <span className="text-xs rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-300">
                              Aura: {POLARITY_LABELS[allE.aura] ?? allE.aura}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Weapon stats */}
                  {isWeapon && (
                    <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                      <Label>Stats</Label>
                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                        {allE?.totalDamage && (
                          <StatBox
                            label="Total Damage"
                            value={allE.totalDamage}
                            color="text-orange-300"
                          />
                        )}
                        {allE?.criticalChance !== undefined && (
                          <StatBox
                            label="Crit Chance"
                            value={fmtPct(allE.criticalChance)}
                            color="text-yellow-300"
                          />
                        )}
                        {allE?.criticalMultiplier !== undefined && (
                          <StatBox
                            label="Crit Multiplier"
                            value={fmtMult(allE.criticalMultiplier)}
                            color="text-yellow-300"
                          />
                        )}
                        {allE?.procChance !== undefined && (
                          <StatBox
                            label="Status Chance"
                            value={fmtPct(allE.procChance)}
                          />
                        )}
                        {allE?.fireRate !== undefined && (
                          <StatBox
                            label={
                              cat === "Melee" ? "Attack Speed" : "Fire Rate"
                            }
                            value={allE.fireRate.toFixed(2)}
                          />
                        )}
                        {allE?.magazineSize && (
                          <StatBox label="Magazine" value={allE.magazineSize} />
                        )}
                        {allE?.reloadTime !== undefined && (
                          <StatBox
                            label="Reload"
                            value={`${allE.reloadTime.toFixed(1)}s`}
                          />
                        )}
                        {allE?.accuracy && (
                          <StatBox
                            label="Accuracy"
                            value={allE.accuracy.toFixed(1)}
                          />
                        )}
                        {allE?.multishot && allE.multishot > 1 && (
                          <StatBox label="Multishot" value={allE.multishot} />
                        )}
                        {allE?.noise && (
                          <StatBox label="Noise" value={allE.noise} />
                        )}
                        {allE?.trigger && (
                          <StatBox label="Trigger" value={allE.trigger} />
                        )}
                        {/* Melee specific */}
                        {allE?.range && (
                          <StatBox
                            label="Range"
                            value={`${allE.range.toFixed(1)}m`}
                          />
                        )}
                        {allE?.followThrough !== undefined && (
                          <StatBox
                            label="Follow Through"
                            value={fmtPct(allE.followThrough)}
                          />
                        )}
                        {allE?.comboDuration && (
                          <StatBox
                            label="Combo Duration"
                            value={`${allE.comboDuration}s`}
                          />
                        )}
                        {allE?.heavyAttackDamage && (
                          <StatBox
                            label="Heavy Attack"
                            value={allE.heavyAttackDamage}
                          />
                        )}
                        {allE?.slamAttack && (
                          <StatBox
                            label="Slam Attack"
                            value={allE.slamAttack}
                          />
                        )}
                        {allE?.slideAttack && (
                          <StatBox
                            label="Slide Attack"
                            value={allE.slideAttack}
                          />
                        )}
                        {allE?.stancePolarity && (
                          <StatBox
                            label="Stance Polarity"
                            value={
                              POLARITY_LABELS[allE.stancePolarity] ??
                              allE.stancePolarity
                            }
                          />
                        )}
                        {/* Riven disposition */}
                        {allE?.disposition !== undefined && (
                          <StatBox
                            label="Riven Disposition"
                            value={
                              DISPOSITION_DOTS[allE.disposition] ??
                              String(allE.disposition)
                            }
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Damage breakdown */}
                  {dmgTypes.length > 0 && (
                    <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                      <Label>Damage Breakdown</Label>
                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                        {dmgTypes.map(([type, val]) => (
                          <div
                            key={type}
                            className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-2 py-1"
                          >
                            <span className="text-[11px] text-slate-400 capitalize">
                              {type}
                            </span>
                            <span className="text-[11px] font-mono text-slate-200">
                              {val.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Access explanation */}
                  {avail !== "available" && (
                    <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                      <Label color={avail === "partial" ? "text-amber-400" : "text-rose-400"}>
                        {avail === "partial" ? "Why Access Is Partial" : "Why Access Is Blocked"}
                      </Label>
                      <p className={["mb-2 text-xs leading-relaxed", avail === "partial" ? "text-amber-200" : "text-rose-300"].join(" ")}>
                        {accessExplanation}
                      </p>
                      {blockingReasons.length > 0 && (
                      <ul className="space-y-1">
                        {blockingReasons.map((r, i) => (
                          <li
                            key={i}
                            className={["flex items-start gap-1 text-xs", avail === "partial" ? "text-amber-200" : "text-rose-300"].join(" ")}
                          >
                            <span className="mt-0.5 shrink-0">—</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="space-y-4">
                  {(matchedSellProtections.length > 0 || weaponRecipeUses.length > 0) && (
                    <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                      <Label>Sell Safety</Label>
                      <div className="space-y-2">
                        {matchedSellProtections.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {matchedSellProtections.map((key) => (
                              <span
                                key={key}
                                className="rounded-full border border-amber-800/50 bg-amber-950/30 px-2.5 py-1 text-xs text-amber-200"
                                title={SAFE_TO_SELL_PROTECTION_META[key].description}
                              >
                                {SAFE_TO_SELL_PROTECTION_META[key].label}
                              </span>
                            ))}
                          </div>
                        )}
                        {weaponRecipeUses.length > 0 && (
                          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
                            This weapon is used to craft: {weaponRecipeUses.map((use) => `${use.outputName}${use.count > 1 ? ` x${use.count}` : ""}`).join(", ")}.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                    <Label>Source Locations</Label>
                    {itemSourceEntries.length > 0 ? (
                      <GroupedSourceList entries={itemSourceEntries} maxHeightClassName="max-h-[24rem]" />
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-800/60 px-4 py-6 text-sm text-slate-500">
                        No drop data available.
                        <a
                          href={wikiUrl(name) + "#Acquisition"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
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
                          Wiki
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Build info */}
                  {(allE?.buildPrice || allE?.buildTime || allE?.bpCost) && (
                    <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5">
                      <Label>Build Requirements</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {allE.buildPrice && (
                          <StatBox
                            label="Credits"
                            value={allE.buildPrice.toLocaleString()}
                          />
                        )}
                        {allE.bpCost && allE.bpCost !== allE.buildPrice && (
                          <StatBox
                            label="Blueprint"
                            value={`${allE.bpCost.toLocaleString()} cr`}
                          />
                        )}
                        {allE.buildTime && (
                          <StatBox
                            label="Build Time"
                            value={fmtBuildTime(allE.buildTime)}
                          />
                        )}
                        {allE.buildQuantity && allE.buildQuantity > 1 && (
                          <StatBox
                            label="Quantity"
                            value={`×${allE.buildQuantity}`}
                          />
                        )}
                        {allE.consumeOnBuild !== undefined && (
                          <StatBox
                            label="Consumes BP"
                            value={allE.consumeOnBuild ? "Yes" : "No"}
                          />
                        )}
                      </div>
                    </div>
                  )}

                </div>
	                </div>
                <div className="rounded-[30px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-5 2xl:col-span-2">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Components</div>
                      <div className="mt-1 text-sm text-slate-400">Scan the crafting pieces up top, then inspect one shared acquisition panel below instead of parsing a mini source browser in every card.</div>
                    </div>
                  </div>
                  <div className="mt-5">
                      {componentModels.length > 0 ? (
                        <div className="space-y-5">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                            {componentModels.map((model) => {
                              const comp = model.component;
                              const isActive = activeComponent?.key === model.key;
                              return (
                                <button
                                  key={model.key}
                                  type="button"
                                  onClick={() => setSelectedComponentKey(model.key)}
                                  className={[
                                    "text-left rounded-[22px] border px-4 py-4 transition-colors",
                                    isActive
                                      ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] shadow-[0_0_0_1px_var(--wf-selection-border)]"
                                      : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] hover:border-[color:var(--wf-border-strong)] hover:bg-[color:var(--wf-hover)]",
                                  ].join(" ")}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-lg font-semibold text-slate-100">{comp.name}</span>
                                        {comp.itemCount && comp.itemCount > 1 ? (
                                          <span className="rounded-full border border-slate-700/70 bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                            ×{comp.itemCount}
                                          </span>
                                        ) : null}
                                        {comp.uniqueName && /\/Recipes\//.test(comp.uniqueName) ? (
                                          <a
                                            href={wikiUrl(name) + "#Acquisition"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`Find ${comp.name} on the ${name} wiki page`}
                                            onClick={(event) => event.stopPropagation()}
                                            className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
                                          >
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                              <polyline points="15 3 21 3 21 9" />
                                              <line x1="10" y1="14" x2="21" y2="3" />
                                            </svg>
                                          </a>
                                        ) : (
                                          <span onClick={(event) => event.stopPropagation()}>
                                            <WikiLink name={comp.name} />
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1 text-sm text-slate-500">
                                        {model.acquisitionCount > 0
                                          ? `${model.acquisitionCount} acquisition path${model.acquisitionCount === 1 ? "" : "s"}`
                                          : "No structured acquisition data"}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-4 border-t border-slate-800/60 pt-3">
                                    {model.catalogId ? (
                                      <div
                                        className="mb-3 flex items-center justify-between gap-3"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                          Owned
                                        </div>
                                        <div className="flex items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950/80">
                                          <button
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center text-base text-slate-400 transition hover:bg-slate-900 hover:text-slate-100 disabled:opacity-35"
                                            onClick={() => setCount(String(model.catalogId), Math.max(0, model.ownedCount - 1))}
                                            disabled={model.ownedCount <= 0}
                                            aria-label={`Decrease owned ${comp.name}`}
                                          >
                                            -
                                          </button>
                                          <div className="min-w-[3rem] px-3 text-center text-sm font-semibold text-slate-100">
                                            {model.ownedCount}
                                          </div>
                                          <button
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center text-base text-slate-400 transition hover:bg-slate-900 hover:text-slate-100"
                                            onClick={() => setCount(String(model.catalogId), model.ownedCount + 1)}
                                            aria-label={`Increase owned ${comp.name}`}
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                    <div className="text-[12px] leading-relaxed text-slate-400">
                                      {model.familySummary || "Wiki-only or unstructured source data"}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {activeComponent ? (
                            <div className="rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)]">
                              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/70 px-5 py-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-lg font-semibold text-slate-100">{activeComponent.component.name}</div>
                                    {activeComponent.component.itemCount && activeComponent.component.itemCount > 1 ? (
                                      <span className="rounded-full border border-slate-700/70 bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                        ×{activeComponent.component.itemCount}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-400">
                                    {activeComponent.acquisitionCount > 0
                                      ? `${activeComponent.acquisitionCount} acquisition path${activeComponent.acquisitionCount === 1 ? "" : "s"}`
                                      : "No structured acquisition data"}
                                  </div>
                                  {activeComponent.catalogId ? (
                                    <div className="mt-3 flex items-center gap-3">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Owned
                                      </div>
                                      <div className="flex items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950/80">
                                        <button
                                          type="button"
                                          className="flex h-8 w-8 items-center justify-center text-base text-slate-400 transition hover:bg-slate-900 hover:text-slate-100 disabled:opacity-35"
                                          onClick={() => setCount(String(activeComponent.catalogId), Math.max(0, activeComponent.ownedCount - 1))}
                                          disabled={activeComponent.ownedCount <= 0}
                                          aria-label={`Decrease owned ${activeComponent.component.name}`}
                                        >
                                          -
                                        </button>
                                        <div className="min-w-[3rem] px-3 text-center text-sm font-semibold text-slate-100">
                                          {activeComponent.ownedCount}
                                        </div>
                                        <button
                                          type="button"
                                          className="flex h-8 w-8 items-center justify-center text-base text-slate-400 transition hover:bg-slate-900 hover:text-slate-100"
                                          onClick={() => setCount(String(activeComponent.catalogId), activeComponent.ownedCount + 1)}
                                          aria-label={`Increase owned ${activeComponent.component.name}`}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="max-w-[32rem] text-right text-sm text-slate-500">
                                  {activeComponent.familySummary || "Wiki-only or unstructured source data"}
                                </div>
                              </div>
                              <div className="px-4 py-4">
                                {activeComponent.entries.length > 0 ? (
                                  <GroupedSourceList entries={activeComponent.entries} maxHeightClassName="max-h-[28rem]" />
                                ) : (
                                  <div className="rounded-[20px] border border-dashed border-slate-800/60 px-4 py-6 text-sm text-slate-500">
                                    No structured source data available for this component.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-slate-800/60 px-4 py-6 text-sm text-slate-500">
                          No component data available.
                        </div>
                      )}
                  </div>
                </div>
	              </div>
	
	              </div>
	              </div>
	              </div>
	            </div>
	          );
        })()
        : null}
    </div>
  );
}
