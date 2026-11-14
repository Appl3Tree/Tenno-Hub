// ===== FILE: src/domain/logic/requirementEngine.ts =====
// src/domain/logic/requirementEngine.ts

import type { CatalogId } from "../catalog/loadFullCatalog";
import { FULL_CATALOG } from "../catalog/loadFullCatalog";
import { getItemRequirements, resolveItemRequirementGraph } from "../../catalog/items/itemRequirements";
import {
    countUniqueSources,
    overlapSourceKey,
    groupBySource,
    type OverlapGroup
} from "./overlapEngine";

import type { SourceId } from "../ids/sourceIds";
import { SOURCE_INDEX } from "../../catalog/sources/sourceCatalog";
import { getAcquisitionByCatalogId } from "../../catalog/items/itemAcquisition";
import { evaluateSourcePrerequisiteAccess } from "./sourcePrerequisiteAccess";

import type { PrereqId } from "../ids/prereqIds";

import { PROGRESSION_ITEM_IDS } from "../../catalog/items/itemsIndex";
import { SYNDICATE_VENDOR_CATALOG } from "../catalog/syndicates/syndicateVendorCatalog";
import { getSyndicateDisplayName } from "../ids/syndicateIds";
import { getOwnedCountForCatalogId } from "../goals/catalogGoals";

const PROGRESSION_ITEM_ID_SET = new Set<CatalogId>(PROGRESSION_ITEM_IDS);

function getRecordPlatinumPrice(rec: any): number | null {
    const raw: any = rec?.raw as any;
    const rawLotus = raw?.rawLotus ?? null;
    const storeData = rawLotus?.storeData ?? null;
    const data = rawLotus?.data ?? raw?.data ?? null;

    const candidates = [
        storeData?.PremiumPrice,
        data?.PremiumPrice,
        raw?.marketCost,
    ];

    for (const candidate of candidates) {
        const value = Number(candidate ?? 0);
        if (Number.isFinite(value) && value > 0) return value;
    }

    return null;
}

function getPlatinumCost(catalogId: CatalogId): number | null {
    const rec = FULL_CATALOG.recordsById[catalogId];
    if (!rec) return null;
    // Prime items cannot be purchased from the market with platinum.
    const name = (rec.displayName ?? "").toLowerCase();
    if (name.endsWith(" prime") || name.includes(" prime ")) return null;
    return getRecordPlatinumPrice(rec);
}

export type RequirementViewMode = "targeted" | "overlap";

// Controls how goal requirements are expanded into component requirements.
// - "direct": only the immediate components for each goal are added.
// - "recursive": recursively expands crafted dependencies.
export type RequirementExpandMode = "direct" | "recursive";

// Controls which syndicate rank-up tiers are included in requirements.
// - "nextOnly": only the immediately next rank-up for each syndicate.
// - "allRemaining": all remaining rank-up tiers up to max rank.
export type SyndicateScopeMode = "nextOnly" | "allRemaining";

export type RequirementSource =
    | {
          type: "syndicate";
          id: string;
          name: string;
          label: string;
          need: number;
      }
    | {
          type: "goal";
          id: string;
          name: string;
          label: string;
          need: number;
      };

export type ItemRequirementLine = {
    key: CatalogId;
    name: string;
    totalNeed: number;
    have: number;
    remaining: number;
    sources: RequirementSource[];
    uniqueSourceCount: number;
};

export type CurrencyRequirementLine = {
    key: "credits" | "platinum";
    name: string;
    totalNeed: number;
    have: number;
    remaining: number;
    sources: RequirementSource[];
    uniqueSourceCount: number;
};

export type RequirementsResult = {
    itemLines: ItemRequirementLine[];
    currencyLines: CurrencyRequirementLine[];
    stats: {
        actionableItemCount: number;
        overlapItemCount: number;
        totalRemainingItems: number;
        totalRemainingCredits: number;
        totalRemainingPlatinum: number;
    };
};

type InventoryLike = {
    credits?: number;
    platinum?: number;
    counts?: Record<string, number>;
};

type GoalLike = {
    id: string;
    type: string;
    catalogId: string;
    qty: number;
    isActive: boolean;
};

function safeInt(v: unknown, fallback: number): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
}

/**
 * Looks up a CatalogId by display name using the FULL_CATALOG nameIndex.
 * Prefers "items:" source entries over other sources.
 * Returns null if no match is found.
 */
function lookupCatalogIdByDisplayName(displayName: string): CatalogId | null {
    const key = displayName.trim().toLowerCase();
    const ids = FULL_CATALOG.nameIndex[key];
    if (!ids || ids.length === 0) return null;
    const itemId = ids.find((id) => id.startsWith("items:"));
    return (itemId ?? ids[0]) as CatalogId;
}

function isExplicitBlueprintItem(catalogId: CatalogId, name: string): boolean {
    const cidStr = String(catalogId).toLowerCase();
    const nm = String(name ?? "").toLowerCase();
    if (nm.endsWith(" blueprint")) return true;
    if (cidStr.endsWith("blueprint")) return true;
    return false;
}

function isDirectMarketPurchasableOutput(catalogId: CatalogId): boolean {
    const rec = FULL_CATALOG.recordsById[catalogId];
    const raw: any = rec?.raw as any;
    const data = raw?.rawLotus?.data ?? raw?.data ?? null;
    if (!data || typeof data !== "object") return false;

    const regularPrice = Number((data as any).RegularPrice ?? 0);
    const premiumPrice = Number((data as any).PremiumPrice ?? 0);
    return (Number.isFinite(regularPrice) && regularPrice > 0) || (Number.isFinite(premiumPrice) && premiumPrice > 0);
}

type RequirementComponent = {
    catalogId: CatalogId;
    count: number;
};

function getDirectRequirementsForExpansion(catalogId: CatalogId): RequirementComponent[] {
    const rec = FULL_CATALOG.recordsById[catalogId];
    const name = rec?.displayName ?? String(catalogId);
    const resolution = resolveItemRequirementGraph(catalogId);

    // Critical fix:
    // If this is a craftable OUTPUT that has a sibling Blueprint record,
    // treat the OUTPUT as requiring the Blueprint (qty 1) and DO NOT also
    // treat the OUTPUT as directly requiring the Blueprint's ingredients.
    if (!isExplicitBlueprintItem(catalogId, name)) {
        const blueprintEdge = resolution.edges.find((edge) =>
            edge.provenance === "wfcd-output-blueprint" || edge.provenance === "derived-output-blueprint",
        );
        if (isDirectMarketPurchasableOutput(catalogId) && !blueprintEdge) return [];
        if (blueprintEdge) {
            return [{ catalogId: blueprintEdge.catalogId, count: blueprintEdge.count }];
        }
    }

    const comps = resolution.edges;
    if (!Array.isArray(comps) || comps.length === 0) return [];

    const out: RequirementComponent[] = [];
    for (const c of comps) {
        const cid = c.catalogId as CatalogId;
        const ct = Math.max(1, safeInt((c as any).count ?? 0, 0));
        out.push({ catalogId: cid, count: ct });
    }
    return out;
}

/**
 * IMPORTANT: This snapshot is "what you need", not "what is actionable".
 * It must NOT filter based on acquisition knowledge.
 * Actionability is handled by buildFarmingSnapshot().
 */
export function buildRequirementsSnapshot(args: {
    syndicates: any[];
    goals: GoalLike[];
    completedPrereqs: Record<string, boolean>;
    inventory: InventoryLike;
    expandMode?: RequirementExpandMode;
    syndicateScope?: SyndicateScopeMode;
}): RequirementsResult {
    const { syndicates, goals, inventory } = args;
    const expandMode: RequirementExpandMode = args.expandMode ?? "recursive";
    const syndicateScope: SyndicateScopeMode = args.syndicateScope ?? "nextOnly";

    const itemAgg: Record<
        string,
        {
            key: CatalogId;
            name: string;
            totalNeed: number;
            sources: RequirementSource[];
        }
    > = {};

    const currencyAgg: Record<
        "credits" | "platinum",
        {
            key: "credits" | "platinum";
            name: string;
            totalNeed: number;
            sources: RequirementSource[];
        }
    > = {
        credits: { key: "credits", name: "Credits", totalNeed: 0, sources: [] },
        platinum: { key: "platinum", name: "Platinum", totalNeed: 0, sources: [] }
    };

    function addItemNeed(catalogId: CatalogId, need: number, source: RequirementSource) {
        if (!FULL_CATALOG.recordsById[catalogId]) return;

        const rec = FULL_CATALOG.recordsById[catalogId];
        const name = rec?.displayName || String(catalogId);

        const mapKey = String(catalogId);
        if (!itemAgg[mapKey]) {
            itemAgg[mapKey] = { key: catalogId, name, totalNeed: 0, sources: [] };
        }

        itemAgg[mapKey].totalNeed += need;
        itemAgg[mapKey].sources.push(source);
    }

    function addCurrencyNeed(key: "credits" | "platinum", need: number, source: RequirementSource) {
        currencyAgg[key].totalNeed += need;
        currencyAgg[key].sources.push(source);
    }

    function addGoalWithRecursiveComponents(args2: {
        goal: GoalLike;
        rootCatalogId: CatalogId;
        rootQty: number;
        rootName: string;
    }): void {
        const { goal, rootCatalogId, rootQty, rootName } = args2;

        const visited = new Set<string>();
        const maxDepth = 25;

        function walk(catalogId: CatalogId, multiplier: number, depth: number): void {
            const k = String(catalogId);
            if (visited.has(k)) return;
            if (depth > maxDepth) return;

            visited.add(k);

            // Use the corrected "direct requirements" rule that prevents:
            // OUTPUT -> (ingredients of blueprint) AND OUTPUT -> Blueprint -> (ingredients)
            // which is what was blowing out Nano Spores and other materials.
            const comps = getDirectRequirementsForExpansion(catalogId);

            if (Array.isArray(comps) && comps.length > 0) {
                for (const c of comps) {
                    const cNeed = Math.max(1, safeInt(c.count ?? 0, 0)) * multiplier;
                    if (cNeed <= 0) continue;

                    const compId = c.catalogId as CatalogId;

                    addItemNeed(compId, cNeed, {
                        type: "goal",
                        id: goal.id,
                        name: rootName,
                        label: expandMode === "recursive" ? "Goal Component (Expanded)" : "Goal Component",
                        need: cNeed
                    });

                    // Only expand crafted dependencies in recursive mode.
                    if (expandMode === "recursive") {
                        walk(compId, cNeed, depth + 1);
                    }
                }
            }

            visited.delete(k);
        }

        addItemNeed(rootCatalogId, rootQty, {
            type: "goal",
            id: goal.id,
            name: rootName,
            label: "Goal",
            need: rootQty
        });

        walk(rootCatalogId, rootQty, 0);
    }

    for (const syn of syndicates ?? []) {
        const syndicateId = typeof syn?.id === "string" ? syn.id : "";
        const syndicateName = typeof syn?.name === "string" && syn.name
            ? syn.name
            : syndicateId ? getSyndicateDisplayName(syndicateId) : "Unknown Syndicate";

        // Look up rank-up ladder from vendor catalog instead of relying on syn.nextRankUp
        // (nextRankUp is never populated by the current store/profile import flow).
        const vendorEntry = SYNDICATE_VENDOR_CATALOG.find((v) => v.id === syndicateId);
        if (!vendorEntry || !Array.isArray(vendorEntry.rankUps) || vendorEntry.rankUps.length === 0) continue;

        const currentRank = typeof syn?.rank === "number" ? Math.floor(syn.rank) : 0;

        // Select which rank-up tiers to include based on scope.
        const ranksToProcess = syndicateScope === "allRemaining"
            ? vendorEntry.rankUps.filter((r) => r.rank > currentRank)
            : vendorEntry.rankUps.filter((r) => r.rank === currentRank + 1);

        if (ranksToProcess.length === 0) continue;

        for (const rankUpDef of ranksToProcess) {
            const rankTitle = `→ Rank ${rankUpDef.rank}`;

            for (const cost of rankUpDef.costs) {
                if (cost.kind === "credits") {
                    addCurrencyNeed("credits", cost.amount, {
                        type: "syndicate",
                        id: syndicateId,
                        name: syndicateName,
                        label: rankTitle,
                        need: cost.amount
                    });
                } else if (cost.kind === "item") {
                    const catalogId = lookupCatalogIdByDisplayName(cost.name);
                    if (!catalogId) continue;
                    const need = Math.max(1, safeInt(cost.qty, 0));
                    addItemNeed(catalogId, need, {
                        type: "syndicate",
                        id: syndicateId,
                        name: syndicateName,
                        label: rankTitle,
                        need
                    });
                }
                // Note: "standing", "currency", "other" cost kinds are not item/credit requirements
                // and are intentionally skipped here (standing is tracked separately in the syndicate engine).
            }
        }
    }

    for (const g of goals ?? []) {
        if (!g || g.isActive === false) continue;

        const cid = String(g.catalogId) as CatalogId;
        const qty = Math.max(1, safeInt(g.qty ?? 1, 1));

        const rec = FULL_CATALOG.recordsById[cid];
        const goalName = rec?.displayName || cid;

        if (g.type === "item") {
            addGoalWithRecursiveComponents({
                goal: g,
                rootCatalogId: cid,
                rootQty: qty,
                rootName: goalName
            });

            // Add platinum purchase cost if the item can be bought directly on the market.
            const platCost = getPlatinumCost(cid);
            if (platCost !== null) {
                addCurrencyNeed("platinum", platCost * qty, {
                    type: "goal",
                    id: g.id,
                    name: goalName,
                    label: "Purchase (Platinum)",
                    need: platCost * qty
                });
            }
        } else {
            addItemNeed(cid, qty, {
                type: "goal",
                id: g.id,
                name: goalName,
                label: g.type === "arcane" ? "Wanted Arcane" : "Wanted Mod",
                need: qty
            });
        }
    }

    const itemLines: ItemRequirementLine[] = Object.values(itemAgg)
        .map((agg) => {
            const have = getOwnedCountForCatalogId(agg.key, inventory);
            const remaining = Math.max(0, agg.totalNeed - have);

            const sources = [...agg.sources];
            sources.sort((a, b) => (b.need ?? 0) - (a.need ?? 0));

            const sourceKeys = sources.map((s) => overlapSourceKey(s.type, s.id, s.label));
            const uniqueSourceCount = countUniqueSources(sourceKeys);

            return {
                key: agg.key,
                name: agg.name,
                totalNeed: agg.totalNeed,
                have,
                remaining,
                sources,
                uniqueSourceCount
            };
        })
        .filter((l) => l.remaining > 0);

    itemLines.sort((a, b) => {
        if (a.remaining !== b.remaining) return b.remaining - a.remaining;
        return a.name.localeCompare(b.name);
    });

    const currencyLines: CurrencyRequirementLine[] = (["credits", "platinum"] as const)
        .map((k) => {
            const agg = currencyAgg[k];
            const have = k === "credits" ? safeInt(inventory?.credits ?? 0, 0) : safeInt(inventory?.platinum ?? 0, 0);
            const remaining = Math.max(0, agg.totalNeed - have);

            const sources = [...agg.sources];
            sources.sort((a, b) => (b.need ?? 0) - (a.need ?? 0));

            const sourceKeys = sources.map((s) => overlapSourceKey(s.type, s.id, s.label));
            const uniqueSourceCount = countUniqueSources(sourceKeys);

            return {
                key: k,
                name: agg.name,
                totalNeed: agg.totalNeed,
                have,
                remaining,
                sources,
                uniqueSourceCount
            };
        })
        .filter((l) => l.totalNeed > 0);

    const overlapItemCount = itemLines.filter((x) => x.uniqueSourceCount >= 2).length;

    const totalRemainingItems = itemLines.reduce((sum, x) => sum + x.remaining, 0);
    const totalRemainingCredits = currencyLines.find((x) => x.key === "credits")?.remaining ?? 0;
    const totalRemainingPlatinum = currencyLines.find((x) => x.key === "platinum")?.remaining ?? 0;

    return {
        itemLines,
        currencyLines,
        stats: {
            actionableItemCount: itemLines.length,
            overlapItemCount,
            totalRemainingItems,
            totalRemainingCredits,
            totalRemainingPlatinum
        }
    };
}

// ---------------- Farming (acquisition-based) ----------------

export type FarmingItemSource = {
    sourceId: SourceId;
    sourceLabel: string;
};

export type FarmingItemLine = {
    key: CatalogId;
    name: string;
    remaining: number;
    sources: FarmingItemSource[];
};

export type FarmingOverlapItem = {
    key: CatalogId;
    name: string;
    remaining: number;
};

export type FarmingSourceGroup = OverlapGroup<FarmingOverlapItem> & {
    itemCount: number;
    totalRemaining: number;
};

export type HiddenFarmingItem = {
    key: CatalogId;
    name: string;
    remaining: number;
    reason:
        | "out-of-scope"
        | "unknown-acquisition"
        | "unknown-recipe-acquisition"
        | "missing-prereqs"
        | "no-accessible-sources";
    missingPrereqs?: PrereqId[];
    blockedBySources?: SourceId[];
    blockedByRecipeComponents?: Array<{
        catalogId: CatalogId;
        name: string;
        reason:
            | "out-of-scope"
            | "unknown-acquisition"
            | "unknown-recipe-acquisition"
            | "missing-prereqs"
            | "no-accessible-sources";
    }>;
};

export type FarmingSnapshot = {
    targeted: FarmingItemLine[];
    overlap: FarmingSourceGroup[];
    hidden: HiddenFarmingItem[];
    stats: {
        actionableItemsWithKnownAcquisition: number;
        hiddenForOutOfScope: number;
        hiddenForUnknownAcquisition: number;
        hiddenForUnknownRecipeAcquisition: number;
        hiddenForMissingPrereqs: number;
        hiddenForNoAccessibleSources: number;
        overlapSourceCount: number;
    };
};

function isInProgressionScope(catalogId: CatalogId): boolean {
    if (!String(catalogId).startsWith("items:")) return false;
    return PROGRESSION_ITEM_ID_SET.has(catalogId);
}

function isDirectGoalFarmScope(catalogId: CatalogId): boolean {
    const raw = String(catalogId);
    if (raw.startsWith("mods:")) return true;
    return isInProgressionScope(catalogId);
}

function canAccessSource(sourceId: SourceId, completedPrereqs: Record<string, boolean>): boolean {
    const sidStr = String(sourceId);

    // "data:*" synthetic sources are allowed by default unless SOURCE_INDEX explicitly gates them.
    if (sidStr.startsWith("data:")) {
        const def = SOURCE_INDEX[sourceId];
        if (!def) return true;
        return evaluateSourcePrerequisiteAccess(sourceId, completedPrereqs).accessible;
    }

    // Curated sources: fail-closed if missing from SOURCE_INDEX.
    const def = SOURCE_INDEX[sourceId];
    if (!def) return false;

    return evaluateSourcePrerequisiteAccess(sourceId, completedPrereqs).accessible;
}

function getMissingPrereqsForSources(args: {
    sourceIds: SourceId[];
    completedPrereqs: Record<string, boolean>;
}): { missingPrereqs: PrereqId[]; blockedBySources: SourceId[]; hasUncuratedGate: boolean } {
    const { sourceIds, completedPrereqs } = args;

    const missing = new Set<PrereqId>();
    const blockedSources: SourceId[] = [];
    let hasUncuratedGate = false;

    for (const sid of sourceIds) {
        const sidStr = String(sid);

        // Synthetic sources ("data:*") do NOT count as uncurated gates when missing from SOURCE_INDEX.
        // If SOURCE_INDEX defines them, we respect prereqIds.
        if (sidStr.startsWith("data:")) {
            const def = SOURCE_INDEX[sid];
            if (!def) continue;

            const access = evaluateSourcePrerequisiteAccess(sid, completedPrereqs);
            const thisSourceBlocked = !access.accessible;
            access.missingPrereqs.forEach((pr) => missing.add(pr as PrereqId));

            if (thisSourceBlocked) {
                blockedSources.push(sid);
            }

            continue;
        }

        // Curated sources: missing SOURCE_INDEX entry is an uncurated gate.
        const def = SOURCE_INDEX[sid];
        if (!def) {
            hasUncuratedGate = true;
            blockedSources.push(sid);
            continue;
        }

        const access = evaluateSourcePrerequisiteAccess(sid, completedPrereqs);
        const thisSourceBlocked = !access.accessible;
        access.missingPrereqs.forEach((pr) => missing.add(pr as PrereqId));

        if (thisSourceBlocked) {
            blockedSources.push(sid);
        }
    }

    return {
        missingPrereqs: Array.from(missing),
        blockedBySources: blockedSources,
        hasUncuratedGate
    };
}

function getAcquisitionSourcesForCatalogId(catalogId: CatalogId): SourceId[] | null {
    const def = getAcquisitionByCatalogId(catalogId);
    if (!def || !Array.isArray(def.sources) || def.sources.length === 0) return null;
    return def.sources as SourceId[];
}

function isIngredientLikeCatalogItem(catalogId: CatalogId): boolean {
    const cidStr = String(catalogId);

    if (cidStr.includes(":/Lotus/Types/Items/")) return true;

    const rec = FULL_CATALOG.recordsById[catalogId];
    const path = String(rec?.path ?? "");

    if (path.startsWith("/Lotus/Types/Items/")) return true;

    const rawType = typeof (rec as any)?.raw?.type === "string" ? String((rec as any).raw.type).toLowerCase() : "";
    if (rawType === "resource") return true;

    return false;
}

function isRecipeCatalogItem(catalogId: CatalogId): boolean {
    const cidStr = String(catalogId);

    if (cidStr.includes(":/Lotus/Types/Recipes/")) return true;

    const rec = FULL_CATALOG.recordsById[catalogId];
    const path = String(rec?.path ?? "");
    return path.startsWith("/Lotus/Types/Recipes/");
}

function isExplicitBlueprintItem2(catalogId: CatalogId, name: string): boolean {
    const cidStr = String(catalogId).toLowerCase();
    const nm = String(name ?? "").toLowerCase();

    if (nm.endsWith(" blueprint")) return true;
    if (cidStr.endsWith("blueprint")) return true;

    return false;
}

function isBlueprintLikeCatalogItem(catalogId: CatalogId, name: string): boolean {
    // IMPORTANT:
    // Do NOT treat all /Lotus/Types/Recipes/* items as blueprints.
    // Many real “part items” live under /Recipes/Weapons/WeaponParts/* and should be acquired (drops/invasions/etc),
    // not classified as “unknown-recipe-acquisition”.
    return isExplicitBlueprintItem2(catalogId, name);
}

type AcquireAnalysis =
    | {
          kind: "ok";
          sources: FarmingItemSource[];
      }
    | {
          kind: "hidden";
          hidden: HiddenFarmingItem;
      };

function analyzeCatalogIdForFarming(args: {
    catalogId: CatalogId;
    name: string;
    remaining: number;
    completedPrereqs: Record<string, boolean>;
    visited: Set<string>;
    depth: number;
}): AcquireAnalysis {
    const { catalogId, name, remaining, completedPrereqs, visited, depth } = args;

    const BLUEPRINT_UNCLASSIFIED = "data:blueprint/unclassified" as SourceId;

    // Scope gate:
    // - At depth 0 (the items we show to the user as farm targets), enforce progression scope strictly.
    // - At depth > 0, components are handled by ingredient/blueprint guards and recipe expansion.
    if (depth === 0 && !isDirectGoalFarmScope(catalogId)) {
        return {
            kind: "hidden",
            hidden: { key: catalogId, name, remaining, reason: "out-of-scope" }
        };
    }

    if (depth > 0 && isIngredientLikeCatalogItem(catalogId)) {
        return { kind: "ok", sources: [] };
    }

    const visitKey = String(catalogId);
    if (visited.has(visitKey)) {
        return {
            kind: "hidden",
            hidden: { key: catalogId, name, remaining, reason: "unknown-acquisition" }
        };
    }

    if (depth > 25) {
        return {
            kind: "hidden",
            hidden: { key: catalogId, name, remaining, reason: "unknown-acquisition" }
        };
    }

    let directSources = getAcquisitionSourcesForCatalogId(catalogId);

    // Placeholder-only acquisition is actionable ONLY for explicit blueprint items.
    if (directSources && directSources.length > 0) {
        const onlyPlaceholder = directSources.length === 1 && directSources[0] === BLUEPRINT_UNCLASSIFIED;
        if (onlyPlaceholder && !isExplicitBlueprintItem2(catalogId, name)) {
            directSources = null;
        }
    }

    if (directSources && directSources.length > 0) {
        // Placeholder must NEVER short-circuit real sources.
        // If real sources exist, strip the placeholder before any further analysis.
        const realSources = directSources.filter((sid) => sid !== BLUEPRINT_UNCLASSIFIED);

        // If the only source is the placeholder, it is actionable only for explicit blueprint items.
        if (realSources.length === 0) {
            return {
                kind: "ok",
                sources: directSources.map((sid) => ({
                    sourceId: sid,
                    sourceLabel: SOURCE_INDEX[sid]?.label ?? String(sid)
                }))
            };
        }

        const accessible = realSources
            .filter((sid) => canAccessSource(sid, completedPrereqs))
            .map((sid) => ({
                sourceId: sid,
                sourceLabel: SOURCE_INDEX[sid]?.label ?? String(sid)
            }));

        if (accessible.length > 0) {
            return { kind: "ok", sources: accessible };
        }

        const comps = getItemRequirements(catalogId);
        if (!Array.isArray(comps) || comps.length === 0) {
            const diag = getMissingPrereqsForSources({ sourceIds: realSources, completedPrereqs });

            const inferredReason: HiddenFarmingItem["reason"] =
                diag.missingPrereqs.length > 0
                    ? "missing-prereqs"
                    : diag.hasUncuratedGate
                        ? "unknown-acquisition"
                        : "no-accessible-sources";

            return {
                kind: "hidden",
                hidden: {
                    key: catalogId,
                    name,
                    remaining,
                    reason: inferredReason,
                    missingPrereqs: diag.missingPrereqs,
                    blockedBySources: diag.blockedBySources
                }
            };
        }
    }

    if (isBlueprintLikeCatalogItem(catalogId, name)) {
        return {
            kind: "hidden",
            hidden: { key: catalogId, name, remaining, reason: "unknown-recipe-acquisition" }
        };
    }

    const recipe = getItemRequirements(catalogId);
    const hasRecipe = Array.isArray(recipe) && recipe.length > 0;

    // Deterministic crafted-output rule (guarded):
    // Only classify as Foundry crafting if we can prove the item has a recipe (ingredients).
    // If it has no recipe and no acquisition, we must not lie by labeling it “crafting”.
    if (hasRecipe && isRecipeCatalogItem(catalogId) && !isExplicitBlueprintItem2(catalogId, name)) {
        return {
            kind: "ok",
            sources: [
                {
                    sourceId: "data:crafting" as SourceId,
                    sourceLabel: "Crafting (Foundry)"
                }
            ]
        };
    }

    if (!hasRecipe) {
        return {
            kind: "hidden",
            hidden: { key: catalogId, name, remaining, reason: "unknown-acquisition" }
        };
    }

    visited.add(visitKey);

    const missingPrereqs = new Set<PrereqId>();
    let anyNoAccessibleSources = false;

    const blockedByRecipeComponents: HiddenFarmingItem["blockedByRecipeComponents"] = [];

    for (const c of recipe) {
        const compId = c.catalogId as CatalogId;
        const compRec = FULL_CATALOG.recordsById[compId];
        const compName = compRec?.displayName ?? String(compId);

        if (isIngredientLikeCatalogItem(compId) || isBlueprintLikeCatalogItem(compId, compName)) {
            continue;
        }

        const r = analyzeCatalogIdForFarming({
            catalogId: compId,
            name: compName,
            remaining: 1,
            completedPrereqs,
            visited,
            depth: depth + 1
        });

        if (r.kind === "ok") continue;

        const reason = r.hidden.reason;

        blockedByRecipeComponents.push({
            catalogId: compId,
            name: compName,
            reason
        });

        if (reason === "missing-prereqs") {
            for (const p of r.hidden.missingPrereqs ?? []) {
                missingPrereqs.add(p);
            }
        } else if (reason === "no-accessible-sources") {
            anyNoAccessibleSources = true;
        }
    }

    visited.delete(visitKey);

    if ((blockedByRecipeComponents ?? []).some((x) => x.reason === "out-of-scope")) {
        return {
            kind: "hidden",
            hidden: {
                key: catalogId,
                name,
                remaining,
                reason: "out-of-scope",
                blockedByRecipeComponents
            }
        };
    }

    if ((blockedByRecipeComponents ?? []).some((x) => x.reason === "unknown-acquisition")) {
        return {
            kind: "hidden",
            hidden: {
                key: catalogId,
                name,
                remaining,
                reason: "unknown-acquisition",
                blockedByRecipeComponents
            }
        };
    }

    if ((blockedByRecipeComponents ?? []).some((x) => x.reason === "unknown-recipe-acquisition")) {
        return {
            kind: "hidden",
            hidden: {
                key: catalogId,
                name,
                remaining,
                reason: "unknown-recipe-acquisition",
                blockedByRecipeComponents
            }
        };
    }

    if (missingPrereqs.size > 0) {
        return {
            kind: "hidden",
            hidden: {
                key: catalogId,
                name,
                remaining,
                reason: "missing-prereqs",
                missingPrereqs: Array.from(missingPrereqs),
                blockedByRecipeComponents
            }
        };
    }

    if (anyNoAccessibleSources) {
        return {
            kind: "hidden",
            hidden: {
                key: catalogId,
                name,
                remaining,
                reason: "no-accessible-sources",
                blockedByRecipeComponents
            }
        };
    }

    return {
        kind: "ok",
        sources: [
            {
                sourceId: "data:crafting" as SourceId,
                sourceLabel: "Crafting (Foundry)"
            }
        ]
    };
}

/**
 * Returns true if a source represents an actual farmable location (mission node,
 * drop table, open-world, etc.) that is meaningful for overlap grouping.
 *
 * Excludes:
 * - Crafting (Foundry) — everyone knows they need to build things; it's not an overlap "spot"
 * - Market / store / vendor / platinum-purchase sources — not farmable in-mission
 */
export function isFarmableOverlapSource(sourceId: string): boolean {
    const sid = String(sourceId).toLowerCase();
    if (sid === "data:crafting") return false;
    if (sid.startsWith("src:market") || sid.startsWith("data:market")) return false;
    if (sid.startsWith("src:store") || sid.startsWith("data:store")) return false;
    if (sid.startsWith("src:vendor") || sid.startsWith("data:vendor")) return false;
    if (sid === "data:blueprint/unclassified") return false;
    return true;
}

export function buildFarmingSnapshot(args: {
    requirements: RequirementsResult;
    completedPrereqs: Record<string, boolean>;
}): FarmingSnapshot {
    const { requirements, completedPrereqs } = args;

    const targeted: FarmingItemLine[] = [];
    const hidden: HiddenFarmingItem[] = [];

    for (const line of requirements.itemLines) {
        const analysis = analyzeCatalogIdForFarming({
            catalogId: line.key,
            name: line.name,
            remaining: line.remaining,
            completedPrereqs,
            visited: new Set<string>(),
            depth: 0
        });

        if (analysis.kind === "ok") {
            targeted.push({
                key: line.key,
                name: line.name,
                remaining: line.remaining,
                sources: analysis.sources
            });
        } else {
            hidden.push(analysis.hidden);
        }
    }

    targeted.sort((a, b) => {
        if (a.remaining !== b.remaining) return b.remaining - a.remaining;
        return a.name.localeCompare(b.name);
    });

    hidden.sort((a, b) => {
        if (a.reason !== b.reason) return a.reason.localeCompare(b.reason);
        if (a.remaining !== b.remaining) return b.remaining - a.remaining;
        return a.name.localeCompare(b.name);
    });

    const overlapInputs: Array<{ sourceId: string; sourceLabel: string; item: FarmingOverlapItem }> = [];

    for (const l of targeted) {
        for (const s of l.sources) {
            if (!s?.sourceId) continue;
            // Only include actual farmable locations in overlap groupings.
            // Crafting, market, vendor sources are excluded — they aren't mission "spots" worth grouping.
            if (!isFarmableOverlapSource(String(s.sourceId))) continue;
            overlapInputs.push({
                sourceId: String(s.sourceId),
                sourceLabel: s.sourceLabel,
                item: { key: l.key, name: l.name, remaining: l.remaining }
            });
        }
    }

    const rawGroups = groupBySource({ items: overlapInputs });

    const overlap: FarmingSourceGroup[] = rawGroups
        .map((g) => {
            const uniq = new Map<string, FarmingOverlapItem>();
            for (const it of g.items) {
                uniq.set(String(it.key), it);
            }

            const items = Array.from(uniq.values());
            items.sort((a, b) => {
                if (a.remaining !== b.remaining) return b.remaining - a.remaining;
                return a.name.localeCompare(b.name);
            });

            return {
                sourceId: g.sourceId,
                sourceLabel: g.sourceLabel,
                items,
                itemCount: items.length,
                totalRemaining: items.reduce((sum, x) => sum + Math.max(0, Math.floor(x.remaining ?? 0)), 0)
            };
        })
        .filter((g) => g.itemCount >= 2)
        .sort((a, b) => {
            if (a.itemCount !== b.itemCount) return b.itemCount - a.itemCount;
            if (a.totalRemaining !== b.totalRemaining) return b.totalRemaining - a.totalRemaining;
            return a.sourceLabel.localeCompare(b.sourceLabel);
        });

    const hiddenForOutOfScope = hidden.filter((h) => h.reason === "out-of-scope").length;
    const hiddenForUnknownAcquisition = hidden.filter((h) => h.reason === "unknown-acquisition").length;
    const hiddenForUnknownRecipeAcquisition = hidden.filter((h) => h.reason === "unknown-recipe-acquisition").length;
    const hiddenForMissingPrereqs = hidden.filter((h) => h.reason === "missing-prereqs").length;
    const hiddenForNoAccessibleSources = hidden.filter((h) => h.reason === "no-accessible-sources").length;

    return {
        targeted,
        overlap,
        hidden,
        stats: {
            actionableItemsWithKnownAcquisition: targeted.length,
            hiddenForOutOfScope,
            hiddenForUnknownAcquisition,
            hiddenForUnknownRecipeAcquisition,
            hiddenForMissingPrereqs,
            hiddenForNoAccessibleSources,
            overlapSourceCount: overlap.length
        }
    };
}
