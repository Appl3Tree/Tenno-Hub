import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const INPUT = path.join(ROOT, "src/data/_generated/warframe-items-all-lean.auto.json");
const OUTPUT = path.join(ROOT, "src/data/_generated/prime-availability.auto.json");

type AllComponent = {
    uniqueName?: string;
};

type AllEntry = {
    uniqueName?: string;
    name?: string;
    vaulted?: boolean;
    isPrime?: boolean;
    components?: AllComponent[];
};

type PrimeAvailabilityRow = {
    name?: string;
    vaulted?: boolean;
    isPrime?: boolean;
    components?: string[];
};

async function main(): Promise<void> {
    console.log("Reading", INPUT);
    const rows = JSON.parse(await readFile(INPUT, "utf-8")) as AllEntry[];

    const out: Record<string, PrimeAvailabilityRow> = {};

    for (const row of rows) {
        const uniqueName = String(row?.uniqueName ?? "").trim();
        if (!uniqueName) continue;

        const components = (row.components ?? [])
            .map((component) => String(component?.uniqueName ?? "").trim())
            .filter((value) => value.length > 0);

        out[uniqueName] = {
            ...(row.name ? { name: row.name } : {}),
            ...(row.vaulted ? { vaulted: true } : {}),
            ...(row.isPrime ? { isPrime: true } : {}),
            ...(components.length > 0 ? { components } : {}),
        };
    }

    const json = JSON.stringify(out, null, 2);
    await writeFileAtomically(OUTPUT, json);

    const inKB = Math.round((await readFile(INPUT)).length / 1024);
    const outKB = Math.round(Buffer.byteLength(json) / 1024);
    console.log(`Done: ${Object.keys(out).length} entries, ${inKB} KB -> ${outKB} KB`);
    console.log("Written to", OUTPUT);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
