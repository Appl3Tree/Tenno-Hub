// ===== FILE: src/domain/seed.ts =====
import type { Inventory, SyndicateState } from "./types";

export const SEED_INVENTORY: Inventory = {
    credits: 0,
    platinum: 0,
    counts: {},
    customRivens: [],
    alecaFrameUnresolvedRecords: [],
};

export const SEED_SYNDICATES: SyndicateState[] = [];

export const SEED_MASTERY = {
    xpByItem: {} as Record<string, number>,
    mastered: {} as Record<string, boolean>,
    overLevelMastered: {} as Record<string, boolean>
};

export const SEED_MISSIONS = {
    completesByTag: {} as Record<string, number>
};

