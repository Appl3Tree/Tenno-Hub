// src/pages/Relics.tsx
import { lazy, Suspense, useMemo, useState } from "react";
import { useTrackerStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import IconCommon from "../assets/rarity/IconCommon.png";
import IconRare from "../assets/rarity/IconRare.png";
import IconUncommon from "../assets/rarity/IconUncommon.png";
import {
    expandRelicGoalItemNames,
    getAllRelics,
    scoreRelicsForItems,
    type RelicEntry,
    type ScoredRelic,
} from "../domain/catalog/relicCatalog";
import { getRelicAvailabilityStatus, type RelicAvailabilityStatus } from "../domain/catalog/relicAvailability";
import { useVaultTraderData } from "../lib/useVaultTraderData";
import { WorkspaceSegmented, WorkspaceSegmentedButton } from "../components/workspace/WorkspaceChrome";
import { buildRelicGoalItemNames, getRelicGoalDisplayName } from "../domain/logic/relicGoalExpansion";

const VoidTraceCalc = lazy(() => import("./relics/VoidTraceCalc"));
const RelicFarming = lazy(() => import("./relics/RelicFarming"));

// ---- Helpers ----

const RARITY_COLOR: Record<string, string> = {
    Rare:     "text-amber-100 border-amber-500/50 bg-amber-700/35",
    Uncommon: "text-slate-100 border-slate-400/50 bg-slate-400/30",
    Common:   "text-orange-100 border-orange-700/60 bg-orange-900/40",
};

const RARITY_LABEL: Record<string, string> = {
    Rare: "R", Uncommon: "UC", Common: "C",
};

const RARITY_ICON: Record<string, string> = {
    Rare: IconRare,
    Uncommon: IconUncommon,
    Common: IconCommon,
};

const TIER_COLOR: Record<string, string> = {
    Lith: "text-blue-300  border-blue-700/50  bg-blue-950/30",
    Meso: "text-green-300 border-green-700/50 bg-green-950/30",
    Neo:  "text-purple-300 border-purple-700/50 bg-purple-950/30",
    Axi:  "text-amber-300 border-amber-700/50 bg-amber-950/30",
};

// Void trace costs per refinement level
const REFINEMENT_COSTS = [
    { label: "Intact",      traces: 0,   dropRates: { Rare: 2,  Uncommon: 11,    Common: 25.33 } },
    { label: "Exceptional", traces: 25,  dropRates: { Rare: 4,  Uncommon: 13,    Common: 23.33 } },
    { label: "Flawless",    traces: 50,  dropRates: { Rare: 6,  Uncommon: 17,    Common: 20    } },
    { label: "Radiant",     traces: 100, dropRates: { Rare: 10, Uncommon: 20,    Common: 16.67 } },
];

// ---- Sub-components ----

function TierBadge({ tier }: { tier: string }) {
    const cls = TIER_COLOR[tier] ?? "text-slate-400 border-slate-700 bg-slate-900";
    return (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${cls}`}>
            {tier.toUpperCase()}
        </span>
    );
}

function RarityBadge({ rarity }: { rarity: string }) {
    const cls = RARITY_COLOR[rarity] ?? "text-slate-400 border-slate-700 bg-slate-900";
    const icon = RARITY_ICON[rarity];
    return (
        <span className={`inline-flex min-w-[3rem] items-center justify-center gap-1.5 px-2 py-0.5 rounded border font-semibold shrink-0 ${cls}`}>
            {icon ? <img src={icon} alt="" className="h-3.5 w-3.5 shrink-0 drop-shadow-[0_0_2px_rgba(15,23,42,0.9)]" /> : null}
            <span className="text-[9px] leading-none">{RARITY_LABEL[rarity] ?? rarity}</span>
        </span>
    );
}

function renderHighlightedText(text: string, query: string, highlightClassName: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = trimmedQuery.toLowerCase();
    const parts: Array<string | { match: string; key: string }> = [];

    let startIndex = 0;
    let matchIndex = lowerText.indexOf(lowerQuery, startIndex);
    while (matchIndex !== -1) {
        if (matchIndex > startIndex) {
            parts.push(text.slice(startIndex, matchIndex));
        }

        const endIndex = matchIndex + trimmedQuery.length;
        parts.push({
            match: text.slice(matchIndex, endIndex),
            key: `${matchIndex}-${endIndex}-${parts.length}`,
        });

        startIndex = endIndex;
        matchIndex = lowerText.indexOf(lowerQuery, startIndex);
    }

    if (parts.length === 0) return text;
    if (startIndex < text.length) {
        parts.push(text.slice(startIndex));
    }

    return parts.map((part) =>
        typeof part === "string" ? part : (
            <mark
                key={part.key}
                className={`rounded bg-transparent px-0 font-semibold underline decoration-2 underline-offset-2 ${highlightClassName}`}
            >
                {part.match}
            </mark>
        )
    );
}

function MissionList({ relic, availability }: { relic: RelicEntry; availability: RelicAvailabilityStatus }) {
    const [expanded, setExpanded] = useState(false);
    if (relic.missions.length === 0) {
        if (availability === "prime_resurgence") {
            return <span className="text-xs text-violet-300/80 italic">Available from Varzia (Prime Resurgence)</span>;
        }
        return <span className="text-xs text-red-400/80 italic">No active missions (vaulted)</span>;
    }

    // Deduplicate by pathLabel, keep highest chance per path
    const missions = useMemo(() => {
        const deduped = new Map<string, { pathLabel: string; rotation: string; chance: number }>();
        for (const m of relic.missions) {
            const existing = deduped.get(m.pathLabel);
            if (!existing || m.chance > existing.chance) deduped.set(m.pathLabel, m);
        }
        return Array.from(deduped.values()).sort((a, b) => b.chance - a.chance);
    }, [relic.missions]);
    const shown = expanded ? missions : missions.slice(0, 3);

    return (
        <div className="mt-1 space-y-0.5">
            {shown.map((m) => {
                const parts = m.pathLabel.replace(/missionRewards\s*\/\s*/, "").split(" / ");
                const [planet, node, rot] = parts;
                return (
                    <div key={m.pathLabel} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="text-slate-500">{planet}</span>
                        <span className="text-slate-600">›</span>
                        <span>{node}</span>
                        {rot && (
                            <>
                                <span className="text-slate-600">›</span>
                                <span className="text-slate-500">Rot {rot}</span>
                            </>
                        )}
                        <span className="text-slate-600 ml-auto">{m.chance.toFixed(1)}%</span>
                    </div>
                );
            })}
            {missions.length > 3 && (
                <button
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    onClick={() => setExpanded((x) => !x)}
                >
                    {expanded ? "Show less" : `+${missions.length - 3} more locations`}
                </button>
            )}
        </div>
    );
}

function RelicCard({
    scored, goalItems, availability, searchQuery, showAllRewardsByDefault,
    isSelectedForFarming, onToggleFarming,
}: {
    scored: ScoredRelic;
    goalItems: Set<string>;
    availability: RelicAvailabilityStatus;
    searchQuery: string;
    showAllRewardsByDefault: boolean;
    isSelectedForFarming: boolean;
    onToggleFarming: () => void;
}) {
    const { relic, matchedItems } = scored;
    const [showAllLocalOverride, setShowAllLocalOverride] = useState<boolean | null>(null);
    const [refinement, setRefinement] = useState<(typeof REFINEMENT_COSTS)[number]["label"]>("Intact");
    const refinementConfig = REFINEMENT_COSTS.find((r) => r.label === refinement) ?? REFINEMENT_COSTS[0];
    const showAll = showAllLocalOverride ?? showAllRewardsByDefault;

    // Separate matched rewards (from goals) from the rest
    const allRewards = relic.rewards;
    const otherRewards = allRewards.filter((rw) => !goalItems.has(rw.itemName));

    return (
        <div className={[
            "rounded-xl border p-3 transition-colors",
            availability !== "vaulted"
                ? "border-slate-700 bg-slate-950/40"
                : "border-slate-800/60 bg-slate-950/20 opacity-75",
        ].join(" ")}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <TierBadge tier={relic.tier} />
                <span className="text-sm font-semibold text-slate-100">
                    {renderHighlightedText(relic.displayName, searchQuery, "text-amber-200")}
                </span>
                <button
                    onClick={onToggleFarming}
                    title={isSelectedForFarming ? "Remove from Relic Farming tab" : "Add to Relic Farming tab"}
                    className={[
                        "ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors shrink-0",
                        isSelectedForFarming
                            ? "border-teal-600/60 bg-teal-950/50 text-teal-300 hover:bg-teal-950/80"
                            : "border-slate-700 bg-slate-900/50 text-slate-500 hover:border-slate-500 hover:text-slate-300",
                    ].join(" ")}
                >
                    {isSelectedForFarming ? "✓ Farming" : "+ Farm"}
                </button>
                {availability === "prime_resurgence" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-violet-700/50 bg-violet-950/30 text-violet-300 font-semibold shrink-0">
                        PRIME RESURGENCE
                    </span>
                )}
                {availability === "vaulted" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-700/50 bg-red-950/30 text-red-400 font-semibold shrink-0">
                        VAULTED
                    </span>
                )}
                <span className="text-[10px] text-slate-500">
                    {matchedItems.length}/{allRewards.length} slots match
                </span>
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Refinement</span>
                {REFINEMENT_COSTS.map((lvl) => (
                    <button
                        key={lvl.label}
                        onClick={() => setRefinement(lvl.label)}
                        className={[
                            "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                            refinement === lvl.label
                                ? "border-slate-300 bg-slate-100 text-slate-900"
                                : "border-slate-700 bg-slate-900/50 text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                        ].join(" ")}
                    >
                        {lvl.label}
                    </button>
                ))}
            </div>

            {/* Matched items (from goals) */}
            {matchedItems.length > 0 ? (
                <div className="space-y-1 mb-2">
                    {matchedItems.map((rw) => (
                        <div key={rw.itemName} className="flex items-center gap-1.5 text-xs">
                            <RarityBadge rarity={rw.rarity} />
                            <span className="text-slate-200 font-medium">
                                {renderHighlightedText(rw.itemName, searchQuery, "text-amber-200")}
                            </span>
                            <span className="ml-auto text-slate-500 text-[10px] font-mono">
                                {refinementConfig.dropRates[rw.rarity]}%
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mb-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2 text-[11px] text-slate-500">
                    No active goal rewards in this relic. Expand the other rewards list to inspect its full drop table.
                </div>
            )}

            {/* Other rewards (collapsible) */}
            {otherRewards.length > 0 && (
                <>
                    <button
                        className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors mb-1"
                        onClick={() => setShowAllLocalOverride((current) => !(current ?? showAllRewardsByDefault))}
                    >
                        {showAll ? "Hide other rewards" : `Show ${otherRewards.length} other rewards`}
                    </button>
                    {showAll && (
                        <div className="space-y-0.5 mb-2">
                            {otherRewards.map((rw) => (
                                <div key={rw.itemName} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <RarityBadge rarity={rw.rarity} />
                                    <span>{renderHighlightedText(rw.itemName, searchQuery, "text-amber-200")}</span>
                                    <span className="ml-auto font-mono">{refinementConfig.dropRates[rw.rarity]}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Mission locations */}
            <div className="border-t border-slate-800 pt-2 mt-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Where to farm</div>
                <MissionList relic={relic} availability={availability} />
            </div>
        </div>
    );
}

export default function RelicPlanner() {
    const vaultTrader = useVaultTraderData();
    const { goals, inventory } = useTrackerStore(
        useShallow((s) => ({
            goals: s.state.goals ?? [],
            inventory: s.state.inventory,
        }))
    );

    const [tab, setTab] = useState<"goals" | "traces" | "farming">("goals");
    const [farmingSelectedKeys, setFarmingSelectedKeys] = useState<Set<string>>(new Set());
    const [tierFilter, setTierFilter] = useState<string>("all");
    const [showVaulted, setShowVaulted] = useState(false);
    const [limitToGoalItems, setLimitToGoalItems] = useState(false);
    const [showAllOtherRewards, setShowAllOtherRewards] = useState(false);
    const [showNeededItems, setShowNeededItems] = useState(true);
    const [relicSearch, setRelicSearch] = useState("");

    // Find all relic-sourced items and map to relic catalog entries
    const { scoredRelics, goalItemNames } = useMemo(() => {
        const activeItemGoals = goals.filter((g) => g.isActive && g.type === "item");

        let itemNames = buildRelicGoalItemNames({
            goals: activeItemGoals,
            inventory,
        });

        let expandedItemNames = expandRelicGoalItemNames(itemNames);
        let scored = scoreRelicsForItems(expandedItemNames);

        if (scored.length === 0 && activeItemGoals.length > 0) {
            const fallbackNames = new Set<string>();
            for (const goal of activeItemGoals) {
                const displayName = getRelicGoalDisplayName(String(goal.catalogId));
                if (displayName) fallbackNames.add(displayName);
            }

            if (fallbackNames.size > 0) {
                itemNames = fallbackNames;
                expandedItemNames = expandRelicGoalItemNames(itemNames);
                scored = scoreRelicsForItems(expandedItemNames);
            }
        }

        // Only include items that actually appear in at least one relic —
        // farmingItems may contain non-relic targets (crafting, vendors, etc.)
        const goalItemNames = new Set<string>();
        for (const sr of scored) {
            for (const rw of sr.matchedItems) {
                goalItemNames.add(rw.itemName);
            }
        }

        return { scoredRelics: scored, goalItemNames };
    }, [goals, inventory]);

    const browsableRelics = useMemo(() => {
        const scored = getAllRelics().map((relic) => {
            const matchedItems = relic.rewards.filter((rw) => goalItemNames.has(rw.itemName));
            const score = matchedItems.reduce((sum, rw) => {
                const rarityBonus = rw.rarity === "Rare" ? 1.5 : rw.rarity === "Uncommon" ? 1.1 : 1.0;
                return sum + rarityBonus;
            }, 0);
            return { relic, matchedItems, score };
        });

        return scored.sort((a, b) => b.score - a.score || a.relic.key.localeCompare(b.relic.key));
    }, [goalItemNames]);

    const relicPool = limitToGoalItems ? scoredRelics : browsableRelics;

    const availabilityByRelicKey = useMemo(() => {
        const entries = relicPool.map((sr) => [
            sr.relic.key,
            getRelicAvailabilityStatus(sr.relic.key, sr.relic.isActive, vaultTrader),
        ] as const);
        return new Map<string, RelicAvailabilityStatus>(entries);
    }, [relicPool, vaultTrader]);

    const filteredRelics = useMemo(() => {
        const query = relicSearch.trim().toLowerCase();
        return relicPool.filter((sr) => {
            const availability = availabilityByRelicKey.get(sr.relic.key) ?? "vaulted";
            if (!showVaulted && availability === "vaulted") return false;
            if (tierFilter !== "all" && sr.relic.tier.toLowerCase() !== tierFilter) return false;
            if (!query) return true;

            if (sr.relic.displayName.toLowerCase().includes(query)) return true;
            if (sr.relic.relicName.toLowerCase().includes(query)) return true;
            return sr.relic.rewards.some((reward) => reward.itemName.toLowerCase().includes(query));
        });
    }, [availabilityByRelicKey, relicPool, relicSearch, showVaulted, tierFilter]);

    const relicStats = useMemo(() => {
        let active = 0;
        let resurgence = 0;
        let vaulted = 0;
        for (const sr of relicPool) {
            const availability = availabilityByRelicKey.get(sr.relic.key) ?? "vaulted";
            if (availability === "available") active += 1;
            else if (availability === "prime_resurgence") resurgence += 1;
            else vaulted += 1;
        }
        return { active, resurgence, vaulted };
    }, [availabilityByRelicKey, relicPool]);

    // Items that appear in the currently-visible (filtered) relics
    const filteredGoalItemNames = useMemo(() => {
        const names = new Set<string>();
        for (const sr of filteredRelics) {
            for (const rw of sr.matchedItems) {
                names.add(rw.itemName);
            }
        }
        return names;
    }, [filteredRelics]);

    const hasActiveGoals = goals.some((g) => g.isActive);
    const hasRelicItems = scoredRelics.length > 0;
    const browseModeLabel = limitToGoalItems ? "Goal relics only" : "All relics";

    return (
        <div className="mx-auto max-w-[1500px] space-y-5 px-1 md:px-2">
            <section className="rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-5 py-4 shadow-[var(--wf-shadow-panel)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-accent-primary)]">
                            Planning Workspace
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--wf-text-strong)]">Relic Planner</h1>
                        <p className="mt-1 max-w-3xl text-sm text-[color:var(--wf-text-muted)]">
                            Rank relic opportunities against your active goals, keep vaulted noise under control, and plan trace spend before you crack.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-[color:var(--wf-text-dim)]">Active goals</div>
                            <div className="mt-1 font-mono text-[color:var(--wf-text-strong)]">{goals.filter((g) => g.isActive).length}</div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-[color:var(--wf-text-dim)]">Target parts</div>
                            <div className="mt-1 font-mono text-[color:var(--wf-text-strong)]">{goalItemNames.size}</div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-[color:var(--wf-text-dim)]">Relevant relics</div>
                            <div className="mt-1 font-mono text-[color:var(--wf-text-strong)]">{relicPool.length}</div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-[color:var(--wf-text-dim)]">Visible now</div>
                            <div className="mt-1 font-mono text-[color:var(--wf-text-strong)]">{filteredRelics.length}</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="space-y-4">
            {/* Tab bar */}
            <WorkspaceSegmented className="gap-1.5 bg-transparent border-slate-800 shadow-none">
                {([
                    { key: "goals", label: "Goal Tracker" },
                    { key: "farming", label: "Relic Farming" },
                    { key: "traces", label: "Void Trace Calc" },
                ] as const).map((t) => (
                    <WorkspaceSegmentedButton
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        active={tab === t.key}
                        className="rounded-full border border-slate-700 px-4 py-1.5 text-sm"
                    >
                        {t.label}
                    </WorkspaceSegmentedButton>
                ))}
            </WorkspaceSegmented>

            {/* Goal Tracker tab */}
            {tab === "goals" && (
                <div className="space-y-4">
                    {limitToGoalItems && !hasActiveGoals ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center">
                            <div className="text-slate-400 text-sm">No active goals set.</div>
                            <div className="text-slate-600 text-xs mt-1">Add goals in the Goals page or turn off Goal relics only to browse every relic.</div>
                        </div>
                    ) : limitToGoalItems && !hasRelicItems ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center">
                            <div className="text-slate-400 text-sm">No relic-farmable items found in your active goals.</div>
                            <div className="text-slate-600 text-xs mt-1">
                                Your goals may require crafting, trading, or vendor purchases rather than relic cracking. Turn off Goal relics only to browse every relic anyway.
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Items to find</div>
                                    <div className="mt-0.5 font-mono text-sm text-slate-100">{goalItemNames.size}</div>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Relevant relics</div>
                                    <div className="mt-0.5 font-mono text-sm text-slate-100">{relicPool.length}</div>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Active relics</div>
                                    <div className="mt-0.5 font-mono text-sm text-slate-100">
                                        {relicStats.active}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Prime Resurgence</div>
                                    <div className="mt-0.5 font-mono text-sm text-slate-100">
                                        {relicStats.resurgence}
                                    </div>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-wrap gap-2 items-center">
                                <button
                                    onClick={() => setLimitToGoalItems((x) => !x)}
                                    className={[
                                        "rounded-full px-3 py-1 text-xs border transition-colors",
                                        limitToGoalItems
                                            ? "bg-[color:var(--wf-accent-primary)]/15 text-[color:var(--wf-accent-primary)] border-[color:var(--wf-accent-primary)]/40"
                                            : "bg-slate-950/40 text-slate-300 border-slate-700 hover:bg-slate-900"
                                    ].join(" ")}
                                >
                                    {limitToGoalItems ? "Goal relics only" : "All relics"}
                                </button>
                                <span className="text-xs text-slate-500">Tier:</span>
                                {["all", "lith", "meso", "neo", "axi"].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTierFilter(t)}
                                        className={[
                                            "rounded-full px-3 py-1 text-xs border transition-colors capitalize",
                                            tierFilter === t
                                                ? "bg-slate-100 text-slate-900 border-slate-100"
                                                : "bg-slate-950/40 text-slate-300 border-slate-700 hover:bg-slate-900"
                                        ].join(" ")}
                                    >
                                        {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setShowVaulted((x) => !x)}
                                    className={[
                                        "rounded-full px-3 py-1 text-xs border transition-colors ml-auto",
                                        showVaulted
                                            ? "bg-red-950/40 text-red-300 border-red-700/50"
                                            : "bg-slate-950/40 text-slate-400 border-slate-700 hover:bg-slate-900"
                                    ].join(" ")}
                                >
                                    {showVaulted ? "Hide vaulted" : "Show vaulted"}
                                </button>
                                <button
                                    onClick={() => setShowAllOtherRewards((x) => !x)}
                                    className={[
                                        "rounded-full px-3 py-1 text-xs border transition-colors",
                                        showAllOtherRewards
                                            ? "bg-amber-950/40 text-amber-200 border-amber-700/50"
                                            : "bg-slate-950/40 text-slate-300 border-slate-700 hover:bg-slate-900"
                                    ].join(" ")}
                                >
                                    {showAllOtherRewards ? "Hide all other rewards" : "Show all other rewards"}
                                </button>
                            </div>

                            {/* Goal items needed */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                                <button
                                    type="button"
                                    onClick={() => setShowNeededItems((x) => !x)}
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                >
                                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                                        {limitToGoalItems ? "Items needed from relics" : "Goal items highlighted in current results"}
                                    </div>
                                    <span className="text-slate-500 text-sm leading-none">{showNeededItems ? "▾" : "▸"}</span>
                                </button>
                                {showNeededItems && (
                                    filteredGoalItemNames.size > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {Array.from(filteredGoalItemNames).sort().map((name) => (
                                                <span
                                                    key={name}
                                                    className="text-xs px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/50 text-slate-300"
                                                >
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-2 text-xs text-slate-500">
                                            {hasActiveGoals
                                                ? "No currently visible relics match your goal items."
                                                : "Set active goals to highlight matching rewards here while browsing all relics."}
                                        </div>
                                    )
                                )}
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                                <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-2">
                                    Search {browseModeLabel}
                                </label>
                                <input
                                    type="text"
                                    aria-label={`Search ${browseModeLabel.toLowerCase()} by relic name or reward item`}
                                    value={relicSearch}
                                    onChange={(e) => setRelicSearch(e.target.value)}
                                    placeholder="Search relic name or reward item"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500"
                                />
                                {!!relicSearch.trim() && (
                                    <div className="mt-2 text-[10px] text-slate-500">
                                        Showing {filteredRelics.length} matching relic{filteredRelics.length === 1 ? "" : "s"} for "{relicSearch.trim()}"
                                    </div>
                                )}
                            </div>

                            {/* Relic cards */}
                            {filteredRelics.length === 0 ? (
                                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400 text-center">
                                    No relics match the current filter.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-xs text-slate-500">
                                        {hasActiveGoals
                                            ? "Sorted by relevance — relics containing more of your needed items appear first."
                                            : "Sorted alphabetically until you add active goals, then matching relics rise to the top."}
                                        {!showVaulted && relicStats.vaulted > 0 && (
                                            <span className="ml-1">
                                                <button
                                                    className="text-red-400 hover:text-red-300 underline"
                                                    onClick={() => setShowVaulted(true)}
                                                >
                                                    {relicStats.vaulted} vaulted relics hidden
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                    {filteredRelics.map((sr) => (
                                        <RelicCard
                                            key={sr.relic.key}
                                            scored={sr}
                                            goalItems={goalItemNames}
                                            availability={availabilityByRelicKey.get(sr.relic.key) ?? "vaulted"}
                                            searchQuery={relicSearch}
                                            showAllRewardsByDefault={showAllOtherRewards}
                                            isSelectedForFarming={farmingSelectedKeys.has(sr.relic.key)}
                                            onToggleFarming={() => setFarmingSelectedKeys((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(sr.relic.key)) next.delete(sr.relic.key);
                                                else next.add(sr.relic.key);
                                                return next;
                                            })}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Relic Farming tab */}
            {tab === "farming" && (
                <Suspense fallback={<div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">Loading…</div>}>
                    <RelicFarming selectedKeys={farmingSelectedKeys} setSelectedKeys={setFarmingSelectedKeys} />
                </Suspense>
            )}

            {/* Void Trace Calc tab */}
            {tab === "traces" && (
                <Suspense fallback={<div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">Loading trace tools…</div>}>
                    <VoidTraceCalc />
                </Suspense>
            )}
        </div>
        </div>
    );
}
