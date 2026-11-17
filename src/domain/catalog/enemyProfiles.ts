import type { EnemyScalingFaction } from "../logic/enemyScaling";

/**
 * Curated normal-unit baselines for the Build Planner. Values and base levels
 * are kept together with their Wiki source so the UI never has to infer a named
 * enemy from WFCD's material-only Enemy.json records.
 */
export interface EnemyProfile {
    id: string;
    name: string;
    faction: string;
    scalingFaction: EnemyScalingFaction;
    baseLevel: number;
    health: number;
    shields: number;
    armor: number;
    overguard: number;
    toxinBypassesShields: boolean;
    /** Wiki body-part multiplier used when the player assumes a headshot. */
    headshotMultiplier: number;
    /** Wiki critical-headshot bonus factor; 1 means this target's head does not receive a headcrit. */
    criticalHeadshotMultiplier: number;
    sourceUrl: string;
    notes?: string;
}

export const ENEMY_PROFILES: readonly EnemyProfile[] = Object.freeze([
    {
        id: "grineer-lancer",
        name: "Lancer",
        faction: "Grineer",
        scalingFaction: "grineer",
        baseLevel: 1,
        health: 100,
        shields: 0,
        armor: 100,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Lancer",
        headshotMultiplier: 3,
        criticalHeadshotMultiplier: 2,
        notes: "Regular Lancer baseline; its head is 3× and receives the standard critical-headshot bonus. Armored spawn values use the current 200 minimum.",
    },
    {
        id: "grineer-butcher",
        name: "Butcher",
        faction: "Grineer",
        scalingFaction: "grineer",
        baseLevel: 1,
        health: 50,
        shields: 0,
        armor: 5,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Butcher",
        headshotMultiplier: 3,
        criticalHeadshotMultiplier: 2,
        notes: "Regular Butcher baseline; its head is 3× and receives the standard critical-headshot bonus. Armored spawn values use the current 200 minimum.",
    },
    {
        id: "grineer-heavy-gunner",
        name: "Heavy Gunner",
        faction: "Grineer",
        scalingFaction: "grineer",
        baseLevel: 8,
        health: 300,
        shields: 0,
        armor: 500,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Heavy_Gunner",
        headshotMultiplier: 3,
        criticalHeadshotMultiplier: 2,
        notes: "Regular Heavy Gunner baseline; its head is 3× and receives the standard critical-headshot bonus. Demolisher Heavy Gunner is a separate unsupported target.",
    },
    {
        id: "corrupted-heavy-gunner",
        name: "Corrupted Heavy Gunner",
        faction: "Orokin",
        scalingFaction: "corrupted",
        baseLevel: 8,
        health: 700,
        shields: 0,
        armor: 500,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Corrupted_Heavy_Gunner",
        headshotMultiplier: 3,
        criticalHeadshotMultiplier: 2,
        notes: "Orokin-controlled Grineer heavy unit; its head is 3× and receives the standard critical-headshot bonus.",
    },
    {
        id: "corpus-crewman",
        name: "Crewman",
        faction: "Corpus",
        scalingFaction: "corpus",
        baseLevel: 1,
        health: 90,
        shields: 120,
        armor: 0,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Crewman",
        headshotMultiplier: 3,
        criticalHeadshotMultiplier: 1,
        notes: "Regular Crewman baseline; its head is 3× but Corpus humanoids do not receive critical-headshot bonus. Osprey shield links and leader variants are not modeled.",
    },
    {
        id: "corpus-moa",
        name: "MOA",
        faction: "Corpus",
        scalingFaction: "corpus",
        baseLevel: 1,
        health: 90,
        shields: 120,
        armor: 0,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/MOA",
        headshotMultiplier: 1,
        criticalHeadshotMultiplier: 1,
        notes: "Standard MOA head is 1× and does not receive a critical-headshot bonus; its 3× Fanny Pack is a separate hit location. Turret body-part reduction and special variants are not modeled.",
    },
    {
        id: "corpus-tech",
        name: "Corpus Tech",
        faction: "Corpus",
        scalingFaction: "corpus",
        baseLevel: 15,
        health: 225,
        shields: 150,
        armor: 0,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Corpus_Tech",
        headshotMultiplier: 3,
        criticalHeadshotMultiplier: 1,
        notes: "Static baseline; its head is 3×, but Corpus humanoids do not receive critical-headshot bonus. Shield Osprey deployment and its shared shield link are not simulated.",
    },
    {
        id: "grineer-bombard",
        name: "Bombard",
        faction: "Grineer",
        scalingFaction: "grineer",
        baseLevel: 4,
        health: 300,
        shields: 0,
        armor: 500,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Bombard",
        headshotMultiplier: 3,
        criticalHeadshotMultiplier: 2,
        notes: "Standard Bombard baseline; its head is 3× and receives the standard critical-headshot bonus. Special unit damage reduction and target-specific exceptions are not modeled.",
    },
    {
        id: "corpus-amalgam-moa",
        name: "Amalgam MOA",
        faction: "Corpus Amalgam",
        scalingFaction: "corpus",
        baseLevel: 1,
        health: 500,
        shields: 300,
        armor: 0,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Amalgam_Moa",
        headshotMultiplier: 1,
        criticalHeadshotMultiplier: 1,
        notes: "Static baseline; the Wiki lists a 3× Fanny Pack but no head multiplier. Phase healing and its out-of-phase damage reduction are not modeled.",
    },
    {
        id: "infested-charger",
        name: "Charger",
        faction: "Infested",
        scalingFaction: "infested",
        baseLevel: 1,
        health: 80,
        shields: 0,
        armor: 0,
        overguard: 0,
        toxinBypassesShields: true,
        sourceUrl: "https://wiki.warframe.com/w/Charger",
        headshotMultiplier: 1,
        criticalHeadshotMultiplier: 1,
        notes: "The Wiki lists the Charger mouth as a 1× weak point, so it gets neither a headshot multiplier nor critical-headshot bonus. Deimos and special mission variants use different mechanics or baselines.",
    },
]);

const ENEMY_PROFILE_BY_ID = new Map(ENEMY_PROFILES.map((profile) => [profile.id, profile]));

export function getEnemyProfile(id: string): EnemyProfile | undefined {
    return ENEMY_PROFILE_BY_ID.get(id);
}

export interface FactionHitLocationProfile {
    headshotMultiplier: number;
    criticalHeadshotMultiplier: number;
}

/** Current Wiki-typical headshot defaults for faction-only synthetic targets. */
export function getFactionHitLocationProfile(faction: string): FactionHitLocationProfile {
    switch (faction.trim().toLowerCase()) {
        case "grineer":
        case "kuva grineer":
        case "infested":
        case "infested deimos":
        case "deimos infested":
        case "orokin":
        case "sentient":
        case "narmer":
        case "anarchs":
        case "scaldra (1999)":
            return { headshotMultiplier: 3, criticalHeadshotMultiplier: 2 };
        case "corpus":
            // Faction-only Corpus estimate uses a humanoid representative; named MOAs override this.
            return { headshotMultiplier: 3, criticalHeadshotMultiplier: 1 };
        case "the murmur":
        case "techrot (1999)":
            // Their anatomy varies by enemy; common weak points are 1.5× and most lack headcrits.
            return { headshotMultiplier: 1.5, criticalHeadshotMultiplier: 1 };
        case "corpus amalgam":
        case "zariman":
        case "tenno":
            return { headshotMultiplier: 1, criticalHeadshotMultiplier: 1 };
        default:
            // Unknown factions stay at body multiplier until a current Wiki profile is curated.
            return { headshotMultiplier: 1, criticalHeadshotMultiplier: 1 };
    }
}
