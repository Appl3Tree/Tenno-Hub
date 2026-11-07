import { useRef, useState } from "react";
import { FULL_CATALOG, type CatalogId } from "../domain/catalog/loadFullCatalog";
import { useTrackerStore } from "../store/store";
import {
  decryptAlecaFrameDat,
  parseAlecaFrameInventory,
  type AlecaFrameInventorySnapshot,
} from "../utils/alecaFrameImport";
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
  URL.revokeObjectURL(url);
}

function exactCatalogKind(path: string, section: string): "item" | "mod" | "arcane" | null {
  if (section === "RawUpgrades" || section === "Upgrades") {
    const entry = FULL_CATALOG.recordsById[`mods:${path}` as CatalogId];
    if (!entry) return null;
    const arcane = path.startsWith("/Lotus/Upgrades/CosmeticEnhancers/") ||
      entry.categories.some((name) => name.toLowerCase().includes("arcane"));
    return arcane ? "arcane" : "mod";
  }
  return FULL_CATALOG.recordsById[`items:${path}` as CatalogId] ? "item" : null;
}

/**
 * Snapshot import only. Other progression domains (quests, missions, loadouts,
 * etc.) must receive their own validated mappings before being imported.
 */
export default function AlecaFrameImport() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AlecaFrameInventorySnapshot | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const state = useTrackerStore((store) => store.state);
  const exportProgressPackJson = useTrackerStore((store) => store.exportProgressPackJson);
  const importProgressPackJson = useTrackerStore((store) => store.importProgressPackJson);

  async function readFile(file: File): Promise<void> {
    setPreview(null);
    setFileName(file.name);
    setMessage("");
    setBusy(true);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB.");
      const decrypted = await decryptAlecaFrameDat(await file.arrayBuffer());
      const result = parseAlecaFrameInventory(decrypted, exactCatalogKind);
      setPreview(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to read this AlecaFrame snapshot.");
    } finally {
      setBusy(false);
    }
  }

  function applyVerifiedImport(): void {
    if (!preview || !preview.importable || preview.records.length === 0) return;
    if (!window.confirm(
      "Apply the reviewed AlecaFrame snapshot to your local inventory?\n\n" +
      "Only items present in the snapshot will be updated. Existing entries not " +
      "present in the snapshot will remain unchanged. A backup will be downloaded first."
    )) return;

    // Do not write a partial or ambiguous snapshot. The progress-pack
    // import is one Zustand state update after all validation succeeds.
    const counts: Record<string, number> = {};
    const modRanks: Record<string, number> = {};
    const modRankCounts: Record<string, Record<string, number>> = {};
    const arcaneRanks: Record<string, Record<string, number>> = {};
    for (const record of preview.records) {
      counts[record.catalogId] = record.quantity;
      if (!record.rankCounts) continue;
      modRankCounts[record.path] = { ...record.rankCounts };
      const highestRank = Math.max(...Object.keys(record.rankCounts).map(Number));
      if (Number.isFinite(highestRank)) {
        if (exactCatalogKind(record.path, record.section) === "arcane") {
          arcaneRanks[record.path] = { [String(highestRank)]: record.rankCounts[String(highestRank)] };
        } else {
          modRanks[record.path] = highestRank;
        }
      }
    }

    const pack = {
      meta: { ...state.meta, updatedAtIso: new Date().toISOString() },
      player: preview.playerLevel === null ? undefined : { masteryRank: preview.playerLevel },
      inventory: {
        // Keep currency untouched until paid/free premium-currency semantics are audited.
        credits: state.inventory.credits,
        platinum: state.inventory.platinum,
        counts,
        modRanks,
        modRankCounts,
        arcaneRanks,
      },
    };
    downloadJson(`tenno-hub-before-alecaframe-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.parse(exportProgressPackJson()));
    const result = importProgressPackJson(JSON.stringify(pack));
    setMessage(result.ok
      ? "Imported verified inventory records. Entries absent from the snapshot were preserved."
      : (result.error ?? "Import failed; your previous state was preserved."));
  }

  return (
    <WorkspacePanel>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-lg font-semibold">AlecaFrame inventory snapshot</h2>
          <p className="text-sm text-slate-400 mt-1">
            Select <code>%LOCALAPPDATA%\AlecaFrame\lastData.dat</code> from Windows.
            The encrypted file is decrypted and analyzed in this browser; it is not uploaded.
          </p>
          <p className="text-xs text-amber-300 mt-2">
            This importer covers inventory items and mods, not quest completion,
            mission history, mastery XP, custom Riven statistics, or loadout configurations.
            Unknown catalog entries and unsupported mod fingerprints block application
            until the data is mapped accurately.
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".dat,application/octet-stream"
          className="block w-full max-w-lg text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-900"
          disabled={busy}
          aria-label="AlecaFrame lastData.dat snapshot"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
        {busy && <p className="text-sm text-slate-300">Decrypting and validating the selected file…</p>}
        {fileName && <p className="text-xs text-slate-400">Selected file: {fileName}</p>}
        {message && <p role="status" className="text-sm text-amber-300">{message}</p>}
        {preview && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-xs text-slate-400">Source entries examined</div>
                <div className="text-xl font-semibold">{preview.sourceRecords.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-xs text-slate-400">Recognized catalog IDs</div>
                <div className="text-xl font-semibold">{preview.records.length.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-xs text-slate-400">Issues requiring mapping</div>
                <div className="text-xl font-semibold">{preview.issues.length.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-xs text-slate-400">Player Mastery Rank</div>
                <div className="text-xl font-semibold">{preview.playerLevel ?? "Unknown"}</div>
              </div>
            </div>
            {preview.issues.length > 0 && (
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-200">
                  Import blocked: {preview.issues.length} unmatched or unsupported entries.
                </p>
                <p className="text-xs text-amber-300">
                  These records are not hidden or guessed. Resolve the catalog and parser
                  defects before importing to avoid an inaccurate inventory.
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-amber-600 px-3 py-2 text-sm text-amber-200"
                  onClick={() => downloadJson("alecaframe-import-audit.json", {
                    sourceRecords: preview.sourceRecords,
                    sections: preview.sections,
                    issues: preview.issues,
                  })}
                >
                  Download complete issue report
                </button>
                <details className="text-xs text-slate-300">
                  <summary className="cursor-pointer">Inspect first 100 issues</summary>
                  <ul className="mt-2 max-h-64 overflow-y-auto space-y-1 font-mono break-all">
                    {preview.issues.slice(0, 100).map((issue, index) => (
                      <li key={index}>{issue.section}[{issue.index}] {issue.path}: {issue.reason}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
            {preview.issues.length === 0 && (
              <p className="text-sm text-emerald-300">
                Every entry in the supported inventory sections resolves to a canonical ID.
                Entries absent from this file will not be marked unowned.
              </p>
            )}
            <button
              type="button"
              disabled={!preview.importable || !preview.records.length || busy}
              onClick={applyVerifiedImport}
              className="rounded-lg bg-slate-100 text-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Download backup and apply verified inventory
            </button>
          </div>
        )}
      </div>
    </WorkspacePanel>
  );
}
