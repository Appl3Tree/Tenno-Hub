type PreloadRecoveryWindow = Pick<Window, "addEventListener" | "location" | "sessionStorage"> & {
    document: Pick<Document, "querySelector">;
};

const PRELOAD_RELOAD_KEY_PREFIX = "tenno-hub:vite-preload-reload:";

export function installVitePreloadRecovery(targetWindow: PreloadRecoveryWindow = window) {
    const buildId = targetWindow.document.querySelector<HTMLMetaElement>('meta[name="wfpt-build-id"]')?.content ?? "unknown";
    const storageKey = `${PRELOAD_RELOAD_KEY_PREFIX}${buildId}`;

    targetWindow.addEventListener("vite:preloadError", (event) => {
        try {
            if (targetWindow.sessionStorage.getItem(storageKey) === "1") return;
            targetWindow.sessionStorage.setItem(storageKey, "1");
        } catch {
            // If session storage is unavailable, let the existing error boundary report the failure.
            return;
        }

        event.preventDefault();
        targetWindow.location.reload();
    });
}
