import { describe, expect, it } from "vitest";
import { getWeaponCatalog, withSelectedAttack, type WeaponEntry } from "../../catalog/weaponCatalog";
import { emptyEffect, getModsForWeapon } from "../../catalog/modCatalog";
import { calculateBuild, calculateMeleeAverageDps, estimateFiniteIndependentDotDps } from "../damageCalc";
import { STATUS_DAMAGE_TYPES, STATUS_EFFECT_RULES } from "../damageRuleset";

function makeWeapon(damage: Partial<WeaponEntry["damage"]>): WeaponEntry {
    const damageByType = {
        impact: 0, puncture: 0, slash: 0,
        heat: 0, cold: 0, electricity: 0, toxin: 0,
        blast: 0, radiation: 0, gas: 0, magnetic: 0, viral: 0, corrosive: 0,
        void: 0, tau: 0, true: 0,
        ...damage,
    };
    return {
        uniqueName: "/Test/DamageRulesWeapon",
        name: "Damage Rules Test Weapon",
        category: "Primary",
        weaponType: "Rifle",
        modCompat: "Rifle",
        damage: { ...damageByType, total: Object.values(damageByType).reduce((sum, amount) => sum + amount, 0) },
        critChance: 0,
        critMultiplier: 2,
        statusChance: 0.4,
        fireRate: 1,
        magazineSize: 20,
        ammoCostPerShot: 1,
        hasExplicitMagazineSize: true,
        reloadTime: 2,
        multishot: 1,
        trigger: "Auto",
        chargeTime: null,
        polarities: [],
        canOverLevel: false,
        baseSlotCount: 8,
        disposition: 1,
        attacks: [],
        tags: [],
    };
}

describe("damage calculation status eligibility", () => {
    it("applies additive ammo efficiency to magazine shots and sustained DPS", () => {
        const weapon = {
            ...makeWeapon({ impact: 100 }),
            fireRate: 2,
            magazineSize: 5,
            reloadTime: 2,
        };
        const result = calculateBuild(weapon, [{
            ...emptyEffect(),
            ammoEfficiencyBonus: 0.5,
        }]);

        // Five rounds at 50% efficiency fund ten shots. The reload duty cycle
        // is (10 / 2) / ((10 / 2) + 2) = 5/7.
        expect(result.modded.ammoEfficiencyBonus).toBe(0.5);
        expect(result.modded.shotsPerMag).toBe(10);
        expect(result.burstDPS).toBe(200);
        expect(result.sustainedDPS).toBeCloseTo(200 * 5 / 7, 10);
    });

    it("keeps Aero Agility reload speed conditional on Aim Glide", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Rubico Prime");
        expect(weapon).toBeDefined();
        const aeroAgility = getModsForWeapon(weapon!).find((mod) => mod.name === "Aero Agility");
        expect(aeroAgility).toBeDefined();
        expect(aeroAgility!.effect.conditionalEffects).toContainEqual(expect.objectContaining({
            trigger: "whileAimGliding",
            stats: expect.objectContaining({ reloadSpeedBonus: 1 }),
        }));

        const realistic = calculateBuild(weapon!, [aeroAgility!.effect], "", {
            conditionalState: { mode: "realistic" },
        }).modded;
        const fullyStacked = calculateBuild(weapon!, [aeroAgility!.effect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;

        expect(realistic.reloadTime).toBeCloseTo(weapon!.reloadTime, 12);
        expect(fullyStacked.reloadTime).toBeCloseTo(weapon!.reloadTime / 2, 12);
    });

    it("excludes Conclave-only mods and keeps invisibility damage conditional", () => {
        const rubico = getWeaponCatalog().find((candidate) => candidate.name === "Rubico Prime");
        const braton = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime");
        const brokenWar = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(rubico).toBeDefined();
        expect(braton).toBeDefined();
        expect(brokenWar).toBeDefined();

        const rubicoMods = getModsForWeapon(rubico!);
        expect(rubicoMods.some((mod) => mod.name === "Lie In Wait")).toBe(false);
        const bratonMods = getModsForWeapon(braton!);
        expect(bratonMods.some((mod) => mod.name === "Tactical Reload")).toBe(true);
        const brokenWarMods = getModsForWeapon(brokenWar!);
        expect(brokenWarMods.some((mod) => mod.name === "Air Martial")).toBe(false);

        const spectralSerration = bratonMods.find((mod) => mod.name === "Spectral Serration");
        expect(spectralSerration).toBeDefined();
        expect(spectralSerration!.effect.conditionalEffects).toContainEqual(expect.objectContaining({
            trigger: "whileInvisible",
            stats: { damageBonus: 3.3 },
        }));

        const realistic = calculateBuild(braton!, [spectralSerration!.effect], "", {
            conditionalState: { mode: "realistic" },
        }).modded;
        const invisible = calculateBuild(braton!, [spectralSerration!.effect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;

        expect(realistic.totalDamageBonus).toBe(0);
        expect(invisible.totalDamageBonus).toBeCloseTo(3.3, 12);
        expect(invisible.totalDamage).toBeGreaterThan(realistic.totalDamage);
    });

    it("adds ammo-efficiency sources, caps them at 75%, and rounds accumulated partial ammo up", () => {
        const weapon = {
            ...makeWeapon({ impact: 100 }),
            magazineSize: 9,
            ammoCostPerShot: 3,
        };
        const result = calculateBuild(weapon, [
            { ...emptyEffect(), ammoEfficiencyBonus: 0.5 },
            { ...emptyEffect(), ammoEfficiencyBonus: 0.5 },
        ]);

        // At the 75% cap, each three-ammo attack consumes 0.75 ammo. The
        // accumulated fractional remainder permits twelve shots from nine ammo.
        expect(result.modded.ammoEfficiencyBonus).toBe(0.75);
        expect(result.modded.shotsPerMag).toBe(12);
    });

    it("uses configured conditional ammo efficiency and ignores it for transformed Incarnons", () => {
        const conditional = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 1,
                stats: { ammoEfficiencyBonus: 0.5 },
            }],
        };
        const weapon = { ...makeWeapon({ impact: 10 }), magazineSize: 5 };
        const initial = calculateBuild(weapon, [conditional], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const stacked = calculateBuild(weapon, [conditional], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;
        const incarnon = calculateBuild({
            ...weapon,
            selectedAttackIsIncarnon: true,
        }, [{ ...emptyEffect(), ammoEfficiencyBonus: 0.75 }]).modded;

        expect(initial.ammoEfficiencyBonus).toBe(0);
        expect(initial.shotsPerMag).toBe(5);
        expect(stacked.ammoEfficiencyBonus).toBe(0.5);
        expect(stacked.shotsPerMag).toBe(10);
        expect(incarnon.ammoEfficiencyBonus).toBe(0);
        expect(incarnon.shotsPerMag).toBe(5);
    });

    it("does not treat Zazvat-Kar's airborne ammo efficiency as always active", () => {
        const akstilettoPrime = getWeaponCatalog().find((candidate) => candidate.name === "Akstiletto Prime");
        expect(akstilettoPrime).toBeDefined();
        const zazvatKar = getModsForWeapon(akstilettoPrime!).find((candidate) => candidate.name === "Zazvat-Kar");
        expect(zazvatKar).toBeDefined();
        expect(zazvatKar!.effect.ammoEfficiencyBonus).toBe(0);
        expect(zazvatKar!.effect.conditionalEffects).toContainEqual(expect.objectContaining({
            trigger: "whileAirborne",
            stats: { ammoEfficiencyBonus: 0.75 },
        }));

        const weapon = { ...akstilettoPrime!, magazineSize: 40, reloadTime: 1.1 };
        const realistic = calculateBuild(weapon, [zazvatKar!.effect]).modded;
        const fullyAirborne = calculateBuild(weapon, [zazvatKar!.effect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;

        expect(realistic.ammoEfficiencyBonus).toBe(0);
        expect(realistic.shotsPerMag).toBe(40);
        expect(fullyAirborne.ammoEfficiencyBonus).toBe(0.75);
        expect(fullyAirborne.shotsPerMag).toBe(160);
    });

    it("preserves the no-efficiency magazine-to-ammo-cost ratio", () => {
        const stats = calculateBuild({
            ...makeWeapon({ impact: 10 }),
            magazineSize: 10,
            ammoCostPerShot: 3,
        }, []).modded;

        expect(stats.ammoEfficiencyBonus).toBe(0);
        expect(stats.shotsPerMag).toBeCloseTo(10 / 3, 10);
    });

    it("calculates stance-comparison melee DPS from average combo damage, crits, speed, and base combo length", () => {
        const result = calculateMeleeAverageDps({
            totalDamage: 100,
            critChance: 0.5,
            critMultiplier: 2,
            fireRate: 1.5,
        }, {
            averageComboDamageMultiplier: 2,
            baseComboLengthSeconds: 0.75,
        });

        // Avg Hit = 2 × 100 × (1 + .5 × (2 − 1)) = 300; DPS = 300 × 1.5 / .75.
        expect(result).toEqual({ averageHit: 300, averageDps: 600, expectedCritMultiplier: 1.5 });
    });

    it("rejects missing or invalid stance timing inputs instead of filling in defaults", () => {
        const stats = { totalDamage: 100, critChance: 0.5, critMultiplier: 2, fireRate: 1.5 };
        expect(calculateMeleeAverageDps(stats, {
            averageComboDamageMultiplier: 1,
            baseComboLengthSeconds: 0,
        })).toBeNull();
        expect(calculateMeleeAverageDps(stats, {
            averageComboDamageMultiplier: Number.NaN,
            baseComboLengthSeconds: 1,
        })).toBeNull();
    });

    it("applies a target-specific Cold stack cap to crit support", () => {
        const weapon = { ...makeWeapon({ cold: 100 }), statusChance: 1, fireRate: 1 };
        const normalTarget = calculateBuild(weapon, []).modded;
        const overguardTarget = calculateBuild(weapon, [], "", { statusStackCaps: { cold: 4 } }).modded;

        expect(normalTarget.expectedStacksByType.cold).toBe(6);
        expect(overguardTarget.expectedStacksByType.cold).toBe(4);
        expect(normalTarget.coldCritDamageBonus).toBeCloseTo(0.35, 10);
        expect(overguardTarget.coldCritDamageBonus).toBeCloseTo(0.25, 10);
    });

    it("excludes the Puncture critical-chance bonus from source-marked area attacks", () => {
        const direct = calculateBuild({
            ...makeWeapon({ puncture: 100 }),
            critChance: 0.2,
            statusChance: 1,
            selectedAttackIsAreaDamage: false,
        }, []).modded;
        const area = calculateBuild({
            ...makeWeapon({ puncture: 100 }),
            critChance: 0.2,
            statusChance: 1,
            selectedAttackIsAreaDamage: true,
        }, []).modded;

        expect(direct.expectedStacksByType.puncture).toBe(5);
        expect(direct.punctureCritChanceBonus).toBeCloseTo(0.25, 10);
        expect(area.expectedStacksByType.puncture).toBe(5);
        expect(area.punctureCritChanceBonus).toBe(0);
    });

    it("preserves a source AoE attack classification when selecting an attack", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Cortege");
        expect(weapon).toBeDefined();
        const radialAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Radial Attack");
        expect(radialAttackIndex).toBeGreaterThanOrEqual(0);
        expect(weapon!.attacks[radialAttackIndex].isAreaDamage).toBe(true);
        expect(withSelectedAttack(weapon!, radialAttackIndex).selectedAttackIsAreaDamage).toBe(true);
    });

    it("separates unquantized Arsenal Total Damage from quantized per-hit damage", () => {
        const weapon = makeWeapon({ impact: 30, puncture: 30, slash: 40 });
        const base = calculateBuild(weapon, []).modded;
        const physicalBonus = calculateBuild(weapon, [{
            ...emptyEffect(),
            slashBonus: 1.2,
        }]).modded;
        const baseDamageBonus = calculateBuild(weapon, [{
            ...emptyEffect(),
            damageBonus: 1,
        }]).modded;
        const elementalBonus = calculateBuild(makeWeapon({ impact: 100 }), [{
            ...emptyEffect(),
            heatBonus: 0.9,
        }]).modded;

        expect(base.arsenalDamage).toBe(100);
        expect(base.totalDamage).toBeCloseTo(103.125, 12);
        expect(base.averageShotDamage).toBeCloseTo(103.125, 12);
        expect(physicalBonus.damageBreakdown.slash).toBe(87.5);
        expect(physicalBonus.totalDamage).toBe(150);
        expect(physicalBonus.arsenalDamage).toBe(148);
        expect(baseDamageBonus.totalDamage).toBeCloseTo(base.totalDamage * 2, 12);
        expect(baseDamageBonus.arsenalDamage).toBe(200);
        expect(baseDamageBonus.damageBreakdown.impact).toBeCloseTo(base.damageBreakdown.impact * 2, 12);
        expect(baseDamageBonus.damageBreakdown.puncture).toBeCloseTo(base.damageBreakdown.puncture * 2, 12);
        expect(baseDamageBonus.damageBreakdown.slash).toBeCloseTo(base.damageBreakdown.slash * 2, 12);
        // Elemental contribution is quantized against weapon Modded Base Damage
        // (100 / 32), not the added 90 Heat damage.
        expect(elementalBonus.damageBreakdown.heat).toBeCloseTo(90.625, 12);
    });

    it("weights unique extra-projectile damage without changing projectile count", () => {
        const weapon = { ...makeWeapon({ slash: 100 }), statusChance: 1 };
        const ordinaryMultishot = calculateBuild(weapon, [{
            ...emptyEffect(),
            multishotBonus: 0.2,
        }]).modded;
        const uniqueMultishotDamage = calculateBuild(weapon, [{
            ...emptyEffect(),
            multishotBonus: 0.2,
            multishotDamageBonus: 0.54,
        }]).modded;

        expect(uniqueMultishotDamage.multishot).toBeCloseTo(1.2, 12);
        expect(uniqueMultishotDamage.damageWeightedMultishot).toBeCloseTo(1.308, 12);
        expect(uniqueMultishotDamage.arsenalDamage).toBeCloseTo(130.8, 12);
        expect(uniqueMultishotDamage.averageShotDamage).toBeCloseTo(130.8, 12);
        expect(uniqueMultishotDamage.dotDamagePerShot / ordinaryMultishot.dotDamagePerShot).toBeCloseTo(1.0891, 3);
    });

    it("appends innate primary elements after all slotted elemental mods", () => {
        const weapon = makeWeapon({ impact: 100, electricity: 100 });
        const mods = [
            { ...emptyEffect(), coldBonus: 0.9 },
            { ...emptyEffect(), toxinBonus: 0.9 },
            null,
            null,
            null,
            null,
            null,
            null,
        ];

        const result = calculateBuild(weapon, mods).modded.damageBreakdown;

        // Cold and Toxin occupy adjacent mod slots, so they combine into Viral.
        // Innate Electricity is appended last and remains an independent type.
        expect(result.viral).toBeCloseTo(362.5, 12);
        expect(result.electricity).toBe(100);
        expect(result.magnetic).toBe(0);
        expect(result.toxin).toBe(0);
    });

    it("anchors innate elemental damage to the first matching mod slot", () => {
        const weapon = makeWeapon({ impact: 100, electricity: 100 });
        const mods = [
            { ...emptyEffect(), coldBonus: 0.9 },
            { ...emptyEffect(), electricityBonus: 0.9 },
            { ...emptyEffect(), toxinBonus: 0.9 },
            null,
            null,
            null,
            null,
            null,
        ];

        const result = calculateBuild(weapon, mods).modded.damageBreakdown;

        // The innate Electricity amount joins its earliest matching mod element;
        // Cold therefore combines with Electricity, and Toxin remains separate.
        expect(result.magnetic).toBeCloseTo(462.5, 12);
        expect(result.toxin).toBeCloseTo(181.25, 12);
        expect(result.viral).toBe(0);
    });

    it("uses critical multiplier quantization before relative critical damage bonuses", () => {
        const weapon = { ...makeWeapon({ impact: 100 }), critChance: 1, critMultiplier: 2 };
        const result = calculateBuild(weapon, [{ ...emptyEffect(), critMultBonus: 1 }]).modded;

        expect(result.quantizedBaseCritMultiplier).toBeCloseTo(256 * 32 / 4095, 6);
        expect(result.critMultiplier).toBeCloseTo((256 * 32 / 4095) * 2, 6);
        expect(result.averageShotDamage).toBeCloseTo(100 * result.critMultiplier, 6);
    });

    it("computes Blast stack hit damage from modded base damage with faction double-dip and Status Damage", () => {
        const weapon = { ...makeWeapon({ blast: 100 }), statusChance: 1, critChance: 0 };
        const plain = calculateBuild(weapon, []).modded;
        const statusDamage = calculateBuild(weapon, [{ ...emptyEffect(), statusDamageBonus: 0.5 }]).modded;
        const factionDamage = calculateBuild(weapon, [{
            ...emptyEffect(),
            factionDamageBonus: 0.5,
            targetFaction: "Grineer",
        }], "Grineer").modded;

        expect(plain.blastStackHitDamagePerProc).toBeCloseTo(100, 5);
        expect(plain.blastExpiryDamagePerProc).toBeCloseTo(30, 5);
        expect(plain.blastExpectedExpiryDamagePerShot).toBeCloseTo(30, 5);
        expect(statusDamage.blastStackHitDamagePerProc).toBeCloseTo(150, 5);
        expect(statusDamage.blastExpectedExpiryDamagePerShot).toBeCloseTo(45, 5);
        // 100 base × 1.5 faction on the proc seed × 1.5 second faction × 1.5 status.
        const factionAndStatus = calculateBuild(weapon, [{
            ...emptyEffect(),
            statusDamageBonus: 0.5,
            factionDamageBonus: 0.5,
            targetFaction: "Grineer",
        }], "Grineer").modded;
        expect(factionDamage.blastStackHitDamagePerProc).toBeCloseTo(225, 5);
        expect(factionDamage.blastExpectedExpiryDamagePerShot).toBeCloseTo(67.5, 5);
        expect(factionAndStatus.blastStackHitDamagePerProc).toBeCloseTo(337.5, 5);
        // Blast stack operations are binary32, so 0.3 × 337.5 is not an exact
        // JavaScript double representation of 101.25.
        expect(factionAndStatus.blastExpectedExpiryDamagePerShot).toBe(
            Math.fround(Math.fround(337.5) * Math.fround(0.3)),
        );
    });

    it("resolves the source-side multipliers for Magnetic's forced Electricity proc", () => {
        const weapon = makeWeapon({ electricity: 100 });
        const effect = {
            ...emptyEffect(),
            statusDamageBonus: 0.5,
            electricityBonus: 0.5,
            factionDamageBonus: 0.5,
            targetFaction: "Grineer",
            conditionalEffects: [{
                trigger: "onHit" as const,
                durationSeconds: 6,
                requiresAiming: false,
                maxStacks: 1,
                stats: { statusDamageBonus: 1 },
            }],
        };
        const realistic = calculateBuild(weapon, [effect], "Grineer").modded;
        const initial = calculateBuild(weapon, [effect], "Grineer", {
            conditionalState: { mode: "initial" },
        }).modded;

        // Status Damage and faction bonuses double-dip; conditional Status
        // Damage uses the existing 85% on-hit uptime; Electricity applies once.
        expect(realistic.magneticBreakElectricSourceMultiplier).toBeCloseTo(
            (1 + 0.5 + 0.85) ** 2 * 1.5 * 1.5 ** 2,
            10,
        );
        expect(initial.magneticBreakElectricSourceMultiplier).toBeCloseTo(
            1.5 ** 2 * 1.5 * 1.5 ** 2,
            10,
        );
    });

    it("uses proc lifetimes and grouped stacks when reporting steady-state DoT DPS", () => {
        const groupedHeat = { ...makeWeapon({ heat: 40 }), statusChance: 2 };
        const heat = calculateBuild(groupedHeat, []).modded;
        const optimizerHeat = calculateBuild(groupedHeat, [], "", { includeDoTTickDetails: false }).modded;

        expect(heat.dotDamagePerShotByType.heat).toBeCloseTo(243, 4);
        expect(heat.dotDpsByType.heat).toBeCloseTo(240.5, 4);
        expect(heat.dotDps).toBeCloseTo(240.5, 4);
        expect(heat.dotTickDamagePerProcByType.heat).toBeCloseTo(20, 6);
        expect(heat.dotTickAccumulatorDamageByType.heat).toBeCloseTo(0.5, 6);
        expect(optimizerHeat.dotDps).toBe(heat.dotDps);
        expect(optimizerHeat.dotDamagePerShot).toBe(0);
        expect(optimizerHeat.dotDamagePerShotByType.heat).toBeUndefined();
        expect(optimizerHeat.dotTickDamagePerProcByType.heat).toBeUndefined();

        const independentSlash = { ...makeWeapon({ slash: 40 }), statusChance: 1 };
        const slash = calculateBuild(independentSlash, []).modded;
        expect(slash.dotDamagePerShotByType.slash).toBeCloseTo(86.1, 3);
        expect(slash.dotDpsByType.slash).toBeCloseTo(86.1, 4);
    });

    it("limits independent Slash and Toxin ticks to a finite encounter window", () => {
        const independentSlash = calculateBuild(
            { ...makeWeapon({ slash: 40 }), statusChance: 1 },
            [],
        ).modded;

        expect(estimateFiniteIndependentDotDps(independentSlash, "slash", 0.5)).toBe(0);
        expect(estimateFiniteIndependentDotDps(independentSlash, "slash", 1)).toBeCloseTo(14.35, 4);
        expect(estimateFiniteIndependentDotDps(independentSlash, "slash", 2)).toBeCloseTo(21.525, 4);
        expect(estimateFiniteIndependentDotDps(independentSlash, "slash", 120)).toBeGreaterThan(80);
        expect(estimateFiniteIndependentDotDps(independentSlash, "slash", 120)).toBeLessThan(86.1);
    });

    it("applies the faction bonus on both DoT passes using the current seed accumulator order", () => {
        const weapon = { ...makeWeapon({ toxin: 40 }), statusChance: 1 };
        const toxinBane = {
            ...emptyEffect(),
            toxinBonus: 2.25,
            factionDamageBonus: 0.55,
            targetFaction: "Grineer",
        };
        const result = calculateBuild(weapon, [toxinBane], "Grineer").modded;

        expect(result.dotDpsByType.toxin).toBeCloseTo(952.0875, 3);
    });

    it("speeds positive burst fire rate bonuses inside a burst but clamps negative bonuses", () => {
        const weapon: WeaponEntry = {
            ...makeWeapon({ impact: 100 }),
            trigger: "Burst",
            fireRate: 9.375,
            burstCount: 3,
            burstCycleRate: 5,
            burstDelay: 0.06,
        };
        const noBonus = calculateBuild(weapon, []).modded.fireRate;
        const oneHundredPercentFireRate = calculateBuild(weapon, [{
            ...emptyEffect(),
            fireRateBonus: 1,
        }]).modded.fireRate;
        const negativeFiftyPercentFireRate = calculateBuild(weapon, [{
            ...emptyEffect(),
            fireRateBonus: -0.5,
        }]).modded.fireRate;

        expect(noBonus).toBeCloseTo(9.375, 8);
        expect(oneHundredPercentFireRate).toBeCloseTo(3 / (1 / 10 + 2 * 0.03), 8);
        expect(oneHundredPercentFireRate).toBeCloseTo(noBonus * 2, 8);
        expect(negativeFiftyPercentFireRate).toBeCloseTo(3 / (1 / 2.5 + 2 * 0.06), 8);
    });

    it("supports explicit initial, realistic, fully stacked, and externally maintained conditional states", () => {
        const weapon = makeWeapon({ toxin: 100 });
        const conditionalDamage = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 3,
                stats: { damageBonus: 0.4 },
            }],
        };

        const initial = calculateBuild(weapon, [conditionalDamage], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const realistic = calculateBuild(weapon, [conditionalDamage]).modded;
        const fullyStacked = calculateBuild(weapon, [conditionalDamage], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;
        const externallyMaintained = calculateBuild(weapon, [conditionalDamage], "", {
            conditionalState: { mode: "custom", externalStacks: 2 },
        }).modded;

        expect(initial.totalDamageBonus).toBe(0);
        expect(realistic.totalDamageBonus).toBeCloseTo(0.504, 12);
        expect(fullyStacked.totalDamageBonus).toBeCloseTo(1.2, 12);
        expect(externallyMaintained.totalDamageBonus).toBeCloseTo(0.8, 12);
    });

    it("separates a clean target attack from steady-state status effects", () => {
        const weapon = { ...makeWeapon({ viral: 100, heat: 100 }), statusChance: 1, fireRate: 10 };
        const conditionalOverload = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };
        const steady = calculateBuild(weapon, [conditionalOverload]).modded;
        const freshTarget = calculateBuild(weapon, [conditionalOverload], "", {
            conditionalState: { mode: "initial" },
            targetStatusState: "initial",
        }).modded;

        expect(steady.expectedStacksByType.viral).toBe(10);
        expect(steady.viralHealthDamageBonus).toBe(3.25);
        expect(steady.heatArmorStrip).toBe(0.5);
        expect(steady.directDamageStatusTypes).toBeGreaterThan(0);
        expect(freshTarget.expectedStacksByType.viral).toBe(0);
        expect(freshTarget.viralHealthDamageBonus).toBe(0);
        expect(freshTarget.heatArmorStrip).toBe(0);
        expect(freshTarget.directDamageStatusTypes).toBe(0);
        expect(freshTarget.directDamagePerStatusMultiplier).toBe(1);
        expect(freshTarget.totalDamage).toBeLessThan(steady.totalDamage);
    });

    it("adds Condition Overload to the melee base bracket and leaves a clean target unamplified", () => {
        const melee = {
            ...makeWeapon({ impact: 100, heat: 100 }),
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee",
            statusChance: 1,
            fireRate: 10,
        };
        const overload = { ...emptyEffect(), conditionOverloadDamagePerStatusBonus: 0.8 };
        const plain = calculateBuild(melee, []).modded;
        const steady = calculateBuild(melee, [overload]).modded;
        const overloadAndDirect = calculateBuild(melee, [
            overload,
            { ...emptyEffect(), directDamagePerStatusBonus: 0.4 },
        ]).modded;
        const fresh = calculateBuild(melee, [overload], "", { targetStatusState: "initial" }).modded;
        const externallyPrimed = calculateBuild(melee, [overload], "", {
            targetStatusState: "initial",
            conditionalState: { mode: "initial", externalStatusTypeCount: 2 },
        }).modded;
        const externallyCapped = calculateBuild(melee, [overload], "", {
            targetStatusState: "initial",
            conditionalState: { mode: "initial", externalStatusTypeCount: 40 },
        }).modded;

        expect(steady.conditionOverloadApplies).toBe(true);
        expect(steady.conditionOverloadStatusTypes).toBeGreaterThan(1.9);
        expect(steady.conditionOverloadDamageMultiplier).toBeGreaterThan(2.5);
        expect(steady.totalDamage).toBeGreaterThan(plain.totalDamage * 2.5);
        expect(
            overloadAndDirect.conditionOverloadDamageMultiplier * overloadAndDirect.directDamagePerStatusMultiplier,
        ).toBeCloseTo(3.4, 2);
        expect(fresh.conditionOverloadStatusTypes).toBe(0);
        expect(fresh.conditionOverloadDamageMultiplier).toBe(1);
        expect(fresh.totalDamage).toBe(plain.totalDamage);
        expect(externallyPrimed.conditionOverloadStatusTypes).toBe(2);
        expect(externallyPrimed.conditionOverloadDamageMultiplier).toBeCloseTo(2.6, 10);
        expect(externallyCapped.conditionOverloadStatusTypes).toBe(16);
    });

    it("applies steady-state Tau vulnerability to ordinary non-Tau status rolls", () => {
        const weapon = { ...makeWeapon({ tau: 50, viral: 50 }), statusChance: 1, fireRate: 1 };
        const steady = calculateBuild(weapon, []).modded;
        const freshTarget = calculateBuild(weapon, [], "", { targetStatusState: "initial" }).modded;

        // Tau itself remains at 0.5 procs/s (four expected stacks over eight
        // seconds); its +40% vulnerability raises ordinary Viral to 0.7/s.
        expect(steady.expectedStacksByType.tau).toBe(4);
        expect(steady.tauStatusVulnerability).toBeCloseTo(0.4, 12);
        expect(steady.procRatePerSecondByType.tau).toBeCloseTo(0.5, 12);
        expect(steady.procRatePerSecondByType.viral).toBeCloseTo(0.7, 12);
        expect(steady.expectedStacksByType.viral).toBeCloseTo(4.2, 12);
        expect(steady.averageProcsPerShot).toBeCloseTo(1.2, 12);

        expect(freshTarget.expectedStacksByType.tau).toBe(0);
        expect(freshTarget.tauStatusVulnerability).toBe(0);
        expect(freshTarget.procRatePerSecondByType.viral).toBeCloseTo(0.5, 12);
    });

    it("does not scale forced status applications with Tau vulnerability", () => {
        const weapon = {
            ...makeWeapon({ tau: 50, slash: 50 }),
            statusChance: 1,
            fireRate: 1,
            forcedProcs: { slash: 1 },
        };
        const result = calculateBuild(weapon, []).modded;

        expect(result.tauStatusVulnerability).toBeCloseTo(0.4, 12);
        expect(result.extraProcsPerShot.slash).toBe(1);
        expect(result.procRatePerSecondByType.slash).toBeCloseTo(1.7, 12);
        expect(result.averageProcsPerShot).toBeCloseTo(2.2, 12);
    });

    it("removes immune proc types and renormalizes the remaining damage weights", () => {
        const weapon = makeWeapon({ impact: 10, slash: 30 });
        const result = calculateBuild(weapon, [], "", { statusImmuneTypes: ["impact"] }).modded;

        expect(result.procChanceByType.impact).toBeUndefined();
        expect(result.procChanceByType.slash).toBe(1);
        expect(result.expectedStacksByType.impact).toBe(0);
        expect(result.expectedStacksByType.slash).toBeCloseTo(2.4, 12);
    });

    it("suppresses status output when the target is immune to every status type", () => {
        const weapon = makeWeapon({ impact: 10, slash: 30, heat: 60 });
        const statusTypes = [
            "impact", "puncture", "slash", "heat", "cold", "electricity", "toxin",
            "blast", "radiation", "gas", "magnetic", "viral", "corrosive", "void", "tau",
        ] as const;
        const result = calculateBuild(weapon, [], "", { statusImmuneTypes: statusTypes }).modded;

        expect(result.averageProcsPerShot).toBe(0);
        expect(Object.values(result.procChanceByType)).toEqual([]);
        expect(Object.values(result.expectedStacksByType).every((stacks) => stacks === 0)).toBe(true);
        expect(result.dotDamagePerShot).toBe(0);
        expect(result.dotDps).toBe(0);
        expect(result.heatArmorStrip).toBe(0);
    });

    it("does not turn True damage into a status proc type", () => {
        const result = calculateBuild(makeWeapon({ true: 100 }), []).modded;

        expect(result.procChanceByType.true).toBeUndefined();
        expect(result.averageProcsPerShot).toBe(0);
        expect(result.expectedStacksByType.true).toBeUndefined();
    });

    it("includes conditional primary elemental bonuses in the final combination and proc weights", () => {
        const weapon = makeWeapon({ impact: 100 });
        const conditionalElement = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHit" as const,
                durationSeconds: 6,
                requiresAiming: false,
                maxStacks: 1,
                stats: { electricityBonus: 1 },
            }],
        };
        const result = calculateBuild(weapon, [conditionalElement]).modded;

        expect(result.damageBreakdown.electricity).toBeGreaterThan(0);
        expect(result.procChanceByType.electricity).toBeGreaterThan(0.4);
    });

    it("keeps conditional elemental damage at the originating mod slot", () => {
        const weapon = makeWeapon({ impact: 100, electricity: 100 });
        const conditionalToxin = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHit" as const,
                durationSeconds: 6,
                requiresAiming: false,
                maxStacks: 1,
                stats: { toxinBonus: 0.9 },
            }],
        };
        const mods = [
            conditionalToxin,
            { ...emptyEffect(), coldBonus: 0.9 },
            { ...emptyEffect(), heatBonus: 0.9 },
            null,
            null,
            null,
            null,
            null,
        ];

        const result = calculateBuild(weapon, mods, "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded.damageBreakdown;

        // Slot 0 Toxin combines with slot 1 Cold as Viral; slot 2 Heat then
        // combines with innate Electricity as Radiation. Moving conditional
        // Toxin after every slotted mod would create Blast and Corrosive.
        expect(result.viral).toBeGreaterThan(0);
        expect(result.radiation).toBeGreaterThan(0);
        expect(result.blast).toBe(0);
        expect(result.corrosive).toBe(0);
    });

    it("counts forced status procs independently of status chance and damage weights", () => {
        const weapon = {
            ...makeWeapon({ impact: 100 }),
            statusChance: 0,
            multishot: 2,
            forcedProcs: { slash: 1 },
        };

        const result = calculateBuild(weapon, []).modded;
        const immune = calculateBuild(weapon, [], "", { statusImmuneTypes: ["slash"] }).modded;

        // One forced Slash per projectile is multiplied by two projectiles even
        // though there is no Slash damage contribution or ordinary status chance.
        expect(result.forcedProcsPerShot.slash).toBe(2);
        expect(result.extraProcsPerShot.slash).toBe(2);
        expect(result.averageProcsPerShot).toBe(2);
        expect(result.procRatePerSecondByType.slash).toBe(2);
        expect(result.dotDamagePerShotByType.slash).toBeGreaterThan(0);

        // Target immunity suppresses the forced effect instead of redistributing it.
        expect(immune.forcedProcsPerShot.slash).toBeUndefined();
        expect(immune.procRatePerSecondByType.slash).toBeUndefined();
        expect(immune.averageProcsPerShot).toBe(0);
    });

    it("resolves damage-weighted and uniform forced-proc distributions as expected counts", () => {
        const weapon: WeaponEntry = {
            ...makeWeapon({ blast: 10, toxin: 30 }),
            statusChance: 0,
            forcedProcDistributions: [
                { count: 1, mode: "damageWeighted" },
                { count: 1, mode: "uniform", types: ["heat", "cold", "electricity", "toxin"] },
            ],
        };

        const result = calculateBuild(weapon, []).modded;
        expect(result.forcedProcsPerShot).toEqual({
            blast: 0.25,
            toxin: 1,
            heat: 0.25,
            cold: 0.25,
            electricity: 0.25,
        });
        expect(result.averageProcsPerShot).toBeCloseTo(2, 10);

        const heatImmune = calculateBuild(weapon, [], "", { statusImmuneTypes: ["heat"] }).modded;
        expect(heatImmune.forcedProcsPerShot.heat).toBeUndefined();
        expect(heatImmune.extraProcsPerShot.heat).toBeUndefined();
        expect(heatImmune.unfilteredExtraProcsPerShot.heat).toBeCloseTo(0.25, 10);
        expect(heatImmune.forcedProcsPerShot.toxin).toBeCloseTo(1, 10);
        expect(heatImmune.averageProcsPerShot).toBeCloseTo(1.75, 10);
    });

    it("uses attack-specific forced proc metadata when an attack mode is selected", () => {
        const baseWeapon = makeWeapon({ impact: 100 });
        const weapon: WeaponEntry = {
            ...baseWeapon,
            forcedProcs: { impact: 1 },
            attacks: [{
                name: "Charged Shot",
                speed: 1,
                trigger: "Charge",
                critChance: 0,
                critMultiplier: 2,
                statusChance: 0,
                chargeTime: 1,
                damage: baseWeapon.damage,
                damageTotal: 100,
                forcedProcs: { slash: 1 },
            }],
        };

        const selected = withSelectedAttack(weapon, 0);
        const result = calculateBuild(selected, []).modded;

        expect(selected.forcedProcs).toEqual({ slash: 1 });
        expect(result.forcedProcsPerShot).toEqual({ slash: 1 });
        expect(result.forcedProcsPerShot.impact).toBeUndefined();
    });

    it("triggers Internal Bleeding from forced Impact procs independent of status chance", () => {
        const acceltra = getWeaponCatalog().find((candidate) => candidate.name === "Acceltra Prime");
        expect(acceltra).toBeDefined();
        const impactIndex = acceltra!.attacks.findIndex((attack) => attack.name === "Rocket Impact");
        expect(impactIndex).toBeGreaterThanOrEqual(0);
        const selected = withSelectedAttack(acceltra!, impactIndex);
        const internalBleeding = getModsForWeapon(acceltra!).find((candidate) => candidate.name === "Internal Bleeding");
        expect(internalBleeding).toBeDefined();
        const effect = internalBleeding!.effectsByRank[internalBleeding!.fusionLimit];

        const result = calculateBuild(selected, [effect]).modded;
        expect(result.forcedProcsPerShot.impact).toBe(1);
        expect(result.extraProcsPerShot.slash).toBeCloseTo(
            selected.statusChance * 0.35 + 0.35,
            10,
        );

        const impactImmune = calculateBuild(selected, [effect], "", { statusImmuneTypes: ["impact"] }).modded;
        expect(impactImmune.forcedProcsPerShot.impact).toBeUndefined();
        expect(impactImmune.extraProcsPerShot.slash).toBeUndefined();
    });

    it("doubles impact-triggered Slash from forced procs below the mod's fire-rate threshold", () => {
        const weapon: WeaponEntry = {
            ...makeWeapon({ impact: 100 }),
            statusChance: 0,
            forcedProcs: { impact: 1 },
        };
        const internalBleedingEffect = {
            ...emptyEffect(),
            impactStatusAppliesSlashChance: 0.35,
            impactStatusExtraProcLowFireRateThreshold: 2.5,
            impactStatusExtraProcLowFireRateMultiplier: 2,
        };

        const result = calculateBuild(weapon, [internalBleedingEffect]).modded;
        expect(result.forcedProcsPerShot.impact).toBe(1);
        expect(result.extraProcsPerShot.slash).toBeCloseTo(0.7, 10);
    });

    it("loads Wiki-sourced forced procs only on verified weapon attack rows", () => {
        const weapons = getWeaponCatalog();
        const cases = [
            {
                weaponName: "Acrid",
                forcedAttackNames: ["Normal Attack"],
                forcedProcs: { toxin: 1 },
                unforcedAttackNames: [],
            },
            ...(["Hystrix", "Hystrix Prime"] as const).flatMap((weaponName) => [
                { weaponName, forcedAttackNames: ["Poison Quill"], forcedProcs: { toxin: 1 }, unforcedAttackNames: [] },
                { weaponName, forcedAttackNames: ["Fire Quill"], forcedProcs: { heat: 1 }, unforcedAttackNames: [] },
                { weaponName, forcedAttackNames: ["Electric Quill"], forcedProcs: { electricity: 1 }, unforcedAttackNames: [] },
                { weaponName, forcedAttackNames: ["Ice Quill"], forcedProcs: { cold: 1 }, unforcedAttackNames: [] },
            ]),
            {
                weaponName: "Glaive Prime",
                forcedAttackNames: ["Throw", "Charged Throw", "Throw Recall Explosion", "Charged Throw Recall Explosion"],
                forcedProcs: { impact: 1, slash: 1 },
                unforcedAttackNames: ["Throw Bounce Explosion", "Charged Throw Bounce Explosion"],
            },
            {
                weaponName: "Pathocyst",
                forcedAttackNames: ["Throw Recall Explosion", "Charged Throw Recall Explosion"],
                forcedProcs: { impact: 1, viral: 1 },
                unforcedAttackNames: ["Throw", "Charged Throw", "Throw Bounce Explosion", "Charged Throw Bounce Explosion"],
            },
            {
                weaponName: "Coda Pathocyst",
                forcedAttackNames: ["Throw Recall Explosion", "Charged Throw Recall Explosion"],
                forcedProcs: { impact: 1, viral: 1 },
                unforcedAttackNames: ["Throw", "Charged Throw", "Throw Bounce Explosion", "Charged Throw Bounce Explosion"],
            },
            {
                weaponName: "Phantasma",
                forcedAttackNames: ["Plasma Bomb Impact", "Plasma Bomb Explosion", "Cluster Bombs Explosion"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Beam", "Cluster Bombs Impact"],
            },
            {
                weaponName: "Phantasma Prime",
                forcedAttackNames: ["Plasma Bomb Impact", "Plasma Bomb Explosion", "Cluster Bombs Explosion"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Beam", "Cluster Bombs Impact"],
            },
            {
                weaponName: "Nataruk",
                forcedAttackNames: ["Quick Shot"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Charged Shot", "Perfect Shot"],
            },
            {
                weaponName: "Acceltra",
                forcedAttackNames: ["Rocket Impact"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Rocket Explosion"],
            },
            {
                weaponName: "Acceltra Prime",
                forcedAttackNames: ["Rocket Impact"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Rocket Explosion"],
            },
            {
                weaponName: "Daikyu",
                forcedAttackNames: ["Charged Shot"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Daikyu Prime",
                forcedAttackNames: ["Quick Shot", "Charged Shot"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Nagantaka",
                forcedAttackNames: ["Semi-Auto", "Burst Shot"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Nagantaka Prime",
                forcedAttackNames: ["Semi-Auto", "Burst Shot"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Zymos",
                forcedAttackNames: ["Normal Attack"],
                forcedProcs: { impact: 1 },
                // The Homing Spore Contact Impact proc is only guaranteed more
                // than 7 m from the initial headshot target, so it stays unmodeled.
                unforcedAttackNames: ["Radial Attack", "Headshot Explosion", "Homing Spore Contact", "Homing Spore Explosion"],
            },
            {
                weaponName: "Astilla",
                forcedAttackNames: ["Slug Impact"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Glass Explosion"],
            },
            {
                weaponName: "Astilla Prime",
                forcedAttackNames: ["Slug Impact"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Glass Explosion"],
            },
            {
                weaponName: "Kuva Chakkhurr",
                forcedAttackNames: ["Normal Attack", "Explosion"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Kuva Ogris",
                forcedAttackNames: ["Rocket Impact"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Rocket Explosion"],
            },
            {
                weaponName: "Afentis Prime",
                forcedAttackNames: ["Semi"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Spear Throw"],
            },
            {
                weaponName: "Afentis Prime",
                forcedAttackNames: ["Radial Attack"],
                forcedProcs: { heat: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Corinth",
                forcedAttackNames: ["Air Burst Projectile"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Air Burst Explosion", "Buckshot"],
            },
            {
                weaponName: "Corinth Prime",
                forcedAttackNames: ["Air Burst Projectile"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Air Burst Explosion", "Buckshot"],
            },
            {
                weaponName: "Javlok",
                forcedAttackNames: ["Spear Throw Impact", "Spear Throw Explosion"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Projectile Impact", "Projectile Explosion"],
            },
            {
                weaponName: "Epitaph",
                forcedAttackNames: ["Charged Shot", "Uncharged Direct Hit"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Epitaph",
                forcedAttackNames: ["Uncharged AoE"],
                forcedProcs: { cold: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Epitaph Prime",
                forcedAttackNames: ["Charged Shot"],
                forcedProcs: { impact: 1, cold: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Epitaph Prime",
                forcedAttackNames: ["Uncharged Direct Hit"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Epitaph Prime",
                forcedAttackNames: ["Uncharged AoE"],
                forcedProcs: { cold: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Lenz",
                forcedAttackNames: ["Charged Shot"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Bubble Collapse"],
            },
            {
                weaponName: "Lenz",
                forcedAttackNames: ["Initial Blast"],
                forcedProcs: { cold: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Prisma Lenz",
                forcedAttackNames: ["Charged Shot"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Bubble Collapse"],
            },
            {
                weaponName: "Prisma Lenz",
                forcedAttackNames: ["Initial Blast"],
                forcedProcs: { cold: 1 },
                unforcedAttackNames: [],
            },
            {
                weaponName: "Zakti",
                forcedAttackNames: ["Dart Impact"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Gas Cloud"],
            },
            {
                weaponName: "Zakti Prime",
                forcedAttackNames: ["Normal Attack"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Gas Cloud"],
            },
            {
                weaponName: "Tenet Spirex",
                forcedAttackNames: ["Slug Impact"],
                forcedProcs: { impact: 1 },
                unforcedAttackNames: ["Explosion"],
            },
        ] as const;

        for (const testCase of cases) {
            const weapon = weapons.find((candidate) => candidate.name === testCase.weaponName);
            expect(weapon, testCase.weaponName).toBeDefined();

            for (const attackName of testCase.forcedAttackNames) {
                const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
                expect(attackIndex, `${testCase.weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
                const selected = withSelectedAttack(weapon!, attackIndex);
                expect(selected.forcedProcs).toEqual(testCase.forcedProcs);
                expect(calculateBuild(selected, []).modded.forcedProcsPerShot, `${testCase.weaponName} / ${attackName} procs per shot`)
                    .toEqual(testCase.forcedProcs);
            }

            for (const attackName of testCase.unforcedAttackNames) {
                const attack = weapon!.attacks.find((candidate) => candidate.name === attackName);
                expect(attack, `${testCase.weaponName} / ${attackName}`).toBeDefined();
                expect(attack?.forcedProcs).toBeUndefined();
            }
        }
    });

    it("loads Phantasma alternate-fire forced Impact procs and per-row projectile counts", () => {
        const weapons = getWeaponCatalog();
        for (const weaponName of ["Phantasma", "Phantasma Prime"]) {
            const weapon = weapons.find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();

            const expected = new Map([
                ["Beam", { multishot: 6, forced: {} }],
                ["Plasma Bomb Impact", { multishot: 1, forced: { impact: 1 } }],
                ["Plasma Bomb Explosion", { multishot: 1, forced: { impact: 1 } }],
                // Stagger is not a damage status proc; five bomblets still roll
                // ordinary status independently on their impact row.
                ["Cluster Bombs Impact", { multishot: 5, forced: {} }],
                ["Cluster Bombs Explosion", { multishot: 1, forced: { impact: 1 } }],
            ] as const);

            for (const [attackName, expectedAttack] of expected) {
                const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
                expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
                const selected = withSelectedAttack(weapon!, attackIndex);
                expect(selected.multishot, `${weaponName} / ${attackName} multishot`).toBe(expectedAttack.multishot);
                expect(selected.forcedProcs ?? {}, `${weaponName} / ${attackName} forced procs`).toEqual(expectedAttack.forced);
                expect(calculateBuild(selected, []).modded.forcedProcsPerShot).toEqual(expectedAttack.forced);
            }
        }
    });

    it("keeps Corinth Air Burst damage to one projectile instead of buckshot's six pellets", () => {
        for (const weaponName of ["Corinth", "Corinth Prime"]) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            const expectedMultishot = new Map([
                ["Buckshot", 6],
                ["Air Burst Projectile", 1],
                ["Air Burst Explosion", 1],
            ]);

            for (const [attackName, multishot] of expectedMultishot) {
                const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
                expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
                const selected = withSelectedAttack(weapon!, attackIndex);
                expect(selected.multishot, `${weaponName} / ${attackName}`).toBe(multishot);
                expect(calculateBuild(selected, []).modded.multishot, `${weaponName} / ${attackName} modded`)
                    .toBe(multishot);
            }
        }
    });

    it("uses Phantasma's Wiki ammo costs for beam ticks and alternate-fire rows", () => {
        const weapons = getWeaponCatalog();
        for (const weaponName of ["Phantasma", "Phantasma Prime"]) {
            const weapon = weapons.find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            expect(weapon!.ammoCostPerShot).toBe(0.5);

            const beamIndex = weapon!.attacks.findIndex((attack) => attack.name === "Beam");
            const explosionIndex = weapon!.attacks.findIndex((attack) => attack.name === "Plasma Bomb Explosion");
            expect(beamIndex).toBeGreaterThanOrEqual(0);
            expect(explosionIndex).toBeGreaterThanOrEqual(0);

            const beam = withSelectedAttack(weapon!, beamIndex);
            expect(beam.ammoCostPerShot).toBe(0.5);
            expect(calculateBuild(beam, []).modded.shotsPerMag).toBe(22);

            const fullCharge = withSelectedAttack(weapon!, explosionIndex);
            expect(fullCharge.ammoCostPerShot).toBe(2);
            expect(fullCharge.selectedAttackChargeAmmoPerSecond).toBe(11);
            expect(fullCharge.selectedAttackChargeDamageBaseAmmoCost).toBe(2);
            expect(calculateBuild(fullCharge, []).modded.shotsPerMag).toBe(5.5);
        }
    });

    it("applies the verified fresh-magazine and sustained damage ramp to both Phantasma Beam rows", () => {
        const weapons = getWeaponCatalog();
        for (const weaponName of ["Phantasma", "Phantasma Prime"]) {
            const weapon = weapons.find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            const beamIndex = weapon!.attacks.findIndex((attack) => attack.name === "Beam");
            const altFireIndex = weapon!.attacks.findIndex((attack) => attack.name === "Plasma Bomb Explosion");
            expect(beamIndex).toBeGreaterThanOrEqual(0);
            expect(altFireIndex).toBeGreaterThanOrEqual(0);

            const beam = withSelectedAttack(weapon!, beamIndex);
            const beamMetrics = calculateBuild(beam, []);
            expect(beam.selectedAttackDamageRamp).toEqual({
                minimumDamageMultiplier: 0.15,
                rampToFullSeconds: 0.6,
                idleBeforeDecaySeconds: 0.8,
                decayToMinimumSeconds: 2,
            });
            expect(beamMetrics.modded.firstAttackDamageMultiplier).toBe(0.15);
            expect(beamMetrics.modded.freshMagazineDamageMultiplier).toBeCloseTo(3331 / 3960, 12);
            expect(beamMetrics.modded.sustainedDamageMultiplier).toBe(1);
            expect(beamMetrics.burstDPS).toBeCloseTo(
                beamMetrics.modded.averageShotDamage * beamMetrics.modded.fireRate * (3331 / 3960),
                10,
            );
            expect(beamMetrics.sustainedDPS).toBeCloseTo(
                beamMetrics.modded.averageShotDamage * beamMetrics.modded.fireRate * beamMetrics.modded.magazineDutyCycle,
                10,
            );

            const altFire = withSelectedAttack(weapon!, altFireIndex);
            expect(altFire.selectedAttackDamageRamp).toBeUndefined();
            expect(calculateBuild(altFire, []).modded.freshMagazineDamageMultiplier).toBe(1);
        }
    });

    it("scales Phantasma alternate-fire rows by selected ammo at the fixed Wiki charge rate", () => {
        const phantasma = getWeaponCatalog().find((candidate) => candidate.name === "Phantasma Prime");
        expect(phantasma).toBeDefined();
        const explosionIndex = phantasma!.attacks.findIndex((attack) => attack.name === "Plasma Bomb Explosion");
        expect(explosionIndex).toBeGreaterThanOrEqual(0);
        const explosion = withSelectedAttack(phantasma!, explosionIndex);

        const baseline = calculateBuild(explosion, [], "", {
            conditionalState: { mode: "initial", phantasmaChargeAmmo: 2 },
        }).modded;
        const fullMagazine = calculateBuild(explosion, [], "", {
            conditionalState: { mode: "initial", phantasmaChargeAmmo: phantasma!.magazineSize },
        }).modded;
        const fireRateMod = { ...emptyEffect(), fireRateBonus: 1 };
        const fullMagazineWithFireRate = calculateBuild(explosion, [fireRateMod], "", {
            conditionalState: { mode: "initial", phantasmaChargeAmmo: phantasma!.magazineSize },
        }).modded;

        expect(baseline.totalDamage).toBeCloseTo(73, 8);
        expect(fullMagazine.totalDamage).toBeCloseTo(73 * (phantasma!.magazineSize / 2), 8);
        expect(fullMagazine.ammoCostPerShot).toBe(phantasma!.magazineSize);
        expect(fullMagazine.shotsPerMag).toBe(1);
        expect(fullMagazine.chargeTimeSeconds).toBe(1);
        expect(fullMagazine.fireRate).toBe(1);
        expect(fullMagazineWithFireRate.fireRate).toBe(1);
    });

    it("loads Cedo's two forced proc distributions only on its radial explosion", () => {
        const cedo = getWeaponCatalog().find((candidate) => candidate.name === "Cedo");
        expect(cedo).toBeDefined();
        const radialIndex = cedo!.attacks.findIndex((attack) => attack.name === "Glaive Radial Attack");
        const directIndex = cedo!.attacks.findIndex((attack) => attack.name === "Alt-Fire Glaive");
        const normalIndex = cedo!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(radialIndex).toBeGreaterThanOrEqual(0);
        expect(directIndex).toBeGreaterThanOrEqual(0);
        expect(normalIndex).toBeGreaterThanOrEqual(0);

        const normal = withSelectedAttack(cedo!, normalIndex);
        expect(normal.statusChance).toBeCloseTo(0.003, 12);
        expect(calculateBuild(normal, []).modded.averageProcsPerShot).toBeCloseTo(0.018, 12);

        const radial = withSelectedAttack(cedo!, radialIndex);
        expect(cedo!.multishot).toBe(6);
        expect(radial.multishot).toBe(1);
        expect(radial.forcedProcDistributions).toEqual([
            { count: 1, mode: "damageWeighted" },
            { count: 1, mode: "uniform", types: ["heat", "cold", "electricity", "toxin"] },
        ]);
        expect(calculateBuild(radial, []).modded.forcedProcsPerShot).toEqual({
            blast: 1,
            heat: 0.25,
            cold: 0.25,
            electricity: 0.25,
            toxin: 0.25,
        });

        const direct = withSelectedAttack(cedo!, directIndex);
        expect(direct.multishot).toBe(1);
        expect(direct.forcedProcDistributions).toBeUndefined();
        expect(calculateBuild(direct, []).modded.forcedProcsPerShot).toEqual({});
    });

    it("counts Nukor Microwave as a persistent unique Galvanized/Condition Overload status", () => {
        const nukorVariants = getWeaponCatalog().filter((weapon) =>
            weapon.name === "Nukor" || weapon.name === "Kuva Nukor",
        );
        expect(nukorVariants).toHaveLength(2);
        const bonus = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };

        for (const weapon of nukorVariants) {
            const attackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
            expect(attackIndex, `${weapon.name} normal attack`).toBeGreaterThanOrEqual(0);
            const selected = withSelectedAttack(weapon, attackIndex);
            expect(selected.uniqueStatusProcs).toEqual(["microwave"]);

            const steady = calculateBuild(selected, [bonus]).modded;
            const withoutMicrowave = calculateBuild({
                ...selected,
                uniqueStatusProcs: undefined,
            }, [bonus]).modded;
            expect(steady.directDamageStatusTypes).toBeCloseTo(withoutMicrowave.directDamageStatusTypes + 1, 12);
            expect(steady.conditionOverloadStatusTypes).toBeCloseTo(withoutMicrowave.conditionOverloadStatusTypes + 1, 12);
            expect(steady.directDamagePerStatusMultiplier).toBeGreaterThan(withoutMicrowave.directDamagePerStatusMultiplier);

            const cleanTarget = calculateBuild(selected, [], "", { targetStatusState: "initial" }).modded;
            expect(cleanTarget.directDamageStatusTypes).toBe(0);
            expect(cleanTarget.conditionOverloadStatusTypes).toBe(0);
        }
    });

    it("applies the Cedo passive to the correct attacks and stacking brackets", () => {
        const weapons = getWeaponCatalog().filter((candidate) =>
            candidate.name === "Cedo" || candidate.name === "Cedo Prime",
        );
        expect(weapons).toHaveLength(2);

        for (const weapon of weapons) {
            const attackIndex = (name: string) => weapon.attacks.findIndex((attack) => attack.name === name);
            const normalIndex = attackIndex("Normal Attack");
            const directIndex = attackIndex("Alt-Fire Glaive");
            const radialIndex = attackIndex("Glaive Radial Attack");
            expect(normalIndex, `${weapon.name} normal attack`).toBeGreaterThanOrEqual(0);
            expect(directIndex, `${weapon.name} glaive direct hit`).toBeGreaterThanOrEqual(0);
            expect(radialIndex, `${weapon.name} glaive radial`).toBeGreaterThanOrEqual(0);

            const normal = withSelectedAttack(weapon, normalIndex);
            const direct = withSelectedAttack(weapon, directIndex);
            const radial = withSelectedAttack(weapon, radialIndex);
            expect(normal.intrinsicDamagePerStatusBonus).toBe(0.6);
            expect(normal.intrinsicDamagePerStatusMode).toBe("additiveBase");
            expect(direct.intrinsicDamagePerStatusBonus).toBe(0.6);
            expect(direct.intrinsicDamagePerStatusMode).toBe("multiplicativeBase");
            expect(radial.intrinsicDamagePerStatusBonus).toBe(0);

            if (weapon.name === "Cedo") {
                const normalStats = calculateBuild(normal, []).modded;
                const expectedPresenceCount = STATUS_DAMAGE_TYPES.reduce((sum, type) => {
                    const mean = (normalStats.procRatePerSecondByType[type] ?? 0) *
                        STATUS_EFFECT_RULES[type].durationSeconds * normalStats.statusDurationMultiplier;
                    return sum + (1 - Math.exp(-mean));
                }, 0);
                expect(normalStats.statusChance).toBeCloseTo(0.003, 10);
                expect(normalStats.directDamageStatusTypes).toBeCloseTo(expectedPresenceCount, 10);
                expect(normalStats.directDamageStatusTypes).toBeGreaterThan(0);
                expect(normalStats.directDamageStatusTypes).toBeLessThan(1);
            }

            for (const [attack, bonus, mode] of [
                [normal, 0.6, "additiveBase"],
                [direct, 0.6, "multiplicativeBase"],
                [radial, 0, "additiveBase"],
            ] as const) {
                const actual = calculateBuild(attack, []).modded;
                const withoutPassive = calculateBuild({
                    ...attack,
                    intrinsicDamagePerStatusBonus: 0,
                    intrinsicDamagePerStatusMode: "additiveBase",
                }, []).modded;
                const statusTypes = actual.directDamageStatusTypes;
                const expectedMultiplier = mode === "multiplicativeBase"
                    ? 1 + bonus * statusTypes
                    : mode === "additiveBase"
                        ? 1 + bonus * statusTypes / (1 + actual.totalDamageBonus)
                        : 1;

                expect(actual.directDamagePerStatusMultiplier).toBeCloseTo(expectedMultiplier, 10);
                expect(actual.arsenalDamage / withoutPassive.arsenalDamage).toBeCloseTo(expectedMultiplier, 10);
                expect(actual.damageBreakdownBeforePerStatus).toEqual(withoutPassive.damageBreakdown);
            }
        }
    });
});

describe("bow fire-rate and reload cadence", () => {
    function selectedNatarukAttack(name: string): WeaponEntry {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Nataruk");
        expect(weapon).toBeDefined();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === name);
        expect(attackIndex, name).toBeGreaterThanOrEqual(0);
        return withSelectedAttack(weapon!, attackIndex);
    }

    it("uses the sourced Nataruk reload time and separates bow charge cadence from repeat cadence", () => {
        const quick = calculateBuild(selectedNatarukAttack("Quick Shot"), []);
        const charged = calculateBuild(selectedNatarukAttack("Charged Shot"), []);
        const perfect = calculateBuild(selectedNatarukAttack("Perfect Shot"), []);

        expect(quick.modded.reloadTime).toBeCloseTo(0.6, 12);
        expect(quick.modded.fireRate).toBeCloseTo(1 / 0.6, 8);
        expect(quick.modded.burstFireRate).toBeCloseTo(1 / 0.6, 8);
        expect(quick.modded.magazineDutyCycle).toBe(1);
        expect(quick.burstDPS).toBeCloseTo(quick.modded.averageShotDamage / 0.6, 8);
        expect(quick.sustainedDPS).toBeCloseTo(quick.burstDPS, 8);

        expect(charged.modded.fireRate).toBeCloseTo(1 / (1 + 0.6), 8);
        expect(charged.modded.burstFireRate).toBeCloseTo(1, 8);
        expect(charged.burstDPS).toBeCloseTo(charged.modded.averageShotDamage, 8);
        expect(charged.sustainedDPS).toBeCloseTo(charged.modded.averageShotDamage / 1.6, 8);

        expect(perfect.modded.fireRate).toBeCloseTo(1 / (0.7 + 0.6), 8);
        expect(perfect.modded.burstFireRate).toBeCloseTo(1 / 0.7, 8);
        expect(perfect.burstDPS).toBeCloseTo(perfect.modded.averageShotDamage / 0.7, 8);
        expect(perfect.sustainedDPS).toBeCloseTo(perfect.modded.averageShotDamage / 1.3, 8);
    });

    it("applies fire-rate bonuses to bow charge and reload-speed bonuses only to the repeat delay", () => {
        const perfect = selectedNatarukAttack("Perfect Shot");
        const fasterCharge = calculateBuild(perfect, [{ ...emptyEffect(), fireRateBonus: 0.5 }]).modded;
        const fasterReload = calculateBuild(perfect, [{ ...emptyEffect(), reloadSpeedBonus: 1 }]).modded;

        expect(fasterCharge.reloadTime).toBeCloseTo(0.6, 12);
        expect(fasterCharge.fireRate).toBeCloseTo(1 / (0.7 / 1.5 + 0.6), 8);
        expect(fasterCharge.burstFireRate).toBeCloseTo(1 / (0.7 / 1.5), 8);

        expect(fasterReload.reloadTime).toBeCloseTo(0.3, 12);
        expect(fasterReload.fireRate).toBeCloseTo(1 / (0.7 + 0.3), 8);
        expect(fasterReload.burstFireRate).toBeCloseTo(1 / 0.7, 8);
    });

    it("preserves the generic charged-weapon fire-rate rule outside the bow family", () => {
        const chargedWeapon = {
            ...makeWeapon({ puncture: 100 }),
            trigger: "Charge",
            chargeTime: 1,
            fireRate: 2,
        };
        const result = calculateBuild(chargedWeapon, []);

        expect(result.modded.fireRate).toBeCloseTo(1 / (1 + 1 / 2), 12);
        expect(result.modded.burstFireRate).toBeCloseTo(result.modded.fireRate, 12);
    });
});

describe("melee combo-scaled mod calculations", () => {
    it("parses and applies Blood Rush and Weeping Wounds using the entered combo tier", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Nikana Prime");
        expect(weapon).toBeDefined();
        const meleeWeapon = weapon!;
        const mods = getModsForWeapon(meleeWeapon);
        const bloodRush = mods.find((candidate) => candidate.name === "Blood Rush");
        const weepingWounds = mods.find((candidate) => candidate.name === "Weeping Wounds");
        expect(bloodRush).toBeDefined();
        expect(weepingWounds).toBeDefined();

        const bloodRushEffect = bloodRush!.effect;
        const weepingWoundsEffect = weepingWounds!.effect;
        expect(bloodRushEffect.comboCritChanceBonus).toBeCloseTo(0.4, 10);
        expect(weepingWoundsEffect.comboStatusChanceBonus).toBeCloseTo(0.4, 10);

        const combo4 = calculateBuild(
            meleeWeapon,
            [bloodRushEffect, weepingWoundsEffect],
            "",
            { conditionalState: { mode: "realistic", meleeComboMultiplier: 4 } },
        ).modded;
        expect(combo4.meleeComboMultiplier).toBe(4);
        expect(combo4.critChance).toBeCloseTo(meleeWeapon.critChance * (1 + 0.4 * 3), 10);
        expect(combo4.statusChance).toBeCloseTo(meleeWeapon.statusChance * (1 + 0.4 * 3), 10);

        const noCombo = calculateBuild(meleeWeapon, [bloodRushEffect, weepingWoundsEffect]).modded;
        expect(noCombo.meleeComboMultiplier).toBe(1);
        expect(noCombo.critChance).toBeCloseTo(meleeWeapon.critChance, 10);
        expect(noCombo.statusChance).toBeCloseTo(meleeWeapon.statusChance, 10);
    });

    it("uses starting combo in Initial state and ignores combo-scaled effects on ranged weapons", () => {
        const meleeWeapon = {
            ...makeWeapon({}),
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee",
        };
        const initialCombo = { ...emptyEffect(), initialComboBonus: 40 };
        const bloodRush = { ...emptyEffect(), comboCritChanceBonus: 0.4 };
        const initial = calculateBuild(meleeWeapon, [initialCombo, bloodRush], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        expect(initial.meleeComboMultiplier).toBe(3);
        expect(initial.critChance).toBeCloseTo(meleeWeapon.critChance * (1 + 0.4 * 2), 10);

        const ranged = calculateBuild(
            makeWeapon({}),
            [bloodRush],
            "",
            { conditionalState: { mode: "realistic", meleeComboMultiplier: 12 } },
        ).modded;
        expect(ranged.meleeComboMultiplier).toBe(1);
        expect(ranged.critChance).toBeCloseTo(0, 10);
    });

    it("uses the Dex Nikana and Venka Prime combo-tier exceptions", () => {
        const bloodRush = { ...emptyEffect(), comboCritChanceBonus: 0.4 };
        const dexNikana = {
            ...makeWeapon({}),
            name: "Dex Nikana",
            category: "Melee" as const,
            weaponType: "Nikana",
            modCompat: "Melee" as const,
            critChance: 0.2,
        };
        const venkaPrime = { ...dexNikana, name: "Venka Prime" };

        const dexAt12 = calculateBuild(dexNikana, [bloodRush], "", {
            conditionalState: { mode: "realistic", meleeComboMultiplier: 12 },
        }).modded;
        const dexInitial = calculateBuild(dexNikana, [
            { ...emptyEffect(), initialComboBonus: 110 },
            bloodRush,
        ], "", { conditionalState: { mode: "initial" } }).modded;
        const venkaAt13 = calculateBuild(venkaPrime, [bloodRush], "", {
            conditionalState: { mode: "realistic", meleeComboMultiplier: 13 },
        }).modded;

        expect(dexAt12.meleeComboMultiplier).toBe(11);
        expect(dexAt12.critChance).toBeCloseTo(dexNikana.critChance * (1 + 0.4 * 10), 10);
        expect(dexInitial.meleeComboMultiplier).toBe(11);
        expect(venkaAt13.meleeComboMultiplier).toBe(13);
        expect(venkaAt13.critChance).toBeCloseTo(venkaPrime.critChance * (1 + 0.4 * 12), 10);
    });

    it("applies the active combo tier to selected heavy attacks and their status seeds only", () => {
        const brokenWar = getWeaponCatalog().find((weapon) => weapon.name === "Broken War");
        expect(brokenWar).toBeDefined();
        const normalAttack = withSelectedAttack(
            brokenWar!,
            brokenWar!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
        );
        const slamAttack = withSelectedAttack(
            brokenWar!,
            brokenWar!.attacks.findIndex((attack) => attack.name === "Slam Attack"),
        );
        const heavySlamAttack = withSelectedAttack(
            brokenWar!,
            brokenWar!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack"),
        );
        expect(normalAttack.selectedAttackUsesMeleeComboMultiplier).toBe(false);
        expect(slamAttack.selectedAttackUsesMeleeComboMultiplier).toBe(false);
        expect(heavySlamAttack.selectedAttackUsesMeleeComboMultiplier).toBe(true);

        const state = (meleeComboMultiplier: number) => ({
            conditionalState: { mode: "realistic" as const, meleeComboMultiplier },
        });
        const heavyAt1x = calculateBuild(heavySlamAttack, [], "", state(1)).modded;
        const heavyAt5x = calculateBuild(heavySlamAttack, [], "", state(5)).modded;
        const normalAt1x = calculateBuild(normalAttack, [], "", state(1)).modded;
        const normalAt5x = calculateBuild(normalAttack, [], "", state(5)).modded;

        expect(heavyAt5x.meleeAttackComboDamageMultiplier).toBe(5);
        expect(heavyAt5x.baseDamageTotal).toBeCloseTo(heavyAt1x.baseDamageTotal * 5, 10);
        expect(heavyAt5x.damageBreakdown.blast).toBeCloseTo(heavyAt1x.damageBreakdown.blast * 5, 8);
        expect(normalAt5x.meleeAttackComboDamageMultiplier).toBe(1);
        expect(normalAt5x.damageBreakdown.slash).toBeCloseTo(normalAt1x.damageBreakdown.slash, 10);

        const glaivePrime = getWeaponCatalog().find((weapon) => weapon.name === "Glaive Prime");
        expect(glaivePrime).toBeDefined();
        const chargedThrow = withSelectedAttack(
            glaivePrime!,
            glaivePrime!.attacks.findIndex((attack) => attack.name === "Charged Throw"),
        );
        const glaiveAt1x = calculateBuild(chargedThrow, [], "", state(1)).modded;
        const glaiveAt5x = calculateBuild(chargedThrow, [], "", state(5)).modded;
        expect(glaiveAt5x.dotDamagePerApplicationSeedByType.slash).toBeCloseTo(
            glaiveAt1x.dotDamagePerApplicationSeedByType.slash! * 5,
            2,
        );
    });

    it("estimates one heavy attack's retained combo using efficiency and innate initial combo", () => {
        const heavyWeapon = {
            ...makeWeapon({}),
            name: "Broken War",
            category: "Melee" as const,
            selectedAttackUsesMeleeComboMultiplier: true,
        };
        const combo5x = { conditionalState: { mode: "realistic" as const, meleeComboMultiplier: 5 } };
        const withoutEfficiency = calculateBuild(heavyWeapon, [], "", combo5x).modded;
        expect(withoutEfficiency.meleeComboPointsBeforeHeavyAttack).toBe(80);
        expect(withoutEfficiency.heavyAttackEfficiency).toBe(0);
        expect(withoutEfficiency.meleeComboPointsAfterHeavyAttack).toBe(0);
        expect(withoutEfficiency.meleeComboMultiplierAfterHeavyAttack).toBe(1);

        const with40Efficiency = calculateBuild(heavyWeapon, [
            { ...emptyEffect(), heavyAttackEfficiencyBonus: 0.4 },
        ], "", combo5x).modded;
        expect(with40Efficiency.heavyAttackEfficiency).toBe(0.4);
        expect(with40Efficiency.meleeComboPointsAfterHeavyAttack).toBe(32);
        expect(with40Efficiency.meleeComboMultiplierAfterHeavyAttack).toBe(2);

        const cappedEfficiency = calculateBuild(heavyWeapon, [
            { ...emptyEffect(), heavyAttackEfficiencyBonus: 1.2 },
        ], "", combo5x).modded;
        expect(cappedEfficiency.heavyAttackEfficiency).toBe(0.9);
        expect(cappedEfficiency.meleeComboPointsAfterHeavyAttack).toBe(72);
        expect(cappedEfficiency.meleeComboMultiplierAfterHeavyAttack).toBe(4);

        const initialState = calculateBuild(heavyWeapon, [
            { ...emptyEffect(), initialComboBonus: 40, heavyAttackEfficiencyBonus: 0.4 },
        ], "", { conditionalState: { mode: "initial", meleeComboMultiplier: 12 } }).modded;
        expect(initialState.meleeComboMultiplier).toBe(3);
        expect(initialState.meleeComboPointsBeforeHeavyAttack).toBe(40);
        expect(initialState.meleeComboPointsAfterHeavyAttack).toBe(16);
        expect(initialState.meleeComboMultiplierAfterHeavyAttack).toBe(1);

        const fragorPrime = { ...heavyWeapon, name: "Fragor Prime" };
        const innateInitialCombo = calculateBuild(fragorPrime, [], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        expect(innateInitialCombo.meleeComboMultiplier).toBe(2);
        expect(innateInitialCombo.meleeComboPointsBeforeHeavyAttack).toBe(30);
    });
});
