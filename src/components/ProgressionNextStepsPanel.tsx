// ===== FILE: src/components/ProgressionNextStepsPanel.tsx =====
import { useMemo } from "react";
import { useTrackerStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { buildProgressionPlan } from "../domain/logic/plannerEngine";
import { buildPrereqIndex } from "../domain/logic/prereqEngine";
import { PREREQ_REGISTRY } from "../catalog/prereqs/prereqRegistry";
import { computeUnlockGraphSnapshot } from "../domain/logic/unlockGraph";
import { deriveCompletedMap, isAutoTrackedPrereq } from "../domain/logic/syndicatePrereqs";
import type { PrereqId } from "../domain/ids/prereqIds";
import type { SyndicateState } from "../domain/types";

const EMPTY_COMPLETED: Record<string, boolean> = {};
const EMPTY_SYNDICATES: SyndicateState[] = [];
const EMPTY_NODE_COMPLETED: Record<string, boolean> = {};
const EMPTY_INVENTORY_COUNTS: Record<string, number> = {};
const EMPTY_INTRINSICS: Record<string, number> = {};

function PrereqsLink() {
    const setActivePage = useTrackerStore((s) => s.setActivePage);
    return (
        <button
            onClick={() => setActivePage("prereqs")}
            className="text-[11px] text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
        >
            Prerequisites
        </button>
    );
}

export default function ProgressionNextStepsPanel({ embedded = false }: { embedded?: boolean }) {
    const setPrereqCompleted = useTrackerStore((s) => s.setPrereqCompleted);
    const { completedMap, syndicates, masteryRank, nodeCompletedMap, inventoryCounts, railjackIntrinsics } = useTrackerStore(
        useShallow((s) => ({
            completedMap:     s.state.prereqs?.completed ?? EMPTY_COMPLETED,
            syndicates:       s.state.syndicates ?? EMPTY_SYNDICATES,
            masteryRank:      s.state.player?.masteryRank ?? null,
            nodeCompletedMap: s.state.missions?.nodeCompleted ?? EMPTY_NODE_COMPLETED,
            inventoryCounts:  s.state.inventory.counts ?? EMPTY_INVENTORY_COUNTS,
            railjackIntrinsics: s.state.intrinsics?.railjack ?? EMPTY_INTRINSICS,
        }))
    );

    const mergedMap = useMemo(
        () => deriveCompletedMap(completedMap, syndicates, masteryRank, nodeCompletedMap, railjackIntrinsics),
        [completedMap, syndicates, masteryRank, nodeCompletedMap, railjackIntrinsics]
    );

    const evalContext = useMemo(
        () => ({
            masteryRank,
            nodeCompletedMap,
            inventoryCounts,
            railjackIntrinsics,
            syndicateRankById: Object.fromEntries(syndicates.map((syndicate) => [syndicate.id, syndicate.rank])),
        }),
        [masteryRank, nodeCompletedMap, inventoryCounts, syndicates, railjackIntrinsics],
    );

    const prereqIndex = useMemo(() => buildPrereqIndex(PREREQ_REGISTRY), []);
    const enrichedSteps = useMemo(() => {
        try {
            return (buildProgressionPlan(mergedMap, evalContext).steps ?? [])
                .filter((s: any) => s.id !== "planner_error_no_steps");
        } catch { return []; }
    }, [mergedMap, evalContext]);

    const unlockImpactByStepId = useMemo(() => {
        const result: Record<string, string[]> = {};
        const currentSnap = computeUnlockGraphSnapshot(mergedMap, PREREQ_REGISTRY, evalContext);
        const currentActionableIds = new Set(currentSnap.actionable.map((s) => s.id));

        for (const step of enrichedSteps) {
            if (step.blocked) continue;
            const simMap  = { ...mergedMap, [step.prereqId]: true };
            const simSnap = computeUnlockGraphSnapshot(simMap, PREREQ_REGISTRY, evalContext);
            const newlyActionable = simSnap.actionable
                .map((s) => s.id)
                .filter((id) => !currentActionableIds.has(id) && id !== step.prereqId)
                .map((id) => { const def = prereqIndex[id as PrereqId]; return def ? def.label : id; })
                .slice(0, 5);
            if (newlyActionable.length > 0) result[step.id] = newlyActionable;
        }
        return result;
    }, [enrichedSteps, evalContext, mergedMap, prereqIndex]);

    function isComplete(id: string) { return mergedMap[id] === true; }

    if (enrichedSteps.length === 0) return null;

    return (
        <div
            className={[
                "h-full flex flex-col overflow-hidden",
                embedded ? "" : "rounded-2xl border border-slate-800 bg-slate-950/40",
            ].join(" ")}
        >

            {/* ── Fixed header ── */}
            <div className={[
                "flex items-start justify-between gap-3 shrink-0",
                embedded ? "px-0 pb-4" : "border-b border-slate-800/60 px-4 pt-4 pb-3",
            ].join(" ")}>
                <div>
                    <div className="text-base font-semibold">Progression Goals</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                        Mark complete to advance recommended next steps.
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <PrereqsLink />
                    <span className="text-xs text-slate-600 font-mono">{enrichedSteps.length} remaining</span>
                </div>
            </div>

            {/* ── Scrollable list ── */}
            <div className={["flex-1 overflow-y-auto flex flex-col gap-2", embedded ? "px-0 py-0" : "px-4 py-3"].join(" ")}>
                {enrichedSteps.map((step) => {
                    const completed = isComplete(step.prereqId);
                    return (
                        <div
                            key={step.id}
                            className={[
                                "rounded-xl border px-3 py-2.5 transition-colors",
                                completed
                                    ? "border-emerald-900/30 bg-emerald-950/10 opacity-60"
                                    : "border-slate-800 bg-slate-950/30"
                            ].join(" ")}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className={[
                                        "text-sm font-semibold break-words",
                                        completed ? "line-through text-slate-500" : "text-slate-100"
                                    ].join(" ")}>
                                        {step.title}
                                    </div>
                                    {step.description && !completed && (
                                        <div className="text-xs text-slate-400 break-words mt-0.5">
                                            {step.description}
                                        </div>
                                    )}
                                    {step.tags?.length > 0 && !completed && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {step.tags.map((t: string) => (
                                                <span
                                                    key={t}
                                                    className="text-[10px] rounded-full border border-slate-700 bg-slate-950/40 px-2 py-0.5 text-slate-400"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {isAutoTrackedPrereq(step.prereqId) ? (
                                    <div className="shrink-0 text-right">
                                        <div className="text-[10px] text-slate-500 leading-tight">Auto-tracked</div>
                                        <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                                            Update from your <span className="text-sky-400 font-medium">profile or trackers</span>
                                        </div>
                                    </div>
                                ) : step.blocked ? (
                                    <span className="shrink-0 rounded-full border border-amber-900/50 bg-amber-950/30 px-2 py-1 text-[10px] font-medium text-amber-300">
                                        Locked
                                    </span>
                                ) : (
                                    <label className="flex items-center gap-2 text-xs text-slate-400 shrink-0 cursor-pointer hover:text-slate-200 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={completed}
                                            onChange={(e) => setPrereqCompleted(step.prereqId, e.target.checked)}
                                        />
                                        Done
                                    </label>
                                )}
                            </div>

                            {/* Missing prereqs */}
                            {step.missingLabels?.length > 0 && !completed && (
                                <div className="mt-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-2 py-1.5">
                                    <div className="text-[11px] font-semibold text-amber-300">Blocked by:</div>
                                    <ul className="mt-0.5 list-disc pl-4 text-[11px] text-amber-200 space-y-0.5">
                                        {step.missingLabels.map((label: string) => <li key={label}>{label}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Unlock impact */}
                            {unlockImpactByStepId[step.id]?.length > 0 && !completed && (
                                <div className="mt-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-2 py-1.5">
                                    <div className="text-[11px] font-semibold text-emerald-400">Completing this unlocks:</div>
                                    <ul className="mt-0.5 list-disc pl-4 text-[11px] text-emerald-300 space-y-0.5">
                                        {unlockImpactByStepId[step.id].map((label) => <li key={label}>{label}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
