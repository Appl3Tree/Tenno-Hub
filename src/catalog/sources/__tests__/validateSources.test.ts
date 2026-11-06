import { describe, expect, it } from "vitest";
import { MANUAL_ACQUISITION_BY_CATALOG_ID } from "../../items/manualAcquisitionByCatalogId";
import { getAcquisitionByCatalogId } from "../../items/itemAcquisition";
import { PR } from "../../../domain/ids/prereqIds";
import type { CatalogId } from "../../../domain/catalog/loadFullCatalog";
import { CURATED_SOURCES } from "../curatedSources";
import { validateSources } from "../validateSources";

describe("curated acquisition source integrity", () => {
    it("keeps parent buckets out of item acquisitions and gives used leaves actionable labels", () => {
        expect(validateSources().issues).toEqual([]);
    });

    it("maps current Nightwave and Cephalon Melica recipes to their actual blueprint vendors", () => {
        const vendorId = "data:vendor/zariman/cephalon-melica";
        expect(CURATED_SOURCES.find((source) => source.id === vendorId)?.prereqIds)
            .toEqual([PR.ANGELS_ZARIMAN, PR.WHISPERS_WALL]);

        const expected = [
            "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipBlueprint",
            "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipAvionicsComponent",
            "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipEnginesComponent",
            "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipFuselageComponent",
        ];
        for (const catalogId of expected) {
            expect(MANUAL_ACQUISITION_BY_CATALOG_ID[catalogId]).toContain("data:nightwave/cred-offerings");
            expect(getAcquisitionByCatalogId(catalogId as CatalogId)?.sources).toContain("data:nightwave/cred-offerings");
        }

        for (const catalogId of [
            "items:/Lotus/Types/Recipes/Weapons/DuelistBowBlueprint",
            "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowGrip",
            "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowLowerLimb",
            "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowString",
            "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowUpperLimb",
            "items:/Lotus/Types/Recipes/Weapons/DuelistPistolsBlueprint",
            "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsBarrel",
            "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsLink",
            "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsReceiver",
        ]) {
            expect(MANUAL_ACQUISITION_BY_CATALOG_ID[catalogId]).toContain(vendorId);
            expect(getAcquisitionByCatalogId(catalogId as CatalogId)?.sources).toContain(vendorId);
        }
    });
});
