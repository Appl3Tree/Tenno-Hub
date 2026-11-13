// ===== FILE: src/app/App.tsx =====
import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import Shell from "./layout/Shell";
import ErrorBoundary from "./ErrorBoundary";
import { useTrackerStore } from "../store/store";
import type { PageKey } from "../domain/models/userState";
import { buildSearchDetailHash, parseSearchDetailHash, type SearchDetailRef } from "../domain/search/searchDetailHash";
import { appendSearchDetailRef, searchDetailRefsEqual, syncSearchDetailStack } from "../domain/search/searchDetailNavigation";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const WorldState = lazy(() => import("../pages/WorldState"));
const SearchDetail = lazy(() => import("../pages/SearchDetail"));
const Inventory = lazy(() => import("../pages/Inventory"));
const Arcanes = lazy(() => import("../pages/Arcanes"));
const StarChart = lazy(() => import("../pages/StarChart"));
const Prerequisites = lazy(() => import("../pages/Prerequisites"));
const Syndicates = lazy(() => import("../pages/Syndicates"));
const Goals = lazy(() => import("../pages/Goals"));
const Requirements = lazy(() => import("../pages/Requirements"));
const Handbook = lazy(() => import("../pages/Handbook"));
const Imports = lazy(() => import("../pages/Imports"));
const Settings = lazy(() => import("../pages/Settings"));
const Diagnostics = lazy(() => import("../pages/Diagnostics"));
const Mods = lazy(() => import("../pages/Mods"));
const Challenges = lazy(() => import("../pages/Challenges"));
const Intrinsics = lazy(() => import("../pages/Intrinsics"));
const RelicPlanner = lazy(() => import("../pages/Relics"));
const BuildPlanner = lazy(() => import("../pages/BuildPlanner"));

const PAGE_COMPONENTS: Record<PageKey, React.ComponentType> = {
    dashboard: Dashboard,
    world_state: WorldState,
    search_detail: Dashboard,
    inventory: Inventory,
    arcanes: Arcanes,
    starchart: StarChart,
    prereqs: Prerequisites,
    syndicates: Syndicates,
    goals: Goals,
    requirements: Requirements,
    handbook: Handbook,
    imports: Imports,
    settings: Settings,
    diagnostics: Diagnostics,
    mods: Mods,
    challenges: Challenges,
    intrinsics: Intrinsics,
    build_planner: BuildPlanner,
    relic_planner: RelicPlanner,
    relics: RelicPlanner,
};

function PageLoadingFallback() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center px-6" aria-busy="true">
            <div role="status" className="rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-4 py-3 text-sm text-[color:var(--wf-text-muted)] shadow-[var(--wf-shadow-panel)]">
                Loading workspace...
            </div>
        </div>
    );
}

function useDevStartupValidation() {
    const [validationError, setValidationError] = useState<Error | null>(null);

    useEffect(() => {
        if (!import.meta.env.DEV) return;

        let active = true;
        void import("../domain/logic/startupValidation")
            .then(async (mod) => {
                if (!active) return;
                await mod.validateDataOrThrow();
            })
            .catch((error) => {
                if (!active) return;
                setValidationError(error instanceof Error ? error : new Error(String(error)));
            });

        return () => {
            active = false;
        };
    }, []);

    if (validationError) {
        throw validationError;
    }
}

function useSearchDetailState(): [SearchDetailRef | null, () => void, (ref: SearchDetailRef, options?: { reset?: boolean }) => void, boolean, () => void] {
    const [stack, setStack] = useState<SearchDetailRef[]>(() => {
        const initial = parseSearchDetailHash(window.location.hash);
        return initial ? [initial] : [];
    });
    const detailRef = stack[stack.length - 1] ?? null;

    useEffect(() => {
        function syncFromHash() {
            setStack((current) => syncSearchDetailStack(current, window.location.hash));
        }

        window.addEventListener("hashchange", syncFromHash);
        window.addEventListener("popstate", syncFromHash);
        return () => {
            window.removeEventListener("hashchange", syncFromHash);
            window.removeEventListener("popstate", syncFromHash);
        };
    }, []);

    function closeDetail() {
        const historyState = window.history.state as { tennoHubSearchDetail?: boolean } | null;
        if (historyState?.tennoHubSearchDetail) {
            window.history.go(-Math.max(stack.length, 1));
        } else {
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }
        setStack([]);
    }

    function navigateDetail(nextRef: SearchDetailRef, options?: { reset?: boolean }) {
        if (searchDetailRefsEqual(stack[stack.length - 1] ?? null, nextRef)) return;
        const state = window.history.state && typeof window.history.state === "object"
            ? window.history.state as Record<string, unknown>
            : {};
        const ownsHistoryEntry = state.tennoHubSearchDetail === true;
        const nextState = ownsHistoryEntry ? { ...state, tennoHubSearchDetail: true } : state;
        const nextUrl = `${window.location.pathname}${window.location.search}${buildSearchDetailHash(nextRef)}`;

        // A direct-linked inspector keeps its existing history entry. Once the user
        // opened the inspector in-app, nested entity changes become normal Back steps.
        if (!options?.reset && ownsHistoryEntry) window.history.pushState(nextState, "", nextUrl);
        else window.history.replaceState(nextState, "", nextUrl);

        setStack((current) => appendSearchDetailRef(current, nextRef, options?.reset));
    }

    function goBack() {
        if (stack.length <= 1) return;
        const historyState = window.history.state as { tennoHubSearchDetail?: boolean } | null;
        if (historyState?.tennoHubSearchDetail) {
            window.history.back();
            return;
        }
        const previous = stack[stack.length - 2];
        if (!previous) return;
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${buildSearchDetailHash(previous)}`);
        setStack((current) => current.slice(0, -1));
    }

    return [detailRef, closeDetail, navigateDetail, stack.length > 1, goBack];
}

function SearchDetailPanel(props: { detailRef: SearchDetailRef; onClose: () => void; onNavigate: (ref: SearchDetailRef) => void; canGoBack: boolean; onBack: () => void }) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const onCloseRef = useRef(props.onClose);

    useEffect(() => {
        onCloseRef.current = props.onClose;
    }, [props.onClose]);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeButtonRef.current?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current.focus();
                return;
            }
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
            previouslyFocused?.focus();
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[70]">
            <div className="wf-modal-backdrop absolute inset-0 backdrop-blur-[2px]" aria-hidden="true" />
            <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="search-detail-title"
                aria-describedby="search-detail-description"
                tabIndex={-1}
                className="wf-inspector absolute inset-y-0 right-0 w-full max-w-[920px] overflow-hidden border-l"
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-[color:var(--wf-border-subtle)] px-4 py-3">
                        <div>
                            <h2 id="search-detail-title" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-text-muted)]">Catalog Inspector</h2>
                            <div id="search-detail-description" className="mt-1 text-sm text-[color:var(--wf-text)]">Inspect an item without leaving your current workspace.</div>
                        </div>
                        <div className="flex items-center gap-2">
                            {props.canGoBack ? (
                                <button
                                    type="button"
                                    onClick={props.onBack}
                                    aria-label="Go back to previous item"
                                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 text-sm font-medium text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-strong)] hover:bg-[color:var(--wf-hover)]"
                                >
                                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m15 18-6-6 6-6" />
                                    </svg>
                                    <span className="hidden sm:inline">Back</span>
                                </button>
                            ) : null}
                            <button
                                type="button"
                                ref={closeButtonRef}
                                onClick={props.onClose}
                                aria-label="Close catalog inspector"
                                className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-1.5 text-xs font-medium text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-border-strong)] hover:bg-[color:var(--wf-hover)]"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 overscroll-contain md:px-5">
                        <Suspense fallback={<PageLoadingFallback />}>
                            <SearchDetail detailRef={props.detailRef} onClose={props.onClose} onNavigate={props.onNavigate} canGoBack={props.canGoBack} onBack={props.onBack} mode="panel" />
                        </Suspense>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function App() {
    useDevStartupValidation();
    const [searchDetailRef, closeSearchDetail, navigateSearchDetail, canGoBackSearchDetail, goBackSearchDetail] = useSearchDetailState();
    const activePage = useTrackerStore((s) => s.state.ui.activePage);
    const ActivePage = PAGE_COMPONENTS[activePage];

    return (
        <div className="wf-app-root min-h-screen bg-[color:var(--wf-bg-app)] text-[color:var(--wf-text)]">
            <Shell>
                <Suspense fallback={<PageLoadingFallback />}>
                    <ErrorBoundary key={activePage} page={activePage}>
                        <ActivePage />
                    </ErrorBoundary>
                </Suspense>
            </Shell>
            {searchDetailRef ? (
                <SearchDetailPanel
                    detailRef={searchDetailRef}
                    onClose={closeSearchDetail}
                    onNavigate={(ref) => navigateSearchDetail(ref)}
                    canGoBack={canGoBackSearchDetail}
                    onBack={goBackSearchDetail}
                />
            ) : null}
        </div>
    );
}

