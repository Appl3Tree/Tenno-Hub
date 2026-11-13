import { describe, expect, it } from "vitest";
import { advanceDamageRampMultiplier, calculateDamageRampMultipliers } from "../weaponDamageRamp";
import type { WeaponDamageRampRule } from "../../catalog/weaponCatalog";

const phantasmaRamp: WeaponDamageRampRule = {
    minimumDamageMultiplier: 0.15,
    rampToFullSeconds: 0.6,
    idleBeforeDecaySeconds: 0.8,
    decayToMinimumSeconds: 2,
};

describe("weapon damage ramp", () => {
    it("ramps up while firing and delays decay after firing stops", () => {
        expect(advanceDamageRampMultiplier(phantasmaRamp, 0.15, 0.6, true)).toBeCloseTo(1, 12);
        expect(advanceDamageRampMultiplier(phantasmaRamp, 1, 0.8, false)).toBe(1);
        expect(advanceDamageRampMultiplier(phantasmaRamp, 1, 2.8, false)).toBeCloseTo(0.15, 12);
    });

    it("averages a fresh Phantasma magazine and preserves the warmed level across a short reload", () => {
        const multipliers = calculateDamageRampMultipliers(phantasmaRamp, 22, 12, 0.5);

        expect(multipliers.firstAttack).toBe(0.15);
        expect(multipliers.freshMagazineAverage).toBeCloseTo(3331 / 3960, 12);
        expect(multipliers.sustainedAverage).toBe(1);
    });
});
