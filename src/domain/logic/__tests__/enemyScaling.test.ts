import { describe, expect, it } from "vitest";
import {
    EXIMUS_BASE_OVERGUARD,
    applyEximusHealthBaseAdjustment,
    applyEximusShieldBaseAdjustment,
    applySteelPathStatMultiplier,
    enemyStatLevelMultiplier,
    getSteelPathEnemyLevel,
    scaleEnemyOverguard,
    scaleEnemyStat,
} from "../enemyScaling";

const f32 = Math.fround;

describe("current enemy level scaling", () => {
    it("uses the base-level delta and the lower and upper Health curves", () => {
        const lowerEndpoint = f32(1 + f32(f32(0.015) * f32(Math.pow(70, f32(2.12)))));
        const upperEndpoint = f32(1 + f32(f32(10.7332) * f32(Math.pow(80, f32(0.72)))));

        expect(enemyStatLevelMultiplier("health", "grineer", 1, 1)).toBe(1);
        expect(enemyStatLevelMultiplier("health", "grineer", 1, 71)).toBe(lowerEndpoint);
        expect(enemyStatLevelMultiplier("health", "grineer", 1, 81)).toBe(upperEndpoint);
        expect(enemyStatLevelMultiplier("health", "grineer", 21, 91)).toBe(lowerEndpoint);
        expect(enemyStatLevelMultiplier("health", "corpus", 1, 81)).not.toBe(upperEndpoint);
    });

    it("smoothly blends both Health curves from delta 70 through 80", () => {
        const q = f32(75);
        const low = f32(1 + f32(f32(0.015) * f32(Math.pow(q, f32(2.12)))));
        const high = f32(1 + f32(f32(10.7332) * f32(Math.pow(q, f32(0.72)))));
        const t = f32(f32(q - 70) / f32(80 - 70));
        const s = f32(f32(f32(t * t)) * f32(f32(3) - f32(f32(2) * t)));
        const expected = f32(low + f32(f32(high - low) * s));

        expect(enemyStatLevelMultiplier("health", "grineer", 1, 76)).toBe(expected);
    });

    it("uses faction-specific Shield curves and rejects unsupported Shield families", () => {
        const corpus = enemyStatLevelMultiplier("shield", "corpus", 1, 81);
        const techrot = enemyStatLevelMultiplier("shield", "techrot", 1, 81);

        expect(corpus).not.toBe(techrot);
        expect(() => enemyStatLevelMultiplier("shield", "murmur", 1, 81)).toThrow(RangeError);
    });

    it("applies the initial Armor floor and 2700 level-scaling cap", () => {
        expect(scaleEnemyStat("armor", 80, "grineer", 1, 1)).toBe(200);
        expect(scaleEnemyStat("armor", 500, "grineer", 1, 1)).toBe(500);
        expect(scaleEnemyStat("armor", 4000, "grineer", 1, 1)).toBe(2700);
        expect(scaleEnemyStat("health", 0, "grineer", 1, 100)).toBe(0);
    });

    it("applies Steel Path level and Health/Shield modifiers without a separate Armor multiplier", () => {
        expect(getSteelPathEnemyLevel(30, true)).toBe(130);
        expect(getSteelPathEnemyLevel(30, false)).toBe(30);
        expect(getSteelPathEnemyLevel(Number.NaN, true)).toBe(1);
        expect(applySteelPathStatMultiplier("health", 100, true)).toBe(250);
        expect(applySteelPathStatMultiplier("shield", 80, true)).toBe(200);
        expect(applySteelPathStatMultiplier("armor", 500, true)).toBe(500);
        expect(applySteelPathStatMultiplier("health", 100, false)).toBe(100);
    });

    it("scales Overguard from level 1 independently of the enemy base level", () => {
        const q = f32(45);
        const expected = f32(f32(EXIMUS_BASE_OVERGUARD) * f32(1 + f32(f32(0.0015) * f32(Math.pow(q, f32(4))))));

        expect(scaleEnemyOverguard(EXIMUS_BASE_OVERGUARD, 46)).toBe(expected);
        expect(scaleEnemyOverguard(12, 1)).toBe(12);
        expect(scaleEnemyOverguard(-1, 100)).toBe(0);
    });

    it("applies current Eximus base Health and Shield adjustments before level curves", () => {
        expect(applyEximusHealthBaseAdjustment(100, 1, true)).toBe(250);
        expect(applyEximusHealthBaseAdjustment(100, 1, false)).toBe(375);
        expect(applyEximusHealthBaseAdjustment(100, 50, true)).toBe(1125);
        expect(applyEximusShieldBaseAdjustment(100, 15)).toBe(110);
        expect(applyEximusShieldBaseAdjustment(100, 50)).toBe(450);
        expect(applyEximusHealthBaseAdjustment(0, 50, true)).toBe(0);
    });
});
