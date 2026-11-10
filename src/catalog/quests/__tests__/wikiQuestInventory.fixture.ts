/**
 * Independently transcribed from the current WARFRAME Wiki Quest index and
 * individual quest pages on 2026-11-10. This expected inventory is deliberately
 * not generated from Tenno-Hub data; it is a regression oracle for bidirectional
 * quest-catalog / Handbook reconciliation.
 */
export type WikiQuestClassification = "main" | "side" | "warframe";

export interface WikiQuestInventoryEntry {
    internalId: string;
    canonicalName: string;
    classification: WikiQuestClassification;
    sourceUrl: string;
    subgroup?: string;
    introducedIn?: string;
}

export const WIKI_QUEST_INVENTORY: WikiQuestInventoryEntry[] = [
    { internalId: "quest_awakening", canonicalName: "Awakening", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Quest", subgroup: "Arc 1: Tenno Awakening" },
    { internalId: "quest_vors_prize", canonicalName: "Vor's Prize", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Vor%27s_Prize", subgroup: "Arc 1: Tenno Awakening" },
    { internalId: "quest_the_teacher", canonicalName: "The Teacher", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Teacher", subgroup: "Arc 1: Tenno Awakening" },
    { internalId: "quest_vox_solaris", canonicalName: "Vox Solaris", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Vox_Solaris_%28Quest%29", subgroup: "Arc 1: Tenno Awakening" },
    { internalId: "quest_once_awake", canonicalName: "Once Awake", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Once_Awake", subgroup: "Arc 1: Tenno Awakening" },
    { internalId: "quest_heart_of_deimos", canonicalName: "Heart of Deimos", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Heart_of_Deimos", subgroup: "Arc 1: Tenno Awakening" },
    { internalId: "quest_the_archwing", canonicalName: "The Archwing", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Archwing", subgroup: "Arc 1: Tenno Awakening" },

    { internalId: "quest_natah", canonicalName: "Natah", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Natah_%28Quest%29", subgroup: "Arc 2: This Is What You Are" },
    { internalId: "quest_the_second_dream", canonicalName: "The Second Dream", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Second_Dream", subgroup: "Arc 2: This Is What You Are" },
    { internalId: "quest_the_war_within", canonicalName: "The War Within", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_War_Within", subgroup: "Arc 2: This Is What You Are" },
    { internalId: "quest_rising_tide", canonicalName: "Rising Tide", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Rising_Tide", subgroup: "Arc 2: This Is What You Are" },
    { internalId: "quest_chains_of_harrow", canonicalName: "Chains of Harrow", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Chains_of_Harrow", subgroup: "Arc 2: This Is What You Are" },
    { internalId: "quest_apostasy_prologue", canonicalName: "Apostasy Prologue", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Apostasy_Prologue", subgroup: "Arc 2: This Is What You Are" },
    { internalId: "quest_the_sacrifice", canonicalName: "The Sacrifice", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Sacrifice", subgroup: "Arc 2: This Is What You Are" },

    { internalId: "quest_chimera_prologue", canonicalName: "Chimera Prologue", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Chimera_Prologue", subgroup: "Arc 3: The New War · Prelude to War" },
    { internalId: "quest_erra", canonicalName: "Erra", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Erra_%28Quest%29", subgroup: "Arc 3: The New War · Prelude to War" },
    { internalId: "quest_prelude_to_war", canonicalName: "The Maker", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Maker", subgroup: "Arc 3: The New War · Prelude to War" },
    { internalId: "quest_the_new_war", canonicalName: "The New War", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_New_War", subgroup: "Arc 3: The New War" },
    { internalId: "quest_the_duviri_paradox", canonicalName: "The Duviri Paradox", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Duviri_Paradox", subgroup: "Arc 3: The New War" },

    { internalId: "quest_whispers_in_the_walls", canonicalName: "Whispers in the Walls", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Whispers_in_the_Walls", subgroup: "Arc 4: Void War Saga · Kalymos Sequence" },
    { internalId: "quest_the_lotus_eaters", canonicalName: "The Lotus Eaters", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Lotus_Eaters", subgroup: "Arc 4: Void War Saga · Kalymos Sequence" },
    { internalId: "quest_the_hex", canonicalName: "The Hex", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Hex_%28Quest%29", subgroup: "Arc 4: Void War Saga · Kalymos Sequence" },
    { internalId: "quest_the_hex_finale", canonicalName: "Finale", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Hex_%28Quest%29", subgroup: "Arc 4: Void War Saga · Kalymos Sequence" },
    { internalId: "quest_the_old_peace", canonicalName: "The Old Peace", classification: "main", sourceUrl: "https://wiki.warframe.com/w/The_Old_Peace", subgroup: "Arc 4: Void War Saga · Kalymos Sequence" },
    { internalId: "quest_tau_prologue_lua", canonicalName: "Lua", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Lua_(Quest)", subgroup: "Arc 4: Void War Saga · Prologue to Tau", introducedIn: "Hotfix 44.1.2 (2026-10-15)" },
    { internalId: "quest_tau_prologue_vessel", canonicalName: "Vessel", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Vessel_(Quest)", subgroup: "Arc 4: Void War Saga · Prologue to Tau", introducedIn: "Hotfix 44.1.2 (2026-10-15)" },
    { internalId: "quest_jade_shadows", canonicalName: "Jade Shadows", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Jade_Shadows", subgroup: "Arc 4: Void War Saga · Jade Shadows Arc" },
    { internalId: "quest_jade_shadows_constellations", canonicalName: "Jade Shadows: Constellations", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Jade_Shadows:_Constellations", subgroup: "Arc 4: Void War Saga · Jade Shadows Arc", introducedIn: "Update 43 (2026-06-17)" },
    { internalId: "quest_angels_of_the_zariman", canonicalName: "Angels of the Zariman", classification: "main", sourceUrl: "https://wiki.warframe.com/w/Angels_of_the_Zariman", subgroup: "Arc 4: Void War Saga · One-Offs" },

    { internalId: "quest_howl_of_the_kubrow", canonicalName: "Howl of the Kubrow", classification: "side", sourceUrl: "https://wiki.warframe.com/w/Howl_of_the_Kubrow" },
    { internalId: "quest_stolen_dreams", canonicalName: "Stolen Dreams", classification: "side", sourceUrl: "https://wiki.warframe.com/w/Stolen_Dreams" },
    { internalId: "quest_veilbreaker", canonicalName: "Veilbreaker", classification: "side", sourceUrl: "https://wiki.warframe.com/w/Veilbreaker" },
    { internalId: "quest_patient_zero", canonicalName: "Patient Zero", classification: "side", sourceUrl: "https://wiki.warframe.com/w/Patient_Zero" },
    { internalId: "quest_a_man_of_few_words", canonicalName: "A Man of Few Words", classification: "side", sourceUrl: "https://wiki.warframe.com/w/A_Man_of_Few_Words" },
    { internalId: "quest_sayas_vigil", canonicalName: "Saya's Vigil", classification: "side", sourceUrl: "https://wiki.warframe.com/w/Saya%27s_Vigil" },

    { internalId: "quest_the_deadlock_protocol", canonicalName: "The Deadlock Protocol", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/The_Deadlock_Protocol" },
    { internalId: "quest_call_of_the_tempestarii", canonicalName: "Call of the Tempestarii", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/Call_of_the_Tempestarii" },
    { internalId: "quest_the_new_strange", canonicalName: "The New Strange", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/The_New_Strange" },
    { internalId: "quest_the_glast_gambit", canonicalName: "The Glast Gambit", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/The_Glast_Gambit" },
    { internalId: "quest_octavias_anthem", canonicalName: "Octavia's Anthem", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/Octavia%27s_Anthem" },
    { internalId: "quest_sands_of_inaros", canonicalName: "Sands of Inaros", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/Sands_of_Inaros" },
    { internalId: "quest_hidden_messages", canonicalName: "Hidden Messages", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/Hidden_Messages" },
    { internalId: "quest_mask_of_the_revenant", canonicalName: "Mask of the Revenant", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/Mask_of_the_Revenant" },
    { internalId: "quest_the_silver_grove", canonicalName: "The Silver Grove", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/The_Silver_Grove" },
    { internalId: "quest_the_waverider", canonicalName: "The Waverider", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/The_Waverider" },
    { internalId: "quest_the_limbo_theorem", canonicalName: "The Limbo Theorem", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/The_Limbo_Theorem" },
    { internalId: "quest_the_jordas_precept", canonicalName: "The Jordas Precept", classification: "warframe", sourceUrl: "https://wiki.warframe.com/w/The_Jordas_Precept" },
];

export const WIKI_QUEST_GROUPS = [
    "Arc 1: Tenno Awakening",
    "Arc 2: This Is What You Are",
    "Arc 3: The New War",
    "Arc 4: Void War Saga · Kalymos Sequence",
    "Arc 4: Void War Saga · Prologue to Tau",
    "Arc 4: Void War Saga · Jade Shadows Arc",
    "Arc 4: Void War Saga · One-Offs",
] as const;
