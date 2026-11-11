// src/pages/Dashboard.tsx
import { useMemo } from "react";

const EMPTY_COMPLETED: Record<string, boolean> = {};
const EMPTY_SYNDICATES: never[] = [];
const EMPTY_GOALS: never[] = [];
const EMPTY_DAILY_TASKS: never[] = [];
const EMPTY_NODE_COMPLETED: Record<string, boolean> = {};
const EMPTY_INVENTORY_COUNTS: Record<string, number> = {};
const EMPTY_INTRINSICS: Record<string, number> = {};
import WarframeResetTracker from "../components/WarframeResetTracker";
import DashboardWorldState from "../components/DashboardWorldState";
import ProgressionNextStepsPanel from "../components/ProgressionNextStepsPanel";
import DailyChecklist from "../components/DailyChecklist";
import { useTrackerStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { buildProgressionPlan } from "../domain/logic/plannerEngine";
import { deriveCompletedMap } from "../domain/logic/syndicatePrereqs";
import { WorkspaceAction, WorkspacePanel } from "../components/workspace/WorkspaceChrome";

export default function Dashboard() {
    const setActivePage = useTrackerStore((s) => s.setActivePage);
    const { completedMap, syndicates, masteryRank, goals, dailyTasks, nodeCompletedMap, inventoryCounts, railjackIntrinsics } = useTrackerStore(
        useShallow((s) => ({
            completedMap: s.state.prereqs?.completed ?? EMPTY_COMPLETED,
            syndicates: s.state.syndicates ?? EMPTY_SYNDICATES,
            masteryRank: s.state.player?.masteryRank,
            goals: s.state.goals ?? EMPTY_GOALS,
            dailyTasks: s.state.dailyTasks ?? EMPTY_DAILY_TASKS,
            nodeCompletedMap: s.state.missions?.nodeCompleted ?? EMPTY_NODE_COMPLETED,
            inventoryCounts: s.state.inventory.counts ?? EMPTY_INVENTORY_COUNTS,
            railjackIntrinsics: s.state.intrinsics?.railjack ?? EMPTY_INTRINSICS,
        }))
    );

    const mergedMap = useMemo(
        () => deriveCompletedMap(completedMap, syndicates, masteryRank, nodeCompletedMap, railjackIntrinsics),
        [completedMap, syndicates, masteryRank, nodeCompletedMap, railjackIntrinsics]
    );

    const progressionSteps = useMemo(() => {
        try {
            const syndicateRankById = Object.fromEntries(syndicates.map((syndicate) => [syndicate.id, syndicate.rank]));
            return (buildProgressionPlan(mergedMap, { masteryRank, nodeCompletedMap, inventoryCounts, railjackIntrinsics, syndicateRankById }).steps ?? []).filter((s: any) => s.id !== "planner_error_no_steps");
        } catch {
            return [];
        }
    }, [inventoryCounts, masteryRank, mergedMap, nodeCompletedMap, syndicates, railjackIntrinsics]);

    const hasProgressionSteps = progressionSteps.length > 0;
    const isNewPlayer = masteryRank == null && syndicates.length === 0 && Object.keys(completedMap).length === 0;
    const activeGoals = goals.filter((goal) => goal.isActive).length;
    const todayTaskCount = dailyTasks.length;
    const completedTasks = dailyTasks.filter((task) => task.isDone).length;
    // const completionRate = todayTaskCount > 0 ? Math.round((completedTasks / todayTaskCount) * 100) : 0;

    return (
        <div className="flex flex-col gap-6 pb-6">
            <WorkspacePanel className="px-4 py-4 sm:px-5" aria-labelledby="dashboard-page-title">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 max-w-2xl">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wf-accent-primary)]">Dashboard</div>
                        <h1 id="dashboard-page-title" className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--wf-text-strong)] sm:text-2xl">Progress and tasks for today</h1>
                        <p className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                            Pick up a progression unlock, update your checklist, or review daily resets. Live activity details are in World State.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <WorkspaceAction onClick={() => setActivePage("prereqs")}>Prerequisites</WorkspaceAction>
                        <WorkspaceAction onClick={() => setActivePage("requirements")}>Farming</WorkspaceAction>
                        <WorkspaceAction onClick={() => setActivePage("build_planner")}>Build Planner</WorkspaceAction>
                        <WorkspaceAction onClick={() => setActivePage("world_state")}>World State</WorkspaceAction>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 border-t border-[color:var(--wf-border-subtle)] pt-3 text-sm">
                    <div className="min-w-[130px]">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)]">Progression</div>
                        <div className="mt-1 font-semibold text-[color:var(--wf-text-strong)]">
                            {hasProgressionSteps ? `${progressionSteps.length} ready` : "Clear"}
                        </div>
                    </div>
                    <div className="min-w-[130px]">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)]">Pinned Goals</div>
                        <div className="mt-1 font-semibold text-[color:var(--wf-text-strong)]">{activeGoals.toLocaleString()}</div>
                    </div>
                    <div className="min-w-[130px]">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)]">Today</div>
                        <div className="mt-1 font-semibold text-[color:var(--wf-text-strong)]">
                            {todayTaskCount === 0 ? "Open" : `${completedTasks}/${todayTaskCount}`}
                        </div>
                    </div>
                    <div className="min-w-[130px]">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)]">Profile</div>
                        <div className="mt-1 font-semibold text-[color:var(--wf-text-strong)]">{masteryRank == null ? "Unknown" : `MR ${masteryRank}`}</div>
                    </div>
                    {isNewPlayer && (
                        <button
                            className="rounded-full border border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] px-3 py-1.5 text-xs font-medium text-[color:var(--wf-accent-text)] transition-colors hover:bg-[color:var(--wf-surface-strong)]"
                            onClick={() => setActivePage("handbook")}
                        >
                            Open Handbook
                        </button>
                    )}
                </div>
            </WorkspacePanel>

            <WorkspacePanel className="overflow-hidden rounded-[32px] px-5 py-5 lg:px-6">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <div className="min-w-0">
                        <div className="mb-5 flex items-end justify-between gap-4 border-b border-[color:var(--wf-border-subtle)] pb-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)]">Progression Focus</div>
                                <div className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--wf-text-strong)]">Recommended next unlocks</div>
                                <div className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                                    Advance the systems that open more of the game instead of chasing scattered side tasks.
                                </div>
                            </div>
                        </div>

                        {hasProgressionSteps ? (
                            <ProgressionNextStepsPanel embedded />
                        ) : (
                            <div className="flex min-h-[280px] flex-col justify-between rounded-[28px] border border-dashed border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)]/40 p-6">
                                <div>
                                    <div className="text-lg font-semibold text-[color:var(--wf-text-strong)]">No progression blockers right now</div>
                                    <div className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--wf-text-muted)]">
                                        Your current profile does not have any obvious prerequisite gaps in the planner. This is a good time to farm for goals,
                                        clean up backlog tasks, or work through the reset tracker.
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-wrap gap-2">
                                    <WorkspaceAction onClick={() => setActivePage("requirements")}>Review Farming Targets</WorkspaceAction>
                                    <WorkspaceAction onClick={() => setActivePage("build_planner")}>Open Build Planner</WorkspaceAction>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 border-t border-[color:var(--wf-border-subtle)] pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
                        <div className="mb-5 border-b border-[color:var(--wf-border-subtle)] pb-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--wf-text-dim)]">Today Queue</div>
                            <div className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--wf-text-strong)]">Personal checklist</div>
                            <div className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                                Keep this lightweight and personal. Use it for the things the system cannot infer for you.
                            </div>
                        </div>

                        <DailyChecklist expanded embedded />
                    </div>
                </div>
            </WorkspacePanel>

            <DashboardWorldState onOpen={() => setActivePage("world_state")} />

            <WorkspacePanel className="p-1">
                <WarframeResetTracker />
            </WorkspacePanel>
        </div>
    );
}
