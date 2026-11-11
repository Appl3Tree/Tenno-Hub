// src/pages/WorldState.tsx
// World State page — tabbed layout: Overview | Fissures | Missions | Events
// Data from https://api.warframestat.us (community API, no auth required).

import { useMemo, useState } from "react";
import { useTrackerStore } from "../store/store";
import { WorkspaceAction, WorkspaceHero, WorkspaceSegmented, WorkspaceSegmentedButton, WorkspaceStat } from "../components/workspace/WorkspaceChrome";
import {
    fetchWorldState,
    eventCompletionKey,
    getCurrentWorldActivitySummary,
    getCurrentNightwaveChallenges,
    isWorldStateEntryActive,
    type WorldStateData,
    type Fissure,
    type WsCycle,
    type DuviriCycle,
    type Archimedea,
    type Calendar,
    type CalendarEvent,
    type Nightwave,
    type WorldStateRecord,
} from "../lib/worldStateCache";
import { useWorldStateNow, useWorldStateSnapshot } from "../lib/useWorldStateData";

const EMPTY_COMPLETION_IDS: string[] = [];

// ── Utilities ─────────────────────────────────────────────────────────────────

function msToHms(ms: number): string {
    if (ms <= 0) return "Expired";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${String(h % 24).padStart(2, "0")}h ${String(m % 60).padStart(2, "0")}m`;
    if (h > 0) return `${h}h ${String(m % 60).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
    return `${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
}

function Countdown({ expiry, now, className }: { expiry: string; now: number; className?: string }) {
    return <span className={className}>{msToHms(new Date(expiry).getTime() - now)}</span>;
}

function worldStateRecord(value: unknown): WorldStateRecord | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as WorldStateRecord : null;
}

function sourceDisplayName(value: unknown): string {
    if (typeof value !== "string") return "";
    const tail = value.split("/").filter(Boolean).at(-1) ?? value;
    return tail
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function recordText(record: WorldStateRecord | null, key: string): string {
    if (!record) return "";
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
    const nested = worldStateRecord(value);
    if (!nested) return "";
    for (const candidate of ["name", "title", "description", "uniqueName"]) {
        const text = nested[candidate];
        if (typeof text === "string" && text) return sourceDisplayName(text);
    }
    return "";
}

function recordList(value: unknown): WorldStateRecord[] {
    return Array.isArray(value) ? value.map(worldStateRecord).filter((record): record is WorldStateRecord => !!record) : [];
}

// ── Visual lookups ─────────────────────────────────────────────────────────────

const CYCLE_VISUALS: Record<string, { label: string; color: string; dot: string }> = {
    day:     { label: "Day",             color: "text-amber-300",  dot: "bg-amber-400" },
    night:   { label: "Night",           color: "text-blue-300",   dot: "bg-blue-400" },
    warm:    { label: "Warm",            color: "text-orange-300", dot: "bg-orange-400" },
    cold:    { label: "Cold",            color: "text-cyan-300",   dot: "bg-cyan-400" },
    fass:    { label: "Fass",            color: "text-red-300",    dot: "bg-red-400" },
    vome:    { label: "Vome",            color: "text-violet-300", dot: "bg-violet-400" },
    grineer: { label: "Grineer Control", color: "text-red-300",    dot: "bg-red-400" },
    corpus:  { label: "Corpus Control",  color: "text-blue-300",   dot: "bg-blue-400" },
    anger:   { label: "Anger",           color: "text-red-300",    dot: "bg-red-400" },
    envy:    { label: "Envy",            color: "text-green-300",  dot: "bg-green-400" },
    fear:    { label: "Fear",            color: "text-violet-300", dot: "bg-violet-400" },
    joy:     { label: "Joy",             color: "text-yellow-300", dot: "bg-yellow-400" },
    sorrow:  { label: "Sorrow",          color: "text-slate-300",  dot: "bg-slate-400" },
    envy2:   { label: "Envy",            color: "text-teal-300",   dot: "bg-teal-400" },
};

function getVisual(state: string) {
    return CYCLE_VISUALS[state.toLowerCase()] ?? { label: state, color: "text-slate-300", dot: "bg-slate-400" };
}

const FACTION_COLORS: Record<string, string> = {
    Grineer:    "text-red-400",
    Corpus:     "text-blue-400",
    Infested:   "text-green-400",
    Infestation:"text-green-400",
    Corrupted:  "text-violet-400",
    Orokin:     "text-violet-400",
    Narmer:     "text-amber-400",
};

const TIER_COLORS: Record<string, string> = {
    Lith:    "bg-amber-900/40 text-amber-300 border-amber-700/50",
    Meso:    "bg-slate-700/40 text-slate-300 border-slate-600/50",
    Neo:     "bg-yellow-900/40 text-yellow-300 border-yellow-700/50",
    Axi:     "bg-violet-900/40 text-violet-300 border-violet-700/50",
    Requiem: "bg-red-900/40 text-red-300 border-red-700/50",
    Omnia:   "bg-pink-900/40 text-pink-300 border-pink-700/50",
};

const TIER_ORDER = ["Lith", "Meso", "Neo", "Axi", "Requiem", "Omnia"];

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "fissures" | "missions" | "activities" | "traders";
const TABS: { key: Tab; label: string }[] = [
    { key: "overview",    label: "Overview"    },
    { key: "fissures",    label: "Fissures"    },
    { key: "missions",    label: "Missions"    },
    { key: "activities",  label: "Activities"  },
    { key: "traders",     label: "Traders"     },
];

// ── Overview tab ──────────────────────────────────────────────────────────────

function CycleCard({ name, cycle, nextLabel, now }: { name: string; cycle: WsCycle; nextLabel: string; now: number }) {
    const vis = getVisual(cycle.state);
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 flex items-center justify-between gap-2">
            <div>
                <div className="text-[11px] text-slate-500 mb-0.5">{name}</div>
                <div className="flex items-center gap-1.5">
                    <span className={["w-2 h-2 rounded-full shrink-0", vis.dot].join(" ")} />
                    <span className={["text-sm font-semibold", vis.color].join(" ")}>{vis.label}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-[10px] text-slate-500">{nextLabel} in</div>
                <Countdown expiry={cycle.expiry} now={now} className="font-mono text-xs text-slate-300" />
            </div>
        </div>
    );
}

function DuviriCard({ cycle, now }: { cycle: DuviriCycle; now: number }) {
    const [open, setOpen] = useState(false);
    const vis = getVisual(cycle.state);

    const normalGroup = cycle.choices.find((g) => g.category === "normal" || g.categoryKey?.includes("NORMAL"));
    const hardGroup   = cycle.choices.find((g) => g.category === "hard"   || g.categoryKey?.includes("HARD"));

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div>
                        <div className="text-[11px] text-slate-500 mb-0.5">Duviri</div>
                        <div className="flex items-center gap-1.5">
                            <span className={["w-2 h-2 rounded-full shrink-0", vis.dot].join(" ")} />
                            <span className={["text-sm font-semibold", vis.color].join(" ")}>{vis.label}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <div className="text-[10px] text-slate-500">next in</div>
                            <Countdown expiry={cycle.expiry} now={now} className="font-mono text-xs text-slate-300" />
                        </div>
                    </div>
                </div>
                {/* Circuit choices toggle */}
                {cycle.choices.length > 0 && (
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        <svg className={["w-3 h-3 transition-transform", open ? "rotate-90" : ""].join(" ")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                        The Circuit choices
                    </button>
                )}
            </div>
            {/* Expanded circuit panel */}
            {open && cycle.choices.length > 0 && (
                <div className="border-t border-slate-800/60 px-3 py-2.5 space-y-2">
                    {normalGroup && (
                        <div>
                            <div className="text-[10px] text-slate-500 mb-1">Normal — Warframe picks</div>
                            <div className="flex flex-wrap gap-1">
                                {normalGroup.choices.map((name, i) => (
                                    <span key={i} className="rounded-full border border-blue-700/50 bg-blue-950/30 px-2 py-px text-[10px] text-blue-300 font-medium">
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {hardGroup && (
                        <div>
                            <div className="text-[10px] text-red-400/70 mb-1">Steel Path — Incarnon picks</div>
                            <div className="flex flex-wrap gap-1">
                                {hardGroup.choices.map((name, i) => (
                                    <span key={i} className="rounded-full border border-red-700/50 bg-red-950/20 px-2 py-px text-[10px] text-red-300 font-medium">
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Simaris card ───────────────────────────────────────────────────────────────

function SimarisCard({ target, isTargetActive }: { target: string; isTargetActive: boolean }) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <div className="text-[11px] text-slate-500 mb-0.5">Sanctuary Onslaught Target</div>
            <div className="flex items-center gap-1.5">
                <span className={["w-2 h-2 rounded-full shrink-0", isTargetActive ? "bg-green-400" : "bg-slate-600"].join(" ")} />
                <span className={["text-sm font-semibold", isTargetActive ? "text-green-300" : "text-slate-300"].join(" ")}>
                    {target || "Unknown"}
                </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
                {isTargetActive ? "Currently active in mission" : "Scan in Sanctuary Onslaught"}
            </div>
        </div>
    );
}

// ── 1999 Calendar modal ────────────────────────────────────────────────────────

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CAL_META: Record<string, { dot: string; label: string; textColor: string }> = {
    "To Do":      { dot: "bg-sky-400",    label: "To Do",      textColor: "text-sky-300"    },
    "Big Prize!": { dot: "bg-amber-400",  label: "Big Prize!", textColor: "text-amber-300"  },
    "Override":   { dot: "bg-violet-400", label: "Override",   textColor: "text-violet-300" },
    "Birthday":   { dot: "bg-pink-400",   label: "Birthday",   textColor: "text-pink-300"   },
};

type CalEntry = { dayIndex: number; date: Date; events: CalendarEvent[] };
type MonthGroup = { key: string; label: string; startDow: number; daysInMonth: number; entries: Map<number, CalEntry> };

function parseCalDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

function groupCalendarByMonth(days: Calendar["days"]): MonthGroup[] {
    const groups = new Map<string, MonthGroup>();
    days.forEach((day, idx) => {
        const d = parseCalDate(day.date);
        if (!d) return;
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        if (!groups.has(key)) {
            const firstOfMonth = new Date(Date.UTC(year, month, 1));
            const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
            const label = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
            groups.set(key, { key, label, startDow: firstOfMonth.getUTCDay(), daysInMonth, entries: new Map() });
        }
        groups.get(key)!.entries.set(d.getUTCDate(), { dayIndex: idx, date: d, events: Array.isArray(day.events) ? day.events : [] });
    });
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function CalEventCard({ ev }: { ev: CalendarEvent }) {
    const meta = CAL_META[ev.type];
    if (ev.type === "Birthday") {
        return (
            <div className="rounded-lg border border-pink-900/40 bg-pink-950/20 px-3 py-2.5 flex items-center gap-2.5">
                <span className="text-xl leading-none">🎂</span>
                <div className="text-sm text-pink-200 font-medium">{ev.title}</div>
            </div>
        );
    }
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${meta?.dot ?? "bg-slate-500"}`} />
                <div className={`text-xs font-semibold ${meta?.textColor ?? "text-slate-400"}`}>{meta?.label ?? (ev.type || "Event")}</div>
            </div>
            {ev.title && <div className="text-sm text-slate-200 font-medium leading-snug">{ev.title}</div>}
            {ev.description && <div className="text-xs text-slate-400 mt-1 leading-snug">{ev.description}</div>}
            {ev.reward && (
                <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Reward:</span>
                    <span className="text-[10px] text-amber-300 font-medium">{ev.reward}</span>
                </div>
            )}
        </div>
    );
}


function CalendarModal({ calendar, onClose }: { calendar: Calendar; onClose: () => void }) {
    const [selectedEntry, setSelectedEntry] = useState<CalEntry | null>(null);
    const months = useMemo(() => groupCalendarByMonth(calendar.days ?? []), [calendar.days]);
    const todayDayIndex = calendar.currentDay !== undefined ? Number(calendar.currentDay) : -1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                    <div>
                        <div className="text-base font-semibold text-slate-100">1999 Calendar</div>
                        {calendar.season && (
                            <div className="text-xs text-slate-500 mt-0.5">{calendar.season}</div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-5 px-5 py-2.5 border-b border-slate-800/50 bg-slate-950/80">
                    {Object.entries(CAL_META).filter(([key]) => key !== "Birthday").map(([key, meta]) => (
                        <div key={key} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                            <span className={`text-[11px] ${meta.textColor}`}>{meta.label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] leading-none">🎂</span>
                        <span className="text-[11px] text-pink-300">Birthday</span>
                    </div>
                    <span className="ml-auto text-[11px] text-slate-600">Click a day for details</span>
                </div>

                {/* Content: month grids + side detail panel */}
                <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                    {/* Month grids — scrollable */}
                    <div className="flex-1 p-5 overflow-y-auto">
                        {calendar.days.length === 0 ? (
                            <div className="text-xs text-slate-500 text-center py-8">No calendar data available.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                {months.map((month) => (
                                    <div key={month.key}>
                                        <div className="text-sm font-semibold text-slate-300 mb-3">{month.label}</div>
                                        <div className="grid grid-cols-7 mb-1">
                                            {DOW_LABELS.map((l) => (
                                                <div key={l} className="text-center text-[10px] text-slate-600 font-medium py-1">{l}</div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-0.5">
                                            {Array.from({ length: month.startDow }, (_, i) => (
                                                <div key={`blank-${i}`} />
                                            ))}
                                            {Array.from({ length: month.daysInMonth }, (_, i) => {
                                                const dayNum = i + 1;
                                                const entry = month.entries.get(dayNum);
                                                const isToday = entry?.dayIndex === todayDayIndex;
                                                const isSelected = selectedEntry != null && selectedEntry.dayIndex === entry?.dayIndex;
                                                const eventKeys = entry ? entry.events.map((ev) => ev.type) : [];
                                                return (
                                                    <button
                                                        key={dayNum}
                                                        onClick={() => entry && setSelectedEntry(isSelected ? null : entry)}
                                                        disabled={!entry}
                                                        className={[
                                                            "relative flex flex-col items-center rounded-lg py-1 px-0.5 min-h-[40px] transition-colors",
                                                            entry ? "hover:bg-slate-800 cursor-pointer" : "cursor-default",
                                                            isToday ? "ring-1 ring-blue-500/60 bg-slate-800/70" : "",
                                                            isSelected ? "bg-slate-700 ring-1 ring-slate-500" : "",
                                                        ].join(" ")}
                                                    >
                                                        <span className={`text-[11px] font-medium ${isToday ? "text-blue-300" : entry ? "text-slate-300" : "text-slate-700"}`}>
                                                            {dayNum}
                                                        </span>
                                                        {eventKeys.length > 0 && (
                                                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                                                                {eventKeys.map((k, ki) =>
                                                                    k === "Birthday"
                                                                        ? <span key={ki} className="text-[9px] leading-none">🎂</span>
                                                                        : <div key={ki} className={`w-1.5 h-1.5 rounded-full ${CAL_META[k]?.dot ?? "bg-slate-500"}`} />
                                                                )}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Day detail side panel */}
                    <div className={[
                        "md:w-72 shrink-0 overflow-y-auto border-slate-800",
                        selectedEntry ? "block border-t md:border-t-0 md:border-l" : "hidden md:flex md:border-l",
                    ].join(" ")}>
                        {selectedEntry ? (
                            <div className="p-4">
                                <div className="text-xs font-medium text-slate-400 mb-3">
                                    {selectedEntry.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
                                </div>
                                <div className="space-y-2">
                                    {selectedEntry.events.map((ev, i) => (
                                        <CalEventCard key={i} ev={ev} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-600 p-6 text-center">
                                Click a day to see event details
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function OverviewTab({ data }: { data: WorldStateData }) {
    const now = useWorldStateNow();
    const [calendarOpen, setCalendarOpen] = useState(false);

    const cycles: Array<{ name: string; cycle: WsCycle; nextLabel: string }> = [
        data.cetusCycle   && { name: "Plains of Eidolon", cycle: data.cetusCycle,   nextLabel: data.cetusCycle.state   === "day"  ? "Night" : "Day"  },
        data.vallisCycle  && { name: "Orb Vallis",        cycle: data.vallisCycle,  nextLabel: data.vallisCycle.state  === "warm" ? "Cold"  : "Warm" },
        data.cambionCycle && { name: "Cambion Drift",     cycle: data.cambionCycle, nextLabel: data.cambionCycle.state === "fass" ? "Vome"  : "Fass" },
        data.zarimanCycle && { name: "Zariman",           cycle: data.zarimanCycle, nextLabel: "Next" },
        data.earthCycle   && { name: "Earth",             cycle: data.earthCycle,   nextLabel: data.earthCycle.state   === "day"  ? "Night" : "Day"  },
    ].filter(Boolean) as Array<{ name: string; cycle: WsCycle; nextLabel: string }>;

    const baroActive = data.voidTrader ? isWorldStateEntryActive(data.voidTrader, now) : false;
    const varziaActive = data.vaultTrader ? isWorldStateEntryActive(data.vaultTrader, now) : false;
    const baroDue    = data.voidTrader && !baroActive && new Date(data.voidTrader.activation).getTime() > now;

    const cp = data.constructionProgress;
    const descendia = worldStateRecord(data.descendia);
    const descendiaChallenges = recordList(descendia?.challenges);
    const initiative = worldStateRecord(data.clanWeeklyInitiative);
    const initiativeRewards = recordList(initiative?.rewwards ?? initiative?.rewards);
    const faceoff = worldStateRecord(data.faceoffBonus);
    const conclave = data.conclaveChallenges.filter((challenge) => isWorldStateEntryActive(challenge, now));
    const currentDeals = data.dailyDeals.filter((deal) => isWorldStateEntryActive(deal, now));
    const currentGlobalUpgrades = data.globalUpgrades.filter((upgrade) => isWorldStateEntryActive(upgrade, now));

    return (
        <div className="space-y-4">
            {calendarOpen && data.calendar && (
                <CalendarModal calendar={data.calendar} onClose={() => setCalendarOpen(false)} />
            )}

            {/* Cycles grid */}
            <section>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open World Cycles</div>
                    {data.calendar && (
                        <button
                            onClick={() => setCalendarOpen(true)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                            title="1999 Calendar"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            1999 Calendar
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {cycles.map((c) => <CycleCard key={c.name} {...c} now={now} />)}
                    {data.duviriCycle && <DuviriCard cycle={data.duviriCycle} now={now} />}
                    {data.simaris && data.simaris.target && (
                        <SimarisCard target={data.simaris.target} isTargetActive={data.simaris.isTargetActive} />
                    )}
                </div>
            </section>

            {/* Baro + Varzia + Steel Path row */}
            <section>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Traders & Rewards</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">

                    {/* Baro Ki'Teer */}
                    {data.voidTrader && (
                        <div className={[
                            "rounded-xl border px-3 py-2.5",
                            baroActive
                                ? "border-amber-700/60 bg-amber-950/20"
                                : "border-slate-800 bg-slate-900/40",
                        ].join(" ")}>
                            <div className="text-[11px] text-slate-500 mb-0.5">Baro Ki'Teer</div>
                            <div className={["text-sm font-semibold mb-1", baroActive ? "text-amber-300" : "text-slate-400"].join(" ")}>
                                {baroActive ? "● Here Now" : "○ Away"}
                            </div>
                            <div className="text-[11px] text-slate-400">{data.voidTrader.location}</div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                {baroActive
                                    ? <>Leaves <Countdown expiry={data.voidTrader.expiry} now={now} className="font-mono text-slate-300" /></>
                                    : baroDue
                                        ? <>Arrives <Countdown expiry={data.voidTrader.activation} now={now} className="font-mono text-slate-300" /></>
                                        : null
                                }
                            </div>
                            {baroActive && data.voidTrader.inventory.length > 0 && (
                                <div className="mt-1.5 text-[10px] text-amber-400/80">
                                    {data.voidTrader.inventory.length} items available
                                </div>
                            )}
                            {!baroActive && data.voidTrader.schedule.length > 0 && (
                                <div className="mt-1.5 space-y-0.5">
                                    {data.voidTrader.schedule.slice(0, 3).map((s, i) => (
                                        <div key={i} className="text-[10px] text-slate-500">
                                            {s.item && <span className="text-slate-400 mr-1">{s.item}</span>}
                                            <Countdown expiry={s.expiry} now={now} className="font-mono text-slate-500" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Varzia (Vault Trader) */}
                    {data.vaultTrader && (
                        <div className={[
                            "rounded-xl border px-3 py-2.5",
                            varziaActive
                                ? "border-violet-700/60 bg-violet-950/20"
                                : "border-slate-800 bg-slate-900/40",
                        ].join(" ")}>
                            <div className="text-[11px] text-slate-500 mb-0.5">Varzia (Primed Resurgence)</div>
                            <div className={["text-sm font-semibold mb-1", varziaActive ? "text-violet-300" : "text-slate-400"].join(" ")}>
                                {varziaActive ? "● Active" : "○ Inactive"}
                            </div>
                            {data.vaultTrader.location && (
                                <div className="text-[11px] text-slate-400">{data.vaultTrader.location}</div>
                            )}
                            <div className="text-[10px] text-slate-500 mt-1">
                                {varziaActive && data.vaultTrader.expiry
                                    ? <>Ends <Countdown expiry={data.vaultTrader.expiry} now={now} className="font-mono text-slate-300" /></>
                                    : data.vaultTrader.activation && new Date(data.vaultTrader.activation).getTime() > now
                                        ? <>Next <Countdown expiry={data.vaultTrader.activation} now={now} className="font-mono text-slate-300" /></>
                                        : null
                                }
                            </div>
                        </div>
                    )}

                    {/* Steel Path current reward */}
                    {data.steelPath?.currentReward && (!data.steelPath.expiry || isWorldStateEntryActive({ expiry: data.steelPath.expiry }, now)) && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                            <div className="text-[11px] text-slate-500 mb-0.5">Steel Path Honor</div>
                            <div className="text-sm font-semibold text-slate-200 mb-0.5">
                                {data.steelPath.currentReward.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                                {data.steelPath.currentReward.cost} Steel Essence
                            </div>
                            {data.steelPath.expiry && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                    Rotates <Countdown expiry={data.steelPath.expiry} now={now} className="font-mono text-slate-300" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Darvo daily deal */}
                    {currentDeals.length > 0 && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                            <div className="text-[11px] text-slate-500 mb-0.5">Darvo Deal</div>
                            <div className="text-sm font-semibold text-slate-200 mb-0.5 truncate">
                                {currentDeals[0].item}
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <span className="text-green-400 font-semibold">{currentDeals[0].discount}% off</span>
                                <span className="text-slate-500 line-through">{currentDeals[0].originalPrice.toLocaleString()}</span>
                                <span className="text-yellow-300">{currentDeals[0].salePrice.toLocaleString()} ◈</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                {currentDeals[0].sold}/{currentDeals[0].total} sold ·{" "}
                                <Countdown expiry={currentDeals[0].expiry} now={now} className="font-mono text-slate-300" />
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Sortie + Archon + Construction */}
            <section>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Weekly & Daily</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">

                    {data.sortie && isWorldStateEntryActive(data.sortie, now) && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                            <div className="text-[11px] text-slate-500 mb-0.5">Daily Sortie</div>
                            <div className={["text-sm font-semibold", FACTION_COLORS[data.sortie.faction] ?? "text-slate-200"].join(" ")}>
                                {data.sortie.boss}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{data.sortie.faction}</div>
                            {data.sortie.rewardPool && (
                                <span className="inline-block mt-1.5 rounded-full border border-amber-700/50 bg-amber-950/30 px-1.5 py-px text-[10px] text-amber-300">
                                    {data.sortie.rewardPool}
                                </span>
                            )}
                            <div className="text-[10px] text-slate-500 mt-1">
                                Resets <Countdown expiry={data.sortie.expiry} now={now} className="font-mono text-slate-300" />
                            </div>
                        </div>
                    )}

                    {data.archonHunt && isWorldStateEntryActive(data.archonHunt, now) && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                            <div className="text-[11px] text-slate-500 mb-0.5">Weekly Archon Hunt</div>
                            <div className={["text-sm font-semibold", FACTION_COLORS[data.archonHunt.faction] ?? "text-slate-200"].join(" ")}>
                                {data.archonHunt.boss}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{data.archonHunt.faction}</div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Resets <Countdown expiry={data.archonHunt.expiry} now={now} className="font-mono text-slate-300" />
                            </div>
                        </div>
                    )}

                    {data.nightwave && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                            <div className="text-[11px] text-slate-500 mb-0.5">Nightwave</div>
                            <div className="text-sm font-semibold text-blue-300">Season {data.nightwave.season}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                                {getCurrentNightwaveChallenges(data.nightwave, now).length} active acts
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Ends <Countdown expiry={data.nightwave.expiry} now={now} className="font-mono text-slate-300" />
                            </div>
                        </div>
                    )}

                    {cp && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                            <div className="text-[11px] text-slate-500 mb-1.5">Construction Progress</div>
                            <div className="space-y-1.5">
                                {[
                                    { label: "Fomorian", value: cp.fomorianProgress, color: "bg-red-500/60",  text: "text-red-400"  },
                                    { label: "Razorback", value: cp.razorbackProgress, color: "bg-blue-500/60", text: "text-blue-400" },
                                    ...(parseFloat(cp.unknownProgress) > 0
                                        ? [{ label: "Unknown", value: cp.unknownProgress, color: "bg-slate-500/60", text: "text-slate-400" }]
                                        : []),
                                ].map(({ label, value, color, text }) => (
                                    <div key={label}>
                                        <div className="flex justify-between text-[11px] mb-0.5">
                                            <span className={text}>{label}</span>
                                            <span className="text-slate-300 font-mono">{parseFloat(value).toFixed(1)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, parseFloat(value))}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Active global boosters */}
            {currentGlobalUpgrades.length > 0 && (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Boosters</div>
                    <div className="flex flex-wrap gap-2">
                        {currentGlobalUpgrades.map((g, i) => (
                            <div key={i} className="rounded-xl border border-green-800/40 bg-green-950/20 px-3 py-2">
                                <div className="text-xs font-semibold text-green-300">{g.desc || `${g.operationSymbol}${g.upgradeOperationValue} ${g.upgrade}`}</div>
                                {g.expiry && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        Ends <Countdown expiry={g.expiry} now={now} className="font-mono text-slate-400" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Sentient Outpost */}
            {data.sentientOutposts && isWorldStateEntryActive(data.sentientOutposts, now) && (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sentient Outpost</div>
                    <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-3 py-2.5 inline-flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold text-rose-300">● Active</span>
                        {data.sentientOutposts.mission && (
                            <>
                                <span className="text-[11px] text-slate-300">{data.sentientOutposts.mission.type}</span>
                                <span className="text-[11px] text-slate-500">{data.sentientOutposts.mission.node}</span>
                                <span className={["text-[11px] font-medium", FACTION_COLORS[data.sentientOutposts.mission.faction] ?? "text-slate-400"].join(" ")}>
                                    {data.sentientOutposts.mission.faction}
                                </span>
                            </>
                        )}
                        {data.sentientOutposts.expiry && (
                            <span className="text-[10px] text-slate-500 ml-auto">
                                Ends <Countdown expiry={data.sentientOutposts.expiry} now={now} className="font-mono text-slate-400" />
                            </span>
                        )}
                    </div>
                </section>
            )}

            {/* Current weekly and competitive rotations. */}
            {(descendia || initiative || faceoff || conclave.length > 0) && (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Weekly and special rotations</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {descendia && (
                            <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/10 px-3 py-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="text-xs font-semibold text-cyan-200">Descendia</div>
                                        <div className="mt-0.5 text-[10px] text-slate-400">{descendiaChallenges.length} floor challenges · weekly rotation</div>
                                    </div>
                                    {typeof descendia.expiry === "string" && <Countdown expiry={descendia.expiry} now={now} className="font-mono text-[10px] text-slate-400" />}
                                </div>
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-[10px] text-cyan-300/80">View floor challenges</summary>
                                    <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                        {descendiaChallenges.map((floor, index) => {
                                            const auras = recordList(floor.auras).map((aura) => recordText(aura, "name")).filter(Boolean);
                                            const specs = recordList(floor.specs).map((spec) => recordText(spec, "name")).filter(Boolean);
                                            return (
                                                <li key={`${String(floor.index ?? index)}:${String(floor.challengeKey ?? floor.challenge ?? index)}`} className="rounded-lg border border-cyan-900/30 bg-slate-950/20 px-2 py-1.5">
                                                    <div className="text-[10px] font-medium text-slate-200">{String(floor.index ?? index + 1)}. {String(floor.challenge ?? "Challenge")}</div>
                                                    {(auras.length > 0 || specs.length > 0) && <div className="mt-0.5 text-[9px] leading-snug text-slate-500">{[...auras, ...specs].slice(0, 3).join(" · ")}</div>}
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </details>
                            </div>
                        )}

                        {initiative && (
                            <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/10 px-3 py-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="text-xs font-semibold text-indigo-200">Clan Weekly Initiative</div>
                                        <div className="mt-0.5 text-[10px] text-slate-400">Week {String(initiative.week ?? "")} · {String(initiative.bonusRegion ?? "Bonus region")}</div>
                                    </div>
                                    {typeof initiative.expiry === "string" && <Countdown expiry={initiative.expiry} now={now} className="font-mono text-[10px] text-slate-400" />}
                                </div>
                                <ul className="mt-2 space-y-1">
                                    {initiativeRewards.map((reward, index) => (
                                        <li key={`${String(reward.PointThreshold ?? index)}:${String(reward.Reward ?? index)}`} className="flex items-center justify-between gap-2 text-[10px]">
                                            <span className="text-slate-400">{Number(reward.PointThreshold || 0).toLocaleString()} clan points</span>
                                            <span className="truncate text-right text-slate-200">{Number(reward.ItemCount || 1)}× {sourceDisplayName(String(reward.Reward ?? "Reward"))}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-1.5 text-[9px] text-slate-600">The API lists reward thresholds, not your clan's current contribution.</div>
                            </div>
                        )}

                        {faceoff && (
                            <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 px-3 py-2.5">
                                <div className="text-xs font-semibold text-amber-200">Faceoff Bonus</div>
                                {isWorldStateEntryActive(faceoff, now) && typeof faceoff.expiry === "string"
                                    ? <div className="mt-1 text-[10px] text-slate-400">Active · ends in <Countdown expiry={faceoff.expiry} now={now} className="font-mono text-slate-300" /></div>
                                    : typeof faceoff.next === "string" && <div className="mt-1 text-[10px] text-slate-400">Next bonus in <Countdown expiry={faceoff.next} now={now} className="font-mono text-slate-300" /></div>}
                            </div>
                        )}

                        {conclave.length > 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2.5">
                                <div className="text-xs font-semibold text-slate-200">Conclave Challenges <span className="font-normal text-slate-500">({conclave.length})</span></div>
                                <ul className="mt-2 space-y-1.5">
                                    {conclave.slice(0, 4).map((challenge, index) => (
                                        <li key={String(challenge.id ?? index)}>
                                            <div className="text-[10px] font-medium text-slate-300">{String(challenge.title ?? "Challenge")}{typeof challenge.amount === "number" ? ` · ${challenge.amount}` : ""}</div>
                                            {typeof challenge.description === "string" && <div className="text-[9px] leading-snug text-slate-500">{challenge.description}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* News */}
            {data.kinepage && typeof data.kinepage.message === "string" && (
                <section className="rounded-xl border border-violet-900/40 bg-violet-950/10 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">Recent Kinepage announcement</div>
                    <div className="mt-1 text-xs text-slate-200">{data.kinepage.message}</div>
                    {typeof data.kinepage.timestamp === "string" && <div className="mt-1 text-[9px] text-slate-500">{new Date(data.kinepage.timestamp).toLocaleString()}</div>}
                </section>
            )}
            {data.news.length > 0 && (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">News</div>
                    <div className="space-y-1.5">
                        {data.news.slice(0, 5).map((n, i) => (
                            <a
                                key={i}
                                href={n.link || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 hover:bg-slate-800/60 transition-colors group"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                        {n.update && (
                                            <span className="rounded border border-blue-700/50 bg-blue-950/30 px-1 py-px text-[9px] font-bold text-blue-300">UPDATE</span>
                                        )}
                                        {n.primeAccess && (
                                            <span className="rounded border border-amber-700/50 bg-amber-950/30 px-1 py-px text-[9px] font-bold text-amber-300">PRIME</span>
                                        )}
                                        {n.stream && (
                                            <span className="rounded border border-violet-700/50 bg-violet-950/30 px-1 py-px text-[9px] font-bold text-violet-300">STREAM</span>
                                        )}
                                        <span className="text-xs text-slate-200 group-hover:text-slate-100 truncate">{n.message}</span>
                                    </div>
                                    {n.date && (
                                        <div className="text-[10px] text-slate-500">
                                            {new Date(n.date).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                {n.link && (
                                    <svg className="w-3 h-3 shrink-0 text-slate-600 group-hover:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                )}
                            </a>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

// ── Fissures tab ──────────────────────────────────────────────────────────────

function FissuresTab({ fissures }: { fissures: Fissure[] }) {
    const now = useWorldStateNow();
    const [tierFilter, setTierFilter] = useState<string>("All");
    const [showSteel,  setShowSteel]  = useState(false);
    const [showStorm,  setShowStorm]  = useState(true);

    const active = fissures.filter((f) => isWorldStateEntryActive(f, now));
    const tiers  = ["All", ...TIER_ORDER.filter((t) => active.some((f) => f.tier === t))];

    const shown = active
        .filter((f) => {
            if (tierFilter !== "All" && f.tier !== tierFilter) return false;
            if (!showSteel && f.isHard) return false;
            if (!showStorm && f.isStorm) return false;
            return true;
        })
        .sort((a, b) => a.tierNum - b.tierNum || new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex flex-wrap gap-1">
                    {tiers.map((t) => (
                        <button
                            key={t}
                            onClick={() => setTierFilter(t)}
                            className={[
                                "rounded-full border px-2 py-px text-[11px] font-semibold transition-colors",
                                tierFilter === t
                                    ? "bg-slate-100 text-slate-900 border-slate-100"
                                    : t === "All"
                                        ? "border-slate-700 text-slate-400 hover:bg-slate-800"
                                        : `${TIER_COLORS[t] ?? "border-slate-700 text-slate-300"} bg-transparent hover:opacity-80`,
                            ].join(" ")}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-400">
                        <input type="checkbox" checked={showStorm} onChange={e => setShowStorm(e.target.checked)} className="rounded" />
                        Storm
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-400">
                        <input type="checkbox" checked={showSteel} onChange={e => setShowSteel(e.target.checked)} className="rounded" />
                        Steel Path
                    </label>
                </div>
            </div>

            <div className="text-[11px] text-slate-500 mb-2">{active.length} active fissures · showing {shown.length}</div>

            {shown.length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">No fissures match the current filter.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {shown.map((f) => {
                        const ageMs = f.activation ? now - new Date(f.activation).getTime() : 0;
                        const ageMins = ageMs > 0 ? Math.floor(ageMs / 60000) : null;
                        return (
                            <div key={f.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 flex items-start gap-2.5">
                                <span className={["shrink-0 mt-0.5 rounded-full border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide", TIER_COLORS[f.tier] ?? "border-slate-700 text-slate-400"].join(" ")}>
                                    {f.tier}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-200 font-medium">
                                        {f.missionType}
                                        {f.isStorm && <span className="text-[10px] text-cyan-400 font-semibold">STORM</span>}
                                        {f.isHard  && <span className="text-[10px] text-red-400 font-semibold">SP</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">{f.node}</div>
                                    <div className="text-[10px] text-slate-500">{f.enemy}</div>
                                    {ageMins !== null && ageMins >= 0 && (
                                        <div className="text-[10px] text-slate-600 mt-0.5">
                                            up {ageMins >= 60 ? `${Math.floor(ageMins / 60)}h ${ageMins % 60}m` : `${ageMins}m`}
                                        </div>
                                    )}
                                </div>
                                <Countdown expiry={f.expiry} now={now} className="shrink-0 font-mono text-[10px] text-slate-400 text-right" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Archimedea card ────────────────────────────────────────────────────────────

const ARCHIMEDEA_TAG_LABELS: Record<string, string> = {
    "C T_ L A B": "Temporal Archimedea",
    "C T_ H E X": "The Hex",
};

function ArchimedeaCard({ arch, now }: { arch: Archimedea; now: number }) {
    const title = ARCHIMEDEA_TAG_LABELS[arch.tag] ?? arch.tag;
    const allModifiers = [
        ...(arch.personalModifiers ?? []),
        ...(arch.deviations ?? []),
        ...(arch.risks ?? []),
    ];

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40">
                <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">{title}</div>
                {arch.endDate && (
                    <div className="text-[10px] text-slate-500">
                        Ends <Countdown expiry={arch.endDate} now={now} className="font-mono text-slate-400" />
                    </div>
                )}
            </div>
            <div className="p-3 space-y-3">
                {/* Missions */}
                {arch.variants.length > 0 && (
                    <div className="space-y-1.5">
                        {arch.variants.map((v, i) => (
                            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="text-xs font-medium text-slate-200">{v.type}</div>
                                        <div className="text-[10px] text-slate-500">{v.node}</div>
                                    </div>
                                    {v.modifier && (
                                        <span className="shrink-0 rounded-full border border-orange-700/50 bg-orange-950/20 px-1.5 py-px text-[10px] text-orange-300">
                                            {v.modifier}
                                        </span>
                                    )}
                                </div>
                                {v.modifierDescription && (
                                    <div className="mt-1.5 text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5 leading-relaxed">
                                        {v.modifierDescription}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {/* Modifiers / Deviations / Risks */}
                {allModifiers.length > 0 && (
                    <div>
                        <div className="text-[10px] text-slate-500 mb-1.5">Active Modifiers</div>
                        <div className="flex flex-wrap gap-1">
                            {allModifiers.map((m, i) => (
                                <span
                                    key={i}
                                    title={m.description}
                                    className="rounded-full border border-cyan-700/40 bg-cyan-950/20 px-2 py-px text-[10px] text-cyan-300 cursor-default"
                                >
                                    {m.tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Missions tab ──────────────────────────────────────────────────────────────

function MissionsTab({ data }: { data: WorldStateData }) {
    const now = useWorldStateNow();
    const activeArchs = data.archimedeas.filter((a) => !a.expired);
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Sortie */}
            {data.sortie && isWorldStateEntryActive(data.sortie, now) && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40">
                        <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Daily Sortie</div>
                        <div className="text-[10px] text-slate-500">
                            Resets <Countdown expiry={data.sortie.expiry} now={now} className="font-mono text-slate-400" />
                        </div>
                    </div>
                    <div className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
                            <span className={[FACTION_COLORS[data.sortie.faction] ?? "text-slate-300", "font-semibold"].join(" ")}>
                                {data.sortie.faction}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400">{data.sortie.boss}</span>
                            {data.sortie.rewardPool && (
                                <span className="rounded-full border border-amber-700/50 bg-amber-950/30 px-1.5 py-px text-[10px] text-amber-300">
                                    {data.sortie.rewardPool}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            {data.sortie.variants.map((v, i) => (
                                <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <div className="text-xs font-medium text-slate-200">{v.missionType}</div>
                                            <div className="text-[10px] text-slate-500">{v.node}</div>
                                        </div>
                                        {v.modifier && (
                                            <span className="shrink-0 rounded-full border border-orange-700/50 bg-orange-950/20 px-1.5 py-px text-[10px] text-orange-300">
                                                {v.modifier}
                                            </span>
                                        )}
                                    </div>
                                    {v.modifierDescription && (
                                        <div className="mt-1.5 text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5 leading-relaxed">
                                            {v.modifierDescription}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Archon Hunt */}
            {data.archonHunt && isWorldStateEntryActive(data.archonHunt, now) && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40">
                        <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Weekly Archon Hunt</div>
                        <div className="text-[10px] text-slate-500">
                            Resets <Countdown expiry={data.archonHunt.expiry} now={now} className="font-mono text-slate-400" />
                        </div>
                    </div>
                    <div className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
                            <span className={[FACTION_COLORS[data.archonHunt.faction] ?? "text-slate-300", "font-semibold"].join(" ")}>
                                {data.archonHunt.faction}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400">{data.archonHunt.boss}</span>
                        </div>
                        <div className="space-y-1.5">
                            {data.archonHunt.missions.map((m, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2">
                                    <span className="w-5 h-5 shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <div className="text-xs font-medium text-slate-200">{m.type}</div>
                                        <div className="text-[10px] text-slate-500">{m.node}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Nightwave challenges */}
            {/* Archimedeas */}
            {activeArchs.map((arch) => (
                <ArchimedeaCard key={arch.id} arch={arch} now={now} />
            ))}

            {/* Arbitration */}
            {data.arbitration && isWorldStateEntryActive(data.arbitration, now) && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40">
                        <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Arbitration</div>
                        <div className="text-[10px] text-slate-500">
                            Rotates <Countdown expiry={data.arbitration.expiry} now={now} className="font-mono text-slate-400" />
                        </div>
                    </div>
                    <div className="p-3 flex items-center gap-3">
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-200">{data.arbitration.type}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{data.arbitration.node}</div>
                            <div className={["text-[10px] font-medium mt-0.5", FACTION_COLORS[data.arbitration.enemy] ?? "text-slate-400"].join(" ")}>
                                {data.arbitration.enemy}
                            </div>
                        </div>
                        {data.arbitration.isSteel && (
                            <span className="ml-auto shrink-0 rounded-full border border-red-700/50 bg-red-950/20 px-2 py-px text-[10px] font-bold text-red-300">SP</span>
                        )}
                    </div>
                </div>
            )}

            {/* Kuva Siphons & Floods */}
            {data.kuva.filter((mission) => isWorldStateEntryActive(mission, now)).length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden lg:col-span-2">
                    <div className="px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40">
                        <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Live Kuva Missions</div>
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {data.kuva.filter((mission) => isWorldStateEntryActive(mission, now)).map((k, i) => (
                            <div key={i} className={[
                                "rounded-lg border px-2.5 py-2",
                                k.isFlood
                                    ? "border-violet-800/40 bg-violet-950/10"
                                    : "border-slate-800 bg-slate-900/40",
                            ].join(" ")}>
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <span className={["text-xs font-medium", k.isFlood ? "text-violet-300" : "text-slate-200"].join(" ")}>
                                                {k.isFlood ? "Kuva Flood" : "Kuva Siphon"}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">{k.node}</div>
                                        <div className="text-[10px] text-slate-400">{k.type}</div>
                                    </div>
                                    <Countdown expiry={k.expiry} now={now} className="shrink-0 font-mono text-[10px] text-slate-400 text-right" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

// ── Nightwave section (with optimizer) ────────────────────────────────────────

const NIGHTWAVE_RANK_COST = 10_000;         // standing per rank
const NORA_CREDS_PER_PRESTIGE_RANK = 15;   // creds per prestige rank (ranks 31+); ranks 1–30 vary by season

function NightwaveSection({ nightwave }: { nightwave: Nightwave }) {
    const now = useWorldStateNow();
    const activeChallenges = getCurrentNightwaveChallenges(nightwave, now);
    const toggleNightwaveChallengeDone = useTrackerStore((s) => s.toggleNightwaveChallengeDone);
    const doneNightwaveChallenges = useTrackerStore((s) => s.state.worldState?.doneNightwaveChallenges ?? EMPTY_COMPLETION_IDS);
    const isNightwaveChallengeDone = (id: string) => doneNightwaveChallenges.includes(id);
    const [showOptimizer, setShowOptimizer] = useState(false);

    const sorted = activeChallenges.slice().sort((a, b) => {
        const aDone = isNightwaveChallengeDone(a.id) ? 1 : 0;
        const bDone = isNightwaveChallengeDone(b.id) ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        if (a.isElite !== b.isElite) return a.isElite ? -1 : 1;
        if (a.isPermanent !== b.isPermanent) return a.isPermanent ? 1 : -1;
        if (a.isDaily !== b.isDaily) return a.isDaily ? 1 : -1;
        return b.reputation - a.reputation;
    });

    const doneCount = sorted.filter((act) => isNightwaveChallengeDone(act.id)).length;
    const totalRep  = sorted.reduce((sum, act) => sum + act.reputation, 0);
    const earnedRep = sorted.filter((act) => isNightwaveChallengeDone(act.id)).reduce((sum, act) => sum + act.reputation, 0);

    // Optimizer: undone acts sorted by rep descending (highest value first)
    const undoneByRep = sorted
        .filter((a) => !isNightwaveChallengeDone(a.id))
        .sort((a, b) => b.reputation - a.reputation);
    const potentialRep   = undoneByRep.reduce((s, a) => s + a.reputation, 0);
    const potentialPrestigeCreds = Math.floor(potentialRep / NIGHTWAVE_RANK_COST) * NORA_CREDS_PER_PRESTIGE_RANK;

    return (
        <section>
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40">
                    <div>
                        <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                            Nightwave — Season {nightwave.season}
                            {nightwave.tag && <span className="normal-case font-normal text-slate-400 ml-1">· {nightwave.tag}</span>}
                        </div>
                        {nightwave.phase > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">Phase {nightwave.phase + 1}</div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowOptimizer((v) => !v)}
                            className={[
                                "text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border transition-colors",
                                showOptimizer
                                    ? "border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50"
                                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-600",
                            ].join(" ")}
                            title="Show acts sorted by reputation to maximise Nora's Creds"
                        >
                            {showOptimizer ? "All Acts" : "Optimize"}
                        </button>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-500">
                                Ends <Countdown expiry={nightwave.expiry} now={now} className="font-mono text-slate-400" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-3">
                    {showOptimizer ? (
                        /* ── Optimizer view ── */
                        <div>
                            {/* Summary row */}
                            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
                                <span className="text-slate-500">{undoneByRep.length} acts remaining · {potentialRep.toLocaleString()} rep available</span>
                                <span className="font-semibold text-amber-300">
                                    ≈ {potentialPrestigeCreds} Nora's Creds (prestige rate)
                                </span>
                                <span className="text-slate-600 italic">(15 creds/rank for prestige ranks 31+ · ranks 1–30 vary by season)</span>
                            </div>
                            {undoneByRep.length === 0 ? (
                                <div className="text-xs text-slate-500 italic">All acts completed.</div>
                            ) : (
                                <div className="space-y-0">
                                    {(() => {
                                        let cumulative = 0;
                                        const rows: React.ReactNode[] = [];
                                        undoneByRep.forEach((act, idx) => {
                                            const prevCumulative = cumulative;
                                            cumulative += act.reputation;
                                            // Insert rank-up marker whenever we cross a 10k boundary
                                            const ranksBefore = Math.floor(prevCumulative / NIGHTWAVE_RANK_COST);
                                            const ranksAfter  = Math.floor(cumulative / NIGHTWAVE_RANK_COST);
                                            if (ranksAfter > ranksBefore) {
                                                for (let r = ranksBefore + 1; r <= ranksAfter; r++) {
                                                    rows.push(
                                                        <div key={`rank-${r}`} className="flex items-center gap-2 py-1 my-0.5">
                                                            <div className="flex-1 h-px bg-amber-800/40" />
                                                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-400 px-1.5 py-0.5 rounded border border-amber-700/40 bg-amber-950/30">
                                                                Rank up → +{NORA_CREDS_PER_PRESTIGE_RANK} Nora's Creds (prestige)
                                                            </span>
                                                            <div className="flex-1 h-px bg-amber-800/40" />
                                                        </div>
                                                    );
                                                }
                                            }
                                            rows.push(
                                                <div key={act.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-800/40 transition-colors">
                                                    <span className="text-[10px] font-mono text-slate-600 w-4 shrink-0">{idx + 1}.</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            {act.isElite && <span className="rounded border border-amber-700/50 bg-amber-950/30 px-1 py-px text-[9px] font-bold text-amber-300">ELITE</span>}
                                                            {act.isDaily && !act.isPermanent && <span className="rounded border border-sky-700/50 bg-sky-950/30 px-1 py-px text-[9px] font-bold text-sky-300">DAILY</span>}
                                                            {!act.isDaily && !act.isElite && !act.isPermanent && <span className="rounded border border-slate-700 bg-slate-800/60 px-1 py-px text-[9px] font-bold text-slate-400">WEEKLY</span>}
                                                            <span className="text-xs font-medium text-slate-200">{act.title}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate">{act.desc}</div>
                                                    </div>
                                                    <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                                                        <span className="text-xs font-bold text-blue-300">{act.reputation.toLocaleString()}</span>
                                                        <span className="text-[9px] text-slate-600 font-mono">{cumulative.toLocaleString()} total</span>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleNightwaveChallengeDone(act.id)}
                                                        className="shrink-0 text-[9px] text-slate-600 hover:text-green-400 transition-colors px-0.5"
                                                        title="Mark as done"
                                                    >✓</button>
                                                </div>
                                            );
                                        });
                                        return rows;
                                    })()}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── Normal view ── */
                        <div>
                            <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                                <span>{doneCount}/{sorted.length} completed · {earnedRep.toLocaleString()}/{totalRep.toLocaleString()} rep earned</span>
                                {doneCount > 0 && (
                                    <button
                                        className="text-slate-600 hover:text-slate-400 transition-colors"
                                        onClick={() => sorted.filter((a) => isNightwaveChallengeDone(a.id)).forEach((a) => toggleNightwaveChallengeDone(a.id))}
                                    >
                                        Clear all
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {sorted.map((act) => {
                                    const done = isNightwaveChallengeDone(act.id);
                                    return (
                                        <div key={act.id} className={["rounded-lg border px-2.5 py-2 transition-colors", done ? "border-emerald-900/40 bg-emerald-950/10 opacity-60" : "border-slate-800 bg-slate-900/40"].join(" ")}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex items-start gap-1.5">
                                                    {done ? <span className="text-green-500 text-xs shrink-0 mt-0.5">✓</span> : null}
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-1 mb-0.5">
                                                            {act.isElite && <span className="rounded border border-amber-700/50 bg-amber-950/30 px-1 py-px text-[9px] font-bold text-amber-300">ELITE</span>}
                                                            {act.isPermanent && <span className="rounded border border-teal-700/50 bg-teal-950/30 px-1 py-px text-[9px] font-bold text-teal-300">STANDING</span>}
                                                            {act.isDaily && !act.isPermanent && <span className="rounded border border-sky-700/50 bg-sky-950/30 px-1 py-px text-[9px] font-bold text-sky-300">DAILY</span>}
                                                            {!act.isDaily && !act.isElite && !act.isPermanent && <span className="rounded border border-slate-700 bg-slate-800/60 px-1 py-px text-[9px] font-bold text-slate-400">WEEKLY</span>}
                                                            <span className={["text-xs font-medium", done ? "line-through text-slate-500" : "text-slate-200"].join(" ")}>{act.title}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">{act.desc}</div>
                                                        {!act.isPermanent && act.expiry && (
                                                            <div className="text-[10px] text-slate-600 mt-0.5">
                                                                <Countdown expiry={act.expiry} now={now} className="font-mono" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right flex flex-col items-end gap-1">
                                                    <div className={["text-xs font-bold", done ? "text-emerald-600 line-through" : "text-blue-300"].join(" ")}>{act.reputation.toLocaleString()}</div>
                                                    <div className="text-[9px] text-slate-500">rep</div>
                                                    <button
                                                        onClick={() => toggleNightwaveChallengeDone(act.id)}
                                                        className={["text-[9px] transition-colors px-0.5", done ? "text-slate-700 hover:text-slate-400" : "text-slate-600 hover:text-green-400"].join(" ")}
                                                        title={done ? "Mark as not done" : "Mark as done"}
                                                    >{done ? "✕" : "✓"}</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

// ── Activities tab ────────────────────────────────────────────────────────────

function ActivitiesTab({ data }: { data: WorldStateData }) {
    const now = useWorldStateNow();
    const activitySummary = getCurrentWorldActivitySummary(data, now);
    const currentAlerts = activitySummary.alerts;
    const currentEvents = activitySummary.events;
    const currentNightwaveChallenges = activitySummary.nightwave;
    const processedInvasions = activitySummary.invasions;
    const hasNightwave = currentNightwaveChallenges.length > 0;
    const hasEvents    = currentEvents.length > 0;
    const hasInvasions = processedInvasions.length > 0;
    const hasAcolytes  = data.persistentEnemies.length > 0;
    const toggleInvasionDone           = useTrackerStore((s) => s.toggleInvasionDone);
    const doneInvasions = useTrackerStore((s) => s.state.worldState?.doneInvasions ?? EMPTY_COMPLETION_IDS);
    const toggleEventInstanceDone = useTrackerStore((s) => s.toggleEventInstanceDone);
    const doneEventInstances = useTrackerStore((s) => s.state.worldState?.doneEventInstances ?? EMPTY_COMPLETION_IDS);
    const hiddenWorldStateCategories = useTrackerStore((s) => s.state.ui.hiddenWorldStateCategories ?? EMPTY_COMPLETION_IDS);
    const isInvasionDone = (id: string) => doneInvasions.includes(id);

    return (
        <div className="space-y-4">
            {/* Nightwave challenges */}
            {hasNightwave && data.nightwave && <NightwaveSection nightwave={{ ...data.nightwave, activeChallenges: currentNightwaveChallenges }} />}

            {/* Alert missions are globally available; the API does not report personal completion. */}
            {currentAlerts.length > 0 && !hiddenWorldStateCategories.includes("alerts" as any) && (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Alerts ({currentAlerts.length})</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentAlerts.map((alert) => (
                            <article key={alert.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium text-slate-200">{alert.description || alert.missionType || "Alert mission"}</div>
                                        <div className="mt-0.5 text-[10px] text-slate-400">{alert.missionType}{alert.node ? ` · ${alert.node}` : ""}{alert.faction ? ` · ${alert.faction}` : ""}</div>
                                        {alert.minEnemyLevel != null && <div className="text-[10px] text-slate-500">Enemy level {alert.minEnemyLevel}–{alert.maxEnemyLevel ?? alert.minEnemyLevel}</div>}
                                    </div>
                                    {alert.expiry && <Countdown expiry={alert.expiry} now={now} className="shrink-0 font-mono text-[10px] text-slate-400" />}
                                </div>
                                {(alert.reward || alert.credits > 0 || alert.items.length > 0) && (
                                    <div className="mt-1.5 text-[10px] text-amber-300/80">{alert.reward || [...alert.items, ...(alert.credits ? [`${alert.credits.toLocaleString()} Credits`] : [])].join(", ")}</div>
                                )}
                                <div className="mt-1 text-[9px] text-slate-600">World State availability; completion is not reported by the API.</div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {/* Active Events */}
            {hasEvents && (() => {
                const sortedEvs = currentEvents.slice().sort((a, b) => {
                    const aKey = eventCompletionKey(a);
                    const bKey = eventCompletionKey(b);
                    const aDone = aKey && doneEventInstances.includes(aKey) ? 1 : 0;
                    const bDone = bKey && doneEventInstances.includes(bKey) ? 1 : 0;
                    return aDone - bDone;
                });
                return (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Active Events ({currentEvents.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sortedEvs.map((ev) => {
                            const completionKey = eventCompletionKey(ev);
                            const done = completionKey != null && doneEventInstances.includes(completionKey);
                            const title = ev.description || ev.tooltip || "Active Event";
                            const subtitle = ev.tooltip && ev.description && ev.tooltip !== ev.description ? ev.tooltip : null;
                            const location = ev.node || ev.victimNode;
                            const hasProgress = ev.currentScore != null && ev.maximumScore != null && ev.maximumScore > 0;
                            const pct = hasProgress ? Math.min(100, (ev.currentScore! / ev.maximumScore!) * 100) : null;
                            return (
                                <div key={ev.id} className={["rounded-xl border px-3 py-2.5 transition-colors", done ? "border-emerald-900/40 bg-emerald-950/10 opacity-60" : "border-slate-800 bg-slate-900/40"].join(" ")}>
                                    {/* Header: title + countdown + done toggle */}
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-start gap-1.5 min-w-0">
                                            {done && <span className="text-green-500 text-xs shrink-0 mt-0.5">✓</span>}
                                            <div className="min-w-0">
                                                <div className={["text-xs font-medium leading-tight", done ? "line-through text-slate-500" : "text-slate-200"].join(" ")}>{title}</div>
                                                {subtitle && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>
                                                )}
                                                {(ev.isPersonal || ev.isCommunity) && (
                                                    <div className="text-[9px] text-cyan-400/70 mt-0.5">
                                                        {ev.isPersonal && ev.isCommunity ? "Personal and community progress" : ev.isPersonal ? "Personal progress" : "Community progress"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {ev.expiry && (
                                                <Countdown expiry={ev.expiry} now={now} className="font-mono text-[10px] text-slate-400" />
                                            )}
                                            {completionKey && <button
                                                onClick={() => toggleEventInstanceDone(completionKey)}
                                                className={["text-[9px] transition-colors px-0.5", done ? "text-slate-700 hover:text-slate-400" : "text-slate-600 hover:text-green-400"].join(" ")}
                                                title={done ? "Remove personal completion" : "Mark personally completed"}
                                            >{done ? "✕" : "✓"}</button>}
                                        </div>
                                    </div>

                                    {/* Location */}
                                    {location && (
                                        <div className="text-[10px] text-slate-500 mb-1">
                                            {ev.affiliatedWith && <span className="text-slate-400">{ev.affiliatedWith} · </span>}
                                            {location}
                                        </div>
                                    )}

                                    {/* Score progress bar (e.g. Thermia Fractures) */}
                                    {hasProgress && (
                                        <div className="mb-1.5">
                                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                                <span>{ev.scoreLocTag || "Progress"}</span>
                                                <span className="font-mono">{ev.currentScore!.toLocaleString()} / {ev.maximumScore!.toLocaleString()}</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Health bar (e.g. Ghoul Purge) */}
                                    {!hasProgress && ev.health != null && (
                                        <div className="mb-1.5">
                                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                                <span>Progress</span>
                                                <span className="font-mono">{ev.health.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${Math.min(100, ev.health)}%` }} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Final rewards */}
                                    {ev.rewards.length > 0 && (
                                        <div className="text-[10px] text-amber-300/80 leading-snug">
                                            {ev.rewards.map((r, i) => <span key={i}>{i > 0 ? " · " : ""}{r.asString}</span>)}
                                        </div>
                                    )}

                                    {/* Interim milestone rewards */}
                                    {ev.interimSteps.length > 0 && (
                                        <div className="mt-1.5 space-y-0.5 border-t border-slate-800/60 pt-1.5">
                                            {ev.interimSteps.map((step, i) => (
                                                <div key={i} className="flex items-baseline gap-1.5 text-[10px]">
                                                    <span className="shrink-0 font-mono text-slate-500">@{step.goal}</span>
                                                    <span className="text-slate-400">{step.reward.asString}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
                );
            })()}

            {/* Invasions */}
            {hasInvasions && (() => {
                const sorted = processedInvasions.slice().sort((a, b) => {
                    const aDone = isInvasionDone(a.id) ? 1 : 0;
                    const bDone = isInvasionDone(b.id) ? 1 : 0;
                    return aDone - bDone;
                });
                const doneCount = sorted.filter((inv) => isInvasionDone(inv.id)).length;
                return (
                    <section>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Invasions ({sorted.length}
                            {doneCount > 0 && <span className="text-green-500/80"> · {doneCount} done</span>})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sorted.map((inv) => {
                                const done = isInvasionDone(inv.id);
                                const runsCompleted = Math.abs(inv.count);
                                const pct = inv.requiredRuns > 0 ? (runsCompleted / inv.requiredRuns * 100) : inv.completion;
                                if (done) {
                                    return (
                                        <div key={inv.id} className="rounded-xl border border-green-900/40 bg-green-950/10 px-3 py-2 flex items-center gap-2">
                                            <span className="text-green-500 text-sm shrink-0">✓</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs text-slate-500 truncate">{inv.displayLabel}</span>
                                                    <span className="shrink-0 font-mono text-[10px] text-slate-600">{pct.toFixed(1)}%</span>
                                                    {inv.requiredRuns > 0 && (
                                                        <span className="shrink-0 font-mono text-[10px] text-slate-600">
                                                            {runsCompleted.toLocaleString()}/{inv.requiredRuns.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                                                    <div
                                                        className={["h-full rounded-full opacity-40", inv.vsInfestation ? "bg-green-600" : "bg-red-600"].join(" ")}
                                                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleInvasionDone(inv.id)}
                                                className="shrink-0 text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-1"
                                                title="Mark as not done"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={inv.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <div className="text-xs font-medium text-slate-200 min-w-0">{inv.displayLabel}</div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="font-mono text-[10px] text-slate-400">{pct.toFixed(1)}%</span>
                                                {inv.requiredRuns > 0 && (
                                                    <span className="font-mono text-[10px] text-slate-500">
                                                        {runsCompleted.toLocaleString()}/{inv.requiredRuns.toLocaleString()}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => toggleInvasionDone(inv.id)}
                                                    className="text-[10px] text-slate-600 hover:text-green-400 transition-colors px-1 py-0.5 rounded border border-transparent hover:border-green-800/50"
                                                    title="Mark as done"
                                                >
                                                    ✓
                                                </button>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                                            <div
                                                className={["h-full rounded-full", inv.vsInfestation ? "bg-green-600/70" : "bg-red-600/70"].join(" ")}
                                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                            />
                                        </div>
                                        {/* Attacker vs Defender with rewards */}
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-1 text-[10px]">
                                            <div>
                                                <div className={["font-semibold flex items-center gap-1", FACTION_COLORS[inv.attackingFaction] ?? "text-slate-400"].join(" ")}>
                                                    {inv.isAttackerWinning && <span title="Winning">▲</span>}
                                                    {inv.attackingFaction}
                                                </div>
                                                {inv.attackerReward?.asString
                                                    ? <div className="text-amber-300/80 mt-0.5 leading-tight">{inv.attackerReward.asString}</div>
                                                    : inv.rewardTypes.length > 0 && <div className="text-slate-500 mt-0.5">{inv.rewardTypes.join(", ")}</div>
                                                }
                                            </div>
                                            <div className="text-slate-600 pt-0.5 text-center">vs</div>
                                            <div className="text-right">
                                                <div className={["font-semibold flex items-center justify-end gap-1", FACTION_COLORS[inv.defendingFaction] ?? "text-slate-400"].join(" ")}>
                                                    {inv.defendingFaction}
                                                    {!inv.isAttackerWinning && <span title="Winning">▲</span>}
                                                </div>
                                                {inv.defenderReward?.asString && (
                                                    <div className="text-amber-300/80 mt-0.5 leading-tight">{inv.defenderReward.asString}</div>
                                                )}
                                            </div>
                                        </div>
                                        {inv.desc && (
                                            <div className="text-[10px] text-slate-500 mt-1.5 border-t border-slate-800/60 pt-1">{inv.desc}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })()}

            {/* Acolytes */}
            {hasAcolytes && (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Acolytes ({data.persistentEnemies.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.persistentEnemies.map((enemy, i) => (
                            <div key={i} className={[
                                "rounded-xl border px-3 py-2.5",
                                enemy.isDiscovered
                                    ? "border-rose-800/50 bg-rose-950/10"
                                    : "border-slate-800 bg-slate-900/40",
                            ].join(" ")}>
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={["w-2 h-2 rounded-full shrink-0", enemy.isDiscovered ? "bg-rose-400" : "bg-slate-600"].join(" ")} />
                                            <span className="text-xs font-semibold text-slate-200">{enemy.agentType}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {enemy.isDiscovered ? `Last seen: ${enemy.lastDiscoveredAt}` : "Not yet located"}
                                        </div>
                                        {enemy.region && (
                                            <div className="text-[10px] text-slate-500">{enemy.region}</div>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs font-bold text-rose-300">{enemy.healthPercent.toFixed(1)}%</div>
                                        <div className="text-[9px] text-slate-500">health</div>
                                        {enemy.rank > 0 && (
                                            <div className="text-[10px] text-slate-500 mt-0.5">Rank {enemy.rank}</div>
                                        )}
                                    </div>
                                </div>
                                {enemy.healthPercent > 0 && (
                                    <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-rose-600/70 rounded-full"
                                            style={{ width: `${Math.min(100, enemy.healthPercent)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {!hasNightwave && !hasEvents && !hasInvasions && !hasAcolytes && (
                <div className="py-8 text-center text-sm text-slate-500">No active events, invasions, or Nightwave acts.</div>
            )}
        </div>
    );
}

// ── Traders tab ───────────────────────────────────────────────────────────────

function TradersTab({ data }: { data: WorldStateData }) {
    const now = useWorldStateNow();
    const [baroSearch, setBaroSearch] = useState("");
    const [varziaSearch, setVarziaSearch] = useState("");
    const baroActive = data.voidTrader ? isWorldStateEntryActive(data.voidTrader, now) : false;
    const varziaActive = data.vaultTrader ? isWorldStateEntryActive(data.vaultTrader, now) : false;
    const currentFlashSales = data.flashSales.filter((sale) => isWorldStateEntryActive(sale, now));

    return (
        <div className="space-y-4">
            {/* Baro Ki'Teer */}
            <section>
                <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                    <div className={[
                        "flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60",
                        baroActive ? "bg-amber-950/20" : "bg-slate-900/40",
                    ].join(" ")}>
                        <div>
                            <div className={["text-xs font-semibold uppercase tracking-wide", baroActive ? "text-amber-300" : "text-slate-200"].join(" ")}>
                                {baroActive ? "● Baro Ki'Teer — Here Now" : "Baro Ki'Teer"}
                            </div>
                            {data.voidTrader && (
                                <div className="text-[10px] text-slate-500 mt-0.5">{data.voidTrader.location}</div>
                            )}
                        </div>
                        {data.voidTrader && (
                            <div className="text-[10px] text-slate-500 text-right">
                                {baroActive
                                    ? <>Leaves <Countdown expiry={data.voidTrader.expiry} now={now} className="font-mono text-slate-400" /></>
                                    : new Date(data.voidTrader.activation).getTime() > now
                                        ? <>Arrives <Countdown expiry={data.voidTrader.activation} now={now} className="font-mono text-slate-400" /></>
                                        : null
                                }
                            </div>
                        )}
                    </div>
                    <div className="p-3">
                        {baroActive && data.voidTrader?.inventory.length ? (() => {
                            const allItems = data.voidTrader.inventory;
                            const q = baroSearch.trim().toLowerCase();
                            const filtered = q ? allItems.filter((it) => it.item.toLowerCase().includes(q)) : allItems;
                            const freeItems    = allItems.filter((it) => it.ducats === 0).length;
                            const totalDucats  = allItems.reduce((s, it) => s + it.ducats, 0);
                            const totalCredits = allItems.reduce((s, it) => s + it.credits, 0);
                            return (
                                <>
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                            <span>{allItems.length} items</span>
                                            {freeItems > 0 && (
                                                <span className="rounded border border-green-600/60 bg-green-900/30 px-1.5 py-px text-[9px] font-bold text-green-300">
                                                    {freeItems} FREE
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            <span className="text-amber-400">{totalDucats.toLocaleString()} duc</span>
                                            <span className="text-slate-600 mx-1">+</span>
                                            <span className="text-yellow-300">{totalCredits.toLocaleString()} cr</span>
                                            <span className="text-slate-600 ml-1">total</span>
                                        </div>
                                    </div>
                                    <input
                                        className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-700/60"
                                        placeholder="Filter Baro's inventory…"
                                        value={baroSearch}
                                        onChange={(e) => setBaroSearch(e.target.value)}
                                    />
                                    {filtered.length === 0 ? (
                                        <div className="text-xs text-slate-500 py-2">No items match "{baroSearch}".</div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                            {filtered.map((item, i) => {
                                                const free = item.ducats === 0;
                                                return (
                                                    <div key={i} className={[
                                                        "rounded-xl border px-3 py-2 flex items-center justify-between gap-2",
                                                        free
                                                            ? "border-green-700/50 bg-green-950/20"
                                                            : "border-amber-800/30 bg-amber-950/10",
                                                    ].join(" ")}>
                                                        <div className={["text-xs truncate min-w-0", free ? "text-green-200 font-medium" : "text-slate-200"].join(" ")}>{item.item}</div>
                                                        <div className="shrink-0 text-right text-[10px] whitespace-nowrap">
                                                            {free
                                                                ? <span className="rounded border border-green-600/60 bg-green-900/40 px-1 py-px text-[9px] font-bold text-green-300 mr-1">FREE</span>
                                                                : <><span className="text-amber-300">{item.ducats.toLocaleString()} duc</span><span className="text-slate-600 mx-0.5">+</span></>
                                                            }
                                                            <span className="text-yellow-200">{item.credits.toLocaleString()} cr</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            );
                        })() : (
                            <div className="text-xs text-slate-500 py-2 text-center">
                                {data.voidTrader ? "Baro is away — check back when he arrives." : "No Void Trader data."}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Varzia (Primed Resurgence) */}
            {data.vaultTrader && (
                <section>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                        <div className={[
                            "flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60",
                            varziaActive ? "bg-violet-950/20" : "bg-slate-900/40",
                        ].join(" ")}>
                            <div>
                                <div className={["text-xs font-semibold uppercase tracking-wide", varziaActive ? "text-violet-300" : "text-slate-200"].join(" ")}>
                                    {varziaActive ? "● Varzia — Active" : "Varzia"} · Primed Resurgence
                                </div>
                                {data.vaultTrader.location && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">{data.vaultTrader.location}</div>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                                {varziaActive
                                    ? <>Ends <Countdown expiry={data.vaultTrader.expiry} now={now} className="font-mono text-slate-400" /></>
                                    : data.vaultTrader.activation && new Date(data.vaultTrader.activation).getTime() > now
                                        ? <>Returns <Countdown expiry={data.vaultTrader.activation} now={now} className="font-mono text-slate-400" /></>
                                        : null
                                }
                            </div>
                        </div>
                        <div className="p-3">
                            {varziaActive && data.vaultTrader.inventory.length > 0 ? (() => {
                                const allItems = data.vaultTrader.inventory;
                                const q = varziaSearch.trim().toLowerCase();
                                const filtered = q ? allItems.filter((it) => it.item.toLowerCase().includes(q)) : allItems;
                                const discountedItems = allItems.filter((it) => (it.discount ?? 0) > 0).length;
                                const totalRegalAya = allItems.reduce((s, it) => s + (it.ducats ?? 0), 0);
                                const totalAya = allItems.reduce((s, it) => s + (it.credits ?? 0), 0);

                                return (
                                    <>
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                <span>{allItems.length} items</span>
                                                {discountedItems > 0 && (
                                                    <span
                                                        className="rounded border border-cyan-600/60 bg-cyan-900/30 px-1.5 py-px text-[9px] font-bold text-cyan-300"
                                                        title="These items currently have a discount in Varzia's shop"
                                                    >
                                                        {discountedItems} DISCOUNTED
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                {totalRegalAya > 0 && <span className="text-fuchsia-300">{totalRegalAya.toLocaleString()} Regal Aya</span>}
                                                {totalRegalAya > 0 && totalAya > 0 && <span className="text-slate-600 mx-1">+</span>}
                                                {totalAya > 0 && <span className="text-amber-300">{totalAya.toLocaleString()} Aya</span>}
                                                {(totalRegalAya > 0 || totalAya > 0) && <span className="text-slate-600 ml-1">total</span>}
                                            </div>
                                        </div>
                                        <input
                                            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-700/60"
                                            placeholder="Filter Varzia's inventory…"
                                            value={varziaSearch}
                                            onChange={(e) => setVarziaSearch(e.target.value)}
                                        />
                                        {filtered.length === 0 ? (
                                            <div className="text-xs text-slate-500 py-2">No items match "{varziaSearch}".</div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                                {filtered.map((item, i) => {
                                                    const discounted = (item.discount ?? 0) > 0;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={[
                                                                "rounded-xl border px-3 py-2 flex items-center justify-between gap-2",
                                                                discounted
                                                                        ? "border-cyan-700/50 bg-cyan-950/20"
                                                                        : "border-violet-800/30 bg-violet-950/10",
                                                            ].join(" ")}
                                                        >
                                                            <div className="text-xs truncate min-w-0 text-slate-200">{item.item}</div>
                                                            <div className="shrink-0 text-right text-[10px] whitespace-nowrap">
                                                                {(item.ducats ?? 0) > 0 && (
                                                                    <>
                                                                        <span className="text-fuchsia-300">{item.ducats?.toLocaleString()} Regal Aya</span>
                                                                        {(item.credits ?? 0) > 0 && <span className="text-slate-600 mx-0.5">+</span>}
                                                                    </>
                                                                )}
                                                                {(item.credits ?? 0) > 0 && <span className="text-amber-200">{item.credits?.toLocaleString()} Aya</span>}
                                                                {discounted && (
                                                                    <span
                                                                        className="ml-1 rounded border border-cyan-600/60 bg-cyan-900/40 px-1 py-px text-[9px] font-bold text-cyan-300"
                                                                        title={`Discounted ${item.discount}%`}
                                                                    >
                                                                        -{item.discount}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                );
                            })() : (
                                <div className="text-xs text-slate-500 py-2 text-center">
                                    {varziaActive ? "No inventory available." : "Varzia is not currently active."}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {!data.voidTrader && !data.vaultTrader && (
                <div className="py-8 text-center text-sm text-slate-500">No trader data available.</div>
            )}

            {currentFlashSales.length > 0 && (
                <section>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Store Offers ({currentFlashSales.length})</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {currentFlashSales.slice(0, 6).map((sale, index) => (
                            <div key={String(sale.id ?? index)} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
                                <div className="text-xs font-medium text-slate-200">{String(sale.item ?? "Store offer")}</div>
                                <div className="mt-1 text-[10px] text-slate-500">Limited availability · platform pricing may vary</div>
                                {typeof sale.expiry === "string" && <div className="mt-1 text-[10px] text-slate-500">Ends in <Countdown expiry={sale.expiry} now={now} className="font-mono text-slate-400" /></div>}
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorldState() {
    const now = useWorldStateNow();
    const snapshot = useWorldStateSnapshot();
    const { data, fetchedAt, isLoading, isRefreshing, error } = snapshot;
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const loadState = !data ? (isLoading ? "loading" : "error") : "ok";
    const refresh = () => { void fetchWorldState(true).catch(() => {}); };

    const activeFissures = data?.fissures.filter((f) => isWorldStateEntryActive(f, now) && !f.isHard).length ?? 0;
    const activeActivities = getCurrentWorldActivitySummary(data, now).total;
    const traderInventory = data?.voidTrader && isWorldStateEntryActive(data.voidTrader, now) ? data.voidTrader.inventory.length : 0;

    return (
        <div className="flex flex-col gap-4 pb-4">
            <WorkspaceHero
                eyebrow="Command Workspace"
                title="World State"
                description="Live cycles, missions, fissures, and events from warframestat.us, organized so you can scan the state of the game before deciding what to do next."
                actions={
                    <>
                        {fetchedAt && (
                            <span className="text-[11px] text-[color:var(--wf-text-dim)]">
                                Fetched {new Date(fetchedAt).toLocaleTimeString()}
                                {data?.apiTimestamp ? ` · API ${new Date(data.apiTimestamp).toLocaleTimeString()}` : ""}
                            </span>
                        )}
                        <WorkspaceAction
                            onClick={refresh}
                            className="inline-flex items-center gap-1.5 text-xs disabled:opacity-40"
                        >
                            <svg
                                className={["h-3.5 w-3.5", isLoading || isRefreshing ? "animate-spin" : ""].join(" ")}
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round"
                            >
                                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" />
                            </svg>
                            {isLoading || isRefreshing ? "Refreshing…" : "Refresh"}
                        </WorkspaceAction>
                    </>
                }
                stats={
                    <>
                        <WorkspaceStat
                            label="Intel status"
                            value={error ? "Stale" : loadState === "ok" ? "Live" : loadState === "loading" ? "Syncing" : "Retrying"}
                            hint={data?.buildLabel ? `Warframe ${data.buildLabel}; shared five-minute refresh.` : "Shared five-minute refresh cadence."}
                        />
                        <WorkspaceStat
                            label="Active fissures"
                            value={activeFissures}
                            hint="Standard fissures currently available for relic cracking."
                        />
                        <WorkspaceStat
                            label="Activities"
                            value={activeActivities}
                            hint="Current alerts, events, Nightwave acts, and open invasions."
                        />
                        <WorkspaceStat
                            label="Trader stock"
                            value={traderInventory}
                            hint="Void Trader inventory lines if Baro is currently present."
                        />
                    </>
                }
            />

            {/* Loading (first load) */}
            {loadState === "loading" && !data && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" />
                    </svg>
                    Fetching world state…
                </div>
            )}

            {/* Error */}
            {loadState === "error" && (
                <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-4 text-xs text-rose-300 space-y-2">
                    <div className="font-semibold">Failed to load world state</div>
                    <p className="text-rose-400/80">{error}</p>
                    <p className="text-rose-500">The warframestat.us API may be temporarily unavailable.</p>
                    <button
                        onClick={refresh}
                        className="rounded-lg border border-rose-700/50 px-3 py-1.5 text-[11px] text-rose-300 hover:bg-rose-950/40 transition-colors"
                    >
                        Try again
                    </button>
                </div>
            )}

            {error && data && (
                <div className="rounded-lg border border-amber-800/40 bg-amber-950/15 px-3 py-2 text-xs text-amber-200">
                    Refresh failed; showing the last successful snapshot from {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : "an earlier request"}. {error}
                </div>
            )}

            {/* Content */}
            {data && (
                <>
                    {/* Tabs */}
                    <WorkspaceSegmented>
                        {TABS.map((tab) => (
                            <WorkspaceSegmentedButton
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                active={activeTab === tab.key}
                            >
                                {tab.label}
                                {tab.key === "fissures" && (
                                    <span className="ml-1.5 rounded-full bg-slate-700/60 px-1 text-[10px] text-slate-300">
                                        {data.fissures.filter((f) => isWorldStateEntryActive(f, now) && !f.isHard).length}
                                    </span>
                                )}
                                {tab.key === "activities" && activeActivities > 0 && (
                                    <span className="ml-1.5 rounded-full bg-blue-900/60 px-1 text-[10px] text-blue-300">
                                        {activeActivities}
                                    </span>
                                )}
                                {tab.key === "traders" && data.voidTrader && isWorldStateEntryActive(data.voidTrader, now) && (
                                    <span className="ml-1.5 rounded-full bg-amber-900/60 px-1 text-[10px] text-amber-300">
                                        {data.voidTrader.inventory.length}
                                    </span>
                                )}
                            </WorkspaceSegmentedButton>
                        ))}
                    </WorkspaceSegmented>

                    {/* Tab content */}
                    <div>
                        {activeTab === "overview"    && <OverviewTab    data={data} />}
                        {activeTab === "fissures"    && <FissuresTab    fissures={data.fissures} />}
                        {activeTab === "missions"    && <MissionsTab    data={data} />}
                        {activeTab === "activities"  && <ActivitiesTab  data={data} />}
                        {activeTab === "traders"     && <TradersTab     data={data} />}
                    </div>
                </>
            )}
        </div>
    );
}
