import { filterBuilderExpertVariants, getModsForWeapon, getUnmodeledDamageEffectLines } from "../src/domain/catalog/modCatalog";
import { getWeaponCatalog } from "../src/domain/catalog/weaponCatalog";

const modsByUniqueName = new Map<string, ReturnType<typeof getModsForWeapon>[number]>();
const weapons = getWeaponCatalog();
let weaponPoolsWithoutParsedDamageEffects = 0;

for (const weapon of weapons) {
    const pool = filterBuilderExpertVariants(getModsForWeapon(weapon));
    if (!pool.some((mod) => mod.hasDamageEffect)) weaponPoolsWithoutParsedDamageEffects++;
    for (const mod of pool) {
        if (!modsByUniqueName.has(mod.uniqueName)) modsByUniqueName.set(mod.uniqueName, mod);
    }
}

const allMods = [...modsByUniqueName.values()];
const unparsedDamageRows = allMods
    .map((mod) => ({
        mod,
        lines: getUnmodeledDamageEffectLines(mod, mod.fusionLimit),
    }))
    .filter(({ lines }) => lines.length > 0)
    .sort((a, b) => a.mod.name.localeCompare(b.mod.name));
const partialRows = unparsedDamageRows.filter(({ mod }) => mod.hasDamageEffect);
const fullyUnsupportedRows = unparsedDamageRows.filter(({ mod }) => !mod.hasDamageEffect);

console.log("# Build Planner mod-effect coverage audit");
console.log("");
console.log(`- Catalog weapons checked: ${weapons.length}`);
console.log(`- Unique builder-eligible mod records checked: ${allMods.length}`);
console.log(`- Records with a parsed damage or performance effect: ${allMods.filter((mod) => mod.hasDamageEffect).length}`);
console.log(`- Records with no parsed effect at max rank: ${allMods.filter((mod) => !mod.hasDamageEffect).length}`);
console.log(`- Records with unmatched lines conservatively flagged for review at max rank: ${unparsedDamageRows.length}`);
console.log(`- Partially parsed records excluded from automatic optimization: ${partialRows.length}`);
console.log(`- Fully unparsed flagged records excluded from automatic optimization: ${fullyUnsupportedRows.length}`);
console.log(`- Weapon pools without any parsed damage effect: ${weaponPoolsWithoutParsedDamageEffects}`);
console.log("");
console.log("## Conservative parser-coverage candidates");
console.log("");
console.log("A keyword screen lists unmatched source lines that may affect damage, combat timing, or weapon behavior. It also admits unrelated utility lines, so review each entry before treating it as a missing mechanic. Cards remain available for manual selection with a warning; the optimizer excludes affected ranks.");
console.log("");

for (const { mod, lines } of unparsedDamageRows) {
    const status = mod.hasDamageEffect ? "partially parsed" : "fully unparsed";
    for (const line of lines) console.log(`- ${mod.name} (${mod.compatBucket}; ${status}): ${line}`);
}

if (weaponPoolsWithoutParsedDamageEffects > 0) process.exitCode = 1;
