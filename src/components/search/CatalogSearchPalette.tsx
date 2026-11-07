import { useEffect, useMemo, useRef, useState } from "react";
import {
    buildSearchDetailHash,
    searchCatalogEntities,
    type SearchEntityResult,
} from "../../domain/search/globalSearch";
import { isCatalogSearchShortcut } from "./keyboardShortcuts";

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

export default function CatalogSearchPalette() {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const results = useMemo(() => searchCatalogEntities(query, 12), [query]);
    const selectedResult = results[highlightedIndex] ?? results[0] ?? null;

    useEffect(() => {
        if (!open) return;
        function onMouseDown(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
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

            if (isCatalogSearchShortcut(event, isTypingTarget)) {
                event.preventDefault();
                setOpen(true);
                setHighlightedIndex(0);
                requestAnimationFrame(() => inputRef.current?.focus());
            }
            if (!isTypingTarget && event.key === "Escape") {
                setOpen(false);
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    function choose(result: SearchEntityResult) {
        const state = window.history.state && typeof window.history.state === "object"
            ? window.history.state as Record<string, unknown>
            : {};
        const nextState = { ...state, tennoHubSearchDetail: true };
        const nextUrl = `${window.location.pathname}${window.location.search}${buildSearchDetailHash({ kind: result.kind, id: result.id })}`;
        window.history.pushState(nextState, "", nextUrl);
        window.dispatchEvent(new PopStateEvent("popstate", { state: nextState }));
        setQuery("");
        setOpen(false);
        setHighlightedIndex(0);
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="wf-search-trigger group flex h-11 items-center gap-2 rounded-full border px-3 shadow-[var(--wf-shadow-panel)] transition-all">
                <SearchIcon className="h-4 w-4 shrink-0 text-[color:var(--wf-accent-gold)]" />
                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    value={query}
                    placeholder="Search the codex: items, mods, arcanes…"
                    aria-label="Catalog search"
                    aria-expanded={open}
                    aria-controls="wf-catalog-search-options"
                    aria-activedescendant={selectedResult ? `wf-catalog-${selectedResult.kind}-${selectedResult.id}` : undefined}
                    autoComplete="off"
                    className="w-full bg-transparent text-sm text-[color:var(--wf-text-strong)] placeholder:text-[color:var(--wf-text-dim)] focus:outline-none"
                    onFocus={() => {
                        setOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onBlur={(event) => {
                        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setOpen(true);
                            setHighlightedIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setHighlightedIndex((current) => Math.max(current - 1, 0));
                        } else if (event.key === "Enter" && selectedResult) {
                            event.preventDefault();
                            choose(selectedResult);
                        } else if (event.key === "Escape") {
                            setOpen(false);
                        }
                    }}
                />
                <div className="hidden items-center gap-1 text-[11px] text-[color:var(--wf-text-muted)] lg:flex">
                    <span className="hidden xl:inline">Search</span>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-1.5 py-1 font-mono text-[10px] leading-none text-[color:var(--wf-text)] transition-colors">
                        ⌘
                    </span>
                    <span className="text-[color:var(--wf-text-dim)] xl:hidden">/</span>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-1.5 py-1 font-mono text-[10px] leading-none text-[color:var(--wf-text)] transition-colors">
                        K
                    </span>
                </div>
            </div>

            {open && (
                <div className="wf-popover absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-[24px] border backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-[color:var(--wf-border-subtle)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-text-muted)]">
                        <span>Catalog Search</span>
                        <span className="hidden sm:inline">Opens in side panel</span>
                    </div>
                    <div id="wf-catalog-search-options" role="listbox" aria-label="Catalog search results" className="max-h-[420px] overflow-y-auto p-2">
                        {!query.trim() ? (
                            <div role="status" className="px-3 py-8 text-center text-sm text-[color:var(--wf-text-muted)]">
                                Start typing to search the catalog without mixing in page navigation.
                            </div>
                        ) : results.length === 0 ? (
                            <div role="status" className="px-3 py-8 text-center text-sm text-[color:var(--wf-text-muted)]">
                                No catalog results match that search.
                            </div>
                        ) : (
                            results.map((result, index) => {
                                const isHighlighted = index === highlightedIndex;
                                return (
                                    <button
                                        key={`${result.kind}:${result.id}`}
                                        id={`wf-catalog-${result.kind}-${result.id}`}
                                        type="button"
                                        role="option"
                                        tabIndex={-1}
                                        aria-selected={isHighlighted}
                                        className={[
                                            "wf-popover-option flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                                            isHighlighted
                                                ? "bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]"
                                                : "hover:bg-[color:var(--wf-hover)]",
                                        ].join(" ")}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => choose(result)}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium">{result.name}</span>
                                            <span className="mt-1 block truncate text-xs text-[color:var(--wf-text-muted)]">{result.summary}</span>
                                        </span>
                                        <span className="shrink-0 text-right">
                                            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wf-text-muted)]">
                                                {result.kind}
                                            </span>
                                            <span className="mt-1 inline-flex rounded-full border border-[color:var(--wf-border-strong)] bg-[color:var(--wf-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wf-accent-text)]">
                                                {result.subtitle || "Open dossier"}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
