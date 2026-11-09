import { access, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export interface GitTreeEntry {
    path: string;
    type: string;
    sha?: string;
}

export interface GitTreeResponse {
    sha?: string;
    truncated?: boolean;
    tree?: GitTreeEntry[];
}

export const DROP_DATA_REQUIRED_FILES = [
    "additionalItemByAvatar.json",
    "blueprintLocations.json",
    "cetusBountyRewards.json",
    "deimosRewards.json",
    "enemyBlueprintTables.json",
    "enemyModTables.json",
    "entratiLabRewards.json",
    "hexRewards.json",
    "keyRewards.json",
    "miscItems.json",
    "missionRewards.json",
    "modLocations.json",
    "relics.json",
    "resourceByAvatar.json",
    "sigilByAvatar.json",
    "solarisBountyRewards.json",
    "sortieRewards.json",
    "syndicates.json",
    "transientRewards.json",
    "zarimanRewards.json",
] as const;

const DROP_DATA_AGGREGATE_REQUIRED_KEYS = ["blueprintLocations", "missionRewards", "relics"] as const;

export interface DiscoveredJsonFile {
    name: string;
    path: string;
    sha?: string;
}

export function discoverJsonFilesFromTree(
    treeResponse: GitTreeResponse,
    dataPath: string,
    options: { requiredFiles: readonly string[]; generatedFiles?: readonly string[]; ignoredFiles?: readonly string[]; allowedFiles?: readonly string[] },
): DiscoveredJsonFile[] {
    if (treeResponse.truncated) {
        throw new Error(`GitHub returned a truncated tree for ${dataPath}; refusing to use an incomplete inventory`);
    }
    if (!Array.isArray(treeResponse.tree)) {
        throw new Error(`GitHub tree response for ${dataPath} has no tree array`);
    }

    const normalizedDataPath = dataPath.replace(/^\/+|\/+$/g, "");
    if (!normalizedDataPath && !options.allowedFiles) {
        throw new Error("Root-level JSON discovery requires an explicit allowlist");
    }
    const prefix = normalizedDataPath ? `${normalizedDataPath}/` : "";
    const sourceLabel = normalizedDataPath || "repository root";
    const allowed = options.allowedFiles ? new Set(options.allowedFiles) : null;
    const generated = new Set(options.generatedFiles ?? []);
    const ignored = new Set(options.ignoredFiles ?? []);
    const upstreamGenerated = treeResponse.tree
        .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
        .map((entry) => entry.path.slice(prefix.length))
        .filter((relativePath) => !relativePath.includes("/") && generated.has(relativePath));
    if (upstreamGenerated.length > 0) {
        throw new Error(`Generated local aggregate(s) unexpectedly exist upstream under ${sourceLabel}: ${upstreamGenerated.join(", ")}; inspect the new upstream contract before updating`);
    }
    const discovered = treeResponse.tree
        .filter((entry) => entry.type === "blob")
        .filter((entry) => entry.path.startsWith(prefix))
        .map((entry) => ({ entry, relativePath: entry.path.slice(prefix.length) }))
        .filter(({ relativePath }) => !relativePath.includes("/"))
        .filter(({ relativePath }) => relativePath.toLowerCase().endsWith(".json"))
        .filter(({ relativePath }) => !allowed || allowed.has(relativePath))
        .filter(({ relativePath }) => !generated.has(relativePath))
        .filter(({ relativePath }) => !ignored.has(relativePath))
        .map(({ entry, relativePath }) => ({ name: relativePath, path: entry.path, sha: entry.sha }))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (discovered.length === 0) {
        throw new Error(`No upstream JSON files discovered under ${sourceLabel}`);
    }

    const names = new Set(discovered.map((entry) => entry.name));
    const missing = options.requiredFiles.filter((name) => !names.has(name));
    if (missing.length > 0) {
        throw new Error(`Upstream inventory under ${sourceLabel} is missing required file(s): ${missing.join(", ")}`);
    }

    return discovered;
}

function rootKind(value: unknown): "array" | "object" | "other" {
    if (Array.isArray(value)) return "array";
    if (value !== null && typeof value === "object") return "object";
    return "other";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return rootKind(value) === "object";
}

export interface JsonInfo {
    bytes: number;
    kind: "array" | "object" | "other";
    count: number;
    empty: boolean;
    value: unknown;
}

export function inspectJsonText(fileName: string, raw: string): JsonInfo {
    if (Buffer.byteLength(raw) === 0) throw new Error(`${fileName} is empty`);
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch (error) {
        throw new Error(`${fileName} is not valid JSON: ${(error as Error).message}`);
    }
    const kind = rootKind(value);
    if (kind === "other") throw new Error(`${fileName} must have an object or array JSON root`);
    const count = kind === "array"
        ? (value as unknown[]).length
        : Object.keys(value as Record<string, unknown>).length;
    if (count === 0) throw new Error(`${fileName} contains an empty JSON ${kind}`);
    return { bytes: Buffer.byteLength(raw), kind, count, empty: false, value };
}

export interface ExternalDataIntegrityIssue {
    file: string;
    index: number;
    field: string;
    value: unknown;
}

export function validateDropDataJsonStructure(fileName: string, value: unknown): void {
    if (fileName === "all.json") {
        if (rootKind(value) !== "object") throw new Error("all.json must be an object aggregate");
        const aggregate = value as Record<string, unknown>;
        if (Object.keys(aggregate).length === 0) throw new Error("all.json aggregate is empty");
        const missing = DROP_DATA_AGGREGATE_REQUIRED_KEYS.filter((key) => !(key in aggregate));
        if (missing.length > 0) throw new Error(`all.json is missing required aggregate table(s): ${missing.join(", ")}`);
        for (const [key, table] of Object.entries(aggregate)) {
            const kind = rootKind(table);
            if (kind === "other") throw new Error(`all.json.${key} must be an object or array table`);
            const count = kind === "array" ? (table as unknown[]).length : Object.keys(table as Record<string, unknown>).length;
            if (count === 0) throw new Error(`all.json.${key} is empty`);
        }
        return;
    }
    if (fileName === "all.slim.json") {
        if (!Array.isArray(value) || value.length === 0) throw new Error("all.slim.json must be a non-empty array aggregate");
        for (let index = 0; index < value.length; index++) {
            const row = value[index];
            if (rootKind(row) !== "object") throw new Error(`all.slim.json[${index}] must be an object`);
            const record = row as Record<string, unknown>;
            if (typeof record.item !== "string" || !record.item.trim()) {
                throw new Error(`all.slim.json[${index}] is missing item`);
            }
            if (typeof record.place !== "string" || !record.place.trim()) {
                throw new Error(`all.slim.json[${index}] is missing place`);
            }
        }
        return;
    }
    if (fileName === "info.json") {
        if (rootKind(value) !== "object") throw new Error("info.json must be a metadata object");
        return;
    }
    if (rootKind(value) !== "object") {
        throw new Error(`${fileName} must be an object with the matching WFCD table key`);
    }

    const expectedKey = fileName.slice(0, -".json".length);
    const object = value as Record<string, unknown>;
    if (!(expectedKey in object)) {
        throw new Error(`${fileName} is missing its expected top-level "${expectedKey}" table`);
    }
    const table = object[expectedKey];
    const tableKind = rootKind(table);
    if (tableKind === "other") {
        throw new Error(`${fileName}.${expectedKey} must be an object or array`);
    }
    const count = tableKind === "array"
        ? (table as unknown[]).length
        : Object.keys(table as Record<string, unknown>).length;
    if (count === 0) throw new Error(`${fileName}.${expectedKey} table is empty`);
}

/** Verify that aggregate copies agree with their dedicated current table files. */
export function validateDropDataAggregateMatches(
    aggregateValue: unknown,
    sourceFiles: ReadonlyMap<string, unknown>,
): void {
    validateDropDataJsonStructure("all.json", aggregateValue);
    const aggregate = aggregateValue as Record<string, unknown>;
    for (const [fileName, sourceValue] of sourceFiles) {
        if (fileName === "all.json" || fileName === "all.slim.json" || fileName === "info.json") continue;
        const key = fileName.slice(0, -".json".length);
        if (!(key in aggregate)) continue; // WFCD intentionally omits some dedicated tables (currently miscItems).
        const source = sourceValue as Record<string, unknown>;
        if (!(key in source)) {
            throw new Error(`${fileName} is missing its "${key}" table while all.json contains that aggregate table`);
        }
        if (!isDeepStrictEqual(source[key], aggregate[key])) {
            throw new Error(`all.json.${key} does not match the current ${fileName}.${key} table`);
        }
    }
}

export function collectDropDataIntegrityIssues(fileName: string, value: unknown): ExternalDataIntegrityIssue[] {
    if (fileName === "relics.json") {
        if (!isRecord(value) || !Array.isArray(value.relics)) return [];
        const issues: ExternalDataIntegrityIssue[] = [];
        value.relics.forEach((row: unknown, index: number) => {
            if (!isRecord(row) || row.state !== "Intact") return;
            if (typeof row.tier !== "string" || !row.tier.trim()) {
                issues.push({ file: fileName, index, field: "tier", value: row.tier });
            }
            if (typeof row.relicName !== "string" || !row.relicName.trim()) {
                issues.push({ file: fileName, index, field: "relicName", value: row.relicName });
            }
        });
        return issues;
    }

    if (fileName !== "all.slim.json" || !Array.isArray(value)) return [];
    const issues: ExternalDataIntegrityIssue[] = [];
    for (let index = 0; index < value.length; index++) {
        const row = value[index];
        if (rootKind(row) !== "object") continue; // Structural validator reports this.
        const chance = (row as Record<string, unknown>).chance;
        const number = typeof chance === "number" ? chance : Number(chance);
        if (!Number.isFinite(number) || number < 0) {
            issues.push({ file: fileName, index, field: "chance", value: chance });
        }
    }
    return issues;
}

export function validateDropDataJsonFile(fileName: string, value: unknown): void {
    validateDropDataJsonStructure(fileName, value);
    const issues = collectDropDataIntegrityIssues(fileName, value);
    if (issues.length > 0) {
        const examples = issues.slice(0, 8).map((issue) => `${issue.file}[${issue.index}].${issue.field}=${JSON.stringify(issue.value)}`);
        throw new Error(`${fileName} contains ${issues.length} integrity issue(s): ${examples.join(", ")}${issues.length > examples.length ? ", …" : ""}`);
    }
}

export function assertNoUnexpectedShrink(
    fileName: string,
    current: JsonInfo,
    next: JsonInfo,
    options: { allowRepresentationShrink?: boolean } = {},
): void {
    if (current.kind !== next.kind) {
        throw new Error(`${fileName} changed JSON root kind from ${current.kind} to ${next.kind}`);
    }
    if (!options.allowRepresentationShrink && current.bytes > 1024 && next.bytes < Math.floor(current.bytes * 0.1)) {
        throw new Error(`${fileName} shrank suspiciously from ${current.bytes} bytes to ${next.bytes} bytes`);
    }
    if (current.count > 20 && next.count < Math.floor(current.count * 0.1)) {
        throw new Error(`${fileName} record/key count shrank suspiciously from ${current.count} to ${next.count}`);
    }
}

export async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

export interface DirectoryReplacement {
    targetPath: string;
    stagedPath: string;
}

/** Replace one or more directories as a unit, rolling every path back on failure. */
export async function replaceDirectoriesAtomically(
    replacements: DirectoryReplacement[],
    deps: {
        renamePath?: (from: string, to: string) => Promise<void>;
        removePath?: (target: string) => Promise<void>;
    } = {},
): Promise<void> {
    const renamePath = deps.renamePath ?? (async (from, to) => rename(from, to));
    const removePath = deps.removePath ?? (async (target) => rm(target, { recursive: true, force: true }));
    const token = randomUUID();
    const states = replacements.map((replacement) => ({
        ...replacement,
        backupPath: `${replacement.targetPath}.backup-${token}`,
        hadOriginal: false,
        installed: false,
    }));

    for (const state of states) {
        if (!(await pathExists(state.stagedPath))) {
            throw new Error(`Staged directory is missing: ${state.stagedPath}`);
        }
    }

    try {
        for (const state of states) {
            if (await pathExists(state.targetPath)) {
                await renamePath(state.targetPath, state.backupPath);
                state.hadOriginal = true;
            }
        }
        for (const state of states) {
            await renamePath(state.stagedPath, state.targetPath);
            state.installed = true;
        }
    } catch (error) {
        const rollbackErrors: string[] = [];
        for (const state of [...states].reverse()) {
            try {
                if (state.installed && await pathExists(state.targetPath)) await removePath(state.targetPath);
                if (state.hadOriginal && await pathExists(state.backupPath)) {
                    await renamePath(state.backupPath, state.targetPath);
                }
            } catch (rollbackError) {
                rollbackErrors.push(`${state.targetPath}: ${(rollbackError as Error).message}`);
            }
        }
        const rollback = rollbackErrors.length > 0 ? `; rollback also failed: ${rollbackErrors.join("; ")}` : "";
        throw new Error(`Directory replacement failed: ${(error as Error).message}${rollback}`);
    }

    const cleanupErrors: string[] = [];
    for (const state of states) {
        if (state.hadOriginal) {
            try {
                await removePath(state.backupPath);
            } catch (error) {
                cleanupErrors.push(`${state.backupPath}: ${(error as Error).message}`);
            }
        }
    }
    if (cleanupErrors.length > 0) {
        throw new Error(`Data update committed, but backup cleanup failed: ${cleanupErrors.join("; ")}`);
    }
}

export async function makeSiblingStageDir(targetDir: string): Promise<string> {
    const parent = path.dirname(targetDir);
    await mkdir(parent, { recursive: true });
    return await mkdtemp(path.join(parent, ".tenno-stage-"));
}
