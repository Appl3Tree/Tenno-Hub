import { describe, expect, it } from "vitest";
import { getModsForWeapon } from "../../catalog/modCatalog";
import { getWeaponCatalog, withSelectedAttack } from "../../catalog/weaponCatalog";
import { calculateVileDischargeTimeline } from "../vileDischargeTimeline";

describe("Vile Discharge Embolist event timeline", () => {
    const baseEmbolist = getWeaponCatalog().find((weapon) => weapon.name === "Embolist")!;
    const normalAttackIndex = baseEmbolist.attacks.findIndex((attack) => attack.name === "Normal Attack");
    const embolist = withSelectedAttack(baseEmbolist, normalAttackIndex);
    const mods = getModsForWeapon(embolist);
    const vileDischarge = mods.find((mod) => mod.name === "Vile Discharge")!;
    const lethalTorrent = mods.find((mod) => mod.name === "Lethal Torrent")!;
    const pistolGambit = mods.find((mod) => mod.name === "Pistol Gambit")!;
    const targetProfile = {
        health: 100_000,
        shields: 1_000,
        overguard: 0,
        armor: 0,
        toxinBypassesShields: true,
    };

    it("fills the selected rank cap from direct damage and resolves contact plus a separate Toxin explosion", () => {
        const result = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile,
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });

        expect(result.supported).toBe(true);
        expect(result.maximumCharge).toBe(5_000);
        expect(result.chargePerDischarge).toEqual([5_000]);
        expect(result.completedDischarges).toBe(1);
        expect(result.primaryAttacks).toBeGreaterThan(66);
        expect(result.dotTicks).toBe(0);
        expect(result.contactDamage).toBeCloseTo(10, 6);
        expect(result.explosionDamage).toBeCloseTo(5_000, 3);
        expect(result.damageByPool.shields).toBeCloseTo(10, 6);
        expect(result.damageByPool.health).toBeGreaterThan(5_000);
        expect(result.elapsedSeconds).toBeGreaterThan(0.4);
    });

    it("does not apply a Multishot mod to the one-projectile Alt-Fire contact", () => {
        const baseResult = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile,
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });
        const multishotResult = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!, lethalTorrent.effectsByRank[lethalTorrent.fusionLimit]!],
            targetFaction: "",
            targetProfile,
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });

        expect(multishotResult.supported).toBe(true);
        expect(multishotResult.contactDamage).toBeCloseTo(baseResult.contactDamage, 9);
    });

    it("caps stored damage against the specific remaining pool reached by each damage type", () => {
        const baseAttack = embolist.attacks[normalAttackIndex];
        const impactAttack = {
            ...baseAttack,
            damage: { ...baseAttack.damage, impact: 6_000, toxin: 0, total: 6_000 },
            damageTotal: 6_000,
        };
        const impactEmbolist = withSelectedAttack({
            ...embolist,
            attacks: embolist.attacks.map((attack, index) => index === normalAttackIndex ? impactAttack : attack),
        }, normalAttackIndex);
        const result = calculateVileDischargeTimeline({
            weapon: impactEmbolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile: { ...targetProfile, health: 100_000, shields: 1_000 },
            damageOptions: { statusImmuneTypes: ["impact", "toxin"] },
            cycles: 1,
        });

        expect(result.supported).toBe(true);
        expect(result.chargePerDischarge).toEqual([5_000]);
        expect(result.primaryAttacks).toBe(3);
    });

    it("treats a Toxin-bypassed empty Health pool as a kill when Shields remain", () => {
        const result = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile: { ...targetProfile, health: 100, shields: 1_000 },
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });

        expect(result.supported).toBe(true);
        expect(result.completedDischarges).toBe(1);
        expect(result.targetKills).toBeGreaterThan(1);
        expect(result.damageByPool.shields).toBeGreaterThan(0);
    });

    it("keeps critical chance and critical damage mods out of the contact event", () => {
        const baseResult = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile,
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });
        const critModResult = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!, pistolGambit.effectsByRank[pistolGambit.fusionLimit]!],
            targetFaction: "",
            targetProfile,
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });

        expect(critModResult.supported).toBe(true);
        expect(critModResult.contactDamage).toBeCloseTo(baseResult.contactDamage, 9);
    });

    it("carries stored charge across repeated identical target kills", () => {
        const result = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile: { ...targetProfile, health: 35, shields: 0 },
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });

        expect(result.supported).toBe(true);
        expect(result.chargePerDischarge).toEqual([5_000]);
        expect(result.targetKills).toBeGreaterThan(1);
    });

    it("applies the disclosed area-uniform linear falloff to both explosion neighbor bands", () => {
        const result = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile: {
                ...targetProfile,
                health: 1_000_000,
                shields: 0,
                nearbyExplosionEnemyCountWithin3m: 1,
                nearbyExplosionEnemyCountFrom3To6m: 1,
            },
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 1,
        });

        expect(result.supported).toBe(true);
        expect(result.nearbyExplosionDamage).toBeCloseTo(5_000 * (11 / 15 + 17 / 45), 3);
        expect(result.nearbyTargetKills).toBe(0);
        expect(result.notes.some((note) => note.includes("linearly interpolates"))).toBe(true);
    });

    it("resets a killed configured neighbor for each later explosion", () => {
        const result = calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile: {
                ...targetProfile,
                health: 1_000,
                shields: 0,
                nearbyExplosionEnemyCountWithin3m: 1,
            },
            damageOptions: { statusImmuneTypes: ["toxin"] },
            cycles: 2,
        });

        expect(result.supported).toBe(true);
        expect(result.nearbyTargetKills).toBe(2);
        expect(result.nearbyExplosionDamage).toBeCloseTo(2_000, 6);
    });

    it("keeps unsupported weapon, attack, and missing-mod combinations out of cycle scoring", () => {
        expect(calculateVileDischargeTimeline({
            weapon: { ...embolist, name: "Sicarus" },
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile,
        }).limitation).toContain("only on Embolist");
        expect(calculateVileDischargeTimeline({
            weapon: { ...embolist, selectedAttackName: "Burst" },
            mods: [vileDischarge.effectsByRank[0]!],
            targetFaction: "",
            targetProfile,
        }).limitation).toContain("Normal Attack");
        expect(calculateVileDischargeTimeline({
            weapon: embolist,
            mods: [],
            targetFaction: "",
            targetProfile,
        }).limitation).toContain("Equip Vile Discharge");
    });
});
