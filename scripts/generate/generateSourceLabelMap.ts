/**
 * generateSourceLabelMap.ts
 *
 * Source:  src/data/_generated/wfcd-source-label-map.auto.json  (sourceId → label)
 * Output:  src/data/_generated/source-label-map.auto.json        (label → sourceId)
 *
 * source-label-map.auto.json is the PRIMARY stable lookup used by sourceData.ts.
 * It takes priority over the reversed wfcd map and insulates the app from
 * upstream label/hash drift when wfcd-source-label-map regenerates.
 *
 * Run this after generateWfcdAcquisition.ts so it reflects the latest labels.
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const WFCD_MAP_INPUT = path.join(ROOT, "src/data/_generated/wfcd-source-label-map.auto.json");
const OUTPUT         = path.join(ROOT, "src/data/_generated/source-label-map.auto.json");

async function main(): Promise<void> {
    console.log("Reading", WFCD_MAP_INPUT);
    const wfcdMap: Record<string, string> = JSON.parse(await readFile(WFCD_MAP_INPUT, "utf-8"));

    const byLabel: Record<string, string> = {};

    for (const [sourceId, label] of Object.entries(wfcdMap)) {
        if (typeof sourceId !== "string" || typeof label !== "string") continue;
        const id  = sourceId.trim();
        const lbl = label.replace(/\s+/g, " ").trim();
        if (!id || !lbl) continue;
        // Last writer wins — but since sourceIds should be 1:1 with labels, no conflict expected
        byLabel[lbl] = id;
    }

    const out = {
        byLabel,
        defaults: { fallbackSourceId: "data:unknown" },
    };

    const json = JSON.stringify(out, null, 2);
    await writeFileAtomically(OUTPUT, json);
    console.log(`Done: ${Object.keys(byLabel).length} label→id entries written to ${OUTPUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
