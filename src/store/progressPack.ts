// Progress pack schemas, default state factory, and import/merge logic.

import { z } from "zod";
import type { PageKey, UserStateV2, WorldStateCategoryKey } from "../domain/models/userState";
import { SEED_INVENTORY, SEED_MASTERY, SEED_MISSIONS, SEED_SYNDICATES } from "../domain/seed";
import { nowIso } from "./storeUtils";
import { makeDefaultResetChecklistState, ensureResetChecklistState } from "./resetChecklist";
import { normalizeArcaneRankMap } from "../domain/logic/arcaneInventory";
import { PR } from "../domain/ids/prereqIds";

export function makeDefaultState(): UserStateV2 {
    const iso = nowIso();
    return {
        meta: {
            schemaVersion: 2,
            createdAtIso: iso,
            updatedAtIso: iso
        },
        player: {
            platform: "PC",
            accountId: "",
            displayName: "",
            masteryRank: null,
            clanName: undefined,
            clanTier: undefined,
            clanClass: undefined,
            clanXp: undefined
        },
        ui: {
            activePage: "dashboard",
            expandedGoalNodes: {}
        },
        prereqs: {
            completed: {}
        },
        inventory: SEED_INVENTORY,
        syndicates: SEED_SYNDICATES,
        dailyTasks: [],
        resetChecklist: makeDefaultResetChecklistState(),
        goals: [],
        mastery: SEED_MASTERY,
        missions: SEED_MISSIONS
    };
}

const PlatformSchema = z.enum(["PC", "PlayStation", "Xbox", "Switch", "Mobile", "Android"]);

const InventorySchema = z.object({
    credits: z.number().int().min(0),
    platinum: z.number().int().min(0),
    counts: z.record(z.string(), z.number().nonnegative()),
    modRanks: z.record(z.string(), z.number().int().nonnegative()).optional(),
    modRankCounts: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())).optional(),
    modUnknownRankCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
    arcaneRanks: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())).optional(),
    arcaneRankCounts: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())).optional(),
    arcaneUnknownRankCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
    customRivens: z.array(z.any()).optional(),
    alecaFrameUnresolvedRecords: z.array(z.object({
        path: z.string().startsWith("/Lotus/").max(512),
        kind: z.enum(["item", "upgrade"]),
        sourceSections: z.array(z.string().max(256)).max(64),
        quantity: z.number().int().nonnegative().max(100_000_000),
        rankCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
        rankCountsComplete: z.boolean().optional(),
        reason: z.string().max(256),
    })).max(100_000).optional(),
});

export const ProgressPackSchemaV2 = z
    .object({
        meta: z
            .object({
                schemaVersion: z.literal(2),
                createdAtIso: z.string(),
                updatedAtIso: z.string()
            })
            .passthrough(),
        player: z
            .object({
                platform: PlatformSchema.optional(),
                accountId: z.string().optional(),
                displayName: z.string().optional(),
                masteryRank: z.number().nullable().optional(),
                clanName: z.string().optional(),
                clanTier: z.number().optional(),
                clanClass: z.number().optional(),
                clanXp: z.number().optional()
            })
            .passthrough()
            .optional(),
        ui: z
            .object({
                activePage: z.string()
            })
            .passthrough()
            .optional(),
        prereqs: z
            .object({
                completed: z.record(z.string(), z.boolean())
            })
            .passthrough()
            .optional(),
        inventory: InventorySchema.optional(),
        syndicates: z.any().optional(),
        dailyTasks: z.any().optional(),
        resetChecklist: z.any().optional(),
        goals: z.any().optional(),
        mastery: z.any().optional(),
        missions: z.any().optional(),
        challenges: z.any().optional(),
        intrinsics: z.any().optional(),
        worldState: z.any().optional(),
        modBuilder: z.any().optional()
    })
    .passthrough();

export function ensureGoalsArray(state: any): void {
    if (!state || typeof state !== "object") return;
    if (!Array.isArray(state.goals)) state.goals = [];
}

export function ensureUiExpansion(state: any): void {
    if (!state || typeof state !== "object") return;
    if (!state.ui || typeof state.ui !== "object") state.ui = { activePage: "dashboard" };
    if (!state.ui.expandedGoalNodes || typeof state.ui.expandedGoalNodes !== "object") {
        state.ui.expandedGoalNodes = {};
    }
}

function normalizeArcaneRanksMap(value: unknown): Record<string, Record<string, number>> {
    if (!value || typeof value !== "object") return {};
    const normalized: Record<string, Record<string, number>> = {};
    for (const [path, byRank] of Object.entries(value as Record<string, unknown>)) {
        normalized[path] = normalizeArcaneRankMap(
            byRank && typeof byRank === "object" ? (byRank as Record<string, number>) : {},
        );
    }
    return normalized;
}

export function mergeProgressPackIntoState(current: UserStateV2, incoming: any): UserStateV2 {
    const next: UserStateV2 = {
        ...current,
        meta: {
            ...current.meta,
            updatedAtIso: nowIso()
        }
    };

    if (incoming.player) {
        next.player = {
            ...next.player,
            ...incoming.player
        };
    }

    if (incoming.ui) {
        // "systems" was renamed to "handbook" in Phase 4.
        const rawPage =
            incoming.ui.activePage === "systems"
                ? "handbook"
                : incoming.ui.activePage === "relics"
                    ? "relic_planner"
                    : incoming.ui.activePage;
        next.ui = {
            activePage: (rawPage as PageKey) ?? next.ui.activePage,
            expandedGoalNodes: {
                ...next.ui.expandedGoalNodes,
                ...((incoming.ui as any).expandedGoalNodes as Record<string, boolean> | undefined)
            },
            hiddenWorldStateCategories: Array.isArray((incoming.ui as any).hiddenWorldStateCategories)
                ? ([...(incoming.ui as any).hiddenWorldStateCategories] as WorldStateCategoryKey[])
                : next.ui.hiddenWorldStateCategories
        };
    }

    if (incoming.prereqs?.completed && typeof incoming.prereqs.completed === "object") {
        next.prereqs = {
            ...next.prereqs,
            completed: {
                ...next.prereqs.completed,
                ...incoming.prereqs.completed
            }
        };
    }

    if (next.prereqs.completed[PR.VORS_PRIZE] === true) {
        next.prereqs.completed[PR.AWAKENING] = true;
    }

    if (incoming.inventory) {
        next.inventory = {
            credits:
                typeof incoming.inventory.credits === "number"
                    ? Math.max(0, Math.floor(incoming.inventory.credits))
                    : next.inventory.credits,
            platinum:
                typeof incoming.inventory.platinum === "number"
                    ? Math.max(0, Math.floor(incoming.inventory.platinum))
                    : next.inventory.platinum,
            counts: {
                ...next.inventory.counts,
                ...(incoming.inventory.counts ?? {})
            },
            modRanks: {
                ...(next.inventory.modRanks ?? {}),
                ...(incoming.inventory.modRanks ?? {})
            },
            modRankCounts: {
                ...(next.inventory.modRankCounts ?? {}),
                ...(incoming.inventory.modRankCounts ?? {})
            },
            modUnknownRankCounts: {
                ...(next.inventory.modUnknownRankCounts ?? {}),
                ...(incoming.inventory.modUnknownRankCounts ?? {})
            },
            arcaneRanks: {
                ...normalizeArcaneRanksMap(next.inventory.arcaneRanks ?? {}),
                ...normalizeArcaneRanksMap(incoming.inventory.arcaneRanks ?? {})
            },
            arcaneRankCounts: {
                ...(next.inventory.arcaneRankCounts ?? {}),
                ...(incoming.inventory.arcaneRankCounts ?? {})
            },
            arcaneUnknownRankCounts: {
                ...(next.inventory.arcaneUnknownRankCounts ?? {}),
                ...(incoming.inventory.arcaneUnknownRankCounts ?? {})
            },
            customRivens: Array.isArray(incoming.inventory.customRivens)
                ? incoming.inventory.customRivens
                : next.inventory.customRivens ?? [],
            alecaFrameUnresolvedRecords: Array.isArray(incoming.inventory.alecaFrameUnresolvedRecords)
                ? incoming.inventory.alecaFrameUnresolvedRecords
                : next.inventory.alecaFrameUnresolvedRecords ?? [],
        };
    }

    if (incoming.syndicates !== undefined) {
        next.syndicates = incoming.syndicates;
    }

    if (incoming.dailyTasks !== undefined) {
        next.dailyTasks = incoming.dailyTasks;
    }

    if (incoming.resetChecklist !== undefined) {
        (next as any).resetChecklist = incoming.resetChecklist;
    }

    if (incoming.goals !== undefined) {
        next.goals = incoming.goals;
    }

    if (incoming.mastery !== undefined) {
        next.mastery = incoming.mastery;
    }

    if (incoming.missions !== undefined) {
        next.missions = incoming.missions;
    }

    if (incoming.challenges !== undefined) {
        next.challenges = incoming.challenges;
    }

    if (incoming.intrinsics !== undefined) {
        next.intrinsics = incoming.intrinsics;
    }

    if (incoming.worldState !== undefined) {
        next.worldState = incoming.worldState;
    }

    if (incoming.modBuilder !== undefined) {
        next.modBuilder = {
            savedBuilds: Array.isArray(incoming.modBuilder?.savedBuilds)
                ? incoming.modBuilder.savedBuilds
                : next.modBuilder?.savedBuilds ?? [],
            ownedModNames: Array.isArray(incoming.modBuilder?.ownedModNames)
                ? incoming.modBuilder.ownedModNames
                : next.modBuilder?.ownedModNames ?? []
        };
    }

    ensureGoalsArray(next);
    ensureUiExpansion(next);
    ensureResetChecklistState(next);

    return next;
}

/** Restore a pack as the complete local state, defaulting fields omitted by older packs. */
export function replaceProgressPackState(incoming: z.infer<typeof ProgressPackSchemaV2>): UserStateV2 {
    const restored = mergeProgressPackIntoState(makeDefaultState(), incoming);
    if (typeof incoming?.meta?.createdAtIso === "string") {
        restored.meta.createdAtIso = incoming.meta.createdAtIso;
    }
    restored.meta.updatedAtIso = nowIso();
    return restored;
}
