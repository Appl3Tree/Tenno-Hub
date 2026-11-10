import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Handbook from "../../../pages/Handbook";
import { PREREQ_REGISTRY } from "../../prereqs/prereqRegistry";
import { computeMilestoneSnapshot } from "../../../domain/logic/milestoneEngine";
import { PR } from "../../../domain/ids/prereqIds";
import { computeUnlockGraphSnapshot } from "../../../domain/logic/unlockGraph";
import { QUEST_GUIDE_ENTRIES, QUEST_GUIDE_GROUPS } from "../questCatalog";
import { WIKI_QUEST_INVENTORY } from "./wikiQuestInventory.fixture";

const byId = new Map(PREREQ_REGISTRY.map((definition) => [definition.id, definition]));
const sorted = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b));

describe("Wiki-derived quest coverage", () => {
    it("reconciles the independent Wiki inventory, every registry quest, and Handbook data in both directions", () => {
        const expectedIds = WIKI_QUEST_INVENTORY.map((quest) => quest.internalId);
        const registryIds = PREREQ_REGISTRY
            .filter((definition) => definition.id.startsWith("quest_"))
            .map((definition) => definition.id);
        const guideIds = QUEST_GUIDE_ENTRIES.map((entry) => entry.prereqId);

        expect(new Set(expectedIds).size).toBe(expectedIds.length);
        expect(new Set(registryIds).size).toBe(registryIds.length);
        expect(new Set(guideIds).size).toBe(guideIds.length);
        expect(sorted(registryIds)).toEqual(sorted(expectedIds));
        expect(sorted(guideIds)).toEqual(sorted(expectedIds));

        const rendered = renderToStaticMarkup(createElement(Handbook));
        const toVisibleText = (markup: string) => markup
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&#x27;|&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&nbsp;/g, " ");
        const visibleText = toVisibleText(rendered);
        const questListHtml = rendered.match(/<ol class="list-none m-0 p-0">([\s\S]*?)<\/ol>/)?.[1] ?? "";
        const renderedQuestNames = [...questListHtml.matchAll(/<span class="font-semibold text-slate-100 text-sm">([\s\S]*?)<\/span>/g)]
            .map((match) => toVisibleText(match[1]).trim());
        expect(renderedQuestNames).toEqual(WIKI_QUEST_INVENTORY.map((quest) => quest.canonicalName));

        for (const expected of WIKI_QUEST_INVENTORY) {
            const definition = byId.get(expected.internalId);
            const presentation = QUEST_GUIDE_ENTRIES.find((entry) => entry.prereqId === expected.internalId);
            expect(definition, `${expected.canonicalName} must have a canonical progression record`).toBeDefined();
            expect(definition?.label).toBe(expected.canonicalName);
            expect(presentation?.classification).toBe(expected.classification);
            expect(presentation?.subgroup).toBe(expected.subgroup);
            expect(visibleText).toContain(expected.canonicalName);
        }

        expect(QUEST_GUIDE_GROUPS.map((group) => [group.id, group.entries.length])).toEqual([
            ["main", 29],
            ["side", 6],
            ["warframe", 12],
        ]);
    });

    it("shows the current Jade Shadows: Constellations gate in the Handbook and unlock graph", () => {
        const quest = byId.get(PR.JADE_SHADOWS_CONSTELLATIONS)!;
        expect(quest.prerequisites).toEqual([PR.JADE_SHADOWS]);
        expect(quest.introducedIn).toBe("Update 43 (June 17, 2026)");
        expect(WIKI_QUEST_INVENTORY.find((entry) => entry.internalId === PR.JADE_SHADOWS_CONSTELLATIONS)?.introducedIn)
            .toBe("Update 43 (2026-06-17)");
        expect(computeUnlockGraphSnapshot({}).byId[PR.JADE_SHADOWS_CONSTELLATIONS].unlocked).toBe(false);
        expect(computeUnlockGraphSnapshot({ [PR.JADE_SHADOWS]: true }).byId[PR.JADE_SHADOWS_CONSTELLATIONS].unlocked).toBe(true);
        expect(computeMilestoneSnapshot({ [PR.JADE_SHADOWS_CONSTELLATIONS]: true }).milestones
            .find((milestone) => milestone.id === "ms_main_jade_constellations_complete")?.completed).toBe(true);

        const rendered = renderToStaticMarkup(createElement(Handbook));
        expect(rendered).toContain("Jade Shadows: Constellations");
        expect(rendered).toContain("Jade Shadows</span>");
    });

    it("models the two released Prologue to Tau chapters without exposing an unreleased chapter", () => {
        const lua = byId.get(PR.TAU_PROLOGUE_LUA)!;
        const vessel = byId.get(PR.TAU_PROLOGUE_VESSEL)!;
        expect(lua.prerequisites).toEqual([PR.THE_HEX, PR.THE_OLD_PEACE]);
        expect(vessel.prerequisites).toEqual([PR.TAU_PROLOGUE_LUA]);
        expect(lua.introducedIn).toBe("Hotfix 44.1.2 (October 15, 2026)");
        expect(vessel.introducedIn).toBe(lua.introducedIn);
        expect(WIKI_QUEST_INVENTORY.find((entry) => entry.internalId === PR.TAU_PROLOGUE_LUA)?.introducedIn)
            .toBe("Hotfix 44.1.2 (2026-10-15)");

        expect(computeUnlockGraphSnapshot({ [PR.THE_HEX]: true }).byId[PR.TAU_PROLOGUE_LUA].unlocked).toBe(false);
        expect(computeUnlockGraphSnapshot({ [PR.THE_HEX]: true, [PR.THE_OLD_PEACE]: true }).byId[PR.TAU_PROLOGUE_LUA].unlocked).toBe(true);
        expect(computeUnlockGraphSnapshot({ [PR.TAU_PROLOGUE_LUA]: true }).byId[PR.TAU_PROLOGUE_VESSEL].unlocked).toBe(true);

        const rendered = renderToStaticMarkup(createElement(Handbook));
        expect(rendered).toContain("Prologue to Tau");
        expect(rendered).toContain("Lua");
        expect(rendered).toContain("Vessel");
        expect(rendered).not.toContain("???");
        expect(rendered).not.toContain("Operation: Taubound");
    });

    it("uses Wiki's displayed epilogue name while retaining the stable completion identity", () => {
        expect(byId.get(PR.THE_HEX_FINALE)?.label).toBe("Finale");
        expect(byId.get(PR.THE_HEX_FINALE)?.partOf).toBe("The Hex");
        expect(byId.has(PR.THE_HEX_FINALE)).toBe(true);
    });
});
