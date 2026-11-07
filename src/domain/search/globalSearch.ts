import ALL_RAW from "../../data/_generated/warframe-items-all-lean.auto.json";
import { FULL_CATALOG, type CatalogId, type CatalogSource } from "../catalog/loadFullCatalog";
import { getManualReleaseDateFallback, withManualReleaseDateFallback } from "../../catalog/items/manualReleaseDates";
import type { SearchDetailRef } from "./searchDetailHash";

export { buildSearchDetailHash, buildSearchDetailHref, parseSearchDetailHash } from "./searchDetailHash";
export type { SearchDetailRef } from "./searchDetailHash";

export type SearchEntityKind = "item" | "mod" | "arcane";

export type SearchEntityResult = SearchDetailRef & {
    name: string;
    subtitle: string;
    summary: string;
    keywords: string[];
};

export type SearchEntityRecord = Record<string, unknown> & {
    uniqueName?: string;
    name?: string;
    category?: string;
    compatName?: string;
    type?: string;
    description?: string;
    imageName?: string;
    wikiaThumbnail?: string;
    wikiaUrl?: string;
    rarity?: string;
    fusionLimit?: number;
    releaseDate?: string;
    tradable?: boolean;
    masteryReq?: number;
    modSet?: string;
    polarity?: string;
    marketCost?: number;
    ducats?: number;
    tags?: unknown;
    drops?: unknown;
    levelStats?: unknown;
    texture?: string;
    texture_new?: string;
};

const CATALOG_SOURCES: CatalogSource[] = ["items", "mods", "modsets", "rivens", "moddescriptions"];

function normalizeText(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function tokenize(value: string): string[] {
    return normalizeText(value).split(/\s+/).filter(Boolean);
}

function asStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean);
}

function getEntityKind(entry: SearchEntityRecord): SearchEntityKind {
    if (entry.category === "Mods") return "mod";
    if (entry.category === "Arcanes") return "arcane";
    return "item";
}

function buildSubtitle(entry: SearchEntityRecord, kind: SearchEntityKind): string {
    if (kind === "mod") {
        return [entry.compatName, entry.rarity, entry.type].filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" · ") || "Mod";
    }
    if (kind === "arcane") {
        return [entry.compatName, entry.rarity, entry.type].filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" · ") || "Arcane";
    }
    return [entry.category, entry.type].filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" · ") || "Item";
}

function buildSummary(entry: SearchEntityRecord, subtitle: string): string {
    const description = typeof entry.description === "string" ? entry.description.trim() : "";
    return description || subtitle;
}

function buildKeywords(entry: SearchEntityRecord): string[] {
    const keywords = [
        entry.category,
        entry.compatName,
        entry.type,
        entry.rarity,
        entry.modSet,
        ...asStringList(entry.tags),
    ];

    return Array.from(
        new Set(
            keywords
                .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
                .map((part) => part.trim()),
        ),
    );
}

function scoreEntity(result: SearchEntityResult, query: string): number {
    if (!query) return 0;
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return 0;

    const name = normalizeText(result.name);
    const subtitle = normalizeText(result.subtitle);
    const summary = normalizeText(result.summary);
    const keywords = result.keywords.map(normalizeText);
    const queryTokens = tokenize(query);
    const nameTokens = tokenize(result.name);
    const keywordTokens = keywords.flatMap(tokenize);

    let score = 0;

    if (name === normalizedQuery) score += 400;
    else if (name.startsWith(normalizedQuery)) score += 220;
    else if (name.includes(normalizedQuery)) score += 140;

    if (subtitle.startsWith(normalizedQuery)) score += 70;
    else if (subtitle.includes(normalizedQuery)) score += 35;

    if (summary.includes(normalizedQuery)) score += 28;

    for (const keyword of keywords) {
        if (keyword === normalizedQuery) score += 80;
        else if (keyword.startsWith(normalizedQuery)) score += 45;
        else if (keyword.includes(normalizedQuery)) score += 20;
    }

    for (const token of queryTokens) {
        if (nameTokens.some((nameToken) => nameToken.startsWith(token))) score += 24;
        if (keywordTokens.some((keywordToken) => keywordToken.startsWith(token))) score += 14;
    }

    if (result.kind === "mod") score += 6;
    if (result.kind === "arcane") score += 8;

    return score;
}

const ALL_ENTITIES: SearchEntityResult[] = (() => {
    const out: SearchEntityResult[] = [];
    const seen = new Set<string>();

    for (const rawEntry of ALL_RAW as SearchEntityRecord[]) {
        const raw = withManualReleaseDateFallback(rawEntry);
        const id = typeof raw.uniqueName === "string" ? raw.uniqueName.trim() : "";
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!id || !name) continue;

        const kind = getEntityKind(raw);
        const dedupeKey = `${kind}:${id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const subtitle = buildSubtitle(raw, kind);
        out.push({
            kind,
            id,
            name,
            subtitle,
            summary: buildSummary(raw, subtitle),
            keywords: buildKeywords(raw),
        });

        const components = raw.components;
        if (Array.isArray(components)) {
            for (const comp of components) {
                if (!comp || typeof comp !== "object" || Array.isArray(comp)) continue;
                const compRaw = comp as Record<string, unknown>;
                const compId = typeof compRaw.uniqueName === "string" ? compRaw.uniqueName.trim() : "";
                if (!compId) continue;

                // Prefer the catalog display name (same source crafting tree uses) over the short WFCD component name
                let compName = typeof compRaw.name === "string" ? compRaw.name.trim() : "";
                for (const source of CATALOG_SOURCES) {
                    const catalogId = `${source}:${compId}`;
                    const record = (FULL_CATALOG.recordsById as Record<string, { displayName?: string }>)[catalogId];
                    if (record?.displayName) {
                        compName = record.displayName;
                        break;
                    }
                }
                if (!compName) continue;

                const compKey = `item:${compId}`;
                if (seen.has(compKey)) continue;
                seen.add(compKey);

                const compSubtitle = `${name} Component`;
                out.push({
                    kind: "item",
                    id: compId,
                    name: compName,
                    subtitle: compSubtitle,
                    summary: compSubtitle,
                    keywords: [name, ...(typeof raw.category === "string" ? [raw.category] : [])],
                });
            }
        }
    }

    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
})();

const ENTITY_BY_KEY = new Map<string, SearchEntityResult>(ALL_ENTITIES.map((entity) => [`${entity.kind}:${entity.id}`, entity]));
const ENTITY_DATA_BY_ID = new Map<string, SearchEntityRecord>(
    (ALL_RAW as SearchEntityRecord[])
        .map((entry) => withManualReleaseDateFallback(entry))
        .filter((entry) => typeof entry.uniqueName === "string" && entry.uniqueName.trim().length > 0)
        .map((entry) => [String(entry.uniqueName), entry]),
);

function getCatalogRecordForPath(path: string) {
    const catalogId = getCatalogIdForPath(path);
    if (!catalogId) return null;
    return FULL_CATALOG.recordsById[catalogId] ?? null;
}

function getResultItemPathFromRaw(raw: Record<string, unknown>): string | null {
    const lotus = (raw.rawLotus ?? raw) as Record<string, unknown>;
    const data = lotus.data;
    if (!data || typeof data !== "object") return null;

    const resultItemType = (data as Record<string, unknown>).resultItemType;
    if (typeof resultItemType === "string" && resultItemType.trim()) return resultItemType.trim();

    const resultItem = (data as Record<string, unknown>).ResultItem;
    if (typeof resultItem === "string" && resultItem.startsWith("/Lotus/StoreItems/")) {
        return null;
    }
    if (typeof resultItem === "string" && resultItem.trim()) return resultItem.trim();

    return null;
}

function inferKindFromCatalogRecord(path: string): SearchEntityKind {
    const catalogRecord = getCatalogRecordForPath(path);
    const category = catalogRecord?.categories?.[0] ?? "";
    if (category === "Mods") return "mod";
    if (category === "Arcanes") return "arcane";
    return "item";
}

function getFallbackSearchEntity(ref: SearchDetailRef): SearchEntityResult | null {
    const catalogRecord = getCatalogRecordForPath(ref.id);
    if (!catalogRecord) return null;

    const raw = (catalogRecord.raw ?? {}) as Record<string, unknown>;
    const lotus = (raw.rawLotus ?? raw) as Record<string, unknown>;
    const wfcd = (raw.rawWfcd ?? raw) as Record<string, unknown>;
    const category = catalogRecord.categories[0] ?? (typeof wfcd.category === "string" ? wfcd.category : "Item");
    const type =
        typeof wfcd.type === "string" && wfcd.type.trim()
            ? wfcd.type
            : typeof lotus.tag === "string" && lotus.tag.trim()
                ? lotus.tag
                : typeof lotus.data === "object" && lotus.data && typeof (lotus.data as Record<string, unknown>).ProductCategory === "string"
                    ? String((lotus.data as Record<string, unknown>).ProductCategory)
                    : "";
    const subtitle = buildSubtitle({ category, type }, ref.kind);

    return {
        kind: ref.kind,
        id: ref.id,
        name: catalogRecord.displayName,
        subtitle,
        summary: subtitle,
        keywords: [category, type].filter((value): value is string => Boolean(value && value.trim())),
    };
}

function getFallbackSearchEntityData(ref: SearchDetailRef): SearchEntityRecord | null {
    const catalogRecord = getCatalogRecordForPath(ref.id);
    if (!catalogRecord) return null;

    const raw = (catalogRecord.raw ?? {}) as Record<string, unknown>;
    const lotus = (raw.rawLotus ?? raw) as Record<string, unknown>;
    const wfcd = (raw.rawWfcd ?? raw) as Record<string, unknown>;
    const category = catalogRecord.categories[0] ?? (typeof wfcd.category === "string" ? wfcd.category : "Item");
    const type =
        typeof wfcd.type === "string" && wfcd.type.trim()
            ? wfcd.type
            : typeof lotus.tag === "string" && lotus.tag.trim()
                ? lotus.tag
                : typeof lotus.data === "object" && lotus.data && typeof (lotus.data as Record<string, unknown>).ProductCategory === "string"
                    ? String((lotus.data as Record<string, unknown>).ProductCategory)
                    : undefined;
    const texture = typeof lotus.texture === "string" ? lotus.texture : undefined;
    const textureNew = typeof lotus.texture_new === "string" ? lotus.texture_new : undefined;
    const resultItemPath = getResultItemPathFromRaw(raw);
    const resultItemData = resultItemPath ? ENTITY_DATA_BY_ID.get(resultItemPath) ?? null : null;
    const releaseDate =
        typeof wfcd.releaseDate === "string"
            ? wfcd.releaseDate
            : typeof lotus.releaseDate === "string"
                ? lotus.releaseDate
                : getManualReleaseDateFallback({
                    uniqueName: ref.id,
                    category,
                    type,
                    releaseDate: undefined,
                });
    const tradable =
        typeof wfcd.tradable === "boolean"
            ? wfcd.tradable
            : typeof lotus.tradable === "boolean"
                ? lotus.tradable
                : undefined;
    const masteryReq =
        typeof wfcd.masteryReq === "number"
            ? wfcd.masteryReq
            : typeof lotus.masteryReq === "number"
                ? lotus.masteryReq
                : undefined;
    const marketCost =
        typeof wfcd.marketCost === "number"
            ? wfcd.marketCost
            : typeof lotus.data === "object" && lotus.data && typeof (lotus.data as Record<string, unknown>).RegularPrice === "number"
                ? Number((lotus.data as Record<string, unknown>).RegularPrice)
                : undefined;

    return {
        uniqueName: ref.id,
        name: catalogRecord.displayName,
        category,
        type,
        description: typeof wfcd.description === "string" ? wfcd.description : undefined,
        imageName: typeof resultItemData?.imageName === "string" ? resultItemData.imageName : undefined,
        wikiaThumbnail: typeof resultItemData?.wikiaThumbnail === "string" ? resultItemData.wikiaThumbnail : undefined,
        releaseDate,
        tradable,
        masteryReq,
        marketCost,
        texture,
        texture_new: textureNew,
    };
}

export function searchCatalogEntities(query: string, limit = 10): SearchEntityResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    return ALL_ENTITIES
        .map((entity) => ({ entity, score: scoreEntity(entity, trimmed) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.entity.name.localeCompare(b.entity.name);
        })
        .slice(0, limit)
        .map((entry) => entry.entity);
}

export function getSearchEntity(ref: SearchDetailRef): SearchEntityResult | null {
    return ENTITY_BY_KEY.get(`${ref.kind}:${ref.id}`) ?? getFallbackSearchEntity(ref);
}

export function getSearchEntityData(ref: SearchDetailRef): SearchEntityRecord | null {
    const entry = ENTITY_DATA_BY_ID.get(ref.id) ?? null;
    if (!entry) return getFallbackSearchEntityData(ref);
    return getEntityKind(entry) === ref.kind ? entry : getFallbackSearchEntityData(ref);
}

export function getSearchEntityImageUrl(entry: SearchEntityRecord | null): string | null {
    if (!entry) return null;
    if (typeof entry.wikiaThumbnail === "string" && entry.wikiaThumbnail.trim()) return entry.wikiaThumbnail.trim();
    if (typeof entry.imageName === "string" && entry.imageName.trim()) {
        return `https://cdn.warframestat.us/img/${entry.imageName.trim()}`;
    }
    if (typeof entry.texture_new === "string" && /^https?:\/\//i.test(entry.texture_new.trim())) return entry.texture_new.trim();
    if (typeof entry.texture === "string" && /^https?:\/\//i.test(entry.texture.trim())) return entry.texture.trim();
    return null;
}

export function getSearchEntityWikiUrl(entry: SearchEntityRecord | null, fallbackName?: string): string | null {
    if (entry && typeof entry.wikiaUrl === "string" && entry.wikiaUrl.trim()) return entry.wikiaUrl.trim();
    const name = fallbackName?.trim();
    if (!name) return null;
    return `https://wiki.warframe.com/w/${encodeURIComponent(name.replace(/\s+/g, "_"))}`;
}

export function getCatalogIdForPath(path: string): CatalogId | null {
    for (const source of CATALOG_SOURCES) {
        const catalogId = `${source}:${path}` as CatalogId;
        if (FULL_CATALOG.recordsById[catalogId]) return catalogId;
    }
    return null;
}

export function getSearchDetailRefForCatalogId(catalogId: CatalogId): SearchDetailRef | null {
    const rawId = String(catalogId);
    const colonIndex = rawId.indexOf(":");
    if (colonIndex < 0) return null;

    const path = rawId.slice(colonIndex + 1);
    const entry = ENTITY_DATA_BY_ID.get(path);
    if (!entry) {
        return {
            kind: inferKindFromCatalogRecord(path),
            id: path,
        };
    }

    return {
        kind: getEntityKind(entry),
        id: path,
    };
}
