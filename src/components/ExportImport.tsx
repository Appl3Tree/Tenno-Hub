// ===== FILE: src/components/ExportImport.tsx =====
import { useEffect, useRef, useState } from "react";
import { useTrackerStore } from "../store/store";
import { ProgressPackSchemaV2 } from "../store/progressPack";
import {
    isConfigured,
    isConnected,
    connect,
    disconnect,
    saveToGoogleDrive,
    restoreFromGoogleDrive,
    getDriveBackupFileName,
    getLastSyncTime,
    getLastSyncLink,
    wasConnected,
} from "../lib/googleDrive";
import { WorkspacePanel } from "./workspace/WorkspaceChrome";

function downloadText(filename: string, text: string, mimeType = "application/json;charset=utf-8"): void {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)  return "just now";
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m} minute${m === 1 ? "" : "s"} ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h} hour${h === 1 ? "" : "s"} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d === 1 ? "" : "s"} ago`;
}

// ── Google Drive section ──────────────────────────────────────────────────────

function GoogleDriveSection({ exportJson }: { exportJson: () => string }) {
    const importProgressPackJson = useTrackerStore((s) => s.importProgressPackJson);

    const configured = isConfigured();
    const [connected, setConnected]     = useState(isConnected);
    const [driveStatus, setDriveStatus] = useState<{ msg: string; ok: boolean } | null>(null);
    const [busy, setBusy]               = useState(false);
    const [lastSync, setLastSync]       = useState<string | null>(getLastSyncTime);
    const [lastSyncLink, setLastSyncLink] = useState<string | null>(getLastSyncLink);
    // True when the user previously connected but the in-memory token has expired
    // (happens on every page reload — GIS token model is ephemeral by design).
    const previouslyConnected = !connected && wasConnected();

    // Refresh connected state whenever window regains focus (e.g. after OAuth popup)
    useEffect(() => {
        const onFocus = () => setConnected(isConnected());
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    async function handleConnect() {
        setBusy(true);
        setDriveStatus(null);
        try {
            await connect();
            setConnected(true);
            setDriveStatus({ msg: "Connected to Google Drive.", ok: true });
        } catch (e: any) {
            setDriveStatus({ msg: e.message ?? "Connection failed.", ok: false });
        } finally {
            setBusy(false);
        }
    }

    async function handleSave() {
        setBusy(true);
        setDriveStatus(null);
        try {
            const json = exportJson();
            const result = await saveToGoogleDrive(json);
            setLastSync(result.modifiedTime);
            setLastSyncLink(result.webViewLink ?? null);
            setDriveStatus({ msg: `Saved to Google Drive as ${getDriveBackupFileName()}.`, ok: true });
        } catch (e: any) {
            setDriveStatus({ msg: e.message ?? "Save failed.", ok: false });
        } finally {
            setBusy(false);
        }
    }

    async function handleRestore() {
        if (!confirm("Restore from Google Drive?\n\nThis will overwrite your current local progress. Continue?")) return;
        setBusy(true);
        setDriveStatus(null);
        try {
            const json = await restoreFromGoogleDrive();
            const res  = importProgressPackJson(json);
            setDriveStatus({
                msg: res.ok ? "Progress restored from Google Drive." : (res.error ?? "Restore failed."),
                ok: res.ok,
            });
        } catch (e: any) {
            setDriveStatus({ msg: e.message ?? "Restore failed.", ok: false });
        } finally {
            setBusy(false);
        }
    }

    async function handleDisconnect() {
        if (!confirm("Disconnect from Google Drive?\n\nThis only removes the connection in this browser. Your backup file in Drive is not deleted.")) return;
        await disconnect();
        setConnected(false);
        setLastSync(null);
        setLastSyncLink(null);
        setDriveStatus(null);
    }

    return (
        <WorkspacePanel className="space-y-4 p-4">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2">
                    {/* Google Drive color icon */}
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a15.92 15.92 0 0 0 2.1 8z" fill="#0066da"/>
                        <path d="M43.65 25L29.9 1.2A15.35 15.35 0 0 0 26.6 4.5L3.1 45.5A15.8 15.8 0 0 0 1 53h27.55z" fill="#00ac47"/>
                        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25A15.8 15.8 0 0 0 88.3 50H60.7L73.55 76.8z" fill="#ea4335"/>
                        <path d="M43.65 25L57.4 1.2C56.05.45 54.5 0 52.85 0H34.45c-1.65 0-3.2.45-4.55 1.2z" fill="#00832d"/>
                        <path d="M60.7 53H27.55L13.8 76.8c1.35.75 2.9 1.2 4.55 1.2h50.6c1.65 0 3.2-.45 4.55-1.2z" fill="#2684fc"/>
                        <path d="M73.4 26.5l-23.5-40.65A15.35 15.35 0 0 0 46.55 25H88.3a15.8 15.8 0 0 0-2.1-7.5L73.4 26.5z" fill="#ffba00"/>
                    </svg>
                    <div className="text-lg font-semibold">Google Drive Backup</div>
                    {connected && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-700/50 px-2 py-0.5 text-xs text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                            Connected
                        </span>
                    )}
                </div>

                {/* Plain-language explanation */}
                <div className="mt-2 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-400 space-y-1.5">
                    <p>
                        <span className="text-slate-200 font-medium">What this does: </span>
                        Your progress is normally stored only in <span className="text-slate-300">this browser</span>.
                        If you clear your browser data, it's gone. Google Drive Backup saves a copy of your progress
                        to a file in <span className="text-slate-300">your own Google Drive</span> so you can
                        restore it anytime — or pick it up on another device.
                    </p>
                    <p>
                        <span className="text-slate-200 font-medium">Privacy: </span>
                        The app only gets permission to access the single file it creates
                        (<span className="font-mono text-slate-300 text-xs">wf-tracker-progress.json</span>).
                        It cannot read, modify, or see anything else in your Drive.
                    </p>
                    <p className="text-xs text-slate-500">
                        Saves are <span className="text-slate-400">manual</span> — your Drive file only updates when you click
                        "Save to Drive". Nothing is sent automatically.
                        The Drive connection lasts for the current browser session only; you'll need to reconnect after a page reload.
                    </p>
                </div>
            </div>

            {/* Not configured — show setup instructions */}
            {!configured && (
                <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-sm text-amber-300 space-y-2">
                    <div className="font-semibold text-amber-200">Setup required</div>
                    <p className="text-amber-400/90">
                        To enable Google Drive, a <code className="font-mono text-xs bg-amber-950/40 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> must
                        be set in the app's environment. See <code className="font-mono text-xs bg-amber-950/40 px-1 rounded">.env.example</code> in
                        the repository for step-by-step instructions.
                    </p>
                </div>
            )}

            {/* Configured — show connect/action buttons */}
            {configured && (
                <div className="space-y-3">
                    {!connected ? (
                        <div className="space-y-3">
                            {/* Previously connected — show reconnect prompt */}
                            {previouslyConnected && (
                                <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-300 flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        <span className="font-semibold text-amber-200">Session expired.</span>{" "}
                                        Google Drive connections aren't saved between page loads — click to reconnect.
                                    </span>
                                    <button
                                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-950/50 transition-colors disabled:opacity-50"
                                        onClick={handleConnect}
                                        disabled={busy}
                                    >
                                        {busy ? "Connecting…" : "Reconnect"}
                                    </button>
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    className="inline-flex items-center gap-2 rounded-lg border border-blue-700/60 bg-blue-950/30 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-950/50 transition-colors disabled:opacity-50"
                                    onClick={handleConnect}
                                    disabled={busy}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
                                    {busy ? "Connecting…" : "Connect Google Drive"}
                                </button>
                                <span className="text-xs text-slate-500">
                                    A Google sign-in window will open.
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/60 bg-emerald-950/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
                                    onClick={handleSave}
                                    disabled={busy}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                                    {busy ? "Saving…" : "Save to Drive"}
                                </button>
                                <button
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/30 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 transition-colors disabled:opacity-50"
                                    onClick={handleRestore}
                                    disabled={busy}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 16 12 12 16 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                                    {busy ? "Restoring…" : "Restore from Drive"}
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                {lastSync && (
                                    <span>
                                        Last saved: <span className="text-slate-400">{formatRelativeTime(lastSync)}</span>
                                        <span className="text-slate-600 ml-1">({new Date(lastSync).toLocaleString()})</span>
                                    </span>
                                )}
                                {lastSyncLink && (
                                    <a
                                        href={lastSyncLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        Open in Drive
                                    </a>
                                )}
                                <button
                                    className="text-slate-600 hover:text-rose-400 transition-colors"
                                    onClick={handleDisconnect}
                                    disabled={busy}
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Status message */}
            {driveStatus && (
                <p className={["text-sm font-medium", driveStatus.ok ? "text-emerald-400" : "text-rose-400"].join(" ")}>
                    {driveStatus.ok ? "✓" : "✗"} {driveStatus.msg}
                </p>
            )}
        </WorkspacePanel>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExportImport() {
    const exportProgressPackJson = useTrackerStore((s) => s.exportProgressPackJson);
    const importProgressPackJson = useTrackerStore((s) => s.importProgressPackJson);
    const restoreProgressPackJson = useTrackerStore((s) => s.restoreProgressPackJson);

    const [text, setText] = useState("");
    const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
    const [pendingRestore, setPendingRestore] = useState<string | null>(null);
    const fileModeRef = useRef<"merge" | "replace">("merge");
    const fileRef = useRef<HTMLInputElement | null>(null);
    const replaceButtonRef = useRef<HTMLButtonElement | null>(null);
    const replaceCancelRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (pendingRestore) replaceCancelRef.current?.focus();
    }, [pendingRestore]);

    function openFilePicker(mode: "merge" | "replace") {
        fileModeRef.current = mode;
        fileRef.current?.click();
    }

    function handleImportText() {
        if (!text.trim()) { setStatus({ msg: "Nothing to import — paste your progress pack first.", ok: false }); return; }
        const res = importProgressPackJson(text);
        setStatus({ msg: res.ok ? "Progress Pack merged successfully." : (res.error ?? "Merge failed."), ok: res.ok });
    }

    function handleImportFile(raw: string, mode: "merge" | "replace") {
        if (mode === "replace") {
            let parsed: unknown;
            try {
                parsed = JSON.parse(raw);
            } catch {
                setStatus({ msg: "Invalid JSON.", ok: false });
                return;
            }
            const validated = ProgressPackSchemaV2.safeParse(parsed);
            if (!validated.success) {
                setStatus({ msg: "Invalid Progress Pack (schema v2 required).", ok: false });
                return;
            }
            setPendingRestore(raw);
            setStatus(null);
            return;
        }

        const res = importProgressPackJson(raw);
        setStatus({ msg: res.ok ? "Progress Pack merged successfully." : (res.error ?? "Merge failed."), ok: res.ok });
    }

    function confirmReplaceFromFile() {
        if (!pendingRestore) return;
        const res = restoreProgressPackJson(pendingRestore);
        setStatus({
            msg: res.ok ? "Backup restored. Current local progress was replaced." : (res.error ?? "Restore failed."),
            ok: res.ok,
        });
        setPendingRestore(null);
    }

    return (
        <div className="space-y-4">
            {/* Progress Pack */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-lg font-semibold">Progress Pack</div>
                <div className="text-sm text-slate-400 mt-1">
                    Export your entire local progress to JSON so you can back it up or move it to another device.
                    Merge another pack with this browser, or replace local progress from a backup file.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        className="rounded-lg bg-slate-100 px-4 py-2 text-slate-900 text-sm font-semibold hover:bg-white transition-colors"
                        onClick={() => {
                            const json = exportProgressPackJson();
                            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
                            downloadText(`wf-progress-pack-${stamp}.json`, json);
                        }}
                    >
                        Download Backup
                    </button>
                    <button
                        className="rounded-lg border border-slate-700 px-4 py-2 text-slate-100 text-sm hover:bg-slate-900 transition-colors"
                        onClick={() => setText(exportProgressPackJson())}
                    >
                        Copy to Text Area
                    </button>
                    <button
                        className="rounded-lg border border-slate-700 px-4 py-2 text-slate-100 text-sm hover:bg-slate-900 transition-colors"
                        onClick={() => openFilePicker("merge")}
                    >
                        Merge from File
                    </button>
                    <button
                        ref={replaceButtonRef}
                        className="rounded-lg border border-amber-700/70 bg-amber-950/20 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-950/40 transition-colors"
                        onClick={() => openFilePicker("replace")}
                    >
                        Replace from Backup File
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="application/json,.json"
                        aria-label="Select Progress Pack file"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const mode = fileModeRef.current;
                            fileModeRef.current = "merge";
                            handleImportFile(await file.text(), mode);
                            e.target.value = "";
                        }}
                    />
                </div>

                {pendingRestore ? (
                    <div role="alertdialog" aria-modal="true" aria-labelledby="progress-pack-replace-title"
                        aria-describedby="progress-pack-replace-description"
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                setPendingRestore(null);
                                replaceButtonRef.current?.focus();
                                return;
                            }
                            if (event.key === "Tab") {
                                const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
                                const first = buttons[0];
                                const last = buttons[buttons.length - 1];
                                if (event.shiftKey && document.activeElement === first) {
                                    event.preventDefault();
                                    last?.focus();
                                } else if (!event.shiftKey && document.activeElement === last) {
                                    event.preventDefault();
                                    first?.focus();
                                }
                            }
                        }}
                        className="mt-4 rounded-xl border border-amber-700/70 bg-amber-950/20 p-4">
                        <h3 id="progress-pack-replace-title" className="font-semibold text-amber-100">
                            Replace current local progress?
                        </h3>
                        <p id="progress-pack-replace-description" className="mt-1 text-sm text-amber-200/80">
                            This backup replaces Progress Pack data in this browser, including inventory and saved progress.
                            Download a backup first if you need to keep the current state.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button ref={replaceCancelRef} type="button" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
                                onClick={() => {
                                    setPendingRestore(null);
                                    replaceButtonRef.current?.focus();
                                }}>
                                Cancel
                            </button>
                            <button type="button" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950"
                                onClick={() => {
                                    confirmReplaceFromFile();
                                    replaceButtonRef.current?.focus();
                                }}>
                                Replace local progress
                            </button>
                        </div>
                    </div>
                ) : null}

                <textarea
                    className="mt-4 w-full min-h-[180px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 font-mono text-xs resize-y focus:outline-none focus:border-slate-500"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste a Progress Pack here to merge, or use 'Copy to Text Area' to export…"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        className="rounded-lg border border-slate-700 px-4 py-2 text-slate-100 text-sm hover:bg-slate-900 transition-colors"
                        onClick={handleImportText}
                    >
                        Merge from Text
                    </button>
                    {text && (
                        <button
                            className="rounded-lg border border-slate-700 px-4 py-2 text-slate-400 text-sm hover:bg-slate-900 transition-colors"
                            onClick={() => { setText(""); setStatus(null); }}
                        >
                            Clear
                        </button>
                    )}
                    {status && (
                        <span role="status" aria-live="polite" className={["text-sm font-medium", status.ok ? "text-green-400" : "text-rose-400"].join(" ")}>
                            {status.ok ? "✓" : "✗"} {status.msg}
                        </span>
                    )}
                </div>
            </div>

            {/* Google Drive */}
            <GoogleDriveSection exportJson={exportProgressPackJson} />

            {/* Help */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400 space-y-2">
                <div className="font-semibold text-slate-200 text-base">How to back up & restore</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                    <li>Click <span className="text-slate-200 font-medium">Download Backup</span> to save a JSON file to your computer.</li>
                    <li>To combine a file with current progress, click <span className="text-slate-200 font-medium">Merge from File</span>. To restore a backup exactly, click <span className="text-slate-200 font-medium">Replace from Backup File</span> and confirm the replacement.</li>
                    <li>Alternatively, use <span className="text-slate-200 font-medium">Copy to Text Area</span> to get the JSON, paste it elsewhere, then use <span className="text-slate-200 font-medium">Merge from Text</span> to combine it with current progress.</li>
                    <li>For seamless cross-device sync, connect <span className="text-slate-200 font-medium">Google Drive Backup</span> above and click <span className="text-slate-200 font-medium">Save to Drive</span> after sessions you want to preserve.</li>
                </ol>
                <p className="text-xs text-slate-500 pt-1">
                    Your progress is stored in your browser's local storage. Clearing browser data will erase it — keep a backup file or use Google Drive Backup.
                </p>
            </div>
        </div>
    );
}
