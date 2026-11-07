// ===== FILE: src/store/store.ts =====
// Main Zustand store — TrackerStore interface + create() call.
// All helpers live in sibling files:
//   storeUtils.ts       — nowIso, uid, date key functions
//   resetChecklist.ts   — reset checklist state helpers
//   progressPack.ts     — default state, schemas, mergeProgressPackIntoState
//   syndicateSlice.ts   — syndicate patching and pledge helpers

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import { toYMD } from "../domain/ymd";
import type {
    CustomRivenRecord,
    DailyTask,
    Inventory,
    ResetChecklistBucket,
    ResetDisplayMode,
    SyndicateState
} from "../domain/types";
import type { PageKey, UserGoalV1, UserStateV2 } from "../domain/models/userState";
import { migrateToUserStateV2 } from "./migrations";
import type { ProfileImportResult } from "../utils/profileImport";
import { SY } from "../domain/ids/syndicateIds";
import { PERSIST_KEY, PERSIST_VERSION } from "./persistence";
import {
    nowIso, uid,
    getCurrentPrimaryDailyResetKey,
    getCurrentSecondaryDailyResetKey,
    getCurrentWeeklyMondayResetKey,
    getCurrentWeeklyFridayResetKey,
} from "./storeUtils";
import {
    ensureResetChecklistState,
    syncResetChecklistState,
    getResetTaskArray,
} from "./resetChecklist";
import {
    makeDefaultState,
    ProgressPackSchemaV2,
    ensureGoalsArray,
    ensureUiExpansion,
    mergeProgressPackIntoState,
} from "./progressPack";
import { setHighestOwnedArcaneRank } from "../domain/logic/arcaneInventory";
import {
    normalizeSyndicatePatch,
    upsertSyndicateIntoList,
    isPrimaryFactionId,
    countPrimaryPledges,
} from "./syndicateSlice";

export interface TrackerStore {
    state: UserStateV2;

    setActivePage: (page: PageKey) => void;

    setPrereqCompleted: (prereqId: string, completed: boolean) => void;
    bulkOverwritePrereqs: (patch: Record<string, boolean>) => void;

    setCount: (key: string, count: number) => void;
    setModRank: (path: string, rank: number) => void;
    setArcaneRankCount: (path: string, rank: number, count: number) => void;
    upsertCustomRiven: (riven: CustomRivenRecord) => void;
    deleteCustomRiven: (id: string) => void;
    setMastered: (key: string, val: boolean) => void;
    setOverLevelMastered: (key: string, val: boolean) => void;

    setCredits: (credits: number) => void;
    setPlatinum: (platinum: number) => void;
    setMasteryRank: (masteryRank: number | null) => void;
    setIntrinsicRank: (mode: "proxima" | "duviri", key: string, rank: number) => void;

    setAccountId: (accountId: string) => void;
    setPlatform: (platform: "PC" | "PlayStation" | "Xbox" | "Switch" | "Mobile") => void;

    importProfileViewingDataJson: (text: string) => Promise<{ ok: boolean; error?: string }>;
    importProfileFromWarframeStatApi: (json: unknown) => Promise<{ ok: boolean; error?: string }>;

    upsertDailyTask: (dateYmd: string, label: string, syndicate?: string, details?: string) => void;
    toggleDailyTask: (taskId: string) => void;
    deleteDailyTask: (taskId: string) => void;

    syncResetChecklistResets: () => void;
    toggleResetChecklistTask: (taskId: string, bucket: ResetChecklistBucket) => void;
    clearResetChecklistTasks: (bucket: ResetChecklistBucket) => void;
    isResetChecklistTaskCompleted: (taskId: string, bucket: ResetChecklistBucket) => boolean;
    setResetChecklistTimeMode: (mode: ResetDisplayMode) => void;

    upsertSyndicate: (patch: Partial<SyndicateState>) => void;

    togglePrimaryPledge: (syndicateId: string) => void;
    clearPrimaryPledges: () => void;

    exportProgressPackJson: () => string;
    importProgressPackJson: (json: string) => { ok: boolean; error?: string };
    applyAlecaFrameInventory: (inventory: Inventory) => { ok: boolean; error?: string };

    resetToDefaults: () => void;
    resetAllLocalData: () => void;

    getTodayTasks: () => DailyTask[];

    addGoalCatalog: (catalogId: string, qty?: number, goalType?: "item" | "mod" | "arcane") => void;
    addGoalItem: (catalogId: string, qty?: number) => void;
    removeGoal: (goalId: string) => void;
    setGoalQty: (goalId: string, qty: number) => void;
    setGoalNote: (goalId: string, note: string) => void;
    toggleGoalActive: (goalId: string) => void;
    setGoalComponentCompleted: (goalId: string, componentKey: string, done: boolean) => void;
    clearAllGoals: () => void;

    toggleExpandedGoalNode: (nodeId: string) => void;
    setExpandedGoalNode: (nodeId: string, expanded: boolean) => void;
    isExpandedGoalNode: (nodeId: string) => boolean;

    setNodeCompleted: (starChartNodeId: string, completed: boolean) => void;
    setBulkNodesCompleted: (starChartNodeIds: string[], completed: boolean) => void;
    isNodeCompleted: (starChartNodeId: string) => boolean;
    setSteelPathNodeCompleted: (starChartNodeId: string, completed: boolean) => void;
    setBulkSteelPathNodesCompleted: (starChartNodeIds: string[], completed: boolean) => void;

    toggleInvasionDone: (id: string) => void;
    isInvasionDone: (id: string) => boolean;

    toggleNightwaveChallengeDone: (id: string) => void;
    isNightwaveChallengeDone: (id: string) => boolean;
    setNightwaveChallengesDone: (ids: string[], done: boolean) => void;

    toggleEventDone: (id: string) => void;
    isEventDone: (id: string) => boolean;

    toggleWorldStateCategoryHidden: (cat: string) => void;
    isWorldStateCategoryHidden: (cat: string) => boolean;
    getHiddenWorldStateCategories: () => string[];

    // ── Mod Builder ──────────────────────────────────────────────────────────
    saveModBuild: (build: import("../domain/models/userState").SavedBuild) => void;
    deleteModBuild: (id: string) => void;
    getSavedBuilds: () => import("../domain/models/userState").SavedBuild[];
    setOwnedModNames: (names: string[]) => void;
    getOwnedModNames: () => string[];
}

/**
 * Applies a parsed profile import to the Immer draft state.
 * Shared between importProfileViewingDataJson and importProfileFromWarframeStatApi,
 * which differ only in their parsing step.
 */
function applyParsedProfile(state: UserStateV2, parsed: ProfileImportResult): void {
    state.player.displayName = parsed.displayName || state.player.displayName;
    if (parsed.masteryRank !== null) state.player.masteryRank = parsed.masteryRank;

    if (parsed.clan?.name !== undefined) state.player.clanName = parsed.clan.name;
    if (parsed.clan?.tier !== undefined) state.player.clanTier = parsed.clan.tier;
    if (parsed.clan?.clanClass !== undefined) state.player.clanClass = parsed.clan.clanClass;
    if (parsed.clan?.xp !== undefined) state.player.clanXp = parsed.clan.xp;

    // Merge syndicates: preserve manually-entered pledged and standing values.
    const existingById = new Map<string, SyndicateState>();
    for (const syn of state.syndicates ?? []) {
        if (syn && typeof syn.id === "string") existingById.set(syn.id, syn);
    }
    const merged: SyndicateState[] = [];
    for (const incoming of parsed.syndicates ?? []) {
        const prev = existingById.get(incoming.id);
        const pledged = typeof prev?.pledged === "boolean" ? prev.pledged : false;
        const standing = typeof prev?.standing === "number" ? prev.standing : (incoming.standing ?? 0);
        merged.push({ ...incoming, pledged, standing });
        existingById.delete(incoming.id);
    }
    for (const leftover of existingById.values()) merged.push(leftover);
    state.syndicates = merged;

    // Normalize mastery keys from raw Lotus paths ("/Lotus/...") to
    // catalog IDs ("items:/Lotus/...") so they match the format used
    // by setMastered() and inventory lookups.
    const normalizedMastered: Record<string, boolean> = {};
    const normalizedXp: Record<string, number> = {};
    for (const [path, val] of Object.entries(parsed.mastery.mastered)) {
        const key = path.startsWith("items:") ? path : `items:${path}`;
        normalizedMastered[key] = val as boolean;
    }
    for (const [path, xp] of Object.entries(parsed.mastery.xpByItem)) {
        const key = path.startsWith("items:") ? path : `items:${path}`;
        normalizedXp[key] = xp as number;
    }
    // Preserve manually set overLevelMastered across imports.
    const prevOverLevel = state.mastery?.overLevelMastered ?? {};
    state.mastery = { xpByItem: normalizedXp, mastered: normalizedMastered, overLevelMastered: prevOverLevel };

    state.missions = parsed.missions;
    if (parsed.completedNodeIds.length > 0) {
        if (!state.missions.nodeCompleted) state.missions.nodeCompleted = {};
        for (const id of parsed.completedNodeIds) {
            state.missions.nodeCompleted[id] = true;
        }
    }

    if (parsed.challenges) state.challenges = parsed.challenges;
    if (parsed.intrinsics) state.intrinsics = parsed.intrinsics;

    // Merge mod counts into inventory (keyed as "mods:<LotusPath>").
    // Overwrite existing counts for mods present in the import; leave
    // manually-entered counts for mods not in the export intact.
    if (parsed.modCounts && Object.keys(parsed.modCounts).length > 0) {
        if (!state.inventory.counts) state.inventory.counts = {};
        for (const [key, count] of Object.entries(parsed.modCounts)) {
            state.inventory.counts[key] = count;
        }
    }

    // Mark standing tasks done in the WarframeResetTracker when the daily cap
    // is fully spent. parseProfileViewingData returns empty arrays so this
    // block is skipped for that source.
    const { primary_daily: pdIds, conclave_daily: cdIds } = parsed.completedResetTaskIds;
    if (pdIds.length > 0 || cdIds.length > 0) {
        try {
            const now = new Date();
            const primaryKey = now.toISOString().slice(0, 10);
            const th16 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16));
            const conclaveDayKey = now >= th16
                ? th16.toISOString().slice(0, 10)
                : new Date(th16.getTime() - 86_400_000).toISOString().slice(0, 10);

            let rc: Record<string, any> = {};
            try { rc = JSON.parse(localStorage.getItem("wfpt:resetChecklist") ?? "{}") ?? {}; } catch { /* */ }

            if (pdIds.length > 0) {
                const prev: string[] = Array.isArray(rc.completedPrimaryDailyTaskIds) ? rc.completedPrimaryDailyTaskIds : [];
                rc = { ...rc, primaryDailyResetKey: primaryKey, completedPrimaryDailyTaskIds: [...new Set([...prev, ...pdIds])] };
            }
            if (cdIds.length > 0) {
                const prev: string[] = Array.isArray(rc.completedConclaveDailyTaskIds) ? rc.completedConclaveDailyTaskIds : [];
                rc = { ...rc, conclaveDailyResetKey: conclaveDayKey, completedConclaveDailyTaskIds: [...new Set([...prev, ...cdIds])] };
            }

            localStorage.setItem("wfpt:resetChecklist", JSON.stringify(rc));
            window.dispatchEvent(new CustomEvent("wfpt:resetChecklist:external-update"));
        } catch { /* ignore storage errors */ }
    }

    ensureGoalsArray(state);
    ensureUiExpansion(state);
    ensureResetChecklistState(state);
    state.meta.updatedAtIso = nowIso();
}

export const useTrackerStore = create<TrackerStore>()(
    persist(
        immer((set, get) => ({
            state: makeDefaultState(),

            setActivePage: (page) => {
                if (page !== "search_detail" && typeof window !== "undefined" && window.location.hash.startsWith("#search-detail")) {
                    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
                }
                set((s) => {
                    s.state.ui.activePage = page;
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setPrereqCompleted: (prereqId, completed) => {
                set((s) => {
                    s.state.prereqs.completed[prereqId] = completed;
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            bulkOverwritePrereqs: (patch) => {
                set((s) => {
                    Object.assign(s.state.prereqs.completed, patch);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setCount: (key, count) => {
                set((s) => {
                    if (!s.state.inventory.counts) {
                        s.state.inventory.counts = {};
                    }
                    s.state.inventory.counts[key] = Math.max(0, Number.isFinite(count) ? count : 0);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setModRank: (path, rank) => {
                set((s) => {
                    if (!s.state.inventory.modRanks) s.state.inventory.modRanks = {};
                    s.state.inventory.modRanks[path] = Math.max(0, Number.isFinite(rank) ? Math.floor(rank) : 0);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setArcaneRankCount: (path, rank, count) => {
                set((s) => {
                    if (!s.state.inventory.arcaneRanks) s.state.inventory.arcaneRanks = {};
                    if (!s.state.inventory.arcaneRankCounts) s.state.inventory.arcaneRankCounts = {};
                    if (s.state.inventory.arcaneUnknownRankCounts) delete s.state.inventory.arcaneUnknownRankCounts[path];
                    s.state.inventory.arcaneRankCounts[path] =
                        Number.isFinite(count) && count > 0
                            ? { [String(Math.max(0, Math.floor(rank)))]: Math.max(0, Math.floor(count)) }
                            : {};
                    s.state.inventory.arcaneRanks[path] = setHighestOwnedArcaneRank(Number.isFinite(count) && count > 0 ? rank : null);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            upsertCustomRiven: (riven) => {
                set((s) => {
                    if (!Array.isArray(s.state.inventory.customRivens)) s.state.inventory.customRivens = [];
                    const idx = s.state.inventory.customRivens.findIndex((entry) => entry.id === riven.id);
                    if (idx >= 0) s.state.inventory.customRivens[idx] = riven;
                    else s.state.inventory.customRivens.push(riven);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            deleteCustomRiven: (id) => {
                set((s) => {
                    if (!Array.isArray(s.state.inventory.customRivens)) return;
                    s.state.inventory.customRivens = s.state.inventory.customRivens.filter((entry) => entry.id !== id);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setMastered: (key, val) => {
                set((s) => {
                    if (!s.state.mastery) s.state.mastery = { xpByItem: {}, mastered: {}, overLevelMastered: {} };
                    if (!s.state.mastery.mastered) s.state.mastery.mastered = {};
                    if (val) {
                        s.state.mastery.mastered[key] = true;
                    } else {
                        delete s.state.mastery.mastered[key];
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setOverLevelMastered: (key, val) => {
                set((s) => {
                    if (!s.state.mastery) s.state.mastery = { xpByItem: {}, mastered: {}, overLevelMastered: {} };
                    if (!s.state.mastery.overLevelMastered) s.state.mastery.overLevelMastered = {};
                    if (val) {
                        s.state.mastery.overLevelMastered[key] = true;
                    } else {
                        delete s.state.mastery.overLevelMastered[key];
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setCredits: (credits) => {
                set((s) => {
                    s.state.inventory.credits = Math.max(0, Number.isFinite(credits) ? Math.floor(credits) : 0);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setPlatinum: (platinum) => {
                set((s) => {
                    s.state.inventory.platinum = Math.max(0, Number.isFinite(platinum) ? Math.floor(platinum) : 0);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setMasteryRank: (masteryRank) => {
                set((s) => {
                    if (masteryRank === null) {
                        s.state.player.masteryRank = null;
                    } else {
                        const v = Number(masteryRank);
                        s.state.player.masteryRank = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setIntrinsicRank: (mode, key, rank) => {
                set((s) => {
                    if (!s.state.intrinsics) {
                        s.state.intrinsics = { railjack: {}, duviri: {} };
                    }
                    if (!s.state.intrinsics.railjack) s.state.intrinsics.railjack = {};
                    if (!s.state.intrinsics.duviri) s.state.intrinsics.duviri = {};

                    const target = mode === "proxima" ? s.state.intrinsics.railjack : s.state.intrinsics.duviri;
                    const normalizedRank = Math.max(0, Math.min(10, Number.isFinite(rank) ? Math.floor(rank) : 0));

                    if (normalizedRank === 0) delete target[key];
                    else target[key] = normalizedRank;

                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setAccountId: (accountId) => {
                set((s) => {
                    s.state.player.accountId = String(accountId ?? "").trim();
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setPlatform: (platform) => {
                set((s) => {
                    s.state.player.platform = platform;
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            importProfileViewingDataJson: async (text) => {
                try {
                    const { parseProfileImportText } = await import("../utils/profileImport");
                    const parsed = parseProfileImportText(text);
                    set((s) => { applyParsedProfile(s.state, parsed); });
                    return { ok: true };
                } catch (e: any) {
                    const msg = typeof e?.message === "string" ? e.message : "Invalid profileViewingData file.";
                    return { ok: false, error: msg };
                }
            },

            importProfileFromWarframeStatApi: async (json) => {
                try {
                    const { parseWarframeStatApiProfile } = await import("../utils/profileImport");
                    const parsed = parseWarframeStatApiProfile(json);
                    set((s) => { applyParsedProfile(s.state, parsed); });
                    return { ok: true };
                } catch (e: any) {
                    const msg = typeof e?.message === "string" ? e.message : "warframestat.us API profile import failed.";
                    return { ok: false, error: msg };
                }
            },

            upsertDailyTask: (dateYmd, label, syndicate, details) => {
                set((s) => {
                    const normalized = label.trim().toLowerCase();
                    const existing = s.state.dailyTasks.find(
                        (t) => t.dateYmd === dateYmd && t.label.trim().toLowerCase() === normalized
                    );

                    if (existing) {
                        existing.syndicate = syndicate;
                        existing.details = details;
                    } else {
                        s.state.dailyTasks.push({
                            id: uid("task"),
                            dateYmd,
                            label,
                            syndicate,
                            details,
                            isDone: false,
                        });
                    }

                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            toggleDailyTask: (taskId) => {
                set((s) => {
                    const t = s.state.dailyTasks.find((x) => x.id === taskId);
                    if (t) {
                        t.isDone = !t.isDone;
                        s.state.meta.updatedAtIso = nowIso();
                    }
                });
            },

            deleteDailyTask: (taskId) => {
                set((s) => {
                    s.state.dailyTasks = s.state.dailyTasks.filter((t) => t.id !== taskId);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            syncResetChecklistResets: () => {
                set((s) => {
                    const changed = syncResetChecklistState(s.state, new Date());
                    if (changed) {
                        s.state.meta.updatedAtIso = nowIso();
                    }
                });
            },

            toggleResetChecklistTask: (taskId, bucket) => {
                const id = String(taskId ?? "").trim();
                if (!id) return;

                set((s) => {
                    syncResetChecklistState(s.state, new Date());

                    const arr = getResetTaskArray(s.state, bucket);
                    const idx = arr.indexOf(id);

                    if (idx >= 0) {
                        arr.splice(idx, 1);
                    } else {
                        arr.push(id);
                    }

                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            clearResetChecklistTasks: (bucket) => {
                set((s) => {
                    syncResetChecklistState(s.state, new Date());

                    if (bucket === "primary_daily") {
                        s.state.resetChecklist.completedPrimaryDailyTaskIds = [];
                    } else if (bucket === "secondary_daily") {
                        s.state.resetChecklist.completedSecondaryDailyTaskIds = [];
                    } else if (bucket === "weekly_monday") {
                        s.state.resetChecklist.completedWeeklyMondayTaskIds = [];
                    } else {
                        s.state.resetChecklist.completedWeeklyFridayTaskIds = [];
                    }

                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            isResetChecklistTaskCompleted: (taskId, bucket) => {
                const state = get().state;
                ensureResetChecklistState(state);

                const now = new Date();

                const activeKey =
                    bucket === "primary_daily"
                        ? getCurrentPrimaryDailyResetKey(now)
                        : bucket === "secondary_daily"
                            ? getCurrentSecondaryDailyResetKey(now)
                            : bucket === "weekly_monday"
                                ? getCurrentWeeklyMondayResetKey(now)
                                : getCurrentWeeklyFridayResetKey(now);

                const matchesWindow =
                    bucket === "primary_daily"
                        ? state.resetChecklist.primaryDailyResetKey === activeKey
                        : bucket === "secondary_daily"
                            ? state.resetChecklist.secondaryDailyResetKey === activeKey
                            : bucket === "weekly_monday"
                                ? state.resetChecklist.weeklyMondayResetKey === activeKey
                                : state.resetChecklist.weeklyFridayResetKey === activeKey;

                if (!matchesWindow) return false;

                return getResetTaskArray(state, bucket).includes(String(taskId));
            },

            setResetChecklistTimeMode: (mode) => {
                set((s) => {
                    ensureResetChecklistState(s.state);
                    s.state.resetChecklist.timeMode = mode === "local" ? "local" : "utc";
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            upsertSyndicate: (patch) => {
                const p = normalizeSyndicatePatch(patch);
                if (!p.id) return;

                set((s) => {
                    if (!Array.isArray(s.state.syndicates)) {
                        s.state.syndicates = [];
                    }

                    upsertSyndicateIntoList(s.state.syndicates as any, p);

                    if (typeof p.pledged === "boolean" && isPrimaryFactionId(String(p.id))) {
                        const list = s.state.syndicates as any as SyndicateState[];

                        if (p.pledged === true) {
                            const currentCount = countPrimaryPledges(list);
                            const already = list.find((x) => x.id === p.id)?.pledged === true;
                            if (!already && currentCount >= 3) {
                                return;
                            }
                        }
                    }

                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            togglePrimaryPledge: (syndicateId) => {
                const id = String(syndicateId ?? "").trim();
                if (!id || !isPrimaryFactionId(id)) return;

                set((s) => {
                    if (!Array.isArray(s.state.syndicates)) s.state.syndicates = [];

                    const primary: Array<{ id: string; name: string }> = [
                        { id: SY.STEEL_MERIDIAN, name: "Steel Meridian" },
                        { id: SY.ARBITERS_OF_HEXIS, name: "Arbiters of Hexis" },
                        { id: SY.CEPHALON_SUDA, name: "Cephalon Suda" },
                        { id: SY.THE_PERRIN_SEQUENCE, name: "The Perrin Sequence" },
                        { id: SY.RED_VEIL, name: "Red Veil" },
                        { id: SY.NEW_LOKA, name: "New Loka" }
                    ];

                    for (const p of primary) {
                        upsertSyndicateIntoList(s.state.syndicates as any, { id: p.id, name: p.name });
                    }

                    const list = s.state.syndicates as any as SyndicateState[];
                    const target = list.find((x) => x.id === id);
                    if (!target) return;

                    const next = !target.pledged;

                    if (next === true) {
                        const current = countPrimaryPledges(list);
                        if (current >= 3) {
                            return;
                        }
                    }

                    target.pledged = next;
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            clearPrimaryPledges: () => {
                set((s) => {
                    if (!Array.isArray(s.state.syndicates)) return;
                    for (const syn of s.state.syndicates as any[]) {
                        if (!syn || typeof syn.id !== "string") continue;
                        if (!isPrimaryFactionId(syn.id)) continue;
                        syn.pledged = false;
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            exportProgressPackJson: () => {
                const payload = get().state;
                return JSON.stringify(payload, null, 2);
            },

            importProgressPackJson: (json) => {
                try {
                    const parsed = JSON.parse(json);
                    const ok = ProgressPackSchemaV2.safeParse(parsed);
                    if (!ok.success) {
                        return { ok: false, error: "Invalid Progress Pack (schema v2 required)." };
                    }

                    set((s) => {
                        s.state = mergeProgressPackIntoState(s.state, ok.data);
                        ensureGoalsArray(s.state);
                        ensureUiExpansion(s.state);
                        ensureResetChecklistState(s.state);
                    });

                    return { ok: true };
                } catch {
                    return { ok: false, error: "Invalid JSON." };
                }
            },

            applyAlecaFrameInventory: (inventory) => {
                const previous = get().state.inventory;
                try {
                    const updatedAtIso = nowIso();
                    const validated = ProgressPackSchemaV2.safeParse({
                        meta: {
                            schemaVersion: 2,
                            createdAtIso: get().state.meta.createdAtIso,
                            updatedAtIso,
                        },
                        inventory,
                    });
                    if (!validated.success || !validated.data.inventory) {
                        return { ok: false, error: "The reviewed inventory failed validation; no changes were applied." };
                    }
                    const nextInventory = validated.data.inventory as Inventory;
                    set((s) => {
                        s.state.inventory = nextInventory;
                        s.state.meta.updatedAtIso = updatedAtIso;
                    });
                    return { ok: true };
                } catch {
                    try {
                        set((s) => {
                            s.state.inventory = previous;
                        });
                    } catch {
                        // The downloaded Progress Pack remains available for recovery.
                    }
                    return { ok: false, error: "Import failed. Your previous inventory was restored in memory." };
                }
            },

            resetToDefaults: () => {
                set(() => ({ state: makeDefaultState() }));
            },

            resetAllLocalData: () => {
                try {
                    localStorage.removeItem(PERSIST_KEY);
                } catch (_e) {
                    // ignore storage errors
                }
                set(() => ({ state: makeDefaultState() }));
            },

            getTodayTasks: () => {
                const today = toYMD(new Date());
                return get().state.dailyTasks.filter((t) => t.dateYmd === today);
            },

            addGoalCatalog: (catalogId, qty, goalType = "item") => {
                const cid = String(catalogId ?? "").trim();
                if (!cid) return;

                const q = Number.isFinite(Number(qty)) ? Math.max(1, Math.floor(Number(qty))) : 1;

                set((s) => {
                    ensureGoalsArray(s.state);
                    ensureUiExpansion(s.state);
                    ensureResetChecklistState(s.state);

                    const existing = s.state.goals.find((g: any) => g.type === goalType && g.catalogId === cid);
                    if (existing) {
                        existing.qty = Math.max(1, existing.qty + q);
                        existing.isActive = true;
                        existing.updatedAtIso = nowIso();
                    } else {
                        const iso = nowIso();
                        const goal: UserGoalV1 = {
                            id: uid("goal"),
                            type: goalType,
                            catalogId: cid,
                            qty: q,
                            isActive: true,
                            createdAtIso: iso,
                            updatedAtIso: iso
                        };
                        s.state.goals.push(goal);
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            addGoalItem: (catalogId, qty) => {
                get().addGoalCatalog(catalogId, qty, "item");
            },

            removeGoal: (goalId) => {
                set((s) => {
                    ensureGoalsArray(s.state);
                    ensureUiExpansion(s.state);
                    ensureResetChecklistState(s.state);
                    s.state.goals = s.state.goals.filter((g: any) => g.id !== goalId);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setGoalQty: (goalId, qty) => {
                const q = Number.isFinite(Number(qty)) ? Math.max(1, Math.floor(Number(qty))) : 1;
                set((s) => {
                    ensureGoalsArray(s.state);
                    ensureUiExpansion(s.state);
                    ensureResetChecklistState(s.state);
                    const g = s.state.goals.find((x: any) => x.id === goalId);
                    if (!g) return;
                    g.qty = q;
                    g.updatedAtIso = nowIso();
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setGoalNote: (goalId, note) => {
                set((s) => {
                    ensureGoalsArray(s.state);
                    ensureUiExpansion(s.state);
                    ensureResetChecklistState(s.state);
                    const g = s.state.goals.find((x: any) => x.id === goalId);
                    if (!g) return;
                    g.note = String(note ?? "");
                    g.updatedAtIso = nowIso();
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            toggleGoalActive: (goalId) => {
                set((s) => {
                    ensureGoalsArray(s.state);
                    ensureUiExpansion(s.state);
                    ensureResetChecklistState(s.state);
                    const g = s.state.goals.find((x: any) => x.id === goalId);
                    if (!g) return;
                    g.isActive = !g.isActive;
                    g.updatedAtIso = nowIso();
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setGoalComponentCompleted: (goalId, componentKey, done) => {
                set((s) => {
                    ensureGoalsArray(s.state);
                    const g = s.state.goals.find((x: any) => x.id === goalId);
                    if (!g) return;
                    if (!g.completedComponents || typeof g.completedComponents !== "object") {
                        g.completedComponents = {};
                    }
                    g.completedComponents[componentKey] = done;
                    g.updatedAtIso = nowIso();
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            clearAllGoals: () => {
                set((s) => {
                    s.state.goals = [];
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            toggleExpandedGoalNode: (nodeId) => {
                set((s) => {
                    ensureUiExpansion(s.state);
                    const k = String(nodeId);
                    const cur = Boolean(s.state.ui.expandedGoalNodes?.[k]);
                    s.state.ui.expandedGoalNodes[k] = !cur;
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setExpandedGoalNode: (nodeId, expanded) => {
                set((s) => {
                    ensureUiExpansion(s.state);
                    s.state.ui.expandedGoalNodes[String(nodeId)] = Boolean(expanded);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            isExpandedGoalNode: (nodeId) => {
                const m = get().state.ui.expandedGoalNodes ?? {};
                return Boolean(m[String(nodeId)]);
            },

            setNodeCompleted: (starChartNodeId, completed) => {
                set((s) => {
                    if (!s.state.missions) {
                        s.state.missions = { completesByTag: {} };
                    }
                    if (!s.state.missions.nodeCompleted) {
                        s.state.missions.nodeCompleted = {};
                    }
                    if (completed) {
                        s.state.missions.nodeCompleted[starChartNodeId] = true;
                    } else {
                        delete s.state.missions.nodeCompleted[starChartNodeId];
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setBulkNodesCompleted: (starChartNodeIds, completed) => {
                set((s) => {
                    if (!s.state.missions) {
                        s.state.missions = { completesByTag: {} };
                    }
                    if (!s.state.missions.nodeCompleted) {
                        s.state.missions.nodeCompleted = {};
                    }
                    for (const id of starChartNodeIds) {
                        if (completed) {
                            s.state.missions.nodeCompleted[id] = true;
                        } else {
                            delete s.state.missions.nodeCompleted[id];
                        }
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            isNodeCompleted: (starChartNodeId) => {
                const nc = get().state.missions?.nodeCompleted;
                return Boolean(nc?.[starChartNodeId]);
            },

            setSteelPathNodeCompleted: (starChartNodeId, completed) => {
                set((s) => {
                    if (!s.state.missions) {
                        s.state.missions = { completesByTag: {} };
                    }
                    if (!s.state.missions.steelPathNodeCompleted) {
                        s.state.missions.steelPathNodeCompleted = {};
                    }
                    if (completed) {
                        s.state.missions.steelPathNodeCompleted[starChartNodeId] = true;
                    } else {
                        delete s.state.missions.steelPathNodeCompleted[starChartNodeId];
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            setBulkSteelPathNodesCompleted: (starChartNodeIds, completed) => {
                set((s) => {
                    if (!s.state.missions) {
                        s.state.missions = { completesByTag: {} };
                    }
                    if (!s.state.missions.steelPathNodeCompleted) {
                        s.state.missions.steelPathNodeCompleted = {};
                    }
                    for (const id of starChartNodeIds) {
                        if (completed) {
                            s.state.missions.steelPathNodeCompleted[id] = true;
                        } else {
                            delete s.state.missions.steelPathNodeCompleted[id];
                        }
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            toggleInvasionDone: (id) => {
                set((s) => {
                    if (!s.state.worldState) {
                        s.state.worldState = { doneInvasions: [] };
                    }
                    const list = s.state.worldState.doneInvasions;
                    const idx = list.indexOf(id);
                    if (idx >= 0) {
                        list.splice(idx, 1);
                    } else {
                        list.push(id);
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            isInvasionDone: (id) => {
                return get().state.worldState?.doneInvasions.includes(id) ?? false;
            },

            toggleNightwaveChallengeDone: (id) => {
                set((s) => {
                    if (!s.state.worldState) {
                        s.state.worldState = { doneInvasions: [], doneNightwaveChallenges: [] };
                    }
                    if (!s.state.worldState.doneNightwaveChallenges) {
                        s.state.worldState.doneNightwaveChallenges = [];
                    }
                    const list = s.state.worldState.doneNightwaveChallenges;
                    const idx = list.indexOf(id);
                    if (idx >= 0) { list.splice(idx, 1); } else { list.push(id); }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            isNightwaveChallengeDone: (id) => {
                return get().state.worldState?.doneNightwaveChallenges?.includes(id) ?? false;
            },

            setNightwaveChallengesDone: (ids, done) => {
                set((s) => {
                    if (!s.state.worldState) {
                        s.state.worldState = { doneInvasions: [], doneNightwaveChallenges: [] };
                    }
                    if (!s.state.worldState.doneNightwaveChallenges) {
                        s.state.worldState.doneNightwaveChallenges = [];
                    }
                    const list = s.state.worldState.doneNightwaveChallenges;
                    if (done) {
                        for (const id of ids) {
                            if (!list.includes(id)) list.push(id);
                        }
                    } else {
                        s.state.worldState.doneNightwaveChallenges = list.filter((id) => !ids.includes(id));
                    }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            toggleEventDone: (id) => {
                set((s) => {
                    if (!s.state.worldState) {
                        s.state.worldState = { doneInvasions: [] };
                    }
                    if (!s.state.worldState.doneEvents) {
                        s.state.worldState.doneEvents = [];
                    }
                    const list = s.state.worldState.doneEvents;
                    const idx = list.indexOf(id);
                    if (idx >= 0) { list.splice(idx, 1); } else { list.push(id); }
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            isEventDone: (id) => {
                return get().state.worldState?.doneEvents?.includes(id) ?? false;
            },

            toggleWorldStateCategoryHidden: (cat) => {
                set((s) => {
                    const hidden = s.state.ui.hiddenWorldStateCategories ?? [];
                    const idx = hidden.indexOf(cat as any);
                    if (idx >= 0) {
                        hidden.splice(idx, 1);
                    } else {
                        hidden.push(cat as any);
                    }
                    s.state.ui.hiddenWorldStateCategories = hidden;
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            isWorldStateCategoryHidden: (cat) => {
                return get().state.ui.hiddenWorldStateCategories?.includes(cat as any) ?? false;
            },

            getHiddenWorldStateCategories: () => {
                return get().state.ui.hiddenWorldStateCategories ?? [];
            },

            // ── Mod Builder ─────────────────────────────────────────────────
            saveModBuild: (build) => {
                set((s) => {
                    if (!s.state.modBuilder) s.state.modBuilder = { savedBuilds: [], ownedModNames: [] };
                    const idx = s.state.modBuilder.savedBuilds.findIndex(b => b.id === build.id);
                    if (idx >= 0) s.state.modBuilder.savedBuilds[idx] = build;
                    else s.state.modBuilder.savedBuilds.push(build);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            deleteModBuild: (id) => {
                set((s) => {
                    if (!s.state.modBuilder) return;
                    s.state.modBuilder.savedBuilds = s.state.modBuilder.savedBuilds.filter(b => b.id !== id);
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            getSavedBuilds: () => get().state.modBuilder?.savedBuilds ?? [],

            setOwnedModNames: (names) => {
                set((s) => {
                    if (!s.state.modBuilder) s.state.modBuilder = { savedBuilds: [], ownedModNames: [] };
                    s.state.modBuilder.ownedModNames = names;
                    s.state.meta.updatedAtIso = nowIso();
                });
            },

            getOwnedModNames: () => get().state.modBuilder?.ownedModNames ?? [],
        })),
        {
            name: PERSIST_KEY,
            version: PERSIST_VERSION,
            migrate: (persistedState: any) => {
                // Snapshot the pre-migration data so it can be recovered if the
                // migration produces bad output or a future schema change is buggy.
                try {
                    localStorage.setItem(
                        `${PERSIST_KEY}_premigration_backup`,
                        JSON.stringify({ ...persistedState, _backed_up_at: new Date().toISOString() })
                    );
                } catch { /* quota exceeded or private browsing — not fatal */ }

                const raw = persistedState?.state ?? persistedState;
                const migrated = migrateToUserStateV2(raw);
                if (!migrated) {
                    return { state: makeDefaultState() } as any;
                }
                ensureGoalsArray(migrated as any);
                ensureUiExpansion(migrated as any);
                ensureResetChecklistState(migrated as any);
                return { state: migrated } as any;
            }
        }
    )
);
