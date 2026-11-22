import { describe, expect, it } from "vitest";
import {
    filterBuilderExpertVariants,
    getModsForWeapon,
    getUnmodeledDamageEffectLines,
    type ModEntry,
} from "../../catalog/modCatalog";
import { getUnmodeledScoringEffectLines } from "../../catalog/modEffectUtils";
import { getWeaponCatalog, withSelectedAttack } from "../../catalog/weaponCatalog";
import {
    assignModsToSlots,
    debugEvaluateFixedWindowDps,
    optimizeBuild,
} from "../buildOptimizer";
import { computeCapacity, countPolarityChanges } from "../capacityCalc";
import { type ConditionalState } from "../damageCalc";

describe("Mausolon selectable-profile fixed-window oracle", () => {
    it("matches a seeded six-mod, four-slot 5s Avg DPS oracle for both Auto profiles", { timeout: 300000 }, () => {
        let seed = 20261131;
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
            { variantLabel: "Archwing", maxFormaCount: 0 },
            { variantLabel: "Atmosphere", maxFormaCount: 1 },
        ] as const;
        const weapons = scenarios.map((scenario) => {
            const weapon = getWeaponCatalog().find((entry) =>
                entry.name === "Mausolon" && entry.variantLabel === scenario.variantLabel,
            );
            expect(weapon, `Mausolon (${scenario.variantLabel})`).toBeTruthy();
            return weapon!;
        });
        const profilePools = weapons.map((weapon) => new Map<string, ModEntry>(
            filterBuilderExpertVariants(getModsForWeapon(weapon))
                .filter((mod) => mod.isPveEligible !== false && mod.hasDamageEffect && !mod.isAura && mod.fusionLimit > 0)
                .filter((mod) => !/(?:^|\/)(?:beginner|flawed)(?:\/|$)/i.test(mod.path))
                .filter((mod) => !mod.effect.targetFaction || mod.effect.targetFaction.toLowerCase() === "grineer")
                .filter((mod) => Array.from({ length: mod.fusionLimit + 1 }, (_, rank) => rank).every((rank) =>
                    getUnmodeledDamageEffectLines(mod, rank).length === 0 &&
                    getUnmodeledScoringEffectLines(mod.effectsByRank[rank] ?? mod.effect).length === 0
                ))
                .map((mod) => [mod.uniqueName, mod] as const),
        ));
        const sharedCandidatePool = [...profilePools[0].values()]
            .filter((mod) => profilePools[1].has(mod.uniqueName));
        const candidates = shuffled(sharedCandidatePool).slice(0, 6);
        expect(candidates, "shared fully modeled damage-mod sample").toHaveLength(6);

        const targetFaction = "Grineer";
        const target = { health: 10_000_000, shields: 0, overguard: 0, armor: 3_000 };
        const distanceMeters = 250;
        const slotCount = 4;
        const capacityConfig = {
            weaponRank: 30,
            hasCatalyst: true,
            masteryRank: 30,
        };
        const optimizedDpsByProfile = new Map<string, number>();

        for (const [scenarioIndex, scenario] of scenarios.entries()) {
            const weapon = weapons[scenarioIndex];
            const autoIndex = weapon.attacks.findIndex((attack) => attack.name === "Auto");
            expect(autoIndex, `Mausolon (${scenario.variantLabel}) Auto profile`).toBeGreaterThanOrEqual(0);
            const attack = weapon.attacks[autoIndex]!;
            const scoringWeapon = withSelectedAttack(weapon, autoIndex);
            const profileCapacityConfig = { ...capacityConfig, canOverLevel: weapon.canOverLevel };
            const conditionalState: ConditionalState = {
                mode: "realistic",
                attackFalloffDistanceMeters: distanceMeters,
            };
            const slotPolarities = weapon.polarities.slice(0, slotCount);
            const score = (effects: (ModEntry["effect"] | null)[]) =>
                debugEvaluateFixedWindowDps(
                    scoringWeapon,
                    effects,
                    targetFaction,
                    target,
                    conditionalState,
                    null,
                );

            let exhaustiveBest = score([]);
            let bestDps = exhaustiveBest.damagePerSecond;
            let legalLoadoutCount = 0;
            let maximumLegalSlotCount = 0;
            const scoreLoadout = (ordered: ModEntry[]) => {
                const placement = assignModsToSlots(
                    ordered,
                    ordered.map((mod) => mod.fusionLimit),
                    slotPolarities,
                    slotCount,
                    true,
                    scenario.maxFormaCount,
                );
                if (placement.slotMods.filter(Boolean).length !== ordered.length) return;
                const capacity = computeCapacity(
                    profileCapacityConfig,
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

            expect(legalLoadoutCount, `Mausolon (${scenario.variantLabel}) legal loadouts`).toBeGreaterThan(0);
            expect(maximumLegalSlotCount, `Mausolon (${scenario.variantLabel}) four-mod loadout`).toBe(slotCount);
            expect(exhaustiveBest.damageInWindow, `Mausolon (${scenario.variantLabel}) uncapped window`)
                .toBeLessThan(target.health + target.shields);

            const result = optimizeBuild(weapon, candidates, "windowDps", slotCount, {
                targetFaction,
                targetProfileOverride: target,
                conditionalState,
                capacityConfig: profileCapacityConfig,
                slotPolarities,
                defaultSlotPolarities: slotPolarities,
                allowForma: scenario.maxFormaCount > 0,
                maxFormaCount: scenario.maxFormaCount,
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

            expect(result.capacityValid, `Mausolon (${scenario.variantLabel}) capacity`).toBe(true);
            expect(formaUsed, `Mausolon (${scenario.variantLabel}) Forma budget`)
                .toBeLessThanOrEqual(scenario.maxFormaCount);
            for (const [slotIndex, mod] of result.slots.entries()) {
                if (!mod) continue;
                expect(result.slotRanks[slotIndex], `Mausolon (${scenario.variantLabel}) max rank`)
                    .toBe(mod.fusionLimit);
            }
            expect(optimizedScore.damagePerSecond, `Mausolon (${scenario.variantLabel}) exact 5s Avg DPS`)
                .toBeCloseTo(bestDps, 8);
            expect(optimizedScore.damageInWindow, `Mausolon (${scenario.variantLabel}) 5s damage`)
                .toBeCloseTo(exhaustiveBest.damageInWindow, 8);
            optimizedDpsByProfile.set(scenario.variantLabel, optimizedScore.damagePerSecond);
        }

        expect(optimizedDpsByProfile.get("Atmosphere"), "Atmosphere Auto retains its own damage profile")
            .toBeGreaterThan(optimizedDpsByProfile.get("Archwing") ?? Number.POSITIVE_INFINITY);
    });
});
