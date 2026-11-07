// TreeModal — full-screen goal tree overlay.
// Extracted from Goals.tsx (Phase 5 decomposition).

import { useEffect, useRef } from "react";
import { type CatalogId } from "../../domain/catalog/loadFullCatalog";
import { ZoomableTreeViewport, TreeNode } from "./GoalsTreeView";

export function TreeModal(props: {
    isOpen: boolean;
    title: string;
    subtitle: string;
    onClose: () => void;
    rootCatalogId: CatalogId;
    rootNeed: number;
    inventoryCounts: Record<string, number>;
    expandedEdges: Record<string, boolean>;
    onToggleEdge: (edgeId: string) => void;
}) {
    const { isOpen, title, subtitle, onClose, rootCatalogId, rootNeed, inventoryCounts, expandedEdges, onToggleEdge } =
        props;
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        function onKeyDown(e: KeyboardEvent) {
            const dialog = dialogRef.current;
            if (!dialog) return;

            const activeModal = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
            if (activeModal !== dialog) return;

            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== "Tab") return;

            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                e.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            } else if (!dialog.contains(document.activeElement)) {
                e.preventDefault();
                first?.focus();
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.documentElement.style.overflow = previousOverflow;
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const rootEdgeId = `root=>${String(rootCatalogId)}`;

    return (
        <div className="wf-tree-overlay" onMouseDown={onClose}>
            <div ref={dialogRef} className="wf-tree-modal" role="dialog" aria-modal="true" aria-labelledby="goal-tree-title" aria-describedby="goal-tree-subtitle" tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}>
                <div className="wf-tree-modal-header">
                    <div className="wf-tree-modal-title">
                        <h2 id="goal-tree-title" className="t1">{title}</h2>
                        <p id="goal-tree-subtitle" className="t2">{subtitle}</p>
                    </div>

                    <div className="wf-tree-modal-actions">
                        <button
                            ref={closeButtonRef}
                            className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                            onClick={onClose}
                            data-wf-no-pan="true"
                        >
                            Close
                        </button>
                    </div>
                </div>

                <div className="wf-tree-modal-body">
                    <ZoomableTreeViewport>
                        <div className="wf-tree-root">
                            <ul className="wf-tree-ul">
                                <TreeNode
                                    nodeCatalogId={rootCatalogId}
                                    nodeNeed={rootNeed}
                                    inventoryCounts={inventoryCounts}
                                    depth={0}
                                    edgeId={rootEdgeId}
                                    expandedEdges={expandedEdges}
                                    onToggleEdge={onToggleEdge}
                                    maxDepth={12}
                                />
                            </ul>
                        </div>
                    </ZoomableTreeViewport>
                </div>
            </div>
        </div>
    );
}

/* ========================================================================================= */

/**
 * Self-contained goal card. Receives only a stable `goalId` string from the parent.
 *
 * All goal data + relevant inventory counts are fetched in a single useShallow selector
 * so only the card whose data actually changed re-renders.
 *
 * Crafting status (blueprint / resources / built) is derived automatically from inventory
 * counts rather than manual checkboxes — this keeps it accurate regardless of whether
 * the blueprint is tracked as a separate goal.
 *
 * content-visibility:auto on the outer div lets the browser skip off-screen rendering,
 * giving virtualization-like perf without any JS scrolling logic.
 */
