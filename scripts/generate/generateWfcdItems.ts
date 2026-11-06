/**
 * Index all WFCD item categories, including the separate Components catalog.
 * Source: external/warframe-items/raw/*.json (except generated All and i18n)
 * Output: src/data/_generated/wfcd-items.byCatalogId.auto.json
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileAtomically, readWarframeItemsFiles, buildResolvedWarframeItemsAll } from "../lib/warframeItemsData";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const RAW_DIR = path.join(ROOT, "external/warframe-items/raw");
const OUTPUT = path.join(ROOT, "src/data/_generated/wfcd-items.byCatalogId.auto.json");

function safeStr(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function safeNum(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeBool(value: unknown): boolean {
    return value === true;
}

function safeTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((tag): tag is string => typeof tag === "string");
}

async function main(): Promise<void> {
    const files = await readWarframeItemsFiles(RAW_DIR);
    // Keep this generator fail-closed on unresolved references and duplicate
    // canonical paths, even though the output itself is a flat index.
    const all = buildResolvedWarframeItemsAll(files);
    const sourceByUniqueName = new Map<string, string>();
    for (const [file, records] of files) {
        for (const record of records) sourceByUniqueName.set(String((record as Record<string, unknown>).uniqueName), file);
    }

    const out: Record<string, unknown> = {};
    for (const item of all) {
        const catalogId = `items:${item.uniqueName}`;
        if (out[catalogId]) throw new Error(`Duplicate canonical item ${catalogId} while generating WFCD item index`);
        out[catalogId] = {
            name: safeStr(item.name),
            category: safeStr(item.category),
            productCategory: safeStr(item.productCategory) ?? null,
            type: safeStr(item.type),
            tags: safeTags(item.tags),
            masteryReq: safeNum(item.masteryReq),
            masterable: safeBool(item.masterable),
            tradable: safeBool(item.tradable),
            wfcdFile: sourceByUniqueName.get(item.uniqueName) ?? "unknown",
            source: "wfcd",
        };
    }

    const json = JSON.stringify(out, null, 2);
    await writeFileAtomically(OUTPUT, json);
    console.log(`WFCD items: ${Object.keys(out).length} unique entries from ${files.size} source files; All.json validated (${all.length} records).`);
}

main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
