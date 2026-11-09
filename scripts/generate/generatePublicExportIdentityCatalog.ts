import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileAtomically } from "../lib/warframeItemsData";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const RAW = path.join(ROOT, "external/warframe-public-export-plus/raw");
const OUTPUT_ITEMS = path.join(ROOT, "src/data/_generated/public-export-items.auto.json");
const OUTPUT_MODS = path.join(ROOT, "src/data/_generated/public-export-mods.auto.json");
const PEELY_PIX_SOURCE = path.join(ROOT, "external/cephalon-kronos-peely-pix/raw/peely-pix-names.json");
const PEELY_PIX_SOURCE_COMMIT_SHA = "08887d766ddfd03c855be200053daa19c4f9705d";

type JsonMap = Record<string, unknown>;
type IdentityRecord = {
    name: string;
    path: string;
    category: string;
    categories: string[];
    parent?: string;
    data?: Record<string, unknown>;
};

const ITEM_CATEGORIES = new Set([
    "Consumables", "LevelKeys", "MiscItems", "Recipes", "CrewShipAmmo", "CrewShipRawSalvage",
    "ShipDecorations", "FusionTreasures", "FlavourItems", "LongGuns", "Melee", "Pistols",
    "Suits", "SentinelWeapons", "Sentinels", "SpaceSuits", "SpaceMelee", "SpaceGuns", "Ships",
    "Scoops", "SpecialItems", "DataKnives", "MechSuits", "CrewShipHarnesses", "CrewShips",
    "DrifterMelee", "Horses", "OperatorSuits", "OperatorAmps", "Motorcycles", "KubrowPets",
    "CrewShipWeapons", "CrewShipWeaponSkins", "Drones", "WeaponSkins",
]);

const ITEM_EXPORTS: Array<{ file: string; fallbackCategory: string }> = [
    // Abilities can be recipe result identities even though they are not
    // inventory records themselves. Load their localized names for recipes.
    { file: "ExportAbilities.json", fallbackCategory: "" },
    { file: "ExportWarframes.json", fallbackCategory: "Suits" },
    { file: "ExportWeapons.json", fallbackCategory: "" },
    { file: "ExportRailjackWeapons.json", fallbackCategory: "CrewShipWeapons" },
    { file: "ExportSentinels.json", fallbackCategory: "" },
    { file: "ExportResources.json", fallbackCategory: "" },
    { file: "ExportCustoms.json", fallbackCategory: "" },
    { file: "ExportFlavour.json", fallbackCategory: "FlavourItems" },
    { file: "ExportGear.json", fallbackCategory: "Consumables" },
    { file: "ExportKeys.json", fallbackCategory: "LevelKeys" },
    { file: "ExportDrones.json", fallbackCategory: "Drones" },
    { file: "ExportRecipes.json", fallbackCategory: "Recipes" },
];

function asMap(value: unknown, label: string): JsonMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} must be an object map`);
    }
    return value as JsonMap;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveLocalizedName(value: unknown, dictionary: JsonMap): string | null {
    const source = asString(value);
    if (!source) return null;
    const translated = asString(dictionary[source]);
    if (translated) return translated;
    return source.startsWith("/Lotus/Language/") ? null : source;
}

function isPathMap(value: JsonMap): boolean {
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((key) => key.startsWith("/Lotus/"));
}

function humanizePathLeaf(pathKey: string): string {
    const leaf = pathKey.split("/").at(-1) ?? pathKey;
    return leaf
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export interface PublicExportIdentityInputs {
    dictionary: JsonMap;
    exports: Record<string, JsonMap>;
    peelyPixNames: JsonMap;
    existingItemPaths: ReadonlySet<string>;
    existingModPaths: ReadonlySet<string>;
    existingItemNames?: ReadonlyMap<string, string>;
}

export interface PublicExportIdentityCatalog {
    items: Record<string, IdentityRecord>;
    mods: Record<string, IdentityRecord>;
    rivens: Record<string, IdentityRecord>;
}

export function buildPublicExportIdentityCatalog(
    input: PublicExportIdentityInputs,
): PublicExportIdentityCatalog {
    const items: Record<string, IdentityRecord> = {};
    const mods: Record<string, IdentityRecord> = {};
    const rivens: Record<string, IdentityRecord> = {};
    const itemNames = new Map<string, string>(input.existingItemNames ?? []);

    for (const { file } of ITEM_EXPORTS) {
        const source = input.exports[file];
        if (!source || !isPathMap(source)) throw new Error(`${file} is missing or is not path-keyed`);
        for (const [pathKey, raw] of Object.entries(source)) {
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
            const record = raw as Record<string, unknown>;
            const localizedName = resolveLocalizedName(record.name, input.dictionary);
            if (localizedName) itemNames.set(pathKey, localizedName);
        }
    }

    for (const { file, fallbackCategory } of ITEM_EXPORTS) {
        if (file === "ExportAbilities.json") continue;
        const source = input.exports[file]!;
        for (const [pathKey, raw] of Object.entries(source)) {
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
            const sourceRecord = raw as Record<string, unknown>;
            const productCategory = asString(sourceRecord.productCategory) ?? fallbackCategory;
            if (!productCategory || !ITEM_CATEGORIES.has(productCategory)) continue;
            if (input.existingItemPaths.has(pathKey)) continue;

            let name = resolveLocalizedName(sourceRecord.name, input.dictionary);
            let resultItemType: string | null = null;
            let parent: string | undefined;
            let categories = [productCategory];
            let data: Record<string, unknown> | undefined;
            if (file === "ExportRecipes.json") {
                resultItemType = asString(sourceRecord.resultType);
                if (!resultItemType) continue;
                const resultName = resultItemType ? itemNames.get(resultItemType) : null;
                const template = resolveLocalizedName("/Lotus/Language/Items/BlueprintAndItem", input.dictionary);
                name = resultName
                    ? template?.includes("|ITEM|")
                        ? template.replaceAll("|ITEM|", resultName)
                        : `${resultName} Blueprint`
                    : `Untranslated recipe: ${humanizePathLeaf(pathKey)}`;
                categories = ["blueprint"];
                parent = "/Lotus/Types/Game/RecipeItem";
                data = {
                    ProductCategory: "Recipes",
                    resultItemType,
                    identityNameSource: resultName ? "public-export-result" : "recipe-path-fallback",
                };
            }
            if (!name) continue;
            const output: IdentityRecord = {
                name,
                path: pathKey,
                category: productCategory,
                categories,
                ...(parent ? { parent } : {}),
                ...(data ? { data } : {}),
            };
            if (productCategory) output.data = { ...(output.data ?? {}), ProductCategory: productCategory };
            items[pathKey] = output;
            itemNames.set(pathKey, name);
        }
    }

    // Peely Pix are upgrade-path records in RawUpgrades, but they are counted
    // sticker inventory rather than owned mods or arcanes. Keep their generic
    // path/name catalog separate from personalized inventory data.
    for (const [pathKey, raw] of Object.entries(input.peelyPixNames)) {
        if (!pathKey.startsWith("/Lotus/Upgrades/Stickers/")) {
            throw new Error(`Unexpected Peely Pix identity path: ${pathKey}`);
        }
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new Error(`Peely Pix identity record must be an object: ${pathKey}`);
        }
        const name = resolveLocalizedName((raw as Record<string, unknown>).name, input.dictionary);
        if (!name) throw new Error(`Peely Pix identity has no resolved name: ${pathKey}`);
        if (input.existingItemPaths.has(pathKey)) continue;
        items[pathKey] = {
            name,
            path: pathKey,
            category: "Peely Pix",
            categories: ["Peely Pix"],
            data: {
                ProductCategory: "Peely Pix",
                identitySource: "cephalon-kronos-peely-pix",
                sourceCommitSha: PEELY_PIX_SOURCE_COMMIT_SHA,
            },
        };
        itemNames.set(pathKey, name);
    }

    const upgradeFiles = ["ExportUpgrades.json", "ExportArcanes.json", "ExportAvionics.json"];
    for (const file of upgradeFiles) {
        const source = input.exports[file];
        if (!source || !isPathMap(source)) throw new Error(`${file} is missing or is not path-keyed`);
        for (const [pathKey, raw] of Object.entries(source)) {
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
            const name = resolveLocalizedName((raw as Record<string, unknown>).name, input.dictionary);
            if (!name) continue;
            const randomized = pathKey.includes("/Randomized/");
            if (randomized) {
                if (input.existingModPaths.has(pathKey)) continue;
                rivens[pathKey] = {
                    name, path: pathKey, category: "Rivens", categories: ["riven"],
                    data: { publicExportSource: file },
                };
                continue;
            }
            if (input.existingModPaths.has(pathKey)) continue;
            const sourceRecord = raw as Record<string, unknown>;
            const category = file === "ExportArcanes.json" ? "Arcanes" : "Mods";
            mods[pathKey] = {
                name,
                path: pathKey,
                category,
                categories: [category],
                data: {
                    ...(asString(sourceRecord.type) ? { type: sourceRecord.type } : {}),
                    publicExportSource: file,
                },
            };
        }
    }

    return { items, mods, rivens };
}

async function readJson(filePath: string): Promise<unknown> {
    return JSON.parse(await readFile(filePath, "utf8"));
}

async function main(): Promise<void> {
    const dictionary = asMap(await readJson(path.join(RAW, "dict.en.json")), "dict.en.json");
    const peelyPixNames = asMap(await readJson(PEELY_PIX_SOURCE), "Peely Pix name map");
    const files = [
        ...ITEM_EXPORTS.map(({ file }) => file),
        "ExportUpgrades.json", "ExportArcanes.json", "ExportAvionics.json",
    ];
    const exports: Record<string, JsonMap> = {};
    for (const file of new Set(files)) exports[file] = asMap(await readJson(path.join(RAW, file)), file);

    const overframeItems = asMap(await readJson(path.join(ROOT, "external/overframe-gg/items.json")), "Overframe items");
    const overframeMods = asMap(await readJson(path.join(ROOT, "external/overframe-gg/mods.json")), "Overframe mods");
    const allItems = await readJson(path.join(ROOT, "external/warframe-items/raw/All.json"));
    const wfcdMods = await readJson(path.join(ROOT, "external/warframe-items/raw/Mods.json"));
    const wfcdArcanes = await readJson(path.join(ROOT, "external/warframe-items/raw/Arcanes.json"));
    if (!Array.isArray(allItems) || !Array.isArray(wfcdMods) || !Array.isArray(wfcdArcanes)) {
        throw new Error("WFCD item, mod, or arcane source has an invalid shape");
    }

    const existingItemPaths = new Set([
        ...Object.keys(overframeItems),
        ...allItems.map((item) => item && typeof item === "object" ? asString((item as Record<string, unknown>).uniqueName) : null).filter((value): value is string => !!value),
    ]);
    const existingModPaths = new Set([
        ...Object.keys(overframeMods),
        ...wfcdMods.filter((value) => value && typeof value === "object" && (value as Record<string, unknown>).category === "Mods")
            .map((value) => asString((value as Record<string, unknown>).uniqueName)).filter((value): value is string => !!value),
        ...wfcdMods.filter((value) => value && typeof value === "object" && asString((value as Record<string, unknown>).uniqueName)?.includes("/Randomized/"))
            .map((value) => asString((value as Record<string, unknown>).uniqueName)).filter((value): value is string => !!value),
        ...wfcdArcanes.map((value) => value && typeof value === "object" ? asString((value as Record<string, unknown>).uniqueName) : null).filter((value): value is string => !!value),
    ]);
    const existingItemNames = new Map<string, string>();
    for (const [pathKey, raw] of Object.entries(overframeItems)) {
        const name = raw && typeof raw === "object" ? asString((raw as Record<string, unknown>).name) : null;
        if (name) existingItemNames.set(pathKey, name);
    }
    for (const raw of allItems) {
        if (!raw || typeof raw !== "object") continue;
        const record = raw as Record<string, unknown>;
        const key = asString(record.uniqueName);
        const name = asString(record.name);
        if (key && name && !existingItemNames.has(key)) existingItemNames.set(key, name);
    }

    const result = buildPublicExportIdentityCatalog({
        dictionary,
        exports,
        peelyPixNames,
        existingItemPaths,
        existingModPaths,
        existingItemNames,
    });
    await writeFileAtomically(OUTPUT_ITEMS, JSON.stringify(result.items));
    await writeFileAtomically(OUTPUT_MODS, JSON.stringify({ mods: result.mods, rivens: result.rivens }));
    console.log(`Generated Public Export Plus identity supplements (${Object.keys(result.items).length} items, ${Object.keys(result.mods).length} upgrades, ${Object.keys(result.rivens).length} Riven templates).`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
    main().catch((error) => {
        console.error((error as Error).message);
        process.exitCode = 1;
    });
}
