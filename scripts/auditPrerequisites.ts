import { PREREQ_REGISTRY } from "../src/catalog/prereqs/prereqRegistry";
import { MILESTONE_REGISTRY } from "../src/catalog/prereqs/milestoneRegistry";
import { SOURCE_INDEX } from "../src/catalog/sources/sourceCatalog";
import { STAR_CHART_DATA } from "../src/domain/catalog/starChart";
import { PR } from "../src/domain/ids/prereqIds";
import { SY } from "../src/domain/ids/syndicateIds";

const ids = PREREQ_REGISTRY.map((def) => def.id);
const idSet = new Set(ids);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
const duplicateMilestoneIds = MILESTONE_REGISTRY
    .map((milestone) => milestone.id)
    .filter((id, i, all) => all.indexOf(id) !== i);
const duplicateLabels = [...new Set(PREREQ_REGISTRY
    .map((def) => def.label.trim().toLowerCase())
    .filter((label, i, all) => all.indexOf(label) !== i))];
const dependents = new Map<string, string[]>();
const missingRefs: string[] = [];
const selfReferences: string[] = [];
const duplicateEdges: string[] = [];
const conditionMissingRefs: string[] = [];
const chartNodeIds = new Set(STAR_CHART_DATA.nodes.map((node) => node.id));
const chartPlanetIds = new Set(STAR_CHART_DATA.planets.map((planet) => planet.id));
const syndicateIds = new Set(Object.values(SY));

for (const def of PREREQ_REGISTRY) {
    const conditionParents = (def.conditions ?? []).flatMap((condition) =>
        condition.type === "quest_complete" ? [condition.prereqId]
            : condition.type === "junction_complete" ? [condition.junctionId]
                : [],
    );
    const requiredAndAny = [...def.prerequisites, ...(def.anyPrerequisites ?? []), ...conditionParents];
    if (new Set(requiredAndAny).size !== requiredAndAny.length) {
        duplicateEdges.push(def.id);
    }
    for (const id of requiredAndAny) {
        if (id === def.id) selfReferences.push(def.id);
        if (!idSet.has(id)) missingRefs.push(`${def.id} -> ${id}`);
        const list = dependents.get(id) ?? [];
        list.push(def.id);
        dependents.set(id, list);
    }
    for (const condition of def.conditions ?? []) {
        if (condition.type === "mastery_rank" && (!Number.isInteger(condition.value) || condition.value < 0)) {
            conditionMissingRefs.push(`${def.id} -> invalid mastery rank ${condition.value}`);
        }
        if (condition.type === "quest_complete" && !idSet.has(condition.prereqId)) {
            conditionMissingRefs.push(`${def.id} -> quest ${condition.prereqId}`);
        } else if (condition.type === "quest_complete") {
            const list = dependents.get(condition.prereqId) ?? [];
            list.push(def.id);
            dependents.set(condition.prereqId, list);
        }
        if (condition.type === "junction_complete" && !idSet.has(condition.junctionId)) {
            conditionMissingRefs.push(`${def.id} -> junction ${condition.junctionId}`);
        } else if (condition.type === "junction_complete") {
            const list = dependents.get(condition.junctionId) ?? [];
            list.push(def.id);
            dependents.set(condition.junctionId, list);
        }
        if (condition.type === "node_complete" && !chartNodeIds.has(condition.nodeId)) {
            conditionMissingRefs.push(`${def.id} -> node ${condition.nodeId}`);
        }
        if (condition.type === "planet_unlock" && !chartPlanetIds.has(condition.planetId)) {
            conditionMissingRefs.push(`${def.id} -> planet ${condition.planetId}`);
        }
        if (condition.type === "syndicate_rank" && !syndicateIds.has(condition.syndicateId)) {
            conditionMissingRefs.push(`${def.id} -> syndicate ${condition.syndicateId}`);
        }
        if (condition.type === "syndicate_rank" && (!Number.isInteger(condition.rank) || condition.rank < 0)) {
            conditionMissingRefs.push(`${def.id} -> invalid syndicate rank ${condition.rank}`);
        }
        if (condition.type === "resource_owned" && (!Number.isFinite(condition.quantity) || condition.quantity <= 0)) {
            conditionMissingRefs.push(`${def.id} -> invalid resource quantity ${condition.quantity}`);
        }
        if (condition.type === "railjack_intrinsic_rank" && (
            !Number.isInteger(condition.rank)
            || condition.rank < 1
            || condition.rank > 10
            || (condition.skillId !== undefined && !["LPS_COMMAND", "LPS_ENGINEERING", "LPS_GUNNERY", "LPS_PILOTING", "LPS_TACTICAL"].includes(condition.skillId))
        )) {
            conditionMissingRefs.push(`${def.id} -> invalid Railjack Intrinsic condition ${condition.skillId ?? "any"} rank ${condition.rank}`);
        }
        if (condition.type === "availability_window" && (
            !/^\d{4}-\d{2}-\d{2}$/.test(condition.startsOn)
            || !/^\d{4}-\d{2}-\d{2}$/.test(condition.endsOn)
            || condition.startsOn > condition.endsOn
            || Number.isNaN(Date.parse(`${condition.startsOn}T00:00:00Z`))
            || Number.isNaN(Date.parse(`${condition.endsOn}T00:00:00Z`))
        )) {
            conditionMissingRefs.push(`${def.id} -> invalid availability window ${condition.startsOn} through ${condition.endsOn}`);
        }
    }
}

const cyclicComponents: string[][] = [];
const visiting = new Set<string>();
const visited = new Set<string>();
const stack: string[] = [];
function visit(id: string) {
    if (visiting.has(id)) {
        const start = stack.indexOf(id);
        const cycle = [...stack.slice(start), id];
        if (!cyclicComponents.some((existing) => existing.join("|") === cycle.join("|"))) {
            cyclicComponents.push(cycle);
        }
        return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    const def = PREREQ_REGISTRY.find((candidate) => candidate.id === id);
    const conditionParents = (def?.conditions ?? []).flatMap((condition) =>
        condition.type === "quest_complete" ? [condition.prereqId]
            : condition.type === "junction_complete" ? [condition.junctionId]
                : [],
    );
    for (const parent of [...(def?.prerequisites ?? []), ...(def?.anyPrerequisites ?? []), ...conditionParents]) {
        if (idSet.has(parent)) visit(parent);
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
}
for (const id of ids) visit(id);

// Find hard AND edges already guaranteed by another direct requirement. OR
// branches contribute only ancestors common to every option, so a single
// alternative cannot incorrectly make a separate edge appear redundant.
const registryById = new Map(PREREQ_REGISTRY.map((def) => [def.id, def]));
const mandatoryClosureCache = new Map<string, Set<string>>();
function mandatoryClosure(id: string, active = new Set<string>()): Set<string> {
    const cached = mandatoryClosureCache.get(id);
    if (cached) return cached;
    if (active.has(id)) return new Set([id]);
    active.add(id);
    const def = registryById.get(id);
    const closure = new Set<string>([id]);
    if (def) {
        const conditionParents = (def.conditions ?? []).flatMap((condition) =>
            condition.type === "quest_complete" ? [condition.prereqId]
                : condition.type === "junction_complete" ? [condition.junctionId]
                    : [],
        );
        for (const parent of [...def.prerequisites, ...conditionParents]) {
            for (const ancestor of mandatoryClosure(parent, active)) closure.add(ancestor);
        }
        const alternatives = def.anyPrerequisites ?? [];
        if (alternatives.length) {
            const alternativeClosures = alternatives.map((parent) => mandatoryClosure(parent, active));
            for (const ancestor of alternativeClosures[0]) {
                if (alternativeClosures.every((candidate) => candidate.has(ancestor))) closure.add(ancestor);
            }
        }
    }
    active.delete(id);
    mandatoryClosureCache.set(id, closure);
    return closure;
}
const redundantEdges: string[] = [];
for (const def of PREREQ_REGISTRY) {
    const conditionParents = (def.conditions ?? []).flatMap((condition) =>
        condition.type === "quest_complete" ? [condition.prereqId]
            : condition.type === "junction_complete" ? [condition.junctionId]
                : [],
    );
    const andParents = [...def.prerequisites, ...conditionParents];
    for (const parent of andParents) {
        if (andParents.some((other) => other !== parent && mandatoryClosure(other).has(parent))) {
            redundantEdges.push(`${def.id} -> ${parent}`);
        }
    }
}
// The live game explicitly checks both sides of these requirements even though
// one is implied by the other in the progression graph.
const explicitlyRequiredRedundancies = new Set([
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
]);
const unapprovedRedundantEdges = redundantEdges.filter((edge) => !explicitlyRequiredRedundancies.has(edge));

const sourceMissingRefs = Object.entries(SOURCE_INDEX).flatMap(([sourceId, source]) =>
    (source.prereqIds ?? [])
        .filter((id) => !idSet.has(id))
        .map((id) => `${sourceId} -> ${id}`),
);
const milestoneMissingRefs = MILESTONE_REGISTRY.flatMap((milestone) =>
    milestone.rule.prereqIds
        .filter((id) => !idSet.has(id))
        .map((id) => `${milestone.id} -> ${id}`),
);
const junctionIssues = STAR_CHART_DATA.nodes
    .filter((node) => node.nodeType === "junction")
    .flatMap((node) => {
        const id = node.id.replace(/^node:/, "");
        const def = PREREQ_REGISTRY.find((candidate) => candidate.id === id);
        if (!def) return [`${node.id}: no matching prerequisite definition`];
        return node.prereqIds === undefined ? [] : [`${node.id}: duplicated prerequisites remain on the Star Chart node`];
    });
for (const def of PREREQ_REGISTRY.filter((candidate) => candidate.label.startsWith("Junction:"))) {
    if (!chartNodeIds.has(`node:${def.id}`)) junctionIssues.push(`${def.id}: no matching Star Chart junction node`);
}
const chartNodeList = STAR_CHART_DATA.nodes.map((node) => node.id);
const duplicateChartNodeIds = chartNodeList.filter((id, i) => chartNodeList.indexOf(id) !== i);
const chartReferenceIssues = STAR_CHART_DATA.nodes.flatMap((node) => [
    ...(!chartPlanetIds.has(node.planetId) ? [`${node.id}: unknown planet ${node.planetId}`] : []),
    ...(node.unlocksPlanetId && !chartPlanetIds.has(node.unlocksPlanetId) ? [`${node.id}: unknown unlock destination ${node.unlocksPlanetId}`] : []),
    ...node.edges.filter((id) => !chartNodeIds.has(id)).map((id) => `${node.id}: unknown chart edge ${id}`),
]);

const byCategory = new Map<string, number>();
for (const def of PREREQ_REGISTRY) byCategory.set(def.category, (byCategory.get(def.category) ?? 0) + 1);
const roots = PREREQ_REGISTRY.filter((def) => def.prerequisites.length === 0 && !(def.anyPrerequisites?.length) && !(def.conditions?.length));
const entriesWithoutEvidence = PREREQ_REGISTRY.filter((def) => !def.evidence?.length).map((def) => def.id);
const rowsWithRelease = PREREQ_REGISTRY.filter((def) => !!def.introducedIn);
const introducedAfterUpdate41 = rowsWithRelease.filter((def) => {
    const match = def.introducedIn?.match(/Update\s+(\d+)/i);
    return !!match && Number(match[1]) > 41;
});
const postCutoffByCategory = new Map<string, number>();
for (const def of introducedAfterUpdate41) postCutoffByCategory.set(def.category, (postCutoffByCategory.get(def.category) ?? 0) + 1);
const gatedEntriesWithoutEvidence = PREREQ_REGISTRY
    .filter((def) => (def.prerequisites.length > 0 || (def.anyPrerequisites?.length ?? 0) > 0 || (def.conditions?.length ?? 0) > 0) && !def.evidence?.length)
    .map((def) => def.id);
const gatedEntriesWithoutCurrentEvidence = PREREQ_REGISTRY
    .filter((def) => (def.prerequisites.length > 0 || (def.anyPrerequisites?.length ?? 0) > 0 || (def.conditions?.length ?? 0) > 0)
        && !def.evidence?.some((entry) => entry.classification === "required" || entry.classification === "conditional"))
    .map((def) => def.id);
const referencesWithoutEvidence = gatedEntriesWithoutEvidence.reduce((count, id) => {
    const def = PREREQ_REGISTRY.find((entry) => entry.id === id)!;
    return count + def.prerequisites.length + (def.anyPrerequisites?.length ?? 0) + (def.conditions?.length ?? 0);
}, 0);
const invalidEvidence = PREREQ_REGISTRY.flatMap((def) => (def.evidence ?? []).flatMap((entry, index) => {
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(entry.verifiedOn)
        && !Number.isNaN(Date.parse(`${entry.verifiedOn}T00:00:00Z`));
    return [
        ...(!/^https:\/\//.test(entry.url) ? [`${def.id} evidence ${index + 1}: URL must be HTTPS`] : []),
        ...(!validDate ? [`${def.id} evidence ${index + 1}: invalid verification date ${entry.verifiedOn}`] : []),
        ...(!entry.note.trim() ? [`${def.id} evidence ${index + 1}: note is empty`] : []),
        ...(!["required", "conditional", "recommended", "historical"].includes(entry.classification)
            ? [`${def.id} evidence ${index + 1}: invalid classification ${entry.classification}`]
            : []),
        ...(/direct gate tracked for|generic progression entry/i.test(entry.note)
            ? [`${def.id} evidence ${index + 1}: generic note is not acceptable provenance`]
            : []),
    ];
}));

const lines = [
    "# Prerequisite Registry Inventory",
    "",
    "Generated from `PREREQ_REGISTRY`, `MILESTONE_REGISTRY`, `SOURCE_INDEX`, and `STAR_CHART_DATA` by `npm run audit:prerequisites`.",
    "",
    `- Registry entries: ${PREREQ_REGISTRY.length}`,
    `- Direct required edges: ${PREREQ_REGISTRY.reduce((n, def) => n + def.prerequisites.length, 0)}`,
    `- Alternative prerequisite references: ${PREREQ_REGISTRY.reduce((n, def) => n + (def.anyPrerequisites?.length ?? 0), 0)}`,
    `- Milestone rollups: ${MILESTONE_REGISTRY.length}`,
    `- Source catalog entries: ${Object.keys(SOURCE_INDEX).length}`,
    `- Star Chart nodes: ${STAR_CHART_DATA.nodes.length}`,
    `- Star Chart junctions: ${STAR_CHART_DATA.nodes.filter((node) => node.nodeType === "junction").length}`,
    `- Prerequisite categories: ${[...byCategory.entries()].map(([category, count]) => `${category} ${count}`).join("; ")}`,
    `- Root entries: ${roots.map((def) => def.id).join(", ") || "none"}`,
    `- Entries with release metadata: ${rowsWithRelease.length}`,
    `- Entries introduced after the Update 41 baseline: ${introducedAfterUpdate41.length}${introducedAfterUpdate41.length ? ` (${[...postCutoffByCategory.entries()].map(([category, count]) => `${category} ${count}`).join("; ")})` : ""}`,
    `- Duplicate IDs: ${duplicates.length ? duplicates.join(", ") : "none"}`,
    `- Duplicate milestone IDs: ${duplicateMilestoneIds.length ? duplicateMilestoneIds.join(", ") : "none"}`,
    `- Duplicate canonical labels: ${duplicateLabels.length ? duplicateLabels.join(", ") : "none"}`,
    `- Self-references: ${selfReferences.length ? selfReferences.join(", ") : "none"}`,
    `- Duplicate direct relationships: ${duplicateEdges.length ? duplicateEdges.join(", ") : "none"}`,
    `- Unresolved prerequisite references: ${missingRefs.length ? missingRefs.join("; ") : "none"}`,
    `- Unresolved source-catalog references: ${sourceMissingRefs.length ? sourceMissingRefs.join("; ") : "none"}`,
    `- Unresolved milestone references: ${milestoneMissingRefs.length ? milestoneMissingRefs.join("; ") : "none"}`,
    `- Invalid condition references or values: ${conditionMissingRefs.length ? conditionMissingRefs.join("; ") : "none"}`,
    `- Dependency cycles: ${cyclicComponents.length ? cyclicComponents.map((cycle) => cycle.join(" → ")).join("; ") : "none"}`,
    `- Redundant direct prerequisite edges: ${unapprovedRedundantEdges.length ? unapprovedRedundantEdges.join("; ") : "none"}`,
    `- Explicit game-checked redundant pairs retained: ${[...explicitlyRequiredRedundancies].filter((edge) => redundantEdges.includes(edge)).join("; ") || "none"}`,
    `- Junction definitions missing or duplicated on chart nodes: ${junctionIssues.length ? junctionIssues.join("; ") : "none"}`,
    `- Duplicate Star Chart node IDs: ${duplicateChartNodeIds.length ? duplicateChartNodeIds.join(", ") : "none"}`,
    `- Invalid Star Chart planet/node relationships: ${chartReferenceIssues.length ? chartReferenceIssues.join("; ") : "none"}`,
    `- Entries without per-entry evidence metadata: ${entriesWithoutEvidence.length}`,
    `- Gated entries without per-entry evidence: ${gatedEntriesWithoutEvidence.length}`,
    `- Gated entries without current required/conditional evidence: ${gatedEntriesWithoutCurrentEvidence.length ? gatedEntriesWithoutCurrentEvidence.join(", ") : "none"}`,
    `- Direct relationships / conditions on entries without evidence: ${referencesWithoutEvidence}`,
    `- Invalid evidence records: ${invalidEvidence.length ? invalidEvidence.join("; ") : "none"}`,
    "",
    "## Tracked Entries",
    "",
    "| Identifier | Name | Category | Required (AND) | Alternative (OR) | Typed conditions (AND) | Direct dependents | Completion source | Evidence / release metadata |",
    "|---|---|---|---|---|---|---|---|---|",
];

for (const def of PREREQ_REGISTRY) {
    const completion = def.validatedBySyndicate
        ? `syndicate ${def.validatedBySyndicate.syndicateId} rank ${def.validatedBySyndicate.rank}`
        : def.validatedByAnySyndicate
            ? `any syndicate rank ${def.validatedByAnySyndicate.rank}`
            : typeof def.validatedByMasteryRank === "number"
                ? `mastery rank ${def.validatedByMasteryRank}`
                : def.label.startsWith("Junction:")
                    ? "derived from matching Star Chart junction node"
                : ["deimos_access", "junction_earth_lua", "kuva_fortress_access", "system_eris_focus_lens"].includes(def.id)
                    ? "derived from Star Chart or quest progression"
                : def.id === "activity_steel_path" || def.id === "activity_nightmare_missions"
                    ? "derived from Star Chart node completion"
                    : "manual `state.prereqs.completed` checkbox";
    const evidence = [
        ...(def.evidence ?? []).map((entry) => `[${entry.kind}](${entry.url})`),
        def.introducedIn ? `introduced ${def.introducedIn}` : "release not tagged",
    ].join("; ");
    const conditions = (def.conditions ?? []).map((condition) => {
        switch (condition.type) {
            case "mastery_rank": return `Mastery Rank ${condition.value}`;
            case "quest_complete": return `Quest complete: ${PREREQ_REGISTRY.find((entry) => entry.id === condition.prereqId)?.label ?? condition.prereqId}`;
            case "junction_complete": return `Junction complete: ${PREREQ_REGISTRY.find((entry) => entry.id === condition.junctionId)?.label ?? condition.junctionId}`;
            case "node_complete": return `Complete ${condition.label ?? condition.nodeId}`;
            case "planet_unlock": return `Planet unlocked: ${condition.planetId}`;
            case "syndicate_rank": return `Syndicate ${condition.syndicateId} rank ${condition.rank}`;
            case "item_owned": return `Item owned: ${condition.catalogId}`;
            case "resource_owned": return `${condition.quantity}× ${condition.catalogId}`;
            case "star_chart_access": return condition.activity === "steel_path"
                ? "Steel Path Star Chart node set complete"
                : "Nightmare eligible planet node set complete";
            case "railjack_intrinsic_rank": return `${condition.skillId ?? "Any Railjack Intrinsic"} Rank ${condition.rank}`;
            case "availability_window": return `Available ${condition.startsOn} through ${condition.endsOn}`;
        }
    }).join(" AND ") || "—";
    const escapeCell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
    lines.push(`| \`${escapeCell(def.id)}\` | ${escapeCell(def.label)} | ${def.category} | ${escapeCell(def.prerequisites.map((id) => PREREQ_REGISTRY.find((entry) => entry.id === id)?.label ?? id).join(", ") || "—")} | ${escapeCell((def.anyPrerequisites ?? []).map((id) => PREREQ_REGISTRY.find((entry) => entry.id === id)?.label ?? id).join(" OR ") || "—")} | ${escapeCell(conditions)} | ${escapeCell((dependents.get(def.id) ?? []).map((id) => PREREQ_REGISTRY.find((entry) => entry.id === id)?.label ?? id).sort().join(", ") || "—")} | ${escapeCell(completion)} | ${escapeCell(evidence)} |`);
}

console.log(lines.join("\n"));

if (duplicates.length || duplicateMilestoneIds.length || duplicateLabels.length || selfReferences.length || duplicateEdges.length || missingRefs.length || sourceMissingRefs.length || milestoneMissingRefs.length || conditionMissingRefs.length || cyclicComponents.length || unapprovedRedundantEdges.length || junctionIssues.length || duplicateChartNodeIds.length || chartReferenceIssues.length || entriesWithoutEvidence.length || gatedEntriesWithoutEvidence.length || gatedEntriesWithoutCurrentEvidence.length || invalidEvidence.length) {
    process.exitCode = 1;
}
