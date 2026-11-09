/**
 * Local AlecaFrame lastData.dat parser.
 * The file is processed locally and treated as untrusted input.
 */
import type { AlecaFrameUnresolvedRecord, CustomRivenRecord } from "../domain/types";

const KEY = new TextEncoder().encode("LEO-ALEC\tEO-ALEC");
const IV = new Uint8Array([49, 50, 70, 71, 66, 51, 54, 45, 76, 69, 51, 45, 113, 61, 57, 0]);
export const ALECAFRAME_MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ARRAY_RECORDS = 100_000;
const MAX_ITEM_QUANTITY = 100_000_000;

type JsonObject = Record<string, unknown>;
export type AlecaFrameKind = "item" | "mod" | "arcane" | "riven";

export interface AlecaFrameCatalogMatch {
  catalogId: string;
  kind: AlecaFrameKind;
  /** Explicitly marks a sticker item stored in AlecaFrame's stacked RawUpgrades section. */
  rawUpgradeItem?: boolean;
}

export interface AlecaFrameIssue {
  section: string;
  index: number;
  path: string;
  reason: string;
}

export interface AlecaFrameRecord {
  catalogId: string;
  path: string;
  kind: AlecaFrameKind;
  section: string;
  sourceSections: string[];
  quantity: number;
  rankCounts?: Record<string, number>;
  unknownRankCount?: number;
  rankCountsComplete?: boolean;
}

export type { AlecaFrameUnresolvedRecord } from "../domain/types";

export interface AlecaFrameSectionSummary {
  sourceRecords: number;
  importedRecords: number;
  importedCopies: number;
  unresolvedRecords: number;
  unresolvedCopies: number;
  rankUnknownRecords: number;
  rankUnknownCopies: number;
  skippedRecords: number;
  failedRecords: number;
  excludedRecords: number;
  status: "imported" | "partial" | "excluded" | "unclassified" | "missing";
  reason?: string;
}

export interface AlecaFrameRivenResult {
  record: CustomRivenRecord;
  warnings: string[];
}

export type AlecaFrameRivenResolver = (
  entry: JsonObject,
  path: string,
  catalogId: string,
  index: number,
) => Promise<AlecaFrameRivenResult>;

export interface AlecaFrameInventorySnapshot {
  playerLevel: number | null;
  credits: number | null;
  platinum: number | null;
  records: AlecaFrameRecord[];
  unresolvedRecords: AlecaFrameUnresolvedRecord[];
  rivenRecords: CustomRivenRecord[];
  issues: AlecaFrameIssue[];
  warnings: AlecaFrameIssue[];
  sections: Record<string, AlecaFrameSectionSummary>;
  excludedSections: Record<string, { sourceRecords: number; reason: string }>;
  totalArrayRecords: number;
  sourceRecords: number;
  distinctItems: number;
  totalCopies: number;
  rootFieldCount: number;
  rootFields: Array<{ name: string; valueType: string }>;
  importable: boolean;
  coverageComplete: boolean;
}

export const COUNTED_ITEM_SECTIONS = [
  "Consumables", "LevelKeys", "MiscItems", "Recipes", "CrewShipAmmo",
  "CrewShipRawSalvage", "ShipDecorations", "FusionTreasures",
] as const;

export const OWNED_ITEM_SECTIONS = [
  "FlavourItems", "LongGuns", "Melee", "Pistols", "Suits",
  "SentinelWeapons", "Sentinels", "SpaceSuits", "SpaceMelee",
  "SpaceGuns", "Ships", "Scoops", "SpecialItems", "DataKnives",
  "MechSuits", "CrewShipHarnesses", "CrewShips", "DrifterMelee",
  "Horses", "OperatorSuits", "OperatorAmps", "Motorcycles",
  "KubrowPets", "CrewShipWeapons", "CrewShipWeaponSkins", "Drones",
  "WeaponSkins",
] as const;

const STACKED_MOD_SECTIONS = ["RawUpgrades"] as const;
const INDIVIDUAL_MOD_SECTIONS = ["Upgrades"] as const;
const SUPPORTED_ITEM_SECTIONS = new Set<string>([
  ...COUNTED_ITEM_SECTIONS, ...OWNED_ITEM_SECTIONS,
  ...STACKED_MOD_SECTIONS, ...INDIVIDUAL_MOD_SECTIONS,
]);

export const EXCLUDED_SECTIONS: Record<string, string> = {
  EmailItems: "Inbox attachments are not proof that the items have been claimed.",
  PendingRecipes: "Foundry jobs are in progress and are not collected inventory.",
  Boosters: "Active booster timers are not a reusable inventory quantity.",
  LoreFragmentScans: "Codex scan progress is progression data.",
  SpectreLoadouts: "Saved Spectre configurations are loadouts, not owned copies.",
  FocusUpgrades: "Focus school upgrades are progression data.",
  PersonalTechProjects: "Clan research projects are not completed or collected items.",
  EvolutionProgress: "Incarnon evolution progress is progression data, not ownership.",
  CrewMembers: "Railjack crew roster records are not catalog inventory items.",
  Missions: "Mission history is not inventory.",
  QuestKeys: "Quest state is not inventory.",
  XPInfo: "Mastery XP is separate from current ownership.",
  ChallengeProgress: "Challenge progress is separate from current ownership.",
  CompletedAlerts: "Alert history is not inventory.",
  DeathMarks: "Nemesis marks are progression state.",
  FactionScores: "Faction standing is progression data.",
  TauntHistory: "Nemesis interaction history is not inventory.",
  CurrentLoadOutIds: "Loadout selections are configurations, not extra copies.",
  Affiliations: "Syndicate state is progression data.",
  CompletedSyndicates: "Syndicate completion history is progression data.",
  PersonalGoalProgress: "Personal challenge progress is not inventory.",
  EquippedGear: "Equipment slots reference owned gear; they are not extra copies.",
  CompletedJobs: "Job completion history is progression data.",
  DiscoveredMarkers: "Map discovery state is progression data.",
  PeriodicMissionCompletions: "Mission completion history is progression data.",
  OperatorLoadOuts: "Operator loadouts are configurations, not extra copies.",
  NodeIntrosCompleted: "Star Chart history is progression data.",
  SeasonChallengeHistory: "Challenge history is progression data.",
  LoginMilestoneRewards: "Login reward history is not current inventory.",
  CompletedSorties: "Sortie history is progression data.",
  RecentVendorPurchases: "Purchase history is not current ownership.",
  ChallengeInstanceStates: "Challenge progress is separate from inventory.",
  DescentRewards: "Unclaimed or temporary reward state is not current inventory.",
  CompletedJobChains: "Job completion history is progression data.",
  LastSortieReward: "Reward history is not current inventory.",
  LastLiteSortieReward: "Reward history is not current inventory.",
  SortieRewardAttenuation: "Reward history is not current inventory.",
  NemesisHistory: "Nemesis history is progression data.",
  SongChallenges: "Challenge progress is separate from inventory.",
  EndlessXP: "Mission reward state is not collected inventory.",
  QualifyingInvasions: "Invasion state is not inventory.",
  PendingTrades: "Pending trades are not completed ownership changes.",
  NemesisAbandonedRewards: "Unclaimed rewards are not current inventory.",
  PendingSpectreLoadouts: "Pending configurations are not owned inventory.",
  EchoesHexConquestBonusTokensGiven: "Conquest history is progression data.",
  EchoesHexConquestActiveFrameVariants: "Active configurations are not extra copies.",
  EchoesHexConquestActiveStickers: "Active configurations are not extra copies.",
  SpecialItemRewardAttenuation: "Reward history is not current inventory.",
  QuickBuyList: "Quick-buy history is not current inventory.",
  ClaimedJunctionChallengeRewards: "Junction reward history is progression data.",
  LibraryPersonalProgress: "Codex progress is separate from ownership.",
  CollectibleSeries: "Collectible scan progress is separate from ownership.",
  EquippedEmotes: "Equipped emote references are loadout selections, not item quantities.",
  OneTimePurchases: "Purchase flags are account history, not current inventory quantities.",
  NewItems: "Unreviewed-item markers are UI state, not additional copies.",
  AdultOperatorLoadOuts: "Appearance configurations are loadouts, not additional owned equipment.",
  KahlLoadOuts: "Kahl configuration data is a loadout, not current inventory.",
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function hasSourceInstanceId(value: unknown): boolean {
  if (value === null || value === undefined || typeof value === "boolean") return false;
  if (typeof value === "string") return value.trim().length > 0 && value.length <= 100_000;
  if (typeof value === "number") return Number.isSafeInteger(value);
  if (Array.isArray(value)) return value.length > 0 && stableJson(value).length <= 100_000;
  if (isObject(value)) return Object.keys(value).length > 0 && stableJson(value).length <= 100_000;
  return false;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The decrypted AlecaFrame file does not contain valid JSON.");
  }
}

export function unwrapAlecaFrameInventory(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!isObject(current)) return current;
    const wrapped = current.InventoryJson;
    if (typeof wrapped === "string") {
      current = parseJson(wrapped);
      continue;
    }
    if (isObject(wrapped)) {
      current = wrapped;
      continue;
    }
    break;
  }
  return current;
}

export async function decryptAlecaFrameDat(bytes: ArrayBuffer): Promise<unknown> {
  if (bytes.byteLength === 0 || bytes.byteLength > ALECAFRAME_MAX_FILE_BYTES ||
      bytes.byteLength % 16 !== 0) {
    throw new Error("Invalid AlecaFrame file size. Select an unmodified lastData.dat smaller than 25 MB.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot decrypt AlecaFrame data. Use a secure, up-to-date browser.");
  }
  try {
    const key = await globalThis.crypto.subtle.importKey(
      "raw", KEY, { name: "AES-CBC" }, false, ["decrypt"],
    );
    const clearBytes = await globalThis.crypto.subtle.decrypt(
      { name: "AES-CBC", iv: IV }, key, bytes,
    );
    const text = new TextDecoder("utf-8", { fatal: true }).decode(clearBytes);
    const unwrapped = unwrapAlecaFrameInventory(parseJson(text));
    if (!isObject(unwrapped)) throw new Error("Unsupported AlecaFrame save structure.");
    return unwrapped;
  } catch (error) {
    if (error instanceof Error &&
        (error.message.startsWith("The decrypted") ||
         error.message.startsWith("Unsupported AlecaFrame"))) {
      throw error;
    }
    throw new Error("Unable to decrypt this file. Select an unmodified AlecaFrame lastData.dat.");
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (!isObject(value)) return JSON.stringify(value) ?? "null";
  return "{" + Object.keys(value).sort().map((key) =>
    JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
}

function fingerprintObject(entry: JsonObject): JsonObject | null {
  const value = entry.UpgradeFingerprint;
  if (isObject(value)) return value;
  if (typeof value !== "string" || value.length > 100_000) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function parseAlecaFrameInventory(
  input: unknown,
  classify: (path: string, section: string) => AlecaFrameCatalogMatch | null,
  resolveRiven: AlecaFrameRivenResolver,
): Promise<AlecaFrameInventorySnapshot> {
  const value = unwrapAlecaFrameInventory(input);
  if (!isObject(value)) throw new Error("Not a supported AlecaFrame inventory snapshot.");

  const presentSupported = [...SUPPORTED_ITEM_SECTIONS].some((section) => Array.isArray(value[section]));
  if (!presentSupported) {
    throw new Error("Not a supported AlecaFrame inventory snapshot (no recognized inventory sections).");
  }

  const records = new Map<string, AlecaFrameRecord>();
  const unresolvedRecords = new Map<string, AlecaFrameUnresolvedRecord>();
  const rivenRecords = new Map<string, CustomRivenRecord>();
  const rivenCatalogIds = new Set<string>();
  const rivenFingerprintOccurrences = new Map<string, number>();
  const issues: AlecaFrameIssue[] = [];
  const warnings: AlecaFrameIssue[] = [];
  const sections: Record<string, AlecaFrameSectionSummary> = {};
  const excludedSections: Record<string, { sourceRecords: number; reason: string }> = {};
  const seenInstanceIds = new Map<string, { path: string; section: string; index: number }>();
  const totalArrayRecords = Object.values(value).reduce<number>(
    (total, entry) => total + (Array.isArray(entry) ? entry.length : 0), 0,
  );

  const issue = (target: AlecaFrameIssue[], section: string, index: number, path: string, reason: string) =>
    target.push({ section, index, path, reason });

  const addRecord = (
    section: string,
    index: number,
    path: string,
    match: AlecaFrameCatalogMatch,
    quantity: number,
    rank: number | null,
  ): boolean => {
    const existing = records.get(match.catalogId) ?? {
      catalogId: match.catalogId, path, kind: match.kind, section,
      sourceSections: [], quantity: 0,
      ...((match.kind === "mod" || match.kind === "arcane")
        ? { rankCountsComplete: true, unknownRankCount: 0 }
        : {}),
    };
    const nextQuantity = existing.quantity + quantity;
    if (!Number.isSafeInteger(nextQuantity)) {
      issue(issues, section, index, path, "Combined quantity exceeds the safe integer limit.");
      return false;
    }
    existing.quantity = nextQuantity;
    if (!existing.sourceSections.includes(section)) existing.sourceSections.push(section);
    if (rank !== null) {
      existing.rankCounts ??= {};
      const key = String(rank);
      const nextRankCount = (existing.rankCounts[key] ?? 0) + quantity;
      if (!Number.isSafeInteger(nextRankCount)) {
        issue(issues, section, index, path, "Combined rank quantity exceeds the safe integer limit.");
        return false;
      }
      existing.rankCounts[key] = nextRankCount;
    } else if (match.kind === "mod" || match.kind === "arcane") {
      existing.rankCountsComplete = false;
      existing.unknownRankCount = (existing.unknownRankCount ?? 0) + quantity;
      if (!Number.isSafeInteger(existing.unknownRankCount)) {
        issue(issues, section, index, path, "Combined unknown-rank quantity exceeds the safe integer limit.");
        return false;
      }
    }
    records.set(match.catalogId, existing);
    return true;
  };

  const addUnresolvedRecord = (
    section: string,
    index: number,
    path: string,
    kind: "item" | "upgrade",
    quantity: number,
    rank: number | null,
    reason: string,
  ): boolean => {
    const key = JSON.stringify([kind, path]);
    const existing = unresolvedRecords.get(key) ?? {
      path, kind, sourceSections: [], quantity: 0,
      rankCountsComplete: kind === "item" || rank !== null,
      reason,
    };
    if (!existing.reason.split("; ").includes(reason) && existing.reason.length < 600) {
      existing.reason = (existing.reason + "; " + reason).slice(0, 600);
    }
    const nextQuantity = existing.quantity + quantity;
    if (!Number.isSafeInteger(nextQuantity)) {
      issue(issues, section, index, path, "Combined unresolved quantity exceeds the safe integer limit.");
      return false;
    }
    existing.quantity = nextQuantity;
    if (!existing.sourceSections.includes(section)) existing.sourceSections.push(section);
    if (kind === "upgrade") {
      if (rank === null || existing.rankCountsComplete === false) {
        existing.rankCountsComplete = false;
        delete existing.rankCounts;
      } else {
        existing.rankCounts ??= {};
        const rankKey = String(rank);
        const nextRankCount = (existing.rankCounts[rankKey] ?? 0) + quantity;
        if (!Number.isSafeInteger(nextRankCount)) {
          issue(issues, section, index, path, "Combined unresolved rank quantity exceeds the safe integer limit.");
          return false;
        }
        existing.rankCounts[rankKey] = nextRankCount;
      }
    }
    unresolvedRecords.set(key, existing);
    return true;
  };

  const inspectItemRecord = async (
    section: string,
    index: number,
    entry: unknown,
    expected: "item" | "upgrade",
    perCopy: boolean,
  ): Promise<"imported" | "rank-unknown" | "unresolved" | "skipped" | "failed"> => {
    if (!isObject(entry) || typeof entry.ItemType !== "string" ||
        !entry.ItemType.startsWith("/Lotus/") || entry.ItemType.length > 512) {
      issue(issues, section, index, "", "The record has no valid canonical Lotus ItemType.");
      return "failed";
    }
    const path = entry.ItemType;
    const match = classify(path, section);

    let quantity: number;
    if (perCopy) {
      quantity = 1;
    } else {
      const rawCount = entry.ItemCount;
      if (!isSafeInteger(rawCount, MAX_ITEM_QUANTITY)) {
        issue(issues, section, index, path, "The stacked record has an invalid or excessive ItemCount.");
        return "failed";
      }
      quantity = rawCount;
    }

    if (perCopy && hasSourceInstanceId(entry.ItemId)) {
      const key = stableJson(entry.ItemId);
      const previous = seenInstanceIds.get(key);
      if (previous) {
        if (previous.path !== path) {
          issue(issues, section, index, path, "The same source instance ID maps to different canonical items.");
          return "failed";
        }
        issue(warnings, section, index, path, "Duplicate source instance reference ignored to avoid double-counting.");
        return "skipped";
      }
      seenInstanceIds.set(key, { path, section, index });
    }

    const expectedKindMatches = match &&
      ((expected === "item" && match.kind === "item") ||
        (expected === "upgrade" && match.kind !== "item") ||
        (expected === "upgrade" && section === "RawUpgrades" &&
          match.kind === "item" && match.rawUpgradeItem === true));
    const stackedRivenTemplate = expected === "upgrade" &&
      section === "RawUpgrades" && match?.kind === "riven";
    if (!expectedKindMatches || (match?.kind === "riven" && section !== "Upgrades" && !stackedRivenTemplate)) {
      let rank: number | null = null;
      if (expected === "upgrade") {
        if (section === "RawUpgrades") {
          rank = 0;
        } else {
          const fingerprint = fingerprintObject(entry);
          if (isSafeInteger(fingerprint?.lvl, 20)) rank = fingerprint.lvl;
        }
      }
      const reason = !match
        ? "No exact canonical catalog match; this source identity is retained unresolved."
        : "The exact catalog path belongs to a different category; the source identity is retained unresolved.";
      return addUnresolvedRecord(section, index, path, expected, quantity, rank, reason)
        ? "unresolved"
        : "failed";
    }

    // RawUpgrades stores stacked, non-personalized upgrade types with an
    // explicit ItemCount. Riven templates in this section have no per-copy
    // fingerprint, so preserve the exact catalog type and quantity as a
    // generic Riven stack instead of trying to synthesize personal Rivens.
    if (stackedRivenTemplate) {
      return addRecord(section, index, path, match, quantity, null) ? "imported" : "failed";
    }

    let rank: number | null = null;
    if (expected === "upgrade") {
      if (match.kind === "riven") {
        try {
          let identityOrdinal = index;
          if (!hasSourceInstanceId(entry.ItemId)) {
            const fingerprint = fingerprintObject(entry);
            if (fingerprint) {
              const fingerprintKey = stableJson(fingerprint);
              identityOrdinal = rivenFingerprintOccurrences.get(fingerprintKey) ?? 0;
              rivenFingerprintOccurrences.set(fingerprintKey, identityOrdinal + 1);
            }
          }
          const resolved = await resolveRiven(entry, path, match.catalogId, identityOrdinal);
          if (rivenRecords.has(resolved.record.id)) {
            issue(issues, section, index, path, "The Riven instance identity is duplicated.");
            return "failed";
          }
          rivenRecords.set(resolved.record.id, resolved.record);
          rivenCatalogIds.add(match.catalogId);
          for (const warning of resolved.warnings) issue(warnings, section, index, path, warning);
          return "imported";
        } catch {
          const fingerprint = fingerprintObject(entry);
          const fallbackRank = isSafeInteger(fingerprint?.lvl, 20) ? fingerprint.lvl : null;
          issue(warnings, section, index, path, "The Riven instance is retained unresolved because its personalized data could not be normalized.");
          return addUnresolvedRecord(
            section, index, path, "upgrade", quantity, fallbackRank,
            "The personalized Riven fields could not be normalized.",
          ) ? "unresolved" : "failed";
        }
      } else if (section === "RawUpgrades" && (match.kind === "mod" || match.kind === "arcane")) {
        rank = 0;
      } else if (match.kind === "mod" || match.kind === "arcane") {
        const fingerprint = fingerprintObject(entry);
        if (!fingerprint || !isSafeInteger(fingerprint.lvl, 20)) {
          issue(warnings, section, index, path, "The individual mod or arcane copy is retained, but its rank is not recorded.");
        } else {
          rank = fingerprint.lvl;
        }
      }
    }

    if (!addRecord(section, index, path, match, quantity, rank)) return "failed";
    return expected === "upgrade" && (match.kind === "mod" || match.kind === "arcane") && rank === null
      ? "rank-unknown"
      : "imported";
  };

  const processSection = async (
    section: string,
    expected: "item" | "upgrade",
    perCopy: boolean,
  ): Promise<void> => {
    const inputRecords = value[section];
    if (!Array.isArray(inputRecords)) {
      if (Object.prototype.hasOwnProperty.call(value, section)) {
        issue(issues, section, -1, "", "The known source section is present but is not an array.");
        sections[section] = {
          sourceRecords: 0, importedRecords: 0, importedCopies: 0,
          unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0,
          skippedRecords: 0, failedRecords: 1, excludedRecords: 0,
          status: "unclassified", reason: "The source section has an invalid value type.",
        };
        return;
      }
      sections[section] = {
        sourceRecords: 0, importedRecords: 0, importedCopies: 0,
        unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0, skippedRecords: 0,
        failedRecords: 0, excludedRecords: 0,
        status: "missing", reason: "This section is absent from the save.",
      };
      return;
    }
    if (inputRecords.length > MAX_ARRAY_RECORDS) {
      issue(issues, section, -1, "", "Section exceeds the supported record limit.");
      sections[section] = {
        sourceRecords: inputRecords.length, importedRecords: 0, importedCopies: 0,
        unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0, skippedRecords: 0,
        failedRecords: inputRecords.length, excludedRecords: 0,
        status: "unclassified", reason: "Section exceeds the supported record limit.",
      };
      return;
    }
    const importedCopiesBefore = [...records.values()].reduce((sum, record) => sum + record.quantity, 0) + rivenRecords.size;
    const unresolvedCopiesBefore = [...unresolvedRecords.values()].reduce((sum, record) => sum + record.quantity, 0);
    let importedCount = 0;
    let unresolvedCount = 0;
    let rankUnknownCount = 0;
    let rankUnknownCopies = 0;
    let skippedCount = 0;
    let failedCount = 0;
    for (let index = 0; index < inputRecords.length; index += 1) {
      const outcome = await inspectItemRecord(section, index, inputRecords[index], expected, perCopy);
      if (outcome === "imported") {
        importedCount += 1;
      } else if (outcome === "rank-unknown") {
        importedCount += 1;
        rankUnknownCount += 1;
        rankUnknownCopies += 1;
      } else if (outcome === "unresolved") {
        unresolvedCount += 1;
      } else if (outcome === "skipped") {
        skippedCount += 1;
      } else {
        failedCount += 1;
      }
    }
    const importedCopiesAfter = [...records.values()].reduce((sum, record) => sum + record.quantity, 0) + rivenRecords.size;
    const unresolvedCopiesAfter = [...unresolvedRecords.values()].reduce((sum, record) => sum + record.quantity, 0);
    sections[section] = {
      sourceRecords: inputRecords.length,
      importedRecords: importedCount,
      importedCopies: importedCopiesAfter - importedCopiesBefore,
      unresolvedRecords: unresolvedCount,
      unresolvedCopies: unresolvedCopiesAfter - unresolvedCopiesBefore,
      rankUnknownRecords: rankUnknownCount,
      rankUnknownCopies,
      skippedRecords: skippedCount,
      failedRecords: failedCount,
      excludedRecords: 0,
      status: unresolvedCount > 0 || rankUnknownCount > 0 || skippedCount > 0 || failedCount > 0 ? "partial" : "imported",
    };
  };

  for (const section of COUNTED_ITEM_SECTIONS) await processSection(section, "item", false);
  for (const section of OWNED_ITEM_SECTIONS) await processSection(section, "item", true);
  for (const section of STACKED_MOD_SECTIONS) await processSection(section, "upgrade", false);
  for (const section of INDIVIDUAL_MOD_SECTIONS) await processSection(section, "upgrade", true);

  for (const [section, reason] of Object.entries(EXCLUDED_SECTIONS)) {
    const excluded = value[section];
    if (!Array.isArray(excluded)) {
      if (Object.prototype.hasOwnProperty.call(value, section)) {
        issue(issues, section, -1, "", "The known excluded section is present but is not an array.");
        sections[section] = {
          sourceRecords: 0, importedRecords: 0, importedCopies: 0,
          unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0,
          skippedRecords: 0, failedRecords: 1, excludedRecords: 0,
          status: "unclassified", reason: "The source section has an invalid value type.",
        };
      }
      continue;
    }
    if (excluded.length > MAX_ARRAY_RECORDS) {
      issue(issues, section, -1, "", "Section exceeds the supported record limit.");
      excludedSections[section] = { sourceRecords: excluded.length, reason };
      sections[section] = {
        sourceRecords: excluded.length, importedRecords: 0, importedCopies: 0,
        unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0, skippedRecords: 0,
        failedRecords: 0, excludedRecords: excluded.length,
        status: "excluded", reason,
      };
      continue;
    }
    excludedSections[section] = { sourceRecords: excluded.length, reason };
    sections[section] = {
      sourceRecords: excluded.length, importedRecords: 0, importedCopies: 0,
      unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0, skippedRecords: 0,
      failedRecords: 0, excludedRecords: excluded.length,
      status: "excluded", reason,
    };
  }

  const known = new Set([...SUPPORTED_ITEM_SECTIONS, ...Object.keys(EXCLUDED_SECTIONS)]);
  for (const [section, entries] of Object.entries(value)) {
    if (!Array.isArray(entries) || known.has(section)) continue;
    if (entries.length > MAX_ARRAY_RECORDS) {
      sections[section] = {
        sourceRecords: entries.length, importedRecords: 0, importedCopies: 0,
        unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0, skippedRecords: 0,
        failedRecords: entries.length, excludedRecords: 0,
        status: "unclassified", reason: "Section exceeds the supported record limit.",
      };
      issue(issues, section, -1, "", "Section exceeds the supported record limit.");
      continue;
    }
    const itemTypeIndexes = entries
      .map((entry, index) => isObject(entry) && typeof entry.ItemType === "string" ? index : -1)
      .filter((index) => index >= 0);
    sections[section] = {
      sourceRecords: entries.length, importedRecords: 0, importedCopies: 0,
      unresolvedRecords: 0, unresolvedCopies: 0, rankUnknownRecords: 0, rankUnknownCopies: 0, skippedRecords: 0,
      failedRecords: entries.length, excludedRecords: 0,
      status: "unclassified",
      reason: itemTypeIndexes.length > 0
        ? "Contains item identities but is not mapped as inventory or a verified non-inventory section."
        : "This source array is not classified by the importer.",
    };
    if (itemTypeIndexes.length === 0) {
      issue(issues, section, -1, "", "Unclassified source array; import is blocked until its meaning is verified.");
    }
    for (const index of itemTypeIndexes) {
      const entry = entries[index] as JsonObject;
      issue(issues, section, index, typeof entry.ItemType === "string" ? entry.ItemType : "",
        "Unclassified ItemType section; import blocked until its semantics are verified.");
    }
  }

  const playerLevel = value.PlayerLevel;
  const numericField = (field: string): number | null => {
    const raw = value[field];
    if (raw === undefined) return null;
    if (!isSafeInteger(raw)) {
      issue(issues, field, -1, "", "The numeric profile field is malformed.");
      return null;
    }
    return raw;
  };
  if (playerLevel !== undefined && !isSafeInteger(playerLevel, 100)) {
    issue(issues, "PlayerLevel", -1, "", "The Mastery Rank field is malformed.");
  }

  const normalizedRecords = [...records.values()]
    .sort((left, right) => left.catalogId.localeCompare(right.catalogId));
  const normalizedUnresolved = [...unresolvedRecords.values()].sort((left, right) =>
    left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind),
  );
  const totalCopies = normalizedRecords.reduce((sum, record) => sum + record.quantity, 0) +
    normalizedUnresolved.reduce((sum, record) => sum + record.quantity, 0) + rivenRecords.size;
  const requiredCoverageSections = [...COUNTED_ITEM_SECTIONS, ...OWNED_ITEM_SECTIONS, ...STACKED_MOD_SECTIONS, ...INDIVIDUAL_MOD_SECTIONS];
  const coverageComplete = requiredCoverageSections.every((section) => sections[section]?.status === "imported");

  return {
    playerLevel: isSafeInteger(playerLevel, 100) ? playerLevel : null,
    credits: numericField("RegularCredits"),
    platinum: numericField("PremiumCredits"),
    records: normalizedRecords,
    unresolvedRecords: normalizedUnresolved,
    rivenRecords: [...rivenRecords.values()].sort((left, right) => left.id.localeCompare(right.id)),
    issues, warnings, sections, excludedSections,
    totalArrayRecords, sourceRecords: totalArrayRecords,
    distinctItems: normalizedRecords.length + rivenCatalogIds.size,
    totalCopies,
    rootFieldCount: Object.keys(value).length,
    rootFields: Object.entries(value).map(([name, entry]) => ({
      name,
      valueType: Array.isArray(entry) ? "array" : entry === null ? "null" : typeof entry,
    })),
    importable: issues.length === 0 &&
      (normalizedRecords.length > 0 || normalizedUnresolved.length > 0 || rivenRecords.size > 0),
    coverageComplete,
  };
}

