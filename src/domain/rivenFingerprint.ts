import type { CustomRivenRecord, CustomRivenStatValue } from "./rivens";
import {
  getCustomRivenStatDef,
  normalizeRivenWeaponFamilyKey,
} from "./rivens";
import { getWeaponCatalog } from "./catalog/weaponCatalog";
import { RIVEN_BASE_WEIGHTS } from "./rivenBaseWeights";

type RivenPolarity = "positive" | "negative";

interface SourceRivenAttribute {
  tag: string;
  roll: number;
  polarity: RivenPolarity;
}

const RIVEN_TAG_TO_STAT: Record<string, string> = {
  WeaponArmorPiercingDamageMod: "punctureDamage",
  WeaponCritChanceMod: "criticalChance",
  WeaponCritDamageMod: "criticalDamage",
  WeaponElectricityDamageMod: "electricityDamage",
  WeaponFireDamageMod: "heatDamage",
  WeaponFireRateMod: "fireRateAttackSpeed",
  WeaponFreezeDamageMod: "coldDamage",
  WeaponImpactDamageMod: "impactDamage",
  WeaponProcTimeMod: "statusDuration",
  WeaponSlashDamageMod: "slashDamage",
  WeaponStunChanceMod: "statusChance",
  WeaponToxinDamageMod: "toxinDamage",
  WeaponAmmoMaxMod: "ammoMaximum",
  WeaponClipMaxMod: "magazineCapacity",
  WeaponDamageAmountMod: "damage",
  WeaponMeleeDamageMod: "damage",
  WeaponFireIterationsMod: "multishot",
  WeaponPunctureDepthMod: "punchThrough",
  WeaponRecoilReductionMod: "weaponRecoil",
  WeaponReloadSpeedMod: "reloadSpeed",
  WeaponFactionDamageCorpus: "damageVsCorpus",
  WeaponFactionDamageGrineer: "damageVsGrineer",
  WeaponFactionDamageInfested: "damageVsInfested",
  WeaponMeleeFactionDamageCorpus: "damageVsCorpus",
  WeaponMeleeFactionDamageGrineer: "damageVsGrineer",
  WeaponMeleeFactionDamageInfested: "damageVsInfested",
  WeaponZoomFovMod: "zoom",
  WeaponProjectileSpeedMod: "projectileSpeed",
  ComboDurationMod: "comboDuration",
  WeaponMeleeRangeIncMod: "range",
  WeaponMeleeFinisherDamageMod: "finisherDamage",
  WeaponMeleeComboEfficiencyMod: "comboEfficiency",
  WeaponMeleeComboInitialBonusMod: "initialCombo",
  WeaponMeleeComboPointsOnHitMod: "comboPointsOnHit",
  WeaponMeleeComboBonusOnHitMod: "additionalComboCountChance",
  SlideAttackCritChanceMod: "criticalChanceSlideAttack",
};

const POLARITY_MAP: Record<string, string> = {
  AP_ANY: "universal",
  AP_ATTACK: "madurai",
  AP_DEFENSE: "vazarin",
  AP_TACTIC: "naramon",
  AP_POWER: "zenurik",
  AP_WARD: "universal",
};

const POSITIVE_ATTENUATION = [0, 1, 0.66000003, 0.5, 0.40000001, 0.34999999];
const CURSE_ATTENUATION = [0, 1, 0.33000001, 0.5, 1.25, 1.5];
const MAX_RIVEN_ROLL = 0x3fffffff;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (!isObject(value)) return JSON.stringify(value) ?? "null";
  return "{" + Object.keys(value).sort().map((key) =>
    JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
}

function normalizeFingerprint(entry: Record<string, unknown>): Record<string, unknown> {
  const input = entry.UpgradeFingerprint;
  if (isObject(input)) return input;
  if (typeof input !== "string" || input.length > 100_000) {
    throw new Error("The personalized Riven fingerprint is missing or too large.");
  }
  const parsed: unknown = JSON.parse(input);
  if (!isObject(parsed)) throw new Error("The personalized Riven fingerprint is malformed.");
  return parsed;
}

function normalizeAttributes(
  fingerprint: Record<string, unknown>,
): { attributes: SourceRivenAttribute[]; errors: string[] } {
  const attributes: SourceRivenAttribute[] = [];
  const errors: string[] = [];
  for (const [field, polarity] of [["buffs", "positive"], ["curses", "negative"]] as const) {
    const values = fingerprint[field];
    if (values === undefined && field === "curses") continue;
    if (!Array.isArray(values)) {
      errors.push("The Riven attribute list is malformed.");
      continue;
    }
    for (const attribute of values) {
      if (!isObject(attribute) || typeof attribute.Tag !== "string" ||
          !Number.isSafeInteger(attribute.Value) || (attribute.Value as number) < 0 ||
          (attribute.Value as number) > MAX_RIVEN_ROLL) {
        errors.push("A Riven attribute value is malformed.");
        continue;
      }
      attributes.push({
        tag: attribute.Tag,
        roll: (attribute.Value as number) / MAX_RIVEN_ROLL,
        polarity,
      });
    }
  }
  return { attributes, errors };
}

function normalizePolarity(value: unknown): string {
  if (typeof value !== "string") return "";
  return POLARITY_MAP[value] ?? (
    ["madurai", "vazarin", "naramon", "zenurik", "universal"].includes(value.toLowerCase())
      ? value.toLowerCase()
      : ""
  );
}

function calculateMaxRankStats(
  rivenType: string,
  attributes: SourceRivenAttribute[],
  currentRank: number,
  disposition: number,
): { stats: CustomRivenStatValue[]; unsupported: string[] } {
  const weights = RIVEN_BASE_WEIGHTS[rivenType];
  if (!weights || disposition <= 0) return { stats: [], unsupported: attributes.map((a) => a.tag) };

  const positives = attributes.filter((attribute) => attribute.polarity === "positive");
  const curses = attributes.filter((attribute) => attribute.polarity === "negative");
  const positiveAttenuation = POSITIVE_ATTENUATION[Math.min(positives.length, POSITIVE_ATTENUATION.length - 1)];
  const curseAmplification = Math.pow(1.25, curses.length);
  const rankScale = currentRank + 1;
  const values: CustomRivenStatValue[] = [];
  const unsupported: string[] = [];

  for (const attribute of attributes) {
    const stat = RIVEN_TAG_TO_STAT[attribute.tag];
    const definition = stat ? getCustomRivenStatDef(stat) : null;
    const baseWeight = weights[attribute.tag];
    if (!stat || !definition || typeof baseWeight !== "number") {
      unsupported.push(attribute.tag);
      continue;
    }

    let value = baseWeight * 1.5 * disposition * 10;
    value *= attribute.polarity === "positive"
      ? curseAmplification * positiveAttenuation
      : CURSE_ATTENUATION[Math.min(positives.length, CURSE_ATTENUATION.length - 1)] *
        POSITIVE_ATTENUATION[Math.min(curses.length, POSITIVE_ATTENUATION.length - 1)];
    value *= 0.9 + 0.2 * attribute.roll;
    value *= rankScale;

    if (attribute.polarity === "negative") value *= -1;

    const maximumRankRawValue = value * 9 / (currentRank + 1);
    if (definition.unit === "percent") value = maximumRankRawValue * 100;
    else if (definition.unit === "multiplier") value = 1 + maximumRankRawValue;
    else value = maximumRankRawValue;
    const precision = definition.unit === "multiplier" ? 100 : 10;
    if (definition.unit === "flat" || definition.unit === "meters" || definition.unit === "seconds") {
      value = Math.round(value * 10) / 10;
    } else if (definition.unit === "multiplier") {
      value = Math.round(value * precision) / precision;
    } else {
      value = Math.round(value * 10) / 10;
    }
    values.push({
      stat,
      value,
    });
  }

  return { stats: values, unsupported };
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/**
 * Normalizes only supported Riven fields. The original fingerprint and instance
 * ID are never returned or stored; a one-way digest provides stable re-imports.
 */
export async function parseAlecaFrameRiven(
  entry: Record<string, unknown>,
  itemTypePath: string,
  catalogId: string,
  index: number,
): Promise<{ record: CustomRivenRecord; warnings: string[] }> {
  const fingerprint = normalizeFingerprint(entry);
  const path = itemTypePath;
  const compat = typeof fingerprint.compat === "string" ? fingerprint.compat : "";
  const weapon = getWeaponCatalog().find((candidate) => candidate.uniqueName === compat);
  const rank = Number.isSafeInteger(fingerprint.lvl) && (fingerprint.lvl as number) >= 0 && (fingerprint.lvl as number) <= 8
    ? fingerprint.lvl as number
    : null;
  const masteryRankRequired = Number.isSafeInteger(fingerprint.lvlReq) &&
    (fingerprint.lvlReq as number) >= 0 && (fingerprint.lvlReq as number) <= 30
    ? fingerprint.lvlReq as number
    : null;
  const rerolls = Number.isSafeInteger(fingerprint.rerolls) && (fingerprint.rerolls as number) >= 0
    ? fingerprint.rerolls as number
    : null;
  const polarity = normalizePolarity(fingerprint.pol);
  const { attributes, errors } = normalizeAttributes(fingerprint);

  const sourceItemId = entry.ItemId;
  const hasSourceItemId = sourceItemId !== undefined && sourceItemId !== null &&
    typeof sourceItemId !== "boolean" &&
    !(typeof sourceItemId === "string" && sourceItemId.trim().length === 0) &&
    !(Array.isArray(sourceItemId) && sourceItemId.length === 0) &&
    !(isObject(sourceItemId) && Object.keys(sourceItemId).length === 0);
  const stableIdentity = !hasSourceItemId
    ? catalogId + "|" + stableJson(fingerprint) + "|" + index
    : stableJson(sourceItemId);
  const digestInput = new TextEncoder().encode(catalogId + "|" + stableIdentity);
  const id = "alecaframe-" + hex(await globalThis.crypto.subtle.digest("SHA-256", digestInput));

  const warnings: string[] = [...errors];
  if (!weapon) warnings.push("Weapon compatibility is not in the current exact weapon catalog.");
  if (rank === null) warnings.push("The source fingerprint does not contain an explicit Riven rank; rank and derived stats remain unknown.");
  if (masteryRankRequired === null) warnings.push("The source fingerprint does not contain a verified Mastery Rank requirement.");
  if (rerolls === null) warnings.push("The source fingerprint does not contain a verified reroll count.");
  if (!polarity) warnings.push("The source polarity is not recognized.");
  if (!hasSourceItemId) warnings.push("The save has no instance ID; identity uses the fingerprint and its duplicate ordinal.");
  if (attributes.length === 0) warnings.push("No personalized attributes were present in the fingerprint.");

  const rivenType = path.slice(path.lastIndexOf("/") + 1);
  let stats: CustomRivenStatValue[] = [];
  let importStatus: NonNullable<CustomRivenRecord["importStatus"]> = "ready";

  if (errors.length > 0) {
    importStatus = "unsupported-stat";
  } else if (!weapon) {
    importStatus = "weapon-unknown";
  } else if (rank === null) {
    importStatus = "rank-unknown";
  } else {
    const calculated = calculateMaxRankStats(rivenType, attributes, rank, weapon.disposition);
    if (calculated.unsupported.length > 0) {
      warnings.push("One or more attribute types are not supported by the current Riven catalog.");
      importStatus = "unsupported-stat";
    } else {
      stats = calculated.stats;
    }
  }

  const sourceWeaponName = weapon?.name ?? "Unknown weapon";
  const mappedStats = stats.length > 0 ? stats : [];
  const name = sourceWeaponName + " Riven";

  const record: CustomRivenRecord = {
    id,
    name,
    sourceWeaponUniqueName: compat,
    sourceWeaponName,
    sourceWeaponDisposition: weapon?.disposition ?? 0,
    familyKey: weapon ? normalizeRivenWeaponFamilyKey(weapon.name) : "",
    polarity,
    drain: 18,
    stats: mappedStats,
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
    importSource: "alecaframe",
    importStatus,
    sourceRank: rank,
    masteryRankRequired,
    rerolls,
    sourceAttributes: attributes,
  };

  return { record, warnings };
}

