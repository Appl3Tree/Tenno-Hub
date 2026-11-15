import {
    describePrereqCondition,
    type PrereqDef,
    type PrereqEvidence,
} from "./prereqRegistry";
import { PREREQ_REGISTRY } from "./prereqRegistry";

export type PrerequisiteRelationshipKind = "required-and" | "alternative-or" | "typed-condition" | "onboarding-order";

export interface PrerequisiteRelationshipAuditRow {
    targetId: string;
    targetLabel: string;
    kind: PrerequisiteRelationshipKind;
    relationshipKey: string;
    requirement: string;
    blocking: boolean;
    evidence: PrereqEvidence[];
}

/**
 * Expands every registry relationship into a separately reviewable row.
 * Entry-level evidence may support multiple explicit requirements on one
 * target, so the generated matrix repeats the supporting source notes beside
 * each relationship instead of implying that structural validation proves it.
 */
export function buildPrerequisiteRelationshipAudit(
    defs: PrereqDef[] = PREREQ_REGISTRY,
): PrerequisiteRelationshipAuditRow[] {
    const labelById = new Map<string, string>(defs.map((def) => [String(def.id), def.label]));
    const rows: PrerequisiteRelationshipAuditRow[] = [];

    for (const def of defs) {
        const evidence = [...(def.evidence ?? [])];
        for (const parentId of def.prerequisites) {
            rows.push({
                targetId: def.id,
                targetLabel: def.label,
                kind: "required-and",
                relationshipKey: `and:${parentId}`,
                requirement: `Complete ${labelById.get(parentId) ?? parentId}`,
                blocking: true,
                evidence,
            });
        }
        for (const parentId of def.anyPrerequisites ?? []) {
            rows.push({
                targetId: def.id,
                targetLabel: def.label,
                kind: "alternative-or",
                relationshipKey: `or:${parentId}`,
                requirement: `Use this alternative: ${labelById.get(parentId) ?? parentId}`,
                blocking: true,
                evidence,
            });
        }
        (def.conditions ?? []).forEach((condition, index) => {
            rows.push({
                targetId: def.id,
                targetLabel: def.label,
                kind: "typed-condition",
                relationshipKey: `condition:${index + 1}`,
                requirement: describePrereqCondition(condition, (id) => labelById.get(id) ?? id),
                blocking: true,
                evidence,
            });
        });
        for (const parentId of def.progressionAfter ?? []) {
            rows.push({
                targetId: def.id,
                targetLabel: def.label,
                kind: "onboarding-order",
                relationshipKey: `onboarding:${parentId}`,
                requirement: `Introduced after ${labelById.get(parentId) ?? parentId}; this does not block the game unlock`,
                blocking: false,
                evidence: [],
            });
        }
    }

    return rows;
}

export function findPrerequisiteRelationshipEvidenceGaps(
    rows = buildPrerequisiteRelationshipAudit(),
): string[] {
    return rows
        .filter((row) => row.blocking)
        .filter((row) => !row.evidence.some((evidence) =>
            evidence.classification === "required" || evidence.classification === "conditional",
        ))
        .map((row) => `${row.targetId} -> ${row.relationshipKey}`);
}

