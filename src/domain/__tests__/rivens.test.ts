import { describe, expect, it } from "vitest";
import { getWeaponCatalog } from "../catalog/weaponCatalog";
import { buildCustomRivenEntry, CURRENT_RIVEN_STAT_MULTIPLIER, formatRivenStatValue, generateCustomRivenName, getCustomRivenStatDef, normalizeCustomRivenStats, normalizeRivenWeaponFamilyKey, type CustomRivenRecord } from "../rivens";

describe("custom rivens", () => {
  it("normalizes variant family names", () => {
    expect(normalizeRivenWeaponFamilyKey("Acceltra Prime")).toBe("acceltra");
    expect(normalizeRivenWeaponFamilyKey("Tenet Arca Plasmor")).toBe("arca plasmor");
    expect(normalizeRivenWeaponFamilyKey("Prisma Gorgon")).toBe("gorgon");
  });

  it("normalizes legacy saved Riven stats to the shared current factor across weapon variants", () => {
    const acceltraPrime = getWeaponCatalog().find((weapon) => weapon.name === "Acceltra Prime");
    const acceltra = getWeaponCatalog().find((weapon) => weapon.name === "Acceltra");

    expect(acceltraPrime).toBeTruthy();
    expect(acceltra).toBeTruthy();

    const record: CustomRivenRecord = {
      id: "test-riven",
      name: "Acceltra Crita-Visiata",
      sourceWeaponUniqueName: acceltraPrime!.uniqueName,
      sourceWeaponName: acceltraPrime!.name,
      sourceWeaponDisposition: 0.8,
      familyKey: normalizeRivenWeaponFamilyKey(acceltraPrime!.name),
      polarity: "madurai",
      drain: 16,
      stats: [{ stat: "damageBonus", value: 80 }],
      createdAtIso: "2026-03-27T00:00:00.000Z",
      updatedAtIso: "2026-03-27T00:00:00.000Z",
    };

    const normalizedStats = normalizeCustomRivenStats(record);
    expect(normalizedStats).toEqual([{ stat: "damageBonus", value: 120 }]);
    expect(buildCustomRivenEntry(record).statsLabel).toContain("+120.0% Damage");
    expect(buildCustomRivenEntry(record).statsLabel).toContain("+120.0% Damage");

    const currentRecord = { ...record, sourceWeaponDisposition: CURRENT_RIVEN_STAT_MULTIPLIER };
    expect(normalizeCustomRivenStats(currentRecord)).toEqual([{ stat: "damageBonus", value: 80 }]);
  });

  it("treats coda progenitor weapons as overlevel-capable", () => {
    const dualCodaTorxica = getWeaponCatalog().find((weapon) => weapon.name === "Dual Coda Torxica");
    expect(dualCodaTorxica).toBeTruthy();
    expect(dualCodaTorxica?.canOverLevel).toBe(true);
    expect(dualCodaTorxica?.isProgenitorWeapon).toBe(true);
  });

  it("generates riven-style names from stat ordering", () => {
    expect(
      generateCustomRivenName("Acceltra Prime", [
        { stat: "multishot", value: 120 },
        { stat: "criticalChance", value: 90 },
        { stat: "damage", value: 60 },
      ]),
    ).toBe("Acceltra Prime Sati-critaata");

    expect(
      generateCustomRivenName("Tonkor", [
        { stat: "criticalChance", value: 120 },
        { stat: "multishot", value: 80 },
      ]),
    ).toBe("Tonkor Critacan");
  });

  it("treats faction riven stats as multipliers", () => {
    const definition = getCustomRivenStatDef("damageVsCorpus");
    expect(definition).toBeTruthy();
    expect(definition?.unit).toBe("multiplier");
    expect(formatRivenStatValue(definition!, 1.55)).toBe("x1.55 Damage to Corpus");

    const acceltraPrime = getWeaponCatalog().find((weapon) => weapon.name === "Acceltra Prime");
    const record: CustomRivenRecord = {
      id: "faction-riven",
      name: "Acceltra Mantiada",
      sourceWeaponUniqueName: acceltraPrime!.uniqueName,
      sourceWeaponName: acceltraPrime!.name,
      sourceWeaponDisposition: acceltraPrime!.disposition,
      familyKey: normalizeRivenWeaponFamilyKey(acceltraPrime!.name),
      polarity: "madurai",
      drain: 16,
      stats: [{ stat: "damageVsCorpus", value: 1.55 }],
      createdAtIso: "2026-03-27T00:00:00.000Z",
      updatedAtIso: "2026-03-27T00:00:00.000Z",
    };

    const built = buildCustomRivenEntry(record);
    expect(built.statsLabel).toContain("x1.55 Damage to Corpus");
    expect(built.effect.factionDamageBonus).toBeCloseTo(0.55, 6);
    expect(built.effect.targetFaction).toBe("Corpus");
  });
});
