import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("shared World State completion state", () => {
    it("publishes invasion, Nightwave, and occurrence-scoped event changes immediately and supports undo", { timeout: 15000 }, async () => {
        vi.stubGlobal("localStorage", {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
        const { useTrackerStore } = await import("../store");
        const changes: unknown[] = [];
        const unsubscribe = useTrackerStore.subscribe((state) => changes.push(state.state.worldState));

        useTrackerStore.getState().toggleInvasionDone("invasion-current");
        expect(useTrackerStore.getState().isInvasionDone("invasion-current")).toBe(true);

        useTrackerStore.getState().toggleNightwaveChallengeDone("nightwave-current");
        expect(useTrackerStore.getState().isNightwaveChallengeDone("nightwave-current")).toBe(true);

        useTrackerStore.getState().toggleEventInstanceDone("event:limited-operation:2026-11-11T00%3A00%3A00.000Z");
        expect(useTrackerStore.getState().isEventInstanceDone("event:limited-operation:2026-11-11T00%3A00%3A00.000Z")).toBe(true);

        // An action in either surface writes the same shared Zustand records; the opposite surface's
        // selector sees the update synchronously and the same action cleanly undoes it.
        useTrackerStore.getState().toggleEventInstanceDone("event:limited-operation:2026-11-11T00%3A00%3A00.000Z");
        useTrackerStore.getState().toggleNightwaveChallengeDone("nightwave-current");
        useTrackerStore.getState().toggleInvasionDone("invasion-current");
        expect(useTrackerStore.getState().isEventInstanceDone("event:limited-operation:2026-11-11T00%3A00%3A00.000Z")).toBe(false);
        expect(useTrackerStore.getState().isNightwaveChallengeDone("nightwave-current")).toBe(false);
        expect(useTrackerStore.getState().isInvasionDone("invasion-current")).toBe(false);
        expect(changes.length).toBeGreaterThanOrEqual(6);

        unsubscribe();
    });
});
