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
        notes: "Regular Lancer baseline; armored spawn values use the current 200 minimum.",
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
        notes: "Regular Butcher baseline; armored spawn values use the current 200 minimum.",
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
        notes: "Regular Heavy Gunner baseline; Demolisher Heavy Gunner is a separate unsupported target.",
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
        notes: "Orokin-controlled heavy unit; the Wiki lists a 3× head multiplier, which the target model does not apply.",
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
        notes: "Regular Crewman baseline; Osprey shield links and leader variants are not modeled.",
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
        notes: "Standard MOA baseline; turret body-part reduction and special variants are not modeled.",
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
        notes: "Static baseline; Shield Osprey deployment and its shared shield link are not simulated.",
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
        notes: "Standard Bombard baseline; special unit damage reduction and target-specific exceptions are not modeled.",
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
        notes: "Static baseline; phase healing and its out-of-phase damage reduction are not modeled.",
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
        notes: "Standard Charger; Deimos and special mission variants use different mechanics or baselines.",
    },
]);

const ENEMY_PROFILE_BY_ID = new Map(ENEMY_PROFILES.map((profile) => [profile.id, profile]));

export function getEnemyProfile(id: string): EnemyProfile | undefined {
    return ENEMY_PROFILE_BY_ID.get(id);
}
