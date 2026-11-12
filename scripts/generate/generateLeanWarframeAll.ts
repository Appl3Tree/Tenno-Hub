/**
 * generateLeanWarframeAll.ts
 *
 * Source: external/warframe-items/raw/All.json
 * Output: src/data/_generated/warframe-items-all-lean.auto.json
 *
 * Produces a runtime-friendly lean array that preserves the fields used by the app
 * while dropping the large amount of unused data carried by the raw WFCD dump.
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileAtomically } from "../lib/warframeItemsData";
import { WARFRAME_ALL_COMPONENT_FIELDS, WARFRAME_ALL_TOP_LEVEL_FIELDS } from "./leanFieldContracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const INPUT = path.join(ROOT, "external/warframe-items/raw/All.json");
const OUTPUT = path.join(ROOT, "src/data/_generated/warframe-items-all-lean.auto.json");

const TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set(WARFRAME_ALL_TOP_LEVEL_FIELDS);

function pruneDrop(drop: unknown): Record<string, unknown> | null {
  if (!drop || typeof drop !== "object" || Array.isArray(drop)) return null;
  const source = drop as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if ("location" in source) out.location = source.location;
  if ("chance" in source) out.chance = source.chance;
  if ("rarity" in source) out.rarity = source.rarity;
  if ("type" in source) out.type = source.type;
  return Object.keys(out).length > 0 ? out : null;
}

function pruneComponent(component: unknown): Record<string, unknown> | null {
  if (!component || typeof component !== "object" || Array.isArray(component)) return null;
  const source = component as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of WARFRAME_ALL_COMPONENT_FIELDS) {
    if (field === "drops") continue;
    if (field in source) out[field] = source[field];
  }
  if (Array.isArray(source.drops)) {
    const drops = source.drops.map(pruneDrop).filter(Boolean);
    if (drops.length > 0) out.drops = drops;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function pruneAbility(ability: unknown): Record<string, unknown> | null {
  if (!ability || typeof ability !== "object" || Array.isArray(ability)) return null;
  const source = ability as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if ("name" in source) out.name = source.name;
  if ("description" in source) out.description = source.description;
  return Object.keys(out).length > 0 ? out : null;
}

function pruneAttack(attack: unknown): Record<string, unknown> | null {
  if (!attack || typeof attack !== "object" || Array.isArray(attack)) return null;
  const source = attack as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of [
    "name",
    "damage",
    "critChance",
    "criticalChance",
    "crit_chance",
    "critMultiplier",
    "criticalMultiplier",
    "crit_mult",
    "procChance",
    "statusChance",
    "status_chance",
    "speed",
    "charge_time",
    "shot_type",
  ]) {
    if (key in source) out[key] = source[key];
  }
  return Object.keys(out).length > 0 ? out : null;
}

function pruneLevelStat(levelStat: unknown): Record<string, unknown> | null {
  if (!levelStat || typeof levelStat !== "object" || Array.isArray(levelStat)) return null;
  const source = levelStat as Record<string, unknown>;
  if (!Array.isArray(source.stats)) return null;
  return { stats: source.stats };
}

function pruneEntry(entry: unknown): Record<string, unknown> | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const source = entry as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const field of TOP_LEVEL_FIELDS) {
    if (field in source) out[field] = source[field];
  }

  if (Array.isArray(source.levelStats)) {
    const levelStats = source.levelStats.map(pruneLevelStat).filter(Boolean);
    if (levelStats.length > 0) out.levelStats = levelStats;
  }

  if (Array.isArray(source.drops)) {
    const drops = source.drops.map(pruneDrop).filter(Boolean);
    if (drops.length > 0) out.drops = drops;
  }

  if (Array.isArray(source.components)) {
    const components = source.components.map(pruneComponent).filter(Boolean);
    if (components.length > 0) out.components = components;
  }

  if (Array.isArray(source.abilities)) {
    const abilities = source.abilities.map(pruneAbility).filter(Boolean);
    if (abilities.length > 0) out.abilities = abilities;
  }

  if (Array.isArray(source.attacks)) {
    const attacks = source.attacks.map(pruneAttack).filter(Boolean);
    if (attacks.length > 0) out.attacks = attacks;
  }

  return Object.keys(out).length > 0 ? out : null;
}

async function main(): Promise<void> {
  console.log("Reading", INPUT);
  const raw = JSON.parse(await readFile(INPUT, "utf-8")) as unknown[];
  const lean = raw.map(pruneEntry).filter(Boolean);

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
