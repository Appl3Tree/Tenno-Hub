import { describe, expect, it } from "vitest";
import {
  COUNTED_ITEM_SECTIONS,
  OWNED_ITEM_SECTIONS,
  decryptAlecaFrameDat,
  parseAlecaFrameInventory,
} from "../alecaFrameImport";

const item = "/Lotus/Types/Items/MiscItems/AlloyPlate";
const mod = "/Lotus/Upgrades/Mods/Rifle/WeaponClipMaxMod";

function fixture(): Record<string, unknown> {
  const result: Record<string, unknown> = { PlayerLevel: 23, RegularCredits: 100, PremiumCredits: 9 };
  for (const section of [...COUNTED_ITEM_SECTIONS, ...OWNED_ITEM_SECTIONS, "RawUpgrades", "Upgrades"]) {
    result[section] = [];
  }
  result.EmailItems = [];
  return result;
}

const classify = (path: string, section: string) =>
  section === "RawUpgrades" || section === "Upgrades"
    ? (path === mod ? "mod" as const : null)
    : (path === item ? "item" as const : null);

describe("AlecaFrame inventory parser", () => {
  it("combines stacked rank-zero and ranked copies without losing rank distribution", () => {
    const root = fixture();
    root.RawUpgrades = [{ ItemType: mod, ItemCount: 8 }];
    root.Upgrades = [
      { ItemType: mod, UpgradeFingerprint: '{"lvl":3}' },
      { ItemType: mod, UpgradeFingerprint: '{"lvl":5}' },
      { ItemType: mod, UpgradeFingerprint: '{"lvl":5}' },
    ];
    root.MiscItems = [{ ItemType: item, ItemCount: 42 }];
    const result = parseAlecaFrameInventory(root, classify);
    expect(result.importable).toBe(true);
    expect(result.sourceRecords).toBe(5);
    expect(result.records.find((entry) => entry.catalogId === `mods:${mod}`)).toMatchObject({
      quantity: 11,
      rankCounts: { "0": 8, "3": 1, "5": 2 },
    });
    expect(result.records.find((entry) => entry.catalogId === `items:${item}`)?.quantity).toBe(42);
    expect(result.playerLevel).toBe(23);
  });

  it("counts FlavourItems as individual owned records, not stacks", () => {
    const root = fixture();
    root.FlavourItems = [{ ItemType: item }, { ItemType: item }];
    const parsed = parseAlecaFrameInventory(root, classify);
    expect(parsed.importable).toBe(true);
    expect(parsed.records[0].quantity).toBe(2);
  });

  it("rejects a stacked item record without an explicit quantity", () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: item }];
    const parsed = parseAlecaFrameInventory(root, classify);
    expect(parsed.importable).toBe(false);
    expect(parsed.issues[0].reason).toContain("Invalid quantity");
  });

  it("blocks rather than guessing a missing catalog entry", () => {
    const root = fixture();
    root.MiscItems = [{ ItemType: "/Lotus/Unknown/SomeItem", ItemCount: 2 }];
    const result = parseAlecaFrameInventory(root, classify);
    expect(result.importable).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.records).toHaveLength(0);
  });

  it("reports unsupported Riven fingerprints without fabricating a rank", () => {
    const root = fixture();
    root.Upgrades = [{ ItemType: mod, UpgradeFingerprint: '{"compat":"Rifle","buffs":[]}' }];
    const result = parseAlecaFrameInventory(root, classify);
    expect(result.importable).toBe(false);
    expect(result.issues[0].reason).toContain("unsupported fingerprint");
    expect(result.records).toHaveLength(0);
  });

  it("rejects truncated or malformed inventory sections", () => {
    expect(() => parseAlecaFrameInventory({ MiscItems: [] }, classify)).toThrow("required sections");
    const root = fixture();
    delete root.Recipes;
    expect(parseAlecaFrameInventory(root, classify).importable).toBe(false);
  });

  it("decrypts AES-CBC/PKCS7 data and supports InventoryJson wrappers", async () => {
    const raw = JSON.stringify({ InventoryJson: JSON.stringify(fixture()) });
    const key = new TextEncoder().encode("LEO-ALEC\tEO-ALEC");
    const iv = new Uint8Array([49, 50, 70, 71, 66, 51, 54, 45, 76, 69, 51, 45, 113, 61, 57, 0]);
    const imported = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, imported,
      new TextEncoder().encode(raw));
    const decrypted = await decryptAlecaFrameDat(ciphertext);
    expect((decrypted as Record<string, unknown>).PlayerLevel).toBe(23);
  });

  it("refuses to claim mail attachments as already owned", () => {
    const root = fixture();
    root.EmailItems = [{ ItemType: item, ItemCount: 1 }];
    const result = parseAlecaFrameInventory(root, classify);
    expect(result.importable).toBe(false);
    expect(result.issues.some((issue) => issue.section === "EmailItems")).toBe(true);
  });

  it("rejects invalid ciphertext without exposing its contents", async () => {
    await expect(decryptAlecaFrameDat(new ArrayBuffer(15))).rejects.toThrow("Invalid AlecaFrame");
  });
});
