// ===== FILE: src/catalog/prereqs/prereqRegistry.ts =====
//
// Prerequisite definitions for all tracked progression gates.
// Updated: 2026-11 — current progression gates through Update 44.1.4.1.
//
// Design rules:
// - Entries represent gates a player must pass through on the path to endgame.
// - showInPlanner: false = tracked on Prerequisites page, excluded from planner.
// - Mastery Rank modeled only as `conditions`, never as a registry row.

import type { PrereqId } from "../../domain/ids/prereqIds";
import { PR } from "../../domain/ids/prereqIds";
import { SY, getSyndicateDisplayName } from "../../domain/ids/syndicateIds";

export type PrereqCategory =
    | "Quests"
    | "SideQuests"
    | "Hubs"
    | "Systems"
    | "Segments"
    | "Necramech"
    | "Railjack"
    | "Syndicates";

export type PrereqCondition =
    | { type: "mastery_rank"; value: number }
    | { type: "quest_complete"; prereqId: PrereqId }
    | { type: "junction_complete"; junctionId: string }
    | { type: "node_complete"; nodeId: string; label?: string }
    | { type: "planet_unlock"; planetId: string }
    | { type: "syndicate_rank"; syndicateId: string; rank: number }
    | { type: "item_owned"; catalogId: string }
    | { type: "resource_owned"; catalogId: string; quantity: number }
    | { type: "star_chart_access"; activity: "steel_path" | "nightmare" }
    | { type: "railjack_intrinsic_rank"; rank: number; skillId?: string };

export interface PrereqEvidence {
    kind: "official" | "wiki" | "forum";
    url: string;
    verifiedOn: string;
    classification: "required" | "conditional" | "recommended" | "historical";
    note: string;
}

export function describePrereqCondition(cond: PrereqCondition, prereqLabelFor?: (id: string) => string): string {
    switch (cond.type) {
        case "mastery_rank":      return `Mastery Rank ${cond.value} required`;
        case "quest_complete": {
            const label = prereqLabelFor ? prereqLabelFor(cond.prereqId) : null;
            return label ? `Quest complete: ${label}` : `Quest complete: ${cond.prereqId}`;
        }
        case "junction_complete": return `Junction complete: ${cond.junctionId}`;
        case "node_complete":     return `Complete ${cond.label ?? cond.nodeId}`;
        case "planet_unlock":     return `Planet unlocked: ${cond.planetId}`;
        case "syndicate_rank":    return `${getSyndicateDisplayName(cond.syndicateId)} Rank ${cond.rank} required`;
        case "item_owned":        return `Item owned: ${cond.catalogId}`;
        case "resource_owned":    return `${cond.quantity}× ${cond.catalogId} required`;
        case "star_chart_access": return cond.activity === "steel_path"
            ? "Complete the eligible Star Chart nodes required to unlock The Steel Path"
            : "Complete all nodes on at least one eligible planet to unlock Nightmare missions";
        case "railjack_intrinsic_rank": return `${cond.skillId ? `${cond.skillId.replace(/^LPS_/, "").replaceAll("_", " ")} ` : "Any Railjack Intrinsic "}Rank ${cond.rank} required`;
    }
}

export interface PrereqDef {
    id: PrereqId;
    label: string;
    category: PrereqCategory;
    description: string;
    prerequisites: PrereqId[];
    /** At least one item in this alternative group must be complete. */
    anyPrerequisites?: PrereqId[];
    conditions?: PrereqCondition[];
    /** Sources supporting the current direct gate(s) for this entry. */
    evidence?: PrereqEvidence[];
    /** Release that introduced this gate, when established. */
    introducedIn?: string;
    showInPlanner?: boolean;
    partOf?: string;
    chapterIndex?: number;
    validatedBySyndicate?: {
        syndicateId: string;
        rank: number;
    };
    validatedByAnySyndicate?: {
        syndicateIds: string[];
        rank: number;
    };
    validatedByMasteryRank?: number;
}

export const PREREQ_REGISTRY: PrereqDef[] = [

    // =========================================================================
    // MAIN STORY QUESTS — Arc 1
    // =========================================================================
    {
        id: PR.AWAKENING,
        label: "The Awakening",
        category: "Quests",
        description: "First-login tutorial quest. It directly precedes Vor's Prize in the current quest sequence.",
        prerequisites: [],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Awakening", verifiedOn: "2026-11-09", classification: "required", note: "The current quest page lists First Login as the requirement and Vor's Prize as the next quest." }]
    },
    {
        id: PR.VORS_PRIZE,
        label: "Vor's Prize",
        category: "Quests",
        description: "Tutorial quest after The Awakening. Opens the Star Chart and installs base Orbiter segments.",
        prerequisites: [PR.AWAKENING],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Vor%27s_Prize", verifiedOn: "2026-11-09", classification: "required", note: "The current quest requirement is The Awakening; the quest progression page identifies it as the immediate predecessor." }]
    },
    {
        id: PR.THE_TEACHER,
        showInPlanner: false,
        label: "The Teacher",
        category: "Quests",
        description: "Post-Vor's Prize mod tutorial quest guided by Teshin. Tracked for quest reward availability.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.ONCE_AWAKE,
        label: "Once Awake",
        category: "Quests",
        description: "Early Infested main-story quest in Arc 1. The wiki chronology places it before Heart of Deimos and The Archwing.",
        prerequisites: [PR.JUNCTION_MERCURY_VENUS]
    },
    {
        id: PR.ARCHWING,
        label: "The Archwing",
        category: "Quests",
        description: "Unlocks Archwing gear and Empyrean access. Requires the Earth → Mars Junction.",
        prerequisites: [PR.JUNCTION_EARTH_MARS]
    },
    {
        id: PR.NATAH,
        label: "Natah",
        category: "Quests",
        description: "Unlocked automatically after The Archwing. The current quest no longer requires reaching Uranus or scanning an Oculyst to appear.",
        prerequisites: [PR.ARCHWING],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 made Natah unlock automatically after The Archwing; it removed the former Uranus Oculyst trigger."
        }]
    },

    // =========================================================================
    // MAIN STORY QUESTS — Arc 2
    // =========================================================================
    {
        id: PR.SECOND_DREAM,
        label: "The Second Dream",
        category: "Quests",
        description: "Unlocks Operator mode and the Focus system. Required for the War Within chain and Lua junction.",
        prerequisites: [PR.JUNCTION_URANUS_NEPTUNE, PR.NATAH],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 makes The Second Dream available after the Uranus → Neptune Junction; the current quest requirement panel also lists Natah separately, so both explicit game checks are represented."
        }]
    },
    {
        id: PR.WAR_WITHIN,
        label: "The War Within",
        category: "Quests",
        description: "Expands Operator to full Transference. Unlocks Kuva Fortress and the full Focus tree. Current main-quest progression does not require Mastery Rank 5.",
        prerequisites: [PR.JUNCTION_NEPTUNE_PLUTO, PR.SECOND_DREAM],
        evidence: [{
            kind: "official",
            url: "https://forums.warframe.com/topic/1374376-update-35-whispers-in-the-walls/",
            verifiedOn: "2026-11-09",
            classification: "required",
            note: "The current quest requirement panel lists both The Second Dream and the Neptune → Pluto Junction. Update 35 removed Mastery Rank requirements from the Main Quest Path."
        }]
    },
    {
        id: PR.CHAINS_HARROW,
        label: "Chains of Harrow",
        category: "Quests",
        description: "Requires visiting Onkko in Cetus after The War Within. Update 35.5 replaced the former Mote Amp gate with this visit requirement.",
        prerequisites: [PR.SYSTEM_ONKKO_VISITED],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/35-5-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 35.5 explicitly removed the Mote Amp requirement from Chains of Harrow and replaced it with visiting Onkko in Cetus."
        }]
    },
    {
        id: PR.APOSTASY,
        label: "Apostasy Prologue",
        category: "Quests",
        description: "Requires Personal Quarters segment. Required for The Sacrifice.",
        prerequisites: [PR.CHAINS_HARROW, PR.SEGMENT_PERSONAL_QUARTERS]
    },
    {
        id: PR.SACRIFICE,
        label: "The Sacrifice",
        category: "Quests",
        description: "Awards Excalibur Umbra. Required for Chimera Prologue.",
        prerequisites: [PR.APOSTASY]
    },

    // =========================================================================
    // MAIN STORY QUESTS — Arc 3 (Prelude to War + The New War)
    // =========================================================================
    {
        id: PR.CHIMERA_PROLOGUE,
        label: "Chimera Prologue",
        category: "Quests",
        description: "Chapter 1 of Prelude to War. Adds Ropalolyst assassination node to Jupiter. Required for Erra.",
        prerequisites: [PR.SACRIFICE],
        partOf: "Prelude to War",
        chapterIndex: 1
    },
    {
        id: PR.ERRA,
        label: "Erra",
        category: "Quests",
        description: "Chapter 2 of Prelude to War. Required for The Maker.",
        prerequisites: [PR.CHIMERA_PROLOGUE],
        partOf: "Prelude to War",
        chapterIndex: 2
    },
    {
        id: PR.PRELUDE_TO_WAR,
        label: "Prelude to War — The Maker",
        category: "Quests",
        description: "Chapter 3 of Prelude to War. Required for The New War.",
        prerequisites: [PR.ERRA],
        partOf: "Prelude to War",
        chapterIndex: 3
    },
    {
        id: PR.NEW_WAR,
        label: "The New War",
        category: "Quests",
        description: "Requires Prelude to War, an Operator Amp, and an owned Railjack. The Railjack can be built through Rising Tide or purchased from the Market. The game lends a Necramech during the quest; stronger Railjack equipment is recommended, not a gate.",
        prerequisites: [PR.PRELUDE_TO_WAR, PR.SYSTEM_OPERATOR_AMP],
        anyPrerequisites: [PR.RAILJACK_CONSTRUCTED, PR.RAILJACK_MARKET_ACQUIRED],
        evidence: [{
            kind: "wiki",
            url: "https://wiki.warframe.com/w/The_New_War",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "The current quest requirement list includes an owned Operator Amp, an owned Railjack, and Prelude to War. The page explicitly supports obtaining the Railjack either by completing Rising Tide or purchasing it with Platinum; these routes are an OR group."
        }, {
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/38-5-0",
            verifiedOn: "2026-11-08",
            classification: "historical",
            note: "Update 38.5 removed the owned-Necramech requirement and supplies a loaner."
        }, {
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/33-5-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 33.5 changed the Codex warning to state that an Operator Amp must be obtained to begin The New War."
        }]
    },

    // =========================================================================
    // MAIN STORY QUESTS — Arc 4 (Duviri / Zariman / 1999)
    // =========================================================================
    {
        id: PR.DUVIRI_PARADOX,
        label: "The Duviri Paradox",
        category: "Quests",
        description: "Unlocks The Circuit and Drifter Intrinsics. The current Codex unlock is the Saturn → Uranus Junction reward; completion is required for The Hex.",
        prerequisites: [PR.JUNCTION_SATURN_URANUS],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 lists The Duviri Paradox as a Uranus Junction reward." }]
    },
    {
        id: PR.ANGELS_ZARIMAN,
        label: "Angels of the Zariman",
        category: "Quests",
        description: "Unlocks Zariman hub and Holdfasts syndicate. Required for Whispers in the Walls.",
        prerequisites: [PR.NEW_WAR]
    },
    {
        id: PR.WHISPERS_WALL,
        label: "Whispers in the Walls",
        category: "Quests",
        description: "Unlocks Sanctum Anatomica and Cavia syndicate. Required for The Lotus Eaters and Melee Upgrade segment.",
        prerequisites: [PR.NEW_WAR, PR.HEART_OF_DEIMOS]
    },
    {
        id: PR.THE_LOTUS_EATERS,
        label: "The Lotus Eaters",
        category: "Quests",
        description: "Prologue to The Hex. Required for The Hex and The Old Peace.",
        prerequisites: [PR.WHISPERS_WALL]
    },
    {
        id: PR.THE_HEX,
        label: "The Hex",
        category: "Quests",
        description: "Unlocks Höllvania / 1999 hub. Requires both The Lotus Eaters and The Duviri Paradox.",
        prerequisites: [PR.THE_LOTUS_EATERS, PR.DUVIRI_PARADOX]
    },
    {
        id: PR.THE_OLD_PEACE,
        label: "The Old Peace",
        category: "Quests",
        description: "Continues the 1999 arc. Requires The Lotus Eaters.",
        prerequisites: [PR.THE_LOTUS_EATERS]
    },
    {
        id: PR.JADE_SHADOWS,
        label: "Jade Shadows",
        category: "Quests",
        description: "Awards Jade Warframe blueprint. Requires The New War.",
        prerequisites: [PR.NEW_WAR],
        showInPlanner: false
    },
    {
        id: PR.JADE_SHADOWS_CONSTELLATIONS,
        label: "Jade Shadows: Constellations",
        category: "Quests",
        description: "Quest that unlocks Uranus Proxima and its new Railjack missions. Requires Jade Shadows.",
        prerequisites: [PR.JADE_SHADOWS],
        introducedIn: "Update 43 (June 17, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-0-0", verifiedOn: "2026-11-08", classification: "required", note: "The Jade Shadows: Constellations quest requires Jade Shadows; completing it opens Uranus Proxima." }]
    },
    {
        id: PR.SYSTEM_HEX_ALL_LIKED,
        label: "The Hex: All Six Members Liked",
        category: "Systems",
        description: "Manual KIM relationship milestone for the Hex Finale. The game requires Hex Syndicate Rank 3 and Liked chemistry with all six members.",
        prerequisites: [PR.THE_HEX],
        conditions: [{ type: "syndicate_rank", syndicateId: SY.THE_HEX, rank: 3 }],
        introducedIn: "Update 38 (December 2024)",
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Hex_%28Quest%29", verifiedOn: "2026-11-08", classification: "required", note: "The Hex Finale trigger requires Rank 3 and Liked chemistry with all six Hex members." }]
    },
    {
        id: PR.THE_HEX_FINALE,
        label: "The Hex Finale",
        category: "Quests",
        description: "The Hex epilogue. Requires all six Hex members at Liked chemistry and the Rank 3 trigger milestone.",
        prerequisites: [PR.SYSTEM_HEX_ALL_LIKED],
        introducedIn: "Update 38 (December 2024)",
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Hex_%28Quest%29", verifiedOn: "2026-11-08", classification: "required", note: "The quest becomes available after the KIM relationship and rank conditions are met." }]
    },
    {
        id: PR.TAU_PROLOGUE,
        label: "Tau Prologue Quest Series",
        category: "Quests",
        description: "Codex quest series made available after completing both The Hex and The Old Peace.",
        prerequisites: [PR.THE_HEX, PR.THE_OLD_PEACE],
        introducedIn: "Update 44.1.2 (October 15, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/44-1-2", verifiedOn: "2026-11-08", classification: "required", note: "The update says the Tau Prologue appears in the Codex after both quests are complete." }]
    },

    // =========================================================================
    // SIDE QUESTS — Feature Gates
    // =========================================================================
    {
        id: PR.HOWL_KUBROW,
        label: "Howl of the Kubrow",
        category: "SideQuests",
        description: "Unlocks Kubrow incubation and breeding. Awards the Incubator Segment after the first early junction path.",
        prerequisites: [PR.JUNCTION_MERCURY_VENUS]
    },
    {
        id: PR.STOLEN_DREAMS,
        label: "Stolen Dreams",
        category: "SideQuests",
        description: "Side quest starring Maroo. Requires the Phobos Junction and unlocks the weekly Ayatan Treasure Hunt.",
        prerequisites: [PR.JUNCTION_MARS_PHOBOS]
    },
    {
        id: PR.SAYA_VIGIL,
        label: "Saya's Vigil",
        category: "SideQuests",
        description: "Unlocks Gara's blueprint. Requires Vor's Prize and completing at least one Cetus bounty before Konzu starts the quest.",
        prerequisites: [PR.VORS_PRIZE, PR.ACTIVITY_CETUS_BOUNTY_COMPLETED],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Saya%27s_Vigil", verifiedOn: "2026-11-09", classification: "required", note: "The current quest requirement panel lists both Vor's Prize and at least one completed bounty; the description says returning to Konzu after the bounty starts the quest." }]
    },
    {
        id: PR.VOX_SOLARIS,
        label: "Vox Solaris",
        category: "SideQuests",
        description: "Unlocks Solaris United bounty progression and Ventkids access in Fortuna / Orb Vallis.",
        prerequisites: [PR.THE_TEACHER, PR.HUB_FORTUNA],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Vox_Solaris_%28Quest%29", verifiedOn: "2026-11-09", classification: "required", note: "The quest page says Vox Solaris is available after The Teacher, then requires reaching Fortuna through the Venus Junction and speaking to Eudico. Both the quest flag and location access are represented." }]
    },
    {
        id: PR.HEART_OF_DEIMOS,
        label: "Heart of Deimos",
        category: "SideQuests",
        description: "Unlocks Necralisk, Cambion Drift, and Entrati syndicate. Required for Whispers in the Walls and Necramech system.",
        prerequisites: [PR.JUNCTION_EARTH_MARS]
    },
    {
        id: PR.RISING_TIDE,
        label: "Rising Tide",
        category: "SideQuests",
        description: "Constructs the Railjack. The current quest gate is The War Within (Update 39); completion is required for The New War and Call of the Tempestarii.",
        prerequisites: [PR.WAR_WITHIN],
        evidence: [
            { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 39 is the current rule: players must complete The War Within before they can play Rising Tide." },
            { kind: "official", url: "https://forums.warframe.com/topic/1374376-update-35-whispers-in-the-walls/", verifiedOn: "2026-11-09", classification: "historical", note: "Update 35 temporarily moved Rising Tide to immediately after The Second Dream; Update 39 superseded that order." }
        ]
    },
    {
        id: PR.VEILBREAKER,
        label: "Veilbreaker",
        category: "SideQuests",
        description: "Unlocks Kahl's Garrison and Archon Hunts. Required for Helminth Archon Shard segment.",
        prerequisites: [PR.NEW_WAR]
    },
    {
        id: PR.CALL_TEMPESTARII,
        label: "Call of the Tempestarii",
        category: "SideQuests",
        description: "Unlocks Sisters of Parvos and Corpus Proxima Railjack nodes. Requires a completed Railjack, The Deadlock Protocol, and MR4.",
        prerequisites: [PR.RAILJACK_CONSTRUCTED, PR.DEADLOCK_PROTOCOL],
        conditions: [{ type: "mastery_rank", value: 4 }]
    },
    {
        id: PR.DEADLOCK_PROTOCOL,
        label: "The Deadlock Protocol",
        category: "SideQuests",
        description: "Awards Protea blueprint. Required for Sisters of Parvos eligibility. Requires Saturn Junction completion and MR4.",
        prerequisites: [PR.JUNCTION_EUROPA_SATURN],
        conditions: [{ type: "mastery_rank", value: 4 }]
    },
    {
        id: PR.NEW_STRANGE,
        label: "The New Strange",
        category: "SideQuests",
        description: "Side quest for Cephalon Simaris and Chroma progression. Requires Stolen Dreams.",
        prerequisites: [PR.STOLEN_DREAMS],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_New_Strange", verifiedOn: "2026-11-09", classification: "required", note: "The current quest page lists Stolen Dreams as the quest requirement; Jupiter → Europa is not listed as a gate." }]
    },

    // =========================================================================
    // SIDE QUESTS — Warframe Blueprint Quests (tracked, not planning blockers)
    // =========================================================================
    {
        id: PR.LIMBO_THEOREM,
        label: "The Limbo Theorem",
        category: "SideQuests",
        description: "Awards Limbo blueprint. Requires an Archwing.",
        prerequisites: [PR.ARCHWING],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Limbo_Theorem", verifiedOn: "2026-11-09", classification: "required", note: "The current quest page lists obtaining an Archwing as the requirement; Jupiter → Europa is not listed as an additional quest gate." }]
    },
    {
        id: PR.SILVER_GROVE,
        label: "The Silver Grove",
        category: "SideQuests",
        description: "Awards Titania's blueprint. The quest is unlocked after The Second Dream and MR7, then started by speaking with New Loka at any Relay.",
        prerequisites: [PR.SECOND_DREAM, PR.HUB_RELAY],
        conditions: [{ type: "mastery_rank", value: 7 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Silver_Grove", verifiedOn: "2026-11-09", classification: "required", note: "The quest is unlocked at MR7 after The Second Dream; its start interaction is with New Loka in a Relay. The player need not be allied with New Loka." }]
    },
    {
        id: PR.SANDS_INAROS,
        label: "Sands of Inaros",
        category: "SideQuests",
        description: "Awards Inaros blueprint. Requires MR5. The quest beacon can be purchased from Baro Ki'Teer or traded from another player, so Relay access is only one acquisition route.",
        prerequisites: [],
        conditions: [{ type: "mastery_rank", value: 5 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Sands_of_Inaros", verifiedOn: "2026-11-09", classification: "required", note: "The beacon has an MR5 gate and is tradeable; a player may obtain it by trade, so visiting Baro at a Relay is not mandatory." }]
    },
    {
        id: PR.OCTAVIA_ANTHEM,
        label: "Octavia's Anthem",
        category: "SideQuests",
        description: "Awards Octavia blueprint. Requires The Second Dream.",
        prerequisites: [PR.SECOND_DREAM]
    },
    {
        id: PR.JORDAS_PRECEPT,
        label: "The Jordas Precept",
        category: "SideQuests",
        description: "Awards Atlas blueprint. Requires Pluto → Eris junction completion.",
        prerequisites: [PR.JUNCTION_PLUTO_SEDNA],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Jordas_Precept", verifiedOn: "2026-11-08", classification: "required", note: "The current quest is automatically acquired after completing the Pluto → Eris Junction." }]
    },
    {
        id: PR.GLAST_GAMBIT,
        label: "The Glast Gambit",
        category: "SideQuests",
        description: "Awards Nidus's blueprint. After The War Within, speak to Ergo Glast in a Relay to unlock the quest.",
        prerequisites: [PR.WAR_WITHIN, PR.HUB_RELAY],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Glast_Gambit", verifiedOn: "2026-11-09", classification: "required", note: "The quest unlock procedure requires The War Within and speaking with Ergo Glast in his Relay room." }]
    },
    {
        id: PR.MASK_REVENANT,
        label: "Mask of the Revenant",
        category: "SideQuests",
        description: "Awards Revenant blueprint. Start from Nakak in Cetus after reaching Observer with The Quills.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK2],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/23-5-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 23.5 states the Mask of the Revenant quest is offered after reaching Observer rank with the Quills. Reaching that rank already entails Quills/Cetus access." }]
    },
    {
        id: PR.HIDDEN_MESSAGES,
        label: "Hidden Messages",
        category: "SideQuests",
        description: "Awards Mirage blueprint. Requires Sedna access (missions on Mars, Saturn, and Sedna).",
        prerequisites: [PR.JUNCTION_SEDNA_ERIS]
    },
    {
        id: PR.WAVERIDER,
        label: "The Waverider",
        category: "SideQuests",
        description: "Awards Yareli blueprint. Requires completed Vox Solaris and MR3.",
        prerequisites: [PR.VOX_SOLARIS],
        conditions: [{ type: "mastery_rank", value: 3 }]
    },
    {
        id: PR.PATIENT_ZERO,
        label: "Patient Zero",
        category: "SideQuests",
        description: "Awards Mesa's blueprint. Requires completing Once Awake and unlocking Eris through the Pluto → Eris Junction.",
        prerequisites: [PR.ONCE_AWAKE, PR.JUNCTION_PLUTO_SEDNA],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Patient_Zero", verifiedOn: "2026-11-09", classification: "required", note: "The current quest requirements list both Once Awake and Eris access; the quest is awarded when the Pluto → Eris Junction is completed." }, { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 39's current Junction reward list confirms completing the Pluto → Eris Junction awards Patient Zero." }]
    },

    // =========================================================================
    // STAR CHART JUNCTIONS
    // =========================================================================
    {
        id: PR.JUNCTION_MERCURY_VENUS,
        label: "Junction: Venus → Mercury",
        category: "Systems",
        description: "Mercury Junction unlocks Mercury and awards Once Awake and Howl of the Kubrow. Its four current tasks are Vox Solaris, buying the Rhino Blueprint from the Market, defeating the Jackal at Fossa, and starting a Rhino component in the Foundry. Tenno-Hub tracks the quest and Fossa node; the Market and Foundry actions are confirmed when the Junction itself is completed.",
        // Vox Solaris already implies Fortuna and the preceding Venus Junction.
        prerequisites: [PR.VOX_SOLARIS],
        conditions: [{ type: "node_complete", nodeId: "node:mr/venus/fossa", label: "Jackal at Fossa (Venus)" }],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 39 lists Vox Solaris and defeating Jackal at Fossa as current Mercury Junction tasks, and says completing it unlocks Once Awake and Howl of the Kubrow." }]
    },
    {
        id: PR.JUNCTION_VENUS_EARTH,
        label: "Junction: Earth → Venus",
        category: "Systems",
        description: "Venus Junction unlocks Venus. Its current tasks are The Teacher, equipping and upgrading Dreamer's Bond, and starting a Taxon Sentinel build. Tenno-Hub tracks The Teacher; the mod and Foundry actions are confirmed when the Junction itself is completed.",
        prerequisites: [PR.THE_TEACHER],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/40-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 40 changed the first Venus Junction task from Vor's Prize to The Teacher. Update 39's current task list identifies it as the Venus Junction." }]
    },
    {
        id: PR.JUNCTION_EARTH_MARS,
        label: "Junction: Earth → Mars",
        category: "Systems",
        description: "Unlocks Mars and awards The Archwing and Heart of Deimos. Its current tasks are Once Awake, visiting the Side Quest section of the Codex, completing a mission with Boltor equipped, and purchasing an MK1 weapon. Tenno-Hub tracks Once Awake; the other onboarding actions are confirmed when the Junction itself is completed.",
        prerequisites: [PR.ONCE_AWAKE],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 lists Once Awake as an Earth-to-Mars Junction task and the Junction reward unlocks The Archwing and Heart of Deimos." }]
    },
    {
        id: PR.JUNCTION_MARS_PHOBOS,
        showInPlanner: false,
        label: "Junction: Mars → Phobos",
        category: "Systems",
        description: "Unlocks Phobos. Alternate path to Ceres; tracked for star chart completion.",
        prerequisites: [PR.JUNCTION_EARTH_MARS]
    },
    {
        id: PR.JUNCTION_MARS_CERES,
        label: "Junction: Mars → Ceres",
        category: "Systems",
        description: "Unlocks Ceres as an optional Star Chart branch. Ceres is no longer on the required main path to Jupiter.",
        prerequisites: [PR.JUNCTION_EARTH_MARS],
        evidence: [
            { kind: "wiki", url: "https://wiki.warframe.com/w/Junctions", verifiedOn: "2026-11-09", classification: "required", note: "The Junctions reference places the Mars-to-Ceres Junction on Mars; the Earth-to-Mars Junction is the chart-access gate for Mars." },
            { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "historical", note: "Update 39 explicitly calls the Ceres Junction optional and says it is not critical to the main story path." },
        ]
    },
    {
        id: PR.DEIMOS_ACCESS,
        label: "Deimos Access",
        category: "Systems",
        description: "Deimos opens after completing War on Mars. This path has no Junction; the prior imported junction checkmark remains a compatible saved-state key.",
        prerequisites: [],
        conditions: [{ type: "node_complete", nodeId: "node:mr/mars/war", label: "War mission on Mars" }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Deimos", verifiedOn: "2026-11-08", classification: "required", note: "Deimos becomes accessible after clearing War on Mars. The Mars-to-Deimos path has no Junction." }, { kind: "wiki", url: "https://wiki.warframe.com/w/Junctions", verifiedOn: "2026-11-08", classification: "required", note: "The current Junctions reference explicitly lists Mars to Deimos as a route without a Junction." }]
    },
    {
        id: PR.JUNCTION_CERES_JUPITER,
        label: "Junction: Deimos → Jupiter",
        category: "Systems",
        description: "The Jupiter Junction is located on Deimos. It requires access to Deimos and completion of Heart of Deimos; Ceres is now an optional branch. Its remaining tasks are a wall-dash/latch kill, the Advanced Movement tutorial, and upgrading Redirection to Rank 5.",
        prerequisites: [PR.DEIMOS_ACCESS, PR.HEART_OF_DEIMOS],
        evidence: [{
            kind: "wiki",
            url: "https://wiki.warframe.com/w/Deimos",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Current junction data places Jupiter Junction on Deimos and lists Heart of Deimos among its tasks."
        }, {
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/38-5-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "The Star Chart rework shortened the Earth-to-Deimos path; Update 39 then made Ceres an optional Junction branch."
        }, {
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 lists Heart of Deimos as a Jupiter Junction task and identifies Ceres as an optional path."
        }]
    },
    {
        id: PR.JUNCTION_JUPITER_EUROPA,
        label: "Junction: Jupiter → Europa",
        category: "Systems",
        description: "Unlocks Europa.",
        prerequisites: [PR.JUNCTION_CERES_JUPITER]
    },
    {
        id: PR.JUNCTION_EUROPA_SATURN,
        label: "Junction: Europa → Saturn",
        category: "Systems",
        description: "Unlocks Saturn. The Archwing quest is one of its current Junction tasks.",
        prerequisites: [PR.JUNCTION_JUPITER_EUROPA, PR.ARCHWING],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/38-5-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 38.5 moved The Archwing quest Junction requirement from Mars Junction to Saturn Junction." }]
    },
    {
        id: PR.JUNCTION_SATURN_URANUS,
        label: "Junction: Saturn → Uranus",
        category: "Systems",
        description: "Unlocks Uranus. Required for The Duviri Paradox.",
        prerequisites: [PR.JUNCTION_EUROPA_SATURN]
    },
    {
        id: PR.JUNCTION_URANUS_NEPTUNE,
        label: "Junction: Uranus → Neptune",
        category: "Systems",
        description: "Unlocks Neptune. Natah is a current direct task for the Neptune Junction.",
        prerequisites: [PR.JUNCTION_SATURN_URANUS, PR.NATAH],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 lists Natah as a Neptune Junction task; completing that Junction unlocks The Second Dream." }]
    },
    {
        id: PR.JUNCTION_NEPTUNE_PLUTO,
        label: "Junction: Neptune → Pluto",
        category: "Systems",
        description: "Unlocks Pluto. The Second Dream is a current direct task for the Pluto Junction.",
        // The Second Dream itself requires the Uranus → Neptune Junction.
        // Do not repeat that transitive location gate here.
        prerequisites: [PR.SECOND_DREAM],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 lists The Second Dream as a Pluto Junction task and says the Pluto Junction unlocks The War Within." }]
    },
    {
        id: PR.JUNCTION_PLUTO_SEDNA,
        label: "Junction: Pluto → Eris",
        category: "Systems",
        description: "Stable completion key for the current Pluto → Eris Junction. Completing it unlocks Eris; the Focus Lens task separately unlocks Arbitrations before the full Junction is complete.",
        // War Within and the Focus Lens task both imply access to Pluto.
        prerequisites: [PR.WAR_WITHIN, PR.SYSTEM_ERIS_FOCUS_LENS],
        introducedIn: "Update 39 (June 25, 2025; junction path revision)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 lists The War Within and the Focus Lens task at the Eris Junction; completion unlocks Eris." }]
    },
    {
        id: PR.SYSTEM_ERIS_FOCUS_LENS,
        label: "Eris Junction: Equip a Focus Lens",
        category: "Systems",
        description: "Complete this Pluto → Eris Junction task by equipping a Focus Lens. It unlocks Arbitrations before the full Junction is completed.",
        prerequisites: [PR.JUNCTION_NEPTUNE_PLUTO],
        introducedIn: "Update 39 (June 25, 2025; Arbitrations unlock revision)",
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 says equipping a Focus Lens is an Eris Junction task whose reward is unlocking Arbitrations, before Junction completion."
        }]
    },
    {
        id: PR.JUNCTION_SEDNA_ERIS,
        label: "Junction: Eris → Sedna",
        category: "Systems",
        description: "Stable completion key for the current Eris → Sedna Junction. Requires Rising Tide and completion of the Sover Strait mission.",
        prerequisites: [PR.JUNCTION_PLUTO_SEDNA, PR.RISING_TIDE],
        conditions: [{ type: "node_complete", nodeId: "node:mr/earth/sover-strait", label: "Sover Strait (Earth Proxima)" }],
        introducedIn: "Update 39 (June 25, 2025; junction path revision)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 moved the Sedna Junction from Pluto to Eris and lists Rising Tide plus Sover Strait (Earth Proxima) as Junction tasks." }]
    },
    {
        id: PR.JUNCTION_EARTH_LUA,
        label: "Lua Access",
        category: "Systems",
        description: "Lua becomes accessible after completing The Second Dream. This gate retains the former fake Earth → Lua Junction's saved-state key for compatibility.",
        prerequisites: [PR.SECOND_DREAM],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Star_Chart", verifiedOn: "2026-11-08", classification: "required", note: "Lua is unlocked by completing The Second Dream; the Earth-to-Lua route is explicitly a path without a Junction." }]
    },
    {
        id: PR.KUVA_FORTRESS_ACCESS,
        label: "Kuva Fortress Access",
        category: "Systems",
        description: "The War Within directly unlocks the Kuva Fortress; this is retained under its legacy saved-state key for compatibility.",
        prerequisites: [PR.WAR_WITHIN],
        evidence: [{
            kind: "wiki",
            url: "https://wiki.warframe.com/w/The_War_Within",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Completing The War Within unlocks the Kuva Fortress location; reaching Eris is not a prerequisite."
        }]
    },

    // =========================================================================
    // OPEN WORLD HUBS
    // =========================================================================
    {
        id: PR.HUB_RELAY,
        label: "Any Relay Access",
        category: "Hubs",
        description: "Visit any available Relay node. Relay nodes have their own Star Chart availability; the Relay system has no shared quest gate.",
        prerequisites: [],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Relay", verifiedOn: "2026-11-09", classification: "required", note: "The Relay access section says to enter an available Relay node from Navigation; the table lists Strata on Earth, Larunda on Mercury, and Maroo's Bazaar on Mars at MR 0+. No shared quest prerequisite is listed." }]
    },
    {
        id: PR.HUB_CETUS,
        label: "Cetus (Plains of Eidolon) Access",
        category: "Hubs",
        description: "You can enter Cetus and the Plains of Eidolon after The Teacher. Saya's Vigil is an optional quest; it is not needed to enter Cetus or meet Onkko.",
        prerequisites: [PR.THE_TEACHER],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Teacher", verifiedOn: "2026-11-08", classification: "required", note: "The Teacher awards access to Cetus and the Plains of Eidolon." }, { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "historical", note: "Update 39 removed Saya's Vigil as a requirement for entering Cetus and receiving the Mote Amp." }]
    },
    {
        id: PR.ACTIVITY_CETUS_BOUNTY_COMPLETED,
        showInPlanner: false,
        label: "Completed a Cetus Bounty",
        category: "Systems",
        description: "Manual milestone: complete at least one single-stage Cetus bounty. Konzu requires this after Vor's Prize before starting Saya's Vigil.",
        prerequisites: [PR.HUB_CETUS],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Saya%27s_Vigil", verifiedOn: "2026-11-09", classification: "required", note: "Saya's Vigil requires one completed Cetus bounty after Vor's Prize; returning to Konzu after the bounty starts the quest." }]
    },
    {
        id: PR.HUB_FORTUNA,
        label: "Fortuna (Orb Vallis) Access",
        category: "Hubs",
        description: "You can enter Fortuna and Orb Vallis. Required for Solaris United standing progression.",
        prerequisites: [PR.JUNCTION_VENUS_EARTH]
    },
    {
        id: PR.HUB_NECRALISK,
        label: "Necralisk (Deimos) Access",
        category: "Hubs",
        description: "You can enter the Necralisk. Required for Entrati syndicate, Necraloid, and the Helminth segment.",
        prerequisites: [PR.HEART_OF_DEIMOS]
    },
    {
        id: PR.HUB_ZARIMAN,
        label: "Zariman (Chrysalith) Access",
        category: "Hubs",
        description: "You can enter the Chrysalith. Required for Holdfasts syndicate and Zariman mission types.",
        prerequisites: [PR.ANGELS_ZARIMAN]
    },
    {
        id: PR.HUB_SANCTUM,
        label: "Sanctum Anatomica Access",
        category: "Hubs",
        description: "You can enter Sanctum Anatomica. Required for Cavia syndicate standing and Netracell access.",
        prerequisites: [PR.WHISPERS_WALL],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/35-5-0", verifiedOn: "2026-11-09", classification: "required", note: "Whispers in the Walls unlocks the Sanctum Anatomica hub directly; Heart of Deimos is already part of the quest chain and need not be duplicated." }]
    },
    {
        id: PR.HUB_HOLLVANIA,
        label: "Höllvania Central Mall Access",
        category: "Hubs",
        description: "You can enter Höllvania. Required for 1999 vendors, The Hex faction standing, and hub missions.",
        prerequisites: [PR.THE_HEX]
    },
    {
        id: PR.HUB_YUVAN_PEAK,
        label: "Yuvan Peak Access",
        category: "Hubs",
        description: "Reach Yuvan Peak in the Zariman. Requires both Angels of the Zariman and Whispers in the Walls.",
        prerequisites: [PR.ANGELS_ZARIMAN, PR.WHISPERS_WALL],
        introducedIn: "Update 44 (September 23, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/44-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 44 explicitly requires both quests to access Yuvan Peak." }]
    },
    {
        id: PR.HUB_PONTIS_TOWER,
        label: "Pontis Tower Access",
        category: "Hubs",
        description: "Access the Zariman outpost at Pontis Tower from Uranus Proxima.",
        prerequisites: [PR.SYSTEM_URANUS_PROXIMA],
        introducedIn: "Update 43 (June 17, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Pontis Tower and Uranus Proxima are unlocked by Jade Shadows: Constellations." }]
    },
    {
        id: PR.HUB_LA_CATHEDRALE,
        label: "La Cathédrale Access",
        category: "Hubs",
        description: "Access La Cathédrale after The Old Peace. Entry uses the Drifter; this character choice is not a progression gate.",
        prerequisites: [PR.THE_OLD_PEACE],
        introducedIn: "Update 41 (December 10, 2025)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Completing The Old Peace unlocks La Cathédrale." }]
    },
    {
        id: PR.HUB_DRIFTERS_CAMP,
        label: "Drifter's Camp Access",
        category: "Hubs",
        description: "Access to Kahl's Garrison weekly missions in the Drifter's Camp.",
        prerequisites: [PR.NEW_WAR]
    },
    {
        id: PR.CLAN_DOJO,
        label: "Clan Dojo Access",
        category: "Systems",
        description: "Join or create a Clan, build a Clan Key, and enter its Dojo. No quest or Star Chart milestone is required; this is a manual milestone because clan membership/key state is not imported.",
        prerequisites: [],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Clan_Dojo", verifiedOn: "2026-11-09", classification: "required", note: "Dojo access requires clan membership and a constructed Clan Key; no quest prerequisite is listed." }]
    },
    {
        id: PR.CLAN_DRY_DOCK,
        label: "Clan Dojo Dry Dock Access",
        category: "Railjack",
        description: "Manual environment milestone: access a Clan Dojo that has a constructed Dry Dock. Clan membership alone does not guarantee that the room exists.",
        prerequisites: [PR.CLAN_DOJO],
        evidence: [{ kind: "official", url: "https://support.warframe.com/hc/en-us/articles/38820959037069-The-Dry-Dock", verifiedOn: "2026-11-09", classification: "required", note: "A Dry Dock must be constructed in a Dojo to use the Clan Dojo research route; Relay Dry Docks do not provide Clan Research." }]
    },
    {
        id: PR.ACTIVITY_STEEL_PATH,
        label: "The Steel Path Unlocked",
        category: "Systems",
        description: "Speak to Teshin in a Relay after completing all eligible nodes available before The New War, and reach Mastery Rank 5 to clear Oro on Earth. Normal-mode node completion is auto-derived.",
        prerequisites: [PR.HUB_RELAY],
        conditions: [{ type: "star_chart_access", activity: "steel_path" }, { type: "mastery_rank", value: 5 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Steel_Path", verifiedOn: "2026-11-09", classification: "required", note: "Current Steel Path access requires all eligible pre-New-War Star Chart nodes, MR5 to unlock Oro on Earth, and speaking to Teshin in a Relay; the excluded nodes are listed in the article." }]
    },
    {
        id: PR.ACTIVITY_STEEL_PATH_HONORS,
        label: "Teshin's Steel Path Honors",
        category: "Systems",
        description: "Access Teshin's Steel Path Honors shop in any Relay after unlocking The Steel Path.",
        // Unlocking The Steel Path already requires a Relay visit.
        prerequisites: [PR.ACTIVITY_STEEL_PATH]
    },
    {
        id: PR.ACTIVITY_CIRCUIT_STEEL_PATH,
        label: "The Steel Path Circuit",
        category: "Systems",
        description: "Unlock the Steel Path version of The Circuit. Requires both The Duviri Paradox and The Steel Path.",
        prerequisites: [PR.DUVIRI_PARADOX, PR.ACTIVITY_STEEL_PATH]
    },
    {
        id: PR.ACTIVITY_NIGHTWAVE,
        showInPlanner: false,
        label: "Nightwave Access",
        category: "Systems",
        description: "Access Nightwave challenges, Cred offerings, and rank rewards after The Teacher. This is tracked as a manual milestone because season availability rotates.",
        prerequisites: [PR.THE_TEACHER],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Nightwave", verifiedOn: "2026-11-09", classification: "required", note: "The current Nightwave article lists completion of The Teacher as the access requirement." }]
    },
    {
        id: PR.ACTIVITY_SORTIES,
        label: "Sorties",
        category: "Systems",
        description: "Access Sorties after The War Within, MR5, completing the Oro mission on Earth, and having a Rank 30 Warframe (or MR30 Forma bypass) available.",
        prerequisites: [PR.WAR_WITHIN, PR.SYSTEM_RANK30_WARFRAME],
        conditions: [{ type: "mastery_rank", value: 5 }, { type: "node_complete", nodeId: "node:mr/earth/oro", label: "Oro (Earth)" }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Sortie", verifiedOn: "2026-11-09", classification: "required", note: "Sortie access independently requires The War Within, MR5, and Oro on Earth; a Rank 30 Warframe or the MR30 Forma bypass applies to entering its missions." }]
    },
    {
        id: PR.ACTIVITY_VOID_FISSURES,
        label: "Void Fissures",
        category: "Systems",
        description: "Access fissures on unlocked Star Chart nodes after Vor's Prize. The Void Relic Segment is only needed to refine Relics, not to crack them.",
        prerequisites: [PR.VORS_PRIZE],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Void_Fissure", verifiedOn: "2026-11-09", classification: "required", note: "A fissure can be played on an unlocked mission node with a Relic; the Void Relic Segment enables refinement and is not a fissure access gate." }]
    },
    {
        id: PR.ACTIVITY_VOID_STORMS,
        label: "Void Storms",
        category: "Systems",
        description: "Join Railjack Void Storm missions after The Archwing, or launch them with a player-owned Railjack after Rising Tide. Call of the Tempestarii is not required to join a squad.",
        prerequisites: [],
        anyPrerequisites: [PR.ARCHWING, PR.RAILJACK_CONSTRUCTED],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/30-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 30 introduced Void Storms as Empyrean fissures. The Empyrean access rules allow Archwing-equipped players to join public Railjack missions; owning a Railjack is only required to launch/host one." }]
    },
    {
        id: PR.ACTIVITY_KUVA_SIPHON,
        label: "Kuva Siphon and Flood Missions",
        category: "Systems",
        description: "Access Kuva Siphon and Flood missions after The War Within and Mastery Rank 5. Individual mission nodes still follow Star Chart access.",
        prerequisites: [PR.WAR_WITHIN],
        conditions: [{ type: "mastery_rank", value: 5 }],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/35-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 35 explicitly adds MR5 to Kuva Siphon missions, alongside The War Within access." }]
    },
    {
        id: PR.ACTIVITY_CIRCUIT,
        label: "The Circuit",
        category: "Systems",
        description: "Access The Circuit in Duviri after completing The Duviri Paradox.",
        prerequisites: [PR.DUVIRI_PARADOX]
    },
    {
        id: PR.ACTIVITY_NETRACELLS,
        label: "Netracells",
        category: "Systems",
        description: "Access weekly Netracell runs in Sanctum Anatomica after Whispers in the Walls.",
        prerequisites: [PR.WHISPERS_WALL],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Netracells", verifiedOn: "2026-11-09", classification: "required", note: "Netracell missions require completion of Whispers in the Walls; Tagfer in the Sanctum Anatomica is the access point, and that hub is unlocked by the same quest." }]
    },
    {
        id: PR.ACTIVITY_NETRACELL_COMPLETED,
        showInPlanner: false,
        label: "Completed a Netracell Mission",
        category: "Systems",
        description: "Manual milestone: complete at least one Netracell mission. Deep Archimedea checks for a completed run, not just access to Netracells.",
        prerequisites: [PR.ACTIVITY_NETRACELLS]
    },
    {
        id: PR.ACTIVITY_DEEP_ARCHIMEDEA,
        label: "Deep Archimedea",
        category: "Systems",
        description: "Access Deep Archimedea by speaking to Necraloid in Sanctum Anatomica. The game checks Whispers in the Walls, Cavia Rank 5, and at least one completed Netracell mission.",
        prerequisites: [PR.WHISPERS_WALL, PR.SYNDICATE_CAVIA_RANK5, PR.ACTIVITY_NETRACELL_COMPLETED],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Elite_Deep_Archimedea", verifiedOn: "2026-11-09", classification: "required", note: "The current access rule explicitly lists Whispers in the Walls, one completed Netracell, and Cavia Rank 5. Whispers is retained as a direct edge because the game lists it separately even though Cavia access already implies it." }]
    },
    {
        id: PR.ACTIVITY_ELITE_DEEP_ARCHIMEDEA,
        label: "Elite Deep Archimedea Unlocked",
        category: "Systems",
        description: "Manual milestone: reach the 25 Research Point threshold in Deep Archimedea to unlock Elite Deep Archimedea. The threshold does not require completing an Elite run.",
        prerequisites: [PR.ACTIVITY_DEEP_ARCHIMEDEA],
        introducedIn: "Update 35.5 (March 2024)",
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Elite_Deep_Archimedea", verifiedOn: "2026-11-08", classification: "required", note: "Elite Deep Archimedea unlocks after accumulating 25 Research Points in Deep Archimedea." }]
    },
    {
        id: PR.ACTIVITY_TEMPORAL_ARCHIMEDEA,
        label: "Temporal Archimedea",
        category: "Systems",
        description: "Access Temporal Archimedea in Höllvania. Requires The Hex and Hex Syndicate Rank 5.",
        prerequisites: [PR.THE_HEX, PR.SYNDICATE_HEX_RANK5],
        introducedIn: "Update 38 (December 2024)",
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Update_38", verifiedOn: "2026-11-09", classification: "required", note: "Temporal Archimedea requires both The Hex and Hex Syndicate Rank 5; the game lists the quest separately even though the rank path requires it." }]
    },
    {
        id: PR.ACTIVITY_ELITE_TEMPORAL_ARCHIMEDEA,
        label: "Elite Temporal Archimedea Unlocked",
        category: "Systems",
        description: "Manual milestone: reach the 25 Research Point threshold in Temporal Archimedea to unlock its Elite variant. The threshold does not require completing an Elite run.",
        prerequisites: [PR.ACTIVITY_TEMPORAL_ARCHIMEDEA],
        introducedIn: "Update 38 (December 2024)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/psn/38-5-0", verifiedOn: "2026-11-08", classification: "required", note: "The update describes Elite Temporal Archimedea unlocking after 25 Research Points in Temporal Archimedea." }]
    },
    {
        id: PR.ACTIVITY_ICEBIND,
        label: "The Icebind",
        category: "Systems",
        description: "Access the 2026 Halloween mission. Requires both Angels of the Zariman and Whispers in the Walls, plus either Elite Deep Archimedea or Elite Temporal Archimedea unlocked.",
        prerequisites: [PR.ANGELS_ZARIMAN, PR.WHISPERS_WALL],
        anyPrerequisites: [PR.ACTIVITY_ELITE_DEEP_ARCHIMEDEA, PR.ACTIVITY_ELITE_TEMPORAL_ARCHIMEDEA],
        introducedIn: "Update 44.1 (October 7, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/44-1-0", verifiedOn: "2026-11-08", classification: "required", note: "The Icebind requires both quests and access to either Elite Deep Archimedea or Elite Temporal Archimedea." }]
    },
    {
        id: PR.ACTIVITY_FOLLIES_HUNT,
        label: "Follie's Hunt",
        category: "Systems",
        description: "Access the permanent Follie's Hunt activity at Vesper Relay. Requires Chains of Harrow.",
        prerequisites: [PR.CHAINS_HARROW],
        introducedIn: "Update 42 (March 26, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/42-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 42 states Chains of Harrow is required to access Follie's Hunt." }]
    },
    {
        id: PR.ACTIVITY_ASPIRANT_ZORBA,
        label: "Aspirant Zorba Access",
        category: "Systems",
        description: "Access the Zorba offerings and associated currency through Follie's Hunt. Requires Chains of Harrow.",
        prerequisites: [PR.CHAINS_HARROW],
        introducedIn: "Update 42 (March 26, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/42-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 42 makes Chains of Harrow the access requirement for Aspirant Zorba." }]
    },
    {
        id: PR.SYSTEM_URANUS_PROXIMA,
        label: "Uranus Proxima Access",
        category: "Railjack",
        description: "Unlock Uranus Proxima and its two new Railjack missions after completing Jade Shadows: Constellations. A player-owned Railjack is not required to start these missions.",
        prerequisites: [PR.JADE_SHADOWS_CONSTELLATIONS],
        introducedIn: "Update 43 (June 17, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Completion unlocks Uranus Proxima; the update says the missions can be launched using a provided Railjack." }]
    },
    {
        id: PR.ACTIVITY_KUVA_WYTCH,
        label: "The Kuva Wytch",
        category: "Systems",
        description: "Access this Uranus Proxima Railjack mission after Jade Shadows: Constellations.",
        prerequisites: [PR.SYSTEM_URANUS_PROXIMA],
        introducedIn: "Update 43 (June 17, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Listed as one of the two missions unlocked by completing the quest." }]
    },
    {
        id: PR.ACTIVITY_SCORIAS_ANGEL,
        label: "Scoria's Angel",
        category: "Systems",
        description: "Access this Uranus Proxima Railjack mission after Jade Shadows: Constellations.",
        prerequisites: [PR.SYSTEM_URANUS_PROXIMA],
        introducedIn: "Update 43 (June 17, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Listed as one of the two missions unlocked by completing the quest." }]
    },
    {
        id: PR.SYSTEM_DEVILS_TRIAD_KIM,
        label: "Devil's Triad KIM Access",
        category: "Systems",
        description: "Access the Devil's Triad KIM feature after The Old Peace.",
        prerequisites: [PR.THE_OLD_PEACE],
        introducedIn: "Update 41 (December 10, 2025)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Completing The Old Peace unlocks the Devil's Triad KIM feature." }]
    },
    {
        id: PR.SYSTEM_DARK_REFRACTORY_PREVIEW,
        label: "Opt into Dark Refractory Mission Preview",
        category: "Systems",
        description: "Use Mission Preview from Update Highlights or the Pause Menu after The Teacher. This is a conditional access route for Descendia and The Perita Rebellion; it does not unlock La Cathédrale, Devil's Triad vendors, KIM, or other quest-gated content.",
        prerequisites: [PR.THE_TEACHER],
        introducedIn: "Update 41 (December 10, 2025)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-0", verifiedOn: "2026-11-08", classification: "conditional", note: "The preview button is accessed from Update Highlights or the Pause Menu; players must complete The Teacher before using it. Using the feature makes Dark Refractory appear at Navigation." }]
    },
    {
        id: PR.ACTIVITY_DARK_REFRACTORY,
        label: "Dark Refractory Access",
        category: "Systems",
        description: "Dark Refractory appears at Navigation after The Old Peace or after opting into Mission Preview. Mission Preview requires The Teacher; MR10 is required for public matchmaking only, not solo or invite-only access.",
        prerequisites: [],
        anyPrerequisites: [PR.THE_OLD_PEACE, PR.SYSTEM_DARK_REFRACTORY_PREVIEW],
        introducedIn: "Update 41 (December 10, 2025)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-0", verifiedOn: "2026-11-08", classification: "conditional", note: "The update distinguishes normal access after The Old Peace from Codex preview access after The Teacher; MR10 applies to public matchmaking." }]
    },
    {
        id: PR.ACTIVITY_DESCENDIA,
        label: "The Descendia",
        category: "Systems",
        description: "Access the permanent Descendia game mode through Dark Refractory after The Old Peace, or through Mission Preview after The Teacher.",
        prerequisites: [PR.ACTIVITY_DARK_REFRACTORY],
        introducedIn: "Update 41 (December 10, 2025)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-0", verifiedOn: "2026-11-08", classification: "conditional", note: "The activity is reached through Dark Refractory; its separate Codex Mission Preview route is available after The Teacher." }]
    },
    {
        id: PR.ACTIVITY_PERITA_REBELLION,
        label: "The Perita Rebellion",
        category: "Systems",
        description: "Access the permanent Perita Rebellion game mode through Dark Refractory after The Old Peace, or through Mission Preview after The Teacher. The limited Operation: Blood of Perita was a separate event.",
        prerequisites: [PR.ACTIVITY_DARK_REFRACTORY],
        introducedIn: "Update 41 (December 10, 2025)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-0", verifiedOn: "2026-11-08", classification: "conditional", note: "The activity is reached through Dark Refractory; its separate Codex Mission Preview route is available after The Teacher." }]
    },
    {
        id: PR.SYSTEM_AMIR_CLOSE,
        label: "Amir Chemistry: Close",
        category: "Systems",
        description: "Manual KIM chemistry milestone. Fables & Frontiers requires Amir Chemistry Rank 5 (Close).",
        prerequisites: [PR.HUB_HOLLVANIA],
        introducedIn: "Update 43.5 (August 12, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-5-0", verifiedOn: "2026-11-08", classification: "required", note: "The permanent Running Late quest requires Amir Chemistry Rank 5 (Close)." }]
    },
    {
        id: PR.ACTIVITY_FABLES_FRONTIERS,
        label: "Fables & Frontiers: Running Late",
        category: "Systems",
        description: "Access the permanent Running Late KIM adventure. The game explicitly checks The Hex and The Hex Finale, Hex Rank 5, and Amir Chemistry Rank 5 (Close).",
        prerequisites: [PR.THE_HEX, PR.THE_HEX_FINALE, PR.SYNDICATE_HEX_RANK5, PR.SYSTEM_AMIR_CLOSE],
        introducedIn: "Update 43.5 (August 12, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-5-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 43.5 explicitly requires both The Hex Quest and The Hex Finale, Hex Rank 5 (Pizza Party), and Chemistry Rank 5 (Close) with Amir. The Hex Finale depends on The Hex in the registry, but the game lists both separately." }]
    },
    {
        id: PR.ACTIVITY_KUVA_LICH,
        label: "Kuva Lich System",
        category: "Systems",
        description: "Meet the prerequisites to create and pursue a Kuva Lich. The game requires The War Within, Mastery Rank 5, an empty Adversary slot, and an owned Railjack from Rising Tide or the Market.",
        prerequisites: [PR.WAR_WITHIN, PR.SYSTEM_ADVERSARY_SLOT_CLEAR],
        anyPrerequisites: [PR.RAILJACK_CONSTRUCTED, PR.RAILJACK_MARKET_ACQUIRED],
        conditions: [{ type: "mastery_rank", value: 5 }],
        evidence: [{
            kind: "wiki",
            url: "https://wiki.warframe.com/w/Kuva_Lich",
            verifiedOn: "2026-11-09",
            classification: "required",
            note: "The current Kuva Lich requirements are The War Within, MR5, and an acquired Railjack. Rising Tide is one Railjack acquisition route; the game also permits Railjack purchase, so ownership is modeled as either route."
        }, {
            kind: "wiki",
            url: "https://wiki.warframe.com/w/Adversary_System",
            verifiedOn: "2026-11-09",
            classification: "required",
            note: "The current Adversary System permits only one active Adversary at a time; clear the existing Lich, Sister, or Coda before generating another."
        }]
    },
    {
        id: PR.ACTIVITY_SISTER_PARVOS,
        label: "Sisters of Parvos System",
        category: "Systems",
        description: "Meet the prerequisites to create and pursue a Sister of Parvos. Requires The War Within, Call of the Tempestarii, Mastery Rank 5, and an empty Adversary slot.",
        prerequisites: [PR.WAR_WITHIN, PR.CALL_TEMPESTARII, PR.SYSTEM_ADVERSARY_SLOT_CLEAR],
        conditions: [{ type: "mastery_rank", value: 5 }],
        evidence: [{
            kind: "wiki",
            url: "https://wiki.warframe.com/w/Sisters_of_Parvos",
            verifiedOn: "2026-11-09",
            classification: "required",
            note: "Sister creation requires The War Within, Call of the Tempestarii, and MR5; the Adversary slot must also be clear before a new candidate can be converted."
        }, {
            kind: "wiki",
            url: "https://wiki.warframe.com/w/Adversary_System",
            verifiedOn: "2026-11-09",
            classification: "required",
            note: "Only one Adversary can be active at a time, including Kuva Liches, Sisters of Parvos, and Technocyte Codas."
        }]
    },
    {
        id: PR.ACTIVITY_SISTER_VANQUISHED,
        showInPlanner: false,
        label: "Vanquished a Sister of Parvos",
        category: "Systems",
        description: "Manual milestone: vanquish a Sister of Parvos. The vanquished Sister's Hound is awarded as a Companion; converting a Sister is not this milestone.",
        prerequisites: [PR.ACTIVITY_SISTER_PARVOS],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Hound", verifiedOn: "2026-11-09", classification: "required", note: "The current Hound page says vanquishing a Sister rewards her Hound as a Companion. Sister creation eligibility alone does not grant that reward." }]
    },
    {
        id: PR.ACTIVITY_ABYSSAL_ZONE,
        showInPlanner: false,
        label: "Abyssal Zone Access",
        category: "Systems",
        description: "Access the Abyssal Zone mission on Ceres with an Abyssal Beacon. The Beacon can be purchased from any one of the six main Syndicates at Rank 2; a Relay visit is not required.",
        prerequisites: [PR.JUNCTION_MARS_CERES],
        validatedByAnySyndicate: {
            syndicateIds: [
                SY.STEEL_MERIDIAN,
                SY.ARBITERS_OF_HEXIS,
                SY.CEPHALON_SUDA,
                SY.THE_PERRIN_SEQUENCE,
                SY.NEW_LOKA,
                SY.RED_VEIL
            ],
            rank: 2
        },
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Abyssal_Zone", verifiedOn: "2026-11-09", classification: "required", note: "Abyssal Zone access is on Ceres and requires possession of a Beacon, purchasable from any of the six main Syndicates at Rank 2. The mission page does not require visiting a Relay; Ceres Chart access is the Star Chart gate." }]
    },
    {
        id: PR.ACTIVITY_ARBITRATIONS,
        label: "Arbitrations Access",
        category: "Systems",
        description: "Arbitrations unlock when the Focus Lens task at the Pluto → Eris Junction is completed; the full Junction is not required. To enter a mission, have a Rank 30 Warframe or use the MR30 Forma bypass.",
        prerequisites: [PR.SYSTEM_ERIS_FOCUS_LENS, PR.SYSTEM_RANK30_WARFRAME],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 assigns Unlock Arbitrations as the reward for the Eris Junction's Equip a Focus Lens task." }, { kind: "wiki", url: "https://wiki.warframe.com/w/Arbitrations", verifiedOn: "2026-11-08", classification: "required", note: "A Rank 30 Warframe is required to enter Arbitrations; MR30 with a Forma-polarized Warframe is an exception." }]
    },
    {
        id: PR.ACTIVITY_NIGHTMARE,
        label: "Nightmare Missions Unlocked",
        category: "Systems",
        description: "Unlock Nightmare Mode on a planet by completing every mission node on that planet. This is auto-derived from tracked normal-mode node completion.",
        prerequisites: [PR.VORS_PRIZE],
        conditions: [{ type: "star_chart_access", activity: "nightmare" }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Nightmare_Mode", verifiedOn: "2026-11-09", classification: "required", note: "Nightmare missions unlock per planet when all regular mission nodes on that planet are completed; completing one eligible planet grants access to its Nightmare mission." }]
    },
    {
        id: PR.ACTIVITY_THERMIA_FRACTURES,
        label: "Thermia Fractures",
        category: "Systems",
        description: "Access Thermia Fractures in Orb Vallis and earn Diluted Thermia, which is required to start the Exploiter Orb fight.",
        prerequisites: [PR.HUB_FORTUNA],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/24-6-0", verifiedOn: "2026-11-09", classification: "required", note: "Thermia Fractures occur in Orb Vallis; access to Orb Vallis is the location gate. Vox Solaris quest completion is not listed as a requirement." }]
    },
    {
        id: PR.ACTIVITY_INVASIONS,
        label: "Invasions Available",
        category: "Systems",
        description: "After Vor's Prize opens Navigation, no permanent global progression gate is tracked. Invasion missions rotate over accessible Star Chart nodes; participation requires an active Invasion on a node the player can access.",
        prerequisites: [PR.VORS_PRIZE],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/news/vors-prize-guide", verifiedOn: "2026-11-08", classification: "required", note: "Vor's Prize opens the Star Chart and Navigation used to access missions." }, { kind: "wiki", url: "https://wiki.warframe.com/w/Invasion", verifiedOn: "2026-11-08", classification: "conditional", note: "Invasions are temporary, node-specific Star Chart missions. Access is conditional on the active node being reachable, not on a Mars-era global unlock." }]
    },
    {
        id: PR.ACTIVITY_INDEX,
        label: "The Index",
        category: "Systems",
        description: "Access The Index arena on Neptune.",
        prerequisites: [PR.JUNCTION_URANUS_NEPTUNE]
    },
    {
        id: PR.ACTIVITY_ROPALOLYST,
        label: "Ropalolyst Assassination",
        category: "Systems",
        description: "Unlock the Ropalolyst fight on Jupiter after Chimera Prologue.",
        // Chimera Prologue is only offered after The Sacrifice; that story chain
        // already requires Pluto access, which implies Jupiter access. Keep the
        // quest as the direct node gate instead of duplicating a transitive Junction.
        prerequisites: [PR.CHIMERA_PROLOGUE]
    },
    {
        id: PR.ACTIVITY_DEFECTION,
        label: "Defection Missions",
        category: "Systems",
        description: "Access Defection on Phobos, Saturn, or Neptune when the corresponding node is unlocked. Any one of those Star Chart branches is sufficient to access at least one Defection mission.",
        prerequisites: [],
        anyPrerequisites: [PR.JUNCTION_MARS_PHOBOS, PR.JUNCTION_EUROPA_SATURN, PR.JUNCTION_URANUS_NEPTUNE],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Defection", verifiedOn: "2026-11-09", classification: "required", note: "Defection missions are located at Memphis (Phobos), Caracol (Saturn), and Yursa (Neptune); any unlocked node provides a valid access route." }]
    },
    {
        id: PR.ACTIVITY_TECHNOCYTE_CODA,
        label: "Technocyte Coda System",
        category: "Systems",
        description: "Meet the prerequisites to create and pursue a Technocyte Coda: complete The Hex, reach MR5, and have no other active Adversary when generating it. Railjack access is needed only for the final Earth Proxima showdown, where joining another player's ship is valid.",
        prerequisites: [PR.THE_HEX, PR.SYSTEM_ADVERSARY_SLOT_CLEAR],
        conditions: [{ type: "mastery_rank", value: 5 }],
        evidence: [
            { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/38-5-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 38.5 states Coda generation requires main quests through The Hex and no active Kuva Lich or Sister; the Earth Proxima showdown is later and not a generation gate." },
            { kind: "wiki", url: "https://wiki.warframe.com/w/Adversary_System", verifiedOn: "2026-11-09", classification: "required", note: "The current Adversary System requirements apply Mastery Rank 5 to obtaining a Kuva Lich, Sister, or Coda." },
            { kind: "wiki", url: "https://wiki.warframe.com/w/Adversary_System", verifiedOn: "2026-11-09", classification: "required", note: "The shared Adversary slot permits only one active Lich, Sister, or Coda. A current Adversary must be defeated or converted before another one can be generated." }
        ]
    },
    // =========================================================================
    // ORBITER SEGMENTS
    // =========================================================================
    {
        id: PR.SEGMENT_PERSONAL_QUARTERS,
        label: "Orbiter: Personal Quarters Segment",
        category: "Segments",
        description: "Awarded by The War Within. Required to trigger Apostasy Prologue.",
        prerequisites: [PR.WAR_WITHIN]
    },
    {
        id: PR.SEGMENT_ARSENAL,
        showInPlanner: false,
        label: "Orbiter: Arsenal Segment",
        category: "Segments",
        description: "Base Orbiter function installed during Vor's Prize.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.SEGMENT_COMMUNICATIONS,
        showInPlanner: false,
        label: "Orbiter: Communications Segment",
        category: "Segments",
        description: "Base Orbiter communication function installed during Vor's Prize.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.SEGMENT_FOUNDRY,
        showInPlanner: false,
        label: "Orbiter: Foundry Segment",
        category: "Segments",
        description: "Base Foundry access installed during Vor's Prize.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.SEGMENT_MODDING,
        showInPlanner: false,
        label: "Orbiter: Modding Segment",
        category: "Segments",
        description: "Mod Segment installed after The Teacher; modding tutorials and mod management are introduced in that quest.",
        prerequisites: [PR.THE_TEACHER],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Teacher", verifiedOn: "2026-11-09", classification: "required", note: "The Teacher quest awards and installs the Mod Segment." }]
    },
    {
        id: PR.SEGMENT_VOID_RELIC,
        label: "Orbiter: Void Relic Segment",
        category: "Segments",
        description: "Awarded for completing the Once Awake task on the Earth → Mars Junction. Enables Relic refinement; it is not needed to crack a Relic in a Fissure.",
        prerequisites: [PR.ONCE_AWAKE],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-09", classification: "required", note: "The current Junction task rewards the Void Relic Segment for completing Once Awake, before the Junction's other tasks are all complete." }, { kind: "wiki", url: "https://wiki.warframe.com/w/Void_Relic", verifiedOn: "2026-11-09", classification: "required", note: "The Segment is used to refine Relics; equipped Relics can still be opened in Fissures without refining them." }]
    },
    {
        id: PR.SEGMENT_INCUBATOR,
        label: "Orbiter: Incubator Segment",
        category: "Segments",
        description: "Required for Kubrow and Kavat companion breeding. Awarded by completing Howl of the Kubrow.",
        prerequisites: [PR.HOWL_KUBROW]
    },
    {
        id: PR.SEGMENT_KAVAT_UPGRADE,
        showInPlanner: false,
        label: "Kavat Incubator Upgrade Segment Installed",
        category: "Segments",
        description: "Manual milestone: install the Kavat Incubator Upgrade Segment. Its blueprint can be researched in a Clan Dojo, dropped by Hyekka Masters, or purchased fully built from the Market.",
        prerequisites: [PR.SEGMENT_INCUBATOR],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Kavat", verifiedOn: "2026-11-09", classification: "required", note: "Kavat breeding requires the Kavat Incubator Upgrade Segment in addition to the base Incubator; the segment has Dojo, enemy-drop, and Market acquisition routes." }]
    },
    {
        id: PR.SEGMENT_MELEE_UPGRADE,
        label: "Orbiter: Melee Upgrade Segment",
        category: "Segments",
        description: "Unlocks Melee Exilus and Melee Arcane slots (Tennokai system). Awarded by Whispers in the Walls.",
        prerequisites: [PR.WHISPERS_WALL]
    },
    {
        id: PR.SEGMENT_HELMINTH,
        label: "Helminth Segment (Base)",
        category: "Segments",
        description: "Base Helminth subsume system. Obtain it from Son after MR8 and Entrati Rank 3, or purchase the Market bundle at MR8 without the Entrati rank gate.",
        prerequisites: [],
        anyPrerequisites: [PR.SEGMENT_HELMINTH_SON_ACCESS, PR.HELMINTH_MARKET_BUNDLE],
        conditions: [{ type: "mastery_rank", value: 8 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth", verifiedOn: "2026-11-09", classification: "required", note: "Son sells the segment at MR8 and Entrati Rank 3; the page also lists a built Helminth segment in the Market's Helminth Segments bundle, which bypasses those vendor gates. The two acquisition paths are alternatives." }]
    },
    {
        id: PR.SEGMENT_HELMINTH_SON_ACCESS,
        showInPlanner: false,
        label: "Helminth Segment: Son Purchase Available",
        category: "Segments",
        description: "Son's vendor route for the base Helminth segment requires Mastery Rank 8 and Entrati Rank 3 (Associate).",
        prerequisites: [PR.SYNDICATE_ENTRATI_RANK3],
        conditions: [{ type: "mastery_rank", value: 8 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth", verifiedOn: "2026-11-09", classification: "required", note: "Son sells the base Helminth segment blueprint for 15,000 Standing; the purchase explicitly requires MR8 and Entrati Rank 3 (Associate)." }]
    },
    {
        id: PR.HELMINTH_MARKET_BUNDLE,
        showInPlanner: false,
        label: "Helminth Segments Market Bundle Purchased",
        category: "Segments",
        description: "Manual alternative acquisition route for the built base Helminth and Invigoration segments from the Market bundle. MR8 is still required.",
        prerequisites: [],
        conditions: [{ type: "mastery_rank", value: 8 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth", verifiedOn: "2026-11-09", classification: "conditional", note: "The Helminth Segments Market bundle includes built base and Invigoration segments and bypasses Son's standing-rank requirements, but the current Market page still requires MR8 to purchase the bundle." }]
    },
    {
        id: PR.SEGMENT_HELMINTH_INVIGORATION_SON_ACCESS,
        showInPlanner: false,
        label: "Helminth Invigoration Segment: Son Purchase Available",
        category: "Segments",
        description: "Son's Invigoration Segment route requires Mastery Rank 8 and Entrati Rank 5 (Family).",
        prerequisites: [PR.SYNDICATE_ENTRATI_RANK5],
        conditions: [{ type: "mastery_rank", value: 8 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth", verifiedOn: "2026-11-09", classification: "required", note: "Son sells the Invigoration Segment blueprint for 30,000 Standing at MR8 and Entrati Rank 5 (Family)." }]
    },
    {
        id: PR.SEGMENT_HELMINTH_INVIGORATION,
        label: "Helminth Segment: Invigorations",
        category: "Segments",
        description: "Unlocks weekly Invigoration buffs. Requires the base Helminth segment plus either Son's MR8/Entrati Rank 5 purchase route or the Helminth Segments Market bundle.",
        prerequisites: [PR.SEGMENT_HELMINTH],
        anyPrerequisites: [PR.SEGMENT_HELMINTH_INVIGORATION_SON_ACCESS, PR.HELMINTH_MARKET_BUNDLE],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth", verifiedOn: "2026-11-09", classification: "required", note: "The Invigoration Segment is available from Son at MR8 and Entrati Rank 5; the Market bundle includes the built segment but still requires MR8. Both routes require the base Helminth segment to use the system." }]
    },
    {
        id: PR.SEGMENT_HELMINTH_ARCHON_SHARD,
        label: "Helminth Segment: Archon Shards",
        category: "Segments",
        description: "Unlocks Archon Shard socketing into Warframes. Blueprint rewarded by completing Veilbreaker.",
        prerequisites: [PR.SEGMENT_HELMINTH, PR.VEILBREAKER]
    },
    {
        id: PR.SEGMENT_HELMINTH_COALESCENT,
        label: "Helminth Segment: Coalescent",
        category: "Segments",
        description: "Unlocks Tauforged shard crafting. Purchased from Bird 3 (Cavia). Requires Cavia rank 2 (Researcher).",
        prerequisites: [PR.SEGMENT_HELMINTH_ARCHON_SHARD, PR.SYNDICATE_CAVIA_RANK2],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth", verifiedOn: "2026-11-09", classification: "required", note: "The Coalescent Segment is available from Bird 3 at Cavia Rank 2; that rank already implies Sanctum Anatomica access." }]
    },

    // =========================================================================
    // NECRAMECH & RAILJACK
    // =========================================================================
    {
        id: PR.NECRAMECH_UNLOCKED,
        label: "Necramech: Open-World Deployment Access",
        category: "Necramech",
        description: "Use an owned Necramech on open-world landscapes and Conjunction Survival. Requires The War Within and an acquired mech; Heart of Deimos is the Voidrig crafting route, not a universal ownership gate.",
        prerequisites: [PR.WAR_WITHIN],
        anyPrerequisites: [PR.NECRAMECH_VOIDRIG, PR.NECRAMECH_BONEWIDOW, PR.NECRAMECH_MARKET],
        evidence: [
            { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/36-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 36 gates equipping the Necramech Summon Gear on completion of The War Within." },
            { kind: "wiki", url: "https://wiki.warframe.com/w/Necramech", verifiedOn: "2026-11-09", classification: "conditional", note: "Heart of Deimos awards Voidrig blueprints, but pre-built Necramechs can also be purchased from the Market; Voidrig crafting is not a universal ownership route." }
        ]
    },
    {
        id: PR.NECRAMECH_VOIDRIG,
        showInPlanner: false,
        label: "Necramech: Voidrig Built",
        category: "Necramech",
        description: "Heart of Deimos awards the Voidrig and component blueprints. The War Within and Tactical Intrinsic Rank 5 gate deploying a built Necramech, not constructing Voidrig.",
        prerequisites: [PR.HEART_OF_DEIMOS],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Heart_of_Deimos", verifiedOn: "2026-11-09", classification: "required", note: "Heart of Deimos awards the Voidrig and component blueprints. Update 36 separately gates equipping the summon, so deployment access is not a prerequisite to building it." }]
    },
    {
        id: PR.NECRAMECH_BONEWIDOW,
        showInPlanner: false,
        label: "Necramech: Bonewidow Built",
        category: "Necramech",
        description: "The Bonewidow blueprint is sold by Necraloid at Clearance: Odima (Rank 3); this is a build/acquisition gate, separate from Necramech deployment access.",
        prerequisites: [PR.SYNDICATE_NECRALOID_RANK3],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Bonewidow", verifiedOn: "2026-11-09", classification: "required", note: "The main Bonewidow blueprint is a Necraloid Rank 3 offering. Tactical Intrinsic Rank 5 and The War Within restrict use of a built Necramech, not access to this blueprint." }]
    },
    {
        id: PR.NECRAMECH_MARKET,
        showInPlanner: false,
        label: "Pre-Built Necramech Acquired from Market",
        category: "Necramech",
        description: "Manual acquisition alternative: a pre-built Necramech can be purchased from the Market instead of crafting Voidrig or Bonewidow.",
        prerequisites: [],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Necramech", verifiedOn: "2026-11-09", classification: "conditional", note: "Pre-built Necramechs are sold from the Market; this bypasses the Heart of Deimos/Necraloid crafting routes but not The War Within deployment gate." }]
    },
    {
        id: PR.NECRAMECH_RAILJACK_DEPLOYMENT,
        showInPlanner: false,
        label: "Necramech: Railjack Deployment Access",
        category: "Necramech",
        description: "Deploy an owned Necramech in the grounded portions of Railjack missions. Tactical Intrinsic Rank 5 is only required for this route, not for open-world deployment.",
        prerequisites: [PR.NECRAMECH_UNLOCKED, PR.SYSTEM_PROXIMA_ACCESS],
        conditions: [{ type: "railjack_intrinsic_rank", rank: 5, skillId: "LPS_TACTICAL" }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Necramech", verifiedOn: "2026-11-09", classification: "required", note: "Tactical Intrinsic Rank 5 unlocks Necramech summoning in grounded Empyrean/Railjack missions. Open-world summon access has no Tactical Rank 5 requirement." }]
    },
    {
        id: PR.RAILJACK_CONSTRUCTED,
        label: "Railjack: Ship Constructed",
        category: "Railjack",
        description: "Your Railjack is built and ready for missions. This is one way to satisfy the owned-Railjack requirement for The New War and Kuva Lich creation.",
        prerequisites: [PR.RISING_TIDE],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Rising_Tide", verifiedOn: "2026-11-09", classification: "required", note: "Completing Rising Tide constructs the player's Railjack and unlocks Railjack ownership through the quest path." }]
    },
    {
        id: PR.RAILJACK_MARKET_ACQUIRED,
        showInPlanner: false,
        label: "Railjack Purchased from the Market",
        category: "Railjack",
        description: "Manual ownership alternative: purchasing a Railjack from the Market satisfies owned-Railjack checks without completing Rising Tide.",
        prerequisites: [],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_New_War", verifiedOn: "2026-11-09", classification: "conditional", note: "The New War accepts an owned Railjack obtained from Rising Tide or purchased with Platinum; the purchase path bypasses Rising Tide for the ownership check." }]
    },
    {
        id: PR.SYSTEM_PROXIMA_ACCESS,
        label: "Empyrean Proxima Access",
        category: "Railjack",
        description: "After The Archwing, join public Empyrean missions in Earth or Venus Proxima. Completing Rising Tide lets you launch missions with your own Railjack.",
        prerequisites: [PR.ARCHWING],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Empyrean", verifiedOn: "2026-11-09", classification: "required", note: "Empyrean access opens after The Archwing for joining public missions; an owned Railjack from Rising Tide is required only to start a mission yourself." }]
    },
    {
        id: PR.SYSTEM_PROXIMA_SATURN_ACCESS,
        label: "Saturn Proxima Access",
        category: "Railjack",
        description: "Unlock Saturn Proxima after reaching Rank 3 in any Railjack Intrinsic.",
        prerequisites: [PR.SYSTEM_PROXIMA_ACCESS],
        conditions: [{ type: "railjack_intrinsic_rank", rank: 3 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Empyrean", verifiedOn: "2026-11-09", classification: "required", note: "Current Empyrean region access requires any Railjack Intrinsic at Rank 3 for Saturn Proxima." }]
    },
    {
        id: PR.SYSTEM_PROXIMA_NEPTUNE_ACCESS,
        label: "Neptune Proxima Access",
        category: "Railjack",
        description: "Unlock Neptune Proxima after reaching Rank 3 in any Railjack Intrinsic.",
        prerequisites: [PR.SYSTEM_PROXIMA_ACCESS],
        conditions: [{ type: "railjack_intrinsic_rank", rank: 3 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Empyrean", verifiedOn: "2026-11-09", classification: "required", note: "Current Empyrean region access requires any Railjack Intrinsic at Rank 3 for Neptune Proxima." }]
    },
    {
        id: PR.SYSTEM_PROXIMA_PLUTO_ACCESS,
        label: "Pluto Proxima Access",
        category: "Railjack",
        description: "Unlock Pluto Proxima after reaching Rank 5 in any Railjack Intrinsic.",
        prerequisites: [PR.SYSTEM_PROXIMA_ACCESS],
        conditions: [{ type: "railjack_intrinsic_rank", rank: 5 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Empyrean", verifiedOn: "2026-11-09", classification: "required", note: "Current Empyrean region access requires any Railjack Intrinsic at Rank 5 for Pluto Proxima." }]
    },
    {
        id: PR.SYSTEM_PROXIMA_VEIL_ACCESS,
        label: "Veil Proxima Access",
        category: "Railjack",
        description: "Unlock Veil Proxima after reaching Rank 7 in any Railjack Intrinsic.",
        prerequisites: [PR.SYSTEM_PROXIMA_ACCESS],
        conditions: [{ type: "railjack_intrinsic_rank", rank: 7 }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Empyrean", verifiedOn: "2026-11-09", classification: "required", note: "Current Empyrean region access requires any Railjack Intrinsic at Rank 7 for Veil Proxima." }]
    },
    {
        id: PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS,
        label: "Railjack Armaments Acquisition Access",
        category: "Railjack",
        description: "Access Sigma armament research through a Clan Dojo Dry Dock, or acquire and repair salvaged armaments in Proxima missions. Either route is sufficient.",
        prerequisites: [],
        anyPrerequisites: [PR.CLAN_DRY_DOCK, PR.SYSTEM_PROXIMA_ACCESS],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Railjack", verifiedOn: "2026-11-09", classification: "required", note: "Railjack armaments have two acquisition routes: Sigma blueprints from Dojo research or salvaged armaments from Empyrean missions; these alternatives are represented as OR." }]
    },
    {
        id: PR.RAILJACK_INTRINSICS,
        showInPlanner: false,
        label: "Railjack: Intrinsics Unlocked",
        category: "Railjack",
        description: "Access the Railjack Intrinsics tree after completing your first Railjack mission.",
        prerequisites: [PR.ARCHWING],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Empyrean", verifiedOn: "2026-11-09", classification: "required", note: "After The Archwing, a player can join Empyrean missions hosted by another player; this is enough to start earning Intrinsic progress without owning a Railjack." }]
    },
    {
        id: PR.RAILJACK_CORPUS_NODES,
        showInPlanner: false,
        label: "Railjack: Corpus Proxima Access",
        category: "Railjack",
        description: "Unlock Corpus Proxima Railjack nodes after Call of the Tempestarii.",
        prerequisites: [PR.CALL_TEMPESTARII]
    },
    {
        id: PR.RAILJACK_VOID_STORMS,
        showInPlanner: false,
        label: "Railjack: Void Storm Access",
        category: "Railjack",
        description: "Compatibility alias for general Void Storm access; Corpus Proxima is not required to join a Void Storm on another player's Railjack.",
        prerequisites: [PR.ACTIVITY_VOID_STORMS],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/30-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Void Storms are Empyrean Fissures and are available in eligible Proxima regions; Call of the Tempestarii is not a universal player access requirement." }]
    },
    {
        id: PR.SYSTEM_ONKKO_VISITED,
        label: "Visited Quill Onkko",
        category: "Systems",
        description: "Visit Onkko in Cetus after The War Within. This is the current access requirement for Chains of Harrow; Update 39 removed Saya's Vigil from the route to Cetus and the Mote Amp.",
        prerequisites: [PR.WAR_WITHIN, PR.HUB_CETUS],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/35-5-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 35.5 made visiting Onkko in Cetus the Chains of Harrow gate."
        }, {
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 allows visiting Cetus without Saya's Vigil and removes Saya's Vigil as a requirement to receive the Mote Amp from Onkko."
        }]
    },
    {
        id: PR.AMP_MOTE,
        label: "Mote Amp Owned",
        category: "Systems",
        description: "Track the specific Mote Amp, the standard first Amp given by Onkko after The War Within. Any Amp satisfies The New War's separate Operator Amp requirement. Saya's Vigil is not required.",
        prerequisites: [PR.SYSTEM_ONKKO_VISITED],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 explicitly removed Saya's Vigil as a requirement to receive the Mote Amp from Onkko."
        }, {
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/33-5-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 33.5 confirms an Operator Amp is required to start The New War."
        }]
    },
    {
        id: PR.SYSTEM_OPERATOR_AMP,
        label: "Operator Amp Owned",
        category: "Systems",
        description: "Own any Operator Amp to meet The New War's equipment requirement. The Mote Amp is one valid option; a stronger Amp is optional.",
        prerequisites: [],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/33-5-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 33.5 says an Operator Amp must be obtained to begin The New War; it does not specify the Mote Amp model."
        }, {
            kind: "wiki",
            url: "https://wiki.warframe.com/w/The_New_War",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "The current quest requirements list owning an Amp, rather than a specific Amp model."
        }]
    },
    {
        id: PR.SYSTEM_RANK30_WARFRAME,
        label: "Sortie / Arbitration Warframe Eligibility",
        category: "Systems",
        description: "Have a Rank 30 Warframe available, or be Mastery Rank 30 and use a Forma-polarized Warframe. This is a manual check because the current profile and inventory models do not expose Warframe rank/forma state.",
        prerequisites: [],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Sortie", verifiedOn: "2026-11-08", classification: "required", note: "Sortie missions require a Rank 30 Warframe, with a bypass for MR30 players using a Forma-polarized Warframe." }, { kind: "wiki", url: "https://wiki.warframe.com/w/Arbitrations", verifiedOn: "2026-11-08", classification: "required", note: "Arbitrations have the same Rank 30 Warframe requirement and MR30 Forma exception." }]
    },
    {
        id: PR.SYSTEM_ADVERSARY_SLOT_CLEAR,
        label: "Adversary Slot Clear",
        category: "Systems",
        description: "Manual, dynamic check: keep this complete only while you have no active Kuva Lich, Sister of Parvos, or Technocyte Coda. Clear it as soon as you generate an Adversary and mark it complete again after that Adversary is defeated or converted. This state is not exposed by imported profiles.",
        prerequisites: [],
        evidence: [{
            kind: "wiki",
            url: "https://wiki.warframe.com/w/Adversary_System",
            verifiedOn: "2026-11-09",
            classification: "required",
            note: "The game allows only one active Adversary at a time; the slot becomes available again after the current Lich, Sister, or Coda is resolved."
        }]
    },
    {
        id: PR.FOCUS_UNLOCKED,
        showInPlanner: false,
        label: "Focus System Unlocked",
        category: "Systems",
        description: "Unlock the Focus system by completing The Second Dream.",
        prerequisites: [PR.SECOND_DREAM]
    },
    {
        id: PR.FOCUS_FULL,
        showInPlanner: false,
        label: "Focus Schools Fully Accessible",
        category: "Systems",
        description: "Unlock the standard Focus abilities after completing The War Within and Saya's Vigil, then visiting The Quills. Quills Rank 1 is not required. Tauron Strike access is tracked separately because it requires a Tektolyst Artifact.",
        prerequisites: [PR.SYSTEM_ONKKO_VISITED, PR.SAYA_VIGIL],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Focus", verifiedOn: "2026-11-09", classification: "required", note: "The current Focus reference says the remaining Focus abilities require The War Within, Saya's Vigil, and visiting The Quills; the War Within prerequisite is already implied by the tracked Quills visit." }]
    },
    {
        id: PR.FOCUS_SCHOOL_ZENURIK,
        showInPlanner: false,
        label: "Focus School: Zenurik",
        category: "Systems",
        description: "Choose Zenurik as the free starting school after The Second Dream, or unlock it later by spending 50,000 Focus. Mark complete only after this school is unlocked; school selection and unlock state are manual because profile import does not expose them.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_VAZARIN,
        showInPlanner: false,
        label: "Focus School: Vazarin",
        category: "Systems",
        description: "Choose Vazarin as the free starting school after The Second Dream, or unlock it later by spending 50,000 Focus. Mark complete only after this school is unlocked; school selection and unlock state are manual because profile import does not expose them.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_NARAMON,
        showInPlanner: false,
        label: "Focus School: Naramon",
        category: "Systems",
        description: "Choose Naramon as the free starting school after The Second Dream, or unlock it later by spending 50,000 Focus. Mark complete only after this school is unlocked; school selection and unlock state are manual because profile import does not expose them.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_UNAIRU,
        showInPlanner: false,
        label: "Focus School: Unairu",
        category: "Systems",
        description: "Choose Unairu as the free starting school after The Second Dream, or unlock it later by spending 50,000 Focus. Mark complete only after this school is unlocked; school selection and unlock state are manual because profile import does not expose them.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_MADURAI,
        showInPlanner: false,
        label: "Focus School: Madurai",
        category: "Systems",
        description: "Choose Madurai as the free starting school after The Second Dream, or unlock it later by spending 50,000 Focus. Mark complete only after this school is unlocked; school selection and unlock state are manual because profile import does not expose them.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.SYSTEM_TAURON_STRIKE,
        label: "Tauron Strike Unlocked",
        category: "Systems",
        description: "Acquire a Tektolyst Artifact for an unlocked Focus School from Marie in La Cathédrale. The Old Peace opens the vendor; resources are awarded by its quest and the matching Perita Rebellion final encounters, or supplied by the one-time Market acquisition pack. Mark this manual milestone complete after acquiring an Artifact; owning it unlocks that school's Tauron Strike outside Perita Rebellion.",
        prerequisites: [PR.THE_OLD_PEACE],
        anyPrerequisites: [
            PR.FOCUS_SCHOOL_MADURAI,
            PR.FOCUS_SCHOOL_NARAMON,
            PR.FOCUS_SCHOOL_UNAIRU,
            PR.FOCUS_SCHOOL_VAZARIN,
            PR.FOCUS_SCHOOL_ZENURIK,
        ],
        introducedIn: "Update 41 (December 10, 2025)",
        evidence: [
            { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 41 says an Artifact must be acquired to access its Tauron Strike, the school must already be unlocked, and Marie sells Artifacts in La Cathédrale; The Old Peace unlocks that hub. The one-time Market pack supplies the resources but does not replace the Marie purchase." },
            { kind: "wiki", url: "https://wiki.warframe.com/w/Focus", verifiedOn: "2026-11-09", classification: "required", note: "The current Focus reference states that each school's Tauron Strike requires its Tektolyst Artifact, which is acquired after The Old Peace from Marie in La Cathédrale; owning the Artifact unlocks the Strike outside The Perita Rebellion." },
        ]
    },
    {
        id: PR.AMP_SIROCCO,
        showInPlanner: false,
        label: "Operator: Sirocco Acquired",
        category: "Systems",
        description: "Receive the built Sirocco Amp from The New War.",
        prerequisites: [PR.NEW_WAR]
    },
    {
        id: PR.AMP_TIER1,
        showInPlanner: false,
        label: "Amp Parts: Tier 1",
        category: "Systems",
        description: "Unlock Tier 1 Amp parts from The Quills.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK1]
    },
    {
        id: PR.AMP_TIER2,
        showInPlanner: false,
        label: "Amp Parts: Tier 2",
        category: "Systems",
        description: "Unlock Tier 2 Amp parts from The Quills.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK2]
    },
    {
        id: PR.AMP_TIER3,
        showInPlanner: false,
        label: "Amp Parts: Tier 3",
        category: "Systems",
        description: "Unlock Tier 3 Amp parts from The Quills.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK3]
    },
    {
        id: PR.AMP_TIER4,
        showInPlanner: false,
        label: "Amp Parts: Tier 4",
        category: "Systems",
        description: "Unlock Tier 4 Amp parts from The Quills.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK4]
    },
    {
        id: PR.AMP_TIER5,
        showInPlanner: false,
        label: "Amp Parts: Tier 5",
        category: "Systems",
        description: "Unlock Tier 5 Amp parts from Vox Solaris.",
        prerequisites: [PR.SYNDICATE_VOX_RANK1]
    },
    {
        id: PR.AMP_TIER6,
        showInPlanner: false,
        label: "Amp Parts: Tier 6",
        category: "Systems",
        description: "Unlock Tier 6 Amp parts from Vox Solaris.",
        prerequisites: [PR.SYNDICATE_VOX_RANK2]
    },
    {
        id: PR.AMP_TIER7,
        showInPlanner: false,
        label: "Amp Parts: Tier 7",
        category: "Systems",
        description: "Unlock Tier 7 Amp parts from Vox Solaris.",
        prerequisites: [PR.SYNDICATE_VOX_RANK3]
    },
    {
        id: PR.AMP_GILDING,
        showInPlanner: false,
        label: "Amp Gilding Unlocked",
        category: "Systems",
        description: "Unlock Amp gilding through advanced Quills or Vox Solaris rank progression.",
        prerequisites: [],
        anyPrerequisites: [PR.SYNDICATE_QUILLS_RANK3, PR.SYNDICATE_VOX_RANK3],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Amp", verifiedOn: "2026-11-08", classification: "required", note: "Amp gilding becomes available at The Quills rank Adherent or Vox Solaris rank Hand; either vendor route qualifies." }]
    },
    {
        id: PR.COMPANION_KUBROW,
        showInPlanner: false,
        label: "Kubrow Breeding",
        category: "Systems",
        description: "Unlock Kubrow breeding after obtaining the Incubator Segment, which is awarded by Howl of the Kubrow.",
        prerequisites: [PR.SEGMENT_INCUBATOR],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Howl_of_the_Kubrow", verifiedOn: "2026-11-09", classification: "required", note: "Howl of the Kubrow awards the Incubator Segment; the Segment is the direct system gate for Kubrow breeding." }]
    },
    {
        id: PR.COMPANION_KAVAT,
        showInPlanner: false,
        label: "Kavat Breeding",
        category: "Systems",
        description: "Kavat breeding uses the Orbiter Incubator and Kavat Upgrade Segment. Genetic Codes can be scanned from Feral Kavats on Deimos or purchased; Heart of Deimos is not a hard gate.",
        prerequisites: [PR.SEGMENT_KAVAT_UPGRADE],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Kavat", verifiedOn: "2026-11-09", classification: "required", note: "Kavat incubation requires the Incubator and Kavat Incubator Upgrade Segment. Genetic Codes are obtainable from Feral Kavats on Deimos, but the codes and segment also have Market acquisition paths, so Heart of Deimos/Deimos access is not a mandatory gate." }]
    },
    {
        id: PR.COMPANION_MATURE_CYST,
        showInPlanner: false,
        label: "Mature Helminth Cyst Available",
        category: "Systems",
        description: "Manual, dynamic milestone: have a mature Helminth Cyst on an eligible Warframe. Nidus or another infected player can transmit it; it matures over time.",
        prerequisites: [],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth_Charger", verifiedOn: "2026-11-09", classification: "required", note: "Helminth Charger incubation requires a mature cyst; infection can be received from Nidus or another player and the cyst needs time to mature." }]
    },
    {
        id: PR.COMPANION_HELMINTH_CHARGER,
        showInPlanner: false,
        label: "Helminth Charger Companion",
        category: "Systems",
        description: "Incubate a Helminth Charger with the Orbiter Incubator and a mature Helminth Cyst. A cyst can come from Nidus or another infected player; the Helminth Segment is not required.",
        prerequisites: [PR.SEGMENT_INCUBATOR, PR.COMPANION_MATURE_CYST],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Helminth_Charger", verifiedOn: "2026-11-09", classification: "required", note: "Howl of the Kubrow supplies the operating Incubator. The Charger requires a mature cyst, which can spread from another player; the Helminth Segment only unlocks the ability-replacement system and is not a Charger breeding gate." }]
    },
    {
        id: PR.COMPANION_MOA,
        showInPlanner: false,
        label: "MOA Companion Assembly",
        category: "Systems",
        description: "Unlock MOA companion assembly in Fortuna after completing Vox Solaris.",
        prerequisites: [PR.VOX_SOLARIS]
    },
    {
        id: PR.COMPANION_HOUND,
        showInPlanner: false,
        label: "Hound Companion Reward",
        category: "Systems",
        description: "Track the Hound companion rewarded for vanquishing a Sister of Parvos.",
        prerequisites: [PR.ACTIVITY_SISTER_VANQUISHED],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Hound", verifiedOn: "2026-11-09", classification: "required", note: "The current Hound page identifies the player companion as the Sister's Hound reward after vanquishing her." }]
    },
    {
        id: PR.COMPANION_PREDASITE,
        showInPlanner: false,
        label: "Predasite Companion Access",
        category: "Systems",
        description: "Unlock Predasite companions through Deimos companion conservation and revivification.",
        prerequisites: [PR.HUB_NECRALISK]
    },
    {
        id: PR.COMPANION_VULPAPHYLA,
        showInPlanner: false,
        label: "Vulpaphyla Companion Access",
        category: "Systems",
        description: "Unlock Vulpaphyla companions through Deimos companion conservation and revivification.",
        prerequisites: [PR.HUB_NECRALISK]
    },
    {
        id: PR.COMPANION_NAUTILUS,
        showInPlanner: false,
        label: "Nautilus Companion Access",
        category: "Systems",
        description: "Nautilus blueprints drop from Neptune Proxima points of interest and Arva Vector Defense. This tracks the mission reward route; Market purchase and player trading can bypass that route.",
        prerequisites: [PR.SYSTEM_PROXIMA_NEPTUNE_ACCESS, PR.RAILJACK_CORPUS_NODES],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Nautilus", verifiedOn: "2026-11-09", classification: "conditional", note: "The mission reward path is limited to Neptune Proxima POIs and Arva Vector Defense, so it requires Neptune Proxima and Corpus Proxima access. The blueprint/components are also available through Market purchase/player trade; those are alternate acquisition routes, not prerequisites for the mission path." }]
    },

    // =========================================================================
    // SYNDICATE RANK MILESTONES (only ranks that gate Orbiter segments)
    // =========================================================================
    {
        id: PR.SYNDICATE_QUILLS_RANK1,
        validatedBySyndicate: { syndicateId: SY.THE_QUILLS, rank: 1 },
        label: "The Quills: Rank 1 (Mote)",
        category: "Syndicates",
        description: "Unlocks the first Quills standing tier and basic Amp progression used for early Eidolon hunting.",
        prerequisites: [PR.SYSTEM_ONKKO_VISITED],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 removed Saya's Vigil from access to Cetus and receiving the Mote Amp; The War Within remains the Quills/Operator access gate."
        }]
    },
    {
        id: PR.SYNDICATE_QUILLS_RANK2,
        validatedBySyndicate: { syndicateId: SY.THE_QUILLS, rank: 2 },
        label: "The Quills: Rank 2 (Observer)",
        category: "Syndicates",
        description: "Unlocks higher-tier Quills offerings, including stronger Amp progression and gilding access.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK1],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Quills", verifiedOn: "2026-11-08", classification: "required", note: "The Quills rank progression lists Observer as rank 2 after Mote." }]
    },
    {
        id: PR.SYNDICATE_QUILLS_RANK3,
        validatedBySyndicate: { syndicateId: SY.THE_QUILLS, rank: 3 },
        label: "The Quills: Rank 3 (Adherent)",
        category: "Syndicates",
        description: "Unlocks mid-tier Quills Amp offerings from Onkko.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK2],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Quills", verifiedOn: "2026-11-08", classification: "required", note: "The Quills rank progression lists Adherent as rank 3 after Observer." }]
    },
    {
        id: PR.SYNDICATE_QUILLS_RANK4,
        validatedBySyndicate: { syndicateId: SY.THE_QUILLS, rank: 4 },
        label: "The Quills: Rank 4 (Instrument)",
        category: "Syndicates",
        description: "Unlocks higher-tier Quills Amp offerings from Onkko.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK3],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Quills", verifiedOn: "2026-11-08", classification: "required", note: "The Quills rank progression lists Instrument as rank 4 after Adherent." }]
    },
    {
        id: PR.SYNDICATE_QUILLS_RANK5,
        validatedBySyndicate: { syndicateId: SY.THE_QUILLS, rank: 5 },
        label: "The Quills: Rank 5 (Architect)",
        category: "Syndicates",
        description: "The final Quills standing rank; unlocks Architect-ranked vendor offerings.",
        prerequisites: [PR.SYNDICATE_QUILLS_RANK4],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Quills", verifiedOn: "2026-11-08", classification: "required", note: "The Quills progression has five ranks, with Architect as the final rank." }]
    },
    {
        id: PR.SYNDICATE_HOLDFASTS_RANK1,
        validatedBySyndicate: { syndicateId: SY.THE_HOLDFASTS, rank: 1 },
        label: "The Holdfasts: Rank 1 (Fallen)",
        category: "Syndicates",
        description: "Unlocks the first Holdfasts standing tier in the Chrysalith.",
        prerequisites: [PR.HUB_ZARIMAN]
    },
    {
        id: PR.SYNDICATE_HOLDFASTS_RANK2,
        validatedBySyndicate: { syndicateId: SY.THE_HOLDFASTS, rank: 2 },
        label: "The Holdfasts: Rank 2 (Watcher)",
        category: "Syndicates",
        description: "Unlocks additional Holdfasts vendor stock in the Chrysalith.",
        prerequisites: [PR.SYNDICATE_HOLDFASTS_RANK1]
    },
    {
        id: PR.SYNDICATE_HOLDFASTS_RANK3,
        validatedBySyndicate: { syndicateId: SY.THE_HOLDFASTS, rank: 3 },
        label: "The Holdfasts: Rank 3 (Guardian)",
        category: "Syndicates",
        description: "Unlocks mid-tier Holdfasts vendor stock in the Chrysalith.",
        prerequisites: [PR.SYNDICATE_HOLDFASTS_RANK2]
    },
    {
        id: PR.SYNDICATE_HOLDFASTS_RANK4,
        validatedBySyndicate: { syndicateId: SY.THE_HOLDFASTS, rank: 4 },
        label: "The Holdfasts: Rank 4 (Seraph)",
        category: "Syndicates",
        description: "Unlocks advanced Holdfasts vendor stock in the Chrysalith.",
        prerequisites: [PR.SYNDICATE_HOLDFASTS_RANK3]
    },
    {
        id: PR.SYNDICATE_HOLDFASTS_RANK5,
        validatedBySyndicate: { syndicateId: SY.THE_HOLDFASTS, rank: 5 },
        label: "The Holdfasts: Rank 5 (Angel)",
        category: "Syndicates",
        description: "Unlocks the final Holdfasts standing tier and full Chrysalith vendor stock.",
        prerequisites: [PR.SYNDICATE_HOLDFASTS_RANK4]
    },
    {
        id: PR.SYNDICATE_SOLARIS_RANK1,
        validatedBySyndicate: { syndicateId: SY.SOLARIS_UNITED, rank: 1 },
        label: "Solaris United: Rank 1 (Outworlder)",
        category: "Syndicates",
        description: "First Solaris United standing rank after completing Vox Solaris and gaining access to Vallis bounties.",
        prerequisites: [PR.VOX_SOLARIS],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Solaris_United", verifiedOn: "2026-11-09", classification: "required", note: "Solaris United standing ranks begin with Outworlder after access to the Fortuna/Vallis bounty loop; the Vox Solaris quest opens the player's Vallis progression." }]
    },
    {
        id: PR.SYNDICATE_SOLARIS_RANK2,
        validatedBySyndicate: { syndicateId: SY.SOLARIS_UNITED, rank: 2 },
        label: "Solaris United: Rank 2 (Rapscallion)",
        category: "Syndicates",
        description: "Solaris United Rank 2 (Rapscallion).",
        prerequisites: [PR.SYNDICATE_SOLARIS_RANK1],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Solaris_United", verifiedOn: "2026-11-09", classification: "required", note: "Solaris United standing advances from Rank 1 Outworlder to Rank 2 Rapscallion." }]
    },
    {
        id: PR.SYNDICATE_SOLARIS_RANK3,
        validatedBySyndicate: { syndicateId: SY.SOLARIS_UNITED, rank: 3 },
        label: "Solaris United: Rank 3 (Doer)",
        category: "Syndicates",
        description: "Solaris United Rank 3 (Doer).",
        prerequisites: [PR.SYNDICATE_SOLARIS_RANK2],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Solaris_United", verifiedOn: "2026-11-09", classification: "required", note: "Solaris United standing advances from Rank 2 Rapscallion to Rank 3 Doer." }]
    },
    {
        id: PR.SYNDICATE_SOLARIS_RANK4,
        validatedBySyndicate: { syndicateId: SY.SOLARIS_UNITED, rank: 4 },
        label: "Solaris United: Rank 4 (Cove)",
        category: "Syndicates",
        description: "Solaris United Rank 4 (Cove).",
        prerequisites: [PR.SYNDICATE_SOLARIS_RANK3],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Solaris_United", verifiedOn: "2026-11-09", classification: "required", note: "Solaris United standing advances from Rank 3 Doer to Rank 4 Cove." }]
    },
    {
        id: PR.SYNDICATE_SOLARIS_RANK5,
        validatedBySyndicate: { syndicateId: SY.SOLARIS_UNITED, rank: 5 },
        label: "Solaris United: Rank 5 (Old Mate)",
        category: "Syndicates",
        description: "Maximum Solaris United rank. Required to start Orb Vallis heists such as Profit-Taker and Exploiter.",
        prerequisites: [PR.SYNDICATE_SOLARIS_RANK4],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Solaris_United", verifiedOn: "2026-11-09", classification: "required", note: "Old Mate is Solaris United Rank 5 and follows Rank 4 Cove. It is required to access Profit-Taker and other Heists." }]
    },
    {
        id: PR.SYNDICATE_VOX_RANK1,
        validatedBySyndicate: { syndicateId: SY.VOX_SOLARIS, rank: 1 },
        showInPlanner: false,
        label: "Vox Solaris: Rank 1 (Operative)",
        category: "Syndicates",
        description: "Unlock the first Little Duck standing tier and early Vox Amp parts.",
        prerequisites: [PR.VOX_SOLARIS, PR.SYSTEM_ONKKO_VISITED],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29", verifiedOn: "2026-11-08", classification: "required", note: "Vox Solaris syndicate access requires the Vox Solaris quest, The War Within, and speaking with Onkko at least once; the Onkko milestone already carries The War Within and Cetus access." }]
    },
    {
        id: PR.SYNDICATE_VOX_RANK2,
        validatedBySyndicate: { syndicateId: SY.VOX_SOLARIS, rank: 2 },
        showInPlanner: false,
        label: "Vox Solaris: Rank 2 (Agent)",
        category: "Syndicates",
        description: "Unlock additional Little Duck offerings and Tier 6 Amp parts.",
        prerequisites: [PR.SYNDICATE_VOX_RANK1],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29", verifiedOn: "2026-11-08", classification: "required", note: "Vox Solaris standing advances in order from Operative to Agent." }]
    },
    {
        id: PR.SYNDICATE_VOX_RANK3,
        validatedBySyndicate: { syndicateId: SY.VOX_SOLARIS, rank: 3 },
        showInPlanner: false,
        label: "Vox Solaris: Rank 3 (Hand)",
        category: "Syndicates",
        description: "Unlock advanced Little Duck offerings, Tier 7 Amp parts, and Amp gilding.",
        prerequisites: [PR.SYNDICATE_VOX_RANK2],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29", verifiedOn: "2026-11-08", classification: "required", note: "Vox Solaris standing advances in order from Agent to Hand." }]
    },
    {
        id: PR.SYNDICATE_VOX_RANK4,
        validatedBySyndicate: { syndicateId: SY.VOX_SOLARIS, rank: 4 },
        showInPlanner: false,
        label: "Vox Solaris: Rank 4 (Instrument)",
        category: "Syndicates",
        description: "Unlock Rank 4 Little Duck offerings and the Instrument standing tier.",
        prerequisites: [PR.SYNDICATE_VOX_RANK3],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29", verifiedOn: "2026-11-08", classification: "required", note: "The Vox Solaris standing list includes Instrument as Rank 4 between Hand and Shadow." }]
    },
    {
        id: PR.SYNDICATE_VOX_RANK5,
        validatedBySyndicate: { syndicateId: SY.VOX_SOLARIS, rank: 5 },
        label: "Vox Solaris: Rank 5 (Shadow)",
        category: "Syndicates",
        description: "Maximum Vox Solaris rank. Unlocks top-tier Little Duck offerings.",
        prerequisites: [PR.SYNDICATE_VOX_RANK4],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29", verifiedOn: "2026-11-08", classification: "required", note: "Vox Solaris standing advances from Instrument Rank 4 to Shadow Rank 5." }]
    },
    {
        id: PR.SYNDICATE_ENTRATI_RANK1,
        validatedBySyndicate: { syndicateId: SY.ENTRATI, rank: 1 },
        label: "Entrati: Rank 1 (Stranger)",
        category: "Syndicates",
        description: "First Entrati standing rank in the Necralisk.",
        prerequisites: [PR.HUB_NECRALISK],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Entrati", verifiedOn: "2026-11-09", classification: "required", note: "Stranger is Entrati Rank 1 and is available after access to the Necralisk syndicate." }]
    },
    {
        id: PR.SYNDICATE_ENTRATI_RANK2,
        validatedBySyndicate: { syndicateId: SY.ENTRATI, rank: 2 },
        label: "Entrati: Rank 2 (Acquaintance)",
        category: "Syndicates",
        description: "Entrati Rank 2 (Acquaintance).",
        prerequisites: [PR.SYNDICATE_ENTRATI_RANK1],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Entrati", verifiedOn: "2026-11-09", classification: "required", note: "Entrati standing advances from Rank 1 Stranger to Rank 2 Acquaintance." }]
    },
    {
        id: PR.SYNDICATE_ENTRATI_RANK3,
        validatedBySyndicate: { syndicateId: SY.ENTRATI, rank: 3 },
        label: "Entrati: Rank 3 (Associate)",
        category: "Syndicates",
        description: "Entrati standing rank 3 (Associate). The Helminth Segment itself additionally requires MR8.",
        prerequisites: [PR.SYNDICATE_ENTRATI_RANK2],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Entrati", verifiedOn: "2026-11-08", classification: "required", note: "Associate is Entrati rank 3. Current rank-up sacrifices do not include a mastery-rank requirement; MR8 is a separate Helminth Segment purchase gate." }, { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-3", verifiedOn: "2026-11-08", classification: "historical", note: "Update 41.0.3 fixed an accidental MR9 restriction caused by an earlier Keratinos Blueprint sacrifice; current rank-up sacrifices were revised." }]
    },
    {
        id: PR.SYNDICATE_ENTRATI_RANK4,
        validatedBySyndicate: { syndicateId: SY.ENTRATI, rank: 4 },
        label: "Entrati: Rank 4 (Friend)",
        category: "Syndicates",
        description: "Entrati standing rank 4 (Friend), between Associate and Family.",
        prerequisites: [PR.SYNDICATE_ENTRATI_RANK3],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Entrati", verifiedOn: "2026-11-08", classification: "required", note: "The Entrati syndicate ranks progress from Associate (rank 3) to Friend (rank 4), then Family (rank 5)." }]
    },
    {
        id: PR.SYNDICATE_ENTRATI_RANK5,
        validatedBySyndicate: { syndicateId: SY.ENTRATI, rank: 5 },
        label: "Entrati: Rank 5 (Family)",
        category: "Syndicates",
        description: "Entrati standing rank 5 (Family). The Helminth Invigoration Segment itself additionally requires MR8.",
        prerequisites: [PR.SYNDICATE_ENTRATI_RANK4],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Entrati", verifiedOn: "2026-11-08", classification: "required", note: "Family is Entrati rank 5. The MR8 requirement applies to the separate Invigoration Segment purchase, not reaching this syndicate rank." }, { kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/41-0-3", verifiedOn: "2026-11-08", classification: "historical", note: "Update 41.0.3 corrected an accidental MR9 gate from an earlier Keratinos Blueprint sacrifice; the current system does not use MR8 as a rank threshold." }]
    },
    {
        id: PR.SYNDICATE_NECRALOID_RANK1,
        validatedBySyndicate: { syndicateId: SY.NECRALOID, rank: 1 },
        label: "Necraloid: Rank 1 (Clearance: Agnesis)",
        category: "Syndicates",
        description: "First Necraloid standing rank. Access Loid after Heart of Deimos and The War Within.",
        prerequisites: [PR.HUB_NECRALISK, PR.WAR_WITHIN],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Necraloid", verifiedOn: "2026-11-09", classification: "required", note: "Necraloid ranks are available through Loid in the Necralisk after the Necraloid service is unlocked; Heart of Deimos opens the Necralisk and The War Within unlocks Operator access to Loid." }]
    },
    {
        id: PR.SYNDICATE_NECRALOID_RANK2,
        validatedBySyndicate: { syndicateId: SY.NECRALOID, rank: 2 },
        label: "Necraloid: Rank 2 (Clearance: Modus)",
        category: "Syndicates",
        description: "Necraloid Rank 2 (Clearance: Modus).",
        prerequisites: [PR.SYNDICATE_NECRALOID_RANK1],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Necraloid", verifiedOn: "2026-11-09", classification: "required", note: "Clearance: Modus is Necraloid Rank 2 and is reached from Rank 1 (Clearance: Agnesis)." }]
    },
    {
        id: PR.SYNDICATE_NECRALOID_RANK3,
        validatedBySyndicate: { syndicateId: SY.NECRALOID, rank: 3 },
        label: "Necraloid: Rank 3 (Clearance: Odima)",
        category: "Syndicates",
        description: "Necraloid Rank 3 (Clearance: Odima). Unlocks the non-tradeable Bonewidow main blueprint.",
        prerequisites: [PR.SYNDICATE_NECRALOID_RANK2],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Necraloid", verifiedOn: "2026-11-09", classification: "required", note: "Clearance: Odima is Necraloid Rank 3; the Bonewidow main blueprint is a Rank 3 offering and is not tradeable." }]
    },
    {
        id: PR.SYNDICATE_CAVIA_RANK1,
        validatedBySyndicate: { syndicateId: SY.CAVIA, rank: 1 },
        label: "Cavia: Rank 1 (Assistant)",
        category: "Syndicates",
        description: "First Cavia standing rank after Whispers in the Walls unlocks Sanctum Anatomica.",
        prerequisites: [PR.HUB_SANCTUM],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Cavia", verifiedOn: "2026-11-09", classification: "required", note: "Cavia standing progression begins after Sanctum Anatomica is unlocked by Whispers in the Walls." }]
    },
    {
        id: PR.SYNDICATE_CAVIA_RANK2,
        validatedBySyndicate: { syndicateId: SY.CAVIA, rank: 2 },
        label: "Cavia: Rank 2 (Researcher)",
        category: "Syndicates",
        description: "Unlocks Helminth Coalescent Segment blueprint from Bird 3.",
        prerequisites: [PR.SYNDICATE_CAVIA_RANK1],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Cavia", verifiedOn: "2026-11-09", classification: "required", note: "Researcher is Cavia Rank 2 and follows Cavia Rank 1; it unlocks Bird 3's Coalescent Segment blueprint." }]
    },
    {
        id: PR.SYNDICATE_CAVIA_RANK3,
        validatedBySyndicate: { syndicateId: SY.CAVIA, rank: 3 },
        label: "Cavia: Rank 3 (Colleague)",
        category: "Syndicates",
        description: "Cavia Rank 3 progression milestone.",
        prerequisites: [PR.SYNDICATE_CAVIA_RANK2],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Cavia", verifiedOn: "2026-11-09", classification: "required", note: "Cavia Rank 3 follows Rank 2 Researcher in the syndicate rank progression." }]
    },
    {
        id: PR.SYNDICATE_CAVIA_RANK4,
        validatedBySyndicate: { syndicateId: SY.CAVIA, rank: 4 },
        label: "Cavia: Rank 4 (Scholar)",
        category: "Syndicates",
        description: "Cavia Rank 4 progression milestone.",
        prerequisites: [PR.SYNDICATE_CAVIA_RANK3],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Cavia", verifiedOn: "2026-11-09", classification: "required", note: "Cavia Rank 4 follows Rank 3 in the syndicate rank progression." }]
    },
    {
        id: PR.SYNDICATE_CAVIA_RANK5,
        validatedBySyndicate: { syndicateId: SY.CAVIA, rank: 5 },
        label: "Cavia: Rank 5 (Illuminate)",
        category: "Syndicates",
        description: "Maximum Cavia rank. Unlocks the weekly Archon Shard purchase in Sanctum Anatomica.",
        prerequisites: [PR.SYNDICATE_CAVIA_RANK4],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Cavia", verifiedOn: "2026-11-09", classification: "required", note: "Illuminate is Cavia Rank 5 and follows Rank 4; it is the required standing rank for Deep Archimedea." }]
    },
    {
        id: PR.SYNDICATE_HEX_RANK4,
        validatedBySyndicate: { syndicateId: SY.THE_HEX, rank: 4 },
        label: "The Hex: Rank 4 (Hot & Fresh)",
        category: "Syndicates",
        description: "Unlocks Rank 4 Hex offerings and requires the Hex Finale milestone (Rank 3 plus all six members Liked).",
        prerequisites: [PR.THE_HEX_FINALE],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/38-5-0", verifiedOn: "2026-11-09", classification: "required", note: "Update 38.5 identifies Hot & Fresh as Hex Rank 4; the Hex Finale availability milestone records the prerequisite Rank 3 and all-six-Liked conditions." }]
    },
    {
        id: PR.SYNDICATE_HEX_RANK5,
        validatedBySyndicate: { syndicateId: SY.THE_HEX, rank: 5 },
        label: "The Hex: Rank 5 (Pizza Party)",
        category: "Syndicates",
        description: "Maximum Hex rank. Required to access Temporal Archimedea.",
        prerequisites: [PR.SYNDICATE_HEX_RANK4],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/The_Hex_(Syndicate)", verifiedOn: "2026-11-09", classification: "required", note: "Pizza Party is The Hex Rank 5 and follows Rank 4 Hot & Fresh." }]
    },
    {
        id: PR.MR_5,
        validatedByMasteryRank: 5,
        showInPlanner: false,
        label: "Mastery Rank 5",
        category: "Systems",
        description: "Automatically tracked from your profile. Mastery Rank is an independent account progression value, not a quest unlock.",
        prerequisites: []
    },
    {
        id: PR.MR_8,
        validatedByMasteryRank: 8,
        showInPlanner: false,
        label: "Mastery Rank 8",
        category: "Systems",
        description: "Automatically tracked from your profile. Mastery Rank is an independent account progression value, not a quest unlock.",
        prerequisites: []
    },
    {
        id: PR.MR_10,
        validatedByMasteryRank: 10,
        showInPlanner: false,
        label: "Mastery Rank 10",
        category: "Systems",
        description: "Automatically tracked from your profile. Mastery Rank is an independent account progression value, not a quest unlock.",
        prerequisites: []
    },
    {
        id: PR.MR_15,
        validatedByMasteryRank: 15,
        showInPlanner: false,
        label: "Mastery Rank 15",
        category: "Systems",
        description: "Automatically tracked from your profile. Mastery Rank is an independent account progression value, not a quest unlock.",
        prerequisites: []
    },
    {
        id: PR.MR_30,
        validatedByMasteryRank: 30,
        showInPlanner: false,
        label: "Mastery Rank 30",
        category: "Systems",
        description: "Automatically tracked from your profile. Mastery Rank is an independent account progression value, not a quest unlock.",
        prerequisites: []
    },

];

const ENTRY_EVIDENCE_PAGES = new Map<PrereqId, string>([
    [PR.VORS_PRIZE, "https://wiki.warframe.com/w/Vor%27s_Prize"],
    [PR.THE_TEACHER, "https://wiki.warframe.com/w/The_Teacher"],
    [PR.ONCE_AWAKE, "https://wiki.warframe.com/w/Once_Awake"],
    [PR.ARCHWING, "https://wiki.warframe.com/w/The_Archwing"],
    [PR.APOSTASY, "https://wiki.warframe.com/w/Apostasy_Prologue"],
    [PR.SACRIFICE, "https://wiki.warframe.com/w/The_Sacrifice"],
    [PR.CHIMERA_PROLOGUE, "https://wiki.warframe.com/w/Chimera_Prologue"],
    [PR.ERRA, "https://wiki.warframe.com/w/Erra_%28Quest%29"],
    [PR.PRELUDE_TO_WAR, "https://wiki.warframe.com/w/The_Maker"],
    [PR.ANGELS_ZARIMAN, "https://wiki.warframe.com/w/Angels_of_the_Zariman"],
    [PR.WHISPERS_WALL, "https://wiki.warframe.com/w/Whispers_in_the_Walls"],
    [PR.THE_LOTUS_EATERS, "https://wiki.warframe.com/w/The_Lotus_Eaters"],
    [PR.THE_HEX, "https://wiki.warframe.com/w/The_Hex_%28Quest%29"],
    [PR.THE_OLD_PEACE, "https://wiki.warframe.com/w/The_Old_Peace"],
    [PR.JADE_SHADOWS, "https://wiki.warframe.com/w/Jade_Shadows"],
    [PR.HOWL_KUBROW, "https://wiki.warframe.com/w/Howl_of_the_Kubrow"],
    [PR.STOLEN_DREAMS, "https://wiki.warframe.com/w/Stolen_Dreams"],
    [PR.SAYA_VIGIL, "https://wiki.warframe.com/w/Saya%27s_Vigil"],
    [PR.VOX_SOLARIS, "https://wiki.warframe.com/w/Vox_Solaris_%28Quest%29"],
    [PR.HEART_OF_DEIMOS, "https://wiki.warframe.com/w/Heart_of_Deimos"],
    [PR.VEILBREAKER, "https://wiki.warframe.com/w/Veilbreaker"],
    [PR.CALL_TEMPESTARII, "https://wiki.warframe.com/w/Call_of_the_Tempestarii"],
    [PR.DEADLOCK_PROTOCOL, "https://wiki.warframe.com/w/The_Deadlock_Protocol"],
    [PR.NEW_STRANGE, "https://wiki.warframe.com/w/The_New_Strange"],
    [PR.LIMBO_THEOREM, "https://wiki.warframe.com/w/The_Limbo_Theorem"],
    [PR.SILVER_GROVE, "https://wiki.warframe.com/w/The_Silver_Grove"],
    [PR.OCTAVIA_ANTHEM, "https://wiki.warframe.com/w/Octavia%27s_Anthem"],
    [PR.GLAST_GAMBIT, "https://wiki.warframe.com/w/The_Glast_Gambit"],
    [PR.HIDDEN_MESSAGES, "https://wiki.warframe.com/w/Hidden_Messages"],
    [PR.WAVERIDER, "https://wiki.warframe.com/w/The_Waverider"],
    [PR.HUB_SANCTUM, "https://wiki.warframe.com/w/Whispers_in_the_Walls"],
    [PR.HUB_YUVAN_PEAK, "https://www.warframe.com/en/patch-notes/pc/44-0-0"],
    [PR.HUB_PONTIS_TOWER, "https://www.warframe.com/en/patch-notes/pc/43-0-0"],
    [PR.HUB_LA_CATHEDRALE, "https://www.warframe.com/en/patch-notes/pc/41-0-0"],
    [PR.JUNCTION_MARS_PHOBOS, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_JUPITER_EUROPA, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_SATURN_URANUS, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_MERCURY_VENUS, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_VENUS_EARTH, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_EARTH_MARS, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_MARS_CERES, "https://wiki.warframe.com/w/Junctions"],
    [PR.DEIMOS_ACCESS, "https://wiki.warframe.com/w/Deimos"],
    [PR.JUNCTION_CERES_JUPITER, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_EUROPA_SATURN, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_URANUS_NEPTUNE, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_NEPTUNE_PLUTO, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_PLUTO_SEDNA, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_SEDNA_ERIS, "https://wiki.warframe.com/w/Junctions"],
    [PR.JUNCTION_EARTH_LUA, "https://wiki.warframe.com/w/Star_Chart"],
    [PR.KUVA_FORTRESS_ACCESS, "https://wiki.warframe.com/w/Kuva_Fortress"],
    [PR.HUB_RELAY, "https://wiki.warframe.com/w/Relay"],
    [PR.HUB_CETUS, "https://wiki.warframe.com/w/Cetus"],
    [PR.HUB_FORTUNA, "https://wiki.warframe.com/w/Fortuna"],
    [PR.HUB_NECRALISK, "https://wiki.warframe.com/w/Heart_of_Deimos"],
    [PR.HUB_ZARIMAN, "https://wiki.warframe.com/w/Angels_of_the_Zariman"],
    [PR.HUB_HOLLVANIA, "https://wiki.warframe.com/w/The_Hex_%28Quest%29"],
    [PR.HUB_DRIFTERS_CAMP, "https://wiki.warframe.com/w/The_New_War"],
    [PR.ACTIVITY_STEEL_PATH_HONORS, "https://wiki.warframe.com/w/The_Steel_Path"],
    [PR.ACTIVITY_CIRCUIT_STEEL_PATH, "https://wiki.warframe.com/w/The_Circuit"],
    [PR.ACTIVITY_CIRCUIT, "https://wiki.warframe.com/w/The_Duviri_Paradox"],
    [PR.ACTIVITY_NETRACELLS, "https://wiki.warframe.com/w/Netracells"],
    [PR.ACTIVITY_NETRACELL_COMPLETED, "https://wiki.warframe.com/w/Netracells"],
    [PR.ACTIVITY_SISTER_PARVOS, "https://wiki.warframe.com/w/Sisters_of_Parvos"],
    [PR.ACTIVITY_INDEX, "https://wiki.warframe.com/w/The_Index"],
    [PR.ACTIVITY_ROPALOLYST, "https://wiki.warframe.com/w/Ropalolyst"],
    [PR.SEGMENT_PERSONAL_QUARTERS, "https://wiki.warframe.com/w/Orbiter_Segments"],
    [PR.SEGMENT_ARSENAL, "https://wiki.warframe.com/w/Orbiter_Segments"],
    [PR.SEGMENT_COMMUNICATIONS, "https://wiki.warframe.com/w/Orbiter_Segments"],
    [PR.SEGMENT_FOUNDRY, "https://wiki.warframe.com/w/Orbiter_Segments"],
    [PR.SEGMENT_INCUBATOR, "https://wiki.warframe.com/w/Orbiter_Segments"],
    [PR.SEGMENT_MELEE_UPGRADE, "https://wiki.warframe.com/w/Orbiter_Segments"],
    [PR.SEGMENT_HELMINTH, "https://wiki.warframe.com/w/Helminth"],
    [PR.SEGMENT_HELMINTH_ARCHON_SHARD, "https://wiki.warframe.com/w/Helminth"],
    [PR.RAILJACK_CONSTRUCTED, "https://wiki.warframe.com/w/Rising_Tide"],
    [PR.RAILJACK_CORPUS_NODES, "https://wiki.warframe.com/w/Call_of_the_Tempestarii"],
    [PR.FOCUS_UNLOCKED, "https://wiki.warframe.com/w/Focus"],
    [PR.FOCUS_SCHOOL_ZENURIK, "https://wiki.warframe.com/w/Focus"],
    [PR.FOCUS_SCHOOL_VAZARIN, "https://wiki.warframe.com/w/Focus"],
    [PR.FOCUS_SCHOOL_NARAMON, "https://wiki.warframe.com/w/Focus"],
    [PR.FOCUS_SCHOOL_UNAIRU, "https://wiki.warframe.com/w/Focus"],
    [PR.FOCUS_SCHOOL_MADURAI, "https://wiki.warframe.com/w/Focus"],
    [PR.AMP_SIROCCO, "https://wiki.warframe.com/w/The_New_War"],
    [PR.AMP_TIER1, "https://wiki.warframe.com/w/Amp"],
    [PR.AMP_TIER2, "https://wiki.warframe.com/w/Amp"],
    [PR.AMP_TIER3, "https://wiki.warframe.com/w/Amp"],
    [PR.AMP_TIER4, "https://wiki.warframe.com/w/Amp"],
    [PR.AMP_TIER5, "https://wiki.warframe.com/w/Amp"],
    [PR.AMP_TIER6, "https://wiki.warframe.com/w/Amp"],
    [PR.AMP_TIER7, "https://wiki.warframe.com/w/Amp"],
    [PR.COMPANION_KAVAT, "https://wiki.warframe.com/w/Kavat"],
    [PR.COMPANION_MOA, "https://wiki.warframe.com/w/MOA_%28Companion%29"],
    [PR.COMPANION_HOUND, "https://wiki.warframe.com/w/Hound"],
    [PR.COMPANION_PREDASITE, "https://wiki.warframe.com/w/Predasite"],
    [PR.COMPANION_VULPAPHYLA, "https://wiki.warframe.com/w/Vulpaphyla"],
    [PR.COMPANION_NAUTILUS, "https://wiki.warframe.com/w/Nautilus"],
    [PR.SYNDICATE_HOLDFASTS_RANK1, "https://wiki.warframe.com/w/The_Holdfasts"],
    [PR.SYNDICATE_HOLDFASTS_RANK2, "https://wiki.warframe.com/w/The_Holdfasts"],
    [PR.SYNDICATE_HOLDFASTS_RANK3, "https://wiki.warframe.com/w/The_Holdfasts"],
    [PR.SYNDICATE_HOLDFASTS_RANK4, "https://wiki.warframe.com/w/The_Holdfasts"],
    [PR.SYNDICATE_HOLDFASTS_RANK5, "https://wiki.warframe.com/w/The_Holdfasts"],
    [PR.SYNDICATE_SOLARIS_RANK5, "https://wiki.warframe.com/w/Solaris_United"],
    [PR.SYNDICATE_CAVIA_RANK2, "https://wiki.warframe.com/w/Cavia"],
    [PR.SYNDICATE_CAVIA_RANK1, "https://wiki.warframe.com/w/Cavia"],
    [PR.SYNDICATE_CAVIA_RANK3, "https://wiki.warframe.com/w/Cavia"],
    [PR.SYNDICATE_CAVIA_RANK4, "https://wiki.warframe.com/w/Cavia"],
    [PR.SYNDICATE_CAVIA_RANK5, "https://wiki.warframe.com/w/Cavia"],
    [PR.SYNDICATE_ENTRATI_RANK1, "https://wiki.warframe.com/w/Entrati"],
    [PR.SYNDICATE_ENTRATI_RANK2, "https://wiki.warframe.com/w/Entrati"],
    [PR.SYNDICATE_ENTRATI_RANK3, "https://wiki.warframe.com/w/Entrati"],
    [PR.SYNDICATE_ENTRATI_RANK4, "https://wiki.warframe.com/w/Entrati"],
    [PR.SYNDICATE_ENTRATI_RANK5, "https://wiki.warframe.com/w/Entrati"],
    [PR.SYNDICATE_SOLARIS_RANK1, "https://wiki.warframe.com/w/Solaris_United"],
    [PR.SYNDICATE_SOLARIS_RANK2, "https://wiki.warframe.com/w/Solaris_United"],
    [PR.SYNDICATE_SOLARIS_RANK3, "https://wiki.warframe.com/w/Solaris_United"],
    [PR.SYNDICATE_SOLARIS_RANK4, "https://wiki.warframe.com/w/Solaris_United"],
    [PR.SYNDICATE_HEX_RANK5, "https://wiki.warframe.com/w/The_Hex_(Syndicate)"],
    [PR.SYNDICATE_HEX_RANK4, "https://www.warframe.com/en/patch-notes/pc/38-5-0"],
    [PR.MR_5, "https://wiki.warframe.com/w/Mastery_Rank"],
    [PR.MR_8, "https://wiki.warframe.com/w/Mastery_Rank"],
    [PR.MR_10, "https://wiki.warframe.com/w/Mastery_Rank"],
    [PR.MR_15, "https://wiki.warframe.com/w/Mastery_Rank"],
    [PR.MR_30, "https://wiki.warframe.com/w/Mastery_Rank"],
]);

const ENTRY_EVIDENCE_FACTS = new Map<PrereqId, string>([
    [PR.THE_TEACHER, "The quest page's Requirement row names Vor's Prize; its quest reward unlocks access to Cetus."],
    [PR.ONCE_AWAKE, "The quest page's Requirement row names the Mercury Junction."],
    [PR.ARCHWING, "The quest page's Requirement row names the Mars Junction."],
    [PR.APOSTASY, "The quest page names Chains of Harrow, and the quest trigger is the glowing orb in the Personal Quarters; the Orbiter segment page ties that room to The War Within."],
    [PR.SACRIFICE, "The quest page's Requirement row names completed Apostasy Prologue."],
    [PR.CHIMERA_PROLOGUE, "The current quest page names The Sacrifice as its requirement."],
    [PR.ERRA, "The current quest page names Chimera Prologue as its requirement."],
    [PR.PRELUDE_TO_WAR, "The Maker quest page names Erra as its required preceding quest."],
    [PR.ANGELS_ZARIMAN, "The current quest progression page places Angels of the Zariman after The New War."],
    [PR.WHISPERS_WALL, "The current quest access page requires both The New War and Heart of Deimos."],
    [PR.THE_LOTUS_EATERS, "The current quest page makes The Lotus Eaters available after Whispers in the Walls."],
    [PR.THE_HEX, "The current quest page requires both The Lotus Eaters and The Duviri Paradox before The Hex can start."],
    [PR.THE_OLD_PEACE, "The current quest page places The Old Peace after The Lotus Eaters."],
    [PR.JADE_SHADOWS, "The quest page's Requirement row names The New War."],
    [PR.HOWL_KUBROW, "The quest page's Requirement row names the Venus-to-Mercury Junction."],
    [PR.STOLEN_DREAMS, "The quest page's Requirement row names the Phobos Junction."],
    [PR.HEART_OF_DEIMOS, "The quest page's Requirement row names the Earth-to-Mars Junction."],
    [PR.VEILBREAKER, "The quest page's Requirement row names completed The New War."],
    [PR.CALL_TEMPESTARII, "The quest page requires The Deadlock Protocol; its start flow also requires a usable owned Railjack, and the page lists the MR4 gate."],
    [PR.DEADLOCK_PROTOCOL, "The quest page requires the Europa-to-Saturn Junction and Mastery Rank 4."],
    [PR.OCTAVIA_ANTHEM, "The quest page's Requirement row names completed The Second Dream."],
    [PR.HIDDEN_MESSAGES, "The quest page's Requirement row names the Sedna Junction."],
    [PR.WAVERIDER, "The quest page requires Vox Solaris and Mastery Rank 3."],
    [PR.JUNCTION_MARS_PHOBOS, "The Junctions reference places Mars-to-Phobos after Mars is opened by the Earth-to-Mars Junction."],
    [PR.JUNCTION_JUPITER_EUROPA, "The Junctions reference places Jupiter-to-Europa on the Jupiter branch, after the Deimos-to-Jupiter access gate."],
    [PR.JUNCTION_SATURN_URANUS, "The Junctions reference places Saturn-to-Uranus after the Europa-to-Saturn Junction."],
    [PR.HUB_FORTUNA, "The Fortuna access instructions require the Junction that opens Venus before the player can reach the Fortuna node."],
    [PR.HUB_NECRALISK, "The Heart of Deimos quest page states that completing the quest opens Necralisk and the Entrati services there."],
    [PR.HUB_ZARIMAN, "The Zariman access page ties the Chrysalith and Holdfasts access to completion of Angels of the Zariman."],
    [PR.HUB_HOLLVANIA, "The Hex quest page identifies the Central Mall and Höllvania access as quest unlocks."],
    [PR.HUB_DRIFTERS_CAMP, "The New War page identifies Drifter's Camp as an access location unlocked through that quest."],
    [PR.ACTIVITY_STEEL_PATH_HONORS, "Steel Path honors are offered by Teshin after Steel Path access is unlocked."],
    [PR.ACTIVITY_CIRCUIT_STEEL_PATH, "The Circuit reference requires both The Duviri Paradox quest and an unlocked Steel Path for its Steel Path reward path."],
    [PR.ACTIVITY_CIRCUIT, "The Circuit page explicitly says it becomes accessible after completing The Duviri Paradox quest."],
    [PR.ACTIVITY_NETRACELL_COMPLETED, "Netracell access requires Whispers in the Walls; completing a run is the event recorded by this separate milestone."],
    [PR.ACTIVITY_INDEX, "The Index mission is on Neptune, so the Star Chart must be opened through the Uranus-to-Neptune Junction."],
    [PR.ACTIVITY_ROPALOLYST, "The Ropalolyst page says its Jupiter assassination node requires Chimera Prologue to battle it."],
    [PR.SEGMENT_PERSONAL_QUARTERS, "The Personal Quarters Segment is awarded during The War Within and enables the Apostasy quest interaction."],
    [PR.SEGMENT_ARSENAL, "The Orbiter Segments page lists the Arsenal Segment as a reward from Vor's Prize."],
    [PR.SEGMENT_COMMUNICATIONS, "The Orbiter Segments page lists the Communications Segment as a reward from Vor's Prize."],
    [PR.SEGMENT_FOUNDRY, "The Orbiter Segments page lists the Foundry Segment as a reward from Vor's Prize."],
    [PR.SEGMENT_INCUBATOR, "The Orbiter Segments page states that the Incubator Segment is obtained by initiating and completing Howl of the Kubrow."],
    [PR.SEGMENT_MELEE_UPGRADE, "The Melee Upgrade Segment was introduced as a Whispers in the Walls quest reward; the current segment page lists its Melee Exilus and Arcane functions."],
    [PR.SEGMENT_HELMINTH_ARCHON_SHARD, "The Helminth page ties the Archon Shard Segment to the Veilbreaker unlock path and requires the base Helminth system to use it."],
    [PR.RAILJACK_CORPUS_NODES, "The Call of the Tempestarii page identifies its completion as unlocking Corpus Proxima missions."],
    [PR.FOCUS_UNLOCKED, "The Focus reference says the system becomes available by completing The Second Dream."],
    [PR.FOCUS_SCHOOL_ZENURIK, "The Focus page says players choose one starting school at the end of The Second Dream; each of the remaining schools costs 50,000 Focus to unlock. This manual milestone means the named school has actually been unlocked."],
    [PR.FOCUS_SCHOOL_VAZARIN, "The Focus page says players choose one starting school at the end of The Second Dream; each of the remaining schools costs 50,000 Focus to unlock. This manual milestone means the named school has actually been unlocked."],
    [PR.FOCUS_SCHOOL_NARAMON, "The Focus page says players choose one starting school at the end of The Second Dream; each of the remaining schools costs 50,000 Focus to unlock. This manual milestone means the named school has actually been unlocked."],
    [PR.FOCUS_SCHOOL_UNAIRU, "The Focus page says players choose one starting school at the end of The Second Dream; each of the remaining schools costs 50,000 Focus to unlock. This manual milestone means the named school has actually been unlocked."],
    [PR.FOCUS_SCHOOL_MADURAI, "The Focus page says players choose one starting school at the end of The Second Dream; each of the remaining schools costs 50,000 Focus to unlock. This manual milestone means the named school has actually been unlocked."],
    [PR.MR_5, "Mastery Rank is an independent profile progression value. This milestone is derived from the imported profile and does not require a quest."],
    [PR.MR_8, "Mastery Rank is an independent profile progression value. This milestone is derived from the imported profile and does not require a quest."],
    [PR.MR_10, "Mastery Rank is an independent profile progression value. This milestone is derived from the imported profile and does not require a quest."],
    [PR.MR_15, "Mastery Rank is an independent profile progression value. This milestone is derived from the imported profile and does not require a quest."],
    [PR.MR_30, "Mastery Rank is an independent profile progression value. This milestone is derived from the imported profile and does not require a quest."],
    [PR.AMP_SIROCCO, "The New War quest rewards the built Sirocco Amp."],
    [PR.AMP_TIER1, "The Amp parts table places Tier 1 components at The Quills Rank 1."],
    [PR.AMP_TIER2, "The Amp parts table places Tier 2 components at The Quills Rank 2."],
    [PR.AMP_TIER3, "The Amp parts table places Tier 3 components at The Quills Rank 3."],
    [PR.AMP_TIER4, "The Amp parts table places Tier 4 components at The Quills Rank 4."],
    [PR.AMP_TIER5, "The Amp parts table places Tier 5 components at Vox Solaris Rank 1."],
    [PR.AMP_TIER6, "The Amp parts table places Tier 6 components at Vox Solaris Rank 2."],
    [PR.AMP_TIER7, "The Amp parts table places Tier 7 components at Vox Solaris Rank 3."],
    [PR.COMPANION_MOA, "The MOA companion page places its assembly service with Legs in Fortuna after the Vox Solaris quest unlocks Solaris United access."],
    [PR.COMPANION_PREDASITE, "Predasites are Deimos conservation companions; the Necralisk and Cambion Drift access are unlocked through Heart of Deimos."],
    [PR.COMPANION_VULPAPHYLA, "Vulpaphylas are Deimos conservation companions; the Necralisk and Cambion Drift access are unlocked through Heart of Deimos."],
    [PR.SYNDICATE_HOLDFASTS_RANK1, "The Holdfasts syndicate is based in the Chrysalith and becomes available after Angels of the Zariman opens the Zariman."],
    [PR.SYNDICATE_HOLDFASTS_RANK2, "The Holdfasts rank table identifies Watcher as Rank 2, following Rank 1 Fallen."],
    [PR.SYNDICATE_HOLDFASTS_RANK3, "The Holdfasts rank table identifies Guardian as Rank 3, following Rank 2 Watcher."],
    [PR.SYNDICATE_HOLDFASTS_RANK4, "The Holdfasts rank table identifies Seraph as Rank 4, following Rank 3 Guardian."],
    [PR.SYNDICATE_HOLDFASTS_RANK5, "The Holdfasts rank table identifies Angel as Rank 5, following Rank 4 Seraph."],
]);

// Legacy evidence is explicit and fact-specific. Missing evidence intentionally
// remains missing so the audit command and tests can fail closed.
for (const def of PREREQ_REGISTRY) {
    if (def.evidence?.length) continue;
    const sourceUrl = ENTRY_EVIDENCE_PAGES.get(def.id);
    const note = ENTRY_EVIDENCE_FACTS.get(def.id);
    if (!sourceUrl || !note) continue;
    def.evidence = [{
        kind: sourceUrl.startsWith("https://www.warframe.com/")
            ? "official"
            : sourceUrl.startsWith("https://forums.warframe.com/")
                ? "forum"
                : "wiki",
        url: sourceUrl,
        verifiedOn: "2026-11-09",
        classification: def.id === PR.FOCUS_SCHOOL_ZENURIK
            || def.id === PR.FOCUS_SCHOOL_VAZARIN
            || def.id === PR.FOCUS_SCHOOL_NARAMON
            || def.id === PR.FOCUS_SCHOOL_UNAIRU
            || def.id === PR.FOCUS_SCHOOL_MADURAI
            ? "conditional"
            : "required",
        note,
    }];
}
