import { describe, expect, it } from "vitest";
import { ENEMY_PROFILES, getEnemyProfile } from "../enemyProfiles";
import { scaleEnemyStat } from "../../logic/enemyScaling";

describe("curated Build Planner enemy baselines", () => {
    it("uses unique, sourced identities with non-negative base pools", () => {
        expect(new Set(ENEMY_PROFILES.map((profile) => profile.id)).size).toBe(ENEMY_PROFILES.length);
        for (const profile of ENEMY_PROFILES) {
            expect(profile.sourceUrl).toMatch(/^https:\/\/wiki\.warframe\.com\/w\//);
            expect(profile.baseLevel).toBeGreaterThanOrEqual(1);
            expect(profile.health).toBeGreaterThan(0);
            expect(profile.shields).toBeGreaterThanOrEqual(0);
            expect(profile.armor).toBeGreaterThanOrEqual(0);
            expect(profile.overguard).toBeGreaterThanOrEqual(0);
        }
    });

    it("keeps normal unit armor minimum and base-level health separate", () => {
        const lancer = getEnemyProfile("grineer-lancer");
        const butcher = getEnemyProfile("grineer-butcher");
        const heavyGunner = getEnemyProfile("grineer-heavy-gunner");

        expect(lancer).toBeDefined();
        expect(butcher).toBeDefined();
        expect(heavyGunner).toBeDefined();
        expect(scaleEnemyStat("health", lancer!.health, lancer!.scalingFaction, lancer!.baseLevel, lancer!.baseLevel)).toBe(100);
        expect(scaleEnemyStat("armor", lancer!.armor, lancer!.scalingFaction, lancer!.baseLevel, lancer!.baseLevel)).toBe(200);
        expect(scaleEnemyStat("armor", butcher!.armor, butcher!.scalingFaction, butcher!.baseLevel, butcher!.baseLevel)).toBe(200);
        expect(scaleEnemyStat("armor", heavyGunner!.armor, heavyGunner!.scalingFaction, heavyGunner!.baseLevel, heavyGunner!.baseLevel)).toBe(500);
    });

    it("retains current Corpus Crewman health and Shield values", () => {
        expect(getEnemyProfile("corpus-crewman")).toMatchObject({
            faction: "Corpus",
            scalingFaction: "corpus",
            baseLevel: 1,
            health: 90,
            shields: 120,
            armor: 0,
        });
    });

    it("includes sourced standard heavy, robotic, and Amalgam target baselines", () => {
        expect(getEnemyProfile("grineer-bombard")).toMatchObject({
            faction: "Grineer",
            baseLevel: 4,
            health: 300,
            armor: 500,
        });
        expect(getEnemyProfile("corrupted-heavy-gunner")).toMatchObject({
            faction: "Orokin",
            scalingFaction: "corrupted",
            baseLevel: 8,
            health: 700,
            armor: 500,
        });
        expect(getEnemyProfile("corpus-moa")).toMatchObject({
            faction: "Corpus",
            baseLevel: 1,
            health: 90,
            shields: 120,
        });
        expect(getEnemyProfile("corpus-tech")).toMatchObject({
            baseLevel: 15,
            health: 225,
            shields: 150,
        });
        expect(getEnemyProfile("corpus-amalgam-moa")).toMatchObject({
            faction: "Corpus Amalgam",
            health: 500,
            shields: 300,
        });
        expect(getEnemyProfile("infested-charger")).toMatchObject({
            faction: "Infested",
            scalingFaction: "infested",
            baseLevel: 1,
            health: 80,
            shields: 0,
            armor: 0,
        });
    });
});
