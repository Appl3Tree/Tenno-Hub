import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("owned mod rank inventory actions", () => {
    it("keeps exact rank counts synchronized with total owned copies", async () => {
        vi.stubGlobal("localStorage", {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
        const { useTrackerStore } = await import("../store");
        const path = "/Lotus/Upgrades/Mods/ExampleMod";
        const store = useTrackerStore.getState();

        store.setModCount(path, 3, 0);
        store.setModRankInventory(path, { "0": 1, "2": 1 }, 1);
        store.setModCount(path, 4, 1);

        let inventory = useTrackerStore.getState().state.inventory;
        expect(inventory.counts[`mods:${path}`]).toBe(4);
        expect(inventory.modRankCounts?.[path]).toEqual({ "0": 1, "1": 1, "2": 1 });
        expect(inventory.modUnknownRankCounts?.[path]).toBe(1);
        expect(inventory.modRanks?.[path]).toBe(2);

        useTrackerStore.getState().setModCount(path, 3);
        useTrackerStore.getState().setModCount(path, 2);

        inventory = useTrackerStore.getState().state.inventory;
        expect(inventory.counts[`mods:${path}`]).toBe(2);
        expect(inventory.modRankCounts?.[path]).toEqual({ "0": 1, "1": 1 });
        expect(inventory.modUnknownRankCounts?.[path]).toBeUndefined();
        expect(inventory.modRanks?.[path]).toBe(1);
    });

    it("keeps exact arcane rank counts synchronized with total owned copies", async () => {
        vi.stubGlobal("localStorage", {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
        const { useTrackerStore } = await import("../store");
        const path = "/Lotus/Upgrades/CosmeticEnhancers/Warframe/ArcaneExample";

        useTrackerStore.getState().setArcaneRankInventory(path, { "0": 3, "2": 2, "5": 1 }, 1);

        let inventory = useTrackerStore.getState().state.inventory;
        expect(inventory.counts[`mods:${path}`]).toBe(7);
        expect(inventory.arcaneRankCounts?.[path]).toEqual({ "0": 3, "2": 2, "5": 1 });
        expect(inventory.arcaneUnknownRankCounts?.[path]).toBe(1);
        expect(inventory.arcaneRanks?.[path]).toEqual({ "5": 1 });

        useTrackerStore.getState().setArcaneRankInventory(path, { "0": 1, "4": 2 });
        inventory = useTrackerStore.getState().state.inventory;
        expect(inventory.counts[`mods:${path}`]).toBe(3);
        expect(inventory.arcaneRankCounts?.[path]).toEqual({ "0": 1, "4": 2 });
        expect(inventory.arcaneUnknownRankCounts?.[path]).toBeUndefined();
        expect(inventory.arcaneRanks?.[path]).toEqual({ "4": 1 });
    });
});
