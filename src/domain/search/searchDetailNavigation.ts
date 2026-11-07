import { parseSearchDetailHash, type SearchDetailRef } from "./searchDetailHash";

export function searchDetailRefsEqual(a: SearchDetailRef | null, b: SearchDetailRef | null): boolean {
    return a?.kind === b?.kind && a?.id === b?.id;
}

export function appendSearchDetailRef(
    stack: SearchDetailRef[],
    nextRef: SearchDetailRef,
    reset = false,
): SearchDetailRef[] {
    if (reset) return [nextRef];
    if (searchDetailRefsEqual(stack[stack.length - 1] ?? null, nextRef)) return stack;
    return [...stack, nextRef];
}

/** Reconciles the in-panel trail with a browser history navigation. */
export function syncSearchDetailStack(stack: SearchDetailRef[], hash: string): SearchDetailRef[] {
    const nextRef = parseSearchDetailHash(hash);
    if (!nextRef) return [];

    const existingIndex = stack.findIndex((ref) => searchDetailRefsEqual(ref, nextRef));
    if (existingIndex >= 0) return stack.slice(0, existingIndex + 1);

    // Forward navigation can revisit an inspector entry removed by a prior Back.
    // Keep the preceding trail so the inspector's own Back action remains available.
    return [...stack, nextRef];
}
