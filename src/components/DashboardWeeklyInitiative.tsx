import { useMemo } from "react";
import { useWorldStateSnapshot } from "../lib/useWorldStateData";
import { useTrackerStore } from "../store/store";
import { WorkspaceAction, WorkspacePanel } from "./workspace/WorkspaceChrome";

type SourceRecord = Record<string, unknown>;

function asRecord(value: unknown): SourceRecord | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as SourceRecord
        : null;
}

function asFiniteNumber(value: unknown): number | null {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function displaySourceName(value: unknown): string {
    if (typeof value !== "string" || !value) return "Reward";
    const tail = value.split("/").filter(Boolean).at(-1) ?? value;
    return tail
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getRewards(record: SourceRecord | null): SourceRecord[] {
    if (!record) return [];
    const value = record.Rewards ?? record.rewards ?? record.rewwards;
    return Array.isArray(value)
        ? value.map(asRecord).filter((reward): reward is SourceRecord => !!reward)
        : [];
}

function getWeekCount(record: SourceRecord): number | null {
    return asFiniteNumber(record.WeekCount ?? record.weekCount ?? record.week);
}

export default function DashboardWeeklyInitiative({ onImport }: { onImport: () => void }) {
    const snapshot = useTrackerStore((store) => store.state.alecaFrameProgress);
    const { data } = useWorldStateSnapshot();

    const initiative = asRecord(data?.clanWeeklyInitiative);
    const currentWeek = initiative ? asFiniteNumber(initiative.week ?? initiative.WeekCount) : null;
    const entries = snapshot?.weeklyGuildVaultBonusInfo
        .map(asRecord)
        .filter((entry): entry is SourceRecord => !!entry) ?? [];

    const selected = useMemo(() => {
        if (currentWeek !== null) {
            const currentEntry = entries.find((entry) => getWeekCount(entry) === currentWeek);
            if (currentEntry) return currentEntry;
        }
        return [...entries].sort((left, right) =>
            (getWeekCount(right) ?? -Infinity) - (getWeekCount(left) ?? -Infinity),
        )[0] ?? null;
    }, [currentWeek, entries]);

    const selectedWeek = selected ? getWeekCount(selected) : null;
    const matchedCurrentWeek = currentWeek !== null && selectedWeek === currentWeek;
    const isStale = currentWeek !== null && selectedWeek !== null && selectedWeek !== currentWeek;
    const cannotVerifyWeek = currentWeek !== null && selectedWeek === null;
    const progress = selected ? asFiniteNumber(selected.Progress ?? selected.progress) : null;
    const savedRewards = getRewards(selected);
    const liveRewards = getRewards(initiative);
    const rewards = savedRewards.length > 0
        ? savedRewards
        : matchedCurrentWeek ? liveRewards : [];
    const milestones = rewards
        .map((reward) => ({
            reward,
            threshold: asFiniteNumber(reward.PointThreshold ?? reward.pointThreshold),
        }))
        .filter((milestone): milestone is { reward: SourceRecord; threshold: number } =>
            milestone.threshold !== null && milestone.threshold > 0,
        )
        .sort((left, right) => left.threshold - right.threshold);
    const maxThreshold = milestones.length >= 4
        ? Math.max(...milestones.map((milestone) => milestone.threshold))
        : null;
    const nextMilestone = progress === null
        ? null
        : milestones.find((milestone) => progress < milestone.threshold) ?? null;
    const bonusRegion = selected && !matchedCurrentWeek
        ? selected.BonusRegion ?? selected.bonusRegion
        : initiative?.bonusRegion ?? initiative?.BonusRegion ?? selected?.BonusRegion ?? selected?.bonusRegion;
    const importedAt = snapshot ? Date.parse(snapshot.importedAtIso) : NaN;
    const importedAtLabel = Number.isFinite(importedAt) ? new Date(importedAt).toLocaleString() : "unknown time";
    const progressLabel = progress === null ? null : Math.max(0, Math.floor(progress)).toLocaleString();
    const progressPercent = progress !== null && maxThreshold !== null
        ? Math.min(100, Math.max(0, progress / maxThreshold * 100))
        : null;

    return (
        <WorkspacePanel className="p-4 sm:p-5" aria-labelledby="dashboard-weekly-initiative-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wf-accent-primary)]">Weekly progress</div>
                    <h2 id="dashboard-weekly-initiative-title" className="mt-1 text-lg font-semibold text-[color:var(--wf-text-strong)]">
                        Personal Clan Rewards
                    </h2>
                    <p className="mt-1 text-xs text-[color:var(--wf-text-muted)]">
                        Your Clan Vault bonus contributions advance this personal reward track. Claim reached rewards in the game’s Clan menu; reimport AlecaFrame data to refresh your progress.
                    </p>
                </div>
                <WorkspaceAction onClick={onImport}>
                    {snapshot ? "Refresh from AlecaFrame" : "Import AlecaFrame data"}
                </WorkspaceAction>
            </div>

            {!snapshot ? (
                <p className="mt-4 rounded-lg border border-dashed border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-3 text-sm text-[color:var(--wf-text-muted)]">
                    Import your <code>lastData.dat</code> file to show your saved weekly progress here.
                </p>
            ) : !selected ? (
                <div className="mt-4 rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-3 py-3 text-sm text-[color:var(--wf-text-muted)]">
                    <div>No weekly progress record was found in this snapshot.</div>
                    <div className="mt-1 text-xs">Last imported {importedAtLabel}. Import a newer file to refresh it.</div>
                </div>
            ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                    <section className="min-w-0 rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div>
                                <div className="text-xs text-[color:var(--wf-text-muted)]">
                                    {matchedCurrentWeek ? "This week" : selectedWeek !== null ? `Saved week ${selectedWeek}` : "Saved progress"}
                                    {bonusRegion ? ` · ${displaySourceName(bonusRegion)}` : ""}
                                </div>
                                <div className="mt-1 text-2xl font-semibold text-[color:var(--wf-text-strong)]">
                                    {progressLabel !== null ? `${progressLabel}${maxThreshold !== null ? ` / ${maxThreshold.toLocaleString()}` : " points"}` : "Progress unavailable"}
                                </div>
                            </div>
                            {nextMilestone ? (
                                <div className="text-right text-xs text-[color:var(--wf-text-muted)]">
                                    Next reward at {nextMilestone.threshold.toLocaleString()} points
                                    <div className="mt-0.5 font-medium text-[color:var(--wf-text-strong)]">
                                        {displaySourceName(nextMilestone.reward.Reward ?? nextMilestone.reward.reward)}
                                    </div>
                                </div>
                            ) : progress !== null && milestones.length > 0 ? (
                                <div className="text-right text-xs font-medium text-emerald-300">All listed thresholds reached</div>
                            ) : null}
                        </div>

                        {progressPercent !== null ? (
                            <div
                                className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--wf-surface-2)]"
                                role="progressbar"
                                aria-label="Weekly Personal Rewards progress"
                                aria-valuemin={0}
                                aria-valuemax={maxThreshold ?? 100}
                                aria-valuenow={Math.min(progress ?? 0, maxThreshold ?? 100)}
                            >
                                <div className="h-full rounded-full bg-[color:var(--wf-accent-primary)]" style={{ width: `${progressPercent}%` }} />
                            </div>
                        ) : null}

                        {isStale ? (
                            <p className="mt-3 rounded-md border border-amber-800/40 bg-amber-950/15 px-2.5 py-2 text-xs text-amber-200">
                                The current game week is {currentWeek}. This saved record is for week {selectedWeek}; import a newer <code>lastData.dat</code> to refresh it.
                            </p>
                        ) : cannotVerifyWeek ? (
                            <p className="mt-3 rounded-md border border-amber-800/40 bg-amber-950/15 px-2.5 py-2 text-xs text-amber-200">
                                The current game week is {currentWeek}, but this saved record has no week number. Reimport a current <code>lastData.dat</code> to verify its progress.
                            </p>
                        ) : progress === null ? (
                            <p className="mt-3 text-xs text-[color:var(--wf-text-muted)]">
                                This snapshot has no recognized numeric progress value. Review the source values on the Imports page.
                            </p>
                        ) : null}
                        <p className="mt-3 text-[10px] text-[color:var(--wf-text-dim)]">From AlecaFrame import · {importedAtLabel}</p>
                    </section>

                    {milestones.length > 0 ? (
                        <section aria-label="Weekly personal reward milestones" className="space-y-1.5">
                            {milestones.map(({ reward, threshold }, index) => {
                                const reached = progress !== null && progress >= threshold;
                                const claimed = savedRewards.length > 0 && reward.RewardClaimed === true;
                                const itemCount = asFiniteNumber(reward.ItemCount ?? reward.itemCount) ?? 1;
                                const rewardName = displaySourceName(reward.Reward ?? reward.reward);
                                return (
                                    <div key={`${threshold}:${rewardName}:${index}`} className="flex items-center gap-2 rounded-md border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-2.5 py-2">
                                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${claimed ? "bg-emerald-500/20 text-emerald-300" : reached ? "bg-[color:var(--wf-selection)] text-[color:var(--wf-accent-text)]" : "bg-[color:var(--wf-surface-2)] text-[color:var(--wf-text-dim)]"}`} aria-hidden="true">
                                            {claimed || reached ? "✓" : index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-medium text-[color:var(--wf-text-strong)]">
                                                {itemCount.toLocaleString()}× {rewardName}
                                            </div>
                                            <div className="text-[10px] text-[color:var(--wf-text-muted)]">{threshold.toLocaleString()} points</div>
                                        </div>
                                        <span className="shrink-0 text-[10px] text-[color:var(--wf-text-dim)]">
                                            {claimed ? "Claimed" : reached ? "Reached" : progress === null ? "Pending" : `${(threshold - progress).toLocaleString()} to go`}
                                        </span>
                                    </div>
                                );
                            })}
                        </section>
                    ) : (
                        <p className="rounded-lg border border-dashed border-[color:var(--wf-border-subtle)] px-3 py-3 text-xs text-[color:var(--wf-text-muted)]">
                            Reward thresholds are unavailable for this saved week. Reimporting your file refreshes personal progress; current reward details appear when the live Weekly Initiative is available.
                        </p>
                    )}
                </div>
            )}
        </WorkspacePanel>
    );
}
