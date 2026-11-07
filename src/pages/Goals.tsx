// Goals page — shell component.
// Heavy rendering lives in ./goals/ subdirectory:
//   goalsUtils.ts       — constants, cache, pure helpers
//   GoalsTreeView.tsx   — ZoomableTreeViewport + TreeNode + TreeStyles
//   GoalCard.tsx        — individual goal expansion card
//   GoalsModal.tsx      — full-screen overlay tree modal

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTrackerStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { buildRequirementsSnapshot, type SyndicateScopeMode } from "../domain/logic/requirementEngine";
import { getItemRequirements } from "../catalog/items/itemRequirements";
import { FULL_CATALOG, type CatalogId } from "../domain/catalog/loadFullCatalog";
import { EMPTY_OBJ, EMPTY_ARR, type GoalRow, type GoalsTab, safeInt } from "./goals/goalsUtils";
import { GoalCard } from "./goals/GoalCard";
import { TreeStyles } from "./goals/GoalsTreeView";
import { WorkspaceAction, WorkspaceFilterBar, WorkspaceFilterGroup, WorkspacePillButton, WorkspaceSection, WorkspaceSegmented, WorkspaceSegmentedButton } from "../components/workspace/WorkspaceChrome";
import { getOwnedCountForCatalogId } from "../domain/goals/catalogGoals";

function Section(props: { title: string; subtitle?: string; children: ReactNode }) {
    return <WorkspaceSection title={props.title} subtitle={props.subtitle}>{props.children}</WorkspaceSection>;
}

function PillButton(props: { label: string; active: boolean; onClick: () => void }) {
    return <WorkspacePillButton label={props.label} active={props.active} onClick={props.onClick} />;
}

// Inline count editor for requirements items — updates the shared inventory counts.
function InlineCountEditor(props: { catalogId: string; have: number; totalNeed: number }) {
    const setCount = useTrackerStore((s) => s.setCount);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");

    function commit() {
        const n = parseInt(draft, 10);
        if (!isNaN(n) && n >= 0) setCount(props.catalogId, n);
        setEditing(false);
    }

    if (editing) {
        return (
            <div className="flex items-center gap-1">
                <input
                    autoFocus
                    type="number"
                    min={0}
                    className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-slate-400"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                    onBlur={commit}
                />
                <span className="text-[11px] text-slate-500">/ {props.totalNeed.toLocaleString()}</span>
            </div>
        );
    }

    return (
        <button
            className="flex items-center gap-1 group"
            onClick={() => { setDraft(String(props.have)); setEditing(true); }}
            title="Click to update your count"
        >
            <span className="text-[11px] text-slate-400 font-mono group-hover:text-slate-200 transition-colors">
                {props.have.toLocaleString()} / {props.totalNeed.toLocaleString()}
            </span>
            <svg className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
        </button>
    );
}

// A single requirements-goals row with optional crafting ingredient expansion.
function ReqItemRow(props: { catalogId: CatalogId; name: string; totalNeed: number; have: number; remaining: number; syndicateLabel?: string }) {
    const { catalogId, name, totalNeed, have, remaining, syndicateLabel } = props;
    const [expanded, setExpanded] = useState(false);

    const ingredients = useMemo(() => {
        const comps = getItemRequirements(catalogId);
        if (!Array.isArray(comps) || comps.length === 0) return [];
        return comps
            .filter((c) => c?.catalogId && safeInt((c as any).count ?? 0, 0) > 0)
            .map((c) => {
                const cid = c.catalogId as CatalogId;
                const dispName = FULL_CATALOG.recordsById[cid]?.displayName ?? String(cid);
                return { catalogId: cid, name: dispName, count: safeInt((c as any).count ?? 0, 0) };
            });
    }, [catalogId]);

    const pct = totalNeed > 0 ? Math.min(100, Math.round((have / totalNeed) * 100)) : 0;
    const done = remaining === 0;

    return (
        <div className={["rounded-xl border bg-slate-950/30 p-3", done ? "border-slate-800/40 opacity-60" : "border-slate-800"].join(" ")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold break-words">{name}</div>
                        {done && <span className="text-[10px] text-green-500 font-mono">✓ done</span>}
                    </div>
                    {syndicateLabel && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{syndicateLabel}</div>
                    )}
                    {/* Progress bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <InlineCountEditor catalogId={String(catalogId)} have={have} totalNeed={totalNeed} />
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs font-mono text-slate-100 font-semibold text-right">
                        {remaining.toLocaleString()} left
                    </div>
                    {ingredients.length > 0 && (
                        <button
                            onClick={() => setExpanded((v) => !v)}
                            className="text-[10px] rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                            title={expanded ? "Hide crafting ingredients" : "Show crafting ingredients"}
                        >
                            {expanded ? "▲ hide" : "▼ crafting"}
                        </button>
                    )}
                </div>
            </div>

            {/* Flat ingredient list */}
            {expanded && ingredients.length > 0 && (
                <div className="mt-2 ml-4 space-y-1 border-l-2 border-slate-800 pl-3">
                    {ingredients.map((ing) => (
                        <div key={String(ing.catalogId)} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                            <span className="truncate">{ing.name}</span>
                            <span className="font-mono text-slate-400 shrink-0">×{ing.count.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Goals() {
    const setActivePage = useTrackerStore((s) => s.setActivePage);

    const { goals, syndicates, completedPrereqs, inventory } = useTrackerStore(
        useShallow((s) => ({
            goals: Array.isArray((s.state as any).goals) ? (s.state as any).goals : EMPTY_ARR,
            syndicates: s.state.syndicates ?? [],
            completedPrereqs: s.state.prereqs?.completed ?? EMPTY_OBJ,
            inventory: s.state.inventory,
        }))
    );

    const [tab, setTab] = useState<GoalsTab>("personal");

    // Requirements Goals scope toggle
    const [reqScope, setReqScope] = useState<SyndicateScopeMode>("nextOnly");

    // Personal goals filter / sort state
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
    const [filterDone, setFilterDone] = useState<"all" | "remaining" | "done">("all");
    const [sortBy, setSortBy] = useState<"default" | "nameAZ" | "nameZA" | "mostRemaining" | "leastRemaining" | "mostProgress" | "leastProgress">("default");

    // Requirements-only snapshot — only computed when the tab needs it
    const needsRequirements = tab === "requirements" || tab === "total";
    const requirementsOnly = useMemo(() => {
        if (!needsRequirements) return { itemLines: [] as any[] };
        return buildRequirementsSnapshot({
            syndicates,
            goals: [],
            completedPrereqs,
            inventory,
            syndicateScope: reqScope
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needsRequirements, syndicates, completedPrereqs, inventory, reqScope]);

    // Sorted + filtered goal IDs — GoalCard fetches its own data from the store
    const { sortedGoalIds, totalGoalCount } = useMemo(() => {
        if (!Array.isArray(goals)) return { sortedGoalIds: [] as string[], totalGoalCount: 0 };

        const raw = (goals as any[])
            .filter((g) => g && (g.type === "item" || g.type === "mod" || g.type === "arcane"))
            .map((g) => {
                const cid = String(g.catalogId) as CatalogId;
                const name = FULL_CATALOG.recordsById[cid]?.displayName ?? cid;
                const qty = Math.max(1, safeInt(g.qty ?? 1, 1));
                const have = getOwnedCountForCatalogId(cid, inventory);
                const remaining = Math.max(0, qty - have);
                return { id: String(g.id), isActive: g.isActive !== false, remaining, have, qty, name };
            });

        const totalGoalCount = raw.length;

        const searchLower = search.trim().toLowerCase();
        let filtered = raw;
        if (searchLower) filtered = filtered.filter((x) => x.name.toLowerCase().includes(searchLower));
        if (filterStatus !== "all") filtered = filtered.filter((x) => x.isActive === (filterStatus === "active"));
        if (filterDone !== "all") filtered = filtered.filter((x) => filterDone === "done" ? x.remaining === 0 : x.remaining > 0);

        filtered.sort((a, b) => {
            switch (sortBy) {
                case "nameAZ": return a.name.localeCompare(b.name);
                case "nameZA": return b.name.localeCompare(a.name);
                case "mostRemaining": return b.remaining - a.remaining || a.name.localeCompare(b.name);
                case "leastRemaining": return a.remaining - b.remaining || a.name.localeCompare(b.name);
                case "mostProgress": {
                    const pa = a.qty > 0 ? a.have / a.qty : 1;
                    const pb = b.qty > 0 ? b.have / b.qty : 1;
                    return pb - pa || a.name.localeCompare(b.name);
                }
                case "leastProgress": {
                    const pa = a.qty > 0 ? a.have / a.qty : 1;
                    const pb = b.qty > 0 ? b.have / b.qty : 1;
                    return pa - pb || a.name.localeCompare(b.name);
                }
                default:
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                    if (a.remaining !== b.remaining) return b.remaining - a.remaining;
                    return a.name.localeCompare(b.name);
            }
        });

        return { sortedGoalIds: filtered.map((x) => x.id), totalGoalCount };
    }, [goals, inventory, search, filterStatus, filterDone, sortBy]);

    // Requirements goals lines (actionable items; remaining > 0 already filtered by engine)
    const requirementsLines = useMemo(() => {
        const base = requirementsOnly.itemLines.slice();
        base.sort((a, b) => {
            if (a.remaining !== b.remaining) return b.remaining - a.remaining;
            return a.name.localeCompare(b.name);
        });
        return base;
    }, [requirementsOnly.itemLines]);

    // Total / compiled goals
    const totalLines = useMemo<GoalRow[]>(() => {
        const map: Record<string, { catalogId: CatalogId; name: string; personalNeed: number; requirementsNeed: number }> = {};

        for (const g of goals ?? []) {
            if (!g || g.isActive === false) continue;
            const cid = String(g.catalogId) as CatalogId;
            const qty = Math.max(1, safeInt(g.qty ?? 1, 1));

            const rec = FULL_CATALOG.recordsById[cid];
            const name = rec?.displayName ?? cid;

            if (!map[cid]) {
                map[cid] = { catalogId: cid, name, personalNeed: 0, requirementsNeed: 0 };
            }
            map[cid].personalNeed += qty;
        }

        for (const l of requirementsOnly.itemLines ?? []) {
            const cid = l.key;
            if (!map[cid]) {
                map[cid] = { catalogId: cid, name: l.name, personalNeed: 0, requirementsNeed: 0 };
            }
            map[cid].requirementsNeed += safeInt(l.totalNeed ?? 0, 0);
        }

        const out: GoalRow[] = Object.values(map).map((x) => {
            const have = safeInt(inventory?.counts?.[String(x.catalogId)] ?? 0, 0);
            const totalNeed = x.personalNeed + x.requirementsNeed;
            const remaining = Math.max(0, totalNeed - have);

            return {
                catalogId: x.catalogId,
                name: x.name,
                personalNeed: x.personalNeed,
                requirementsNeed: x.requirementsNeed,
                totalNeed,
                have,
                remaining
            };
        });

        const filtered = out.filter((r) => r.totalNeed > 0);

        filtered.sort((a, b) => {
            if (a.remaining !== b.remaining) return b.remaining - a.remaining;
            return a.name.localeCompare(b.name);
        });

        return filtered;
    }, [goals, requirementsOnly.itemLines, inventory]);

    const activeGoalCount = goals.filter((goal: any) => goal && goal.isActive !== false).length;
    const completedGoalCount = (goals ?? []).filter((goal: any) => {
        if (!goal) return false;
        const cid = String(goal.catalogId) as CatalogId;
        const qty = Math.max(1, safeInt(goal.qty ?? 1, 1));
        const have = getOwnedCountForCatalogId(cid, inventory);
        return have >= qty;
    }).length;
    const totalRemaining = totalLines.reduce((sum, line) => sum + line.remaining, 0);

    return (
        <div className="space-y-6">
            <TreeStyles />

            <section className="rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-5 py-4 shadow-[var(--wf-shadow-panel)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-accent-primary)]">
                            Progression Workspace
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--wf-text-strong)]">Goals</h1>
                        <p className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                            Track personal objectives, syndicate-driven requirements, and the combined pressure on your inventory in one progression portfolio.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2 text-sm font-medium text-[color:var(--wf-text)] transition-colors hover:bg-[color:var(--wf-surface-strong)]"
                            onClick={() => setActivePage("inventory")}
                        >
                            Open Inventory
                        </button>
                        <button
                            className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2 text-sm font-medium text-[color:var(--wf-text)] transition-colors hover:bg-[color:var(--wf-surface-strong)]"
                            onClick={() => setActivePage("requirements")}
                        >
                            Open Farming
                        </button>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Tracked goals</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{totalGoalCount.toLocaleString()}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">All personal item goals currently stored.</div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Active</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{activeGoalCount.toLocaleString()}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Goals currently influencing planning and farming views.</div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Completed</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{completedGoalCount.toLocaleString()}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Goals already satisfied by current inventory counts.</div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Remaining pressure</div>
                        <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{totalRemaining.toLocaleString()}</div>
                        <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Combined remaining units across total personal + requirements demand.</div>
                    </div>
                </div>
            </section>

            <Section
                title="Goals"
                subtitle="Track items you're farming and see what your next syndicate rank-ups require. Add personal goals from the Inventory page."
            >
                <WorkspaceFilterBar>
                    <WorkspaceFilterGroup>
                        <PillButton label="Personal Goals" active={tab === "personal"} onClick={() => setTab("personal")} />
                        <PillButton label="Requirements Goals" active={tab === "requirements"} onClick={() => setTab("requirements")} />
                        <PillButton label="Total Goals" active={tab === "total"} onClick={() => setTab("total")} />
                    </WorkspaceFilterGroup>

                    <WorkspaceFilterGroup>
                        <WorkspaceAction
                            className="rounded-lg border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/40"
                            onClick={() => setActivePage("inventory")}
                        >
                            Open Inventory (manage Personal Goals)
                        </WorkspaceAction>

                        <WorkspaceAction
                            className="rounded-lg border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/40"
                            onClick={() => setActivePage("requirements")}
                        >
                            Open Farming
                        </WorkspaceAction>
                    </WorkspaceFilterGroup>
                </WorkspaceFilterBar>
            </Section>

            {tab === "personal" && (
                <Section
                    title="Personal Goals"
                    subtitle={
                        search.trim() || filterStatus !== "all" || filterDone !== "all"
                            ? `Showing ${sortedGoalIds.length.toLocaleString()} of ${totalGoalCount.toLocaleString()} goals`
                            : `${totalGoalCount.toLocaleString()} goals (includes inactive)`
                    }
                >
                    {/* Search + filter + sort bar */}
                    <WorkspaceFilterBar className="mb-3">
                        <input
                            type="search"
                            aria-label="Search personal goals"
                            placeholder="Search by name…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 min-w-[160px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
                        />

                        {/* Active filter */}
                        <WorkspaceFilterGroup>
                        <WorkspaceSegmented>
                            {(["all", "active", "inactive"] as const).map((s) => (
                                <WorkspaceSegmentedButton
                                    key={s}
                                    onClick={() => setFilterStatus(s)}
                                    active={filterStatus === s}
                                    className="px-2.5 py-1"
                                >
                                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                                </WorkspaceSegmentedButton>
                            ))}
                        </WorkspaceSegmented>

                        {/* Done filter */}
                        <WorkspaceSegmented>
                            {(["all", "remaining", "done"] as const).map((s) => (
                                <WorkspaceSegmentedButton
                                    key={s}
                                    onClick={() => setFilterDone(s)}
                                    active={filterDone === s}
                                    className="px-2.5 py-1"
                                >
                                    {s === "all" ? "All" : s === "remaining" ? "In Progress" : "Done"}
                                </WorkspaceSegmentedButton>
                            ))}
                        </WorkspaceSegmented>
                        </WorkspaceFilterGroup>

                        {/* Sort */}
                        <WorkspaceFilterGroup>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200"
                            >
                                <option value="default">Active first</option>
                                <option value="nameAZ">Name A → Z</option>
                                <option value="nameZA">Name Z → A</option>
                                <option value="mostRemaining">Most remaining</option>
                                <option value="leastRemaining">Least remaining</option>
                                <option value="mostProgress">Most progress</option>
                                <option value="leastProgress">Least progress</option>
                            </select>
                        </WorkspaceFilterGroup>
                    </WorkspaceFilterBar>

                    {totalGoalCount === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            No personal goals yet. Add them from Inventory.
                        </div>
                    ) : sortedGoalIds.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            No goals match the current filters.{" "}
                            <button
                                className="underline text-slate-300 hover:text-slate-100"
                                onClick={() => { setSearch(""); setFilterStatus("all"); setFilterDone("all"); }}
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sortedGoalIds.map((goalId) => (
                                <GoalCard key={goalId} goalId={goalId} />
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {tab === "requirements" && (
                <Section
                    title="Requirements Goals"
                    subtitle={`${requirementsLines.length.toLocaleString()} item${requirementsLines.length !== 1 ? "s" : ""} needed · ${reqScope === "allRemaining" ? "All remaining ranks" : "Next rank only"}`}
                >
                    {/* Scope toggle */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Rank scope:</span>
                        <PillButton
                            label="Next rank only"
                            active={reqScope === "nextOnly"}
                            onClick={() => setReqScope("nextOnly")}
                        />
                        <PillButton
                            label="All remaining ranks"
                            active={reqScope === "allRemaining"}
                            onClick={() => setReqScope("allRemaining")}
                        />
                    </div>

                    {requirementsLines.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            No requirements right now. Make sure syndicates are configured on the Syndicates page.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {requirementsLines.map((l) => {
                                // Build a short label showing which syndicate(s) need this item.
                                const synLabels = l.sources
                                    .filter((s: any) => s.type === "syndicate")
                                    .map((s: any) => `${s.name} ${s.label}`)
                                    .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
                                    .slice(0, 3)
                                    .join(" · ");
                                return (
                                    <ReqItemRow
                                        key={String(l.key)}
                                        catalogId={l.key}
                                        name={l.name}
                                        totalNeed={l.totalNeed}
                                        have={l.have}
                                        remaining={l.remaining}
                                        syndicateLabel={synLabels || undefined}
                                    />
                                );
                            })}
                        </div>
                    )}
                </Section>
            )}

            {tab === "total" && (
                <Section title="Total Goals" subtitle="Personal + Requirements combined into a single list (summed by item).">
                    {totalLines.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            No goals to compile yet.
                        </div>
                    ) : (
                        <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950/30">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-950/90">
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left px-3 py-2 text-slate-300 font-semibold">Item</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-[140px]">Personal</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-[160px]">Requirements</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-[140px]">Total</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-[120px]">Have</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-[140px]">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {totalLines.map((r) => (
                                        <tr key={String(r.catalogId)} className="border-b border-slate-800/70">
                                            <td className="px-3 py-2 text-slate-100">
                                                <div className="font-semibold">{r.name}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-200">{r.personalNeed.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-slate-200">{r.requirementsNeed.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-slate-100 font-semibold">{r.totalNeed.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-slate-200">{r.have.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-slate-100 font-semibold">{r.remaining.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Section>
            )}
        </div>
    );
}

