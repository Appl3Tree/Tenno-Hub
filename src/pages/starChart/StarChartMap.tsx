// StarChartMap — the main interactive SVG star chart canvas.
// Extracted from StarChart.tsx as part of Phase 5 file decomposition.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { STAR_CHART_DATA } from "../../domain/catalog/starChart";
import type { NodeId, PlanetId, StarChartNode, StarChartPlanet } from "../../domain/models/starChart";
import { getRegionResourcesForPlanet } from "../../domain/catalog/starChart/regionResources";
import { describePrereqCondition, PREREQ_REGISTRY } from "../../catalog/prereqs/prereqRegistry";
import { PR } from "../../domain/ids/prereqIds";
import { getUnlockedStarChartDestinationIds } from "../../domain/logic/starChartUnlocks";
import { FULL_CATALOG, type CatalogId } from "../../domain/catalog/loadFullCatalog";
import { useTrackerStore } from "../../store/store";
import { getDropSourcesForStarChartNode } from "../../domain/catalog/starChart/nodeDropSourceMap";
import { getAcquisitionByCatalogId } from "../../catalog/items/itemAcquisition";
import { getGoalCatalogKind, getOwnedCountForGoal } from "../../domain/goals/catalogGoals";
import {
    EMPTY_NODE_COMPLETED,
    DEFAULT_NODE_GROUP_TAB,
    VORS_PRIZE_IMPLIES_COMPLETED,
    clamp,
    lerp,
    smoothstep01,
    hashToUnitFloat,
    planetImgUrl,
    MANUAL_POS,
    isInMainMap,
    WORLD_MIN,
    WORLD_MAX,
    KUVA_PERIOD_MS,
    KUVA_RAD_PER_MS,
    MAP_POS_SCALE,
    MAP_CENTER,
    mapScalePos,
    PLANET_COLORS,
    DEFAULT_PLANET_COLOR,
    planetGradId,
    STARFIELD,
    clampViewBox,
    vbZoomAt,
    viewBoxToScale,
    nodeRevealAlpha,
    getPlanetRadius,
    groupPlanetNodesForDisplay,
} from "./starChartMapData";
import type { ItemRow } from "./starChartUtils";
import { dedupeItemsByName, itemNameKey } from "./starChartUtils";
import type { DropMeta, DropMetaLookup } from "./dropMetaLookup";
import type {
    ViewBox,
    NodeGroupKind,
    NodeGroup,
    NodeLayout,
    PlanetLayout,
    TabSpec,
} from "./starChartMapData";

// ── Drop-meta helpers ────────────────────────────────────────────────────────

/** Strip leading quantity from a drop table item name: "400X Circuits" → "Circuits", "2X Orokin Cell" → "Orokin Cell" */
function stripQtyPrefix(name: string): string {
    return name.replace(/^\s*[\d,]+\s*[xX]\s+/i, "").replace(/^\s*\d[\d,]*\s+/, "").trim();
}

type RotationItem = {
    key: string;
    displayName: string;
    baseName: string;
    catalogId: CatalogId | null;
    meta: DropMeta;
};

function normItemKey(s: string): string {
    return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function findCatalogIdForRewardName(name: string, catalogNameMap: Map<string, string>): CatalogId | null {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return null;

    const normalized = normItemKey(trimmed);
    const withoutBlueprint = normalized.replace(/\s+blueprint$/, "").trim();
    const candidates = [normalized, withoutBlueprint].filter(Boolean);

    for (const candidate of candidates) {
        const direct = catalogNameMap.get(candidate);
        if (direct) return direct as CatalogId;

        const hits = (FULL_CATALOG.nameIndex[candidate] ?? []).filter((id) => String(id).startsWith("items:"));
        if (hits.length === 1) return hits[0] as CatalogId;
    }

    return null;
}

function resolveDropMeta(it: ItemRow, dropSources: string[], lookup: DropMetaLookup): DropMeta | null {
    const key = normItemKey(it.name);
    for (const sid of dropSources) {
        const entry = lookup[sid]?.[key];
        if (entry) return entry;
    }
    return null;
}

function formatChance(chance: number): string {
    if (chance >= 10) return `${chance.toFixed(2)}%`;
    if (chance >= 1) return `${chance.toFixed(2)}%`;
    return `${chance.toFixed(2)}%`;
}

const RARITY_CLASSES: Record<string, string> = {
    common: "text-slate-300",
    uncommon: "text-green-400",
    rare: "text-blue-400",
    legendary: "text-amber-400",
};

function rarityClass(rarity: string): string {
    return RARITY_CLASSES[rarity.toLowerCase()] ?? "text-slate-400";
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StarChartMap(props: {
    isInModal: boolean;
    vb: ViewBox;
    setVb: Dispatch<SetStateAction<ViewBox>>;
    selectedPlanetId: PlanetId | null;
    setSelectedPlanetId: Dispatch<SetStateAction<PlanetId | null>>;
    selectedPlanetName: string | null;
    selectedGroupKey: string | null;
    setSelectedGroupKey: Dispatch<SetStateAction<string | null>>;
    selectedTab: NodeGroupKind;
    setSelectedTab: Dispatch<SetStateAction<NodeGroupKind>>;
    selectedGroupDisplayName: string | null;
    tabsForPanel: TabSpec[];
    activeTab: TabSpec | null;
    focusedTitle: string | null;
    showDropsPanel: boolean;
    /** 6.5: Junction inspector — populated when the selected node is a junction */
    junctionNode: StarChartNode | null;
    /** Mission node metadata — populated when the selected node is a mission node */
    selectedMissionNode?: StarChartNode | null;
    /** 4.4: Base node ID for the selected group (for node completion tracking) */
    selectedGroupBaseNodeId: NodeId | null;
    /** Whether we're tracking Steel Path completions instead of normal ones */
    steelPathMode: boolean;
    /** Navigate to a different map view (proxima / duviri) */
    setMainMapMode: (mode: "normal" | "proxima" | "duviri") => void;
    /** Drop metadata lookup for rotation/chance/rarity display */
    dropMetaLookup?: DropMetaLookup;
    /** Hide the Proxima / Duviri nav buttons — true when already inside a sub-map */
    hideAlternateMaps?: boolean;
    /** Optional filter controlling which planets appear — defaults to isInMainMap */
    planetFilter?: (p: StarChartPlanet) => boolean;
}) {
    const {
        isInModal,
        vb,
        setVb,
        selectedPlanetId,
        setSelectedPlanetId,
        selectedPlanetName,
        selectedGroupKey,
        setSelectedGroupKey,
        selectedTab,
        setSelectedTab,
        selectedGroupDisplayName,
        tabsForPanel,
        activeTab,
        focusedTitle,
        showDropsPanel,
        junctionNode,
        selectedMissionNode,
        selectedGroupBaseNodeId,
        steelPathMode,
        setMainMapMode,
        dropMetaLookup = {},
        hideAlternateMaps = false,
        planetFilter = isInMainMap,
    } = props;

    // 6.5: Build prereq label index for junction inspector
    const prereqLabelIndex = useMemo(() => {
        const m: Record<string, string> = {};
        for (const d of PREREQ_REGISTRY) {
            m[d.id] = d.label;
        }
        return m;
    }, []);

    const junctionPrereqDef = useMemo(() => {
        if (!junctionNode) return undefined;
        const prereqId = junctionNode.id.replace(/^node:/, "");
        return PREREQ_REGISTRY.find((def) => def.id === prereqId);
    }, [junctionNode]);

    // 6.5: Derive unlocked planet name for junction node
    const planetsById = useMemo(() => {
        const m = new Map<string, StarChartPlanet>();
        for (const p of STAR_CHART_DATA.planets) m.set(p.id, p);
        return m;
    }, []);

    // Inventory ownership — used to decorate loot panel items
    const inventoryCounts = useTrackerStore((s) => s.state.inventory?.counts ?? EMPTY_NODE_COMPLETED);
    const inventory = useTrackerStore((s) => s.state.inventory);
    const goals = useTrackerStore((s) => s.state.goals ?? []);
    const setCount = useTrackerStore((s) => s.setCount);

    // 4.4: Per-node completion tracking
    const setNodeCompleted        = useTrackerStore((s) => s.setNodeCompleted);
    const setBulkNodesCompleted   = useTrackerStore((s) => s.setBulkNodesCompleted);
    const setSteelPathNodeCompleted      = useTrackerStore((s) => s.setSteelPathNodeCompleted);
    const setBulkSteelPathNodesCompleted = useTrackerStore((s) => s.setBulkSteelPathNodesCompleted);
    const nodeCompletedMap       = useTrackerStore((s) => s.state.missions?.nodeCompleted       ?? EMPTY_NODE_COMPLETED);
    const spNodeCompletedMap     = useTrackerStore((s) => s.state.missions?.steelPathNodeCompleted ?? EMPTY_NODE_COMPLETED);
    const completedPrereqs       = useTrackerStore((s) => s.state.prereqs?.completed            ?? EMPTY_NODE_COMPLETED);

    // When in Steel Path mode, setters and raw map point to the SP tracking store.
    const activeSetNodeCompleted      = steelPathMode ? setSteelPathNodeCompleted      : setNodeCompleted;
    const activeSetBulkNodesCompleted = steelPathMode ? setBulkSteelPathNodesCompleted : setBulkNodesCompleted;
    const activeRawNodeMap            = steelPathMode ? spNodeCompletedMap             : nodeCompletedMap;

    // Merge prereq-derived completions with manually tracked ones.
    // Manual entries always win (so a user can un-check a derived node if desired).
    // In Steel Path mode there are no prereq derivations — everything is manual.
    const effectiveNodeCompletedMap = useMemo(() => {
        if (steelPathMode) return activeRawNodeMap;
        const derived: Record<string, boolean> = completedPrereqs[PR.VORS_PRIZE]
            ? { ...VORS_PRIZE_IMPLIES_COMPLETED }
            : {};
        for (const node of STAR_CHART_DATA.nodes) {
            if (node.nodeType === "junction" && completedPrereqs[node.id.replace(/^node:/, "")] === true) {
                derived[node.id] = true;
            }
        }
        return { ...derived, ...nodeCompletedMap };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [steelPathMode, completedPrereqs, nodeCompletedMap, spNodeCompletedMap]);

    // Derive which planets are unlocked from completed junctions.
    // Earth is the starting planet; Venus and Mercury have separate junctions.
    const unlockedPlanetIds = useMemo(
        () => getUnlockedStarChartDestinationIds(completedPrereqs, nodeCompletedMap),
        [completedPrereqs, nodeCompletedMap],
    );

    const svgRef = useRef<SVGSVGElement | null>(null);
    const vbRef = useRef<ViewBox>(vb);
    useEffect(() => {
        vbRef.current = vb;
    }, [vb]);

    // Smooth zoom animation: lerp current vb toward a target vb.
    const zoomAnimTargetRef = useRef<ViewBox | null>(null);
    const zoomAnimRafRef = useRef<number | null>(null);

    function cancelZoomAnim() {
        if (zoomAnimRafRef.current !== null) {
            cancelAnimationFrame(zoomAnimRafRef.current);
            zoomAnimRafRef.current = null;
        }
        zoomAnimTargetRef.current = null;
    }

    function animateToVb(target: ViewBox) {
        zoomAnimTargetRef.current = target;
        if (zoomAnimRafRef.current !== null) return; // loop already running

        const SPRING = 0.011; // exponential decay rate — higher = snappier
        let lastT = 0;

        const step = (t: number) => {
            zoomAnimRafRef.current = null;
            const dt = lastT ? Math.min(t - lastT, 64) : 16;
            lastT = t;

            const tgt = zoomAnimTargetRef.current;
            if (!tgt) return;

            const cur = vbRef.current;
            const alpha = 1 - Math.exp(-SPRING * dt);

            const nx = lerp(cur.x, tgt.x, alpha);
            const ny = lerp(cur.y, tgt.y, alpha);
            const nw = lerp(cur.w, tgt.w, alpha);
            const nh = lerp(cur.h, tgt.h, alpha);

            // Stop animating once within 0.3 world-units of target
            if (Math.abs(nw - tgt.w) < 0.3 && Math.abs(nx - tgt.x) < 0.3 && Math.abs(ny - tgt.y) < 0.3) {
                setVb(tgt);
                zoomAnimTargetRef.current = null;
                return;
            }

            setVb(clampViewBox({ x: nx, y: ny, w: nw, h: nh }));
            zoomAnimRafRef.current = requestAnimationFrame(step);
        };

        zoomAnimRafRef.current = requestAnimationFrame(step);
    }

    // If the pointer moved enough to be considered a drag, suppress all click handlers for this gesture.
    const suppressClickRef = useRef<boolean>(false);

    const [boundsTick, setBoundsTick] = useState(0);

    // cache pixel size of the SVG
    const [svgSize, setSvgSize] = useState<{ w: number; h: number } | null>(null);

    // hide heavy HTML labels while dragging
    const [isDragging, setIsDragging] = useState(false);

    // Panel UX state (end-user friendly)
    const [showLegend, setShowLegend] = useState(false);
    const [showDebugSources, setShowDebugSources] = useState(false);
    const [itemFilter, setItemFilter] = useState("");
    const [rotationFilter, setRotationFilter] = useState<"A" | "B" | "C" | null>(null);

    useEffect(() => {
        // When node selection changes, reset UX state
        setShowDebugSources(false);
        setItemFilter("");
        setRotationFilter(null);
    }, [selectedGroupKey, selectedTab]);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const update = () => {
            setBoundsTick((x) => x + 1);
            const r = svg.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) setSvgSize({ w: r.width, h: r.height });
        };

        update();

        const ro = new ResizeObserver(() => update());
        ro.observe(svg);
        return () => ro.disconnect();
    }, []);

    const scale = useMemo(() => viewBoxToScale(vb), [vb]);
    const revealRaw = useMemo(() => nodeRevealAlpha(scale), [scale]);
    const reveal = useMemo(() => smoothstep01(revealRaw), [revealRaw]);

    const groupedByPlanet = useMemo(() => {
        const out = new Map<string, NodeGroup[]>();
        const byPlanet = new Map<string, StarChartNode[]>();

        for (const n of STAR_CHART_DATA.nodes) {
            const pid = String(n.planetId);
            const arr = byPlanet.get(pid) ?? [];
            arr.push(n);
            byPlanet.set(pid, arr);
        }

        for (const [pid, nodes] of byPlanet.entries()) {
            out.set(pid, groupPlanetNodesForDisplay(nodes));
        }

        return out;
    }, []);

    const sortedPlanets = useMemo(() => {
        const arr = [...STAR_CHART_DATA.planets];
        arr.sort((a, b) => a.sortOrder - b.sortOrder);
        return arr;
    }, []);

    // Kuva Fortress: initialise phase from real time so it's at an approximate
    // position on first render, then animate at the correct 50-hour rate.
    const [kuvaPhase, setKuvaPhase] = useState<number>(
        () => ((Date.now() % KUVA_PERIOD_MS) / KUVA_PERIOD_MS) * Math.PI * 2
    );
    useEffect(() => {
        let raf: number | null = null;
        let last = 0;
        const step = (t: number) => {
            if (!last) last = t;
            const dt = Math.min(64, t - last);
            last = t;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setKuvaPhase((prev) => prev + dt * KUVA_RAD_PER_MS);
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => {
            if (raf) cancelAnimationFrame(raf);
        };
    }, [KUVA_RAD_PER_MS]);

    const overviewPlanets = useMemo((): PlanetLayout[] => {
        const filtered = sortedPlanets.filter((p) => planetFilter(p));
        const out: PlanetLayout[] = [];

        for (const p of filtered) {
            const manual = MANUAL_POS[p.id];

            const fallbackAngle = hashToUnitFloat(p.id) * Math.PI * 2;
            const fallbackRadius = p.kind === "planet" ? 34 : 41;
            const fx = 50 + Math.cos(fallbackAngle) * fallbackRadius;
            const fy = 50 + Math.sin(fallbackAngle) * fallbackRadius;

            let x0 = manual?.x ?? fx;
            let y0 = manual?.y ?? fy;

            if (p.id === "region:kuva_fortress") {
                // Kuva Fortress orbits the chart centre.  At MAP_POS_SCALE=3.5
                // orbitR=9.8 manual → 34.3 world, safely between Mercury (24.8)
                // and Venus (45.5) — minimum clearance ~9.5 world > 8.4 sum of
                // base radii, so disks never overlap at any phase.
                const orbitR = 9.8;
                x0 = MAP_CENTER.x + Math.cos(kuvaPhase) * orbitR;
                y0 = MAP_CENTER.y + Math.sin(kuvaPhase) * orbitR;
            }

            const scaled = mapScalePos({ x: x0, y: y0 });
            out.push({ planet: p, x: scaled.x, y: scaled.y, r: getPlanetRadius(p) });
        }

        return out;
    }, [sortedPlanets, kuvaPhase]);

    // Fast lookup for click-to-zoom
    const planetCenterById = useMemo(() => {
        const m = new Map<string, { x: number; y: number; r: number }>();
        for (const pl of overviewPlanets) {
            m.set(pl.planet.id, { x: pl.x, y: pl.y, r: pl.r });
        }
        return m;
    }, [overviewPlanets]);

    // Lines between planets derived from junction nodes — shown in the overview layer.
    const junctionEdges = useMemo(() => {
        const out: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
        for (const node of STAR_CHART_DATA.nodes) {
            if (node.nodeType !== "junction" || !node.unlocksPlanetId) continue;
            const from = planetCenterById.get(node.planetId);
            const to = planetCenterById.get(node.unlocksPlanetId);
            if (!from || !to) continue;
            out.push({ from, to });
        }
        return out;
    }, [planetCenterById]);

    function svgPointFromClient(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
        const svg = svgRef.current;
        if (!svg) return null;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;

        const ctm = svg.getScreenCTM();
        if (!ctm) return null;

        const inv = ctm.inverse();
        const out = pt.matrixTransform(inv);
        return { x: out.x, y: out.y };
    }

    // IMPORTANT: our overlay is in the *SVG element's pixel box*, while the SVG viewBox uses preserveAspectRatio="xMidYMid meet".
    // That means there can be letterboxing padding. This projection matches the SVG renderer exactly.
    function worldToOverlayPx(world: { x: number; y: number }): { x: number; y: number } | null {
        const s = svgSize;
        if (!s) return null;

        const scalePx = Math.min(s.w / vb.w, s.h / vb.h);
        const padX = (s.w - vb.w * scalePx) / 2;
        const padY = (s.h - vb.h * scalePx) / 2;

        const x = padX + (world.x - vb.x) * scalePx;
        const y = padY + (world.y - vb.y) * scalePx;

        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
    }

    // Pan + pinch-to-zoom (pointer events handle both mouse and touch/stylus)
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        // Track all active pointers so we can detect two-finger pinch
        const activePointers = new Map<number, { x: number; y: number }>();

        // Single-pointer pan state
        let startClient: { x: number; y: number } | null = null;
        let startVb: ViewBox | null = null;
        let didStartDragging = false;

        // Two-pointer pinch state
        let pinchStartDist = 0;
        let pinchStartVb: ViewBox | null = null;
        let pinchStartMid: { x: number; y: number } | null = null;

        let rafId: number | null = null;
        let pendingVb: ViewBox | null = null;

        function flush() {
            rafId = null;
            if (!pendingVb) return;
            setVb(pendingVb);
            pendingVb = null;
        }

        function scheduleFlush(next: ViewBox) {
            pendingVb = next;
            if (rafId == null) rafId = requestAnimationFrame(flush);
        }

        function ptDist(a: { x: number; y: number }, b: { x: number; y: number }) {
            const dx = a.x - b.x; const dy = a.y - b.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function ptMid(a: { x: number; y: number }, b: { x: number; y: number }) {
            return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }

        /** Convert a client-space point to SVG world coordinates. */
        function clientToWorld(cx: number, cy: number): { x: number; y: number } | null {
            if (!svg) return null;
            const rect = svg.getBoundingClientRect();
            const vb   = vbRef.current;
            const scalePx = Math.min(rect.width / vb.w, rect.height / vb.h);
            const padX    = (rect.width  - vb.w * scalePx) / 2;
            const padY    = (rect.height - vb.h * scalePx) / 2;
            const wx = vb.x + (cx - rect.left - padX) / scalePx;
            const wy = vb.y + (cy - rect.top  - padY) / scalePx;
            if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
            return { x: wx, y: wy };
        }

        const DRAG_START_PX = 4;

        const onPointerDown = (e: PointerEvent) => {
            // Mouse: only left button; touch/pen: all pointers
            if (e.pointerType === "mouse" && e.button !== 0) return;

            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (activePointers.size === 1) {
                // First pointer — start potential pan
                startClient = { x: e.clientX, y: e.clientY };
                startVb     = vbRef.current;
                didStartDragging     = false;
                suppressClickRef.current = false;
            } else if (activePointers.size === 2) {
                // Second pointer arrived — cancel pan, begin pinch
                if (didStartDragging) { setIsDragging(false); didStartDragging = false; }
                suppressClickRef.current = true;
                cancelZoomAnim();
                const pts       = Array.from(activePointers.values());
                pinchStartDist  = ptDist(pts[0], pts[1]);
                pinchStartMid   = ptMid(pts[0], pts[1]);
                pinchStartVb    = vbRef.current;
                startClient     = null; // disable pan path while pinching
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!activePointers.has(e.pointerId)) return;
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (activePointers.size >= 2) {
                // ── Two-finger pinch zoom ──
                if (!pinchStartVb || !pinchStartMid || pinchStartDist < 1) return;
                const pts     = Array.from(activePointers.values());
                const curDist = ptDist(pts[0], pts[1]);
                if (curDist < 1) return;
                const factor   = pinchStartDist / curDist; // <1 = zoom in, >1 = zoom out
                const worldMid = clientToWorld(pinchStartMid.x, pinchStartMid.y);
                if (!worldMid) return;
                scheduleFlush(clampViewBox(vbZoomAt(pinchStartVb, worldMid, factor)));
                return;
            }

            // ── Single-pointer pan ──
            if (!startClient || !startVb) return;
            const dxPx = e.clientX - startClient.x;
            const dyPx = e.clientY - startClient.y;

            if (!didStartDragging) {
                if (Math.sqrt(dxPx * dxPx + dyPx * dyPx) < DRAG_START_PX) return;
                didStartDragging = true;
                suppressClickRef.current = true;
                cancelZoomAnim();
                setIsDragging(true);
                try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            }

            const rect = svg.getBoundingClientRect();
            scheduleFlush(clampViewBox({
                ...startVb,
                x: startVb.x - (dxPx / rect.width)  * startVb.w,
                y: startVb.y - (dyPx / rect.height) * startVb.h,
            }));
        };

        const endPointer = (e: PointerEvent) => {
            activePointers.delete(e.pointerId);

            if (activePointers.size < 2) {
                // Pinch ended — clear pinch state
                pinchStartDist = 0;
                pinchStartVb   = null;
                pinchStartMid  = null;
            }

            if (activePointers.size === 0) {
                if (didStartDragging) {
                    setIsDragging(false);
                    try { svg.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                }
                startClient      = null;
                startVb          = null;
                didStartDragging = false;
                if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
                if (pendingVb)     { setVb(pendingVb); pendingVb = null; }
            } else if (activePointers.size === 1) {
                // One finger lifted — resume pan from the remaining pointer's position
                const [, pt] = Array.from(activePointers.entries())[0];
                startClient      = { x: pt.x, y: pt.y };
                startVb          = vbRef.current;
                didStartDragging = false;
            }
        };

        svg.addEventListener("pointerdown",   onPointerDown);
        svg.addEventListener("pointermove",   onPointerMove);
        svg.addEventListener("pointerup",     endPointer);
        svg.addEventListener("pointercancel", endPointer);
        svg.addEventListener("pointerleave",  endPointer);

        return () => {
            if (rafId != null) cancelAnimationFrame(rafId);
            svg.removeEventListener("pointerdown",   onPointerDown);
            svg.removeEventListener("pointermove",   onPointerMove);
            svg.removeEventListener("pointerup",     endPointer);
            svg.removeEventListener("pointercancel", endPointer);
            svg.removeEventListener("pointerleave",  endPointer);
        };
    }, [setVb]);

    // Wheel zoom
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const p = svgPointFromClient(e);
            if (!p) return;

            // Cancel any smooth click-zoom so scroll feels immediate.
            cancelZoomAnim();

            const delta = clamp(e.deltaY, -180, 180);
            const factor = delta < 0 ? 1 / 1.18 : 1.18;

            setVb((prev) => vbZoomAt(prev, p, factor));
        };

        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel as any);
    }, [setVb]);

    // Clear selection when zoomed out.
    useEffect(() => {
        if (scale <= 1.10 && selectedPlanetId) {
            setSelectedPlanetId(null);
            setSelectedGroupKey(null);
        }
    }, [scale, selectedPlanetId, setSelectedPlanetId, setSelectedGroupKey]);

    // Keep nodes/lines from getting “noisy” as you zoom further in.
    const nodeDotR = useMemo(() => {
        const r = 1.1 / scale;
        return clamp(r, 0.22, 0.48);
    }, [scale]);

    const lineStroke = useMemo(() => {
        // Keep lines thin as scale increases (but never disappear).
        return clamp(0.20 / scale, 0.06, 0.14);
    }, [scale]);

    const lineStrokeHi = useMemo(() => {
        return clamp(0.28 / scale, 0.08, 0.18);
    }, [scale]);

    const circleStroke = useMemo(() => {
        return clamp(0.42 / scale, 0.12, 0.28);
    }, [scale]);

    const nodeStroke = useMemo(() => {
        return clamp(0.30 / scale, 0.10, 0.20);
    }, [scale]);

    const edgesById = useMemo(() => {
        const m = new Map<string, string[]>();
        for (const n of STAR_CHART_DATA.nodes as any[]) {
            const id = String(n.id);
            const edges = Array.isArray(n.edges) ? n.edges.map(String) : [];
            m.set(id, edges);
        }
        return m;
    }, []);

    function nodeManualLocal(n: StarChartNode): { x: number; y: number } | null {
        const anyN = n as any;
        const p = anyN?.pos;
        if (!p) return null;
        const x = typeof p.x === "number" ? p.x : Number(p.x);
        const y = typeof p.y === "number" ? p.y : Number(p.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
    }

    function getNodeRecordById(id: NodeId): StarChartNode | null {
        const n = (STAR_CHART_DATA.nodes as StarChartNode[]).find((x) => x.id === id);
        return n ?? null;
    }

    function groupBaseNode(group: NodeGroup): StarChartNode | null {
        return getNodeRecordById(group.baseNodeId);
    }

    const expandedRadiusByPlanetId = useMemo(() => {
        const out = new Map<string, number>();

        // World is now 420 units wide; cap disk radius so isolated planets don't
        // dominate the screen and close pairs stay comfortably separate.
        const desired = clamp(vb.w * 0.28, 10.0, 26.0);

        for (let i = 0; i < overviewPlanets.length; i++) {
            const a = overviewPlanets[i];

            let minDist = Infinity;
            for (let j = 0; j < overviewPlanets.length; j++) {
                if (i === j) continue;
                const b = overviewPlanets[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minDist) minDist = d;
            }

            // Use the planet's own base radius as the minimum cap so that when
            // Kuva Fortress (or any two closely-spaced planets) approaches,
            // their disks never visually overlap — Math.max(8) was too large
            // for the ~12-world-unit closest approach Kuva makes to Earth.
            const padBetween = 4.0;
            const neighborCap = Number.isFinite(minDist) ? Math.max(a.r, minDist / 2 - padBetween) : desired;

            out.set(a.planet.id, Math.min(desired, neighborCap));
        }

        return out;
    }, [overviewPlanets, vb.w]);

    // Physics runs in a unit disk (center = 0, radius = 1) with a fixed node
    // size so that the resulting normalized positions never shift with zoom.
    const LAYOUT_NODE_R = 0.035; // node radius as a fraction of diskR

    function computePlanetNodeLayout(args: {
        planetId: PlanetId;
        groups: NodeGroup[];
    }): { layouts: NodeLayout[]; links: Array<{ a: NodeLayout; b: NodeLayout }> } {
        const { groups } = args;

        if (!groups.length) return { layouts: [], links: [] };

        const clusterR = 0.92; // fraction of unit disk

        const pts: Array<{
            group: NodeGroup;
            x: number;
            y: number;
            hasManual: boolean;
        }> = [];

        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            const base = groupBaseNode(g);
            const manual = base ? nodeManualLocal(base) : null;

            if (manual) {
                pts.push({
                    group: g,
                    x: clamp(manual.x, -0.98, 0.98),
                    y: clamp(manual.y, -0.98, 0.98),
                    hasManual: true
                });
                continue;
            }

            const a = (i / Math.max(1, groups.length)) * Math.PI * 2;
            const r0 = clusterR * (0.48 + 0.48 * hashToUnitFloat(g.key + ":r"));
            pts.push({
                group: g,
                x: Math.cos(a) * r0,
                y: Math.sin(a) * r0,
                hasManual: false
            });
        }

        const steps = 70;
        const padding = LAYOUT_NODE_R * 3.1;
        const pull = 0.008;

        for (let s = 0; s < steps; s++) {
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                if (a.hasManual) continue;

                // Gentle pull toward center (coords are relative to 0,0)
                a.x -= a.x * pull;
                a.y -= a.y * pull;

                for (let j = 0; j < pts.length; j++) {
                    if (i === j) continue;
                    const b = pts[j];

                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
                    const minD = LAYOUT_NODE_R * 2 + padding;

                    if (d < minD) {
                        const push = (minD - d) * 0.42;
                        const ux = dx / d;
                        const uy = dy / d;

                        const wA = b.hasManual ? 1.0 : 0.5;
                        const wB = b.hasManual ? 0.0 : 0.5;

                        a.x += ux * push * wA;
                        a.y += uy * push * wA;

                        b.x -= ux * push * wB;
                        b.y -= uy * push * wB;
                    }
                }
            }
        }

        const labelDist = LAYOUT_NODE_R * 3.1;

        const layouts: NodeLayout[] = pts.map((p) => {
            const ang = Math.atan2(p.y, p.x);
            const preferRight = Math.cos(ang) >= 0;
            const altRight = !preferRight;

            function penalty(lx: number, ly: number): number {
                let pen = 0;
                for (const q of pts) {
                    const dx = lx - q.x;
                    const dy = ly - q.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    const minD = LAYOUT_NODE_R * 4.4;
                    if (d < minD) pen += minD - d;
                }
                return pen;
            }

            const lxA = p.x + (preferRight ? labelDist : -labelDist);
            const lxB = p.x + (altRight ? labelDist : -labelDist);
            const useRight = penalty(lxA, p.y) <= penalty(lxB, p.y) ? preferRight : altRight;

            return {
                group: p.group,
                ncx: p.x,
                ncy: p.y,
                nlx: p.x + (useRight ? labelDist : -labelDist),
                nly: p.y,
                lAnchor: useRight ? "start" : "end"
            };
        });

        const groupByBaseNodeId = new Map<string, NodeGroup>();
        for (const g of groups) groupByBaseNodeId.set(String(g.baseNodeId), g);

        const byKey = new Map<string, NodeLayout>();
        for (const l of layouts) byKey.set(l.group.key, l);

        const outLinks: Array<{ a: NodeLayout; b: NodeLayout }> = [];

        for (const l of layouts) {
            const aBaseId = String(l.group.baseNodeId);
            const edges = edgesById.get(aBaseId) ?? [];
            for (const toId of edges) {
                const toGroup = groupByBaseNodeId.get(String(toId));
                if (!toGroup) continue;
                const b = byKey.get(toGroup.key);
                if (!b) continue;
                outLinks.push({ a: l, b });
            }
        }

        const seen = new Set<string>();
        const uniq: Array<{ a: NodeLayout; b: NodeLayout }> = [];
        for (const e of outLinks) {
            const k1 = `${e.a.group.key}=>${e.b.group.key}`;
            const k2 = `${e.b.group.key}=>${e.a.group.key}`;
            if (seen.has(k1) || seen.has(k2)) continue;
            seen.add(k1);
            uniq.push(e);
        }

        return { layouts, links: uniq };
    }

    // Stable layout: only recomputes when planet groupings change, not on zoom/pan.
    const planetNodeLayouts = useMemo(() => {
        const out = new Map<string, { layouts: NodeLayout[]; links: Array<{ a: NodeLayout; b: NodeLayout }> }>();
        for (const [planetId, groups] of groupedByPlanet) {
            out.set(planetId, computePlanetNodeLayout({ planetId: planetId as PlanetId, groups }));
        }
        return out;
    }, [groupedByPlanet, edgesById]);

    const zoomedPlanetLayers = useMemo(() => {
        if (reveal <= 0.01) {
            return [] as Array<{
                planet: StarChartPlanet;
                cx: number;
                cy: number;
                baseR: number;
                diskR: number;
                grownR: number;
                clipId: string;
                layouts: NodeLayout[];
                links: Array<{ a: NodeLayout; b: NodeLayout }>;
            }>;
        }

        const out: Array<{
            planet: StarChartPlanet;
            cx: number;
            cy: number;
            baseR: number;
            diskR: number;
            grownR: number;
            clipId: string;
            layouts: NodeLayout[];
            links: Array<{ a: NodeLayout; b: NodeLayout }>;
        }> = [];

        for (const pl of overviewPlanets) {
            const pid = pl.planet.id as PlanetId;
            const diskR = expandedRadiusByPlanetId.get(pid) ?? 18;
            const grownR = lerp(pl.r, diskR, reveal);
            const clipBase = String(pid).replace(/[^a-z0-9_:-]/gi, "_");
            const clipId = `clip_${clipBase}`;
            const { layouts, links } = planetNodeLayouts.get(String(pid)) ?? { layouts: [], links: [] };

            out.push({
                planet: pl.planet,
                cx: pl.x,
                cy: pl.y,
                baseR: pl.r,
                diskR,
                grownR,
                clipId,
                layouts,
                links
            });
        }

        return out;
    }, [overviewPlanets, planetNodeLayouts, expandedRadiusByPlanetId, reveal]);

    const canInteractPlanetNodes = reveal > 0.18;

    function zoomIntoPlanet(pid: PlanetId) {
        const c = planetCenterById.get(pid);
        if (!c) return;

        // Always zoom all the way in (vb.w=20 → scale=5 → past the full-reveal threshold).
        // This guarantees one click takes you from any zoom level straight to the node view.
        const zoomW = 20;
        animateToVb(clampViewBox({
            x: c.x - zoomW / 2,
            y: c.y - zoomW / 2,
            w: zoomW,
            h: zoomW
        }));
    }

    function onClickPlanet(pid: PlanetId) {
        if (suppressClickRef.current) return;

        setSelectedPlanetId(pid);
        setSelectedGroupKey(null);
        setSelectedTab(DEFAULT_NODE_GROUP_TAB);
        zoomIntoPlanet(pid);
    }

    function onClickGroup(pid: PlanetId, g: NodeGroup) {
        if (suppressClickRef.current) return;

        setSelectedPlanetId(pid);
        if (selectedGroupKey === g.key) {
            setSelectedGroupKey(null);
            setSelectedTab(DEFAULT_NODE_GROUP_TAB);
            return;
        }
        setSelectedGroupKey(g.key);
        setSelectedTab(DEFAULT_NODE_GROUP_TAB);
    }

    function onMapBackgroundClick() {
        if (suppressClickRef.current) return;

        setSelectedGroupKey(null);
        setSelectedTab(DEFAULT_NODE_GROUP_TAB);
    }

    // Global orbit rings (world-space radii from MAP_CENTER).
    // Five evenly-spaced rings from inner planets out to the edge — matches
    // the faint concentric circles visible in the in-game star chart.
    const orbitRings = useMemo(() => {
        const base = [8, 16, 24, 32, 40]; // × 5.0 = 40, 80, 120, 160, 200 world units
        return base.map((r) => r * MAP_POS_SCALE);
    }, []);

    // Radial sector spokes emanating from MAP_CENTER — the faint "pie-slice"
    // lines visible in the in-game star chart (12 spokes = every 30°).
    const sectorSpokes = useMemo(() => {
        const spokeLen = 200; // world units — long enough to reach map edges
        return Array.from({ length: 12 }, (_, i) => {
            const angle = (i * Math.PI * 2) / 12;
            return {
                x2: MAP_CENTER.x + Math.cos(angle) * spokeLen,
                y2: MAP_CENTER.y + Math.sin(angle) * spokeLen
            };
        });
    }, []);

    const overviewLayerOpacity = useMemo(() => clamp(1 - reveal * 1.15, 0, 1), [reveal]);


    // SCREEN-SPACE locked label: put it a fixed PX amount above the *screen-projected* circle top.
    function circleTopLabelPx(centerWorld: { x: number; y: number }, rWorld: number, padPx: number): { x: number; y: number } | null {
        const topPx = worldToOverlayPx({ x: centerWorld.x, y: centerWorld.y - rWorld });
        if (!topPx) return null;
        return { x: topPx.x, y: topPx.y - padPx };
    }

    const overviewPlanetLabelScreens = useMemo(() => {
        const out: Array<{ id: string; x: number; y: number; text: string; opacity: number }> = [];
        const padPx = 10;

        for (const pl of overviewPlanets) {
            const p = circleTopLabelPx({ x: pl.x, y: pl.y }, pl.r, padPx);
            if (!p) continue;
            out.push({
                id: pl.planet.id,
                x: p.x,
                y: p.y,
                text: pl.planet.name,
                opacity: 0.95 * overviewLayerOpacity
            });
        }

        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overviewPlanets, boundsTick, overviewLayerOpacity, vb, svgSize]);

    const isCompactPlanetMap = (svgSize?.w ?? Number.POSITIVE_INFINITY) < 520;

    const zoomedPlanetLabelScreens = useMemo(() => {
        if (!canInteractPlanetNodes) return [];
        const out: Array<{ id: string; x: number; y: number; text: string; opacity: number }> = [];
        const padPx = 12;

        for (const zl of zoomedPlanetLayers) {
            const p = circleTopLabelPx({ x: zl.cx, y: zl.cy }, zl.grownR, padPx);
            if (!p) continue;
            out.push({
                id: zl.planet.id,
                x: p.x,
                y: p.y,
                text: zl.planet.name,
                opacity: reveal
            });
        }

        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomedPlanetLayers, canInteractPlanetNodes, reveal, boundsTick, vb, svgSize]);

    const nodeLabelScreens = useMemo(() => {
        if (!canInteractPlanetNodes) return [];
        const out: Array<{ key: string; x: number; y: number; text: string; anchor: "start" | "end" }> = [];

        for (const zl of zoomedPlanetLayers) {
            for (const nd of zl.layouts) {
                const p = worldToOverlayPx({
                    x: zl.cx + nd.nlx * zl.grownR,
                    y: zl.cy + nd.nly * zl.grownR
                });
                if (!p) continue;
                out.push({
                    key: `${zl.planet.id}::${nd.group.key}`,
                    x: p.x,
                    y: p.y,
                    text: nd.group.displayName,
                    anchor: nd.lAnchor
                });
            }
        }

        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomedPlanetLayers, canInteractPlanetNodes, boundsTick, vb, svgSize]);

    // Region resources are merged into Drops (base tab) for the selected planet.
    const regionResources = useMemo(() => {
        if (!selectedPlanetId || !selectedPlanetName) return [];
        return getRegionResourcesForPlanet(selectedPlanetId, selectedPlanetName);
    }, [selectedPlanetId, selectedPlanetName]);

    const missionRewardNameKeys = useMemo(() => {
        const keys = new Set<string>();
        const missionRewardsTab = tabsForPanel.find((tab) => tab.kind === "mission_rewards") ?? null;
        const missionRewardSources = new Set<string>();

        if (missionRewardsTab) {
            for (const item of missionRewardsTab.items) {
                keys.add(itemNameKey(item.name));
            }
            for (const sid of missionRewardsTab.dropSources) {
                missionRewardSources.add(sid);
            }
        }

        if (selectedGroupBaseNodeId) {
            for (const sid of getDropSourcesForStarChartNode(selectedGroupBaseNodeId)) {
                if (/^data:missionreward\//.test(sid)) missionRewardSources.add(sid);
            }
        }

        const rotSources = [...missionRewardSources].filter((s) => /\/rotation[abc]$/.test(s));
        for (const sid of rotSources) {
            const entries = dropMetaLookup[sid];
            if (!entries) continue;
            for (const [normKey, meta] of Object.entries(entries)) {
                const normDisplay = normItemKey(meta.displayName);
                if (normDisplay !== normKey) continue;
                keys.add(itemNameKey(stripQtyPrefix(meta.displayName)));
            }
        }

        return keys;
    }, [tabsForPanel, dropMetaLookup, selectedGroupBaseNodeId]);

    const mergedActiveItems = useMemo(() => {
        if (!activeTab) return [];
        if (activeTab.kind !== "base" && activeTab.kind !== "all") return activeTab.items;

        const rrRows: ItemRow[] = regionResources.map((r) => ({
            catalogId: `region_resource:${String(selectedPlanetId)}:${r.name}`,
            name: r.name
        }));

        const merged = dedupeItemsByName([...rrRows, ...activeTab.items]);
        return activeTab.kind === "base"
            ? merged.filter((item) => !missionRewardNameKeys.has(itemNameKey(item.name)))
            : merged;
    }, [activeTab, regionResources, selectedPlanetId, missionRewardNameKeys]);

    const filteredActiveItems = useMemo(() => {
        const q = itemFilter.trim().toLowerCase();
        if (!activeTab) return [];
        if (!q) return mergedActiveItems;

        return mergedActiveItems.filter((it) => it.name.toLowerCase().includes(q) || it.catalogId.toLowerCase().includes(q));
    }, [activeTab, itemFilter, mergedActiveItems]);

    const wantedGoalsBySource = useMemo(() => {
        const map = new Map<string, Array<{ key: string; name: string; type: "mod" | "arcane"; remaining: number }>>();

        for (const goal of goals ?? []) {
            if (!goal || goal.isActive === false) continue;
            const goalKind = getGoalCatalogKind(goal);
            if (goalKind === "item") continue;

            const qty = Math.max(1, Number(goal.qty ?? 1) || 1);
            const have = getOwnedCountForGoal(goal, inventory);
            const remaining = Math.max(0, qty - have);
            if (remaining <= 0) continue;

            const cid = String(goal.catalogId);
            const name = FULL_CATALOG.recordsById[cid as CatalogId]?.displayName ?? cid;
            for (const sourceId of getAcquisitionByCatalogId(cid as CatalogId)?.sources ?? []) {
                const key = String(sourceId);
                const rows = map.get(key) ?? [];
                rows.push({ key: cid, name, type: goalKind, remaining });
                map.set(key, rows);
            }
        }

        for (const [sourceId, rows] of map.entries()) {
            const deduped = new Map<string, { key: string; name: string; type: "mod" | "arcane"; remaining: number }>();
            for (const row of rows) deduped.set(row.key, row);
            map.set(
                sourceId,
                Array.from(deduped.values()).sort((a, b) => {
                    if (a.type !== b.type) return a.type.localeCompare(b.type);
                    if (a.remaining !== b.remaining) return b.remaining - a.remaining;
                    return a.name.localeCompare(b.name);
                }),
            );
        }

        return map;
    }, [goals, inventory]);

    const wantedActiveItems = useMemo(() => {
        if (!activeTab) return [];
        const seen = new Map<string, { key: string; name: string; type: "mod" | "arcane"; remaining: number }>();
        for (const sourceId of activeTab.dropSources ?? []) {
            for (const row of wantedGoalsBySource.get(String(sourceId)) ?? []) {
                seen.set(row.key, row);
            }
        }
        return Array.from(seen.values()).sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            if (a.remaining !== b.remaining) return b.remaining - a.remaining;
            return a.name.localeCompare(b.name);
        });
    }, [activeTab, wantedGoalsBySource]);

    /** Catalog name → catalogId for ownership lookup when rendering from drop table */
    const catalogNameMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const it of mergedActiveItems) {
            m.set(it.name.toLowerCase().trim(), it.catalogId);
        }
        return m;
    }, [mergedActiveItems]);

    /**
     * Items built directly from the missionRewards drop table for tabs that have
     * rotation sources.  Bypasses the catalog index so we show the authoritative
     * names with quantities (e.g. "400 Endo", "2X Orokin Cell") and include items
     * like Endo / Cyclone Kraken that have no catalog entry.
     */
    const rotationItems = useMemo((): RotationItem[] => {
        if (!activeTab) return [];
        const rotSources = activeTab.dropSources.filter((s) => /\/rotation[abc]$/.test(s));
        if (rotSources.length === 0) return [];

        const items: RotationItem[] = [];
        for (const sid of rotSources) {
            const entries = dropMetaLookup[sid];
            if (!entries) continue;
            for (const [normKey, meta] of Object.entries(entries)) {
                // Skip no-Blueprint alias entries (they share displayName with the full name entry)
                const normDisplay = normItemKey(meta.displayName);
                if (normDisplay !== normKey) continue;

                const baseName = stripQtyPrefix(meta.displayName);
                const catalogId = findCatalogIdForRewardName(baseName, catalogNameMap);
                items.push({
                    key: `${sid}:${normKey}`,
                    displayName: meta.displayName,
                    baseName,
                    catalogId,
                    meta,
                });
            }
        }
        // Sort: rotation A → B → C, then by chance desc within each rotation.
        items.sort((a, b) => {
            const ro: Record<string, number> = { A: 0, B: 1, C: 2 };
            const rd = (ro[a.meta.rotation] ?? 3) - (ro[b.meta.rotation] ?? 3);
            if (rd !== 0) return rd;
            return b.meta.chance - a.meta.chance;
        });
        return items;
    }, [activeTab, dropMetaLookup, catalogNameMap]);

    const filteredRotationItems = useMemo(() => {
        const q = itemFilter.trim().toLowerCase();
        let items = rotationFilter ? rotationItems.filter((it) => it.meta.rotation === rotationFilter) : rotationItems;
        if (q) items = items.filter((it) => it.displayName.toLowerCase().includes(q));
        return items;
    }, [rotationItems, rotationFilter, itemFilter]);

    const useRotationView = rotationItems.length > 0;

    const tabVisibleCounts = useMemo(() => {
        const counts = new Map<NodeGroupKind, number>();

        for (const tab of tabsForPanel) {
            if (tab.kind === "base") {
                const rrRows: ItemRow[] = regionResources.map((r) => ({
                    catalogId: `region_resource:${String(selectedPlanetId)}:${r.name}`,
                    name: r.name,
                }));
                counts.set(
                    tab.kind,
                    dedupeItemsByName([...rrRows, ...tab.items]).filter((item) => !missionRewardNameKeys.has(itemNameKey(item.name))).length,
                );
                continue;
            }

            const rotSources = tab.dropSources.filter((s) => /\/rotation[abc]$/.test(s));
            if (rotSources.length > 0) {
                const seen = new Set<string>();
                for (const sid of rotSources) {
                    const entries = dropMetaLookup[sid];
                    if (!entries) continue;
                    for (const [normKey, meta] of Object.entries(entries)) {
                        const normDisplay = normItemKey(meta.displayName);
                        if (normDisplay !== normKey) continue;
                        seen.add(`${sid}:${normKey}`);
                    }
                }
                counts.set(tab.kind, seen.size);
                continue;
            }

            counts.set(tab.kind, tab.items.length);
        }

        return counts;
    }, [tabsForPanel, regionResources, selectedPlanetId, dropMetaLookup, missionRewardNameKeys]);

    return (
        <div className={["relative w-full", isInModal ? "h-full" : "h-[72vh] min-h-[560px]"].join(" ")}>
            {showDropsPanel && (
                <div className="absolute inset-0 z-40 sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[520px] sm:max-w-[42vw] pointer-events-none">
                    <div className="pointer-events-auto h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/55 backdrop-blur-sm">
                        <div className="h-full overflow-auto overscroll-contain p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-100">
                                        {selectedGroupKey
                                            ? selectedGroupDisplayName
                                                ? `Node · ${selectedGroupDisplayName}`
                                                : "Node Drops / Rewards"
                                            : selectedPlanetName
                                               ? `Drops · ${selectedPlanetName}`
                                                : "Drops"}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">Click the selected node again to unselect.</div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                                        onClick={() => {
                                            setSelectedGroupKey(null);
                                            setSelectedTab(DEFAULT_NODE_GROUP_TAB);
                                            setSelectedPlanetId(null);
                                        }}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            {/* Mission metadata — faction and mission type */}
                            {selectedMissionNode && (selectedMissionNode.missionType || selectedMissionNode.faction) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {selectedMissionNode.faction && (
                                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-400">
                                            {selectedMissionNode.faction}
                                        </span>
                                    )}
                                    {selectedMissionNode.missionType && (
                                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-blue-800/60 bg-blue-950/30 text-blue-300">
                                            {selectedMissionNode.missionType}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* 6.5 Junction Inspector */}
                            {junctionNode && junctionNode.nodeType === "junction" && (
                                <div className="mt-3 rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-3 space-y-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Junction</div>

                                    {junctionNode.unlocksPlanetId && (
                                        <div>
                                            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Unlocks</div>
                                            <div className="text-sm text-slate-200 font-semibold">
                                                {planetsById.get(junctionNode.unlocksPlanetId)?.name ?? junctionNode.unlocksPlanetId}
                                            </div>
                                        </div>
                                    )}

                                    {junctionPrereqDef && (
                                        <div>
                                            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Requirements</div>
                                            {(junctionPrereqDef.prerequisites.length > 0
                                                || (junctionPrereqDef.anyPrerequisites?.length ?? 0) > 0
                                                || (junctionPrereqDef.conditions?.length ?? 0) > 0) && (
                                                <ul className="space-y-1">
                                                    {junctionPrereqDef.prerequisites.map((pid) => (
                                                        <li key={pid} className="text-xs text-slate-300 flex items-center gap-1">
                                                            <span className="text-cyan-500">—</span>
                                                            {prereqLabelIndex[pid] ?? pid}
                                                        </li>
                                                    ))}
                                                    {!!junctionPrereqDef.anyPrerequisites?.length && (
                                                        <li key="any" className="text-xs text-slate-300 flex items-center gap-1">
                                                            <span className="text-cyan-500">—</span>
                                                            Either {junctionPrereqDef.anyPrerequisites.map((pid) => prereqLabelIndex[pid] ?? pid).join(" or ")}
                                                        </li>
                                                    )}
                                                    {(junctionPrereqDef.conditions ?? []).map((condition, index) => {
                                                        const label = condition.type === "node_complete"
                                                            ? `Complete ${STAR_CHART_DATA.nodes.find((node) => node.id === condition.nodeId)?.name ?? condition.nodeId}`
                                                            : describePrereqCondition(condition, (id) => prereqLabelIndex[id] ?? id);
                                                        return (
                                                            <li key={`condition-${index}`} className="text-xs text-slate-300 flex items-center gap-1">
                                                                <span className="text-cyan-500">—</span>
                                                                {label}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                            <p className="mt-2 text-xs leading-relaxed text-slate-400">{junctionPrereqDef.description}</p>
                                        </div>
                                    )}

                                    <div className="text-[11px] text-slate-500">
                                        Completing this junction unlocks access to the next planet and its mission nodes.
                                    </div>
                                </div>
                            )}

                            {/* Node completion status */}
                            {selectedGroupBaseNodeId && (() => {
                                const isCompleted = Boolean(effectiveNodeCompletedMap[selectedGroupBaseNodeId]);
                                return isCompleted ? (
                                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2">
                                        <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                                            <span className="text-emerald-400 text-sm">✓</span>
                                            {steelPathMode ? "Steel Path node completed" : "Node completed"}
                                        </div>
                                        <button
                                            className="text-[10px] text-emerald-600 hover:text-emerald-400 transition-colors"
                                            onClick={() => activeSetNodeCompleted(selectedGroupBaseNodeId, false)}
                                        >
                                            Unmark
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-3 flex items-center gap-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                                            <input
                                                type="checkbox"
                                                checked={false}
                                                onChange={(e) => activeSetNodeCompleted(selectedGroupBaseNodeId, e.target.checked)}
                                            />
                                            <span>Mark node as completed</span>
                                        </label>
                                    </div>
                                );
                            })()}

                            {selectedGroupKey && (
                                <>
                                    {tabsForPanel.length > 0 && (
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            {tabsForPanel.map((t) => {
                                                const active = t.kind === selectedTab;
                                                const count = tabVisibleCounts.get(t.kind) ?? 0;

                                                return (
                                                    <button
                                                        key={`tab-${t.kind}`}
                                                        className={[
                                                            "rounded-full px-3 py-1 text-xs border",
                                                            active
                                                                ? "bg-slate-100 text-slate-900 border-slate-100"
                                                                : "bg-slate-950/40 text-slate-200 border-slate-700 hover:bg-slate-900"
                                                        ].join(" ")}
                                                        onClick={() => setSelectedTab(t.kind)}
                                                    >
                                                        {t.label}
                                                        <span className="ml-2 text-[10px] opacity-70">({count})</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <input
                                            className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600"
                                            placeholder="Filter items by name or id…"
                                            value={itemFilter}
                                            onChange={(e) => setItemFilter(e.target.value)}
                                        />

                                        {/* Rotation sub-filter — shown when drop table rotation data is available */}
                                        {useRotationView && (
                                            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-semibold w-full">
                                                {([null, "A", "B", "C"] as const).map((r) => {
                                                    const label = r === null ? "All" : `Rotation ${r}`;
                                                    const count = r === null ? rotationItems.length : rotationItems.filter((it) => it.meta.rotation === r).length;
                                                    const active = rotationFilter === r;
                                                    return (
                                                        <button
                                                            key={label}
                                                            className={[
                                                                "flex-1 px-2 py-1.5 transition-colors border-r border-slate-700 last:border-r-0",
                                                                active ? "bg-slate-700 text-slate-100" : "bg-slate-950/20 text-slate-400 hover:bg-slate-900/40",
                                                                count === 0 ? "opacity-40 cursor-default" : ""
                                                            ].join(" ")}
                                                            onClick={() => setRotationFilter(r)}
                                                            disabled={count === 0}
                                                        >
                                                            {label} <span className="opacity-60">({count})</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="flex w-full items-center justify-between">
                                            <button className="text-slate-400 hover:text-slate-200" onClick={() => setShowDebugSources((v) => !v)}>
                                                {showDebugSources ? "Hide debug source ids" : "Show debug source ids"}
                                            </button>
                                            {activeTab && (
                                                <div className="text-xs text-slate-500">
                                                    {useRotationView
                                                        ? `Showing ${filteredRotationItems.length} of ${rotationItems.length}`
                                                        : `Showing ${filteredActiveItems.length} of ${mergedActiveItems.length}`
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 space-y-3">
                                        {showDebugSources && (
                                            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                                                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Debug: SourceIds for this tab</div>
                                                {!activeTab || activeTab.dropSourceDetails.length === 0 ? (
                                                    <div className="text-sm text-slate-400">No sources mapped for this tab.</div>
                                                ) : (
                                                    <ul className="space-y-1">
                                                        {activeTab.dropSourceDetails.map((d) => (
                                                            <li key={d.sid} className="break-words text-xs text-slate-200">
                                                                <span className="font-mono">{d.sid}</span>
                                                                <span className="text-slate-500"> — {d.label}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <div className="mb-3">
                                                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Wanted Here</div>
                                                {!activeTab ? (
                                                    <div className="text-sm text-slate-400">No tab selected.</div>
                                                ) : wantedActiveItems.length === 0 ? (
                                                    <div className="text-sm text-slate-400">No active mod or arcane goals overlap this node.</div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {wantedActiveItems.map((goal) => (
                                                            <span
                                                                key={goal.key}
                                                                className={[
                                                                    "text-[10px] rounded-full border px-2 py-0.5",
                                                                    goal.type === "arcane"
                                                                        ? "border-amber-700/50 bg-amber-950/20 text-amber-300"
                                                                        : "border-cyan-700/50 bg-cyan-950/20 text-cyan-300",
                                                                ].join(" ")}
                                                            >
                                                                {goal.name} · {goal.remaining} left
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Obtainable here</div>

                                            {!activeTab ? (
                                                <div className="text-sm text-slate-400">No tab selected.</div>
                                            ) : useRotationView ? (
                                                /* Rotation-table view: renders directly from missionRewards.json data */
                                                filteredRotationItems.length === 0 ? (
                                                    <div className="text-sm text-slate-400">No items for this rotation.</div>
                                                ) : (
                                                    <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-800 bg-slate-950/30 p-2">
                                                        <ul className="space-y-0.5 text-sm text-slate-200">
                                                            {filteredRotationItems.map((it) => {
                                                                const owned = it.catalogId ? Number(inventoryCounts[it.catalogId] ?? 0) > 0 : false;
                                                                return (
                                                                    <li key={it.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 border-b border-slate-800/50 last:border-0">
                                                                        <span className={owned ? "text-slate-500 line-through" : "font-semibold"}>
                                                                            {it.displayName}
                                                                            {owned && <span className="ml-1.5 text-[10px] text-emerald-500">✓</span>}
                                                                        </span>
                                                                        <span className="flex items-center gap-1 text-[11px]">
                                                                            <span className="rounded px-1 py-px bg-slate-700 text-slate-300 font-mono font-bold">{it.meta.rotation}</span>
                                                                            <span className="text-slate-400">{formatChance(it.meta.chance)}</span>
                                                                            <span className={rarityClass(it.meta.rarity)}>{it.meta.rarity}</span>
                                                                        </span>
                                                                        {it.catalogId && (
                                                                            <button
                                                                                type="button"
                                                                                className={[
                                                                                    "ml-auto rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                                                                                    owned
                                                                                        ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40"
                                                                                        : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500 hover:text-slate-100",
                                                                                ].join(" ")}
                                                                                onClick={() => setCount(it.catalogId as CatalogId, owned ? 0 : 1)}
                                                                                title={owned ? "Mark as unowned" : "Mark as owned in Inventory"}
                                                                            >
                                                                                {owned ? "Owned" : "Mark owned"}
                                                                            </button>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                )
                                            ) : filteredActiveItems.length === 0 ? (
                                                <div className="text-sm text-slate-400">No items resolve for this tab in the current catalog mapping.</div>
                                            ) : (
                                                /* Catalog view: for Drops / base tab */
                                                <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-800 bg-slate-950/30 p-2">
                                                    <ul className="space-y-0.5 text-sm text-slate-200">
                                                        {filteredActiveItems.slice(0, 600).map((it) => {
                                                            const owned = Number(inventoryCounts[it.catalogId] ?? 0) > 0;
                                                            const dropMeta = resolveDropMeta(it, activeTab?.dropSources ?? [], dropMetaLookup);
                                                            return (
                                                                <li key={it.catalogId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 border-b border-slate-800/50 last:border-0">
                                                                    <span className={owned ? "text-slate-500 line-through" : "font-semibold"}>
                                                                        {it.name}
                                                                        {owned && <span className="ml-1.5 text-[10px] text-emerald-500">✓</span>}
                                                                    </span>
                                                                    {dropMeta && (
                                                                        <span className="flex items-center gap-1 text-[11px]">
                                                                            <span className="rounded px-1 py-px bg-slate-700 text-slate-300 font-mono font-bold">{dropMeta.rotation}</span>
                                                                            <span className="text-slate-400">{formatChance(dropMeta.chance)}</span>
                                                                            <span className={rarityClass(dropMeta.rarity)}>{dropMeta.rarity}</span>
                                                                        </span>
                                                                    )}
                                                                    {!String(it.catalogId).startsWith("region_resource:") && (
                                                                        <button
                                                                            type="button"
                                                                            className={[
                                                                                "ml-auto rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                                                                                owned
                                                                                    ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40"
                                                                                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500 hover:text-slate-100",
                                                                            ].join(" ")}
                                                                            onClick={() => setCount(it.catalogId as CatalogId, owned ? 0 : 1)}
                                                                            title={owned ? "Mark as unowned" : "Mark as owned in Inventory"}
                                                                        >
                                                                            {owned ? "Owned" : "Mark owned"}
                                                                        </button>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                    {filteredActiveItems.length > 600 && (
                                                        <div className="mt-2 text-xs text-slate-500">Rendering capped at 600 items.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 select-none">
                <svg
                    ref={svgRef}
                    className="absolute inset-0 z-10 h-full w-full cursor-grab active:cursor-grabbing"
                    style={{ touchAction: "none" }}
                    viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
                    preserveAspectRatio="xMidYMid meet"
                    onClick={(e) => {
                        const t = e.target as HTMLElement | null;
                        if (t?.closest?.('[data-clickable="true"]')) return;
                        onMapBackgroundClick();
                    }}
                >
                    <defs>
                        {/* Nebula background gradients */}
                        <radialGradient id="bg0" cx="50%" cy="50%" r="70%">
                            <stop offset="0%" stopColor="rgba(20,40,110,0.24)" />
                            <stop offset="60%" stopColor="rgba(2,6,23,0.0)" />
                        </radialGradient>
                        <radialGradient id="bg1" cx="20%" cy="38%" r="56%">
                            <stop offset="0%" stopColor="rgba(50,20,150,0.18)" />
                            <stop offset="52%" stopColor="rgba(2,6,23,0.0)" />
                        </radialGradient>
                        <radialGradient id="bg2" cx="78%" cy="28%" r="54%">
                            <stop offset="0%" stopColor="rgba(20,60,170,0.16)" />
                            <stop offset="48%" stopColor="rgba(2,6,23,0.0)" />
                        </radialGradient>
                        <radialGradient id="bg3" cx="60%" cy="74%" r="46%">
                            <stop offset="0%" stopColor="rgba(90,20,130,0.13)" />
                            <stop offset="44%" stopColor="rgba(2,6,23,0.0)" />
                        </radialGradient>

                        {/* Sun glow at chart centre */}
                        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%"   stopColor="rgba(255,248,190,0.98)" />
                            <stop offset="30%"  stopColor="rgba(255,210,90,0.60)" />
                            <stop offset="65%"  stopColor="rgba(255,150,30,0.22)" />
                            <stop offset="100%" stopColor="rgba(255,100,0,0)" />
                        </radialGradient>

                        {/* Per-planet sphere gradients — highlight upper-left like a lit sphere */}
                        {STAR_CHART_DATA.planets.map((p) => {
                            const col = PLANET_COLORS[p.id] ?? DEFAULT_PLANET_COLOR;
                            const gId = planetGradId(p.id);
                            return (
                                <radialGradient key={gId} id={gId} cx="30%" cy="25%" r="72%">
                                    <stop offset="0%"   stopColor={col.light} stopOpacity={0.95} />
                                    <stop offset="48%"  stopColor={col.base}  stopOpacity={0.95} />
                                    <stop offset="100%" stopColor={col.dark}  stopOpacity={0.95} />
                                </radialGradient>
                            );
                        })}

                        {/* ClipPaths for zoomed planet disks (node clipping) */}
                        {zoomedPlanetLayers.map((zl) => (
                            <clipPath key={`clipdef-${zl.clipId}`} id={zl.clipId}>
                                <circle cx={zl.cx} cy={zl.cy} r={zl.diskR} />
                            </clipPath>
                        ))}

                        {/* Soft circular vignette mask reused by all planet images.
                             maskContentUnits="objectBoundingBox" means x/y/w/h=0..1
                             maps to the exact bounding box of whatever element uses it,
                             so one mask definition works for every planet size. */}
                        <radialGradient id="sphereVignette" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
                            <stop offset="68%" stopColor="white" stopOpacity="1" />
                            <stop offset="100%" stopColor="white" stopOpacity="0" />
                        </radialGradient>
                        <mask id="sphereVignetteMask" maskContentUnits="objectBoundingBox">
                            <rect x="0" y="0" width="1" height="1" fill="url(#sphereVignette)" />
                        </mask>

                    </defs>

                    {/* ── Deep-space background ──────────────────────────────────── */}
                    <rect x={WORLD_MIN - 80} y={WORLD_MIN - 80} width={WORLD_MAX - WORLD_MIN + 160} height={WORLD_MAX - WORLD_MIN + 160} fill="rgba(1,4,18,1)" />
                    <rect x={WORLD_MIN - 80} y={WORLD_MIN - 80} width={WORLD_MAX - WORLD_MIN + 160} height={WORLD_MAX - WORLD_MIN + 160} fill="url(#bg0)" />
                    <rect x={WORLD_MIN - 80} y={WORLD_MIN - 80} width={WORLD_MAX - WORLD_MIN + 160} height={WORLD_MAX - WORLD_MIN + 160} fill="url(#bg1)" />
                    <rect x={WORLD_MIN - 80} y={WORLD_MIN - 80} width={WORLD_MAX - WORLD_MIN + 160} height={WORLD_MAX - WORLD_MIN + 160} fill="url(#bg2)" />
                    <rect x={WORLD_MIN - 80} y={WORLD_MIN - 80} width={WORLD_MAX - WORLD_MIN + 160} height={WORLD_MAX - WORLD_MIN + 160} fill="url(#bg3)" />

                    {/* ── Star field ─────────────────────────────────────────────── */}
                    <g pointerEvents="none">
                        {STARFIELD.map((s, i) => (
                            <circle key={`star-${i}`} cx={s.x} cy={s.y} r={s.r} fill="white" fillOpacity={s.o} />
                        ))}
                    </g>

                    {/* ── Radial sector spokes (very faint, match in-game chart) ──── */}
                    <g opacity={overviewLayerOpacity * 0.35} pointerEvents="none">
                        {sectorSpokes.map((s, idx) => (
                            <line
                                key={`spoke-${idx}`}
                                x1={MAP_CENTER.x}
                                y1={MAP_CENTER.y}
                                x2={s.x2}
                                y2={s.y2}
                                stroke="rgba(100,160,240,0.22)"
                                strokeWidth={lineStroke * 0.6}
                                strokeDasharray="1.2 2.4"
                            />
                        ))}
                    </g>

                    {/* ── Orbital rings (dashed, fade with zoom) ─────────────────── */}
                    <g opacity={overviewLayerOpacity * 0.6} pointerEvents="none">
                        {orbitRings.map((r, idx) => (
                            <circle
                                key={`ring-${idx}`}
                                cx={MAP_CENTER.x}
                                cy={MAP_CENTER.y}
                                r={r}
                                fill="none"
                                stroke="rgba(80,130,220,0.22)"
                                strokeWidth={lineStroke * 0.75}
                                strokeDasharray="0.9 1.8"
                            />
                        ))}
                    </g>

                    {/* ── Sun at chart centre ─────────────────────────────────────── */}
                    <g pointerEvents="none" opacity={overviewLayerOpacity}>
                        <circle cx={MAP_CENTER.x} cy={MAP_CENTER.y} r={10} fill="url(#sunGlow)" />
                        <circle cx={MAP_CENTER.x} cy={MAP_CENTER.y} r={2.0} fill="rgba(255,252,200,0.98)" />
                    </g>

                    {/* ── Overview: junction connection lines between planets ──────── */}
                    <g opacity={overviewLayerOpacity * 0.55} pointerEvents="none">
                        {junctionEdges.map((e, i) => (
                            <line
                                key={`jline-${i}`}
                                x1={e.from.x} y1={e.from.y}
                                x2={e.to.x}   y2={e.to.y}
                                stroke="rgba(100,160,230,0.55)"
                                strokeWidth={lineStroke * 0.75}
                                strokeDasharray="0.7 1.4"
                            />
                        ))}
                    </g>

                    {/* ── Overview: planet spheres ─────────────────────────────────── */}
                    <g opacity={overviewLayerOpacity}>
                        {overviewPlanets.map((pl) => {
                            const p = pl.planet;
                            const isSelected = p.id === selectedPlanetId;
                            const gId = planetGradId(p.id);

                            const imgUrl = planetImgUrl(p.id);
                            return (
                                <g
                                    key={p.id}
                                    data-clickable="true"
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Select ${p.name}`}
                                    aria-pressed={isSelected}
                                    onClick={() => onClickPlanet(p.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            onClickPlanet(p.id);
                                        }
                                    }}
                                    style={{ cursor: "pointer" }}
                                >
                                    {/* Selection ring — neutral white, no color fill */}
                                    {isSelected && (
                                        <circle cx={pl.x} cy={pl.y} r={pl.r * 1.45} fill="none" stroke="rgba(226,232,240,0.90)" strokeWidth={circleStroke * 1.1} />
                                    )}
                                    {/* Sphere — planet image if available, gradient fallback */}
                                    {imgUrl ? (
                                        <image
                                            href={imgUrl}
                                            x={pl.x - pl.r} y={pl.y - pl.r}
                                            width={pl.r * 2} height={pl.r * 2}
                                            preserveAspectRatio="xMidYMid meet"
                                            mask="url(#sphereVignetteMask)"
                                        />
                                    ) : (
                                        <circle cx={pl.x} cy={pl.y} r={pl.r} fill={`url(#${gId})`} stroke="rgba(180,200,230,0.55)" strokeWidth={circleStroke} />
                                    )}
                                </g>
                            );
                        })}
                    </g>

                    {/* Zoomed-in layer: all planets expanded + nodes inside each */}
                    {reveal > 0.01 && (
                        <g>
                            {zoomedPlanetLayers.map((zl) => {
                                const pid = zl.planet.id as PlanetId;

                                const zGId = planetGradId(pid);
                                // Dark overlay fades in as you zoom in so mission nodes stay readable.
                                const diskAlpha = clamp(reveal * 1.6, 0, 1);
                                return (
                                    <g key={`zl-${zl.planet.id}`}>
                                        <g
                                            data-clickable="true"
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Select ${zl.planet.name}`}
                                            aria-pressed={selectedPlanetId === pid}
                                            onClick={() => onClickPlanet(pid)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    onClickPlanet(pid);
                                                }
                                            }}
                                            style={{ cursor: "pointer" }}
                                        >
                                            {/* Planet image grows with grownR — gradient fallback for unmapped planets */}
                                            {(() => {
                                                const imgUrl = planetImgUrl(pid);
                                                return imgUrl ? (
                                                    <image
                                                        href={imgUrl}
                                                        x={zl.cx - zl.grownR} y={zl.cy - zl.grownR}
                                                        width={zl.grownR * 2} height={zl.grownR * 2}
                                                        preserveAspectRatio="xMidYMid meet"
                                                        mask="url(#sphereVignetteMask)"
                                                    />
                                                ) : (
                                                    <circle cx={zl.cx} cy={zl.cy} r={zl.grownR} fill={`url(#${zGId})`} />
                                                );
                                            })()}
                                            {/* Very subtle dark tint — just enough to lift node text without hiding the image */}
                                            <circle cx={zl.cx} cy={zl.cy} r={zl.grownR} fill="rgba(1,4,18,0.28)" fillOpacity={diskAlpha} />
                                        </g>

                                        <g pointerEvents={canInteractPlanetNodes ? "auto" : "none"} opacity={clamp(reveal * 3.0, 0, 1)}>
                                            <g opacity={0.90}>
                                                {zl.links.map((l, idx) => {
                                                    const isSelectedA = selectedGroupKey === l.a.group.key && selectedPlanetId === pid;
                                                    const isSelectedB = selectedGroupKey === l.b.group.key && selectedPlanetId === pid;
                                                    const hi = isSelectedA || isSelectedB;

                                                    // Expand normalized coords to world space
                                                    const ax1 = zl.cx + l.a.ncx * zl.grownR;
                                                    const ay1 = zl.cy + l.a.ncy * zl.grownR;
                                                    const ax2 = zl.cx + l.b.ncx * zl.grownR;
                                                    const ay2 = zl.cy + l.b.ncy * zl.grownR;
                                                    return (
                                                        <line
                                                            key={`ln-${zl.planet.id}-${idx}`}
                                                            x1={ax1} y1={ay1}
                                                            x2={ax2} y2={ay2}
                                                            stroke={hi ? "rgba(255,255,255,0.75)" : "rgba(200,215,235,0.38)"}
                                                            strokeWidth={hi ? lineStrokeHi : lineStroke}
                                                        />
                                                    );
                                                })}
                                            </g>

                                            {zl.layouts.map((nd) => {
                                                const isActive = selectedPlanetId === pid && selectedGroupKey === nd.group.key;
                                                const isCompleted = Boolean(effectiveNodeCompletedMap[nd.group.baseNodeId]);
                                                const isAvailable = !isCompleted && unlockedPlanetIds.has(String(pid));
                                                const isLocked = !isCompleted && !isAvailable;

                                                // 3-state: active > completed (grey) > available (blue) > locked
                                                const nodeFill = isActive
                                                    ? "rgba(255,255,255,0.18)"
                                                    : isCompleted
                                                        ? "rgba(51,65,85,0.50)"
                                                        : isAvailable
                                                            ? "rgba(59,130,246,0.10)"
                                                            : "rgba(1,4,18,0.35)";
                                                const nodeStrokeCol = isActive
                                                    ? "rgba(255,255,255,0.95)"
                                                    : isCompleted
                                                        ? "rgba(148,163,184,0.70)"
                                                        : isAvailable
                                                            ? "rgba(147,197,253,0.85)"
                                                            : "rgba(100,116,139,0.45)";

                                                // Expand normalized coords to world space
                                                const acx = zl.cx + nd.ncx * zl.grownR;
                                                const acy = zl.cy + nd.ncy * zl.grownR;
                                                const r = nodeDotR;

                                                // Shape by nodeType (locked nodes always show padlock)
                                                let shape: ReactNode;
                                                if (isLocked) {
                                                    const lk = r * 1.05;
                                                    shape = (
                                                        <g>
                                                            <path
                                                                d={`M ${acx - lk*0.45},${acy - lk*0.05} L ${acx - lk*0.45},${acy - lk*0.62} A ${lk*0.45},${lk*0.45} 0 0,1 ${acx + lk*0.45},${acy - lk*0.62} L ${acx + lk*0.45},${acy - lk*0.05}`}
                                                                fill="none" stroke={nodeStrokeCol} strokeWidth={nodeStroke * 1.1} strokeLinecap="round"
                                                            />
                                                            <rect x={acx - lk*0.65} y={acy - lk*0.12} width={lk*1.3} height={lk*1.05} rx={lk*0.18}
                                                                fill={nodeFill} stroke={nodeStrokeCol} strokeWidth={nodeStroke} />
                                                            <circle cx={acx} cy={acy + lk*0.25} r={lk*0.18} fill={nodeStrokeCol} />
                                                        </g>
                                                    );
                                                } else {
                                                    switch (nd.group.nodeType) {
                                                        case "junction": {
                                                            // Diamond outline + right-pointing arrow (matches in-game icon)
                                                            const jd = r * 1.35;
                                                            const arrowPts = `${acx - r*0.42},${acy - r*0.60} ${acx + r*0.68},${acy} ${acx - r*0.42},${acy + r*0.60}`;
                                                            shape = (
                                                                <g>
                                                                    <polygon points={`${acx},${acy-jd} ${acx+jd},${acy} ${acx},${acy+jd} ${acx-jd},${acy}`}
                                                                        fill="rgba(8,16,36,0.75)" stroke={nodeStrokeCol} strokeWidth={nodeStroke} />
                                                                    <polygon points={arrowPts} fill={nodeStrokeCol} />
                                                                </g>
                                                            );
                                                            break;
                                                        }
                                                        case "boss": {
                                                            // 5-pointed star — assassination/boss encounter
                                                            const bPts = Array.from({length: 10}, (_, i) => {
                                                                const a = (i * Math.PI / 5) - Math.PI / 2;
                                                                const rr = i % 2 === 0 ? r * 1.2 : r * 0.5;
                                                                return `${acx + Math.cos(a) * rr},${acy + Math.sin(a) * rr}`;
                                                            }).join(" ");
                                                            shape = <polygon points={bPts} fill={nodeFill} stroke={nodeStrokeCol} strokeWidth={nodeStroke} />;
                                                            break;
                                                        }
                                                        case "quest": {
                                                            // Upward triangle — story/quest mission
                                                            const qPts = `${acx},${acy - r*1.2} ${acx + r*1.1},${acy + r*0.75} ${acx - r*1.1},${acy + r*0.75}`;
                                                            shape = <polygon points={qPts} fill={nodeFill} stroke={nodeStrokeCol} strokeWidth={nodeStroke} />;
                                                            break;
                                                        }
                                                        case "hub": {
                                                            // Two circles — relay/social hub
                                                            shape = (
                                                                <g>
                                                                    <circle cx={acx - r*0.38} cy={acy - r*0.1} r={r*0.42} fill={nodeFill} stroke={nodeStrokeCol} strokeWidth={nodeStroke * 0.9} />
                                                                    <circle cx={acx + r*0.38} cy={acy - r*0.1} r={r*0.42} fill={nodeFill} stroke={nodeStrokeCol} strokeWidth={nodeStroke * 0.9} />
                                                                </g>
                                                            );
                                                            break;
                                                        }
                                                        case "special": {
                                                            // Octagon — one-off unique node
                                                            const oPts = Array.from({length: 8}, (_, i) => {
                                                                const a = (i * Math.PI / 4) - Math.PI / 8;
                                                                return `${acx + Math.cos(a) * r*1.05},${acy + Math.sin(a) * r*1.05}`;
                                                            }).join(" ");
                                                            shape = <polygon points={oPts} fill={nodeFill} stroke={nodeStrokeCol} strokeWidth={nodeStroke} />;
                                                            break;
                                                        }
                                                        default: {
                                                            // Diamond — standard mission
                                                            const dPts = `${acx},${acy - r} ${acx + r},${acy} ${acx},${acy + r} ${acx - r},${acy}`;
                                                            shape = <polygon points={dPts} fill={nodeFill} stroke={nodeStrokeCol} strokeWidth={nodeStroke} />;
                                                        }
                                                    }
                                                }

                                                return (
                                                    <g
                                                        key={`nd-${zl.planet.id}-${nd.group.key}`}
                                                        data-clickable="true"
                                                        role="button"
                                                        tabIndex={canInteractPlanetNodes ? 0 : -1}
                                                        aria-label={`${nd.group.displayName} on ${zl.planet.name}`}
                                                        aria-pressed={selectedGroupKey === nd.group.key && selectedPlanetId === pid}
                                                        onClick={() => onClickGroup(pid, nd.group)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === "Enter" || event.key === " ") {
                                                                event.preventDefault();
                                                                onClickGroup(pid, nd.group);
                                                            }
                                                        }}
                                                        style={{ cursor: "pointer" }}
                                                    >
                                                        <circle cx={acx} cy={acy} r={nodeDotR * 2} fill="transparent" />
                                                        {shape}
                                                    </g>
                                                );
                                            })}
                                        </g>
                                    </g>
                                );
                            })}
                        </g>
                    )}
                </svg>

                <div className="pointer-events-none absolute inset-0 z-30">
                    {overviewPlanetLabelScreens.filter((p) => !isCompactPlanetMap || p.id === selectedPlanetId).map((p) => (
                        <div
                            key={`pllbl-${p.id}`}
                            className={[
                                "wf-starchart-label absolute uppercase",
                                isCompactPlanetMap ? "text-[9px] tracking-[0.12em]" : "text-[11px] tracking-[0.35em]",
                            ].join(" ")}
                            style={{
                                left: p.x,
                                top: p.y,
                                // Selected planet label stays fully visible as overview fades
                                opacity: p.id === selectedPlanetId ? 1 : p.opacity,
                                transform: "translate(-50%, -50%)",
                                textShadow: "-1px -1px 0 rgba(0,0,0,0.95), 1px -1px 0 rgba(0,0,0,0.95), -1px 1px 0 rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {p.text}
                        </div>
                    ))}

                    {zoomedPlanetLabelScreens.filter((p) => !isCompactPlanetMap || p.id === selectedPlanetId).map((p) => (
                        <div
                            key={`zpl-${p.id}`}
                            className={[
                                "wf-starchart-label absolute font-semibold uppercase",
                                isCompactPlanetMap ? "text-[10px] tracking-[0.14em]" : "text-[12px] tracking-[0.35em]",
                            ].join(" ")}
                            style={{
                                left: p.x,
                                top: p.y,
                                // Selected planet label stays fully visible as zoom reveal fades
                                opacity: p.id === selectedPlanetId ? 1 : p.opacity,
                                transform: "translate(-50%, -50%)",
                                textShadow: "-1px -1px 0 rgba(0,0,0,0.95), 1px -1px 0 rgba(0,0,0,0.95), -1px 1px 0 rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {p.text}
                        </div>
                    ))}

                    {canInteractPlanetNodes &&
                        !isDragging &&
                        nodeLabelScreens.map((l) => (
                            <div
                                key={`lbl-${l.key}`}
                                className="wf-starchart-label absolute text-[11px] uppercase tracking-[0.22em]"
                                style={{
                                    left: l.x,
                                    top: l.y,
                                    opacity: clamp(reveal * 3.0, 0, 1),
                                    transform: l.anchor === "end" ? "translate(-100%, -50%)" : "translate(0%, -50%)",
                                    textShadow: "-1px -1px 0 rgba(0,0,0,0.95), 1px -1px 0 rgba(0,0,0,0.95), -1px 1px 0 rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {l.text}
                            </div>
                        ))}
                </div>

                {/* ── Bottom-right controls: Legend + Help ────────────────────── */}
                <div className="absolute bottom-3 right-3 z-30 flex items-end gap-2">
                    {/* Collapsible legend panel */}
                    <div className="flex flex-col items-end gap-2">
                        {showLegend && (
                            <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-xs text-slate-300 backdrop-blur-sm">
                                <div className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">Node Types</div>
                                {([
                                    { label: "Mission",  desc: "Standard mission",           shape: "diamond"  },
                                    { label: "Junction", desc: "Unlocks next planet",        shape: "junction" },
                                    { label: "Boss",     desc: "Assassination encounter",    shape: "boss"     },
                                    { label: "Quest",    desc: "Story mission",              shape: "quest"    },
                                    { label: "Hub",      desc: "Relay / social hub",         shape: "hub"      },
                                    { label: "Special",  desc: "Unique one-off node",        shape: "special"  },
                                ] as const).map(({ label, desc, shape }) => (
                                    <div key={label} className="flex items-center gap-2.5 py-0.5">
                                        <svg width="18" height="18" viewBox="-9 -9 18 18" className="shrink-0">
                                            {shape === "diamond"  && <polygon points="0,-6 6,0 0,6 -6,0" fill="rgba(147,197,253,0.10)" stroke="rgba(147,197,253,0.85)" strokeWidth="1.2" />}
                                            {shape === "junction" && <>
                                                <polygon points="0,-6.5 6.5,0 0,6.5 -6.5,0" fill="rgba(10,20,50,0.75)" stroke="rgba(147,197,253,0.85)" strokeWidth="1.2" />
                                                <polygon points="-2.8,-3.5 4,0 -2.8,3.5" fill="rgba(147,197,253,0.85)" />
                                            </>}
                                            {shape === "boss"     && (() => {
                                                const pts = Array.from({length:10},(_,i)=>{const a=(i*Math.PI/5)-Math.PI/2,rr=i%2===0?7:3;return `${Math.cos(a)*rr},${Math.sin(a)*rr}`;}).join(" ");
                                                return <polygon points={pts} fill="rgba(147,197,253,0.10)" stroke="rgba(147,197,253,0.85)" strokeWidth="1.2" />;
                                            })()}
                                            {shape === "quest"    && <polygon points="0,-7 6.5,4.5 -6.5,4.5" fill="rgba(147,197,253,0.10)" stroke="rgba(147,197,253,0.85)" strokeWidth="1.2" />}
                                            {shape === "hub"      && <>
                                                <circle cx="-2.5" cy="-0.5" r="3" fill="rgba(147,197,253,0.10)" stroke="rgba(147,197,253,0.85)" strokeWidth="1.1" />
                                                <circle cx="2.5"  cy="-0.5" r="3" fill="rgba(147,197,253,0.10)" stroke="rgba(147,197,253,0.85)" strokeWidth="1.1" />
                                            </>}
                                            {shape === "special"  && (() => {
                                                const pts = Array.from({length:8},(_,i)=>{const a=(i*Math.PI/4)-Math.PI/8;return `${Math.cos(a)*6},${Math.sin(a)*6}`;}).join(" ");
                                                return <polygon points={pts} fill="rgba(147,197,253,0.10)" stroke="rgba(147,197,253,0.85)" strokeWidth="1.2" />;
                                            })()}
                                        </svg>
                                        <div>
                                            <span className="font-semibold text-slate-200">{label}</span>
                                            <span className="ml-1.5 text-slate-500">{desc}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="mt-2 border-t border-slate-800 pt-2">
                                    <div className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-500">Completion</div>
                                    {([
                                        { label: "Available",  stroke: "rgba(147,197,253,0.85)", fill: "rgba(59,130,246,0.10)"  },
                                        { label: "Completed",  stroke: "rgba(148,163,184,0.70)", fill: "rgba(51,65,85,0.50)"    },
                                        { label: "Locked",     stroke: "rgba(100,116,139,0.45)", fill: "rgba(1,4,18,0.35)"      },
                                    ] as const).map(({ label, stroke, fill }) => (
                                        <div key={label} className="flex items-center gap-2.5 py-0.5">
                                            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border" style={{ borderColor: stroke, background: fill }} />
                                            <span className="text-slate-300">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button
                            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm hover:bg-slate-900/80 transition-colors"
                            onClick={() => setShowLegend((v) => !v)}
                        >
                            {showLegend ? "Hide Legend" : "Legend"}
                        </button>
                    </div>

                    {/* Help tooltip — replaces the always-visible hint bar */}
                    <div className="group relative">
                        <button className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 text-xs text-slate-400 backdrop-blur-sm hover:bg-slate-900/80 transition-colors">
                            ?
                        </button>
                        <div className="wf-popover pointer-events-none absolute bottom-full right-0 mb-2 hidden w-72 rounded-xl border px-3 py-2 text-xs leading-relaxed backdrop-blur-sm group-hover:block">
                            Drag to pan · Scroll to zoom · Click a planet to zoom in · Zoom in to expand planets and reveal nodes · Click a node to see drops · Click again to deselect
                        </div>
                    </div>
                </div>

                <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm">
                        {Math.round(scale * 100)}%
                    </div>

                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                        onClick={() => {
                            const center = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
                            setVb((prev) => vbZoomAt(prev, center, 1 / 1.10));
                        }}
                        title="Zoom In"
                    >
                        +
                    </button>

                    <button
                        className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                        onClick={() => {
                            const center = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
                            setVb((prev) => vbZoomAt(prev, center, 1.10));
                        }}
                        title="Zoom Out"
                    >
                        −
                    </button>

                    {focusedTitle && (
                        <div className="ml-2 hidden items-center gap-2 sm:flex">
                            <div className="text-xs text-slate-400">{focusedTitle}</div>
                            {selectedPlanetId && (() => {
                                const ids = (groupedByPlanet.get(selectedPlanetId) ?? []).map((g) => g.baseNodeId);
                                const allDone = ids.every((id) => effectiveNodeCompletedMap[id]);
                                return (
                                    <button
                                        className="rounded border border-slate-700 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                                        title="Toggle completion for all nodes on this planet"
                                        onClick={() => activeSetBulkNodesCompleted(ids, !allDone)}
                                    >
                                        {allDone ? "Unmark all" : "Mark all complete"}
                                    </button>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* ── Alternative map buttons (top-right) ─────────────────── */}
                {!hideAlternateMaps && <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
                    {/* Railjack / Proxima */}
                    <button
                        className="group flex h-14 w-14 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-slate-600 bg-slate-950/80 backdrop-blur-sm hover:border-cyan-500/60 hover:bg-slate-900/90 transition-colors"
                        title="Open Railjack / Proxima map"
                        onClick={() => setMainMapMode("proxima")}
                    >
                        {/* Railjack silhouette */}
                        <svg width="32" height="20" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300 group-hover:text-cyan-300 transition-colors">
                            <path d="M16 2 L30 11 L24 12 L22 18 L16 13 L10 18 L8 12 L2 11 Z" stroke="currentColor" strokeWidth="1.2" fill="rgba(100,180,255,0.08)"/>
                            <line x1="16" y1="2" x2="16" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
                        </svg>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 group-hover:text-cyan-300 transition-colors">Proxima</span>
                    </button>

                    {/* Duviri */}
                    <button
                        className="group flex h-14 w-14 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-slate-600 bg-slate-950/80 backdrop-blur-sm hover:border-purple-500/60 hover:bg-slate-900/90 transition-colors"
                        title="Open Duviri map"
                        onClick={() => setMainMapMode("duviri")}
                    >
                        {/* Duviri mask silhouette */}
                        <svg width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300 group-hover:text-purple-300 transition-colors">
                            <path d="M11 2 C6 2 2 6 2 11 C2 16 5 20 9 21 L9 23 L13 23 L13 21 C17 20 20 16 20 11 C20 6 16 2 11 2 Z" stroke="currentColor" strokeWidth="1.2" fill="rgba(180,100,255,0.08)"/>
                            <path d="M7 10 C7 9 8 8.5 9 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                            <path d="M15 10 C15 9 14 8.5 13 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                            <path d="M8 13 Q11 15.5 14 13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none"/>
                            <line x1="4"  y1="8"  x2="2"  y2="6"  stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                            <line x1="18" y1="8"  x2="20" y2="6"  stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 group-hover:text-purple-300 transition-colors">Duviri</span>
                    </button>
                </div>}
            </div>
        </div>
    );
}
