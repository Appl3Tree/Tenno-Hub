import type { ModEntry } from "../domain/catalog/modCatalog";
import type { WeaponEntry } from "../domain/catalog/weaponCatalog";
import { optimizeBuildCore, type OptimizeGoal, type OptimizerOptions, type OptimizeResult } from "../domain/logic/buildOptimizerCore";

interface OptimizeRequest {
    id: number;
    weapon: WeaponEntry;
    availableMods: ModEntry[];
    goal: OptimizeGoal;
    slotCount: number;
    options: OptimizerOptions;
}

interface OptimizeResponse {
    id: number;
    result?: OptimizeResult;
    error?: string;
}

const workerScope = self as unknown as {
    onmessage: ((event: MessageEvent<OptimizeRequest>) => void) | null;
    postMessage: (message: OptimizeResponse) => void;
};

workerScope.onmessage = (event) => {
    const request = event.data;
    try {
        const result = optimizeBuildCore(
            request.weapon,
            request.availableMods,
            request.goal,
            request.slotCount,
            request.options,
        );
        workerScope.postMessage({ id: request.id, result });
    } catch (error) {
        workerScope.postMessage({
            id: request.id,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
