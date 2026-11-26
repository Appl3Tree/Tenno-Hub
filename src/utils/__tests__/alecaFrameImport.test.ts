import { describe, expect, it } from "vitest";
import type { CustomRivenRecord } from "../../domain/types";
import { getWeaponCatalog } from "../../domain/catalog/weaponCatalog";
import { parseAlecaFrameRiven } from "../../domain/rivenFingerprint";
import { reconcileAlecaFrameInventory } from "../alecaFrameReconcile";
import { exactAlecaFrameCatalogMatch } from "../alecaFrameCatalogMatch";
import {
  COUNTED_ITEM_SECTIONS,
  EXCLUDED_SECTIONS,
  OWNED_ITEM_SECTIONS,
  decryptAlecaFrameDat,
  parseAlecaFrameInventory,
} from "../alecaFrameImport";

const item = "/Lotus/Types/Items/MiscItems/AlloyPlate";
const moaPet = "/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetBPowerSuit";
const mod = "/Lotus/Upgrades/Mods/Rifle/WeaponClipMaxMod";
const arcane = "/Lotus/Upgrades/CosmeticEnhancers/Warframe/ArcaneExample";
const riven = "/Lotus/Upgrades/Mods/Randomized/LotusRifleRandomModRare";
const sticker = "/Lotus/Upgrades/Stickers/TestSticker";
const legendaryCorePath = "/Lotus/Upgrades/Mods/Fusers/LegendaryModFuser";
const legendaryCoreCatalogPath = "/Lotus/StoreItems/Upgrades/Mods/Fusers/LegendaryModFuser";
const now = "2026-01-01T00:00:00.000Z";

function fixture(): Record<string, unknown> {
  const result: Record<string, unknown> = { PlayerLevel: 23, RegularCredits: 100, PremiumCredits: 9 };
  for (const section of [...COUNTED_ITEM_SECTIONS, ...OWNED_ITEM_SECTIONS, "RawUpgrades", "Upgrades"]) {
    result[section] = [];
  }
  for (const section of Object.keys(EXCLUDED_SECTIONS)) result[section] = [];
  return result;
}

const classify = (path: string, section: string) => {
  if (section === "RawUpgrades" || section === "Upgrades") {
    if (path === sticker) return {
      catalogId: `items:${path}`,
      kind: "item" as const,
      ...(section === "RawUpgrades" ? { rawUpgradeItem: true } : {}),
    };
    if (path === riven) return { catalogId: `rivens:${path}`, kind: "riven" as const };
    if (path === mod) return { catalogId: `mods:${path}`, kind: "mod" as const };
    if (path === arcane) return { catalogId: `mods:${path}`, kind: "arcane" as const };
    return null;
  }
  return path === item || path === moaPet ? { catalogId: `items:${path}`, kind: "item" as const } : null;
};

function rivenRecord(id: string, sourceRank: number | null = null): CustomRivenRecord {
  return {
    id,
    name: "Test Riven",
    sourceWeaponUniqueName: "/Lotus/Weapons/Tenno/Rifle/TestRifle",
    sourceWeaponName: "Test Rifle",
    sourceWeaponDisposition: 1,
    familyKey: "test rifle",
    polarity: "madurai",
    drain: 18,
    stats: [],
    createdAtIso: now,
    updatedAtIso: now,
    importSource: "alecaframe",
    importStatus: "rank-unknown",
    sourceRank,
    masteryRankRequired: null,
    rerolls: null,
    sourceAttributes: [],
  };
}

const resolveRiven = async (_entry: Record<string, unknown>, _path: string, _catalogId: string, index: number) => ({
  record: rivenRecord(`riven-${index}`),
  warnings: [],
});

describe("AlecaFrame inventory parser", () => {
  it("preserves stacked rank-zero copies and each ranked mod distribution", async () => {
    const root = fixture();
    root.RawUpgrades = [{ ItemType: mod, ItemCount: 8 }];
    root.Upgrades = [
      { ItemType: mod, ItemId: "mod-a", UpgradeFingerprint: '{"lvl":3}' },
      { ItemType: mod, ItemId: "mod-b", UpgradeFingerprint: '{"lvl":5}' },
      { ItemType: mod, ItemId: "mod-c", UpgradeFingerprint: '{"lvl":5}' },
    ];
    root.MiscItems = [{ ItemType: item, ItemCount: 42 }];

    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(true);
    expect(result.records.find((entry) => entry.catalogId === `mods:${mod}`)).toMatchObject({
      quantity: 11,
      rankCounts: { "0": 8, "3": 1, "5": 2 },
    });
    expect(result.records.find((entry) => entry.catalogId === `items:${item}`)?.quantity).toBe(42);
    expect(result.totalCopies).toBe(53);
    expect(result.playerLevel).toBe(23);
    expect(result.sections.RawUpgrades?.status).toBe("imported");
    expect(result.sections.Upgrades?.status).toBe("imported");
    expect(result.sections.MiscItems?.status).toBe("imported");
    expect(result.coverageComplete).toBe(true);
  });

  it("counts owned equipment instances and ignores duplicate instance references", async () => {
    const root = fixture();
    root.FlavourItems = [
      { ItemType: item, ItemId: "copy-a" },
      { ItemType: item, ItemId: "copy-a" },
      { ItemType: item, ItemId: "copy-b" },
      { ItemType: item, ItemId: null },
      { ItemType: item, ItemId: "" },
      { ItemType: item },
    ];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(true);
    expect(result.records[0].quantity).toBe(5);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toContain("Duplicate source instance");
  });

  it("imports MoaPets as owned equipment and excludes FoundToday counters from holdings", async () => {
    const root = fixture();
    root.MoaPets = [{ ItemType: moaPet, ItemId: "moa-pet-a" }];
    root.FoundToday = [{ ItemType: "/Lotus/Types/Items/MiscItems/ArgonCrystal", ItemCount: 6 }];

    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);

    expect(result.importable).toBe(true);
    expect(result.records).toContainEqual(expect.objectContaining({
      catalogId: `items:${moaPet}`,
      kind: "item",
      quantity: 1,
      sourceSections: ["MoaPets"],
    }));
    expect(result.records.some((record) => record.path.endsWith("ArgonCrystal"))).toBe(false);
    expect(result.totalCopies).toBe(1);
    expect(result.sections.MoaPets).toMatchObject({ status: "imported", importedCopies: 1 });
    expect(result.sections.FoundToday).toMatchObject({ status: "excluded", excludedRecords: 1 });
    expect(result.issues).toHaveLength(0);
  });

  it("counts Legendary Core stacks as a non-rankable inventory item", async () => {
    const root = fixture();
    root.RawUpgrades = [{ ItemType: legendaryCorePath, ItemCount: 3 }];

    const result = await parseAlecaFrameInventory(
      root,
      (path, section) => exactAlecaFrameCatalogMatch(path, section),
      resolveRiven,
    );

    expect(result.importable).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.unresolvedRecords).toHaveLength(0);
    expect(result.records).toContainEqual(expect.objectContaining({
      catalogId: `items:${legendaryCoreCatalogPath}`,
      path: legendaryCorePath,
      kind: "item",
      quantity: 3,
      sourceSections: ["RawUpgrades"],
    }));
    expect(result.records.find((record) => record.path === legendaryCorePath)?.rankCounts).toBeUndefined();
    expect(result.sections.RawUpgrades).toMatchObject({ status: "imported", importedCopies: 3 });

    const reconciled = reconcileAlecaFrameInventory(
      { counts: {}, credits: 0, platinum: 0 },
      result,
      "overwrite",
    );
    expect(reconciled.counts[`items:${legendaryCoreCatalogPath}`]).toBe(3);
  });

  it("rejects a stacked item record without an explicit safe quantity", async () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: item }];
    root.Recipes = [{ ItemType: item, ItemCount: Number.MAX_SAFE_INTEGER + 1 }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(false);
    expect(result.issues.some((entry) => entry.reason.includes("invalid or excessive ItemCount"))).toBe(true);
  });

  it("retains exact paths missing from the catalog as reportable unresolved records", async () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: "/Lotus/Unknown/SomeItem", ItemCount: 2 }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.records).toHaveLength(0);
    expect(result.unresolvedRecords).toMatchObject([
      { path: "/Lotus/Unknown/SomeItem", kind: "item", quantity: 2, sourceSections: ["MiscItems"] },
    ]);
    expect(result.totalCopies).toBe(2);
    expect(result.sections.MiscItems).toMatchObject({ status: "partial", unresolvedRecords: 1, unresolvedCopies: 2 });
  });

  it("preserves an individual mod quantity without inventing a rank", async () => {
    const root = fixture();
    root.Upgrades = [{ ItemType: mod, ItemId: "mod-a", UpgradeFingerprint: "{}" }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(true);
    expect(result.records).toMatchObject([{ catalogId: `mods:${mod}`, quantity: 1 }]);
    expect(result.records[0].rankCounts).toBeUndefined();
    expect(result.records[0].unknownRankCount).toBe(1);
    expect(result.records[0].rankCountsComplete).toBe(false);
    expect(result.warnings[0].reason).toContain("rank is not recorded");
    expect(result.sections.Upgrades).toMatchObject({ status: "partial", rankUnknownRecords: 1, rankUnknownCopies: 1 });
    expect(result.coverageComplete).toBe(false);
  });

  it("keeps individual arcane copies and their fingerprint ranks separate", async () => {
    const root = fixture();
    root.Upgrades = [
      { ItemType: arcane, ItemId: "arcane-a", UpgradeFingerprint: '{"lvl":0}' },
      { ItemType: arcane, ItemId: "arcane-b", UpgradeFingerprint: '{"lvl":4}' },
    ];

    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);

    expect(result.records).toContainEqual(expect.objectContaining({
      catalogId: `mods:${arcane}`,
      kind: "arcane",
      quantity: 2,
      rankCounts: { "0": 1, "4": 1 },
      unknownRankCount: 0,
      rankCountsComplete: true,
    }));
    expect(result.sections.Upgrades).toMatchObject({ status: "imported", importedCopies: 2 });
  });

  it("retains personalized Rivens as unique individual copies", async () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: item, ItemCount: 1 }];
    root.Upgrades = [{ ItemType: riven, ItemId: "instance-a", UpgradeFingerprint: "{}" }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(true);
    expect(result.rivenRecords).toHaveLength(1);
    expect(result.totalCopies).toBe(2);
    expect(result.sections.Upgrades?.importedCopies).toBe(1);
  });

  it("imports stacked Riven templates by their exact catalog type without inventing personal records", async () => {
    const root = fixture();
    root.RawUpgrades = [{ ItemType: riven, ItemCount: 4 }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.records).toMatchObject([{
      catalogId: `rivens:${riven}`,
      path: riven,
      kind: "riven",
      quantity: 4,
      sourceSections: ["RawUpgrades"],
    }]);
    expect(result.rivenRecords).toHaveLength(0);
    expect(result.unresolvedRecords).toHaveLength(0);
    expect(result.totalCopies).toBe(4);
    expect(result.sections.RawUpgrades).toMatchObject({ status: "imported", importedCopies: 4 });
  });

  it("imports stacked Peely Pix as counted items without assigning mod ranks", async () => {
    const root = fixture();
    root.RawUpgrades = [{ ItemType: sticker, ItemCount: 7 }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.records).toMatchObject([{
      catalogId: `items:${sticker}`,
      path: sticker,
      kind: "item",
      quantity: 7,
      sourceSections: ["RawUpgrades"],
    }]);
    expect(result.records[0].rankCounts).toBeUndefined();
    expect(result.records[0].unknownRankCount).toBeUndefined();
    expect(result.unresolvedRecords).toHaveLength(0);
    expect(result.sections.RawUpgrades).toMatchObject({ status: "imported", importedCopies: 7 });
  });

  it("keeps no-instance-ID Riven identities stable when other fingerprints reorder", async () => {
    const weapon = getWeaponCatalog().find((entry) => entry.name === "Acceltra");
    expect(weapon).toBeDefined();
    const fingerprints = [
      { compat: weapon!.uniqueName, lvl: 2, pol: "AP_ATTACK", buffs: [{ Tag: "WeaponDamageAmountMod", Value: 100 }] },
      { compat: weapon!.uniqueName, lvl: 3, pol: "AP_ATTACK", buffs: [{ Tag: "WeaponCritChanceMod", Value: 200 }] },
    ];
    const parse = (ordered: typeof fingerprints) => {
      const root = fixture();
      root.Upgrades = ordered.map((UpgradeFingerprint) => ({ ItemType: riven, UpgradeFingerprint }));
      return parseAlecaFrameInventory(root, classify, async (entry, path, catalogId, index) => {
        const result = await parseAlecaFrameRiven(entry, path, catalogId, index);
        return { record: result.record, warnings: result.warnings };
      });
    };
    const first = await parse(fingerprints);
    const reordered = await parse([...fingerprints].reverse());
    expect(first.rivenRecords.map((record) => record.id).sort())
      .toEqual(reordered.rivenRecords.map((record) => record.id).sort());
  });

  it("keeps newly unclassified ItemType sections out of ownership without blocking recognized inventory", async () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: item, ItemCount: 4 }];
    root.FutureArray = [{ ItemType: item, ItemCount: 999 }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.records).toMatchObject([{ catalogId: `items:${item}`, quantity: 4 }]);
    expect(result.totalCopies).toBe(4);
    expect(result.sections.FutureArray).toMatchObject({
      sourceRecords: 1,
      status: "unclassified",
      importedRecords: 0,
      skippedRecords: 1,
      failedRecords: 0,
    });
    expect(result.coverageComplete).toBe(false);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      section: "FutureArray",
      index: 0,
      path: item,
      reason: expect.stringContaining("left out of owned inventory"),
    }));
    expect(result.totalArrayRecords).toBe(result.sourceRecords);
    expect(Object.values(result.sections).reduce((sum, section) => sum + section.sourceRecords, 0))
      .toBe(result.sourceRecords);
    expect(result.rootFields.some((field) => field.name === "FutureArray" && field.valueType === "array"))
      .toBe(true);
  });

  it("reports an unfamiliar metadata array without blocking supported inventory", async () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: item, ItemCount: 3 }];
    root.FutureMetadata = ["one", "two"];

    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);

    expect(result.importable).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.records).toMatchObject([{ catalogId: `items:${item}`, quantity: 3 }]);
    expect(result.sections.FutureMetadata).toMatchObject({
      sourceRecords: 2,
      status: "unclassified",
      skippedRecords: 2,
      failedRecords: 0,
    });
    expect(result.warnings).toContainEqual(expect.objectContaining({
      section: "FutureMetadata",
      index: -1,
      reason: expect.stringContaining("recognized sections remain importable"),
    }));
  });

  it("keeps unclaimed email attachments and in-progress Foundry jobs out of owned inventory", async () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: item, ItemCount: 1 }];
    root.EmailItems = [{ ItemType: item, ItemCount: 99 }];
    root.PendingRecipes = [{ ItemType: item, ItemId: "job-a" }];
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].quantity).toBe(1);
    expect(result.excludedSections.EmailItems?.sourceRecords).toBe(1);
    expect(result.excludedSections.PendingRecipes?.sourceRecords).toBe(1);
  });

  it("rejects a save with no recognized inventory arrays", async () => {
    await expect(parseAlecaFrameInventory({ PlayerLevel: 20 }, classify, resolveRiven))
      .rejects.toThrow("no recognized inventory sections");
  });

  it("blocks malformed known sections instead of treating them as absent", async () => {
    const root = fixture();
    root.Suits = { ItemType: item };
    root.EmailItems = { ItemType: item };
    const result = await parseAlecaFrameInventory(root, classify, resolveRiven);
    expect(result.importable).toBe(false);
    expect(result.sections.Suits).toMatchObject({ status: "unclassified", failedRecords: 1 });
    expect(result.sections.EmailItems).toMatchObject({ status: "unclassified", failedRecords: 1 });
    expect(result.issues).toHaveLength(2);
  });

  it("decrypts AES-CBC data with PKCS padding and unwraps InventoryJson", async () => {
    const raw = JSON.stringify({ InventoryJson: JSON.stringify(fixture()) });
    const key = new TextEncoder().encode("LEO-ALEC\tEO-ALEC");
    const iv = new Uint8Array([49, 50, 70, 71, 66, 51, 54, 45, 76, 69, 51, 45, 113, 61, 57, 0]);
    const imported = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv }, imported, new TextEncoder().encode(raw),
    );
    const decrypted = await decryptAlecaFrameDat(ciphertext);
    expect((decrypted as Record<string, unknown>).PlayerLevel).toBe(23);
  });

  it("rejects truncated ciphertext and unsupported decoded structures", async () => {
    await expect(decryptAlecaFrameDat(new ArrayBuffer(15))).rejects.toThrow("Invalid AlecaFrame");

    const key = new TextEncoder().encode("LEO-ALEC\tEO-ALEC");
    const iv = new Uint8Array([49, 50, 70, 71, 66, 51, 54, 45, 76, 69, 51, 45, 113, 61, 57, 0]);
    const imported = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv }, imported, new TextEncoder().encode("[]"),
    );
    await expect(decryptAlecaFrameDat(ciphertext)).rejects.toThrow("Unsupported AlecaFrame");
  });
});
