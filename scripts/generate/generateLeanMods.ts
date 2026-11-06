/**
 * generateLeanMods.ts
 *
 * Source: external/overframe-gg/mods.json (manually exported from overframe.gg)
 * Output: src/data/_generated/mods-lean.auto.json
 *
 * Strips each entry's `data` object down to only the fields consumed by the app,
 * reducing the file from ~4 MB to ~200 KB.
 *
 * Fields kept from `data.*`:
 *   ItemCompatibility, CompatibilityTags, IncompatibilityTags
 *
 * Top-level fields kept: path, name, categories, parent, parents
 * (other top-level fields like tag, texture, storeData are not used by mod consumers)
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const INPUT  = path.join(ROOT, "external/overframe-gg/mods.json");
const OUTPUT = path.join(ROOT, "src/data/_generated/mods-lean.auto.json");

const TOP_FIELDS: ReadonlySet<string> = new Set([
    "path",
    "name",
    "categories",
    "parent",
    "parents",
]);

const DATA_FIELDS: ReadonlySet<string> = new Set([
    "ItemCompatibility",
    "CompatibilityTags",
    "IncompatibilityTags",
]);

async function main(): Promise<void> {
    console.log("Reading", INPUT);
    const raw: Record<string, unknown> = JSON.parse(await readFile(INPUT, "utf-8"));

    const out: Record<string, unknown> = {};

    for (const [lotusPath, entry] of Object.entries(raw)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const rec = entry as Record<string, unknown>;

        const lean: Record<string, unknown> = {};

        for (const field of TOP_FIELDS) {
            if (field in rec) lean[field] = rec[field];
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

    const json = JSON.stringify(out, null, 2);
    await writeFileAtomically(OUTPUT, json);

    const inKB  = Math.round((await readFile(INPUT)).length / 1024);
    const outKB = Math.round(Buffer.byteLength(json) / 1024);
    console.log(`Done: ${Object.keys(out).length} entries, ${inKB} KB → ${outKB} KB`);
    console.log("Written to", OUTPUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
