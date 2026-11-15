/**
 * Wiki-derived Neutral melee combo reference rows.
 *
 * The Wiki's Stance comparison table reports percentages; the values below are
 * those percentages expressed as damage multipliers (for example, 700% = 7).
 * Combo lengths are the Wiki's approximate timings at 1.0 attack speed.
 *
 * Source: https://wiki.warframe.com/w/Stance#Comparison
 * Source page last edited: 2026-10-02. Values checked against the live table:
 * 2026-11-14.
 */
export interface WikiMeleeStanceCombo {
    stanceName: string;
    comboName: string;
    comboType: "Neutral";
    baseComboLengthSeconds: number;
    totalDamageMultiplier: number;
    totalSlashProcMultiplier: number;
}

export const WIKI_MELEE_STANCE_SOURCE_URL = "https://wiki.warframe.com/w/Stance#Comparison";
export const WIKI_MELEE_STANCE_SOURCE_LAST_EDITED = "2026-10-02";
export const WIKI_MELEE_STANCE_VERIFIED_AT = "2026-11-15";

const WIKI_NEUTRAL_STANCE_COMBOS = [
    { stanceName: "Astral Twilight", comboName: "Morning Sun", comboType: "Neutral", baseComboLengthSeconds: 4.25, totalDamageMultiplier: 22, totalSlashProcMultiplier: 0 },
    { stanceName: "Atlantis Vulcan", comboName: "Molten Whirlpool", comboType: "Neutral", baseComboLengthSeconds: 3.45, totalDamageMultiplier: 10.5, totalSlashProcMultiplier: 0 },
    { stanceName: "Bleeding Willow", comboName: "Lethal Gust", comboType: "Neutral", baseComboLengthSeconds: 0.95, totalDamageMultiplier: 5, totalSlashProcMultiplier: 0 },
    { stanceName: "Blind Justice", comboName: "Guiding Light", comboType: "Neutral", baseComboLengthSeconds: 2.6, totalDamageMultiplier: 19, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Brutal Tide", comboName: "Inferno", comboType: "Neutral", baseComboLengthSeconds: 2.15, totalDamageMultiplier: 14, totalSlashProcMultiplier: 0 },
    { stanceName: "Bullet Dance", comboName: "Automatic Rhumba", comboType: "Neutral", baseComboLengthSeconds: 4.5, totalDamageMultiplier: 15, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Burning Wasp", comboName: "Sparking Torture", comboType: "Neutral", baseComboLengthSeconds: 1.9, totalDamageMultiplier: 6, totalSlashProcMultiplier: 0 },
    { stanceName: "Butcher's Revelry", comboName: "Rictus' Wrath", comboType: "Neutral", baseComboLengthSeconds: 4.93, totalDamageMultiplier: 11, totalSlashProcMultiplier: 10.5 },
    { stanceName: "Carving Mantis", comboName: "Rapid Incisions", comboType: "Neutral", baseComboLengthSeconds: 3.9, totalDamageMultiplier: 19, totalSlashProcMultiplier: 12.6 },
    { stanceName: "Cleaving Whirlwind", comboName: "Crowd Fall", comboType: "Neutral", baseComboLengthSeconds: 2.25, totalDamageMultiplier: 12, totalSlashProcMultiplier: 0 },
    { stanceName: "Coiling Viper", comboName: "Whistling Wind", comboType: "Neutral", baseComboLengthSeconds: 2.7, totalDamageMultiplier: 10, totalSlashProcMultiplier: 0 },
    { stanceName: "Crimson Dervish", comboName: "Twisting Flurry", comboType: "Neutral", baseComboLengthSeconds: 2, totalDamageMultiplier: 14, totalSlashProcMultiplier: 0 },
    { stanceName: "Crossing Snakes", comboName: "East to West", comboType: "Neutral", baseComboLengthSeconds: 1.35, totalDamageMultiplier: 9, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Crushing Ruin", comboName: "Raging Whirlwind", comboType: "Neutral", baseComboLengthSeconds: 3, totalDamageMultiplier: 14, totalSlashProcMultiplier: 0 },
    { stanceName: "Cyclone Kraken", comboName: "Gale Triton", comboType: "Neutral", baseComboLengthSeconds: 4.1, totalDamageMultiplier: 17, totalSlashProcMultiplier: 0 },
    { stanceName: "Decisive Judgement", comboName: "Swift Retribution", comboType: "Neutral", baseComboLengthSeconds: 2.65, totalDamageMultiplier: 14, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Defiled Snapdragon", comboName: "Claws of the Drake", comboType: "Neutral", baseComboLengthSeconds: 4.25, totalDamageMultiplier: 23, totalSlashProcMultiplier: 6.3 },
    { stanceName: "Eleventh Storm", comboName: "Striking Thunder", comboType: "Neutral", baseComboLengthSeconds: 3.5, totalDamageMultiplier: 19, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Exalted Blade", comboName: "Cutting Poise", comboType: "Neutral", baseComboLengthSeconds: 3.2, totalDamageMultiplier: 21, totalSlashProcMultiplier: 0 },
    { stanceName: "Final Harbinger", comboName: "Null Warning", comboType: "Neutral", baseComboLengthSeconds: 3.05, totalDamageMultiplier: 21, totalSlashProcMultiplier: 6.3 },
    { stanceName: "Flailing Branch", comboName: "Rising Falls", comboType: "Neutral", baseComboLengthSeconds: 2.35, totalDamageMultiplier: 9, totalSlashProcMultiplier: 0 },
    { stanceName: "Four Riders", comboName: "Aggravated Swarm", comboType: "Neutral", baseComboLengthSeconds: 2.3, totalDamageMultiplier: 13, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Fracturing Wind", comboName: "Rolling Gale", comboType: "Neutral", baseComboLengthSeconds: 1.55, totalDamageMultiplier: 9, totalSlashProcMultiplier: 0 },
    { stanceName: "Gaia's Tragedy", comboName: "River's Grief", comboType: "Neutral", baseComboLengthSeconds: 3.65, totalDamageMultiplier: 18, totalSlashProcMultiplier: 0 },
    { stanceName: "Galeforce Dawn", comboName: "Stormreaper", comboType: "Neutral", baseComboLengthSeconds: 3.06, totalDamageMultiplier: 9, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Gemini Cross", comboName: "Vagrant Blight", comboType: "Neutral", baseComboLengthSeconds: 4.6, totalDamageMultiplier: 21.5, totalSlashProcMultiplier: 6.3 },
    { stanceName: "Gleaming Talon", comboName: "Mercury Vortex", comboType: "Neutral", baseComboLengthSeconds: 4.3, totalDamageMultiplier: 21, totalSlashProcMultiplier: 0 },
    { stanceName: "Grim Fury", comboName: "Fanning Flame", comboType: "Neutral", baseComboLengthSeconds: 1.9, totalDamageMultiplier: 13, totalSlashProcMultiplier: 0 },
    { stanceName: "High Noon", comboName: "Final Showdown", comboType: "Neutral", baseComboLengthSeconds: 3.25, totalDamageMultiplier: 11, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Homing Fang", comboName: "Cutting Arches", comboType: "Neutral", baseComboLengthSeconds: 2.8, totalDamageMultiplier: 17, totalSlashProcMultiplier: 8.4 },
    { stanceName: "Hysteria", comboName: "Fervor", comboType: "Neutral", baseComboLengthSeconds: 2.85, totalDamageMultiplier: 19, totalSlashProcMultiplier: 0 },
    { stanceName: "Iron Phoenix", comboName: "Wings and Beak", comboType: "Neutral", baseComboLengthSeconds: 1.35, totalDamageMultiplier: 7, totalSlashProcMultiplier: 6.3 },
    { stanceName: "Malicious Raptor", comboName: "Jagged Gash", comboType: "Neutral", baseComboLengthSeconds: 3.35, totalDamageMultiplier: 19, totalSlashProcMultiplier: 10.5 },
    { stanceName: "Mountain's Edge", comboName: "Rise and Fall", comboType: "Neutral", baseComboLengthSeconds: 2.8, totalDamageMultiplier: 21, totalSlashProcMultiplier: 0 },
    { stanceName: "Pointed Wind", comboName: "Parting Edge", comboType: "Neutral", baseComboLengthSeconds: 1.55, totalDamageMultiplier: 12, totalSlashProcMultiplier: 2.1 },
    { stanceName: "Primal Fury", comboName: "Falling Oak Buster", comboType: "Neutral", baseComboLengthSeconds: 3.2, totalDamageMultiplier: 16, totalSlashProcMultiplier: 0 },
    { stanceName: "Ravenous Wraith", comboName: "Cleaving Claws", comboType: "Neutral", baseComboLengthSeconds: 2.8, totalDamageMultiplier: 15, totalSlashProcMultiplier: 12.6 },
    { stanceName: "Reaping Spiral", comboName: "Eternal Nocturne", comboType: "Neutral", baseComboLengthSeconds: 2.9, totalDamageMultiplier: 16, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Rending Crane", comboName: "Skull Splitter", comboType: "Neutral", baseComboLengthSeconds: 1.85, totalDamageMultiplier: 9, totalSlashProcMultiplier: 0 },
    { stanceName: "Seismic Palm", comboName: "Quaking Touch", comboType: "Neutral", baseComboLengthSeconds: 1.55, totalDamageMultiplier: 12, totalSlashProcMultiplier: 0 },
    { stanceName: "Serene Storm", comboName: "Trespass Denied", comboType: "Neutral", baseComboLengthSeconds: 3.5, totalDamageMultiplier: 10, totalSlashProcMultiplier: 0 },
    { stanceName: "Shattering Storm", comboName: "Falling Rock", comboType: "Neutral", baseComboLengthSeconds: 4.9, totalDamageMultiplier: 21, totalSlashProcMultiplier: 0 },
    { stanceName: "Shimmering Blight", comboName: "Slashing Wind", comboType: "Neutral", baseComboLengthSeconds: 0.95, totalDamageMultiplier: 5, totalSlashProcMultiplier: 0 },
    { stanceName: "Slicing Feathers", comboName: "Scathing Plume", comboType: "Neutral", baseComboLengthSeconds: 3.6, totalDamageMultiplier: 19, totalSlashProcMultiplier: 6.3 },
    { stanceName: "Sovereign Outcast", comboName: "Rogue Edict", comboType: "Neutral", baseComboLengthSeconds: 2.85, totalDamageMultiplier: 22, totalSlashProcMultiplier: 16.8 },
    { stanceName: "Stalking Fan", comboName: "Shadow Wing", comboType: "Neutral", baseComboLengthSeconds: 4.9, totalDamageMultiplier: 15, totalSlashProcMultiplier: 0 },
    { stanceName: "Stinging Thorn", comboName: "Carving Spike", comboType: "Neutral", baseComboLengthSeconds: 3.95, totalDamageMultiplier: 22, totalSlashProcMultiplier: 10.5 },
    { stanceName: "Sundering Weave", comboName: "Rapid Current", comboType: "Neutral", baseComboLengthSeconds: 1.7, totalDamageMultiplier: 9, totalSlashProcMultiplier: 0 },
    { stanceName: "Swirling Tiger", comboName: "Winding Claws", comboType: "Neutral", baseComboLengthSeconds: 2.05, totalDamageMultiplier: 11, totalSlashProcMultiplier: 2.1 },
    { stanceName: "Swooping Falcon", comboName: "Diving Kestrel", comboType: "Neutral", baseComboLengthSeconds: 2, totalDamageMultiplier: 12, totalSlashProcMultiplier: 2.1 },
    { stanceName: "Tempo Royale", comboName: "August Mesto", comboType: "Neutral", baseComboLengthSeconds: 4.65, totalDamageMultiplier: 19, totalSlashProcMultiplier: 0 },
    { stanceName: "Tranquil Cleave", comboName: "Breathless Lunge", comboType: "Neutral", baseComboLengthSeconds: 3.8, totalDamageMultiplier: 13, totalSlashProcMultiplier: 2.1 },
    { stanceName: "Twirling Spire", comboName: "Cresting Peak", comboType: "Neutral", baseComboLengthSeconds: 3.3, totalDamageMultiplier: 14, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Vengeful Revenant", comboName: "Impending Dread", comboType: "Neutral", baseComboLengthSeconds: 3.15, totalDamageMultiplier: 14, totalSlashProcMultiplier: 0 },
    { stanceName: "Vermillion Storm", comboName: "Flurry Rose", comboType: "Neutral", baseComboLengthSeconds: 3.95, totalDamageMultiplier: 26, totalSlashProcMultiplier: 4.2 },
    { stanceName: "Votive Onslaught", comboName: "Purging Drive", comboType: "Neutral", baseComboLengthSeconds: 2.57, totalDamageMultiplier: 20, totalSlashProcMultiplier: 6.3 },
    { stanceName: "Vulpine Mask", comboName: "Assailant Guise", comboType: "Neutral", baseComboLengthSeconds: 3, totalDamageMultiplier: 16, totalSlashProcMultiplier: 8.4 },
    { stanceName: "Wise Razor", comboName: "Threshing Grain", comboType: "Neutral", baseComboLengthSeconds: 4.4, totalDamageMultiplier: 17, totalSlashProcMultiplier: 4.2 },
] as const satisfies readonly WikiMeleeStanceCombo[];

const WIKI_NEUTRAL_STANCE_COMBOS_BY_NAME: ReadonlyMap<string, WikiMeleeStanceCombo> = new Map(
    WIKI_NEUTRAL_STANCE_COMBOS.map((combo) => [combo.stanceName, combo]),
);

export const WIKI_MELEE_STANCE_COMBOS: readonly WikiMeleeStanceCombo[] = WIKI_NEUTRAL_STANCE_COMBOS;

export function getWikiMeleeStanceCombo(stanceName: string | null | undefined): WikiMeleeStanceCombo | null {
    if (!stanceName) return null;
    return WIKI_NEUTRAL_STANCE_COMBOS_BY_NAME.get(stanceName) ?? null;
}
