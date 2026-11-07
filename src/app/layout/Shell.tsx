// ===== FILE: src/app/layout/Shell.tsx =====
import { useEffect, useRef, useState } from "react";
import { useTrackerStore } from "../../store/store";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { getRouteByKey } from "../routes";

const NEW_PLAYER_DISMISSED_KEY = "wft_newplayer_v1_dismissed";

// ── First-visit new player modal ─────────────────────────────────────────────

function NewPlayerModal({ onDismiss, onDontShow, onGo }: { onDismiss: () => void; onDontShow: () => void; onGo: () => void }) {
    const dialogRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const dialog = dialogRef.current;
        const firstButton = dialog?.querySelector<HTMLButtonElement>("button");
        firstButton?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault();
                onDismiss();
                return;
            }
            if (event.key !== "Tab" || !dialog) return;
            const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
            if (buttons.length === 0) return;
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
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
    }, [onDismiss]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-modal-root>
            {/* Backdrop */}
            <div className="wf-modal-backdrop absolute inset-0 backdrop-blur-sm" aria-hidden="true" />

            {/* Card */}
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-player-title" aria-describedby="new-player-description" className="wf-dialog relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl">
                {/* Accent strip */}
                <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600" />

                <div className="p-6">
                    <div className="flex items-start gap-3">
                        {/* Book icon */}
                        <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 p-2.5">
                            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 id="new-player-title" className="text-base font-semibold text-[color:var(--wf-text-strong)]">New — or returning?</h2>
                            <p id="new-player-description" className="mt-1.5 text-sm leading-relaxed text-[color:var(--wf-text-muted)]">
                                Check out the <span className="font-semibold text-slate-100">Tenno's Handbook</span> — it covers
                                quest order and the systems that trip up both beginners and returning
                                players alike: Eidolons, Kuva &amp; Liches, Focus schools, Syndicates,
                                farming strategies, and more.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <button onClick={onDismiss} className="text-xs text-[color:var(--wf-text-muted)] transition-colors hover:text-[color:var(--wf-text-strong)]">
                                Not now
                            </button>
                            <button onClick={onDontShow} className="text-xs text-[color:var(--wf-text-dim)] transition-colors hover:text-[color:var(--wf-text)]">
                                Don't show again
                            </button>
                        </div>
                        <button
                            onClick={onGo}
                            className="rounded-lg border border-blue-700 bg-blue-900/40 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-800/50 transition-colors"
                        >
                            Open Handbook →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export default function Shell(props: { children: React.ReactNode }) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [showNewPlayer, setShowNewPlayer] = useState(
        () => localStorage.getItem(NEW_PLAYER_DISMISSED_KEY) !== "1"
    );
    const setActivePage = useTrackerStore((s) => s.setActivePage);
    const activePage = useTrackerStore((s) => s.state.ui.activePage);

    function dismissNewPlayer() {
        setShowNewPlayer(false);
    }

    function dismissNewPlayerPermanently() {
        localStorage.setItem(NEW_PLAYER_DISMISSED_KEY, "1");
        setShowNewPlayer(false);
    }

    function goToHandbook() {
        setActivePage("handbook");
        dismissNewPlayerPermanently();
    }

    const activeRoute = getRouteByKey(activePage);
    const wideWorkspace = activeRoute.mode === "planning" || activeRoute.mode === "collection";
    const singleScrollCatalogRoute = ["inventory", "mods", "arcanes"].includes(activeRoute.key);

    return (
        <div className="wf-app-shell h-dvh flex flex-col overflow-hidden text-[color:var(--wf-text)]">

            <Topbar onMenuToggle={() => setMobileNavOpen((v) => !v)} mobileNavOpen={mobileNavOpen} />

            <div className="flex flex-1 min-h-0 overflow-hidden relative">

                {mobileNavOpen && (
                    <div
                        className="wf-modal-backdrop fixed inset-0 z-30 lg:hidden"
                        aria-hidden="true"
                        onClick={() => setMobileNavOpen(false)}
                    />
                )}

                <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

                <main className={["wf-workspace min-w-0 flex-1", singleScrollCatalogRoute || mobileNavOpen ? "overflow-hidden" : "overflow-y-auto"].join(" ")}>
                    <div className={[
                        singleScrollCatalogRoute ? "h-full min-h-0 py-2 lg:py-3" : "min-h-full py-4 lg:h-full",
                        wideWorkspace
                            ? "px-3 md:px-5 xl:px-7"
                            : "mx-auto max-w-[1600px] px-4 md:px-5 xl:px-6",
                    ].join(" ")}>
                        {props.children}
                    </div>
                </main>
            </div>

            {showNewPlayer && (
                <NewPlayerModal onDismiss={dismissNewPlayer} onDontShow={dismissNewPlayerPermanently} onGo={goToHandbook} />
            )}
        </div>
    );
}
