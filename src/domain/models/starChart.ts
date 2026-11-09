// ===== FILE: src/domain/models/starChart.ts =====

export type PlanetId = string;
export type NodeId = string;

/**
 * Star Chart planet/region/hub.
 *
 * NOTE: Keep this minimal and canonical. Do not embed drops/rewards here.
 */
export interface StarChartPlanet {
    id: PlanetId;
    name: string;
    /**
     * "planet" for normal planets, "hub" for social hubs, "region" for non-planet regions.
     */
    kind: "planet" | "hub" | "region";
    sortOrder: number;
}

/**
 * Star Chart node.
 *
 * "nodeType" is intentionally coarse. Mission metadata (mode/faction/tileset)
 * should only be added when you have canonical, validated sources.
 *
 * Junctions are represented as nodes with nodeType="junction".
 */
export interface StarChartNode {
    id: NodeId;

    /**
     * Planet this node belongs to (for junction nodes, this is the "from" planet).
     */
    planetId: PlanetId;

    name: string;

    nodeType: "mission" | "hub" | "junction" | "boss" | "quest" | "special";

    /** Mission type (e.g. "Exterminate", "Defense", "Survival"). */
    missionType?: string;

    /** Enemy faction (e.g. "Grineer", "Corpus", "Infested", "Orokin"). */
    faction?: string;

    pos?: { x: number; y: number };
    /**
     * Adjacency list for navigation and reachability checks.
     * Must be canonical NodeIds.
     */
    edges: NodeId[];

    /**
     * Junction-only: which planet this junction unlocks.
     * Required when nodeType === "junction".
     */
    unlocksPlanetId?: PlanetId;

    /** @deprecated Junction prerequisites now live only in PREREQ_REGISTRY. */
    prereqIds?: string[];
    dropGroupToken?: string;
    dropNodeToken?: string;
}

export interface StarChartData {
    planets: StarChartPlanet[];
    nodes: StarChartNode[];
}

