import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    DROP_DATA_REQUIRED_FILES,
    inspectJsonText,
    validateDropDataAggregateMatches,
    validateDropDataJsonFile,
} from "./lib/externalDataPipeline";
import {
    buildResolvedWarframeItemsAll,
    readWarframeItemsFiles,
} from "./lib/warframeItemsData";
import { validateRelicMissionRewardReferences } from "./lib/relicData";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const ITEMS_DIR = path.join(ROOT, "external/warframe-items/raw");
const DROP_DIR = path.join(ROOT, "external/warframe-drop-data/raw");

async function main(): Promise<void> {
    const errors: string[] = [];
    let itemCount = 0;
    let itemFileCount = 0;
    let dropFileCount = 0;
    const dropValues = new Map<string, unknown>();

    try {
        const itemFiles = await readWarframeItemsFiles(ITEMS_DIR);
        const expectedAll = JSON.stringify(buildResolvedWarframeItemsAll(itemFiles));
        const actualAll = await readFile(path.join(ITEMS_DIR, "All.json"), "utf8");
        if (actualAll !== expectedAll) errors.push("All.json does not match the current categories and resolved Components.json catalog");
        itemCount = JSON.parse(actualAll).length as number;
        itemFileCount = itemFiles.size;
    } catch (error) {
        errors.push(`warframe-items: ${(error as Error).message}`);
    }

    const dropNames = (await readdir(DROP_DIR))
        .filter((name) => name.endsWith(".json") && !name.startsWith("."))
        .sort((a, b) => a.localeCompare(b));
    const dropNameSet = new Set(dropNames);
    const missingRequired = DROP_DATA_REQUIRED_FILES.filter((name) => !dropNameSet.has(name));
    if (missingRequired.length > 0) errors.push(`warframe-drop-data is missing required files: ${missingRequired.join(", ")}`);

    for (const fileName of dropNames) {
        try {
            const raw = await readFile(path.join(DROP_DIR, fileName), "utf8");
            const info = inspectJsonText(fileName, raw);
            // Keep syntactically valid tables available for aggregate/source
            // comparison even when field-level integrity checks reject them.
            dropValues.set(fileName, info.value);
            validateDropDataJsonFile(fileName, info.value);
            dropFileCount++;
        } catch (error) {
            errors.push(`warframe-drop-data/${fileName}: ${(error as Error).message}`);
        }
    }

    if (dropValues.has("all.json")) {
        try {
            validateDropDataAggregateMatches(dropValues.get("all.json"), dropValues);
        } catch (error) {
            errors.push(`warframe-drop-data/all.json: ${(error as Error).message}`);
        }
    }

    if (dropValues.has("missionRewards.json") && dropValues.has("relics.json")) {
        try {
            const missionSource = dropValues.get("missionRewards.json");
            const missionRewards = missionSource !== null && typeof missionSource === "object" && !Array.isArray(missionSource)
                ? (missionSource as Record<string, unknown>).missionRewards
                : undefined;
            validateRelicMissionRewardReferences(
                missionRewards,
                dropValues.get("relics.json"),
            );
        } catch (error) {
            errors.push(`warframe-drop-data relic references: ${(error as Error).message}`);
        }
    }

    console.log(`WFCD item coverage: ${itemCount} unique aggregate items across ${itemFileCount} category files.`);
    console.log(`WFCD drop-data coverage: ${dropFileCount}/${dropNames.length} JSON files passed schema and integrity checks.`);
    if (errors.length > 0) {
        for (const error of errors) console.error(`  [integrity failure] ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log("External raw data integrity passed.");
}

main().catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
});
