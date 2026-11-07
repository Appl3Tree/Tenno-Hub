// GoalsTreeView — zoomable/pannable tree canvas, tree node renderer, and styles.
// Extracted from Goals.tsx (Phase 5 decomposition).

import { useEffect, useRef, useState, memo, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { FULL_CATALOG, type CatalogId } from "../../domain/catalog/loadFullCatalog";
import { resolveItemRequirementGraph } from "../../catalog/items/itemRequirements";
import {
    type ZoomState,
    safeInt, fmtI, clamp,
    isExplicitBlueprintItem,
} from "./goalsUtils";

export function ZoomableTreeViewport(props: { children: ReactNode }) {
    const outerRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const [z, setZ] = useState<ZoomState>({ scale: 1, panX: 0, panY: 0 });

    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const pinchRef = useRef<{
        active: boolean;
        startDist: number;
        startScale: number;
        startPanX: number;
        startPanY: number;
        startCenterX: number;
        startCenterY: number;
        pointerA: { id: number; x: number; y: number } | null;
        pointerB: { id: number; x: number; y: number } | null;
    }>({
        active: false,
        startDist: 0,
        startScale: 1,
        startPanX: 0,
        startPanY: 0,
        startCenterX: 0,
        startCenterY: 0,
        pointerA: null,
        pointerB: null
    });

    const transform = useMemo(() => {
        return `translate(${z.panX}px, ${z.panY}px) scale(${z.scale})`;
    }, [z.panX, z.panY, z.scale]);

    // Center the tree on open/resize based on content bounding box
    const recenterToContent = useCallback((targetScale?: number) => {
        const outer = outerRef.current;
        const content = contentRef.current;
        if (!outer || !content) return;

        const o = outer.getBoundingClientRect();

        // We need content "natural" size. Since content is transformed, use scrollWidth/Height of inner wrapper.
        const naturalW = content.scrollWidth;
        const naturalH = content.scrollHeight;

        const scale = clamp(typeof targetScale === "number" ? targetScale : 1, 0.25, 2.75);

        const panX = (o.width - naturalW * scale) / 2;
        const panY = (o.height - naturalH * scale) / 2;

        setZ({ scale, panX, panY });
    }, []);

    useEffect(() => {
        recenterToContent(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        function onResize() {
            // Keep current scale, just re-center to viewport
            setZ((prev) => {
                const outer = outerRef.current;
                const content = contentRef.current;
                if (!outer || !content) return prev;

                const o = outer.getBoundingClientRect();
                const naturalW = content.scrollWidth;
                const naturalH = content.scrollHeight;

                const panX = (o.width - naturalW * prev.scale) / 2;
                const panY = (o.height - naturalH * prev.scale) / 2;

                return { ...prev, panX, panY };
            });
        }

        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        const root = outerRef.current;
        if (!root) return;

        function onWheel(e: WheelEvent) {
            // local zoom. On trackpads, ctrl+wheel is common. Also allow metaKey as fallback.
            if (!(e.ctrlKey || e.metaKey)) return;

            const viewport = outerRef.current;
            if (!viewport) return;

            e.preventDefault();

            setZ((prev) => {
                const nextScale = clamp(prev.scale * (e.deltaY < 0 ? 1.1 : 0.9), 0.25, 2.75);

                const rect = viewport.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const py = e.clientY - rect.top;

                const scaleRatio = nextScale / prev.scale;
                const nextPanX = px - (px - prev.panX) * scaleRatio;
                const nextPanY = py - (py - prev.panY) * scaleRatio;

                return { scale: nextScale, panX: nextPanX, panY: nextPanY };
            });
        }

        root.addEventListener("wheel", onWheel, { passive: false });
        return () => root.removeEventListener("wheel", onWheel as EventListener);
    }, []);

    useEffect(() => {
        const root = outerRef.current;
        if (!root) return;

        function setPointer(elm: Element, e: PointerEvent) {
            try {
                elm.setPointerCapture(e.pointerId);
            } catch {
                // ignore
            }
        }

        function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function onPointerDown(e: PointerEvent) {
            const viewport = outerRef.current;
            if (!viewport) return;

            // Only pan/zoom when interacting with background/viewport, not buttons/inputs.
            // But we still allow starting on non-interactive parts of nodes.
            const target = e.target as HTMLElement | null;
            const isInteractive =
                !!target?.closest?.("button, a, input, textarea, select, [role='button']") ||
                target?.getAttribute?.("data-wf-no-pan") === "true";
            if (isInteractive) return;

            e.preventDefault();

            setPointer(viewport, e);

            // track pointers for pinch
            const p = pinchRef.current;

            if (!p.pointerA) {
                p.pointerA = { id: e.pointerId, x: e.clientX, y: e.clientY };
            } else if (!p.pointerB && p.pointerA.id !== e.pointerId) {
                p.pointerB = { id: e.pointerId, x: e.clientX, y: e.clientY };

                const d = distance(p.pointerA, p.pointerB);
                const cx = (p.pointerA.x + p.pointerB.x) / 2;
                const cy = (p.pointerA.y + p.pointerB.y) / 2;

                p.active = true;
                p.startDist = d;
                p.startScale = z.scale;
                p.startPanX = z.panX;
                p.startPanY = z.panY;
                p.startCenterX = cx;
                p.startCenterY = cy;

                isPanningRef.current = false;
                return;
            }

            // single-pointer pan
            isPanningRef.current = true;
            panStartRef.current = { x: e.clientX, y: e.clientY, panX: z.panX, panY: z.panY };
        }

        function onPointerMove(e: PointerEvent) {
            const p = pinchRef.current;

            if (p.pointerA && p.pointerA.id === e.pointerId) {
                p.pointerA = { ...p.pointerA, x: e.clientX, y: e.clientY };
            } else if (p.pointerB && p.pointerB.id === e.pointerId) {
                p.pointerB = { ...p.pointerB, x: e.clientX, y: e.clientY };
            }

            if (p.active && p.pointerA && p.pointerB) {
                e.preventDefault();

                const d = distance(p.pointerA, p.pointerB);
                const cx = (p.pointerA.x + p.pointerB.x) / 2;
                const cy = (p.pointerA.y + p.pointerB.y) / 2;

                const nextScale = clamp(p.startScale * (d / Math.max(1, p.startDist)), 0.25, 2.75);

                // zoom about the pinch center, but using the start state as base
                const outer = outerRef.current;
                if (!outer) return;

                const rect = outer.getBoundingClientRect();
                const px = cx - rect.left;
                const py = cy - rect.top;

                const scaleRatio = nextScale / p.startScale;
                const nextPanX = px - (px - p.startPanX) * scaleRatio;
                const nextPanY = py - (py - p.startPanY) * scaleRatio;

                setZ({ scale: nextScale, panX: nextPanX, panY: nextPanY });
                return;
            }

            if (!isPanningRef.current) return;

            e.preventDefault();

            const start = panStartRef.current;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;

            setZ((prev) => ({ ...prev, panX: start.panX + dx, panY: start.panY + dy }));
        }

        function onPointerUp(e: PointerEvent) {
            const p = pinchRef.current;

            if (p.pointerA && p.pointerA.id === e.pointerId) p.pointerA = null;
            if (p.pointerB && p.pointerB.id === e.pointerId) p.pointerB = null;

            if (!p.pointerA || !p.pointerB) {
                p.active = false;
            }

            isPanningRef.current = false;
        }

        root.addEventListener("pointerdown", onPointerDown);
        root.addEventListener("pointermove", onPointerMove);
        root.addEventListener("pointerup", onPointerUp);
        root.addEventListener("pointercancel", onPointerUp);

        return () => {
            root.removeEventListener("pointerdown", onPointerDown);
            root.removeEventListener("pointermove", onPointerMove);
            root.removeEventListener("pointerup", onPointerUp);
            root.removeEventListener("pointercancel", onPointerUp);
        };
    }, [z.panX, z.panY, z.scale]);

    return (
        <div className="relative h-full w-full overflow-hidden select-none" ref={outerRef} style={{ touchAction: "none" }}>
            <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                <button
                    className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                    onClick={() =>
                        setZ((prev) => ({ ...prev, scale: clamp(prev.scale / 1.1, 0.25, 2.75) }))
                    }
                    aria-label="Zoom out"
                    data-wf-no-pan="true"
                >
                    −
                </button>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-300">
                    {Math.round(z.scale * 100)}%
                </div>

                <button
                    className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                    onClick={() =>
                        setZ((prev) => ({ ...prev, scale: clamp(prev.scale * 1.1, 0.25, 2.75) }))
                    }
                    aria-label="Zoom in"
                    data-wf-no-pan="true"
                >
                    +
                </button>

                <button
                    className="ml-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                    onClick={() => recenterToContent(1)}
                    data-wf-no-pan="true"
                >
                    Reset
                </button>

                <div className="ml-2 hidden sm:block text-[11px] text-slate-500">
                    Drag to pan · Pinch to zoom · Ctrl+wheel to zoom
                </div>
            </div>

            <div
                className="absolute left-0 top-0"
                style={{
                    transform,
                    transformOrigin: "0 0"
                }}
            >
                <div ref={contentRef}>{props.children}</div>
            </div>
        </div>
    );
}

export function TreeStyles() {
    return (
        <style>{`
/* Container */
.wf-tree-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(2, 6, 23, 0.72);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;

    /* Use safe-area + small margin so it feels "full screen" but still not edge-to-edge harsh */
    padding:
        max(8px, env(safe-area-inset-top))
        max(8px, env(safe-area-inset-right))
        max(8px, env(safe-area-inset-bottom))
        max(8px, env(safe-area-inset-left));
}

/* Nearly full-screen, fully responsive to viewport size */
.wf-tree-modal {
    width: 100%;
    height: 100%;

    border: 1px solid var(--wf-border-strong);
    background: var(--wf-surface-dialog);
    border-radius: 16px;
    box-shadow: var(--wf-shadow-overlay);
    overflow: hidden;

    display: flex;
    flex-direction: column;
}

.wf-tree-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--wf-border-subtle);
}
.wf-tree-modal-title {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.wf-tree-modal-title .t1 {
    font-size: 14px;
    font-weight: 700;
    color: var(--wf-text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.wf-tree-modal-title .t2 {
    font-size: 12px;
    color: var(--wf-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.wf-tree-modal-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.wf-tree-modal-body {
    flex: 1;
    overflow: hidden; /* IMPORTANT: viewport handles overflow */
    padding: 0;
}

/* Tree layout */
.wf-tree-root {
    padding: 18px;
    --wf-gap-x: 26px;   /* sibling spacing */
    --wf-gap-y: 22px;   /* vertical spacing between levels */
    --wf-line: var(--wf-border-strong);
}

/* Each UL lays out children as a row */
.wf-tree-ul {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: var(--wf-gap-x);
    position: relative;
    margin: 0;
    padding: 0;
}

/* For child rows: add space above for the row connector + child stems */
.wf-tree-ul.wf-tree-ul-children {
    margin-top: var(--wf-gap-y);
    padding-top: var(--wf-gap-y);
}

/* Horizontal connector across the child row */
.wf-tree-ul.wf-tree-ul-children::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    border-top: 1px solid var(--wf-line);
}

/* LI is a column: node then its children */
.wf-tree-li {
    list-style: none;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* Vertical stem from the child-row horizontal line down to the child node */
.wf-tree-ul.wf-tree-ul-children > .wf-tree-li {
    padding-top: var(--wf-gap-y);
}
.wf-tree-ul.wf-tree-ul-children > .wf-tree-li::before {
    content: "";
    position: absolute;
    top: 0;
    left: 50%;
    height: var(--wf-gap-y);
    border-left: 1px solid var(--wf-line);
    transform: translateX(-50%);
}

/* Vertical stem from a parent node down to its child-row horizontal line (only when open) */
.wf-tree-li.wf-tree-li-has-children > .wf-tree-node::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: calc(var(--wf-gap-y) * -1);
    height: var(--wf-gap-y);
    border-left: 1px solid var(--wf-line);
    transform: translateX(-50%);
}

/* Node bubble */
.wf-tree-node {
    position: relative;
    border: 1px solid var(--wf-border-subtle);
    background: var(--wf-surface-1);
    border-radius: 16px;
    padding: 12px 14px;
    min-width: 260px;
    max-width: min(360px, 78vw);
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    user-select: none;
    box-shadow: var(--wf-shadow-panel);
}
.wf-tree-node-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--wf-text-strong);
    line-height: 1.3;
}
.wf-tree-node-main {
    min-width: 0;
}
.wf-tree-node-subtitle {
    margin-top: 4px;
    font-size: 11px;
    color: var(--wf-text-muted);
}
.wf-tree-node-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
}
.wf-tree-node-stat {
    min-width: 72px;
    border-radius: 12px;
    border: 1px solid var(--wf-border-subtle);
    background: var(--wf-surface-soft);
    padding: 8px 10px;
}
.wf-tree-node-stat-label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--wf-text-dim);
}
.wf-tree-node-stat-value {
    display: block;
    margin-top: 4px;
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
    color: var(--wf-text-strong);
}
.wf-tree-node-stat-need {
    border-color: var(--wf-border-strong);
}
.wf-tree-node-stat-have {
    border-color: var(--wf-success);
    background: var(--wf-success-soft);
}
.wf-tree-node-stat-rem {
    border-color: var(--wf-warning);
    background: var(--wf-warning-soft);
}
.wf-tree-node-stat-rem.is-clear {
    border-color: var(--wf-success);
    background: var(--wf-success-soft);
}
.wf-tree-node-stat-rem .wf-tree-node-stat-value {
    color: var(--wf-warning);
}
.wf-tree-node-stat-rem.is-clear .wf-tree-node-stat-value {
    color: var(--wf-success);
}
.wf-tree-node-btn {
    height: 32px;
    width: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: 1px solid var(--wf-border-strong);
    background: var(--wf-surface-input);
    color: var(--wf-text);
    user-select: none;
}
.wf-tree-node-btn:hover {
    background: var(--wf-hover);
}

/* On very small screens, shrink nodes a bit */
@media (max-width: 520px) {
    .wf-tree-node {
        min-width: 200px;
        max-width: 86vw;
        grid-template-columns: 32px minmax(0, 1fr);
    }
}
        `}</style>
    );
}

type TreeNodeProps = {
    nodeCatalogId: CatalogId;
    nodeNeed: number; // total need for this node (already multiplied)
    inventoryCounts: Record<string, number>;
    edgeId: string; // stable edge identity for React keying
    expandedEdges: Record<string, boolean>;
    onToggleEdge: (edgeId: string) => void;
    maxDepth: number;
    depth: number;
};

export const TreeNode = memo(function TreeNode(props: TreeNodeProps) {
    const { nodeCatalogId, nodeNeed, inventoryCounts, edgeId, expandedEdges, onToggleEdge, maxDepth, depth } = props;

    const rec = FULL_CATALOG.recordsById[nodeCatalogId];
    const name = rec?.displayName ?? String(nodeCatalogId);

    const have = safeInt(inventoryCounts?.[String(nodeCatalogId)] ?? 0, 0);
    const remaining = Math.max(0, Math.floor(nodeNeed) - have);

    const resolution = useMemo(() => resolveItemRequirementGraph(nodeCatalogId), [nodeCatalogId]);
    const directChildren = resolution.edges;

    const canExpand = depth < maxDepth && directChildren.length > 0;
    const isExpanded = Boolean(expandedEdges[edgeId]);
    const hasOpenChildren = canExpand && isExpanded;
    const isComplete = remaining <= 0;

    return (
        <li className={["wf-tree-li", hasOpenChildren ? "wf-tree-li-has-children" : ""].join(" ")}>
            <div className="wf-tree-node">
                {canExpand ? (
                    <button
                        className="wf-tree-node-btn"
                        onClick={() => onToggleEdge(edgeId)}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${name} requirements`}
                        data-wf-no-pan="true"
                    >
                        {isExpanded ? "▾" : "▸"}
                    </button>
                ) : (
                    <div className="h-7 w-7" />
                )}

                <div className="wf-tree-node-main">
                    <div className="wf-tree-node-title">{name}</div>
                    <div className="wf-tree-node-subtitle">
                        {canExpand ? "Expandable crafting branch" : "Leaf requirement"}
                    </div>
                    <div className="wf-tree-node-metrics">
                        <div className="wf-tree-node-stat wf-tree-node-stat-need">
                            <span className="wf-tree-node-stat-label">Need</span>
                            <span className="wf-tree-node-stat-value">{fmtI(nodeNeed)}</span>
                        </div>
                        <div className="wf-tree-node-stat wf-tree-node-stat-have">
                            <span className="wf-tree-node-stat-label">Have</span>
                            <span className="wf-tree-node-stat-value">{fmtI(have)}</span>
                        </div>
                        <div className={`wf-tree-node-stat wf-tree-node-stat-rem ${isComplete ? "is-clear" : ""}`}>
                            <span className="wf-tree-node-stat-label">Remaining</span>
                            <span className="wf-tree-node-stat-value">{fmtI(remaining)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {hasOpenChildren && (
                <ChildrenList
                    parentCatalogId={nodeCatalogId}
                    parentNeed={nodeNeed}
                    inventoryCounts={inventoryCounts}
                    depth={depth}
                    expandedEdges={expandedEdges}
                    onToggleEdge={onToggleEdge}
                    maxDepth={maxDepth}
                />
            )}
        </li>
    );
});

type ChildrenListProps = {
    parentCatalogId: CatalogId;
    parentNeed: number;
    inventoryCounts: Record<string, number>;
    depth: number;
    expandedEdges: Record<string, boolean>;
    onToggleEdge: (edgeId: string) => void;
    maxDepth: number;
};

export const ChildrenList = memo(function ChildrenList(props: ChildrenListProps) {
    const { parentCatalogId, parentNeed, inventoryCounts, depth, expandedEdges, onToggleEdge, maxDepth } = props;

    const children = useMemo(() => {
        const direct = resolveItemRequirementGraph(parentCatalogId).edges;

        // Multiply per-parent need, and aggregate identical child ids *for this parent*
        const agg = new Map<string, { need: number }>();
        for (const c of direct) {
            const childId = String(c.catalogId);
            const childNeed =
                Math.max(1, Math.floor(Number(c.count) || 1)) * Math.max(1, Math.floor(Number(parentNeed) || 1));
            const existing = agg.get(childId) ?? { need: 0 };
            existing.need += childNeed;
            agg.set(childId, existing);
        }

        const out = Array.from(agg.entries()).map(([cid, need]) => ({
            catalogId: cid as CatalogId,
            need: need.need,
        }));

        // Stable ordering: highest need first, then name
        out.sort((a, b) => {
            if (a.need !== b.need) return b.need - a.need;
            const an = FULL_CATALOG.recordsById[a.catalogId]?.displayName ?? String(a.catalogId);
            const bn = FULL_CATALOG.recordsById[b.catalogId]?.displayName ?? String(b.catalogId);
            return an.localeCompare(bn);
        });

        return out;
    }, [parentCatalogId, parentNeed]);

    // Blueprint-skip: if the only child is a blueprint, show that blueprint's ingredients directly
    // NOTE: must be declared before any early return to satisfy Rules of Hooks
    const maybeFlattened = useMemo(() => {
        if (children.length !== 1) return children;

        const only = children[0];
        const rec = FULL_CATALOG.recordsById[only.catalogId];
        const nm = rec?.displayName ?? String(only.catalogId);

        if (!isExplicitBlueprintItem(only.catalogId, nm)) return children;

        // Expand the blueprint and multiply by the blueprint quantity (need)
        const bpChildren = resolveItemRequirementGraph(only.catalogId).edges;
        if (!bpChildren || bpChildren.length === 0) return children;

        const agg = new Map<string, { need: number }>();
        for (const bc of bpChildren) {
            const cid = String(bc.catalogId);
            const need = Math.max(1, Math.floor(Number(bc.count) || 1)) * Math.max(1, Math.floor(Number(only.need) || 1));
            const existing = agg.get(cid) ?? { need: 0 };
            existing.need += need;
            agg.set(cid, existing);
        }

        const flattened = Array.from(agg.entries()).map(([cid, value]) => ({
            catalogId: cid as CatalogId,
            need: value.need,
        }));

        flattened.sort((a, b) => {
            if (a.need !== b.need) return b.need - a.need;
            const an = FULL_CATALOG.recordsById[a.catalogId]?.displayName ?? String(a.catalogId);
            const bn = FULL_CATALOG.recordsById[b.catalogId]?.displayName ?? String(b.catalogId);
            return an.localeCompare(bn);
        });

        return flattened;
    }, [children]);

    if (children.length === 0) {
        return null;
    }

    return (
        <ul className="wf-tree-ul wf-tree-ul-children">
            {maybeFlattened.map((c) => {
                const childEdgeId = `${String(parentCatalogId)}=>${String(c.catalogId)}`;
                return (
                    <TreeNode
                        key={childEdgeId}
                        nodeCatalogId={c.catalogId}
                        nodeNeed={c.need}
                        inventoryCounts={inventoryCounts}
                        depth={depth + 1}
                        edgeId={childEdgeId}
                        expandedEdges={expandedEdges}
                        onToggleEdge={onToggleEdge}
                        maxDepth={maxDepth}
                    />
                );
            })}
        </ul>
    );
});

