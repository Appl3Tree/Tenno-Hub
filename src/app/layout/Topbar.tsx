// ===== FILE: src/app/layout/Topbar.tsx =====
//
// Slim top bar: shows MR · name · platform icon · expand chevron.
// Clicking the profile area drops down the full edit panel (replaces old always-visible card).
// The bar itself is always exactly h-12 (48px). The dropdown is absolutely positioned.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTrackerStore } from "../../store/store";
import {
    alertCompletionKey,
    eventCompletionKey,
    getCurrentWorldActivitySummary,
    getInvasionCompletionPercent,
    isWorldStateEntryActive,
} from "../../lib/worldStateCache";
import { useWorldStateNow, useWorldStateSnapshot } from "../../lib/useWorldStateData";
import CatalogSearchPalette from "../../components/search/CatalogSearchPalette";
import PageJumpPalette from "../../components/search/PageJumpPalette";

type PlatformKey = "pc" | "ps" | "xb" | "swi" | "mob" | "and";
const EMPTY_WORLD_STATE_IDS: string[] = [];

type PlatformOption = {
    key: PlatformKey;
    label: string;
    baseUrl: string;
};

const PLATFORM_OPTIONS: PlatformOption[] = [
    { key: "pc",  label: "PC",          baseUrl: "https://api.warframe.com/cdn/getProfileViewingData.php?playerId=" },
    { key: "ps",  label: "PlayStation", baseUrl: "https://api-ps4.warframe.com/cdn/getProfileViewingData.php?playerId=" },
    { key: "xb",  label: "Xbox",        baseUrl: "https://api-xb1.warframe.com/cdn/getProfileViewingData.php?playerId=" },
    { key: "swi", label: "Switch",      baseUrl: "https://api-swi.warframe.com/cdn/getProfileViewingData.php?playerId=" },
    { key: "mob", label: "Mobile",      baseUrl: "https://api-mob.warframe.com/cdn/getProfileViewingData.php?playerId=" },
    { key: "and", label: "Android",     baseUrl: "https://api-and.warframe.com/cdn/getProfileViewingData.php?playerId=" },
];

function clampInt(value: unknown, fallback: number): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
}

function formatInt(n: number | null): string {
    if (n === null) return "—";
    return Number(n).toLocaleString();
}

function normalizePlatformKey(raw: unknown): PlatformKey {
    const s = String(raw ?? "").trim().toLowerCase();
    if (s === "pc") return "pc";
    if (s === "ps" || s === "playstation" || s === "ps4" || s === "ps5") return "ps";
    if (s === "xb" || s === "xbox" || s === "xb1" || s === "xbsx") return "xb";
    if (s === "swi" || s === "switch") return "swi";
    if (s === "mob" || s === "mobile") return "mob";
    if (s === "and" || s === "android") return "and";
    return "pc";
}

function platformLabel(key: PlatformKey): "PC" | "PlayStation" | "Xbox" | "Switch" | "Mobile" | "Android" {
    const label = PLATFORM_OPTIONS.find((p) => p.key === key)?.label ?? "PC";
    if (label === "PlayStation") return "PlayStation";
    if (label === "Xbox") return "Xbox";
    if (label === "Switch") return "Switch";
    if (label === "Mobile") return "Mobile";
    if (label === "Android") return "Android";
    return "PC";
}


function PlatformIcon(props: { platform: PlatformKey; className?: string }) {
    const cls = props.className ?? "h-4 w-4";
    const common = { className: cls, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" };

    switch (props.platform) {
        case "pc":
            return (
                <svg {...common}>
                    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16h-11A2.5 2.5 0 0 1 4 13.5v-7Z" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9 20h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M12 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            );
        case "ps":
            return (
                <svg {...common}>
                    <path d="M7 17.5c0-3.5 0-8 5-8s5 4.5 5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M9 8.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M12 6v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M9 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            );
        case "xb":
            return (
                <svg {...common}>
                    <path d="M7.2 7.2c1.4-1.3 2.9-2.2 4.8-2.2s3.4.9 4.8 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M6 9.5c2.2 1.2 4 3.4 6 6 2-2.6 3.8-4.8 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
            );
        case "swi":
            return (
                <svg {...common}>
                    <path d="M7 5h3.5a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 10.5 19H7A2 2 0 0 1 5 17V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M13.5 5H17a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3.5A1.5 1.5 0 0 1 12 17.5v-11A1.5 1.5 0 0 1 13.5 5Z" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 9h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M16 15h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );
        case "mob":
        case "and":
            return (
                <svg {...common}>
                    <path d="M9 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M11 17h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            );
    }
}

// ── Inline-editable stat cell ────────────────────────────────────────────────

type ActiveField = "mr" | "credits" | "platinum" | "accountId" | null;

function InlineStat({
    label,
    display,
    draft,
    isEditing,
    onActivate,
    onChange,
    onCommit,
    onCancel,
    inputType = "number",
    placeholder,
}: {
    label: string;
    display: string;
    draft: string;
    isEditing: boolean;
    onActivate: () => void;
    onChange: (v: string) => void;
    onCommit: () => void;
    onCancel: () => void;
    inputType?: "number" | "text";
    placeholder?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    return (
        <div
            className={[
                "wf-inline-stat rounded-lg border px-2 py-2 transition-colors group",
                isEditing
                    ? "border-[color:var(--wf-accent-border)] bg-[color:var(--wf-surface-2)]"
                    : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] cursor-text hover:border-[color:var(--wf-border-strong)] hover:bg-[color:var(--wf-hover)]",
            ].join(" ")}
        >
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-[color:var(--wf-text-muted)]">{label}</span>
                {!isEditing && (
                    <span className="text-[10px] text-[color:var(--wf-text-dim)] opacity-0 group-hover:opacity-100 transition-opacity select-none">
                        ✎
                    </span>
                )}
            </div>
            {isEditing ? (
                <input
                    ref={inputRef}
                    type={inputType}
                    min={inputType === "number" ? 0 : undefined}
                    aria-label={label}
                    className="mt-0.5 w-full bg-transparent font-mono text-sm text-[color:var(--wf-text-strong)] focus:outline-none"
                    value={draft}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter")  { e.preventDefault(); onCommit(); }
                        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
                    }}
                    onBlur={onCommit}
                />
            ) : (
                <button
                    type="button"
                    onClick={onActivate}
                    aria-label={`Edit ${label}`}
                    title={`Edit ${label}`}
                    className="mt-0.5 block w-full truncate text-left font-mono text-sm text-[color:var(--wf-text-strong)] focus-visible:rounded-sm"
                >
                    {display}
                </button>
            )}
        </div>
    );
}

// ── Notification Bell ─────────────────────────────────────────────────────────

function msToHms(ms: number): string {
    if (ms <= 0) return "Expired";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${s % 60}s`;
}

const BELL_FACTION_COLORS: Record<string, string> = {
    Grineer:  "text-red-400",
    Corpus:   "text-sky-400",
    Infested: "text-green-400",
    Orokin:   "text-yellow-300",
    Tenno:    "text-cyan-300",
};

function NotificationBell({ onNavigateWorldState }: { onNavigateWorldState: () => void }) {
    const [open, setOpen]       = useState(false);
    const snapshot = useWorldStateSnapshot();
    const { data, isLoading, isRefreshing, error, fetchedAt } = snapshot;
    const loading = isLoading || isRefreshing;
    const bellRef = useRef<HTMLDivElement>(null);
    const bellButtonRef = useRef<HTMLButtonElement>(null);
    const now = useWorldStateNow();
    const toggleInvasionDone           = useTrackerStore((s) => s.toggleInvasionDone);
    const doneInvasions = useTrackerStore((s) => s.state.worldState?.doneInvasions ?? EMPTY_WORLD_STATE_IDS);
    const toggleNightwaveChallengeDone = useTrackerStore((s) => s.toggleNightwaveChallengeDone);
    const doneNightwaveChallenges = useTrackerStore((s) => s.state.worldState?.doneNightwaveChallenges ?? EMPTY_WORLD_STATE_IDS);
    const toggleEventInstanceDone = useTrackerStore((s) => s.toggleEventInstanceDone);
    const doneEventInstances = useTrackerStore((s) => s.state.worldState?.doneEventInstances ?? EMPTY_WORLD_STATE_IDS);
    const doneActivityInstances = useTrackerStore((s) => s.state.worldState?.doneWorldStateActivityInstances ?? EMPTY_WORLD_STATE_IDS);
    const setWorldStateActivityInstanceDone = useTrackerStore((s) => s.setWorldStateActivityInstanceDone);
    const hiddenWorldStateCategories = useTrackerStore((s) => s.state.ui.hiddenWorldStateCategories ?? EMPTY_WORLD_STATE_IDS);
    const activitySummary = getCurrentWorldActivitySummary(data, now);
    const currentEvents = activitySummary.events;
    const currentAlerts = activitySummary.alerts;
    const currentNightwave = activitySummary.nightwave;
    const currentInvasions = activitySummary.invasions;
    const isInvasionDone = (id: string) => doneInvasions.includes(id);
    const isNightwaveChallengeDone = (id: string) => doneNightwaveChallenges.includes(id);
    const isWorldStateCategoryHidden = (category: string) => hiddenWorldStateCategories.includes(category as any);
    const [baroInventoryOpen, setBaroInventoryOpen] = useState(false);
    const [varziaInventoryOpen, setVarziaInventoryOpen] = useState(false);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function onDown(e: MouseEvent) {
            if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setOpen(false);
            bellButtonRef.current?.focus();
        }
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    // The bell indicates actionable current content; personal completion clears
    // alerts, invasions, Nightwave acts, and event occurrences from the badge.
    const baroActive     = data?.voidTrader ? isWorldStateEntryActive(data.voidTrader, now) : false;
    const varziaActive   = data?.vaultTrader ? isWorldStateEntryActive(data.vaultTrader, now) : false;
    const sentientActive = data?.sentientOutposts ? isWorldStateEntryActive(data.sentientOutposts, now) : false;
    const pendingEvents = currentEvents.filter((ev) => {
        const key = eventCompletionKey(ev);
        return !key || !doneEventInstances.includes(key);
    }).length;
    const pendingAlerts = currentAlerts.filter((alert) => {
        const key = alertCompletionKey(alert);
        return !key || !doneActivityInstances.includes(key);
    }).length;
    const pendingInvasions = currentInvasions.filter((inv) => !doneInvasions.includes(inv.id)).length;
    const pendingNightwave = currentNightwave.filter((act) => !doneNightwaveChallenges.includes(act.id)).length;
    const showBadge = !!(
        (baroActive && !isWorldStateCategoryHidden("baro"))
        || (varziaActive && !isWorldStateCategoryHidden("varzia"))
        || (sentientActive && !isWorldStateCategoryHidden("sentient"))
        || (pendingAlerts && !isWorldStateCategoryHidden("alerts"))
        || (pendingEvents && !isWorldStateCategoryHidden("events"))
        || (pendingInvasions && !isWorldStateCategoryHidden("invasions"))
        || (pendingNightwave && !isWorldStateCategoryHidden("nightwave"))
    );

    // Items to show in dropdown
    const baroMs     = data?.voidTrader ? new Date(data.voidTrader.activation).getTime() - now : 0;
    const baroDue    = data?.voidTrader && !baroActive && baroMs > 0;
    const varziaStartMs = data?.vaultTrader ? new Date(data.vaultTrader.activation).getTime() - now : 0;
    const varziaDue  = data?.vaultTrader && !varziaActive && varziaStartMs > 0;
    const varziaMs   = data?.vaultTrader?.expiry ? new Date(data.vaultTrader.expiry).getTime() - now : 0;

    const hasAnything = !!(
        data?.voidTrader || data?.vaultTrader || sentientActive ||
        currentAlerts.length > 0 ||
        currentEvents.length > 0 ||
        currentInvasions.length > 0 ||
        currentNightwave.length > 0
    );

    return (
        <div className="relative" ref={bellRef}>
            <button
                ref={bellButtonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={[
                    "relative flex items-center justify-center w-9 h-9 rounded-lg border transition-colors",
                    open
                        ? "border-[color:var(--wf-border-strong)] bg-[color:var(--wf-selection)] text-[color:var(--wf-text-strong)]"
                        : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] hover:border-[color:var(--wf-border-strong)] hover:bg-[color:var(--wf-hover)] hover:text-[color:var(--wf-text-strong)]",
                ].join(" ")}
                title="Notifications"
                aria-label="World events"
                aria-expanded={open}
                aria-controls="world-events-popover"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {showBadge && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
                )}
            </button>

            {open && (
                <div id="world-events-popover" role="region" aria-label="World events" className="wf-popover absolute right-0 top-full z-50 mt-1 flex max-h-[85vh] w-80 flex-col overflow-hidden rounded-xl border">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 shrink-0">
                        <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-200">World Events</span>
                            {fetchedAt && <div className="mt-0.5 text-[9px] text-slate-500">Fetched {new Date(fetchedAt).toLocaleTimeString()}</div>}
                            {data?.alertsApiTimestamp && <div className="text-[9px] text-slate-500">Alerts API {new Date(data.alertsApiTimestamp).toLocaleString()}</div>}
                        </div>
                        {loading && (
                            <svg className="w-3 h-3 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" />
                            </svg>
                        )}
                    </div>

                    <div className="p-2 space-y-1 overflow-y-auto flex-1 min-h-0">
                        {error && <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-2.5 py-2 text-[10px] text-amber-200">Showing the last successful World State snapshot. Refresh failed.</div>}
                        {!data && !loading && (
                            <div className="px-2 py-3 text-xs text-slate-500 text-center">No data available.</div>
                        )}

                        {!!currentAlerts.length && !isWorldStateCategoryHidden("alerts") && (
                            <div className="rounded-lg px-3 py-2 bg-slate-900/60">
                                <div className="text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">Alerts ({pendingAlerts} pending)</div>
                                <div className="space-y-1.5">
                                    {currentAlerts.slice(0, 5).map((alert) => {
                                        const completionKey = alertCompletionKey(alert);
                                        const done = completionKey != null && doneActivityInstances.includes(completionKey);
                                        const label = alert.description || alert.missionType || "Alert";
                                        if (done) {
                                            return (
                                                <div key={alert.id} className="border-t border-slate-800/60 pt-1 first:border-0 first:pt-0 flex items-center gap-1.5">
                                                    <span className="text-green-500 text-xs shrink-0" aria-hidden="true">✓</span>
                                                    <span className="text-[10px] text-slate-500 truncate flex-1 line-through">{label} · {alert.node || "Unknown node"}</span>
                                                    {alert.expiry && <span className="shrink-0 font-mono text-[9px] text-slate-700">{msToHms(new Date(alert.expiry).getTime() - now)}</span>}
                                                    {completionKey && <button
                                                        type="button"
                                                        onClick={() => setWorldStateActivityInstanceDone(completionKey, false)}
                                                        aria-label={`Mark as not done: ${label}`}
                                                        title="Mark as not done"
                                                        className="shrink-0 text-[9px] text-slate-700 hover:text-slate-400 transition-colors"
                                                    >✕</button>}
                                                </div>
                                            );
                                        }
                                        return <div key={alert.id} className="border-t border-slate-800/60 pt-1 first:border-0 first:pt-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] text-slate-200 truncate">{label} · {alert.node || "Unknown node"}</span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {alert.expiry && <span className="font-mono text-[9px] text-slate-500">{msToHms(new Date(alert.expiry).getTime() - now)}</span>}
                                                    {completionKey && <button
                                                        type="button"
                                                        onClick={() => setWorldStateActivityInstanceDone(completionKey, true)}
                                                        aria-pressed={false}
                                                        aria-label={`Mark as done: ${label}`}
                                                        title="Mark as done"
                                                        className="rounded border border-transparent px-1 py-0.5 text-[9px] text-slate-600 transition-colors hover:border-emerald-700/60 hover:text-green-400"
                                                    >✓</button>}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-slate-500">{alert.faction}{alert.minEnemyLevel != null ? ` · ${alert.minEnemyLevel}–${alert.maxEnemyLevel ?? alert.minEnemyLevel}` : ""}{alert.reward ? ` · ${alert.reward}` : ""}</div>
                                        </div>;
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Baro Ki'Teer */}
                        {data?.voidTrader && !isWorldStateCategoryHidden("baro") && (
                            <div className={[
                                "rounded-lg px-3 py-2",
                                baroActive ? "bg-amber-950/30 border border-amber-800/40" : "bg-slate-900/60",
                            ].join(" ")}>
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className={["text-xs font-semibold", baroActive ? "text-amber-300" : "text-slate-300"].join(" ")}>
                                            {baroActive ? "● Baro Ki'Teer is HERE" : "Baro Ki'Teer"}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {data.voidTrader.location}
                                        </div>
                                        {baroActive && data.voidTrader.inventory.length > 0 && (
                                            <div className="text-[10px] text-amber-400/70 mt-0.5">
                                                {data.voidTrader.inventory.length} items available
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        {baroActive ? (
                                            <div className="text-[10px] text-slate-400">
                                                Leaves<br />
                                                <span className="font-mono text-amber-300/80">{msToHms(new Date(data.voidTrader.expiry).getTime() - now)}</span>
                                            </div>
                                        ) : baroDue ? (
                                            <div className="text-[10px] text-slate-400">
                                                Arrives<br />
                                                <span className="font-mono text-slate-300">{msToHms(baroMs)}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                {/* Baro inventory — collapsible */}
                                {baroActive && data.voidTrader.inventory.length > 0 && (
                                    <div className="mt-1.5 border-t border-amber-800/20 pt-1.5">
                                        <button
                                            onClick={() => setBaroInventoryOpen((v) => !v)}
                                            className="flex items-center gap-1 text-[10px] text-amber-400/80 hover:text-amber-300 transition-colors w-full"
                                        >
                                            <svg className={["w-2.5 h-2.5 transition-transform shrink-0", baroInventoryOpen ? "rotate-90" : ""].join(" ")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                            Inventory ({data.voidTrader.inventory.length} items
                                            {data.voidTrader.inventory.some((it) => it.ducats === 0) && (
                                                <span className="ml-1 rounded border border-green-600/60 bg-green-900/40 px-0.5 text-[8px] font-bold text-green-300">
                                                    FREE items
                                                </span>
                                            )}
                                            )
                                        </button>
                                        {baroInventoryOpen && (
                                            <div className="mt-1 space-y-0.5">
                                                {data.voidTrader.inventory.map((item, i) => {
                                                    const free = item.ducats === 0;
                                                    return (
                                                        <div key={i} className={["flex items-center justify-between gap-1 rounded px-1.5 py-0.5", free ? "bg-green-950/30" : ""].join(" ")}>
                                                            <span className={["text-[10px] min-w-0 truncate", free ? "text-green-200" : "text-slate-300"].join(" ")}>{item.item}</span>
                                                            <span className={["text-[10px] shrink-0 whitespace-nowrap", free ? "text-green-300 font-semibold" : "text-amber-300/70"].join(" ")}>
                                                                {free ? "FREE" : `${item.ducats}duc`} +{item.credits.toLocaleString()}cr
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Varzia */}
                        {data?.vaultTrader && !isWorldStateCategoryHidden("varzia") && (
                            <div className={[
                                "rounded-lg px-3 py-2",
                                varziaActive ? "bg-violet-950/30 border border-violet-800/40" : "bg-slate-900/60",
                            ].join(" ")}>
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className={["text-xs font-semibold", varziaActive ? "text-violet-300" : "text-slate-400"].join(" ")}>
                                            {varziaActive ? "● Varzia Active" : "Varzia"} — Primed Resurgence
                                        </div>
                                        {data.vaultTrader.location && (
                                            <div className="text-[10px] text-slate-500 mt-0.5">{data.vaultTrader.location}</div>
                                        )}
                                        {varziaActive && data.vaultTrader.inventory.length > 0 && (
                                            <div className="text-[10px] text-violet-400/70 mt-0.5">
                                                {data.vaultTrader.inventory.length} items available
                                            </div>
                                        )}
                                    </div>
                                    {(varziaMs > 0 || varziaDue) && (
                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] text-slate-400">
                                                {varziaActive ? "Ends" : "Returns"}<br />
                                                <span className="font-mono text-violet-300/80">{msToHms(varziaActive ? varziaMs : varziaStartMs)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Varzia inventory — collapsible */}
                                {varziaActive && data.vaultTrader.inventory.length > 0 && (
                                    <div className="mt-1.5 border-t border-violet-800/20 pt-1.5">
                                        <button
                                            onClick={() => setVarziaInventoryOpen((v) => !v)}
                                            className="flex items-center gap-1 text-[10px] text-violet-400/80 hover:text-violet-300 transition-colors w-full"
                                        >
                                            <svg className={["w-2.5 h-2.5 transition-transform shrink-0", varziaInventoryOpen ? "rotate-90" : ""].join(" ")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                            Inventory ({data.vaultTrader.inventory.length} items
                                            {data.vaultTrader.inventory.some((it) => (it.discount ?? 0) > 0) && (
                                                <span
                                                    className="ml-1 rounded border border-cyan-600/60 bg-cyan-900/40 px-0.5 text-[8px] font-bold text-cyan-300"
                                                    title="Some items currently have a discount in Varzia's shop"
                                                >
                                                    Discounts
                                                </span>
                                            )}
                                            )
                                        </button>
                                        {varziaInventoryOpen && (
                                            <div className="mt-1 space-y-0.5">
                                                {data.vaultTrader.inventory.map((item, i) => {
                                                    const discounted = (item.discount ?? 0) > 0;
                                                    return (
                                                        <div key={i} className={["flex items-center justify-between gap-1 rounded px-1.5 py-0.5", discounted ? "bg-cyan-950/20" : ""].join(" ")}>
                                                            <span className="text-[10px] min-w-0 truncate text-slate-300">{item.item}</span>
                                                            <span className="text-[10px] shrink-0 whitespace-nowrap text-violet-300/80">
                                                                {(item.ducats ?? 0) > 0 ? `${item.ducats ?? 0} Regal Aya` : ""}
                                                                {(item.ducats ?? 0) > 0 && (item.credits ?? 0) > 0 ? " +" : ""}
                                                                {(item.credits ?? 0) > 0 ? `${(item.credits ?? 0).toLocaleString()} Aya` : ""}
                                                                {discounted ? ` -${item.discount}%` : ""}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sentient Outpost */}
                        {sentientActive && !isWorldStateCategoryHidden("sentient") && (
                            <div className="rounded-lg px-3 py-2 bg-red-950/30 border border-red-800/40">
                                <div className="text-xs font-semibold text-red-300">● Sentient Outpost Active</div>
                                {data?.sentientOutposts?.missionType && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">{data.sentientOutposts.missionType}</div>
                                )}
                                {data?.sentientOutposts?.expiry && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        Ends <span className="font-mono text-slate-300">{msToHms(new Date(data.sentientOutposts.expiry).getTime() - now)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Invasions — show all with rewards */}
                        {data && currentInvasions.length > 0 && !isWorldStateCategoryHidden("invasions") && (() => {
                            const sorted = currentInvasions.slice().sort((a, b) => {
                                const completion = getInvasionCompletionPercent(b) - getInvasionCompletionPercent(a);
                                const aDone = isInvasionDone(a.id) ? 1 : 0;
                                const bDone = isInvasionDone(b.id) ? 1 : 0;
                                return completion || aDone - bDone;
                            });
                            return (
                                <div className="rounded-lg px-3 py-2 bg-slate-900/60">
                                    <div className="text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                                        Invasions ({sorted.length})
                                    </div>
                                    <div className="space-y-2">
                                        {sorted.map((inv) => {
                                            const done = isInvasionDone(inv.id);
                                            const runsCompleted = Math.abs(inv.count);
                                            const pct = inv.requiredRuns > 0 ? (runsCompleted / inv.requiredRuns * 100) : inv.completion;
                                            if (done) {
                                                return (
                                                    <div key={inv.id} className="border-t border-slate-800/60 pt-1.5 first:border-0 first:pt-0 flex items-center gap-1.5">
                                                        <span className="text-green-500 text-xs shrink-0">✓</span>
                                                        <span className="text-[10px] text-slate-500 truncate flex-1">{inv.displayLabel}</span>
                                                        <span className="text-[10px] font-mono text-slate-600 shrink-0">{pct.toFixed(1)}%</span>
                                                        {inv.requiredRuns > 0 && (
                                                            <span className="text-[10px] font-mono text-slate-700 shrink-0">
                                                                {runsCompleted.toLocaleString()}/{inv.requiredRuns.toLocaleString()}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => toggleInvasionDone(inv.id)}
                                                            className="shrink-0 text-[9px] text-slate-700 hover:text-slate-400 transition-colors"
                                                            title="Mark as not done"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={inv.id} className="border-t border-slate-800/60 pt-1.5 first:border-0 first:pt-0">
                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                        <span className="text-[11px] text-slate-200 font-medium min-w-0 truncate">{inv.displayLabel}</span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <span className="text-[10px] font-mono text-slate-500">{pct.toFixed(1)}%</span>
                                                            {inv.requiredRuns > 0 && (
                                                                <span className="text-[10px] font-mono text-slate-600">
                                                                    {runsCompleted.toLocaleString()}/{inv.requiredRuns.toLocaleString()}
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => toggleInvasionDone(inv.id)}
                                                                className="text-[9px] text-slate-600 hover:text-green-400 transition-colors px-0.5"
                                                                title="Mark as done"
                                                            >
                                                                ✓
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-1">
                                                        <div
                                                            className={["h-full rounded-full", inv.vsInfestation ? "bg-green-600/60" : "bg-red-600/60"].join(" ")}
                                                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-0.5 text-[10px]">
                                                        <div>
                                                            <div className={BELL_FACTION_COLORS[inv.attackingFaction] ?? "text-slate-400"}>
                                                                {inv.attackingFaction}
                                                            </div>
                                                            {inv.attackerReward?.asString && (
                                                                <div className="text-amber-300/70 leading-tight mt-0.5">{inv.attackerReward.asString}</div>
                                                            )}
                                                        </div>
                                                        <div className="text-slate-600 px-0.5">vs</div>
                                                        <div className="text-right">
                                                            <div className={BELL_FACTION_COLORS[inv.defendingFaction] ?? "text-slate-400"}>
                                                                {inv.defendingFaction}
                                                            </div>
                                                            {inv.defenderReward?.asString && (
                                                                <div className="text-amber-300/70 leading-tight mt-0.5">{inv.defenderReward.asString}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Nightwave active challenges */}
                        {data?.nightwave && currentNightwave.length > 0 && !isWorldStateCategoryHidden("nightwave") && (() => {
                            const sorted = currentNightwave
                                .slice()
                                .sort((a, b) => {
                                    const aDone = isNightwaveChallengeDone(a.id) ? 1 : 0;
                                    const bDone = isNightwaveChallengeDone(b.id) ? 1 : 0;
                                    if (aDone !== bDone) return aDone - bDone;
                                    if (a.isElite !== b.isElite) return a.isElite ? -1 : 1;
                                    if (a.isDaily !== b.isDaily) return a.isDaily ? 1 : -1;
                                    return b.reputation - a.reputation;
                                });
                            const doneCount = sorted.filter((a) => isNightwaveChallengeDone(a.id)).length;
                            return (
                            <div className="rounded-lg px-3 py-2 bg-slate-900/60">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                        Nightwave S{data.nightwave.season}
                                        {doneCount > 0 && <span className="normal-case font-normal text-green-500/70 ml-1">· {doneCount}/{sorted.length}</span>}
                                    </div>
                                    <div className="text-[9px] text-slate-500 font-mono">
                                        {msToHms(new Date(data.nightwave.expiry).getTime() - now)}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {sorted.map((act) => {
                                        const done = isNightwaveChallengeDone(act.id);
                                        const typeBadge = act.isElite
                                            ? <span className="shrink-0 rounded border border-amber-700/50 bg-amber-950/30 px-0.5 text-[8px] font-bold text-amber-300">ELITE</span>
                                            : act.isDaily
                                                ? <span className="shrink-0 rounded border border-sky-700/50 bg-sky-950/30 px-0.5 text-[8px] font-bold text-sky-300">DAILY</span>
                                                : <span className="shrink-0 rounded border border-slate-700 bg-slate-800/60 px-0.5 text-[8px] font-bold text-slate-400">WK</span>;
                                        if (done) {
                                            return (
                                                <div key={act.id} className="border-t border-slate-800/60 pt-1 first:border-0 first:pt-0 flex items-center gap-1.5">
                                                    <span className="text-green-500 text-xs shrink-0">✓</span>
                                                    {typeBadge}
                                                    <span className="text-[10px] text-slate-500 truncate flex-1 line-through">{act.title}</span>
                                                    <span className="text-[10px] text-slate-700 line-through shrink-0">{act.reputation.toLocaleString()}</span>
                                                    <button
                                                        onClick={() => toggleNightwaveChallengeDone(act.id)}
                                                        className="shrink-0 text-[9px] text-slate-700 hover:text-slate-400 transition-colors"
                                                        title="Mark as not done"
                                                    >✕</button>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={act.id} className="border-t border-slate-800/60 pt-1 first:border-0 first:pt-0">
                                                <div className="flex items-center justify-between gap-1">
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        {typeBadge}
                                                        <span className="text-[10px] text-slate-200 truncate">{act.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-[10px] font-bold text-blue-300">{act.reputation.toLocaleString()}</span>
                                                        <button
                                                            onClick={() => toggleNightwaveChallengeDone(act.id)}
                                                            className="text-[9px] text-slate-600 hover:text-green-400 transition-colors px-0.5"
                                                            title="Mark as done"
                                                        >✓</button>
                                                    </div>
                                                </div>
                                                <div className="text-[9px] text-slate-500 mt-0.5 leading-snug">{act.desc}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            );
                        })()}

                        {/* Active events */}
                        {data && currentEvents.length > 0 && !isWorldStateCategoryHidden("events") && (
                            <div className="rounded-lg px-3 py-2 bg-slate-900/60">
                                <div className="text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">
                                    Events ({currentEvents.length})
                                </div>
                                <div className="space-y-1">
                                    {currentEvents.map((ev) => {
                                        const completionKey = eventCompletionKey(ev);
                                        const done = completionKey != null && doneEventInstances.includes(completionKey);
                                        const label = ev.description || ev.tooltip || "Active Event";
                                        if (done) {
                                            return (
                                                <div key={ev.id} className="border-t border-slate-800/60 pt-1 first:border-0 first:pt-0 flex items-center gap-1.5">
                                                    <span className="text-green-500 text-xs shrink-0">✓</span>
                                                    <span className="text-[10px] text-slate-500 truncate flex-1 line-through">{label}</span>
                                                    {completionKey && <button
                                                        onClick={() => toggleEventInstanceDone(completionKey)}
                                                        className="shrink-0 text-[9px] text-slate-700 hover:text-slate-400 transition-colors"
                                                        title="Mark as not done"
                                                    >✕</button>}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={ev.id} className="border-t border-slate-800/60 pt-1 first:border-0 first:pt-0">
                                                <div className="flex items-start justify-between gap-1">
                                                    <span className="text-[11px] text-slate-300 leading-snug min-w-0">{label}</span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {ev.expiry && (
                                                            <span className="font-mono text-[10px] text-slate-500">
                                                                {msToHms(new Date(ev.expiry).getTime() - now)}
                                                            </span>
                                                        )}
                                                        {completionKey && <button
                                                            onClick={() => toggleEventInstanceDone(completionKey)}
                                                            className="text-[9px] text-slate-600 hover:text-green-400 transition-colors px-0.5"
                                                            title="Mark as done"
                                                        >✓</button>}
                                                    </div>
                                                </div>
                                                {ev.tooltip && ev.description && ev.tooltip !== ev.description && (
                                                    <div className="text-[9px] text-slate-500 mt-0.5 leading-snug">{ev.tooltip}</div>
                                                )}
                                                {ev.rewards && ev.rewards.length > 0 && (
                                                    <div className="text-[9px] text-amber-400/70 mt-0.5">{ev.rewards[0].asString}</div>
                                                )}
                                                {ev.health != null && (
                                                    <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-red-500/50 rounded-full" style={{ width: `${Math.min(100, Math.max(0, ev.health))}%` }} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* No alerts */}
                        {data && !hasAnything && (
                            <div className="px-2 py-3 text-xs text-slate-500 text-center">No active alerts.</div>
                        )}
                    </div>

                    {/* Footer: go to World State page */}
                    <div className="px-3 py-2 border-t border-slate-800 shrink-0">
                        <button
                            onClick={() => { setOpen(false); onNavigateWorldState(); }}
                            className="w-full text-center text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Open World State page →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export default function Topbar({ onMenuToggle, mobileNavOpen }: { onMenuToggle: () => void; mobileNavOpen: boolean }) {
    const activePage    = useTrackerStore((s) => s.state.ui.activePage);
    const masteryRank   = useTrackerStore((s) => s.state.player.masteryRank);
    const displayName   = useTrackerStore((s) => s.state.player.displayName);
    const clanName      = useTrackerStore((s) => s.state.player.clanName);
    const accountId     = useTrackerStore((s) => s.state.player.accountId ?? "");
    const platformRaw   = useTrackerStore((s) => s.state.player.platform);
    const platform      = normalizePlatformKey(platformRaw);
    const credits       = useTrackerStore((s) => s.state.inventory.credits);
    const platinum      = useTrackerStore((s) => s.state.inventory.platinum);

    const setActivePage                = useTrackerStore((s) => s.setActivePage);
    const setMasteryRank               = useTrackerStore((s) => s.setMasteryRank);
    const setCredits                   = useTrackerStore((s) => s.setCredits);
    const setPlatinum                  = useTrackerStore((s) => s.setPlatinum);
    const setAccountId                 = useTrackerStore((s) => s.setAccountId);
    const setPlatform                  = useTrackerStore((s) => s.setPlatform);
    const importProfileViewingDataJson = useTrackerStore((s) => s.importProfileViewingDataJson);
    const importProfileFromWarframeStatApi = useTrackerStore((s) => s.importProfileFromWarframeStatApi);

    const [open,         setOpen]         = useState(false);
    const [activeField,  setActiveField]  = useState<ActiveField>(null);
    const [mrDraft,      setMrDraft]      = useState("");
    const [creditsDraft, setCreditsDraft] = useState("");
    const [platDraft,    setPlatDraft]    = useState("");
    const [accountDraft, setAccountDraft] = useState("");
    const [profileStatus, setProfileStatus] = useState("");
    const [platformOpen,  setPlatformOpen]  = useState(false);
    const [showPastePanel, setShowPastePanel] = useState(false);
    const [pasteText, setPasteText] = useState("");
    const [apiImporting, setApiImporting] = useState(false);
    const [lastImportedAt, setLastImportedAt] = useState<string | null>(
        () => localStorage.getItem("wft_last_profile_import") ?? null
    );
    const [pendingImport, setPendingImport] = useState<{ label: string; execute: () => Promise<void> } | null>(null);
    const selectedPlatformOption = useMemo(
        () => PLATFORM_OPTIONS.find((opt) => opt.key === platform) ?? PLATFORM_OPTIONS[0],
        [platform]
    );
    const profileViewingDataUrl = useMemo(() => {
        const id = String(accountId ?? "").trim();
        if (!id) return "";
        return `${selectedPlatformOption.baseUrl}${encodeURIComponent(id)}`;
    }, [accountId, selectedPlatformOption]);

    const fileRef         = useRef<HTMLInputElement | null>(null);
    const panelRef        = useRef<HTMLDivElement | null>(null);
    const platformDropRef = useRef<HTMLDivElement | null>(null);
    const profileToggleRef = useRef<HTMLButtonElement | null>(null);

    // Close panel on outside click; commit any in-progress edit first
    useEffect(() => {
        if (!open) return;
        function onMouseDown(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                // Don't discard — just close; the field's onBlur will have already committed
                setOpen(false);
                setActiveField(null);
            }
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key !== "Escape") return;
            e.preventDefault();
            setOpen(false);
            setActiveField(null);
            setPlatformOpen(false);
            profileToggleRef.current?.focus();
        }
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    // Close platform dropdown on outside click
    useEffect(() => {
        if (!platformOpen) return;
        function onMouseDown(e: MouseEvent) {
            if (platformDropRef.current && !platformDropRef.current.contains(e.target as Node)) {
                setPlatformOpen(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [platformOpen]);

    // ── Per-field activate / commit / cancel ──

    function activate(field: ActiveField) {
        switch (field) {
            case "mr":        setMrDraft(masteryRank === null ? "" : String(masteryRank)); break;
            case "credits":   setCreditsDraft(String(credits ?? 0)); break;
            case "platinum":  setPlatDraft(String(platinum ?? 0)); break;
            case "accountId": setAccountDraft(String(accountId ?? "")); break;
        }
        setActiveField(field);
    }

    function commit(field: ActiveField) {
        if (activeField !== field) return; // stale blur, ignore
        switch (field) {
            case "mr":        setMasteryRank(mrDraft.trim() === "" ? null : clampInt(mrDraft, 0)); break;
            case "credits":   setCredits(clampInt(creditsDraft, 0)); break;
            case "platinum":  setPlatinum(clampInt(platDraft, 0)); break;
            case "accountId": setAccountId(accountDraft.trim()); break;
        }
        setActiveField(null);
    }

    function cancel() { setActiveField(null); }

    async function handleApiImport() {
        const id = String(accountId ?? "").trim();
        if (!id) { setProfileStatus("Set Account ID first."); return; }
        setApiImporting(true);
        setProfileStatus("Fetching profile from warframestat.us…");
        try {
            const url = `https://api.warframestat.us/profile/${encodeURIComponent(id)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API returned ${res.status} ${res.statusText}`);
            const json = await res.json();
            setProfileStatus("");
            setPendingImport({
                label: `API — warframestat.us (${id})`,
                execute: () => handleImportResult(importProfileFromWarframeStatApi(json)),
            });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            setProfileStatus(`API import failed: ${message}. Try Paste JSON or Import File instead.`);
        } finally {
            setApiImporting(false);
        }
    }

    async function handleImportResult(
        result: Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string }
    ) {
        const res = await result;
        if (!res.ok) {
            setProfileStatus(res.error ?? "Import failed.");
        } else {
            const ts = new Date().toLocaleString();
            localStorage.setItem("wft_last_profile_import", ts);
            setLastImportedAt(ts);
            setProfileStatus(`Profile imported at ${ts}`);
            setShowPastePanel(false);
            setPasteText("");
        }
    }

    function choosePlatform(next: PlatformKey) {
        setPlatformOpen(false);
        setPlatform(platformLabel(next));
        setProfileStatus("");
    }

    function handleOpenProfileViewingDataPage() {
        if (!profileViewingDataUrl) {
            setProfileStatus("Enter your Account ID above before opening the profile data page.");
            activate("accountId");
            return;
        }
        window.open(profileViewingDataUrl, "_blank", "noopener,noreferrer");
        setProfileStatus("");
    }

    return (
        <div className="relative z-50" ref={panelRef}>

            {/* ── Slim bar ── */}
            <div className="wf-topbar border-b backdrop-blur-sm">
                <div className="flex min-h-12 items-center gap-3 px-3 py-2 md:px-4">
                    <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[280px]">
                        <button
                            type="button"
                            onClick={onMenuToggle}
                            className="lg:hidden rounded-lg p-2 text-[color:var(--wf-text-muted)] transition-colors hover:bg-[color:var(--wf-hover)] hover:text-[color:var(--wf-text-strong)]"
                            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
                            aria-expanded={mobileNavOpen}
                            aria-controls="mobile-workspace-navigation"
                            aria-haspopup="dialog"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                            </svg>
                        </button>
                        <img src={`${import.meta.env.BASE_URL}favicon-rounded-512x512.png`} alt="Tenno Hub" className="h-6 w-6 shrink-0" />
                        <span className="truncate text-sm font-semibold text-slate-100 tracking-wide">Tenno Hub</span>
                        <div className="hidden lg:block">
                            <PageJumpPalette activePage={activePage} onSelectPage={(route) => setActivePage(route.key)} />
                        </div>
                    </div>

                    <div className="hidden min-w-0 flex-1 justify-center lg:flex">
                        <div className="w-full max-w-[760px]">
                            <CatalogSearchPalette />
                        </div>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
                        <NotificationBell onNavigateWorldState={() => setActivePage("world_state")} />

                        <button
                            ref={profileToggleRef}
                            type="button"
                            onClick={() => { setOpen((v) => !v); if (open) setActiveField(null); }}
                            className={[
                                "flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-1.5 transition-colors",
                                open
                                    ? "border-[color:var(--wf-accent-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-text-strong)]"
                                    : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text)] hover:border-[color:var(--wf-border-strong)] hover:bg-[color:var(--wf-hover)]",
                            ].join(" ")}
                            aria-expanded={open}
                            aria-controls="profile-popover"
                            aria-label={`Open profile settings${displayName ? ` for ${displayName}` : ""}`}
                        >
                            <PlatformIcon platform={platform} className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-mono">
                                MR <span className="text-slate-100 font-semibold">{masteryRank ?? "—"}</span>
                            </span>
                            <span className="hidden sm:inline text-slate-700">·</span>
                            <span className="hidden sm:inline text-xs font-mono">
                                <span className="text-yellow-400">₢</span>{" "}
                                <span className="text-slate-200">{Number(credits ?? 0).toLocaleString()}</span>
                            </span>
                            <span className="hidden md:inline text-slate-700">·</span>
                            <span className="hidden md:inline text-xs font-mono">
                                <span className="text-cyan-400">◈</span>{" "}
                                <span className="text-slate-200">{Number(platinum ?? 0).toLocaleString()}</span>
                            </span>
                            {displayName && (
                                <>
                                    <span className="hidden lg:inline text-slate-700">·</span>
                                    <span className="hidden xl:inline max-w-[140px] truncate text-xs text-slate-300">{displayName}</span>
                                </>
                            )}
                            <svg
                                className={["h-3.5 w-3.5 text-slate-500 transition-transform", open ? "rotate-180" : ""].join(" ")}
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="border-t border-slate-900/70 px-3 py-2 lg:hidden md:px-4">
                    <div className="flex items-center gap-2">
                        <PageJumpPalette activePage={activePage} onSelectPage={(route) => setActivePage(route.key)} />
                        <div className="min-w-0 flex-1">
                            <CatalogSearchPalette />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Dropdown panel ── */}
            {open && (
                <div id="profile-popover" role="region" aria-label="Profile settings" className="wf-popover absolute right-4 top-full z-50 mt-1 w-[480px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border">

                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <span className="text-sm font-semibold text-slate-200">Profile</span>
                        <span className="text-[11px] text-slate-500">Click any value to edit</span>
                    </div>

                    <div className="px-4 py-3 space-y-2">

                        {/* MR / Credits / Platinum */}
                        <div className="grid grid-cols-3 gap-2">
                            <InlineStat
                                label="MR"
                                display={formatInt(masteryRank)}
                                draft={mrDraft}
                                isEditing={activeField === "mr"}
                                onActivate={() => activate("mr")}
                                onChange={setMrDraft}
                                onCommit={() => commit("mr")}
                                onCancel={cancel}
                            />
                            <InlineStat
                                label="Credits"
                                display={Number(credits ?? 0).toLocaleString()}
                                draft={creditsDraft}
                                isEditing={activeField === "credits"}
                                onActivate={() => activate("credits")}
                                onChange={setCreditsDraft}
                                onCommit={() => commit("credits")}
                                onCancel={cancel}
                            />
                            <InlineStat
                                label="Platinum"
                                display={Number(platinum ?? 0).toLocaleString()}
                                draft={platDraft}
                                isEditing={activeField === "platinum"}
                                onActivate={() => activate("platinum")}
                                onChange={setPlatDraft}
                                onCommit={() => commit("platinum")}
                                onCancel={cancel}
                            />
                        </div>

                        {/* Name (read-only) / Account ID */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-2">
                                <div className="text-[11px] text-slate-400">Name</div>
                                <div className="mt-0.5 font-mono text-sm text-slate-100">{displayName || "—"}</div>
                                {clanName && (
                                    <div className="mt-1 text-[11px] text-slate-400 truncate" title={clanName}>
                                        <span className="text-slate-500">Clan: </span>{clanName}
                                    </div>
                                )}
                            </div>
                            <InlineStat
                                label="Account ID"
                                display={accountId || "—"}
                                draft={accountDraft}
                                isEditing={activeField === "accountId"}
                                onActivate={() => activate("accountId")}
                                onChange={setAccountDraft}
                                onCommit={() => commit("accountId")}
                                onCancel={cancel}
                                inputType="text"
                                placeholder="e.g., 51c925bd1a4d80502e000046"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                                className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs text-white font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                onClick={handleApiImport}
                                disabled={!String(accountId ?? "").trim() || apiImporting}
                                title={!String(accountId ?? "").trim() ? "Set Account ID first" : "Fetch and import profile automatically from warframestat.us"}
                            >
                                {apiImporting ? "Importing…" : "Import via API"}
                            </button>

                            <button
                                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-900"
                                onClick={() => setShowPastePanel(v => !v)}
                            >
                                {showPastePanel ? "Hide Paste" : "Paste JSON"}
                            </button>

                            <button
                                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-900"
                                onClick={() => fileRef.current?.click()}
                            >
                                Import File
                            </button>

                            {/* Platform selector */}
                            <div className="relative" ref={platformDropRef}>
                                <button
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 text-slate-200 hover:bg-slate-900"
                                    onClick={() => setPlatformOpen((v) => !v)}
                                    title={`Platform: ${platformLabel(platform)}`}
                                >
                                    <PlatformIcon platform={platform} className="h-4 w-4" />
                                </button>

                                {platformOpen && (
                                    <div className="wf-popover absolute right-0 z-50 mt-2 w-48 rounded-xl border shadow-lg">
                                        <div className="px-3 py-2 text-[11px] text-slate-400 border-b border-slate-800">
                                            Select Platform
                                        </div>
                                        <div className="p-1">
                                            {PLATFORM_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.key}
                                                    className={[
                                                        "w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
                                                        opt.key === platform
                                                            ? "bg-slate-100 text-slate-900"
                                                            : "text-slate-200 hover:bg-slate-900",
                                                    ].join(" ")}
                                                    onClick={() => choosePlatform(opt.key)}
                                                >
                                                    <PlatformIcon platform={opt.key} className="h-4 w-4" />
                                                    <span>{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <input
                                ref={fileRef}
                                type="file"
                                accept="application/json,.json,text/html,.htm,.html"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const raw = await file.text();
                                    setPendingImport({
                                        label: `File: ${file.name}`,
                                        execute: () => handleImportResult(importProfileViewingDataJson(raw)),
                                    });
                                    e.target.value = "";
                                }}
                            />
                        </div>

                        {/* Paste JSON panel */}
                        {showPastePanel && (
                            <div className="mt-2 space-y-2">
                                <div className="text-[11px] text-slate-400">
                                    Paste the full JSON content from the profile page below:
                                </div>
                                <textarea
                                    className="w-full h-28 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 font-mono text-[11px] resize-none focus:outline-none focus:border-slate-500 placeholder:text-slate-600"
                                    value={pasteText}
                                    onChange={e => setPasteText(e.target.value)}
                                    placeholder='Paste profile JSON here (starts with {"Results":[...]})'
                                />
                                <div className="flex gap-2">
                                    <button
                                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-900 font-semibold hover:bg-white disabled:opacity-50"
                                        disabled={!pasteText.trim()}
                                        onClick={() => setPendingImport({
                                            label: "Pasted JSON",
                                            execute: () => handleImportResult(importProfileViewingDataJson(pasteText)),
                                        })}
                                    >
                                        Import Pasted JSON
                                    </button>
                                    <button
                                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900"
                                        onClick={() => { setPasteText(""); setShowPastePanel(false); }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Confirmation step */}
                        {pendingImport && (
                            <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-3 space-y-2">
                                <div className="text-xs font-semibold text-amber-300">Confirm import?</div>
                                <div className="text-[11px] text-slate-400 leading-relaxed">
                                    Importing{" "}
                                    <span className="text-slate-200 font-mono break-all">{pendingImport.label}</span>
                                    {" "}will overwrite matching items in your current profile. This cannot be undone.
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white font-semibold hover:bg-amber-500 transition-colors"
                                        onClick={async () => {
                                            await pendingImport.execute();
                                            setPendingImport(null);
                                        }}
                                    >
                                        Confirm Import
                                    </button>
                                    <button
                                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900 transition-colors"
                                        onClick={() => setPendingImport(null)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status + last imported */}
                        <div className="space-y-0.5 pt-1">
                            {profileStatus && (
                                <div className="text-xs text-slate-300">{profileStatus}</div>
                            )}
                            {lastImportedAt && !profileStatus && (
                                <div className="text-[11px] text-slate-500">
                                    Last imported: <span className="text-slate-400">{lastImportedAt}</span>
                                </div>
                            )}
                        </div>

                        {/* How to find Account ID + import instructions */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 space-y-2 mt-1">
                            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                How to import your profile
                            </div>
                            <div className="space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
                                <div>
                                    <span className="text-slate-300 font-medium">1. </span>
                                    Enter your Account ID above, then click{" "}
                                    <span className="text-blue-300 font-medium">Import via API</span>
                                    {" "}— your progression will be fetched automatically from warframestat.us.
                                </div>
                                <div>
                                    <span className="text-slate-300 font-medium">Finding your Account ID: </span>
                                    Sign in at{" "}
                                    <a href="https://www.warframe.com/" target="_blank" rel="noreferrer" className="text-blue-300 underline underline-offset-2">
                                        warframe.com
                                    </a>
                                    , then open browser DevTools (F12 or Ctrl+Shift+I). In Chrome or Edge, go to{" "}
                                    <span className="text-slate-300">Application → Storage → Cookies → warframe.com</span>
                                    ; in Firefox, use <span className="text-slate-300">Storage → Cookies → warframe.com</span>.
                                    Copy the <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">Value</code>{" "}
                                    from the <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">gid</code> row.
                                    Its HttpOnly flag means Tenno Hub cannot read it automatically; DevTools can display it. Copy only{" "}
                                    <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">gid</code>, not the other cookies.
                                </div>
                                <div>
                                    <span className="text-slate-300 font-medium">PC alternative: </span>
                                    Open{" "}
                                    <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">
                                        %localappdata%\Warframe\EE.log
                                    </code>{" "}
                                    and search for <span className="font-mono text-slate-300">"Logged in"</span> — your account ID is in the parentheses next to it.
                                </div>
                                <div>
                                    <span className="text-slate-300 font-medium">Console / manual: </span>
                                    Use <span className="text-slate-300">Paste JSON</span> or{" "}
                                    <span className="text-slate-300">Import File</span> with data from the official profile data page.
                                </div>
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800"
                                        onClick={handleOpenProfileViewingDataPage}
                                        title={profileViewingDataUrl || "Enter your Account ID above first"}
                                    >
                                        Open profile data page in new tab
                                    </button>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-600 pt-0.5">
                                Account ID + Platform are stored locally only. As of update 38.0.8, IDs can no longer be looked up by username.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
