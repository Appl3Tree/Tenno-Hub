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

    it("resolves the current direct region routes", () => {
        const directRoutes = getUnlockedStarChartDestinationIds({
            [PR.DEIMOS_ACCESS]: true,
            [PR.WAR_WITHIN]: true,
            [PR.SECOND_DREAM]: true,
        }, {});
        expect(directRoutes.has("planet:deimos")).toBe(true);
        expect(directRoutes.has("region:kuva_fortress")).toBe(true);
        expect(directRoutes.has("region:lua")).toBe(true);

    });

    it("opens the correct Proxima regions from quest, Intrinsic, and Update 43 progression", () => {
        const startingProxima = getUnlockedStarChartDestinationIds({ [PR.SYSTEM_PROXIMA_ACCESS]: true }, {});
        expect(startingProxima.has("region:earth_proxima")).toBe(true);
        expect(startingProxima.has("region:venus_proxima")).toBe(true);
        expect(startingProxima.has("region:saturn_proxima")).toBe(false);

        const rankThreeProxima = getUnlockedStarChartDestinationIds({
            [PR.SYSTEM_PROXIMA_ACCESS]: true,
            [PR.SYSTEM_PROXIMA_SATURN_ACCESS]: true,
            [PR.SYSTEM_PROXIMA_NEPTUNE_ACCESS]: true,
        }, {});
        expect(rankThreeProxima.has("region:saturn_proxima")).toBe(true);
        expect(rankThreeProxima.has("region:neptune_proxima")).toBe(true);
        expect(rankThreeProxima.has("region:pluto_proxima")).toBe(false);

        const allProgression = getUnlockedStarChartDestinationIds({
            [PR.SYSTEM_PROXIMA_PLUTO_ACCESS]: true,
            [PR.SYSTEM_PROXIMA_VEIL_ACCESS]: true,
            [PR.SYSTEM_URANUS_PROXIMA]: true,
        }, {});
        expect(allProgression.has("region:pluto_proxima")).toBe(true);
        expect(allProgression.has("region:veil_proxima")).toBe(true);
        expect(allProgression.has("region:uranus_proxima")).toBe(true);
    });
});
