import { describe, expect, it } from "vitest";
import { PREREQ_REGISTRY } from "../../../catalog/prereqs/prereqRegistry";
import { PR } from "../../ids/prereqIds";
import { computeUnlockGraphSnapshot } from "../unlockGraph";
import { computeMilestoneSnapshot } from "../milestoneEngine";
import { deriveCompletedMap } from "../syndicatePrereqs";
import { isAutoTrackedPrereq } from "../syndicatePrereqs";
import { STAR_CHART_NODES } from "../../catalog/starChart/nodes";
import { SY } from "../../ids/syndicateIds";
import { buildProgressionPlan } from "../plannerEngine";

const definition = (id: string) => PREREQ_REGISTRY.find((entry) => entry.id === id)!;

describe("current Warframe progression gates", () => {
    it("places Awakening before Vor's Prize and preserves access for existing saves", () => {
        expect(computeUnlockGraphSnapshot({}).byId[PR.VORS_PRIZE].unlocked).toBe(false);
        expect(computeUnlockGraphSnapshot({ [PR.AWAKENING]: true }).byId[PR.VORS_PRIZE].unlocked).toBe(true);
        expect(definition(PR.VORS_PRIZE).prerequisites).toEqual([PR.AWAKENING]);
    });

    it("blocks Steel Path and Nightmare access until their Star Chart conditions are met", () => {
        const noNodesComplete = computeUnlockGraphSnapshot({ [PR.HUB_RELAY]: true }, undefined, { nodeCompletedMap: {} });
        expect(noNodesComplete.byId[PR.ACTIVITY_STEEL_PATH].unlocked).toBe(false);
        expect(noNodesComplete.byId[PR.ACTIVITY_STEEL_PATH].missingConditions).toContainEqual({
            type: "star_chart_access",
            activity: "steel_path",
        });
        expect(isAutoTrackedPrereq(PR.ACTIVITY_STEEL_PATH)).toBe(true);

        const allNodesComplete = Object.fromEntries(STAR_CHART_NODES.filter((node) => node.nodeType !== "hub").map((node) => [node.id, true]));
        const tooLowMastery = computeUnlockGraphSnapshot({ [PR.HUB_RELAY]: true, [PR.VORS_PRIZE]: true }, undefined, { masteryRank: 4, nodeCompletedMap: allNodesComplete });
        expect(tooLowMastery.byId[PR.ACTIVITY_STEEL_PATH].unlocked).toBe(false);
        expect(tooLowMastery.byId[PR.ACTIVITY_STEEL_PATH].missingConditions).toContainEqual({ type: "mastery_rank", value: 5 });

        const complete = computeUnlockGraphSnapshot({ [PR.HUB_RELAY]: true, [PR.VORS_PRIZE]: true }, undefined, { masteryRank: 5, nodeCompletedMap: allNodesComplete });
        expect(complete.byId[PR.ACTIVITY_STEEL_PATH].unlocked).toBe(true);
        expect(complete.byId[PR.ACTIVITY_NIGHTMARE].unlocked).toBe(true);
        expect(isAutoTrackedPrereq(PR.ACTIVITY_NIGHTMARE)).toBe(true);
        expect(deriveCompletedMap({}, [], 4, allNodesComplete)[PR.ACTIVITY_STEEL_PATH]).not.toBe(true);
        expect(deriveCompletedMap({}, [], 5, allNodesComplete)[PR.ACTIVITY_STEEL_PATH]).toBe(true);
        expect(deriveCompletedMap({}, [], 0, allNodesComplete)[PR.ACTIVITY_NIGHTMARE]).toBe(true);
    });

    it("keeps condition-only blockers visible in the progression plan without offering a false completion checkbox", () => {
        const completed = Object.fromEntries(PREREQ_REGISTRY.map((entry) => [entry.id, true]));
        completed[PR.DEIMOS_ACCESS] = false;
        const plan = buildProgressionPlan(completed, { nodeCompletedMap: {} });
        const blockedDeimos = plan.steps.find((step) => step.prereqId === PR.DEIMOS_ACCESS);

        expect(blockedDeimos).toMatchObject({
            blocked: true,
            missingLabels: ["Complete War mission on Mars"],
        });
    });

    it("unlocks Natah after The Archwing without the removed Uranus scan gate", () => {
        const status = computeUnlockGraphSnapshot({ [PR.ARCHWING]: true }).byId[PR.NATAH];
        expect(status.unlocked).toBe(true);
        expect(definition(PR.NATAH).prerequisites).toEqual([PR.ARCHWING]);
    });

    it("requires an Operator Amp for The New War, but does not require an owned Necramech", () => {
        const status = computeUnlockGraphSnapshot({
            [PR.PRELUDE_TO_WAR]: true,
            [PR.RAILJACK_CONSTRUCTED]: true,
        }).byId[PR.NEW_WAR];

        expect(status.unlocked).toBe(false);
        expect(status.missing).toContain(PR.SYSTEM_OPERATOR_AMP);
        expect(definition(PR.NEW_WAR).prerequisites).toEqual([PR.PRELUDE_TO_WAR, PR.SYSTEM_OPERATOR_AMP]);
        expect(definition(PR.NEW_WAR).anyPrerequisites).toEqual([PR.RAILJACK_CONSTRUCTED, PR.RAILJACK_MARKET_ACQUIRED]);
        expect(definition(PR.NEW_WAR).prerequisites).not.toContain(PR.NECRAMECH_UNLOCKED);

        const withAmp = computeUnlockGraphSnapshot({
            [PR.PRELUDE_TO_WAR]: true,
            [PR.RAILJACK_CONSTRUCTED]: true,
            [PR.SYSTEM_OPERATOR_AMP]: true,
        }).byId[PR.NEW_WAR];
        expect(withAmp.unlocked).toBe(true);

        const purchasedRailjack = computeUnlockGraphSnapshot({
            [PR.PRELUDE_TO_WAR]: true,
            [PR.SYSTEM_OPERATOR_AMP]: true,
            [PR.RAILJACK_MARKET_ACQUIRED]: true,
        }).byId[PR.NEW_WAR];
        expect(purchasedRailjack.unlocked).toBe(true);

        const moteAmpImpliesAnyAmp = deriveCompletedMap({ [PR.AMP_MOTE]: true }, [], 0);
        expect(moteAmpImpliesAnyAmp[PR.SYSTEM_OPERATOR_AMP]).toBe(true);
        expect(definition(PR.SYSTEM_OPERATOR_AMP).prerequisites).toEqual([PR.SYSTEM_ONKKO_VISITED]);
        expect(computeUnlockGraphSnapshot({ [PR.SECOND_DREAM]: true }).byId[PR.SYSTEM_OPERATOR_AMP].unlocked)
            .toBe(false);
        expect(computeUnlockGraphSnapshot({ [PR.SYSTEM_ONKKO_VISITED]: true }).byId[PR.SYSTEM_OPERATOR_AMP].unlocked)
            .toBe(true);
    });

    it("uses Onkko visit, not Saya's Vigil or Mote Amp ownership, as the current Chains of Harrow gate", () => {
        expect(definition(PR.CHAINS_HARROW).prerequisites).toEqual([PR.SYSTEM_ONKKO_VISITED]);
        expect(definition(PR.SYSTEM_ONKKO_VISITED).prerequisites).toEqual([PR.WAR_WITHIN, PR.HUB_CETUS]);
        expect(definition(PR.AMP_MOTE).prerequisites).toEqual([PR.SYSTEM_ONKKO_VISITED]);
    });

    it("models the current main Star Chart quest tasks and relocated Pluto/Eris/Sedna gates", () => {
        expect(definition(PR.JUNCTION_VENUS_EARTH).prerequisites).toEqual([PR.THE_TEACHER]);
        expect(definition(PR.JUNCTION_MERCURY_VENUS).prerequisites).toEqual([PR.VOX_SOLARIS]);
        expect(definition(PR.JUNCTION_MERCURY_VENUS).conditions).toContainEqual({
            type: "node_complete",
            nodeId: "node:mr/venus/fossa",
            label: "Jackal at Fossa (Venus)",
        });
        expect(definition(PR.JUNCTION_EARTH_MARS).prerequisites).toContain(PR.ONCE_AWAKE);
        expect(definition(PR.JUNCTION_URANUS_NEPTUNE).prerequisites).toContain(PR.NATAH);
        expect(definition(PR.JUNCTION_NEPTUNE_PLUTO).prerequisites).toContain(PR.SECOND_DREAM);
        expect(definition(PR.JUNCTION_PLUTO_SEDNA).label).toContain("Pluto → Eris");
        expect(definition(PR.JUNCTION_SEDNA_ERIS).label).toContain("Eris → Sedna");

        // The current quest access checks explicitly require both the junction
        // reward and the named quest, even though one implies the other.
        expect(definition(PR.SECOND_DREAM).prerequisites).toEqual([PR.JUNCTION_URANUS_NEPTUNE, PR.NATAH]);
        expect(definition(PR.WAR_WITHIN).prerequisites).toEqual([PR.JUNCTION_NEPTUNE_PLUTO, PR.SECOND_DREAM]);

        // Kuva Fortress access is unlocked by The War Within, not an Eris Junction.
        expect(definition(PR.KUVA_FORTRESS_ACCESS)).toMatchObject({
            label: "Kuva Fortress Access",
            prerequisites: [PR.WAR_WITHIN],
        });
        expect(STAR_CHART_NODES.some((node) => node.id === "node:junction_eris_kuva_fortress")).toBe(false);
        expect(STAR_CHART_NODES.some((node) => node.id === "node:junction_earth_lua")).toBe(false);
        expect(STAR_CHART_NODES.some((node) => node.id === "node:junction_mars_deimos")).toBe(false);
        expect(definition(PR.JUNCTION_EARTH_LUA).prerequisites).toEqual([PR.SECOND_DREAM]);
        expect(definition(PR.DEIMOS_ACCESS).conditions).toContainEqual({
            type: "node_complete",
            nodeId: "node:mr/mars/war",
            label: "War mission on Mars",
        });

        const erisNode = STAR_CHART_NODES.find((node) => node.id === "node:junction_pluto_sedna");
        const sednaNode = STAR_CHART_NODES.find((node) => node.id === "node:junction_sedna_eris");
        const venusNode = STAR_CHART_NODES.find((node) => node.id === "node:junction_venus_earth");
        const mercuryNode = STAR_CHART_NODES.find((node) => node.id === "node:junction_mercury_venus");
        expect(erisNode).toMatchObject({ planetId: "planet:pluto", unlocksPlanetId: "planet:eris" });
        expect(sednaNode).toMatchObject({ planetId: "planet:eris", unlocksPlanetId: "planet:sedna" });
        expect(venusNode).toMatchObject({ planetId: "planet:earth", name: "Venus Junction", unlocksPlanetId: "planet:venus" });
        expect(mercuryNode).toMatchObject({ planetId: "planet:venus", name: "Mercury Junction", unlocksPlanetId: "planet:mercury" });
        expect(isAutoTrackedPrereq(PR.JUNCTION_VENUS_EARTH)).toBe(true);
        expect(isAutoTrackedPrereq(PR.JUNCTION_MERCURY_VENUS)).toBe(true);
        const junctionsImported = deriveCompletedMap({}, [], 0, {
            "node:junction_venus_earth": true,
            "node:junction_mercury_venus": true,
        });
        expect(junctionsImported[PR.JUNCTION_VENUS_EARTH]).toBe(true);
        expect(junctionsImported[PR.JUNCTION_MERCURY_VENUS]).toBe(true);
        expect(definition(PR.ACTIVITY_ARBITRATIONS).prerequisites).toContain(PR.SYSTEM_ERIS_FOCUS_LENS);
        expect(definition(PR.ACTIVITY_ARBITRATIONS).prerequisites).toContain(PR.SYSTEM_RANK30_WARFRAME);

        const earlyArbitrations = computeUnlockGraphSnapshot({
            [PR.JUNCTION_NEPTUNE_PLUTO]: true,
            [PR.SYSTEM_ERIS_FOCUS_LENS]: true,
            [PR.SYSTEM_RANK30_WARFRAME]: true,
        }).byId[PR.ACTIVITY_ARBITRATIONS];
        expect(earlyArbitrations.unlocked).toBe(true);
        expect(computeUnlockGraphSnapshot({
            [PR.JUNCTION_PLUTO_SEDNA]: true,
        }).byId[PR.ACTIVITY_ARBITRATIONS].unlocked).toBe(false);

        const derived = deriveCompletedMap({}, [], 0, { "node:junction_pluto_sedna": true });
        expect(derived[PR.SYSTEM_ERIS_FOCUS_LENS]).toBe(true);

        expect(deriveCompletedMap({ [PR.WAR_WITHIN]: true }, [], 0)[PR.KUVA_FORTRESS_ACCESS]).toBe(true);
        expect(deriveCompletedMap({}, [], 0, { "node:junction_eris_kuva_fortress": true })[PR.KUVA_FORTRESS_ACCESS]).toBe(true);
        expect(deriveCompletedMap({ [PR.SECOND_DREAM]: true }, [], 0)[PR.JUNCTION_EARTH_LUA]).toBe(true);
        expect(deriveCompletedMap({}, [], 0, { "node:junction_earth_lua": true })[PR.JUNCTION_EARTH_LUA]).toBe(true);
        expect(deriveCompletedMap({}, [], 0, { "node:mr/mars/war": true })[PR.DEIMOS_ACCESS]).toBe(true);
        expect(deriveCompletedMap({}, [], 0, { "node:junction_mars_deimos": true })[PR.DEIMOS_ACCESS]).toBe(true);
    });

    it("does not impose a Mars Junction gate on rotating Invasions", () => {
        expect(definition(PR.ACTIVITY_INVASIONS).prerequisites).toEqual([PR.VORS_PRIZE]);
        const active = computeUnlockGraphSnapshot({ [PR.VORS_PRIZE]: true }).byId[PR.ACTIVITY_INVASIONS];
        expect(active.unlocked).toBe(true);
    });

    it("keeps current quest gates and the purchased Railjack route exact", () => {
        expect(definition(PR.VOX_SOLARIS).prerequisites).toEqual([PR.HUB_FORTUNA]);
        expect(definition(PR.VOX_SOLARIS).prerequisites).not.toContain(PR.THE_TEACHER);
        expect(definition(PR.NEW_STRANGE).prerequisites).toEqual([
            PR.STOLEN_DREAMS,
            PR.JUNCTION_JUPITER_EUROPA,
        ]);
        expect(definition(PR.LIMBO_THEOREM).prerequisites).toEqual([PR.SYSTEM_ARCHWING_OWNED, PR.JUNCTION_JUPITER_EUROPA]);
        expect(definition(PR.LIMBO_THEOREM).conditions).toBeUndefined();
        expect(definition(PR.JORDAS_PRECEPT).prerequisites).toEqual([PR.JUNCTION_PLUTO_SEDNA]);
        expect(definition(PR.SYSTEM_ARCHWING_OWNED).conditions?.[0]).toMatchObject({
            type: "item_owned_any",
            label: "Own any Archwing",
        });
        expect(isAutoTrackedPrereq(PR.SYSTEM_ARCHWING_OWNED)).toBe(true);
        expect(definition(PR.CALL_TEMPESTARII).prerequisites).toEqual([PR.DEADLOCK_PROTOCOL]);
        expect(definition(PR.CALL_TEMPESTARII).anyPrerequisites).toEqual([
            PR.RAILJACK_CONSTRUCTED,
            PR.RAILJACK_MARKET_ACQUIRED,
        ]);

        const archwingCondition = definition(PR.SYSTEM_ARCHWING_OWNED).conditions![0];
        if (archwingCondition.type !== "item_owned_any") throw new Error("Archwing ownership must use an any-owned equipment condition");
        const archwingCatalogId = archwingCondition.catalogIds[0];
        const jupiterEuropaUnlocked = { [PR.JUNCTION_JUPITER_EUROPA]: true };
        const hasArchwing = deriveCompletedMap({}, [], 0, {}, {}, { [archwingCatalogId]: 1 });
        expect(hasArchwing[PR.SYSTEM_ARCHWING_OWNED]).toBe(true);
        const questStillInProgress = computeUnlockGraphSnapshot({ ...jupiterEuropaUnlocked, ...hasArchwing })
            .byId[PR.LIMBO_THEOREM];
        expect(questStillInProgress.unlocked).toBe(true);
        expect(questStillInProgress.missing).not.toContain(PR.ARCHWING);

        const noArchwing = computeUnlockGraphSnapshot(jupiterEuropaUnlocked).byId[PR.LIMBO_THEOREM];
        expect(noArchwing.unlocked).toBe(false);
        expect(noArchwing.missing).toContain(PR.SYSTEM_ARCHWING_OWNED);

        const noJunction = computeUnlockGraphSnapshot(hasArchwing)
            .byId[PR.LIMBO_THEOREM];
        expect(noJunction.unlocked).toBe(false);
        expect(noJunction.missing).toContain(PR.JUNCTION_JUPITER_EUROPA);

        const purchasedRailjack = computeUnlockGraphSnapshot({
            [PR.DEADLOCK_PROTOCOL]: true,
            [PR.RAILJACK_MARKET_ACQUIRED]: true,
        }, undefined, { masteryRank: 4 }).byId[PR.CALL_TEMPESTARII];
        expect(purchasedRailjack.unlocked).toBe(true);
    });

    it("requires a Ceres Abyssal Beacon from any main Syndicate at Rank 2 without a Relay visit", () => {
        const abyssalZone = definition(PR.ACTIVITY_ABYSSAL_ZONE);
        expect(abyssalZone.prerequisites).toEqual([PR.JUNCTION_MARS_CERES]);
        expect(abyssalZone.prerequisites).not.toContain(PR.HUB_RELAY);
        expect(abyssalZone.validatedByAnySyndicate?.rank).toBe(2);
        expect(abyssalZone.validatedByAnySyndicate?.syndicateIds).toHaveLength(6);
    });

    it("keeps dynamic endgame conditions out of generic next steps until a target needs them", () => {
        const afterAwakening = buildProgressionPlan({ [PR.AWAKENING]: true });
        expect(afterAwakening.steps.map((step) => step.prereqId)).toContain(PR.VORS_PRIZE);
        expect(afterAwakening.steps.map((step) => step.prereqId)).not.toContain(PR.SYSTEM_RANK30_WARFRAME);
        expect(afterAwakening.steps.map((step) => step.prereqId)).not.toContain(PR.SYSTEM_ADVERSARY_SLOT_CLEAR);

        const whenTargeted = computeUnlockGraphSnapshot({
            [PR.WAR_WITHIN]: true,
            [PR.RAILJACK_MARKET_ACQUIRED]: true,
        }, undefined, { masteryRank: 5 });
        expect(whenTargeted.byId[PR.ACTIVITY_KUVA_LICH].unlocked).toBe(false);
        expect(whenTargeted.byId[PR.ACTIVITY_KUVA_LICH].missing).toContain(PR.SYSTEM_ADVERSARY_SLOT_CLEAR);
    });

    it("requires the current Eris-to-Sedna gate's Rising Tide and Sover Strait tasks", () => {
        const status = computeUnlockGraphSnapshot({
            [PR.JUNCTION_PLUTO_SEDNA]: true,
            [PR.RISING_TIDE]: true,
        }, undefined, { nodeCompletedMap: { "node:mr/earth/sover-strait": true } }).byId[PR.JUNCTION_SEDNA_ERIS];

        expect(status.unlocked).toBe(true);
        expect(definition(PR.JUNCTION_SEDNA_ERIS).conditions).toContainEqual({
            type: "node_complete",
            nodeId: "node:mr/earth/sover-strait",
            label: "Sover Strait (Earth Proxima)",
        });
    });

    it("uses the current Sortie gates, including Oro and eligible-frame requirements", () => {
        const missingMr = computeUnlockGraphSnapshot({
            [PR.WAR_WITHIN]: true,
            [PR.SYSTEM_RANK30_WARFRAME]: true,
        }, undefined, { masteryRank: 4, nodeCompletedMap: { "node:mr/earth/oro": true } }).byId[PR.ACTIVITY_SORTIES];
        expect(missingMr.unlocked).toBe(false);
        expect(missingMr.missingConditions).toContainEqual({ type: "mastery_rank", value: 5 });

        const missingOro = computeUnlockGraphSnapshot({
            [PR.WAR_WITHIN]: true,
            [PR.SYSTEM_RANK30_WARFRAME]: true,
        }, undefined, { masteryRank: 5 }).byId[PR.ACTIVITY_SORTIES];
        expect(missingOro.unlocked).toBe(false);
        expect(missingOro.missingConditions).toContainEqual({ type: "node_complete", nodeId: "node:mr/earth/oro", label: "Oro (Earth)" });

        const ready = computeUnlockGraphSnapshot({
            [PR.WAR_WITHIN]: true,
            [PR.SYSTEM_RANK30_WARFRAME]: true,
        }, undefined, { masteryRank: 5, nodeCompletedMap: { "node:mr/earth/oro": true } }).byId[PR.ACTIVITY_SORTIES];
        expect(ready.unlocked).toBe(true);
        expect(definition(PR.ACTIVITY_SORTIES).prerequisites).toContain(PR.SYSTEM_RANK30_WARFRAME);
        expect(definition(PR.ACTIVITY_ARBITRATIONS).prerequisites).toContain(PR.SYSTEM_RANK30_WARFRAME);
    });

    it("keeps updated quest, activity, and item gates current and nonredundant", () => {
        expect(definition(PR.WAR_WITHIN).conditions).toBeUndefined();
        expect(definition(PR.RISING_TIDE).prerequisites).toEqual([PR.WAR_WITHIN]);
        expect(definition(PR.ACTIVITY_NIGHTWAVE).prerequisites).toEqual([PR.THE_TEACHER]);
        expect(definition(PR.SEGMENT_VOID_RELIC).prerequisites).toEqual([PR.ONCE_AWAKE]);
        expect(definition(PR.ACTIVITY_VOID_FISSURES).prerequisites).toEqual([PR.VORS_PRIZE]);
        expect(definition(PR.ACTIVITY_VOID_FISSURES).prerequisites).not.toContain(PR.SEGMENT_VOID_RELIC);
        expect(definition(PR.ACTIVITY_VOID_STORMS).prerequisites).toEqual([PR.SYSTEM_PROXIMA_ACCESS]);
        expect(definition(PR.ACTIVITY_VOID_STORMS).anyPrerequisites).toBeUndefined();
        const joinVoidStormWithoutRailjack = computeUnlockGraphSnapshot({
            [PR.SYSTEM_PROXIMA_ACCESS]: true,
        }).byId[PR.ACTIVITY_VOID_STORMS];
        expect(joinVoidStormWithoutRailjack.unlocked).toBe(true);
        expect(joinVoidStormWithoutRailjack.missing).not.toContain(PR.RAILJACK_CONSTRUCTED);
        expect(definition(PR.ACTIVITY_DEFECTION).anyPrerequisites).toEqual([
            PR.JUNCTION_MARS_PHOBOS,
            PR.JUNCTION_EUROPA_SATURN,
            PR.JUNCTION_URANUS_NEPTUNE,
        ]);
        expect(definition(PR.ACTIVITY_TECHNOCYTE_CODA).prerequisites).not.toContain(PR.RAILJACK_CONSTRUCTED);
        expect(definition(PR.PATIENT_ZERO).prerequisites).toEqual([PR.ONCE_AWAKE, PR.JUNCTION_PLUTO_SEDNA]);
        expect(definition(PR.SAYA_VIGIL).prerequisites).toEqual([PR.VORS_PRIZE, PR.ACTIVITY_CETUS_BOUNTY_COMPLETED]);
        expect(definition(PR.SANDS_INAROS).prerequisites).not.toContain(PR.HUB_RELAY);
        expect(definition(PR.MASK_REVENANT).prerequisites).toEqual([PR.SYNDICATE_QUILLS_RANK2]);
        expect(definition(PR.CLAN_DOJO).prerequisites).toEqual([]);
        expect(definition(PR.NECRAMECH_UNLOCKED).prerequisites).toEqual([PR.WAR_WITHIN]);
        expect(definition(PR.NECRAMECH_UNLOCKED).anyPrerequisites).toEqual([
            PR.NECRAMECH_VOIDRIG,
            PR.NECRAMECH_BONEWIDOW,
            PR.NECRAMECH_MARKET,
        ]);
        expect(definition(PR.NECRAMECH_UNLOCKED).conditions).toBeUndefined();
        expect(definition(PR.NECRAMECH_VOIDRIG).prerequisites).toEqual([PR.HEART_OF_DEIMOS]);
        expect(definition(PR.NECRAMECH_BONEWIDOW).prerequisites).toEqual([PR.SYNDICATE_NECRALOID_RANK3]);
        expect(definition(PR.ACTIVITY_ABYSSAL_ZONE).prerequisites).toEqual([PR.JUNCTION_MARS_CERES]);
        expect(definition(PR.ACTIVITY_ABYSSAL_ZONE).prerequisites).not.toContain(PR.HUB_RELAY);
        expect(definition(PR.ACTIVITY_TECHNOCYTE_CODA).conditions ?? [])
            .not.toContainEqual({ type: "mastery_rank", value: 5 });
        expect(definition(PR.ACTIVITY_TECHNOCYTE_CODA).evidence?.find((source) => source.url.endsWith("/Adversary_System")))
            .toMatchObject({ classification: "conditional" });
        for (const id of [PR.ACTIVITY_KUVA_LICH, PR.ACTIVITY_SISTER_PARVOS, PR.ACTIVITY_TECHNOCYTE_CODA]) {
            expect(definition(id).prerequisites).toContain(PR.SYSTEM_ADVERSARY_SLOT_CLEAR);
        }
    });

    it("blocks Sands of Inaros below its enforced MR5 beacon gate", () => {
        const belowGate = computeUnlockGraphSnapshot({}, undefined, { masteryRank: 4 }).byId[PR.SANDS_INAROS];
        const meetsGate = computeUnlockGraphSnapshot({}, undefined, { masteryRank: 5 }).byId[PR.SANDS_INAROS];
        expect(belowGate.unlocked).toBe(false);
        expect(belowGate.missingConditions).toContainEqual({ type: "mastery_rank", value: 5 });
        expect(meetsGate.unlocked).toBe(true);
    });

    it("allows the Helminth Market bundle to bypass Son's MR and Entrati rank requirements", () => {
        expect(definition(PR.SEGMENT_HELMINTH).anyPrerequisites).toEqual([
            PR.SEGMENT_HELMINTH_SON_ACCESS,
            PR.HELMINTH_MARKET_BUNDLE,
        ]);
        expect(definition(PR.SEGMENT_HELMINTH_INVIGORATION).anyPrerequisites).toEqual([
            PR.SEGMENT_HELMINTH_INVIGORATION_SON_ACCESS,
            PR.HELMINTH_MARKET_BUNDLE,
        ]);

        const belowSonGate = deriveCompletedMap({}, [{ id: SY.ENTRATI, name: "Entrati", rank: 3, standing: 0 }], 7);
        expect(belowSonGate[PR.SEGMENT_HELMINTH_SON_ACCESS]).not.toBe(true);

        const sonRoute = deriveCompletedMap({}, [{ id: SY.ENTRATI, name: "Entrati", rank: 3, standing: 0 }], 8);
        expect(sonRoute[PR.SEGMENT_HELMINTH_SON_ACCESS]).toBe(true);
        expect(computeUnlockGraphSnapshot(sonRoute, undefined, { masteryRank: 8 }).byId[PR.SEGMENT_HELMINTH].unlocked).toBe(true);

        const marketRoute = deriveCompletedMap({ [PR.HELMINTH_MARKET_BUNDLE]: true }, [], 0);
        expect(isAutoTrackedPrereq(PR.SEGMENT_HELMINTH_SON_ACCESS)).toBe(true);
        const marketBelowRank = computeUnlockGraphSnapshot(marketRoute, undefined, { masteryRank: 7 }).byId[PR.SEGMENT_HELMINTH];
        expect(marketBelowRank.unlocked).toBe(false);
        expect(marketBelowRank.missingConditions).toContainEqual({ type: "mastery_rank", value: 8 });
        expect(computeUnlockGraphSnapshot(marketRoute, undefined, { masteryRank: 8 }).byId[PR.SEGMENT_HELMINTH].unlocked).toBe(true);
        expect(computeUnlockGraphSnapshot({ ...marketRoute, [PR.SEGMENT_HELMINTH]: true }, undefined, { masteryRank: 8 })
            .byId[PR.SEGMENT_HELMINTH_INVIGORATION].unlocked).toBe(true);
    });

    it("keeps syndicate rank chains on their immediate previous rank", () => {
        expect(definition(PR.SYNDICATE_ENTRATI_RANK1).prerequisites).toEqual([PR.HUB_NECRALISK]);
        expect(definition(PR.SYNDICATE_ENTRATI_RANK2).prerequisites).toEqual([PR.SYNDICATE_ENTRATI_RANK1]);
        expect(definition(PR.SYNDICATE_ENTRATI_RANK3).prerequisites).toEqual([PR.SYNDICATE_ENTRATI_RANK2]);
        expect(definition(PR.SYNDICATE_CAVIA_RANK1).prerequisites).toEqual([PR.HUB_SANCTUM]);
        expect(definition(PR.SYNDICATE_CAVIA_RANK2).prerequisites).toEqual([PR.SYNDICATE_CAVIA_RANK1]);
        expect(definition(PR.SYNDICATE_CAVIA_RANK3).prerequisites).toEqual([PR.SYNDICATE_CAVIA_RANK2]);
        expect(definition(PR.SYNDICATE_CAVIA_RANK4).prerequisites).toEqual([PR.SYNDICATE_CAVIA_RANK3]);
        expect(definition(PR.SYNDICATE_CAVIA_RANK5).prerequisites).toEqual([PR.SYNDICATE_CAVIA_RANK4]);
        expect(definition(PR.SYNDICATE_SOLARIS_RANK5).prerequisites).toEqual([PR.SYNDICATE_SOLARIS_RANK4]);
        expect(definition(PR.SYNDICATE_HEX_RANK4).prerequisites).toEqual([PR.THE_HEX_FINALE]);
        expect(definition(PR.SYNDICATE_HEX_RANK5).prerequisites).toEqual([PR.SYNDICATE_HEX_RANK4]);
    });

    it("derives Proxima access from imported/manual Railjack Intrinsic ranks", () => {
        const rankTwo = deriveCompletedMap({ [PR.ARCHWING]: true }, [], 0, {}, { LPS_PILOTING: 2 });
        expect(rankTwo[PR.SYSTEM_PROXIMA_ACCESS]).toBe(true);
        expect(rankTwo[PR.SYSTEM_PROXIMA_SATURN_ACCESS]).not.toBe(true);

        const rankThree = deriveCompletedMap({ [PR.ARCHWING]: true }, [], 0, {}, { LPS_TACTICAL: 3 });
        expect(rankThree[PR.SYSTEM_PROXIMA_SATURN_ACCESS]).toBe(true);
        expect(rankThree[PR.SYSTEM_PROXIMA_NEPTUNE_ACCESS]).toBe(true);
        expect(rankThree[PR.SYSTEM_PROXIMA_PLUTO_ACCESS]).not.toBe(true);

        const rankSeven = deriveCompletedMap({ [PR.ARCHWING]: true }, [], 0, {}, { LPS_TACTICAL: 7 });
        expect(rankSeven[PR.SYSTEM_PROXIMA_PLUTO_ACCESS]).toBe(true);
        expect(rankSeven[PR.SYSTEM_PROXIMA_VEIL_ACCESS]).toBe(true);
    });

    it("requires one legitimate route to Railjack armaments, not both Dojo and Proxima access", () => {
        const access = definition(PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS);
        expect(access.prerequisites).toEqual([]);
        expect(access.anyPrerequisites).toEqual([PR.CLAN_DRY_DOCK, PR.SYSTEM_PROXIMA_ACCESS]);
        expect(deriveCompletedMap({ [PR.CLAN_DOJO]: true }, [], 0)[PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS]).not.toBe(true);
        expect(deriveCompletedMap({ [PR.CLAN_DRY_DOCK]: true }, [], 0)[PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS]).toBe(true);
        expect(deriveCompletedMap({ [PR.ARCHWING]: true }, [], 0)[PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS]).toBe(true);
    });

    it("keeps recommendations nonblocking", () => {
        const recommendedOnly = {
            id: PR.VORS_PRIZE,
            label: "Recommended equipment",
            category: "Systems" as const,
            description: "A recommendation is not a gate.",
            prerequisites: [],
            evidence: [{ kind: "wiki" as const, url: "https://wiki.warframe.com/", verifiedOn: "2026-11-08", classification: "recommended" as const, note: "Helpful suggestion only." }],
        };
        expect(computeUnlockGraphSnapshot({}, [recommendedOnly]).byId[PR.VORS_PRIZE].unlocked).toBe(true);

    });

    it("requires both parent quests for Lua, then Lua for Vessel, then Vessel for Eris Mortem", () => {
        const oneParent = computeUnlockGraphSnapshot({
            [PR.THE_HEX]: true,
        }).byId[PR.TAU_PROLOGUE_LUA];
        const bothParents = computeUnlockGraphSnapshot({
            [PR.THE_HEX]: true,
            [PR.THE_OLD_PEACE]: true,
        });
        expect(oneParent.unlocked).toBe(false);
        expect(bothParents.byId[PR.TAU_PROLOGUE_LUA].unlocked).toBe(true);
        expect(bothParents.byId[PR.TAU_PROLOGUE_VESSEL].unlocked).toBe(false);
        expect(bothParents.byId[PR.TAU_PROLOGUE_ERIS_MORTEM].unlocked).toBe(false);
        expect(computeUnlockGraphSnapshot({ [PR.TAU_PROLOGUE_LUA]: true }).byId[PR.TAU_PROLOGUE_VESSEL].unlocked).toBe(true);
        expect(computeUnlockGraphSnapshot({ [PR.TAU_PROLOGUE_VESSEL]: true }).byId[PR.TAU_PROLOGUE_ERIS_MORTEM].unlocked).toBe(true);
        expect(definition(PR.TAU_PROLOGUE_ERIS_MORTEM).prerequisites).toEqual([PR.TAU_PROLOGUE_VESSEL]);
    });

    it("uses current syndicate rank for the Hex Finale trigger milestone", () => {
        const prerequisites = { [PR.THE_HEX]: true };
        const locked = computeUnlockGraphSnapshot(prerequisites, undefined, { syndicateRankById: { [SY.THE_HEX]: 2 } }).byId[PR.SYSTEM_HEX_ALL_LIKED];
        const unlocked = computeUnlockGraphSnapshot(prerequisites, undefined, { syndicateRankById: { [SY.THE_HEX]: 3 } }).byId[PR.SYSTEM_HEX_ALL_LIKED];
        expect(locked.unlocked).toBe(false);
        expect(unlocked.unlocked).toBe(true);
    });
});

describe("milestone rule evaluation", () => {
    it("honors all/any milestone definitions instead of looking for removed flat prereq fields", () => {
        const milestoneId = "ms_hub_first_open_world";
        const empty = computeMilestoneSnapshot({}).milestones.find((milestone) => milestone.id === milestoneId)!;
        expect(empty.total).toBe(1);
        expect(empty.completed).toBe(false);

        const onePath = computeMilestoneSnapshot({ [PR.HUB_FORTUNA]: true }).milestones.find((milestone) => milestone.id === milestoneId)!;
        expect(onePath.completed).toBe(true);
        expect(onePath.completedCount).toBe(1);
    });

    it("resolves the Tau Prologue milestone only after all three released chapters are complete", () => {
        const incomplete = computeMilestoneSnapshot({}).milestones.find((milestone) => milestone.id === "ms_main_tau_prologue_complete")!;
        const oneChapter = computeMilestoneSnapshot({ [PR.TAU_PROLOGUE_LUA]: true }).milestones.find((milestone) => milestone.id === "ms_main_tau_prologue_complete")!;
        const twoChapters = computeMilestoneSnapshot({ [PR.TAU_PROLOGUE_LUA]: true, [PR.TAU_PROLOGUE_VESSEL]: true }).milestones.find((milestone) => milestone.id === "ms_main_tau_prologue_complete")!;
        const complete = computeMilestoneSnapshot({
            [PR.TAU_PROLOGUE_LUA]: true,
            [PR.TAU_PROLOGUE_VESSEL]: true,
            [PR.TAU_PROLOGUE_ERIS_MORTEM]: true,
        }).milestones.find((milestone) => milestone.id === "ms_main_tau_prologue_complete")!;
        expect(incomplete.completed).toBe(false);
        expect(oneChapter.completed).toBe(false);
        expect(twoChapters.completed).toBe(false);
        expect(complete.completed).toBe(true);
        expect(complete.completedPrereqs).toEqual([PR.TAU_PROLOGUE_LUA, PR.TAU_PROLOGUE_VESSEL, PR.TAU_PROLOGUE_ERIS_MORTEM]);
    });
});
