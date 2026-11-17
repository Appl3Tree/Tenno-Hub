import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { getWeaponCatalog } from "../src/domain/catalog/weaponCatalog";

type Fixture = {
    category: string;
    weapon: string;
    attack: string;
    selection: "fixed" | "seeded";
};

const FIXED_CASES: Fixture[] = [
    { category: "rifle", weapon: "Braton Prime", attack: "Normal Attack", selection: "fixed" },
    { category: "hybrid shotgun", weapon: "Cedo", attack: "Normal Attack", selection: "fixed" },
    { category: "Incarnon secondary", weapon: "Laetum", attack: "Normal Attack", selection: "fixed" },
    { category: "spooling rifle", weapon: "Soma Prime", attack: "Fully Spooled", selection: "fixed" },
    { category: "melee", weapon: "Broken War", attack: "Normal Attack", selection: "fixed" },
    { category: "beam secondary", weapon: "Kuva Nukor", attack: "Normal Attack", selection: "fixed" },
    { category: "bow", weapon: "Nataruk", attack: "Perfect Shot", selection: "fixed" },
    { category: "Incarnon explosive", weapon: "Torid", attack: "Grenade Impact", selection: "fixed" },
];

const SEEDED_STRATA: Array<{ category: string; candidates: Array<Omit<Fixture, "selection">> }> = [
    {
        category: "explosive primary",
        candidates: [
            { category: "explosive primary", weapon: "Kuva Ogris", attack: "Rocket Explosion" },
            { category: "explosive primary", weapon: "Acceltra Prime", attack: "Rocket Explosion" },
            { category: "explosive primary", weapon: "Tenet Envoy", attack: "Rocket Explosion" },
        ],
    },
    {
        category: "Archgun",
        candidates: [
            { category: "Archgun", weapon: "Corvas Prime", attack: "Charged Shot" },
            { category: "Archgun", weapon: "Mausolon", attack: "Charged Shot Explosion" },
        ],
    },
    {
        category: "companion weapon",
        candidates: [
            { category: "companion weapon", weapon: "Verglas Prime", attack: "Normal Attack" },
            { category: "companion weapon", weapon: "Helstrum", attack: "Explosion" },
        ],
    },
    {
        category: "heavy melee",
        candidates: [
            { category: "heavy melee", weapon: "Gram Prime", attack: "Heavy Slam Attack" },
            { category: "heavy melee", weapon: "Arca Titron", attack: "Heavy Slam Attack" },
        ],
    },
];

function option(name: string, fallback: string): string {
    const prefix = `--${name}=`;
    return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        let value = state += 0x6d2b79f5;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

const seed = Number(option("seed", "20261117"));
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("--seed must be an integer between 0 and 4294967295");
}

const random = mulberry32(seed);
const seededCases: Fixture[] = SEEDED_STRATA.map(({ candidates }) => ({
    ...candidates[Math.floor(random() * candidates.length)],
    selection: "seeded",
}));
const fixtures = [...FIXED_CASES, ...seededCases];
const weaponCatalog = getWeaponCatalog();
const weaponNames = new Set<string>();
for (const fixture of fixtures) {
    if (weaponNames.has(fixture.weapon)) throw new Error(`Duplicate corpus weapon: ${fixture.weapon}`);
    weaponNames.add(fixture.weapon);
    const weapon = weaponCatalog.find((entry) => entry.name === fixture.weapon);
    if (!weapon) throw new Error(`Weapon not found in catalog: ${fixture.weapon}`);
    if (!weapon.attacks.some((attack) => attack.name === fixture.attack)) {
        throw new Error(`Attack not found in catalog: ${fixture.weapon} / ${fixture.attack}`);
    }
}

const assumptions = {
    faction: "Grineer",
    target: { health: 100000, shields: 0, overguard: 0, armor: 3000 },
    state: "realistic",
    mainSlots: 8,
    catalyst: true,
    masteryRank: 30,
    formaLimit: 3,
    exilusOptimization: false,
    arcaneOptimization: false,
    scoring: "exact finite Expected TTK for every legal one-mod add/remove/replacement from Auto Optimize's baseline",
};

const corpus = {
    seed,
    randomGenerator: "Mulberry32; one uniform candidate selected per listed stratum, in listed order",
    assumptions,
    fixtures: fixtures.map(({ category, weapon, attack, selection }) => ({ category, weapon, attack, selection })),
};

if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(corpus, null, 2));
} else {
    const auditScript = resolve("scripts/auditExpectedTtkFullPool.ts");
    const results = [];
    for (const [index, fixture] of fixtures.entries()) {
        const startedAt = performance.now();
        const child = spawnSync(process.execPath, [
            "--import", "tsx/esm", auditScript,
            `--weapon=${fixture.weapon}`,
            `--attack=${fixture.attack}`,
            "--faction=Grineer",
            "--state=realistic",
            "--health=100000",
            "--shields=0",
            "--overguard=0",
            "--armor=3000",
            "--slots=8",
            "--forma=3",
        ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        if (child.error) throw child.error;
        if (child.status !== 0) {
            throw new Error(`${fixture.weapon} / ${fixture.attack} audit failed (exit ${child.status}): ${child.stderr}`);
        }
        const audit = JSON.parse(child.stdout) as {
            eligibleFullPoolCandidates: number;
            optimizerBuild: Array<{ name: string; rank: number }>;
            optimizer: { ttkSeconds: number | null; damagePerSecond: number };
            optimizerFormaUsed: number;
            exactLegalOneModNeighbors: number;
            bestOneModNeighbor: Array<{ name: string; rank: number }>;
            bestNeighbor: { ttkSeconds: number | null; damagePerSecond: number };
            bestNeighborFormaUsed: number;
            change: { kind: "add" | "remove" | "replace"; slot: number; name?: string } | null;
            improvement: boolean;
        };
        const formatMod = ({ name, rank }: { name: string; rank: number }) => `${name} R${rank}`;
        const baselineMods = new Set(audit.optimizerBuild.map(formatMod));
        const bestMods = new Set(audit.bestOneModNeighbor.map(formatMod));
        const result = {
            category: fixture.category,
            weapon: fixture.weapon,
            attack: fixture.attack,
            selection: fixture.selection,
            eligibleFullPoolCandidates: audit.eligibleFullPoolCandidates,
            exactLegalOneModNeighbors: audit.exactLegalOneModNeighbors,
            optimizerTtkSeconds: audit.optimizer.ttkSeconds,
            optimizerDamagePerSecond: audit.optimizer.damagePerSecond,
            optimizerFormaUsed: audit.optimizerFormaUsed,
            bestNeighborTtkSeconds: audit.bestNeighbor.ttkSeconds,
            bestNeighborDamagePerSecond: audit.bestNeighbor.damagePerSecond,
            bestNeighborFormaUsed: audit.bestNeighborFormaUsed,
            change: audit.change,
            removedMods: [...baselineMods].filter((mod) => !bestMods.has(mod)),
            addedMods: [...bestMods].filter((mod) => !baselineMods.has(mod)),
            improvement: audit.improvement,
            elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
        };
        results.push(result);
        console.error(`[${index + 1}/${fixtures.length}] ${fixture.weapon} / ${fixture.attack}: ` +
            `${result.optimizerTtkSeconds}s -> ${result.bestNeighborTtkSeconds}s, ` +
            `${result.exactLegalOneModNeighbors} legal neighbors, ${result.improvement ? "improvement" : "no improvement"}`);
    }
    console.log(JSON.stringify({ ...corpus, results }, null, 2));
}
