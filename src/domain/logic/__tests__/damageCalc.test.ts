import { describe, expect, it } from "vitest";
import { getWeaponCatalog, withSelectedAttack, type WeaponEntry } from "../../catalog/weaponCatalog";
import { emptyEffect, getModsForWeapon, getUnmodeledDamageEffectLines, type ModEffect } from "../../catalog/modCatalog";
import { getUnmodeledDamageEffectSourceUrl, getUnmodeledScoringEffectLines } from "../../catalog/modEffectUtils";
import { buildCustomRivenEntry, CURRENT_RIVEN_STAT_MULTIPLIER, type CustomRivenStatValue } from "../../rivens";
import { avgHitDamageMultiplier, calculateBuild, calculateBuildForExpectedEncounter, calculateMeleeAverageDps, estimateConditionalStackFactor, estimateFiniteIndependentDotDps, getHitLocationDotDamageMultiplier, estimateNonCriticalNoStatusHitGroupProbability, normalizeStrainInfectionCystCount, type ConditionalState } from "../damageCalc";
import { STATUS_DAMAGE_TYPES, STATUS_EFFECT_RULES, gasCloudRadiusFromStacks } from "../damageRuleset";

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

function makeRivenEffect(stats: CustomRivenStatValue[]): ModEffect {
    return buildCustomRivenEntry({
        id: "element-order-test",
        name: "Element Order Test Riven",
        sourceWeaponUniqueName: "/Test/ElementOrderRiven",
        sourceWeaponName: "Element Order Test Weapon",
        sourceWeaponDisposition: CURRENT_RIVEN_STAT_MULTIPLIER,
        familyKey: "element-order-test",
        polarity: "madurai",
        drain: 16,
        stats,
        createdAtIso: "2026-11-15T00:00:00.000Z",
        updatedAtIso: "2026-11-15T00:00:00.000Z",
    }).effect;
}

describe("Eximus Advantage Wiki effect", () => {
    it("parses all ranks and applies only to sustained headshots against an Eximus target", () => {
        const weapons = getWeaponCatalog();
        const zylok = weapons.find((candidate) => candidate.name === "Zylok");
        const zylokPrime = weapons.find((candidate) => candidate.name === "Zylok Prime");
        expect(zylok).toBeDefined();
        expect(zylokPrime).toBeDefined();

        const expectedBonuses = [1, 2, 3, 4, 5, 6];
        for (const weapon of [zylok!, zylokPrime!]) {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Eximus Advantage");
            expect(mod).toBeDefined();
            expect(mod!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.stats.damageBonus)).toEqual(expectedBonuses);
            expect(mod!.effectsByRank.every((effect) => effect.conditionalEffects[0]?.trigger === "onHeadshot" &&
                effect.conditionalEffects[0]?.durationSeconds === 10 &&
                effect.conditionalEffects[0]?.requiresEximusTarget === true)).toBe(true);
            expect(mod!.unparsedStatsByRank?.every((lines) => lines.length === 0)).toBe(true);
            expect(getUnmodeledDamageEffectLines(mod!, mod!.fusionLimit)).toEqual([]);

            const active = calculateBuild(weapon, [mod!.effect], "", {
                conditionalState: { mode: "realistic" },
                isEximusTarget: true,
                hitLocation: { headshotRate: 1 },
            }).modded;
            const ordinaryTarget = calculateBuild(weapon, [mod!.effect], "", {
                conditionalState: { mode: "fullyStacked" },
                isEximusTarget: false,
                hitLocation: { headshotRate: 1 },
            }).modded;
            const noHeadshots = calculateBuild(weapon, [mod!.effect], "", {
                conditionalState: { mode: "realistic" },
                isEximusTarget: true,
                hitLocation: { headshotRate: 0 },
            }).modded;
            const baseline = calculateBuild(weapon, [], "", {
                conditionalState: { mode: "realistic" },
                isEximusTarget: true,
                hitLocation: { headshotRate: 1 },
            }).modded;

            expect(active.totalDamage).toBeGreaterThan(baseline.totalDamage);
            expect(ordinaryTarget.totalDamage).toBeCloseTo(baseline.totalDamage, 8);
            expect(noHeadshots.totalDamage).toBeCloseTo(baseline.totalDamage, 8);
        }
    });
});

describe("Tennokai mod catalog coverage", () => {
    it("keeps Mentor's Legacy selectable and labels unsupported Tennokai timing", () => {
        const meleeWeapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(meleeWeapon).toBeDefined();
        const meleeMods = getModsForWeapon(meleeWeapon!);
        const tennokaiNames = [
            "Condition's Perfection",
            "Discipline's Merit",
            "Dreamer's Wrath",
            "Master's Edge",
            "Mentor's Legacy",
            "Opportunity's Reach",
            "Truth's Flame",
        ];
        const tennokaiMods = tennokaiNames.map((name) => meleeMods.find((mod) => mod.name === name));

        expect(tennokaiMods.every(Boolean)).toBe(true);
        const mentor = tennokaiMods[4]!;
        expect(mentor).toMatchObject({ fusionLimit: 0, isExilus: true, hasDamageEffect: false });
        expect(mentor.statsTextByRank).toEqual(["Enables Tennokai."]);

        for (const mod of tennokaiMods) {
            expect(getUnmodeledDamageEffectLines(mod!, mod!.fusionLimit)).toContain(
                "Tennokai opportunity timing and attack-chain cadence are not modeled or scored.",
            );
        }
        const truthsFlame = tennokaiMods[6]!;
        expect(getUnmodeledDamageEffectLines(truthsFlame, truthsFlame.fusionLimit)).toContain(
            "Truth's Affinity-earned syndicate effect (radial Gas damage, 25% Health restore, and a temporary +25% Parkour Maneuvers buff) is not modeled, so Auto Optimize skips this mod.",
        );
        expect(getUnmodeledDamageEffectSourceUrl(truthsFlame)).toBe("https://wiki.warframe.com/w/Syndicates");
    });
});

describe("Acid Shells Wiki rank display and safe scoring exclusion", () => {
    it("shows the current rank table while keeping the death explosion unmodeled", () => {
        const catalog = getWeaponCatalog();
        const sobek = catalog.find((weapon) => weapon.name === "Sobek");
        const kuvaSobek = catalog.find((weapon) => weapon.name === "Kuva Sobek");
        const braton = catalog.find((weapon) => weapon.name === "Braton Prime");
        expect(sobek).toBeDefined();
        expect(kuvaSobek).toBeDefined();
        expect(braton).toBeDefined();

        const expectedRankText = [
            "On death: 75 Corrosive Damage + 7.5% of enemy max Health as Blast Damage; 2.5m radius",
            "On death: 150 Corrosive Damage + 15% of enemy max Health as Blast Damage; 5m radius",
            "On death: 225 Corrosive Damage + 22.5% of enemy max Health as Blast Damage; 7.5m radius",
            "On death: 300 Corrosive Damage + 30% of enemy max Health as Blast Damage; 10m radius",
            "On death: 375 Corrosive Damage + 37.5% of enemy max Health as Blast Damage; 12.5m radius",
            "On death: 450 Corrosive Damage + 45% of enemy max Health as Blast Damage; 15m radius",
        ];
        const warning = "Acid Shells' on-death explosion is not scored; its falloff, line-of-sight checks, mode-specific max-Health scaling, and chain explosions are not modeled, so Auto Optimize skips the mod.";

        for (const weapon of [sobek!, kuvaSobek!]) {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Acid Shells");
            expect(mod).toBeDefined();
            expect(mod!.statsTextByRank).toEqual(expectedRankText);
            expect(mod!.hasDamageEffect).toBe(false);
            expect(mod!.effectsByRank.every((effect) => effect.damageBonus === 0 && effect.blastBonus === 0 && effect.corrosiveBonus === 0)).toBe(true);
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                expect(getUnmodeledDamageEffectLines(mod!, rank)).toContain(warning);
            }
        }

        expect(getModsForWeapon(braton!).some((candidate) => candidate.name === "Acid Shells")).toBe(false);
    });
});

describe("Thermagnetic Shells Wiki rank display and safe scoring exclusion", () => {
    it("shows all sourced ranks on the Detron variants without scoring the on-death explosion", () => {
        const catalog = getWeaponCatalog();
        const weapons = ["Detron", "Mara Detron", "Tenet Detron"].map((name) => {
            const weapon = catalog.find((candidate) => candidate.name === name);
            expect(weapon, name).toBeDefined();
            return weapon!;
        });
        const expectedRankText = [
            "Enemies explode on death, dealing 20 Magnetic Damage (+10% Enemy Max Health) in a 6m radius.",
            "Enemies explode on death, dealing 40 Magnetic Damage (+20% Enemy Max Health) in a 6m radius.",
            "Enemies explode on death, dealing 60 Magnetic Damage (+30% Enemy Max Health) in a 6m radius.",
            "Enemies explode on death, dealing 80 Magnetic Damage (+40% Enemy Max Health) in a 6m radius.",
        ];
        const warning = "Thermagnetic Shells triggers an on-death explosion: 20–80 Magnetic Damage plus 10–40% of the triggering enemy's max Health as Blast Damage in a 6m radius. Linear falloff and line of sight apply. The Wiki says Elemental Ammo status effects no longer recursively retrigger these death explosions; the planner still does not resolve on-kill area damage, adjacent-target deaths, or mission-specific max-Health scaling, so Auto Optimize skips the mod.";

        for (const weapon of weapons) {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Thermagnetic Shells");
            expect(mod).toBeDefined();
            expect(mod!.uniqueName).toBe("/Lotus/Upgrades/Mods/Rifle/Event/CorpusArena/SupraCorpusArenaMod");
            expect(mod!.fusionLimit).toBe(3);
            expect(mod!.statsTextByRank).toEqual(expectedRankText);
            expect(mod!.hasDamageEffect).toBe(false);
            expect(mod!.effectsByRank.every((effect) => effect.magneticBonus === 0 && effect.blastBonus === 0)).toBe(true);
            expect(getUnmodeledDamageEffectSourceUrl(mod!)).toBe("https://wiki.warframe.com/w/Thermagnetic_Shells");
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                expect(getUnmodeledDamageEffectLines(mod!, rank)).toContain(warning);
            }
        }

        const braton = catalog.find((weapon) => weapon.name === "Braton Prime");
        expect(braton).toBeDefined();
        expect(getModsForWeapon(braton!).some((candidate) => candidate.name === "Thermagnetic Shells")).toBe(false);
    });
});

describe("Combustion Beam Wiki rank display and safe scoring exclusion", () => {
    it("labels each rank as Blast damage while keeping the unmodeled on-kill explosion out of scoring", () => {
        const amprex = getWeaponCatalog().find((weapon) => weapon.name === "Amprex");
        const braton = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(amprex).toBeDefined();
        expect(braton).toBeDefined();

        const mod = getModsForWeapon(amprex!).find((candidate) => candidate.name === "Combustion Beam");
        expect(mod).toBeDefined();
        expect(mod!.fusionLimit).toBe(5);
        expect(mod!.statsTextByRank).toEqual([
            "On Beam weapon kill: 100 Blast Damage shortly after death",
            "On Beam weapon kill: 200 Blast Damage shortly after death",
            "On Beam weapon kill: 300 Blast Damage shortly after death",
            "On Beam weapon kill: 400 Blast Damage shortly after death",
            "On Beam weapon kill: 500 Blast Damage shortly after death",
            "On Beam weapon kill: 600 Blast Damage shortly after death",
        ]);
        expect(mod!.hasDamageEffect).toBe(false);
        expect(mod!.effectsByRank.every((effect) => effect.damageBonus === 0 && effect.blastBonus === 0)).toBe(true);

        const warning = "Combustion Beam's delayed on-kill Blast explosion is not scored; its radius/falloff and line-of-sight rules, damage attribution/scaling, and chain behavior are not modeled, so Auto Optimize skips this mod.";
        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toContain(warning);
        }
        expect(getModsForWeapon(braton!).some((candidate) => candidate.name === "Combustion Beam")).toBe(false);
    });
});

describe("Vile Discharge Wiki charge caps and safe scoring exclusion", () => {
    it("shows each stored-damage cap and explains why the discharge is not scored", () => {
        const embolist = getWeaponCatalog().find((weapon) => weapon.name === "Embolist");
        const braton = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(embolist).toBeDefined();
        expect(braton).toBeDefined();

        const mod = getModsForWeapon(embolist!).find((candidate) => candidate.name === "Vile Discharge");
        expect(mod).toBeDefined();
        expect(mod!.statsTextByRank).toEqual([
            "Damage is accumulated up to 5,000. Use Alt-fire to launch an explosive vile sac dealing and resetting the accumulated damage.",
            "Damage is accumulated up to 10,000. Use Alt-fire to launch an explosive vile sac dealing and resetting the accumulated damage.",
            "Damage is accumulated up to 15,000. Use Alt-fire to launch an explosive vile sac dealing and resetting the accumulated damage.",
            "Damage is accumulated up to 20,000. Use Alt-fire to launch an explosive vile sac dealing and resetting the accumulated damage.",
            "Damage is accumulated up to 25,000. Use Alt-fire to launch an explosive vile sac dealing and resetting the accumulated damage.",
            "Damage is accumulated up to 30,000. Use Alt-fire to launch an explosive vile sac dealing and resetting the accumulated damage.",
        ]);
        expect(mod!.hasDamageEffect).toBe(false);
        expect(mod!.effectsByRank.every((effect) => effect.damageBonus === 0 && effect.toxinBonus === 0)).toBe(true);

        const warning = "Vile Discharge's accumulated primary-fire/DoT charge, Alt-Fire timing, and 6m Toxin explosion are not simulated, so Auto Optimize skips this mod.";
        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toContain(warning);
        }
        expect(getModsForWeapon(braton!).some((candidate) => candidate.name === "Vile Discharge")).toBe(false);
    });
});

describe("Sentient Incision Wiki damage display and safe scoring exclusion", () => {
    it("keeps the Venato augment selectable while disclosing its target-dependent exceptions", () => {
        const venato = getWeaponCatalog().find((weapon) => weapon.name === "Venato");
        const venatoPrime = getWeaponCatalog().find((weapon) => weapon.name === "Venato Prime");
        const brokenWar = getWeaponCatalog().find((weapon) => weapon.name === "Broken War");
        expect(venato).toBeDefined();
        expect(venatoPrime).toBeDefined();
        expect(brokenWar).toBeDefined();

        for (const weapon of [venato!, venatoPrime!]) {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Sentient Incision");
            expect(mod).toBeDefined();
            expect(mod!.fusionLimit).toBe(5);
            expect(mod!.statsTextByRank).toEqual([20, 40, 60, 80, 100, 120].map((bonus) =>
                `+${bonus}% additional damage matching the target's weakness. Does not combine with other damage types.`,
            ));
            expect(mod!.hasDamageEffect).toBe(false);
            expect(mod!.effectsByRank.every((effect) => effect.damageBonus === 0)).toBe(true);

            const warning = "Sentient Incision's faction weakness mapping, Overguard-specific element selection, Slam exclusion, and non-scaling elemental status DoT are not modeled, so Auto Optimize skips this mod.";
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                expect(getUnmodeledDamageEffectLines(mod!, rank)).toContain(warning);
            }
        }

        expect(getModsForWeapon(brokenWar!).some((candidate) => candidate.name === "Sentient Incision")).toBe(false);
    });
});

describe("Vulcan Blitz Wiki rank radius correction and safe scoring exclusion", () => {
    it("uses every current Wiki rank radius and leaves the on-death explosion out of damage scoring", () => {
        const jatKittag = getWeaponCatalog().find((weapon) => weapon.name === "Jat Kittag");
        const jatKusar = getWeaponCatalog().find((weapon) => weapon.name === "Jat Kusar");
        expect(jatKittag).toBeDefined();
        expect(jatKusar).toBeDefined();

        const mod = getModsForWeapon(jatKittag!).find((candidate) => candidate.name === "Vulcan Blitz");
        expect(mod).toBeDefined();
        expect(mod!.fusionLimit).toBe(5);
        expect(mod!.statsTextByRank).toEqual([
            "On death: 50 Blast Damage + 10% of enemy max Health; 1m radius",
            "On death: 100 Blast Damage + 20% of enemy max Health; 2m radius",
            "On death: 150 Blast Damage + 30% of enemy max Health; 3m radius",
            "On death: 200 Blast Damage + 40% of enemy max Health; 4m radius",
            "On death: 250 Blast Damage + 50% of enemy max Health; 5m radius",
            "On death: 300 Blast Damage + 60% of enemy max Health; 6m radius",
        ]);
        expect(mod!.hasDamageEffect).toBe(false);
        expect(mod!.effectsByRank.every((effect) => effect.damageBonus === 0 && effect.blastBonus === 0)).toBe(true);

        const warning = "Vulcan Blitz's on-death Blast explosion is not scored; target placement, linear falloff, line of sight, faction/stealth scaling, and whether explosion kills chain are not modeled, so Auto Optimize skips this mod.";
        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toContain(warning);
        }
        expect(getModsForWeapon(jatKusar!).some((candidate) => candidate.name === "Vulcan Blitz")).toBe(false);
    });
});

describe("Nightwatch Napalm Wiki modeling", () => {
    it("replaces the outdated rank description with the fixed blaze mechanics and rank-specific area", () => {
        const ogris = getWeaponCatalog().find((weapon) => weapon.name === "Ogris");
        const kuvaOgris = getWeaponCatalog().find((weapon) => weapon.name === "Kuva Ogris");
        const braton = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(ogris).toBeDefined();
        expect(kuvaOgris).toBeDefined();
        expect(braton).toBeDefined();

        for (const weapon of [ogris!, kuvaOgris!]) {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Nightwatch Napalm");
            expect(mod).toBeDefined();
            expect(mod!.fusionLimit).toBe(5);
            expect(mod!.effectsByRank.map((effect) => effect.nightwatchNapalmEffect)).toEqual([1, 1, 1, 1, 1, 1]);
            expect(mod!.effectsByRank.map((effect) => effect.damageBonus)).toEqual([0, 0, 0, 0, 0, 0]);
            expect(mod!.statsTextByRank).toEqual([15, 30, 45, 60, 75, 90].map((areaBonus) =>
                `150 Heat Damage per tick × 6 ticks (first immediate); fixed 68% Heat proc chance per tick, 3s Heat proc; +${areaBonus}% explosion area`,
            ));
            expect(mod!.unparsedStatsByRank?.every((lines) => lines.length === 0)).toBe(true);
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
            }
        }
        expect(getModsForWeapon(braton!).some((candidate) => candidate.name === "Nightwatch Napalm")).toBe(false);
    });

    it("models non-critical six-tick damage, fixed Heat procs, base damage, faction, and Kuva valence scaling", () => {
        const kuvaOgris = getWeaponCatalog().find((weapon) => weapon.name === "Kuva Ogris");
        expect(kuvaOgris).toBeDefined();
        const explosionIndex = kuvaOgris!.attacks.findIndex((attack) => attack.name === "Rocket Explosion");
        expect(explosionIndex).toBeGreaterThanOrEqual(0);
        const explosion = withSelectedAttack({ ...kuvaOgris!, valenceBonusPct: 0.4, critChance: 1, critMultiplier: 5 }, explosionIndex);
        const napalm = getModsForWeapon(kuvaOgris!).find((candidate) => candidate.name === "Nightwatch Napalm");
        expect(napalm).toBeDefined();

        const result = calculateBuild(explosion, [
            napalm!.effectsByRank[napalm!.fusionLimit],
            { ...emptyEffect(), damageBonus: 1 },
            { ...emptyEffect(), heatBonus: 0.5, statusDamageBonus: 0.5, statusChanceBonus: 10 },
            { ...emptyEffect(), factionDamageBonus: 0.3, targetFaction: "Grineer" },
        ], "Grineer").modded.nightwatchNapalm;

        expect(result).toBeDefined();
        expect(result!.directDamagePerProjectilePerTick).toBeCloseTo(420, 8);
        expect(result!.directDamagePerSecond).toBeCloseTo(420 * explosion.multishot * 6 * explosion.fireRate, 6);
        expect(result!.heatProcChancePerTick).toBe(0.68);
        expect(result!.heatDotDamagePerProcPerTick).toBeCloseTo(798.525, 2);
        expect(result!.heatStatusDurationSeconds).toBe(3);

        const extendedDuration = calculateBuild(explosion, [
            napalm!.effectsByRank[napalm!.fusionLimit],
            { ...emptyEffect(), statusDurationBonus: 1 },
        ]).modded.nightwatchNapalm;
        expect(extendedDuration!.heatStatusDurationSeconds).toBe(6);
        expect(extendedDuration!.heatProcChancePerTick).toBe(0.68);

        const heatImmune = calculateBuild(
            explosion,
            [napalm!.effectsByRank[napalm!.fusionLimit]],
            "Grineer",
            { statusImmuneTypes: ["heat"] },
        ).modded.nightwatchNapalm;
        expect(heatImmune!.directDamagePerProjectilePerTick).toBeCloseTo(210, 8);
        expect(heatImmune!.heatDotDamagePerProcPerTick).toBe(0);
        expect(heatImmune!.heatStatusDamagePerSecond).toBe(0);

        const impactIndex = kuvaOgris!.attacks.findIndex((attack) => attack.name === "Rocket Impact");
        const impact = calculateBuild(
            withSelectedAttack({ ...kuvaOgris!, valenceBonusPct: 0.4 }, impactIndex),
            [napalm!.effectsByRank[napalm!.fusionLimit]],
        ).modded.nightwatchNapalm;
        expect(impact).toBeDefined();

        const braton = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(braton).toBeDefined();
        const unrelated = calculateBuild(
            withSelectedAttack(braton!, 0),
            [napalm!.effectsByRank[napalm!.fusionLimit]],
        ).modded.nightwatchNapalm;
        expect(unrelated).toBeUndefined();
    });
});

describe("Beast Claw Conditioning Wiki conversion", () => {
    const conditioningCases = [
        { name: "Brute Conditioning", conversion: "impact" },
        { name: "Disabling Conditioning", conversion: "puncture" },
        { name: "Precision Conditioning", conversion: "slash" },
    ] as const;

    it("parses all ranks, keeps the mods claw-only, and preserves their shared incompatibility", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        const brokenWar = getWeaponCatalog().find((weapon) => weapon.name === "Broken War");
        expect(claw).toBeDefined();
        expect(brokenWar).toBeDefined();

        const clawMods = getModsForWeapon(claw!);
        const conditioningMods = conditioningCases.map(({ name, conversion }) => {
            const mod = clawMods.find((candidate) => candidate.name === name);
            expect(mod).toBeDefined();
            expect(mod!.fusionLimit).toBe(10);
            expect(mod!.effectsByRank).toHaveLength(11);
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                const effect = mod!.effectsByRank[rank];
                expect(effect.physicalDamageConversion).toBe(conversion);
                expect(effect.damageBonus).toBeCloseTo((rank + 1) * 0.35, 10);
                expect((mod!.unparsedStatsByRank?.[rank] ?? []).some((line) => /Convert all base Physical Damage/i.test(line))).toBe(false);
                expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
            }
            return mod!;
        });

        expect(new Set(conditioningMods.map((mod) => mod.incompatibilityGroup)).size).toBe(1);
        expect(getModsForWeapon(brokenWar!).some((mod) => conditioningCases.some(({ name }) => name === mod.name))).toBe(false);
    });

    it("converts only base physical damage and leaves innate elemental damage intact", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        expect(claw).toBeDefined();
        const weapon: WeaponEntry = {
            ...claw!,
            damage: {
                ...claw!.damage,
                impact: 10,
                puncture: 20,
                slash: 30,
                heat: 10,
                total: 70,
            },
        };

        for (const { name, conversion } of conditioningCases) {
            const mod = getModsForWeapon(claw!).find((candidate) => candidate.name === name);
            expect(mod).toBeDefined();
            const stats = calculateBuild(weapon, [mod!.effectsByRank[mod!.fusionLimit]]).modded;
            expect(stats.physicalDamageConversion).toBe(conversion);
            expect(stats.baseDamageTotal).toBe(70);
            expect(stats.rawDamageBreakdown[conversion]).toBeCloseTo(60 * 4.85, 8);
            for (const physicalType of ["impact", "puncture", "slash"] as const) {
                if (physicalType === conversion) continue;
                expect(stats.rawDamageBreakdown[physicalType]).toBe(0);
            }
            expect(stats.rawDamageBreakdown.heat).toBeCloseTo(10 * 4.85, 8);
        }
    });
});

describe("Beast Claw elemental conversion Wiki rules", () => {
    const conversionCases = [
        { name: "Burning Claws", conversion: "heat", damageBonusKey: "heatBonus" },
        { name: "Chilling Claws", conversion: "cold", damageBonusKey: "coldBonus" },
        { name: "Shocking Claws", conversion: "electricity", damageBonusKey: "electricityBonus" },
        { name: "Sepsis Claws", conversion: "toxin", damageBonusKey: "toxinBonus" },
    ] as const;

    it("parses every rank, keeps all four mods claw-only, and preserves their shared incompatibility", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        const brokenWar = getWeaponCatalog().find((weapon) => weapon.name === "Broken War");
        expect(claw).toBeDefined();
        expect(brokenWar).toBeDefined();

        const clawMods = getModsForWeapon(claw!);
        const conversionMods = conversionCases.map(({ name, conversion, damageBonusKey }) => {
            const mod = clawMods.find((candidate) => candidate.name === name);
            expect(mod).toBeDefined();
            expect(mod!.fusionLimit).toBe(10);
            expect(mod!.effectsByRank).toHaveLength(11);
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                const effect = mod!.effectsByRank[rank];
                expect(effect.elementalDamageConversion).toBe(conversion);
                expect(effect[damageBonusKey]).toBeCloseTo((rank + 1) * 0.3, 10);
                expect(effect.statusChanceBonus).toBeCloseTo((rank + 1) * 0.3, 10);
                expect((mod!.unparsedStatsByRank?.[rank] ?? []).some((line) => /Converts all elemental damage/i.test(line))).toBe(false);
                expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
            }
            return mod!;
        });

        expect(new Set(conversionMods.map((mod) => mod.incompatibilityGroup)).size).toBe(1);
        const conditioning = clawMods.find((mod) => mod.name === "Brute Conditioning");
        expect(conditioning).toBeDefined();
        expect(conversionMods[0].incompatibilityGroup).not.toBe(conditioning!.incompatibilityGroup);
        expect(getModsForWeapon(brokenWar!).some((mod) => conversionCases.some(({ name }) => name === mod.name))).toBe(false);
    });

    it("converts all claw primary elements and elemental mods while preserving secondary damage", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        expect(claw).toBeDefined();
        const weapon: WeaponEntry = {
            ...claw!,
            damage: {
                ...claw!.damage,
                impact: 10,
                puncture: 20,
                slash: 30,
                heat: 5,
                cold: 7,
                electricity: 9,
                toxin: 11,
                radiation: 13,
                magnetic: 17,
                total: 122,
            },
            statusChance: 1,
        };
        const secondaryBonus = { ...emptyEffect(), radiationBonus: 0.5, magneticBonus: 0.4 };
        const otherPrimaryBonuses = { ...emptyEffect(), heatBonus: 0.6, toxinBonus: 0.9 };
        const basePrimaryDamage = 5 + 7 + 9 + 11;
        const allPrimaryModBonus = 3.3 + 0.6 + 0.9;

        for (const { name, conversion } of conversionCases) {
            const mod = getModsForWeapon(claw!).find((candidate) => candidate.name === name);
            expect(mod).toBeDefined();
            const stats = calculateBuild(weapon, [mod!.effectsByRank[mod!.fusionLimit], otherPrimaryBonuses, secondaryBonus]).modded;
            expect(stats.elementalDamageConversion).toBe(conversion);
            expect(stats.baseDamageTotal).toBe(122);
            expect(stats.rawDamageBreakdown[conversion]).toBeCloseTo(basePrimaryDamage + 122 * allPrimaryModBonus, 8);
            for (const primaryType of ["heat", "cold", "electricity", "toxin"] as const) {
                if (primaryType === conversion) continue;
                expect(stats.rawDamageBreakdown[primaryType]).toBe(0);
            }
            expect(stats.rawDamageBreakdown.radiation).toBeCloseTo(13 + 122 * 0.5, 8);
            expect(stats.rawDamageBreakdown.magnetic).toBeCloseTo(17 + 122 * 0.4, 8);
            expect(stats.rawDamageBreakdown.impact).toBe(10);
            expect(stats.rawDamageBreakdown.puncture).toBe(20);
            expect(stats.rawDamageBreakdown.slash).toBe(30);
            expect(stats.statusChance).toBeCloseTo(weapon.statusChance * 4.3, 10);
        }

        const burning = getModsForWeapon(claw!).find((candidate) => candidate.name === "Burning Claws")!;
        const convertedHeat = calculateBuild(weapon, [
            burning.effectsByRank[burning.fusionLimit], otherPrimaryBonuses, secondaryBonus,
        ]).modded;
        const equivalentWeapon: WeaponEntry = {
            ...weapon,
            damage: { ...weapon.damage, heat: basePrimaryDamage, cold: 0, electricity: 0, toxin: 0 },
        };
        const equivalentHeatBonus = calculateBuild(equivalentWeapon, [{
            ...emptyEffect(),
            heatBonus: allPrimaryModBonus,
            statusChanceBonus: 3.3,
        }]).modded;
        expect(convertedHeat.dotTickDamagePerProcByType.heat)
            .toBeCloseTo(equivalentHeatBonus.dotTickDamagePerProcByType.heat!, 8);
    });
});

describe("Bell Ringer Wiki status applications", () => {
    it("models every rank's forced Impact procs and discloses the unmodeled knockdown status", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.uniqueName.includes("/BeastWeapons/"));
        const braton = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(claw).toBeDefined();
        expect(braton).toBeDefined();
        const bellRinger = getModsForWeapon(claw!).find((candidate) => candidate.name === "Bell Ringer");
        expect(bellRinger).toBeDefined();
        expect(bellRinger!.fusionLimit).toBe(3);
        expect(bellRinger!.effectsByRank).toHaveLength(4);
        expect(getModsForWeapon(braton!).some((candidate) => candidate.name === "Bell Ringer")).toBe(false);

        const limitation = "Bell Ringer's knockdown contribution to Condition Overload/Galvanized per-status counts is not modeled because target susceptibility and knockdown duration are unknown; Auto Optimize skips this mod.";
        for (let rank = 0; rank <= bellRinger!.fusionLimit; rank++) {
            const effect = bellRinger!.effectsByRank[rank];
            expect(effect.forcedImpactProcsPerMeleeHit).toBe(rank + 1);
            expect(effect.knockdownOnMeleeHit).toBe(true);
            expect(bellRinger!.unparsedStatsByRank?.[rank]).not.toContain(
                "Melee attacks knock down enemies and apply +" + (rank + 1) + " Impact Status Effects",
            );
            expect(getUnmodeledDamageEffectLines(bellRinger!, rank)).toEqual([limitation]);
            expect(getUnmodeledScoringEffectLines(effect)).toEqual([limitation]);

            const baseline = calculateBuild(claw!, []).modded.forcedProcsPerShot.impact ?? 0;
            const withBellRinger = calculateBuild(claw!, [effect]).modded;
            expect(withBellRinger.forcedProcsPerShot.impact).toBeCloseTo(baseline + rank + 1, 8);
            expect(withBellRinger.unfilteredExtraProcsPerShot.impact).toBeGreaterThanOrEqual(rank + 1);
        }
    });
});

describe("Beast Claw status mod interactions", () => {
    it("converts Bell Ringer Impact applications through every Magnetic Strike rank", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.name === "Chesa Claws");
        const braton = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(claw).toBeDefined();
        expect(braton).toBeDefined();

        const bellRinger = getModsForWeapon(claw!).find((candidate) => candidate.name === "Bell Ringer");
        const magneticStrike = getModsForWeapon(claw!).find((candidate) => candidate.name === "Magnetic Strike");
        expect(bellRinger).toBeDefined();
        expect(magneticStrike).toBeDefined();
        expect(getModsForWeapon(braton!).some((candidate) => candidate.name === "Magnetic Strike")).toBe(false);
        expect(magneticStrike!.effectsByRank.map((effect) => effect.impactStatusAppliesMagneticChance))
            .toEqual([0.25, 0.5, 0.75, 1]);

        const maxBellRingerRank = bellRinger!.effectsByRank[bellRinger!.fusionLimit];
        for (let rank = 0; rank <= magneticStrike!.fusionLimit; rank++) {
            const effect = magneticStrike!.effectsByRank[rank];
            expect(magneticStrike!.unparsedStatsByRank?.[rank]).toEqual([]);
            expect(getUnmodeledDamageEffectLines(magneticStrike!, rank)).toEqual([]);

            const result = calculateBuild(claw!, [maxBellRingerRank, effect]).modded;
            const expectedImpactApplicationsPerHit = (claw!.statusChance ?? 0) + maxBellRingerRank.forcedImpactProcsPerMeleeHit;
            expect(result.unfilteredExtraProcsPerShot.magnetic).toBeCloseTo(
                expectedImpactApplicationsPerHit * effect.impactStatusAppliesMagneticChance,
                8,
            );
        }
    });

    it("applies Immunity Resistance to Slash DoT without changing direct hit damage", () => {
        const claw = getWeaponCatalog().find((weapon) => weapon.name === "Chesa Claws");
        expect(claw).toBeDefined();
        const immunityResistance = getModsForWeapon(claw!).find((candidate) => candidate.name === "Immunity Resistance");
        expect(immunityResistance).toBeDefined();
        expect(immunityResistance!.effectsByRank.map((effect) => effect.statusDamageBonus))
            .toEqual([0.125, 0.25, 0.375, 0.5]);

        const slashWeapon = { ...makeWeapon({ slash: 100 }), critChance: 0, critMultiplier: 2 };
        const baseline = calculateBuild(slashWeapon, []).modded;
        for (let rank = 0; rank <= immunityResistance!.fusionLimit; rank++) {
            const effect = immunityResistance!.effectsByRank[rank];
            expect(immunityResistance!.unparsedStatsByRank?.[rank]).toEqual([]);
            expect(getUnmodeledDamageEffectLines(immunityResistance!, rank)).toEqual([]);

            const result = calculateBuild(slashWeapon, [effect]).modded;
            expect(result.averageShotDamage).toBeCloseTo(baseline.averageShotDamage, 8);
            expect(result.dotTickDamagePerProcByType.slash).toBeCloseTo(
                baseline.dotTickDamagePerProcByType.slash! * (1 + effect.statusDamageBonus),
                8,
            );
        }
    });
});

describe("Spring-Loaded Broadhead Wiki modeling", () => {
    it("parses every rank and remains compatible with Daikyu and Daikyu Prime", () => {
        const daikyu = getWeaponCatalog().find((candidate) => candidate.name === "Daikyu");
        const daikyuPrime = getWeaponCatalog().find((candidate) => candidate.name === "Daikyu Prime");
        const bratonPrime = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime");
        expect(daikyu).toBeDefined();
        expect(daikyuPrime).toBeDefined();
        expect(bratonPrime).toBeDefined();

        const mod = getModsForWeapon(daikyu!).find((candidate) => candidate.name === "Spring-Loaded Broadhead");
        const primeMod = getModsForWeapon(daikyuPrime!).find((candidate) => candidate.name === "Spring-Loaded Broadhead");
        expect(mod).toBeDefined();
        expect(primeMod).toBeDefined();
        expect(getModsForWeapon(bratonPrime!).some((candidate) => candidate.name === "Spring-Loaded Broadhead")).toBe(false);
        expect(mod!.effectsByRank.map((effect) => effect.springLoadedBroadheadDamageBonus)).toEqual([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]);
        expect(mod!.effectsByRank.map((effect) => effect.springLoadedBroadheadMinDistanceMeters)).toEqual([45, 39, 33, 27, 21, 15]);
        expect(mod!.effectsByRank.map((effect) => effect.damageBonus)).toEqual([0, 0, 0, 0, 0, 0]);
        expect(mod!.statsTextByRank[0]).toContain("over 45m away");
        expect(mod!.statsTextByRank[5]).toContain("over 15m away");
        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
        }
    });

    it("activates strictly beyond the rank threshold and adds one projectile share to direct and DoT damage", () => {
        const weapon = { ...makeWeapon({ slash: 100 }), multishot: 2 };
        const daikyu = getWeaponCatalog().find((candidate) => candidate.name === "Daikyu");
        const mod = getModsForWeapon(daikyu!).find((candidate) => candidate.name === "Spring-Loaded Broadhead")!;
        const rankFive = mod.effectsByRank[5]!;
        const baseline = calculateBuild(weapon, []).modded;
        const atThreshold = calculateBuild(weapon, [rankFive], "", {
            conditionalState: { mode: "realistic", targetDistanceMeters: 15 },
        }).modded;
        const beyondThreshold = calculateBuild(weapon, [rankFive], "", {
            conditionalState: { mode: "realistic", targetDistanceMeters: 15.001 },
        }).modded;

        expect(atThreshold.singleProjectileDamageBonus).toBe(0);
        expect(beyondThreshold.singleProjectileDamageBonus).toBe(0.4);
        expect(atThreshold.averageShotDamage).toBeCloseTo(baseline.averageShotDamage, 10);
        expect(beyondThreshold.averageShotDamage - baseline.averageShotDamage).toBeCloseTo(40, 8);
        expect(beyondThreshold.damageBreakdown).toEqual(baseline.damageBreakdown);
        expect(beyondThreshold.statusChance).toBe(baseline.statusChance);
        expect(beyondThreshold.procChanceByType).toEqual(baseline.procChanceByType);
        expect(beyondThreshold.dotDamagePerApplicationSeedByType.slash).toBeCloseTo(
            (baseline.dotDamagePerApplicationSeedByType.slash ?? 0) * 1.2,
            8,
        );
        // The Wiki's per-application +1 tick accumulator is additive, not part of the weapon seed.
        expect(beyondThreshold.dotDamagePerShotByType.slash).toBeLessThan(
            (baseline.dotDamagePerShotByType.slash ?? 0) * 1.2,
        );
    });
});

describe("Range Advantage Wiki modeling", () => {
    it("parses all six Wiki ranks for Akjagara variants", () => {
        const catalog = getWeaponCatalog();
        const akjagara = catalog.find((candidate) => candidate.name === "Akjagara");
        const akjagaraPrime = catalog.find((candidate) => candidate.name === "Akjagara Prime");
        expect(akjagara).toBeDefined();
        expect(akjagaraPrime).toBeDefined();

        const expectedBonuses = [0.5, 1, 1.5, 2, 2.5, 3];
        for (const weapon of [akjagara!, akjagaraPrime!]) {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Range Advantage");
            expect(mod).toBeDefined();
            expect(mod!.effectsByRank.map((effect) => effect.conditionalEffects?.[0])).toEqual(
                expectedBonuses.map((damageBonus) => ({
                    trigger: "whileNoEnemyWithinRange",
                    durationSeconds: 0,
                    minimumTargetDistanceMeters: 10,
                    requiresAiming: false,
                    maxStacks: 1,
                    stats: { damageBonus },
                })),
            );
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
            }
        }
    });

    it("activates only beyond 10m and applies the additive bonus in Initial state", () => {
        const akjagara = getWeaponCatalog().find((candidate) => candidate.name === "Akjagara");
        expect(akjagara).toBeDefined();
        const mod = getModsForWeapon(akjagara!).find((candidate) => candidate.name === "Range Advantage")!;
        const weapon = makeWeapon({ impact: 100 });
        const rankFive = mod.effectsByRank[5];
        const baseline = calculateBuild(weapon, []).modded;
        const unset = calculateBuild(weapon, [rankFive], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const atThreshold = calculateBuild(weapon, [rankFive], "", {
            conditionalState: { mode: "initial", targetDistanceMeters: 10 },
        }).modded;
        const beyondThreshold = calculateBuild(weapon, [rankFive], "", {
            conditionalState: { mode: "initial", targetDistanceMeters: 10.001 },
        }).modded;

        expect(unset.averageShotDamage).toBeCloseTo(baseline.averageShotDamage, 10);
        expect(atThreshold.averageShotDamage).toBeCloseTo(baseline.averageShotDamage, 10);
        expect(beyondThreshold.averageShotDamage - baseline.averageShotDamage).toBeCloseTo(300, 8);
    });
});

describe("source-backed weapon attack falloff", () => {
    const catalog = getWeaponCatalog();
    const archwingMausolon = catalog.find((candidate) => candidate.name === "Mausolon" && candidate.variantLabel === "Archwing");
    const atmosphereMausolon = catalog.find((candidate) => candidate.name === "Mausolon" && candidate.variantLabel === "Atmosphere");

    it("keeps the Wiki falloff profiles distinct by attack and equipment mode", () => {
        expect(archwingMausolon).toBeDefined();
        expect(atmosphereMausolon).toBeDefined();
        expect(archwingMausolon!.attacks.find((attack) => attack.name === "Auto")?.damageFalloff).toMatchObject({
            startDistanceMeters: 1400,
            endDistanceMeters: 2800,
            minimumDamageMultiplier: 0,
            scaleBy: ["weaponRange", "projectileSpeed"],
        });
        expect(atmosphereMausolon!.attacks.find((attack) => attack.name === "Auto")?.damageFalloff).toBeUndefined();
        expect(archwingMausolon!.attacks.find((attack) => attack.name === "Auto")?.maximumRangeMeters).toBe(300);
        expect(atmosphereMausolon!.attacks.find((attack) => attack.name === "Auto")?.maximumRangeMeters).toBe(300);
        expect(archwingMausolon!.attacks.find((attack) => attack.name === "Auto")?.maximumRangeBehavior).toBe("informational");
        expect(atmosphereMausolon!.attacks.find((attack) => attack.name === "Auto")?.maximumRangeBehavior).toBe("hardHitCap");
        expect(archwingMausolon!.attacks.find((attack) => attack.name === "Charged Shot Laser")?.maximumRangeBehavior).toBe("hardHitCap");
        expect(atmosphereMausolon!.attacks.find((attack) => attack.name === "Charged Shot Laser")?.maximumRangeBehavior).toBe("hardHitCap");
        expect(archwingMausolon!.attacks.find((attack) => attack.name === "Auto Radial Attack")?.damageFalloff?.minimumDamageMultiplier).toBe(0.9);
        expect(atmosphereMausolon!.attacks.find((attack) => attack.name === "Auto Radial Attack")?.damageFalloff?.minimumDamageMultiplier).toBe(0.8);
        expect(archwingMausolon!.attacks.find((attack) => attack.name === "Charged Shot Explosion")?.damageFalloff?.minimumDamageMultiplier).toBe(0.6);
        expect(atmosphereMausolon!.attacks.find((attack) => attack.name === "Charged Shot Explosion")?.damageFalloff).toBeUndefined();
    });

    it("models Quellor Alt-Fire linear falloff and Projectile Speed scaling", () => {
        const quellor = catalog.find((candidate) => candidate.name === "Quellor");
        expect(quellor).toBeDefined();
        const altFireIndex = quellor!.attacks.findIndex((attack) => attack.name === "Alt-Fire");
        expect(altFireIndex).toBeGreaterThanOrEqual(0);
        const attack = quellor!.attacks[altFireIndex]!;
        expect(attack.damageFalloff).toMatchObject({
            startDistanceMeters: 9,
            endDistanceMeters: 18,
            minimumDamageMultiplier: 0.3343,
            scaleBy: ["projectileSpeed"],
            sourceUrl: "https://wiki.warframe.com/w/Quellor",
        });
        expect(attack.scoreBoundaryNote?.reason).toContain("100%→33.43% linear falloff");

        const selected = withSelectedAttack(quellor!, altFireIndex);
        const midpoint = calculateBuild(selected, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 13.5 },
        }).modded;
        expect(midpoint.attackDamageFalloff?.damageMultiplier).toBeCloseTo(0.66715, 8);

        const fasterProjectile = calculateBuild(selected, [{ ...emptyEffect(), projectileSpeedBonus: 1 }], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 13.5 },
        }).modded;
        expect(fasterProjectile.attackDamageFalloff?.startDistanceMeters).toBeCloseTo(18, 8);
        expect(fasterProjectile.attackDamageFalloff?.endDistanceMeters).toBeCloseTo(36, 8);
        expect(fasterProjectile.attackDamageFalloff?.damageMultiplier).toBe(1);
    });

    it("applies Larkspur beam ramps and only enforces the unambiguous Atmosphere range", () => {
        const larkspurProfiles = catalog.filter((weapon) => weapon.name === "Larkspur" || weapon.name === "Larkspur Prime");
        expect(larkspurProfiles).toHaveLength(4);

        for (const weapon of larkspurProfiles) {
            const beamIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
            const attackRow = weapon.attacks[beamIndex]!;
            const beam = withSelectedAttack(weapon, beamIndex);
            const baseline = calculateBuild(beam, []).modded;
            const isAtmosphere = weapon.variantLabel === "Atmosphere";
            const expectedRange = weapon.name === "Larkspur Prime"
                ? isAtmosphere ? 50 : 180
                : isAtmosphere ? 40 : 160;
            const expectedBehavior = weapon.name === "Larkspur" && isAtmosphere
                ? "hardHitCap"
                : "informational";
            expect(attackRow.maximumRangeMeters).toBe(expectedRange);
            expect(attackRow.maximumRangeBehavior).toBe(expectedBehavior);
            expect(beam.selectedAttackDamageRamp).toEqual({
                minimumDamageMultiplier: 0.2,
                rampToFullSeconds: 0.6,
                idleBeforeDecaySeconds: 0.8,
                decayToMinimumSeconds: 2,
            });
            expect(baseline.firstAttackDamageMultiplier).toBe(0.2);

            const atListedRange = calculateBuild(beam, [], "", {
                conditionalState: {
                    mode: "initial",
                    attackFalloffDistanceMeters: expectedRange,
                },
            }).modded;
            expect(atListedRange.attackDamageFalloff?.isOutOfRangeMiss).toBe(false);

            const beyondListedRange = calculateBuild(beam, [], "", {
                conditionalState: {
                    mode: "initial",
                    attackFalloffDistanceMeters: expectedRange + 1,
                },
            }).modded;
            expect(beyondListedRange.attackDamageFalloff?.exceedsListedMaximumRange).toBe(true);
            if (expectedBehavior === "hardHitCap") {
                expect(beyondListedRange.attackDamageFalloff?.isOutOfRangeMiss).toBe(true);
                expect(beyondListedRange.attackDamageFalloff?.damageMultiplier).toBe(0);
                expect(beyondListedRange.totalDamage).toBe(0);
                expect(beyondListedRange.averageProcsPerShot).toBe(0);
            } else {
                expect(beyondListedRange.attackDamageFalloff?.isOutOfRangeMiss).toBe(false);
                expect(beyondListedRange.attackDamageFalloff?.damageMultiplier).toBe(1);
                expect(beyondListedRange.totalDamage).toBeCloseTo(baseline.totalDamage, 8);
            }

            const explosionIndex = weapon.attacks.findIndex((attack) => attack.name === "Explosion");
            const explosion = withSelectedAttack(weapon, explosionIndex);
            const fullDamage = calculateBuild(explosion, []).modded.totalDamage;
            const midpointDamage = calculateBuild(explosion, [], "", {
                conditionalState: { mode: "initial", attackFalloffDistanceMeters: 4.8 },
            }).modded.totalDamage;
            expect(midpointDamage).toBeCloseTo(fullDamage * 0.7, 8);
        }
    });

    it("applies linear falloff and Ballista Measure's rank-specific Range bonus", () => {
        const archwing = archwingMausolon!;
        const autoIndex = archwing.attacks.findIndex((attack) => attack.name === "Auto");
        const auto = withSelectedAttack(archwing, autoIndex);
        const fullDamage = calculateBuild(auto, []).modded.totalDamage;
        const baseline = calculateBuild(auto, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 2100 },
        }).modded;
        expect(baseline.attackDamageFalloff?.damageMultiplier).toBeCloseTo(0.5, 10);
        expect(baseline.totalDamage).toBeCloseTo(fullDamage * 0.5, 6);

        const ballistaMeasure = getModsForWeapon(archwing).find((mod) => mod.name === "Ballista Measure");
        expect(ballistaMeasure).toBeDefined();
        expect(ballistaMeasure!.effectsByRank.map((effect) => effect.rangeBonus)).toEqual([0.05, 0.1, 0.15, 0.2]);
        const maxRank = calculateBuild(auto, [ballistaMeasure!.effectsByRank[3]], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 2100 },
        }).modded;
        expect(maxRank.attackDamageFalloff?.startDistanceMeters).toBeCloseTo(1680, 8);
        expect(maxRank.attackDamageFalloff?.endDistanceMeters).toBeCloseTo(3360, 8);
        expect(maxRank.attackDamageFalloff?.damageMultiplier).toBeCloseTo(0.75, 10);
        expect(maxRank.totalDamage).toBeCloseTo(fullDamage * 0.75, 6);
    });

    it("enforces the unconflicted Atmosphere hit cap and keeps Archwing Auto's conflict explicit", () => {
        const archwing = archwingMausolon!;
        const auto = withSelectedAttack(archwing, archwing.attacks.findIndex((attack) => attack.name === "Auto"));
        const linked = calculateBuild(auto, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 2800 },
        }).modded;
        expect(linked.attackDamageFalloff?.damageMultiplier).toBe(0);
        expect(linked.attackDamageFalloff?.exceedsListedMaximumRange).toBe(true);
        expect(linked.attackDamageFalloff?.isOutOfRangeMiss).toBe(false);
        expect(linked.attachedAttackDamageSequence?.profile.attackDamageFalloff?.distanceMeters).toBe(0);
        expect(linked.attachedAttackDamageSequence?.profile.attackDamageFalloff?.damageMultiplier).toBe(1);
        expect(linked.attachedAttackDamageSequence?.profile.damageByType.heat).toBeCloseTo(48, 8);

        const atmosphereAuto = withSelectedAttack(
            atmosphereMausolon!,
            atmosphereMausolon!.attacks.findIndex((attack) => attack.name === "Auto"),
        );
        const archwingInRange = calculateBuild(auto, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 250 },
        }).modded;
        const archwingBeyondListedRange = calculateBuild(auto, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 301 },
        }).modded;
        expect(archwingInRange.attackDamageFalloff?.damageMultiplier).toBe(1);
        expect(archwingInRange.attackDamageFalloff?.exceedsListedMaximumRange).toBe(false);
        expect(archwingBeyondListedRange.attackDamageFalloff?.damageMultiplier).toBe(1);
        expect(archwingBeyondListedRange.attackDamageFalloff?.exceedsListedMaximumRange).toBe(true);
        expect(archwingBeyondListedRange.totalDamage).toBeCloseTo(archwingInRange.totalDamage, 8);

        const atmosphereInRange = calculateBuild(atmosphereAuto, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 300 },
        }).modded;
        const atmosphereBeyondRange = calculateBuild(atmosphereAuto, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 300.1 },
        }).modded;
        expect(atmosphereInRange.attackDamageFalloff?.damageMultiplier).toBe(1);
        expect(atmosphereInRange.attackDamageFalloff?.isOutOfRangeMiss).toBe(false);
        expect(atmosphereBeyondRange.attackDamageFalloff?.damageMultiplier).toBe(0);
        expect(atmosphereBeyondRange.attackDamageFalloff?.isOutOfRangeMiss).toBe(true);
        expect(atmosphereBeyondRange.totalDamage).toBe(0);
        expect(atmosphereBeyondRange.averageProcsPerShot).toBe(0);
        expect(atmosphereBeyondRange.forcedProcsPerShot.impact).toBeUndefined();
        expect(atmosphereBeyondRange.attachedAttackDamageSequence).toBeUndefined();
        const atmosphere = calculateBuild(atmosphereAuto, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 300.1 },
        }).modded;
        expect(atmosphere.attackDamageFalloff?.damageMultiplier).toBe(0);
        expect(atmosphere.attackDamageFalloff?.exceedsListedMaximumRange).toBe(true);
        expect(atmosphere.attackDamageFalloff?.isOutOfRangeMiss).toBe(true);
        expect(atmosphere.attachedAttackDamageSequence).toBeUndefined();

        const atmosphericRadial = withSelectedAttack(
            atmosphereMausolon!,
            atmosphereMausolon!.attacks.findIndex((attack) => attack.name === "Auto Radial Attack"),
        );
        const radial = calculateBuild(atmosphericRadial, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 0.9 },
        }).modded;
        expect(radial.attackDamageFalloff?.damageMultiplier).toBeCloseTo(0.9, 10);
    });

    it("scales shotgun falloff with Projectile Speed and carries distance into finite encounter scoring", () => {
        const vaykorHek = catalog.find((candidate) => candidate.name === "Vaykor Hek");
        expect(vaykorHek).toBeDefined();
        const selected = withSelectedAttack(vaykorHek!, 0);
        const inRange = calculateBuild(selected, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 9.9 },
        }).modded;
        const midFalloff = calculateBuild(selected, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 17.5 },
        }).modded;
        expect(inRange.attackDamageFalloff?.damageMultiplier).toBe(1);
        expect(midFalloff.attackDamageFalloff?.damageMultiplier).toBeCloseTo(0.63333333335, 10);

        const fasterProjectile = calculateBuild(selected, [{
            ...emptyEffect(),
            projectileSpeedBonus: 0.5,
        }], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 17.5 },
        }).modded;
        expect(fasterProjectile.attackDamageFalloff?.startDistanceMeters).toBeCloseTo(15, 10);
        expect(fasterProjectile.attackDamageFalloff?.endDistanceMeters).toBeCloseTo(37.5, 10);
        expect(fasterProjectile.attackDamageFalloff?.damageMultiplier).toBeCloseTo(0.9185185185, 9);

        const finite = calculateBuildForExpectedEncounter(selected, [], "", {
            conditionalState: { mode: "initial", attackFalloffDistanceMeters: 25 },
        }).modded;
        expect(finite.attackDamageFalloff?.damageMultiplier).toBeCloseTo(0.2666666667, 10);
        expect(finite.totalDamage).toBeCloseTo(midFalloff.totalDamage * 0.2666666667 / 0.63333333335, 6);
    });

    it("keeps conditional-mod distance separate from attack falloff distance", () => {
        const archwing = withSelectedAttack(
            archwingMausolon!,
            archwingMausolon!.attacks.findIndex((attack) => attack.name === "Auto"),
        );
        const result = calculateBuild(archwing, [], "", {
            conditionalState: { mode: "initial", targetDistanceMeters: 2100 },
        }).modded;
        expect(result.attackDamageFalloff?.distanceMeters).toBeNull();
        expect(result.attackDamageFalloff?.damageMultiplier).toBe(1);
    });
});

describe("source-backed Arch-Gun charge-rate mechanics", () => {
    const catalog = getWeaponCatalog();

    it("applies Shell Rush to charged Larkspur modes without changing uncharged cadence", () => {
        const larkspur = catalog.find((weapon) => weapon.name === "Larkspur");
        expect(larkspur).toBeDefined();
        const shellRush = getModsForWeapon(larkspur!).find((mod) => mod.name === "Shell Rush");
        expect(shellRush).toBeDefined();
        const shellRushEffect = shellRush!.effectsByRank[shellRush!.fusionLimit]!;

        for (const attackName of ["Alt-Fire Projectile Impact", "Explosion"]) {
            const selected = withSelectedAttack(larkspur!, larkspur!.attacks.findIndex((attack) => attack.name === attackName));
            const baseline = calculateBuild(selected, []).modded;
            const modded = calculateBuild(selected, [shellRushEffect]).modded;
            expect(selected.trigger).toBe("Charge");
            expect(selected.chargeTime).toBe(0.5);
            expect(baseline.initialAttackDelaySeconds).toBeCloseTo(0.5, 8);
            expect(modded.initialAttackDelaySeconds).toBeCloseTo(0.5 / 1.5, 8);
            expect(baseline.fireRate).toBeCloseTo(1 / (0.5 + 1 / selected.fireRate), 8);
            expect(modded.fireRate).toBeCloseTo(1 / (0.5 / 1.5 + 1 / selected.fireRate), 8);
        }

        const impactIndex = larkspur!.attacks.findIndex((attack) => attack.name === "Alt-Fire Projectile Impact");
        const explosionIndex = larkspur!.attacks.findIndex((attack) => attack.name === "Explosion");
        const impactSequence = calculateBuild(withSelectedAttack(larkspur!, impactIndex), [shellRushEffect]).modded.attachedAttackDamageSequence;
        const explosionStats = calculateBuild(withSelectedAttack(larkspur!, explosionIndex), [shellRushEffect]).modded;
        expect(impactSequence?.rule.componentAttackName).toBe("Explosion");
        expect(impactSequence?.profile.baseDamageTotal).toBeCloseTo(explosionStats.baseDamageTotal, 8);
        expect(withSelectedAttack(larkspur!, explosionIndex).selectedAttackModelLimitation?.reason)
            .toContain("Select Alt-Fire Projectile Impact");

        const unchargedIndex = larkspur!.attacks.findIndex((attack) => attack.trigger !== "Charge");
        expect(unchargedIndex).toBeGreaterThanOrEqual(0);
        const uncharged = withSelectedAttack(larkspur!, unchargedIndex);
        expect(calculateBuild(uncharged, [shellRushEffect]).modded.fireRate).toBeCloseTo(
            calculateBuild(uncharged, []).modded.fireRate,
            10,
        );
    });

    it("applies Shell Rush to both Mausolon charged profiles and not either Auto profile", () => {
        const mausolons = catalog.filter((weapon) => weapon.name === "Mausolon");
        const shellRush = getModsForWeapon(mausolons[0]!).find((mod) => mod.name === "Shell Rush");
        expect(shellRush).toBeDefined();
        const shellRushEffect = shellRush!.effectsByRank[shellRush!.fusionLimit]!;

        for (const weapon of mausolons) {
            for (const name of ["Charged Shot Laser", "Charged Shot Explosion"]) {
                const selected = withSelectedAttack(weapon, weapon.attacks.findIndex((attack) => attack.name === name));
                expect(selected.trigger).toBe("Charge");
                expect(selected.chargeTime).toBe(0.8);
                expect(calculateBuild(selected, []).modded.initialAttackDelaySeconds).toBeCloseTo(0.8, 8);
                expect(calculateBuild(selected, [shellRushEffect]).modded.initialAttackDelaySeconds).toBeCloseTo(0.8 / 1.5, 8);
                expect(calculateBuild(selected, [shellRushEffect]).modded.fireRate).toBeCloseTo(
                    1 / (0.8 / 1.5 + 1 / selected.fireRate),
                    8,
                );
            }
            const laserIndex = weapon.attacks.findIndex((attack) => attack.name === "Charged Shot Laser");
            const explosionIndex = weapon.attacks.findIndex((attack) => attack.name === "Charged Shot Explosion");
            const laserSequence = calculateBuild(withSelectedAttack(weapon, laserIndex), [shellRushEffect]).modded.attachedAttackDamageSequence;
            const explosionStats = calculateBuild(withSelectedAttack(weapon, explosionIndex), [shellRushEffect]).modded;
            expect(laserSequence?.rule.componentAttackName).toBe("Charged Shot Explosion");
            expect(laserSequence?.profile.baseDamageTotal).toBeCloseTo(explosionStats.baseDamageTotal, 8);
            expect(withSelectedAttack(weapon, explosionIndex).selectedAttackModelLimitation?.reason)
                .toContain("Select Charged Shot Laser");
            const auto = withSelectedAttack(weapon, weapon.attacks.findIndex((attack) => attack.name === "Auto"));
            expect(calculateBuild(auto, [shellRushEffect]).modded.fireRate).toBeCloseTo(
                calculateBuild(auto, []).modded.fireRate,
                10,
            );
        }
    });
});

describe("source-backed per-attack Auto-Charge profiles", () => {
    const catalog = getWeaponCatalog();

    it("uses each charged attack's trigger, ammo cost, and modded charge cycle", () => {
        const cases = [
            ["Aeolak", "Alt-Fire", 0.3, 10, false],
            ["Aeolak", "Alt-Fire Explosion", 0.3, 10, false],
            ["Quellor", "Alt-Fire", 1.2, 50, true],
            ["Stahlta", "Alt-Fire", 1.6, 20, true],
            ["Stahlta", "Alt-Fire AoE", 1.6, 20, true],
            ["Tenora", "Charged Attack", 0.8, 10, true],
            ["Tenora Prime", "Charged Attack", 0.8, 10, true],
        ] as const;
        const fireRateEffect = { ...emptyEffect(), fireRateBonus: 1 };

        for (const [weaponName, attackName, chargeTime, ammoCost, chargeScalesWithFireRate] of cases) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
            expect(attackIndex, `${weaponName} ${attackName}`).toBeGreaterThanOrEqual(0);
            const attack = weapon!.attacks[attackIndex]!;
            expect(attack.trigger, `${weaponName} ${attackName}`).toBe("Charge");
            expect(attack.chargeTime, `${weaponName} ${attackName}`).toBeCloseTo(chargeTime, 8);
            expect(attack.ammoCostPerShot, `${weaponName} ${attackName}`).toBe(ammoCost);

            const selected = withSelectedAttack(weapon!, attackIndex);
            const baseline = calculateBuild(selected, []).modded;
            const modded = calculateBuild(selected, [fireRateEffect]).modded;
            const expectedModdedChargeTime = chargeScalesWithFireRate ? chargeTime / 2 : chargeTime;
            expect(baseline.initialAttackDelaySeconds, `${weaponName} ${attackName}`).toBeCloseTo(chargeTime, 8);
            expect(modded.initialAttackDelaySeconds, `${weaponName} ${attackName}`)
                .toBeCloseTo(expectedModdedChargeTime, 8);
            expect(modded.fireRate, `${weaponName} ${attackName}`).toBeCloseTo(
                1 / (expectedModdedChargeTime + 1 / (selected.fireRate * 2)),
                8,
            );
        }
    });

    it("scores Aeolak and Stahlta single-target impact-plus-explosion sequences", () => {
        const sequenceCases = [
            ["Aeolak", "Alt-Fire", "Alt-Fire Explosion", 0],
            ["Stahlta", "Alt-Fire", "Alt-Fire AoE", 0.36],
        ] as const;

        for (const [weaponName, directName, componentName, delay] of sequenceCases) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName)!;
            const directIndex = weapon.attacks.findIndex((attack) => attack.name === directName);
            const componentIndex = weapon.attacks.findIndex((attack) => attack.name === componentName);
            const directStats = calculateBuild(withSelectedAttack(weapon, directIndex), []).modded;
            expect(directStats.attachedAttackDamageSequence?.rule.componentAttackName).toBe(componentName);
            expect(directStats.attachedAttackDamageSequence?.rule.firstTickDelaySeconds).toBe(delay);
            expect(directStats.attachedAttackDamageSequence?.rule.attachedToDirectTarget).toBe(true);
            expect(weapon.attacks[directIndex]?.scoreBoundaryNote?.reason).toMatch(/other enemies/i);
            expect(withSelectedAttack(weapon, componentIndex).selectedAttackModelLimitation?.reason)
                .toContain(`Select ${directName}`);
        }
    });
});

describe("Cull the Weak Wiki modeling", () => {
    it("parses every rank and applies the bonus only to non-critical hits", () => {
        const chesaClaws = getWeaponCatalog().find((candidate) => candidate.name === "Chesa Claws");
        expect(chesaClaws).toBeDefined();

        const mod = getModsForWeapon(chesaClaws!).find((candidate) => candidate.name.toLowerCase() === "cull the weak");
        expect(mod).toBeDefined();
        expect(mod!.effectsByRank.map((effect) => effect.nonCriticalHitDamageProcs)).toEqual(
            [0.4, 0.8, 1.2, 1.6, 2, 2.4].map((damageBonus) => [{ chance: 1, damageBonus }]),
        );
        expect(mod!.effectsByRank.map((effect) => effect.conditionOverloadDamagePerStatusBonus)).toEqual(
            [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        );
        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
        }

        const maxRankEffect = {
            ...mod!.effectsByRank[mod!.fusionLimit],
            conditionOverloadDamagePerStatusBonus: 0,
        };
        const halfCriticalWeapon = { ...makeWeapon({ impact: 100 }), critChance: 0.5 };
        const halfCriticalBaseline = calculateBuild(halfCriticalWeapon, []).modded;
        const halfCriticalStats = calculateBuild(halfCriticalWeapon, [maxRankEffect]).modded;
        expect(halfCriticalStats.averageShotDamage - halfCriticalBaseline.averageShotDamage).toBeCloseTo(
            halfCriticalStats.totalDamage * halfCriticalStats.damageWeightedMultishot *
                (1 - halfCriticalStats.critChance) * 2.4,
            8,
        );

        const alwaysCriticalWeapon = { ...makeWeapon({ impact: 100 }), critChance: 1.5 };
        const alwaysCriticalBaseline = calculateBuild(alwaysCriticalWeapon, []).modded;
        const alwaysCriticalStats = calculateBuild(alwaysCriticalWeapon, [maxRankEffect]).modded;
        expect(alwaysCriticalStats.averageShotDamage).toBeCloseTo(alwaysCriticalBaseline.averageShotDamage, 8);
    });
});

describe("Volatile Variant Wiki modeling", () => {
    it("applies the rank-scaled Status Chance only to Sporothrix explosion attacks", () => {
        const expectedBonuses = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
        for (const weaponName of ["Sporothrix", "Coda Sporothrix"]) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === weaponName);
            expect(weapon).toBeDefined();
            const mod = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Volatile Variant");
            expect(mod).toBeDefined();

            expect(mod!.effectsByRank.map((effect) => effect.areaDamageStatusChanceBonus)).toEqual(expectedBonuses);
            expect(mod!.effectsByRank.map((effect) => effect.statusChanceBonus)).toEqual([0, 0, 0, 0, 0, 0]);
            for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
                const unmodeled = getUnmodeledDamageEffectLines(mod!, rank);
                expect(unmodeled).toContain(
                    "Punch Through, instant direct-hit barb-explosion timing, and its added radius are not modeled; the rank-specific Status Chance bonus applies only to a selected AoE attack.",
                );
                expect(unmodeled.some((line) => /\+\d+% Status Chance/.test(line))).toBe(false);
            }

            const directAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
            const areaAttackIndex = weapon!.attacks.findIndex((attack) => attack.isAreaDamage === true);
            expect(directAttackIndex).toBeGreaterThanOrEqual(0);
            expect(areaAttackIndex).toBeGreaterThanOrEqual(0);
            const directWeapon = withSelectedAttack(weapon!, directAttackIndex);
            const areaWeapon = withSelectedAttack(weapon!, areaAttackIndex);
            const maxRankEffect = mod!.effectsByRank[mod!.fusionLimit];

            const directBaseline = calculateBuild(directWeapon, []).modded;
            const directModded = calculateBuild(directWeapon, [maxRankEffect]).modded;
            expect(directModded.statusChance).toBeCloseTo(directBaseline.statusChance, 12);

            const areaBaseline = calculateBuild(areaWeapon, []).modded;
            const areaModded = calculateBuild(areaWeapon, [maxRankEffect]).modded;
            expect(areaModded.statusChance).toBeCloseTo(areaWeapon.statusChance * 1.5, 10);
            expect(areaModded.averageProcsPerShot).toBeGreaterThan(areaBaseline.averageProcsPerShot);
        }
    });
});

describe("Motus Setup Wiki modeling", () => {
    it("parses all four jump-landing ranks and uses no inferred Realistic uptime", () => {
        const shotgun = getWeaponCatalog().find((candidate) => candidate.modCompat === "Shotgun");
        expect(shotgun).toBeDefined();
        const mod = getModsForWeapon(shotgun!).find((candidate) => candidate.name === "Motus Setup");
        expect(mod).toBeDefined();
        const expectedBonuses = [0.25, 0.5, 0.75, 1];
        expect(mod!.fusionLimit).toBe(3);
        expect(mod!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.trigger))
            .toEqual(Array(4).fill("afterJumpLanding"));
        expect(mod!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.durationSeconds))
            .toEqual([1, 2, 3, 4]);
        expect(mod!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.stats))
            .toEqual(expectedBonuses.map((bonus) => ({ critChanceBonus: bonus, statusChanceBonus: bonus })));

        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(mod!.unparsedStatsByRank?.[rank] ?? []).toEqual([]);
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
        }

        const weapon = { ...makeWeapon({ impact: 100 }), critChance: 0.2, statusChance: 0.3 };
        const maxRankEffect = mod!.effectsByRank[mod!.fusionLimit];
        const initial = calculateBuild(weapon, [maxRankEffect], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const realistic = calculateBuild(weapon, [maxRankEffect], "", {
            conditionalState: { mode: "realistic" },
        }).modded;
        const fullyStacked = calculateBuild(weapon, [maxRankEffect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;
        const customInactive = calculateBuild(weapon, [maxRankEffect], "", {
            conditionalState: { mode: "custom", externalStacks: 0 },
        }).modded;
        const customActive = calculateBuild(weapon, [maxRankEffect], "", {
            conditionalState: { mode: "custom", externalStacks: 1 },
        }).modded;

        for (const inactive of [initial, realistic, customInactive]) {
            expect(inactive.critChance).toBeCloseTo(0.2, 12);
            expect(inactive.statusChance).toBeCloseTo(0.3, 12);
        }
        for (const active of [fullyStacked, customActive]) {
            expect(active.critChance).toBeCloseTo(0.4, 12);
            expect(active.statusChance).toBeCloseTo(0.6, 12);
        }
    });
});

describe("damage calculation status eligibility", () => {
    it("models Enduring Affliction as additive Status Chance only for an explicitly Lifted target", () => {
        const gramPrime = getWeaponCatalog().find((candidate) => candidate.name === "Gram Prime");
        expect(gramPrime).toBeDefined();
        const mod = getModsForWeapon(gramPrime!).find((candidate) => candidate.name === "Enduring Affliction");
        expect(mod).toBeDefined();
        expect(mod!.hasDamageEffect).toBe(true);
        expect(mod!.effectsByRank.map((effect) =>
            Number((effect.conditionalEffects[0]?.stats.statusChanceBonus ?? 0).toFixed(3)),
        )).toEqual([0.167, 0.333, 0.5, 0.667, 0.833, 1]);
        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
            expect(mod!.effectsByRank[rank].conditionalEffects[0]).toEqual(expect.objectContaining({
                trigger: "whileTargetHasStatus",
                requiredTargetStatusType: "lifted",
            }));
        }

        const weapon = {
            ...makeWeapon({ impact: 100 }),
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee" as const,
        };
        const statusChanceMod = { ...emptyEffect(), statusChanceBonus: 0.5 };
        const rankFive = mod!.effectsByRank[mod!.fusionLimit];
        const statusChance = (conditionalState: ConditionalState) =>
            calculateBuild(weapon, [statusChanceMod, rankFive], "", { conditionalState }).modded.statusChance;

        expect(statusChance({ mode: "initial" })).toBeCloseTo(0.6, 12);
        expect(statusChance({ mode: "initial", externalStatusTypes: ["lifted"] })).toBeCloseTo(1, 12);
        expect(statusChance({ mode: "initial", externalStatusTypes: ["lifted", "knockdown"] })).toBeCloseTo(0.6, 12);
        expect(statusChance({ mode: "fullyStacked" })).toBeCloseTo(0.6, 12);
        expect(statusChance({ mode: "fullyStacked", externalStatusTypes: ["lifted"] })).toBeCloseTo(1, 12);
        expect(statusChance({ mode: "realistic", externalStatusTypes: ["lifted"] })).toBeCloseTo(1, 12);
        expect(statusChance({ mode: "custom", externalStacks: 0, externalStatusTypes: ["lifted"] })).toBeCloseTo(1, 12);
    });

    it("models Seismic Wave on aerial and stance-combo slam attacks", () => {
        const gramPrime = getWeaponCatalog().find((candidate) => candidate.name === "Gram Prime");
        expect(gramPrime).toBeDefined();
        const seismicWave = getModsForWeapon(gramPrime!).find((mod) => mod.name === "Seismic Wave");
        expect(seismicWave).toBeDefined();
        expect(seismicWave!.hasDamageEffect).toBe(true);
        expect(seismicWave!.effectsByRank.map((effect) => effect.slamAttackDamageBonus))
            .toEqual([0.5, 1, 1.5, 2]);
        for (let rank = 0; rank <= seismicWave!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(seismicWave!, rank)).toEqual([]);
        }

        const selected = (name: string) => {
            const index = gramPrime!.attacks.findIndex((attack) => attack.name === name);
            expect(index, name).toBeGreaterThanOrEqual(0);
            return withSelectedAttack(gramPrime!, index);
        };
        const slamWeapon = selected("Slam Attack");
        const heavySlamWeapon = selected("Heavy Slam Attack");
        const normalWeapon = selected("Normal Attack");
        expect(slamWeapon.selectedAttackUsesSlamDamageBonus).toBe(true);
        expect(heavySlamWeapon.selectedAttackUsesSlamDamageBonus).toBe(true);
        expect(normalWeapon.selectedAttackUsesSlamDamageBonus).toBe(false);

        const maxRankEffect = seismicWave!.effectsByRank[seismicWave!.fusionLimit];
        const checkThreefoldDamage = (weapon: WeaponEntry) => {
            const baseline = calculateBuild(weapon, []).modded;
            const modded = calculateBuild(weapon, [maxRankEffect]).modded;
            expect(modded.slamAttackDamageMultiplier).toBe(3);
            expect(modded.baseDamageTotal).toBeCloseTo(baseline.baseDamageTotal * 3, 10);
            for (const type of Object.keys(baseline.rawDamageBreakdownBeforePerStatus) as Array<keyof typeof baseline.rawDamageBreakdownBeforePerStatus>) {
                expect(modded.rawDamageBreakdownBeforePerStatus[type]).toBeCloseTo(
                    baseline.rawDamageBreakdownBeforePerStatus[type] * 3,
                    10,
                );
            }
            const seededTypes = Object.keys(baseline.dotDamagePerApplicationSeedByType) as Array<keyof typeof baseline.dotDamagePerApplicationSeedByType>;
            for (const type of seededTypes) {
                expect(modded.dotDamagePerApplicationSeedByType[type]).toBeCloseTo(
                    (baseline.dotDamagePerApplicationSeedByType[type] ?? 0) * 3,
                    8,
                );
            }
        };
        checkThreefoldDamage(slamWeapon);
        checkThreefoldDamage(heavySlamWeapon);

        const normalBaseline = calculateBuild(normalWeapon, []).modded;
        const normalWithSeismic = calculateBuild(normalWeapon, [maxRankEffect]).modded;
        expect(normalWithSeismic.slamAttackDamageMultiplier).toBe(1);
        expect(normalWithSeismic.baseDamageTotal).toBeCloseTo(normalBaseline.baseDamageTotal, 10);
        expect(normalWithSeismic.damageBreakdown).toEqual(normalBaseline.damageBreakdown);

        const korumm = getWeaponCatalog().find((candidate) => candidate.name === "Korumm");
        expect(korumm).toBeDefined();
        const stanceSlamIndex = korumm!.attacks.findIndex((attack) => attack.name === "Tactical Combo Slam Attack");
        expect(stanceSlamIndex).toBeGreaterThanOrEqual(0);
        const stanceSlam = withSelectedAttack(korumm!, stanceSlamIndex);
        expect(stanceSlam.selectedAttackUsesSlamDamageBonus).toBe(true);
        checkThreefoldDamage(stanceSlam);
    });

    it("adds Nira set Slam Damage to Seismic Wave and only scales selected melee slams", () => {
        const gramPrime = getWeaponCatalog().find((candidate) => candidate.name === "Gram Prime");
        expect(gramPrime).toBeDefined();
        const seismicWave = getModsForWeapon(gramPrime!).find((mod) => mod.name === "Seismic Wave");
        expect(seismicWave).toBeDefined();
        const slamIndex = gramPrime!.attacks.findIndex((attack) => attack.name === "Slam Attack");
        const normalIndex = gramPrime!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(slamIndex).toBeGreaterThanOrEqual(0);
        expect(normalIndex).toBeGreaterThanOrEqual(0);
        const slam = withSelectedAttack(gramPrime!, slamIndex);
        const normal = withSelectedAttack(gramPrime!, normalIndex);
        const niraPiece = { ...emptyEffect(), niraSetModCount: 1 };
        const seismicPiece = seismicWave!.effectsByRank[seismicWave!.fusionLimit];
        const baseline = calculateBuild(slam, []).modded;
        const niraOnly = calculateBuild(slam, [niraPiece], "", {
            conditionalState: { mode: "realistic", externalNiraSetModCount: 2 },
        }).modded;
        const withSeismic = calculateBuild(slam, [niraPiece, seismicPiece], "", {
            conditionalState: { mode: "realistic", externalNiraSetModCount: 2 },
        }).modded;
        expect(niraOnly.niraSetModCount).toBe(3);
        expect(niraOnly.niraSetSlamDamageBonus).toBeCloseTo(4.5, 10);
        expect(niraOnly.slamAttackDamageMultiplier).toBeCloseTo(5.5, 10);
        expect(withSeismic.slamAttackDamageMultiplier).toBeCloseTo(7.5, 10);
        expect(withSeismic.baseDamageTotal).toBeCloseTo(baseline.baseDamageTotal * 7.5, 8);
        for (const type of Object.keys(baseline.dotDamagePerApplicationSeedByType) as Array<keyof typeof baseline.dotDamagePerApplicationSeedByType>) {
            expect(withSeismic.dotDamagePerApplicationSeedByType[type]).toBeCloseTo(
                (baseline.dotDamagePerApplicationSeedByType[type] ?? 0) * 7.5,
                7,
            );
        }

        const normalBaseline = calculateBuild(normal, []).modded;
        const normalWithNira = calculateBuild(normal, [niraPiece], "", {
            conditionalState: { mode: "realistic", externalNiraSetModCount: 2 },
        }).modded;
        expect(normalWithNira.niraSetSlamDamageBonus).toBe(0);
        expect(normalWithNira.slamAttackDamageMultiplier).toBe(1);
        expect(normalWithNira.damageBreakdown).toEqual(normalBaseline.damageBreakdown);

        const ranged = { ...slam, category: "Primary" as const };
        const rangedWithNira = calculateBuild(ranged, [niraPiece], "", {
            conditionalState: { mode: "realistic", externalNiraSetModCount: 2 },
        }).modded;
        expect(rangedWithNira.niraSetSlamDamageBonus).toBe(0);
        expect(rangedWithNira.slamAttackDamageMultiplier).toBe(1);
    });

    it("models Prototype Shock Coils as an independent Status Chance-scaled Electricity roll", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Efv-8 Mars");
        expect(weapon).toBeDefined();
        const mod = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Prototype Shock Coils");
        expect(mod).toBeDefined();
        expect(mod!.hasDamageEffect).toBe(true);
        expect(mod!.effectsByRank.map((effect) => effect.electricityBonus)).toEqual([0.15, 0.3, 0.45, 0.6, 0.75, 0.9]);
        expect(mod!.effectsByRank.map((effect) => effect.independentStatusProcChanceByType?.electricity)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
        for (let rank = 0; rank <= mod!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank)).toEqual([]);
        }

        const rankEffect = mod!.effectsByRank[mod!.fusionLimit];
        const normalIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const normalWeapon = withSelectedAttack(weapon!, normalIndex);
        const normal = calculateBuild(normalWeapon, [rankEffect]).modded;
        expect(normal.extraProcsPerShot.electricity).toBeCloseTo(normal.multishot * 0.2, 10);
        expect(normal.unfilteredExtraProcsPerShot.electricity).toBeCloseTo(normal.multishot * 0.2, 10);
        expect(normal.damageBreakdownBeforePerStatus.electricity).toBeGreaterThan(0);

        const statusChanceBoost = emptyEffect();
        statusChanceBoost.statusChanceBonus = 1;
        const boosted = calculateBuild(normalWeapon, [rankEffect, statusChanceBoost]).modded;
        expect(boosted.extraProcsPerShot.electricity).toBeCloseTo(boosted.multishot * 0.4, 10);

        const altFireIndex = weapon!.attacks.findIndex((attack) => attack.name === "Alt-Fire");
        const altFire = calculateBuild(withSelectedAttack(weapon!, altFireIndex), [rankEffect]).modded;
        expect(altFire.extraProcsPerShot.electricity).toBeCloseTo(altFire.multishot * 0.2, 10);

        const immune = calculateBuild(normalWeapon, [rankEffect], "Corpus", { statusImmuneTypes: ["electricity"] }).modded;
        expect(immune.extraProcsPerShot.electricity).toBeUndefined();
        expect(immune.procRatePerSecondByType.electricity).toBeUndefined();
        expect(immune.unfilteredExtraProcsPerShot.electricity).toBeCloseTo(immune.multishot * 0.2, 10);
    });

    it("applies Maiming Strike critical chance only to selected slide attacks", () => {
        const telosBoltace = getWeaponCatalog().find((candidate) => candidate.name === "Telos Boltace");
        expect(telosBoltace).toBeDefined();
        const slideAttackIndex = telosBoltace!.attacks.findIndex((attack) => attack.name === "Stormpath Slide Attack");
        const normalAttackIndex = telosBoltace!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        expect(slideAttackIndex).toBeGreaterThanOrEqual(0);
        expect(normalAttackIndex).toBeGreaterThanOrEqual(0);
        const slideAttack = withSelectedAttack(telosBoltace!, slideAttackIndex);
        const normalAttack = withSelectedAttack(telosBoltace!, normalAttackIndex);
        expect(slideAttack.selectedAttackIsSlideAttack).toBe(true);
        expect(normalAttack.selectedAttackIsSlideAttack).toBe(false);

        const maimingStrike = getModsForWeapon(telosBoltace!).find((mod) => mod.name === "Maiming Strike");
        expect(maimingStrike).toBeDefined();
        expect(maimingStrike!.hasDamageEffect).toBe(true);
        expect(maimingStrike!.effectsByRank.map((effect) => effect.slideAttackCritChanceBonus))
            .toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5]);
        for (let rank = 0; rank <= maimingStrike!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(maimingStrike!, rank)).toEqual([]);
        }

        const baseline = calculateBuild(slideAttack, []).modded;
        const maxRank = maimingStrike!.effectsByRank[maimingStrike!.fusionLimit];
        const moddedSlide = calculateBuild(slideAttack, [maxRank]).modded;
        expect(moddedSlide.critChance).toBeCloseTo(
            baseline.critChance + slideAttack.critChance * maxRank.slideAttackCritChanceBonus,
            12,
        );
        const moddedNormal = calculateBuild(normalAttack, [maxRank]).modded;
        expect(moddedNormal.critChance).toBeCloseTo(normalAttack.critChance, 12);
    });

    it("parses Burning Hate's rank-scaled permanent target Status Damage vulnerability", () => {
        const hate = getWeaponCatalog().find((candidate) => candidate.name === "Hate");
        expect(hate).toBeDefined();
        const burningHate = getModsForWeapon(hate!).find((candidate) => candidate.name === "Burning Hate");
        expect(burningHate).toBeDefined();
        expect(burningHate!.effectsByRank.map((effect) => effect.targetStatusDamageVulnerabilityBonus))
            .toEqual([0.2, 0.4, 0.6, 0.8, 1, 1.2]);
        expect(burningHate!.hasDamageEffect).toBe(true);
        for (let rank = 0; rank <= burningHate!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(burningHate!, rank)).toEqual([]);
        }

        const maxRankEffect = burningHate!.effectsByRank[burningHate!.fusionLimit];
        const noHeat = calculateBuild(hate!, [maxRankEffect]).modded;
        expect(noHeat.targetStatusDamageVulnerabilityBonus).toBe(1.2);
        expect(noHeat.steadyStateTargetStatusDamageMultiplier).toBe(1);

        const assumedExternalHeat = calculateBuild(hate!, [maxRankEffect], "", {
            conditionalState: {
                mode: "initial",
                externalHeatStatusPresenceProbability: 1,
            },
        }).modded;
        expect(assumedExternalHeat.steadyStateTargetStatusDamageMultiplier).toBeCloseTo(2.2, 12);
    });

    it("applies the first external Heat source's Heat and faction bonuses only to later Heat DoT", () => {
        const weapon = makeWeapon({ heat: 100 });
        const currentSourceEffect = {
            ...emptyEffect(),
            damageBonus: 1,
            heatBonus: 0.5,
            statusDamageBonus: 0.25,
            targetFaction: "Grineer",
            factionDamageBonus: 0.4,
        };
        const ownFirstSource = calculateBuild(weapon, [currentSourceEffect], "Grineer").modded;
        const externalFirstSource = calculateBuild(weapon, [currentSourceEffect], "Grineer", {
            conditionalState: {
                mode: "initial",
                externalHeatStatusPresenceProbability: 1,
                externalHeatElementalDamageBonus: 0.2,
                externalHeatFactionDamageBonus: 0.3,
            },
        }).modded;
        const mixedFirstSource = calculateBuild(weapon, [currentSourceEffect], "Grineer", {
            conditionalState: {
                mode: "initial",
                externalHeatStatusPresenceProbability: 0.5,
                externalHeatElementalDamageBonus: 0.2,
                externalHeatFactionDamageBonus: 0.3,
            },
        }).modded;

        expect(externalFirstSource.rawDamageBreakdown).toEqual(ownFirstSource.rawDamageBreakdown);
        expect(ownFirstSource.dotTickDamagePerProcBeforeConditionOverloadByType.heat).toBeCloseTo(367.5, 6);
        expect(externalFirstSource.heatDotTickDamagePerProcWhenExternallyInherited).toBeCloseTo(273, 6);
        expect(externalFirstSource.heatDotAccumulatorDamagePerTickWhenExternallyInherited).toBeCloseTo(0.975, 6);
        expect(externalFirstSource.dotDpsByType.heat).toBeLessThan(ownFirstSource.dotDpsByType.heat ?? 0);
        expect(mixedFirstSource.dotDpsByType.heat).toBeCloseTo(
            ((ownFirstSource.dotDpsByType.heat ?? 0) + (externalFirstSource.dotDpsByType.heat ?? 0)) / 2,
            6,
        );
    });

    it("doubles Galvanized Steel critical chance on heavy attacks only", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const galvanizedSteel = getModsForWeapon(weapon!).find((mod) => mod.name === "Galvanized Steel");
        expect(galvanizedSteel).toBeDefined();
        expect(galvanizedSteel!.hasDamageEffect).toBe(true);
        for (let rank = 0; rank <= galvanizedSteel!.fusionLimit; rank++) {
            const effect = galvanizedSteel!.effectsByRank[rank];
            expect(effect.critChanceBonus).toBeGreaterThan(0);
            expect(effect.heavyAttackCritChanceBonus).toBeCloseTo(effect.critChanceBonus, 10);
            expect(getUnmodeledDamageEffectLines(galvanizedSteel!, rank)).toEqual([]);
        }

        const normalAttack = withSelectedAttack(
            weapon!,
            weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
        );
        const heavyAttack = withSelectedAttack(
            weapon!,
            weapon!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack"),
        );
        expect(normalAttack.selectedAttackUsesHeavyAttackCritChance).toBe(false);
        expect(heavyAttack.selectedAttackUsesHeavyAttackCritChance).toBe(true);

        const maxRankEffect = galvanizedSteel!.effectsByRank[galvanizedSteel!.fusionLimit];
        expect(maxRankEffect.critChanceBonus).toBeCloseTo(1.1, 10);
        expect(maxRankEffect.heavyAttackCritChanceBonus).toBeCloseTo(1.1, 10);
        const normal = calculateBuild(normalAttack, [maxRankEffect]).modded;
        const heavy = calculateBuild(heavyAttack, [maxRankEffect]).modded;
        expect(normal.critChance).toBeCloseTo(normalAttack.critChance * 2.1, 10);
        expect(heavy.critChance).toBeCloseTo(heavyAttack.critChance * 3.2, 10);
    });

    it("keeps Wiki rank, trigger, duration, and stack data for every Galvanized mod", () => {
        const galvCases = [
            {
                weapon: "Tigris Prime", mod: "Galvanized Acceleration",
                r0: [
                    { trigger: "onKill", durationSeconds: 10, maxStacks: 2, requiresAiming: false, stats: { projectileSpeedBonus: 0.027 } },
                    { trigger: "onKill", durationSeconds: 10, maxStacks: 2, requiresAiming: false, stats: { beamRangeBonus: 0.027 } },
                ],
                max: [
                    { trigger: "onKill", durationSeconds: 10, maxStacks: 2, requiresAiming: false, stats: { projectileSpeedBonus: 0.3 } },
                    { trigger: "onKill", durationSeconds: 10, maxStacks: 2, requiresAiming: false, stats: { beamRangeBonus: 0.3 } },
                ],
            },
            {
                weapon: "Rubico Prime", mod: "Galvanized Aptitude",
                r0: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 2, requiresAiming: false, stats: { directDamagePerStatusBonus: 0.036 } }],
                max: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 2, requiresAiming: false, stats: { directDamagePerStatusBonus: 0.4 } }],
            },
            {
                weapon: "Braton Prime", mod: "Galvanized Chamber",
                r0: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 5, requiresAiming: false, stats: { multishotBonus: 0.027 } }],
                max: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 5, requiresAiming: false, stats: { multishotBonus: 0.3 } }],
            },
            {
                weapon: "Laetum", mod: "Galvanized Crosshairs",
                r0: [
                    { trigger: "onWeakPointHit", durationSeconds: 12, maxStacks: 1, requiresAiming: true, stats: { critChanceBonus: 0.109 } },
                    { trigger: "onWeakPointKill", durationSeconds: 12, maxStacks: 5, requiresAiming: true, stats: { critChanceBonus: 0.036 } },
                ],
                max: [
                    { trigger: "onWeakPointHit", durationSeconds: 12, maxStacks: 1, requiresAiming: true, stats: { critChanceBonus: 1.2 } },
                    { trigger: "onWeakPointKill", durationSeconds: 12, maxStacks: 5, requiresAiming: true, stats: { critChanceBonus: 0.4 } },
                ],
            },
            {
                weapon: "Laetum", mod: "Galvanized Diffusion",
                r0: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { multishotBonus: 0.027 } }],
                max: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { multishotBonus: 0.3 } }],
            },
            {
                weapon: "Broken War", mod: "Galvanized Elementalist",
                r0: [{ trigger: "onMeleeKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { statusChanceBonus: 0.027 } }],
                max: [{ trigger: "onMeleeKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { statusChanceBonus: 0.3 } }],
            },
            {
                weapon: "Tigris Prime", mod: "Galvanized Hell",
                r0: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { multishotBonus: 0.027 } }],
                max: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { multishotBonus: 0.3 } }],
            },
            {
                weapon: "Broken War", mod: "Galvanized Reflex",
                r0: [{ trigger: "onMeleeKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { initialComboBonus: 2 } }],
                max: [{ trigger: "onMeleeKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { initialComboBonus: 20 } }],
            },
            {
                weapon: "Tigris Prime", mod: "Galvanized Savvy",
                r0: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 2, requiresAiming: false, stats: { directDamagePerStatusBonus: 0.036 } }],
                max: [{ trigger: "onKill", durationSeconds: 20, maxStacks: 2, requiresAiming: false, stats: { directDamagePerStatusBonus: 0.4 } }],
            },
            {
                weapon: "Rubico Prime", mod: "Galvanized Scope",
                r0: [
                    { trigger: "onWeakPointHit", durationSeconds: 12, maxStacks: 1, requiresAiming: true, stats: { critChanceBonus: 0.109 } },
                    { trigger: "onWeakPointKill", durationSeconds: 12, maxStacks: 5, requiresAiming: true, stats: { critChanceBonus: 0.036 } },
                ],
                max: [
                    { trigger: "onWeakPointHit", durationSeconds: 12, maxStacks: 1, requiresAiming: true, stats: { critChanceBonus: 1.2 } },
                    { trigger: "onWeakPointKill", durationSeconds: 12, maxStacks: 5, requiresAiming: true, stats: { critChanceBonus: 0.4 } },
                ],
            },
            {
                weapon: "Laetum", mod: "Galvanized Shot",
                r0: [{ trigger: "onKill", durationSeconds: 14, maxStacks: 3, requiresAiming: false, stats: { directDamagePerStatusBonus: 0.036 } }],
                max: [{ trigger: "onKill", durationSeconds: 14, maxStacks: 3, requiresAiming: false, stats: { directDamagePerStatusBonus: 0.4 } }],
            },
            {
                weapon: "Broken War", mod: "Galvanized Steel",
                r0: [{ trigger: "onMeleeKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { critMultBonus: 0.027 } }],
                max: [{ trigger: "onMeleeKill", durationSeconds: 20, maxStacks: 4, requiresAiming: false, stats: { critMultBonus: 0.3 } }],
            },
        ] as const;
        const catalog = getWeaponCatalog();
        const metadata = (conditional: NonNullable<ModEffect["conditionalEffects"]>[number]) => ({
            trigger: conditional.trigger,
            durationSeconds: conditional.durationSeconds,
            maxStacks: conditional.maxStacks,
            requiresAiming: conditional.requiresAiming,
        });
        const expectRank = (
            effects: readonly NonNullable<ModEffect["conditionalEffects"]>[number][],
            expected: readonly NonNullable<ModEffect["conditionalEffects"]>[number][],
        ) => {
            expect(effects.map(metadata)).toEqual(expected.map(({ trigger, durationSeconds, maxStacks, requiresAiming }) => ({
                trigger,
                durationSeconds,
                maxStacks,
                requiresAiming,
            })));
            effects.forEach((conditional, index) => {
                const expectedStats = expected[index].stats;
                expect(Object.keys(conditional.stats).filter((key) => conditional.stats[key as keyof typeof conditional.stats] !== 0).sort())
                    .toEqual(Object.keys(expectedStats).sort());
                for (const [key, value] of Object.entries(expectedStats)) {
                    expect(conditional.stats[key as keyof typeof conditional.stats]).toBeCloseTo(value, 10);
                }
            });
        };

        for (const testCase of galvCases) {
            const weapon = catalog.find((entry) => entry.name === testCase.weapon);
            expect(weapon, testCase.weapon).toBeDefined();
            const mod = weapon && getModsForWeapon(weapon).find((entry) => entry.name === testCase.mod);
            expect(mod, testCase.mod).toBeDefined();
            if (!mod) continue;

            const rankZero = mod.effectsByRank[0].conditionalEffects ?? [];
            const maxRank = mod.effectsByRank[mod.fusionLimit].conditionalEffects ?? [];
            expectRank(rankZero, testCase.r0);
            expectRank(maxRank, testCase.max);
            for (let rank = 0; rank <= mod.fusionLimit; rank++) {
                expect(mod.effectsByRank[rank].conditionalEffects?.map(metadata)).toEqual(testCase.max.map(metadata));
                expect(getUnmodeledDamageEffectLines(mod, rank)).toEqual([]);
            }
        }
    });

    it("models Galvanized kill stacks from deterministic identical-target kill sequences", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Rubico Prime");
        expect(weapon).toBeDefined();
        const mod = getModsForWeapon(weapon!).find((entry) => entry.name === "Galvanized Aptitude");
        expect(mod).toBeDefined();
        const maxRankEffect = mod!.effectsByRank[mod!.fusionLimit];

        const averageStacksInSequence = (killInterval: number, duration: number, stackCap: number) => {
            const warmup = 10 * duration;
            const horizon = warmup + 100 * duration;
            let stacks = 0;
            let time = 0;
            let nextKill = 0;
            let nextTimeout = Number.POSITIVE_INFINITY;
            let stackTime = 0;
            while (time < horizon) {
                const eventTime = Math.min(nextKill, nextTimeout, horizon);
                if (eventTime > warmup) {
                    stackTime += stacks * (eventTime - Math.max(time, warmup));
                }
                time = eventTime;
                if (nextTimeout <= nextKill && nextTimeout <= horizon) {
                    stacks = Math.max(0, stacks - 1);
                    nextTimeout = stacks > 0 ? time + duration : Number.POSITIVE_INFINITY;
                } else if (nextKill <= horizon) {
                    stacks = Math.min(stackCap, stacks + 1);
                    nextTimeout = time + duration;
                    nextKill += killInterval;
                } else {
                    break;
                }
            }
            return stackTime / (horizon - warmup);
        };

        const fastSequenceStacks = averageStacksInSequence(10, 20, 2);
        const boundarySequenceStacks = averageStacksInSequence(20, 20, 2);
        const slowSequenceStacks = averageStacksInSequence(40, 20, 2);
        expect(fastSequenceStacks).toBeCloseTo(2, 8);
        expect(boundarySequenceStacks).toBeCloseTo(1, 8);
        expect(slowSequenceStacks).toBeCloseTo(0.5, 8);

        const realistic = calculateBuild(weapon!, [maxRankEffect], "", {
            conditionalState: { mode: "realistic" },
            expectedKillRatePerSecond: 1 / 10,
        }).modded;
        const slowSequence = calculateBuild(weapon!, [maxRankEffect], "", {
            conditionalState: { mode: "realistic" },
            expectedKillRatePerSecond: 1 / 40,
        }).modded;
        const noKills = calculateBuild(weapon!, [maxRankEffect], "", {
            conditionalState: { mode: "realistic" },
            expectedKillRatePerSecond: 0,
        }).modded;
        const initial = calculateBuild(weapon!, [maxRankEffect], "", {
            conditionalState: { mode: "initial" },
            expectedKillRatePerSecond: 1 / 10,
        }).modded;
        const fullyStacked = calculateBuild(weapon!, [maxRankEffect], "", {
            conditionalState: { mode: "fullyStacked" },
            expectedKillRatePerSecond: 1 / 10,
        }).modded;
        const laetum = getWeaponCatalog().find((entry) => entry.name === "Laetum");
        const galvanizedShot = getModsForWeapon(laetum!).find((entry) => entry.name === "Galvanized Shot");
        const slowShotSequence = calculateBuild(laetum!, [galvanizedShot!.effect], "", {
            conditionalState: { mode: "realistic" },
            expectedKillRatePerSecond: 1 / 20,
        }).modded;
        const fastShotSequence = calculateBuild(laetum!, [galvanizedShot!.effect], "", {
            conditionalState: { mode: "realistic" },
            expectedKillRatePerSecond: 1 / 10,
        }).modded;

        expect(realistic.directDamagePerStatusBonus).toBeCloseTo(0.4 * fastSequenceStacks, 6);
        expect(slowSequence.directDamagePerStatusBonus).toBeCloseTo(0.4 * slowSequenceStacks, 6);
        expect(slowShotSequence.directDamagePerStatusBonus).toBeCloseTo(0.4 * (14 / 20), 6);
        expect(fastShotSequence.directDamagePerStatusBonus).toBeCloseTo(0.4 * 3, 6);
        expect(noKills.directDamagePerStatusBonus).toBe(0);
        expect(initial.directDamagePerStatusBonus).toBe(0);
        expect(fullyStacked.directDamagePerStatusBonus).toBeCloseTo(0.8, 6);
    });

    it("keeps unrelated on-kill conditionals on their generic estimate when Galvanized cadence is supplied", () => {
        const weapon = makeWeapon({ impact: 100 });
        const unrelatedOnKillEffect: ModEffect = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill",
                durationSeconds: 20,
                maxStacks: 3,
                requiresAiming: false,
                stats: { damageBonus: 0.5 },
            }],
        };
        const withoutKillCadence = calculateBuild(weapon, [unrelatedOnKillEffect], "", {
            conditionalState: { mode: "realistic" },
        }).modded;
        const withGalvanizedKillCadence = calculateBuild(weapon, [unrelatedOnKillEffect], "", {
            conditionalState: { mode: "realistic" },
            expectedKillRatePerSecond: 1 / 10,
        }).modded;

        expect(withGalvanizedKillCadence.damageBreakdownBeforePerStatus)
            .toEqual(withoutKillCadence.damageBreakdownBeforePerStatus);
        expect(withGalvanizedKillCadence.directDamagePerStatusBonus).toBe(0);
    });

    it("does not apply heavy-attack critical chance to a Glaive's direct throw", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Glaive Prime");
        expect(weapon).toBeDefined();
        const galvanizedSteel = getModsForWeapon(weapon!).find((mod) => mod.name === "Galvanized Steel");
        expect(galvanizedSteel).toBeDefined();
        const throwAttack = withSelectedAttack(
            weapon!,
            weapon!.attacks.findIndex((attack) => attack.name === "Charged Throw"),
        );
        expect(throwAttack.selectedAttackUsesMeleeComboMultiplier).toBe(true);
        expect(throwAttack.selectedAttackUsesHeavyAttackCritChance).toBe(false);

        const maxRankEffect = galvanizedSteel!.effectsByRank[galvanizedSteel!.fusionLimit];
        const baseline = calculateBuild(throwAttack, []).modded;
        const modded = calculateBuild(throwAttack, [maxRankEffect]).modded;
        expect(modded.critChance).toBeCloseTo(
            baseline.critChance + throwAttack.critChance * maxRankEffect.critChanceBonus,
            10,
        );
    });

    it("models additive final Status Chance and triggered weapon augment effects", () => {
        const supra = getWeaponCatalog().find((candidate) => candidate.name === "Supra");
        const entropyBurst = supra && getModsForWeapon(supra).find((mod) => mod.name === "Entropy Burst");
        expect(entropyBurst).toBeDefined();
        expect(entropyBurst!.effectsByRank.map((effect) => effect.finalStatusChanceBonus))
            .toEqual([0.05, 0.1, 0.15, 0.2]);
        expect(getUnmodeledDamageEffectLines(entropyBurst!, entropyBurst!.fusionLimit))
            .toContain("Entropy syndicate side effect is not modeled.");
        const supraBase = calculateBuild(supra!, []).modded;
        const supraModded = calculateBuild(supra!, [entropyBurst!.effect]).modded;
        expect(supraModded.statusChance).toBeCloseTo(supraBase.statusChance + 0.2, 12);

        const carminePenta = getWeaponCatalog().find((candidate) => candidate.name === "Carmine Penta");
        const napalmGrenades = carminePenta && getModsForWeapon(carminePenta).find((mod) => mod.name === "Napalm Grenades");
        expect(napalmGrenades).toBeDefined();
        expect(napalmGrenades!.effectsByRank.map((effect) => effect.finalStatusChanceBonus))
            .toEqual([0.05, 0.1, 0.15, 0.2, 0.25, 0.3]);
        expect(getUnmodeledDamageEffectLines(napalmGrenades!, napalmGrenades!.fusionLimit))
            .toContain("Penta explosion damage conversion and lingering fire patch are not modeled.");
        expect(napalmGrenades!.hasDamageEffect).toBe(true);
        const pentaBase = calculateBuild(carminePenta!, []).modded;
        const pentaModded = calculateBuild(carminePenta!, [napalmGrenades!.effect]).modded;
        expect(pentaModded.statusChance).toBeCloseTo(pentaBase.statusChance + 0.3, 12);

        const vesper = getWeaponCatalog().find((candidate) => candidate.name === "Vesper 77");
        const leadedGas = vesper && getModsForWeapon(vesper).find((mod) => mod.name === "Leaded Gas");
        expect(leadedGas).toBeDefined();
        expect(leadedGas!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.stats))
            .toEqual([0.5, 1, 1.5, 2, 2.5, 3].map((bonus) => ({ gasBonus: bonus, statusChanceBonus: bonus })));
        expect(leadedGas!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.durationSeconds))
            .toEqual([1, 2, 3, 4, 5, 6]);
        for (let rank = 0; rank <= leadedGas!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(leadedGas!, rank)).toEqual([]);
        }
        const leadedInitial = calculateBuild(vesper!, [leadedGas!.effect], "", { conditionalState: { mode: "initial" } }).modded;
        const leadedStacked = calculateBuild(vesper!, [leadedGas!.effect], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        expect(leadedInitial.statusChance).toBeCloseTo(vesper!.statusChance, 12);
        expect(leadedStacked.statusChance).toBeCloseTo(vesper!.statusChance * 4, 12);
        expect(leadedStacked.damageBreakdownBeforePerStatus.gas).toBeGreaterThan(0);

        const ax52 = getWeaponCatalog().find((candidate) => candidate.name === "Ax-52");
        const bioticRounds = ax52 && getModsForWeapon(ax52).find((mod) => mod.name === "Biotic Rounds");
        expect(bioticRounds).toBeDefined();
        expect(bioticRounds!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.trigger))
            .toEqual(Array(6).fill("onWeakPointKill"));
        expect(bioticRounds!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.durationSeconds))
            .toEqual(Array(6).fill(15));
        expect(bioticRounds!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.stats))
            .toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5].map((bonus) => ({
                viralBonus: bonus,
                magneticBonus: bonus,
                statusChanceBonus: bonus,
            })));
        for (let rank = 0; rank <= bioticRounds!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(bioticRounds!, rank)).toEqual([]);
        }
        const bioticInitial = calculateBuild(ax52!, [bioticRounds!.effect], "", { conditionalState: { mode: "initial" } }).modded;
        const bioticStacked = calculateBuild(ax52!, [bioticRounds!.effect], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        expect(bioticInitial.damageBreakdownBeforePerStatus.viral).toBe(0);
        expect(bioticInitial.damageBreakdownBeforePerStatus.magnetic).toBe(0);
        expect(bioticStacked.damageBreakdownBeforePerStatus.viral).toBeGreaterThan(0);
        expect(bioticStacked.damageBreakdownBeforePerStatus.magnetic).toBeGreaterThan(0);
        expect(bioticStacked.statusChance).toBeGreaterThan(bioticInitial.statusChance);
    });

    it("parses Wiki-backed Sentient Surge ranks and applies its capped active-tendril bonuses", () => {
        const ocucor = getWeaponCatalog().find((candidate) => candidate.name === "Ocucor");
        expect(ocucor).toBeDefined();
        const sentientSurge = getModsForWeapon(ocucor!).find((candidate) => candidate.name === "Sentient Surge");
        expect(sentientSurge).toBeDefined();
        expect(sentientSurge!.effectsByRank.map((effect) => effect.sentientSurgeMagazineRefillPerKill))
            .toEqual([0.03, 0.06, 0.09, 0.12, 0.15, 0.2]);
        expect(sentientSurge!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.stats))
            .toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((bonus) => ({
                critChanceBonus: bonus,
                statusChanceBonus: bonus,
            })));
        for (let rank = 0; rank <= sentientSurge!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(sentientSurge!, rank)).toEqual([]);
            expect(sentientSurge!.effectsByRank[rank].conditionalEffects[0]).toMatchObject({
                trigger: "onOcucorTendrilKill",
                maxStacks: 4,
                durationSeconds: 0,
            });
        }

        const effect = sentientSurge!.effect;
        const initial = calculateBuild(ocucor!, [effect], "", { conditionalState: { mode: "initial" } }).modded;
        const realistic = calculateBuild(ocucor!, [effect], "", { conditionalState: { mode: "realistic" } }).modded;
        const fullyStacked = calculateBuild(ocucor!, [effect], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        const customTwo = calculateBuild(ocucor!, [effect], "", {
            conditionalState: { mode: "custom", externalStacks: 2 },
        }).modded;
        const customOverCap = calculateBuild(ocucor!, [effect], "", {
            conditionalState: { mode: "custom", externalStacks: 9 },
        }).modded;
        expect(initial.critChance).toBeCloseTo(ocucor!.critChance, 12);
        expect(initial.statusChance).toBeCloseTo(ocucor!.statusChance, 12);
        expect(realistic.critChance).toBeCloseTo(ocucor!.critChance * (1 + 0.6 * 2.8), 12);
        expect(realistic.statusChance).toBeCloseTo(ocucor!.statusChance * (1 + 0.6 * 2.8), 12);
        expect(fullyStacked.critChance).toBeCloseTo(ocucor!.critChance * 3.4, 12);
        expect(fullyStacked.statusChance).toBeCloseTo(ocucor!.statusChance * 3.4, 12);
        expect(customTwo.critChance).toBeCloseTo(ocucor!.critChance * 2.2, 12);
        expect(customOverCap.critChance).toBeCloseTo(fullyStacked.critChance, 12);

        const otherCritAndStatusMod = { ...emptyEffect(), critChanceBonus: 1.5, statusChanceBonus: 1.65 };
        const additive = calculateBuild(ocucor!, [otherCritAndStatusMod, effect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;
        expect(additive.critChance).toBeCloseTo(ocucor!.critChance * (1 + 1.5 + 2.4), 12);
        expect(additive.statusChance).toBeCloseTo(ocucor!.statusChance * (1 + 1.65 + 2.4), 12);
    });

    it("models Proton Jet's Wiki-ranked latch-only critical and status chance", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Perigale Prime");
        expect(weapon).toBeDefined();
        const protonJet = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Proton Jet");
        expect(protonJet).toBeDefined();
        expect(protonJet!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.stats))
            .toEqual([0.3, 0.6, 0.9, 1.2].map((bonus) => ({ critChanceBonus: bonus, statusChanceBonus: bonus })));
        for (let rank = 0; rank <= protonJet!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(protonJet!, rank)).toEqual([]);
            expect(protonJet!.effectsByRank[rank].conditionalEffects[0]).toMatchObject({
                trigger: "whileWallLatched",
                durationSeconds: 0,
                maxStacks: 1,
            });
        }

        const base = calculateBuild(weapon!, []).modded;
        const effect = protonJet!.effect;
        const initial = calculateBuild(weapon!, [effect], "", { conditionalState: { mode: "initial" } }).modded;
        const realistic = calculateBuild(weapon!, [effect], "", { conditionalState: { mode: "realistic" } }).modded;
        const fullyLatched = calculateBuild(weapon!, [effect], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        const customLatched = calculateBuild(weapon!, [effect], "", {
            conditionalState: { mode: "custom", externalStacks: 1 },
        }).modded;
        expect(initial.critChance).toBeCloseTo(base.critChance, 12);
        expect(initial.statusChance).toBeCloseTo(base.statusChance, 12);
        expect(realistic.critChance).toBeCloseTo(base.critChance, 12);
        expect(realistic.statusChance).toBeCloseTo(base.statusChance, 12);
        expect(fullyLatched.critChance).toBeCloseTo(base.critChance * 2.2, 12);
        expect(fullyLatched.statusChance).toBeCloseTo(base.statusChance * 2.2, 12);
        expect(customLatched.critChance).toBeCloseTo(fullyLatched.critChance, 12);
    });

    it("models Proton Snap's latch delay, rank duration, additive status, and mod-slot Toxin", () => {
        const melee = getWeaponCatalog().find((candidate) => candidate.name === "Gram Prime");
        expect(melee).toBeDefined();
        const protonSnap = getModsForWeapon(melee!).find((candidate) => candidate.name === "Proton Snap");
        expect(protonSnap).toBeDefined();
        expect(protonSnap!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.stats))
            .toEqual([0.25, 0.5, 0.75, 1].map((toxin, index) => ({
                toxinBonus: toxin,
                finalStatusChanceBonus: [0.125, 0.25, 0.375, 0.5][index],
            })));
        expect(protonSnap!.effectsByRank.map((effect) => effect.conditionalEffects[0]?.durationSeconds))
            .toEqual([5, 10, 15, 20]);
        for (let rank = 0; rank <= protonSnap!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(protonSnap!, rank)).toEqual([]);
            expect(protonSnap!.effectsByRank[rank].conditionalEffects[0]).toMatchObject({
                trigger: "whileWallLatched",
                activationDelaySeconds: 2,
                maxStacks: 1,
            });
        }

        const weapon = {
            ...makeWeapon({ impact: 100 }),
            category: "Melee" as const,
            weaponType: "Heavy Blade",
            modCompat: "Melee" as const,
        };
        const statusMod = { ...emptyEffect(), statusChanceBonus: 0.9 };
        const snap = protonSnap!.effect;
        const initial = calculateBuild(weapon, [statusMod, snap], "", { conditionalState: { mode: "initial" } }).modded;
        const realistic = calculateBuild(weapon, [statusMod, snap], "", { conditionalState: { mode: "realistic" } }).modded;
        const active = calculateBuild(weapon, [statusMod, snap], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        expect(initial.statusChance).toBeCloseTo(0.4 * 1.9, 12);
        expect(realistic.statusChance).toBeCloseTo(initial.statusChance, 12);
        expect(active.statusChance).toBeCloseTo(0.4 * 1.9 + 0.5, 12);
        expect(initial.damageBreakdownBeforePerStatus.toxin).toBe(0);
        expect(active.damageBreakdownBeforePerStatus.toxin).toBeGreaterThan(0);

        const heat = { ...emptyEffect(), heatBonus: 1 };
        const cold = { ...emptyEffect(), coldBonus: 1 };
        const activeElements = calculateBuild(weapon, [heat, snap, cold], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded.damageBreakdownBeforePerStatus;
        const inactiveElements = calculateBuild(weapon, [heat, snap, cold], "", {
            conditionalState: { mode: "initial" },
        }).modded.damageBreakdownBeforePerStatus;
        expect(activeElements.gas).toBeGreaterThan(0);
        expect(activeElements.cold).toBeGreaterThan(0);
        expect(activeElements.blast).toBe(0);
        expect(inactiveElements.blast).toBeGreaterThan(0);
    });

    it("parses and applies Shattering Impact only to quantized Impact melee hits", () => {
        const skana = getWeaponCatalog().find((candidate) => candidate.name === "Skana");
        expect(skana).toBeDefined();
        const shatteringImpact = getModsForWeapon(skana!).find((mod) => mod.name === "Shattering Impact");
        expect(shatteringImpact).toBeDefined();
        expect(shatteringImpact!.effectsByRank.map((effect) => effect.shatteringImpactBaseArmorPerHit))
            .toEqual([1, 2, 3, 4, 5, 6]);
        for (let rank = 0; rank <= shatteringImpact!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(shatteringImpact!, rank)).toEqual([]);
        }

        const built = calculateBuild(skana!, [shatteringImpact!.effect]).modded;
        expect(built.shatteringImpactBaseArmorPerHit).toBe(6);
        expect(built.damageBreakdownBeforePerStatus.impact).toBeGreaterThan(0);

        const fractionalImpactMelee: WeaponEntry = {
            ...makeWeapon({ impact: 0.001, puncture: 100 }),
            uniqueName: "/Test/LowQuantizedImpactMelee",
            name: "Low Quantized Impact Test Melee",
            category: "Melee",
            weaponType: "Melee",
            modCompat: "Melee" as const,
        };
        const roundedToZero = calculateBuild(fractionalImpactMelee, [shatteringImpact!.effect]).modded;
        expect(roundedToZero.damageBreakdownBeforePerStatus.impact).toBe(0);
        expect(roundedToZero.shatteringImpactBaseArmorPerHit).toBe(0);
    });

    it("models Charged and Primed Chamber on only the first ammo shot in a magazine", () => {
        const perigalePrime = getWeaponCatalog().find((candidate) => candidate.name === "Perigale Prime");
        expect(perigalePrime).toBeDefined();
        const normalAttack = withSelectedAttack(perigalePrime!, 0);
        const mods = getModsForWeapon(perigalePrime!);
        const chargedChamber = mods.find((mod) => mod.name === "Charged Chamber");
        const primedChamber = mods.find((mod) => mod.name === "Primed Chamber");
        expect(chargedChamber).toBeDefined();
        expect(primedChamber).toBeDefined();

        const base = calculateBuild(normalAttack, []);
        const charged = calculateBuild(normalAttack, [chargedChamber!.effectsByRank[chargedChamber!.fusionLimit]]);
        const primed = calculateBuild(normalAttack, [primedChamber!.effectsByRank[primedChamber!.fusionLimit]]);
        const both = calculateBuild(normalAttack, [
            chargedChamber!.effectsByRank[chargedChamber!.fusionLimit],
            primedChamber!.effectsByRank[primedChamber!.fusionLimit],
        ]);

        expect(chargedChamber!.effectsByRank.map((effect) => effect.firstShotMagazineDamageBonus))
            .toEqual([0.1, 0.2, 0.3, 0.4]);
        expect(primedChamber!.effectsByRank.map((effect) => effect.firstShotMagazineDamageBonus))
            .toEqual([0.25, 0.5, 0.75, 1]);
        expect(base.modded.shotsPerMag).toBe(16);
        expect(charged.modded.firstShotMagazineDamageMultiplier).toBeCloseTo(1.4, 12);
        expect(charged.modded.magazineAverageDamageMultiplier).toBeCloseTo(1.025, 12);
        expect(charged.modded.averageShotDamage).toBeCloseTo(base.modded.averageShotDamage, 12);
        expect(charged.burstDPS).toBeCloseTo(base.burstDPS * 1.025, 10);
        expect(charged.sustainedDPS).toBeCloseTo(base.sustainedDPS * 1.025, 10);
        expect(charged.modded.dotDps).toBeCloseTo(base.modded.dotDps * 1.025, 10);
        expect(primed.modded.firstShotMagazineDamageMultiplier).toBeCloseTo(2, 12);
        expect(both.modded.firstShotMagazineDamageBonus).toBeCloseTo(1.4, 12);
        expect(both.modded.magazineAverageDamageMultiplier).toBeCloseTo(1.0875, 12);
        expect(both.modded.dotDps).toBeCloseTo(base.modded.dotDps * 1.0875, 10);
    });

    it("models Synth Charge on one hit of the final shot in eligible magazines", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Lex Prime");
        expect(weapon).toBeDefined();
        expect(weapon!.magazineSize).toBeGreaterThanOrEqual(6);
        const synthCharge = getModsForWeapon(weapon!).find((mod) => mod.name === "Synth Charge");
        expect(synthCharge).toBeDefined();
        expect(synthCharge!.hasDamageEffect).toBe(true);
        expect(synthCharge!.effectsByRank.map((effect) => effect.lastShotMagazineDamageBonus))
            .toEqual([0.5, 1, 1.5, 2]);
        for (let rank = 0; rank <= synthCharge!.fusionLimit; rank++) {
            expect(getUnmodeledDamageEffectLines(synthCharge!, rank)).toEqual([]);
        }

        const effect = synthCharge!.effectsByRank[synthCharge!.fusionLimit];
        const base = calculateBuild(weapon!, []);
        const charged = calculateBuild(weapon!, [effect]);
        const lethalTorrent = getModsForWeapon(weapon!).find((mod) => mod.name === "Lethal Torrent");
        expect(lethalTorrent).toBeDefined();
        const multishotBuild = calculateBuild(weapon!, [
            effect,
            lethalTorrent!.effectsByRank[lethalTorrent!.fusionLimit],
        ]).modded;

        expect(base.modded.shotsPerMag).toBe(8);
        expect(charged.modded.lastShotMagazineDamageBonus).toBe(2);
        expect(charged.modded.lastShotMagazineRequestedDamageBonus).toBe(2);
        expect(charged.modded.lastShotMagazineDamageMultiplier).toBeCloseTo(3, 12);
        expect(charged.modded.magazineAverageDamageMultiplier).toBeCloseTo(1.25, 12);
        expect(charged.burstDPS).toBeCloseTo(base.burstDPS * 1.25, 10);
        expect(charged.sustainedDPS).toBeCloseTo(base.sustainedDPS * 1.25, 10);
        expect(charged.modded.lastShotMagazineInactiveReason).toBeNull();
        expect(multishotBuild.damageWeightedMultishot).toBeCloseTo(1.6, 10);
        expect(multishotBuild.lastShotMagazineDamageMultiplier).toBeCloseTo(2.25, 10);
        expect(multishotBuild.magazineAverageDamageMultiplier).toBeCloseTo(1.15625, 10);

        const shortMagazine = calculateBuild({ ...weapon!, magazineSize: 5 }, [effect]).modded;
        expect(shortMagazine.lastShotMagazineInactiveReason).toBe("base-magazine-under-six");
        expect(shortMagazine.lastShotMagazineDamageBonus).toBe(0);
        expect(shortMagazine.lastShotMagazineRequestedDamageBonus).toBe(2);

        const continuousWeapon = calculateBuild({
            ...weapon!,
            tags: [...weapon!.tags, "BEAM"],
        }, [effect]).modded;
        expect(continuousWeapon.lastShotMagazineInactiveReason).toBe("continuous-weapon");
        expect(continuousWeapon.lastShotMagazineDamageBonus).toBe(0);

        const catabolyst = getWeaponCatalog().find((candidate) => candidate.name === "Catabolyst");
        const emptyReloadExplosion = catabolyst?.attacks.findIndex((attack) => attack.name === "Reload From Empty Explosion") ?? -1;
        expect(emptyReloadExplosion).toBeGreaterThanOrEqual(0);
        const unsupportedReloadGrenade = calculateBuild(
            withSelectedAttack(catabolyst!, emptyReloadExplosion),
            [effect],
        ).modded;
        expect(unsupportedReloadGrenade.lastShotMagazineInactiveReason).toBe("unmodeled-reload-grenade");

        const incarnonAttack = calculateBuild({
            ...weapon!,
            selectedAttackIsIncarnon: true,
        }, [effect]).modded;
        expect(incarnonAttack.lastShotMagazineInactiveReason).toBe("incarnon-attack");
        expect(incarnonAttack.lastShotMagazineDamageBonus).toBe(0);

        const oneAttackPerMagazine = calculateBuild({
            ...weapon!,
            ammoCostPerShot: weapon!.magazineSize,
        }, [effect]).modded;
        expect(oneAttackPerMagazine.lastShotMagazineInactiveReason).toBe("one-attack-per-magazine");
        expect(oneAttackPerMagazine.lastShotMagazineDamageBonus).toBe(0);
    });

    it("models maintained Gale Force as infinite ammo and suppresses Chamber bonuses", () => {
        const catalog = getWeaponCatalog();
        const perigale = catalog.find((candidate) => candidate.name === "Perigale");
        const perigalePrime = catalog.find((candidate) => candidate.name === "Perigale Prime");
        expect(perigale?.hasGaleForceAmmoPassive).toBe(true);
        expect(perigalePrime?.hasGaleForceAmmoPassive).toBe(true);

        const weapon = withSelectedAttack(perigalePrime!, 0);
        const primedChamber = getModsForWeapon(weapon).find((mod) => mod.name === "Primed Chamber");
        expect(primedChamber).toBeDefined();
        const effect = primedChamber!.effectsByRank[primedChamber!.fusionLimit];

        const initial = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "initial" } }).modded;
        const realistic = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "realistic" } }).modded;
        const customZero = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "custom", externalStacks: 0 } }).modded;
        const fullyStacked = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        const customMaintained = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "custom", externalStacks: 1 } }).modded;

        expect([initial.infiniteAmmoActive, realistic.infiniteAmmoActive, customZero.infiniteAmmoActive])
            .toEqual([false, false, false]);
        expect(initial.firstShotMagazineDamageBonus).toBe(1);
        expect(realistic.firstShotMagazineDamageBonus).toBe(1);
        for (const active of [fullyStacked, customMaintained]) {
            expect(active.infiniteAmmoActive).toBe(true);
            expect(active.ammoEfficiencyBonus).toBe(0);
            expect(active.shotsPerMag).toBe(Number.MAX_SAFE_INTEGER);
            expect(active.magazineDutyCycle).toBe(1);
            expect(active.firstShotMagazineDamageBonus).toBe(0);
            expect(active.firstShotMagazineDamageMultiplier).toBe(1);
            expect(active.magazineAverageDamageMultiplier).toBe(1);
        }
    });

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
            slashDotTickDamagePerProc: 52.5,
            statusDurationMultiplier: 1,
        }, {
            totalDamageMultiplier: 2,
            totalSlashProcMultiplier: 0,
            baseComboLengthSeconds: 0.75,
        });

        // Direct combo damage = 2 × 100 × (1 + .5 × (2 − 1)) = 300; no Slash is forced.
        expect(result).toEqual({
            directDamage: 300,
            forcedSlashDamage: 0,
            forcedSlashProcEquivalentHits: 0,
            slashTickCount: 6,
            averageHit: 300,
            averageDps: 600,
            expectedHitDamageMultiplier: 1.5,
        });
    });

    it("includes the Wiki forced-Slash multiplier in the stance combo estimate", () => {
        const result = calculateMeleeAverageDps({
            totalDamage: 100,
            critChance: 0.5,
            critMultiplier: 2,
            fireRate: 1.5,
            slashDotTickDamagePerProc: 52.5,
            statusDurationMultiplier: 1,
        }, {
            totalDamageMultiplier: 2,
            totalSlashProcMultiplier: 2.1,
            baseComboLengthSeconds: 0.75,
        });

        expect(result?.directDamage).toBe(300);
        expect(result?.forcedSlashDamage).toBeCloseTo(315, 10);
        expect(result?.forcedSlashProcEquivalentHits).toBeCloseTo(1, 12);
        expect(result?.slashTickCount).toBe(6);
        expect(result?.averageHit).toBeCloseTo(615, 10);
        expect(result?.averageDps).toBeCloseTo(1230, 10);
        expect(result?.expectedHitDamageMultiplier).toBe(1.5);
    });

    it("keeps Wiki forced Slash damage separate from physical and elemental hit damage", () => {
        const baseWeapon = {
            ...makeWeapon({ slash: 100 }),
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee" as const,
        };
        const baseStats = calculateBuild(baseWeapon, []).modded;
        const physicalStats = calculateBuild(baseWeapon, [{ ...emptyEffect(), slashBonus: 0.9 }]).modded;
        const elementalStats = calculateBuild(baseWeapon, [{ ...emptyEffect(), heatBonus: 0.9 }]).modded;
        const parameters = {
            totalDamageMultiplier: 1,
            totalSlashProcMultiplier: 2.1,
            baseComboLengthSeconds: 1,
        };

        expect(physicalStats.totalDamage).toBeGreaterThan(baseStats.totalDamage);
        expect(elementalStats.totalDamage).toBeGreaterThan(baseStats.totalDamage);
        expect(physicalStats.slashDotTickDamagePerProc).toBe(baseStats.slashDotTickDamagePerProc);
        expect(elementalStats.slashDotTickDamagePerProc).toBe(baseStats.slashDotTickDamagePerProc);

        const physicalResult = calculateMeleeAverageDps(physicalStats, parameters);
        const elementalResult = calculateMeleeAverageDps(elementalStats, parameters);
        expect(physicalResult?.directDamage).toBeGreaterThan(baseStats.totalDamage);
        expect(elementalResult?.directDamage).toBeGreaterThan(baseStats.totalDamage);
        expect(physicalResult?.forcedSlashDamage).toBeCloseTo(baseStats.slashDotTickDamagePerProc * 6, 10);
        expect(elementalResult?.forcedSlashDamage).toBeCloseTo(baseStats.slashDotTickDamagePerProc * 6, 10);

        const longerSlash = calculateMeleeAverageDps({
            ...baseStats,
            statusDurationMultiplier: 2,
        }, parameters);
        expect(longerSlash?.slashTickCount).toBe(12);
        expect(longerSlash?.forcedSlashDamage).toBeCloseTo(baseStats.slashDotTickDamagePerProc * 12, 10);
    });

    it("rejects invalid Wiki stance values instead of filling in defaults", () => {
        const stats = {
            ...calculateBuild(makeWeapon({ slash: 100 }), []).modded,
            totalDamage: 100,
            critChance: 0.5,
            critMultiplier: 2,
            fireRate: 1.5,
        };
        expect(calculateMeleeAverageDps(stats, {
            totalDamageMultiplier: 1,
            totalSlashProcMultiplier: 0,
            baseComboLengthSeconds: 0,
        })).toBeNull();
        expect(calculateMeleeAverageDps(stats, {
            totalDamageMultiplier: Number.NaN,
            totalSlashProcMultiplier: 0,
            baseComboLengthSeconds: 1,
        })).toBeNull();
    });

    it("applies target-specific Cold stack caps and excludes AoE critical damage", () => {
        const weapon = { ...makeWeapon({ cold: 100 }), statusChance: 1, fireRate: 1 };
        const normalTarget = calculateBuild(weapon, []).modded;
        const nineStackTarget = calculateBuild({ ...weapon, statusChance: 1.5 }, []).modded;
        const frozenTarget = calculateBuild({ ...weapon, statusChance: 2 }, []).modded;
        const areaTarget = calculateBuild({ ...weapon, statusChance: 2, selectedAttackIsAreaDamage: true }, []).modded;
        const overguardTarget = calculateBuild(weapon, [], "", { statusStackCaps: { cold: 4 } }).modded;

        expect(normalTarget.expectedStacksByType.cold).toBe(6);
        expect(nineStackTarget.expectedStacksByType.cold).toBe(9);
        expect(frozenTarget.expectedStacksByType.cold).toBe(10);
        expect(areaTarget.expectedStacksByType.cold).toBe(10);
        expect(overguardTarget.expectedStacksByType.cold).toBe(4);
        expect(normalTarget.coldCritDamageBonus).toBeCloseTo(0.35, 10);
        expect(nineStackTarget.coldCritDamageBonus).toBeCloseTo(0.5, 10);
        expect(frozenTarget.coldCritDamageBonus).toBeCloseTo(1, 10);
        expect(areaTarget.coldCritDamageBonus).toBe(0);
        expect(overguardTarget.coldCritDamageBonus).toBeCloseTo(0.25, 10);
    });

    it("applies the three-stack Puncture cap to Overguarded VIP target profiles", () => {
        const weapon = { ...makeWeapon({ puncture: 100 }), statusChance: 1, fireRate: 1 };
        const ordinaryTarget = calculateBuild(weapon, []).modded;
        const overguardedVip = calculateBuild(weapon, [], "", { statusStackCaps: { puncture: 3 } }).modded;

        expect(ordinaryTarget.expectedStacksByType.puncture).toBe(5);
        expect(overguardedVip.expectedStacksByType.puncture).toBe(3);
        expect(ordinaryTarget.punctureEnemyDamageReduction).toBeCloseTo(0.8, 10);
        expect(overguardedVip.punctureEnemyDamageReduction).toBeCloseTo(0.6, 10);
        expect(ordinaryTarget.punctureCritChanceBonus).toBeCloseTo(0.25, 10);
        expect(overguardedVip.punctureCritChanceBonus).toBeCloseTo(0.15, 10);
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
        expect(direct.punctureEnemyDamageReduction).toBeCloseTo(0.8, 10);
        expect(direct.punctureCritChanceBonus).toBeCloseTo(0.25, 10);
        expect(area.expectedStacksByType.puncture).toBe(5);
        expect(area.punctureEnemyDamageReduction).toBeCloseTo(0.8, 10);
        expect(area.punctureCritChanceBonus).toBe(0);
    });

    it("keeps direct-hit per-status damage on Torid clouds attached to the struck target", () => {
        const torid = getWeaponCatalog().find((entry) => entry.name === "Torid");
        expect(torid).toBeDefined();
        const impactIndex = torid!.attacks.findIndex((attack) => attack.name === "Grenade Impact");
        expect(impactIndex).toBeGreaterThanOrEqual(0);
        const impactWeapon = withSelectedAttack(torid!, impactIndex);
        const perStatusEffect = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };

        const baseline = calculateBuild(impactWeapon, []).modded.attachedAttackDamageSequence;
        const modded = calculateBuild(impactWeapon, [perStatusEffect]).modded.attachedAttackDamageSequence;

        expect(baseline?.rule.componentAttackName).toBe("Poison Cloud");
        expect(modded?.profile.directDamagePerStatusBonus).toBeCloseTo(0.4, 10);
        expect(modded?.profile.steadyStateDamageByTypePerTick?.toxin).toBeGreaterThan(
            baseline?.profile.steadyStateDamageByTypePerTick?.toxin ?? 0,
        );
    });

    it("keeps Mausolon radial multishot fixed while Auto projectiles receive multishot mods", () => {
        const archwing = getWeaponCatalog().find((entry) =>
            entry.name === "Mausolon" && entry.variantLabel === "Archwing",
        );
        expect(archwing).toBeDefined();
        const autoIndex = archwing!.attacks.findIndex((attack) => attack.name === "Auto");
        const radialIndex = archwing!.attacks.findIndex((attack) => attack.name === "Auto Radial Attack");
        expect(autoIndex).toBeGreaterThanOrEqual(0);
        expect(radialIndex).toBeGreaterThanOrEqual(0);

        const dualRounds = getModsForWeapon(archwing!).find((mod) => mod.name === "Dual Rounds");
        expect(dualRounds).toBeDefined();
        const dualRoundsEffect = dualRounds!.effectsByRank[dualRounds!.fusionLimit] ?? dualRounds!.effect;
        const auto = withSelectedAttack(archwing!, autoIndex);
        const radial = withSelectedAttack(archwing!, radialIndex);
        const baseAuto = calculateBuild(auto, []).modded;
        const moddedAuto = calculateBuild(auto, [dualRoundsEffect]).modded;
        const baseRadial = calculateBuild(radial, []).modded;
        const moddedRadial = calculateBuild(radial, [dualRoundsEffect]).modded;

        expect(moddedAuto.multishot).toBeGreaterThan(baseAuto.multishot);
        expect(moddedAuto.attachedAttackDamageSequence?.rule.componentAttackName).toBe("Auto Radial Attack");
        expect(moddedAuto.attachedAttackDamageSequence?.profile.expectedProjectiles).toBeCloseTo(1, 10);
        expect(moddedAuto.attachedAttackDamageSequence?.profile.expectedDamageMultiplier).toBeCloseTo(1, 10);
        expect(moddedRadial.multishot).toBeCloseTo(baseRadial.multishot, 10);
        expect(moddedRadial.damageWeightedMultishot).toBeCloseTo(baseRadial.damageWeightedMultishot, 10);
    });

    it("caps the displayed Impact Mercy threshold bonus at five expected stacks", () => {
        const stats = calculateBuild({
            ...makeWeapon({ impact: 100 }),
            statusChance: 1,
            fireRate: 1,
        }, []).modded;

        expect(stats.expectedStacksByType.impact).toBe(5);
        expect(stats.impactMercyThresholdBonus).toBeCloseTo(0.4, 10);
    });

    it("classifies Wiki-confirmed radial attacks without mislabeling direct grenade impacts", () => {
        const expectAreaAttack = (weaponName: string, attackName: string, isAreaDamage: boolean | undefined) => {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === weaponName);
            expect(weapon).toBeDefined();
            const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
            expect(attackIndex).toBeGreaterThanOrEqual(0);
            expect(weapon!.attacks[attackIndex].isAreaDamage).toBe(isAreaDamage);
            expect(withSelectedAttack(weapon!, attackIndex).selectedAttackIsAreaDamage).toBe(isAreaDamage);
        };

        const unclassifiedNamedAttacks = getWeaponCatalog().flatMap((weapon) =>
            weapon.attacks
                .filter((attack) => attack.name.toLowerCase() !== "normal attack" && attack.isAreaDamage === undefined)
                .map((attack) => `${weapon.name}: ${attack.name}`),
        );
        expect(unclassifiedNamedAttacks).toEqual([]);

        const normalMeleeAttacks = getWeaponCatalog().flatMap((weapon) =>
            weapon.attacks
                .filter((attack) => attack.name.toLowerCase() === "normal attack")
                .filter(() => weapon.category === "Melee" || weapon.category === "Arch-Melee")
                .map((attack) => ({ weapon, attack })),
        );
        expect(normalMeleeAttacks.length).toBeGreaterThan(0);
        expect(normalMeleeAttacks.every(({ attack }) => typeof attack.isAreaDamage === "boolean")).toBe(true);

        const unclassifiedAttacks = getWeaponCatalog().flatMap((weapon) =>
            weapon.attacks
                .filter((attack) => attack.isAreaDamage === undefined)
                .map((attack) => `${weapon.name}: ${attack.name}`),
        );
        expect(unclassifiedAttacks).toEqual([]);

        // Ordinary melee strikes remain direct even when their hitbox cleaves
        // through multiple targets; explicit AoE source markers still win.
        expectAreaAttack("Broken War", "Normal Attack", false);
        expectAreaAttack("Agkuza", "Normal Attack", false);

        // Hound weapons only use standard melee attacks and their direct
        // contact rows are confirmed individually on the current Wiki pages.
        expectAreaAttack("Akaten", "Normal Attack", false);
        expectAreaAttack("Batoten", "Normal Attack", false);
        expectAreaAttack("Lacerten", "Normal Attack", false);

        // Wiki-verified fallbacks: these source rows omit shot_type.
        // https://wiki.warframe.com/w/Komorex
        // https://wiki.warframe.com/w/Verdilac
        expectAreaAttack("Komorex", "Normal Attack", false);
        expectAreaAttack("Komorex", "3.5x Zoom Radial Attack", true);
        expectAreaAttack("Verdilac", "Energy Wave", false);
        expectAreaAttack("Verdilac", "Energy Wave Explosion", true);

        // Current Wiki pages describe the Alternox pulse as damage to nearby
        // enemies within 6 m; its initial contact remains a separate direct hit.
        // https://wiki.warframe.com/w/Alternox
        // https://wiki.warframe.com/w/Alternox_Prime
        expectAreaAttack("Alternox", "Alt-Fire Contact", false);
        expectAreaAttack("Alternox", "Alt-Fire Damage over Time", true);
        expectAreaAttack("Alternox Prime", "Alt-Fire Damage over Time", true);

        // Azima's deployed magazine turret detonates in a small radius when
        // its ammunition expires; ordinary turret bullets remain direct hits.
        // https://wiki.warframe.com/w/Azima
        expectAreaAttack("Azima", "Normal Attack", false);
        expectAreaAttack("Azima", "Turret Expiry", true);

        // The current Wiki descriptions confirm these untagged named rows are
        // direct contact/projectile hits; they are not radial damage events.
        // https://wiki.warframe.com/w/Hind
        // https://wiki.warframe.com/w/Morgha
        // https://wiki.warframe.com/w/Nepheri
        // https://wiki.warframe.com/w/Orvius
        // https://wiki.warframe.com/w/Pandero_Prime
        // https://wiki.warframe.com/w/Paracyst
        // https://wiki.warframe.com/w/Shattered_Lash_%28Weapon%29
        // https://wiki.warframe.com/w/Telos_Boltace
        expectAreaAttack("Hind", "Semi-Auto Mode", false);
        expectAreaAttack("Morgha", "Charged Shot", false);
        expectAreaAttack("Nepheri", "Fireballs", false);
        expectAreaAttack("Orvius", "Hover Attack", false);
        expectAreaAttack("Pandero Prime", "Alt-Fire", false);
        expectAreaAttack("Paracyst", "Infested Harpoon Contact", false);
        expectAreaAttack("Shattered Lash", "Damage", false);
        expectAreaAttack("Shattered Lash", "Arcing Damage", false);
        expectAreaAttack("Shattered Lash Prime", "Damage", false);
        expectAreaAttack("Shattered Lash Prime", "Arcing Damage", false);
        expectAreaAttack("Telos Boltace", "Stormpath Slide Attack", false);

        // Zaw strike components are direct melee attacks. The compatibility
        // records also contain Conclave-only duplicates, so check every row.
        // https://wiki.warframe.com/w/Zaw
        for (const [weaponName, attackName] of [
            ["Balla", "Balla Strike"],
            ["Cyath", "Cyath Strike"],
            ["Dehtat", "Dehtat Strike"],
            ["Dokrahm", "Dokrahm Strike"],
            ["Kronsh", "Kronsh Strike"],
            ["Mewan", "Mewan Strike"],
            ["Ooltha", "Ooltha Strike"],
            ["Plague Keewar", "Plague Keewar Strike"],
            ["Plague Kripath", "Plague Kripath Strike"],
            ["Rabvee", "Rabvee Strike"],
            ["Sepfahn", "Sepfahn Strike"],
        ]) {
            const weaponRows = getWeaponCatalog().filter((weapon) => weapon.name === weaponName);
            expect(weaponRows.length).toBeGreaterThan(0);
            for (const weapon of weaponRows) {
                const attackIndex = weapon.attacks.findIndex((attack) => attack.name === attackName);
                expect(attackIndex).toBeGreaterThanOrEqual(0);
                expect(weapon.attacks[attackIndex].isAreaDamage).toBe(false);
                expect(withSelectedAttack(weapon, attackIndex).selectedAttackIsAreaDamage).toBe(false);
            }
        }

        // Shooting a Quanta cube triggers a 6 m radial explosion, separate
        // from the cube's direct contact and ordinary contact explosion rows.
        // https://wiki.warframe.com/w/Quanta
        // https://wiki.warframe.com/w/Quanta_Vandal
        // https://wiki.warframe.com/w/Tenet_Quanta
        for (const weaponName of ["Quanta", "Quanta Vandal", "Tenet Quanta"]) {
            expectAreaAttack(weaponName, "Cube (direct hit)", false);
            expectAreaAttack(weaponName, "Cube (shot by player)", true);
        }

        // The Zenistar disc's 4 m aura is radial; disc contact is direct.
        // https://wiki.warframe.com/w/Zenistar
        expectAreaAttack("Zenistar", "Attacks While Disc Deployed", false);
        expectAreaAttack("Zenistar", "Disc Impact", false);
        expectAreaAttack("Zenistar", "Disc Aura", true);

        // These similarly named impacts are direct hits; their separate radial
        // attacks are already marked as AoE in the current source feed.
        expectAreaAttack("Cortege", "Grenade Impact", false);
        expectAreaAttack("Cortege", "Radial Attack", true);
        expectAreaAttack("Trumna", "Grenade Impact", false);
        expectAreaAttack("Trumna", "Auto AoE", true);
        expectAreaAttack("Trumna Prime", "Grenade Impact", false);
        expectAreaAttack("Trumna Prime", "Grenade Bounce AoE", true);
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

    it("orders innate weapon and progenitor elements in Wiki HCET order", () => {
        const hcet = ["heat", "cold", "electricity", "toxin"] as const;
        const combinedTypeByPair: Record<string, "blast" | "radiation" | "gas" | "magnetic" | "viral" | "corrosive"> = {
            "heat+cold": "blast", "cold+heat": "blast",
            "heat+electricity": "radiation", "electricity+heat": "radiation",
            "heat+toxin": "gas", "toxin+heat": "gas",
            "cold+electricity": "magnetic", "electricity+cold": "magnetic",
            "cold+toxin": "viral", "toxin+cold": "viral",
            "electricity+toxin": "corrosive", "toxin+electricity": "corrosive",
        };
        const elementalEffect = (element: typeof hcet[number]) => {
            const effect = emptyEffect();
            if (element === "heat") effect.heatBonus = 1;
            else if (element === "cold") effect.coldBonus = 1;
            else if (element === "electricity") effect.electricityBonus = 1;
            else effect.toxinBonus = 1;
            return effect;
        };

        for (let firstIndex = 0; firstIndex < hcet.length; firstIndex += 1) {
            for (let secondIndex = firstIndex + 1; secondIndex < hcet.length; secondIndex += 1) {
                const firstInnate = hcet[firstIndex];
                const secondInnate = hcet[secondIndex];
                const slottedElement = hcet.find((element) => element !== firstInnate && element !== secondInnate)!;
                const damage: Partial<WeaponEntry["damage"]> = { impact: 112 };
                damage[firstInnate] = 8;
                damage[secondInnate] = 8;

                // A progenitor weapon's two innate primary types follow all
                // slotted elements; the HCET-first one is encountered first.
                const result = calculateBuild(makeWeapon(damage), [elementalEffect(slottedElement)]).modded.damageBreakdown;
                const expectedCombinedType = combinedTypeByPair[`${slottedElement}+${firstInnate}`];
                expect(expectedCombinedType, `${slottedElement} + ${firstInnate}`).toBeDefined();
                expect(result[expectedCombinedType]).toBeCloseTo(136, 12);
                expect(result[secondInnate]).toBeCloseTo(8, 12);
            }
        }

        // Tenet Cycron has innate Heat. Its selected Toxin progenitor damage
        // follows Heat in HCET, so a slotted Cold element combines with Heat
        // as Blast and leaves Toxin independent.
        const tenetCycron = getWeaponCatalog().find((weapon) => weapon.name === "Tenet Cycron");
        expect(tenetCycron).toMatchObject({ isProgenitorWeapon: true });
        expect(tenetCycron!.damage.heat).toBeGreaterThan(0);
        const progenitorToxin = tenetCycron!.damage.total * 0.4;
        const valencedTenetCycron = {
            ...tenetCycron!,
            damage: {
                ...tenetCycron!.damage,
                toxin: tenetCycron!.damage.toxin + progenitorToxin,
                total: tenetCycron!.damage.total + progenitorToxin,
            },
        };
        const tenetResult = calculateBuild(valencedTenetCycron, [elementalEffect("cold")]).modded.damageBreakdown;
        expect(tenetResult.blast).toBeGreaterThan(0);
        expect(tenetResult.toxin).toBeGreaterThan(0);
        expect(tenetResult.viral).toBe(0);
        expect(tenetResult.heat).toBe(0);
    });

    it("keeps Dera Incarnon's Wiki-listed Magnetic damage separate from slotted combinations", () => {
        const dera = getWeaponCatalog().find((weapon) => weapon.name === "Dera Vandal");
        expect(dera).toBeDefined();
        const incarnonIndex = dera!.attacks.findIndex((attack) => attack.name === "Incarnon Form");
        expect(incarnonIndex).toBeGreaterThanOrEqual(0);

        const incarnon = withSelectedAttack(dera!, incarnonIndex);
        expect(incarnon.selectedAttackIsIncarnon).toBe(true);
        expect(incarnon.damage.magnetic).toBeGreaterThan(0);

        const coldMod = { ...emptyEffect(), coldBonus: 1 };
        const toxinMod = { ...emptyEffect(), toxinBonus: 1 };
        const unmodded = calculateBuild(incarnon, []).modded.damageBreakdown;
        const result = calculateBuild(incarnon, [coldMod, toxinMod]).modded.damageBreakdown;
        expect(result.viral).toBeGreaterThan(0);
        expect(result.magnetic).toBeCloseTo(unmodded.magnetic, 12);
        expect(result.cold).toBe(0);
        expect(result.toxin).toBe(0);
    });

    it("applies Riven elemental stats bottom-up when they follow another elemental mod", () => {
        const riven = makeRivenEffect([
            { stat: "electricityDamage", value: 90 },
            { stat: "toxinDamage", value: 90 },
        ]);
        const coldMod = { ...emptyEffect(), coldBonus: 0.9 };

        const result = calculateBuild(makeWeapon({ impact: 100 }), [coldMod, riven]).modded.damageBreakdown;

        expect(result.viral).toBeGreaterThan(0);
        expect(result.electricity).toBeGreaterThan(0);
        expect(result.magnetic).toBe(0);
        expect(result.corrosive).toBe(0);
    });

    it("lets a later element mod combine with the first displayed element on a three-element Riven", () => {
        const riven = makeRivenEffect([
            { stat: "heatDamage", value: 90 },
            { stat: "coldDamage", value: 90 },
            { stat: "toxinDamage", value: 90 },
        ]);
        const electricityMod = { ...emptyEffect(), electricityBonus: 0.9 };

        const result = calculateBuild(makeWeapon({ impact: 100 }), [riven, electricityMod]).modded.damageBreakdown;

        expect(result.viral).toBeGreaterThan(0);
        expect(result.radiation).toBeGreaterThan(0);
        expect(result.blast).toBe(0);
        expect(result.corrosive).toBe(0);
    });

    it("applies Wiki headshot, critical-headshot, bodyshot, and inherited DoT modifiers", () => {
        const hitLocation = {
            headshotRate: 0.25,
            headshotMultiplier: 3,
            criticalHeadshotMultiplier: 2,
            headshotMultiplierBonus: 0.6,
            bodyshotDamageBonus: -0.45,
        } as const;

        // A body hit averages 1.5x critical damage, then the 0.55 body factor.
        // A head hit uses 3x × (1 + 60%) and the 2x critical-headshot rule.
        expect(avgHitDamageMultiplier(0.5, 2, [], hitLocation)).toBeCloseTo(3.61875, 10);
        expect(avgHitDamageMultiplier(0.5, 2, [], { ...hitLocation, headshotRate: 0 })).toBeCloseTo(0.825, 10);
        expect(avgHitDamageMultiplier(0.5, 2, [], { ...hitLocation, headshotRate: 1 })).toBeCloseTo(12, 10);
        expect(avgHitDamageMultiplier(0.5, 2, [], { ...hitLocation, canHeadshot: false })).toBeCloseTo(0.825, 10);

        // Meticulous Aim applies its bodyshot penalty twice to Slash, but once
        // to Electricity; status seeds from a headshot inherit the headshot bonus.
        expect(getHitLocationDotDamageMultiplier(0.5, 2, { ...hitLocation, headshotRate: 0 }, "slash"))
            .toBeCloseTo(0.3025, 10);
        expect(getHitLocationDotDamageMultiplier(0.5, 2, { ...hitLocation, headshotRate: 0 }, "electricity"))
            .toBeCloseTo(0.55, 10);
        expect(getHitLocationDotDamageMultiplier(0.5, 2, { ...hitLocation, headshotRate: 1 }, "electricity"))
            .toBeCloseTo(8, 10);

        const targetHitLocation = {
            headshotRate: 0.25,
            headshotMultiplier: 3,
            criticalHeadshotMultiplier: 2,
        } as const;
        const hitLocationMod = {
            ...emptyEffect(),
            headshotMultiplierBonus: 0.6,
            bodyshotDamageBonus: -0.45,
        };
        const directWeapon = { ...makeWeapon({ slash: 100 }), critChance: 0.5, critMultiplier: 2 };
        const direct = calculateBuild(directWeapon, [hitLocationMod], "", { hitLocation: targetHitLocation }).modded;
        const radial = calculateBuild(
            { ...directWeapon, selectedAttackIsAreaDamage: true },
            [hitLocationMod],
            "",
            { hitLocation: targetHitLocation },
        ).modded;
        expect(direct.hitLocation.canHeadshot).toBe(true);
        expect(radial.hitLocation.canHeadshot).toBe(false);
        expect(radial.expectedHitDamageMultiplier).toBeCloseTo(
            0.55 * (1 + 0.5 * (radial.critMultiplier - 1)),
            10,
        );
    });

    it("uses the configured headshot share for on-headshot triggers and excludes radial hits", () => {
        const weapon = { ...makeWeapon({ impact: 100 }), critChance: 0.1, critMultiplier: 2 };
        const onHeadshot = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onHeadshot" as const,
                durationSeconds: 12,
                requiresAiming: false,
                maxStacks: 1,
                stats: { critChanceBonus: 1 },
            }],
        };
        const target = { headshotRate: 1, headshotMultiplier: 3, criticalHeadshotMultiplier: 2 };
        const bodyOnly = calculateBuild(weapon, [onHeadshot], "", {
            conditionalState: { mode: "realistic" },
            hitLocation: { ...target, headshotRate: 0 },
        }).modded;
        const headshots = calculateBuild(weapon, [onHeadshot], "", {
            conditionalState: { mode: "realistic" },
            hitLocation: target,
        }).modded;
        const radial = calculateBuild({ ...weapon, selectedAttackIsAreaDamage: true }, [onHeadshot], "", {
            conditionalState: { mode: "realistic" },
            hitLocation: target,
        }).modded;
        expect(bodyOnly.critChance).toBeCloseTo(0.1, 10);
        expect(headshots.critChance).toBeGreaterThan(0.199);
        expect(radial.critChance).toBeCloseTo(0.1, 10);
    });

    it("uses critical multiplier quantization before relative critical damage bonuses", () => {
        const weapon = { ...makeWeapon({ impact: 100 }), critChance: 1, critMultiplier: 2 };
        const result = calculateBuild(weapon, [{ ...emptyEffect(), critMultBonus: 1 }]).modded;

        expect(result.quantizedBaseCritMultiplier).toBeCloseTo(256 * 32 / 4095, 6);
        expect(result.critMultiplier).toBeCloseTo((256 * 32 / 4095) * 2, 6);
        expect(result.averageShotDamage).toBeCloseTo(100 * result.critMultiplier, 6);
    });

    it("weights Devouring Attrition by its chance on noncritical hits", () => {
        const weapon = { ...makeWeapon({ impact: 100 }), critChance: 0.12, critMultiplier: 2.2 };
        const effect = {
            ...emptyEffect(),
            nonCriticalHitDamageProcs: [{ chance: 0.5, damageBonus: 20 }],
        };
        const stats = calculateBuild(weapon, [effect]).modded;

        expect(avgHitDamageMultiplier(0.12, 2.2, effect.nonCriticalHitDamageProcs)).toBeCloseTo(9.944, 8);
        expect(stats.averageShotDamage).toBeCloseTo(
            stats.totalDamage * stats.damageWeightedMultishot * avgHitDamageMultiplier(
                stats.critChance,
                stats.critMultiplier,
                stats.nonCriticalHitDamageProcs,
            ),
            8,
        );
        expect(avgHitDamageMultiplier(1.5, 2, effect.nonCriticalHitDamageProcs)).toBeCloseTo(2.5, 8);
    });

    it("estimates Overwhelming Attrition from qualifying multishot groups and incremental stack decay", () => {
        const qualifyingGroupChance = estimateNonCriticalNoStatusHitGroupProbability(0.12, 0.924, 3.9);
        const perProjectileChance = (1 - 0.12) * (1 - 0.924);
        expect(qualifyingGroupChance).toBeCloseTo(
            perProjectileChance ** 3 * (0.1 + 0.9 * perProjectileChance),
            12,
        );
        expect(estimateNonCriticalNoStatusHitGroupProbability(1, 0, 1)).toBe(0);
        expect(estimateNonCriticalNoStatusHitGroupProbability(0, 1, 1)).toBe(0);
        expect(estimateNonCriticalNoStatusHitGroupProbability(0, 0, 0.5)).toBe(0.5);

        const conditional = {
            trigger: "onNonCriticalNoStatusHit" as const,
            durationSeconds: 10,
            requiresAiming: false,
            maxStacks: 3,
            stats: { damageBonus: 4 },
        };
        const slowQualifyingGroups = estimateConditionalStackFactor(
            conditional,
            7.75,
            12,
            { mode: "realistic" },
            { qualifyingHitGroupProbability: qualifyingGroupChance },
        );
        const oneEligibleGroupPerSecond = estimateConditionalStackFactor(
            conditional,
            0.1,
            12,
            { mode: "realistic" },
            { qualifyingHitGroupProbability: 1 },
        );
        expect(slowQualifyingGroups).toBeGreaterThan(0);
        expect(slowQualifyingGroups).toBeLessThan(0.1);
        expect(oneEligibleGroupPerSecond).toBeCloseTo(2.126, 2);

        const weapon = { ...makeWeapon({ impact: 100 }), critChance: 0, statusChance: 0, fireRate: 0.1 };
        const effect = { ...emptyEffect(), conditionalEffects: [conditional] };
        const initial = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "initial" } }).modded;
        const realistic = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "realistic" } }).modded;
        const fullyStacked = calculateBuild(weapon, [effect], "", { conditionalState: { mode: "fullyStacked" } }).modded;
        expect(initial.totalDamageBonus).toBe(0);
        expect(realistic.totalDamageBonus).toBeCloseTo(oneEligibleGroupPerSecond * 4, 2);
        expect(fullyStacked.totalDamageBonus).toBe(12);

        const finiteEncounter = calculateBuildForExpectedEncounter(weapon, [effect], "", {
            conditionalState: { mode: "realistic" },
        }).modded;
        expect(finiteEncounter.totalDamageBonus).toBe(0);
        expect(finiteEncounter.timedConditionalDamageStacks[0]).toMatchObject({
            trigger: "onNonCriticalNoStatusHit",
            durationSeconds: 10,
            maxStacks: 3,
            damageBonusPerStack: 4,
            initialStacks: 0,
        });
        expect(finiteEncounter.timedConditionalDamageStacks[0].steadyStateStacks).toBeCloseTo(oneEligibleGroupPerSecond, 2);

        const impactOnly = { ...makeWeapon({ impact: 100 }), critChance: 0, statusChance: 1, fireRate: 1 };
        expect(calculateBuild(impactOnly, [effect]).modded.totalDamageBonus).toBe(0);
        expect(calculateBuild(impactOnly, [effect], "", { statusImmuneTypes: ["impact"] }).modded.totalDamageBonus)
            .toBeCloseTo(12, 3);
    });

    it("matches the current Wiki worked example for modded Heat proc tick damage", () => {
        const weapon = { ...makeWeapon({ heat: 100 }), statusChance: 1, critChance: 0 };
        const result = calculateBuild(weapon, [
            { ...emptyEffect(), damageBonus: 1.65 },
            { ...emptyEffect(), heatBonus: 0.9 },
            { ...emptyEffect(), factionDamageBonus: 0.3, targetFaction: "Grineer" },
            { ...emptyEffect(), statusDamageBonus: 0.9 },
        ], "Grineer").modded;

        // Wiki example: 100 × 2.65 × 1.3 = 344.5 modded base damage, then
        // 0.5 × 344.5 × 1.9 Heat × 1.3 faction × 1.9 Status Damage.
        expect(result.dotTickDamagePerProcByType.heat).toBeCloseTo(808.3692, 4);
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

    it("matches the Wiki Slash DoT formula with crit, faction, and Status Damage", () => {
        const weapon = {
            ...makeWeapon({ slash: 40 }),
            statusChance: 1,
            critChance: 0.5,
            critMultiplier: 2,
        };
        const baneAndStatusDamage = {
            ...emptyEffect(),
            factionDamageBonus: 0.5,
            targetFaction: "Grineer",
            statusDamageBonus: 1,
        };
        const result = calculateBuild(weapon, [baneAndStatusDamage], "Grineer").modded;

        // Independently evaluate the Wiki formulas: the base 2.0x critical
        // multiplier encodes to round(2 × 4095 / 32) = 256 and decodes to
        // 256 × 32 / 4095; the average crit factor follows Critical Hit.
        // Damage/Calculation then applies faction to the seed and again to the
        // status tick, plus the per-tick +1 accumulator and 35% Slash factor.
        const criticalCode = Math.floor((2 * 4095) / 32 + 0.5);
        const decodedCriticalMultiplier = criticalCode * (32 / 4095);
        const averageCriticalMultiplier = 1 + 0.5 * (decodedCriticalMultiplier - 1);
        const seededDamage = 40 * averageCriticalMultiplier * 1.5;
        const wikiTickMultiplier = 0.35 * 2 * 1.5;
        const wikiSeedTick = seededDamage * wikiTickMultiplier;
        const wikiSixTickDamage = (seededDamage + 1) * wikiTickMultiplier * 6;

        expect(result.dotTickDamagePerProcByType.slash).toBeCloseTo(wikiSeedTick, 3);
        expect(result.dotDamagePerShotByType.slash).toBeCloseTo(wikiSixTickDamage, 3);
        expect(result.dotDpsByType.slash).toBeCloseTo(wikiSixTickDamage, 3);
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

    it("caps Semi-Auto effective fire rate at 10 trigger pulls per second", () => {
        const weapon: WeaponEntry = {
            ...makeWeapon({ impact: 100 }),
            trigger: "Semi",
            fireRate: 8,
        };
        const noBonus = calculateBuild(weapon, []).modded.fireRate;
        const twentyFivePercentBonus = calculateBuild(weapon, [{ ...emptyEffect(), fireRateBonus: 0.25 }]).modded.fireRate;
        const oneHundredPercentBonus = calculateBuild(weapon, [{ ...emptyEffect(), fireRateBonus: 1 }]).modded.fireRate;
        const negativeFiftyPercentBonus = calculateBuild(weapon, [{ ...emptyEffect(), fireRateBonus: -0.5 }]).modded.fireRate;
        const wikiNameVariant = calculateBuild({ ...weapon, trigger: "Semi-Auto" }, [{ ...emptyEffect(), fireRateBonus: 1 }]).modded.fireRate;

        expect(noBonus).toBe(8);
        expect(twentyFivePercentBonus).toBe(10);
        expect(oneHundredPercentBonus).toBe(10);
        expect(negativeFiftyPercentBonus).toBe(4);
        expect(wikiNameVariant).toBe(10);
    });

    it.each(["Auto", "Duplex", "Held"])("keeps %s fire rate linearly modded without the Semi cap", (trigger) => {
        const weapon: WeaponEntry = {
            ...makeWeapon({ impact: 100 }),
            trigger,
            fireRate: 8,
        };

        expect(calculateBuild(weapon, [{ ...emptyEffect(), fireRateBonus: 0.5 }]).modded.fireRate).toBe(12);
    });

    it("parses Cannonade locks on every rank and only exposes them to compatible Semi-Auto weapons", () => {
        const eligibleWeaponNames = ["Rubico Prime", "Lex Prime", "Hek"];
        const cannonadeNames = ["Semi-Rifle Cannonade", "Semi-Pistol Cannonade", "Semi-Shotgun Cannonade"];

        for (let index = 0; index < eligibleWeaponNames.length; index++) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === eligibleWeaponNames[index]);
            expect(weapon).toBeDefined();
            const cannonade = getModsForWeapon(weapon!).find((candidate) => candidate.name === cannonadeNames[index]);
            expect(cannonade).toBeDefined();
            expect(cannonade!.effectsByRank.map((effect) => effect.fireRateLocked)).toEqual(
                Array(cannonade!.fusionLimit + 1).fill(true),
            );
        }

        const automaticWeapon = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime");
        expect(automaticWeapon).toBeDefined();
        expect(getModsForWeapon(automaticWeapon!).some((candidate) => candidate.name.endsWith("Cannonade"))).toBe(false);
    });

    it("ignores positive, negative, and conditional Fire Rate bonuses while Cannonade locks the stat", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Rubico Prime");
        expect(weapon).toBeDefined();
        const cannonade = getModsForWeapon(weapon!).find((candidate) => candidate.name === "Semi-Rifle Cannonade");
        expect(cannonade).toBeDefined();
        const cannonadeMaxRank = cannonade!.effectsByRank[cannonade!.fusionLimit]!;
        const baseFireRate = calculateBuild(weapon!, []).modded.fireRate;
        const conditionalFireRateMod = {
            ...emptyEffect(),
            conditionalEffects: [{
                trigger: "onKill" as const,
                durationSeconds: 20,
                requiresAiming: false,
                maxStacks: 1,
                stats: { fireRateBonus: 1 },
            }],
        };

        for (const fireRateBonus of [1, -0.5]) {
            const result = calculateBuild(weapon!, [cannonadeMaxRank, { ...emptyEffect(), fireRateBonus }]).modded;
            expect(result.fireRateLocked).toBe(true);
            expect(result.fireRate).toBeCloseTo(baseFireRate, 10);
        }

        const fullyStacked = calculateBuild(weapon!, [cannonadeMaxRank, conditionalFireRateMod], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;
        expect(fullyStacked.fireRateLocked).toBe(true);
        expect(fullyStacked.fireRate).toBeCloseTo(baseFireRate, 10);
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

    it("excludes direct-hit per-status mod and passive bonuses from source-marked AoE rows", () => {
        const baseWeapon = {
            ...makeWeapon({ viral: 100, heat: 100 }),
            statusChance: 1,
            fireRate: 10,
        };
        const perStatusEffects = [
            { ...emptyEffect(), directDamagePerStatusBonus: 0.4 },
            {
                ...emptyEffect(),
                conditionalEffects: [{
                    trigger: "onKill" as const,
                    durationSeconds: 20,
                    requiresAiming: false,
                    maxStacks: 1,
                    stats: { directDamagePerStatusBonus: 0.4 },
                }],
            },
        ];
        const fullyStacked = { conditionalState: { mode: "fullyStacked" as const } };
        const direct = calculateBuild({
            ...baseWeapon,
            selectedAttackIsAreaDamage: false,
            intrinsicDamagePerStatusBonus: 0.6,
        }, perStatusEffects, "", fullyStacked).modded;
        const unclassified = calculateBuild({
            ...baseWeapon,
            intrinsicDamagePerStatusBonus: 0.6,
        }, perStatusEffects, "", fullyStacked).modded;
        const area = calculateBuild({
            ...baseWeapon,
            selectedAttackIsAreaDamage: true,
            intrinsicDamagePerStatusBonus: 0.6,
        }, perStatusEffects, "", fullyStacked).modded;
        const areaWithoutBonus = calculateBuild({
            ...baseWeapon,
            selectedAttackIsAreaDamage: true,
        }, [], "", fullyStacked).modded;

        expect(direct.directDamagePerStatusBonus).toBeCloseTo(0.8, 12);
        expect(direct.intrinsicDamagePerStatusBonus).toBe(0.6);
        expect(direct.directDamagePerStatusMultiplier).toBeGreaterThan(1);
        expect(unclassified.directDamagePerStatusMultiplier).toBe(direct.directDamagePerStatusMultiplier);
        expect(area.directDamagePerStatusBonus).toBe(0);
        expect(area.intrinsicDamagePerStatusBonus).toBe(0);
        expect(area.directDamagePerStatusMultiplier).toBe(1);
        expect(area.damageBreakdown).toEqual(areaWithoutBonus.damageBreakdown);
        expect(area.totalDamage).toBe(areaWithoutBonus.totalDamage);
    });

    it("adds Condition Overload to the melee base bracket and leaves a clean target unamplified", () => {
        const melee = {
            ...makeWeapon({ impact: 100, heat: 100 }),
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee" as const,
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

    it("uses named external types for CO and direct per-status bonuses with Tau eligibility separated", () => {
        const melee = {
            ...makeWeapon({ impact: 100 }),
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee" as const,
            statusChance: 0,
        };
        const overload = { ...emptyEffect(), conditionOverloadDamagePerStatusBonus: 0.8 };
        const direct = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };
        const result = calculateBuild(melee, [overload, direct], "", {
            targetStatusState: "initial",
            conditionalState: {
                mode: "initial",
                externalStatusTypes: ["viral", "tau", "lifted", "knockdown"],
            },
        }).modded;

        // Lifted and Knockdown are mutually exclusive: the last selected state
        // remains active. Tau counts for Condition Overload but not direct Galvanized bonuses.
        expect(result.conditionOverloadStatusTypes).toBe(3);
        expect(result.directDamageStatusTypes).toBe(2);
        expect(result.intrinsicDamageStatusTypes).toBe(3);
        expect(result.conditionOverloadDamageMultiplier).toBeCloseTo(3.4, 12);
        expect(result.directDamagePerStatusMultiplier).toBeCloseTo(1 + 0.8 / 3.4, 12);
    });

    it("counts Tau for a Cedo-style intrinsic unique-status passive but not Galvanized", () => {
        const weapon = {
            ...makeWeapon({ impact: 100 }),
            intrinsicDamagePerStatusBonus: 0.6,
            intrinsicDamagePerStatusMode: "additiveBase" as const,
        };
        const direct = { ...emptyEffect(), directDamagePerStatusBonus: 0.4 };
        const result = calculateBuild(weapon, [direct], "", {
            targetStatusState: "initial",
            conditionalState: { mode: "initial", externalStatusTypes: ["tau"] },
        }).modded;

        expect(result.directDamageStatusTypes).toBe(0);
        expect(result.intrinsicDamageStatusTypes).toBe(1);
        expect(result.directDamagePerStatusMultiplier).toBeCloseTo(1.6, 12);
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

    it("includes one selected external Tau stack in steady-state Status Chance", () => {
        const weapon = { ...makeWeapon({ impact: 100 }), statusChance: 1, fireRate: 1 };
        const result = calculateBuild(weapon, [], "", {
            conditionalState: { mode: "initial", externalStatusTypes: ["tau"] },
        }).modded;

        expect(result.tauStatusVulnerability).toBeCloseTo(0.1, 12);
        expect(result.procRatePerSecondByType.impact).toBeCloseTo(1.1, 12);
        expect(result.averageProcsPerShot).toBeCloseTo(1.1, 12);
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

    it("reuses read-only immunity sets without changing their contents", () => {
        const weapon = makeWeapon({ impact: 10, slash: 30 });
        const immunitySet = new Set(["impact"] as const);
        const fromSet = calculateBuild(weapon, [], "", { statusImmuneTypes: immunitySet }).modded;
        const fromIterable = calculateBuild(weapon, [], "", { statusImmuneTypes: ["impact"] }).modded;

        expect(fromSet).toEqual(fromIterable);
        expect(immunitySet).toEqual(new Set(["impact"]));
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

    it("uses Wiki single-pellet and fully-spooled multishot for the Kohm family", () => {
        const expectedByWeapon = [
            ["Kohm", 12],
            ["Kuva Kohm", 12],
            ["Kohmak", 5],
            ["Twin Kohmak", 5],
        ] as const;

        for (const [weaponName, fullySpooledMultishot] of expectedByWeapon) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();

            for (const [attackName, multishot] of [["Single Pellet", 1], ["Fully Spooled", fullySpooledMultishot]] as const) {
                const attackIndex = weapon!.attacks.findIndex((attack) => attack.name === attackName);
                expect(attackIndex, `${weaponName} / ${attackName}`).toBeGreaterThanOrEqual(0);
                const selected = withSelectedAttack(weapon!, attackIndex);

                expect(selected.multishot, `${weaponName} / ${attackName} selected`).toBe(multishot);
                expect(calculateBuild(selected, []).modded.multishot, `${weaponName} / ${attackName} calculated`)
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
        expect(quick.modded.initialAttackDelaySeconds).toBe(0);
        expect(quick.modded.magazineDutyCycle).toBe(1);
        expect(quick.burstDPS).toBeCloseTo(quick.modded.averageShotDamage / 0.6, 8);
        expect(quick.sustainedDPS).toBeCloseTo(quick.burstDPS, 8);

        expect(charged.modded.fireRate).toBeCloseTo(1 / (1 + 0.6), 8);
        expect(charged.modded.burstFireRate).toBeCloseTo(1, 8);
        expect(charged.modded.initialAttackDelaySeconds).toBeCloseTo(1, 8);
        expect(charged.burstDPS).toBeCloseTo(charged.modded.averageShotDamage, 8);
        expect(charged.sustainedDPS).toBeCloseTo(charged.modded.averageShotDamage / 1.6, 8);

        expect(perfect.modded.fireRate).toBeCloseTo(1 / (0.7 + 0.6), 8);
        expect(perfect.modded.burstFireRate).toBeCloseTo(1 / 0.7, 8);
        expect(perfect.modded.initialAttackDelaySeconds).toBeCloseTo(0.7, 8);
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
        expect(fasterCharge.initialAttackDelaySeconds).toBeCloseTo(0.7 / 1.5, 8);

        expect(fasterReload.reloadTime).toBeCloseTo(0.3, 12);
        expect(fasterReload.fireRate).toBeCloseTo(1 / (0.7 + 0.3), 8);
        expect(fasterReload.burstFireRate).toBeCloseTo(1 / 0.7, 8);
        expect(fasterReload.initialAttackDelaySeconds).toBeCloseTo(0.7, 8);
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
        expect(result.modded.initialAttackDelaySeconds).toBe(1);
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
            modCompat: "Melee" as const,
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

    it("applies Galvanized Reflex melee-kill stacks as Initial Combo", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Broken War");
        expect(weapon).toBeDefined();
        const galvanizedReflex = getModsForWeapon(weapon!).find((entry) => entry.name === "Galvanized Reflex");
        expect(galvanizedReflex).toBeDefined();
        const effect = galvanizedReflex!.effectsByRank[galvanizedReflex!.fusionLimit];
        expect(effect.heavyAttackEfficiencyBonus).toBeCloseTo(0.5, 10);
        expect(effect.conditionalEffects).toContainEqual(expect.objectContaining({
            trigger: "onMeleeKill",
            durationSeconds: 20,
            maxStacks: 4,
            stats: { initialComboBonus: 20 },
        }));

        const heavyAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");
        expect(heavyAttackIndex).toBeGreaterThanOrEqual(0);
        const heavyAttack = withSelectedAttack(weapon!, heavyAttackIndex);
        const initial = calculateBuild(heavyAttack, [effect], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const customTwoStacks = calculateBuild(heavyAttack, [effect], "", {
            conditionalState: { mode: "custom", externalStacks: 2 },
        }).modded;
        const realistic = calculateBuild(heavyAttack, [effect], "", {
            conditionalState: { mode: "realistic" },
        }).modded;
        const fullyStacked = calculateBuild(heavyAttack, [effect], "", {
            conditionalState: { mode: "fullyStacked" },
        }).modded;

        expect(initial.meleeComboPointsBeforeHeavyAttack).toBe(0);
        expect(customTwoStacks.meleeComboPointsBeforeHeavyAttack).toBe(40);
        expect(customTwoStacks.meleeComboMultiplier).toBe(3);
        expect(realistic.meleeComboPointsBeforeHeavyAttack).toBeCloseTo(33.6, 8);
        expect(fullyStacked.meleeComboPointsBeforeHeavyAttack).toBe(80);
        expect(fullyStacked.meleeComboMultiplier).toBe(5);
        expect(fullyStacked.heavyAttackEfficiency).toBeCloseTo(0.5, 10);
        expect(fullyStacked.baseDamageTotal).toBeCloseTo(initial.baseDamageTotal * 5, 8);
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

    it("parses Killing Blow's additive damage bonus only for selected heavy attacks", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name === "Broken War");
        expect(weapon).toBeDefined();
        const killingBlow = getModsForWeapon(weapon!).find((entry) => entry.name === "Killing Blow");
        expect(killingBlow).toBeDefined();
        expect(killingBlow!.effect.heavyAttackDamageBonus).toBeCloseTo(1.2, 10);
        expect(getUnmodeledDamageEffectLines(killingBlow!, killingBlow!.fusionLimit)).toEqual([]);

        const normalAttack = withSelectedAttack(
            weapon!,
            weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
        );
        const heavySlamAttack = withSelectedAttack(
            weapon!,
            weapon!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack"),
        );
        const totalDamage = (selectedWeapon: WeaponEntry, effects: ModEffect[]) =>
            Object.values(calculateBuild(selectedWeapon, effects).modded.damageBreakdown)
                .reduce((sum, amount) => sum + amount, 0);
        const normalBase = totalDamage(normalAttack, []);
        const normalWithMod = totalDamage(normalAttack, [killingBlow!.effect]);
        const heavyBase = totalDamage(heavySlamAttack, []);
        const heavyWithMod = totalDamage(heavySlamAttack, [killingBlow!.effect]);

        expect(normalWithMod).toBeCloseTo(normalBase, 10);
        expect(heavyWithMod).toBeCloseTo(heavyBase * 2.2, 10);
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

    it("applies Amanata Pressure's random status roll to heavy attacks at 8x combo", () => {
        const amanata = getWeaponCatalog().find((weapon) => weapon.name === "Amanata");
        expect(amanata).toBeDefined();
        const pressure = getModsForWeapon(amanata!).find((mod) => mod.name === "Amanata Pressure");
        expect(pressure).toBeDefined();
        expect(pressure!.effect.damageBonus).toBeCloseTo(3.3, 10);
        for (const incompatibleName of ["Pressure Point", "Primed Pressure Point", "Sacrificial Pressure"]) {
            const incompatible = getModsForWeapon(amanata!).find((mod) => mod.name === incompatibleName);
            expect(incompatible, incompatibleName).toBeDefined();
            expect(pressure!.incompatibilityGroup).toBe(incompatible!.incompatibilityGroup);
        }

        const heavySlam = withSelectedAttack(
            amanata!,
            amanata!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack"),
        );
        const normalAttack = withSelectedAttack(
            amanata!,
            amanata!.attacks.findIndex((attack) => attack.name === "Normal Attack"),
        );
        const statusTypes = STATUS_DAMAGE_TYPES.filter((type) => type !== "void" && type !== "tau");
        expect(statusTypes).toHaveLength(13);

        const comboState = (meleeComboMultiplier: number) => ({
            conditionalState: { mode: "realistic" as const, meleeComboMultiplier },
        });
        const effect = pressure!.effectsByRank[pressure!.fusionLimit] ?? pressure!.effect;
        const belowThreshold = calculateBuild(heavySlam, [effect], "", comboState(7)).modded;
        const activeAtEight = calculateBuild(heavySlam, [effect], "", comboState(8)).modded;
        const normalAtEight = calculateBuild(normalAttack, [effect], "", comboState(8)).modded;

        expect(belowThreshold.forcedProcsPerShot).toEqual({});
        expect(activeAtEight.forcedProcsPerShot).toEqual(
            Object.fromEntries(statusTypes.map((type) => [type, 1 / statusTypes.length])),
        );
        expect(activeAtEight.averageProcsPerShot - belowThreshold.averageProcsPerShot).toBeCloseTo(1, 10);
        expect(normalAtEight.forcedProcsPerShot).toEqual({});
    });

    it("reports the Wiki-backed Gas radius from expected active proc stacks", () => {
        const stats = calculateBuild(makeWeapon({ gas: 100 }), []).modded;
        expect(stats.expectedStacksByType.gas).toBeGreaterThan(0);
        expect(stats.gasCloudRadius).toBeCloseTo(gasCloudRadiusFromStacks(stats.expectedStacksByType.gas ?? 0), 12);
    });
});

describe("Vigilante set critical-tier bonus", () => {
    it("adds expected critical tiers only to Primary weapons and respects the six-piece cap", () => {
        const weapon = { ...makeWeapon({ impact: 100 }), critChance: 0.5, critMultiplier: 2 };
        const twoSelectedPieces = { ...emptyEffect(), vigilanteSetModCount: 2 };
        const primary = calculateBuild(weapon, [twoSelectedPieces], "", {
            conditionalState: { mode: "initial", externalVigilanteSetModCount: 7.8 },
        }).modded;

        expect(primary.vigilanteSetModCount).toBe(6);
        expect(primary.vigilanteCritTierEnhancementChance).toBeCloseTo(0.3);
        expect(primary.averageCritTier).toBeCloseTo(0.65);
        expect(avgHitDamageMultiplier(0.5, 2, [], undefined, 0.3)).toBeCloseTo(1.65);
        expect(avgHitDamageMultiplier(1.5, 2, [], undefined, 0.3)).toBeCloseTo(2.8);
        expect(avgHitDamageMultiplier(0.5, 2, [], {
            headshotRate: 1,
            headshotMultiplier: 1,
            criticalHeadshotMultiplier: 2,
        }, 0.3)).toBeCloseTo(2.95);

        const secondary = calculateBuild({ ...weapon, category: "Secondary" }, [twoSelectedPieces], "", {
            conditionalState: { mode: "initial", externalVigilanteSetModCount: 2 },
        }).modded;
        expect(secondary.vigilanteSetModCount).toBe(4);
        expect(secondary.vigilanteCritTierEnhancementChance).toBe(0);
        expect(secondary.averageCritTier).toBeCloseTo(0.5);
    });
});

describe("Gladiator combo-scaled melee Critical Chance set bonus", () => {
    it("counts canonical set members at every rank and applies 10% per combo tier above 1x", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon?.category).toBe("Melee");
        const setPath = "/Lotus/Upgrades/Mods/Sets/Gladiator/GladiatorSetMod";
        const setMods = getModsForWeapon(weapon!).filter((candidate) => candidate.setBonusPath === setPath);
        expect(setMods.map((candidate) => candidate.name).sort()).toEqual(["Gladiator Might", "Gladiator Rush", "Gladiator Vice"]);
        for (const mod of setMods) {
            expect(mod.effectsByRank.every((effect) => effect.gladiatorSetModCount === 1)).toBe(true);
        }
        const selectedEffects = setMods.map((mod) => mod.effectsByRank[mod.fusionLimit]);
        const atTwelve = calculateBuild(weapon!, selectedEffects, "", {
            conditionalState: { mode: "realistic", meleeComboMultiplier: 12, externalGladiatorSetModCount: 7.9 },
        }).modded;
        expect(atTwelve.gladiatorSetModCount).toBe(6);
        expect(atTwelve.gladiatorCritChancePerComboTier).toBeCloseTo(0.6, 10);
        expect(atTwelve.comboCritChancePerTier).toBeCloseTo(weapon!.critChance * 0.6, 10);
        expect(atTwelve.critChance).toBeCloseTo(weapon!.critChance * (1 + 0.6 * 11), 10);
        expect(atTwelve.meleeComboMultiplier).toBe(12);
    });

    it("keeps Gladiator inactive on ranged weapons and adds no bonus at 1x combo", () => {
        const piece = { ...emptyEffect(), gladiatorSetModCount: 1 };
        const melee = { ...makeWeapon({ impact: 100 }), category: "Melee" as const, weaponType: "Sword", modCompat: "Melee" as const, critChance: 0.2 };
        const noCombo = calculateBuild(melee, [piece], "", { conditionalState: { mode: "realistic", meleeComboMultiplier: 1 } }).modded;
        expect(noCombo.gladiatorSetModCount).toBe(1);
        expect(noCombo.gladiatorCritChancePerComboTier).toBeCloseTo(0.1, 10);
        expect(noCombo.critChance).toBeCloseTo(melee.critChance, 10);
        const rangedWeapon = { ...makeWeapon({ impact: 100 }), critChance: 0.2 };
        const ranged = calculateBuild(rangedWeapon, [piece], "", {
            conditionalState: { mode: "realistic", meleeComboMultiplier: 12, externalGladiatorSetModCount: 3 },
        }).modded;
        expect(ranged.gladiatorSetModCount).toBe(4);
        expect(ranged.gladiatorCritChancePerComboTier).toBe(0);
        expect(ranged.critChance).toBeCloseTo(0.2, 10);
    });
});

describe("Sacrificial two-piece melee set bonus", () => {
    it("marks the canonical ranks and boosts damage, normal/heavy crit, and Sentient bonus by 25%", () => {
        const weapon = makeWeapon({ impact: 100 });
        const meleeWeapon = {
            ...weapon,
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee" as const,
            critChance: 0.2,
            statusChance: 0,
        };
        const setPath = "/Lotus/Upgrades/Mods/Sets/Sacrifice/SacrificeSetMod";
        const setMods = getModsForWeapon(meleeWeapon).filter((candidate) => candidate.setBonusPath === setPath);
        expect(setMods.map((candidate) => candidate.name).sort()).toEqual(["Sacrificial Pressure", "Sacrificial Steel"]);
        for (const mod of setMods) {
            expect(mod.effectsByRank.every((effect) => effect.sacrificialSetModCount === 1)).toBe(true);
            expect(getUnmodeledDamageEffectLines(mod, mod.fusionLimit)).toEqual([]);
        }
        const pressure = setMods.find((mod) => mod.name === "Sacrificial Pressure")!;
        const steel = setMods.find((mod) => mod.name === "Sacrificial Steel")!;
        const pressureEffect = pressure.effectsByRank[pressure.fusionLimit];
        const steelEffect = steel.effectsByRank[steel.fusionLimit];
        for (const mod of setMods) {
            expect(mod.effectsByRank.every((effect) => effect.sacrificialSetModId === mod.uniqueName)).toBe(true);
        }
        expect(pressureEffect.damageBonus).toBeCloseTo(1.1, 10);
        expect(pressureEffect.factionDamageBonus).toBeCloseTo(0.33, 10);
        expect(pressureEffect.targetFaction).toBe("Sentient");
        expect(steelEffect.critChanceBonus).toBeCloseTo(2.2, 10);
        expect(steelEffect.heavyAttackCritChanceBonus).toBeCloseTo(2.2, 10);
        expect(steelEffect.factionDamageBonus).toBeCloseTo(0.33, 10);
        expect(steelEffect.targetFaction).toBe("Sentient");

        const unpaired = calculateBuild(meleeWeapon, [pressureEffect], "Sentient").modded;
        expect(unpaired.sacrificialSetModCount).toBe(1);
        expect(unpaired.totalDamageBonus).toBeCloseTo(1.1, 10);
        const pair = [pressureEffect, steelEffect];
        const paired = calculateBuild(meleeWeapon, pair, "Sentient").modded;
        expect(paired.sacrificialSetModCount).toBe(2);
        expect(paired.totalDamageBonus).toBeCloseTo(1.375, 10);
        expect(paired.critChance).toBeCloseTo(0.2 * 3.75, 10);
        expect(paired.factionDamageBonus).toBeCloseTo(0.825, 10);
        const otherFaction = calculateBuild(meleeWeapon, pair, "Grineer").modded;
        expect(otherFaction.factionDamageBonus).toBe(0);

        const duplicateMember = calculateBuild(meleeWeapon, [pressureEffect, pressureEffect], "Sentient").modded;
        expect(duplicateMember.sacrificialSetModCount).toBe(1);
        expect(duplicateMember.totalDamageBonus).toBeCloseTo(2.2, 10);
        expect(duplicateMember.factionDamageBonus).toBeCloseTo(0.66, 10);

        const heavyWeapon = { ...meleeWeapon, selectedAttackUsesHeavyAttackCritChance: true };
        const heavy = calculateBuild(heavyWeapon, pair, "Sentient").modded;
        expect(heavy.critChance).toBeCloseTo(0.2 * 6.5, 10);
        expect(heavy.factionDamageBonus).toBeCloseTo(0.825, 10);

        for (let rank = 0; rank <= Math.min(pressure.fusionLimit, steel.fusionLimit); rank++) {
            const rankedPressure = pressure.effectsByRank[rank];
            const rankedSteel = steel.effectsByRank[rank];
            const rankedPair = calculateBuild(meleeWeapon, [rankedPressure, rankedSteel], "Sentient").modded;
            expect(rankedPair.totalDamageBonus).toBeCloseTo(
                ((rankedPressure.damageBonus ?? 0) + (rankedSteel.damageBonus ?? 0)) * 1.25,
                10,
            );
            expect(rankedPair.critChance).toBeCloseTo(
                meleeWeapon.critChance * (1 + ((rankedPressure.critChanceBonus ?? 0) + (rankedSteel.critChanceBonus ?? 0)) * 1.25),
                10,
            );
            expect(rankedPair.factionDamageBonus).toBeCloseTo(
                ((rankedPressure.factionDamageBonus ?? 0) + (rankedSteel.factionDamageBonus ?? 0)) * 1.25,
                10,
            );
        }
    });

    it("does not activate on ranged builds or with only one member", () => {
        const meleeWeapon = {
            ...makeWeapon({ impact: 100 }),
            category: "Melee" as const,
            weaponType: "Sword",
            modCompat: "Melee" as const,
        };
        const setMods = getModsForWeapon(meleeWeapon).filter((mod) =>
            mod.setBonusPath === "/Lotus/Upgrades/Mods/Sets/Sacrifice/SacrificeSetMod",
        );
        const [pressureMod, steelMod] = setMods;
        const piece = pressureMod.effectsByRank[pressureMod.fusionLimit];
        const single = calculateBuild(meleeWeapon, [piece], "Sentient").modded;
        expect(single.sacrificialSetModCount).toBe(1);
        expect(single.totalDamageBonus).toBeCloseTo(piece.damageBonus, 10);
        const rangedWeapon = makeWeapon({ impact: 100 });
        const ranged = calculateBuild(
            rangedWeapon,
            [pressureMod.effectsByRank[pressureMod.fusionLimit], steelMod.effectsByRank[steelMod.fusionLimit]],
            "Sentient",
        ).modded;
        expect(ranged.sacrificialSetModCount).toBe(2);
        expect(ranged.totalDamageBonus).toBeCloseTo(
            (pressureMod.effectsByRank[pressureMod.fusionLimit].damageBonus ?? 0) +
                (steelMod.effectsByRank[steelMod.fusionLimit].damageBonus ?? 0),
            10,
        );
        expect(ranged.critChance).toBeCloseTo(
            rangedWeapon.critChance +
                rangedWeapon.critChance * (
                    (pressureMod.effectsByRank[pressureMod.fusionLimit].critChanceBonus ?? 0) +
                    (steelMod.effectsByRank[steelMod.fusionLimit].critChanceBonus ?? 0)
                ),
            10,
        );
    });
});

describe("Strain Infection Burst critical damage", () => {
    const weapon = {
        ...makeWeapon({ impact: 100 }),
        category: "Melee" as const,
        weaponType: "Sword",
        modCompat: "Melee" as const,
        critChance: 0.5,
        critMultiplier: 2,
    };
    const strainInfection = { ...emptyEffect(), strainInfectionCritDamagePerCyst: 0.2 };

    it("adds per-cyst Critical Damage to ordinary melee impacts and caps assumed cysts at eight", () => {
        const fourCysts = calculateBuild(weapon, [strainInfection], "", {
            conditionalState: { mode: "initial", strainInfectionCystsAtImpact: 4 },
        }).modded;
        const capped = calculateBuild(weapon, [strainInfection], "", {
            conditionalState: { mode: "initial", strainInfectionCystsAtImpact: 12 },
        }).modded;

        expect(fourCysts.strainInfectionCritDamageBonus).toBeCloseTo(0.8, 10);
        expect(fourCysts.strainInfectionCystsAtImpact).toBe(4);
        expect(fourCysts.critMultiplier).toBeCloseTo(fourCysts.quantizedBaseCritMultiplier * 1.8, 10);
        expect(capped.strainInfectionCritDamageBonus).toBeCloseTo(1.6, 10);
        expect(capped.strainInfectionCystsAtImpact).toBe(8);
        expect(capped.critMultiplier).toBeCloseTo(capped.quantizedBaseCritMultiplier * 2.6, 10);
        expect(normalizeStrainInfectionCystCount(-1)).toBe(0);
        expect(normalizeStrainInfectionCystCount(7.9)).toBe(7);
        expect(normalizeStrainInfectionCystCount(Number.NaN)).toBe(0);
    });

    it("adds to other Critical Damage bonuses and excludes Exalted and ranged weapons", () => {
        const additive = calculateBuild(weapon, [
            strainInfection,
            { ...emptyEffect(), critMultBonus: 0.1 },
        ], "", {
            conditionalState: { mode: "initial", strainInfectionCystsAtImpact: 2 },
        }).modded;
        const exalted = calculateBuild({ ...weapon, isExalted: true }, [strainInfection], "", {
            conditionalState: { mode: "initial", strainInfectionCystsAtImpact: 8 },
        }).modded;
        const primary = calculateBuild({ ...weapon, category: "Primary" }, [strainInfection], "", {
            conditionalState: { mode: "initial", strainInfectionCystsAtImpact: 8 },
        }).modded;

        expect(additive.critMultiplier).toBeCloseTo(additive.quantizedBaseCritMultiplier * 1.5, 10);
        expect(additive.strainInfectionCritDamageBonus).toBeCloseTo(0.4, 10);
        expect(exalted.strainInfectionCritDamageBonus).toBe(0);
        expect(exalted.critMultiplier).toBeCloseTo(exalted.quantizedBaseCritMultiplier, 10);
        expect(primary.strainInfectionCritDamageBonus).toBe(0);
        expect(primary.critMultiplier).toBeCloseTo(primary.quantizedBaseCritMultiplier, 10);
    });
});

describe("Stinging Truth flat magazine capacity", () => {
    it("adds its rank-scaled rounds after percentage Magazine Capacity for Viper variants", () => {
        const weapons = getWeaponCatalog();
        const viper = weapons.find((candidate) => candidate.name === "Viper");
        const viperWraith = weapons.find((candidate) => candidate.name === "Viper Wraith");
        const twinVipers = weapons.find((candidate) => candidate.name === "Twin Vipers");
        expect(viper).toBeDefined();
        expect(viperWraith).toBeDefined();
        expect(twinVipers).toBeDefined();

        const stingingTruth = getModsForWeapon(viper!).find((mod) => mod.name === "Stinging Truth");
        const stingingTruthWraith = getModsForWeapon(viperWraith!).find((mod) => mod.name === "Stinging Truth");
        const slipMagazine = getModsForWeapon(viper!).find((mod) => mod.name === "Slip Magazine");
        const slipMagazineWraith = getModsForWeapon(viperWraith!).find((mod) => mod.name === "Slip Magazine");
        expect(stingingTruth).toBeDefined();
        expect(stingingTruthWraith).toBeDefined();
        expect(slipMagazine).toBeDefined();
        expect(slipMagazineWraith).toBeDefined();
        expect(getModsForWeapon(twinVipers!).some((mod) => mod.name === "Stinging Truth")).toBe(false);
        expect(stingingTruth!.effectsByRank.map((effect) => effect.magazineCapacityFlatBonus)).toEqual([10, 20, 30, 40]);
        expect(stingingTruth!.effectsByRank.map((effect) => effect.magazineBonus)).toEqual([0, 0, 0, 0]);
        expect(slipMagazine!.effectsByRank[slipMagazine!.fusionLimit].magazineBonus).toBeCloseTo(0.1, 12);

        const viperMagazines = stingingTruth!.effectsByRank.map((effect) =>
            calculateBuild(viper!, [effect]).modded.magazineSize,
        );
        const wraithMagazines = stingingTruthWraith!.effectsByRank.map((effect) =>
            calculateBuild(viperWraith!, [effect]).modded.magazineSize,
        );
        expect(viperMagazines).toEqual([24, 34, 44, 54]);
        expect(wraithMagazines).toEqual([30, 40, 50, 60]);

        const combinedViper = calculateBuild(viper!, [
            stingingTruth!.effectsByRank[stingingTruth!.fusionLimit],
            slipMagazine!.effectsByRank[slipMagazine!.fusionLimit],
        ]).modded;
        const combinedWraith = calculateBuild(viperWraith!, [
            stingingTruthWraith!.effectsByRank[stingingTruthWraith!.fusionLimit],
            slipMagazineWraith!.effectsByRank[slipMagazineWraith!.fusionLimit],
        ]).modded;
        expect(combinedViper.magazineSize).toBe(55); // round(14 × 1.10 + 40)
        expect(combinedWraith.magazineSize).toBe(62); // round(20 × 1.10 + 40)
    });
});
