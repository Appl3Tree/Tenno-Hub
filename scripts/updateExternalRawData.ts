import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    assertNoUnexpectedShrink,
    collectDropDataIntegrityIssues,
    DROP_DATA_REQUIRED_FILES,
    discoverJsonFilesFromTree,
    inspectJsonText,
    makeSiblingStageDir,
    pathExists,
    replaceDirectoriesAtomically,
    validateDropDataJsonStructure,
    validateDropDataAggregateMatches,
    type DiscoveredJsonFile,
    type GitTreeResponse,
} from "./lib/externalDataPipeline";
import {
    buildResolvedWarframeItemsAll,
    parseWarframeItemCategory,
    WARFRAME_ITEMS_GENERATED_FILE,
    WARFRAME_ITEMS_IGNORED_FILE,
    WARFRAME_ITEMS_REQUIRED_FILES,
} from "./lib/warframeItemsData";
import { validateRelicMissionRewardReferences } from "./lib/relicData";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const EXTERNAL_ROOT = path.join(ROOT, "external");

type DatasetKey = "warframe-items" | "warframe-drop-data";
type DatasetSelection = DatasetKey | "all";

interface DatasetConfig {
    key: DatasetKey;
    label: string;
    targetDir: string;
    dataPath: string;
    treeUrl: string;
    commitUrl: string;
    rawCommitRoot: string;
    rawBaseEnv: string;
    treeUrlEnv: string;
    commitUrlEnv: string;
    requiredFiles: readonly string[];
    generatedFiles?: readonly string[];
    ignoredFiles?: readonly string[];
}

const DATASETS: Record<DatasetKey, DatasetConfig> = {
    "warframe-items": {
        key: "warframe-items",
        label: "WFCD warframe-items",
        targetDir: path.join(EXTERNAL_ROOT, "warframe-items", "raw"),
        dataPath: "data/json",
        treeUrl: "https://api.github.com/repos/WFCD/warframe-items/git/trees/master?recursive=1",
        commitUrl: "https://api.github.com/repos/WFCD/warframe-items/commits/master",
        rawCommitRoot: "https://raw.githubusercontent.com/WFCD/warframe-items",
        rawBaseEnv: "WARFRAME_ITEMS_RAW_BASE",
        treeUrlEnv: "WARFRAME_ITEMS_TREE_URL",
        commitUrlEnv: "WARFRAME_ITEMS_COMMIT_URL",
        requiredFiles: WARFRAME_ITEMS_REQUIRED_FILES,
        generatedFiles: [WARFRAME_ITEMS_GENERATED_FILE],
        // Localization is not consumed by Tenno Hub; item descriptions and
        // gameplay fields remain in the category payloads.
        ignoredFiles: [WARFRAME_ITEMS_IGNORED_FILE],
    },
    "warframe-drop-data": {
        key: "warframe-drop-data",
        label: "WFCD warframe-drop-data",
        targetDir: path.join(EXTERNAL_ROOT, "warframe-drop-data", "raw"),
        dataPath: "data",
        treeUrl: "https://api.github.com/repos/WFCD/warframe-drop-data/git/trees/main?recursive=1",
        commitUrl: "https://api.github.com/repos/WFCD/warframe-drop-data/commits/main",
        rawCommitRoot: "https://raw.githubusercontent.com/WFCD/warframe-drop-data",
        rawBaseEnv: "WARFRAME_DROP_DATA_RAW_BASE",
        treeUrlEnv: "WARFRAME_DROP_DATA_TREE_URL",
        commitUrlEnv: "WARFRAME_DROP_DATA_COMMIT_URL",
        requiredFiles: DROP_DATA_REQUIRED_FILES,
    },
};

interface Args {
    dataset: DatasetSelection;
    dryRun: boolean;
}

interface PreparedDataset {
    config: DatasetConfig;
    stageDir: string;
    changedFiles: string[];
    sourceFiles: string[];
    sourceCommitSha: string;
    sourceBaseUrl: string;
    shouldCommit: boolean;
}

function parseArgs(argv: string[]): Args {
    const selection = argv.find((arg) => !arg.startsWith("--")) ?? "all";
    if (selection !== "all" && selection !== "warframe-items" && selection !== "warframe-drop-data") {
        throw new Error(`Unknown dataset "${selection}". Use all, warframe-items, or warframe-drop-data.`);
    }
    const unknownFlags = argv.filter((arg) => arg.startsWith("--") && arg !== "--dry-run");
    if (unknownFlags.length > 0) throw new Error(`Unknown option(s): ${unknownFlags.join(", ")}`);
    return { dataset: selection, dryRun: argv.includes("--dry-run") };
}

function describeBaseUrl(config: DatasetConfig, rawOverride?: string): string {
    return rawOverride || `${config.rawCommitRoot}/<commit-sha>/${config.dataPath}`;
}

async function fetchText(url: string, purpose: string): Promise<string> {
    const maxAttempts = 3;
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Tenno-Hub-data-updater",
                    Accept: "application/vnd.github+json, application/json, text/plain, */*",
                    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
                },
                signal: AbortSignal.timeout(90_000),
            });
            if (response.ok) return await response.text();

            const body = (await response.text()).slice(0, 500).replace(/\s+/g, " ").trim();
            const error = new Error(`${purpose} failed: HTTP ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`);
            if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === maxAttempts) {
                throw error;
            }
            lastError = error;
        } catch (error) {
            const cause = error as Error;
            if (cause.message.startsWith(`${purpose} failed: HTTP`) && !/HTTP (408|425|429|500|502|503|504)\b/.test(cause.message)) {
                throw cause;
            }
            lastError = cause;
            if (attempt === maxAttempts) break;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
    throw new Error(`${purpose} failed after ${maxAttempts} attempts: ${lastError?.message ?? "unknown network error"} (URL: ${url})`);
}

async function getInventory(config: DatasetConfig): Promise<{ commitSha: string; files: DiscoveredJsonFile[]; treeUrl: string }> {
    const commitUrl = process.env[config.commitUrlEnv] || config.commitUrl;
    let commit: unknown;
    try {
        commit = JSON.parse(await fetchText(commitUrl, `${config.label} commit discovery`));
    } catch (error) {
        throw new Error(`${config.label} commit discovery failed at ${commitUrl}: ${(error as Error).message}`);
    }
    if (!commit || typeof commit !== "object" || Array.isArray(commit) || typeof (commit as { sha?: unknown }).sha !== "string") {
        throw new Error(`${config.label} commit discovery at ${commitUrl} did not return a commit SHA`);
    }
    const commitSha = (commit as { sha: string }).sha;
    const defaultTreeUrl = `${config.treeUrl.slice(0, config.treeUrl.indexOf("/git/trees/") + "/git/trees/".length)}${commitSha}?recursive=1`;
    const treeUrl = process.env[config.treeUrlEnv] || defaultTreeUrl;
    let tree: unknown;
    try {
        tree = JSON.parse(await fetchText(treeUrl, `${config.label} source discovery`));
    } catch (error) {
        throw new Error(`${config.label} source discovery failed at ${treeUrl}: ${(error as Error).message}`);
    }
    if (!tree || typeof tree !== "object" || Array.isArray(tree)) {
        throw new Error(`${config.label} source discovery at ${treeUrl} returned an invalid tree response`);
    }
    const treeResponse = tree as { sha?: unknown; truncated?: unknown; tree?: unknown };
    if (typeof treeResponse.sha !== "string" || treeResponse.sha.length === 0) {
        throw new Error(`${config.label} source discovery at ${treeUrl} did not return a tree SHA`);
    }
    const files = discoverJsonFilesFromTree(
        treeResponse as GitTreeResponse,
        config.dataPath,
        {
            requiredFiles: config.requiredFiles,
            generatedFiles: config.generatedFiles,
            ignoredFiles: config.ignoredFiles,
        },
    );
    const ignoredEntries = (treeResponse.tree as Array<{ path?: string; type?: string }>).filter((entry) =>
        entry.type === "blob" && config.ignoredFiles?.some((ignored) => entry.path === `${config.dataPath}/${ignored}`),
    );
    if (ignoredEntries.length > 0) {
        console.log(`  excluded unused upstream file(s): ${ignoredEntries.map((entry) => path.basename(entry.path ?? "")).join(", ")}`);
    }
    return { commitSha, files, treeUrl };
}

function buildDownloadUrl(config: DatasetConfig, treeSha: string, file: DiscoveredJsonFile): string {
    const override = process.env[config.rawBaseEnv];
    if (override) return `${override.replace(/\/$/, "")}/${encodeURIComponent(file.name)}`;
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    return `${config.rawCommitRoot}/${treeSha}/${encodedPath}`;
}

async function readCurrentJsonInfo(filePath: string): Promise<ReturnType<typeof inspectJsonText> | null> {
    if (!(await pathExists(filePath))) return null;
    return inspectJsonText(path.basename(filePath), await readFile(filePath, "utf8"));
}

async function downloadInventory(
    config: DatasetConfig,
    treeSha: string,
    files: DiscoveredJsonFile[],
): Promise<Map<string, { raw: string; url: string; info: ReturnType<typeof inspectJsonText> }>> {
    const downloaded = new Map<string, { raw: string; url: string; info: ReturnType<typeof inspectJsonText> }>();
    let nextIndex = 0;
    const workerCount = Math.min(5, files.length);

    const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= files.length) return;
            const file = files[index]!;
            const url = buildDownloadUrl(config, treeSha, file);
            let raw: string;
            try {
                raw = await fetchText(url, `${config.label} ${file.name}`);
            } catch (error) {
                throw new Error(`${config.label} failed to download ${file.name} from ${url}: ${(error as Error).message}`);
            }
            let info: ReturnType<typeof inspectJsonText>;
            try {
                info = inspectJsonText(file.name, raw);
                if (config.key === "warframe-items") {
                    parseWarframeItemCategory(file.name, info.value);
                } else {
                    validateDropDataJsonStructure(file.name, info.value);
                }
                const currentInfo = await readCurrentJsonInfo(path.join(config.targetDir, file.name));
                if (currentInfo) {
                    assertNoUnexpectedShrink(file.name, currentInfo, info, {
                        // WFCD moved expanded component payloads from category
                        // files into Components.json. Identity counts remain the
                        // correct shrink signal for this intentional schema change.
                        allowRepresentationShrink: config.key === "warframe-items",
                    });
                }
            } catch (error) {
                throw new Error(`${config.label} rejected ${file.name} from ${url}: ${(error as Error).message}`);
            }
            downloaded.set(file.name, { raw, url, info });
        }
    });

    const results = await Promise.allSettled(workers);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) throw failed.reason;
    return downloaded;
}

function validateDropDataInventory(
    downloaded: Map<string, { raw: string; url: string; info: ReturnType<typeof inspectJsonText> }>,
): void {
    const missionSource = downloaded.get("missionRewards.json")?.info.value;
    const missionRewards = missionSource !== null && typeof missionSource === "object" && !Array.isArray(missionSource)
        ? (missionSource as Record<string, unknown>).missionRewards
        : undefined;
    const relics = downloaded.get("relics.json")?.info.value;
    if (missionRewards !== undefined && relics !== undefined) {
        try {
            validateRelicMissionRewardReferences(missionRewards, relics);
        } catch (error) {
            const urls = ["missionRewards.json", "relics.json"]
                .map((name) => `${name}: ${downloaded.get(name)?.url ?? "URL unavailable"}`)
                .join("; ");
            throw new Error(`${(error as Error).message} (source URLs: ${urls})`);
        }
    }

    const aggregate = downloaded.get("all.json");
    if (aggregate) {
        try {
            validateDropDataAggregateMatches(aggregate.info.value, new Map(
                [...downloaded].map(([name, entry]) => [name, entry.info.value]),
            ));
        } catch (error) {
            const message = (error as Error).message;
            const involvedFiles = [...downloaded.keys()].filter((name) =>
                name === "all.json" || message.includes(name) || message.includes(name.slice(0, -".json".length)),
            );
            const urls = involvedFiles.map((name) => `${name}: ${downloaded.get(name)?.url}`).join("; ");
            throw new Error(`${message} (source URLs: ${urls})`);
        }
    }

    // Source defects are reported and retained for a strict offline integrity
    // failure; synchronization never rewrites upstream rows to hide them.
    for (const fileName of ["all.slim.json", "relics.json"]) {
        const entry = downloaded.get(fileName);
        if (!entry) continue;
        const issues = collectDropDataIntegrityIssues(fileName, entry.info.value);
        if (issues.length === 0) continue;
        const examples = issues.slice(0, 8).map((issue) => `${issue.file}[${issue.index}].${issue.field}=${JSON.stringify(issue.value)}`);
        console.warn(`  [upstream integrity defect] ${issues.length} issue(s) in ${fileName}; retained verbatim: ${examples.join(", ")}${issues.length > examples.length ? ", …" : ""}`);
    }
}

async function stageDataset(config: DatasetConfig): Promise<PreparedDataset> {
    const { commitSha, files, treeUrl } = await getInventory(config);
    const rawOverride = process.env[config.rawBaseEnv];
    const sourceBaseUrl = describeBaseUrl(config, rawOverride);
    console.log(`Discovering ${config.label} from ${treeUrl}`);
    console.log(`  upstream JSON files: ${files.length}; immutable commit: ${commitSha}`);

    const downloaded = await downloadInventory(config, commitSha, files);
    if (config.key === "warframe-drop-data") validateDropDataInventory(downloaded);

    const stageDir = await makeSiblingStageDir(config.targetDir);
    try {
        const stageFiles = new Map<string, string>();
        for (const [name, entry] of downloaded) stageFiles.set(name, entry.raw);

        if (config.key === "warframe-items") {
            const itemFiles = new Map<string, unknown[]>();
            for (const [name, entry] of downloaded) itemFiles.set(name, parseWarframeItemCategory(name, entry.info.value));
            const all = buildResolvedWarframeItemsAll(itemFiles);
            const allRaw = JSON.stringify(all);
            const allInfo = inspectJsonText(WARFRAME_ITEMS_GENERATED_FILE, allRaw);
            const priorAll = await readCurrentJsonInfo(path.join(config.targetDir, WARFRAME_ITEMS_GENERATED_FILE));
            if (priorAll) assertNoUnexpectedShrink(WARFRAME_ITEMS_GENERATED_FILE, priorAll, allInfo, { allowRepresentationShrink: true });
            stageFiles.set(WARFRAME_ITEMS_GENERATED_FILE, allRaw);
            console.log(`  generated All.json: ${all.length} unique items; ${allInfo.bytes} bytes; component refs resolved`);
        }

        await mkdir(stageDir, { recursive: true });
        for (const [name, raw] of stageFiles) await writeFile(path.join(stageDir, name), raw, "utf8");

        const upstreamNames = new Set(stageFiles.keys());
        const previousNames = (await readdir(config.targetDir).catch(() => []))
            .filter((name) => name.endsWith(".json") && !name.startsWith("."));
        const changedFiles = new Set<string>();
        for (const name of upstreamNames) {
            const currentPath = path.join(config.targetDir, name);
            if (!(await pathExists(currentPath))) {
                changedFiles.add(name);
                console.log(`  [add] ${name}`);
                continue;
            }
            const currentRaw = await readFile(currentPath, "utf8");
            const nextRaw = stageFiles.get(name)!;
            if (currentRaw !== nextRaw) {
                changedFiles.add(name);
                console.log(`  [update] ${name}`);
            }
        }
        for (const name of previousNames) {
            if (upstreamNames.has(name)) continue;
            changedFiles.add(name);
            console.log(`  [removed upstream] ${name}`);
        }

        const stampPath = path.join(config.targetDir, ".last-sync.json");
        const hasStamp = await pathExists(stampPath);
        const shouldCommit = changedFiles.size > 0 || !hasStamp;
        if (shouldCommit) {
            const stamp = {
                dataset: config.key,
                syncedAt: new Date().toISOString(),
                sourceCommitSha: commitSha,
                sourceTreeUrl: treeUrl,
                sourceBaseUrl,
                upstreamFiles: files.map((file) => file.name),
                changedFiles: [...changedFiles].sort((a, b) => a.localeCompare(b)),
            };
            await writeFile(path.join(stageDir, ".last-sync.json"), JSON.stringify(stamp, null, 2), "utf8");
        } else {
            // Preserve metadata too: repeated refreshes with identical upstream
            // content are byte-for-byte idempotent.
            await writeFile(path.join(stageDir, ".last-sync.json"), await readFile(stampPath));
        }

        return {
            config,
            stageDir,
            changedFiles: [...changedFiles].sort((a, b) => a.localeCompare(b)),
            sourceFiles: files.map((file) => file.name),
            sourceCommitSha: commitSha,
            sourceBaseUrl,
            shouldCommit,
        };
    } catch (error) {
        await rm(stageDir, { recursive: true, force: true });
        throw error;
    }
}

async function run(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const selected: DatasetKey[] = args.dataset === "all"
        ? ["warframe-items", "warframe-drop-data"]
        : [args.dataset];
    const prepared: PreparedDataset[] = [];
    try {
        for (const key of selected) prepared.push(await stageDataset(DATASETS[key]));

        for (const dataset of prepared) {
            const status = dataset.shouldCommit ? `${dataset.changedFiles.length} changed/removed` : "unchanged";
            console.log(`${dataset.config.key}: ${status}; ${dataset.sourceFiles.length} upstream files at ${dataset.sourceCommitSha}`);
        }

        const toCommit = prepared.filter((dataset) => dataset.shouldCommit);
        if (args.dryRun) {
            console.log("Dry run complete; no tracked source or generated files were replaced.");
            return;
        }
        if (toCommit.length === 0) {
            console.log("All requested datasets are already current.");
            return;
        }

        await replaceDirectoriesAtomically(toCommit.map((dataset) => ({
            targetPath: dataset.config.targetDir,
            stagedPath: dataset.stageDir,
        })));
        console.log(`Committed ${toCommit.length} dataset(s) atomically.`);
    } finally {
        for (const dataset of prepared) {
            await rm(dataset.stageDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }
}

run().catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
});
