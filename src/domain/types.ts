// ===== FILE: src/domain/types.ts =====
export type Id = string;

export interface CustomRivenStatValue {
    stat: string;
    value: number;
}

export interface CustomRivenRecord {
    id: string;
    name: string;
    sourceWeaponUniqueName: string;
    sourceWeaponName: string;
    /** Historical factor used only to normalize legacy saves to the current shared 1.20 Riven factor. */
    sourceWeaponDisposition: number;
    familyKey: string;
    polarity: string;
    drain: number;
    stats: CustomRivenStatValue[];
    createdAtIso: string;
    updatedAtIso: string;
    /** Source details are kept only when they can be normalized locally. */
    importSource?: "alecaframe";
    importStatus?: "ready" | "rank-unknown" | "weapon-unknown" | "unsupported-stat";
    sourceRank?: number | null;
    masteryRankRequired?: number | null;
    rerolls?: number | null;
    sourceAttributes?: Array<{ tag: string; roll: number; polarity: "positive" | "negative" }>;
}

/** Minimal normalized source identity retained when AlecaFrame data has no exact catalog match. */
export interface AlecaFrameUnresolvedRecord {
    path: string;
    kind: "item" | "upgrade";
    sourceSections: string[];
    quantity: number;
    rankCounts?: Record<string, number>;
    rankCountsComplete?: boolean;
    reason: string;
}

export interface Inventory {
    /**
     * Credits and Platinum are the only "special" currencies that live outside
     * the canonical item-count map.
     */
    credits: number;
    platinum: number;

    /**
     * Canonical inventory counts keyed by catalog ID, never by display name.
     * This includes item, mod, arcane, and generic Riven-template catalog IDs.
     *
     * Counts only exist if the user has touched them (sparse map).
     */
    counts: Record<string, number>;

    /**
     * Per-mod maximum owned rank keyed by raw Lotus path (without "mods:" prefix).
     * Sparse: only present when the user has entered or edited rank data.
     */
    modRanks?: Record<string, number>;

    /**
     * Exact quantity of owned copies per mod rank, keyed by raw Lotus path,
     * then rank number as a string. A rank-zero stack and ranked individual
     * copies are distinct; never collapse these into only max owned rank.
     */
    modRankCounts?: Record<string, Record<string, number>>;

    /** Mod copies whose quantity is known but whose source rank was not recorded. */
    modUnknownRankCounts?: Record<string, number>;

    /** Exact owned arcane copies by rank. `arcaneRanks` remains the legacy highest-rank field. */
    arcaneRankCounts?: Record<string, Record<string, number>>;

    /** Arcane copies whose quantity is known but whose source rank was not recorded. */
    arcaneUnknownRankCounts?: Record<string, number>;

    /**
     * Highest owned arcane rank keyed by raw Lotus path (without "mods:" prefix).
     * Stored as a sparse single-entry map for backward compatibility with older saves.
     * Example: { "5": 1 } means the highest owned arcane is rank 5.
     */
    arcaneRanks?: Record<string, Record<string, number>>;

    /**
     * User-authored unveiled rivens. These are persisted separately from flat mod counts
     * because each riven is unique. `sourceWeaponDisposition` is retained as a
     * migration baseline for records created before Riven stats normalized to 1.20.
     */
    customRivens?: CustomRivenRecord[];

    /** Last AlecaFrame snapshot's unresolved identities, without source IDs or fingerprints. */
    alecaFrameUnresolvedRecords?: AlecaFrameUnresolvedRecord[];
}

export interface DailyTask {
    id: Id;
    dateYmd: string; // YYYY-MM-DD
    label: string;
    syndicate?: string;
    details?: string;
    isDone: boolean;
}

export type ResetChecklistCadence = "daily" | "weekly";
export type ResetDisplayMode = "utc" | "local";

export type ResetChecklistBucket =
    | "primary_daily"
    | "secondary_daily"
    | "weekly_monday"
    | "weekly_friday";

export interface ResetChecklistState {
    /**
     * Current active UTC reset window keys.
     * When these keys change, completion lists are wiped for the new window.
     */
    primaryDailyResetKey: string;
    secondaryDailyResetKey: string;
    weeklyMondayResetKey: string;
    weeklyFridayResetKey: string;

    /**
     * Task ids completed in the current active window.
     */
    completedPrimaryDailyTaskIds: string[];
    completedSecondaryDailyTaskIds: string[];
    completedWeeklyMondayTaskIds: string[];
    completedWeeklyFridayTaskIds: string[];

    /**
     * Presentation-only toggle for the reset header pills.
     * Reset boundaries remain game-accurate UTC.
     */
    timeMode: ResetDisplayMode;
}

export interface SyndicateState {
    id: Id;
    name: string;

    /**
     * Rank index (0-based).
     * For Relay faction syndicates, negative ranks exist (-2..-1).
     */
    rank: number;

    /**
     * Current standing into the rank.
     * For negative ranks, standing is typically negative and approaches 0.
     */
    standing: number;

    /**
     * Computed in UI (based on rank), but kept optional for forward-compat.
     */
    standingCap?: number;

    /**
     * Optional convenience fields for UI.
     */
    rankLabel?: string;
    dailyCap?: number;

    /**
     * Relay faction pledge (one primary pledge at a time).
     */
    pledged?: boolean;

    /**
     * Optional rank-up requirements when defined by embedded ladder data.
     * NOTE: Reserves are derived from this data when it exists.
     */
    nextRankUp?: {
        standingRequired?: number;
        credits?: number;
        platinum?: number;
        items?: Array<{ key: string; count: number; label?: string }>;
    };
}
