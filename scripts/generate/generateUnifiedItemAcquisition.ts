import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";

import { buildAcquisitionIndex } from "../../src/catalog/items/buildAcquisitionIndex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "src/data/_generated/item-acquisition.byCatalogId.auto.json");

type CompactAcquisitionIndex = {
    sourcePool: string[];
    byCatalogId: Record<string, number[]>;
};

function compactAcquisitionIndex(
    acquisition: Record<string, { sources: string[] }>,
): CompactAcquisitionIndex {
    const sourcePool: string[] = [];
    const sourceIndex = new Map<string, number>();
    const byCatalogId: Record<string, number[]> = Object.create(null);

    for (const [catalogId, rec] of Object.entries(acquisition)) {
        const indices: number[] = [];
        for (const source of rec.sources ?? []) {
            let idx = sourceIndex.get(source);
            if (idx == null) {
                idx = sourcePool.length;
                sourceIndex.set(source, idx);
                sourcePool.push(source);
            }
            indices.push(idx);
        }
        if (indices.length > 0) byCatalogId[catalogId] = indices;
    }

    return { sourcePool, byCatalogId };
}

async function main(): Promise<void> {
    console.log("Building unified acquisition index...");
    const acquisition = buildAcquisitionIndex();
    const compact = compactAcquisitionIndex(acquisition);

    await writeFileAtomically(OUTPUT, JSON.stringify(compact, null, 2));
    console.log(
        `Done: ${Object.keys(acquisition).length} acquisition entries, ${compact.sourcePool.length} pooled sources written to ${OUTPUT}`,
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
