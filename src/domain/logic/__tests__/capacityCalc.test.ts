import { describe, expect, it } from "vitest";
import { emptyEffect, type ModEntry } from "../../catalog/modCatalog";
import { computeCapacity, effectiveDrain, fitsWithinCapacity, type CapacityConfig } from "../capacityCalc";

function makeMod(
    uniqueName: string,
    options: { baseDrain: number; fusionLimit: number; polarity?: string; isAura?: boolean; isStance?: boolean },
): ModEntry {
    const effect = emptyEffect();
    return {
        uniqueName,
        path: uniqueName,
        name: uniqueName,
        compatBucket: "Rifle",
        rawCompatName: "Rifle",
        polarity: options.polarity ?? "",
        rarity: "Common",
        drain: options.baseDrain + options.fusionLimit,
        baseDrain: options.baseDrain,
        fusionLimit: options.fusionLimit,
        statsLabel: "",
        statsTextByRank: Array(options.fusionLimit + 1).fill(""),
        effectsByRank: Array(options.fusionLimit + 1).fill(effect),
        effect,
        hasDamageEffect: false,
        isAura: options.isAura ?? false,
        isExilus: false,
        isStance: options.isStance ?? false,
        incompatibilityGroup: uniqueName,
        compatibilityTags: [],
        incompatibilityTags: [],
    };
}

describe("effectiveDrain polarity rules", () => {
    it("charges unpolarized mods their full drain in neutral slots", () => {
        const mod = makeMod("unpolarized", { baseDrain: 9, fusionLimit: 0 });

        expect(effectiveDrain(mod, "")).toBe(9);
        expect(effectiveDrain(mod, "madurai")).toBe(12);
        expect(computeCapacity(
            { weaponRank: 0, hasCatalyst: false, masteryRank: 0, canOverLevel: false },
            [{ polarity: "" }],
            [mod],
            [0],
        ).usedCapacity).toBe(9);
    });

    it("rounds matching reductions up and mismatching increases up", () => {
        const mod = makeMod("odd-drain", { baseDrain: 5, fusionLimit: 0, polarity: "madurai" });

        expect(effectiveDrain(mod, "madurai")).toBe(3);
        expect(effectiveDrain(mod, "vazarin")).toBe(7);
    });

    it("applies neutral, matching, and mismatching bonus capacity to auras and stances", () => {
        const aura = makeMod("aura", { baseDrain: -3, fusionLimit: 3, polarity: "madurai", isAura: true });
        const stance = makeMod("stance", { baseDrain: -3, fusionLimit: 3, polarity: "madurai", isStance: true });

        for (const mod of [aura, stance]) {
            expect(effectiveDrain(mod, "")).toBe(-6);
            expect(effectiveDrain(mod, "madurai")).toBe(-12);
            expect(effectiveDrain(mod, "vazarin")).toBe(-4);
        }
    });
});

describe("fitsWithinCapacity", () => {
    it.each([
        {
            name: "ordinary drains with matching and mismatching polarities",
            config: { weaponRank: 30, hasCatalyst: false, masteryRank: 10, canOverLevel: false },
            polarities: ["madurai", "naramon", ""],
            mods: [
                makeMod("matching", { baseDrain: 4, fusionLimit: 6, polarity: "madurai" }),
                makeMod("mismatching", { baseDrain: 5, fusionLimit: 5, polarity: "madurai" }),
                makeMod("neutral", { baseDrain: 2, fusionLimit: 3 }),
            ],
            ranks: [6, 3, 3],
            extras: [],
        },
        {
            name: "aura grants and an extra stance slot",
            config: { weaponRank: 30, hasCatalyst: true, masteryRank: 30, canOverLevel: false },
            polarities: ["madurai", ""],
            mods: [
                makeMod("aura", { baseDrain: -2, fusionLimit: 5, polarity: "madurai", isAura: true }),
                makeMod("regular", { baseDrain: 6, fusionLimit: 8, polarity: "naramon" }),
            ],
            ranks: [5, 8],
            extras: [{
                mod: makeMod("stance", { baseDrain: -2, fusionLimit: 5, polarity: "madurai", isStance: true }),
                rank: 5,
                polarity: "madurai",
            }],
        },
        {
            name: "mod arrays longer than the supplied polarity array",
            config: { weaponRank: 10, hasCatalyst: false, masteryRank: 0, canOverLevel: false },
            polarities: [],
            mods: [makeMod("unpolarized", { baseDrain: 8, fusionLimit: 8 })],
            ranks: [8],
            extras: [],
        },
    ] satisfies Array<{
        name: string;
        config: CapacityConfig;
        polarities: string[];
        mods: ModEntry[];
        ranks: number[];
        extras: Array<{ mod: ModEntry; rank: number; polarity: string }>;
    }>)("matches the detailed capacity calculation for $name", ({ config, polarities, mods, ranks, extras }) => {
        const modPolarities = mods.map((_, index) => polarities[index] ?? "");
        const detailed = computeCapacity(
            config,
            [...extras.map((slot) => ({ polarity: slot.polarity })), ...modPolarities.map((polarity) => ({ polarity }))],
            [...extras.map((slot) => slot.mod), ...mods],
            [...extras.map((slot) => slot.rank), ...ranks],
        );

        expect(fitsWithinCapacity(config, polarities, mods, ranks, extras)).toBe(!detailed.overCapacity);
    });
});
