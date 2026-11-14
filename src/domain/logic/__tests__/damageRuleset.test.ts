import { describe, expect, it } from "vitest";
import {
    DAMAGE_RULESET,
    DAMAGE_QUANTIZATION_DENOMINATOR,
    STATUS_DAMAGE_TYPES,
    STATUS_EFFECT_RULES,
    blastStackCapDetonationDamage,
    blastStackExpiryDamage,
    applyEnemyArmorToDamageByType,
    applyHealthDamageTypeModifiers,
    countFiniteEncounterStatusTicks,
    countStatusDamageTicks,
    enemyArmorDamageMultiplier,
    factionDamageTypeModifier,
    probabilityAtLeastOneStatusProc,
    quantizeDamageContribution,
    quantizeBaseCriticalDamageMultiplier,
    statusDotTickDamage,
} from "../damageRuleset";

describe("Damage 3.0 shared rules", () => {
    it("records the current Impact source and review date", () => {
        expect(DAMAGE_RULESET.lastVerified).toBe("2026-11-14");
        expect(DAMAGE_RULESET.sources.impact).toBe("https://wiki.warframe.com/w/Damage/Impact_Damage");
        expect(DAMAGE_RULESET.sources.shatteringImpact).toBe("https://wiki.warframe.com/w/Shattering_Impact");
        expect(DAMAGE_RULESET.sources.seismicWave).toBe("https://wiki.warframe.com/w/Seismic_Wave");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) => entry.includes("Seismic Wave"))).toBe(true);
    });

    it("uses signed 1/32 round-half-up quantization relative to modded base damage", () => {
        const base = 96;
        const quantum = base / DAMAGE_QUANTIZATION_DENOMINATOR;

        expect(quantum).toBe(3);
        expect(quantizeDamageContribution(1.49 * quantum, base)).toBe(3);
        expect(quantizeDamageContribution(1.5 * quantum, base)).toBe(6);
        expect(quantizeDamageContribution(-1.5 * quantum, base)).toBe(-6);
        expect(quantizeDamageContribution(0.25, 0)).toBe(0.25);
    });

    it("quantizes the weapon base critical multiplier through the 12-bit game encoding", () => {
        expect(quantizeBaseCriticalDamageMultiplier(2)).toBeCloseTo(256 * 32 / 4095, 6);
        expect(quantizeBaseCriticalDamageMultiplier(-1)).toBe(0);
        expect(quantizeBaseCriticalDamageMultiplier(40)).toBe(32);
    });

    it("calculates the one-time DoT tick accumulator and type coefficient", () => {
        expect(statusDotTickDamage(40, "heat", 1.6)).toBeCloseTo(32.8, 5);
        expect(statusDotTickDamage(62, "toxin", 3.25 * 1.55)).toBeCloseTo(158.68125, 3);
        expect(statusDotTickDamage(80, "gas", 1, 1)).toBeCloseTo(40.5, 5);
        expect(statusDotTickDamage(80, "gas", 1, 0.5)).toBeCloseTo(40.25, 5);
    });

    it("resolves Blast expiry separately from the neighbor-only cap radial", () => {
        expect(blastStackExpiryDamage(10)).toBe(3);
        expect(blastStackExpiryDamage(2)).toBe(1);
        expect(blastStackExpiryDamage(-2)).toBe(0);
        expect(blastStackCapDetonationDamage(33)).toBe(99);
    });

    it("computes the chance of at least one weighted status across multishot rolls", () => {
        expect(probabilityAtLeastOneStatusProc(0.5, 1, 0.5)).toBeCloseTo(0.25, 12);
        expect(probabilityAtLeastOneStatusProc(1.5, 1, 0.5)).toBeCloseTo(0.625, 12);
        expect(probabilityAtLeastOneStatusProc(1, 2, 0.5)).toBeCloseTo(0.75, 12);
    });

    it("uses the standard square-root armor curve through 2700 and the over-cap curve above it", () => {
        expect(enemyArmorDamageMultiplier(0)).toBe(1);
        expect(enemyArmorDamageMultiplier(300)).toBeCloseTo(0.7, 12);
        expect(enemyArmorDamageMultiplier(2700)).toBeCloseTo(0.1, 12);
        expect(enemyArmorDamageMultiplier(3000)).toBeCloseTo(300 / 3300, 12);
        expect(enemyArmorDamageMultiplier(-1)).toBe(1);
        expect(enemyArmorDamageMultiplier(Number.NaN)).toBe(1);
    });

    it("applies the one-damage floor per armored damage type and exempts True damage", () => {
        expect(applyEnemyArmorToDamageByType({ impact: 0.25, slash: 0.25 }, 2700)).toBe(2);
        expect(applyEnemyArmorToDamageByType({ impact: 10, true: 10 }, 2700)).toBe(11);
        expect(applyEnemyArmorToDamageByType({ impact: 10 }, 0)).toBe(10);
    });

    it("applies current faction modifiers to each quantized type before Health armor", () => {
        const chargerHealthHit = applyHealthDamageTypeModifiers(
            { impact: 31.25, puncture: 31.25, slash: 40.625 },
            "Infested",
        );
        expect(chargerHealthHit.impact).toBe(31.25);
        expect(chargerHealthHit.puncture).toBe(31.25);
        expect(chargerHealthHit.slash).toBe(40.625 * 1.5);
        expect(Object.values(chargerHealthHit).reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(123.4375, 12);

        const armored = applyHealthDamageTypeModifiers({ impact: 0.25, slash: 0.25, true: 0.25 }, "Grineer", 2700);
        expect(armored.impact).toBe(1);
        expect(armored.slash).toBe(1);
        expect(armored.true).toBe(0.25);
    });

    it("keeps True damage out of proc weights and records current stack/timing limits", () => {
        expect(STATUS_DAMAGE_TYPES).not.toContain("true");
        expect(STATUS_EFFECT_RULES.impact).toMatchObject({ durationSeconds: 6, maxStacks: 5 });
        expect(STATUS_EFFECT_RULES.puncture).toMatchObject({ durationSeconds: 10, maxStacks: 5 });
        expect(STATUS_EFFECT_RULES.corrosive.maxStacks).toBe(10);
        expect(STATUS_EFFECT_RULES.slash.firstTickSeconds).toBe(1);
        expect(STATUS_EFFECT_RULES.electricity.firstTickSeconds).toBe(0);
        expect(STATUS_EFFECT_RULES.blast.detonationDelaySeconds).toBe(1.5);
    });

    it("counts ticks using each status effect's first-tick timing", () => {
        expect(countStatusDamageTicks("slash", 6)).toBe(6);
        expect(countStatusDamageTicks("slash", 0.9)).toBe(0);
        expect(countStatusDamageTicks("heat", 7.5)).toBe(7);
        expect(countStatusDamageTicks("electricity", 6)).toBe(6);
        expect(countStatusDamageTicks("gas", 6.1)).toBe(7);
        expect(countStatusDamageTicks("impact", 6)).toBe(0);
    });

    it("counts only scheduled ticks that land inside a finite encounter", () => {
        expect(countFiniteEncounterStatusTicks("slash", 6, 0.5, 1)).toBe(0);
        expect(countFiniteEncounterStatusTicks("slash", 6, 1, 1)).toBe(1);
        expect(countFiniteEncounterStatusTicks("slash", 6, 2, 1)).toBe(3);
        expect(countFiniteEncounterStatusTicks("electricity", 6, 0.5, 1)).toBe(1);
        expect(countFiniteEncounterStatusTicks("toxin", 6, 100, 2)).toBe(1164);
    });

    it("normalizes faction names and exposes current faction type bonuses", () => {
        expect(factionDamageTypeModifier("  Scaldra (1999) ", "impact")).toBe(0.5);
        expect(factionDamageTypeModifier("Anarchs", "radiation")).toBe(-0.5);
        expect(factionDamageTypeModifier("Unknown", "impact")).toBe(0);
        expect(factionDamageTypeModifier("Grineer", "true")).toBe(0);
    });
});
