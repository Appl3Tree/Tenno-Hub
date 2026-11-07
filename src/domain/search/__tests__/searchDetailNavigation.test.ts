import { describe, expect, it } from "vitest";
import { buildSearchDetailHash, type SearchDetailRef } from "../searchDetailHash";
import { appendSearchDetailRef, syncSearchDetailStack } from "../searchDetailNavigation";

const itemA: SearchDetailRef = { kind: "item", id: "/Lotus/Weapons/Tenno/Rifle/ExampleA" };
const itemB: SearchDetailRef = { kind: "item", id: "/Lotus/Weapons/Tenno/Rifle/ExampleB" };

describe("catalog inspector navigation history", () => {
    it("keeps a nested inspector trail when browser Back is followed by Forward", () => {
        const nested = appendSearchDetailRef([itemA], itemB);
        const afterBack = syncSearchDetailStack(nested, buildSearchDetailHash(itemA));
        const afterForward = syncSearchDetailStack(afterBack, buildSearchDetailHash(itemB));

        expect(afterBack).toEqual([itemA]);
        expect(afterForward).toEqual([itemA, itemB]);
    });

    it("clears the trail after leaving the inspector and resets for a direct link", () => {
        expect(syncSearchDetailStack([itemA, itemB], "")).toEqual([]);
        expect(syncSearchDetailStack([], buildSearchDetailHash(itemB))).toEqual([itemB]);
    });

    it("does not duplicate the currently selected inspector entry", () => {
        const stack = appendSearchDetailRef([itemA], itemA);
        expect(stack).toEqual([itemA]);
        expect(appendSearchDetailRef([itemA, itemB], itemA, true)).toEqual([itemA]);
    });
});
