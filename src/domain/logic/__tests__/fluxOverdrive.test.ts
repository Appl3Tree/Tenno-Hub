import { describe, expect, it } from "vitest";
import { getModsForWeapon } from "../../catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack } from "../../catalog/weaponCatalog";
import { emptyEffect, getUnmodeledDamageEffectLines } from "../../catalog/modCatalog";
import { assignModsToSlots, debugScoreBuild, optimizeBuild } from "../buildOptimizer";
import { computeCapacity } from "../capacityCalc";
import {
    calculateBuild,
    normalizeFluxOverdriveOscillatingStatusChancePercent,
    withoutBurstOnlyConditionalAssumptions,
} from "../damageCalc";

const fluxRifle = getWeaponCatalog().find((weapon) => weapon.name === "Flux Rifle")!;
const normalAttackIndex = fluxRifle.attacks.findIndex((attack) => attack.name === "Normal Attack");
const normalFluxRifle = withSelectedAttack(fluxRifle, normalAttackIndex);
const fluxOverdrive = getModsForWeapon(fluxRifle).find((mod) => mod.name === "Flux Overdrive")!;

describe("Flux Overdrive rank and Burst snapshot", () => {
    it("parses the fixed and maximum oscillating rank values without leaving raw damage lines", () => {
        expect(fluxOverdrive.effectsByRank[0]?.statusChanceBonus).toBe(0.25);
        expect(fluxOverdrive.effectsByRank[0]?.fluxOverdriveMaxOscillatingStatusChanceBonus).toBe(0.168);
        expect(fluxOverdrive.effectsByRank[5]?.statusChanceBonus).toBe(1.5);
        expect(fluxOverdrive.effectsByRank[5]?.fluxOverdriveMaxOscillatingStatusChanceBonus).toBe(1.008);
        expect(fluxOverdrive.unparsedStatsByRank?.[5]).toEqual([]);
        expect(getUnmodeledDamageEffectLines(fluxOverdrive, 5, { selectedGoal: "burst" }).some((line) =>
            /fluctuates between|Oscillating Status Chance/i.test(line),
        )).toBe(false);
    });

    it("applies the oscillation after additive Status Chance and caps it at the equipped rank", () => {
        const rankFive = fluxOverdrive.effectsByRank[5]!;
        const fixedOnly = calculateBuild(normalFluxRifle, [rankFive], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const snapshot = calculateBuild(normalFluxRifle, [rankFive], "", {
            conditionalState: { mode: "initial", fluxOverdriveOscillatingStatusChancePercent: 50.4 },
        }).modded;
        expect(fixedOnly.statusChance).toBeCloseTo(normalFluxRifle.statusChance * 2.5, 8);
        expect(snapshot.statusChance).toBeCloseTo(fixedOnly.statusChance * 1.504, 8);
        expect(snapshot.fluxOverdriveOscillatingStatusChanceBonus).toBeCloseTo(0.504, 8);

        const rankZeroSnapshot = calculateBuild(normalFluxRifle, [fluxOverdrive.effectsByRank[0]!], "", {
            conditionalState: { mode: "initial", fluxOverdriveOscillatingStatusChancePercent: 100.8 },
        }).modded;
        expect(rankZeroSnapshot.fluxOverdriveOscillatingStatusChanceBonus).toBeCloseTo(0.168, 8);
        expect(normalizeFluxOverdriveOscillatingStatusChancePercent(250)).toBe(100.8);
    });

    it("uses the multiplicative snapshot for independent status rolls and strips it for finite scopes", () => {
        const independentProcEffect = {
            ...emptyEffect(),
            independentStatusProcChanceByType: { heat: 0.1 },
        };
        const rankFive = fluxOverdrive.effectsByRank[5]!;
        const fixedStats = calculateBuild(normalFluxRifle, [rankFive, independentProcEffect], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const fixedWithoutIndependent = calculateBuild(normalFluxRifle, [rankFive], "", {
            conditionalState: { mode: "initial" },
        }).modded;
        const snapshotStats = calculateBuild(normalFluxRifle, [rankFive, independentProcEffect], "", {
            conditionalState: { mode: "initial", fluxOverdriveOscillatingStatusChancePercent: 50.4 },
        }).modded;
        const snapshotWithoutIndependent = calculateBuild(normalFluxRifle, [rankFive], "", {
            conditionalState: { mode: "initial", fluxOverdriveOscillatingStatusChancePercent: 50.4 },
        }).modded;
        const fixedIndependentDelta = fixedStats.averageProcsPerShot - fixedWithoutIndependent.averageProcsPerShot;
        const snapshotIndependentDelta = snapshotStats.averageProcsPerShot - snapshotWithoutIndependent.averageProcsPerShot;
        expect(snapshotIndependentDelta / fixedIndependentDelta).toBeCloseTo(1.504, 8);

        const burstState = { mode: "initial" as const, fluxOverdriveOscillatingStatusChancePercent: 50.4 };
        const finiteState = withoutBurstOnlyConditionalAssumptions(burstState)!;
        expect(finiteState.fluxOverdriveOscillatingStatusChancePercent).toBe(0);
        const finiteStats = calculateBuild(normalFluxRifle, [rankFive], "", { conditionalState: finiteState }).modded;
        expect(finiteStats.statusChance).toBeCloseTo(fixedWithoutIndependent.statusChance, 8);
    });

    it("keeps the fixed rank bonus optimizer-eligible and respects owned rank counts", () => {
        const result = optimizeBuild(normalFluxRifle, [fluxOverdrive], "burst", 1, {
            conditionalState: { mode: "initial", fluxOverdriveOscillatingStatusChancePercent: 100.8 },
            ownedModUniqueNames: new Set([fluxOverdrive.uniqueName]),
            ownedModRankCountsByUniqueName: {
                [fluxOverdrive.uniqueName]: { "0": 1, "1": 2, "2": 1 },
            },
            allowNonMaxRank: true,
            slotPolarities: [""],
            defaultSlotPolarities: [""],
            allowForma: false,
            optimizeArcane: false,
            optimizeExilus: false,
        });
        const selectedIndex = result.mods.findIndex((mod) => mod.uniqueName === fluxOverdrive.uniqueName);
        expect(selectedIndex).toBeGreaterThanOrEqual(0);
        expect(result.ranks[selectedIndex]).toBe(2);
    });

    it("matches seeded exhaustive owned-rank Burst winners across targets and oscillation snapshots", { timeout: 120_000 }, () => {
        let seed = 20261177;
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
        };
        const candidates = ["Flux Overdrive", "High Voltage", "Malignant Force", "Cryo Rounds"]
            .map((name) => getModsForWeapon(fluxRifle).find((mod) => mod.name === name))
            .filter((mod) => mod !== undefined);
        expect(candidates.map((mod) => mod.name)).toEqual(["Flux Overdrive", "High Voltage", "Malignant Force", "Cryo Rounds"]);

        const scenarios = [
            { faction: "Grineer", health: 8_000, armor: 300 },
            { faction: "Corpus", health: 24_000, armor: 0 },
            { faction: "Infested", health: 72_000, armor: 1_000 },
            { faction: "Corrupted", health: 36_000, armor: 600 },
        ] as const;
        const slotCount = 2;
        const slotPolarities = ["", ""];
        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 30,
            canOverLevel: fluxRifle.canOverLevel,
        };
        const ownedModUniqueNames = new Set(candidates.map((mod) => mod.uniqueName));

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const maxSnapshot = (1 + scenarioIndex) * 16.8;
            const conditionalState = {
                mode: "initial" as const,
                fluxOverdriveOscillatingStatusChancePercent: Number((random() * maxSnapshot).toFixed(1)),
            };
            const targetProfileOverride = {
                health: scenario.health,
                shields: 0,
                armor: scenario.armor,
                overguard: 0,
            };
            const ownedModRankCountsByUniqueName: Record<string, Record<string, number>> = {};
            const ownedRanksByUniqueName = new Map<string, number[]>();
            for (const mod of candidates) {
                const possibleRanks = Array.from({ length: Math.min(2, mod.fusionLimit) + 1 }, (_, rank) => rank);
                const ownedRanks = possibleRanks.filter(() => random() < 0.72);
                if (ownedRanks.length === 0) ownedRanks.push(possibleRanks[Math.floor(random() * possibleRanks.length)]!);
                ownedModRankCountsByUniqueName[mod.uniqueName] = Object.fromEntries(
                    ownedRanks.map((rank) => [String(rank), 1]),
                );
                ownedRanksByUniqueName.set(mod.uniqueName, ownedRanks);
            }

            const scoreEffects = (effects: (typeof candidates[number]["effect"] | null)[]) => debugScoreBuild(
                normalFluxRifle,
                effects,
                "burst",
                scenario.faction,
                null,
                targetProfileOverride,
                conditionalState,
            );
            let bestScore = scoreEffects([]);
            const scoreRanks = (ordered: typeof candidates, ranks: number[], index: number) => {
                if (index < ordered.length) {
                    for (const rank of ownedRanksByUniqueName.get(ordered[index]!.uniqueName) ?? []) {
                        ranks[index] = rank;
                        scoreRanks(ordered, ranks, index + 1);
                    }
                    return;
                }

                const placement = assignModsToSlots(ordered, ranks, slotPolarities, slotCount, false);
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    capacityConfig,
                    placement.resultPolarities.map((polarity) => ({ polarity })),
                    placement.slotMods,
                    placement.slotRanks,
                );
                if (capacity.overCapacity) return;

                const effects = placement.slotMods.map((mod, slotIndex) => {
                    if (!mod) return null;
                    const rank = placement.slotRanks[slotIndex] ?? mod.fusionLimit;
                    return mod.effectsByRank[rank] ?? mod.effect;
                });
                bestScore = Math.max(bestScore, scoreEffects(effects));
            };
            const enumerate = (remaining: typeof candidates, ordered: typeof candidates) => {
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

            const optimized = optimizeBuild(normalFluxRifle, candidates, "burst", slotCount, {
                targetFaction: scenario.faction,
                targetProfileOverride,
                conditionalState,
                capacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: false,
                allowNonMaxRank: true,
                ownedModUniqueNames,
                ownedModRankCountsByUniqueName,
                optimizeExilus: false,
                optimizeArcane: false,
            });
            const optimizedEffects = optimized.mods.map((mod, modIndex) => {
                if (!mod) return null;
                const rank = optimized.ranks[modIndex] ?? mod.fusionLimit;
                return mod.effectsByRank[rank] ?? mod.effect;
            });
            expect(optimized.capacityValid, `seed 20261177 scenario ${scenarioIndex} capacity`).toBe(true);
            expect(scoreEffects(optimizedEffects), `seed 20261177 scenario ${scenarioIndex} exhaustive winner`)
                .toBeCloseTo(bestScore, 8);
        }
    });
});
