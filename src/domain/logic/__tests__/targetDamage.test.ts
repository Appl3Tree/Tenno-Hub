import { describe, expect, it } from "vitest";
import {
    calculateDirectDamageToInitialPools,
    effectiveDamageProgressMultiplier,
    simulateDirectAttackSequence,
    simulateExpectedWeaponEncounter,
} from "../targetDamage";
import type { WeaponDamageRampRule } from "../../catalog/weaponCatalog";

const phantasmaRamp: WeaponDamageRampRule = {
    minimumDamageMultiplier: 0.15,
    rampToFullSeconds: 0.6,
    idleBeforeDecaySeconds: 0.8,
    decayToMinimumSeconds: 2,
};

describe("target damage progress across defense pools", () => {
    it("strips persistent base armor on each Impact hit before percentage strips", () => {
        const sequence = simulateDirectAttackSequence({
            damageByType: { impact: 2_000 },
            health: 1_500,
            shields: 0,
            overguard: 0,
            armor: 1_000,
            armorDamageReductionMultiplier: 0.5,
            baseArmorValue: 100,
            armorLevelMultiplier: 10,
            shatteringImpactBaseArmorPerHit: 6,
            faction: "",
            attackIntervalSeconds: 0.1,
        });
        const encounter = simulateExpectedWeaponEncounter({
            damageByType: { impact: 2_000 },
            health: 1_500,
            shields: 0,
            overguard: 0,
            armor: 1_000,
            baseArmorValue: 100,
            armorLevelMultiplier: 10,
            shatteringImpactBaseArmorPerHit: 6,
            faction: "",
            attackIntervalSeconds: 0.1,
            maxAttacks: 10,
        });

        expect(sequence.attacksToKill).toBe(2);
        expect(sequence.remainingArmorAfterBaseStrip).toBe(880);
        expect(encounter.attacks).toBe(2);
        expect(encounter.remainingArmorAfterBaseStrip).toBe(880);
        expect(encounter.statusApplicationsByType.impact ?? 0).toBe(0);
    });

    it("does not strip armor when the qualifying hit has no Impact damage", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { puncture: 100 },
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 1_000,
            baseArmorValue: 100,
            armorLevelMultiplier: 10,
            shatteringImpactBaseArmorPerHit: 6,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 1,
        });

        expect(result.remainingArmorAfterBaseStrip).toBe(1_000);
    });

    it("includes noncritical-hit procs in an initial-pool damage estimate", () => {
        const result = calculateDirectDamageToInitialPools({
            damageByType: { impact: 100 },
            health: 2_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            critChance: 0,
            critMultiplier: 2,
            nonCriticalHitDamageProcs: [{ chance: 0.5, damageBonus: 20 }],
        });

        expect(result.uncappedDamageByPool.health).toBeCloseTo(1_100, 8);
    });

    it("uses expected noncritical damage procs in finite encounter scoring", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 1_100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            critChance: 0,
            critMultiplier: 2,
            nonCriticalHitDamageProcs: [{ chance: 0.5, damageBonus: 20 }],
            attackIntervalSeconds: 1,
            maxAttacks: 1,
        });

        expect(result.timeToKillSeconds).toBe(0);
        expect(result.directDamageByPool.health).toBeCloseTo(1_100, 8);
    });

    it("ramps timed hit-triggered damage after qualifying attacks instead of granting it on the first hit", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 320 },
            rawDamageByType: { impact: 320 },
            baseDamageTotal: 320,
            health: 1_920,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.1,
            timedConditionalDamageStacks: [{
                trigger: "onNonCriticalNoStatusHit",
                durationSeconds: 10,
                maxStacks: 3,
                damageBonusPerStack: 4,
                qualifyingHitGroupProbability: 1,
                initialStacks: 0,
                steadyStateStacks: 3,
            }],
            maxAttacks: 10,
        });

        expect(result.attacks).toBe(2);
        expect(result.timeToKillSeconds).toBeCloseTo(0.1, 8);
        expect(result.directDamageByPool.health).toBeCloseTo(1_920, 8);
    });

    it("decays timed hit-triggered damage one stack at each full idle duration", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 320 },
            rawDamageByType: { impact: 320 },
            baseDamageTotal: 320,
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 10,
            timedConditionalDamageStacks: [{
                trigger: "onNonCriticalNoStatusHit",
                durationSeconds: 10,
                maxStacks: 3,
                damageBonusPerStack: 4,
                qualifyingHitGroupProbability: 0,
                initialStacks: 2,
                steadyStateStacks: 2,
            }],
            maxAttacks: 3,
            maxDurationSeconds: 25,
        });

        expect(result.attacks).toBe(3);
        expect(result.timeToKillSeconds).toBeNull();
        expect(result.directDamageByPool.health).toBeCloseTo(4_800, 8);
    });

    it("uses expected qualifying-group probability when ramping timed hit stacks", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 320 },
            rawDamageByType: { impact: 320 },
            baseDamageTotal: 320,
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.1,
            timedConditionalDamageStacks: [{
                trigger: "onNonCriticalNoStatusHit",
                durationSeconds: 10,
                maxStacks: 3,
                damageBonusPerStack: 4,
                qualifyingHitGroupProbability: 0.5,
                initialStacks: 0,
                steadyStateStacks: 2,
            }],
            maxAttacks: 3,
        });

        // Expected bonuses are 0, half a stack, then one stack before each hit.
        expect(result.directDamageByPool.health).toBeCloseTo(2_880, 8);
    });

    it("applies Condition Overload only from statuses active before each hit and scales proc seeds", () => {
        const direct = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 0,
            shields: 10_000,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            shotsPerMagazine: 10,
            conditionOverloadDamagePerStatusBonus: 0.8,
            forcedStatusApplicationsPerAttackByType: { viral: 1 },
            maxAttacks: 2,
            maxDurationSeconds: 2,
        });
        expect(direct.directDamageByPool.shields).toBeCloseTo(280, 8);

        const slash = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            shotsPerMagazine: 10,
            conditionOverloadDamagePerStatusBonus: 0.8,
            forcedStatusApplicationsPerAttackByType: { slash: 1 },
            dotDamagePerAttackByType: { slash: 20 },
            dotDamagePerApplicationByType: { slash: 10 },
            dotSeedDamagePerApplicationByType: { slash: 10 },
            dotAccumulatorDamagePerApplicationByType: { slash: 0 },
            maxAttacks: 2,
            maxDurationSeconds: 8,
        });
        expect(slash.statusDamageByPool.health).toBeCloseTo(28, 6);
    });

    it("uses externally maintained Condition Overload types before every attack", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 0,
            shields: 10_000,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            shotsPerMagazine: 10,
            conditionOverloadDamagePerStatusBonus: 0.8,
            externalConditionOverloadStatusTypeCount: 2,
            forcedStatusApplicationsPerAttackByType: { viral: 1 },
            maxAttacks: 2,
            maxDurationSeconds: 2,
        });

        // First hit: 2 externally maintained types. Second hit: those plus
        // the Viral status applied by the first hit. The current hit cannot
        // count its own newly applied proc.
        expect(result.directDamageByPool.shields).toBeCloseTo(600, 8);
    });

    it("weights damage by the time each active pool takes to deplete", () => {
        const shares = { overguard: 0, shields: 0.6, health: 0.4 };
        const multiplier = effectiveDamageProgressMultiplier(shares, {
            shields: 1,
            health: 4.25,
        });

        expect(multiplier).toBeCloseTo(1 / (0.6 + 0.4 / 4.25), 12);
    });

    it("lets Toxin skip Shields while still accounting for Overguard", () => {
        const shares = { overguard: 0.2, shields: 0.4, health: 0.4 };
        const multipliers = { overguard: 1, shields: 1, health: 4.25 };

        const ordinaryDamage = effectiveDamageProgressMultiplier(shares, multipliers);
        const toxinDamage = effectiveDamageProgressMultiplier(shares, multipliers, ["shields"]);

        expect(ordinaryDamage).toBeCloseTo(1 / (0.2 + 0.4 + 0.4 / 4.25), 12);
        expect(toxinDamage).toBeCloseTo(1 / (0.2 + 0.4 / 4.25), 12);
        expect(toxinDamage).toBeLessThan(1 / (0.4 / 4.25));
    });

    it("does not award damage progress through a resistant pool with no outgoing damage", () => {
        expect(effectiveDamageProgressMultiplier(
            { overguard: 0, shields: 0, health: 1 },
            { health: 0 },
        )).toBe(0);
        expect(effectiveDamageProgressMultiplier(
            { overguard: 0, shields: 0, health: 0 },
            { health: 1 },
        )).toBe(0);
    });
});

describe("single-attack damage against the target's current pools", () => {
    it("routes ordinary damage to shields and Toxin/True to health while shields remain", () => {
        const result = calculateDirectDamageToInitialPools({
            damageByType: { impact: 10, toxin: 10, true: 5 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "Corpus",
        });

        expect(result.activePool).toBe("shields-and-health");
        expect(result.damageByPool).toEqual({ overguard: 0, shields: 10, health: 15 });
    });

    it("applies Damage 3.0 faction modifiers and armor to Health by damage type", () => {
        const unarmored = calculateDirectDamageToInitialPools({
            damageByType: { impact: 10, slash: 10 },
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "Grineer",
        });
        const armored = calculateDirectDamageToInitialPools({
            damageByType: { impact: 10, slash: 10 },
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 2700,
            faction: "Grineer",
        });

        expect(unarmored.damageByPool.health).toBe(25);
        // At 2700 armor, 10% survives; the one-damage-per-type floor applies
        // after the Grineer Impact modifier and armor reduction.
        expect(armored.damageByPool.health).toBeCloseTo(2.5, 12);
    });

    it("keeps Toxin behind Overguard and applies Void's 50% Overguard vulnerability", () => {
        const result = calculateDirectDamageToInitialPools({
            damageByType: { impact: 10, toxin: 20, void: 10 },
            health: 100,
            shields: 100,
            overguard: 100,
            armor: 2700,
            faction: "Grineer",
        });

        expect(result.activePool).toBe("overguard");
        expect(result.damageByPool).toEqual({ overguard: 45, shields: 0, health: 0 });
    });

    it("amplifies Health separately from Shield/Overguard and clamps applied damage", () => {
        const shielded = calculateDirectDamageToInitialPools({
            damageByType: { impact: 10, toxin: 10 },
            health: 5,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "Grineer",
            viralHealthDamageBonus: 1,
            magneticDefenseDamageBonus: 1,
            expectedHitDamageMultiplier: 2,
            expectedProjectiles: 2,
        });

        expect(shielded.uncappedDamageByPool).toEqual({ overguard: 0, shields: 80, health: 80 });
        expect(shielded.damageByPool).toEqual({ overguard: 0, shields: 80, health: 5 });
        expect(shielded.totalDamage).toBe(85);
    });

    it("separates actual projectile count from unique extra-projectile damage", () => {
        const result = calculateDirectDamageToInitialPools({
            damageByType: { impact: 100 },
            health: 1_600,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            expectedProjectiles: 1.2,
            expectedDamageMultiplier: 1.308,
        });

        expect(result.uncappedDamageByPool.health).toBeCloseTo(130.8, 12);
    });

    it("uses the first-tick minimum and advances the ramp in a direct attack sequence", () => {
        const initialHit = calculateDirectDamageToInitialPools({
            damageByType: { impact: 100 },
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            damageRampRule: phantasmaRamp,
        });
        const sequence = simulateDirectAttackSequence({
            damageByType: { impact: 100 },
            health: 50,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            damageRampRule: phantasmaRamp,
            attackIntervalSeconds: 1 / 12,
            shotsPerMagazine: 22,
            reloadDurationSeconds: 0.5,
        });

        expect(initialHit.uncappedDamageByPool.health).toBe(15);
        expect(sequence.attacksToKill).toBe(3);
        expect(sequence.timeToKillSeconds).toBeCloseTo(2 / 12, 12);
        expect(sequence.damageByPool.health).toBe(50);
    });

    it("ramps direct hits and per-attack Heat seeds while leaving the tick accumulator unchanged", () => {
        const encounter = simulateExpectedWeaponEncounter({
            damageByType: { impact: 10 },
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            damageRampRule: phantasmaRamp,
            attackIntervalSeconds: 1 / 12,
            shotsPerMagazine: 22,
            reloadDurationSeconds: 0.5,
            maxAttacks: 1,
            maxDurationSeconds: 1,
            dotDamagePerAttackByType: { heat: 10 },
            dotDamagePerApplicationByType: { heat: 10 },
            heatDotTickDamagePerProc: 10,
            heatDotAccumulatorDamagePerTick: 2,
            expectedStatusApplicationsPerAttackByType: { heat: 1 },
        });

        expect(encounter.directDamageByPool.health).toBeCloseTo(1.5, 12);
        expect(encounter.statusDamageByPool.health).toBeCloseTo(3.5, 12);
        expect(encounter.statusApplicationsByType.heat).toBe(1);
    });

    it("supports a target that does not allow Toxin to bypass Shields", () => {
        const result = calculateDirectDamageToInitialPools({
            damageByType: { toxin: 10 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "Corpus",
            toxinBypassesShields: false,
        });

        expect(result.damageByPool).toEqual({ overguard: 0, shields: 10, health: 0 });
    });

    it("depletes Overguard before Shields and Health across separate attacks", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 10, toxin: 10 },
            health: 20,
            shields: 20,
            overguard: 15,
            armor: 0,
            faction: "Corpus",
            attackIntervalSeconds: 0.5,
            shotsPerMagazine: 2,
            reloadDurationSeconds: 1,
        });

        expect(result.attacksToKill).toBe(3);
        expect(result.timeToKillSeconds).toBe(2);
        expect(result.damageByPool).toEqual({ overguard: 15, shields: 20, health: 20 });
        expect(result.remainingPools).toEqual({ overguard: 0, shields: 0, health: 0 });
    });

    it("spends combo after each Heavy Attack and rebuilds Initial Combo at 40 points per second", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 500 },
            health: 900,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            expectedHitDamageMultiplier: 1,
            attackIntervalSeconds: 1,
            heavyAttackCombo: {
                startingPoints: 80,
                startingMultiplier: 5,
                pointsPerTier: 20,
                maxMultiplier: 12,
                heavyAttackEfficiency: 0,
                initialComboPoints: 80,
                startingCritChance: 0,
                critChancePerTier: 0,
                critDamageMultiplier: 2,
            },
        });

        // First Heavy Attack is 5x; after spending all 80 points, one second
        // restores 40 Initial Combo points, giving the next hits 3x damage.
        expect(result.attacksToKill).toBe(3);
        expect(result.timeToKillSeconds).toBe(2);
        expect(result.damageByPool.health).toBe(900);
        expect(result.comboMultiplierAtStart).toBe(5);
        expect(result.comboMultiplierAtKill).toBe(3);
    });

    it("applies Heavy Attack Efficiency before Initial Combo regenerates", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 500 },
            health: 900,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            expectedHitDamageMultiplier: 1.5,
            attackIntervalSeconds: 1,
            heavyAttackCombo: {
                startingPoints: 80,
                startingMultiplier: 5,
                pointsPerTier: 20,
                maxMultiplier: 12,
                heavyAttackEfficiency: 0.4,
                initialComboPoints: 80,
                startingCritChance: 0.5,
                critChancePerTier: 0,
                critDamageMultiplier: 2,
            },
        });

        // 32 points are retained, then 40 are restored over one second: 72
        // points start the second attack at the 4x tier.
        expect(result.attacksToKill).toBe(2);
        expect(result.comboMultiplierAtStart).toBe(5);
        expect(result.comboMultiplierAtKill).toBe(4);
    });

    it("does not regenerate combo-built points above the Initial Combo baseline", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 500 },
            health: 700,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            expectedHitDamageMultiplier: 1,
            attackIntervalSeconds: 1,
            heavyAttackCombo: {
                startingPoints: 80,
                startingMultiplier: 5,
                pointsPerTier: 20,
                maxMultiplier: 12,
                heavyAttackEfficiency: 0,
                initialComboPoints: 0,
                startingCritChance: 0,
                critChancePerTier: 0,
                critDamageMultiplier: 2,
            },
        });

        expect(result.attacksToKill).toBe(3);
        expect(result.comboMultiplierAtKill).toBe(1);
    });

    it("updates combo-scaled critical chance as Heavy Attacks consume tiers", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 500 },
            health: 1_600,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            expectedHitDamageMultiplier: 1.5,
            attackIntervalSeconds: 1,
            heavyAttackCombo: {
                startingPoints: 80,
                startingMultiplier: 5,
                pointsPerTier: 20,
                maxMultiplier: 12,
                heavyAttackEfficiency: 0,
                initialComboPoints: 80,
                startingCritChance: 0.5,
                critChancePerTier: 0.1,
                critDamageMultiplier: 2,
            },
        });

        // First attack deals 750 at 5x combo crit expectation. Later hits
        // recover to 3x and deal 390, so four hits are needed for 1,600 Health.
        expect(result.attacksToKill).toBe(4);
        expect(result.damageByPool.health).toBe(1_600);
        expect(result.comboMultiplierAtKill).toBe(3);
    });

    it("keeps an ammo-efficiency-expanded magazine together before inserting a reload", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 1 },
            health: 11,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            shotsPerMagazine: 10,
            reloadDurationSeconds: 2,
        });

        expect(result.attacksToKill).toBe(11);
        // The eleventh shot follows ten full-ammo-efficiency shots and one reload.
        expect(result.timeToKillSeconds).toBe(12);
    });

    it("lets bypass damage kill Health before the Shield pool is depleted", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 10, toxin: 10 },
            health: 15,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "Corpus",
            attackIntervalSeconds: 0.25,
        });

        expect(result.attacksToKill).toBe(2);
        expect(result.timeToKillSeconds).toBe(0.25);
        expect(result.damageByPool).toEqual({ overguard: 0, shields: 20, health: 15 });
        expect(result.remainingPools).toEqual({ overguard: 0, shields: 80, health: 0 });
    });

    it("reports an unreachable direct-hit kill when a required pool receives no damage", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 0 },
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "Corpus",
            attackIntervalSeconds: 0.5,
        });

        expect(result.attacksToKill).toBeNull();
        expect(result.timeToKillSeconds).toBeNull();
        expect(result.remainingPools.health).toBe(100);
    });
});

describe("finite expected-value weapon encounters", () => {
    it("uses damage-weighted projectiles for hits while retaining actual count for status rolls", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 1,
            expectedProjectiles: 1.2,
            expectedDamageMultiplier: 1.308,
            statusProcWeightsByType: { impact: 100 },
            statusRollsPerAttack: 1.2,
        });

        expect(result.directDamageByPool.health).toBeCloseTo(130.8, 12);
        expect(result.statusApplicationsByType.impact).toBeCloseTo(1.2, 12);
    });

    it("applies a unique non-damage status after the hit for later per-status damage", () => {
        const base = {
            damageByType: { impact: 100 },
            health: 240,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            maxDurationSeconds: 2,
            directDamagePerStatusBonus: 0.4,
        } as const;

        const withMicrowave = simulateExpectedWeaponEncounter({
            ...base,
            uniqueStatusProcsPerAttack: ["microwave"],
        });
        const withoutMicrowave = simulateExpectedWeaponEncounter(base);

        expect(withMicrowave.timeToKillSeconds).toBe(1);
        expect(withMicrowave.directDamageByPool.health).toBeCloseTo(240, 12);
        expect(withoutMicrowave.timeToKillSeconds).toBeNull();
        expect(withoutMicrowave.directDamageByPool.health).toBeCloseTo(200, 12);
    });

    it.each([
        ["slash", 1],
        ["heat", 1],
        ["electricity", 0],
        ["toxin", 1],
        ["gas", 0],
    ] as const)("schedules %s DoT from its current first tick", (type, expectedFirstTick) => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 1,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 2,
            maxAttacks: 1,
            dotDamagePerAttackByType: { [type]: 6 },
        });

        expect(result.attacks).toBe(1);
        expect(result.timeToKillSeconds).toBe(expectedFirstTick);
        expect(result.statusDamageByPool.health).toBe(1);
    });

    it.each(["electricity", "gas"] as const)("applies scheduled %s ticks to configured nearby pools", (type) => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 10,
            maxAttacks: 1,
            maxDurationSeconds: 6,
            dotDamagePerAttackByType: { [type]: 6 },
            nearbyElectricGasEnemyCount: 2,
        });

        expect(result.timeToKillSeconds).toBeNull();
        expect(result.statusDamageByPool.health).toBeCloseTo(6, 12);
        expect(result.electricGasCollateralEnemyCount).toBe(2);
        expect(result.electricGasCollateralDamageByPool.health).toBeCloseTo(12, 12);
    });

    it("continues Gas cloud collateral ticks after the host target dies", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 1,
            maxDurationSeconds: 6,
            dotDamagePerAttackByType: { gas: 6 },
            nearbyElectricGasEnemyCount: 1,
        });

        expect(result.timeToKillSeconds).toBe(0);
        expect(result.evaluatedDurationSeconds).toBe(0);
        expect(result.electricGasCollateralDamageByPool.health).toBeCloseTo(6, 12);
    });

    it("applies multiple Electricity stacks as one damage pulse per second", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 100,
            shields: 1,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 10,
            maxAttacks: 1,
            maxDurationSeconds: 6,
            dotDamagePerAttackByType: { electricity: 12 },
            expectedStatusApplicationsPerAttackByType: { electricity: 2 },
            dotDamagePerApplicationByType: { electricity: 6 },
            nearbyElectricGasEnemyCount: 1,
        });

        // Two stacks make one 2-damage pulse per second. Its excess does not
        // spill from the one-point Shield pool during that same pulse.
        expect(result.statusDamageByPool.shields).toBeCloseTo(1, 12);
        expect(result.statusDamageByPool.health).toBeCloseTo(10, 12);
        expect(result.electricGasCollateralDamageByPool.shields).toBeCloseTo(1, 12);
        expect(result.electricGasCollateralDamageByPool.health).toBeCloseTo(10, 12);
    });

    it("replaces the oldest Gas cloud at ten stacks and cancels its future ticks", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.1,
            maxAttacks: 11,
            maxDurationSeconds: 7,
            dotDamagePerAttackByType: { gas: 6 },
            dotDamagePerApplicationByType: { gas: 6 },
            expectedStatusApplicationsPerAttackByType: { gas: 1 },
        });

        // Eleven six-tick clouds would deal 66 damage; the oldest one has
        // already ticked once when the eleventh application replaces it.
        expect(result.statusDamageByPool.health).toBeCloseTo(61, 10);
        expect(result.statusApplicationsByType.gas).toBeCloseTo(11, 10);
    });

    it("schedules only the DoT ticks that land before the target is defeated", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 3,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 2,
            maxAttacks: 1,
            dotDamagePerAttackByType: { toxin: 6 },
        });

        expect(result.attacks).toBe(1);
        expect(result.timeToKillSeconds).toBe(3);
        expect(result.directDamageByPool.health).toBe(0);
        expect(result.statusDamageByPool.health).toBe(3);
        expect(result.remainingPools.health).toBe(0);
    });

    it("adds Heat stacks to one tick stream and refreshes all active stack durations", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 2,
            maxAttacks: 2,
            expectedStatusApplicationsPerAttackByType: { heat: 1 },
            heatDotTickDamagePerProc: 10,
            heatDotAccumulatorDamagePerTick: 1,
        });

        // The first proc ticks for 11 at t=1. The second arrives before its
        // next tick, adds another seed (while retaining one group accumulator),
        // and refreshes both stacks through t=8.
        expect(result.attacks).toBe(2);
        expect(result.timeToKillSeconds).toBeNull();
        expect(result.statusDamageByPool.health).toBe(158);
    });

    it("uses burst shot timing instead of spreading every hit evenly", () => {
        const sequence = simulateDirectAttackSequence({
            damageByType: { impact: 1 },
            health: 4,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1 / (3 / (0.5 + 2 * 0.1)),
            shotsPerMagazine: 10,
            burstCount: 3,
            burstDelaySeconds: 0.1,
            burstCycleRate: 2,
        });
        const encounter = simulateExpectedWeaponEncounter({
            damageByType: { impact: 1 },
            health: 4,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1 / (3 / (0.5 + 2 * 0.1)),
            shotsPerMagazine: 10,
            burstCount: 3,
            burstDelaySeconds: 0.1,
            burstCycleRate: 2,
            maxAttacks: 10,
        });

        expect(sequence.attacksToKill).toBe(4);
        expect(sequence.timeToKillSeconds).toBeCloseTo(0.7, 10);
        expect(encounter.attacks).toBe(4);
        expect(encounter.timeToKillSeconds).toBeCloseTo(0.7, 10);
    });

    it("reloads Perigale Prime after four four-shot bursts", () => {
        const attackIntervalSeconds = 1 / (4 / (0.5 + 3 * 0.04));
        const sequence = simulateDirectAttackSequence({
            damageByType: { impact: 1 },
            health: 17,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds,
            shotsPerMagazine: 16,
            reloadDurationSeconds: 3,
            burstCount: 4,
            burstDelaySeconds: 0.04,
            burstCycleRate: 2,
        });
        const encounter = simulateExpectedWeaponEncounter({
            damageByType: { impact: 1 },
            health: 17,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds,
            shotsPerMagazine: 16,
            reloadDurationSeconds: 3,
            burstCount: 4,
            burstDelaySeconds: 0.04,
            burstCycleRate: 2,
            maxAttacks: 17,
        });

        // Perigale Prime carries 16 rounds, so four four-shot trigger pulls
        // exhaust the magazine. Its first shot after reloading follows four
        // burst cycles plus the reload.
        expect(sequence.attacksToKill).toBe(17);
        expect(sequence.timeToKillSeconds).toBeCloseTo(4 * 0.62 + 3, 10);
        expect(encounter.attacks).toBe(17);
        expect(encounter.timeToKillSeconds).toBeCloseTo(4 * 0.62 + 3, 10);
    });

    it("applies Chamber bonuses to the first attack after each magazine reload", () => {
        const common = {
            damageByType: { impact: 100 },
            health: 550,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            shotsPerMagazine: 2,
            firstShotMagazineDamageBonus: 1,
            reloadDurationSeconds: 2,
        };

        const sequence = simulateDirectAttackSequence(common);
        const encounter = simulateExpectedWeaponEncounter({ ...common, maxAttacks: 6 });
        const ordinarySequence = simulateDirectAttackSequence({
            ...common,
            firstShotMagazineDamageBonus: 0,
        });

        // Hits land at 0, 1, 4, and 5 seconds. Chamber doubles the first and
        // third hits, which are the first ammo-consuming attacks per magazine.
        expect(sequence.attacksToKill).toBe(4);
        expect(sequence.timeToKillSeconds).toBeCloseTo(5, 10);
        expect(ordinarySequence.attacksToKill).toBe(6);
        expect(ordinarySequence.timeToKillSeconds).toBeCloseTo(9, 10);
        expect(encounter.attacks).toBe(4);
        expect(encounter.directDamageByPool.health).toBeCloseTo(550, 10);
        expect(encounter.timeToKillSeconds).toBeCloseTo(5, 10);
    });

    it("applies a final-shot magazine bonus to one hit among multishot projectiles", () => {
        const common = {
            damageByType: { impact: 100 },
            health: 2_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            expectedDamageMultiplier: 3,
            shotsPerMagazine: 4,
            lastShotMagazineDamageBonus: 2,
            reloadDurationSeconds: 2,
        };

        const encounter = simulateExpectedWeaponEncounter({ ...common, maxAttacks: 4 });
        const sequence = simulateDirectAttackSequence({ ...common, health: 1_400 });

        // The final 3-projectile attack adds a 200% bonus to one hit (200
        // damage), not to the complete volley (600 damage).
        expect(encounter.attacks).toBe(4);
        expect(encounter.directDamageByPool.health).toBeCloseTo(1_400, 10);
        expect(sequence.attacksToKill).toBe(4);
        expect(sequence.timeToKillSeconds).toBeCloseTo(3, 10);
        expect(sequence.damageByPool.health).toBeCloseTo(1_400, 10);
    });

    it("suppresses magazine reloads and Chamber bonuses while infinite ammo is active", () => {
        const common = {
            damageByType: { impact: 100 },
            health: 250,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            shotsPerMagazine: 1,
            firstShotMagazineDamageBonus: 1,
            reloadDurationSeconds: 10,
            infiniteAmmoActive: true,
        };

        const sequence = simulateDirectAttackSequence(common);
        const encounter = simulateExpectedWeaponEncounter({ ...common, maxAttacks: 5 });

        // Three unboosted hits land at 0, 1, and 2 seconds. The magazine size,
        // reload time, and first-shot bonus do not interrupt maintained Gale Force.
        expect(sequence.attacksToKill).toBe(3);
        expect(sequence.timeToKillSeconds).toBeCloseTo(2, 10);
        expect(encounter.attacks).toBe(3);
        expect(encounter.timeToKillSeconds).toBeCloseTo(2, 10);
        expect(encounter.directDamageByPool.health).toBeCloseTo(250, 10);
    });

    it("applies a first-shot Chamber multiplier to the DoT seeded by that attack", () => {
        const encounter = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            shotsPerMagazine: 16,
            firstShotMagazineDamageBonus: 0.4,
            dotDamagePerAttackByType: { slash: 20 },
            maxAttacks: 1,
            maxDurationSeconds: 7,
        });

        expect(encounter.statusDamageByPool.health).toBeCloseTo(28, 10);
    });

    it("keeps a partial final burst inside the magazine before reloading", () => {
        const result = simulateDirectAttackSequence({
            damageByType: { impact: 1 },
            health: 11,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1 / (3 / (0.5 + 2 * 0.1)),
            shotsPerMagazine: 10,
            reloadDurationSeconds: 2,
            burstCount: 3,
            burstDelaySeconds: 0.1,
            burstCycleRate: 2,
        });

        expect(result.attacksToKill).toBe(11);
        // The 10-round magazine ends in a one-shot burst after three full
        // bursts. The next magazine starts after four trigger cycles and reload.
        expect(result.timeToKillSeconds).toBeCloseTo(4 * 0.7 + 2, 10);
    });

    it("keeps Toxin behind Overguard, then routes its later ticks through Shields to Health", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { toxin: 1 },
            health: 2,
            shields: 2,
            overguard: 1,
            armor: 0,
            faction: "",
            toxinBypassesShields: true,
            attackIntervalSeconds: 10,
            maxAttacks: 1,
            dotDamagePerAttackByType: { toxin: 6 },
        });

        expect(result.timeToKillSeconds).toBe(2);
        expect(result.directDamageByPool.overguard).toBe(1);
        expect(result.statusDamageByPool.overguard).toBe(0);
        expect(result.statusDamageByPool.health).toBe(2);
        expect(result.remainingPools.shields).toBe(2);
    });

    it("applies Slash Bleed to Shields before Health and bypasses Armor", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 1,
            shields: 2,
            overguard: 0,
            armor: 3_000,
            faction: "Grineer",
            attackIntervalSeconds: 10,
            maxAttacks: 1,
            dotDamagePerAttackByType: { slash: 6 },
        });

        expect(result.timeToKillSeconds).toBe(3);
        expect(result.statusDamageByPool.shields).toBe(2);
        expect(result.statusDamageByPool.health).toBe(1);
    });

    it("schedules expected Blast damage at its delayed detonation time", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 6,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 2,
            maxAttacks: 1,
            blastDamagePerAttack: 6,
        });

        expect(result.attacks).toBe(1);
        expect(result.timeToKillSeconds).toBe(1.5);
        expect(result.statusDamageByPool.health).toBe(6);
        expect(result.remainingPools.health).toBe(0);
    });

    it("pays only normal single-target Blast stack damage on the afflicted target at cap", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 18,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.5,
            maxAttacks: 2,
            blastStackHitDamagePerProc: 3,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            statusStackCaps: { blast: 2 },
        });

        expect(result.attacks).toBe(2);
        expect(result.timeToKillSeconds).toBeNull();
        expect(result.statusDamageByPool.health).toBe(2);
        expect(result.remainingPools.health).toBe(16);
    });

    it("pays each Blast stack's normal expiry damage together when the cap is reached", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 900,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.5,
            maxAttacks: 2,
            blastStackHitDamagePerProc: 100,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            statusStackCaps: { blast: 2 },
        });

        expect(result.attacks).toBe(2);
        expect(result.timeToKillSeconds).toBeNull();
        expect(result.statusDamageByPool.health).toBeCloseTo(60, 5);
        expect(result.remainingPools.health).toBeCloseTo(840, 5);
    });

    it("applies Blast cap radial damage to configured nearby target pools", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 10000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.5,
            maxAttacks: 2,
            blastStackHitDamagePerProc: 100,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            statusStackCaps: { blast: 2 },
            nearbyBlastEnemyCount: 2,
        });

        expect(result.blastCollateralEnemyCount).toBe(2);
        expect(result.blastCollateralDamageByPool.health).toBeCloseTo(1200, 5);
        expect(result.totalDamage).toBeCloseTo(60, 5);
        expect(result.timeToKillSeconds).toBeNull();
    });

    it("triggers a Blast radial on a killing blow that applies a new Blast proc", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { blast: 100 },
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 1,
            blastStackHitDamagePerProc: 10,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            nearbyBlastEnemyCount: 1,
        });

        expect(result.timeToKillSeconds).toBe(0);
        expect(result.blastCollateralDamageByPool.health).toBeCloseTo(30, 5);
    });

    it("uses a four-stack Blast threshold for a boss target", () => {
        const boss = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.1,
            maxAttacks: 4,
            blastStackHitDamagePerProc: 100,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            statusStackCaps: { blast: 4 },
        });

        expect(boss.attacks).toBe(4);
        expect(boss.timeToKillSeconds).toBeCloseTo(0.3, 10);
        expect(boss.statusDamageByPool.health).toBe(100);
        expect(boss.remainingPools.health).toBe(0);
    });

    it("applies Blast's one-damage minimum to a naturally expired stack", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 1,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 2,
            maxAttacks: 1,
            blastStackHitDamagePerProc: 2,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
        });

        expect(result.timeToKillSeconds).toBe(1.5);
        expect(result.statusDamageByPool.health).toBe(1);
    });

    it("scales the Blast fuse with status duration and preserves immediate detonation", () => {
        const extended = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 6,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 2,
            maxAttacks: 1,
            blastStackHitDamagePerProc: 20,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            statusDurationMultiplier: 2,
        });
        const immediate = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 6,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 2,
            maxAttacks: 1,
            blastStackHitDamagePerProc: 20,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            statusDurationMultiplier: 0,
        });

        expect(extended.timeToKillSeconds).toBe(3);
        expect(immediate.timeToKillSeconds).toBe(0);
    });

    it("ramps Health damage as expected Viral stacks accumulate between attacks", () => {
        const baseline = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 500,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            critChance: 0,
            critMultiplier: 2,
            attackIntervalSeconds: 1,
            maxAttacks: 10,
        });
        const viral = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 500,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            critChance: 0,
            critMultiplier: 2,
            attackIntervalSeconds: 1,
            maxAttacks: 10,
            expectedStatusApplicationsPerAttackByType: { viral: 1 },
        });

        expect(baseline.attacks).toBe(5);
        expect(baseline.timeToKillSeconds).toBe(4);
        expect(viral.attacks).toBe(3);
        expect(viral.timeToKillSeconds).toBe(2);
        expect(viral.directDamageByPool.health).toBe(500);
    });

    it("does not accumulate a status that the target is immune to", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 400,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 4,
            expectedStatusApplicationsPerAttackByType: { viral: 1 },
            statusImmuneTypes: ["viral"],
        });

        expect(result.attacks).toBe(4);
        expect(result.timeToKillSeconds).toBe(3);
    });

    it("reweights status rolls while Overguard remains and allows Radiation after it breaks", () => {
        const whileOverguardRemains = simulateExpectedWeaponEncounter({
            damageByType: { impact: 0.25 },
            health: 100,
            shields: 0,
            overguard: 100,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 3,
            statusProcWeightsByType: { viral: 1, radiation: 1 },
            statusRollsPerAttack: 1,
        });
        const afterOverguardBreaks = simulateExpectedWeaponEncounter({
            damageByType: { impact: 0.25 },
            health: 100,
            shields: 0,
            overguard: 1,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 5,
            statusProcWeightsByType: { viral: 1, radiation: 1 },
            statusRollsPerAttack: 1,
        });

        expect(whileOverguardRemains.statusApplicationsByType.radiation ?? 0).toBe(0);
        expect(whileOverguardRemains.statusApplicationsByType.viral).toBe(3);
        expect(afterOverguardBreaks.statusApplicationsByType.radiation).toBeGreaterThan(0);
        expect(afterOverguardBreaks.statusApplicationsByType.radiation).toBeLessThan(5);
    });

    it("applies Tau vulnerability to later ordinary status rolls, but not Tau or forced procs", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 3,
            statusProcWeightsByType: { impact: 1, tau: 1 },
            statusRollsPerAttack: 1,
            forcedStatusApplicationsPerAttackByType: { impact: 1 },
        });

        // The first attack gives 0.5 Tau stacks. The next two attacks receive
        // +5% and +10% ordinary status chance, respectively. Forced Impact
        // applications and Tau's own proc chance are not amplified.
        expect(result.statusApplicationsByType.tau).toBeCloseTo(1.5, 10);
        expect(result.statusApplicationsByType.impact).toBeCloseTo(4.575, 10);
    });

    it("caps Tau vulnerability at ten stacks and expires it after eight seconds", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 3,
            maxAttacks: 5,
            statusProcWeightsByType: { slash: 1, tau: 1 },
            statusRollsPerAttack: 20,
        });

        // Ten Tau stacks cap the bonus at +100%. Those stacks expire at t=8;
        // the t=9 attack returns to the base roll count and reapplies Tau.
        expect(result.statusApplicationsByType.tau).toBe(20);
        expect(result.statusApplicationsByType.slash).toBe(80);
    });

    it("applies per-status direct-damage bonuses as encounter statuses accumulate", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            expectedStatusApplicationsPerAttackByType: { impact: 1 },
            directDamagePerStatusBonus: 0.8,
            totalDamageBonus: 0.5,
        });

        const oneActiveStatusProbability = 1 - Math.exp(-1);
        expect(result.directDamageByPool.health).toBeCloseTo(
            100 + 100 * ((1.5 + 0.8 * oneActiveStatusProbability) / 1.5),
            10,
        );
    });

    it("applies Cedo-style additive per-status damage to later direct hits", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 3,
            expectedStatusApplicationsPerAttackByType: { heat: 0.5, cold: 0.5 },
            intrinsicDamagePerStatusBonus: 0.6,
            intrinsicDamagePerStatusMode: "additiveBase",
        });

        const oneAttackPresence = 1 - Math.exp(-0.5);
        const twoAttackPresence = 1 - Math.exp(-1);
        const oneAttackTypeCount = 2 * oneAttackPresence;
        const twoAttackTypeCount = 2 * twoAttackPresence;
        // Fractional applications create a fractional expected active-type
        // count on each later hit rather than crossing a binary threshold.
        expect(result.directDamageByPool.health).toBeCloseTo(
            100 + 100 * (1 + 0.6 * oneAttackTypeCount) + 100 * (1 + 0.6 * twoAttackTypeCount),
            10,
        );
    });

    it("keeps Cedo glaive direct-hit passive multiplicative to base damage", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 200 },
            health: 2_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 3,
            expectedStatusApplicationsPerAttackByType: { heat: 0.5, cold: 0.5 },
            totalDamageBonus: 1,
            directDamagePerStatusBonus: 0.4,
            intrinsicDamagePerStatusBonus: 0.6,
            intrinsicDamagePerStatusMode: "multiplicativeBase",
        });

        const oneAttackTypeCount = 2 * (1 - Math.exp(-0.5));
        const twoAttackTypeCount = 2 * (1 - Math.exp(-1));
        const glaiveMultiplier = (typeCount: number) =>
            (2 * (1 + 0.6 * typeCount) + 0.4 * typeCount) / 2;
        expect(result.directDamageByPool.health).toBeCloseTo(
            200 + 200 * glaiveMultiplier(oneAttackTypeCount) + 200 * glaiveMultiplier(twoAttackTypeCount),
            10,
        );
    });

    it("applies a guaranteed forced status as fully present on the next hit", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            forcedStatusApplicationsPerAttackByType: { slash: 1 },
            intrinsicDamagePerStatusBonus: 0.6,
        });

        expect(result.directDamageByPool.health).toBeCloseTo(100 + 160, 10);
    });

    it("preserves fractional per-type presence for forced status applications", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            forcedStatusApplicationsPerAttackByType: { heat: 0.25, cold: 0.25 },
            intrinsicDamagePerStatusBonus: 0.6,
        });

        expect(result.directDamageByPool.health).toBeCloseTo(100 + 130, 10);
    });

    it("does not apply direct-hit per-status bonuses to scheduled DoT damage", () => {
        const baseInput = {
            damageByType: { impact: 100 },
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            expectedStatusApplicationsPerAttackByType: { heat: 1, slash: 1 },
            dotDamagePerAttackByType: { slash: 10 },
            dotDamagePerApplicationByType: { slash: 10 },
        } as const;
        const withoutBonus = simulateExpectedWeaponEncounter(baseInput);
        const withBonus = simulateExpectedWeaponEncounter({
            ...baseInput,
            directDamagePerStatusBonus: 1,
            intrinsicDamagePerStatusBonus: 0.6,
        });

        expect(withBonus.directDamageByPool.health).toBeGreaterThan(withoutBonus.directDamageByPool.health);
        expect(withBonus.statusDamageByPool.health).toBe(withoutBonus.statusDamageByPool.health);
        expect(withBonus.statusDamageByPool.health).toBeCloseTo(20, 10);
    });

    it("applies the target's four-stack Cold cap while Overguard remains", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 1_000,
            shields: 0,
            overguard: 10_000,
            armor: 0,
            faction: "",
            critChance: 0.5,
            critMultiplier: 2,
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            expectedStatusApplicationsPerAttackByType: { cold: 10 },
        });

        expect(result.attacks).toBe(2);
        expect(result.directDamageByPool.overguard).toBeCloseTo(312.5, 10);
    });

    it("keeps Blast's ten-stack detonation threshold on an Overguarded target", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: {},
            health: 0,
            shields: 0,
            overguard: 290,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.1,
            maxAttacks: 10,
            blastStackHitDamagePerProc: 100,
            expectedStatusApplicationsPerAttackByType: { blast: 1 },
            statusStackCaps: { cold: 4 },
        });

        expect(result.attacks).toBe(10);
        expect(result.timeToKillSeconds).toBeCloseTo(0.9, 10);
        expect(result.statusDamageByPool.overguard).toBeCloseTo(290, 10);
    });

    it("freezes at ten Cold stacks, blocks new Cold during freeze, then restores three stacks", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 1 },
            health: 1_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            critChance: 1,
            critMultiplier: 2,
            attackIntervalSeconds: 1,
            maxAttacks: 9,
            expectedStatusApplicationsPerAttackByType: { cold: 2 },
        });

        // 10%/+5% crit bonuses lead to 9 Cold stacks, freezing adds the full
        // +1.0x critical multiplier for three seconds, and three stacks remain.
        expect(result.directDamageByPool.health).toBeCloseTo(21.7, 10);
        expect(result.statusApplicationsByType.cold).toBe(14);
    });

    it("ramps Heat armor strip through the documented stages over two seconds", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 2_700,
            faction: "",
            critChance: 0,
            critMultiplier: 2,
            attackIntervalSeconds: 0.5,
            maxAttacks: 5,
            expectedStatusApplicationsPerAttackByType: { heat: 1 },
        });
        const expectedDamage = [0, 0.15, 0.3, 0.4, 0.5]
            .reduce((sum, strip) => sum + 100 * (1 - 0.9 * Math.sqrt(1 - strip)), 0);

        expect(result.attacks).toBe(5);
        expect(result.directDamageByPool.health).toBeCloseTo(expectedDamage, 10);
    });

    it("stretches Heat armor-strip ramp timing with status duration", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 2_700,
            faction: "",
            critChance: 0,
            critMultiplier: 2,
            attackIntervalSeconds: 1,
            maxAttacks: 3,
            statusDurationMultiplier: 2,
            expectedStatusApplicationsPerAttackByType: { heat: 1 },
        });
        const expectedDamage = [0, 0.15, 0.3]
            .reduce((sum, strip) => sum + 100 * (1 - 0.9 * Math.sqrt(1 - strip)), 0);

        expect(result.attacks).toBe(3);
        expect(result.directDamageByPool.health).toBeCloseTo(expectedDamage, 10);
    });

    it("recovers Heat armor strip in stages after the refreshed status expires", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 10_000,
            shields: 0,
            overguard: 0,
            armor: 2_700,
            faction: "",
            critChance: 0,
            critMultiplier: 2,
            attackIntervalSeconds: 10,
            maxAttacks: 2,
            expectedStatusApplicationsPerAttackByType: { heat: 1 },
        });
        const expectedDamage = 100 * (1 - 0.9) + 100 * (1 - 0.9 * Math.sqrt(0.7));

        expect(result.attacks).toBe(2);
        expect(result.directDamageByPool.health).toBeCloseTo(expectedDamage, 10);
    });

    it("reduces direct body-hit damage during the 0.1-second enemy Shield Gate", () => {
        const bodyHit = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.05,
            maxAttacks: 2,
        });
        const weakspotHit = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.05,
            maxAttacks: 2,
            enemyShieldGateHitMode: "weakspot",
        });
        const blockedAreaHit = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.05,
            maxAttacks: 2,
            enemyShieldGateHitMode: "blockedArea",
        });

        expect(bodyHit.directDamageByPool.health).toBeCloseTo(5, 10);
        expect(bodyHit.timeToKillSeconds).toBeNull();
        expect(weakspotHit.directDamageByPool.health).toBe(100);
        expect(weakspotHit.timeToKillSeconds).toBeCloseTo(0.05, 10);
        expect(blockedAreaHit.directDamageByPool.health).toBe(0);
        expect(blockedAreaHit.timeToKillSeconds).toBeNull();
    });

    it("models the enemy Shield Gate in direct-hit sequences and expires it at 0.1 seconds", () => {
        const bodyHit = simulateDirectAttackSequence({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.05,
        });
        const weakspotHit = simulateDirectAttackSequence({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.05,
            enemyShieldGateHitMode: "weakspot",
        });
        const blockedAreaHit = simulateDirectAttackSequence({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.05,
            enemyShieldGateHitMode: "blockedArea",
        });

        expect(bodyHit.attacksToKill).toBe(3);
        expect(bodyHit.timeToKillSeconds).toBeCloseTo(0.1, 10);
        expect(bodyHit.damageByPool).toEqual({ overguard: 0, shields: 100, health: 100 });
        expect(weakspotHit.attacksToKill).toBe(2);
        expect(weakspotHit.timeToKillSeconds).toBeCloseTo(0.05, 10);
        expect(blockedAreaHit.attacksToKill).toBe(3);
        expect(blockedAreaHit.timeToKillSeconds).toBeCloseTo(0.1, 10);
    });

    it("ends the enemy Shield Gate at 0.1 seconds and leaves scheduled status ticks ungated", () => {
        const atGateEnd = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 0.1,
            maxAttacks: 2,
        });
        const statusTick = simulateExpectedWeaponEncounter({
            damageByType: { impact: 100 },
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 1,
            dotDamagePerAttackByType: { electricity: 20 },
            expectedStatusApplicationsPerAttackByType: { electricity: 1 },
        });

        expect(atGateEnd.directDamageByPool.health).toBe(100);
        expect(atGateEnd.timeToKillSeconds).toBeCloseTo(0.1, 10);
        expect(statusTick.statusDamageByPool.health).toBeCloseTo(20, 10);
    });

    it("applies Magnetic's forced Electricity proc when a previously affected target loses Shields", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { magnetic: 40 },
            health: 1_000,
            shields: 100,
            overguard: 0,
            maxShields: 100,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            statusProcWeightsByType: { magnetic: 1 },
            statusRollsPerAttack: 1,
        });

        // Attack one applies a Magnetic stack without breaking Shields. On the
        // next hit the stack amplifies damage, breaks Shields, and forces a
        // six-second Electricity proc worth 3% of maximum Shields.
        expect(result.directDamageByPool.shields).toBe(100);
        expect(result.statusDamageByPool.health).toBeCloseTo(3, 10);
        expect(result.statusApplicationsByType.magnetic).toBe(1);
        expect(result.statusApplicationsByType.electricity).toBe(1);
    });

    it("suppresses Magnetic's break proc when the target is Electricity-immune", () => {
        const result = simulateExpectedWeaponEncounter({
            damageByType: { magnetic: 40 },
            health: 1_000,
            shields: 100,
            overguard: 0,
            maxShields: 100,
            armor: 0,
            faction: "",
            attackIntervalSeconds: 1,
            maxAttacks: 2,
            statusProcWeightsByType: { magnetic: 1 },
            statusRollsPerAttack: 1,
            statusImmuneTypes: ["electricity"],
        });

        expect(result.directDamageByPool.shields).toBe(100);
        expect(result.statusDamageByPool.health).toBe(0);
        expect(result.statusApplicationsByType.electricity).toBeUndefined();
    });
});
