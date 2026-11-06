import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";

import { FULL_CATALOG } from "../../src/domain/catalog/loadFullCatalog";
import { resolveItemRequirementGraph } from "../../src/catalog/items/itemRequirements";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "src/data/_generated/relic-goal-index.auto.json");

type RelicGoalIndexRow = {
    displayName: string;
    edges: Array<{
        catalogId: string;
        count: number;
    }>;
};

async function main(): Promise<void> {
    const queue = [...FULL_CATALOG.displayableInventoryItemIds];
    const seen = new Set<string>();
    const index: Record<string, RelicGoalIndexRow> = {};

    while (queue.length > 0) {
        const catalogId = String(queue.shift() ?? "");
        if (!catalogId || seen.has(catalogId)) continue;
        seen.add(catalogId);

        const rec = FULL_CATALOG.recordsById[catalogId];
        if (!rec) continue;

        const resolution = resolveItemRequirementGraph(catalogId);
        const edges = resolution.edges
            .map((edge) => ({
                catalogId: String(edge.catalogId),
                count: Math.max(1, Math.floor(Number(edge.count ?? 1) || 1)),
            }))
            .filter((edge) => edge.catalogId.length > 0);

        index[catalogId] = {
            displayName: rec.displayName ?? catalogId,
            edges,
        };

        for (const edge of edges) {
            if (!seen.has(edge.catalogId)) queue.push(edge.catalogId);
        }
    }

    const json = JSON.stringify(index, null, 2);
    await writeFileAtomically(OUTPUT, json);
    console.log(`Done: ${Object.keys(index).length} entries written to ${OUTPUT}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
