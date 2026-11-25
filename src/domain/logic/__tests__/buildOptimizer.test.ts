import { describe, expect, it, vi } from "vitest";
import { getArcanesByWeaponCategory, getArcanesForWeapon } from "../../catalog/arcaneCatalog";
import type { ArcaneEntry } from "../../catalog/arcaneCatalog";
import { getArcaneEffectAtRank } from "../arcaneEffects";
import { buildIncarnonCandidateConfigs, getIncarnonRecordForWeapon, resolveIncarnonState, selectIncarnonSearchShortlist } from "../../catalog/incarnonCatalog";
import { filterBuilderExpertVariants, getModsForWeapon, getStancesForWeapon, getUnmodeledDamageEffectLines, sortBuilderModsForDisplay, type ModEffect, type ModEntry } from "../../catalog/modCatalog";
import { getUnmodeledDamageEffectSourceUrl, getUnmodeledScoringEffectLines, SENTIENT_BARRAGE_MOD_PATH } from "../../catalog/modEffectUtils";
import { getWeaponCatalog, getWeaponDisplayName, selectedAttackUsesIncarnonForm, withSelectedAttack } from "../../catalog/weaponCatalog";
import type { WeaponEntry } from "../../catalog/weaponCatalog";
import { emptyEffect } from "../../catalog/modCatalog";
import { assignModsToSlots, debugEvaluateExpectedEncounter, debugEvaluateFixedWindowDps, debugExpectedEncounterElementTheme, debugScoreBuild, debugScoreExpectedEncounter, explainBuild, getBeamStateSignature, getTargetProfileAssumptions, minimizePolaritiesByCapacity, normalizeOptimizeGoal, optimizeBuild, rankExpectedEncounter, scoreOptimizerResultForConfiguration } from "../buildOptimizer";
import { computeCapacity, countPolarityChanges } from "../capacityCalc";
import { avgHitDamageMultiplier, calculateBuild, type ConditionalState } from "../damageCalc";
import * as damageCalcModule from "../damageCalc";
import { gasCloudOuterAnnulusCoverage, quantizeBaseCriticalDamageMultiplier } from "../damageRuleset";

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

describe("Beast Claw Conditioning optimizer legality", () => {
    it("never selects more than one of the mutually exclusive Conditioning mods", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        expect(claw).toBeDefined();
        const names = new Set(["Brute Conditioning", "Disabling Conditioning", "Precision Conditioning"]);
        const candidates = getModsForWeapon(claw!).filter((mod) => names.has(mod.name));
        expect(candidates).toHaveLength(3);
        expect(new Set(candidates.map((mod) => mod.incompatibilityGroup)).size).toBe(1);

        const optimized = optimizeBuild(claw!, candidates, "burst", 3, {
            slotPolarities: ["", "", ""],
            defaultSlotPolarities: ["", "", ""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        });
        expect(optimized.mods.filter((mod) => mod && names.has(mod.name))).toHaveLength(1);
    });
});

describe("Shell Rush charged-attack optimization", () => {
    it("selects the sourced Charge Rate mod for a Corvas charged-shot build", () => {
        const corvas = getWeaponCatalog().find((weapon) => weapon.name === "Corvas");
        expect(corvas).toBeDefined();
        const chargedShot = withSelectedAttack(corvas!, corvas!.attacks.findIndex((attack) => attack.name === "Charged Shot"));
        const shellRush = getModsForWeapon(corvas!).find((mod) => mod.name === "Shell Rush");
        expect(shellRush).toBeDefined();

        const optimized = optimizeBuild(chargedShot, [shellRush!], "burst", 1, {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        });
        expect(optimized.mods.some((mod) => mod?.name === "Shell Rush")).toBe(true);
        expect(explainBuild(chargedShot, [shellRush!], [shellRush!.fusionLimit], "burst").steps[0]?.why).toContain("Charge Rate");
    });
});

describe("source-backed charged-mode optimizer coverage", () => {
    it("scores the verified charged attack rows in finite Expected TTK", () => {
        const catalog = getWeaponCatalog();
        const cases = [
            ["Aeolak", "Alt-Fire", 0.3],
            ["Quellor", "Alt-Fire", 1.2],
            ["Stahlta", "Alt-Fire", 1.6],
            ["Tenora", "Charged Attack", 0.8],
            ["Tenora Prime", "Charged Attack", 0.8],
        ] as const;

        for (const [weaponName, attackName, chargeTime] of cases) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            const attackIndex = weapon!.attacks.findIndex((candidate) => candidate.name === attackName);
            expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
            const attack = weapon!.attacks[attackIndex]!;
            const selected = withSelectedAttack(weapon!, attackIndex);

            expect(attack.trigger, `${weaponName} / ${attackName}`).toBe("Charge");
            expect(attack.chargeTime, `${weaponName} / ${attackName}`).toBeCloseTo(chargeTime, 8);
            expect(attack.modelLimitation, `${weaponName} / ${attackName}`).toBeUndefined();

            const optimized = optimizeBuild(selected, [], "timeToKill", 0, {
                buildForAttack: attack,
                targetFaction: "Grineer",
                targetProfileOverride: { health: 1, shields: 0, overguard: 0, armor: 0 },
                allowForma: false,
                optimizeArcane: false,
                optimizeExilus: false,
            });
            expect(optimized.encounterTimeToKillSeconds, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(chargeTime);
            expect(optimized.capacityValid, `${weaponName} / ${attackName}`).toBe(true);
        }
    });
});

describe("source-backed Penta grenade optimizer coverage", () => {
    it("optimizes the bounded single-grenade impact-plus-detonation sequence for Burst and Expected TTK", () => {
        for (const weaponName of ["Penta", "Carmine Penta", "Secura Penta"]) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            const impactIndex = weapon!.attacks.findIndex((attack) => attack.name === "Grenade Impact");
            const detonationIndex = weapon!.attacks.findIndex((attack) => attack.name === "Grenade Detonation");
            const impact = withSelectedAttack(weapon!, impactIndex);
            const detonation = withSelectedAttack(weapon!, detonationIndex);
            const options = {
                targetFaction: "Infested",
                targetProfileOverride: { health: 1_000, shields: 0, overguard: 0, armor: 0 },
                allowForma: false,
                optimizeArcane: false,
                optimizeExilus: false,
            } as const;

            expect(impact.selectedAttackModelLimitation).toBeUndefined();
            expect(() => optimizeBuild(impact, [], "burst", 0, options)).not.toThrow();
            const combined = optimizeBuild(impact, [], "timeToKill", 0, options);
            const directOnly = optimizeBuild({
                ...impact,
                selectedAttackLingeringDamageRule: undefined,
            }, [], "timeToKill", 0, options);
            expect(combined.encounterTimeToKillSeconds, weaponName).not.toBeNull();
            expect(combined.encounterTimeToKillSeconds, weaponName)
                .toBeLessThan(directOnly.encounterTimeToKillSeconds ?? Number.POSITIVE_INFINITY);
            expect(() => optimizeBuild(detonation, [], "burst", 0, options))
                .toThrow(/Select Grenade Impact/);
        }
    });
});

describe("source-backed Aegrit single-bomb optimizer coverage", () => {
    it("optimizes one immediate Direct Hit-plus-Detonation event and guards the component row", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Aegrit");
        expect(weapon).toBeDefined();
        const directIndex = weapon!.attacks.findIndex((attack) => attack.name === "Direct Hit");
        const detonationIndex = weapon!.attacks.findIndex((attack) => attack.name === "Detonation");
        const direct = withSelectedAttack(weapon!, directIndex);
        const detonation = withSelectedAttack(weapon!, detonationIndex);
        const options = {
            targetFaction: "Infested",
            targetProfileOverride: { health: 1_000, shields: 0, overguard: 0, armor: 0 },
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        } as const;

        expect(direct.selectedAttackModelLimitation).toBeUndefined();
        expect(() => optimizeBuild(direct, [], "burst", 0, options)).not.toThrow();
        const combined = optimizeBuild(direct, [], "timeToKill", 0, options);
        const directOnly = optimizeBuild({
            ...direct,
            selectedAttackLingeringDamageRule: undefined,
        }, [], "timeToKill", 0, options);
        expect(combined.encounterTimeToKillSeconds).not.toBeNull();
        expect(combined.encounterTimeToKillSeconds)
            .toBeLessThan(directOnly.encounterTimeToKillSeconds ?? Number.POSITIVE_INFINITY);
        expect(() => optimizeBuild(detonation, [], "burst", 0, options))
            .toThrow(/Select Direct Hit/);
    });
});

describe("source-backed Kulstar rocket optimizer coverage", () => {
    it("optimizes one direct-hit rocket blast and rejects scattered cluster components", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Kulstar");
        expect(weapon).toBeDefined();
        const rocketIndex = weapon!.attacks.findIndex((attack) => attack.name === "Rocket Impact");
        const explosionIndex = weapon!.attacks.findIndex((attack) => attack.name === "Rocket Explosion");
        const clustersIndex = weapon!.attacks.findIndex((attack) => attack.name === "Cluster Bombs");
        const clusterExplosionIndex = weapon!.attacks.findIndex((attack) => attack.name === "Cluster Bomb Explosion");
        const rocket = withSelectedAttack(weapon!, rocketIndex);
        const explosion = withSelectedAttack(weapon!, explosionIndex);
        const clusters = withSelectedAttack(weapon!, clustersIndex);
        const clusterExplosion = withSelectedAttack(weapon!, clusterExplosionIndex);
        const options = {
            targetFaction: "Infested",
            targetProfileOverride: { health: 1_000, shields: 0, overguard: 0, armor: 0 },
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        } as const;

        expect(rocket.trigger).toBe("Semi-Auto");
        expect(rocket.selectedAttackModelLimitation).toBeUndefined();
        expect(() => optimizeBuild(rocket, [], "burst", 0, options)).not.toThrow();
        const combined = optimizeBuild(rocket, [], "timeToKill", 0, options);
        const directOnly = optimizeBuild({
            ...rocket,
            selectedAttackLingeringDamageRule: undefined,
        }, [], "timeToKill", 0, options);
        expect(combined.encounterTimeToKillSeconds).not.toBeNull();
        expect(combined.encounterTimeToKillSeconds)
            .toBeLessThan(directOnly.encounterTimeToKillSeconds ?? Number.POSITIVE_INFINITY);
        expect(() => optimizeBuild(explosion, [], "burst", 0, options))
            .toThrow(/Select Rocket Impact/);
        expect(() => optimizeBuild(clusters, [], "burst", 0, options))
            .toThrow(/cannot determine whether any bomblet hits/i);
        expect(() => optimizeBuild(clusterExplosion, [], "burst", 0, options))
            .toThrow(/reference-only/i);
    });
});

describe("source-backed Vulcax charged-impact optimizer coverage", () => {
    it("optimizes the bounded Impact-plus-Radial sequence and rejects its standalone component", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Vulcax");
        expect(weapon).toBeDefined();
        const impactIndex = weapon!.attacks.findIndex((attack) => attack.name === "Impact");
        const radialIndex = weapon!.attacks.findIndex((attack) => attack.name === "Radial Attack");
        const impact = withSelectedAttack(weapon!, impactIndex);
        const radial = withSelectedAttack(weapon!, radialIndex);
        const options = {
            targetFaction: "Corpus",
            targetProfileOverride: { health: 700, shields: 0, overguard: 0, armor: 0 },
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        } as const;

        expect(impact.selectedAttackModelLimitation).toBeUndefined();
        expect(() => optimizeBuild(impact, [], "burst", 0, options)).not.toThrow();
        const combined = optimizeBuild(impact, [], "timeToKill", 0, options);
        const directOnly = optimizeBuild({
            ...impact,
            selectedAttackLingeringDamageRule: undefined,
        }, [], "timeToKill", 0, options);
        expect(combined.encounterTimeToKillSeconds).not.toBeNull();
        expect(combined.encounterTimeToKillSeconds)
            .toBeLessThan(directOnly.encounterTimeToKillSeconds ?? Number.POSITIVE_INFINITY);
        expect(() => optimizeBuild(radial, [], "burst", 0, options)).toThrow(/Select Impact/i);
    });
});

describe("source-backed single-charge throwables optimizer coverage", () => {
    it("optimizes each detonation row independently without adding mines or blocking Purity scope", () => {
        const catalog = getWeaponCatalog();
        const options = {
            targetFaction: "Infested",
            targetProfileOverride: { health: 1_000, shields: 0, overguard: 0, armor: 0 },
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        } as const;

        for (const weaponName of ["Castanas", "Sancti Castanas", "Talons"]) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            for (const attackName of ["Mid-Flight Detonation", "Embedded Detonation"]) {
                const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
                expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
                const attack = weapon!.attacks[attackIndex]!;
                const selected = withSelectedAttack(weapon!, attackIndex);

                expect(attack.trigger, `${weaponName} / ${attackName}`).toBe("Active");
                expect(attack.scoreBoundaryNote, `${weaponName} / ${attackName}`).toBeDefined();
                expect(selected.selectedAttackModelLimitation, `${weaponName} / ${attackName}`).toBeUndefined();
                expect(selected.selectedAttackMultishotLocked, `${weaponName} / ${attackName}`).toBe(true);
                const burst = optimizeBuild(selected, [], "burst", 0, options);
                const timeToKill = optimizeBuild(selected, [], "timeToKill", 0, options);
                expect(burst.capacityValid, `${weaponName} / ${attackName}`).toBe(true);
                expect(timeToKill.encounterTimeToKillSeconds, `${weaponName} / ${attackName}`)
                    .toBeGreaterThan(0);
                expect(timeToKill.capacityValid, `${weaponName} / ${attackName}`).toBe(true);
            }
        }
    });
});

describe("Beast Claw elemental conversion optimizer legality", () => {
    it("never selects more than one of the mutually exclusive elemental conversion mods", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        expect(claw).toBeDefined();
        const names = new Set(["Burning Claws", "Chilling Claws", "Sepsis Claws", "Shocking Claws"]);
        const candidates = getModsForWeapon(claw!).filter((mod) => names.has(mod.name));
        expect(candidates).toHaveLength(4);
        expect(new Set(candidates.map((mod) => mod.incompatibilityGroup)).size).toBe(1);

        const optimized = optimizeBuild(claw!, candidates, "burst", 3, {
            slotPolarities: ["", "", ""],
            defaultSlotPolarities: ["", "", ""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        });
        expect(optimized.mods.filter((mod) => mod && names.has(mod.name))).toHaveLength(1);
    });
});

function poissonProbabilityAtLeastForTest(mean: number, threshold: number): number {
    if (threshold <= 0) return 1;
    let probability = Math.exp(-mean);
    let belowThreshold = probability;
    for (let count = 1; count < threshold; count++) {
        probability *= mean / count;
        belowThreshold += probability;
    }
    return 1 - belowThreshold;
}

function poissonExpectedRemainderForTest(mean: number, modulus: number): number {
    let probability = Math.exp(-mean);
    let expected = 0;
    const upperBound = Math.ceil(mean + 12 * Math.sqrt(mean + 1) + 20);
    for (let count = 0; count <= upperBound; count++) {
        expected += (count % modulus) * probability;
        probability *= mean / (count + 1);
    }
    return expected;
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

describe("Wiki stance DPS objective", () => {
    const combo = {
        totalDamageMultiplier: 14,
        totalSlashProcMultiplier: 0,
        baseComboLengthSeconds: 2,
    };

    it("scores the catalog combo over its Wiki timing without target-health assumptions", () => {
        const weapon = makeWeapon({
            category: "Melee",
            weaponType: "Sword",
            modCompat: "Melee",
            fireRate: 1.2,
        });
        const fastComboScore = debugScoreBuild(weapon, [], "meleeDps", "", null, undefined, { mode: "initial" }, combo);
        const slowerComboScore = debugScoreBuild(weapon, [], "meleeDps", "", null, undefined, { mode: "initial" }, {
            ...combo,
            baseComboLengthSeconds: 3,
        });

        expect(fastComboScore).toBeGreaterThan(0);
        expect(fastComboScore / slowerComboScore).toBeCloseTo(1.5, 8);
        expect(debugScoreBuild(weapon, [], "meleeDps", "")).toBe(0);

        const onKillDamage = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 1,
                stats: { damageBonus: 0.5 },
            }],
        };
        const initialStateScore = debugScoreBuild(weapon, [onKillDamage], "meleeDps", "", null, undefined, { mode: "initial" }, combo);
        const fullyStackedStateScore = debugScoreBuild(weapon, [onKillDamage], "meleeDps", "", null, undefined, { mode: "fullyStacked" }, combo);
        expect(fullyStackedStateScore).toBeCloseTo(initialStateScore, 8);
    });

    it("returns the same Wiki-combo score from the optimizer result", () => {
        const weapon = makeWeapon({
            category: "Melee",
            weaponType: "Sword",
            modCompat: "Melee",
            fireRate: 1.2,
        });
        const result = optimizeBuild(weapon, [], "meleeDps", 0, { meleeStanceCombo: combo });

        expect(scoreOptimizerResultForConfiguration({
            weapon,
            result,
            goal: "meleeDps",
            targetFaction: "",
            selectedAttackIdx: 0,
            meleeStanceCombo: combo,
        })).toBeCloseTo(
            debugScoreBuild(weapon, [], "meleeDps", "", null, undefined, undefined, combo),
            8,
        );
    });
    it("changes mod selection when Wiki forced-Slash weight makes duration valuable", () => {
        const weapon = makeWeapon({
            category: "Melee",
            weaponType: "Sword",
            modCompat: "Melee",
            fireRate: 1.2,
        });
        const makeObjectiveMod = (uniqueName: string, effect: ModEffect): ModEntry => ({
            uniqueName,
            path: uniqueName,
            name: uniqueName,
            compatBucket: "Melee",
            rawCompatName: "Melee",
            polarity: "madurai",
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
            incompatibilityGroup: uniqueName,
            compatibilityTags: [],
            incompatibilityTags: [],
        });
        const damageMod = makeObjectiveMod("damage", { ...emptyEffect(), damageBonus: 0.5 });
        const durationMod = makeObjectiveMod("duration", { ...emptyEffect(), statusDurationBonus: 1 });
        const directOnlyBuild = optimizeBuild(weapon, [damageMod, durationMod], "meleeDps", 1, {
            meleeStanceCombo: combo,
        });
        const slashHeavyBuild = optimizeBuild(weapon, [damageMod, durationMod], "meleeDps", 1, {
            meleeStanceCombo: { ...combo, totalSlashProcMultiplier: 1000000 },
        });

        expect(directOnlyBuild.mods.map((mod) => mod?.uniqueName)).toContain("damage");
        expect(slashHeavyBuild.mods.map((mod) => mod?.uniqueName)).toContain("duration");
    });
});

describe("Tennokai Cycle DPS objective", () => {
    it("scores a supported target-aware cycle and Auto Optimize can choose a Tennokai damage mod", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const mastersEdge = getModsForWeapon(weapon!).find((mod) => mod.name === "Master's Edge");
        expect(mastersEdge).toBeDefined();
        const conditionalState: ConditionalState = {
            mode: "initial",
            tennokaiRegularHitsBetweenHeavy: 2,
        };
        const target = { health: 100_000, shields: 0, overguard: 0, armor: 3_000 };
        const score = debugScoreBuild(
            weapon!,
            [mastersEdge!.effectsByRank[mastersEdge!.fusionLimit]],
            "tennokaiDps",
            "Grineer",
            null,
            target,
            conditionalState,
        );
        expect(score).toBeGreaterThan(0);

        const optimized = optimizeBuild(
            weapon!,
            [mastersEdge!],
            "tennokaiDps",
            1,
            {
                targetFaction: "Grineer",
                targetProfileOverride: target,
                conditionalState,
                capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
            },
        );
        expect(optimized.slots.some((mod) => mod?.name === "Master's Edge")).toBe(true);
        expect(scoreOptimizerResultForConfiguration({
            weapon: weapon!,
            result: optimized,
            goal: "tennokaiDps",
            targetFaction: "Grineer",
            selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
            targetProfileOverride: target,
            conditionalState,
        })).toBeGreaterThan(0);
    });

    it("scores Opportunity's Reach window while disclosing the contact assumption for its range", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        const opportunityReach = getModsForWeapon(weapon!).find((mod) => mod.name === "Opportunity's Reach");
        expect(opportunityReach).toBeDefined();
        expect(getUnmodeledDamageEffectLines(opportunityReach!, opportunityReach!.fusionLimit, {
            selectedGoal: "tennokaiDps",
        }).join(" ")).toContain("its opportunity-window bonus is modeled");
        const optimized = optimizeBuild(weapon!, [opportunityReach!], "tennokaiDps", 1, {
            conditionalState: { mode: "initial", tennokaiRegularHitsBetweenHeavy: 20 },
        });
        expect(optimized.slots.some((mod) => mod?.name === "Opportunity's Reach")).toBe(true);
    });

    it("scores Tennokai Status Chance through modeled Slash Bleed applications", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        const conditionPerfection = getModsForWeapon(weapon!).find((mod) => mod.name === "Condition's Perfection");
        expect(conditionPerfection).toBeDefined();
        expect(getUnmodeledDamageEffectLines(conditionPerfection!, conditionPerfection!.fusionLimit, {
            selectedGoal: "tennokaiDps",
        }).join(" ")).not.toContain("does not resolve Status Effect application or ticks");
        const optimized = optimizeBuild(weapon!, [conditionPerfection!], "tennokaiDps", 1);
        expect(optimized.slots.some((mod) => mod?.name === "Condition's Perfection")).toBe(true);
    });

    it("optimizes Truth's Flame's repeated-target Tennokai chain and discloses omitted player-side effects", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const truthFlame = getModsForWeapon(weapon!).find((mod) => mod.name === "Truth's Flame");
        expect(truthFlame).toBeDefined();
        const notes = getUnmodeledDamageEffectLines(truthFlame!, truthFlame!.fusionLimit, {
            selectedGoal: "tennokaiDps",
            selectedWeaponName: weapon!.name,
        });
        expect(notes.join(" ")).toContain("repeating the selected target profile");
        expect(notes.join(" ")).toContain("excludes its player-side Heat curse and Truth syndicate effects");
        expect(notes.join(" ")).not.toContain("Auto Optimize skips this mod");

        const target = { health: 1, shields: 0, overguard: 0, armor: 0 };
        const conditionalState: ConditionalState = {
            mode: "initial",
            tennokaiRegularHitsBetweenHeavy: 1,
        };
        const optimized = optimizeBuild(weapon!, [truthFlame!], "tennokaiDps", 1, {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState,
            capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
        });
        expect(optimized.slots.some((mod) => mod?.name === "Truth's Flame")).toBe(true);
        expect(scoreOptimizerResultForConfiguration({
            weapon: weapon!,
            result: optimized,
            goal: "tennokaiDps",
            targetFaction: "Grineer",
            selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
            targetProfileOverride: target,
            conditionalState,
        })).toBeGreaterThan(0);
    });

    it("models Relentless Combination Slash events in Tennokai Cycle DPS", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const mods = getModsForWeapon(weapon!);
        const relentlessCombination = mods.find((mod) => mod.name === "Relentless Combination");
        const tennokaiEnabler = mods.find((mod) => mod.name === "Condition's Perfection");
        expect(relentlessCombination).toBeDefined();
        expect(tennokaiEnabler).toBeDefined();
        expect(relentlessCombination!.hasDamageEffect).toBe(true);
        const contextFreeNotes = getUnmodeledDamageEffectLines(
            relentlessCombination!,
            relentlessCombination!.fusionLimit,
        ).join(" ");
        expect(contextFreeNotes).toContain("modeled only by Tennokai Cycle DPS");
        expect(contextFreeNotes).not.toContain("Additional Combo Count Chance can add random combo points");
        expect(getUnmodeledDamageEffectLines(
            relentlessCombination!,
            relentlessCombination!.fusionLimit,
            { selectedGoal: "tennokaiDps" },
        ).join(" ")).not.toContain("Auto Optimize skips this mod");
        expect(getUnmodeledDamageEffectLines(
            relentlessCombination!,
            relentlessCombination!.fusionLimit,
            { selectedGoal: "burst" },
        ).join(" ")).toContain("modeled only by Tennokai Cycle DPS");
        expect(getUnmodeledDamageEffectLines(
            relentlessCombination!,
            relentlessCombination!.fusionLimit,
            { selectedGoal: "burst" },
        ).join(" ")).toContain("Auto Optimize skips this mod outside Tennokai Cycle DPS");
        expect(getUnmodeledDamageEffectSourceUrl(relentlessCombination!)).toBe(
            "https://wiki.warframe.com/w/Relentless_Combination",
        );
        const conditionalState: ConditionalState = {
            mode: "initial",
            tennokaiRegularHitsBetweenHeavy: 20,
        };
        const target = { health: 1_000_000, shields: 0, overguard: 0, armor: 0 };
        const optimizerOptions = {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState,
            allowNonMaxRank: true,
            allowForma: false,
            capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
        };
        const optimized = optimizeBuild(weapon!, [relentlessCombination!, tennokaiEnabler!], "tennokaiDps", 2, optimizerOptions);
        const baseline = optimizeBuild(weapon!, [tennokaiEnabler!], "tennokaiDps", 1, optimizerOptions);
        const optimizedScore = scoreOptimizerResultForConfiguration({
            weapon: weapon!,
            result: optimized,
            goal: "tennokaiDps",
            targetFaction: "Grineer",
            selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
            targetProfileOverride: target,
            conditionalState,
        });
        const baselineScore = scoreOptimizerResultForConfiguration({
            weapon: weapon!,
            result: baseline,
            goal: "tennokaiDps",
            targetFaction: "Grineer",
            selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
            targetProfileOverride: target,
            conditionalState,
        });
        const exactScores: number[] = [];
        for (const relentlessRank of [null, ...relentlessCombination!.effectsByRank]) {
            for (const enablerRank of [null, ...tennokaiEnabler!.effectsByRank]) {
                exactScores.push(debugScoreBuild(
                    weapon!,
                    [relentlessRank, enablerRank],
                    "tennokaiDps",
                    "Grineer",
                    null,
                    target,
                    conditionalState,
                ));
            }
        }
        expect(optimized.slots.some((mod) => mod?.name === "Relentless Combination")).toBe(true);
        expect(optimizedScore).toBeGreaterThan(baselineScore);
        expect(optimizedScore).toBeCloseTo(Math.max(...exactScores), 7);
    });

    it("models True Punishment's expected combo gain only in the Tennokai cycle", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const truePunishment = getModsForWeapon(weapon!).find((mod) => mod.name === "True Punishment");
        const quickening = getModsForWeapon(weapon!).find((mod) => mod.name === "Quickening");
        const tennokaiEnabler = getModsForWeapon(weapon!).find((mod) => mod.name === "Condition's Perfection");
        expect(truePunishment).toBeDefined();
        expect(quickening).toBeDefined();
        expect(tennokaiEnabler).toBeDefined();
        expect(truePunishment!.effect.comboDurationBaseBonus).toBe(-0.5);
        expect(truePunishment!.effect.comboCountChanceBonus).toBe(1);
        expect(getUnmodeledDamageEffectSourceUrl(truePunishment!)).toBe("https://wiki.warframe.com/w/True_Punishment");
        const contextFreeQuickeningNotes = getUnmodeledDamageEffectLines(
            quickening!,
            quickening!.fusionLimit,
        ).join(" ");
        expect(contextFreeQuickeningNotes).toContain("modeled as expected extra combo points per qualifying regular hit in Tennokai Cycle DPS");
        expect(contextFreeQuickeningNotes).not.toContain("does not model the combo gain");
        expect(getUnmodeledDamageEffectLines(quickening!, quickening!.fusionLimit, {
            selectedGoal: "timeToKill",
        }).join(" ")).toContain("This selected objective does not model the combo gain");
        expect(getUnmodeledDamageEffectLines(quickening!, quickening!.fusionLimit, {
            selectedGoal: "tennokaiDps",
        }).join(" ")).not.toContain("does not model the combo gain");
        expect(getUnmodeledDamageEffectLines(truePunishment!, truePunishment!.fusionLimit, {
            selectedGoal: "tennokaiDps",
        }).join(" ")).not.toContain("Additional Combo Count Chance can add random combo points");
        expect(getUnmodeledDamageEffectLines(truePunishment!, truePunishment!.fusionLimit, {
            selectedGoal: "timeToKill",
        }).join(" ")).toContain("This selected objective does not model the combo gain");

        const target = { health: 500_000, shields: 0, overguard: 0, armor: 0 };
        const conditionalState = { mode: "initial" as const, tennokaiRegularHitsBetweenHeavy: 17 };
        const optimizerOptions = {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState,
            allowNonMaxRank: true,
            allowForma: false,
            capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
        };
        const optimized = optimizeBuild(weapon!, [truePunishment!, tennokaiEnabler!], "tennokaiDps", 2, optimizerOptions);
        const normalAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const exactScores: number[] = [];
        for (const punishmentRank of [null, ...truePunishment!.effectsByRank]) {
            for (const enablerRank of [null, ...tennokaiEnabler!.effectsByRank]) {
                exactScores.push(debugScoreBuild(
                    weapon!,
                    [punishmentRank, enablerRank],
                    "tennokaiDps",
                    "Grineer",
                    null,
                    target,
                    conditionalState,
                ));
            }
        }
        const optimizedScore = scoreOptimizerResultForConfiguration({
            weapon: weapon!,
            result: optimized,
            goal: "tennokaiDps",
            targetFaction: "Grineer",
            selectedAttackIdx: normalAttackIndex,
            targetProfileOverride: target,
            conditionalState,
        });
        expect(optimized.slots.some((mod) => mod?.name === "True Punishment")).toBe(true);
        expect(optimizedScore).toBeCloseTo(Math.max(...exactScores), 8);
    });

    it("optimizes Enduring Strike only when the Tennokai target is explicitly Lifted", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const available = getModsForWeapon(weapon);
        const enduringStrike = available.find((mod) => mod.name === "Enduring Strike")!;
        const mastersEdge = available.find((mod) => mod.name === "Master's Edge")!;
        const target = { health: 500_000, shields: 0, overguard: 0, armor: 0 };
        const common = {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            allowNonMaxRank: true,
            allowForma: false,
            capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
        };
        const withoutLifted = optimizeBuild(weapon, [mastersEdge, enduringStrike], "tennokaiDps", 2, {
            ...common,
            conditionalState: { mode: "initial", tennokaiRegularHitsBetweenHeavy: 17 },
        });
        const withLifted = optimizeBuild(weapon, [mastersEdge, enduringStrike], "tennokaiDps", 2, {
            ...common,
            conditionalState: {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 17,
                externalStatusTypes: ["lifted"],
            },
        });

        expect(getUnmodeledDamageEffectLines(enduringStrike, enduringStrike.fusionLimit, {
            selectedGoal: "burst",
        }).join(" ")).toContain("only while the target is Lifted");
        expect(withoutLifted.slots.some((mod) => mod?.name === "Enduring Strike")).toBe(false);
        expect(withLifted.slots.some((mod) => mod?.name === "Enduring Strike")).toBe(true);
    });

    it("optimizes Guardian Derision only with a positive successful-block assumption in Tennokai Cycle DPS", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const available = getModsForWeapon(weapon);
        const guardianDerision = available.find((mod) => mod.name === "Guardian Derision")!;
        const tennokaiEnabler = available.find((mod) => mod.name === "Condition's Perfection")!;
        const common = {
            targetFaction: "Grineer",
            targetProfileOverride: { health: 500_000, shields: 0, overguard: 0, armor: 0 },
            allowNonMaxRank: true,
            allowForma: false,
            capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
        };
        const withoutBlockAssumption = optimizeBuild(weapon, [guardianDerision, tennokaiEnabler], "tennokaiDps", 2, {
            ...common,
            conditionalState: {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 15,
                tennokaiBlockedHitsBetweenHeavy: 0,
            },
        });
        const withBlockAssumption = optimizeBuild(weapon, [guardianDerision, tennokaiEnabler], "tennokaiDps", 2, {
            ...common,
            conditionalState: {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 15,
                tennokaiBlockedHitsBetweenHeavy: 4,
            },
        });

        expect(withoutBlockAssumption.slots.some((mod) => mod?.name === "Guardian Derision")).toBe(false);
        expect(withBlockAssumption.slots.some((mod) => mod?.name === "Guardian Derision")).toBe(true);
        expect(getUnmodeledDamageEffectLines(guardianDerision, guardianDerision.fusionLimit, {
            selectedGoal: "burst",
            selectedTennokaiBlockedHitsBetweenHeavy: 4,
        }).join(" ")).toContain("other objectives skip it");
        expect(getUnmodeledDamageEffectLines(guardianDerision, guardianDerision.fusionLimit, {
            selectedGoal: "tennokaiDps",
            selectedTennokaiBlockedHitsBetweenHeavy: 4,
        }).join(" ")).not.toContain("only in Tennokai Cycle DPS");
    });

    it("matches seeded two-slot R0–R2 Tennokai winners with successful block events", { timeout: 60_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261169;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = ["Quickening", "True Punishment", "Organ Shatter", "Fury"];
        const capacityConfig = { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const tennokaiEnabler = byName("Master's Edge");
            const guardianDerision = byName("Guardian Derision");
            expect(tennokaiEnabler, `${scenario.weapon} Master's Edge`).toBeDefined();
            expect(guardianDerision, `${scenario.weapon} Guardian Derision`).toBeDefined();
            const shuffled = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [tennokaiEnabler!, guardianDerision!, ...shuffled.slice(0, 3)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 1 + Math.floor(random() * 20),
                tennokaiBlockedHitsBetweenHeavy: 1 + Math.floor(random() * 8),
            };
            const scoringContext = {
                selectedGoal: "tennokaiDps",
                selectedWeaponName: weapon!.name,
                selectedTennokaiBlockedHitsBetweenHeavy: conditionalState.tennokaiBlockedHitsBetweenHeavy,
            };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled.") ||
                        line.includes("Guardian Derision's blocking taunt changes enemy targeting"),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                exactScores.push(debugScoreBuild(
                    weapon!,
                    selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                    "tennokaiDps",
                    scenario.faction,
                    null,
                    scenario.target,
                    conditionalState,
                ));
                if (selected.length >= 2) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    if (selected.some((entry) => entry.mod.incompatibilityGroup === mod.incompatibilityGroup)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 2, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig,
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });
            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(20);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("matches seeded three-slot R0–R2 exact Tennokai winners with Enduring Strike on Lifted targets", { timeout: 180_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261167;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = ["Condition's Perfection", "Opportunity's Reach", "Organ Shatter", "Fury"];
        const capacityConfig = { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const mastersEdge = byName("Master's Edge");
            const enduringStrike = byName("Enduring Strike");
            expect(mastersEdge, `${scenario.weapon} Master's Edge`).toBeDefined();
            expect(enduringStrike, `${scenario.weapon} Enduring Strike`).toBeDefined();
            const shuffled = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [mastersEdge!, enduringStrike!, ...shuffled.slice(0, 3)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                externalStatusTypes: ["lifted"],
                tennokaiRegularHitsBetweenHeavy: 4 + Math.floor(random() * 17),
            };
            const scoringContext = {
                selectedGoal: "tennokaiDps",
                selectedWeaponName: weapon!.name,
                targetHasLiftedStatus: true,
            };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled."),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                const placement = assignModsToSlots(
                    selected.map(({ mod }) => mod),
                    selected.map(({ rank }) => rank),
                    weapon!.polarities.slice(0, 3),
                    3,
                    false,
                );
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === selected.length && !capacity.overCapacity) {
                    exactScores.push(debugScoreBuild(
                        weapon!,
                        selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                        "tennokaiDps",
                        scenario.faction,
                        null,
                        scenario.target,
                        conditionalState,
                    ));
                }
                if (selected.length >= 3) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    if (selected.some((entry) => entry.mod.incompatibilityGroup === mod.incompatibilityGroup)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 3, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig,
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });

            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(40);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("matches seeded two-slot R0–R1 exact winners with both combo chance mods", { timeout: 60_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261158;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = [
            "Dreamer's Wrath",
            "Discipline's Merit",
            "Opportunity's Reach",
            "Organ Shatter",
            "Killing Blow",
            "Fury",
        ];

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const tennokaiEnabler = byName("Master's Edge");
            expect(tennokaiEnabler, `${scenario.weapon} Master's Edge`).toBeDefined();
            const comboChanceMods = [byName("Quickening"), byName("True Punishment")]
                .filter((mod): mod is ModEntry => mod !== undefined);
            expect(comboChanceMods, `${scenario.weapon} combo chance mods`).toHaveLength(2);
            const randomPool = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            const shuffled = [...randomPool];
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [tennokaiEnabler!, ...comboChanceMods, ...shuffled.slice(0, 2)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [mod.uniqueName, Math.floor(random() * 2)]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 9,
            };
            const scoringContext = { selectedGoal: "tennokaiDps", selectedWeaponName: weapon!.name };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled."),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                exactScores.push(debugScoreBuild(
                    weapon!,
                    selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                    "tennokaiDps",
                    scenario.faction,
                    null,
                    scenario.target,
                    conditionalState,
                ));
                if (selected.length >= 2) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    if (selected.some((entry) => entry.mod.incompatibilityGroup === mod.incompatibilityGroup)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 2, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });
            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(10);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimized.slots.some(Boolean), `${scenario.weapon} build`).toBe(true);
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("matches seeded three-slot R1–R3 exact winners across melee weapon and faction strata", { timeout: 300_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261161;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = [
            "Dreamer's Wrath",
            "Discipline's Merit",
            "Opportunity's Reach",
            "Organ Shatter",
            "Killing Blow",
            "Fury",
        ];
        const capacityConfig = { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const tennokaiEnabler = byName("Master's Edge");
            expect(tennokaiEnabler, `${scenario.weapon} Master's Edge`).toBeDefined();
            const randomPool = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            const shuffled = [...randomPool];
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [tennokaiEnabler!, ...shuffled.slice(0, 4)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(3, mod.fusionLimit)),
            ]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 9,
            };
            const scoringContext = { selectedGoal: "tennokaiDps", selectedWeaponName: weapon!.name };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled."),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                const orderedMods = selected.map(({ mod }) => mod);
                const placement = assignModsToSlots(
                    orderedMods,
                    selected.map(({ rank }) => rank),
                    weapon!.polarities.slice(0, 3),
                    3,
                    false,
                );
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === selected.length && !capacity.overCapacity) {
                    exactScores.push(debugScoreBuild(
                        weapon!,
                        selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                        "tennokaiDps",
                        scenario.faction,
                        null,
                        scenario.target,
                        conditionalState,
                    ));
                }
                if (selected.length >= 3) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    if (selected.some((entry) => entry.mod.incompatibilityGroup === mod.incompatibilityGroup)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 3, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig,
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });

            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(50);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimized.slots.some(Boolean), `${scenario.weapon} build`).toBe(true);
            for (const [slotIndex, mod] of optimized.slots.entries()) {
                if (!mod) continue;
                expect(optimized.slotRanks[slotIndex], `${scenario.weapon} owned rank for ${mod.name}`)
                    .toBeLessThanOrEqual(ownedRankCaps[mod.uniqueName]);
            }
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("matches seeded R0–R2 exact winners when Relentless Combination is available", { timeout: 300_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261162;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = ["Condition's Perfection", "Opportunity's Reach", "Organ Shatter", "Fury"];
        const capacityConfig = { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const tennokaiEnabler = byName("Master's Edge");
            const relentlessCombination = byName("Relentless Combination");
            expect(tennokaiEnabler, `${scenario.weapon} Master's Edge`).toBeDefined();
            expect(relentlessCombination, `${scenario.weapon} Relentless Combination`).toBeDefined();
            const shuffled = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [tennokaiEnabler!, relentlessCombination!, ...shuffled.slice(0, 3)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 4 + Math.floor(random() * 17),
            };
            const scoringContext = { selectedGoal: "tennokaiDps", selectedWeaponName: weapon!.name };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled."),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                const orderedMods = selected.map(({ mod }) => mod);
                const placement = assignModsToSlots(
                    orderedMods,
                    selected.map(({ rank }) => rank),
                    weapon!.polarities.slice(0, 2),
                    2,
                    false,
                );
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === selected.length && !capacity.overCapacity) {
                    exactScores.push(debugScoreBuild(
                        weapon!,
                        selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                        "tennokaiDps",
                        scenario.faction,
                        null,
                        scenario.target,
                        conditionalState,
                    ));
                }
                if (selected.length >= 2) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    const group = mod.incompatibilityGroup;
                    if (group && selected.some((entry) => entry.mod.incompatibilityGroup === group)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 2, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig,
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });

            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(40);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimized.slots.some(Boolean), `${scenario.weapon} build`).toBe(true);
            for (const [slotIndex, mod] of optimized.slots.entries()) {
                if (!mod) continue;
                expect(optimized.slotRanks[slotIndex], `${scenario.weapon} owned rank for ${mod.name}`)
                    .toBeLessThanOrEqual(ownedRankCaps[mod.uniqueName]);
            }
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("matches seeded three-slot R0–R3 exact winners with Relentless Combination", { timeout: 300_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261163;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = ["Condition's Perfection", "Opportunity's Reach", "Organ Shatter", "Fury"];
        const capacityConfig = { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const tennokaiEnabler = byName("Master's Edge");
            const relentlessCombination = byName("Relentless Combination");
            expect(tennokaiEnabler, `${scenario.weapon} Master's Edge`).toBeDefined();
            expect(relentlessCombination, `${scenario.weapon} Relentless Combination`).toBeDefined();
            const shuffled = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [tennokaiEnabler!, relentlessCombination!, ...shuffled.slice(0, 3)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(3, mod.fusionLimit)),
            ]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 4 + Math.floor(random() * 17),
            };
            const scoringContext = { selectedGoal: "tennokaiDps", selectedWeaponName: weapon!.name };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled."),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                const placement = assignModsToSlots(
                    selected.map(({ mod }) => mod),
                    selected.map(({ rank }) => rank),
                    weapon!.polarities.slice(0, 3),
                    3,
                    false,
                );
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === selected.length && !capacity.overCapacity) {
                    exactScores.push(debugScoreBuild(
                        weapon!,
                        selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                        "tennokaiDps",
                        scenario.faction,
                        null,
                        scenario.target,
                        conditionalState,
                    ));
                }
                if (selected.length >= 3) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    const group = mod.incompatibilityGroup;
                    if (group && selected.some((entry) => entry.mod.incompatibilityGroup === group)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 3, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig,
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });

            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(100);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimized.slots.some(Boolean), `${scenario.weapon} build`).toBe(true);
            for (const [slotIndex, mod] of optimized.slots.entries()) {
                if (!mod) continue;
                expect(optimized.slotRanks[slotIndex], `${scenario.weapon} owned rank for ${mod.name}`)
                    .toBeLessThanOrEqual(ownedRankCaps[mod.uniqueName]);
            }
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("matches seeded four-slot R0–R2 exact Tennokai winners with Relentless Combination", { timeout: 300_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261164;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = ["Condition's Perfection", "Opportunity's Reach", "Organ Shatter", "Fury"];
        const capacityConfig = { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const mastersEdge = byName("Master's Edge");
            const relentless = byName("Relentless Combination");
            expect(mastersEdge, `${scenario.weapon} Master's Edge`).toBeDefined();
            expect(relentless, `${scenario.weapon} Relentless Combination`).toBeDefined();
            const shuffled = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [mastersEdge!, relentless!, ...shuffled.slice(0, 3)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 4 + Math.floor(random() * 17),
            };
            const scoringContext = { selectedGoal: "tennokaiDps", selectedWeaponName: weapon!.name };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled."),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                const placement = assignModsToSlots(
                    selected.map(({ mod }) => mod),
                    selected.map(({ rank }) => rank),
                    weapon!.polarities.slice(0, 4),
                    4,
                    false,
                );
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === selected.length && !capacity.overCapacity) {
                    exactScores.push(debugScoreBuild(
                        weapon!,
                        selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                        "tennokaiDps",
                        scenario.faction,
                        null,
                        scenario.target,
                        conditionalState,
                    ));
                }
                if (selected.length >= 4) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    const group = mod.incompatibilityGroup;
                    if (group && selected.some((entry) => entry.mod.incompatibilityGroup === group)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 4, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig,
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });

            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(40);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimized.slots.some(Boolean), `${scenario.weapon} build`).toBe(true);
            for (const [slotIndex, mod] of optimized.slots.entries()) {
                if (!mod) continue;
                expect(optimized.slotRanks[slotIndex], `${scenario.weapon} owned rank for ${mod.name}`)
                    .toBeLessThanOrEqual(ownedRankCaps[mod.uniqueName]);
            }
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("matches seeded five-slot R0–R2 exact Tennokai winners across four melee targets", { timeout: 480_000 }, () => {
        const scenarios = [
            { weapon: "Broken War", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
            { weapon: "Gram Prime", faction: "Corpus", target: { health: 250_000, shields: 250_000, overguard: 0, armor: 0 } },
            { weapon: "Lesion", faction: "Infested", target: { health: 250_000, shields: 0, overguard: 0, armor: 0 } },
            { weapon: "Nikana Prime", faction: "Grineer", target: { health: 250_000, shields: 0, overguard: 0, armor: 3_000 } },
        ];
        let seed = 20261165;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidateNames = ["Condition's Perfection", "Opportunity's Reach", "Organ Shatter", "Fury"];
        const capacityConfig = { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === scenario.weapon);
            expect(weapon, scenario.weapon).toBeDefined();
            const available = getModsForWeapon(weapon!);
            const byName = (name: string) => available.find((mod) => mod.name === name);
            const mastersEdge = byName("Master's Edge");
            const relentless = byName("Relentless Combination");
            expect(mastersEdge, `${scenario.weapon} Master's Edge`).toBeDefined();
            expect(relentless, `${scenario.weapon} Relentless Combination`).toBeDefined();
            const shuffled = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const sampledMods = [mastersEdge!, relentless!, ...shuffled.slice(0, 3)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const conditionalState: ConditionalState = {
                mode: "initial",
                tennokaiRegularHitsBetweenHeavy: 4 + Math.floor(random() * 17),
            };
            const scoringContext = { selectedGoal: "tennokaiDps", selectedWeaponName: weapon!.name };
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).every((line) =>
                        line.includes("does not change the score; its opportunity-window bonus is modeled."),
                    ),
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                const placement = assignModsToSlots(
                    selected.map(({ mod }) => mod),
                    selected.map(({ rank }) => rank),
                    weapon!.polarities.slice(0, 5),
                    5,
                    false,
                );
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (placement.slotMods.filter(Boolean).length === selected.length && !capacity.overCapacity) {
                    exactScores.push(debugScoreBuild(
                        weapon!,
                        selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                        "tennokaiDps",
                        scenario.faction,
                        null,
                        scenario.target,
                        conditionalState,
                    ));
                }
                if (selected.length >= 5) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    const group = mod.incompatibilityGroup;
                    if (group && selected.some((entry) => entry.mod.incompatibilityGroup === group)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon!, sampledMods, "tennokaiDps", 5, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig,
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon: weapon!,
                result: optimized,
                goal: "tennokaiDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
                targetProfileOverride: scenario.target,
                conditionalState,
            });

            expect(exactScores.length, `${scenario.weapon} exact pool size`).toBeGreaterThan(100);
            expect(optimized.capacityValid, `${scenario.weapon} capacity`).toBe(true);
            expect(optimized.slots.some(Boolean), `${scenario.weapon} build`).toBe(true);
            for (const [slotIndex, mod] of optimized.slots.entries()) {
                if (!mod) continue;
                expect(optimized.slotRanks[slotIndex], `${scenario.weapon} owned rank for ${mod.name}`)
                    .toBeLessThanOrEqual(ownedRankCaps[mod.uniqueName]);
            }
            expect(optimizerScore, `${scenario.weapon} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("keeps a Tennokai enabler in a legal full-pool eight-slot result", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const target = { health: 250_000, shields: 0, overguard: 0, armor: 3_000 };
        const conditionalState: ConditionalState = {
            mode: "initial",
            tennokaiRegularHitsBetweenHeavy: 4,
        };
        const optimized = optimizeBuild(weapon!, getModsForWeapon(weapon!), "tennokaiDps", 8, {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState,
            allowForma: false,
            capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
        });
        const optimizerScore = scoreOptimizerResultForConfiguration({
            weapon: weapon!,
            result: optimized,
            goal: "tennokaiDps",
            targetFaction: "Grineer",
            selectedAttackIdx: weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
            targetProfileOverride: target,
            conditionalState,
        });
        expect(optimized.capacityValid).toBe(true);
        expect(optimized.slots.some((mod) => ["Master's Edge", "Dreamer's Wrath", "Discipline's Merit", "Opportunity's Reach"].includes(mod?.name ?? ""))).toBe(true);
        expect(optimizerScore).toBeGreaterThan(0);
    });
});

describe("attack falloff optimizer propagation", () => {
    it("selects a range mod only when the configured distance makes its falloff extension valuable", () => {
        const attack = {
            name: "Normal Attack",
            speed: 8,
            critChance: 0,
            critMultiplier: 1,
            statusChance: 0,
            damage: {
                total: 100, impact: 100, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 0, radiation: 0, gas: 0, magnetic: 0,
                viral: 0, corrosive: 0, void: 0, tau: 0, true: 0,
            },
            damageTotal: 100,
            damageFalloff: {
                startDistanceMeters: 10,
                endDistanceMeters: 20,
                minimumDamageMultiplier: 0,
                scaleBy: ["weaponRange"] as const,
                sourceUrl: "https://wiki.warframe.com/w/Damage_Falloff",
            },
        } satisfies WeaponEntry["attacks"][number];
        const weapon = makeWeapon({
            uniqueName: "/Test/RangeFalloffOptimizer",
            attacks: [attack],
        });
        const makeCandidate = (name: string, effect: ModEffect): ModEntry => ({
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
        });
        const damageMod = makeCandidate("Additive Damage", { ...emptyEffect(), damageBonus: 0.2 });
        const rangeMod = makeCandidate("Range Extension", { ...emptyEffect(), rangeBonus: 1 });
        const availableMods = [damageMod, rangeMod];
        const buildForAttack = attack;
        const nearby = optimizeBuild(weapon, availableMods, "burst", 1, {
            buildForAttack,
            conditionalState: { mode: "initial" },
        });
        const atFalloff = optimizeBuild(weapon, availableMods, "burst", 1, {
            buildForAttack,
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 15 },
        });

        expect(nearby.mods.map((mod) => mod.name)).toEqual(["Additive Damage"]);
        expect(atFalloff.mods.map((mod) => mod.name)).toEqual(["Range Extension"]);
    });
});

describe("fixed-window DPS objective", () => {
    function optimizeCatalogWindowFixture(
        weaponName: string,
        attackName: string,
        targetFaction = "Grineer",
        targetProfileOverride = { health: 2_000_000, shields: 0, overguard: 0, armor: 3_000 },
        conditionalState: ConditionalState = { mode: "realistic" },
    ) {
        const catalogWeapon = getWeaponCatalog().find((entry) => entry.name === weaponName);
        expect(catalogWeapon).toBeDefined();
        const attackIndex = catalogWeapon!.attacks.findIndex((attack) => attack.name === attackName);
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const attack = catalogWeapon!.attacks[attackIndex]!;
        const weapon = withSelectedAttack(catalogWeapon!, attackIndex);
        const slotCount = 8;
        const slotPolarities = Array.from({ length: slotCount }, (_, index) => weapon.polarities[index] ?? "");
        const result = optimizeBuild(
            weapon,
            filterBuilderExpertVariants(getModsForWeapon(weapon)),
            "windowDps",
            slotCount,
            {
                targetFaction,
                targetProfileOverride,
                conditionalState,
                buildForAttack: attack,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                capacityConfig: {
                    weaponRank: weapon.canOverLevel ? 40 : 30,
                    hasCatalyst: true,
                    masteryRank: 30,
                    canOverLevel: weapon.canOverLevel,
                },
                allowCatalyst: true,
                allowForma: true,
                maxFormaCount: 3,
                optimizeArcane: false,
                arcaneCandidates: [],
                optimizeExilus: false,
            },
        );
        return { result, weapon };
    }

    it("retains a second multishot option for the final Braton Prime neighborhood", { timeout: 15000 }, () => {
        const { result } = optimizeCatalogWindowFixture("Braton Prime", "Normal Attack");

        expect(result.capacityValid).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Split Chamber")).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Galvanized Chamber")).toBe(false);
        expect(result.windowDpsScore).toBeCloseTo(30_707.940468114255, 6);
    });

    it("honors a maintained Custom stack snapshot in fixed-window scoring", () => {
        const catalogWeapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(catalogWeapon).toBeDefined();
        const attackIndex = catalogWeapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const weapon = withSelectedAttack(catalogWeapon!, attackIndex);
        const mods = ["Galvanized Chamber", "Galvanized Aptitude"].map((name) => {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === name);
            expect(mod, name).toBeDefined();
            return mod!;
        });
        const effects = mods.map((mod) => mod.effectsByRank[mod.fusionLimit] ?? mod.effect);
        const target = { health: 2_000_000, shields: 0, overguard: 0, armor: 3_000 };
        const score = (conditionalState: ConditionalState) => debugEvaluateFixedWindowDps(
            weapon,
            effects,
            "Grineer",
            target,
            conditionalState,
        );

        const initial = score({ mode: "initial" });
        const customZero = score({ mode: "custom", externalStacks: 0 });
        const customFive = score({ mode: "custom", externalStacks: 5 });
        const fullyStacked = score({ mode: "fullyStacked" });

        expect(customZero.damageInWindow).toBeCloseTo(initial.damageInWindow, 10);
        expect(customFive.damageInWindow).toBeGreaterThan(customZero.damageInWindow);
        expect(customFive.damageInWindow).toBeCloseTo(fullyStacked.damageInWindow, 10);
    });

    it("uses a maintained Custom stack snapshot when optimizing fixed-window builds", { timeout: 30_000 }, () => {
        const target = { health: 2_000_000, shields: 0, overguard: 0, armor: 3_000 };
        const conditionalState: ConditionalState = { mode: "custom", externalStacks: 5 };
        const { result, weapon } = optimizeCatalogWindowFixture(
            "Braton Prime",
            "Normal Attack",
            "Grineer",
            target,
            conditionalState,
        );
        const independentScore = debugEvaluateFixedWindowDps(
            weapon,
            result.slots.map((mod, index) => mod
                ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
                : null),
            "Grineer",
            target,
            conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(result.slots.some((mod) => mod?.name === "Galvanized Chamber")).toBe(true);
        expect(result.slots.some((mod) => mod?.name === "Galvanized Aptitude")).toBe(true);
        expect(independentScore.damagePerSecond).toBeCloseTo(result.windowDpsScore!, 8);
        expect(independentScore.damageInWindow).toBeCloseTo(result.windowDpsDamage!, 8);
    });

    it("keeps refining the Laetum finite window until its critical replacement is selected", { timeout: 30_000 }, () => {
        const { result } = optimizeCatalogWindowFixture("Laetum", "Normal Attack");

        expect(result.capacityValid).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Primed Target Cracker")).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Hornet Strike")).toBe(false);
        expect(result.windowDpsScore).toBeCloseTo(56_869.970342600674, 6);
    });

    it("reserves melee attack-speed alternatives for a shielded Corpus heavy slam", { timeout: 15000 }, () => {
        const { result } = optimizeCatalogWindowFixture(
            "Arca Titron",
            "Heavy Slam Attack",
            "Corpus",
            { health: 2_000_000, shields: 2_000_000, overguard: 0, armor: 0 },
        );

        expect(result.capacityValid).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Primed Fury")).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Shocking Touch")).toBe(false);
        expect(result.mods.some((mod) => mod.name === "Melee Elementalist")).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Galvanized Elementalist")).toBe(false);
        expect(result.windowDpsScore).toBeGreaterThan(317_000);
    });

    it("reserves a second heat option for a high-health Infested Kuva Ogris window", { timeout: 60_000 }, () => {
        const { result } = optimizeCatalogWindowFixture(
            "Kuva Ogris",
            "Rocket Explosion",
            "Infested",
            { health: 10_000_000, shields: 0, overguard: 0, armor: 0 },
        );

        expect(result.capacityValid).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Hellfire")).toBe(true);
        expect(result.mods.some((mod) => mod.name === "Nightwatch Napalm")).toBe(false);
        expect(result.windowDpsScore).toBeGreaterThan(198_203);
    });

    it("scores Mausolon's linked Auto radial hit on the directly struck target", () => {
        const mausolon = getWeaponCatalog().find((entry) =>
            entry.name === "Mausolon" && entry.variantLabel === "Archwing",
        );
        expect(mausolon).toBeDefined();
        const autoIndex = mausolon!.attacks.findIndex((attack) => attack.name === "Auto");
        expect(autoIndex).toBeGreaterThanOrEqual(0);
        const auto = withSelectedAttack(mausolon!, autoIndex);
        const target = { health: 1_000_000_000, shields: 0, overguard: 0, armor: 0 };
        const linked = debugEvaluateFixedWindowDps(auto, [], "", target, { mode: "initial" });
        const directOnly = debugEvaluateFixedWindowDps({
            ...auto,
            selectedAttackLingeringDamageRule: undefined,
        }, [], "", target, { mode: "initial" });

        expect(linked.damageInWindow).toBeGreaterThan(directOnly.damageInWindow);
        expect(linked.encounter?.timeToKillSeconds).toBeNull();

        const atmosphereMausolon = getWeaponCatalog().find((entry) =>
            entry.name === "Mausolon" && entry.variantLabel === "Atmosphere",
        );
        expect(atmosphereMausolon).toBeDefined();
        const atmosphereAutoIndex = atmosphereMausolon!.attacks.findIndex((attack) => attack.name === "Auto");
        const atmosphereAuto = withSelectedAttack(atmosphereMausolon!, atmosphereAutoIndex);
        const archwingAt301m = debugEvaluateFixedWindowDps(auto, [], "", target, {
            mode: "initial",
            attackFalloffDistanceMeters: 301,
        });
        const atmosphereAt301m = debugEvaluateFixedWindowDps(atmosphereAuto, [], "", target, {
            mode: "initial",
            attackFalloffDistanceMeters: 301,
        });
        expect(archwingAt301m.damageInWindow).toBeGreaterThan(0);
        expect(atmosphereAt301m.damageInWindow).toBe(0);
        expect(atmosphereAt301m.damagePerSecond).toBe(0);
    });

    it("divides applied single-target damage by five seconds and clips overkill", () => {
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
            magazineSize: 40,
            reloadTime: 1,
        });
        const target = { health: 350, shields: 0, overguard: 0, armor: 0 };
        const evaluation = debugEvaluateFixedWindowDps(weapon, [], "", target, { mode: "initial" });

        expect(evaluation.windowSeconds).toBe(5);
        expect(evaluation.damageInWindow).toBe(350);
        expect(evaluation.damagePerSecond).toBe(70);
        expect(evaluation.timeToKillSeconds).toBe(3);

        const result = optimizeBuild(weapon, [], "windowDps", 0, {
            targetProfileOverride: target,
            conditionalState: { mode: "initial" },
        });
        expect(normalizeOptimizeGoal("windowDps")).toBe("windowDps");
        expect(result.windowDpsDamage).toBe(350);
        expect(result.windowDpsScore).toBe(70);
        expect(scoreOptimizerResultForConfiguration({
            weapon,
            result,
            goal: "windowDps",
            targetFaction: "",
            selectedAttackIdx: 0,
            targetProfileOverride: target,
            conditionalState: { mode: "initial" },
        })).toBe(70);

        const explanation = explainBuild(
            weapon,
            [],
            [],
            "windowDps",
            "",
            null,
            { mode: "initial" },
            target,
            {
                fixedWindowObjective: {
                    damage: 350,
                    damagePerSecond: 70,
                    windowSeconds: 5,
                    timeToKillSeconds: 3,
                    refined: false,
                    candidatesEvaluated: 1,
                },
            },
        );
        expect(explanation.summary).toContain("350.0 damage during [0, 5.0s)");
        expect(explanation.summary).toContain("Overkill and events at the window endpoint are excluded.");
        expect(explanation.summary).toContain("Reload, kill, and other event-triggered mod buffs start inactive");
    });

    it("includes an uncharged startup windup in finite optimizer scores and explains it", () => {
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
            fireRate: 2,
            magazineSize: 1,
            reloadTime: 0,
            trigger: "Charge",
            chargeTime: 6,
        });
        const target = { health: 100, shields: 0, overguard: 0, armor: 0 };

        const expectedTtk = debugEvaluateExpectedEncounter(weapon, [], "", target, { mode: "initial" });
        const fixedWindow = debugEvaluateFixedWindowDps(weapon, [], "", target, { mode: "initial" });
        const ttkResult = optimizeBuild(weapon, [], "timeToKill", 0, {
            targetProfileOverride: target,
            conditionalState: { mode: "initial" },
        });
        const windowResult = optimizeBuild(weapon, [], "windowDps", 0, {
            targetProfileOverride: target,
            conditionalState: { mode: "initial" },
        });
        const explanation = explainBuild(
            weapon,
            [],
            [],
            "windowDps",
            "",
            null,
            { mode: "initial" },
            target,
            {
                fixedWindowObjective: {
                    damage: fixedWindow.damageInWindow,
                    damagePerSecond: fixedWindow.damagePerSecond,
                    windowSeconds: fixedWindow.windowSeconds,
                    timeToKillSeconds: fixedWindow.timeToKillSeconds,
                    refined: false,
                    candidatesEvaluated: 1,
                },
            },
        );

        expect(expectedTtk.timeToKillSeconds).toBeCloseTo(6, 10);
        expect(fixedWindow.damageInWindow).toBe(0);
        expect(ttkResult.encounterTimeToKillSeconds).toBeCloseTo(6, 10);
        expect(windowResult.windowDpsDamage).toBe(0);
        expect(explanation.summary).toContain("starts uncharged and includes 6.00s before its first hit");
    });

    it("starts reload-triggered buffs inactive in the finite DPS window", () => {
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
            magazineSize: 40,
            reloadTime: 1,
        });
        const reloadBuff = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onReloadFromEmpty" as const,
                durationSeconds: 10,
                requiresAiming: false,
                maxStacks: 1,
                stats: { damageBonus: 2.2 },
            }],
        };
        const target = { health: 1_000_000_000, shields: 0, overguard: 0, armor: 0 };
        const baseline = debugEvaluateFixedWindowDps(weapon, [], "", target, { mode: "realistic" });
        const realistic = debugEvaluateFixedWindowDps(
            weapon, [reloadBuff], "", target, { mode: "realistic" },
        );
        const fullyStacked = debugEvaluateFixedWindowDps(
            weapon, [reloadBuff], "", target, { mode: "fullyStacked" },
        );

        expect(realistic.damageInWindow).toBeCloseTo(baseline.damageInWindow, 10);
        expect(fullyStacked.damageInWindow).toBeGreaterThan(baseline.damageInWindow);
    });

    it("selects Arcanes by the exact fixed-window score", () => {
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
            magazineSize: 40,
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
        const target = { health: 10_000, shields: 0, overguard: 0, armor: 0 };
        const damageArcane = makeArcane("Window Damage", { damageBonus: 0.5 });
        const fireRateArcane = makeArcane("Window Fire Rate", { fireRateBonus: 5 });
        const result = optimizeBuild(weapon, [], "windowDps", 0, {
            targetProfileOverride: target,
            conditionalState: { mode: "initial" },
            optimizeArcane: true,
            arcaneCandidates: [damageArcane, fireRateArcane],
        });

        expect(result.arcane?.name).toBe("Window Fire Rate");
        expect(result.windowDpsScore).toBeCloseTo(600, 8);
    });

    it("excludes configured neighboring targets from its score", () => {
        const weapon = makeWeapon({
            damage: {
                total: 100, impact: 0, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 100, toxin: 0,
                blast: 0, radiation: 0, gas: 0, magnetic: 0,
                viral: 0, corrosive: 0, void: 0, tau: 0, true: 0,
            },
            critChance: 0,
            critMultiplier: 1,
            statusChance: 1,
            fireRate: 1,
            magazineSize: 8,
            reloadTime: 1,
        });
        const target = { health: 100_000, shields: 0, overguard: 0, armor: 0 };
        const singleTarget = debugEvaluateFixedWindowDps(weapon, [], "", target, { mode: "initial" });
        const configuredNeighbors = debugEvaluateFixedWindowDps(
            weapon,
            [],
            "",
            { ...target, nearbyEnemyCount: 3, nearbyBlastEnemyCount: 3, nearbyGasOuterEnemyCount: 2 },
            { mode: "initial" },
        );

        expect(configuredNeighbors.damageInWindow).toBe(singleTarget.damageInWindow);
        expect(configuredNeighbors.damagePerSecond).toBe(singleTarget.damagePerSecond);
        expect(configuredNeighbors.encounter?.blastCollateralEnemyCount).toBe(0);
        expect(configuredNeighbors.encounter?.electricGasCollateralEnemyCount).toBe(0);
    });
});

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
    it("keeps custom Riven element order in the optimizer's elemental diversity key", () => {
        const baseWeapon = makeWeapon();
        const weapon = makeWeapon({
            damage: { ...baseWeapon.damage, total: 100, toxin: 0 },
        });
        const makeMod = (uniqueName: string, effect: ModEffect): ModEntry => ({
            uniqueName,
            path: uniqueName,
            name: uniqueName,
            compatBucket: "Rifle",
            rawCompatName: "Rifle",
            polarity: "madurai",
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
            incompatibilityGroup: uniqueName,
            compatibilityTags: [],
            incompatibilityTags: [],
        });
        const rivenEffect: ModEffect = {
            ...emptyEffect(),
            heatBonus: 0.9,
            coldBonus: 0.9,
            toxinBonus: 0.9,
            primaryElementOrder: ["toxin", "cold", "heat"],
        };
        const riven = makeMod("riven", rivenEffect);
        const electricity = makeMod("electricity", { ...emptyEffect(), electricityBonus: 0.9 });

        expect(debugExpectedEncounterElementTheme(weapon, [riven, electricity], [0, 0]))
            .toBe("radiation+viral");
    });

    it("includes Maiming Strike in the selected slide attack's legal critical builds", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Telos Boltace");
        expect(weapon).toBeDefined();
        const slideAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Stormpath Slide Attack");
        expect(slideAttackIndex).toBeGreaterThanOrEqual(0);
        const slideAttack = withSelectedAttack(weapon!, slideAttackIndex);
        const maimingStrike = filterBuilderExpertVariants(getModsForWeapon(weapon!))
            .find((mod) => mod.name === "Maiming Strike");
        expect(maimingStrike).toBeDefined();

        const result = optimizeBuild(slideAttack, [maimingStrike!], "burst", 1);
        expect(result.capacityValid).toBe(true);
        expect(result.slots[0]?.uniqueName).toBe(maimingStrike!.uniqueName);
        expect(result.slotRanks[0]).toBe(maimingStrike!.fusionLimit);
    });

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
        const completeModeledEffect = { ...emptyEffect(), ...(modeledEffect ?? {}) };
        const initial = calculateBuild(weapon, [completeModeledEffect], "", { conditionalState: { mode: "initial" } });
        const realistic = calculateBuild(weapon, [completeModeledEffect], "", { conditionalState: { mode: "realistic" } });

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

    it("keeps slot alternatives across outgoing effect families in melee Expected TTK refinement", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Gram Prime");
        expect(weapon).toBeDefined();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const attack = weapon!.attacks[attackIndex];
        expect(attack).toBeDefined();
        const stance = getStancesForWeapon(weapon!).find((entry) => entry.name === "Rending Crane");
        expect(stance).toBeDefined();
        const target = { health: 100_000, shields: 0, overguard: 0, armor: 3_000 };
        const result = optimizeBuild(
            weapon!,
            filterBuilderExpertVariants(getModsForWeapon(weapon!)),
            "timeToKill",
            weapon!.baseSlotCount,
            {
                targetFaction: "Grineer",
                targetProfileOverride: target,
                conditionalState: { mode: "initial" },
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
                optimizeArcane: false,
                optimizeExilus: false,
                buildForAttack: attack,
                extraCapacitySlots: [{
                    mod: stance!,
                    rank: stance!.fusionLimit,
                    polarity: weapon!.stancePolarity ?? stance!.polarity ?? "",
                }],
            },
        );
        const scored = debugEvaluateExpectedEncounter(
            withSelectedAttack(weapon!, attackIndex),
            result.slots.map((mod, index) => mod
                ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
                : null),
            "Grineer",
            target,
            { mode: "initial" },
        );

        expect(result.capacityValid).toBe(true);
        expect(countFormaLikeUi(
            weapon!,
            result.slotPolarities,
            weapon!.stancePolarity ?? "",
            result.exilusPolarity,
        )).toBeLessThanOrEqual(3);
        expect(result.slots.some((mod) => mod?.name === "True Steel")).toBe(true);
        expect(result.slots.some((mod) => mod?.name === "Primed Pressure Point")).toBe(true);
        expect(result.slots.some((mod) => mod?.name === "Lasting Sting")).toBe(false);
        expect(result.slots.some((mod) => mod?.name === "Condition Overload")).toBe(false);
        expect(scored.timeToKillSeconds).toBeCloseTo(6.838709677419354, 8);
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

        expect(overguardTarget.statusImmuneTypes).not.toContain("radiation");
        expect(overguardTarget.statusStackCaps.cold).toBe(4);
        expect(overguardTarget.statusStackCaps.blast).toBeUndefined();
        expect(overguardTarget.crowdControlImmune).toBe(true);
        expect(normalTarget.statusImmuneTypes).not.toContain("radiation");
        expect(normalTarget.statusStackCaps.cold).toBeUndefined();
    });

    it("carries faction and player headshot assumptions into optimizer damage profiles", () => {
        const grineer = getTargetProfileAssumptions("Grineer", { headshotHitRate: 0.35 });
        const corpus = getTargetProfileAssumptions("Corpus", { headshotHitRate: 0.8 });
        const charger = getTargetProfileAssumptions("Infested", {
            health: 80,
            shields: 0,
            overguard: 0,
            armor: 0,
            headshotHitRate: 0.5,
            headshotMultiplier: 1,
            criticalHeadshotMultiplier: 1,
        });

        expect(grineer).toMatchObject({
            headshotMultiplier: 3,
            criticalHeadshotMultiplier: 2,
            headIsWeakPoint: true,
            headshotHitRate: 0.35,
        });
        expect(corpus).toMatchObject({
            headshotMultiplier: 3,
            criticalHeadshotMultiplier: 1,
            headIsWeakPoint: true,
            headshotHitRate: 0.8,
        });
        expect(charger).toMatchObject({
            headshotMultiplier: 1,
            criticalHeadshotMultiplier: 1,
            headIsWeakPoint: true,
            headshotHitRate: 0.5,
        });
        expect(getTargetProfileAssumptions("Grineer", { headshotHitRate: Number.NaN }).headshotHitRate).toBe(0);
    });

    it("scores Eximus Advantage only for a headshot-enabled Eximus target", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Zylok Prime");
        expect(weapon).toBeDefined();
        const mod = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Eximus Advantage");
        expect(mod).toBeDefined();
        const conditionalState: ConditionalState = { mode: "realistic" };
        const score = (isEximusTarget: boolean, headshotHitRate: number) => debugScoreBuild(
            weapon!,
            [mod!.effect],
            "burst",
            "Grineer",
            null,
            { isEximusTarget, headshotHitRate },
            conditionalState,
        );

        expect(score(true, 1)).toBeGreaterThan(score(false, 1));
        expect(score(true, 1)).toBeGreaterThan(score(true, 0));
        expect(getTargetProfileAssumptions("Grineer", { isEximusTarget: true }).isEximusTarget).toBe(true);
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
        const weakPointTarget = {
            hitLocation: { headshotRate: 1, headIsWeakPoint: true },
        };
        const initialCritChance = calculateBuild(weapon!, [argonScope.effect], "", {
            conditionalState: { mode: "initial" },
            ...weakPointTarget,
        }).modded.critChance;
        const realisticCritChance = calculateBuild(weapon!, [argonScope.effect], "", {
            conditionalState: { mode: "realistic" },
            ...weakPointTarget,
        }).modded.critChance;
        expect(realisticCritChance - initialCritChance).toBeCloseTo(
            weapon!.critChance * 1.35 * (1 - Math.exp(-weapon!.fireRate * weapon!.multishot * 9)) * 0.75,
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

    it("scores Pain Points only on modeled weak-point Primary Fire hits", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Athodai");
        expect(weapon).toBeDefined();
        const painPoints = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Pain Points");
        expect(painPoints).toBeDefined();
        expect(painPoints!.effect.conditionalEffects[0]).toMatchObject({
            trigger: "onWeakPointHit",
            durationSeconds: 5,
            maxStacks: 10,
            requiresPrimaryFire: true,
            stats: { weakPointDamageBonus: 0.6 },
        });

        const targetProfileOverride = { headshotHitRate: 1, headIsWeakPoint: true };
        const normalAttack = optimizeBuild(weapon!, [painPoints!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride,
        });
        expect(normalAttack.slots[0]?.uniqueName).toBe(painPoints!.uniqueName);
        const explanation = explainBuild(
            weapon!,
            [painPoints!],
            [painPoints!.fusionLimit],
            "burst",
            "Grineer",
            undefined,
            undefined,
            targetProfileOverride,
        );
        expect(explanation.steps[0].why).toContain("Primary Fire only");
        expect(explanation.buildHighlights.some((line) => line.includes("independent arrivals") && line.includes("5 seconds after the latest hit"))).toBe(true);

        const noWeakPoint = optimizeBuild(weapon!, [painPoints!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride: { ...targetProfileOverride, headIsWeakPoint: false },
        });
        expect(noWeakPoint.slots).toEqual([null]);

        const noHeadHits = optimizeBuild(weapon!, [painPoints!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride: { ...targetProfileOverride, headshotHitRate: 0 },
        });
        expect(noHeadHits.slots).toEqual([null]);

        const altFire = weapon!.attacks.find((attack) => attack.name === "Alt-Fire");
        expect(altFire).toBeDefined();
        const alternateAttack = optimizeBuild(weapon!, [painPoints!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride,
            buildForAttack: altFire,
        });
        expect(alternateAttack.slots).toEqual([null]);
        const alternateExplanation = explainBuild(
            weapon!,
            [painPoints!],
            [painPoints!.fusionLimit],
            "burst",
            "Grineer",
            altFire,
            undefined,
            targetProfileOverride,
        );
        expect(alternateExplanation.buildHighlights).toContain("Pain Points' Primary Fire weak-point trigger is inactive for this Alt-Fire attack row.");

        const initialExplanation = explainBuild(
            weapon!,
            [painPoints!],
            [painPoints!.fusionLimit],
            "burst",
            "Grineer",
            undefined,
            { mode: "initial" },
            targetProfileOverride,
        );
        expect(initialExplanation.buildHighlights).toContain("The initial state starts with no Pain Points stacks; this score does not assume a weak-point hit history.");

        const fullyStackedAltFireExplanation = explainBuild(
            weapon!,
            [painPoints!],
            [painPoints!.fusionLimit],
            "burst",
            "Grineer",
            altFire,
            { mode: "fullyStacked" },
            targetProfileOverride,
        );
        expect(fullyStackedAltFireExplanation.buildHighlights).toContain("The fully stacked scenario assumes 10 Pain Points stacks without replaying weak-point hits. Primary Fire is the live trigger; this selected state supplies the stacks as a scenario override, including on Alt-Fire. Area coverage is not scored.");
        expect(fullyStackedAltFireExplanation.buildHighlights).not.toContain("Pain Points' Primary Fire weak-point trigger is inactive for this Alt-Fire attack row.");

        const customAltFireExplanation = explainBuild(
            weapon!,
            [painPoints!],
            [painPoints!.fusionLimit],
            "burst",
            "Grineer",
            altFire,
            { mode: "custom", externalStacks: 3 },
            targetProfileOverride,
        );
        expect(customAltFireExplanation.buildHighlights).toContain("The custom scenario assumes 3 Pain Points stacks without replaying weak-point hits. Primary Fire is the live trigger; this selected state supplies the stacks as a scenario override, including on Alt-Fire. Area coverage is not scored.");
    });

    it("scores Wiki-backed headshot bonuses at the configured hit share and keeps weak-point-only bonuses unscored", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Vulkar Wraith");
        expect(weapon).toBeDefined();
        const mods = getModsForWeapon(weapon!);
        const targetAcquired = mods.find((mod) => mod.name === "Target Acquired");
        const meticulousAim = mods.find((mod) => mod.name === "Meticulous Aim");
        const primaryAcuity = mods.find((mod) => mod.name === "Primary Acuity");
        expect(targetAcquired?.hasDamageEffect).toBe(true);
        expect(meticulousAim).toBeDefined();
        expect(primaryAcuity?.hasDamageEffect).toBe(true);
        expect(getUnmodeledDamageEffectLines(targetAcquired!, targetAcquired!.fusionLimit)).toEqual([]);
        expect(meticulousAim!.effectsByRank.map((effect) => effect.headshotMultiplierBonus)).toEqual([
            0.175, 0.35, 0.525, 0.7, 0.875, 1.05,
        ]);
        expect(meticulousAim!.effectsByRank.map((effect) => effect.bodyshotDamageBonus)).toEqual([
            -0.075, -0.15, -0.225, -0.3, -0.375, -0.45,
        ]);
        expect(getUnmodeledDamageEffectLines(primaryAcuity!, primaryAcuity!.fusionLimit)).toEqual(expect.arrayContaining([
            "Effect: Weak-point damage bonus is not scored because the target's weak-point rules are not modeled.",
            "Effect: Weak-point critical chance bonus is not scored because the target's weak-point rules are not modeled.",
        ]));

        expect(getUnmodeledDamageEffectLines(primaryAcuity!, primaryAcuity!.fusionLimit, { headIsWeakPoint: true })).toEqual([]);
        expect(getUnmodeledDamageEffectLines(primaryAcuity!, primaryAcuity!.fusionLimit, { headIsWeakPoint: false })).toEqual(expect.arrayContaining([
            "Effect: Weak-point damage bonus is not scored because the selected target's head is not a modeled weak point.",
            "Effect: Weak-point critical chance bonus is not scored because the selected target's head is not a modeled weak point.",
        ]));

        const target = { headshotHitRate: 1, headIsWeakPoint: true };
        const baseline = debugScoreBuild(weapon!, [], "burst", "Grineer", null, target, { mode: "initial" });
        const headshotScore = debugScoreBuild(
            weapon!,
            [targetAcquired!.effectsByRank[targetAcquired!.fusionLimit]],
            "burst",
            "Grineer",
            null,
            target,
            { mode: "initial" },
        );
        expect(headshotScore).toBeGreaterThan(baseline);

        const splitChamber = mods.find((mod) => mod.name === "Split Chamber");
        expect(splitChamber).toBeDefined();
        const acuityScore = debugScoreBuild(
            weapon!,
            [primaryAcuity!.effectsByRank[primaryAcuity!.fusionLimit]],
            "burst",
            "Grineer",
            null,
            target,
            { mode: "initial" },
        );
        const splitChamberOnlyScore = debugScoreBuild(
            weapon!,
            [splitChamber!.effectsByRank[splitChamber!.fusionLimit]],
            "burst",
            "Grineer",
            null,
            target,
            { mode: "initial" },
        );
        const acuityAndSplitChamberScore = debugScoreBuild(
            weapon!,
            [
                primaryAcuity!.effectsByRank[primaryAcuity!.fusionLimit],
                splitChamber!.effectsByRank[splitChamber!.fusionLimit],
            ],
            "burst",
            "Grineer",
            null,
            target,
            { mode: "initial" },
        );
        expect(splitChamberOnlyScore).toBeGreaterThan(baseline);
        expect(acuityAndSplitChamberScore).toBeCloseTo(acuityScore, 10);

        const optimizedHeadWeakpoint = optimizeBuild(weapon!, [primaryAcuity!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride: { headshotHitRate: 1, headIsWeakPoint: true },
        });
        expect(optimizedHeadWeakpoint.slots[0]?.uniqueName).toBe(primaryAcuity!.uniqueName);
        const optimizedBodyOnly = optimizeBuild(weapon!, [primaryAcuity!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride: { headshotHitRate: 0, headIsWeakPoint: true },
        });
        expect(optimizedBodyOnly.slots).toEqual([null]);
        const optimizedNonWeakpoint = optimizeBuild(weapon!, [primaryAcuity!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride: { headshotHitRate: 1, headIsWeakPoint: false },
        });
        expect(optimizedNonWeakpoint.slots).toEqual([null]);

        const result = optimizeBuild(weapon!, [primaryAcuity!], "burst", 1, { allowForma: false });
        expect(result.slots).toEqual([null]);
    });

    it("keeps Combustion Beam out of Auto Optimize until its kill explosion is modeled", () => {
        const amprex = getWeaponCatalog().find((candidate) => candidate.name === "Amprex");
        expect(amprex).toBeDefined();
        const combustionBeam = getModsForWeapon(amprex!).find((mod) => mod.name === "Combustion Beam");
        expect(combustionBeam).toBeDefined();
        expect(getUnmodeledDamageEffectLines(combustionBeam!, combustionBeam!.fusionLimit).length).toBeGreaterThan(0);

        const result = optimizeBuild(amprex!, [combustionBeam!], "burst", 1, { allowForma: false });
        expect(result.slots).toEqual([null]);
    });

    it("models Stinging Truth's flat magazine bonus but keeps Truth's unmodeled radial effect out of Auto Optimize", () => {
        const weapons = getWeaponCatalog();
        const viper = weapons.find((candidate) => candidate.name === "Viper");
        const burstonPrime = weapons.find((candidate) => candidate.name === "Burston Prime");
        expect(viper).toBeDefined();
        expect(burstonPrime).toBeDefined();

        const stingingTruth = getModsForWeapon(viper!).find((mod) => mod.name === "Stinging Truth");
        const gildedTruth = getModsForWeapon(burstonPrime!).find((mod) => mod.name === "Gilded Truth");
        expect(stingingTruth).toBeDefined();
        expect(gildedTruth).toBeDefined();
        expect(stingingTruth!.hasDamageEffect).toBe(true);
        expect(stingingTruth!.effectsByRank[stingingTruth!.fusionLimit].magazineCapacityFlatBonus).toBe(40);
        expect(gildedTruth!.effectsByRank[gildedTruth!.fusionLimit].fireRateBonus).toBeCloseTo(0.8, 12);

        for (const mod of [stingingTruth!, gildedTruth!]) {
            for (let rank = 0; rank <= mod.fusionLimit; rank++) {
                expect(getUnmodeledDamageEffectLines(mod, rank)).toContain(
                    "Truth's Affinity-earned syndicate effect (radial Gas damage, 25% Health restore, and a temporary +25% Parkour Maneuvers buff) is not modeled, so Auto Optimize skips this mod.",
                );
            }
            expect(getUnmodeledDamageEffectSourceUrl(mod)).toBe("https://wiki.warframe.com/w/Syndicates");
        }

        expect(optimizeBuild(viper!, [stingingTruth!], "burst", 1, { allowForma: false }).slots).toEqual([null]);
        expect(optimizeBuild(burstonPrime!, [gildedTruth!], "burst", 1, { allowForma: false }).slots).toEqual([null]);
    });

    it("scores one bounded on-death Blast only for a direct Jat Kittag Normal Attack Burst kill", () => {
        const jatKittag = getWeaponCatalog().find((candidate) => candidate.name === "Jat Kittag");
        expect(jatKittag).toBeDefined();
        const vulcanBlitz = getModsForWeapon(jatKittag!).find((mod) => mod.name === "Vulcan Blitz");
        expect(vulcanBlitz).toBeDefined();
        const normalIndex = jatKittag!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(normalIndex).toBeGreaterThanOrEqual(0);
        const normalAttack = withSelectedAttack(jatKittag!, normalIndex);
        const target = {
            health: 120,
            shields: 0,
            overguard: 0,
            armor: 0,
            nearbyVulcanBlitzEnemyCount: 2,
            nearbyVulcanBlitzAverageDistanceMeters: 3,
        };
        const baselineBurst = debugScoreBuild(normalAttack, [], "burst", "Grineer", null, target);
        const rankFiveBurst = debugScoreBuild(
            normalAttack,
            [vulcanBlitz!.effectsByRank[5]!],
            "burst",
            "Grineer",
            null,
            target,
        );
        expect(rankFiveBurst).toBeGreaterThan(baselineBurst);

        const noNeighbors = { ...target, nearbyVulcanBlitzEnemyCount: 0 };
        expect(debugScoreBuild(normalAttack, [vulcanBlitz!.effectsByRank[5]!], "burst", "Grineer", null, noNeighbors))
            .toBeCloseTo(baselineBurst, 9);
        const atRankRadius = { ...target, nearbyVulcanBlitzAverageDistanceMeters: 3 };
        expect(debugScoreBuild(normalAttack, [vulcanBlitz!.effectsByRank[2]!], "burst", "Grineer", null, atRankRadius))
            .toBeCloseTo(baselineBurst, 9);
        const tooHealthy = { ...target, health: 20_000 };
        expect(debugScoreBuild(normalAttack, [vulcanBlitz!.effectsByRank[5]!], "burst", "Grineer", null, tooHealthy))
            .toBeCloseTo(debugScoreBuild(normalAttack, [], "burst", "Grineer", null, tooHealthy), 9);
        expect(debugScoreBuild(normalAttack, [vulcanBlitz!.effectsByRank[5]!], "scaling", "Grineer", null, target))
            .toBeCloseTo(debugScoreBuild(normalAttack, [], "scaling", "Grineer", null, target), 9);
        expect(debugEvaluateExpectedEncounter(normalAttack, [vulcanBlitz!.effectsByRank[5]!], "Grineer", target).damagePerSecond)
            .toBeCloseTo(debugEvaluateExpectedEncounter(normalAttack, [], "Grineer", target).damagePerSecond, 9);
        expect(debugEvaluateFixedWindowDps(normalAttack, [vulcanBlitz!.effectsByRank[5]!], "Grineer", target).damageInWindow)
            .toBeCloseTo(debugEvaluateFixedWindowDps(normalAttack, [], "Grineer", target).damageInWindow, 9);

        const options = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
            targetProfileOverride: target,
        };
        expect(optimizeBuild(normalAttack, [vulcanBlitz!], "burst", 1, options).slots.some((mod) => mod?.name === "Vulcan Blitz"))
            .toBe(true);
        expect(optimizeBuild(normalAttack, [vulcanBlitz!], "burst", 1, {
            ...options,
            targetProfileOverride: noNeighbors,
        }).slots).toEqual([null]);
        expect(optimizeBuild(normalAttack, [vulcanBlitz!], "burst", 1, {
            ...options,
            targetProfileOverride: tooHealthy,
        }).slots).toEqual([null]);
        expect(optimizeBuild(normalAttack, [vulcanBlitz!], "timeToKill", 1, options).slots).toEqual([null]);

        const explanation = explainBuild(
            normalAttack,
            [vulcanBlitz!],
            [5],
            "burst",
            "Grineer",
            undefined,
            undefined,
            target,
        );
        expect(explanation.summary).toContain("Vulcan Blitz group score estimate");
        expect(explanation.buildHighlights.join(" ")).toContain("each scored Normal Attack event as a fresh same-profile health-only primary target");
        expect(explanation.buildHighlights.join(" ")).toContain("neighbor depletion and explosion kills do not chain");
    });

    it("keeps Thermagnetic Shells out of Auto Optimize while its on-death area damage is unmodeled", () => {
        const detron = getWeaponCatalog().find((candidate) => candidate.name === "Detron");
        expect(detron).toBeDefined();
        const thermagneticShells = getModsForWeapon(detron!).find((mod) => mod.name === "Thermagnetic Shells");
        expect(thermagneticShells).toBeDefined();
        expect(getUnmodeledDamageEffectSourceUrl(thermagneticShells!)).toBe("https://wiki.warframe.com/w/Thermagnetic_Shells");
        for (let rank = 0; rank <= thermagneticShells!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(thermagneticShells!, rank)).toContain(
                "Thermagnetic Shells triggers an on-death explosion: 20–80 Magnetic Damage plus 10–40% of the triggering enemy's max Health as Blast Damage in a 6m radius. Linear falloff and line of sight apply. The Wiki says Elemental Ammo status effects no longer recursively retrigger these death explosions; the planner still does not resolve on-kill area damage, adjacent-target deaths, or mission-specific max-Health scaling, so Auto Optimize skips the mod.",
            );
        }

        const result = optimizeBuild(detron!, [thermagneticShells!], "burst", 1, { allowForma: false });
        expect(result.slots).toEqual([null]);
    });

    it("keeps Entropy Detonation out of Auto Optimize while disclosing its unmodeled area effect", () => {
        const obex = getWeaponCatalog().find((candidate) => candidate.name === "Obex");
        expect(obex).toBeDefined();
        const entropyDetonation = getModsForWeapon(obex!).find((mod) => mod.name === "Entropy Detonation");
        expect(entropyDetonation).toBeDefined();
        expect(getUnmodeledDamageEffectSourceUrl(entropyDetonation!)).toBe("https://wiki.warframe.com/w/Entropy_Detonation");
        for (let rank = 0; rank <= entropyDetonation!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(entropyDetonation!, rank)).toContain(
                "Entropy Detonation triggers only when a Ground Finisher kills an enemy. Its rank-scaled Blast explosion combines flat damage with a percentage of enemy Max Health, reaches the selected rank’s radius, and requires line of sight; Ground Finishers, explosion damage resolution, and the Entropy effect are not modeled, so Auto Optimize skips this mod.",
            );
        }
        const result = optimizeBuild(obex!, [entropyDetonation!], "meleeDps", 1, { allowForma: false });
        expect(result.slots).toEqual([null]);
    });

    it("keeps Amalgam Furax Body Count out of Auto Optimize instead of scoring only its supported stats", () => {
        const furax = getWeaponCatalog().find((candidate) => candidate.name === "Furax");
        expect(furax).toBeDefined();
        const amalgamBodyCount = getModsForWeapon(furax!).find((mod) => mod.name === "Amalgam Furax Body Count");
        expect(amalgamBodyCount).toBeDefined();
        expect(getUnmodeledDamageEffectSourceUrl(amalgamBodyCount!)).toBe("https://wiki.warframe.com/w/Amalgam_Furax_Body_Count");
        expect(amalgamBodyCount!.effect.fireRateBonus).toBeCloseTo(0.45);
        expect(amalgamBodyCount!.effect.comboDurationBonus).toBeCloseTo(15);
        const explanation = explainBuild(
            furax!,
            [amalgamBodyCount!],
            [amalgamBodyCount!.fusionLimit],
            "burst",
        );
        expect(explanation.steps[0]?.why).toContain("+15s Combo Duration");
        expect(explanation.steps[0]?.why).not.toContain("+1500% Combo Duration");
        for (let rank = 0; rank <= amalgamBodyCount!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(amalgamBodyCount!, rank)).toContain(
                "Amalgam Furax Body Count triggers on melee kills, including melee DoT kills but not Exalted or pseudo-exalted kills. It applies Blast/Stagger in the selected rank’s radius through line of sight. The Wiki reports a variable ~6 Blast/Impact procs (up to 10) and only 1 damage per Blast stack; it also notes these procs can trigger Shattering Impact. That armor-strip interaction, neighboring-target proc history, and stagger utility are not modeled, so Auto Optimize skips this mod.",
            );
        }
        const result = optimizeBuild(furax!, [amalgamBodyCount!], "meleeDps", 1, { allowForma: false });
        expect(result.slots).toEqual([null]);
    });

    it("keeps Combat Reload out of Auto Optimize despite a manual active-buff snapshot", () => {
        const tigris = getWeaponCatalog().find((weapon) => weapon.name === "Tigris");
        expect(tigris).toBeDefined();
        const combatReload = getModsForWeapon(tigris!).find((mod) => mod.name === "Combat Reload");
        expect(combatReload).toBeDefined();
        expect(getUnmodeledDamageEffectLines(combatReload!, combatReload!.fusionLimit)).toContain(
            "Combat Reload requires five Tigris pellets to land on headshot locations and grants rank-scaled Reload Speed for 3s. Per-pellet headshot probability and buff expiry/refresh timing are not modeled, so Realistic leaves the effect inactive. Custom/Fully Stacked can represent a manual active-buff snapshot; Auto Optimize skips this mod.",
        );

        const result = optimizeBuild(tigris!, [combatReload!], "timeToKill", 1, {
            allowForma: false,
            targetFaction: "Grineer",
            conditionalState: { mode: "custom", externalStacks: 1 },
        });
        expect(result.capacityValid).toBe(true);
        expect(result.slots.filter(Boolean)).toHaveLength(0);
    });

    it("scores Vile Discharge only through its dedicated Embolist cycle objective", () => {
        const embolist = getWeaponCatalog().find((weapon) => weapon.name === "Embolist");
        expect(embolist).toBeDefined();
        const vileDischarge = getModsForWeapon(embolist!).find((mod) => mod.name === "Vile Discharge");
        expect(vileDischarge).toBeDefined();
        expect(getUnmodeledDamageEffectLines(vileDischarge!, vileDischarge!.fusionLimit)).toContain(
            "Vile Discharge is scored only by the Embolist Normal Attack cycle objective. It models primary hits and expected DoT ticks charging to the rank cap, then a no-crit/no-status contact and 6m Toxin explosion with reload/action timing. The selected target is centered; configured same-profile neighbors in 0–3m and 3–6m bands use an area-uniform linear falloff estimate because the Wiki gives only approximate 80% edge falloff. Auto Optimize excludes it from other objectives. Wiki: https://wiki.warframe.com/w/Vile_Discharge",
        );

        const standardResult = optimizeBuild(embolist!, [vileDischarge!], "burst", 1, { allowForma: false });
        expect(standardResult.capacityValid).toBe(true);
        expect(standardResult.slots.filter(Boolean)).toHaveLength(0);

        const normalAttackIndex = embolist!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const normalAttack = embolist!.attacks[normalAttackIndex];
        const normalAttackWeapon = withSelectedAttack(embolist!, normalAttackIndex);
        const cycleResult = optimizeBuild(embolist!, [vileDischarge!], "vileDischargeDps", 1, {
            allowForma: false,
            buildForAttack: normalAttack,
        });
        expect(cycleResult.capacityValid).toBe(true);
        expect(cycleResult.slots.filter(Boolean)).toContain(vileDischarge);

        const centeredTarget = { health: 100_000, shields: 0, overguard: 0, armor: 0 };
        const centeredScore = debugScoreBuild(normalAttackWeapon, [vileDischarge!.effect], "vileDischargeDps", "", null, centeredTarget);
        const neighborScore = debugScoreBuild(normalAttackWeapon, [vileDischarge!.effect], "vileDischargeDps", "", null, {
            ...centeredTarget,
            nearbyEnemyCount: 1,
            nearbyGasOuterEnemyCount: 1,
        });
        expect(neighborScore).toBeGreaterThan(centeredScore);
    });

    it("matches seeded Vile Discharge optimizer winners across four target strata", { timeout: 300_000 }, () => {
        const scenarios = [
            { faction: "Grineer", target: { health: 100_000, shields: 0, overguard: 0, armor: 3_000 } },
            { faction: "Corpus", target: { health: 100_000, shields: 50_000, overguard: 0, armor: 0 } },
            { faction: "Infested", target: { health: 120_000, shields: 0, overguard: 0, armor: 0 } },
            { faction: "Orokin", target: { health: 100_000, shields: 20_000, overguard: 0, armor: 1_000 } },
        ];
        let seed = 20261166;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const baseWeapon = getWeaponCatalog().find((weapon) => weapon.name === "Embolist");
        expect(baseWeapon).toBeDefined();
        const attackIndex = baseWeapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const weapon = withSelectedAttack(baseWeapon!, attackIndex);
        const available = getModsForWeapon(weapon);
        const byName = (name: string) => available.find((mod) => mod.name === name);
        const vileDischarge = byName("Vile Discharge");
        expect(vileDischarge).toBeDefined();
        const candidateNames = [
            "Hornet Strike",
            "Barrel Diffusion",
            "Lethal Torrent",
            "Pistol Pestilence",
            "Pistol Gambit",
            "Target Cracker",
            "Jolt",
            "Pistol Elementalist",
        ];
        const randomCandidates = candidateNames.map(byName).filter((mod): mod is ModEntry => mod !== undefined);
        const scoringContext = {
            selectedGoal: "vileDischargeDps",
            selectedWeaponName: "Embolist",
            selectedAttackName: "Normal Attack",
        };
        const conditionalState: ConditionalState = { mode: "initial" };

        for (const scenario of scenarios) {
            const shuffled = [...randomCandidates];
            for (let index = shuffled.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
            }
            const nearbyEnemyCount = Math.floor(random() * 3);
            const nearbyGasOuterEnemyCount = Math.floor(random() * 3);
            const targetProfileOverride = {
                ...scenario.target,
                nearbyEnemyCount,
                nearbyGasOuterEnemyCount,
            };
            const sampledMods = [vileDischarge!, ...shuffled.slice(0, 3)];
            const ownedRankCaps = Object.fromEntries(sampledMods.map((mod) => [mod.uniqueName, Math.floor(random() * 2)]));
            const rankOptions = new Map(sampledMods.map((mod) => [
                mod.uniqueName,
                Array.from({ length: ownedRankCaps[mod.uniqueName] + 1 }, (_, rank) => rank).filter((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank, scoringContext).length === 0,
                ),
            ]));
            const exactScores: number[] = [];
            const visit = (nextIndex: number, selected: Array<{ mod: ModEntry; rank: number }>) => {
                if (selected.some(({ mod }) => mod.uniqueName === vileDischarge!.uniqueName)) {
                    exactScores.push(debugScoreBuild(
                        weapon,
                        selected.map(({ mod, rank }) => mod.effectsByRank[rank] ?? mod.effect),
                        "vileDischargeDps",
                        scenario.faction,
                        null,
                        targetProfileOverride,
                        conditionalState,
                    ));
                }
                if (selected.length >= 2) return;
                for (let index = nextIndex; index < sampledMods.length; index++) {
                    const mod = sampledMods[index];
                    if (selected.some((entry) => entry.mod.incompatibilityGroup === mod.incompatibilityGroup)) continue;
                    for (const rank of rankOptions.get(mod.uniqueName) ?? []) {
                        visit(index + 1, [...selected, { mod, rank }]);
                    }
                }
            };
            visit(0, []);

            const optimized = optimizeBuild(weapon, sampledMods, "vileDischargeDps", 2, {
                targetFaction: scenario.faction,
                targetProfileOverride,
                conditionalState,
                allowNonMaxRank: true,
                ownedModMaxRankByUniqueName: ownedRankCaps,
                allowForma: false,
                capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
            });
            const optimizerScore = scoreOptimizerResultForConfiguration({
                weapon,
                result: optimized,
                goal: "vileDischargeDps",
                targetFaction: scenario.faction,
                selectedAttackIdx: attackIndex,
                targetProfileOverride,
                conditionalState,
            });
            expect(exactScores.length, `${scenario.faction} exact pool size`).toBeGreaterThan(1);
            expect(optimized.capacityValid, `${scenario.faction} capacity`).toBe(true);
            expect(optimized.slots.some((mod) => mod?.uniqueName === vileDischarge!.uniqueName), `${scenario.faction} enabler`).toBe(true);
            expect(optimizerScore, `${scenario.faction} sampled-pool winner`).toBeCloseTo(Math.max(...exactScores), 7);
        }
    });

    it("keeps Overpressured Rounds excluded from Auto Optimize while documenting the manual Burst snapshot", () => {
        const efv5 = getWeaponCatalog().find((weapon) => weapon.name.toLowerCase() === "efv-5 jupiter");
        expect(efv5).toBeDefined();
        const overpressuredRounds = getModsForWeapon(efv5!).find((mod) => mod.name === "Overpressured Rounds");
        expect(overpressuredRounds).toBeDefined();
        expect(overpressuredRounds!.hasDamageEffect).toBe(true);
        expect(overpressuredRounds!.effectsByRank.map((effect) => effect.overpressuredRoundsFalloffDistanceBonus))
            .toEqual([0.2, 0.4, 0.6, 0.8, 1, 1.2]);
        expect(getUnmodeledDamageEffectSourceUrl(overpressuredRounds!)).toBe(
            "https://wiki.warframe.com/w/Overpressured_Rounds",
        );

        const expectedRankText = [
            "Rifle kills add 20% Falloff Distance and decrease Spread for next attack with Buckshot. Buckshot kills restore 25% of the current Magazine.",
            "Rifle kills add 40% Falloff Distance and decrease Spread for next attack with Buckshot. Buckshot kills restore 30% of the current Magazine.",
            "Rifle kills add 60% Falloff Distance and decrease Spread for next attack with Buckshot. Buckshot kills restore 35% of the current Magazine.",
            "Rifle kills add 80% Falloff Distance and decrease Spread for next attack with Buckshot. Buckshot kills restore 40% of the current Magazine.",
            "Rifle kills add 100% Falloff Distance and decrease Spread for next attack with Buckshot. Buckshot kills restore 45% of the current Magazine.",
            "Rifle kills add 120% Falloff Distance and decrease Spread for next attack with Buckshot. Buckshot kills restore 50% of the current Magazine.",
        ];
        expect(overpressuredRounds!.statsTextByRank).toEqual(expectedRankText);
        for (let rank = 0; rank <= overpressuredRounds!.fusionLimit; rank++) {
            expect(overpressuredRounds!.unparsedStatsByRank?.[rank]).toEqual([expectedRankText[rank]]);
            expect(getUnmodeledDamageEffectLines(overpressuredRounds!, rank)).toContain(
                "Overpressured Rounds' Rifle-kill buff applies only to the next Buckshot, and its magazine restore requires a Buckshot kill. The planner does not simulate cross-mode kill history or ammo changes, and the Wiki does not specify the spread reduction. An optional user-entered effective post-kill spread range enables an experimental single-target Burst estimate and applies the selected rank's sourced Falloff Distance bonus to the entered target distance. This models one assumed post-kill Buckshot event only; it does not simulate the prior Rifle kill, one-shot buff consumption, or repeat-fire history. Finite TTK, 5s Avg DPS, and Magazine Restore remain unscored, and Auto Optimize skips the mod.",
            );
        }

        const result = optimizeBuild(efv5!, [overpressuredRounds!], "burst", 1, { allowForma: false });
        expect(result.capacityValid).toBe(true);
        expect(result.slots.filter(Boolean)).toHaveLength(0);
    });

    it("optimizes Precision Strike only for Tonkor direct-hit reload scoring", () => {
        const tonkor = getWeaponCatalog().find((weapon) => weapon.name === "Tonkor");
        expect(tonkor).toBeDefined();
        const impact = withSelectedAttack(
            tonkor!,
            tonkor!.attacks.findIndex((attack) => attack.name === "Grenade Impact"),
        );
        const explosion = withSelectedAttack(
            tonkor!,
            tonkor!.attacks.findIndex((attack) => attack.name === "Grenade Explosion"),
        );
        const precisionStrike = getModsForWeapon(tonkor!).find((mod) => mod.name === "Precision Strike");
        expect(precisionStrike).toBeDefined();
        expect(precisionStrike!.hasDamageEffect).toBe(true);

        const target = { health: 5_000, shields: 0, overguard: 0, armor: 0 };
        const options = {
            allowForma: false,
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState: { mode: "initial" as const },
        };
        const baseline = debugEvaluateExpectedEncounter(impact, [], "Grineer", target, options.conditionalState);
        const withPrecision = debugEvaluateExpectedEncounter(
            impact,
            [precisionStrike!.effectsByRank[precisionStrike!.fusionLimit]],
            "Grineer",
            target,
            options.conditionalState,
        );
        expect(withPrecision.timeToKillSeconds).toBeLessThan(baseline.timeToKillSeconds ?? Number.POSITIVE_INFINITY);

        const directHitBuild = optimizeBuild(impact, [precisionStrike!], "timeToKill", 1, options);
        expect(directHitBuild.capacityValid).toBe(true);
        expect(directHitBuild.slots).toContain(precisionStrike);
        expect(directHitBuild.encounterTimeToKillSeconds).toBeCloseTo(withPrecision.timeToKillSeconds!, 8);

        const burstBuild = optimizeBuild(impact, [precisionStrike!], "burst", 1, options);
        expect(burstBuild.slots).not.toContain(precisionStrike);
        expect(() => optimizeBuild(explosion, [precisionStrike!], "timeToKill", 1, options))
            .toThrow("Optimization is unavailable for Grenade Explosion");
        expect(getUnmodeledDamageEffectLines(precisionStrike!, precisionStrike!.fusionLimit, {
            selectedAttackName: explosion.selectedAttackName,
            selectedAttackIsAreaDamage: explosion.selectedAttackIsAreaDamage,
        })).toContain("Precision Strike's Reload Speed bonus requires a direct Tonkor grenade hit. The selected attack does not model that trigger, so Auto Optimize skips this mod.");
    }, 20_000);

    it("only optimizes Sentient Incision when its adaptive element is resolved for the selected score", () => {
        const venato = getWeaponCatalog().find((candidate) => candidate.name === "Venato");
        expect(venato).toBeDefined();
        const sentientIncision = getModsForWeapon(venato!).find((mod) => mod.name === "Sentient Incision");
        expect(sentientIncision).toBeDefined();
        expect(getUnmodeledDamageEffectLines(sentientIncision!, sentientIncision!.fusionLimit, { targetFaction: "" })).toContain(
            "Sentient Incision needs a supported target faction or active Overguard to select its adaptive damage type. No matching target is selected, so Auto Optimize skips this mod. Wiki: https://wiki.warframe.com/w/Sentient_Incision",
        );

        const noTarget = optimizeBuild(venato!, [sentientIncision!], "burst", 1, { allowForma: false });
        expect(noTarget.slots.filter(Boolean)).toHaveLength(0);

        const grineerBurst = optimizeBuild(venato!, [sentientIncision!], "burst", 1, {
            allowForma: false,
            targetFaction: "Grineer",
        });
        expect(grineerBurst.capacityValid).toBe(true);
        expect(grineerBurst.slots.filter(Boolean).map((mod) => mod?.name)).toContain("Sentient Incision");

        const overguardTarget = { health: 5_000, shields: 0, overguard: 1_000, armor: 0 };
        const overguardBurst = optimizeBuild(venato!, [sentientIncision!], "burst", 1, {
            allowForma: false,
            targetFaction: "Corpus",
            targetProfileOverride: overguardTarget,
        });
        expect(overguardBurst.slots.filter(Boolean).map((mod) => mod?.name)).toContain("Sentient Incision");

        const overguardTtk = optimizeBuild(venato!, [sentientIncision!], "timeToKill", 1, {
            allowForma: false,
            targetFaction: "Corpus",
            targetProfileOverride: overguardTarget,
        });
        expect(overguardTtk.slots.filter(Boolean)).toHaveLength(0);
    });

    it("keeps Wiki-modeled Nightwatch Napalm eligible and scores it in finite Expected TTK", () => {
        const kuvaOgris = getWeaponCatalog().find((candidate) => candidate.name === "Kuva Ogris");
        expect(kuvaOgris).toBeDefined();
        const explosionIndex = kuvaOgris!.attacks.findIndex((attack) => attack.name === "Rocket Explosion");
        expect(explosionIndex).toBeGreaterThanOrEqual(0);
        const weapon = withSelectedAttack(kuvaOgris!, explosionIndex);
        const builderMods = filterBuilderExpertVariants(getModsForWeapon(kuvaOgris!));
        const napalm = builderMods.find((candidate) => candidate.name === "Nightwatch Napalm");
        expect(napalm).toBeDefined();
        expect(napalm!.hasDamageEffect).toBe(true);
        expect(getUnmodeledDamageEffectLines(napalm!, napalm!.fusionLimit)).toEqual([]);

        const target = { health: 5_000, shields: 0, overguard: 0, armor: 0 };
        const baseline = debugScoreExpectedEncounter(weapon, [], "", target, { mode: "initial" });
        const withNapalm = debugScoreExpectedEncounter(
            weapon,
            [napalm!.effectsByRank[napalm!.fusionLimit]],
            "",
            target,
            { mode: "initial" },
        );
        expect(withNapalm.timeToKillSeconds).not.toBeNull();
        expect(withNapalm.timeToKillSeconds).toBeLessThan(baseline.timeToKillSeconds ?? Number.POSITIVE_INFINITY);

        const optimized = optimizeBuild(weapon, [napalm!], "timeToKill", 1, {
            allowForma: false,
            targetFaction: "",
            targetProfileOverride: target,
            conditionalState: { mode: "initial" },
        });
        expect(optimized.capacityValid).toBe(true);
        expect(optimized.slots).toContain(napalm);
        expect(optimized.encounterTimeToKillSeconds).toBeCloseTo(withNapalm.timeToKillSeconds!, 8);

        const highHealthOptimization = optimizeBuild(
            weapon,
            builderMods,
            "timeToKill",
            8,
            {
                allowForma: false,
                targetFaction: "",
                targetProfileOverride: { health: 100_000, shields: 0, overguard: 0, armor: 0 },
                conditionalState: { mode: "initial" },
                optimizeArcane: false,
                optimizeExilus: false,
            },
        );
        expect(highHealthOptimization.capacityValid).toBe(true);
        expect(highHealthOptimization.slots).toContain(napalm);
    }, 60_000);

    it("scores Primary Deadhead's Wiki headshot bonus when the configured target can be headshot", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Vulkar Wraith");
        const primaryDeadhead = getArcanesByWeaponCategory("Primary").find((arcane) => arcane.name === "Primary Deadhead");
        expect(weapon).toBeDefined();
        expect(primaryDeadhead).toBeDefined();
        expect(getUnmodeledScoringEffectLines(primaryDeadhead!.optimizerEffectByRank[primaryDeadhead!.maxRank]))
            .toEqual([]);

        const bodyOnly = optimizeBuild(weapon!, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [primaryDeadhead!],
            ownedArcaneUniqueNames: new Set([primaryDeadhead!.uniqueName]),
            ownedArcaneMaxRankByUniqueName: { [primaryDeadhead!.uniqueName]: primaryDeadhead!.maxRank },
            targetFaction: "Grineer",
            targetProfileOverride: { headshotHitRate: 0 },
            conditionalState: { mode: "initial" },
        });
        expect(bodyOnly.arcane).toBeNull();

        const headshotBuild = optimizeBuild(weapon!, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [primaryDeadhead!],
            ownedArcaneUniqueNames: new Set([primaryDeadhead!.uniqueName]),
            ownedArcaneMaxRankByUniqueName: { [primaryDeadhead!.uniqueName]: primaryDeadhead!.maxRank },
            targetFaction: "Grineer",
            targetProfileOverride: { headshotHitRate: 1 },
            conditionalState: { mode: "initial" },
        });
        expect(headshotBuild.arcane?.name).toBe("Primary Deadhead");
        expect(headshotBuild.arcaneRank).toBe(primaryDeadhead!.maxRank);
    });

    it("discloses and excludes Melee Influence until nearby status spread is modeled", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const meleeInfluence = getArcanesForWeapon(weapon!).find((arcane) => arcane.name === "Melee Influence");
        expect(meleeInfluence).toBeDefined();
        const maxRankEffect = meleeInfluence!.optimizerEffectByRank[meleeInfluence!.maxRank];
        expect(maxRankEffect.aoeElementalStatusSpreadChance).toBeCloseTo(0.2);
        expect(maxRankEffect.aoeElementalStatusSpreadRadius).toBe(20);
        expect(getUnmodeledScoringEffectLines(maxRankEffect)).toContain(
            "Effect: Elemental status spread and its neighboring-target damage/proc histories are not modeled; this single-target score ignores the effect.",
        );

        const result = optimizeBuild(weapon!, [], "burst", 0, {
            optimizeArcane: true,
            arcaneCandidates: [meleeInfluence!],
        });
        expect(result.arcane).toBeNull();
    });

    it("keeps Wiki-complete Sentient Surge available to Ocucor Auto Optimize", () => {
        const ocucor = getWeaponCatalog().find((candidate) => candidate.name === "Ocucor");
        expect(ocucor).toBeDefined();
        const sentientSurge = getModsForWeapon(ocucor!).find((candidate) => candidate.name === "Sentient Surge");
        expect(sentientSurge).toBeDefined();
        expect(getUnmodeledDamageEffectLines(sentientSurge!, sentientSurge!.fusionLimit)).toEqual([]);

        const result = optimizeBuild(ocucor!, [sentientSurge!], "burst", 1, { allowForma: false });
        expect(result.capacityValid).toBe(true);
        expect(result.slots).toContain(sentientSurge);
    });

    it("keeps Wiki-complete Proton Jet and Proton Snap available when their latch state is selected", () => {
        const rifle = getWeaponCatalog().find((candidate) => candidate.name === "Perigale Prime");
        const melee = getWeaponCatalog().find((candidate) => candidate.name === "Gram Prime");
        expect(rifle).toBeDefined();
        expect(melee).toBeDefined();
        const protonJet = getModsForWeapon(rifle!).find((candidate) => candidate.name === "Proton Jet");
        const protonSnap = getModsForWeapon(melee!).find((candidate) => candidate.name === "Proton Snap");
        expect(protonJet).toBeDefined();
        expect(protonSnap).toBeDefined();
        expect(getUnmodeledDamageEffectLines(protonJet!, protonJet!.fusionLimit)).toEqual([]);
        expect(getUnmodeledDamageEffectLines(protonSnap!, protonSnap!.fusionLimit)).toEqual([]);

        const conditionalState = { mode: "fullyStacked" as const };
        const jetResult = optimizeBuild(rifle!, [protonJet!], "burst", 1, {
            allowForma: false,
            conditionalState,
        });
        const snapResult = optimizeBuild(melee!, [protonSnap!], "burst", 1, {
            allowForma: false,
            conditionalState,
        });
        expect(jetResult.capacityValid).toBe(true);
        expect(jetResult.slots).toContain(protonJet);
        expect(snapResult.capacityValid).toBe(true);
        expect(snapResult.slots).toContain(protonSnap);
    });

    it("optimizes Motus Setup only when its static jump-landing buff is active", () => {
        const shotgun = getWeaponCatalog().find((candidate) => candidate.modCompat === "Shotgun");
        expect(shotgun).toBeDefined();
        const motusSetup = getModsForWeapon(shotgun!).find((candidate) => candidate.name === "Motus Setup");
        expect(motusSetup).toBeDefined();
        expect(motusSetup!.hasDamageEffect).toBe(true);
        expect(getUnmodeledDamageEffectLines(motusSetup!, motusSetup!.fusionLimit)).toEqual([]);
        expect(getUnmodeledScoringEffectLines(motusSetup!.effect)).toEqual([]);

        const realisticResult = optimizeBuild(shotgun!, [motusSetup!], "burst", 1, {
            allowForma: false,
            conditionalState: { mode: "realistic" },
        });
        const activeResult = optimizeBuild(shotgun!, [motusSetup!], "burst", 1, {
            allowForma: false,
            conditionalState: { mode: "fullyStacked" },
        });
        expect(realisticResult.slots).not.toContain(motusSetup);
        expect(activeResult.slots).toContain(motusSetup);
    });

    it("models Bell Ringer Impact procs but excludes its unmodeled knockdown from Auto Optimize", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        expect(claw).toBeDefined();
        const bellRinger = getModsForWeapon(claw!).find((candidate) => candidate.name === "Bell Ringer");
        expect(bellRinger).toBeDefined();
        expect(getUnmodeledDamageEffectLines(bellRinger!, bellRinger!.fusionLimit)).toContain(
            "Bell Ringer's knockdown contribution to Condition Overload/Galvanized per-status counts is not modeled because target susceptibility and knockdown duration are unknown; Auto Optimize skips this mod.",
        );

        const result = optimizeBuild(claw!, [bellRinger!], "meleeDps", 1, { allowForma: false });
        expect(result.capacityValid).toBe(true);
        expect(result.slots).toEqual([null]);
    });

    it("selects Magnetic Strike for a shielded Corpus target", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.name === "Chesa Claws");
        expect(claw).toBeDefined();
        const magneticStrike = getModsForWeapon(claw!).find((candidate) => candidate.name === "Magnetic Strike");
        expect(magneticStrike).toBeDefined();

        const result = optimizeBuild(claw!, [magneticStrike!], "burst", 1, {
            allowForma: false,
            targetProfileOverride: { health: 1_000_000, shields: 1_000_000, overguard: 0, armor: 0 },
        });

        expect(result.capacityValid).toBe(true);
        expect(result.slots).toContain(magneticStrike);
        expect(result.ranks[result.slots.indexOf(magneticStrike!)]).toBe(magneticStrike!.fusionLimit);
    });

    it("explains Bloodthirst as companion healing and excludes it from damage optimization", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.name === "Chesa Claws");
        expect(claw).toBeDefined();
        const bloodthirst = getModsForWeapon(claw!).find((candidate) => candidate.name === "Bloodthirst");
        expect(bloodthirst).toBeDefined();
        const warning = "Bloodthirst heals the companion for each active Slash stack per hit; companion healing is outside the damage score, so Auto Optimize skips this mod.";

        expect(getUnmodeledDamageEffectSourceUrl(bloodthirst!)).toBe("https://wiki.warframe.com/w/Bloodthirst");
        for (let rank = 0; rank <= bloodthirst!.fusionLimit; rank++) {
            expect(bloodthirst!.unparsedStatsByRank?.[rank]).toHaveLength(1);
            expect(getUnmodeledDamageEffectLines(bloodthirst!, rank)).toEqual([warning]);
        }

        const result = optimizeBuild(claw!, [bloodthirst!], "burst", 1, { allowForma: false });
        expect(result.capacityValid).toBe(true);
        expect(result.slots).toEqual([null]);
    });

    it("selects Spring-Loaded Broadhead when its Wiki distance condition is met", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Daikyu Prime");
        expect(weapon).toBeDefined();
        const broadhead = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Spring-Loaded Broadhead");
        expect(broadhead).toBeDefined();
        expect(getUnmodeledDamageEffectLines(broadhead!, broadhead!.fusionLimit)).toEqual([]);

        const result = optimizeBuild(weapon!, [broadhead!], "burst", 1, {
            allowForma: false,
            conditionalState: { mode: "realistic", targetDistanceMeters: 16 },
        });
        expect(result.capacityValid).toBe(true);
        expect(result.slots).toContain(broadhead);
    });

    it("selects Range Advantage only when the modeled target is beyond the Wiki's 10m threshold", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Akjagara");
        expect(weapon).toBeDefined();
        const rangeAdvantage = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Range Advantage");
        expect(rangeAdvantage).toBeDefined();
        expect(getUnmodeledDamageEffectLines(rangeAdvantage!, rangeAdvantage!.fusionLimit)).toEqual([]);

        const atThreshold = optimizeBuild(weapon!, [rangeAdvantage!], "burst", 1, {
            allowForma: false,
            conditionalState: { mode: "realistic", targetDistanceMeters: 10 },
        });
        const beyondThreshold = optimizeBuild(weapon!, [rangeAdvantage!], "burst", 1, {
            allowForma: false,
            conditionalState: { mode: "realistic", targetDistanceMeters: 10.1 },
        });

        expect(atThreshold.slots.filter(Boolean)).toHaveLength(0);
        expect(beyondThreshold.capacityValid).toBe(true);
        expect(beyondThreshold.slots).toContain(rangeAdvantage);
    });

    it("parses Critical Focus's aimed critical chance and critical damage", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Corvas Prime");
        expect(weapon).toBeTruthy();
        const criticalFocus = getModsForWeapon(weapon!).find((entry) => entry.name === "Critical Focus");
        expect(criticalFocus).toBeTruthy();
        expect(criticalFocus!.hasDamageEffect).toBe(true);
        for (let rank = 0; rank <= criticalFocus!.fusionLimit; rank++) {
            const rankBonus = (rank + 1) / 10;
            expect(criticalFocus!.effectsByRank[rank].conditionalEffects).toContainEqual(expect.objectContaining({
                trigger: "whileAiming",
                stats: { critChanceBonus: rankBonus, critMultBonus: rankBonus },
            }));
            expect(getUnmodeledDamageEffectLines(criticalFocus!, rank)).toEqual([]);
        }
        const effect = criticalFocus!.effectsByRank[criticalFocus!.fusionLimit];

        expect(effect.conditionalEffects).toContainEqual(expect.objectContaining({
            trigger: "whileAiming",
            stats: { critChanceBonus: 0.6, critMultBonus: 0.6 },
        }));
        expect(getUnmodeledDamageEffectLines(criticalFocus!, criticalFocus!.fusionLimit)).toEqual([]);

        const base = calculateBuild(weapon!, []).modded;
        const initial = calculateBuild(weapon!, [effect], "", { conditionalState: { mode: "initial" } }).modded;
        const realistic = calculateBuild(weapon!, [effect], "", { conditionalState: { mode: "realistic" } }).modded;
        const fullyStacked = calculateBuild(weapon!, [effect], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        const optimized = optimizeBuild(weapon!, [criticalFocus!], "burst", weapon!.baseSlotCount, {
            targetFaction: "Corpus",
            conditionalState: { mode: "fullyStacked" },
        });

        expect(initial.critChance).toBeCloseTo(base.critChance, 8);
        expect(initial.critMultiplier).toBeCloseTo(base.critMultiplier, 8);
        expect(realistic.critChance).toBeCloseTo(base.critChance * 1.45, 8);
        expect(realistic.critMultiplier).toBeCloseTo(base.critMultiplier * 1.45, 8);
        expect(fullyStacked.critChance).toBeCloseTo(base.critChance * 1.6, 8);
        expect(fullyStacked.critMultiplier).toBeCloseTo(base.critMultiplier * 1.6, 8);
        expect(optimized.slots).toContain(criticalFocus);
    });

    it("uses Synth Charge's final-magazine-hit damage while optimizing eligible pistols", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Lex Prime");
        expect(weapon).toBeDefined();
        const synthCharge = getModsForWeapon(weapon!).find((entry) => entry.name === "Synth Charge");
        expect(synthCharge).toBeDefined();

        const optimized = optimizeBuild(weapon!, [synthCharge!], "burst", weapon!.baseSlotCount, {
            targetFaction: "Corpus",
        });
        expect(optimized.slots).toContain(synthCharge);

        const shortMagazineWeapon = { ...weapon!, magazineSize: 5 };
        const shortMagazine = optimizeBuild(shortMagazineWeapon, [synthCharge!], "burst", weapon!.baseSlotCount, {
            targetFaction: "Corpus",
        });
        expect(shortMagazine.slots).not.toContain(synthCharge);
    });

    it("selects Seismic Wave for slam builds but not for a normal melee attack", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Gram Prime");
        expect(weapon).toBeDefined();
        const seismicWave = getModsForWeapon(weapon!).find((entry) => entry.name === "Seismic Wave");
        expect(seismicWave).toBeDefined();
        const slam = weapon!.attacks.find((attack) => attack.name === "Slam Attack");
        const normal = weapon!.attacks.find((attack) => attack.name === "Normal Attack");
        expect(slam).toBeDefined();
        expect(normal).toBeDefined();

        const optimizeFor = (attack: NonNullable<typeof slam>) => optimizeBuild(
            weapon!,
            [seismicWave!],
            "burst",
            1,
            { buildForAttack: attack, optimizeArcane: false, optimizeExilus: false },
        );
        const slamBuild = optimizeFor(slam!);
        const normalBuild = optimizeFor(normal!);

        expect(slamBuild.slots).toContain(seismicWave);
        expect(normalBuild.slots).not.toContain(seismicWave);

        const korumm = getWeaponCatalog().find((entry) => entry.name === "Korumm");
        expect(korumm).toBeDefined();
        const tacticalSlam = korumm!.attacks.find((attack) => attack.name === "Tactical Combo Slam Attack");
        expect(tacticalSlam).toBeDefined();
        const tacticalBuild = optimizeBuild(korumm!, [seismicWave!], "burst", 1, {
            buildForAttack: tacticalSlam,
            optimizeArcane: false,
            optimizeExilus: false,
        });
        expect(tacticalBuild.slots).toContain(seismicWave);
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

    it("does not score direct-hit per-status damage bonuses on source-marked AoE attacks", () => {
        const perStatusBonus = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };
        const baseWeapon = makeWeapon();
        const directWeapon = makeWeapon({
            damage: {
                ...baseWeapon.damage,
                total: 200,
                impact: 100,
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
            fireRate: 10,
            selectedAttackIsAreaDamage: false,
        });
        const areaWeapon = { ...directWeapon, selectedAttackIsAreaDamage: true };
        const score = (
            weapon: WeaponEntry,
            effects: ModEffect[],
            conditionalState: ConditionalState = { mode: "fullyStacked" },
        ) => debugScoreBuild(
            weapon,
            effects,
            "burst",
            "Grineer",
            null,
            null,
            conditionalState,
        );

        expect(score(directWeapon, [perStatusBonus])).toBeGreaterThan(score(directWeapon, []));
        expect(score(areaWeapon, [perStatusBonus])).toBeCloseTo(score(areaWeapon, []), 12);
        const cleanInitialScore = score(directWeapon, [perStatusBonus], { mode: "initial" });
        const tauState: ConditionalState = { mode: "initial", externalStatusTypes: ["tau"] };
        expect(calculateBuild(directWeapon, [perStatusBonus], "Grineer", {
            targetStatusState: "initial",
            conditionalState: tauState,
        }).modded.directDamageStatusTypes).toBe(0);
        expect(score(directWeapon, [perStatusBonus], {
            mode: "initial",
            externalStatusTypes: ["viral", "lifted", "microwave"],
        })).toBeGreaterThan(cleanInitialScore);
    });

    it("does not score Cold critical damage on source-marked AoE attacks", () => {
        const coldWeapon = makeWeapon({
            damage: {
                ...makeWeapon().damage,
                total: 100,
                impact: 0,
                puncture: 0,
                slash: 0,
                cold: 100,
                toxin: 0,
            },
            critChance: 0.5,
            statusChance: 1.5,
            fireRate: 1,
            selectedAttackIsAreaDamage: false,
        });
        const areaWeapon = { ...coldWeapon, selectedAttackIsAreaDamage: true };
        const score = (weapon: WeaponEntry) => debugScoreBuild(weapon, [], "burst", "", null, null);
        const coldCritScoreDelta = (weapon: WeaponEntry) => {
            const withCrit = { ...weapon, critChance: 0.5 };
            const withoutCrit = { ...weapon, critChance: 0 };
            return (score(withCrit) - score({ ...withCrit, statusChance: 0 })) -
                (score(withoutCrit) - score({ ...withoutCrit, statusChance: 0 }));
        };

        expect(coldCritScoreDelta(coldWeapon)).toBeGreaterThan(0);
        expect(coldCritScoreDelta(areaWeapon)).toBeCloseTo(0, 12);
    });

    it("only gives Enduring Affliction optimizer value when Lifted is explicitly active", () => {
        const weapon = makeWeapon({ category: "Melee", weaponType: "Sword", modCompat: "Melee" });
        const enduringAffliction = getModsForWeapon(weapon).find((candidate) => candidate.name === "Enduring Affliction");
        expect(enduringAffliction).toBeDefined();

        const score = (effects: ModEffect[], conditionalState: ConditionalState) =>
            debugScoreBuild(weapon, effects, "scaling", "", null, null, conditionalState);
        const baseline = score([], { mode: "initial" });
        expect(score([enduringAffliction!.effect], { mode: "initial" })).toBeCloseTo(baseline, 12);
        expect(score([enduringAffliction!.effect], {
            mode: "initial",
            externalStatusTypes: ["lifted"],
        })).toBeGreaterThan(baseline);

        const explanation = explainBuild(
            weapon,
            [enduringAffliction!],
            [enduringAffliction!.fusionLimit],
            "scaling",
            "",
            null,
            { mode: "initial", externalStatusTypes: ["lifted"] },
        );
        expect(JSON.stringify(explanation)).toContain("requires lifted target status");
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

    it("does not score direct-hit per-status damage bonuses on source-marked AoE attacks", () => {
        const perStatusBonus = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };
        const baseWeapon = makeWeapon();
        const directWeapon = makeWeapon({
            damage: {
                ...baseWeapon.damage,
                total: 200,
                impact: 100,
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
            fireRate: 10,
            selectedAttackIsAreaDamage: false,
        });
        const areaWeapon = { ...directWeapon, selectedAttackIsAreaDamage: true };
        const score = (weapon: WeaponEntry, effects: ModEffect[]) => debugScoreBuild(
            weapon,
            effects,
            "burst",
            "Grineer",
            null,
            null,
            { mode: "fullyStacked" },
        );

        expect(score(directWeapon, [perStatusBonus])).toBeGreaterThan(score(directWeapon, []));
        expect(score(areaWeapon, [perStatusBonus])).toBeCloseTo(score(areaWeapon, []), 12);
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

    it("marks fully unparsed damage mods and excludes them from automatic candidates", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeDefined();
        const shiveringContagion = filterBuilderExpertVariants(getModsForWeapon(weapon!))
            .find((entry) => entry.name === "Shivering Contagion");
        expect(shiveringContagion).toBeDefined();
        expect(shiveringContagion!.hasDamageEffect).toBe(false);
        expect(getUnmodeledDamageEffectLines(shiveringContagion!, shiveringContagion!.fusionLimit))
            .toContain("On Cold Status Effect: 100% chance to spread that status to other enemies within 6m.");

        const result = optimizeBuild(
            withSelectedAttack(weapon!, weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack")),
            [shiveringContagion!],
            "burst",
            1,
            { allowForma: false },
        );

        expect(result.mods).toEqual([]);
        expect(result.slots.filter(Boolean)).toHaveLength(0);
    });

    it("scores Corrupt Charge's initial combo in Burst and keeps its timer effect out of untimed scoring", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Broken War");
        expect(weapon).toBeDefined();
        const corruptCharge = filterBuilderExpertVariants(getModsForWeapon(weapon!))
            .find((entry) => entry.name === "Corrupt Charge");
        expect(corruptCharge).toBeDefined();
        expect(corruptCharge!.hasDamageEffect).toBe(true);
        expect(corruptCharge!.effect.initialComboBonus).toBe(30);
        expect(corruptCharge!.effect.comboDurationBaseBonus).toBe(-0.5);
        expect(getUnmodeledDamageEffectSourceUrl(corruptCharge!)).toBe("https://wiki.warframe.com/w/Corrupt_Charge");
        expect(getUnmodeledDamageEffectLines(corruptCharge!, corruptCharge!.fusionLimit, {
            selectedGoal: "timeToKill",
        }).join(" ")).toContain("does not simulate that timer's expiration");

        const heavySlamIndex = weapon!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");
        const heavySlamWeapon = withSelectedAttack(weapon!, heavySlamIndex);
        const burstExplanation = explainBuild(
            heavySlamWeapon,
            [corruptCharge!],
            [corruptCharge!.fusionLimit],
            "burst",
        );
        expect(burstExplanation.steps[0]?.why).toContain("−50% weapon-base Combo Duration");

        const result = optimizeBuild(
            heavySlamWeapon,
            [corruptCharge!],
            "burst",
            1,
            { allowForma: false },
        );

        expect(result.mods.map((mod) => mod?.name)).toContain("Corrupt Charge");

        const unsupportedFinite = optimizeBuild(weapon!, [corruptCharge!], "timeToKill", 1, {
            allowForma: false,
            targetFaction: "Grineer",
        });
        expect(unsupportedFinite.slots).toEqual([null]);
    });

    it("keeps Volatile Variant out of automatic builds until its direct-hit explosion behavior is modeled", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Sporothrix");
        expect(weapon).toBeDefined();
        const volatileVariant = getModsForWeapon(weapon!).find((entry) => entry.name === "Volatile Variant");
        expect(volatileVariant).toBeDefined();
        expect(volatileVariant!.effect.areaDamageStatusChanceBonus).toBe(0.5);
        expect(getUnmodeledDamageEffectLines(volatileVariant!, volatileVariant!.fusionLimit)).toContain(
            "Punch Through, instant direct-hit barb-explosion timing, and its added radius are not modeled; the rank-specific Status Chance bonus applies only to a selected AoE attack.",
        );

        const areaAttackIndex = weapon!.attacks.findIndex((attack) => attack.isAreaDamage === true);
        const result = optimizeBuild(
            withSelectedAttack(weapon!, areaAttackIndex),
            [volatileVariant!],
            normalizeOptimizeGoal("status"),
            1,
            { allowForma: false },
        );

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

    it("uses Cyngas Auto-Burst timing inside finite Expected TTK for both profiles", () => {
        const profiles = getWeaponCatalog().filter((weapon) => weapon.name === "Cyngas");
        for (const [variantLabel, health] of [["Archwing", 200], ["Atmosphere", 400]] as const) {
            const weapon = profiles.find((candidate) => candidate.variantLabel === variantLabel);
            expect(weapon, `Cyngas (${variantLabel})`).toBeDefined();
            const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
            const attack = weapon!.attacks[attackIndex]!;
            const result = optimizeBuild(weapon!, [], "timeToKill", 0, {
                buildForAttack: attack,
                targetFaction: "",
                targetProfileOverride: { health, armor: 0, shields: 0, overguard: 0 },
                allowCatalyst: false,
            });
            expect(result.encounterTimeToKillSeconds, `Cyngas (${variantLabel}) second projectile`).toBeCloseTo(0.06, 8);
        }
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

    it("uses Wiki Auto-Burst, Auto-Charge, and Semi-Auto triggers for Battacor and Morgha", () => {
        const catalog = getWeaponCatalog();
        const battacor = catalog.find((weapon) => weapon.name === "Battacor");
        const morgha = catalog.find((weapon) => weapon.name === "Morgha");
        expect(battacor).toBeTruthy();
        expect(morgha).toBeTruthy();

        const battacorPrimaryIndex = battacor!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const battacorAltFireIndex = battacor!.attacks.findIndex((attack) => attack.name === "Secondary Fire");
        const battacorAltFireExplosionIndex = battacor!.attacks.findIndex((attack) => attack.name === "Secondary Fire AoE");
        const battacorPrimary = battacor!.attacks[battacorPrimaryIndex]!;
        const battacorAltFire = battacor!.attacks[battacorAltFireIndex]!;
        const battacorAltFireExplosion = battacor!.attacks[battacorAltFireExplosionIndex]!;

        expect(battacorPrimary.trigger).toBe("Burst");
        expect(battacorPrimary.burstCount).toBe(2);
        expect(battacorPrimary.burstDelay).toBeCloseTo(0.08, 8);
        expect(calculateBuild(withSelectedAttack(battacor!, battacorPrimaryIndex), []).modded.fireRate)
            .toBeCloseTo(2 / (1 / 2.5 + 0.08), 8);
        expect(calculateBuild(withSelectedAttack(battacor!, battacorPrimaryIndex), [{
            ...emptyEffect(),
            fireRateBonus: 1,
        }]).modded.fireRate).toBeCloseTo(2 / (1 / 5 + 0.04), 8);

        for (const [attack, attackName] of [
            [battacorAltFire, "Secondary Fire"],
            [battacorAltFireExplosion, "Secondary Fire AoE"],
        ] as const) {
            expect(attack.trigger, attackName).toBe("Charge");
            expect(attack.chargeTime, attackName).toBeCloseTo(0.4, 8);
            expect(attack.modelLimitation?.reason, attackName).toContain("kill history are not modeled");
            expect(() => optimizeBuild(battacor!, [], "burst", 1, { buildForAttack: attack }))
                .toThrow("kill history are not modeled");
        }

        const morghaChargedShotIndex = morgha!.attacks.findIndex((attack) => attack.name === "Charged Shot");
        const morghaChargedShotExplosionIndex = morgha!.attacks.findIndex((attack) => attack.name === "Charged Shot Explosion");
        for (const attackIndex of [morghaChargedShotIndex, morghaChargedShotExplosionIndex]) {
            const attack = morgha!.attacks[attackIndex]!;
            expect(attack.trigger).toBe("Semi");
            expect(attack.burstCount).toBeUndefined();
            expect(attack.chargeTime).toBeUndefined();
            expect(calculateBuild(withSelectedAttack(morgha!, attackIndex), []).modded.fireRate)
                .toBeCloseTo(0.833, 6);
        }
    });

    it("applies Wiki Auto-Spool cadence only to source-verified attack modes", () => {
        const catalog = getWeaponCatalog();
        const verifiedModes = [
            ["Gorgon", "Fully Spooled", 9, 0.20, 0.10667],
            ["Gorgon Wraith", "Fully Spooled", 6, 0.20, 0.16],
            ["Prisma Gorgon", "Fully Spooled", 7, 0.20, 0.1333],
            ["Soma", "Fully Spooled", 6, 0.25, 0.15],
            ["Soma Prime", "Fully Spooled", 4, 0.25, 0.30],
            ["Supra", "Fully Spooled", 5, 0.10, 0.225],
            ["Supra Vandal", "Fully Spooled", 4, 0.40, 0.20],
            ["Tenora", "Fully Spooled", 9, 0.40, 0.075],
            ["Tenora Prime", "Fully Spooled", 9, 0.40, 0.075],
            ["Aksomati", "Fully Spooled", 6, 0.25, 0.15],
            ["Kohmak", "Fully Spooled", 4, 0.20, 0.32],
            ["Cestra", "Normal Attack", 6, 0.60, 0.08],
            ["Secura Dual Cestra", "Normal Attack", 5, 0.60, 0.08],
            ["Twin Kohmak", "Fully Spooled", 11, 0.20, 0.08],
            ["Kuva Kohm", "Fully Spooled", 5, 0.20, 0.20],
            ["Coda Bubonico", "Auto", 7, 0.30, 0.1167],
            ["Grattler", "Projectile Impact", 4, 0.40, 0.20],
            ["Grattler", "Explosion", 4, 0.40, 0.20],
            ["Phaedra", "Normal Attack", 11, 0.50, 0.05],
            ["Imperator Vandal", "Normal Attack", 16, 0.5333, 0.0311],
        ] as const;

        for (const [weaponName, attackName, roundsToFullRate, startingRateFraction, rateIncreasePerShotFraction] of verifiedModes) {
            const weapon = catalog.find((entry) => entry.name === weaponName);
            expect(weapon, weaponName).toBeTruthy();
            const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
            expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
            const attack = weapon!.attacks[attackIndex]!;
            const selected = withSelectedAttack(weapon!, attackIndex);

            expect(attack.trigger, `${weaponName} / ${attackName}`).toBe(
                weaponName === "Coda Bubonico" ? "Auto" : "Auto-Spool",
            );
            expect(attack.autoSpoolCadence).toMatchObject({
                roundsToFullRate,
                startingRateFraction,
                rateIncreasePerShotFraction,
            });
            expect(attack.autoSpoolCadence?.sourceUrl).toMatch(/^https:\/\/wiki\.warframe\.com\//);
            expect(selected.selectedAttackAutoSpoolCadence).toEqual(attack.autoSpoolCadence);
        }

        const wikiAutoSpoolModes = [
            ["Gorgon", "Fully Spooled"],
            ["Gorgon Wraith", "Fully Spooled"],
            ["Prisma Gorgon", "Fully Spooled"],
            ["Soma", "Fully Spooled"],
            ["Soma Prime", "Fully Spooled"],
            ["Supra", "Fully Spooled"],
            ["Supra Vandal", "Fully Spooled"],
            ["Tenora", "Fully Spooled"],
            ["Tenora Prime", "Fully Spooled"],
            ["Kohm", "Fully Spooled"],
            ["Kuva Kohm", "Fully Spooled"],
            ["Aksomati", "Fully Spooled"],
            ["Aksomati Prime", "Fully Spooled"],
            ["Cestra", "Normal Attack"],
            ["Kohmak", "Fully Spooled"],
            ["Secura Dual Cestra", "Normal Attack"],
            ["Twin Kohmak", "Fully Spooled"],
            ["Deth Machine Rifle", "Normal Attack"],
            ["Deth Machine Rifle Prime", "Normal Attack"],
            ["Grattler", "Projectile Impact"],
            ["Grattler", "Explosion"],
            ["Imperator Vandal", "Normal Attack"],
            ["Phaedra", "Normal Attack"],
        ] as const;
        for (const [weaponName, attackName] of wikiAutoSpoolModes) {
            const weapon = catalog.find((entry) => entry.name === weaponName);
            expect(weapon, `Wiki Auto-Spool weapon ${weaponName}`).toBeTruthy();
            const attack = weapon!.attacks.find((entry) => entry.name === attackName);
            expect(attack, `${weaponName} / ${attackName}`).toBeTruthy();
            expect(attack?.trigger, `${weaponName} / ${attackName}`).toBe("Auto-Spool");
            expect(
                Boolean(attack?.autoSpoolCadence) !== Boolean(attack?.autoSpoolTimingLimitation),
                `${weaponName} / ${attackName} must be supported or carry an explicit limitation`,
            ).toBe(true);
        }

        const gorgon = catalog.find((entry) => entry.name === "Gorgon")!;
        const incarnonIndex = gorgon.attacks.findIndex((attack) => attack.name === "Incarnon Form");
        expect(withSelectedAttack(gorgon, incarnonIndex).trigger).not.toBe("Auto-Spool");
        expect(withSelectedAttack(gorgon, incarnonIndex).selectedAttackAutoSpoolCadence).toBeUndefined();
    });

    it("withholds finite Auto-Spool timing when source-backed cadence or variable shots are incomplete", () => {
        const catalog = getWeaponCatalog();
        const limitedModes = [
            ["Kohm", "Fully Spooled", "starting fire-rate fraction", "https://wiki.warframe.com/w/Kohm"],
            ["Aksomati Prime", "Fully Spooled", "11-round", "https://wiki.warframe.com/w/Aksomati_Prime"],
            ["Deth Machine Rifle", "Normal Attack", "Auto-Spool", "https://wiki.warframe.com/w/Deth_Machine_Rifle"],
            ["Deth Machine Rifle Prime", "Normal Attack", "Auto-Spool", "https://wiki.warframe.com/w/Deth_Machine_Rifle_Prime"],
        ] as const;

        for (const [weaponName, attackName, reasonFragment, sourceUrl] of limitedModes) {
            const weapon = catalog.find((entry) => entry.name === weaponName);
            expect(weapon, weaponName).toBeTruthy();
            const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
            expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
            const attack = weapon!.attacks[attackIndex]!;
            const selected = withSelectedAttack(weapon!, attackIndex);

            expect(attack.trigger, `${weaponName} / ${attackName}`).toBe("Auto-Spool");
            expect(attack.autoSpoolCadence).toBeUndefined();
            expect(attack.autoSpoolTimingLimitation?.reason).toContain(reasonFragment);
            expect(attack.autoSpoolTimingLimitation?.sourceUrl).toBe(sourceUrl);
            expect(selected.selectedAttackAutoSpoolTimingLimitation).toEqual(attack.autoSpoolTimingLimitation);
            expect(calculateBuild(selected, []).modded.fireRate).toBeCloseTo(attack.speed, 5);
            expect(() => optimizeBuild(selected, [], "timeToKill", 8, { buildForAttack: attack }))
                .toThrow(/Expected TTK is unavailable/);
            expect(() => optimizeBuild(selected, [], "burst", 8, { buildForAttack: attack })).not.toThrow();
        }

        for (const weaponName of ["Kohm", "Kuva Kohm", "Kohmak", "Twin Kohmak"]) {
            const weapon = catalog.find((entry) => entry.name === weaponName)!;
            const singlePelletIndex = weapon.attacks.findIndex((attack) => attack.name === "Single Pellet");
            expect(singlePelletIndex, `${weaponName} unspooled profile`).toBeGreaterThanOrEqual(0);
            expect(withSelectedAttack(weapon, singlePelletIndex).selectedAttackAutoSpoolTimingLimitation).toBeUndefined();
        }
    });

    it("discloses and excludes Coda Bassocyst Alt-Fire's delayed multi-target mite model", () => {
        const coda = getWeaponCatalog().find((entry) => entry.name === "Coda Bassocyst");
        expect(coda).toBeTruthy();
        const altFireIndex = coda!.attacks.findIndex((attack) => attack.name === "Alt-Fire");
        expect(altFireIndex).toBeGreaterThanOrEqual(0);

        const altFire = coda!.attacks[altFireIndex]!;
        const selectedAltFire = withSelectedAttack(coda!, altFireIndex);
        const normalAttack = coda!.attacks.find((attack) => attack.name === "Normal Attack")!;

        expect(altFire.modelLimitation?.sourceUrl).toBe("https://wiki.warframe.com/w/Coda_Bassocyst");
        expect(altFire.modelLimitation?.reason).toContain("up to six enemies");
        expect(altFire.modelLimitation?.reason).toContain("each second for 10 seconds");
        expect(selectedAltFire.selectedAttackModelLimitation).toEqual(altFire.modelLimitation);
        expect(normalAttack.modelLimitation).toBeUndefined();

        expect(() => optimizeBuild(selectedAltFire, [], "burst", 8)).toThrow(/Optimization is unavailable for Alt-Fire/);
        expect(() => optimizeBuild(selectedAltFire, [], "timeToKill", 8)).toThrow(/Optimization is unavailable for Alt-Fire/);
    });

    it("keeps Higasa's gauge-gated Charged Shot out of damage optimization", () => {
        const higasa = getWeaponCatalog().find((entry) => entry.name === "Higasa");
        expect(higasa).toBeTruthy();
        const chargedIndex = higasa!.attacks.findIndex((attack) => attack.name === "Charged Shot");
        expect(chargedIndex).toBeGreaterThanOrEqual(0);

        const selected = withSelectedAttack(higasa!, chargedIndex);
        expect(selected.trigger).toBe("Charge");
        expect(selected.selectedAttackModelLimitation?.reason).toMatch(/gauge is full/i);
        expect(() => optimizeBuild(selected, [], "burst", 8)).toThrow(/reference-only/i);
        expect(() => optimizeBuild(selected, [], "timeToKill", 8)).toThrow(/reference-only/i);
        expect(() => optimizeBuild(selected, [], "windowDps", 8)).toThrow(/reference-only/i);
    });

    it("keeps incomplete Ambassador and Tenet Plinx charged sequences out of optimization", () => {
        const cases = [
            ["Ambassador", "Charge"],
            ["Ambassador", "Charged AoE"],
            ["Tenet Plinx", "Alt-Fire"],
            ["Tenet Plinx", "Alt-Fire AoE"],
            ["Efv-5 Jupiter", "Buckshot"],
        ] as const;

        for (const [weaponName, attackName] of cases) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === weaponName);
            expect(weapon, weaponName).toBeTruthy();
            const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
            expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);

            const attack = weapon!.attacks[attackIndex]!;
            const selected = withSelectedAttack(weapon!, attackIndex);
            expect(attack.trigger, `${weaponName} / ${attackName}`).toBe("Charge");
            expect(selected.selectedAttackModelLimitation?.reason, `${weaponName} / ${attackName}`)
                .toMatch(/reference-only/i);

            for (const goal of ["burst", "timeToKill", "windowDps"] as const) {
                expect(
                    () => optimizeBuild(selected, [], goal, 8),
                    `${weaponName} / ${attackName} / ${goal}`,
                ).toThrow(/reference-only/i);
            }
        }
    });

    it("keeps Simulor orb-history attacks reference-only", () => {
        const cases = [
            ["Simulor", "https://wiki.warframe.com/w/Simulor"],
            ["Synoid Simulor", "https://wiki.warframe.com/w/Synoid_Simulor"],
        ] as const;

        for (const [weaponName, sourceUrl] of cases) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === weaponName);
            expect(weapon, weaponName).toBeTruthy();
            expect(weapon!.attacks.length).toBe(weaponName === "Simulor" ? 3 : 4);

            for (const attack of weapon!.attacks) {
                const attackIndex = weapon!.attacks.indexOf(attack);
                const selected = withSelectedAttack(weapon!, attackIndex);
                expect(attack.modelLimitation?.sourceUrl, `${weaponName} / ${attack.name}`).toBe(sourceUrl);
                expect(attack.modelLimitation?.reason, `${weaponName} / ${attack.name}`).toMatch(/reference-only/);
                expect(selected.selectedAttackModelLimitation).toEqual(attack.modelLimitation);
                expect(() => optimizeBuild(selected, [], "burst", 8)).toThrow(/Optimization is unavailable/);
                expect(() => optimizeBuild(selected, [], "timeToKill", 8)).toThrow(/Optimization is unavailable/);
            }
        }
    });

    it("scores Larkspur charged single-target damage while disclosing unscored Knockdown control", () => {
        for (const name of ["Larkspur", "Larkspur Prime"]) {
            const weapon = getWeaponCatalog().find((entry) =>
                entry.name === name && !entry.uniqueName.includes("::Atmosphere"),
            );
            expect(weapon, name).toBeTruthy();
            const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Alt-Fire Projectile Impact");
            expect(attackIndex).toBeGreaterThanOrEqual(0);
            const attack = weapon!.attacks[attackIndex]!;
            const selected = withSelectedAttack(weapon!, attackIndex);
            const candidateMods = getModsForWeapon(weapon!);

            expect(candidateMods.length).toBeGreaterThan(0);
            expect(attack.modelLimitation).toBeUndefined();
            expect(attack.scoreBoundaryNote?.reason).toContain("independent of Knockdown");
            for (const goal of ["burst", "timeToKill"] as const) {
                const optimized = optimizeBuild(selected, candidateMods, goal, 1, {
                    buildForAttack: attack,
                    targetFaction: "Grineer",
                    optimizeArcane: false,
                    optimizeExilus: false,
                });
                expect(optimized.slots.some(Boolean), `${name} ${goal} should return a mod`).toBe(true);
            }
        }
    });

    it("models Wiki-backed Auto-Spool pellet, status, rate, and fresh-magazine ramps", () => {
        const catalog = getWeaponCatalog();
        const cases = [
            ["Kohmak", 40, 25, 4, 0.32, "https://wiki.warframe.com/w/Kohmak"],
            ["Twin Kohmak", 80, 49, 11, 0.08, "https://wiki.warframe.com/w/Twin_Kohmak"],
            ["Kuva Kohm", 209, 57, 5, 0.20, "https://wiki.warframe.com/w/Kuva_Kohm"],
        ] as const;

        for (const [weaponName, magazineSize, expectedShots, roundsToFullRate, rateIncrease, sourceUrl] of cases) {
            const weapon = catalog.find((entry) => entry.name === weaponName)!;
            const attackIndex = weapon.attacks.findIndex((attack) => attack.name === "Fully Spooled");
            expect(attackIndex, weaponName).toBeGreaterThanOrEqual(0);
            const attack = weapon.attacks[attackIndex]!;
            const selected = withSelectedAttack(weapon, attackIndex);
            const stats = calculateBuild(selected, []).modded;

            expect(attack.autoSpoolCadence).toMatchObject({ roundsToFullRate, rateIncreasePerShotFraction: rateIncrease });
            expect(attack.autoSpoolCadence?.sourceUrl).toBe(sourceUrl);
            const expectedMaxProjectiles = weaponName === "Kuva Kohm" ? 12 : 5;
            const expectedAmmoCost = weaponName === "Kuva Kohm" ? 4 : 5 / 3;
            const expectedDisplayedAmmoCost = weaponName === "Kuva Kohm" ? 4 : 1.67;
            const expectedFullySpooledShots = weaponName === "Kuva Kohm" ? 52 : weaponName === "Twin Kohmak" ? 47 : 23;
            expect(attack.autoSpoolShotSequence).toMatchObject({
                maxProjectiles: expectedMaxProjectiles,
                projectilesAddedPerShot: 1,
                ammoCostAtMaximumProjectiles: expectedAmmoCost,
                minimumAmmoCostPerShot: 1,
                sourceUrl,
                ...(weaponName === "Kuva Kohm" ? {} : { fullySpooledMagazineAmmoCost: expectedDisplayedAmmoCost }),
            });
            expect(selected.selectedAttackAutoSpoolTimingLimitation).toBeUndefined();
            expect(stats.magazineSize).toBe(magazineSize);
            expect(stats.shotsPerMag).toBe(expectedFullySpooledShots);
            expect(stats.finiteShotsPerMag).toBe(expectedShots);
            expect(() => optimizeBuild(selected, [], "timeToKill", 8, { buildForAttack: attack })).not.toThrow();
        }
    });

    it("uses Auto-Spool timing when the optimizer scores a target-specific encounter", () => {
        const soma = getWeaponCatalog().find((entry) => entry.name === "Soma")!;
        const selected = withSelectedAttack(soma, soma.attacks.findIndex((attack) => attack.name === "Fully Spooled"));
        const target = { health: 45, shields: 0, overguard: 0, armor: 0 };
        const withSpool = debugEvaluateExpectedEncounter(selected, [], "", target, { mode: "initial" });
        const steadyRateOnly = debugEvaluateExpectedEncounter({
            ...selected,
            selectedAttackAutoSpoolCadence: undefined,
        }, [], "", target, { mode: "initial" });

        expect(selected.trigger).toBe("Auto-Spool");
        expect(calculateBuild(selected, []).modded.fireRate).toBe(15);
        expect(withSpool.timeToKillSeconds).not.toBeNull();
        expect(steadyRateOnly.timeToKillSeconds).not.toBeNull();
        expect(withSpool.timeToKillSeconds!).toBeGreaterThan(steadyRateOnly.timeToKillSeconds!);
    });

    it("keeps standard sniper mods visible beside flawed variants for Perigale Prime", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Perigale Prime");
        expect(weapon).toBeTruthy();
        expect(weapon?.modCompat).toBe("Sniper");

        // The same catalog path feeds the Owned Mods panel and the manual slot picker.
        const compatible = filterBuilderExpertVariants(getModsForWeapon(weapon!));
        const serrations = sortBuilderModsForDisplay(compatible.filter((mod) => mod.name === "Serration"));
        const standardSerration = serrations.find((mod) => !/\/beginner\//i.test(mod.path));
        const flawedSerration = serrations.find((mod) => /\/beginner\//i.test(mod.path));

        expect(compatible.length).toBeGreaterThan(100);
        expect(standardSerration).toBeDefined();
        expect(flawedSerration).toBeDefined();
        expect(serrations.indexOf(standardSerration!)).toBeLessThan(serrations.indexOf(flawedSerration!));
        expect(new Set(compatible.map((mod) => mod.compatBucket))).toEqual(new Set(["Rifle", "Sniper", "Primary"]));
    });

    it("has burst count and delay metadata for every catalog attack marked Burst", () => {
        const unsupported = getWeaponCatalog().flatMap((weapon) => weapon.attacks
            .filter((attack) => attack.trigger?.toLowerCase() === "burst")
            .filter((attack) => attack.burstCount === undefined || attack.burstDelay === undefined)
            .map((attack) => `${weapon.name}: ${attack.name}`));

        expect(unsupported).toEqual([]);
    });

    it("scores a Vasto Incarnon build within its Wiki-listed 24-round form", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Vasto Prime");
        expect(weapon).toBeTruthy();
        const attackIndex = weapon!.attacks.findIndex((attack) => /incarnon form/i.test(attack.name));
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const transformed = resolveIncarnonState(weapon!, attackIndex, {
            unlockedTier: 1,
            selectedOptionsByTier: {},
        });
        const selectedWeapon = withSelectedAttack(transformed.weapon, attackIndex);
        const encounter = debugEvaluateExpectedEncounter(
            selectedWeapon,
            [],
            "",
            { health: 1_000_000_000, shields: 0, overguard: 0, armor: 0, statusImmuneTypes: ["slash"] },
        ).encounter;

        expect(encounter?.attacks).toBe(24);
        expect(encounter?.attackCountLimitReached).toBe(true);
        expect(encounter?.timeToKillSeconds).toBeNull();
        expect(encounter?.evaluatedDurationSeconds).toBeCloseTo(3.2, 6);

        const optimized = optimizeBuild(selectedWeapon, [], "timeToKill", 3, {
            buildForAttack: selectedWeapon.attacks[attackIndex] ?? null,
            targetProfileOverride: {
                health: 1_000_000_000,
                shields: 0,
                overguard: 0,
                armor: 0,
                statusImmuneTypes: ["slash"],
            },
            allowCatalyst: false,
            allowForma: false,
            optimizeArcane: false,
        });
        expect(optimized.capacityValid).toBe(true);
        expect(optimized.encounterTimeToKillSeconds).toBeNull();
        expect(optimized.encounterScore).toBeGreaterThan(0);
    });

    it("maps legacy stat-focused goals onto the two damage objectives", () => {
        expect(normalizeOptimizeGoal("damage")).toBe("burst");
        expect(normalizeOptimizeGoal("crit")).toBe("burst");
        expect(normalizeOptimizeGoal("status")).toBe("burst");
        expect(normalizeOptimizeGoal("scaling")).toBe("scaling");
        expect(normalizeOptimizeGoal("timeToKill")).toBe("timeToKill");
        expect(normalizeOptimizeGoal("tennokaiDps")).toBe("tennokaiDps");
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

    it("uses configured first-source Heat bonuses in Expected TTK optimization", () => {
        const baseWeapon = makeWeapon();
        const weapon = makeWeapon({
            damage: {
                ...baseWeapon.damage,
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
            critChance: 0,
            critMultiplier: 1,
            statusChance: 1,
            fireRate: 1,
            magazineSize: 10,
            reloadTime: 1,
        });
        const target = { health: 10_000, shields: 0, overguard: 0, armor: 0 };
        const baselineState = {
            mode: "initial" as const,
            externalHeatStatusPresenceProbability: 1,
        };
        const inheritedState = {
            ...baselineState,
            externalHeatElementalDamageBonus: 1,
        };
        const baseline = optimizeBuild(weapon, [], "timeToKill", 0, {
            targetProfileOverride: target,
            conditionalState: baselineState,
        });
        const inherited = optimizeBuild(weapon, [], "timeToKill", 0, {
            targetProfileOverride: target,
            conditionalState: inheritedState,
        });
        const independentlyScored = debugScoreExpectedEncounter(
            weapon,
            [],
            "",
            target,
            inheritedState,
        );

        expect(baseline.encounterTimeToKillSeconds).not.toBeNull();
        expect(inherited.encounterTimeToKillSeconds).not.toBeNull();
        expect(inherited.encounterTimeToKillSeconds!).toBeLessThan(baseline.encounterTimeToKillSeconds!);
        expect(inherited.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
    });

    it("scores same-trigger Galvanized direct damage in the Expected TTK objective", () => {
        const baseWeapon = makeWeapon();
        const weapon = makeWeapon({
            damage: {
                ...baseWeapon.damage,
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
            statusChance: 1,
            multishot: 3,
            fireRate: 1,
            magazineSize: 10,
            reloadTime: 0,
        });
        const target = { health: 1_000, shields: 0, overguard: 0, armor: 0 };
        const conditionalState = { mode: "fullyStacked" as const };
        const galvanizedMod = filterBuilderExpertVariants(getModsForWeapon(weapon))
            .find((mod) => mod.name === "Galvanized Aptitude");
        expect(galvanizedMod).toBeDefined();
        const galvanizedBonus = galvanizedMod!.effectsByRank[galvanizedMod!.fusionLimit] ?? galvanizedMod!.effect;
        const withoutGalvanized = debugEvaluateExpectedEncounter(
            weapon,
            [],
            "Grineer",
            target,
            conditionalState,
        );
        const withGalvanized = debugEvaluateExpectedEncounter(
            weapon,
            [galvanizedBonus],
            "Grineer",
            target,
            conditionalState,
        );
        expect(withoutGalvanized.timeToKillSeconds).toBeCloseTo(2, 8);
        expect(withGalvanized.timeToKillSeconds).toBeCloseTo(1, 8);
    });

    it("uses deterministic target kill cadence for realistic Galvanized per-status scoring", () => {
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
            magazineSize: 100,
            reloadTime: 0,
        });
        const galvanizedPerStatus = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 2,
                stats: { directDamagePerStatusBonus: 0.4 },
            }],
        };
        const target = (health: number) => ({
            health,
            shields: 0,
            overguard: 0,
            armor: 0,
            healthShare: 1,
            shieldShare: 0,
            effectiveHealth: health,
            hasOverguard: false,
            crowdControlImmune: false,
            grouped: false,
        });
        const fastInitial = debugScoreBuild(weapon, [galvanizedPerStatus], "scaling", "", null, target(100), { mode: "initial" });
        const fastRealistic = debugScoreBuild(weapon, [galvanizedPerStatus], "scaling", "", null, target(100), { mode: "realistic" });
        const slowInitial = debugScoreBuild(weapon, [galvanizedPerStatus], "scaling", "", null, target(1_000_000_000), { mode: "initial" });
        const slowRealistic = debugScoreBuild(weapon, [galvanizedPerStatus], "scaling", "", null, target(1_000_000_000), { mode: "realistic" });

        expect(fastRealistic).toBeGreaterThan(fastInitial);
        expect(slowRealistic - slowInitial).toBeGreaterThan(0);
        expect(slowRealistic - slowInitial).toBeLessThan(fastRealistic - fastInitial);
    });

    it("reserves finite-TTK refinement for tempo candidates that the proxy undervalues", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));

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
        const bestFinalListArcaneScore = Math.max(...Array.from(
            { length: arcane!.maxRank + 1 },
            (_, rank) => {
                const effect = getArcaneEffectAtRank(arcane!, rank, undefined, true, {
                    warframeMaxEnergy: 1_000,
                    warframeEnergyPercent: 100,
                });
                const encounter = debugScoreExpectedEncounter(
                    withSelectedAttack(weapon!, 0),
                    effects,
                    "Grineer",
                    target,
                    conditionalState,
                    effect,
                );
                return rankExpectedEncounter(encounter.timeToKillSeconds, encounter.damagePerSecond);
            },
        ));
        const selectedFinalListArcaneScore = rankExpectedEncounter(
            independentlyScored.timeToKillSeconds,
            independentlyScored.damagePerSecond,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(selectedNames).toContain("High Voltage");
        expect(selectedNames).toContain("Vile Acceleration");
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(result.encounterTimeToKillSeconds).toBeLessThan(0.60);
        expect(selectedFinalListArcaneScore).toBeCloseTo(bestFinalListArcaneScore, 12);
    });

    it("keeps a finite-TTK elemental and fire-rate pair with an alternate outgoing slot choice", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const target = { health: 100000, shields: 0, overguard: 0, armor: 3000 };
        const conditionalState = { mode: "fullyStacked" as const };
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));
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
            optimizeArcane: false,
            optimizeExilus: false,
            buildForAttack: weapon!.attacks[0] ?? null,
        });
        const selectedNames = result.mods.map((mod) => mod.name);
        const effects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null);
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, 0),
            effects,
            "Grineer",
            target,
            conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(selectedNames).toContain("Rime Rounds");
        expect(selectedNames).toContain("Vile Acceleration");
        expect(selectedNames).not.toContain("Thermite Rounds");
        expect(selectedNames).not.toContain("Bladed Rounds");
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(independentlyScored.timeToKillSeconds).toBeCloseTo(1.49682908575255, 8);
    });

    it("keeps an on-reload fire-rate candidate in full-pool finite-TTK refinement", { timeout: 45000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const target = { health: 100000, shields: 0, overguard: 0, armor: 3000 };
        const conditionalState = { mode: "realistic" as const };
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));
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
            optimizeArcane: false,
            optimizeExilus: false,
            buildForAttack: weapon!.attacks[0] ?? null,
        });
        const effects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null);
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, 0),
            effects,
            "Grineer",
            target,
            conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(result.mods.some((mod) => mod.name === "Spring-Loaded Chamber")).toBe(true);
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(independentlyScored.timeToKillSeconds).toBeCloseTo(2.119474794146, 8);
    });

    it("keeps a better elemental/base-damage replacement slot in full-pool finite-TTK refinement", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Cedo");
        expect(weapon).toBeTruthy();
        const target = { health: 100000, shields: 0, overguard: 0, armor: 3000 };
        const conditionalState = { mode: "realistic" as const };
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));
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
            optimizeArcane: false,
            optimizeExilus: false,
            buildForAttack: weapon!.attacks[0] ?? null,
        });
        const effects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null);
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, 0),
            effects,
            "Grineer",
            target,
            conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(result.mods.some((mod) => mod.name === "Blaze")).toBe(true);
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(independentlyScored.timeToKillSeconds).toBeCloseTo(2.9839612085042893, 8);
    });

    it("keeps a fire-rate tradeoff candidate in full-pool finite-TTK refinement", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Helstrum");
        expect(weapon).toBeTruthy();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Explosion");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const attack = weapon!.attacks[attackIndex]!;
        const target = { health: 100000, shields: 0, overguard: 0, armor: 3000 };
        const conditionalState = { mode: "realistic" as const };
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));
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
            optimizeArcane: false,
            optimizeExilus: false,
            buildForAttack: attack,
        });
        const selectedNames = result.mods.map((mod) => mod.name);
        const effects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null);
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, attackIndex),
            effects,
            "Grineer",
            target,
            conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(selectedNames).toContain("Vile Acceleration");
        expect(selectedNames).not.toContain("Continuous Misery");
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(independentlyScored.timeToKillSeconds).toBe(52);
    });

    it("uses the final Expected TTK pass for a Mausolon Archwing critical replacement", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => getWeaponDisplayName(entry) === "Mausolon (Archwing)");
        expect(weapon).toBeTruthy();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Auto");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const attack = weapon!.attacks[attackIndex]!;
        const target = { health: 100000, shields: 0, overguard: 0, armor: 3000 };
        const conditionalState = { mode: "realistic" as const };
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));
        const slotPolarities = Array.from({ length: 8 }, (_, index) => weapon!.polarities[index] ?? "");
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
            slotPolarities,
            defaultSlotPolarities: slotPolarities,
            allowForma: true,
            maxFormaCount: 3,
            optimizeArcane: false,
            optimizeExilus: false,
            buildForAttack: attack,
        });
        const effects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null);
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, attackIndex),
            effects,
            "Grineer",
            target,
            conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(slotPolarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(result.mods.some((mod) => mod.name === "Parallax Scope")).toBe(true);
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(independentlyScored.timeToKillSeconds).toBeCloseTo(1.0109306880647, 8);
    });

    it("keeps a critical mod in the best Laetum full-pool finite-TTK build", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Laetum");
        expect(weapon).toBeTruthy();
        const target = { health: 100000, shields: 0, overguard: 0, armor: 3000 };
        const conditionalState = { mode: "realistic" as const };
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));
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
            optimizeArcane: false,
            optimizeExilus: false,
            buildForAttack: weapon!.attacks[0] ?? null,
        });
        const effects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null);
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, 0),
            effects,
            "Grineer",
            target,
            conditionalState,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(result.mods.some((mod) => mod.name === "Primed Target Cracker")).toBe(true);
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(independentlyScored.timeToKillSeconds).toBeCloseTo(1.8, 8);
    });

    it("optimizes Torid against the fixed Grineer target with its attached cloud stream", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Torid");
        expect(weapon).toBeTruthy();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Grenade Impact");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const attack = weapon!.attacks[attackIndex]!;
        const target = { health: 100000, shields: 0, overguard: 0, armor: 3000 };
        const conditionalState = { mode: "realistic" as const };
        const candidates = filterBuilderExpertVariants(getModsForWeapon(weapon!));
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
            optimizeArcane: false,
            optimizeExilus: false,
            buildForAttack: attack,
        });
        const selectedNames = result.mods.map((mod) => mod.name);
        const effects = result.slots.map((mod, index) => mod
            ? mod.effectsByRank[result.slotRanks[index] ?? mod.fusionLimit] ?? mod.effect
            : null);
        const independentlyScored = debugScoreExpectedEncounter(
            withSelectedAttack(weapon!, attackIndex),
            effects,
            "Grineer",
            target,
            conditionalState,
        );
        const independentlyScoredTtk = independentlyScored.timeToKillSeconds ?? Number.NaN;

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(weapon!.polarities, result.slotPolarities)).toBeLessThanOrEqual(3);
        expect(selectedNames).toContain("Galvanized Aptitude");
        expect(selectedNames).toContain("Vile Acceleration");
        expect(result.encounterTimeToKillSeconds).toBe(independentlyScored.timeToKillSeconds);
        expect(independentlyScoredTtk).toBeLessThan(5);
    });

    it("includes Torid's attached cloud in fast scoring and finite Expected TTK", () => {
        const torid = getWeaponCatalog().find((entry) => entry.name === "Torid");
        expect(torid).toBeDefined();
        const impactIndex = torid!.attacks.findIndex((attack) => attack.name === "Grenade Impact");
        expect(impactIndex).toBeGreaterThanOrEqual(0);
        const impactWeapon = withSelectedAttack(torid!, impactIndex);
        const directOnlyWeapon = {
            ...impactWeapon,
            selectedAttackLingeringDamageRule: undefined,
        };
        const target = { health: 900, shields: 0, overguard: 0, armor: 0 };

        const withCloudTtk = debugScoreExpectedEncounter(
            impactWeapon,
            [],
            "Grineer",
            target,
            { mode: "initial" },
        ).timeToKillSeconds;
        const directOnlyTtk = debugScoreExpectedEncounter(
            directOnlyWeapon,
            [],
            "Grineer",
            target,
            { mode: "initial" },
        ).timeToKillSeconds;
        const withCloudFastScore = debugScoreBuild(impactWeapon, [], "scaling", "Grineer");
        const directOnlyFastScore = debugScoreBuild(directOnlyWeapon, [], "scaling", "Grineer");

        expect(withCloudTtk).not.toBeNull();
        expect(directOnlyTtk).not.toBeNull();
        expect(withCloudTtk).toBeLessThan(directOnlyTtk!);
        expect(withCloudFastScore).toBeGreaterThan(directOnlyFastScore);
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

    it("scores alternate Incarnon paths with the finite Expected TTK objective", { timeout: 60000 }, () => {
        const scenarios = [
            {
                weaponName: "Braton Prime",
                attackPattern: /incarnon form/i,
                candidateCount: 18,
                modNames: ["Serration", "Split Chamber", "Malignant Force", "Rime Rounds"],
                arcaneNames: ["Primary Bulwark", "Primary Overcharge"],
                energyContext: { warframeMaxEnergy: 1_000, warframeEnergyPercent: 100 },
            },
            {
                weaponName: "Torid",
                attackPattern: /incarnon form/i,
                candidateCount: 18,
                modNames: ["Serration", "Split Chamber", "Malignant Force", "Rime Rounds"],
                arcaneNames: [],
            },
            {
                weaponName: "Vasto Prime",
                attackPattern: /incarnon form/i,
                candidateCount: 18,
                modNames: ["Galvanized Diffusion", "Hornet Strike", "Pathogen Rounds", "Target Cracker"],
                arcaneNames: ["Secondary Merciless", "Secondary Deadhead"],
            },
            {
                weaponName: "Laetum",
                attackPattern: /incarnon form/i,
                candidateCount: 81,
                modNames: ["Hornet Strike", "Barrel Diffusion", "Pistol Pestilence", "Frostbite"],
                arcaneNames: [],
            },
            {
                weaponName: "Praedos",
                attackPattern: /^normal attack$/i,
                candidateCount: 81,
                modNames: ["Primed Pressure Point", "Blood Rush", "Organ Shatter", "Condition Overload"],
                arcaneNames: [],
            },
        ] as const;

        const targetFaction = "Grineer";
        const target = { health: 83818, shields: 0, overguard: 0, armor: 2700 };
        const conditionalState = { mode: "initial" as const };

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const selectedAttackIdx = weapon!.attacks.findIndex((attack) => scenario.attackPattern.test(attack.name));
            expect(selectedAttackIdx, scenario.weaponName).toBeGreaterThanOrEqual(0);
            const record = getIncarnonRecordForWeapon(weapon!);
            expect(record, scenario.weaponName).toBeTruthy();
            const incarnonCandidates = buildIncarnonCandidateConfigs(record!, {}, true);
            expect(incarnonCandidates, scenario.weaponName).toHaveLength(scenario.candidateCount);

            const candidates = scenario.modNames.map((name) => {
                const mod = filterBuilderExpertVariants(getModsForWeapon(weapon!)).find((entry) => entry.name === name);
                expect(mod, `${scenario.weaponName}: ${name}`).toBeTruthy();
                return mod!;
            });
            const arcaneCandidates = scenario.arcaneNames.map((name) => {
                const arcane = getArcanesForWeapon(weapon!).find((entry) => entry.name === name);
                expect(arcane, `${scenario.weaponName}: ${name}`).toBeTruthy();
                return arcane!;
            });
            const energyContext = "energyContext" in scenario ? scenario.energyContext : {};
            const slotPolarities = weapon!.polarities.slice(0, 3);
            const baseline = optimizeBuild(weapon!, candidates, "timeToKill", 3, {
                targetFaction,
                targetProfileOverride: target,
                capacityConfig: {
                    weaponRank: 30,
                    hasCatalyst: true,
                    masteryRank: 30,
                    canOverLevel: weapon!.canOverLevel,
                },
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                optimizeExilus: false,
                optimizeArcane: arcaneCandidates.length > 0,
                arcaneCandidates,
                warframeArmor: 1_500,
                ...energyContext,
                buildForAttack: weapon!.attacks[selectedAttackIdx],
                conditionalState,
            });
            expect(baseline.capacityValid, scenario.weaponName).toBe(true);

            const scored = incarnonCandidates.map((candidate) => {
                const state = resolveIncarnonState(weapon!, selectedAttackIdx, candidate);
                const score = scoreOptimizerResultForConfiguration({
                    weapon: state.weapon,
                    result: baseline,
                    goal: "timeToKill",
                    targetFaction,
                    selectedAttackIdx,
                    targetProfileOverride: target,
                    conditionalState,
                    preEquippedEffects: state.activeEffects,
                    warframeArmor: 1_500,
                    ...energyContext,
                    useFiniteEncounterResult: false,
                });
                const effects = [
                    ...state.activeEffects,
                    ...baseline.slots.map((mod, index) => {
                        if (!mod) return null;
                        const rank = baseline.slotRanks[index] ?? mod.fusionLimit;
                        return mod.effectsByRank[rank] ?? mod.effect;
                    }),
                ];
                const exact = debugScoreExpectedEncounter(
                    withSelectedAttack(state.weapon, selectedAttackIdx),
                    effects,
                    targetFaction,
                    target,
                    conditionalState,
                    baseline.arcane
                        ? getArcaneEffectAtRank(baseline.arcane, baseline.arcaneRank, 1_500, true, energyContext)
                        : null,
                );
                expect(score).toBe(rankExpectedEncounter(exact.timeToKillSeconds, exact.damagePerSecond));
                const signature = Object.entries(candidate.selectedOptionsByTier)
                    .sort(([left], [right]) => Number(left) - Number(right))
                    .map(([tier, option]) => `${tier}:${option}`)
                    .join("|");
                expect(Number.isFinite(score), `${scenario.weaponName}: ${signature}`).toBe(true);
                return { signature, score };
            });
            const exactBestScore = Math.max(...scored.map((entry) => entry.score));
            const selected = selectIncarnonSearchShortlist(scored, [], 3);
            expect(selected[0]?.score, scenario.weaponName).toBe(exactBestScore);
            if (scenario.weaponName === "Braton Prime") {
                expect(new Set(scored.map((entry) => entry.score)).size).toBeGreaterThan(1);
            }
        }
    });

    it("keeps the best Laetum evolution path in the refinement shortlist after path-specific optimization", { timeout: 30000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Laetum");
        expect(weapon).toBeTruthy();
        const selectedAttackIdx = weapon!.attacks.findIndex((attack) => /^normal attack$/i.test(attack.name));
        expect(selectedAttackIdx).toBeGreaterThanOrEqual(0);
        const record = getIncarnonRecordForWeapon(weapon!);
        expect(record).toBeTruthy();
        const configs = buildIncarnonCandidateConfigs(record!, {}, true);
        expect(configs).toHaveLength(81);

        const candidateNames = ["Barrel Diffusion", "Frostbite", "Hornet Strike", "Pistol Pestilence"];
        const candidates = candidateNames.map((name) => {
            const mod = filterBuilderExpertVariants(getModsForWeapon(weapon!)).find((entry) => entry.name === name);
            expect(mod, name).toBeTruthy();
            return mod!;
        });
        const arcaneNames = ["Secondary Deadhead", "Secondary Merciless"];
        const arcaneCandidates = arcaneNames.map((name) => {
            const arcane = getArcanesForWeapon(weapon!).find((entry) => entry.name === name);
            expect(arcane, name).toBeTruthy();
            return arcane!;
        });
        const target = { health: 83818, shields: 0, overguard: 0, armor: 2700 };
        const targetFaction = "Grineer";
        const conditionalState = { mode: "initial" as const };
        const slotPolarities = weapon!.polarities.slice(0, 3);
        const optimizerOptions = {
            targetFaction,
            targetProfileOverride: target,
            conditionalState,
            capacityConfig: {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            },
            slotPolarities,
            defaultSlotPolarities: slotPolarities,
            allowForma: true,
            maxFormaCount: 3,
            optimizeExilus: false,
            optimizeArcane: true,
            arcaneCandidates,
            warframeArmor: 1500,
        };
        const baselineConfig = { unlockedTier: 0, selectedOptionsByTier: {} } as const;
        const signature = (config: typeof baselineConfig | (typeof configs)[number]) => Object.entries(config.selectedOptionsByTier)
            .sort(([left], [right]) => Number(left) - Number(right))
            .map(([tier, option]) => `${tier}:${option}`)
            .join("|");
        const run = (config: typeof baselineConfig | (typeof configs)[number]) => {
            const state = resolveIncarnonState(weapon!, selectedAttackIdx, config);
            const result = optimizeBuild(state.weapon, candidates, "timeToKill", 3, {
                ...optimizerOptions,
                buildForAttack: state.weapon.attacks[selectedAttackIdx] ?? null,
                preEquippedEffects: state.activeEffects,
            });
            expect(result.capacityValid, signature(config) || "baseline").toBe(true);
            return { config, state, result };
        };
        const score = (evaluated: ReturnType<typeof run>, fallback?: ReturnType<typeof run>) => scoreOptimizerResultForConfiguration({
            weapon: evaluated.state.weapon,
            result: evaluated.result,
            goal: "timeToKill",
            targetFaction,
            selectedAttackIdx,
            targetProfileOverride: target,
            conditionalState,
            preEquippedEffects: evaluated.state.activeEffects,
            warframeArmor: 1500,
            useFiniteEncounterResult: !fallback,
        });

        const baseline = run(baselineConfig);
        const screened = configs.map((config) => {
            const state = resolveIncarnonState(weapon!, selectedAttackIdx, config);
            const signatureValue = signature(config);
            return {
                signature: signatureValue,
                path: config.selectedOptionsByTier,
                candidate: config,
                score: score({ config, state, result: baseline.result }, baseline),
            };
        });
        const shortlist = selectIncarnonSearchShortlist(screened, [], 2);
        expect(shortlist).toHaveLength(2);

        const optimizedPaths = [baseline, ...configs.map(run)];
        const fullWinner = optimizedPaths.reduce((best, current) =>
            score(current) > score(best) ? current : best,
        );
        const shortlistSignatures = new Set([signature(baselineConfig), ...shortlist.map((entry) => entry.signature)]);
        const shortlistWinner = optimizedPaths
            .filter((entry) => shortlistSignatures.has(signature(entry.config)))
            .reduce((best, current) => score(current) > score(best) ? current : best);

        expect(score(shortlistWinner)).toBe(score(fullWinner));
        expect(shortlistWinner.result.encounterTimeToKillSeconds).toBe(fullWinner.result.encounterTimeToKillSeconds);
        expect(shortlistWinner.result.capacityValid).toBe(true);
    });

    it("matches exhaustive joint Expected TTK mod-and-Arcane optima across eight weapon attack profiles including partial Galvanized stacks", { timeout: 180000 }, () => {
        const scenarios = [
            {
                weaponName: "Perigale Prime",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 50000, shields: 0, overguard: 0, armor: 1800 },
                modNames: ["Serration", "Split Chamber", "Vital Sense", "Malignant Force", "Heavy Caliber", "Hunter Munitions", "Point Strike"],
                arcaneNames: ["Primary Merciless", "Primary Deadhead"],
                slotCount: 5,
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
                modNames: ["Primed Point Blank", "Hell's Chamber", "Toxic Barrage", "Frigid Blast", "Primed Charged Shell", "Vigilante Armaments"],
                arcaneNames: ["Primary Merciless", "Primary Frostbite"],
            },
            {
                weaponName: "Phantasma Prime",
                attackName: "Plasma Bomb Explosion",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 18000, shields: 0, overguard: 0, armor: 1300 },
                modNames: ["Primed Point Blank", "Hell's Chamber", "Toxic Barrage", "Frigid Blast", "Blaze", "Vigilante Armaments"],
                arcaneNames: ["Primary Merciless", "Primary Frostbite"],
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
                modNames: ["Hornet Strike", "Barrel Diffusion", "Galvanized Diffusion", "Pistol Pestilence", "Lethal Torrent", "Pistol Elementalist"],
                arcaneNames: ["Secondary Merciless", "Secondary Encumber"],
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
                modNames: ["Primed Pressure Point", "Blood Rush", "Organ Shatter", "Condition Overload", "Primed Reach", "Gladiator Might"],
                arcaneNames: ["Melee Animosity", "Melee Exposure"],
            },
            {
                weaponName: "Vasto Prime",
                attackName: "Incarnon Form",
                incarnonForm: true,
                targetFaction: "Grineer",
                targetProfileOverride: { health: 83818, shields: 0, overguard: 0, armor: 2700 },
                modNames: ["Galvanized Diffusion", "Hornet Strike", "Pathogen Rounds", "Target Cracker", "Pistol Pestilence", "Primed Heated Charge"],
                arcaneNames: ["Secondary Merciless", "Secondary Deadhead"],
            },
            {
                weaponName: "Cedo",
                attackName: "Normal Attack",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 22000, shields: 1500, overguard: 3500, armor: 1400 },
                conditionalState: { mode: "realistic" },
                modNames: ["Galvanized Savvy", "Primed Point Blank", "Hell's Chamber", "Toxic Barrage"],
                arcaneNames: ["Primary Frostbite"],
                slotCount: 3,
            },
            {
                weaponName: "Cedo",
                attackName: "Normal Attack",
                targetFaction: "Grineer",
                targetProfileOverride: { health: 100000, shields: 0, overguard: 0, armor: 3000 },
                conditionalState: { mode: "realistic" },
                modNames: ["Galvanized Savvy", "Primed Point Blank", "Toxic Barrage", "Primed Charged Shell"],
                arcaneNames: ["Primary Frostbite"],
                slotCount: 3,
            },
        ] as const;
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
            const slotCount = "slotCount" in scenario ? scenario.slotCount : 4;
            const conditionalState = "conditionalState" in scenario ? scenario.conditionalState : undefined;
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const candidates = scenario.modNames.map((name) => {
                const mod = filterBuilderExpertVariants(getModsForWeapon(weapon!)).find((entry) =>
                    entry.name === name && !/\/beginner\//i.test(entry.path),
                );
                expect(mod, `${scenario.weaponName}: ${name}`).toBeTruthy();
                return mod!;
            });
            const arcaneCandidates = scenario.arcaneNames.map((name) => {
                const arcane = getArcanesForWeapon(weapon!).find((entry) => entry.name === name);
                expect(arcane, `${scenario.weaponName}: ${name}`).toBeTruthy();
                return arcane!;
            });
            const arcaneOptions = [
                { arcane: null, rank: 0, effect: null },
                ...arcaneCandidates.flatMap((arcane) =>
                    Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                        arcane,
                        rank,
                        effect: getArcaneEffectAtRank(arcane, rank, 1500, true),
                    })).filter((option) => option.effect),
                ),
            ];
            const attackName = "attackName" in scenario ? scenario.attackName : undefined;
            const attack = attackName
                ? weapon!.attacks.find((entry) => entry.name === attackName)
                : undefined;
            expect(attackName ? attack : true, `${scenario.weaponName}: attack`).toBeTruthy();
            const attackIndex = attack ? weapon!.attacks.indexOf(attack) : -1;
            const scoringBaseWeapon = attack && "incarnonForm" in scenario
                ? resolveIncarnonState(weapon!, attackIndex, { unlockedTier: 1, selectedOptionsByTier: {} }).weapon
                : weapon!;
            const scoringWeapon = attack
                ? withSelectedAttack(scoringBaseWeapon, attackIndex)
                : scoringBaseWeapon;
            const optimizerAttack = attack ? scoringBaseWeapon.attacks[attackIndex] ?? null : null;
            if (
                scenario.weaponName === "Cedo" &&
                "conditionalState" in scenario &&
                scenario.targetProfileOverride.health === 100000
            ) {
                const partialStackEffects = ["Galvanized Savvy", "Toxic Barrage", "Primed Charged Shell"].map((name) => {
                    const mod = candidates.find((candidate) => candidate.name === name)!;
                    return mod.effectsByRank[mod.fusionLimit] ?? mod.effect;
                });
                const partialStackArcane = arcaneOptions.find((option) =>
                    option.arcane?.name === "Primary Frostbite" && option.rank === 5,
                )?.effect;
                const partialStackScore = debugScoreExpectedEncounter(
                    scoringWeapon,
                    partialStackEffects,
                    scenario.targetFaction,
                    scenario.targetProfileOverride,
                    conditionalState,
                    partialStackArcane,
                );
                // Galvanized Savvy caps at two stacks and lasts 20s; a >20s cycle keeps its modeled average below one stack.
                expect(partialStackScore.timeToKillSeconds).toBeGreaterThan(20);
            }
            if ("incarnonForm" in scenario) {
                expect(scoringWeapon.selectedAttackIncarnonAmmoCapacity, scenario.weaponName).toBe(24);
            }
            const slotPolarities = Array.from({ length: slotCount }, (_, index) => weapon!.polarities[index] ?? "");
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: false,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            let exhaustiveBest = debugScoreExpectedEncounter(
                scoringWeapon,
                [],
                scenario.targetFaction,
                scenario.targetProfileOverride,
                conditionalState,
            );
            const enumerate = (remaining: typeof candidates, ordered: typeof candidates) => {
                const ranks = ordered.map((mod) => mod.fusionLimit);
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, 3);
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
                    for (const option of arcaneOptions) {
                        const score = debugScoreExpectedEncounter(
                            scoringWeapon,
                            effects,
                            scenario.targetFaction,
                            scenario.targetProfileOverride,
                            conditionalState,
                            option.effect,
                        );
                        if (betterEncounter(score, exhaustiveBest)) exhaustiveBest = score;
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

            const optimized = optimizeBuild(scoringBaseWeapon, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.targetFaction,
                targetProfileOverride: scenario.targetProfileOverride,
                conditionalState,
                buildForAttack: optimizerAttack,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: true,
                maxFormaCount: 3,
                optimizeExilus: false,
                optimizeArcane: true,
                arcaneCandidates,
                warframeArmor: 1500,
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
                conditionalState,
                optimized.arcane
                    ? getArcaneEffectAtRank(optimized.arcane, optimized.arcaneRank, 1500, true)
                    : null,
            );

            expect(optimized.capacityValid, scenario.weaponName).toBe(true);
            expect(countPolarityChanges(slotPolarities, optimized.slotPolarities), scenario.weaponName)
                .toBeLessThanOrEqual(3);
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
            const attackName = "attackName" in scenario ? scenario.attackName : undefined;
            const attack = attackName
                ? weapon!.attacks.find((entry) => entry.name === attackName)
                : undefined;
            expect(attackName ? attack : true, scenario.weaponName + ": attack").toBeTruthy();
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

    it("uses a sourced Held beam ramp for Burst and sustained Scaling", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Amprex");
        expect(weapon).toBeTruthy();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const selected = withSelectedAttack(weapon!, attackIndex);
        const noRamp = { ...selected, selectedAttackDamageRamp: undefined };

        const burstWithRamp = debugScoreBuild(selected, [], "burst", "Grineer");
        const burstWithoutRamp = debugScoreBuild(noRamp, [], "burst", "Grineer");
        const scalingWithRamp = debugScoreBuild(selected, [], "scaling", "Grineer");
        const scalingWithoutRamp = debugScoreBuild(noRamp, [], "scaling", "Grineer");

        expect(burstWithRamp).toBeLessThan(burstWithoutRamp);
        expect(scalingWithRamp).toBeLessThan(scalingWithoutRamp);
    });

    it("scores Quanta direct-hit cubes with the linked contact explosion", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Quanta");
        expect(weapon).toBeTruthy();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Cube (direct hit)");
        const selected = withSelectedAttack(weapon!, attackIndex);
        const directOnly = { ...selected, selectedAttackLingeringDamageRule: undefined };

        expect(debugScoreBuild(selected, [], "burst", "Grineer"))
            .toBeGreaterThan(debugScoreBuild(directOnly, [], "burst", "Grineer"));
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

    it("limits Owned Only rank search to copies recorded at exact ranks", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const heavyCaliber = getModsForWeapon(weapon!).find((mod) => mod.name === "Heavy Caliber");
        expect(heavyCaliber).toBeTruthy();
        const testMod = { ...heavyCaliber!, baseDrain: 15 };

        const result = optimizeBuild(weapon!, [testMod], "burst", 1, {
            ownedModUniqueNames: new Set([testMod.uniqueName]),
            ownedModMaxRankByUniqueName: { [testMod.uniqueName]: 2 },
            ownedModRankCountsByUniqueName: { [testMod.uniqueName]: { "0": 1, "2": 1 } },
            allowNonMaxRank: true,
            allowForma: false,
            optimizeExilus: false,
            optimizeArcane: false,
            capacityConfig: { weaponRank: 0, hasCatalyst: false, masteryRank: 0, canOverLevel: false },
            slotPolarities: [""],
            defaultSlotPolarities: [""],
        });

        expect(result.capacityValid).toBe(true);
        const selectedIndex = result.slots.findIndex((mod) => mod?.uniqueName === testMod.uniqueName);
        expect(selectedIndex).toBeGreaterThanOrEqual(0);
        expect(result.slotRanks[selectedIndex]).toBe(0);
    });

    it("does not invent a usable mod rank for owned copies with unknown rank", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const heavyCaliber = getModsForWeapon(weapon!).find((mod) => mod.name === "Heavy Caliber");
        expect(heavyCaliber).toBeTruthy();

        const result = optimizeBuild(weapon!, [heavyCaliber!], "burst", 1, {
            ownedModUniqueNames: new Set([heavyCaliber!.uniqueName]),
            ownedModMaxRankByUniqueName: { [heavyCaliber!.uniqueName]: 5 },
            ownedModRankCountsByUniqueName: { [heavyCaliber!.uniqueName]: {} },
            allowNonMaxRank: true,
            allowForma: false,
            optimizeExilus: false,
            optimizeArcane: false,
            capacityConfig: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
            slotPolarities: [""],
            defaultSlotPolarities: [""],
        });

        expect(result.slots.filter(Boolean)).toHaveLength(0);
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

    it("scores expected Blast cap and on-death radial damage against configured nearby targets", () => {
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
        const blastProcRate = stats.procRatePerSecondByType.blast ?? 0;
        const expectedCapRadialRate = blastProcRate *
            poissonProbabilityAtLeastForTest(blastProcRate * 1.5, 1) *
            stats.blastStackHitDamagePerProc * 3 * 2;
        const estimatedPrimaryKillSeconds = 100000 / singleTargetScore;
        const expectedStacksAtDeath = poissonExpectedRemainderForTest(
            blastProcRate * Math.min(estimatedPrimaryKillSeconds, 1.5),
            2,
        );
        const expectedDeathRadialRate = (singleTargetScore / 100000) * expectedStacksAtDeath *
            stats.blastStackHitDamagePerProc * 3 * 2;

        expect(packScore - singleTargetScore).toBeCloseTo(
            expectedCapRadialRate + expectedDeathRadialRate,
            3,
        );
    });

    it("includes Blast procs applied during the final fuse window in pack scoring", () => {
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
            fireRate: 3,
            magazineSize: 1000,
            reloadTime: 0,
        });
        const target = { health: 390, shields: 0, overguard: 0, armor: 0 };
        const stats = calculateBuild(weapon, []).modded;
        const singleTargetScore = debugScoreBuild(weapon, [], "burst", "", null, target);
        const packScore = debugScoreBuild(weapon, [], "burst", "", null, {
            ...target,
            nearbyBlastEnemyCount: 1,
        });
        const blastProcRate = stats.procRatePerSecondByType.blast ?? 0;
        const estimatedPrimaryKillSeconds = target.health / singleTargetScore;
        const capRadialRate = blastProcRate *
            poissonProbabilityAtLeastForTest(blastProcRate * 1.5, 9) *
            stats.blastStackHitDamagePerProc * 3;
        const expectedStacksAtDeath = poissonExpectedRemainderForTest(
            blastProcRate * Math.min(estimatedPrimaryKillSeconds, 1.5),
            10,
        );
        const deathRadialRate = (singleTargetScore / target.health) * expectedStacksAtDeath *
            stats.blastStackHitDamagePerProc * 3;

        expect(estimatedPrimaryKillSeconds).toBeCloseTo(1, 6);
        expect(expectedStacksAtDeath).toBeGreaterThan(2.5);
        expect(packScore - singleTargetScore).toBeCloseTo(capRadialRate + deathRadialRate, 6);
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

    it("scores outer Gas neighbors using steady-state cloud radius and area coverage", () => {
        const target = { health: 100000, shields: 0, overguard: 0, armor: 0 };
        const weapon = makeWeapon({
            damage: {
                total: 100,
                impact: 0, puncture: 0, slash: 0,
                heat: 0, cold: 0, electricity: 0, toxin: 0,
                blast: 0, radiation: 0, gas: 100, magnetic: 0, viral: 0,
                corrosive: 0, void: 0, tau: 0, true: 0,
            },
            statusChance: 1,
            fireRate: 1,
            magazineSize: 10,
            reloadTime: 0,
        });
        const stats = calculateBuild(weapon, []).modded;
        const singleTargetScore = debugScoreBuild(weapon, [], "burst", "", null, target);
        const outerRingScore = debugScoreBuild(weapon, [], "burst", "", null, {
            ...target,
            nearbyGasOuterEnemyCount: 2,
        });

        expect(outerRingScore - singleTargetScore).toBeCloseTo(
            (stats.dotDpsByType.gas ?? 0) * 2 * gasCloudOuterAnnulusCoverage(stats.gasCloudRadius),
            8,
        );
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

        const target = { headshotHitRate: 1 };
        const burstScore = debugScoreBuild(weapon, [stackedHeadshotPackage], "burst", "grineer", null, target);
        const scalingScore = debugScoreBuild(weapon, [stackedHeadshotPackage], "scaling", "grineer", null, target);
        const unconditionedBurstScore = debugScoreBuild(weapon, [emptyEffect()], "burst", "grineer", null, target);

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
        expect(new Set(target.statusImmuneTypes)).toEqual(new Set(["heat", "viral"]));
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
        expect(explanation.arcaneStep!.why).toContain("base weapon damage");
        expect(explanation.arcaneStep!.why).toContain("without this Arcane");

        expect(explanation.steps[0].statBefore).toBeCloseTo(
            debugScoreBuild(weapon, [fixedEffect], "burst", "", arcaneEffect),
            8,
        );
        expect(explanation.steps[0].statAfter).toBeCloseTo(
            debugScoreBuild(weapon, [fixedEffect, modEffect], "burst", "", arcaneEffect),
            8,
        );
        expect(explanation.winningEdge).toContain("largest score gains from keeping a mod");
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

        expect(explanation.steps[0].why).toContain("+90% Status Damage");
        expect(explanation.steps[0].why).toContain("+0.6 Punch-Through");
        expect(explanation.steps[1].why).toContain("+100% Status Duration");
    });

    it("explains Galvanized Steel's heavy-only critical chance contribution", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeTruthy();
        const mod = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Galvanized Steel");
        expect(mod).toBeTruthy();
        const heavyAttack = weapon!.attacks.find((attack) => attack.name === "Heavy Slam Attack");
        expect(heavyAttack).toBeTruthy();
        const explanation = explainBuild(weapon!, [mod!], [mod!.fusionLimit], "burst", "", heavyAttack);

        expect(explanation.steps[0].why).toContain("+110% of base Critical Chance on Heavy Attacks");
    });

    it("summarizes conditional effects that contribute to the modeled build", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime")!;
        expect(weapon).toBeTruthy();
        const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Spring-Loaded Chamber");
        expect(mod).toBeTruthy();
        const rank = mod!.fusionLimit;
        const effect = mod!.effectsByRank[rank] ?? mod!.effect;
        expect(effect.conditionalEffects?.some((conditional) =>
            conditional.trigger === "onReload" && conditional.requiresAiming && conditional.durationSeconds === 9,
        )).toBe(true);

        const explanation = explainBuild(weapon, [mod!], [rank], "burst");

        expect(explanation.steps[0].why).toContain("on reload (9s, while aiming): +75% Fire Rate");
        expect(explanation.steps[0].why).not.toContain("Effect not summarized by the active model");
    });

    it("shows calculated critical stats and direct damage per status in build highlights", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime")!;
        expect(weapon).toBeTruthy();
        const criticalMod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Critical Delay");
        const statusMod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Galvanized Aptitude");
        expect(criticalMod).toBeTruthy();
        expect(statusMod).toBeTruthy();
        const mods = [criticalMod!, statusMod!];
        const ranks = mods.map((mod) => mod.fusionLimit);
        const explanation = explainBuild(weapon, mods, ranks, "burst");
        const stats = calculateBuild(weapon, mods.map((mod, index) => mod.effectsByRank[ranks[index]] ?? mod.effect)).modded;

        const criticalHighlight = explanation.buildHighlights.find((line) => line.includes("Critical Chance") && line.includes("Critical Damage"));
        expect(criticalHighlight).toBeTruthy();
        expect(criticalHighlight).toContain(`${Number((stats.critChance * 100).toFixed(1))}%`);
        expect(criticalHighlight).toContain(`${Number(stats.critMultiplier.toFixed(1))}×`);
        expect(explanation.steps[1].why).toContain("weapon damage per distinct active status type on the target");
        expect(explanation.buildHighlights.some((line) => line.includes("Direct weapon damage gains") && line.includes("distinct active Status Effect type"))).toBe(true);
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

    it("reuses a status-gated preview when the prerequisite status is immune", () => {
        const weapon = makeWeapon({
            damage: { ...makeWeapon().damage, total: 100, impact: 0, puncture: 0, slash: 0, heat: 100, toxin: 0 },
            statusChance: 1,
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
        const target = { statusImmuneTypes: ["heat"] as const };
        const baselineScore = debugScoreBuild(weapon, [heatPrimer], "scaling", "Grineer", null, target);
        const calculateBuildSpy = vi.spyOn(damageCalcModule, "calculateBuild");

        try {
            const gatedScore = debugScoreBuild(
                weapon,
                [heatPrimer, heatConditional],
                "scaling",
                "Grineer",
                null,
                target,
            );

            expect(gatedScore).toBeCloseTo(baselineScore, 10);
            expect(calculateBuildSpy).toHaveBeenCalledTimes(1);
        } finally {
            calculateBuildSpy.mockRestore();
        }
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

    it("scores optimized arcanes against final refined builds across weapon classes", { timeout: 180_000 }, () => {
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

    it("matches a bounded exhaustive Expected TTK optimum across joint mod and Arcane choices", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const names = ["Serration", "Split Chamber", "Malignant Force", "Rime Rounds"];
        const catalogMods = filterBuilderExpertVariants(getModsForWeapon(weapon!));
        const candidates = names.map((name) => {
            const mod = catalogMods.find((entry) => entry.name === name);
            expect(mod, name).toBeTruthy();
            return mod!;
        });
        const targetFaction = "Grineer";
        const target = { health: 18000, shields: 0, overguard: 0, armor: 1200 };
        const conditionalState = { mode: "initial" as const };
        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 30,
            canOverLevel: weapon!.canOverLevel,
        };
        const arcaneCandidates = getArcanesForWeapon(weapon!).filter((arcane) =>
            arcane.name === "Primary Bulwark" || arcane.name === "Primary Overcharge"
        );
        expect(arcaneCandidates.map((arcane) => arcane.name).sort()).toEqual([
            "Primary Bulwark",
            "Primary Overcharge",
        ]);
        const energyContext = { warframeMaxEnergy: 1000, warframeEnergyPercent: 100 };
        const arcaneOptions = [
            { arcane: null, rank: 0, effect: null },
            ...arcaneCandidates.flatMap((arcane) =>
                Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                    arcane,
                    rank,
                    effect: getArcaneEffectAtRank(arcane, rank, 1500, true, energyContext),
                })).filter((option) => option.effect),
            ),
        ];
        const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
            debugScoreExpectedEncounter(
                weapon!,
                effects,
                targetFaction,
                target,
                conditionalState,
                arcaneEffect,
            );
        const betterEncounter = (
            candidate: ReturnType<typeof debugScoreExpectedEncounter>,
            incumbent: ReturnType<typeof debugScoreExpectedEncounter>,
        ) => candidate.timeToKillSeconds !== null
            ? incumbent.timeToKillSeconds === null || candidate.timeToKillSeconds < incumbent.timeToKillSeconds - 1e-9
            : incumbent.timeToKillSeconds === null && candidate.damagePerSecond > incumbent.damagePerSecond + 1e-9;

        let exhaustiveBest = score([], null);
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
                const effects = placement.slotMods.map((mod, index) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                for (const option of arcaneOptions) {
                    const candidate = score(effects, option.effect);
                    if (betterEncounter(candidate, exhaustiveBest)) exhaustiveBest = candidate;
                }
            }
            if (ordered.length >= 3) return;
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

        const result = optimizeBuild(weapon!, candidates, "timeToKill", 3, {
            targetFaction,
            targetProfileOverride: target,
            capacityConfig,
            slotPolarities: weapon!.polarities.slice(0, 3),
            defaultSlotPolarities: weapon!.polarities.slice(0, 3),
            allowForma: false,
            optimizeExilus: false,
            optimizeArcane: true,
            arcaneCandidates,
            warframeArmor: 1500,
            ...energyContext,
            conditionalState,
        });
        const resultEffects = result.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = result.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        });
        const resultArcaneEffect = result.arcane
            ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, 1500, true, energyContext)
            : null;
        const optimizedScore = score(resultEffects, resultArcaneEffect);

        expect(result.capacityValid).toBe(true);
        expect(optimizedScore.timeToKillSeconds).toBe(exhaustiveBest.timeToKillSeconds);
        if (exhaustiveBest.timeToKillSeconds === null) {
            expect(optimizedScore.damagePerSecond).toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("finds a coordinated mod-and-Arcane move exposed by the full-pool audit", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Braton Prime");
        expect(weapon).toBeTruthy();
        const candidateNames = ["Thermite Rounds", "Heavy Caliber", "Galvanized Chamber"];
        const catalogMods = filterBuilderExpertVariants(getModsForWeapon(weapon!));
        const candidates = candidateNames.map((name) => {
            const mod = catalogMods.find((entry) => entry.name === name);
            expect(mod, name).toBeTruthy();
            return mod!;
        });
        const targetFaction = "Grineer";
        const target = { health: 100_000, shields: 0, overguard: 0, armor: 3_000 };
        const conditionalState = { mode: "realistic" as const };
        const scoringWeapon = withSelectedAttack(weapon!, 0);
        const attack = weapon!.attacks[0] ?? null;
        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 30,
            canOverLevel: weapon!.canOverLevel,
        };
        const slotCount = 2;
        const slotPolarities = weapon!.polarities.slice(0, slotCount);
        const energyContext = { warframeMaxEnergy: 1_000, warframeEnergyPercent: 100 };
        const arcanes = getArcanesForWeapon(weapon!);
        const arcaneOptions = [
            null,
            ...arcanes.flatMap((arcane) =>
                Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                    arcane,
                    rank,
                    effect: getArcaneEffectAtRank(arcane, rank, 1_500, true, energyContext),
                })).filter((option) => option.effect && Object.keys(option.effect).length > 0 &&
                    getUnmodeledScoringEffectLines(option.effect).length === 0),
            ),
        ];
        const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
            debugScoreExpectedEncounter(
                scoringWeapon,
                effects,
                targetFaction,
                target,
                conditionalState,
                arcaneEffect,
            );
        let exhaustiveBest = score([], null);
        const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
            const ranks = ordered.map((mod) => mod.fusionLimit);
            const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, false);
            if (placement.slotMods.filter(Boolean).length === ordered.length) {
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (!capacity.overCapacity) {
                    const effects = placement.slotMods.map((mod, index) => {
                        if (!mod) return null;
                        const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                        return mod.effectsByRank[rank] ?? mod.effect;
                    });
                    for (const option of arcaneOptions) {
                        const effect = option
                            ? getArcaneEffectAtRank(option.arcane, option.rank, 1_500, true, energyContext)
                            : null;
                        const candidateScore = score(effects, effect);
                        if (rankExpectedEncounter(candidateScore.timeToKillSeconds, candidateScore.damagePerSecond) >
                            rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond)) {
                            exhaustiveBest = candidateScore;
                        }
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

        const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
            targetFaction,
            targetProfileOverride: target,
            conditionalState,
            capacityConfig,
            slotPolarities,
            defaultSlotPolarities: slotPolarities,
            allowForma: false,
            optimizeExilus: false,
            optimizeArcane: true,
            arcaneCandidates: arcanes,
            warframeArmor: 1_500,
            ...energyContext,
            buildForAttack: attack,
        });
        const resultEffects = result.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = result.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        });
        const resultArcaneEffect = result.arcane
            ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, 1_500, true, energyContext)
            : null;
        const resultScore = score(resultEffects, resultArcaneEffect);

        expect(result.capacityValid).toBe(true);
        expect(result.slots.flatMap((mod) => mod ? [mod.name] : [])).toContain("Galvanized Chamber");
        expect(result.arcane?.name).toBe("Primary Bulwark");
        expect(resultScore.timeToKillSeconds).toBe(exhaustiveBest.timeToKillSeconds);
    });

    it("matches seeded exhaustive joint mod-and-Arcane optima across weapon classes", { timeout: 180000 }, () => {
        let seed = 20261121;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 55_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Braton Prime", faction: "Infested", target: { health: 120_000, shields: 0, overguard: 0, armor: 200 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 50 },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 24_000, shields: 30_000, overguard: 0, armor: 0 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Lex Prime", faction: "Grineer", target: { health: 100_000, shields: 0, overguard: 0, armor: 3_000 }, mode: "realistic" as const, warframeArmor: 0, energyPercent: 50 },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 90_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 75 },
            { weaponName: "Cedo", faction: "Corpus", target: { health: 35_000, shields: 35_000, overguard: 0, armor: 0 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 100 },
            { weaponName: "Broken War", faction: "Infested", target: { health: 80_000, shields: 0, overguard: 0, armor: 300 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 50 },
            { weaponName: "Broken War", faction: "Grineer", target: { health: 160_000, shields: 0, overguard: 0, armor: 2_700 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 100 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)];
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura)
                    .filter((mod) => !/\/(?:beginner|flawed)\//i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0)
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 4);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(4);

            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 2;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const conditionalState = { mode: scenario.mode };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneOptions = [
                { arcane: null as ArcaneEntry | null, rank: 0, effect: null as Partial<ModEffect> | null },
                ...getArcanesForWeapon(weapon!).flatMap((arcane) =>
                    Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                        arcane,
                        rank,
                        effect: getArcaneEffectAtRank(arcane, rank, scenario.warframeArmor, true, energyContext),
                    })).filter((option) => option.effect && Object.keys(option.effect).length > 0 &&
                        getUnmodeledScoringEffectLines(option.effect).length === 0),
                ),
            ];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                );
            let exhaustiveBest = score([], null);
            let legalLoadoutCount = 0;
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                const ranks = ordered.map((mod) => mod.fusionLimit);
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, false);
                if (placement.slotMods.filter(Boolean).length === ordered.length) {
                    const capacity = computeCapacity(
                        capacityConfig,
                        placement.resultPolarities.map((polarity) => ({ polarity })),
                        placement.slotMods,
                        placement.slotRanks,
                    );
                    if (!capacity.overCapacity) {
                        legalLoadoutCount++;
                        const effects = placement.slotMods.map((mod, index) => {
                            if (!mod) return null;
                            const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                            return mod.effectsByRank[rank] ?? mod.effect;
                        });
                        for (const option of arcaneOptions) {
                            const encounter = score(effects, option.effect);
                            if (rankExpectedEncounter(encounter.timeToKillSeconds, encounter.damagePerSecond) >
                                rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond)) {
                                exhaustiveBest = encounter;
                            }
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
            expect(legalLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal subsets`).toBeGreaterThan(0);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                optimizeExilus: false,
                optimizeArcane: true,
                arcaneCandidates: getArcanesForWeapon(weapon!),
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, index) => {
                if (!mod) return null;
                const rank = result.slotRanks[index] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            if (exhaustiveBest.timeToKillSeconds === null) {
                expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                    .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
            }
        }
    });

    it("matches seeded exhaustive three-slot mod-and-Arcane optima across weapon classes", { timeout: 300000 }, () => {
        let seed = 20261122;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 55_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 24_000, shields: 30_000, overguard: 0, armor: 0 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 90_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 75 },
            { weaponName: "Broken War", faction: "Infested", target: { health: 80_000, shields: 0, overguard: 0, armor: 300 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 50 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)];
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura)
                    .filter((mod) => !/\/(?:beginner|flawed)\//i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0)
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 5);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(5);

            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 3;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const conditionalState = { mode: scenario.mode };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneOptions = [
                { arcane: null as ArcaneEntry | null, rank: 0, effect: null as Partial<ModEffect> | null },
                ...getArcanesForWeapon(weapon!).flatMap((arcane) =>
                    Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                        arcane,
                        rank,
                        effect: getArcaneEffectAtRank(arcane, rank, scenario.warframeArmor, true, energyContext),
                    })).filter((option) => option.effect && Object.keys(option.effect).length > 0 &&
                        getUnmodeledScoringEffectLines(option.effect).length === 0),
                ),
            ];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                );
            let exhaustiveBest = score([], null);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalLoadoutCount = 0;
            let exactArcaneScoreCount = 0;
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                const ranks = ordered.map((mod) => mod.fusionLimit);
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, false);
                if (placement.slotMods.filter(Boolean).length === ordered.length) {
                    const capacity = computeCapacity(
                        capacityConfig,
                        placement.resultPolarities.map((polarity) => ({ polarity })),
                        placement.slotMods,
                        placement.slotRanks,
                    );
                    if (!capacity.overCapacity) {
                        legalLoadoutCount++;
                        const effects = placement.slotMods.map((mod, index) => {
                            if (!mod) return null;
                            const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                            return mod.effectsByRank[rank] ?? mod.effect;
                        });
                        for (const option of arcaneOptions) {
                            exactArcaneScoreCount++;
                            const encounter = score(effects, option.effect);
                            const encounterRank = rankExpectedEncounter(
                                encounter.timeToKillSeconds,
                                encounter.damagePerSecond,
                            );
                            if (encounterRank > bestRank) {
                                exhaustiveBest = encounter;
                                bestRank = encounterRank;
                            }
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
            expect(legalLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal subsets`).toBeGreaterThan(0);
            expect(exactArcaneScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact scores`)
                .toBeGreaterThan(legalLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                optimizeExilus: false,
                optimizeArcane: true,
                arcaneCandidates: getArcanesForWeapon(weapon!),
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, index) => {
                if (!mod) return null;
                const rank = result.slotRanks[index] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);
            const optimizedRank = rankExpectedEncounter(
                optimizedScore.timeToKillSeconds,
                optimizedScore.damagePerSecond,
            );

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} ranked objective`).toBe(bestRank);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            if (exhaustiveBest.timeToKillSeconds === null) {
                expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                    .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
            }
        }
    });

    it("matches seeded rank-limited joint mod, Arcane, and one-Forma Expected TTK optima", { timeout: 300000 }, () => {
        let seed = 20261125;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 65_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 36_000, shields: 44_000, overguard: 0, armor: 0 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 75 },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 140_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 50 },
            { weaponName: "Broken War", faction: "Infested", target: { health: 95_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 100 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(3, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(
                            mod.effectsByRank[rank] ?? mod.effect,
                        ).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 3);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(3);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(3, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));

            const capacityConfig = {
                weaponRank: 10,
                hasCatalyst: false,
                masteryRank: 10,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 2;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneCandidates = getArcanesForWeapon(weapon!);
            const arcaneOptions = [
                { arcane: null as ArcaneEntry | null, rank: 0, effect: null as Partial<ModEffect> | null },
                ...arcaneCandidates.flatMap((arcane) =>
                    Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                        arcane,
                        rank,
                        effect: getArcaneEffectAtRank(arcane, rank, scenario.warframeArmor, true, energyContext),
                    })).filter((option) => option.effect && Object.keys(option.effect).length > 0 &&
                        getUnmodeledScoringEffectLines(option.effect).length === 0),
                ),
            ];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                );
            let exhaustiveBest = score([], null);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let exactArcaneScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                for (const option of arcaneOptions) {
                    exactArcaneScoreCount++;
                    const candidate = score(effects, option.effect);
                    const candidateRank = rankExpectedEncounter(
                        candidate.timeToKillSeconds,
                        candidate.damagePerSecond,
                    );
                    if (candidateRank > bestRank) {
                        exhaustiveBest = candidate;
                        bestRank = candidateRank;
                    }
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked subsets`)
                .toBeGreaterThan(0);
            expect(exactArcaneScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact Arcane scores`)
                .toBeGreaterThan(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: true,
                arcaneCandidates,
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);
            const optimizedRank = rankExpectedEncounter(
                optimizedScore.timeToKillSeconds,
                optimizedScore.damagePerSecond,
            );
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("drops a rank-zero Cedo mod when its removal improves finite Expected TTK", { timeout: 60000 }, () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Cedo");
        expect(weapon).toBeTruthy();
        const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Alt-Fire Glaive");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        const scoringWeapon = withSelectedAttack(weapon!, attackIndex);
        const candidateCatalog = [...new Map(
            filterBuilderExpertVariants(getModsForWeapon(weapon!))
                .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                    getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                ))
                .map((mod) => [mod.uniqueName, mod] as const),
        ).values()];
        const candidates = ["Contagious Spread", "Incendiary Coat", "Shredder", "Blaze"].map((name) => {
            const mod = candidateCatalog.find((entry) => entry.name === name);
            expect(mod, name).toBeTruthy();
            return mod!;
        });
        const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
            mod.uniqueName,
            mod.name === "Blaze" ? 2 : 1,
        ]));
        const slotCount = 3;
        const slotPolarities = weapon!.polarities.slice(0, slotCount);
        const target = { health: 155_000, shields: 0, overguard: 0, armor: 1_800 };
        const energyContext = { warframeMaxEnergy: 1_000, warframeEnergyPercent: 50 };
        const arcaneCandidates = getArcanesForWeapon(weapon!);
        const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
            targetFaction: "Grineer",
            targetProfileOverride: target,
            conditionalState: { mode: "realistic" },
            capacityConfig: {
                weaponRank: 10,
                hasCatalyst: false,
                masteryRank: 10,
                canOverLevel: weapon!.canOverLevel,
            },
            slotPolarities,
            defaultSlotPolarities: slotPolarities,
            allowForma: true,
            maxFormaCount: 1,
            allowNonMaxRank: true,
            ownedModUniqueNames: new Set(candidates.map((mod) => mod.uniqueName)),
            ownedModMaxRankByUniqueName,
            optimizeExilus: false,
            optimizeArcane: true,
            arcaneCandidates,
            warframeArmor: 1_500,
            ...energyContext,
            buildForAttack: scoringWeapon.attacks[attackIndex],
        });
        const effects = result.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = result.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        });
        const arcaneEffect = result.arcane
            ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, 1_500, true, energyContext)
            : null;
        const exact = debugScoreExpectedEncounter(
            scoringWeapon,
            effects,
            "Grineer",
            target,
            { mode: "realistic" },
            arcaneEffect,
        );

        expect(result.capacityValid).toBe(true);
        expect(countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount))).toBeLessThanOrEqual(1);
        expect(result.arcane?.name).toBe("Primary Bulwark");
        expect(exact.timeToKillSeconds).toBe(142);
        expect(result.slots.some((mod) => mod?.name === "Shredder")).toBe(false);
        expect(result.slots.some((mod) => mod?.name === "Blaze")).toBe(true);
        expect(result.slots.some((mod) => mod?.name === "Incendiary Coat")).toBe(true);
    });

    it("matches a seeded four-mod, three-slot ranked Expected TTK oracle with an empty Arcane slot", { timeout: 300000 }, () => {
        let seed = 20261126;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 15_000, shields: 15_000, overguard: 0, armor: 0 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 75 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 4);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(4);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 10,
                hasCatalyst: false,
                masteryRank: 10,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 3;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = 1;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneOptions = [{ arcane: null, rank: 0, effect: null }];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                );
            let exhaustiveBest = score([], null);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                for (const option of arcaneOptions) {
                    exactScoreCount++;
                    const candidate = score(effects, option.effect);
                    const candidateRank = rankExpectedEncounter(
                        candidate.timeToKillSeconds,
                        candidate.damagePerSecond,
                    );
                    if (candidateRank > bestRank) {
                        exhaustiveBest = candidate;
                        bestRank = candidateRank;
                    }
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked subsets`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} legal three-mod loadout`)
                .toBe(3);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal loadout scores`)
                .toBe(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);
            const optimizedRank = rankExpectedEncounter(
                optimizedScore.timeToKillSeconds,
                optimizedScore.damagePerSecond,
            );
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked three-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches a seeded five-mod, three-slot rank-limited Expected TTK oracle across weapon classes", { timeout: 300000 }, () => {
        let seed = 20261128;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 70_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 36_000, shields: 44_000, overguard: 0, armor: 0 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 75 },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 140_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 50 },
            { weaponName: "Broken War", faction: "Infested", target: { health: 95_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 100 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(3, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 5);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(5);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(3, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 10,
                hasCatalyst: false,
                masteryRank: 10,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 3;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneOptions = [{ arcane: null, rank: 0, effect: null }];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                );
            let exhaustiveBest = score([], null);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                for (const option of arcaneOptions) {
                    exactScoreCount++;
                    const candidate = score(effects, option.effect);
                    const candidateRank = rankExpectedEncounter(
                        candidate.timeToKillSeconds,
                        candidate.damagePerSecond,
                    );
                    if (candidateRank > bestRank) {
                        exhaustiveBest = candidate;
                        bestRank = candidateRank;
                    }
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked subsets`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} legal three-mod loadout`)
                .toBe(3);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal loadout scores`)
                .toBe(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);
            const optimizedRank = rankExpectedEncounter(
                optimizedScore.timeToKillSeconds,
                optimizedScore.damagePerSecond,
            );
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked three-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches a seeded six-mod, three-slot rank-limited Expected TTK and five-second DPS oracle across weapon classes", { timeout: 600000 }, () => {
        let seed = 20261137;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 70_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 36_000, shields: 44_000, overguard: 0, armor: 0 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 75 },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 140_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 50 },
            { weaponName: "Broken War", faction: "Infested", target: { health: 95_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 100 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(3, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 6) break;
            }
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(6);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(3, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 10,
                hasCatalyst: false,
                masteryRank: 10,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 3;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const windowTarget = {
                ...scenario.target,
                health: 1_000_000,
                shields: scenario.faction === "Corpus" ? 1_000_000 : 0,
            };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneOptions = [{ arcane: null, rank: 0, effect: null }];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                );
            const scoreWindow = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    windowTarget,
                    conditionalState,
                    arcaneEffect,
                );
            let exhaustiveBest = score([], null);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let exhaustiveBestWindow = scoreWindow([], null);
            let bestWindowDps = exhaustiveBestWindow.damagePerSecond;
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                for (const option of arcaneOptions) {
                    exactScoreCount++;
                    const candidate = score(effects, option.effect);
                    const candidateRank = rankExpectedEncounter(
                        candidate.timeToKillSeconds,
                        candidate.damagePerSecond,
                    );
                    if (candidateRank > bestRank) {
                        exhaustiveBest = candidate;
                        bestRank = candidateRank;
                    }
                    const windowCandidate = scoreWindow(effects, option.effect);
                    if (windowCandidate.damagePerSecond > bestWindowDps) {
                        exhaustiveBestWindow = windowCandidate;
                        bestWindowDps = windowCandidate.damagePerSecond;
                    }
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked subsets`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} legal three-mod loadout`)
                .toBe(3);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal loadout scores`)
                .toBe(legalRankedLoadoutCount);
            expect(exhaustiveBestWindow.damageInWindow, `${scenario.weaponName} seed ${scenarioIndex} uncapped five-second damage`)
                .toBeLessThan(windowTarget.health + windowTarget.shields);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);
            const optimizedRank = rankExpectedEncounter(
                optimizedScore.timeToKillSeconds,
                optimizedScore.damagePerSecond,
            );
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked three-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);

            const windowResult = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: windowTarget,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const windowEffects = windowResult.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = windowResult.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedWindowScore = scoreWindow(windowEffects, null);
            const windowFormaUsed = countPolarityChanges(
                slotPolarities,
                windowResult.slotPolarities.slice(0, slotCount),
            );

            expect(windowResult.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} five-second capacity`).toBe(true);
            expect(windowFormaUsed, `${scenario.weaponName} seed ${scenarioIndex} five-second Forma budget`)
                .toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of windowResult.slots.entries()) {
                if (!mod) continue;
                expect(windowResult.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} five-second owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedWindowScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} exact ranked three-slot five-second DPS`)
                .toBeCloseTo(bestWindowDps, 8);
            expect(optimizedWindowScore.damageInWindow, `${scenario.weaponName} seed ${scenarioIndex} five-second damage`)
                .toBeCloseTo(exhaustiveBestWindow.damageInWindow, 8);
        }
    });
    it("matches seeded five-mod, five-slot R1-owned Expected TTK oracles across weapon classes", { timeout: 300000 }, () => {
        let seed = 20261136;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 70_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 36_000, shields: 44_000, overguard: 0, armor: 0 }, mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 140_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 95_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(3, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 5) break;
            }
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} compatible candidate pool`).toBe(5);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                Math.min(1, mod.fusionLimit),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 10,
                hasCatalyst: true,
                masteryRank: 10,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 5;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, maxFormaCount);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} five-slot loadout`)
                .toBe(5);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal ranked scores`)
                .toBe(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(
                optimizedScore.timeToKillSeconds,
                optimizedScore.damagePerSecond,
            );
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked five-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches seeded five-mod, five-slot R1-R2-owned Expected TTK oracles across weapon classes", { timeout: 900000 }, () => {
        let seed = 20261154;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 70_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 36_000, shields: 44_000, overguard: 0, armor: 0 }, mode: "initial" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 5) break;
            }
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} compatible candidate pool`).toBe(5);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                Math.min(2, mod.fusionLimit),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 5;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, maxFormaCount);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} five-slot loadout`)
                .toBe(5);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal ranked scores`)
                .toBe(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked five-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches seeded Cedo and Broken War five-mod, five-slot R1-R2-owned Expected TTK oracles", { timeout: 900000 }, () => {
        let seed = 20261155;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Cedo", faction: "Grineer", target: { health: 140_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 95_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 5) break;
            }
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} compatible candidate pool`).toBe(5);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                Math.min(2, mod.fusionLimit),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 5;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, maxFormaCount);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} five-slot loadout`)
                .toBe(5);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal ranked scores`)
                .toBe(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked five-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches seeded five-mod, five-slot mixed R1-R3-owned Expected TTK oracles across weapon classes", { timeout: 1_200_000 }, () => {
        let seed = 20261156;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 70_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 36_000, shields: 44_000, overguard: 0, armor: 0 }, mode: "initial" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit >= 3)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(3, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 5) break;
            }
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} compatible candidate pool`).toBe(5);
            const sampledOwnedCaps = shuffled([1, 2, 3, 2, 3]);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod, index) => [
                mod.uniqueName,
                Math.min(sampledOwnedCaps[index], mod.fusionLimit),
            ]));
            expect(Object.values(ownedModMaxRankByUniqueName).sort((left, right) => left - right))
                .toEqual([1, 2, 2, 3, 3]);
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 5;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, maxFormaCount);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} five-slot loadout`)
                .toBe(5);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal ranked scores`)
                .toBe(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked five-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches seeded Cedo and Broken War five-mod, five-slot mixed R1-R3-owned Expected TTK oracles", { timeout: 1200000 }, () => {
        let seed = 20261157;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Cedo", faction: "Grineer", target: { health: 140_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 95_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit >= 3)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(3, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 5) break;
            }
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} compatible candidate pool`).toBe(5);
            const sampledOwnedCaps = shuffled([1, 2, 3, 2, 3]);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod, index) => [
                mod.uniqueName,
                Math.min(sampledOwnedCaps[index], mod.fusionLimit),
            ]));
            expect(Object.values(ownedModMaxRankByUniqueName).sort((left, right) => left - right))
                .toEqual([1, 2, 2, 3, 3]);
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 5;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, maxFormaCount);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} five-slot loadout`)
                .toBe(5);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact legal ranked scores`)
                .toBe(legalRankedLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} owned rank`)
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact ranked five-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches seeded four-mod, four-slot owned-rank Expected TTK and 5s DPS oracles across weapon classes", { timeout: 600000 }, () => {
        let seed = 20261149;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 82_000, shields: 0, overguard: 0, armor: 2_700 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 42_000, shields: 58_000, overguard: 0, armor: 0 }, mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 155_000, shields: 0, overguard: 0, armor: 2_100 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 108_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, scenario.weaponName + " supported attack profiles").toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(3, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 4) break;
            }
            expect(candidates.length, scenario.weaponName + " seeded candidate pool").toBe(4);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(3, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: false,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 4;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const windowTarget = {
                ...scenario.target,
                health: 1_000_000,
                shields: scenario.faction === "Corpus" ? 1_000_000 : 0,
            };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            const scoreWindow = (effects: (ModEffect | null)[]) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    windowTarget,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let exhaustiveBestWindow = scoreWindow([]);
            let bestWindowDps = exhaustiveBestWindow.damagePerSecond;
            let legalLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
                const windowCandidate = scoreWindow(effects);
                if (windowCandidate.damagePerSecond > bestWindowDps) {
                    exhaustiveBestWindow = windowCandidate;
                    bestWindowDps = windowCandidate.damagePerSecond;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalLoadoutCount, scenario.weaponName + " legal ranked loadouts").toBeGreaterThan(0);
            expect(maximumLegalSlotCount, scenario.weaponName + " legal four-slot ranked loadout").toBe(4);
            expect(exactScoreCount, scenario.weaponName + " exact ranked loadout scores").toBe(legalLoadoutCount);
            expect(exhaustiveBestWindow.damageInWindow, scenario.weaponName + " uncapped five-second damage")
                .toBeLessThan(windowTarget.health + windowTarget.shields);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, scenario.weaponName + " TTK capacity").toBe(true);
            expect(formaUsed, scenario.weaponName + " TTK Forma budget").toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], scenario.weaponName + " TTK owned rank")
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, scenario.weaponName + " exact ranked four-slot TTK")
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, scenario.weaponName + " TTK")
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, scenario.weaponName + " TTK DPS")
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);

            const windowResult = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: windowTarget,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const windowEffects = windowResult.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = windowResult.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedWindowScore = scoreWindow(windowEffects);
            const windowFormaUsed = countPolarityChanges(slotPolarities, windowResult.slotPolarities.slice(0, slotCount));

            expect(windowResult.capacityValid, scenario.weaponName + " 5s capacity").toBe(true);
            expect(windowFormaUsed, scenario.weaponName + " 5s Forma budget").toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of windowResult.slots.entries()) {
                if (!mod) continue;
                expect(windowResult.slotRanks[slotIndex], scenario.weaponName + " 5s owned rank")
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedWindowScore.damagePerSecond, scenario.weaponName + " exact ranked four-slot 5s DPS")
                .toBeCloseTo(bestWindowDps, 8);
            expect(optimizedWindowScore.damageInWindow, scenario.weaponName + " 5s total damage")
                .toBeCloseTo(exhaustiveBestWindow.damageInWindow, 8);
        }
    });

    it("matches a seeded five-mod, four-slot owned-rank Expected TTK and 5s DPS oracle across weapon classes", { timeout: 600000 }, () => {
        let seed = 20261151;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 82_000, shields: 0, overguard: 0, armor: 2_700 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 42_000, shields: 58_000, overguard: 0, armor: 0 }, mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 155_000, shields: 0, overguard: 0, armor: 2_100 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 108_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, scenario.weaponName + " supported attack profiles").toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 5) break;
            }
            expect(candidates.length, scenario.weaponName + " seeded five-mod candidate pool").toBe(5);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: false,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 4;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const windowTarget = {
                ...scenario.target,
                health: 1_000_000,
                shields: scenario.faction === "Corpus" ? 1_000_000 : 0,
            };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            const scoreWindow = (effects: (ModEffect | null)[]) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    windowTarget,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let exhaustiveBestWindow = scoreWindow([]);
            let bestWindowDps = exhaustiveBestWindow.damagePerSecond;
            let legalLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
                const windowCandidate = scoreWindow(effects);
                if (windowCandidate.damagePerSecond > bestWindowDps) {
                    exhaustiveBestWindow = windowCandidate;
                    bestWindowDps = windowCandidate.damagePerSecond;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalLoadoutCount, scenario.weaponName + " legal ranked loadouts").toBeGreaterThan(0);
            expect(maximumLegalSlotCount, scenario.weaponName + " legal four-slot ranked loadout").toBe(4);
            expect(exactScoreCount, scenario.weaponName + " exact ranked loadout scores").toBe(legalLoadoutCount);
            expect(exhaustiveBestWindow.damageInWindow, scenario.weaponName + " uncapped five-second damage")
                .toBeLessThan(windowTarget.health + windowTarget.shields);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, scenario.weaponName + " TTK capacity").toBe(true);
            expect(formaUsed, scenario.weaponName + " TTK Forma budget").toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], scenario.weaponName + " TTK owned rank")
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, scenario.weaponName + " exact ranked four-slot TTK")
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, scenario.weaponName + " TTK")
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, scenario.weaponName + " TTK DPS")
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);

            const windowResult = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: windowTarget,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const windowEffects = windowResult.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = windowResult.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedWindowScore = scoreWindow(windowEffects);
            const windowFormaUsed = countPolarityChanges(slotPolarities, windowResult.slotPolarities.slice(0, slotCount));

            expect(windowResult.capacityValid, scenario.weaponName + " 5s capacity").toBe(true);
            expect(windowFormaUsed, scenario.weaponName + " 5s Forma budget").toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of windowResult.slots.entries()) {
                if (!mod) continue;
                expect(windowResult.slotRanks[slotIndex], scenario.weaponName + " 5s owned rank")
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedWindowScore.damagePerSecond, scenario.weaponName + " exact ranked four-slot 5s DPS")
                .toBeCloseTo(bestWindowDps, 8);
            expect(optimizedWindowScore.damageInWindow, scenario.weaponName + " 5s total damage")
                .toBeCloseTo(exhaustiveBestWindow.damageInWindow, 8);
        }
    });

    it("matches a seeded six-mod, four- and five-slot R1-owned Expected TTK and 5s DPS oracle across weapon classes", { timeout: 600000 }, () => {
        let seed = 20261153;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const baseScenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 82_000, shields: 0, overguard: 0, armor: 2_700 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 42_000, shields: 58_000, overguard: 0, armor: 0 }, mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 155_000, shields: 0, overguard: 0, armor: 2_100 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 108_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];
        const scenarios = [
            ...baseScenarios.map((scenario) => ({ ...scenario, slotCount: 4 })),
            ...baseScenarios.map((scenario) => ({ ...scenario, slotCount: 5 })),
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, scenario.weaponName + " supported attack profiles").toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(1, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates: ModEntry[] = [];
            for (const mod of shuffled(candidatePool)) {
                if (candidates.some((selected) =>
                    mod.incompatibilityGroup && selected.incompatibilityGroup === mod.incompatibilityGroup
                )) continue;
                candidates.push(mod);
                if (candidates.length === 6) break;
            }
            expect(candidates.length, scenario.weaponName + " seeded six-mod candidate pool").toBe(6);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1,
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const hasElementalContributionAtOwnedRank = (mod: ModEntry) => [0, 1].some((rank) => {
                const effect = mod.effectsByRank[rank] ?? mod.effect;
                const hasDirectElement = (effect.heatBonus ?? 0) > 0 ||
                    (effect.coldBonus ?? 0) > 0 ||
                    (effect.electricityBonus ?? 0) > 0 ||
                    (effect.toxinBonus ?? 0) > 0;
                return hasDirectElement || (effect.conditionalEffects ?? []).some((conditional) =>
                    (conditional.stats.heatBonus ?? 0) > 0 ||
                    (conditional.stats.coldBonus ?? 0) > 0 ||
                    (conditional.stats.electricityBonus ?? 0) > 0 ||
                    (conditional.stats.toxinBonus ?? 0) > 0,
                );
            });
            const elementOrderSensitiveModNames = new Set(
                candidates
                    .filter(hasElementalContributionAtOwnedRank)
                    .map((mod) => mod.uniqueName),
            );
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: false,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const { slotCount } = scenario;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const windowTarget = {
                ...scenario.target,
                health: 1_000_000,
                shields: scenario.faction === "Corpus" ? 1_000_000 : 0,
            };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            const scoreWindow = (effects: (ModEffect | null)[]) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    windowTarget,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let exhaustiveBestWindow = scoreWindow([]);
            let bestWindowDps = exhaustiveBestWindow.damagePerSecond;
            let legalLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
                const windowCandidate = scoreWindow(effects);
                if (windowCandidate.damagePerSecond > bestWindowDps) {
                    exhaustiveBestWindow = windowCandidate;
                    bestWindowDps = windowCandidate.damagePerSecond;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
                if (ordered.length >= slotCount) return;
                for (let index = 0; index < remaining.length; index++) {
                    const candidate = remaining[index];
                    if (!elementOrderSensitiveModNames.has(candidate.uniqueName)) {
                        let lastOrderIndependent: ModEntry | undefined;
                        for (let orderedIndex = ordered.length - 1; orderedIndex >= 0; orderedIndex--) {
                            const previous = ordered[orderedIndex];
                            if (!elementOrderSensitiveModNames.has(previous.uniqueName)) {
                                lastOrderIndependent = previous;
                                break;
                            }
                        }
                        if (lastOrderIndependent && lastOrderIndependent.uniqueName.localeCompare(candidate.uniqueName) > 0) continue;
                    }
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
            expect(legalLoadoutCount, scenario.weaponName + " legal ranked loadouts").toBeGreaterThan(0);
            expect(maximumLegalSlotCount, scenario.weaponName + ` legal ${slotCount}-slot ranked loadout`).toBe(slotCount);
            expect(exactScoreCount, scenario.weaponName + " exact ranked loadout scores").toBe(legalLoadoutCount);
            expect(exhaustiveBestWindow.damageInWindow, scenario.weaponName + " uncapped five-second damage")
                .toBeLessThan(windowTarget.health + windowTarget.shields);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, scenario.weaponName + " TTK capacity").toBe(true);
            expect(formaUsed, scenario.weaponName + " TTK Forma budget").toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], scenario.weaponName + " TTK owned rank")
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedRank, scenario.weaponName + ` exact ranked ${slotCount}-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, scenario.weaponName + " TTK")
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, scenario.weaponName + " TTK DPS")
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);

            const windowResult = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: windowTarget,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const windowEffects = windowResult.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = windowResult.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedWindowScore = scoreWindow(windowEffects);
            const windowFormaUsed = countPolarityChanges(slotPolarities, windowResult.slotPolarities.slice(0, slotCount));

            expect(windowResult.capacityValid, scenario.weaponName + " 5s capacity").toBe(true);
            expect(windowFormaUsed, scenario.weaponName + " 5s Forma budget").toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of windowResult.slots.entries()) {
                if (!mod) continue;
                expect(windowResult.slotRanks[slotIndex], scenario.weaponName + " 5s owned rank")
                    .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
            }
            expect(optimizedWindowScore.damagePerSecond, scenario.weaponName + ` exact ranked ${slotCount}-slot 5s DPS`)
                .toBeCloseTo(bestWindowDps, 8);
            expect(optimizedWindowScore.damageInWindow, scenario.weaponName + " 5s total damage")
                .toBeCloseTo(exhaustiveBestWindow.damageInWindow, 8);
            if (process.env.TENNO_HUB_ORACLE_REPORT === "1") {
                console.info(JSON.stringify({
                    seed: 20261153,
                    slotCount,
                    weapon: scenario.weaponName,
                    attack: attack.name,
                    faction: scenario.faction,
                    state: scenario.mode,
                    maxFormaCount,
                    candidateMods: candidates.map((mod) => mod.name),
                    exactLegalRankedLoadouts: legalLoadoutCount,
                    expectedTtkSeconds: optimizedScore.timeToKillSeconds,
                    expectedTtkDamagePerSecond: optimizedScore.damagePerSecond,
                    fiveSecondAverageDps: optimizedWindowScore.damagePerSecond,
                    fiveSecondDamage: optimizedWindowScore.damageInWindow,
                }));
            }
        }
    });

    it("matches a seeded six-mod, four-slot max-rank Expected TTK oracle across weapon classes", { timeout: 300000 }, () => {
        let seed = 20261129;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 82_000, shields: 0, overguard: 0, armor: 2_700 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 42_000, shields: 58_000, overguard: 0, armor: 0 }, mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 155_000, shields: 0, overguard: 0, armor: 2_100 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 108_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: mod.fusionLimit + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 6);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(6);

            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 4;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let legalLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreLoadout = (ordered: ModEntry[]) => {
                const placement = assignModsToSlots(
                    ordered,
                    ordered.map((mod) => mod.fusionLimit),
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(
                    candidate.timeToKillSeconds,
                    candidate.damagePerSecond,
                );
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreLoadout(ordered);
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
            expect(legalLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} four-mod loadout`)
                .toBe(4);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact scores`)
                .toBe(legalLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: false,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(
                optimizedScore.timeToKillSeconds,
                optimizedScore.damagePerSecond,
            );
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} max rank`)
                    .toBe(mod.fusionLimit);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact four-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);
        }
    });

    it("matches seeded eight-mod, five-slot max-rank Expected TTK and 5s DPS oracles across weapon classes", { timeout: 600000 }, () => {
        let seed = 20261133;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 82_000, shields: 0, overguard: 0, armor: 2_700 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 42_000, shields: 58_000, overguard: 0, armor: 0 }, mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 155_000, shields: 0, overguard: 0, armor: 2_100 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 108_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: mod.fusionLimit + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 8);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(8);

            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 5;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const windowTarget = {
                ...scenario.target,
                health: 1_000_000,
                shields: scenario.faction === "Corpus" ? 1_000_000 : 0,
            };
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreExpectedEncounter(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            const scoreWindow = (effects: (ModEffect | null)[]) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    windowTarget,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestRank = rankExpectedEncounter(exhaustiveBest.timeToKillSeconds, exhaustiveBest.damagePerSecond);
            let exhaustiveBestWindow = scoreWindow([]);
            let bestWindowDps = exhaustiveBestWindow.damagePerSecond;
            let legalLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreLoadout = (ordered: ModEntry[]) => {
                const placement = assignModsToSlots(
                    ordered,
                    ordered.map((mod) => mod.fusionLimit),
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                const candidateRank = rankExpectedEncounter(candidate.timeToKillSeconds, candidate.damagePerSecond);
                if (candidateRank > bestRank) {
                    exhaustiveBest = candidate;
                    bestRank = candidateRank;
                }
                const windowCandidate = scoreWindow(effects);
                if (windowCandidate.damagePerSecond > bestWindowDps) {
                    exhaustiveBestWindow = windowCandidate;
                    bestWindowDps = windowCandidate.damagePerSecond;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreLoadout(ordered);
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
            expect(legalLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} five-slot loadout`)
                .toBe(5);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact scores`)
                .toBe(legalLoadoutCount);
            expect(exhaustiveBestWindow.damageInWindow, `${scenario.weaponName} seed ${scenarioIndex} uncapped 5s damage`)
                .toBeLessThan(windowTarget.health + windowTarget.shields);

            const result = optimizeBuild(weapon!, candidates, "timeToKill", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: false,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const optimizedRank = rankExpectedEncounter(optimizedScore.timeToKillSeconds, optimizedScore.damagePerSecond);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} max rank`)
                    .toBe(mod.fusionLimit);
            }
            expect(optimizedRank, `${scenario.weaponName} seed ${scenarioIndex} exact five-slot TTK`)
                .toBeCloseTo(bestRank, 8);
            expect(optimizedScore.timeToKillSeconds, `${scenario.weaponName} seed ${scenarioIndex} TTK`)
                .toBe(exhaustiveBest.timeToKillSeconds);
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} DPS`)
                .toBeCloseTo(exhaustiveBest.damagePerSecond, 8);

            const windowResult = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: windowTarget,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: false,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const windowResultEffects = windowResult.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = windowResult.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedWindowScore = scoreWindow(windowResultEffects);
            const windowFormaUsed = countPolarityChanges(slotPolarities, windowResult.slotPolarities.slice(0, slotCount));

            expect(windowResult.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} 5s capacity`).toBe(true);
            expect(windowFormaUsed, `${scenario.weaponName} seed ${scenarioIndex} 5s Forma budget`)
                .toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of windowResult.slots.entries()) {
                if (!mod) continue;
                expect(windowResult.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} 5s max rank`)
                    .toBe(mod.fusionLimit);
            }
            expect(optimizedWindowScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} exact five-slot 5s Avg DPS`)
                .toBeCloseTo(bestWindowDps, 8);
            expect(optimizedWindowScore.damageInWindow, `${scenario.weaponName} seed ${scenarioIndex} 5s total damage`)
                .toBeCloseTo(exhaustiveBestWindow.damageInWindow, 8);
        }
    });

    it("matches a seeded six-mod, four-slot max-rank 5s Avg DPS oracle across weapon classes", { timeout: 300000 }, () => {
        let seed = 20261130;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 2_700 }, mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 1_000_000, shields: 1_000_000, overguard: 0, armor: 0 }, mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 2_100 }, mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: mod.fusionLimit + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 6);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(6);

            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 4;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (effects: (ModEffect | null)[]) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    null,
                );
            let exhaustiveBest = score([]);
            let bestDps = exhaustiveBest.damagePerSecond;
            let legalLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let exactScoreCount = 0;
            const scoreLoadout = (ordered: ModEntry[]) => {
                const placement = assignModsToSlots(
                    ordered,
                    ordered.map((mod) => mod.fusionLimit),
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                exactScoreCount++;
                const candidate = score(effects);
                if (candidate.damagePerSecond > bestDps) {
                    exhaustiveBest = candidate;
                    bestDps = candidate.damagePerSecond;
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreLoadout(ordered);
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
            expect(legalLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} four-mod loadout`)
                .toBe(4);
            expect(exactScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact scores`)
                .toBe(legalLoadoutCount);
            expect(exhaustiveBest.damageInWindow, `${scenario.weaponName} seed ${scenarioIndex} uncapped 5s damage`)
                .toBeLessThan(scenario.target.health + scenario.target.shields);

            const result = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: maxFormaCount > 0,
                maxFormaCount,
                allowNonMaxRank: false,
                optimizeExilus: false,
                optimizeArcane: false,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = score(resultEffects);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} max rank`)
                    .toBe(mod.fusionLimit);
            }
            expect(optimizedScore.damagePerSecond, `${scenario.weaponName} seed ${scenarioIndex} exact 5s Avg DPS`)
                .toBeCloseTo(bestDps, 8);
            expect(optimizedScore.damageInWindow, `${scenario.weaponName} seed ${scenarioIndex} 5s damage`)
                .toBeCloseTo(exhaustiveBest.damageInWindow, 8);
        }
    });

    it("matches a seeded exhaustive three-slot joint mod-and-Arcane oracle for 5s Avg DPS", { timeout: 300000 }, () => {
        let seed = 20261123;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 1_000_000, shields: 1_000_000, overguard: 0, armor: 0 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 75 },
            { weaponName: "Broken War", faction: "Infested", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 50 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura)
                    .filter((mod) => !/\/(?:beginner|flawed)\//i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0)
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 5);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(5);

            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 3;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneCandidates = getArcanesForWeapon(weapon!);
            const arcaneOptions = [
                { arcane: null as ArcaneEntry | null, rank: 0, effect: null as Partial<ModEffect> | null },
                ...arcaneCandidates.flatMap((arcane) =>
                    Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                        arcane,
                        rank,
                        effect: getArcaneEffectAtRank(arcane, rank, scenario.warframeArmor, true, energyContext),
                    })).filter((option) => option.effect && Object.keys(option.effect).length > 0 &&
                        getUnmodeledScoringEffectLines(option.effect).length === 0),
                ),
            ];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                ).damagePerSecond;
            let exhaustiveBest = score([], null);
            let legalLoadoutCount = 0;
            let exactArcaneScoreCount = 0;
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                const ranks = ordered.map((mod) => mod.fusionLimit);
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, false);
                if (placement.slotMods.filter(Boolean).length === ordered.length) {
                    const capacity = computeCapacity(
                        capacityConfig,
                        placement.resultPolarities.map((polarity) => ({ polarity })),
                        placement.slotMods,
                        placement.slotRanks,
                    );
                    if (!capacity.overCapacity) {
                        legalLoadoutCount++;
                        const effects = placement.slotMods.map((mod, index) => {
                            if (!mod) return null;
                            const rank = placement.slotRanks[index] ?? mod.fusionLimit;
                            return mod.effectsByRank[rank] ?? mod.effect;
                        });
                        for (const option of arcaneOptions) {
                            exactArcaneScoreCount++;
                            exhaustiveBest = Math.max(exhaustiveBest, score(effects, option.effect));
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
            expect(legalLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal subsets`).toBeGreaterThan(0);
            expect(exactArcaneScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact Arcane scores`)
                .toBeGreaterThan(legalLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                optimizeExilus: false,
                optimizeArcane: true,
                arcaneCandidates,
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, index) => {
                if (!mod) return null;
                const rank = result.slotRanks[index] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(optimizedScore, `${scenario.weaponName} seed ${scenarioIndex} exact 5s Avg DPS`)
                .toBeCloseTo(exhaustiveBest, 7);
            expect(result.windowDpsScore, `${scenario.weaponName} seed ${scenarioIndex} reported score`)
                .toBeCloseTo(exhaustiveBest, 7);
        }
    });

    it("matches seeded rank-limited joint mod, Arcane, and one-Forma 5s Avg DPS optima", { timeout: 300000 }, () => {
        let seed = 20261124;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 2_400 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Lex Prime", faction: "Corpus", target: { health: 1_000_000, shields: 1_000_000, overguard: 0, armor: 0 }, mode: "initial" as const, warframeArmor: 1_500, energyPercent: 100 },
            { weaponName: "Cedo", faction: "Grineer", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 1_800 }, mode: "realistic" as const, warframeArmor: 1_500, energyPercent: 75 },
            { weaponName: "Broken War", faction: "Infested", target: { health: 1_000_000, shields: 0, overguard: 0, armor: 300 }, mode: "fullyStacked" as const, warframeArmor: 0, energyPercent: 50 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attack profiles`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/\/(?:beginner|flawed)\//i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => getUnmodeledDamageEffectLines(mod, mod.fusionLimit).length === 0)
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 3);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(3);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(3, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));

            const capacityConfig = {
                weaponRank: 10,
                hasCatalyst: false,
                masteryRank: 10,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 2;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const energyContext = {
                warframeMaxEnergy: 1_000,
                warframeEnergyPercent: scenario.energyPercent,
            };
            const arcaneCandidates = getArcanesForWeapon(weapon!);
            const arcaneOptions = [
                { arcane: null as ArcaneEntry | null, rank: 0, effect: null as Partial<ModEffect> | null },
                ...arcaneCandidates.flatMap((arcane) =>
                    Array.from({ length: arcane.maxRank + 1 }, (_, rank) => ({
                        arcane,
                        rank,
                        effect: getArcaneEffectAtRank(arcane, rank, scenario.warframeArmor, true, energyContext),
                    })).filter((option) => option.effect && Object.keys(option.effect).length > 0 &&
                        getUnmodeledScoringEffectLines(option.effect).length === 0),
                ),
            ];
            const score = (effects: (ModEffect | null)[], arcaneEffect: Partial<ModEffect> | null) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    scenario.faction,
                    scenario.target,
                    conditionalState,
                    arcaneEffect,
                ).damagePerSecond;
            let exhaustiveBest = score([], null);
            let legalLoadoutCount = 0;
            let exactArcaneScoreCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }
                const placement = assignModsToSlots(
                    ordered,
                    ranks,
                    slotPolarities,
                    slotCount,
                    true,
                    maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalLoadoutCount++;
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                for (const option of arcaneOptions) {
                    exactArcaneScoreCount++;
                    exhaustiveBest = Math.max(exhaustiveBest, score(effects, option.effect));
                }
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked subsets`).toBeGreaterThan(0);
            expect(exactArcaneScoreCount, `${scenario.weaponName} seed ${scenarioIndex} exact Arcane scores`)
                .toBeGreaterThan(legalLoadoutCount);

            const result = optimizeBuild(weapon!, candidates, "windowDps", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride: scenario.target,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: true,
                maxFormaCount,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: true,
                arcaneCandidates,
                warframeArmor: scenario.warframeArmor,
                ...energyContext,
                buildForAttack: attack,
            });
            const resultEffects = result.slots.map((mod, index) => {
                if (!mod) return null;
                const rank = result.slotRanks[index] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const resultArcaneEffect = result.arcane
                ? getArcaneEffectAtRank(result.arcane, result.arcaneRank, scenario.warframeArmor, true, energyContext)
                : null;
            const optimizedScore = score(resultEffects, resultArcaneEffect);
            const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

            expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} capacity`).toBe(true);
            expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
            expect(optimizedScore, `${scenario.weaponName} seed ${scenarioIndex} exact ranked 5s Avg DPS`)
                .toBeCloseTo(exhaustiveBest, 7);
            expect(result.windowDpsScore, `${scenario.weaponName} seed ${scenarioIndex} reported score`)
                .toBeCloseTo(exhaustiveBest, 7);
        }
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

    it("selects Vigilante Supplies for its modeled set bonus and skips other unscored Exilus utility", { timeout: 60_000 }, () => {
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

        expect(result.exilusMod?.name).toBe("Vigilante Supplies");
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

    it("keeps Exilus-assisted Expected TTK builds within capacity and the total Forma cap", { timeout: 60000 }, () => {
        const scenarios = [
            { weaponName: "Kuva Ogris", attackName: "Rocket Explosion" },
            { weaponName: "Nataruk", attackName: "Perfect Shot" },
        ];

        for (const scenario of scenarios) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attack = weapon!.attacks.find((entry) => entry.name === scenario.attackName);
            expect(attack, `${scenario.weaponName} / ${scenario.attackName}`).toBeTruthy();
            const capacityConfig = {
                weaponRank: weapon!.canOverLevel ? 40 : 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const result = optimizeBuild(
                weapon!,
                filterBuilderExpertVariants(getModsForWeapon(weapon!)),
                "timeToKill",
                8,
                {
                    targetFaction: "Grineer",
                    capacityConfig,
                    slotPolarities: weapon!.polarities,
                    defaultSlotPolarities: weapon!.polarities,
                    allowCatalyst: true,
                    allowForma: true,
                    maxFormaCount: 3,
                    optimizeExilus: true,
                    exilusPolarity: "",
                    optimizeArcane: true,
                    arcaneCandidates: getArcanesForWeapon(weapon!),
                    buildForAttack: attack!,
                    conditionalState: { mode: "initial" },
                },
            );
            const capacity = computeCapacity(
                capacityConfig,
                [...result.slotPolarities.map((polarity) => ({ polarity })), { polarity: result.exilusPolarity }],
                [...result.slots, result.exilusMod],
                [...result.slotRanks, result.exilusMod ? result.exilusRank : 0],
            );

            expect(result.capacityValid, scenario.weaponName).toBe(true);
            expect(capacity.overCapacity, scenario.weaponName).toBe(false);
            expect(
                countFormaLikeUi(weapon!, result.slotPolarities, "", result.exilusPolarity),
                scenario.weaponName,
            ).toBeLessThanOrEqual(3);
        }
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

    it("finds a viral-oriented scaling build for Nataruk against Grineer", { timeout: 60_000 }, () => {
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

describe("Vigilante set optimizer scoring", () => {
    it("scores selected and external pieces in fast and finite damage objectives", () => {
        const weapon = makeWeapon({ critChance: 0.5, critMultiplier: 2 });
        const setPieceEffect = { ...emptyEffect(), vigilanteSetModCount: 1 };
        const baseState = { mode: "initial" as const };
        const externalSetState = { ...baseState, externalVigilanteSetModCount: 2 };
        const baseBurst = debugScoreBuild(weapon, [], "burst", "", null, null, baseState);
        const selectedPieceBurst = debugScoreBuild(weapon, [setPieceEffect], "burst", "", null, null, baseState);
        const externalPiecesBurst = debugScoreBuild(weapon, [], "burst", "", null, null, externalSetState);
        expect(selectedPieceBurst).toBeGreaterThan(baseBurst);
        expect(externalPiecesBurst).toBeGreaterThan(baseBurst);

        const target = { health: 100_000, shields: 0, overguard: 0, armor: 0 };
        const baseFinite = debugScoreExpectedEncounter(weapon, [], "", target, baseState);
        const setFinite = debugScoreExpectedEncounter(weapon, [setPieceEffect], "", target, externalSetState);
        expect(baseFinite.timeToKillSeconds).not.toBeNull();
        expect(setFinite.timeToKillSeconds).not.toBeNull();
        expect(setFinite.timeToKillSeconds).toBeLessThan(baseFinite.timeToKillSeconds!);
    });
});

describe("Nira set optimizer scoring", () => {
    it("scores external pieces for slam Burst and finite TTK, and selects the set mod", () => {
        const whip = getWeaponCatalog().find((candidate) =>
            candidate.category === "Melee" &&
            candidate.attacks.some((attack) => attack.name === "Slam Attack") &&
            getModsForWeapon(candidate).some((mod) => mod.name === "Nira's Contempt"),
        );
        expect(whip).toBeDefined();
        const slamIndex = whip!.attacks.findIndex((attack) => attack.name === "Slam Attack");
        const weapon = withSelectedAttack(whip!, slamIndex);
        const nira = getModsForWeapon(weapon).find((mod) => mod.name === "Nira's Contempt");
        expect(nira).toBeDefined();
        const setPiece = { ...emptyEffect(), niraSetModCount: 1 };
        const state = { mode: "realistic" as const };
        const externalState = { ...state, externalNiraSetModCount: 2 };
        const baseBurst = debugScoreBuild(weapon, [], "burst", "", null, null, state);
        const selectedBurst = debugScoreBuild(weapon, [setPiece], "burst", "", null, null, state);
        const externalBurst = debugScoreBuild(weapon, [], "burst", "", null, null, externalState);
        expect(selectedBurst).toBeGreaterThan(baseBurst);
        expect(externalBurst).toBeGreaterThan(baseBurst);

        const target = { health: 100_000, shields: 0, overguard: 0, armor: 0 };
        const baseFinite = debugScoreExpectedEncounter(weapon, [], "", target, state);
        const externalFinite = debugScoreExpectedEncounter(weapon, [], "", target, externalState);
        expect(baseFinite.timeToKillSeconds).not.toBeNull();
        expect(externalFinite.timeToKillSeconds).not.toBeNull();
        expect(externalFinite.timeToKillSeconds).toBeLessThan(baseFinite.timeToKillSeconds!);

        const setOnlyEffects = nira!.effectsByRank.map(() => ({ ...emptyEffect(), niraSetModCount: 1 }));
        const setOnlyMod: ModEntry = {
            ...nira!,
            effect: setOnlyEffects[nira!.fusionLimit],
            effectsByRank: setOnlyEffects,
            hasDamageEffect: true,
        };
        const optimized = optimizeBuild(weapon, [setOnlyMod], "burst", 1, {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            allowCatalyst: true,
            optimizeArcane: false,
            optimizeExilus: false,
        });
        expect(optimized.slots[0]?.name).toBe("Nira's Contempt");
    });
});

describe("Gladiator set optimizer scoring", () => {
    it("scores combo-scaled melee Critical Chance in fast and finite damage objectives", () => {
        const weapon = makeWeapon({ category: "Melee", weaponType: "Sword", modCompat: "Melee", critChance: 0.5, critMultiplier: 2 });
        const piece = { ...emptyEffect(), gladiatorSetModCount: 1 };
        const state = { mode: "realistic" as const, meleeComboMultiplier: 12 };
        const externalState = { ...state, externalGladiatorSetModCount: 3 };
        const baseBurst = debugScoreBuild(weapon, [], "burst", "", null, null, state);
        const selectedBurst = debugScoreBuild(weapon, [piece], "burst", "", null, null, state);
        const externalBurst = debugScoreBuild(weapon, [], "burst", "", null, null, externalState);
        expect(selectedBurst).toBeGreaterThan(baseBurst);
        expect(externalBurst).toBeGreaterThan(baseBurst);
        const target = { health: 10_000, shields: 0, overguard: 0, armor: 0 };
        const baseFinite = debugScoreExpectedEncounter(weapon, [], "", target, state);
        const setFinite = debugScoreExpectedEncounter(weapon, [piece], "", target, externalState);
        expect(baseFinite.timeToKillSeconds).not.toBeNull();
        expect(setFinite.timeToKillSeconds).not.toBeNull();
        expect(setFinite.timeToKillSeconds).toBeLessThan(baseFinite.timeToKillSeconds!);
    });
});

describe("Gladiator optimizer selection", () => {
    it("selects a combo-duration Gladiator mod when its set bonus improves the melee objective", () => {
        const weapon = makeWeapon({ category: "Melee", weaponType: "Sword", modCompat: "Melee", critChance: 0.2, critMultiplier: 2 });
        const gladiatorRush = getModsForWeapon(weapon).find((mod) => mod.name === "Gladiator Rush");
        expect(gladiatorRush).toBeDefined();
        const options = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            allowCatalyst: true,
            optimizeArcane: false,
            optimizeExilus: false,
            conditionalState: { mode: "realistic" as const, externalGladiatorSetModCount: 3 },
        };
        const atBaseCombo = optimizeBuild(weapon, [gladiatorRush!], "burst", 1, {
            ...options,
            conditionalState: { ...options.conditionalState, meleeComboMultiplier: 1 },
        });
        const atTwelveCombo = optimizeBuild(weapon, [gladiatorRush!], "burst", 1, {
            ...options,
            conditionalState: { ...options.conditionalState, meleeComboMultiplier: 12 },
        });
        expect(atBaseCombo.slots[0]).toBeNull();
        expect(atTwelveCombo.slots[0]?.name).toBe("Gladiator Rush");
    });
});

describe("Sacrificial set optimizer scoring", () => {
    it("scores and selects the two-piece melee set on a Sentient target", () => {
        const weapon = makeWeapon({
            category: "Melee",
            weaponType: "Sword",
            modCompat: "Melee",
            critChance: 0.2,
            statusChance: 0,
        });
        const setPath = "/Lotus/Upgrades/Mods/Sets/Sacrifice/SacrificeSetMod";
        const setMods = getModsForWeapon(weapon).filter((mod) => mod.setBonusPath === setPath);
        const pressure = setMods.find((mod) => mod.name === "Sacrificial Pressure");
        const steel = setMods.find((mod) => mod.name === "Sacrificial Steel");
        expect(pressure).toBeDefined();
        expect(steel).toBeDefined();
        const effects = [
            pressure!.effectsByRank[pressure!.fusionLimit],
            steel!.effectsByRank[steel!.fusionLimit],
        ];
        const unboostedEffects = effects.map((effect) => ({ ...effect, sacrificialSetModCount: 0 }));
        const scoreWithSet = debugScoreBuild(weapon, effects, "burst", "Sentient");
        const scoreWithoutSet = debugScoreBuild(weapon, unboostedEffects, "burst", "Sentient");
        expect(scoreWithSet).toBeGreaterThan(scoreWithoutSet);

        const target = { health: 50_000, shields: 0, overguard: 0, armor: 0 };
        const finiteWithSet = debugScoreExpectedEncounter(weapon, effects, "Sentient", target);
        const finiteWithoutSet = debugScoreExpectedEncounter(weapon, unboostedEffects, "Sentient", target);
        expect(finiteWithSet.timeToKillSeconds).not.toBeNull();
        expect(finiteWithoutSet.timeToKillSeconds).not.toBeNull();
        expect(finiteWithSet.timeToKillSeconds).toBeLessThan(finiteWithoutSet.timeToKillSeconds!);

        const result = optimizeBuild(weapon, [pressure!, steel!], "burst", 2, {
            slotPolarities: ["", ""],
            defaultSlotPolarities: ["", ""],
            allowForma: false,
            allowCatalyst: true,
            optimizeArcane: false,
            optimizeExilus: false,
            targetFaction: "Sentient",
        });
        expect(result.slots.map((mod) => mod?.name).sort()).toEqual(["Sacrificial Pressure", "Sacrificial Steel"]);
    });
});

describe("Strain Infection optimizer scope", () => {
    it("uses cysts for Burst while excluding them from Scaling, finite TTK, and 5s Avg DPS", () => {
        const weapon = makeWeapon({
            category: "Melee",
            weaponType: "Sword",
            modCompat: "Melee",
            critChance: 0.5,
            critMultiplier: 2,
            fireRate: 1,
        });
        const strainInfection = { ...emptyEffect(), strainInfectionCritDamagePerCyst: 0.2 };
        const withoutCysts = { mode: "initial" as const, strainInfectionCystsAtImpact: 0 };
        const eightCysts = { mode: "initial" as const, strainInfectionCystsAtImpact: 8 };
        const target = { health: 100_000, shields: 0, overguard: 0, armor: 0 };

        expect(debugScoreBuild(weapon, [strainInfection], "burst", "", null, undefined, eightCysts))
            .toBeGreaterThan(debugScoreBuild(weapon, [strainInfection], "burst", "", null, undefined, withoutCysts));
        expect(debugScoreBuild(weapon, [strainInfection], "scaling", "", null, undefined, eightCysts))
            .toBeCloseTo(debugScoreBuild(weapon, [strainInfection], "scaling", "", null, undefined, withoutCysts), 10);
        expect(debugScoreBuild(weapon, [strainInfection], "meleeDps", "", null, undefined, eightCysts))
            .toBeCloseTo(debugScoreBuild(weapon, [strainInfection], "meleeDps", "", null, undefined, withoutCysts), 10);

        const finiteWithCysts = debugEvaluateExpectedEncounter(weapon, [strainInfection], "", target, eightCysts);
        const finiteWithoutCysts = debugEvaluateExpectedEncounter(weapon, [strainInfection], "", target, withoutCysts);
        expect(finiteWithCysts.timeToKillSeconds).toBe(finiteWithoutCysts.timeToKillSeconds);
        expect(finiteWithCysts.damagePerSecond).toBeCloseTo(finiteWithoutCysts.damagePerSecond, 10);

        const windowWithCysts = debugEvaluateFixedWindowDps(weapon, [strainInfection], "", target, eightCysts);
        const windowWithoutCysts = debugEvaluateFixedWindowDps(weapon, [strainInfection], "", target, withoutCysts);
        expect(windowWithCysts.damageInWindow).toBeCloseTo(windowWithoutCysts.damageInWindow, 10);
        expect(windowWithCysts.damagePerSecond).toBeCloseTo(windowWithoutCysts.damagePerSecond, 10);
        expect(debugScoreBuild(weapon, [strainInfection], "windowDps", "", null, target, eightCysts))
            .toBeCloseTo(debugScoreBuild(weapon, [strainInfection], "windowDps", "", null, target, withoutCysts), 10);
    });
});

describe("Strain Fever optimizer scope", () => {
    it("allows Helminth Claws Burst with a positive cyst snapshot and blocks unsupported objectives", () => {
        const claws = getWeaponCatalog().find((weapon) => weapon.name === "Helminth Claws");
        expect(claws).toBeDefined();
        const strainFever = getModsForWeapon(claws!).find((mod) => mod.name === "Strain Fever");
        expect(strainFever).toBeDefined();
        const shared = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
            conditionalState: { mode: "initial" as const, strainInfectionCystsAtImpact: 8 },
        };

        const supportedBurst = optimizeBuild(claws!, [strainFever!], "burst", 1, shared);
        const zeroCystBurst = optimizeBuild(claws!, [strainFever!], "burst", 1, {
            ...shared,
            conditionalState: { mode: "initial", strainInfectionCystsAtImpact: 0 },
        });
        const finite = optimizeBuild(claws!, [strainFever!], "timeToKill", 1, shared);
        const scaling = optimizeBuild(claws!, [strainFever!], "scaling", 1, shared);
        const windowDps = optimizeBuild(claws!, [strainFever!], "windowDps", 1, shared);

        expect(supportedBurst.slots.some((mod) => mod?.name === "Strain Fever")).toBe(true);
        expect(zeroCystBurst.slots.some((mod) => mod?.name === "Strain Fever")).toBe(false);
        expect(finite.slots.some((mod) => mod?.name === "Strain Fever")).toBe(false);
        expect(scaling.slots.some((mod) => mod?.name === "Strain Fever")).toBe(false);
        expect(windowDps.slots.some((mod) => mod?.name === "Strain Fever")).toBe(false);

        const explanation = explainBuild(
            claws!,
            [strainFever!],
            [strainFever!.fusionLimit],
            "burst",
            "",
            undefined,
            shared.conditionalState,
        );
        expect(explanation.buildHighlights.join(" ")).toContain("assumes 8 active cysts at impact");
        expect(explanation.buildHighlights.join(" ")).toContain("adds 320% additive Damage");
        expect(explanation.buildHighlights.join(" ")).toContain("+240% note conflicts");
    });
});

describe("Swipe group scoring", () => {
    it("scores rank-capped extra Kavat targets with the disclosed claw follow-through proxy only for Burst and Scaling", () => {
        const smeeta = getWeaponCatalog().find((weapon) => weapon.name === "Smeeta Claws")!;
        const swipe = getModsForWeapon(smeeta).find((mod) => mod.name === "Swipe")!;
        const targetWith = (nearbySwipeTargetCount: number) => ({ nearbySwipeTargetCount });
        const baseline = debugScoreBuild(smeeta, [], "burst", "Grineer");

        expect(debugScoreBuild(smeeta, [swipe.effectsByRank[3]], "burst", "Grineer", null, targetWith(0)))
            .toBeCloseTo(baseline, 9);
        expect(debugScoreBuild(smeeta, [swipe.effectsByRank[0]], "burst", "Grineer", null, targetWith(4)))
            .toBeCloseTo(baseline * 1.8, 8);
        expect(debugScoreBuild(smeeta, [swipe.effectsByRank[3]], "burst", "Grineer", null, targetWith(2)))
            .toBeCloseTo(baseline * 2.44, 8);
        expect(debugScoreBuild(smeeta, [swipe.effectsByRank[3]], "scaling", "Grineer", null, targetWith(4)))
            .toBeCloseTo(debugScoreBuild(smeeta, [], "scaling", "Grineer") * 3.3616, 7);

        const finiteTarget = targetWith(4);
        expect(debugScoreBuild(smeeta, [swipe.effectsByRank[3]], "timeToKill", "Grineer", null, finiteTarget))
            .toBeCloseTo(debugScoreBuild(smeeta, [], "timeToKill", "Grineer", null, finiteTarget), 9);
        expect(debugScoreBuild(smeeta, [swipe.effectsByRank[3]], "windowDps", "Grineer", null, finiteTarget))
            .toBeCloseTo(debugScoreBuild(smeeta, [], "windowDps", "Grineer", null, finiteTarget), 9);

        const options = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
            targetProfileOverride: finiteTarget,
        };
        expect(optimizeBuild(smeeta, [swipe], "burst", 1, {
            ...options,
            targetProfileOverride: targetWith(0),
        }).slots.some((mod) => mod?.name === "Swipe")).toBe(false);
        const supported = optimizeBuild(smeeta, [swipe], "burst", 1, options);
        expect(supported.slots.some((mod) => mod?.name === "Swipe")).toBe(true);
        expect(optimizeBuild(smeeta, [swipe], "scaling", 1, options).slots.some((mod) => mod?.name === "Swipe")).toBe(true);
        expect(optimizeBuild(smeeta, [swipe], "timeToKill", 1, options).slots.some((mod) => mod?.name === "Swipe")).toBe(false);
        expect(optimizeBuild(smeeta, [swipe], "windowDps", 1, options).slots.some((mod) => mod?.name === "Swipe")).toBe(false);

        expect(getUnmodeledDamageEffectLines(swipe, swipe.fusionLimit).join(" ")).toContain("entered group-hit estimate");
        expect(getUnmodeledDamageEffectLines(swipe, swipe.fusionLimit, {
            selectedGoal: "burst",
            selectedSwipeTargetCount: 2,
        })).toEqual([]);
        expect(getUnmodeledDamageEffectLines(swipe, swipe.fusionLimit, {
            selectedGoal: "timeToKill",
            selectedSwipeTargetCount: 2,
        }).join(" ")).toContain("Auto Optimize skips it");

        const explanation = explainBuild(
            smeeta,
            [swipe],
            [3],
            "burst",
            "",
            undefined,
            undefined,
            targetWith(2),
        );
        expect(explanation.summary).toContain("Swipe group score estimate");
        expect(explanation.buildHighlights.join(" ")).toContain("about 2.44 primary-target equivalents");
        expect(explanation.summary).not.toContain("using the entered current-level pool");
    });
});

describe("seeded Swipe group optimizer oracle", () => {
    it("matches exact two-slot rank-limited winners across Kavat claws and entered group sizes", { timeout: 120_000 }, () => {
        let seed = 20261168;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Smeeta Claws", faction: "Grineer", targetCount: 1 },
            { weaponName: "Adarza Claws", faction: "Corpus", targetCount: 2 },
            { weaponName: "Vasca Claws", faction: "Infested", targetCount: 3 },
            { weaponName: "Smeeta Claws", faction: "Grineer", targetCount: 4 },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            expect(weapon!.tags).toContain("KAVAT_WEAPON");
            const swipe = getModsForWeapon(weapon!).find((mod) => mod.name === "Swipe");
            expect(swipe, `${scenario.weaponName} Swipe`).toBeDefined();
            const scoringWeapon = weapon!;
            const targetProfileOverride = { nearbySwipeTargetCount: scenario.targetCount };
            const conditionalState: ConditionalState = { mode: "realistic" };
            const scoringContext = {
                selectedAttackName: scoringWeapon.selectedAttackName,
                selectedAttackTrigger: scoringWeapon.trigger,
                selectedAttackIsAreaDamage: scoringWeapon.selectedAttackIsAreaDamage,
                targetFaction: scenario.faction,
                targetHasOverguard: false,
                selectedWeaponName: scoringWeapon.name,
                selectedSwipeTargetCount: scenario.targetCount,
            };
            const fullyModeledPool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.uniqueName !== swipe!.uniqueName && mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        (["burst", "scaling"] as const).every((selectedGoal) =>
                            getUnmodeledDamageEffectLines(mod, rank, { ...scoringContext, selectedGoal }).length === 0
                        ) && getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = [swipe!, ...shuffled(fullyModeledPool).slice(0, 3)];
            expect(candidates.length, `${scenario.weaponName} sampled-pool size`).toBe(4);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                Math.floor(random() * (Math.min(2, mod.fusionLimit) + 1)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const slotCount = 2;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            const bestScores = { burst: 0, scaling: 0 };
            const score = (goal: "burst" | "scaling", effects: (ModEffect | null)[]) =>
                debugScoreBuild(
                    scoringWeapon,
                    effects,
                    goal,
                    scenario.faction,
                    null,
                    targetProfileOverride,
                    conditionalState,
                );
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index]!.uniqueName]!;
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, 0);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;
                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                bestScores.burst = Math.max(bestScores.burst, score("burst", effects));
                bestScores.scaling = Math.max(bestScores.scaling, score("scaling", effects));
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
                if (ordered.length >= slotCount) return;
                for (let index = 0; index < remaining.length; index++) {
                    const candidate = remaining[index]!;
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked loadouts`).toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} two-mod loadout`).toBe(slotCount);

            for (const goal of ["burst", "scaling"] as const) {
                const result = optimizeBuild(weapon!, candidates, goal, slotCount, {
                    targetFaction: scenario.faction,
                    conditionalState,
                    targetProfileOverride,
                    capacityConfig,
                    slotPolarities,
                    defaultSlotPolarities: slotPolarities,
                    allowForma: false,
                    allowNonMaxRank: true,
                    ownedModUniqueNames,
                    ownedModMaxRankByUniqueName,
                    optimizeExilus: false,
                    optimizeArcane: false,
                });
                const resultEffects = result.slots.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                const optimizedScore = score(goal, resultEffects);
                expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} ${goal} capacity`).toBe(true);
                for (const [slotIndex, mod] of result.slots.entries()) {
                    if (!mod) continue;
                    expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} ${goal} owned rank`)
                        .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]!);
                }
                expect(optimizedScore, `${scenario.weaponName} seed ${scenarioIndex} exact ${goal} score`)
                    .toBeCloseTo(bestScores[goal], 8);
            }
        }
    });
});

describe("Static Discharge optimizer scope", () => {
    it("keeps the mod out of standard Auto Optimize while the manual cycle report is available", () => {
        const prova = getWeaponCatalog().find((weapon) => weapon.name === "Prova")!;
        const staticDischarge = getModsForWeapon(prova).find((mod) => mod.name === "Static Discharge")!;
        const options = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        };
        const result = optimizeBuild(prova, [staticDischarge], "burst", 1, options);

        expect(result.slots.some((mod) => mod?.name === "Static Discharge")).toBe(false);
        expect(getUnmodeledDamageEffectLines(staticDischarge, staticDischarge.fusionLimit)
            .join(" ")).toContain("manual Prova cycle estimate");
    });
});

describe("seeded Vulcan Blitz optimizer oracle", () => {
    it("matches exhaustive two-slot owned-rank winners across target factions, defenses, and neighbor distances", { timeout: 120_000 }, () => {
        let seed = 20261171;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
            }
            return result;
        };
        const scenarios = [
            { faction: "Grineer", health: 80, armor: 0, neighborCount: 1, averageDistance: 0.4 },
            { faction: "Corpus", health: 125, armor: 0, neighborCount: 2, averageDistance: 1.2 },
            { faction: "Infested", health: 180, armor: 120, neighborCount: 3, averageDistance: 2.1 },
            { faction: "Grineer", health: 20_000, armor: 2_700, neighborCount: 4, averageDistance: 4.1 },
        ] as const;

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === "Jat Kittag");
            expect(weapon, "Jat Kittag").toBeTruthy();
            const normalAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
            expect(normalAttackIndex).toBeGreaterThanOrEqual(0);
            const scoringWeapon = withSelectedAttack(weapon!, normalAttackIndex);
            const vulcanBlitz = getModsForWeapon(scoringWeapon).find((mod) => mod.name === "Vulcan Blitz");
            expect(vulcanBlitz).toBeDefined();
            const targetProfileOverride = {
                health: scenario.health,
                shields: 0,
                overguard: 0,
                armor: scenario.armor,
                nearbyVulcanBlitzEnemyCount: scenario.neighborCount,
                nearbyVulcanBlitzAverageDistanceMeters: scenario.averageDistance,
            };
            const scoringContext = {
                selectedWeaponName: scoringWeapon.name,
                selectedAttackName: scoringWeapon.selectedAttackName,
                selectedAttackTrigger: scoringWeapon.trigger,
                selectedAttackIsAreaDamage: scoringWeapon.selectedAttackIsAreaDamage,
                targetFaction: scenario.faction,
                targetHasOverguard: false,
                targetHasShields: false,
                selectedVulcanBlitzEnemyCount: scenario.neighborCount,
                selectedVulcanBlitzAverageDistanceMeters: scenario.averageDistance,
                selectedGoal: "burst",
            };
            const fullyModeledPool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(scoringWeapon))
                    .filter((mod) => mod.uniqueName !== vulcanBlitz!.uniqueName && mod.isPveEligible !== false &&
                        mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank, scoringContext).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const sampledOtherMods: ModEntry[] = [];
            for (const mod of shuffled(fullyModeledPool)) {
                if (sampledOtherMods.some((selected) => selected.incompatibilityGroup === mod.incompatibilityGroup)) continue;
                sampledOtherMods.push(mod);
                if (sampledOtherMods.length === 3) break;
            }
            const candidates = [vulcanBlitz!, ...sampledOtherMods];
            expect(candidates.length, `seed ${scenarioIndex} candidate pool`).toBe(4);

            const ownedRankCountsByUniqueName: Record<string, Record<string, number>> = {};
            const allowedRanksByUniqueName = new Map<string, number[]>();
            for (const mod of candidates) {
                const possibleRanks = Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank);
                const ownedRanks = possibleRanks.filter(() => random() < 0.65);
                if (ownedRanks.length === 0) ownedRanks.push(possibleRanks[Math.floor(random() * possibleRanks.length)]!);
                ownedRankCountsByUniqueName[mod.uniqueName] = Object.fromEntries(ownedRanks.map((rank) => [String(rank), 1]));
                const optimizerRanks = ownedRanks.filter((rank) => mod.name === "Vulcan Blitz"
                    ? scenario.averageDistance < (mod.effectsByRank[rank]?.vulcanBlitzRadiusMeters ?? 0)
                    : getUnmodeledDamageEffectLines(mod, rank, scoringContext).length === 0);
                allowedRanksByUniqueName.set(mod.uniqueName, optimizerRanks);
            }
            const slotCount = 2;
            const slotPolarities = scoringWeapon.polarities.slice(0, slotCount);
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: scoringWeapon.canOverLevel,
            };
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const conditionalState: ConditionalState = { mode: "realistic" };
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            let bestScore = 0;
            const scoreEffects = (effects: (ModEffect | null)[]) => debugScoreBuild(
                scoringWeapon,
                effects,
                "burst",
                scenario.faction,
                null,
                targetProfileOverride,
                conditionalState,
            );
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const options = allowedRanksByUniqueName.get(ordered[index]!.uniqueName) ?? [];
                    for (const rank of options) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, 0);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;
                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                bestScore = Math.max(bestScore, scoreEffects(effects));
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
                if (ordered.length >= slotCount) return;
                for (let index = 0; index < remaining.length; index++) {
                    const candidate = remaining[index]!;
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
            expect(legalRankedLoadoutCount, `seed ${scenarioIndex} legal ranked loadouts`).toBeGreaterThan(10);
            expect(maximumLegalSlotCount, `seed ${scenarioIndex} two-mod loadout`).toBe(slotCount);

            const optimized = optimizeBuild(scoringWeapon, candidates, "burst", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModRankCountsByUniqueName: ownedRankCountsByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
            });
            const optimizedEffects = optimized.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = optimized.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            const optimizedScore = scoreEffects(optimizedEffects);
            expect(optimized.capacityValid, `seed ${scenarioIndex} capacity`).toBe(true);
            for (const [slotIndex, mod] of optimized.slots.entries()) {
                if (!mod) continue;
                const ownedRanks = Object.keys(ownedRankCountsByUniqueName[mod.uniqueName] ?? {}).map(Number);
                expect(ownedRanks, `seed ${scenarioIndex} selected ${mod.name} owned rank ${optimized.slotRanks[slotIndex]}`).toContain(optimized.slotRanks[slotIndex]);
            }
            expect(optimizedScore, `seed ${scenarioIndex} exhaustive Burst winner`).toBeCloseTo(bestScore, 8);
        }
    });
});

describe("Acid Shells bounded Burst group scoring", () => {
    it("scores an entered same-profile group and keeps the mod out of unsupported objectives", () => {
        const sobek = getWeaponCatalog().find((weapon) => weapon.name === "Sobek")!;
        const normalAttack = withSelectedAttack(sobek, sobek.attacks.findIndex((attack) => attack.name === "Normal Attack"));
        const acidShells = getModsForWeapon(normalAttack).find((mod) => mod.name === "Acid Shells")!;
        const baseStats = calculateBuild(normalAttack, []).modded;
        const expectedDirectHit = Object.values(baseStats.damageBreakdown).reduce((total, amount) => total + amount, 0) *
            baseStats.damageWeightedMultishot * avgHitDamageMultiplier(baseStats.critChance, baseStats.critMultiplier);
        const targetProfileOverride = {
            health: Math.max(1, expectedDirectHit * 0.5),
            shields: 0,
            overguard: 0,
            armor: 0,
            nearbyAcidShellsEnemyCount: 2,
            nearbyAcidShellsAverageDistanceMeters: 2.4,
        };
        const baseline = debugScoreBuild(normalAttack, [], "burst", "Infested", null, targetProfileOverride);
        const withAcidShells = debugScoreBuild(
            normalAttack,
            [acidShells.effectsByRank[acidShells.fusionLimit]!],
            "burst",
            "Infested",
            null,
            targetProfileOverride,
        );
        expect(withAcidShells).toBeGreaterThan(baseline);

        const optimizeOptions = {
            targetFaction: "Infested",
            targetProfileOverride,
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            allowNonMaxRank: true,
            ownedModUniqueNames: new Set([acidShells.uniqueName]),
            ownedModRankCountsByUniqueName: { [acidShells.uniqueName]: { "0": 1, "1": 1, "2": 1 } },
            optimizeArcane: false,
            optimizeExilus: false,
        };
        const supported = optimizeBuild(normalAttack, [acidShells], "burst", 1, optimizeOptions);
        expect(supported.slots[0]?.name).toBe("Acid Shells");

        const unsupported = optimizeBuild(normalAttack, [acidShells], "scaling", 1, optimizeOptions);
        expect(unsupported.slots.some((mod) => mod?.name === "Acid Shells")).toBe(false);
    });

    it("matches four seeded randomized two-slot R0–R2 owned-rank winners", { timeout: 120_000 }, () => {
        let seed = 20261172;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
            }
            return result;
        };
        const scenarios = [
            { faction: "Grineer", neighborCount: 1, averageDistance: 0.3, steelPath: false },
            { faction: "Corpus", neighborCount: 2, averageDistance: 1.1, steelPath: true },
            { faction: "Infested", neighborCount: 3, averageDistance: 2.0, steelPath: false },
            { faction: "Grineer", neighborCount: 4, averageDistance: 2.4, steelPath: true },
        ] as const;

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const sobek = getWeaponCatalog().find((weapon) => weapon.name === "Sobek")!;
            const normalAttack = withSelectedAttack(sobek, sobek.attacks.findIndex((attack) => attack.name === "Normal Attack"));
            const acidShells = getModsForWeapon(normalAttack).find((mod) => mod.name === "Acid Shells")!;
            const baseStats = calculateBuild(normalAttack, [], scenario.faction).modded;
            const expectedDirectHit = Object.values(baseStats.damageBreakdown).reduce((total, amount) => total + amount, 0) *
                baseStats.damageWeightedMultishot * avgHitDamageMultiplier(baseStats.critChance, baseStats.critMultiplier);
            const healthBeforeSteelPath = expectedDirectHit * (scenario.steelPath ? 0.18 + random() * 0.12 : 0.45 + random() * 0.3);
            const targetProfileOverride = {
                health: healthBeforeSteelPath * (scenario.steelPath ? 2.5 : 1),
                shields: 0,
                overguard: 0,
                armor: 0,
                nearbyAcidShellsEnemyCount: scenario.neighborCount,
                nearbyAcidShellsAverageDistanceMeters: scenario.averageDistance,
                acidShellsMaxHealthBeforeSteelPath: healthBeforeSteelPath,
                isSteelPathTarget: scenario.steelPath,
            };
            const scoringContext = {
                selectedWeaponName: normalAttack.name,
                selectedAttackName: normalAttack.selectedAttackName,
                selectedAttackTrigger: normalAttack.trigger,
                selectedAttackIsAreaDamage: normalAttack.selectedAttackIsAreaDamage,
                targetFaction: scenario.faction,
                targetHasOverguard: false,
                targetHasShields: false,
                selectedAcidShellsEnemyCount: scenario.neighborCount,
                selectedAcidShellsAverageDistanceMeters: scenario.averageDistance,
                selectedTargetIsSteelPath: scenario.steelPath,
                selectedGoal: "burst",
            };
            const fullyModeledPool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(normalAttack))
                    .filter((mod) => mod.uniqueName !== acidShells.uniqueName && mod.isPveEligible !== false &&
                        mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank, scoringContext).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const otherMods: ModEntry[] = [];
            for (const mod of shuffled(fullyModeledPool)) {
                if (otherMods.some((selected) => selected.incompatibilityGroup === mod.incompatibilityGroup)) continue;
                otherMods.push(mod);
                if (otherMods.length === 2) break;
            }
            const candidates = [acidShells, ...otherMods];
            expect(candidates.length, `seed ${scenarioIndex} candidate pool`).toBe(3);

            const ownedRankCountsByUniqueName: Record<string, Record<string, number>> = {};
            const allowedRanksByUniqueName = new Map<string, number[]>();
            for (const mod of candidates) {
                const possibleRanks = Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank);
                const ownedRanks = possibleRanks.filter(() => random() < 0.7);
                if (ownedRanks.length === 0) ownedRanks.push(possibleRanks[Math.floor(random() * possibleRanks.length)]!);
                ownedRankCountsByUniqueName[mod.uniqueName] = Object.fromEntries(ownedRanks.map((rank) => [String(rank), 1]));
                const optimizerRanks = ownedRanks.filter((rank) => mod.name === "Acid Shells"
                    ? scenario.averageDistance < (mod.effectsByRank[rank]?.acidShellsRadiusMeters ?? 0)
                    : getUnmodeledDamageEffectLines(mod, rank, scoringContext).length === 0);
                allowedRanksByUniqueName.set(mod.uniqueName, optimizerRanks);
            }
            const slotCount = 2;
            const slotPolarities = Array.from({ length: slotCount }, (_, index) => normalAttack.polarities[index] ?? "");
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: normalAttack.canOverLevel,
            };
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            let legalRankedLoadoutCount = 0;
            let bestScore = 0;
            const scoreEffects = (effects: (ModEffect | null)[]) => debugScoreBuild(
                normalAttack,
                effects,
                "burst",
                scenario.faction,
                null,
                targetProfileOverride,
            );
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const options = allowedRanksByUniqueName.get(ordered[index]!.uniqueName) ?? [];
                    for (const rank of options) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }
                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, 0);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;
                legalRankedLoadoutCount++;
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                bestScore = Math.max(bestScore, scoreEffects(effects));
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
                if (ordered.length >= slotCount) return;
                for (let index = 0; index < remaining.length; index++) {
                    const candidate = remaining[index]!;
                    if (ordered.some((mod) => mod.uniqueName === candidate.uniqueName ||
                        (candidate.incompatibilityGroup && mod.incompatibilityGroup === candidate.incompatibilityGroup))) continue;
                    enumerate([...remaining.slice(0, index), ...remaining.slice(index + 1)], [...ordered, candidate]);
                }
            };
            enumerate(candidates, []);
            expect(legalRankedLoadoutCount, `seed ${scenarioIndex} legal ranked loadouts`).toBeGreaterThan(10);

            const optimized = optimizeBuild(normalAttack, candidates, "burst", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModRankCountsByUniqueName: ownedRankCountsByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
            });
            const optimizedEffects = optimized.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = optimized.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            expect(optimized.capacityValid, `seed ${scenarioIndex} capacity`).toBe(true);
            expect(
                scoreEffects(optimizedEffects),
                `seed ${scenarioIndex} sampled-pool winner; optimized=${optimized.slots.map((mod, index) =>
                    mod ? `${mod.name}@R${optimized.slotRanks[index]}` : "empty").join(", ")}; allowed=${JSON.stringify(Object.fromEntries(allowedRanksByUniqueName))}; candidates=${candidates.map((mod) => mod.name).join(", ")}`,
            ).toBeCloseTo(bestScore, 8);
        }
    });
});

describe("Battacor Sentient Barrage optimizer scope", () => {
    it("uses the augment only for a ready, charged direct Burst snapshot", () => {
        const battacor = getWeaponCatalog().find((weapon) => weapon.name === "Battacor")!;
        const altFireIndex = battacor.attacks.findIndex((attack) => attack.name === "Secondary Fire");
        const altFire = withSelectedAttack(battacor, altFireIndex);
        const sentientBarrage = getModsForWeapon(battacor).find((mod) => mod.path === SENTIENT_BARRAGE_MOD_PATH)!;
        const options = {
            conditionalState: {
                mode: "initial",
                battacorAltFireChargeCount: 3,
                sentientBarrageNextDischargeReady: true,
            } satisfies ConditionalState,
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        };
        const ready = optimizeBuild(altFire, [sentientBarrage], "burst", 1, options);
        expect(ready.mods.some((mod) => mod?.path === SENTIENT_BARRAGE_MOD_PATH)).toBe(true);

        const notReady = optimizeBuild(altFire, [sentientBarrage], "burst", 1, {
            ...options,
            conditionalState: { ...options.conditionalState, sentientBarrageNextDischargeReady: false },
        });
        expect(notReady.mods.some((mod) => mod?.path === SENTIENT_BARRAGE_MOD_PATH)).toBe(false);
        expect(() => optimizeBuild(altFire, [sentientBarrage], "burst", 1, {
            ...options,
            conditionalState: { ...options.conditionalState, battacorAltFireChargeCount: 0 },
        })).toThrow(/at least one current charge/);
        expect(() => optimizeBuild(altFire, [sentientBarrage], "scaling", 1, options))
            .toThrow(/only for direct single-target Burst/);
    });

    it("matches four seeded randomized two-slot rank-limited pools across target factions and charge snapshots", { timeout: 120_000 }, () => {
        let seed = 20261170;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
            }
            return result;
        };
        const battacor = getWeaponCatalog().find((weapon) => weapon.name === "Battacor")!;
        const altFire = withSelectedAttack(battacor, battacor.attacks.findIndex((attack) => attack.name === "Secondary Fire"));
        const sentientBarrage = getModsForWeapon(battacor).find((mod) => mod.path === SENTIENT_BARRAGE_MOD_PATH)!;
        const scenarios = [
            { faction: "Grineer", charges: 1, rankCap: 1 },
            { faction: "Corpus", charges: 2, rankCap: 2 },
            { faction: "Infested", charges: 3, rankCap: 1 },
            { faction: "Corrupted", charges: 3, rankCap: 2 },
        ] as const;

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const conditionalState: ConditionalState = {
                mode: "realistic",
                battacorAltFireChargeCount: scenario.charges,
                sentientBarrageNextDischargeReady: true,
            };
            const scoringContext = {
                selectedWeaponName: altFire.name,
                selectedAttackName: altFire.selectedAttackName,
                selectedAttackTrigger: altFire.trigger,
                selectedAttackIsAreaDamage: altFire.selectedAttackIsAreaDamage,
                selectedGoal: "burst",
                targetFaction: scenario.faction,
                battacorAltFireChargeCount: scenario.charges,
                sentientBarrageNextDischargeReady: true,
            };
            const ordinaryPool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(battacor))
                    .filter((mod) => mod.path !== SENTIENT_BARRAGE_MOD_PATH && mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank, scoringContext).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = [sentientBarrage, ...shuffled(ordinaryPool).slice(0, 3)];
            expect(candidates.length, `seed ${scenarioIndex} candidate pool`).toBe(4);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                mod === sentientBarrage
                    ? scenario.rankCap
                    : Math.floor(random() * (Math.min(2, mod.fusionLimit) + 1)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const slotCount = 2;
            const score = (effects: (ModEffect | null)[]) =>
                debugScoreBuild(altFire, effects, "burst", scenario.faction, null, undefined, conditionalState);
            let bestScore = score([]);
            let legalRankedLoadoutCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const mod = ordered[index]!;
                    const maximumRank = ownedModMaxRankByUniqueName[mod.uniqueName]!;
                    for (let rank = 0; rank <= maximumRank; rank++) {
                        if (getUnmodeledDamageEffectLines(mod, rank, scoringContext).length > 0) continue;
                        if (getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length > 0) continue;
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }
                const placed = assignModsToSlots(ordered, ranks, ["", ""], slotCount, false);
                if (placed.slotMods.filter(Boolean).length !== ordered.length) return;
                legalRankedLoadoutCount++;
                const effects = placed.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placed.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                bestScore = Math.max(bestScore, score(effects));
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
                if (ordered.length >= slotCount) return;
                for (let index = 0; index < remaining.length; index++) {
                    const candidate = remaining[index]!;
                    if (ordered.some((mod) => mod.uniqueName === candidate.uniqueName ||
                        (candidate.incompatibilityGroup && mod.incompatibilityGroup === candidate.incompatibilityGroup))) continue;
                    enumerate([...remaining.slice(0, index), ...remaining.slice(index + 1)], [...ordered, candidate]);
                }
            };
            enumerate(candidates, []);
            expect(legalRankedLoadoutCount, `seed ${scenarioIndex} legal ranked loadouts`).toBeGreaterThan(0);

            const result = optimizeBuild(altFire, candidates, "burst", slotCount, {
                targetFaction: scenario.faction,
                conditionalState,
                allowForma: false,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModMaxRankByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
            });
            const resultEffects = result.slots.map((mod, slotIndex) => {
                if (!mod) return null;
                const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            expect(result.capacityValid, `seed ${scenarioIndex} capacity`).toBe(true);
            expect(score(resultEffects), `seed ${scenarioIndex} exact winner`)
                .toBeCloseTo(bestScore, 8);
        }
    });
});

describe("Dreadful Killshot optimizer scope", () => {
    it("uses the current-health snapshot only for Burst and excludes it from other optimizer goals", () => {
        const basmu = getWeaponCatalog().find((weapon) => weapon.name === "Basmu");
        expect(basmu).toBeDefined();
        const dreadfulKillshot = getModsForWeapon(basmu!).find((mod) => mod.name === "Dreadful Killshot");
        expect(dreadfulKillshot).toBeDefined();
        const conditionalState = { mode: "initial" as const, dreadfulKillshotCurrentHealth: 1_350 };
        const options = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
            conditionalState,
        };

        const burst = optimizeBuild(basmu!, [dreadfulKillshot!], "burst", 1, options);
        const finite = optimizeBuild(basmu!, [dreadfulKillshot!], "timeToKill", 1, options);
        const scaling = optimizeBuild(basmu!, [dreadfulKillshot!], "scaling", 1, options);
        const windowDps = optimizeBuild(basmu!, [dreadfulKillshot!], "windowDps", 1, options);
        const rankFiveEffect = dreadfulKillshot!.effectsByRank[dreadfulKillshot!.fusionLimit]!;
        const withoutHealthSnapshot = { ...conditionalState, dreadfulKillshotCurrentHealth: 0 };

        expect(burst.slots.some((mod) => mod?.name === "Dreadful Killshot")).toBe(true);
        expect(finite.slots.some((mod) => mod?.name === "Dreadful Killshot")).toBe(false);
        expect(scaling.slots.some((mod) => mod?.name === "Dreadful Killshot")).toBe(false);
        expect(windowDps.slots.some((mod) => mod?.name === "Dreadful Killshot")).toBe(false);
        for (const goal of ["scaling", "windowDps"] as const) {
            expect(debugScoreBuild(basmu!, [rankFiveEffect], goal, "", null, undefined, conditionalState))
                .toBe(debugScoreBuild(basmu!, [rankFiveEffect], goal, "", null, undefined, withoutHealthSnapshot));
        }
        const explanation = explainBuild(
            basmu!,
            [dreadfulKillshot!],
            [dreadfulKillshot!.fusionLimit],
            "burst",
            "",
            undefined,
            conditionalState,
        );
        expect(explanation.buildHighlights.join(" ")).toContain("Dreadful Killshot Burst score assumes 1350 current Warframe Health");
        expect(explanation.buildHighlights.join(" ")).toContain("Scaling, sustained DPS, finite TTK, and fixed-window scoring exclude it");
    });
});

describe("Deadly Maneuvers optimizer scope", () => {
    it("allows Burst optimization only with a positive Magnus headshot snapshot", () => {
        const magnus = getWeaponCatalog().find((weapon) => weapon.name === "Magnus");
        expect(magnus).toBeDefined();
        const deadlyManeuvers = getModsForWeapon(magnus!).find((mod) => mod.name === "Deadly Maneuvers");
        expect(deadlyManeuvers).toBeDefined();
        const targetProfileOverride = {
            health: 10_000,
            shields: 0,
            armor: 0,
            overguard: 0,
            headshotHitRate: 0.5,
        };
        const options = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
            targetProfileOverride,
            conditionalState: { mode: "initial" as const, deadlyManeuversShotsRemaining: 2 },
        };

        const burst = optimizeBuild(magnus!, [deadlyManeuvers!], "burst", 1, options);
        const zeroSnapshot = optimizeBuild(magnus!, [deadlyManeuvers!], "burst", 1, {
            ...options,
            conditionalState: { mode: "initial" as const, deadlyManeuversShotsRemaining: 0 },
        });
        const noHeadshotShare = optimizeBuild(magnus!, [deadlyManeuvers!], "burst", 1, {
            ...options,
            targetProfileOverride: { ...targetProfileOverride, headshotHitRate: 0 },
        });
        const finite = optimizeBuild(magnus!, [deadlyManeuvers!], "timeToKill", 1, options);
        const scaling = optimizeBuild(magnus!, [deadlyManeuvers!], "scaling", 1, options);
        const windowDps = optimizeBuild(magnus!, [deadlyManeuvers!], "windowDps", 1, options);
        const rankThree = deadlyManeuvers!.effectsByRank[deadlyManeuvers!.fusionLimit]!;
        const withoutSnapshot = { mode: "initial" as const, deadlyManeuversShotsRemaining: 0 };

        expect(burst.slots.some((mod) => mod?.name === "Deadly Maneuvers")).toBe(true);
        expect(zeroSnapshot.slots.some((mod) => mod?.name === "Deadly Maneuvers")).toBe(false);
        expect(noHeadshotShare.slots.some((mod) => mod?.name === "Deadly Maneuvers")).toBe(false);
        expect(finite.slots.some((mod) => mod?.name === "Deadly Maneuvers")).toBe(false);
        expect(scaling.slots.some((mod) => mod?.name === "Deadly Maneuvers")).toBe(false);
        expect(windowDps.slots.some((mod) => mod?.name === "Deadly Maneuvers")).toBe(false);
        expect(debugScoreBuild(magnus!, [rankThree], "burst", "", null, targetProfileOverride, options.conditionalState))
            .toBeGreaterThan(debugScoreBuild(magnus!, [rankThree], "burst", "", null, targetProfileOverride, withoutSnapshot));
        expect(debugScoreBuild(magnus!, [rankThree], "timeToKill", "", null, targetProfileOverride, options.conditionalState))
            .toBe(debugScoreBuild(magnus!, [rankThree], "timeToKill", "", null, targetProfileOverride, withoutSnapshot));
        for (const goal of ["scaling", "windowDps"] as const) {
            expect(debugScoreBuild(magnus!, [rankThree], goal, "", null, targetProfileOverride, options.conditionalState))
                .toBe(debugScoreBuild(magnus!, [rankThree], goal, "", null, targetProfileOverride, withoutSnapshot));
        }

        const explanation = explainBuild(
            magnus!,
            [deadlyManeuvers!],
            [deadlyManeuvers!.fusionLimit],
            "burst",
            "",
            undefined,
            options.conditionalState,
            targetProfileOverride,
        );
        expect(explanation.buildHighlights.join(" ")).toContain("Deadly Maneuvers Burst scoring assumes 2 buffed shots remain after a dodge");
        expect(explanation.buildHighlights.join(" ")).toContain("finite TTK, and fixed-window scoring exclude this snapshot");
    });
});

describe("Critical Precision and Unseen Dread optimizer scope", () => {
    const basicOptions = {
        slotPolarities: [""],
        defaultSlotPolarities: [""],
        allowForma: false,
        optimizeArcane: false,
        optimizeExilus: false,
        targetProfileOverride: { health: 25_000, shields: 0, armor: 0, overguard: 0 },
    };

    it("offers Critical Precision to Burst optimization only on Tiberon Burst rows with a positive snapshot", () => {
        const tiberon = getWeaponCatalog().find((weapon) => weapon.name === "Tiberon")!;
        const tiberonPrime = getWeaponCatalog().find((weapon) => weapon.name === "Tiberon Prime")!;
        const criticalPrecision = getModsForWeapon(tiberon).find((mod) => mod.name === "Critical Precision")!;
        const tiberonBurst = withSelectedAttack(tiberon, tiberon.attacks.findIndex((attack) => attack.trigger === "Burst"));
        const primeBurst = withSelectedAttack(tiberonPrime, tiberonPrime.attacks.findIndex((attack) => attack.name === "Burst"));
        const primeSemi = withSelectedAttack(tiberonPrime, tiberonPrime.attacks.findIndex((attack) => attack.trigger !== "Burst"));
        const activeOptions = {
            ...basicOptions,
            conditionalState: { mode: "initial" as const, criticalPrecisionHeadshotProjectiles: 50 },
        };
        const burst = optimizeBuild(tiberonBurst, [criticalPrecision], "burst", 1, activeOptions);
        const zeroSnapshot = optimizeBuild(tiberonBurst, [criticalPrecision], "burst", 1, {
            ...activeOptions,
            conditionalState: { mode: "initial" as const, criticalPrecisionHeadshotProjectiles: 0 },
        });
        const finite = optimizeBuild(tiberonBurst, [criticalPrecision], "timeToKill", 1, activeOptions);
        const wrongPrimeMode = optimizeBuild(primeSemi, [criticalPrecision], "burst", 1, activeOptions);
        const primeBurstResult = optimizeBuild(primeBurst, [criticalPrecision], "burst", 1, activeOptions);

        expect(burst.slots.some((mod) => mod?.name === "Critical Precision")).toBe(true);
        expect(primeBurstResult.slots.some((mod) => mod?.name === "Critical Precision")).toBe(true);
        expect(zeroSnapshot.slots.some((mod) => mod?.name === "Critical Precision")).toBe(false);
        expect(finite.slots.some((mod) => mod?.name === "Critical Precision")).toBe(false);
        expect(wrongPrimeMode.slots.some((mod) => mod?.name === "Critical Precision")).toBe(false);
    });

    it("offers Unseen Dread to direct Burst optimization only while the invisibility snapshot is active", () => {
        const dread = getWeaponCatalog().find((weapon) => weapon.name === "Dread")!;
        const unseenDread = getModsForWeapon(dread).find((mod) => mod.name === "Unseen Dread")!;
        const directAttackIndex = dread.attacks.findIndex((attack) => attack.isAreaDamage === false);
        const directDread = withSelectedAttack(dread, directAttackIndex);
        const activeOptions = {
            ...basicOptions,
            conditionalState: { mode: "initial" as const, unseenDreadInvisibilityActive: true },
        };
        const active = optimizeBuild(directDread, [unseenDread], "burst", 1, activeOptions);
        const inactive = optimizeBuild(directDread, [unseenDread], "burst", 1, {
            ...activeOptions,
            conditionalState: { mode: "initial" as const, unseenDreadInvisibilityActive: false },
        });
        const finite = optimizeBuild(directDread, [unseenDread], "timeToKill", 1, activeOptions);
        const area = optimizeBuild({ ...directDread, selectedAttackIsAreaDamage: true }, [unseenDread], "burst", 1, activeOptions);

        expect(active.slots.some((mod) => mod?.name === "Unseen Dread")).toBe(true);
        expect(inactive.slots.some((mod) => mod?.name === "Unseen Dread")).toBe(false);
        expect(finite.slots.some((mod) => mod?.name === "Unseen Dread")).toBe(false);
        expect(area.slots.some((mod) => mod?.name === "Unseen Dread")).toBe(false);
    });

    it("offers Critical Mutation only for a positive prior-kill snapshot on the Catabolyst Primary Burst row", () => {
        const catabolyst = getWeaponCatalog().find((weapon) => weapon.name === "Catabolyst")!;
        const codaCatabolyst = getWeaponCatalog().find((weapon) => weapon.name === "Coda Catabolyst")!;
        const criticalMutation = getModsForWeapon(catabolyst).find((mod) => mod.name === "Critical Mutation")!;
        const directAttack = withSelectedAttack(catabolyst, catabolyst.attacks.findIndex((attack) => attack.name === "Primary"));
        const reloadGrenade = withSelectedAttack(catabolyst, catabolyst.attacks.findIndex((attack) => attack.name === "Partial Reload Impact"));
        const codaDirectAttack = withSelectedAttack(codaCatabolyst, codaCatabolyst.attacks.findIndex((attack) => attack.name === "Primary"));
        const activeOptions = {
            ...basicOptions,
            conditionalState: { mode: "initial" as const, criticalMutationPriorKills: 10 },
        };
        const active = optimizeBuild(directAttack, [criticalMutation], "burst", 1, activeOptions);
        const zeroSnapshot = optimizeBuild(directAttack, [criticalMutation], "burst", 1, {
            ...activeOptions,
            conditionalState: { mode: "initial" as const, criticalMutationPriorKills: 0 },
        });
        const finite = optimizeBuild(directAttack, [criticalMutation], "timeToKill", 1, activeOptions);
        const coda = optimizeBuild(codaDirectAttack, [criticalMutation], "burst", 1, activeOptions);
        const explanation = explainBuild(
            directAttack,
            [criticalMutation],
            [criticalMutation.fusionLimit],
            "burst",
            "",
            undefined,
            activeOptions.conditionalState,
            basicOptions.targetProfileOverride,
        );

        expect(active.slots.some((mod) => mod?.name === "Critical Mutation")).toBe(true);
        expect(coda.slots.some((mod) => mod?.name === "Critical Mutation")).toBe(true);
        expect(zeroSnapshot.slots.some((mod) => mod?.name === "Critical Mutation")).toBe(false);
        expect(finite.slots.some((mod) => mod?.name === "Critical Mutation")).toBe(false);
        expect(getUnmodeledDamageEffectLines(criticalMutation, criticalMutation.fusionLimit, {
            selectedWeaponName: "Catabolyst",
            selectedAttackName: reloadGrenade.selectedAttackName,
            selectedAttackIsAreaDamage: reloadGrenade.selectedAttackIsAreaDamage,
            criticalMutationPriorKills: 10,
            selectedGoal: "burst",
        }).join(" ")).toContain("Primary Burst row only");
        expect(explanation.buildHighlights.join(" ")).toContain("Critical Mutation Burst scoring assumes 10 prior kills");
        expect(explanation.buildHighlights.join(" ")).toContain("Stack changes, including grenade-hit reduction, are not simulated");
    });

    it("scores Ripkas Critical Chance while disclosing its linked Shotgun reload bonus", () => {
        const ripkas = getWeaponCatalog().find((weapon) => weapon.name === "Ripkas")!;
        const amalgamRipkas = getModsForWeapon(ripkas).find((mod) => mod.name === "Amalgam Ripkas True Steel")!;
        const attackIndex = ripkas.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(attackIndex).toBeGreaterThanOrEqual(0);
        expect(amalgamRipkas).toBeDefined();

        const directRipkas = withSelectedAttack(ripkas, attackIndex);
        const result = optimizeBuild(directRipkas, [amalgamRipkas], "burst", 1, basicOptions);
        const warnings = getUnmodeledDamageEffectLines(amalgamRipkas, amalgamRipkas.fusionLimit, {
            selectedWeaponName: "Ripkas",
            selectedAttackName: directRipkas.selectedAttackName,
            selectedAttackTrigger: directRipkas.trigger,
            selectedAttackIsAreaDamage: directRipkas.selectedAttackIsAreaDamage,
            selectedGoal: "burst",
        });

        expect(result.slots.some((mod) => mod?.name === "Amalgam Ripkas True Steel")).toBe(true);
        expect(warnings.join(" ")).toContain("+20% Reload Speed on Shotguns");
        expect(warnings.join(" ")).toContain("applies to separate Shotgun equipment");
        expect(warnings.join(" ")).toContain("Gore Chance is a utility effect");
        expect(getUnmodeledDamageEffectSourceUrl(amalgamRipkas)).toBe("https://wiki.warframe.com/w/Amalgam_Ripkas_True_Steel");
    });
});

describe("seeded Burst and Scaling optimizer oracles", () => {
    it("matches four randomized, rank-limited three-slot pools for both objectives", { timeout: 300000 }, () => {
        let seed = 20261156;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const shuffled = <T,>(items: T[]): T[] => {
            const result = [...items];
            for (let index = result.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(random() * (index + 1));
                [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
            }
            return result;
        };
        const scenarios = [
            { weaponName: "Braton Prime", faction: "Grineer", mode: "realistic" as const },
            { weaponName: "Lex Prime", faction: "Corpus", mode: "initial" as const },
            { weaponName: "Cedo", faction: "Grineer", mode: "realistic" as const },
            { weaponName: "Broken War", faction: "Infested", mode: "fullyStacked" as const },
        ];

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === scenario.weaponName);
            expect(weapon, scenario.weaponName).toBeTruthy();
            const attacks = weapon!.attacks.filter((attack) =>
                !attack.modelLimitation && !attack.autoSpoolTimingLimitation,
            );
            expect(attacks.length, `${scenario.weaponName} supported attacks`).toBeGreaterThan(0);
            const attack = attacks[Math.floor(random() * attacks.length)]!;
            const scoringWeapon = withSelectedAttack(weapon!, weapon!.attacks.indexOf(attack));
            const candidatePool = [...new Map(
                filterBuilderExpertVariants(getModsForWeapon(weapon!))
                    .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                    .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                    .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === scenario.faction.toLowerCase())
                    .filter((mod) => Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank).every((rank) =>
                        getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                        getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                    ))
                    .map((mod) => [mod.uniqueName, mod] as const),
            ).values()];
            const candidates = shuffled(candidatePool).slice(0, 4);
            expect(candidates.length, `${scenario.weaponName} seed ${scenarioIndex} candidate pool`).toBe(4);
            const ownedModMaxRankByUniqueName = Object.fromEntries(candidates.map((mod) => [
                mod.uniqueName,
                1 + Math.floor(random() * Math.min(2, mod.fusionLimit)),
            ]));
            const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));
            const capacityConfig = {
                weaponRank: 30,
                hasCatalyst: true,
                masteryRank: 30,
                canOverLevel: weapon!.canOverLevel,
            };
            const slotCount = 3;
            const slotPolarities = weapon!.polarities.slice(0, slotCount);
            const maxFormaCount = scenarioIndex % 2;
            const conditionalState: ConditionalState = { mode: scenario.mode };
            const score = (goal: "burst" | "scaling", effects: (ModEffect | null)[]) =>
                debugScoreBuild(scoringWeapon, effects, goal, scenario.faction, null, undefined, conditionalState);
            const bestScores = {
                burst: score("burst", []),
                scaling: score("scaling", []),
            };
            let legalRankedLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            const scoreRanks = (ordered: ModEntry[], ranks: number[], index: number) => {
                if (index < ordered.length) {
                    const maxRank = ownedModMaxRankByUniqueName[ordered[index].uniqueName];
                    for (let rank = 0; rank <= maxRank; rank++) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, true, maxFormaCount);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                legalRankedLoadoutCount++;
                maximumLegalSlotCount = Math.max(maximumLegalSlotCount, ordered.length);
                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                bestScores.burst = Math.max(bestScores.burst, score("burst", effects));
                bestScores.scaling = Math.max(bestScores.scaling, score("scaling", effects));
            };
            const enumerate = (remaining: ModEntry[], ordered: ModEntry[]) => {
                scoreRanks(ordered, Array(ordered.length).fill(0), 0);
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
            expect(legalRankedLoadoutCount, `${scenario.weaponName} seed ${scenarioIndex} legal ranked loadouts`)
                .toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `${scenario.weaponName} seed ${scenarioIndex} three-mod loadout`)
                .toBe(slotCount);

            for (const goal of ["burst", "scaling"] as const) {
                const result = optimizeBuild(weapon!, candidates, goal, slotCount, {
                    targetFaction: scenario.faction,
                    conditionalState,
                    capacityConfig,
                    slotPolarities,
                    defaultSlotPolarities: slotPolarities,
                    allowForma: maxFormaCount > 0,
                    maxFormaCount,
                    allowNonMaxRank: true,
                    ownedModUniqueNames,
                    ownedModMaxRankByUniqueName,
                    optimizeExilus: false,
                    optimizeArcane: false,
                    buildForAttack: attack,
                });
                const resultEffects = result.slots.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = result.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                const optimizedScore = score(goal, resultEffects);
                const formaUsed = countPolarityChanges(slotPolarities, result.slotPolarities.slice(0, slotCount));

                expect(result.capacityValid, `${scenario.weaponName} seed ${scenarioIndex} ${goal} capacity`).toBe(true);
                expect(formaUsed, `${scenario.weaponName} seed ${scenarioIndex} ${goal} Forma budget`).toBeLessThanOrEqual(maxFormaCount);
                for (const [slotIndex, mod] of result.slots.entries()) {
                    if (!mod) continue;
                    expect(result.slotRanks[slotIndex], `${scenario.weaponName} seed ${scenarioIndex} ${goal} owned rank`)
                        .toBeLessThanOrEqual(ownedModMaxRankByUniqueName[mod.uniqueName]);
                }
                expect(optimizedScore, `${scenario.weaponName} seed ${scenarioIndex} exact ${goal} score`)
                    .toBeCloseTo(bestScores[goal], 8);
            }
        }
    });
});

describe("Static Discharge optimizer scope", () => {
    it("keeps the mod out of standard Auto Optimize while the manual cycle report is available", () => {
        const prova = getWeaponCatalog().find((weapon) => weapon.name === "Prova")!;
        const staticDischarge = getModsForWeapon(prova).find((mod) => mod.name === "Static Discharge")!;
        const options = {
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        };
        const result = optimizeBuild(prova, [staticDischarge], "burst", 1, options);

        expect(result.slots.some((mod) => mod?.name === "Static Discharge")).toBe(false);
        expect(getUnmodeledDamageEffectLines(staticDischarge, staticDischarge.fusionLimit)
            .join(" ")).toContain("manual Prova cycle estimate");
    });
});
