import type { ReactNode } from "react";
import { useId } from "react";

function joinClasses(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export function WorkspacePanel(props: {
    children: ReactNode;
    className?: string;
    "aria-labelledby"?: string;
}) {
    return (
        <section
            className={joinClasses(
                "rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] shadow-[var(--wf-shadow-panel)]",
                props.className
            )}
            aria-labelledby={props["aria-labelledby"]}
        >
            {props.children}
        </section>
    );
}

export function WorkspaceStat(props: {
    label: string;
    value: string | number;
    hint?: string;
    className?: string;
}) {
    return (
        <div
            className={joinClasses(
                "rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3",
                props.className
            )}
        >
            <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">{props.label}</div>
            <div className="mt-1 font-mono text-lg text-[color:var(--wf-text-strong)]">{props.value}</div>
            {props.hint ? <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">{props.hint}</div> : null}
        </div>
    );
}

export function WorkspaceAction(props: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    type?: "button" | "submit" | "reset";
    title?: string;
    disabled?: boolean;
}) {
    return (
        <button
            type={props.type ?? "button"}
            onClick={props.onClick}
            title={props.title}
            disabled={props.disabled}
            className={joinClasses(
                "rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2 text-sm font-medium text-[color:var(--wf-text)] transition-colors hover:bg-[color:var(--wf-surface-strong)]",
                props.disabled ? "cursor-not-allowed opacity-40" : null,
                props.className
            )}
        >
            {props.children}
        </button>
    );
}

export function WorkspaceHero(props: {
    eyebrow: string;
    title: string;
    titleId?: string;
    description: string;
    actions?: ReactNode;
    stats?: ReactNode;
    className?: string;
}) {
    const generatedTitleId = useId();
    const titleId = props.titleId ?? generatedTitleId;
    return (
        <WorkspacePanel className={joinClasses("px-4 py-4 sm:px-5", props.className)} aria-labelledby={titleId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-accent-primary)]">
                        {props.eyebrow}
                    </div>
                    <h1 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--wf-text-strong)] sm:text-2xl">{props.title}</h1>
                    <p className="mt-1 max-w-2xl text-sm text-[color:var(--wf-text-muted)]">{props.description}</p>
                </div>
                {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
            </div>

            {props.stats ? (
                <div
                    className={joinClasses(
                        "mt-3 flex flex-wrap gap-x-6 gap-y-3 border-t border-[color:var(--wf-border-subtle)] pt-3",
                        "[&>*]:min-w-[120px] [&>*]:flex-1 [&>*]:rounded-none [&>*]:border-0 [&>*]:bg-transparent [&>*]:px-0 [&>*]:py-0 [&>*]:shadow-none",
                        "[&>*_div:first-child]:text-[10px] [&>*_div:first-child]:tracking-[0.18em]",
                        "[&>*_div:nth-child(2)]:mt-0.5 [&>*_div:nth-child(2)]:font-sans [&>*_div:nth-child(2)]:text-base [&>*_div:nth-child(2)]:font-semibold",
                        "[&>*_div:nth-child(3)]:mt-1 [&>*_div:nth-child(3)]:text-[11px] [&>*_div:nth-child(3)]:leading-5"
                    )}
                >
                    {props.stats}
                </div>
            ) : null}
        </WorkspacePanel>
    );
}

export function WorkspaceSection(props: {
    title: string;
    subtitle?: string;
    headingLevel?: 1 | 2;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    const headingId = useId();
    const Heading = props.headingLevel === 1 ? "h1" : "h2";
    return (
        <WorkspacePanel className={joinClasses("p-4", props.className)} aria-labelledby={headingId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <Heading id={headingId} className="text-lg font-semibold text-[color:var(--wf-text-strong)]">{props.title}</Heading>
                    {props.subtitle ? <div className="mt-1 text-sm text-[color:var(--wf-text-muted)]">{props.subtitle}</div> : null}
                </div>
                {props.actions ? <div className="flex items-center gap-2">{props.actions}</div> : null}
            </div>
            <div className={joinClasses("mt-4", props.bodyClassName)}>{props.children}</div>
        </WorkspacePanel>
    );
}

export function WorkspacePillButton(props: {
    label: string;
    active: boolean;
    onClick: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={props.onClick}
            aria-pressed={props.active}
            className={joinClasses(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                props.active
                    ? "border-[color:var(--wf-selection-border)] bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]"
                    : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text)] hover:bg-[color:var(--wf-surface-strong)]",
                props.className
            )}
        >
            {props.label}
        </button>
    );
}

export function WorkspaceSegmented(props: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={joinClasses(
                "flex w-fit gap-1 rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-1 shadow-[var(--wf-shadow-panel)]",
                props.className
            )}
        >
            {props.children}
        </div>
    );
}

export function WorkspaceSegmentedButton(props: {
    children: ReactNode;
    active: boolean;
    onClick: () => void;
    className?: string;
    disabled?: boolean;
    title?: string;
    "aria-pressed"?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={props.onClick}
            disabled={props.disabled}
            title={props.title}
            aria-pressed={props["aria-pressed"] ?? props.active}
            className={joinClasses(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                props.active
                    ? "bg-[color:var(--wf-selection)] text-[color:var(--wf-selection-text)]"
                    : "text-[color:var(--wf-text-muted)] hover:bg-[color:var(--wf-hover)] hover:text-[color:var(--wf-text-strong)]",
                props.disabled ? "cursor-not-allowed opacity-40" : null,
                props.className
            )}
        >
            {props.children}
        </button>
    );
}

export function WorkspaceFilterBar(props: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={joinClasses("flex flex-wrap items-center justify-between gap-3", props.className)}>
            {props.children}
        </div>
    );
}

export function WorkspaceFilterGroup(props: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={joinClasses("flex flex-wrap items-center gap-2", props.className)}>
            {props.children}
        </div>
    );
}
