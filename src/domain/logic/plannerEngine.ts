// ===== FILE: src/domain/logic/plannerEngine.ts =====

import { PR } from "../ids/prereqIds";
import type { PrereqId } from "../ids/prereqIds";
import { PREREQ_REGISTRY } from "../../catalog/prereqs/prereqRegistry";
import { computeUnlockGraphSnapshot, describeUnlockNodeMissingLabels } from "./unlockGraph";
import { computeMilestones } from "./milestoneEngine";
import type { PrereqEvaluationContext } from "./prereqEngine";
import { isAutoTrackedPrereq } from "./syndicatePrereqs";

import { FULL_CATALOG, type CatalogId } from "../catalog/loadFullCatalog";
import { SOURCE_INDEX } from "../../catalog/sources/sourceCatalog";
import { getAcquisitionByCatalogId } from "../../catalog/items/itemAcquisition";
import type { SourceId } from "../ids/sourceIds";
import { normalizeSourceId } from "../ids/sourceIds";

import {
    PROGRESSION_ITEM_IDS,
    findItemIdsByDisplayName
} from "../../catalog/items/itemsIndex";

const PROGRESSION_ITEM_ID_SET = new Set<CatalogId>(PROGRESSION_ITEM_IDS);

export interface ProgressionStep {
    id: string;
    prereqId: PrereqId;

    title: string;
    description: string;

    blocked: boolean;
    missingPrereqs: PrereqId[];
    missingLabels: string[];

    tags: string[];
}

export interface ProgressionPlan {
    steps: ProgressionStep[];
}

/**
 * HARD INVARIANT:
 * - “Next steps” must never be empty unless everything is completed.
 */
export function buildProgressionPlan(
    completedMap: Record<string, boolean>,
    context: PrereqEvaluationContext = {},
): ProgressionPlan {
    const snap = computeUnlockGraphSnapshot(completedMap, PREREQ_REGISTRY, context);
    const milestones = computeMilestones({ completedPrereqs: completedMap });

    const milestoneIds = new Set(milestones.map((m) => m.id));
    const steps: ProgressionStep[] = [];

    function defById(id: PrereqId) {
        return snap.index[id];
    }

    function rankOf(id: PrereqId): number {
        const v = snap.rankById?.[id];
        return Number.isFinite(v) ? (v as number) : 1_000_000;
    }

    function makeStep(id: PrereqId, tag: string): ProgressionStep {
        const def = defById(id);
        const st = snap.byId[id];
        const isMilestone = milestoneIds.has(id);

        if (!def) {
            return {
                id: `unknown_${id}`,
                prereqId: id,
                title: `Unknown prerequisite: ${id}`,
                description:
                    "This prerequisite is referenced but not defined in the registry.",
                blocked: false,
                missingPrereqs: st ? [...st.missing, ...st.missingAnyPrerequisites] : [],
                missingLabels: st ? describeUnlockNodeMissingLabels(st, snap.index) : [],
                tags: ["Unlock", "Unknown", tag]
            };
        }

        return {
            id: `unlock_${def.id}`,
            prereqId: def.id,
            title: def.label,
            description: def.description,
            blocked: st ? !st.unlocked : false,
            missingPrereqs: st ? [...st.missing, ...st.missingAnyPrerequisites] : [],
            missingLabels: st ? describeUnlockNodeMissingLabels(st, snap.index) : [],
            tags: [
                "Unlock",
                def.category,
                isMilestone ? "Milestone" : "Leaf",
                tag
            ]
        };
    }

    function makeConditionBlockedStep(id: PrereqId): ProgressionStep {
        const def = defById(id);
        const st = snap.byId[id];
        return {
            id: `condition_${id}`,
            prereqId: id,
            title: def?.label ?? `Progression requirement: ${id}`,
            description: def?.description ?? "Complete the displayed requirement to unlock this progression step.",
            blocked: true,
            missingPrereqs: st ? [...st.missing, ...st.missingAnyPrerequisites] : [],
            missingLabels: st ? describeUnlockNodeMissingLabels(st, snap.index) : [],
            tags: ["Unlock", ...(def ? [def.category] : []), "Blocked", "Condition"],
        };
    }

    const actionable = snap.actionable
        .map((s) => s.id)
        // Exclude leaf nodes explicitly marked as not relevant to the planner.
        // These still appear in the Prerequisites page; they just aren't "next steps".
        .filter((id) => snap.index[id]?.showInPlanner !== false)
        .sort((a, b) => {
            const aIsMilestone = milestoneIds.has(a);
            const bIsMilestone = milestoneIds.has(b);
            if (aIsMilestone !== bIsMilestone) {
                return aIsMilestone ? -1 : 1;
            }

            // Availability ordering (earlier depth first)
            const ra = rankOf(a);
            const rb = rankOf(b);
            if (ra !== rb) return ra - rb;

            return a.localeCompare(b);
        });

    const manualActionable = actionable.filter((id) => !isAutoTrackedPrereq(id));
    const autoActionable = actionable.filter((id) => isAutoTrackedPrereq(id));

    for (const id of manualActionable) {
        steps.push(makeStep(id, "Frontier"));
    }

    if (steps.length > 0) {
        return { steps };
    }

    const blocked = snap.blocked
        .filter((s) => !s.completed)
        .map((status) => ({
            status,
            missingCount: status.missing.length
                + (status.missingAnyPrerequisites.length > 0 ? 1 : 0)
                + status.missingConditions.length,
        }))
        .filter((x) => x.missingCount > 0);

    if (blocked.length > 0) {
        let minMissing = Infinity;
        for (const b of blocked) {
            minMissing = Math.min(minMissing, b.missingCount);
        }

        const closest = blocked.filter((b) => b.missingCount === minMissing);
        const nextIds = new Set<PrereqId>();
        const conditionBlockedIds = new Set<PrereqId>();

        for (const c of closest) {
            const status = c.status;
            for (const m of status.missing) {
                if (completedMap[String(m)] !== true) nextIds.add(String(m) as PrereqId);
            }
            for (const alternative of status.missingAnyPrerequisites) {
                if (completedMap[String(alternative)] !== true) nextIds.add(String(alternative) as PrereqId);
            }
            for (const condition of status.missingConditions) {
                if (condition.type === "quest_complete") {
                    nextIds.add(condition.prereqId);
                } else if (condition.type === "junction_complete") {
                    nextIds.add(condition.junctionId as PrereqId);
                } else {
                    conditionBlockedIds.add(status.id);
                }
            }
        }

        const nextSteps = [
            ...Array.from(nextIds)
            .sort((a, b) => {
                const aAuto = isAutoTrackedPrereq(a);
                const bAuto = isAutoTrackedPrereq(b);
                if (aAuto !== bAuto) return aAuto ? 1 : -1;

                const aIsMilestone = milestoneIds.has(a);
                const bIsMilestone = milestoneIds.has(b);
                if (aIsMilestone !== bIsMilestone) {
                    return aIsMilestone ? -1 : 1;
                }

                const ra = rankOf(a);
                const rb = rankOf(b);
                if (ra !== rb) return ra - rb;

                return a.localeCompare(b);
            })
            .map((id) => makeStep(id, "Closest Missing")),
            ...Array.from(conditionBlockedIds)
                .sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b))
                .map((id) => makeConditionBlockedStep(id)),
        ];

        if (nextSteps.length > 0) {
            return { steps: nextSteps };
        }
    }

    if (autoActionable.length > 0) {
        return { steps: autoActionable.map((id) => makeStep(id, "Frontier")) };
    }

    const anyIncomplete = snap.statuses
        .filter((s) => !s.completed)
        .map((s) => s.id)
        .sort((a, b) => {
            const ra = rankOf(a);
            const rb = rankOf(b);
            if (ra !== rb) return ra - rb;
            return a.localeCompare(b);
        });

    if (anyIncomplete.length > 0) {
        return {
            steps: [makeStep(anyIncomplete[0] as PrereqId, "Fallback")]
        };
    }

    return {
        steps: [
            {
                id: "planner_error_no_steps",
                prereqId: PR.VORS_PRIZE as PrereqId,
                title: "Planner configuration issue",
                description:
                    "No next steps could be computed. Check prereq registry integrity.",
                blocked: false,
                missingPrereqs: [],
                missingLabels: [],
                tags: ["Error"]
            }
        ]
    };
}

/* ---------- Item access logic ---------- */

export interface ItemAccessResult {
    allowed: boolean;
    missingPrereqs: PrereqId[];

    // Only present when MR is actually required and not met.
    // This should NOT be shown as a standalone “goal” unless it blocks the user’s target.
    missingMr: number | null;

    reasons: string[];
}

function normalizeMr(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
}

function isSourceAccessible(
    sourceId: SourceId,
    completedMap: Record<string, boolean>,
    masteryRank?: number | null
): { ok: boolean; missing: PrereqId[]; missingMr: number | null; reason?: string } {
    const sidStr = String(sourceId);

    {
        // Drop-table sources are actionable locations by default.
        if (sidStr.startsWith("data:drop:")) {
            return { ok: true, missing: [], missingMr: null };
        }

        const src = SOURCE_INDEX[sourceId];
        if (!src) {
            return { ok: false, missing: [], missingMr: null, reason: `Unknown source (${sourceId})` };
        }

        const prereqs = Array.isArray(src.prereqIds) ? (src.prereqIds as PrereqId[]) : [];

        // Explicit “unknown” placeholder should never be considered accessible.
        if (sidStr === "data:unknown" || sidStr === "src:unknown") {
            return { ok: false, missing: [], missingMr: null, reason: "Unknown source placeholder" };
        }

        const missing: PrereqId[] = [];
        for (const p of prereqs) {
            if (completedMap[String(p)] !== true) missing.push(p);
        }

        const mrReq =
            typeof (src as any).mrRequired === "number"
                ? Math.max(0, Math.floor((src as any).mrRequired))
                : null;

        const mrNow = normalizeMr(masteryRank);
        const missingMr = mrReq !== null && (mrNow === null || mrNow < mrReq) ? mrReq : null;

        const ok = missing.length === 0 && missingMr === null;

        if (ok) {
            return { ok: true, missing: [], missingMr: null };
        }

        const parts: string[] = [];
        if (missing.length) parts.push(`Requires: ${missing.join(", ")}`);
        if (missingMr !== null) parts.push(`Requires Mastery Rank ${missingMr}`);

        return {
            ok: false,
            missing,
            missingMr,
            reason: parts.join(" | ") || "Inaccessible"
        };
    }
}

function isInProgressionScope(catalogId: CatalogId): boolean {
    // Current scope is explicitly "inventory-real items only".
    // If scope expands later, it should be changed at the itemsIndex boundary.
    if (!String(catalogId).startsWith("items:")) return false;
    return PROGRESSION_ITEM_ID_SET.has(catalogId);
}

export function canAccessCatalogItem(
    catalogId: CatalogId,
    completedMap: Record<string, boolean>,
    masteryRank?: number | null
): ItemAccessResult {
    // Scope gate: planner/requirements must never treat out-of-scope catalog records as progression-valid.
    if (!isInProgressionScope(catalogId)) {
        return {
            allowed: false,
            missingPrereqs: [],
            missingMr: null,
            reasons: ["Out of scope (not inventory-real / progression-valid)."]
        };
    }

    const rec = FULL_CATALOG.recordsById[catalogId];
    if (!rec?.displayName) {
        return {
            allowed: false,
            missingPrereqs: [],
            missingMr: null,
            reasons: ["Unknown catalog record."]
        };
    }

    const acq = getAcquisitionByCatalogId(catalogId);
    if (!acq) {
        return {
            allowed: false,
            missingPrereqs: [],
            missingMr: null,
            reasons: ["Acquisition mapping missing."]
        };
    }

    const missing = new Set<PrereqId>();
    const reasons: string[] = [];
    let maxMissingMr: number | null = null;

    // IMPORTANT:
    // - Acquisition layers return string SourceIds.
    // - Access checks require branded SourceId and must fail-closed if invalid.
    for (const rawSource of (acq.sources ?? [])) {
        let s: SourceId;
        try {
            s = normalizeSourceId(String(rawSource));
        } catch {
            reasons.push(`Invalid source id: ${String(rawSource)}`);
            continue;
        }

        const check = isSourceAccessible(s, completedMap, masteryRank);
        if (check.ok) return { allowed: true, missingPrereqs: [], missingMr: null, reasons: [] };

        check.missing.forEach((m) => missing.add(m));
        if (check.missingMr !== null) {
            maxMissingMr = maxMissingMr === null ? check.missingMr : Math.max(maxMissingMr, check.missingMr);
        }
        reasons.push(check.reason ?? `${String(s)}: inaccessible`);
    }

    return {
        allowed: false,
        missingPrereqs: Array.from(missing),
        missingMr: maxMissingMr,
        reasons
    };
}

export function canAccessItemByName(
    itemName: string,
    completedMap: Record<string, boolean>,
    masteryRank?: number | null
): ItemAccessResult {
    const matches = findItemIdsByDisplayName(String(itemName ?? ""));
    const cid = matches[0] as CatalogId | undefined;

    if (!cid) {
        return {
            allowed: false,
            missingPrereqs: [],
            missingMr: null,
            reasons: ["No catalog match."]
        };
    }

    return canAccessCatalogItem(cid, completedMap, masteryRank);
}

/* ---------- 3.4 Availability Determination ---------- */

export type ItemAvailability = "available" | "partial" | "blocked";

/**
 * Determines item availability by checking each acquisition source individually.
 * - "available": at least one source is fully accessible now
 * - "partial": item has acquisition sources, but all are locked (some by prereqs, some by MR)
 *   AND the item is partially crafted (some components owned) — or more sources exist than accessible ones
 * - "blocked": no sources accessible AND no partial progress
 */
export function determineItemAvailability(
    catalogId: CatalogId,
    completedMap: Record<string, boolean>,
    masteryRank?: number | null
): ItemAvailability {
    if (!isInProgressionScope(catalogId)) return "blocked";

    const acq = getAcquisitionByCatalogId(catalogId);
    if (!acq || !Array.isArray(acq.sources) || acq.sources.length === 0) return "blocked";

    let accessibleCount = 0;
    let totalChecked = 0;

    for (const rawSource of acq.sources) {
        let s: SourceId;
        try {
            s = normalizeSourceId(String(rawSource));
        } catch {
            continue;
        }
        totalChecked++;
        const check = isSourceAccessible(s, completedMap, masteryRank);
        if (check.ok) accessibleCount++;
    }

    if (totalChecked === 0) return "blocked";
    if (accessibleCount === 0) return "blocked";
    if (accessibleCount < totalChecked) return "partial";
    return "available";
}

/* ---------- 3.5 Blocking Reason Engine ---------- */

/**
 * Returns human-readable blocking reasons for why an item cannot be accessed.
 * Returns an empty array if the item is accessible.
 */
export function getBlockingReasons(
    catalogId: CatalogId,
    completedMap: Record<string, boolean>,
    masteryRank?: number | null
): string[] {
    const result = canAccessCatalogItem(catalogId, completedMap, masteryRank);
    if (result.allowed) return [];

    const reasons: string[] = [];

    if (result.missingMr !== null) {
        reasons.push(`Mastery Rank ${result.missingMr} required`);
    }

    if (result.missingPrereqs.length > 0) {
        const PREREQ_INDEX = Object.fromEntries(
            PREREQ_REGISTRY.map((d) => [d.id, d])
        );
        for (const pid of result.missingPrereqs) {
            const def = PREREQ_INDEX[String(pid)];
            reasons.push(def ? `Quest/hub required: ${def.label}` : `Prerequisite required: ${pid}`);
        }
    }

    if (reasons.length === 0 && result.reasons.length > 0) {
        reasons.push(...result.reasons.slice(0, 5));
    }

    if (reasons.length === 0) {
        reasons.push("Acquisition source not accessible");
    }

    return reasons;
}
