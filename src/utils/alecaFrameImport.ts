/**
 * AlecaFrame lastData.dat snapshot reader.
 *
 * Never uploads source bytes, logs decrypted data, or assumes that an absent
 * record proves lack of ownership. Matching is by exact canonical Lotus path.
 *
 * AlecaFrame's known save format is AES-128-CBC / PKCS#7, with a fixed
 * application key and IV (see the public AlecaFrame inventory parsers).
 */
const KEY = new TextEncoder().encode("LEO-ALEC\tEO-ALEC");
const IV = new Uint8Array([49, 50, 70, 71, 66, 51, 54, 45, 76, 69, 51, 45, 113, 61, 57, 0]);

type JsonObject = Record<string, unknown>;
type CatalogMatch = "item" | "mod" | "arcane" | null;

export interface AlecaFrameIssue {
  section: string;
  index: number;
  path: string;
  reason: string;
}

export interface AlecaFrameRecord {
  catalogId: string;
  path: string;
  section: string;
  quantity: number;
  rankCounts?: Record<string, number>;
}

export interface AlecaFrameInventorySnapshot {
  playerLevel: number | null;
  credits: number | null;
  platinum: number | null;
  records: AlecaFrameRecord[];
  issues: AlecaFrameIssue[];
  sections: Record<string, number>;
  /** Paths are intentionally not silently converted between catalog namespaces. */
  importable: boolean;
  /** A count of entries, not a count of distinct mods or items. */
  sourceRecords: number;
}

/**
 * Checked explicitly rather than iterating every top-level array: many of the
 * other save sections are not inventory (quests, challenges, deltas, loadouts).
 */
export const COUNTED_ITEM_SECTIONS = [
  "Consumables", "FlavourItems", "LevelKeys", "MiscItems", "Recipes",
  "CrewShipAmmo", "CrewShipRawSalvage", "ShipDecorations", "EmailItems",
  "FusionTreasures",
] as const;

export const OWNED_ITEM_SECTIONS = [
  "LongGuns", "Melee", "Pistols", "Suits", "SentinelWeapons", "Sentinels",
  "SpaceSuits", "SpaceMelee", "SpaceGuns", "Ships", "Scoops",
  "SpecialItems", "DataKnives", "MechSuits", "CrewShipHarnesses",
  "CrewShips", "DrifterMelee", "Horses", "OperatorSuits", "OperatorAmps",
  "Motorcycles", "KubrowPets", "CrewShipWeapons", "Drones", "CrewMembers",
  "WeaponSkins",
] as const;

function object(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("The decrypted AlecaFrame file does not contain valid JSON.");
  }
}

export async function decryptAlecaFrameDat(bytes: ArrayBuffer): Promise<unknown> {
  if (bytes.byteLength === 0 || bytes.byteLength % 16 !== 0) {
    throw new Error("Invalid AlecaFrame file size: expected AES-CBC ciphertext.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot decrypt AlecaFrame data. A secure browser context is required.");
  }
  try {
    const key = await globalThis.crypto.subtle.importKey("raw", KEY, { name: "AES-CBC" }, false, ["decrypt"]);
    const clearBytes = await globalThis.crypto.subtle.decrypt({ name: "AES-CBC", iv: IV }, key, bytes);
    const json = parseJson(new TextDecoder("utf-8", { fatal: true }).decode(clearBytes));
    if (object(json) && typeof json.InventoryJson === "string") {
      return parseJson(json.InventoryJson);
    }
    return json;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The decrypted")) throw error;
    throw new Error("Unable to decrypt this file. Select an unmodified AlecaFrame lastData.dat.");
  }
}

/**
 * `classify(path)` must return a category ONLY for an exact canonical match:
 * - 'item' for items:/Lotus/...
 * - 'mod' for mods:/Lotus/...
 * - 'arcane' for mods:/Lotus/... entries known to be arcanes.
 * A null classification is an audit defect, never an inferred match.
 */
export function parseAlecaFrameInventory(
  value: unknown,
  classify: (path: string, section: string) => CatalogMatch,
): AlecaFrameInventorySnapshot {
  if (!object(value) || !Array.isArray(value.RawUpgrades) || !Array.isArray(value.Upgrades) ||
      !Array.isArray(value.MiscItems)) {
    throw new Error("Not a supported AlecaFrame inventory snapshot (required sections missing).");
  }

  const issues: AlecaFrameIssue[] = [];
  const byKey = new Map<string, AlecaFrameRecord>();
  const sections: Record<string, number> = {};
  let sourceRecords = 0;

  function issue(section: string, index: number, path: string, reason: string) {
    issues.push({ section, index, path, reason });
  }

  function add(
    section: string,
    index: number,
    entry: unknown,
    expected: "item" | "mod",
    perCopy: boolean,
  ): void {
    sourceRecords += 1;
    if (!object(entry) || typeof entry.ItemType !== "string" ||
        !entry.ItemType.startsWith("/Lotus/")) {
      issue(section, index, "", "Invalid or missing Lotus ItemType");
      return;
    }
    const path = entry.ItemType;
    const category = classify(path, section);
    if (!category || (expected === "item" && category !== "item") ||
        (expected === "mod" && category === "item")) {
      issue(section, index, path, "No exact matching canonical catalog entry");
      return;
    }

    const quantity: unknown = perCopy ? 1 : entry.ItemCount;
    if (!integer(quantity) || quantity > 100_000_000) {
      issue(section, index, path, "Invalid quantity");
      return;
    }

    const catalogId = `${expected === "mod" ? "mods" : "items"}:${path}`;
    const existing = byKey.get(catalogId);
    const record: AlecaFrameRecord = existing ?? {
      catalogId, path, section, quantity: 0,
    };

    let rank: number | null = null;
    if (expected === "mod") {
      if (section === "RawUpgrades") {
        rank = 0;
      } else {
        const fingerprint = entry.UpgradeFingerprint;
        let fingerprintObject: unknown;
        try {
          fingerprintObject = typeof fingerprint === "string" ? JSON.parse(fingerprint) : null;
        } catch {
          fingerprintObject = null;
        }
        if (!object(fingerprintObject) || !integer(fingerprintObject.lvl) ||
            fingerprintObject.lvl > 20) {
          issue(section, index, path, "Mod has an unsupported fingerprint (possibly a personalized Riven); rank not imported");
          return;
        }
        rank = fingerprintObject.lvl;
      }
    }
    record.quantity += quantity;
    if (!Number.isSafeInteger(record.quantity)) {
      issue(section, index, path, "Aggregate quantity exceeds safe integer range");
      return;
    }
    if (rank !== null && quantity !== 0) {
      record.rankCounts ??= {};
      record.rankCounts[String(rank)] = (record.rankCounts[String(rank)] ?? 0) + quantity;
    }
    byKey.set(catalogId, record);
  }

  for (const section of COUNTED_ITEM_SECTIONS) {
    const entries = value[section];
    if (!Array.isArray(entries)) {
      issue(section, -1, "", "Inventory section missing or malformed");
      continue;
    }
    sections[section] = entries.length;
    entries.forEach((entry, index) => add(section, index, entry, "item", false));
  }
  for (const section of OWNED_ITEM_SECTIONS) {
    const entries = value[section];
    if (!Array.isArray(entries)) {
      issue(section, -1, "", "Inventory section missing or malformed");
      continue;
    }
    sections[section] = entries.length;
    entries.forEach((entry, index) => add(section, index, entry, "item", true));
  }

  for (const section of ["RawUpgrades", "Upgrades"] as const) {
    const entries = value[section];
    if (!Array.isArray(entries)) {
      issue(section, -1, "", "Inventory section missing or malformed");
      continue;
    }
    sections[section] = entries.length;
    entries.forEach((entry, index) => add(section, index, entry, "mod", section === "Upgrades"));
  }

  const currency = (field: string): number | null => {
    const val = value[field];
    if (val === undefined) return null;
    if (!integer(val)) {
      issue(field, -1, "", "Malformed currency field");
      return null;
    }
    return val;
  };

  const level = value.PlayerLevel;
  if (level !== undefined && (!integer(level) || level > 100)) {
    issue("PlayerLevel", -1, "", "Malformed Mastery Rank field");
  }

  return {
    playerLevel: integer(level) && level <= 100 ? level : null,
    credits: currency("RegularCredits"),
    platinum: currency("PremiumCredits"),
    records: Array.from(byKey.values()).sort((a, b) => a.catalogId.localeCompare(b.catalogId)),
    issues,
    sections,
    importable: issues.length === 0,
    sourceRecords,
  };
}
