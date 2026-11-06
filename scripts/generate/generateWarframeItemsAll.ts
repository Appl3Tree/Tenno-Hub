/**
 * Rebuild the local All.json compatibility aggregate from WFCD's current
 * category files and Components.json reference catalog.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWarframeItemsAll } from "../lib/warframeItemsData";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const RAW_DIR = path.join(ROOT, "external/warframe-items/raw");

async function main(): Promise<void> {
    const result = await generateWarframeItemsAll(RAW_DIR);
    console.log(`Generated All.json: ${result.count} unique items, ${result.bytes} bytes.`);
}

main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
