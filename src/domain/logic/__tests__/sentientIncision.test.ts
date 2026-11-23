import { describe, expect, it } from "vitest";
import { getSentientIncisionDamageType } from "../sentientIncision";

describe("Sentient Incision adaptive damage selection", () => {
    it.each([
        ["Grineer", "corrosive"],
        ["Kuva Grineer", "corrosive"],
        ["Zariman", "corrosive"],
        ["Scaldra (1999)", "corrosive"],
        ["Corpus", "magnetic"],
        ["Corpus Amalgam", "magnetic"],
        ["Techrot (1999)", "magnetic"],
        ["Infested", "heat"],
        ["Infested Deimos", "gas"],
        ["Orokin", "viral"],
        ["Narmer", "toxin"],
        ["Anarchs", "electricity"],
        ["Sentient", "radiation"],
        ["The Murmur", "radiation"],
    ] as const)("maps %s to %s", (faction, damageType) => {
        expect(getSentientIncisionDamageType(faction)).toBe(damageType);
    });

    it("uses Corrosive against active Overguard regardless of faction and leaves unsupported targets unresolved", () => {
        expect(getSentientIncisionDamageType("Corpus", true)).toBe("corrosive");
        expect(getSentientIncisionDamageType("", true)).toBe("corrosive");
        expect(getSentientIncisionDamageType("Custom Target")).toBeNull();
        expect(getSentientIncisionDamageType("Overguard")).toBeNull();
        expect(getSentientIncisionDamageType("")).toBeNull();
    });
});
