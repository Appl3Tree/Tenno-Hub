import { describe, expect, it } from "vitest";
import { buildLegacyUpgradeCatalog } from "../generate/generateLegacyUpgradeCatalog";

describe("legacy upgrade identity fallbacks", () => {
    it("adds exact named paths absent from current catalogs and preserves source classification", () => {
        const result = buildLegacyUpgradeCatalog({
            sourceRecords: [
                { uniqueName: "/Lotus/Upgrades/Mods/LegacySentinel", name: "Legacy Sentinel Mod", type: "SENTINEL" },
                { uniqueName: "/Lotus/Upgrades/Mods/Current", name: "Old Catalog Name", type: "RIFLE" },
                { uniqueName: "/Lotus/Upgrades/Mods/Randomized/Template", name: "Riven Template", type: "RIFLE" },
                { uniqueName: "/Lotus/Language/OnlyAPath", name: "/Lotus/Language/Untranslated" },
                { uniqueName: "/Lotus/Upgrades/Mods/NoName", name: "" },
                { uniqueName: "/Other/NotLotus", name: "Not a Lotus identity" },
                null,
            ],
            existingModPaths: new Set(["/Lotus/Upgrades/Mods/Current"]),
        });

        expect(result).toEqual({
            "/Lotus/Upgrades/Mods/LegacySentinel": {
                path: "/Lotus/Upgrades/Mods/LegacySentinel",
                name: "Legacy Sentinel Mod",
                category: "Mods",
                categories: ["Mods"],
                type: "SENTINEL",
                identitySource: "IhToN/warframe-item-data",
                sourceCommitSha: "f93ac0a5a94e58a153d625d1cb013a7318ce1a1e",
            },
        });
    });

    it("rejects conflicting names for one exact source path", () => {
        expect(() => buildLegacyUpgradeCatalog({
            sourceRecords: [
                { uniqueName: "/Lotus/Upgrades/Mods/Collision", name: "First Name", type: "RIFLE" },
                { uniqueName: "/Lotus/Upgrades/Mods/Collision", name: "Second Name", type: "RIFLE" },
            ],
            existingModPaths: new Set(),
        })).toThrow(/Conflicting legacy upgrade identities/);
    });
});
