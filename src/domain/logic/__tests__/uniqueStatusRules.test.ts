import { describe, expect, it } from "vitest";
import {
    getDirectDamageEligibleStatusTypes,
    filterExternalStatusTypesForTarget,
    normalizeExternalStatusTypes,
    unionUniqueStatusTypes,
} from "../uniqueStatusRules";

describe("external unique status rules", () => {
    it("validates and de-duplicates named external status types", () => {
        expect(normalizeExternalStatusTypes([
            "viral",
            "viral",
            "microwave",
            "unsupported",
        ])).toEqual(["viral", "microwave"]);
        expect(normalizeExternalStatusTypes(undefined)).toEqual([]);
    });

    it("keeps Lifted and Knockdown mutually exclusive", () => {
        expect(normalizeExternalStatusTypes(["knockdown", "lifted"])).toContain("lifted");
        expect(normalizeExternalStatusTypes(["knockdown", "lifted"])).not.toContain("knockdown");
        expect(normalizeExternalStatusTypes(["lifted", "knockdown"])).toContain("knockdown");
        expect(normalizeExternalStatusTypes(["lifted", "knockdown"])).not.toContain("lifted");
        expect(unionUniqueStatusTypes(["lifted", "knockdown"])).toEqual(new Set(["knockdown"]));
        expect(unionUniqueStatusTypes(["knockdown"], ["lifted"])).toEqual(new Set(["lifted"]));
    });

    it("excludes Tau from direct Galvanized status bonuses but retains unique utility statuses", () => {
        expect(getDirectDamageEligibleStatusTypes([
            "viral",
            "tau",
            "lifted",
            "knockdown",
            "microwave",
        ])).toEqual(new Set(["viral", "microwave", "knockdown"]));
    });

    it("does not assume an external damage status that the selected target cannot receive", () => {
        expect(filterExternalStatusTypesForTarget(
            ["viral", "heat", "lifted"],
            ["viral"],
            { heat: 0 },
        )).toEqual(["lifted"]);
    });

    it("keeps empty and invalid external status inputs empty for any target profile", () => {
        const immuneTypes = new Set(["viral"] as const);
        expect(filterExternalStatusTypesForTarget(undefined, immuneTypes)).toEqual([]);
        expect(filterExternalStatusTypesForTarget([], immuneTypes)).toEqual([]);
        expect(filterExternalStatusTypesForTarget(["unsupported"], immuneTypes)).toEqual([]);
    });
});
