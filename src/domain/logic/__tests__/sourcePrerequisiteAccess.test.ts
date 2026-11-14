import { describe, expect, it } from "vitest";
import { getAcquisitionByCatalogId } from "../../../catalog/items/itemAcquisition";
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
            .toEqual([PR.VORS_PRIZE]);
        expect(SOURCE_INDEX[normalizeSourceId("data:drop:node:europa:cryotic-front")]?.prereqIds)
            .toEqual([PR.JUNCTION_JUPITER_EUROPA]);
    });

    it("adds the Steel Path gate to region-mapped Steel Path mission nodes", () => {
        expect(SOURCE_INDEX[normalizeSourceId("data:drop:node:ceres:exta_extra")]?.prereqIds)
            .toEqual([PR.JUNCTION_MARS_CERES, PR.ACTIVITY_STEEL_PATH]);
    });

    it("gates both generated Duviri transient reward routes behind the Duviri quest", () => {
        expect(SOURCE_INDEX[normalizeSourceId("data:transient/duviri-circuit")]?.prereqIds)
            .toEqual([PR.DUVIRI_PARADOX]);
        expect(SOURCE_INDEX[normalizeSourceId("data:transient/duviri-full-experience")]?.prereqIds)
            .toEqual([PR.DUVIRI_PARADOX]);
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
