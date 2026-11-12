import { describe, expect, it } from "vitest";
import { getArcaneCatalog, getArcanesForWeapon } from "../arcaneCatalog";
import { getArcaneEffectAtRank } from "../../logic/arcaneEffects";
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

    it("models Primary Bulwark from explicit Warframe armor with its rank-specific cap", () => {
        const bulwark = getArcaneCatalog().find((arcane) => arcane.name === "Primary Bulwark");
        expect(bulwark?.armorScaledWeaponDamage).toEqual({
            minimumArmor: 1000,
            maxArmorAboveMinimumByRank: [500, 500, 500, 500, 500, 500],
            damageBonusPerArmorByRank: [0.005, 0.006, 0.007, 0.008, 0.009, 0.01],
        });
        expect(getArcaneEffectAtRank(bulwark!, 5)).toBeNull();

        const rankRates = [0.005, 0.006, 0.007, 0.008, 0.009, 0.01];
        for (const armor of [999, 1000, 1001, 1250, 1500, 2000]) {
            for (let rank = 0; rank <= 5; rank++) {
                const effect = getArcaneEffectAtRank(bulwark!, rank, armor);
                const expectedBonus = Math.min(Math.max(armor - 1000, 0), 500) * rankRates[rank];
                expect(effect?.damageBonus).toBeCloseTo(expectedBonus, 10);
            }
        }
    });

    it("models Primary Overcharge from maximum and current Energy with rank caps", () => {
        const overcharge = getArcaneCatalog().find((arcane) => arcane.name === "Primary Overcharge");
        expect(overcharge?.energyScaledMultishot).toEqual({
            energyPercentThreshold: 90,
            maxEnergyFraction: 0.35,
            capByRank: [100, 150, 200, 250, 300, 350],
        });
        expect(getArcaneEffectAtRank(overcharge!, 5)).toBeNull();
        expect(getArcaneEffectAtRank(overcharge!, 5, undefined, false, {
            warframeMaxEnergy: 1000,
            warframeEnergyPercent: 89.9,
        })?.multishotBonus).toBe(0);
        expect(getArcaneEffectAtRank(overcharge!, 5, undefined, false, {
            warframeMaxEnergy: 1000,
            warframeEnergyPercent: 90,
        })?.multishotBonus).toBe(3.5);
        expect(getArcaneEffectAtRank(overcharge!, 5, undefined, false, {
            warframeMaxEnergy: 500,
            warframeEnergyPercent: 100,
        })?.multishotBonus).toBe(1.75);
        expect(getArcaneEffectAtRank(overcharge!, 1, undefined, false, {
            warframeMaxEnergy: 2000,
            warframeEnergyPercent: 100,
        })?.multishotBonus).toBe(1.5);
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
