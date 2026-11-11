// ===== FILE: src/domain/models/userState.ts =====
import type {
    DailyTask,
    Inventory,
    ResetChecklistState,
    SyndicateState
} from "../types";

export type PageKey =
    | "dashboard"
    | "world_state"
    | "search_detail"
    | "prereqs"
    | "syndicates"
    | "goals"
    | "requirements"
    | "handbook"
    | "imports"
    | "settings"
    | "diagnostics"
    | "inventory"
    | "starchart"
    | "mods"
    | "arcanes"
    | "challenges"
    | "intrinsics"
    | "build_planner"
    | "relic_planner"
    | "relics";

export interface UserMetaV2 {
    schemaVersion: 2;
    createdAtIso: string;
    updatedAtIso: string;
}

export type PlatformKey = "PC" | "PlayStation" | "Xbox" | "Switch" | "Mobile" | "Android";

export interface UserPlayerV2 {
    platform: PlatformKey;

    accountId: string;
    displayName: string;
    masteryRank: number | null;

    clanName?: string;
    clanTier?: number;
    clanClass?: number;
    clanXp?: number;
}

export type WorldStateCategoryKey =
    | "baro"
    | "varzia"
    | "sentient"
    | "alerts"
    | "invasions"
    | "nightwave"
    | "events";

export interface UserUiV2 {
    activePage: PageKey;
    expandedGoalNodes: Record<string, boolean>;
    /** Categories hidden from the notification popup and World State page. */
    hiddenWorldStateCategories?: WorldStateCategoryKey[];
}

export interface UserPrereqsV2 {
    /**
     * Sparse boolean map:
     * - missing key = false (unknown => assume not completed)
     */
    completed: Record<string, boolean>;
}

export type GoalType = "item" | "mod" | "arcane";

export interface UserGoalV1 {
    id: string;

    type: GoalType;

    /**
     * Canonical catalog id (e.g. "items:/Lotus/Types/...")
     * This must match inventory.counts keys.
     */
    catalogId: string;

    /**
     * How many the user wants.
     */
    qty: number;

    /**
     * Optional note for the goal.
     */
    note?: string;

    /**
     * Whether the goal is currently active.
     */
    isActive: boolean;

    /**
     * Per-component completion tracking.
     * Keys are step identifiers (e.g. "blueprint", "resources", "crafted").
     */
    completedComponents?: Record<string, boolean>;

    createdAtIso: string;
    updatedAtIso: string;
}

export interface UserStateV2 {
    meta: UserMetaV2;
    player: UserPlayerV2;
    ui: UserUiV2;

    prereqs: UserPrereqsV2;

    inventory: Inventory;
    syndicates: SyndicateState[];
    dailyTasks: DailyTask[];
    resetChecklist: ResetChecklistState;

    goals: UserGoalV1[];

    mastery: {
        xpByItem: Record<string, number>;
        mastered: Record<string, boolean>;
        /** Manually confirmed mastery for overlevel weapons (Kuva/Tenet/Coda/Paracesis). */
        overLevelMastered: Record<string, boolean>;
    };

    missions: {
        completesByTag: Record<string, number>;
        /** Manually toggled per-node completion (boolean, by node ID). */
        nodeCompleted?: Record<string, boolean>;
        /** Steel Path per-node completion — tracked separately from normal mode. */
        steelPathNodeCompleted?: Record<string, boolean>;
    };

    challenges?: {
        /** Progress count by challenge uniqueName (e.g. "/Lotus/Types/Challenges/Find1Mod" → 1). */
        progress: Record<string, number>;
        /** Whether the challenge is marked completed. */
        completed: Record<string, boolean>;
    };

    intrinsics?: {
        /** Railjack intrinsic skill ranks. Keys are STYPE_* strings (e.g. "STYPE_PILOTING" → 5). */
        railjack: Record<string, number>;
        /** Duviri intrinsic skill ranks. Keys are STYPE_DUVIRI_* strings. */
        duviri: Record<string, number>;
    };

    worldState?: {
        /** Invasion IDs the user has marked as personally completed (i.e. they ran it). */
        doneInvasions: string[];
        /** Nightwave challenge IDs the user has marked as completed. */
        doneNightwaveChallenges?: string[];
        /** Event IDs the user has marked as personally completed. */
        doneEvents?: string[];
        /** Event occurrence keys (event ID + activation/expiry) marked personally completed. */
        doneEventInstances?: string[];
        /** Time-bounded activity occurrence keys marked personally completed. */
        doneWorldStateActivityInstances?: string[];
    };

    modBuilder?: {
        /**
         * Saved weapon builds keyed by a user-chosen name.
         * Each build stores the weapon uniqueName, slot mods, slot polarities,
         * and build configuration so it can be fully restored.
         */
        savedBuilds: SavedBuild[];
        /**
         * Mod names the user owns. When the "owned only" toggle is on,
         * the optimizer and mod picker are filtered to this set.
         * Empty = treat as "own everything" (same as toggle off).
         */
        ownedModNames: string[];
    };
}

export interface SavedBuild {
    id: string;
    name: string;
    weaponUniqueName: string;
    weaponName: string;
    /** Mod unique names per slot (empty string = empty slot) */
    slotModUniqueNames: string[];
    /** Rank per slot, aligned with slotModUniqueNames. */
    slotRanks?: number[];
    stanceModUniqueName?: string;
    stanceRank?: number;
    stancePol?: string;
    slotPolarities: string[];
    weaponRank: number;
    hasCatalyst: boolean;
    hasExilus: boolean;
    exilusModUniqueName?: string;
    exilusRank?: number;
    exilusPol?: string;
    arcane1UniqueName?: string;
    arcane1Rank?: number;
    arcane2UniqueName?: string;
    arcane2Rank?: number;
    valenceBonusPct?: number;
    valenceElement?: string;
    optimizeValenceElement?: boolean;
    incarnonUnlockedTier?: number;
    incarnonSelectedOptionsByTier?: Partial<Record<1 | 2 | 3 | 4 | 5, string>>;
    optimizeIncarnonSelections?: boolean;
    createdAt: string;
}
