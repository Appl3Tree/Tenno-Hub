// ===== FILE: src/domain/ids/prereqIds.ts =====
//
// Comprehensive registry of all trackable prerequisites in Warframe.
// Updated: 2026-11 — current progression gates verified through Update 44.1.
//
// Naming convention:
//   QUEST_*      — story or side quest completion gate  (key prefix is the quest name)
//   JUNCTION_    — star chart junction (planet-to-planet unlock)
//   HUB_*        — open-world / hub access
//   SYSTEM_*     — major gameplay system unlock (feature gate, not a quest)
//   SEGMENT_*    — Orbiter segment installation
//   FOCUS_*      — Focus school / Operator progression milestones
//   AMP_*        — Operator Amp tier unlocks
//   COMPANION_*  — companion system unlock milestones
//   NECRAMECH_*  — Necramech system milestones
//   RAILJACK_*   — Railjack system milestones
//   ACTIVITY_*   — specific repeatable endgame activity access gates
//   SYNDICATE_*  — syndicate rank milestones that gate content
//   MR_*         — Mastery Rank thresholds that gate content
//
// ⚠️  REGISTRY NOTE: Adding a key here does NOT automatically surface it in the
//     planner. You must also add a matching entry in prereqRegistry.ts with its
//     displayName, category, and prerequisites array.
//
// Sources verified against:
//   warframe.fandom.com/wiki/Quest | wiki.warframe.com/w/Orbiter_Segments
//   wiki.warframe.com/w/Focus | wiki.warframe.com/w/The_Steel_Path
//   wiki.warframe.com/w/Sortie | wiki.warframe.com/w/Arbitrations
//   wiki.warframe.com/w/Archon_Hunt | wiki.warframe.com/w/Helminth

export const PR = {

    // =========================================================================
    // MAIN STORY QUESTS
    // =========================================================================

    // -------------------------------------------------------------------------
    // Arc 1 — The Awakening (tutorial + early game)
    // -------------------------------------------------------------------------
    AWAKENING:              "quest_awakening",             // First-login quest and direct predecessor to Vor's Prize
    VORS_PRIZE:             "quest_vors_prize",             // Forced tutorial after Awakening; installs base Orbiter segments
    THE_TEACHER:            "quest_the_teacher",            // Modding tutorial (Update 40, Oct 2025)
    ONCE_AWAKE:             "quest_once_awake",             // Mercury Grineer arc; req. Mercury Junction
    ARCHWING:               "quest_the_archwing",           // Unlocks Archwing gear + missions; current wiki page lists Mars Junction
    STOLEN_DREAMS:          "quest_stolen_dreams",          // Unlocks Cephalon Simaris relay scanner; req. Phobos Junction
    NEW_STRANGE:            "quest_the_new_strange",        // Unlocks Simaris standing + Chroma BP; req. Stolen Dreams
    NATAH:                  "quest_natah",                  // Automatically unlocked after The Archwing; no Uranus scan/junction gate

    // -------------------------------------------------------------------------
    // Arc 2 — The Second Dream / War Within
    // -------------------------------------------------------------------------
    SECOND_DREAM:           "quest_the_second_dream",       // Unlocks Operator/Transcendence, Focus (partial); req. Natah
    WAR_WITHIN:             "quest_the_war_within",         // Upgrades Operator to full Transference + Void powers;
                                                            //   unlocks Kuva Fortress, Sorties, Kuva Lich;
                                                            //   gates full Focus tree + Quills access;
                                                            //   req. Neptune → Pluto Junction; no current MR gate
    CHAINS_HARROW:          "quest_chains_of_harrow",       // Harrow BP; req. visit Onkko after War Within (not Mote Amp ownership)
    APOSTASY:               "quest_apostasy_prologue",      // Short cinematic; req. War Within + Personal Quarters segment
    SACRIFICE:              "quest_the_sacrifice",          // Excalibur Umbra; req. Apostasy Prologue

    // -------------------------------------------------------------------------
    // Arc 3 — The New War
    // -------------------------------------------------------------------------
    CHIMERA_PROLOGUE:       "quest_chimera_prologue",       // Short cinematic; req. The Sacrifice
    ERRA:                   "quest_erra",                   // Short cinematic; req. Chimera Prologue
    PRELUDE_TO_WAR:         "quest_prelude_to_war",         // Compilation of miniquests; req. Erra
    NEW_WAR:                "quest_the_new_war",            // Major story gate; Prelude to War + owned Railjack (Rising Tide or Market);
                                                            //   Amp and owned Necramech are not current requirements
    JADE_SHADOWS:           "quest_jade_shadows",           // Jade Warframe; req. New War

    // -------------------------------------------------------------------------
    // Arc 4 — The Duviri Paradox
    // Current Codex unlock is the Saturn → Uranus Junction reward; completion is
    // REQUIRED for The Hex even though it is not part of the main quest spine.
    // -------------------------------------------------------------------------
    DUVIRI_PARADOX:         "quest_the_duviri_paradox",     // Unlocks The Circuit, Drifter Intrinsics, Incarnon Genesis adapters;
                                                            //   required prerequisite for The Hex

    // -------------------------------------------------------------------------
    // Arc 5 — Angels of Zariman / Whispers in the Walls / 1999
    // -------------------------------------------------------------------------
    ANGELS_ZARIMAN:         "quest_angels_of_the_zariman",  // Zariman hub, Holdfasts syndicate, Incarnon weapons; req. New War
    WHISPERS_WALL:          "quest_whispers_in_the_walls",  // Sanctum Anatomica, Netracells, Qorvex; req. Angels of Zariman
    THE_LOTUS_EATERS:       "quest_the_lotus_eaters",       // Gates The Hex; req. Whispers in the Walls
    THE_HEX:                "quest_the_hex",                // Hollvania / 1999 content; req. Lotus Eaters + Duviri Paradox

    // -------------------------------------------------------------------------
    // Arc 6 — The Old Peace (Update 41, Dec 2025)
    // -------------------------------------------------------------------------
    THE_OLD_PEACE:          "quest_the_old_peace",          // Dark Refractory / Descendia content; req. The Lotus Eaters
    JADE_SHADOWS_CONSTELLATIONS: "quest_jade_shadows_constellations", // Update 43; requires Jade Shadows
    THE_HEX_FINALE:         "quest_the_hex_finale",         // Update 38 epilogue; all Hex members Liked at rank 3
    TAU_PROLOGUE:           "quest_tau_prologue_series",    // Update 44.1.2; requires both The Hex and The Old Peace

    // =========================================================================
    // SIDE QUESTS — Feature Gates
    // =========================================================================

    HOWL_KUBROW:            "quest_howl_of_the_kubrow",     // Unlocks Kubrow incubation & breeding; req. Mercury Junction path
    SAYA_VIGIL:             "quest_sayas_vigil",            // Gara BP; combined with War Within unlocks The Quills; req. one Cetus Bounty
    VOX_SOLARIS:            "quest_vox_solaris",            // Unlocks Vox Solaris syndicate; auto-starts on first Fortuna visit
    HEART_OF_DEIMOS:        "quest_heart_of_deimos",        // Unlocks Necralisk / Cambion Drift / Entrati; req. Earth->Mars Junction
    RISING_TIDE:            "quest_rising_tide",            // Unlocks Railjack construction; current gate is War Within (Update 39)
    VEILBREAKER:            "quest_veilbreaker",            // Unlocks Kahl's Garrison + Archon Hunts; req. New War
    CALL_TEMPESTARII:       "quest_call_of_the_tempestarii",// Unlocks Sisters of Parvos + Railjack Corpus nodes; req. Railjack + Deadlock Protocol + MR4
    DEADLOCK_PROTOCOL:      "quest_the_deadlock_protocol",  // Protea BP; Sisters of Parvos eligibility; req. Saturn Junction + MR4

    // =========================================================================
    // SIDE QUESTS — Warframe Blueprint Quests
    // =========================================================================

    LIMBO_THEOREM:          "quest_the_limbo_theorem",      // Limbo BP; req. Void access
    SILVER_GROVE:           "quest_the_silver_grove",       // Titania BP; Second Dream + MR7; start by speaking to New Loka at a Relay
    SANDS_INAROS:           "quest_sands_of_inaros",        // Inaros BP; MR5; beacon can be bought or traded
    OCTAVIA_ANTHEM:         "quest_octavias_anthem",        // Octavia BP; req. Lua access (Earth-Lua junction)
    JORDAS_PRECEPT:         "quest_the_jordas_precept",     // Atlas BP; req. Pluto->Eris Junction
    GLAST_GAMBIT:           "quest_the_glast_gambit",       // Nidus BP; req. War Within
    MASK_REVENANT:          "quest_mask_of_the_revenant",   // Revenant BP; req. Quills rank 2 (Observer)
    HIDDEN_MESSAGES:        "quest_hidden_messages",        // Mirage BP; req. Saturn access
    WAVERIDER:             "quest_the_waverider",          // Yareli BP; req. Vox Solaris + MR3
    PATIENT_ZERO:           "quest_patient_zero",           // Infested Salvage node + Mesa BP; lists Once Awake + Eris access

    // =========================================================================
    // STAR CHART JUNCTIONS
    // =========================================================================

    JUNCTION_MERCURY_VENUS:         "junction_mercury_venus",
    JUNCTION_VENUS_EARTH:           "junction_venus_earth",
    JUNCTION_EARTH_MARS:            "junction_earth_mars",
    JUNCTION_MARS_PHOBOS:           "junction_mars_phobos",
    JUNCTION_MARS_CERES:            "junction_mars_ceres",
    DEIMOS_ACCESS:                 "junction_mars_deimos",            // Legacy saved-state key; Deimos opens after War on Mars, not a Junction
    JUNCTION_PHOBOS_CERES:          "junction_phobos_ceres",          // Legacy saved-state key; removed from current Star Chart path
    JUNCTION_CERES_JUPITER:         "junction_ceres_jupiter",        // Stable legacy key for the current Deimos-located Jupiter Junction
    JUNCTION_JUPITER_EUROPA:        "junction_jupiter_europa",
    JUNCTION_EUROPA_SATURN:         "junction_europa_saturn",
    JUNCTION_SATURN_URANUS:         "junction_saturn_uranus",
    JUNCTION_URANUS_NEPTUNE:        "junction_uranus_neptune",
    JUNCTION_NEPTUNE_PLUTO:         "junction_neptune_pluto",
    JUNCTION_PLUTO_SEDNA:           "junction_pluto_sedna",          // Stable key for current Pluto → Eris Junction (profile mapping)
    JUNCTION_SEDNA_ERIS:            "junction_sedna_eris",            // Stable key for current Eris → Sedna Junction (profile mapping)
    SYSTEM_ERIS_FOCUS_LENS:         "system_eris_junction_focus_lens", // Eris Junction task; its completion unlocks Arbitrations
    JUNCTION_EARTH_LUA:             "junction_earth_lua",             // Legacy saved-state key; now tracks Lua access after The Second Dream
    // Stable saved-state key retained from the old pseudo-junction model.
    KUVA_FORTRESS_ACCESS:           "junction_eris_kuva_fortress",

    // =========================================================================
    // OPEN WORLD HUBS
    // =========================================================================

    HUB_CETUS:              "hub_cetus",                    // Plains of Eidolon; gates Ostron / The Quills / Eidolon hunts
    HUB_FORTUNA:            "hub_fortuna",                  // Orb Vallis; gates Solaris United / Vox Solaris / Profit-Taker
    HUB_NECRALISK:          "hub_necralisk",                // Cambion Drift; gates Entrati / Necraloid / Helminth segment
    HUB_ZARIMAN:            "hub_zariman",                  // Chrysalith; gates Holdfasts; req. Angels of Zariman
    HUB_SANCTUM:            "hub_sanctum_anatomica",        // Sanctum Anatomica; gates Cavia; req. Whispers in the Walls
    HUB_HOLLVANIA:          "hub_hollvania",                // 1999 hub; req. The Hex
    HUB_YUVAN_PEAK:         "hub_yuvan_peak",               // Update 44; req. Angels of the Zariman + Whispers in the Walls
    HUB_PONTIS_TOWER:       "hub_pontis_tower",             // Update 43; unlocked with Uranus Proxima
    HUB_LA_CATHEDRALE:      "hub_la_cathedrale",            // Update 41; Old Peace complete, enter as the Drifter
    HUB_RELAY:              "hub_relay",                    // Any Relay; gates Cephalon Simaris, Syndicates, Conclave
    HUB_DRIFTERS_CAMP:      "hub_drifters_camp",            // Drifter's Camp; gates Kahl's Garrison; req. New War
    CLAN_DOJO:              "system_clan_dojo_access",      // Join or create a Clan and access its Dojo; gates clan research and dojo replication
    CLAN_DRY_DOCK:          "system_clan_dry_dock_access",  // Access a Clan Dojo with a constructed Dry Dock

    // =========================================================================
    // ORBITER SEGMENTS
    // =========================================================================

    // Obtained via Vor's Prize (base ship function; always present):
    SEGMENT_ARSENAL:                "segment_arsenal",
    SEGMENT_COMMUNICATIONS:         "segment_communications",
    SEGMENT_FOUNDRY:                "segment_foundry",
    SEGMENT_MODDING:                "segment_modding_table",

    // Obtained via Junctions or Quests:
    SEGMENT_INCUBATOR:              "segment_incubator",                // Companion incubation; granted by Howl of the Kubrow
    SEGMENT_KAVAT_UPGRADE:          "segment_kavat_upgrade",            // Installed Kavat Incubator Upgrade Segment
    SEGMENT_VOID_RELIC:             "segment_void_relic",               // Void fissures & relics
    SEGMENT_PERSONAL_QUARTERS:      "segment_personal_quarters",        // War Within quest reward; REQUIRED for Apostasy Prologue
    SEGMENT_MELEE_UPGRADE:          "segment_melee_upgrade",            // Melee Arcanes + Exilus slots; Whispers in the Walls reward

    // Helminth sub-segments (all require SEGMENT_HELMINTH installed first):
    SEGMENT_HELMINTH:               "segment_helminth",                 // Base Helminth subsume system;
                                                                        //   MR8 + Entrati rank 3 (Associate);
                                                                        //   purchased from Son for 15,000 Standing;
                                                                        //   also requires Heart of Deimos quest
    SEGMENT_HELMINTH_INVIGORATION:  "segment_helminth_invigoration",    // Weekly Invigoration buffs;
                                                                        //   MR8 + Entrati rank 5 (Family);
                                                                        //   purchased from Son for 30,000 Standing
    SEGMENT_HELMINTH_ARCHON_SHARD:  "segment_helminth_archon_shard",    // Archon Shard socketing into Warframes;
                                                                        //   blueprint reward from completing Veilbreaker
    SEGMENT_HELMINTH_COALESCENT:    "segment_helminth_coalescent",      // Archon Shard fusion (create Tauforged shards);
                                                                        //   purchased from Bird 3 (Cavia);
                                                                        //   req. Cavia rank 2 (Researcher)
    SEGMENT_HELMINTH_SON_ACCESS:    "system_helminth_son_segment_access", // Son purchase route: MR8 + Entrati rank 3
    SEGMENT_HELMINTH_INVIGORATION_SON_ACCESS: "system_helminth_invigoration_son_access", // Son route: MR8 + Entrati rank 5
    HELMINTH_MARKET_BUNDLE:         "system_helminth_market_bundle_acquired", // Purchased Helminth Segments Market bundle

    // =========================================================================
    // OPERATOR / FOCUS SYSTEM
    // =========================================================================

    FOCUS_UNLOCKED:                 "focus_system_unlocked",            // Focus passives (2 per school); req. Second Dream completion
    FOCUS_FULL:                     "focus_full_trees_unlocked",        // All 10 Ways per school unlockable;
                                                                        //   req. War Within + Quills Rank 1 (Cetus access; Saya's Vigil is not required)

    // Focus Schools (choose 1 at end of Second Dream; buy others for 50,000 Focus each):
    FOCUS_SCHOOL_ZENURIK:           "focus_school_zenurik",             // Energy/Void regen — most popular for energy sustain
    FOCUS_SCHOOL_VAZARIN:           "focus_school_vazarin",             // Healing / Operator survival
    FOCUS_SCHOOL_NARAMON:           "focus_school_naramon",             // Melee combo / shadow step
    FOCUS_SCHOOL_UNAIRU:            "focus_school_unairu",              // Defense stripping / armor break
    FOCUS_SCHOOL_MADURAI:           "focus_school_madurai",             // Damage amp / Void Strike (Eidolon meta)

    // =========================================================================
    SYSTEM_TAURON_STRIKE:           "system_tauron_strike",              // Permanent Tauron Strike access after acquiring a Tektolyst Artifact

    // AMP SYSTEM (Operator weapon tiers)
    // Tiers 1–4 from The Quills (Cetus); tiers 5–7 from Vox Solaris (Fortuna)
    // =========================================================================

    AMP_MOTE:               "amp_mote",                                 // Mote Amp item ownership, kept on its stable saved-state key
    SYSTEM_OPERATOR_AMP:    "system_operator_amp_owned",                // Any owned Operator Amp satisfies The New War's Amp gate
    SYSTEM_RANK30_WARFRAME: "system_rank30_warframe_eligible",           // Rank 30 Warframe or MR30+Forma exception for Sorties/Arbitrations
    SYSTEM_ADVERSARY_SLOT_CLEAR: "system_adversary_slot_clear",          // Manual dynamic gate: no active Kuva Lich, Sister, or Technocyte Coda
    SYSTEM_ONKKO_VISITED:    "system_onkko_visited",                     // Current Chains of Harrow gate: visit Onkko after War Within
    AMP_SIROCCO:            "amp_sirocco",                              // Pre-built Amp reward from The New War
    AMP_TIER1:              "amp_tier1_parts",                          // Raplak/Pencha/Clapkra parts; req. Quills rank 1
    AMP_TIER2:              "amp_tier2_parts",                          // Shwaak/Shraksun/Juttni parts; req. Quills rank 2
    AMP_TIER3:              "amp_tier3_parts",                          // Granmu/Phahd/Lohrin parts; req. Quills rank 3
    AMP_TIER4:              "amp_tier4_parts",                          // Propa/Klebrik/Certus parts; req. Quills rank 4 (Architect)
    AMP_TIER5:              "amp_tier5_parts",                          // Propa scaffold / T5 brace; req. Vox Solaris rank 1
    AMP_TIER6:              "amp_tier6_parts",                          // T6 parts; req. Vox Solaris rank 2
    AMP_TIER7:              "amp_tier7_parts",                          // T7 parts (best-in-slot); req. Vox Solaris rank 3
    AMP_GILDING:            "amp_gilding_unlocked",                     // Gild Amp (base dmg boost + Lens slot); req. Quills rank 3 or Vox rank 3

    // =========================================================================
    // COMPANION SYSTEMS
    // =========================================================================

    COMPANION_KUBROW:               "companion_kubrow_breeding",        // Kubrow; req. Howl of the Kubrow + Incubator segment
    COMPANION_KAVAT:                "companion_kavat_breeding",         // Kavat; requires the Incubator plus Kavat upgrade segment
    COMPANION_HELMINTH_CHARGER:     "companion_helminth_charger",       // Requires the Incubator plus a mature Helminth Cyst
    COMPANION_MATURE_CYST:          "companion_mature_helminth_cyst",   // Manual, dynamic prerequisite for Helminth Charger incubation
    COMPANION_MOA:                  "companion_moa",                    // MOA robotic companion; crafted in Fortuna; req. Solaris United rank 1
    COMPANION_HOUND:                "companion_hound",                  // Hound; obtained by keeping a defeated Sister of Parvos's Hound
    COMPANION_PREDASITE:            "companion_predasite",              // Req. Necralisk + Daughter (Son's sister); Deimos companion
    COMPANION_VULPAPHYLA:           "companion_vulpaphyla",             // Req. Necralisk + Daughter; Deimos fox companion
    COMPANION_NAUTILUS:             "companion_nautilus",               // Archwing companion; blueprint from Rising Tide quest

    // =========================================================================
    // NECRAMECH SYSTEM
    // =========================================================================

    NECRAMECH_UNLOCKED:     "system_necramech_unlocked",                // Open-world use; requires War Within and an owned Necramech
    NECRAMECH_VOIDRIG:      "system_necramech_voidrig",                 // Voidrig build/acquisition milestone; blueprint from Heart of Deimos
    NECRAMECH_BONEWIDOW:    "system_necramech_bonewidow",               // Bonewidow build/acquisition milestone; main BP at Necraloid R3
    NECRAMECH_MARKET:       "system_necramech_market_acquired",         // Pre-built Necramech purchased from the Market
    NECRAMECH_RAILJACK_DEPLOYMENT: "system_necramech_railjack_deployment", // Deploy an owned Necramech in Railjack; Tactical 5

    // =========================================================================
    // RAILJACK SYSTEM
    // =========================================================================

    RAILJACK_CONSTRUCTED:   "system_railjack_constructed",              // Railjack built + playable; req. Rising Tide quest
    RAILJACK_MARKET_ACQUIRED: "system_railjack_market_acquired",         // Purchased Railjack ownership alternative to Rising Tide
    RAILJACK_INTRINSICS:    "system_railjack_intrinsics",               // Intrinsics skill tree; can be progressed after joining Railjack missions
    RAILJACK_CORPUS_NODES:  "system_railjack_corpus_nodes",             // Corpus Proxima nodes; req. Call of the Tempestarii
    RAILJACK_VOID_STORMS:   "system_railjack_void_storms",              // Compatibility alias for general Void Storm access
    SYSTEM_PROXIMA_ACCESS:          "system_proxima_access",             // Proxima public mission access after The Archwing
    SYSTEM_PROXIMA_SATURN_ACCESS:   "system_proxima_saturn_access",      // Saturn Proxima; any Railjack Intrinsic Rank 3
    SYSTEM_PROXIMA_NEPTUNE_ACCESS:  "system_proxima_neptune_access",     // Neptune Proxima; any Railjack Intrinsic Rank 3
    SYSTEM_PROXIMA_PLUTO_ACCESS:    "system_proxima_pluto_access",       // Pluto Proxima; any Railjack Intrinsic Rank 5
    SYSTEM_PROXIMA_VEIL_ACCESS:     "system_proxima_veil_access",        // Veil Proxima; any Railjack Intrinsic Rank 7
    SYSTEM_RAILJACK_ARMAMENTS_ACCESS: "system_railjack_armaments_access", // Sigma research in Dojo or salvaged armaments in Proxima

    // =========================================================================
    // ENDGAME ACTIVITIES
    // =========================================================================

    // ---- Daily ----
    ACTIVITY_SORTIES:               "activity_sorties",                 // Daily 3-mission Sortie; req. War Within + MR5 + rank-30 frame
    ACTIVITY_INVASIONS:            "activity_invasions",               // Invasion missions available
    ACTIVITY_NIGHTMARE:            "activity_nightmare_missions",      // Nightmare mission access; req. all nodes complete on a planet
    ACTIVITY_THERMIA_FRACTURES:    "activity_thermia_fractures",       // Orb Vallis event; requires access to Orb Vallis
    ACTIVITY_NIGHTWAVE:             "activity_nightwave",               // Nightwave system active/unlocked enough to earn Creds and rank rewards
    ACTIVITY_ROPALOLYST:            "activity_ropalolyst",              // Jupiter boss node; req. Chimera Prologue + Jupiter node access
    ACTIVITY_INDEX:                 "activity_the_index",               // The Index arena on Neptune
    ACTIVITY_DEFECTION:             "activity_defection",               // Defection missions

    // ---- Weekly ----
    ACTIVITY_NETRACELLS:            "activity_netracells",              // 5x weekly Netracell runs; req. Whispers in the Walls
    ACTIVITY_ARBITRATIONS:          "activity_arbitrations",            // Arbitration rotation; req. Eris Junction task "Equip a Focus Lens" (Update 39+)
                                                                        //   rank-30 frame required; instant-death on down
    ACTIVITY_ABYSSAL_ZONE:          "activity_abyssal_zone",            // Abyssal Zone mission access; req. Relay access + any pledged main Syndicate at Rank 2
    ACTIVITY_DEEP_ARCHIMEDEA:       "activity_deep_archimedea",         // Elite endgame activity; req. Whispers + Cavia rank 5 (Family)
    ACTIVITY_NETRACELL_COMPLETED:   "activity_netracell_completed",     // Persistent milestone: at least one Netracell has been completed
    ACTIVITY_SISTER_VANQUISHED:     "activity_sister_vanquished",       // Manual milestone for the vanquished Sister's Hound reward
    ACTIVITY_ELITE_DEEP_ARCHIMEDEA: "activity_elite_deep_archimedea",   // Manually track permanent unlock after 25 research points
    ACTIVITY_TEMPORAL_ARCHIMEDEA:   "activity_temporal_archimedea",     // Update 38; Hex quest + Hex rank 5
    ACTIVITY_ELITE_TEMPORAL_ARCHIMEDEA: "activity_elite_temporal_archimedea", // Manually track permanent unlock after 25 research points
    ACTIVITY_ICEBIND:               "activity_icebind",                 // Update 44.1; two quests + either Elite Archimedea unlock
    ACTIVITY_FOLLIES_HUNT:          "activity_follies_hunt",            // Update 42; Chains of Harrow
    ACTIVITY_ASPIRANT_ZORBA:        "activity_aspirant_zorba_vendor",    // Update 42; Chains of Harrow
    ACTIVITY_DARK_REFRACTORY:       "activity_dark_refractory",         // Update 41; Old Peace or conditional mission preview
    ACTIVITY_DESCENDIA:             "activity_descendia",               // Update 41; accessible from Dark Refractory
    ACTIVITY_PERITA_REBELLION:      "activity_perita_rebellion",        // Update 41; accessible from Dark Refractory
    ACTIVITY_FABLES_FRONTIERS:      "activity_fables_frontiers",        // Update 43.5; Hex finale/rank 5/Amir Close
    SYSTEM_URANUS_PROXIMA:          "system_uranus_proxima",             // Update 43; Jade Shadows: Constellations
    ACTIVITY_KUVA_WYTCH:            "activity_kuva_wytch",               // Update 43 Uranus Proxima mission
    ACTIVITY_SCORIAS_ANGEL:         "activity_scorias_angel",            // Update 43 Uranus Proxima mission
    SYSTEM_DEVILS_TRIAD_KIM:        "system_devils_triad_kim",           // Update 41; The Old Peace
    SYSTEM_DARK_REFRACTORY_PREVIEW: "system_dark_refractory_preview",     // Update 41; opt-in to Mission Preview after The Teacher
    SYSTEM_HEX_ALL_LIKED:           "system_hex_all_liked",              // Manual KIM state; Rank 3 + Liked with six members
    SYSTEM_AMIR_CLOSE:              "system_amir_chemistry_close",       // Manual KIM state; Amir Chemistry Rank 5

    // ---- Open World Bounties ----
    ACTIVITY_CETUS_BOUNTY_COMPLETED: "activity_cetus_bounty_completed", // Manual Saya's Vigil unlock task: complete one Cetus bounty
    // ---- Steel Path ----
    ACTIVITY_STEEL_PATH:            "activity_steel_path",              // Steel Path star chart toggle;
                                                                        //   req. all pre-New-War connected nodes cleared
                                                                        //   (excluding Jordas Golem, Mutalist Alad V, Brutus, and post-New-War tilesets)
    ACTIVITY_STEEL_PATH_HONORS:     "activity_steel_path_honors",       // Teshin's shop for Steel Essence; req. Steel Path + any Relay
    ACTIVITY_CIRCUIT_STEEL_PATH:    "activity_circuit_steel_path",      // Steel Path Circuit (Incarnon Genesis adapters);
                                                                        //   req. Duviri Paradox + Steel Path

    // ---- Void Fissures ----
    ACTIVITY_VOID_FISSURES:         "activity_void_fissures",           // Fissure missions on unlocked nodes; segment is for refining relics
    ACTIVITY_VOID_STORMS:           "activity_void_storms",             // Join after Archwing or host with an owned Railjack
    ACTIVITY_KUVA_SIPHON:           "activity_kuva_siphon",             // Kuva Siphon/Flood missions; requires MR5 + War Within

    // ---- Nemesis Systems ----
    ACTIVITY_KUVA_LICH:             "activity_kuva_lich",               // Kuva Lich creation; War Within + MR5 + owned Railjack + empty slot
    ACTIVITY_SISTER_PARVOS:         "activity_sister_of_parvos",        // Sister creation; req. War Within + Call of Tempestarii + MR5 + empty adversary slot
    ACTIVITY_TECHNOCYTE_CODA:       "activity_technocyte_coda",         // Coda creation; The Hex + no active Kuva Lich/Sister; Railjack only for final showdown

    // ---- The Circuit (Duviri) ----
    ACTIVITY_CIRCUIT:               "activity_the_circuit",             // Circuit run mode; req. Duviri Paradox

    // =========================================================================
    // SYNDICATE RANK MILESTONES
    // (Track when specific rank-gated content becomes available)
    // =========================================================================

    // The Quills (Cetus) — gates Amp tiers and Mask of the Revenant:
    SYNDICATE_QUILLS_RANK1:         "syndicate_quills_rank1",           // Mote — T1 Amp parts
    SYNDICATE_QUILLS_RANK2:         "syndicate_quills_rank2",           // Observer — T2 Amp parts + Mask of the Revenant
    SYNDICATE_QUILLS_RANK3:         "syndicate_quills_rank3",           // Adherent — T3 Amp parts
    SYNDICATE_QUILLS_RANK4:         "syndicate_quills_rank4",           // Instrument — T4 Amp parts
    SYNDICATE_QUILLS_RANK5:         "syndicate_quills_rank5",           // Architect — final Quills standing rank

    // The Holdfasts (Zariman) — gates Chrysalith vendor inventory:
    SYNDICATE_HOLDFASTS_RANK1:      "syndicate_holdfasts_rank1",        // Fallen
    SYNDICATE_HOLDFASTS_RANK2:      "syndicate_holdfasts_rank2",        // Watcher
    SYNDICATE_HOLDFASTS_RANK3:      "syndicate_holdfasts_rank3",        // Guardian
    SYNDICATE_HOLDFASTS_RANK4:      "syndicate_holdfasts_rank4",        // Seraph
    SYNDICATE_HOLDFASTS_RANK5:      "syndicate_holdfasts_rank5",        // Angel

    // Entrati (Necralisk) — gates Helminth:
    SYNDICATE_ENTRATI_RANK1:        "syndicate_entrati_rank1",          // Stranger
    SYNDICATE_ENTRATI_RANK2:        "syndicate_entrati_rank2",          // Acquaintance
    SYNDICATE_ENTRATI_RANK3:        "syndicate_entrati_rank3",          // Associate (rank 3) — Helminth Segment blueprint rank gate
    SYNDICATE_ENTRATI_RANK4:        "syndicate_entrati_rank4",          // Friend (rank 4)
    SYNDICATE_ENTRATI_RANK5:        "syndicate_entrati_rank5",          // Family (rank 5) — Invigoration Segment rank gate

    // Cavia (Sanctum Anatomica) — gates Coalescent + Deep Archimedea:
    SYNDICATE_CAVIA_RANK1:          "syndicate_cavia_rank1",            // Stranger
    SYNDICATE_CAVIA_RANK2:          "syndicate_cavia_rank2",            // Researcher — Helminth Coalescent Segment BP (Bird 3)
    SYNDICATE_CAVIA_RANK3:          "syndicate_cavia_rank3",            // Collaborator
    SYNDICATE_CAVIA_RANK4:          "syndicate_cavia_rank4",            // Genius
    SYNDICATE_CAVIA_RANK5:          "syndicate_cavia_rank5",            // Illuminate — weekly Archon Shard purchase
    SYNDICATE_NECRALOID_RANK1:      "syndicate_necraloid_rank1",        // Clearance: Agnesis
    SYNDICATE_NECRALOID_RANK2:      "syndicate_necraloid_rank2",        // Clearance: Modus
    SYNDICATE_NECRALOID_RANK3:      "syndicate_necraloid_rank3",        // Clearance: Odima — Bonewidow blueprint
    SYNDICATE_SOLARIS_RANK5:        "syndicate_solaris_united_rank5",   // Old Mate — required for Orb Vallis heists
    SYNDICATE_SOLARIS_RANK1:        "syndicate_solaris_united_rank1",   // Outworlder
    SYNDICATE_SOLARIS_RANK2:        "syndicate_solaris_united_rank2",   // Rapscallion
    SYNDICATE_SOLARIS_RANK3:        "syndicate_solaris_united_rank3",   // Doer
    SYNDICATE_SOLARIS_RANK4:        "syndicate_solaris_united_rank4",   // Cove

    // The Hex (Höllvania / 1999) — gates Temporal Archimedea:
    SYNDICATE_HEX_RANK4:            "syndicate_hex_rank4",              // Hot & Fresh; requires The Hex Finale
    SYNDICATE_HEX_RANK5:            "syndicate_hex_rank5",              // Pizza Party (rank 5) — Temporal Archimedea access

    // Vox Solaris (Fortuna) — gates Profit-Taker + T5–7 Amp parts:
    SYNDICATE_VOX_RANK1:            "syndicate_vox_rank1",              // Operative — T5 Amp parts
    SYNDICATE_VOX_RANK2:            "syndicate_vox_rank2",              // Agent — T6 Amp parts
    SYNDICATE_VOX_RANK3:            "syndicate_vox_rank3",              // Hand — T7 Amp parts + Amp gilding
    SYNDICATE_VOX_RANK4:            "syndicate_vox_rank4",              // Instrument — rank 4 Little Duck offerings
    SYNDICATE_VOX_RANK5:            "syndicate_vox_rank5",              // Shadow — top-tier Little Duck offerings

    // =========================================================================
    // MASTERY RANK THRESHOLDS
    // =========================================================================

    MR_5:                           "mastery_rank_5",                   // Gates: Sorties, Vay Hek node on Oro (Earth)
    MR_8:                           "mastery_rank_8",                   // Gates: Helminth Segment + Invigoration Segment purchase
    MR_10:                          "mastery_rank_10",                  // Common informal threshold for certain content
    MR_15:                          "mastery_rank_15",                  // Various item purchase gates
    MR_30:                          "mastery_rank_30",                  // Riven cap, some quality-of-life features

} as const;

export type PrereqId = (typeof PR)[keyof typeof PR];
