import { describe, expect, it } from "vitest";
import { getArcaneCatalog, getArcanesForWeapon } from "../arcaneCatalog";
import { FULL_CATALOG } from "../loadFullCatalog";
import { getWeaponCatalog } from "../weaponCatalog";

describe("weapon arcane compatibility", () => {
    it("parses restricted weapon arcane types from source data", () => {
        const arcanes = getArcaneCatalog();
        const byName = new Map(arcanes.map((arcane) => [arcane.name, arcane]));

        expect(byName.get("Fractalized Reset")?.weaponType).toBe("Primary");
        expect(byName.get("Longbow Sharpshot")?.compatibleModCompats).toEqual(["Bow"]);
        expect(byName.get("Shotgun Vendetta")?.compatibleModCompats).toEqual(["Shotgun"]);
        expect(byName.get("Pax Bolt")?.requiresKitgun).toBe(true);
    });

    it("includes every WFCD weapon arcane path in the canonical catalog", () => {
        const catalogIds = new Set(FULL_CATALOG.idsBySource.mods);
        for (const arcane of getArcaneCatalog()) {
            expect(catalogIds.has(`mods:${arcane.uniqueName}`)).toBe(true);
        }
    });

    it("includes primary and bow arcanes for Nataruk", () => {
        const nataruk = getWeaponCatalog().find((weapon) => weapon.name === "Nataruk");
        expect(nataruk).toBeTruthy();

        const arcanes = getArcanesForWeapon(nataruk!);
        const names = new Set(arcanes.map((arcane) => arcane.name));

        expect(names.has("Fractalized Reset")).toBe(true);
        expect(names.has("Longbow Sharpshot")).toBe(true);
        expect(names.has("Shotgun Vendetta")).toBe(false);
    });

    it("does not include bow-only arcanes for non-bow primaries", () => {
        const braton = getWeaponCatalog().find((weapon) => weapon.name === "Braton");
        expect(braton).toBeTruthy();

        const arcanes = getArcanesForWeapon(braton!);
        const names = new Set(arcanes.map((arcane) => arcane.name));

        expect(names.has("Fractalized Reset")).toBe(true);
        expect(names.has("Longbow Sharpshot")).toBe(false);
        expect(names.has("Shotgun Vendetta")).toBe(false);
    });

    it("includes shotgun-only arcanes for shotguns but not bow-only arcanes", () => {
        const kuvaHek = getWeaponCatalog().find((weapon) => weapon.name === "Kuva Hek");
        expect(kuvaHek).toBeTruthy();

        const arcanes = getArcanesForWeapon(kuvaHek!);
        const names = new Set(arcanes.map((arcane) => arcane.name));

        expect(names.has("Fractalized Reset")).toBe(true);
        expect(names.has("Shotgun Vendetta")).toBe(true);
        expect(names.has("Longbow Sharpshot")).toBe(false);
    });

    it("does not expose kitgun arcanes to ordinary secondary weapons", () => {
        const lato = getWeaponCatalog().find((weapon) => weapon.name === "Lato");
        expect(lato).toBeTruthy();

        const arcanes = getArcanesForWeapon(lato!);
        const names = new Set(arcanes.map((arcane) => arcane.name));

        expect(names.has("Pax Bolt")).toBe(false);
        expect(names.has("Residual Shock")).toBe(false);
    });

    it("does not expose standard weapon arcanes to unsupported categories", () => {
        const mausolon = getWeaponCatalog().find((weapon) => weapon.name === "Mausolon");
        const verglas = getWeaponCatalog().find((weapon) => weapon.name === "Verglas");

        expect(mausolon).toBeTruthy();
        expect(verglas).toBeTruthy();
        expect(getArcanesForWeapon(mausolon!)).toEqual([]);
        expect(getArcanesForWeapon(verglas!)).toEqual([]);
    });
});
