import { describe, expect, it } from "vitest";
import type { CustomRivenRecord, Inventory } from "../../domain/types";
import type { AlecaFrameInventorySnapshot } from "../alecaFrameImport";
import {
  buildAlecaFrameReview,
  reconcileAlecaFrameInventory,
} from "../alecaFrameReconcile";

const modPath = "/Lotus/Upgrades/Mods/Rifle/WeaponClipMaxMod";
const arcanePath = "/Lotus/Upgrades/CosmeticEnhancers/Warframe/ArcaneExample";
const modId = "mods:" + modPath;
const arcaneId = "mods:" + arcanePath;
const localOnlyId = "items:/Lotus/Types/Items/MiscItems/LocalOnly";
const now = "2026-01-01T00:00:00.000Z";

function riven(id: string, name = "Riven A", value = 100): CustomRivenRecord {
  return {
    id,
    name,
    sourceWeaponUniqueName: "/Lotus/Weapons/Tenno/Rifle/Example",
    sourceWeaponName: "Example",
    sourceWeaponDisposition: 1,
    familyKey: "example",
    polarity: "madurai",
    drain: 18,
    stats: [{ stat: "damage", value }],
    createdAtIso: now,
    updatedAtIso: now,
    importSource: "alecaframe",
    importStatus: "ready",
    sourceRank: 8,
    masteryRankRequired: 8,
    rerolls: 2,
    sourceAttributes: [{ tag: "WeaponDamageAmountMod", roll: 0.5, polarity: "positive" }],
  };
}

function snapshot(): AlecaFrameInventorySnapshot {
  return {
    playerLevel: null,
    credits: null,
    platinum: null,
    records: [
      {
        catalogId: modId,
        path: modPath,
        kind: "mod",
        section: "Upgrades",
        sourceSections: ["RawUpgrades", "Upgrades"],
        quantity: 4,
        rankCounts: { "0": 1, "3": 2, "5": 1 },
      },
      {
        catalogId: arcaneId,
        path: arcanePath,
        kind: "arcane",
        section: "Upgrades",
        sourceSections: ["Upgrades"],
        quantity: 2,
        rankCounts: { "0": 1, "4": 1 },
      },
    ],
    unresolvedRecords: [{
      path: "/Lotus/Types/Items/MiscItems/Unresolved",
      kind: "item",
      sourceSections: ["MiscItems"],
      quantity: 3,
      reason: "No exact canonical catalog match.",
    }],
    rivenRecords: [riven("riven-new")],
    issues: [],
    warnings: [],
    sections: {},
    excludedSections: {},
    totalArrayRecords: 3,
    sourceRecords: 3,
    distinctItems: 3,
    totalCopies: 7,
    rootFieldCount: 0,
    rootFields: [],
    importable: true,
    coverageComplete: true,
  };
}

function inventory(): Inventory {
  return {
    credits: 50,
    platinum: 7,
    counts: {
      [modId]: 3,
      [localOnlyId]: 6,
    },
    modRanks: { [modPath]: 2 },
    modRankCounts: { [modPath]: { "0": 3 } },
    arcaneRanks: {},
    arcaneRankCounts: {},
    customRivens: [],
  };
}

describe("AlecaFrame reconciliation", () => {
  it("replaces verified counts and exact ranks while preserving local-only state", () => {
    const next = reconcileAlecaFrameInventory(inventory(), snapshot(), "merge", new Set(), now);
    expect(next.counts[modId]).toBe(4);
    expect(next.modRankCounts?.[modPath]).toEqual({ "0": 1, "3": 2, "5": 1 });
    expect(next.modRanks?.[modPath]).toBe(5);
    expect(next.counts[arcaneId]).toBe(2);
    expect(next.arcaneRankCounts?.[arcanePath]).toEqual({ "0": 1, "4": 1 });
    expect(next.arcaneRanks?.[arcanePath]).toEqual({ "4": 1 });
    expect(next.counts[localOnlyId]).toBe(6);
    expect(next.credits).toBe(50);
    expect(next.platinum).toBe(7);
    expect(next.customRivens).toHaveLength(1);
    expect(next.alecaFrameUnresolvedRecords).toEqual(sourceUnresolved());
  });

  it("is idempotent when importing the same snapshot twice", () => {
    const once = reconcileAlecaFrameInventory(inventory(), snapshot(), "merge", new Set(), now);
    const twice = reconcileAlecaFrameInventory(once, snapshot(), "merge", new Set(), now);
    expect(twice.counts).toEqual(once.counts);
    expect(twice.modRankCounts).toEqual(once.modRankCounts);
    expect(twice.arcaneRankCounts).toEqual(once.arcaneRankCounts);
    expect(twice.customRivens).toHaveLength(once.customRivens?.length);
  });

  it("keeps conflicting local quantities and ranks while adding new records", () => {
    const next = reconcileAlecaFrameInventory(inventory(), snapshot(), "keep-local", new Set(), now);
    expect(next.counts[modId]).toBe(3);
    expect(next.modRankCounts?.[modPath]).toEqual({ "0": 3 });
    expect(next.counts[arcaneId]).toBe(2);
    expect(next.customRivens).toHaveLength(1);
    expect(next.counts[localOnlyId]).toBe(6);
  });

  it("keeps local values selected for an individual merge conflict", () => {
    const next = reconcileAlecaFrameInventory(
      inventory(), snapshot(), "merge", new Set([modId]), now,
    );
    expect(next.counts[modId]).toBe(3);
    expect(next.modRankCounts?.[modPath]).toEqual({ "0": 3 });
    expect(next.counts[arcaneId]).toBe(2);
  });

  it("persists unknown rank copies without inventing ranks or replacing a known maximum", () => {
    const source = snapshot();
    source.records[0] = {
      ...source.records[0],
      quantity: 4,
      rankCounts: { "0": 2 },
      unknownRankCount: 2,
      rankCountsComplete: false,
    };
    const current = inventory();
    current.modRanks![modPath] = 5;
    const next = reconcileAlecaFrameInventory(current, source, "overwrite", new Set(), now);
    expect(next.counts[modId]).toBe(4);
    expect(next.modRankCounts?.[modPath]).toEqual({ "0": 2 });
    expect(next.modUnknownRankCounts?.[modPath]).toBe(2);
    expect(next.modRanks?.[modPath]).toBe(5);
  });

  it("reports and preserves local-only records absent from the source", () => {
    const review = buildAlecaFrameReview(snapshot(), inventory());
    expect(review.localOnlyCount).toBe(1);
    expect(review.localOnlyCopies).toBe(6);
    const next = reconcileAlecaFrameInventory(inventory(), snapshot(), "overwrite", new Set(), now);
    expect(next.counts[localOnlyId]).toBe(6);
  });

  it("reviews changed Rivens and applies or retains them by selected instance", () => {
    const source = snapshot();
    const current = inventory();
    current.customRivens = [riven("riven-new", "Local Riven", 80)];
    const review = buildAlecaFrameReview(source, current);
    expect(review.changedRivenCount).toBe(1);
    expect(review.rivenRows[0].localRecord?.stats[0].value).toBe(80);

    const kept = reconcileAlecaFrameInventory(
      current, source, "merge", new Set(["riven-instance:riven-new"]), now,
    );
    expect(kept.customRivens?.[0].name).toBe("Local Riven");

    const replaced = reconcileAlecaFrameInventory(current, source, "overwrite", new Set(), now);
    expect(replaced.customRivens?.[0].name).toBe("Riven A");
    expect(replaced.customRivens?.[0].createdAtIso).toBe(now);
  });
});

function sourceUnresolved() {
  return [{
    path: "/Lotus/Types/Items/MiscItems/Unresolved",
    kind: "item" as const,
    sourceSections: ["MiscItems"],
    quantity: 3,
    reason: "No exact canonical catalog match.",
  }];
}
