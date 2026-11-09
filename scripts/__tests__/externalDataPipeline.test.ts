import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    assertNoUnexpectedShrink,
    collectDropDataIntegrityIssues,
    discoverJsonFilesFromTree,
    inspectJsonText,
    replaceDirectoriesAtomically,
    validateDropDataAggregateMatches,
    validateDropDataJsonFile,
} from "../lib/externalDataPipeline";
import {
    buildResolvedWarframeItemsAll,
    buildWfcdRequirements,
    parseWarframeItemCategory,
    WARFRAME_ITEMS_REQUIRED_FILES,
    writeFileAtomically,
} from "../lib/warframeItemsData";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tenno-pipeline-test-"));
    tempDirs.push(dir);
    return dir;
}

function makeValidItemFiles(): Map<string, unknown[]> {
    const files = new Map<string, unknown[]>();
    for (const name of WARFRAME_ITEMS_REQUIRED_FILES) {
        const basename = name.replace(/\.json$/i, "");
        files.set(name, [{
            uniqueName: `/Lotus/Test/${basename}`,
            name: `Fixture ${basename}`,
            category: basename,
        }]);
    }
    files.set("Warframes.json", [{
        uniqueName: "/Lotus/Test/ExampleFrame",
        name: "Example Frame",
        category: "Warframes",
        description: "Frame description retained by aggregation",
        components: [
            { uniqueName: "/Lotus/Test/ExampleFrameChassisComponent", itemCount: 2 },
            { uniqueName: "/Lotus/Test/ExampleResource", itemCount: 7 },
        ],
    }]);
    files.set("Components.json", [{
        uniqueName: "/Lotus/Test/ExampleFrameChassisComponent",
        name: "Chassis",
        imageName: "ExampleChassis.png",
        parentUniqueNames: ["/Lotus/Test/ExampleFrame"],
    }]);
    files.set("Resources.json", [{
        uniqueName: "/Lotus/Test/ExampleResource",
        name: "Example Resource",
        category: "Resources",
        description: "A standalone ingredient",
        drops: [{ location: "Example node", chance: 12.5, rarity: "Common" }],
    }]);
    return files;
}

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("external data source discovery", () => {
    it("discovers new top-level JSON files while excluding local aggregates and unused localization", () => {
        const files = discoverJsonFilesFromTree({
            sha: "commit-123",
            tree: [
                { path: "data/json/Warframes.json", type: "blob", sha: "a" },
                { path: "data/json/Components.json", type: "blob", sha: "b" },
                { path: "data/json/Incarnons.json", type: "blob", sha: "c" },
                { path: "data/json/i18n.json", type: "blob", sha: "d" },
                { path: "data/json/locale/en.json", type: "blob", sha: "e" },
                { path: "data/json/Readme.md", type: "blob", sha: "f" },
            ],
        }, "data/json", {
            requiredFiles: ["Warframes.json", "Components.json"],
            generatedFiles: ["All.json"],
            ignoredFiles: ["i18n.json"],
        });

        expect(files.map((file) => file.name)).toEqual(["Components.json", "Incarnons.json", "Warframes.json"]);
    });

    it("fails when required sources are missing or a generated All.json appears upstream", () => {
        expect(() => discoverJsonFilesFromTree({
            tree: [{ path: "data/json/Warframes.json", type: "blob" }],
        }, "data/json", { requiredFiles: ["Warframes.json", "Components.json"] }))
            .toThrow(/missing required file.*Components\.json/i);

        expect(() => discoverJsonFilesFromTree({
            tree: [{ path: "data/json/All.json", type: "blob" }],
        }, "data/json", { requiredFiles: [], generatedFiles: ["All.json"] }))
            .toThrow(/unexpectedly exist upstream.*All\.json/i);
    });

    it("rejects truncated tree inventories", () => {
        expect(() => discoverJsonFilesFromTree({ truncated: true, tree: [] }, "data", { requiredFiles: [] }))
            .toThrow(/truncated tree/i);
    });

    it("discovers an explicit allowlist of top-level JSON files from a repository root", () => {
        const files = discoverJsonFilesFromTree({
            tree: [
                { path: "ExportWeapons.json", type: "blob" },
                { path: "dict.en.json", type: "blob" },
                { path: "dict.fr.json", type: "blob" },
                { path: "supplementals/extra.json", type: "blob" },
                { path: "README.md", type: "blob" },
            ],
        }, "", {
            requiredFiles: ["dict.en.json", "ExportWeapons.json"],
            allowedFiles: ["dict.en.json", "ExportWeapons.json"],
        });

        expect(files.map((file) => file.name)).toEqual(["dict.en.json", "ExportWeapons.json"]);
        expect(() => discoverJsonFilesFromTree({ tree: [{ path: "ExportWeapons.json", type: "blob" }] }, "", { requiredFiles: [] }))
            .toThrow(/explicit allowlist/i);
    });

    it("validates drop-data table wrappers and prevents empty source tables", () => {
        expect(() => validateDropDataJsonFile("missionRewards.json", { drops: [] }))
            .toThrow(/expected top-level "missionRewards" table/);
        expect(() => validateDropDataJsonFile("missionRewards.json", { missionRewards: {} }))
            .toThrow(/table is empty/);
        expect(() => validateDropDataJsonFile("missionRewards.json", { missionRewards: { Earth: {} } }))
            .not.toThrow();
        expect(() => validateDropDataJsonFile("all.slim.json", [{ place: "Earth/Node", item: "Test Item", chance: 12.5 }]))
            .not.toThrow();
        expect(() => validateDropDataJsonFile("all.slim.json", [{ place: "Earth/Node", chance: 12.5 }]))
            .toThrow(/missing item/);
        expect(collectDropDataIntegrityIssues("all.slim.json", [
            { place: "Earth/Node", item: "Test Item", chance: "NaN" },
        ])).toEqual([{ file: "all.slim.json", index: 0, field: "chance", value: "NaN" }]);
        expect(() => validateDropDataJsonFile("all.slim.json", [
            { place: "Earth/Node", item: "Test Item", chance: "NaN" },
        ])).toThrow(/integrity issue.*chance/);
        expect(collectDropDataIntegrityIssues("relics.json", { relics: [
            { tier: "Lith", relicName: "A1", state: "Intact" },
            { tier: "Requiem", state: "Intact" },
        ] })).toEqual([{ file: "relics.json", index: 1, field: "relicName", value: undefined }]);
        expect(() => validateDropDataJsonFile("relics.json", { relics: [
            { tier: "Requiem", state: "Intact" },
        ] })).toThrow(/relics\.json\[0\]\.relicName=undefined/);
    });

    it("requires core all.json tables and rejects aggregates that diverge from dedicated source tables", () => {
        const table = { blueprintLocations: [{ itemName: "Example Blueprint" }] };
        const aggregate = {
            blueprintLocations: table.blueprintLocations,
            missionRewards: { Earth: { Example: { rewards: { A: [{ itemName: "Example Reward" }] } } } },
            relics: [{ relicName: "A1" }],
        };
        const sources = new Map<string, unknown>([
            ["blueprintLocations.json", table],
            ["missionRewards.json", { missionRewards: aggregate.missionRewards }],
            ["relics.json", { relics: aggregate.relics }],
            ["miscItems.json", { miscItems: [{ enemyName: "A" }] }],
        ]);

        expect(() => validateDropDataAggregateMatches(aggregate, sources)).not.toThrow();
        expect(() => validateDropDataAggregateMatches({ ...aggregate, relics: [] }, sources)).toThrow(/all\.json\.relics is empty/);
        expect(() => validateDropDataAggregateMatches({ ...aggregate, missionRewards: { Venus: { Other: {} } } }, sources))
            .toThrow(/does not match the current missionRewards\.json/);
        expect(() => validateDropDataAggregateMatches({ missionRewards: aggregate.missionRewards, relics: aggregate.relics }, sources))
            .toThrow(/missing required aggregate table.*blueprintLocations/);
    });
});

describe("WFCD component aggregation", () => {
    it("recreates the complete sorted aggregate and resolves component payloads and counts", () => {
        const files = makeValidItemFiles();
        const all = buildResolvedWarframeItemsAll(files);
        const frame = all.find((item) => item.uniqueName === "/Lotus/Test/ExampleFrame");

        expect(all).toHaveLength(WARFRAME_ITEMS_REQUIRED_FILES.length);
        expect(all.map((item) => item.name)).toEqual([...all.map((item) => item.name)].sort((a, b) => a.localeCompare(b)));
        expect(frame?.description).toBe("Frame description retained by aggregation");
        expect(frame?.components).toEqual([
            {
                uniqueName: "/Lotus/Test/ExampleFrameChassisComponent",
                name: "Chassis",
                imageName: "ExampleChassis.png",
                itemCount: 2,
            },
            {
                uniqueName: "/Lotus/Test/ExampleResource",
                name: "Example Resource",
                category: "Resources",
                description: "A standalone ingredient",
                drops: [{ location: "Example node", chance: 12.5, rarity: "Common" }],
                itemCount: 7,
            },
        ]);

        const requirements = buildWfcdRequirements(files);
        expect(requirements["items:/Lotus/Test/ExampleFrame"]?.components).toEqual([
            { catalogId: "items:/Lotus/Test/ExampleFrameChassisComponent", count: 2 },
            { catalogId: "items:/Lotus/Test/ExampleResource", count: 7 },
        ]);
    });

    it("fails closed for duplicate item identities, missing components, and invalid quantities", () => {
        const duplicate = makeValidItemFiles();
        duplicate.set("Gear.json", [{ uniqueName: "/Lotus/Test/ExampleFrame", name: "Duplicate" }]);
        expect(() => buildResolvedWarframeItemsAll(duplicate)).toThrow(/Duplicate WFCD uniqueName/);

        const missing = makeValidItemFiles();
        missing.set("Warframes.json", [{
            uniqueName: "/Lotus/Test/ExampleFrame",
            name: "Example Frame",
            components: [{ uniqueName: "/Lotus/Test/MissingPart", itemCount: 1 }],
        }]);
        expect(() => buildResolvedWarframeItemsAll(missing)).toThrow(/references unresolved component/);

        const invalidQuantity = makeValidItemFiles();
        invalidQuantity.set("Warframes.json", [{
            uniqueName: "/Lotus/Test/ExampleFrame",
            name: "Example Frame",
            components: [{ uniqueName: "/Lotus/Test/ExampleFrameChassisComponent", itemCount: 0 }],
        }]);
        expect(() => buildResolvedWarframeItemsAll(invalidQuantity)).toThrow(/positive finite number/);
    });

    it("validates category array structure instead of skipping malformed rows", () => {
        expect(() => parseWarframeItemCategory("Warframes.json", [{ name: "Nameless" }]))
            .toThrow(/missing a non-empty uniqueName/);
        expect(() => parseWarframeItemCategory("Components.json", []))
            .toThrow(/empty item array/);
    });
});

describe("safe dataset replacement", () => {
    it("atomically replaces generated files and removes its temporary file", async () => {
        const dir = await createTempDir();
        const output = path.join(dir, "generated.json");
        await writeFile(output, "previous", "utf8");

        await writeFileAtomically(output, "current");

        expect(await readFile(output, "utf8")).toBe("current");
        expect(await readdir(dir)).toEqual(["generated.json"]);
    });

    it("detects unexpected shrinkage by bytes and record count", () => {
        const current = inspectJsonText("items.json", JSON.stringify(Array.from({ length: 100 }, (_, id) => ({ id }))));
        const next = inspectJsonText("items.json", JSON.stringify([{ id: 1 }]));
        expect(() => assertNoUnexpectedShrink("items.json", current, next)).toThrow(/count shrank suspiciously/);

        const sameIdentityCount = inspectJsonText("category.json", JSON.stringify(Array.from({ length: 100 }, (_, id) => ({ id, expanded: "x".repeat(100) }))));
        const compactRepresentation = inspectJsonText("category.json", JSON.stringify(Array.from({ length: 100 }, (_, id) => ({ id }))));
        expect(() => assertNoUnexpectedShrink("category.json", sameIdentityCount, compactRepresentation)).toThrow(/shrank suspiciously/);
        expect(() => assertNoUnexpectedShrink("category.json", sameIdentityCount, compactRepresentation, { allowRepresentationShrink: true }))
            .not.toThrow();
    });

    it("rolls all directories back when one staged replacement fails", async () => {
        const root = await createTempDir();
        const targetA = path.join(root, "items");
        const targetB = path.join(root, "drops");
        const stageA = path.join(root, "items-stage");
        const stageB = path.join(root, "drops-stage");
        await Promise.all([targetA, targetB, stageA, stageB].map((dir) => mkdir(dir)));
        await Promise.all([
            writeFile(path.join(targetA, "value.json"), "old-items"),
            writeFile(path.join(targetB, "value.json"), "old-drops"),
            writeFile(path.join(stageA, "value.json"), "new-items"),
            writeFile(path.join(stageB, "value.json"), "new-drops"),
        ]);

        let rejectedOnce = false;
        await expect(replaceDirectoriesAtomically([
            { targetPath: targetA, stagedPath: stageA },
            { targetPath: targetB, stagedPath: stageB },
        ], {
            renamePath: async (from, to) => {
                if (!rejectedOnce && from === stageB) {
                    rejectedOnce = true;
                    throw new Error("simulated second directory install failure");
                }
                const fs = await import("node:fs/promises");
                await fs.rename(from, to);
            },
        })).rejects.toThrow(/Directory replacement failed/);

        await expect(readFile(path.join(targetA, "value.json"), "utf8")).resolves.toBe("old-items");
        await expect(readFile(path.join(targetB, "value.json"), "utf8")).resolves.toBe("old-drops");
    });
});
