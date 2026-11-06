/**
 * generateRelicMissionIndex.ts
 *
 * Source: external/warframe-drop-data/raw/missionRewards.json
 * Output: src/data/_generated/relic-missionRewards-index.auto.json
 *
 * Extracts every relic drop from the mission rewards table and builds a flat
 * array of { relicKey, relicDisplay, pathLabel, rotation, chance } entries
 * for fast lookup in relicCatalog.ts.
 *
 * relicKey is the lowercased relic name without the "Relic" suffix,
 * e.g. "Lith D7 Relic" → "lith d7"
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { collectRelicMissionRewardRows } from "../lib/relicData";
import { writeFileAtomically } from "../lib/warframeItemsData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const INPUT  = path.join(ROOT, "external/warframe-drop-data/raw/missionRewards.json");
const OUTPUT = path.join(ROOT, "src/data/_generated/relic-missionRewards-index.auto.json");

interface MissionRewardsFile {
    missionRewards: unknown;
}

async function main(): Promise<void> {
    console.log("Reading", INPUT);
    const file: MissionRewardsFile = JSON.parse(await readFile(INPUT, "utf-8"));
    const rows = collectRelicMissionRewardRows(file.missionRewards);

    const json = JSON.stringify(rows, null, 2);
    await writeFileAtomically(OUTPUT, json);
    console.log(`Done: ${rows.length} relic drop entries written to ${OUTPUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
