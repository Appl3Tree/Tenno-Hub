import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredTheme, setAppTheme, subscribeAppTheme, THEME_KEY } from "../settingsPreferences";

describe("shared theme preference", () => {
    const storedValues = new Map<string, string>();
    const rootClasses = new Set<string>();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const storageSetItem = vi.fn((key: string, value: string) => storedValues.set(key, value));

    beforeEach(() => {
        storedValues.clear();
        rootClasses.clear();
        addEventListener.mockClear();
        removeEventListener.mockClear();
        storageSetItem.mockClear();

        vi.stubGlobal("localStorage", {
            getItem: (key: string) => storedValues.get(key) ?? null,
            setItem: storageSetItem,
        });
        vi.stubGlobal("document", {
            documentElement: {
                classList: {
                    add: (name: string) => rootClasses.add(name),
                    remove: (name: string) => rootClasses.delete(name),
                },
                style: {},
            },
        });
        vi.stubGlobal("window", { addEventListener, removeEventListener });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("reads the existing persisted preference and defaults to dark", () => {
        expect(getStoredTheme()).toBe("dark");
        storedValues.set(THEME_KEY, "light");
        expect(getStoredTheme()).toBe("light");
    });

    it("persists the preference and updates the document theme classes", () => {
        setAppTheme("light");
        expect(storageSetItem).toHaveBeenCalledWith(THEME_KEY, "light");
        expect(rootClasses.has("theme-light")).toBe(true);
        expect(rootClasses.has("theme-dark")).toBe(false);
        expect(document.documentElement.style.colorScheme).toBe("light");

        setAppTheme("dark");
        expect(storageSetItem).toHaveBeenLastCalledWith(THEME_KEY, "dark");
        expect(rootClasses.has("theme-light")).toBe(false);
        expect(rootClasses.has("theme-dark")).toBe(true);
        expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("notifies every mounted theme control when one control changes the preference", () => {
        const sidebarControl = vi.fn();
        const settingsControl = vi.fn();
        const unsubscribeSidebar = subscribeAppTheme(sidebarControl);
        const unsubscribeSettings = subscribeAppTheme(settingsControl);

        expect(addEventListener).toHaveBeenCalledOnce();
        setAppTheme("light");

        expect(sidebarControl).toHaveBeenCalledOnce();
        expect(settingsControl).toHaveBeenCalledOnce();

        unsubscribeSidebar();
        unsubscribeSettings();
        expect(removeEventListener).toHaveBeenCalledWith("storage", expect.any(Function));
    });

    it("applies a theme changed in another browser tab", () => {
        const control = vi.fn();
        const unsubscribe = subscribeAppTheme(control);
        const storageListener = addEventListener.mock.calls.find(([eventName]) => eventName === "storage")?.[1] as
            | ((event: StorageEvent) => void)
            | undefined;

        expect(storageListener).toBeDefined();
        storageListener?.({ key: THEME_KEY, newValue: "light" } as StorageEvent);

        expect(control).toHaveBeenCalledOnce();
        expect(rootClasses.has("theme-light")).toBe(true);
        expect(document.documentElement.style.colorScheme).toBe("light");
        unsubscribe();
    });
});
