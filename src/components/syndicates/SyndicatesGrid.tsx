// SyndicatesGrid — main syndicate overview grid component.
// Extracted from SyndicatesGrid.tsx as part of Phase 5 file decomposition.

import React, { useMemo, useState } from "react";
import { useTrackerStore } from "../../store/store";
import { SY } from "../../domain/ids/syndicateIds";
import type { SyndicateId } from "../../domain/ids/syndicateIds";
import type { SyndicateState } from "../../domain/types";
import SyndicateDetailsModal from "./SyndicateDetailsModal";
import SimarisSynthesisModal from "./SimarisSynthesisModal";
import { getSyndicateVendorEntry } from "../../domain/catalog/syndicates/syndicateVendorCatalog";
import { readOwnedMap, countOwned } from "../../domain/syndicates/ownedOfferings";
import { getRankTitle } from "../../domain/catalog/syndicates/rankTitles";
import {
    TABS,
    CANONICAL_SYNDICATES,
    syndicateIconUrl,
    type CanonicalSyndicate,
    type TabKey,
} from "./syndicateData";
import {
    pillClass,
    parseIntSafeSigned,
    clamp,
    formatRange,
    hasRanksForSyndicate,
    standingRangeForSyndicate,
    computeDailyStandingCap,
    findCanonNameById,
    RelationshipPill,
    PlaceholderIcon,
    pledgeIconButtonClass,
    cardActionButtonClass,
    selectClass,
    inputClass,
    type NetRow,
    computeNetRatesForPrimary,
    netTone,
    netChipClass,
    formatNet,
    estimateStandingToMaxRank,
    nightcapRankFromMushrooms,
    computeRankedCombos,
    flattenOfferings,
    collectCurrencyNames,
} from "./syndicateGridHelpers";

export default function SyndicatesGrid() {
    const masteryRank = useTrackerStore((s) => s.state.player.masteryRank);

    const playerSyndicates = useTrackerStore((s) => s.state.syndicates) ?? [];
    const upsertSyndicate = useTrackerStore((s) => s.upsertSyndicate);

    const [activeTab, setActiveTab] = useState<TabKey>("primary");

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsSyndicateId, setDetailsSyndicateId] = useState<string>("");
    const [detailsTitle, setDetailsTitle] = useState<string>("");
    const [detailsInitialTab, setDetailsInitialTab] = useState<"ranks" | "offerings">("ranks");
    const [detailsInitialOwnedFilter, setDetailsInitialOwnedFilter] = useState<"all" | "owned" | "unowned">("all");
    const [detailsPlayerRank, setDetailsPlayerRank] = useState<number>(0);
    const [synthesisOpen, setSynthesisOpen] = useState(false);

    // Bump this when the modal closes to force re-read of localStorage for missing counts
    const [ownedRefreshKey, setOwnedRefreshKey] = useState(0);

    const [standingDraftById, setStandingDraftById] = useState<Record<string, string>>({});

    function openDetails(
        syndicateId: string,
        title: string,
        tab: "ranks" | "offerings",
        ownedFilter: "all" | "owned" | "unowned" = "all",
        playerRank = 0
    ) {
        setDetailsSyndicateId(syndicateId);
        setDetailsTitle(title);
        setDetailsInitialTab(tab);
        setDetailsInitialOwnedFilter(ownedFilter);
        setDetailsPlayerRank(playerRank);
        setDetailsOpen(true);
    }

    function closeDetails() {
        setDetailsOpen(false);
        setOwnedRefreshKey((k) => k + 1);
    }

    const overlayById = useMemo(() => {
        const m = new Map<string, SyndicateState>();
        for (const s of playerSyndicates ?? []) {
            if (s && typeof (s as any).id === "string") {
                m.set((s as any).id, s as any);
            }
        }
        return m;
    }, [playerSyndicates]);

    const primaryCanon = useMemo(() => CANONICAL_SYNDICATES.filter((c) => c.tab === "primary"), []);

    // Source-of-truth: pledged is stored in the SyndicateState row via upsertSyndicate.
    function setPledged(id: string, pledged: boolean) {
        const canon = primaryCanon.find((c) => c.id === id) ?? CANONICAL_SYNDICATES.find((c) => c.id === id);
        upsertSyndicate({
            id,
            name: canon?.name ?? id,
            pledged
        });
    }

    const pledgedCount = useMemo(() => {
        let n = 0;
        for (const c of primaryCanon) {
            const overlay = overlayById.get(c.id);
            if (overlay?.pledged) n++;
        }
        return n;
    }, [primaryCanon, overlayById]);

    const currentPledgedIds = useMemo(() => {
        const out: string[] = [];
        for (const c of primaryCanon) {
            const ov = overlayById.get(c.id);
            if (ov?.pledged) out.push(c.id);
        }
        return out;
    }, [primaryCanon, overlayById]);

    const pledgeNetNow = useMemo(() => {
        return computeNetRatesForPrimary(primaryCanon, currentPledgedIds);
    }, [primaryCanon, currentPledgedIds]);

    const netBuckets = useMemo(() => {
        const pos: NetRow[] = [];
        const zero: NetRow[] = [];
        const neg: NetRow[] = [];

        for (const r of pledgeNetNow) {
            const t = netTone(r.net);
            if (t === "pos") pos.push(r);
            else if (t === "zero") zero.push(r);
            else neg.push(r);
        }

        pos.sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
        zero.sort((a, b) => a.name.localeCompare(b.name));
        neg.sort((a, b) => a.net - b.net || a.name.localeCompare(b.name));

        return { pos, zero, neg };
    }, [pledgeNetNow]);

    // Conflict simulation: top recommendations from all 42 pledge combinations
    const rankedCombos = useMemo(() => computeRankedCombos(primaryCanon), [primaryCanon]);
    // Top 4 two-syndicate pairs from the algorithm (cross-chain pairs ranked by coverage)
    const topPairs = useMemo(
        () => rankedCombos.filter((c) => c.ids.length === 2).slice(0, 4),
        [rankedCombos]
    );

    function applyCombo(ids: string[]) {
        for (const c of primaryCanon) setPledged(c.id, false);
        for (const id of ids) setPledged(id, true);
    }

    const [simOpen, setSimOpen] = useState(false);

    const showPledgePanel = activeTab === "all" || activeTab === "primary";

    const rowsForTab = useMemo(() => {
        let list: CanonicalSyndicate[];

        if (activeTab === "all") list = [...CANONICAL_SYNDICATES];
        else list = CANONICAL_SYNDICATES.filter((c) => c.tab === activeTab);

        if (activeTab === "primary") return list;

        const copy = [...list];
        copy.sort((a, b) => a.name.localeCompare(b.name));
        return copy;
    }, [activeTab]);

    const { cap: dailyCapComputed, isEstimated: mrMissing } = computeDailyStandingCap(masteryRank);

    const detailsEntry = useMemo(() => {
        if (!detailsSyndicateId) return null;
        return getSyndicateVendorEntry(detailsSyndicateId);
    }, [detailsSyndicateId]);

    function commitStanding(canon: CanonicalSyndicate, range: { min: number; max: number } | null, raw: string) {
        const parsed = parseIntSafeSigned(raw);
        const clamped = range ? clamp(parsed, range.min, range.max) : Math.max(0, parsed);
        const patch: Parameters<typeof upsertSyndicate>[0] = {
            id: canon.id,
            name: canon.name,
            standing: clamped
        };
        // Nightcap rank is auto-derived from mushrooms analyzed
        if (canon.id === SY.NIGHTCAP) {
            patch.rank = nightcapRankFromMushrooms(clamped);
        }
        upsertSyndicate(patch);

        setStandingDraftById((prev) => {
            const next = { ...prev };
            delete next[canon.id];
            return next;
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex flex-wrap gap-2">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            className={pillClass(t.key === activeTab)}
                            onClick={() => setActiveTab(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="mt-3 flex flex-col gap-3">
                    <div className="text-xs text-slate-400">
                        {mrMissing ? (
                            <span>Daily Standing caps shown at minimum (MR 0). Add MR in the Profile panel to update caps.</span>
                        ) : (
                            <span>Daily Standing caps computed using your MR ({masteryRank}).</span>
                        )}
                    </div>

                    {showPledgePanel ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-100">Primary Pledges</div>
                                    <div className="text-xs text-slate-400 mt-0.5">Pledge to a syndicate to view the simulator. Toggle up to 3. ({pledgedCount}/3)</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <button
                                            className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200 hover:bg-slate-900"
                                            type="button"
                                            onClick={() => setSimOpen((v) => !v)}
                                            aria-expanded={simOpen}
                                            title="Show recommended pledge combinations"
                                        >
                                            Hint
                                        </button>

                                        {simOpen ? (
                                            <div className="wf-popover absolute right-0 z-30 mt-2 w-[440px] rounded-xl border p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="text-xs font-semibold text-slate-100">Pledge recommendations</div>
                                                    <button
                                                        className="shrink-0 rounded-lg border border-slate-700 bg-slate-950/30 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-900"
                                                        type="button"
                                                        onClick={() => setSimOpen(false)}
                                                    >
                                                        Close
                                                    </button>
                                                </div>

                                                {/* Section 1: Triple allied chains */}
                                                <div className="mt-3">
                                                    <div className="text-[11px] font-semibold text-slate-300 mb-1">Triple-chain picks — max 3 syndicates, no swapping needed</div>
                                                    <div className="mb-2 text-[11px] text-slate-400">
                                                        Earning standing in any one chain member never hurts the other two. Pledge all three and rank each up to max at your own pace — the only syndicates that go negative are those in the opposite chain, which you never need.
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {[
                                                            [SY.STEEL_MERIDIAN, SY.ARBITERS_OF_HEXIS, SY.CEPHALON_SUDA],
                                                            [SY.THE_PERRIN_SEQUENCE, SY.NEW_LOKA, SY.RED_VEIL]
                                                        ].map((chainIds, idx) => {
                                                            const currentSet = new Set(currentPledgedIds);
                                                            const isActive =
                                                                chainIds.length === currentPledgedIds.length &&
                                                                chainIds.every((id) => currentSet.has(id));
                                                            return (
                                                                <div
                                                                    key={`chain-${idx}`}
                                                                    className={[
                                                                        "flex items-center justify-between gap-2 rounded-lg border p-2",
                                                                        isActive
                                                                            ? "border-emerald-700/50 bg-emerald-950/20"
                                                                            : "border-slate-800 bg-slate-950/40"
                                                                    ].join(" ")}
                                                                >
                                                                    <div className="min-w-0 flex flex-wrap gap-1.5">
                                                                        {chainIds.map((id) => (
                                                                            <span
                                                                                key={id}
                                                                                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-[11px] text-slate-200"
                                                                            >
                                                                                {findCanonNameById(id)}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    {isActive ? (
                                                                        <span className="shrink-0 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] text-emerald-200">
                                                                            Active
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            className="shrink-0 rounded-lg border border-slate-700 bg-slate-950/30 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-900"
                                                                            type="button"
                                                                            onClick={() => { applyCombo(chainIds); setSimOpen(false); }}
                                                                        >
                                                                            Apply
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Section 2: Top cross-chain pairs */}
                                                <div className="mt-3">
                                                    <div className="text-[11px] font-semibold text-slate-300 mb-1">Cross-chain pairs — broader rewards, requires swapping</div>
                                                    <div className="mb-2 text-[11px] text-slate-400">
                                                        These pairs cover more unique offerings than a single chain, but the two syndicates belong to opposing networks and slightly drain each other's standing. Swap between them regularly — rank one up, then switch focus to the other before it falls below 0. Recovering from negative ranks costs rare resources.
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {topPairs.map((combo, idx) => {
                                                            const currentSet = new Set(currentPledgedIds);
                                                            const isActive =
                                                                combo.ids.length === currentPledgedIds.length &&
                                                                combo.ids.every((id) => currentSet.has(id));
                                                            return (
                                                                <div
                                                                    key={`pair-${idx}`}
                                                                    className={[
                                                                        "flex items-center justify-between gap-2 rounded-lg border p-2",
                                                                        isActive
                                                                            ? "border-emerald-700/50 bg-emerald-950/20"
                                                                            : "border-slate-800 bg-slate-950/40"
                                                                    ].join(" ")}
                                                                >
                                                                    <div className="min-w-0 flex flex-wrap gap-1.5">
                                                                        {combo.ids.map((id) => (
                                                                            <span
                                                                                key={id}
                                                                                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-[11px] text-slate-200"
                                                                            >
                                                                                {findCanonNameById(id)}
                                                                            </span>
                                                                        ))}
                                                                        <span className="text-[10px] text-slate-500 self-center">
                                                                            {combo.posCount}✓{combo.negCount > 0 ? ` ${combo.negCount}✗` : ""}
                                                                        </span>
                                                                    </div>
                                                                    {isActive ? (
                                                                        <span className="shrink-0 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] text-emerald-200">
                                                                            Active
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            className="shrink-0 rounded-lg border border-slate-700 bg-slate-950/30 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-900"
                                                                            type="button"
                                                                            onClick={() => { applyCombo(combo.ids); setSimOpen(false); }}
                                                                        >
                                                                            Apply
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <button
                                        className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200 hover:bg-slate-900"
                                        onClick={() => {
                                            for (const c of primaryCanon) setPledged(c.id, false);
                                        }}
                                        title="Clear pledged selections"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                {primaryCanon.map((c) => {
                                    const overlay = overlayById.get(c.id);
                                    const isOn = Boolean(overlay?.pledged);
                                    const disabled = !isOn && pledgedCount >= 3;

                                    const iconUrl = syndicateIconUrl(c.iconFile);

                                    return (
                                        <button
                                            key={c.id}
                                            className={pledgeIconButtonClass(isOn, disabled)}
                                            onClick={() => {
                                                if (disabled) return;
                                                if (isOn) { setPledged(c.id, false); return; }
                                                if (pledgedCount >= 3) return;
                                                setPledged(c.id, true);
                                            }}
                                            title={c.name}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg border border-white/10 bg-black/15 p-1">
                                                    {iconUrl ? (
                                                        <img
                                                            src={iconUrl}
                                                            alt={`${c.name} icon`}
                                                            className="h-7 w-7 object-contain"
                                                            loading="lazy"
                                                            decoding="async"
                                                        />
                                                    ) : (
                                                        <PlaceholderIcon className="h-7 w-7" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <div className="text-xs font-semibold leading-tight truncate">{c.name}</div>
                                                    <div className="text-[11px] text-slate-400 leading-tight">
                                                        {isOn ? "Pledged" : "Not pledged"}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Simulation appears only after the player selects at least one pledge */}
                            {currentPledgedIds.length > 0 ? (
                                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-3">
                                        <div className="text-xs font-semibold text-emerald-200">Positives</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {netBuckets.pos.length ? (
                                                netBuckets.pos.map((r) => (
                                                    <span
                                                        key={`pos-${r.id}`}
                                                        className={[
                                                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                                                            netChipClass("pos")
                                                        ].join(" ")}
                                                        title={r.id}
                                                    >
                                                        {r.name}: <span className="ml-1 font-mono">{formatNet(r.net)}</span>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-slate-500">None</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-3">
                                        <div className="text-xs font-semibold text-amber-200">Neutrals</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {netBuckets.zero.length ? (
                                                netBuckets.zero.map((r) => (
                                                    <span
                                                        key={`zero-${r.id}`}
                                                        className={[
                                                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                                                            netChipClass("zero")
                                                        ].join(" ")}
                                                        title={r.id}
                                                    >
                                                        {r.name}: <span className="ml-1 font-mono">{formatNet(r.net)}</span>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-slate-500">None</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-3">
                                        <div className="text-xs font-semibold text-rose-200">Negatives</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {netBuckets.neg.length ? (
                                                netBuckets.neg.map((r) => (
                                                    <span
                                                        key={`neg-${r.id}`}
                                                        className={[
                                                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                                                            netChipClass("neg")
                                                        ].join(" ")}
                                                        title={r.id}
                                                    >
                                                        {r.name}: <span className="ml-1 font-mono">{formatNet(r.net)}</span>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-slate-500">None</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {rowsForTab.map((canon) => {
                    const overlay = overlayById.get(canon.id);

                    const rawRank = overlay && typeof overlay.rank === "number" ? overlay.rank : 0;
                    const maxRank = canon.maxRank ?? 5;
                    const rank = canon.isFaction
                        ? clamp(rawRank, -2, 5)
                        : canon.id === SY.NIGHTCAP
                            ? nightcapRankFromMushrooms(
                                overlay && typeof overlay.standing === "number" ? clamp(overlay.standing, 0, 16) : 0
                              )
                            : clamp(rawRank, 0, maxRank);

                    const range = standingRangeForSyndicate(canon, rank);

                    const rawStanding = overlay && typeof overlay.standing === "number" ? overlay.standing : 0;
                    const standing = range ? clamp(rawStanding, range.min, range.max) : Math.max(0, rawStanding);

                    const pledged = canon.isFaction ? Boolean(overlay?.pledged) : false;

                    const isNightcapProgress = canon.id === SY.NIGHTCAP;

                    const showStanding = canon.model === "standing" || canon.model === "event-standing" || isNightcapProgress;
                    const showCaps = canon.model === "standing" && canon.id !== SY.CEPHALON_SIMARIS;

                    const iconUrl = syndicateIconUrl(canon.iconFile);

                    const cardStyle: React.CSSProperties = {
                        backgroundColor: canon.bg,
                        color: canon.fg
                    };

                    const standingDraft = standingDraftById[canon.id];
                    const standingInputValue = typeof standingDraft === "string" ? standingDraft : String(standing);

                    const canShowRanksButton = hasRanksForSyndicate(canon);

                    // Missing offerings count (read from localStorage, refreshes after modal closes)
                    const vendorEntry = getSyndicateVendorEntry(canon.id);
                    const flatOfferings = flattenOfferings(vendorEntry);
                    const ownedMapForCard = flatOfferings.length > 0
                        // eslint-disable-next-line react-hooks/exhaustive-deps
                        ? (() => { void ownedRefreshKey; return readOwnedMap(canon.id); })()
                        : {};
                    const { owned: ownedCount, total: totalOfferings } = countOwned(flatOfferings, ownedMapForCard);
                    const missingCount = totalOfferings - ownedCount;

                    // Currency reminder
                    const currencyNames = collectCurrencyNames(vendorEntry);

                    // Estimate to max rank (all standard standing-based syndicates)
                    const showEstimate = showCaps && rank < maxRank;
                    const standingToMax = showEstimate ? estimateStandingToMaxRank(rank, standing, maxRank) : 0;
                    const daysToMax = showEstimate && dailyCapComputed > 0
                        ? Math.ceil(standingToMax / dailyCapComputed)
                        : null;

                    // Rank title lookup
                    const rankTitle = getRankTitle(canon.id as SyndicateId, rank);

                    // Kahl's Garrison: weekly mission progression, max rank 5
                    const kahlWeeksToMax = canon.id === SY.KAHLS_GARRISON && rank < 5
                        ? 5 - rank
                        : null;

                    return (
                        <div
                            key={canon.id}
                            className="rounded-2xl border border-slate-800 overflow-hidden"
                            style={cardStyle}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex items-start gap-3">
                                        <div className="shrink-0 rounded-xl border border-white/10 bg-black/15 p-2">
                                            {iconUrl ? (
                                                <img
                                                    src={iconUrl}
                                                    alt={`${canon.name} icon`}
                                                    className="h-12 w-12 object-contain"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <PlaceholderIcon className="h-12 w-12" />
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="text-lg font-semibold break-words">{canon.name}</div>
                                            <div className="mt-1 text-xs opacity-90">{canon.detail}</div>

                                            {canon.isFaction && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={[
                                                            "rounded-full border px-3 py-1 text-xs font-semibold",
                                                            pledged
                                                                ? "bg-white/15 text-inherit border-white/20"
                                                                : "bg-black/20 text-inherit border-white/20"
                                                        ].join(" ")}
                                                        title="Managed via the pledge toggles above (max 3)."
                                                    >
                                                        {pledged ? "Pledged" : "Not Pledged"}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-[11px] opacity-90 font-mono">
                                        {canon.model === "standing"
                                            ? "Standing"
                                            : canon.model === "event-standing"
                                                ? "Event"
                                                : canon.model === "nightwave"
                                                    ? "System"
                                                    : isNightcapProgress
                                                        ? "Progress"
                                                        : "No Standing"}
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {canShowRanksButton ? (
                                        <button
                                            className={cardActionButtonClass()}
                                            onClick={() => openDetails(canon.id, `${canon.name} - Ranks`, "ranks", "all", rank)}
                                            title="View rank-up requirements"
                                        >
                                            Ranks
                                        </button>
                                    ) : null}

                                    <button
                                        className={cardActionButtonClass()}
                                        onClick={() => openDetails(canon.id, `${canon.name} - Offerings`, "offerings")}
                                        title="View all vendor offerings"
                                    >
                                        Offerings
                                    </button>

                                    {canon.id === SY.CEPHALON_SIMARIS && (
                                        <button
                                            className={cardActionButtonClass()}
                                            onClick={() => setSynthesisOpen(true)}
                                            title="View all synthesis target locations"
                                        >
                                            Synthesis Targets
                                        </button>
                                    )}

                                    {totalOfferings > 0 ? (
                                        <button
                                            className={[
                                                cardActionButtonClass(),
                                                missingCount === 0 ? "opacity-60" : ""
                                            ].join(" ")}
                                            onClick={() => openDetails(canon.id, `${canon.name} - Missing`, "offerings", "unowned")}
                                            title={`${missingCount} unowned of ${totalOfferings} offerings`}
                                        >
                                            Missing: {missingCount}/{totalOfferings}
                                        </button>
                                    ) : null}
                                </div>

                                {/* Currency reminder */}
                                {currencyNames.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {currencyNames.map((name) => (
                                            <span
                                                key={name}
                                                className="inline-flex items-center rounded-full border border-white/15 bg-black/15 px-2 py-0.5 text-[11px] opacity-90"
                                                title={`This syndicate uses ${name}`}
                                            >
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                {canon.isFaction && canon.relationship && (
                                    <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                                        <div className="text-sm font-semibold">Relationships</div>
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <RelationshipPill
                                                label="Allied (+50%)"
                                                ids={canon.relationship.allied ?? []}
                                                tone="ally"
                                            />
                                            <RelationshipPill
                                                label="Opposed (-50%)"
                                                ids={canon.relationship.opposed ?? []}
                                                tone="oppose"
                                            />
                                            <RelationshipPill
                                                label="Enemy (-100%)"
                                                ids={canon.relationship.enemy ?? []}
                                                tone="enemy"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {hasRanksForSyndicate(canon) ? (
                                        <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                                            <div className="text-xs opacity-90 mb-1">Rank</div>

                                            {canon.isFaction ? (
                                                <select
                                                    className={selectClass()}
                                                    value={String(rank)}
                                                    onChange={(e) => {
                                                        const next = parseIntSafeSigned(e.target.value);
                                                        upsertSyndicate({
                                                            id: canon.id,
                                                            name: canon.name,
                                                            rank: clamp(next, -2, 5)
                                                        });
                                                    }}
                                                >
                                                    <option value="-2">-2</option>
                                                    <option value="-1">-1</option>
                                                    <option value="0">0</option>
                                                    <option value="1">1</option>
                                                    <option value="2">2</option>
                                                    <option value="3">3</option>
                                                    <option value="4">4</option>
                                                    <option value="5">5</option>
                                                </select>
                                            ) : canon.id === SY.NIGHTCAP ? (
                                                <div className="text-sm font-mono">{rank}</div>
                                            ) : maxRank > 10 ? (
                                                <input
                                                    className={inputClass()}
                                                    value={String(rank)}
                                                    inputMode="numeric"
                                                    onChange={(e) =>
                                                        upsertSyndicate({
                                                            id: canon.id,
                                                            name: canon.name,
                                                            rank: clamp(Math.max(0, parseIntSafeSigned(e.target.value)), 0, maxRank)
                                                        })
                                                    }
                                                />
                                            ) : (
                                                <select
                                                    className={selectClass()}
                                                    value={String(rank)}
                                                    onChange={(e) => {
                                                        const next = parseIntSafeSigned(e.target.value);
                                                        upsertSyndicate({
                                                            id: canon.id,
                                                            name: canon.name,
                                                            rank: clamp(next, 0, maxRank)
                                                        });
                                                    }}
                                                >
                                                    {Array.from({ length: maxRank + 1 }, (_, i) => (
                                                        <option key={i} value={String(i)}>{i}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {rankTitle && (
                                                <div className="mt-1 text-sm font-medium opacity-90">{rankTitle}</div>
                                            )}

                                            {canon.isFaction ? (
                                                <div className="mt-1 text-[11px] opacity-75">Relay factions support ranks -2..5.</div>
                                            ) : canon.id === SY.NIGHTCAP ? (
                                                <div className="mt-1 text-[11px] opacity-75">Auto-derived from mushrooms analyzed.</div>
                                            ) : canon.id === SY.NIGHTWAVE ? (
                                                <div className="mt-1 text-[11px] opacity-75">Ranks 1–30 (normal) + 31–180 (prestige).</div>
                                            ) : (
                                                <div className="mt-1 text-[11px] opacity-75">Ranks 0–{maxRank}.</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                                            <div className="text-xs opacity-90 mb-1">Rank</div>
                                            <div className="text-sm opacity-90">No ranks. Standing only.</div>
                                            <div className="mt-1 text-[11px] opacity-90">Cephalon Simaris has no rank ladder.</div>
                                        </div>
                                    )}

                                    {showStanding ? (
                                        <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                                            <div className="text-xs opacity-90 mb-1">
                                                {isNightcapProgress ? "Mushrooms analyzed (x/16)" : "Standing"}
                                            </div>

                                            <input
                                                className={inputClass()}
                                                value={standingInputValue}
                                                inputMode="numeric"
                                                onChange={(e) => {
                                                    setStandingDraftById((prev) => ({
                                                        ...prev,
                                                        [canon.id]: e.target.value
                                                    }));
                                                }}
                                                onBlur={() => {
                                                    const draft = standingDraftById[canon.id];
                                                    if (typeof draft !== "string") return;
                                                    commitStanding(canon, range, draft);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key !== "Enter") return;
                                                    const draft = standingDraftById[canon.id];
                                                    const raw = typeof draft === "string" ? draft : standingInputValue;
                                                    commitStanding(canon, range, raw);
                                                    (e.target as HTMLInputElement).blur();
                                                }}
                                            />

                                            {range ? (
                                                <div className="mt-1 text-[11px] opacity-90">
                                                    Valid range: {formatRange(range.min, range.max)}
                                                </div>
                                            ) : (
                                                <div className="mt-1 text-[11px] opacity-90">
                                                    {isNightcapProgress ? "Progress counter." : "Current standing into rank."}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                                            <div className="text-xs opacity-90 mb-1">Standing</div>
                                            <div className="text-sm opacity-90">Not applicable for this progression model.</div>
                                        </div>
                                    )}
                                </div>

                                {showCaps ? (
                                    <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                                        <div className="text-sm font-semibold">Caps</div>
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                                <div className="text-xs opacity-90 mb-1">Daily Standing Cap</div>
                                                <div className="text-sm font-mono">{dailyCapComputed.toLocaleString()}</div>
                                                <div className="mt-1 text-[11px] opacity-90">
                                                    {mrMissing ? "Minimum (Set MR in Profile)." : `Based on MR ${masteryRank}.`}
                                                </div>
                                            </div>

                                            {showEstimate ? (
                                                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                                    <div className="text-xs opacity-90 mb-1">Est. to Max Rank</div>
                                                    {rank >= maxRank ? (
                                                        <div className="text-sm font-mono">Max rank</div>
                                                    ) : (
                                                        <>
                                                            <div className="text-sm font-mono">{standingToMax.toLocaleString()} standing</div>
                                                            {daysToMax !== null ? (
                                                                <div className="mt-1 text-[11px] opacity-90">
                                                                    ~{daysToMax.toLocaleString()} day{daysToMax !== 1 ? "s" : ""} at daily cap
                                                                </div>
                                                            ) : null}
                                                        </>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}

                                {kahlWeeksToMax !== null ? (
                                    <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                                        <div className="text-sm font-semibold">Est. to Max Rank</div>
                                        <div className="mt-2 text-sm font-mono">
                                            {kahlWeeksToMax} week{kahlWeeksToMax !== 1 ? "s" : ""} of weekly missions
                                        </div>
                                        <div className="mt-1 text-[11px] opacity-75">1 Break Narmer mission advances 1 rank.</div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>

            <SyndicateDetailsModal
                open={detailsOpen}
                onClose={closeDetails}
                title={detailsTitle || "Syndicate Details"}
                entry={detailsEntry}
                initialTab={detailsInitialTab}
                initialOwnedFilter={detailsInitialOwnedFilter}
                initialSortKey={detailsInitialOwnedFilter === "unowned" ? "rankAsc" : undefined}
                playerRank={detailsPlayerRank}
            />

            <SimarisSynthesisModal
                open={synthesisOpen}
                onClose={() => setSynthesisOpen(false)}
            />
        </div>
    );
}
