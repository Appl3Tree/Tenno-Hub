// src/pages/Challenges.tsx
import { useMemo, useState } from "react";
import CHALLENGES_RAW from "../../external/browse-wf/challenges.json";
import DICT_RAW from "../../external/overframe-gg/dict.json";
import { useTrackerStore } from "../store/store";

interface ChallengeEntry {
    uniqueName: string;
    name?: string;
    description?: string;
    icon?: string;
    requiredCount?: number;
    hidden?: boolean;
}

const DICT: Record<string, string> = DICT_RAW as Record<string, string>;

function loc(path: string | undefined): string {
    if (!path) return "";
    if (!path.startsWith("/")) return path;
    const raw = DICT[path] ?? "";
    if (!raw) return "";
    return raw
        .replace(/\|OPEN_COLOR\|.*?\|CLOSE_COLOR\|/g, "")
        .replace(/\|COUNT\|/g, "#")
        .replace(/\r?\n/g, " ")
        .trim();
}

const _imgModules = import.meta.glob<string>(
    "../assets/challenges/*.png",
    { eager: true, import: "default" }
);
const CHALLENGE_IMAGES: Record<string, string> = {};
for (const [path, url] of Object.entries(_imgModules)) {
    const filename = path.split("/").pop()!;
    CHALLENGE_IMAGES[filename] = url;
}

function getChallengeImage(entry: ChallengeEntry): string | null {
    if (!entry.icon) return null;
    const basename = entry.icon.split("/").pop() ?? "";
    return CHALLENGE_IMAGES[basename] ?? null;
}

// Filter: skip hidden, skip entries whose name resolves to empty or raw Lotus path
const ALL_CHALLENGES: ChallengeEntry[] = Object.values(
    CHALLENGES_RAW as Record<string, ChallengeEntry>
).filter(c => {
    if (c.hidden || !c.uniqueName) return false;
    const name = loc(c.name);
    return name !== "" && !name.startsWith("/Lotus/");
});

const EMPTY_PROGRESS: Record<string, number> = {};
const EMPTY_COMPLETED: Record<string, boolean> = {};

function isChallengeComplete(
    c: ChallengeEntry,
    progress: Record<string, number>,
    completed: Record<string, boolean>
): boolean {
    if (completed[c.uniqueName]) return true;
    const prog = progress[c.uniqueName] ?? 0;
    if (c.requiredCount !== undefined && c.requiredCount > 0) return prog >= c.requiredCount;
    return prog > 0;
}

type FilterMode = "all" | "completed" | "incomplete";

export default function Challenges() {
    const setActivePage = useTrackerStore((s) => s.setActivePage);
    const challengeProgress = useTrackerStore(s => s.state.challenges?.progress ?? EMPTY_PROGRESS);
    const challengeCompleted = useTrackerStore(s => s.state.challenges?.completed ?? EMPTY_COMPLETED);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterMode>("all");

    const hasImportedData = Object.keys(challengeProgress).length > 0 || Object.keys(challengeCompleted).length > 0;

    const completedCount = useMemo(() =>
        ALL_CHALLENGES.filter(c => isChallengeComplete(c, challengeProgress, challengeCompleted)).length,
        [challengeProgress, challengeCompleted]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return ALL_CHALLENGES.filter(c => {
            const name = loc(c.name).toLowerCase();
            const desc = loc(c.description).toLowerCase();
            if (q && !name.includes(q) && !desc.includes(q)) return false;
            const done = isChallengeComplete(c, challengeProgress, challengeCompleted);
            if (filter === "completed") return done;
            if (filter === "incomplete") return !done;
            return true;
        });
    }, [search, filter, challengeProgress, challengeCompleted]);

    return (
        <div className="space-y-5">
            <section aria-labelledby="challenges-page-title" className="rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-5 py-4 shadow-[var(--wf-shadow-panel)]">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="max-w-3xl">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-accent-primary)]">
                            Progression Workspace
                        </div>
                        <h1 id="challenges-page-title" className="mt-1 text-2xl font-semibold text-[color:var(--wf-text-strong)]">Challenges</h1>
                        <p className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                            Track account challenges as a long-tail progression layer. Search them quickly, see completion velocity, and surface what remains once a profile import is available.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2 text-sm font-medium text-[color:var(--wf-text)] transition-colors hover:bg-[color:var(--wf-surface-strong)]"
                            onClick={() => setActivePage("imports")}
                        >
                            Open Import
                        </button>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Challenge pool</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{ALL_CHALLENGES.length.toLocaleString()}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Visible account challenges in the current dataset.</div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Completed</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{completedCount.toLocaleString()}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Imported or inferred completions on the current profile.</div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Remaining</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{(ALL_CHALLENGES.length - completedCount).toLocaleString()}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Challenges not yet completed on imported data.</div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Completion</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">
                            {hasImportedData ? `${Math.round((completedCount / ALL_CHALLENGES.length) * 100)}%` : "No import"}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Requires imported challenge data to become meaningful.</div>
                    </div>
                </div>
            </section>

            <div className="rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-4 shadow-[var(--wf-shadow-panel)]">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="text-lg font-semibold text-[color:var(--wf-text-strong)]">Registry View</h3>
                        <p className="text-sm text-[color:var(--wf-text-muted)] mt-0.5">
                            {ALL_CHALLENGES.length} total
                            {hasImportedData && (
                                <span className="ml-2 text-[color:var(--wf-text)]">
                                    — <span className="text-green-400 font-medium">{completedCount}</span> completed
                                    <span className="text-[color:var(--wf-text-dim)] mx-1">·</span>
                                    <span className="font-medium">{ALL_CHALLENGES.length - completedCount}</span> remaining
                                </span>
                            )}
                        </p>
                    </div>
                    {hasImportedData && (
                        <div className="text-right">
                            <div className="text-2xl font-bold text-[color:var(--wf-text-strong)]">
                                {Math.round((completedCount / ALL_CHALLENGES.length) * 100)}%
                            </div>
                            <div className="text-xs text-[color:var(--wf-text-dim)]">completion</div>
                        </div>
                    )}
                </div>
                {hasImportedData && (
                    <div className="mt-3 w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
                            style={{ width: `${(completedCount / ALL_CHALLENGES.length) * 100}%` }}
                        />
                    </div>
                )}
                {!hasImportedData && (
                    <div className="mt-3 rounded-lg bg-slate-900/60 border border-slate-700/60 px-3 py-2.5 text-sm text-slate-400">
                        Import your profile on the <span className="text-slate-200 font-medium">Import / Export</span> page to track your challenge progress.
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <input
                    aria-label="Search challenges"
                    className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm w-64 placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search challenges…"
                />
                {hasImportedData && (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                        {(["all", "completed", "incomplete"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={[
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    filter === f ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
                                ].join(" ")}
                            >
                                {f === "all" ? "All" : f === "completed" ? "Completed" : "Incomplete"}
                            </button>
                        ))}
                    </div>
                )}
                <span className="text-xs text-slate-500">{filtered.length} shown</span>
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
                    No challenges match your search.
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filtered.map(c => {
                        const name = loc(c.name);
                        const desc = loc(c.description);
                        const progress = challengeProgress[c.uniqueName] ?? 0;
                        const done = isChallengeComplete(c, challengeProgress, challengeCompleted);
                        const hasRequired = c.requiredCount !== undefined && c.requiredCount > 0;
                        const imgUrl = getChallengeImage(c);

                        return (
                            <div
                                key={c.uniqueName}
                                className={[
                                    "relative flex flex-col rounded-xl border overflow-hidden transition-all",
                                    done
                                        ? "border-green-600/50 bg-green-950/20"
                                        : "border-slate-700/60 bg-slate-900/40 hover:bg-slate-900/70"
                                ].join(" ")}
                            >
                                {/* Completion badge */}
                                {done && hasImportedData && (
                                    <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow">
                                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </div>
                                )}

                                {/* Image — full width, square */}
                                <div className={[
                                    "w-full aspect-square flex items-center justify-center bg-slate-800/40",
                                    done ? "" : "opacity-60 grayscale"
                                ].join(" ")}>
                                    {imgUrl ? (
                                        <img
                                            src={imgUrl}
                                            alt={name}
                                            className="w-4/5 h-4/5 object-contain"
                                        />
                                    ) : (
                                        <svg className="w-10 h-10 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                    )}
                                </div>

                                {/* Text content */}
                                <div className="p-2 flex flex-col gap-1">
                                    <div className={[
                                        "text-[11px] font-semibold leading-tight",
                                        done ? "text-green-300" : "text-slate-200"
                                    ].join(" ")}>
                                        {name}
                                    </div>
                                    {desc && (
                                        <div className="text-[10px] text-slate-400 leading-snug line-clamp-3">
                                            {desc}
                                        </div>
                                    )}

                                    {/* In-progress bar */}
                                    {hasImportedData && hasRequired && !done && progress > 0 && (
                                        <div className="mt-0.5">
                                            <div className="w-full h-1 rounded-full bg-slate-700 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-blue-500"
                                                    style={{ width: `${Math.min(100, (progress / c.requiredCount!) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                                                {progress.toLocaleString()} / {c.requiredCount!.toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                    {hasImportedData && hasRequired && !done && progress === 0 && (
                                        <div className="text-[9px] text-slate-600 font-mono">
                                            0 / {c.requiredCount!.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
