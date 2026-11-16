import { describe, expect, it } from "vitest";
import type { WeaponAutoSpoolShotSequenceRule } from "../../catalog/weaponCatalog";
import {
    getAutoSpoolMagazineAttackCount,
    getAutoSpoolShotSequenceState,
    getFullySpooledMagazineAttackCount,
} from "../weaponAutoSpool";

const kohmakSequence: WeaponAutoSpoolShotSequenceRule = {
    maxProjectiles: 5,
    projectilesAddedPerShot: 1,
    ammoCostAtMaximumProjectiles: 5 / 3,
    fullySpooledMagazineAmmoCost: 1.67,
    minimumAmmoCostPerShot: 1,
    sourceUrl: "https://wiki.warframe.com/w/Kohmak",
};

describe("Wiki Auto-Spool projectile and ammo sequences", () => {
    it("adds one pellet per consecutive Kohmak shot and scales per-pellet status inversely", () => {
        const states = Array.from({ length: 6 }, (_, shotIndex) =>
            getAutoSpoolShotSequenceState(kohmakSequence, shotIndex),
        );

        expect(states.map((state) => state.projectiles)).toEqual([1, 2, 3, 4, 5, 5]);
        expect(states.map((state) => state.projectileRatio)).toEqual([0.2, 0.4, 0.6, 0.8, 1, 1]);
        const expectedAmmoCosts = [1, 1, 1, 4 / 3, 5 / 3, 5 / 3];
        states.forEach((state, index) => expect(state.ammoCost).toBeCloseTo(expectedAmmoCosts[index]!, 12));
    });

    it("matches the Wiki fresh-magazine shot counts from rest", () => {
        expect(getAutoSpoolMagazineAttackCount(kohmakSequence, 40)).toBe(25);
        expect(getAutoSpoolMagazineAttackCount(kohmakSequence, 80)).toBe(49);
    });

    it("keeps steady full-spool magazine counts separate from finite startup counts", () => {
        expect(getFullySpooledMagazineAttackCount(kohmakSequence, 40)).toBe(23);
        expect(getFullySpooledMagazineAttackCount(kohmakSequence, 80)).toBe(47);
        expect(getAutoSpoolMagazineAttackCount(kohmakSequence, 40)).toBe(25);
        expect(getAutoSpoolMagazineAttackCount(kohmakSequence, 80)).toBe(49);
    });

    it("applies ammo efficiency to the evolving shot costs before the reload threshold", () => {
        const baseShots = getAutoSpoolMagazineAttackCount(kohmakSequence, 40);
        const efficientShots = getAutoSpoolMagazineAttackCount(kohmakSequence, 40, 0.5);

        expect(baseShots).toBe(25);
        expect(efficientShots).toBeGreaterThan(baseShots);
    });
});
