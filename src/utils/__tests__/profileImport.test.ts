import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseProfileImportText, parseWarframeStatApiProfile } from "../profileImport";

describe("parseWarframeStatApiProfile", () => {
    it("keeps the imported early Junction tags aligned with their canonical Star Chart IDs", () => {
        const parsed = parseWarframeStatApiProfile({
            missions: [
                { nodeKey: "EarthToVenusJunction" },
                { nodeKey: "VenusToMercuryJunction" },
            ],
        });

        expect(parsed.completedNodeIds).toEqual([
            "node:junction_venus_earth",
            "node:junction_mercury_venus",
        ]);
    });

    it("imports mastery XP from current warframestat.us loadout payloads", () => {
        const samplePath = new URL("../../../external/profile-sample.json", import.meta.url);
        const sample = JSON.parse(readFileSync(samplePath, "utf8"));

        const parsed = parseWarframeStatApiProfile(sample);

        expect(parsed.mastery.xpByItem["/Lotus/Powersuits/Fairy/Fairy"]).toBe(8_204_405);
        expect(parsed.mastery.xpByItem["/Lotus/Weapons/Tenno/Pistol/Pistol"]).toBe(481_548);
        expect(parsed.mastery.mastered["/Lotus/Powersuits/Fairy/Fairy"]).toBe(true);
        expect(parsed.mastery.mastered["/Lotus/Weapons/Tenno/Pistol/Pistol"]).toBe(true);
    });

    it("auto-detects warframestat.us JSON in the paste/file import path", () => {
        const samplePath = new URL("../../../external/profile-sample.json", import.meta.url);
        const sampleText = readFileSync(samplePath, "utf8");

        const parsed = parseProfileImportText(sampleText);

        expect(parsed.displayName).toBe("Skyrish");
        expect(parsed.mastery.mastered["/Lotus/Powersuits/Fairy/Fairy"]).toBe(true);
        expect(parsed.mastery.mastered["/Lotus/Weapons/Tenno/Pistol/Pistol"]).toBe(true);
    });
});
