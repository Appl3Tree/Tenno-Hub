// ===== FILE: src/pages/Requirements.tsx =====
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTrackerStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { setPendingStarChartNodeId, sourceIdToStarChartNodeId } from "../store/starChartNav";
import { formatSourceDisplayLabel } from "../utils/sourceLabels";
import {
    buildRequirementsSnapshot,
    buildFarmingSnapshot,
    type RequirementViewMode,
    type RequirementExpandMode
} from "../domain/logic/requirementEngine";
import type { CurrencyRequirementLine } from "../domain/logic/requirementEngine";
import { getPrimeAvailabilityStatus } from "../domain/catalog/vaultedItems";
import { useWorldStateData } from "../lib/useWorldStateData";
import { WorkspaceAction, WorkspaceFilterBar, WorkspaceFilterGroup, WorkspaceHero, WorkspacePillButton, WorkspaceSection, WorkspaceStat } from "../components/workspace/WorkspaceChrome";
import { FULL_CATALOG } from "../domain/catalog/loadFullCatalog";
import { getAcquisitionByCatalogId } from "../catalog/items/itemAcquisition";
import { getGoalCatalogKind, getOwnedCountForGoal } from "../domain/goals/catalogGoals";

function normalize(s: string): string {
    return s.trim().toLowerCase();
}

function Section(props: { title: string; subtitle?: string; children: ReactNode }) {
    return <WorkspaceSection title={props.title} subtitle={props.subtitle}>{props.children}</WorkspaceSection>;
}

function PillButton(props: { label: string; active: boolean; onClick: () => void }) {
    return <WorkspacePillButton label={props.label} active={props.active} onClick={props.onClick} />;
}

const FARMING_SOURCE_FILTER_STORAGE_KEY = "tnh.requirements.hiddenSourceFilters";
const FARMING_SOURCE_FILTER_GRANULARITY_STORAGE_KEY = "tnh.requirements.sourceFilterGranularity";

type SourceFilterGranularity = "category" | "source";
type SourceFilterOption = {
    key: string;
    label: string;
    count: number;
};

type WantedSideGoal = {
    key: string;
    name: string;
    type: "mod" | "arcane";
    remaining: number;
};

function loadHiddenSourceFilters(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(FARMING_SOURCE_FILTER_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0));
    } catch {
        return new Set();
    }
}

function loadSourceFilterGranularity(): SourceFilterGranularity {
    if (typeof window === "undefined") return "category";
    const raw = window.localStorage.getItem(FARMING_SOURCE_FILTER_GRANULARITY_STORAGE_KEY);
    return raw === "source" ? "source" : "category";
}

function getSourceCategory(sourceId: string, sourceLabel: string): string {
    const normalized = String(sourceId ?? "").toLowerCase();
    const label = String(sourceLabel ?? "").toLowerCase();

    if (normalized.startsWith("data:conclave") || label.includes("conclave")) return "Conclave";
    if (normalized.includes("cache") || label.includes("cache")) return "Caches";
    if (normalized.includes("bounty") || label.includes("bounty")) return "Bounties";
    if (normalized.includes("syndicate") || label.includes("syndicate") || label.includes("new loka") || label.includes("steel meridian") || label.includes("red veil") || label.includes("cephalon suda") || label.includes("arbiters of hexis") || label.includes("perrin")) return "Syndicates";
    if (normalized.includes("relic") || label.includes("relic")) return "Relics";
    if (normalized.includes("sortie") || label.includes("sortie")) return "Sorties";
    if (normalized.includes("invasion") || label.includes("invasion")) return "Invasions";
    if (normalized.includes("circuit") || label.includes("circuit")) return "Circuit";
    if (normalized.includes("duviri") || label.includes("duviri")) return "Duviri";
    if (normalized.includes("railjack") || normalized.includes("proxima") || label.includes("railjack") || label.includes("proxima")) return "Railjack";
    if (normalized.includes("crafting") || label.includes("foundry")) return "Crafting";
    if (normalized.includes("missionreward") || normalized.includes("drop:node") || normalized.includes("node/")) return "Missions";
    return "Other";
}

function getSourceFilterKey(sourceId: string, sourceLabel: string, granularity: SourceFilterGranularity): string {
    if (granularity === "category") {
        return `category:${getSourceCategory(sourceId, sourceLabel)}`;
    }
    return `source:${String(sourceId)}`;
}

function getSourceFilterLabel(sourceId: string, sourceLabel: string, granularity: SourceFilterGranularity): string {
    if (granularity === "category") return getSourceCategory(sourceId, sourceLabel);
    return formatSourceDisplayLabel(sourceLabel || String(sourceId));
}

function sourceMatchesHiddenFilter(sourceId: string, sourceLabel: string, hiddenFilters: Set<string>): boolean {
    return (
        hiddenFilters.has(getSourceFilterKey(sourceId, sourceLabel, "category")) ||
        hiddenFilters.has(getSourceFilterKey(sourceId, sourceLabel, "source"))
    );
}

function MiniStat(props: { label: string; value: string }) {
    return <WorkspaceStat label={props.label} value={props.value} className="p-3 [&>div:nth-child(2)]:mt-0.5 [&>div:nth-child(2)]:text-sm" />;
}

const HIDDEN_REASON_LABEL: Record<string, string> = {
    "out-of-scope": "Out of scope",
    "unknown-acquisition": "Unknown acquisition",
    "unknown-recipe-acquisition": "Unknown recipe acquisition",
    "missing-prereqs": "Missing prerequisites",
    "no-accessible-sources": "No accessible sources",
};

// Inline count editor for farming items
function InlineCountEditor(props: {
    catalogId: string;
    have: number;
    totalNeed: number;
}) {
    const setCount = useTrackerStore(s => s.setCount);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");

    function commit() {
        const n = parseInt(draft, 10);
        if (!isNaN(n) && n >= 0) {
            setCount(props.catalogId, n);
        }
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
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") setEditing(false);
                    }}
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

function CurrencyCostChip(props: { line: CurrencyRequirementLine }) {
    const { line: cl } = props;
    const remaining = cl.remaining ?? cl.totalNeed;
    const isMet = remaining <= 0;
    const isPlatinum = cl.key === "platinum";

    return (
        <div className={[
            "rounded-xl border px-4 py-3 flex items-center gap-3",
            isMet
                ? "border-green-800/40 bg-green-950/20"
                : isPlatinum
                    ? "border-indigo-800/40 bg-indigo-950/20"
                    : "border-yellow-800/40 bg-yellow-950/10"
        ].join(" ")}>
            <div className="text-2xl">{isPlatinum ? "◈" : "🪙"}</div>
            <div>
                <div className="text-sm font-semibold text-slate-100">{cl.name}</div>
                <div className={["text-xs font-mono", isMet ? "text-green-400" : "text-slate-300"].join(" ")}>
                    {isMet
                        ? `✓ ${cl.totalNeed.toLocaleString()} (covered)`
                        : `Need ${cl.totalNeed.toLocaleString()}${cl.have > 0 ? ` · Have ${cl.have.toLocaleString()} · Still need ${remaining.toLocaleString()}` : ""}`}
                </div>
                {cl.sources.length > 0 && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                        {cl.sources.slice(0, 3).map(s => s.name).join(", ")}
                        {cl.sources.length > 3 && ` +${cl.sources.length - 3} more`}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Requirements() {
    const setActivePage = useTrackerStore((s) => s.setActivePage);

    const { syndicates, goals, completedPrereqs, inventory } = useTrackerStore(
        useShallow((s) => ({
            syndicates: s.state.syndicates ?? [],
            goals: s.state.goals ?? [],
            completedPrereqs: s.state.prereqs?.completed ?? {},
            inventory: s.state.inventory,
        }))
    );

    const [mode, setMode] = useState<RequirementViewMode>("targeted");
    const [expandMode, setExpandMode] = useState<RequirementExpandMode>("direct");
    const [query, setQuery] = useState("");
    const [showHidden, setShowHidden] = useState(false);
    const worldState = useWorldStateData();
    const [hiddenSourceFilters, setHiddenSourceFilters] = useState<Set<string>>(() => loadHiddenSourceFilters());
    const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
    const [sourceFilterGranularity, setSourceFilterGranularity] = useState<SourceFilterGranularity>(() => loadSourceFilterGranularity());
    // "farming" = default farming view (platinum excluded from overlap/targeted display)
    // "platinum" = platinum cost summary view
    const [platView, setPlatView] = useState<"farming" | "platinum">("farming");

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(
            FARMING_SOURCE_FILTER_STORAGE_KEY,
            JSON.stringify(Array.from(hiddenSourceFilters)),
        );
    }, [hiddenSourceFilters]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(
            FARMING_SOURCE_FILTER_GRANULARITY_STORAGE_KEY,
            sourceFilterGranularity,
        );
    }, [sourceFilterGranularity]);

    const requirements = useMemo(() => {
        return buildRequirementsSnapshot({
            syndicates,
            goals,
            completedPrereqs,
            inventory,
            expandMode,
            // Farming page always shows all remaining rank requirements so players can
            // plan their full farming runs, not just the immediate next rank.
            syndicateScope: "allRemaining"
        });
    }, [syndicates, goals, completedPrereqs, inventory, expandMode]);

    const farming = useMemo(() => {
        return buildFarmingSnapshot({
            requirements,
            completedPrereqs
        });
    }, [requirements, completedPrereqs]);

    const sourceOptions = useMemo(() => {
        const seen = new Map<string, SourceFilterOption>();

        for (const line of farming.targeted) {
            for (const source of line.sources ?? []) {
                const sourceId = String(source.sourceId);
                const key = getSourceFilterKey(sourceId, source.sourceLabel, sourceFilterGranularity);
                const existing = seen.get(key);
                if (existing) {
                    existing.count += 1;
                    continue;
                }
                seen.set(key, {
                    key,
                    label: getSourceFilterLabel(sourceId, source.sourceLabel, sourceFilterGranularity),
                    count: 1,
                });
            }
        }

        return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [farming.targeted, sourceFilterGranularity]);

    const allValidSourceFilterKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const line of farming.targeted) {
            for (const source of line.sources ?? []) {
                const sourceId = String(source.sourceId);
                keys.add(getSourceFilterKey(sourceId, source.sourceLabel, "category"));
                keys.add(getSourceFilterKey(sourceId, source.sourceLabel, "source"));
            }
        }
        return keys;
    }, [farming.targeted]);

    useEffect(() => {
        setHiddenSourceFilters((current) => {
            let changed = false;
            const next = new Set<string>();
            for (const key of current) {
                if (allValidSourceFilterKeys.has(key)) next.add(key);
                else changed = true;
            }
            return changed ? next : current;
        });
    }, [allValidSourceFilterKeys]);

    const sourceFilteredTargeted = useMemo(() => {
        return farming.targeted
            .map((line) => ({
                ...line,
                sources: (line.sources ?? []).filter(
                    (source) => !sourceMatchesHiddenFilter(String(source.sourceId), source.sourceLabel, hiddenSourceFilters),
                ),
            }))
            .filter((line) => line.sources.length > 0);
    }, [farming.targeted, hiddenSourceFilters]);

    const sourceFilteredOverlap = useMemo(() => {
        return farming.overlap.filter(
            (group) => !sourceMatchesHiddenFilter(String(group.sourceId), group.sourceLabel, hiddenSourceFilters),
        );
    }, [farming.overlap, hiddenSourceFilters]);

    // Build a lookup map from requirements so targeted cards can show have/totalNeed.
    const reqLineByKey = useMemo(() => {
        const m = new Map<string, { have: number; totalNeed: number; catalogId?: string }>();
        for (const l of requirements.itemLines) {
            m.set(String(l.key), { have: l.have, totalNeed: l.totalNeed, catalogId: String(l.key) });
        }
        return m;
    }, [requirements.itemLines]);

    const wantedSideGoalsBySource = useMemo(() => {
        const map = new Map<string, WantedSideGoal[]>();

        for (const goal of goals ?? []) {
            if (!goal || goal.isActive === false) continue;
            const goalKind = getGoalCatalogKind(goal);
            if (goalKind === "item") continue;

            const qty = Math.max(1, Number(goal.qty ?? 1) || 1);
            const have = getOwnedCountForGoal(goal, inventory);
            const remaining = Math.max(0, qty - have);
            if (remaining <= 0) continue;

            const cid = String(goal.catalogId);
            const name = FULL_CATALOG.recordsById[cid as keyof typeof FULL_CATALOG.recordsById]?.displayName ?? cid;
            const acquisition = getAcquisitionByCatalogId(cid as never);
            for (const sourceId of acquisition?.sources ?? []) {
                const key = String(sourceId);
                const rows = map.get(key) ?? [];
                rows.push({ key: cid, name, type: goalKind, remaining });
                map.set(key, rows);
            }
        }

        for (const [sourceId, rows] of map.entries()) {
            const deduped = new Map<string, WantedSideGoal>();
            for (const row of rows) deduped.set(row.key, row);
            map.set(
                sourceId,
                Array.from(deduped.values()).sort((a, b) => {
                    if (a.remaining !== b.remaining) return b.remaining - a.remaining;
                    return a.name.localeCompare(b.name);
                }),
            );
        }

        return map;
    }, [goals, inventory]);

    const filteredTargeted = useMemo(() => {
        const q = normalize(query);
        if (!q) return sourceFilteredTargeted;

        return sourceFilteredTargeted.filter((l) => {
            if (normalize(l.name).includes(q)) return true;
            if (normalize(String(l.key)).includes(q)) return true;

            return (l.sources ?? []).some(
                (s) => normalize(s.sourceLabel).includes(q) || normalize(String(s.sourceId)).includes(q)
            );
        });
    }, [sourceFilteredTargeted, query]);

    const filteredOverlap = useMemo(() => {
        const q = normalize(query);
        if (!q) return sourceFilteredOverlap;

        return sourceFilteredOverlap.filter((g) => {
            if (normalize(g.sourceLabel).includes(q)) return true;
            if (normalize(String(g.sourceId)).includes(q)) return true;

            return (g.items ?? []).some((it) => normalize(it.name).includes(q) || normalize(String(it.key)).includes(q));
        });
    }, [sourceFilteredOverlap, query]);

    const filteredHidden = useMemo(() => {
        if (!showHidden) return [];
        const q = normalize(query);
        if (!q) return farming.hidden;

        return farming.hidden.filter((h) => {
            if (normalize(h.name).includes(q)) return true;
            if (normalize(String(h.key)).includes(q)) return true;
            return normalize(h.reason).includes(q);
        });
    }, [farming.hidden, query, showHidden]);

    const activeGoals = goals.filter((goal) => goal.isActive).length;
    const platinumLine = requirements.currencyLines.find((cl) => cl.key === "platinum");

    return (
        <div className="space-y-6">
            <WorkspaceHero
                eyebrow="Planning Workspace"
                title="Farming Planner"
                description="Convert goals and rank-up needs into an actionable farming route. Use targeted mode when you need a specific item and overlap mode when efficiency matters more."
                actions={
                    <>
                        <WorkspaceAction onClick={() => setActivePage("goals")}>Open Goals</WorkspaceAction>
                        <WorkspaceAction onClick={() => setActivePage("starchart")}>Open Star Chart</WorkspaceAction>
                        <WorkspaceAction onClick={() => setActivePage("relic_planner")}>Open Relic Planner</WorkspaceAction>
                    </>
                }
                stats={
                    <>
                        <MiniStat label="Active goals" value={activeGoals.toLocaleString()} />
                        <MiniStat label="Items needed" value={requirements.stats.actionableItemCount.toLocaleString()} />
                        <MiniStat label="Targeted sources" value={sourceFilteredTargeted.length.toLocaleString()} />
                        <MiniStat label="Overlap sources" value={sourceFilteredOverlap.length.toLocaleString()} />
                        <MiniStat
                            label="Plat gap"
                            value={platinumLine && (platinumLine.remaining ?? platinumLine.totalNeed) > 0
                                ? `${(platinumLine.remaining ?? platinumLine.totalNeed).toLocaleString()} ◈`
                                : "Covered"}
                        />
                    </>
                }
            />

            <Section
                title="Farming"
                subtitle="Targeted shows actionable sources for each needed item. Overlap groups items by a shared acquisition source."
            >
                {/* Mode + expand toggles */}
                <WorkspaceFilterBar>
                    <WorkspaceFilterGroup>
                        <PillButton
                            label="Targeted Farming"
                            active={mode === "targeted"}
                            onClick={() => setMode("targeted")}
                        />
                        <PillButton
                            label="Overlap Farming"
                            active={mode === "overlap"}
                            onClick={() => setMode("overlap")}
                        />

                        <div className="w-px h-7 bg-slate-800 mx-1" />

                        <PillButton
                            label="Top-level only"
                            active={expandMode === "direct"}
                            onClick={() => setExpandMode("direct")}
                        />
                        <PillButton
                            label="Expand crafted deps"
                            active={expandMode === "recursive"}
                            onClick={() => setExpandMode("recursive")}
                        />
                    </WorkspaceFilterGroup>

                    <WorkspaceFilterGroup>
                        <WorkspaceAction
                            className="rounded-lg border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/40"
                            onClick={() => setActivePage("goals")}
                        >
                            Open Goals
                        </WorkspaceAction>
                        <WorkspaceAction
                            className="rounded-lg border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/40"
                            onClick={() => setActivePage("inventory")}
                        >
                            Open Inventory
                        </WorkspaceAction>
                        <div className="relative">
                            <WorkspaceAction
                                className="rounded-lg border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/40"
                                onClick={() => setSourceMenuOpen((open) => !open)}
                            >
                                {hiddenSourceFilters.size > 0
                                    ? `Customize Sources (${hiddenSourceFilters.size} hidden)`
                                    : "Customize Sources"}
                            </WorkspaceAction>
                            {sourceMenuOpen && (
                                <div className="wf-popover absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 rounded-2xl border p-3 backdrop-blur">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Source Filters
                                        </div>
                                        <button
                                            className="text-xs text-slate-300 underline hover:text-slate-100 disabled:no-underline disabled:opacity-40"
                                            disabled={hiddenSourceFilters.size === 0}
                                            onClick={() => setHiddenSourceFilters(new Set())}
                                        >
                                            Show all
                                        </button>
                                    </div>
                                    <div className="mt-3 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
                                        <button
                                            className={[
                                                "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                                sourceFilterGranularity === "category"
                                                    ? "bg-slate-100 text-slate-900"
                                                    : "text-slate-300 hover:text-slate-100",
                                            ].join(" ")}
                                            onClick={() => setSourceFilterGranularity("category")}
                                        >
                                            Categories
                                        </button>
                                        <button
                                            className={[
                                                "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                                sourceFilterGranularity === "source"
                                                    ? "bg-slate-100 text-slate-900"
                                                    : "text-slate-300 hover:text-slate-100",
                                            ].join(" ")}
                                            onClick={() => setSourceFilterGranularity("source")}
                                        >
                                            Individual
                                        </button>
                                    </div>
                                    <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
                                        {sourceOptions.length === 0 ? (
                                            <div className="text-sm text-slate-400">No actionable farming sources yet.</div>
                                        ) : (
                                            sourceOptions.map((option) => {
                                                const visible = !hiddenSourceFilters.has(option.key);
                                                return (
                                                    <label key={option.key} className="flex items-start gap-2 text-sm text-slate-300">
                                                        <input
                                                            type="checkbox"
                                                            checked={visible}
                                                            onChange={(e) => {
                                                                setHiddenSourceFilters((current) => {
                                                                    const next = new Set(current);
                                                                    if (e.target.checked) next.delete(option.key);
                                                                    else next.add(option.key);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                        <span className="flex-1">
                                                            {option.label}
                                                            <span className="ml-2 text-xs text-slate-500">{option.count}</span>
                                                        </span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </WorkspaceFilterGroup>
                </WorkspaceFilterBar>

                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MiniStat label="Items needed" value={requirements.stats.actionableItemCount.toLocaleString()} />
                    <MiniStat label="Targeted sources" value={sourceFilteredTargeted.length.toLocaleString()} />
                    <MiniStat label="Overlap sources" value={sourceFilteredOverlap.length.toLocaleString()} />
                    <MiniStat label="Hidden items" value={farming.hidden.length.toLocaleString()} />
                </div>

                {/* Credit costs — always shown when non-zero (not platinum) */}
                {requirements.currencyLines.some(cl => cl.key === "credits" && cl.totalNeed > 0) && (
                    <div className="mt-4 space-y-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Credit costs (rank-ups)</div>
                        <div className="flex flex-wrap gap-3">
                            {requirements.currencyLines
                                .filter(cl => cl.key === "credits")
                                .map(cl => <CurrencyCostChip key={cl.key} line={cl} />)}
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="mt-4">
                    <input
                        aria-label="Search items or farming sources"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search items or sources…"
                    />
                </div>

                <WorkspaceFilterGroup className="mt-3">
                    <PillButton
                        label={showHidden ? "Hide hidden items" : `Show hidden items (${farming.hidden.length})`}
                        active={showHidden}
                        onClick={() => setShowHidden(v => !v)}
                    />
                    <PillButton
                        label="Farming View"
                        active={platView === "farming"}
                        onClick={() => setPlatView("farming")}
                    />
                    <PillButton
                        label={`Platinum View${requirements.currencyLines.some(cl => cl.key === "platinum" && cl.totalNeed > 0) ? ` (${(requirements.currencyLines.find(cl => cl.key === "platinum")?.remaining ?? 0).toLocaleString()} ◈ needed)` : ""}`}
                        active={platView === "platinum"}
                        onClick={() => setPlatView("platinum")}
                    />
                </WorkspaceFilterGroup>
            </Section>

            {/* Platinum view */}
            {platView === "platinum" && (
                <Section
                    title="Platinum Cost Summary"
                    subtitle="Platinum purchase price for each goal item (from the in-game Market), plus any syndicate rank-up platinum costs."
                >
                    {requirements.currencyLines.filter(cl => cl.key === "platinum" && cl.totalNeed > 0).length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            No platinum costs found. Add warframes, weapons, or other purchasable items as goals to see their market prices here.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requirements.currencyLines
                                .filter(cl => cl.key === "platinum")
                                .map(cl => {
                                    const remaining = cl.remaining ?? cl.totalNeed;
                                    const isMet = remaining <= 0;
                                    return (
                                        <div key={cl.key}>
                                            <div className={[
                                                "rounded-xl border px-4 py-3 flex items-center gap-4 mb-3",
                                                isMet ? "border-green-800/40 bg-green-950/20" : "border-indigo-800/40 bg-indigo-950/20"
                                            ].join(" ")}>
                                                <div className="text-3xl">◈</div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold text-slate-100">Total Platinum</div>
                                                    <div className={["text-sm font-mono font-semibold", isMet ? "text-green-400" : "text-indigo-300"].join(" ")}>
                                                        {isMet
                                                            ? `✓ Covered (have ${cl.have.toLocaleString()} ◈)`
                                                            : `${remaining.toLocaleString()} ◈ still needed`}
                                                    </div>
                                                    {!isMet && cl.have > 0 && (
                                                        <div className="text-xs text-slate-400 mt-0.5">
                                                            Have {cl.have.toLocaleString()} ◈ · Total required {cl.totalNeed.toLocaleString()} ◈
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Per-source breakdown */}
                                            {cl.sources.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold px-1">Breakdown by item / rank-up</div>
                                                    {cl.sources.map((s, i) => (
                                                        <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 flex items-center justify-between gap-2">
                                                            <div className="text-xs text-slate-300 min-w-0">
                                                                <span className="font-semibold">{s.name}</span>
                                                                {s.label && <span className="text-slate-500"> · {s.label}</span>}
                                                            </div>
                                                            <div className="text-xs font-mono text-indigo-300 shrink-0">{s.need.toLocaleString()} ◈</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </Section>
            )}

            {/* Hidden items */}
            {showHidden && (
                <Section title="Hidden Items" subtitle="Items excluded from farming view">
                    {filteredHidden.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            No hidden items match the search.
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredHidden.map((h) => (
                                <div key={String(h.key)} className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold break-words">{h.name}</div>
                                        {(h as any).blockedByRecipeComponents?.length > 0 && (
                                            <div className="text-[11px] text-slate-500 mt-0.5 break-words">
                                                Blocked components: {((h as any).blockedByRecipeComponents as string[]).join(", ")}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-slate-400">Need {h.remaining.toLocaleString()}</span>
                                        <span className="text-[10px] rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-400 font-mono">
                                            {HIDDEN_REASON_LABEL[h.reason] ?? h.reason}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {/* Targeted farming */}
            {platView === "farming" && mode === "targeted" && (
                <Section
                    title="Targeted Farming"
                    subtitle={`${filteredTargeted.length.toLocaleString()} item${filteredTargeted.length !== 1 ? "s" : ""} with known acquisition sources`}
                >
                    {filteredTargeted.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            {query ? "No items match the search." : "No actionable items. Add goals or syndicate rank-ups to get started."}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTargeted.map((l) => {
                                const detail = reqLineByKey.get(String(l.key));
                                const have = detail?.have ?? 0;
                                const totalNeed = detail?.totalNeed ?? l.remaining;
                                const pct = totalNeed > 0 ? Math.min(100, Math.round((have / totalNeed) * 100)) : 0;
                                const catalogId = String(l.key);
                                const primeAvailability = getPrimeAvailabilityStatus(catalogId, worldState);

                                return (
                                    <div key={String(l.key)} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-sm font-semibold break-words">{l.name}</span>
                                                    {primeAvailability === "vaulted" && (
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded border border-red-700/50 bg-red-950/40 text-red-400 font-semibold shrink-0"
                                                            title="This prime item is vaulted — obtain via trading or Prime Resurgence (Varzia)"
                                                        >
                                                            VAULTED
                                                        </span>
                                                    )}
                                                    {primeAvailability === "prime_resurgence" && (
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded border border-violet-700/50 bg-violet-950/40 text-violet-300 font-semibold shrink-0"
                                                            title="This prime item is currently obtainable through Varzia's Prime Resurgence relics"
                                                        >
                                                            PRIME RESURGENCE
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Progress bar */}
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-sky-500 transition-all"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <InlineCountEditor
                                                        catalogId={catalogId}
                                                        have={have}
                                                        totalNeed={totalNeed}
                                                    />
                                                </div>

                                                {/* Sources */}
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {(l.sources ?? []).map((s) => {
                                                        const nodeId = sourceIdToStarChartNodeId(String(s.sourceId));
                                                        if (nodeId) {
                                                            return (
                                                                <button
                                                                    key={String(s.sourceId)}
                                                                    className="text-[10px] rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300 hover:bg-cyan-950/30 transition-colors cursor-pointer"
                                                                    title="Open in Star Chart"
                                                                    onClick={() => {
                                                                        setPendingStarChartNodeId(nodeId);
                                                                        setActivePage("starchart");
                                                                    }}
                                                                >
                                                                    {formatSourceDisplayLabel(s.sourceLabel || String(s.sourceId))} ↗
                                                                </button>
                                                            );
                                                        }
                                                        return (
                                                            <span
                                                                key={String(s.sourceId)}
                                                                className="text-[10px] rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-300"
                                                            >
                                                                {formatSourceDisplayLabel(s.sourceLabel || String(s.sourceId))}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                {(() => {
                                                    const seen = new Map<string, WantedSideGoal>();
                                                    for (const source of l.sources ?? []) {
                                                        for (const row of wantedSideGoalsBySource.get(String(source.sourceId)) ?? []) {
                                                            if (row.key === String(l.key)) continue;
                                                            seen.set(row.key, row);
                                                        }
                                                    }
                                                    const matches = Array.from(seen.values()).sort((a, b) => {
                                                        if (a.type !== b.type) return a.type.localeCompare(b.type);
                                                        if (a.remaining !== b.remaining) return b.remaining - a.remaining;
                                                        return a.name.localeCompare(b.name);
                                                    });
                                                    if (matches.length === 0) return null;
                                                    return (
                                                        <div className="mt-2">
                                                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Also wanted here</div>
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {matches.slice(0, 6).map((match) => (
                                                                    <span
                                                                        key={match.key}
                                                                        className={[
                                                                            "text-[10px] rounded-full border px-2 py-0.5",
                                                                            match.type === "arcane"
                                                                                ? "border-amber-700/50 bg-amber-950/20 text-amber-300"
                                                                                : "border-cyan-700/50 bg-cyan-950/20 text-cyan-300",
                                                                        ].join(" ")}
                                                                    >
                                                                        {match.name} · {match.remaining} left
                                                                    </span>
                                                                ))}
                                                                {matches.length > 6 && (
                                                                    <span className="text-[10px] rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-400">
                                                                        +{matches.length - 6} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <div className="text-xs font-mono text-slate-100 font-semibold">
                                                    {l.remaining.toLocaleString()} remaining
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Section>
            )}

            {/* Overlap farming */}
            {platView === "farming" && mode === "overlap" && (
                <Section
                    title="Overlap Farming"
                    subtitle={`${filteredOverlap.length.toLocaleString()} source${filteredOverlap.length !== 1 ? "s" : ""} covering 2+ needed items`}
                >
                    {filteredOverlap.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                            {query ? "No sources match the search." : "No overlap sources found."}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredOverlap.map((g) => (
                                <div key={g.sourceId} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold">{g.sourceLabel}</div>
                                            {(() => {
                                                const wanted = (wantedSideGoalsBySource.get(String(g.sourceId)) ?? []).filter((row) =>
                                                    !(g.items ?? []).some((it) => String(it.key) === row.key),
                                                );
                                                if (wanted.length === 0) return null;
                                                const modCount = wanted.filter((row) => row.type === "mod").length;
                                                const arcaneCount = wanted.filter((row) => row.type === "arcane").length;
                                                const parts = [
                                                    modCount > 0 ? `${modCount} wanted mod${modCount === 1 ? "" : "s"}` : "",
                                                    arcaneCount > 0 ? `${arcaneCount} wanted arcane${arcaneCount === 1 ? "" : "s"}` : "",
                                                ].filter(Boolean);
                                                return <div className="mt-1 text-[11px] text-slate-500">Also rewards {parts.join(" and ")}</div>;
                                            })()}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-xs font-mono text-slate-400">
                                                {g.itemCount} item{g.itemCount !== 1 ? "s" : ""}
                                            </div>
                                            <div className="text-xs font-mono text-slate-300 font-semibold">
                                                {g.totalRemaining.toLocaleString()} total remaining
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                        {(g.items ?? []).map((it) => {
                                            const detail = reqLineByKey.get(String(it.key));
                                            const have = detail?.have ?? 0;
                                            const totalNeed = detail?.totalNeed ?? it.remaining;

                                            return (
                                                <div
                                                    key={String(it.key)}
                                                    className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 flex items-center justify-between gap-2"
                                                >
                                                    <div className="text-xs text-slate-200 truncate">{it.name}</div>
                                                    <InlineCountEditor
                                                        catalogId={String(it.key)}
                                                        have={have}
                                                        totalNeed={totalNeed}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            )}
        </div>
    );
}
