// ===== FILE: src/components/DashboardInventoryPanel.tsx =====
import { useMemo } from "react";
import { useTrackerStore } from "../store/store";
import { canAccessCatalogItem } from "../domain/logic/plannerEngine";
import { deriveCompletedMap } from "../domain/logic/syndicatePrereqs";
import { FULL_CATALOG, type CatalogId } from "../domain/catalog/loadFullCatalog";
import { WorkspaceAction, WorkspacePanel } from "./workspace/WorkspaceChrome";

type NeedLine = {
    catalogId: CatalogId;
    itemName: string;
    totalNeed: number;
    have: number;
    remaining: number;
    neededFor: Array<{ syndicateName: string; rankTitle: string; need: number }>;
};

function normalize(s: string): string { return s.trim().toLowerCase(); }

function resolveToCatalogId(keyOrName: string): CatalogId | null {
    const raw = String(keyOrName ?? "").trim();
    if (!raw) return null;
    if (FULL_CATALOG.recordsById[raw as CatalogId]) return raw as CatalogId;
    const matches = FULL_CATALOG.nameIndex?.[normalize(raw)] ?? [];
    return (matches[0] as CatalogId | undefined) ?? null;
}

export default function DashboardInventoryPanel() {
    const setActivePage    = useTrackerStore((s) => s.setActivePage);
    const syndicates       = useTrackerStore((s) => s.state.syndicates ?? []);
    const completedPrereqs = useTrackerStore((s) => s.state.prereqs?.completed ?? {});
    const counts           = useTrackerStore((s) => s.state.inventory?.counts ?? {});
    const masteryRank      = useTrackerStore((s) => s.state.player?.masteryRank ?? null);
    const nodeCompletedMap = useTrackerStore((s) => s.state.missions?.nodeCompleted ?? {});
    const railjackIntrinsics = useTrackerStore((s) => s.state.intrinsics?.railjack ?? {});
    const effectiveCompletedPrereqs = useMemo(
        () => deriveCompletedMap(completedPrereqs, syndicates, masteryRank, nodeCompletedMap, railjackIntrinsics, counts),
        [completedPrereqs, syndicates, masteryRank, nodeCompletedMap, railjackIntrinsics, counts],
    );

    const accessibleLines = useMemo<NeedLine[]>(() => {
        const needMap: Record<string, {
            catalogId: CatalogId; itemName: string; totalNeed: number;
            neededFor: Array<{ syndicateName: string; rankTitle: string; need: number }>;
        }> = {};

        for (const syn of syndicates) {
            const reqs      = syn?.nextRankUp?.items ?? [];
            const rankTitle = syn?.rankLabel ?? "Next Rank";

            for (const r of reqs) {
                const labelOrKey = String(r.label ?? r.key ?? "").trim();
                const need       = Number(r.count ?? 0);
                if (!labelOrKey || !Number.isFinite(need) || need <= 0) continue;

                const cid = resolveToCatalogId(labelOrKey);
                if (!cid) continue;

                const access = canAccessCatalogItem(cid, effectiveCompletedPrereqs);
                if (!access.allowed) continue;

                const rec = FULL_CATALOG.recordsById[cid];
                if (!rec?.displayName) continue;

                const mapKey = String(cid);
                if (!needMap[mapKey]) {
                    needMap[mapKey] = { catalogId: cid, itemName: rec.displayName, totalNeed: 0, neededFor: [] };
                }
                needMap[mapKey].totalNeed += need;
                needMap[mapKey].neededFor.push({ syndicateName: syn.name, rankTitle, need });
            }
        }

        const out: NeedLine[] = Object.values(needMap).map((agg) => {
            const have = Number(counts[String(agg.catalogId)] ?? 0);
            return { ...agg, have, remaining: Math.max(0, agg.totalNeed - have) };
        });

        out.sort((a, b) => b.remaining - a.remaining || a.itemName.localeCompare(b.itemName));
        return out.filter((l) => l.remaining > 0);
    }, [syndicates, effectiveCompletedPrereqs, counts]);

    return (
        <WorkspacePanel className="p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-lg font-semibold">Inventory (Work on Next)</div>
                    <div className="text-sm text-slate-400 mt-1">
                        Items still needed for accessible syndicate rank-ups, sorted by remaining quantity.
                    </div>
                </div>
                <WorkspaceAction
                    className="shrink-0 rounded-lg border-slate-700 bg-slate-950/20 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:bg-slate-900/40"
                    onClick={() => setActivePage("inventory")}
                >
                    Full Inventory
                </WorkspaceAction>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                {accessibleLines.length === 0 ? (
                    <div className="text-sm text-slate-400">
                        No accessible items needed — either all requirements are met or no syndicate rank-up data is loaded.
                    </div>
                ) : (
                    accessibleLines.map((line) => {
                        const pct     = Math.min(100, Math.round((line.have / line.totalNeed) * 100));
                        const forList = line.neededFor
                            .map((n) => `${n.syndicateName} (${n.rankTitle}: ${n.need.toLocaleString()})`)
                            .join(", ");

                        return (
                            <div key={String(line.catalogId)} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold break-words">{line.itemName}</div>
                                        <div className="text-xs text-slate-400 break-words mt-1">{forList}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-mono text-sm text-amber-300">
                                            {line.have.toLocaleString()} / {line.totalNeed.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            Need {line.remaining.toLocaleString()} more
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-amber-500 transition-all"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </WorkspacePanel>
    );
}
