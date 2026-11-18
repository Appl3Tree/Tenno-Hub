import { describe, expect, it, vi } from "vitest";
import { installVitePreloadRecovery } from "../vitePreloadRecovery";

function createRecoveryTarget(buildId: string, values = new Map<string, string>(), reload = vi.fn()) {
    const target = new EventTarget();
    const storage = {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    };
    const recoveryWindow = Object.assign(target, {
        document: {
            querySelector: () => ({ content: buildId }),
        },
        location: { reload },
        sessionStorage: storage,
    }) as unknown as Window;

    return { target, recoveryWindow, reload, values };
}

describe("Vite preload recovery", () => {
    it("reloads once per build and lets a repeated failure reach the error boundary", () => {
        const { target, recoveryWindow, reload } = createRecoveryTarget("build-a");
        installVitePreloadRecovery(recoveryWindow);

        const firstError = new Event("vite:preloadError", { cancelable: true });
        target.dispatchEvent(firstError);

        expect(firstError.defaultPrevented).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);

        const repeatedError = new Event("vite:preloadError", { cancelable: true });
        target.dispatchEvent(repeatedError);

        expect(repeatedError.defaultPrevented).toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("allows a new build to make one independent recovery attempt", () => {
        const values = new Map<string, string>();
        const first = createRecoveryTarget("build-a", values);
        const second = createRecoveryTarget("build-b", values);
        installVitePreloadRecovery(first.recoveryWindow);
        installVitePreloadRecovery(second.recoveryWindow);

        first.target.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
        second.target.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));

        expect(first.reload).toHaveBeenCalledTimes(1);
        expect(second.reload).toHaveBeenCalledTimes(1);
    });

    it("leaves the error unhandled when session storage is unavailable", () => {
        const { target, recoveryWindow, reload } = createRecoveryTarget("build-a");
        Object.defineProperty(recoveryWindow, "sessionStorage", {
            configurable: true,
            value: {
                getItem: () => { throw new Error("blocked"); },
                setItem: () => { throw new Error("blocked"); },
            },
        });
        installVitePreloadRecovery(recoveryWindow);

        const error = new Event("vite:preloadError", { cancelable: true });
        target.dispatchEvent(error);

        expect(error.defaultPrevented).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });
});
