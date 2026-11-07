// ===== FILE: src/app/ErrorBoundary.tsx =====
import { Component, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    /** Page name shown in the error UI. */
    page?: string;
}

interface State {
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override componentDidCatch(error: Error, info: { componentStack: string }) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    handleReset = () => this.setState({ error: null });

    override render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <section aria-labelledby="page-error-title" className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
                <div aria-hidden="true" className="text-5xl">⚠️</div>
                <div>
                    <h1 id="page-error-title" className="mb-1 text-xl font-semibold text-[color:var(--wf-text-strong)]">
                        Something went wrong{this.props.page ? ` on ${this.props.page}` : ""}.
                    </h1>
                    <p role="alert" className="text-sm text-[color:var(--wf-text-muted)]">
                        This page could not be displayed. You can retry it or review the technical details below.
                    </p>
                </div>
                <details className="w-full max-w-xl rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-3 text-left">
                    <summary className="cursor-pointer text-sm text-[color:var(--wf-text-muted)] hover:text-[color:var(--wf-text-strong)]">
                        Error details
                    </summary>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[color:var(--wf-surface-2)] p-3 text-xs text-[color:var(--wf-danger)]">
                        {error.message}
                        {error.stack ? `\n\n${error.stack}` : ""}
                    </pre>
                </details>
                <button
                    type="button"
                    onClick={this.handleReset}
                    className="rounded-lg border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-2 text-sm text-[color:var(--wf-text)] transition-colors hover:bg-[color:var(--wf-hover)]"
                >
                    Try again
                </button>
            </section>
        );
    }
}
