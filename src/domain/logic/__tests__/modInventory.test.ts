import { describe, expect, it } from "vitest";
import { availableModRanks, getModRankInventorySnapshot } from "../modInventory";

describe("mod rank inventory", () => {
    it("preserves the legacy single-rank meaning until exact counts are recorded", () => {
        const snapshot = getModRankInventorySnapshot("/mods/example", 3, 5, 4, undefined, undefined);

        expect(snapshot.rankCounts).toEqual({ "4": 3 });
        expect(snapshot.unknownCount).toBe(0);
        expect(snapshot.highestOwnedRank).toBe(4);
    });

    it("returns only exact owned ranks and keeps unknown copies separate", () => {
        const snapshot = getModRankInventorySnapshot(
            "/mods/example",
            4,
            5,
            5,
            { "/mods/example": { "0": 1, "2": 1 } },
            { "/mods/example": 1 },
        );

        expect(availableModRanks(snapshot)).toEqual([0, 2]);
        expect(snapshot.rankCounts).toEqual({ "0": 1, "2": 1 });
        expect(snapshot.unknownCount).toBe(2);
        expect(snapshot.highestOwnedRank).toBe(2);
    });
});
