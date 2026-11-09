// ===== FILE: src/catalog/prereqs/prereqRegistry.ts =====
//
// Prerequisite definitions for all tracked progression gates.
// Updated: 2026-11 — current progression gates through Update 44.1.2, with temporary Operation: Taubound.
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
    | { type: "availability_window"; startsOn: string; endsOn: string };

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
        case "availability_window": return `Available ${cond.startsOn} through ${cond.endsOn}`;
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
        id: PR.VORS_PRIZE,
        label: "Vor's Prize",
        category: "Quests",
        description: "Forced tutorial quest. Opens the star chart and installs base Orbiter segments.",
        prerequisites: []
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
        prerequisites: [PR.JUNCTION_URANUS_NEPTUNE],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 says completing the Uranus → Neptune Junction unlocks The Second Dream; Natah is already a direct Neptune Junction task."
        }]
    },
    {
        id: PR.WAR_WITHIN,
        label: "The War Within",
        category: "Quests",
        description: "Expands Operator to full Transference. Unlocks Kuva Fortress, Sorties, Rising Tide, and the full Focus tree. Required for the main arc chain.",
        prerequisites: [PR.JUNCTION_NEPTUNE_PLUTO],
        conditions: [{ type: "mastery_rank", value: 5 }],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 says completing the Neptune → Pluto Junction unlocks The War Within; The Second Dream is already a direct Pluto Junction task."
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
        description: "Requires Prelude to War, an owned Railjack, and an Operator Amp. The game lends a Necramech during the quest; an owned Necramech is not required. A stronger Railjack is recommended, not a gate.",
        prerequisites: [PR.PRELUDE_TO_WAR, PR.RAILJACK_CONSTRUCTED, PR.SYSTEM_OPERATOR_AMP],
        evidence: [{
            kind: "wiki",
            url: "https://wiki.warframe.com/w/The_New_War",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "The current quest requirement list includes owning an Operator Amp and a Railjack, plus completing Prelude to War."
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
        description: "Unlocks Gara blueprint. Available in Cetus. Tracked for quest completion.",
        prerequisites: [PR.HUB_CETUS]
    },
    {
        id: PR.VOX_SOLARIS,
        label: "Vox Solaris",
        category: "SideQuests",
        description: "Unlocks Solaris United bounty progression and Ventkids access in Fortuna / Orb Vallis.",
        prerequisites: [PR.HUB_FORTUNA]
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
        description: "Constructs the Railjack. Required for The New War and Call of the Tempestarii.",
        prerequisites: [PR.WAR_WITHIN],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Rising_Tide", verifiedOn: "2026-11-08", classification: "required", note: "The current quest unlock requirements list The War Within." }]
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
        description: "Side quest for Cephalon Simaris and Chroma progression. Requires Stolen Dreams and the Jupiter → Europa Junction.",
        prerequisites: [PR.STOLEN_DREAMS, PR.JUNCTION_JUPITER_EUROPA]
    },

    // =========================================================================
    // SIDE QUESTS — Warframe Blueprint Quests (tracked, not planning blockers)
    // =========================================================================
    {
        id: PR.LIMBO_THEOREM,
        label: "The Limbo Theorem",
        category: "SideQuests",
        description: "Awards Limbo blueprint. Requires an Archwing and the Jupiter → Europa junction.",
        prerequisites: [PR.ARCHWING, PR.JUNCTION_JUPITER_EUROPA]
    },
    {
        id: PR.SILVER_GROVE,
        label: "The Silver Grove",
        category: "SideQuests",
        description: "Awards Titania blueprint. Requires The Second Dream and MR7.",
        prerequisites: [PR.SECOND_DREAM],
        conditions: [{ type: "mastery_rank", value: 7 }]
    },
    {
        id: PR.SANDS_INAROS,
        label: "Sands of Inaros",
        category: "SideQuests",
        description: "Awards Inaros blueprint. Quest beacon purchased from Baro Ki'Teer. Requires MR5.",
        prerequisites: [PR.HUB_RELAY],
        conditions: [{ type: "mastery_rank", value: 5 }]
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
        description: "Awards Nidus blueprint. Requires The War Within and speaking to Ergo Glast in a Relay.",
        prerequisites: [PR.WAR_WITHIN, PR.HUB_RELAY]
    },
    {
        id: PR.MASK_REVENANT,
        label: "Mask of the Revenant",
        category: "SideQuests",
        description: "Awards Revenant blueprint. Start from Nakak in Cetus after reaching Observer with The Quills.",
        prerequisites: [PR.HUB_CETUS, PR.SYNDICATE_QUILLS_RANK2]
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
        description: "Awards Mesa blueprint. Requires Once Awake and Eris access.",
        prerequisites: [PR.ONCE_AWAKE, PR.JUNCTION_PLUTO_SEDNA]
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
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "historical", note: "Update 39 explicitly calls Ceres Junction optional and says it is not critical to the main story path." }]
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
        prerequisites: [PR.JUNCTION_URANUS_NEPTUNE, PR.SECOND_DREAM],
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/39-0-0", verifiedOn: "2026-11-08", classification: "required", note: "Update 39 lists The Second Dream as a Pluto Junction task and says the Pluto Junction unlocks The War Within." }]
    },
    {
        id: PR.JUNCTION_PLUTO_SEDNA,
        label: "Junction: Pluto → Eris",
        category: "Systems",
        description: "Stable completion key for the current Pluto → Eris Junction. Completing it unlocks Eris; the Focus Lens task separately unlocks Arbitrations before the full Junction is complete.",
        prerequisites: [PR.JUNCTION_NEPTUNE_PLUTO, PR.WAR_WITHIN, PR.SYSTEM_ERIS_FOCUS_LENS],
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
        description: "You can visit a Relay. Required for The Silver Grove and Sands of Inaros.",
        prerequisites: [PR.VORS_PRIZE]
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
        prerequisites: [PR.WHISPERS_WALL, PR.HUB_NECRALISK]
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
        description: "Join or create a Clan and access its Dojo. Required for dojo research, blueprint replication, and clan-only amenities.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.ACTIVITY_STEEL_PATH,
        label: "The Steel Path Unlocked",
        category: "Systems",
        description: "Speak to Teshin in a Relay after completing all nodes accessible prior to The New War on the connected Star Chart. This is auto-derived from tracked normal-mode node completion, excluding Mutalist Alad V, Jordas Golem, and Brutus exactly as listed on the wiki.",
        prerequisites: [PR.HUB_RELAY],
        conditions: [{ type: "star_chart_access", activity: "steel_path" }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Steel_Path", verifiedOn: "2026-11-09", classification: "required", note: "Current Steel Path access requires completion of all eligible Star Chart nodes available before The New War and speaking to Teshin in a Relay; excluded nodes are listed in the article." }]
    },
    {
        id: PR.ACTIVITY_STEEL_PATH_HONORS,
        label: "Teshin's Steel Path Honors",
        category: "Systems",
        description: "Access Teshin's Steel Path Honors shop in any Relay after unlocking The Steel Path.",
        prerequisites: [PR.ACTIVITY_STEEL_PATH, PR.HUB_RELAY]
    },
    {
        id: PR.ACTIVITY_CIRCUIT_STEEL_PATH,
        label: "The Steel Path Circuit",
        category: "Systems",
        description: "Unlock the Steel Path version of The Circuit. Requires both The Duviri Paradox and The Steel Path.",
        prerequisites: [PR.DUVIRI_PARADOX, PR.ACTIVITY_STEEL_PATH]
    },
    {
        id: PR.ACTIVITY_CIRCUIT_STEEL_PATH_2,
        showInPlanner: false,
        label: "The Steel Path Circuit (Alias)",
        category: "Systems",
        description: "Compatibility alias for the Steel Path version of The Circuit.",
        prerequisites: [PR.ACTIVITY_CIRCUIT_STEEL_PATH]
    },
    {
        id: PR.ACTIVITY_NIGHTWAVE,
        showInPlanner: false,
        label: "Nightwave Access",
        category: "Systems",
        description: "Access Nightwave challenges, Cred offerings, and rank rewards. This is tracked as a manual milestone because season availability rotates and the app does not model every historical Nightwave reward path.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.ACTIVITY_SORTIES,
        label: "Sorties",
        category: "Systems",
        description: "Access Sorties after The War Within, completing the Oro mission on Earth, and having a Sortie-eligible Warframe available. Mastery Rank 5 is implicit in The War Within's own gate.",
        prerequisites: [PR.WAR_WITHIN, PR.SYSTEM_RANK30_WARFRAME],
        conditions: [{ type: "node_complete", nodeId: "node:mr/earth/oro", label: "Oro (Earth)" }],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Sortie", verifiedOn: "2026-11-08", classification: "required", note: "Current Sortie access requires The War Within, Mastery Rank 5, and completion of Oro on Earth; entering a mission requires a Rank 30 Warframe or an MR30 Forma bypass." }]
    },
    {
        id: PR.ACTIVITY_VOID_FISSURES,
        label: "Void Fissures",
        category: "Systems",
        description: "Access standard Void Relic fissure missions after installing the Void Relic Segment. Individual fissure missions still require their normal Star Chart node to be unlocked.",
        prerequisites: [PR.SEGMENT_VOID_RELIC]
    },
    {
        id: PR.ACTIVITY_VOID_STORMS,
        label: "Void Storms",
        category: "Systems",
        description: "Access Railjack Void Storm fissures. Requires a functional Railjack and Call of the Tempestarii-era Corpus Proxima access.",
        prerequisites: [PR.RAILJACK_CONSTRUCTED, PR.CALL_TEMPESTARII]
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
        prerequisites: [PR.HUB_SANCTUM]
    },
    {
        id: PR.ACTIVITY_DEEP_ARCHIMEDEA,
        label: "Deep Archimedea",
        category: "Systems",
        description: "Access Deep Archimedea by speaking to Necraloid in Sanctum Anatomica. The wiki requires Whispers in the Walls, Cavia Rank 5 (Illuminate), and at least one completed Netracell mission.",
        prerequisites: [PR.WHISPERS_WALL, PR.SYNDICATE_CAVIA_RANK5, PR.ACTIVITY_NETRACELLS]
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
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Update_38", verifiedOn: "2026-11-08", classification: "required", note: "Temporal Archimedea requires completion of The Hex and Rank 5 with the Hex." }]
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
        description: "Access the permanent Running Late quest. Requires The Hex, The Hex Finale, Hex Rank 5, and Amir Chemistry Rank 5 (Close).",
        prerequisites: [PR.THE_HEX, PR.THE_HEX_FINALE, PR.SYNDICATE_HEX_RANK5, PR.SYSTEM_AMIR_CLOSE],
        introducedIn: "Update 43.5 (August 12, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/patch-notes/pc/43-5-0", verifiedOn: "2026-11-08", classification: "required", note: "The update explicitly lists these four access conditions for the permanent quest." }]
    },
    {
        id: PR.ACTIVITY_TAUBOUND,
        label: "Operation: Taubound (Limited Event)",
        category: "Systems",
        description: "Temporary Eris route available October 15 through November 17, 2026. During the event it only requires Vor's Prize and bypasses the usual Eris Star Chart and Junction gates.",
        prerequisites: [PR.VORS_PRIZE],
        conditions: [{ type: "availability_window", startsOn: "2026-10-15", endsOn: "2026-11-17" }],
        introducedIn: "Update 44.1.2 (October 15, 2026)",
        evidence: [{ kind: "official", url: "https://www.warframe.com/en/news/epoch-operation-taubound", verifiedOn: "2026-11-08", classification: "conditional", note: "The active operation bypasses normal Eris Star Chart requirements for its event mission path and ends November 17, 2026." }]
    },
    {
        id: PR.ACTIVITY_KUVA_LICH,
        label: "Kuva Lich System",
        category: "Systems",
        description: "Meet the prerequisites to create and pursue a Kuva Lich. Update 39 states that The War Within, Rising Tide, and Mastery Rank 5 are required.",
        prerequisites: [PR.WAR_WITHIN, PR.RISING_TIDE],
        conditions: [{ type: "mastery_rank", value: 5 }],
        evidence: [{
            kind: "official",
            url: "https://www.warframe.com/en/patch-notes/pc/39-0-0",
            verifiedOn: "2026-11-08",
            classification: "required",
            note: "Update 39 names The War Within, Rising Tide, and Mastery Rank 5 as the Kuva Lich prerequisites."
        }]
    },
    {
        id: PR.ACTIVITY_SISTER_PARVOS,
        label: "Sisters of Parvos System",
        category: "Systems",
        description: "Meet the prerequisites to create and pursue a Sister of Parvos. Requires The War Within, Call of the Tempestarii, and Mastery Rank 5.",
        prerequisites: [PR.WAR_WITHIN, PR.CALL_TEMPESTARII],
        conditions: [{ type: "mastery_rank", value: 5 }]
    },
    {
        id: PR.ACTIVITY_ABYSSAL_ZONE,
        showInPlanner: false,
        label: "Abyssal Zone Access",
        category: "Systems",
        description: "Access the Abyssal Zone on Ceres. Requires Relay access and an Abyssal Beacon purchased from any pledged main Syndicate at Rank 2.",
        prerequisites: [PR.HUB_RELAY],
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
        }
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
        prerequisites: [PR.VOX_SOLARIS]
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
        prerequisites: [PR.CHIMERA_PROLOGUE, PR.JUNCTION_CERES_JUPITER]
    },
    {
        id: PR.ACTIVITY_DEFECTION,
        label: "Defection Missions",
        category: "Systems",
        description: "Access Defection missions, including Memphis on Phobos where Grineer Manics can be reliably farmed.",
        prerequisites: [PR.JUNCTION_MARS_PHOBOS]
    },
    {
        id: PR.ACTIVITY_TECHNOCYTE_CODA,
        label: "Technocyte Coda System",
        category: "Systems",
        description: "Meet the prerequisites to create and pursue a Technocyte Coda. Requires The Hex and an owned Railjack for the final Earth Proxima confrontation. The game also requires not having another active adversary, which is not modeled as a prerequisite here.",
        prerequisites: [PR.THE_HEX, PR.RAILJACK_CONSTRUCTED]
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
        id: PR.SEGMENT_CODEX_SCANNER,
        showInPlanner: false,
        label: "Orbiter: Codex Scanner Segment",
        category: "Segments",
        description: "Base Codex scanning function installed during Vor's Prize.",
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
        description: "Base modding station installed during Vor's Prize.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.SEGMENT_VOID_RELIC,
        label: "Orbiter: Void Relic Segment",
        category: "Segments",
        description: "Required to crack Void Fissures and refine Relics.",
        prerequisites: [PR.JUNCTION_EARTH_MARS]
    },
    {
        id: PR.SEGMENT_INCUBATOR,
        label: "Orbiter: Incubator Segment",
        category: "Segments",
        description: "Required for Kubrow and Kavat companion breeding. Awarded by completing Howl of the Kubrow.",
        prerequisites: [PR.HOWL_KUBROW]
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
        description: "Base Helminth subsume system. Purchased from Son for 15,000 Standing. Requires MR8 + Entrati rank 3 (Associate).",
        prerequisites: [PR.HUB_NECRALISK, PR.SYNDICATE_ENTRATI_RANK3],
        conditions: [{ type: "mastery_rank", value: 8 }]
    },
    {
        id: PR.SEGMENT_HELMINTH_INVIGORATION,
        label: "Helminth Segment: Invigorations",
        category: "Segments",
        description: "Unlocks weekly Invigoration buffs. Purchased from Son for 30,000 Standing. Requires MR8 + Entrati rank 5 (Family).",
        prerequisites: [PR.SEGMENT_HELMINTH, PR.SYNDICATE_ENTRATI_RANK5],
        conditions: [{ type: "mastery_rank", value: 8 }]
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
        prerequisites: [PR.SEGMENT_HELMINTH_ARCHON_SHARD, PR.HUB_SANCTUM, PR.SYNDICATE_CAVIA_RANK2]
    },

    // =========================================================================
    // NECRAMECH & RAILJACK
    // =========================================================================
    {
        id: PR.NECRAMECH_UNLOCKED,
        label: "Necramech: System Unlocked",
        category: "Necramech",
        description: "You can deploy a Necramech in open worlds and Railjack missions. Craft Voidrig or Bonewidow via Necraloid standing.",
        prerequisites: [PR.HEART_OF_DEIMOS, PR.HUB_NECRALISK]
    },
    {
        id: PR.NECRAMECH_VOIDRIG,
        showInPlanner: false,
        label: "Necramech: Voidrig Built",
        category: "Necramech",
        description: "Build Voidrig through Necramech progression in the Necralisk.",
        prerequisites: [PR.NECRAMECH_UNLOCKED]
    },
    {
        id: PR.NECRAMECH_BONEWIDOW,
        showInPlanner: false,
        label: "Necramech: Bonewidow Built",
        category: "Necramech",
        description: "Build Bonewidow through Necramech progression in the Necralisk.",
        prerequisites: [PR.NECRAMECH_UNLOCKED]
    },
    {
        id: PR.RAILJACK_CONSTRUCTED,
        label: "Railjack: Ship Constructed",
        category: "Railjack",
        description: "Your Railjack is built and ready for missions. Required for The New War.",
        prerequisites: [PR.RISING_TIDE]
    },
    {
        id: PR.RAILJACK_INTRINSICS,
        showInPlanner: false,
        label: "Railjack: Intrinsics Unlocked",
        category: "Railjack",
        description: "Access the Railjack Intrinsics tree after completing your first Railjack mission.",
        prerequisites: [PR.RAILJACK_CONSTRUCTED]
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
        description: "Unlock Railjack Void Storm fissures after Corpus Proxima access.",
        prerequisites: [PR.RAILJACK_CORPUS_NODES]
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
        description: "Unlock the remaining Focus abilities after completing Saya's Vigil and visiting The Quills after The War Within. Quills Rank 1 is not required.",
        prerequisites: [PR.SYSTEM_ONKKO_VISITED, PR.SAYA_VIGIL],
        evidence: [{ kind: "wiki", url: "https://wiki.warframe.com/w/Focus", verifiedOn: "2026-11-09", classification: "required", note: "The current Focus reference says the remaining Focus abilities require The War Within, Saya's Vigil, and visiting The Quills; the War Within prerequisite is already implied by the tracked Quills visit." }]
    },
    {
        id: PR.FOCUS_SCHOOL_ZENURIK,
        showInPlanner: false,
        label: "Focus School: Zenurik",
        category: "Systems",
        description: "Zenurik Focus school is available after unlocking Focus.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_VAZARIN,
        showInPlanner: false,
        label: "Focus School: Vazarin",
        category: "Systems",
        description: "Vazarin Focus school is available after unlocking Focus.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_NARAMON,
        showInPlanner: false,
        label: "Focus School: Naramon",
        category: "Systems",
        description: "Naramon Focus school is available after unlocking Focus.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_UNAIRU,
        showInPlanner: false,
        label: "Focus School: Unairu",
        category: "Systems",
        description: "Unairu Focus school is available after unlocking Focus.",
        prerequisites: [PR.FOCUS_UNLOCKED]
    },
    {
        id: PR.FOCUS_SCHOOL_MADURAI,
        showInPlanner: false,
        label: "Focus School: Madurai",
        category: "Systems",
        description: "Madurai Focus school is available after unlocking Focus.",
        prerequisites: [PR.FOCUS_UNLOCKED]
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
        description: "Unlock Kubrow breeding through Howl of the Kubrow and the Incubator segment.",
        prerequisites: [PR.HOWL_KUBROW, PR.SEGMENT_INCUBATOR]
    },
    {
        id: PR.COMPANION_KAVAT,
        showInPlanner: false,
        label: "Kavat Breeding",
        category: "Systems",
        description: "Unlock Kavat breeding after obtaining the Incubator segment and Deimos access for Genetic Codes.",
        prerequisites: [PR.SEGMENT_INCUBATOR, PR.HEART_OF_DEIMOS]
    },
    {
        id: PR.COMPANION_HELMINTH_CHARGER,
        showInPlanner: false,
        label: "Helminth Charger Companion",
        category: "Systems",
        description: "Unlock Helminth Charger incubation through the Incubator segment and Helminth access.",
        prerequisites: [PR.SEGMENT_INCUBATOR, PR.SEGMENT_HELMINTH]
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
        label: "Hound Companion Access",
        category: "Systems",
        description: "Unlock Hound companions by accessing the Sisters of Parvos system.",
        prerequisites: [PR.ACTIVITY_SISTER_PARVOS]
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
        description: "Unlock the Nautilus Sentinel through Railjack progression.",
        prerequisites: [PR.RAILJACK_CONSTRUCTED]
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
        id: PR.SYNDICATE_SOLARIS_RANK5,
        validatedBySyndicate: { syndicateId: SY.SOLARIS_UNITED, rank: 5 },
        label: "Solaris United: Rank 5 (Old Mate)",
        category: "Syndicates",
        description: "Maximum Solaris United rank. Required to start Orb Vallis heists such as Profit-Taker and Exploiter.",
        prerequisites: [PR.VOX_SOLARIS]
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
        id: PR.SYNDICATE_ENTRATI_RANK3,
        validatedBySyndicate: { syndicateId: SY.ENTRATI, rank: 3 },
        label: "Entrati: Rank 3 (Associate)",
        category: "Syndicates",
        description: "Entrati standing rank 3 (Associate). The Helminth Segment itself additionally requires MR8.",
        prerequisites: [PR.HUB_NECRALISK],
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
        id: PR.SYNDICATE_CAVIA_RANK2,
        validatedBySyndicate: { syndicateId: SY.CAVIA, rank: 2 },
        label: "Cavia: Rank 2 (Researcher)",
        category: "Syndicates",
        description: "Unlocks Helminth Coalescent Segment blueprint from Bird 3.",
        prerequisites: [PR.HUB_SANCTUM]
    },
    {
        id: PR.SYNDICATE_CAVIA_RANK5,
        validatedBySyndicate: { syndicateId: SY.CAVIA, rank: 5 },
        label: "Cavia: Rank 5 (Illuminate)",
        category: "Syndicates",
        description: "Maximum Cavia rank. Unlocks the weekly Archon Shard purchase in Sanctum Anatomica.",
        prerequisites: [PR.SYNDICATE_CAVIA_RANK2]
    },
    {
        id: PR.SYNDICATE_HEX_RANK5,
        validatedBySyndicate: { syndicateId: SY.THE_HEX, rank: 5 },
        label: "The Hex: Rank 5 (Pizza Party)",
        category: "Syndicates",
        description: "Maximum Hex rank. Required to access Temporal Archimedea.",
        prerequisites: [PR.HUB_HOLLVANIA]
    },
    {
        id: PR.MR_5,
        validatedByMasteryRank: 5,
        showInPlanner: false,
        label: "Mastery Rank 5",
        category: "Systems",
        description: "Automatically tracked from your profile. Used by several mid-game gates such as Sorties-era content.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.MR_8,
        validatedByMasteryRank: 8,
        showInPlanner: false,
        label: "Mastery Rank 8",
        category: "Systems",
        description: "Automatically tracked from your profile. Used by Helminth segment access and similar gates.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.MR_10,
        validatedByMasteryRank: 10,
        showInPlanner: false,
        label: "Mastery Rank 10",
        category: "Systems",
        description: "Automatically tracked from your profile for MR10-gated items and systems.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.MR_15,
        validatedByMasteryRank: 15,
        showInPlanner: false,
        label: "Mastery Rank 15",
        category: "Systems",
        description: "Automatically tracked from your profile for MR15-gated items and purchases.",
        prerequisites: [PR.VORS_PRIZE]
    },
    {
        id: PR.MR_30,
        validatedByMasteryRank: 30,
        showInPlanner: false,
        label: "Mastery Rank 30",
        category: "Systems",
        description: "Automatically tracked from your profile for MR30-gated features and rewards.",
        prerequisites: [PR.VORS_PRIZE]
    },

];
