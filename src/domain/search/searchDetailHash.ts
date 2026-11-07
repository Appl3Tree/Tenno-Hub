export type SearchDetailRef = {
    kind: "item" | "mod" | "arcane";
    id: string;
};

const SEARCH_DETAIL_HASH_PREFIX = "#search-detail";

export function buildSearchDetailHash(ref: SearchDetailRef): string {
    const params = new URLSearchParams({ kind: ref.kind, id: ref.id });
    return `${SEARCH_DETAIL_HASH_PREFIX}?${params.toString()}`;
}

export function buildSearchDetailHref(
    ref: SearchDetailRef,
    locationLike?: Pick<Location, "origin" | "pathname" | "search">,
): string {
    const current = locationLike ?? window.location;
    return `${current.origin}${current.pathname}${current.search}${buildSearchDetailHash(ref)}`;
}

export function parseSearchDetailHash(hash: string): SearchDetailRef | null {
    if (!hash.startsWith(SEARCH_DETAIL_HASH_PREFIX)) return null;
    const queryIndex = hash.indexOf("?");
    const params = new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : "");
    const kind = params.get("kind");
    const id = params.get("id");
    if ((kind !== "item" && kind !== "mod" && kind !== "arcane") || !id) return null;
    return { kind, id };
}
