import { fetchWorldState, getCurrentWorldActivitySummary } from "../lib/worldStateCache";
import { useWorldStateNow, useWorldStateSnapshot } from "../lib/useWorldStateData";
import { WorkspaceAction, WorkspacePanel } from "./workspace/WorkspaceChrome";

export default function DashboardWorldState({ onOpen }: { onOpen: () => void }) {
    const { data, fetchedAt, isLoading, isRefreshing, error } = useWorldStateSnapshot();
    const now = useWorldStateNow();
    const activities = getCurrentWorldActivitySummary(data, now);
    const activityCount = activities.total;
    const preview = [
        ...activities.alerts.slice(0, 2).map((alert) => ({
            id: `alert:${alert.id}`,
            title: `${alert.missionType || "Alert"} · ${alert.node || "Unknown node"}`,
            detail: alert.reward || alert.faction,
        })),
        ...activities.events.slice(0, 2).map((event) => ({
            id: `event:${event.id}`,
            title: event.description || event.tooltip || "Active event",
            detail: event.currentScore != null && event.maximumScore != null
                ? `${event.currentScore.toLocaleString()} / ${event.maximumScore.toLocaleString()}`
                : event.expiry ? `Ends ${new Date(event.expiry).toLocaleString()}` : "Active now",
        })),
    ].slice(0, 3);

    return (
        <WorkspacePanel className="p-4 sm:p-5" aria-labelledby="dashboard-world-state-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wf-accent-primary)]">Live game state</div>
                    <h2 id="dashboard-world-state-title" className="mt-1 text-lg font-semibold text-[color:var(--wf-text-strong)]">Current opportunities</h2>
                    <p className="mt-1 text-xs text-[color:var(--wf-text-muted)]">
                        {data ? `${activityCount} active activities` : isLoading ? "Connecting to World State…" : "World State is unavailable."}
                        {fetchedAt ? ` · fetched ${new Date(fetchedAt).toLocaleTimeString()}` : ""}
                        {data?.alertsApiTimestamp && <span className="block">Alerts API {new Date(data.alertsApiTimestamp).toLocaleString()}</span>}
                    </p>
                </div>
                <div className="flex gap-2">
                    <WorkspaceAction onClick={() => { void fetchWorldState(true).catch(() => {}); }} disabled={isLoading || isRefreshing}>
                        {isLoading || isRefreshing ? "Refreshing…" : "Refresh"}
                    </WorkspaceAction>
                    <WorkspaceAction onClick={onOpen}>Open World State</WorkspaceAction>
                </div>
            </div>

            {error && <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/15 px-3 py-2 text-xs text-amber-200">Showing the last successful snapshot; refresh failed.</div>}

            {preview.length > 0 ? (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {preview.map((item) => (
                        <li key={item.id} className="min-w-0 rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2">
                            <div className="truncate text-xs font-medium text-[color:var(--wf-text-strong)]">{item.title}</div>
                            {item.detail && <div className="mt-1 truncate text-[10px] text-[color:var(--wf-text-muted)]">{item.detail}</div>}
                        </li>
                    ))}
                </ul>
            ) : data && <div className="mt-4 text-xs text-[color:var(--wf-text-muted)]">No active alerts or limited-time events. Check World State for missions and rotations.</div>}
        </WorkspacePanel>
    );
}
