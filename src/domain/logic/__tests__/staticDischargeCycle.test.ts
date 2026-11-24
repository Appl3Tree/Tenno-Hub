import { describe, expect, it } from "vitest";
import { getWeaponCatalog } from "../../catalog/weaponCatalog";
import { getModsForWeapon } from "../../catalog/modCatalog";
import {
    calculateStaticDischargeCycle,
    normalizeStaticDischargeFirstAnimationSeconds,
} from "../staticDischargeCycle";

describe("Static Discharge Prova cycle", () => {
    const prova = getWeaponCatalog().find((weapon) => weapon.name === "Prova")!;
    const provaVandal = getWeaponCatalog().find((weapon) => weapon.name === "Prova Vandal")!;
    const staticDischarge = getModsForWeapon(prova).find((mod) => mod.name === "Static Discharge")!;

    it("adds sourced Heavy Attack rows for both Prova profiles", () => {
        const standardHeavy = prova.attacks.find((attack) => attack.name === "Heavy Attack");
        const vandalHeavy = provaVandal.attacks.find((attack) => attack.name === "Heavy Attack");
        expect(standardHeavy).toMatchObject({ trigger: "Charge", chargeTime: 0.7, speed: 1, damageTotal: 768 });
        expect(standardHeavy?.damage.impact).toBeCloseTo(312, 8);
        expect(standardHeavy?.damage.electricity).toBeCloseTo(456, 8);
        expect(vandalHeavy).toMatchObject({ trigger: "Charge", chargeTime: 0.7, speed: 1, damageTotal: 1188 });
        expect(vandalHeavy?.damage.impact).toBeCloseTo(480, 8);
        expect(vandalHeavy?.damage.electricity).toBeCloseTo(708, 8);
    });

    it("parses each rank and clears its source text from the unmatched-stat audit", () => {
        expect(staticDischarge.effectsByRank.map((effect) => effect.staticDischargeDamagePerWeaponDamage))
            .toEqual([0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
        expect(staticDischarge.unparsedStatsByRank?.every((lines) =>
            lines.every((line) => !/Heavy Attacks electrify nearby enemies/i.test(line)),
        )).toBe(true);
    });

    it("scores the editable spin-first pulse count and follow-up as one bounded cycle", () => {
        const result = calculateStaticDischargeCycle({
            weapon: prova,
            mods: [staticDischarge.effectsByRank[staticDischarge.fusionLimit]!],
            startingOrder: "spinThenOverhead",
            firstAnimationSeconds: 0.8,
        });

        expect(result).toMatchObject({
            supported: true,
            firstAnimationSeconds: 0.8,
            pulseCount: 4,
            rankDamageFraction: 0.8,
            pulseDamageCoefficient: 0.24,
            followUpDamageCoefficient: 8,
            windUpDamage: 1,
        });
        expect(result.expectedPulseDamage).toBeCloseTo(128 * 0.8 * 0.24 * 1.14, 2);
        expect(result.expectedFollowUpDamage).toBeCloseTo(128 * 0.8 * 8 * 1.14, 0);
        expect(result.expectedCycleDamageBeforeTargetDefenses).toBeCloseTo(
            2 * result.expectedDirectHeavyHitDamage + 4 * result.expectedPulseDamage + result.expectedFollowUpDamage + 1,
            8,
        );
    });

    it("uses the selected overhead-first coefficients and normalizes the duration", () => {
        const result = calculateStaticDischargeCycle({
            weapon: prova,
            mods: [staticDischarge.effectsByRank[staticDischarge.fusionLimit]!],
            startingOrder: "overheadThenSpin",
            firstAnimationSeconds: 0.61,
        });
        expect(result.pulseCount).toBe(3);
        expect(result.firstAnimationSeconds).toBe(0.6);
        expect(result.pulseDamageCoefficient).toBe(0.8);
        expect(result.followUpDamageCoefficient).toBe(2.4);
        expect(normalizeStaticDischargeFirstAnimationSeconds(99)).toBe(5);
        expect(normalizeStaticDischargeFirstAnimationSeconds(-1)).toBe(0);
    });

    it("requires a Prova profile and Static Discharge mod", () => {
        expect(calculateStaticDischargeCycle({
            weapon: prova,
            mods: [],
            startingOrder: "spinThenOverhead",
            firstAnimationSeconds: 0.8,
        }).limitation).toContain("Equip Static Discharge");
        expect(calculateStaticDischargeCycle({
            weapon: provaVandal,
            mods: [staticDischarge.effectsByRank[staticDischarge.fusionLimit]!],
            startingOrder: "spinThenOverhead",
            firstAnimationSeconds: 0.8,
        }).supported).toBe(true);
        expect(calculateStaticDischargeCycle({
            weapon: { ...prova, name: "Skana" },
            mods: [staticDischarge.effectsByRank[staticDischarge.fusionLimit]!],
            startingOrder: "spinThenOverhead",
            firstAnimationSeconds: 0.8,
        }).supported).toBe(false);
    });
});

