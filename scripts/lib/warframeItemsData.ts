import { readFile, readdir, rename, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type WarframeItemRecord = Record<string, unknown> & {
    uniqueName: string;
    name: string;
    components?: unknown[];
};

export type WarframeItemsFileMap = Map<string, unknown[]>;

export const WARFRAME_ITEMS_REQUIRED_FILES = [
    "Arcanes.json",
    "Arch-Gun.json",
    "Arch-Melee.json",
    "Archwing.json",
    "Components.json",
    "Gear.json",
    "Melee.json",
    "Misc.json",
    "Mods.json",
    "Pets.json",
    "Primary.json",
    "Railjack.json",
    "Relics.json",
    "Resources.json",
    "Secondary.json",
    "SentinelWeapons.json",
    "Sentinels.json",
    "Warframes.json",
] as const;

export const WARFRAME_ITEMS_GENERATED_FILE = "All.json";
export const WARFRAME_ITEMS_IGNORED_FILE = "i18n.json";

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function positiveQuantity(value: unknown, fallback = 1): number {
    const quantity = value === undefined ? fallback : value;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`component itemCount must be a positive finite number (received ${String(quantity)})`);
    }
    return quantity;
}

export function parseWarframeItemCategory(fileName: string, value: unknown): WarframeItemRecord[] {
    if (!Array.isArray(value)) {
        throw new Error(`${fileName} must contain a JSON array of item records`);
    }
    if (value.length === 0) {
        throw new Error(`${fileName} contains an empty item array`);
    }

    return value.map((raw, index) => {
        if (!isRecord(raw)) {
            throw new Error(`${fileName}[${index}] must be an object`);
        }
        if (!nonEmptyString(raw.uniqueName)) {
            throw new Error(`${fileName}[${index}] is missing a non-empty uniqueName`);
        }
        if (!nonEmptyString(raw.name)) {
            throw new Error(`${fileName}[${index}] (${raw.uniqueName}) is missing a non-empty name`);
        }
        if (raw.components !== undefined && !Array.isArray(raw.components)) {
            throw new Error(`${fileName}[${index}] (${raw.uniqueName}).components must be an array when present`);
        }
        return raw as WarframeItemRecord;
    });
}

export function itemSourceNames(fileNames: Iterable<string>): string[] {
    return [...fileNames]
        .filter((name) => name.endsWith(".json"))
        .filter((name) => name !== WARFRAME_ITEMS_GENERATED_FILE)
        .filter((name) => name !== WARFRAME_ITEMS_IGNORED_FILE)
        .filter((name) => !name.startsWith("."))
        .sort((a, b) => a.localeCompare(b));
}

export async function readWarframeItemsFiles(rawDir: string): Promise<WarframeItemsFileMap> {
    const names = itemSourceNames(await readdir(rawDir));
    const files = new Map<string, unknown[]>();

    for (const name of names) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(await readFile(path.join(rawDir, name), "utf8"));
        } catch (error) {
            throw new Error(`${name} is not valid JSON: ${(error as Error).message}`);
        }
        files.set(name, parseWarframeItemCategory(name, parsed));
    }

    for (const required of WARFRAME_ITEMS_REQUIRED_FILES) {
        if (!files.has(required)) {
            throw new Error(`Required WFCD item source ${required} is missing from ${rawDir}`);
        }
    }
    return files;
}

function entriesSortedByFile(files: WarframeItemsFileMap): Array<{ file: string; record: WarframeItemRecord }> {
    return [...files.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([file, values]) => parseWarframeItemCategory(file, values).map((record) => ({ file, record })));
}

/**
 * Reproduce WFCD's @wfcd/items default aggregation semantics:
 * load every category and Components record, overlay category records on the
 * component catalog, expand one level of lightweight component references,
 * then sort by name and uniqueName.
 */
export function buildResolvedWarframeItemsAll(files: WarframeItemsFileMap): WarframeItemRecord[] {
    for (const required of WARFRAME_ITEMS_REQUIRED_FILES) {
        if (!files.has(required)) {
            throw new Error(`Required WFCD item source ${required} is missing; cannot build All.json`);
        }
    }

    const rows = entriesSortedByFile(files);
    const sourceByUniqueName = new Map<string, string>();
    for (const { file, record } of rows) {
        const priorFile = sourceByUniqueName.get(record.uniqueName);
        if (priorFile) {
            throw new Error(`Duplicate WFCD uniqueName ${record.uniqueName} appears in both ${priorFile} and ${file}`);
        }
        sourceByUniqueName.set(record.uniqueName, file);
    }

    const byUniqueName = new Map<string, WarframeItemRecord>();
    // WFCD starts with Components.json, then lets real category records win.
    for (const { record } of rows.filter(({ file }) => file === "Components.json")) {
        byUniqueName.set(record.uniqueName, record);
    }
    for (const { file, record } of rows) {
        if (file !== "Components.json") byUniqueName.set(record.uniqueName, record);
    }

    const output = rows.map(({ file, record }) => {
        if (!Array.isArray(record.components)) return { ...record };
        const components = record.components.map((rawComponent, index) => {
            if (!isRecord(rawComponent)) {
                throw new Error(`${file} (${record.uniqueName}).components[${index}] must be an object`);
            }
            const componentPath = rawComponent.uniqueName;
            if (!nonEmptyString(componentPath)) {
                throw new Error(`${file} (${record.uniqueName}).components[${index}] is missing uniqueName`);
            }

            let itemCount: number;
            try {
                itemCount = positiveQuantity(rawComponent.itemCount);
            } catch (error) {
                throw new Error(`${file} (${record.uniqueName}) component ${componentPath}: ${(error as Error).message}`);
            }

            const component = byUniqueName.get(componentPath);
            if (!component) {
                throw new Error(`${file} (${record.uniqueName}) references unresolved component ${componentPath}`);
            }

            // This matches WFCD's resolver: already expanded references keep
            // their payload; refs-only records are looked up and copied.
            if (rawComponent.name || rawComponent.imageName || rawComponent.drops) {
                return { ...rawComponent, itemCount };
            }

            const resolved: Record<string, unknown> = { ...component };
            delete resolved.parentUniqueNames;
            resolved.itemCount = itemCount;
            return resolved;
        });
        return { ...record, components };
    });

    output.sort((a, b) => a.name.localeCompare(b.name) || a.uniqueName.localeCompare(b.uniqueName));

    const outputIds = new Set<string>();
    for (const item of output) {
        if (outputIds.has(item.uniqueName)) {
            throw new Error(`All.json would contain duplicate uniqueName ${item.uniqueName}`);
        }
        outputIds.add(item.uniqueName);
    }
    return output;
}

export function buildWfcdRequirements(files: WarframeItemsFileMap): Record<string, {
    outputCatalogId: string;
    components: Array<{ catalogId: string; count: number }>;
    note: string;
}> {
    // Building All also provides strict source and component-reference checks.
    buildResolvedWarframeItemsAll(files);
    const allIds = new Set(entriesSortedByFile(files).map(({ record }) => record.uniqueName));
    const output: Record<string, {
        outputCatalogId: string;
        components: Array<{ catalogId: string; count: number }>;
        note: string;
    }> = {};

    for (const { file, record } of entriesSortedByFile(files)) {
        if (!Array.isArray(record.components) || record.components.length === 0) continue;
        const components = record.components.map((rawComponent, index) => {
            if (!isRecord(rawComponent) || !nonEmptyString(rawComponent.uniqueName)) {
                throw new Error(`${file} (${record.uniqueName}).components[${index}] has no valid uniqueName`);
            }
            let count: number;
            try {
                count = positiveQuantity(rawComponent.itemCount);
            } catch (error) {
                throw new Error(`${file} (${record.uniqueName}) component ${rawComponent.uniqueName}: ${(error as Error).message}`);
            }
            if (!allIds.has(rawComponent.uniqueName)) {
                throw new Error(`${file} (${record.uniqueName}) requires ${rawComponent.uniqueName}, which is absent from all item sources`);
            }
            return { catalogId: `items:${rawComponent.uniqueName}`, count };
        });
        const catalogId = `items:${record.uniqueName}`;
        if (output[catalogId]) throw new Error(`Duplicate requirements output ${catalogId} (${file})`);
        output[catalogId] = {
            outputCatalogId: catalogId,
            components,
            note: `WFCD recipe (${file})`,
        };
    }
    return output;
}

export async function writeFileAtomically(targetPath: string, contents: string): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        await writeFile(tempPath, contents, { encoding: "utf8", flag: "wx" });
        await rename(tempPath, targetPath);
    } finally {
        await rm(tempPath, { force: true });
    }
}

export async function generateWarframeItemsAll(rawDir: string): Promise<{ count: number; bytes: number }> {
    const files = await readWarframeItemsFiles(rawDir);
    const all = buildResolvedWarframeItemsAll(files);
    const json = JSON.stringify(all);
    const outputPath = path.join(rawDir, WARFRAME_ITEMS_GENERATED_FILE);
    await writeFileAtomically(outputPath, json);
    return { count: all.length, bytes: Buffer.byteLength(json) };
}
