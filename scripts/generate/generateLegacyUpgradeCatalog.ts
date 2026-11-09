import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileAtomically } from "../lib/warframeItemsData";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const SOURCE = path.join(ROOT, "external/ih-ton-warframe-item-data/raw/upgrades.json");
const OUTPUT = path.join(ROOT, "src/data/_generated/legacy-upgrades.auto.json");
const SOURCE_COMMIT_SHA = "f93ac0a5a94e58a153d625d1cb013a7318ce1a1e";

type JsonMap = Record<string, unknown>;
type LegacyUpgradeIdentity = {
    path: string;
    name: string;
    category: "Mods";
    categories: string[];
    type?: string;
    subtype?: string;
    identitySource: "IhToN/warframe-item-data";
    sourceCommitSha: string;
};

function asMap(value: unknown, label: string): JsonMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    return value as JsonMap;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function buildLegacyUpgradeCatalog(input: {
    sourceRecords: readonly unknown[];
    existingModPaths: ReadonlySet<string>;
}): Record<string, LegacyUpgradeIdentity> {
    const output: Record<string, LegacyUpgradeIdentity> = {};

    for (const raw of input.sourceRecords) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const record = raw as Record<string, unknown>;
        const pathKey = asString(record.uniqueName);
        const name = asString(record.name);
        if (!pathKey?.startsWith("/Lotus/") || pathKey.includes("/Randomized/")) continue;
        if (!name || name.startsWith("/Lotus/Language/")) continue;
        if (input.existingModPaths.has(pathKey)) continue;

        const type = asString(record.type);
        const subtype = asString(record.subtype);
        const candidate: LegacyUpgradeIdentity = {
            path: pathKey,
            name,
            category: "Mods",
            categories: ["Mods"],
            ...(type ? { type } : {}),
            ...(subtype ? { subtype } : {}),
            identitySource: "IhToN/warframe-item-data",
            sourceCommitSha: SOURCE_COMMIT_SHA,
        };

        const prior = output[pathKey];
        if (prior && (prior.name !== candidate.name || prior.type !== candidate.type || prior.subtype !== candidate.subtype)) {
            throw new Error(`Conflicting legacy upgrade identities for ${pathKey}`);
        }
        output[pathKey] = candidate;
    }

    return Object.fromEntries(Object.entries(output).sort(([left], [right]) => left.localeCompare(right)));
}

async function readJson(filePath: string): Promise<unknown> {
    return JSON.parse(await readFile(filePath, "utf8"));
}

async function main(): Promise<void> {
    const sourceRoot = asMap(await readJson(SOURCE), "legacy upgrades source");
    const sourceRecords = sourceRoot.ExportUpgrades;
    if (!Array.isArray(sourceRecords)) throw new Error("legacy upgrades source has no ExportUpgrades array");

    const overframeMods = asMap(await readJson(path.join(ROOT, "external/overframe-gg/mods.json")), "Overframe mods");
    const wfcdMods = await readJson(path.join(ROOT, "external/warframe-items/raw/Mods.json"));
    const wfcdArcanes = await readJson(path.join(ROOT, "external/warframe-items/raw/Arcanes.json"));
    const publicExport = asMap(await readJson(path.join(ROOT, "src/data/_generated/public-export-mods.auto.json")), "Public Export Plus upgrades");
    if (!Array.isArray(wfcdMods) || !Array.isArray(wfcdArcanes)) {
        throw new Error("WFCD mod or arcane source has an invalid shape");
    }

    const existingModPaths = new Set(Object.keys(overframeMods));
    for (const raw of wfcdMods) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const record = raw as Record<string, unknown>;
        const pathKey = asString(record.uniqueName);
        if (pathKey && (record.category === "Mods" || pathKey.includes("/Randomized/"))) existingModPaths.add(pathKey);
    }
    for (const raw of wfcdArcanes) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const pathKey = asString((raw as Record<string, unknown>).uniqueName);
        if (pathKey) existingModPaths.add(pathKey);
    }
    const publicExportMods = asMap(publicExport.mods, "Public Export Plus mods");
    const publicExportRivens = asMap(publicExport.rivens, "Public Export Plus Rivens");
    for (const pathKey of [...Object.keys(publicExportMods), ...Object.keys(publicExportRivens)]) existingModPaths.add(pathKey);

    const result = buildLegacyUpgradeCatalog({ sourceRecords, existingModPaths });
    await writeFileAtomically(OUTPUT, JSON.stringify(result));
    console.log(`Generated legacy upgrade fallbacks (${Object.keys(result).length} exact identities).`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
    main().catch((error) => {
        console.error((error as Error).message);
        process.exitCode = 1;
    });
}
