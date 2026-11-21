import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { getWeaponCatalog, getWeaponDisplayName } from "../src/domain/catalog/weaponCatalog";
import { CANONICAL_FACTIONS } from "../src/domain/logic/buildOptimizerCore";

type Fixture = {
    category: string;
    weapon: string;
    attack: string;
    selection: "fixed" | "seeded";
    attackDistanceMeters?: number;
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
            { category: "Archgun", weapon: "Mausolon (Archwing)", attack: "Auto", attackDistanceMeters: 250 },
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

function nonNegativeIntegerOption(name: string, fallback: number): number {
    const value = Number(option(name, String(fallback)));
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`--${name} must be a non-negative safe integer`);
    }
    return value;
}

function positiveIntegerOption(name: string, fallback: number): number {
    const value = Number(option(name, String(fallback)));
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`--${name} must be a positive safe integer`);
    }
    return value;
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

const seed = Number(option("seed", "20261144"));
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("--seed must be an integer between 0 and 4294967295");
}
const requestedRuns = Number(option("runs", "1"));
if (!Number.isInteger(requestedRuns) || requestedRuns < 1) {
    throw new Error("--runs must be a positive integer");
}
const targetFaction = option("faction", "Grineer").trim();
if (!CANONICAL_FACTIONS.some((candidate) => candidate.toLowerCase() === targetFaction.toLowerCase())) {
    throw new Error(`--faction must be one of: ${CANONICAL_FACTIONS.join(", ")}`);
}
const target = {
    health: positiveIntegerOption("health", 2_000_000),
    shields: nonNegativeIntegerOption("shields", 0),
    overguard: nonNegativeIntegerOption("overguard", 0),
    armor: nonNegativeIntegerOption("armor", 3_000),
};

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
    const weapon = weaponCatalog.find((entry) =>
        entry.name === fixture.weapon || getWeaponDisplayName(entry) === fixture.weapon,
    );
    if (!weapon) throw new Error(`Weapon not found in catalog: ${fixture.weapon}`);
    if (!weapon.attacks.some((attack) => attack.name === fixture.attack)) {
        throw new Error(`Attack not found in catalog: ${fixture.weapon} / ${fixture.attack}`);
    }
}

const assumptions = {
    seed,
    randomGenerator: "Mulberry32; one uniform candidate selected per listed stratum, in listed order",
    faction: targetFaction,
    target,
    state: "realistic",
    scoringWindow: "[0, 5s)",
    mainSlots: 8,
    catalyst: true,
    masteryRank: 30,
    formaLimit: 3,
    exilusOptimization: false,
    arcaneOptimization: false,
    neighborAudit: "exact legal one-mod add/remove/replacement from the optimizer baseline",
    optimizerRunsPerFixture: requestedRuns,
    distance: "Attack-specific falloff distance is set only for the Mausolon (Archwing) fixture (250m, within its Wiki-listed 300m maximum).",
};

const corpus = {
    assumptions,
    fixtures: fixtures.map(({ category, weapon, attack, selection, attackDistanceMeters }) => ({
        category,
        weapon,
        attack,
        selection,
        attackDistanceMeters: attackDistanceMeters ?? null,
    })),
};

if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(corpus, null, 2));
} else {
    const auditScript = resolve("scripts/auditFixedWindowDpsFullPool.ts");
    const results = [];
    for (const [index, fixture] of fixtures.entries()) {
        const startedAt = performance.now();
        const child = spawnSync(process.execPath, [
            "--import", "tsx/esm", auditScript,
            `--weapon=${fixture.weapon}`,
            `--attack=${fixture.attack}`,
            `--faction=${targetFaction}`,
            "--state=realistic",
            `--health=${target.health}`,
            `--shields=${target.shields}`,
            `--overguard=${target.overguard}`,
            `--armor=${target.armor}`,
            "--slots=8",
            "--forma=3",
            `--runs=${requestedRuns}`,
            ...(fixture.attackDistanceMeters === undefined
                ? []
                : [`--attack-distance=${fixture.attackDistanceMeters}`]),
        ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        if (child.error) throw child.error;
        if (child.status !== 0) {
            throw new Error(`${fixture.weapon} / ${fixture.attack} audit failed (exit ${child.status}): ${child.stderr}`);
        }
        const audit = JSON.parse(child.stdout) as {
            fixture: { weapon: string; maximumRangeMeters: number | null };
            candidatePool: number;
            eligibleFullPoolCandidates: number;
            baseline: {
                mods: Array<{ name: string; rank: number }>;
                capacity: { used: number; limit: number; legal: boolean; formaCount: number };
                score: { damagePerSecond: number; damageInWindow: number; timeToKillSeconds: number | null };
                optimizerCandidatesEvaluated: number;
            };
            exactLegalOneModNeighbors: number;
            bestOneModNeighbor: { damagePerSecond: number; change: unknown } | null;
            improvesBaseline: boolean;
        };
        const result = {
            category: fixture.category,
            weapon: audit.fixture.weapon,
            attack: fixture.attack,
            selection: fixture.selection,
            attackDistanceMeters: fixture.attackDistanceMeters ?? null,
            listedMaximumRangeMeters: audit.fixture.maximumRangeMeters,
            candidatePool: audit.candidatePool,
            eligibleFullPoolCandidates: audit.eligibleFullPoolCandidates,
            optimizerBuild: audit.baseline.mods,
            capacity: audit.baseline.capacity,
            damagePerSecond: audit.baseline.score.damagePerSecond,
            damageInWindow: audit.baseline.score.damageInWindow,
            timeToKillSeconds: audit.baseline.score.timeToKillSeconds,
            optimizerCandidatesEvaluated: audit.baseline.optimizerCandidatesEvaluated,
            exactLegalOneModNeighbors: audit.exactLegalOneModNeighbors,
            bestOneModNeighbor: audit.bestOneModNeighbor,
            improvement: audit.improvesBaseline,
            elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
        };
        results.push(result);
        console.error(`[${index + 1}/${fixtures.length}] ${fixture.weapon} / ${fixture.attack}: ` +
            `${result.damagePerSecond} DPS, ${result.exactLegalOneModNeighbors} legal neighbors, ` +
            `${result.improvement ? "improvement" : "no improvement"}`);
    }
    console.log(JSON.stringify({ ...corpus, results }, null, 2));
}
