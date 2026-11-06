/**
 * Generate canonical crafting requirement edges from WFCD category refs and
 * the resolved Components catalog.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileAtomically, readWarframeItemsFiles, buildWfcdRequirements } from "../lib/warframeItemsData";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const RAW_DIR = path.join(ROOT, "external/warframe-items/raw");
const OUTPUT = path.join(ROOT, "src/data/_generated/wfcd-requirements.byCatalogId.auto.json");

async function main(): Promise<void> {
    const files = await readWarframeItemsFiles(RAW_DIR);
    const requirements = buildWfcdRequirements(files);
    const json = JSON.stringify(requirements, null, 2);
    await writeFileAtomically(OUTPUT, json);
    console.log(`WFCD requirements: ${Object.keys(requirements).length} recipes from ${files.size} source files written to ${OUTPUT}`);
}

main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
