import { useId, useState, type KeyboardEvent as ReactKeyboardEvent, type Ref, type ReactNode } from "react";

import { WorkspaceSegmented, WorkspaceSegmentedButton } from "../workspace/WorkspaceChrome";

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const COLLECTION_LEDGER_SHELL_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.6rem] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] shadow-[var(--wf-shadow-panel)]";

export const COLLECTION_SCROLL_CONTENT_CLASS =
  "rounded-[1.6rem] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] shadow-[var(--wf-shadow-panel)]";

export type CollectionActiveFilter = {
  id: string;
  label: string;
  onRemove: () => void;
};

export function CollectionScrollSurface({
  scrollportRef,
  contentRef,
  onScroll,
  ariaLabel,
  children,
  className = "",
}: {
  scrollportRef: Ref<HTMLDivElement>;
  contentRef: Ref<HTMLDivElement>;
  onScroll: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  function handleScrollKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const scrollport = event.currentTarget;
    const pageStep = Math.max(1, Math.floor(scrollport.clientHeight * 0.85));
    let top: number | null = null;

    if (event.key === "PageDown" || (event.key === " " && !event.shiftKey)) top = scrollport.scrollTop + pageStep;
    else if (event.key === "PageUp" || (event.key === " " && event.shiftKey)) top = scrollport.scrollTop - pageStep;
    else if (event.key === "Home") top = 0;
    else if (event.key === "End") top = scrollport.scrollHeight;
    else if (event.key === "ArrowDown") top = scrollport.scrollTop + 56;
    else if (event.key === "ArrowUp") top = scrollport.scrollTop - 56;

    if (top === null) return;
    event.preventDefault();
    scrollport.scrollTo({ top, behavior: "auto" });
  }

  return (
    <div
      ref={scrollportRef}
      data-collection-scrollport
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleScrollKeyDown}
      onScroll={onScroll}
      className={["min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--wf-accent-primary)]", className].join(" ")}
    >
      <div ref={contentRef} className="flex min-h-full flex-col">
        {children}
      </div>
    </div>
  );
}

export function CollectionFiltersToggle({
  count,
  expanded,
  onClick,
  controlsId,
  className = "",
}: {
  count: number;
  expanded: boolean;
  onClick: () => void;
  controlsId: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={onClick}
      className={joinClasses("inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-3 py-2 text-sm font-medium text-[color:var(--wf-text)] transition-colors hover:border-[color:var(--wf-accent-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wf-accent-primary)]", className)}
    >
      <span>Filters</span>
      <span className="rounded-full bg-[color:var(--wf-surface-soft)] px-2 py-0.5 text-xs tabular-nums text-[color:var(--wf-text-muted)]">
        {count}
      </span>
      <span className="sr-only">{expanded ? "Hide advanced filters" : "Show advanced filters"}</span>
    </button>
  );
}

export function CollectionFilterDisclosure({
  id,
  expanded,
  children,
}: {
  id: string;
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label="Advanced filters"
      hidden={!expanded}
      className="border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] p-3 sm:p-4"
    >
      {children}
    </section>
  );
}

export function CollectionActiveFilterSummary({
  filters,
  onClear,
  className = "",
}: {
  filters: CollectionActiveFilter[];
  onClear: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const summaryId = useId();
  if (filters.length === 0) return null;

  const visibleFilters = expanded ? filters : filters.slice(0, 4);
  const hiddenCount = filters.length - visibleFilters.length;

  return (
    <div className={["flex min-w-0 items-center gap-2 border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-3 py-2", className].join(" ")}>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wf-text-dim)]">Active</span>
      <div id={summaryId} className={expanded ? "flex min-w-0 flex-1 flex-wrap gap-1.5" : "flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto"}>
        {visibleFilters.map((filter) => (
          <span
            key={filter.id}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] py-1 pl-2.5 pr-1 text-xs text-[color:var(--wf-text-muted)]"
          >
            <span className="max-w-48 truncate">{filter.label}</span>
            <button
              type="button"
              aria-label={`Remove ${filter.label} filter`}
              title={`Remove ${filter.label}`}
              onClick={filter.onRemove}
              className="rounded-full px-1 text-[color:var(--wf-text-dim)] hover:bg-[color:var(--wf-surface-2)] hover:text-[color:var(--wf-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--wf-accent-primary)]"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={summaryId}
          onClick={() => setExpanded(true)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--wf-accent-primary)] hover:bg-[color:var(--wf-surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--wf-accent-primary)]"
        >
          +{hiddenCount} more
        </button>
      ) : expanded && filters.length > 4 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={summaryId}
          onClick={() => setExpanded(false)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--wf-accent-primary)] hover:bg-[color:var(--wf-surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--wf-accent-primary)]"
        >
          Show fewer
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--wf-text-muted)] underline decoration-[color:var(--wf-border-subtle)] underline-offset-2 hover:text-[color:var(--wf-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--wf-accent-primary)]"
      >
        Clear
      </button>
    </div>
  );
}

export function CollectionUtilityBand({
  primary,
  secondary,
  columnsClassName = "xl:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.85fr)]",
}: {
  primary: ReactNode;
  secondary: ReactNode;
  columnsClassName?: string;
}) {
  return (
    <div className="border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2.5">
      <div className={["grid gap-3 xl:items-start", columnsClassName].join(" ")}>
        {primary}
        {secondary}
      </div>
    </div>
  );
}

export function CollectionUtilityPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "min-w-0 rounded-[1.4rem] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)] px-5 py-3",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function CollectionResultsBand({
  title = "Table Filters",
  actions,
}: {
  title?: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--wf-text-muted)]">
          {title}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function CollectionModeBand({
  children,
  className = "",
  segmentedClassName = "",
}: {
  children: ReactNode;
  className?: string;
  segmentedClassName?: string;
}) {
  return (
    <div
      className={joinClasses(
        "relative z-10 border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-3 py-2 backdrop-blur",
        className,
      )}
    >
      <WorkspaceSegmented
        className={joinClasses("flex w-full flex-wrap gap-2 rounded-none border-0 bg-transparent p-0 shadow-none", segmentedClassName)}
      >
        {children}
      </WorkspaceSegmented>
    </div>
  );
}

export function CollectionModeButton({
  children,
  active,
  onClick,
  className = "",
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <WorkspaceSegmentedButton active={active} onClick={onClick} className={joinClasses("px-3 py-2 text-sm", className)}>
      {children}
    </WorkspaceSegmentedButton>
  );
}

export function CollectionRefineBand({
  title,
  children,
  className = "",
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative z-[9] border-b border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] px-4 py-2 backdrop-blur">
      <div className={joinClasses("grid gap-3", className)}>
        {title ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-text-muted)]">{title}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function CollectionRefineGroup({
  label,
  action,
  children,
}: {
  label: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-text-muted)]">
        <span>{label}</span>
        {action ? (
          <span className="text-xs font-normal normal-case tracking-normal text-[color:var(--wf-text-muted)]">{action}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function CollectionChipRail({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <div className="flex h-10 w-max min-w-full items-center gap-2 pr-2">{children}</div>
    </div>
  );
}
