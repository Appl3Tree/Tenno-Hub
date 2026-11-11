import { describe, expect, it } from "vitest";
import {
    mergeProgressPackIntoState,
    makeDefaultState,
    ProgressPackSchemaV2,
    replaceProgressPackState,
} from "../progressPack";
import { migrateToUserStateV2 } from "../migrations";
import { PR } from "../../domain/ids/prereqIds";

describe("progress pack inventory serialization", () => {
    it("preserves rotation-scoped event completions and legacy IDs through a Progress Pack", () => {
        const source = makeDefaultState();
        source.worldState = {
            doneInvasions: ["invasion-1"],
            doneNightwaveChallenges: ["nightwave-18-week-2"],
            doneEvents: ["legacy-event-id"],
            doneEventInstances: ["event%3Athermia%3A2026-11-03T00%3A00%3A00.000Z"],
        };

        const parsed = ProgressPackSchemaV2.parse(source);
        const restored = mergeProgressPackIntoState(makeDefaultState(), parsed);

        expect(restored.worldState).toEqual(source.worldState);
    });

    it("accepts older World State progress without event-instance keys", () => {
        const pack = ProgressPackSchemaV2.parse({
            ...makeDefaultState(),
            worldState: { doneInvasions: ["invasion-old"], doneEvents: ["event-old"] },
        });

        expect(pack.worldState).toMatchObject({ doneInvasions: ["invasion-old"], doneEvents: ["event-old"] });
        expect(pack.worldState).not.toHaveProperty("doneEventInstances");
    });

    it("deduplicates World State completion records and preserves legacy event IDs during migration", () => {
        const state = makeDefaultState();
        state.worldState = {
            doneInvasions: ["invasion-1", "invasion-1"],
            doneNightwaveChallenges: ["nightwave-1", "nightwave-1"],
            doneEvents: ["legacy-event"],
            doneEventInstances: ["rotation-event", "rotation-event"],
        };

        const migrated = migrateToUserStateV2(state)!;

        expect(migrated.worldState).toEqual({
            doneInvasions: ["invasion-1"],
            doneNightwaveChallenges: ["nightwave-1"],
            doneEvents: ["legacy-event"],
            doneEventInstances: ["rotation-event"],
        });
    });

    it("migrates the legacy Steel Path Circuit alias without losing completed progress", () => {
        const state = makeDefaultState();
        state.prereqs.completed = {
            activity_circuit_sp: true,
            activity_circuit_steel_path: false,
        };

        const migrated = migrateToUserStateV2(state);

        expect(migrated?.prereqs.completed.activity_circuit_steel_path).toBe(true);
        expect(migrated?.prereqs.completed).not.toHaveProperty("activity_circuit_sp");
    });

    it("keeps existing Vor's Prize completion valid after tracking its Awakening predecessor", () => {
        const state = makeDefaultState();
        state.prereqs.completed[PR.VORS_PRIZE] = true;

        const migrated = migrateToUserStateV2(state);
        expect(migrated?.prereqs.completed[PR.AWAKENING]).toBe(true);

        const merged = mergeProgressPackIntoState(makeDefaultState(), {
            prereqs: { completed: { [PR.VORS_PRIZE]: true } },
        });
        expect(merged.prereqs.completed[PR.AWAKENING]).toBe(true);
    });

    it("migrates the retired Tau series completion into both released chapter completions", () => {
        const legacyState = makeDefaultState();
        legacyState.prereqs.completed[PR.TAU_PROLOGUE] = true;

        const migrated = migrateToUserStateV2(legacyState)!;
        expect(migrated.prereqs.completed[PR.TAU_PROLOGUE_LUA]).toBe(true);
        expect(migrated.prereqs.completed[PR.TAU_PROLOGUE_VESSEL]).toBe(true);
        expect(migrated.prereqs.completed).not.toHaveProperty(PR.TAU_PROLOGUE);

        const imported = mergeProgressPackIntoState(makeDefaultState(), {
            prereqs: { completed: { [PR.TAU_PROLOGUE]: true } },
        });
        expect(imported.prereqs.completed[PR.TAU_PROLOGUE_LUA]).toBe(true);
        expect(imported.prereqs.completed[PR.TAU_PROLOGUE_VESSEL]).toBe(true);
        expect(imported.prereqs.completed).not.toHaveProperty(PR.TAU_PROLOGUE);
    });

    it("preserves explicit chapter progress when migrating a legacy Tau series key", () => {
        const merged = mergeProgressPackIntoState(makeDefaultState(), {
            prereqs: {
                completed: {
                    [PR.TAU_PROLOGUE]: true,
                    [PR.TAU_PROLOGUE_LUA]: false,
                },
            },
        });
        expect(merged.prereqs.completed[PR.TAU_PROLOGUE_LUA]).toBe(false);
        expect(merged.prereqs.completed[PR.TAU_PROLOGUE_VESSEL]).toBe(true);
    });

    it("replaces local progress from a backup instead of retaining post-backup inventory", () => {
        const current = makeDefaultState();
        current.inventory.counts["items:/Lotus/Types/Items/MiscItems/AddedAfterBackup"] = 1;

        const backup = makeDefaultState();
        backup.meta.createdAtIso = "2026-01-01T00:00:00.000Z";
        backup.inventory.counts = {
            "items:/Lotus/Types/Items/MiscItems/BackupItem": 2,
        };
        const parsed = ProgressPackSchemaV2.parse(backup);
        const restored = replaceProgressPackState(parsed);

        expect(restored.inventory.counts).toEqual({
            "items:/Lotus/Types/Items/MiscItems/BackupItem": 2,
        });
        expect(restored.inventory.counts).not.toHaveProperty(
            "items:/Lotus/Types/Items/MiscItems/AddedAfterBackup",
        );
        expect(restored.meta.createdAtIso).toBe(backup.meta.createdAtIso);
    });

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
