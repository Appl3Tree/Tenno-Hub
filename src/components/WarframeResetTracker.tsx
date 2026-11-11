// ===== FILE: src/components/WarframeResetTracker.tsx =====
//
// Self-contained reset tracker. Persists via localStorage key "wfpt:resetChecklist".
// No store changes required — reads completedPrereqs + syndicates read-only.
//
// Features:
//  - Relay faction standing tasks filter to only pledged faction(s).
//  - "Conclave" tab is its own bucket with an internal daily (16:00 UTC) /
//    weekly (Fri 00:00 UTC) split — Conclave runs on a separate cadence.
//  - "Customize" panel lets users permanently hide tasks they don't care about.
//  - If every eligible task in a bucket is hidden, the timer card is suppressed.
//  - Baro Ki'Teer timing uses the shared API schedule, with an estimate only if unavailable.
//  - Temporal Archimedea and Netracells now share logic:
//      * Marking Temporal Archimedea complete adds 2 Netracell/Search Pulse runs.
//      * If 4+ Netracell runs are already spent, Temporal Archimedea is auto-crossed out
//        because 2 surges are required to run it from the shared pool.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTrackerStore } from "../store/store";
import { PR } from "../domain/ids/prereqIds";
import { SY } from "../domain/ids/syndicateIds";
import type { SyndicateState } from "../domain/types";
import { fetchWorldState, getCurrentOrNextVoidTrader, type CalendarEvent, type WorldStateData } from "../lib/worldStateCache";
import { useWorldStateData } from "../lib/useWorldStateData";
import { WorkspacePanel, WorkspaceSegmented, WorkspaceSegmentedButton } from "./workspace/WorkspaceChrome";

// ─── Types ─────────────────────────────────────────────────────────────────────

// "conclave" replaces "weekly_friday" — it has an internal daily+weekly split.
type Bucket = "primary_daily" | "eight_hour" | "secondary_daily" | "weekly_monday" | "four_day" | "rotation" | "conclave";
type TimeMode = "utc" | "local";

interface RCState {
    timeMode: TimeMode;
    primaryDailyResetKey: string;
    completedPrimaryDailyTaskIds: string[];
    eightHourResetKey: string;
    completedEightHourTaskIds: string[];
    secondaryDailyResetKey: string;
    completedSecondaryDailyTaskIds: string[];
    weeklyMondayResetKey: string;
    completedWeeklyMondayTaskIds: string[];
    fourDayResetKey: string;
    completedFourDayTaskIds: string[];
    completedRotationTaskInstanceKeys: Record<string, string>;
    // Conclave has two internal windows — keyed separately so each auto-clears correctly
    conclaveWeeklyResetKey: string;
    completedConclaveWeeklyTaskIds: string[];
    conclaveDailyResetKey: string;
    completedConclaveDailyTaskIds: string[];
    hiddenTaskIds: string[];
    netracellRuns: number;    // 0–5, clears with weekly monday reset
}

// ConclaveSubBucket drives the internal split inside the Conclave tab panel
type ConclaveSubBucket = "conclave_daily" | "conclave_weekly";

type TaskDef = {
    id: string;
    label: string;
    bucket: Bucket;
    /** For conclave tasks only — which internal sub-bucket they belong to */
    conclaveSub?: ConclaveSubBucket;
    description: string;
    isFactionStanding?: boolean;
    factionSyndicateId?: string;
    prereqIds?: string[];
    usesDynamicInstance?: boolean;
    isVisible?: (ctx: { completedPrereqs: Record<string, boolean>; syndicates: SyndicateState[] }) => boolean;
};

type TaskRenderState = "pending" | "completed" | "auto_blocked";
type TrackerLayoutMode = "tracker" | "calendar";
type CalendarScale = "day" | "week" | "month";

// ─── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = "wfpt:resetChecklist";

import type { SyndicateId } from "../domain/ids/syndicateIds";

const RELAY_FACTION_IDS = new Set<SyndicateId>([
    SY.STEEL_MERIDIAN, SY.ARBITERS_OF_HEXIS, SY.CEPHALON_SUDA,
    SY.THE_PERRIN_SEQUENCE, SY.RED_VEIL, SY.NEW_LOKA,
]);

const NETRACELLS_TASK_ID = "netracells";
const TEMPORAL_ARCHIMEDEA_TASK_ID = "temporal_archimedea";

// Window lengths for urgency colouring on the timer card.
// For "conclave" we use the shorter daily window so the card colour is driven
// by whichever deadline is most imminent.
const WINDOW_MS: Record<Bucket, number> = {
    primary_daily: 86_400_000,
    eight_hour: 28_800_000,
    secondary_daily: 86_400_000,
    weekly_monday: 604_800_000,
    four_day: 345_600_000,
    rotation: 21_600_000,
    conclave: 86_400_000,
};

const BUCKET_LABEL: Record<Bucket, string> = {
    primary_daily: "Daily Reset",
    eight_hour: "8-Hour Rotations",
    secondary_daily: "Morning Reset",
    weekly_monday: "Weekly Reset",
    four_day: "Long Rotations",
    rotation: "Live Rotations",
    conclave: "Conclave",
};

function getBucketSub(mode: TimeMode): Record<Bucket, string> {
    return {
        primary_daily: fmtFixedUTC(0, 0, mode),
        eight_hour: `${fmtFixedUTC(0, 0, mode)} · ${fmtFixedUTC(8, 0, mode)} · ${fmtFixedUTC(16, 0, mode)}`,
        secondary_daily: fmtFixedUTC(16, 0, mode),
        weekly_monday: `Mon ${fmtFixedUTC(0, 0, mode)}`,
        four_day: `Every 4 days · ${fmtFixedUTC(0, 0, mode)}`,
        rotation: "Live world-state timers",
        conclave: `Daily ${fmtFixedUTC(16, 0, mode)} · Weekly Fri`,
    };
}

const BUCKET_ORDER: Bucket[] = [
    "primary_daily", "eight_hour", "secondary_daily", "weekly_monday", "four_day", "rotation", "conclave",
];

// For non-conclave buckets only — conclave uses two separate key pairs below.
const COMPLETED_KEY: Partial<Record<Bucket, keyof RCState>> = {
    primary_daily: "completedPrimaryDailyTaskIds",
    eight_hour: "completedEightHourTaskIds",
    secondary_daily: "completedSecondaryDailyTaskIds",
    weekly_monday: "completedWeeklyMondayTaskIds",
    four_day: "completedFourDayTaskIds",
};

const RESET_KEY: Partial<Record<Bucket, keyof RCState>> = {
    primary_daily: "primaryDailyResetKey",
    eight_hour: "eightHourResetKey",
    secondary_daily: "secondaryDailyResetKey",
    weekly_monday: "weeklyMondayResetKey",
    four_day: "fourDayResetKey",
};

// Baro anchor — 2026-03-20T13:00:00Z, every 14 days, available 48 h
const BARO_ANCHOR_MS = Date.UTC(2026, 2, 20, 13, 0, 0); // month is 0-indexed
const BARO_PERIOD_MS = 14 * 86_400_000;
const BARO_WINDOW_MS = 2 * 86_400_000;

// ─── Task definitions ──────────────────────────────────────────────────────────

const ALL_TASKS: TaskDef[] = [
    // ── Primary Daily — 00:00 UTC ──────────────────────────────────────────────
    { id: "daily_tribute", label: "Daily Tribute", bucket: "primary_daily", description: "Claim the daily login reward." },
    { id: "daily_first_win", label: "Daily First Win Bonus", bucket: "primary_daily", description: "Doubled credits for first mission completed." },
    { id: "daily_trade_limit", label: "Daily Trade Limit", bucket: "primary_daily", description: "Use remaining trades before midnight UTC." },
    { id: "focus_daily_cap", label: "Focus Daily Cap", bucket: "primary_daily", description: "Spend today's Focus cap.", prereqIds: [PR.SECOND_DREAM] },

    // Relay faction standing — filtered to pledged faction(s) automatically
    { id: "standing_steel_meridian", label: "Steel Meridian", bucket: "primary_daily", description: "Use today's standing cap.", isFactionStanding: true, factionSyndicateId: SY.STEEL_MERIDIAN },
    { id: "standing_arbiters", label: "Arbiters of Hexis", bucket: "primary_daily", description: "Use today's standing cap.", isFactionStanding: true, factionSyndicateId: SY.ARBITERS_OF_HEXIS },
    { id: "standing_suda", label: "Cephalon Suda", bucket: "primary_daily", description: "Use today's standing cap.", isFactionStanding: true, factionSyndicateId: SY.CEPHALON_SUDA },
    { id: "standing_perrin", label: "Perrin Sequence", bucket: "primary_daily", description: "Use today's standing cap.", isFactionStanding: true, factionSyndicateId: SY.THE_PERRIN_SEQUENCE },
    { id: "standing_red_veil", label: "Red Veil", bucket: "primary_daily", description: "Use today's standing cap.", isFactionStanding: true, factionSyndicateId: SY.RED_VEIL },
    { id: "standing_new_loka", label: "New Loka", bucket: "primary_daily", description: "Use today's standing cap.", isFactionStanding: true, factionSyndicateId: SY.NEW_LOKA },

    // Open-world standing
    { id: "standing_ostron", label: "Ostrons", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_CETUS] },
    { id: "standing_the_quills", label: "The Quills", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_CETUS] },
    { id: "standing_solaris", label: "Solaris United", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_FORTUNA] },
    { id: "standing_vox_solaris", label: "Vox Solaris", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_FORTUNA, PR.SECOND_DREAM] },
    { id: "standing_ventkids", label: "Ventkids", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_FORTUNA] },
    { id: "standing_entrati", label: "Entrati", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_NECRALISK] },
    { id: "standing_cavia", label: "Cavia", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_SANCTUM] },
    { id: "standing_necraloid", label: "Necraloid", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_NECRALISK] },
    { id: "standing_the_holdfasts", label: "The Holdfasts", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_ZARIMAN] },
    { id: "standing_the_hex", label: "The Hex", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_HOLLVANIA] },
    { id: "standing_cephalon_simaris", label: "Cephalon Simaris", bucket: "primary_daily", description: "Use today's standing cap.", prereqIds: [PR.HUB_RELAY, PR.NEW_STRANGE] },

    { id: "nightwave_daily", label: "Nightwave Daily Acts", bucket: "primary_daily", description: "Complete today's Nightwave daily acts." },
    { id: "steel_path_incursions", label: "Steel Path Incursions", bucket: "primary_daily", description: "Finish the day's Steel Path Incursions." },
    { id: "simaris_daily_synthesis", label: "Simaris Daily Synthesis", bucket: "primary_daily", description: "Complete today's Cephalon Simaris synthesis target.", prereqIds: [PR.HUB_RELAY, PR.NEW_STRANGE] },
    { id: "darvo_daily_deal", label: "Darvo Daily Deal", bucket: "primary_daily", description: "Review today's Darvo Deal before it rotates." },
    { id: "k_drive_races", label: "K-Drive Races", bucket: "primary_daily", description: "Check today's active K-Drive races.", prereqIds: [PR.HUB_FORTUNA] },
    { id: "argon_decay", label: "Argon Crystal Check", bucket: "primary_daily", description: "Spend Argon before daily decay if needed." },
    { id: "circuit_stage_bonus", label: "Circuit Stage Bonus", bucket: "primary_daily", description: "Get today's Circuit 4-stage bonus.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "kim_daily", label: "KIM Daily Conversations", bucket: "primary_daily", description: "Check new daily KIM messages from Hex members and Roundtable contacts.", prereqIds: [PR.THE_HEX] },

    // Vendor Reset
    { id: "acrithis_daily", label: "Acrithis Daily", bucket: "primary_daily", description: "Check current daily Duviri shop offerings.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "grandmother_daily", label: "Grandmother Daily", bucket: "primary_daily", description: "Check current daily Mend the Family shop offerings.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "ticker_daily", label: "Ticker Daily", bucket: "primary_daily", description: "Check current daily Railjack Crew hire offerings.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "lyon_daily", label: "Lyon Daily", bucket: "primary_daily", description: "Check current daily furniture shop offerings.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "marie_daily", label: "Marie Daily", bucket: "primary_daily", description: "Check current daily Antique Mods and Tektolyst Artifact Arcanes shop offerings.", prereqIds: [PR.DUVIRI_PARADOX] },

    // ── 8-hour Rotation ────────────────────────────────────────────
    { id: "nightmare_missions", label: "Nightmare Missions", bucket: "eight_hour", description: "Run the current Nightmare Missions before the next 8-hour rotation." },

    // ── Secondary Daily — 16:00 UTC ────────────────────────────────────────────
    { id: "sortie_set", label: "Sortie Mission Set", bucket: "secondary_daily", description: "Complete today's Sortie before missions rotate." },
    { id: "syndicate_missions", label: "Syndicate Daily Missions", bucket: "secondary_daily", description: "Finish the current Syndicate mission set." },

    // ── Weekly — Monday 00:00 UTC ──────────────────────────────────────────────
    { id: "archon_hunt", label: "Archon Hunt", bucket: "weekly_monday", description: "Complete this week's Archon Hunt.", prereqIds: [PR.NEW_WAR] },
    { id: NETRACELLS_TASK_ID, label: "Netracells (5 runs)", bucket: "weekly_monday", description: "Use this week's Netracell reward runs. Shares the 5-run Search Pulse pool with Deep Archimedea and Temporal Archimedea.", prereqIds: [PR.WHISPERS_WALL] },
    {
        id: "deep_archimedea",
        label: "Deep Archimedea",
        bucket: "weekly_monday",
        description: "Complete this week's Deep Archimedea.",
        prereqIds: [PR.WHISPERS_WALL],
        isVisible: ({ completedPrereqs, syndicates }) => {
            if (!completedPrereqs[PR.WHISPERS_WALL]) return false;
            return (syndicates.find((s) => s.id === SY.CAVIA)?.rank ?? 0) >= 5;
        },
    },
    { id: "circuit_reward_track", label: "Circuit Reward Track", bucket: "weekly_monday", description: "Push weekly Circuit reward track.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "circuit_incarnon", label: "Circuit Incarnon Genesis", bucket: "weekly_monday", description: "Use current weekly Incarnon rotation.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "nightwave_weekly", label: "Nightwave Weekly Acts", bucket: "weekly_monday", description: "Complete this week's Nightwave weekly acts." },
    { id: "nightwave_elite", label: "Nightwave Elite Weekly", bucket: "weekly_monday", description: "Complete this week's Nightwave elite acts." },
    { id: "nightwave_cred_offerings", label: "Nightwave Cred Offerings", bucket: "weekly_monday", description: "Review this week's Nightwave Cred offerings." },
    { id: "helminth_invigoration", label: "Helminth Invigoration", bucket: "weekly_monday", description: "Use the current weekly Helminth Invigoration.", prereqIds: [PR.SEGMENT_HELMINTH_INVIGORATION] },
    { id: "steel_path_honors", label: "Steel Path Honors", bucket: "weekly_monday", description: "Check or buy this week's Steel Path Honors." },
    { id: "cavalero_incarnon_market", label: "Cavalero Incarnon Market", bucket: "weekly_monday", description: "Review Cavalero's weekly Incarnon stock.", prereqIds: [PR.HUB_ZARIMAN] },
    { id: "palladino_weekly", label: "Palladino — Iron Wake", bucket: "weekly_monday", description: "Check this week's Palladino offerings." },
    { id: "yonta_weekly", label: "Yonta — Weekly Kuva", bucket: "weekly_monday", description: "Claim Yonta's weekly Kuva purchase.", prereqIds: [PR.HUB_ZARIMAN] },
    {
        id: "bird3_weekly",
        label: "Bird-3 — Archon Shard",
        bucket: "weekly_monday",
        description: "Check Bird-3's weekly shard purchase. Requires Cavia rank 5 (Family).",
        prereqIds: [PR.HUB_SANCTUM],
        isVisible: ({ completedPrereqs, syndicates }) => {
            if (!completedPrereqs[PR.HUB_SANCTUM]) return false;
            return (syndicates.find((s) => s.id === SY.CAVIA)?.rank ?? 0) >= 5;
        },
    },
    { id: "acrithis_weekly", label: "Acrithis Weekly Shop", bucket: "weekly_monday", description: "Review the weekly Acrithis inventory.", prereqIds: [PR.DUVIRI_PARADOX] },
    { id: "break_narmer", label: "Break Narmer (Kahl)", bucket: "weekly_monday", description: "Complete the weekly Kahl mission.", prereqIds: [PR.VEILBREAKER] },
    { id: "maroo", label: "Maroo — Ayatan Hunt", bucket: "weekly_monday", description: "Run the weekly Ayatan Treasure Hunt." },
    { id: "help_clem", label: "Help Clem", bucket: "weekly_monday", description: "Run the weekly Help Clem mission." },
    { id: "the_descendia_normal", label: "The Descendia (Normal)", bucket: "weekly_monday", description: "Complete this week's Normal Descendia run. Separate reward table from Steel Path.", prereqIds: [PR.THE_OLD_PEACE] },
    { id: "the_descendia_sp", label: "The Descendia (Steel Path)", bucket: "weekly_monday", description: "Complete this week's Steel Path Descendia run. Separate reward table from Normal.", prereqIds: [PR.THE_OLD_PEACE] },
    { id: "kaya_weekly", label: "Kaya — Weekly Arcane", bucket: "weekly_monday", description: "Check Kaya's weekly Arcane Enhancement offering.", prereqIds: [PR.THE_HEX] },
    {
        id: TEMPORAL_ARCHIMEDEA_TASK_ID,
        label: "Temporal Archimedea",
        bucket: "weekly_monday",
        description: "Complete this week's Temporal Archimedea. Uses the shared 5-run Search Pulse pool with Netracells and Deep Archimedea.",
        prereqIds: [PR.THE_HEX],
        isVisible: ({ completedPrereqs, syndicates }) => {
            if (!completedPrereqs[PR.THE_HEX]) return false;
            return (syndicates.find((s) => s.id === SY.THE_HEX)?.rank ?? 0) >= 5;
        },
    },
    { id: "calendar_1999", label: "1999 Calendar Season", bucket: "weekly_monday", description: "Check weekly calendar To Do tasks, prize selection, and Hex Override choices.", prereqIds: [PR.THE_HEX] },

    // ── Four-day rotations — 00:00 UTC cadence ────────────────────────────────
    { id: "ergo_glast_tenet_rotation", label: "Ergo Glast Tenet Rotation", bucket: "four_day", description: "Review Ergo Glast's current Tenet weapon rotation.", prereqIds: [PR.HUB_RELAY] },
    // Eleanor resets 24h after Ergo Glast — uses a separate anchor (+1 day) tracked via dynamic instance key.
    { id: "eleanor_coda_rotation", label: "Eleanor Coda Rotation", bucket: "four_day", description: "Review the current Coda weapon rotation.", prereqIds: [PR.HUB_HOLLVANIA], usesDynamicInstance: true },

    // ── World-state rotations — driven by live expiry, not fixed UTC boundaries ──
    { id: "ostrons_bounties", label: "Ostrons Bounties", bucket: "rotation", description: "Check the current Plains bounty board before it rotates.", usesDynamicInstance: true, prereqIds: [PR.HUB_CETUS] },
    { id: "solaris_bounties", label: "Solaris United Bounties", bucket: "rotation", description: "Check the current Orb Vallis bounty board before it rotates.", usesDynamicInstance: true, prereqIds: [PR.HUB_FORTUNA] },
    { id: "entrati_bounties", label: "Entrati Bounties", bucket: "rotation", description: "Check the current Cambion Drift bounty board before it rotates.", usesDynamicInstance: true, prereqIds: [PR.HUB_NECRALISK] },
    { id: "holdfasts_bounties", label: "Holdfasts Bounties", bucket: "rotation", description: "Check the current Zariman bounty board before it rotates.", usesDynamicInstance: true, prereqIds: [PR.HUB_ZARIMAN] },
    { id: "cavia_bounties", label: "Cavia Bounties", bucket: "rotation", description: "Check the current Sanctum bounty board before it rotates.", usesDynamicInstance: true, prereqIds: [PR.HUB_SANCTUM] },
    { id: "hex_bounties", label: "The Hex Bounties", bucket: "rotation", description: "Check the current Höllvania bounty board before it rotates.", usesDynamicInstance: true, prereqIds: [PR.HUB_HOLLVANIA] },
    { id: "arbitration", label: "Arbitration", bucket: "rotation", description: "Use the current Arbitration before it rotates.", usesDynamicInstance: true },
    { id: "kuva_flood", label: "Kuva Flood", bucket: "rotation", description: "Run the current Kuva Flood before it rotates.", usesDynamicInstance: true },
    { id: "kuva_siphons", label: "Kuva Siphons", bucket: "rotation", description: "Check the current Kuva Siphon set before it rotates.", usesDynamicInstance: true },
    { id: "baro_visit", label: "Baro Ki'Teer", bucket: "rotation", description: "Review Baro Ki'Teer before his current visit or next arrival window changes.", usesDynamicInstance: true },
    { id: "varzia_rotation", label: "Varzia Rotation", bucket: "rotation", description: "Review the current Prime Resurgence rotation.", usesDynamicInstance: true },
    { id: "sentient_outpost", label: "Sentient Outpost", bucket: "rotation", description: "Run the current Sentient Outpost before it expires.", usesDynamicInstance: true },

    // ── Conclave — Daily 16:00 UTC ─────────────────────────────────────────────
    { id: "conclave_daily_standing", label: "Conclave Standing", bucket: "conclave", conclaveSub: "conclave_daily", description: "Use today's Conclave standing cap.", prereqIds: [PR.HUB_RELAY] },
    { id: "conclave_daily_challenges", label: "Conclave Daily Challenges", bucket: "conclave", conclaveSub: "conclave_daily", description: "Complete today's Conclave daily challenges.", prereqIds: [PR.HUB_RELAY] },

    // ── Conclave — Weekly Friday 00:00 UTC ────────────────────────────────────
    { id: "conclave_weekly_challenges", label: "Conclave Weekly Challenges", bucket: "conclave", conclaveSub: "conclave_weekly", description: "Finish this week's Conclave weekly challenges.", prereqIds: [PR.HUB_RELAY] },
];

// ─── Time helpers ───────────────────────────────────────────────────────────────

function utcKey(d: Date) {
    return d.toISOString().slice(0, 10);
}

function eightHourResetStart(now: Date): Date {
    const hour = now.getUTCHours();
    const startHour = Math.floor(hour / 8) * 8;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), startHour));
}

function eightHourResetKey(now: Date): string {
    return eightHourResetStart(now).toISOString();
}

// Four-day vendor rotation anchors.
// Ergo Glast: March 21, 2025 00:00 UTC. Verified: Dec 3 2015 + 849×4 days = March 21 2025.
// Eleanor Nightingale: resets 24 hours AFTER Ergo Glast (wiki: same 4-day cadence, +1 day offset).
// So Eleanor anchor = March 22, 2025 00:00 UTC.
const FOUR_DAY_ANCHOR_MS = Date.UTC(2025, 2, 21, 0, 0, 0, 0);   // Ergo Glast
const ELEANOR_ANCHOR_MS  = Date.UTC(2025, 2, 22, 0, 0, 0, 0);   // Eleanor = Ergo + 1 day
const FOUR_DAY_WINDOW_MS = 4 * 86_400_000;

function fourDayResetStart(now: Date): Date {
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    const diff = utcMidnight - FOUR_DAY_ANCHOR_MS;
    const windows = Math.floor(diff / FOUR_DAY_WINDOW_MS);
    return new Date(FOUR_DAY_ANCHOR_MS + windows * FOUR_DAY_WINDOW_MS);
}

function fourDayResetKey(now: Date): string {
    return fourDayResetStart(now).toISOString();
}

function eleanorResetStart(now: Date): Date {
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    const diff = utcMidnight - ELEANOR_ANCHOR_MS;
    const windows = Math.floor(diff / FOUR_DAY_WINDOW_MS);
    return new Date(ELEANOR_ANCHOR_MS + windows * FOUR_DAY_WINDOW_MS);
}

function eleanorResetKey(now: Date): string {
    return eleanorResetStart(now).toISOString();
}

function getSyndicateMissionBoard(data: WorldStateData | null, syndicateKey: string): WorldStateData["syndicateMissions"][number] | null {
    return data?.syndicateMissions.find((board) => board.syndicateKey === syndicateKey || board.syndicate === syndicateKey) ?? null;
}

function dynamicTaskInstanceKey(taskId: string, data: WorldStateData | null): string | null {
    // Eleanor uses its own 4-day anchor (offset +1 day from Ergo Glast) — no world state needed.
    if (taskId === "eleanor_coda_rotation") return eleanorResetKey(new Date());

    if (!data) return null;

    const bountyBoardMap: Record<string, string> = {
        ostrons_bounties: "Ostrons",
        solaris_bounties: "Solaris United",
        entrati_bounties: "Entrati",
        holdfasts_bounties: "The Holdfasts",
        cavia_bounties: "Cavia",
        hex_bounties: "The Hex",
    };
    const bountyBoardKey = bountyBoardMap[taskId];
    if (bountyBoardKey) {
        const board = getSyndicateMissionBoard(data, bountyBoardKey);
        if (!board?.expiry) return null;
        return `${board.syndicateKey}|${board.expiry}|${board.jobs.map((job) => `${job.id}|${job.expiry}`).join("||")}`;
    }

    if (taskId === "arbitration") {
        const a = data.arbitration;
        return a?.expiry ? `${a.node}|${a.type}|${a.expiry}` : null;
    }

    if (taskId === "kuva_flood") {
        const flood = data.kuva.find((k) => k.isFlood && k.expiry);
        return flood ? `${flood.node}|${flood.type}|${flood.expiry}` : null;
    }

    if (taskId === "kuva_siphons") {
        const siphons = data.kuva.filter((k) => !k.isFlood && k.expiry);
        if (siphons.length === 0) return null;
        return siphons
            .map((k) => `${k.node}|${k.type}|${k.expiry}`)
            .sort()
            .join("||");
    }

    if (taskId === "baro_visit") {
        const trader = data.voidTrader;
        if (!trader?.activation || !trader?.expiry) return null;
        return `${trader.activation}|${trader.expiry}|${trader.location}|${trader.active ? "active" : "inactive"}`;
    }

    if (taskId === "varzia_rotation") {
        const trader = data.vaultTrader;
        if (!trader?.activation && !trader?.expiry) return null;
        return `${trader.activation ?? ""}|${trader.expiry ?? ""}|${trader.location}|${trader.active ? "active" : "inactive"}`;
    }

    if (taskId === "sentient_outpost") {
        const outpost = data.sentientOutposts;
        return outpost?.expiry ? `${outpost.mission?.node ?? ""}|${outpost.missionType ?? ""}|${outpost.expiry}` : null;
    }

    return null;
}

function dynamicTaskNextReset(taskId: string, data: WorldStateData | null, now: Date): Date | null {
    // Eleanor uses its own 4-day anchor — no world state needed.
    if (taskId === "eleanor_coda_rotation") {
        const next = new Date(eleanorResetStart(now));
        next.setUTCDate(next.getUTCDate() + 4);
        return next;
    }

    if (!data) return null;

    const bountyBoardMap: Record<string, string> = {
        ostrons_bounties: "Ostrons",
        solaris_bounties: "Solaris United",
        entrati_bounties: "Entrati",
        holdfasts_bounties: "The Holdfasts",
        cavia_bounties: "Cavia",
        hex_bounties: "The Hex",
    };
    const bountyBoardKey = bountyBoardMap[taskId];
    if (bountyBoardKey) {
        const board = getSyndicateMissionBoard(data, bountyBoardKey);
        return board?.expiry ? new Date(board.expiry) : null;
    }

    if (taskId === "arbitration") {
        return data.arbitration?.expiry ? new Date(data.arbitration.expiry) : null;
    }

    if (taskId === "kuva_flood") {
        const flood = data.kuva.find((k) => k.isFlood && k.expiry);
        return flood?.expiry ? new Date(flood.expiry) : null;
    }

    if (taskId === "kuva_siphons") {
        const expiries = data.kuva
            .filter((k) => !k.isFlood && k.expiry)
            .map((k) => new Date(k.expiry))
            .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now.getTime())
            .sort((a, b) => a.getTime() - b.getTime());
        return expiries[0] ?? null;
    }

    if (taskId === "baro_visit") {
        const trader = data.voidTrader;
        if (!trader) return null;
        const target = trader.active ? trader.expiry : trader.activation;
        return target ? new Date(target) : null;
    }

    if (taskId === "varzia_rotation") {
        const trader = data.vaultTrader;
        if (!trader) return null;
        const target = trader.active ? trader.expiry : trader.activation;
        return target ? new Date(target) : null;
    }

    if (taskId === "sentient_outpost") {
        return data.sentientOutposts?.expiry ? new Date(data.sentientOutposts.expiry) : null;
    }

    return null;
}

function getRotationNextReset(data: WorldStateData | null, tasks: TaskDef[], now: Date): Date {
    const candidates = tasks
        .map((task) => dynamicTaskNextReset(task.id, data, now))
        .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()) && date.getTime() > now.getTime())
        .sort((a, b) => a.getTime() - b.getTime());

    return candidates[0] ?? new Date(now.getTime() + WINDOW_MS.rotation);
}

// Key for conclave daily — date string for the 16:00 UTC window currently active
function conclaveDailyKey(now: Date): string {
    const threshold = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16));
    if (now >= threshold) return utcKey(threshold);
    const prev = new Date(threshold);
    prev.setUTCDate(prev.getUTCDate() - 1);
    return utcKey(prev);
}

// Key for conclave weekly — most recent Friday 00:00 UTC
function conclaveWeeklyKey(now: Date): string {
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    base.setUTCDate(base.getUTCDate() - (base.getUTCDay() + 2) % 7);
    return utcKey(base);
}

function getCurrentKeys(now: Date): Record<Exclude<Bucket, "conclave" | "rotation">, string> & { conclave_daily: string; conclave_weekly: string } {
    const st = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16));
    const mb = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    mb.setUTCDate(mb.getUTCDate() - (mb.getUTCDay() + 6) % 7);
    const secKey = now >= st ? utcKey(st) : (() => {
        const p = new Date(st);
        p.setUTCDate(p.getUTCDate() - 1);
        return utcKey(p);
    })();

    return {
        primary_daily: utcKey(now),
        eight_hour: eightHourResetKey(now),
        secondary_daily: secKey,
        weekly_monday: utcKey(mb),
        four_day: fourDayResetKey(now),
        conclave_daily: conclaveDailyKey(now),
        conclave_weekly: conclaveWeeklyKey(now),
    };
}

// Next reset times for all sub-windows
function getNextResets(now: Date): Record<Exclude<Bucket, "rotation">, Date> & { conclave_daily: Date; conclave_weekly: Date } {
    const st = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16));
    const nm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    nm.setUTCDate(nm.getUTCDate() - (nm.getUTCDay() + 6) % 7 + 7);
    const nf = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    nf.setUTCDate(nf.getUTCDate() - (nf.getUTCDay() + 2) % 7 + 7);
    const nextEightHour = new Date(eightHourResetStart(now));
    nextEightHour.setUTCHours(nextEightHour.getUTCHours() + 8);
    const nextFourDay = new Date(fourDayResetStart(now));
    nextFourDay.setUTCDate(nextFourDay.getUTCDate() + 4);

    const nextConcDaily = now < st ? st : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 16));

    return {
        primary_daily: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
        eight_hour: nextEightHour,
        secondary_daily: now < st ? st : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 16)),
        weekly_monday: nm,
        four_day: nextFourDay,
        conclave: nextConcDaily,
        conclave_daily: nextConcDaily,
        conclave_weekly: nf,
    };
}

function fmtMs(ms: number): string {
    const t = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(t / 86400);
    const h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

const TZ_KEY = "wft_timezone_v1";
function getDisplayTimezone(): string {
    return localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function fmtAbs(date: Date, mode: TimeMode): string {
    if (mode === "utc") {
        const wd = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
        const t = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
        return `${wd} ${t} UTC`;
    }
    const tz = getDisplayTimezone();
    const wd = date.toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
    const t = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
    return `${wd} ${t}`;
}

/** Format a fixed UTC hour:minute as either "HH:MM UTC" or its equivalent in the user's timezone */
function fmtFixedUTC(utcHour: number, utcMinute: number, mode: TimeMode): string {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, utcMinute));
    if (mode === "utc") {
        const hh = String(utcHour).padStart(2, "0");
        const mm = String(utcMinute).padStart(2, "0");
        return `${hh}:${mm} UTC`;
    }
    const tz = getDisplayTimezone();
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
}

function urgTier(ms: number, bucket: Bucket): "safe" | "warn" | "crit" {
    const r = ms / WINDOW_MS[bucket];
    return r <= 0.10 ? "crit" : r <= 0.35 ? "warn" : "safe";
}

const URG_COUNTDOWN: Record<string, string> = { safe: "text-emerald-400", warn: "text-amber-400", crit: "text-red-400" };
const URG_BAR: Record<string, string> = { safe: "bg-emerald-500", warn: "bg-amber-500", crit: "bg-red-500" };
const URG_BORDER_L: Record<string, string> = { safe: "border-l-emerald-600", warn: "border-l-amber-600", crit: "border-l-red-600" };
const URG_TITLE: Record<string, string> = { safe: "text-emerald-400", warn: "text-amber-400", crit: "text-red-400" };

// ─── Shared weekly Search Pulse helpers ────────────────────────────────────────

function isTemporalArchimedeaAutoBlocked(netracellRuns: number, completedIds: string[]): boolean {
    return netracellRuns >= 4 && !completedIds.includes(TEMPORAL_ARCHIMEDEA_TASK_ID);
}

function getTaskRenderState(task: TaskDef, completedIds: string[], netracellRuns: number): TaskRenderState {
    if (task.id === NETRACELLS_TASK_ID) {
        return netracellRuns >= 5 ? "completed" : "pending";
    }

    if (task.id === TEMPORAL_ARCHIMEDEA_TASK_ID) {
        if (completedIds.includes(TEMPORAL_ARCHIMEDEA_TASK_ID)) return "completed";
        if (isTemporalArchimedeaAutoBlocked(netracellRuns, completedIds)) return "auto_blocked";
        return "pending";
    }

    return completedIds.includes(task.id) ? "completed" : "pending";
}

function getTaskDescription(task: TaskDef, completedIds: string[], netracellRuns: number): string {
    if (task.id === NETRACELLS_TASK_ID) {
        if (completedIds.includes(TEMPORAL_ARCHIMEDEA_TASK_ID)) {
            return "Use this week's Netracell reward runs. Temporal Archimedea already consumed 2 Search Pulses from the shared 5-run pool with Netracells and Deep Archimedea.";
        }
        return "Use this week's Netracell reward runs. Shares the 5-run Search Pulse pool with Deep Archimedea and Temporal Archimedea.";
    }

    if (task.id === TEMPORAL_ARCHIMEDEA_TASK_ID) {
        if (completedIds.includes(TEMPORAL_ARCHIMEDEA_TASK_ID)) {
            return "Completed. This consumed 2 Search Pulses from the shared 5-run pool with Netracells and Deep Archimedea.";
        }
        if (isTemporalArchimedeaAutoBlocked(netracellRuns, completedIds)) {
            return "Crossed out because 4 or more of the 5 shared Search Pulses are already spent on Netracells. Temporal Archimedea needs 2 remaining surges from that pool, so it can no longer be completed this week.";
        }
        return "Complete this week's Temporal Archimedea. Marking this complete consumes 2 Search Pulses from the shared 5-run pool with Netracells and Deep Archimedea.";
    }

    return task.description;
}

function getTaskDeadlineLine(task: TaskDef, worldState: WorldStateData | null, timeMode: TimeMode, now: Date): string | null {
    if (task.bucket === "four_day") {
        const nextReset = new Date(fourDayResetStart(now));
        nextReset.setUTCDate(nextReset.getUTCDate() + 4);
        return `Rotates ${fmtAbs(nextReset, timeMode)}`;
    }

    if (!task.usesDynamicInstance) return null;
    const nextReset = dynamicTaskNextReset(task.id, worldState, now);
    if (!nextReset || Number.isNaN(nextReset.getTime()) || nextReset.getTime() <= now.getTime()) return null;

    if (task.id === "baro_visit") {
        return `${worldState?.voidTrader?.active ? "Leaves" : "Arrives"} ${fmtAbs(nextReset, timeMode)}`;
    }

    if (task.id === "varzia_rotation") {
        return `${worldState?.vaultTrader?.active ? "Ends" : "Returns"} ${fmtAbs(nextReset, timeMode)}`;
    }

    if (task.id === "sentient_outpost") {
        return `Ends ${fmtAbs(nextReset, timeMode)}`;
    }

    return `Rotates ${fmtAbs(nextReset, timeMode)}`;
}

function getCalendarTaskState(
    task: TaskDef,
    completedIds: Record<Exclude<Bucket, "conclave">, string[]> & { conclave_daily: string[]; conclave_weekly: string[] },
    rotationCompletedIds: string[],
    netracellRuns: number,
): TaskRenderState {
    if (task.bucket === "rotation") return getTaskRenderState(task, rotationCompletedIds, netracellRuns);
    if (task.bucket === "conclave") {
        return getTaskRenderState(
            task,
            task.conclaveSub === "conclave_daily" ? completedIds.conclave_daily : completedIds.conclave_weekly,
            netracellRuns,
        );
    }
    return getTaskRenderState(task, completedIds[task.bucket], netracellRuns);
}

function getCompletedTaskCount(tasks: TaskDef[], completedIds: string[], netracellRuns: number): number {
    return tasks.filter((task) => getTaskRenderState(task, completedIds, netracellRuns) !== "pending").length;
}

// ─── Baro Ki'Teer live computation ─────────────────────────────────────────────

function getBaroStatus(now: Date, worldState: WorldStateData | null = null): {
    present: boolean;
    label: string;
    detail: string;
    timeLeftMs: number | null;
    timeUntilMs: number;
    location: string;
    source: "api" | "prediction";
} {
    const ms = now.getTime();
    const traders = worldState?.voidTraders.length
        ? worldState.voidTraders
        : worldState?.voidTrader ? [worldState.voidTrader] : [];
    const liveWindow = getCurrentOrNextVoidTrader(traders, ms);
    if (liveWindow) {
        if (liveWindow.active) {
            const remaining = liveWindow.timeLeftMs;
            return {
                present: true,
                label: "Baro Ki'Teer — HERE NOW",
                detail: remaining == null ? "The World State API reports an active visit." : `Leaves in ${fmtMs(remaining)} · live World State schedule`,
                timeLeftMs: remaining,
                timeUntilMs: 0,
                location: liveWindow.trader.location,
                source: "api",
            };
        }
        return {
            present: false,
            label: "Baro Ki'Teer",
            detail: `Arrives in ${fmtMs(liveWindow.timeUntilMs ?? 0)} · live World State schedule`,
            timeLeftMs: 0,
            timeUntilMs: liveWindow.timeUntilMs ?? 0,
            location: liveWindow.trader.location,
            source: "api",
        };
    }

    const offset = ((ms - BARO_ANCHOR_MS) % BARO_PERIOD_MS + BARO_PERIOD_MS) % BARO_PERIOD_MS;
    const cycleStart = ms - offset;
    const leaveMs = cycleStart + BARO_WINDOW_MS;
    const nextArrivalMs = cycleStart + BARO_PERIOD_MS;

    if (ms < leaveMs) {
        const remaining = leaveMs - ms;
        return {
            present: true,
            label: "Baro Ki'Teer — HERE NOW",
            detail: "Predicted window · estimated from the 14-day schedule; live API timing is unavailable.",
            timeLeftMs: remaining,
            timeUntilMs: 0,
            location: "",
            source: "prediction",
        };
    }

    const until = nextArrivalMs - ms;
    return {
        present: false,
        label: "Baro Ki'Teer",
        detail: `Next predicted window in ${fmtMs(until)} · live API timing is unavailable.`,
        timeLeftMs: 0,
        timeUntilMs: until,
        location: "",
        source: "prediction",
    };
}

// ─── LocalStorage ───────────────────────────────────────────────────────────────

function makeDefault(now: Date): RCState {
    const keys = getCurrentKeys(now);
    return {
        timeMode: "utc",
        primaryDailyResetKey: keys.primary_daily,
        completedPrimaryDailyTaskIds: [],
        eightHourResetKey: keys.eight_hour,
        completedEightHourTaskIds: [],
        secondaryDailyResetKey: keys.secondary_daily,
        completedSecondaryDailyTaskIds: [],
        weeklyMondayResetKey: keys.weekly_monday,
        completedWeeklyMondayTaskIds: [],
        fourDayResetKey: keys.four_day,
        completedFourDayTaskIds: [],
        completedRotationTaskInstanceKeys: {},
        conclaveWeeklyResetKey: keys.conclave_weekly,
        completedConclaveWeeklyTaskIds: [],
        conclaveDailyResetKey: keys.conclave_daily,
        completedConclaveDailyTaskIds: [],
        hiddenTaskIds: [],
        netracellRuns: 0,
    };
}

function loadState(): RCState {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as RCState;
            if (!Array.isArray(parsed.hiddenTaskIds)) parsed.hiddenTaskIds = [];
            if (!Array.isArray(parsed.completedEightHourTaskIds)) parsed.completedEightHourTaskIds = [];
            if (!Array.isArray(parsed.completedFourDayTaskIds)) parsed.completedFourDayTaskIds = [];
            if (!parsed.completedRotationTaskInstanceKeys || typeof parsed.completedRotationTaskInstanceKeys !== "object") {
                parsed.completedRotationTaskInstanceKeys = {};
            }
            if (!Array.isArray(parsed.completedConclaveWeeklyTaskIds)) parsed.completedConclaveWeeklyTaskIds = [];
            if (!Array.isArray(parsed.completedConclaveDailyTaskIds)) parsed.completedConclaveDailyTaskIds = [];
            if (!parsed.eightHourResetKey) parsed.eightHourResetKey = eightHourResetKey(new Date());
            if (!parsed.fourDayResetKey) parsed.fourDayResetKey = fourDayResetKey(new Date());
            if (!parsed.conclaveWeeklyResetKey) parsed.conclaveWeeklyResetKey = conclaveWeeklyKey(new Date());
            if (!parsed.conclaveDailyResetKey) parsed.conclaveDailyResetKey = conclaveDailyKey(new Date());
            if (typeof parsed.netracellRuns !== "number") parsed.netracellRuns = 0;
            return parsed;
        }
    } catch {
        // ignore malformed local state
    }
    return makeDefault(new Date());
}

function saveState(s: RCState): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {
        // ignore storage write errors
    }
}

function syncResets(s: RCState, now: Date): RCState {
    const keys = getCurrentKeys(now);
    let next = s;

    // Standard buckets — also clear netracellRuns when weekly monday resets
    (["primary_daily", "eight_hour", "secondary_daily", "weekly_monday", "four_day"] as const).forEach((b) => {
        const rk = RESET_KEY[b]!;
        const ck = COMPLETED_KEY[b]!;
        if (next[rk] !== keys[b]) {
            next = { ...next, [rk]: keys[b], [ck]: [] };
            if (b === "weekly_monday") next = { ...next, netracellRuns: 0 };
        }
    });

    // Conclave sub-windows
    if (next.conclaveDailyResetKey !== keys.conclave_daily) next = { ...next, conclaveDailyResetKey: keys.conclave_daily, completedConclaveDailyTaskIds: [] };
    if (next.conclaveWeeklyResetKey !== keys.conclave_weekly) next = { ...next, conclaveWeeklyResetKey: keys.conclave_weekly, completedConclaveWeeklyTaskIds: [] };

    return next;
}

// ─── Visibility helpers ─────────────────────────────────────────────────────────

function getEligibleTasks(
    completedPrereqs: Record<string, boolean>,
    syndicates: SyndicateState[],
    worldState: WorldStateData | null,
): TaskDef[] {
    const pledgedIds = new Set(
        syndicates.filter((s) => s.pledged && RELAY_FACTION_IDS.has(s.id as SyndicateId)).map((s) => s.id)
    );
    const anyPledged = pledgedIds.size > 0;

    return ALL_TASKS.filter((t) => {
        if (t.isFactionStanding && t.factionSyndicateId) {
            if (anyPledged && !pledgedIds.has(t.factionSyndicateId)) return false;
        }
        if (!(t.prereqIds ?? []).every((id) => completedPrereqs[id] === true)) return false;
        if (t.usesDynamicInstance && worldState && !dynamicTaskInstanceKey(t.id, worldState)) return false;
        if (t.isVisible) return t.isVisible({ completedPrereqs, syndicates });
        return true;
    });
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function CheckIcon() {
    return (
        <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// Netracell run counter — 5 pip dots the player clicks to fill/unfill
function NetracellCounter({
    runs,
    onChange,
    description,
}: {
    runs: number;
    onChange: (n: number) => void;
    description: string;
}) {
    const done = runs >= 5;
    return (
        <div
            className={[
                "flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors w-full",
                done
                    ? "border-emerald-900/30 bg-emerald-950/10"
                    : "border-transparent hover:border-slate-700 hover:bg-slate-900/50",
            ].join(" ")}
        >
            <div
                className={[
                    "flex-shrink-0 w-4 h-4 mt-0.5 rounded border flex items-center justify-center",
                    done ? "border-emerald-800 bg-emerald-950/30" : "border-slate-600 bg-slate-900",
                ].join(" ")}
            >
                {done && <CheckIcon />}
            </div>
            <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium leading-tight ${done ? "text-emerald-500" : "text-slate-200"}`}>
                    Netracells
                </div>
                <div className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                    {Array.from({ length: 5 }, (_, i) => {
                        const filled = i < runs;
                        return (
                            <button
                                key={i}
                                title={`${i + 1} / 5`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(filled && i === runs - 1 ? runs - 1 : i + 1);
                                }}
                                className={[
                                    "w-5 h-5 rounded-full border text-[10px] font-semibold transition-all flex items-center justify-center",
                                    filled
                                        ? "border-emerald-700 bg-emerald-800 text-emerald-200 hover:bg-emerald-700"
                                        : "border-slate-600 bg-slate-900 text-slate-600 hover:border-slate-400 hover:text-slate-400",
                                ].join(" ")}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                    <span className={`ml-1 text-xs tabular-nums ${done ? "text-emerald-400" : "text-slate-500"}`}>
                        {runs}/5
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── World State inline hints ───────────────────────────────────────────────────

const FACTION_COLOR: Record<string, string> = {
    Grineer: "text-red-400", Corpus: "text-blue-400",
    Infested: "text-green-400", Infestation: "text-green-400",
    Corrupted: "text-violet-400", Orokin: "text-violet-400",
};

function WsChip({ children, color = "text-slate-400", bg = "bg-slate-800/60", border = "border-slate-700/50" }: {
    children: React.ReactNode; color?: string; bg?: string; border?: string;
}) {
    return (
        <span className={`inline-block rounded-full border px-1.5 py-px text-[9px] font-medium leading-tight ${color} ${bg} ${border}`}>
            {children}
        </span>
    );
}

// ─── Calendar helpers + modal ────────────────────────────────────────────────────

function CalEventCard({ ev }: { ev: CalendarEvent }) {
    const meta = CAL_EVENT_META[ev.type];

    // Birthday days: show a cake and name only — no gameplay detail to display
    if (ev.type === "Birthday") {
        return (
            <div className="rounded-lg border border-pink-900/40 bg-pink-950/20 px-3 py-2.5 flex items-center gap-2.5">
                <span className="text-xl leading-none">🎂</span>
                <div className="text-sm text-pink-200 font-medium">{ev.title}</div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
            {/* Category label */}
            <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${meta?.dot ?? "bg-slate-500"}`} />
                <div className={`text-xs font-semibold ${meta?.textColor ?? "text-slate-400"}`}>{meta?.label ?? (ev.type || "Event")}</div>
            </div>

            {/* Title — what the challenge/override is called */}
            {ev.title && <div className="text-sm text-slate-200 font-medium leading-snug">{ev.title}</div>}

            {/* Description — what the player actually has to do, or what the override does */}
            {ev.description && <div className="text-xs text-slate-400 mt-1 leading-snug">{ev.description}</div>}

            {/* Reward */}
            {ev.reward && (
                <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Reward:</span>
                    <span className="text-[10px] text-amber-300 font-medium">{ev.reward}</span>
                </div>
            )}
        </div>
    );
}

const CAL_EVENT_META: Record<string, { dot: string; label: string; textColor: string }> = {
    "To Do":      { dot: "bg-sky-400",    label: "To Do",      textColor: "text-sky-300"    },
    "Big Prize!": { dot: "bg-amber-400",  label: "Big Prize!", textColor: "text-amber-300"  },
    "Override":   { dot: "bg-violet-400", label: "Override",   textColor: "text-violet-300" },
    "Birthday":   { dot: "bg-pink-400",   label: "Birthday",   textColor: "text-pink-300"   },
};

type CalEntry = { dayIndex: number; date: Date; events: CalendarEvent[] };
type MonthGroup = { key: string; label: string; startDow: number; daysInMonth: number; entries: Map<number, CalEntry> };

function parseCalDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

function groupCalendarByMonth(days: NonNullable<WorldStateData["calendar"]>["days"]): MonthGroup[] {
    const groups = new Map<string, MonthGroup>();
    days.forEach((day, idx) => {
        const d = parseCalDate(day.date);
        if (!d) return;
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        if (!groups.has(key)) {
            const firstOfMonth = new Date(Date.UTC(year, month, 1));
            const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
            const label = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
            groups.set(key, { key, label, startDow: firstOfMonth.getUTCDay(), daysInMonth, entries: new Map() });
        }
        groups.get(key)!.entries.set(d.getUTCDate(), { dayIndex: idx, date: d, events: Array.isArray(day.events) ? day.events : [] });
    });
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
}

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function TrackerCalendarModal({ calendar, onClose }: {
    calendar: NonNullable<WorldStateData["calendar"]>;
    onClose: () => void;
}) {
    const [selectedEntry, setSelectedEntry] = useState<CalEntry | null>(null);
    const months = useMemo(() => groupCalendarByMonth(calendar.days ?? []), [calendar.days]);
    const todayDayIndex = calendar.currentDay !== undefined ? Number(calendar.currentDay) : -1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                    <div>
                        <div className="text-base font-semibold text-slate-100">1999 Calendar Season</div>
                        <div className="text-xs text-slate-500 mt-0.5">Weekly challenges, prizes, and Hex Override choices</div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-5 px-5 py-2.5 border-b border-slate-800/50 bg-slate-950/80">
                    {Object.entries(CAL_EVENT_META).filter(([key]) => key !== "Birthday").map(([key, meta]) => (
                        <div key={key} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                            <span className={`text-[11px] ${meta.textColor}`}>{meta.label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] leading-none">🎂</span>
                        <span className="text-[11px] text-pink-300">Birthday</span>
                    </div>
                    <span className="ml-auto text-[11px] text-slate-600">Click a day for details</span>
                </div>

                {/* Content: calendar grids + side detail panel */}
                <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

                    {/* Month grids — scrollable */}
                    <div className="flex-1 p-5 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {months.map((month) => (
                                <div key={month.key}>
                                    <div className="text-sm font-semibold text-slate-300 mb-3">{month.label}</div>
                                    <div className="grid grid-cols-7 mb-1">
                                        {DOW_LABELS.map((l) => (
                                            <div key={l} className="text-center text-[10px] text-slate-600 font-medium py-1">{l}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-0.5">
                                        {Array.from({ length: month.startDow }, (_, i) => (
                                            <div key={`blank-${i}`} />
                                        ))}
                                        {Array.from({ length: month.daysInMonth }, (_, i) => {
                                            const dayNum = i + 1;
                                            const entry = month.entries.get(dayNum);
                                            const isToday = entry?.dayIndex === todayDayIndex;
                                            const isSelected = selectedEntry != null && selectedEntry.dayIndex === entry?.dayIndex;
                                            const eventKeys = entry ? entry.events.map((ev) => ev.type) : [];
                                            return (
                                                <button
                                                    key={dayNum}
                                                    onClick={() => entry && setSelectedEntry(isSelected ? null : entry)}
                                                    disabled={!entry}
                                                    className={[
                                                        "relative flex flex-col items-center rounded-lg py-1 px-0.5 min-h-[40px] transition-colors",
                                                        entry ? "hover:bg-slate-800 cursor-pointer" : "cursor-default",
                                                        isToday ? "ring-1 ring-blue-500/60 bg-slate-800/70" : "",
                                                        isSelected ? "bg-slate-700 ring-1 ring-slate-500" : "",
                                                    ].join(" ")}
                                                >
                                                    <span className={`text-[11px] font-medium ${isToday ? "text-blue-300" : entry ? "text-slate-300" : "text-slate-700"}`}>
                                                        {dayNum}
                                                    </span>
                                                    {eventKeys.length > 0 && (
                                                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                                                            {eventKeys.map((k, ki) =>
                                                                k === "Birthday"
                                                                    ? <span key={ki} className="text-[9px] leading-none">🎂</span>
                                                                    : <div key={ki} className={`w-1.5 h-1.5 rounded-full ${CAL_EVENT_META[k]?.dot ?? "bg-slate-500"}`} />
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Day detail — side panel on desktop, below on mobile */}
                    <div className={[
                        "md:w-72 shrink-0 overflow-y-auto border-slate-800",
                        selectedEntry ? "block border-t md:border-t-0 md:border-l" : "hidden md:flex md:border-l",
                    ].join(" ")}>
                        {selectedEntry ? (
                            <div className="p-4">
                                <div className="text-xs font-medium text-slate-400 mb-3">
                                    {selectedEntry.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
                                </div>
                                <div className="space-y-2">
                                    {selectedEntry.events.map((ev, i) => (
                                        <CalEventCard key={i} ev={ev} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-600 p-6 text-center">
                                Click a day to see event details
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

function CalendarHint({ calendar }: { calendar: NonNullable<WorldStateData["calendar"]> }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className="mt-1.5 flex items-center">
                <button
                    onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                    className="ml-auto flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded px-1.5 py-0.5 transition-colors"
                >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
                        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                    </svg>
                    View calendar
                </button>
            </div>
            {open && <TrackerCalendarModal calendar={calendar} onClose={() => setOpen(false)} />}
        </>
    );
}

type HintMaps = { inline: Record<string, React.ReactNode>; expandable: Record<string, React.ReactNode> };

/** Build per-task world state hint maps from live data.
 *  `inline`     — always visible (e.g. calendar button)
 *  `expandable` — revealed by chevron (missions, acts, choices, etc.)
 */
function buildWorldStateHints(data: WorldStateData | null): HintMaps {
    if (!data) return { inline: {}, expandable: {} };
    const inline: Record<string, React.ReactNode> = {};
    const expandable: Record<string, React.ReactNode> = {};
    const hints = expandable; // all non-calendar hints go into expandable

    // ── Sortie ──────────────────────────────────────────────────────────────────
    if (data.sortie && !data.sortie.expired) {
        const s = data.sortie;
        hints["sortie_set"] = (
            <div className="mt-1.5 space-y-1">
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className={FACTION_COLOR[s.faction] ?? "text-slate-400"}>{s.faction}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">{s.boss}</span>
                    {s.rewardPool && <WsChip color="text-amber-300" bg="bg-amber-950/30" border="border-amber-700/40">{s.rewardPool}</WsChip>}
                </div>
                {s.variants.map((v, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-medium text-slate-300">{v.missionType}</span>
                            {v.modifier && <WsChip color="text-orange-300" bg="bg-orange-950/20" border="border-orange-700/40">{v.modifier}</WsChip>}
                        </div>
                        <div className="text-[9px] text-slate-500">{v.node}</div>
                        {v.modifierDescription && (
                            <div className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">{v.modifierDescription}</div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // ── Archon Hunt ─────────────────────────────────────────────────────────────
    if (data.archonHunt?.active) {
        const ah = data.archonHunt;
        hints["archon_hunt"] = (
            <div className="mt-1.5 space-y-1">
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className={FACTION_COLOR[ah.faction] ?? "text-slate-400"}>{ah.faction}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">{ah.boss}</span>
                </div>
                {ah.missions.map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <span className="text-[9px] font-bold text-slate-500">{i + 1}</span>
                        <span className="text-[10px] font-medium text-slate-300">{m.type}</span>
                        <span className="text-[9px] text-slate-500 truncate">{m.node}</span>
                    </div>
                ))}
            </div>
        );
    }

    // ── Nightwave acts ───────────────────────────────────────────────────────────
    if (data.nightwave) {
        const nw = data.nightwave;
        const daily  = nw.activeChallenges.filter((a) => a.isDaily);
        const weekly = nw.activeChallenges.filter((a) => !a.isDaily && !a.isElite);
        const elite  = nw.activeChallenges.filter((a) => a.isElite);

        const renderActs = (acts: typeof daily) => acts.length === 0 ? null : (
            <div className="mt-1.5 space-y-1">
                {acts.map((act) => (
                    <div key={act.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-medium text-slate-300 leading-tight">{act.title}</span>
                            <span className="shrink-0 text-[9px] font-bold text-blue-300">{act.reputation.toLocaleString()}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">{act.desc}</div>
                    </div>
                ))}
            </div>
        );

        if (daily.length > 0)  hints["nightwave_daily"]  = renderActs(daily);
        if (weekly.length > 0) hints["nightwave_weekly"] = renderActs(weekly);
        if (elite.length > 0)  hints["nightwave_elite"]  = renderActs(elite);
    }

    // ── Circuit choices ──────────────────────────────────────────────────────────
    if (data.duviriCycle?.choices?.length) {
        const normalGroup = data.duviriCycle.choices.find((g) => g.category === "normal" || g.categoryKey?.includes("NORMAL"));
        const hardGroup   = data.duviriCycle.choices.find((g) => g.category === "hard"   || g.categoryKey?.includes("HARD"));

        if (normalGroup) {
            hints["circuit_reward_track"] = (
                <div className="mt-1.5">
                    <div className="text-[9px] text-slate-500 mb-1">This week's Warframe picks</div>
                    <div className="flex flex-wrap gap-1">
                        {normalGroup.choices.map((name, i) => (
                            <WsChip key={i} color="text-blue-300" bg="bg-blue-950/30" border="border-blue-700/40">{name}</WsChip>
                        ))}
                    </div>
                </div>
            );
        }
        if (hardGroup) {
            hints["circuit_incarnon"] = (
                <div className="mt-1.5">
                    <div className="text-[9px] text-slate-500 mb-1">This week's Incarnon picks (Steel Path)</div>
                    <div className="flex flex-wrap gap-1">
                        {hardGroup.choices.map((name, i) => (
                            <WsChip key={i} color="text-red-300" bg="bg-red-950/20" border="border-red-700/40">{name}</WsChip>
                        ))}
                    </div>
                </div>
            );
        }
    }

    // ── Archimedeas (deep + temporal) ────────────────────────────────────────────
    for (const arch of (data.archimedeas ?? [])) {
        if (arch.expired || arch.variants.length === 0) continue;

        const isHex = arch.tag?.includes("H") || arch.tag?.includes("HEX");
        const taskId = isHex ? "deep_archimedea" : "temporal_archimedea";

        const allMods = [...(arch.personalModifiers ?? []), ...(arch.deviations ?? []), ...(arch.risks ?? [])];

        hints[taskId] = (
            <div className="mt-1.5 space-y-1">
                {arch.variants.map((v, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-medium text-slate-300">{v.type}</span>
                            {v.modifier && <WsChip color="text-orange-300" bg="bg-orange-950/20" border="border-orange-700/40">{v.modifier}</WsChip>}
                        </div>
                        <div className="text-[9px] text-slate-500">{v.node}</div>
                    </div>
                ))}
                {allMods.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                        {allMods.map((m, i) => (
                            <WsChip key={i} color="text-cyan-300" bg="bg-cyan-950/20" border="border-cyan-700/40">{m.tag}</WsChip>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ── 1999 Calendar — inline CalendarHint with modal ──────────────────────────
    if (data.calendar?.days?.length) {
        inline["calendar_1999"] = <CalendarHint calendar={data.calendar} />;
    }

    // ── Steel Path Honor ─────────────────────────────────────────────────────────
    if (data.steelPath?.currentReward) {
        const sp = data.steelPath.currentReward;
        hints["steel_path_honors"] = (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-300 font-medium">{sp.name}</span>
                <WsChip color="text-slate-400">{sp.cost} Steel Essence</WsChip>
            </div>
        );
    }

    hints["chipper_weekly"] = (
        <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
            <div className="text-[10px] font-medium text-slate-300">Kahl's Garrison</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
                Check Chipper's weekly stock after the Monday reset and before spending Stock elsewhere.
            </div>
        </div>
    );
    hints["nightwave_cred_offerings"] = (
        <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
            <div className="text-[10px] font-medium text-slate-300">Nightwave Store</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
                Review Nora's current Cred offerings after the weekly reset.
            </div>
        </div>
    );
    hints["cavalero_incarnon_market"] = (
        <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
            <div className="text-[10px] font-medium text-slate-300">Cavalero</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
                Review this week's Incarnon market stock in the Chrysalith.
            </div>
        </div>
    );
    hints["k_drive_races"] = (
        <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
            <div className="text-[10px] font-medium text-slate-300">Orb Vallis</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
                Five active K-Drive races rotate with the daily reset.
            </div>
        </div>
    );
    hints["ergo_glast_tenet_rotation"] = (
        <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
            <div className="text-[10px] font-medium text-slate-300">Ergo Glast</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
                Tenet melee and weapon bonus stock rotates every four days.
            </div>
        </div>
    );
    hints["eleanor_coda_rotation"] = (
        <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
            <div className="text-[10px] font-medium text-slate-300">Eleanor</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
                Coda weapon availability rotates every four days.
            </div>
        </div>
    );

    // ── Simaris target ───────────────────────────────────────────────────────────
    if (data.simaris?.target) {
        hints["standing_cephalon_simaris"] = (
            <div className="mt-1 text-[10px] text-slate-400">
                Synthesis target: <span className="text-slate-200 font-medium">{data.simaris.target}</span>
                {data.simaris.isTargetActive && <span className="ml-1 text-green-400">(active)</span>}
            </div>
        );

        hints["simaris_daily_synthesis"] = (
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="text-[10px] font-medium text-slate-300">{data.simaris.target}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                    {data.simaris.isTargetActive ? "Active in current mission" : "Pick up and finish today's synthesis target."}
                </div>
            </div>
        );
    }

    if (data.dailyDeals.length > 0) {
        const deal = data.dailyDeals[0];
        hints["darvo_daily_deal"] = (
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-medium text-slate-300 truncate">{deal.item}</span>
                    <WsChip color="text-green-300" bg="bg-green-950/20" border="border-green-700/40">{deal.discount}% off</WsChip>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                    {deal.salePrice.toLocaleString()} plat · {deal.sold}/{deal.total} sold
                </div>
            </div>
        );
    }

    const bountyHintMap: Record<string, string> = {
        ostrons_bounties: "Ostrons",
        solaris_bounties: "Solaris United",
        entrati_bounties: "Entrati",
        holdfasts_bounties: "The Holdfasts",
        cavia_bounties: "Cavia",
        hex_bounties: "The Hex",
    };
    for (const [taskId, syndicateKey] of Object.entries(bountyHintMap)) {
        const board = getSyndicateMissionBoard(data, syndicateKey);
        if (!board || board.jobs.length === 0) continue;
        hints[taskId] = (
            <div className="mt-1.5 space-y-1">
                {board.jobs.slice(0, 4).map((job) => (
                    <div key={job.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-medium text-slate-300">{job.type}</span>
                            {job.enemyLevels.length >= 2 && (
                                <WsChip color="text-slate-400">{job.enemyLevels[0]}-{job.enemyLevels[job.enemyLevels.length - 1]}</WsChip>
                            )}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                            {job.rewardPool.slice(0, 2).join(" · ") || "Reward data unavailable"}
                        </div>
                    </div>
                ))}
                {board.jobs.length > 4 && (
                    <div className="text-[9px] text-slate-600">+{board.jobs.length - 4} more bounty tiers</div>
                )}
            </div>
        );
    }

    if (data.arbitration) {
        hints["arbitration"] = (
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="text-[10px] font-medium text-slate-300">{data.arbitration.type}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">{data.arbitration.node}</div>
                <div className="text-[9px] text-slate-500">{data.arbitration.enemy}</div>
            </div>
        );
    }

    const kuvaFlood = data.kuva.find((k) => k.isFlood);
    if (kuvaFlood) {
        hints["kuva_flood"] = (
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="text-[10px] font-medium text-slate-300">{kuvaFlood.type}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">{kuvaFlood.node}</div>
            </div>
        );
    }

    const kuvaSiphons = data.kuva.filter((k) => !k.isFlood);
    if (kuvaSiphons.length > 0) {
        hints["kuva_siphons"] = (
            <div className="mt-1.5 space-y-1">
                {kuvaSiphons.slice(0, 4).map((mission, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <div className="text-[10px] font-medium text-slate-300">{mission.type}</div>
                        <div className="text-[9px] text-slate-500">{mission.node}</div>
                    </div>
                ))}
                {kuvaSiphons.length > 4 && (
                    <div className="text-[9px] text-slate-600">+{kuvaSiphons.length - 4} more siphons</div>
                )}
            </div>
        );
    }

    if (data.voidTrader) {
        const trader = data.voidTrader;
        hints["baro_visit"] = (
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${trader.active ? "bg-amber-400" : "bg-slate-500"}`} />
                    <span className="text-[10px] font-medium text-slate-300">{trader.active ? "Here now" : "Next visit"}</span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">{trader.location || "Relay"}</div>
                {trader.inventory.length > 0 && (
                    <div className="text-[9px] text-slate-600">{trader.inventory.length} items in inventory</div>
                )}
            </div>
        );
    }

    if (data.vaultTrader) {
        const trader = data.vaultTrader;
        hints["varzia_rotation"] = (
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${trader.active ? "bg-violet-400" : "bg-slate-500"}`} />
                    <span className="text-[10px] font-medium text-slate-300">{trader.active ? "Active" : "Inactive"}</span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">{trader.location || "Maroo's Bazaar"}</div>
                {trader.inventory.length > 0 && (
                    <div className="text-[9px] text-slate-600">{trader.inventory.length} items in rotation</div>
                )}
            </div>
        );
    }

    if (data.sentientOutposts?.active && data.sentientOutposts.mission) {
        const outpost = data.sentientOutposts;
        const mission = outpost.mission!;
        hints["sentient_outpost"] = (
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="text-[10px] font-medium text-slate-300">{mission.type}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">{mission.node}</div>
                <div className="text-[9px] text-slate-500">{mission.faction}</div>
            </div>
        );
    }

    return { inline, expandable };
}

// Chevron icon used by expand/collapse buttons
function ChevronDown({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// Renders a flat list of tasks for a single sub-section
function TaskList({
    tasks,
    completedIds,
    onToggle,
    netracellRuns,
    onNetracellChange,
    timeMode,
    worldState,
    now,
    inlineHints,
    expandableHints,
}: {
    tasks: TaskDef[];
    completedIds: string[];
    onToggle: (id: string) => void;
    netracellRuns?: number;
    onNetracellChange?: (n: number) => void;
    timeMode: TimeMode;
    worldState: WorldStateData | null;
    now: Date;
    inlineHints?: Record<string, React.ReactNode>;
    expandableHints?: Record<string, React.ReactNode>;
}) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const runs = netracellRuns ?? 0;

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const pending = tasks.filter((t) => getTaskRenderState(t, completedIds, runs) === "pending");
    const completed = tasks.filter((t) => getTaskRenderState(t, completedIds, runs) !== "pending");
    const expandableTaskIds = tasks.filter(t => !!expandableHints?.[t.id]).map(t => t.id);

    if (tasks.length === 0) {
        return (
            <div className="px-3 py-4 text-sm text-slate-500 text-center">
                No tasks unlocked for this window
            </div>
        );
    }

    const renderTaskBody = (
        t: TaskDef,
        description: string,
        labelClass: string,
        checkboxNode: React.ReactNode,
        outerClass: string,
        deadlineLine: string | null,
        onClickToggle?: () => void,
    ) => {
        const hasExpandable = !!expandableHints?.[t.id];
        const isExpanded = expandedIds.has(t.id);
        const hasInline = !!inlineHints?.[t.id];

        return (
            <div key={t.id} className={`rounded-xl border transition-colors w-full overflow-hidden ${outerClass}`}>
                <div className="flex items-start">
                    {onClickToggle ? (
                        <button
                            className="flex items-start gap-2.5 flex-1 min-w-0 px-3 py-2.5 text-left"
                            onClick={onClickToggle}
                        >
                            {checkboxNode}
                            <div className="min-w-0 flex-1">
                                <div className={`text-sm font-medium leading-tight ${labelClass}`}>{t.label}</div>
                                <div className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</div>
                                {deadlineLine && <div className="text-[10px] text-slate-600 mt-1">{deadlineLine}</div>}
                            </div>
                        </button>
                    ) : (
                        <div className="flex items-start gap-2.5 flex-1 min-w-0 px-3 py-2.5">
                            {checkboxNode}
                            <div className="min-w-0 flex-1">
                                <div className={`text-sm font-medium leading-tight ${labelClass}`}>{t.label}</div>
                                <div className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</div>
                                {deadlineLine && <div className="text-[10px] text-slate-600 mt-1">{deadlineLine}</div>}
                            </div>
                        </div>
                    )}
                    {hasExpandable && (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                            className="flex-shrink-0 px-2 py-3 text-slate-600 hover:text-slate-400 transition-colors self-start"
                            title={isExpanded ? "Hide details" : "Show details"}
                        >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                    )}
                </div>
                {hasInline && (
                    <div className="px-3 pb-2.5">
                        {inlineHints![t.id]}
                    </div>
                )}
                {hasExpandable && isExpanded && (
                    <div className="px-3 pb-2.5 pt-1.5 border-t border-slate-800/60">
                        {expandableHints![t.id]}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-2">
            {expandableTaskIds.length > 0 && (
                <div className="flex justify-end gap-2 px-1">
                    <button
                        onClick={() => setExpandedIds(new Set(expandableTaskIds))}
                        className="text-[10px] rounded-full border border-slate-700 px-2.5 py-1 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
                    >
                        Expand All
                    </button>
                    <button
                        onClick={() => setExpandedIds(new Set())}
                        className="text-[10px] rounded-full border border-slate-700 px-2.5 py-1 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
                    >
                        Collapse All
                    </button>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {pending.map((t) => {
                const description = getTaskDescription(t, completedIds, runs);
                const deadlineLine = getTaskDeadlineLine(t, worldState, timeMode, now);

                if (t.id === NETRACELLS_TASK_ID && netracellRuns !== undefined && onNetracellChange) {
                    return (
                        <NetracellCounter
                            key={t.id}
                            runs={netracellRuns}
                            onChange={onNetracellChange}
                            description={description}
                        />
                    );
                }

                return renderTaskBody(
                    t,
                    description,
                    "text-slate-200",
                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 rounded border border-slate-600 bg-slate-900" />,
                    "border-transparent hover:border-slate-700 hover:bg-slate-900/50",
                    deadlineLine,
                    () => onToggle(t.id),
                );
            })}

            {completed.length > 0 && (
                <div className="col-span-full flex items-center gap-3 py-1 px-1">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-[11px] text-slate-600">Completed · {completed.length}</span>
                    <div className="flex-1 h-px bg-slate-800" />
                </div>
            )}

            {completed.map((t) => {
                const state = getTaskRenderState(t, completedIds, runs);
                const description = getTaskDescription(t, completedIds, runs);
                const deadlineLine = getTaskDeadlineLine(t, worldState, timeMode, now);

                if (t.id === NETRACELLS_TASK_ID && netracellRuns !== undefined && onNetracellChange) {
                    return (
                        <NetracellCounter
                            key={t.id}
                            runs={netracellRuns}
                            onChange={onNetracellChange}
                            description={description}
                        />
                    );
                }

                if (state === "auto_blocked") {
                    return renderTaskBody(
                        t,
                        description,
                        "text-amber-300 line-through",
                        <div className="flex-shrink-0 w-4 h-4 mt-0.5 rounded border border-amber-800/50 bg-amber-950/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
                            </svg>
                        </div>,
                        "border-amber-900/30 bg-amber-950/10 opacity-80",
                        deadlineLine,
                        undefined, // no toggle
                    );
                }

                return renderTaskBody(
                    t,
                    description,
                    "text-emerald-500",
                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 rounded border border-emerald-800 bg-emerald-950/30 flex items-center justify-center">
                        <CheckIcon />
                    </div>,
                    "border-emerald-900/30 bg-emerald-950/10 opacity-70 hover:opacity-100",
                    deadlineLine,
                    () => onToggle(t.id),
                );
            })}
            </div>
        </div>
    );
}

// Standard single-bucket task panel (primary, secondary, weekly)
function TaskPanel({
    bucket,
    tasks,
    completedIds,
    tier,
    onToggle,
    onClear,
    timeMode,
    worldState,
    now,
    netracellRuns,
    onNetracellChange,
    inlineHints,
    expandableHints,
}: {
    bucket: Bucket;
    tasks: TaskDef[];
    completedIds: string[];
    tier: string;
    onToggle: (id: string) => void;
    onClear: () => void;
    timeMode: TimeMode;
    worldState: WorldStateData | null;
    now: Date;
    netracellRuns?: number;
    onNetracellChange?: (n: number) => void;
    inlineHints?: Record<string, React.ReactNode>;
    expandableHints?: Record<string, React.ReactNode>;
}) {
    const runs = netracellRuns ?? 0;
    const done = getCompletedTaskCount(tasks, completedIds, runs);
    const allDone = tasks.length > 0 && done === tasks.length;

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                <div>
                    <div className={`text-xs font-semibold uppercase tracking-wider ${URG_TITLE[tier]}`}>
                        {BUCKET_LABEL[bucket]}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{getBucketSub(timeMode)[bucket]}</div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${allDone ? "border-emerald-800 text-emerald-400" : "border-slate-700 text-slate-400"}`}>
                        {done}/{tasks.length}
                    </span>
                    <button
                        className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded px-2 py-0.5 transition-colors"
                        onClick={onClear}
                    >
                        Clear
                    </button>
                </div>
            </div>
            {tasks.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500 text-center">No tasks unlocked for this reset window</div>
            ) : (
                <div className="p-2">
                    <TaskList
                        tasks={tasks}
                        completedIds={completedIds}
                        onToggle={onToggle}
                        netracellRuns={netracellRuns}
                        onNetracellChange={onNetracellChange}
                        timeMode={timeMode}
                        worldState={worldState}
                        now={now}
                        inlineHints={inlineHints}
                        expandableHints={expandableHints}
                    />
                </div>
            )}
        </div>
    );
}

// Conclave panel — renders two internal sections: Daily and Weekly
function ConclavePanel({
    dailyTasks,
    weeklyTasks,
    completedDailyIds,
    completedWeeklyIds,
    tier,
    nextDailyReset,
    nextWeeklyReset,
    timeMode,
    onToggleDaily,
    onToggleWeekly,
    onClearDaily,
    onClearWeekly,
    inlineHints,
    expandableHints,
}: {
    dailyTasks: TaskDef[];
    weeklyTasks: TaskDef[];
    completedDailyIds: string[];
    completedWeeklyIds: string[];
    tier: string;
    nextDailyReset: Date;
    nextWeeklyReset: Date;
    timeMode: TimeMode;
    onToggleDaily: (id: string) => void;
    onToggleWeekly: (id: string) => void;
    onClearDaily: () => void;
    onClearWeekly: () => void;
    inlineHints?: Record<string, React.ReactNode>;
    expandableHints?: Record<string, React.ReactNode>;
}) {
    const dailyDone = getCompletedTaskCount(dailyTasks, completedDailyIds, 0);
    const weeklyDone = getCompletedTaskCount(weeklyTasks, completedWeeklyIds, 0);
    const totalDone = dailyDone + weeklyDone;
    const totalTasks = dailyTasks.length + weeklyTasks.length;
    const allDone = totalTasks > 0 && totalDone === totalTasks;

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                <div>
                    <div className={`text-xs font-semibold uppercase tracking-wider ${URG_TITLE[tier]}`}>
                        Conclave
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Daily 16:00 UTC · Weekly Fri 00:00 UTC</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${allDone ? "border-emerald-800 text-emerald-400" : "border-slate-700 text-slate-400"}`}>
                    {totalDone}/{totalTasks}
                </span>
            </div>

            <div className="p-3 flex flex-col gap-4">
                <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                            <span className="text-xs font-semibold text-slate-300">Daily</span>
                            <span className="ml-2 text-xs text-slate-500">resets {fmtAbs(nextDailyReset, timeMode)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{dailyDone}/{dailyTasks.length}</span>
                            <button
                                className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded px-2 py-0.5 transition-colors"
                                onClick={onClearDaily}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <TaskList tasks={dailyTasks} completedIds={completedDailyIds} onToggle={onToggleDaily} timeMode={timeMode} worldState={null} now={nextDailyReset} inlineHints={inlineHints} expandableHints={expandableHints} />
                </div>

                <div className="h-px bg-slate-800" />

                <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                            <span className="text-xs font-semibold text-slate-300">Weekly</span>
                            <span className="ml-2 text-xs text-slate-500">resets {fmtAbs(nextWeeklyReset, timeMode)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{weeklyDone}/{weeklyTasks.length}</span>
                            <button
                                className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded px-2 py-0.5 transition-colors"
                                onClick={onClearWeekly}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <TaskList tasks={weeklyTasks} completedIds={completedWeeklyIds} onToggle={onToggleWeekly} timeMode={timeMode} worldState={null} now={nextWeeklyReset} inlineHints={inlineHints} expandableHints={expandableHints} />
                </div>
            </div>
        </div>
    );
}

// Customize panel — grouped by bucket, with Conclave shown as its own group
function CustomizePanel({
    eligibleTasks,
    hiddenTaskIds,
    timeMode,
    onToggle,
    onShowAll,
    onHideAll,
}: {
    eligibleTasks: TaskDef[];
    hiddenTaskIds: string[];
    timeMode: TimeMode;
    onToggle: (id: string) => void;
    onShowAll: () => void;
    onHideAll: () => void;
}) {
    const hiddenCount = eligibleTasks.filter((t) => hiddenTaskIds.includes(t.id)).length;
    const visibleCount = eligibleTasks.filter((t) => !hiddenTaskIds.includes(t.id)).length;

    type Group = { key: string; label: string; sub?: string; tasks: TaskDef[] };
    const bucketSub = getBucketSub(timeMode);
    const groups: Group[] = [
        { key: "primary_daily", label: BUCKET_LABEL.primary_daily, sub: bucketSub.primary_daily, tasks: eligibleTasks.filter((t) => t.bucket === "primary_daily") },
        { key: "eight_hour", label: BUCKET_LABEL.eight_hour, sub: bucketSub.eight_hour, tasks: eligibleTasks.filter((t) => t.bucket === "eight_hour") },
        { key: "secondary_daily", label: BUCKET_LABEL.secondary_daily, sub: bucketSub.secondary_daily, tasks: eligibleTasks.filter((t) => t.bucket === "secondary_daily") },
        { key: "weekly_monday", label: BUCKET_LABEL.weekly_monday, sub: bucketSub.weekly_monday, tasks: eligibleTasks.filter((t) => t.bucket === "weekly_monday") },
        { key: "four_day", label: BUCKET_LABEL.four_day, sub: bucketSub.four_day, tasks: eligibleTasks.filter((t) => t.bucket === "four_day") },
        { key: "rotation", label: BUCKET_LABEL.rotation, sub: bucketSub.rotation, tasks: eligibleTasks.filter((t) => t.bucket === "rotation") },
        { key: "conclave", label: "Conclave", sub: `Daily ${fmtFixedUTC(16, 0, timeMode)} · Weekly Fri`, tasks: eligibleTasks.filter((t) => t.bucket === "conclave") },
    ].filter((g) => g.tasks.length > 0);

    return (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-100">Customize visible tasks</div>
                    <div className="text-xs text-slate-400 mt-1">Uncheck tasks you never want to see. Changes are saved automatically.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {hiddenCount > 0 && (
                        <button
                            className="text-xs border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded px-2.5 py-1 transition-colors"
                            onClick={onShowAll}
                        >
                            Show all ({hiddenCount} hidden)
                        </button>
                    )}
                    {visibleCount > 0 && (
                        <button
                            className="text-xs border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded px-2.5 py-1 transition-colors"
                            onClick={onHideAll}
                        >
                            Hide all
                        </button>
                    )}
                </div>
            </div>

            {groups.map(({ key, label, sub, tasks }) => (
                <div key={key}>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        {label}
                        {sub && <span className="ml-1.5 normal-case tracking-normal font-normal text-slate-600">{sub}</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                        {tasks.map((t) => {
                            const hidden = hiddenTaskIds.includes(t.id);
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => onToggle(t.id)}
                                    className={[
                                        "flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left w-full transition-all",
                                        hidden
                                            ? "border-slate-800 bg-slate-950/20 opacity-40 hover:opacity-70"
                                            : "border-slate-700 bg-slate-800/30 hover:bg-slate-800/50",
                                    ].join(" ")}
                                >
                                    <div
                                        className={[
                                            "flex-shrink-0 w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors",
                                            hidden ? "border-slate-700 bg-slate-900" : "border-slate-400 bg-slate-600",
                                        ].join(" ")}
                                    >
                                        {!hidden && (
                                            <svg className="w-2.5 h-2.5 text-slate-100" viewBox="0 0 24 24" fill="none">
                                                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`text-sm font-medium leading-tight ${hidden ? "text-slate-500 line-through" : "text-slate-200"}`}>
                                            {t.label}
                                            {t.conclaveSub && (
                                                <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                                                    {t.conclaveSub === "conclave_daily" ? "daily" : "weekly"}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5 leading-snug">{t.description}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

type CalendarTaskEvent = {
    id: string;
    startAt: Date;
    endAt: Date;
    task: TaskDef;
    bucketLabel: string;
};

type VisibleCalendarTaskEvent = CalendarTaskEvent & {
    continuesBefore: boolean;
    continuesAfter: boolean;
};

function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

function secondaryDailyResetStart(now: Date): Date {
    const slot = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16));
    if (now.getTime() >= slot.getTime()) return slot;
    slot.setUTCDate(slot.getUTCDate() - 1);
    return slot;
}

function conclaveWeeklyResetStart(now: Date): Date {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 2) % 7));
    return day;
}

function overlapsRange(startAt: Date, endAt: Date, rangeStart: Date, rangeEnd: Date): boolean {
    return startAt.getTime() < rangeEnd.getTime() && endAt.getTime() > rangeStart.getTime();
}

function getDynamicTaskWindow(taskId: string, data: WorldStateData | null, now: Date): { startAt: Date; endAt: Date } | null {
    if (!data) return null;

    const fallbackWindowMs: Record<string, number> = {
        arbitration: 60 * 60 * 1000,
        kuva_flood: 2 * 60 * 60 * 1000,
        kuva_siphons: 2 * 60 * 60 * 1000,
        sentient_outpost: 30 * 60 * 1000,
        ostrons_bounties: 150 * 60 * 1000,
        solaris_bounties: 150 * 60 * 1000,
        entrati_bounties: 150 * 60 * 1000,
        holdfasts_bounties: 150 * 60 * 1000,
        cavia_bounties: 150 * 60 * 1000,
        hex_bounties: 150 * 60 * 1000,
    };

    if (taskId === "baro_visit") {
        const trader = data.voidTrader;
        if (!trader) return null;
        if (trader.activation && trader.expiry) {
            return { startAt: new Date(trader.activation), endAt: new Date(trader.expiry) };
        }
        return null;
    }

    if (taskId === "varzia_rotation") {
        const trader = data.vaultTrader;
        if (!trader) return null;
        if (trader.active && trader.activation && trader.expiry) {
            return { startAt: new Date(trader.activation), endAt: new Date(trader.expiry) };
        }
        if (!trader.active && trader.activation) {
            const arrival = new Date(trader.activation);
            return { startAt: new Date(now), endAt: arrival };
        }
        return null;
    }

    const nextReset = dynamicTaskNextReset(taskId, data, now);
    if (!nextReset) return null;
    const fallback = fallbackWindowMs[taskId] ?? WINDOW_MS.rotation;
    return {
        startAt: new Date(nextReset.getTime() - fallback),
        endAt: nextReset,
    };
}

function buildCalendarTaskEvents(tasks: TaskDef[], rangeStart: Date, rangeEnd: Date, worldState: WorldStateData | null, now: Date): CalendarTaskEvent[] {
    const events: CalendarTaskEvent[] = [];

    tasks.forEach((task) => {
        if (task.usesDynamicInstance) {
            const window = getDynamicTaskWindow(task.id, worldState, now);
            if (window && overlapsRange(window.startAt, window.endAt, rangeStart, rangeEnd)) {
                events.push({
                    id: `${task.id}:${window.endAt.toISOString()}`,
                    startAt: window.startAt,
                    endAt: window.endAt,
                    task,
                    bucketLabel: BUCKET_LABEL[task.bucket],
                });
            }
            return;
        }

        if (task.bucket === "primary_daily") {
            for (let cursor = addUtcDays(startOfUtcDay(rangeStart), -1); cursor < rangeEnd; cursor = addUtcDays(cursor, 1)) {
                const endAt = addUtcDays(cursor, 1);
                if (overlapsRange(cursor, endAt, rangeStart, rangeEnd)) {
                    events.push({ id: `${task.id}:${cursor.toISOString()}`, startAt: new Date(cursor), endAt, task, bucketLabel: BUCKET_LABEL[task.bucket] });
                }
            }
            return;
        }

        if (task.bucket === "eight_hour") {
            const cursor = new Date(eightHourResetStart(rangeStart));
            while (cursor.getTime() + WINDOW_MS.eight_hour <= rangeStart.getTime()) cursor.setUTCHours(cursor.getUTCHours() + 8);
            for (; cursor < rangeEnd; cursor.setUTCHours(cursor.getUTCHours() + 8)) {
                const startAt = new Date(cursor);
                const endAt = new Date(cursor.getTime() + WINDOW_MS.eight_hour);
                if (overlapsRange(startAt, endAt, rangeStart, rangeEnd)) {
                    events.push({ id: `${task.id}:${startAt.toISOString()}`, startAt, endAt, task, bucketLabel: BUCKET_LABEL[task.bucket] });
                }
            }
            return;
        }

        if (task.bucket === "secondary_daily" || (task.bucket === "conclave" && task.conclaveSub === "conclave_daily")) {
            const cursor = new Date(secondaryDailyResetStart(rangeStart));
            while (cursor.getTime() + WINDOW_MS.secondary_daily <= rangeStart.getTime()) cursor.setUTCDate(cursor.getUTCDate() + 1);
            for (; cursor < rangeEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
                const startAt = new Date(cursor);
                const endAt = new Date(cursor.getTime() + WINDOW_MS.secondary_daily);
                if (overlapsRange(startAt, endAt, rangeStart, rangeEnd)) {
                    events.push({ id: `${task.id}:${startAt.toISOString()}`, startAt, endAt, task, bucketLabel: BUCKET_LABEL[task.bucket] });
                }
            }
            return;
        }

        if (task.bucket === "weekly_monday") {
            const cursor = new Date(startOfUtcDay(rangeStart));
            cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
            if (cursor.getTime() >= rangeStart.getTime()) cursor.setUTCDate(cursor.getUTCDate() - 7);
            for (; cursor < rangeEnd; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
                const startAt = new Date(cursor);
                const endAt = new Date(cursor.getTime() + WINDOW_MS.weekly_monday);
                if (overlapsRange(startAt, endAt, rangeStart, rangeEnd)) {
                    events.push({ id: `${task.id}:${startAt.toISOString()}`, startAt, endAt, task, bucketLabel: BUCKET_LABEL[task.bucket] });
                }
            }
            return;
        }

        if (task.bucket === "four_day") {
            const cursor = new Date(fourDayResetStart(rangeStart));
            while (cursor.getTime() + WINDOW_MS.four_day <= rangeStart.getTime()) cursor.setUTCDate(cursor.getUTCDate() + 4);
            for (; cursor < rangeEnd; cursor.setUTCDate(cursor.getUTCDate() + 4)) {
                const startAt = new Date(cursor);
                const endAt = new Date(cursor.getTime() + WINDOW_MS.four_day);
                if (overlapsRange(startAt, endAt, rangeStart, rangeEnd)) {
                    events.push({ id: `${task.id}:${startAt.toISOString()}`, startAt, endAt, task, bucketLabel: BUCKET_LABEL[task.bucket] });
                }
            }
            return;
        }

        if (task.bucket === "conclave" && task.conclaveSub === "conclave_weekly") {
            const cursor = new Date(conclaveWeeklyResetStart(rangeStart));
            if (cursor.getTime() >= rangeStart.getTime()) cursor.setUTCDate(cursor.getUTCDate() - 7);
            for (; cursor < rangeEnd; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
                const startAt = new Date(cursor);
                const endAt = new Date(cursor.getTime() + WINDOW_MS.weekly_monday);
                if (overlapsRange(startAt, endAt, rangeStart, rangeEnd)) {
                    events.push({ id: `${task.id}:${startAt.toISOString()}`, startAt, endAt, task, bucketLabel: BUCKET_LABEL[task.bucket] });
                }
            }
        }
    });

    return events.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.task.label.localeCompare(b.task.label));
}

function calendarRange(anchor: Date, scale: CalendarScale): { start: Date; end: Date; label: string } {
    if (scale === "day") {
        const start = startOfUtcDay(anchor);
        const end = addUtcDays(start, 1);
        const label = start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
        return { start, end, label };
    }

    if (scale === "week") {
        const start = startOfUtcDay(anchor);
        start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
        const end = addUtcDays(start, 7);
        const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} - ${addUtcDays(end, -1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
        return { start, end, label };
    }

    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
    const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    return { start, end, label };
}

const CALENDAR_ACCENT: Record<Bucket, { bar: string; fill: string; muted: string }> = {
    primary_daily: { bar: "bg-emerald-400", fill: "bg-emerald-400/18 border-emerald-400/25", muted: "text-emerald-200" },
    eight_hour: { bar: "bg-amber-400", fill: "bg-amber-400/18 border-amber-400/25", muted: "text-amber-100" },
    secondary_daily: { bar: "bg-sky-400", fill: "bg-sky-400/18 border-sky-400/25", muted: "text-sky-100" },
    weekly_monday: { bar: "bg-fuchsia-400", fill: "bg-fuchsia-400/15 border-fuchsia-400/25", muted: "text-fuchsia-100" },
    four_day: { bar: "bg-orange-400", fill: "bg-orange-400/18 border-orange-400/25", muted: "text-orange-100" },
    rotation: { bar: "bg-rose-400", fill: "bg-rose-400/18 border-rose-400/25", muted: "text-rose-100" },
    conclave: { bar: "bg-violet-400", fill: "bg-violet-400/18 border-violet-400/25", muted: "text-violet-100" },
};

function clipEventToRange(event: CalendarTaskEvent, startAt: Date, endAt: Date): CalendarTaskEvent | null {
    const clippedStart = new Date(Math.max(event.startAt.getTime(), startAt.getTime()));
    const clippedEnd = new Date(Math.min(event.endAt.getTime(), endAt.getTime()));
    if (clippedEnd.getTime() <= clippedStart.getTime()) return null;
    return { ...event, startAt: clippedStart, endAt: clippedEnd };
}

function visibleEventForRange(event: CalendarTaskEvent, startAt: Date, endAt: Date): VisibleCalendarTaskEvent | null {
    const clipped = clipEventToRange(event, startAt, endAt);
    if (!clipped) return null;
    return {
        ...clipped,
        continuesBefore: event.startAt.getTime() < startAt.getTime(),
        continuesAfter: event.endAt.getTime() > endAt.getTime(),
    };
}

function formatTimelineTime(date: Date, timeMode: TimeMode): string {
    if (timeMode === "utc") {
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
    }
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: getDisplayTimezone() });
}

function formatTimelineDate(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function TimelineSpan({
    event,
    selected,
    onToggle,
    onOpenDetails,
    scrollLeft,
    viewportWidth,
    top,
    height,
    left,
    leftPx,
    width,
    widthPx,
    compact = false,
    muted = false,
}: {
    event: VisibleCalendarTaskEvent;
    selected: boolean;
    onToggle: (task: TaskDef) => void;
    onOpenDetails: (id: string) => void;
    scrollLeft: number;
    viewportWidth: number;
    top: number | string;
    height: number | string;
    left: string;
    leftPx: number;
    width: string;
    widthPx: number;
    compact?: boolean;
    muted?: boolean;
}) {
    const accent = CALENDAR_ACCENT[event.task.bucket];
    const buttonWidth = compact ? 28 : 34;
    const buttonHeight = compact ? 24 : 30;
    const edgePad = 8;
    const canOpenDetails = event.endAt.getTime() >= Date.now();
    const buttonLeft = Math.max(
        edgePad,
        Math.min(scrollLeft + viewportWidth - leftPx - buttonWidth - edgePad, Math.max(widthPx - buttonWidth - edgePad, edgePad))
    );
    const labelInset = Math.max(
        8,
        Math.min(
            Math.max(scrollLeft - leftPx + 8, 8),
            Math.max((canOpenDetails ? buttonLeft : widthPx) - 12, 8)
        )
    );
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onToggle(event.task)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(event.task);
                }
            }}
            className={[
                "absolute overflow-hidden border text-left shadow-[0_16px_40px_rgba(2,6,23,0.32)] transition-all",
                accent.fill,
                compact ? "px-2 py-1.5" : "px-2.5 py-2",
                muted ? "opacity-35 saturate-50" : "",
                "cursor-pointer",
                selected ? "z-20 ring-1 ring-slate-50/30 brightness-110" : "hover:z-10 hover:brightness-110",
                event.continuesBefore ? "rounded-l-none" : "rounded-l-2xl",
                event.continuesAfter ? "rounded-r-none" : "rounded-r-2xl",
            ].join(" ")}
            style={{ top, height, left, width }}
        >
            {canOpenDetails && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetails(event.id);
                    }}
                    className="absolute top-1.5 flex shrink-0 items-center justify-center rounded-[14px] border border-slate-700/80 bg-slate-950/52 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition-all hover:border-slate-500 hover:bg-slate-900/78 hover:text-white"
                    style={{ left: buttonLeft, width: buttonWidth, height: buttonHeight }}
                    title="View details"
                    aria-label={`View details for ${event.task.label}`}
                >
                    <span className="pointer-events-none absolute inset-y-[5px] left-0 w-px bg-white/8" />
                    <span className="text-[15px] font-semibold leading-none">i</span>
                </button>
            )}
            <div
                className="absolute top-2"
                style={{
                    left: labelInset,
                    maxWidth: `${Math.max((canOpenDetails ? buttonLeft : widthPx) - labelInset - 8, 24)}px`,
                }}
            >
                <div className={`h-1 ${compact ? "w-8" : "w-10"} rounded-full ${accent.bar}`} />
                <div className={`mt-2 text-[11px] font-medium leading-tight ${compact ? "truncate whitespace-nowrap" : "truncate"} ${accent.muted}`}>
                    {event.task.label}
                </div>
                {!compact && (
                    <div className="mt-1 truncate text-[10px] text-slate-300/80">
                        {formatTimelineTime(event.startAt, "utc")} - {formatTimelineTime(event.endAt, "utc")} UTC
                    </div>
                )}
            </div>
        </div>
    );
}

function getCalendarTaskRows(
    events: CalendarTaskEvent[],
    rangeStart: Date,
    rangeEnd: Date,
    now: Date,
    taskStateById: Record<string, TaskRenderState>,
    worldState: WorldStateData | null,
): TaskDef[] {
    const clipped = events
        .map((event) => clipEventToRange(event, rangeStart, rangeEnd))
        .filter((event): event is CalendarTaskEvent => !!event);
    return Array.from(new Map(clipped.map((event) => [event.task.id, event.task])).values()).sort((a, b) => {
        const aState = taskStateById[a.id] ?? "pending";
        const bState = taskStateById[b.id] ?? "pending";
        if (aState === "pending" && bState !== "pending") return -1;
        if (aState !== "pending" && bState === "pending") return 1;

        const taskNextReset = (task: TaskDef): number => {
            if (task.usesDynamicInstance) {
                return dynamicTaskNextReset(task.id, worldState, now)?.getTime() ?? Number.POSITIVE_INFINITY;
            }
            if (task.bucket === "rotation") {
                return Number.POSITIVE_INFINITY;
            }
            if (task.bucket === "conclave") {
                if (task.conclaveSub === "conclave_daily") {
                    return getNextResets(now).conclave_daily.getTime();
                }
                return getNextResets(now).conclave_weekly.getTime();
            }
            return getNextResets(now)[task.bucket].getTime();
        };

        const aNextEnd = taskNextReset(a);
        const bNextEnd = taskNextReset(b);

        if (aNextEnd !== bNextEnd) return aNextEnd - bNextEnd;
        if (WINDOW_MS[a.bucket] !== WINDOW_MS[b.bucket]) return WINDOW_MS[a.bucket] - WINDOW_MS[b.bucket];
        return a.label.localeCompare(b.label);
    });
}

function ScheduleCanvas({
    rangeStart,
    rangeEnd,
    scale,
    events,
    timeMode,
    selectedEventId,
    onToggleTask,
    onOpenDetails,
    now,
    taskStateById,
    worldState,
}: {
    rangeStart: Date;
    rangeEnd: Date;
    scale: CalendarScale;
    events: CalendarTaskEvent[];
    timeMode: TimeMode;
    selectedEventId: string | null;
    onToggleTask: (task: TaskDef) => void;
    onOpenDetails: (id: string) => void;
    now: Date;
    taskStateById: Record<string, TaskRenderState>;
    worldState: WorldStateData | null;
}) {
    const [scrollLeft, setScrollLeft] = useState(0);
    const [viewportWidth, setViewportWidth] = useState(0);
    const clippedEvents = events
        .map((event) => visibleEventForRange(event, rangeStart, rangeEnd))
        .filter((event): event is VisibleCalendarTaskEvent => !!event);
    const rows = getCalendarTaskRows(clippedEvents, rangeStart, rangeEnd, now, taskStateById, worldState);
    const rowIndex = new Map(rows.map((task, index) => [task.id, index]));
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    const rowHeight = scale === "month" ? 52 : 58;
    const plotHeight = Math.max(rows.length * rowHeight, 320);
    const nowLeft = now.getTime() >= rangeStart.getTime() && now.getTime() <= rangeEnd.getTime()
        ? ((now.getTime() - rangeStart.getTime()) / rangeMs) * 100
        : null;

    const header = (() => {
        if (scale === "day") {
            return Array.from({ length: 24 }, (_, hour) => new Date(rangeStart.getTime() + hour * 60 * 60 * 1000));
        }
        if (scale === "week") {
            return Array.from({ length: 7 }, (_, day) => addUtcDays(rangeStart, day));
        }
        const dayCount = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000);
        return Array.from({ length: dayCount }, (_, day) => addUtcDays(rangeStart, day));
    })();

    const headerTemplate = scale === "day"
        ? "repeat(24, minmax(56px, 1fr))"
        : scale === "week"
            ? "repeat(7, minmax(120px, 1fr))"
            : `repeat(${header.length}, minmax(28px, 1fr))`;
    const canvasWidthPx = scale === "day"
        ? header.length * 56
        : scale === "week"
            ? header.length * 120
            : header.length * 28;
    const canvasMinWidth = `${canvasWidthPx}px`;

    const minorLines = scale === "week"
        ? Array.from({ length: 28 }, (_, i) => i / 28)
        : scale === "day"
            ? Array.from({ length: 24 }, (_, i) => i / 24)
            : Array.from({ length: header.length }, (_, i) => i / header.length);

    useEffect(() => {
        const syncViewport = () => {
            const el = document.getElementById("wf-reset-calendar-scroll");
            if (el) setViewportWidth(el.clientWidth);
        };
        syncViewport();
        window.addEventListener("resize", syncViewport);
        return () => window.removeEventListener("resize", syncViewport);
    }, []);

    return (
        <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]">
            <div className="grid grid-cols-[220px_minmax(0,1fr)]">
                <div className="border-r border-slate-800/80 bg-slate-950/45">
                    <div className="flex h-[78px] items-end border-b border-slate-800/80 px-5 pb-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Tracked Tasks</div>
                    </div>
                    {rows.map((task) => (
                        <div
                            key={task.id}
                            onClick={() => {
                                const firstEvent = clippedEvents.find((event) => event.task.id === task.id);
                                if (firstEvent) onOpenDetails(firstEvent.id);
                            }}
                            className={[
                                "flex h-[58px] w-full cursor-pointer items-center gap-3 border-b border-slate-900/80 px-5 text-left last:border-b-0 hover:bg-slate-900/50",
                                taskStateById[task.id] === "pending" ? "" : "opacity-45",
                            ].join(" ")}
                            style={{ height: rowHeight }}
                        >
                            <button
                                className={[
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                                    taskStateById[task.id] === "pending"
                                        ? "border-slate-600 bg-slate-950 hover:border-slate-400"
                                        : taskStateById[task.id] === "auto_blocked"
                                            ? "border-amber-800/60 bg-amber-950/20 text-amber-300"
                                            : "border-emerald-800 bg-emerald-950/30 text-emerald-300",
                                ].join(" ")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleTask(task);
                                }}
                                disabled={task.id === NETRACELLS_TASK_ID}
                                title={task.id === NETRACELLS_TASK_ID ? "Adjust from the tracker counter" : taskStateById[task.id] === "pending" ? "Mark complete" : "Mark incomplete"}
                            >
                                {taskStateById[task.id] === "completed" && <CheckIcon />}
                                {taskStateById[task.id] === "auto_blocked" && <span className="text-xs">/</span>}
                            </button>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-slate-100">{task.label}</div>
                                <div className="mt-1 text-[11px] text-slate-500">{BUCKET_LABEL[task.bucket]}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div
                    id="wf-reset-calendar-scroll"
                    className="overflow-x-auto"
                    onScroll={(e) => {
                        setScrollLeft(e.currentTarget.scrollLeft);
                        setViewportWidth(e.currentTarget.clientWidth);
                    }}
                >
                    <div style={{ minWidth: canvasMinWidth }}>
                        <div className="grid border-b border-slate-800/80 bg-slate-950/80" style={{ gridTemplateColumns: headerTemplate, height: 78 }}>
                        {header.map((tick) => (
                            <div key={tick.toISOString()} className="border-l border-slate-800/80 px-2 py-4 text-center first:border-l-0">
                                {scale === "day" ? (
                                    <div className="pt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                        {formatTimelineTime(tick, timeMode)}
                                    </div>
                                ) : scale === "week" ? (
                                    <div className="pt-1">
                                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                            {tick.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-slate-100">{formatTimelineDate(tick)}</div>
                                    </div>
                                ) : (
                                    <div className="pt-1 text-[10px] text-slate-500">{tick.getUTCDate()}</div>
                                )}
                            </div>
                        ))}
                        </div>
                        <div className="relative" style={{ height: plotHeight }}>
                        {minorLines.map((ratio, index) => (
                            <div
                                key={index}
                                className={`absolute bottom-0 top-0 ${scale === "week" && index % 4 === 0 ? "border-l border-slate-700/80" : "border-l border-slate-800/50"}`}
                                style={{ left: `${ratio * 100}%` }}
                            />
                        ))}
                        {rows.map((task, index) => (
                            <div
                                key={task.id}
                                className="absolute inset-x-0 border-t border-slate-900/80"
                                style={{ top: index * rowHeight }}
                            />
                        ))}
                        {nowLeft !== null && (
                            <div className="absolute bottom-0 top-0 z-20" style={{ left: `${nowLeft}%` }}>
                                <div className="absolute bottom-0 top-0 w-px bg-amber-300/90" />
                                <div className="absolute -left-[5px] top-3 h-3 w-3 rounded-full border-2 border-amber-300 bg-slate-950" />
                            </div>
                        )}
                        {clippedEvents.map((event) => {
                            const top = (rowIndex.get(event.task.id) ?? 0) * rowHeight + 8;
                            const leftPct = ((event.startAt.getTime() - rangeStart.getTime()) / rangeMs) * 100;
                            const widthPct = ((event.endAt.getTime() - event.startAt.getTime()) / rangeMs) * 100;
                            const leftPx = (leftPct / 100) * canvasWidthPx;
                            const widthPx = Math.max((widthPct / 100) * canvasWidthPx, scale === "month" ? 1.6 / 100 * canvasWidthPx : 2.4 / 100 * canvasWidthPx);
                            return (
                                <TimelineSpan
                                    key={event.id}
                                    event={event}
                                    selected={selectedEventId === event.id}
                                    onToggle={onToggleTask}
                                    onOpenDetails={onOpenDetails}
                                    scrollLeft={scrollLeft}
                                    viewportWidth={viewportWidth}
                                    top={top}
                                    height={rowHeight - 16}
                                    left={`${leftPct}%`}
                                    leftPx={leftPx}
                                    width={`${Math.max(widthPct, scale === "month" ? 1.6 : 2.4)}%`}
                                    widthPx={widthPx}
                                    compact={scale !== "day"}
                                    muted={taskStateById[event.task.id] !== "pending"}
                                />
                            );
                        })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DayPlannerBoard(props: {
    start: Date;
    end: Date;
    events: CalendarTaskEvent[];
    timeMode: TimeMode;
    selectedEventId: string | null;
    onToggleTask: (task: TaskDef) => void;
    onOpenDetails: (id: string) => void;
    now: Date;
    taskStateById: Record<string, TaskRenderState>;
    worldState: WorldStateData | null;
}) {
    return <ScheduleCanvas rangeStart={props.start} rangeEnd={props.end} scale="day" events={props.events} timeMode={props.timeMode} selectedEventId={props.selectedEventId} onToggleTask={props.onToggleTask} onOpenDetails={props.onOpenDetails} now={props.now} taskStateById={props.taskStateById} worldState={props.worldState} />;
}

function WeekPlannerBoard(props: {
    rangeStart: Date;
    events: CalendarTaskEvent[];
    timeMode: TimeMode;
    selectedEventId: string | null;
    onToggleTask: (task: TaskDef) => void;
    onOpenDetails: (id: string) => void;
    now: Date;
    taskStateById: Record<string, TaskRenderState>;
    worldState: WorldStateData | null;
}) {
    return <ScheduleCanvas rangeStart={props.rangeStart} rangeEnd={addUtcDays(props.rangeStart, 7)} scale="week" events={props.events} timeMode={props.timeMode} selectedEventId={props.selectedEventId} onToggleTask={props.onToggleTask} onOpenDetails={props.onOpenDetails} now={props.now} taskStateById={props.taskStateById} worldState={props.worldState} />;
}

function MonthGanttBoard(props: {
    anchor: Date;
    events: CalendarTaskEvent[];
    timeMode: TimeMode;
    selectedEventId: string | null;
    onToggleTask: (task: TaskDef) => void;
    onOpenDetails: (id: string) => void;
    now: Date;
    taskStateById: Record<string, TaskRenderState>;
    worldState: WorldStateData | null;
}) {
    const start = new Date(Date.UTC(props.anchor.getUTCFullYear(), props.anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(props.anchor.getUTCFullYear(), props.anchor.getUTCMonth() + 1, 1));
    return <ScheduleCanvas rangeStart={start} rangeEnd={end} scale="month" events={props.events} timeMode={props.timeMode} selectedEventId={props.selectedEventId} onToggleTask={props.onToggleTask} onOpenDetails={props.onOpenDetails} now={props.now} taskStateById={props.taskStateById} worldState={props.worldState} />;
}

function CalendarAgenda({
    events,
    scale,
    anchor,
    timeMode,
    selectedEventId,
    onToggleTask,
    onOpenDetails,
    now,
    taskStateById,
    worldState,
}: {
    events: CalendarTaskEvent[];
    scale: CalendarScale;
    anchor: Date;
    timeMode: TimeMode;
    selectedEventId: string | null;
    onToggleTask: (task: TaskDef) => void;
    onOpenDetails: (id: string) => void;
    now: Date;
    taskStateById: Record<string, TaskRenderState>;
    worldState: WorldStateData | null;
}) {
    if (scale === "day") {
        return (
            events.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-500">
                    No reset windows in this day.
                </div>
            ) : (
                <DayPlannerBoard
                    start={calendarRange(anchor, "day").start}
                    end={calendarRange(anchor, "day").end}
                    events={events}
                    timeMode={timeMode}
                    selectedEventId={selectedEventId}
                    onToggleTask={onToggleTask}
                    onOpenDetails={onOpenDetails}
                    now={now}
                    taskStateById={taskStateById}
                    worldState={worldState}
                />
            )
        );
    }

    if (scale === "week") {
        return (
            <WeekPlannerBoard
                rangeStart={calendarRange(anchor, "week").start}
                events={events}
                timeMode={timeMode}
                selectedEventId={selectedEventId}
                onToggleTask={onToggleTask}
                onOpenDetails={onOpenDetails}
                now={now}
                taskStateById={taskStateById}
                worldState={worldState}
            />
        );
    }

    return (
        <MonthGanttBoard
            anchor={anchor}
            events={events}
            timeMode={timeMode}
            selectedEventId={selectedEventId}
            onToggleTask={onToggleTask}
            onOpenDetails={onOpenDetails}
            now={now}
            taskStateById={taskStateById}
            worldState={worldState}
        />
    );
}

function CalendarDetailModal({
    event,
    open,
    onClose,
    timeMode,
    worldState,
    now,
    inlineHints,
    expandableHints,
    taskState,
    onToggleTask,
}: {
    event: CalendarTaskEvent | null;
    open: boolean;
    onClose: () => void;
    timeMode: TimeMode;
    worldState: WorldStateData | null;
    now: Date;
    inlineHints: Record<string, React.ReactNode>;
    expandableHints: Record<string, React.ReactNode>;
    taskState: TaskRenderState | null;
    onToggleTask: (task: TaskDef) => void;
}) {
    if (!open || !event) return null;

    const deadlineLine = getTaskDeadlineLine(event.task, worldState, timeMode, now);
    const liveLabel = event.endAt.getTime() <= now.getTime()
        ? "Ended"
        : event.startAt.getTime() > now.getTime()
            ? `Starts in ${fmtMs(event.startAt.getTime() - now.getTime())}`
            : `Ends in ${fmtMs(event.endAt.getTime() - now.getTime())}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-950/78 backdrop-blur-sm" />
            <div
                className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[32px] border border-slate-700/80 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] shadow-[0_40px_120px_rgba(2,6,23,0.7)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-6 py-5">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{event.bucketLabel}</div>
                        <div className="mt-2 text-3xl font-semibold text-slate-100">{event.task.label}</div>
                        <div className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{event.task.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onToggleTask(event.task)}
                            disabled={event.task.id === NETRACELLS_TASK_ID}
                            className={[
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                taskState === "pending"
                                    ? "border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/20"
                                    : taskState === "auto_blocked"
                                        ? "border-amber-700/60 text-amber-300"
                                        : "border-slate-700 text-slate-300 hover:bg-slate-900/70",
                                event.task.id === NETRACELLS_TASK_ID ? "opacity-40 cursor-not-allowed" : "",
                            ].join(" ")}
                        >
                            {taskState === "pending" ? "Mark Complete" : taskState === "completed" ? "Mark Incomplete" : "Unavailable"}
                        </button>
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
                            aria-label="Close details"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                    <div className="space-y-4">
                        {inlineHints[event.task.id] && (
                            <div className="rounded-[24px] border border-slate-800 bg-slate-950/35 p-4">
                                {inlineHints[event.task.id]}
                            </div>
                        )}
                        {expandableHints[event.task.id] && (
                            <div className="rounded-[24px] border border-slate-800 bg-slate-950/35 p-4">
                                {expandableHints[event.task.id]}
                            </div>
                        )}
                    </div>
                    <div className="rounded-[24px] border border-slate-800 bg-slate-950/35 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Availability</div>
                        <div className="mt-4 font-mono text-base text-amber-300">{fmtAbs(event.startAt, timeMode)}</div>
                        <div className="font-mono text-base text-slate-300">{fmtAbs(event.endAt, timeMode)}</div>
                        <div className="mt-4 text-sm text-slate-400">{liveLabel}</div>
                        <div className="mt-1 text-sm text-slate-500">{deadlineLine ?? "Scheduled reset window"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function WarframeResetTracker() {
    const completedPrereqs = useTrackerStore((s) => s.state.prereqs.completed) ?? {};
    const syndicates = useTrackerStore((s) => s.state.syndicates) ?? [];
    const setNightwaveChallengesDone = useTrackerStore((s) => s.setNightwaveChallengesDone);

    const [rc, setRc] = useState<RCState>(() => loadState());
    const [now, setNow] = useState(() => new Date());
    const [showHelp, setHelp] = useState(false);
    const [showCustomize, setCustomize] = useState(false);
    const [selected, setSel] = useState<Bucket>("primary_daily");
    const [layoutMode, setLayoutMode] = useState<TrackerLayoutMode>("tracker");
    const [calendarScale, setCalendarScale] = useState<CalendarScale>("week");
    const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
    const [selectedCalendarEventId, setSelectedCalendarEventId] = useState<string | null>(null);
    const wsData = useWorldStateData();

    useEffect(() => {
        saveState(rc);
    }, [rc]);

    // Re-read state if an external write (e.g. profile import) updates localStorage
    useEffect(() => {
        const handler = () => setRc(() => syncResets(loadState(), new Date()));
        window.addEventListener("wfpt:resetChecklist:external-update", handler);
        return () => window.removeEventListener("wfpt:resetChecklist:external-update", handler);
    }, []);

    const lastResetKeysRef = useRef("");
    useEffect(() => {
        const tick = () => {
            const n = new Date();
            setNow(n);
            setRc((p) => syncResets(p, n));

            // Re-fetch world state whenever a tracked reset boundary is crossed
            const keys = getCurrentKeys(n);
            const keysStr = `${keys.primary_daily}|${keys.eight_hour}|${keys.secondary_daily}|${keys.weekly_monday}`;
            if (lastResetKeysRef.current && lastResetKeysRef.current !== keysStr) {
                void fetchWorldState(true).catch(() => {});
            }
            lastResetKeysRef.current = keysStr;
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const nextResets = useMemo(() => getNextResets(now), [now]);
    const baro = useMemo(() => getBaroStatus(now, wsData), [now, wsData]);

    const completedIds = useMemo((): Record<Exclude<Bucket, "conclave">, string[]> & { conclave_daily: string[]; conclave_weekly: string[] } => {
        const keys = getCurrentKeys(now);
        const get = (rk: keyof RCState, ck: keyof RCState, key: string) => rc[rk] === key ? (rc[ck] as string[]) : [];
        return {
            primary_daily: get("primaryDailyResetKey", "completedPrimaryDailyTaskIds", keys.primary_daily),
            eight_hour: get("eightHourResetKey", "completedEightHourTaskIds", keys.eight_hour),
            secondary_daily: get("secondaryDailyResetKey", "completedSecondaryDailyTaskIds", keys.secondary_daily),
            weekly_monday: get("weeklyMondayResetKey", "completedWeeklyMondayTaskIds", keys.weekly_monday),
            four_day: get("fourDayResetKey", "completedFourDayTaskIds", keys.four_day),
            rotation: [],
            conclave_daily: get("conclaveDailyResetKey", "completedConclaveDailyTaskIds", keys.conclave_daily),
            conclave_weekly: get("conclaveWeeklyResetKey", "completedConclaveWeeklyTaskIds", keys.conclave_weekly),
        };
    }, [rc, now]);

    const { inline: wsInlineHints, expandable: wsExpandableHints } = useMemo(
        () => buildWorldStateHints(wsData),
        [wsData]
    );

    const eligibleTasks = useMemo(
        () => getEligibleTasks(completedPrereqs, syndicates, wsData),
        [completedPrereqs, syndicates, wsData]
    );

    const visibleTasks = useMemo(
        () => eligibleTasks.filter((t) => !rc.hiddenTaskIds.includes(t.id)),
        [eligibleTasks, rc.hiddenTaskIds]
    );

    const anyPledged = useMemo(
        () => syndicates.some((s) => s.pledged && RELAY_FACTION_IDS.has(s.id as SyndicateId)),
        [syndicates]
    );

    const byBucket = useCallback((b: Exclude<Bucket, "conclave">) => visibleTasks.filter((t) => t.bucket === b), [visibleTasks]);
    const conclaveDaily = useMemo(() => visibleTasks.filter((t) => t.bucket === "conclave" && t.conclaveSub === "conclave_daily"), [visibleTasks]);
    const conclaveWeekly = useMemo(() => visibleTasks.filter((t) => t.bucket === "conclave" && t.conclaveSub === "conclave_weekly"), [visibleTasks]);
    const rotationTasks = useMemo(() => visibleTasks.filter((t) => t.bucket === "rotation"), [visibleTasks]);
    const rotationNextReset = useMemo(() => getRotationNextReset(wsData, rotationTasks, now), [wsData, rotationTasks, now]);
    const rotationCompletedIds = useMemo(
        () => rotationTasks
            .filter((task) => {
                const instanceKey = dynamicTaskInstanceKey(task.id, wsData);
                return !!instanceKey && rc.completedRotationTaskInstanceKeys[task.id] === instanceKey;
            })
            .map((task) => task.id),
        [rotationTasks, wsData, rc.completedRotationTaskInstanceKeys]
    );
    const calendarTaskStateById = useMemo(
        () => Object.fromEntries(
            visibleTasks.map((task) => [
                task.id,
                getCalendarTaskState(task, completedIds, rotationCompletedIds, rc.netracellRuns),
            ])
        ) as Record<string, TaskRenderState>,
        [visibleTasks, completedIds, rotationCompletedIds, rc.netracellRuns]
    );

    const msFor = useCallback((b: Bucket): number => {
        if (b === "conclave") {
            const dms = Math.max(0, nextResets.conclave_daily.getTime() - now.getTime());
            const wms = Math.max(0, nextResets.conclave_weekly.getTime() - now.getTime());
            return Math.min(dms, wms);
        }
        if (b === "rotation") {
            return Math.max(0, rotationNextReset.getTime() - now.getTime());
        }
        return Math.max(0, nextResets[b].getTime() - now.getTime());
    }, [nextResets, rotationNextReset, now]);

    const tierFor = useCallback((b: Bucket) => urgTier(msFor(b), b), [msFor]);

    const conclaveTotalTasks = conclaveDaily.length + conclaveWeekly.length;
    const conclaveTotalDone = getCompletedTaskCount(conclaveDaily, completedIds.conclave_daily, 0)
        + getCompletedTaskCount(conclaveWeekly, completedIds.conclave_weekly, 0);

    const eligibleByBucket = useMemo(() => ({
        primary_daily: eligibleTasks.filter((t) => t.bucket === "primary_daily"),
        eight_hour: eligibleTasks.filter((t) => t.bucket === "eight_hour"),
        secondary_daily: eligibleTasks.filter((t) => t.bucket === "secondary_daily"),
        weekly_monday: eligibleTasks.filter((t) => t.bucket === "weekly_monday"),
        four_day: eligibleTasks.filter((t) => t.bucket === "four_day"),
        rotation: eligibleTasks.filter((t) => t.bucket === "rotation"),
        conclave: eligibleTasks.filter((t) => t.bucket === "conclave"),
    }), [eligibleTasks]);

    const isBucketFullyHidden = useCallback((b: Bucket): boolean => {
        const eligible = eligibleByBucket[b];
        if (eligible.length === 0) return false;
        return eligible.every((t) => rc.hiddenTaskIds.includes(t.id));
    }, [eligibleByBucket, rc.hiddenTaskIds]);

    const visibleBuckets = useMemo(
        () => BUCKET_ORDER.filter((b) => !isBucketFullyHidden(b)),
        [isBucketFullyHidden]
    );
    const calendarWindow = useMemo(
        () => calendarRange(calendarAnchor, calendarScale),
        [calendarAnchor, calendarScale]
    );
    const calendarEvents = useMemo(
        () => buildCalendarTaskEvents(visibleTasks, calendarWindow.start, calendarWindow.end, wsData, now),
        [visibleTasks, calendarWindow, wsData, now]
    );
    const selectedCalendarEvent = useMemo(
        () => selectedCalendarEventId ? (calendarEvents.find((event) => event.id === selectedCalendarEventId) ?? null) : null,
        [calendarEvents, selectedCalendarEventId]
    );

    useEffect(() => {
        if (!visibleBuckets.includes(selected)) {
            setSel(visibleBuckets[0] ?? "primary_daily");
        }
    }, [visibleBuckets, selected]);

    useEffect(() => {
        if (selectedCalendarEventId && !calendarEvents.some((event) => event.id === selectedCalendarEventId)) {
            setSelectedCalendarEventId(null);
        }
    }, [calendarEvents, selectedCalendarEventId]);

    const toggleStandard = useCallback((id: string, ck: keyof RCState) => {
        setRc((prev) => {
            const list = [...(prev[ck] as string[])];
            const idx = list.indexOf(id);
            if (idx >= 0) list.splice(idx, 1);
            else list.push(id);
            return { ...prev, [ck]: list };
        });
    }, []);

    const toggle = useCallback((id: string, bucket: Bucket) => {
        // When a nightwave reset task is toggled, sync the individual challenges in the Nightwave tracker
        if (id === "nightwave_daily" || id === "nightwave_weekly" || id === "nightwave_elite") {
            const activeChallenges = wsData?.nightwave?.activeChallenges ?? [];
            const challengeIds =
                id === "nightwave_daily"  ? activeChallenges.filter((a) => a.isDaily).map((a) => a.id) :
                id === "nightwave_weekly" ? activeChallenges.filter((a) => !a.isDaily && !a.isElite).map((a) => a.id) :
                                           activeChallenges.filter((a) => a.isElite).map((a) => a.id);
            const bucket2Key = bucket === "primary_daily" ? "completedPrimaryDailyTaskIds" as const : "completedWeeklyMondayTaskIds" as const;
            // Determine direction: if task is not yet done, we're marking it done
            const markingDone = !completedIds[bucket === "primary_daily" ? "primary_daily" : "weekly_monday"].includes(id);
            if (challengeIds.length > 0) setNightwaveChallengesDone(challengeIds, markingDone);
            toggleStandard(id, bucket2Key);
            return;
        }

        if (bucket === "primary_daily") {
            toggleStandard(id, "completedPrimaryDailyTaskIds");
            return;
        }

        if (bucket === "eight_hour") {
            toggleStandard(id, "completedEightHourTaskIds");
            return;
        }

        if (bucket === "secondary_daily") {
            toggleStandard(id, "completedSecondaryDailyTaskIds");
            return;
        }

        if (bucket === "weekly_monday") {
            if (id === TEMPORAL_ARCHIMEDEA_TASK_ID) {
                setRc((prev) => {
                    const alreadyCompleted = prev.completedWeeklyMondayTaskIds.includes(TEMPORAL_ARCHIMEDEA_TASK_ID);
                    const autoBlocked = isTemporalArchimedeaAutoBlocked(prev.netracellRuns, prev.completedWeeklyMondayTaskIds);

                    if (autoBlocked) return prev;

                    if (alreadyCompleted) {
                        return {
                            ...prev,
                            completedWeeklyMondayTaskIds: prev.completedWeeklyMondayTaskIds.filter((taskId) => taskId !== TEMPORAL_ARCHIMEDEA_TASK_ID),
                            netracellRuns: Math.max(0, prev.netracellRuns - 2),
                        };
                    }

                    return {
                        ...prev,
                        completedWeeklyMondayTaskIds: [...prev.completedWeeklyMondayTaskIds, TEMPORAL_ARCHIMEDEA_TASK_ID],
                        netracellRuns: Math.min(5, prev.netracellRuns + 2),
                    };
                });
                return;
            }

            toggleStandard(id, "completedWeeklyMondayTaskIds");
            return;
        }

        if (bucket === "four_day") {
            toggleStandard(id, "completedFourDayTaskIds");
            return;
        }

        if (bucket === "rotation") {
            const instanceKey = dynamicTaskInstanceKey(id, wsData);
            if (!instanceKey) return;
            setRc((prev) => {
                const next = { ...prev.completedRotationTaskInstanceKeys };
                if (next[id] === instanceKey) delete next[id];
                else next[id] = instanceKey;
                return { ...prev, completedRotationTaskInstanceKeys: next };
            });
        }
    }, [toggleStandard, wsData, completedIds, setNightwaveChallengesDone]);

    const clearBucket = useCallback((ck: keyof RCState) => setRc((p) => ({ ...p, [ck]: [] })), []);
    const clearWeeklyMonday = useCallback(() => {
        setRc((p) => ({
            ...p,
            completedWeeklyMondayTaskIds: [],
            netracellRuns: 0,
        }));
    }, []);

    const setMode = useCallback((m: TimeMode) => setRc((p) => ({ ...p, timeMode: m })), []);
    const toggleHidden = useCallback((id: string) => {
        setRc((prev) => {
            const list = [...prev.hiddenTaskIds];
            const idx = list.indexOf(id);
            if (idx >= 0) list.splice(idx, 1);
            else list.push(id);
            return { ...prev, hiddenTaskIds: list };
        });
    }, []);
    const showAll = useCallback(() => setRc((p) => ({ ...p, hiddenTaskIds: [] })), []);
    const hideAll = useCallback(() => setRc((p) => ({ ...p, hiddenTaskIds: eligibleTasks.map((t) => t.id) })), [eligibleTasks]);
    const moveCalendarAnchor = useCallback((direction: -1 | 1) => {
        setCalendarAnchor((prev) => {
            if (calendarScale === "day") {
                return addUtcDays(prev, direction);
            }
            if (calendarScale === "week") {
                return addUtcDays(prev, direction * 7);
            }
            return new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + direction, Math.min(prev.getUTCDate(), 28)));
        });
    }, [calendarScale]);
    const toggleCalendarTask = useCallback((task: TaskDef) => {
        if (task.id === NETRACELLS_TASK_ID) return;
        if (task.bucket === "conclave") {
            toggleStandard(task.id, task.conclaveSub === "conclave_daily" ? "completedConclaveDailyTaskIds" : "completedConclaveWeeklyTaskIds");
            return;
        }
        toggle(task.id, task.bucket);
    }, [toggle, toggleStandard]);

    return (
        <WorkspacePanel className="flex flex-col gap-4 p-4">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold">Reset Tracker</div>
                    <div className="text-sm text-slate-400 mt-1">
                        {layoutMode === "tracker"
                            ? "Click a timer to view its tasks · completed tasks sink to bottom · auto-clears on rollover"
                            : "A planning view for daily, weekly, monthly, and live rotations with a persistent now-line for what is ending soon."}
                    </div>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-2">
                    <WorkspaceSegmented className="max-w-full text-xs">
                        <WorkspaceSegmentedButton active={layoutMode === "tracker"} onClick={() => setLayoutMode("tracker")} className="px-3 py-1.5 font-medium">Tracker</WorkspaceSegmentedButton>
                        <WorkspaceSegmentedButton active={layoutMode === "calendar"} onClick={() => setLayoutMode("calendar")} className="px-3 py-1.5 font-medium">Calendar</WorkspaceSegmentedButton>
                    </WorkspaceSegmented>
                    <button
                        className={["shrink-0 whitespace-nowrap text-xs font-medium border rounded px-3 py-1.5 transition-colors", showCustomize ? "bg-slate-700 border-slate-600 text-slate-100" : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"].join(" ")}
                        onClick={() => {
                            setCustomize((v) => !v);
                            setHelp(false);
                        }}
                    >
                        Customize
                        {rc.hiddenTaskIds.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300">
                                {rc.hiddenTaskIds.length} hidden
                            </span>
                        )}
                    </button>
                    <button
                        className={["h-9 w-9 shrink-0 rounded-full border text-xs flex items-center justify-center transition-colors", showHelp ? "bg-slate-700 border-slate-600 text-slate-100" : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"].join(" ")}
                        onClick={() => {
                            setHelp((v) => !v);
                            setCustomize(false);
                        }}
                    >
                        ?
                    </button>
                    <WorkspaceSegmented className="max-w-full text-xs">
                        <WorkspaceSegmentedButton active={rc.timeMode === "utc"} onClick={() => setMode("utc")} className="px-3 py-1.5 font-medium">UTC</WorkspaceSegmentedButton>
                        <WorkspaceSegmentedButton active={rc.timeMode === "local"} onClick={() => setMode("local")} className="px-3 py-1.5 font-medium">Local</WorkspaceSegmentedButton>
                    </WorkspaceSegmented>
                </div>
            </div>

            {baro.present && (
                <div className="rounded-xl border border-amber-600/60 bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="relative flex-shrink-0 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                        </span>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-amber-300">
                                {baro.source === "api"
                                    ? `Baro Ki'Teer — ${baro.location || "at a Relay"}`
                                    : "Predicted Baro Ki'Teer visit"}
                            </div>
                            <div className="text-xs text-amber-500/80 mt-0.5">
                                {baro.source === "api" ? "Live World State schedule" : baro.detail}
                            </div>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-xs text-amber-500/70 uppercase tracking-wider font-medium">Leaves in</div>
                        <div className="text-lg font-semibold tabular-nums text-amber-300 leading-tight">
                            {baro.timeLeftMs == null ? "Time unavailable" : fmtMs(baro.timeLeftMs)}
                        </div>
                    </div>
                </div>
            )}

            {!anyPledged && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-2.5 text-xs text-slate-400">
                    <span className="text-slate-300 font-medium">Tip:</span>{" "}
                    All 6 relay faction standing tasks are shown because no pledge is set.
                    Mark your pledged faction(s) on the <span className="text-slate-300">Syndicates</span> page to show only those here.
                </div>
            )}

            {showHelp && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm text-slate-400 leading-relaxed">
                    Each bucket auto-clears when its window rolls over. Countdown colors shift from{" "}
                    <span className="text-emerald-400 font-medium">green</span> →{" "}
                    <span className="text-amber-400 font-medium">amber</span> →{" "}
                    <span className="text-red-400 font-medium">red</span>{" "}
                    as the reset approaches (35% and 10% thresholds). The 8-hour bucket rotates at 00:00, 08:00, and 16:00 UTC.
                    Conclave runs its own daily reset at 16:00 UTC and a weekly reset every Friday. The Rotations bucket follows live world-state expiries for things like Arbitration, Kuva, Baro, and Varzia. Relay faction standing filters to your pledged faction(s).
                    Use <strong className="text-slate-300">Customize</strong> to permanently hide tasks — if you hide
                    every task in a bucket, that timer card is suppressed entirely.
                </div>
            )}

            {showCustomize && (
                <CustomizePanel
                    eligibleTasks={eligibleTasks}
                    hiddenTaskIds={rc.hiddenTaskIds}
                    timeMode={rc.timeMode}
                    onToggle={toggleHidden}
                    onShowAll={showAll}
                    onHideAll={hideAll}
                />
            )}

            {layoutMode === "tracker" ? (
                <>
                    <div className={`grid gap-3 ${visibleBuckets.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : visibleBuckets.length === 3 ? "grid-cols-2 lg:grid-cols-3" : visibleBuckets.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {visibleBuckets.map((b) => {
                            const isConclave = b === "conclave";
                            const isRotation = b === "rotation";
                            const bucketTasks = isConclave ? [] : byBucket(b as Exclude<Bucket, "conclave">);
                            const tasks = isConclave ? conclaveTotalTasks : bucketTasks.length;
                            const done = isConclave
                                ? conclaveTotalDone
                                : getCompletedTaskCount(bucketTasks, (isRotation ? rotationCompletedIds : completedIds[b as Exclude<Bucket, "conclave">]) as string[], rc.netracellRuns);
                            const pct = tasks > 0 ? Math.round((done / tasks) * 100) : 0;
                            const ms = msFor(b);
                            const tier = tierFor(b);
                            const allDone = tasks > 0 && done === tasks;

                            const pendingTasks = isConclave
                                ? [
                                    ...conclaveDaily.filter((t) => getTaskRenderState(t, completedIds.conclave_daily, 0) === "pending"),
                                    ...conclaveWeekly.filter((t) => getTaskRenderState(t, completedIds.conclave_weekly, 0) === "pending"),
                                ]
                                : bucketTasks.filter((t) => getTaskRenderState(t, (isRotation ? rotationCompletedIds : completedIds[b as Exclude<Bucket, "conclave">]) as string[], rc.netracellRuns) === "pending");

                            return (
                                <button
                                    key={b}
                                    onClick={() => setSel(b)}
                                    className={["rounded-xl border-l-[3px] p-3 text-left transition-all", URG_BORDER_L[tier], selected === b ? "border border-slate-600 bg-slate-900" : "border border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60"].join(" ")}
                                >
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                        {BUCKET_LABEL[b]}
                                    </div>
                                    <div className={`text-xl font-semibold mt-1.5 tabular-nums ${URG_COUNTDOWN[tier]}`}>
                                        {fmtMs(ms)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        {isConclave ? `Next daily ${fmtAbs(nextResets.conclave_daily, rc.timeMode)}` : isRotation ? fmtAbs(rotationNextReset, rc.timeMode) : fmtAbs(nextResets[b], rc.timeMode)}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${URG_BAR[tier]}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className={`text-[11px] tabular-nums ${allDone ? "text-emerald-400" : "text-slate-500"}`}>
                                            {done}/{tasks}
                                        </span>
                                    </div>
                                    {allDone ? (
                                        <div className="text-[10px] text-emerald-600 mt-1.5 leading-tight">All done</div>
                                    ) : pendingTasks.length > 0 && (
                                        <div className="text-[10px] text-slate-600 mt-1.5 leading-tight truncate">
                                            {pendingTasks.slice(0, 2).map((t) => t.label).join(" · ")}
                                            {pendingTasks.length > 2 && <span> +{pendingTasks.length - 2}</span>}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {selected === "conclave" ? (
                        <ConclavePanel
                            dailyTasks={conclaveDaily}
                            weeklyTasks={conclaveWeekly}
                            completedDailyIds={completedIds.conclave_daily}
                            completedWeeklyIds={completedIds.conclave_weekly}
                            tier={tierFor("conclave")}
                            nextDailyReset={nextResets.conclave_daily}
                            nextWeeklyReset={nextResets.conclave_weekly}
                            timeMode={rc.timeMode}
                            onToggleDaily={(id) => toggleStandard(id, "completedConclaveDailyTaskIds")}
                            onToggleWeekly={(id) => toggleStandard(id, "completedConclaveWeeklyTaskIds")}
                            onClearDaily={() => clearBucket("completedConclaveDailyTaskIds")}
                            onClearWeekly={() => clearBucket("completedConclaveWeeklyTaskIds")}
                            inlineHints={wsInlineHints}
                            expandableHints={wsExpandableHints}
                        />
                    ) : (
                        <TaskPanel
                            bucket={selected}
                            tasks={byBucket(selected as Exclude<Bucket, "conclave">)}
                            completedIds={(selected === "rotation" ? rotationCompletedIds : completedIds[selected as Exclude<Bucket, "conclave">]) as string[]}
                            tier={tierFor(selected)}
                            onToggle={(id) => toggle(id, selected)}
                            onClear={() => selected === "weekly_monday" ? clearWeeklyMonday() : selected === "rotation" ? setRc((p) => ({ ...p, completedRotationTaskInstanceKeys: {} })) : clearBucket(COMPLETED_KEY[selected as Exclude<Bucket, "conclave" | "rotation">]!)}
                            timeMode={rc.timeMode}
                            worldState={wsData}
                            now={now}
                            netracellRuns={rc.netracellRuns}
                            onNetracellChange={(n) => setRc((p) => ({ ...p, netracellRuns: n }))}
                            inlineHints={wsInlineHints}
                            expandableHints={wsExpandableHints}
                        />
                    )}
                </>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-[30px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.09),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.95))] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Operations Calendar</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-100">{calendarWindow.label}</div>
                                <div className="mt-1 max-w-2xl text-sm text-slate-400">
                                    Plotted availability windows across the selected time range, with the live time marker showing what is active now and what expires next.
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <WorkspaceSegmented className="text-xs">
                                    <WorkspaceSegmentedButton active={calendarScale === "day"} onClick={() => setCalendarScale("day")} className="px-3 py-1.5 font-medium">Day</WorkspaceSegmentedButton>
                                    <WorkspaceSegmentedButton active={calendarScale === "week"} onClick={() => setCalendarScale("week")} className="px-3 py-1.5 font-medium">Week</WorkspaceSegmentedButton>
                                    <WorkspaceSegmentedButton active={calendarScale === "month"} onClick={() => setCalendarScale("month")} className="px-3 py-1.5 font-medium">Month</WorkspaceSegmentedButton>
                                </WorkspaceSegmented>
                                <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/30 p-1">
                                    <button
                                        className="rounded-full px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
                                        onClick={() => moveCalendarAnchor(-1)}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        className="rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
                                        onClick={() => setCalendarAnchor(new Date())}
                                    >
                                        Today
                                    </button>
                                    <button
                                        className="rounded-full px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
                                        onClick={() => moveCalendarAnchor(1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 rounded-[28px] bg-slate-950/20 p-1">
                            <CalendarAgenda
                                events={calendarEvents}
                                scale={calendarScale}
                                anchor={calendarAnchor}
                                timeMode={rc.timeMode}
                                selectedEventId={selectedCalendarEvent?.id ?? null}
                                onToggleTask={toggleCalendarTask}
                                onOpenDetails={setSelectedCalendarEventId}
                                now={now}
                                taskStateById={calendarTaskStateById}
                                worldState={wsData}
                            />
                        </div>
                    </div>
                </div>
            )}

            <CalendarDetailModal
                event={selectedCalendarEvent}
                open={layoutMode === "calendar" && !!selectedCalendarEvent}
                onClose={() => setSelectedCalendarEventId(null)}
                timeMode={rc.timeMode}
                worldState={wsData}
                now={now}
                inlineHints={wsInlineHints}
                expandableHints={wsExpandableHints}
                taskState={selectedCalendarEvent ? calendarTaskStateById[selectedCalendarEvent.task.id] ?? null : null}
                onToggleTask={toggleCalendarTask}
            />

        </WorkspacePanel>
    );
}
