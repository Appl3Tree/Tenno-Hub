import { FULL_CATALOG } from "../../domain/catalog/loadFullCatalog";
import type { AcquisitionDef } from "./acquisitionFromSources";

const SYNTHICATOR_RECIPE_PREFIX = "/Lotus/Types/Recipes/SynthicatorRecipes/";

function safeString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function deriveSynthicatorBlueprintAcquisitionByCatalogId(): Record<string, AcquisitionDef> {
    const out: Record<string, AcquisitionDef> = Object.create(null);
    const recordsById: Record<string, any> = (FULL_CATALOG as any).recordsById ?? {};

    for (const [catalogId, rec] of Object.entries(recordsById)) {
        const path = safeString(rec?.path) ?? safeString(rec?.raw?.rawLotus?.path);
        if (!path?.startsWith(SYNTHICATOR_RECIPE_PREFIX)) continue;

        out[catalogId] = { sources: ["data:vendor/cetus/nakak/synthicator-blueprints"] };
    }

    return out;
}
