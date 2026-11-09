import { describe, expect, it } from "vitest";
import { PREREQ_REGISTRY } from "../prereqRegistry";
import { SOURCE_INDEX } from "../../sources/sourceCatalog";
import { PR } from "../../../domain/ids/prereqIds";
import { MILESTONE_REGISTRY } from "../milestoneRegistry";
import { STAR_CHART_NODES } from "../../../domain/catalog/starChart/nodes";
import { STAR_CHART_PLANETS } from "../../../domain/catalog/starChart/planets";
import { SY } from "../../../domain/ids/syndicateIds";

describe("prerequisite registry integrity", () => {
    it("defines every prerequisite referenced by other registry rows", () => {
        const ids = new Set(PREREQ_REGISTRY.map((def) => def.id));
        const missing = PREREQ_REGISTRY.flatMap((def) =>
            [...def.prerequisites, ...(def.anyPrerequisites ?? [])]
                .filter((prereqId) => !ids.has(prereqId))
                .map((prereqId) => `${def.id} -> ${prereqId}`),
        );

        expect(missing).toEqual([]);
    });

    it("defines every prerequisite id referenced by the source catalog", () => {
        const ids = new Set(PREREQ_REGISTRY.map((def) => def.id));
        const missing = Object.entries(SOURCE_INDEX).flatMap(([sourceId, source]) =>
            (source.prereqIds ?? [])
                .filter((prereqId) => !ids.has(prereqId))
                .map((prereqId) => `${sourceId} -> ${prereqId}`),
        );

        expect(missing).toEqual([]);
    });

    it("defines every prerequisite id referenced by milestone rules", () => {
        const ids = new Set(PREREQ_REGISTRY.map((def) => def.id));
        const missing = MILESTONE_REGISTRY.flatMap((milestone) =>
            milestone.rule.prereqIds
                .filter((prereqId) => !ids.has(prereqId))
                .map((prereqId) => `${milestone.id} -> ${prereqId}`),
        );
        expect(missing).toEqual([]);
    });

    it("defines every quest or junction reference used by a condition", () => {
        const ids = new Set(PREREQ_REGISTRY.map((def) => def.id));
        const nodeIds = new Set(STAR_CHART_NODES.map((node) => node.id));
        const planetIds = new Set(STAR_CHART_PLANETS.map((planet) => planet.id));
        const syndicateIds = new Set(Object.values(SY));
        const missing = PREREQ_REGISTRY.flatMap((def) =>
            (def.conditions ?? []).flatMap((condition) => {
                if (condition.type === "quest_complete" && !ids.has(condition.prereqId)) return [`${def.id} -> ${condition.prereqId}`];
                if (condition.type === "junction_complete" && !ids.has(condition.junctionId as typeof def.id)) return [`${def.id} -> ${condition.junctionId}`];
                if (condition.type === "node_complete" && !nodeIds.has(condition.nodeId)) return [`${def.id} -> ${condition.nodeId}`];
                if (condition.type === "planet_unlock" && !planetIds.has(condition.planetId)) return [`${def.id} -> ${condition.planetId}`];
                if (condition.type === "syndicate_rank" && !syndicateIds.has(condition.syndicateId)) return [`${def.id} -> ${condition.syndicateId}`];
                return [];
            }),
        );
        expect(missing).toEqual([]);
    });

    it("has unique stable entries and no self or duplicate direct edges", () => {
        const ids = PREREQ_REGISTRY.map((def) => def.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(PREREQ_REGISTRY.map((def) => def.label.toLowerCase().replace(/[^a-z0-9]/g, ""))).size)
            .toBe(PREREQ_REGISTRY.length);

        for (const def of PREREQ_REGISTRY) {
            const allParents = [...def.prerequisites, ...(def.anyPrerequisites ?? [])];
            expect(allParents, `${def.id} self-reference`).not.toContain(def.id);
            expect(new Set(def.prerequisites).size, `${def.id} duplicate AND parents`).toBe(def.prerequisites.length);
            expect(new Set(def.anyPrerequisites ?? []).size, `${def.id} duplicate OR parents`).toBe((def.anyPrerequisites ?? []).length);
            expect(def.prerequisites.some((id) => (def.anyPrerequisites ?? []).includes(id)), `${def.id} AND/OR overlap`).toBe(false);
        }
    });

    it("keeps Star Chart junction relationships centralized in the prerequisite registry", () => {
        const byId = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        const junctionNodes = STAR_CHART_NODES.filter((node) => node.nodeType === "junction");
        const missing = junctionNodes.filter((node) => !byId.has(node.id.replace(/^node:/, ""))).map((node) => node.id);

        expect(missing).toEqual([]);
        expect(junctionNodes.filter((node) => node.prereqIds !== undefined).map((node) => node.id)).toEqual([]);
        expect(junctionNodes.length).toBe(PREREQ_REGISTRY.filter((def) => def.label.startsWith("Junction:")).length);
        expect(junctionNodes.some((node) => node.id === "node:junction_earth_lua")).toBe(false);
        expect(junctionNodes.some((node) => node.id === "node:junction_mars_deimos")).toBe(false);
        expect(byId.get(PR.JUNCTION_EARTH_LUA)?.label).toBe("Lua Access");
        expect(byId.get(PR.DEIMOS_ACCESS)?.label).toBe("Deimos Access");
        expect(STAR_CHART_NODES.find((node) => node.id === "node:junction_venus_earth"))
            .toMatchObject({ planetId: "planet:earth", name: "Venus Junction", unlocksPlanetId: "planet:venus" });
        expect(STAR_CHART_NODES.find((node) => node.id === "node:junction_mercury_venus"))
            .toMatchObject({ planetId: "planet:venus", name: "Mercury Junction", unlocksPlanetId: "planet:mercury" });
    });

    it("keeps Star Chart node and planet references resolvable", () => {
        const nodeIds = new Set(STAR_CHART_NODES.map((node) => node.id));
        const planetIds = new Set(STAR_CHART_PLANETS.map((planet) => planet.id));
        const duplicateNodes = STAR_CHART_NODES.map((node) => node.id).filter((id, i, all) => all.indexOf(id) !== i);
        const invalid = STAR_CHART_NODES.flatMap((node) => [
            ...(!planetIds.has(node.planetId) ? [`${node.id} -> ${node.planetId}`] : []),
            ...node.edges.filter((id) => !nodeIds.has(id)).map((id) => `${node.id} -> ${id}`),
            ...(node.unlocksPlanetId && !planetIds.has(node.unlocksPlanetId) ? [`${node.id} -> ${node.unlocksPlanetId}`] : []),
        ]);

        expect(duplicateNodes).toEqual([]);
        expect(invalid).toEqual([]);
    });

    it("has no cycles across AND and OR dependencies", () => {
        const index = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        const visiting = new Set<string>();
        const visited = new Set<string>();

        function visit(id: string): boolean {
            if (visiting.has(id)) return false;
            if (visited.has(id)) return true;
            visiting.add(id);
            const def = index.get(id)!;
            const conditionParents = (def.conditions ?? []).flatMap((condition) =>
                condition.type === "quest_complete" ? [condition.prereqId]
                    : condition.type === "junction_complete" ? [condition.junctionId as typeof def.id]
                        : [],
            );
            for (const parent of [...def.prerequisites, ...(def.anyPrerequisites ?? []), ...conditionParents]) {
                if (!visit(parent)) return false;
            }
            visiting.delete(id);
            visited.add(id);
            return true;
        }

        expect(PREREQ_REGISTRY.every((def) => visit(def.id))).toBe(true);
    });

    it("only leaves intentional root milestones without parents", () => {
        const roots = PREREQ_REGISTRY
            .filter((def) => def.prerequisites.length === 0 && !(def.anyPrerequisites?.length) && !(def.conditions?.length))
            .map((def) => def.id)
            .sort();

        expect(roots).toEqual([PR.SYSTEM_OPERATOR_AMP, PR.SYSTEM_RANK30_WARFRAME, PR.VORS_PRIZE].sort());
    });

    it("makes every other prerequisite reachable from Vor's Prize", () => {
        const index = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));

        function reachesVors(id: string, seen = new Set<string>()): boolean {
            if (id === PR.VORS_PRIZE || id === PR.SYSTEM_OPERATOR_AMP || id === PR.SYSTEM_RANK30_WARFRAME) return true;
            if (seen.has(id)) return false;
            seen.add(id);
            const def = index.get(id);
            if (!def) return false;
            const parents = [...def.prerequisites, ...(def.anyPrerequisites ?? [])];
            if (parents.length === 0 && def.conditions?.length) return true;
            if (parents.length === 0) return false;
            return parents.some((prereqId) => reachesVors(prereqId, seen));
        }

        const disconnected = PREREQ_REGISTRY
            .filter((def) => def.id !== PR.VORS_PRIZE && def.id !== PR.SYSTEM_OPERATOR_AMP && def.id !== PR.SYSTEM_RANK30_WARFRAME)
            .map((def) => def.id)
            .filter((id) => !reachesVors(id));

        expect(disconnected).toEqual([]);
    });

    it("keeps Quills rank sources aligned with the actual rank that unlocks them", () => {
        expect(SOURCE_INDEX["data:syndicate/quills/architect"]?.prereqIds).toEqual([PR.SYNDICATE_QUILLS_RANK5]);
        expect(SOURCE_INDEX["data:syndicate/quills/adherent"]?.prereqIds).toEqual([PR.SYNDICATE_QUILLS_RANK3]);
        expect(SOURCE_INDEX["data:vendor/cetus/quills"]?.prereqIds).toEqual([PR.SYSTEM_ONKKO_VISITED]);
        expect(SOURCE_INDEX["data:vendor/fortuna/vox-solaris"]?.prereqIds).toEqual([PR.VOX_SOLARIS, PR.SYSTEM_ONKKO_VISITED]);
        expect(SOURCE_INDEX["data:system/focus"]?.prereqIds).toEqual([PR.SECOND_DREAM]);
    });

    it("keeps Entrati rank progression separate from the MR8 Helminth segment gate", () => {
        const rank3 = PREREQ_REGISTRY.find((def) => def.id === PR.SYNDICATE_ENTRATI_RANK3)!;
        const rank4 = PREREQ_REGISTRY.find((def) => def.id === PR.SYNDICATE_ENTRATI_RANK4)!;
        const rank5 = PREREQ_REGISTRY.find((def) => def.id === PR.SYNDICATE_ENTRATI_RANK5)!;
        expect(rank3.conditions).toBeUndefined();
        expect(rank4.prerequisites).toEqual([PR.SYNDICATE_ENTRATI_RANK3]);
        expect(rank5.prerequisites).toEqual([PR.SYNDICATE_ENTRATI_RANK4]);
        expect(rank5.conditions).toBeUndefined();
        expect(PREREQ_REGISTRY.find((def) => def.id === PR.SEGMENT_HELMINTH)?.conditions)
            .toContainEqual({ type: "mastery_rank", value: 8 });
    });
});
