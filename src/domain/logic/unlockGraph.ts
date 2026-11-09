// ===== FILE: src/domain/logic/unlockGraph.ts =====
import { describePrereqCondition, type PrereqCondition, type PrereqDef } from "../../catalog/prereqs/prereqRegistry";
import { PREREQ_REGISTRY } from "../../catalog/prereqs/prereqRegistry";
import type { PrereqId } from "../ids/prereqIds";
import { getMissingAnyPrereqs, getMissingConditions, type PrereqEvaluationContext } from "./prereqEngine";

export interface UnlockNodeStatus {
    id: PrereqId;
    completed: boolean;
    unlocked: boolean;          // all prereqs completed
    missing: PrereqId[];        // prereqs not completed
    missingAnyPrerequisites: PrereqId[];
    missingConditions: PrereqCondition[];
}

export interface UnlockGraphSnapshot {
    index: Record<string, PrereqDef>;
    statuses: UnlockNodeStatus[];
    byId: Record<string, UnlockNodeStatus>;

    // Availability ordering rank (lower == earlier / sooner).
    // Computed from prereq dependency depth.
    rankById: Record<string, number>;

    actionable: UnlockNodeStatus[]; // not complete, unlocked
    blocked: UnlockNodeStatus[];    // not complete, locked
    completed: UnlockNodeStatus[];  // complete
}

export function describeUnlockNodeMissingLabels(
    status: Pick<UnlockNodeStatus, "missing" | "missingAnyPrerequisites" | "missingConditions">,
    index: Record<string, PrereqDef>,
): string[] {
    const prereqLabels = status.missing.map((id) => index[id]?.label ?? id);
    const missingAny = status.missingAnyPrerequisites;
    const anyLabels = missingAny.length
        ? [`Either ${missingAny.map((id) => index[id]?.label ?? id).join(" or ")}`]
        : [];
    const conditionLabels = status.missingConditions.map((cond) =>
        describePrereqCondition(cond, (id) => index[id]?.label ?? id),
    );
    return [...prereqLabels, ...anyLabels, ...conditionLabels];
}

/**
 * Unknown prereq IDs are treated as missing (per your rule):
 * - If something references a prereq not in registry, it will be considered locked.
 */
function isCompleted(completedMap: Record<string, boolean>, id: string): boolean {
    return completedMap[id] === true;
}

export function buildPrereqIndex(defs: PrereqDef[] = PREREQ_REGISTRY): Record<string, PrereqDef> {
    const index: Record<string, PrereqDef> = {};
    for (const d of defs) {
        index[d.id] = d;
    }
    return index;
}

/**
 * Compute a stable "availability order" rank using dependency depth:
 * - rank = 0 for roots (no prerequisites)
 * - AND parents use their maximum rank; OR parents use their minimum rank.
 * - rank = 1 + max(AND parent rank, best OR parent rank).
 * Unknown prereqs contribute +1_000_000 (pushes the node late, fail-closed).
 * Cycles are handled fail-closed by assigning a large rank.
 */
function computeRankById(index: Record<string, PrereqDef>, defs: PrereqDef[]): Record<string, number> {
    const memo: Record<string, number> = {};
    const visiting = new Set<string>();

    const UNKNOWN_RANK = 1_000_000;
    const CYCLE_RANK = 2_000_000;

    function rankOf(id: string): number {
        if (memo[id] !== undefined) return memo[id];

        if (visiting.has(id)) {
            memo[id] = CYCLE_RANK;
            return memo[id];
        }

        const def = index[id];
        if (!def) {
            memo[id] = UNKNOWN_RANK;
            return memo[id];
        }

        visiting.add(id);

        const prereqs = Array.isArray(def.prerequisites) ? def.prerequisites : [];
        const alternatives = Array.isArray(def.anyPrerequisites) ? def.anyPrerequisites : [];
        const conditionPrereqs = (def.conditions ?? []).flatMap((condition) =>
            condition.type === "quest_complete" ? [condition.prereqId]
                : condition.type === "junction_complete" ? [condition.junctionId]
                    : [],
        );
        if (prereqs.length === 0 && alternatives.length === 0 && conditionPrereqs.length === 0) {
            memo[id] = 0;
            visiting.delete(id);
            return memo[id];
        }

        let maxChild = 0;
        for (const p of [...prereqs, ...conditionPrereqs]) {
            const child = index[p] ? rankOf(p) : UNKNOWN_RANK;
            maxChild = Math.max(maxChild, child);
        }

        if (alternatives.length > 0) {
            const bestAlternative = Math.min(...alternatives.map((p) => index[p] ? rankOf(p) : UNKNOWN_RANK));
            maxChild = Math.max(maxChild, bestAlternative);
        }

        memo[id] = maxChild + 1;

        visiting.delete(id);
        return memo[id];
    }

    for (const d of defs) {
        rankOf(d.id);
    }

    return memo;
}

export function computeUnlockGraphSnapshot(
    completedMap: Record<string, boolean>,
    defs: PrereqDef[] = PREREQ_REGISTRY,
    context: PrereqEvaluationContext = {},
): UnlockGraphSnapshot {
    const index = buildPrereqIndex(defs);
    const rankById = computeRankById(index, defs);

    const statuses: UnlockNodeStatus[] = defs.map((d) => {
        const completed = isCompleted(completedMap, d.id);

        const missing: PrereqId[] = [];
        for (const p of d.prerequisites) {
            // If prereq is unknown, treat as missing
            if (!index[p] || !isCompleted(completedMap, p)) {
                missing.push(p);
            }
        }

        const missingAnyPrerequisites = getMissingAnyPrereqs(index, completedMap, d.anyPrerequisites) as PrereqId[];

        const missingConditions = getMissingConditions(d, completedMap, context);

        return {
            id: d.id,
            completed,
            unlocked: missing.length === 0 && missingAnyPrerequisites.length === 0 && missingConditions.length === 0,
            missing,
            missingAnyPrerequisites,
            missingConditions,
        };
    });

    const byId: Record<string, UnlockNodeStatus> = {};
    for (const s of statuses) {
        byId[s.id] = s;
    }

    const rankOf = (id: string) => {
        const v = rankById[id];
        return Number.isFinite(v) ? v : 1_000_000;
    };

    function compare(a: UnlockNodeStatus, b: UnlockNodeStatus): number {
        const ra = rankOf(a.id);
        const rb = rankOf(b.id);
        if (ra !== rb) return ra - rb;
        return String(a.id).localeCompare(String(b.id));
    }

    const actionable = statuses
        .filter((s) => !s.completed && s.unlocked)
        .sort(compare);

    const blocked = statuses
        .filter((s) => !s.completed && !s.unlocked)
        .sort(compare);

    const completed = statuses
        .filter((s) => s.completed)
        .sort(compare);

    return {
        index,
        statuses,
        byId,
        rankById,
        actionable,
        blocked,
        completed
    };
}

/**
 * Returns the “frontier”: prereqs that are NOT completed but are currently unlocked.
 * This is the key primitive the planner uses to recommend next unlock steps.
 */
export function getActionablePrereqs(
    completedMap: Record<string, boolean>,
    defs: PrereqDef[] = PREREQ_REGISTRY,
    context: PrereqEvaluationContext = {},
): PrereqDef[] {
    const snap = computeUnlockGraphSnapshot(completedMap, defs, context);
    return snap.actionable
        .map((s) => snap.index[s.id])
        .filter(Boolean)
        .sort((a, b) => {
            const ra = snap.rankById[a.id] ?? 1_000_000;
            const rb = snap.rankById[b.id] ?? 1_000_000;
            if (ra !== rb) return ra - rb;
            return a.label.localeCompare(b.label);
        });
}

/**
 * Convenience helper: is a prereq complete?
 */
export function isPrereqComplete(completedMap: Record<string, boolean>, id: PrereqId): boolean {
    return completedMap[id] === true;
}

/**
 * Convenience helper: are all prereqs completed for a prereq definition?
 */
export function isPrereqUnlocked(
    completedMap: Record<string, boolean>,
    id: PrereqId,
    defs: PrereqDef[] = PREREQ_REGISTRY,
    context: PrereqEvaluationContext = {},
): boolean {
    const snap = computeUnlockGraphSnapshot(completedMap, defs, context);
    const st = snap.byId[id];
    if (!st) {
        // Unknown prereq => treat as locked
        return false;
    }
    return st.unlocked;
}
