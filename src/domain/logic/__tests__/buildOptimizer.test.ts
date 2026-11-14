import { describe, expect, it } from "vitest";
import { getArcanesByWeaponCategory, getArcanesForWeapon } from "../../catalog/arcaneCatalog";
import type { ArcaneEntry } from "../../catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../arcaneEffects";
import { filterBuilderExpertVariants, getModsForWeapon, getStancesForWeapon, type ModEffect, type ModEntry } from "../../catalog/modCatalog";
import { getWeaponCatalog, selectedAttackUsesIncarnonForm, withSelectedAttack } from "../../catalog/weaponCatalog";
import type { WeaponEntry } from "../../catalog/weaponCatalog";
import { emptyEffect } from "../../catalog/modCatalog";
import { assignModsToSlots, debugEvaluateExpectedEncounter, debugScoreBuild, debugScoreExpectedEncounter, explainBuild, getBeamStateSignature, getTargetProfileAssumptions, minimizePolaritiesByCapacity, normalizeOptimizeGoal, optimizeBuild, rankExpectedEncounter } from "../buildOptimizer";
import { computeCapacity, countPolarityChanges } from "../capacityCalc";
import { calculateBuild } from "../damageCalc";
import { quantizeBaseCriticalDamageMultiplier } from "../damageRuleset";

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
    const defaults = [...weapon.polarities];
    while (defaults.length < slotPolarities.length) defaults.push("");
    defaults.push(stancePolarity, "");
    return countPolarityChanges(defaults, [...slotPolarities, stancePolarity, exilusPolarity]);
}

describe("slot-specific Forma accounting", () => {
    it("counts a moved polarity as changes to both physical slots", () => {
        expect(countPolarityChanges(["madurai", ""], ["", "madurai"])).toBe(2);
    });

    it("does not move a weapon polarity to a different slot for free", () => {
        const makeMod = (uniqueName: string, polarity: string): ModEntry => ({
            uniqueName,
            path: uniqueName,
            name: uniqueName,
            compatBucket: "Rifle",
            rawCompatName: "Rifle",
            polarity,
            rarity: "Common",
            drain: 10,
            baseDrain: 10,
            fusionLimit: 0,
            statsLabel: "",
            statsTextByRank: [""],
            effectsByRank: [emptyEffect()],
            effect: emptyEffect(),
            hasDamageEffect: false,
            isAura: false,
            isExilus: false,
            isStance: false,
            incompatibilityGroup: uniqueName,
            compatibilityTags: [],
            incompatibilityTags: [],
        });
        const slotMods = [makeMod("naramon-mod", "naramon"), makeMod("madurai-mod", "madurai")];
        const ranks = [0, 0];
        const capacityConfig = {
            weaponRank: 20,
            hasCatalyst: false,
            masteryRank: 10,
            canOverLevel: false,
        };

        const noForma = minimizePolaritiesByCapacity(["madurai", ""], slotMods, ranks, capacityConfig, [], undefined, 0);
        expect(noForma.mainPolarities).toEqual(["madurai", ""]);
        expect(computeCapacity(
            capacityConfig,
            noForma.mainPolarities.map((polarity) => ({ polarity })),
            slotMods,
            ranks,
        ).overCapacity).toBe(true);

        const oneForma = minimizePolaritiesByCapacity(["madurai", ""], slotMods, ranks, capacityConfig, [], undefined, 1);
        expect(countPolarityChanges(["madurai", ""], oneForma.mainPolarities)).toBe(1);
        expect(computeCapacity(
            capacityConfig,
            oneForma.mainPolarities.map((polarity) => ({ polarity })),
            slotMods,
            ranks,
        ).overCapacity).toBe(false);
    });
});

describe("build optimizer scoring", () => {
    it("requires explicit Warframe armor before considering Primary Bulwark", () => {
        const weapon = makeWeapon();
        const bulwark = getArcanesByWeaponCategory("Primary").find((arcane) => arcane.name === "Primary Bulwark");
        expect(bulwark).toBeTruthy();

        const withoutArmor = optimizeBuild(weapon, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [bulwark!],
            conditionalState: { mode: "initial" },
        });
        expect(withoutArmor.arcane).toBeNull();

        const withArmor = optimizeBuild(weapon, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [bulwark!],
            warframeArmor: 1500,
            conditionalState: { mode: "initial" },
        });
        expect(withArmor.arcane?.name).toBe("Primary Bulwark");
        expect(withArmor.arcaneRank).toBe(5);
        expect(getArcaneEffectAtRank(withArmor.arcane!, withArmor.arcaneRank, 1500, true)?.damageBonus).toBe(5);
    });

    it("requires explicit maximum and current Energy before considering Primary Overcharge", () => {
        const weapon = makeWeapon();
        const overcharge = getArcanesByWeaponCategory("Primary").find((arcane) => arcane.name === "Primary Overcharge");
        expect(overcharge).toBeTruthy();

        const withoutEnergy = optimizeBuild(weapon, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [overcharge!],
            conditionalState: { mode: "initial" },
        });
        expect(withoutEnergy.arcane).toBeNull();

        const withEnergy = optimizeBuild(weapon, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [overcharge!],
            warframeMaxEnergy: 1000,
            warframeEnergyPercent: 100,
            conditionalState: { mode: "initial" },
        });
        expect(withEnergy.arcane?.name).toBe("Primary Overcharge");
        expect(withEnergy.arcaneRank).toBe(5);
        expect(getArcaneEffectAtRank(withEnergy.arcane!, withEnergy.arcaneRank, undefined, true, {
            warframeMaxEnergy: 1000,
            warframeEnergyPercent: 100,
        })?.multishotBonus).toBe(3.5);
    });

    it("applies selected Arcane proc effects through the configured conditional state", () => {
        const primaryDexterity = getArcanesByWeaponCategory("Primary").find((arcane) => arcane.name === "Primary Dexterity");
        expect(primaryDexterity).toBeTruthy();

        const permanentEffect = getArcaneEffectAtRank(primaryDexterity!, 5);
        const modeledEffect = getArcaneEffectAtRank(primaryDexterity!, 5, undefined, true);
        expect(permanentEffect).toBeNull();
        expect(modeledEffect?.conditionalEffects?.[0]?.trigger).toBe("onMeleeKill");

        const weapon = makeWeapon();
        const initial = calculateBuild(weapon, [modeledEffect!], "", { conditionalState: { mode: "initial" } });
        const realistic = calculateBuild(weapon, [modeledEffect!], "", { conditionalState: { mode: "realistic" } });

        expect(initial.modded.totalDamageBonus).toBe(0);
        expect(realistic.modded.totalDamageBonus).toBeGreaterThan(0);
    });

    it("selects Expected TTK arcanes by finite kill time instead of proxy DPS", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100, impact: 100, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 0, radiation: 0, gas: 0, magnetic: 0,
                viral: 0, corrosive: 0, void: 0, tau: 0, true: 0,
            },
            critChance: 0,
            critMultiplier: 1,
            statusChance: 0,
            fireRate: 1,
            magazineSize: 1,
            reloadTime: 1,
        });
        const makeArcane = (name: string, effect: Partial<ModEffect>): ArcaneEntry => ({
            uniqueName: `/Test/Arcane/${name}`,
            name,
            rarity: "Common",
            weaponType: "Primary",
            maxRank: 0,
            statsByRank: [""],
            statsLabel: "",
            baseBonus: "",
            procBonus: "",
            permanentEffectByRank: [effect],
            optimizerEffectByRank: [effect],
        });
        const damageArcane = makeArcane("Damage Threshold", { damageBonus: 0.5 });
        const fireRateArcane = makeArcane("Sustained Rate", { fireRateBonus: 5 });
        const target = { health: 130, shields: 0, overguard: 0, armor: 0 };
        const damageEffect = getArcaneEffectAtRank(damageArcane, 0, undefined, true)!;
        const fireRateEffect = getArcaneEffectAtRank(fireRateArcane, 0, undefined, true)!;

        const proxyDamage = debugScoreBuild(weapon, [], "timeToKill", "", damageEffect, target, { mode: "initial" });
        const proxyFireRate = debugScoreBuild(weapon, [], "timeToKill", "", fireRateEffect, target, { mode: "initial" });
        const exactDamage = debugEvaluateExpectedEncounter(weapon, [], "", target, { mode: "initial" }, damageEffect);
        const exactFireRate = debugEvaluateExpectedEncounter(weapon, [], "", target, { mode: "initial" }, fireRateEffect);

        expect(proxyFireRate).toBeGreaterThan(proxyDamage);
        expect(exactDamage.timeToKillSeconds).not.toBeNull();
        expect(exactFireRate.timeToKillSeconds).not.toBeNull();
        expect(exactDamage.timeToKillSeconds!).toBeLessThan(exactFireRate.timeToKillSeconds!);

        const result = optimizeBuild(weapon, [], "timeToKill", 0, {
            targetFaction: "",
            targetProfileOverride: target,
            optimizeArcane: true,
            arcaneCandidates: [fireRateArcane, damageArcane],
            conditionalState: { mode: "initial" },
        });

        expect(result.arcane?.name).toBe("Damage Threshold");
        expect(result.encounterTimeToKillSeconds).toBe(exactDamage.timeToKillSeconds);
    });

    it("checks every Arcane rank against Expected TTK when inventory is unrestricted", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100, impact: 100, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 0, radiation: 0, gas: 0, magnetic: 0,
                viral: 0, corrosive: 0, void: 0, tau: 0, true: 0,
            },
            critChance: 0,
            critMultiplier: 1,
            statusChance: 0,
            fireRate: 1,
            magazineSize: 1,
            reloadTime: 1,
        });
        const rankVariantArcane: ArcaneEntry = {
            uniqueName: "/Test/Arcane/RankVariant",
            name: "Rank Variant",
            rarity: "Common",
            weaponType: "Primary",
            maxRank: 1,
            statsByRank: ["damage", "fire rate"],
            statsLabel: "",
            baseBonus: "",
            procBonus: "",
            permanentEffectByRank: [{ damageBonus: 0.5 }, { fireRateBonus: 5 }],
            optimizerEffectByRank: [{ damageBonus: 0.5 }, { fireRateBonus: 5 }],
        };
        const target = { health: 130, shields: 0, overguard: 0, armor: 0 };
        const result = optimizeBuild(weapon, [], "timeToKill", 0, {
            targetFaction: "",
            targetProfileOverride: target,
            optimizeArcane: true,
            arcaneCandidates: [rankVariantArcane],
            conditionalState: { mode: "initial" },
        });

        expect(result.arcane?.name).toBe("Rank Variant");
        expect(result.arcaneRank).toBe(0);
        expect(result.encounterTimeToKillSeconds).toBe(0);

        const ownedRankEffect = getArcaneEffectAtRank(rankVariantArcane, 1, undefined, true)!;
        const ownedRankEncounter = debugEvaluateExpectedEncounter(
            weapon,
            [],
            "",
            target,
            { mode: "initial" },
            ownedRankEffect,
        );
        const ownedRankResult = optimizeBuild(weapon, [], "timeToKill", 0, {
            targetFaction: "",
            targetProfileOverride: target,
            optimizeArcane: true,
            arcaneCandidates: [rankVariantArcane],
            ownedArcaneUniqueNames: new Set([rankVariantArcane.uniqueName]),
            ownedArcaneMaxRankByUniqueName: { [rankVariantArcane.uniqueName]: 1 },
            conditionalState: { mode: "initial" },
        });

        expect(ownedRankResult.arcaneRank).toBe(1);
        expect(ownedRankResult.encounterTimeToKillSeconds).toBe(ownedRankEncounter.timeToKillSeconds);
    });

    it("stops Expected TTK refinement when the build already kills on its first attack", () => {
        const result = optimizeBuild(makeWeapon({
            critChance: 0,
            statusChance: 0,
            fireRate: 1,
            magazineSize: 1,
            reloadTime: 1,
        }), [], "timeToKill", 0, {
            targetFaction: "",
            targetProfileOverride: { health: 1, shields: 0, overguard: 0, armor: 0 },
            optimizeArcane: true,
            arcaneCandidates: getArcanesByWeaponCategory("Primary"),
            conditionalState: { mode: "initial" },
        });

        expect(result.encounterTimeToKillSeconds).toBe(0);
        expect(result.encounterCandidatesEvaluated).toBe(1);
        expect(result.arcane).toBeNull();
    });

    it("leaves an arcane slot empty when every candidate has zero objective value", () => {
        const weapon = makeWeapon();
        const zeroValueArcane = getArcanesByWeaponCategory("Primary")
            .find((arcane) => arcane.name === "Primary Plated Round");
        expect(zeroValueArcane).toBeTruthy();

        const result = optimizeBuild(weapon, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [zeroValueArcane!],
            conditionalState: { mode: "initial" },
        });

        expect(result.arcane).toBeNull();
        expect(result.arcaneRank).toBe(0);
    });

    it("applies active Overguard status rules to target assumptions", () => {
        const overguardTarget = getTargetProfileAssumptions("Corpus", {
            health: 100,
            shields: 100,
            overguard: 12,
            armor: 0,
        });
        const normalTarget = getTargetProfileAssumptions("Corpus", {
            health: 100,
            shields: 100,
            overguard: 0,
            armor: 0,
        });

        expect(overguardTarget.statusImmuneTypes).toContain("radiation");
        expect(overguardTarget.statusStackCaps.cold).toBe(4);
        expect(overguardTarget.statusStackCaps.blast).toBeUndefined();
        expect(overguardTarget.crowdControlImmune).toBe(true);
        expect(normalTarget.statusImmuneTypes).not.toContain("radiation");
        expect(normalTarget.statusStackCaps.cold).toBeUndefined();
    });

    it("applies an explicit boss Blast stack cap without changing other status caps", () => {
        const bossTarget = getTargetProfileAssumptions("Grineer", {
            health: 100,
            shields: 0,
            overguard: 0,
            armor: 2700,
            statusStackCaps: { blast: 4 },
        });

        expect(bossTarget.statusStackCaps.blast).toBe(4);
        expect(bossTarget.statusStackCaps.cold).toBeUndefined();
    });

    it("parses sourced weak-point conditions and Hunter Munitions Slash procs", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const mods = getModsForWeapon(weapon!);
        const mod = (name: string) => mods.find((entry) => entry.name === name)!;
        const hunterMunitions = mod("Hunter Munitions");
        const argonScope = mod("Argon Scope");
        const galvanizedScope = mod("Galvanized Scope");

        expect(hunterMunitions.effectsByRank.map((effect) => effect.critAppliesSlashChance)).toEqual([
            0.05, 0.1, 0.15, 0.2, 0.25, 0.3,
        ]);
        expect(hunterMunitions.statsTextByRank.every((text) => /chance to apply Slash on Critical/i.test(text))).toBe(true);
        expect(hunterMunitions.statsLabel).toMatch(/chance to apply Slash on Critical/i);
        const hunterStats = calculateBuild(weapon!, [hunterMunitions.effect]).modded;
        expect(hunterStats.extraProcsPerShot.slash).toBeCloseTo(
            weapon!.multishot * Math.min(1, weapon!.critChance) * 0.3,
            8,
        );
        expect(debugScoreBuild(weapon!, [hunterMunitions.effect], "scaling", "Grineer"))
            .toBeGreaterThan(debugScoreBuild(weapon!, [], "scaling", "Grineer"));

        const argonEffect = argonScope.effect.conditionalEffects[0];
        expect(argonEffect).toMatchObject({
            trigger: "onWeakPointHit",
            durationSeconds: 9,
            requiresAiming: true,
            stats: { critChanceBonus: 1.35 },
        });
        const initialCritChance = calculateBuild(weapon!, [argonScope.effect], "", {
            conditionalState: { mode: "initial" },
        }).modded.critChance;
        const realisticCritChance = calculateBuild(weapon!, [argonScope.effect], "", {
            conditionalState: { mode: "realistic" },
        }).modded.critChance;
        expect(realisticCritChance - initialCritChance).toBeCloseTo(
            weapon!.critChance * 1.35 * 0.55 * 0.75,
            8,
        );

        const weakPointHit = galvanizedScope.effect.conditionalEffects.find((effect) => effect.trigger === "onWeakPointHit");
        const weakPointKill = galvanizedScope.effect.conditionalEffects.find((effect) => effect.trigger === "onWeakPointKill");
        expect(weakPointHit).toMatchObject({
            durationSeconds: 12,
            requiresAiming: true,
            maxStacks: 1,
            stats: { critChanceBonus: 1.2 },
        });
        expect(weakPointKill).toMatchObject({
            durationSeconds: 12,
            requiresAiming: true,
            maxStacks: 5,
            stats: { critChanceBonus: 0.4 },
        });

        const cedo = getWeaponCatalog().find((entry) => entry.name === "Cedo");
        expect(cedo).toBeTruthy();
        const nanoApplicator = getModsForWeapon(cedo!).find((entry) => entry.name === "Nano-Applicator");
        expect(nanoApplicator?.effect.conditionalEffects[0]).toMatchObject({
            trigger: "onAbilityCast",
            durationSeconds: 9,
            requiresAiming: true,
            stats: { statusChanceBonus: 0.9 },
        });
        const baseStatusChance = calculateBuild(cedo!, [], "", {
            conditionalState: { mode: "initial" },
        }).modded.statusChance;
        const realisticStatusChance = calculateBuild(cedo!, [nanoApplicator!.effect], "", {
            conditionalState: { mode: "realistic" },
        }).modded.statusChance;
        const stackedStatusChance = calculateBuild(cedo!, [nanoApplicator!.effect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded.statusChance;
        expect(realisticStatusChance).toBeCloseTo(baseStatusChance, 8);
        expect(stackedStatusChance - baseStatusChance).toBeCloseTo(baseStatusChance * 0.9, 8);
    });

    it("scores Galvanized Reflex Initial Combo stacks for heavy attacks", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Broken War");
        expect(weapon).toBeDefined();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const heavySlam = withSelectedAttack(weapon!, attackIndex);
        const galvanizedReflex = getModsForWeapon(weapon!).find((entry) => entry.name === "Galvanized Reflex");
        expect(galvanizedReflex).toBeDefined();

        const initial = debugScoreBuild(heavySlam, [galvanizedReflex!.effect], "burst", "", null, null, {
            mode: "initial",
        });
        const fullyStacked = debugScoreBuild(heavySlam, [galvanizedReflex!.effect], "burst", "", null, null, {
            mode: "fullyStacked",
        });

        expect(fullyStacked).toBeGreaterThan(initial);
    });

    it("parses Condition Overload as an additive per-status melee damage effect", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Broken War");
        expect(weapon).toBeTruthy();
        const conditionOverload = getModsForWeapon(weapon!).find((entry) => entry.name === "Condition Overload");
        expect(conditionOverload).toBeTruthy();
        expect(conditionOverload!.hasDamageEffect).toBe(true);
        expect(conditionOverload!.effect.conditionOverloadDamagePerStatusBonus).toBeCloseTo(0.8, 10);

        const normalIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const slamIndex = weapon!.attacks.findIndex((attack) => attack.name === "Slam Attack");
        expect(normalIndex).toBeGreaterThanOrEqual(0);
        expect(slamIndex).toBeGreaterThanOrEqual(0);
        const normal = calculateBuild(withSelectedAttack(weapon!, normalIndex), [conditionOverload!.effect]).modded;
        const slamWeapon = withSelectedAttack(weapon!, slamIndex);
        const slam = calculateBuild(slamWeapon, [conditionOverload!.effect]).modded;

        expect(normal.conditionOverloadApplies).toBe(true);
        expect(normal.conditionOverloadStatusTypes).toBeGreaterThan(0);
        expect(normal.conditionOverloadDamageMultiplier).toBeGreaterThan(1);
        const normalAttackWeapon = withSelectedAttack(weapon!, normalIndex);
        const noExternalScore = debugScoreBuild(
            normalAttackWeapon,
            [conditionOverload!.effect],
            "burst",
            "",
            null,
            null,
            { mode: "initial", externalStatusTypeCount: 0 },
        );
        const externallyPrimedScore = debugScoreBuild(
            normalAttackWeapon,
            [conditionOverload!.effect],
            "burst",
            "",
            null,
            null,
            { mode: "initial", externalStatusTypeCount: 3 },
        );
        expect(externallyPrimedScore).toBeGreaterThan(noExternalScore);
        expect(slamWeapon.selectedAttackIgnoresConditionOverload).toBe(true);
        expect(slam.conditionOverloadApplies).toBe(false);
        expect(slam.conditionOverloadDamageMultiplier).toBe(1);

        const glaive = getWeaponCatalog().find((entry) => entry.name === "Glaive Prime");
        expect(glaive).toBeTruthy();
        const regularThrow = glaive!.attacks.findIndex((attack) => attack.name === "Throw");
        const chargedThrow = glaive!.attacks.findIndex((attack) => attack.name === "Charged Throw");
        expect(withSelectedAttack(glaive!, regularThrow).selectedAttackIgnoresConditionOverload).toBe(false);
        expect(withSelectedAttack(glaive!, chargedThrow).selectedAttackIgnoresConditionOverload).toBe(true);
        expect(withSelectedAttack(glaive!, regularThrow).selectedAttackUsesMeleeComboMultiplier).toBe(false);
        expect(withSelectedAttack(glaive!, chargedThrow).selectedAttackUsesMeleeComboMultiplier).toBe(true);
        for (const [index, attack] of glaive!.attacks.entries()) {
            if (/^charged throw\b/i.test(attack.name)) {
                expect(withSelectedAttack(glaive!, index).selectedAttackUsesMeleeComboMultiplier).toBe(true);
            }
        }
    });

    it("scores Nukor Microwave independently of weapon conditional state", () => {
        const variants = getWeaponCatalog().filter((weapon) =>
            weapon.name === "Nukor" || weapon.name === "Kuva Nukor",
        );
        expect(variants).toHaveLength(2);
        const perStatusBonus = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };

        for (const weapon of variants) {
            const attackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
            const selected = withSelectedAttack(weapon, attackIndex);
            const noMicrowave = { ...selected, uniqueStatusProcs: undefined };
            const steadyWithMicrowave = debugScoreBuild(
                selected,
                [perStatusBonus],
                "burst",
                "Corpus",
                null,
                null,
                { mode: "realistic" },
            );
            const steadyWithoutMicrowave = debugScoreBuild(
                noMicrowave,
                [perStatusBonus],
                "burst",
                "Corpus",
                null,
                null,
                { mode: "realistic" },
            );
            expect(steadyWithMicrowave).toBeGreaterThan(steadyWithoutMicrowave);

            const initialWithMicrowave = debugScoreBuild(
                selected,
                [perStatusBonus],
                "burst",
                "Corpus",
                null,
                null,
                { mode: "initial" },
            );
            const initialWithoutMicrowave = debugScoreBuild(
                noMicrowave,
                [perStatusBonus],
                "burst",
                "Corpus",
                null,
                null,
                { mode: "initial" },
            );
            expect(initialWithMicrowave).toBeGreaterThan(initialWithoutMicrowave);
            expect(initialWithMicrowave).toBeCloseTo(steadyWithMicrowave, 12);
        }
    });

    it("includes the selected heavy attack's active combo tier in exact objective scoring", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Broken War");
        expect(weapon).toBeTruthy();
        const normal = withSelectedAttack(weapon!, weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"));
        const heavy = withSelectedAttack(weapon!, weapon!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack"));
        const state = (meleeComboMultiplier: number) => ({ mode: "realistic" as const, meleeComboMultiplier });

        const normalAt1x = debugScoreBuild(normal, [], "burst", "Grineer", null, null, state(1));
        const normalAt5x = debugScoreBuild(normal, [], "burst", "Grineer", null, null, state(5));
        const heavyAt1x = debugScoreBuild(heavy, [], "burst", "Grineer", null, null, state(1));
        const heavyAt5x = debugScoreBuild(heavy, [], "burst", "Grineer", null, null, state(5));

        expect(normalAt5x).toBeCloseTo(normalAt1x, 8);
        expect(heavyAt5x).toBeCloseTo(heavyAt1x * 5, 8);
    });

    it("keeps Berserker Fury's conditional melee attack speed in the modeled effect", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Broken War");
        expect(weapon).toBeTruthy();
        const berserkerFury = getModsForWeapon(weapon!).find((entry) => entry.name === "Berserker Fury" && entry.fusionLimit === 5);
        expect(berserkerFury).toBeTruthy();
        expect(berserkerFury!.hasDamageEffect).toBe(true);
        expect(berserkerFury!.effect.conditionalEffects?.[0]?.stats.attackSpeedBonus).toBeCloseTo(0.35, 10);
        expect(berserkerFury!.effect.conditionalEffects).toContainEqual(expect.objectContaining({
            trigger: "onMeleeKill",
            durationSeconds: 10,
            maxStacks: 2,
            stats: { attackSpeedBonus: expect.any(Number) },
        }));

        const initial = calculateBuild(weapon!, [berserkerFury!.effect], "", {
            conditionalState: { mode: "initial" },
        }).modded.fireRate;
        const fullyStacked = calculateBuild(weapon!, [berserkerFury!.effect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded.fireRate;
        expect(initial).toBeCloseTo(weapon!.fireRate, 8);
        expect(fullyStacked).toBeGreaterThan(initial);
    });

    it("excludes mods with no parsed effect from automatic candidates", () => {
        const weapon = makeWeapon();
        const unsupported: ModEntry = {
            uniqueName: "/Test/UnsupportedEffect",
            path: "/Test/UnsupportedEffect",
            name: "Unsupported Effect",
            compatBucket: "Rifle",
            rawCompatName: "Rifle",
            polarity: "",
            rarity: "Common",
            drain: 2,
            baseDrain: 2,
            fusionLimit: 0,
            statsLabel: "+100% fictional direct damage",
            statsTextByRank: ["+100% fictional direct damage"],
            effectsByRank: [emptyEffect()],
            effect: emptyEffect(),
            hasDamageEffect: false,
            isAura: false,
            isExilus: false,
            isStance: false,
            incompatibilityGroup: "/Test/UnsupportedEffect",
            compatibilityTags: [],
            incompatibilityTags: [],
        };
        const result = optimizeBuild(weapon, [unsupported], "burst", 1, { allowForma: false });

        expect(result.mods).toEqual([]);
        expect(result.slots.filter(Boolean)).toHaveLength(0);
    });

    it("matches brute-force scoring for a small capacity-constrained candidate set", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 50,
                puncture: 25,
                slash: 25,
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
        });
        const definitions = [
            ["Base Damage", 9, { ...emptyEffect(), damageBonus: 0.4 }],
            ["Multishot", 9, { ...emptyEffect(), multishotBonus: 0.6 }],
            ["Critical Chance", 6, { ...emptyEffect(), critChanceBonus: 0.5 }],
            ["Critical Damage", 6, { ...emptyEffect(), critMultBonus: 1.5 }],
            ["Heat", 3, { ...emptyEffect(), heatBonus: 0.7 }],
        ] as const;
        const candidates: ModEntry[] = definitions.map(([name, drain, effect]) => ({
            uniqueName: `/Test/Oracle/${name}`,
            path: `/Test/Oracle/${name}`,
            name,
            compatBucket: "Rifle",
            rawCompatName: "Rifle",
            polarity: "",
            rarity: "Common",
            drain,
            baseDrain: drain,
            fusionLimit: 0,
            statsLabel: "",
            statsTextByRank: [""],
            effectsByRank: [effect],
            effect,
            hasDamageEffect: true,
            isAura: false,
            isExilus: false,
            isStance: false,
            incompatibilityGroup: name,
            compatibilityTags: [],
            incompatibilityTags: [],
        }));
        const capacityConfig = {
            weaponRank: 0,
            hasCatalyst: false,
            masteryRank: 0,
            canOverLevel: false,
        };
        const capacityLimit = 15;
        let exhaustiveBest = debugScoreBuild(weapon, [], "burst", "");
        const visit = (ordered: ModEntry[], usedDrain: number) => {
            exhaustiveBest = Math.max(
                exhaustiveBest,
                debugScoreBuild(
                    weapon,
                    ordered.map((mod) => mod.effect),
                    "burst",
                    "",
                ),
            );
            if (ordered.length >= 3) return;
            for (const candidate of candidates) {
                if (ordered.some((mod) => mod.incompatibilityGroup === candidate.incompatibilityGroup)) continue;
                const nextDrain = usedDrain + candidate.baseDrain;
                if (nextDrain > capacityLimit) continue;
                visit([...ordered, candidate], nextDrain);
            }
        };
        visit([], 0);

        const result = optimizeBuild(weapon, candidates, "burst", 3, {
            capacityConfig,
            slotPolarities: ["", "", ""],
            defaultSlotPolarities: ["", "", ""],
            allowCatalyst: false,
            allowForma: false,
            optimizeExilus: false,
            optimizeArcane: false,
        });
        const optimizedScore = debugScoreBuild(
            weapon,
            result.slots.map((mod, index) => mod ? mod.effectsByRank[result.slotRanks[index]] ?? mod.effect : null),
            "burst",
            "",
        );

        expect(result.capacityValid).toBe(true);
        expect(new Set(result.mods.map((mod) => mod.incompatibilityGroup)).size).toBe(result.mods.length);
        expect(optimizedScore).toBeCloseTo(exhaustiveBest, 8);
        expect(computeCapacity(
            capacityConfig,
            result.slotPolarities.map((polarity) => ({ polarity })),
            result.slots,
            result.slotRanks,
        ).overCapacity).toBe(false);
    });

    it("preserves future-relevant elemental order in Forma beam search", () => {
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
            critMultiplier: 1,
            statusChance: 0,
            fireRate: 2,
            magazineSize: 100,
            reloadTime: 0,
        });
        const mods = ([
            ["Heat Order", "heatBonus"],
            ["Electricity Order", "electricityBonus"],
            ["Cold Order", "coldBonus"],
            ["Toxin Order", "toxinBonus"],
        ] as const).map(([name, key]): ModEntry => {
            const effect = { ...emptyEffect(), [key]: 1.2 };
            return {
                uniqueName: `/Test/${name}`,
                path: `/Test/${name}`,
                name,
                compatBucket: "Rifle",
                rawCompatName: "Rifle",
                polarity: "",
                rarity: "Common",
                drain: 0,
                baseDrain: 0,
                fusionLimit: 0,
                statsLabel: "",
                statsTextByRank: [""],
                effectsByRank: [effect],
                effect,
                hasDamageEffect: true,
                isAura: false,
                isExilus: false,
                isStance: false,
                incompatibilityGroup: name,
                compatibilityTags: [],
                incompatibilityTags: [],
            };
        });
        const target = { health: 1_000_000, shields: 0, overguard: 0, armor: 0 };
        const goal = "burst" as const;
        const permutations = (values: ModEntry[]): ModEntry[][] => {
            if (values.length <= 1) return [values];
            return values.flatMap((value, index) =>
                permutations([...values.slice(0, index), ...values.slice(index + 1)])
                    .map((tail) => [value, ...tail]),
            );
        };
        const ranked = (mod: ModEntry) => mod.fusionLimit;
        const heatColdFirst = [mods[0], mods[2], mods[1], mods[3]];
        const heatElectricityFirst = [mods[0], mods[1], mods[2], mods[3]];
        expect(getBeamStateSignature(heatColdFirst, heatColdFirst.map(ranked), true))
            .not.toBe(getBeamStateSignature(heatElectricityFirst, heatElectricityFirst.map(ranked), true));

        const conditionalColdEffect = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 1,
                stats: { coldBonus: 0.5 },
            }],
        };
        const conditionalCold: ModEntry = {
            ...mods[0],
            uniqueName: "/Test/Conditional Cold",
            name: "Conditional Cold",
            incompatibilityGroup: "Conditional Cold",
            effect: conditionalColdEffect,
            effectsByRank: [conditionalColdEffect],
        };
        const directThenConditional = [mods[0], conditionalCold, mods[3]];
        const directThenDirect = [mods[0], mods[3], conditionalCold];
        expect(getBeamStateSignature(directThenConditional, directThenConditional.map(ranked), true))
            .not.toBe(getBeamStateSignature(directThenDirect, directThenDirect.map(ranked), true));

        const orderIndependentEffect = { ...emptyEffect(), damageBonus: 0.2 };
        const orderIndependent = {
            ...mods[0],
            uniqueName: "/Test/Order Independent",
            name: "Order Independent",
            incompatibilityGroup: "Order Independent",
            effect: orderIndependentEffect,
            effectsByRank: [orderIndependentEffect],
        };
        expect(getBeamStateSignature([mods[0], orderIndependent], [0, 0], true))
            .toBe(getBeamStateSignature([orderIndependent, mods[0]], [0, 0], true));
        expect(getBeamStateSignature([mods[0], orderIndependent], [0, 0], false))
            .not.toBe(getBeamStateSignature([orderIndependent, mods[0]], [0, 0], false));

        const faction = "Infested Deimos";
        const scoreOrder = (order: ModEntry[]) => debugScoreBuild(
            weapon,
            order.map((mod) => mod.effectsByRank[mod.fusionLimit] ?? mod.effect),
            goal,
            faction,
            null,
            target,
            { mode: "initial" },
        );
        const bestLegalOrderScore = Math.max(...permutations(mods).map(scoreOrder));
        const result = optimizeBuild(weapon, mods, goal, mods.length, {
            targetFaction: faction,
            targetProfileOverride: target,
            conditionalState: { mode: "initial" },
            allowForma: true,
        });
        const selected = result.slots.flatMap((mod, index) => mod
            ? [mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect]
            : []);
        const optimizedScore = debugScoreBuild(weapon, selected, goal, faction, null, target, { mode: "initial" });
        expect(result.mods.map((mod) => mod.uniqueName).sort())
            .toEqual(mods.map((mod) => mod.uniqueName).sort());
        expect(optimizedScore).toBeCloseTo(bestLegalOrderScore, 7);
    });

    it("reassigns non-element mods across polarities before pruning Forma builds", () => {
        const weapon = makeWeapon({
            baseSlotCount: 2,
            polarities: ["naramon", "madurai"],
        });
        const effect = { ...emptyEffect(), damageBonus: 0.5 };
        const makeCapacityMod = (name: string, polarity: string): ModEntry => ({
            uniqueName: `/Test/${name}`,
            path: `/Test/${name}`,
            name,
            compatBucket: "Rifle",
            rawCompatName: "Rifle",
            polarity,
            rarity: "Common",
            drain: 8,
            baseDrain: 8,
            fusionLimit: 0,
            statsLabel: "",
            statsTextByRank: [""],
            effectsByRank: [effect],
            effect,
            hasDamageEffect: true,
            isAura: false,
            isExilus: false,
            isStance: false,
            incompatibilityGroup: name,
            compatibilityTags: [],
            incompatibilityTags: [],
        });
        const mods = [
            makeCapacityMod("A Madurai", "madurai"),
            makeCapacityMod("Z Naramon", "naramon"),
        ];
        const defaults = ["naramon", "madurai"];
        const result = optimizeBuild(weapon, mods, "burst", 2, {
            allowForma: true,
            maxFormaCount: 0,
            slotPolarities: defaults,
            defaultSlotPolarities: defaults,
            capacityConfig: {
                weaponRank: 0,
                hasCatalyst: false,
                masteryRank: 0,
                canOverLevel: false,
            },
        });

        expect(result.capacityValid).toBe(true);
        expect(result.mods.map((mod) => mod.name).sort()).toEqual(["A Madurai", "Z Naramon"]);
        expect(result.slotPolarities).toEqual(defaults);
    });

    it("normalizes a burst weapon's base shot rate from catalog burst metadata", () => {
        const burstonPrime = getWeaponCatalog().find((weapon) => weapon.name === "Burston Prime");
        expect(burstonPrime).toBeTruthy();
        expect(burstonPrime?.fireRate).toBeCloseTo(9.375, 6);
        expect(burstonPrime?.burstCount).toBe(3);
        expect(burstonPrime?.burstCycleRate).toBe(5);
        expect(burstonPrime?.burstDelay).toBeCloseTo(0.06, 6);
    });

    it("covers instantaneous, simultaneous, and attack-specific burst modes", () => {
        const catalog = getWeaponCatalog();
        const quartakk = catalog.find((weapon) => weapon.name === "Quartakk");
        const kuvaQuartakk = catalog.find((weapon) => weapon.name === "Kuva Quartakk");
        const perigalePrime = catalog.find((weapon) => weapon.name === "Perigale Prime");
        const sepulcrum = catalog.find((weapon) => weapon.name === "Sepulcrum");
        const harpak = catalog.find((weapon) => weapon.name === "Harpak");
        const paracyst = catalog.find((weapon) => weapon.name === "Paracyst");

        expect(quartakk?.burstCount).toBe(4);
        expect(quartakk?.burstDelay).toBe(0);
        expect(kuvaQuartakk?.attacks[0]?.trigger).toBe("Auto");
        expect(kuvaQuartakk?.attacks[1]?.trigger).toBe("Burst");
        expect(kuvaQuartakk?.attacks[1]?.burstCount).toBe(4);
        expect(kuvaQuartakk?.attacks[1]?.burstDelay).toBe(0);
        expect(withSelectedAttack(kuvaQuartakk!, 1).trigger).toBe("Burst");
        expect(calculateBuild(withSelectedAttack(kuvaQuartakk!, 1), []).modded.fireRate).toBeCloseTo(6.32, 6);
        expect(perigalePrime?.burstCount).toBe(4);
        expect(perigalePrime?.burstDelay).toBe(0.04);
        expect(calculateBuild(withSelectedAttack(perigalePrime!, 0), []).modded.fireRate).toBeCloseTo(4 / (1 / 2 + 3 * 0.04), 6);
        expect(sepulcrum?.burstCount).toBe(2);
        expect(sepulcrum?.burstDelay).toBe(0);
        expect(sepulcrum?.attacks[1]?.burstCount).toBe(2);
        expect(harpak?.attacks[0]?.burstCount).toBe(3);
        expect(harpak?.attacks[0]?.burstDelay).toBe(0.1);
        expect(harpak?.attacks[1]?.trigger).toBe("Semi");
        expect(paracyst?.attacks[0]?.burstCount).toBe(3);
        expect(paracyst?.attacks[0]?.burstDelay).toBe(0.05);
        expect(paracyst?.attacks[1]?.trigger).toBe("Charge");
        expect(paracyst?.attacks[1]?.chargeTime).toBe(0.25);
        expect(sepulcrum?.attacks[2]?.trigger).toBe("Special");

        const perigalePrimeStats = calculateBuild(withSelectedAttack(perigalePrime!, 0), []).modded;
        expect(perigalePrimeStats.magazineSize).toBe(16);
        expect(perigalePrimeStats.shotsPerMag).toBe(16);
    });

    it("has burst count and delay metadata for every catalog attack marked Burst", () => {
        const unsupported = getWeaponCatalog().flatMap((weapon) => weapon.attacks
            .filter((attack) => attack.trigger?.toLowerCase() === "burst")
            .filter((attack) => attack.burstCount === undefined || attack.burstDelay === undefined)
            .map((attack) => `${weapon.name}: ${attack.name}`));

        expect(unsupported).toEqual([]);
    });

    it("maps legacy stat-focused goals onto the two damage objectives", () => {
        expect(normalizeOptimizeGoal("damage")).toBe("burst");
        expect(normalizeOptimizeGoal("crit")).toBe("burst");
        expect(normalizeOptimizeGoal("status")).toBe("burst");
        expect(normalizeOptimizeGoal("scaling")).toBe("scaling");
        expect(normalizeOptimizeGoal("timeToKill")).toBe("timeToKill");
        expect(rankExpectedEncounter(0.8, 100)).toBeGreaterThan(rankExpectedEncounter(0.9, 1000));
        expect(rankExpectedEncounter(590, 1)).toBeGreaterThan(rankExpectedEncounter(null, 100000));
    });

    it("ranks Expected TTK builds with the same finite encounter that reports their result", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const wantedNames = new Set([
            "Serration",
            "Split Chamber",
            "Vital Sense",
            "Hellfire",
            "Hunter Munitions",
            "Malignant Force",
        ]);
        const candidates = getModsForWeapon(weapon!).filter((mod) =>
            wantedNames.has(mod.name) && !/\/Beginner\//i.test(mod.uniqueName),
        );
        expect(new Set(candidates.map((mod) => mod.name))).toEqual(wantedNames);

        const target = {
            health: 30000,
            shields: 12000,
            overguard: 0,
            armor: 1200,
            toxinBypassesShields: true,
        };
        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 22,
            canOverLevel: weapon!.canOverLevel,
        };
        const options = {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState: { mode: "realistic" as const },
            capacityConfig,
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            allowForma: true,
            maxFormaCount: 2,
        };
        const result = optimizeBuild(weapon!, candidates, "timeToKill", 4, options);
        const screeningResult = optimizeBuild(weapon!, candidates, "scaling", 4, options);
        const effects = result.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = result.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        });
        const independentlyScored = debugScoreExpectedEncounter(
            weapon!,
            effects,
            "Grineer",
            target,
            options.conditionalState,
        );
        const detailedEncounter = debugEvaluateExpectedEncounter(
            weapon!,
            effects,
            "Grineer",
            target,
            options.conditionalState,
        );
        const screeningEffects = screeningResult.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = screeningResult.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        });
        const screeningEncounter = debugScoreExpectedEncounter(
            weapon!,
            screeningEffects,
            "Grineer",
            target,
            options.conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(result.encounterScore).toBeCloseTo(independentlyScored.damagePerSecond, 8);
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(detailedEncounter.damagePerSecond).toBe(independentlyScored.damagePerSecond);
        expect(detailedEncounter.encounter?.damagePerSecond).toBe(independentlyScored.damagePerSecond);
        expect(detailedEncounter.encounter?.timeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(result.encounterCandidatesEvaluated).toBeGreaterThan(0);
        expect(result.slots.filter(Boolean)).toHaveLength(4);
        expect(result.encounterTimeToKillSeconds).not.toBeNull();
        expect(result.encounterTimeToKillSeconds!).toBeLessThanOrEqual(screeningEncounter.timeToKillSeconds!);
    });

    it("retains elemental alternatives that a sustained-damage proxy would prune", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const trackedNames = new Set([
            "Malignant Force",
            "Rime Rounds",
            "Thermite Rounds",
            "Primed Bane Of Grineer",
            "Spectral Serration",
            "Galvanized Aptitude",
            "Vile Acceleration",
            "Bladed Rounds",
            "High Voltage",
            "Galvanized Scope",
        ].map((name) => name.toLowerCase()));
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!)).filter((mod) =>
            trackedNames.has(mod.name.toLowerCase()),
        );
        expect(new Set(candidates.map((mod) => mod.name.toLowerCase()))).toEqual(trackedNames);

        const arcane = getArcanesForWeapon(weapon!).find((entry) => entry.name === "Primary Overcharge");
        expect(arcane).toBeTruthy();
        const target = {
            health: 83_818,
            shields: 0,
            overguard: 0,
            armor: 2_700,
            toxinBypassesShields: true,
        };
        const conditionalState = { mode: "fullyStacked" as const };
        const result = optimizeBuild(weapon!, candidates, "timeToKill", 8, {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState,
            capacityConfig: {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            },
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            allowForma: true,
            maxFormaCount: 3,
            optimizeArcane: true,
            arcaneCandidates: [arcane!],
            warframeMaxEnergy: 1_000,
            warframeEnergyPercent: 100,
            optimizeExilus: false,
            buildForAttack: weapon!.attacks[0] ?? null,
        });
        const selectedNames = result.slots.flatMap((mod) => mod ? [mod.name] : []);
        const effects = result.slots.flatMap((mod, index) => mod
            ? [mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect]
            : []);
        const arcaneEffect = result.arcane
            ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, undefined, false, {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: 100,
            })
            : null;
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, 0),
            effects,
            "Grineer",
            target,
            conditionalState,
            arcaneEffect,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(selectedNames).toContain("High Voltage");
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(result.encounterTimeToKillSeconds).toBeLessThan(0.77);
    });

    it("matches the exhaustive finite-encounter optimum for a five-mod legal subset", () => {
        const weapon = makeWeapon({
            fireRate: 4,
            magazineSize: 40,
            reloadTime: 1.5,
        });
        const definitions = [
            ["Damage", { ...emptyEffect(), damageBonus: 0.4 }],
            ["Multishot", { ...emptyEffect(), multishotBonus: 0.6 }],
            ["Critical", { ...emptyEffect(), critChanceBonus: 0.5 }],
            ["Heat", { ...emptyEffect(), heatBonus: 0.7, statusChanceBonus: 0.2 }],
            ["Viral", { ...emptyEffect(), coldBonus: 0.4, toxinBonus: 0.4, statusChanceBonus: 0.5 }],
        ] as const;
        const candidates: ModEntry[] = definitions.map(([name, effect]) => ({
            uniqueName: `/Test/ExpectedTTK/${name}`,
            path: `/Test/ExpectedTTK/${name}`,
            name,
            compatBucket: "Rifle",
            rawCompatName: "Rifle",
            polarity: "",
            rarity: "Common",
            drain: 1,
            baseDrain: 1,
            fusionLimit: 0,
            statsLabel: "",
            statsTextByRank: [""],
            effectsByRank: [effect],
            effect,
            hasDamageEffect: true,
            isAura: false,
            isExilus: false,
            isStance: false,
            incompatibilityGroup: name,
            compatibilityTags: [],
            incompatibilityTags: [],
        }));
        const target = {
            health: 30000,
            shields: 80000,
            overguard: 0,
            armor: 2400,
            toxinBypassesShields: true,
        };
        const targetFaction = "Grineer";
        const betterEncounter = (
            candidate: ReturnType<typeof debugScoreExpectedEncounter>,
            incumbent: ReturnType<typeof debugScoreExpectedEncounter>,
        ) => candidate.timeToKillSeconds !== null
            ? incumbent.timeToKillSeconds === null || candidate.timeToKillSeconds < incumbent.timeToKillSeconds - 1e-9
            : incumbent.timeToKillSeconds === null && candidate.damagePerSecond > incumbent.damagePerSecond + 1e-9;

        let exhaustiveBest = debugScoreExpectedEncounter(weapon, [], targetFaction, target);
        const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
            const score = debugScoreExpectedEncounter(
                weapon,
                ordered.map((mod) => mod.effect),
                targetFaction,
                target,
            );
            if (betterEncounter(score, exhaustiveBest)) exhaustiveBest = score;
            if (ordered.length === 3) return;
            for (const candidate of remaining) {
                enumerate(
                    remaining.filter((entry) => entry !== candidate),
                    [...ordered, candidate],
                );
            }
        };
        enumerate(candidates, []);

        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 30,
            canOverLevel: false,
        };
        const result = optimizeBuild(weapon, candidates, "timeToKill", 3, {
            targetFaction,
            targetProfileOverride: target,
            capacityConfig,
            slotPolarities: ["", "", ""],
            defaultSlotPolarities: ["", "", ""],
            allowForma: false,
            optimizeExilus: false,
            optimizeArcane: false,
        });
        const optimizedScore = debugScoreExpectedEncounter(
            weapon,
            result.slots.flatMap((mod, index) => mod ? [mod.effectsByRank[result.slotRanks[index]] ?? mod.effect] : []),
            targetFaction,
            target,
        );

        expect(result.capacityValid).toBe(true);
        expect(result.slots.filter(Boolean)).toHaveLength(3);
        expect(optimizedScore.timeToKillSeconds).toBe(exhaustiveBest.timeToKillSeconds);
        expect(optimizedScore.damagePerSecond).toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
    });

    it("matches exhaustive Expected TTK optima across five weapon attack types", { timeout: 60000 }, () => {
        const scenarios = [
            {
                weaponName: "Perigale Prime",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 50000, shields: 0, overguard: 0, armor: 1800 },
                modNames: ["Serration", "Split Chamber", "Vital Sense", "Malignant Force"],
            },
            {
                weaponName: "Cedo",
                attackName: "Glaive Radial Attack",
                targetFaction: "Grineer",
                targetProfileOverride: {
                    health: 22000,
                    shields: 1500,
                    overguard: 3500,
                    armor: 1400,
                    statusStackCaps: { cold: 4 },
                },
                modNames: ["Primed Point Blank", "Hell's Chamber", "Toxic Barrage", "Frigid Blast"],
            },
            {
                weaponName: "Phantasma Prime",
                attackName: "Plasma Bomb Explosion",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 18000, shields: 0, overguard: 0, armor: 1300 },
                modNames: ["Primed Point Blank", "Hell's Chamber", "Toxic Barrage", "Frigid Blast"],
            },
            {
                weaponName: "Acrid",
                attackName: "Normal Attack",
                targetFaction: "Corpus",
                targetProfileOverride: {
                    health: 7200,
                    shields: 10800,
                    overguard: 0,
                    armor: 0,
                    toxinBypassesShields: true,
                },
                modNames: ["Hornet Strike", "Barrel Diffusion", "Galvanized Diffusion", "Pistol Pestilence"],
            },
            {
                weaponName: "Gram Prime",
                attackName: "Heavy Slam Attack",
                targetFaction: "Grineer",
                targetProfileOverride: {
                    health: 28000,
                    shields: 0,
                    overguard: 2500,
                    armor: 1100,
                    statusStackCaps: { cold: 4 },
                },
                modNames: ["Primed Pressure Point", "Blood Rush", "Organ Shatter", "Condition Overload"],
            },
        ] as const;
        const slotCount = 3;
        const betterEncounter = (
            candidate: ReturnType<typeof debugScoreExpectedEncounter>,
            incumbent: ReturnType<typeof debugScoreExpectedEncounter>,
        ) => candidate.timeToKillSeconds !== null
            ? incumbent.timeToKillSeconds === null ||
                candidate.timeToKillSeconds < incumbent.timeToKillSeconds - 1e-9 ||
                (Math.abs(candidate.timeToKillSeconds - incumbent.timeToKillSeconds) <= 1e-9 &&
                    candidate.damagePerSecond > incumbent.damagePerSecond + 1e-9)
            : incumbent.timeToKillSeconds === null && candidate.damagePerSecond > incumbent.damagePerSecond + 1e-9;

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const candidates = scenario.modNames.map((name) => {
                const mod = filterBuilderExpertVariants(getModsForWeapon(weapon!)).find((entry) => entry.name === name);
                expect(mod, `${scenario.weaponName}: ${name}`).toBeTruthy();
                return mod!;
            });
            const attack = scenario.attackName
                ? weapon!.attacks.find((entry) => entry.name === scenario.attackName)
                : undefined;
            expect(scenario.attackName ? attack : true, `${scenario.weaponName}: attack`).toBeTruthy();
            const scoringWeapon = attack
                ? withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack))
                : weapon!;
            const slotPolarities = Array.from({ length: slotCount }, (_, index) => weapon!.polarities[index] ?? "");
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            let exhaustiveBest = debugScoreExpectedEncounter(
                scoringWeapon,
                [],
                scenario.targetFaction,
                scenario.targetProfileOverride,
            );
            const enumerate = (remaining: typeof candidates, ordered: typeof candidates) => {
                const ranks = ordered.map((mod) => mod.fusionLimit);
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, false);
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === ordered.length && !capacity.overCapacity) {
                    const effects = placement.slotMods.map((mod, index) => {
                        if (!mod) return null;
                        const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                        return mod.effectsByRank[rank] ?? mod.effect;
                    });
                    const score = debugScoreExpectedEncounter(
                        scoringWeapon,
                        effects,
                        scenario.targetFaction,
                        scenario.targetProfileOverride,
                    );
                    if (betterEncounter(score, exhaustiveBest)) exhaustiveBest = score;
                }
                if (ordered.length >= slotCount) return;
                for (let index = 0; index < remaining.length; index++) {
                    const candidate = remaining[index];
                    if (ordered.some((mod) =>
                        mod.uniqueName === candidate.uniqueName ||
                        (candidate.incompatibilityGroup && mod.incompatibilityGroup === candidate.incompatibilityGroup)
                    )) continue;
                    enumerate(
                        [...remaining.slice(0, index), ...remaining.slice(index + 1)],
                        [...ordered, candidate],
                    );
                }
            };
            enumerate(candidates, []);

            const optimized = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.targetFaction,
                targetProfileOverride: scenario.targetProfileOverride,
                buildForAttack: attack,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                optimizeExilus: false,
                optimizeArcane: false,
            });
            const optimizedEffects = optimized.slots.map((mod, index) => {
                if (!mod) return null;
                const rank = optimized.slotRanks[index] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = debugScoreExpectedEncounter(
                scoringWeapon,
                optimizedEffects,
                scenario.targetFaction,
                scenario.targetProfileOverride,
            );

            expect(optimized.capacityValid, scenario.weaponName).toBe(true);
            expect(
                optimizedScore.timeToKillSeconds,
                `${scenario.weaponName}: optimizer TTK should match the exhaustive legal subset`,
            ).toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, scenario.weaponName)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("scores Toxin as Shield-bypassing damage while retaining the Overguard pool", () => {
        const toxinWeapon = makeWeapon({
            damage: {
                total: 100, impact: 0, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 100,
                blast: 0, radiation: 0, gas: 0, magnetic: 0,
                viral: 0, corrosive: 0, void: 0, tau: 0, true: 0,
            },
            critChance: 0,
            statusChance: 0,
            fireRate: 1,
            magazineSize: 10,
            reloadTime: 1,
        });
        const effectDamageWeapon = {
            ...toxinWeapon,
            damage: { ...toxinWeapon.damage, toxin: 0, impact: 100 },
        };
        const withoutOverguard = { health: 100, shields: 900, overguard: 0 };
        const withOverguard = { health: 100, shields: 800, overguard: 100 };
        const toxinWithoutOverguard = debugScoreBuild(
            toxinWeapon, [], "scaling", "Corpus", null, withoutOverguard,
        );
        const toxinWithOverguard = debugScoreBuild(
            toxinWeapon, [], "scaling", "Corpus", null, withOverguard,
        );
        const toxinAgainstException = debugScoreBuild(
            toxinWeapon, [], "scaling", "Corpus", null, {
                ...withoutOverguard,
                toxinBypassesShields: false,
            },
        );
        const impactWithoutOverguard = debugScoreBuild(
            effectDamageWeapon, [], "scaling", "Corpus", null, withoutOverguard,
        );
        const impactWithOverguard = debugScoreBuild(
            effectDamageWeapon, [], "scaling", "Corpus", null, withOverguard,
        );

        expect(toxinWithoutOverguard).toBeGreaterThan(toxinWithOverguard);
        expect(toxinAgainstException).toBeCloseTo(impactWithoutOverguard, 8);
        expect(impactWithOverguard).toBeCloseTo(impactWithoutOverguard, 8);

        const coldWeapon = {
            ...toxinWeapon,
            damage: { ...toxinWeapon.damage, toxin: 0, cold: 100 },
        };
        const shieldHeavyTarget = { health: 100, shields: 900, overguard: 0, armor: 0 };
        const corpusColdScore = debugScoreBuild(
            coldWeapon, [], "scaling", "Corpus", null, shieldHeavyTarget,
        );
        const techrotColdScore = debugScoreBuild(
            coldWeapon, [], "scaling", "Techrot", null, shieldHeavyTarget,
        );
        expect(techrotColdScore).toBeLessThan(corpusColdScore);
        expect(techrotColdScore).toBeGreaterThan(corpusColdScore * 0.5);
    });

    it("matches an exhaustive legal-build optimum on a small candidate pool", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const wantedNames = new Set(["Serration", "Split Chamber", "Vital Sense", "Hellfire"]);
        const candidates = getModsForWeapon(weapon!).filter((mod) => wantedNames.has(mod.name) && !/\/Beginner\//i.test(mod.uniqueName));
        expect(new Set(candidates.map((mod) => mod.name))).toEqual(wantedNames);

        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 22,
            canOverLevel: weapon!.canOverLevel,
        };
        let exhaustiveBest = Number.NEGATIVE_INFINITY;
        const enumerate = (remaining: typeof candidates, ordered: typeof candidates) => {
            const ranks = ordered.map((mod) => mod.fusionLimit);
            const placement = assignModsToSlots(ordered, ranks, weapon!.polarities, 3, false);
            const capacity = computeCapacity(
                capacityConfig,
                placement.resultPolarities.map((polarity) => ({ polarity })),
                placement.slotMods,
                placement.slotRanks,
            );
            if (placement.slotMods.filter(Boolean).length === ordered.length && !capacity.overCapacity) {
                const effects = ordered.map((mod) => mod.effectsByRank[mod.fusionLimit] ?? mod.effect);
                const score = debugScoreBuild(weapon!, effects, "burst", "Grineer");
                exhaustiveBest = Math.max(exhaustiveBest, score);
            }
            if (ordered.length === 3) return;
            for (let index = 0; index < remaining.length; index++) {
                enumerate(
                    [...remaining.slice(0, index), ...remaining.slice(index + 1)],
                    [...ordered, remaining[index]],
                );
            }
        };
        enumerate(candidates, []);

        const optimized = optimizeBuild(weapon!, candidates, "burst", 3, {
            targetFaction: "Grineer",
            capacityConfig,
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
        });
        const optimizedEffects = optimized.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = optimized.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        });
        const optimizedScore = debugScoreBuild(weapon!, optimizedEffects, "burst", "Grineer");

        expect(optimized.capacityValid).toBe(true);
        expect(optimizedScore).toBeCloseTo(exhaustiveBest, 8);
    });

    it("does not lose the selected objective when candidates or Forma options expand", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const compatible = getModsForWeapon(weapon!);
        const baseNames = new Set(["Serration", "Split Chamber", "Vital Sense", "Hellfire"]);
        const baseCandidates = compatible.filter((mod) => baseNames.has(mod.name) && !/\/Beginner\//i.test(mod.uniqueName));
        const addedMod = compatible.find((mod) => mod.name === "Point Strike" && !/\/Beginner\//i.test(mod.uniqueName));
        expect(baseCandidates).toHaveLength(baseNames.size);
        expect(addedMod).toBeTruthy();

        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 22,
            canOverLevel: weapon!.canOverLevel,
        };
        const score = (result: ReturnType<typeof optimizeBuild>) => debugScoreBuild(
            weapon!,
            result.slots.map((mod, index) => {
                if (!mod) return null;
                const rank = result.slotRanks[index] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            }),
            "burst",
            "Grineer",
        );
        const commonOptions = {
            targetFaction: "Grineer",
            capacityConfig,
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
        };

        const withoutExtraChoice = optimizeBuild(weapon!, baseCandidates, "burst", 3, commonOptions);
        const withExtraChoice = optimizeBuild(weapon!, [...baseCandidates, addedMod!], "burst", 3, commonOptions);
        const withForma = optimizeBuild(weapon!, baseCandidates, "burst", 3, {
            ...commonOptions,
            allowForma: true,
            maxFormaCount: 3,
        });

        expect(withoutExtraChoice.capacityValid).toBe(true);
        expect(withExtraChoice.capacityValid).toBe(true);
        expect(withForma.capacityValid).toBe(true);
        expect(score(withExtraChoice)).toBeGreaterThanOrEqual(score(withoutExtraChoice) - 1e-8);
        expect(score(withForma)).toBeGreaterThanOrEqual(score(withoutExtraChoice) - 1e-8);
    });

    it("matches nine-candidate five-slot exhaustive legal-build oracles across representative attack modes", { timeout: 60000 }, () => {
        const scenarios = [
            {
                weaponName: "Braton Prime",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 4500, shields: 0, overguard: 0, armor: 950 },
                modNames: ["Serration", "Split Chamber", "Vital Sense", "Hellfire", "Malignant Force", "Point Strike", "Stormbringer", "Heavy Caliber", "Hunter Munitions"],
            },
            {
                weaponName: "Cedo",
                attackName: "Glaive Radial Attack",
                targetFaction: "Grineer",
                targetProfileOverride: {
                    health: 18000,
                    shields: 0,
                    overguard: 5000,
                    armor: 1300,
                    statusImmuneTypes: ["radiation"],
                    statusStackCaps: { cold: 4 },
                },
                modNames: ["Primed Point Blank", "Hell's Chamber", "Toxic Barrage", "Frigid Blast", "Primed Charged Shell", "Vigilante Armaments", "Galvanized Savvy", "Blaze", "Primed Ravage"],
            },
            {
                weaponName: "Phantasma Prime",
                attackName: "Plasma Bomb Explosion",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 12000, shields: 0, overguard: 0, armor: 1200 },
                modNames: ["Primed Point Blank", "Hell's Chamber", "Shotgun Barrage", "Frigid Blast", "Toxic Barrage", "Vigilante Armaments", "Galvanized Savvy", "Blaze", "Primed Ravage"],
            },
            {
                weaponName: "Phantasma Prime",
                attackName: "Beam",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 65000, shields: 0, overguard: 0, armor: 2400 },
                modNames: ["Primed Point Blank", "Hell's Chamber", "Shotgun Barrage", "Frigid Blast", "Toxic Barrage", "Vigilante Armaments", "Galvanized Savvy", "Blaze", "Primed Ravage"],
            },
            {
                weaponName: "Laetum",
                targetFaction: "Corpus",
                targetProfileOverride: { health: 7200, shields: 10800, overguard: 0, armor: 0, toxinBypassesShields: true },
                modNames: ["Hornet Strike", "Barrel Diffusion", "Lethal Torrent", "Primed Heated Charge", "Pistol Pestilence", "Galvanized Diffusion", "Primed Target Cracker", "Galvanized Shot", "Primed Pistol Gambit"],
            },
            {
                weaponName: "Rubico Prime",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 9000, shields: 0, overguard: 0, armor: 1800 },
                modNames: ["Serration", "Split Chamber", "Vital Sense", "Point Strike", "Stormbringer", "Primed Cryo Rounds", "Malignant Force", "Heavy Caliber", "Hunter Munitions"],
            },
            {
                weaponName: "Epitaph",
                attackName: "Charged Shot",
                targetFaction: "Corpus",
                targetProfileOverride: { health: 12500, shields: 25000, overguard: 0, armor: 0, toxinBypassesShields: true },
                modNames: ["Hornet Strike", "Barrel Diffusion", "Lethal Torrent", "Primed Heated Charge", "Pistol Pestilence", "Galvanized Diffusion", "Primed Target Cracker", "Deep Freeze", "Hemorrhage"],
            },
            {
                weaponName: "Acrid",
                attackName: "Normal Attack",
                targetFaction: "Corpus",
                targetProfileOverride: { health: 7200, shields: 10800, overguard: 0, armor: 0, toxinBypassesShields: true },
                modNames: ["Hornet Strike", "Barrel Diffusion", "Galvanized Diffusion", "Lethal Torrent", "Semi-Pistol Cannonade", "Primed Expel Corpus", "Pistol Elementalist", "Sure Shot", "Toxic Sequence"],
            },
            {
                weaponName: "Hystrix Prime",
                attackName: "Fire Quill",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 18000, shields: 0, overguard: 0, armor: 1300 },
                modNames: ["Hornet Strike", "Barrel Diffusion", "Galvanized Diffusion", "Lethal Torrent", "Primed Heated Charge", "Pistol Pestilence", "Ice Storm", "Pistol Elementalist", "Augur Seeker"],
            },
            {
                weaponName: "Broken War",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 45000, shields: 0, overguard: 0, armor: 1800 },
                modNames: ["Primed Pressure Point", "Blood Rush", "Weeping Wounds", "Organ Shatter", "Condition Overload", "Primed Reach", "Gladiator Might", "Shocking Touch", "Vicious Frost"],
            },
            {
                weaponName: "Gram Prime",
                attackName: "Heavy Slam Attack",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 4000, shields: 0, overguard: 2000, armor: 500, statusStackCaps: { cold: 4 } },
                modNames: ["Primed Pressure Point", "Blood Rush", "Weeping Wounds", "Organ Shatter", "Condition Overload", "Primed Reach", "Gladiator Might", "Killing Blow", "Amalgam Organ Shatter"],
            },
        ] as const;

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const candidates = scenario.modNames.map((name) => {
                const mod = filterBuilderExpertVariants(getModsForWeapon(weapon!)).find((entry) => entry.name === name);
                expect(mod, scenario.weaponName + ": " + name).toBeTruthy();
                return mod!;
            });
            const attack = scenario.attackName
                ? weapon!.attacks.find((entry) => entry.name === scenario.attackName)
                : undefined;
            expect(scenario.attackName ? attack : true, scenario.weaponName + ": attack").toBeTruthy();
            const scoringWeapon = attack
                ? withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack))
                : weapon!;
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            let exhaustiveBest = debugScoreBuild(scoringWeapon, [], "burst", scenario.targetFaction, null, scenario.targetProfileOverride);
            let exhaustiveBestNames: string[] = [];
            const enumerate = (remaining: typeof candidates, ordered: typeof candidates) => {
                const ranks = ordered.map((mod) => mod.fusionLimit);
                const placement = assignModsToSlots(ordered, ranks, weapon!.polarities, 5, false);
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === ordered.length && !capacity.overCapacity) {
                    const effects = placement.slotMods.map((mod, index) => {
                        if (!mod) return null;
                        const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                        return mod.effectsByRank[rank] ?? mod.effect;
                    });
                    const score = debugScoreBuild(
                        scoringWeapon,
                        effects,
                        "burst",
                        scenario.targetFaction,
                        null,
                        scenario.targetProfileOverride,
                    );
                    if (score > exhaustiveBest) {
                        exhaustiveBest = score;
                        exhaustiveBestNames = placement.slotMods.flatMap((mod) => mod ? [mod.name] : []);
                    }
                }
                if (ordered.length >= 5) return;
                for (let index = 0; index < remaining.length; index++) {
                    const candidate = remaining[index];
                    if (ordered.some((mod) =>
                        mod.uniqueName === candidate.uniqueName ||
                        (candidate.incompatibilityGroup && mod.incompatibilityGroup === candidate.incompatibilityGroup)
                    )) continue;
                    enumerate(
                        [...remaining.slice(0, index), ...remaining.slice(index + 1)],
                        [...ordered, candidate],
                    );
                }
            };
            enumerate(candidates, []);

            const optimized = optimizeBuild(weapon!, candidates, "burst", 5, {
                targetFaction: scenario.targetFaction,
                targetProfileOverride: scenario.targetProfileOverride,
                buildForAttack: attack,
                capacityConfig,
                slotPolarities: weapon!.polarities,
                defaultSlotPolarities: weapon!.polarities,
                optimizeExilus: false,
                optimizeArcane: false,
            });
            const optimizedEffects = optimized.slots.map((mod, index) => {
                if (!mod) return null;
                const rank = optimized.slotRanks[index] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = debugScoreBuild(
                scoringWeapon,
                optimizedEffects,
                "burst",
                scenario.targetFaction,
                null,
                scenario.targetProfileOverride,
            );

            expect(optimized.capacityValid, scenario.weaponName).toBe(true);
            expect(optimizedScore, `${scenario.weaponName}: best proxy ${exhaustiveBestNames.join(", ")}; optimizer ${optimized.mods.map((mod) => mod.name).join(", ")}`).toBeCloseTo(exhaustiveBest, 7);
        }
    });

    it("scores the cold Phantasma Beam magazine lower while preserving warmed sustained output", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Phantasma Prime");
        expect(weapon).toBeTruthy();
        const beamIndex = weapon!.attacks.findIndex((attack) => attack.name === "Beam");
        const beam = withSelectedAttack(weapon!, beamIndex);
        const noRampBeam = { ...beam, selectedAttackDamageRamp: undefined };

        const burstWithRamp = debugScoreBuild(beam, [], "burst", "Grineer");
        const burstWithoutRamp = debugScoreBuild(noRampBeam, [], "burst", "Grineer");
        const scalingWithRamp = debugScoreBuild(beam, [], "scaling", "Grineer");
        const scalingWithoutRamp = debugScoreBuild(noRampBeam, [], "scaling", "Grineer");

        expect(burstWithRamp).toBeCloseTo(burstWithoutRamp * (3331 / 3960), 7);
        expect(scalingWithRamp).toBeCloseTo(scalingWithoutRamp, 7);
    });

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

    it("enforces incompatibility between standard and flawed variants with different catalog parents", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Torid");
        expect(weapon).toBeTruthy();

        const aptitudeVariants = getModsForWeapon(weapon!).filter((mod) => mod.name === "Rifle Aptitude");
        const standard = aptitudeVariants.find((mod) => !/\/(Beginner|Intermediate|Expert)\//i.test(mod.path));
        const flawed = aptitudeVariants.find((mod) => /\/Beginner\//i.test(mod.path));
        expect(standard).toBeTruthy();
        expect(flawed).toBeTruthy();
        expect(standard!.incompatibilityGroup).toBe(flawed!.incompatibilityGroup);

        const result = optimizeBuild(weapon!, [standard!, flawed!], "burst", 2, {
            allowCatalyst: false,
            allowForma: false,
            optimizeExilus: false,
            optimizeArcane: false,
        });

        expect(result.mods.filter((mod) => /Rifle Aptitude/.test(mod.name))).toHaveLength(1);
        expect(result.capacityValid).toBe(true);
    });

    it("excludes Semi-Rifle Cannonade from the Torid because its Incarnon form is held", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Torid");
        expect(weapon).toBeTruthy();
        expect(weapon!.trigger).toBe("Semi");
        expect(weapon!.attacks.find((attack) => attack.name === "Incarnon Form")?.trigger).toBe("Held");
        expect(getModsForWeapon(weapon!).some((mod) => mod.name === "Semi-Rifle Cannonade")).toBe(false);
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

    it("includes delayed single-target Blast proc damage in burst and sustained objectives", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 100, radiation: 0, gas: 0, magnetic: 0, viral: 0,
                corrosive: 0, void: 0, tau: 0, true: 0,
            },
            statusChance: 1,
            critChance: 0,
            fireRate: 1,
            magazineSize: 1,
            reloadTime: 0,
        });
        const target = { health: 1000, shields: 0, overguard: 0, armor: 0 };
        const score = debugScoreBuild(weapon, [], "burst", "Grineer", null, target);
        const sustained = debugScoreBuild(weapon, [], "scaling", "Grineer", null, target);

        expect(calculateBuild(weapon, []).modded.blastExpectedExpiryDamagePerShot).toBeCloseTo(30, 5);
        expect(score).toBeCloseTo(130, 5);
        expect(sustained).toBeCloseTo(130, 5);
    });

    it("keeps Blast cap radial out of single-target scoring unless neighbors are configured", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 100, radiation: 0, gas: 0, magnetic: 0, viral: 0,
                corrosive: 0, void: 0, tau: 0, true: 0,
            },
            statusChance: 1,
            critChance: 0,
            fireRate: 20,
            magazineSize: 100,
            reloadTime: 0,
        });
        const target = { health: 1000, shields: 0, overguard: 0, armor: 0 };

        // Direct DPS is 2,000; the afflicted target receives 30 damage per
        // stack at 20 procs/s. The default score has no configured neighbors.
        expect(debugScoreBuild(weapon, [], "burst", "Grineer", null, target)).toBeCloseTo(2600, 4);
    });

    it("scores expected Blast cap radial damage against configured nearby targets", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 100, radiation: 0, gas: 0, magnetic: 0, viral: 0,
                corrosive: 0, void: 0, tau: 0, true: 0,
            },
            statusChance: 1,
            critChance: 0,
            fireRate: 100,
            magazineSize: 1000,
            reloadTime: 0,
        });
        const target = {
            health: 100000,
            shields: 0,
            overguard: 0,
            armor: 0,
            statusStackCaps: { blast: 2 },
        };
        const stats = calculateBuild(weapon, []).modded;
        const singleTargetScore = debugScoreBuild(weapon, [], "burst", "", null, target);
        const packScore = debugScoreBuild(weapon, [], "burst", "", null, {
            ...target,
            nearbyBlastEnemyCount: 2,
        });
        const expectedCapRadialRate = (stats.procRatePerSecondByType.blast ?? 0) *
            stats.blastStackHitDamagePerProc * 3 * 2;

        expect(packScore - singleTargetScore).toBeCloseTo(expectedCapRadialRate, 3);
    });

    it("keeps single-target Blast score independent of a target-specific cap", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 100, radiation: 0, gas: 0, magnetic: 0, viral: 0,
                corrosive: 0, void: 0, tau: 0, true: 0,
            },
            statusChance: 1,
            critChance: 0,
            fireRate: 4,
            magazineSize: 100,
            reloadTime: 0,
        });

        // Direct DPS is 400; the afflicted target still receives 30 damage
        // per stack at 4 procs/s. The neighbor-only radial is excluded.
        expect(debugScoreBuild(weapon, [], "burst", "Grineer", null, {
            health: 1000,
            shields: 0,
            overguard: 0,
            armor: 0,
            statusStackCaps: { blast: 4 },
        })).toBeCloseTo(520, 4);
    });

    it("scores Electric and Gas status ticks against explicitly configured nearby targets", () => {
        const target = { health: 100000, shields: 0, overguard: 0, armor: 0 };
        const weaponFor = (type: "electricity" | "gas" | "slash") => makeWeapon({
            damage: {
                total: 100,
                impact: 0, puncture: 0, slash: type === "slash" ? 100 : 0,
                heat: 0, cold: 0, electricity: type === "electricity" ? 100 : 0, toxin: 0,
                blast: 0, radiation: 0, gas: type === "gas" ? 100 : 0, magnetic: 0, viral: 0,
                corrosive: 0, void: 0, tau: 0, true: 0,
            },
            critChance: 0,
            statusChance: 1,
            fireRate: 1,
            magazineSize: 10,
            reloadTime: 0,
        });

        for (const type of ["electricity", "gas", "slash"] as const) {
            const weapon = weaponFor(type);
            const expectedDotRate = calculateBuild(weapon, []).modded.dotDpsByType[type] ?? 0;
            const singleTargetScore = debugScoreBuild(weapon, [], "burst", "", null, target);
            const packScore = debugScoreBuild(weapon, [], "burst", "", null, {
                ...target,
                nearbyEnemyCount: 2,
            });

            if (type === "slash") {
                expect(packScore).toBeCloseTo(singleTargetScore, 8);
            } else {
                expect(packScore - singleTargetScore).toBeCloseTo(expectedDotRate * 2, 5);
            }
        }
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

    it("uses the documented kill uptime and partial-stack estimate for conditional direct damage", () => {
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
        expect(stats.directDamagePerStatusBonus).toBeCloseTo(0.504, 6);
        expect(stats.directDamagePerStatusMultiplier).toBeCloseTo(1.504, 6);
        expect(stats.totalDamage).toBeCloseTo(150.4, 6);
        expect(stats.averageShotDamage).toBeCloseTo(150.4, 6);
    });

    it("uses one conditional-state estimate for both burst and sustained objectives", () => {
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
        const unconditionedBurstScore = debugScoreBuild(weapon, [emptyEffect()], "burst", "grineer");

        expect(burstScore).toBeGreaterThan(scalingScore);
        expect(burstScore).toBeGreaterThan(unconditionedBurstScore);
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

    it("reports the exact normalized pool and immunity assumptions used for scoring", () => {
        const target = getTargetProfileAssumptions("Corpus", {
            health: 500,
            shields: 200,
            overguard: 100,
            armor: 1200,
            toxinBypassesShields: false,
            statusImmuneTypes: ["heat", "viral"],
        });

        expect(target).toMatchObject({
            armor: 1200,
            health: 500,
            shields: 200,
            overguard: 100,
            effectiveHealth: 800,
            healthShare: 0.625,
            shieldShare: 0.25,
            overguardShare: 0.125,
            toxinBypassesShields: false,
            grouped: false,
            crowdControlImmune: true,
        });
        expect(new Set(target.statusImmuneTypes)).toEqual(new Set(["heat", "viral", "radiation"]));
    });

    it("explains main-mod gains on top of fixed effects and the selected arcane", () => {
        const weapon = makeWeapon();
        const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Serration");
        expect(mod).toBeTruthy();
        const fixedEffect = { ...emptyEffect(), critChanceBonus: 0.5 };
        const arcaneEffect = { ...emptyEffect(), damageBonus: 1.2 };
        const rank = mod!.fusionLimit;
        const modEffect = mod!.effectsByRank[rank] ?? mod!.effect;

        const explanation = explainBuild(
            weapon,
            [mod!],
            [rank],
            "burst",
            "",
            undefined,
            undefined,
            undefined,
            { baseEffects: [fixedEffect], arcaneEffect, arcaneName: "Primary Merciless", arcaneRank: 5 },
        );

        const scoreWithoutArcane = debugScoreBuild(weapon, [fixedEffect, modEffect], "burst", "", null);
        expect(explanation.arcaneStep).toMatchObject({
            name: "Primary Merciless",
            rank: 5,
            statBefore: scoreWithoutArcane,
        });
        expect(explanation.arcaneStep!.statAfter).toBeCloseTo(
            debugScoreBuild(weapon, [fixedEffect, modEffect], "burst", "", arcaneEffect),
            8,
        );
        expect(explanation.arcaneStep!.delta).toBeCloseTo(
            explanation.arcaneStep!.statAfter - explanation.arcaneStep!.statBefore,
            8,
        );

        expect(explanation.steps[0].statBefore).toBeCloseTo(
            debugScoreBuild(weapon, [fixedEffect], "burst", "", arcaneEffect),
            8,
        );
        expect(explanation.steps[0].statAfter).toBeCloseTo(
            debugScoreBuild(weapon, [fixedEffect, modEffect], "burst", "", arcaneEffect),
            8,
        );
        expect(explanation.winningEdge).toContain("Largest leave-one-out gains");
        expect(explanation.comparisonNote).toContain("do not prove a global optimum");
    });

    it("measures each mod against the complete build with that mod removed", () => {
        const weapon = makeWeapon();
        const mods = ["Serration", "Split Chamber"].map((name) => {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === name);
            expect(mod, `${name} should be available for the test rifle`).toBeTruthy();
            return mod!;
        });
        const ranks = mods.map((mod) => mod.fusionLimit);
        const effects = mods.map((mod, index) => mod.effectsByRank[ranks[index]] ?? mod.effect);
        const fullScore = debugScoreBuild(weapon, effects, "burst", "");
        const explanation = explainBuild(weapon, mods, ranks, "burst");

        expect(explanation.steps).toHaveLength(2);
        for (const [index, step] of explanation.steps.entries()) {
            const counterfactualEffects = effects.filter((_, effectIndex) => effectIndex !== index);
            const scoreWithoutMod = debugScoreBuild(weapon, counterfactualEffects, "burst", "");
            expect(step.statBefore).toBeCloseTo(scoreWithoutMod, 8);
            expect(step.statAfter).toBeCloseTo(fullScore, 8);
            expect(step.delta).toBeCloseTo(fullScore - scoreWithoutMod, 8);
        }
        expect(explanation.comparisonNote).toContain("one mod removed");
        expect(explanation.comparisonNote).toContain("do not prove a global optimum");
    });

    it("names status damage, duration, and punch-through effects in build explanations", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime")!;
        expect(weapon).toBeTruthy();
        const findMod = (name: string) => {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === name);
            expect(mod, `${name} should be available for the test rifle`).toBeTruthy();
            return mod!;
        };
        const mods = [findMod("Rifle Elementalist"), findMod("Continuous Misery")];
        const ranks = mods.map((mod) => mod.fusionLimit);
        const explanation = explainBuild(weapon, mods, ranks, "burst");

        expect(explanation.steps[0].why).toContain("+90% status damage");
        expect(explanation.steps[0].why).toContain("+0.6 punch-through");
        expect(explanation.steps[1].why).toContain("+100% status duration");
    });

    it("uses entered target pools and immunities when scoring a custom profile", () => {
        const weapon = makeWeapon({
            damage: {
                ...makeWeapon().damage,
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                toxin: 0,
                void: 100,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
        });
        const effects = [emptyEffect()];
        const healthScore = debugScoreBuild(weapon, effects, "burst", "", null, {
            health: 1000,
            shields: 0,
            overguard: 0,
            armor: 0,
        });
        const overguardScore = debugScoreBuild(weapon, effects, "burst", "", null, {
            health: 0,
            shields: 0,
            overguard: 1000,
            armor: 0,
        });
        const viralWeapon = makeWeapon({
            damage: {
                ...makeWeapon().damage,
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                toxin: 0,
                viral: 100,
            },
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
        });
        const viralTarget = { health: 1000, shields: 0, overguard: 0, armor: 0 };
        const viralScore = debugScoreBuild(viralWeapon, effects, "burst", "", null, viralTarget);
        const immuneViralScore = debugScoreBuild(viralWeapon, effects, "burst", "", null, {
            ...viralTarget,
            statusImmuneTypes: ["viral"],
        });

        expect(overguardScore).toBeGreaterThan(healthScore);
        expect(immuneViralScore).toBeLessThan(viralScore);
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
        const toxinPackage = { ...emptyEffect(), toxinBonus: 1 };

        const magneticScore = debugScoreBuild(weapon, [magneticPackage], "burst", "narmer");
        const toxinScore = debugScoreBuild(weapon, [toxinPackage], "burst", "narmer");

        expect(toxinScore).toBeGreaterThan(magneticScore);
    });

    it("does not count magnetic as an affecting status on shieldless grineer targets", () => {
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

    it("does not spend a status-gated preview calculation for initial-state scoring", () => {
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
            statusChance: 1,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 10,
        });
        const viralPrimer = { ...emptyEffect(), viralBonus: 1 };
        const viralConditional = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHit" as const,
                durationSeconds: 6,
                requiresAiming: false,
                maxStacks: 1,
                requiredStatusType: "viral" as const,
                stats: { damageBonus: 1.2 },
            }],
        };
        const initial = { mode: "initial" as const };
        const baselineScore = debugScoreBuild(weapon, [viralPrimer], "burst", "Corpus", null, null, initial);
        const gatedScore = debugScoreBuild(weapon, [viralPrimer, viralConditional], "burst", "Corpus", null, null, initial);

        expect(gatedScore).toBeCloseTo(baselineScore, 10);
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

    it("invalidates a cached custom-target score context when the target is edited", () => {
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
            statusChance: 0,
            critChance: 0,
            critMultiplier: 1,
            fireRate: 1,
        });
        const target = { armor: 0, health: 10000, shields: 0, overguard: 0 };
        const unarmoredScore = debugScoreBuild(weapon, [emptyEffect()], "burst", "", null, target);

        target.armor = 2700;
        const armoredScore = debugScoreBuild(weapon, [emptyEffect()], "burst", "", null, target);

        expect(armoredScore).toBeLessThan(unarmoredScore);
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

    it("scores optimized arcanes against final refined builds across weapon classes", { timeout: 60000 }, () => {
        const scenarios = [
            { weaponName: "Braton Prime", targetFaction: "Grineer" },
            { weaponName: "Cedo", targetFaction: "Grineer" },
            { weaponName: "Laetum", targetFaction: "Corpus" },
            { weaponName: "Broken War", targetFaction: "Grineer" },
        ];

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();

            const result = optimizeBuild(weapon!, null, "burst", 8, {
                targetFaction: scenario.targetFaction,
                capacityConfig: {
                    weaponRank: 30,
                    hasCatalyst: true,
                    masteryRank: 30,
                    canOverLevel: weapon!.canOverLevel,
                },
                slotPolarities: weapon!.polarities,
                defaultSlotPolarities: weapon!.polarities,
                allowCatalyst: true,
                allowForma: true,
                maxFormaCount: 3,
                optimizeExilus: true,
                optimizeArcane: true,
                buildForAttack: weapon!.attacks[0],
            });

            const effects = result.slots.map((mod, index) =>
                mod ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect : null,
            );
            if (result.exilusMod) {
                effects.push(result.exilusMod.effectsByRank[result.exilusRank] ?? result.exilusMod.effect);
            }
            const scoreWithArcane = (effect: Partial<ModEffect> | null | undefined) =>
                debugScoreBuild(weapon!, effects, "burst", scenario.targetFaction, effect ?? null);

            let bestScore = scoreWithArcane(null);
            for (const arcane of getArcanesForWeapon(weapon!)) {
                for (let rank = 0; rank <= arcane.maxRank; rank++) {
                    const effect = getArcaneEffectAtRank(arcane, rank, undefined, true);
                    if (!effect || Object.keys(effect).length === 0) continue;
                    bestScore = Math.max(bestScore, scoreWithArcane(effect));
                }
            }

            const chosenEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, undefined, true)
                : null;
            expect(scoreWithArcane(chosenEffect), scenario.weaponName).toBeCloseTo(bestScore, 6);
            expect(result.capacityValid, scenario.weaponName).toBe(true);
        }
    });

    it("matches a bounded exhaustive joint mod-and-arcane optimum", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const names = ["Serration", "Split Chamber", "Vital Sense", "Malignant Force", "Rime Rounds", "Point Strike"];
        const catalogMods = filterBuilderExpertVariants(getModsForWeapon(weapon!));
        const candidates = names.map((name) => {
            const mod = catalogMods.find((entry) => entry.name === name);
            expect(mod, name).toBeTruthy();
            return mod!;
        });
        const arcanes = getArcanesForWeapon(weapon!);
        const targetFaction = "Grineer";
        const targetProfileOverride = undefined;
        const slotCount = 4;
        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 30,
            canOverLevel: weapon!.canOverLevel,
        };
        const score = (effects: (ModEffect | null)[], arcane: (typeof arcanes)[number] | null, rank: number) =>
            debugScoreBuild(
                weapon!,
                effects,
                "burst",
                targetFaction,
                arcane ? getArcaneEffectAtRank(arcane, rank, 1500, true) : null,
                targetProfileOverride,
                { mode: "initial" },
            );

        let exhaustiveBest = score([], null, 0);
        const enumerate = (remaining: typeof candidates, ordered: typeof candidates) => {
            const ranks = ordered.map((mod) => mod.fusionLimit);
            const placement = assignModsToSlots(ordered, ranks, weapon!.polarities, slotCount, false);
            const capacity = computeCapacity(
                capacityConfig,
                placement.resultPolarities.map((polarity) => ({ polarity })),
                placement.slotMods,
                placement.slotRanks,
            );
            if (placement.slotMods.filter(Boolean).length === ordered.length && !capacity.overCapacity) {
                const effects = placement.slotMods.map((mod, index) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exhaustiveBest = Math.max(exhaustiveBest, score(effects, null, 0));
                for (const arcane of arcanes) {
                    for (let rank = 0; rank <= arcane.maxRank; rank++) {
                        if (!getArcaneEffectAtRank(arcane, rank, 1500, true)) continue;
                        exhaustiveBest = Math.max(exhaustiveBest, score(effects, arcane, rank));
                    }
                }
            }
            if (ordered.length >= slotCount) return;
            for (let index = 0; index < remaining.length; index++) {
                const candidate = remaining[index];
                if (ordered.some((mod) =>
                    mod.uniqueName === candidate.uniqueName ||
                    (candidate.incompatibilityGroup && mod.incompatibilityGroup === candidate.incompatibilityGroup)
                )) continue;
                enumerate(
                    [...remaining.slice(0, index), ...remaining.slice(index + 1)],
                    [...ordered, candidate],
                );
            }
        };
        enumerate(candidates, []);

        const result = optimizeBuild(weapon!, candidates, "burst", slotCount, {
            targetFaction,
            capacityConfig,
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            optimizeExilus: false,
            optimizeArcane: true,
            arcaneCandidates: arcanes,
            warframeArmor: 1500,
            conditionalState: { mode: "initial" },
        });
        const resultEffects = result.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = result.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        });

        expect(result.capacityValid).toBe(true);
        expect(result.arcane?.name).toBe("Primary Bulwark");
        expect(result.arcaneRank).toBe(5);
        expect(score(resultEffects, result.arcane, result.arcaneRank)).toBeCloseTo(exhaustiveBest, 7);
    });

    it("keeps a legal War build and avoids frozen-only arcanes when no Exilus improves its objective", { timeout: 30000 }, () => {
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

        expect(result.exilusMod).toBeNull();
        expect(result.capacityValid).toBe(true);
        expect(result.arcane?.name).not.toBe("Melee Careen");
        expect(
            countFormaLikeUi(weapon!, result.slotPolarities, weapon!.stancePolarity ?? "", result.exilusPolarity),
        ).toBeLessThanOrEqual(5);
    });

    it("does not fill Exilus with movement-only or other unscored utility mods", { timeout: 30000 }, () => {
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

        expect(result.exilusMod).toBeNull();
        expect(result.capacityValid).toBe(true);
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

    it("preserves capacity-feasible slot placement for Cedo's alternate-fire build", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Cedo");
        expect(weapon).toBeTruthy();
        const attack = weapon!.attacks.find((entry) => entry.name === "Glaive Radial Attack");
        expect(attack).toBeTruthy();
        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 30,
            canOverLevel: false,
        };

        const result = optimizeBuild(weapon!, null, "burst", 8, {
            targetFaction: "Grineer",
            capacityConfig,
            slotPolarities: weapon!.polarities,
            defaultSlotPolarities: weapon!.polarities,
            allowCatalyst: true,
            allowForma: true,
            maxFormaCount: 3,
            optimizeExilus: true,
            optimizeArcane: true,
            buildForAttack: attack!,
        });

        const capacity = computeCapacity(
            capacityConfig,
            [...result.slotPolarities.map((polarity) => ({ polarity })), { polarity: result.exilusPolarity }],
            [...result.slots, result.exilusMod],
            [...result.slotRanks, result.exilusMod ? result.exilusRank : 0],
        );
        expect(result.capacityValid).toBe(true);
        expect(capacity.overCapacity).toBe(false);
        expect(countFormaLikeUi(weapon!, result.slotPolarities, "", result.exilusPolarity)).toBeLessThanOrEqual(3);
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
        expect(result.capacityValid).toBe(true);
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
        expect(modNames.some(name => name === "Primed Cryo Rounds" || name === "Cryo Rounds" || name === "Rime Rounds")).toBe(true);
        expect(modNames.some(name => name === "Infected Clip" || name === "Malignant Force")).toBe(true);
        expect(modNames.some(name => name === "Thermite Rounds" || name === "Hellfire")).toBe(true);
        expect(modNames).not.toContain("Radiated Reload");
        expect(result.capacityValid).toBe(true);

        const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack!));
        const optimizedEffects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index]] ?? mod.effect
            : null);
        expect(debugScoreBuild(scoringWeapon, optimizedEffects, "scaling", "Grineer"))
            .toBeGreaterThan(debugScoreBuild(scoringWeapon, [], "scaling", "Grineer"));
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
        const quantizedCritMultiplier = quantizeBaseCriticalDamageMultiplier(weapon.critMultiplier);
        expect(result.modded.averageShotDamage).toBeCloseTo(
            100 * (1 + weapon.critChance * (quantizedCritMultiplier - 1)),
            5,
        );
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
