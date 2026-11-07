// ===== FILE: src/pages/Diagnostics.tsx =====
// src/pages/Diagnostics.tsx

import { useMemo, useState } from "react";
import { useTrackerStore } from "../store/store";
import { buildRequirementsSnapshot, buildFarmingSnapshot } from "../domain/logic/requirementEngine";
import { FULL_CATALOG } from "../domain/catalog/loadFullCatalog";
import { getAcquisitionByCatalogId } from "../catalog/items/itemAcquisition";
import { SOURCE_INDEX } from "../catalog/sources/sourceCatalog";
import { deriveDropDataAcquisitionByCatalogId } from "../catalog/items/acquisitionFromDropData";
import UNRESOLVED_RAW from "../data/_generated/wfcd-acquisition.unresolved.json";
import { getDefectSummary, getReleaseBlockingDefects } from "../domain/logic/defectRegistry";
import { STAR_CHART_DATA } from "../domain/catalog/starChart";
import { getDropSourcesForStarChartNode } from "../domain/catalog/starChart/nodeDropSourceMap";
import { getLootForStarChartNode } from "../domain/logic/nodeLootIndex";
import { WorkspaceSection } from "../components/workspace/WorkspaceChrome";

function Section(props: { title: string; subtitle?: string; children: React.ReactNode }) {
    return <WorkspaceSection title={props.title} subtitle={props.subtitle}>{props.children}</WorkspaceSection>;
}

function StatCard(props: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] p-3">
            <div className="text-[11px] uppercase tracking-wide text-[color:var(--wf-text-muted)]">{props.label}</div>
            <div className="mt-1 font-mono text-xl text-[color:var(--wf-text-strong)]">{props.value}</div>
        </div>
    );
}

type BlockingRow = {
    prereqId: string;
    blockedItemCount: number;
    blockedRemainingTotal: number;
    sampleItems: Array<{ name: string; remaining: number }>;
};

type CompletenessIssueRow = {
    catalogId: string;
    name: string;
    issue: "missing-acquisition" | "unknown-source";
    sources?: string[];
};

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function fmtN(v: unknown): string {
    if (isFiniteNumber(v)) return v.toLocaleString();
    const n = Number(v);
    if (Number.isFinite(n)) return n.toLocaleString();
    return "0";
}

function fmtI(v: unknown): string {
    if (isFiniteNumber(v)) return Math.floor(v).toLocaleString();
    const n = Number(v);
    if (Number.isFinite(n)) return Math.floor(n).toLocaleString();
    return "0";
}

function downloadJson(filename: string, obj: unknown) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}

function snapshotStamp(): string {
    // YYYYMMDD-HHMMSS (local)
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        [
            d.getFullYear(),
            pad(d.getMonth() + 1),
            pad(d.getDate())
        ].join("") +
        "-" +
        [
            pad(d.getHours()),
            pad(d.getMinutes()),
            pad(d.getSeconds())
        ].join("")
    );
}

/**
 * Fail-closed guard: these legacy ids should never appear in the completeness export.
 * If they do, throw hard so you catch regression immediately.
 */
function assertNoLegacyMissionRewardIds(obj: unknown): void {
    const legacy = [
        "data:missionreward/deimos/albrechts-laboratories",
        "data:missionreward/deimos/albrechts-laboratories/rotationc",
        "data:missionreward/saturn/lunaro",
        "data:missionreward/saturn/lunaro/rotationb"
    ];

    const haystack = JSON.stringify(obj);
    const hit = legacy.find((s) => haystack.includes(s));
    if (hit) {
        throw new Error(`Legacy missionreward id detected in completeness export: ${hit}`);
    }
}

const DEBUG_CATALOG_IDS = {
    orokinCell: "items:/Lotus/Types/Items/MiscItems/OrokinCell",
    neurode: "items:/Lotus/Types/Items/MiscItems/Neurode"
};

function isRecipeKey(catalogId: string): boolean {
    return catalogId.includes("/Lotus/Types/Recipes/");
}

export default function Diagnostics() {
    const syndicates = useTrackerStore((s) => s.state.syndicates ?? []);
    const goals = useTrackerStore((s) => s.state.goals ?? []);
    const completedPrereqs = useTrackerStore((s) => s.state.prereqs?.completed ?? {});
    const inventory = useTrackerStore((s) => s.state.inventory);
    const masteryState = useTrackerStore((s) => s.state.mastery);

    const requirements = useMemo(() => {
        return buildRequirementsSnapshot({
            syndicates,
            goals,
            completedPrereqs,
            inventory,
            expandMode: "direct"
        });
    }, [syndicates, goals, completedPrereqs, inventory]);

    const farming = useMemo(() => {
        return buildFarmingSnapshot({
            requirements,
            completedPrereqs
        });
    }, [requirements, completedPrereqs]);

    const unknownAcquisition = useMemo(() => {
        const hidden = Array.isArray(farming?.hidden) ? farming.hidden : [];
        return hidden.filter((h) => h?.reason === "unknown-acquisition");
    }, [farming]);

    const unknownRecipeAcquisition = useMemo(() => {
        const hidden = Array.isArray(farming?.hidden) ? farming.hidden : [];
        return hidden.filter((h) => h?.reason === "unknown-recipe-acquisition");
    }, [farming]);

    // Cross-check: items flagged unknown-acquisition vs derived drop-data acquisition map (by catalogId)
    // IMPORTANT: This explicitly excludes /Lotus/Types/Recipes/ so it matches the UI subtitle.
    const unknownAcqCrossCheck = useMemo(() => {
        const hidden = Array.isArray(farming?.hidden) ? farming.hidden : [];
        const unknown = hidden
            .filter((h) => h?.reason === "unknown-acquisition")
            .filter((h) => !isRecipeKey(String(h?.key ?? "")));

        let dropMap: Record<string, any> = {};
        try {
            dropMap = deriveDropDataAcquisitionByCatalogId();
        } catch {
            dropMap = {};
        }

        const withDropData: Array<{ catalogId: string; name: string; dropSources: any[] }> = [];
        const withoutDropData: Array<{ catalogId: string; name: string }> = [];

        for (const h of unknown) {
            const cid = String(h?.key ?? "");
            const name = String(h?.name ?? "Unknown");

            const drop = dropMap[cid];
            const srcs = Array.isArray(drop?.sources) ? drop.sources : Array.isArray(drop) ? drop : [];

            if (srcs.length > 0) {
                withDropData.push({ catalogId: cid, name, dropSources: srcs });
            } else {
                withoutDropData.push({ catalogId: cid, name });
            }
        }

        withDropData.sort((a, b) => a.name.localeCompare(b.name));
        withoutDropData.sort((a, b) => a.name.localeCompare(b.name));

        return {
            unknownCount: unknown.length,
            withDropDataCount: withDropData.length,
            withoutDropDataCount: withoutDropData.length,
            withDropData,
            withoutDropData
        };
    }, [farming]);

    // Cross-check: items flagged unknown-recipe-acquisition vs derived drop-data acquisition map (by catalogId)
    // This is intentionally recipe-only (so you can see whether drop-data has anything for these blueprint/part recipes).
    const unknownRecipeAcqCrossCheck = useMemo(() => {
        const hidden = Array.isArray(farming?.hidden) ? farming.hidden : [];
        const unknown = hidden.filter((h) => h?.reason === "unknown-recipe-acquisition");

        let dropMap: Record<string, any> = {};
        try {
            dropMap = deriveDropDataAcquisitionByCatalogId();
        } catch {
            dropMap = {};
        }

        const withDropData: Array<{ catalogId: string; name: string; dropSources: any[] }> = [];
        const withoutDropData: Array<{ catalogId: string; name: string }> = [];

        for (const h of unknown) {
            const cid = String(h?.key ?? "");
            const name = String(h?.name ?? "Unknown");

            const drop = dropMap[cid];
            const srcs = Array.isArray(drop?.sources) ? drop.sources : Array.isArray(drop) ? drop : [];

            if (srcs.length > 0) {
                withDropData.push({ catalogId: cid, name, dropSources: srcs });
            } else {
                withoutDropData.push({ catalogId: cid, name });
            }
        }

        withDropData.sort((a, b) => a.name.localeCompare(b.name));
        withoutDropData.sort((a, b) => a.name.localeCompare(b.name));

        return {
            unknownCount: unknown.length,
            withDropDataCount: withDropData.length,
            withoutDropDataCount: withoutDropData.length,
            withDropData,
            withoutDropData
        };
    }, [farming]);

    const blocking = useMemo(() => {
        const rows = new Map<
            string,
            { blockedItemCount: number; blockedRemainingTotal: number; items: Array<{ name: string; remaining: number }> }
        >();

        const hidden = Array.isArray(farming?.hidden) ? farming.hidden : [];
        const blockedItems = hidden.filter((h) => h?.reason === "missing-prereqs");

        for (const it of blockedItems) {
            const missing = Array.isArray(it?.missingPrereqs) ? it.missingPrereqs : [];
            for (const pr of missing) {
                const key = String(pr);
                if (!rows.has(key)) {
                    rows.set(key, { blockedItemCount: 0, blockedRemainingTotal: 0, items: [] });
                }
                const agg = rows.get(key)!;
                agg.blockedItemCount += 1;
                agg.blockedRemainingTotal += Math.max(0, Math.floor(Number(it?.remaining ?? 0) || 0));
                agg.items.push({
                    name: String(it?.name ?? "Unknown"),
                    remaining: Math.max(0, Math.floor(Number(it?.remaining ?? 0) || 0))
                });
            }
        }

        const out: BlockingRow[] = Array.from(rows.entries()).map(([prereqId, v]) => {
            const items = [...v.items];
            items.sort((a, b) => {
                if (a.remaining !== b.remaining) return b.remaining - a.remaining;
                return a.name.localeCompare(b.name);
            });

            return {
                prereqId,
                blockedItemCount: v.blockedItemCount,
                blockedRemainingTotal: v.blockedRemainingTotal,
                sampleItems: items.slice(0, 5)
            };
        });

        out.sort((a, b) => {
            if (a.blockedItemCount !== b.blockedItemCount) return b.blockedItemCount - a.blockedItemCount;
            if (a.blockedRemainingTotal !== b.blockedRemainingTotal) return b.blockedRemainingTotal - a.blockedRemainingTotal;
            return a.prereqId.localeCompare(b.prereqId);
        });

        return out.slice(0, 15);
    }, [farming]);

    const completeness = useMemo(() => {
        const displayableInventoryIds = FULL_CATALOG.displayableInventoryItemIds;

        const missingAcq: CompletenessIssueRow[] = [];
        const unknownSourceRefs: CompletenessIssueRow[] = [];

        for (const id of displayableInventoryIds) {
            const rec = FULL_CATALOG.recordsById[id];
            const name = typeof rec?.displayName === "string" ? rec.displayName : String(id);

            const acq = getAcquisitionByCatalogId(id);

            if (!acq) {
                missingAcq.push({ catalogId: String(id), name, issue: "missing-acquisition" });
                continue;
            }

            const srcs = Array.isArray(acq.sources) ? acq.sources : [];
            if (srcs.length === 0) {
                missingAcq.push({ catalogId: String(id), name, issue: "missing-acquisition" });
                continue;
            }

            const unknown = srcs
                .map((s) => String(s))
                .filter((s) => !SOURCE_INDEX[s as any]);

            if (unknown.length > 0) {
                unknownSourceRefs.push({
                    catalogId: String(id),
                    name,
                    issue: "unknown-source",
                    sources: Array.from(new Set(unknown)).sort((a, b) => a.localeCompare(b))
                });
            }
        }

        missingAcq.sort((a, b) => a.name.localeCompare(b.name));
        unknownSourceRefs.sort((a, b) => a.name.localeCompare(b.name));

        return {
            displayableInventoryCount: displayableInventoryIds.length,
            missingAcquisitionCount: missingAcq.length,
            unknownSourceRefCount: unknownSourceRefs.length,
            missingAcq,
            unknownSourceRefs
        };
    }, []);
    
    const dropAcqMapStats = useMemo(() => {
        try {
            const m = deriveDropDataAcquisitionByCatalogId();
            return {
                catalogIdsWithSources: Object.keys(m).length
            };
        } catch {
            return { catalogIdsWithSources: 0 };
        }
    }, []);

    const dropMapSanity = useMemo(() => {
        let dropMap: Record<string, any> = {};
        try {
            dropMap = deriveDropDataAcquisitionByCatalogId();
        } catch {
            dropMap = {};
        }

        const rows = Object.entries(DEBUG_CATALOG_IDS).map(([k, catalogId]) => {
            const drop = dropMap[catalogId] ?? null;
            const dropSources: string[] = Array.isArray(drop?.sources) ? drop.sources.map(String) : [];

            const dropSourcesKnown: string[] = dropSources.filter((s) => Boolean(SOURCE_INDEX[s as any]));
            const dropSourcesUnknown: string[] = dropSources.filter((s) => !SOURCE_INDEX[s as any]);

            const catalogRec: any = (FULL_CATALOG as any)?.recordsById?.[catalogId] ?? null;
            const catalogName =
                typeof catalogRec?.displayName === "string"
                    ? catalogRec.displayName
                    : typeof catalogRec?.name === "string"
                        ? catalogRec.name
                        : String(catalogId);

            const acq = getAcquisitionByCatalogId(catalogId as any);
            const acqSources: string[] = Array.isArray((acq as any)?.sources) ? (acq as any).sources.map(String) : [];

            return {
                key: k,
                catalogId,
                catalogName,
                dropMapHasEntry: Boolean(drop),
                dropSourcesCount: dropSources.length,
                dropSourcesKnownCount: dropSourcesKnown.length,
                dropSourcesUnknownCount: dropSourcesUnknown.length,
                dropSourcesPreview: dropSources.slice(0, 25),
                dropSourcesUnknownPreview: dropSourcesUnknown.slice(0, 25),
                getAcqSourcesCount: acqSources.length,
                getAcqSourcesPreview: acqSources.slice(0, 25)
            };
        });

        return {
            debugCatalogIds: DEBUG_CATALOG_IDS,
            derivedDropMapKeys: Object.keys(dropMap).length,
            rows
        };
    }, []);

    const priceCoverage = useMemo(() => {
        const ids = FULL_CATALOG.displayableInventoryItemIds;

        let withBuildPrice = 0;
        let withMarketCost = 0;

        for (const id of ids) {
            const rec: any = FULL_CATALOG.recordsById[id];
            const raw: any = rec?.raw;

            const wfcd = raw?.rawWfcd ?? null;
            const lotus = raw?.rawLotus ?? null;

            const buildPrice = wfcd?.buildPrice ?? lotus?.buildPrice ?? null;
            const marketCost = wfcd?.marketCost ?? lotus?.marketCost ?? null;

            if (typeof buildPrice === "number" && Number.isFinite(buildPrice) && buildPrice > 0) {
                withBuildPrice += 1;
            }
            if (typeof marketCost === "number" && Number.isFinite(marketCost) && marketCost > 0) {
                withMarketCost += 1;
            }
        }

        return {
            displayableInventory: ids.length,
            withBuildPrice,
            withMarketCost
        };
    }, []);

    const farmingStats = farming?.stats ?? {
        actionableItemsWithKnownAcquisition: 0,
        hiddenForUnknownAcquisition: 0,
        hiddenForUnknownRecipeAcquisition: 0,
        hiddenForMissingPrereqs: 0,
        hiddenForNoAccessibleSources: 0,
        overlapSourceCount: 0
    };

    // 11.2 Data Coverage Indicator
    const dataCoverage = useMemo(() => {
        const total = completeness.displayableInventoryCount;
        const missing = completeness.missingAcquisitionCount;
        const covered = Math.max(0, total - missing);
        const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
        return { total, covered, missing, pct };
    }, [completeness]);

    // 11.3 Progress Audit
    const progressAudit = useMemo(() => {
        const hidden = Array.isArray(farming?.hidden) ? farming.hidden : [];

        const lockedByPrereq = hidden.filter((h) => h?.reason === "missing-prereqs");
        const lockedByNoSource = hidden.filter((h) => h?.reason === "no-accessible-sources");
        const lockedByUnknownAcq = hidden.filter((h) => h?.reason === "unknown-acquisition");

        const actionable = Array.isArray(farming?.targeted) ? farming.targeted : [];
        const resourceShortages = actionable
            .filter((l: any) => (l?.remaining ?? 0) > 0)
            .slice(0, 20)
            .map((l: any) => ({
                name: String(l?.name ?? "Unknown"),
                remaining: Math.max(0, Math.floor(Number(l?.remaining ?? 0))),
                have: Math.max(0, Math.floor(Number(l?.have ?? 0))),
                totalNeed: Math.max(0, Math.floor(Number(l?.totalNeed ?? 0)))
            }));

        return {
            lockedByPrereqCount: lockedByPrereq.length,
            lockedByNoSourceCount: lockedByNoSource.length,
            lockedByUnknownAcqCount: lockedByUnknownAcq.length,
            actionableWithRemainingCount: actionable.filter((l: any) => (l?.remaining ?? 0) > 0).length,
            resourceShortages
        };
    }, [farming]);

    // 14.2 Data Defect Registry
    const unresolvedDefects = useMemo(() => {
        const entries = Object.entries(UNRESOLVED_RAW as Record<string, { itemName: string; count: number; examples: string[] }>);
        entries.sort((a, b) => b[1].count - a[1].count || a[1].itemName.localeCompare(b[1].itemName));
        return entries;
    }, []);

    // Base export object (without meta). We’ll attach meta + stamp at download time.
    const completenessExportObject = useMemo(() => {
        return {
            stats: {
                displayableInventoryCount: completeness.displayableInventoryCount,
                missingAcquisitionCount: completeness.missingAcquisitionCount,
                unknownSourceRefCount: completeness.unknownSourceRefCount,
                dropDataCatalogIdsWithSources: dropAcqMapStats.catalogIdsWithSources
            },
            missingAcquisition: completeness.missingAcq.map((x) => ({ catalogId: x.catalogId, name: x.name })),
            unknownSourceRefs: completeness.unknownSourceRefs.map((x) => ({
                catalogId: x.catalogId,
                name: x.name,
                sources: x.sources ?? []
            })),
            dropMapSanity
        };
    }, [completeness, dropAcqMapStats, dropMapSanity]);

    const masteryDebug = useMemo(() => {
        const mastered = { ...(masteryState?.mastered ?? {}), ...(masteryState?.overLevelMastered ?? {}) };
        const xpByItem = masteryState?.xpByItem ?? {};
        const rows: Array<{ catalogId: string; name: string; xp: number; path: string; isOverLevel?: boolean }> = [];
        for (const [key, val] of Object.entries(mastered)) {
            if (!val) continue;
            const rec = FULL_CATALOG.recordsById[key as any];
            const rawPath = key.startsWith("items:") ? key.slice("items:".length) : key;
            const xp = xpByItem[key] ?? xpByItem[rawPath] ?? 0;
            const isOverLevel = (masteryState?.overLevelMastered ?? {})[key] === true;
            rows.push({
                catalogId: key,
                name: rec?.displayName ?? rawPath.split("/").pop() ?? key,
                xp,
                path: rawPath,
                isOverLevel
            });
        }
        rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows;
    }, [masteryState]);

    const defectSummary = getDefectSummary();
    const releaseBlockingDefects = getReleaseBlockingDefects();

    return (
        <div className="space-y-6">
            <header className="px-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-accent-primary)]">App &amp; Data</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--wf-text-strong)]">Diagnostics</h1>
                <p className="mt-1 max-w-3xl text-sm text-[color:var(--wf-text-muted)]">Review catalog completeness, source coverage, validation results, and technical exports.</p>
            </header>
            {/* Defect Registry Summary */}
            <Section
                title="Defect Registry"
                subtitle="Aggregated data defects across all catalog sources. Populated at startup; does not require player goals."
            >
                {releaseBlockingDefects.length > 0 && (
                    <div className="mb-4 rounded-xl border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                        <span className="font-semibold">Release-blocking defects: {releaseBlockingDefects.length}</span>
                        {" — these must be resolved before deploying."}
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Total defects" value={String(defectSummary.total)} />
                    <StatCard label="Missing acquisition" value={String(defectSummary.byCategory["missing-acquisition"] ?? 0)} />
                    <StatCard label="Unknown source refs" value={String(defectSummary.byCategory["unknown-source"] ?? 0)} />
                    <StatCard label="Unresolved WFCD items" value={String(defectSummary.byCategory["unresolved-wfcd"] ?? 0)} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-3 text-center">
                        <div className="text-[11px] uppercase tracking-wide text-red-400">Release-blocking</div>
                        <div className="mt-1 font-mono text-xl text-red-300">{defectSummary.bySeverity["release-blocking"] ?? 0}</div>
                    </div>
                    <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-center">
                        <div className="text-[11px] uppercase tracking-wide text-amber-400">Warnings</div>
                        <div className="mt-1 font-mono text-xl text-amber-300">{defectSummary.bySeverity["warning"] ?? 0}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-center">
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Info</div>
                        <div className="mt-1 font-mono text-xl text-slate-300">{defectSummary.bySeverity["info"] ?? 0}</div>
                    </div>
                </div>
            </Section>

            {/* 11.2 Data Coverage Indicator */}
            <Section
                title="Data Coverage"
                subtitle="What percentage of displayable inventory items have known acquisition sources."
            >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <StatCard label="Total displayable items" value={fmtI(dataCoverage.total)} />
                    <StatCard label="With acquisition data" value={fmtI(dataCoverage.covered)} />
                    <StatCard label="Missing acquisition" value={fmtI(dataCoverage.missing)} />
                    <StatCard label="Coverage %" value={`${dataCoverage.pct}%`} />
                </div>
                <div className="mt-4 rounded-xl bg-slate-900 border border-slate-800 p-3">
                    <div className="text-xs text-slate-400 mb-2">Acquisition coverage</div>
                    <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-emerald-600 transition-all"
                            style={{ width: `${dataCoverage.pct}%` }}
                        />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        {dataCoverage.covered.toLocaleString()} / {dataCoverage.total.toLocaleString()} items covered
                    </div>
                </div>
            </Section>

            {/* 11.3 Progress Audit */}
            <Section
                title="Progress Audit"
                subtitle="Unified view of what is blocking or slowing progress right now."
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Locked by prereqs" value={fmtI(progressAudit.lockedByPrereqCount)} />
                    <StatCard label="Locked (no sources)" value={fmtI(progressAudit.lockedByNoSourceCount)} />
                    <StatCard label="Unknown acquisition" value={fmtI(progressAudit.lockedByUnknownAcqCount)} />
                    <StatCard label="Actionable with shortages" value={fmtI(progressAudit.actionableWithRemainingCount)} />
                </div>

                {progressAudit.resourceShortages.length > 0 && (
                    <div className="mt-4">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                            Top resource shortages (actionable items, by remaining)
                        </div>
                        <div className="max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950/30">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-950/90">
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left px-3 py-2 text-slate-300 font-semibold">Item</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-24">Need</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-24">Have</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-24">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {progressAudit.resourceShortages.map((r) => (
                                        <tr key={r.name} className="border-b border-slate-800/50 hover:bg-slate-900/20">
                                            <td className="px-3 py-2 text-slate-100 break-words">{r.name}</td>
                                            <td className="px-3 py-2 text-right text-slate-300">{r.totalNeed.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-slate-300">{r.have.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-amber-300">{r.remaining.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Section>

            {/* 14.2 Data Defect Registry */}
            <Section
                title="Data Defect Registry"
                subtitle={`Acquisition entries from the WFCD data that could not be mapped to a catalogId. ${unresolvedDefects.length} unresolved items.`}
            >
                {unresolvedDefects.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                        No unresolved defects.
                    </div>
                ) : (
                    <details>
                        <summary className="cursor-pointer text-sm text-slate-300 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 inline-block hover:bg-slate-900">
                            Show {unresolvedDefects.length} unresolved entries
                        </summary>
                        <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950/30">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-950/90">
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left px-3 py-2 text-slate-300 font-semibold">Item Name</th>
                                        <th className="text-right px-3 py-2 text-slate-300 font-semibold w-20">Count</th>
                                        <th className="text-left px-3 py-2 text-slate-300 font-semibold">Example Sources</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unresolvedDefects.map(([key, def]) => (
                                        <tr key={key} className="border-b border-slate-800/50 hover:bg-slate-900/20">
                                            <td className="px-3 py-2 text-slate-100 break-words">{def.itemName}</td>
                                            <td className="px-3 py-2 text-right text-slate-400">{def.count}</td>
                                            <td className="px-3 py-2 text-slate-500 text-xs break-words">
                                                {(def.examples ?? []).slice(0, 2).join("; ")}
                                                {def.examples.length > 2 && ` …+${def.examples.length - 2} more`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                )}
            </Section>

            <Section
                title="Snapshot Export"
                subtitle="Downloads the exact JSON used by the planner so you can run jq tests locally (no placeholders)."
            >
                <div className="flex flex-wrap gap-2">
                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => {
                            const stamp = snapshotStamp();
                            downloadJson(`requirements-snapshot-${stamp}.json`, requirements);
                        }}
                    >
                        Download requirements snapshot
                    </button>

                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => {
                            const stamp = snapshotStamp();
                            downloadJson(`farming-snapshot-${stamp}.json`, farming);
                        }}
                    >
                        Download farming snapshot
                    </button>

                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => {
                            const stamp = snapshotStamp();
                            downloadJson(`planner-snapshots-${stamp}.json`, {
                                requirements,
                                farming
                            });
                        }}
                    >
                        Download combined (requirements + farming)
                    </button>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                    Tip: after downloading, rename the newest files to{" "}
                    <span className="font-mono">requirements.json</span> and{" "}
                    <span className="font-mono">farming.json</span> so your jq commands stay stable.
                </div>
            </Section>

            <Section
                title="Drop-map sanity checks (Orokin Cell + Neurodes)"
                subtitle="Shows (1) what the drop-data layer returns, (2) which of those sources are missing from SOURCE_INDEX, and (3) what getAcquisitionByCatalogId ultimately returns."
            >
                <div className="flex flex-wrap gap-2">
                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => downloadJson("drop-map-sanity.json", dropMapSanity)}
                    >
                        Download sanity JSON
                    </button>

                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => {
                            const m = deriveDropDataAcquisitionByCatalogId();
                            downloadJson("drop-data-acquisition-map.json", m);
                        }}
                    >
                        Download drop-data acquisition map (JSON)
                    </button>
                </div>

                <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-slate-300">Show sanity JSON</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-200 font-mono">
                        {JSON.stringify(dropMapSanity, null, 2)}
                    </pre>
                </details>

                <div className="mt-3 text-xs text-slate-400">
                    CatalogIds with any sources from drop-data:{" "}
                    <span className="font-mono">{fmtI(dropAcqMapStats.catalogIdsWithSources)}</span>
                </div>
            </Section>

            <Section
                title="Catalog Completeness"
                subtitle="Strict checks for Phase 1.2 data coverage. This does not guess."
            >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <StatCard label="Displayable inventory items" value={fmtI(completeness.displayableInventoryCount)} />
                    <StatCard label="Missing acquisition" value={fmtI(completeness.missingAcquisitionCount)} />
                    <StatCard label="Unknown source references" value={fmtI(completeness.unknownSourceRefCount)} />
                    <StatCard
                        label="Total completeness issues"
                        value={fmtI(completeness.missingAcquisitionCount + completeness.unknownSourceRefCount)}
                    />
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                            Missing acquisition (first 50)
                        </div>
                        {completeness.missingAcq.length === 0 ? (
                            <div className="text-sm text-slate-400">None.</div>
                        ) : (
                            <ul className="list-disc pl-5 space-y-0.5 text-sm text-slate-200">
                                {completeness.missingAcq.slice(0, 50).map((x) => (
                                    <li key={`missing:${x.catalogId}`} className="break-words">
                                        <span className="font-semibold">{x.name}</span>{" "}
                                        <span className="text-slate-500 font-mono">({x.catalogId})</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {completeness.missingAcq.length > 50 && (
                            <div className="mt-2 text-xs text-slate-500">
                                Showing 50 of {fmtI(completeness.missingAcq.length)}.
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                            Unknown source refs (first 50)
                        </div>
                        {completeness.unknownSourceRefs.length === 0 ? (
                            <div className="text-sm text-slate-400">None.</div>
                        ) : (
                            <div className="space-y-2">
                                {completeness.unknownSourceRefs.slice(0, 50).map((x) => (
                                    <div
                                        key={`unknownsrc:${x.catalogId}`}
                                        className="rounded-xl border border-slate-800 bg-slate-950/30 p-3"
                                    >
                                        <div className="text-sm font-semibold break-words">{x.name}</div>
                                        <div className="text-[11px] text-slate-500 mt-1 break-words">
                                            CatalogId: <span className="font-mono">{x.catalogId}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2 break-words">
                                            Unknown sources:{" "}
                                            <span className="font-mono">{(x.sources ?? []).join(", ")}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {completeness.unknownSourceRefs.length > 50 && (
                            <div className="mt-2 text-xs text-slate-500">
                                Showing 50 of {fmtI(completeness.unknownSourceRefs.length)}.
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            Completeness export (JSON)
                        </div>
                        <button
                            className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                            onClick={() => {
                                const stamp = snapshotStamp();

                                // Attach meta at export time so each download is provably unique.
                                const obj = {
                                    meta: {
                                        stamp,
                                        mode: (import.meta as any)?.env?.MODE ?? null,
                                        gitSha: (import.meta as any)?.env?.VITE_GIT_SHA ?? null
                                    },
                                    ...completenessExportObject
                                };

                                // Fail closed if legacy ids ever regress back into the export.
                                assertNoLegacyMissionRewardIds(obj);

                                downloadJson(`catalog-completeness-${stamp}.json`, obj);
                            }}
                        >
                            Download catalog completeness JSON
                        </button>
                    </div>

                    <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-slate-300">Show JSON</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-200 font-mono">
                            {JSON.stringify(completenessExportObject, null, 2)}
                        </pre>
                    </details>
                </div>
            </Section>

            <Section
                title="Catalog Price Coverage (Debug)"
                subtitle="Counts how many displayable inventory items actually have buildPrice and/or marketCost available in the merged catalog record."
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <StatCard label="Displayable inventory" value={fmtI(priceCoverage.displayableInventory)} />
                    <StatCard label="With buildPrice" value={fmtI(priceCoverage.withBuildPrice)} />
                    <StatCard label="With marketCost" value={fmtI(priceCoverage.withMarketCost)} />
                </div>
            </Section>

            <Section
                title="Unknown-acquisition cross-check (Drop-data)"
                subtitle="Compares the planner's unknown-acquisition list against the derived drop-data acquisition map, by catalogId. (Excludes /Lotus/Types/Recipes/*.)"
            >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <StatCard label="Unknown-acquisition items" value={fmtI(unknownAcqCrossCheck.unknownCount)} />
                    <StatCard label="Unknown but HAS drop-data" value={fmtI(unknownAcqCrossCheck.withDropDataCount)} />
                    <StatCard label="Unknown and NO drop-data" value={fmtI(unknownAcqCrossCheck.withoutDropDataCount)} />
                    <StatCard
                        label="Likely failure mode"
                        value={unknownAcqCrossCheck.withDropDataCount > 0 ? "merge bug" : "join bug"}
                    />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => downloadJson("unknown-acq-crosscheck.json", unknownAcqCrossCheck)}
                    >
                        Download cross-check (JSON)
                    </button>
                </div>
            </Section>

            <Section
                title="Unknown-recipe-acquisition cross-check (Drop-data)"
                subtitle="Same cross-check, but for blueprint/recipe items (reason=unknown-recipe-acquisition). This tells you whether drop-data has any sources for these recipe ids at all."
            >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <StatCard label="Unknown recipe items" value={fmtI(unknownRecipeAcqCrossCheck.unknownCount)} />
                    <StatCard label="Recipe but HAS drop-data" value={fmtI(unknownRecipeAcqCrossCheck.withDropDataCount)} />
                    <StatCard label="Recipe and NO drop-data" value={fmtI(unknownRecipeAcqCrossCheck.withoutDropDataCount)} />
                    <StatCard
                        label="Likely failure mode"
                        value={unknownRecipeAcqCrossCheck.withDropDataCount > 0 ? "merge bug" : "missing sources"}
                    />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => downloadJson("unknown-recipe-acq-crosscheck.json", unknownRecipeAcqCrossCheck)}
                    >
                        Download cross-check (JSON)
                    </button>
                </div>
            </Section>

            <Section
                title="Diagnostics"
                subtitle="Fail-closed analysis of what is blocking progress. This page does not guess."
            >
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <StatCard label="Hidden (unknown acquisition)" value={fmtI(farmingStats.hiddenForUnknownAcquisition)} />
                    <StatCard
                        label="Hidden (recipe acquisition missing)"
                        value={fmtI(farmingStats.hiddenForUnknownRecipeAcquisition)}
                    />
                    <StatCard label="Hidden (missing prereqs)" value={fmtI(farmingStats.hiddenForMissingPrereqs)} />
                    <StatCard label="Hidden (no accessible sources)" value={fmtI(farmingStats.hiddenForNoAccessibleSources)} />
                    <StatCard label="Actionable items" value={fmtI(farmingStats.actionableItemsWithKnownAcquisition)} />
                    <StatCard label="Overlap sources" value={fmtI(farmingStats.overlapSourceCount)} />
                </div>
            </Section>

            <Section
                title="Top Blocking Prereqs"
                subtitle="Prereqs whose completion would unlock the largest number of currently blocked required items."
            >
                {blocking.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                        No prereq blockers detected (or all blockers are uncurated source gates).
                    </div>
                ) : (
                    <div className="space-y-2">
                        {blocking.map((b) => (
                            <div key={b.prereqId} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2">
                                    <div className="text-sm font-semibold break-words">{b.prereqId}</div>
                                    <div className="text-xs text-slate-400">
                                        Blocks {fmtI(b.blockedItemCount)} items, {fmtI(b.blockedRemainingTotal)} remaining total
                                    </div>
                                </div>

                                {b.sampleItems.length > 0 && (
                                    <div className="mt-2 text-xs text-slate-400">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                                            Examples
                                        </div>
                                        <ul className="list-disc pl-5 space-y-0.5">
                                            {b.sampleItems.map((x) => (
                                                <li key={`${b.prereqId}:${x.name}`} className="break-words">
                                                    {x.name} (remaining {fmtI(x.remaining)})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            <Section
                title="Unknown Acquisition (Debug)"
                subtitle="Non-blueprint items required by goals or syndicates that have no acquisition mapping at all."
            >
                {unknownAcquisition.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                        No unknown-acquisition items detected.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {unknownAcquisition.slice(0, 500).map((h) => (
                            <div key={String(h.key)} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                <div className="text-sm font-semibold break-words">{String(h.name ?? "Unknown")}</div>
                                <div className="text-xs text-slate-400 mt-1">Remaining {fmtN(h.remaining)}</div>
                                <div className="text-[11px] text-slate-500 mt-1 break-words">
                                    CatalogId: <span className="font-mono">{String(h.key)}</span>
                                </div>
                            </div>
                        ))}

                        {unknownAcquisition.length > 500 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-400">
                                Rendering capped at 500 items to keep the page responsive. Use the download buttons above for full
                                exports.
                            </div>
                        )}
                    </div>
                )}
            </Section>

            <Section
                title="Recipe/Blueprint Acquisition Missing (Debug)"
                subtitle="Blueprint/recipe items that should be purchasable/researchable/droppable, but are not yet mapped to acquisition sources."
            >
                {unknownRecipeAcquisition.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                        No recipe/blueprint acquisition gaps detected.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {unknownRecipeAcquisition.slice(0, 500).map((h) => (
                            <div key={String(h.key)} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                <div className="text-sm font-semibold break-words">{String(h.name ?? "Unknown")}</div>
                                <div className="text-xs text-slate-400 mt-1">Remaining {fmtN(h.remaining)}</div>
                                <div className="text-[11px] text-slate-500 mt-1 break-words">
                                    CatalogId: <span className="font-mono">{String(h.key)}</span>
                                </div>
                            </div>
                        ))}

                        {unknownRecipeAcquisition.length > 500 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-400">
                                Rendering capped at 500 items to keep the page responsive. Use the download buttons above for full
                                exports.
                            </div>
                        )}
                    </div>
                )}
            </Section>

            <Section
                title="Mastery Debug"
                subtitle="All items currently flagged as mastered in the store, with their XP values. Use this to cross-reference against the in-game codex."
            >
                <div className="flex flex-wrap gap-2 mb-3">
                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                        onClick={() => downloadJson(`mastery-debug-${snapshotStamp()}.json`, masteryDebug)}
                    >
                        Download mastered list (JSON)
                    </button>
                </div>
                <div className="text-sm text-slate-400 mb-2">
                    Total mastered: <span className="font-mono text-slate-200">{masteryDebug.length}</span>
                </div>
                {masteryDebug.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                        No mastered items in store. Import a profile first.
                    </div>
                ) : (
                    <details>
                        <summary className="cursor-pointer text-xs text-slate-400">Show all {masteryDebug.length} mastered items</summary>
                        <div className="mt-2 space-y-1 max-h-96 overflow-auto">
                            {masteryDebug.map((r) => (
                                <div key={r.catalogId} className="flex items-baseline gap-2 text-xs">
                                    <span className="text-slate-200 w-48 shrink-0 truncate" title={r.name}>{r.name}</span>
                                    <span className="text-slate-500 font-mono">{r.xp.toLocaleString()} XP</span>
                                    <span className="text-slate-600 font-mono truncate">{r.path}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </Section>

            <StarChartBrowser />
            <CatalogEntryBrowser />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Debug tools (moved from Systems page)
// ---------------------------------------------------------------------------

function StarChartBrowser() {
    const planets = useMemo(() => {
        const ps = [...STAR_CHART_DATA.planets];
        ps.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        return ps;
    }, []);

    const nodes = useMemo(() => {
        const ns = [...STAR_CHART_DATA.nodes];
        ns.sort((a, b) => a.name.localeCompare(b.name));
        return ns;
    }, []);

    const [planetId, setPlanetId] = useState<string>(() => planets[0]?.id ?? "");
    const nodesForPlanet = useMemo(() => nodes.filter((n) => n.planetId === planetId), [nodes, planetId]);
    const [nodeId, setNodeId] = useState<string>(() => nodesForPlanet[0]?.id ?? "");
    const selectedNode = useMemo(() => nodes.find((n) => n.id === nodeId) ?? null, [nodes, nodeId]);
    const planetName = useMemo(() => planets.find((p) => p.id === planetId)?.name ?? planetId, [planets, planetId]);

    useMemo(() => {
        const first = nodesForPlanet[0]?.id ?? "";
        if (!nodeId || !nodesForPlanet.some((n) => n.id === nodeId)) setNodeId(first);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planetId, nodesForPlanet]);

    const dropSourceIds = useMemo(() => (nodeId ? getDropSourcesForStarChartNode(nodeId) : []), [nodeId]);
    const loot = useMemo(() => {
        if (!nodeId) return [];
        try { return getLootForStarChartNode(nodeId); } catch { return []; }
    }, [nodeId]);

    return (
        <Section
            title="Star Chart Browser (Debug)"
            subtitle="Select a planet and node to see which catalog items reference that node's drop-table sources."
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Planet</div>
                    <select
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        value={planetId}
                        onChange={(e) => setPlanetId(e.target.value)}
                    >
                        {planets.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Node</div>
                    <select
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        value={nodeId}
                        onChange={(e) => setNodeId(e.target.value)}
                        disabled={nodesForPlanet.length === 0}
                    >
                        {nodesForPlanet.length === 0
                            ? <option value="">(No nodes defined for {planetName} yet)</option>
                            : nodesForPlanet.map((n) => (
                                <option key={n.id} value={n.id}>{n.name} [{n.nodeType}]</option>
                            ))}
                    </select>
                </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Selection</div>
                {selectedNode ? (
                    <div className="text-sm text-slate-200 break-words">
                        <span className="font-semibold">{selectedNode.name}</span>{" "}
                        <span className="text-slate-500 font-mono">({selectedNode.id})</span>
                    </div>
                ) : (
                    <div className="text-sm text-slate-400">No node selected.</div>
                )}
                <div className="mt-2 text-xs text-slate-400">
                    Drop-source ids mapped to this node: <span className="font-mono">{dropSourceIds.length}</span>
                </div>
                {dropSourceIds.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {dropSourceIds.slice(0, 10).map((sid) => {
                            const label = SOURCE_INDEX[sid as any]?.label ?? null;
                            return (
                                <div key={sid} className="text-xs break-words">
                                    <span className="font-mono text-slate-200">{sid}</span>
                                    {label && <span className="text-slate-500"> — {label}</span>}
                                </div>
                            );
                        })}
                        {dropSourceIds.length > 10 && (
                            <div className="text-xs text-slate-500">Showing 10 of {dropSourceIds.length}.</div>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Obtainable items (by source reference)</div>
                    <div className="text-xs text-slate-400">Count: <span className="font-mono">{loot.length}</span></div>
                </div>
                {dropSourceIds.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-400">This node has no mapped drop sources yet.</div>
                ) : loot.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-400">No catalog items currently reference these sources.</div>
                ) : (
                    <ul className="mt-3 list-disc pl-5 space-y-0.5 text-sm text-slate-200">
                        {loot.slice(0, 200).map((it) => (
                            <li key={it.catalogId} className="break-words">
                                <span className="font-semibold">{it.name}</span>{" "}
                                <span className="text-slate-500 font-mono">({it.catalogId})</span>
                            </li>
                        ))}
                    </ul>
                )}
                {loot.length > 200 && (
                    <div className="mt-2 text-xs text-slate-500">Rendering capped at 200 items.</div>
                )}
            </div>
        </Section>
    );
}

function CatalogEntryBrowser() {
    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");

    const searchResults = useMemo(() => {
        const q = submittedQuery.trim().toLowerCase();
        if (!q) return [];
        const results: Array<{ id: string; name: string; score: number }> = [];
        for (const [id, rec] of Object.entries(FULL_CATALOG.recordsById)) {
            const name = (rec as any)?.displayName ?? (rec as any)?.name ?? "";
            const idStr = String(id).toLowerCase();
            const nameStr = String(name).toLowerCase();
            let score = 0;
            if (idStr === q || nameStr === q) score = 100;
            else if (idStr.startsWith(q) || nameStr.startsWith(q)) score = 80;
            else if (idStr.includes(q) || nameStr.includes(q)) score = 50;
            if (score > 0) results.push({ id, name: String(name || id), score });
        }
        results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        return results.slice(0, 20);
    }, [submittedQuery]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selectedRec = useMemo(() => (selectedId ? (FULL_CATALOG.recordsById as any)[selectedId] ?? null : null), [selectedId]);
    const selectedAcq = useMemo(() => {
        if (!selectedId) return null;
        try { return getAcquisitionByCatalogId(selectedId as any); } catch { return null; }
    }, [selectedId]);

    return (
        <Section
            title="Catalog Entry Browser (Debug)"
            subtitle="Search for any catalog item by name or ID and inspect its raw record and acquisition data."
        >
            <div className="flex gap-2">
                <input
                    aria-label="Search catalog entries by name or ID"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 placeholder-slate-500"
                    placeholder="Search by name or catalog ID..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setSubmittedQuery(query); }}
                />
                <button
                    className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                    onClick={() => setSubmittedQuery(query)}
                >
                    Search
                </button>
            </div>

            {submittedQuery && searchResults.length === 0 && (
                <div className="mt-3 text-sm text-slate-400">No matches for "{submittedQuery}".</div>
            )}

            {searchResults.length > 0 && (
                <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-950/30">
                    {searchResults.map((r) => (
                        <button
                            key={r.id}
                            className={["w-full text-left px-3 py-2 text-sm border-b border-slate-800/50 hover:bg-slate-900/40", selectedId === r.id ? "bg-slate-800/50" : ""].join(" ")}
                            onClick={() => setSelectedId(r.id)}
                        >
                            <span className="font-semibold text-slate-100">{r.name}</span>
                            <span className="ml-2 text-xs text-slate-500 font-mono break-all">{r.id}</span>
                        </button>
                    ))}
                    {searchResults.length === 20 && (
                        <div className="px-3 py-2 text-xs text-slate-500">Showing top 20 results. Refine your search.</div>
                    )}
                </div>
            )}

            {selectedId && selectedRec && (
                <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Catalog Record</div>
                        <div className="text-sm text-slate-100 font-semibold break-words">
                            {selectedRec.displayName ?? selectedRec.name ?? selectedId}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-1 break-all">{selectedId}</div>
                        {selectedRec.category && (
                            <div className="text-xs text-slate-400 mt-1">Category: {selectedRec.category}</div>
                        )}
                        <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-slate-400">Show raw record JSON</summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-300 font-mono max-h-64 overflow-auto">
                                {JSON.stringify(selectedRec, null, 2)}
                            </pre>
                        </details>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Acquisition Data</div>
                        {selectedAcq ? (
                            <div>
                                <div className="text-xs text-slate-400 mb-1">
                                    Sources: {Array.isArray((selectedAcq as any).sources) ? (selectedAcq as any).sources.length : 0}
                                </div>
                                {Array.isArray((selectedAcq as any).sources) && (selectedAcq as any).sources.map((src: string) => {
                                    const label = SOURCE_INDEX[src as any]?.label ?? null;
                                    return (
                                        <div key={src} className="text-xs break-words">
                                            <span className="font-mono text-slate-300">{src}</span>
                                            {label && <span className="text-slate-500"> — {label}</span>}
                                        </div>
                                    );
                                })}
                                <details className="mt-3">
                                    <summary className="cursor-pointer text-xs text-slate-400">Show raw acquisition JSON</summary>
                                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-300 font-mono max-h-64 overflow-auto">
                                        {JSON.stringify(selectedAcq, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400">No acquisition data mapped for this item.</div>
                        )}
                    </div>
                </div>
            )}
        </Section>
    );
}

