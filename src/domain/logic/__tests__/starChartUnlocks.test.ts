import { describe, expect, it } from "vitest";
import { PR } from "../../ids/prereqIds";
import { getUnlockedStarChartDestinationIds } from "../starChartUnlocks";

describe("Star Chart destination access", () => {
    it("uses Earth as the start and maps imported early Junction completions to the correct planet", () => {
        expect([...getUnlockedStarChartDestinationIds({}, {})]).toEqual(["planet:earth"]);

        const afterVenusJunction = getUnlockedStarChartDestinationIds({}, {
            "node:junction_venus_earth": true,
        });
        expect(afterVenusJunction.has("planet:venus")).toBe(true);
        expect(afterVenusJunction.has("planet:mercury")).toBe(false);

        const afterMercuryJunction = getUnlockedStarChartDestinationIds({}, {
            "node:junction_venus_earth": true,
            "node:junction_mercury_venus": true,
        });
        expect(afterMercuryJunction.has("planet:mercury")).toBe(true);
    });

    it("keeps manually tracked Junction progress in sync with the Star Chart list and map", () => {
        const unlocked = getUnlockedStarChartDestinationIds({
            [PR.JUNCTION_VENUS_EARTH]: true,
            [PR.JUNCTION_MERCURY_VENUS]: true,
        }, {});
        expect(unlocked.has("planet:venus")).toBe(true);
        expect(unlocked.has("planet:mercury")).toBe(true);
    });

    it("resolves the current direct region routes and the temporary Taubound route", () => {
        const directRoutes = getUnlockedStarChartDestinationIds({
            [PR.DEIMOS_ACCESS]: true,
            [PR.WAR_WITHIN]: true,
            [PR.SECOND_DREAM]: true,
        }, {});
        expect(directRoutes.has("planet:deimos")).toBe(true);
        expect(directRoutes.has("region:kuva_fortress")).toBe(true);
        expect(directRoutes.has("region:lua")).toBe(true);

        const beforeOperation = getUnlockedStarChartDestinationIds({ [PR.VORS_PRIZE]: true }, {}, "2026-10-14");
        const duringOperation = getUnlockedStarChartDestinationIds({ [PR.VORS_PRIZE]: true }, {}, "2026-11-09");
        const afterOperation = getUnlockedStarChartDestinationIds({ [PR.VORS_PRIZE]: true }, {}, "2026-11-18");
        expect(beforeOperation.has("planet:eris")).toBe(false);
        expect(duringOperation.has("planet:eris")).toBe(true);
        expect(afterOperation.has("planet:eris")).toBe(false);
    });
});
