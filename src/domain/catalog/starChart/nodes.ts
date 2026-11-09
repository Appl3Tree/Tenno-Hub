// ===== FILE: src/domain/catalog/starChart/nodes.ts =====

import type { StarChartNode } from "../../models/starChart";

/**
 * Authoritative node registry.
 *
 * Conventions:
 * - Mission nodes that exist in drop-data missionRewards.json should use:
 *     node:mr/<group>/<node>
 *   where <group>/<node> match the missionRewards keys (tokenized or raw; tokenized preferred).
 *
 * - Junctions are nodes with nodeType="junction".
 */
export const STAR_CHART_NODES: StarChartNode[] = [
    // =============================
    // Junctions — full Star Chart progression chain
    // =============================
    // Keep the legacy IDs because imported profiles store these keys; the
    // in-game profile tags establish the actual planet direction.
    { id: "node:junction_venus_earth", planetId: "planet:earth", name: "Venus Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:venus" },
    { id: "node:junction_mercury_venus", planetId: "planet:venus", name: "Mercury Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:mercury" },
    { id: "node:junction_earth_mars", planetId: "planet:earth", name: "Earth → Mars Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:mars" },
    { id: "node:junction_mars_phobos", planetId: "planet:mars", name: "Mars → Phobos Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:phobos" },
    { id: "node:junction_mars_ceres", planetId: "planet:mars", name: "Mars → Ceres Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:ceres" },
    { id: "node:junction_ceres_jupiter", planetId: "planet:deimos", name: "Jupiter Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:jupiter" },
    { id: "node:junction_jupiter_europa", planetId: "planet:jupiter", name: "Jupiter → Europa Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:europa" },
    { id: "node:junction_europa_saturn", planetId: "planet:europa", name: "Europa → Saturn Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:saturn" },
    { id: "node:junction_saturn_uranus", planetId: "planet:saturn", name: "Saturn → Uranus Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:uranus" },
    { id: "node:junction_uranus_neptune", planetId: "planet:uranus", name: "Uranus → Neptune Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:neptune" },
    { id: "node:junction_neptune_pluto", planetId: "planet:neptune", name: "Neptune → Pluto Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:pluto" },
    { id: "node:junction_pluto_sedna", planetId: "planet:pluto", name: "Pluto → Eris Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:eris" },
    { id: "node:junction_sedna_eris", planetId: "planet:eris", name: "Eris → Sedna Junction", nodeType: "junction", pos: undefined, edges: [], unlocksPlanetId: "planet:sedna" },
    // =============================
    // Earth (missionRewards-backed starters)
    // These ids auto-map to data:node/<planet>/<node> via nodeDropSourceMap.ts
    // =============================
    {
        id: "node:mr/earth/cambria",
        planetId: "planet:earth",
        name: "Cambria",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/everest",
        planetId: "planet:earth",
        name: "Everest",
        nodeType: "mission",
        missionType: "Excavation",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/gaia",
        planetId: "planet:earth",
        name: "Gaia",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Grineer",
        pos: { x: -0.2, y: 0.45 },
        edges: []
    },
    {
        id: "node:mr/earth/lith",
        planetId: "planet:earth",
        name: "Lith",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/mantle",
        planetId: "planet:earth",
        name: "Mantle",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/pacific",
        planetId: "planet:earth",
        name: "Pacific",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: { x: 0.80, y: 0.7},
        edges: ["node:mr/earth/gaia",]
    },

    // =============================
    // Earth variants that exist as separate missionRewards keys
    // (Caches/Extra) should map deterministically too.
    // =============================
    {
        id: "node:mr/earth/bendar-cluster",
        planetId: "region:earth_proxima",
        name: "Bendar Cluster",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/bendar-cluster-(caches)",
        planetId: "region:earth_proxima",
        name: "Bendar Cluster (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/bendar-cluster-(extra)",
        planetId: "region:earth_proxima",
        name: "Bendar Cluster (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/earth/iota-temple",
        planetId: "region:earth_proxima",
        name: "Iota Temple",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/iota-temple-(caches)",
        planetId: "region:earth_proxima",
        name: "Iota Temple (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/iota-temple-(extra)",
        planetId: "region:earth_proxima",
        name: "Iota Temple (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/korms-belt",
        planetId: "region:earth_proxima",
        name: "Korm's Belt",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/korms-belt-(caches)",
        planetId: "region:earth_proxima",
        name: "Korm's Belt (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/korms-belt-(extra)",
        planetId: "region:earth_proxima",
        name: "Korm's Belt (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/earth/sover-strait",
        planetId: "region:earth_proxima",
        name: "Sover Strait",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/sover-strait-(caches)",
        planetId: "region:earth_proxima",
        name: "Sover Strait (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/sover-strait-(extra)",
        planetId: "region:earth_proxima",
        name: "Sover Strait (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/earth/ogal-cluster",
        planetId: "region:earth_proxima",
        name: "Ogal Cluster",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/ogal-cluster-(caches)",
        planetId: "region:earth_proxima",
        name: "Ogal Cluster (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/ogal-cluster-(extra)",
        planetId: "region:earth_proxima",
        name: "Ogal Cluster (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/earth/cervantes-(caches)",
        planetId: "planet:earth",
        name: "Cervantes (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // A few more from your list (no suffix variants)
    {
        id: "node:mr/earth/tikal",
        planetId: "planet:earth",
        name: "Tikal",
        nodeType: "mission",
        missionType: "Dark Sector Excavation",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/coba",
        planetId: "planet:earth",
        name: "Coba",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/erpo",
        planetId: "planet:earth",
        name: "Erpo",
        nodeType: "mission",
        missionType: "Mobile Defense (Archwing)",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/oro",
        planetId: "planet:earth",
        name: "Oro",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/sayas-visions",
        planetId: "planet:earth",
        name: "Saya's Visions",
        nodeType: "quest",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/eurasia",
        planetId: "planet:earth",
        name: "Eurasia",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Venus (missionRewards-backed)
    // =============================
    {
        id: "node:mr/venus/beacon-shield-ring",
        planetId: "region:venus_proxima",
        name: "Beacon Shield Ring",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/beacon-shield-ring-(caches)",
        planetId: "region:venus_proxima",
        name: "Beacon Shield Ring (Caches)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/beacon-shield-ring-(extra)",
        planetId: "region:venus_proxima",
        name: "Beacon Shield Ring (Extra)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/bifrost-echo",
        planetId: "region:venus_proxima",
        name: "Bifrost Echo",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/bifrost-echo-(caches)",
        planetId: "region:venus_proxima",
        name: "Bifrost Echo (Caches)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/bifrost-echo-(extra)",
        planetId: "region:venus_proxima",
        name: "Bifrost Echo (Extra)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/cytherean",
        planetId: "planet:venus",
        name: "Cytherean",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/falling-glory",
        planetId: "region:venus_proxima",
        name: "Falling Glory",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/falling-glory-(caches)",
        planetId: "region:venus_proxima",
        name: "Falling Glory (Caches)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/falling-glory-(extra)",
        planetId: "region:venus_proxima",
        name: "Falling Glory (Extra)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/fossa",
        planetId: "planet:venus",
        name: "Fossa",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/ishtar-(caches)",
        planetId: "planet:venus",
        name: "Ishtar (Caches)",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/kiliken",
        planetId: "planet:venus",
        name: "Kiliken",
        nodeType: "mission",
        missionType: "Excavation",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/linea",
        planetId: "planet:venus",
        name: "Linea",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/luckless-expanse",
        planetId: "region:venus_proxima",
        name: "Luckless Expanse",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/luckless-expanse-(caches)",
        planetId: "region:venus_proxima",
        name: "Luckless Expanse (Caches)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/luckless-expanse-(extra)",
        planetId: "region:venus_proxima",
        name: "Luckless Expanse (Extra)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/malva",
        planetId: "planet:venus",
        name: "Malva",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/montes",
        planetId: "planet:venus",
        name: "Montes",
        nodeType: "mission",
        missionType: "Extermination (Archwing)",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/orvin-haarc",
        planetId: "region:venus_proxima",
        name: "Orvin-Haarc",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/orvin-haarc-(caches)",
        planetId: "region:venus_proxima",
        name: "Orvin-Haarc (Caches)",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/orvin-haarc-(extra)",
        planetId: "region:venus_proxima",
        name: "Orvin-Haarc (Extra)",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/romula",
        planetId: "planet:venus",
        name: "Romula",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/tessera",
        planetId: "planet:venus",
        name: "Tessera",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/unda",
        planetId: "planet:venus",
        name: "Unda",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/v-prime",
        planetId: "planet:venus",
        name: "V Prime",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    {
        id: "node:mr/venus/venera",
        planetId: "planet:venus",
        name: "Venera",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/aphrodite",
        planetId: "planet:venus",
        name: "Aphrodite",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/e-gate",
        planetId: "planet:venus",
        name: "E Gate",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/vesper-strait",
        planetId: "region:venus_proxima",
        name: "Vesper Strait",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/vesper-strait-(caches)",
        planetId: "region:venus_proxima",
        name: "Vesper Strait (Caches)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/vesper-strait-(extra)",
        planetId: "region:venus_proxima",
        name: "Vesper Strait (Extra)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    // =============================
    // Mercury (missionRewards-backed)
    // =============================
    {
        id: "node:mr/mercury/apollodorus",
        planetId: "planet:mercury",
        name: "Apollodorus",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/caduceus",
        planetId: "planet:mercury",
        name: "Caduceus",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/caloris",
        planetId: "planet:mercury",
        name: "Caloris",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/elion",
        planetId: "planet:mercury",
        name: "Elion",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/lares",
        planetId: "planet:mercury",
        name: "Lares",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/neruda-(caches)",
        planetId: "planet:mercury",
        name: "Neruda (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/odin",
        planetId: "planet:mercury",
        name: "Odin",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/suisei",
        planetId: "planet:mercury",
        name: "Suisei",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/terminus-(caches)",
        planetId: "planet:mercury",
        name: "Terminus (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/tolstoj",
        planetId: "planet:mercury",
        name: "Tolstoj",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/boethius",
        planetId: "planet:mercury",
        name: "Boethius",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/m-prime",
        planetId: "planet:mercury",
        name: "M Prime",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mercury/pantheon",
        planetId: "planet:mercury",
        name: "Pantheon",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    // =============================
    // Mars (missionRewards-backed)
    // =============================
    {
        id: "node:mr/mars/arcadia",
        planetId: "planet:mars",
        name: "Arcadia",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/olympus",
        planetId: "planet:mars",
        name: "Olympus",
        nodeType: "mission",
        missionType: "Disruption",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/spear",
        planetId: "planet:mars",
        name: "Spear",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/alator",
        planetId: "planet:mars",
        name: "Alator",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/arval",
        planetId: "planet:mars",
        name: "Arval",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/augustus",
        planetId: "planet:mars",
        name: "Augustus",
        nodeType: "mission",
        missionType: "Excavation",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/ara",
        planetId: "planet:mars",
        name: "Ara",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/martialis",
        planetId: "planet:mars",
        name: "Martialis",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/kadesh",
        planetId: "planet:mars",
        name: "Kadesh",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/war",
        planetId: "planet:mars",
        name: "War",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/gradivus-(caches)",
        planetId: "planet:mars",
        name: "Gradivus (Caches)",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/wahiba",
        planetId: "planet:mars",
        name: "Wahiba",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/quirinus",
        planetId: "planet:mars",
        name: "Quirinus",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/syrtis",
        planetId: "planet:mars",
        name: "Syrtis",
        nodeType: "mission",
        missionType: "Extermination (Archwing)",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/tyana-pass",
        planetId: "planet:mars",
        name: "Tyana Pass",
        nodeType: "mission",
        missionType: "Mirror Defense",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/ares",
        planetId: "planet:mars",
        name: "Ares",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/hellas",
        planetId: "planet:mars",
        name: "Hellas",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/tharsis",
        planetId: "planet:mars",
        name: "Tharsis",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/ultor",
        planetId: "planet:mars",
        name: "Ultor",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/mars/vallis",
        planetId: "planet:mars",
        name: "Vallis",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    // =============================
    // Jupiter (missionRewards-backed)
    // =============================
    {
        id: "node:mr/jupiter/ganymede",
        planetId: "planet:jupiter",
        name: "Ganymede",
        nodeType: "mission",
        missionType: "Disruption",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/adrastea-(caches)",
        planetId: "planet:jupiter",
        name: "Adrastea (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/amalthea",
        planetId: "planet:jupiter",
        name: "Amalthea",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/metis",
        planetId: "planet:jupiter",
        name: "Metis",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/io",
        planetId: "planet:jupiter",
        name: "Io",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/elara",
        planetId: "planet:jupiter",
        name: "Elara",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/callisto",
        planetId: "planet:jupiter",
        name: "Callisto",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/carpo-(caches)",
        planetId: "planet:jupiter",
        name: "Carpo (Caches)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/themisto",
        planetId: "planet:jupiter",
        name: "Themisto",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/the-ropalolyst",
        planetId: "planet:jupiter",
        name: "The Ropalolyst",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Sentient",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/the-ropalolyst-(extra)",
        planetId: "planet:jupiter",
        name: "The Ropalolyst (Extra)",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Sentient",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/sinai",
        planetId: "planet:jupiter",
        name: "Sinai",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/ananke",
        planetId: "planet:jupiter",
        name: "Ananke",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/galilea",
        planetId: "planet:jupiter",
        name: "Galilea",
        nodeType: "mission",
        missionType: "Sabotage (Archwing)",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/cameria",
        planetId: "planet:jupiter",
        name: "Cameria",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/carme",
        planetId: "planet:jupiter",
        name: "Carme",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/jupiter/thebe",
        planetId: "planet:jupiter",
        name: "Thebe",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    // =============================
    // Deimos (drop-data missionRewards) add=10
    // =============================
    {
        id: "node:mr/deimos/armatus",
        planetId: "planet:deimos",
        name: "Armatus",
        nodeType: "mission",
        missionType: "Disruption",
        faction: "The Murmur",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/cambire",
        planetId: "planet:deimos",
        name: "Cambire",
        nodeType: "mission",
        missionType: "Alchemy",
        faction: "The Murmur",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/effervo",
        planetId: "planet:deimos",
        name: "Effervo",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "The Murmur",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/formido-(caches)",
        planetId: "planet:deimos",
        name: "Formido (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/hyf",
        planetId: "planet:deimos",
        name: "Hyf",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/magnacidium",
        planetId: "planet:deimos",
        name: "Magnacidium",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/munio",
        planetId: "planet:deimos",
        name: "Munio",
        nodeType: "mission",
        missionType: "Mirror Defense",
        faction: "The Murmur",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/nex",
        planetId: "planet:deimos",
        name: "Nex",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "The Murmur",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/persto",
        planetId: "planet:deimos",
        name: "Persto",
        nodeType: "mission",
        missionType: "Survival",
        faction: "The Murmur",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/terrorem",
        planetId: "planet:deimos",
        name: "Terrorem",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/horend",
        planetId: "planet:deimos",
        name: "Horend",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/phlegyas",
        planetId: "planet:deimos",
        name: "Phlegyas",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/dirus",
        planetId: "planet:deimos",
        name: "Dirus",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/exequias",
        planetId: "planet:deimos",
        name: "Exequias",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/deimos/testudo",
        planetId: "planet:deimos",
        name: "Testudo",
        nodeType: "mission",
        missionType: "Netracells",
        faction: "The Murmur",
        pos: undefined,
        edges: []
    },

    // =============================
    // Phobos (drop-data missionRewards) add=16
    // =============================
    {
        id: "node:mr/phobos/drunlo",
        planetId: "planet:phobos",
        name: "Drunlo",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/flimnap",
        planetId: "planet:phobos",
        name: "Flimnap",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/grildrig",
        planetId: "planet:phobos",
        name: "Grildrig",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/gulliver",
        planetId: "planet:phobos",
        name: "Gulliver",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/iliad",
        planetId: "planet:phobos",
        name: "Iliad",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/kepler",
        planetId: "planet:phobos",
        name: "Kepler",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/limtoc",
        planetId: "planet:phobos",
        name: "Limtoc",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/memphis",
        planetId: "planet:phobos",
        name: "Memphis",
        nodeType: "mission",
        missionType: "Dark Sector Defection",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/monolith",
        planetId: "planet:phobos",
        name: "Monolith",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/opik",
        planetId: "planet:phobos",
        name: "Opik",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/shklovsky",
        planetId: "planet:phobos",
        name: "Shklovsky",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/skyresh",
        planetId: "planet:phobos",
        name: "Skyresh",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/stickney",
        planetId: "planet:phobos",
        name: "Stickney",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/todd",
        planetId: "planet:phobos",
        name: "Todd",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/wendell",
        planetId: "planet:phobos",
        name: "Wendell",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/zeugma",
        planetId: "planet:phobos",
        name: "Zeugma",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/roche",
        planetId: "planet:phobos",
        name: "Roche",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/phobos/sharpless",
        planetId: "planet:phobos",
        name: "Sharpless",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    // =============================
    // Ceres (drop-data missionRewards) add=16
    // =============================
    {
        id: "node:mr/ceres/bode",
        planetId: "planet:ceres",
        name: "Bode",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/casta",
        planetId: "planet:ceres",
        name: "Casta",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/cinxia",
        planetId: "planet:ceres",
        name: "Cinxia",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/draco",
        planetId: "planet:ceres",
        name: "Draco",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/egeria",
        planetId: "planet:ceres",
        name: "Egeria",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/exta",
        planetId: "planet:ceres",
        name: "Exta",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/exta-(extra)",
        planetId: "planet:ceres",
        name: "Exta (Extra)",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/gabii",
        planetId: "planet:ceres",
        name: "Gabii",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/hapke",
        planetId: "planet:ceres",
        name: "Hapke",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/ker-(caches)",
        planetId: "planet:ceres",
        name: "Ker (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/lex",
        planetId: "planet:ceres",
        name: "Lex",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/nuovo",
        planetId: "planet:ceres",
        name: "Nuovo",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/olla",
        planetId: "planet:ceres",
        name: "Olla",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/seimeni",
        planetId: "planet:ceres",
        name: "Seimeni",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/thon-(caches)",
        planetId: "planet:ceres",
        name: "Thon (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/varro",
        planetId: "planet:ceres",
        name: "Varro",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/kiste",
        planetId: "planet:ceres",
        name: "Kiste",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/ludi",
        planetId: "planet:ceres",
        name: "Ludi",
        nodeType: "mission",
        missionType: "Hijack",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/ceres/pallas",
        planetId: "planet:ceres",
        name: "Pallas",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Europa (drop-data missionRewards) add=16
    // =============================
    {
        id: "node:mr/europa/abaddon",
        planetId: "planet:europa",
        name: "Abaddon",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/beleth",
        planetId: "planet:europa",
        name: "Beleth",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/cholistan",
        planetId: "planet:europa",
        name: "Cholistan",
        nodeType: "mission",
        missionType: "Dark Sector Excavation",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/cryotic-front",
        planetId: "planet:europa",
        name: "Cryotic Front",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/eligor",
        planetId: "planet:europa",
        name: "Eligor",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/gamygyn",
        planetId: "planet:europa",
        name: "Gamygyn",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/larzac",
        planetId: "planet:europa",
        name: "Larzac",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/lillith",
        planetId: "planet:europa",
        name: "Lillith",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/naamah",
        planetId: "planet:europa",
        name: "Naamah",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/orias",
        planetId: "planet:europa",
        name: "Orias",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/ose",
        planetId: "planet:europa",
        name: "Ose",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/paimon",
        planetId: "planet:europa",
        name: "Paimon",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/shax",
        planetId: "planet:europa",
        name: "Shax",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/valac",
        planetId: "planet:europa",
        name: "Valac",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/valefor",
        planetId: "planet:europa",
        name: "Valefor",
        nodeType: "mission",
        missionType: "Excavation",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/zagan",
        planetId: "planet:europa",
        name: "Zagan",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/armaros",
        planetId: "planet:europa",
        name: "Armaros",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/baal",
        planetId: "planet:europa",
        name: "Baal",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/kokabiel",
        planetId: "planet:europa",
        name: "Kokabiel",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/morax",
        planetId: "planet:europa",
        name: "Morax",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/europa/sorath",
        planetId: "planet:europa",
        name: "Sorath",
        nodeType: "mission",
        missionType: "Hijack",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    // =============================
    // Saturn (drop-data missionRewards) add=45
    // =============================
    {
        id: "node:mr/saturn/aegaeon",
        planetId: "planet:saturn",
        name: "Aegaeon",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/annihilation",
        planetId: "planet:saturn",
        name: "Annihilation",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/annihilation-(extra)",
        planetId: "planet:saturn",
        name: "Annihilation (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/anthe",
        planetId: "planet:saturn",
        name: "Anthe",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/calypso-(caches)",
        planetId: "planet:saturn",
        name: "Calypso (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/caracol",
        planetId: "planet:saturn",
        name: "Caracol",
        nodeType: "mission",
        missionType: "Dark Sector Defection",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/cassini",
        planetId: "planet:saturn",
        name: "Cassini",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/cephalon-capture",
        planetId: "planet:saturn",
        name: "Cephalon Capture",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/cephalon-capture-(extra)",
        planetId: "planet:saturn",
        name: "Cephalon Capture (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/dione",
        planetId: "planet:saturn",
        name: "Dione",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/helene",
        planetId: "planet:saturn",
        name: "Helene",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/kasios-rest",
        planetId: "region:saturn_proxima",
        name: "Kasio's Rest",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/kasios-rest-(caches)",
        planetId: "region:saturn_proxima",
        name: "Kasio's Rest (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/kasios-rest-(extra)",
        planetId: "region:saturn_proxima",
        name: "Kasio's Rest (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/lunaro-arena",
        planetId: "planet:saturn",
        name: "Lunaro Arena",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/lunaro-arena-(extra)",
        planetId: "planet:saturn",
        name: "Lunaro Arena (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/lupal-pass",
        planetId: "region:saturn_proxima",
        name: "Lupal Pass",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/lupal-pass-(caches)",
        planetId: "region:saturn_proxima",
        name: "Lupal Pass (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/lupal-pass-(extra)",
        planetId: "region:saturn_proxima",
        name: "Lupal Pass (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/mimas",
        planetId: "planet:saturn",
        name: "Mimas",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/mordo-cluster",
        planetId: "region:saturn_proxima",
        name: "Mordo Cluster",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/mordo-cluster-(caches)",
        planetId: "region:saturn_proxima",
        name: "Mordo Cluster (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/mordo-cluster-(extra)",
        planetId: "region:saturn_proxima",
        name: "Mordo Cluster (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/nodo-gap",
        planetId: "region:saturn_proxima",
        name: "Nodo Gap",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/nodo-gap-(caches)",
        planetId: "region:saturn_proxima",
        name: "Nodo Gap (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/nodo-gap-(extra)",
        planetId: "region:saturn_proxima",
        name: "Nodo Gap (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/numa",
        planetId: "planet:saturn",
        name: "Numa",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/pallene-(caches)",
        planetId: "planet:saturn",
        name: "Pallene (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/pandora",
        planetId: "planet:saturn",
        name: "Pandora",
        nodeType: "mission",
        missionType: "Pursuit (Archwing)",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/phoebe",
        planetId: "planet:saturn",
        name: "Phoebe",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/piscinas",
        planetId: "planet:saturn",
        name: "Piscinas",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/rhea",
        planetId: "planet:saturn",
        name: "Rhea",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/team-annihilation",
        planetId: "planet:saturn",
        name: "Team Annihilation",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/team-annihilation-(extra)",
        planetId: "planet:saturn",
        name: "Team Annihilation (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/tethys",
        planetId: "planet:saturn",
        name: "Tethys",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/titan",
        planetId: "planet:saturn",
        name: "Titan",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/vand-cluster",
        planetId: "region:saturn_proxima",
        name: "Vand Cluster",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/vand-cluster-(caches)",
        planetId: "region:saturn_proxima",
        name: "Vand Cluster (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/vand-cluster-(extra)",
        planetId: "region:saturn_proxima",
        name: "Vand Cluster (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/variant-annihilation",
        planetId: "planet:saturn",
        name: "Variant Annihilation",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/variant-annihilation-(extra)",
        planetId: "planet:saturn",
        name: "Variant Annihilation (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/variant-cephalon-capture",
        planetId: "planet:saturn",
        name: "Variant Cephalon Capture",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/variant-cephalon-capture-(extra)",
        planetId: "planet:saturn",
        name: "Variant Cephalon Capture (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/variant-team-annihilation",
        planetId: "planet:saturn",
        name: "Variant Team Annihilation",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/variant-team-annihilation-(extra)",
        planetId: "planet:saturn",
        name: "Variant Team Annihilation (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/enceladus",
        planetId: "planet:saturn",
        name: "Enceladus",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/keeler",
        planetId: "planet:saturn",
        name: "Keeler",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/saturn/telesto",
        planetId: "planet:saturn",
        name: "Telesto",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Uranus (drop-data missionRewards) add=20
    // =============================
    {
        id: "node:mr/uranus/ariel",
        planetId: "planet:uranus",
        name: "Ariel",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/assur",
        planetId: "planet:uranus",
        name: "Assur",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/bianca",
        planetId: "planet:uranus",
        name: "Bianca",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/brutus",
        planetId: "planet:uranus",
        name: "Brutus",
        nodeType: "mission",
        missionType: "Ascension",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/caelus",
        planetId: "planet:uranus",
        name: "Caelus",
        nodeType: "mission",
        missionType: "Interception (Archwing)",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/caliban",
        planetId: "planet:uranus",
        name: "Caliban",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/cupid",
        planetId: "planet:uranus",
        name: "Cupid",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/desdemona-(caches)",
        planetId: "planet:uranus",
        name: "Desdemona (Caches)",
        nodeType: "mission",
        missionType: "Sabotage (Archwing)",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/mab",
        planetId: "planet:uranus",
        name: "Mab",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/miranda",
        planetId: "planet:uranus",
        name: "Miranda",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/ophelia",
        planetId: "planet:uranus",
        name: "Ophelia",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/portia-(caches)",
        planetId: "planet:uranus",
        name: "Portia (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/prospero-(caches)",
        planetId: "planet:uranus",
        name: "Prospero (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/rosalind",
        planetId: "planet:uranus",
        name: "Rosalind",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/setebos-(caches)",
        planetId: "planet:uranus",
        name: "Setebos (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/stephano",
        planetId: "planet:uranus",
        name: "Stephano",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/titania",
        planetId: "planet:uranus",
        name: "Titania",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/trinculo",
        planetId: "planet:uranus",
        name: "Trinculo",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/umbriel",
        planetId: "planet:uranus",
        name: "Umbriel",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/ur",
        planetId: "planet:uranus",
        name: "Ur",
        nodeType: "mission",
        missionType: "Dark Sector Disruption",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/cressida",
        planetId: "planet:uranus",
        name: "Cressida",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/puck",
        planetId: "planet:uranus",
        name: "Puck",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus/sycorax",
        planetId: "planet:uranus",
        name: "Sycorax",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Neptune (drop-data missionRewards) add=35
    // =============================
    {
        id: "node:mr/neptune/arva-vector",
        planetId: "region:neptune_proxima",
        name: "Arva Vector",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/arva-vector-(caches)",
        planetId: "region:neptune_proxima",
        name: "Arva Vector (Caches)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/arva-vector-(extra)",
        planetId: "region:neptune_proxima",
        name: "Arva Vector (Extra)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/brom-cluster",
        planetId: "region:neptune_proxima",
        name: "Brom Cluster",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/brom-cluster-(caches)",
        planetId: "region:neptune_proxima",
        name: "Brom Cluster (Caches)",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/brom-cluster-(extra)",
        planetId: "region:neptune_proxima",
        name: "Brom Cluster (Extra)",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/cephalon-capture",
        planetId: "planet:neptune",
        name: "Cephalon Capture",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/despina",
        planetId: "planet:neptune",
        name: "Despina",
        nodeType: "mission",
        missionType: "Excavation",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/enkidu-ice-drifts",
        planetId: "region:neptune_proxima",
        name: "Enkidu Ice Drifts",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/enkidu-ice-drifts-(caches)",
        planetId: "region:neptune_proxima",
        name: "Enkidu Ice Drifts (Caches)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/enkidu-ice-drifts-(extra)",
        planetId: "region:neptune_proxima",
        name: "Enkidu Ice Drifts (Extra)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/galatea",
        planetId: "planet:neptune",
        name: "Galatea",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/halimede-(caches)",
        planetId: "planet:neptune",
        name: "Halimede (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/kelashin",
        planetId: "planet:neptune",
        name: "Kelashin",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/laomedeia",
        planetId: "planet:neptune",
        name: "Laomedeia",
        nodeType: "mission",
        missionType: "Disruption",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/mammons-prospect",
        planetId: "region:neptune_proxima",
        name: "Mammon's Prospect",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/mammons-prospect-(caches)",
        planetId: "region:neptune_proxima",
        name: "Mammon's Prospect (Caches)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/mammons-prospect-(extra)",
        planetId: "region:neptune_proxima",
        name: "Mammon's Prospect (Extra)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/nereid",
        planetId: "planet:neptune",
        name: "Nereid",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/nu-gua-mines",
        planetId: "region:neptune_proxima",
        name: "Nu-Gua Mines",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/nu-gua-mines-(caches)",
        planetId: "region:neptune_proxima",
        name: "Nu-Gua Mines (Caches)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/nu-gua-mines-(extra)",
        planetId: "region:neptune_proxima",
        name: "Nu-Gua Mines (Extra)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/proteus",
        planetId: "planet:neptune",
        name: "Proteus",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/psamathe",
        planetId: "planet:neptune",
        name: "Psamathe",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/salacia",
        planetId: "planet:neptune",
        name: "Salacia",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/sovereign-grasp",
        planetId: "region:neptune_proxima",
        name: "Sovereign Grasp",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/sovereign-grasp-(caches)",
        planetId: "region:neptune_proxima",
        name: "Sovereign Grasp (Caches)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/sovereign-grasp-(extra)",
        planetId: "region:neptune_proxima",
        name: "Sovereign Grasp (Extra)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/thalassa-(caches)",
        planetId: "planet:neptune",
        name: "Thalassa (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/the-index-endurance",
        planetId: "planet:neptune",
        name: "The Index: Endurance",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/the-index-endurance-high-risk",
        planetId: "planet:neptune",
        name: "The Index: Endurance (High Risk)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/the-index-endurance-low-risk",
        planetId: "planet:neptune",
        name: "The Index: Endurance (Low Risk)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/the-index-endurance-medium-risk",
        planetId: "planet:neptune",
        name: "The Index: Endurance (Medium Risk)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/triton",
        planetId: "planet:neptune",
        name: "Triton",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/yursa",
        planetId: "planet:neptune",
        name: "Yursa",
        nodeType: "mission",
        missionType: "Dark Sector Defection",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/larissa",
        planetId: "planet:neptune",
        name: "Larissa",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/neso",
        planetId: "planet:neptune",
        name: "Neso",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/neptune/sao",
        planetId: "planet:neptune",
        name: "Sao",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    // =============================
    // Pluto (drop-data missionRewards) add=30
    // =============================
    {
        id: "node:mr/pluto/cerberus",
        planetId: "planet:pluto",
        name: "Cerberus",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/charon-(caches)",
        planetId: "planet:pluto",
        name: "Charon (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/corb",
        planetId: "planet:pluto",
        name: "Corb",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/cypress-(caches)",
        planetId: "planet:pluto",
        name: "Cypress (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/fentons-field",
        planetId: "region:pluto_proxima",
        name: "Fenton's Field",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/fentons-field-(caches)",
        planetId: "region:pluto_proxima",
        name: "Fenton's Field (Caches)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/fentons-field-(extra)",
        planetId: "region:pluto_proxima",
        name: "Fenton's Field (Extra)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/hades",
        planetId: "planet:pluto",
        name: "Hades",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/hieracon",
        planetId: "planet:pluto",
        name: "Hieracon",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/hydra",
        planetId: "planet:pluto",
        name: "Hydra",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/khufu-envoy",
        planetId: "region:pluto_proxima",
        name: "Khufu Envoy",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/khufu-envoy-(caches)",
        planetId: "region:pluto_proxima",
        name: "Khufu Envoy (Caches)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/khufu-envoy-(extra)",
        planetId: "region:pluto_proxima",
        name: "Khufu Envoy (Extra)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/obol-crossing",
        planetId: "region:pluto_proxima",
        name: "Obol Crossing",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/obol-crossing-(caches)",
        planetId: "region:pluto_proxima",
        name: "Obol Crossing (Caches)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/obol-crossing-(extra)",
        planetId: "region:pluto_proxima",
        name: "Obol Crossing (Extra)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/oceanum",
        planetId: "planet:pluto",
        name: "Oceanum",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/outer-terminus",
        planetId: "planet:pluto",
        name: "Outer Terminus",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/palus",
        planetId: "planet:pluto",
        name: "Palus",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/peregrine-axis",
        planetId: "region:pluto_proxima",
        name: "Peregrine Axis",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/peregrine-axis-(caches)",
        planetId: "region:pluto_proxima",
        name: "Peregrine Axis (Caches)",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/peregrine-axis-(extra)",
        planetId: "region:pluto_proxima",
        name: "Peregrine Axis (Extra)",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/profit-margin",
        planetId: "region:pluto_proxima",
        name: "Profit Margin",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/profit-margin-(caches)",
        planetId: "region:pluto_proxima",
        name: "Profit Margin (Caches)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/profit-margin-(extra)",
        planetId: "region:pluto_proxima",
        name: "Profit Margin (Extra)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/regna",
        planetId: "planet:pluto",
        name: "Regna",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/sechura",
        planetId: "planet:pluto",
        name: "Sechura",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/seven-sirens",
        planetId: "region:pluto_proxima",
        name: "Seven Sirens",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/seven-sirens-(caches)",
        planetId: "region:pluto_proxima",
        name: "Seven Sirens (Caches)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/seven-sirens-(extra)",
        planetId: "region:pluto_proxima",
        name: "Seven Sirens (Extra)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/acheron",
        planetId: "planet:pluto",
        name: "Acheron",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/minthe",
        planetId: "planet:pluto",
        name: "Minthe",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/pluto/narcissus",
        planetId: "planet:pluto",
        name: "Narcissus",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },

    // =============================
    // Sedna (drop-data missionRewards) add=21
    // =============================
    {
        id: "node:mr/sedna/amarna",
        planetId: "planet:sedna",
        name: "Amarna",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/berehynia",
        planetId: "planet:sedna",
        name: "Berehynia",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/camenae",
        planetId: "planet:sedna",
        name: "Camenae",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/hydron",
        planetId: "planet:sedna",
        name: "Hydron",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/jengu",
        planetId: "planet:sedna",
        name: "Jengu",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/kappa",
        planetId: "planet:sedna",
        name: "Kappa",
        nodeType: "mission",
        missionType: "Disruption",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/kelpie",
        planetId: "planet:sedna",
        name: "Kelpie",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/merrow",
        planetId: "planet:sedna",
        name: "Merrow",
        nodeType: "boss",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/naga",
        planetId: "planet:sedna",
        name: "Naga",
        nodeType: "mission",
        missionType: "Assassination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/nakki",
        planetId: "planet:sedna",
        name: "Nakki",
        nodeType: "mission",
        missionType: "Arena",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/phithale-(caches)",
        planetId: "planet:sedna",
        name: "Phithale (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/rusalka-(caches)",
        planetId: "planet:sedna",
        name: "Rusalka (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/sangeru",
        planetId: "planet:sedna",
        name: "Sangeru",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/scylla",
        planetId: "planet:sedna",
        name: "Scylla",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/selkie",
        planetId: "planet:sedna",
        name: "Selkie",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/tikoloshe",
        planetId: "planet:sedna",
        name: "Tikoloshe",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/undine",
        planetId: "planet:sedna",
        name: "Undine",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/veles",
        planetId: "planet:sedna",
        name: "Veles",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/vodyanoi",
        planetId: "planet:sedna",
        name: "Vodyanoi",
        nodeType: "mission",
        missionType: "Arena",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/yam",
        planetId: "planet:sedna",
        name: "Yam",
        nodeType: "mission",
        missionType: "Arena",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/yemaja",
        planetId: "planet:sedna",
        name: "Yemaja",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/adaro",
        planetId: "planet:sedna",
        name: "Adaro",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/charybdis",
        planetId: "planet:sedna",
        name: "Charybdis",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sedna/marid",
        planetId: "planet:sedna",
        name: "Marid",
        nodeType: "mission",
        missionType: "Hijack",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Eris (drop-data missionRewards) add=22
    // =============================
    {
        id: "node:mr/eris/akkad",
        planetId: "planet:eris",
        name: "Akkad",
        nodeType: "mission",
        missionType: "Dark Sector Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/brugia",
        planetId: "planet:eris",
        name: "Brugia",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/candiru-(caches)",
        planetId: "planet:eris",
        name: "Candiru (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/cosis",
        planetId: "planet:eris",
        name: "Cosis",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/cyath",
        planetId: "planet:eris",
        name: "Cyath",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/gnathos",
        planetId: "planet:eris",
        name: "Gnathos",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/hymeno",
        planetId: "planet:eris",
        name: "Hymeno",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/isos",
        planetId: "planet:eris",
        name: "Isos",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/ixodes",
        planetId: "planet:eris",
        name: "Ixodes",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/kala-azar",
        planetId: "planet:eris",
        name: "Kala-Azar",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/lepis-(caches)",
        planetId: "planet:eris",
        name: "Lepis (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/naeglar-(caches)",
        planetId: "planet:eris",
        name: "Naeglar (Caches)",
        nodeType: "mission",
        missionType: "Hive",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/nimus",
        planetId: "planet:eris",
        name: "Nimus",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/oestrus",
        planetId: "planet:eris",
        name: "Oestrus",
        nodeType: "mission",
        missionType: "Infested Salvage",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/phalan",
        planetId: "planet:eris",
        name: "Phalan",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/psoro-(caches)",
        planetId: "planet:eris",
        name: "Psoro (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/ranova",
        planetId: "planet:eris",
        name: "Ranova",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/sparga",
        planetId: "planet:eris",
        name: "Sparga",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/sporid",
        planetId: "planet:eris",
        name: "Sporid",
        nodeType: "mission",
        missionType: "Hive Sabotage",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/viver-(caches)",
        planetId: "planet:eris",
        name: "Viver (Caches)",
        nodeType: "mission",
        missionType: "Ancient Retribution",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/xini",
        planetId: "planet:eris",
        name: "Xini",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/zabala",
        planetId: "planet:eris",
        name: "Zabala",
        nodeType: "boss",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/saxis",
        planetId: "planet:eris",
        name: "Saxis",
        nodeType: "mission",
        missionType: "Dark Sector Survival",
        faction: "Infested",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/eris/solium",
        planetId: "planet:eris",
        name: "Solium",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Infested",
        pos: undefined,
        edges: []
    },

    // =============================
    // Lua (drop-data missionRewards) add=11
    // =============================
    {
        id: "node:mr/lua/apollo",
        planetId: "region:lua",
        name: "Apollo",
        nodeType: "mission",
        missionType: "Disruption",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/circulus",
        planetId: "region:lua",
        name: "Circulus",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/circulus-(extra)",
        planetId: "region:lua",
        name: "Circulus (Extra)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/copernicus",
        planetId: "region:lua",
        name: "Copernicus",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/pavlov",
        planetId: "region:lua",
        name: "Pavlov",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/plato-(caches)",
        planetId: "region:lua",
        name: "Plato (Caches)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/stofler",
        planetId: "region:lua",
        name: "StöFler",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/tycho",
        planetId: "region:lua",
        name: "Tycho",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/yuvarium",
        planetId: "region:lua",
        name: "Yuvarium",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/yuvarium-(extra)",
        planetId: "region:lua",
        name: "Yuvarium (Extra)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/zeipel",
        planetId: "region:lua",
        name: "Zeipel",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/lua/grimaldi",
        planetId: "region:lua",
        name: "Grimaldi",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Kuva Fortress (drop-data missionRewards) add=6
    // =============================
    {
        id: "node:mr/kuva-fortress/dakata-(caches)",
        planetId: "region:kuva_fortress",
        name: "Dakata (Caches)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/kuva-fortress/garus",
        planetId: "region:kuva_fortress",
        name: "Garus",
        nodeType: "mission",
        missionType: "Rescue",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/kuva-fortress/nabuk",
        planetId: "region:kuva_fortress",
        name: "Nabuk",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/kuva-fortress/pago",
        planetId: "region:kuva_fortress",
        name: "Pago",
        nodeType: "mission",
        missionType: "Spy",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/kuva-fortress/tamu",
        planetId: "region:kuva_fortress",
        name: "Tamu",
        nodeType: "mission",
        missionType: "Disruption",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/kuva-fortress/taveuni",
        planetId: "region:kuva_fortress",
        name: "Taveuni",
        nodeType: "boss",
        missionType: "Survival",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/kuva-fortress/koro",
        planetId: "region:kuva_fortress",
        name: "Koro",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/kuva-fortress/rotuma",
        planetId: "region:kuva_fortress",
        name: "Rotuma",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Void (drop-data missionRewards) add=15
    // =============================
    {
        id: "node:mr/void/ani",
        planetId: "region:void",
        name: "Ani",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/aten",
        planetId: "region:void",
        name: "Aten",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/belenus",
        planetId: "region:void",
        name: "Belenus",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/hepit",
        planetId: "region:void",
        name: "Hepit",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/marduk",
        planetId: "region:void",
        name: "Marduk",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/marduk-(caches)",
        planetId: "region:void",
        name: "Marduk (Caches)",
        nodeType: "mission",
        missionType: "Sabotage",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/mithra",
        planetId: "region:void",
        name: "Mithra",
        nodeType: "mission",
        missionType: "Interception",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/mot",
        planetId: "region:void",
        name: "Mot",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/oxomoco",
        planetId: "region:void",
        name: "Oxomoco",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/stribog",
        planetId: "region:void",
        name: "Stribog",
        nodeType: "mission",
        missionType: "Orokin Sabotage",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/stribog-(caches)",
        planetId: "region:void",
        name: "Stribog (Caches)",
        nodeType: "mission",
        missionType: "Orokin Sabotage",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/taranis",
        planetId: "region:void",
        name: "Taranis",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/teshub",
        planetId: "region:void",
        name: "Teshub",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/tiwaz",
        planetId: "region:void",
        name: "Tiwaz",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/void/ukko",
        planetId: "region:void",
        name: "Ukko",
        nodeType: "mission",
        missionType: "Capture",
        faction: "Orokin",
        pos: undefined,
        edges: []
    },

    // =============================
    // Zariman (drop-data missionRewards) add=5
    // =============================
    {
        id: "node:mr/zariman/everview-arc",
        planetId: "region:zariman",
        name: "Everview Arc",
        nodeType: "mission",
        missionType: "Void Flood",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/zariman/halako-perimeter",
        planetId: "region:zariman",
        name: "Halako Perimeter",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/zariman/oro-works",
        planetId: "region:zariman",
        name: "Oro Works",
        nodeType: "mission",
        missionType: "Void Armageddon",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/zariman/the-greenway",
        planetId: "region:zariman",
        name: "The Greenway",
        nodeType: "mission",
        missionType: "Mobile Defense",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/zariman/tuvul-commons",
        planetId: "region:zariman",
        name: "Tuvul Commons",
        nodeType: "mission",
        missionType: "Void Cascade",
        faction: "Crossfire",
        pos: undefined,
        edges: []
    },

    // =============================
    // Duviri (drop-data missionRewards) add=16
    // =============================
    {
        id: "node:mr/duviri/endless-repeated-rewards",
        planetId: "region:duviri",
        name: "Endless: Repeated Rewards",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-repeated-rewards-hard",
        planetId: "region:duviri",
        name: "Endless: Repeated Rewards (Hard)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-1",
        planetId: "region:duviri",
        name: "Endless: Tier 1",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-1-hard",
        planetId: "region:duviri",
        name: "Endless: Tier 1 (Hard)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-2",
        planetId: "region:duviri",
        name: "Endless: Tier 2",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-3",
        planetId: "region:duviri",
        name: "Endless: Tier 3",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-3-hard",
        planetId: "region:duviri",
        name: "Endless: Tier 3 (Hard)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-4",
        planetId: "region:duviri",
        name: "Endless: Tier 4",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-4-hard",
        planetId: "region:duviri",
        name: "Endless: Tier 4 (Hard)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-6",
        planetId: "region:duviri",
        name: "Endless: Tier 6",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-6-hard",
        planetId: "region:duviri",
        name: "Endless: Tier 6 (Hard)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-7",
        planetId: "region:duviri",
        name: "Endless: Tier 7",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-8",
        planetId: "region:duviri",
        name: "Endless: Tier 8",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-9",
        planetId: "region:duviri",
        name: "Endless: Tier 9",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/endless-tier-9-hard",
        planetId: "region:duviri",
        name: "Endless: Tier 9 (Hard)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/duviri/the-circuit",
        planetId: "region:duviri",
        name: "The Circuit",
        nodeType: "mission",
        missionType: "Free Roam",
        faction: "Duviri",
        pos: undefined,
        edges: []
    },

    // =============================
    // Höllvania (drop-data missionRewards) add=11
    // =============================
    {
        id: "node:mr/hollvania/antivirus-bounty",
        planetId: "region:hollvania",
        name: "Antivirus Bounty",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/antivirus-bounty-(caches)",
        planetId: "region:hollvania",
        name: "Antivirus Bounty (Caches)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/assassinate-h-09-tank",
        planetId: "region:hollvania",
        name: "Assassinate: H-09 Tank",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/exterminate-scaldra",
        planetId: "region:hollvania",
        name: "Exterminate: Scaldra",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/exterminate-scaldra-(caches)",
        planetId: "region:hollvania",
        name: "Exterminate: Scaldra (Caches)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/exterminate-techrot",
        planetId: "region:hollvania",
        name: "Exterminate: Techrot",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/exterminate-techrot-(caches)",
        planetId: "region:hollvania",
        name: "Exterminate: Techrot (Caches)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/hell-scrub-scaldra",
        planetId: "region:hollvania",
        name: "Hell-Scrub: Scaldra",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/hell-scrub-techrot",
        planetId: "region:hollvania",
        name: "Hell-Scrub: Techrot",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/legacyte-harvest",
        planetId: "region:hollvania",
        name: "Legacyte Harvest",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/hollvania/solstice-square",
        planetId: "region:hollvania",
        name: "Solstice Square",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },

    // =============================
    // Dark Refractory, Deimos (drop-data missionRewards) add=3
    // =============================
    {
        id: "node:mr/dark-refractory-deimos/recall-dactolyst",
        planetId: "region:dark_refractory_deimos",
        name: "Recall: Dactolyst",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/dark-refractory-deimos/recall-hunhullus",
        planetId: "region:dark_refractory_deimos",
        name: "Recall: Hunhullus",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/dark-refractory-deimos/recall-vanguard",
        planetId: "region:dark_refractory_deimos",
        name: "Recall: Vanguard",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },

    // =============================
    // Sanctuary (drop-data missionRewards) add=2
    // =============================
    {
        id: "node:mr/sanctuary/elite-sanctuary-onslaught",
        planetId: "region:sanctuary",
        name: "Elite Sanctuary Onslaught",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/sanctuary/sanctuary-onslaught",
        planetId: "region:sanctuary",
        name: "Sanctuary Onslaught",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },

    // =============================
    // Veil (drop-data missionRewards) add=30
    // =============================
    {
        id: "node:mr/veil/arc-silver",
        planetId: "region:veil_proxima",
        name: "Arc Silver",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/arc-silver-(caches)",
        planetId: "region:veil_proxima",
        name: "Arc Silver (Caches)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/arc-silver-(extra)",
        planetId: "region:veil_proxima",
        name: "Arc Silver (Extra)",
        nodeType: "mission",
        missionType: "Defense",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/calabash",
        planetId: "region:veil_proxima",
        name: "Calabash",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/calabash-(caches)",
        planetId: "region:veil_proxima",
        name: "Calabash (Caches)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/calabash-(extra)",
        planetId: "region:veil_proxima",
        name: "Calabash (Extra)",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/erato",
        planetId: "region:veil_proxima",
        name: "Erato",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/erato-(caches)",
        planetId: "region:veil_proxima",
        name: "Erato (Caches)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/erato-(extra)",
        planetId: "region:veil_proxima",
        name: "Erato (Extra)",
        nodeType: "mission",
        missionType: "Orphix",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/flexa",
        planetId: "region:veil_proxima",
        name: "Flexa",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/flexa-(caches)",
        planetId: "region:veil_proxima",
        name: "Flexa (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/flexa-(extra)",
        planetId: "region:veil_proxima",
        name: "Flexa (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/h-2-cloud",
        planetId: "region:veil_proxima",
        name: "H-2 Cloud",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/h-2-cloud-(caches)",
        planetId: "region:veil_proxima",
        name: "H-2 Cloud (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/h-2-cloud-(extra)",
        planetId: "region:veil_proxima",
        name: "H-2 Cloud (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/lu-yan",
        planetId: "region:veil_proxima",
        name: "Lu-Yan",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/lu-yan-(caches)",
        planetId: "region:veil_proxima",
        name: "Lu-Yan (Caches)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/lu-yan-(extra)",
        planetId: "region:veil_proxima",
        name: "Lu-Yan (Extra)",
        nodeType: "mission",
        missionType: "Survival",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/nsu-grid",
        planetId: "region:veil_proxima",
        name: "Nsu Grid",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/nsu-grid-(caches)",
        planetId: "region:veil_proxima",
        name: "Nsu Grid (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/nsu-grid-(extra)",
        planetId: "region:veil_proxima",
        name: "Nsu Grid (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/numina",
        planetId: "region:veil_proxima",
        name: "Numina",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/numina-(caches)",
        planetId: "region:veil_proxima",
        name: "Numina (Caches)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/numina-(extra)",
        planetId: "region:veil_proxima",
        name: "Numina (Extra)",
        nodeType: "mission",
        missionType: "Volatile",
        faction: "Corpus",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/r-9-cloud",
        planetId: "region:veil_proxima",
        name: "R-9 Cloud",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/r-9-cloud-(caches)",
        planetId: "region:veil_proxima",
        name: "R-9 Cloud (Caches)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/r-9-cloud-(extra)",
        planetId: "region:veil_proxima",
        name: "R-9 Cloud (Extra)",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/sabmir-cloud",
        planetId: "region:veil_proxima",
        name: "Sabmir Cloud",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/sabmir-cloud-(caches)",
        planetId: "region:veil_proxima",
        name: "Sabmir Cloud (Caches)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/sabmir-cloud-(extra)",
        planetId: "region:veil_proxima",
        name: "Sabmir Cloud (Extra)",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/galanens-grave",
        planetId: "region:veil_proxima",
        name: "Ganalen's Grave",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/gian-point",
        planetId: "region:veil_proxima",
        name: "Gian Point",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/ruse-war-field",
        planetId: "region:veil_proxima",
        name: "Ruse War Field",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/veil/rya",
        planetId: "region:veil_proxima",
        name: "Rya",
        nodeType: "mission",
        missionType: "Skirmish",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },

    // =============================
    // Uranus Proxima (Update 43)
    // =============================
    {
        id: "node:mr/uranus-proxima/the-kuva-wytch",
        planetId: "region:uranus_proxima",
        name: "The Kuva Wytch",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/uranus-proxima/scorias-angel",
        planetId: "region:uranus_proxima",
        name: "Scoria's Angel",
        nodeType: "mission",
        pos: undefined,
        edges: []
    },

    // =============================
    // Hub / Open World nodes
    // These are nodes that appear as selectable locations in the Star Chart
    // but lead to social hubs or open-world zones rather than standard missions.
    // =============================

    // --- Earth hubs & missing mission nodes ---
    {
        id: "node:mr/earth/e-prime",
        planetId: "planet:earth",
        name: "E Prime",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/earth/mariana",
        planetId: "planet:earth",
        name: "Mariana",
        nodeType: "mission",
        missionType: "Extermination",
        faction: "Grineer",
        pos: undefined,
        edges: []
    },
    {
        id: "node:hub/earth/strata-relay",
        planetId: "planet:earth",
        name: "Strata Relay",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },
    {
        id: "node:hub/earth/cetus",
        planetId: "planet:earth",
        name: "Cetus",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Venus hubs ---
    {
        id: "node:hub/venus/fortuna",
        planetId: "planet:venus",
        name: "Fortuna",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },
    {
        id: "node:hub/venus/vesper-relay",
        planetId: "planet:venus",
        name: "Vesper Relay",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },
    // Vesper Relay hosts Follie's Hunt since the Warframe: 1999 update.
    // Separate mission nodes (distinct from the hub) so the drop map resolves sources correctly.
    {
        id: "node:mr/venus/vesper-relay",
        planetId: "planet:venus",
        name: "Vesper Relay",
        nodeType: "special",
        pos: undefined,
        edges: []
    },
    {
        id: "node:mr/venus/vesper-relay-(extra)",
        planetId: "planet:venus",
        name: "Vesper Relay (Steel Path)",
        nodeType: "special",
        pos: undefined,
        edges: []
    },

    // --- Mercury hubs ---
    {
        id: "node:hub/mercury/larunda-relay",
        planetId: "planet:mercury",
        name: "Larunda Relay",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Deimos hubs ---
    {
        id: "node:hub/deimos/necralisk",
        planetId: "planet:deimos",
        name: "Necralisk",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Mars hubs ---
    {
        id: "node:hub/mars/maroos-bazaar",
        planetId: "planet:mars",
        name: "Maroo's Bazaar",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Europa hubs ---
    // Leonov Relay is on Europa (destroyed; still appears as a node).
    {
        id: "node:hub/europa/leonov-relay",
        planetId: "planet:europa",
        name: "Leonov Relay",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Saturn hubs ---
    {
        id: "node:hub/saturn/kronia-relay",
        planetId: "planet:saturn",
        name: "Kronia Relay",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Pluto hubs ---
    {
        id: "node:hub/pluto/orcus-relay",
        planetId: "planet:pluto",
        name: "Orcus Relay",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Eris hubs ---
    // Kuiper Relay is on Eris (destroyed; still appears as a node).
    {
        id: "node:hub/eris/kuiper-relay",
        planetId: "planet:eris",
        name: "Kuiper Relay",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Zariman hubs ---
    {
        id: "node:hub/zariman/chrysalith",
        planetId: "region:zariman",
        name: "Chrysalith",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },
    {
        id: "node:hub/zariman/yuvan-peak",
        planetId: "region:zariman",
        name: "Yuvan Peak",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Uranus Proxima hubs ---
    {
        id: "node:hub/uranus-proxima/pontis-tower",
        planetId: "region:uranus_proxima",
        name: "Pontis Tower",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Dark Refractory hubs ---
    {
        id: "node:hub/dark-refractory-deimos/la-cathedrale",
        planetId: "region:dark_refractory_deimos",
        name: "La Cathédrale",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },

    // --- Höllvania hubs ---
    {
        id: "node:hub/hollvania/sanctum-anatomica",
        planetId: "region:hollvania",
        name: "Sanctum Anatomica",
        nodeType: "hub",
        pos: undefined,
        edges: []
    },
];
