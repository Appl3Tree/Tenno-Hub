// ===== FILE: src/store/migrations.ts =====
import { z } from "zod";
import type { UserStateV2 } from "../domain/models/userState";
import type { ResetDisplayMode } from "../domain/types";
import {
    nowIso,
    normalizeStringArray,
    getCurrentPrimaryDailyResetKey,
    getCurrentSecondaryDailyResetKey,
    getCurrentWeeklyMondayResetKey,
    getCurrentWeeklyFridayResetKey,
} from "./storeUtils";
import { normalizeArcaneRankMap } from "../domain/logic/arcaneInventory";
import { PR } from "../domain/ids/prereqIds";
import { migratePrereqCompletionAliases } from "./prereqCompletionMigration";

const LegacyPayloadSchema = z
    .object({
        inventory: z.any().optional(),
        syndicates: z.any().optional(),
        reserves: z.any().optional(),
        dailyTasks: z.any().optional(),
        goals: z.any().optional()
    })
    .passthrough();

const UserStateV1Schema = z
    .object({
        meta: z
            .object({
                schemaVersion: z.literal(1),
                createdAtIso: z.string(),
                updatedAtIso: z.string()
            })
            .passthrough(),
        player: z
            .object({
                platform: z.string(),
                displayName: z.string(),
                masteryRank: z.number().nullable()
            })
            .passthrough(),
        ui: z
            .object({
                activePage: z.string()
            })
            .passthrough(),
        prereqs: z
            .object({
                completed: z.record(z.string(), z.boolean())
            })
            .passthrough(),
        inventory: z.any().optional(),
        syndicates: z.any().optional(),
        reserves: z.any().optional(),
        dailyTasks: z.any().optional(),
        goals: z.any().optional()
    })
    .passthrough();

const UserStateV2Schema = z
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
                platform: z.string(),
                displayName: z.string(),
                masteryRank: z.number().nullable()
            })
            .passthrough(),
        ui: z
            .object({
                activePage: z.string()
            })
            .passthrough(),
        prereqs: z
            .object({
                completed: z.record(z.string(), z.boolean())
            })
            .passthrough(),
        inventory: z.any().optional(),
        syndicates: z.any().optional(),
        reserves: z.any().optional(),
        dailyTasks: z.any().optional(),
        resetChecklist: z.any().optional(),
        mastery: z.any().optional(),
        missions: z.any().optional(),
        goals: z.any().optional()
    })
    .passthrough();

function normalizeInventory(raw: any): any {
    const inv = raw && typeof raw === "object" ? raw : {};
    const rawCounts =
        (inv as any).counts && typeof (inv as any).counts === "object"
            ? (inv as any).counts
            : (inv as any).items && typeof (inv as any).items === "object"
                ? (inv as any).items
                : {};

    const creditsCandidate = (inv as any).credits ?? (rawCounts as any)["credits"] ?? (rawCounts as any)["Credits"] ?? 0;
    const platinumCandidate = (inv as any).platinum ?? (rawCounts as any)["platinum"] ?? (rawCounts as any)["Platinum"] ?? 0;

    const credits = Number.isFinite(Number(creditsCandidate))
        ? Math.max(0, Math.floor(Number(creditsCandidate)))
        : 0;
    const platinum = Number.isFinite(Number(platinumCandidate))
        ? Math.max(0, Math.floor(Number(platinumCandidate)))
        : 0;

    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawCounts)) {
        if (k === "credits" || k === "Credits" || k === "platinum" || k === "Platinum") {
            continue;
        }
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        counts[k] = Math.max(0, n);
    }

    const rawModRanks = (inv as any).modRanks && typeof (inv as any).modRanks === "object"
        ? (inv as any).modRanks
        : {};
    const modRanks: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawModRanks)) {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        modRanks[k] = Math.max(0, Math.floor(n));
    }

    const rawArcaneRanks = (inv as any).arcaneRanks && typeof (inv as any).arcaneRanks === "object"
        ? (inv as any).arcaneRanks
        : {};
    const arcaneRanks: Record<string, Record<string, number>> = {};
    for (const [path, byRank] of Object.entries(rawArcaneRanks)) {
        if (!byRank || typeof byRank !== "object") continue;
        const normalizedByRank: Record<string, number> = {};
        for (const [rank, count] of Object.entries(byRank as Record<string, unknown>)) {
            const n = typeof count === "number" ? count : Number(count);
            if (!Number.isFinite(n)) continue;
            normalizedByRank[String(rank)] = Math.max(0, Math.floor(n));
        }
        arcaneRanks[path] = normalizeArcaneRankMap(normalizedByRank);
    }

    const customRivens = Array.isArray((inv as any).customRivens)
        ? (inv as any).customRivens.filter((entry: unknown) => !!entry && typeof entry === "object")
        : [];

    const alecaFrameUnresolvedRecords = Array.isArray((inv as any).alecaFrameUnresolvedRecords)
        ? (inv as any).alecaFrameUnresolvedRecords.slice(0, 100_000).flatMap((entry: unknown) => {
            if (!entry || typeof entry !== "object") return [];
            const candidate = entry as Record<string, unknown>;
            if (typeof candidate.path !== "string" || !candidate.path.startsWith("/Lotus/") ||
                candidate.path.length > 512 ||
                (candidate.kind !== "item" && candidate.kind !== "upgrade") ||
                !Number.isSafeInteger(candidate.quantity) || (candidate.quantity as number) < 0 ||
                typeof candidate.reason !== "string") return [];
            const sourceSections = Array.isArray(candidate.sourceSections)
                ? candidate.sourceSections.filter((section): section is string =>
                    typeof section === "string" && section.length <= 256).slice(0, 64)
                : [];
            const rankCounts: Record<string, number> = {};
            if (candidate.rankCounts && typeof candidate.rankCounts === "object" && !Array.isArray(candidate.rankCounts)) {
                for (const [rank, count] of Object.entries(candidate.rankCounts as Record<string, unknown>)) {
                    if (Number.isSafeInteger(Number(rank)) && Number(rank) >= 0 &&
                        Number.isSafeInteger(count) && (count as number) >= 0) rankCounts[rank] = count as number;
                }
            }
            return [{
                path: candidate.path,
                kind: candidate.kind,
                sourceSections,
                quantity: candidate.quantity as number,
                ...(Object.keys(rankCounts).length > 0 ? { rankCounts } : {}),
                ...(typeof candidate.rankCountsComplete === "boolean"
                    ? { rankCountsComplete: candidate.rankCountsComplete } : {}),
                reason: candidate.reason.slice(0, 256),
            }];
        })
        : [];

    const modRankCounts: Record<string, Record<string, number>> = {};
    const saved = (inv as any).modRankCounts;
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        for (const [path, ranks] of Object.entries(saved as Record<string, unknown>)) {
            if (!ranks || typeof ranks !== "object" || Array.isArray(ranks)) continue;
            const valid: Record<string, number> = {};
            for (const [rank, value] of Object.entries(ranks)) {
                const numericRank = Number(rank);
                const count = Number(value);
                if (!Number.isSafeInteger(numericRank) || numericRank < 0 ||
                    !Number.isSafeInteger(count) || count < 0) continue;
                valid[String(numericRank)] = count;
            }
            modRankCounts[path] = valid;
        }
    }

    const arcaneRankCounts: Record<string, Record<string, number>> = {};
    const savedArcaneCounts = (inv as any).arcaneRankCounts;
    if (savedArcaneCounts && typeof savedArcaneCounts === "object" && !Array.isArray(savedArcaneCounts)) {
        for (const [path, ranks] of Object.entries(savedArcaneCounts as Record<string, unknown>)) {
            if (!ranks || typeof ranks !== "object" || Array.isArray(ranks)) continue;
            const valid: Record<string, number> = {};
            for (const [rank, value] of Object.entries(ranks)) {
                const numericRank = Number(rank);
                const count = Number(value);
                if (!Number.isSafeInteger(numericRank) || numericRank < 0 ||
                    !Number.isSafeInteger(count) || count < 0) continue;
                valid[String(numericRank)] = count;
            }
            arcaneRankCounts[path] = valid;
        }
    }

    const normalizeUnknownRankCounts = (value: unknown): Record<string, number> => {
        const result: Record<string, number> = {};
        if (!value || typeof value !== "object" || Array.isArray(value)) return result;
        for (const [path, rawCount] of Object.entries(value as Record<string, unknown>)) {
            if (!path.startsWith("/Lotus/") || path.length > 512) continue;
            const count = Number(rawCount);
            if (Number.isSafeInteger(count) && count >= 0) result[path] = count;
        }
        return result;
    };
    const modUnknownRankCounts = normalizeUnknownRankCounts((inv as any).modUnknownRankCounts);
    const arcaneUnknownRankCounts = normalizeUnknownRankCounts((inv as any).arcaneUnknownRankCounts);

    return {
        credits, platinum, counts, modRanks, modRankCounts, modUnknownRankCounts,
        arcaneRanks, arcaneRankCounts, arcaneUnknownRankCounts,
        customRivens, alecaFrameUnresolvedRecords,
    };
}

function normalizeMastery(raw: any): { xpByItem: Record<string, number>; mastered: Record<string, boolean>; overLevelMastered: Record<string, boolean> } {
    const m = raw && typeof raw === "object" ? raw : {};
    const xp = (m as any).xpByItem && typeof (m as any).xpByItem === "object" ? (m as any).xpByItem : {};
    const mastered = (m as any).mastered && typeof (m as any).mastered === "object" ? (m as any).mastered : {};
    const overLevelRaw = (m as any).overLevelMastered && typeof (m as any).overLevelMastered === "object" ? (m as any).overLevelMastered : {};

    const xpByItem: Record<string, number> = {};
    for (const [k, v] of Object.entries(xp)) {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        xpByItem[k] = Math.max(0, Math.floor(n));
    }

    const masteredMap: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(mastered)) {
        masteredMap[k] = v === true;
    }

    const overLevelMastered: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(overLevelRaw)) {
        overLevelMastered[k] = v === true;
    }

    return { xpByItem, mastered: masteredMap, overLevelMastered };
}

function normalizeMissions(raw: any): {
    completesByTag: Record<string, number>;
    nodeCompleted?: Record<string, boolean>;
    steelPathNodeCompleted?: Record<string, boolean>;
} {
    const m = raw && typeof raw === "object" ? raw : {};
    const c =
        (m as any).completesByTag && typeof (m as any).completesByTag === "object"
            ? (m as any).completesByTag
            : {};

    const completesByTag: Record<string, number> = {};
    for (const [k, v] of Object.entries(c)) {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        completesByTag[k] = Math.max(0, Math.floor(n));
    }

    const result: ReturnType<typeof normalizeMissions> = { completesByTag };

    if ((m as any).nodeCompleted && typeof (m as any).nodeCompleted === "object") {
        const nc: Record<string, boolean> = {};
        for (const [k, v] of Object.entries((m as any).nodeCompleted as Record<string, unknown>)) {
            if (v === true) nc[k] = true;
        }
        result.nodeCompleted = nc;
    }

    if ((m as any).steelPathNodeCompleted && typeof (m as any).steelPathNodeCompleted === "object") {
        const sp: Record<string, boolean> = {};
        for (const [k, v] of Object.entries((m as any).steelPathNodeCompleted as Record<string, unknown>)) {
            if (v === true) sp[k] = true;
        }
        result.steelPathNodeCompleted = sp;
    }

    return result;
}

function normalizePrereqsCompleted(raw: any): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    if (!raw || typeof raw !== "object") return out;

    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        out[String(k)] = v === true;
    }
    if (out.activity_circuit_sp === true) {
        out.activity_circuit_steel_path = true;
    }
    delete out.activity_circuit_sp;
    // Anyone who has completed Vor's Prize necessarily completed its newly
    // tracked predecessor, The Awakening. Avoid backtracking old saves.
    if (out[PR.VORS_PRIZE] === true) out[PR.AWAKENING] = true;
    return migratePrereqCompletionAliases(out);
}

function normalizeGoals(raw: any): any[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((g) => g && typeof g === "object");
}

function normalizeResetChecklist(raw: any) {
    const now = new Date();
    const timeMode: ResetDisplayMode = raw?.timeMode === "local" ? "local" : "utc";

    return {
        primaryDailyResetKey:
            typeof raw?.primaryDailyResetKey === "string" && raw.primaryDailyResetKey.trim()
                ? raw.primaryDailyResetKey
                : typeof raw?.dailyResetKey === "string" && raw.dailyResetKey.trim()
                    ? raw.dailyResetKey
                    : getCurrentPrimaryDailyResetKey(now),
        secondaryDailyResetKey:
            typeof raw?.secondaryDailyResetKey === "string" && raw.secondaryDailyResetKey.trim()
                ? raw.secondaryDailyResetKey
                : getCurrentSecondaryDailyResetKey(now),
        weeklyMondayResetKey:
            typeof raw?.weeklyMondayResetKey === "string" && raw.weeklyMondayResetKey.trim()
                ? raw.weeklyMondayResetKey
                : typeof raw?.weeklyResetKey === "string" && raw.weeklyResetKey.trim()
                    ? raw.weeklyResetKey
                    : getCurrentWeeklyMondayResetKey(now),
        weeklyFridayResetKey:
            typeof raw?.weeklyFridayResetKey === "string" && raw.weeklyFridayResetKey.trim()
                ? raw.weeklyFridayResetKey
                : getCurrentWeeklyFridayResetKey(now),
        completedPrimaryDailyTaskIds: normalizeStringArray(raw?.completedPrimaryDailyTaskIds ?? raw?.completedDailyTaskIds),
        completedSecondaryDailyTaskIds: normalizeStringArray(raw?.completedSecondaryDailyTaskIds),
        completedWeeklyMondayTaskIds: normalizeStringArray(raw?.completedWeeklyMondayTaskIds ?? raw?.completedWeeklyTaskIds),
        completedWeeklyFridayTaskIds: normalizeStringArray(raw?.completedWeeklyFridayTaskIds),
        timeMode,
    };
}

export function migrateToUserStateV2(raw: unknown): UserStateV2 | null {
    const v2 = UserStateV2Schema.safeParse(raw);
    if (v2.success) {
        const data: any = v2.data;
        data.inventory = normalizeInventory(data.inventory);
        data.mastery = normalizeMastery(data.mastery);
        data.missions = normalizeMissions(data.missions);

        data.prereqs = {
            completed: normalizePrereqsCompleted(data.prereqs?.completed)
        };

        if (!data.player || typeof data.player !== "object") {
            data.player = { platform: "PC", displayName: "", masteryRank: null, accountId: "" };
        } else if (typeof data.player.accountId !== "string") {
            data.player.accountId = "";
        }

        if (!Array.isArray(data.syndicates)) data.syndicates = [];
        if (!Array.isArray(data.dailyTasks)) data.dailyTasks = [];

        data.resetChecklist = normalizeResetChecklist(data.resetChecklist);
        data.goals = normalizeGoals(data.goals);

        normalizeWorldStateProgress(data as UserStateV2);

        return data as UserStateV2;
    }

    const v1 = UserStateV1Schema.safeParse(raw);
    if (v1.success) {
        const migrated: UserStateV2 = {
            meta: {
                schemaVersion: 2,
                createdAtIso: v1.data.meta.createdAtIso ?? nowIso(),
                updatedAtIso: nowIso()
            },
            player: {
                ...(v1.data.player as any),
                accountId: ""
            },
            ui: v1.data.ui as any,
            prereqs: {
                completed: normalizePrereqsCompleted(v1.data.prereqs?.completed)
            },
            inventory: normalizeInventory(v1.data.inventory),
            syndicates: (v1.data as any).syndicates ?? [],
            dailyTasks: (v1.data as any).dailyTasks ?? [],
            resetChecklist: normalizeResetChecklist(undefined),
            goals: normalizeGoals((v1.data as any).goals),
            mastery: normalizeMastery((v1.data as any).mastery),
            missions: normalizeMissions((v1.data as any).missions)
        };

        const ok = z
            .object({
                meta: z.any(),
                player: z.any(),
                ui: z.any(),
                prereqs: z.object({ completed: z.record(z.string(), z.boolean()) }),
                inventory: z.any(),
                syndicates: z.any(),
                dailyTasks: z.any(),
                resetChecklist: z.any(),
                goals: z.any(),
                mastery: z.any(),
                missions: z.any()
            })
            .passthrough()
            .safeParse(migrated);

        return ok.success ? migrated : null;
    }

    const legacy = LegacyPayloadSchema.safeParse(raw);
    if (legacy.success) {
        const migrated: UserStateV2 = {
            meta: {
                schemaVersion: 2,
                createdAtIso: nowIso(),
                updatedAtIso: nowIso()
            },
            player: {
                platform: "PC",
                accountId: "",
                displayName: "",
                masteryRank: null
            },
            ui: {
                activePage: "dashboard",
                expandedGoalNodes: {}
            },
            prereqs: {
                completed: {}
            },
            inventory: normalizeInventory(legacy.data.inventory),
            syndicates: legacy.data.syndicates ?? [],
            dailyTasks: legacy.data.dailyTasks ?? [],
            resetChecklist: normalizeResetChecklist(undefined),
            goals: normalizeGoals((legacy.data as any).goals),
            mastery: normalizeMastery((legacy.data as any).mastery),
            missions: normalizeMissions((legacy.data as any).missions)
        };

        const ok = z
            .object({
                meta: z.any(),
                player: z.any(),
                ui: z.any(),
                prereqs: z.object({ completed: z.record(z.string(), z.boolean()) }),
                inventory: z.any(),
                syndicates: z.any(),
                dailyTasks: z.any(),
                resetChecklist: z.any(),
                goals: z.any(),
                mastery: z.any(),
                missions: z.any()
            })
            .passthrough()
            .safeParse(migrated);

        return ok.success ? migrated : null;
    }

    return null;
}

/** Normalize persisted World State completion arrays without applying ambiguous legacy event IDs. */
export function normalizeWorldStateProgress(state: UserStateV2): void {
    if (!state.worldState || typeof state.worldState !== "object") return;
    const uniqueStrings = (value: unknown): string[] => Array.isArray(value)
        ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))]
        : [];
    state.worldState.doneInvasions = uniqueStrings(state.worldState.doneInvasions);
    state.worldState.doneNightwaveChallenges = uniqueStrings(state.worldState.doneNightwaveChallenges);
    // Legacy IDs remain available for export/recovery but do not identify a specific event rotation.
    state.worldState.doneEvents = uniqueStrings(state.worldState.doneEvents);
    state.worldState.doneEventInstances = uniqueStrings(state.worldState.doneEventInstances);
}
