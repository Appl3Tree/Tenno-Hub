import type { AlecaFrameUnresolvedRecord, CustomRivenRecord, Inventory } from "../domain/types";
import type { AlecaFrameInventorySnapshot, AlecaFrameRecord } from "./alecaFrameImport";

export type AlecaFrameReconciliationMode = "merge" | "overwrite" | "keep-local";

export interface AlecaFrameRecordDiff {
  record: AlecaFrameRecord;
  localQuantity: number;
  hasLocalQuantity: boolean;
  quantityChanged: boolean;
  rankChanged: boolean;
  localRankCounts: Record<string, number> | null;
  localUnknownRankCount: number;
  changed: boolean;
  isNew: boolean;
}

export interface AlecaFrameReview {
  rows: AlecaFrameRecordDiff[];
  rivenRows: Array<{
    record: CustomRivenRecord;
    localRecord: CustomRivenRecord | null;
    changed: boolean;
    isNew: boolean;
  }>;
  newCount: number;
  unchangedCount: number;
  changedCount: number;
  rankChangedCount: number;
  newRivenCount: number;
  changedRivenCount: number;
  unchangedRivenCount: number;
  localOnlyRivenCount: number;
  localOnlyCount: number;
  localOnlyCopies: number;
  unresolvedNewCount: number;
  unresolvedChangedCount: number;
  unresolvedUnchangedCount: number;
  unresolvedRemovedCount: number;
}

function sortedRankMap(value: Record<string, number> | undefined): Record<string, number> | null {
  if (!value) return null;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => Number(left) - Number(right)));
}

function rankMapsEqual(left: Record<string, number> | null, right: Record<string, number> | undefined): boolean {
  if (!left || !right) return false;
  const a = sortedRankMap(left) ?? {};
  const b = sortedRankMap(right) ?? {};
  return JSON.stringify(a) === JSON.stringify(b);
}

function localRankCounts(record: AlecaFrameRecord, inventory: Inventory): Record<string, number> | null {
  if (record.kind === "mod") return sortedRankMap(inventory.modRankCounts?.[record.path]);
  if (record.kind === "arcane") return sortedRankMap(inventory.arcaneRankCounts?.[record.path]);
  return null;
}

function localUnknownRankCount(record: AlecaFrameRecord, inventory: Inventory): number {
  if (record.kind === "mod") return inventory.modUnknownRankCounts?.[record.path] ?? 0;
  if (record.kind === "arcane") return inventory.arcaneUnknownRankCounts?.[record.path] ?? 0;
  return 0;
}

export function buildAlecaFrameReview(
  snapshot: AlecaFrameInventorySnapshot,
  inventory: Inventory,
): AlecaFrameReview {
  const sourceIds = new Set(snapshot.records.map((record) => record.catalogId));
  const rows = snapshot.records.map((record): AlecaFrameRecordDiff => {
    const hasLocalQuantity = Object.prototype.hasOwnProperty.call(inventory.counts, record.catalogId);
    const localQuantity = inventory.counts[record.catalogId] ?? 0;
    const localRanks = localRankCounts(record, inventory);
    const localUnknownRanks = localUnknownRankCount(record, inventory);
    const hasRankSnapshot = record.kind === "mod" || record.kind === "arcane";
    const rankChanged = hasRankSnapshot && (
      !rankMapsEqual(localRanks, record.rankCounts ?? {}) ||
      localUnknownRanks !== (record.unknownRankCount ?? 0)
    );
    const quantityChanged = localQuantity !== record.quantity;
    const isNew = !hasLocalQuantity || localQuantity === 0;
    return {
      record,
      localQuantity,
      hasLocalQuantity,
      quantityChanged,
      rankChanged,
      localRankCounts: localRanks,
      localUnknownRankCount: localUnknownRanks,
      changed: quantityChanged || rankChanged,
      isNew,
    };
  });

  const localOnly = Object.entries(inventory.counts).filter(([catalogId, quantity]) =>
    quantity > 0 && !sourceIds.has(catalogId),
  );
  const localRivens = new Map((inventory.customRivens ?? []).map((record) => [record.id, record]));
  const rivenRows = snapshot.rivenRecords.map((record) => {
    const localRecord = localRivens.get(record.id) ?? null;
    return {
      record,
      localRecord,
      changed: localRecord !== null && !sameRivenData(localRecord, record),
      isNew: localRecord === null,
    };
  });
  const snapshotRivenIds = new Set(snapshot.rivenRecords.map((record) => record.id));
  const localUnresolved = inventory.alecaFrameUnresolvedRecords ?? [];
  const localUnresolvedByKey = new Map(localUnresolved.map((record) => [unresolvedKey(record), record]));
  const unresolvedNewCount = snapshot.unresolvedRecords.filter((record) =>
    !localUnresolvedByKey.has(unresolvedKey(record)),
  ).length;
  const unresolvedChangedCount = snapshot.unresolvedRecords.filter((record) => {
    const localRecord = localUnresolvedByKey.get(unresolvedKey(record));
    return localRecord !== undefined && !sameUnresolvedData(localRecord, record);
  }).length;
  const snapshotUnresolvedKeys = new Set(snapshot.unresolvedRecords.map(unresolvedKey));
  const unresolvedRemovedCount = localUnresolved.filter((record) =>
    !snapshotUnresolvedKeys.has(unresolvedKey(record)),
  ).length;
  return {
    rows,
    rivenRows,
    newCount: rows.filter((row) => row.isNew && row.record.quantity > 0).length,
    unchangedCount: rows.filter((row) => !row.changed).length,
    changedCount: rows.filter((row) => row.changed && !row.isNew).length,
    rankChangedCount: rows.filter((row) => row.rankChanged && !row.isNew).length,
    newRivenCount: rivenRows.filter((row) => row.isNew).length,
    changedRivenCount: rivenRows.filter((row) => row.changed && !row.isNew).length,
    unchangedRivenCount: rivenRows.filter((row) => !row.changed && !row.isNew).length,
    localOnlyRivenCount: [...localRivens.keys()].filter((id) => !snapshotRivenIds.has(id)).length,
    localOnlyCount: localOnly.length,
    localOnlyCopies: localOnly.reduce((sum, [, quantity]) => sum + quantity, 0),
    unresolvedNewCount,
    unresolvedChangedCount,
    unresolvedUnchangedCount: snapshot.unresolvedRecords.length - unresolvedNewCount - unresolvedChangedCount,
    unresolvedRemovedCount,
  };
}

function unresolvedKey(record: AlecaFrameUnresolvedRecord): string {
  return JSON.stringify([record.kind, record.path]);
}

function sameUnresolvedData(left: AlecaFrameUnresolvedRecord, right: AlecaFrameUnresolvedRecord): boolean {
  return left.path === right.path &&
    left.kind === right.kind &&
    left.quantity === right.quantity &&
    left.rankCountsComplete === right.rankCountsComplete &&
    left.reason === right.reason &&
    JSON.stringify([...left.sourceSections].sort()) === JSON.stringify([...right.sourceSections].sort()) &&
    JSON.stringify(sortedRankMap(left.rankCounts)) === JSON.stringify(sortedRankMap(right.rankCounts));
}

function maxRank(rankCounts: Record<string, number>): number | null {
  const ranks = Object.entries(rankCounts)
    .filter(([, count]) => count > 0)
    .map(([rank]) => Number(rank))
    .filter(Number.isSafeInteger);
  return ranks.length === 0 ? null : Math.max(...ranks);
}

function sameRivenData(left: CustomRivenRecord, right: CustomRivenRecord): boolean {
  const normalize = (value: CustomRivenRecord) => {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "createdAtIso" && key !== "updatedAtIso"),
    );
  };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export function reconcileAlecaFrameInventory(
  current: Inventory,
  snapshot: AlecaFrameInventorySnapshot,
  mode: AlecaFrameReconciliationMode,
  keepLocalCatalogIds: ReadonlySet<string> = new Set(),
  nowIso = new Date().toISOString(),
): Inventory {
  const next: Inventory = {
    ...current,
    counts: { ...current.counts },
    modRanks: { ...(current.modRanks ?? {}) },
    modRankCounts: { ...(current.modRankCounts ?? {}) },
    modUnknownRankCounts: { ...(current.modUnknownRankCounts ?? {}) },
    arcaneRanks: { ...(current.arcaneRanks ?? {}) },
    arcaneRankCounts: { ...(current.arcaneRankCounts ?? {}) },
    arcaneUnknownRankCounts: { ...(current.arcaneUnknownRankCounts ?? {}) },
    customRivens: [...(current.customRivens ?? [])],
    alecaFrameUnresolvedRecords: [...(current.alecaFrameUnresolvedRecords ?? [])],
  };

  for (const record of snapshot.records) {
    const hasLocalQuantity = Object.prototype.hasOwnProperty.call(current.counts, record.catalogId);
    const hasConflict = hasLocalQuantity && (
      current.counts[record.catalogId] !== record.quantity ||
      (record.kind === "mod" && record.rankCounts !== undefined &&
        !rankMapsEqual(localRankCounts(record, current), record.rankCounts)) ||
      (record.kind === "mod" && (current.modUnknownRankCounts?.[record.path] ?? 0) !== (record.unknownRankCount ?? 0)) ||
      (record.kind === "arcane" && record.rankCounts !== undefined &&
        !rankMapsEqual(localRankCounts(record, current), record.rankCounts)) ||
      (record.kind === "arcane" && (current.arcaneUnknownRankCounts?.[record.path] ?? 0) !== (record.unknownRankCount ?? 0))
    );
    if (hasConflict && (mode === "keep-local" || keepLocalCatalogIds.has(record.catalogId))) continue;

    next.counts[record.catalogId] = record.quantity;
    if (record.kind === "mod") {
      next.modRankCounts![record.path] = { ...(record.rankCounts ?? {}) };
      if ((record.unknownRankCount ?? 0) > 0) next.modUnknownRankCounts![record.path] = record.unknownRankCount!;
      else delete next.modUnknownRankCounts![record.path];
      if (record.rankCountsComplete !== false) {
        const highest = maxRank(record.rankCounts ?? {});
        if (highest !== null) next.modRanks![record.path] = highest;
        else delete next.modRanks![record.path];
      }
    } else if (record.kind === "arcane") {
      next.arcaneRankCounts![record.path] = { ...(record.rankCounts ?? {}) };
      if ((record.unknownRankCount ?? 0) > 0) next.arcaneUnknownRankCounts![record.path] = record.unknownRankCount!;
      else delete next.arcaneUnknownRankCounts![record.path];
      if (record.rankCountsComplete !== false) {
        const highest = maxRank(record.rankCounts ?? {});
        if (highest !== null) next.arcaneRanks![record.path] = { [String(highest)]: 1 };
        else delete next.arcaneRanks![record.path];
      }
    }
  }

  const rivens = new Map((next.customRivens ?? []).map((record) => [record.id, record]));
  for (const incoming of snapshot.rivenRecords) {
    const existing = rivens.get(incoming.id);
    const hasConflict = !!existing && !sameRivenData(existing, incoming);
    if (existing && hasConflict && mode === "keep-local") continue;
    if (existing && hasConflict && keepLocalCatalogIds.has("riven-instance:" + incoming.id)) continue;
    if (existing && sameRivenData(existing, incoming)) continue;
    rivens.set(incoming.id, {
      ...incoming,
      createdAtIso: existing?.createdAtIso ?? incoming.createdAtIso,
      updatedAtIso: existing ? nowIso : incoming.updatedAtIso,
    });
  }
  next.customRivens = [...rivens.values()];
  next.alecaFrameUnresolvedRecords = snapshot.unresolvedRecords.map((record) => ({
    ...record,
    sourceSections: [...record.sourceSections],
    ...(record.rankCounts ? { rankCounts: { ...record.rankCounts } } : {}),
  }));
  return next;
}

