// ===== FILE: src/catalog/prereqs/milestoneRegistry.ts =====
//
// Milestone definitions — derived rollups of prereqs for high-level capability tracking.
// Updated: 2026-11 — rollups use current junction semantics through Update 44.1.2.
//
// Design intent:
// - Milestones are derived; they are NOT directly user-completed.
// - Prereqs remain the canonical atomic progress tracking.
// - All references MUST be valid PR.* ids.

import { PR } from "../../domain/ids/prereqIds";
import type { PrereqId } from "../../domain/ids/prereqIds";

export type MilestoneCategory =
    | "Mainline"
    | "SideQuests"
    | "StarChart"
    | "Hubs"
    | "OpenWorlds"
    | "Orbiter"
    | "Necramech"
    | "Railjack"
    | "Helminth"
    | "Syndicates"
    | "Duviri";

export type MilestoneRule =
    | { type: "all"; prereqIds: PrereqId[] }
    | { type: "any"; prereqIds: PrereqId[]; need?: number };

export interface MilestoneDef {
    id: string;
    label: string;
    description: string;
    category: MilestoneCategory;
    showWhenComplete?: boolean;
    rule: MilestoneRule;
}

export const MILESTONE_REGISTRY: MilestoneDef[] = [

    // =========================================================================
    // MAINLINE STORY SPINE
    // =========================================================================
    {
        id: "ms_main_started",
        label: "Started Your Journey",
        description: "Completed the tutorial and opened the core progression spine.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.VORS_PRIZE] }
    },
    {
        id: "ms_main_operator_unlocked",
        label: "Operator Unlocked (The Second Dream)",
        description: "Operator mode is active. Major turning point in the Tenno story.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SECOND_DREAM] }
    },
    {
        id: "ms_main_war_within_complete",
        label: "The War Within Complete",
        description: "Full Operator Transference unlocked, Focus tree fully accessible, Kuva Fortress open.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.WAR_WITHIN] }
    },
    {
        id: "ms_main_arc2_complete",
        label: "Arc 2 Complete (Chains → The Sacrifice)",
        description: "You have completed Chains of Harrow, Apostasy Prologue, and The Sacrifice.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.CHAINS_HARROW, PR.APOSTASY, PR.SACRIFICE] }
    },
    {
        id: "ms_main_new_war_complete",
        label: "The New War Complete",
        description: "Largest story milestone. Zariman, Veilbreaker, Archon Hunts, and Kahl content all unlocked.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.NEW_WAR] }
    },
    {
        id: "ms_main_zariman_chapter",
        label: "Zariman Chapter Reached",
        description: "Angels of the Zariman complete. Zariman hub and Holdfasts accessible.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.ANGELS_ZARIMAN, PR.HUB_ZARIMAN] }
    },
    {
        id: "ms_main_whispers_chapter",
        label: "Sanctum Anatomica Chapter Reached",
        description: "Whispers in the Walls complete. Sanctum, Cavia, and Netracells accessible.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.WHISPERS_WALL, PR.HUB_SANCTUM] }
    },
    {
        id: "ms_main_1999_chapter",
        label: "1999 Chapter Reached (The Hex)",
        description: "The Hex complete. Höllvania and all 1999 content accessible.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.THE_HEX, PR.HUB_HOLLVANIA] }
    },
    {
        id: "ms_main_arc6_reached",
        label: "The Old Peace Complete",
        description: "The Old Peace complete; one of the released main-story quests in the Void War Saga.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.THE_OLD_PEACE] }
    },
    {
        id: "ms_main_jade_constellations_complete",
        label: "Jade Shadows: Constellations Complete",
        description: "The Update 43 main quest is complete; Uranus Proxima and Pontis Tower are unlocked.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.JADE_SHADOWS_CONSTELLATIONS] }
    },
    {
        id: "ms_main_tau_prologue_complete",
        label: "Prologue to Tau: Released Chapters Complete",
        description: "Both currently released permanent chapters, Lua and Vessel, are complete. Unreleased chapters are not counted.",
        category: "Mainline",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.TAU_PROLOGUE_LUA, PR.TAU_PROLOGUE_VESSEL] }
    },

    // =========================================================================
    // SIDE QUESTS
    // =========================================================================
    {
        id: "ms_sq_railjack_ready",
        label: "Rising Tide Complete",
        description: "Railjack construction quest done. Ship is buildable.",
        category: "SideQuests",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.RISING_TIDE] }
    },
    {
        id: "ms_sq_veilbreaker_complete",
        label: "Veilbreaker Complete",
        description: "Kahl's Garrison and Archon Hunts fully unlocked.",
        category: "SideQuests",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.VEILBREAKER] }
    },
    {
        id: "ms_sq_call_tempestarii",
        label: "Call of the Tempestarii Complete",
        description: "Sisters of Parvos system and Corpus Proxima Railjack nodes unlocked.",
        category: "SideQuests",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.CALL_TEMPESTARII] }
    },
    {
        id: "ms_sq_jade_shadows",
        label: "Jade Shadows Complete",
        description: "Jade Warframe blueprint available.",
        category: "SideQuests",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.JADE_SHADOWS] }
    },
    {
        id: "ms_sq_warframe_bp_quests_mid",
        label: "Mid Warframe BP Quests Done",
        description: "Limbo Theorem, Jordas Precept, and The Glast Gambit complete.",
        category: "SideQuests",
        rule: { type: "all", prereqIds: [PR.LIMBO_THEOREM, PR.JORDAS_PRECEPT, PR.GLAST_GAMBIT] }
    },
    {
        id: "ms_sq_warframe_bp_quests_all",
        label: "All Warframe BP Quests Done",
        description: "All warframe blueprint quests complete: Limbo, Titania, Inaros, Octavia, Atlas, Nidus, Revenant, Mirage, Mesa.",
        category: "SideQuests",
        rule: {
            type: "all",
            prereqIds: [
                PR.LIMBO_THEOREM, PR.SILVER_GROVE, PR.SANDS_INAROS, PR.OCTAVIA_ANTHEM,
                PR.JORDAS_PRECEPT, PR.GLAST_GAMBIT, PR.MASK_REVENANT,
                PR.HIDDEN_MESSAGES, PR.PATIENT_ZERO
            ]
        }
    },

    // =========================================================================
    // STAR CHART
    // =========================================================================
    {
        id: "ms_star_earth_to_mars",
        label: "Star Chart: Earth → Mars",
        description: "Core early junction. Unlocks Void Relic and Incubator segments.",
        category: "StarChart",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.JUNCTION_EARTH_MARS] }
    },
    {
        id: "ms_star_to_saturn",
        label: "Star Chart: Saturn Reached",
        description: "Europa → Saturn junction complete. Mid-game gate.",
        category: "StarChart",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.JUNCTION_EUROPA_SATURN] }
    },
    {
        id: "ms_star_to_sedna",
        label: "Star Chart: Sedna Reached",
        description: "Eris → Sedna Junction complete. The War Within now unlocks from Pluto Junction, before the Eris/Sedna branch.",
        category: "StarChart",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.JUNCTION_SEDNA_ERIS] }
    },
    {
        id: "ms_star_eris_reached",
        label: "Star Chart: Eris Reached",
        description: "Pluto → Eris Junction complete. Unlocks Eris and Arbitrations.",
        category: "StarChart",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.JUNCTION_PLUTO_SEDNA] }
    },
    {
        id: "ms_star_lua_reached",
        label: "Star Chart: Lua Reached",
        description: "Lua access unlocked by completing The Second Dream. Unlocks Lua missions and Octavia's Anthem.",
        category: "StarChart",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.JUNCTION_EARTH_LUA] }
    },
    {
        id: "ms_star_kuva_fortress_reached",
        label: "Star Chart: Kuva Fortress Reached",
        description: "The War Within unlocks Kuva Fortress access.",
        category: "StarChart",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.KUVA_FORTRESS_ACCESS] }
    },

    // =========================================================================
    // HUBS / OPEN WORLDS
    // =========================================================================
    {
        id: "ms_hub_first_open_world",
        label: "First Open World Accessible",
        description: "You have access to at least one open world hub.",
        category: "OpenWorlds",
        showWhenComplete: true,
        rule: { type: "any", prereqIds: [PR.HUB_CETUS, PR.HUB_FORTUNA, PR.HUB_NECRALISK], need: 1 }
    },
    {
        id: "ms_hub_cetus",
        label: "Cetus Access",
        description: "Plains of Eidolon accessible. Ostron standing available.",
        category: "Hubs",
        rule: { type: "all", prereqIds: [PR.HUB_CETUS] }
    },
    {
        id: "ms_hub_fortuna",
        label: "Fortuna Access",
        description: "Orb Vallis accessible. Solaris United standing available.",
        category: "Hubs",
        rule: { type: "all", prereqIds: [PR.HUB_FORTUNA] }
    },
    {
        id: "ms_hub_necralisk",
        label: "Necralisk Access",
        description: "Cambion Drift accessible. Entrati and Necraloid standing available.",
        category: "Hubs",
        rule: { type: "all", prereqIds: [PR.HUB_NECRALISK] }
    },
    {
        id: "ms_hub_all_three_core",
        label: "All Three Core Open Worlds Accessible",
        description: "Cetus, Fortuna, and Necralisk all accessible.",
        category: "OpenWorlds",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.HUB_CETUS, PR.HUB_FORTUNA, PR.HUB_NECRALISK] }
    },
    {
        id: "ms_hub_zariman",
        label: "Zariman Access",
        description: "Chrysalith and Holdfasts syndicate accessible.",
        category: "Hubs",
        rule: { type: "all", prereqIds: [PR.HUB_ZARIMAN] }
    },
    {
        id: "ms_hub_sanctum",
        label: "Sanctum Anatomica Access",
        description: "Cavia syndicate accessible.",
        category: "Hubs",
        rule: { type: "all", prereqIds: [PR.HUB_SANCTUM] }
    },
    {
        id: "ms_hub_hollvania",
        label: "Höllvania Access",
        description: "1999 content accessible.",
        category: "Hubs",
        rule: { type: "all", prereqIds: [PR.HUB_HOLLVANIA] }
    },
    {
        id: "ms_hub_all_open_worlds",
        label: "All Open Worlds Accessible",
        description: "All six hubs open: Cetus, Fortuna, Necralisk, Zariman, Sanctum, and Höllvania.",
        category: "OpenWorlds",
        showWhenComplete: true,
        rule: {
            type: "all",
            prereqIds: [
                PR.HUB_CETUS, PR.HUB_FORTUNA, PR.HUB_NECRALISK,
                PR.HUB_ZARIMAN, PR.HUB_SANCTUM, PR.HUB_HOLLVANIA
            ]
        }
    },

    // =========================================================================
    // ORBITER SEGMENTS
    // =========================================================================
    {
        id: "ms_orbiter_personal_quarters",
        label: "Personal Quarters Installed",
        description: "Apostasy Prologue can now be triggered.",
        category: "Orbiter",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SEGMENT_PERSONAL_QUARTERS] }
    },
    {
        id: "ms_orbiter_void_relics",
        label: "Void Relic Segment Installed",
        description: "Void Fissures and Relic refinement available.",
        category: "Orbiter",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SEGMENT_VOID_RELIC] }
    },
    {
        id: "ms_orbiter_incubator",
        label: "Incubator Installed",
        description: "Kubrow and Kavat companion breeding available.",
        category: "Orbiter",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SEGMENT_INCUBATOR] }
    },
    {
        id: "ms_orbiter_melee_upgrade",
        label: "Melee Upgrade Segment Installed",
        description: "Melee Exilus and Melee Arcane slots unlocked.",
        category: "Orbiter",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SEGMENT_MELEE_UPGRADE] }
    },

    // =========================================================================
    // HELMINTH
    // =========================================================================
    {
        id: "ms_helminth_base",
        label: "Helminth Unlocked",
        description: "Helminth subsume system active. Can subsume Warframe abilities.",
        category: "Helminth",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SEGMENT_HELMINTH] }
    },
    {
        id: "ms_helminth_invigorations",
        label: "Helminth Invigorations Available",
        description: "Weekly Invigoration buffs unlocked.",
        category: "Helminth",
        rule: { type: "all", prereqIds: [PR.SEGMENT_HELMINTH_INVIGORATION] }
    },
    {
        id: "ms_helminth_archon_shards",
        label: "Archon Shard Socketing Available",
        description: "Archon Shards can be slotted into Warframes for stat bonuses.",
        category: "Helminth",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SEGMENT_HELMINTH_ARCHON_SHARD] }
    },
    {
        id: "ms_helminth_coalescent",
        label: "Tauforged Shard Crafting Available",
        description: "Archon Shards can be fused into Tauforged shards for stronger bonuses.",
        category: "Helminth",
        rule: { type: "all", prereqIds: [PR.SEGMENT_HELMINTH_COALESCENT] }
    },
    {
        id: "ms_helminth_full",
        label: "Full Helminth System Unlocked",
        description: "All four Helminth segments installed: base, invigorations, Archon shards, and Coalescent.",
        category: "Helminth",
        showWhenComplete: true,
        rule: {
            type: "all",
            prereqIds: [
                PR.SEGMENT_HELMINTH,
                PR.SEGMENT_HELMINTH_INVIGORATION,
                PR.SEGMENT_HELMINTH_ARCHON_SHARD,
                PR.SEGMENT_HELMINTH_COALESCENT
            ]
        }
    },

    // =========================================================================
    // NECRAMECH
    // =========================================================================
    {
        id: "ms_necramech_unlocked",
        label: "Necramech System Unlocked",
        description: "Can deploy a Necramech in open worlds and Railjack. Required for The New War.",
        category: "Necramech",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.NECRAMECH_UNLOCKED] }
    },

    // =========================================================================
    // RAILJACK
    // =========================================================================
    {
        id: "ms_railjack_constructed",
        label: "Railjack Built",
        description: "Railjack is constructed and ready for missions.",
        category: "Railjack",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.RAILJACK_CONSTRUCTED] }
    },

    // =========================================================================
    // DUVIRI
    // =========================================================================
    {
        id: "ms_duviri_unlocked",
        label: "Duviri Unlocked",
        description: "The Duviri Paradox complete. Circuit and Drifter Intrinsics available.",
        category: "Duviri",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.DUVIRI_PARADOX] }
    },

    // =========================================================================
    // SYNDICATES — KEY MILESTONES
    // =========================================================================
    {
        id: "ms_syndicate_entrati_helminth",
        label: "Entrati: Helminth Segments Available",
        description: "Entrati Associate rank reached; the base Helminth Segment also requires MR8.",
        category: "Syndicates",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SYNDICATE_ENTRATI_RANK3, PR.MR_8] }
    },
    {
        id: "ms_syndicate_entrati_family",
        label: "Entrati: Family Rank",
        description: "Max Entrati rank reached; the Helminth Invigoration Segment also requires MR8.",
        category: "Syndicates",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SYNDICATE_ENTRATI_RANK5, PR.MR_8] }
    },
    {
        id: "ms_syndicate_cavia_family",
        label: "Cavia: Family Rank",
        description: "Maximum Cavia rank. Weekly Archon Shard purchasing from Cavalero unlocked.",
        category: "Syndicates",
        showWhenComplete: true,
        rule: { type: "all", prereqIds: [PR.SYNDICATE_CAVIA_RANK5] }
    },
];
