// src/pages/relics/RelicFarming.tsx
import React, { useMemo, useState } from "react";
import { getAllRelics, getRelicByKey, type RelicEntry } from "../../domain/catalog/relicCatalog";
import { getRelicAvailabilityStatus, type RelicAvailabilityStatus } from "../../domain/catalog/relicAvailability";
import { useWorldStateData } from "../../lib/useWorldStateData";
import { isWorldStateEntryActive } from "../../lib/worldStateCache";
import missionRewardsRaw from "../../../external/warframe-drop-data/raw/missionRewards.json";

// Build a static "Planet / Node" → gameMode lookup from the drop data.
// missionRewardsRaw has a single outer key "missionRewards" before the planet map.
const _missionTypeByGroupKey = new Map<string, string>();
{
    const missionRewardsData = (missionRewardsRaw as any).missionRewards as
        Record<string, Record<string, { gameMode?: string }>>;
    for (const [planet, nodes] of Object.entries(missionRewardsData ?? {})) {
        for (const [node, data] of Object.entries(nodes)) {
            if (data?.gameMode) {
                _missionTypeByGroupKey.set(`${planet} / ${node}`, data.gameMode);
            }
        }
    }
}

function getMissionType(groupKey: string): string | undefined {
    return _missionTypeByGroupKey.get(groupKey);
}

const TIER_ORDER = ["Lith", "Meso", "Neo", "Axi"] as const;

const TIER_COLOR: Record<string, string> = {
    Lith: "text-blue-300  border-blue-700/50  bg-blue-950/30",
    Meso: "text-green-300 border-green-700/50 bg-green-950/30",
    Neo:  "text-purple-300 border-purple-700/50 bg-purple-950/30",
    Axi:  "text-amber-300 border-amber-700/50 bg-amber-950/30",
};

type FarmingMode = "max-drops" | "coverage" | "total-chance";

/**
 * null → no limit (show all rotations A, B, C)
 * "A"  → player stops at rotation A (only A drops count)
 * "B"  → player stops at rotation B (A and B drops count — never reaches C)
 */
type RotationLimit = null | "A" | "B";

/**
 * Per-mission-type tooltip text for each rotation label.
 * Helps players understand what in-game milestone each rotation corresponds to.
 */
const ROTATION_TOOLTIPS: Record<string, Record<string, string>> = {
    // ── Standard AABC endless ───────────────────────────────────────────────
    Defense: {
        A: "Waves 3, 6, 15, 18, 27, 30…",
        B: "Waves 9, 21, 33…",
        C: "Waves 12, 24, 36…",
    },
    Survival: {
        A: "5, 10, 25, 30… min",
        B: "15, 35, 55… min",
        C: "20, 40, 60… min",
    },
    Interception: {
        A: "Rounds 1, 2, 5, 6, 9, 10…",
        B: "Rounds 3, 7, 11…",
        C: "Rounds 4, 8, 12…",
    },
    Excavation: {
        A: "Drills 1, 2, 5, 6, 9, 10…",
        B: "Drills 3, 7, 11…",
        C: "Drills 4, 8, 12…",
    },
    Defection: {
        A: "2, 4, 10, 12… squads escorted",
        B: "6, 14… squads escorted",
        C: "8, 16… squads escorted",
    },
    "Infested Salvage": {
        A: "Rounds 1, 2, 5, 6… (manifest decoded)",
        B: "Rounds 3, 7…",
        C: "Rounds 4, 8…",
    },
    "Sanctuary Onslaught": {
        A: "Zones 2, 4, 10, 12…",
        B: "Zones 6, 14…",
        C: "Zones 8, 16…",
    },
    // ── Zariman endless ─────────────────────────────────────────────────────
    "Void Armageddon": {
        A: "Angel kills 1, 2, 5, 6… (every 3 waves + kill)",
        B: "Angel kills 3, 7…",
        C: "Angel kills 4, 8…",
    },
    "Void Cascade": {
        A: "4, 8, 20, 24 Exolizers retired",
        B: "12, 28 Exolizers retired",
        C: "16, 32 Exolizers retired",
    },
    "Void Flood": {
        A: "3, 6, 15, 18 Void Ruptures sealed",
        B: "9, 21 Void Ruptures sealed",
        C: "12, 24 Void Ruptures sealed",
    },
    // ── Höllvania ───────────────────────────────────────────────────────────
    Alchemy: {
        A: "Crucibles 1, 2, 5, 6… (each crucible filled)",
        B: "Crucibles 3, 7…",
        C: "Crucibles 4, 8…",
    },
    "Legacyte Harvest": {
        A: "Legacytes 1, 2, 5, 6… captured",
        B: "Legacytes 3, 7…",
        C: "Legacytes 4, 8…",
    },
    "The Perita Rebellion": {
        A: "Every 3rd order completed (bonus reward)",
        B: "Every order completed",
        C: "Mission completion",
    },
    // ── Disruption (special 2D matrix) ──────────────────────────────────────
    Disruption: {
        A: "Earlier rounds or fewer conduits defended",
        B: "Round 3+ with 2–3 conduits defended",
        C: "Round 3+ with 3–4 conduits defended",
    },
    // ── Non-endless (one reward per objective) ───────────────────────────────
    Spy: {
        A: "1st vault hacked",
        B: "2nd vault hacked",
        C: "3rd vault hacked",
    },
    Caches: {
        A: "1st cache found",
        B: "2nd cache found",
        C: "3rd cache found",
    },
    Sabotage: {
        A: "1st cache found",
        B: "2nd cache found",
        C: "3rd cache found",
    },
    // ── Railjack ────────────────────────────────────────────────────────────
    Skirmish: {
        A: "Runs 1, 2, 5, 6… (AABC cycles across successive runs)",
        B: "Runs 3, 7…",
        C: "Runs 4, 8…",
    },
    // ── Archwing Rush ────────────────────────────────────────────────────────
    Rush: {
        A: "1 transport destroyed",
        B: "2 transports destroyed",
        C: "All 3 transports destroyed",
    },
    // ── Duviri ───────────────────────────────────────────────────────────────
    "The Circuit": {
        A: "Early tiers (1, 3, 4)",
        B: "Mid tiers — includes Warframe parts",
        C: "High tiers — includes Warframe parts & Incarnon",
    },
};

// A single rotation slot within a node (e.g. Rot A, Rot C)
interface RotationEntry {
    rotation: string; // "A", "B", "C", or "" for non-rotation nodes
    relics: Array<{ relic: RelicEntry; chance: number }>;
}

interface ScoredNode {
    groupKey: string; // "Planet / Node"
    planet: string;
    node: string;
    rotations: RotationEntry[]; // sorted by rotation label
    /**
     * Max-drops score: sum of (relic × rotation) pairs — a relic in Rot A and
     * Rot C contributes 2. Primary sort key in "max-drops" mode.
     */
    totalDropCount: number;
    /**
     * Coverage score: number of *distinct* selected relics across all rotations
     * — a relic appearing in multiple rotations still counts as 1.
     * Primary sort key in "coverage" mode.
     */
    uniqueRelicCount: number;
    /** Sum of all per-rotation drop %s — tiebreaker in both modes. */
    totalChance: number;
    /** Mission type e.g. "Survival", "Defense" — undefined if not found in data. */
    missionType: string | undefined;
}

function parsePath(pathLabel: string): { planet: string; node: string; rotation: string } {
    const stripped = pathLabel.replace(/^missionRewards\s*\/\s*/, "");
    const parts = stripped.split(/\s*\/\s*/);
    return { planet: parts[0] ?? "", node: parts[1] ?? "", rotation: parts[2] ?? "" };
}

function computeScores(rotations: RotationEntry[]): Pick<ScoredNode, "totalDropCount" | "uniqueRelicCount" | "totalChance"> {
    const totalDropCount = rotations.reduce((s, rot) => s + rot.relics.length, 0);
    const seenKeys = new Set<string>();
    for (const rot of rotations) {
        for (const { relic } of rot.relics) seenKeys.add(relic.key);
    }
    const totalChance = rotations.reduce(
        (s, rot) => s + rot.relics.reduce((rs, r) => rs + r.chance, 0),
        0,
    );
    return { totalDropCount, uniqueRelicCount: seenKeys.size, totalChance };
}

/** Returns true if this rotation label is within the player's chosen limit. */
function rotationAllowed(rotation: string, limit: RotationLimit): boolean {
    if (limit === null) return true;
    // Non-rotation nodes (rotation = "") are always included regardless of limit
    if (rotation === "") return true;
    if (limit === "A") return rotation === "A";
    if (limit === "B") return rotation === "A" || rotation === "B";
    return true;
}

// ---- Sub-components ----

function TierLabel({ tier }: { tier: string }) {
    const colorCls = TIER_COLOR[tier]?.split(" ")[0] ?? "text-slate-400";
    return (
        <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${colorCls}`}>
            {tier}
        </div>
    );
}

function TierBadge({ tier }: { tier: string }) {
    const cls = TIER_COLOR[tier] ?? "text-slate-400 border-slate-700 bg-slate-900";
    return (
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${cls}`}>
            {tier.toUpperCase()}
        </span>
    );
}

function AvailBadge({ avail }: { avail: RelicAvailabilityStatus }) {
    if (avail === "prime_resurgence") {
        return (
            <span className="text-[9px] px-1 py-0.5 rounded border border-violet-700/50 bg-violet-950/30 text-violet-300 font-semibold shrink-0">
                PR
            </span>
        );
    }
    if (avail === "vaulted") {
        return (
            <span className="text-[9px] px-1 py-0.5 rounded border border-red-800/50 bg-red-950/30 text-red-500 font-semibold shrink-0">
                V
            </span>
        );
    }
    return null;
}

function NodeCard({
    node,
    availabilityByKey,
    mode,
}: {
    node: ScoredNode;
    availabilityByKey: Map<string, RelicAvailabilityStatus>;
    mode: FarmingMode;
}) {
    const { planet, node: nodeName, rotations, totalDropCount, uniqueRelicCount, totalChance, missionType } = node;
    const multiRotation = rotations.length > 1 || (rotations.length === 1 && rotations[0].rotation !== "");

    const primaryCount = mode === "coverage" ? uniqueRelicCount : totalDropCount;
    const countBadgeCls = mode === "total-chance"
        ? (totalChance >= 30
            ? "text-amber-200 border-amber-600/50 bg-amber-950/40"
            : totalChance >= 20
                ? "text-green-200 border-green-700/50 bg-green-950/30"
                : totalChance >= 10
                    ? "text-blue-200 border-blue-700/50 bg-blue-950/30"
                    : "text-slate-400 border-slate-700 bg-slate-900/50")
        : (primaryCount >= 4
            ? "text-amber-200 border-amber-600/50 bg-amber-950/40"
            : primaryCount === 3
                ? "text-green-200 border-green-700/50 bg-green-950/30"
                : primaryCount === 2
                    ? "text-blue-200 border-blue-700/50 bg-blue-950/30"
                    : "text-slate-400 border-slate-700 bg-slate-900/50");

    const badgeLabel = mode === "coverage"
        ? `${uniqueRelicCount} unique`
        : mode === "total-chance"
            ? `${totalChance.toFixed(1)}%`
            : `${totalDropCount} drop${totalDropCount === 1 ? "" : "s"}`;

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
            {/* Node header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100 flex-1 min-w-0">
                    <span className="text-slate-400 text-xs shrink-0">{planet}</span>
                    <span className="text-slate-600 shrink-0">›</span>
                    <span className="truncate">{nodeName}</span>
                    {missionType && (
                        <span className="text-[10px] font-normal text-slate-500 shrink-0">
                            {missionType}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {mode !== "total-chance" && (
                        <span className="text-[11px] font-mono text-slate-400" title="Combined drop % across all rotations">
                            {totalChance.toFixed(1)}%
                        </span>
                    )}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${countBadgeCls}`}>
                        {badgeLabel}
                    </span>
                </div>
            </div>

            {/* Rotations */}
            <div className={multiRotation ? "space-y-2" : "space-y-1"}>
                {rotations.map((rot) => (
                    <div key={rot.rotation || "__"}>
                        {multiRotation && (() => {
                            const tip = rot.rotation
                                ? ROTATION_TOOLTIPS[missionType ?? ""]?.[rot.rotation]
                                : undefined;
                            return (
                                <div
                                    className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 w-fit"
                                    title={tip}
                                    style={tip ? { cursor: "help", textDecorationLine: "underline", textDecorationStyle: "dotted" } : undefined}
                                >
                                    {rot.rotation ? `Rotation ${rot.rotation}` : "Drop"}
                                </div>
                            );
                        })()}
                        <div className="space-y-1">
                            {rot.relics.map(({ relic, chance }) => {
                                const avail = availabilityByKey.get(relic.key) ?? "vaulted";
                                return (
                                    <div key={relic.key} className="flex items-center gap-2 text-[11px]">
                                        <TierBadge tier={relic.tier} />
                                        <span className={avail === "vaulted" ? "text-slate-500" : "text-slate-300"}>
                                            {relic.displayName}
                                        </span>
                                        <AvailBadge avail={avail} />
                                        <span className="ml-auto font-mono text-slate-500 shrink-0">{chance.toFixed(1)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---- Main component ----

interface RelicFarmingProps {
    selectedKeys: Set<string>;
    setSelectedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export default function RelicFarming({ selectedKeys, setSelectedKeys }: RelicFarmingProps) {
    const worldState = useWorldStateData();
    const vaultTrader = worldState?.vaultTrader ?? null;
    const now = Date.now();
    const activeFissures = (worldState?.fissures ?? [])
        .filter((fissure) => isWorldStateEntryActive(fissure, now))
        .sort((a, b) => a.tierNum - b.tierNum || Date.parse(a.expiry) - Date.parse(b.expiry));

    const allRelics = useMemo(
        () => getAllRelics().sort((a, b) => a.relicName.localeCompare(b.relicName)),
        [],
    );

    const [showVaulted, setShowVaulted] = useState(false);
    const [tierFilter, setTierFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [farmingMode, setFarmingMode] = useState<FarmingMode>("max-drops");
    const [rotationLimit, setRotationLimit] = useState<RotationLimit>(null);
    const [excludedMissionTypes, setExcludedMissionTypes] = useState<Set<string>>(new Set());

    const availabilityByKey = useMemo(() => {
        const map = new Map<string, RelicAvailabilityStatus>();
        for (const relic of allRelics) {
            map.set(relic.key, getRelicAvailabilityStatus(relic.key, relic.isActive, vaultTrader));
        }
        return map;
    }, [allRelics, vaultTrader]);

    const filteredRelics = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRelics.filter((r) => {
            const avail = availabilityByKey.get(r.key) ?? "vaulted";
            if (!showVaulted && avail === "vaulted") return false;
            if (tierFilter !== "all" && r.tier.toLowerCase() !== tierFilter) return false;
            if (!q) return true;
            if (r.displayName.toLowerCase().includes(q)) return true;
            return r.rewards.some((rw) => rw.itemName.toLowerCase().includes(q));
        });
    }, [allRelics, availabilityByKey, showVaulted, tierFilter, search]);

    const byTier = useMemo(() => {
        const groups = new Map<string, RelicEntry[]>(TIER_ORDER.map((t) => [t, []]));
        for (const r of filteredRelics) {
            groups.get(r.tier)?.push(r);
        }
        return groups;
    }, [filteredRelics]);

    // Build the full node map — no rotation/mission-type filtering here
    const scoredNodes = useMemo((): ScoredNode[] => {
        if (selectedKeys.size === 0) return [];

        type RotationMap = Map<string, Map<string, { relic: RelicEntry; chance: number }>>;
        const nodeMap = new Map<string, { planet: string; node: string; rotationMap: RotationMap }>();

        for (const key of selectedKeys) {
            const relic = getRelicByKey(key);
            if (!relic) continue;

            // Deduplicate within this relic by exact pathLabel, keeping highest chance
            const bestByPath = new Map<string, number>();
            for (const m of relic.missions) {
                const prev = bestByPath.get(m.pathLabel) ?? 0;
                if (m.chance > prev) bestByPath.set(m.pathLabel, m.chance);
            }

            for (const [pathLabel, chance] of bestByPath) {
                const { planet, node, rotation } = parsePath(pathLabel);
                const groupKey = `${planet} / ${node}`;

                if (!nodeMap.has(groupKey)) {
                    nodeMap.set(groupKey, { planet, node, rotationMap: new Map() });
                }
                const nodeData = nodeMap.get(groupKey)!;

                if (!nodeData.rotationMap.has(rotation)) {
                    nodeData.rotationMap.set(rotation, new Map());
                }
                const existing = nodeData.rotationMap.get(rotation)!.get(key);
                if (!existing || chance > existing.chance) {
                    nodeData.rotationMap.get(rotation)!.set(key, { relic, chance });
                }
            }
        }

        return Array.from(nodeMap.values()).map(({ planet, node, rotationMap }) => {
            const rotations: RotationEntry[] = Array.from(rotationMap.entries())
                .map(([rotation, relicMap]) => ({
                    rotation,
                    relics: Array.from(relicMap.values()).sort((a, b) => b.chance - a.chance),
                }))
                .sort((a, b) => a.rotation.localeCompare(b.rotation));

            const gk = `${planet} / ${node}`;
            return {
                groupKey: gk,
                planet,
                node,
                rotations,
                ...computeScores(rotations),
                missionType: getMissionType(gk),
            };
        });
    }, [selectedKeys]);

    // Collect all mission types present in the full result set (before filtering)
    const allMissionTypes = useMemo(() => {
        const types = new Set<string>();
        for (const node of scoredNodes) {
            types.add(node.missionType ?? "Unknown");
        }
        return Array.from(types).sort();
    }, [scoredNodes]);

    // Apply rotation limit + mission type exclusions, recompute scores
    const filteredNodes = useMemo((): ScoredNode[] => {
        return scoredNodes
            .map((node) => {
                // Apply rotation limit
                const allowedRotations = node.rotations.filter((rot) =>
                    rotationAllowed(rot.rotation, rotationLimit),
                );
                if (allowedRotations.length === 0) return null;

                // Apply mission type exclusion
                const mt = node.missionType ?? "Unknown";
                if (excludedMissionTypes.has(mt)) return null;

                // Recompute scores on the filtered rotation set
                return {
                    ...node,
                    rotations: allowedRotations,
                    ...computeScores(allowedRotations),
                };
            })
            .filter((n): n is ScoredNode => n !== null);
    }, [scoredNodes, rotationLimit, excludedMissionTypes]);

    const sortedNodes = useMemo(() => {
        const nodes = filteredNodes.slice();
        if (farmingMode === "coverage") {
            nodes.sort((a, b) => b.uniqueRelicCount - a.uniqueRelicCount || b.totalChance - a.totalChance);
        } else if (farmingMode === "total-chance") {
            nodes.sort((a, b) => b.totalChance - a.totalChance || b.totalDropCount - a.totalDropCount);
        } else {
            nodes.sort((a, b) => b.totalDropCount - a.totalDropCount || b.totalChance - a.totalChance);
        }
        return nodes;
    }, [filteredNodes, farmingMode]);

    function toggleRelic(key: string) {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function toggleMissionType(type: string) {
        setExcludedMissionTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }

    const selectedCount = selectedKeys.size;
    const vaultedSelectedCount = Array.from(selectedKeys).filter(
        (k) => (availabilityByKey.get(k) ?? "vaulted") === "vaulted",
    ).length;

    const modeDescriptions: Record<FarmingMode, string> = {
        "max-drops":    "Sorted by total relic drops across all rotations — a relic in two rotations counts twice.",
        "coverage":     "Sorted by unique relics per node — duplicate rotations don't add to the score.",
        "total-chance": "Sorted by highest summed drop % across all rotations — pure probability, ignoring variety.",
    };

    const hasResults = selectedCount > 0 && scoredNodes.length > 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
            {/* ── Left: Relic selector ── */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        Select Relics
                        {selectedCount > 0 && (
                            <span className="ml-1.5 text-slate-300 font-semibold">{selectedCount} selected</span>
                        )}
                    </div>
                    {selectedCount > 0 && (
                        <button
                            onClick={() => setSelectedKeys(new Set())}
                            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {/* Search */}
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search relic name or reward…"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-slate-500"
                />

                {/* Tier filter + vault toggle */}
                <div className="flex flex-wrap gap-1.5 items-center">
                    {(["all", "lith", "meso", "neo", "axi"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTierFilter(t)}
                            className={[
                                "rounded-full px-2.5 py-0.5 text-[11px] border transition-colors capitalize",
                                tierFilter === t
                                    ? "bg-slate-100 text-slate-900 border-slate-100"
                                    : "bg-slate-950/40 text-slate-300 border-slate-700 hover:bg-slate-900",
                            ].join(" ")}
                        >
                            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowVaulted((x) => !x)}
                        className={[
                            "rounded-full px-2.5 py-0.5 text-[11px] border transition-colors ml-auto",
                            showVaulted
                                ? "bg-red-950/40 text-red-300 border-red-700/50"
                                : "bg-slate-950/40 text-slate-400 border-slate-700 hover:bg-slate-900",
                        ].join(" ")}
                    >
                        {showVaulted ? "Hide vaulted" : "Show vaulted"}
                    </button>
                </div>

                {/* Relic checklist */}
                <div
                    role="region"
                    aria-label="Available relics"
                    tabIndex={0}
                    className="space-y-4 max-h-none overflow-visible pr-1 lg:max-h-[600px] lg:overflow-y-auto"
                >
                    {TIER_ORDER.map((tier) => {
                        const relics = byTier.get(tier) ?? [];
                        if (relics.length === 0) return null;
                        return (
                            <div key={tier}>
                                <TierLabel tier={tier} />
                                <div className="space-y-0.5">
                                    {relics.map((relic) => {
                                        const avail = availabilityByKey.get(relic.key) ?? "vaulted";
                                        const checked = selectedKeys.has(relic.key);
                                        return (
                                            <label
                                                key={relic.key}
                                                className={[
                                                    "flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors text-xs select-none",
                                                    checked
                                                        ? "bg-slate-800/70 text-slate-100"
                                                        : "hover:bg-slate-900/60 text-slate-400",
                                                    avail === "vaulted" ? "opacity-60" : "",
                                                ].join(" ")}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleRelic(relic.key)}
                                                    className="rounded border-slate-600 bg-slate-900 accent-slate-400 shrink-0"
                                                />
                                                <span className="flex-1 min-w-0 truncate">{relic.displayName}</span>
                                                <AvailBadge avail={avail} />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {filteredRelics.length === 0 && (
                        <div className="text-xs text-slate-500 text-center py-4">
                            No relics match the current filter.
                        </div>
                    )}
                </div>
            </div>

            {/* ── Right: Filters + Node results ── */}
            <div className="space-y-3">
                {activeFissures.length > 0 && (
                    <section className="rounded-2xl border border-cyan-900/40 bg-cyan-950/10 p-3" aria-label="Current fissure missions">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-[10px] uppercase tracking-wide text-cyan-300">Current missions for opening relics</div>
                            <div className="text-[9px] text-slate-500">Shared World State</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
                            {activeFissures.slice(0, 6).map((fissure) => {
                                const minutes = Math.max(0, Math.floor((Date.parse(fissure.expiry) - now) / 60000));
                                return (
                                    <div key={fissure.id} className="min-w-0 rounded-lg border border-cyan-900/30 bg-slate-950/20 px-2.5 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-semibold text-slate-200">{fissure.tier}{fissure.isStorm ? " Storm" : ""}{fissure.isHard ? " · Steel Path" : ""}</span>
                                            <span className="shrink-0 font-mono text-[9px] text-slate-500">{minutes}m</span>
                                        </div>
                                        <div className="mt-0.5 truncate text-[10px] text-slate-400">{fissure.missionType} · {fissure.node}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Controls card — ranking mode, rotation limit, mission type filter */}
                {hasResults && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                        {/* Ranking mode */}
                        <div className="space-y-1.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Ranking mode</div>
                            <div className="flex gap-2">
                                {([
                                    { key: "max-drops"    as FarmingMode, label: "Max Drops",   desc: "Every relic × rotation is a separate drop" },
                                    { key: "coverage"     as FarmingMode, label: "Coverage",    desc: "Count each unique relic once per node" },
                                    { key: "total-chance" as FarmingMode, label: "Total %",     desc: "Highest combined drop % wins" },
                                ] as const).map((m) => (
                                    <button
                                        key={m.key}
                                        onClick={() => setFarmingMode(m.key)}
                                        title={m.desc}
                                        className={[
                                            "flex-1 rounded-lg border px-3 py-2 text-xs text-left transition-colors",
                                            farmingMode === m.key
                                                ? "border-slate-400 bg-slate-800 text-slate-100"
                                                : "border-slate-700 bg-slate-900/50 text-slate-400 hover:bg-slate-900 hover:text-slate-300",
                                        ].join(" ")}
                                    >
                                        <div className="font-semibold">{m.label}</div>
                                        <div className="text-[10px] mt-0.5 opacity-70">{m.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rotation limit */}
                        <div className="space-y-1.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">
                                Rotation limit
                                <span className="ml-1.5 normal-case text-slate-600">— stop farming after reaching this rotation</span>
                            </div>
                            <div className="flex gap-1.5 items-center">
                                {([
                                    { key: "A" as const, label: "Stop at A", desc: "Only show Rotation A drops — exit after the first reward" },
                                    { key: "B" as const, label: "Stop at B", desc: "Show Rotation A and B drops — exit before reaching C" },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setRotationLimit((prev) => prev === opt.key ? null : opt.key)}
                                        title={opt.desc}
                                        className={[
                                            "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                                            rotationLimit === opt.key
                                                ? "border-slate-400 bg-slate-800 text-slate-100 font-semibold"
                                                : "border-slate-700 bg-slate-900/50 text-slate-400 hover:bg-slate-900 hover:text-slate-300",
                                        ].join(" ")}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                                {rotationLimit !== null && (
                                    <span className="text-[10px] text-slate-600 ml-1">
                                        (click again to clear)
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Mission type filter — only shown when multiple types exist */}
                        {allMissionTypes.length > 1 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Mission type</div>
                                    {excludedMissionTypes.size > 0 && (
                                        <button
                                            onClick={() => setExcludedMissionTypes(new Set())}
                                            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                                        >
                                            Show all
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {allMissionTypes.map((type) => {
                                        const excluded = excludedMissionTypes.has(type);
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => toggleMissionType(type)}
                                                className={[
                                                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                                                    excluded
                                                        ? "border-slate-800 bg-slate-900/30 text-slate-600 line-through"
                                                        : "border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500",
                                                ].join(" ")}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {selectedCount === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-8 text-center">
                        <div className="text-slate-400 text-sm">Select relics on the left to find the best farming locations.</div>
                        <div className="text-slate-600 text-xs mt-1">
                            Choose a ranking mode to prioritise maximum drop chances or broadest relic coverage.
                        </div>
                    </div>
                ) : sortedNodes.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-8 text-center">
                        <div className="text-slate-400 text-sm">
                            No nodes match the current filters.
                        </div>
                        <div className="text-slate-600 text-xs mt-1">
                            Try relaxing the rotation limit or re-enabling some mission types.
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="text-xs text-slate-500">
                            {sortedNodes.length} node{sortedNodes.length === 1 ? "" : "s"} reward at least one of your {selectedCount} selected relic{selectedCount === 1 ? "" : "s"}.
                            {" "}{modeDescriptions[farmingMode]}
                            {vaultedSelectedCount > 0 && (
                                <span className="ml-1 text-red-500/70">
                                    ({vaultedSelectedCount} vaulted relic{vaultedSelectedCount === 1 ? "" : "s"} excluded from results.)
                                </span>
                            )}
                        </div>
                        {sortedNodes.map((node) => (
                            <NodeCard
                                key={node.groupKey}
                                node={node}
                                availabilityByKey={availabilityByKey}
                                mode={farmingMode}
                            />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
