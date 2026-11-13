import { getModsForWeapon, type ModEntry } from "../catalog/modCatalog";
import { getArcanesForWeapon } from "../catalog/arcaneCatalog";
import type { WeaponEntry } from "../catalog/weaponCatalog";
import {
    optimizeBuildCore,
    type OptimizeGoal,
    type OptimizerOptions,
    type OptimizeResult,
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