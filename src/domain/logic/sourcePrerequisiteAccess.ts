import { SOURCE_INDEX } from "../../catalog/sources/sourceCatalog";
import type { SourceId } from "../ids/sourceIds";

export interface SourcePrerequisiteAccess {
    known: boolean;
    accessible: boolean;
    missingPrereqs: string[];
}

/**
 * Evaluate the prerequisite metadata attached to one acquisition route.
 * A registered drop route can carry explicit region/activity gates just like
 * a vendor route; its `data:drop:` identifier does not make those gates
 * optional. Unregistered synthetic routes are handled by their callers.
 */
export function evaluateSourcePrerequisiteAccess(
    sourceId: SourceId,
    completedPrereqs: Record<string, boolean>,
): SourcePrerequisiteAccess {
    const source = SOURCE_INDEX[sourceId];
    if (!source) return { known: false, accessible: false, missingPrereqs: [] };

    const missingPrereqs = (source.prereqIds ?? [])
        .filter((prereqId) => completedPrereqs[prereqId] !== true);

    return {
        known: true,
        accessible: missingPrereqs.length === 0,
        missingPrereqs,
    };
}
