import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";
import { collectRelicMissionRewardRows, validateRelicMissionRewardReferences } from "../lib/relicData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const INPUT = path.join(ROOT, "external/warframe-drop-data/raw/relics.json");
const MISSION_INPUT = path.join(ROOT, "external/warframe-drop-data/raw/missionRewards.json");
const OUTPUT = path.join(ROOT, "src/data/_generated/relics-lean.auto.json");

type RawRelicReward = {
    itemName?: string;
    rarity?: string;
    chance?: number;
};

type RawRelicEntry = {
    tier?: string;
    relicName?: string;
    state?: string;
    rewards?: RawRelicReward[];
    drops?: Array<{
        location?: string;
        place?: string;
        node?: string;
        mission?: string;
    }>;
    locations?: string[];
    dropLocations?: string[];
};

type LeanRelicReward = {
    itemName: string;
    chance: number;
};

type LeanRelicEntry = {
    tier: string;
    relicName: string;
    rewards: LeanRelicReward[];
    locations: string[];
    missions: Array<{
        pathLabel: string;
        rotation: string;
        chance: number;
    }>;
};

interface MissionRewardsFile {
    missionRewards: unknown;
}

function normalizeSpaces(s: string): string {
    return s.replace(/\s+/g, " ").trim();
}

function collectLocations(row: RawRelicEntry): string[] {
    const out: string[] = [];

    const push = (value: unknown): void => {
        if (typeof value !== "string") return;
        const normalized = normalizeSpaces(value);
        if (normalized) out.push(normalized);
    };

    for (const drop of row.drops ?? []) {
        push(drop?.location);
        push(drop?.place);
        push(drop?.node);
        push(drop?.mission);
    }

    for (const value of row.locations ?? []) push(value);
    for (const value of row.dropLocations ?? []) push(value);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const value of out) {
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(value);
    }

    return unique.sort((a, b) => a.localeCompare(b));
}

function toRelicKey(tier: string, relicName: string): string {
    return `${tier.toLowerCase()} ${relicName.toLowerCase()}`;
}

async function main(): Promise<void> {
    console.log("Reading", INPUT);
    const parsed = JSON.parse(await readFile(INPUT, "utf-8")) as { relics?: RawRelicEntry[] } | RawRelicEntry[];
    const rows = Array.isArray(parsed) ? parsed : parsed.relics ?? [];
    console.log("Reading", MISSION_INPUT);
    const missionFile = JSON.parse(await readFile(MISSION_INPUT, "utf-8")) as MissionRewardsFile;
    validateRelicMissionRewardReferences(missionFile.missionRewards, parsed);
    const missionsByRelicKey = new Map<string, Array<{ pathLabel: string; rotation: string; chance: number }>>();

    for (const row of collectRelicMissionRewardRows(missionFile.missionRewards)) {
        const existing = missionsByRelicKey.get(row.relicKey) ?? [];
        existing.push({ pathLabel: row.pathLabel, rotation: row.rotation, chance: row.chance });
        missionsByRelicKey.set(row.relicKey, existing);
    }

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index]!;
        if (row?.state === "Intact" && (!row?.tier || !row?.relicName)) {
            console.warn(`[upstream integrity defect] relics.json[${index}] is missing ${!row?.tier ? "tier" : "relicName"}; no canonical relic identity can be generated`);
        }
    }

    const lean: LeanRelicEntry[] = rows
        .filter((row) => row?.tier && row?.relicName && row?.state === "Intact")
        .map((row) => ({
            tier: String(row.tier),
            relicName: String(row.relicName),
            rewards: (row.rewards ?? [])
                .filter((reward) => typeof reward?.itemName === "string" && reward.itemName.trim().length > 0)
                .map((reward) => ({
                    itemName: String(reward.itemName).trim(),
                    chance: Number(reward.chance ?? 0),
                })),
            locations: collectLocations(row),
            missions: [...(missionsByRelicKey.get(toRelicKey(String(row.tier), String(row.relicName))) ?? [])]
                .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel)),
        }))
        .sort((a, b) => `${a.tier} ${a.relicName}`.localeCompare(`${b.tier} ${b.relicName}`));

    const json = JSON.stringify(lean, null, 2);
    await writeFileAtomically(OUTPUT, json);

    const inKB = Math.round((await readFile(INPUT)).length / 1024);
    const outKB = Math.round(Buffer.byteLength(json) / 1024);
    console.log(`Done: ${lean.length} entries, ${inKB} KB → ${outKB} KB`);
    console.log("Written to", OUTPUT);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
