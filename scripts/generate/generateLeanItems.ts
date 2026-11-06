/**
 * generateLeanItems.ts
 *
 * Source: external/overframe-gg/items.json (manually exported from overframe.gg)
 * Output: src/data/_generated/items-lean.auto.json
 *
 * Strips each entry's `data` object down to only the fields actually consumed
 * by the app, reducing the file from ~8 MB to ~1 MB.
 *
 * Fields kept from `data.*`:
 *   Icon, MarketMode, RegularPrice, PremiumPrice, ShowInMarket,
 *   ProductCategory, resultItemType, ResultItem, type,
 *   CompatibilityTags, WeaponTypes, ArtifactSlots
 *
 * All top-level fields (categories, name, parent, parents, path, storeData,
 * storeItemType, tag, texture, texture_new, ProductCategory, id) are kept as-is.
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";
import { ITEMS_LEAN_DATA_FIELDS } from "./leanFieldContracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const INPUT  = path.join(ROOT, "external/overframe-gg/items.json");
const ALL_INPUT = path.join(ROOT, "external/warframe-items/raw/All.json");
const OUTPUT = path.join(ROOT, "src/data/_generated/items-lean.auto.json");

const DATA_FIELDS: ReadonlySet<string> = new Set(ITEMS_LEAN_DATA_FIELDS);

const GENERIC_COMPONENT_SLOT_NAMES = new Set([
    "barrel",
    "receiver",
    "stock",
    "chassis",
    "neuroptics",
    "systems",
    "harness",
    "wings",
    "blade",
    "hilt",
    "gauntlet",
    "handle",
    "grip",
    "string",
    "upper limb",
    "lower limb",
    "link",
    "disc",
    "core",
    "cerebrum",
    "carapace",
    "head",
    "blueprint",
]);

function safeString(v: unknown): string | null {
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function buildSyntheticComponentName(parentName: string, componentName: string): string {
    const slotNorm = componentName.trim().toLowerCase();
    if (slotNorm === "blueprint") return `${parentName} Blueprint`;
    if (GENERIC_COMPONENT_SLOT_NAMES.has(slotNorm)) return `${parentName} ${componentName}`;
    return componentName;
}

function buildSyntheticStoreItemType(pathKey: string): string {
    return pathKey.startsWith("/Lotus/")
        ? `/Lotus/StoreItems/Types${pathKey}`
        : pathKey;
}

function inferSyntheticBlueprintPath(componentPath: string): string {
    if (/Component$/i.test(componentPath)) {
        return componentPath.replace(/Component$/i, "Blueprint");
    }
    return `${componentPath}Blueprint`;
}

function synthesizeMissingComponentEntries(
    out: Record<string, unknown>,
    allItems: unknown[],
): number {
    let added = 0;

    for (const rawItem of allItems) {
        if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
        const item = rawItem as Record<string, unknown>;

        const parentName = safeString(item.name);
        const parentCategory = safeString(item.category);
        const parentProductCategory = safeString(item.productCategory);
        const parentUniqueName = safeString(item.uniqueName);
        const components = Array.isArray(item.components) ? item.components : [];

        if (!parentName || components.length === 0) continue;

        for (const rawComponent of components) {
            if (!rawComponent || typeof rawComponent !== "object" || Array.isArray(rawComponent)) continue;
            const component = rawComponent as Record<string, unknown>;

            const componentPath = safeString(component.uniqueName);
            const componentName = safeString(component.name);
            if (!componentPath || !componentName) continue;
            if (componentPath in out) continue;

            const isBlueprint = componentName.trim().toLowerCase() === "blueprint";
            const syntheticName = buildSyntheticComponentName(parentName, componentName);

            const lean: Record<string, unknown> = {
                name: syntheticName,
                path: componentPath,
                categories: [isBlueprint ? "blueprint" : "component"],
                parent: isBlueprint ? "/Lotus/Types/Game/RecipeItem" : "/Lotus/Types/Items/MiscItems/MiscItemBase",
                storeItemType: buildSyntheticStoreItemType(componentPath),
            };

            if (parentCategory) lean.category = parentCategory;
            if (parentUniqueName && isBlueprint) {
                lean.data = {
                    ProductCategory: "Recipes",
                    resultItemType: parentUniqueName,
                    type: parentCategory ?? null,
                };
            } else {
                lean.data = {
                    ProductCategory: parentProductCategory ?? "MiscItems",
                    type: isBlueprint ? (parentCategory ?? null) : "Component",
                };
            }

            out[componentPath] = lean;
            added++;

            if (!isBlueprint) {
                const drops = Array.isArray(component.drops) ? component.drops : [];
                const blueprintDropType = drops
                    .map((drop) => (drop && typeof drop === "object" && !Array.isArray(drop)) ? safeString((drop as Record<string, unknown>).type) : null)
                    .find((name) => !!name && /\bblueprint\b/i.test(name));

                if (blueprintDropType) {
                    const blueprintPath = inferSyntheticBlueprintPath(componentPath);
                    if (!(blueprintPath in out)) {
                        out[blueprintPath] = {
                            name: blueprintDropType,
                            path: blueprintPath,
                            categories: ["blueprint"],
                            parent: "/Lotus/Types/Game/RecipeItem",
                            storeItemType: buildSyntheticStoreItemType(blueprintPath),
                            ...(parentCategory ? { category: parentCategory } : {}),
                            data: {
                                ProductCategory: "Recipes",
                                resultItemType: componentPath,
                                type: parentCategory ?? null,
                            },
                        };
                        added++;
                    }
                }
            }
        }
    }

    return added;
}

async function main(): Promise<void> {
    console.log("Reading", INPUT);
    const raw: Record<string, unknown> = JSON.parse(await readFile(INPUT, "utf-8"));
    const allItems: unknown[] = JSON.parse(await readFile(ALL_INPUT, "utf-8"));

    const out: Record<string, unknown> = {};

    for (const [lotusPath, entry] of Object.entries(raw)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const rec = entry as Record<string, unknown>;

        const lean: Record<string, unknown> = {};

        for (const [k, v] of Object.entries(rec)) {
            if (k !== "data") lean[k] = v;
        }

        const data = rec.data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
            const d = data as Record<string, unknown>;
            const leanData: Record<string, unknown> = {};
            for (const field of DATA_FIELDS) {
                if (field in d) leanData[field] = d[field];
            }
            if (Object.keys(leanData).length > 0) lean.data = leanData;
        }

        out[lotusPath] = lean;
    }

    const syntheticCount = synthesizeMissingComponentEntries(out, allItems);

    const json = JSON.stringify(out, null, 2);
    await writeFileAtomically(OUTPUT, json);

    const inKB  = Math.round((await readFile(INPUT)).length / 1024);
    const outKB = Math.round(Buffer.byteLength(json) / 1024);
    console.log(`Done: ${Object.keys(out).length} entries (${syntheticCount} synthesized), ${inKB} KB → ${outKB} KB`);
    console.log("Written to", OUTPUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
