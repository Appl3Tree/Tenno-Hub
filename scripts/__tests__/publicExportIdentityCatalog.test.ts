import { describe, expect, it } from "vitest";
import { buildPublicExportIdentityCatalog } from "../generate/generatePublicExportIdentityCatalog";

const dictionary = {
    "/Lotus/Language/Items/BlueprintAndItem": "Blueprint for |ITEM|",
    "/Lotus/Language/TestAbility": "Example Ability",
    "/Lotus/Language/TestFrame": "Example Frame",
    "/Lotus/Language/TestMod": "Example Mod",
    "/Lotus/Language/TestArcane": "Example Arcane",
    "/Lotus/Language/TestRiven": "Riven Template",
};

const emptyExportMap = { "/Lotus/Test/Unused": {} };

const exports = {
    "ExportAbilities.json": {
        "/Lotus/Test/Ability": { name: "/Lotus/Language/TestAbility", productCategory: "Suits" },
    },
    "ExportWarframes.json": {
        "/Lotus/Test/Frame": { name: "/Lotus/Language/TestFrame", productCategory: "Suits" },
    },
    "ExportWeapons.json": {
        "/Lotus/Test/Weapon": { name: "Example Weapon", productCategory: "LongGuns" },
    },
    "ExportRailjackWeapons.json": { ...emptyExportMap },
    "ExportSentinels.json": { ...emptyExportMap },
    "ExportResources.json": { ...emptyExportMap },
    "ExportCustoms.json": { ...emptyExportMap },
    "ExportFlavour.json": { ...emptyExportMap },
    "ExportGear.json": { ...emptyExportMap },
    "ExportKeys.json": { ...emptyExportMap },
    "ExportDrones.json": { ...emptyExportMap },
    "ExportRecipes.json": {
        "/Lotus/Test/WeaponBlueprint": { resultType: "/Lotus/Test/Weapon" },
    },
    "ExportUpgrades.json": {
        "/Lotus/Upgrades/Mods/TestMod": { name: "/Lotus/Language/TestMod", type: "RIFLE" },
        "/Lotus/Upgrades/Mods/Randomized/TestRiven": { name: "/Lotus/Language/TestRiven" },
    },
    "ExportArcanes.json": {
        "/Lotus/Upgrades/CosmeticEnhancers/TestArcane": { name: "/Lotus/Language/TestArcane" },
    },
    "ExportAvionics.json": { ...emptyExportMap },
};

describe("Public Export Plus identity catalog", () => {
    it("adds localized exact item identities and names recipe blueprints from their canonical result", () => {
        const result = buildPublicExportIdentityCatalog({
            dictionary,
            exports,
            peelyPixNames: {},
            existingItemPaths: new Set(["/Lotus/Test/Existing"]),
            existingModPaths: new Set(),
            existingItemNames: new Map([["/Lotus/Test/Weapon", "Example Weapon"]]),
        });

        expect(result.items["/Lotus/Test/Frame"]).toMatchObject({
            name: "Example Frame",
            category: "Suits",
            data: { ProductCategory: "Suits" },
        });
        expect(result.items["/Lotus/Test/WeaponBlueprint"]).toMatchObject({
            name: "Blueprint for Example Weapon",
            category: "Recipes",
            categories: ["blueprint"],
            data: { ProductCategory: "Recipes", resultItemType: "/Lotus/Test/Weapon" },
        });
        expect(result.items["/Lotus/Test/Existing"]).toBeUndefined();
        expect(result.items["/Lotus/Test/Ability"]).toBeUndefined();
    });

    it("keeps upgrades, arcanes, and randomized templates in their canonical catalogs", () => {
        const result = buildPublicExportIdentityCatalog({
            dictionary,
            exports,
            peelyPixNames: {},
            existingItemPaths: new Set(),
            existingModPaths: new Set(),
        });

        expect(result.mods["/Lotus/Upgrades/Mods/TestMod"]).toMatchObject({
            name: "Example Mod",
            category: "Mods",
        });
        expect(result.mods["/Lotus/Upgrades/CosmeticEnhancers/TestArcane"]).toMatchObject({
            name: "Example Arcane",
            category: "Arcanes",
        });
        expect(result.rivens["/Lotus/Upgrades/Mods/Randomized/TestRiven"]).toMatchObject({
            name: "Riven Template",
            category: "Rivens",
        });
    });

    it("uses ability export names for recipe results and clearly labels path-only fallbacks", () => {
        const missingResultName = {
            ...exports,
            "ExportRecipes.json": {
                "/Lotus/Test/UnknownBlueprint": { resultType: "/Lotus/Test/Unknown" },
                "/Lotus/Test/AbilityBlueprint": { resultType: "/Lotus/Test/Ability" },
            },
        };
        const result = buildPublicExportIdentityCatalog({
            dictionary,
            exports: missingResultName,
            peelyPixNames: {},
            existingItemPaths: new Set(),
            existingModPaths: new Set(),
        });

        expect(result.items["/Lotus/Test/UnknownBlueprint"]).toMatchObject({
            name: "Untranslated recipe: Unknown Blueprint",
            data: { identityNameSource: "recipe-path-fallback" },
        });
        expect(result.items["/Lotus/Test/AbilityBlueprint"]).toMatchObject({
            name: "Blueprint for Example Ability",
            data: { identityNameSource: "public-export-result" },
        });
    });

    it("adds all validated Peely Pix paths as counted item identities", () => {
        const stickerPath = "/Lotus/Upgrades/Stickers/TestSticker";
        const result = buildPublicExportIdentityCatalog({
            dictionary,
            exports,
            peelyPixNames: {
                [stickerPath]: { name: "Test Sticker" },
            },
            existingItemPaths: new Set(),
            existingModPaths: new Set(),
        });

        expect(result.items[stickerPath]).toMatchObject({
            name: "Test Sticker",
            path: stickerPath,
            category: "Peely Pix",
            categories: ["Peely Pix"],
            data: {
                ProductCategory: "Peely Pix",
                identitySource: "cephalon-kronos-peely-pix",
                sourceCommitSha: "08887d766ddfd03c855be200053daa19c4f9705d",
            },
        });
        expect(() => buildPublicExportIdentityCatalog({
            dictionary,
            exports,
            peelyPixNames: { "/Lotus/Upgrades/Mods/NotASticker": { name: "Ignored" } },
            existingItemPaths: new Set(),
            existingModPaths: new Set(),
        })).toThrow(/Unexpected Peely Pix identity path/);
        expect(() => buildPublicExportIdentityCatalog({
            dictionary,
            exports,
            peelyPixNames: { "/Lotus/Upgrades/Stickers/MissingName": {} },
            existingItemPaths: new Set(),
            existingModPaths: new Set(),
        })).toThrow(/Peely Pix identity has no resolved name/);
    });
});
