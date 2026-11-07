import { describe, expect, it } from "vitest";
import { getDefaultRouteForMode, getRouteByKey, NAV_ROUTES, WORK_MODE_ORDER } from "../routes";

describe("workspace navigation routes", () => {
    it("provides a real destination for every workspace category", () => {
        for (const mode of WORK_MODE_ORDER) {
            const route = getDefaultRouteForMode(mode);
            expect(route.mode).toBe(mode);
            expect(NAV_ROUTES).toContain(route);
        }
    });

    it("lands the app and data workspace on Settings", () => {
        expect(getDefaultRouteForMode("system").key).toBe("settings");
    });

    it("keeps every navigation route directly addressable", () => {
        const keys = new Set(NAV_ROUTES.map((route) => route.key));
        expect(keys.size).toBe(NAV_ROUTES.length);
        for (const route of NAV_ROUTES) {
            expect(getRouteByKey(route.key)).toEqual(route);
        }
    });

    it("maps the legacy relic planner route to the current planning page", () => {
        expect(getRouteByKey("relics").key).toBe("relic_planner");
        expect(getRouteByKey("relics").mode).toBe("planning");
    });
});
