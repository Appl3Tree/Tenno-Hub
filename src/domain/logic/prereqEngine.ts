// ===== FILE: src/domain/logic/prereqEngine.ts =====
import type { PrereqCondition, PrereqDef } from "../../catalog/prereqs/prereqRegistry";
import { PREREQ_REGISTRY } from "../../catalog/prereqs/prereqRegistry";
import { isNightmareUnlockedFromNodeCompletion, isSteelPathUnlockedFromNodeCompletion } from "./starChartProgression";

export interface PrereqEvaluationContext {
    masteryRank?: number | null;
    nodeCompletedMap?: Record<string, boolean>;
    planetUnlockedMap?: Record<string, boolean>;
    inventoryCounts?: Record<string, number>;
    syndicateRankById?: Record<string, number>;
    railjackIntrinsics?: Record<string, number>;
}

export interface PrereqStatus {
    id: string;
    completed: boolean;
    isUnlocked: boolean;
    missingPrereqs: string[];
    missingAnyPrerequisites: string[];
    missingConditions: PrereqCondition[];
}

export function buildPrereqIndex(defs: PrereqDef[] = PREREQ_REGISTRY): Record<string, PrereqDef> {
    const index: Record<string, PrereqDef> = {};
    for (const d of defs) {
        index[d.id] = d;
    }
    return index;
}

export function isPrereqCompleted(
    completedMap: Record<string, boolean>,
    prereqId: string
): boolean {
    return completedMap[prereqId] === true;
}

export function isPrereqConditionSatisfied(
    cond: PrereqCondition,
    completedMap: Record<string, boolean>,
    context: PrereqEvaluationContext = {},
): boolean {
    switch (cond.type) {
        case "mastery_rank": {
            const mr = typeof context.masteryRank === "number" && Number.isFinite(context.masteryRank)
                ? Math.max(0, Math.floor(context.masteryRank))
                : -1;
            return mr >= cond.value;
        }
        case "quest_complete":
            return isPrereqCompleted(completedMap, cond.prereqId);
        case "junction_complete":
            return isPrereqCompleted(completedMap, cond.junctionId);
        case "node_complete":
            return context.nodeCompletedMap?.[cond.nodeId] === true;
        case "planet_unlock":
            return context.planetUnlockedMap?.[cond.planetId] === true;
        case "syndicate_rank":
            return (context.syndicateRankById?.[cond.syndicateId] ?? -1) >= cond.rank;
        case "item_owned":
            return Number(context.inventoryCounts?.[cond.catalogId] ?? 0) > 0;
        case "resource_owned":
            return Number(context.inventoryCounts?.[cond.catalogId] ?? 0) >= cond.quantity;
        case "star_chart_access":
            return cond.activity === "steel_path"
                ? isSteelPathUnlockedFromNodeCompletion(context.nodeCompletedMap)
                : isNightmareUnlockedFromNodeCompletion(context.nodeCompletedMap);
        case "railjack_intrinsic_rank": {
            const intrinsics = context.railjackIntrinsics ?? {};
            if (cond.skillId) {
                return (Number(intrinsics[cond.skillId]) || 0) >= cond.rank;
            }
            return Object.values(intrinsics).some((rank) => Number.isFinite(rank) && rank >= cond.rank);
        }
    }
}

export function getMissingConditions(
    def: PrereqDef | undefined,
    completedMap: Record<string, boolean>,
    context: PrereqEvaluationContext = {},
): PrereqCondition[] {
    if (!def || !Array.isArray(def.conditions) || def.conditions.length === 0) return [];
    return def.conditions.filter((cond) => !isPrereqConditionSatisfied(cond, completedMap, context));
}

export function getMissingPrereqs(
    index: Record<string, PrereqDef>,
    completedMap: Record<string, boolean>,
    prereqId: string
): string[] {
    const def = index[prereqId];
    if (!def) {
        // Unknown prereq => treat as missing (per your rule)
        return [prereqId];
    }

    const missing: string[] = [];
    for (const parent of def.prerequisites) {
        if (!isPrereqCompleted(completedMap, parent)) {
            missing.push(parent);
        }
    }
    return missing;
}

export function getMissingAnyPrereqs(
    index: Record<string, PrereqDef>,
    completedMap: Record<string, boolean>,
    prereqIds: string[] | undefined,
): string[] {
    if (!prereqIds?.length || prereqIds.some((id) => index[id] && isPrereqCompleted(completedMap, id))) return [];
    // Fail closed: unknown alternatives remain visible and cannot satisfy the OR group.
    return [...prereqIds];
}

export function computePrereqStatuses(
    defs: PrereqDef[],
    completedMap: Record<string, boolean>,
    context: PrereqEvaluationContext = {},
): PrereqStatus[] {
    const index = buildPrereqIndex(defs);

    return defs.map((d) => {
        const completed = isPrereqCompleted(completedMap, d.id);
        const missing = getMissingPrereqs(index, completedMap, d.id);
        const missingAnyPrerequisites = getMissingAnyPrereqs(index, completedMap, d.anyPrerequisites);
        const missingConditions = getMissingConditions(d, completedMap, context);
        const unlocked = missing.length === 0 && missingAnyPrerequisites.length === 0 && missingConditions.length === 0;

        return {
            id: d.id,
            completed,
            isUnlocked: unlocked,
            missingPrereqs: missing,
            missingAnyPrerequisites,
            missingConditions,
        };
    });
}
