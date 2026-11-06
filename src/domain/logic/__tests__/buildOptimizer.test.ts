import { describe, expect, it } from "vitest";
import { getArcanesByWeaponCategory } from "../../catalog/arcaneCatalog";
import { getModsForWeapon, getStancesForWeapon } from "../../catalog/modCatalog";
import { getWeaponCatalog, selectedAttackUsesIncarnonForm } from "../../catalog/weaponCatalog";
import type { WeaponEntry } from "../../catalog/weaponCatalog";
import { emptyEffect } from "../../catalog/modCatalog";
import { debugScoreBuild, optimizeBuild } from "../buildOptimizer";
import { computeCapacity } from "../capacityCalc";
import { calculateBuild } from "../damageCalc";

function makeWeapon(overrides: Partial<WeaponEntry> = {}): WeaponEntry {
    return {
        uniqueName: "/Test/Weapon",
        name: "Test Weapon",
        category: "Primary",
        weaponType: "Rifle",
        modCompat: "Rifle",
        damage: {
            total: 100,
            impact: 10,
            puncture: 20,
            slash: 30,
            heat: 0,
            cold: 0,
            electricity: 0,
            toxin: 40,
            blast: 0,
            radiation: 0,
            gas: 0,
            magnetic: 0,
            viral: 0,
            corrosive: 0,
            void: 0,
            tau: 0,
            true: 0,
        },
        critChance: 0.2,
        critMultiplier: 2,
        statusChance: 0.45,
        fireRate: 8,
        magazineSize: 40,
        ammoCostPerShot: 1,
        hasExplicitMagazineSize: true,
        reloadTime: 3.2,
        multishot: 1,
        trigger: "Auto",
        chargeTime: null,
        polarities: [],
        canOverLevel: false,
        baseSlotCount: 8,
        disposition: 1,
        attacks: [],
        tags: [],
        ...overrides,
    };
}

function countFormaLikeUi(
    weapon: WeaponEntry,
    slotPolarities: string[],
    stancePolarity: string,
    exilusPolarity: string,
): number {
    const defaultCounts = new Map<string, number>();
    const currentCounts = new Map<string, number>();
    const addCount = (map: Map<string, number>, polarity: string) => {
        if (!polarity) return;
        map.set(polarity, (map.get(polarity) ?? 0) + 1);
    };
    for (const polarity of weapon.polarities) addCount(defaultCounts, polarity);
    addCount(defaultCounts, weapon.stancePolarity ?? "");
    for (const polarity of slotPolarities) addCount(currentCounts, polarity);
    addCount(currentCounts, stancePolarity);
    addCount(currentCounts, exilusPolarity);
    let changes = 0;
    const allKeys = new Set([...defaultCounts.keys(), ...currentCounts.keys()]);
    for (const key of allKeys) {
        const extra = (currentCounts.get(key) ?? 0) - (defaultCounts.get(key) ?? 0);
        if (extra > 0) changes += extra;
    }
    return changes;
}

describe("build optimizer scoring", () => {
    it("uses named single-attack exalted stats instead of the stale top-level weapon record", () => {
        const dexPixia = getWeaponCatalog().find((entry) => entry.uniqueName === "/Lotus/Powersuits/Fairy/FlightPistols");

        expect(dexPixia).toBeTruthy();
        expect(dexPixia?.attacks).toHaveLength(1);

        const attack = dexPixia!.attacks[0]!;
        expect(attack.damage.total).toBeGreaterThan(dexPixia!.damage.total);

        const attackWeapon: WeaponEntry = {
            ...dexPixia!,
            damage: attack.damage,
            critChance: attack.critChance,
            critMultiplier: attack.critMultiplier,
            statusChance: attack.statusChance,
            fireRate: attack.speed || dexPixia!.fireRate,
            chargeTime: attack.chargeTime ?? null,
            selectedAttackName: attack.name,
        };

        const fromTopLevel = calculateBuild(dexPixia!, []).modded;
        const fromAttack = calculateBuild(attackWeapon, []).modded;

        expect(fromTopLevel.totalDamage).toBe(50);
        expect(fromAttack.totalDamage).toBe(160);
    });

    it("prefers standard mod variants over flawed ones when both are available", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Iron Staff");
        expect(weapon).toBeTruthy();

        const feverVariants = getModsForWeapon(weapon!).filter((mod) => mod.name === "Fever Strike");
        const standard = feverVariants.find((mod) => !/\/Beginner\//.test(mod.path));
        const flawed = feverVariants.find((mod) => /\/Beginner\//.test(mod.path));

        expect(standard).toBeTruthy();
        expect(flawed).toBeTruthy();

        const result = optimizeBuild(
            weapon!,
            [standard!, flawed!],
            "burst",
            1,
            {
                ownedModUniqueNames: new Set([standard!.uniqueName, flawed!.uniqueName]),
                ownedModMaxRankByUniqueName: {
                    [standard!.uniqueName]: standard!.fusionLimit,
                    [flawed!.uniqueName]: flawed!.fusionLimit,
                },
                allowNonMaxRank: true,
            },
        );

        expect(result.mods).toHaveLength(1);
        expect(result.mods[0]?.uniqueName).toBe(standard!.uniqueName);
    });

    it("anchors duplicate primary elements to their first slot when resolving proc weights", () => {
        const weapon = makeWeapon({
            category: "Melee",
            weaponType: "Heavy Scythe",
            modCompat: "Melee",
            damage: {
                total: 300,
                impact: 0,
                puncture: 90,
                slash: 210,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            critChance: 0.3,
            critMultiplier: 2.2,
            statusChance: 0.24,
            fireRate: 0.917,
            magazineSize: 1,
            reloadTime: 0,
            hasExplicitMagazineSize: false,
            trigger: "Auto",
        });

        const stats = calculateBuild(weapon, [
            { ...emptyEffect(), damageBonus: 1.2 },
            null,
            null,
            { ...emptyEffect(), attackSpeedBonus: 0.3 },
            { ...emptyEffect(), toxinBonus: 0.6, statusChanceBonus: 0.6 },
            { ...emptyEffect(), coldBonus: 0.6, statusChanceBonus: 0.6 },
            { ...emptyEffect(), magneticBonus: 0.6, attackSpeedBonus: 0.2 },
            { ...emptyEffect(), heatBonus: 0.9 },
        ]).modded;

        expect(stats.damageBreakdown.heat).toBeCloseTo(598.125, 5);
        expect(stats.damageBreakdown.viral).toBeCloseTo(783.75, 5);
        expect(stats.damageBreakdown.magnetic).toBeCloseTo(391.875, 5);
        expect(stats.damageBreakdown.blast).toBe(0);
        expect(stats.damageBreakdown.toxin).toBe(0);
        expect(stats.procChanceByType.heat ?? 0).toBeCloseTo(0.2457627119, 5);
        expect(stats.procChanceByType.viral ?? 0).toBeCloseTo(0.3220338983, 5);
    });

    it("treats all same-element bonuses as living in the first slot that introduced that element", () => {
        const weapon = makeWeapon({
            category: "Melee",
            weaponType: "Staff",
            modCompat: "Melee",
            damage: {
                total: 300,
                impact: 204,
                puncture: 0,
                slash: 96,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            critChance: 0.25,
            critMultiplier: 2,
            statusChance: 0.3,
            fireRate: 1,
            magazineSize: 1,
            reloadTime: 0,
            hasExplicitMagazineSize: false,
            trigger: "Auto",
        });

        const stats = calculateBuild(weapon, [
            { ...emptyEffect(), damageBonus: 1.2 },
            { ...emptyEffect(), toxinBonus: 0.9 },
            { ...emptyEffect(), heatBonus: 0.9 },
            null,
            null,
            { ...emptyEffect(), toxinBonus: 0.6, statusChanceBonus: 0.6 },
            { ...emptyEffect(), coldBonus: 0.6, statusChanceBonus: 0.6 },
            { ...emptyEffect(), magneticBonus: 0.6, attackSpeedBonus: 0.2 },
        ]).modded;

        expect(stats.damageBreakdown.gas).toBeCloseTo(1588.125, 5);
        expect(stats.damageBreakdown.cold).toBeCloseTo(391.875, 5);
        expect(stats.damageBreakdown.magnetic).toBeCloseTo(391.875, 5);
        expect(stats.damageBreakdown.viral).toBe(0);
        expect(stats.damageBreakdown.heat).toBe(0);
        expect(stats.procChanceByType.gas ?? 0).toBeCloseTo(0.5238095238, 5);
        expect(stats.procChanceByType.cold ?? 0).toBeCloseTo(0.1292517007, 5);
    });

    it("prefers front-loaded direct damage for burst over ramping status packages", () => {
        const weapon = makeWeapon({
            fireRate: 10,
            magazineSize: 50,
            reloadTime: 4.5,
            critChance: 0.3,
            statusChance: 0.35,
        });

        const directPackage = {
            ...emptyEffect(),
            damageBonus: 1.4,
            multishotBonus: 1.1,
            critChanceBonus: 0.9,
            critMultBonus: 0.9,
        };
        const rampPackage = {
            ...emptyEffect(),
            statusChanceBonus: 1.2,
            statusDamageBonus: 0.9,
            toxinBonus: 0.9,
            finalStatusChanceBonus: 0.25,
            directDamagePerStatusBonus: 0.45,
        };

        const directBurst = debugScoreBuild(weapon, [directPackage], "burst", "grineer");
        const rampBurst = debugScoreBuild(weapon, [rampPackage], "burst", "grineer");

        expect(directBurst).toBeGreaterThan(rampBurst);
    });

    it("counts stacked conditional damage-per-status bonuses for scaling", () => {
        const weapon = makeWeapon({
            statusChance: 0.55,
            fireRate: 12,
            magazineSize: 70,
        });

        const primerPackage = {
            ...emptyEffect(),
            statusChanceBonus: 1.2,
            toxinBonus: 0.9,
            multishotBonus: 0.6,
        };
        const oneStack = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 1,
                stats: { directDamagePerStatusBonus: 0.4 },
            }],
        };
        const threeStacks = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 3,
                stats: { directDamagePerStatusBonus: 0.4 },
            }],
        };

        const oneStackScore = debugScoreBuild(weapon, [primerPackage, oneStack], "scaling", "grineer");
        const threeStackScore = debugScoreBuild(weapon, [primerPackage, threeStacks], "scaling", "grineer");

        expect(threeStackScore).toBeGreaterThan(oneStackScore);
    });

    it("applies direct damage per status bonuses to displayed direct-hit damage", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 100,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 10,
        });

        const stats = calculateBuild(weapon, [{ ...emptyEffect(), directDamagePerStatusBonus: 0.4 }]).modded;

        expect(stats.directDamageStatusTypes).toBe(1);
        expect(stats.directDamagePerStatusMultiplier).toBeCloseTo(1.4, 6);
        expect(stats.totalDamage).toBeCloseTo(140, 6);
        expect(stats.averageShotDamage).toBeCloseTo(140, 6);
    });

    it("applies stacked conditional direct damage per status bonuses to displayed direct-hit damage", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 100,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 10,
        });

        const stats = calculateBuild(weapon, [{
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 3,
                stats: { directDamagePerStatusBonus: 0.4 },
            }],
        }]).modded;

        expect(stats.directDamageStatusTypes).toBe(1);
        expect(stats.directDamagePerStatusBonus).toBeCloseTo(1.2, 6);
        expect(stats.directDamagePerStatusMultiplier).toBeCloseTo(2.2, 6);
        expect(stats.totalDamage).toBeCloseTo(220, 6);
        expect(stats.averageShotDamage).toBeCloseTo(220, 6);
    });

    it("assumes ramping headshot conditionals are fully online for scaling but not burst", () => {
        const weapon = makeWeapon({
            critChance: 0.35,
            critMultiplier: 2.4,
            fireRate: 9,
            statusChance: 0.25,
        });

        const stackedHeadshotPackage = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHeadshot" as const,
                durationSeconds: 12,
                requiresAiming: true,
                maxStacks: 5,
                stats: { critChanceBonus: 0.4 },
            }],
        };

        const burstScore = debugScoreBuild(weapon, [stackedHeadshotPackage], "burst", "grineer");
        const scalingScore = debugScoreBuild(weapon, [stackedHeadshotPackage], "scaling", "grineer");

        expect(scalingScore).toBeGreaterThan(burstScore);
    });

    it("treats magnetic as favored against corpus and radiation as resisted", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 100,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 0,
            critChance: 0,
            critMultiplier: 1,
        });

        const magneticPackage = { ...emptyEffect(), magneticBonus: 1 };
        const radiationPackage = { ...emptyEffect(), radiationBonus: 1 };

        const magneticScore = debugScoreBuild(weapon, [magneticPackage], "burst", "corpus");
        const radiationScore = debugScoreBuild(weapon, [radiationPackage], "burst", "corpus");

        expect(magneticScore).toBeGreaterThan(radiationScore);
    });

    it("does not award radiation confusion utility against ungrouped corpus targets", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 100,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 0.8,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 12,
        });

        const radiationPackage = { ...emptyEffect(), radiationBonus: 1 };
        const heatPackage = { ...emptyEffect(), heatBonus: 1 };

        const radiationScore = debugScoreBuild(weapon, [radiationPackage], "scaling", "corpus");
        const heatScore = debugScoreBuild(weapon, [heatPackage], "scaling", "corpus");

        expect(heatScore).toBeGreaterThan(radiationScore);
    });

    it("treats magnetic as resisted and toxin as favored against narmer", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 0,
            critChance: 0,
            critMultiplier: 1,
        });

        const magneticPackage = { ...emptyEffect(), magneticBonus: 1 };
        const toxinPackage = { ...emptyEffect(), toxinBonus: 1 };

        const magneticScore = debugScoreBuild(weapon, [magneticPackage], "burst", "narmer");
        const toxinScore = debugScoreBuild(weapon, [toxinPackage], "burst", "narmer");

        expect(toxinScore).toBeGreaterThan(magneticScore);
    });

    it("does not count magnetic as an affecting status on shieldless grineer targets", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 10,
        });

        const directPerStatus = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };
        const magneticPrimer = { ...emptyEffect(), magneticBonus: 1 };
        const toxinPrimer = { ...emptyEffect(), toxinBonus: 1 };

        const magneticScore = debugScoreBuild(weapon, [directPerStatus, magneticPrimer], "scaling", "Grineer");
        const toxinScore = debugScoreBuild(weapon, [directPerStatus, toxinPrimer], "scaling", "Grineer");

        expect(toxinScore).toBeGreaterThan(magneticScore);
    });

    it("allows magnetic-gated conditionals only when the target can actually be affected", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 10,
        });

        const magneticPrimer = { ...emptyEffect(), magneticBonus: 1 };
        const magneticConditional = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHit" as const,
                durationSeconds: 6,
                requiresAiming: false,
                maxStacks: 1,
                requiredStatusType: "magnetic" as const,
                stats: { damageBonus: 1.2 },
            }],
        };

        const grineerScore = debugScoreBuild(weapon, [magneticPrimer, magneticConditional], "scaling", "Grineer");
        const corpusScore = debugScoreBuild(weapon, [magneticPrimer, magneticConditional], "scaling", "Corpus");

        expect(corpusScore).toBeGreaterThan(grineerScore);
    });

    it("allows magnetic status value on overguarded shieldless targets", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 100,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 10,
        });

        const magneticPrimer = { ...emptyEffect(), magneticBonus: 1 };
        const magneticConditional = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHit" as const,
                durationSeconds: 6,
                requiresAiming: false,
                maxStacks: 1,
                requiredStatusType: "magnetic" as const,
                stats: { damageBonus: 1.2 },
            }],
        };

        const baseScore = debugScoreBuild(weapon, [magneticPrimer, magneticConditional], "scaling", "Grineer");
        const overguardedScore = debugScoreBuild(
            weapon,
            [magneticPrimer, magneticConditional],
            "scaling",
            "Grineer",
            null,
            { hasOverguard: true },
        );

        expect(overguardedScore).toBeGreaterThan(baseScore);
    });

    it("can zero out specific status types via target profile override", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                heat: 100,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 10,
        });

        const heatPrimer = { ...emptyEffect(), heatBonus: 1 };
        const heatConditional = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHit" as const,
                durationSeconds: 6,
                requiresAiming: false,
                maxStacks: 1,
                requiredStatusType: "heat" as const,
                stats: { damageBonus: 1.2 },
            }],
        };

        const normalScore = debugScoreBuild(weapon, [heatPrimer, heatConditional], "scaling", "Grineer");
        const heatImmuneScore = debugScoreBuild(
            weapon,
            [heatPrimer, heatConditional],
            "scaling",
            "Grineer",
            null,
            { statusImmuneTypes: ["heat"] },
        );

        expect(normalScore).toBeGreaterThan(heatImmuneScore);
    });

    it("prefers the bane/crit acceltra prime scaling build over the magnetic variant against grineer", () => {
        const weapon = getWeaponCatalog().find(w => w.name === "Acceltra Prime");
        expect(weapon).toBeTruthy();
        const attack = weapon!.attacks[1];
        expect(attack).toBeTruthy();

        const scoringWeapon = {
            ...weapon!,
            damage: attack.damage,
            critChance: attack.critChance,
            critMultiplier: attack.critMultiplier,
            statusChance: attack.statusChance,
            fireRate: attack.speed || weapon!.fireRate,
            chargeTime: attack.chargeTime ?? null,
        };

        const mods = getModsForWeapon(weapon!);
        const byName = (name: string) => mods.find(m => m.name === name)!;
        const arcane = getArcanesByWeaponCategory(weapon!.category).find(a => a.name === "Primary Merciless");
        const arcaneEffect = arcane?.optimizerEffectByRank[5] ?? arcane?.permanentEffectByRank[5] ?? null;

        const magneticBuild = [
            "Malignant Force",
            "Primed Cryo Rounds",
            "Galvanized Aptitude",
            "Hellfire",
            "Galvanized Chamber",
            "Magnetic Capacity",
            "Galvanized Scope",
            "Vital Sense",
        ].map(byName);

        const baneBuild = [
            "Malignant Force",
            "Primed Cryo Rounds",
            "Galvanized Aptitude",
            "Hellfire",
            "Galvanized Chamber",
            "Critical Delay",
            "Primed Bane Of Grineer",
            "Vital Sense",
        ].map(byName);

        const magneticScore = debugScoreBuild(scoringWeapon, magneticBuild.map(mod => mod.effect), "scaling", "Grineer", arcaneEffect);
        const baneScore = debugScoreBuild(scoringWeapon, baneBuild.map(mod => mod.effect), "scaling", "Grineer", arcaneEffect);

        expect(baneScore).toBeGreaterThan(magneticScore);
    });

    it("reuses built-in polarities, reserves room for exilus, and avoids frozen-only arcanes for War scaling", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find(w => w.name === "War");
        expect(weapon).toBeTruthy();

        const stance = getStancesForWeapon(weapon!).find(mod => mod.name === "Cleaving Whirlwind");
        expect(stance).toBeTruthy();

        const result = optimizeBuild(weapon!, null, "scaling", 8, {
            targetFaction: "Grineer",
            capacityConfig: {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 22,
                canOverLevel: weapon!.canOverLevel,
            },
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            allowCatalyst: true,
            allowForma: true,
            optimizeExilus: true,
            exilusPolarity: "",
            optimizeArcane: true,
            buildForAttack: weapon!.attacks[0],
            extraCapacitySlots: [{
                mod: stance!,
                rank: stance!.fusionLimit,
                polarity: weapon!.stancePolarity ?? "",
            }],
        });

        expect(result.exilusMod).toBeTruthy();
        expect(result.arcane?.name).not.toBe("Melee Careen");
        expect(
            result.slots.some((mod, index) =>
                !!mod && result.slotPolarities[index] === "naramon" && mod.polarity === "naramon"),
        ).toBe(true);
        expect(
            countFormaLikeUi(weapon!, result.slotPolarities, weapon!.stancePolarity ?? "", result.exilusPolarity),
        ).toBeLessThanOrEqual(5);
    });

    it("only considers exilus-eligible mods for exilus and avoids movement-only no-op picks when better utility exists", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find(w => w.name === "Acceltra Prime");
        expect(weapon).toBeTruthy();

        const result = optimizeBuild(weapon!, null, "scaling", 8, {
            targetFaction: "Grineer",
            capacityConfig: {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 22,
                canOverLevel: weapon!.canOverLevel,
            },
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            allowCatalyst: true,
            allowForma: true,
            optimizeExilus: true,
            exilusPolarity: "",
            optimizeArcane: true,
            buildForAttack: weapon!.attacks[0],
        });

        expect(result.exilusMod).toBeTruthy();
        expect(result.exilusMod?.isExilus).toBe(true);
        expect(result.exilusMod?.name).not.toBe("Aerial Ace");
        expect((result.exilusMod?.statsLabel ?? "").toLowerCase()).not.toContain("double jump");
    });

    it("respects the configured max forma cap during optimization", { timeout: 12000 }, () => {
        const weapon = getWeaponCatalog().find(w => w.name === "War");
        expect(weapon).toBeTruthy();

        const stance = getStancesForWeapon(weapon!).find(mod => mod.name === "Cleaving Whirlwind");
        expect(stance).toBeTruthy();

        const result = optimizeBuild(weapon!, null, "scaling", 8, {
            targetFaction: "Grineer",
            capacityConfig: {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 22,
                canOverLevel: weapon!.canOverLevel,
            },
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            allowCatalyst: true,
            allowForma: true,
            maxFormaCount: 1,
            optimizeExilus: true,
            exilusPolarity: "",
            optimizeArcane: true,
            buildForAttack: weapon!.attacks[0],
            extraCapacitySlots: [{
                mod: stance!,
                rank: stance!.fusionLimit,
                polarity: weapon!.stancePolarity ?? "",
            }],
        });

        expect(
            countFormaLikeUi(weapon!, result.slotPolarities, weapon!.stancePolarity ?? "", result.exilusPolarity),
        ).toBeLessThanOrEqual(1);
    });

    it("keeps respected-capacity acceltra builds within capacity and avoids toxin-only arcanes on viral setups", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find(w => w.name === "Acceltra Prime");
        expect(weapon).toBeTruthy();

        const result = optimizeBuild(weapon!, null, "burst", 8, {
            targetFaction: "Grineer",
            capacityConfig: {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 22,
                canOverLevel: weapon!.canOverLevel,
            },
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            allowCatalyst: true,
            allowForma: true,
            maxFormaCount: 2,
            optimizeExilus: true,
            exilusPolarity: "",
            optimizeArcane: true,
            buildForAttack: weapon!.attacks[0],
        });

        const capacity = computeCapacity(
            {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 22,
                canOverLevel: weapon!.canOverLevel,
            },
            [...result.slotPolarities.map(polarity => ({ polarity })), { polarity: result.exilusPolarity }],
            [...result.slots, result.exilusMod],
            [...result.slotRanks, result.exilusMod ? result.exilusRank : 0],
        );

        expect(capacity.overCapacity).toBe(false);
        expect(result.arcane?.name).not.toBe("Primary Blight");
    });

    it("finds a viral-oriented scaling build for Nataruk against Grineer", { timeout: 15000 }, () => {
        const weapon = getWeaponCatalog().find(w => w.name === "Nataruk");
        expect(weapon).toBeTruthy();

        const attack = weapon!.attacks.find(a => a.name === "Perfect Shot");
        expect(attack).toBeTruthy();

        const result = optimizeBuild(weapon!, null, "scaling", 8, {
            targetFaction: "Grineer",
            allowForma: true,
            maxFormaCount: 9,
            optimizeArcane: true,
            buildForAttack: attack!,
        });

        const modNames = result.slots.map(mod => mod?.name).filter(Boolean);
        expect(modNames).toContain("Vile Acceleration");
        expect(modNames.some(name => name === "Primed Cryo Rounds" || name === "Cryo Rounds")).toBe(true);
        expect(modNames.some(name => name === "Infected Clip" || name === "Malignant Force")).toBe(true);
        expect(modNames.some(name => name === "Thermite Rounds" || name === "Hellfire")).toBe(true);
        expect(modNames).not.toContain("Radiated Reload");
    });
});

describe("damage calculation ramp interactions", () => {
    it("uses the wiki average crit formula instead of exponential crit tiers", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 100,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            critChance: 2.5,
            critMultiplier: 3,
            multishot: 1,
        });

        const result = calculateBuild(weapon, []);
        expect(result.modded.averageShotDamage).toBeCloseTo(600, 6);
    });

    it("keeps arsenal damage free of faction multipliers", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 100,
                puncture: 0,
                slash: 0,
                heat: 0,
                cold: 0,
                electricity: 0,
                toxin: 0,
                blast: 0,
                radiation: 0,
                gas: 0,
                magnetic: 0,
                viral: 0,
                corrosive: 0,
                void: 0,
                tau: 0,
                true: 0,
            },
            critChance: 0,
            multishot: 1,
        });

        const bane = {
            ...emptyEffect(),
            factionDamageBonus: 0.3,
            targetFaction: "Grineer",
        };

        const result = calculateBuild(weapon, [bane], "Grineer");
        expect(result.modded.arsenalDamage).toBeCloseTo(100, 6);
        expect(result.burstDPS).toBeCloseTo(weapon.fireRate * 100, 6);
    });

    it("lets per-hit crit scaling benefit from added multishot", () => {
        const weapon = makeWeapon({
            critChance: 0.12,
            magazineSize: 80,
            fireRate: 14,
        });

        const baseRamp = {
            ...emptyEffect(),
            perHitCritChanceBonus: 0.015,
        };
        const withMultishot = {
            ...baseRamp,
            multishotBonus: 1,
        };

        const baseResult = calculateBuild(weapon, [baseRamp]);
        const multishotResult = calculateBuild(weapon, [withMultishot]);

        expect(multishotResult.modded.critChance).toBeGreaterThan(baseResult.modded.critChance);
    });

    it("lets next-magazine status scaling build stacks faster with multishot", () => {
        const weapon = makeWeapon({
            statusChance: 0.2,
            magazineSize: 12,
            fireRate: 6,
        });

        const nextMagRamp = {
            ...emptyEffect(),
            nextMagazineStatusChancePerShot: 0.08,
            nextMagazineMaxStacks: 10,
        };
        const nextMagRampWithMultishot = {
            ...nextMagRamp,
            multishotBonus: 1,
        };

        const baseResult = calculateBuild(weapon, [nextMagRamp]);
        const multishotResult = calculateBuild(weapon, [nextMagRampWithMultishot]);

        expect(multishotResult.modded.statusChance).toBeGreaterThan(baseResult.modded.statusChance);
    });

    it("keeps flawed training variants in the rifle mod pool as distinct candidates", () => {
        const weapon = getWeaponCatalog().find(w => w.name === "Braton");
        expect(weapon).toBeTruthy();

        const mods = getModsForWeapon(weapon!);
        const serrations = mods.filter(mod => mod.name === "Serration");

        expect(serrations.some(mod => /\/Beginner\//.test(mod.uniqueName))).toBe(true);
        expect(serrations.some(mod => !/\/(Beginner|Intermediate|Expert)\//.test(mod.uniqueName))).toBe(true);
    });

    it("does not stack pressure point family variants in the same optimized melee build", () => {
        const thalys = getWeaponCatalog().find((weapon) => weapon.name === "Thalys");
        expect(thalys).toBeTruthy();

        const candidatePool = getModsForWeapon(thalys!).filter((mod) =>
            [
                "/Lotus/Upgrades/Mods/Melee/WeaponMeleeDamageMod",
                "/Lotus/Upgrades/Mods/Melee/Beginner/WeaponMeleeDamageModBeginner",
                "/Lotus/Upgrades/Mods/Melee/Expert/WeaponMeleeDamageModExpert",
                "/Lotus/Upgrades/Mods/Melee/WeaponCritDamageMod",
                "/Lotus/Upgrades/Mods/Melee/WeaponCritChanceMod",
                "/Lotus/Upgrades/Mods/Melee/WeaponToxinDamageMod",
                "/Lotus/Upgrades/Mods/Melee/DualStat/IceEventMeleeMod",
                "/Lotus/Upgrades/Mods/Melee/WeaponFireDamageMod",
                "/Lotus/Upgrades/Mods/Melee/Expert/WeaponMeleeStatusChanceSPMod",
            ].includes(mod.uniqueName)
        );

        const result = optimizeBuild(thalys!, candidatePool, "scaling", 8, {
            allowForma: true,
            maxFormaCount: 99,
        });

        const pressurePointFamilyCount = result.slots
            .filter((mod): mod is NonNullable<typeof mod> => !!mod)
            .filter((mod) => /Pressure Point/i.test(mod.name))
            .length;

        expect(pressurePointFamilyCount).toBe(1);
    });

    it("hides internal-only melee mod variants from melee candidate pools", () => {
        const thalys = getWeaponCatalog().find((weapon) => weapon.name === "Thalys");
        expect(thalys).toBeTruthy();

        const candidatePool = getModsForWeapon(thalys!);

        expect(candidatePool.some((mod) => mod.uniqueName === "/Lotus/Upgrades/Mods/Melee/WeaponMeleeDamageOnHeavyKillMod")).toBe(false);
    });

    it("treats Laetum Auto Radial Attack as Incarnon scope", () => {
        const laetum = getWeaponCatalog().find((weapon) => weapon.name === "Laetum");
        expect(laetum).toBeTruthy();

        expect(selectedAttackUsesIncarnonForm(laetum!, 2)).toBe(true);
    });

    it("ignores reload downtime for Incarnon-form selected attacks", () => {
        const laetum = getWeaponCatalog().find((weapon) => weapon.name === "Laetum");
        expect(laetum).toBeTruthy();

        const attack = laetum!.attacks[2];
        expect(attack).toBeTruthy();

        const selectedAttackWeapon: WeaponEntry = {
            ...laetum!,
            damage: attack.damage,
            critChance: attack.critChance,
            critMultiplier: attack.critMultiplier,
            statusChance: attack.statusChance,
            fireRate: attack.speed || laetum!.fireRate,
            chargeTime: attack.chargeTime ?? null,
            selectedAttackName: attack.name,
            selectedAttackIsIncarnon: true,
        };
        const quickdraw = getModsForWeapon(laetum!).find((mod) => mod.name === "Quickdraw");
        expect(quickdraw).toBeTruthy();

        const noReloadBuild = calculateBuild(selectedAttackWeapon, [], "");
        const quickdrawBuild = calculateBuild(selectedAttackWeapon, [quickdraw!.effect], "");

        expect(noReloadBuild.sustainedDPS).toBeCloseTo(noReloadBuild.burstDPS, 6);
        expect(quickdrawBuild.sustainedDPS).toBeCloseTo(quickdrawBuild.burstDPS, 6);
        expect(quickdrawBuild.sustainedDPS).toBeCloseTo(noReloadBuild.sustainedDPS, 6);
    });
});
