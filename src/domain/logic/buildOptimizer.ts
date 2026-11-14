import { getModsForWeapon, type ModEffect, type ModEntry } from "../catalog/modCatalog";
import { getArcanesForWeapon } from "../catalog/arcaneCatalog";
import { withSelectedAttack, type WeaponEntry } from "../catalog/weaponCatalog";
import { getArcaneEffectAtRank } from "./arcaneEffects";
import type { ConditionalState } from "./damageCalc";
import {
    debugScoreBuild,
    debugScoreExpectedEncounter,
    optimizeBuildCore,
    rankExpectedEncounter,
    type OptimizeGoal,
    type OptimizerOptions,
    type OptimizeResult,
    type TargetProfileOverride,
} from "./buildOptimizerCore";

export * from "./buildOptimizerCore";

export function optimizeBuild(
    weapon: WeaponEntry,
    availableMods: ModEntry[] | null,
    goal: OptimizeGoal,
    slotCount: number,
    options: OptimizerOptions = {},
): OptimizeResult {
    const arcaneCandidates = options.arcaneCandidates ?? (
        options.optimizeArcane ? getArcanesForWeapon(weapon) : []
    );
    return optimizeBuildCore(
        weapon,
        availableMods ?? getModsForWeapon(weapon),
        goal,
        slotCount,
        { ...options, arcaneCandidates },
    );
}

export interface OptimizerConfigurationScoreInput {
    weapon: WeaponEntry;
    result: OptimizeResult;
    goal: OptimizeGoal;
    targetFaction: string;
    selectedAttackIdx: number;
    targetProfileOverride?: TargetProfileOverride | null;
    conditionalState?: ConditionalState;
    preEquippedEffects?: (ModEffect | null)[];
    includeExilus?: boolean;
    warframeArmor?: number;
    warframeMaxEnergy?: number;
    warframeEnergyPercent?: number;
    useFiniteEncounterResult?: boolean;
}

/** Score one optimizer result against another configured weapon state. */
export function scoreOptimizerResultForConfiguration(input: OptimizerConfigurationScoreInput): number {
    const scoringWeapon = withSelectedAttack(input.weapon, input.selectedAttackIdx);
    const effects: (ModEffect | null)[] = [
        ...(input.preEquippedEffects ?? []),
        ...input.result.slots.map((mod, index) => {
            if (!mod) return null;
            const rank = input.result.slotRanks[index] ?? mod.fusionLimit;
            return mod.effectsByRank[rank] ?? mod.effect;
        }),
    ];
    if (input.includeExilus && input.result.exilusMod) {
        effects.push(input.result.exilusMod.effectsByRank[input.result.exilusRank] ?? input.result.exilusMod.effect);
    }

    const arcaneEffect = input.result.arcane
        ? getArcaneEffectAtRank(input.result.arcane, input.result.arcaneRank, input.warframeArmor, true, {
            warframeMaxEnergy: input.warframeMaxEnergy,
            warframeEnergyPercent: input.warframeEnergyPercent,
        })
        : null;
    const target = input.targetProfileOverride ?? undefined;

    if (input.goal === "timeToKill") {
        if (input.useFiniteEncounterResult !== false && input.result.encounterScore !== undefined) {
            return rankExpectedEncounter(
                input.result.encounterTimeToKillSeconds,
                input.result.encounterScore,
            );
        }
        const expectedEncounter = debugScoreExpectedEncounter(
            scoringWeapon,
            effects,
            input.targetFaction,
            target,
            input.conditionalState,
            arcaneEffect,
        );
        return rankExpectedEncounter(expectedEncounter.timeToKillSeconds, expectedEncounter.damagePerSecond);
    }

    return debugScoreBuild(
        scoringWeapon,
        effects,
        input.goal,
        input.targetFaction,
        arcaneEffect,
        input.targetProfileOverride,
        input.conditionalState,
    );
}
