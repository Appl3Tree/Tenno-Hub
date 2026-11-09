import { describe, expect, it } from "vitest";
import { PREREQ_REGISTRY } from "../../../catalog/prereqs/prereqRegistry";
import { PR } from "../../ids/prereqIds";
import { computeUnlockGraphSnapshot, isPrereqUnlocked } from "../unlockGraph";
import { computeMilestoneSnapshot } from "../milestoneEngine";
import { deriveCompletedMap } from "../syndicatePrereqs";
import { isAutoTrackedPrereq } from "../syndicatePrereqs";
import { STAR_CHART_NODES } from "../../catalog/starChart/nodes";
import { SY } from "../../ids/syndicateIds";
import { buildProgressionPlan } from "../plannerEngine";

const definition = (id: string) => PREREQ_REGISTRY.find((entry) => entry.id === id)!;

describe("current Warframe progression gates", () => {
    it("blocks Steel Path and Nightmare access until their Star Chart conditions are met", () => {
        const noNodesComplete = computeUnlockGraphSnapshot({ [PR.HUB_RELAY]: true }, undefined, { nodeCompletedMap: {} });
        expect(noNodesComplete.byId[PR.ACTIVITY_STEEL_PATH].unlocked).toBe(false);
        expect(noNodesComplete.byId[PR.ACTIVITY_STEEL_PATH].missingConditions).toContainEqual({
            type: "star_chart_access",
            activity: "steel_path",
        });
        expect(isAutoTrackedPrereq(PR.ACTIVITY_STEEL_PATH)).toBe(true);

        const allNodesComplete = Object.fromEntries(STAR_CHART_NODES.filter((node) => node.nodeType !== "hub").map((node) => [node.id, true]));
        const complete = computeUnlockGraphSnapshot({ [PR.HUB_RELAY]: true, [PR.VORS_PRIZE]: true }, undefined, { nodeCompletedMap: allNodesComplete });
        expect(complete.byId[PR.ACTIVITY_STEEL_PATH].unlocked).toBe(true);
        expect(complete.byId[PR.ACTIVITY_NIGHTMARE].unlocked).toBe(true);
        expect(isAutoTrackedPrereq(PR.ACTIVITY_NIGHTMARE)).toBe(true);
        expect(deriveCompletedMap({}, [], 0, allNodesComplete)[PR.ACTIVITY_STEEL_PATH]).toBe(true);
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
        expect(definition(PR.NEW_WAR).prerequisites).toContain(PR.SYSTEM_OPERATOR_AMP);
        expect(definition(PR.NEW_WAR).prerequisites).not.toContain(PR.NECRAMECH_UNLOCKED);

        const withAmp = computeUnlockGraphSnapshot({
            [PR.PRELUDE_TO_WAR]: true,
            [PR.RAILJACK_CONSTRUCTED]: true,
            [PR.SYSTEM_OPERATOR_AMP]: true,
        }).byId[PR.NEW_WAR];
        expect(withAmp.unlocked).toBe(true);

        const moteAmpImpliesAnyAmp = deriveCompletedMap({ [PR.AMP_MOTE]: true }, [], 0);
        expect(moteAmpImpliesAnyAmp[PR.SYSTEM_OPERATOR_AMP]).toBe(true);
    });

    it("uses Onkko visit, not Saya's Vigil or Mote Amp ownership, as the current Chains of Harrow gate", () => {
        expect(definition(PR.CHAINS_HARROW).prerequisites).toEqual([PR.SYSTEM_ONKKO_VISITED]);
        expect(definition(PR.SYSTEM_ONKKO_VISITED).prerequisites).toEqual([PR.WAR_WITHIN, PR.HUB_CETUS]);
        expect(definition(PR.AMP_MOTE).prerequisites).toEqual([PR.SYSTEM_ONKKO_VISITED]);
    });

    it("requires Saya's Vigil and a Quills visit for full Focus access, not Quills rank 1", () => {
        expect(definition(PR.FOCUS_FULL).prerequisites).toEqual([PR.SYSTEM_ONKKO_VISITED, PR.SAYA_VIGIL]);
        expect(isPrereqUnlocked({ [PR.SYSTEM_ONKKO_VISITED]: true }, PR.FOCUS_FULL)).toBe(false);
        expect(isPrereqUnlocked({ [PR.SYSTEM_ONKKO_VISITED]: true, [PR.SAYA_VIGIL]: true }, PR.FOCUS_FULL)).toBe(true);
        expect(definition(PR.FOCUS_FULL).prerequisites).not.toContain(PR.SYNDICATE_QUILLS_RANK1);
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

        // Junction task chains imply their rewards; do not duplicate those tasks
        // as independent direct requirements on the unlocked quest.
        expect(definition(PR.SECOND_DREAM).prerequisites).toEqual([PR.JUNCTION_URANUS_NEPTUNE]);
        expect(definition(PR.WAR_WITHIN).prerequisites).toEqual([PR.JUNCTION_NEPTUNE_PLUTO]);

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

    it("evaluates a true OR route while preserving mandatory AND requirements", () => {
        const icebind = computeUnlockGraphSnapshot({
            [PR.ANGELS_ZARIMAN]: true,
            [PR.WHISPERS_WALL]: true,
            [PR.ACTIVITY_ELITE_TEMPORAL_ARCHIMEDEA]: true,
        }).byId[PR.ACTIVITY_ICEBIND];
        expect(icebind.unlocked).toBe(true);
        expect(icebind.missing).toEqual([]);
        expect(icebind.missingAnyPrerequisites).toEqual([]);

        const missingBoth = computeUnlockGraphSnapshot({
            [PR.ANGELS_ZARIMAN]: true,
            [PR.WHISPERS_WALL]: true,
        }).byId[PR.ACTIVITY_ICEBIND];
        expect(missingBoth.unlocked).toBe(false);
        expect(missingBoth.missingAnyPrerequisites).toEqual([
            PR.ACTIVITY_ELITE_DEEP_ARCHIMEDEA,
            PR.ACTIVITY_ELITE_TEMPORAL_ARCHIMEDEA,
        ]);

        const missingMandatory = computeUnlockGraphSnapshot({
            [PR.ANGELS_ZARIMAN]: true,
            [PR.ACTIVITY_ELITE_DEEP_ARCHIMEDEA]: true,
        }).byId[PR.ACTIVITY_ICEBIND];
        expect(missingMandatory.missing).toContain(PR.WHISPERS_WALL);
        expect(missingMandatory.unlocked).toBe(false);
    });

    it("supports Dark Refractory access after The Old Peace or opting into preview after The Teacher", () => {
        expect(isPrereqUnlocked({ [PR.THE_OLD_PEACE]: true }, PR.ACTIVITY_DARK_REFRACTORY)).toBe(true);
        expect(isPrereqUnlocked({ [PR.THE_TEACHER]: true }, PR.ACTIVITY_DARK_REFRACTORY)).toBe(false);
        expect(isPrereqUnlocked({}, PR.ACTIVITY_DARK_REFRACTORY)).toBe(false);

        const previewAvailable = deriveCompletedMap({ [PR.THE_TEACHER]: true }, [], 0);
        expect(previewAvailable[PR.SYSTEM_DARK_REFRACTORY_PREVIEW]).toBeUndefined();
        expect(previewAvailable[PR.ACTIVITY_DARK_REFRACTORY]).toBeUndefined();
        expect(isPrereqUnlocked(previewAvailable, PR.SYSTEM_DARK_REFRACTORY_PREVIEW)).toBe(true);
        expect(isPrereqUnlocked(previewAvailable, PR.ACTIVITY_DARK_REFRACTORY)).toBe(false);

        const previewUsed = deriveCompletedMap({
            [PR.THE_TEACHER]: true,
            [PR.SYSTEM_DARK_REFRACTORY_PREVIEW]: true,
        }, [], 0);
        expect(isPrereqUnlocked(previewUsed, PR.ACTIVITY_DARK_REFRACTORY)).toBe(true);
        expect(previewUsed[PR.ACTIVITY_DARK_REFRACTORY]).toBe(true);
        expect(isPrereqUnlocked(previewUsed, PR.ACTIVITY_DESCENDIA)).toBe(true);
        expect(isPrereqUnlocked(previewUsed, PR.ACTIVITY_PERITA_REBELLION)).toBe(true);

        const questRoute = deriveCompletedMap({ [PR.THE_OLD_PEACE]: true }, [], 0);
        expect(isPrereqUnlocked(questRoute, PR.ACTIVITY_DESCENDIA)).toBe(true);
        expect(isPrereqUnlocked(questRoute, PR.ACTIVITY_PERITA_REBELLION)).toBe(true);
    });

    it("allows Amp gilding through either Quills Adherent or Vox Solaris Hand", () => {
        expect(definition(PR.AMP_GILDING).anyPrerequisites).toEqual([
            PR.SYNDICATE_QUILLS_RANK3,
            PR.SYNDICATE_VOX_RANK3,
        ]);
        expect(isPrereqUnlocked({ [PR.SYNDICATE_QUILLS_RANK3]: true }, PR.AMP_GILDING)).toBe(true);
        expect(isPrereqUnlocked({ [PR.SYNDICATE_VOX_RANK3]: true }, PR.AMP_GILDING)).toBe(true);
        expect(isPrereqUnlocked({}, PR.AMP_GILDING)).toBe(false);
    });

    it("requires current Vox Solaris syndicate access and follows every tracked rank", () => {
        expect(definition(PR.SYNDICATE_VOX_RANK1).prerequisites).toEqual([
            PR.VOX_SOLARIS,
            PR.SYSTEM_ONKKO_VISITED,
        ]);
        expect(definition(PR.SYNDICATE_VOX_RANK4).prerequisites).toEqual([PR.SYNDICATE_VOX_RANK3]);
        expect(definition(PR.SYNDICATE_VOX_RANK5).prerequisites).toEqual([PR.SYNDICATE_VOX_RANK4]);

        const blocked = computeUnlockGraphSnapshot({ [PR.VOX_SOLARIS]: true }).byId[PR.SYNDICATE_VOX_RANK1];
        expect(blocked.unlocked).toBe(false);
        expect(blocked.missing).toContain(PR.SYSTEM_ONKKO_VISITED);

        const unlocked = computeUnlockGraphSnapshot({
            [PR.VOX_SOLARIS]: true,
            [PR.SYSTEM_ONKKO_VISITED]: true,
        }).byId[PR.SYNDICATE_VOX_RANK1];
        expect(unlocked.unlocked).toBe(true);
    });

    it("keeps recommendations nonblocking and uses live event date boundaries", () => {
        const recommendedOnly = {
            id: PR.VORS_PRIZE,
            label: "Recommended equipment",
            category: "Systems" as const,
            description: "A recommendation is not a gate.",
            prerequisites: [],
            evidence: [{ kind: "wiki" as const, url: "https://wiki.warframe.com/", verifiedOn: "2026-11-08", classification: "recommended" as const, note: "Helpful suggestion only." }],
        };
        expect(computeUnlockGraphSnapshot({}, [recommendedOnly]).byId[PR.VORS_PRIZE].unlocked).toBe(true);

        const eventEntry = { [PR.VORS_PRIZE]: true };
        expect(isPrereqUnlocked(eventEntry, PR.ACTIVITY_TAUBOUND, undefined, { currentDate: "2026-10-15" })).toBe(true);
        expect(isPrereqUnlocked(eventEntry, PR.ACTIVITY_TAUBOUND, undefined, { currentDate: "2026-11-17" })).toBe(true);
        expect(isPrereqUnlocked(eventEntry, PR.ACTIVITY_TAUBOUND, undefined, { currentDate: "2026-11-18" })).toBe(false);
    });

    it("requires both quests for Tau Prologue and Chains of Harrow for Follie's Hunt", () => {
        const tau = computeUnlockGraphSnapshot({
            [PR.THE_HEX]: true,
            [PR.THE_OLD_PEACE]: true,
        }).byId[PR.TAU_PROLOGUE];
        expect(tau.unlocked).toBe(true);
        expect(definition(PR.ACTIVITY_FOLLIES_HUNT).prerequisites).toEqual([PR.CHAINS_HARROW]);
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
});
