import { useMemo, useRef, useState } from "react";
import { FULL_CATALOG, type CatalogId } from "../domain/catalog/loadFullCatalog";
import { useTrackerStore } from "../store/store";
import {
  ALECAFRAME_MAX_FILE_BYTES,
  decryptAlecaFrameDat,
  parseAlecaFrameInventory,
  type AlecaFrameCatalogMatch,
  type AlecaFrameInventorySnapshot,
  type AlecaFrameRecord,
} from "../utils/alecaFrameImport";
import {
  buildAlecaFrameReview,
  reconcileAlecaFrameInventory,
  type AlecaFrameReconciliationMode,
} from "../utils/alecaFrameReconcile";
import { parseAlecaFrameRiven } from "../domain/rivenFingerprint";
import { formatRivenStatValue, getCustomRivenStatDef } from "../domain/rivens";
import { WorkspacePanel } from "./workspace/WorkspaceChrome";

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isUpgradeSection(section: string): boolean {
  return section === "RawUpgrades" || section === "Upgrades";
}

function exactCatalogMatch(path: string, section: string): AlecaFrameCatalogMatch | null {
  if (isUpgradeSection(section)) {
    const rivenId = "rivens:" + path;
    const riven = FULL_CATALOG.recordsById[rivenId as CatalogId];
    if (riven) return { catalogId: rivenId, kind: "riven" };

    const modId = "mods:" + path;
    const mod = FULL_CATALOG.recordsById[modId as CatalogId];
    if (!mod) return null;
    const raw = mod.raw && typeof mod.raw === "object" ? mod.raw as Record<string, unknown> : {};
    const type = String(raw.type ?? "").toLowerCase();
    const arcane = path.startsWith("/Lotus/Upgrades/CosmeticEnhancers/") ||
      type === "arcane" || type.includes("arcane") ||
      mod.categories.some((category) => category.toLowerCase().includes("arcane"));
    return { catalogId: modId, kind: arcane ? "arcane" : "mod" };
  }

  const itemId = "items:" + path;
  return FULL_CATALOG.recordsById[itemId as CatalogId]
    ? { catalogId: itemId, kind: "item" }
    : null;
}

function displayName(record: AlecaFrameRecord): string {
  return FULL_CATALOG.recordsById[record.catalogId as CatalogId]?.displayName ?? record.catalogId;
}

function sortedRanks(value: Record<string, number> | null | undefined): string {
  if (!value) return "Not recorded locally";
  const ranks = Object.entries(value)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => Number(left) - Number(right));
  return ranks.length === 0 ? "No copies" : ranks.map(([rank, count]) => "R" + rank + " × " + count).join(", ");
}

function rankLabel(record: AlecaFrameRecord): string {
  return record.rankCounts ? sortedRanks(record.rankCounts) : "Rank not applicable";
}

function groupRecords(records: AlecaFrameRecord[]): Array<[string, AlecaFrameRecord[]]> {
  const groups = new Map<string, AlecaFrameRecord[]>();
  for (const record of records) {
    for (const section of record.sourceSections) {
      const rows = groups.get(section) ?? [];
      rows.push(record);
      groups.set(section, rows);
    }
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function safeFilenameDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AlecaFrameImport() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AlecaFrameInventorySnapshot | null>(null);
  const [fileName, setFileName] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<AlecaFrameReconciliationMode>("merge");
  const [keepLocalIds, setKeepLocalIds] = useState<Set<string>>(new Set());
  const [unresolvedAcknowledged, setUnresolvedAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inventory = useTrackerStore((store) => store.state.inventory);
  const exportProgressPackJson = useTrackerStore((store) => store.exportProgressPackJson);
  const applyAlecaFrameInventory = useTrackerStore((store) => store.applyAlecaFrameInventory);

  const review = useMemo(
    () => preview ? buildAlecaFrameReview(preview, inventory) : null,
    [preview, inventory],
  );
  const categoryGroups = useMemo(
    () => groupRecords(preview?.records ?? []),
    [preview],
  );

  async function readFile(file: File): Promise<void> {
    setPreview(null);
    setFileName(file.name);
    setQuery("");
    setPage(0);
    setKeepLocalIds(new Set());
    setUnresolvedAcknowledged(false);
    setConfirmOpen(false);
    setMessage("");
    setBusy(true);
    if (file.size > ALECAFRAME_MAX_FILE_BYTES) {
      setMessage("This file is larger than 25 MB. Select a smaller AlecaFrame snapshot.");
      setBusy(false);
      return;
    }
    try {
      const decrypted = await decryptAlecaFrameDat(await file.arrayBuffer());
      const result = await parseAlecaFrameInventory(
        decrypted,
        exactCatalogMatch,
        async (entry, path, catalogId, index) => {
          const normalized = await parseAlecaFrameRiven(entry, path, catalogId, index);
          return { record: normalized.record, warnings: normalized.warnings };
        },
      );
      setPreview(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to analyze this AlecaFrame snapshot.");
    } finally {
      setBusy(false);
    }
  }

  const filteredRows = (review?.rows ?? []).filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return displayName(row.record).toLowerCase().includes(q) ||
      row.record.path.toLowerCase().includes(q) ||
      row.record.sourceSections.some((section) => section.toLowerCase().includes(q));
  });
  const filteredUnresolved = (preview?.unresolvedRecords ?? []).filter((record) => {
    const q = query.trim().toLowerCase();
    return !q || record.path.toLowerCase().includes(q) ||
      record.reason.toLowerCase().includes(q) ||
      record.sourceSections.some((section) => section.toLowerCase().includes(q));
  });
  const pageCount = Math.ceil(filteredRows.length / 40);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleRows = filteredRows.slice(currentPage * 40, currentPage * 40 + 40);

  const plannedChanges = useMemo(() => {
    if (!review) return 0;
    const newRecords = review.newCount + review.newRivenCount;
    const unresolvedReportChanges = review.unresolvedNewCount + review.unresolvedChangedCount + review.unresolvedRemovedCount;
    const changedRivens = review.rivenRows.filter((row) =>
      row.changed && !row.isNew && !keepLocalIds.has("riven-instance:" + row.record.id),
    ).length;
    if (mode === "keep-local") return newRecords + unresolvedReportChanges;
    if (mode === "overwrite") return newRecords + review.changedCount + review.changedRivenCount + unresolvedReportChanges;
    return newRecords + unresolvedReportChanges + review.rows.filter((row) =>
      row.changed && !row.isNew && !keepLocalIds.has(row.record.catalogId),
    ).length + changedRivens;
  }, [keepLocalIds, mode, review]);

  function setModeAndChoices(nextMode: AlecaFrameReconciliationMode): void {
    setMode(nextMode);
    if (nextMode !== "merge") {
      setKeepLocalIds(new Set());
      return;
    }
    setKeepLocalIds(new Set());
  }

  function toggleKeepLocal(catalogId: string, keep: boolean): void {
    setKeepLocalIds((current) => {
      const next = new Set(current);
      if (keep) next.add(catalogId);
      else next.delete(catalogId);
      return next;
    });
  }

  function openImportConfirmation(): void {
    if (!preview || !preview.importable || !plannedChanges || preview.issues.length > 0) return;
    if (preview.unresolvedRecords.length > 0 && !unresolvedAcknowledged) return;
    setConfirmOpen(true);
  }

  function applyImport(): void {
    if (!preview || !preview.importable || !plannedChanges) return;
    if (preview.issues.length > 0) return;
    if (preview.unresolvedRecords.length > 0 && !unresolvedAcknowledged) return;
    if (!confirmOpen) return;

    let backupPayload: unknown;
    try {
      backupPayload = JSON.parse(exportProgressPackJson());
    } catch {
      setMessage("The current Progress Pack backup could not be prepared. No inventory changes were applied.");
      setConfirmOpen(false);
      return;
    }
    const reconciled = reconcileAlecaFrameInventory(
      inventory,
      preview,
      mode,
      keepLocalIds,
      new Date().toISOString(),
    );
    try {
      downloadJson("tenno-hub-before-alecaframe-" + safeFilenameDate() + ".json", backupPayload);
    } catch {
      setMessage("The Progress Pack backup could not be downloaded. No inventory changes were applied.");
      setConfirmOpen(false);
      return;
    }
    const result = applyAlecaFrameInventory(reconciled);
    setConfirmOpen(false);
    setMessage(result.ok
      ? "Imported " + plannedChanges.toLocaleString() + " reviewed records. Local-only records and unrelated progress were preserved."
      : (result.error ?? "Import failed. Use the downloaded Progress Pack backup if recovery is needed."));
  }

  function downloadAudit(): void {
    if (!preview) return;
    downloadJson("alecaframe-inventory-audit-" + safeFilenameDate() + ".json", {
      format: "Tenno Hub AlecaFrame inventory audit",
      rootFieldCount: preview.rootFieldCount,
      totalArrayRecords: preview.totalArrayRecords,
      sourceRecords: preview.sourceRecords,
      distinctItems: preview.distinctItems,
      totalCopies: preview.totalCopies,
      rootFields: preview.rootFields,
      coverageComplete: preview.coverageComplete,
      sections: preview.sections,
      excludedSections: preview.excludedSections,
      matches: preview.records.map((record) => ({
        catalogId: record.catalogId,
        kind: record.kind,
        sourceSections: record.sourceSections,
        quantity: record.quantity,
        ranks: record.rankCounts ?? null,
        unknownRankCount: record.unknownRankCount ?? 0,
        rankCountsComplete: record.rankCountsComplete ?? true,
      })),
      unresolvedRecords: preview.unresolvedRecords,
      issues: preview.issues,
      warnings: preview.warnings,
      rivenSummary: {
        personalizedInstances: preview.rivenRecords.length,
        usableForModBuilder: preview.rivenRecords.filter((record) =>
          !record.importStatus || record.importStatus === "ready",
        ).length,
        incomplete: preview.rivenRecords.filter((record) =>
          !!record.importStatus && record.importStatus !== "ready",
        ).length,
      },
    });
  }

  const excludedRecordCount = preview
    ? Object.values(preview.excludedSections).reduce((sum, section) => sum + section.sourceRecords, 0)
    : 0;
  const unresolvedCopies = preview
    ? preview.unresolvedRecords.reduce((sum, record) => sum + record.quantity, 0)
    : 0;
  const missingCoverageSections = preview
    ? Object.entries(preview.sections).filter(([, section]) => section.status === "missing").map(([name]) => name)
    : [];
  const partialCoverageSections = preview
    ? Object.entries(preview.sections).filter(([, section]) => section.status === "partial").map(([name]) => name)
    : [];
  const invalidCoverageSections = preview
    ? Object.entries(preview.sections).filter(([, section]) => section.status === "unclassified").map(([name]) => name)
    : [];

  return (
    <WorkspacePanel>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-[color:var(--wf-text-strong)]">AlecaFrame inventory import</h2>
          <p className="text-sm text-[color:var(--wf-text-muted)]">
            Select <code>%LOCALAPPDATA%\AlecaFrame\lastData.dat</code>. The file is decrypted and analyzed in this browser only.
            Select a newer file whenever you want to refresh your inventory; Tenno Hub cannot monitor that folder.
          </p>
          <label className="block max-w-xl text-sm text-[color:var(--wf-text-muted)]">
            AlecaFrame snapshot file
            <input
              ref={fileInput}
              type="file"
              accept=".dat,application/octet-stream"
              disabled={busy}
              aria-label="Select AlecaFrame lastData.dat"
              className="mt-2 block w-full rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-2 text-[color:var(--wf-text-strong)] file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--wf-accent)] file:px-3 file:py-2 file:font-medium file:text-[color:var(--wf-accent-contrast)]"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void readFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {fileName ? <p className="text-xs text-[color:var(--wf-text-dim)]">Selected: {fileName}</p> : null}
          {busy ? <p role="status" className="text-sm text-[color:var(--wf-text-muted)]">Decrypting and validating locally…</p> : null}
          {message ? <p role="status" className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-3 py-2 text-sm text-[color:var(--wf-text-strong)]">{message}</p> : null}
          {!preview && inventory.alecaFrameUnresolvedRecords?.length ? (
            <details className="max-w-4xl rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
              <summary className="cursor-pointer text-sm font-medium text-[color:var(--wf-text-strong)]">
                Previous import: {inventory.alecaFrameUnresolvedRecords.length.toLocaleString()} unresolved identities
              </summary>
              <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto text-xs text-[color:var(--wf-text-muted)]">
                {inventory.alecaFrameUnresolvedRecords.map((record) => (
                  <li key={record.kind + ":" + record.path} className="break-all">
                    <span className="font-medium">{record.path}</span>
                    {" · " + record.quantity.toLocaleString() + " copies · " + record.sourceSections.join(", ")}
                    {" · " + record.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        {preview ? (
          <div className="space-y-4">
            <section aria-label="Import coverage summary" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Array records analyzed", preview.sourceRecords.toLocaleString(), "Every top-level array entry, including classified non-inventory state"],
                ["Distinct matched catalog IDs", preview.distinctItems.toLocaleString(), "Exact canonical paths represented in the catalog"],
                ["Total copies", preview.totalCopies.toLocaleString(), "Matched and unresolved stack quantities plus individual instances"],
                ["Personalized Riven instances", preview.rivenRecords.length.toLocaleString(), "Unique Riven records; incomplete fields remain marked unknown"],
                ["Unresolved identities", preview.unresolvedRecords.length.toLocaleString(), unresolvedCopies.toLocaleString() + " copies kept in the unresolved report"],
                ["Validation issues", preview.issues.length.toLocaleString(), "Structural or unclassified data that blocks import"],
                ["New ownership", ((review?.newCount ?? 0) + (review?.newRivenCount ?? 0)).toLocaleString(), "Canonical items and unique Rivens absent locally"],
                ["Changed records", ((review?.changedCount ?? 0) + (review?.changedRivenCount ?? 0)).toLocaleString(), "Quantity, rank distribution, or same Riven instance differs"],
                ["Preserved local records", ((review?.localOnlyCount ?? 0) + (review?.localOnlyRivenCount ?? 0)).toLocaleString(), (review?.localOnlyCopies ?? 0).toLocaleString() + " copies and " + (review?.localOnlyRivenCount ?? 0).toLocaleString() + " Rivens absent from this snapshot"],
                ["Excluded source records", excludedRecordCount.toLocaleString(), "History, in-progress jobs, inbox attachments, and configurations"],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
                  <div className="text-xs text-[color:var(--wf-text-dim)]">{label}</div>
                  <div className="mt-1 text-xl font-semibold text-[color:var(--wf-text-strong)]">{value}</div>
                  <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">{hint}</div>
                </div>
              ))}
            </section>

            <div className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3 text-sm text-[color:var(--wf-text-muted)]">
              {preview.coverageComplete
                ? "All supported inventory sections are present and their records match the catalog."
                : missingCoverageSections.length > 0
                  ? "Supported sections absent from this file: " + missingCoverageSections.join(", ") + ". Missing sections are unknown, never zero ownership."
                  : invalidCoverageSections.length > 0
                    ? "Source sections with an invalid or unclassified shape: " + invalidCoverageSections.join(", ") + ". Import is blocked until the source structure is understood."
                    : "All supported sections are present, but " + partialCoverageSections.length.toLocaleString() + " contain identities, ranks, or records that need review. Their source data is preserved in the report."}
              {preview.playerLevel !== null
                ? " Mastery Rank " + preview.playerLevel + " was detected and is not changed by this inventory import."
                : ""}
              {" Credits and Platinum are detected separately and are not changed by this inventory import."}
            </div>

            {preview.unresolvedRecords.length > 0 ? (
              <section className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
                <h3 className="font-semibold text-[color:var(--wf-text-strong)]">
                  Unresolved catalog identities ({preview.unresolvedRecords.length})
                </h3>
                <p className="mt-1 text-xs text-[color:var(--wf-text-muted)]">
                  These exact source paths have no verified catalog match. Their quantities and rank data stay in a local report; they are never added to canonical inventory counts.
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-[color:var(--wf-text-strong)]">
                    Review {filteredUnresolved.length.toLocaleString()} unresolved identities
                  </summary>
                  <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto text-xs text-[color:var(--wf-text-muted)]">
                    {filteredUnresolved.slice(0, 200).map((record) => (
                      <li key={record.kind + ":" + record.path} className="break-all rounded border border-[color:var(--wf-border-subtle)] p-2">
                        <div className="font-medium text-[color:var(--wf-text-strong)]">{record.path}</div>
                        <div>{record.kind} · {record.quantity.toLocaleString()} copies · {record.sourceSections.join(", ")}</div>
                        {record.rankCounts
                          ? <div>Ranks: {sortedRanks(record.rankCounts)}</div>
                          : record.kind === "upgrade" ? <div>Rank distribution is incomplete in the source.</div> : null}
                        <div>{record.reason}</div>
                      </li>
                    ))}
                  </ul>
                  {filteredUnresolved.length > 200 ? (
                    <p className="mt-2 text-xs text-[color:var(--wf-text-muted)]">
                      Showing 200 filtered rows. Download the inventory audit for the full unresolved list.
                    </p>
                  ) : null}
                </details>
                <label className="mt-3 flex items-start gap-2 text-sm text-[color:var(--wf-text-strong)]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={unresolvedAcknowledged}
                    onChange={(event) => setUnresolvedAcknowledged(event.currentTarget.checked)}
                  />
                  <span>
                    Keep these {preview.unresolvedRecords.length.toLocaleString()} unresolved identities in the local report and import only exact catalog matches.
                  </span>
                </label>
              </section>
            ) : null}

            {review && review.rivenRows.length > 0 ? (
              <details className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
                <summary className="cursor-pointer font-medium text-[color:var(--wf-text-strong)]">
                  Personalized Rivens ({review.rivenRows.length}) · {review.newRivenCount} new · {review.changedRivenCount} changed
                </summary>
                <ul className="mt-3 divide-y divide-[color:var(--wf-border-subtle)]">
                  {review.rivenRows.map(({ record: riven, localRecord, changed, isNew }) => {
                    const keepKey = "riven-instance:" + riven.id;
                    const stats = riven.stats.map((stat) => {
                      const definition = getCustomRivenStatDef(stat.stat);
                      return definition ? formatRivenStatValue(definition, stat.value) : stat.stat;
                    });
                    return (
                    <li key={riven.id} className="py-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[color:var(--wf-text-strong)]">{riven.name}</span>
                            <span className="text-xs text-[color:var(--wf-text-muted)]">{riven.sourceWeaponName || "Weapon compatibility unknown"}</span>
                            <span className="text-xs text-[color:var(--wf-text-muted)]">
                              Snapshot rank {riven.sourceRank === null || riven.sourceRank === undefined ? "not recorded" : riven.sourceRank}
                            </span>
                            {riven.rerolls !== null && riven.rerolls !== undefined
                              ? <span className="text-xs text-[color:var(--wf-text-muted)]">{riven.rerolls} rerolls</span>
                              : null}
                            {riven.importStatus && riven.importStatus !== "ready"
                              ? <span className="rounded bg-[color:var(--wf-surface-2)] px-2 py-0.5 text-xs text-[color:var(--wf-text-muted)]">{riven.importStatus.replaceAll("-", " ")}</span>
                              : null}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">
                            Local: {localRecord ? `${localRecord.name}, rank ${localRecord.sourceRank ?? "unknown"}` : "no matching Riven"}
                            {" · Snapshot: " + riven.name + ", rank " + (riven.sourceRank ?? "unknown")}
                          </div>
                          {stats.length > 0
                            ? <div className="mt-2 text-xs text-[color:var(--wf-text-muted)]">Calculated max-rank stats: {stats.join(" · ")}</div>
                            : <div className="mt-2 text-xs text-[color:var(--wf-text-muted)]">The unique Riven is retained; stats are unavailable until its rank, weapon compatibility, and attributes can be verified.</div>}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-[color:var(--wf-text-muted)]">
                          <span>{isNew ? "New" : changed ? "Changed" : "Matches local"}</span>
                          {changed && !isNew && mode === "merge" ? (
                            <label className="flex items-center gap-1 text-[color:var(--wf-text-strong)]">
                              <input
                                type="checkbox"
                                checked={keepLocalIds.has(keepKey)}
                                onChange={(event) => toggleKeepLocal(keepKey, event.currentTarget.checked)}
                              />
                              Keep local Riven
                            </label>
                          ) : null}
                          {changed && !isNew && mode === "keep-local" ? <span>Keeping local Riven</span> : null}
                        </div>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}

            <section className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
              <h3 className="font-semibold text-[color:var(--wf-text-strong)]">Reconciliation</h3>
              <p className="mt-1 text-xs text-[color:var(--wf-text-muted)]">
                Snapshot quantities replace values for the same canonical IDs; this is never added on top of local quantities.
                IDs absent from the file remain local. No mastery, goals, builds, or other progression is changed.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="Inventory reconciliation mode">
                {([
                  ["merge", "Merge snapshot", "Use the snapshot values for matched IDs and keep unrelated local records."],
                  ["overwrite", "Overwrite verified values", "Apply every reviewed value present in the file; missing IDs remain local."],
                  ["keep-local", "Keep local conflicts", "Add new records but retain existing values where they differ."],
                ] as const).map(([value, label, hint]) => (
                  <label key={value} className="flex cursor-pointer gap-2 rounded-lg border border-[color:var(--wf-border-subtle)] p-3">
                    <input
                      type="radio"
                      name="alecaframe-reconciliation"
                      value={value}
                      checked={mode === value}
                      onChange={() => setModeAndChoices(value)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-[color:var(--wf-text-strong)]">{label}</span>
                      <span className="mt-1 block text-xs text-[color:var(--wf-text-muted)]">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <details open className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)]">
              <summary className="cursor-pointer px-3 py-3 font-medium text-[color:var(--wf-text-strong)]">
                Review inventory values
              </summary>
              <div className="space-y-3 border-t border-[color:var(--wf-border-subtle)] p-3">
                <label className="block text-xs text-[color:var(--wf-text-muted)]">
                  Search item name, exact path, or source section
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setPage(0); }}
                    className="mt-1 w-full rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-3 py-2 text-sm text-[color:var(--wf-text-strong)]"
                    placeholder="Filter the reviewed inventory"
                  />
                </label>
                <p className="text-xs text-[color:var(--wf-text-muted)]">
                  {filteredRows.length.toLocaleString()} matched rows · 40 per page · rank distributions are individual copy counts.
                </p>
                <div className="divide-y divide-[color:var(--wf-border-subtle)]">
                  {visibleRows.map((row) => (
                    <div key={row.record.catalogId} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-[color:var(--wf-text-strong)]">{displayName(row.record)}</div>
                        <div className="break-all text-xs text-[color:var(--wf-text-dim)]">{row.record.path}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">{row.record.sourceSections.join(", ")}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-1 text-xs text-[color:var(--wf-text-muted)] lg:justify-end">
                        <span>Local: {row.localQuantity.toLocaleString()}</span>
                        <span>Snapshot: {row.record.quantity.toLocaleString()}</span>
                        {(row.record.kind === "mod" || row.record.kind === "arcane")
                          ? <span>
                              {row.record.rankCountsComplete === false
                                ? "Known ranks: " + sortedRanks(row.record.rankCounts) +
                                  " · Unknown rank × " + (row.record.unknownRankCount ?? 0)
                                : "Ranks: " + sortedRanks(row.record.rankCounts)}
                            </span>
                          : null}
                        {row.record.rankCounts
                          ? <span>Local ranks: {sortedRanks(row.localRankCounts)}</span>
                          : null}
                        {row.changed && !row.isNew && mode === "merge" ? (
                          <label className="flex items-center gap-1 text-[color:var(--wf-text-strong)]">
                            <input
                              type="checkbox"
                              checked={keepLocalIds.has(row.record.catalogId)}
                              onChange={(event) => toggleKeepLocal(row.record.catalogId, event.currentTarget.checked)}
                            />
                            Keep local value
                          </label>
                        ) : null}
                        {row.changed && !row.isNew && mode === "keep-local"
                          ? <span>Keeping local value</span>
                          : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}
                    className="rounded-lg border border-[color:var(--wf-border-subtle)] px-3 py-2 text-sm text-[color:var(--wf-text-strong)] disabled:opacity-40">
                    Previous
                  </button>
                  <span className="text-xs text-[color:var(--wf-text-muted)]">Page {pageCount ? currentPage + 1 : 0} of {pageCount}</span>
                  <button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                    className="rounded-lg border border-[color:var(--wf-border-subtle)] px-3 py-2 text-sm text-[color:var(--wf-text-strong)] disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
              <summary className="cursor-pointer font-medium text-[color:var(--wf-text-strong)]">
                Source section accounting ({Object.keys(preview.sections).length} sections)
              </summary>
              <div className="mt-3 space-y-2">
                {Object.entries(preview.sections).sort(([left], [right]) => left.localeCompare(right)).map(([section, summary]) => {
                  const sectionRecords = categoryGroups.find(([name]) => name === section)?.[1] ?? [];
                  const reviewById = new Map((review?.rows ?? []).map((row) => [row.record.catalogId, row]));
                  return (
                    <details key={section} className="rounded border border-[color:var(--wf-border-subtle)] p-2 text-xs">
                      <summary className="cursor-pointer font-medium text-[color:var(--wf-text-strong)]">
                        {section}: {summary.sourceRecords} source · {summary.importedRecords} matched ({summary.importedCopies} copies) · {summary.rankUnknownRecords} rank unknown ({summary.rankUnknownCopies} copies) · {summary.unresolvedRecords} unresolved ({summary.unresolvedCopies} copies) · {summary.skippedRecords} skipped · {summary.failedRecords} failed · {summary.excludedRecords} excluded · {summary.status}
                      </summary>
                      {summary.reason
                        ? <div className="mt-1 text-[color:var(--wf-text-muted)]">{summary.reason}</div>
                        : null}
                      {sectionRecords.length > 0 ? (
                        <ul className="mt-2 divide-y divide-[color:var(--wf-border-subtle)]">
                          {sectionRecords.slice(0, 50).map((record) => {
                            const row = reviewById.get(record.catalogId);
                            return (
                              <li key={record.catalogId} className="py-2 text-[color:var(--wf-text-muted)]">
                                <span className="font-medium text-[color:var(--wf-text-strong)]">{displayName(record)}</span>
                                {" · Local " + (row?.localQuantity ?? 0)}
                                {" → Snapshot " + record.quantity}
                        {(record.kind === "mod" || record.kind === "arcane")
                          ? " · " + (record.rankCountsComplete === false
                            ? "Known ranks " + sortedRanks(record.rankCounts) + " · unknown rank × " + (record.unknownRankCount ?? 0)
                            : rankLabel(record))
                          : ""}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {preview.unresolvedRecords.filter((record) => record.sourceSections.includes(section)).slice(0, 50).map((record) => (
                        <div key={record.kind + ":" + record.path} className="mt-2 break-all text-[color:var(--wf-text-muted)]">
                          Unresolved {record.kind}: {record.path} · {record.quantity} copies
                        </div>
                      ))}
                      {sectionRecords.length > 50
                        ? <div className="mt-2 text-[color:var(--wf-text-muted)]">Showing 50 here; use the searchable review above for every matched record.</div>
                        : null}
                    </details>
                  );
                })}
              </div>
            </details>

            {preview.issues.length > 0 ? (
              <section className="rounded-lg border border-[color:var(--wf-danger)]/50 bg-[color:var(--wf-surface-1)] p-3">
                <h3 className="font-semibold text-[color:var(--wf-danger)]">
                  Import blocked: {preview.issues.length.toLocaleString()} validation issues
                </h3>
                <p className="mt-1 text-xs text-[color:var(--wf-text-muted)]">
                  These records have invalid structure or come from a source section whose meaning has not been verified. Fixing this snapshot is required before any inventory changes can be applied.
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-[color:var(--wf-text-strong)]">Inspect issues</summary>
                  <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto text-xs">
                    {preview.issues.slice(0, 200).map((issue, index) => (
                      <li key={sectionKey(issue.section, issue.index, index)} className="break-all text-[color:var(--wf-text-muted)]">
                        <span className="font-medium">{issue.section}{issue.index >= 0 ? "[" + issue.index + "]" : ""}</span>
                        {issue.path ? " · " + issue.path : ""}
                        {" · " + issue.reason}
                      </li>
                    ))}
                  </ul>
                  {preview.issues.length > 200 ? (
                    <p className="mt-2 text-xs text-[color:var(--wf-text-muted)]">
                      Showing the first 200 issues. Download the audit for the complete list.
                    </p>
                  ) : null}
                </details>
              </section>
            ) : null}

            {preview.warnings.length > 0 ? (
              <details className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
                <summary className="cursor-pointer text-sm font-medium text-[color:var(--wf-text-strong)]">
                  Non-blocking source warnings ({preview.warnings.length})
                </summary>
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs text-[color:var(--wf-text-muted)]">
                  {preview.warnings.map((warning, index) => (
                    <li key={sectionKey(warning.section, warning.index, index)} className="break-all">
                      {warning.section}{warning.index >= 0 ? "[" + warning.index + "]" : ""}: {warning.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-[color:var(--wf-border-subtle)] pt-3">
              <button type="button" onClick={downloadAudit}
                className="rounded-lg border border-[color:var(--wf-border-subtle)] px-3 py-2 text-sm text-[color:var(--wf-text-strong)]">
                Download inventory audit
              </button>
              <button type="button" onClick={openImportConfirmation}
                disabled={!preview.importable || !!preview.issues.length || !plannedChanges || busy ||
                  (preview.unresolvedRecords.length > 0 && !unresolvedAcknowledged)}
                className="rounded-lg bg-[color:var(--wf-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--wf-accent-contrast)] disabled:opacity-40">
                Review {plannedChanges.toLocaleString()} planned changes
              </button>
            </div>
            {confirmOpen ? (
              <section role="dialog" aria-labelledby="alecaframe-confirm-title" className="rounded-lg border border-[color:var(--wf-accent)] bg-[color:var(--wf-surface-1)] p-4">
                <h3 id="alecaframe-confirm-title" className="font-semibold text-[color:var(--wf-text-strong)]">Confirm AlecaFrame import</h3>
                <p className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                  Apply {plannedChanges.toLocaleString()} reviewed changes using “{mode}”. A Progress Pack backup will download first. Existing local-only inventory, mastery, goals, saved builds, and unrelated progress remain unchanged.
                  {preview.unresolvedRecords.length > 0
                    ? " " + preview.unresolvedRecords.length.toLocaleString() + " unresolved identities will be saved in the local report and excluded from canonical counts."
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setConfirmOpen(false)}
                    className="rounded-lg border border-[color:var(--wf-border-subtle)] px-3 py-2 text-sm text-[color:var(--wf-text-strong)]">
                    Cancel
                  </button>
                  <button type="button" onClick={applyImport}
                    className="rounded-lg bg-[color:var(--wf-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--wf-accent-contrast)]">
                    Download backup and import
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </WorkspacePanel>
  );
}

function sectionKey(section: string, index: number, order: number): string {
  return section + ":" + index + ":" + order;
}

