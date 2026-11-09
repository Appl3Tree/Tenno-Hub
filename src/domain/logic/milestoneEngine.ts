// src/domain/logic/milestoneEngine.ts
import type { PrereqId } from "../ids/prereqIds";
import { MILESTONE_REGISTRY, type MilestoneRule } from "../../catalog/prereqs/milestoneRegistry";

export type MilestoneDef = {
    id: string;
    label: string;
    description: string;
    prereqIds: PrereqId[];
    rule: MilestoneRule;
    tags?: string[];
};

export type MilestoneStatus = {
    id: string;
    label: string;
    description: string;

    total: number;
    completedCount: number;
    completed: boolean;

    missing: PrereqId[];
    completedPrereqs: PrereqId[];
    rule: MilestoneRule;

    tags: string[];
};

export type MilestoneSnapshot = {
    milestones: MilestoneStatus[];
    stats: {
        totalMilestones: number;
        completedMilestones: number;
        totalPrereqsTracked: number;
        completedPrereqsTracked: number;
    };
};

/**
 * Registry resolver:
 * Supports common export names to avoid small batch churn:
 * - MILESTONE_REGISTRY (preferred)
 * - MILESTONES
 * - default export array
 */
function resolveRegistry(): MilestoneDef[] {
    return MILESTONE_REGISTRY.map((def) => ({
        id: def.id,
        label: def.label,
        description: def.description,
        prereqIds: def.rule.prereqIds,
        rule: def.rule,
        tags: [],
    }));
}

function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

/**
 * Primary snapshot API: returns milestone statuses + stats.
 */
export function computeMilestoneSnapshot(
    completedMap: Record<string, boolean>
): MilestoneSnapshot {
    const defs = resolveRegistry();

    const milestones: MilestoneStatus[] = defs.map((m) => {
        const prereqIds = Array.isArray(m.prereqIds) ? m.prereqIds : [];
        const requiredCount = m.rule.type === "all"
            ? prereqIds.length
            : Math.min(prereqIds.length, Math.max(1, Math.floor(m.rule.need ?? 1)));

        const missing: PrereqId[] = [];
        const completedPrereqs: PrereqId[] = [];

        for (const id of prereqIds) {
            if (completedMap[id] === true) {
                completedPrereqs.push(id);
            } else {
                missing.push(id);
            }
        }

        const completedCount = Math.min(completedPrereqs.length, requiredCount);
        const completed = requiredCount > 0 && completedCount >= requiredCount;
        const missingForRule = completed
            ? []
            : m.rule.type === "all"
                ? missing
                : missing.slice(0, Math.max(0, requiredCount - completedPrereqs.length));

        return {
            id: m.id,
            label: m.label,
            description: m.description,
            total: requiredCount,
            completedCount,
            completed,
            missing: uniq(missingForRule),
            completedPrereqs: uniq(completedPrereqs),
            rule: m.rule,
            tags: Array.isArray(m.tags) ? m.tags : []
        };
    });

    milestones.sort((a, b) => {
        // Incomplete first, then by "closest" (more complete), then alpha.
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        const aPct = a.total > 0 ? a.completedCount / a.total : 0;
        const bPct = b.total > 0 ? b.completedCount / b.total : 0;
        if (aPct !== bPct) return bPct - aPct;

        return a.label.localeCompare(b.label);
    });

    const allPrereqs = uniq(defs.flatMap((def) => def.rule.prereqIds));

    const completedTracked = allPrereqs.filter((p) => completedMap[p] === true);

    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter((m) => m.completed).length;

    return {
        milestones,
        stats: {
            totalMilestones,
            completedMilestones,
            totalPrereqsTracked: allPrereqs.length,
            completedPrereqsTracked: completedTracked.length
        }
    };
}

/**
 * Compatibility export for plannerEngine.ts.
 *
 * plannerEngine currently calls:
 *   computeMilestones({ completedPrereqs: completedMap })
 * and expects an array with at least { id: string }.
 *
 * This function returns the snapshot.milestones list (already normalized + sorted).
 */
export function computeMilestones(args: {
    completedPrereqs: Record<string, boolean>;
}): MilestoneStatus[] {
    const completedMap =
        args && typeof args.completedPrereqs === "object"
            ? args.completedPrereqs
            : {};
    return computeMilestoneSnapshot(completedMap).milestones;
}

/**
 * Convenience: highest leverage prereqs across milestones (how many milestones reference them).
 */
export function computeMilestonePrereqImpact(): Array<{
    prereqId: PrereqId;
    milestoneCount: number;
    milestoneIds: string[];
}> {
    const defs = resolveRegistry();

    const map = new Map<string, { milestoneIds: string[] }>();

    for (const m of defs) {
        const ids = Array.isArray(m.rule.prereqIds) ? m.rule.prereqIds : [];
        for (const p of ids) {
            const key = String(p);
            if (!map.has(key)) map.set(key, { milestoneIds: [] });
            map.get(key)!.milestoneIds.push(m.id);
        }
    }

    const out = Array.from(map.entries()).map(([k, v]) => ({
        prereqId: k as PrereqId,
        milestoneCount: v.milestoneIds.length,
        milestoneIds: v.milestoneIds
    }));

    out.sort((a, b) => {
        if (a.milestoneCount !== b.milestoneCount) return b.milestoneCount - a.milestoneCount;
        return String(a.prereqId).localeCompare(String(b.prereqId));
    });

    return out;
}

