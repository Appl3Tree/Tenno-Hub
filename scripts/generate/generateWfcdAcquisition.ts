/**
 * generateWfcdAcquisition.ts
 *
 * Sources:
 *   - external/warframe-drop-data/raw/syndicates.json
 *   - src/data/_generated/items-lean.auto.json       (name index)
 *   - src/data/_generated/wfcd-items.byCatalogId.auto.json  (name index)
 *
 * Outputs:
 *   - src/data/_generated/wfcd-source-label-map.auto.json   (sourceId → label)
 *   - src/data/_generated/wfcd-acquisition.byCatalogId.auto.json (catalogId → { sources })
 *   - src/data/_generated/wfcd-acquisition.unresolved.json  (itemName → { count, examples })
 *
 * Source ID format: "data:drop:" + sha1(label).slice(0, 10)
 * where label = "Syndicate Vendor: ${syndicateName} (${place})"
 */

import { readFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";
import {
    normalizeWfcdAcquisitionName as normalizeNoPunct,
    resolveWfcdAcquisitionItemName as resolveItemName,
} from "../lib/wfcdAcquisition";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const SYNDICATES_INPUT    = path.join(ROOT, "external/warframe-drop-data/raw/syndicates.json");
const ITEMS_LEAN_INPUT    = path.join(ROOT, "src/data/_generated/items-lean.auto.json");
const WFCD_ITEMS_INPUT    = path.join(ROOT, "src/data/_generated/wfcd-items.byCatalogId.auto.json");

const LABEL_MAP_OUTPUT    = path.join(ROOT, "src/data/_generated/wfcd-source-label-map.auto.json");
const ACQUISITION_OUTPUT  = path.join(ROOT, "src/data/_generated/wfcd-acquisition.byCatalogId.auto.json");
const UNRESOLVED_OUTPUT   = path.join(ROOT, "src/data/_generated/wfcd-acquisition.unresolved.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha1Hex(s: string): string {
    return createHash("sha1").update(s, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sourceIdFromLabel(label: string): string {
    return `data:drop:${sha1Hex(label).slice(0, 10)}`;
}

/** Strip leading quantity prefixes like "5x", "300X" */
function stripQty(s: string): string {
    return s.replace(/^\s*\d+\s*[xX]\s*/g, "").trim();
}

// ---------------------------------------------------------------------------
// Build name → catalogId index
// ---------------------------------------------------------------------------

async function buildNameIndex(): Promise<Map<string, string>> {
    const index = new Map<string, string>();

    function addEntry(normalizedName: string, catalogId: string): void {
        if (!normalizedName || !catalogId) return;
        // First writer wins — prefer wfcd-items entries as they're more canonical
        if (!index.has(normalizedName)) index.set(normalizedName, catalogId);
    }

    // 1) From wfcd-items (already keyed as "items:/Lotus/...")
    const wfcdItems: Record<string, { name?: string | null }> =
        JSON.parse(await readFile(WFCD_ITEMS_INPUT, "utf-8"));

    for (const [catalogId, rec] of Object.entries(wfcdItems)) {
        const name = typeof rec?.name === "string" ? rec.name.trim() : "";
        if (!name) continue;
        addEntry(normalizeNoPunct(name), catalogId);
        // Also index without "Blueprint" suffix
        const noBp = name.replace(/\bBlueprint\b/gi, "").trim();
        if (noBp && noBp !== name) addEntry(normalizeNoPunct(noBp), catalogId);
    }

    // 2) From items-lean (keyed as "/Lotus/...", prefix with "items:")
    const itemsLean: Record<string, { name?: string | null }> =
        JSON.parse(await readFile(ITEMS_LEAN_INPUT, "utf-8"));

    for (const [lotusPath, rec] of Object.entries(itemsLean)) {
        const catalogId = `items:${lotusPath}`;
        const name = typeof rec?.name === "string" ? rec.name.trim() : "";
        if (!name) continue;
        addEntry(normalizeNoPunct(name), catalogId);
        const noBp = name.replace(/\bBlueprint\b/gi, "").trim();
        if (noBp && noBp !== name) addEntry(normalizeNoPunct(noBp), catalogId);
    }

    return index;
}

// ---------------------------------------------------------------------------
// Resolve an item name string to a catalogId
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    console.log("Building name index from items-lean + wfcd-items...");
    const nameIndex = await buildNameIndex();
    console.log(`  Name index: ${nameIndex.size} entries`);

    console.log("Reading syndicates.json...");
    const parsedSyndicates: unknown = JSON.parse(await readFile(SYNDICATES_INPUT, "utf-8"));
    const syndicatesValue = isRecord(parsedSyndicates) && "syndicates" in parsedSyndicates
        ? parsedSyndicates.syndicates
        : parsedSyndicates;
    if (!isRecord(syndicatesValue)) {
        throw new Error("syndicates.json must be an object or contain an object-valued syndicates field");
    }
    const syndicateEntries = Object.entries(syndicatesValue).filter(([, entries]) => Array.isArray(entries));
    if (syndicateEntries.length === 0) throw new Error("syndicates.json contains no vendor entry arrays");

    // sourceId → label
    const labelMap: Record<string, string> = {};
    // catalogId → Set<sourceId>
    const acquisitionMap = new Map<string, Set<string>>();
    // normalizedItemName → { itemName, count, examples }
    const unresolved = new Map<string, { itemName: string; count: number; examples: string[] }>();

    let resolved = 0;
    let unresolvedCount = 0;

    for (const [synName, entries] of syndicateEntries) {
        for (const entry of entries) {
            if (!isRecord(entry)) continue;

            const place = typeof entry.place === "string" ? entry.place : "";
            const itemName = typeof entry.item === "string" ? entry.item.trim() : "";
            if (!place || !itemName) continue;

            const label = `Syndicate Vendor: ${synName} (${place})`;
            const sourceId = sourceIdFromLabel(label);

            // Register in label map
            labelMap[sourceId] = label;

            // Try to resolve item to catalogId
            const catalogId = resolveItemName(itemName, nameIndex);

            if (catalogId) {
                if (!acquisitionMap.has(catalogId)) acquisitionMap.set(catalogId, new Set());
                acquisitionMap.get(catalogId)!.add(sourceId);
                resolved++;
            } else {
                const key = normalizeNoPunct(stripQty(itemName));
                const existing = unresolved.get(key);
                if (existing) {
                    existing.count++;
                    if (!existing.examples.includes(label)) existing.examples.push(label);
                } else {
                    unresolved.set(key, { itemName, count: 1, examples: [label] });
                }
                unresolvedCount++;
            }
        }
    }

    // Build final acquisition output
    const acquisitionOut: Record<string, { sources: string[] }> = {};
    for (const [catalogId, sourceSet] of acquisitionMap.entries()) {
        const sources = Array.from(sourceSet).sort((a, b) => a.localeCompare(b));
        acquisitionOut[catalogId] = { sources };
    }

    // Build unresolved output
    const unresolvedOut: Record<string, { itemName: string; count: number; examples: string[] }> = {};
    for (const [key, val] of Array.from(unresolved.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        unresolvedOut[key] = val;
    }

    // Write outputs
    await writeFileAtomically(LABEL_MAP_OUTPUT, JSON.stringify(labelMap, null, 2));
    console.log(`\nwfcd-source-label-map: ${Object.keys(labelMap).length} source entries`);

    await writeFileAtomically(ACQUISITION_OUTPUT, JSON.stringify(acquisitionOut, null, 2));
    console.log(`wfcd-acquisition: ${Object.keys(acquisitionOut).length} catalog entries (${resolved} resolved item-source pairs)`);

    await writeFileAtomically(UNRESOLVED_OUTPUT, JSON.stringify(unresolvedOut, null, 2));
    console.log(`wfcd-acquisition.unresolved: ${unresolvedCount} unresolved item-source pairs (${unresolved.size} unique names)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
