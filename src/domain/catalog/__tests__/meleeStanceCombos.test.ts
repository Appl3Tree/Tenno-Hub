import { describe, expect, it } from "vitest";
import { getStancesForWeapon } from "../modCatalog";
import { getWeaponsByCategory } from "../weaponCatalog";
import {
    getWikiMeleeStanceCombo,
    WIKI_MELEE_STANCE_COMBOS,
    WIKI_MELEE_STANCE_SOURCE_LAST_EDITED,
    WIKI_MELEE_STANCE_VERIFIED_AT,
} from "../meleeStanceCombos";

describe("Wiki melee stance combo catalog", () => {
    it("provides current Wiki Neutral combo values for every documented catalog stance", () => {
        const catalogStanceNames = new Set(
            getWeaponsByCategory("Melee").flatMap((weapon) => getStancesForWeapon(weapon).map((stance) => stance.name)),
        );
        const wikiNames = WIKI_MELEE_STANCE_COMBOS.map((combo) => combo.stanceName);

        expect(wikiNames).toHaveLength(58);
        expect(new Set(wikiNames).size).toBe(wikiNames.length);
        expect(wikiNames.every((name) => catalogStanceNames.has(name))).toBe(true);
        expect(WIKI_MELEE_STANCE_SOURCE_LAST_EDITED).toBe("2026-10-02");
        expect(WIKI_MELEE_STANCE_VERIFIED_AT).toBe("2026-11-15");
        for (const combo of WIKI_MELEE_STANCE_COMBOS) {
            expect(combo.comboType).toBe("Neutral");
            expect(combo.comboName.length).toBeGreaterThan(0);
            expect(combo.baseComboLengthSeconds).toBeGreaterThan(0);
            expect(combo.totalDamageMultiplier).toBeGreaterThanOrEqual(0);
            expect(combo.totalSlashProcMultiplier).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(combo.baseComboLengthSeconds + combo.totalDamageMultiplier + combo.totalSlashProcMultiplier)).toBe(true);
        }
    });

    it("returns no estimate for catalog entries without a timed Wiki combo", () => {
        const unlistedStances = new Set([
            "Assassin Posture",
            "Balanced Posture",
            "Biting Piranha",
            "Blade Storm",
            "Elusive Posture",
            "Frenzied Posture",
            "Landslide",
            "Persistent Posture",
            "Protector Posture",
            "Razorwing",
            "Shattered Lash",
            "Whipclaw",
        ]);
        const catalogStanceNames = new Set(
            getWeaponsByCategory("Melee").flatMap((weapon) => getStancesForWeapon(weapon).map((stance) => stance.name)),
        );
        const missingRows = [...catalogStanceNames].filter((name) => !getWikiMeleeStanceCombo(name)).sort();

        expect(missingRows).toEqual([...unlistedStances].sort());
        expect(getWikiMeleeStanceCombo("Tempo Royale")).toMatchObject({
            stanceName: "Tempo Royale",
            comboName: "August Mesto",
            baseComboLengthSeconds: 4.65,
            totalDamageMultiplier: 19,
            totalSlashProcMultiplier: 0,
        });
        expect(getWikiMeleeStanceCombo("Unlisted Stance")).toBeNull();
    });
});
