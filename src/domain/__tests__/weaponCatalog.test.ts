import { describe, expect, it } from "vitest";
import { filterBuilderExpertVariants, getModsForCompat, getModsForWeapon, getStancesForWeapon } from "../catalog/modCatalog";
import { getWeaponCatalog } from "../catalog/weaponCatalog";
import { effectiveDrain } from "../logic/capacityCalc";
import ITEMS_RAW from "../../data/_generated/items-lean.auto.json";

const ITEMS = ITEMS_RAW as Record<string, {
    name?: string;
    categories?: string[];
    data?: {
        CompatibilityTags?: string[];
    };
}>;

describe("weapon catalog stance inference", () => {
    it("infers Tonbo as a Polearms weapon with available stance mods", () => {
        const tonbo = getWeaponCatalog().find(weapon =>
            weapon.uniqueName === "/Lotus/Weapons/Tenno/Melee/Polearms/FlowerPowerPolearm/FlowerPowerPolearmWep");

        expect(tonbo).toBeTruthy();
        expect(tonbo?.category).toBe("Melee");
        expect(tonbo?.stancePolarity).toBe("zenurik");
        expect(tonbo?.stanceClasses).toContain("Polearms");
        expect(getStancesForWeapon(tonbo!).length).toBeGreaterThan(0);
    });

    it("preserves Ohma tonfa compatibility from items data", () => {
        const ohma = getWeaponCatalog().find((weapon) => weapon.name === "Ohma");

        expect(ohma).toBeTruthy();
        expect(ohma?.category).toBe("Melee");
        expect(ohma?.stancePolarity).toBe("naramon");
        expect(ohma?.polarities).toEqual(["madurai", "naramon"]);
        expect(ohma?.stanceClasses).toContain("Tonfas");
        expect(new Set(getStancesForWeapon(ohma!).map((mod) => mod.name)).has("Sovereign Outcast")).toBe(true);
    });

    it("maps Heavy Scythe weapons to Heavy Scythe stance mods", () => {
        const thalys = getWeaponCatalog().find((weapon) => weapon.name === "Thalys");

        expect(thalys).toBeTruthy();
        expect(thalys?.category).toBe("Melee");
        expect(thalys?.stanceClasses).toContain("Heavy Scythe");
        expect(new Set(getStancesForWeapon(thalys!).map((mod) => mod.name)).has("Galeforce Dawn")).toBe(true);
    });

    it("surfaces Iron Staff's built-in exalted stance without offering generic staff stances", () => {
        const ironStaff = getWeaponCatalog().find((weapon) => weapon.name === "Iron Staff");

        expect(ironStaff).toBeTruthy();
        expect(ironStaff?.isExalted).toBe(true);
        expect(ironStaff?.stancePolarity).toBe("zenurik");
        expect(getStancesForWeapon(ironStaff!)).toHaveLength(1);
        expect(getStancesForWeapon(ironStaff!)[0]?.name).toBe("Primal Fury");
        expect(getStancesForWeapon(ironStaff!)[0]?.isBuiltIn).toBe(true);
        expect(effectiveDrain(getStancesForWeapon(ironStaff!)[0]!, ironStaff!.stancePolarity ?? "", getStancesForWeapon(ironStaff!)[0]!.fusionLimit)).toBe(-10);
    });

    it("treats Diwata as a melee exalted weapon with its permanent Razorwing stance", () => {
        const diwata = getWeaponCatalog().find((weapon) => weapon.name === "Diwata");

        expect(diwata).toBeTruthy();
        expect(diwata?.category).toBe("Melee");
        expect(diwata?.modCompat).toBe("Melee");
        expect(diwata?.stancePolarity).toBe("zenurik");
        expect(getStancesForWeapon(diwata!)).toHaveLength(1);
        expect(getStancesForWeapon(diwata!)[0]?.name).toBe("Razorwing");
        expect(getStancesForWeapon(diwata!)[0]?.isBuiltIn).toBe(true);
        expect(effectiveDrain(getStancesForWeapon(diwata!)[0]!, diwata!.stancePolarity ?? "", getStancesForWeapon(diwata!)[0]!.fusionLimit)).toBe(-10);
    });

    it("inherits built-in exalted stances for prime and variant weapon paths", () => {
        const desertWindPrime = getWeaponCatalog().find((weapon) => weapon.name === "Desert Wind Prime");
        const exaltedUmbraBlade = getWeaponCatalog().find((weapon) => weapon.name === "Exalted Umbra Blade");
        const diwataPrime = getWeaponCatalog().find((weapon) => weapon.name === "Diwata Prime");

        expect(getStancesForWeapon(desertWindPrime!)[0]?.name).toBe("Serene Storm");
        expect(getStancesForWeapon(desertWindPrime!)[0]?.isBuiltIn).toBe(true);
        expect(getStancesForWeapon(exaltedUmbraBlade!)[0]?.name).toBe("Exalted Blade");
        expect(getStancesForWeapon(exaltedUmbraBlade!)[0]?.isBuiltIn).toBe(true);
        expect(getStancesForWeapon(diwataPrime!)[0]?.name).toBe("Razorwing");
        expect(getStancesForWeapon(diwataPrime!)[0]?.isBuiltIn).toBe(true);
    });

    it("includes archguns with archgun-only mod compatibility", () => {
        const mausolon = getWeaponCatalog().find((weapon) => weapon.name === "Mausolon");

        expect(mausolon).toBeTruthy();
        expect(mausolon?.category).toBe("Arch-Gun");
        expect(mausolon?.modCompat).toBe("Archgun");

        const mods = new Set(getModsForWeapon(mausolon!).map((mod) => mod.name));
        expect(mods.has("Dual Rounds")).toBe(true);
        expect(mods.has("Serration")).toBe(false);
    });

    it("keeps rifle and sniper mods visible for Perigale variants missing lean ancestry data", () => {
        const perigale = getWeaponCatalog().find((weapon) => weapon.name === "Perigale");
        const perigalePrime = getWeaponCatalog().find((weapon) => weapon.name === "Perigale Prime");

        expect(perigale).toBeTruthy();
        expect(perigalePrime).toBeTruthy();
        expect(perigale?.weaponType).toBe("Sniper");
        expect(perigale?.modCompat).toBe("Sniper");
        expect(perigalePrime?.category).toBe("Primary");
        expect(perigalePrime?.weaponType).toBe("Sniper");
        expect(perigalePrime?.modCompat).toBe("Sniper");

        const baseMods = filterBuilderExpertVariants(getModsForWeapon(perigale!));
        const mods = filterBuilderExpertVariants(getModsForWeapon(perigalePrime!));
        const hasStandardMod = (pool: typeof mods, name: string) => pool.some((mod) =>
            mod.name === name && !/\/(?:Beginner|Intermediate|Expert)\//i.test(mod.path),
        );

        expect(hasStandardMod(mods, "Serration")).toBe(true);
        expect(hasStandardMod(mods, "Split Chamber")).toBe(true);
        expect(hasStandardMod(mods, "Hunter Munitions")).toBe(true);
        expect(baseMods.some((mod) => mod.name === "Primed Chamber")).toBe(true);
        expect(mods.some((mod) => mod.name === "Charged Chamber")).toBe(true);
        expect(mods.some((mod) => mod.name === "Primed Chamber")).toBe(true);
        expect(mods.some((mod) => mod.name === "Target Acquired")).toBe(true);
        // Missing ancestry must not widen a family-specific restriction.
        expect(mods.some((mod) => mod.name === "Deft Tempo")).toBe(false);

        const bratonPrime = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(getModsForWeapon(bratonPrime!).some((mod) => mod.name === "Primed Chamber")).toBe(false);
    });

    it("keeps secondary pistol mods visible when the lean item ancestry is missing", () => {
        const standardPistolNames = new Set(["Aksondol", "Athodai Prime", "Regulators", "Regulators Prime"]);
        const standardPistolMods = getModsForCompat("Pistol");
        const standardPathFor = (name: string) => standardPistolMods.find((mod) =>
            mod.name === name && !/(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(mod.path),
        );

        for (const weapon of getWeaponCatalog().filter((entry) => standardPistolNames.has(entry.name))) {
            const mods = getModsForWeapon(weapon);
            expect(weapon.modCompat).toBe("Pistol");
            expect(mods.some((mod) => mod.name === "Hornet Strike" && mod.uniqueName === standardPathFor("Hornet Strike")?.uniqueName))
                .toBe(true);
            expect(mods.some((mod) => mod.name === "Barrel Diffusion" && mod.uniqueName === standardPathFor("Barrel Diffusion")?.uniqueName))
                .toBe(true);
        }
    });

    it("classifies Coda Bubonico as a shotgun and offers its standard shotgun mods", () => {
        const codaBubonico = getWeaponCatalog().find((weapon) => weapon.name === "Coda Bubonico");
        expect(codaBubonico).toBeTruthy();
        expect(codaBubonico?.weaponType).toBe("Shotgun");
        expect(codaBubonico?.modCompat).toBe("Shotgun");

        const mods = getModsForWeapon(codaBubonico!);
        expect(mods.some((mod) => mod.name === "Hell's Chamber" && !/(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(mod.path)))
            .toBe(true);
        expect(mods.some((mod) => mod.name === "Serration")).toBe(false);
    });

    it("keeps the Amp-class Sirocco out of the standard weapon build catalog", () => {
        expect(getWeaponCatalog().some((weapon) => weapon.name === "Sirocco")).toBe(false);
    });

    it("does not expose a training variant when its standard counterpart is incompatible", () => {
        const isTrainingVariant = (path: string) => /(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(path)
            || /(?:Beginner|Intermediate|Expert)$/i.test(path);
        const failures: Array<{ weapon: string; mod: string; trainingPath: string }> = [];
        const pools = getWeaponCatalog().map((weapon) => ({ weapon, mods: getModsForWeapon(weapon) }));
        const standardFamilies = new Set(pools.flatMap(({ mods }) => mods
            .filter((mod) => !isTrainingVariant(mod.path))
            .map((mod) => mod.compatBucket.toLowerCase() + "||" + mod.name.trim().toLowerCase())));

        for (const { weapon, mods } of pools) {
            const weaponStandardFamilies = new Set(mods.filter((mod) => !isTrainingVariant(mod.path))
                .map((mod) => mod.compatBucket.toLowerCase() + "||" + mod.name.trim().toLowerCase()));
            for (const mod of mods) {
                const family = mod.compatBucket.toLowerCase() + "||" + mod.name.trim().toLowerCase();
                if (!isTrainingVariant(mod.path) || !standardFamilies.has(family) || weaponStandardFamilies.has(family)) continue;
                failures.push({ weapon: weapon.name, mod: mod.name, trainingPath: mod.path });
            }
        }

        expect(failures).toEqual([]);
    });

    it("classifies companion weapons by their actual mod family", () => {
        const sweeper = getWeaponCatalog().find((weapon) => weapon.name === "Sweeper");
        const deconstructor = getWeaponCatalog().find((weapon) => weapon.name === "Deconstructor");
        const akaten = getWeaponCatalog().find((weapon) => weapon.name === "Akaten");
        const hurasClaws = getWeaponCatalog().find((weapon) => weapon.name === "Huras Claws");
        const shadowClaws = getWeaponCatalog().find((weapon) => weapon.name === "Shadow Claws");
        const vulklok = getWeaponCatalog().find((weapon) => weapon.name === "Vulklok");

        expect(sweeper?.category).toBe("Companion");
        expect(sweeper?.modCompat).toBe("Shotgun");
        expect(new Set(getModsForWeapon(sweeper!).map((mod) => mod.name)).has("Hell's Chamber")).toBe(true);
        expect(new Set(getModsForWeapon(sweeper!).map((mod) => mod.name)).has("Serration")).toBe(false);
        expect(new Set(getModsForWeapon(sweeper!).map((mod) => mod.name)).has("Amalgam Shotgun Barrage")).toBe(false);

        expect(deconstructor?.category).toBe("Companion");
        expect(deconstructor?.modCompat).toBe("Melee");
        expect(getStancesForWeapon(deconstructor!).length).toBe(0);
        expect(new Set(getModsForWeapon(deconstructor!).map((mod) => mod.name)).has("Condition Overload")).toBe(true);
        expect(new Set(getModsForWeapon(deconstructor!).map((mod) => mod.name)).has("Blood Rush")).toBe(false);

        expect(akaten?.category).toBe("Companion");
        expect(akaten?.modCompat).toBe("Melee");
        expect(new Set(getModsForWeapon(akaten!).map((mod) => mod.name)).has("Pressure Point")).toBe(true);
        expect(new Set(getModsForWeapon(akaten!).map((mod) => mod.name)).has("Serration")).toBe(false);
        expect(new Set(getModsForWeapon(akaten!).map((mod) => mod.name)).has("Blood Rush")).toBe(false);

        expect(hurasClaws?.category).toBe("Companion");
        expect(hurasClaws?.modCompat).toBe("Melee");
        expect(hurasClaws?.tags).toContain("BEAST_WEAPON");
        expect(hurasClaws?.stanceClasses).toContain("Claws");
        expect(hurasClaws?.stancePolarity).toBe("penjaga");
        expect(new Set(getStancesForWeapon(hurasClaws!).map((mod) => mod.name))).toEqual(new Set([
            "Assassin Posture",
            "Balanced Posture",
            "Elusive Posture",
            "Frenzied Posture",
            "Persistent Posture",
            "Protector Posture",
        ]));
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Burning Claws")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Shocking Claws")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Maul")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Mecha Overdrive")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Pressure Point")).toBe(false);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Condition Overload")).toBe(false);

        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Swipe")).toBe(false);
        expect(new Set(getModsForWeapon(getWeaponCatalog().find((weapon) => weapon.name === "Smeeta Claws")!).map((mod) => mod.name)).has("Swipe")).toBe(true);

        expect(new Set(getModsForWeapon(shadowClaws!).map((mod) => mod.name)).has("Burning Claws")).toBe(false);

        expect(vulklok?.category).toBe("Companion");
        expect(vulklok?.modCompat).toBe("Sniper");
        expect(new Set(getModsForWeapon(vulklok!).map((mod) => mod.name)).has("Split Chamber")).toBe(true);
        expect(new Set(getModsForWeapon(vulklok!).map((mod) => mod.name)).has("Charged Chamber")).toBe(true);
    });

    it("resolves every non-exalted melee weapon with explicit stance tags to at least one stance mod", () => {
        const weaponsByPath = new Map(getWeaponCatalog().map((weapon) => [weapon.uniqueName, weapon]));
        const failures: Array<{ name: string; path: string; tags: string[] }> = [];

        for (const [path, item] of Object.entries(ITEMS)) {
            if (!item.categories?.includes("melee")) continue;
            const tags = item.data?.CompatibilityTags?.filter((tag) => tag.includes("STANCE")) ?? [];
            if (tags.length === 0) continue;

            const weapon = weaponsByPath.get(path);
            if (!weapon || weapon.isExalted) continue;

            if (getStancesForWeapon(weapon).length === 0) {
                failures.push({
                    name: weapon.name,
                    path,
                    tags,
                });
            }
        }

        expect(failures).toEqual([]);
    });
});
