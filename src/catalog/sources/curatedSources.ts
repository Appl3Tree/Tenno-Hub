// ===== FILE: src/catalog/sources/curatedSources.ts =====

import { PR } from "../../domain/ids/prereqIds";

export type CuratedRawSource = {
    id: string;
    label: string;
    type?: "drop" | "crafting" | "vendor" | "other";
    prereqIds?: string[];
};

export const CURATED_SOURCES: CuratedRawSource[] = [
    // Pets / companions
    { id: "data:pets/kavat", label: "Breed a Kavat (Incubator)", type: "other", prereqIds: ["segment_incubator"] },
    { id: "data:pets/kubrow", label: "Breed a Kubrow (Incubator)", type: "other", prereqIds: ["quest_howl_of_the_kubrow", "segment_incubator"] },
    { id: "data:pets/helminth-charger", label: "Incubate a Helminth Charger", type: "other", prereqIds: ["quest_howl_of_the_kubrow", "segment_incubator"] },
    { id: "data:pets/moa", label: "Craft a MOA companion in Fortuna", type: "other", prereqIds: ["hub_fortuna"] },
    { id: "data:companions/hound-bhaira", label: "Claim a Hound with the Bhaira model (Sisters of Parvos)", type: "other", prereqIds: ["activity_sister_of_parvos"] },
    { id: "data:companions/precept-sentinel", label: "Granted upon obtaining the relevant Sentinel", type: "other" },
    { id: "data:companions/precept-moa", label: "Granted upon obtaining the relevant MOA companion", type: "other", prereqIds: ["hub_fortuna"] },
    { id: "data:companions/precept-kubrow", label: "Granted upon obtaining the relevant Kubrow breed", type: "other", prereqIds: ["quest_howl_of_the_kubrow", "segment_incubator"] },
    { id: "data:companions/precept-kavat", label: "Granted upon obtaining the relevant Kavat breed", type: "other", prereqIds: ["segment_incubator"] },
    { id: "data:companions/precept-deimos-pet", label: "Granted upon obtaining the relevant Deimos companion", type: "other", prereqIds: ["hub_necralisk"] },
    { id: "data:companions/posture-vendors", label: "Buy posture mods from Teasonai, The Business, or Son", type: "vendor" },

    // Crafting
    { id: "data:crafting", label: "Craft in the Foundry", type: "crafting" },

    // Market (only two useful buckets)
    { id: "data:market/credits", label: "Buy from the Market (Credits)", type: "vendor" },
    { id: "data:market/platinum", label: "Buy from the Market (Platinum)", type: "vendor" },

    // System / account
    { id: "data:system/daily-tribute", label: "Earn from Daily Tribute", type: "other" },
    { id: "data:system/starter", label: "Receive as a starter item", type: "other" },
    { id: "data:system/focus", label: "Unlock and rank within the Focus Schools", type: "other", prereqIds: ["quest_the_second_dream"] },
    { id: "data:system/set-bonus-record", label: "Internal set-bonus record", type: "other" },
    { id: "data:system/veiled-riven", label: "Receive as a Veiled Riven Mod", type: "other" },
    { id: "data:warframe/khora", label: "Receive with Khora", type: "other", prereqIds: ["hub_relay", "quest_the_new_strange"] },
    { id: "data:warframe/khora-prime", label: "Receive with Khora Prime", type: "other" },
    { id: "data:necramech/arquebex-archgun", label: "Receive when claiming any Necramech (Voidrig or Bonewidow)", type: "other", prereqIds: ["system_necramech_unlocked"] },
    { id: "data:necramech/first-claim", label: "Receive automatically after claiming your first Necramech", type: "other", prereqIds: ["system_necramech_unlocked"] },
    { id: "data:foundry/air-support-blueprint", label: "Instantly available in the Foundry for Air Support Charges", type: "other" },
    { id: "data:landing-craft/liset", label: "Unlock by acquiring the Liset Landing Craft", type: "other", prereqIds: ["quest_vors_prize"] },
    { id: "data:landing-craft/mantis", label: "Unlock by acquiring the Mantis Landing Craft", type: "other" },
    { id: "data:landing-craft/nightwave", label: "Unlock by acquiring the Nightwave Landing Craft", type: "other", prereqIds: ["activity_nightwave"] },
    { id: "data:landing-craft/parallax", label: "Unlock by acquiring the Parallax Landing Craft", type: "other" },
    { id: "data:landing-craft/scimitar", label: "Unlock by acquiring the Scimitar Landing Craft", type: "other" },
    { id: "data:landing-craft/skaut", label: "Unlock by acquiring the Skaut Landing Craft", type: "other", prereqIds: ["quest_veilbreaker"] },
    { id: "data:landing-craft/xiphos", label: "Unlock by acquiring the Xiphos Landing Craft", type: "other" },
    { id: "data:railjack/armaments", label: "Research Sigma armaments in a Clan Dojo Dry Dock or repair salvaged armaments in Proxima", type: "other", prereqIds: [PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS] },
    { id: "data:quest/vors-prize", label: "Earn from completing Vor's Prize", type: "other" },
    { id: "data:junction/mercury-venus", label: "Earn from completing the Mercury Junction", type: "other", prereqIds: ["junction_mercury_venus"] },
    { id: "data:junction/earth-mars", label: "Earn from completing the Earth -> Mars Junction", type: "other", prereqIds: ["junction_earth_mars"] },
    { id: "data:junction/mars-phobos", label: "Earn from completing the Mars -> Phobos Junction", type: "other", prereqIds: ["junction_mars_phobos"] },
    { id: "data:junction/mars-ceres", label: "Earn from completing the Mars -> Ceres Junction", type: "other", prereqIds: ["junction_mars_ceres"] },
    { id: "data:junction/ceres-jupiter", label: "Earn from completing the Jupiter Junction on Deimos", type: "other", prereqIds: ["junction_ceres_jupiter"] },
    { id: "data:junction/jupiter-europa", label: "Earn from completing the Jupiter -> Europa Junction", type: "other", prereqIds: ["junction_jupiter_europa"] },
    { id: "data:junction/europa-saturn", label: "Earn from completing the Europa -> Saturn Junction", type: "other", prereqIds: ["junction_europa_saturn"] },
    { id: "data:junction/saturn-uranus", label: "Earn from completing the Saturn -> Uranus Junction", type: "other", prereqIds: ["junction_saturn_uranus"] },
    { id: "data:junction/uranus-neptune", label: "Earn from completing the Uranus -> Neptune Junction", type: "other", prereqIds: ["junction_uranus_neptune"] },
    { id: "data:junction/neptune-pluto", label: "Earn from completing the Neptune -> Pluto Junction", type: "other", prereqIds: ["junction_neptune_pluto"] },
    { id: "data:junction/pluto-sedna", label: "Earn from completing the Pluto -> Eris Junction", type: "other", prereqIds: ["junction_pluto_sedna"] },
    { id: "data:junction/sedna-eris", label: "Earn from completing the Eris -> Sedna Junction", type: "other", prereqIds: ["junction_sedna_eris"] },
    { id: "data:lua/challenge-room", label: "Complete an Orokin Moon challenge room", type: "drop", prereqIds: ["quest_the_second_dream"] },
    { id: "data:duviri/circuit/steel-path", label: "Earn from The Steel Path Circuit", type: "drop", prereqIds: ["quest_the_duviri_paradox", "activity_steel_path", "hub_zariman"] },
    { id: "data:duviri/circuit/warframe-rewards", label: "Earn Warframe blueprints from The Circuit", type: "drop", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:duviri/enigma", label: "Solve Enigma puzzles in Duviri", type: "drop", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:vendor/duviri/teshins-cave", label: "Buy a Duviri melee weapon blueprint from Teshin (Pathos Clamps)", type: "vendor", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:vendor/zariman/cephalon-melica", label: "Buy Narin, Nunchasa, and Aksondol blueprints from Cephalon Melica (Entropic Kuva)", type: "vendor", prereqIds: [PR.ANGELS_ZARIMAN, PR.WHISPERS_WALL] },

    // Time-gated / vendors
    { id: "data:baro/void-trader", label: "Buy from Baro Ki’Teer (Ducats + Credits)", type: "vendor", prereqIds: ["hub_relay"] },
    { id: "data:vendor/steel-path/teshin", label: "Buy from Teshin (Steel Path Honors)", type: "vendor", prereqIds: ["activity_steel_path_honors"] },
    { id: "data:nightwave/cred-offerings", label: "Buy from Nightwave Cred Offerings", type: "vendor", prereqIds: ["activity_nightwave"] },
    { id: "data:nightwave/rank-reward", label: "Earn from Nightwave rank rewards", type: "other", prereqIds: ["activity_nightwave"] },
    { id: "data:nightwave/general", label: "Earn from Nightwave rewards or Cred Offerings", type: "other", prereqIds: ["activity_nightwave"] },
    { id: "data:nightwave/standing", label: "Earn Nightwave standing", type: "other", prereqIds: ["activity_nightwave"] },
    { id: "data:nightwave/glassmaker", label: "Legacy Glassmaker / Nihil reward path (no longer generally obtainable)", type: "other" },
    { id: "data:vendor/cetus/nakak/operational-supply", label: "Buy from Nakak (Operational Supply / Plague Star)", type: "vendor", prereqIds: ["hub_cetus"] },
    { id: "data:vendor/cetus/nakak/synthicator-blueprints", label: "Buy Synthicator blueprints from Nakak (Cetus)", type: "vendor", prereqIds: ["hub_cetus"] },

    // Quests
    { id: "data:quest/the-sacrifice", label: "Earn from completing The Sacrifice quest", type: "other", prereqIds: ["quest_apostasy_prologue"] },
    { id: "data:quest/chimera-prologue", label: "Earn from completing Chimera Prologue", type: "other", prereqIds: ["quest_the_sacrifice"] },
    { id: "data:quest/the-archwing", label: "Earn from completing The Archwing quest", type: "other", prereqIds: ["junction_earth_mars"] },
    { id: "data:quest/the-new-strange", label: "Earn from completing The New Strange quest", type: "other", prereqIds: ["quest_stolen_dreams", "junction_jupiter_europa"] },
    { id: "data:quest/octavias-anthem", label: "Earn from completing Octavia's Anthem", type: "other", prereqIds: ["quest_the_second_dream"] },
    { id: "data:quest/rising-tide", label: "Earn from completing Rising Tide", type: "other", prereqIds: ["quest_the_war_within"] },
    { id: "data:quest/the-jordas-precept", label: "Earn from progressing through The Jordas Precept quest", type: "other", prereqIds: ["quest_the_archwing", "junction_pluto_sedna"] },
    { id: "data:quest/the-limbo-theorem", label: "Earn from progressing through The Limbo Theorem quest", type: "other", prereqIds: ["quest_the_archwing", "junction_jupiter_europa"] },
    { id: "data:quest/patient-zero", label: "Earn from completing Patient Zero", type: "other", prereqIds: ["quest_once_awake", "junction_pluto_sedna"] },
    { id: "data:quest/the-silver-grove", label: "Earn from progressing through The Silver Grove quest", type: "other", prereqIds: ["quest_the_second_dream"] },
    { id: "data:quest/whispers-in-the-walls", label: "Earn from completing Whispers in the Walls", type: "other", prereqIds: ["quest_heart_of_deimos", "quest_the_new_war"] },
    { id: "data:quest/the-waverider", label: "Earn from completing The Waverider", type: "other", prereqIds: ["quest_vox_solaris"] },
    { id: "data:quest/the-war-within", label: "Earn from completing The War Within", type: "other", prereqIds: ["quest_the_second_dream"] },
    { id: "data:quest/veilbreaker", label: "Earn from completing Veilbreaker", type: "other", prereqIds: ["quest_the_new_war"] },
    { id: "data:quest/the-old-peace", label: "Earn from completing The Old Peace", type: "other", prereqIds: ["quest_the_lotus_eaters"] },
    { id: "data:quest/the-teacher", label: "Earn from completing The Teacher", type: "other", prereqIds: ["quest_vors_prize"] },
    { id: "data:quest/the-hex", label: "Earn from completing The Hex", type: "other", prereqIds: ["quest_the_hex"] },
    { id: "data:quest/the-duviri-paradox", label: "Earn from completing The Duviri Paradox", type: "other", prereqIds: ["junction_saturn_uranus"] },
    { id: "data:quest/vox-solaris", label: "Earn from completing Vox Solaris", type: "other", prereqIds: ["hub_fortuna"] },

    // Unobtainable
    { id: "data:unobtainable/founders", label: "Unobtainable (Founders)", type: "other" },
    { id: "data:unobtainable/legacy", label: "Unobtainable legacy item", type: "other" },
    { id: "data:unobtainable/shelved", label: "Unavailable shelved item", type: "other" },
    { id: "data:unobtainable/dev-only", label: "Unavailable internal/dev item", type: "other" },

    // Operator / amps
    { id: "data:operator/amp-starter", label: "Receive as a starter amp component", type: "other" },

    // Duviri
    { id: "data:duviri/circuit", label: "The Circuit", type: "drop", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:duviri/kullervo", label: "Farm Kullervo in Duviri", type: "drop", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:vendor/duviri/acrithis", label: "Buy from Acrithis (Duviri)", type: "vendor", prereqIds: ["quest_the_duviri_paradox"] },

    // Dagath / Arbitrations
    { id: "data:abyssal-zone/dagath", label: "Farm Dagath in the Abyssal Zone", type: "drop", prereqIds: ["activity_abyssal_zone", "system_clan_dojo_access"] },
    { id: "data:arbitrations/grendel", label: "Farm Grendel via Arbitration locators", type: "drop", prereqIds: ["activity_arbitrations"] },
    { id: "data:vendor/arbitrations/galatea", label: "Buy from Arbitration Honors (Arbiters of Hexis)", type: "vendor", prereqIds: ["activity_arbitrations"] },

    // Invasions
    { id: "data:invasion/rewards", label: "Earn from Invasion rewards", type: "drop", prereqIds: ["activity_invasions"] },

    // Variant series (taxonomy only, but still readable)
    { id: "data:variants/wraith", label: "Wraith variant series", type: "other" },
    { id: "data:variants/vandal", label: "Vandal variant series", type: "other" },
    { id: "data:variants/prime", label: "Prime variant series", type: "other" },
    { id: "data:variants/kuva", label: "Kuva Lich variant series", type: "other" },
    { id: "data:variants/tenet", label: "Tenet variant series", type: "other" },

    // Conclave (single buckets, no aliases)
    { id: "data:conclave", label: "Play Conclave (PvP)", type: "other", prereqIds: ["hub_relay"] },
    { id: "data:events/plague-star", label: "Play Plague Star (event)", type: "other", prereqIds: ["hub_cetus"] },
    { id: "data:requiem/oull", label: "Earn Oull from Requiem sources (Liches, Sisters, or Requiem relics)", type: "other" },

    // Open-world vendors
    { id: "data:vendor/cetus/ostron", label: "Buy from Ostrons (Cetus)", type: "vendor", prereqIds: ["hub_cetus"] },
    { id: "data:vendor/cetus/quills", label: "Buy from The Quills (Cetus)", type: "vendor", prereqIds: ["system_onkko_visited"] },
    { id: "data:vendor/cetus/hai-luk", label: "Buy from Hai-Luk (Cetus)", type: "vendor", prereqIds: ["hub_cetus"] },
    { id: "data:vendor/cetus/nakak", label: "Nakak (Cetus)", type: "vendor", prereqIds: ["hub_cetus"] },
    { id: "data:vendor/cetus/koumei-shrine", label: "Buy from Koumei's Shrine (Cetus)", type: "vendor", prereqIds: ["hub_cetus", "activity_steel_path"] },
    { id: "data:vendor/cetus/teasonai", label: "Buy from Master Teasonai (Cetus)", type: "vendor", prereqIds: ["hub_cetus"] },
    { id: "data:vendor/cetus/suumbaat", label: "Buy from Old Man Suumbaat (Cetus)", type: "vendor", prereqIds: ["hub_cetus"] },

    { id: "data:vendor/fortuna/solaris-united", label: "Buy from Solaris United (Fortuna)", type: "vendor", prereqIds: ["hub_fortuna"] },
    { id: "data:vendor/fortuna/vox-solaris", label: "Buy from Vox Solaris (Fortuna)", type: "vendor", prereqIds: ["quest_vox_solaris", "system_onkko_visited"] },
    { id: "data:vendor/fortuna/ventkids", label: "Buy from Ventkids (Fortuna)", type: "vendor", prereqIds: ["quest_vox_solaris"] },
    { id: "data:vendor/fortuna/business", label: "Buy from The Business (Fortuna)", type: "vendor", prereqIds: ["hub_fortuna"] },
    { id: "data:vendor/fortuna/smokefinger", label: "Buy from Smokefinger (Fortuna)", type: "vendor", prereqIds: ["hub_fortuna"] },

    { id: "data:vendor/deimos/entrati", label: "Buy from the Entrati Family (Deimos)", type: "vendor", prereqIds: ["hub_necralisk"] },
    { id: "data:vendor/deimos/necraloid", label: "Buy from Necraloid (Deimos)", type: "vendor", prereqIds: ["quest_heart_of_deimos", "quest_the_war_within"] },
    { id: "data:vendor/deimos/father", label: "Buy from Father (Deimos)", type: "vendor", prereqIds: ["hub_necralisk"] },
    { id: "data:vendor/deimos/son", label: "Buy from Son (Deimos)", type: "vendor", prereqIds: ["hub_necralisk"] },
    { id: "data:vendor/deimos/daughter", label: "Buy from Daughter (Deimos)", type: "vendor", prereqIds: ["hub_necralisk"] },
    { id: "data:vendor/deimos/otak", label: "Buy from Otak (Deimos)", type: "vendor", prereqIds: ["hub_necralisk"] },
    { id: "data:vendor/deimos/mother", label: "Buy from Mother (Deimos)", type: "vendor", prereqIds: ["hub_necralisk"] },

    { id: "data:vendor/zariman/holdfasts", label: "Buy from the Holdfasts (Zariman)", type: "vendor", prereqIds: ["hub_zariman"] },
    { id: "data:vendor/zariman/cavalero", label: "Buy from Cavalero (Zariman)", type: "vendor", prereqIds: ["hub_zariman"] },
    { id: "data:vendor/zariman/yonta", label: "Buy from Archimedean Yonta (Zariman)", type: "vendor", prereqIds: ["hub_zariman"] },

    { id: "data:vendor/sanctum/cavia", label: "Buy from Cavia (Sanctum Anatomica)", type: "vendor", prereqIds: ["hub_sanctum_anatomica"] },
    { id: "data:vendor/sanctum/loid", label: "Buy from Loid (Sanctum Anatomica)", type: "vendor", prereqIds: ["hub_sanctum_anatomica"] },
    { id: "data:vendor/sanctum/bird-3/researcher", label: "Buy from Bird 3 (Cavia Researcher rank)", type: "vendor", prereqIds: ["hub_sanctum_anatomica", "syndicate_cavia_rank2"] },
    { id: "data:vendor/kahl-garrison/chipper", label: "Buy from Chipper (Kahl’s Garrison)", type: "vendor", prereqIds: ["quest_veilbreaker"] },

    // Other key vendors
    { id: "data:vendor/simaris", label: "Buy from Cephalon Simaris", type: "vendor", prereqIds: ["hub_relay", "quest_the_new_strange"] },
    { id: "data:vendor/darvo", label: "Buy from Darvo", type: "vendor", prereqIds: ["hub_relay"] },
    { id: "data:vendor/iron-wake/palladino", label: "Buy from Palladino (Iron Wake)", type: "vendor", prereqIds: ["quest_chains_of_harrow"] },
    { id: "data:vendor/relay/aspirant-zorba", label: "Buy from Aspirant Zorba (Relay)", type: "vendor", prereqIds: ["quest_chains_of_harrow"] },
    { id: "data:vendor/relay/varzia", label: "Buy from Varzia (Prime Resurgence)", type: "vendor", prereqIds: ["hub_relay"] },
    { id: "data:vendor/relay/legs", label: "Buy from Legs (Fortuna)", type: "vendor", prereqIds: ["hub_fortuna"] },
    { id: "data:vendor/fortuna/nightcap", label: "Buy from Nightcap (Fortuna Airlock)", type: "vendor", prereqIds: ["hub_fortuna", "quest_the_new_war"] },

    // Lich systems
    { id: "data:lich/kuva", label: "Earn from Kuva Liches", type: "other", prereqIds: ["activity_kuva_lich"] },
    { id: "data:lich/tenet", label: "Earn from Sisters of Parvos", type: "other", prereqIds: ["activity_sister_of_parvos"] },
    { id: "data:lich/infested-coda", label: "Technocyte Coda (earn currency, purchase Coda weapons)", type: "other", prereqIds: ["activity_technocyte_coda"] },

    // Fortuna Deepmines
    { id: "data:activity/deepmines/bounties", label: "Run Deepmines bounties (Fortuna Airlock)", type: "drop", prereqIds: ["hub_fortuna", "quest_the_new_war"] },
    { id: "data:deepmines/gathering", label: "Gather in the Deepmines", type: "drop", prereqIds: ["hub_fortuna", "quest_the_new_war"] },

    // Misc sources you already reference
    { id: "data:vendor/roathe/la-cathedrale", label: "Buy from Roathe (La Cathédrale)", type: "vendor", prereqIds: ["quest_the_old_peace"] },

    { id: "data:activity/souterrains/bounties", label: "Run Souterrains bounties", type: "drop", prereqIds: ["hub_fortuna", "quest_the_new_war"] },

    // The Descendia (used for Uriel components)
    { id: "data:activity/the-descendia/maphica", label: "Earn Maphica in The Descendia", type: "drop", prereqIds: ["quest_the_old_peace"] },
    { id: "data:activity/the-descendia/oblivion-on-infernium-21", label: "Oblivion on Infernium 21 (The Descendia)", type: "other", prereqIds: ["quest_the_old_peace"] },
    { id: "data:activity/the-descendia", label: "Run The Descendia", type: "drop", prereqIds: ["quest_the_old_peace"] },
    { id: "data:vendor/marie-leroux/la-cathedrale", label: "Buy from Marie Leroux (La Cathédrale)", type: "vendor", prereqIds: ["quest_the_old_peace"] },

    { id: "data:activity/cetus/conservation", label: "Earn from conservation in Plains of Eidolon", type: "drop", prereqIds: ["hub_cetus"] },
    { id: "data:activity/deimos/conservation", label: "Earn from conservation in Cambion Drift", type: "drop", prereqIds: ["hub_necralisk"] },
    { id: "data:activity/fortuna/conservation", label: "Earn from conservation in Orb Vallis", type: "drop", prereqIds: ["hub_fortuna"] },
    { id: "data:activity/plants/scanning", label: "Scan plants in missions with a Codex or Synthesis Scanner", type: "drop" },
    { id: "data:activity/ascension", label: "Earn from Ascension missions", type: "drop", prereqIds: ["quest_jade_shadows"] },
    { id: "data:duviri/intrinsics/riding-9", label: "Earn by reaching Riding Intrinsics Rank 9 in Duviri", type: "other", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:railjack/intrinsics/command-9", label: "Earn by reaching Command Intrinsics Rank 9 in Railjack", type: "other", prereqIds: ["quest_rising_tide", "system_railjack_intrinsics"] },

    { id: "data:bounty/solaris-united", label: "Run Solaris United bounties", type: "drop", prereqIds: ["hub_fortuna"] },
    { id: "data:heist/profit-taker", label: "Run the Profit-Taker heist", type: "drop", prereqIds: ["hub_fortuna", "syndicate_solaris_united_rank5"] },
    { id: "data:heist/profit-taker/first-clear", label: "Receive on first Profit-Taker clear", type: "other", prereqIds: ["hub_fortuna", "syndicate_solaris_united_rank5"] },
    { id: "data:heist/exploiter-orb", label: "Defeat the Exploiter Orb", type: "drop", prereqIds: ["hub_fortuna", "syndicate_solaris_united_rank5"] },
    { id: "data:eidolon/hunts", label: "Run Eidolon hunts (Plains of Eidolon)", type: "drop", prereqIds: ["hub_cetus"] },
    { id: "data:eidolon/tridolon", label: "Run Gantulyst and Hydrolyst Eidolon hunts", type: "drop", prereqIds: ["hub_cetus"] },

    { id: "data:enemy-item/prosecutors", label: "Farm Prosecutors for drops", type: "drop", prereqIds: ["junction_mars_ceres"] },
    { id: "data:events/thermia-fractures", label: "Earn Diluted Thermia from Thermia Fractures in Orb Vallis", type: "drop", prereqIds: ["activity_thermia_fractures"] },

    { id: "data:tokens/deimos/father", label: "Earn Father Tokens in the Necralisk", type: "other", prereqIds: ["hub_necralisk"] },
    { id: "data:tokens/deimos/mother", label: "Earn Mother Tokens in the Necralisk", type: "other", prereqIds: ["hub_necralisk"] },
    { id: "data:tokens/deimos/son", label: "Earn Son Tokens in the Necralisk", type: "other", prereqIds: ["hub_necralisk"] },
    { id: "data:tokens/deimos/daughter", label: "Earn Daughter Tokens in the Necralisk", type: "other", prereqIds: ["hub_necralisk"] },
    { id: "data:tokens/deimos/otak", label: "Earn Otak Tokens in the Necralisk", type: "other", prereqIds: ["hub_necralisk"] },
    { id: "data:tokens/deimos/grandmother", label: "Earn Grandmother Tokens in the Necralisk", type: "other", prereqIds: ["hub_necralisk"] },

    { id: "data:syndicate/arbiters-medallions", label: "Find Arbiters of Hexis medallions in syndicate missions", type: "drop", prereqIds: ["hub_relay"] },
    { id: "data:syndicate/cephalon-suda-medallions", label: "Find Cephalon Suda medallions in syndicate missions", type: "drop", prereqIds: ["hub_relay"] },
    { id: "data:syndicate/new-loka-medallions", label: "Find New Loka medallions in syndicate missions", type: "drop", prereqIds: ["hub_relay"] },
    { id: "data:syndicate/perrin-sequence-medallions", label: "Find Perrin Sequence medallions in syndicate missions", type: "drop", prereqIds: ["hub_relay"] },
    { id: "data:syndicate/red-veil-medallions", label: "Find Red Veil medallions in syndicate missions", type: "drop", prereqIds: ["hub_relay"] },
    { id: "data:syndicate/steel-meridian-medallions", label: "Find Steel Meridian medallions in syndicate missions", type: "drop", prereqIds: ["hub_relay"] },

    { id: "data:node/murex/20-sentients", label: "Run Murex node (20 Sentients)", type: "drop" },

    // Dojo research
    { id: "data:dojo/chem-lab", label: "Research in Dojo Chem Lab", type: "vendor", prereqIds: ["system_clan_dojo_access"] },
    { id: "data:dojo/energy-lab", label: "Research in Dojo Energy Lab", type: "vendor", prereqIds: ["system_clan_dojo_access"] },
    { id: "data:dojo/bio-lab", label: "Research in Dojo Bio Lab", type: "vendor", prereqIds: ["system_clan_dojo_access"] },
    { id: "data:dojo/orokin-lab", label: "Research in Dojo Orokin Lab", type: "vendor", prereqIds: ["system_clan_dojo_access"] },
    { id: "data:dojo/research", label: "Research in the Dojo", type: "vendor", prereqIds: ["system_clan_dojo_access"] },
    { id: "data:clan/tenno-lab", label: "Research in Dojo Tenno Lab", type: "vendor", prereqIds: ["system_clan_dojo_access"] },
    { id: "data:dojo/dagaths-hollow", label: "Research in Dagath’s Hollow (Dojo)", type: "vendor", prereqIds: ["system_clan_dojo_access"] },
    { id: "data:clan/join", label: "Join or create a Clan", type: "other" },

    // Resource buckets
    { id: "data:resource/fieldron-sample", label: "Farm Fieldron Samples", type: "drop" },
    { id: "data:resource/detonite-ampule", label: "Farm Detonite Ampules", type: "drop" },
    { id: "data:resource/mutagen-sample", label: "Farm Mutagen Samples", type: "drop" },
    { id: "data:resource/mutagen-mass", label: "Craft or earn Mutagen Mass (invasions)", type: "other", prereqIds: ["activity_invasions"] },
    { id: "data:resource/detonite-injector", label: "Craft or earn Detonite Injectors (invasions)", type: "other", prereqIds: ["activity_invasions"] },
    { id: "data:resource/fieldron", label: "Craft or earn Fieldron (invasions)", type: "other", prereqIds: ["activity_invasions"] },

    // warframe-items emits these literal ids
    { id: "data:1999/resources", label: "Farm resources in 1999", type: "drop", prereqIds: ["hub_hollvania"] },
    { id: "data:bounties/narmer", label: "Run Narmer bounties", type: "drop", prereqIds: ["quest_the_new_war"] },
    { id: "data:enemy/zanuka-hunter", label: "Farm Zanuka Hunter for drops", type: "drop" },
    { id: "data:enemy/stalker", label: "Farm Stalker and Shadow Stalker for drops", type: "drop" },
    { id: "data:enemy/vem-tabook", label: "Farm Vem Tabook for drops", type: "drop" },
    { id: "data:enemy/domestik-drone", label: "Farm Domestik Drones for drops", type: "drop" },
    { id: "data:events/anniversary", label: "Play Anniversary event content", type: "drop" },
    { id: "data:events/scarlet-spear", label: "Buy during Operation: Scarlet Spear", type: "vendor" },
    { id: "data:events/fomorian-sabotage", label: "Respond to a Fomorian Sabotage event inbox", type: "other" },
    { id: "data:events/arid-fear", label: "Play Operation: Arid Fear event content", type: "other" },
    { id: "data:events/naberus", label: "Play Naberus event content", type: "drop", prereqIds: ["hub_necralisk"] },
    { id: "data:events/pyrus-project", label: "Progress through The Pyrus Project event", type: "other" },
    { id: "data:events/razorback-armada", label: "Respond to a Razorback Armada event inbox", type: "other" },
    { id: "data:enemy/ambulas-units", label: "Defeat and hack Ambulas units on Pluto", type: "drop", prereqIds: ["junction_neptune_pluto"] },
    { id: "data:activity/hollvania/scaldra-paratroopers", label: "Capture Thermian RPGs from Scaldra paratroopers in Höllvania", type: "drop", prereqIds: ["hub_hollvania"] },
    { id: "data:legacy/railjack-resource/general", label: "Farm in legacy Empyrean missions (removed in Update 29.10)", type: "drop", prereqIds: ["quest_rising_tide"] },
    { id: "data:legacy/railjack-resource/copernics", label: "Farm Copernics in legacy Empyrean missions or from Lua Eximus (removed in Update 29.10)", type: "drop" },
    { id: "data:legacy/railjack-resource/pustrels", label: "Farm Pustrels in legacy Empyrean missions or from Infested Eximus on Eris (removed in Update 29.10)", type: "drop" },

    // Fishing processing: include the NPC name (so the user does not have to leave the app)
    // (Open world fishing NPCs: Hai-Luk, The Business, Daughter)
    { id: "data:fishing/cetus/processing", label: "Process fish with Hai-Luk (Cetus)", type: "drop", prereqIds: ["hub_cetus"] },
    { id: "data:fishing/fortuna/processing", label: "Process fish with The Business (Fortuna)", type: "drop", prereqIds: ["hub_fortuna"] },
    { id: "data:fishing/deimos/processing", label: "Process fish with Daughter (Deimos)", type: "drop", prereqIds: ["hub_necralisk"] },

    { id: "data:container/rare-orokin-storage", label: "Open rare Orokin storage containers", type: "drop" },
    { id: "data:container/rare-grineer-storage", label: "Open rare Grineer storage containers", type: "drop" },
    { id: "data:container/forgotten-grineer-storage", label: "Open forgotten Grineer storage containers", type: "drop" },
    { id: "data:container/rare-corpus-storage", label: "Open rare Corpus storage containers", type: "drop" },
    { id: "data:container/reinforced-carrypod", label: "Open Zariman reinforced carrypods", type: "drop", prereqIds: ["hub_zariman"] },

    { id: "data:openworld/cetus/mining", label: "Mine in Plains of Eidolon", type: "drop", prereqIds: ["hub_cetus"] },
    { id: "data:openworld/fortuna/mining", label: "Mine in Orb Vallis", type: "drop", prereqIds: ["hub_fortuna"] },
    { id: "data:openworld/deimos/mining", label: "Mine in Cambion Drift", type: "drop", prereqIds: ["hub_necralisk"] },
    { id: "data:openworld/deimos/orokin-vault", label: "Open Orokin Vaults in Deimos missions", type: "drop", prereqIds: ["junction_mars_deimos"] },
    { id: "data:openworld/deimos/entrati-lab", label: "Farm in Albrecht’s Laboratories (Deimos)", type: "drop", prereqIds: ["hub_sanctum_anatomica"] },
    { id: "data:openworld/cetus/vasca", label: "Earn Vasca Kavat imprints (Plains of Eidolon)", type: "drop", prereqIds: ["hub_cetus"] },
    { id: "data:openworld/duviri", label: "Farm in Duviri", type: "drop", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:openworld/duviri/shrines", label: "Run Duviri shrines", type: "drop", prereqIds: ["quest_the_duviri_paradox"] },
    { id: "data:openworld/zariman", label: "Farm in the Zariman", type: "drop", prereqIds: ["hub_zariman"] },

    { id: "data:relics/ducats", label: "Earn Ducats from relics", type: "drop" },
    { id: "data:system/helminth", label: "Use the Helminth system", type: "drop", prereqIds: ["segment_helminth"] },

    { id: "data:vendor/cetus/hok", label: "Buy from Hok (Cetus)", type: "vendor", prereqIds: ["hub_cetus"] },
    { id: "data:vendor/fortuna/legs", label: "Buy from Legs (Fortuna)", type: "vendor", prereqIds: ["hub_fortuna"] },
    { id: "data:vendor/fortuna/rude-zuud", label: "Buy from Rude Zuud (Fortuna)", type: "vendor", prereqIds: ["hub_fortuna"] },
    { id: "data:vendor/hollvania/the-hex", label: "Buy from The Hex (Höllvania)", type: "vendor", prereqIds: ["hub_hollvania"] },

    { id: "data:node/deimos/albrechts-laboratories", label: "Node: Deimos - Albrecht’s Laboratories", type: "drop", prereqIds: ["hub_sanctum_anatomica"] },
    { id: "data:node/earth/cetus", label: "Node: Earth - Cetus", type: "drop", prereqIds: ["hub_cetus"] },
    { id: "data:node/venus/orb-vallis", label: "Node: Venus - Orb Vallis", type: "drop", prereqIds: ["hub_fortuna"] },

    // Legacy missionreward ids (kept as-is because other layers may emit them)
    { id: "data:missionreward/deimos/albrechts-laboratories", label: "Legacy: Albrecht’s Laboratories bounty", type: "drop", prereqIds: ["hub_sanctum_anatomica"] },
    { id: "data:missionreward/deimos/albrechts-laboratories/rotationc", label: "Legacy: Albrecht’s Laboratories bounty (Rotation C)", type: "drop", prereqIds: ["hub_sanctum_anatomica"] },
    { id: "data:missionreward/saturn/lunaro", label: "Legacy: Lunaro mission reward", type: "other", prereqIds: ["hub_relay"] },
    { id: "data:missionreward/saturn/lunaro/rotationb", label: "Legacy: Lunaro mission reward (Rotation B)", type: "other", prereqIds: ["hub_relay"] },
];
