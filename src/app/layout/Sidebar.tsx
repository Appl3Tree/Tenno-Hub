import { useEffect, useRef, useState } from "react";
import { useTrackerStore } from "../../store/store";
import {
    NAV_ROUTES,
    WORK_MODE_META,
    WORK_MODE_ORDER,
    getDefaultRouteForMode,
    getRouteByKey,
    type WorkModeKey,
} from "../routes";
import { setAppTheme, useAppTheme } from "../../lib/settingsPreferences";

const SIDEBAR_COLLAPSED_KEY = "wft_sidebar_collapsed";

const PAGE_ICONS: Record<string, React.ReactNode> = {
    dashboard: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
    ),
    inventory: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8h14M5 8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
            <path d="M10 12h4" />
        </svg>
    ),
    starchart: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    prereqs: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4" />
            <path d="M5 7h14M5 12h6M5 17h8" />
        </svg>
    ),
    syndicates: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7" r="3" />
            <circle cx="17" cy="10" r="2.5" />
            <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
            <path d="M17 13a5 5 0 0 1 5 5v1" />
        </svg>
    ),
    goals: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L3 7l9 5 9-5-9-5z" />
            <path d="M3 17l9 5 9-5" />
            <path d="M3 12l9 5 9-5" />
        </svg>
    ),
    requirements: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 16l4-4 4 4 4-6" />
        </svg>
    ),
    handbook: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
    ),
    imports: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    ),
    settings: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
    diagnostics: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    mods: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="11" rx="1.5" />
            <path d="M6.5 3v11" />
            <path d="M10 7H3" />
            <path d="M14 5h7M14 12h7M14 19h5" />
            <circle cx="13" cy="5" r="1" fill="currentColor" stroke="none" />
            <circle cx="13" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="13" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
    ),
    arcanes: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.7 5.48 6.05.88-4.38 4.27 1.04 6.04L12 16.93l-5.41 2.84 1.04-6.04L3.25 9.36l6.05-.88L12 3z" />
            <circle cx="12" cy="12" r="2.2" />
        </svg>
    ),
    challenges: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
            <path d="M15 7a4 4 0 1 0-6 3.46V14h4v-3.54A4 4 0 0 0 15 7z" />
        </svg>
    ),
    intrinsics: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
    ),
    relics: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ),
    relic_planner: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ),
    build_planner: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16v14H4z" />
            <path d="M8 9h8M8 13h3M14 13h2" />
        </svg>
    ),
    world_state: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    ),
};

const WORK_MODE_ICONS: Record<WorkModeKey, React.ReactNode> = {
    command: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    ),
    progression: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18h18" />
            <path d="M7 14l3-3 3 2 4-5" />
        </svg>
    ),
    collection: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16" />
            <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            <path d="M9 11h6M9 15h4" />
        </svg>
    ),
    planning: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
        </svg>
    ),
    system: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
};

function ModeButton({
    mode,
    active,
    collapsed,
    onClick,
}: {
    mode: WorkModeKey;
    active: boolean;
    collapsed: boolean;
    onClick: () => void;
}) {
    const meta = WORK_MODE_META[mode];
    return (
        <button
            onClick={onClick}
            aria-pressed={active}
            className={[
                "group relative flex items-center rounded-xl border px-2.5 py-2 text-left transition-all",
                collapsed ? "flex-col justify-center gap-1.5 px-1.5 text-center" : "gap-2.5",
                active
                    ? "border-[color:var(--wf-border-accent)] bg-[color:var(--wf-surface-strong)] text-[color:var(--wf-text-strong)] shadow-[0_0_0_1px_rgba(140,123,255,0.16)]"
                    : "border-transparent text-[color:var(--wf-text-muted)] hover:border-[color:var(--wf-border-subtle)] hover:bg-[color:var(--wf-surface-soft)] hover:text-[color:var(--wf-text)]",
            ].join(" ")}
            title={meta.desc}
        >
            <span className={active ? "text-[color:var(--wf-accent-primary)]" : "text-[color:var(--wf-text-muted)] group-hover:text-[color:var(--wf-text)]"}>
                {WORK_MODE_ICONS[mode]}
            </span>
            {!collapsed && (
                <span className="min-w-0">
                    <span className="block text-sm font-medium leading-none">{meta.label}</span>
                    <span className="mt-1 block text-[11px] leading-tight text-[color:var(--wf-text-dim)]">{meta.desc}</span>
                </span>
            )}
            {collapsed && <span className="max-w-full text-[9px] font-medium leading-tight">{meta.shortLabel}</span>}
        </button>
    );
}

function RouteButton({
    route,
    active,
    collapsed,
    onClick,
}: {
    route: (typeof NAV_ROUTES)[number];
    active: boolean;
    collapsed: boolean;
    onClick: () => void;
}) {
    return (
        <button
            key={route.key}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? `${route.label}: ${route.desc}` : undefined}
            className={[
                "group relative flex items-center rounded-xl px-2.5 py-2.5 text-left transition-colors",
                collapsed ? "flex-col justify-center gap-1.5 px-1.5 py-2 text-center" : "gap-2.5",
                active
                    ? "bg-[color:var(--wf-surface-strong)] text-[color:var(--wf-text-strong)]"
                    : "text-[color:var(--wf-text-muted)] hover:bg-[color:var(--wf-surface-soft)] hover:text-[color:var(--wf-text)]",
            ].join(" ")}
            title={route.desc}
        >
            <span
                className={[
                    "absolute left-1.5 h-4 w-0.5 rounded-full transition-all",
                    active ? "bg-[color:var(--wf-accent-primary)] opacity-100" : "opacity-0",
                ].join(" ")}
            />
            <span className={active ? "text-[color:var(--wf-text-strong)]" : "text-[color:var(--wf-text-dim)] group-hover:text-[color:var(--wf-text)]"}>
                {PAGE_ICONS[route.key]}
            </span>
            {!collapsed && (
                <span className="min-w-0">
                    <span className="block truncate text-sm font-medium leading-none">{route.label}</span>
                    <span className="mt-1 block truncate text-[11px] text-[color:var(--wf-text-dim)]">{route.desc}</span>
                </span>
            )}
            {collapsed && <span className="max-w-full text-[9px] font-medium leading-tight">{route.shortLabel ?? route.label}</span>}
        </button>
    );
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
    const activePage = useTrackerStore((s) => s.state.ui.activePage);
    const setActivePage = useTrackerStore((s) => s.setActivePage);
    const theme = useAppTheme();
    const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    const activeMode = getRouteByKey(activePage).mode;
    const modeRoutes = NAV_ROUTES.filter((route) => route.mode === activeMode);
    const mobileSidebarRef = useRef<HTMLElement | null>(null);
    const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!mobileOpen) return;
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        mobileCloseButtonRef.current?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !mobileSidebarRef.current) return;
            const focusable = Array.from(mobileSidebarRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            if (previouslyFocused?.isConnected && previouslyFocused.getClientRects().length > 0) previouslyFocused.focus();
        };
    }, [mobileOpen, onClose]);

    function toggleTheme() {
        setAppTheme(theme === "dark" ? "light" : "dark");
    }

    function toggleCollapsed() {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
            return next;
        });
    }

    function renderNavContent(isMobile = false) {
        return (
            <>
                <div className="border-b border-[color:var(--wf-border-subtle)] px-2 py-3">
                    {!collapsed || isMobile ? (
                        <div className="mb-2 px-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">Workspaces</div>
                        </div>
                    ) : null}
                    <div className="flex flex-col gap-2">
                        {WORK_MODE_ORDER.map((mode) => (
                            <ModeButton
                                key={mode}
                                mode={mode}
                                active={mode === activeMode}
                                collapsed={collapsed && !isMobile}
                                onClick={() => {
                                    if (mode !== activeMode) {
                                        setActivePage(getDefaultRouteForMode(mode).key);
                                    }
                                    onClose();
                                }}
                            />
                        ))}
                    </div>
                </div>

                <nav aria-label={`Pages in ${WORK_MODE_META[activeMode].label}`} className="wf-sidebar-nav flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
                    {!collapsed || isMobile ? (
                        <div className="mb-2 px-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">
                                {WORK_MODE_META[activeMode].label}
                            </div>
                        </div>
                    ) : null}
                    {modeRoutes.map((route) => (
                        <RouteButton
                            key={route.key}
                            route={route}
                            active={route.key === activePage || (activePage === "relics" && route.key === "relic_planner")}
                            collapsed={collapsed && !isMobile}
                            onClick={() => {
                                setActivePage(route.key);
                                onClose();
                            }}
                        />
                    ))}
                </nav>
            </>
        );
    }

    const footer = (
        <div className="border-t border-[color:var(--wf-border-subtle)] p-2 space-y-1 shrink-0">
            <button
                onClick={toggleTheme}
                className={[
                    "w-full flex items-center rounded-xl px-2.5 py-2 text-left transition-colors",
                    collapsed ? "justify-center" : "gap-2.5",
                    "text-[color:var(--wf-text-muted)] hover:bg-[color:var(--wf-surface-soft)] hover:text-[color:var(--wf-text)]",
                ].join(" ")}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
                {theme === "dark" ? (
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                ) : (
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
                {!collapsed && (
                    <span className="text-sm font-medium leading-none">
                        {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </span>
                )}
            </button>

            <a
                href="https://ko-fi.com/appl3tree"
                target="_blank"
                rel="noopener noreferrer"
                className={[
                    "w-full flex items-center rounded-xl px-2.5 py-2 text-left transition-colors",
                    collapsed ? "justify-center" : "gap-2.5",
                    "text-[color:var(--wf-accent-gold)] hover:bg-[color:var(--wf-surface-soft)] hover:text-[color:var(--wf-text-strong)]",
                ].join(" ")}
                title="Support on Ko-fi"
                onClick={onClose}
            >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/></svg>
                {!collapsed && <span className="text-sm font-medium leading-none">Support</span>}
            </a>
        </div>
    );

    return (
        <>
            <aside
                ref={mobileSidebarRef}
                aria-label="Workspace controls"
                className={[
                    "wf-rail hidden lg:flex shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200",
                    collapsed ? "w-[92px]" : "w-[280px]",
                ].join(" ")}
            >
                <div className={["flex items-center border-b border-[color:var(--wf-border-subtle)] p-2", collapsed ? "justify-center" : "justify-end"].join(" ")}>
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] p-2 text-[color:var(--wf-text-muted)] transition-colors hover:border-[color:var(--wf-border-strong)] hover:text-[color:var(--wf-text)]"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {collapsed ? (
                                <>
                                    <path d="M9 18l6-6-6-6" />
                                    <path d="M4 4v16" />
                                </>
                            ) : (
                                <>
                                    <path d="M15 18l-6-6 6-6" />
                                    <path d="M20 4v16" />
                                </>
                            )}
                        </svg>
                    </button>
                </div>
                {renderNavContent(false)}
                {footer}
            </aside>

            <aside
                id="mobile-workspace-navigation"
                aria-label="Mobile workspace navigation"
                aria-hidden={!mobileOpen}
                aria-modal={mobileOpen || undefined}
                inert={!mobileOpen}
                role={mobileOpen ? "dialog" : undefined}
                className={[
                    "wf-rail wf-mobile-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col overflow-hidden border-r transition-transform duration-200 lg:hidden",
                    mobileOpen ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
            >
                <div className="flex items-center justify-between px-4 h-12 border-b border-[color:var(--wf-border-subtle)] shrink-0">
                    <span className="text-sm font-semibold text-[color:var(--wf-text)]">Workspaces</span>
                    <button
                        type="button"
                        ref={mobileCloseButtonRef}
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-[color:var(--wf-text-muted)] transition-colors hover:bg-[color:var(--wf-surface-soft)] hover:text-[color:var(--wf-text)]"
                        aria-label="Close navigation"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {renderNavContent(true)}
                {footer}
            </aside>
        </>
    );
}
