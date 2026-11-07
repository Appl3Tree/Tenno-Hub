import { useId, useState, type ReactNode } from "react";

import { CollectionFiltersToggle } from "./CollectionLedgerShell";

export type CollectionSortOption = { value: string; label: string };

export function CollectionCatalogToolbar({
  searchLabel,
  searchPlaceholder,
  query,
  onQueryChange,
  sortLabel,
  sortValue,
  onSortChange,
  sortOptions,
  rowCount,
  activeFilterCount,
  filtersExpanded,
  onToggleFilters,
  filterPanelId,
  onClearDetail,
  extraAction,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  sortLabel: string;
  sortValue: string;
  onSortChange: (value: string) => void;
  sortOptions: CollectionSortOption[];
  rowCount: number;
  activeFilterCount: number;
  filtersExpanded: boolean;
  onToggleFilters: () => void;
  filterPanelId: string;
  onClearDetail: () => void;
  extraAction?: ReactNode;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const sortId = useId();
  const toolsId = useId();

  return (
    <div className="border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)]/95 shadow-sm backdrop-blur">
      <div className="grid grid-cols-[76px_92px_minmax(0,1fr)_48px] items-center gap-1 p-1.5 sm:flex sm:gap-2 sm:p-2">
        <input
          aria-label={searchLabel}
          className="col-span-full min-h-10 min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 sm:flex-1 sm:text-base"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
        />
        <CollectionFiltersToggle
          count={activeFilterCount}
          expanded={filtersExpanded}
          onClick={onToggleFilters}
          controlsId={filterPanelId}
          className="w-full gap-1 px-1.5 text-xs sm:w-auto sm:gap-2 sm:px-3 sm:text-sm"
        />
        <label className="sr-only" htmlFor={sortId}>{sortLabel}</label>
        <select
          id={sortId}
          aria-label={sortLabel}
          className="col-start-2 min-h-10 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-1.5 text-[11px] text-slate-200 sm:col-auto sm:w-auto sm:px-2.5 sm:text-xs"
          value={sortValue}
          onChange={(event) => onSortChange(event.target.value)}
        >
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span aria-label={`${rowCount.toLocaleString()} catalog rows`} className="col-start-3 justify-self-center whitespace-nowrap rounded-full border border-slate-800 bg-slate-900/80 px-1.5 py-2 text-[10px] text-slate-300 sm:col-auto sm:px-2.5 sm:text-xs">
          <span className="sm:hidden">{rowCount.toLocaleString()}</span>
          <span className="hidden sm:inline">{rowCount.toLocaleString()} rows</span>
        </span>
        <div className="relative col-start-4 sm:hidden">
          <button
            type="button"
            aria-expanded={toolsOpen}
            aria-controls={toolsId}
            aria-label="More catalog actions"
            onClick={() => setToolsOpen((open) => !open)}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] text-sm font-semibold text-[color:var(--wf-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--wf-accent-primary)]"
          >
            ···
          </button>
          {toolsOpen ? (
            <div id={toolsId} className="wf-popover absolute right-0 top-[calc(100%+0.5rem)] z-40 grid w-52 gap-2 rounded-2xl border p-3 backdrop-blur">
              <button type="button" onClick={onClearDetail} className="rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-900">Clear Detail</button>
              {extraAction}
            </div>
          ) : null}
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button type="button" className="min-h-10 rounded-xl border border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100" onClick={onClearDetail}>Clear Detail</button>
          {extraAction}
        </div>
      </div>
    </div>
  );
}
