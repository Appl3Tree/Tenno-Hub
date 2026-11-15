import { describe, expect, it } from "vitest";
import { getAcquisitionByCatalogId } from "../../../catalog/items/itemAcquisition";
import { PREREQ_REGISTRY } from "../../../catalog/prereqs/prereqRegistry";
import { SOURCE_INDEX } from "../../../catalog/sources/sourceCatalog";
import { FULL_CATALOG, type CatalogId } from "../../catalog/loadFullCatalog";
import { PR } from "../../ids/prereqIds";
import { normalizeSourceId } from "../../ids/sourceIds";
import { evaluateSourcePrerequisiteAccess } from "../sourcePrerequisiteAccess";
import { canAccessCatalogItem } from "../plannerEngine";
import { buildFarmingSnapshot, type RequirementsResult } from "../requirementEngine";

describe("source prerequisite access", () => {
    it("honors explicit gates on registered drop routes", () => {
        const sourceId = normalizeSourceId("data:drop:node:ceres:bode");
        expect(SOURCE_INDEX[sourceId]?.prereqIds).toEqual([PR.JUNCTION_MARS_CERES]);

        expect(evaluateSourcePrerequisiteAccess(sourceId, {})).toEqual({
            known: true,
            accessible: false,
            missingPrereqs: [PR.JUNCTION_MARS_CERES],
        });
        expect(evaluateSourcePrerequisiteAccess(sourceId, { [PR.JUNCTION_MARS_CERES]: true })).toEqual({
            known: true,
            accessible: true,
            missingPrereqs: [],
        });
    });

    it("does not let duplicate mission-source IDs leak another planet's gate", () => {
        expect(SOURCE_INDEX[normalizeSourceId("data:drop:node:earth:sayas-visions")]?.prereqIds)
            .toEqual([PR.SAYA_VIGIL, PR.ONCE_AWAKE]);
        expect(SOURCE_INDEX[normalizeSourceId("data:drop:node:europa:cryotic-front")]?.prereqIds)
            .toEqual([PR.JUNCTION_JUPITER_EUROPA]);
    });

    it("requires Saya's Vigil and Once Awake for every Saya's Visions source alias", () => {
        const expected = [PR.SAYA_VIGIL, PR.ONCE_AWAKE];
        const sourceIds = [
            "data:node/earth/sayas-visions",
            "data:drop:node:earth:sayas_visions",
            "data:drop:node:earth:sayas-visions",
            "data:missionreward/earth/sayas-visions",
            "data:wfitems:loc:earthsayas-visions-shrine-defense",
        ];

        for (const rawSourceId of sourceIds) {
            const sourceId = normalizeSourceId(rawSourceId);
            expect(SOURCE_INDEX[sourceId]?.prereqIds, rawSourceId).toEqual(expected);
            expect(evaluateSourcePrerequisiteAccess(sourceId, {}).missingPrereqs, rawSourceId).toEqual(expected);
        }
    });

    it("keeps the Simaris vendor generally open at a Relay and scopes New Strange to its named reward", () => {
        const generalSimarisSources = [
            "data:vendor/simaris",
            "data:vendor/syndicate/cephalon-simaris",
            "data:wfitems:loc:cephalon-simaris",
        ];
        for (const rawSourceId of generalSimarisSources) {
            const prereqIds = SOURCE_INDEX[normalizeSourceId(rawSourceId)]?.prereqIds;
            expect(prereqIds, rawSourceId).toEqual([PR.HUB_RELAY]);
            expect(prereqIds, rawSourceId).not.toContain(PR.NEW_STRANGE);
        }

        expect(SOURCE_INDEX[normalizeSourceId("data:wfitems:loc:cephalon-simaris-complete-the-new-strange")]?.prereqIds)
            .toEqual([PR.HUB_RELAY, PR.NEW_STRANGE]);
    });

    it("does not make Steel Path a prerequisite for buying from Koumei's Cetus shrine", () => {
        const shrine = SOURCE_INDEX[normalizeSourceId("data:vendor/cetus/koumei-shrine")];
        expect(shrine?.prereqIds).toEqual([PR.HUB_CETUS]);
        expect(shrine?.prereqIds).not.toContain(PR.ACTIVITY_STEEL_PATH);
    });

    it("adds the Steel Path gate to region-mapped Steel Path mission nodes", () => {
        expect(SOURCE_INDEX[normalizeSourceId("data:drop:node:ceres:exta_extra")]?.prereqIds)
            .toEqual([PR.JUNCTION_MARS_CERES, PR.ACTIVITY_STEEL_PATH]);
    });

    it("routes every Uranus Proxima mission-source alias through its Update 43 unlock", () => {
        const aliases = [
            { id: "data:node/uranus/scorias-angel", prereq: PR.ACTIVITY_SCORIAS_ANGEL },
            { id: "data:drop:node:uranus:scorias_angel", prereq: PR.ACTIVITY_SCORIAS_ANGEL },
            { id: "data:drop:node:uranus:scorias-angel", prereq: PR.ACTIVITY_SCORIAS_ANGEL },
            { id: "data:missionreward/uranus/scorias-angel", prereq: PR.ACTIVITY_SCORIAS_ANGEL },
            { id: "data:wfitems:loc:uranusscorias-angel-skirmish", prereq: PR.ACTIVITY_SCORIAS_ANGEL },
            { id: "data:node/uranus/the-kuva-wytch", prereq: PR.ACTIVITY_KUVA_WYTCH },
            { id: "data:drop:node:uranus:the_kuva_wytch", prereq: PR.ACTIVITY_KUVA_WYTCH },
            { id: "data:drop:node:uranus:the-kuva-wytch", prereq: PR.ACTIVITY_KUVA_WYTCH },
            { id: "data:missionreward/uranus/the-kuva-wytch", prereq: PR.ACTIVITY_KUVA_WYTCH },
            { id: "data:wfitems:loc:uranusthe-kuva-wytch-skirmish", prereq: PR.ACTIVITY_KUVA_WYTCH },
        ];

        for (const { id, prereq } of aliases) {
            const sourceId = normalizeSourceId(id);
            expect(SOURCE_INDEX[sourceId]?.prereqIds, id).toEqual([prereq]);
            expect(SOURCE_INDEX[sourceId]?.prereqIds, id).not.toContain(PR.JUNCTION_SATURN_URANUS);
            expect(evaluateSourcePrerequisiteAccess(sourceId, {}).missingPrereqs, id).toEqual([prereq]);
        }

        const steelPathAliases = [
            "data:node/uranus/scorias-angel-extra",
            "data:drop:node:uranus:scorias_angel_extra",
            "data:missionreward/uranus/scorias-angel-extra",
            "data:node/uranus/the-kuva-wytch-extra",
            "data:drop:node:uranus:the_kuva_wytch_extra",
            "data:missionreward/uranus/the-kuva-wytch-extra",
        ];
        for (const id of steelPathAliases) {
            const sourceId = normalizeSourceId(id);
            const expectedActivity = /scoria/i.test(id) ? PR.ACTIVITY_SCORIAS_ANGEL : PR.ACTIVITY_KUVA_WYTCH;
            expect(SOURCE_INDEX[sourceId]?.prereqIds, id).toEqual([expectedActivity, PR.ACTIVITY_STEEL_PATH]);
        }
    });

    it("maps Holdfast vendor source tokens to the correct standing rank", () => {
        const rankCases = [
            { token: "fallen", prereq: PR.SYNDICATE_HOLDFASTS_RANK1 },
            { token: "watcher", prereq: PR.SYNDICATE_HOLDFASTS_RANK2 },
            { token: "guardian", prereq: PR.SYNDICATE_HOLDFASTS_RANK3 },
            { token: "seraph", prereq: PR.SYNDICATE_HOLDFASTS_RANK4 },
            { token: "angel", prereq: PR.SYNDICATE_HOLDFASTS_RANK5 },
        ];
        for (const vendor of ["cavalero", "hombask"]) {
            expect(SOURCE_INDEX[normalizeSourceId(`data:syndicate/holdfasts/${vendor}/neutral`)]?.prereqIds)
                .toEqual([PR.HUB_ZARIMAN]);
            for (const { token, prereq } of rankCases) {
                const id = `data:syndicate/holdfasts/${vendor}/${token}`;
                expect(SOURCE_INDEX[normalizeSourceId(id)]?.prereqIds, id).toEqual([PR.HUB_ZARIMAN, prereq]);
            }
        }
    });

    it("keeps Conclave access separate from Relay and Steel Path access", () => {
        const conclaveSourceIds = [
            "data:conclave",
            "data:node/saturn/annihilation",
            "data:node/saturn/annihilation-extra",
            "data:missionreward/saturn/lunaro-arena",
            "data:missionreward/saturn/lunaro-arena-extra",
            "data:drop:node:saturn:annihilation",
            "data:drop:node:saturn:annihilation_extra",
        ];

        for (const rawSourceId of conclaveSourceIds) {
            const sourceId = normalizeSourceId(rawSourceId);
            expect(SOURCE_INDEX[sourceId], rawSourceId).toBeDefined();
            expect(SOURCE_INDEX[sourceId]?.prereqIds, rawSourceId).toEqual([PR.AWAKENING]);
            expect(SOURCE_INDEX[sourceId]?.label, rawSourceId).not.toContain("Steel Path");
        }
        expect(SOURCE_INDEX[normalizeSourceId("data:conclave/typhoon")]?.prereqIds)
            .toEqual([PR.HUB_RELAY]);
        expect(evaluateSourcePrerequisiteAccess(normalizeSourceId("data:conclave"), {})).toMatchObject({
            known: true,
            accessible: false,
            missingPrereqs: [PR.AWAKENING],
        });
        expect(evaluateSourcePrerequisiteAccess(normalizeSourceId("data:conclave"), { [PR.AWAKENING]: true }))
            .toMatchObject({ known: true, accessible: true, missingPrereqs: [] });
    });

    it("does not relay-lock Sanctuary Onslaught and applies Elite eligibility only to Elite routes", () => {
        const regularNode = SOURCE_INDEX[normalizeSourceId("data:node/sanctuary/sanctuary-onslaught")];
        const eliteNode = SOURCE_INDEX[normalizeSourceId("data:node/sanctuary/elite-sanctuary-onslaught")];
        const eliteReward = SOURCE_INDEX[normalizeSourceId("data:missionreward/sanctuary/elite-sanctuary-onslaught/rotationa")];

        expect(regularNode?.prereqIds).toEqual([PR.NEW_STRANGE]);
        expect(eliteNode?.prereqIds).toEqual([PR.NEW_STRANGE, PR.SYSTEM_RANK30_WARFRAME]);
        expect(eliteReward?.prereqIds).toEqual([PR.NEW_STRANGE, PR.SYSTEM_RANK30_WARFRAME]);
        expect(regularNode?.prereqIds).not.toContain(PR.HUB_RELAY);
        expect(evaluateSourcePrerequisiteAccess(
            normalizeSourceId("data:node/sanctuary/sanctuary-onslaught"),
            { [PR.NEW_STRANGE]: true },
        )).toMatchObject({ known: true, accessible: true, missingPrereqs: [] });
    });

    it("does not apply Khora's farm gates to the item granted with Khora", () => {
        const sourceId = normalizeSourceId("data:warframe/khora");
        expect(SOURCE_INDEX[sourceId]?.prereqIds).toBeUndefined();
        expect(evaluateSourcePrerequisiteAccess(sourceId, {})).toMatchObject({
            known: true,
            accessible: true,
            missingPrereqs: [],
        });
    });

    it("gates both generated Duviri transient reward routes behind the Duviri quest", () => {
        expect(SOURCE_INDEX[normalizeSourceId("data:transient/duviri-circuit")]?.prereqIds)
            .toEqual([PR.DUVIRI_PARADOX]);
        expect(SOURCE_INDEX[normalizeSourceId("data:transient/duviri-full-experience")]?.prereqIds)
            .toEqual([PR.DUVIRI_PARADOX]);
    });

    it("uses owned Archwing equipment for Limbo, Jordas, and Fomorian routes instead of quest completion", () => {
        const limbo = SOURCE_INDEX[normalizeSourceId("data:quest/the-limbo-theorem")];
        const jordas = SOURCE_INDEX[normalizeSourceId("data:quest/the-jordas-precept")];
        const fomorian = Object.entries(SOURCE_INDEX).find(([, source]) => /^Transient Reward:\s*Fomorian Sabotage$/i.test(source.label));

        expect(limbo?.prereqIds).toEqual([PR.SYSTEM_ARCHWING_OWNED, PR.JUNCTION_JUPITER_EUROPA]);
        expect(jordas?.prereqIds).toEqual([PR.SYSTEM_ARCHWING_OWNED, PR.JUNCTION_PLUTO_SEDNA]);
        expect(fomorian?.[1].prereqIds).toEqual([PR.ACTIVITY_INVASIONS, PR.SYSTEM_ARCHWING_OWNED]);
        for (const sourceId of [normalizeSourceId("data:quest/the-limbo-theorem"), normalizeSourceId("data:quest/the-jordas-precept"), fomorian?.[0]]) {
            expect(sourceId).toBeDefined();
            expect(SOURCE_INDEX[sourceId!]?.prereqIds).not.toContain(PR.ARCHWING);
        }

        const archwingCatalogId = "items:/Lotus/Powersuits/Archwing/StandardJetPack/StandardJetPack";
        const effective = deriveCompletedMap({}, [], 0, {}, {}, { [archwingCatalogId]: 1 });
        expect(effective[PR.SYSTEM_ARCHWING_OWNED]).toBe(true);
        expect(evaluateSourcePrerequisiteAccess(normalizeSourceId("data:quest/the-limbo-theorem"), {
            ...effective,
            [PR.JUNCTION_JUPITER_EUROPA]: true,
        })).toMatchObject({ known: true, accessible: true, missingPrereqs: [] });
    });

    it("keeps generated reward and activity routes aligned to their actual access gates", () => {
        const sources = Object.entries(SOURCE_INDEX);
        const matches = (pattern: RegExp) => sources.filter(([, source]) => pattern.test(source.label));
        const assertEverySourceHas = (entries: typeof sources, prereqIds: string[]) => {
            expect(entries.length).toBeGreaterThan(0);
            for (const [sourceId, source] of entries) {
                expect(source.prereqIds, sourceId).toEqual(expect.arrayContaining(prereqIds));
            }
        };

        assertEverySourceHas(matches(/Kuva (?:Flood|Siphon)/i), [PR.WAR_WITHIN, PR.MR_5]);
        assertEverySourceHas(matches(/Nightmare Granum Void/i), [PR.DEADLOCK_PROTOCOL]);
        assertEverySourceHas(matches(/Arbitration Shield Drone/i), [PR.ACTIVITY_ARBITRATIONS]);
        assertEverySourceHas(matches(/Void Storm\s*\(Veil Proxima\)/i), [PR.SYSTEM_PROXIMA_VEIL_ACCESS]);
        assertEverySourceHas(matches(/^Transient Reward:\s*Faceoff:/i), [PR.THE_HEX]);

        const duviriSteelPathSources = sources.filter(([sourceId, source]) =>
            /Duviri/i.test(sourceId) && /Steel Path|\bHard\b/i.test(source.label),
        );
        expect(duviriSteelPathSources.length).toBeGreaterThan(0);
        for (const [sourceId, source] of duviriSteelPathSources) {
            expect(source.prereqIds, sourceId).toEqual(expect.arrayContaining([
                expect.stringMatching(new RegExp(`^(?:${PR.ACTIVITY_DUVIRI_STEEL_PATH}|${PR.ACTIVITY_CIRCUIT_STEEL_PATH})$`)),
            ]));
            expect(source.prereqIds, sourceId).not.toContain(PR.ACTIVITY_STEEL_PATH);
        }
        expect(SOURCE_INDEX[normalizeSourceId("data:duviri/circuit/steel-path")]?.prereqIds)
            .toEqual([PR.ACTIVITY_CIRCUIT_STEEL_PATH]);
        expect(PREREQ_REGISTRY.find((def) => def.id === PR.ACTIVITY_CIRCUIT_STEEL_PATH)?.prerequisites)
            .toEqual([PR.ACTIVITY_DUVIRI_STEEL_PATH]);
    });

    it("keeps source locks route-specific when another acquisition route is open", () => {
        const ivaraChassis = "items:/Lotus/Types/Recipes/WarframeRecipes/RangerChassisComponent" as CatalogId;
        const acquisition = getAcquisitionByCatalogId(ivaraChassis);
        expect(acquisition?.sources).toContain("data:drop:node:ceres:bode");
        expect(acquisition?.sources).toContain("data:drop:node:saturn:aegaeon");

        const ceresRoute = evaluateSourcePrerequisiteAccess(
            normalizeSourceId("data:drop:node:ceres:bode"),
            { [PR.JUNCTION_EUROPA_SATURN]: true },
        );
        expect(ceresRoute.missingPrereqs).toEqual([PR.JUNCTION_MARS_CERES]);
        expect(canAccessCatalogItem(ivaraChassis, { [PR.JUNCTION_EUROPA_SATURN]: true }, 30).allowed)
            .toBe(true);
    });

    it("reports a blocked single-route component in farming requirements and item access", () => {
        const valkyrChassis = "items:/Lotus/Types/Recipes/WarframeRecipes/BerserkerChassisComponent" as CatalogId;
        const sourceId = "data:drop:node:jupiter:themisto";
        expect(getAcquisitionByCatalogId(valkyrChassis)?.sources).toEqual([sourceId]);

        expect(canAccessCatalogItem(valkyrChassis, {}, 30)).toMatchObject({
            allowed: false,
            missingPrereqs: [PR.JUNCTION_CERES_JUPITER],
        });
        expect(canAccessCatalogItem(valkyrChassis, { [PR.JUNCTION_CERES_JUPITER]: true }, 30).allowed)
            .toBe(true);
    });

    it("hides Duviri resource routes until the quest unlocks them", () => {
        const aggristone = "items:/Lotus/Types/Gameplay/Duviri/Resource/DuviriRockItem" as CatalogId;
        const requirements = {
            itemLines: [{ key: aggristone, name: FULL_CATALOG.recordsById[aggristone].displayName, remaining: 1 }],
            currencyLines: [],
            stats: {
                actionableItemCount: 1,
                overlapItemCount: 0,
                totalRemainingItems: 1,
                totalRemainingCredits: 0,
                totalRemainingPlatinum: 0,
            },
        } as RequirementsResult;

        const locked = buildFarmingSnapshot({ requirements, completedPrereqs: {} });
        expect(locked.targeted).toHaveLength(0);
        expect(locked.hidden).toEqual(expect.arrayContaining([
            expect.objectContaining({ key: aggristone, reason: "missing-prereqs" }),
        ]));

        const unlocked = buildFarmingSnapshot({ requirements, completedPrereqs: { [PR.DUVIRI_PARADOX]: true } });
        expect(unlocked.targeted).toHaveLength(1);
        expect(unlocked.targeted[0]?.sources.length).toBeGreaterThan(0);
    });
});
