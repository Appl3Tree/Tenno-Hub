// ===== FILE: src/domain/logic/startupValidation.ts =====
// src/domain/logic/startupValidation.ts

import { SOURCE_CATALOG } from "../../catalog/sources/sourceCatalog";
import { PREREQ_REGISTRY } from "../../catalog/prereqs/prereqRegistry";

type ValidationIssueSeverity = "error" | "warning";

type ValidationIssueCode =
    | "SOURCE_ID_INVALID"
    | "SOURCE_ID_DUPLICATE"
    | "SOURCE_ID_LEGACY_NAMESPACE"
    | "SOURCE_LABEL_INVALID"
    | "STAR_CHART_EMPTY"
    | "STAR_CHART_PLANET_INVALID"
    | "STAR_CHART_NODE_INVALID"
    | "STAR_CHART_NODE_EDGE_INVALID"
    | "STAR_CHART_JUNCTION_NODE_INVALID";

type ValidationIssue = {
    code: ValidationIssueCode;
    severity: ValidationIssueSeverity;
    message: string;
};

function issue(
    code: ValidationIssueCode,
    severity: ValidationIssueSeverity,
    message: string
): ValidationIssue {
    return { code, severity, message };
}

function isNonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0;
}

function isSrcSourceId(id: string): boolean {
    return id.startsWith("src:");
}

function isDataDerivedSourceId(id: string): boolean {
    return id.startsWith("data:");
}

/**
 * Legacy namespace prefixes that pre-date the data:/src: convention.
 * These should not appear in SOURCE_CATALOG going forward; any that do
 * should be migrated to data: or src: in a subsequent pass.
 */
const LEGACY_SOURCE_NAMESPACES = [
    "system:",
    "node:",
    "vendor:",
    "quest:",
    "syndicate:",
    "faction:",
    "market:",
    "clan:",
    "event:",
    "relic:",
    "bounty:",
    "transient:",
    "activity:",
    "enemy:",
];

function isLegacyNamespace(id: string): boolean {
    return LEGACY_SOURCE_NAMESPACES.some((ns) => id === ns.slice(0, -1) || id.startsWith(ns));
}

function isValidSourceIdFormat(id: string): boolean {
    if (!isNonEmptyString(id)) return false;
    if (id.includes(" ")) return false;
    if (id.startsWith("/")) return false;
    if (!id.includes(":")) return false;
    if (id.includes("\\") || id.includes("//")) return false;
    return true;
}

function validateSources(issues: ValidationIssue[]): void {
    if (!Array.isArray(SOURCE_CATALOG) || SOURCE_CATALOG.length === 0) {
        issues.push(issue("SOURCE_LABEL_INVALID", "error", "SOURCE_CATALOG is empty or not an array."));
    }

    const seen = new Set<string>();

    for (const s of SOURCE_CATALOG ?? []) {
        const id = String((s as any)?.id ?? "").trim();
        const label = String((s as any)?.label ?? "").trim();

        if (!id) {
            issues.push(issue("SOURCE_ID_INVALID", "error", "Source has missing id."));
            continue;
        }

        if (!label) {
            issues.push(issue("SOURCE_LABEL_INVALID", "error", `Source (${id}) has missing label.`));
        }

        if (seen.has(id)) {
            issues.push(issue("SOURCE_ID_DUPLICATE", "error", `Duplicate source id: ${id}`));
        } else {
            seen.add(id);
        }

        if (!isValidSourceIdFormat(id)) {
            issues.push(issue("SOURCE_ID_INVALID", "error", `Source has invalid id format: ${id}`));
            continue;
        }

        if (isSrcSourceId(id)) continue;
        if (isDataDerivedSourceId(id)) continue;

        if (isLegacyNamespace(id)) {
            // Legacy IDs predate the data:/src: convention. They are accepted for now
            // but should be migrated. Each occurrence here is a defect to track.
            issues.push(
                issue(
                    "SOURCE_ID_LEGACY_NAMESPACE",
                    "warning",
                    `Source uses a legacy namespace that should be migrated to data: or src:. id="${id}"`
                )
            );
            continue;
        }

        issues.push(issue("SOURCE_ID_INVALID", "error", `Source has unknown namespace: ${id}`));
    }
}

async function validateStarChart(issues: ValidationIssue[]): Promise<void> {
    const { STAR_CHART_DATA } = await import("../catalog/starChart");
    const data = STAR_CHART_DATA;

    if (!data || !Array.isArray(data.planets) || !Array.isArray(data.nodes) || data.planets.length === 0 || data.nodes.length === 0) {
        issues.push(issue("STAR_CHART_EMPTY", "error", "STAR_CHART_DATA is missing or empty (planets/nodes required)."));
        return;
    }

    const planetIds = new Set<string>();
    const nodeIds = new Set<string>();

    for (const p of data.planets) {
        const id = String((p as any)?.id ?? "").trim();
        const name = String((p as any)?.name ?? "").trim();
        const kind = String((p as any)?.kind ?? "").trim();
        const sortOrder = (p as any)?.sortOrder;

        if (!id || id.includes(" ")) {
            issues.push(issue("STAR_CHART_PLANET_INVALID", "error", `Planet has invalid id: ${id || "(missing)"}`));
            continue;
        }

        if (!name) {
            issues.push(issue("STAR_CHART_PLANET_INVALID", "error", `Planet (${id}) has missing name.`));
        }

        if (kind !== "planet" && kind !== "hub" && kind !== "region") {
            issues.push(issue("STAR_CHART_PLANET_INVALID", "error", `Planet (${id}) has invalid kind: ${kind}`));
        }

        if (typeof sortOrder !== "number" || !Number.isFinite(sortOrder)) {
            issues.push(issue("STAR_CHART_PLANET_INVALID", "error", `Planet (${id}) has invalid sortOrder.`));
        }

        if (planetIds.has(id)) {
            issues.push(issue("STAR_CHART_PLANET_INVALID", "error", `Duplicate planet id: ${id}`));
        } else {
            planetIds.add(id);
        }
    }

    for (const n of data.nodes) {
        const id = String((n as any)?.id ?? "").trim();
        const planetId = String((n as any)?.planetId ?? "").trim();
        const name = String((n as any)?.name ?? "").trim();
        const nodeType = String((n as any)?.nodeType ?? "").trim();
        const edges = (n as any)?.edges;

        if (!id || id.includes(" ")) {
            issues.push(issue("STAR_CHART_NODE_INVALID", "error", `Node has invalid id: ${id || "(missing)"}`));
            continue;
        }

        if (!planetId || !planetIds.has(planetId)) {
            issues.push(issue("STAR_CHART_NODE_INVALID", "error", `Node (${id}) references unknown planetId: ${planetId}`));
        }

        if (!name) {
            issues.push(issue("STAR_CHART_NODE_INVALID", "error", `Node (${id}) has missing name.`));
        }

        const VALID_NODE_TYPES = new Set(["mission", "boss", "quest", "hub", "junction", "special"]);
        if (!VALID_NODE_TYPES.has(nodeType)) {
            issues.push(issue("STAR_CHART_NODE_INVALID", "error", `Node (${id}) has invalid nodeType: ${nodeType}`));
        }

        if (!Array.isArray(edges)) {
            issues.push(issue("STAR_CHART_NODE_INVALID", "error", `Node (${id}) has non-array edges.`));
        }

        if (nodeIds.has(id)) {
            issues.push(issue("STAR_CHART_NODE_INVALID", "error", `Duplicate node id: ${id}`));
        } else {
            nodeIds.add(id);
        }
    }

    // Edge validation: broken edge references are warnings (data defects, not structural failures).
    for (const n of data.nodes) {
        const id = String((n as any)?.id ?? "").trim();
        const edges = (n as any)?.edges;

        if (!Array.isArray(edges)) continue;

        for (const e of edges) {
            const edgeId = String(e ?? "").trim();
            if (!edgeId) continue;

            if (!nodeIds.has(edgeId)) {
                issues.push(
                    issue(
                        "STAR_CHART_NODE_EDGE_INVALID",
                        "warning",
                        `Node (${id}) has edge to unknown nodeId: ${edgeId}`
                    )
                );
            }
        }
    }

    // Junction-as-node validation
    for (const n of data.nodes) {
        const id = String((n as any)?.id ?? "").trim();
        const nodeType = String((n as any)?.nodeType ?? "").trim();

        if (nodeType !== "junction") continue;

        const unlocksPlanetId = String((n as any)?.unlocksPlanetId ?? "").trim();
        const prereqId = id.replace(/^node:/, "");
        const prereqDef = PREREQ_REGISTRY.find((def) => def.id === prereqId);

        if (!unlocksPlanetId || !planetIds.has(unlocksPlanetId)) {
            issues.push(
                issue(
                    "STAR_CHART_JUNCTION_NODE_INVALID",
                    "error",
                    `Junction node (${id}) has invalid unlocksPlanetId: ${unlocksPlanetId || "(missing)"}`
                )
            );
        }

        if (!prereqDef) {
            issues.push(
                issue(
                    "STAR_CHART_JUNCTION_NODE_INVALID",
                    "error",
                    `Junction node (${id}) has no matching prerequisite registry entry (${prereqId}).`
                )
            );
        } else {
            const registryIds = new Set(PREREQ_REGISTRY.map((def) => def.id));
            const refs = [...prereqDef.prerequisites, ...(prereqDef.anyPrerequisites ?? [])];
            for (const ref of refs) {
                if (!registryIds.has(ref)) {
                    issues.push(
                        issue(
                            "STAR_CHART_JUNCTION_NODE_INVALID",
                            "error",
                            `Junction node (${id}) references an unknown prerequisite (${ref}) in PREREQ_REGISTRY.`
                        )
                    );
                }
            }
        }

        if ((n as any)?.prereqIds !== undefined) {
            issues.push(issue(
                "STAR_CHART_JUNCTION_NODE_INVALID",
                "error",
                `Junction node (${id}) duplicates prerequisites outside PREREQ_REGISTRY.`
            ));
        }
    }
}

export async function validateDataOrThrow(): Promise<void> {
    const issues: ValidationIssue[] = [];

    validateSources(issues);
    await validateStarChart(issues);

    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");

    if (warnings.length > 0) {
        console.warn(
            `[startup-validation] ${warnings.length} warning(s):\n` +
            warnings.map((w) => `  WARN [${w.code}] ${w.message}`).join("\n")
        );
    }

    if (errors.length > 0) {
        const lines = errors.map((e) => `  ERR  [${e.code}] ${e.message}`);
        throw new Error(`Data integrity validation failed (${errors.length} error(s)):\n${lines.join("\n")}`);
    }
}
