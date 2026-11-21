import { readFile } from "node:fs/promises";
import { filterBuilderExpertVariants, getModsForWeapon } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog, getWeaponDisplayName } from "../src/domain/catalog/weaponCatalog";
import { withSelectedAttack } from "../src/domain/catalog/weaponRules";
import { debugEvaluateFixedWindowDps } from "../src/domain/logic/buildOptimizerCore";
import { calculateBuild, type ConditionalState } from "../src/domain/logic/damageCalc";

interface Fixture {
    weaponName: string;
    attackName?: string;
    underframeMods: Array<{ name: string; rank: number }>;
}

const fixture = JSON.parse(await readFile(
    new URL("./fixtures/underframeMausolonAutoBuild.json", import.meta.url),
    "utf8",
)) as Fixture;
const weaponEntry = getWeaponCatalog().find((entry) =>
    getWeaponDisplayName(entry).toLowerCase() === fixture.weaponName.toLowerCase(),
);
if (!weaponEntry) throw new Error(`Weapon missing from catalog: ${fixture.weaponName}`);

const attackName = fixture.attackName ?? "Auto";
const attackIndex = weaponEntry.attacks.findIndex((attack) => attack.name.toLowerCase() === attackName.toLowerCase());
if (attackIndex < 0) throw new Error(`Attack missing from catalog: ${fixture.weaponName} / ${attackName}`);
const linkedWeapon = withSelectedAttack(weaponEntry, attackIndex);
if (!linkedWeapon.selectedAttackLingeringDamageRule) {
    throw new Error(`${fixture.weaponName} / ${attackName} has no linked attack component to audit`);
}
const directOnlyWeapon = { ...linkedWeapon, selectedAttackLingeringDamageRule: undefined };

const compatibleMods = filterBuilderExpertVariants(getModsForWeapon(linkedWeapon));
const effects = fixture.underframeMods.map(({ name, rank }) => {
    const variants = compatibleMods.filter((mod) => mod.name.toLowerCase() === name.toLowerCase());
    const mod = variants.find((entry) => !/(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(entry.path))
        ?? variants[0];
    if (!mod) throw new Error(`Captured mod is missing from the compatible pool: ${name}`);
    if (!Number.isInteger(rank) || rank < 0 || rank > mod.fusionLimit) {
        throw new Error(`Captured rank is invalid for ${name}: ${rank}/${mod.fusionLimit}`);
    }
    return mod.effectsByRank[rank] ?? mod.effect;
});

const faction = "Grineer";
const health = 2_000_000;
const shields = 0;
const overguard = 0;
const targetDistanceMeters = 1_400;
const states: Array<ConditionalState["mode"]> = ["realistic", "fullyStacked"];
const armorValues = [3_000, 500, 0];
const modeledStats = states.map((mode) => {
    const stats = calculateBuild(linkedWeapon, effects, faction, { conditionalState: { mode } }).modded;
    return {
        conditionState: mode,
        fireRate: stats.fireRate,
        critChance: stats.critChance,
        critMultiplier: stats.critMultiplier,
        multishot: stats.multishot,
    };
});
const attackCases = [
    { name: "Auto plus linked component", weapon: linkedWeapon },
    { name: "Auto direct-only diagnostic", weapon: directOnlyWeapon },
] as const;

const results = armorValues.flatMap((armor) => states.flatMap((mode) =>
    attackCases.map(({ name, weapon }) => {
        const conditionalState: ConditionalState = { mode, targetDistanceMeters };
        const result = debugEvaluateFixedWindowDps(
            weapon,
            effects,
            faction,
            {
                description: `${faction}: ${health.toLocaleString()} Health / ${armor.toLocaleString()} Armor`,
                health,
                shields,
                overguard,
                armor,
                toxinBypassesShields: true,
            },
            conditionalState,
        );
        const attacks = result.encounter?.attacks ?? 0;
        const directDamage = result.encounter?.directDamageByPool.health ?? 0;
        const statusDamage = result.encounter?.statusDamageByPool.health ?? 0;
        return {
            armor,
            conditionState: mode,
            attackCase: name,
            damagePerSecond: result.damagePerSecond,
            damageInWindow: result.damageInWindow,
            attacks,
            directDamage,
            directDamagePerAttack: attacks > 0 ? directDamage / attacks : 0,
            statusDamage,
            statusDamagePerAttack: attacks > 0 ? statusDamage / attacks : 0,
            damagePerAttack: result.encounter?.damagePerAttack ?? 0,
            targetDefeated: result.timeToKillSeconds !== null,
        };
    }),
));

console.log(JSON.stringify({
    weapon: getWeaponDisplayName(linkedWeapon),
    attack: attackName,
    target: { faction, health, shields, overguard, armorValues },
    targetDistanceMeters,
    scoringWindowSeconds: 5,
    capturedMods: fixture.underframeMods,
    diagnosticNote: "Direct-only rows use a cloned attack profile with its linked component removed; this is diagnostic ablation, not planner behavior or an Underframe simulation.",
    modeledStats,
    results,
}, null, 2));
