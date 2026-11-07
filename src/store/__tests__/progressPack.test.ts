import { describe, expect, it } from "vitest";
import { mergeProgressPackIntoState, makeDefaultState, ProgressPackSchemaV2 } from "../progressPack";
import { migrateToUserStateV2 } from "../migrations";

describe("progress pack inventory serialization", () => {
    it("accepts and merges modRanks and arcaneRanks from a progress pack", () => {
        const current = makeDefaultState();
        current.inventory.modRanks = {
            "/Lotus/Upgrades/Mods/ExistingMod": 3,
        };
        current.inventory.arcaneRanks = {
            "/Lotus/Upgrades/Mods/ExistingArcane": { "1": 1 },
        };

        const incoming = {
            ...makeDefaultState(),
            inventory: {
                credits: 100,
                platinum: 5,
                counts: {
                    "mods:/Lotus/Upgrades/Mods/NewMod": 2,
                },
                modRanks: {
                    "/Lotus/Upgrades/Mods/NewMod": 8,
                },
                modRankCounts: {
                    "/Lotus/Upgrades/Mods/NewMod": { "0": 2, "8": 1 },
                },
                modUnknownRankCounts: {
                    "/Lotus/Upgrades/Mods/NewMod": 1,
                },
                arcaneRanks: {
                    "/Lotus/Upgrades/Mods/NewArcane": { "0": 2, "5": 1 },
                },
                arcaneUnknownRankCounts: {
                    "/Lotus/Upgrades/Mods/NewArcane": 1,
                },
                customRivens: [],
                alecaFrameUnresolvedRecords: [{
                    path: "/Lotus/Types/Items/MiscItems/Unresolved",
                    kind: "item",
                    sourceSections: ["MiscItems"],
                    quantity: 4,
                    reason: "No exact canonical catalog match.",
                }],
            },
        };

        const parsed = ProgressPackSchemaV2.parse(incoming);
        const merged = mergeProgressPackIntoState(current, parsed);

        expect(merged.inventory.modRanks).toEqual({
            "/Lotus/Upgrades/Mods/ExistingMod": 3,
            "/Lotus/Upgrades/Mods/NewMod": 8,
        });
        expect(merged.inventory.arcaneRanks).toEqual({
            "/Lotus/Upgrades/Mods/ExistingArcane": { "1": 1 },
            "/Lotus/Upgrades/Mods/NewArcane": { "5": 1 },
        });
        expect(merged.inventory.modUnknownRankCounts).toEqual({
            "/Lotus/Upgrades/Mods/NewMod": 1,
        });
        expect(merged.inventory.arcaneUnknownRankCounts).toEqual({
            "/Lotus/Upgrades/Mods/NewArcane": 1,
        });
        expect(merged.inventory.alecaFrameUnresolvedRecords).toEqual(incoming.inventory.alecaFrameUnresolvedRecords);
    });

    it("preserves modRanks and arcaneRanks during migration normalization", () => {
        const iso = "2026-04-03T00:00:00.000Z";
        const migrated = migrateToUserStateV2({
            meta: {
                schemaVersion: 2,
                createdAtIso: iso,
                updatedAtIso: iso,
            },
            player: {
                platform: "PC",
                accountId: "",
                displayName: "Tester",
                masteryRank: 30,
            },
            ui: {
                activePage: "imports",
                expandedGoalNodes: {},
            },
            prereqs: {
                completed: {},
            },
            inventory: {
                credits: 0,
                platinum: 0,
                counts: {},
                modRanks: {
                    "/Lotus/Upgrades/Mods/Serration": 10,
                },
                arcaneRanks: {
                    "/Lotus/Upgrades/Mods/ArcaneMerciless": { "3": 2, "5": 1 },
                },
                modUnknownRankCounts: {
                    "/Lotus/Upgrades/Mods/Serration": 2,
                },
                arcaneUnknownRankCounts: {
                    "/Lotus/Upgrades/Mods/ArcaneMerciless": 1,
                },
                customRivens: [],
                alecaFrameUnresolvedRecords: [{
                    path: "/Lotus/Types/Items/MiscItems/Unresolved",
                    kind: "item",
                    sourceSections: ["MiscItems"],
                    quantity: 2,
                    reason: "No exact canonical catalog match.",
                }],
            },
            syndicates: [],
            dailyTasks: [],
            resetChecklist: undefined,
            goals: [],
            mastery: {
                xpByItem: {},
                mastered: {},
                overLevelMastered: {},
            },
            missions: {
                completesByTag: {},
            },
        });

        expect(migrated?.inventory.modRanks).toEqual({
            "/Lotus/Upgrades/Mods/Serration": 10,
        });
        expect(migrated?.inventory.arcaneRanks).toEqual({
            "/Lotus/Upgrades/Mods/ArcaneMerciless": { "5": 1 },
        });
        expect(migrated?.inventory.modUnknownRankCounts).toEqual({
            "/Lotus/Upgrades/Mods/Serration": 2,
        });
        expect(migrated?.inventory.arcaneUnknownRankCounts).toEqual({
            "/Lotus/Upgrades/Mods/ArcaneMerciless": 1,
        });
        expect(migrated?.inventory.alecaFrameUnresolvedRecords).toEqual([{
            path: "/Lotus/Types/Items/MiscItems/Unresolved",
            kind: "item",
            sourceSections: ["MiscItems"],
            quantity: 2,
            reason: "No exact canonical catalog match.",
        }]);
    });
});
