import { PR } from "../domain/ids/prereqIds";

/**
 * Migrate completion keys whose tracked entity has been split into released
 * quest chapters. A completed legacy series means its already-released
 * chapters were complete; an explicit chapter value takes precedence.
 */
export function migratePrereqCompletionAliases(raw: unknown): Record<string, boolean> {
    const completed: Record<string, boolean> = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof value === "boolean") completed[id] = value;
        }
    }

    if (completed[PR.TAU_PROLOGUE] === true) {
        if (completed[PR.TAU_PROLOGUE_LUA] === undefined) completed[PR.TAU_PROLOGUE_LUA] = true;
        if (completed[PR.TAU_PROLOGUE_VESSEL] === undefined) completed[PR.TAU_PROLOGUE_VESSEL] = true;
    }
    delete completed[PR.TAU_PROLOGUE];

    return completed;
}
