import { describe, expect, it } from "vitest";
import { getModsForWeapon } from "../../catalog/modCatalog";
import { withSelectedAttack } from "../../catalog/weaponRules";
import { getWeaponCatalog } from "../../catalog/weaponCatalog";
import type { WeaponEntry } from "../../catalog/weaponCatalog";
import { calculateBuild } from "../damageCalc";
import { calculateDirectDamageToInitialPools } from "../targetDamage";
import { calculateTennokaiAttackTimeline, simulateTennokaiOpportunityTimeline } from "../tennokaiTimeline";

describe("Tennokai opportunity event timeline", () => {
    it("accumulates random opportunity probability across qualifying hits before a Heavy Attack", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 2,
            regularAttackIntervalSeconds: 1,
            heavyAttackIntervalSeconds: 1,
            maxEvents: 3,
        });

        expect(result.events.map(({ attackType, timeSeconds }) => [attackType, timeSeconds])).toEqual([
            ["regular", 0],
            ["regular", 1],
            ["heavy", 2],
        ]);
        expect(result.events[2].activeOpportunityProbability).toBeCloseTo(0.15, 12);
        expect(result.expectedTennokaiHeavyAttacks).toBeCloseTo(0.15, 12);
    });

    it("applies the rank chance increase multiplicatively to the base chance", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            opportunityChanceBonus: 0.5,
            maxEvents: 2,
        });

        expect(result.events[0].generatedOpportunityProbability).toBeCloseTo(0.225, 12);
        expect(result.events[1].activeOpportunityProbability).toBeCloseTo(0.225, 12);
    });

    it("expires opportunities before a later Heavy Attack when the hit-to-heavy gap exceeds the window", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 3,
            opportunityWindowSeconds: 2,
            baseOpportunityChance: 1,
            maxEvents: 2,
        });

        expect(result.events[1].timeSeconds).toBeCloseTo(3, 12);
        expect(result.events[1].activeOpportunityProbability).toBe(0);
    });

    it("expires an opportunity at the exact end of its window", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0,
            heavyAttackIntervalSeconds: 2,
            opportunityWindowSeconds: 2,
            baseOpportunityChance: 1,
            maxEvents: 2,
        });

        expect(result.events[1].timeSeconds).toBe(2);
        expect(result.events[1].activeOpportunityProbability).toBe(0);
    });

    it("uses the guaranteed qualifying-hit cadence instead of the random chance", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 2,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            baseOpportunityChance: 0.15,
            opportunityChanceBonus: 0.5,
            guaranteedOpportunityEveryHits: 4,
            maxEvents: 7,
        });

        expect(result.events[2].activeOpportunityProbability).toBe(0);
        expect(result.events[5].activeOpportunityProbability).toBe(1);
        expect(result.events[5].activeOpportunityProbabilityAfterEvent).toBe(0);
    });

    it("consumes an active opportunity on Heavy Attack before resolving that hit's next chance", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            baseOpportunityChance: 1,
            maxEvents: 3,
        });

        expect(result.events[1].activeOpportunityProbability).toBe(1);
        expect(result.events[1].activeOpportunityProbabilityAfterEvent).toBe(1);
        expect(result.events[2].activeOpportunityProbability).toBe(1);
    });

    it("preserves the expected combo tier on Tennokai Heavy Attacks and applies efficiency otherwise", () => {
        const tennokai = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            baseOpportunityChance: 1,
            startingComboPoints: 40,
            initialComboPoints: 40,
            heavyAttackEfficiency: 0,
            maxEvents: 2,
        });
        const ordinary = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            baseOpportunityChance: 0,
            startingComboPoints: 40,
            initialComboPoints: 40,
            heavyAttackEfficiency: 0,
            maxEvents: 2,
        });

        expect(tennokai.events[1].comboMultiplierBeforeEvent).toBe(3);
        expect(tennokai.events[1].comboPointsAfterEvent).toBeCloseTo(41, 12);
        expect(ordinary.events[1].comboPointsAfterEvent).toBe(0);
    });

    it("applies a Bleed combo gain before an attack at the same timestamp", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.5,
            heavyAttackIntervalSeconds: 0.5,
            baseOpportunityChance: 0,
            startingComboPoints: 0,
            initialComboPoints: 0,
            heavyAttackEfficiency: 0,
            maxEvents: 2,
            additionalComboPointGains: [{ timeSeconds: 0.5, comboPoints: 2 }],
        });

        expect(result.events[1].timeSeconds).toBe(0.5);
        expect(result.events[1].comboPointsBeforeEvent).toBe(3);
    });

    it("rebuilds only Initial Combo points at the sourced 40-points-per-second rate", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            baseOpportunityChance: 0,
            startingComboPoints: 40,
            initialComboPoints: 40,
            heavyAttackEfficiency: 0,
            maxEvents: 3,
        });

        expect(result.events[1].comboPointsAfterEvent).toBe(0);
        expect(result.events[2].comboPointsBeforeEvent).toBeCloseTo(4, 12);
    });

    it("keeps earned combo through a long attack gap when flat duration extends the timeout", () => {
        const shared = {
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 6,
            heavyAttackIntervalSeconds: 6,
            baseOpportunityChance: 0,
            startingComboPoints: 0,
            initialComboPoints: 0,
            heavyAttackEfficiency: 0.9,
            maxEvents: 4,
        };
        const standard = simulateTennokaiOpportunityTimeline({ ...shared, comboDurationSeconds: 5 });
        const extended = simulateTennokaiOpportunityTimeline({ ...shared, comboDurationSeconds: 15 });

        expect(standard.events[3].comboPointsBeforeEvent).toBe(0);
        expect(extended.events[3].comboPointsBeforeEvent).toBeGreaterThan(0);
    });

    it("starts Truth's Flame's repeated-target chain after a Tennokai kill and preserves its conditional state", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            baseOpportunityChance: 1,
            truthFlameEnabled: true,
            truthChainOpportunitySeconds: 4,
            tennokaiKillProbabilityByEvent: [0, 1, 0, 1],
            startingComboPoints: 40,
            initialComboPoints: 40,
            heavyAttackEfficiency: 0,
            maxEvents: 4,
        });

        expect(result.events[1].activeOpportunityProbability).toBe(1);
        expect(result.events[1].comboPointsAfterEvent).toBe(41);
        expect(result.events[2].tennokaiKillChainProbability).toBe(1);
        expect(result.events[3].tennokaiKillChainProbability).toBe(1);
        expect(result.events[3].activeOpportunityProbability).toBe(1);
    });

    it("resets combo after an active Truth's Flame Tennokai fails to kill", () => {
        const result = simulateTennokaiOpportunityTimeline({
            regularHitsBetweenHeavy: 1,
            regularAttackIntervalSeconds: 0.1,
            heavyAttackIntervalSeconds: 0.1,
            baseOpportunityChance: 1,
            truthFlameEnabled: true,
            tennokaiKillProbabilityByEvent: [0, 0],
            startingComboPoints: 40,
            initialComboPoints: 40,
            heavyAttackEfficiency: 0,
            maxEvents: 2,
        });

        expect(result.events[1].comboPointsAfterEvent).toBe(0);
        expect(result.events[1].tennokaiKillChainProbability).toBe(0);
    });

    it("scores event-local Tennokai damage and status bonuses on a supported melee cycle", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War");
        expect(weapon).toBeDefined();
        const mods = getModsForWeapon(weapon!);
        const mastersEdge = mods.find((mod) => mod.name === "Master's Edge")!;
        const conditionPerfection = mods.find((mod) => mod.name === "Condition's Perfection")!;
        const regularAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const heavyAttackIndex = weapon!.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");

        const damageTimeline = calculateTennokaiAttackTimeline({
            weapon: weapon!,
            mods: [mastersEdge.effectsByRank[mastersEdge.fusionLimit]],
            regularAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 2,
            conditionalState: { mode: "initial", meleeComboMultiplier: 3 },
            targetProfile: { health: 100_000, shields: 0, overguard: 0, armor: 3_000 },
            cycles: 2,
        });
        const statusTimeline = calculateTennokaiAttackTimeline({
            weapon: weapon!,
            mods: [conditionPerfection.effectsByRank[conditionPerfection.fusionLimit]],
            regularAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 2,
            conditionalState: { mode: "initial" },
            cycles: 1,
        });

        expect(damageTimeline.supported).toBe(true);
        expect(damageTimeline.events).toHaveLength(6);
        expect(damageTimeline.events[0].tennokaiDamageBonus).toBe(0);
        expect(damageTimeline.events[2].tennokaiDamageBonus).toBeGreaterThan(0);
        expect(damageTimeline.events[2].activeOpportunityProbability).toBeCloseTo(0.15, 8);
        expect(damageTimeline.expectedDamagePerSecondBeforeTargetDefenses).toBeGreaterThan(0);
        expect(damageTimeline.expectedDamagePerSecondAfterTargetDefenses ?? 0).toBeGreaterThan(0);
        expect(damageTimeline.expectedDamagePerSecondAfterTargetDefenses ?? 0)
            .toBeLessThan(damageTimeline.expectedDamagePerSecondBeforeTargetDefenses);
        const statusHeavy = statusTimeline.events.find((event) => event.attackType === "heavy")!;
        expect(statusHeavy.tennokaiStatusChanceBonus).toBeCloseTo(statusHeavy.activeOpportunityProbability, 8);
        expect(statusHeavy.statusChance).toBeGreaterThan(0);
    });

    it("scores ordered Slash ticks and Relentless Combination's rank-scaled application/tick gains", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const mods = getModsForWeapon(weapon);
        const mastersEdge = mods.find((mod) => mod.name === "Master's Edge")!;
        const relentless = mods.find((mod) => mod.name === "Relentless Combination")!;
        const regularAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const heavyAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");
        const common = {
            weapon,
            regularAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 20,
            targetFaction: "Grineer",
            targetProfile: { health: 1_000_000, shields: 0, overguard: 0, armor: 3_000 },
            cycles: 1,
        };
        const withoutRelentless = calculateTennokaiAttackTimeline({
            ...common,
            mods: [mastersEdge.effectsByRank[mastersEdge.fusionLimit]],
        });
        const rank0 = calculateTennokaiAttackTimeline({
            ...common,
            mods: [mastersEdge.effectsByRank[mastersEdge.fusionLimit], relentless.effectsByRank[0]],
        });
        const rank3 = calculateTennokaiAttackTimeline({
            ...common,
            mods: [mastersEdge.effectsByRank[mastersEdge.fusionLimit], relentless.effectsByRank[3]],
        });

        expect(relentless.effectsByRank.map((effect) => effect.relentlessCombinationSlashComboChance))
            .toEqual([0.25, 0.5, 0.75, 1]);
        expect(relentless.unparsedStatsByRank?.flat() ?? []).toEqual([]);
        expect(withoutRelentless.expectedSlashApplications).toBeGreaterThan(0);
        expect(withoutRelentless.expectedBleedDamageAfterTargetDefenses).toBeGreaterThan(0);
        expect(rank3.expectedBleedTicks).toBeGreaterThan(0);
        expect(rank3.expectedRelentlessComboPointsFromSlashApplications).toBeGreaterThan(0);
        expect(rank3.expectedRelentlessComboPointsFromBleedTicks).toBeGreaterThan(0);
        expect(rank3.expectedRelentlessComboPoints).toBeCloseTo(
            rank3.expectedRelentlessComboPointsFromSlashApplications + rank3.expectedRelentlessComboPointsFromBleedTicks,
            8,
        );
        expect(rank0.expectedRelentlessComboPoints).toBeGreaterThan(0);
        expect(rank3.expectedRelentlessComboPoints).toBeGreaterThan(rank0.expectedRelentlessComboPoints);
        expect(rank3.events[1].timeSeconds).toBe(rank3.events[0].timeSeconds + 1);
        expect(rank3.events[1].comboPointsBeforeEvent).toBeGreaterThan(withoutRelentless.events[1].comboPointsBeforeEvent);
        expect(rank3.events[1].comboPointsBeforeEvent - withoutRelentless.events[1].comboPointsBeforeEvent)
            .toBeCloseTo(rank3.events[0].expectedSlashApplications * 2, 8);
        expect(rank3.evaluationDurationSeconds).toBeGreaterThan(rank3.events.at(-1)!.timeSeconds);
    });

    it("stops Bleed on target death and starts the next attack against the repeated target profile", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const mods = getModsForWeapon(weapon);
        const mastersEdge = mods.find((mod) => mod.name === "Master's Edge")!;
        const relentless = mods.find((mod) => mod.name === "Relentless Combination")!;
        const normalAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const normalWeapon = withSelectedAttack(weapon, normalAttackIndex);
        const stats = calculateBuild(normalWeapon, [mastersEdge.effect, relentless.effectsByRank[3]], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const direct = calculateDirectDamageToInitialPools({
            health: 1_000_000,
            shields: 0,
            overguard: 0,
            armor: 0,
            faction: "",
            damageByType: stats.damageBreakdownBeforePerStatus,
            factionDamageBonus: stats.factionDamageBonus,
            viralHealthDamageBonus: stats.viralHealthDamageBonus,
            magneticDefenseDamageBonus: stats.magneticShieldDamageBonus,
            expectedHitDamageMultiplier: stats.expectedHitDamageMultiplier,
            expectedProjectiles: stats.multishot,
            expectedDamageMultiplier: stats.damageWeightedMultishot,
            singleProjectileDamageBonus: stats.singleProjectileDamageBonus,
        });
        const expectedSlashApplications = stats.averageProcsPerShot * (stats.procChanceByType.slash ?? 0);
        const expectedBleedTick = expectedSlashApplications * stats.slashDotTickDamagePerProc;
        expect(expectedBleedTick).toBeGreaterThan(0);
        const directDamage = Object.values(direct.uncappedDamageByPool).reduce((sum, damage) => sum + damage, 0);
        const targetHealth = directDamage + expectedBleedTick * 0.5;
        const heavyAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");
        const result = calculateTennokaiAttackTimeline({
            weapon,
            mods: [mastersEdge.effectsByRank[mastersEdge.fusionLimit], relentless.effectsByRank[3]],
            regularAttackIndex: normalAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 20,
            targetFaction: "",
            targetProfile: { health: targetHealth, shields: 0, overguard: 0, armor: 0 },
            cycles: 1,
        });

        expect(result.supported).toBe(true);
        expect(result.expectedBleedTickTargetKills).toBeGreaterThanOrEqual(1);
        expect(result.events[0].expectedSlashApplications).toBeGreaterThan(0);
        expect(result.events[1].expectedDamageAfterTargetDefenses ?? 0).toBeGreaterThan(0);
        const durableTarget = calculateTennokaiAttackTimeline({
            weapon,
            mods: [mastersEdge.effectsByRank[mastersEdge.fusionLimit], relentless.effectsByRank[3]],
            regularAttackIndex: normalAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 20,
            targetFaction: "",
            targetProfile: { health: 1_000_000, shields: 0, overguard: 0, armor: 0 },
            cycles: 1,
        });
        expect(result.expectedBleedDamageAfterTargetDefenses)
            .toBeLessThan(durableTarget.expectedBleedDamageAfterTargetDefenses);
        expect(result.expectedBleedTicks).toBeLessThan(durableTarget.expectedBleedTicks);
    });

    it("applies parsed flat Melee Combo Duration to the opportunity timeline", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const mods = getModsForWeapon(weapon);
        const mastersEdge = mods.find((mod) => mod.name === "Master's Edge")!;
        const driftingContact = mods.find((mod) => mod.name === "Drifting Contact")!;
        const corruptCharge = mods.find((mod) => mod.name === "Corrupt Charge")!;
        const truePunishment = mods.find((mod) => mod.name === "True Punishment")!;
        const regularAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const heavyAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");

        expect(driftingContact.effect.comboDurationBonus).toBe(10);
        expect(corruptCharge.effect.comboDurationBaseBonus).toBe(-0.5);
        const result = calculateTennokaiAttackTimeline({
            weapon,
            mods: [mastersEdge.effect, driftingContact.effect, corruptCharge.effect],
            regularAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 1,
            cycles: 1,
        });

        expect(result.supported).toBe(true);
        expect(result.notes).toContain(
            "The combo counter expires after 12.5s without a qualifying hit; the weapon's 5s base duration, percentage modifiers applied to that base, flat seconds, and the 0.1s minimum are included.",
        );

        const minimumDuration = calculateTennokaiAttackTimeline({
            weapon,
            mods: [mastersEdge.effect, corruptCharge.effect, truePunishment.effect],
            regularAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 1,
            cycles: 1,
        });
        expect(minimumDuration.notes).toContain(
            "The combo counter expires after 0.1s without a qualifying hit; the weapon's 5s base duration, percentage modifiers applied to that base, flat seconds, and the 0.1s minimum are included.",
        );
        expect(minimumDuration.notes).toContain(
            "Additional Combo Count Chance is not simulated; the timeline keeps its one-point-per-regular-hit assumption.",
        );
    });

    it("uses the weapon-exported base combo duration for melee exceptions", () => {
        const weapons = getWeaponCatalog();
        expect(weapons.find((weapon) => weapon.name === "Guandao Prime")?.meleeComboDurationSeconds).toBe(6);
        expect(weapons.find((weapon) => weapon.name === "Pulmonars")?.meleeComboDurationSeconds).toBe(9);
        expect(weapons.find((weapon) => weapon.name === "Vitrica")?.meleeComboDurationSeconds).toBe(10);
    });

    it("estimates Truth's Flame kills against repeated selected target pools", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const truthFlame = getModsForWeapon(weapon).find((mod) => mod.name === "Truth's Flame")!;
        const normalAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const heavyAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");

        const result = calculateTennokaiAttackTimeline({
            weapon,
            mods: [truthFlame.effectsByRank[truthFlame.fusionLimit]],
            regularAttackIndex: normalAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 1,
            targetProfile: { health: 1, shields: 0, overguard: 0, armor: 0 },
            cycles: 3,
        });

        expect(result.supported).toBe(true);
        expect(result.events[1].tennokaiTargetKillProbability).toBe(1);
        expect(result.events[3].tennokaiKillChainProbability).toBeGreaterThan(0);
        expect(result.notes.some((note) => note.includes("repeats identical target pools"))).toBe(true);
    });

    it("keeps unsupported weapon-specific Heavy Attack rows out of the scored timeline", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const mastersEdge = getModsForWeapon(weapon).find((mod) => mod.name === "Master's Edge")!;
        const normalAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const missingHeavyAttackIndex = -1;

        const result = calculateTennokaiAttackTimeline({
            weapon,
            mods: [mastersEdge.effect],
            regularAttackIndex: normalAttackIndex,
            heavyAttackIndex: missingHeavyAttackIndex,
            regularHitsBetweenHeavy: 3,
        });

        expect(result.supported).toBe(false);
        expect(result.limitation).toContain("catalogued Heavy Attack or Heavy Slam Attack row");
        expect(result.expectedDamageBeforeTargetDefenses).toBe(0);
    });

    it("rejects multi-strike attack rows that cannot map to one qualifying opportunity event", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Broken War")!;
        const mastersEdge = getModsForWeapon(weapon).find((mod) => mod.name === "Master's Edge")!;
        const normalAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Normal Attack");
        const heavyAttackIndex = weapon.attacks.findIndex((attack) => attack.name === "Heavy Slam Attack");
        const multiStrikeWeapon: WeaponEntry = {
            ...weapon,
            attacks: weapon.attacks.map((attack, index) => index === normalAttackIndex
                ? { ...attack, multishot: 2 }
                : attack),
        };

        const result = calculateTennokaiAttackTimeline({
            weapon: multiStrikeWeapon,
            mods: [mastersEdge.effect],
            regularAttackIndex: normalAttackIndex,
            heavyAttackIndex,
            regularHitsBetweenHeavy: 3,
        });

        expect(result.supported).toBe(false);
        expect(result.limitation).toContain("Multi-strike attack rows are excluded");
    });
});
