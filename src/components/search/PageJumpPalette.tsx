import { useEffect, useMemo, useRef, useState } from "react";
import { NAV_ROUTES, WORK_MODE_META, type NavRoute } from "../../app/routes";
import { isPageJumpShortcut, shouldPageJumpHandleEscape } from "./keyboardShortcuts";

function CompassIcon({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <path d="m14.8 9.2-1.9 5.6-5.7 1.9 1.9-5.6 5.7-1.9Z" />
        </svg>
    );
}

function scorePage(route: NavRoute, query: string, activePage: string): number {
    const normalized = query.trim().toLowerCase();
    const haystack = [
        route.label,
        route.shortLabel ?? "",
        route.desc,
        WORK_MODE_META[route.mode].label,
    ].join(" ").toLowerCase();

    let score = route.key === activePage ? 18 : 0;
    if (!normalized) {
        score += route.key === activePage ? 100 : 0;
        return score;
    }
    if (route.label.toLowerCase() === normalized) score += 140;
    else if (route.label.toLowerCase().startsWith(normalized)) score += 100;
    else if ((route.shortLabel ?? "").toLowerCase().startsWith(normalized)) score += 80;
    else if (haystack.includes(normalized)) score += 46;
    else score = -1;
    return score;
}

function PageJumpPaletteContent(props: {
    activePage: string;
    onSelectPage: (route: NavRoute) => void;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const openRef = useRef(false);

    function setPaletteOpen(nextOpen: boolean) {
        openRef.current = nextOpen;
        setOpen(nextOpen);
    }

    const results = useMemo(() => {
        return NAV_ROUTES
            .map((route) => ({ route, score: scorePage(route, query, props.activePage) }))
            .filter((entry) => entry.score >= 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.route.label.localeCompare(b.route.label);
            })
            .slice(0, query.trim() ? 8 : 6)
            .map((entry) => entry.route);
    }, [props.activePage, query]);

    const selectedRoute = results[highlightedIndex] ?? results[0] ?? null;
    const activeRoute = NAV_ROUTES.find((route) => route.key === props.activePage) ?? NAV_ROUTES[0];

    useEffect(() => {
        if (!open) return;
        function onMouseDown(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setPaletteOpen(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [open]);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null;
            const isTypingTarget =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                Boolean(target?.isContentEditable);

            if (isPageJumpShortcut(event, isTypingTarget)) {
                event.preventDefault();
                setPaletteOpen(true);
                setHighlightedIndex(0);
                requestAnimationFrame(() => inputRef.current?.focus());
            }
            if (shouldPageJumpHandleEscape(event, openRef.current, isTypingTarget)) {
                setPaletteOpen(false);
                triggerRef.current?.focus();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    function choose(route: NavRoute) {
        props.onSelectPage(route);
        setQuery("");
        setPaletteOpen(false);
        setHighlightedIndex(0);
    }

    return (
        <div className="relative shrink-0" ref={containerRef}>
            <button
                type="button"
                ref={triggerRef}
                aria-expanded={open}
                aria-controls="wf-page-jump-options"
                onClick={() => {
                    const shouldOpen = !open;
                    setPaletteOpen(shouldOpen);
                    if (shouldOpen) {
                        setHighlightedIndex(0);
                        requestAnimationFrame(() => inputRef.current?.focus());
                    }
                }}
                className="wf-search-trigger flex h-10 items-center gap-2 rounded-full border px-3 text-sm transition-colors hover:bg-[color:var(--wf-hover)]"
                title="Jump to a page"
                aria-label="Jump to a page"
            >
                <CompassIcon className="h-4 w-4 text-[color:var(--wf-text-muted)]" />
                <span className="hidden sm:inline">Pages</span>
                <span className="rounded-md border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wf-text-muted)]">
                    /
                </span>
            </button>

            {open && (
                <div className="wf-popover absolute left-0 top-full z-40 mt-2 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-[24px] border backdrop-blur-xl">
                    <div className="border-b border-[color:var(--wf-border-subtle)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-text-muted)]">
                        Page Jump
                    </div>
                    <div className="border-b border-[color:var(--wf-border-subtle)] px-3 py-2">
                        <input
                            ref={inputRef}
                            type="search"
                            role="combobox"
                            aria-label="Find a page"
                            aria-controls="wf-page-jump-options"
                            aria-expanded={open}
                            aria-activedescendant={selectedRoute ? `wf-page-jump-${selectedRoute.key}` : undefined}
                            autoComplete="off"
                            value={query}
                            placeholder={`Current: ${activeRoute.label}`}
                            className="w-full bg-transparent text-sm text-[color:var(--wf-text-strong)] placeholder:text-[color:var(--wf-text-dim)] focus:outline-none"
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setHighlightedIndex(0);
                            }}
                            onBlur={(event) => {
                                if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setPaletteOpen(false);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "ArrowDown") {
                                    event.preventDefault();
                                    setHighlightedIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
                                } else if (event.key === "ArrowUp") {
                                    event.preventDefault();
                                    setHighlightedIndex((current) => Math.max(current - 1, 0));
                                } else if (event.key === "Enter" && selectedRoute) {
                                    event.preventDefault();
                                    choose(selectedRoute);
                                } else if (event.key === "Escape") {
                                    setPaletteOpen(false);
                                    triggerRef.current?.focus();
                                }
                            }}
                        />
                    </div>
                    <div id="wf-page-jump-options" role="listbox" aria-label="Available pages" className="max-h-[360px] overflow-y-auto p-2">
                        {results.length === 0 ? (
                            <div role="status" className="px-3 py-8 text-center text-sm text-[color:var(--wf-text-muted)]">No pages match that search.</div>
                        ) : null}
                        {results.map((route, index) => {
                            const mode = WORK_MODE_META[route.mode];
                            const isActive = route.key === props.activePage;
                            const isHighlighted = index === highlightedIndex;

                            return (
                                <button
                                    key={route.key}
                                    id={`wf-page-jump-${route.key}`}
                                    type="button"
                                    role="option"
                                    tabIndex={-1}
                                    aria-selected={isHighlighted}
                                    aria-current={isActive ? "page" : undefined}
                                    className={[
                                        "wf-popover-option flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                                        isHighlighted ? "bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]" : "hover:bg-[color:var(--wf-hover)]",
                                    ].join(" ")}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => choose(route)}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">{route.label}</span>
                                        <span className="mt-1 block truncate text-xs text-[color:var(--wf-text-muted)]">{route.desc}</span>
                                    </span>
                                    <span className="shrink-0 text-right">
                                        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wf-text-muted)]">
                                            {mode.label}
                                        </span>
                                        {isActive ? (
                                            <span className="mt-1 inline-flex rounded-full border border-[color:var(--wf-border-strong)] bg-[color:var(--wf-surface-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wf-text)]">
                                                Current
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PageJumpPalette(props: {
    activePage: string;
    onSelectPage: (route: NavRoute) => void;
}) {
    return <PageJumpPaletteContent key={props.activePage} {...props} />;
}
