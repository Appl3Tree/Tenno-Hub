// Map constants, visual data, math utilities, and node-grouping logic for the
// Star Chart feature.  This module is intentionally free of React — it only
// contains plain data and pure functions so it can be imported by any view
// component without pulling in the rendering layer.

import { STAR_CHART_DATA } from "../../domain/catalog/starChart";
import type { NodeId, PlanetId, StarChartNode, StarChartPlanet } from "../../domain/models/starChart";
import { getDropSourcesForStarChartNode } from "../../domain/catalog/starChart/nodeDropSourceMap";
import { SOURCE_INDEX } from "../../catalog/sources/sourceCatalog";
import { formatSourceDisplayLabel } from "../../utils/sourceLabels";
import type { ItemRow } from "./starChartUtils";
import { safeNormalizeSourceId, itemNameKey, dedupeItemsByName } from "./starChartUtils";

// Re-export domain types that consumers need, so they only need one import.
export type { NodeId, PlanetId, StarChartNode, StarChartPlanet };

// ── Shared empty map (avoids creating new objects on every render) ────────────
export const EMPTY_NODE_COMPLETED: Record<string, boolean> = {};

// ── Vor's Prize implied completions ──────────────────────────────────────────
// Completing Vor's Prize clears these early tutorial mission nodes. The Venus
// and Mercury Junctions remain separate gates and are not implied completions.
// Shared by StarChartMap and StarChartListView so the logic stays in sync.
export const VORS_PRIZE_IMPLIES_COMPLETED: Record<string, true> = {
    "node:mr/earth/e-prime":       true,
    "node:mr/earth/mariana":       true,
    "node:mr/earth/mantle":        true,
    "node:mr/earth/gaia":          true,
    "node:mr/earth/pacific":       true,
    "node:mr/earth/cambria":       true,
    "node:hub/earth/strata-relay": true,
};

// ── Math utilities ────────────────────────────────────────────────────────────

export function hashToUnitFloat(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

export function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function smoothstep01(t: number): number {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

// ── Planet image map ──────────────────────────────────────────────────────────

type ManualPos = { x: number; y: number };

// Map planet/region IDs → the webp filename in /public/planets/
export const PLANET_IMAGES: Record<string, string> = {
    "planet:mercury":       "Mercury.webp",
    "planet:venus":         "Venus.webp",
    "planet:earth":         "Earth.webp",
    "planet:mars":          "Mars.webp",
    "planet:phobos":        "Phobos.webp",
    "planet:deimos":        "Deimos.webp",
    "planet:ceres":         "Ceres.webp",
    "planet:jupiter":       "Jupiter.webp",
    "planet:europa":        "Europa.webp",
    "planet:saturn":        "Saturn.webp",
    "planet:uranus":        "Uranus.webp",
    "planet:neptune":       "Neptune.webp",
    "planet:pluto":         "Pluto.webp",
    "planet:sedna":         "Sedna.webp",
    "planet:eris":          "Eris.webp",
    "region:void":          "Void.webp",
    "region:lua":           "Lua.webp",
    "region:kuva_fortress": "Kuva_Fortress.webp",
    "region:zariman":       "New_Zariman.webp",
    "region:earth_proxima":   "Earth.webp",
    "region:venus_proxima":   "Venus.webp",
    "region:saturn_proxima":  "Saturn.webp",
    "region:neptune_proxima": "Neptune.webp",
    "region:pluto_proxima":   "Pluto.webp",
    "region:veil_proxima":    "Kuva_Fortress.webp",
};

// Returns the URL for a planet's image, or null if not mapped.
// Uses Vite's BASE_URL so it works in both dev (/) and production (/Warframe-Progression-Tracker/).
export function planetImgUrl(planetId: string): string | null {
    const file = PLANET_IMAGES[planetId];
    if (!file) return null;
    return `${import.meta.env.BASE_URL}planets/${file}`;
}

export const MANUAL_POS: Record<string, ManualPos> = {
    // Positions matched against the in-game star chart screenshot.
    // Coordinate space: 0–100 before MAP_POS_SCALE is applied, origin top-left.

    // Far left
    "region:void":    { x: 14, y: 44 },
    "region:zariman": { x: 13, y: 29 },

    // Top cluster (inner system / Grineer territory)
    "planet:sedna":  { x: 51, y: 10 },
    "planet:ceres":  { x: 41, y: 26 },
    "planet:phobos": { x: 65, y: 22 },
    "planet:mars":   { x: 60, y: 29 },
    "planet:eris":   { x: 75, y: 29 },

    // Mid left
    "planet:europa":  { x: 25, y: 46 },
    "planet:jupiter": { x: 33, y: 43 },

    // Mid centre
    "planet:deimos":  { x: 55, y: 33 },

    // Mid right — Earth/Lua/Pluto band
    "planet:earth":   { x: 63, y: 46 },
    "region:lua":     { x: 68, y: 47 },
    "planet:pluto":   { x: 83, y: 47 },

    // Lower centre
    "planet:mercury": { x: 45, y: 55 },
    "planet:venus":   { x: 55, y: 62 },

    // Lower right
    "planet:neptune": { x: 73, y: 73 },

    // Lower left
    "planet:saturn":  { x: 37, y: 70 },

    // Bottom centre
    "planet:uranus":  { x: 50, y: 81 },

    // Kuva Fortress: orbit anchor — x/y ignored, position computed from MAP_CENTER.
    "region:kuva_fortress": { x: 50, y: 50 },

    // Proxima regions — arc left to right matching in-game Railjack nav order
    "region:earth_proxima":   { x: 20, y: 50 },
    "region:venus_proxima":   { x: 35, y: 30 },
    "region:saturn_proxima":  { x: 50, y: 50 },
    "region:neptune_proxima": { x: 65, y: 30 },
    "region:pluto_proxima":   { x: 70, y: 60 },
    "region:veil_proxima":    { x: 83, y: 45 },
};

export function isInMainMap(p: StarChartPlanet): boolean {
    if (p.kind === "hub") return false;

    if (p.id === "region:duviri") return false;
    if (p.id.endsWith("_proxima")) return false;
    if (p.id === "region:dark_refractory_deimos") return false;
    if (p.id === "auto:sanctuary") return false;
    if (p.id === "region:hollvania") return false;

    if (p.id === "region:zariman") return true;
    if (p.id === "region:void") return true;
    if (p.id === "region:lua") return true;
    if (p.id === "region:kuva_fortress") return true;

    return p.kind === "planet";
}

// ── ViewBox and world space ───────────────────────────────────────────────────

export type ViewBox = { x: number; y: number; w: number; h: number };

// World bounds — large enough that expanded planet disks never clip at the edges.
export const WORLD_MIN = -160;
export const WORLD_MAX = 260;

// Kuva Fortress completes its route every ~50 hours.
export const KUVA_PERIOD_MS = 50 * 3600 * 1000;
export const KUVA_RAD_PER_MS = (Math.PI * 2) / KUVA_PERIOD_MS;

// Scale from 0-100 manual space to world space.  Reduced from 5.0 → 3.5 so
// planets appear as compactly clustered as the in-game star chart rather than
// spread across the full canvas with large empty gaps.
export const MAP_POS_SCALE = 3.5;
export const MAP_CENTER = { x: 50, y: 50 };

export function mapScalePos(p: { x: number; y: number }): { x: number; y: number } {
    const dx = p.x - MAP_CENTER.x;
    const dy = p.y - MAP_CENTER.y;
    return { x: MAP_CENTER.x + dx * MAP_POS_SCALE, y: MAP_CENTER.y + dy * MAP_POS_SCALE };
}

// ── Planet visual palette ─────────────────────────────────────────────────────
// Colours match Warframe's in-game appearance as closely as possible.
// `light` = sphere highlight, `base` = midtone, `dark` = shadow, `glow` = halo fill.
export const PLANET_COLORS: Record<string, { base: string; light: string; dark: string; glow: string }> = {
    "planet:mercury":        { base: "#9c9090", light: "#d8d0cc", dark: "#3e3030", glow: "rgba(180,160,160,0.40)" },
    "planet:venus":          { base: "#d09c30", light: "#f0cc70", dark: "#705010", glow: "rgba(220,170,50,0.50)" },
    "planet:earth":          { base: "#2868d0", light: "#60a8f8", dark: "#0a1e5c", glow: "rgba(50,120,240,0.55)" },
    "planet:mars":           { base: "#c84028", light: "#f07060", dark: "#600808", glow: "rgba(220,70,40,0.55)" },
    "planet:deimos":         { base: "#9a6040", light: "#c49070", dark: "#401808", glow: "rgba(170,100,60,0.40)" },
    "planet:phobos":         { base: "#706898", light: "#a098c8", dark: "#282048", glow: "rgba(120,110,180,0.40)" },
    "planet:ceres":          { base: "#5888a0", light: "#80b8d0", dark: "#183040", glow: "rgba(80,150,190,0.45)" },
    "planet:jupiter":        { base: "#c07838", light: "#eaa868", dark: "#603010", glow: "rgba(210,140,60,0.50)" },
    "planet:europa":         { base: "#78c0e8", light: "#b8e0f8", dark: "#103860", glow: "rgba(120,200,240,0.55)" },
    "planet:saturn":         { base: "#c8a030", light: "#f0c860", dark: "#604808", glow: "rgba(220,175,50,0.50)" },
    "planet:uranus":         { base: "#40b8c8", light: "#70dae8", dark: "#084850", glow: "rgba(60,190,210,0.50)" },
    "planet:neptune":        { base: "#183cb8", light: "#4070e8", dark: "#080e50", glow: "rgba(30,80,220,0.55)" },
    "planet:pluto":          { base: "#887060", light: "#b09080", dark: "#302018", glow: "rgba(150,130,110,0.38)" },
    "planet:sedna":          { base: "#c03848", light: "#f06878", dark: "#601018", glow: "rgba(210,60,70,0.50)" },
    "planet:eris":           { base: "#7030b8", light: "#a060e0", dark: "#300858", glow: "rgba(130,50,200,0.50)" },
    "region:lua":            { base: "#b0b0c0", light: "#e0e0f0", dark: "#404050", glow: "rgba(200,200,220,0.50)" },
    "region:kuva_fortress":  { base: "#b82020", light: "#e05050", dark: "#580808", glow: "rgba(200,40,40,0.60)" },
    "region:void":           { base: "#6840c0", light: "#9870e8", dark: "#200858", glow: "rgba(120,80,210,0.50)" },
    "region:zariman":        { base: "#b88820", light: "#e0b050", dark: "#583808", glow: "rgba(200,150,40,0.50)" },
    "region:duviri":         { base: "#607090", light: "#88a0c0", dark: "#182030", glow: "rgba(100,130,170,0.40)" },
    "region:sanctuary":      { base: "#409880", light: "#68c8a8", dark: "#104028", glow: "rgba(60,170,140,0.45)" },
    "region:hollvania":      { base: "#507060", light: "#789090", dark: "#182820", glow: "rgba(80,120,100,0.38)" },
    "region:dark_refractory_deimos": { base: "#806048", light: "#b09070", dark: "#302010", glow: "rgba(150,110,80,0.38)" },
};
export const DEFAULT_PLANET_COLOR = { base: "#507090", light: "#80a0c0", dark: "#182030", glow: "rgba(80,120,170,0.40)" };

export function planetGradId(planetId: string): string {
    return `pg_${String(planetId).replace(/[^a-z0-9]/gi, "_")}`;
}

// Stable star field (precomputed at module load so it never flickers).
export const STARFIELD: Array<{ x: number; y: number; r: number; o: number }> = (() => {
    const out: Array<{ x: number; y: number; r: number; o: number }> = [];
    let s = 0xf3a1b5c7;
    const rand = () => {
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        return (s >>> 0) / 4294967296;
    };
    for (let i = 0; i < 200; i++) {
        out.push({
            x: WORLD_MIN - 15 + rand() * (WORLD_MAX - WORLD_MIN + 30),
            y: WORLD_MIN - 15 + rand() * (WORLD_MAX - WORLD_MIN + 30),
            r: 0.08 + rand() * 0.24,
            o: 0.15 + rand() * 0.72,
        });
    }
    return out;
})();

// ── ViewBox helpers ───────────────────────────────────────────────────────────

export function clampViewBox(vb: ViewBox): ViewBox {
    const margin = 10;

    // Allow MUCH deeper zoom-in than before.
    // scale = 100 / vb.w, so vb.w=3 => ~3333% max.
    const minW = 3;
    const maxW = WORLD_MAX - WORLD_MIN + margin * 2;

    const w = clamp(vb.w, minW, maxW);
    const h = clamp(vb.h, minW, maxW);

    const minX = WORLD_MIN - margin;
    const minY = WORLD_MIN - margin;
    const maxX = WORLD_MAX + margin - w;
    const maxY = WORLD_MAX + margin - h;

    const x = clamp(vb.x, minX, maxX);
    const y = clamp(vb.y, minY, maxY);

    return { x, y, w, h };
}

export function vbZoomAt(vb: ViewBox, worldPt: { x: number; y: number }, zoomFactor: number): ViewBox {
    const nextW = vb.w * zoomFactor;
    const nextH = vb.h * zoomFactor;

    const rx = (worldPt.x - vb.x) / vb.w;
    const ry = (worldPt.y - vb.y) / vb.h;

    const nextX = worldPt.x - rx * nextW;
    const nextY = worldPt.y - ry * nextH;

    return clampViewBox({ x: nextX, y: nextY, w: nextW, h: nextH });
}

export function viewBoxToScale(vb: ViewBox): number {
    return 100 / vb.w;
}

export function nodeRevealAlpha(scale: number): number {
    // Wider window (0.9 → 2.5) so the disk grows gradually rather than popping in.
    const a = (scale - 1.55) / 2.5;
    return clamp(a, 0, 1);
}

// ── Planet layout ─────────────────────────────────────────────────────────────

export type PlanetLayout = { planet: StarChartPlanet; x: number; y: number; r: number };

export function getPlanetRadius(p: StarChartPlanet): number {
    if (p.kind === "planet") return 5.5;
    if (p.kind === "region") return 5.0;
    return 4.5;
}

// ── Node grouping ─────────────────────────────────────────────────────────────

export type NodeGroupKind = "all" | "base" | "mission_rewards" | "caches" | "extra" | "other";
export const DEFAULT_NODE_GROUP_TAB: NodeGroupKind = "all";

export type NodeGroup = {
    key: string;
    planetId: PlanetId;
    displayName: string;
    baseNodeId: NodeId;
    nodeType: StarChartNode["nodeType"];
    kinds: Partial<Record<Exclude<NodeGroupKind, "all">, NodeId[]>>;
};

function baseKeyFromNode(n: StarChartNode): string {
    const id = String(n.id);
    const stripId = id.replace(/-\(caches\)$/i, "").replace(/-\(extra\)$/i, "");

    const nm = String(n.name ?? "");
    const stripName = stripTrailingNodeQualifier(nm);

    return `${String(n.planetId)}::${stripId}::${stripName}`;
}

function stripTrailingNodeQualifier(name: string): string {
    return String(name ?? "")
        .replace(/\s*\([^)]*\)\s*$/i, "")
        .trim();
}

export function displayNameFromBase(n: StarChartNode): string {
    return stripTrailingNodeQualifier(String(n.name ?? ""));
}

function parseNodeVariant(n: StarChartNode): { baseKey: string; kind: Exclude<NodeGroupKind, "all"> } {
    const name = (n.name ?? "").toLowerCase();
    const id = String(n.id);

    if (id.includes("-(caches)") || name.includes("(caches)")) return { baseKey: baseKeyFromNode(n), kind: "caches" };
    if (id.includes("-(extra)") || name.includes("(extra)")) return { baseKey: baseKeyFromNode(n), kind: "extra" };
    if (name.includes("(mission rewards)") || name.includes("mission rewards")) return { baseKey: baseKeyFromNode(n), kind: "mission_rewards" };

    return { baseKey: baseKeyFromNode(n), kind: "base" };
}

export function groupPlanetNodesForDisplay(nodes: StarChartNode[]): NodeGroup[] {
    const byKey = new Map<string, NodeGroup>();

    for (const n of nodes) {
        const v = parseNodeVariant(n);
        const key = v.baseKey;

        let g = byKey.get(key) ?? null;
        if (!g) {
            g = {
                key,
                planetId: n.planetId,
                displayName: displayNameFromBase(n),
                baseNodeId: n.id,
                nodeType: n.nodeType,
                kinds: {}
            };
            byKey.set(key, g);
        }

        if (!g!.kinds[v.kind]) g!.kinds[v.kind] = [];
        g!.kinds[v.kind]!.push(n.id);
        if (v.kind === "base") g!.baseNodeId = n.id;
    }

    return [...byKey.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// Node positions are stored as fractions of the disk radius so they remain
// stable regardless of zoom level or the animated grownR.
// Multiply by zl.grownR at render time to get world coordinates.
export type NodeLayout = {
    group: NodeGroup;
    ncx: number; // (node_world_x - planet_cx) / diskR
    ncy: number;
    nlx: number; // (label_world_x - planet_cx) / diskR
    nly: number;
    lAnchor: "start" | "end";
};

// ── Tab specification ─────────────────────────────────────────────────────────

export type TabSpec = {
    kind: NodeGroupKind;
    label: string;
    nodeId: NodeId | null;
    dropSources: string[];
    dropSourceDetails: Array<{ sid: string; label: string }>;
    items: ItemRow[];
};

export function computeItemsForSources(args: { dropSources: string[]; sourceToItemsIndex: Record<string, ItemRow[]> }): ItemRow[] {
    const { dropSources, sourceToItemsIndex } = args;

    const acc: ItemRow[] = [];
    for (const sid of dropSources) {
        const rows = sourceToItemsIndex[sid] ?? [];
        acc.push(...rows);
    }

    // First: dedupe by catalogId (exact duplicates from multiple sources)
    const seenCatalog = new Set<string>();
    const uniqByCatalog: ItemRow[] = [];
    for (const r of acc) {
        if (seenCatalog.has(r.catalogId)) continue;
        seenCatalog.add(r.catalogId);
        uniqByCatalog.push(r);
    }

    // Second: dedupe by display name (collapses "same item" represented by multiple catalogIds)
    const uniqByName = dedupeItemsByName(uniqByCatalog);

    return uniqByName;
}

function tabLabel(kind: NodeGroupKind): string {
    if (kind === "all") return "All";
    if (kind === "base") return "Drops";
    if (kind === "mission_rewards") return "Mission Rewards";
    if (kind === "caches") return "Caches";
    if (kind === "extra") return "Extra";
    return "Other";
}

export function pickNodeIdForTab(group: NodeGroup | null, tab: NodeGroupKind): NodeId | null {
    if (!group) return null;
    if (tab === "all") return group.baseNodeId;

    const ids = group.kinds[tab as Exclude<NodeGroupKind, "all">] ?? [];
    if (ids && ids.length) return ids[0] ?? null;

    if (tab === "base") return group.baseNodeId;

    // For mission_rewards: only fall back to baseNodeId when the group has a real base-kind node.
    // Caches-only nodes (e.g. Dakata) have no base variant — their missionreward data IS their
    // cache data, so we must not show an empty/incorrect Mission Rewards tab for them.
    if (tab === "mission_rewards") {
        const baseIds = group.kinds["base"] ?? [];
        return baseIds.length > 0 ? group.baseNodeId : null;
    }

    return null;
}

function isMissionRewardSourceId(sid: string): boolean {
    return sid.startsWith("data:missionreward/");
}

export function filterSourcesForTab(kind: NodeGroupKind, sids: string[]): string[] {
    if (kind === "mission_rewards") return sids.filter((s) => isMissionRewardSourceId(s));
    if (kind === "caches") return sids;
    if (kind === "all") return sids;
    if (kind === "extra") return sids;
    return sids.filter((s) => !isMissionRewardSourceId(s));
}

/**
 * Mission Rewards relics: collapse variants (Intact/Exceptional/Flawless/Radiant) into just the relic name.
 * BUT: do NOT allow "Lith" (generic era) to appear as a mission reward row.
 */
function missionRewardRelicDisplayName(name: string): string {
    const s0 = String(name ?? "").replace(/\s+/g, " ").trim();
    if (!s0) return s0;

    // If it looks like a relic name, keep ONLY "Era Code" (e.g., "Lith D7"), dropping everything else.
    // This catches: "Lith D7", "Lith D7 Radiant", "Lith D7 (Radiant)", "Lith D7 Relic Radiant", etc.
    const m = s0.match(/\b(Lith|Meso|Neo|Axi)\s+([A-Za-z0-9]{1,6})\b/);
    if (m) {
        const eraRaw = m[1];
        const code = m[2];

        const era = eraRaw.charAt(0).toUpperCase() + eraRaw.slice(1).toLowerCase();
        return `${era} ${code.toUpperCase()}`;
    }

    // If it DOESN'T have an era+code token, don't try to "fix" it into an era.
    // (This is what would otherwise allow generic "Lith" / "Lith Relic" to sneak in.)
    return s0;
}

export function normalizeMissionRewardItemsForDisplay(items: ItemRow[]): ItemRow[] {
    const mapped: ItemRow[] = items.map((it) => ({
        ...it,
        name: missionRewardRelicDisplayName(it.name)
    }));

    // Drop generic era-only mission reward rows: "Lith", "Meso", "Neo", "Axi" and also "* Relic".
    const genericEraOnly = /^(Lith|Meso|Neo|Axi)$/i;
    const genericEraRelic = /^(Lith|Meso|Neo|Axi)\s+Relic$/i;

    const filtered = mapped.filter((it) => {
        const n = it.name.trim();
        if (genericEraOnly.test(n)) return false;
        if (genericEraRelic.test(n)) return false;
        return true;
    });

    // Dedupe after collapsing names.
    return dedupeItemsByName(filtered);
}

export function buildTabSpecRaw(args: { group: NodeGroup; kind: NodeGroupKind; sourceToItemsIndex: Record<string, ItemRow[]>; steelPathMode?: boolean }): TabSpec {
    const { group, kind, sourceToItemsIndex, steelPathMode = false } = args;

    const nodeId = pickNodeIdForTab(group, kind);
    const extraNodeIds = group.kinds["extra"] ?? [];

    const primarySources = !nodeId
        ? []
        : getDropSourcesForStarChartNode(nodeId)
              .map((sid) => safeNormalizeSourceId(sid))
              .filter((x): x is string => Boolean(x));

    let rawSources: string[];
    if (kind === "mission_rewards") {
        if (steelPathMode && extraNodeIds.length > 0) {
            rawSources = extraNodeIds.flatMap((extraId) =>
                getDropSourcesForStarChartNode(extraId)
                    .map((sid) => safeNormalizeSourceId(sid))
                    .filter((x): x is string => Boolean(x))
            );
        } else {
            rawSources = primarySources;
        }
    } else if (kind === "all" && steelPathMode && extraNodeIds.length > 0) {
        const steelPathMissionRewardSources = extraNodeIds.flatMap((extraId) =>
            getDropSourcesForStarChartNode(extraId)
                .map((sid) => safeNormalizeSourceId(sid))
                .filter((x): x is string => Boolean(x))
                .filter((sid) => isMissionRewardSourceId(sid))
        );
        const nonMissionRewardSources = primarySources.filter((sid) => !isMissionRewardSourceId(sid));
        rawSources = [...nonMissionRewardSources, ...steelPathMissionRewardSources];
    } else {
        rawSources = primarySources;
    }

    const dropSources = filterSourcesForTab(kind, rawSources);

    const dropSourceDetails = dropSources.map((sid) => ({
        sid,
        label: formatSourceDisplayLabel(SOURCE_INDEX[sid as any]?.label ?? sid)
    }));

    const items = computeItemsForSources({ dropSources, sourceToItemsIndex });

    return {
        kind,
        label: tabLabel(kind),
        nodeId,
        dropSources,
        dropSourceDetails,
        items
    };
}

export function applyExclusiveAssignment(specs: TabSpec[]): TabSpec[] {
    const byKind = new Map<NodeGroupKind, TabSpec>();
    for (const s of specs) byKind.set(s.kind, s);

    const mr = byKind.get("mission_rewards") ?? null;
    const caches = byKind.get("caches") ?? null;
    const extra = byKind.get("extra") ?? null;
    const base = byKind.get("base") ?? null;
    const all = byKind.get("all") ?? null;

    const mrSetRaw = new Set<string>((mr?.items ?? []).map((x) => itemNameKey(x.name)));
    const cachesSetRaw = new Set<string>((caches?.items ?? []).map((x) => itemNameKey(x.name)));
    const extraSetRaw = new Set<string>((extra?.items ?? []).map((x) => itemNameKey(x.name)));
    const baseSetRaw = new Set<string>((base?.items ?? []).map((x) => itemNameKey(x.name)));

    const cachesSet = new Set<string>();
    for (const k of cachesSetRaw) {
        if (!k) continue;
        cachesSet.add(k);
    }

    const mrSet = new Set<string>();
    for (const k of mrSetRaw) {
        if (!k) continue;
        if (cachesSet.has(k)) continue;
        mrSet.add(k);
    }

    const extraSet = new Set<string>();
    for (const k of extraSetRaw) {
        if (!k) continue;
        if (mrSet.has(k)) continue;
        if (cachesSet.has(k)) continue;
        extraSet.add(k);
    }

    const baseSet = new Set<string>();
    for (const k of baseSetRaw) {
        if (!k) continue;
        if (mrSet.has(k)) continue;
        if (cachesSet.has(k)) continue;
        if (extraSet.has(k)) continue;
        baseSet.add(k);
    }

    function filterItems(items: ItemRow[], keep: Set<string>): ItemRow[] {
        const out = items.filter((x) => keep.has(itemNameKey(x.name)));
        return dedupeItemsByName(out);
    }

    const outSpecs: TabSpec[] = [];

    for (const s of specs) {
        if (s.kind === "mission_rewards") {
            outSpecs.push({ ...s, items: filterItems(s.items, mrSet) });
            continue;
        }
        if (s.kind === "caches") {
            outSpecs.push({ ...s, items: filterItems(s.items, cachesSet) });
            continue;
        }
        if (s.kind === "extra") {
            outSpecs.push({ ...s, items: filterItems(s.items, extraSet) });
            continue;
        }
        if (s.kind === "base") {
            outSpecs.push({ ...s, items: filterItems(s.items, baseSet) });
            continue;
        }
        if (s.kind === "all" && all) {
            outSpecs.push({ ...s, items: dedupeItemsByName(s.items) });
            continue;
        }
        outSpecs.push({ ...s, items: dedupeItemsByName(s.items) });
    }

    return outSpecs;
}

// Re-export STAR_CHART_DATA for convenience so consumers don't need two imports.
export { STAR_CHART_DATA };
