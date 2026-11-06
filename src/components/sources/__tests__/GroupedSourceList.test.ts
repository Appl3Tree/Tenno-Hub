import { describe, expect, it } from "vitest";
import { classifySourceFamilyFromCatalog, dedupeGroupedSourceEntries } from "../GroupedSourceList";
import { getSyndicateVendorOffer, getSyndicateVendorPrice, parseSyndicateVendorLabel } from "../../../catalog/sources/syndicateVendorPricing";
import { buildInventorySourceEntries, normalizeCacheKey, resolveComponentDrops } from "../../../pages/Inventory";

describe("grouped source dedupe", () => {
    it("classifies explicit Conclave catalog sources as activity instead of enemy", () => {
        expect(classifySourceFamilyFromCatalog("data:conclave", "Play Conclave (PvP)")).toBe("activity");
    });

    it("collapses generic and ranked syndicate vendor entries into the richer vendor row", () => {
        const rankedLabel = "Syndicate Vendor: Arbiters of Hexis (Arbiters of Hexis, Authentic)";
        const parsed = parseSyndicateVendorLabel(rankedLabel);
        const standing = getSyndicateVendorPrice(["Barrel", "Phaedra Barrel", "Phaedra Barrel Blueprint"], rankedLabel);

        const entries = [
            {
                id: "catalog:data:drop:41f0de103b",
                family: "vendor" as const,
                dedupeKey: `vendor:${parsed?.vendorName}`,
                title: parsed?.vendorName ?? rankedLabel,
                subtitle: parsed?.rankName ? `Rank ${parsed?.rankNumber ?? "?"} · ${parsed.rankName}` : undefined,
                meta: standing != null ? `${standing.toLocaleString()} Standing` : undefined,
            },
            {
                id: "catalog:data:vendor/syndicate/arbiters-of-hexis",
                family: "vendor" as const,
                dedupeKey: `vendor:${parsed?.vendorName}`,
                title: "Arbiters of Hexis",
            },
        ];

        expect(dedupeGroupedSourceEntries(entries)).toEqual([
            {
                id: "catalog:data:drop:41f0de103b",
                family: "vendor",
                dedupeKey: "vendor:Arbiters of Hexis",
                title: "Arbiters of Hexis",
                subtitle: "Rank 2 · Authentic",
                meta: "20,000 Standing",
                _sortIndex: 0,
                badges: [],
            },
        ]);
    });

    it("prefers rated cache entries when catalog and drop rows describe the same cache source", () => {
        const entries = [
            {
                id: "catalog:data:caches/ceres/ker",
                family: "cache" as const,
                dedupeKey: "cache:ceres/ker",
                title: "Caches: Ceres / Ker",
            },
            {
                id: "drop:Ceres/Ker (Caches), Rotation C",
                family: "cache" as const,
                dedupeKey: "cache:ceres/ker",
                title: "Ceres/Ker (Caches), Rotation C",
                meta: "4.40%",
                sortValue: 4.4,
            },
        ];

        expect(dedupeGroupedSourceEntries(entries)).toEqual([
            {
                id: "drop:Ceres/Ker (Caches), Rotation C",
                family: "cache",
                dedupeKey: "cache:ceres/ker",
                title: "Ceres/Ker (Caches), Rotation C",
                meta: "4.40%",
                sortValue: 4.4,
                _sortIndex: 0,
                badges: [],
            },
        ]);
    });
});

describe("syndicate vendor rank parsing", () => {
    it("derives vendor-specific rank numbers from hardcoded syndicate entries", () => {
        const parsed = parseSyndicateVendorLabel("Syndicate Vendor: New Loka (New Loka, Bountiful)");
        const standing = getSyndicateVendorPrice("Phaedra Stock", "Syndicate Vendor: New Loka (New Loka, Bountiful)");

        expect(parsed).toEqual({
            vendorName: "New Loka",
            place: "New Loka, Bountiful",
            rankName: "Bountiful",
            rankNumber: 2,
        });
        expect(standing).toBe(20000);
    });

    it("resolves generic Cephalon Simaris vendor rows to the matched standing offer", () => {
        const offer = getSyndicateVendorOffer("Sevagoth Blueprint", "Cephalon Simaris");

        expect(offer).toEqual({
            vendorName: "Cephalon Simaris",
            place: "Cephalon Simaris, Complete Call of the Tempestarii",
            standing: 50000,
            rankName: null,
            rankNumber: null,
        });
    });
});

describe("inventory cache normalization", () => {
    it("normalizes both catalog and drop cache labels to the same key", () => {
        expect(normalizeCacheKey("Caches: Ceres / Ker")).toBe("cache:ceres/ker");
        expect(normalizeCacheKey("Caches: Ceres - Ker")).toBe("cache:ceres/ker");
        expect(normalizeCacheKey("Ceres/Ker (Caches), Rotation C")).toBe("cache:ceres/ker");
    });

    it("hydrates component drops from the underlying item entry when the recipe component is stripped", () => {
        const drops = resolveComponentDrops({
            uniqueName: "/Lotus/Types/Items/MiscItems/Tellurium",
            name: "Tellurium",
        });

        expect(drops.length).toBeGreaterThan(0);
        expect(drops.some((drop) => drop.location.includes("(Caches)"))).toBe(true);
        expect(drops.some((drop) => drop.location === "Ceres/Ker (Caches), Rotation C" && drop.chance === 4.4)).toBe(true);
    });

    it("uses the drop record attached to the exact Archwing recipe component", () => {
        const drops = resolveComponentDrops({
            uniqueName: "/Lotus/Types/Recipes/Weapons/WeaponParts/ArchLongRifleStock",
            name: "Stock",
        });

        expect(drops).toEqual([
            {
                location: "New Loka, Bountiful",
                type: "Phaedra Stock",
                chance: 100,
                rarity: "Common",
            },
        ]);
    });

    it("hydrates missing resource drop rows from the derived reverse-drop index", () => {
        const drops = resolveComponentDrops({
            uniqueName: "/Lotus/Types/Items/MiscItems/OrokinCell",
            name: "Orokin Cell",
        });

        expect(drops.length).toBeGreaterThan(0);
        expect(drops.some((drop) => drop.location.includes("Saturn/Annihilation") && drop.chance === 0.25)).toBe(true);
    });

    it("hydrates resource drops from raw drop tables when direct and derived indexes are empty", () => {
        const drops = resolveComponentDrops({
            uniqueName: "/Lotus/Types/Items/MiscItems/Neurode",
            name: "Neurodes",
        });

        expect(drops.length).toBeGreaterThan(0);
        expect(drops.some((drop) => drop.location.includes("Vem Tabook") && drop.chance === 100)).toBe(true);
        expect(drops.some((drop) => drop.location.includes("Level 40 - 60 Orb Vallis Bounty") && drop.chance === 33.33)).toBe(true);
    });

    it("collapses avatar enemy catalog labels into the rated enemy drop row", () => {
        const entries = [
            {
                id: "catalog:data:enemy/exo-butcher",
                family: "enemy" as const,
                dedupeKey: "enemy:exo butcher",
                title: "Exo Butcher",
            },
            {
                id: "drop:Exo Butcher:0.18:Rare",
                family: "enemy" as const,
                dedupeKey: "enemy:exo butcher",
                title: "Exo Butcher",
                meta: "0.18%",
                sortValue: 0.18,
            },
        ];

        expect(dedupeGroupedSourceEntries(entries)).toEqual([
            {
                id: "drop:Exo Butcher:0.18:Rare",
                family: "enemy",
                dedupeKey: "enemy:exo butcher",
                title: "Exo Butcher",
                meta: "0.18%",
                sortValue: 0.18,
                _sortIndex: 0,
                badges: [],
            },
        ]);
    });

    it("collapses generic enemy-drop catalog labels into the same enemy entry", () => {
        const entries = [
            {
                id: "catalog:data:enemyitem/demolisher-charger",
                family: "enemy" as const,
                dedupeKey: "enemy:demolisher charger",
                title: "Demolisher Charger",
            },
            {
                id: "drop:Demolisher Charger:2.5:Common",
                family: "enemy" as const,
                dedupeKey: "enemy:demolisher charger",
                title: "Demolisher Charger",
                meta: "2.50%",
                sortValue: 2.5,
            },
        ];

        expect(dedupeGroupedSourceEntries(entries)).toEqual([
            {
                id: "drop:Demolisher Charger:2.5:Common",
                family: "enemy",
                dedupeKey: "enemy:demolisher charger",
                title: "Demolisher Charger",
                meta: "2.50%",
                sortValue: 2.5,
                _sortIndex: 0,
                badges: [],
            },
        ]);
    });

    it("collapses polluted missionreward cache nodes onto the rated cache entry", () => {
        const entries = buildInventorySourceEntries({
            itemName: "Tellurium",
            sourceIds: [
                "data:caches/ceres/ker",
                "data:missionreward/ceres/ker",
                "data:missionreward/ceres/ker/rotationc",
                "data:node/ceres/ker-caches",
            ],
            drops: [
                {
                    location: "Ceres/Ker (Caches), Rotation C",
                    chance: 4.4,
                    rarity: "Rare",
                },
            ],
        });

        const cacheEntries = dedupeGroupedSourceEntries(entries).filter((entry) => entry.family === "cache");
        const missionEntries = dedupeGroupedSourceEntries(entries).filter((entry) => entry.family === "mission");

        expect(cacheEntries).toEqual([
            expect.objectContaining({
                title: "Ceres/Ker (Caches), Rotation C",
                meta: "4.40%",
                family: "cache",
            }),
        ]);
        expect(missionEntries).toEqual([]);
    });

    it("normalizes mixed mission reward labels so rotation rows stay consistent while keeping the base mission row", () => {
        const entries = buildInventorySourceEntries({
            itemName: "Hexenon",
            sourceIds: [
                "data:missionreward/jupiter/ganymede/rotationb",
                "data:missionreward/jupiter/ganymede",
            ],
            drops: [
                {
                    location: "Jupiter/Ganymede (Disruption), Rotation A",
                    chance: 27.78,
                    rarity: "Uncommon",
                },
                {
                    location: "Jupiter/Ganymede (Disruption), Rotation C",
                    chance: 30,
                    rarity: "Uncommon",
                },
            ],
        });

        const missionEntries = dedupeGroupedSourceEntries(entries).filter((entry) => entry.family === "mission");

        expect(missionEntries).toHaveLength(4);
        expect(missionEntries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                meta: "30.00%",
                badges: expect.arrayContaining([expect.objectContaining({ label: "Rot C" })]),
            }),
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                meta: "27.78%",
                badges: expect.arrayContaining([expect.objectContaining({ label: "Rot A" })]),
            }),
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                badges: expect.arrayContaining([expect.objectContaining({ label: "Rot B" })]),
            }),
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                dedupeKey: "mission:jupiter/ganymede",
            }),
        ]));
    });

    it("keeps technicalized rotation missionreward ids instead of dropping them as base duplicates", () => {
        const entries = buildInventorySourceEntries({
            itemName: "Hexenon",
            sourceIds: [
                "data:drop:missionreward/jupiter/ganymede/rotationb",
                "data:drop:missionreward/jupiter/ganymede",
            ],
            drops: [
                {
                    location: "Jupiter/Ganymede (Disruption), Rotation A",
                    chance: 27.78,
                    rarity: "Uncommon",
                },
                {
                    location: "Jupiter/Ganymede (Disruption), Rotation C",
                    chance: 30,
                    rarity: "Uncommon",
                },
            ],
        });

        const missionEntries = dedupeGroupedSourceEntries(entries).filter((entry) => entry.family === "mission");

        expect(missionEntries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                badges: expect.arrayContaining([expect.objectContaining({ label: "Rot B" })]),
            }),
        ]));
        expect(missionEntries.some((entry) => entry.dedupeKey === "mission:jupiter/ganymede")).toBe(true);
    });

    it("keeps same-rate mission rotations distinct for the real Hexenon acquisition mix", () => {
        const entries = buildInventorySourceEntries({
            itemName: "Hexenon",
            sourceIds: [
                "data:drop:node:jupiter:ganymede",
                "data:missionreward/jupiter/ganymede",
                "data:missionreward/jupiter/ganymede/rotationa",
                "data:missionreward/jupiter/ganymede/rotationb",
                "data:missionreward/jupiter/ganymede/rotationc",
                "data:node/jupiter/ganymede",
            ],
            drops: [
                {
                    location: "Jupiter/Ganymede (Disruption), Rotation A",
                    chance: 27.78,
                    rarity: "Uncommon",
                },
                {
                    location: "Jupiter/Ganymede (Disruption), Rotation B",
                    chance: 27.78,
                    rarity: "Uncommon",
                },
                {
                    location: "Jupiter/Ganymede (Disruption), Rotation C",
                    chance: 30,
                    rarity: "Uncommon",
                },
            ],
        });

        const missionEntries = dedupeGroupedSourceEntries(entries).filter((entry) => entry.family === "mission");

        expect(missionEntries).toHaveLength(4);
        expect(missionEntries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                meta: "27.78%",
                badges: expect.arrayContaining([expect.objectContaining({ label: "Rot A" })]),
            }),
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                meta: "27.78%",
                badges: expect.arrayContaining([expect.objectContaining({ label: "Rot B" })]),
            }),
            expect.objectContaining({
                title: "Jupiter/Ganymede (Disruption)",
                meta: "30.00%",
                badges: expect.arrayContaining([expect.objectContaining({ label: "Rot C" })]),
            }),
            expect.objectContaining({
                title: "Mission: Jupiter/Ganymede (Disruption)",
                dedupeKey: "mission:jupiter/ganymede",
            }),
        ]));
    });

    it("hydrates generic conclave mission rows with rates and rotation badges from matching drop clusters", () => {
        const entries = buildInventorySourceEntries({
            itemName: "Nano Spores",
            sourceIds: [
                "data:node/neptune/cephalon-capture",
                "data:node/saturn/annihilation",
            ],
            drops: [
                {
                    location: "Neptune/Cephalon Capture (Conclave), Rotation B",
                    chance: 12.65,
                    rarity: "Uncommon",
                },
                {
                    location: "Saturn/Annihilation (Conclave), Rotation B",
                    chance: 12.65,
                    rarity: "Uncommon",
                },
            ],
        });

        const neptuneCatalogEntry = entries.find((entry) => entry.id === "catalog:data:node/neptune/cephalon-capture");
        const saturnCatalogEntry = entries.find((entry) => entry.id === "catalog:data:node/saturn/annihilation");

        expect(neptuneCatalogEntry).toEqual(expect.objectContaining({
            title: "Neptune - Cephalon Capture (Conclave)",
            family: "activity",
            meta: "12.65%",
            badges: expect.arrayContaining([
                expect.objectContaining({ label: "Rot B" }),
                expect.objectContaining({ label: "Uncommon" }),
            ]),
        }));
        expect(saturnCatalogEntry).toEqual(expect.objectContaining({
            family: "activity",
            title: "Saturn - Annihilation (Conclave)",
            meta: "12.65%",
            badges: expect.arrayContaining([
                expect.objectContaining({ label: "Rot B" }),
                expect.objectContaining({ label: "Uncommon" }),
            ]),
        }));
    });

    it("suppresses coarse conclave fallback rows when detailed conclave drops are available", () => {
        const entries = buildInventorySourceEntries({
            itemName: "Nano Spores",
            sourceIds: [
                "data:conclave",
                "data:node/neptune/cephalon-capture",
            ],
            drops: [
                {
                    location: "Neptune/Cephalon Capture (Conclave), Rotation B",
                    chance: 12.65,
                    rarity: "Uncommon",
                },
            ],
        });

        const dedupedEntries = dedupeGroupedSourceEntries(entries);

        expect(dedupedEntries.some((entry) => entry.title === "Play Conclave (PvP)")).toBe(false);
        expect(dedupedEntries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                family: "activity",
                title: "Neptune/Cephalon Capture (Conclave)",
                meta: "12.65%",
                badges: expect.arrayContaining([
                    expect.objectContaining({ label: "Rot B" }),
                    expect.objectContaining({ label: "Uncommon" }),
                ]),
            }),
        ]));
    });

    it("hydrates generic bounty rows with a truthful rate range from matching rated drops", () => {
        const entries = buildInventorySourceEntries({
            itemName: "Nano Spores",
            sourceIds: [
                "data:bounty/solaris/level-10-30-orb-vallis-bounty",
            ],
            drops: [
                {
                    location: "Venus/Orb Vallis (Level 10 - 30 Orb Vallis Bounty), Rotation C",
                    chance: 13.24,
                    rarity: "Uncommon",
                },
                {
                    location: "Venus/Orb Vallis (Level 10 - 30 Orb Vallis Bounty), Rotation C",
                    chance: 15,
                    rarity: "Uncommon",
                },
                {
                    location: "Venus/Orb Vallis (Level 10 - 30 Orb Vallis Bounty), Rotation C",
                    chance: 25,
                    rarity: "Uncommon",
                },
            ],
        });

        const bountyCatalogEntry = entries.find((entry) => entry.id === "catalog:data:bounty/solaris/level-10-30-orb-vallis-bounty");

        expect(bountyCatalogEntry).toEqual(expect.objectContaining({
            family: "mission",
            title: "Solaris Bounty: Level 10/30 Orb Vallis Bounty",
            meta: "13.24%-25.00%",
            badges: expect.arrayContaining([
                expect.objectContaining({ label: "Rot C" }),
                expect.objectContaining({ label: "Uncommon" }),
            ]),
        }));
    });
});
