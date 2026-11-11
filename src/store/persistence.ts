// ===== FILE: src/store/persistence.ts =====
import type { UserStateV2 } from "../domain/models/userState";
import { migrateToUserStateV2 } from "./migrations";

export const PERSIST_KEY = "wf_tracker_state_v3";
/** Bump this when the Zustand persist schema changes (store.ts version). */
export const PERSIST_VERSION = 9;

/** @deprecated Use PERSIST_KEY instead. */
export const STORAGE_KEY = PERSIST_KEY;

/**
 * Compatibility helper. Prefer zustand persist for actual app behavior.
 * This is safe for debugging / manual exports / future tooling.
 */
export function loadState(): UserStateV2 | null {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);

        // Zustand persists as { state: ..., version: ... }
        const inner = parsed?.state ?? parsed;
        return migrateToUserStateV2(inner);
    } catch {
        return null;
    }
}

export function saveState(state: UserStateV2): void {
    // Mirror zustand persist envelope shape for consistency.
    const payload = {
        state,
        version: PERSIST_VERSION
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
}
