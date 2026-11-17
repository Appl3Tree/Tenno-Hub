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
    gasCloudOuterAnnulusCoverage,
    gasCloudRadiusFromStacks,
    normalizeElectricGasNeighborCounts,
    probabilityAtLeastOneStatusProc,
    quantizeDamageContribution,
    quantizeBaseCriticalDamageMultiplier,
    statusDotTickDamage,
} from "../damageRuleset";

describe("Damage 3.0 shared rules", () => {
    it("records current Impact and Cold sources and the review date", () => {
        expect(DAMAGE_RULESET.lastVerified).toBe("2026-11-17");
        expect(DAMAGE_RULESET.sources.impact).toBe("https://wiki.warframe.com/w/Damage/Impact_Damage");
        expect(DAMAGE_RULESET.sources.cold).toBe("https://wiki.warframe.com/w/Damage/Cold_Damage");
        expect(DAMAGE_RULESET.sources.shatteringImpact).toBe("https://wiki.warframe.com/w/Shattering_Impact");
        expect(DAMAGE_RULESET.sources.seismicWave).toBe("https://wiki.warframe.com/w/Seismic_Wave");
        expect(DAMAGE_RULESET.sources.rangeAdvantage).toBe("https://wiki.warframe.com/w/Range_Advantage");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) => entry.includes("Seismic Wave"))).toBe(true);
        expect(DAMAGE_RULESET.sources.galvanizedAptitude).toBe("https://wiki.warframe.com/w/Galvanized_Aptitude");
        expect(DAMAGE_RULESET.sources.galvanizedSavvy).toBe("https://wiki.warframe.com/w/Galvanized_Savvy");
        expect(DAMAGE_RULESET.sources.galvanizedShot).toBe("https://wiki.warframe.com/w/Galvanized_Shot");
        expect(DAMAGE_RULESET.sources.tauDamage).toBe("https://wiki.warframe.com/w/Damage/Tau_Damage");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Galvanized Aptitude, Savvy, and Shot and source-defined intrinsic per-status damage bonuses affect direct hits, not radial AoE"),
        )).toBe(true);
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("statuses applied by earlier multishot instances in the same trigger") &&
            entry.includes("projects expected Tau stacks between sequential projectile instances") &&
            entry.includes("not a sampled proc history") &&
            entry.includes("Selected kill-stack progression remains unmodeled"),
        )).toBe(true);
    });

    it("records Cannonade's current Fire Rate lock as modeled", () => {
        expect(DAMAGE_RULESET.sources.cannonade).toBe("https://wiki.warframe.com/w/Cannonade_Mods");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("ignore positive and negative Fire Rate modifiers while a compatible Cannonade mod is equipped"),
        )).toBe(true);
        expect(DAMAGE_RULESET.knownLimitations.some((entry) => entry.includes("Cannonade's fire-rate lock remain unmodeled"))).toBe(false);
    });

    it("documents the supported variable Auto-Spool sequences and the standard Kohm boundary", () => {
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Variable pellet, per-pellet Status Chance, ammo-cost, and rate ramps are modeled for Kohmak, Twin Kohmak, and Kuva Kohm") &&
            entry.includes("linearly inferred from Wiki endpoint costs") &&
            entry.includes("Standard Kohm finite timing remains unavailable"),
        )).toBe(true);
    });

    it("records Range Advantage's Wiki distance condition and single-target boundary", () => {
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Range Advantage uses the Wiki's rank-scaled +50% to +300% additive Damage") &&
            entry.includes("only when no enemy is within 10m") &&
            entry.includes("additional enemy positions inside 10m are not simulated"),
        )).toBe(true);
    });

    it("records Tennokai's Wiki sources and unmodeled cadence boundary", () => {
        expect(DAMAGE_RULESET.sources.tennokai).toBe("https://wiki.warframe.com/w/Melee#Tennokai");
        expect(DAMAGE_RULESET.sources.tennokaiMods).toBe("https://wiki.warframe.com/w/Tennokai_Mods");
        expect(DAMAGE_RULESET.sources.truthsFlame).toBe("https://wiki.warframe.com/w/Truth%27s_Flame");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("qualifying direct melee hits") &&
            entry.includes("15% base chance and 2-second window") &&
            entry.includes("Tennokai-only damage/crit/status bonuses") &&
            entry.includes("affected ranks are excluded from Auto Optimize"),
        )).toBe(true);
    });

    it("records Sentient Surge's source-backed stack and magazine limitations", () => {
        expect(DAMAGE_RULESET.sources.sentientSurge).toBe("https://wiki.warframe.com/w/Sentient_Surge");
        expect(DAMAGE_RULESET.sources.ocucor).toBe("https://wiki.warframe.com/w/Ocucor");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Sentient Surge uses each catalog rank's Wiki-backed additive Critical Chance and Status Chance bonus per active Ocucor tendril"),
        )).toBe(true);
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Extra tendril beams, their follow-on target damage, and multi-target kill chains are not simulated."),
        )).toBe(true);
    });

    it("records Proton Jet and Proton Snap's Wiki sources and wall-latch limits", () => {
        expect(DAMAGE_RULESET.sources.protonJet).toBe("https://wiki.warframe.com/w/Proton_Jet");
        expect(DAMAGE_RULESET.sources.protonSnap).toBe("https://wiki.warframe.com/w/Proton_Snap");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Proton Jet's rank-scaled Critical Chance and Status Chance") &&
            entry.includes("Proton Snap requires a two-second latch") &&
            entry.includes("flat additive Status Chance"),
        )).toBe(true);
    });

    it("records Burning Hate's Wiki source and proc-timing boundary", () => {
        expect(DAMAGE_RULESET.sources.burningHate).toBe("https://wiki.warframe.com/w/Burning_Hate");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Burning Hate applies its rank-scaled, permanent target-side Status Damage vulnerability"),
        )).toBe(true);
    });

    it("records Magnetic's shield-regeneration rule and encounter limitation", () => {
        expect(DAMAGE_RULESET.sources.shield).toBe("https://wiki.warframe.com/w/Shield");
        expect(DAMAGE_RULESET.sources.magnetic).toBe("https://wiki.warframe.com/w/Damage/Magnetic_Damage");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("external Shield restoration can bypass that penalty"),
        )).toBe(true);
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("The encounter models no natural Shield recharge or external Shield restoration"),
        )).toBe(true);
    });

    it("records the Wiki source and scope for heavy-attack critical chance", () => {
        expect(DAMAGE_RULESET.sources.galvanizedSteel).toBe("https://wiki.warframe.com/w/Galvanized_Steel");
        expect(DAMAGE_RULESET.sources.heavyAttack).toBe("https://wiki.warframe.com/w/Heavy_Attack");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("Galvanized Steel's +110% is therefore +110% on ordinary attacks and +220% total on heavy attacks"),
        )).toBe(true);
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

    it("matches the Wiki's mixed physical-damage quantization example against an Infested target", () => {
        // WARFRAME Wiki Damage/Calculation's 100 base-damage example quantizes
        // 30 Impact / 30 Puncture / 40 Slash to 31.25 / 31.25 / 40.625.
        // Its Charger example then applies the current +50% Infested Slash
        // damage modifier for 123.4375 total damage.
        const baseDamage = 100;
        const quantizedImpact = quantizeDamageContribution(30, baseDamage);
        const quantizedPuncture = quantizeDamageContribution(30, baseDamage);
        const quantizedSlash = quantizeDamageContribution(40, baseDamage);

        expect([quantizedImpact, quantizedPuncture, quantizedSlash]).toEqual([31.25, 31.25, 40.625]);
        expect(factionDamageTypeModifier("infested", "slash")).toBe(0.5);
        const chargerDamage = applyHealthDamageTypeModifiers({
            impact: quantizedImpact,
            puncture: quantizedPuncture,
            slash: quantizedSlash,
        }, "infested");

        expect(chargerDamage.impact).toBe(31.25);
        expect(chargerDamage.puncture).toBe(31.25);
        expect(chargerDamage.slash).toBe(60.9375);
        expect(Object.values(chargerDamage).reduce((sum, damage) => sum + damage, 0)).toBe(123.4375);
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

    it("grows Gas cloud radius by active stacks and estimates uniform outer-ring coverage", () => {
        expect(gasCloudRadiusFromStacks(0)).toBe(0);
        expect(gasCloudRadiusFromStacks(1)).toBeCloseTo(3.3, 12);
        expect(gasCloudRadiusFromStacks(5)).toBeCloseTo(4.5, 12);
        expect(gasCloudRadiusFromStacks(10)).toBe(6);
        expect(gasCloudRadiusFromStacks(20)).toBe(6);
        expect(gasCloudRadiusFromStacks(Number.NaN)).toBe(0);

        expect(gasCloudOuterAnnulusCoverage(3)).toBe(0);
        expect(gasCloudOuterAnnulusCoverage(4.5)).toBeCloseTo(5 / 12, 12);
        expect(gasCloudOuterAnnulusCoverage(6)).toBe(1);
        expect(gasCloudOuterAnnulusCoverage(Number.NaN)).toBe(0);
    });

    it("normalizes inner and outer Electric/Gas neighbor counts to one shared limit", () => {
        expect(normalizeElectricGasNeighborCounts(4.9, 8.9)).toEqual({ innerCount: 4, outerCount: 8 });
        expect(normalizeElectricGasNeighborCounts(18.9, 8.9)).toEqual({ innerCount: 18, outerCount: 2 });
        expect(normalizeElectricGasNeighborCounts(99, 2)).toEqual({ innerCount: 20, outerCount: 0 });
        expect(normalizeElectricGasNeighborCounts(-3, Number.NaN)).toEqual({ innerCount: 0, outerCount: 0 });
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

describe("Sacrificial set source record", () => {
    it("records the current set and member pages plus its modeled compatibility boundary", () => {
        expect(DAMAGE_RULESET.sources.setMods).toBe("https://wiki.warframe.com/w/Set_Mods");
        expect(DAMAGE_RULESET.sources.sacrificialPressure).toBe("https://wiki.warframe.com/w/Sacrificial_Pressure");
        expect(DAMAGE_RULESET.sources.sacrificialSteel).toBe("https://wiki.warframe.com/w/Sacrificial_Steel");
        expect(DAMAGE_RULESET.sources.factionDamageBonus).toBe("https://wiki.warframe.com/w/Faction_Damage_Bonus");
        expect(DAMAGE_RULESET.knownLimitations.some((entry) =>
            entry.includes("both canonical Sacrificial mods are selected on the active melee weapon") &&
            entry.includes("Sentients is normalized to the planner's Sentient faction key") &&
            entry.includes("different inactive weapon"),
        )).toBe(true);
    });
});
