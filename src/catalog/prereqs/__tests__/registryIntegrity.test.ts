import { describe, expect, it } from "vitest";
import { PREREQ_REGISTRY } from "../prereqRegistry";
import { SOURCE_INDEX } from "../../sources/sourceCatalog";
import { PR } from "../../../domain/ids/prereqIds";
import { MILESTONE_REGISTRY } from "../milestoneRegistry";
import { STAR_CHART_NODES } from "../../../domain/catalog/starChart/nodes";
import { STAR_CHART_PLANETS } from "../../../domain/catalog/starChart/planets";
import { SY } from "../../../domain/ids/syndicateIds";
import { computeUnlockGraphSnapshot } from "../../../domain/logic/unlockGraph";

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

    it("records fact-specific, reviewable evidence for every registry entry and hard gate", () => {
        const invalid = PREREQ_REGISTRY.flatMap((def) => {
            const hasGate = def.prerequisites.length > 0 || (def.anyPrerequisites?.length ?? 0) > 0 || (def.conditions?.length ?? 0) > 0;
            const evidence = def.evidence ?? [];
            return [
                ...(evidence.length === 0 ? [`${def.id}: no evidence`] : []),
                ...(hasGate && !evidence.some((source) => source.classification === "required" || source.classification === "conditional")
                    ? [`${def.id}: no evidence classified as a current enforced requirement`]
                    : []),
                ...evidence.flatMap((source, index) => [
                    ...(!source.url.startsWith("https://") ? [`${def.id} evidence ${index + 1}: invalid URL`] : []),
                    ...(!/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedOn) ? [`${def.id} evidence ${index + 1}: invalid date`] : []),
                    ...(!source.note.trim() ? [`${def.id} evidence ${index + 1}: empty note`] : []),
                    ...(/direct gate tracked for|generic progression entry/i.test(source.note) ? [`${def.id} evidence ${index + 1}: generic note`] : []),
                ]),
            ];
        });

        expect(invalid).toEqual([]);
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

        expect(roots).toEqual([
            PR.CLAN_DOJO,
            PR.COMPANION_MATURE_CYST,
            PR.NECRAMECH_MARKET,
            PR.RAILJACK_MARKET_ACQUIRED,
            PR.SYSTEM_ADVERSARY_SLOT_CLEAR,
            PR.SYSTEM_OPERATOR_AMP,
            PR.SYSTEM_RANK30_WARFRAME,
            PR.AWAKENING,
            PR.HUB_RELAY,
            PR.MR_5,
            PR.MR_8,
            PR.MR_10,
            PR.MR_15,
            PR.MR_30,
        ].sort());
    });

    it("connects progression entries to a tutorial or documented independent acquisition root", () => {
        const index = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        const independentRoots = new Set<string>([
            PR.AWAKENING,
            PR.SYSTEM_OPERATOR_AMP,
            PR.SYSTEM_RANK30_WARFRAME,
            PR.CLAN_DOJO,
            PR.COMPANION_MATURE_CYST,
            PR.HELMINTH_MARKET_BUNDLE,
            PR.NECRAMECH_MARKET,
            PR.RAILJACK_MARKET_ACQUIRED,
            PR.SYSTEM_ADVERSARY_SLOT_CLEAR,
            PR.HUB_RELAY,
            PR.MR_5,
            PR.MR_8,
            PR.MR_10,
            PR.MR_15,
            PR.MR_30,
        ]);

        function reachesVors(id: string, seen = new Set<string>()): boolean {
            if (independentRoots.has(id)) return true;
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
            .filter((def) => !independentRoots.has(def.id))
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
        expect(PREREQ_REGISTRY.find((def) => def.id === PR.SEGMENT_HELMINTH_SON_ACCESS)?.conditions)
            .toContainEqual({ type: "mastery_rank", value: 8 });
        expect(PREREQ_REGISTRY.find((def) => def.id === PR.HELMINTH_MARKET_BUNDLE)?.conditions)
            .toContainEqual({ type: "mastery_rank", value: 8 });
        expect(PREREQ_REGISTRY.find((def) => def.id === PR.SEGMENT_HELMINTH)?.conditions)
            .toContainEqual({ type: "mastery_rank", value: 8 });
    });

    it("keeps newly tracked syndicate ranks connected through their actual previous rank", () => {
        const byId = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        expect(byId.get(PR.SYNDICATE_NECRALOID_RANK1)?.prerequisites).toEqual([PR.HUB_NECRALISK, PR.WAR_WITHIN]);
        expect(byId.get(PR.SYNDICATE_NECRALOID_RANK2)?.prerequisites).toEqual([PR.SYNDICATE_NECRALOID_RANK1]);
        expect(byId.get(PR.SYNDICATE_NECRALOID_RANK3)?.prerequisites).toEqual([PR.SYNDICATE_NECRALOID_RANK2]);
        expect(byId.get(PR.SYNDICATE_HEX_RANK5)?.prerequisites).toEqual([PR.SYNDICATE_HEX_RANK4]);
    });

    it("keeps direct gates separate from their transitively implied progression", () => {
        const byId = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        expect(byId.get(PR.JUNCTION_NEPTUNE_PLUTO)?.prerequisites).toEqual([PR.SECOND_DREAM]);
        expect(byId.get(PR.JUNCTION_PLUTO_SEDNA)?.prerequisites).toEqual([PR.WAR_WITHIN, PR.SYSTEM_ERIS_FOCUS_LENS]);
        expect(byId.get(PR.ACTIVITY_STEEL_PATH_HONORS)?.prerequisites).toEqual([PR.ACTIVITY_STEEL_PATH]);
        expect(byId.get(PR.ACTIVITY_ROPALOLYST)?.prerequisites).toEqual([PR.CHIMERA_PROLOGUE]);
        expect(byId.get(PR.ACTIVITY_FABLES_FRONTIERS)?.prerequisites).toEqual([
            PR.THE_HEX,
            PR.THE_HEX_FINALE,
            PR.SYNDICATE_HEX_RANK5,
            PR.SYSTEM_AMIR_CLOSE,
        ]);
    });

    it("has no redundant direct AND edges unless the game explicitly checks both flags", () => {
        const byId = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        const memo = new Map<string, Set<string>>();

        function mandatoryClosure(id: string, active = new Set<string>()): Set<string> {
            const cached = memo.get(id);
            if (cached) return cached;
            if (active.has(id)) return new Set([id]);
            active.add(id);
            const def = byId.get(id);
            const result = new Set<string>([id]);
            if (def) {
                const conditionParents = (def.conditions ?? []).flatMap((condition) =>
                    condition.type === "quest_complete" ? [condition.prereqId]
                        : condition.type === "junction_complete" ? [condition.junctionId]
                            : [],
                );
                for (const parent of [...def.prerequisites, ...conditionParents]) {
                    for (const ancestor of mandatoryClosure(parent, active)) result.add(ancestor);
                }
                const options = def.anyPrerequisites ?? [];
                if (options.length) {
                    const optionClosures = options.map((parent) => mandatoryClosure(parent, active));
                    for (const ancestor of optionClosures[0]) {
                        if (optionClosures.every((option) => option.has(ancestor))) result.add(ancestor);
                    }
                }
            }
            active.delete(id);
            memo.set(id, result);
            return result;
        }

        const redundant: string[] = [];
        for (const def of PREREQ_REGISTRY) {
            const conditionParents = (def.conditions ?? []).flatMap((condition) =>
                condition.type === "quest_complete" ? [condition.prereqId]
                    : condition.type === "junction_complete" ? [condition.junctionId]
                        : [],
            );
            const andParents = [...def.prerequisites, ...conditionParents];
            for (const directParent of andParents) {
                if (andParents.some((other) => other !== directParent && mandatoryClosure(other).has(directParent))) {
                    redundant.push(`${def.id} -> ${directParent}`);
                }
            }
        }

        expect(redundant.sort()).toEqual([
            `${PR.WHISPERS_WALL} -> ${PR.HEART_OF_DEIMOS}`,
            `${PR.SECOND_DREAM} -> ${PR.NATAH}`,
            `${PR.WAR_WITHIN} -> ${PR.SECOND_DREAM}`,
            `${PR.PATIENT_ZERO} -> ${PR.ONCE_AWAKE}`,
            `${PR.ACTIVITY_DEEP_ARCHIMEDEA} -> ${PR.WHISPERS_WALL}`,
            `${PR.ACTIVITY_TEMPORAL_ARCHIMEDEA} -> ${PR.THE_HEX}`,
            `${PR.ACTIVITY_SISTER_PARVOS} -> ${PR.WAR_WITHIN}`,
            `${PR.SAYA_VIGIL} -> ${PR.VORS_PRIZE}`,
            `${PR.VOX_SOLARIS} -> ${PR.THE_TEACHER}`,
            `${PR.ACTIVITY_FABLES_FRONTIERS} -> ${PR.THE_HEX}`,
            `${PR.ACTIVITY_FABLES_FRONTIERS} -> ${PR.THE_HEX_FINALE}`,
            `${PR.SYNDICATE_VOX_RANK1} -> ${PR.VOX_SOLARIS}`,
        ].sort());
    });

    it("uses separate open-world and Railjack deployment requirements for Necramechs", () => {
        const byId = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        const openWorld = byId.get(PR.NECRAMECH_UNLOCKED)!;
        const railjack = byId.get(PR.NECRAMECH_RAILJACK_DEPLOYMENT)!;
        expect(openWorld.prerequisites).toEqual([PR.WAR_WITHIN]);
        expect(openWorld.anyPrerequisites).toEqual([PR.NECRAMECH_VOIDRIG, PR.NECRAMECH_BONEWIDOW, PR.NECRAMECH_MARKET]);
        expect(openWorld.conditions).toBeUndefined();
        expect(railjack.prerequisites).toEqual([PR.NECRAMECH_UNLOCKED, PR.SYSTEM_PROXIMA_ACCESS]);
        expect(railjack.conditions).toContainEqual({ type: "railjack_intrinsic_rank", rank: 5, skillId: "LPS_TACTICAL" });
    });

    it("tracks the shared dynamic Adversary slot for Lich, Sister, and Coda creation", () => {
        const cases = [
            { id: PR.ACTIVITY_KUVA_LICH, prerequisites: [PR.WAR_WITHIN, PR.SYSTEM_ADVERSARY_SLOT_CLEAR], anyPrerequisites: [PR.RAILJACK_CONSTRUCTED, PR.RAILJACK_MARKET_ACQUIRED] },
            { id: PR.ACTIVITY_SISTER_PARVOS, prerequisites: [PR.WAR_WITHIN, PR.CALL_TEMPESTARII], anyPrerequisites: [] },
            { id: PR.ACTIVITY_TECHNOCYTE_CODA, prerequisites: [PR.THE_HEX], anyPrerequisites: [] },
        ];

        for (const entry of cases) {
            const progress = Object.fromEntries([...entry.prerequisites, ...entry.anyPrerequisites, PR.SYSTEM_ADVERSARY_SLOT_CLEAR].map((id) => [id, true]));
            const ready = computeUnlockGraphSnapshot(progress, undefined, { masteryRank: 5 }).byId[entry.id];
            expect(ready.unlocked, entry.id).toBe(true);

            const occupiedSlot = { ...progress, [PR.SYSTEM_ADVERSARY_SLOT_CLEAR]: false };
            const locked = computeUnlockGraphSnapshot(occupiedSlot, undefined, { masteryRank: 5 }).byId[entry.id];
            expect(locked.unlocked, entry.id).toBe(false);
            expect(locked.missing, entry.id).toContain(PR.SYSTEM_ADVERSARY_SLOT_CLEAR);
        }

        expect(PREREQ_REGISTRY.find((def) => def.id === PR.ACTIVITY_KUVA_LICH)?.anyPrerequisites)
            .toEqual([PR.RAILJACK_CONSTRUCTED, PR.RAILJACK_MARKET_ACQUIRED]);

        const purchasedRailjack = computeUnlockGraphSnapshot({
            [PR.WAR_WITHIN]: true,
            [PR.RAILJACK_MARKET_ACQUIRED]: true,
            [PR.SYSTEM_ADVERSARY_SLOT_CLEAR]: true,
        }, undefined, { masteryRank: 5 }).byId[PR.ACTIVITY_KUVA_LICH];
        expect(purchasedRailjack.unlocked).toBe(true);
    });

    it("tracks the actual Kavat segment and mature Helminth cyst requirements", () => {
        const byId = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
        expect(byId.get(PR.SEGMENT_KAVAT_UPGRADE)?.prerequisites).toEqual([PR.SEGMENT_INCUBATOR]);
        expect(byId.get(PR.COMPANION_KAVAT)?.prerequisites).toEqual([PR.SEGMENT_KAVAT_UPGRADE]);
        expect(byId.get(PR.COMPANION_HELMINTH_CHARGER)?.prerequisites).toEqual([PR.SEGMENT_INCUBATOR, PR.COMPANION_MATURE_CYST]);
        expect(byId.get(PR.COMPANION_HELMINTH_CHARGER)?.prerequisites).not.toContain(PR.SEGMENT_HELMINTH);
    });
});
