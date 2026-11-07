import { describe, expect, it } from "vitest";
import { isCatalogSearchShortcut, isPageJumpShortcut, shouldPageJumpHandleEscape } from "../keyboardShortcuts";

describe("search palette keyboard shortcuts", () => {
    it("opens Page Jump with slash outside editable controls", () => {
        expect(isPageJumpShortcut({ key: "/", ctrlKey: false, metaKey: false }, false)).toBe(true);
        expect(isPageJumpShortcut({ key: "/", ctrlKey: false, metaKey: false }, true)).toBe(false);
    });

    it("opens Catalog Search with Ctrl/Cmd+K outside editable controls", () => {
        expect(isCatalogSearchShortcut({ key: "k", ctrlKey: true, metaKey: false }, false)).toBe(true);
        expect(isCatalogSearchShortcut({ key: "K", ctrlKey: false, metaKey: true }, false)).toBe(true);
        expect(isCatalogSearchShortcut({ key: "k", ctrlKey: false, metaKey: false }, false)).toBe(false);
        expect(isCatalogSearchShortcut({ key: "k", ctrlKey: true, metaKey: false }, true)).toBe(false);
    });

    it("only lets an open Page Jump palette handle Escape outside editable controls", () => {
        expect(shouldPageJumpHandleEscape({ key: "Escape" }, false, false)).toBe(false);
        expect(shouldPageJumpHandleEscape({ key: "Escape" }, true, true)).toBe(false);
        expect(shouldPageJumpHandleEscape({ key: "Escape" }, true, false)).toBe(true);
        expect(shouldPageJumpHandleEscape({ key: "Enter" }, true, false)).toBe(false);
    });
});
