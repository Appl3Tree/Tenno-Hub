import { describe, expect, it } from "vitest";
import {
    collectRelicMissionRewardRows,
    relicKeyFromRewardName,
    validateRelicMissionRewardReferences,
} from "../lib/relicData";

describe("relic mission reward normalization", () => {
    it("maps refinement suffixes to the canonical base relic key", () => {
        expect(relicKeyFromRewardName("Lith L8 Relic (Radiant)")).toBe("lith l8");
        expect(relicKeyFromRewardName("Axi A12 Relic")).toBe("axi a12");
        expect(relicKeyFromRewardName("not a relic reward")).toBeNull();
    });

    it("collects both flat and rotational relic rewards with their source paths", () => {
        const rows = collectRelicMissionRewardRows({
            Earth: {
                "Oro / Exterminate": {
                    rewards: [
                        { itemName: "Lith L8 Relic (Radiant)", chance: 2.5 },
                    ],
                },
                "Oro / Survival": {
                    rewards: {
                        C: [{ itemName: "Lith L8 Relic", chance: 11 }],
                    },
                },
            },
        });

        expect(rows).toEqual([
            {
                relicKey: "lith l8",
                relicDisplay: "Lith L8 Relic (Radiant)",
                pathLabel: "missionRewards / Earth / Oro / Exterminate",
                rotation: "",
                chance: 2.5,
            },
            {
                relicKey: "lith l8",
                relicDisplay: "Lith L8 Relic",
                pathLabel: "missionRewards / Earth / Oro / Survival / C",
                rotation: "C",
                chance: 11,
            },
        ]);
    });

    it("fails on relic-looking labels it cannot normalize or invalid chances", () => {
        expect(() => collectRelicMissionRewardRows({ Earth: { Node: {
            rewards: [{ itemName: "Some Unknown Relic Reward", chance: 1 }],
        } } })).toThrow(/unrecognized relic name/);
        expect(() => collectRelicMissionRewardRows({ Earth: { Node: {
            rewards: [{ itemName: "Lith L8 Relic", chance: "NaN" }],
        } } })).toThrow(/invalid chance/);
    });

    it("cross-checks normalized mission relics against named Intact catalog entries", () => {
        const missionRewards = { Earth: { Node: {
            rewards: [{ itemName: "Lith L8 Relic (Radiant)", chance: 2.5 }],
        } } };
        const relicCatalog = { relics: [{ tier: "Lith", relicName: "L8", state: "Intact" }] };

        expect(() => validateRelicMissionRewardReferences(missionRewards, relicCatalog)).not.toThrow();
        expect(() => validateRelicMissionRewardReferences({ Earth: { Node: {
            rewards: [{ itemName: "Lith L9 Relic", chance: 2.5 }],
        } } }, relicCatalog)).toThrow(/missing from the named Intact relics\.json catalog.*Lith L9 Relic/);
        expect(() => validateRelicMissionRewardReferences(missionRewards, {
            relics: [
                { tier: "Lith", relicName: "L8", state: "Intact" },
                { tier: "Lith", relicName: "L8", state: "Intact" },
            ],
        })).toThrow(/duplicate Intact canonical identities.*lith l8/);
    });
});
