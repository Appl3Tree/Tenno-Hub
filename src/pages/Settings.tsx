// src/pages/Settings.tsx
import { useId, useState } from "react";
import { useTrackerStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { WorkspacePanel, WorkspaceSegmented, WorkspaceSegmentedButton } from "../components/workspace/WorkspaceChrome";
import {
    getCompactRows,
    getStoredTimezone,
    setCompactRows,
    setStoredTimezone,
    setAppTheme,
    useAppTheme,
    type AppTheme,
} from "../lib/settingsPreferences";

// Common timezone options
const TIMEZONE_OPTIONS = [
    { value: "UTC",                    label: "UTC" },
    { value: "America/New_York",       label: "Eastern (ET)" },
    { value: "America/Chicago",        label: "Central (CT)" },
    { value: "America/Denver",         label: "Mountain (MT)" },
    { value: "America/Los_Angeles",    label: "Pacific (PT)" },
    { value: "America/Anchorage",      label: "Alaska (AKT)" },
    { value: "Pacific/Honolulu",       label: "Hawaii (HT)" },
    { value: "Europe/London",          label: "London (GMT/BST)" },
    { value: "Europe/Paris",           label: "Central Europe (CET)" },
    { value: "Europe/Helsinki",        label: "Eastern Europe (EET)" },
    { value: "Europe/Moscow",          label: "Moscow (MSK)" },
    { value: "Asia/Dubai",             label: "Dubai (GST)" },
    { value: "Asia/Kolkata",           label: "India (IST)" },
    { value: "Asia/Bangkok",           label: "SE Asia (ICT)" },
    { value: "Asia/Shanghai",          label: "China (CST)" },
    { value: "Asia/Tokyo",             label: "Japan (JST)" },
    { value: "Asia/Seoul",             label: "Korea (KST)" },
    { value: "Australia/Sydney",       label: "Sydney (AEST)" },
    { value: "Pacific/Auckland",       label: "New Zealand (NZST)" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsSection(props: { title: string; description?: string; children: React.ReactNode }) {
    const titleId = useId();
    return (
        <section aria-labelledby={titleId} className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] p-4">
            <h2 id={titleId} className="text-sm font-semibold text-[color:var(--wf-text-strong)]">{props.title}</h2>
            {props.description && (
                <div className="mt-1 text-sm text-[color:var(--wf-text-muted)]">{props.description}</div>
            )}
            <div className="mt-3">{props.children}</div>
        </section>
    );
}

function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
                <input type="checkbox" className="peer sr-only" checked={props.checked} onChange={e => props.onChange(e.target.checked)} />
                <div className={[
                    "w-9 h-5 rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--wf-focus-ring)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[color:var(--wf-surface-1)]",
                    props.checked ? "border-transparent bg-[color:var(--wf-accent-primary)]" : "border-[color:var(--wf-border-strong)] bg-[color:var(--wf-surface-2)]",
                ].join(" ")} />
                <div className={["absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", props.checked ? "translate-x-4" : "translate-x-0"].join(" ")} />
            </div>
            <div>
                <div className="text-sm text-[color:var(--wf-text)] group-hover:text-[color:var(--wf-text-strong)] transition-colors">{props.label}</div>
                {props.description && <div className="text-xs text-[color:var(--wf-text-muted)] mt-0.5">{props.description}</div>}
            </div>
        </label>
    );
}

// ── Compact row preview ───────────────────────────────────────────────────────

function CompactPreview({ compact }: { compact: boolean }) {
    const rows = ["Nano Spores", "Ferrite", "Rubedo"];
    return (
        <div className="mt-3 rounded-lg border border-slate-700 overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-800/60 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                Preview — {compact ? "Compact" : "Normal"}
            </div>
            {rows.map((name, i) => (
                <div
                    key={name}
                    className={[
                        "flex items-center justify-between border-t border-slate-800/60 px-3",
                        compact ? "py-1" : "py-2.5",
                        i % 2 === 0 ? "bg-slate-950/20" : ""
                    ].join(" ")}
                >
                    <span className={compact ? "text-xs text-slate-300" : "text-sm text-slate-200"}>{name}</span>
                    <span className={compact ? "text-[10px] text-slate-500 font-mono" : "text-xs text-slate-400 font-mono"}>
                        {(i + 1) * 1200} / {(i + 1) * 2000}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

const WORLD_STATE_CATEGORIES: Array<{ key: string; label: string; description: string }> = [
    { key: "baro",      label: "Baro Ki'Teer",     description: "Void Trader visits and inventory" },
    { key: "varzia",    label: "Varzia",            description: "Primed Resurgence vault trader" },
    { key: "sentient",  label: "Sentient Outpost",  description: "Roaming sentient outpost alerts" },
    { key: "invasions", label: "Invasions",         description: "Active invasion missions" },
    { key: "nightwave", label: "Nightwave",         description: "Season challenges and rep rewards" },
    { key: "events",    label: "Events",            description: "Timed in-game events" },
];

export default function Settings() {
    const resetToDefaults  = useTrackerStore((s) => s.resetToDefaults);
    const resetAllLocalData = useTrackerStore((s) => s.resetAllLocalData);
    const { toggleWorldStateCategoryHidden, getHiddenWorldStateCategories } = useTrackerStore(
        useShallow((s) => ({
            toggleWorldStateCategoryHidden: s.toggleWorldStateCategoryHidden,
            getHiddenWorldStateCategories: s.getHiddenWorldStateCategories,
        }))
    );
    const hiddenCategories = getHiddenWorldStateCategories();

    const theme = useAppTheme();
    const [compact, setCompact]     = useState(getCompactRows);
    const [timezone, setTimezone]   = useState(getStoredTimezone);

    function handleTheme(t: AppTheme) {
        setAppTheme(t);
    }

    function handleCompact(v: boolean) {
        setCompact(v);
        setCompactRows(v);
    }

    function handleTimezone(tz: string) {
        setTimezone(tz);
        setStoredTimezone(tz);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <WorkspacePanel className="p-4" aria-labelledby="settings-page-title">
                <h1 id="settings-page-title" className="text-lg font-semibold text-[color:var(--wf-text-strong)]">Settings</h1>
                <div className="text-sm text-[color:var(--wf-text-muted)] mt-1">Customize appearance, list density, world-state alerts, and time display.</div>
            </WorkspacePanel>

            {/* Responsive 2-column grid at lg */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                {/* Left column: Appearance + Data & Reset */}
                <div className="space-y-4">

                    {/* Appearance */}
                    <SettingsSection title="Appearance">
                        <div className="space-y-4">
                            {/* Theme toggle */}
                            <div>
                                <div className="text-xs text-slate-400 mb-2">Theme</div>
                                <WorkspaceSegmented className="gap-2 bg-transparent border-transparent shadow-none p-0">
                                    {(["dark", "light"] as AppTheme[]).map(t => (
                                        <WorkspaceSegmentedButton
                                            key={t}
                                            onClick={() => handleTheme(t)}
                                            active={theme === t}
                                            aria-pressed={theme === t}
                                            className={[
                                                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                                                theme === t
                                                    ? "border-[color:var(--wf-accent-border)] bg-[color:var(--wf-accent-soft)] text-[color:var(--wf-accent-text)]"
                                                    : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-input)] text-[color:var(--wf-text-muted)] hover:bg-[color:var(--wf-hover)]"
                                            ].join(" ")}
                                        >
                                            {t === "dark"
                                                ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                                                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                                            }
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                            {theme === t && <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                        </WorkspaceSegmentedButton>
                                    ))}
                                </WorkspaceSegmented>
                            </div>

                            {/* Compact list rows toggle + live preview */}
                            <div>
                                <Toggle
                                    checked={compact}
                                    onChange={handleCompact}
                                    label="Compact list rows"
                                    description="Reduce row height in item lists for a denser view."
                                />
                                <CompactPreview compact={compact} />
                            </div>
                        </div>
                    </SettingsSection>

                    {/* Data & Reset */}
                    <SettingsSection title="Data & Reset" description="Reset options control both what you see now and what remains saved in your browser.">
                        <div className="space-y-3">
                            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                <div className="text-sm font-semibold text-slate-100">Reset to Defaults</div>
                                <div className="mt-1 text-sm text-slate-400">
                                    Resets all tracked progress to the default starting state.{" "}
                                    <span className="text-slate-300">Your browser save is kept — refreshing will restore this reset.</span>
                                </div>
                                <div className="mt-3">
                                    <button
                                        className="rounded-lg border border-slate-700 px-4 py-2 text-slate-100 text-sm hover:bg-slate-900"
                                        onClick={() => { if (confirm("Reset to Defaults?\n\nContinue?")) { resetToDefaults(); alert("Reset complete."); } }}
                                    >
                                        Reset to Defaults
                                    </button>
                                </div>
                            </div>
                            <div className="rounded-xl border border-rose-900/70 bg-rose-950/10 p-3">
                                <div className="text-sm font-semibold text-rose-200">Reset All Local Data</div>
                                <div className="mt-1 text-sm text-slate-400">
                                    Permanently deletes all saved browser data.{" "}
                                    <span className="text-slate-300">This cannot be undone.</span>
                                </div>
                                <div className="mt-3">
                                    <button
                                        className="rounded-lg border border-rose-700 px-4 py-2 text-rose-200 text-sm hover:bg-rose-950/30"
                                        onClick={() => { if (confirm("Delete all local data? This cannot be undone.")) { resetAllLocalData(); alert("Hard reset complete."); } }}
                                    >
                                        Reset All Local Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    </SettingsSection>

                </div>

                {/* Right column: Time & Timezone + About */}
                <div className="space-y-4">

                    {/* Time & Timezone */}
                    <SettingsSection title="Time & Timezone" description="Controls how reset times and event times are displayed across the app.">
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1.5">Display timezone</label>
                                <select
                                    value={timezone}
                                    onChange={e => handleTimezone(e.target.value)}
                                    className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm w-full focus:outline-none focus:border-slate-500"
                                >
                                    {TIMEZONE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <p className="mt-1.5 text-xs text-slate-500">
                                    The UTC/Local toggle on the reset tracker controls which format is shown.
                                    This timezone is used when "Local" is selected.
                                </p>
                            </div>
                        </div>
                    </SettingsSection>

                    {/* World Events */}
                    <SettingsSection title="World Events" description="Choose which categories appear in the notification popup and World State page.">
                        <div className="space-y-2">
                            {WORLD_STATE_CATEGORIES.map(cat => {
                                const hidden = hiddenCategories.includes(cat.key);
                                return (
                                    <div key={cat.key} className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm text-slate-200">{cat.label}</div>
                                            <div className="text-xs text-slate-500">{cat.description}</div>
                                        </div>
                                        <button
                                            onClick={() => toggleWorldStateCategoryHidden(cat.key)}
                                            className={[
                                                "shrink-0 relative inline-flex h-5 w-9 rounded-full border transition-colors focus:outline-none",
                                                hidden
                                                    ? "bg-slate-800 border-slate-700"
                                                    : "bg-blue-600 border-blue-500"
                                            ].join(" ")}
                                            aria-pressed={!hidden}
                                            title={hidden ? `Show ${cat.label}` : `Hide ${cat.label}`}
                                        >
                                            <span className={[
                                                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                                                hidden ? "translate-x-0" : "translate-x-4"
                                            ].join(" ")} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </SettingsSection>

                    {/* About */}
                    <SettingsSection title="About">
                        <div className="space-y-3 text-sm text-slate-400">
                            <p>Warframe Tracker is a fan-made progression tool. Not affiliated with Digital Extremes.</p>
                            <div className="flex flex-wrap gap-3">
                                <a href="https://ko-fi.com/appl3tree" target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-amber-700/60 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-950/40 transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/></svg>
                                    Support on Ko-fi
                                </a>
                                <a href="https://github.com/Appl3Tree/Warframe-Progression-Tracker" target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                    View on GitHub
                                </a>
                            </div>
                        </div>
                    </SettingsSection>

                </div>
            </div>
        </div>
    );
}
