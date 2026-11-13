import { describe, expect, it } from "vitest";
import { getIncarnonRecordForWeapon } from "../catalog/incarnonCatalog";

describe("current Incarnon Genesis patch overrides", () => {
    it("uses the 44.1.3 Crimson Overture ammo efficiency and duration for Dera and Boltor variants", () => {
        for (const weaponName of ["Dera", "Dera Vandal", "Boltor", "Boltor Prime", "Telos Boltor"]) {
            const record = getIncarnonRecordForWeapon(weaponName);
            const option = record?.tiers.find((tier) => tier.tier === 2)?.options.find((entry) => entry.id === "tier-2-crimson-overture");
            const effect = option?.model.effects
                .flatMap((entry) => entry.effect.conditionalEffects)
                .find((entry) => entry.trigger === "onKill" && entry.stats.ammoEfficiencyBonus !== undefined);
            const expectedBaseDamage = weaponName === "Dera"
                ? 8
                : weaponName === "Dera Vandal"
                    ? 6
                    : weaponName === "Boltor"
                        ? 12
                        : 0;
            const modeledBaseDamage = option?.model.adjustments.reduce(
                (total, adjustment) => total + (adjustment.baseDamageFlat ?? 0),
                0,
            ) ?? 0;

            expect(option, `${weaponName} Crimson Overture`).toBeTruthy();
            expect(option?.descriptionLines.join(" ")).toContain("+25% Ammo Efficiency for 5 seconds. Stacks up to 3x.");
            expect(option?.descriptionLines.join(" ")).not.toMatch(/\+20% Ammo Efficiency|Stacks up to 4x/i);
            expect(modeledBaseDamage).toBe(expectedBaseDamage);
            expect(effect?.durationSeconds).toBe(5);
            expect(effect?.maxStacks).toBe(3);
            expect(effect?.stats.ammoEfficiencyBonus).toBe(0.25);
        }
    });
});
