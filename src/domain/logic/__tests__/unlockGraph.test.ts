import { describe, expect, it } from "vitest";
import { PR } from "../../ids/prereqIds";
import { computeUnlockGraphSnapshot } from "../unlockGraph";
import { deriveCompletedMap, isAutoTrackedPrereq } from "../syndicatePrereqs";
import { STAR_CHART_NODES } from "../../catalog/starChart/nodes";

describe("unlockGraph condition handling", () => {
    it("does not keep the main quest path behind the removed MR5 gate", () => {
        const completedMap = {
            [PR.SECOND_DREAM]: true,
            [PR.JUNCTION_NEPTUNE_PLUTO]: true,
        };

        const unlocked = computeUnlockGraphSnapshot(completedMap, undefined, { masteryRank: 0 }).byId[PR.WAR_WITHIN];
        expect(unlocked.unlocked).toBe(true);
        expect(unlocked.missingConditions).toEqual([]);
    });
});

describe("auto-tracked prerequisite derivation", () => {
    it("auto-completes mastery milestones from the profile mastery rank", () => {
        const merged = deriveCompletedMap({}, [], 8);
        expect(merged[PR.MR_5]).toBe(true);
        expect(merged[PR.MR_8]).toBe(true);
        expect(merged[PR.MR_10]).not.toBe(true);
    });

    it("flags mastery milestones as auto-tracked", () => {
        expect(isAutoTrackedPrereq(PR.MR_5)).toBe(true);
        expect(isAutoTrackedPrereq(PR.WAR_WITHIN)).toBe(false);
    });

    it("auto-completes Steel Path and Nightmare when the imported star chart shows the required nodes complete", () => {
        const allNodesComplete = Object.fromEntries(STAR_CHART_NODES.map((node) => [node.id, true]));
        const merged = deriveCompletedMap({}, [], 5, allNodesComplete);
        expect(merged[PR.ACTIVITY_STEEL_PATH]).toBe(true);
        expect(merged[PR.ACTIVITY_NIGHTMARE]).toBe(true);
    });
});
