import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/world-state-2026-11-11.json";

const NOW = new Date("2026-11-11T14:55:15.000Z").getTime();

function response(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

async function freshService() {
    vi.resetModules();
    return import("../worldStateCache");
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("shared World State service", () => {
    it("normalizes current API fields, filters stale entries, and keeps manual event progress separate", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(fixture)));
        const service = await freshService();

        const data = await service.fetchWorldState();

        expect(data.buildLabel).toContain("2026.10.28");
        expect(data.apiTimestamp).toBe(fixture.timestamp);
        expect(service.getCurrentWorldAlerts(data.alerts).map((alert) => alert.id)).toEqual(["alert-current"]);
        expect(data.alerts.find((alert) => alert.id === "alert-current")).toMatchObject({
            description: "Tenno United Alert",
            missionType: "Defense",
            reward: "3× Forma, 10,000 Credits",
            minEnemyLevel: 20,
            maxEnemyLevel: 30,
        });
        expect(service.getCurrentWorldEvents(data.events).map((event) => event.id)).toEqual(["thermia"]);
        expect(data.events[0]).toMatchObject({ isPersonal: true, isCommunity: true, currentScore: 11 });
        expect(service.getCurrentNightwaveChallenges(data.nightwave).map((act) => act.id)).toEqual(["nw-active-1"]);
        expect(service.getCurrentWorldActivitySummary(data, NOW).total).toBe(3);
        expect(data.nightwave?.possibleChallenges.map((act) => act.id)).toEqual(["nw-possible"]);
        expect(data.conclaveChallenges).toHaveLength(1);
        expect(data.descendia?.challenges).toHaveLength(2);
        expect(data.clanWeeklyInitiative?.rewwards).toHaveLength(1);
        expect(data.faceoffBonus?.next).toBe("2026-11-11T16:00:00.000Z");
        expect(data.flashSales.map((sale) => sale.id)).toEqual(["sale-current"]);
        expect(data.news.map((news) => news.id)).toEqual(["news-current", "news-unsafe"]);
        expect(data.news[1].link).toBe("");
        expect(data.kinepage).toBeNull();
        expect(data.dailyDeals.map((deal) => deal.item)).toEqual(["Current Deal"]);
        expect(data.sentientOutposts?.active).toBe(false);
        expect(data.voidTraders).toHaveLength(1);
        expect(data.voidTrader?.character).toBe("Baro Ki'Teer");
        expect(service.getWorldStateSnapshot()).toMatchObject({ data, fetchedAt: NOW, isLoading: false, isRefreshing: false, error: null });
    });

    it("coalesces concurrent consumers onto one request and honors the cache TTL", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        const mockFetch = vi.fn().mockImplementation(() => Promise.resolve(response(fixture)));
        vi.stubGlobal("fetch", mockFetch);
        const service = await freshService();

        await Promise.all([service.fetchWorldState(), service.fetchWorldState(), service.fetchWorldState()]);
        await service.fetchWorldState();
        expect(mockFetch).toHaveBeenCalledTimes(1);

        vi.setSystemTime(NOW + 5 * 60 * 1000 + 1);
        await service.fetchWorldState();
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("lets a forced refresh win even when an aborted older request resolves late", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        const pending: Array<{ resolve: (value: Response) => void; signal: AbortSignal | null | undefined }> = [];
        vi.stubGlobal("fetch", vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((resolve) => {
            pending.push({ resolve, signal: init?.signal });
        })));
        const service = await freshService();

        const older = service.fetchWorldState();
        const newer = service.fetchWorldState(true);
        expect(pending).toHaveLength(2);
        expect(pending[0].signal?.aborted).toBe(true);

        pending[1].resolve(response({ ...fixture, timestamp: "2026-11-11T14:56:00.000Z", buildLabel: "newer-build" }));
        await newer;
        pending[0].resolve(response({ ...fixture, timestamp: "2026-11-11T14:54:00.000Z", buildLabel: "older-build" }));
        await older;

        expect(service.getWorldStateSnapshot().data?.buildLabel).toBe("newer-build");
        expect(service.getWorldStateSnapshot().data?.apiTimestamp).toBe("2026-11-11T14:56:00.000Z");
    });

    it("retains the last successful snapshot and reports an error when refresh fails", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        const mockFetch = vi.fn()
            .mockResolvedValueOnce(response(fixture))
            .mockResolvedValueOnce(response({ error: "unavailable" }, 503));
        vi.stubGlobal("fetch", mockFetch);
        const service = await freshService();
        const original = await service.fetchWorldState();

        vi.setSystemTime(NOW + 6 * 60 * 1000);
        await expect(service.fetchWorldState()).rejects.toThrow("503");

        expect(service.getWorldStateSnapshot().data).toBe(original);
        expect(service.getWorldStateSnapshot().fetchedAt).toBe(NOW);
        expect(service.getWorldStateSnapshot().error).toContain("503");
    });

    it("tolerates partial responses and rejects malformed timestamp strings", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ timestamp: "not-a-date", alerts: "bad", news: [null] })));
        const service = await freshService();

        const data = await service.fetchWorldState();
        expect(data.apiTimestamp).toBe("");
        expect(data.alerts).toEqual([]);
        expect(data.news).toEqual([]);
        expect(data.darkSectors).toEqual([]);
        expect(data.voidTrader).toBeNull();
    });

    it("scopes event completion to an activation/expiry occurrence", async () => {
        const service = await freshService();
        const first = { id: "same-event", activation: "2026-11-01T00:00:00.000Z", expiry: "2026-11-10T00:00:00.000Z" };
        const next = { id: "same-event", activation: "2026-12-01T00:00:00.000Z", expiry: "2026-12-10T00:00:00.000Z" };
        expect(service.eventCompletionKey(first)).not.toBe(service.eventCompletionKey(next));
        expect(service.eventCompletionKey({ id: "unscheduled", activation: "", expiry: "" })).toBeNull();
        expect(service.eventCompletionKey({ id: "", activation: "2026-11-11T00:00:00.000Z", expiry: "" })).toBeNull();
    });

    it("uses Baro's live API window and rejects expired active flags", async () => {
        const service = await freshService();
        const trader = (activation: string, expiry: string, active: boolean) => ({
            active,
            character: "Baro Ki'Teer",
            location: "Orcus Relay",
            inventory: [],
            activation,
            expiry,
            completed: false,
            schedule: [],
        });
        const upcoming = trader("2026-11-13T13:00:00.000Z", "2026-11-15T13:00:00.000Z", false);
        expect(service.getCurrentOrNextVoidTrader([upcoming], NOW)).toMatchObject({
            trader: upcoming,
            active: false,
            timeUntilMs: new Date("2026-11-13T13:00:00.000Z").getTime() - NOW,
        });

        const current = trader("2026-11-11T14:00:00.000Z", "2026-11-11T16:00:00.000Z", false);
        expect(service.getCurrentOrNextVoidTrader([current], NOW)).toMatchObject({
            active: true,
            timeLeftMs: new Date("2026-11-11T16:00:00.000Z").getTime() - NOW,
        });

        const expired = trader("2026-11-10T13:00:00.000Z", "2026-11-10T15:00:00.000Z", true);
        expect(service.getCurrentOrNextVoidTrader([expired], NOW)).toBeNull();
    });
});
